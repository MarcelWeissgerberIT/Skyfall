// Procedural desert town: terrain, props, collisions and enemy path finding.
import { TILE, C, mulberry32, valueNoise, hash2 } from './util.js';

export const N = 72; // map size in tiles
export const WORLD = N * TILE;
export const TT = { SAND: 0, DIRT: 1, GRASS: 2, CONC: 3, ASPH: 4 };

const T0 = 17, PITCH = 12, NB = 3;
const TOWN_A = T0, TOWN_B = T0 + NB * PITCH + 1; // inclusive tile range of the town
const ROADS = [T0, T0 + 12, T0 + 24, T0 + 36]; // each road is two tiles wide
const HIGHWAYS = [T0 + 12, T0 + 24];

const isRoad = (i) => ROADS.some((r) => i === r || i === r + 1);
const isHighway = (i) => HIGHWAYS.some((r) => i === r || i === r + 1);
const inTown = (i, j) => i >= TOWN_A && i <= TOWN_B && j >= TOWN_A && j <= TOWN_B;

// Prop catalogue. box = footprint in tiles (x, y) before flipping; flip swaps it.
// drawW / drawH = sprite size in screen units at zoom 1. base = ground anchor above the
// sprite bottom as a fraction of its height (for non-box props).
export const PROP_DEFS = {
  house_a: { box: [3, 3], drawW: 292 },
  house_b: { box: [3, 3], drawW: 276 },
  house_c: { box: [3, 3], drawW: 292 },
  store: { box: [3, 3], drawW: 258 },
  gas_station: { box: [4, 3], drawW: 338 },
  trailer: { box: [2.1, 1.1], drawW: 186 },
  car_police: { box: [1.75, 0.9], drawW: 134 },
  car_minivan: { box: [1.7, 0.9], drawW: 128 },
  car_pickup: { box: [0.9, 1.75], drawW: 132 },
  car_sheriff: { box: [0.9, 1.75], drawW: 134 },
  car_wreck: { box: [0.9, 1.75], drawW: 132 },
  water_tower: { circle: 22, drawH: 250, base: 0.02 },
  joshua_tree: { circle: 9, drawH: 122, base: 0.03, sway: 0.025 },
  palm: { circle: 8, drawH: 196, base: 0.01, sway: 0.05 },
  rocks: { circle: 34, drawW: 104, base: 0.22 },
  shrub: { drawW: 44, base: 0.2, sway: 0.06 },
  flamingo: { drawH: 42, base: 0.04, sway: 0.09 },
  bin_mailbox: { circle: 11, drawW: 46, base: 0.08 },
  hydrant: { circle: 6, drawH: 26, base: 0.05 },
  streetlight: { circle: 5, drawH: 150, base: 0.02, light: true },
  sandbags: { circle: 26, drawW: 104, base: 0.3 },
  bus: { box: [2.7, 1.0], drawW: 236 },
  car_parked: { circle: 30, drawW: 134, base: 0.32 },
};

// What you find when you rummage through things, and what you can drive.
const SEARCH_KIND = {
  house_a: 'house', house_b: 'house', house_c: 'house', store: 'store', trailer: 'trailer',
  car_minivan: 'car', car_pickup: 'car', car_sheriff: 'car', car_wreck: 'car', bin_mailbox: 'bin',
};

export class World {
  constructor(seed) {
    this.seed = seed;
    this.rnd = mulberry32(seed);
    this.tiles = new Uint8Array(N * N);
    this.solid = new Uint8Array(N * N); // blocks bullets & line of sight
    this.blocked = new Uint8Array(N * N); // blocks path finding / spawning
    this.occ = new Uint8Array(N * N); // generation helper
    this.cgrid = Array.from({ length: N * N }, () => []);
    this.props = [];
    this.decor = []; // props outside the playable map (no collision)
    this.dashes = [];
    this.lootSpots = [];
    this.cows = [];
    this.flow = new Uint16Array(N * N);
    this.flowSrc = -1;
    this.queue = new Int32Array(N * N);
    this.stamp = 1;
    this.start = { x: (T0 + 25) * TILE, y: (T0 + 25) * TILE };
    this.generate();
  }

  r(a = 1, b) {
    return b === undefined ? this.rnd() * a : a + this.rnd() * (b - a);
  }
  ri(a, b) {
    return Math.floor(a + this.rnd() * (b - a + 1));
  }

  // Terrain for any tile, including outside the map (for rendering only).
  terrain(i, j) {
    if (i >= 0 && j >= 0 && i < N && j < N) return this.tiles[j * N + i];
    if (isHighway(i) || isHighway(j)) return TT.ASPH;
    return TT.SAND;
  }

  generate() {
    const s = this.seed;
    // Base desert + town grid.
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        let t = TT.SAND;
        if (inTown(i, j)) {
          if (isRoad(i) || isRoad(j)) t = TT.ASPH;
          else t = TT.CONC; // sidewalks; block interiors are overwritten below
        } else if (isHighway(i) || isHighway(j)) t = TT.ASPH;
        this.tiles[j * N + i] = t;
      }
    }
    // Reserve roads & sidewalks.
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const t = this.tiles[j * N + i];
        if (t === TT.ASPH || (inTown(i, j) && t === TT.CONC)) this.occ[j * N + i] = 1;
      }

    // Town blocks.
    const kinds = [];
    for (let b = 0; b < NB * NB; b++) kinds.push('res');
    kinds[4] = 'plaza';
    const others = [0, 1, 2, 3, 5, 6, 7, 8];
    kinds[others[this.ri(0, others.length - 1)]] = 'outpost';
    for (let bj = 0; bj < NB; bj++)
      for (let bi = 0; bi < NB; bi++) {
        const bx = T0 + bi * PITCH + 3, by = T0 + bj * PITCH + 3;
        const k = kinds[bj * NB + bi];
        if (k === 'res') this.genResidential(bx, by);
        else if (k === 'plaza') this.genPlaza(bx, by);
        else this.genOutpost(bx, by);
      }

    this.genStreets();
    this.genDesert();
    this.genDashes();
    this.genPatches();
    this.finalize();
  }

  setTile(i, j, t) {
    if (i >= 0 && j >= 0 && i < N && j < N) this.tiles[j * N + i] = t;
  }
  free(i, j) {
    return i >= 0 && j >= 0 && i < N && j < N && !this.occ[j * N + i];
  }
  freeRect(i, j, w, h) {
    for (let y = j; y < j + h; y++) for (let x = i; x < i + w; x++) if (!this.free(x, y)) return false;
    return true;
  }
  occupy(i, j, w = 1, h = 1) {
    for (let y = j; y < j + h; y++) for (let x = i; x < i + w; x++) if (x >= 0 && y >= 0 && x < N && y < N) this.occ[y * N + x] = 1;
  }

  addProp(type, x, y, flip = false, decorOnly = false) {
    const def = PROP_DEFS[type];
    const p = { type, sprite: type, x, y, flip, def, depth: x + y };
    if (def.box) {
      let [bw, bh] = def.box;
      if (flip) [bw, bh] = [bh, bw];
      const wx = bw * TILE, wy = bh * TILE;
      p.box = { x0: x - wx / 2, y0: y - wy / 2, x1: x + wx / 2, y1: y + wy / 2 };
      p.baseOff = (wx + wy) * C * 0.25;
      // Sort by the front corner so characters standing beside the box sort correctly.
      p.depth = x + y;
    } else if (def.circle) {
      p.circle = def.circle;
    }
    if (decorOnly || x < 0 || y < 0 || x >= N * TILE || y >= N * TILE) {
      this.decor.push(p);
      return p;
    }
    this.props.push(p);
    if (p.box || p.circle) this.registerCollider(p);
    if (SEARCH_KIND[type]) p.search = SEARCH_KIND[type];
    if (type === 'car_police') p.drivable = true;
    if (type === 'gas_station') p.riggable = true;
    return p;
  }

  // Remove a prop (e.g. a car somebody just drove off with) and its collision.
  removeProp(p) {
    const i = this.props.indexOf(p);
    if (i >= 0) this.props.splice(i, 1);
    if (!p.box && !p.circle) return;
    let x0, y0, x1, y1;
    if (p.box) ({ x0, y0, x1, y1 } = p.box);
    else (x0 = p.x - p.circle, y0 = p.y - p.circle, x1 = p.x + p.circle, y1 = p.y + p.circle);
    const i0 = Math.max(0, Math.floor(x0 / TILE)), i1 = Math.min(N - 1, Math.floor(x1 / TILE));
    const j0 = Math.max(0, Math.floor(y0 / TILE)), j1 = Math.min(N - 1, Math.floor(y1 / TILE));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const k = j * N + i;
        const list = this.cgrid[k];
        const at = list.indexOf(p);
        if (at >= 0) list.splice(at, 1);
        const cx = (i + 0.5) * TILE, cy = (j + 0.5) * TILE;
        let solid = 0, blocked = 0;
        for (const q of list) {
          if (q.box && cx > q.box.x0 && cx < q.box.x1 && cy > q.box.y0 && cy < q.box.y1) solid = blocked = 1;
          else if (q.circle >= 20 && i === Math.floor(q.x / TILE) && j === Math.floor(q.y / TILE)) blocked = 1;
        }
        this.solid[k] = solid;
        this.blocked[k] = blocked;
      }
    this.flowSrc = -1;
  }

  // Put a car back into the world after a joyride (any heading -> round collider).
  parkCar(x, y, sprite, flip, drawW, base) {
    const p = this.addProp('car_parked', x, y, flip);
    p.sprite = sprite;
    p.drawW = drawW;
    p.base = base;
    p.drivable = true;
    p.depth = x + y;
    this.flowSrc = -1;
    return p;
  }

  registerCollider(p) {
    let x0, y0, x1, y1;
    if (p.box) ({ x0, y0, x1, y1 } = p.box);
    else (x0 = p.x - p.circle, y0 = p.y - p.circle, x1 = p.x + p.circle, y1 = p.y + p.circle);
    const i0 = Math.max(0, Math.floor(x0 / TILE)), i1 = Math.min(N - 1, Math.floor(x1 / TILE));
    const j0 = Math.max(0, Math.floor(y0 / TILE)), j1 = Math.min(N - 1, Math.floor(y1 / TILE));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        this.cgrid[j * N + i].push(p);
        const cx = (i + 0.5) * TILE, cy = (j + 0.5) * TILE;
        if (p.box) {
          if (cx > x0 && cx < x1 && cy > y0 && cy < y1) this.solid[j * N + i] = this.blocked[j * N + i] = 1;
        } else if (p.circle >= 20 && i === Math.floor(p.x / TILE) && j === Math.floor(p.y / TILE)) {
          this.blocked[j * N + i] = 1;
        }
      }
  }

  genResidential(bx, by) {
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) this.setTile(bx + i, by + j, TT.GRASS);
    const houses = ['house_a', 'house_b', 'house_c'];
    for (let ly = 0; ly < 2; ly++)
      for (let lx = 0; lx < 2; lx++) {
        if (this.rnd() < 0.08) continue; // empty lot
        const ox = bx + lx * 4 + this.ri(0, 1), oy = by + ly * 4 + this.ri(0, 1);
        this.addProp(houses[this.ri(0, 2)], (ox + 1.5) * TILE, (oy + 1.5) * TILE, this.rnd() < 0.5);
        this.occupy(ox, oy, 3, 3);
      }
    this.decorateBlock(bx, by, { palms: 0.22, cars: 2, bins: 2 });
  }

  genPlaza(bx, by) {
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) this.setTile(bx + i, by + j, TT.CONC);
    const sflip = this.rnd() < 0.5;
    this.addProp('store', (bx + 1.5) * TILE, (by + 1.5) * TILE, sflip);
    this.occupy(bx, by, 3, 3);
    this.addProp('gas_station', (bx + 6) * TILE, (by + 6.5) * TILE, false);
    this.occupy(bx + 4, by + 5, 4, 3);
    this.decorateBlock(bx, by, { palms: 0.12, cars: 3, bins: 1 });
  }

  genOutpost(bx, by) {
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) this.setTile(bx + i, by + j, TT.DIRT);
    this.addProp('trailer', (bx + 1.05) * TILE + 34, (by + 1.05) * TILE + 2, false);
    this.occupy(bx, by, 3, 2);
    const cx = (bx + 4.5) * TILE, cy = (by + 4.5) * TILE;
    for (let k = 0; k < 7; k++) {
      if (k === 2) continue; // gap to walk through
      const a = (k / 7) * Math.PI * 2;
      const x = cx + Math.cos(a) * 150, y = cy + Math.sin(a) * 150;
      this.addProp('sandbags', x, y, Math.cos(a) < 0);
      this.occupy(Math.floor(x / TILE), Math.floor(y / TILE));
    }
    this.lootSpots.push({ x: cx, y: cy, w: 3 }, { x: cx + 40, y: cy - 30, w: 3 });
    // the evac bus parks at the curb on the fort's north side; survivors are dropped off next to it
    this.addProp('bus', (bx + 4.5) * TILE, (by - 0.5) * TILE, false);
    this.reserved = new Set();
    for (let i = bx + 3; i < bx + 6; i++) this.reserved.add((by - 1) * N + i);
    this.evac = { x: (bx + 4.5) * TILE, y: (by + 1.0) * TILE };
    this.decorateBlock(bx, by, { palms: 0, cars: 2, bins: 0, police: true });
  }

  decorateBlock(bx, by, o) {
    const cars = o.police ? ['car_police', 'car_sheriff'] : ['car_minivan', 'car_pickup', 'car_police', 'car_minivan', 'car_wreck'];
    let placed = 0;
    for (let tries = 0; tries < 40 && placed < o.cars; tries++) {
      const i = bx + this.ri(0, 7), j = by + this.ri(0, 7);
      const alongX = this.rnd() < 0.5;
      const w = alongX ? 2 : 1, h = alongX ? 1 : 2;
      if (i + w > bx + 8 || j + h > by + 8 || !this.freeRect(i, j, w, h)) continue;
      const type = cars[this.ri(0, cars.length - 1)];
      const nativeX = PROP_DEFS[type].box[0] > PROP_DEFS[type].box[1];
      this.addProp(type, (i + w / 2) * TILE, (j + h / 2) * TILE, nativeX !== alongX);
      this.occupy(i, j, w, h);
      if (this.tiles[j * N + i] === TT.GRASS) {
        for (let y = j; y < j + h; y++) for (let x = i; x < i + w; x++) this.setTile(x, y, TT.CONC);
      }
      placed++;
    }
    for (let j = 0; j < 8; j++)
      for (let i = 0; i < 8; i++) {
        const x = bx + i, y = by + j;
        if (!this.free(x, y)) continue;
        const r = this.rnd();
        const edge = i === 0 || j === 0 || i === 7 || j === 7;
        if (r < o.palms) {
          this.addProp('palm', (x + 0.5) * TILE + this.r(-14, 14), (y + 0.5) * TILE + this.r(-14, 14), this.rnd() < 0.5);
          this.occupy(x, y);
        } else if (edge && r < o.palms + 0.06 && o.bins) {
          this.addProp('bin_mailbox', (x + 0.5) * TILE, (y + 0.5) * TILE, this.rnd() < 0.5);
          this.occupy(x, y);
        } else if (o.bins && r < o.palms + 0.13) {
          // a little flock of plastic flamingos
          const n = this.ri(1, 3);
          for (let f = 0; f < n; f++) this.addProp('flamingo', (x + 0.25 + f * 0.25) * TILE, (y + 0.3 + this.r(0, 0.4)) * TILE, this.rnd() < 0.5);
        } else if (r > 0.93) {
          this.lootSpots.push({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, w: 1 });
        }
      }
  }

  genStreets() {
    // Street lights and hydrants along the sidewalks.
    for (let j = TOWN_A; j <= TOWN_B; j++)
      for (let i = TOWN_A; i <= TOWN_B; i++) {
        const t = this.tiles[j * N + i];
        if (t !== TT.CONC || isRoad(i) || isRoad(j)) continue;
        if (this.reserved && this.reserved.has(j * N + i)) continue;
        const sideI = ROADS.some((r) => i === r - 1 || i === r + 2);
        const sideJ = ROADS.some((r) => j === r - 1 || j === r + 2);
        if (!sideI && !sideJ) continue;
        if (sideI && sideJ) continue; // corners
        const along = sideI ? j : i;
        if (along % 5 === 2) this.addProp('streetlight', (i + 0.5) * TILE, (j + 0.5) * TILE, sideI ? i % 2 === 0 : j % 2 === 1);
        else if (hash2(i, j, this.seed) < 0.035) this.addProp('hydrant', (i + 0.5) * TILE, (j + 0.5) * TILE);
      }
    // Abandoned vehicles on the roads.
    const cars = ['car_police', 'car_sheriff', 'car_pickup', 'car_minivan', 'car_wreck', 'car_wreck'];
    for (let n = 0; n < 10; n++) {
      const r = ROADS[this.ri(0, ROADS.length - 1)];
      const lane = r + this.ri(0, 1);
      const pos = this.ri(TOWN_A + 3, TOWN_B - 4);
      if (isRoad(pos) || isRoad(pos + 1)) continue;
      const alongX = this.rnd() < 0.5;
      const type = cars[this.ri(0, cars.length - 1)];
      const nativeX = PROP_DEFS[type].box[0] > PROP_DEFS[type].box[1];
      const i = alongX ? pos : lane, j = alongX ? lane : pos;
      const w = alongX ? 2 : 1, h = alongX ? 1 : 2;
      if (this.occ2(i, j, w, h)) continue;
      this.addProp(type, (i + w / 2) * TILE, (j + h / 2) * TILE, nativeX !== alongX);
      this.markCar(i, j, w, h);
    }
  }
  occ2(i, j, w, h) {
    this.carOcc = this.carOcc || new Set();
    for (let y = j; y < j + h; y++) for (let x = i; x < i + w; x++) if (this.carOcc.has(y * N + x)) return true;
    return false;
  }
  markCar(i, j, w, h) {
    for (let y = j; y < j + h; y++) for (let x = i; x < i + w; x++) this.carOcc.add(y * N + x);
  }

  genDesert() {
    const M = 12;
    for (let j = -M; j < N + M; j++)
      for (let i = -M; i < N + M; i++) {
        if (inTown(i, j) || isHighway(i) || isHighway(j)) continue;
        const inside = i >= 0 && j >= 0 && i < N && j < N;
        if (inside && !this.free(i, j)) continue;
        // Keep a margin around town clear-ish.
        const nearTown = i > TOWN_A - 3 && i < TOWN_B + 3 && j > TOWN_A - 3 && j < TOWN_B + 3;
        const r = hash2(i, j, this.seed + 7);
        const x = (i + 0.5) * TILE + (hash2(i, j, this.seed + 3) - 0.5) * 30;
        const y = (j + 0.5) * TILE + (hash2(i, j, this.seed + 5) - 0.5) * 30;
        const flip = hash2(i, j, this.seed + 9) < 0.5;
        let type = null;
        if (r < 0.022) type = 'joshua_tree';
        else if (r < 0.034 && !nearTown) type = 'rocks';
        else if (r < 0.08) type = 'shrub';
        else if (r < 0.0825 && inside && !nearTown) type = 'car_wreck';
        if (!type) continue;
        this.addProp(type, x, y, flip, !inside);
        if (inside) this.occupy(i, j);
      }
    // Landmarks inside the playable desert.
    const spots = (n, fn) => {
      for (let k = 0, tries = 0; k < n && tries < 200; tries++) {
        const i = this.ri(3, N - 5), j = this.ri(3, N - 5);
        if (inTown(i - 2, j - 2) || inTown(i + 3, j + 3) || inTown(i, j)) continue;
        if (!this.freeRect(i, j, 3, 3)) continue;
        if (isHighway(i) || isHighway(j) || isHighway(i + 2) || isHighway(j + 2)) continue;
        fn(i, j);
        this.occupy(i, j, 3, 3);
        k++;
      }
    };
    spots(2, (i, j) => this.addProp('water_tower', (i + 1.5) * TILE, (j + 1.5) * TILE));
    spots(3, (i, j) => {
      this.addProp('trailer', (i + 1.5) * TILE, (j + 1) * TILE, this.rnd() < 0.5);
      this.lootSpots.push({ x: (i + 1.5) * TILE, y: (j + 2.4) * TILE, w: 2 });
    });
    spots(3, (i, j) => {
      const cx = (i + 1.5) * TILE, cy = (j + 1.5) * TILE;
      this.addProp('sandbags', cx - 50, cy + 30, false);
      this.addProp('sandbags', cx + 50, cy - 30, true);
      this.lootSpots.push({ x: cx, y: cy, w: 2 });
    });
    spots(3, (i, j) => {
      for (let k = 0; k < 4; k++) this.cows.push({ x: (i + 0.3 + this.r(0, 2.4)) * TILE, y: (j + 0.3 + this.r(0, 2.4)) * TILE });
    });
  }

  genPatches() {
    this.patches = [];
    for (let j = -14; j < N + 14; j += 1)
      for (let i = -14; i < N + 14; i += 1) {
        if (inTown(i, j) || isHighway(i) || isHighway(j)) continue;
        const n = valueNoise(i / 5, j / 5, this.seed);
        if (n < 0.58 || hash2(i, j, this.seed + 11) > 0.55) continue;
        const r = TILE * (0.6 + (n - 0.58) * 5) * (0.7 + hash2(i, j, this.seed + 13) * 0.6);
        this.patches.push({ x: (i + hash2(i, j, this.seed + 17)) * TILE, y: (j + hash2(i, j, this.seed + 19)) * TILE, r });
      }
  }

  genDashes() {
    const lo = -14, hi = N + 14;
    for (const r of ROADS) {
      const hw = HIGHWAYS.includes(r);
      const a = hw ? lo : TOWN_A, b = hw ? hi : TOWN_B;
      const line = (r + 1) * TILE;
      for (let k = a; k <= b; k++) {
        if (isRoad(k) && (hw ? true : true) && (inTown(k, k) || HIGHWAYS.some((h) => k === h || k === h + 1))) continue;
        // horizontal road (constant y) and vertical road (constant x)
        this.dashes.push({ x0: k * TILE + 14, y0: line - 2, x1: k * TILE + 50, y1: line + 2 });
        this.dashes.push({ x0: line - 2, y0: k * TILE + 14, x1: line + 2, y1: k * TILE + 50 });
      }
    }
  }

  finalize() {
    // Mark unreachable cells as blocked so nothing spawns where it cannot be reached.
    const si = Math.floor(this.start.x / TILE), sj = Math.floor(this.start.y / TILE);
    this.updateFlow(this.start.x, this.start.y, true);
    for (let k = 0; k < N * N; k++) if (this.flow[k] === 65535) this.blocked[k] = 1;
    this.lootSpots = this.lootSpots.filter((s) => !this.blocked[Math.floor(s.y / TILE) * N + Math.floor(s.x / TILE)]);
    this.props.sort((a, b) => a.depth - b.depth);
    this.lights = this.props.filter((p) => p.def.light);
    this.flowSrc = -1;
    void si, sj;
  }

  // --- runtime queries -------------------------------------------------------

  tileIndex(x, y) {
    const i = Math.floor(x / TILE), j = Math.floor(y / TILE);
    if (i < 0 || j < 0 || i >= N || j >= N) return -1;
    return j * N + i;
  }

  isSolidAt(x, y) {
    const k = this.tileIndex(x, y);
    return k >= 0 && this.solid[k] === 1;
  }

  isWalkable(x, y) {
    const k = this.tileIndex(x, y);
    return k >= 0 && !this.blocked[k];
  }

  // Precise point-in-collider test (used for bullets).
  hitProp(x, y) {
    const k = this.tileIndex(x, y);
    if (k < 0) return null;
    for (const p of this.cgrid[k]) {
      if (p.box) {
        if (x > p.box.x0 && x < p.box.x1 && y > p.box.y0 && y < p.box.y1) return p;
      } else if (p.circle >= 14) {
        const dx = x - p.x, dy = y - p.y;
        if (dx * dx + dy * dy < p.circle * p.circle) return p;
      }
    }
    return null;
  }

  los(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0;
    const d = Math.hypot(dx, dy);
    const steps = Math.ceil(d / 24);
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      if (this.isSolidAt(x0 + dx * t, y0 + dy * t)) return false;
    }
    return true;
  }

  // Push a circle entity out of colliders and keep it inside the map.
  collide(e) {
    const stamp = ++this.stamp;
    const ti = Math.floor(e.x / TILE), tj = Math.floor(e.y / TILE);
    for (let j = tj - 1; j <= tj + 1; j++) {
      if (j < 0 || j >= N) continue;
      for (let i = ti - 1; i <= ti + 1; i++) {
        if (i < 0 || i >= N) continue;
        const list = this.cgrid[j * N + i];
        for (let n = 0; n < list.length; n++) {
          const p = list[n];
          if (p.stamp === stamp) continue;
          p.stamp = stamp;
          if (p.box) {
            const b = p.box;
            const nx = Math.max(b.x0, Math.min(e.x, b.x1));
            const ny = Math.max(b.y0, Math.min(e.y, b.y1));
            let dx = e.x - nx, dy = e.y - ny;
            const d2 = dx * dx + dy * dy;
            if (d2 < e.r * e.r) {
              if (d2 > 1e-6) {
                const d = Math.sqrt(d2);
                e.x = nx + (dx / d) * e.r;
                e.y = ny + (dy / d) * e.r;
              } else {
                // centre inside the box: push out along the shallowest axis
                const l = e.x - b.x0, r = b.x1 - e.x, t = e.y - b.y0, bt = b.y1 - e.y;
                const m = Math.min(l, r, t, bt);
                if (m === l) e.x = b.x0 - e.r;
                else if (m === r) e.x = b.x1 + e.r;
                else if (m === t) e.y = b.y0 - e.r;
                else e.y = b.y1 + e.r;
              }
            }
          } else if (p.circle) {
            const dx = e.x - p.x, dy = e.y - p.y;
            const rr = e.r + p.circle;
            const d2 = dx * dx + dy * dy;
            if (d2 < rr * rr && d2 > 1e-6) {
              const d = Math.sqrt(d2);
              e.x = p.x + (dx / d) * rr;
              e.y = p.y + (dy / d) * rr;
            }
          }
        }
      }
    }
    const lim = N * TILE;
    if (e.x < e.r) e.x = e.r;
    if (e.y < e.r) e.y = e.r;
    if (e.x > lim - e.r) e.x = lim - e.r;
    if (e.y > lim - e.r) e.y = lim - e.r;
  }

  // Breadth-first distance field from the player's tile.
  updateFlow(px, py, force = false) {
    const src = this.tileIndex(px, py);
    if (src < 0 || (!force && src === this.flowSrc)) return;
    this.flowSrc = src;
    const flow = this.flow, q = this.queue, blocked = this.blocked;
    flow.fill(65535);
    let head = 0, tail = 0;
    flow[src] = 0;
    q[tail++] = src;
    while (head < tail) {
      const k = q[head++];
      const i = k % N, j = (k / N) | 0;
      const d = flow[k] + 1;
      for (let dj = -1; dj <= 1; dj++) {
        const y = j + dj;
        if (y < 0 || y >= N) continue;
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const x = i + di;
          if (x < 0 || x >= N) continue;
          const n = y * N + x;
          if (blocked[n] || flow[n] <= d) continue;
          if (di && dj && (blocked[j * N + x] || blocked[y * N + i])) continue;
          flow[n] = d;
          q[tail++] = n;
        }
      }
    }
  }

  // Direction towards the player along the distance field (null = chase directly).
  flowDir(x, y) {
    const i = Math.floor(x / TILE), j = Math.floor(y / TILE);
    if (i < 0 || j < 0 || i >= N || j >= N) return null;
    const here = this.flow[j * N + i];
    if (here <= 1) return null;
    let best = here, bi = -1, bj = -1;
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        const x2 = i + di, y2 = j + dj;
        if (x2 < 0 || y2 < 0 || x2 >= N || y2 >= N) continue;
        const v = this.flow[y2 * N + x2];
        if (v < best) (best = v), (bi = x2), (bj = y2);
      }
    if (bi < 0) return null;
    const tx = (bi + 0.5) * TILE - x, ty = (bj + 0.5) * TILE - y;
    const l = Math.hypot(tx, ty) || 1;
    return [tx / l, ty / l];
  }

  // Random walkable spot at a distance band around a point.
  randomSpot(cx, cy, minD, maxD, tries = 30) {
    for (let t = 0; t < tries; t++) {
      const a = Math.random() * Math.PI * 2, d = minD + Math.random() * (maxD - minD);
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      if (x < TILE || y < TILE || x > (N - 1) * TILE || y > (N - 1) * TILE) continue;
      if (this.isWalkable(x, y)) return { x, y };
    }
    return null;
  }
}
