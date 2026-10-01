// HUD, menus, intro cutscene and touch / keyboard input. All text uses the generated bitmap font.
import { clamp, fmtTime } from './util.js';
import { THREAT, MISSIONS, rank } from './lines.js';
import { ACTION_LABEL, ACTION_ICON } from './interact.js';

export const STORY = [
  { video: 'couch', lines: ['1957. EARTH STARTS BROADCASTING TELEVISION INTO SPACE.', 'SEVENTY YEARS LATER, SOMEBODY OUT THERE FINALLY BINGED ALL OF IT.'] },
  { video: 'space', lines: ['THE REVIEWS ARE IN: ONE STAR.', 'TOO MANY COOKING SHOWS. THE COWS WERE THE ONLY GOOD CHARACTERS.', 'EARTH HAS BEEN CANCELLED.'] },
  { video: 'town', lines: ['PINE BLUFF, NEVADA. POPULATION 1,204.', 'FOR NOW.'] },
  { video: 'cow', lines: ['THE COWS GOT A SPIN-OFF.', 'EVERYBODY ELSE GETS PROBED.'] },
  { video: 'dale', lines: ['MEET DALE. DIVORCED. OWNS A SHOTGUN. HAD NO PLANS FOR TUESDAY.', 'SURVIVE AS LONG AS YOU CAN. NOBODY IS COMING. NOBODY WAS EVER COMING.'] },
];

export class Input {
  constructor(canvas, ui) {
    this.ui = ui;
    this.mx = 0;
    this.my = 0;
    this.aim = false;
    this.ax = 0;
    this.ay = 0;
    this.grenade = false;
    this.action = false;
    this.joy = null;
    this.aimP = null;
    this.keys = new Set();
    const opts = { passive: false };
    canvas.addEventListener('pointerdown', (e) => this.down(e), opts);
    window.addEventListener('pointermove', (e) => this.move(e), opts);
    window.addEventListener('pointerup', (e) => this.up(e), opts);
    window.addEventListener('pointercancel', (e) => this.up(e), opts);
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space' || e.code === 'KeyG') this.grenade = true;
      if (e.code === 'KeyE' || e.code === 'KeyF') this.action = true;
      if (e.code === 'Escape' || e.code === 'KeyP') this.ui.onPauseKey();
      if (e.code === 'Enter') this.ui.onEnter();
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.joy = null;
      this.aimP = null;
      this.ui.onBlur();
    });
    document.addEventListener('visibilitychange', () => document.hidden && this.ui.onBlur());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(e) {
    e.preventDefault();
    this.ui.onGesture();
    const x = e.clientX, y = e.clientY;
    if (this.ui.press(x, y, e.pointerId)) return;
    if (this.ui.state !== 'play') return;
    if (x < this.ui.W * 0.55 && !this.joy) this.joy = { id: e.pointerId, ox: x, oy: y, x, y };
    else if (!this.aimP) this.aimP = { id: e.pointerId, ox: x, oy: y, x, y };
  }
  move(e) {
    if (this.joy && e.pointerId === this.joy.id) {
      this.joy.x = e.clientX;
      this.joy.y = e.clientY;
      // drag the base along when the thumb wanders too far
      const R = this.ui.joyR();
      const dx = this.joy.x - this.joy.ox, dy = this.joy.y - this.joy.oy, d = Math.hypot(dx, dy);
      if (d > R * 1.4) {
        this.joy.ox = this.joy.x - (dx / d) * R * 1.4;
        this.joy.oy = this.joy.y - (dy / d) * R * 1.4;
      }
    }
    if (this.aimP && e.pointerId === this.aimP.id) {
      this.aimP.x = e.clientX;
      this.aimP.y = e.clientY;
    }
    this.ui.hover(e.clientX, e.clientY, e.pointerId);
  }
  up(e) {
    if (this.joy && e.pointerId === this.joy.id) this.joy = null;
    if (this.aimP && e.pointerId === this.aimP.id) this.aimP = null;
    this.ui.release(e.clientX, e.clientY, e.pointerId);
  }

  poll() {
    let mx = 0, my = 0;
    if (this.joy) {
      const R = this.ui.joyR();
      mx = (this.joy.x - this.joy.ox) / R;
      my = (this.joy.y - this.joy.oy) / R;
      const l = Math.hypot(mx, my);
      if (l > 1) (mx /= l), (my /= l);
      if (l < 0.12) (mx = 0), (my = 0);
    }
    const k = this.keys;
    const kx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const ky = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    if (kx || ky) {
      const l = Math.hypot(kx, ky);
      mx = kx / l;
      my = ky / l;
    }
    this.mx = mx;
    this.my = my;
    this.aim = false;
    if (this.aimP) {
      const dx = this.aimP.x - this.aimP.ox, dy = this.aimP.y - this.aimP.oy;
      if (Math.hypot(dx, dy) > 14) {
        this.aim = true;
        this.ax = dx;
        this.ay = dy;
      }
    }
    const out = { mx: this.mx, my: this.my, aim: this.aim, ax: this.ax, ay: this.ay, grenade: this.grenade, action: this.action };
    this.grenade = false;
    this.action = false;
    return out;
  }
}

export class UI {
  constructor(ctx, A, font, cb) {
    this.ctx = ctx;
    this.A = A;
    this.font = font;
    this.cb = cb;
    this.state = 'title';
    this.buttons = [];
    this.pressed = null;
    this.t = 0;
    this.safe = { t: 0, r: 0, b: 0, l: 0 };
    this.intro = null;
    this.video = document.createElement('video');
    this.video.setAttribute('playsinline', '');
    this.video.setAttribute('webkit-playsinline', '');
    this.video.preload = 'auto';
    this.video.muted = false;
    this.video.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
    document.body.appendChild(this.video);
  }

  resize(W, H, dpr) {
    this.W = W;
    this.H = H;
    this.dpr = dpr;
    this.u = clamp(Math.min(W, H) / 400, 0.8, 1.45);
    const s = getComputedStyle(document.getElementById('safe'));
    this.safe = { t: parseFloat(s.paddingTop) || 0, r: parseFloat(s.paddingRight) || 0, b: parseFloat(s.paddingBottom) || 0, l: parseFloat(s.paddingLeft) || 0 };
  }

  joyR() {
    return 58 * this.u;
  }

  // --- input routing -----------------------------------------------------------------------
  onGesture() {
    this.cb.gesture();
  }
  press(x, y, id) {
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const b = this.buttons[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        this.pressed = { b, id };
        if (b.instant) {
          b.fn();
          this.pressed = null;
        }
        return true;
      }
    }
    if (this.state === 'intro') {
      this.advanceIntro();
      return true;
    }
    if (this.state === 'title' || this.state === 'over') return true;
    return false;
  }
  hover() {}
  release(x, y, id) {
    const p = this.pressed;
    if (!p || p.id !== id) return;
    this.pressed = null;
    const b = p.b;
    if (x >= b.x - 10 && x <= b.x + b.w + 10 && y >= b.y - 10 && y <= b.y + b.h + 10) {
      this.cb.click();
      b.fn();
    }
  }
  onPauseKey() {
    if (this.state === 'play') this.cb.pause();
    else if (this.state === 'pause') this.cb.resume();
  }
  onEnter() {
    if (this.state === 'title') this.cb.play();
    else if (this.state === 'over' && this.cb.game().overT > 1.5) this.cb.restart();
    else if (this.state === 'intro') this.endIntro();
  }
  onBlur() {
    if (this.state === 'play') this.cb.pause();
    if (this.state === 'intro') this.video.pause();
  }

  btn(id, x, y, w, h, fn, instant = false) {
    this.buttons.push({ id, x, y, w, h, fn, instant });
    return this.pressed && this.pressed.b.id === id;
  }

  // --- drawing helpers ----------------------------------------------------------------------
  img(key, x, y, w, h, alpha = 1) {
    const ctx = this.ctx;
    const im = this.A.img[key];
    if (!im) return;
    if (h === undefined) h = (w * im.height) / im.width;
    ctx.globalAlpha = alpha;
    ctx.drawImage(im, x, y, w, h);
    ctx.globalAlpha = 1;
    return h;
  }
  text(s, x, y, size, align = 0, alpha = 1) {
    this.ctx.globalAlpha = alpha;
    this.font.draw(this.ctx, s, x, y, size, align);
    this.ctx.globalAlpha = 1;
  }
  fitSize(s, size, maxW) {
    const w = this.font.measure(String(s).toUpperCase(), size);
    return w > maxW ? (size * maxW) / w : size;
  }
  wideButton(id, label, cx, cy, w, fn) {
    const im = this.A.img.btn_wide;
    const h = (w * im.height) / im.width;
    const down = this.btn(id, cx - w / 2, cy - h / 2, w, h, fn);
    const s = down ? 0.94 : 1;
    const ww = w * s, hh = h * s;
    this.ctx.drawImage(im, cx - ww / 2, cy - hh / 2, ww, hh);
    const size = this.fitSize(label, hh * 0.36, ww * 0.72);
    this.text(label, cx, cy - size * 0.58, size, 0.5);
    return h;
  }
  roundRect(x, y, w, h, r, fill, stroke, lw = 2) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) (ctx.fillStyle = fill), ctx.fill();
    if (stroke) (ctx.strokeStyle = stroke), (ctx.lineWidth = lw), ctx.stroke();
  }
  bar(x, y, w, h, k, color, color2) {
    const u = this.u;
    this.roundRect(x - 2 * u, y - 2 * u, w + 4 * u, h + 4 * u, (h + 4 * u) / 2, '#0d1a44', '#f3e6c8', 1.5 * u);
    if (k > 0) {
      const g = this.ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, color2);
      g.addColorStop(1, color);
      this.roundRect(x, y, Math.max(h, w * clamp(k, 0, 1)), h, h / 2, g);
      this.ctx.fillStyle = 'rgba(255,255,255,0.25)';
      this.ctx.fillRect(x + h / 2, y + h * 0.18, Math.max(0, w * clamp(k, 0, 1) - h), h * 0.18);
    }
  }

  // --- frame ------------------------------------------------------------------------------------
  draw(dt, g, renderer) {
    this.t += dt;
    this.buttons.length = 0;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (this.state === 'title') return this.drawTitle(dt);
    if (this.state === 'intro') return this.drawIntro(dt);
    this.drawFloaters(g, renderer);
    if (this.state === 'play' || this.state === 'pause') this.drawHud(g, renderer);
    if (this.state === 'pause') this.drawPause(g);
    if (this.state === 'over') this.drawOver(g);
  }

  drawFloaters(g, r) {
    const u = this.u;
    for (const f of g.floaters) {
      const k = f.t / f.life;
      const [sx, sy] = r.project(f.x, f.y, f.z + k * 50);
      const size = f.size * u * (k < 0.15 ? 0.6 + k * 2.7 : 1);
      const lines = this.font.wrap(f.text, size, this.W * 0.7);
      lines.forEach((ln, i) => this.text(ln, clamp(sx, this.W * 0.2, this.W * 0.8), sy - size * 2.2 + i * size * 1.25, size, 0.5, k > 0.7 ? (1 - k) / 0.3 : 1));
    }
  }

  drawHud(g, r) {
    const ctx = this.ctx, u = this.u, p = g.player;
    const pad = 12 * u;
    const top = this.safe.t + pad, left = this.safe.l + pad, right = this.W - this.safe.r - pad;
    // row 1: health (left), kills + pause (right)
    const beat = p.hp < 30 ? 1 + Math.max(0, Math.sin(this.t * 9)) * 0.18 : 1;
    const hs = 34 * u * beat;
    this.img('icon_heart', left + 17 * u - hs / 2, top + 16 * u - hs / 2, hs);
    const ps = 40 * u;
    const ks = String(g.kills);
    const kw = this.font.measure(ks, 18 * u);
    const killsX = right - ps - 12 * u - kw - 24 * u;
    const barW = Math.min(130 * u, killsX - left - 52 * u);
    this.bar(left + 40 * u, top + 9 * u, barW, 14 * u, p.hp / p.maxHp, '#b3121b', '#ff5b4a');
    const pdown = this.btn('pause', right - ps, top, ps, ps, () => this.cb.pause(), true);
    this.img('btn_pause', right - ps * (pdown ? 0.95 : 1), top, ps * (pdown ? 0.9 : 1));
    this.text(ks, right - ps - 8 * u - kw, top + 10 * u, 18 * u);
    this.img('icon_skull', killsX, top + 4 * u, 21 * u);
    // row 2: ammo (left), clock + threat (centre)
    const ay = top + 42 * u;
    if (p.car) {
      this.img('btn_drive', left + 2 * u, ay, 28 * u);
      this.text('CRUISER', left + 38 * u, ay + 1 * u, 13 * u);
      this.bar(left + 38 * u, ay + 19 * u, 70 * u, 7 * u, p.car.hp / p.car.maxHp, '#1b5fc7', '#7fb4ff');
    } else this.img('icon_ammo', left + 2 * u, ay, 28 * u);
    if (p.car) {
      // the cruiser row replaces the ammo readout
    } else if (p.plasmaT > 0 || p.smgT > 0) {
      const pl = p.plasmaT > 0;
      this.text(pl ? 'PLASMA' : 'SMG', left + 38 * u, ay + 1 * u, 13 * u);
      this.bar(left + 38 * u, ay + 19 * u, 60 * u, 7 * u, pl ? p.plasmaT / 12 : p.smgT / 18, pl ? '#a0169c' : '#c7841b', pl ? '#ff6af0' : '#ffd36a');
    } else if (p.shells > 0) this.text(String(p.shells), left + 38 * u, ay + 5 * u, 19 * u);
    else this.text('REVOLVER', left + 38 * u, ay + 8 * u, 12 * u, 0, 0.6 + 0.4 * Math.sin(this.t * 6));
    const cx = this.W / 2;
    const ts = 22 * u;
    const tstr = fmtTime(g.time);
    const tw = this.font.measure(tstr, ts);
    this.img('icon_clock', cx - tw / 2 - 14 * u, ay + 1 * u, 20 * u);
    this.text(tstr, cx - tw / 2 + 12 * u, ay + 3 * u, ts);
    const th = THREAT[g.level].name;
    const thSize = this.fitSize(th, 10 * u, this.W * 0.4);
    this.text(th, cx + 6 * u, ay + 30 * u, thSize, 0.5, 0.85);
    // ticker
    const tickY = top + 88 * u;
    this.drawTicker(g, tickY);
    // mothership health
    let by = tickY + (g.tickerCur ? 52 * u : 0);
    if (g.mother && g.mother.state !== 'leave') {
      this.text('THE NETWORK EXECUTIVE', cx, by, 11 * u, 0.5);
      this.bar(cx - 100 * u, by + 15 * u, 200 * u, 9 * u, g.mother.hp / g.mother.maxHp, '#6d0f8c', '#e45cff');
      by += 34 * u;
    }
    // current dispatcher mission
    if (g.mission) {
      const m = g.mission;
      const label = 'MISSION: ' + MISSIONS[m.type].text + (m.need > 1 ? '  ' + m.count + '/' + m.need : '');
      const left2 = Math.max(0, m.limit - m.t);
      const tstr2 = fmtTime(left2);
      const size = this.fitSize(label, 11 * u, this.W - 110 * u);
      const w2 = this.font.measure(label, size) + this.font.measure(tstr2, 11 * u) + 34 * u;
      const x2 = cx - w2 / 2;
      this.roundRect(x2, by, w2, 24 * u, 12 * u, 'rgba(11,20,51,0.85)', '#f2c23b', 2 * u);
      this.text(label, x2 + 10 * u, by + 6 * u, size);
      this.text(tstr2, x2 + w2 - 10 * u, by + 6 * u, 11 * u, 1, left2 < 15 ? 0.5 + 0.5 * Math.sin(this.t * 10) : 0.8);
      by += 32 * u;
      const tg = g.missionTarget();
      if (tg) this.marker(r, tg, '#f2c23b', top);
    }
    // evac bus: always labelled, arrow while somebody tags along
    const ev = g.world.evac;
    if (ev) {
      const followers = g.civs.some((c) => c.follow && !c.taken);
      const [ex, ey] = r.project(ev.x, ev.y, 70);
      if (ex > 0 && ex < this.W && ey > 0 && ey < this.H) {
        const t2 = 'EVAC BUS';
        this.text(t2, ex, ey - 8 * u, 12 * u, 0.5, 0.75 + 0.25 * Math.sin(this.t * 4));
      } else if (followers) this.edgeArrow(ex, ey, '#5dff8a', top);
    }
    // search progress ring over Dale
    if (g.search) {
      const [px, py] = r.project(p.x, p.y, 72);
      const k = g.search.t / g.search.dur;
      ctx.lineWidth = 6 * u;
      ctx.strokeStyle = 'rgba(11,20,51,0.8)';
      ctx.beginPath();
      ctx.arc(px, py, 14 * u, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 4 * u;
      ctx.strokeStyle = '#f2c23b';
      ctx.beginPath();
      ctx.arc(px, py, 14 * u, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
      ctx.stroke();
    }
    // banner
    if (g.banner) this.drawBanner(g.banner);
    // off-screen nest markers
    for (const n of g.nests) {
      const [sx, sy] = r.project(n.x, n.y);
      if (sx > 0 && sx < this.W && sy > 0 && sy < this.H) continue;
      this.edgeArrow(sx, sy, '#c45cff', top);
    }
    // controls
    this.drawControls(g);
  }

  // Arrow at the screen edge pointing towards something off-screen.
  edgeArrow(sx, sy, color, top) {
    const ctx = this.ctx, u = this.u;
    const ang = Math.atan2(sy - this.H / 2, sx - this.W / 2);
    const m = 26 * u;
    const ex = clamp(this.W / 2 + Math.cos(ang) * this.W, m, this.W - m);
    const ey = clamp(this.H / 2 + Math.sin(ang) * this.H, m + top + 60 * u, this.H - m - 100 * u);
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(ang);
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(this.t * 6);
    ctx.fillStyle = color;
    ctx.strokeStyle = '#0d1a44';
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.moveTo(13 * u, 0);
    ctx.lineTo(-8 * u, -10 * u);
    ctx.lineTo(-8 * u, 10 * u);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Bouncing marker over an on-screen target, edge arrow otherwise.
  marker(r, o, color, top) {
    const ctx = this.ctx, u = this.u;
    const [sx, sy] = r.project(o.x, o.y, (o.z || 0) + 110);
    if (sx < 0 || sx > this.W || sy < 0 || sy > this.H) return this.edgeArrow(sx, sy, color, top);
    const b = Math.abs(Math.sin(this.t * 5)) * 8 * u;
    ctx.fillStyle = color;
    ctx.strokeStyle = '#0d1a44';
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.moveTo(sx, sy + 10 * u - b);
    ctx.lineTo(sx - 9 * u, sy - 6 * u - b);
    ctx.lineTo(sx + 9 * u, sy - 6 * u - b);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  drawTicker(g, y) {
    const tc = g.tickerCur;
    if (!tc) return;
    const u = this.u;
    const x = this.safe.l + 10 * u, w = this.W - this.safe.l - this.safe.r - 20 * u;
    const inK = Math.min(1, tc.t * 5), outK = Math.min(1, (tc.dur - tc.t) * 4);
    const a = Math.min(inK, outK);
    const size = 11.5 * u;
    const lines = this.font.wrap(tc.text, size, w - 46 * u);
    const h = Math.max(42 * u, lines.length * size * 1.3 + 16 * u);
    this.ctx.globalAlpha = a * 0.88;
    this.roundRect(x, y - (1 - inK) * 20 * u, w, h, 10 * u, 'rgba(11,20,51,0.92)', '#c4231b', 2 * u);
    this.ctx.globalAlpha = 1;
    this.img('icon_radio', x + 6 * u, y + h / 2 - 15 * u - (1 - inK) * 20 * u, 30 * u, undefined, a);
    // typewriter
    let budget = Math.floor(tc.t * 45);
    lines.forEach((ln, i) => {
      if (budget <= 0) return;
      const s = ln.slice(0, budget);
      budget -= ln.length + 1;
      this.text(s, x + 42 * u, y + 9 * u + i * size * 1.3 - (1 - inK) * 20 * u, size, 0, a);
    });
  }

  drawBanner(b) {
    const u = this.u;
    const k = b.t / b.dur;
    const a = k < 0.1 ? k / 0.1 : k > 0.8 ? (1 - k) / 0.2 : 1;
    const sc = k < 0.1 ? 1.6 - k * 6 : 1;
    const size = this.fitSize(b.text, 38 * u * sc, this.W * 0.9);
    const y = this.H * 0.3;
    this.text(b.text, this.W / 2, y - size / 2, size, 0.5, a);
    if (b.sub) {
      const s2 = this.fitSize(b.sub, 13 * u, this.W * 0.86);
      this.text(b.sub, this.W / 2, y + size * 0.75, s2, 0.5, a * 0.9);
    }
  }

  drawControls(g) {
    const u = this.u, ctx = this.ctx;
    const input = this.cb.input();
    const R = this.joyR();
    const base = this.A.img.joy_base, knob = this.A.img.joy_knob;
    if (input.joy) {
      const j = input.joy;
      let dx = j.x - j.ox, dy = j.y - j.oy;
      const d = Math.hypot(dx, dy);
      if (d > R) (dx *= R / d), (dy *= R / d);
      ctx.globalAlpha = 0.75;
      ctx.drawImage(base, j.ox - R * 1.25, j.oy - R * 1.25, R * 2.5, R * 2.5);
      ctx.globalAlpha = 0.95;
      ctx.drawImage(knob, j.ox + dx - R * 0.55, j.oy + dy - R * 0.55, R * 1.1, R * 1.1);
      ctx.globalAlpha = 1;
    } else if (this.cb.touch()) {
      const ox = this.safe.l + 30 * u + R * 1.25, oy = this.H - this.safe.b - 30 * u - R * 1.25;
      ctx.globalAlpha = 0.28;
      ctx.drawImage(base, ox - R * 1.25, oy - R * 1.25, R * 2.5, R * 2.5);
      ctx.drawImage(knob, ox - R * 0.55, oy - R * 0.55, R * 1.1, R * 1.1);
      ctx.globalAlpha = 1;
    }
    if (input.aimP) {
      const a = input.aimP;
      ctx.globalAlpha = 0.35;
      ctx.drawImage(base, a.ox - R * 0.8, a.oy - R * 0.8, R * 1.6, R * 1.6);
      ctx.globalAlpha = 1;
    }
    // grenade button (not while driving - both hands on the wheel)
    const gs = 76 * u;
    const gx = this.W - this.safe.r - 22 * u - gs, gy = this.H - this.safe.b - 34 * u - gs;
    if (!g.player.car) {
      const down = this.btn('grenade', gx - 10 * u, gy - 10 * u, gs + 20 * u, gs + 20 * u, () => (input.grenade = true), true);
      const s = down ? 0.92 : 1;
      this.img('btn_grenade', gx + (gs - gs * s) / 2, gy + (gs - gs * s) / 2, gs * s, gs * s, g.player.grenades > 0 ? 1 : 0.45);
      this.roundRect(gx + gs - 22 * u, gy - 4 * u, 28 * u, 24 * u, 12 * u, '#c4231b', '#0d1a44', 2 * u);
      this.text(String(g.player.grenades), gx + gs - 8 * u, gy + 1 * u, 15 * u, 0.5);
    }
    // context action: search / drive / talk / pet / rig / get out
    const it = g.interact;
    if (it && !g.over) {
      const as = 74 * u;
      const ax = gx + (gs - as) / 2, ay = g.player.car ? gy : gy - as - 40 * u;
      const down = this.btn('action', ax - 8 * u, ay - 8 * u, as + 16 * u, as + 16 * u, () => (input.action = true), true);
      const pulse = (down ? 0.92 : 1) * (1 + 0.04 * Math.sin(this.t * 7));
      const ss = as * pulse;
      const fast = g.player.car && Math.abs(g.player.car.speed) > 150;
      this.img(ACTION_ICON[it.kind], ax + (as - ss) / 2, ay + (as - ss) / 2, ss, ss, fast ? 0.5 : 1);
      const label = ACTION_LABEL[it.kind] + (this.cb.touch() ? '' : ' (E)');
      const ls = this.fitSize(label, 13 * u, 150 * u);
      this.text(label, Math.min(ax + as / 2, this.W - this.safe.r - this.font.measure(label, ls) / 2 - 6 * u), ay - 20 * u, ls, 0.5);
    }
  }

  panel(cx, cy, w) {
    const im = this.A.img.panel;
    const h = (w * im.height) / im.width;
    this.ctx.drawImage(im, cx - w / 2, cy - h / 2, w, h);
    return h;
  }

  drawPause(g) {
    const ctx = this.ctx, u = this.u;
    ctx.fillStyle = 'rgba(6,10,30,0.55)';
    ctx.fillRect(0, 0, this.W, this.H);
    const w = Math.min(this.W * 0.86, 340 * u);
    const h = this.panel(this.W / 2, this.H / 2, w);
    const top = this.H / 2 - h / 2;
    this.text('PAUSED', this.W / 2, top + h * 0.12, 32 * u, 0.5);
    this.text('THE ALIENS ARE WAITING. POLITELY.', this.W / 2, top + h * 0.12 + 44 * u, this.fitSize('THE ALIENS ARE WAITING. POLITELY.', 11 * u, w * 0.78), 0.5, 0.85);
    const bw = w * 0.72;
    this.wideButton('resume', 'RESUME', this.W / 2, top + h * 0.45, bw, () => this.cb.resume());
    this.wideButton('sound', this.cb.soundOn() ? 'SOUND: ON' : 'SOUND: OFF', this.W / 2, top + h * 0.63, bw, () => this.cb.toggleSound());
    this.wideButton('quit', 'GIVE UP', this.W / 2, top + h * 0.81, bw, () => this.cb.menu());
  }

  drawOver(g) {
    const ctx = this.ctx, u = this.u;
    const k = clamp((g.overT - 0.8) / 0.8, 0, 1);
    ctx.fillStyle = `rgba(6,10,30,${0.6 * k})`;
    ctx.fillRect(0, 0, this.W, this.H);
    if (k <= 0) return;
    ctx.globalAlpha = k;
    const w = Math.min(this.W * 0.9, 360 * u);
    const h = this.panel(this.W / 2, this.H / 2 + (1 - k) * 40, w);
    const top = this.H / 2 - h / 2 + (1 - k) * 40;
    const cx = this.W / 2;
    this.text('GAME OVER', cx, top + h * 0.08, this.fitSize('GAME OVER', 34 * u, w * 0.8), 0.5, k);
    const dl = this.font.wrap(g.deathLine, 11 * u, w * 0.78);
    dl.forEach((ln, i) => this.text(ln, cx, top + h * 0.08 + 46 * u + i * 15 * u, 11 * u, 0.5, k * 0.9));
    const sy = top + h * 0.33;
    const row = (label, val, y) => {
      this.text(label, cx - w * 0.36, y, 12 * u, 0, k * 0.8);
      this.text(val, cx + w * 0.36, y, 16 * u, 1, k);
    };
    row('SURVIVED', fmtTime(g.time), sy);
    row('KILLS', String(g.kills), sy + 23 * u);
    row('RESCUED', String(g.rescued), sy + 46 * u);
    row('MISSIONS', String(g.missionsDone), sy + 69 * u);
    row('BEST', fmtTime(this.cb.best()), sy + 92 * u);
    const rk = 'RANK: ' + rank(g.time);
    this.text(rk, cx, sy + 120 * u, this.fitSize(rk, 14 * u, w * 0.8), 0.5, k);
    if (this.cb.newRecord()) this.text('NEW RECORD! NOBODY CARES.', cx, sy + 142 * u, this.fitSize('NEW RECORD! NOBODY CARES.', 11 * u, w * 0.8), 0.5, k * (0.6 + 0.4 * Math.sin(this.t * 6)));
    const bw = w * 0.66;
    if (g.overT > 1.5) {
      this.wideButton('again', 'TRY AGAIN', cx, top + h * 0.8, bw, () => this.cb.restart());
      this.wideButton('menu', 'MENU', cx, top + h * 0.93, bw * 0.7, () => this.cb.menu());
    }
    ctx.globalAlpha = 1;
  }

  drawTitle() {
    const ctx = this.ctx, u = this.u, W = this.W, H = this.H;
    const sp = this.A.img.splash;
    // cover-fit splash with a slow drift
    const s = Math.max(W / sp.width, H / sp.height) * 1.06;
    const dw = sp.width * s, dh = sp.height * s;
    const dx = (W - dw) / 2 + Math.sin(this.t * 0.15) * 10, dy = (H - dh) / 2 + Math.cos(this.t * 0.12) * 8;
    ctx.drawImage(sp, dx, dy, dw, dh);
    let gr = ctx.createLinearGradient(0, 0, 0, H * 0.45);
    gr.addColorStop(0, 'rgba(8,12,40,0.75)');
    gr.addColorStop(1, 'rgba(8,12,40,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H * 0.45);
    gr = ctx.createLinearGradient(0, H * 0.55, 0, H);
    gr.addColorStop(0, 'rgba(8,12,40,0)');
    gr.addColorStop(1, 'rgba(8,12,40,0.85)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, H * 0.55, W, H * 0.45);
    const lw = Math.min(W * 0.92, 560 * u);
    const bob = Math.sin(this.t * 1.5) * 4 * u;
    const lh = this.img('logo', W / 2 - lw / 2, this.safe.t + H * 0.05 + bob, lw);
    const sub = 'EARTH HAS BEEN CANCELLED.';
    this.text(sub, W / 2, this.safe.t + H * 0.05 + lh + 6 * u, this.fitSize(sub, 17 * u, W * 0.86), 0.5);
    const bw = Math.min(W * 0.72, 300 * u);
    const by = H * 0.68;
    this.wideButton('play', 'PLAY', W / 2, by, bw, () => this.cb.play());
    this.wideButton('intro', 'WATCH INTRO', W / 2 - bw * 0.27, by + bw * 0.43, bw * 0.5, () => this.startIntro(false));
    this.wideButton('sound', this.cb.soundOn() ? 'SOUND ON' : 'SOUND OFF', W / 2 + bw * 0.27, by + bw * 0.43, bw * 0.5, () => this.cb.toggleSound());
    const best = this.cb.best();
    if (best > 0) {
      const t = 'BEST: ' + fmtTime(best) + '   ' + rank(best);
      this.text(t, W / 2, H - this.safe.b - 52 * u, this.fitSize(t, 13 * u, W * 0.9), 0.5);
    }
    const tip = this.cb.touch() ? 'LEFT THUMB MOVES. AIMING IS AUTOMATIC. TAP THE BUTTON TO SEARCH, DRIVE, TALK, PET.' : 'WASD MOVES. E INTERACTS. SPACE THROWS GRENADES. AIMING IS AUTOMATIC.';
    this.text(tip, W / 2, H - this.safe.b - 26 * u, this.fitSize(tip, 10 * u, W * 0.92), 0.5, 0.8);
  }

  // --- intro cutscene --------------------------------------------------------------------------------
  startIntro(thenPlay) {
    this.state = 'intro';
    this.intro = { scene: -1, t: 0, line: 0, lineT: 0, thenPlay, done: false };
    this.nextScene();
  }
  nextScene() {
    const it = this.intro;
    it.scene++;
    it.t = 0;
    it.line = 0;
    it.lineT = 0;
    if (it.scene >= STORY.length) {
      it.card = 0;
      this.video.pause();
      return;
    }
    const v = this.video;
    if (this.ext === undefined) this.ext = v.canPlayType('video/mp4; codecs="avc1.4D401F, mp4a.40.2"') ? '.mp4' : '.webm';
    v.src = 'assets/video/' + STORY[it.scene].video + this.ext;
    v.muted = !this.cb.soundOn();
    v.volume = 0.8;
    v.currentTime = 0;
    const pr = v.play();
    if (pr && pr.catch)
      pr.catch(() => {
        v.muted = true;
        v.play().catch(() => {});
      });
  }
  advanceIntro() {
    const it = this.intro;
    if (!it) return;
    if (it.card !== undefined) return this.endIntro();
    const sc = STORY[it.scene];
    if (it.line < sc.lines.length - 1) {
      it.line++;
      it.lineT = 0;
    } else this.nextScene();
  }
  endIntro() {
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.load();
    const thenPlay = this.intro && this.intro.thenPlay;
    this.intro = null;
    this.cb.introDone(thenPlay);
  }
  drawIntro(dt) {
    const ctx = this.ctx, u = this.u, W = this.W, H = this.H;
    const it = this.intro;
    it.t += dt;
    it.lineT += dt;
    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, W, H);
    if (it.card !== undefined) {
      // closing title card
      it.card += dt;
      const a = Math.min(1, it.card * 1.5);
      const lw = Math.min(W * 0.9, 540 * u);
      this.img('logo', W / 2 - lw / 2, H * 0.3, lw, undefined, a);
      const s = 'EARTH HAS BEEN CANCELLED.';
      this.text(s, W / 2, H * 0.3 + lw * 0.55, this.fitSize(s, 16 * u, W * 0.86), 0.5, a);
      if (it.card > 2.6) this.endIntro();
      return;
    }
    const v = this.video;
    if (v.readyState >= 2 && v.videoWidth) {
      const s = Math.max(W / v.videoWidth, H / v.videoHeight);
      const dw = v.videoWidth * s, dh = v.videoHeight * s;
      ctx.drawImage(v, (W - dw) / 2, (H - dh) / 2, dw, dh);
    }
    const fadeIn = Math.min(1, it.t * 2);
    if (fadeIn < 1) {
      ctx.fillStyle = `rgba(5,7,15,${1 - fadeIn})`;
      ctx.fillRect(0, 0, W, H);
    }
    // caption
    const sc = STORY[it.scene];
    const perLine = Math.max(2.6, 5.2 / sc.lines.length);
    if (it.lineT > perLine && it.line < sc.lines.length - 1) {
      it.line++;
      it.lineT = 0;
    }
    if (it.line === sc.lines.length - 1 && it.lineT > perLine + 0.6 && (v.ended || it.t > 5.2)) this.nextScene();
    if (!this.intro || this.intro.card !== undefined) return;
    const gr = ctx.createLinearGradient(0, H * 0.62, 0, H);
    gr.addColorStop(0, 'rgba(5,7,15,0)');
    gr.addColorStop(1, 'rgba(5,7,15,0.9)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, H * 0.62, W, H * 0.38);
    const line = sc.lines[it.line];
    const size = 17 * u;
    const lines = this.font.wrap(line, size, W * 0.86);
    let budget = Math.floor(it.lineT * 38);
    const y0 = H - this.safe.b - 60 * u - lines.length * size * 1.3;
    lines.forEach((ln, i) => {
      if (budget <= 0) return;
      this.text(ln.slice(0, budget), W / 2 - this.font.measure(ln, size) / 2, y0 + i * size * 1.3, size, 0);
      budget -= ln.length + 1;
    });
    const sk = 'SKIP';
    const sw = this.font.measure(sk, 14 * u);
    const sx = W - this.safe.r - 16 * u - sw, sy = this.safe.t + 16 * u;
    this.btn('skip', sx - 12 * u, sy - 10 * u, sw + 24 * u, 36 * u, () => this.endIntro(), true);
    this.roundRect(sx - 10 * u, sy - 8 * u, sw + 20 * u, 32 * u, 14 * u, 'rgba(11,20,51,0.7)', '#c4231b', 2 * u);
    this.text(sk, sx, sy, 14 * u, 0);
    // progress pips
    for (let i = 0; i < STORY.length; i++) {
      ctx.fillStyle = i <= it.scene ? '#f3e6c8' : 'rgba(243,230,200,0.3)';
      ctx.fillRect(W / 2 - STORY.length * 9 * u + i * 18 * u, H - this.safe.b - 24 * u, 12 * u, 3 * u);
    }
  }
}
