// Everything Dale can do besides shooting: rummage through stuff, drive the sheriff's cruiser,
// talk survivors into following him to the evac bus, pet cows, blow up the gas station and
// run errands for a very sarcastic dispatcher.
import { TILE, rand, pick, clamp, dist2, weighted, screenDirToWorld } from './util.js';
import * as L from './lines.js';

// Police cruiser sprites for 8 screen directions (angles in degrees, screen space).
const CAR_DIRS = [
  { a: 0, key: 'police_side', flip: false, w: 124, base: 0.28 },
  { a: 26.57, key: 'car_police', flip: false, w: 134, base: 0.32 },
  { a: 90, key: 'police_front', flip: false, w: 70, base: 0.3 },
  { a: 153.43, key: 'car_police', flip: true, w: 134, base: 0.32 },
  { a: 180, key: 'police_side', flip: true, w: 124, base: 0.28 },
  { a: 206.57, key: 'police_rear', flip: true, w: 134, base: 0.32 },
  { a: 270, key: 'police_back', flip: false, w: 70, base: 0.3 },
  { a: 333.43, key: 'police_rear', flip: false, w: 134, base: 0.32 },
];

export function carSprite(h) {
  const cx = Math.cos(h), cy = Math.sin(h);
  let a = (Math.atan2((cx + cy) * 0.5, cx - cy) * 180) / Math.PI;
  if (a < 0) a += 360;
  let best = CAR_DIRS[0], bd = 999;
  for (const d of CAR_DIRS) {
    let diff = Math.abs(d.a - a);
    if (diff > 180) diff = 360 - diff;
    if (diff < bd) (bd = diff), (best = d);
  }
  return best;
}

const angDiff = (a, b) => {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

const SEARCH_TIME = { house: 1.4, store: 1.6, trailer: 1.2, car: 0.9, bin: 0.6 };
export const ACTION_LABEL = { search: 'SEARCH', drive: 'DRIVE', talk: 'TALK', pet: 'PET', rig: 'RIG IT', exit: 'GET OUT' };
export const ACTION_ICON = { search: 'btn_search', drive: 'btn_drive', talk: 'btn_talk', pet: 'btn_pet', rig: 'btn_rig', exit: 'btn_exit' };

export const InteractMixin = {
  initInteract() {
    this.interact = null;
    this.search = null;
    this.bombs = [];
    this.rescued = 0;
    this.searchedN = 0;
    this.mission = null;
    this.lastMission = null;
    this.tMission = 14;
    this.missionsDone = 0;
    this.carKills = 0;
    this.evacHint = false;
  },

  // --- what can I do right here? ----------------------------------------------------------------
  findInteract() {
    const p = this.player, w = this.world;
    let best = null, bd = 1e9;
    const consider = (kind, o, d) => {
      if (d < bd) (bd = d), (best = { kind, o });
    };
    for (const c of this.civs) {
      if (c.taken || c.follow) continue;
      const d = Math.sqrt(dist2(c.x, c.y, p.x, p.y));
      if (d < 80) consider('talk', c, d - 70);
    }
    for (const c of this.cows) {
      if (c.state === 'abducted' || c.petCd > 0) continue;
      const d = Math.sqrt(dist2(c.x, c.y, p.x, p.y));
      if (d < 62) consider('pet', c, d - 20);
    }
    const ti = Math.floor(p.x / TILE), tj = Math.floor(p.y / TILE);
    const seen = new Set();
    for (let j = tj - 2; j <= tj + 2; j++)
      for (let i = ti - 2; i <= ti + 2; i++) {
        const k = w.tileIndex((i + 0.5) * TILE, (j + 0.5) * TILE);
        if (k < 0) continue;
        for (const q of w.cgrid[k]) {
          if (seen.has(q)) continue;
          seen.add(q);
          let d;
          if (q.box) {
            const nx = clamp(p.x, q.box.x0, q.box.x1), ny = clamp(p.y, q.box.y0, q.box.y1);
            d = Math.hypot(p.x - nx, p.y - ny);
          } else d = Math.hypot(p.x - q.x, p.y - q.y) - (q.circle || 0);
          if (q.drivable && !q.burning && d < 46) consider('drive', q, d - 4);
          else if (q.search && !q.searched && d < 40) consider('search', q, d + 4);
          else if (q.riggable && !q.rigged && d < 52) consider('rig', q, d);
        }
      }
    return best;
  },

  updateInteract(dt, input) {
    const p = this.player;
    for (const c of this.cows) if (c.petCd > 0) c.petCd -= dt;
    if (this.search) {
      const s = this.search;
      const mag = Math.hypot(input.mx, input.my);
      if (mag > 0.35 || p.car || p.dead) this.search = null;
      else {
        s.t += dt;
        s.noise -= dt;
        if (s.noise <= 0) {
          s.noise = 0.35;
          this.sound.play('rummage');
        }
        if (s.t >= s.dur) this.finishSearch(s.prop);
      }
    }
    this.interact = p.dead ? null : p.car ? { kind: 'exit', o: p.car } : this.search ? null : this.findInteract();
    if (input.action) this.doAction();
    this.updateBombs(dt);
    this.updateMission(dt);
  },

  doAction() {
    const it = this.interact, p = this.player;
    if (!it) return;
    const o = it.o;
    switch (it.kind) {
      case 'exit':
        this.exitCar();
        break;
      case 'talk':
        o.follow = true;
        o.life = 999;
        this.float(pick(o.type === 'civ_tinfoil' ? L.TINFOIL_TALK : L.TALK), o.x, o.y, 12, 2.2);
        this.sound.play('pickup');
        if (!this.evacHint) {
          this.evacHint = true;
          this.say('BRING SURVIVORS TO THE EVAC BUS AT THE SANDBAG FORT. FOLLOW THE GREEN ARROW.', true);
        }
        break;
      case 'pet':
        p.hp = Math.min(p.maxHp, p.hp + 10);
        o.petCd = 25;
        this.sound.play('moo');
        this.float(pick(L.PET), o.x, o.y, 13, 1.8);
        for (let i = 0; i < 6; i++) this.addFx('heart', o.x + rand(-16, 16), o.y + rand(-16, 16), 30, 0, 0, rand(40, 90), rand(0.8, 1.3));
        this.missionEvent('pet');
        break;
      case 'drive':
        this.enterCar(o);
        break;
      case 'search':
        this.search = { prop: o, t: 0, dur: SEARCH_TIME[o.search] || 1, noise: 0 };
        break;
      case 'rig':
        this.rigGas(o);
        break;
    }
  },

  // --- rummaging ---------------------------------------------------------------------------------
  finishSearch(q) {
    const p = this.player;
    q.searched = true;
    this.search = null;
    this.searchedN++;
    const kind = q.search;
    const r = Math.random();
    let drops = [];
    if (kind === 'bin') {
      if (r < 0.45) drops = [weighted([['ammo', 3], ['medkit', 1]])];
      else if (r < 0.65) p.hp = Math.min(p.maxHp, p.hp + 5);
    } else if (kind === 'store') drops = ['medkit', weighted([['ammo', 3], ['grenades', 2], ['smg', 1]])];
    else if (kind === 'trailer') drops = [weighted([['grenades', 3], ['smg', 2], ['core', 1]]), 'ammo'];
    else if (kind === 'car') {
      if (r < 0.85) drops = [weighted([['ammo', 5], ['medkit', 2], ['grenades', 2]])];
    } else if (r < 0.9) {
      drops = [weighted([['ammo', 5], ['medkit', 3], ['grenades', 2], ['smg', 1.2], ['core', 0.4]])];
      if (Math.random() < 0.45) drops.push(weighted([['ammo', 3], ['medkit', 1]]));
    }
    const text = drops.length || (kind === 'bin' && r < 0.65) ? pick(L.FIND[kind]) : pick(L.FIND.empty);
    this.float(text, p.x, p.y, 12, 2.6);
    for (const type of drops) this.pickups.push({ type, x: p.x + rand(-34, 34), y: p.y + rand(-34, 34), t: 0, life: 30, drop: true, pop: 1 });
    this.sound.play(drops.length ? 'pickup' : 'empty');
    // houses are not always as empty as they look
    if (kind === 'house' && Math.random() < 0.12 + this.darkness * 0.1) {
      const e = this.spawnEnemy('crawler', p.x + rand(-40, 40), p.y + rand(-40, 40), 3);
      if (e) this.float('IT WAS NOT EMPTY.', p.x, p.y, 13, 1.6);
    }
    this.missionEvent('search');
  },

  // --- the sheriff's cruiser ---------------------------------------------------------------------
  enterCar(q) {
    const p = this.player;
    const h = q.heading !== undefined ? q.heading : q.flip ? Math.PI / 2 : 0;
    this.world.removeProp(q);
    p.car = { x: q.x, y: q.y, h, speed: 0, hp: q.carHp || 260, maxHp: 260, r: 24, invT: 0, smoke: 0, honk: 0 };
    p.x = q.x;
    p.y = q.y;
    this.search = null;
    this.sound.play('door');
    this.sound.siren(true);
    this.say(pick(L.CAR_IN), true);
  },

  exitCar() {
    const p = this.player, v = p.car;
    if (!v) return;
    if (Math.abs(v.speed) > 150) {
      this.float('SLOW DOWN FIRST. PHYSICS.', p.x, p.y, 12, 1.2);
      return;
    }
    const d = carSprite(v.h);
    const q = this.world.parkCar(v.x, v.y, d.key, d.flip, d.w, d.base);
    q.heading = v.h;
    q.carHp = v.hp;
    p.car = null;
    this.sound.siren(false);
    this.sound.play('door');
    // step out to the side
    const sx = -Math.sin(v.h), sy = Math.cos(v.h);
    for (const side of [1, -1]) {
      const x = v.x + sx * 50 * side, y = v.y + sy * 50 * side;
      if (this.world.isWalkable(x, y)) {
        p.x = x;
        p.y = y;
        break;
      }
    }
    this.world.collide(p);
  },

  damageCar(d) {
    const v = this.player.car;
    if (!v) return;
    v.hp -= d;
    this.sound.play('hit');
    if (v.hp <= 0) this.wreckCar();
  },

  wreckCar() {
    const p = this.player, v = p.car;
    p.car = null;
    this.sound.siren(false);
    const d = carSprite(v.h);
    const q = this.world.parkCar(v.x, v.y, 'car_wreck', d.flip, 132, 0.3);
    q.drivable = false;
    this.ignite(q);
    this.explode(v.x, v.y, 10, true, true);
    this.sound.play('bigboom');
    const sx = -Math.sin(v.h), sy = Math.cos(v.h);
    p.x = v.x + sx * 56;
    p.y = v.y + sy * 56;
    this.world.collide(p);
    this.say(pick(L.CAR_BOOM), true);
    this.hurtPlayer(20, v.x, v.y, 10);
  },

  updateCar(dt, input) {
    const p = this.player, v = p.car, w = this.world;
    v.invT -= dt;
    const [wx, wy] = screenDirToWorld(input.mx, input.my);
    const mag = Math.min(1, Math.hypot(input.mx, input.my));
    if (mag > 0.15) {
      const target = Math.atan2(wy, wx);
      const diff = angDiff(target, v.h);
      if (Math.abs(diff) > 2.5 && v.speed < 60) {
        // pull back: reverse while turning the rear towards the stick
        v.speed += (-130 * mag - v.speed) * Math.min(1, dt * 2);
        v.h += clamp(angDiff(target + Math.PI, v.h), -1.6 * dt, 1.6 * dt);
      } else {
        const turn = 2.7 * (0.3 + 0.7 * Math.min(1, Math.abs(v.speed) / 140));
        v.h += clamp(diff, -turn * dt, turn * dt);
        const want = 350 * mag * (1 - Math.min(0.55, Math.abs(diff) / Math.PI));
        v.speed += (want - v.speed) * Math.min(1, dt * (want > v.speed ? 1.5 : 3));
      }
    } else v.speed *= Math.pow(0.25, dt);
    const ex = v.x + Math.cos(v.h) * v.speed * dt, ey = v.y + Math.sin(v.h) * v.speed * dt;
    v.x = ex;
    v.y = ey;
    w.collide(v);
    const pushed = Math.hypot(v.x - ex, v.y - ey);
    if (pushed > 0.5) {
      if (Math.abs(v.speed) > 110) {
        this.damageCar((Math.abs(v.speed) - 90) * 0.1);
        this.shake = Math.max(this.shake, 6);
        this.sound.play('crash');
        for (let i = 0; i < 5; i++) this.addFx('spark', v.x + Math.cos(v.h) * 24, v.y + Math.sin(v.h) * 24, 14, rand(-120, 120), rand(-120, 120), rand(40, 120), 0.2);
        v.speed *= -0.25;
      } else v.speed *= 0.9;
    }
    if (!p.car) return; // wrecked by the crash
    for (const n of this.nests) {
      const dx = v.x - n.x, dy = v.y - n.y, rr = v.r + n.r, d = Math.hypot(dx, dy);
      if (d < rr && d > 0.01) {
        if (Math.abs(v.speed) > 120) {
          this.damageNest(n, Math.abs(v.speed) * 0.5);
          this.damageCar(12);
          this.sound.play('crash');
          v.speed *= -0.3;
        }
        v.x = n.x + (dx / d) * rr;
        v.y = n.y + (dy / d) * rr;
      }
    }
    if (!p.car) return;
    const sp = Math.abs(v.speed);
    const fx = Math.cos(v.h) * Math.sign(v.speed), fy = Math.sin(v.h) * Math.sign(v.speed);
    for (const e of this.enemies) {
      if (e.dead || e.spawnT < 0.6) continue;
      const dx = e.x - v.x, dy = e.y - v.y, rr = v.r + e.r;
      const d2v = dx * dx + dy * dy;
      if (d2v >= rr * rr) continue;
      const d = Math.sqrt(d2v) || 1;
      if (sp > 70) {
        const brute = e.type === 'brute';
        this.damageEnemy(e, sp * (brute ? 0.3 : 0.6), ((dx / d) * 0.6 + fx) * sp * 1.4, ((dy / d) * 0.6 + fy) * sp * 1.4);
        if (e.dead) {
          this.carKills++;
          this.missionEvent('joyride');
          if (Math.random() < 0.15) this.float(pick(['TEN POINTS!', 'SPEED BUMP.', 'HIT AND RUN. MOSTLY RUN.', 'NO INSURANCE COVERS THIS.']), e.x, e.y, 12, 1.2);
        }
        this.damageCar(brute ? 22 : 2);
        if (brute) v.speed *= 0.3;
        if (!p.car) return;
      }
      e.x = v.x + (dx / d) * rr;
      e.y = v.y + (dy / d) * rr;
    }
    for (const c of this.civs) {
      if (c.taken) continue;
      const dx = c.x - v.x, dy = c.y - v.y, rr = v.r + c.r + 4, d = Math.hypot(dx, dy);
      if (d < rr && d > 0.01) {
        c.x = v.x + (dx / d) * rr;
        c.y = v.y + (dy / d) * rr;
        if (sp > 80 && (c.yell || 0) <= 0) {
          c.yell = 2;
          this.float(pick(['WATCH IT!', 'I HAVE INSURANCE!', 'MY FOOT!']), c.x, c.y, 12, 1.2);
        }
      }
    }
    for (const c of this.cows) {
      if (c.state === 'abducted') continue;
      const dx = c.x - v.x, dy = c.y - v.y, rr = v.r + c.r, d = Math.hypot(dx, dy);
      if (d < rr && d > 0.01) {
        c.x = v.x + (dx / d) * rr;
        c.y = v.y + (dy / d) * rr;
        if (sp > 60) this.sound.play('moo');
      }
    }
    p.x = v.x;
    p.y = v.y;
    p.moving = sp > 20;
    if (p.moving) {
      p.fx = fx;
      p.fy = fy;
    }
    v.smoke -= dt;
    if (v.smoke <= 0 && v.hp < v.maxHp * 0.45) {
      v.smoke = v.hp < v.maxHp * 0.2 ? 0.06 : 0.14;
      this.addFx('smoke', v.x, v.y, 26, rand(-10, 10), rand(-10, 10), rand(30, 60), rand(1, 1.8), 0.8);
      if (v.hp < v.maxHp * 0.2) this.addFx('fire', v.x, v.y, 20, rand(-10, 10), rand(-10, 10), rand(40, 80), rand(0.3, 0.6), 0.7);
    }
  },

  // --- survivors ---------------------------------------------------------------------------------
  rescueCiv(c) {
    c.taken = 'rescued';
    this.rescued++;
    const e = this.world.evac;
    this.float('RESCUED!', c.x, c.y, 15, 1.6);
    this.say(pick(L.RESCUE), true);
    this.sound.play('rescue');
    for (let i = 0; i < 2; i++) {
      const type = weighted([['ammo', 4], ['medkit', 3], ['grenades', 3], ['smg', 1.5], ['core', 1]]);
      this.pickups.push({ type, x: e.x + rand(-50, 50), y: e.y + rand(-50, 50), t: 0, life: 40, drop: true, pop: 1 });
    }
    this.missionEvent('rescue');
  },

  // --- the gas station gambit ----------------------------------------------------------------------
  rigGas(q) {
    q.rigged = true;
    this.bombs.push({ x: q.x, y: q.y, t: 5, beep: 0, prop: q });
    this.showBanner('RUN!', 'THE GAS STATION IS ABOUT TO BECOME A CRATER');
    this.say(pick(L.RIG), true);
  },

  updateBombs(dt) {
    for (const b of this.bombs) {
      b.t -= dt;
      b.beep -= dt;
      if (b.beep <= 0) {
        b.beep = Math.max(0.12, b.t / 5);
        this.sound.play('beep');
      }
      if (b.t <= 0 && !b.done) {
        b.done = true;
        const R = 360;
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          setTimeout(() => !this.over && this.explode(b.x + Math.cos(a) * 90, b.y + Math.sin(a) * 60, 20, true, true), k * 90);
        }
        this.explode(b.x, b.y, 30, true, true);
        for (const e of this.enemies) if (dist2(e.x, e.y, b.x, b.y) < R * R) this.damageEnemy(e, 700);
        for (const n of this.nests) if (dist2(n.x, n.y, b.x, b.y) < R * R) this.damageNest(n, 900);
        const p = this.player;
        if (dist2(p.x, p.y, b.x, b.y) < 240 * 240) this.hurtPlayer(45, b.x, b.y, 40);
        for (const q of this.world.props) if (q.box && dist2(q.x, q.y, b.x, b.y) < 420 * 420 && Math.random() < 0.7) this.ignite(q);
        this.ignite(b.prop);
        this.addDecal('crater', b.x, b.y, 2.4);
        this.shake = 30;
        this.flashes.push({ x: b.x, y: b.y, z: 60, r: 900, t: 0.6, color: 'orange' });
        this.say('THE GAS STATION IS GONE. SO ARE YOUR EYEBROWS.', true);
        this.missionEvent('gas');
      }
    }
    this.bombs = this.bombs.filter((b) => !b.done);
  },

  // --- dispatcher missions -------------------------------------------------------------------------
  startMission() {
    const p = this.player, w = this.world;
    const opts = [['search', 3]];
    if (w.evac) opts.push(['rescue', 3]);
    if (this.nests.length) opts.push(['nest', 4]);
    if (p.car || w.props.some((q) => q.drivable)) opts.push(['joyride', 2.2]);
    if (this.cows.some((c) => c.state !== 'abducted')) opts.push(['pet', 1]);
    if (this.time > 100 && w.props.some((q) => q.riggable && !q.rigged)) opts.push(['gas', 1.4]);
    const pool = opts.filter((o) => o[0] !== this.lastMission);
    const type = weighted(pool.length ? pool : opts);
    const m = { type, t: 0, limit: type === 'joyride' ? 150 : 120, count: 0, need: type === 'search' ? 3 : type === 'joyride' ? 8 : 1 };
    if (type === 'rescue') {
      const c = this.spawnCiv(true);
      if (!c) return;
      m.civ = c;
    }
    if (type === 'nest') {
      let best = null, bd = 1e12;
      for (const n of this.nests) {
        const d = dist2(n.x, n.y, p.x, p.y);
        if (d < bd) (bd = d), (best = n);
      }
      m.nest = best;
    }
    this.startMissionObj(m);
  },

  startMissionObj(m) {
    this.mission = m;
    this.lastMission = m.type;
    this.say(L.MISSIONS[m.type].line, true);
    this.sound.play('radio');
  },

  missionEvent(kind) {
    const m = this.mission;
    if (!m || m.type !== kind) return;
    m.count++;
    if (m.count >= m.need) this.completeMission();
  },

  completeMission() {
    const p = this.player;
    this.missionsDone++;
    this.showBanner('MISSION COMPLETE', L.MISSIONS[this.mission.type].text);
    this.say(pick(L.MISSION_DONE), true);
    this.sound.play('mission');
    for (let i = 0; i < 3; i++) {
      const type = weighted([['ammo', 4], ['medkit', 3], ['grenades', 3], ['smg', 2], ['core', 1.2]]);
      this.pickups.push({ type, x: p.x + rand(-50, 50), y: p.y + rand(-50, 50), t: 0, life: 35, drop: true, pop: 1 });
    }
    this.mission = null;
    this.tMission = 14;
  },

  failMission(why) {
    this.say(why || pick(L.MISSION_FAIL), true);
    this.mission = null;
    this.tMission = 12;
  },

  updateMission(dt) {
    const m = this.mission;
    if (!m) {
      this.tMission -= dt;
      if (this.tMission <= 0) {
        this.tMission = 5;
        this.startMission();
      }
      return;
    }
    m.t += dt;
    if (m.type === 'rescue' && m.civ.taken && m.civ.taken !== 'rescued') return this.failMission('DISPATCH: YOU LOST THE SURVIVOR. THEY WERE PROBABLY A NICE PERSON. PROBABLY.');
    if (m.type === 'nest' && !this.nests.includes(m.nest) && m.count < m.need) return this.completeMission();
    if (m.type === 'cow' && m.ufo && m.ufo.gone && !m.ufo.dead) return this.failMission('DISPATCH: THE COW IS GONE. SHE GETS HER OWN SHOW NOW. YOU GET NOTHING.');
    if (m.t > m.limit) this.failMission('DISPATCH: TOO SLOW. WE GAVE THE JOB TO A RACCOON.');
  },

  // Where the mission arrow should point.
  missionTarget() {
    const m = this.mission, p = this.player, w = this.world;
    if (!m) return null;
    const nearest = (list) => {
      let best = null, bd = 1e12;
      for (const o of list) {
        const d = dist2(o.x, o.y, p.x, p.y);
        if (d < bd) (bd = d), (best = o);
      }
      return best;
    };
    switch (m.type) {
      case 'search':
        return nearest(w.props.filter((q) => q.search && q.search !== 'bin' && !q.searched));
      case 'rescue':
        return m.civ.follow ? w.evac : m.civ;
      case 'nest':
        return m.nest;
      case 'joyride':
        return p.car ? null : nearest(w.props.filter((q) => q.drivable));
      case 'pet':
        return nearest(this.cows.filter((c) => c.state !== 'abducted'));
      case 'gas':
        return nearest(w.props.filter((q) => q.riggable && !q.rigged));
      case 'cow':
        return m.ufo && !m.ufo.gone ? m.ufo : null;
    }
    return null;
  },
};
