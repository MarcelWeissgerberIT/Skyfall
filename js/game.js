// Game simulation: player, aliens, saucers, meteors, critters and the escalation director.
import { TILE, rand, randi, pick, clamp, dist2, weighted, screenDirToWorld, worldDirToScreen } from './util.js';
import { World, N, WORLD } from './world.js';
import * as L from './lines.js';
import { InteractMixin } from './interact.js';

export const ENEMY = {
  grunt: { sprite: 'alien_grunt', hp: 34, speed: 72, r: 10, dmg: 9, size: ['h', 52], drop: 0.15 },
  crawler: { sprite: 'alien_crawler', hp: 15, speed: 140, r: 9, dmg: 6, size: ['w', 40], drop: 0.08 },
  spitter: { sprite: 'alien_spitter', hp: 28, speed: 58, r: 10, dmg: 6, size: ['h', 54], drop: 0.2, ranged: true },
  brute: { sprite: 'alien_brute', hp: 230, speed: 46, r: 20, dmg: 22, size: ['w', 84], drop: 0.75 },
};

const WEAPONS = {
  shotgun: { cd: 0.6, n: 6, spread: 0.46, speed: 900, range: 330, dmg: 11, knock: 140, kind: 'pellet', sound: 'shotgun' },
  revolver: { cd: 0.42, n: 1, spread: 0.02, speed: 1050, range: 370, dmg: 17, knock: 80, kind: 'pellet', sound: 'pistol' },
  smg: { cd: 0.075, n: 1, spread: 0.14, speed: 1000, range: 370, dmg: 8, knock: 40, kind: 'smg', sound: 'smg' },
  plasma: { cd: 0.17, n: 3, spread: 0.3, speed: 720, range: 430, dmg: 24, knock: 90, kind: 'plasma', pierce: 3, sound: 'plasma' },
};

const PICKUPS = ['ammo', 'medkit', 'grenades', 'smg', 'core'];
export const PICKUP_SPRITE = { ammo: 'pk_ammo', medkit: 'pk_medkit', grenades: 'pk_grenades', smg: 'pk_smg', core: 'pk_core' };
const CIVS = ['civ_dad', 'civ_curlers', 'civ_tinfoil'];

const DAY = 160; // seconds per day/night cycle

export class Game {
  constructor(sound) {
    this.sound = sound;
    this.viewR = 600;
    this.reset();
  }

  reset() {
    this.world = new World((Math.random() * 1e9) | 0);
    const s = this.world.start;
    this.player = {
      x: s.x, y: s.y, r: 11, hp: 100, maxHp: 100, shells: 30, grenades: 2,
      aimX: 1, aimY: 0, fx: -1, fy: 1, moving: false, walkT: 0, fireCd: 0,
      smgT: 0, plasmaT: 0, invT: 0, hurtT: 0, lastHit: 0, recoil: 0, dead: false,
    };
    this.enemies = [];
    this.civs = [];
    this.cows = this.world.cows.map((c) => ({ x: c.x, y: c.y, r: 12, vx: 0, vy: 0, t: rand(5), state: 'graze', flip: Math.random() < 0.5, z: 0, rot: 0, scale: 1 }));
    this.pickups = [];
    this.nests = [];
    this.ufos = [];
    this.mother = null;
    this.bullets = [];
    this.ebullets = [];
    this.grenades = [];
    this.meteors = [];
    this.decals = [];
    this.fx = [];
    this.floaters = [];
    this.flashes = [];
    this.tumbleweeds = [];
    this.vultures = [];
    this.fires = [];
    this.time = 0;
    this.kills = 0;
    this.shake = 0;
    this.hurtFlash = 0;
    this.level = 0;
    this.banner = null;
    this.ticker = [];
    this.tickerCur = null;
    this.over = false;
    this.overT = 0;
    // director timers
    this.tSpawn = 1.5;
    this.tUfo = 9;
    this.tNest = 70;
    this.tShower = 95;
    this.showerT = 0;
    this.tMother = 240;
    this.tLoot = 2;
    this.tCiv = 14;
    this.tFire = 12;
    this.tAmbient = 22;
    this.tLowHp = 0;
    this.tTumble = 3;
    this.tLoneMeteor = 30;
    this.phase = 'day';
    this.milestones = new Set();
    this.initInteract();
    this.sound.siren(false);
    this.say(pick(L.INTRO), true);
    for (let i = 0; i < 2; i++) this.vultures.push(this.makeVulture());
    // initial loot so the first minute is not pure misery
    for (let i = 0; i < 6; i++) this.spawnLoot();
  }

  // --- messaging -------------------------------------------------------------
  say(text, priority = false) {
    if (priority) this.ticker.unshift(text);
    else if (this.ticker.length < 3) this.ticker.push(text);
    if (priority && this.tickerCur && this.tickerCur.t > 1.2) this.tickerCur.t = Math.max(this.tickerCur.t, this.tickerCur.dur - 0.3);
  }
  showBanner(text, sub) {
    this.banner = { text, sub, t: 0, dur: 3.2 };
    this.sound.play('sting');
  }
  float(text, x, y, size = 15, life = 1.4) {
    // stack texts that pop up at the same time so they stay readable
    let z = 46;
    for (const f of this.floaters) if (f.t < 0.6 && Math.abs(f.x - x) + Math.abs(f.y - y) < 80) z = Math.max(z, f.z + 24);
    this.floaters.push({ text, x, y, z, t: 0, life, size });
  }

  // --- escalation helpers ----------------------------------------------------
  get threat() {
    return Math.min(L.THREAT.length - 1, Math.floor(this.time / 90));
  }
  dayPhase() {
    const c = ((this.time + 8) % DAY) / DAY;
    // 0..0.42 day, 0.42..0.52 dusk, 0.52..0.88 night, 0.88..1 dawn
    let dark = 0, warm = 0, ph = 'day';
    if (c < 0.42) {
      warm = Math.max(0, (c - 0.3) / 0.12) * 0.6;
    } else if (c < 0.52) {
      const k = (c - 0.42) / 0.1;
      dark = k;
      warm = 0.6 + 0.4 * Math.sin(k * Math.PI);
      ph = 'dusk';
    } else if (c < 0.88) {
      dark = 1;
      ph = 'night';
    } else {
      const k = (c - 0.88) / 0.12;
      dark = 1 - k;
      warm = Math.sin(k * Math.PI) * 0.8;
      ph = 'dawn';
    }
    return { dark, warm, ph };
  }

  // --- main update -----------------------------------------------------------
  update(dt, input) {
    if (this.over) {
      this.overT += dt;
      this.updateFx(dt);
      return;
    }
    this.time += dt;
    const p = this.player;
    const day = this.dayPhase();
    this.darkness = day.dark;
    this.warmth = day.warm;
    this.apoc = clamp((this.time - 170) / 700, 0, 0.75);
    this.sound.intensity = clamp(this.time / 600 + day.dark * 0.2, 0, 1);

    this.updateDirector(dt, day);
    this.updatePlayer(dt, input);
    this.updateInteract(dt, input);
    this.world.updateFlow(p.x, p.y);
    this.updateEnemies(dt);
    this.updateCivs(dt);
    this.updateCows(dt);
    this.updateUfos(dt);
    this.updateMother(dt);
    this.updateNests(dt);
    this.updateBullets(dt);
    this.updateGrenades(dt);
    this.updateMeteors(dt);
    this.updatePickups(dt);
    this.updateAmbient(dt);
    this.updateFx(dt);

    this.shake = Math.max(0, this.shake - dt * 30);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2);
    if (this.banner && (this.banner.t += dt) > this.banner.dur) this.banner = null;
    this.updateTicker(dt);
  }

  updateTicker(dt) {
    if (this.tickerCur) {
      this.tickerCur.t += dt;
      if (this.tickerCur.t > this.tickerCur.dur) this.tickerCur = null;
    }
    if (!this.tickerCur && this.ticker.length) {
      const text = this.ticker.shift();
      this.tickerCur = { text, t: 0, dur: 3 + text.length * 0.055 };
      this.sound.play('radio');
    }
  }

  // --- director: decides what horrible thing happens next ---------------------
  updateDirector(dt, day) {
    const t = this.time;
    const p = this.player;
    // threat level
    if (this.threat > this.level) {
      this.level = this.threat;
      const th = L.THREAT[this.level];
      this.showBanner('THREAT LEVEL ' + (this.level + 1), th.name);
      this.say(th.line, true);
      this.vultures.push(this.makeVulture());
    }
    // day / night transitions
    if (day.ph !== this.phase) {
      if (day.ph === 'dusk') {
        this.showBanner('NIGHT FALLS', 'LIGHTS ON. HOPE ON STANDBY.');
        this.say(pick(L.NIGHT), true);
      } else if (day.ph === 'dawn') {
        this.showBanner('DAWN', 'STILL ALIVE. SOMEHOW.');
        this.say(pick(L.DAWN), true);
      }
      this.phase = day.ph;
    }

    // regular alien spawns
    const alive = this.enemies.length;
    const cap = Math.min(150, 12 + t * 0.14);
    const rate = (0.42 + t * 0.0072) * (1 + day.dark * 0.6);
    this.tSpawn -= dt;
    if (this.tSpawn <= 0) {
      this.tSpawn = 1 / rate;
      if (alive < cap) {
        const n = t > 240 && Math.random() < 0.3 ? randi(2, 4) : 1;
        const spot = this.edgeSpot();
        if (spot) for (let k = 0; k < n; k++) this.spawnEnemy(this.rollType(), spot.x + rand(-40, 40), spot.y + rand(-40, 40), 0.9);
      }
    }

    // drop ships
    this.tUfo -= dt;
    if (this.tUfo <= 0) {
      this.tUfo = Math.max(7, 19 - t / 28) * rand(0.8, 1.2);
      const victims = this.cows.filter((c) => c.state !== 'abducted' && dist2(c.x, c.y, p.x, p.y) < 900 * 900);
      if (victims.length && Math.random() < 0.35) this.spawnUfo('abduct', pick(victims));
      else if (alive < cap + 10) this.spawnUfo('drop');
    }

    // landed nests
    this.tNest -= dt;
    if (this.tNest <= 0) {
      this.tNest = 55 + rand(0, 25);
      if (this.nests.length < Math.min(4, 1 + Math.floor(t / 160))) this.spawnNest();
    }

    // meteor showers - the actual skyfall
    this.tShower -= dt;
    if (this.tShower <= 0) {
      this.tShower = rand(55, 80) - Math.min(25, t / 30);
      this.showerT = 8 + this.level * 2;
      this.showBanner('SKYFALL!', 'METEOR SHOWER INBOUND');
      this.say(pick(L.METEOR), true);
    }
    if (this.showerT > 0) {
      this.showerT -= dt;
      const r = 2.2 + this.level * 0.9;
      if (Math.random() < r * dt) this.spawnMeteor(p.x + rand(-380, 380), p.y + rand(-380, 380), Math.random() < 0.15 + this.level * 0.05);
      if (Math.random() < 0.6 * dt) this.spawnMeteor(p.x + rand(-60, 60), p.y + rand(-60, 60), false); // a personal one
    }
    if (this.level >= 3) {
      this.tLoneMeteor -= dt;
      if (this.tLoneMeteor <= 0) {
        this.tLoneMeteor = rand(3, 7) - this.level * 0.3;
        this.spawnMeteor(p.x + rand(-500, 500), p.y + rand(-500, 500), false);
      }
    }

    // mothership
    this.tMother -= dt;
    if (this.tMother <= 0 && !this.mother) {
      this.tMother = 210;
      this.spawnMother();
    }

    // loot keeps trickling in
    this.tLoot -= dt;
    if (this.tLoot <= 0) {
      this.tLoot = 6;
      if (this.pickups.filter((k) => !k.drop).length < 9) this.spawnLoot();
    }

    // civilians wander out of their houses
    this.tCiv -= dt;
    if (this.tCiv <= 0) {
      this.tCiv = rand(28, 42);
      if (this.civs.length < 3) this.spawnCiv();
    }

    // escalation: the town starts burning
    if (t > 170) {
      this.tFire -= dt;
      if (this.tFire <= 0) {
        this.tFire = Math.max(10, 30 - this.level * 3);
        this.igniteNear(p.x, p.y, 750, true);
      }
    }

    this.tAmbient -= dt;
    if (this.tAmbient <= 0) {
      this.tAmbient = rand(18, 30);
      this.say(pick(L.AMBIENT));
    }

    this.tTumble -= dt;
    if (this.tTumble <= 0) {
      this.tTumble = rand(2.5, 6);
      if (this.tumbleweeds.length < 6) this.spawnTumbleweed();
    }
  }

  rollType() {
    const t = this.time;
    return weighted([
      ['grunt', 10],
      ['crawler', t > 50 ? 3 + t / 50 : 0],
      ['spitter', t > 140 ? 2 + t / 110 : 0],
      ['brute', t > 200 ? 0.6 + t / 220 : 0],
    ]);
  }

  edgeSpot() {
    const p = this.player;
    return this.world.randomSpot(p.x, p.y, this.viewR + 40, this.viewR + 220, 40);
  }

  spawnEnemy(type, x, y, materialize = 0) {
    const def = ENEMY[type];
    const scale = 1 + this.time / 380;
    const e = {
      type, def, x, y, r: def.r, hp: def.hp * scale, maxHp: def.hp * scale,
      speed: def.speed * Math.min(1.45, 1 + this.time / 1000) * rand(0.9, 1.1),
      vx: 0, vy: 0, kx: 0, ky: 0, atkCd: 0, shootCd: rand(1, 2.5), chargeCd: rand(2, 4), chargeT: 0,
      spawnT: materialize ? 0 : 1, matSpeed: materialize || 1, hitT: 0, walkT: rand(5), flip: false, target: null, retarget: 0,
    };
    this.enemies.push(e);
    return e;
  }

  spawnUfo(mode, victim = null) {
    const p = this.player;
    const ang = rand(Math.PI * 2);
    let tx, ty;
    if (mode === 'abduct') (tx = victim.x), (ty = victim.y);
    else {
      const s = this.world.randomSpot(p.x, p.y, 230, 420) || { x: p.x + 300, y: p.y };
      tx = s.x;
      ty = s.y;
    }
    const sx = tx + Math.cos(ang) * 1400, sy = ty + Math.sin(ang) * 1400;
    this.ufos.push({
      mode, victim, x: sx, y: sy, z: 230, tx, ty, sx, sy, state: 'in', t: 0, beam: 0,
      drops: Math.min(14, 3 + Math.floor(this.time / 65)), dropT: 0, hp: 160 + this.time * 0.6, maxHp: 160 + this.time * 0.6, hitT: 0, spin: rand(6),
    });
    if (mode === 'abduct' && victim) {
      victim.target = true;
      victim.state = 'graze';
      victim.t = 99;
      if (!this.mission) this.startMissionObj({ type: 'cow', t: 0, limit: 30, count: 0, need: 1, ufo: this.ufos[this.ufos.length - 1] });
    }
  }

  spawnNest() {
    const p = this.player;
    const s = this.world.randomSpot(p.x, p.y, 420, 800, 60);
    if (!s) return;
    const hp = 420 + this.time * 1.6;
    this.nests.push({ x: s.x, y: s.y, r: 46, hp, maxHp: hp, spawnCd: 3, land: 0, hitT: 0, pulse: 0 });
    this.showBanner('UFO LANDED', 'IT IS MAKING MORE OF THEM');
    this.say(pick(L.NEST), true);
  }

  spawnMother() {
    const p = this.player;
    const hp = 2200 + this.time * 4;
    this.mother = { x: p.x - 900, y: p.y - 900, z: 260, hp, maxHp: hp, t: 0, fireCd: 3, dropCd: 6, hitT: 0, state: 'in', leaveT: 75 };
    this.showBanner('MOTHERSHIP', 'SHE IS VERY DISAPPOINTED IN YOU');
    this.say(pick(L.MOTHER_IN), true);
  }

  spawnMeteor(x, y, big) {
    if (x < 0 || y < 0 || x > WORLD || y > WORLD) return;
    const dur = big ? 2.0 : 1.5;
    this.meteors.push({ x, y, t: dur, dur, big, ang: rand(-0.5, 0.5) });
    this.sound.play('whistle');
  }

  spawnLoot() {
    const p = this.player;
    const w = this.world;
    let spot = null;
    if (w.lootSpots.length && Math.random() < 0.5) {
      const near = w.lootSpots.filter((s) => {
        const d = dist2(s.x, s.y, p.x, p.y);
        return d > 200 * 200 && d < 900 * 900;
      });
      if (near.length) spot = pick(near);
    }
    if (!spot) spot = w.randomSpot(p.x, p.y, 250, 750);
    if (!spot) return;
    const type = weighted([['ammo', 6], ['medkit', 3], ['grenades', 2], ['smg', 1.2], ['core', 0.6]]);
    this.pickups.push({ type, x: spot.x + rand(-10, 10), y: spot.y + rand(-10, 10), t: rand(5), life: Infinity, drop: false });
  }

  drop(x, y, chance) {
    if (Math.random() > chance) return;
    const p = this.player;
    const type = weighted([
      ['ammo', p.shells < 10 ? 9 : 5],
      ['medkit', p.hp < 50 ? 4 : 1.5],
      ['grenades', 1.4],
      ['smg', 0.7],
      ['core', 0.35],
    ]);
    this.pickups.push({ type, x, y, t: 0, life: 22, drop: true, pop: 1 });
  }

  spawnCiv(forMission = false) {
    const p = this.player;
    if (forMission) {
      const s = this.world.randomSpot(p.x, p.y, 380, 680);
      if (!s) return null;
      const c = { type: pick(CIVS), x: s.x, y: s.y, r: 10, vx: 0, vy: 0, t: 0, walkT: 0, panic: rand(1), flip: false, gave: true, life: 999, quipT: rand(3, 6), fade: 1, mission: true };
      this.civs.push(c);
      return c;
    }
    const houses = this.world.props.filter((h) => h.box && h.type.startsWith('house') && dist2(h.x, h.y, p.x, p.y) < 800 * 800 && dist2(h.x, h.y, p.x, p.y) > 250 * 250);
    let s;
    if (houses.length) {
      const h = pick(houses);
      s = this.world.randomSpot(h.x, h.y, 120, 170, 20);
    }
    if (!s) s = this.world.randomSpot(p.x, p.y, 300, 600);
    if (!s) return;
    const type = Math.random() < 0.25 ? 'civ_tinfoil' : pick(CIVS.slice(0, 2));
    this.civs.push({ type, x: s.x, y: s.y, r: 10, vx: 0, vy: 0, t: 0, walkT: 0, panic: rand(1), flip: false, gave: false, life: 45, quipT: rand(3, 6), fade: 1 });
    if (Math.random() < 0.4) this.say(pick(L.CIV_SPAWN));
  }

  spawnTumbleweed() {
    const p = this.player;
    const x = p.x - this.viewR - 60 + rand(-100, 100), y = p.y + rand(-this.viewR, this.viewR);
    this.tumbleweeds.push({ x, y, z: 0, vz: 0, vx: rand(70, 130), vy: rand(-25, 25), rot: 0, life: 18 });
  }

  makeVulture() {
    return { cx: this.player.x + rand(-300, 300), cy: this.player.y + rand(-300, 300), a: rand(6), r: rand(140, 260), z: rand(260, 340), sp: rand(0.25, 0.45) * (Math.random() < 0.5 ? 1 : -1) };
  }

  igniteNear(x, y, radius, announce = false) {
    const cands = this.world.props.filter((q) => q.box && !q.burning && dist2(q.x, q.y, x, y) < radius * radius && (q.type.startsWith('house') || q.type.startsWith('car') || q.type === 'store' || q.type === 'trailer' || q.type === 'gas_station'));
    if (!cands.length) return null;
    const q = pick(cands);
    this.ignite(q);
    if (announce && Math.random() < 0.35) this.say(pick(['ANOTHER HOUSE IS ON FIRE. THE FIRE DEPARTMENT HAS BEEN ABDUCTED.', 'SOMETHING IS BURNING. IT IS EVERYTHING. EVERYTHING IS BURNING.', 'THAT HOUSE HAD A POOL. NOW IT HAS A HOT TUB.']));
    return q;
  }
  ignite(q) {
    if (q.burning) return;
    q.burning = true;
    this.fires.push({ prop: q, t: 0, emit: 0 });
  }

  // --- player ------------------------------------------------------------------
  updatePlayer(dt, input) {
    const p = this.player;
    p.fireCd -= dt;
    p.invT -= dt;
    p.hurtT = Math.max(0, p.hurtT - dt);
    p.recoil = Math.max(0, p.recoil - dt * 6);
    p.smgT = Math.max(0, p.smgT - dt);
    p.plasmaT = Math.max(0, p.plasmaT - dt);
    p.lastHit += dt;
    if (p.lastHit > 5 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 1.4 * dt);
    if (p.car) return this.updateCar(dt, input);

    // movement
    const [wx, wy] = screenDirToWorld(input.mx, input.my);
    const mag = Math.min(1, Math.hypot(input.mx, input.my));
    const speed = 168 * mag;
    p.moving = mag > 0.1;
    p.x += wx * speed * dt;
    p.y += wy * speed * dt;
    if (p.moving) {
      p.walkT += dt * (0.6 + mag);
      p.fx = wx;
      p.fy = wy;
    }
    this.world.collide(p);
    for (const n of this.nests) pushOut(p, n.x, n.y, n.r);

    // aiming
    let target = null, tx = 0, ty = 0;
    if (input.aim) {
      const [ax, ay] = screenDirToWorld(input.ax, input.ay);
      p.aimX = ax;
      p.aimY = ay;
      target = 'manual';
    } else {
      const t = this.findTarget();
      if (t) {
        target = t;
        tx = t.x - p.x;
        ty = t.y - p.y;
        const l = Math.hypot(tx, ty) || 1;
        p.aimX = tx / l;
        p.aimY = ty / l;
      } else if (p.moving) {
        p.aimX = p.fx;
        p.aimY = p.fy;
      }
    }

    // shooting
    if (target && p.fireCd <= 0) this.fire();

    if (input.grenade) this.throwGrenade();

    // low HP heckling
    this.tLowHp -= dt;
    if (p.hp < 30 && this.tLowHp <= 0) {
      this.tLowHp = 25;
      this.say(pick(L.LOW_HP), true);
    }
  }

  findTarget() {
    const p = this.player, w = this.world;
    const range = 340;
    const cands = [];
    for (const e of this.enemies) {
      if (e.spawnT < 0.6 || e.dead) continue;
      const d = dist2(e.x, e.y, p.x, p.y);
      if (d < range * range) cands.push([d, e]);
    }
    cands.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < Math.min(5, cands.length); i++) {
      const e = cands[i][1];
      if (w.los(p.x, p.y, e.x, e.y)) return e;
    }
    for (const n of this.nests) if (n.land >= 1 && dist2(n.x, n.y, p.x, p.y) < (range + 40) ** 2 && w.los(p.x, p.y, n.x, n.y)) return n;
    for (const u of this.ufos) if (u.state === 'hover' && dist2(u.x, u.y, p.x, p.y) < (range + 40) ** 2) return u;
    const m = this.mother;
    if (m && m.state === 'fight' && dist2(m.x, m.y, p.x, p.y) < (range + 120) ** 2) return m;
    return null;
  }

  fire() {
    const p = this.player;
    let wname = 'shotgun';
    if (p.plasmaT > 0) wname = 'plasma';
    else if (p.smgT > 0) wname = 'smg';
    else if (p.shells <= 0) wname = 'revolver';
    const w = WEAPONS[wname];
    p.fireCd = w.cd;
    if (wname === 'shotgun') {
      p.shells--;
      if (p.shells === 0) this.say(pick(L.NO_AMMO), true);
    }
    const base = Math.atan2(p.aimY, p.aimX);
    for (let i = 0; i < w.n; i++) {
      const a = base + (w.n > 1 ? (i / (w.n - 1) - 0.5) * w.spread : 0) + rand(-0.04, 0.04) + (wname === 'smg' ? rand(-w.spread, w.spread) / 2 : 0);
      const sp = w.speed * rand(0.92, 1.05);
      this.bullets.push({ x: p.x + p.aimX * 18, y: p.y + p.aimY * 18, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: w.range / w.speed, dmg: w.dmg, knock: w.knock, kind: w.kind, pierce: w.pierce || 1, hits: null });
    }
    p.recoil = 1;
    this.sound.play(w.sound);
    // muzzle flash light + particles
    const mx = p.x + p.aimX * 22, my = p.y + p.aimY * 22;
    this.flashes.push({ x: mx, y: my, z: 34, r: wname === 'shotgun' ? 150 : 90, t: 0.07, color: wname === 'plasma' ? 'magenta' : 'yellow' });
    for (let i = 0; i < (wname === 'shotgun' ? 6 : 2); i++) this.addFx('spark', mx, my, 34, p.aimX * rand(100, 300) + rand(-60, 60), p.aimY * rand(100, 300) + rand(-60, 60), rand(-20, 60), rand(0.08, 0.18));
    if (wname === 'shotgun') {
      this.addFx('smoke', mx, my, 34, p.aimX * 30, p.aimY * 30, 20, rand(0.5, 0.9), 0.4);
      // ejected shell
      this.addFx('shell', p.x, p.y, 34, -p.aimY * rand(40, 90), p.aimX * rand(40, 90), rand(80, 140), 1.2);
    }
  }

  throwGrenade() {
    const p = this.player;
    if (p.grenades <= 0) {
      this.float('NO GRENADES. JUST VIBES.', p.x, p.y, 13);
      this.sound.play('empty');
      return;
    }
    p.grenades--;
    // aim for the juiciest cluster
    let best = null, bestN = 0;
    for (const e of this.enemies) {
      const d = dist2(e.x, e.y, p.x, p.y);
      if (d > 360 * 360 || d < 70 * 70) continue;
      let n = 0;
      for (const o of this.enemies) if (dist2(e.x, e.y, o.x, o.y) < 110 * 110) n += o.type === 'brute' ? 3 : 1;
      if (n > bestN) (bestN = n), (best = e);
    }
    let tx, ty;
    if (best) (tx = best.x), (ty = best.y);
    else (tx = p.x + p.aimX * 230), (ty = p.y + p.aimY * 230);
    const d = Math.hypot(tx - p.x, ty - p.y);
    this.grenades.push({ sx: p.x, sy: p.y, tx, ty, x: p.x, y: p.y, z: 30, t: 0, dur: 0.35 + d / 700, fuse: 0.35, landed: false, rot: 0 });
    this.sound.play('throw');
  }

  hurtPlayer(dmg, fromX, fromY, knock = 0) {
    const p = this.player;
    if (p.car) {
      // the cruiser takes the beating instead
      if (p.car.invT <= 0) {
        p.car.invT = 0.15;
        this.damageCar(dmg);
      }
      return;
    }
    if (p.invT > 0 || this.over) return;
    p.hp -= dmg;
    p.invT = 0.35;
    p.hurtT = 0.25;
    p.lastHit = 0;
    this.hurtFlash = Math.min(1, this.hurtFlash + 0.5);
    this.shake = Math.max(this.shake, 6);
    this.sound.play('hurt');
    try {
      navigator.vibrate && navigator.vibrate(25);
    } catch {}
    if (knock && fromX !== undefined) {
      const dx = p.x - fromX, dy = p.y - fromY, l = Math.hypot(dx, dy) || 1;
      p.x += (dx / l) * knock;
      p.y += (dy / l) * knock;
      this.world.collide(p);
    }
    for (let i = 0; i < 4; i++) this.addFx('blood', p.x, p.y, 30, rand(-90, 90), rand(-90, 90), rand(40, 120), 0.6);
    if (p.hp <= 0) this.gameOver();
  }

  gameOver() {
    const p = this.player;
    p.hp = 0;
    p.dead = true;
    this.over = true;
    this.overT = 0;
    this.sound.siren(false);
    this.deathLine = pick(L.DEATH);
    this.sound.play('over');
    this.explode(p.x, p.y, 0, false, true);
  }

  // --- aliens ------------------------------------------------------------------
  updateEnemies(dt) {
    const p = this.player, w = this.world;
    const grid = (this.grid = new Map());
    for (const e of this.enemies) {
      const k = ((e.x >> 6) & 0xffff) | (((e.y >> 6) & 0xffff) << 16);
      let a = grid.get(k);
      if (!a) grid.set(k, (a = []));
      a.push(e);
    }
    const nightBoost = 1 + this.darkness * 0.12;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.hitT = Math.max(0, e.hitT - dt);
      if (e.spawnT < 1) {
        e.spawnT = Math.min(1, e.spawnT + dt * e.matSpeed);
        continue;
      }
      e.atkCd -= dt;
      e.walkT += dt;
      // pick prey: the player, or a juicier civilian nearby
      e.retarget -= dt;
      if (e.retarget <= 0) {
        e.retarget = 0.8;
        e.target = null;
        const dp = dist2(e.x, e.y, p.x, p.y);
        for (const c of this.civs) {
          if (c.taken) continue;
          const dc = dist2(e.x, e.y, c.x, c.y);
          if (dc < 220 * 220 && dc < dp * 0.6) e.target = c;
        }
      }
      const tgt = e.target || p;
      let dx = tgt.x - e.x, dy = tgt.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;
      let mx = dx, my = dy;
      if (!e.target) {
        const f = w.flowDir(e.x, e.y);
        if (f && !(d < 200 && w.los(e.x, e.y, p.x, p.y))) (mx = f[0]), (my = f[1]);
      }
      let sp = e.speed * nightBoost;
      if (e.def.ranged && !e.target) {
        // keep a polite shooting distance
        if (d < 200) (mx = -dx), (my = -dy), (sp *= 0.7);
        else if (d < 290 && w.los(e.x, e.y, p.x, p.y)) sp *= 0.15;
        e.shootCd -= dt;
        if (e.shootCd <= 0 && d < 330 && w.los(e.x, e.y, p.x, p.y)) {
          e.shootCd = rand(1.8, 2.8) / (1 + this.time / 600);
          this.ebullets.push({ x: e.x + dx * 16, y: e.y + dy * 16, vx: dx * 210, vy: dy * 210, life: 2.2, dmg: 10 });
          this.sound.play('enemyShot');
        }
      }
      if (e.type === 'brute') {
        e.chargeCd -= dt;
        if (e.chargeT > 0) (e.chargeT -= dt), (sp *= 2.4);
        else if (e.chargeCd <= 0 && d < 220) (e.chargeT = 0.7), (e.chargeCd = rand(3, 5));
      }
      e.vx = mx * sp;
      e.vy = my * sp;
      // separation
      const gx = e.x >> 6, gy = e.y >> 6;
      for (let oy = -1; oy <= 1; oy++)
        for (let ox = -1; ox <= 1; ox++) {
          const a = grid.get(((gx + ox) & 0xffff) | (((gy + oy) & 0xffff) << 16));
          if (!a) continue;
          for (const o of a) {
            if (o === e) continue;
            const sx = e.x - o.x, sy = e.y - o.y;
            const rr = e.r + o.r;
            const d2 = sx * sx + sy * sy;
            if (d2 < rr * rr && d2 > 0.01) {
              const dd = Math.sqrt(d2);
              const push = (rr - dd) * 0.5;
              e.x += (sx / dd) * push;
              e.y += (sy / dd) * push;
            }
          }
        }
      e.x += (e.vx + e.kx) * dt;
      e.y += (e.vy + e.ky) * dt;
      e.kx *= Math.pow(0.002, dt);
      e.ky *= Math.pow(0.002, dt);
      w.collide(e);
      for (const n of this.nests) pushOut(e, n.x, n.y, n.r);
      const sdx = worldDirToScreen(e.vx, e.vy)[0];
      if (Math.abs(sdx) > 5) e.flip = sdx > 0;
      // melee
      const reach = e.r + (e.target ? tgt.r : p.car ? p.car.r : p.r) + 4;
      if (d < reach && e.atkCd <= 0) {
        e.atkCd = 0.85;
        if (e.target) this.takeCiv(e.target);
        else this.hurtPlayer(e.def.dmg * (1 + this.time / 900), e.x, e.y, e.type === 'brute' ? 26 : 6);
      }
    }
    // remove the dead
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  damageEnemy(e, dmg, kx = 0, ky = 0) {
    if (e.dead) return;
    e.hp -= dmg;
    e.hitT = 0.1;
    const mass = e.type === 'brute' ? 6 : 1;
    e.kx += kx / mass;
    e.ky += ky / mass;
    if (Math.random() < 0.5) this.addFx('goo', e.x, e.y, 30, rand(-80, 80), rand(-80, 80), rand(60, 140), 0.7);
    this.sound.play('hit');
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    e.dead = true;
    this.kills++;
    this.sound.play('splat');
    const big = e.type === 'brute';
    for (let i = 0; i < (big ? 18 : 8); i++) this.addFx('goo', e.x, e.y, 20 + rand(30), rand(-160, 160), rand(-160, 160), rand(80, 220), rand(0.5, 0.9));
    this.addDecal('splat', e.x, e.y, big ? 1.8 : 1);
    this.addFx('corpse', e.x, e.y, 0, 0, 0, 0, 0.35, 0, e);
    this.drop(e.x, e.y, e.def.drop);
    if (L.KILLS[this.kills] && !this.milestones.has(this.kills)) {
      this.milestones.add(this.kills);
      this.say(L.KILLS[this.kills], true);
      this.float(this.kills + ' KILLS', this.player.x, this.player.y, 20, 2);
    }
  }

  // --- civilians & critters ---------------------------------------------------
  updateCivs(dt) {
    const p = this.player, w = this.world;
    for (const c of this.civs) {
      c.t += dt;
      if (c.taken) {
        c.fade -= dt * 1.5;
        if (c.taken === 'probed') c.z = (c.z || 0) + dt * 220;
        continue;
      }
      c.life -= dt;
      c.yell = (c.yell || 0) - dt;
      if (c.follow) {
        // tag along behind Dale; the evac bus takes it from there
        const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy) || 1;
        const sp = d > 220 ? 210 : d > 45 ? 150 : 0;
        c.vx = (dx / d) * sp;
        c.vy = (dy / d) * sp;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        if (sp) c.walkT += dt;
        w.collide(c);
        const sdx = worldDirToScreen(c.vx, c.vy)[0];
        if (Math.abs(sdx) > 5) c.flip = sdx > 0;
        const ev = w.evac;
        if (ev && dist2(c.x, c.y, ev.x, ev.y) < 150 * 150) this.rescueCiv(c);
        continue;
      }
      // run away from the nearest alien, otherwise towards the player-ish
      let ax = 0, ay = 0;
      for (const e of this.enemies) {
        const d2v = dist2(e.x, e.y, c.x, c.y);
        if (d2v < 260 * 260) {
          const d = Math.sqrt(d2v) || 1;
          ax += ((c.x - e.x) / d) * (260 - d);
          ay += ((c.y - e.y) / d) * (260 - d);
        }
      }
      c.panic -= dt;
      if (c.panic <= 0) {
        c.panic = rand(0.6, 1.6);
        c.wx = rand(-1, 1);
        c.wy = rand(-1, 1);
      }
      // nobody is chasing them and Dale is close: stop and wait to be talked to
      if (Math.abs(ax) + Math.abs(ay) < 1 && dist2(c.x, c.y, p.x, p.y) < 120 * 120) {
        c.vx = c.vy = 0;
        c.flip = worldDirToScreen(p.x - c.x, p.y - c.y)[0] > 0;
      } else {
        const mx = ax + c.wx * 80, my = ay + c.wy * 80;
        const l = Math.hypot(mx, my) || 1;
        const sp = c.type === 'civ_tinfoil' ? 95 : 120;
        c.vx = (mx / l) * sp;
        c.vy = (my / l) * sp;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.walkT += dt;
        w.collide(c);
        const sdx = worldDirToScreen(c.vx, c.vy)[0];
        if (Math.abs(sdx) > 5) c.flip = sdx > 0;
      }
      if (c.type === 'civ_tinfoil') {
        c.quipT -= dt;
        if (c.quipT <= 0) {
          c.quipT = rand(4, 7);
          this.float(pick(L.TINFOIL), c.x, c.y, 13, 1.8);
        }
      }
      // reward for getting close: they hand over whatever they grabbed on the way out
      if (!c.gave && dist2(c.x, c.y, p.x, p.y) < 60 * 60) {
        c.gave = true;
        const type = weighted([['ammo', 5], ['medkit', 3], ['grenades', 2], ['smg', 1]]);
        this.pickups.push({ type, x: c.x, y: c.y, t: 0, life: 25, drop: true, pop: 1 });
        this.float(pick(['TAKE IT, I AM A PACIFIST NOW!', 'HERE! I FOUND THIS IN THE GARAGE!', 'MY HUSBAND WON\'T NEED THIS!', 'PLEASE SHOOT THEM!', 'IS THIS COVERED BY INSURANCE?']), c.x, c.y, 13, 2);
        this.sound.play('pickup');
      }
      if (c.life <= 0) c.taken = 'left';
    }
    this.civs = this.civs.filter((c) => c.fade > 0);
  }

  takeCiv(c) {
    if (c.taken) return;
    c.taken = 'probed';
    this.sound.play('scream');
    this.say(pick(L.CIV_TAKEN), true);
    this.flashes.push({ x: c.x, y: c.y, z: 30, r: 160, t: 0.4, color: 'magenta' });
    for (let i = 0; i < 12; i++) this.addFx('beamdot', c.x + rand(-14, 14), c.y + rand(-14, 14), rand(0, 40), 0, 0, rand(80, 200), rand(0.5, 1));
  }

  updateCows(dt) {
    const w = this.world;
    for (const c of this.cows) {
      c.t -= dt;
      if (c.state === 'abducted') {
        c.z += dt * 70;
        c.rot += dt * 1.8;
        c.scale = Math.max(0.2, 1 - c.z / 300);
        continue;
      }
      if (c.t <= 0) {
        if (c.state === 'graze' && Math.random() < 0.5) {
          c.state = 'walk';
          const a = rand(Math.PI * 2);
          c.vx = Math.cos(a) * 22;
          c.vy = Math.sin(a) * 22;
          c.t = rand(1.5, 4);
        } else {
          c.state = 'graze';
          c.t = rand(2, 6);
          if (Math.random() < 0.25) this.sound.play('moo');
        }
      }
      if (c.state === 'walk') {
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        w.collide(c);
        const sdx = worldDirToScreen(c.vx, c.vy)[0];
        c.flip = sdx > 0;
      }
    }
    this.cows = this.cows.filter((c) => c.z < 260);
  }

  // --- saucers -------------------------------------------------------------------
  updateUfos(dt) {
    for (const u of this.ufos) {
      u.t += dt;
      u.spin += dt * 3;
      u.hitT = Math.max(0, u.hitT - dt);
      if (u.state === 'in') {
        if (u.mode === 'abduct' && u.victim) (u.tx = u.victim.x), (u.ty = u.victim.y);
        const dx = u.tx - u.x, dy = u.ty - u.y, d = Math.hypot(dx, dy);
        const sp = Math.min(900, 160 + d * 1.4);
        if (d < 8) {
          u.state = 'hover';
          u.t = 0;
          this.sound.play('beam');
        } else {
          u.x += (dx / d) * sp * dt;
          u.y += (dy / d) * sp * dt;
        }
        u.z += (150 - u.z) * dt * 1.5;
      } else if (u.state === 'hover') {
        u.beam = Math.min(1, u.beam + dt * 3);
        u.z += (125 - u.z) * dt * 2;
        if (u.mode === 'drop') {
          u.dropT -= dt;
          if (u.dropT <= 0 && u.drops > 0) {
            u.dropT = 0.35;
            u.drops--;
            const e = this.spawnEnemy(this.rollType(), u.x + rand(-34, 34), u.y + rand(-34, 34), 1.6);
            for (let i = 0; i < 5; i++) this.addFx('beamdot', e.x + rand(-16, 16), e.y + rand(-16, 16), rand(0, 30), 0, 0, rand(60, 160), rand(0.4, 0.8));
          }
          if (u.drops <= 0 && u.t > 1.2) u.state = 'out';
        } else {
          const c = u.victim;
          if (c && c.state !== 'abducted') {
            c.state = 'abducted';
            this.sound.play('moo');
          }
          // reel the cow in under the saucer
          if (c) {
            c.x += (u.x - c.x) * Math.min(1, dt * 3);
            c.y += (u.y - c.y) * Math.min(1, dt * 3);
          }
          if (!c || c.z > 215 || u.t > 5) {
            u.state = 'out';
            u.t = 0;
            if (c) c.z = 999;
            this.say(pick(L.COW), true);
          }
        }
      } else if (u.state === 'out') {
        // leave the way it came, a little higher each second
        u.beam = Math.max(0, u.beam - dt * 3);
        u.x += ((u.sx - u.tx) / 1400) * 700 * dt;
        u.y += ((u.sy - u.ty) / 1400) * 700 * dt;
        u.z += dt * 120;
        if (u.t > 3.5) u.gone = true;
      }
    }
    this.ufos = this.ufos.filter((u) => !u.gone && !u.dead);
  }

  damageUfo(u, dmg) {
    u.hp -= dmg;
    u.hitT = 0.1;
    this.sound.play('hit');
    if (u.hp <= 0 && !u.dead) {
      u.dead = true;
      if (this.mission && this.mission.type === 'cow' && this.mission.ufo === u) this.completeMission();
      this.explode(u.x, u.y, 60, true);
      this.say(pick(['SAUCER DOWN! THAT ONE WAS A RENTAL.', 'YOU SHOT DOWN A UFO. THE X-FILES WANTS YOUR NUMBER.']), true);
      this.drop(u.x, u.y, 1);
      this.drop(u.x + 20, u.y, 0.6);
      if (u.mode === 'abduct' && u.victim) (u.victim.state = 'graze'), (u.victim.z = 0), (u.victim.rot = 0), (u.victim.scale = 1);
    }
  }

  updateMother(dt) {
    const m = this.mother;
    if (!m) return;
    const p = this.player;
    m.t += dt;
    m.hitT = Math.max(0, m.hitT - dt);
    // hover around the player at a menacing distance
    const tx = p.x - 120 + Math.cos(m.t * 0.3) * 160, ty = p.y - 120 + Math.sin(m.t * 0.3) * 160;
    const sp = m.state === 'in' ? 2.2 : m.state === 'leave' ? 0 : 0.6;
    if (m.state === 'leave') {
      m.z += dt * 140;
      m.x -= dt * 300;
      m.y -= dt * 300;
      if (m.z > 900) this.mother = null;
      return;
    }
    m.x += (tx - m.x) * sp * dt;
    m.y += (ty - m.y) * sp * dt;
    if (m.state === 'in' && dist2(m.x, m.y, tx, ty) < 200 * 200) m.state = 'fight';
    if (m.state !== 'fight') return;
    m.leaveT -= dt;
    m.fireCd -= dt;
    if (m.fireCd <= 0) {
      m.fireCd = Math.max(1.6, 3.2 - this.level * 0.2);
      const n = 14 + this.level * 2;
      const off = rand(1);
      for (let i = 0; i < n; i++) {
        const a = ((i + off) / n) * Math.PI * 2;
        this.ebullets.push({ x: m.x, y: m.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, life: 3.2, dmg: 12, big: true });
      }
      this.sound.play('enemyShot');
    }
    m.dropCd -= dt;
    if (m.dropCd <= 0) {
      m.dropCd = 7;
      for (let i = 0; i < 4; i++) this.spawnEnemy('crawler', m.x + rand(-60, 60), m.y + rand(-60, 60), 1.5);
    }
    if (m.leaveT <= 0) {
      m.state = 'leave';
      this.say(pick(L.MOTHER_LEAVE), true);
    }
  }

  damageMother(dmg) {
    const m = this.mother;
    m.hp -= dmg;
    m.hitT = 0.08;
    if (m.hp <= 0) {
      for (let i = 0; i < 6; i++) setTimeout(() => this.explode(m.x + rand(-120, 120), m.y + rand(-80, 80), 120, true), i * 140);
      this.say(pick(L.MOTHER_DOWN), true);
      this.showBanner('MOTHERSHIP DOWN', 'TAKE THAT, MOM');
      for (let i = 0; i < 6; i++) this.drop(m.x + rand(-80, 80), m.y + rand(-80, 80), 1);
      this.mother = null;
      this.sound.play('bigboom');
    }
  }

  updateNests(dt) {
    for (const n of this.nests) {
      n.hitT = Math.max(0, n.hitT - dt);
      n.pulse += dt;
      if (n.land < 1) {
        n.land = Math.min(1, n.land + dt * 0.6);
        if (n.land >= 1) {
          this.shake = Math.max(this.shake, 8);
          this.sound.play('boom');
          for (let i = 0; i < 16; i++) this.addFx('dust', n.x + rand(-60, 60), n.y + rand(-60, 60), 0, rand(-60, 60), rand(-60, 60), rand(10, 40), rand(0.8, 1.6), 1.4);
        }
        continue;
      }
      n.spawnCd -= dt;
      if (n.spawnCd <= 0 && this.enemies.length < 160) {
        n.spawnCd = Math.max(1.6, 4.5 - this.time / 200);
        this.spawnEnemy(this.rollType(), n.x + rand(-20, 20), n.y + 50, 2);
      }
    }
  }

  damageNest(n, dmg) {
    n.hp -= dmg;
    n.hitT = 0.08;
    if (n.hp <= 0 && !n.dead) {
      n.dead = true;
      this.explode(n.x, n.y, 30, true);
      this.drop(n.x, n.y, 1);
      this.pickups.push({ type: 'core', x: n.x + 30, y: n.y, t: 0, life: 30, drop: true, pop: 1 });
      this.say(pick(['NEST DESTROYED. THE HOA THANKS YOU.', 'THAT SAUCER IS NOW MODERN ART.']), true);
    }
    this.nests = this.nests.filter((q) => !q.dead);
  }

  // --- projectiles ----------------------------------------------------------------
  updateBullets(dt) {
    const w = this.world;
    const grid = this.grid;
    for (const b of this.bullets) {
      b.life -= dt;
      const steps = 2;
      for (let s = 0; s < steps && b.life > 0; s++) {
        b.x += (b.vx * dt) / steps;
        b.y += (b.vy * dt) / steps;
        if (w.hitProp(b.x, b.y)) {
          b.life = 0;
          for (let i = 0; i < 3; i++) this.addFx('spark', b.x, b.y, 30, rand(-120, 120), rand(-120, 120), rand(20, 120), 0.15);
          break;
        }
        // aliens
        const gx = b.x >> 6, gy = b.y >> 6;
        let hit = false;
        for (let oy = -1; oy <= 1 && !hit; oy++)
          for (let ox = -1; ox <= 1 && !hit; ox++) {
            const a = grid.get(((gx + ox) & 0xffff) | (((gy + oy) & 0xffff) << 16));
            if (!a) continue;
            for (const e of a) {
              if (e.dead || e.spawnT < 0.6) continue;
              if (b.hits && b.hits.includes(e)) continue;
              if (dist2(e.x, e.y, b.x, b.y) < (e.r + 5) ** 2) {
                const sp = Math.hypot(b.vx, b.vy);
                this.damageEnemy(e, b.dmg, (b.vx / sp) * b.knock, (b.vy / sp) * b.knock);
                b.pierce--;
                (b.hits || (b.hits = [])).push(e);
                if (b.pierce <= 0) (b.life = 0), (hit = true);
                break;
              }
            }
          }
        if (hit) break;
        for (const n of this.nests) {
          if (n.land >= 1 && dist2(n.x, n.y, b.x, b.y) < n.r * n.r) {
            this.damageNest(n, b.dmg);
            b.life = 0;
            this.addFx('spark', b.x, b.y, 40, rand(-100, 100), rand(-100, 100), 80, 0.15);
            break;
          }
        }
        for (const u of this.ufos) {
          if (u.state === 'hover' && dist2(u.x, u.y, b.x, b.y) < 50 * 50) {
            this.damageUfo(u, b.dmg);
            b.life = 0;
            break;
          }
        }
        const m = this.mother;
        if (m && m.state === 'fight' && b.life > 0 && dist2(m.x, m.y, b.x, b.y) < 130 * 130) {
          this.damageMother(b.dmg);
          b.life = 0;
          this.addFx('spark', b.x, b.y, 120, rand(-100, 100), rand(-100, 100), 80, 0.2);
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);

    const p = this.player;
    for (const b of this.ebullets) {
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (w.hitProp(b.x, b.y)) {
        b.life = 0;
        continue;
      }
      if (dist2(b.x, b.y, p.x, p.y) < ((p.car ? p.car.r : p.r) + (b.big ? 10 : 6)) ** 2) {
        b.life = 0;
        this.hurtPlayer(b.dmg, b.x, b.y, 4);
      }
    }
    this.ebullets = this.ebullets.filter((b) => b.life > 0);
  }

  updateGrenades(dt) {
    for (const g of this.grenades) {
      g.t += dt;
      g.rot += dt * 14;
      if (!g.landed) {
        const k = Math.min(1, g.t / g.dur);
        g.x = g.sx + (g.tx - g.sx) * k;
        g.y = g.sy + (g.ty - g.sy) * k;
        g.z = 30 * (1 - k) + Math.sin(k * Math.PI) * (80 + g.dur * 60);
        if (k >= 1) (g.landed = true), (g.t = 0);
      } else if (g.t >= g.fuse) {
        g.done = true;
        this.explode(g.x, g.y, 0, false);
      }
    }
    this.grenades = this.grenades.filter((g) => !g.done);
  }

  explode(x, y, z = 0, big = false, silent = false) {
    const R = big ? 170 : 130;
    const dmg = big ? 220 : 160;
    for (const e of this.enemies) {
      const d = Math.sqrt(dist2(e.x, e.y, x, y));
      if (d < R) {
        const f = 1 - (d / R) * 0.6;
        const l = d || 1;
        this.damageEnemy(e, dmg * f, ((e.x - x) / l) * 500 * f, ((e.y - y) / l) * 500 * f);
      }
    }
    for (const n of this.nests) if (dist2(n.x, n.y, x, y) < (R + n.r) ** 2) this.damageNest(n, dmg * 0.6);
    const p = this.player;
    if (!p.dead && !silent) {
      const d = Math.sqrt(dist2(p.x, p.y, x, y));
      if (d < R * 0.8) this.hurtPlayer(big ? 30 : 18, x, y, 20);
    }
    for (const q of this.world.props) {
      if (q.box && !q.burning && q.type.startsWith('car') && dist2(q.x, q.y, x, y) < (R * 0.8) ** 2 && Math.random() < 0.6) this.ignite(q);
    }
    this.shake = Math.max(this.shake, big ? 16 : 11);
    this.flashes.push({ x, y, z: z + 20, r: big ? 420 : 300, t: 0.35, color: 'orange' });
    this.addFx('ring', x, y, 2, 0, 0, 0, 0.45, R * 1.1);
    for (let i = 0; i < (big ? 26 : 16); i++) this.addFx('fire', x + rand(-25, 25), y + rand(-25, 25), z + rand(0, 30), rand(-140, 140), rand(-140, 140), rand(40, 200), rand(0.4, 0.8), rand(1, 1.8));
    for (let i = 0; i < (big ? 14 : 8); i++) this.addFx('smoke', x + rand(-30, 30), y + rand(-30, 30), z + rand(10, 40), rand(-40, 40), rand(-40, 40), rand(20, 60), rand(1.4, 2.6), rand(1, 1.8));
    for (let i = 0; i < 10; i++) this.addFx('debris', x, y, z + 10, rand(-220, 220), rand(-220, 220), rand(120, 320), rand(0.8, 1.4));
    this.addDecal('scorch', x, y, big ? 1.5 : 1.1);
    if (!silent) this.sound.play(big ? 'bigboom' : 'boom');
  }

  updateMeteors(dt) {
    for (const m of this.meteors) {
      m.t -= dt;
      if (m.t <= 0 && !m.done) {
        m.done = true;
        const R = m.big ? 120 : 85;
        const p = this.player;
        if (dist2(p.x, p.y, m.x, m.y) < R * R) this.hurtPlayer(m.big ? 40 : 28, m.x, m.y, 30);
        for (const e of this.enemies) if (dist2(e.x, e.y, m.x, m.y) < R * R) this.damageEnemy(e, 260, 0, 0);
        for (const c of this.cows) if (c.state !== 'abducted' && dist2(c.x, c.y, m.x, m.y) < R * R) c.z = 999;
        this.explode(m.x, m.y, 0, m.big, true);
        this.sound.play(m.big ? 'bigboom' : 'boom');
        this.addDecal('crater', m.x, m.y, m.big ? 1.25 : 0.85);
        if (Math.random() < 0.5) {
          const q = this.world.props.find((q) => q.box && !q.burning && dist2(q.x, q.y, m.x, m.y) < 170 * 170);
          if (q) this.ignite(q);
        }
      }
    }
    this.meteors = this.meteors.filter((m) => !m.done);
  }

  updatePickups(dt) {
    const p = this.player;
    for (const k of this.pickups) {
      k.t += dt;
      if (k.pop) k.pop = Math.max(0, k.pop - dt * 3);
      if (k.drop) k.life -= dt;
      const d2v = dist2(k.x, k.y, p.x, p.y);
      if (d2v < 90 * 90 && !p.dead) {
        const d = Math.sqrt(d2v) || 1;
        k.x += ((p.x - k.x) / d) * 260 * dt;
        k.y += ((p.y - k.y) / d) * 260 * dt;
      }
      if (d2v < 30 * 30 && !p.dead) {
        k.taken = true;
        this.collect(k.type);
      }
    }
    this.pickups = this.pickups.filter((k) => !k.taken && k.life > 0);
  }

  collect(type) {
    const p = this.player;
    let text = pick(L.PICKUP[type]);
    if (type === 'ammo') p.shells += 12;
    else if (type === 'medkit') p.hp = Math.min(p.maxHp, p.hp + 35);
    else if (type === 'grenades') p.grenades = Math.min(6, p.grenades + 2);
    else if (type === 'smg') p.smgT = 18;
    else if (type === 'core') p.plasmaT = 12;
    this.sound.play(type === 'smg' || type === 'core' ? 'power' : 'pickup');
    this.float(text.split('.')[0], p.x, p.y, 15);
    if (Math.random() < 0.35 && text.includes('.')) this.say(text);
  }

  // --- ambient life -------------------------------------------------------------------
  updateAmbient(dt) {
    const p = this.player;
    for (const t of this.tumbleweeds) {
      t.life -= dt;
      t.vz -= 600 * dt;
      t.z += t.vz * dt;
      if (t.z <= 0) {
        t.z = 0;
        t.vz = rand(60, 160);
      }
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.rot += t.vx * dt * 0.05;
    }
    this.tumbleweeds = this.tumbleweeds.filter((t) => t.life > 0);
    for (const v of this.vultures) {
      v.a += v.sp * dt;
      v.cx += (p.x - v.cx) * dt * 0.05;
      v.cy += (p.y - v.cy) * dt * 0.05;
      v.x = v.cx + Math.cos(v.a) * v.r;
      v.y = v.cy + Math.sin(v.a) * v.r;
    }
    for (const f of this.fires) {
      f.t += dt;
      f.emit -= dt;
      const q = f.prop;
      if (f.emit <= 0) {
        f.emit = 0.09;
        const b = q.box;
        const x = b.x0 + rand(b.x1 - b.x0), y = b.y0 + rand(b.y1 - b.y0);
        const big = q.type.startsWith('car') ? 0.8 : 1.4;
        const h = q.type.startsWith('car') ? 30 : 80;
        this.addFx('fire', x, y, rand(10, h), rand(-15, 15), rand(-15, 15), rand(40, 90), rand(0.5, 1), big);
        if (Math.random() < 0.5) this.addFx('smoke', x, y, h + 20, rand(-10, 10) + 20, rand(-10, 10), rand(30, 60), rand(2.5, 4), big * 1.6);
      }
    }
    for (const fl of this.flashes) fl.t -= dt;
    this.flashes = this.flashes.filter((f) => f.t > 0);
    for (const f of this.floaters) f.t += dt;
    this.floaters = this.floaters.filter((f) => f.t < f.life);
    for (const d of this.decals) d.life -= dt;
    this.decals = this.decals.filter((d) => d.life > 0);
  }

  addDecal(kind, x, y, scale) {
    if (this.decals.length > 90) this.decals.shift();
    this.decals.push({ kind, x, y, scale: scale * rand(0.85, 1.15), rot: rand(6.28), life: kind === 'splat' ? 40 : 60, max: kind === 'splat' ? 40 : 60 });
  }

  // --- particles -------------------------------------------------------------------------
  addFx(type, x, y, z, vx, vy, vz, life, size = 1, ref = null) {
    if (this.fx.length > 700) return;
    this.fx.push({ type, x, y, z, vx, vy, vz, life, max: life, size, ref, rot: rand(6.28) });
  }

  updateFx(dt) {
    for (const f of this.fx) {
      f.life -= dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.z += f.vz * dt;
      switch (f.type) {
        case 'goo':
        case 'blood':
        case 'debris':
        case 'shell':
          f.vz -= 700 * dt;
          if (f.z <= 0) {
            f.z = 0;
            if (f.type === 'shell' && Math.abs(f.vz) > 60) {
              f.vz *= -0.4;
              f.vx *= 0.6;
              f.vy *= 0.6;
            } else {
              f.vx *= 0.8;
              f.vy *= 0.8;
              f.vz = 0;
              if (f.type === 'goo' && !f.splat) {
                f.splat = true;
                if (Math.random() < 0.2) this.addDecal('drop', f.x, f.y, 0.4);
              }
            }
          }
          break;
        case 'smoke':
        case 'dust':
          f.vx *= 1 - dt * 0.8;
          f.vy *= 1 - dt * 0.8;
          f.vz *= 1 - dt * 0.5;
          break;
        case 'fire':
          f.vx *= 1 - dt * 3;
          f.vy *= 1 - dt * 3;
          f.vz += 40 * dt;
          break;
      }
    }
    this.fx = this.fx.filter((f) => f.life > 0);
  }
}

function pushOut(e, x, y, r) {
  const dx = e.x - x, dy = e.y - y;
  const rr = r + e.r;
  const d2 = dx * dx + dy * dy;
  if (d2 < rr * rr && d2 > 0.01) {
    const d = Math.sqrt(d2);
    e.x = x + (dx / d) * rr;
    e.y = y + (dy / d) * rr;
  }
}

export { PICKUPS, WEAPONS, N };

Object.assign(Game.prototype, InteractMixin);
