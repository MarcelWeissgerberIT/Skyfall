// Canvas renderer: isometric diorama, cast shadows, day/night lighting and tilt-shift.
import { C, TILE, clamp, rand } from './util.js';
import { TT } from './world.js';
import { PICKUP_SPRITE } from './game.js';

const TEX_SCALE = { sand: 0.375, dirt: 0.375, grass: 0.22, concrete: 0.25, asphalt: 0.3 };
const TEX_OF = ['sand', 'dirt', 'grass', 'concrete', 'asphalt'];
const PICKUP_GLOW = { ammo: 'yellow', medkit: 'red', grenades: 'orange', smg: 'yellow', core: 'magenta' };
const COLORS = {
  yellow: [255, 214, 120], orange: [255, 140, 50], red: [255, 70, 70], magenta: [255, 60, 220],
  cyan: [90, 230, 255], violet: [170, 90, 255], warm: [255, 200, 130], blue: [70, 120, 255], white: [255, 255, 255],
};

export class Renderer {
  constructor(canvas, A) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.A = A;
    this.cam = { x: 0, y: 0 };
    this.time = 0;
    this.sizeCache = new Map();
    this.shadowCache = new Map();
    this.objs = [];
    this.lights = [];
    this.glows = {};
    for (const k in COLORS) this.glows[k] = makeGlow(COLORS[k]);
    this.lightSprite = makeGlow([255, 255, 255], 1);
    this.smokeSprite = makeSoft([90, 88, 92]);
    this.dustSprite = makeSoft([196, 160, 112]);
    this.splats = [0, 1, 2].map((i) => makeSplat([88, 30, 120], i));
    this.drops = makeSplat([90, 28, 120], 7, 0.5);
    this.scorch = makeScorch();
    this.light = document.createElement('canvas');
    this.lctx = this.light.getContext('2d');
    this.c2 = document.createElement('canvas');
    this.c4 = document.createElement('canvas');
    this.c8 = document.createElement('canvas');
    this.band = document.createElement('canvas');
    this.filterOK = typeof this.ctx.filter === 'string';
    this.patterns = {};
    for (const k of TEX_OF) {
      const p = this.ctx.createPattern(A.tex[k], 'repeat');
      if (p.setTransform) p.setTransform(new DOMMatrix([TEX_SCALE[k], 0, 0, TEX_SCALE[k], 0, 0]));
      this.patterns[k] = p;
    }
    this.resize();
  }

  resize() {
    // quality steps down automatically on slow devices (see render)
    const dpr = Math.min(window.devicePixelRatio || 1, [2, 1.5, 1.5, 1][this.quality || 0]);
    const W = window.innerWidth, H = window.innerHeight;
    this.dpr = dpr;
    this.W = W;
    this.H = H;
    this.cv.width = Math.round(W * dpr);
    this.cv.height = Math.round(H * dpr);
    this.zoom = clamp(Math.min(W / 520, H / 700), 0.55, 1.7);
    this.light.width = Math.ceil(W / 2);
    this.light.height = Math.ceil(H / 2);
    const bw = this.cv.width, bh = this.cv.height;
    this.c2.width = Math.ceil(bw / 2); this.c2.height = Math.ceil(bh / 2);
    this.c4.width = Math.ceil(bw / 4); this.c4.height = Math.ceil(bh / 4);
    this.c8.width = Math.ceil(bw / 8); this.c8.height = Math.ceil(bh / 8);
    this.band.width = Math.ceil(bw / 2); this.band.height = Math.ceil(bh / 2);
    this.vignette = makeVignette(this.cv.width, this.cv.height);
  }

  // world radius that covers the screen (used for spawning off-screen)
  viewRadius() {
    return Math.hypot(this.W, this.H * 2) / this.zoom / 2 * 0.75;
  }

  project(x, y, z = 0) {
    return [(x - y) * C * this.zoom + this.ox, (x + y) * C * 0.5 * this.zoom - z * this.zoom + this.oy];
  }
  unproject(sx, sy) {
    const u = (sx - this.ox) / (C * this.zoom), v = (sy - this.oy) / (C * 0.5 * this.zoom);
    return [(u + v) / 2, (v - u) / 2];
  }

  // --- frame -----------------------------------------------------------------------
  render(g, dt) {
    this.time += dt;
    // adaptive quality: if frames stay slow for a while, trade resolution / post effects for speed
    if (dt > 0) {
      this.slow = dt > 1 / 38 ? (this.slow || 0) + dt : Math.max(0, (this.slow || 0) - dt * 0.5);
      if (this.slow > 3 && (this.quality || 0) < 3) {
        this.quality = (this.quality || 0) + 1;
        this.slow = 0;
        this.resize();
        if (this.onResize) this.onResize();
      }
    }
    const ctx = this.ctx, dpr = this.dpr, z = this.zoom;
    const p = g.player;
    // camera follows the player with a little lead
    const lead = 40;
    const tx = p.x + p.fx * lead * (p.moving ? 1 : 0), ty = p.y + p.fy * lead * (p.moving ? 1 : 0);
    const k = 1 - Math.pow(0.0008, dt);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    if (!this.camInit) {
      this.cam.x = p.x;
      this.cam.y = p.y;
      this.camInit = true;
    }
    const sh = g.shake;
    const shx = sh ? rand(-sh, sh) : 0, shy = sh ? rand(-sh, sh) : 0;
    this.ox = this.W / 2 - (this.cam.x - this.cam.y) * C * z + shx;
    this.oy = this.H * 0.54 - (this.cam.x + this.cam.y) * C * 0.5 * z + shy;
    this.dark = g.darkness || 0;
    this.lights.length = 0;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#c99b63';
    ctx.fillRect(0, 0, this.W, this.H);

    this.drawGround(g);
    this.drawWorld(g);
    this.drawAir(g);
    this.drawGrade(g);
    this.drawLighting(g);
    this.tiltShift();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(this.vignette, 0, 0);
    if (g.hurtFlash > 0) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const gr = ctx.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.3, this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.7);
      gr.addColorStop(0, 'rgba(200,0,0,0)');
      gr.addColorStop(1, `rgba(200,0,0,${g.hurtFlash * 0.55})`);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, this.W, this.H);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  visibleBounds(margin = 260) {
    const pts = [
      this.unproject(-margin, -margin),
      this.unproject(this.W + margin, -margin),
      this.unproject(-margin, this.H + margin * 2),
      this.unproject(this.W + margin, this.H + margin * 2),
    ];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    return { x0, y0, x1, y1 };
  }

  isoTransform() {
    const d = this.dpr, z = this.zoom;
    this.ctx.setTransform(d * z * C, d * z * C * 0.5, -d * z * C, d * z * C * 0.5, d * this.ox, d * this.oy);
  }

  // Ground is static: render it once per chunk of tiles, then just blit the chunks.
  buildChunk(w, ci, cj) {
    const CH = 8, S = CH * TILE, z = this.zoom, d = this.dpr, pad = 2;
    const x0 = ci * S, y0 = cj * S;
    const half = S * C * z;
    const c = document.createElement('canvas');
    c.width = Math.ceil((2 * half + pad * 2) * d);
    c.height = Math.ceil((half + pad * 2) * d);
    const g = c.getContext('2d');
    g.setTransform(d * z * C, d * z * C * 0.5, -d * z * C, d * z * C * 0.5, d * (half + pad), d * pad);
    g.translate(-x0, -y0);
    // clip to the chunk (slightly enlarged so neighbours overlap and no seams show)
    g.beginPath();
    g.rect(x0 - 1.5, y0 - 1.5, S + 3, S + 3);
    g.clip();
    const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    const used = [0, 0, 0, 0, 0];
    for (let j = cj * CH - 1; j <= cj * CH + CH; j++) {
      let runT = -1, runS = 0;
      for (let i = ci * CH - 1; i <= ci * CH + CH + 1; i++) {
        const t = i <= ci * CH + CH ? w.terrain(i, j) : -1;
        if (t !== runT) {
          if (runT >= 0) {
            paths[runT].rect(runS * TILE - 0.6, j * TILE - 0.6, (i - runS) * TILE + 1.2, TILE + 1.2);
            used[runT] = 1;
          }
          runT = t;
          runS = i;
        }
      }
    }
    for (let t = 0; t < 5; t++) {
      if (!used[t]) continue;
      g.fillStyle = this.patterns[TEX_OF[t]];
      g.fill(paths[t]);
    }
    // soft dirt patches in the desert (organic blobs instead of tile staircases)
    const patch = new Path2D(), rim = new Path2D();
    let any = false;
    for (const q of w.patches) {
      const r = q.r * 1.35;
      if (q.x + r < x0 || q.x - r > x0 + S || q.y + r < y0 || q.y - r > y0 + S) continue;
      patch.moveTo(q.x + q.r, q.y);
      patch.arc(q.x, q.y, q.r, 0, Math.PI * 2);
      rim.moveTo(q.x + r, q.y);
      rim.arc(q.x, q.y, r, 0, Math.PI * 2);
      any = true;
    }
    if (any) {
      g.fillStyle = this.patterns.dirt;
      g.globalAlpha = 0.3;
      g.fill(rim);
      g.globalAlpha = 0.55;
      g.fill(patch);
      g.globalAlpha = 1;
    }
    g.fillStyle = 'rgba(236,196,72,0.9)';
    for (const q of w.dashes) {
      if (q.x1 < x0 || q.x0 > x0 + S || q.y1 < y0 || q.y0 > y0 + S) continue;
      g.fillRect(q.x0, q.y0, q.x1 - q.x0, q.y1 - q.y0);
    }
    return { c, half, pad };
  }

  drawGround(g) {
    const ctx = this.ctx, w = g.world;
    if (this.chunkWorld !== w || this.chunkZoom !== this.zoom || this.chunkDpr !== this.dpr) {
      this.chunks = new Map();
      this.chunkWorld = w;
      this.chunkZoom = this.zoom;
      this.chunkDpr = this.dpr;
    }
    const b = this.visibleBounds(80);
    const S = 8 * TILE;
    const ci0 = Math.floor(b.x0 / S), ci1 = Math.floor(b.x1 / S);
    const cj0 = Math.floor(b.y0 / S), cj1 = Math.floor(b.y1 / S);
    const d = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    let built = 0;
    for (let cj = cj0; cj <= cj1; cj++)
      for (let ci = ci0; ci <= ci1; ci++) {
        const [sx, sy] = this.project(ci * S, cj * S);
        const half = S * C * this.zoom;
        if (sx + half < -10 || sx - half > this.W + 10 || sy > this.H + 10 || sy + half < -10) continue;
        const key = ci * 4096 + cj;
        let ch = this.chunks.get(key);
        if (!ch) {
          if (built > 10) continue; // spread the work over a few frames
          ch = this.buildChunk(w, ci, cj);
          this.chunks.set(key, ch);
          built++;
        }
        ch.used = this.time;
        ctx.drawImage(ch.c, Math.round((sx - ch.half - ch.pad) * d), Math.round((sy - ch.pad) * d));
      }
    // drop chunks that have not been on screen for a while
    if (this.chunks.size > 48)
      for (const [k, ch] of this.chunks) if (this.time - ch.used > 4) this.chunks.delete(k);
    this.isoTransform();
    // flat decals
    for (const d of g.decals) {
      if (d.x < b.x0 || d.x > b.x1 || d.y < b.y0 || d.y > b.y1) continue;
      const a = Math.min(1, d.life / 6);
      if (d.kind === 'crater') continue;
      ctx.globalAlpha = a * (d.kind === 'scorch' ? 0.8 : 0.85);
      const spr = d.kind === 'splat' ? this.splats[(d.rot * 10) % 3 | 0] : d.kind === 'drop' ? this.drops : this.scorch;
      const s = (d.kind === 'scorch' ? 120 : d.kind === 'splat' ? 46 : 30) * d.scale;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.drawImage(spr, -s, -s, s * 2, s * 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // pickup halos
    for (const k of g.pickups) {
      const pulse = 0.5 + 0.5 * Math.sin(k.t * 5);
      ctx.globalAlpha = 0.35 + pulse * 0.3;
      ctx.drawImage(this.glows[PICKUP_GLOW[k.type]], k.x - 34, k.y - 34, 68, 68);
    }
    // meteor warnings
    for (const m of g.meteors) {
      const k = 1 - m.t / m.dur;
      const R = (m.big ? 120 : 85) * (0.4 + 0.6 * k);
      ctx.globalAlpha = 0.25 + 0.5 * k;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(m.x, m.y, R * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.time * 18);
      ctx.strokeStyle = '#ff3b2f';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.big ? 120 : 85, 0, Math.PI * 2);
      ctx.stroke();
    }
    // ground shadows of flying things
    ctx.fillStyle = '#000';
    const blob = (x, y, r, a) => {
      ctx.globalAlpha = a;
      ctx.drawImage(this.lightSpriteDark || (this.lightSpriteDark = makeGlow([0, 0, 0], 1)), x - r, y - r, r * 2, r * 2);
    };
    for (const u of g.ufos) blob(u.x, u.y, 70, 0.45);
    if (g.mother) blob(g.mother.x, g.mother.y, 230, 0.5);
    for (const n of g.nests) if (n.land < 1) blob(n.x, n.y, 70 * n.land + 20, 0.5 * n.land);
    for (const v of g.vultures) blob(v.x + 60, v.y + 60, 26, 0.18);
    for (const gr of g.grenades) blob(gr.x, gr.y, 9, 0.4);
    for (const t of g.tumbleweeds) blob(t.x, t.y, 18, 0.3);
    ctx.globalAlpha = 1;
    // UFO beams light up the ground
    ctx.globalCompositeOperation = 'lighter';
    for (const u of g.ufos) {
      if (u.beam <= 0) continue;
      ctx.globalAlpha = u.beam * (0.55 + 0.15 * Math.sin(this.time * 20));
      ctx.drawImage(this.glows.cyan, u.x - 70, u.y - 70, 140, 140);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    // iso-perspective decals drawn in screen space
    this.screenTransform();
    for (const d of g.decals) {
      if (d.kind !== 'crater') continue;
      const [sx, sy] = this.project(d.x, d.y);
      if (sx < -200 || sx > this.W + 200 || sy < -200 || sy > this.H + 200) continue;
      ctx.globalAlpha = Math.min(1, d.life / 6);
      const w2 = 150 * d.scale * this.zoom;
      const img = this.A.img.crater;
      const h2 = (w2 * img.height) / img.width;
      ctx.drawImage(img, sx - w2 / 2, sy - h2 / 2, w2, h2);
      if (d.life > d.max - 12) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = ((d.life - (d.max - 12)) / 12) * 0.6;
        ctx.drawImage(this.glows.orange, sx - w2 * 0.4, sy - h2 * 0.4, w2 * 0.8, h2 * 0.8);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.globalAlpha = 1;
  }

  screenTransform() {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  // --- objects ---------------------------------------------------------------------------
  propGeom(p) {
    if (p.geom) return p.geom;
    const def = p.def;
    const img = this.A.img[p.sprite];
    let w, h;
    if (def.drawW) (w = def.drawW), (h = (w * img.height) / img.width);
    else (h = def.drawH), (w = (h * img.width) / img.height);
    let ay;
    if (p.box) ay = 1 - p.baseOff / h;
    else ay = 1 - (def.base || 0.03);
    p.geom = { w, h, ay };
    return p.geom;
  }

  drawWorld(g) {
    const ctx = this.ctx, z = this.zoom, W = this.W, H = this.H;
    const objs = this.objs;
    objs.length = 0;
    const cull = (sx, sy, r) => sx > -r && sx < W + r && sy > -r * 0.5 && sy < H + r * 1.6;
    const addProp = (q) => {
      const [sx, sy] = this.project(q.x, q.y);
      if (!cull(sx, sy, 340 * z)) return;
      objs.push({ d: q.depth, k: 0, o: q, sx, sy });
    };
    for (const q of g.world.props) addProp(q);
    for (const q of g.world.decor) addProp(q);
    const add = (k, o, d) => {
      const [sx, sy] = this.project(o.x, o.y);
      if (!cull(sx, sy, 300 * z)) return;
      objs.push({ d: d === undefined ? o.x + o.y : d, k, o, sx, sy });
    };
    for (const e of g.enemies) add(1, e);
    for (const c of g.civs) add(2, c);
    for (const c of g.cows) add(3, c);
    for (const k of g.pickups) add(4, k);
    for (const n of g.nests) add(5, n);
    for (const t of g.tumbleweeds) add(6, t);
    for (const gr of g.grenades) add(7, gr);
    for (const f of g.fx) if (f.type === 'corpse') add(8, f);
    if (!g.player.dead) add(9, g.player);
    objs.sort((a, b) => a.d - b.d);

    // shadows first so they never cover sprites
    const sa = 0.42 * (1 - this.dark * 0.85);
    if (sa > 0.02) {
      for (const it of objs) this.drawShadowOf(it, sa);
    }
    this.screenTransform();
    for (const it of objs) this.drawObj(g, it);
    this.drawFx(g);
  }

  drawShadowOf(it, alpha) {
    const o = it.o, z = this.zoom;
    let key, w, h, ay, flip = false;
    switch (it.k) {
      case 0: {
        const gm = this.propGeom(o);
        key = o.sprite; w = gm.w; h = gm.h; ay = gm.ay; flip = o.flip;
        break;
      }
      case 1: {
        const s = this.enemySize(o);
        key = o.def.sprite; w = s[0]; h = s[1]; ay = 0.97; flip = o.flip;
        if (o.spawnT < 1) return;
        break;
      }
      case 2: key = o.type; [w, h] = this.sizeH(o.type, 62); ay = 0.97; flip = o.flip; if (o.taken) return; break;
      case 3: key = 'cow'; [w, h] = this.sizeW('cow', 74); ay = 0.88; flip = o.flip; if (o.z > 2) return; break;
      case 9: {
        const s = this.playerSprite(o);
        key = s.key; w = s.w; h = s.h; ay = 0.97; flip = s.flip;
        break;
      }
      default:
        return;
    }
    const sc = this.getShadow(key);
    if (!sc) return;
    const d = this.dpr, kx = 0.78, ky = 0.36;
    const f = flip ? -1 : 1;
    this.ctx.setTransform(d * z * f, 0, -kx * d * z, -ky * d * z, d * it.sx, d * it.sy);
    // local (u, v) with v negative above the anchor; the matrix throws tall parts down-right
    const fac = w / sc.iw;
    this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(sc.c, -w / 2 - sc.pad * fac, -ay * h - sc.pad * fac, w + sc.pad * 2 * fac, h + sc.pad * 2 * fac);
    this.ctx.globalAlpha = 1;
  }

  getShadow(key) {
    let s = this.shadowCache.get(key);
    if (s !== undefined) return s;
    const img = this.A.img[key];
    if (!img) return null;
    const sc = 0.5, pad = 6;
    const iw = Math.ceil(img.width * sc), ih = Math.ceil(img.height * sc);
    const t = document.createElement('canvas');
    t.width = iw;
    t.height = ih;
    const tg = t.getContext('2d');
    tg.drawImage(img, 0, 0, iw, ih);
    tg.globalCompositeOperation = 'source-in';
    tg.fillStyle = '#0a0612';
    tg.fillRect(0, 0, iw, ih);
    const c = document.createElement('canvas');
    c.width = iw + pad * 2;
    c.height = ih + pad * 2;
    const cg = c.getContext('2d');
    if (this.filterOK) cg.filter = 'blur(2.5px)';
    cg.drawImage(t, pad, pad);
    s = { c, pad: pad, iw };
    // pad is in shadow pixels; convert using iw (shadow width) in drawShadowOf
    this.shadowCache.set(key, s);
    return s;
  }

  sizeW(key, w) {
    const img = this.A.img[key];
    return [w, (w * img.height) / img.width];
  }
  sizeH(key, h) {
    const img = this.A.img[key];
    return [(h * img.width) / img.height, h];
  }
  enemySize(e) {
    if (!e.size) e.size = e.def.size[0] === 'w' ? this.sizeW(e.def.sprite, e.def.size[1]) : this.sizeH(e.def.sprite, e.def.size[1]);
    return e.size;
  }
  playerSprite(p) {
    const sx = (p.aimX - p.aimY), sy = (p.aimX + p.aimY);
    const back = sy < -0.15;
    const key = back ? 'player_back' : 'player_front';
    const [w, h] = this.sizeH(key, 72);
    // front sprite faces down-left, back sprite faces up-right
    const flip = back ? sx < 0 : sx > 0;
    return { key, w, h, flip };
  }

  sprite(key, sx, sy, w, h, ax, ay, flip, rot = 0, skew = 0, alpha = 1, flash = 0, sxScale = 1, syScale = 1) {
    const ctx = this.ctx, d = this.dpr, z = this.zoom;
    const img = this.A.img[key];
    if (!img) return;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const fx = (flip ? -1 : 1) * sxScale * z, fy = syScale * z;
    // transform = translate * rotate * skewX * scale
    const a = cr * fx, b = sr * fx;
    const c = (cr * skew - sr) * fy, dd = (sr * skew + cr) * fy;
    ctx.setTransform(d * a, d * b, d * c, d * dd, d * sx, d * sy);
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, -ax * w, -ay * h, w, h);
    if (flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = flash * alpha;
      ctx.drawImage(img, -ax * w, -ay * h, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }

  glow(color, sx, sy, r, a, sy2 = 1) {
    if (a <= 0.01) return;
    const ctx = this.ctx, d = this.dpr;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(this.glows[color], sx - r, sy - r * sy2, r * 2, r * 2 * sy2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  addLight(sx, sy, r, a, stretch = 0.75) {
    this.lights.push(sx, sy, r * this.zoom, a, stretch);
  }

  drawObj(g, it) {
    const o = it.o, z = this.zoom, t = this.time;
    const night = this.dark;
    switch (it.k) {
      case 0: {
        // static prop
        const gm = this.propGeom(o);
        const def = o.def;
        let skew = 0;
        if (def.sway) skew = Math.sin(t * 1.4 + o.x * 0.013 + o.y * 0.007) * def.sway + Math.sin(t * 3.1 + o.x) * def.sway * 0.3;
        this.sprite(o.sprite, it.sx, it.sy, gm.w, gm.h, 0.5, gm.ay, o.flip, 0, skew);
        if (def.light) {
          const fl = Math.random() < 0.02 ? 0.3 : 1;
          const lx = it.sx + (o.flip ? -1 : 1) * gm.w * 0.18 * z, ly = it.sy - gm.h * 0.86 * z;
          if (night > 0.05) {
            this.glow('warm', lx, ly, 26 * z, night * 0.9 * fl);
            this.glow('warm', it.sx, it.sy, 70 * z, night * 0.35 * fl, 0.5);
            this.addLight(it.sx, it.sy - 10 * z, 125, 0.85 * fl);
          }
        }
        if (o.type === 'car_police' || o.type === 'car_sheriff') {
          const ph = Math.floor(t * 6 + o.x) % 2;
          const ly = it.sy - (gm.ay - 0.18) * gm.h * z;
          const lx = it.sx + (ph ? -6 : 6) * z;
          this.glow(ph ? 'red' : 'blue', lx, ly, 34 * z, 0.45 + night * 0.5);
          if (night > 0.1) this.addLight(it.sx, it.sy, 90, 0.5 * night);
        }
        if (o.burning) {
          const fl = 0.75 + Math.random() * 0.25;
          this.glow('orange', it.sx, it.sy - 30 * z, 110 * z, (0.25 + night * 0.5) * fl);
          this.addLight(it.sx, it.sy - 20 * z, 190, 0.9 * fl);
        }
        break;
      }
      case 1: {
        // alien
        const [w, h] = this.enemySize(o);
        if (o.spawnT < 1) {
          const k = o.spawnT;
          this.glow('cyan', it.sx, it.sy - h * 0.4 * z, h * 0.7 * z, (1 - k) * 0.9, 1.4);
          this.sprite(o.def.sprite, it.sx, it.sy, w, h, 0.5, 0.97, o.flip, 0, 0, k, 1 - k, 1, k);
          break;
        }
        const sp = o.type === 'crawler' ? 16 : o.type === 'brute' ? 6 : 10;
        const hop = Math.abs(Math.sin(o.walkT * sp)) * (o.type === 'brute' ? 3 : 4) * z;
        const rot = Math.sin(o.walkT * sp) * (o.type === 'crawler' ? 0.05 : 0.08);
        const flash = o.hitT > 0 ? 0.8 : o.chargeT > 0 ? 0.3 : 0;
        this.sprite(o.def.sprite, it.sx, it.sy - hop, w, h, 0.5, 0.97, o.flip, rot, 0, 1, flash);
        if (night > 0.3) this.addLight(it.sx, it.sy - h * 0.6 * z, 30, 0.25);
        if (o.hp < o.maxHp && o.type === 'brute') this.hpBar(it.sx, it.sy - h * z - 8, 46 * z, o.hp / o.maxHp);
        break;
      }
      case 2: {
        const [w, h] = this.sizeH(o.type, 62);
        if (o.taken) {
          this.glow('magenta', it.sx, it.sy - (o.z || 0) * z - h * 0.4 * z, 50 * z, o.fade);
          this.sprite(o.type, it.sx, it.sy - (o.z || 0) * z, w, h, 0.5, 0.97, o.flip, Math.sin(t * 20) * 0.2, 0, o.fade, 0.6);
          break;
        }
        const hop = Math.abs(Math.sin(o.walkT * 13)) * 4 * z;
        this.sprite(o.type, it.sx, it.sy - hop, w, h, 0.5, 0.97, o.flip, Math.sin(o.walkT * 13) * 0.1);
        break;
      }
      case 3: {
        const [w, h] = this.sizeW('cow', 74);
        if (o.state === 'abducted') {
          this.sprite('cow', it.sx, it.sy - o.z * z, w * o.scale, h * o.scale, 0.5, 0.6, o.flip, Math.sin(o.rot) * 0.6);
          break;
        }
        let rot = 0, hop = 0;
        if (o.state === 'graze') rot = Math.max(0, Math.sin(t * 1.7 + o.x)) * 0.06 * (o.flip ? -1 : 1);
        else hop = Math.abs(Math.sin(t * 7 + o.x)) * 2 * z;
        this.sprite('cow', it.sx, it.sy - hop, w, h, 0.5, 0.88, o.flip, rot);
        break;
      }
      case 4: {
        const key = PICKUP_SPRITE[o.type];
        const [w, h] = this.sizeW(key, o.type === 'core' ? 26 : 40);
        const bob = (6 + Math.sin(o.t * 3) * 4 + (o.pop || 0) * 30) * z;
        const blink = o.drop && o.life < 5 ? (Math.sin(o.life * 20) > 0 ? 1 : 0.25) : 1;
        this.sprite(key, it.sx, it.sy - bob, w, h, 0.5, 0.9, false, Math.sin(o.t * 2) * 0.08, 0, blink);
        this.addLight(it.sx, it.sy, 40, 0.5);
        if (o.type === 'core') this.glow('magenta', it.sx, it.sy - bob - 10 * z, 40 * z, 0.5 + 0.3 * Math.sin(o.t * 6));
        break;
      }
      case 5: {
        const img = this.A.img.landed_ufo;
        const w = 200, h = (w * img.height) / img.width;
        const fall = (1 - o.land) * 700;
        const flash = o.hitT > 0 ? 0.6 : 0;
        this.sprite('landed_ufo', it.sx, it.sy - fall * z, w, h, 0.5, 0.8, false, (1 - o.land) * 0.4, 0, 1, flash);
        const pulse = 0.6 + 0.4 * Math.sin(o.pulse * 4);
        this.glow('violet', it.sx + 10 * z, it.sy - 30 * z - fall * z, 70 * z, (0.45 + night * 0.5) * pulse);
        this.addLight(it.sx, it.sy - 20 * z, 170, 0.8 * pulse);
        if (o.land < 1) {
          this.glow('orange', it.sx, it.sy - fall * z, 90 * z, 0.8);
        } else if (o.hp < o.maxHp) this.hpBar(it.sx, it.sy - h * 0.85 * z, 70 * z, o.hp / o.maxHp, '#b05cff');
        break;
      }
      case 6: {
        const [w, h] = this.sizeW('tumbleweed', 36);
        this.sprite('tumbleweed', it.sx, it.sy - o.z * z - h * 0.5 * z, w, h, 0.5, 0.5, false, o.rot, 0, Math.min(1, o.life));
        break;
      }
      case 7: {
        const ctx = this.ctx, d = this.dpr;
        const sy = it.sy - o.z * z;
        ctx.setTransform(d, 0, 0, d, 0, 0);
        ctx.fillStyle = '#3d4a2a';
        ctx.beginPath();
        ctx.arc(it.sx, sy - 4 * z, 5.5 * z, 0, Math.PI * 2);
        ctx.fill();
        if (o.landed && Math.sin(this.time * 30) > 0) this.glow('red', it.sx, sy - 4 * z, 26 * z, 0.9);
        break;
      }
      case 8: {
        const e = o.ref;
        const k = o.life / o.max;
        const [w, h] = this.enemySize(e);
        this.sprite(e.def.sprite, it.sx, it.sy, w, h, 0.5, 0.97, e.flip, 0, 0, k, 0.7, 1 + (1 - k) * 0.4, k * 0.8 + 0.1);
        break;
      }
      case 9: {
        const s = this.playerSprite(o);
        const hop = o.moving ? Math.abs(Math.sin(o.walkT * 11)) * 4 * z : 0;
        const rot = o.moving ? Math.sin(o.walkT * 11) * 0.07 : 0;
        const [rx, ry] = [-(o.aimX - o.aimY) * C * o.recoil * 4 * z, -(o.aimX + o.aimY) * C * 0.5 * o.recoil * 4 * z];
        const flash = o.hurtT > 0 ? 0.9 : 0;
        this.sprite(s.key, it.sx + rx, it.sy - hop + ry, s.w, s.h, 0.5, 0.97, s.flip, rot, 0, 1, flash);
        // muzzle flash
        if (o.recoil > 0.65) {
          const mx = it.sx + (o.aimX - o.aimY) * C * 30 * z, my = it.sy - 34 * z + (o.aimX + o.aimY) * C * 0.5 * 30 * z;
          this.glow(o.plasmaT > 0 ? 'magenta' : 'yellow', mx, my, 30 * z * o.recoil, 1);
        }
        // flashlight + personal light
        const ax = (o.aimX - o.aimY) * C, ay = (o.aimX + o.aimY) * C * 0.5;
        this.flash = { x: it.sx + ax * 150 * z, y: it.sy + ay * 150 * z - 10 * z, ang: Math.atan2(ay, ax) };
        this.addLight(it.sx, it.sy - 30 * z, 130, 0.95);
        break;
      }
    }
  }

  hpBar(sx, sy, w, k, color = '#e23b3b') {
    const ctx = this.ctx, d = this.dpr;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.fillStyle = 'rgba(10,18,51,0.8)';
    ctx.fillRect(sx - w / 2 - 1.5, sy - 1.5, w + 3, 7);
    ctx.fillStyle = color;
    ctx.fillRect(sx - w / 2, sy, w * clamp(k, 0, 1), 4);
  }

  drawFx(g) {
    const ctx = this.ctx, d = this.dpr, z = this.zoom;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    // bullets
    ctx.globalCompositeOperation = 'lighter';
    for (const b of g.bullets) {
      const [sx, sy] = this.project(b.x, b.y, 30);
      if (sx < -50 || sx > this.W + 50 || sy < -50 || sy > this.H + 50) continue;
      if (b.kind === 'plasma') {
        ctx.globalAlpha = 1;
        ctx.drawImage(this.glows.magenta, sx - 16 * z, sy - 16 * z, 32 * z, 32 * z);
        ctx.drawImage(this.glows.white, sx - 6 * z, sy - 6 * z, 12 * z, 12 * z);
        this.addLight(sx, sy, 50, 0.4);
        continue;
      }
      const l = b.kind === 'smg' ? 0.022 : 0.03;
      const [ex, ey] = this.project(b.x - b.vx * l, b.y - b.vy * l, 30);
      ctx.strokeStyle = b.kind === 'smg' ? 'rgba(255,230,150,0.9)' : 'rgba(255,240,190,0.95)';
      ctx.lineWidth = (b.kind === 'smg' ? 1.6 : 2.2) * z;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    }
    for (const b of g.ebullets) {
      const [sx, sy] = this.project(b.x, b.y, 28);
      if (sx < -50 || sx > this.W + 50 || sy < -50 || sy > this.H + 50) continue;
      const r = (b.big ? 22 : 15) * z * (0.9 + 0.2 * Math.sin(this.time * 30 + b.x));
      ctx.globalAlpha = 1;
      ctx.drawImage(this.glows.violet, sx - r, sy - r, r * 2, r * 2);
      ctx.drawImage(this.glows.magenta, sx - r * 0.5, sy - r * 0.5, r, r);
      this.addLight(sx, sy, 50, 0.45);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    // particles
    for (const f of g.fx) {
      if (f.type === 'corpse') continue;
      const [sx, sy] = this.project(f.x, f.y, f.z);
      if (sx < -80 || sx > this.W + 80 || sy < -80 || sy > this.H + 80) continue;
      const k = f.life / f.max;
      switch (f.type) {
        case 'spark':
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = k;
          ctx.drawImage(this.glows.yellow, sx - 7 * z, sy - 7 * z, 14 * z, 14 * z);
          break;
        case 'beamdot':
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = k;
          ctx.drawImage(this.glows.cyan, sx - 8 * z, sy - 8 * z, 16 * z, 16 * z);
          break;
        case 'fire': {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = Math.min(1, k * 1.6);
          const r = (10 + (1 - k) * 18) * f.size * z;
          ctx.drawImage(k > 0.6 ? this.glows.yellow : this.glows.orange, sx - r, sy - r, r * 2, r * 2);
          break;
        }
        case 'smoke':
        case 'dust': {
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = Math.min(1, k * 1.5) * (f.type === 'smoke' ? 0.55 : 0.6);
          const r = (14 + (1 - k) * 34) * f.size * z;
          ctx.drawImage(f.type === 'smoke' ? this.smokeSprite : this.dustSprite, sx - r, sy - r, r * 2, r * 2);
          break;
        }
        case 'goo':
        case 'blood':
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = Math.min(1, k * 2);
          ctx.fillStyle = f.type === 'goo' ? '#6a1fa0' : '#8e1010';
          ctx.beginPath();
          ctx.arc(sx, sy, 3 * z * f.size, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'debris':
        case 'shell':
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = Math.min(1, k * 3);
          ctx.fillStyle = f.type === 'shell' ? '#c4231b' : '#3a2a1e';
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(f.rot + f.life * 12);
          ctx.fillRect(-2.5 * z, -1.2 * z, 5 * z, 2.4 * z);
          ctx.restore();
          break;
        case 'ring':
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = k * 0.8;
          ctx.strokeStyle = '#ffd08a';
          ctx.lineWidth = 4 * z * k;
          ctx.beginPath();
          ctx.ellipse(sx, sy, f.size * (1 - k * 0.8) * z, f.size * (1 - k * 0.8) * z * 0.5, 0, 0, Math.PI * 2);
          ctx.stroke();
          break;
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    for (const f of g.flashes) {
      const [sx, sy] = this.project(f.x, f.y, f.z);
      this.glow(f.color, sx, sy, f.r * 0.35 * z, Math.min(1, f.t * 6));
      this.addLight(sx, sy, f.r, Math.min(1, f.t * 5));
    }
  }

  drawAir(g) {
    const z = this.zoom, t = this.time;
    // meteors
    for (const m of g.meteors) {
      const k = 1 - m.t / m.dur;
      const alt = (1 - k) * 900;
      const [sx, sy] = this.project(m.x, m.y, alt);
      const dx = m.ang * alt * z;
      const [w, h] = this.sizeH('meteor', m.big ? 170 : 120);
      this.sprite('meteor', sx + dx, sy, w, h, 0.5, 0.92, false, -m.ang * 0.8);
      this.glow('orange', sx + dx, sy - 10 * z, 60 * z, 0.9);
      this.addLight(sx + dx, sy, 160, 0.8);
    }
    // saucers + beams
    for (const u of g.ufos) {
      const bob = Math.sin(t * 2 + u.spin) * 8;
      const [sx, sy] = this.project(u.x, u.y, u.z + bob);
      const [gx, gy] = this.project(u.x, u.y);
      if (u.beam > 0) this.beam(sx, sy + 14 * z, gx, gy, u.beam);
      const [w, h] = this.sizeW('ufo', 150);
      const flash = u.hitT > 0 ? 0.6 : 0;
      this.sprite('ufo', sx, sy, w, h, 0.5, 0.55, false, Math.sin(t * 1.3 + u.spin) * 0.06, 0, 1, flash);
      this.glow('cyan', sx, sy + 10 * z, 70 * z, 0.35 + this.dark * 0.4, 0.5);
      this.addLight(sx, sy, 150, 0.8);
      if (u.state === 'hover' && u.hp > 0) this.hpBar(sx, sy - 52 * z, 60 * z, u.hp / u.maxHp, '#5ae6ff');
    }
    // mothership
    const m = g.mother;
    if (m) {
      const bob = Math.sin(t * 0.8) * 10;
      const [sx, sy] = this.project(m.x, m.y, m.z + bob);
      const [w, h] = this.sizeW('mothership', 420);
      this.sprite('mothership', sx, sy, w, h, 0.5, 0.55, false, Math.sin(t * 0.5) * 0.03, 0, 1, m.hitT > 0 ? 0.4 : 0);
      const pulse = 0.6 + 0.4 * Math.sin(t * 5);
      this.glow('magenta', sx, sy - 14 * z, 90 * z, pulse);
      this.glow('violet', sx, sy + 20 * z, 220 * z, 0.3 + this.dark * 0.3, 0.45);
      this.addLight(sx, sy, 320, 0.7);
    }
    // vultures: they know something you don't
    for (const v of g.vultures) {
      const [sx, sy] = this.project(v.x, v.y, v.z);
      const hx = -Math.sin(v.a) * Math.sign(v.sp), hy = Math.cos(v.a) * Math.sign(v.sp);
      const [shx, shy] = [(hx - hy) * C, (hx + hy) * C * 0.5];
      const ang = Math.atan2(shy, shx) + Math.PI / 2;
      const [w, h] = this.sizeW('vulture', 64);
      const flap = 1 + Math.sin(t * 3 + v.a * 5) * 0.06;
      this.sprite('vulture', sx, sy, w, h, 0.5, 0.5, false, ang, 0, 0.95 - this.dark * 0.5, 0, flap, 1);
    }
  }

  beam(sx, sy, gx, gy, a) {
    const ctx = this.ctx, d = this.dpr, z = this.zoom;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    const top = 16 * z, bot = 46 * z;
    const gr = ctx.createLinearGradient(0, sy, 0, gy);
    gr.addColorStop(0, `rgba(120,240,255,${0.55 * a})`);
    gr.addColorStop(1, `rgba(60,200,255,${0.18 * a})`);
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(sx - top, sy);
    ctx.lineTo(sx + top, sy);
    ctx.lineTo(gx + bot, gy);
    ctx.ellipse(gx, gy, bot, bot * 0.5, 0, 0, Math.PI);
    ctx.lineTo(gx - bot, gy);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    this.addLight(gx, gy, 110, a);
  }

  // --- post -------------------------------------------------------------------------------
  drawGrade(g) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const warm = g.warmth || 0, apoc = g.apoc || 0;
    if (warm > 0.01) {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = warm * 0.55;
      ctx.fillStyle = '#ff8a2a';
      ctx.fillRect(0, 0, this.W, this.H);
    }
    if (apoc > 0.01) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = apoc * 0.45;
      ctx.fillStyle = '#ff7a5a';
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = apoc * 0.5;
      ctx.fillStyle = '#c0202a';
      ctx.fillRect(0, 0, this.W, this.H);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  drawLighting(g) {
    const dark = this.dark;
    if (dark < 0.02) return;
    const lc = this.lctx;
    const lw = this.light.width, lh = this.light.height;
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = 'source-over';
    lc.globalAlpha = 1;
    lc.clearRect(0, 0, lw, lh);
    const apoc = g.apoc || 0;
    lc.fillStyle = `rgba(${8 + apoc * 30 | 0},${12 + apoc * 4 | 0},${40 - apoc * 18 | 0},${dark * 0.82})`;
    lc.fillRect(0, 0, lw, lh);
    lc.globalCompositeOperation = 'destination-out';
    const L = this.lights;
    for (let i = 0; i < L.length; i += 5) {
      const x = L[i] / 2, y = L[i + 1] / 2, r = L[i + 2] / 2, a = L[i + 3], st = L[i + 4];
      if (x < -r || x > lw + r || y < -r || y > lh + r) continue;
      lc.globalAlpha = Math.min(1, a);
      lc.drawImage(this.lightSprite, x - r, y - r * st, r * 2, r * 2 * st);
    }
    // flashlight cone
    if (this.flash && !g.player.dead) {
      const f = this.flash, z = this.zoom;
      lc.setTransform(1, 0, 0, 1, f.x / 2, f.y / 2);
      lc.rotate(f.ang);
      lc.globalAlpha = 0.9;
      const r = 150 * z / 2;
      lc.drawImage(this.lightSprite, -r * 1.5, -r * 0.6, r * 3, r * 1.2);
      lc.setTransform(1, 0, 0, 1, 0, 0);
    }
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.light, 0, 0, this.W, this.H);
  }

  tiltShift() {
    if (this.quality >= 2) return;
    const ctx = this.ctx;
    const bw = this.cv.width, bh = this.cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const g2 = this.c2.getContext('2d'), g4 = this.c4.getContext('2d'), g8 = this.c8.getContext('2d');
    g2.drawImage(this.cv, 0, 0, this.c2.width, this.c2.height);
    g4.drawImage(this.c2, 0, 0, this.c4.width, this.c4.height);
    g8.drawImage(this.c4, 0, 0, this.c8.width, this.c8.height);
    const bg = this.band.getContext('2d');
    bg.globalCompositeOperation = 'source-over';
    bg.clearRect(0, 0, this.band.width, this.band.height);
    bg.drawImage(this.c8, 0, 0, this.band.width, this.band.height);
    bg.globalCompositeOperation = 'destination-in';
    const h = this.band.height;
    const gr = bg.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(0,0,0,1)');
    gr.addColorStop(0.3, 'rgba(0,0,0,0)');
    gr.addColorStop(0.66, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,1)');
    bg.fillStyle = gr;
    bg.fillRect(0, 0, this.band.width, h);
    ctx.drawImage(this.band, 0, 0, bw, bh);
  }
}

// --- sprite factories -------------------------------------------------------------------------
function makeGlow([r, g, b], hard = 0) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${r},${g},${b},1)`);
  gr.addColorStop(hard ? 0.35 : 0.2, `rgba(${r},${g},${b},${hard ? 0.75 : 0.55})`);
  gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr;
  x.fillRect(0, 0, 64, 64);
  return c;
}

function makeSoft([r, g, b]) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  for (let i = 0; i < 6; i++) {
    const cx = 32 + (Math.random() - 0.5) * 18, cy = 32 + (Math.random() - 0.5) * 18, rr = 14 + Math.random() * 10;
    const gr = x.createRadialGradient(cx, cy, 0, cx, cy, rr);
    gr.addColorStop(0, `rgba(${r},${g},${b},0.5)`);
    gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = gr;
    x.fillRect(0, 0, 64, 64);
  }
  return c;
}

function makeSplat([r, g, b], seed, k = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  x.fillStyle = `rgb(${r},${g},${b})`;
  x.beginPath();
  x.arc(32, 32, 14 * k + 4, 0, Math.PI * 2);
  x.fill();
  for (let i = 0; i < 12; i++) {
    const a = rnd() * Math.PI * 2, d = 10 + rnd() * 18, rr = 2 + rnd() * 5;
    x.beginPath();
    x.arc(32 + Math.cos(a) * d * k, 32 + Math.sin(a) * d * k, rr * k, 0, Math.PI * 2);
    x.fill();
  }
  x.globalCompositeOperation = 'source-atop';
  const gr = x.createRadialGradient(28, 28, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(200,120,255,0.5)');
  gr.addColorStop(1, 'rgba(30,0,40,0.4)');
  x.fillStyle = gr;
  x.fillRect(0, 0, 64, 64);
  return c;
}

function makeScorch() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(15,10,8,0.85)');
  gr.addColorStop(0.5, 'rgba(25,18,12,0.5)');
  gr.addColorStop(1, 'rgba(30,20,10,0)');
  x.fillStyle = gr;
  x.fillRect(0, 0, 64, 64);
  return c;
}

function makeVignette(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.6);
  gr.addColorStop(0, 'rgba(20,10,30,0)');
  gr.addColorStop(1, 'rgba(20,10,30,0.55)');
  x.fillStyle = gr;
  x.fillRect(0, 0, w, h);
  return c;
}

export { COLORS };
