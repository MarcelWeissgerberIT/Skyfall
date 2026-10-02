// Everything Dale can do with the context button: get into (or steal) cars, talk survivors into
// following him, pet cows and the dog, rummage through houses, rig the gas station - and run
// errands for a very sarcastic dispatcher.
import { TILE, rand, randi as randInt, pick, clamp, dist2, weighted } from './util.js';
import * as L from './lines.js';

import { SCENES, BARKS, LOOK } from './story.js';

const SEARCH_TIME = { house: 1.4, store: 1.6, trailer: 1.2, car: 0.9, bin: 0.6, potty: 1.0, junk: 1.3, ufo: 1.8, motel: 1.5 };
export const ACTION_LABEL = { search: 'SEARCH', drive: 'DRIVE', carjack: 'CARJACK', talk: 'TALK', pet: 'PET', rig: 'RIG IT', exit: 'GET OUT', bail: 'BAIL OUT', enter: 'ENTER', guard: 'TALK', chat: 'TALK', use: 'USE' };
export const ACTION_ICON = { search: 'btn_search', drive: 'btn_drive', carjack: 'btn_drive', talk: 'btn_talk', pet: 'btn_pet', rig: 'btn_rig', exit: 'btn_exit', bail: 'btn_exit', enter: 'btn_enter', guard: 'btn_talk', chat: 'btn_talk', use: 'btn_use' };

// Things in town with their own little interaction when Dale walks up and taps them.
const PROP_USE = {
  phone_booth: [
    'YOU PICK UP THE PHONE. A VOICE: THANK YOU FOR CALLING THE NETWORK. YOUR CALL IS IMPORTANT TO US. YOUR PLANET IS NOT.',
    "YOU DIAL YOUR EX-WIFE. SHE PICKS UP, SAYS: TYPICAL, AND HANGS UP. THE ALIENS DIDN'T EVEN HAVE TO DO ANYTHING.",
    'YOU DIAL 911. IT RINGS IN SPACE.',
    'A RECORDED MESSAGE: PRESS 1 TO BE ABDUCTED. PRESS 2 TO BE ABDUCTED IN SPANISH.',
  ],
  icecream: ['YOU HONK THE ICE CREAM TRUCK HORN. IT PLAYS THE SONG. SOMEWHERE A CHILD SCREAMS WITH JOY. OR TERROR.', 'THE FREEZER IS FULL OF POPSICLES SHAPED LIKE ALIENS. THEY ARE ALL BITTEN. FROM THE INSIDE.'],
  speaker_pole: ['THE LOUDSPEAKER CRACKLES: CITIZENS, PLEASE REMAIN CALM AND ATTRACTIVE. THE FINALE IS COMING.', 'THE LOUDSPEAKER: REMINDER - SCREAMING IS ONLY PERMITTED IN YOUR KEY LIGHT.', 'THE LOUDSPEAKER PLAYS ELEVATOR MUSIC. THE ALIEN KIND. IT IS SIX HOURS OF ONE NOTE.'],
  burn_barrel: ['YOU WARM YOUR HANDS AT THE BARREL. A BIKER NODS AT YOU. THIS IS FRIENDSHIP NOW.'],
  billboard_a: ['SOMEONE SPRAYED UNDER THE BILLBOARD: THE COW KNOWS.'],
  billboard_b: ['UNDER THE BILLBOARD: A TINY TINFOIL SHRINE. KEVIN WAS HERE.'],
  water_tower: ['YOU KNOCK ON A LEG OF THE WATER TOWER. SOMETHING INSIDE KNOCKS BACK.'],
  pylon: ['BZZZT. YOUR HAIR STANDS UP. YOUR HAIR HAS NOT STOOD UP SINCE 1999.'],
  gnome: ['YOU PAT THE GNOME. HE IS NOT GERALD. HE IS JEALOUS OF GERALD.'],
  flamingo: ['YOU STRAIGHTEN THE FLAMINGO. SOMEWHERE, BRENDA FEELS A DISTURBANCE OF ORDER.'],
  hydrant: ['YOU KICK THE HYDRANT. YOUR TOE LOSES.'],
  landed_ufo: ['YOU KNOCK ON THE SAUCER. A VOICE: NOBODY HOME. GO AWAY. WE ARE ON BREAK.'],
  drive_in: ['ON THE BIG SCREEN: YOU. LIVE. YOU WAVE. A TRILLION PEOPLE WAVE BACK. NOBODY WAVES BACK.'],
};

export const InteractMixin = {
  initInteract() {
    this.interact = null;
    this.search = null;
    this.bombs = [];
    this.rescued = 0;
    this.searchedN = 0;
    this.mission = null;
    this.lastMission = null;
    this.tMission = 12;
    this.missionsDone = 0;
    this.evacHint = false;
  },

  findInteract() {
    const p = this.player, w = this.world;
    let best = null, bd = 1e9;
    const consider = (kind, o, d) => {
      if (d < bd) (bd = d), (best = { kind, o });
    };
    if (this.mode === 'story') {
      for (const d of w.doors) {
        const dd = Math.sqrt(dist2(d.x, d.y, p.x, p.y));
        if (dd < 95) consider('enter', d, dd - 80);
      }
      const cp = w.checkpoint;
      if (cp && !this.f('gateOpen')) {
        const dd = Math.sqrt(dist2(cp.x, cp.y, p.x, p.y)) - 60;
        if (dd < 70) consider('guard', cp, dd - 20);
      }
    }
    for (const n of this.npcs || []) {
      if (n.state === 'knocked') continue;
      const dd = Math.sqrt(dist2(n.x, n.y, p.x, p.y));
      if (dd < 60) consider('chat', n, dd - 30);
    }
    for (const c of this.cars) {
      if (c.wreck || c.lift > 0.1) continue;
      const d = Math.sqrt(dist2(c.x, c.y, p.x, p.y)) - c.r;
      if (d > 40) continue;
      if (!c.driver) consider('drive', c, d - 30);
      else if (c.driver === 'ai' && Math.abs(c.speed) < 70) consider('carjack', c, d - 30);
    }
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
    const dog = this.dog;
    if (dog && dog.petCd <= 0) {
      const d = Math.sqrt(dist2(dog.x, dog.y, p.x, p.y));
      if (d < 55) consider('pet', dog, d - 15);
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
          if (q.search && !q.searched && d < 40) consider('search', q, d + 4);
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
    if (p.dead) this.interact = null;
    else if (p.car) this.interact = { kind: Math.abs(p.car.speed) > 170 ? 'bail' : 'exit', o: p.car };
    else this.interact = this.search ? null : this.findInteract();
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
      case 'bail':
        this.exitCar();
        break;
      case 'drive':
      case 'carjack':
        this.enterCar(o);
        break;
      case 'talk':
        o.follow = true;
        o.life = 999;
        this.float(pick(o.type === 'civ_tinfoil' ? L.TINFOIL_TALK : L.TALK), o.x, o.y, 12, 2.2);
        this.sound.play('pickup');
        if (!this.evacHint) {
          this.evacHint = true;
          this.say('BRING SURVIVORS TO THE EVAC BUS AT THE SANDBAG FORT. CARS ARE FASTER. FOLLOW THE GREEN ARROW.', true);
        }
        break;
      case 'pet':
        if (o === this.dog) {
          p.hp = Math.min(p.maxHp, p.hp + 6);
          o.petCd = 15;
          o.bark = 0.4;
          this.sound.play('bark');
          this.float(pick(L.PET_DOG), o.x, o.y, 13, 1.8);
        } else {
          p.hp = Math.min(p.maxHp, p.hp + 10);
          o.petCd = 25;
          this.sound.play('moo');
          this.float(pick(L.PET), o.x, o.y, 13, 1.8);
        }
        for (let i = 0; i < 6; i++) this.addFx('heart', o.x + rand(-16, 16), o.y + rand(-16, 16), 30, 0, 0, rand(40, 90), rand(0.8, 1.3));
        this.missionEvent('pet');
        break;
      case 'search':
        this.search = { prop: o, t: 0, dur: SEARCH_TIME[o.search] || 1, noise: 0 };
        break;
      case 'rig':
        this.rigGas(o);
        break;
      case 'enter':
        this.enterScene(o.scene, o);
        break;
      case 'guard':
        this.talk('guard');
        break;
      case 'chat': {
        const mood = this.npcMood(o);
        this.float(pick(BARKS[o.fac][mood]), o.x, o.y, 12, 2);
        o.barkT = 6;
        if (o.state !== 'event') (o.tx = o.x), (o.ty = o.y), (o.t = 2);
        this.sound.play('click');
        break;
      }
    }
  },

  // Look at / poke a prop (tap): Dale comments, the prop reacts.
  pokeProp(q, near) {
    q.poke = 1;
    const use = PROP_USE[q.type];
    if (near && use) {
      q.useN = (q.useN || 0) + 1;
      this.line(use[(q.useN - 1) % use.length]);
      if (q.type === 'icecream') this.sound.play('jukebox');
      else if (q.type === 'phone_booth') this.sound.play('beep');
      else if (q.type === 'speaker_pole') this.sound.play('radio');
      else if (q.type === 'pylon') (this.sound.play('zap'), this.hurtPlayer(2, q.x, q.y, 8));
      else this.sound.play('thud');
      return;
    }
    const looks = LOOK[q.type];
    if (looks) {
      q.lookN = (q.lookN || 0) + 1;
      this.line(looks[(q.lookN - 1) % looks.length]);
    } else this.line('IT IS A ' + q.type.replace(/_/g, ' ').toUpperCase() + '. IT HAS NO STRONG OPINIONS ABOUT YOU.');
    this.sound.play('click');
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
    if (this.mode === 'story') {
      // story items hidden in specific places
      if (q.keyItem && !this.f('found_' + q.keyItem)) {
        this.set('found_' + q.keyItem);
        for (const id of q.keyItem.split(',')) this.give(id);
        const msg = { toolbox: 'UNDER THE COUNTER: A TOOLBOX WITH DUCT TAPE. THE LOOTERS TOOK THE MONEY AND LEFT THE ONLY USEFUL THING.', cowbell: 'IN THE TRAILER: A DUSTY COWBELL ON A HOOK. THE RANCHER LEFT A NOTE: MORE COWBELL. HE MEANT IT.', 'fuse,slime': 'YOU CLIMB INTO THE WRECK. A JAR OF GLOWING GOO AND A HUMMING POWER CELL. THE SAUCER WAS A FIXER-UPPER.', cables: 'ROOM 6: JUMPER CABLES, A BIBLE AND A FAKE MUSTACHE. SOMEBODY HAD PLANS.' }[q.keyItem];
        if (msg) this.line(msg);
      }
      if (kind !== 'bin' || r < 0.3) {
        const c = { house: [1, 4], store: [3, 6], potty: [2, 5], junk: [1, 3], motel: [2, 5], trailer: [1, 4], car: [0, 2], bin: [1, 2], ufo: [4, 8] }[kind] || [0, 2];
        const n = randInt(c[0], c[1]);
        if (n) this.earn(n);
      }
      if (kind === 'potty') this.float('YOU WILL NEVER BE CLEAN AGAIN.', p.x, p.y, 12, 2);
      if (q.keyItem && kind === 'ufo') {
        this.missionEvent('search');
        return;
      }
    }
    if (kind === 'bin') {
      if (r < 0.4) drops = [weighted([['fuel', 2], ['medkit', 1]])];
      else if (r < 0.65) p.hp = Math.min(p.maxHp, p.hp + 5);
    } else if (kind === 'store') drops = ['medkit', weighted([['fuel', 3], ['repair', 2], ['nitro', 1]])];
    else if (kind === 'trailer') drops = [weighted([['nitro', 3], ['repair', 2]]), 'fuel'];
    else if (kind === 'car') {
      if (r < 0.85) drops = [weighted([['fuel', 5], ['repair', 3], ['nitro', 1]])];
    } else if (r < 0.9) {
      drops = [weighted([['fuel', 4], ['medkit', 3], ['repair', 2], ['nitro', 1]])];
      if (Math.random() < 0.45) drops.push(weighted([['fuel', 3], ['medkit', 1]]));
    }
    const text = drops.length || (kind === 'bin' && r < 0.65) ? pick(L.FIND[kind]) : pick(L.FIND.empty);
    this.float(text, p.x, p.y, 12, 2.6);
    for (const type of drops) this.pickups.push({ type, x: p.x + rand(-34, 34), y: p.y + rand(-34, 34), t: 0, life: 30, drop: true, pop: 1 });
    this.sound.play(drops.length ? 'pickup' : 'empty');
    if (kind === 'house' && Math.random() < 0.12 + this.darkness * 0.1) {
      this.spawnEnemy('crawler', p.x + rand(-40, 40), p.y + rand(-40, 40), 3);
      this.float('IT WAS NOT EMPTY.', p.x, p.y, 13, 1.6);
    }
    this.missionEvent('search');
  },

  // --- survivors on foot ---------------------------------------------------------------------------
  rescueCiv(c, zone) {
    c.taken = 'rescued';
    this.rescued++;
    let e = this.world.evac;
    if (zone && zone.kind === 'church') {
      e = { x: zone.x, y: zone.y };
      c.dest = { x: zone.x - 80, y: zone.y - 120 };
      this.converted(1);
    }
    this.float('RESCUED!', c.x, c.y, 15, 1.6);
    this.say(pick(L.RESCUE), true);
    this.sound.play('rescue');
    this.rate(3);
    if (this.mode === 'story') this.earn(2);
    const type = pick(['fuel', 'repair', 'nitro', 'medkit']);
    this.pickups.push({ type, x: e.x + rand(-50, 50), y: e.y + rand(-50, 50), t: 0, life: 40, drop: true, pop: 1 });
    this.missionEvent('taxi', 1);
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
      if (b.t <= 0 && !b.done && b.gate) {
        b.done = true;
        this.gateBoom(b);
        continue;
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
        this.addDamage(b.x, b.y, 250000, 'GAS STATION');
        this.missionEvent('gas');
      }
    }
    this.bombs = this.bombs.filter((b) => !b.done);
  },

  // --- dispatcher missions -------------------------------------------------------------------------
  startMission() {
    const p = this.player, w = this.world;
    const opts = [['taxi', 4], ['roadkill', 2.5], ['demolition', 2.5], ['search', 1.5], ['carjack', 1.5]];
    if (this.nests.length) opts.push(['nest', 3]);
    if (this.cows.some((c) => c.state !== 'abducted')) opts.push(['pet', 1]);
    if (this.time > 100 && w.props.some((q) => q.riggable && !q.rigged)) opts.push(['gas', 1.4]);
    if (!this.cars.some((c) => c.driver === 'ai')) opts.splice(opts.findIndex((o) => o[0] === 'carjack'), 1);
    const pool = opts.filter((o) => o[0] !== this.lastMission);
    const type = weighted(pool.length ? pool : opts);
    const need = { taxi: 3, roadkill: 8, demolition: 20000, search: 3 }[type] || 1;
    const m = { type, t: 0, limit: type === 'demolition' || type === 'taxi' ? 150 : 120, count: 0, need };
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
    this.say(this.dispatch(L.MISSIONS[m.type].line), true);
    this.sound.play('radio');
  },

  // in the story the radio missions are Zorp's shot list
  dispatch(text) {
    return this.mode === 'story' ? text.replace('DISPATCH:', 'ZORP (RADIO):').replace('WE ', 'THE NETWORK ') : text;
  },

  missionEvent(kind, amount = 1) {
    const m = this.mission;
    if (!m || m.type !== kind) return;
    m.count += amount;
    if (m.count >= m.need) this.completeMission();
  },

  completeMission() {
    const p = this.player;
    this.missionsDone++;
    this.showBanner(this.mode === 'story' ? 'GREAT SHOT!' : 'MISSION COMPLETE', L.MISSIONS[this.mission.type].text);
    this.say(this.dispatch(pick(L.MISSION_DONE)), true);
    this.sound.play('mission');
    this.rate(8);
    this.flashDrones();
    if (this.mode === 'story') {
      this.earn(4);
      if (this.q('shotlist') === 1) {
        this.set('shots', (this.f('shots') || 0) + 1);
        this.toast(Math.min(3, this.f('shots')) + '/3 SHOTS' + (this.f('shots') >= 3 ? ' - TELL ZORP' : ''), 'icon_camera', this.f('shots') >= 3 ? '#7dff9a' : undefined);
      }
    }
    for (let i = 0; i < 3; i++) {
      const type = weighted([['fuel', 3], ['repair', 3], ['medkit', 2], ['nitro', 2.5]]);
      this.pickups.push({ type, x: p.x + rand(-60, 60), y: p.y + rand(-60, 60), t: 0, life: 35, drop: true, pop: 1 });
    }
    p.nitro = Math.min(6, p.nitro + 1);
    this.mission = null;
    this.tMission = 12;
  },

  failMission(why) {
    this.say(this.dispatch(why || pick(L.MISSION_FAIL)), true);
    this.mission = null;
    this.tMission = 10;
  },

  updateMission(dt) {
    const m = this.mission;
    if (!m) {
      if (this.mode === 'story' && !this.q('shotlist')) return;
      this.tMission -= dt;
      if (this.tMission <= 0) {
        this.tMission = 5;
        this.startMission();
      }
      return;
    }
    m.t += dt;
    if (m.type === 'nest' && !this.nests.includes(m.nest)) return this.completeMission();
    if (m.type === 'cow' && m.ufo && m.ufo.gone && !m.ufo.spooked) return this.failMission('DISPATCH: THE COW IS GONE. SHE GETS HER OWN SHOW NOW. YOU GET NOTHING.');
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
      case 'taxi':
        if ((p.car && p.car.seats.length) || this.civs.some((c) => c.follow && !c.taken)) return w.evac;
        return nearest(this.civs.filter((c) => !c.taken));
      case 'search':
        return nearest(w.props.filter((q) => q.search && q.search !== 'bin' && !q.searched));
      case 'nest':
        return m.nest;
      case 'roadkill':
        return p.car ? null : nearest(this.cars.filter((c) => !c.driver && !c.wreck));
      case 'demolition':
        return p.car ? null : nearest(this.cars.filter((c) => !c.driver && !c.wreck));
      case 'carjack':
        return nearest(this.cars.filter((c) => c.driver === 'ai'));
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
