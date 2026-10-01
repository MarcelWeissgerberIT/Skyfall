// Cars are the heart of Skyfall: Dale's rides, the panicking traffic, crashes, passengers,
// honking, nitro and an alarming amount of property damage.
import { TILE, rand, pick, clamp, dist2, screenDirToWorld } from './util.js';
import * as L from './lines.js';

export const VEHICLES = {
  police: { name: 'POLICE CRUISER', corner: 'car_police', right: true, rear: 'police_rear', side: 'police_side', front: 'police_front', back: 'police_back', w: 134, speed: 390, accel: 1.8, turn: 3.0, hp: 220, fuel: 75, seats: 3, siren: true },
  sheriff: { name: "SHERIFF'S CAR", corner: 'car_sheriff', right: false, rear: 'sheriff_rear', side: 'sheriff_side', front: 'sheriff_front', back: 'sheriff_back', w: 134, speed: 370, accel: 1.7, turn: 2.9, hp: 240, fuel: 75, seats: 3, siren: true },
  pickup: { name: 'PICKUP TRUCK', corner: 'car_pickup', right: false, rear: 'pickup_rear', side: 'pickup_side', front: 'pickup_front', back: 'pickup_back', w: 132, speed: 330, accel: 1.4, turn: 2.5, hp: 360, fuel: 95, seats: 5 },
  minivan: { name: 'MINIVAN', corner: 'car_minivan', right: true, rear: 'minivan_rear', side: 'minivan_side', front: 'minivan_front', back: 'minivan_back', w: 128, speed: 310, accel: 1.35, turn: 2.4, hp: 280, fuel: 85, seats: 6 },
};

const BREAK_NAME = {
  flamingo: 'PLASTIC FLAMINGO', bin_mailbox: 'MAILBOX', hydrant: 'FIRE HYDRANT', streetlight: 'STREETLIGHT',
  palm: 'PALM TREE', joshua_tree: '300 YEAR OLD JOSHUA TREE', shrub: 'SHRUBBERY',
};

// 8 screen directions per vehicle type (angles in degrees, screen space).
const VIEWS = {};
function views(type) {
  if (VIEWS[type]) return VIEWS[type];
  const V = VEHICLES[type];
  return (VIEWS[type] = [
    { a: 0, key: V.side, flip: false, w: V.w * 0.93, base: 0.28 },
    { a: 26.57, key: V.corner, flip: !V.right, w: V.w, base: 0.32 },
    { a: 90, key: V.front, flip: false, w: V.w * 0.52, base: 0.3 },
    { a: 153.43, key: V.corner, flip: V.right, w: V.w, base: 0.32 },
    { a: 180, key: V.side, flip: true, w: V.w * 0.93, base: 0.28 },
    { a: 206.57, key: V.rear, flip: true, w: V.w, base: 0.32 },
    { a: 270, key: V.back, flip: false, w: V.w * 0.52, base: 0.3 },
    { a: 333.43, key: V.rear, flip: false, w: V.w, base: 0.32 },
  ]);
}

export function carSprite(c) {
  const cx = Math.cos(c.h), cy = Math.sin(c.h);
  if (c.wreck) return { key: 'car_wreck', flip: cx - cy > 0, w: 132, base: 0.3 };
  let a = (Math.atan2((cx + cy) * 0.5, cx - cy) * 180) / Math.PI;
  if (a < 0) a += 360;
  let best = null, bd = 999;
  for (const d of views(c.type)) {
    let diff = Math.abs(d.a - a);
    if (diff > 180) diff = 360 - diff;
    if (diff < bd) (bd = diff), (best = d);
  }
  return best;
}

export const angDiff = (a, b) => {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export const fmtNum = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const VehicleMixin = {
  initVehicles() {
    this.cars = [];
    this.debris = [];
    this.geysers = [];
    this.damage = 0;
    this.damageStep = 0;
    this.roadkill = 0;
    this.tTraffic = 6;
    for (const pc of this.world.parkedCars) {
      const c = this.makeCar(pc.type, pc.x, pc.y, pc.h, null);
      c.fuel = c.maxFuel * rand(0.25, 0.8);
      this.cars.push(c);
    }
    for (let i = 0; i < 7; i++) this.spawnTraffic(false);
  },

  makeCar(type, x, y, h, driver) {
    const V = VEHICLES[type];
    return {
      type, V, x, y, h, speed: 0, hp: V.hp, maxHp: V.hp, fuel: V.fuel, maxFuel: V.fuel, driver, seats: [], r: 26,
      invT: 0, smoke: 0, lift: 0, boostT: 0, honkT: 0, honkFlash: 0, ai: null, wreck: false, burnT: 0, yell: 0, warned: 0,
    };
  },

  spawnTraffic(fromEdge) {
    const nodes = this.world.roadNodes;
    const cands = [];
    for (let i = 0; i < nodes.length; i++) if (!!nodes[i].exit === fromEdge) cands.push(i);
    const i = pick(cands), n = nodes[i];
    const j = pick(n.nbr), m = nodes[j];
    const h = Math.atan2(m.y - n.y, m.x - n.x);
    const x = n.x - Math.sin(h) * 30 + Math.cos(h) * 40, y = n.y + Math.cos(h) * 30 + Math.sin(h) * 40;
    for (const o of this.cars) if (dist2(o.x, o.y, x, y) < 110 * 110) return null;
    const p = this.player;
    if (p && dist2(p.x, p.y, x, y) < 200 * 200) return null;
    const c = this.makeCar(pick(['minivan', 'pickup', 'minivan', 'sheriff', 'pickup', 'police']), x, y, h, 'ai');
    c.ai = { from: i, to: j, wait: 0, rev: 0, stuck: 0, cruise: rand(150, 220) };
    this.cars.push(c);
    return c;
  },

  // --- the player's car ----------------------------------------------------------------------------------
  updatePlayerCar(dt, input) {
    const p = this.player, c = p.car;
    const [wx, wy] = screenDirToWorld(input.mx, input.my);
    const mag = Math.min(1, Math.hypot(input.mx, input.my));
    let want = 0, wantH = c.h, steer = false;
    if (mag > 0.15) {
      const target = Math.atan2(wy, wx);
      const diff = angDiff(target, c.h);
      steer = true;
      if (Math.abs(diff) > 2.4 && c.speed < 70) {
        want = -150 * mag;
        wantH = target + Math.PI;
      } else {
        want = c.V.speed * mag * (1 - Math.min(0.55, Math.abs(diff) / Math.PI));
        wantH = target;
      }
    }
    if (input.boost) this.boost();
    if (c.boostT > 0) {
      want = c.V.speed * 1.6;
      if (!steer) wantH = c.h;
      steer = true;
      if (Math.random() < 0.8) this.addFx('fire', c.x - Math.cos(c.h) * 34, c.y - Math.sin(c.h) * 34, 10, -Math.cos(c.h) * 120, -Math.sin(c.h) * 120, rand(10, 40), rand(0.2, 0.4), 0.7);
    }
    if (input.honk) this.honk(c);
    if (c.fuel <= 0) {
      want = 0;
      if (c.warned < 2) {
        c.warned = 2;
        this.float('OUT OF GAS. WALK OF SHAME.', c.x, c.y, 13, 2);
        this.say('YOUR CAR IS OUT OF GAS. FIND A FUEL CAN OR STEAL ANOTHER ONE. IT IS THE APOCALYPSE, NOBODY CARES.', true);
      }
    } else if (c.fuel < c.maxFuel * 0.15 && c.warned < 1) {
      c.warned = 1;
      this.float('LOW FUEL', c.x, c.y, 13, 1.6);
    }
    this.stepCar(c, dt, want, wantH, steer);
    if (!p.car) return; // wrecked
    p.x = c.x;
    p.y = c.y;
    p.moving = Math.abs(c.speed) > 20;
    if (p.moving) {
      p.fx = Math.cos(c.h) * Math.sign(c.speed);
      p.fy = Math.sin(c.h) * Math.sign(c.speed);
    }
    // survivors hop in when you roll up slowly
    const seats = c.V.seats;
    for (const v of this.civs) {
      if (v.taken) continue;
      const d2v = dist2(v.x, v.y, c.x, c.y);
      if (d2v > 70 * 70 || Math.abs(c.speed) > 160) continue;
      if (c.seats.length < seats) {
        v.taken = 'boarded';
        c.seats.push(v.type);
        this.float(pick(L.BOARD), c.x, c.y, 12, 1.6);
        this.sound.play('door');
      } else if (v.yell <= 0) {
        v.yell = 3;
        this.float('NO ROOM! I HAVE A STATION WAGON LIFESTYLE!', v.x, v.y, 11, 1.6);
      }
    }
    // drop them off at the evac bus
    const ev = this.world.evac;
    if (ev && c.seats.length && dist2(c.x, c.y, ev.x, ev.y) < 190 * 190 && Math.abs(c.speed) < 220) this.unload(c);
    this.sound.engine(true, Math.abs(c.speed) / c.V.speed, c.boostT > 0);
  },

  boost() {
    const p = this.player, c = p.car;
    if (!c || c.boostT > 0) return;
    if (p.nitro <= 0) {
      this.float('NO NITRO. JUST VIBES.', c.x, c.y, 12, 1);
      return;
    }
    p.nitro--;
    c.boostT = 2.6;
    this.sound.play('boost');
    this.shake = Math.max(this.shake, 4);
  },

  honk(c) {
    if (c.honkT > 0) return;
    c.honkT = 0.45;
    c.honkFlash = 0.3;
    this.sound.play('honk');
    if (Math.random() < 0.3) this.float(pick(L.HONK), c.x, c.y, 13, 1.1);
    for (const v of this.civs) if (!v.taken && dist2(v.x, v.y, c.x, c.y) < 480 * 480) v.hail = 5;
    for (const e of this.enemies) {
      const d2v = dist2(e.x, e.y, c.x, c.y);
      if (d2v < 160 * 160) {
        const d = Math.sqrt(d2v) || 1;
        e.stun = 0.8;
        e.kx += ((e.x - c.x) / d) * 160;
        e.ky += ((e.y - c.y) / d) * 160;
      }
    }
    for (const u of this.ufos) {
      if (u.state !== 'hover' || dist2(u.x, u.y, c.x, c.y) > 280 * 280) continue;
      this.spookUfo(u);
    }
    if (this.dog) this.dog.bark = 0.6;
  },

  unload(c) {
    const n = c.seats.length;
    const ev = this.world.evac;
    for (const type of c.seats) {
      // they run to the bus and get on
      this.civs.push({ type, x: c.x + rand(-20, 20), y: c.y + rand(-20, 20), r: 10, vx: 0, vy: 0, t: 0, walkT: 0, panic: 1, flip: false, gave: true, life: 999, quipT: 9, fade: 1, taken: 'rescued', yell: 0 });
    }
    c.seats.length = 0;
    this.rescued += n;
    this.float('+' + n + ' RESCUED', c.x, c.y, 16, 1.8);
    this.say(pick(L.RESCUE), true);
    this.sound.play('rescue');
    const drops = 1 + Math.floor(n / 2);
    for (let i = 0; i < drops; i++) {
      const type = pick(['fuel', 'repair', 'nitro', 'medkit', 'fuel']);
      this.pickups.push({ type, x: ev.x + rand(-70, 70), y: ev.y + rand(-50, 50), t: 0, life: 40, drop: true, pop: 1 });
    }
    if (n >= 3) this.player.nitro = Math.min(6, this.player.nitro + 1);
    this.missionEvent('taxi', n);
  },

  enterCar(c) {
    const p = this.player;
    if (c.driver === 'ai') {
      // carjacking: the owner is NOT happy about it
      const sx = -Math.sin(c.h) * 46, sy = Math.cos(c.h) * 46;
      const v = this.spawnCivAt(c.x + sx, c.y + sy);
      if (v) {
        v.yell = 2;
        this.float(pick(L.CARJACK), v.x, v.y, 12, 2);
      }
      c.ai = null;
      this.missionEvent('carjack');
    }
    c.driver = 'player';
    p.car = c;
    p.x = c.x;
    p.y = c.y;
    this.search = null;
    if (c.fuel < c.maxFuel * 0.6 && p.cans > 0) {
      p.cans--;
      c.fuel = Math.min(c.maxFuel, c.fuel + c.maxFuel * 0.6);
      this.float('REFUELED FROM YOUR CAN', c.x, c.y, 12, 1.4);
    }
    // anybody tagging along jumps in
    for (const v of this.civs) {
      if (v.taken || !v.follow || dist2(v.x, v.y, c.x, c.y) > 200 * 200) continue;
      if (c.seats.length >= c.V.seats) break;
      v.taken = 'boarded';
      c.seats.push(v.type);
    }
    this.sound.play('door');
    if (c.V.siren) this.sound.siren(true);
    this.float(c.V.name, c.x, c.y, 13, 1.4);
    if (Math.random() < 0.6) this.say(pick(L.CAR_IN), true);
  },

  exitCar() {
    const p = this.player, c = p.car;
    if (!c) return;
    const fast = Math.abs(c.speed) > 170;
    c.driver = null;
    p.car = null;
    this.sound.siren(false);
    this.sound.engine(false);
    this.sound.play('door');
    const sx = -Math.sin(c.h), sy = Math.cos(c.h);
    p.x = c.x + sx * 52;
    p.y = c.y + sy * 52;
    if (!this.world.isWalkable(p.x, p.y)) (p.x = c.x - sx * 52), (p.y = c.y - sy * 52);
    this.world.collide(p);
    if (fast) {
      // bailing out of a moving car: stunt double not included
      this.say(pick(L.BAIL), true);
      this.hurtPlayer(10, c.x, c.y, 20);
    }
  },

  hurtCar(c, d) {
    if (c.wreck) return;
    c.hp -= d;
    if (c === this.player.car) this.sound.play('hit');
    if (c.hp <= 0) this.wreckCar(c);
  },

  wreckCar(c) {
    const p = this.player;
    c.wreck = true;
    c.hp = 0;
    c.burnT = 25;
    c.speed *= 0.3;
    this.explode(c.x, c.y, 10, false, true);
    // passengers and drivers scramble out
    for (const type of c.seats) this.spawnCivAt(c.x + rand(-40, 40), c.y + rand(-40, 40), type);
    c.seats.length = 0;
    if (c.driver === 'ai') this.spawnCivAt(c.x + rand(-30, 30), c.y + rand(-30, 30));
    if (c === p.car) {
      p.car = null;
      this.sound.siren(false);
      this.sound.engine(false);
      const sx = -Math.sin(c.h), sy = Math.cos(c.h);
      p.x = c.x + sx * 56;
      p.y = c.y + sy * 56;
      this.world.collide(p);
      this.say(pick(L.CAR_BOOM), true);
      this.hurtPlayer(18, c.x, c.y, 12);
      this.addDamage(c.x, c.y, 18000, 'TOTALED ' + c.V.name);
    }
    c.driver = null;
    c.ai = null;
  },

  addDamage(x, y, value, name) {
    this.damage += value;
    if (name) this.float(name + ' ' + fmtNum(value), x, y, 11, 1.3);
    const steps = [10000, 50000, 100000, 250000, 1000000, 5000000];
    while (this.damageStep < steps.length && this.damage >= steps[this.damageStep]) {
      this.say(L.DAMAGE[this.damageStep], true);
      this.damageStep++;
    }
    this.missionEvent('demolition', value);
  },

  // --- AI traffic --------------------------------------------------------------------------------------------
  aiControl(c, dt) {
    const a = c.ai, nodes = this.world.roadNodes;
    if (a.rev > 0) {
      a.rev -= dt;
      return [-90, c.h, false];
    }
    const n = nodes[a.to], f = nodes[a.from];
    const dh = Math.atan2(n.y - f.y, n.x - f.x);
    const tx = n.x - Math.sin(dh) * 30, ty = n.y + Math.cos(dh) * 30;
    const d = Math.hypot(tx - c.x, ty - c.y);
    if (d < 48) {
      if (n.exit) {
        c.gone = true;
        return [0, c.h, false];
      }
      const opts = n.nbr.filter((k) => k !== a.from);
      const next = opts.length ? pick(opts) : a.from;
      a.from = a.to;
      a.to = next;
    }
    let want = a.cruise;
    // panic: aliens around -> floor it
    if (this.enemies.length && Math.random() < 0.05) a.panic = this.enemies.some((e) => dist2(e.x, e.y, c.x, c.y) < 220 * 220) ? 2 : 0;
    if (a.panic) want *= 1.35;
    // slow down for anything in the way
    const ch = Math.cos(c.h), sh = Math.sin(c.h);
    const ahead = (o) => {
      const dx = o.x - c.x, dy = o.y - c.y;
      const fwd = dx * ch + dy * sh, side = Math.abs(-dx * sh + dy * ch);
      if (fwd > 0 && fwd < 110 && side < 36) want = Math.min(want, Math.max(0, (fwd - 50) * 3));
    };
    for (const o of this.cars) if (o !== c && !o.gone) ahead(o);
    const p = this.player;
    if (!p.car) ahead(p);
    if (Math.abs(c.speed) < 8 && want > 40) a.wait += dt;
    else a.wait = Math.max(0, a.wait - dt);
    if (a.wait > 2.2) {
      a.wait = 0;
      a.rev = 0.8;
      a.stuck++;
      if (Math.random() < 0.5) this.honk(c);
      if (a.stuck > 3) {
        // give up and run for it
        c.driver = null;
        c.ai = null;
        this.spawnCivAt(c.x - Math.sin(c.h) * 46, c.y + Math.cos(c.h) * 46);
      }
    }
    return [want, Math.atan2(ty - c.y, tx - c.x), true];
  },

  updateCars(dt) {
    const p = this.player;
    this.tTraffic -= dt;
    if (this.tTraffic <= 0) {
      this.tTraffic = rand(5, 9);
      const ai = this.cars.filter((c) => c.driver === 'ai').length;
      if (ai < Math.max(3, 9 - this.level)) this.spawnTraffic(true);
    }
    for (const c of this.cars) {
      // tractor beams let go slowly
      c.beamT = (c.beamT || 0) - dt;
      if (c.beamT <= 0 && c.lift > 0) c.lift = Math.max(0, c.lift - dt * 0.6);
      c.invT -= dt;
      c.honkT -= dt;
      c.honkFlash -= dt;
      c.boostT -= dt;
      c.yell -= dt;
      if (c.wreck) {
        c.burnT -= dt;
        c.speed *= Math.pow(0.1, dt);
        if (c.burnT > 0 && Math.random() < dt * 10) {
          this.addFx('fire', c.x + rand(-20, 20), c.y + rand(-20, 20), rand(10, 30), rand(-10, 10), rand(-10, 10), rand(40, 80), rand(0.4, 0.8), 0.9);
          if (Math.random() < 0.5) this.addFx('smoke', c.x, c.y, 40, 20, 0, rand(30, 60), rand(2, 3.5), 1.2);
        }
        continue;
      }
      if (c === p.car) continue; // updated with the player
      if (c.driver === 'ai' && c.ai) {
        const [want, h, steer] = this.aiControl(c, dt);
        this.stepCar(c, dt, want, h, steer);
      } else if (Math.abs(c.speed) > 2 || c.lift > 0) this.stepCar(c, dt, 0, c.h, false);
      if (c.hp < c.maxHp * 0.35 && Math.random() < dt * 5) this.addFx('smoke', c.x, c.y, 26, rand(-10, 10), rand(-10, 10), rand(30, 60), rand(1, 1.8), 0.8);
    }
    this.cars = this.cars.filter((c) => !c.gone);
    this.collideCars(dt);
    this.updateDebris(dt);
  },

  // shared car physics
  stepCar(c, dt, want, wantH, steer) {
    const V = c.V, w = this.world;
    const boost = c.boostT > 0;
    if (steer) {
      const diff = angDiff(wantH, c.h);
      const turn = V.turn * (0.25 + 0.75 * Math.min(1, Math.abs(c.speed) / 140));
      c.h += clamp(diff, -turn * dt, turn * dt);
    }
    const maxS = V.speed * (boost ? 1.6 : 1) * (1 - c.lift * 0.85);
    want = clamp(want, -maxS * 0.4, maxS);
    const k = want === 0 && !c.driver ? 0.6 : want > c.speed ? V.accel * (boost ? 3 : 1) : 3;
    c.speed += (want - c.speed) * Math.min(1, dt * k);
    if (c.driver === 'player') c.fuel = Math.max(0, c.fuel - dt * (0.15 + 0.85 * Math.abs(c.speed) / V.speed));
    const sp = Math.abs(c.speed);
    c.x += Math.cos(c.h) * c.speed * dt;
    c.y += Math.sin(c.h) * c.speed * dt;
    // mow down breakable props before the world pushes us out of them
    if (sp > 40) this.smashProps(c, sp);
    const ex = c.x, ey = c.y;
    w.collide(c);
    const pushed = Math.hypot(c.x - ex, c.y - ey);
    if (pushed > 0.3) {
      // only the part of the velocity that goes INTO the obstacle counts as a crash
      const vn = pushed / Math.max(dt, 1e-3);
      if (vn > 100) {
        const dmg = (vn - 80) * (boost ? 0.04 : 0.09);
        this.hurtCar(c, dmg);
        if (c === this.player.car) {
          this.shake = Math.max(this.shake, Math.min(10, vn / 30));
          this.sound.play('crash');
          this.addDamage(c.x, c.y, 300 + Math.round(vn * 3), null);
        }
        for (let i = 0; i < 5; i++) this.addFx('spark', c.x + Math.cos(c.h) * 24, c.y + Math.sin(c.h) * 24, 14, rand(-120, 120), rand(-120, 120), rand(40, 120), 0.2);
        c.speed *= vn > sp * 0.7 ? -0.25 : 0.55;
      } else c.speed *= 1 - Math.min(0.3, (vn / Math.max(sp, 1)) * 0.5);
    }
    // ram landed saucers
    for (const n of this.nests) {
      const dx = c.x - n.x, dy = c.y - n.y, rr = c.r + n.r, d = Math.hypot(dx, dy);
      if (d < rr && d > 0.01) {
        if (sp > 110 && n.land >= 1) {
          this.damageNest(n, sp * (boost ? 1.4 : 0.8));
          this.hurtCar(c, boost ? 4 : 14);
          this.sound.play('crash');
          this.shake = Math.max(this.shake, 8);
          c.speed *= -0.3;
        }
        c.x = n.x + (dx / d) * rr;
        c.y = n.y + (dy / d) * rr;
      }
    }
  },

  smashProps(c, sp) {
    const w = this.world;
    const ti = Math.floor(c.x / TILE), tj = Math.floor(c.y / TILE);
    for (let j = tj - 1; j <= tj + 1; j++)
      for (let i = ti - 1; i <= ti + 1; i++) {
        const k = w.tileIndex((i + 0.5) * TILE, (j + 0.5) * TILE);
        if (k < 0) continue;
        const list = w.cgrid[k];
        for (let n = list.length - 1; n >= 0; n--) {
          const q = list[n];
          if (!q || !q.breakable) continue;
          const rr = c.r + (q.circle || 6) + 4;
          if (dist2(q.x, q.y, c.x, c.y) > rr * rr) continue;
          this.breakProp(q, c, sp);
        }
      }
  },

  breakProp(q, c, sp) {
    this.world.removeProp(q);
    const fx = Math.cos(c.h) * Math.sign(c.speed), fy = Math.sin(c.h) * Math.sign(c.speed);
    const tall = q.type === 'streetlight' || q.type === 'palm' || q.type === 'joshua_tree';
    this.debris.push({
      sprite: q.sprite, def: q.def, flip: q.flip, x: q.x, y: q.y, z: 0,
      vx: fx * sp * (tall ? 0.25 : 0.7) + rand(-50, 50), vy: fy * sp * (tall ? 0.25 : 0.7) + rand(-50, 50),
      vz: tall ? 0 : rand(140, 280), rot: 0, vr: tall ? 0 : rand(-9, 9), fall: tall ? 0 : -1, fallDir: Math.random() < 0.5 ? 1 : -1, life: 7,
    });
    const heavy = { streetlight: 9, palm: 12, joshua_tree: 7, hydrant: 5, bin_mailbox: 2 }[q.type] || 0;
    if (heavy) {
      this.hurtCar(c, heavy);
      c.speed *= 0.85;
    }
    if (q.type === 'hydrant') {
      this.geysers.push({ x: q.x, y: q.y, t: 14 });
      this.sound.play('splash');
    } else if (q.type === 'streetlight') {
      for (let i = 0; i < 10; i++) this.addFx('spark', q.x, q.y, 120, rand(-150, 150), rand(-150, 150), rand(-40, 80), 0.4);
      this.sound.play('crash');
    } else this.sound.play(heavy ? 'crash' : 'thud');
    if (c === this.player.car) this.addDamage(q.x, q.y, q.breakable, BREAK_NAME[q.type]);
  },

  updateDebris(dt) {
    for (const d of this.debris) {
      d.life -= dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vx *= Math.pow(0.4, dt);
      d.vy *= Math.pow(0.4, dt);
      if (d.fall >= 0) {
        // tall things topple over
        d.fall = Math.min(1, d.fall + dt * (0.6 + d.fall * 3));
        d.rot = d.fall * (Math.PI / 2.2) * d.fallDir;
      } else {
        d.vz -= 800 * dt;
        d.z += d.vz * dt;
        d.rot += d.vr * dt;
        if (d.z <= 0) {
          d.z = 0;
          d.vz = Math.abs(d.vz) > 80 ? -d.vz * 0.35 : 0;
          d.vr *= 0.5;
        }
      }
    }
    this.debris = this.debris.filter((d) => d.life > 0);
    for (const gy of this.geysers) {
      gy.t -= dt;
      const n = Math.random() < dt * 40 ? 2 : 0;
      for (let i = 0; i < n; i++) this.addFx('water', gy.x + rand(-4, 4), gy.y + rand(-4, 4), 10, rand(-40, 40), rand(-40, 40), rand(260, 380) * Math.min(1, gy.t / 3), rand(0.9, 1.4));
      // the geyser shoves aliens around
      for (const e of this.enemies) if (dist2(e.x, e.y, gy.x, gy.y) < 50 * 50) e.stun = Math.max(e.stun, 0.3);
    }
    this.geysers = this.geysers.filter((g) => g.t > 0);
  },

  // cars vs cars, aliens, people, cows and the dog
  collideCars(dt) {
    const p = this.player, cars = this.cars;
    for (let i = 0; i < cars.length; i++) {
      const a = cars[i];
      for (let j = i + 1; j < cars.length; j++) {
        const b = cars[j];
        const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r;
        const d2v = dx * dx + dy * dy;
        if (d2v >= rr * rr || d2v < 0.01) continue;
        const d = Math.sqrt(d2v), nx = dx / d, ny = dy / d;
        const push = (rr - d) / 2;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const va = a.speed * (Math.cos(a.h) * nx + Math.sin(a.h) * ny), vb = b.speed * (Math.cos(b.h) * nx + Math.sin(b.h) * ny);
        const impact = va - vb;
        if (impact > 60) {
          const dmg = impact * 0.08;
          this.hurtCar(a, dmg);
          this.hurtCar(b, dmg);
          a.speed *= 0.5;
          b.speed += impact * 0.4 * Math.sign(Math.cos(b.h) * nx + Math.sin(b.h) * ny || 1);
          if (a === p.car || b === p.car) {
            this.sound.play('crash');
            this.shake = Math.max(this.shake, 7);
            const other = a === p.car ? b : a;
            this.addDamage(other.x, other.y, 900 + Math.round(impact * 6), 'FENDER BENDER');
            if (other.driver === 'ai' && other.yell <= 0) {
              other.yell = 3;
              this.float(pick(L.ROAD_RAGE), other.x, other.y, 12, 1.6);
              this.honk(other);
            }
          }
        }
      }
    }
    for (const c of cars) {
      const sp = Math.abs(c.speed);
      const fx = Math.cos(c.h) * Math.sign(c.speed), fy = Math.sin(c.h) * Math.sign(c.speed);
      const mine = c === p.car;
      for (const e of this.enemies) {
        if (e.dead || e.spawnT < 0.6) continue;
        const dx = e.x - c.x, dy = e.y - c.y, rr = c.r + e.r;
        const d2v = dx * dx + dy * dy;
        if (d2v >= rr * rr) continue;
        const d = Math.sqrt(d2v) || 1;
        if (sp > 70 && !c.wreck) {
          const brute = e.type === 'brute';
          const boost = c.boostT > 0;
          this.damageEnemy(e, sp * (brute && !boost ? 0.3 : 0.65), ((dx / d) * 0.6 + fx) * sp * 1.4, ((dy / d) * 0.6 + fy) * sp * 1.4);
          if (e.dead) {
            if (mine) {
              this.roadkill++;
              this.missionEvent('roadkill');
              if (Math.random() < 0.12) this.float(pick(L.SPLAT), e.x, e.y, 12, 1.2);
            }
          }
          if (!boost) this.hurtCar(c, brute ? 24 : 1.5);
          if (brute && !boost) c.speed *= 0.3;
        }
        e.x = c.x + (dx / d) * rr;
        e.y = c.y + (dy / d) * rr;
      }
      for (const v of this.civs) {
        if (v.taken) continue;
        const dx = v.x - c.x, dy = v.y - c.y, rr = c.r + v.r + 4, d = Math.hypot(dx, dy);
        if (d < rr && d > 0.01) {
          v.x = c.x + (dx / d) * rr;
          v.y = c.y + (dy / d) * rr;
          if (sp > 90 && v.yell <= 0) {
            v.yell = 2.5;
            this.float(pick(L.DODGE), v.x, v.y, 11, 1.2);
          }
        }
      }
      for (const cw of this.cows) {
        if (cw.state === 'abducted') continue;
        const dx = cw.x - c.x, dy = cw.y - c.y, rr = c.r + cw.r, d = Math.hypot(dx, dy);
        if (d < rr && d > 0.01) {
          cw.x = c.x + (dx / d) * rr;
          cw.y = c.y + (dy / d) * rr;
          if (sp > 60) this.sound.play('moo');
        }
      }
      const dog = this.dog;
      if (dog) {
        const dx = dog.x - c.x, dy = dog.y - c.y, rr = c.r + 10, d = Math.hypot(dx, dy);
        if (d < rr && d > 0.01) (dog.x = c.x + (dx / d) * rr), (dog.y = c.y + (dy / d) * rr);
      }
      // Dale on foot vs traffic
      if (!p.car && !p.dead) {
        const dx = p.x - c.x, dy = p.y - c.y, rr = c.r + p.r, d = Math.hypot(dx, dy);
        if (d < rr && d > 0.01) {
          p.x = c.x + (dx / d) * rr;
          p.y = c.y + (dy / d) * rr;
          if (sp > 150) {
            this.hurtPlayer(10, c.x, c.y, 30);
            if (c.driver === 'ai') this.float('WATCH WHERE YOU WALK!', c.x, c.y, 12, 1.4);
          }
        }
      }
    }
  },
};
