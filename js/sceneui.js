// Adventure UI: point & click interiors, dialogue with portraits, the bag, the journal (tasks,
// gangs, map), the locker keypad, toasts and the endings. Everything drawn with the bitmap font.
import { clamp, rand, TILE, C } from './util.js';
import { FACTIONS, FACTION_IDS, CHARS, ITEMS, QUESTS, SCENES, ENDINGS, ENDING_IDS, repLabel, epilogue } from './story.js';
import { N, TT } from './world.js';
import { fmtTime } from './util.js';
import { fmtNum } from './vehicles.js';

const GLOW = { green: 'green', red: 'red', warm: 'warm', orange: 'orange', cyan: 'cyan', blue: 'blue', violet: 'violet', magenta: 'magenta', yellow: 'yellow', white: 'white' };

export class AdvUI {
  constructor(ui) {
    this.ui = ui;
    this.imgs = {};
    this.loading = {};
    this.smoke = [];
    this.motes = [];
    this.reveal = 0;
    this.bagOpen = false;
    this.journal = null; // null | 'tasks' | 'gangs' | 'map'
    this.endStep = 0;
    this.mapCanvas = null;
    this.mapWorld = null;
    this.invPage = 0;
  }

  // --- assets loaded on demand ----------------------------------------------------------------------
  image(path) {
    if (this.imgs[path]) return this.imgs[path];
    if (!this.loading[path]) {
      this.loading[path] = true;
      const im = new Image();
      im.onload = () => (this.imgs[path] = im);
      im.src = path;
    }
    return null;
  }
  preload() {
    for (const id in SCENES) this.image('assets/scenes/' + SCENES[id].bg + '.webp');
    this.image('assets/scenes/sheriff_bars.webp');
  }

  // --- layout ------------------------------------------------------------------------------------------
  layout() {
    const ui = this.ui, u = ui.u, W = ui.W, H = ui.H, sf = ui.safe;
    if (W / H < 0.95) {
      const top = sf.t + 52 * u;
      const S = Math.min(W, H - top - 250 * u - sf.b);
      return { portrait: true, sx: (W - S) / 2, sy: top, S, px: sf.l + 10 * u, py: top + S + 8 * u, pw: W - sf.l - sf.r - 20 * u, ph: H - (top + S + 8 * u) - sf.b - 8 * u };
    }
    const S = Math.min(H - sf.t - sf.b - 20 * u, W * 0.6);
    const sx = sf.l + 10 * u, sy = (H - S) / 2;
    const px = sx + S + 12 * u;
    return { portrait: false, sx, sy, S, px, py: sf.t + 58 * u, pw: W - px - sf.r - 10 * u, ph: H - sf.t - sf.b - 68 * u };
  }

  // --- the interior scene ----------------------------------------------------------------------------------
  drawScene(g, r, dt) {
    const ui = this.ui, ctx = ui.ctx, u = ui.u;
    const s = g.scene, def = s.def;
    const L = this.layout();
    ctx.fillStyle = '#07091a';
    ctx.fillRect(0, 0, ui.W, ui.H);
    const bg = this.image('assets/scenes/' + def.bg + '.webp');
    const { sx, sy, S } = L;
    if (!bg) {
      ui.text('LOADING...', sx + S / 2, sy + S / 2, 16 * u, 0.5, 0.6 + 0.4 * Math.sin(ui.t * 5));
    } else {
      ctx.save();
      ctx.beginPath();
      ctx.rect(sx, sy, S, S);
      ctx.clip();
      ctx.drawImage(bg, sx, sy, S, S);
      // tapped hotspots jiggle (the image region is redrawn slightly squashed)
      for (const h of def.hot) {
        const k = s.pokes[h.id];
        if (!k) continue;
        s.pokes[h.id] = Math.max(0, k - dt * 2.5);
        const [x0, y0, x1, y1] = h.r;
        const iw = bg.width, ih = bg.height;
        const wob = Math.sin(ui.t * 38) * 0.03 * k;
        const cx = sx + ((x0 + x1) / 2) * S, cy = sy + y1 * S;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1 + wob, 1 - wob);
        ctx.drawImage(bg, x0 * iw, y0 * ih, (x1 - x0) * iw, (y1 - y0) * ih, (x0 * S + sx) - cx, (y0 * S + sy) - cy, (x1 - x0) * S, (y1 - y0) * S);
        ctx.restore();
      }
      this.drawSceneFx(g, r, def, L, dt);
      // overlay items you can take
      for (const it of def.items || []) {
        if (it.if && !it.if(g)) continue;
        const im = ui.A.img[ITEMS[it.id] ? ITEMS[it.id].icon : 'it_' + it.id];
        if (!im) continue;
        const k = (it.s * S * 1.15) / Math.max(im.width, im.height), w = im.width * k, h = im.height * k;
        const bob = Math.sin(ui.t * 3 + it.x * 10) * 2 * u;
        const x = sx + it.x * S - w / 2, y = sy + it.y * S - h / 2 + bob;
        ctx.drawImage(im, x, y, w, h);
        const tw = 0.5 + 0.5 * Math.sin(ui.t * 4 + it.x * 20);
        this.glint(sx + it.x * S + w * 0.25, sy + it.y * S - h * 0.3, 10 * u * (0.6 + tw * 0.6), tw);
        ui.btn('item_' + it.id, x - 8 * u, y - 8 * u, w + 16 * u, h + 16 * u, () => g.sceneItem(it));
      }
      // characters
      for (const c of def.chars || []) {
        if (c.if && !c.if(g)) continue;
        const ch = CHARS[c.id];
        const im = ui.A.img[ch.sprite];
        if (!im) continue;
        const h = c.h * S, w = (h * im.width) / im.height;
        const talking = g.dialog && g.dialog.char === c.id;
        const breathe = 1 + Math.sin(ui.t * 2 + c.x * 7) * 0.012;
        const bob = talking ? Math.abs(Math.sin(ui.t * 9)) * 3 * u : 0;
        const poke = s.pokes['char_' + c.id] || 0;
        if (poke) s.pokes['char_' + c.id] = Math.max(0, poke - dt * 2);
        const fx = sx + c.x * S, fy = sy + c.y * S;
        // soft contact shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(fx, fy, w * 0.35, w * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.translate(fx, fy - bob);
        ctx.scale(1 - Math.sin(ui.t * 30) * 0.04 * poke, breathe + Math.sin(ui.t * 30) * 0.04 * poke);
        ctx.drawImage(im, -w / 2, -h, w, h);
        ctx.restore();
        if (c.bars) {
          const bars = this.image('assets/scenes/sheriff_bars.webp');
          if (bars) ctx.drawImage(bars, sx, sy + 0.08 * S, 0.33 * S, 0.64 * S);
        }
        ui.btn('char_' + c.id, fx - w / 2, fy - h, w, h, () => g.sceneChar(c));
      }
      // hotspot reveal (the eye button)
      if (this.reveal > 0) {
        this.reveal -= dt;
        ctx.globalAlpha = Math.min(1, this.reveal * 2) * (0.6 + 0.3 * Math.sin(ui.t * 8));
        ctx.strokeStyle = '#f2c23b';
        ctx.lineWidth = 2 * u;
        for (const h of def.hot) {
          if (h.hidden) continue;
          const [x0, y0, x1, y1] = h.r;
          ui.roundRect(sx + x0 * S, sy + y0 * S, (x1 - x0) * S, (y1 - y0) * S, 6 * u, null, '#f2c23b', 2 * u);
          const lbl = h.name;
          const ls = ui.fitSize(lbl, 9 * u, (x1 - x0) * S + 30 * u);
          ui.text(lbl, sx + ((x0 + x1) / 2) * S, sy + y0 * S + 3 * u, ls, 0.5);
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
    // hotspot buttons (registered before chars/items so those win)
    const hot = def.hot.slice().sort((a, b) => (b.r[2] - b.r[0]) * (b.r[3] - b.r[1]) - (a.r[2] - a.r[0]) * (a.r[3] - a.r[1]));
    const btns = ui.buttons;
    const start = btns.length;
    for (const h of hot) ui.btn('hot_' + h.id, sx + h.r[0] * S, sy + h.r[1] * S, (h.r[2] - h.r[0]) * S, (h.r[3] - h.r[1]) * S, () => g.sceneHot(h));
    // move hotspot buttons below the item/char buttons in priority
    const added = btns.splice(start);
    btns.splice(0, 0, ...added);
    // frame
    ui.roundRect(sx - 2, sy - 2, S + 4, S + 4, 4 * u, null, '#f3e6c8', 2 * u);
    // top bar: exit, title, look, journal
    const tb = ui.safe.t + 8 * u;
    const bs = 40 * u;
    const ex = ui.safe.l + 10 * u;
    const down = ui.btn('exit', ex, tb, bs, bs, () => g.exitScene(), true);
    ui.img('btn_exit', ex, tb, bs * (down ? 0.92 : 1));
    const title = def.name;
    ui.text(title, ex + bs + 10 * u, tb + 11 * u, ui.fitSize(title, 15 * u, ui.W - bs * 4 - 40 * u), 0);
    const lx = ui.W - ui.safe.r - 10 * u - bs;
    ui.btn('reveal', lx, tb, bs, bs, () => (this.reveal = 2.2), true);
    ui.img('btn_look', lx, tb, bs);
    ui.btn('journal_s', lx - bs - 8 * u, tb, bs, bs, () => (this.journal = 'tasks'), true);
    ui.img('btn_journal', lx - bs - 8 * u, tb, bs);
    // lower panel: dialogue or caption + inventory
    if (g.keypadOn) this.drawKeypad(g, L);
    if (g.dialog) this.drawDialog(g, L.px, L.py, L.pw, L.ph);
    else {
      const capH = Math.min(L.ph * 0.42, 110 * u);
      this.drawCaption(g, L.px, L.py, L.pw, capH, true);
      this.drawInvGrid(g, L.px, L.py + capH + 8 * u, L.pw, L.ph - capH - 8 * u, true);
    }
  }

  glint(x, y, r, a) {
    const ctx = this.ui.ctx;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#fff8d8';
    ctx.translate(x, y);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2;
      ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
      ctx.lineTo(Math.cos(ang + Math.PI / 4) * r * 0.25, Math.sin(ang + Math.PI / 4) * r * 0.25);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  glow(r, color, x, y, rad, a) {
    if (a <= 0.01) return;
    const ctx = this.ui.ctx;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(r.glows[GLOW[color] || 'warm'], x - rad, y - rad, rad * 2, rad * 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  drawSceneFx(g, r, def, L, dt) {
    const ui = this.ui, ctx = ui.ctx, u = ui.u, t = ui.t;
    const { sx, sy, S } = L;
    for (const f of def.fx || []) {
      switch (f.t) {
        case 'glow': {
          const fl = f.fl ? 0.75 + 0.25 * Math.sin(t * f.fl * 3 + f.x * 9) + (Math.random() < 0.03 * f.fl ? -0.3 : 0) : 1;
          this.glow(r, f.c, sx + f.x * S, sy + f.y * S, f.r * S, 0.45 * fl);
          break;
        }
        case 'static': {
          const [x0, y0, x1, y1] = f.r;
          ctx.globalAlpha = 0.35;
          for (let i = 0; i < 6; i++) {
            ctx.fillStyle = Math.random() < 0.5 ? '#b8ffb8' : '#205a20';
            const yy = sy + (y0 + Math.random() * (y1 - y0)) * S;
            ctx.fillRect(sx + x0 * S, yy, (x1 - x0) * S, 1.5 * u);
          }
          ctx.globalAlpha = 1;
          break;
        }
        case 'tv': {
          const [x0, y0, x1, y1] = f.r;
          ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 13);
          ctx.fillStyle = ['#88d8ff', '#ffd8a0', '#ffffff'][Math.floor(t * 3) % 3];
          ctx.fillRect(sx + x0 * S, sy + y0 * S, (x1 - x0) * S, (y1 - y0) * S);
          ctx.globalAlpha = 1;
          break;
        }
        case 'smoke': {
          if (Math.random() < dt * (f.rate || 2)) this.smoke.push({ x: f.x + rand(-0.01, 0.01), y: f.y, t: 0, life: rand(2, 3.5), s: rand(0.02, 0.035), scene: def.bg });
          break;
        }
        case 'motes': {
          while (this.motes.length < 26) this.motes.push({ x: Math.random(), y: Math.random(), vx: rand(-0.004, 0.004), vy: rand(-0.008, -0.002), a: rand(0.2, 0.6) });
          ctx.fillStyle = '#fff6dc';
          for (const m of this.motes) {
            m.x += m.vx * dt;
            m.y += m.vy * dt;
            if (m.y < 0) (m.y = 1), (m.x = Math.random());
            ctx.globalAlpha = m.a * (0.6 + 0.4 * Math.sin(t * 2 + m.x * 30));
            ctx.fillRect(sx + m.x * S, sy + m.y * S, 1.6 * u, 1.6 * u);
          }
          ctx.globalAlpha = 1;
          break;
        }
        case 'blobs': {
          for (let i = 0; i < 2; i++) {
            const y = sy + (f.y - 0.01 + Math.sin(t * 0.7 + i * 2) * 0.012) * S;
            this.glow(r, 'red', sx + (f.x + (i - 0.5) * 0.004) * S, y, 0.008 * S, 0.9);
          }
          break;
        }
        case 'lights':
          f.pts.forEach((p, i) => this.glow(r, ['red', 'yellow', 'green', 'blue', 'magenta'][i % 5], sx + p[0] * S, sy + p[1] * S, 0.018 * S, 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7)));
          break;
        case 'candles':
          f.pts.forEach((p, i) => this.glow(r, 'warm', sx + p[0] * S, sy + p[1] * S, 0.03 * S, 0.45 + 0.25 * Math.sin(t * 11 + i * 3.1) + (Math.random() - 0.5) * 0.2));
          break;
        case 'blink':
          f.pts.forEach((p, i) => {
            if (Math.sin(t * (2 + (i % 3)) + i * 2.3) > 0.2) this.glow(r, ['cyan', 'magenta', 'yellow', 'green', 'red'][i % 5], sx + p[0] * S, sy + p[1] * S, 0.014 * S, 0.9);
          });
          break;
        case 'saucer': {
          const im = ui.A.img.ufo;
          const w = 0.06 * S, h = (w * im.height) / im.width;
          ctx.globalAlpha = 0.85;
          ctx.drawImage(im, sx + (f.x + Math.sin(t * 0.4) * 0.03) * S - w / 2, sy + (f.y + Math.sin(t * 1.3) * 0.006) * S - h / 2, w, h);
          ctx.globalAlpha = 1;
          break;
        }
        case 'spin': {
          if (g.spin > 0) this.glow(r, 'cyan', sx + f.x * S, sy + f.y * S, 0.1 * S, g.spin * 0.25);
          break;
        }
        case 'sparkle': {
          if (g.f('trophyStolen')) break;
          const tw = Math.max(0, Math.sin(t * 2.3));
          this.glint(sx + f.x * S + 0.01 * S, sy + f.y * S - 0.02 * S, 9 * u * tw, tw);
          break;
        }
        case 'fan': {
          ctx.save();
          ctx.globalAlpha = 0.18;
          ctx.translate(sx + f.x * S, sy + f.y * S);
          ctx.scale(1, 0.32);
          ctx.rotate(t * 9);
          ctx.fillStyle = '#3a2416';
          for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2);
            ctx.fillRect(0, -0.012 * S, 0.1 * S, 0.024 * S);
          }
          ctx.restore();
          ctx.globalAlpha = 1;
          break;
        }
        case 'rays': {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 4; i++) {
            const a = 0.05 + 0.03 * Math.sin(t * 0.8 + i);
            const gr = ctx.createLinearGradient(sx + 0.95 * S, sy + 0.3 * S, sx + 0.5 * S, sy + 0.8 * S);
            gr.addColorStop(0, `rgba(255,220,150,${a})`);
            gr.addColorStop(1, 'rgba(255,220,150,0)');
            ctx.fillStyle = gr;
            ctx.beginPath();
            const yy = 0.24 + i * 0.07;
            ctx.moveTo(sx + 0.93 * S, sy + yy * S);
            ctx.lineTo(sx + 0.93 * S, sy + (yy + 0.03) * S);
            ctx.lineTo(sx + 0.45 * S, sy + (yy + 0.5) * S);
            ctx.lineTo(sx + 0.4 * S, sy + (yy + 0.42) * S);
            ctx.fill();
          }
          ctx.restore();
          break;
        }
        case 'drip': {
          const k = (t * 0.8) % 1;
          ctx.fillStyle = '#c45cff';
          ctx.globalAlpha = 1 - k;
          ctx.beginPath();
          ctx.arc(sx + f.x * S, sy + (f.y + k * 0.06) * S, 2.2 * u, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          break;
        }
        case 'eye': {
          // the screen is dark until the console has power
          if (!g.f('power')) {
            ctx.fillStyle = 'rgba(4,6,20,0.92)';
            ctx.beginPath();
            ctx.moveTo(sx + 0.155 * S, sy + 0.12 * S);
            ctx.quadraticCurveTo(sx + 0.38 * S, sy + 0.095 * S, sx + 0.6 * S, sy + 0.105 * S);
            ctx.lineTo(sx + 0.6 * S, sy + 0.32 * S);
            ctx.quadraticCurveTo(sx + 0.38 * S, sy + 0.335 * S, sx + 0.155 * S, sy + 0.355 * S);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 0.12;
            ctx.fillStyle = '#9fd8ff';
            ctx.fillRect(sx + 0.2 * S, sy + 0.14 * S, 0.06 * S, 0.17 * S);
            ctx.globalAlpha = 1;
          } else {
            this.glow(r, 'magenta', sx + f.x * S, sy + f.y * S, 0.12 * S, 0.3 + 0.2 * Math.sin(t * 2));
            // blink
            const bl = (t % 5) < 0.18;
            if (bl) {
              ctx.fillStyle = 'rgba(20,10,40,0.85)';
              ctx.beginPath();
              ctx.ellipse(sx + f.x * S, sy + f.y * S, 0.13 * S, 0.06 * S, 0, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          break;
        }
      }
    }
    // smoke puffs
    const sm = r.smokeSprite;
    for (const p of this.smoke) {
      if (p.scene !== def.bg) continue;
      p.t += dt;
      const k = p.t / p.life;
      ctx.globalAlpha = (1 - k) * 0.5;
      const rad = (p.s + k * 0.05) * S;
      ctx.drawImage(sm, sx + (p.x + k * 0.02) * S - rad, sy + (p.y - k * 0.12) * S - rad, rad * 2, rad * 2);
    }
    ctx.globalAlpha = 1;
    this.smoke = this.smoke.filter((p) => p.t < p.life && p.scene === def.bg);
  }

  // --- caption box: the last thing Dale saw or said --------------------------------------------------------
  drawCaption(g, x, y, w, h, inScene) {
    const ui = this.ui, u = ui.u;
    const c = g.caption;
    ui.roundRect(x, y, w, h, 10 * u, 'rgba(11,20,51,0.9)', '#f3e6c8', 1.5 * u);
    if (!c) {
      if (inScene) ui.text(g.held ? 'TAP SOMETHING TO USE THE ' + ITEMS[g.held].name + ' ON IT.' : 'TAP THINGS TO LOOK, TAKE AND TALK. SELECT AN ITEM, THEN TAP A TARGET.', x + 12 * u, y + 12 * u, ui.fitSize('TAP THINGS TO LOOK, TAKE AND TALK.', 10 * u, w - 24 * u), 0, 0.55);
      return;
    }
    const size = 11.5 * u;
    const lines = ui.font.wrap(c.text, size, w - 24 * u);
    let budget = Math.floor(c.t * 60);
    const maxL = Math.max(1, Math.floor((h - 16 * u) / (size * 1.3)));
    lines.slice(0, maxL).forEach((ln, i) => {
      if (budget <= 0) return;
      ui.text(ln.slice(0, budget), x + 12 * u, y + 10 * u + i * size * 1.3, size, 0, 1, budget < ln.length);
      budget -= ln.length + 1;
    });
    if (c.t * 60 < c.text.length && Math.random() < 0.3) g.sound.play('type');
  }

  // --- dialogue ----------------------------------------------------------------------------------------------
  portrait(charId, x, y, s) {
    const ui = this.ui, ctx = ui.ctx, u = ui.u;
    const ch = CHARS[charId] || CHARS.dale;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#1b2350';
    ctx.fill();
    ctx.clip();
    if (charId === 'executive') {
      const bg = this.image('assets/scenes/control.webp');
      if (bg) ctx.drawImage(bg, bg.width * 0.32, bg.height * 0.12, bg.width * 0.2, bg.height * 0.18, x - s * 0.1, y, s * 1.2, s);
    } else if (ch.sprite) {
      const im = ui.A.img[ch.sprite];
      if (im) {
        const [cx, cy, sz] = ch.head || [0.5, 0.15, 0.3];
        const side = sz * im.height;
        ctx.drawImage(im, cx * im.width - side / 2, cy * im.height - side / 2, side, side, x, y, s, s);
      }
    }
    ctx.restore();
    ctx.lineWidth = 3 * u;
    ctx.strokeStyle = ch.color || '#f3e6c8';
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  // h = the space available; the box only takes what the text and choices need.
  // bottom = anchor the box to the bottom of that space instead of the top.
  drawDialog(g, x, y, w, maxH, bottom = false) {
    const ui = this.ui, u = ui.u, ctx = ui.ctx;
    const d = g.dialog;
    const ps0 = Math.min(78 * u, maxH * 0.32);
    const lnAll = d.lines[d.i] || '';
    const need = ps0 + 30 * u + ui.font.wrap(lnAll, 11.5 * u, w - 28 * u).length * 11.5 * u * 1.32 + (d.choices ? d.choices.length * 38 * u + 8 * u : 30 * u);
    const h = clamp(need, Math.min(170 * u, maxH), maxH);
    if (bottom) y += maxH - h;
    ui.roundRect(x, y, w, h, 12 * u, 'rgba(9,14,40,0.95)', CHARS[d.who] ? CHARS[d.who].color : '#f3e6c8', 2.5 * u);
    const ps = ps0;
    this.portrait(d.who, x + 10 * u, y + 10 * u, ps);
    const ch = CHARS[d.who] || CHARS.dale;
    ui.text(ch.name, x + ps + 22 * u, y + 14 * u, 14 * u, 0);
    if (ch.title) ui.text(ch.title, x + ps + 22 * u, y + 34 * u, ui.fitSize(ch.title, 8.5 * u, w - ps - 40 * u), 0, 0.6);
    const ln = d.lines[d.i] || '';
    const size = 11.5 * u;
    const tx = x + 14 * u, ty = y + ps + 20 * u;
    const lines = ui.font.wrap(ln, size, w - 28 * u);
    let budget = Math.floor(d.t * 50);
    if (budget < ln.length && Math.random() < 0.35) g.sound.play('type');
    lines.forEach((l, i) => {
      if (budget <= 0) return;
      ui.text(l.slice(0, budget), tx, ty + i * size * 1.32, size, 0, 1, budget < l.length);
      budget -= l.length + 1;
    });
    const textBottom = ty + lines.length * size * 1.32 + 8 * u;
    if (d.choices) {
      // choice buttons
      const cs = 10.5 * u;
      let cy = Math.max(textBottom, y + h - d.choices.length * 36 * u - 8 * u);
      const avail = y + h - 8 * u - cy;
      const bh = Math.min(34 * u, avail / d.choices.length - 4 * u);
      d.choices.forEach((c, i) => {
        const by = cy + i * (bh + 4 * u);
        const down = ui.btn('choice' + i, x + 10 * u, by, w - 20 * u, bh, () => g.dlgChoose(i));
        ui.roundRect(x + 10 * u, by, w - 20 * u, bh, 8 * u, down ? '#c4231b' : 'rgba(196,35,27,0.25)', '#c4231b', 1.5 * u);
        const s2 = ui.fitSize(c.t, cs, w - 50 * u);
        ui.text('> ' + c.t, x + 20 * u, by + bh / 2 - s2 * 0.55, s2, 0);
      });
    } else {
      ui.btn('dlgnext', x, y, w, h, () => g.dlgTap());
      const more = d.i < d.lines.length - 1 || d.n.choices || d.n.next;
      if (d.t * 50 >= ln.length) ui.text(more ? 'TAP' : 'TAP TO CLOSE', x + w - 14 * u, y + h - 22 * u, 9 * u, 1, 0.5 + 0.5 * Math.sin(ui.t * 5));
    }
    void ctx;
  }

  // --- inventory ------------------------------------------------------------------------------------------
  drawInvGrid(g, x, y, w, h, inScene) {
    const ui = this.ui, u = ui.u, ctx = ui.ctx;
    ui.roundRect(x, y, w, h, 10 * u, 'rgba(11,20,51,0.82)', 'rgba(243,230,200,0.5)', 1.5 * u);
    ui.img('icon_coupon', x + 10 * u, y + 8 * u, 22 * u);
    ui.text(String(g.coupons), x + 36 * u, y + 12 * u, 13 * u, 0);
    ui.text('BAG', x + w - 12 * u, y + 12 * u, 11 * u, 1, 0.6);
    const items = g.inv;
    const cell = Math.min(62 * u, (w - 20 * u) / 5);
    const cols = Math.max(1, Math.floor((w - 20 * u) / cell));
    const rows = Math.max(1, Math.floor((h - 38 * u) / cell));
    const per = cols * rows;
    const pages = Math.max(1, Math.ceil(items.length / per));
    this.invPage = Math.min(this.invPage, pages - 1);
    const start = this.invPage * per;
    for (let k = 0; k < per && start + k < items.length; k++) {
      const id = items[start + k];
      const it = ITEMS[id];
      const cx = x + 10 * u + (k % cols) * cell, cy = y + 32 * u + Math.floor(k / cols) * cell;
      const sel = g.held === id;
      ui.roundRect(cx + 2 * u, cy + 2 * u, cell - 4 * u, cell - 4 * u, 8 * u, sel ? 'rgba(242,194,59,0.45)' : 'rgba(255,255,255,0.06)', sel ? '#f2c23b' : null, 2 * u);
      const im = ui.A.img[it.icon];
      if (im) {
        const k = (cell * 0.78) / Math.max(im.width, im.height);
        const iw = im.width * k, ih = im.height * k;
        const bob = sel ? Math.sin(ui.t * 6) * 2 * u : 0;
        ctx.drawImage(im, cx + (cell - iw) / 2, cy + (cell - ih) / 2 + bob, iw, ih);
      }
      ui.btn('inv_' + id, cx, cy, cell, cell, () => this.tapItem(g, id, inScene));
    }
    if (!items.length) ui.text('EMPTY. LIKE YOUR FRIDGE.', x + w / 2, y + h / 2 - 6 * u, 10 * u, 0.5, 0.5);
    if (pages > 1) {
      const bw = 34 * u;
      ui.btn('invnext', x + w - bw - 6 * u, y + h - bw - 4 * u, bw, bw, () => (this.invPage = (this.invPage + 1) % pages), true);
      ui.roundRect(x + w - bw - 6 * u, y + h - bw - 4 * u, bw, bw, 8 * u, '#c4231b', '#0d1a44', 2 * u);
      ui.text('>', x + w - bw / 2 - 6 * u, y + h - bw / 2 - 11 * u, 14 * u, 0.5);
      ui.text(this.invPage + 1 + '/' + pages, x + w - bw - 14 * u, y + h - bw / 2 - 10 * u, 10 * u, 1, 0.6);
    }
  }
  tapItem(g, id, inScene) {
    const it = ITEMS[id];
    if (g.held === id) {
      // second tap: look closer / use on yourself
      g.held = null;
      if (!inScene && (it.eat || ['tinfoil', 'cowbell', 'megaphone'].includes(id))) {
        this.bagOpen = false;
        return g.useSelf(id);
      }
      return g.line(it.desc);
    }
    g.held = id;
    g.sound.play('click');
    g.line(it.name + ': ' + it.desc + (inScene ? ' (TAP A TARGET TO USE IT)' : ''));
  }

  // the bag outside: a panel with the items and a USE button
  drawBag(g) {
    const ui = this.ui, u = ui.u, ctx = ui.ctx;
    ctx.fillStyle = 'rgba(6,10,30,0.6)';
    ctx.fillRect(0, 0, ui.W, ui.H);
    ui.btn('bagbg', 0, 0, ui.W, ui.H, () => (this.bagOpen = false));
    const w = Math.min(ui.W - 24 * u, 420 * u), h = Math.min(ui.H * 0.7, 440 * u);
    const x = (ui.W - w) / 2, y = (ui.H - h) / 2;
    ui.btn('bagpanel', x, y, w, h, () => {});
    ui.roundRect(x - 4 * u, y - 44 * u, w + 8 * u, h + 48 * u, 14 * u, '#0b1433', '#c4231b', 3 * u);
    ui.text('THE BAG', x + 10 * u, y - 34 * u, 18 * u, 0);
    const cs = 32 * u;
    ui.btn('bagclose', x + w - cs, y - 40 * u, cs, cs, () => (this.bagOpen = false), true);
    ui.img('btn_exit', x + w - cs, y - 40 * u, cs);
    const capH = 76 * u;
    this.drawCaptionText(g, x, y, w, capH);
    this.drawInvGrid(g, x, y + capH + 6 * u, w, h - capH - 60 * u, false);
    // use button
    if (g.held) {
      const it = ITEMS[g.held];
      const self = it.eat || ['tinfoil', 'cowbell', 'megaphone'].includes(g.held);
      const bw = (w - 30 * u) / 2;
      const label1 = self ? (it.eat ? 'EAT IT' : g.held === 'tinfoil' ? 'WEAR IT' : g.held === 'cowbell' ? 'RING IT' : 'SHOUT') : 'LOOK';
      ui.wideButton('baguse', label1, x + 10 * u + bw / 2, y + h - 26 * u, bw, () => {
        const id = g.held;
        if (self) {
          this.bagOpen = false;
          g.useSelf(id);
        } else g.line(ITEMS[id].desc);
      });
      ui.wideButton('bagon', 'USE ON...', x + 20 * u + bw * 1.5, y + h - 26 * u, bw, () => {
        this.bagOpen = false;
        g.line('TAP WHAT YOU WANT TO USE THE ' + ITEMS[g.held].name + ' ON.');
      });
    } else ui.text('TAP AN ITEM TO SELECT IT', x + w / 2, y + h - 34 * u, 11 * u, 0.5, 0.6);
  }
  drawCaptionText(g, x, y, w, h) {
    const ui = this.ui, u = ui.u;
    ui.roundRect(x, y, w, h, 10 * u, 'rgba(11,20,51,0.9)', '#f3e6c8', 1.5 * u);
    const txt = g.held ? ITEMS[g.held].name + ': ' + ITEMS[g.held].desc : g.caption ? g.caption.text : 'YOUR STUFF. SOME OF IT IS USEFUL. MOST OF IT IS EVIDENCE.';
    const size = 10.5 * u;
    ui.font.wrap(txt, size, w - 24 * u).slice(0, 4).forEach((ln, i) => ui.text(ln, x + 12 * u, y + 10 * u + i * size * 1.3, size, 0));
  }

  // --- keypad (Zorp's locker) -----------------------------------------------------------------------------
  drawKeypad(g, L) {
    const ui = this.ui, u = ui.u;
    const w = Math.min(L.S * 0.7, 260 * u), x = L.sx + (L.S - w) / 2, y = L.sy + L.S * 0.12;
    const kh = w * 1.3;
    ui.roundRect(x, y, w, kh, 14 * u, '#1a1530', '#c45cff', 3 * u);
    ui.roundRect(x + 14 * u, y + 14 * u, w - 28 * u, 44 * u, 8 * u, '#05110a', '#2bff8a', 1.5 * u);
    const code = (g.keypadCode || '') + '____'.slice((g.keypadCode || '').length);
    ui.text(code.split('').join(' '), x + w / 2, y + 26 * u, 20 * u, 0.5);
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'X'];
    const cw = (w - 28 * u) / 3, ch = (kh - 84 * u) / 4;
    keys.forEach((k, i) => {
      const kx = x + 14 * u + (i % 3) * cw, ky = y + 70 * u + Math.floor(i / 3) * ch;
      const down = ui.btn('key' + k, kx + 3 * u, ky + 3 * u, cw - 6 * u, ch - 6 * u, () => g.keypadPress(k), true);
      ui.roundRect(kx + 3 * u, ky + 3 * u, cw - 6 * u, ch - 6 * u, 8 * u, down ? '#c45cff' : '#3a2a60', '#c45cff', 1.5 * u);
      ui.text(k, kx + cw / 2, ky + ch / 2 - 10 * u, 18 * u, 0.5);
    });
  }

  // --- journal: tasks, gangs and the map --------------------------------------------------------------------
  drawJournal(g, r) {
    const ui = this.ui, u = ui.u, ctx = ui.ctx;
    ctx.fillStyle = 'rgba(6,10,30,0.75)';
    ctx.fillRect(0, 0, ui.W, ui.H);
    ui.btn('jbg', 0, 0, ui.W, ui.H, () => {});
    const w = Math.min(ui.W - 20 * u, 520 * u), h = Math.min(ui.H - ui.safe.t - ui.safe.b - 30 * u, 640 * u);
    const x = (ui.W - w) / 2, y = (ui.H - h) / 2 + 10 * u;
    ui.roundRect(x, y, w, h, 14 * u, '#0b1433', '#c4231b', 3 * u);
    const tabs = [['tasks', 'TASKS'], ['gangs', 'GANGS'], ['map', 'MAP']];
    const tw = (w - 60 * u) / 3;
    tabs.forEach(([id, label], i) => {
      const tx = x + 10 * u + i * tw, ty = y - 30 * u;
      const on = this.journal === id;
      ui.btn('tab' + id, tx, ty, tw - 6 * u, 36 * u, () => (this.journal = id), true);
      ui.roundRect(tx, ty, tw - 6 * u, 36 * u, 10 * u, on ? '#c4231b' : '#1b2350', '#f3e6c8', 1.5 * u);
      ui.text(label, tx + (tw - 6 * u) / 2, ty + 10 * u, 13 * u, 0.5, on ? 1 : 0.7);
    });
    const cs = 36 * u;
    ui.btn('jclose', x + w - cs - 4 * u, y - 34 * u, cs, cs, () => (this.journal = null), true);
    ui.img('btn_exit', x + w - cs - 4 * u, y - 34 * u, cs);
    if (this.journal === 'tasks') this.drawTasks(g, x, y, w, h);
    else if (this.journal === 'gangs') this.drawGangs(g, x, y, w, h);
    else this.drawMap(g, x, y, w, h, r);
  }

  drawTasks(g, x, y, w, h) {
    const ui = this.ui, u = ui.u;
    let cy = y + 14 * u;
    const pad = 14 * u, tw = w - pad * 2;
    const para = (text, size, alpha = 1, color) => {
      const lines = ui.font.wrap(text, size, tw);
      lines.forEach((ln, i) => ui.text(ln, x + pad, cy + i * size * 1.3, size, 0, alpha));
      cy += lines.length * size * 1.3 + 6 * u;
      void color;
    };
    if (g.mode !== 'story') {
      para('ENDLESS MODE. NO STORY. JUST SURVIVE. THE RADIO HAS MISSIONS.', 12 * u);
      return;
    }
    ui.text('THE FINALE', x + pad, cy, 16 * u, 0);
    cy += 24 * u;
    const o = g.objective();
    para('> ' + o.text, 11.5 * u);
    // the three things Kevin asked for
    const checks = [
      [g.f('gateOpen'), 'A WAY ONTO THE STUDIO LOT'],
      [g.has('keycard'), 'THE TOWER KEYCARD'],
      [g.inv.some((k) => ITEMS[k].tape), 'A TAPE WORTH BROADCASTING (' + g.inv.filter((k) => ITEMS[k].tape).length + ' TAPES)'],
    ];
    if (g.f('metKevin'))
      for (const [ok, label] of checks) {
        ui.roundRect(x + pad, cy, 14 * u, 14 * u, 3 * u, ok ? '#5dff8a' : null, '#f3e6c8', 1.5 * u);
        ui.text(label, x + pad + 22 * u, cy + 1 * u, ui.fitSize(label, 10.5 * u, tw - 30 * u), 0, ok ? 0.6 : 1);
        cy += 20 * u;
      }
    cy += 8 * u;
    ui.text('ERRANDS', x + pad, cy, 14 * u, 0);
    cy += 22 * u;
    let any = false;
    for (const id in QUESTS) {
      const st = g.q(id);
      if (!st) continue;
      any = true;
      const Q = QUESTS[id];
      const em = Q.fac ? FACTIONS[Q.fac].emblem : 'btn_journal';
      ui.img(em, x + pad, cy - 2 * u, 18 * u, 18 * u, st === 2 ? 0.4 : 1);
      ui.text(Q.title + (st === 2 ? ' - DONE' : ''), x + pad + 24 * u, cy, 11.5 * u, 0, st === 2 ? 0.45 : 1);
      cy += 17 * u;
      if (st === 1) {
        const lines = ui.font.wrap(Q.text(g), 9.5 * u, tw - 24 * u);
        lines.forEach((ln, i) => ui.text(ln, x + pad + 24 * u, cy + i * 9.5 * u * 1.3, 9.5 * u, 0, 0.75));
        cy += lines.length * 9.5 * u * 1.3 + 6 * u;
      }
      if (cy > y + h - 70 * u) break;
    }
    if (!any) para('NOTHING YET. TALK TO PEOPLE. THEY ALL WANT SOMETHING.', 10 * u, 0.6);
    // call Kevin
    ui.wideButton('callkevin', 'CALL KEVIN (HINT)', x + w / 2, y + h - 30 * u, Math.min(w * 0.7, 280 * u), () => {
      this.journal = null;
      g.callKevin();
    });
  }

  drawGangs(g, x, y, w, h) {
    const ui = this.ui, u = ui.u;
    const rowH = (h - 20 * u) / 4;
    FACTION_IDS.forEach((id, i) => {
      const F = FACTIONS[id];
      const ry = y + 10 * u + i * rowH;
      const es = Math.min(56 * u, rowH * 0.6);
      ui.img(F.emblem, x + 12 * u, ry + 4 * u, es);
      const tx = x + 20 * u + es;
      const tw = w - es - 36 * u;
      ui.text(F.name, tx, ry + 4 * u, 14 * u, 0);
      const v = g.repOf(id);
      const lab = repLabel(v);
      ui.text(lab, x + w - 14 * u, ry + 6 * u, 11 * u, 1, 0.9);
      // reputation bar, centre = neutral
      const bx = tx, by = ry + 24 * u, bw = tw, bh = 9 * u;
      ui.roundRect(bx, by, bw, bh, bh / 2, '#1b2350', '#f3e6c8', 1 * u);
      const mid = bx + bw / 2;
      const k = v / 100;
      this.ui.ctx.fillStyle = v >= 0 ? '#5dff8a' : '#ff5b4a';
      this.ui.ctx.fillRect(Math.min(mid, mid + (k * bw) / 2), by + 1.5 * u, Math.abs((k * bw) / 2), bh - 3 * u);
      this.ui.ctx.fillStyle = '#f3e6c8';
      this.ui.ctx.fillRect(mid - 1, by - 2 * u, 2, bh + 4 * u);
      const lines = ui.font.wrap(F.about + ' ' + F.where + '.', 9 * u, tw);
      lines.slice(0, Math.max(1, Math.floor((rowH - 44 * u) / (9 * u * 1.3)))).forEach((ln, j) => ui.text(ln, tx, by + 15 * u + j * 9 * u * 1.3, 9 * u, 0, 0.7));
    });
  }

  // iso-rotated mini map so it matches the game view
  buildMap(world) {
    const c = document.createElement('canvas');
    const s = 4; // px per tile edge
    const Wd = Math.ceil(N * s * 2 * C) + 4, Hd = Math.ceil(N * s * C) + 4;
    c.width = Wd;
    c.height = Hd;
    const x = c.getContext('2d');
    x.setTransform(s * C, s * C * 0.5, -s * C, s * C * 0.5, Wd / 2, 2);
    const col = ['#d9b27a', '#b98a55', '#7fae5a', '#c9c3b6', '#4a4a52'];
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        x.fillStyle = col[world.tiles[j * N + i]];
        x.fillRect(i - 0.02, j - 0.02, 1.04, 1.04);
      }
    for (const p of world.props) {
      if (!p.box || p.def.invisible) continue;
      x.fillStyle = p.scene ? '#c4231b' : '#6a5a4a';
      x.fillRect(p.box.x0 / TILE, p.box.y0 / TILE, (p.box.x1 - p.box.x0) / TILE, (p.box.y1 - p.box.y0) / TILE);
    }
    for (const q of world.pools) {
      x.fillStyle = '#3fb7e0';
      x.fillRect(q.x0 / TILE, q.y0 / TILE, (q.x1 - q.x0) / TILE, (q.y1 - q.y0) / TILE);
    }
    x.strokeStyle = '#5ae6ff';
    x.lineWidth = 0.4;
    for (const f of world.fences) {
      x.beginPath();
      x.moveTo(f.x0 / TILE, f.y0 / TILE);
      x.lineTo(f.x1 / TILE, f.y1 / TILE);
      x.stroke();
    }
    return { c, s, Wd, Hd };
  }

  drawMap(g, x, y, w, h, r) {
    const ui = this.ui, u = ui.u, ctx = ui.ctx;
    if (this.mapWorld !== g.world) {
      this.mapCanvas = this.buildMap(g.world);
      this.mapWorld = g.world;
    }
    const M = this.mapCanvas;
    // zoomed in around Dale, clipped to the panel (the whole map is a wide diamond)
    const vw = w - 20 * u, vh = h - 70 * u;
    const sc = Math.min((vw / M.Wd) * 1.8, vh / M.Hd);
    const mw = M.Wd * sc, mh = M.Hd * sc;
    const pi = g.player.x / TILE, pj = g.player.y / TILE;
    const pcx = ((pi - pj) * M.s * C + M.Wd / 2) * sc, pcy = ((pi + pj) * M.s * C * 0.5 + 2) * sc;
    const mx = x + 10 * u + clamp(vw / 2 - pcx, vw - mw, 0), my = y + 14 * u + clamp(vh / 2 - pcy, vh - mh, 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 10 * u, y + 14 * u, vw, vh);
    ctx.clip();
    ctx.drawImage(M.c, mx, my, mw, mh);
    const proj = (wx, wy) => {
      const i = wx / TILE, j = wy / TILE;
      return [mx + ((i - j) * M.s * C + M.Wd / 2) * sc, my + ((i + j) * M.s * C * 0.5 + 2) * sc];
    };
    // landmarks: tap to set a waypoint
    for (const l of g.world.landmarks) {
      const [lx, ly] = proj(l.x, l.y);
      if (lx < x + 10 * u || lx > x + 10 * u + vw || ly < y + 14 * u || ly > y + 14 * u + vh) continue;
      const s = 24 * u;
      const sel = g.waypoint === l;
      ui.btn('lm_' + l.id, lx - s / 2 - 4 * u, ly - s / 2 - 4 * u, s + 8 * u, s + 8 * u, () => {
        g.waypoint = sel ? null : l;
        g.line(sel ? 'WAYPOINT CLEARED.' : 'WAYPOINT SET: ' + l.name + '. FOLLOW THE GREEN ARROW.');
      }, true);
      ui.img(l.icon, lx - s / 2, ly - s / 2, s);
      if (sel) ui.roundRect(lx - s / 2 - 3 * u, ly - s / 2 - 3 * u, s + 6 * u, s + 6 * u, 6 * u, null, '#5dff8a', 2.5 * u);
    }
    // objective + Dale
    const o = g.objective();
    const tgt = o && o.target && g.landmarkPos(o.target);
    if (tgt) {
      const [tx, ty] = proj(tgt.x, tgt.y);
      ctx.strokeStyle = '#f2c23b';
      ctx.lineWidth = 3 * u;
      ctx.beginPath();
      ctx.arc(tx, ty, (16 + 4 * Math.sin(ui.t * 5)) * u, 0, Math.PI * 2);
      ctx.stroke();
    }
    const [px, py] = proj(g.player.x, g.player.y);
    ctx.fillStyle = '#c4231b';
    ctx.strokeStyle = '#f3e6c8';
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.arc(px, py, 6 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ui.text('YOU', px, py - 22 * u, 10 * u, 0.5);
    ctx.restore();
    const tip = 'TAP A PLACE TO SET A WAYPOINT. YELLOW RING: YOUR OBJECTIVE.';
    ui.text(tip, x + w / 2, y + h - 34 * u, ui.fitSize(tip, 9.5 * u, w - 20 * u), 0.5, 0.7);
    void r;
  }

  // --- world HUD extras ---------------------------------------------------------------------------------------
  drawToasts(g, y0) {
    const ui = this.ui, u = ui.u;
    let y = y0;
    for (const t of g.toasts) {
      const a = t.t < 0.2 ? t.t / 0.2 : t.t > 2.6 ? (3.2 - t.t) / 0.6 : 1;
      const size = 11 * u;
      const tw = ui.font.measure(t.text, size) + 46 * u;
      const x = ui.W / 2 - tw / 2 + (1 - Math.min(1, t.t * 5)) * 30 * u;
      ui.ctx.globalAlpha = a;
      ui.roundRect(x, y, tw, 28 * u, 14 * u, 'rgba(11,20,51,0.92)', t.color, 2 * u);
      ui.img(t.icon, x + 6 * u, y + 3 * u, 22 * u, 22 * u, a);
      ui.text(t.text, x + 34 * u, y + 8 * u, size, 0, a);
      ui.ctx.globalAlpha = 1;
      y += 32 * u;
    }
  }

  // a caption box above the controls for things Dale says outside
  drawWorldCaption(g) {
    const ui = this.ui, u = ui.u;
    const c = g.caption;
    if (!c || g.scene) return;
    const w = Math.min(ui.W - 24 * u, 460 * u);
    const size = 11.5 * u;
    const lines = ui.font.wrap(c.text, size, w - 24 * u);
    const h = lines.length * size * 1.3 + 18 * u;
    const x = (ui.W - w) / 2, y = ui.H - ui.safe.b - 150 * u - h;
    const a = c.t < 0.15 ? c.t / 0.15 : c.t > c.dur - 0.4 ? Math.max(0, (c.dur - c.t) / 0.4) : 1;
    ui.ctx.globalAlpha = a;
    ui.roundRect(x, y, w, h, 12 * u, 'rgba(11,20,51,0.9)', '#f3e6c8', 1.5 * u);
    let budget = Math.floor(c.t * 70);
    lines.forEach((ln, i) => {
      if (budget <= 0) return;
      ui.text(ln.slice(0, budget), x + 12 * u, y + 9 * u + i * size * 1.3, size, 0, a, budget < ln.length);
      budget -= ln.length + 1;
    });
    ui.ctx.globalAlpha = 1;
  }

  // --- the ending -------------------------------------------------------------------------------------------
  drawEnding(g, dt) {
    const ui = this.ui, u = ui.u, ctx = ui.ctx, W = ui.W, H = ui.H;
    const E = ENDINGS[g.endingId];
    const t = g.endingT || 0;
    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, W, H);
    const art = this.image('assets/scenes/' + E.art + '.webp');
    const lines = E.lines.concat(epilogue(g));
    if (this.endStep === undefined) this.endStep = 0;
    if (art) {
      const s = Math.max(W, H) * 1.05;
      const k = Math.min(1, t / 2);
      ctx.globalAlpha = k;
      ctx.drawImage(art, (W - s) / 2 + Math.sin(t * 0.1) * 12, (H - s) / 2 + Math.cos(t * 0.08) * 10, s, s);
      ctx.globalAlpha = 1;
    }
    const gr = ctx.createLinearGradient(0, H * 0.35, 0, H);
    gr.addColorStop(0, 'rgba(5,7,15,0)');
    gr.addColorStop(1, 'rgba(5,7,15,0.92)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
    const top = ui.safe.t + 30 * u;
    ui.text('THE END', W / 2, top, 14 * u, 0.5, 0.8);
    const ts = ui.fitSize(E.title, 30 * u, W * 0.9);
    ui.text(E.title, W / 2, top + 22 * u, ts, 0.5);
    // the text, one paragraph at a time
    const step = Math.min(this.endStep, lines.length);
    const size = 12.5 * u;
    let y = H * 0.48;
    const show = lines.slice(Math.max(0, step - 3), step + 1);
    show.forEach((ln, i) => {
      const cur = i === show.length - 1 && step < lines.length;
      const wl = ui.font.wrap(ln, size, W * 0.86);
      wl.forEach((l, j) => ui.text(l, W / 2, y + j * size * 1.35, size, 0.5, cur ? 1 : 0.55));
      y += wl.length * size * 1.35 + 10 * u;
    });
    if (step >= lines.length) {
      const stats = 'TIME: ' + fmtTime(g.time) + '   SAVED: ' + g.rescued + '   DAMAGE: ' + fmtNum(g.damage) + '   RECASTS: ' + (g.recasts || 0);
      ui.text(stats, W / 2, H - ui.safe.b - 140 * u, ui.fitSize(stats, 10 * u, W * 0.92), 0.5, 0.8);
      const found = g.endingsFound().length;
      const ft = 'ENDINGS FOUND: ' + found + '/' + ENDING_IDS.length + (found < ENDING_IDS.length ? '. EVERY GANG HAS ITS OWN TAPE.' : '. ALL OF THEM. KEVIN IS PROUD. KEVIN IS NEVER PROUD.');
      ui.text(ft, W / 2, H - ui.safe.b - 118 * u, ui.fitSize(ft, 10 * u, W * 0.92), 0.5, 0.8);
      ui.wideButton('endmenu', 'BACK TO THE MENU', W / 2, H - ui.safe.b - 60 * u, Math.min(W * 0.7, 300 * u), () => {
        this.endStep = 0;
        ui.cb.menu();
      });
    } else {
      ui.text('TAP TO CONTINUE', W / 2, H - ui.safe.b - 40 * u, 10 * u, 0.5, 0.5 + 0.5 * Math.sin(ui.t * 4));
      ui.btn('endnext', 0, 0, W, H, () => (this.endStep = (this.endStep || 0) + 1));
    }
    void dt;
  }
}
