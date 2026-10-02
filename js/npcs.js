// The town is a set and everybody is acting: HOA enforcers with clipboards, Desert Rats on the
// prowl, cultists chasing saucers, alien wardens enforcing the curfew, camera drones filming it all,
// and the ratings that decide when the Network adds a "plot twist".
import { TILE, rand, pick, clamp, dist2, worldDirToScreen } from './util.js';
import { BARKS } from './story.js';

const KIND_FAC = { hoa: 'hoa', biker: 'rats', cultist: 'church', warden: 'network' };
const SPEED = { hoa: 95, biker: 120, cultist: 80, warden: 100 };
const POP = { hoa: 6, biker: 6, cultist: 5, warden: 5 };

const INSULTS = {
  hoa: ['YOUR BIKE IS A CODE VIOLATION!', 'THAT VEST IS NOT HOA APPROVED!', 'I AM CALLING BRENDA!', 'MOW SOMETHING!'],
  biker: ['NICE VISOR, KAREN!', 'FINE THIS!', 'ANARCHY! ALSO, YOUR LAWN IS UGLY!', 'COME AT ME, CLIPBOARD!'],
  cultist: ['TAKE ME! TAKE ME!', 'HERE! OVER HERE!', 'PICK ME! I HAVE A PASSPORT!', 'BEAM ME UP! PLEASE!'],
};

const EVENTS = {
  standoff: 'BREAKING: THE HOA AND THE DESERT RATS ARE IN A STANDOFF IN TOWN. BOTH SIDES ARE ARMED. WITH OPINIONS.',
  procession: 'THE CHURCH OF THE BLESSED PROBE IS HOLDING A PROCESSION. THEY ARE WALKING TOWARD THE NEAREST SAUCER. SLOWLY. HOPEFULLY.',
  shoot: 'THE NETWORK IS SHOOTING A SCENE IN TOWN. WALK INTO THE SHOT FOR BONUS RATINGS. OR A RESTRAINING ORDER.',
  looting: 'THE DESERT RATS ARE REDECORATING SOMEBODY\'S HOUSE. WITH FIRE.',
  inspection: 'HOA LAWN INSPECTION IN PROGRESS. RESIDENTS ARE ADVISED TO HIDE THEIR LAWNS.',
};

export const NpcMixin = {
  initNpcs() {
    this.npcs = [];
    this.drones = [];
    this.tNpc = 0.5;
    this.tAnarchy = 35;
    this.plotT = 0;
    this.sponsorT = 0;
    this.rateFlash = 0;
    this.onAir = 0;
    const w = this.world;
    // everybody starts at home
    for (const kind of Object.keys(POP)) for (let i = 0; i < POP[kind]; i++) this.spawnNpc(kind);
    const lot = w.landmarks.find((l) => l.id === 'tower');
    for (let i = 0; i < 5; i++) {
      const base = i < 2 && lot ? lot : this.player;
      this.drones.push({ x: base.x + rand(-300, 300), y: base.y + rand(-300, 300), z: rand(80, 110), vx: 0, vy: 0, t: rand(6), i, off: 0, flash: 0, ang: rand(6.28) });
    }
  },

  npcHome(kind) {
    const w = this.world;
    const fac = KIND_FAC[kind];
    if (kind === 'warden') {
      // half of the wardens patrol the town roads, the rest guard the lot
      if (Math.random() < 0.5 && w.roadNodes.length) {
        const n = pick(w.roadNodes.filter((q) => !q.exit));
        return { x: n.x + rand(-30, 30), y: n.y + rand(-30, 30), roam: 520, patrol: true };
      }
    }
    const list = w.spawns[fac] || [];
    const s = list.length ? pick(list) : { x: this.player.x, y: this.player.y };
    return { x: s.x + rand(-80, 80), y: s.y + rand(-80, 80), roam: kind === 'hoa' ? 420 : 320 };
  },

  spawnNpc(kind, x, y, home) {
    const h = home || this.npcHome(kind);
    const n = {
      kind, fac: KIND_FAC[kind], x: x === undefined ? h.x : x, y: y === undefined ? h.y : y, r: 10, home: h, vx: 0, vy: 0, flip: Math.random() < 0.5,
      walkT: rand(5), state: 'idle', t: rand(1, 3), tx: h.x, ty: h.y, barkT: rand(3, 8), hitCd: 0, z: 0, vz: 0, rot: 0, sp: SPEED[kind] * rand(0.85, 1.1),
    };
    if (!this.world.isWalkable(n.x, n.y)) {
      const s = this.world.randomSpot(n.x, n.y, 10, 200);
      if (s) (n.x = s.x), (n.y = s.y);
    }
    this.npcs.push(n);
    return n;
  },

  npcHostile(n) {
    if (this.mode !== 'story') return n.kind === 'warden' && this.darkness > 0.6;
    const rep = this.repOf(n.fac);
    if (n.kind === 'warden') {
      if (this.f('hunted') && !this.f('power')) return true;
      if (rep <= -25) return true;
      if (this.has('lanyard')) return false;
      // curfew after dark, and nobody sneaks around the studio lot without a pass
      if (this.darkness > 0.6) return true;
      if (this.world.inLot(this.player.x, this.player.y) && !this.has('setpass')) return true;
      return false;
    }
    return rep <= -25;
  },
  npcMood(n) {
    if (this.npcHostile(n)) return 'hostile';
    const rep = this.mode === 'story' ? this.repOf(n.fac) : 0;
    return rep >= 25 ? 'friendly' : 'neutral';
  },

  updateNpcs(dt) {
    const p = this.player, w = this.world;
    const inCar = !!p.car;
    const beams = this.ufos.filter((u) => u.state === 'hover' && u.beam > 0.5);
    for (const n of this.npcs) {
      n.hitCd -= dt;
      n.barkT -= dt;
      n.t -= dt;
      if (n.state === 'knocked') {
        n.vz -= 900 * dt;
        n.z += n.vz * dt;
        n.x += n.vx * dt;
        n.y += n.vy * dt;
        n.rot += dt * 9 * (n.flip ? -1 : 1);
        if (n.z <= 0) {
          n.z = 0;
          n.vz = 0;
          n.vx *= Math.pow(0.02, dt);
          n.vy *= Math.pow(0.02, dt);
          n.rot = (n.flip ? -1 : 1) * Math.PI / 2;
        }
        w.collide(n);
        if (n.t <= 0) {
          n.state = 'idle';
          n.rot = 0;
          n.t = 1;
          if (Math.random() < 0.6) this.float(pick(['OW.', 'I WILL SUE.', 'MY BACK!', 'WORTH IT.', 'THAT IS ASSAULT WITH A VEHICLE!']), n.x, n.y, 11, 1.4);
        }
        continue;
      }
      const dP = Math.sqrt(dist2(n.x, n.y, p.x, p.y));
      const hostile = !p.dead && this.npcHostile(n);
      let mx = 0, my = 0, sp = 0;
      // cultists run into tractor beams
      let beam = null;
      if (n.kind === 'cultist') for (const u of beams) if (dist2(u.x, u.y, n.x, n.y) < 700 * 700) beam = u;
      if (n.state === 'event' && n.ev && n.ev.t > 0) {
        // standing around in an anarchy event
        const dx = n.tx - n.x, dy = n.ty - n.y, d = Math.hypot(dx, dy);
        if (d > 14) (mx = dx / d), (my = dy / d), (sp = n.sp * 0.9);
        if (n.face) n.flip = worldDirToScreen(n.face.x - n.x, n.face.y - n.y)[0] > 0;
        if (Math.random() < dt * 0.35 && INSULTS[n.kind]) this.float(pick(INSULTS[n.kind]), n.x, n.y, 11, 1.6);
      } else if (beam) {
        const dx = beam.x - n.x, dy = beam.y - n.y, d = Math.hypot(dx, dy) || 1;
        if (d > 30) (mx = dx / d), (my = dy / d), (sp = n.sp * 1.5);
        if (n.barkT <= 0) {
          n.barkT = rand(2, 4);
          this.float(d < 60 ? pick(['NOT YOU, GARY.', '...THEY SAID NO AGAIN.', 'WHY NOT ME?!']) : pick(INSULTS.cultist), n.x, n.y, 11, 1.5);
        }
      } else if (hostile && !inCar && !this.scene && dP < (n.kind === 'warden' ? 420 : 340)) {
        // chase Dale
        const dx = p.x - n.x, dy = p.y - n.y;
        mx = dx / (dP || 1);
        my = dy / (dP || 1);
        sp = n.sp * 1.35;
        if (dP < 26 && n.hitCd <= 0) this.npcAttack(n);
      } else if (inCar && dP < 150 && Math.abs(p.car.speed) > 120) {
        // dive out of the way of the lunatic in the cop car
        const ch = Math.cos(p.car.h), sh = Math.sin(p.car.h);
        const side = -(n.x - p.x) * sh + (n.y - p.y) * ch > 0 ? 1 : -1;
        mx = -sh * side;
        my = ch * side;
        sp = n.sp * 2;
      } else {
        // wander around home
        if (n.t <= 0) {
          n.t = rand(2.5, 6);
          const h = n.home;
          if (Math.random() < 0.35) (n.tx = n.x), (n.ty = n.y);
          else if (h.patrol) {
            const nodes = w.roadNodes.filter((q) => !q.exit && dist2(q.x, q.y, n.x, n.y) < 900 * 900);
            const q = nodes.length ? pick(nodes) : h;
            n.tx = q.x + rand(-40, 40);
            n.ty = q.y + rand(-40, 40);
          } else {
            const a = rand(Math.PI * 2), r = rand(40, h.roam);
            n.tx = h.x + Math.cos(a) * r;
            n.ty = h.y + Math.sin(a) * r;
          }
        }
        const dx = n.tx - n.x, dy = n.ty - n.y, d = Math.hypot(dx, dy);
        if (d > 12) (mx = dx / d), (my = dy / d), (sp = n.sp * 0.6);
      }
      n.vx = mx * sp;
      n.vy = my * sp;
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      if (sp) n.walkT += dt * (sp / 90);
      const ox = n.x, oy = n.y;
      w.collide(n);
      if (sp && Math.abs(n.x - ox) + Math.abs(n.y - oy) > sp * dt * 0.7) n.t = Math.min(n.t, 0.2); // bumped into something: pick a new goal
      const sdx = worldDirToScreen(n.vx, n.vy)[0];
      if (Math.abs(sdx) > 5 && n.state !== 'event') n.flip = sdx > 0;
      // barks when Dale walks by
      if (n.barkT <= 0 && dP < 230 && !this.scene) {
        n.barkT = rand(7, 14);
        if (Math.random() < 0.55) this.float(pick(BARKS[n.fac][this.npcMood(n)]), n.x, n.y, 11, 1.8);
      }
    }
    // HOA vs Rats: they cannot pass each other without a fight
    for (const a of this.npcs) {
      if (a.kind !== 'hoa' || a.state === 'knocked') continue;
      for (const b of this.npcs) {
        if (b.kind !== 'biker' || b.state === 'knocked' || dist2(a.x, a.y, b.x, b.y) > 130 * 130) continue;
        if (Math.random() < dt * 0.25) this.float(pick(INSULTS.hoa), a.x, a.y, 11, 1.5);
        if (Math.random() < dt * 0.25) this.float(pick(INSULTS.biker), b.x, b.y, 11, 1.5);
      }
    }
    // events end
    for (const n of this.npcs) if (n.state === 'event' && n.ev && (n.ev.t -= dt / (n.ev.n || 1)) <= 0) n.state = 'idle';
    // keep the population up (far from Dale) and drop the ones that wandered too far
    this.tNpc -= dt;
    if (this.tNpc <= 0) {
      this.tNpc = 2;
      for (const kind of Object.keys(POP)) {
        const have = this.npcs.filter((n) => n.kind === kind).length;
        if (have < POP[kind] + (kind === 'warden' ? this.act * 2 : 0)) {
          const n = this.spawnNpc(kind);
          if (dist2(n.x, n.y, p.x, p.y) < 500 * 500) this.npcs.pop();
        }
      }
      this.npcs = this.npcs.filter((n) => n.state === 'knocked' || dist2(n.x, n.y, n.home.x, n.home.y) < 2600 * 2600);
    }
    this.updateAnarchy(dt);
  },

  npcAttack(n) {
    const p = this.player;
    n.hitCd = 2.2;
    switch (n.kind) {
      case 'hoa': {
        const fine = Math.min(this.coupons, 3);
        this.coupons -= fine;
        this.sound.play('fine');
        this.float(pick(['FINED! UNAUTHORIZED EXISTENCE!', 'FINED! LAWN CRIMES!', 'FINED! YOUR FACE!']) + (fine ? ' -' + fine + ' COUPONS' : ''), p.x, p.y, 12, 1.8);
        n.hitCd = 6;
        break;
      }
      case 'biker':
        this.float(pick(['PUNCH!', 'THAT IS FOR BRENDA! WAIT. NO.', 'NARC!']), p.x, p.y, 12, 1.2);
        this.hurtPlayer(7, n.x, n.y, 18);
        break;
      case 'cultist':
        this.float(pick(['JOIN US!', 'HUG OF FAITH!', 'HAVE A PAMPHLET!']), p.x, p.y, 12, 1.4);
        p.invT = 0;
        this.hurtPlayer(3, n.x, n.y, 6);
        break;
      case 'warden':
        this.float(pick(['CURFEW VIOLATION!', 'NO PERMIT!', 'OFF THE SET!']), p.x, p.y, 12, 1.4);
        this.sound.play('zap');
        this.hurtPlayer(9, n.x, n.y, 22);
        for (let i = 0; i < 6; i++) this.addFx('beamdot', p.x + rand(-12, 12), p.y + rand(-12, 12), rand(10, 40), 0, 0, rand(60, 120), 0.5);
        break;
    }
  },

  // a car hits a person: nobody dies in this town, they just fly and complain
  knockNpc(n, c, sp) {
    if (n.state === 'knocked') return;
    n.state = 'knocked';
    n.t = 2.4;
    n.z = 1;
    n.vz = 220 + sp * 0.4;
    n.vx = Math.cos(c.h) * sp * 0.7 + rand(-60, 60);
    n.vy = Math.sin(c.h) * sp * 0.7 + rand(-60, 60);
    this.sound.play('thud');
    this.float(pick(['OOF!', 'MY HIP!', 'HEY!', 'NOT THE FACE!']), n.x, n.y, 12, 1.2);
    if (c === this.player.car) {
      if (this.mode === 'story') this.rep(n.fac, -6, true);
      this.rate(3);
      if (n.kind === 'warden') this.float('ASSAULTING THE CREW!', n.x, n.y, 12, 1.4);
    }
  },

  // --- anarchy events ------------------------------------------------------------------------------------
  updateAnarchy(dt) {
    if (this.mode !== 'story' && this.time < 60) return;
    this.tAnarchy -= dt;
    if (this.tAnarchy > 0) return;
    this.tAnarchy = rand(45, 75);
    const p = this.player, w = this.world;
    const spot = w.randomSpot(p.x, p.y, 380, 700, 40);
    if (!spot) return;
    const type = pick(['standoff', 'standoff', 'procession', 'shoot', 'looting', 'inspection']);
    const ev = { t: 22, type };
    const add = (kind, dx, dy) => {
      const n = this.spawnNpc(kind, spot.x + dx, spot.y + dy, { x: spot.x, y: spot.y, roam: 200 });
      n.state = 'event';
      n.ev = ev;
      n.tx = spot.x + dx * 0.4;
      n.ty = spot.y + dy * 0.4;
      return n;
    };
    if (type === 'standoff') {
      const a = [add('hoa', -90, -20), add('hoa', -80, 30)];
      const b = [add('biker', 90, 20), add('biker', 80, -30)];
      for (const n of a) n.face = b[0];
      for (const n of b) n.face = a[0];
    } else if (type === 'procession') {
      for (let i = 0; i < 4; i++) add('cultist', -200 + i * 40, -200 + i * 40).tx = spot.x + i * 30;
    } else if (type === 'shoot') {
      add('warden', -40, 0);
      add('warden', 40, 10);
      const d = this.drones.find((q) => !q.off);
      if (d) (d.x = spot.x), (d.y = spot.y);
      this.shootSpot = { x: spot.x, y: spot.y, t: 20 };
    } else if (type === 'looting') {
      add('biker', -30, 0);
      add('biker', 30, 10);
      const h = w.props.find((q) => q.box && !q.burning && q.type.startsWith('house') && dist2(q.x, q.y, spot.x, spot.y) < 500 * 500);
      if (h) this.ignite(h);
    } else if (type === 'inspection') {
      add('hoa', 0, 0);
      add('hoa', 50, 30);
      add('hoa', -40, 40);
    }
    ev.n = this.npcs.filter((n) => n.ev === ev).length;
    this.say(EVENTS[type], false);
  },

  // --- camera drones + ratings ------------------------------------------------------------------------------
  updateDrones(dt) {
    const p = this.player;
    let near = 0;
    for (const d of this.drones) {
      d.t += dt;
      d.flash = Math.max(0, d.flash - dt * 3);
      if (d.off > 0) {
        d.off -= dt;
        d.z = Math.max(8, d.z - dt * 120);
        if (Math.random() < dt * 6) this.addFx('spark', d.x, d.y, d.z, rand(-60, 60), rand(-60, 60), rand(20, 80), 0.3);
        continue;
      }
      d.z += (rand(80, 110) - d.z) * dt;
      // the star of the show is always in frame
      d.ang += dt * (0.25 + d.i * 0.04) * (d.i % 2 ? 1 : -1);
      const R = 220 + d.i * 70;
      let tx = p.x + Math.cos(d.ang) * R, ty = p.y + Math.sin(d.ang) * R;
      const shoot = this.shootSpot;
      if (shoot && d.i === 0) (tx = shoot.x), (ty = shoot.y);
      const dx = tx - d.x, dy = ty - d.y, dd = Math.hypot(dx, dy) || 1;
      const sp = Math.min(dd * 1.2, p.car ? 520 : 260);
      d.vx += ((dx / dd) * sp - d.vx) * Math.min(1, dt * 2);
      d.vy += ((dy / dd) * sp - d.vy) * Math.min(1, dt * 2);
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (dist2(d.x, d.y, p.x, p.y) < 560 * 560) near++;
    }
    this.onAir = near;
    if (this.shootSpot && (this.shootSpot.t -= dt) <= 0) this.shootSpot = null;
    if (this.shootSpot && dist2(p.x, p.y, this.shootSpot.x, this.shootSpot.y) < 120 * 120 && !this.shootSpot.bombed) {
      this.shootSpot.bombed = true;
      this.float('PHOTOBOMB! +RATINGS', p.x, p.y, 14, 1.6);
      this.rate(8);
      this.sound.play('camera');
    }
  },
  droneBonus() {
    return 1 + Math.min(1.5, (this.onAir || 0) * 0.5);
  },
  flashDrones() {
    for (const d of this.drones) if (!d.off && dist2(d.x, d.y, this.player.x, this.player.y) < 700 * 700) d.flash = 1;
  },

  updateRatings(dt) {
    this.rateFlash = Math.max(0, (this.rateFlash || 0) - dt * 1.5);
    if (this.scene || this.dialog) return;
    // boring is a crime
    this.ratings = clamp(this.ratings - dt * (this.mode === 'story' ? 0.32 : 0.25), 0, 100);
    if (this.ratings < 10 && this.rt > this.plotT) {
      this.plotT = this.rt + 70;
      this.plotTwist();
    }
    if (this.ratings > 94 && this.rt > this.sponsorT) {
      this.sponsorT = this.rt + 60;
      this.sponsorDrop();
    }
  },
  plotTwist() {
    const p = this.player;
    const opts = ['meteors', 'saucers', 'brutes'];
    if (this.act >= 2 && !this.mother) opts.push('mother');
    if (this.nests.length < 3) opts.push('nest');
    const t = pick(opts);
    this.showBanner('PLOT TWIST!', 'THE NETWORK WAS BORED. NOW IT IS NOT.');
    this.say(pick(['NETWORK NOTE: THE AUDIENCE IS FALLING ASLEEP. PLEASE ENJOY THIS PLOT TWIST.', 'NETWORK NOTE: RATINGS ARE DOWN. WE ARE ADDING CONFLICT. YOU ARE THE CONFLICT.', 'NETWORK NOTE: LESS WALKING, MORE SCREAMING.']), true);
    if (t === 'meteors') this.showerT = 10;
    else if (t === 'saucers') for (let i = 0; i < 2; i++) this.spawnUfo('drop');
    else if (t === 'brutes') {
      const s = this.edgeSpot();
      if (s) for (let i = 0; i < 2; i++) this.spawnEnemy('brute', s.x + rand(-40, 40), s.y + rand(-40, 40), 1);
    } else if (t === 'mother') this.spawnMother();
    else if (t === 'nest') this.spawnNest();
    this.ratings = 45;
    void p;
  },
  sponsorDrop() {
    const p = this.player;
    this.showBanner('SPONSOR DROP!', 'BROUGHT TO YOU BY CAR INSURANCE. THEY ARE VERY NERVOUS.');
    this.sound.play('power');
    const s = this.world.randomSpot(p.x, p.y, 80, 200) || { x: p.x + 60, y: p.y + 40 };
    for (const type of ['fuel', 'repair', 'medkit', 'nitro']) this.pickups.push({ type, x: s.x + rand(-50, 50), y: s.y + rand(-50, 50), t: 0, life: 40, drop: true, pop: 1.5 });
    if (this.mode === 'story') this.earn(6);
    this.flashes.push({ x: s.x, y: s.y, z: 60, r: 260, t: 0.4, color: 'magenta' });
    this.ratings = 72;
  },
};
