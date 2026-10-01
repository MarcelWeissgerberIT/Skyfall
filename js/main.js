// Boot: load generated assets, wire up systems, run the loop.
import { BitmapFont } from './font.js';
import { Sound, store } from './audio.js';
import { Game } from './game.js';
import { Renderer } from './render.js';
import { UI, Input } from './ui.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const TEX = ['sand', 'dirt', 'grass', 'concrete', 'asphalt'];
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('failed to load ' + src));
    im.src = src;
  });
}

// Minimal loading bar (no text until the font atlas is in).
function drawLoading(k, font) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth, H = window.innerHeight;
  if (canvas.width !== Math.round(W * dpr)) {
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0b1433';
  ctx.fillRect(0, 0, W, H);
  const w = Math.min(W * 0.6, 280), h = 14, x = (W - w) / 2, y = H * 0.6;
  ctx.fillStyle = '#f3e6c8';
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = '#0d1a44';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#c4231b';
  ctx.fillRect(x, y, w * k, h);
  if (font) {
    const s = Math.min(W, 420) / 400;
    font.draw(ctx, 'CALIBRATING PANIC...', W / 2, y - 40 * s, 16 * s, 0.5);
  }
}

async function boot() {
  drawLoading(0);
  const [fontImg, fontMeta, manifest] = await Promise.all([
    loadImage('assets/font/font.webp'),
    fetch('assets/font/font.json').then((r) => r.json()),
    fetch('assets/manifest.json').then((r) => r.json()),
  ]);
  const font = new BitmapFont(fontImg, fontMeta);
  const jobs = [];
  for (const k in manifest.sprites) jobs.push(['img', k, 'assets/sprites/' + k + '.webp']);
  for (const k in manifest.ui) jobs.push(['img', k, 'assets/ui/' + k + '.webp']);
  for (const k of TEX) jobs.push(['tex', k, 'assets/tex/' + k + '.webp']);
  const A = { img: {}, tex: {} };
  let done = 0;
  await Promise.all(
    jobs.map(([group, key, src]) =>
      loadImage(src).then((im) => {
        A[group][key] = im;
        done++;
        drawLoading(done / jobs.length, font);
      })
    )
  );
  start(A, font);
}

function start(A, font) {
  const sound = new Sound();
  const game = new Game(sound);
  const renderer = new Renderer(canvas, A);
  let best = parseFloat(store.get('skyfall.best', '0')) || 0;
  let newRecord = false;
  let input;

  const startGame = () => {
    game.reset();
    renderer.camInit = false;
    newRecord = false;
    ui.state = 'play';
    sound.musicOn = true;
  };

  const ui = new UI(ctx, A, font, {
    gesture: () => sound.init(),
    click: () => sound.play('click'),
    play: () => {
      if (store.get('skyfall.intro', '0') !== '1') {
        sound.musicOn = false;
        ui.startIntro(true);
      } else startGame();
    },
    introDone: (thenPlay) => {
      store.set('skyfall.intro', '1');
      sound.musicOn = true;
      if (thenPlay) startGame();
      else ui.state = 'title';
    },
    pause: () => {
      if (ui.state === 'play') ui.state = 'pause';
      sound.engine(false);
      sound.siren(false);
    },
    resume: () => {
      if (ui.state === 'pause') ui.state = 'play';
      const car = game.player.car;
      if (car && car.V.siren) sound.siren(true);
    },
    menu: () => {
      ui.state = 'title';
      sound.engine(false);
      sound.siren(false);
    },
    restart: () => startGame(),
    toggleSound: () => sound.toggle(),
    soundOn: () => sound.on,
    best: () => best,
    newRecord: () => newRecord,
    input: () => input,
    touch: () => isTouch,
    game: () => game,
  });
  // the intro button on the title screen should silence the theremin too
  const origStart = ui.startIntro.bind(ui);
  ui.startIntro = (thenPlay) => {
    sound.musicOn = false;
    origStart(thenPlay);
  };
  input = new Input(canvas, ui);

  const resize = () => {
    renderer.resize();
    ui.resize(renderer.W, renderer.H, renderer.dpr);
  };
  renderer.onResize = () => ui.resize(renderer.W, renderer.H, renderer.dpr);
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  resize();

  const idle = { mx: 0, my: 0, action: false, honk: false, boost: false };
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const st = ui.state;
    if (st === 'play') {
      game.viewR = renderer.viewRadius();
      game.update(dt, input.poll());
      if (game.over) {
        ui.state = 'over';
        if (game.time > best) {
          best = game.time;
          newRecord = true;
          store.set('skyfall.best', String(best));
        }
      }
    } else if (st === 'over') {
      game.update(dt, idle);
    }
    if (st === 'play' || st === 'pause' || st === 'over') renderer.render(game, st === 'pause' ? 0 : dt);
    ui.draw(dt, game, renderer);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // debug hooks for automated testing
  window.__skyfall = { game, ui, renderer, startGame, sound };
}

boot().catch((e) => {
  console.error(e);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#300';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
});
