// Game simulation: Dale, his rides, the aliens, saucers, meteors, critters and the escalation director.
// Nobody here has a gun. Dale's weapons are a car, a horn and questionable judgement.
import { TILE, rand, randi, pick, clamp, dist2, weighted, screenDirToWorld, worldDirToScreen } from './util.js';
import { World, N, WORLD } from './world.js';
import * as L from './lines.js';
import { InteractMixin } from './interact.js';
import { VehicleMixin } from './vehicles.js';
import { AdventureMixin } from './adventure.js';
import { NpcMixin } from './npcs.js';

export const ENEMY = {
  grunt: { sprite: 'alien_grunt', hp: 34, speed: 72, r: 10, dmg: 9, size: ['h', 52], drop: 0.12 },
  crawler: { sprite: 'alien_crawler', hp: 15, speed: 140, r: 9, dmg: 6, size: ['w', 40], drop: 0.06 },
  spitter: { sprite: 'alien_spitter', hp: 28, speed: 58, r: 10, dmg: 6, size: ['h', 54], drop: 0.15, ranged: true },
  brute: { sprite: 'alien_brute', hp: 230, speed: 46, r: 20, dmg: 22, size: ['w', 84], drop: 0.6 },
};

export const PICKUP_SPRITE = { fuel: 'pk_fuel', repair: 'pk_tools', medkit: 'pk_medkit', nitro: 'pk_core' };
const CIVS = ['civ_dad', 'civ_curlers', 'civ_tinfoil'];
const DAY = 160; // seconds per day/night cycle (endless)
const DAY_STORY = 260; // the story gives Dale more daylight to run errands in

export class Game {
  constructor(sound) {
    this.sound = sound;
    this.viewR = 600;
    this.reset('endless');
  }

  // mode: 'story' (the adventure) or 'endless' (classic survival). save: story save data to resume.
  reset(mode = 'endless', save = null) {
    this.mode = mode;
    this.world = new World(save ? save.seed : (Math.random() * 1e9) | 0);
    const s = this.world.start;
    this.player = {
      x: s.x + 24, y: s.y + 34, r: 11, hp: 100, maxHp: 100, cans: 1, nitro: 1,
      aimX: 1, aimY: 1, fx: 1, fy: 1, moving: false, walkT: 0, invT: 0, hurtT: 0, lastHit: 0, dead: false, car: null, whistleT: 0,
    };
    this.enemies = [];
    this.civs = [];
    this.cows = this.world.cows.map((c) => ({ x: c.x, y: c.y, r: 12, vx: 0, vy: 0, t: rand(5), state: 'graze', flip: Math.random() < 0.5, z: 0, rot: 0, scale: 1, petCd: 0 }));
    this.pickups = [];
    this.nests = [];
    this.ufos = [];
    this.mother = null;
    this.ebullets = [];
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
    this.tSpawn = 2;
    this.tUfo = 10;
    this.tNest = 75;
    this.tShower = 100;
    this.showerT = 0;
    this.tMother = 240;
    this.tLoot = 2;
    this.tCiv = 2;
    this.tFire = 12;
    this.tAmbient = 22;
    this.tLowHp = 0;
    this.tTumble = 3;
    this.tLoneMeteor = 30;
    this.tChimney = 0;
    this.phase = 'day';
    this.milestones = new Set();
    this.houses = this.world.props.filter((q) => q.type.startsWith('house'));
    this.initAdventure();
    this.initInteract();
    this.initVehicles();
    // Dale's first ride is parked right next to him
    const start = this.makeCar('police', s.x + 70, s.y, 0, null);
    start.fuel = start.maxFuel;
    this.cars = this.cars.filter((c) => dist2(c.x, c.y, start.x, start.y) > 120 * 120);
    this.cars.push(start);
    this.dog = { x: s.x - 60, y: s.y + 90, r: 9, vx: 0, vy: 0, flip: false, walkT: 0, bark: 0, barkT: 2, petCd: 0 };
    this.sound.siren(false);
    this.sound.engine(false);
    this.initNpcs();
    if (mode === 'story') {
      this.tMother = 1e9; // in the story the Executive only shows up as a plot twist or for the finale
      this.tUfo = 45;
      this.tShower = 200;
      this.tNest = 160;
      if (save) {
        this.applySave(save);
        this.say('PREVIOUSLY ON EARTH: THE FINAL SEASON...', true);
      } else {
        this.say("KEVIN (WALKIE): DALE? DALE, IT'S KEVIN. FROM HIGH SCHOOL. TINFOIL KEVIN. GUESS WHO WAS RIGHT. COME TO MY MOM'S BACKYARD. WEST SIDE. BRING SNACKS.", true);
        this.say('TIP: TAP THINGS TO LOOK AT THEM. TAP THE GROUND TO WALK. DRAG TO DRIVE.', false);
      }
    } else this.say(pick(L.INTRO), true);
    for (let i = 0; i < 2; i++) this.vultures.push(this.makeVulture());
    for (let i = 0; i < 6; i++) this.spawnLoot();
    for (let i = 0; i < 5; i++) this.spawnCiv();
  }

  // --- messaging -------------------------------------------------------------
  say(text, priority = false) {
    if (priority) this.ticker.unshift(text);
    else if (this.ticker.length < 3) this.ticker.push(text);
    if (this.ticker.length > 4) this.ticker.length = 4;
    if (priority && this.tickerCur && this.tickerCur.t > 1.2) this.tickerCur.t = Math.max(this.tickerCur.t, this.tickerCur.dur - 0.3);
  }
  showBanner(text, sub) {
    this.banner = { text, sub, t: 0, dur: 3.2 };
    this.sound.play('sting');
  }
  float(text, x, y, size = 15, life = 1.4) {
    // in the story the screen stays readable: a handful of floating texts at most
    if (this.mode === 'story' && this.floaters.length >= 5) this.floaters.shift();
    // stack texts that pop up at the same time so they stay readable
    let z = 46;
    for (const f of this.floaters) if (f.t < 0.8 && Math.abs(f.x - x) + Math.abs(f.y - y) < 200) z = Math.max(z, f.z + 24);
    this.floaters.push({ text, x, y, z, t: 0, life, size });
    if (this.floaters.length > 14) this.floaters.shift();
  }

  // --- escalation helpers ----------------------------------------------------
  get threat() {
    if (this.mode === 'story') return Math.min(L.THREAT.length - 1, this.act + Math.floor(this.time / 330));
    return Math.min(L.THREAT.length - 1, Math.floor(this.time / 90));
  }
  dayPhase() {
    const len = this.mode === 'story' ? DAY_STORY : DAY;
    const c = ((this.time + 8) % len) / len;
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
      this.updateAdventure(dt);
      return;
    }
    if (this.endingId) {
      this.endingT = (this.endingT || 0) + dt;
      return;
    }
    // interiors, conversations and the keypad pause the world
    if (this.scene || this.dialog || this.keypadOn) {
      this.updateAdventure(dt);
      this.updateTicker(dt);
      if (this.banner && (this.banner.t += dt) > this.banner.dur) this.banner = null;
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
    this.updateDog(dt);
    this.updateCows(dt);
    this.updateCars(dt);
    this.updateUfos(dt);
    this.updateMother(dt);
    this.updateNests(dt);
    this.updateEBullets(dt);
    this.updateMeteors(dt);
    this.updatePickups(dt);
    this.updateNpcs(dt);
    this.updateDrones(dt);
    this.updateRatings(dt);
    this.updateAdventure(dt);
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
    if (this.threat > this.level) {
      this.level = this.threat;
      const th = L.THREAT[this.level];
      if (this.mode !== 'story') this.showBanner('THREAT LEVEL ' + (this.level + 1), th.name);
      this.say(th.line, this.mode !== 'story');
      this.vultures.push(this.makeVulture());
    }
    if (day.ph !== this.phase) {
      if (day.ph === 'dusk') {
        this.showBanner('NIGHT FALLS', 'HEADLIGHTS ON. HOPE ON STANDBY.');
        this.say(pick(L.NIGHT), true);
      } else if (day.ph === 'dawn') {
        this.showBanner('DAWN', 'STILL ALIVE. SOMEHOW.');
        this.say(pick(L.DAWN), true);
      }
      this.phase = day.ph;
    }

    // regular alien spawns (the story keeps it calmer: it is an adventure, not a massacre)
    const alive = this.enemies.length;
    const story = this.mode === 'story';
    const cap = story ? Math.min(90, (this.act === 0 ? 3 : 8 + this.act * 7) + t * 0.035) : Math.min(140, 12 + t * 0.13);
    const rate = story ? (this.act === 0 ? 0.12 : 0.22 + this.act * 0.1 + t * 0.0012) * (1 + day.dark * 0.9) : (0.45 + t * 0.007) * (1 + day.dark * 0.6);
    this.tSpawn -= dt;
    if (this.tSpawn <= 0) {
      this.tSpawn = 1 / rate;
      if (alive < cap) {
        const n = t > 200 && Math.random() < 0.35 ? randi(2, 5) : 1;
        const spot = this.edgeSpot();
        if (spot) for (let k = 0; k < n; k++) this.spawnEnemy(this.rollType(), spot.x + rand(-40, 40), spot.y + rand(-40, 40), 0.9);
      }
    }

    // saucers: drop aliens, beam up cows, people and cars
    this.tUfo -= dt;
    if (this.tUfo <= 0) {
      this.tUfo = (story ? Math.max(12, 30 - this.act * 4 - t / 60) : Math.max(6, 16 - t / 30)) * rand(0.8, 1.2);
      const r = Math.random();
      const near = (list, R) => list.filter((o) => dist2(o.x, o.y, p.x, p.y) < R * R);
      if (t > 40 && r < 0.3) {
        let victim = null;
        if (p.car && Math.random() < 0.55) victim = p.car;
        else victim = pick(near(this.cars.filter((c) => !c.wreck && c !== p.car && !c.lift), 900)) || null;
        if (victim) this.spawnUfo('abduct', victim, 'car');
        else if (!(story && this.act === 0)) this.spawnUfo('drop');
      } else if (r < 0.58) {
        const cows = near(this.cows.filter((c) => c.state !== 'abducted' && !c.target), 900);
        const civs = near(this.civs.filter((c) => !c.taken), 700);
        if (cows.length && (Math.random() < 0.5 || !civs.length)) this.spawnUfo('abduct', pick(cows), 'cow');
        else if (civs.length) this.spawnUfo('abduct', pick(civs), 'civ');
        else if (!(story && this.act === 0)) this.spawnUfo('drop');
      } else if (alive < cap + 10 && !(story && this.act === 0)) this.spawnUfo('drop');
    }

    this.tNest -= dt;
    if (this.tNest <= 0) {
      this.tNest = 55 + rand(0, 25);
      if (this.nests.length < Math.min(4, 1 + Math.floor(t / 160))) this.spawnNest();
    }

    // meteor showers - the actual skyfall
    this.tShower -= dt;
    if (this.tShower <= 0) {
      this.tShower = story ? rand(110, 170) : rand(55, 80) - Math.min(25, t / 30);
      this.showerT = 8 + this.level * 2;
      this.showBanner('SKYFALL!', 'METEOR SHOWER INBOUND');
      this.say(pick(L.METEOR), true);
    }
    if (this.showerT > 0) {
      this.showerT -= dt;
      const r = 2.2 + this.level * 0.9;
      // aim a little ahead of a moving car
      const lead = p.car ? 0.8 : 0;
      const ax = p.x + (p.car ? Math.cos(p.car.h) * p.car.speed * lead : 0), ay = p.y + (p.car ? Math.sin(p.car.h) * p.car.speed * lead : 0);
      if (Math.random() < r * dt) this.spawnMeteor(ax + rand(-400, 400), ay + rand(-400, 400), Math.random() < 0.15 + this.level * 0.05);
      if (Math.random() < 0.5 * dt) this.spawnMeteor(ax + rand(-60, 60), ay + rand(-60, 60), false);
    }
    if (this.level >= 3) {
      this.tLoneMeteor -= dt;
      if (this.tLoneMeteor <= 0) {
        this.tLoneMeteor = rand(3, 7) - this.level * 0.3;
        this.spawnMeteor(p.x + rand(-500, 500), p.y + rand(-500, 500), false);
      }
    }

    this.tMother -= dt;
    if (this.tMother <= 0 && !this.mother) {
      this.tMother = 220;
      this.spawnMother();
    }

    this.tLoot -= dt;
    if (this.tLoot <= 0) {
      this.tLoot = 5;
      if (this.pickups.filter((k) => !k.drop).length < 10) this.spawnLoot();
    }

    // a steady trickle of panicking residents
    this.tCiv -= dt;
    if (this.tCiv <= 0) {
      this.tCiv = rand(4, 8);
      if (this.civs.filter((c) => !c.taken).length < Math.min(12, 6 + this.level)) this.spawnCiv();
    }

    if (t > (story ? 320 : 170)) {
      this.tFire -= dt;
      if (this.tFire <= 0) {
        this.tFire = Math.max(10, 30 - this.level * 3);
        this.igniteNear(p.x, p.y, 750, true);
      }
    }

    this.tAmbient -= dt;
    if (this.tAmbient <= 0) {
      this.tAmbient = story ? rand(70, 110) : rand(18, 30);
      this.say(pick(L.AMBIENT));
    }

    this.tTumble -= dt;
    if (this.tTumble <= 0) {
      this.tTumble = rand(2.5, 6);
      if (this.tumbleweeds.length < 6) this.spawnTumbleweed();
    }
  }

  rollType() {
    const t = this.mode === 'story' ? this.time * 0.6 + this.act * 60 : this.time;
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
      vx: 0, vy: 0, kx: 0, ky: 0, atkCd: 0, shootCd: rand(1, 2.5), chargeCd: rand(2, 4), chargeT: 0, stun: 0,
      spawnT: materialize ? 0 : 1, matSpeed: materialize || 1, hitT: 0, walkT: rand(5), flip: false, target: null, retarget: 0,
    };
    this.enemies.push(e);
    return e;
  }

  spawnUfo(mode, victim = null, kind = null) {
    const p = this.player;
    const ang = rand(Math.PI * 2);
    let tx, ty;
    if (victim) (tx = victim.x), (ty = victim.y);
    else {
      const s = this.world.randomSpot(p.x, p.y, 230, 420) || { x: p.x + 300, y: p.y };
      tx = s.x;
      ty = s.y;
    }
    const sx = tx + Math.cos(ang) * 1400, sy = ty + Math.sin(ang) * 1400;
    const u = {
      mode, kind, victim, x: sx, y: sy, z: 230, tx, ty, sx, sy, state: 'in', t: 0, beam: 0,
      drops: Math.min(14, 3 + Math.floor(this.time / 65)), dropT: 0, hitT: 0, spin: rand(6),
    };
    this.ufos.push(u);
    if (kind === 'cow') {
      victim.target = true;
      victim.state = 'graze';
      victim.t = 99;
      if (!this.mission) this.startMissionObj({ type: 'cow', t: 0, limit: 30, count: 0, need: 1, ufo: u });
    }
    if (kind === 'car' && victim === p.car) this.float('SAUCER INCOMING! KEEP MOVING!', p.x, p.y, 13, 1.8);
  }

  spawnNest() {
    const p = this.player;
    const s = this.world.randomSpot(p.x, p.y, 420, 800, 60);
    if (!s) return;
    const hp = 420 + this.time * 1.6;
    this.nests.push({ x: s.x, y: s.y, r: 46, hp, maxHp: hp, spawnCd: 3, land: 0, hitT: 0, pulse: 0 });
    this.showBanner('UFO LANDED', 'RAM IT BEFORE IT MAKES MORE');
    this.say(pick(L.NEST), true);
  }

  spawnMother() {
    const p = this.player;
    this.mother = { x: p.x - 900, y: p.y - 900, z: 260, t: 0, fireCd: 3, dropCd: 6, hitT: 0, state: 'in', leaveT: 60 };
    this.showBanner('MOTHERSHIP', 'SURVIVE THE MEETING');
    this.say(pick(L.MOTHER_IN), true);
  }

  spawnMeteor(x, y, big) {
    if (x < 0 || y < 0 || x > WORLD || y > WORLD) return;
    const dur = big ? 2.0 : 1.5;
    this.meteors.push({ x, y, t: dur, dur, big, ang: rand(-0.5, 0.5) });
    this.sound.play('whistle');
  }

  spawnLoot() {
    const p = this.player, w = this.world;
    let spot = null;
    if (w.lootSpots.length && Math.random() < 0.5) {
      const near = w.lootSpots.filter((s) => {
        const d = dist2(s.x, s.y, p.x, p.y);
        return d > 200 * 200 && d < 900 * 900;
      });
      if (near.length) spot = pick(near);
    }
    if (!spot) spot = w.randomSpot(p.x, p.y, 250, 800);
    if (!spot) return;
    const type = weighted([['fuel', 5], ['repair', 3], ['medkit', 2], ['nitro', 1.6]]);
    this.pickups.push({ type, x: spot.x + rand(-10, 10), y: spot.y + rand(-10, 10), t: rand(5), life: Infinity, drop: false });
  }

  drop(x, y, chance) {
    if (Math.random() > chance) return;
    const p = this.player;
    const type = weighted([['fuel', 3], ['repair', 2], ['medkit', p.hp < 50 ? 3 : 1], ['nitro', 1.5]]);
    this.pickups.push({ type, x, y, t: 0, life: 22, drop: true, pop: 1 });
  }

  newCiv(type, x, y) {
    return { type, x, y, r: 10, vx: 0, vy: 0, wx: rand(-1, 1), wy: rand(-1, 1), t: 0, walkT: 0, panic: rand(1), flip: false, gave: false, life: 90, quipT: rand(3, 6), fade: 1, yell: 0, hail: 0, z: 0 };
  }

  spawnCivAt(x, y, type) {
    const c = this.newCiv(type || pick(CIVS), x, y);
    c.gave = true;
    this.world.collide(c);
    this.civs.push(c);
    return c;
  }

  spawnCiv(forMission = false) {
    const p = this.player;
    if (forMission) {
      const s = this.world.randomSpot(p.x, p.y, 380, 680);
      if (!s) return null;
      const c = this.newCiv(pick(CIVS), s.x, s.y);
      c.gave = true;
      c.life = 999;
      c.mission = true;
      this.civs.push(c);
      return c;
    }
    // they come running out of houses
    const houses = this.houses.filter((h) => dist2(h.x, h.y, p.x, p.y) < 900 * 900 && dist2(h.x, h.y, p.x, p.y) > 200 * 200 && !h.burning);
    let s;
    if (houses.length) {
      const h = pick(houses);
      s = this.world.randomSpot(h.x, h.y, 120, 170, 20);
    }
    if (!s) s = this.world.randomSpot(p.x, p.y, 300, 700);
    if (!s) return;
    const type = Math.random() < 0.22 ? 'civ_tinfoil' : pick(CIVS.slice(0, 2));
    this.civs.push(this.newCiv(type, s.x, s.y));
    if (Math.random() < 0.15 && this.mode !== 'story') this.say(pick(L.CIV_SPAWN));
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
    const cands = this.world.props.filter((q) => q.box && !q.burning && dist2(q.x, q.y, x, y) < radius * radius && (q.type.startsWith('house') || q.type === 'store' || q.type === 'trailer' || q.type === 'gas_station'));
    if (!cands.length) return null;
    const q = pick(cands);
    this.ignite(q);
    if (announce && Math.random() < 0.35) this.say(pick(['ANOTHER HOUSE IS ON FIRE. THE FIRE DEPARTMENT HAS BEEN ABDUCTED.', 'SOMETHING IS BURNING. IT IS EVERYTHING. EVERYTHING IS BURNING.', 'THAT HOUSE HAD A POOL. NOW IT HAS A HOT TUB.']));
    return q;
  }
  ignite(q) {
    if (q.burning || !q.box) return;
    q.burning = true;
    this.fires.push({ prop: q, t: 0, emit: 0 });
  }

  // --- Dale --------------------------------------------------------------------
  updatePlayer(dt, input) {
    const p = this.player;
    p.invT -= dt;
    p.hurtT = Math.max(0, p.hurtT - dt);
    p.whistleT -= dt;
    p.lastHit += dt;
    if (p.lastHit > 6 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 1.0 * dt);
    if (p.car) return this.updatePlayerCar(dt, input);

    // on foot: run, Dale, run (or tap somewhere and he walks there himself)
    let [wx, wy] = screenDirToWorld(input.mx, input.my);
    let mag = Math.min(1, Math.hypot(input.mx, input.my));
    if (mag > 0.1) p.walk = null;
    else if (p.walk) {
      const dir = this.walkStep(dt);
      if (dir) {
        wx = dir[0];
        wy = dir[1];
        mag = 1;
      }
    }
    const speed = 178 * mag;
    p.moving = mag > 0.1;
    p.x += wx * speed * dt;
    p.y += wy * speed * dt;
    if (p.moving) {
      p.walkT += dt * (0.6 + mag);
      p.fx = p.aimX = wx;
      p.fy = p.aimY = wy;
    }
    this.world.collide(p);
    for (const n of this.nests) pushOut(p, n.x, n.y, n.r);
    for (const c of this.cars) {
      // parked cars are solid
      const dx = p.x - c.x, dy = p.y - c.y, rr = c.r + p.r, d = Math.hypot(dx, dy);
      if (d < rr && d > 0.01) (p.x = c.x + (dx / d) * rr), (p.y = c.y + (dy / d) * rr);
    }
    // whistle: survivors and the dog come running
    if (input.honk && p.whistleT <= 0) {
      p.whistleT = 1;
      this.sound.play('whistle2');
      this.float(pick(['*WHISTLES*', 'OVER HERE!', 'HEY! YOU! NOT DEAD!']), p.x, p.y, 12, 1);
      for (const v of this.civs) if (!v.taken && dist2(v.x, v.y, p.x, p.y) < 350 * 350) v.hail = 4;
    }
    this.tLowHp -= dt;
    if (p.hp < 30 && this.tLowHp <= 0) {
      this.tLowHp = 25;
      this.say(pick(L.LOW_HP), true);
    }
  }

  hurtPlayer(dmg, fromX, fromY, knock = 0) {
    const p = this.player;
    if (p.car) {
      // the car takes the beating instead
      if (p.car.invT <= 0) {
        p.car.invT = 0.15;
        this.hurtCar(p.car, dmg);
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
    this.sound.engine(false);
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
    const pr = p.car ? p.car.r : p.r;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.hitT = Math.max(0, e.hitT - dt);
      if (e.spawnT < 1) {
        e.spawnT = Math.min(1, e.spawnT + dt * e.matSpeed);
        continue;
      }
      e.atkCd -= dt;
      e.walkT += dt;
      if (e.stun > 0) {
        // honked at / soaked: confused for a moment
        e.stun -= dt;
        e.x += e.kx * dt;
        e.y += e.ky * dt;
        e.kx *= Math.pow(0.01, dt);
        e.ky *= Math.pow(0.01, dt);
        w.collide(e);
        continue;
      }
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
      if (e.target && e.target.taken) e.target = null;
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
      const gx = e.x >> 6, gy = e.y >> 6;
      for (let oy = -1; oy <= 1; oy++)
        for (let ox = -1; ox <= 1; ox++) {
          const a = grid.get(((gx + ox) & 0xffff) | (((gy + oy) & 0xffff) << 16));
          if (!a) continue;
          for (const o of a) {
            if (o === e) continue;
            const sx = e.x - o.x, sy = e.y - o.y;
            const rr = e.r + o.r;
            const d2v = sx * sx + sy * sy;
            if (d2v < rr * rr && d2v > 0.01) {
              const dd = Math.sqrt(d2v);
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
      const reach = e.r + (e.target ? tgt.r : pr) + 4;
      if (d < reach && e.atkCd <= 0) {
        e.atkCd = 0.85;
        if (e.target) this.takeCiv(e.target);
        else this.hurtPlayer(e.def.dmg * (1 + this.time / 900) * (p.car && e.type === 'brute' ? 1.6 : 1), e.x, e.y, e.type === 'brute' ? 26 : 6);
      }
    }
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
    this.rate(e.type === 'brute' ? 4 : 1);
    this.sound.play('splat');
    const big = e.type === 'brute';
    for (let i = 0; i < (big ? 18 : 8); i++) this.addFx('goo', e.x, e.y, 20 + rand(30), rand(-160, 160), rand(-160, 160), rand(80, 220), rand(0.5, 0.9));
    this.addDecal('splat', e.x, e.y, big ? 1.8 : 1);
    this.addFx('corpse', e.x, e.y, 0, e.kx * 0.3, e.ky * 0.3, 0, 0.35, 0, e);
    this.drop(e.x, e.y, e.def.drop);
    if (L.KILLS[this.kills] && !this.milestones.has(this.kills)) {
      this.milestones.add(this.kills);
      this.say(L.KILLS[this.kills], true);
    }
  }

  // --- residents, the dog and the cows -------------------------------------------
  updateCivs(dt) {
    const p = this.player, w = this.world;
    const ev = w.evac;
    for (const c of this.civs) {
      c.t += dt;
      c.yell -= dt;
      if (c.taken) {
        if (c.taken === 'probed' || c.taken === 'beamed') {
          c.z = (c.z || 0) + dt * (c.taken === 'beamed' ? 90 : 220);
          c.fade -= dt * (c.taken === 'beamed' ? 0.4 : 1.5);
        } else if (c.taken === 'rescued' && (c.dest || ev)) {
          // shuffle over to the bus (or the church) and get on
          const dst = c.dest || { x: ev.x, y: ev.y - 80 };
          const dx = dst.x - c.x, dy = dst.y - c.y, d = Math.hypot(dx, dy) || 1;
          c.x += (dx / d) * 130 * dt;
          c.y += (dy / d) * 130 * dt;
          c.walkT += dt;
          c.flip = worldDirToScreen(dx, dy)[0] > 0;
          c.fade -= dt * (d < 40 ? 3 : 0.35);
        } else c.fade -= dt * 5;
        continue;
      }
      c.life -= dt;
      c.hail -= dt;
      if (c.follow || c.hail > 0) {
        // tag along behind Dale / run to the honking car
        const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy) || 1;
        const sp = c.hail > 0 ? 165 : d > 220 ? 210 : d > 45 ? 150 : 0;
        c.vx = (dx / d) * sp;
        c.vy = (dy / d) * sp;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        if (sp) c.walkT += dt;
        w.collide(c);
        const sdx = worldDirToScreen(c.vx, c.vy)[0];
        if (Math.abs(sdx) > 5) c.flip = sdx > 0;
        if (c.follow) {
          const z = this.dropZone(c.x, c.y, 150);
          if (z) this.rescueCiv(c, z);
        }
        continue;
      }
      // run away from the nearest alien
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
        if (Math.random() < 0.08 && dist2(c.x, c.y, p.x, p.y) < 500 * 500) this.sound.play('scream');
      }
      if (Math.abs(ax) + Math.abs(ay) < 1 && !p.car && dist2(c.x, c.y, p.x, p.y) < 120 * 120) {
        // Dale is close and nothing is chasing them: wait to be talked to
        c.vx = c.vy = 0;
        c.flip = worldDirToScreen(p.x - c.x, p.y - c.y)[0] > 0;
      } else {
        const mx = ax + c.wx * 80, my = ay + c.wy * 80;
        const l = Math.hypot(mx, my) || 1;
        const sp = c.type === 'civ_tinfoil' ? 95 : 125;
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
          this.float(pick(L.TINFOIL), c.x, c.y, 12, 1.8);
        }
      }
      // they hand Dale whatever they grabbed on the way out
      if (!c.gave && !p.car && dist2(c.x, c.y, p.x, p.y) < 60 * 60) {
        c.gave = true;
        const type = weighted([['fuel', 4], ['medkit', 3], ['repair', 2], ['nitro', 1]]);
        this.pickups.push({ type, x: c.x, y: c.y, t: 0, life: 25, drop: true, pop: 1 });
        this.float(pick(L.GIFT), c.x, c.y, 12, 2);
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
    if (Math.random() < 0.5) this.say(pick(L.CIV_TAKEN));
    this.flashes.push({ x: c.x, y: c.y, z: 30, r: 160, t: 0.4, color: 'magenta' });
    for (let i = 0; i < 12; i++) this.addFx('beamdot', c.x + rand(-14, 14), c.y + rand(-14, 14), rand(0, 40), 0, 0, rand(80, 200), rand(0.5, 1));
  }

  updateDog(dt) {
    const d = this.dog, p = this.player, w = this.world;
    if (!d) return;
    d.petCd -= dt;
    d.barkT -= dt;
    d.bark -= dt;
    const dist = Math.hypot(p.x - d.x, p.y - d.y);
    if (dist > 1100) {
      // good boys always find you
      const a = rand(Math.PI * 2);
      d.x = p.x + Math.cos(a) * 500;
      d.y = p.y + Math.sin(a) * 500;
    }
    // bark at aliens and nip at their ankles
    let threat = null;
    for (const e of this.enemies) if (dist2(e.x, e.y, d.x, d.y) < 160 * 160) (threat = e);
    let tx = p.x, ty = p.y, sp = 0;
    if (threat && dist < 400) {
      tx = threat.x;
      ty = threat.y;
      sp = 230;
      if (d.barkT <= 0) {
        d.barkT = rand(0.8, 1.6);
        d.bark = 0.4;
        this.sound.play('bark');
        if (Math.random() < 0.2) this.float('WOOF!', d.x, d.y, 11, 0.8);
      }
      if (dist2(threat.x, threat.y, d.x, d.y) < 40 * 40) (threat.stun = Math.max(threat.stun, 0.4)), (threat.kx += rand(-60, 60));
    } else if (dist > (p.car ? 70 : 60)) sp = Math.min(p.car ? 330 : 230, 120 + dist * 1.1);
    const dx = tx - d.x, dy = ty - d.y, l = Math.hypot(dx, dy) || 1;
    d.vx = (dx / l) * sp;
    d.vy = (dy / l) * sp;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    if (sp) d.walkT += dt * (sp / 120);
    w.collide(d);
    const sdx = worldDirToScreen(d.vx, d.vy)[0];
    if (Math.abs(sdx) > 5) d.flip = sdx > 0;
    if (p.car && Math.abs(p.car.speed) > 120 && d.barkT <= 0 && Math.random() < 0.3) {
      d.barkT = 2;
      d.bark = 0.4;
      this.sound.play('bark');
    }
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
        c.flip = worldDirToScreen(c.vx, c.vy)[0] > 0;
      }
    }
    this.cows = this.cows.filter((c) => c.z < 260);
  }

  // --- saucers -------------------------------------------------------------------
  updateUfos(dt) {
    const p = this.player;
    for (const u of this.ufos) {
      u.t += dt;
      u.spin += dt * 3;
      const v = u.victim;
      if (u.state === 'in') {
        if (v) (u.tx = v.x), (u.ty = v.y);
        const dx = u.tx - u.x, dy = u.ty - u.y, d = Math.hypot(dx, dy);
        const sp = Math.min(900, 160 + d * 1.4);
        if (d < 12 || (u.kind === 'car' && d < 60)) {
          u.state = 'hover';
          u.t = 0;
          this.sound.play('beam');
        } else {
          u.x += (dx / d) * sp * dt;
          u.y += (dy / d) * sp * dt;
        }
        u.z += (150 - u.z) * dt * 1.5;
        if (u.t > 14) u.state = 'out';
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
          if (u.drops <= 0 && u.t > 1.2) (u.state = 'out'), (u.t = 0);
        } else if (u.kind === 'cow') {
          if (v.state !== 'abducted') {
            v.state = 'abducted';
            this.sound.play('moo');
          }
          v.x += (u.x - v.x) * Math.min(1, dt * 3);
          v.y += (u.y - v.y) * Math.min(1, dt * 3);
          if (v.z > 215 || u.t > 5) {
            u.state = 'out';
            u.t = 0;
            v.z = 999;
            this.say(pick(L.COW), true);
          }
        } else if (u.kind === 'civ') {
          if (!v.taken) {
            v.taken = 'beamed';
            this.sound.play('scream');
          }
          v.x += (u.x - v.x) * Math.min(1, dt * 3);
          v.y += (u.y - v.y) * Math.min(1, dt * 3);
          if (v.z > 200 || u.t > 4.5) {
            u.state = 'out';
            u.t = 0;
            if (Math.random() < 0.6) this.say(pick(L.CIV_TAKEN));
          }
        } else if (u.kind === 'car') {
          // chase the car slowly; it can be outrun
          const dx = v.x - u.x, dy = v.y - u.y, d = Math.hypot(dx, dy) || 1;
          const sp = Math.min(d * 2, 125 + this.level * 10);
          u.x += (dx / d) * sp * dt;
          u.y += (dy / d) * sp * dt;
          if (d < 62 && !v.wreck) {
            v.beamT = 0.15;
            v.lift = Math.min(1.2, v.lift + dt * 0.42);
            if (v === p.car && !u.warned && v.lift > 0.25) {
              u.warned = true;
              this.float('STEER OUT OF THE BEAM! OR HONK!', v.x, v.y, 13, 2);
            }
            if (v.lift >= 1) {
              this.abductCar(v);
              u.state = 'out';
              u.t = 0;
            }
          }
          if (u.t > 10 || v.gone || v.wreck) (u.state = 'out'), (u.t = 0);
        }
      } else if (u.state === 'out') {
        u.beam = Math.max(0, u.beam - dt * 3);
        u.x += ((u.sx - u.tx) / 1400) * 700 * dt;
        u.y += ((u.sy - u.ty) / 1400) * 700 * dt;
        u.z += dt * 120;
        if (u.t > 3.5) u.gone = true;
      }
    }
    this.ufos = this.ufos.filter((u) => !u.gone);
  }

  spookUfo(u) {
    const v = u.victim;
    u.state = 'out';
    u.t = 0;
    u.spooked = true;
    this.rate(5);
    this.flashDrones();
    this.float(pick(L.SPOOKED), u.x, u.y, 13, 1.8);
    this.sound.play('beam');
    if (u.kind === 'cow' && v && v.state === 'abducted' && v.z < 999) {
      v.state = 'graze';
      v.z = 0;
      v.rot = 0;
      v.scale = 1;
      v.target = false;
      if (this.mission && this.mission.type === 'cow' && this.mission.ufo === u) this.completeMission();
      else this.say('COW SAVED BY A CAR HORN. SCIENCE CANNOT EXPLAIN IT.', true);
    }
    if (u.kind === 'civ' && v && v.taken === 'beamed') {
      v.taken = null;
      v.z = 0;
      v.fade = 1;
      v.hail = 3;
      this.float('THANK YOU, LOUD MAN!', v.x, v.y, 12, 1.6);
    }
  }

  abductCar(c) {
    const p = this.player;
    c.gone = true;
    this.rate(5);
    this.flashes.push({ x: c.x, y: c.y, z: 60, r: 260, t: 0.5, color: 'cyan' });
    for (let i = 0; i < 16; i++) this.addFx('beamdot', c.x + rand(-30, 30), c.y + rand(-30, 30), rand(20, 80), 0, 0, rand(100, 220), rand(0.6, 1.2));
    if (c === p.car) {
      p.car = null;
      this.sound.siren(false);
      this.sound.engine(false);
      if (c.seats.length) this.say('YOUR PASSENGERS ARE NOW EXCHANGE STUDENTS. ON ANOTHER PLANET.', true);
      this.say(pick(L.CAR_TAKEN), true);
      p.x = c.x;
      p.y = c.y;
      this.world.collide(p);
      this.hurtPlayer(15, c.x + 1, c.y, 0);
      this.showBanner('CAR ABDUCTED', 'IT HAD 200,000 MILES ON IT ANYWAY');
    } else if (Math.random() < 0.5) this.say(pick(['ANOTHER CAR BEAMED UP. THEY REALLY LIKE MINIVANS.', 'A CAR JUST WENT TO SPACE. THE PAYMENTS DID NOT.']));
  }

  updateMother(dt) {
    const m = this.mother;
    if (!m) return;
    const p = this.player;
    m.t += dt;
    let tx = p.x - 120 + Math.cos(m.t * 0.3) * 160, ty = p.y - 120 + Math.sin(m.t * 0.3) * 160;
    if (m.hunt) {
      // the finale: she follows Dale everywhere, a little behind
      tx = p.x - 60 + Math.cos(m.t * 0.5) * 90;
      ty = p.y - 60 + Math.sin(m.t * 0.5) * 90;
      if (this.f('power')) m.hunt = false, m.leaveT = 0;
    }
    if (m.state === 'leave') {
      m.z += dt * 140;
      m.x -= dt * 300;
      m.y -= dt * 300;
      if (m.z > 900) this.mother = null;
      return;
    }
    const sp = m.state === 'in' ? 2.2 : m.hunt ? 0.9 : 0.6;
    m.x += (tx - m.x) * sp * dt;
    m.y += (ty - m.y) * sp * dt;
    if (m.state === 'in' && dist2(m.x, m.y, tx, ty) < 200 * 200) m.state = 'fight';
    if (m.state !== 'fight') return;
    m.leaveT -= dt;
    m.fireCd -= dt;
    if (m.fireCd <= 0) {
      m.fireCd = Math.max(1.8, 3.4 - this.level * 0.2);
      const n = 12 + this.level * 2;
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
    if (m.leaveT <= 0 && !m.hunt) {
      m.state = 'leave';
      this.showBanner('MEETING ADJOURNED', 'YOU SURVIVED THE NETWORK EXECUTIVE');
      this.say(pick(L.MOTHER_LEAVE), true);
      for (let i = 0; i < 3; i++) this.drop(p.x + rand(-80, 80), p.y + rand(-80, 80), 1);
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
      if (n.spawnCd <= 0 && this.enemies.length < 150) {
        n.spawnCd = Math.max(1.8, 4.5 - this.time / 200);
        this.spawnEnemy(this.rollType(), n.x + rand(-20, 20), n.y + 50, 2);
      }
    }
  }

  damageNest(n, dmg) {
    n.hp -= dmg;
    n.hitT = 0.12;
    if (n.hp <= 0 && !n.dead) {
      n.dead = true;
      this.rate(12);
      this.flashDrones();
      if (this.mode === 'story') this.earn(3);
      this.explode(n.x, n.y, 30, true);
      this.pickups.push({ type: 'nitro', x: n.x + 30, y: n.y, t: 0, life: 30, drop: true, pop: 1 });
      this.drop(n.x, n.y, 1);
      this.say(pick(['SAUCER DESTROYED. THE HOA THANKS YOU.', 'THAT SAUCER IS NOW MODERN ART.', 'RAMMED IT. NO INSURANCE COMPANY WILL EVER COVER YOU AGAIN.']), true);
      this.addDamage(n.x, n.y, 75000, 'ALIEN SAUCER');
    }
    this.nests = this.nests.filter((q) => !q.dead);
  }

  updateEBullets(dt) {
    const p = this.player, w = this.world;
    const pr = p.car ? p.car.r : p.r;
    for (const b of this.ebullets) {
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (w.hitProp(b.x, b.y)) {
        b.life = 0;
        continue;
      }
      if (dist2(b.x, b.y, p.x, p.y) < (pr + (b.big ? 10 : 6)) ** 2) {
        b.life = 0;
        this.hurtPlayer(b.dmg, b.x, b.y, 4);
      }
    }
    this.ebullets = this.ebullets.filter((b) => b.life > 0);
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
    for (const c of this.cars) {
      if (c === p.car || c.wreck) continue;
      const d2v = dist2(c.x, c.y, x, y);
      if (d2v < R * R) this.hurtCar(c, (big ? 90 : 50) * (1 - Math.sqrt(d2v) / R));
    }
    this.shake = Math.max(this.shake, big ? 16 : 11);
    this.rate(big ? 3 : 1.5);
    this.flashes.push({ x, y, z: z + 20, r: big ? 420 : 300, t: 0.35, color: 'orange' });
    this.addFx('ring', x, y, 2, 0, 0, 0, 0.45, R * 1.1);
    for (let i = 0; i < (big ? 26 : 16); i++) this.addFx('fire', x + rand(-25, 25), y + rand(-25, 25), z + rand(0, 30), rand(-140, 140), rand(-140, 140), rand(40, 200), rand(0.4, 0.8), rand(1, 1.8));
    for (let i = 0; i < (big ? 14 : 8); i++) this.addFx('smoke', x + rand(-30, 30), y + rand(-30, 30), z + rand(10, 40), rand(-40, 40), rand(-40, 40), rand(20, 60), rand(1.4, 2.6), rand(1, 1.8));
    for (let i = 0; i < 10; i++) this.addFx('debris', x, y, z + 10, rand(-220, 220), rand(-220, 220), rand(120, 320), rand(0.8, 1.4));
    this.addDecal('scorch', x, y, big ? 1.5 : 1.1);
    if (!silent) this.sound.play(big ? 'bigboom' : 'boom');
    else this.sound.play('boom');
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
    const car = p.car;
    for (const k of this.pickups) {
      k.t += dt;
      if (k.pop) k.pop = Math.max(0, k.pop - dt * 3);
      if (k.drop) k.life -= dt;
      if (p.dead) continue;
      const d2v = dist2(k.x, k.y, p.x, p.y);
      if (!car && d2v < 90 * 90) {
        const d = Math.sqrt(d2v) || 1;
        k.x += ((p.x - k.x) / d) * 260 * dt;
        k.y += ((p.y - k.y) / d) * 260 * dt;
      }
      if (d2v < (car ? 48 : 30) ** 2) {
        k.taken = true;
        this.collect(k.type);
      }
    }
    this.pickups = this.pickups.filter((k) => !k.taken && k.life > 0);
  }

  collect(type) {
    const p = this.player, c = p.car;
    let text;
    if (type === 'fuel') {
      if (c) {
        c.fuel = Math.min(c.maxFuel, c.fuel + c.maxFuel * 0.6);
        c.warned = 0;
        text = pick(L.PICKUP.fuel);
      } else if (p.cans < 3) {
        p.cans++;
        text = '+1 FUEL CAN';
      } else text = 'CAN\'T CARRY MORE GAS. PROBABLY FOR THE BEST.';
    } else if (type === 'repair') {
      if (c) {
        c.hp = Math.min(c.maxHp, c.hp + c.maxHp * 0.5);
        text = pick(L.PICKUP.repair);
      } else {
        p.hp = Math.min(p.maxHp, p.hp + 20);
        text = 'DUCT TAPE. +20 HP. YOU ARE MOSTLY TAPE NOW.';
      }
    } else if (type === 'medkit') {
      p.hp = Math.min(p.maxHp, p.hp + 35);
      text = pick(L.PICKUP.medkit);
    } else if (type === 'nitro') {
      p.nitro = Math.min(6, p.nitro + 2);
      text = pick(L.PICKUP.nitro);
    }
    this.sound.play(type === 'nitro' ? 'power' : 'pickup');
    this.float(text, p.x, p.y, 13, 1.6);
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
      if (p.car && dist2(t.x, t.y, p.x, p.y) < 40 * 40) {
        // tumbleweed vs bumper
        t.vx = Math.cos(p.car.h) * p.car.speed * 0.9;
        t.vy = Math.sin(p.car.h) * p.car.speed * 0.9;
        t.vz = 260;
      }
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
      if (f.emit <= 0 && dist2(q.x, q.y, p.x, p.y) < 1100 * 1100) {
        f.emit = 0.09;
        const b = q.box;
        const x = b.x0 + rand(b.x1 - b.x0), y = b.y0 + rand(b.y1 - b.y0);
        this.addFx('fire', x, y, rand(10, 80), rand(-15, 15), rand(-15, 15), rand(40, 90), rand(0.5, 1), 1.4);
        if (Math.random() < 0.5) this.addFx('smoke', x, y, 100, rand(-10, 10) + 20, rand(-10, 10), rand(30, 60), rand(2.5, 4), 2.2);
      }
    }
    // somebody is still baking pies: chimney smoke
    this.tChimney -= dt;
    if (this.tChimney <= 0) {
      this.tChimney = 0.18;
      const h = pick(this.houses);
      if (h && !h.burning && dist2(h.x, h.y, p.x, p.y) < 900 * 900) this.addFx('smoke', h.x - 40, h.y - 40, 175, rand(10, 25), rand(-5, 5), rand(18, 30), rand(2.5, 4), 0.55);
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
    if (this.fx.length > 750) return;
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
        case 'water':
          f.vz -= (f.type === 'water' ? 600 : 700) * dt;
          if (f.z <= 0) {
            f.z = 0;
            f.vx *= 0.8;
            f.vy *= 0.8;
            f.vz = 0;
            if (f.type === 'water') f.life = Math.min(f.life, 0.2);
            if (f.type === 'goo' && !f.splat) {
              f.splat = true;
              if (Math.random() < 0.2) this.addDecal('drop', f.x, f.y, 0.4);
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

Object.assign(Game.prototype, VehicleMixin, InteractMixin, AdventureMixin, NpcMixin);

export { N };
