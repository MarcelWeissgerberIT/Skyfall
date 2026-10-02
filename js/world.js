// Pine Bluff, Nevada: a desert town under new (alien) management. Fixed districts so the story can
// send Dale places, procedural details so no two playthroughs look the same.
import { TILE, C, mulberry32, valueNoise, hash2 } from './util.js';

export const N = 96; // map size in tiles
export const WORLD = N * TILE;
export const TT = { SAND: 0, DIRT: 1, GRASS: 2, CONC: 3, ASPH: 4 };

const T0 = 29, PITCH = 12, NB = 3;
const TOWN_A = T0, TOWN_B = T0 + NB * PITCH + 1; // inclusive tile range of the town
const ROADS = [T0, T0 + 12, T0 + 24, T0 + 36]; // each road is two tiles wide
const HIGHWAYS = [T0 + 12, T0 + 24];
// the Network's studio lot sits north of town and swallows the northern highway
export const LOT = { x0: 44, y0: 4, x1: 64, y1: 24 };

const isRoad = (i) => ROADS.some((r) => i === r || i === r + 1);
const isHighway = (i) => HIGHWAYS.some((r) => i === r || i === r + 1);
const inTown = (i, j) => i >= TOWN_A && i <= TOWN_B && j >= TOWN_A && j <= TOWN_B;
const inLot = (i, j) => i >= LOT.x0 && i <= LOT.x1 && j >= LOT.y0 && j <= LOT.y1;

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
  joshua_tree: { circle: 9, drawH: 122, base: 0.03, sway: 0.025, breakable: 9000 },
  palm: { circle: 8, drawH: 196, base: 0.01, sway: 0.05, breakable: 3500 },
  rocks: { circle: 34, drawW: 104, base: 0.22 },
  shrub: { circle: 6, drawW: 44, base: 0.2, sway: 0.06, breakable: 15, soft: true },
  flamingo: { circle: 5, drawH: 42, base: 0.04, sway: 0.09, breakable: 49, soft: true },
  bin_mailbox: { circle: 11, drawW: 46, base: 0.08, breakable: 180 },
  hydrant: { circle: 6, drawH: 26, base: 0.05, breakable: 2500 },
  streetlight: { circle: 5, drawH: 150, base: 0.02, light: true, breakable: 4200 },
  sandbags: { circle: 26, drawW: 104, base: 0.3 },
  bus: { box: [2.7, 1.0], drawW: 236 },
  // --- the adventure ---
  tower: { box: [2.6, 2.6], drawW: 330, glow: 'magenta' },
  drive_in: { box: [3.2, 1.6], drawW: 330 },
  net_trailer: { box: [3, 1.4], drawW: 300 },
  checkpoint: { box: [1.6, 1.0], drawW: 210 },
  pylon: { circle: 8, drawH: 74, base: 0.02 },
  church: { box: [3, 3], drawW: 300 },
  clubhouse: { box: [4, 3], drawW: 340 },
  diner: { box: [4, 2], drawW: 330 },
  motel: { box: [5, 2], drawW: 370 },
  saloon: { box: [4, 3], drawW: 340 },
  bunker: { box: [2, 2], drawW: 196 },
  sheriff_office: { box: [3, 3], drawW: 280 },
  billboard_a: { box: [2, 0.6], drawW: 220 },
  billboard_b: { box: [2, 0.6], drawW: 220 },
  burn_barrel: { circle: 12, drawH: 40, base: 0.04, fire: true },
  barricade: { box: [3, 1], drawW: 210 },
  phone_booth: { circle: 12, drawH: 82, base: 0.03 },
  icecream: { box: [1.75, 0.9], drawW: 142 },
  porta_potty: { circle: 14, drawH: 80, base: 0.03 },
  speaker_pole: { circle: 6, drawH: 150, base: 0.02 },
  crashed_ufo: { box: [3, 3], drawW: 290 },
  saguaro: { circle: 9, drawH: 132, base: 0.02, sway: 0.01, breakable: 12000 },
  junk_pile: { box: [2, 2], drawW: 200 },
  gnome: { circle: 4, drawH: 24, base: 0.04, breakable: 30, soft: true },
  landed_ufo: { box: [2.4, 2.4], drawW: 200 },
  wall: { invisible: true },
};

// Prop type -> [front points along +x when unflipped, vehicle type]
const DRIVABLE = {
  car_police: [true, 'police'], car_minivan: [true, 'minivan'], car_sheriff: [false, 'sheriff'], car_pickup: [false, 'pickup'],
};

// What you find when you rummage through things.
const SEARCH_KIND = {
  house_a: 'house', house_b: 'house', house_c: 'house', store: 'store', trailer: 'trailer',
  car_wreck: 'car', bin_mailbox: 'bin', porta_potty: 'potty', junk_pile: 'junk', crashed_ufo: 'ufo', motel: 'motel',
};

// Buildings with an interior scene: prop type -> scene id
export const DOORS = {
  bunker: 'bunker', diner: 'diner', church: 'church', clubhouse: 'clubhouse', saloon: 'saloon',
  net_trailer: 'office', sheriff_office: 'sheriff', tower: 'control',
};

export class World {
  constructor(seed) {
    this.seed = seed;
    this.rnd = mulberry32(seed);
    this.tiles = new Uint8Array(N * N);
    this.solid = new Uint8Array(N * N); // blocks line of sight
    this.blocked = new Uint8Array(N * N); // blocks path finding / spawning
    this.occ = new Uint8Array(N * N); // generation helper
    this.cgrid = Array.from({ length: N * N }, () => []);
    this.props = [];
    this.decor = []; // props outside the playable map (no collision)
    this.dashes = [];
    this.lootSpots = [];
    this.cows = [];
    this.parkedCars = [];
    this.pools = [];
    this.circles = []; // crop circles
    this.stains = [];
    this.fences = [];
    this.doors = [];
    this.landmarks = [];
    this.spawns = { hoa: [], rats: [], church: [], network: [] };
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
    if (j < 0 && (i === 53 || i === 54)) return TT.SAND;
    if (isHighway(i) || isHighway(j)) return TT.ASPH;
    return TT.SAND;
  }

  generate() {
    // Base desert + town grid + highways.
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        let t = TT.SAND;
        if (inTown(i, j)) {
          if (isRoad(i) || isRoad(j)) t = TT.ASPH;
          else t = TT.CONC; // sidewalks; block interiors are overwritten below
        } else if (isHighway(i) || isHighway(j)) t = TT.ASPH;
        // the northern highway ends at the studio gate
        if ((i === 53 || i === 54) && j < LOT.y0) t = TT.SAND;
        this.tiles[j * N + i] = t;
      }
    }
    // Reserve roads & sidewalks.
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const t = this.tiles[j * N + i];
        if (t === TT.ASPH || (inTown(i, j) && t === TT.CONC)) this.occ[j * N + i] = 1;
      }

    // Town blocks: the north row is the HOA's gated paradise.
    const kinds = ['clubhouse', 'estate', 'estate', 'kevin', 'plaza', 'sheriff', 'res', 'strip', 'res'];
    for (let bj = 0; bj < NB; bj++)
      for (let bi = 0; bi < NB; bi++) {
        const bx = T0 + bi * PITCH + 3, by = T0 + bj * PITCH + 3;
        const k = kinds[bj * NB + bi];
        if (k === 'res') this.genResidential(bx, by);
        else if (k === 'estate') this.genResidential(bx, by, true);
        else if (k === 'clubhouse') this.genClubhouse(bx, by);
        else if (k === 'kevin') this.genKevin(bx, by);
        else if (k === 'plaza') this.genPlaza(bx, by);
        else if (k === 'sheriff') this.genSheriff(bx, by);
        else if (k === 'strip') this.genStrip(bx, by);
      }

    this.genLot();
    this.genJunkyard();
    this.genChurch();
    this.genRanch();
    this.genStreets();
    this.genRoadside();
    this.genDesert();
    this.genDashes();
    this.genPatches();
    this.genRoadGraph();
    this.finalize();
  }

  setTile(i, j, t) {
    if (i >= 0 && j >= 0 && i < N && j < N) this.tiles[j * N + i] = t;
  }
  fillTiles(i0, j0, i1, j1, t, keepRoads = true) {
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        if (keepRoads && this.terrain(i, j) === TT.ASPH) continue;
        this.setTile(i, j, t);
      }
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
  // place a prop by tile coordinates of its footprint centre and reserve the tiles
  place(type, ci, cj, flip = false, reserve = true) {
    const def = PROP_DEFS[type];
    const p = this.addProp(type, ci * TILE, cj * TILE, flip);
    if (reserve) {
      if (def.box) {
        let [bw, bh] = def.box;
        if (flip) [bw, bh] = [bh, bw];
        this.occupy(Math.floor(ci - bw / 2), Math.floor(cj - bh / 2), Math.ceil(bw) + 1, Math.ceil(bh) + 1);
      } else this.occupy(Math.floor(ci), Math.floor(cj));
    }
    return p;
  }

  addProp(type, x, y, flip = false, decorOnly = false) {
    const def = PROP_DEFS[type];
    const vt = DRIVABLE[type];
    if (vt && !decorOnly && x >= 0 && y >= 0 && x < N * TILE && y < N * TILE) {
      // drivable cars are simulated as vehicles; remember where they are parked
      const [nativeX] = vt;
      let h = (nativeX ? 0 : Math.PI / 2) + (flip ? (nativeX ? Math.PI / 2 : -Math.PI / 2) : 0);
      if (this.rnd() < 0.5) h += Math.PI;
      this.parkedCars.push({ type: vt[1], x, y, h });
      return null;
    }
    const p = { type, sprite: type, x, y, flip, def, depth: x + y };
    if (def.box) {
      let [bw, bh] = def.box;
      if (flip) [bw, bh] = [bh, bw];
      const wx = bw * TILE, wy = bh * TILE;
      p.box = { x0: x - wx / 2, y0: y - wy / 2, x1: x + wx / 2, y1: y + wy / 2 };
      p.baseOff = (wx + wy) * C * 0.25;
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
    if (type === 'gas_station') p.riggable = true;
    if (def.breakable) p.breakable = def.breakable;
    if (DOORS[type]) {
      p.scene = DOORS[type];
      // the door is in front of the building's nearest corner
      const d = { scene: p.scene, prop: p, x: p.box.x1 + 22, y: p.box.y1 + 22 };
      p.door = d;
      this.doors.push(d);
    }
    return p;
  }

  // Invisible collision walls (fences, force fields).
  addWall(x0, y0, x1, y1, tag) {
    const p = { type: 'wall', sprite: null, x: (x0 + x1) / 2, y: (y0 + y1) / 2, flip: false, def: PROP_DEFS.wall, depth: 0, tag };
    p.box = { x0, y0, x1, y1 };
    this.props.push(p);
    this.registerCollider(p);
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

  registerCollider(p) {
    let x0, y0, x1, y1;
    if (p.box) ({ x0, y0, x1, y1 } = p.box);
    else (x0 = p.x - p.circle, y0 = p.y - p.circle, x1 = p.x + p.circle, y1 = p.y + p.circle);
    const i0 = Math.max(0, Math.floor(x0 / TILE)), i1 = Math.min(N - 1, Math.floor(x1 / TILE));
    const j0 = Math.max(0, Math.floor(y0 / TILE)), j1 = Math.min(N - 1, Math.floor(y1 / TILE));
    const thin = p.box && (x1 - x0 < TILE || y1 - y0 < TILE);
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        this.cgrid[j * N + i].push(p);
        const cx = (i + 0.5) * TILE, cy = (j + 0.5) * TILE;
        if (p.box) {
          if (thin) {
            // thin walls block path finding in every tile they touch
            if (p.def.invisible) this.blocked[j * N + i] = 1;
          } else if (cx > x0 && cx < x1 && cy > y0 && cy < y1) this.solid[j * N + i] = this.blocked[j * N + i] = 1;
        } else if (p.circle >= 20 && i === Math.floor(p.x / TILE) && j === Math.floor(p.y / TILE)) {
          this.blocked[j * N + i] = 1;
        }
      }
  }

  landmark(id, name, x, y, icon) {
    const l = { id, name, x, y, icon };
    this.landmarks.push(l);
    return l;
  }

  // --- town blocks ---------------------------------------------------------------------------
  genResidential(bx, by, estate = false) {
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) this.setTile(bx + i, by + j, TT.GRASS);
    const houses = ['house_a', 'house_b', 'house_c'];
    for (let ly = 0; ly < 2; ly++)
      for (let lx = 0; lx < 2; lx++) {
        if (!estate && this.rnd() < 0.08) continue; // empty lot
        const ox = bx + lx * 4 + this.ri(0, 1), oy = by + ly * 4 + this.ri(0, 1);
        this.addProp(houses[this.ri(0, 2)], (ox + 1.5) * TILE, (oy + 1.5) * TILE, this.rnd() < 0.5);
        this.occupy(ox, oy, 3, 3);
      }
    this.decorateBlock(bx, by, { palms: estate ? 0.12 : 0.22, cars: estate ? 1 : 2, bins: 2, flamingos: estate ? 0.2 : 0.07, gnomes: estate ? 0.05 : 0 });
    if (estate) this.spawns.hoa.push({ x: (bx + 4) * TILE, y: (by + 4) * TILE });
  }

  genClubhouse(bx, by) {
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) this.setTile(bx + i, by + j, TT.GRASS);
    const p = this.addProp('clubhouse', (bx + 3) * TILE, (by + 2.5) * TILE, false);
    this.occupy(bx, by, 6, 5);
    // the pool, where nobody has been allowed to swim since 1994
    this.fillTiles(bx + 1, by + 5, bx + 6, by + 7, TT.CONC);
    this.pools.push({ x0: (bx + 1.6) * TILE, y0: (by + 5.5) * TILE, x1: (bx + 5.6) * TILE, y1: (by + 7.3) * TILE });
    this.occupy(bx + 1, by + 5, 6, 3);
    for (let k = 0; k < 6; k++) this.addProp('flamingo', (bx + 6.5 + this.r(-0.3, 0.6)) * TILE, (by + 0.6 + k * 0.9) * TILE, this.rnd() < 0.5);
    this.addProp('gnome', (bx + 6.6) * TILE, (by + 5.4) * TILE, true);
    this.addProp('palm', (bx + 7.3) * TILE, (by + 7.2) * TILE, false);
    this.addProp('palm', (bx + 0.6) * TILE, (by + 7.4) * TILE, true);
    this.landmark('clubhouse', 'HOA CLUBHOUSE', p.x, p.y, 'em_hoa');
    this.spawns.hoa.push({ x: p.door.x + 60, y: p.door.y + 40 });
  }

  genKevin(bx, by) {
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) this.setTile(bx + i, by + j, TT.GRASS);
    // Kevin's mom's house, and the bunker in her back yard
    this.addProp('house_b', (bx + 2.5) * TILE, (by + 2) * TILE, false);
    this.occupy(bx + 1, by + 0, 3, 3);
    const b = this.addProp('bunker', (bx + 5.5) * TILE, (by + 2) * TILE, false);
    this.occupy(bx + 4, by + 0, 3, 3);
    this.addProp('house_c', (bx + 2.5) * TILE, (by + 6) * TILE, true);
    this.occupy(bx + 1, by + 4, 3, 3);
    this.addProp('house_a', (bx + 6) * TILE, (by + 6) * TILE, false);
    this.occupy(bx + 5, by + 5, 3, 3);
    this.addProp('bin_mailbox', (bx + 4.4) * TILE, (by + 3.6) * TILE, false);
    this.landmark('bunker', "KEVIN'S BUNKER", b.x, b.y, 'btn_enter');
    this.decorateBlock(bx, by, { palms: 0.15, cars: 1, bins: 1 });
  }

  genPlaza(bx, by) {
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) this.setTile(bx + i, by + j, TT.CONC);
    const sflip = this.rnd() < 0.5;
    const st = this.addProp('store', (bx + 1.5) * TILE, (by + 1.5) * TILE, sflip);
    st.keyItem = 'toolbox';
    this.occupy(bx, by, 3, 3);
    this.addProp('gas_station', (bx + 6) * TILE, (by + 6.5) * TILE, false);
    this.occupy(bx + 4, by + 5, 4, 3);
    this.addProp('phone_booth', (bx + 4.4) * TILE, (by + 0.6) * TILE, false);
    this.occupy(bx + 4, by, 1, 1);
    this.landmark('plaza', 'GAS AND GROCERIES', st.x, st.y, 'icon_fuel');
    this.decorateBlock(bx, by, { palms: 0.12, cars: 3, bins: 1 });
  }

  genSheriff(bx, by) {
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) this.setTile(bx + i, by + j, TT.DIRT);
    const so = this.addProp('sheriff_office', (bx + 1.5) * TILE, (by + 1.5) * TILE, false);
    this.occupy(bx, by, 3, 3);
    this.landmark('sheriff', "SHERIFF'S OFFICE", so.x, so.y, 'btn_enter');
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
    this.landmark('evac', 'EVAC BUS', this.evac.x, this.evac.y, 'icon_seat');
    this.decorateBlock(bx, by, { palms: 0, cars: 2, bins: 0, police: true });
  }

  genStrip(bx, by) {
    // the strip: a diner, a motel, a parking lot and broken dreams
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) this.setTile(bx + i, by + j, TT.CONC);
    const d = this.addProp('diner', (bx + 2.2) * TILE, (by + 1.3) * TILE, false);
    this.occupy(bx, by, 5, 3);
    const m = this.addProp('motel', (bx + 5.4) * TILE, (by + 5.8) * TILE, true);
    m.keyItem = 'cables';
    this.occupy(bx + 4, by + 3, 4, 5);
    this.addProp('icecream', (bx + 1.4) * TILE, (by + 5.2) * TILE, false);
    this.occupy(bx, by + 4, 3, 2);
    this.addProp('phone_booth', (bx + 6.6) * TILE, (by + 0.6) * TILE, true);
    this.occupy(bx + 6, by, 1, 1);
    this.addProp('speaker_pole', (bx + 2.6) * TILE, (by + 7.4) * TILE, false);
    this.landmark('diner', "MEL'S DINER", d.x, d.y, 'btn_enter');
    this.landmark('motel', 'SPACE AGE MOTEL', m.x, m.y, 'btn_search');
    this.decorateBlock(bx, by, { palms: 0.08, cars: 2, bins: 1 });
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
    const fl = o.flamingos === undefined ? 0.07 : o.flamingos;
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
        } else if (o.bins && r < o.palms + 0.06 + fl) {
          // a little flock of plastic flamingos
          const n = this.ri(1, 3);
          for (let f = 0; f < n; f++) this.addProp('flamingo', (x + 0.25 + f * 0.25) * TILE, (y + 0.3 + this.r(0, 0.4)) * TILE, this.rnd() < 0.5);
        } else if (o.gnomes && r < o.palms + 0.06 + fl + o.gnomes) {
          this.addProp('gnome', (x + 0.5) * TILE, (y + 0.5) * TILE, this.rnd() < 0.5);
        } else if (r > 0.93) {
          this.lootSpots.push({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, w: 1 });
        }
      }
  }

  // --- desert districts --------------------------------------------------------------------------
  genLot() {
    const L = LOT;
    // tarmac and a road from the gate to the tower
    this.fillTiles(L.x0, L.y0, L.x1, L.y1, TT.CONC, false);
    for (let j = L.y0 + 4; j <= L.y1; j++) for (const i of [53, 54]) this.setTile(i, j, TT.ASPH);
    for (let j = L.y0; j <= L.y1; j++) for (let i = L.x0; i <= L.x1; i++) this.occ[j * N + i] = 1;
    // force-field fence: pylons every two tiles, invisible walls in between, a gate on the highway
    const T = TILE;
    const ring = [];
    for (let i = L.x0; i <= L.x1; i += 2) ring.push([i, L.y0]);
    for (let j = L.y0 + 2; j <= L.y1; j += 2) ring.push([L.x1, j]);
    for (let i = L.x1 - 2; i >= L.x0; i -= 2) ring.push([i, L.y1]);
    for (let j = L.y1 - 2; j > L.y0; j -= 2) ring.push([L.x0, j]);
    const gate = (a, b) => a[1] === L.y1 && b[1] === L.y1 && Math.min(a[0], b[0]) >= 52 && Math.max(a[0], b[0]) <= 56;
    for (let k = 0; k < ring.length; k++) {
      const a = ring[k], b = ring[(k + 1) % ring.length];
      const ax = (a[0] + 0.5) * T, ay = (a[1] + 0.5) * T, bxx = (b[0] + 0.5) * T, byy = (b[1] + 0.5) * T;
      this.addProp('pylon', ax, ay, false);
      if (gate(a, b)) continue;
      this.fences.push({ x0: ax, y0: ay, x1: bxx, y1: byy });
      this.addWall(Math.min(ax, bxx) - 6, Math.min(ay, byy) - 6, Math.max(ax, bxx) + 6, Math.max(ay, byy) + 6, 'fence');
    }
    // the gate: a force field across both lanes, and the guard booth next to it
    const gy = (L.y1 + 0.5) * T;
    this.gate = { x0: 52.5 * T, x1: 56.5 * T, y: gy };
    this.gateWall = this.addWall(52.5 * T, gy - 8, 56.5 * T, gy + 8, 'gate');
    this.checkpoint = this.addProp('checkpoint', 57.6 * T, (L.y1 + 1.8) * T, false);
    this.occupy(56, L.y1, 3, 3);
    this.landmark('gate', 'STUDIO GATE', this.gate.x0 + 2 * T, gy, 'em_network');
    // the buildings
    const tw = this.addProp('tower', 54 * T, 8 * T, false);
    this.tower = tw;
    this.landmark('tower', 'BROADCAST TOWER', tw.x, tw.y, 'em_network');
    this.addProp('drive_in', 48 * T, 11 * T, false);
    const tr = this.addProp('net_trailer', 60 * T, 15.5 * T, false);
    this.landmark('office', 'PRODUCTION OFFICE', tr.x, tr.y, 'btn_enter');
    this.addProp('trailer', 47.5 * T, 19 * T, false);
    this.addProp('trailer', 61 * T, 20.5 * T, true);
    this.addProp('landed_ufo', 59.5 * T, 9 * T, false);
    this.addProp('porta_potty', 45.6 * T, 22.5 * T, false);
    this.addProp('porta_potty', 46.6 * T, 22.6 * T, false);
    this.addProp('speaker_pole', 51 * T, 21.5 * T, false);
    this.addProp('speaker_pole', 57 * T, 12.5 * T, true);
    this.addProp('sandbags', 50 * T, 15 * T, false);
    this.addProp('car_wreck', 63 * T, 6 * T, false);
    this.spawns.network.push({ x: 54 * T, y: 18 * T }, { x: 49 * T, y: 14 * T }, { x: 59 * T, y: 12 * T });
  }

  genJunkyard() {
    const x0 = 4, y0 = 44, x1 = 24, y1 = 62;
    for (let j = y0; j <= y1; j++)
      for (let i = x0; i <= x1; i++) {
        const d = Math.hypot((i - 14) / 11, (j - 53) / 10);
        if (d < 1 && this.terrain(i, j) !== TT.ASPH) this.setTile(i, j, TT.DIRT);
      }
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) if (Math.hypot((i - 14) / 11, (j - 53) / 10) < 1) this.occ[j * N + i] = 1;
    const T = TILE;
    const s = this.addProp('saloon', 13 * T, 48.5 * T, false);
    this.landmark('saloon', 'THE RUSTY SPUR', s.x, s.y, 'em_rats');
    const piles = [[7, 47], [9, 58], [18, 59], [21, 47], [6, 51.5], [15, 59.5]];
    for (const [i, j] of piles) this.addProp('junk_pile', i * T, j * T, this.rnd() < 0.5);
    for (const [i, j] of [[16, 51], [10, 51.2], [19, 56.5], [12, 56.5]]) this.addProp('burn_barrel', i * T, j * T, false);
    // barricades on the highway with a gap for the lanes
    this.addProp('barricade', 23.5 * T, 51 * T, false);
    this.addProp('barricade', 23.5 * T, 56.2 * T, false);
    this.addProp('car_wreck', 20 * T, 50 * T, true);
    this.addProp('car_wreck', 8 * T, 55 * T, false);
    this.addProp('car_wreck', 11 * T, 59.5 * T, true);
    this.addProp('porta_potty', 17.6 * T, 47 * T, false);
    this.addProp('car_pickup', 16.5 * T, 46.5 * T, false);
    this.stains.push({ x: 15 * T, y: 52 * T, r: 90 }, { x: 11 * T, y: 54 * T, r: 60 }, { x: 18 * T, y: 54 * T, r: 70 });
    this.garage = { x: 15 * T, y: 52 * T };
    this.spawns.rats.push({ x: 14 * T, y: 52 * T }, { x: 18 * T, y: 50 * T }, { x: 10 * T, y: 56 * T });
  }

  genChurch() {
    const T = TILE;
    for (let j = 29; j <= 39; j++) for (let i = 73; i <= 87; i++) this.occ[j * N + i] = 1;
    this.fillTiles(76, 31, 84, 38, TT.DIRT);
    const c = this.addProp('church', 80 * T, 33.5 * T, false);
    this.landmark('church', 'CHURCH OF THE BLESSED PROBE', c.x, c.y, 'em_church');
    this.circles.push({ x: 79 * T, y: 37.5 * T, r: 120 });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      this.addProp('shrub', 79 * T + Math.cos(a) * 150, 37.5 * T + Math.sin(a) * 150, k % 2 === 0);
    }
    this.addProp('saguaro', 75 * T, 31 * T, false);
    this.addProp('saguaro', 86 * T, 36 * T, true);
    this.addProp('trailer', 85 * T, 31.5 * T, true);
    this.addProp('billboard_a', 74.5 * T, 38.6 * T, false);
    this.spawns.church.push({ x: 79 * T, y: 37 * T }, { x: 82 * T, y: 38 * T });
  }

  genRanch() {
    const T = TILE;
    for (let j = 72; j <= 90; j++) for (let i = 28; i <= 52; i++) this.occ[j * N + i] = 1;
    this.fillTiles(31, 74, 47, 87, TT.GRASS);
    this.addProp('house_c', 33 * T, 76 * T, false);
    this.addProp('water_tower', 37 * T, 75 * T, false);
    this.addProp('trailer', 45 * T, 75.6 * T, false).keyItem = 'cowbell';
    for (let k = 0; k < 9; k++) this.cows.push({ x: (33 + this.r(0, 13)) * T, y: (79 + this.r(0, 7)) * T });
    this.ranch = { x: 40 * T, y: 82 * T };
    this.landmark('ranch', 'OLD RANCH', this.ranch.x, this.ranch.y, 'btn_pet');
    for (let j = 72; j <= 84; j++) for (let i = 56; i <= 66; i++) this.occ[j * N + i] = 1;
    const u = this.addProp('crashed_ufo', 61 * T, 78 * T, false);
    u.keyItem = 'fuse,slime';
    this.landmark('crash', 'CRASH SITE', u.x, u.y, 'btn_search');
    this.addProp('rocks', 58 * T, 76 * T, false);
    this.addProp('saguaro', 64 * T, 80.5 * T, false);
  }

  genRoadside() {
    // propaganda billboards along the highways, alien loudspeakers in town
    const T = TILE;
    for (const [type, i, j, f] of [['billboard_a', 36, 22, false], ['billboard_b', 70, 46, true], ['billboard_b', 24.5, 38, false], ['billboard_a', 60, 69.5, true], ['billboard_b', 45, 25.5, false]]) {
      this.addProp(type, i * T, j * T, f);
      this.occupy(Math.floor(i) - 1, Math.floor(j) - 1, 3, 2);
    }
    for (const [i, j] of [[31.2, 31.2], [64.8, 31.2], [31.2, 64.8], [64.8, 64.8]]) this.addProp('speaker_pole', i * T, j * T, false);
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
        if (this.cgrid[j * N + i].length) continue;
        const along = sideI ? j : i;
        if (along % 5 === 2) this.addProp('streetlight', (i + 0.5) * TILE, (j + 0.5) * TILE, sideI ? i % 2 === 0 : j % 2 === 1);
        else if (hash2(i, j, this.seed) < 0.035) this.addProp('hydrant', (i + 0.5) * TILE, (j + 0.5) * TILE);
      }
    // Abandoned vehicles on the roads.
    const cars = ['car_police', 'car_sheriff', 'car_pickup', 'car_minivan', 'car_wreck', 'car_wreck'];
    for (let n = 0; n < 12; n++) {
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
        if (inTown(i, j) || isHighway(i) || isHighway(j) || inLot(i - 1, j - 1) || inLot(i + 1, j + 1)) continue;
        const inside = i >= 0 && j >= 0 && i < N && j < N;
        if (inside && !this.free(i, j)) continue;
        // Keep a margin around town clear-ish.
        const nearTown = i > TOWN_A - 3 && i < TOWN_B + 3 && j > TOWN_A - 3 && j < TOWN_B + 3;
        const r = hash2(i, j, this.seed + 7);
        const x = (i + 0.5) * TILE + (hash2(i, j, this.seed + 3) - 0.5) * 30;
        const y = (j + 0.5) * TILE + (hash2(i, j, this.seed + 5) - 0.5) * 30;
        const flip = hash2(i, j, this.seed + 9) < 0.5;
        let type = null;
        if (r < 0.016) type = 'joshua_tree';
        else if (r < 0.024) type = 'saguaro';
        else if (r < 0.034 && !nearTown) type = 'rocks';
        else if (r < 0.08) type = 'shrub';
        else if (r < 0.0825 && inside && !nearTown) type = 'car_wreck';
        if (!type) continue;
        this.addProp(type, x, y, flip, !inside);
        if (inside) this.occupy(i, j);
      }
    // Scattered landmarks in the open desert.
    const spots = (n, fn) => {
      for (let k = 0, tries = 0; k < n && tries < 300; tries++) {
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
    spots(4, (i, j) => {
      this.addProp('trailer', (i + 1.5) * TILE, (j + 1) * TILE, this.rnd() < 0.5);
      this.lootSpots.push({ x: (i + 1.5) * TILE, y: (j + 2.4) * TILE, w: 2 });
    });
    spots(4, (i, j) => {
      const cx = (i + 1.5) * TILE, cy = (j + 1.5) * TILE;
      this.addProp('sandbags', cx - 50, cy + 30, false);
      this.addProp('sandbags', cx + 50, cy - 30, true);
      this.lootSpots.push({ x: cx, y: cy, w: 2 });
    });
    spots(3, (i, j) => {
      for (let k = 0; k < 4; k++) this.cows.push({ x: (i + 0.3 + this.r(0, 2.4)) * TILE, y: (j + 0.3 + this.r(0, 2.4)) * TILE });
    });
    spots(2, (i, j) => this.addProp('porta_potty', (i + 1.5) * TILE, (j + 1.5) * TILE, this.rnd() < 0.5));
  }

  // Intersections of the road grid (+ highway exits) for the panicking traffic.
  genRoadGraph() {
    const nodes = (this.roadNodes = []);
    const at = new Map();
    const add = (i, j, exit = false) => {
      const k = i * 1000 + j;
      if (!at.has(k)) {
        at.set(k, nodes.length);
        nodes.push({ x: i * TILE, y: j * TILE, nbr: [], exit });
      }
      return at.get(k);
    };
    const lines = ROADS.map((r) => r + 1);
    const link = (a, b) => {
      nodes[a].nbr.push(b);
      nodes[b].nbr.push(a);
    };
    for (let a = 0; a < lines.length; a++)
      for (let b = 0; b < lines.length; b++) {
        const n = add(lines[a], lines[b]);
        if (a > 0) link(n, add(lines[a - 1], lines[b]));
        if (b > 0) link(n, add(lines[a], lines[b - 1]));
      }
    for (const h of HIGHWAYS.map((r) => r + 1)) {
      // nobody drives into the studio lot (the gate is a force field)
      if (h !== 54) link(add(h, lines[0]), add(h, 1, true));
      link(add(h, lines[lines.length - 1]), add(h, N - 1, true));
      link(add(lines[0], h), add(1, h, true));
      link(add(lines[lines.length - 1], h), add(N - 1, h, true));
    }
  }

  genPatches() {
    this.patches = [];
    for (let j = -14; j < N + 14; j += 1)
      for (let i = -14; i < N + 14; i += 1) {
        if (inTown(i, j) || isHighway(i) || isHighway(j) || inLot(i, j)) continue;
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
        if (isRoad(k) && (inTown(k, k) || HIGHWAYS.some((h) => k === h || k === h + 1))) continue;
        // horizontal road (constant y) and vertical road (constant x)
        this.dashes.push({ x0: k * TILE + 14, y0: line - 2, x1: k * TILE + 50, y1: line + 2 });
        if (!(r === 53 && k < LOT.y0 + 4)) this.dashes.push({ x0: line - 2, y0: k * TILE + 14, x1: line + 2, y1: k * TILE + 50 });
      }
    }
  }

  finalize() {
    // Mark unreachable cells as blocked so nothing spawns where it cannot be reached.
    this.updateFlow(this.start.x, this.start.y, true);
    for (let k = 0; k < N * N; k++) if (this.flow[k] === 65535) this.blocked[k] = 1;
    // ...but the studio lot is reachable once the gate opens
    for (let j = LOT.y0 + 1; j < LOT.y1; j++)
      for (let i = LOT.x0 + 1; i < LOT.x1; i++) {
        const k = j * N + i;
        if (this.blocked[k] && !this.cgrid[k].some((q) => q.box && !q.def.invisible)) this.blocked[k] = 0;
      }
    this.lootSpots = this.lootSpots.filter((s) => !this.blocked[Math.floor(s.y / TILE) * N + Math.floor(s.x / TILE)]);
    this.props.sort((a, b) => a.depth - b.depth);
    this.lights = this.props.filter((p) => p.def.light);
    this.flowSrc = -1;
  }

  // The studio gate opens (permit, bribe, remote) or gets blown up (dynamite).
  openGate() {
    if (!this.gateWall) return;
    this.removeProp(this.gateWall);
    this.gateWall = null;
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

  inLot(x, y) {
    return inLot(Math.floor(x / TILE), Math.floor(y / TILE));
  }

  district(x, y) {
    const i = x / TILE, j = y / TILE;
    if (inLot(Math.floor(i), Math.floor(j))) return 'lot';
    if (Math.hypot((i - 14) / 11, (j - 53) / 10) < 1.15) return 'junkyard';
    if (i > 72 && i < 89 && j > 27 && j < 41) return 'church';
    if (i > 27 && i < 53 && j > 71 && j < 91) return 'ranch';
    if (inTown(Math.floor(i), Math.floor(j))) return j < T0 + 12 ? 'estates' : 'town';
    return 'desert';
  }

  // Precise point-in-collider test (used for projectiles).
  hitProp(x, y) {
    const k = this.tileIndex(x, y);
    if (k < 0) return null;
    for (const p of this.cgrid[k]) {
      if (p.def.invisible) continue;
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
          if (p.def.soft) continue;
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

  // A* over the walkable tiles (8-neighbour). Returns a list of world points or null.
  findPath(x0, y0, x1, y1, maxNodes = 4000) {
    const s = this.tileIndex(x0, y0);
    let g = this.tileIndex(x1, y1);
    if (s < 0 || g < 0) return null;
    if (this.blocked[g]) {
      // aim for the nearest open tile next to the target
      const gi = g % N, gj = (g / N) | 0;
      let best = -1, bd = 1e9;
      for (let r = 1; r <= 4 && best < 0; r++)
        for (let dj = -r; dj <= r; dj++)
          for (let di = -r; di <= r; di++) {
            const i = gi + di, j = gj + dj;
            if (i < 0 || j < 0 || i >= N || j >= N || this.blocked[j * N + i]) continue;
            const cx = (i + 0.5) * TILE, cy = (j + 0.5) * TILE;
            const d = Math.hypot(cx - x0, cy - y0) * 0.25 + Math.hypot(cx - x1, cy - y1);
            if (d < bd) (bd = d), (best = j * N + i);
          }
      if (best < 0) return null;
      g = best;
    }
    if (s === g) return [{ x: x1, y: y1 }];
    const gi = g % N, gj = (g / N) | 0;
    const open = [s];
    const came = new Map();
    const cost = new Map([[s, 0]]);
    const h = (k) => {
      const dx = Math.abs((k % N) - gi), dy = Math.abs(((k / N) | 0) - gj);
      return Math.max(dx, dy) + 0.41 * Math.min(dx, dy);
    };
    const f = new Map([[s, h(s)]]);
    let n = 0;
    while (open.length && n++ < maxNodes) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (f.get(open[i]) < f.get(open[bi])) bi = i;
      const k = open[bi];
      open[bi] = open[open.length - 1];
      open.pop();
      if (k === g) break;
      const i = k % N, j = (k / N) | 0;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const x = i + di, y = j + dj;
          if (x < 0 || y < 0 || x >= N || y >= N) continue;
          const m = y * N + x;
          if (this.blocked[m]) continue;
          if (di && dj && (this.blocked[j * N + x] || this.blocked[y * N + i])) continue;
          const c = cost.get(k) + (di && dj ? 1.41 : 1);
          if (c < (cost.has(m) ? cost.get(m) : 1e9)) {
            cost.set(m, c);
            came.set(m, k);
            f.set(m, c + h(m));
            if (!open.includes(m)) open.push(m);
          }
        }
    }
    if (!came.has(g)) return null;
    const path = [];
    for (let k = g; k !== s; k = came.get(k)) path.push({ x: ((k % N) + 0.5) * TILE, y: (((k / N) | 0) + 0.5) * TILE });
    path.reverse();
    path[path.length - 1] = { x: x1, y: y1 };
    return path;
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
