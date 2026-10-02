// The adventure layer: flags, inventory, coupons, faction reputation, quests, dialogue, interior
// scenes, the studio gate, the finale and saving. Mixed into Game.
import { TILE, rand, pick, clamp, dist2 } from './util.js';
import { FACTIONS, FACTION_IDS, CHARS, ITEMS, QUESTS, DIALOG, SCENES, ENDINGS, BARKS, LOOK_ENEMY, mainObjective, hint } from './story.js';
import { store } from './audio.js';

const SAVE_KEY = 'skyfall.save';
const ENDINGS_KEY = 'skyfall.endings';

const FAIL_USE = [
  "THAT'S NOT HOW ANY OF THIS WORKS.",
  "YOU WAVE THE {I} AT IT. NOTHING HAPPENS. YOU FEEL SILLY. YOU ARE SILLY.",
  "THE {I} AND THE {T} DO NOT GET ALONG.",
  "I'D RATHER NOT. AND I'M DALE. I DO EVERYTHING.",
  'NO. JUST... NO.',
];

// What happens when Dale hands people things.
const GIFTS = {
  zorp: {
    coffee: (g) => (g.q('coffee') === 1 ? g.talk('zorp', 'coffee') : g.line("ZORP: MORE COFFEE? NO. MY HEARTS. ALL THREE OF THEM ARE POUNDING.")),
    pie: (g) => g.zorpPie(),
    donut: (g) => (g.take('donut'), g.rep('network', 5), g.line("ZORP: A DONUT! I HAVE... NEVER SEEN ONE OF THESE BEFORE. DEFINITELY NOT ON CAMERA.")),
    photo: (g) => g.talk('zorp', 'photo'),
    beans: (g) => g.line('ZORP: WHAT IS IT? ...BEANS? WHAT DO THEY DO? ...OH. OH NO. NO THANK YOU.'),
  },
  brenda: {
    gnome: (g) => (g.q('gerald') === 1 ? g.talk('brenda', 'geraldback') : g.line('BRENDA: GERALD!')),
    pie: (g) => (g.take('pie'), g.rep('hoa', 6), g.line("BRENDA: A PIE FROM MEL'S. ACCEPTABLE. I'LL ALLOW IT. THIS ONCE.")),
    finebook: (g) => g.line('BRENDA: THAT IS MY BOOK. YOU ARE HOLDING IT WRONG. YOU ARE STANDING WRONG. GO FINE SOMEBODY.'),
    trophy: (g) => g.line("DALE: (BETTER NOT. SHE'D CALL THE ALIENS. AND THEN FINE THEM FOR BEING LATE.)"),
    tape_hoa: (g) => g.line("BRENDA: KEEP IT SAFE. IT'S THE ONLY COPY. THE OTHER 40 COPIES DON'T COUNT."),
  },
  barb: {
    trophy: (g) => g.talk('barb', 'trophy'),
    beans: (g) => (g.take('beans'), g.rep('rats', 6), g.line('BARB: BEANS! THE FUEL OF THE REVOLUTION. AND OF SMALL ENCLOSED SPACES.')),
    gnome: (g) => g.line("BARB: KEEP HIM. HE'S YOUR PROBLEM NOW."),
    finebook: (g) => (g.rep('rats', -8), g.line('BARB: DID YOU JUST TRY TO FINE ME? IN MY OWN BAR? YOU HAVE GUTS. I COULD SEE THEM. IF YOU KEEP THIS UP.')),
  },
  gloria: {
    tinfoil: (g) => g.talk('gloria', 'foil'),
    cowbell: (g) => g.line('GLORIA: RING IT NEAR A COW, CHILD. THE COW WILL FOLLOW. THE COW ALWAYS FOLLOWS. UNLIKE MY HUSBAND.'),
    remote: (g) => g.line("GLORIA: KEEP IT, CHILD. YOU'LL KNOW WHEN TO PRESS THE BUTTON. IT'S THE BIG ONE. ALL OF THEM ARE THE BIG ONE."),
    pie: (g) => (g.take('pie'), g.rep('church', 6), g.line('GLORIA: AN OFFERING! WE SHALL PLACE IT ON THE ALTAR. AND THEN EAT IT. THE SAUCERS DO NOT EAT PIE. WE CHECKED.')),
  },
  kevin: {
    slime: (g) => g.talk('kevin', 'slime'),
    beans: (g) => g.line("KEVIN: MY END TIMES BEANS! ...NO, KEEP THEM. I HAVE 300 MORE."),
    tape_kevin: (g) => g.line('KEVIN: NO, YOU KEEP IT. I HAVE THE MASTER. THE MASTER IS IN A SAFE. THE SAFE IS IN ANOTHER SAFE.'),
    tinfoil: (g) => g.line("KEVIN: NOT LIKE THAT, DALE. SHINY SIDE OUT. ALWAYS SHINY SIDE OUT."),
  },
  sheriff: {
    keys: (g) => (g.take('keys'), g.sfx('door'), g.talk('sheriff', 'freed')),
    donut: (g) => g.line("SHERIFF: MY DONUT! ...KEEP IT. I'VE HAD THAT ONE FOR THREE DAYS. WE'VE BEEN THROUGH ENOUGH."),
  },
  mel: {
    coffee: (g) => g.line("MEL: YOU'RE GIVING ME MY OWN COFFEE. THAT'S NOT A GIFT. THAT'S A RETURN."),
    toolbox: (g) => g.line('MEL: USE IT ON THE MACHINE, GENIUS. NOT ON ME. I AM HELD TOGETHER BY OTHER THINGS.'),
  },
};

const HEADLINES = [
  'PINE BLUFF GAZETTE: LOCAL MAN STILL DIVORCED. ALSO, ALIENS.',
  'GAZETTE: COWS GET SPIN-OFF. HUMANS GET PROBED. EXPERTS: FAIR.',
  'GAZETTE: HOA APPROVES ALIEN INVASION, WITH CONDITIONS. CONDITIONS: BEIGE.',
  'GAZETTE: ICE CREAM TRUCK STILL PLAYING. DRIVER STILL MISSING. NOBODY BRAVE ENOUGH TO CHECK.',
  'GAZETTE: CHURCH ATTENDANCE UP 900 PERCENT. SAUCERS DECLINE TO COMMENT.',
  'GAZETTE: OPINION - MAYBE WE DID NEED MORE COOKING SHOWS.',
];

const HOA_RULES = [
  'RULE 7: NO ABDUCTIONS AFTER 9 PM. NO ABDUCTIONS BEFORE 9 PM EITHER.',
  'RULE 88: FLAMINGOS MUST FACE NORTH. NORTH IS WHERE BRENDA IS.',
  'RULE 412: SAUCERS MAY NOT PARK ON LAWNS. SAUCERS MAY NOT PARK.',
  'RULE 1,019: SCREAMING IS PERMITTED AT INDOOR VOLUME ONLY.',
  'RULE 2,003: TRACTOR BEAMS MUST BE BEIGE.',
  'RULE 3,111: NO DESERT RATS. NO REGULAR RATS. NO MICE THAT LOOK LIKE RATS.',
  'RULE 4,112: RESIDENTS WHO ARE VAPORIZED MUST STILL MOW.',
  'RULE 5,000: ALL RULES ARE FINAL. EXCEPT NEW RULES, WHICH ARE MORE FINAL.',
  'A PINK TICKET: DALE, NUMBER 12. LAWN HEIGHT: 4 INCHES. CRIME LEVEL: SEVERE.',
];

const CONFESSIONS = [
  ['I ONCE RETURNED A SHOPPING CART... HALFWAY.', 'GLORIA (BEHIND THE SCREEN): THE SAUCERS FORGIVE YOU. THEY TAKE CARTS TOO.'],
  ['I THINK THE ALIENS HAVE A POINT ABOUT THE COOKING SHOWS.', 'GLORIA: ...THE SAUCERS FORGIVE YOU. I AM STILL THINKING ABOUT IT.'],
  ['I HAVE NEVER BEEN TO SPACE AND I DO NOT WANT TO GO.', 'GLORIA: GASP. ...THE SAUCERS FORGIVE YOU. THEY ARE VERY PATIENT. UNLIKE ME.'],
  ['I PET A COW WITHOUT ASKING.', 'GLORIA: COWS ARE SACRED. BUT ALSO VERY PETTABLE. YOU ARE FORGIVEN.'],
];

const RADIO = [
  'RADIO: THIS IS THE NETWORK. REMINDER: THE FINALE AIRS SOON. PLEASE SCREAM IN YOUR KEY LIGHT.',
  'RADIO: TRAFFIC: A SAUCER IS DOUBLE PARKED ON MAIN STREET. THE HOA HAS BEEN NOTIFIED. GOD HELP THE SAUCER.',
  'RADIO: WEATHER: CLEAR SKIES WITH A CHANCE OF METEORS. AND COWS. GOING UP.',
  'RADIO: THE DESERT RATS HAVE CLAIMED THE WEST HIGHWAY. THE HOA HAS CLAIMED THE DESERT RATS. NOBODY CLAIMED THE ALIENS.',
  'RADIO: PUBLIC NOTICE: CURFEW AT DUSK. WARDENS WILL ESCORT YOU HOME. OR TO A SAUCER. WHICHEVER IS CLOSER.',
  'RADIO: CALLER ON LINE TWO SAYS SHE SAW A GNOME WEARING A HELMET IN THE JUNKYARD. WE HAVE QUESTIONS.',
];
const POLICE = [
  'POLICE RADIO: ALL UNITS, ALL UNITS. ...HELLO? ANY UNITS? ...OKAY.',
  'POLICE RADIO: 10-4, A COW IS DIRECTING TRAFFIC ON THIRD STREET. SHE IS DOING A BETTER JOB THAN US.',
  'POLICE RADIO: REPORTS OF A MAN IN A STOLEN COP CAR CAUSING MASSIVE PROPERTY DAMAGE. ...OH. THAT IS YOU.',
  'POLICE RADIO: DISPATCH TO SHERIFF. SHERIFF? SHERIFF, ARE YOU STILL IN THE CELL? BLINK TWICE.',
];

const SNACKS = [
  ['YOU EAT A GLOWING JELLY CUBE. IT TASTES LIKE THE COLOR PURPLE. +10 HP. YOUR TEETH GLOW NOW.', 10],
  ['YOU EAT A SPIKY GREEN THING. IT EATS YOU BACK A LITTLE. -5 HP. WORTH IT.', -5],
  ['ALIEN CHIPS. THEY ARE JUST CHIPS. THE BAG IS 90 PERCENT GAS. SOME THINGS ARE UNIVERSAL.', 5],
];

const SONGS = {
  diner: ['NOW PLAYING: FLY ME TO THE MOON (THEY ACTUALLY DID).', 'NOW PLAYING: EARTH ANGEL (CANCELLED REMIX).', 'NOW PLAYING: SPACE ODDITY. TOO SOON, JUKEBOX.', 'NOW PLAYING: HOUND DOG. THE DOG OUTSIDE APPROVES.'],
  saloon: ['NOW PLAYING: SKULL GOAT - PROBE THIS. THE RATS LOSE THEIR MINDS.', 'NOW PLAYING: SKULL GOAT - HOA (HELL ON ARRIVAL). EVERYONE HEADBANGS.', 'NOW PLAYING: SKULL GOAT - MY BIKE IS MY WIFE. BARB SINGS ALONG. BADLY. LOUDLY.'],
};

export const AdventureMixin = {
  initAdventure() {
    this.flags = {};
    this.inv = [];
    this.reps = { hoa: 0, church: 0, rats: 0, network: 0 };
    this.coupons = 5;
    this.ratings = 50;
    this.rt = 0; // real time, keeps ticking in interiors and dialogue
    this.dialog = null;
    this.scene = null;
    this.toasts = [];
    this.held = null;
    this.caption = null;
    this.endingId = null;
    this.keypadOn = false;
    this.spin = 0;
    this.act = 0;
    this.saveT = 10;
    this.hintT = 0;
  },

  // --- tiny API used by story.js -------------------------------------------------------------------
  f(k) {
    return this.flags[k];
  },
  set(k, v = true) {
    this.flags[k] = v;
  },
  has(id) {
    return this.inv.includes(id);
  },
  give(id, quiet = false) {
    if (!ITEMS[id]) return;
    if (!this.has(id)) this.inv.push(id);
    if (!quiet) {
      this.toast('GOT: ' + ITEMS[id].name, ITEMS[id].icon);
      this.sound.play('power');
    }
    this.save();
  },
  take(id) {
    const i = this.inv.indexOf(id);
    if (i >= 0) this.inv.splice(i, 1);
    if (this.held === id) this.held = null;
  },
  repOf(f) {
    return this.reps[f] || 0;
  },
  rep(f, n, quiet = false) {
    if (!FACTIONS[f] || !n) return;
    this.reps[f] = clamp(this.reps[f] + n, -100, 100);
    // helping one gang annoys its rival
    const riv = FACTIONS[f].rival;
    if (n > 0 && riv) this.reps[riv] = clamp(this.reps[riv] - Math.round(n * 0.4), -100, 100);
    if (!quiet) this.toast(FACTIONS[f].name + (n > 0 ? ' +' : ' ') + n, FACTIONS[f].emblem, n > 0 ? '#7dff9a' : '#ff6b5e');
  },
  earn(n) {
    this.coupons += n;
    this.toast('+' + n + ' COUPONS', 'icon_coupon');
    this.sound.play('cash');
  },
  spend(n) {
    if (this.coupons < n) return false;
    this.coupons -= n;
    this.toast('-' + n + ' COUPONS', 'icon_coupon', '#ff6b5e');
    this.sound.play('cash');
    return true;
  },
  q(id) {
    return this.flags['q_' + id] || 0;
  },
  qset(id, s) {
    const prev = this.q(id);
    if (prev === s) return;
    this.flags['q_' + id] = s;
    const Q = QUESTS[id];
    if (!Q) return;
    if (s === 1) {
      this.toast('NEW TASK: ' + Q.title, 'btn_journal');
      this.sound.play('mission');
    } else if (s === 2) {
      this.toast('DONE: ' + Q.title, 'btn_journal', '#7dff9a');
      this.sound.play('mission');
      this.rate(6);
    }
    this.save();
  },
  sfx(name) {
    this.sound.play(name);
  },
  rate(n) {
    const k = n > 0 ? this.droneBonus() : 1;
    this.ratings = clamp(this.ratings + n * k, 0, 100);
    if (n > 0) this.rateFlash = Math.min(1, (this.rateFlash || 0) + 0.5);
  },
  toast(text, icon, color) {
    this.toasts.push({ text, icon, color: color || '#f3e6c8', t: 0 });
    if (this.toasts.length > 4) this.toasts.shift();
  },
  // a line of text: in a scene it goes to the scene caption, outside it is a caption over the controls
  line(text, who = 'dale') {
    this.caption = { text, who, t: 0, dur: 2.2 + text.length * 0.05 };
    return true;
  },

  // --- story progression ------------------------------------------------------------------------------
  startStory() {
    this.set('metKevin');
    this.act = Math.max(this.act, 1);
    this.showBanner('THE FINALE', 'GET ONTO THE LOT. GET THE KEYCARD. BROADCAST A TAPE.');
    this.say("KEVIN (WALKIE): I'M ON CHANNEL 9. TAP THE NOTEBOOK FOR YOUR TASKS AND TO CALL ME. OVER. ...OVER MEANS YOU SAY OVER. OVER.", true);
    this.save();
  },
  objective() {
    return mainObjective(this);
  },
  hintText() {
    return hint(this);
  },
  callKevin() {
    this.sound.play('radio');
    this.say(hint(this), true);
    this.hintT = 6;
  },
  zorpWhere() {
    return this.f('gateOpen') ? 'office' : 'diner';
  },
  landmarkPos(id) {
    if (!id) return null;
    if (id === 'diner' || id === 'office' || id === 'bunker' || id === 'gate' || id === 'tower' || id === 'crash') {
      const l = this.world.landmarks.find((q) => q.id === id);
      if (l) return l;
    }
    return this.world.landmarks.find((q) => q.id === id) || null;
  },

  // --- dialogue --------------------------------------------------------------------------------------
  talk(charId, node) {
    const tree = DIALOG[charId];
    if (!tree) return;
    this.held = null;
    this.dialog = { char: charId, node: null, n: null, lines: [], i: 0, t: 0, choices: null };
    this.sound.play('click');
    this.dlgEnter(node || tree.start(this));
  },
  dlgEnter(nodeId) {
    const d = this.dialog;
    if (!d) return;
    const tree = DIALOG[d.char];
    const n = nodeId && tree[nodeId];
    if (!n) return this.dlgEnd();
    d.node = nodeId;
    d.n = n;
    let say = typeof n.say === 'function' ? n.say(this) : n.say;
    if (typeof say === 'string') say = [say];
    d.lines = say || [];
    d.i = 0;
    d.t = 0;
    d.who = n.who || d.char;
    d.choices = null;
    if (n.do) n.do(this);
    if (this.dialog !== d) return;
    if (!d.lines.length) this.dlgAfterLines();
  },
  dlgTap() {
    const d = this.dialog;
    if (!d || d.choices) return;
    const ln = d.lines[d.i] || '';
    if (d.t * 50 < ln.length) {
      d.t = 999;
      return;
    }
    if (d.i < d.lines.length - 1) {
      d.i++;
      d.t = 0;
      this.sound.play('click');
      return;
    }
    this.dlgAfterLines();
  },
  dlgAfterLines() {
    const d = this.dialog;
    const n = d.n;
    if (n.choices) {
      d.choices = n.choices.filter((c) => (!c.if || c.if(this)) && (!c.once || !this.f(c.once)));
      if (!d.choices.length) this.dlgEnd();
      return;
    }
    if (n.next) return this.dlgEnter(n.next);
    this.dlgEnd();
  },
  dlgChoose(i) {
    const d = this.dialog;
    if (!d || !d.choices) return;
    const c = d.choices[i];
    if (!c) return;
    this.sound.play('click');
    if (c.once) this.set(c.once);
    if (c.do) c.do(this);
    if (this.dialog !== d) return;
    if (c.go) this.dlgEnter(c.go);
    else this.dlgEnd();
  },
  dlgEnd() {
    this.dialog = null;
    this.save();
  },

  // --- interiors -------------------------------------------------------------------------------------
  enterScene(id, door) {
    const def = SCENES[id];
    if (!def) return;
    if (id === 'control' && !this.has('keycard')) {
      this.line("THE TOWER DOOR HAS A KEYCARD SLOT. YOU DON'T HAVE A KEYCARD. YOU HAVE A DONUT, MAYBE. NOT THE SAME.");
      return;
    }
    this.scene = { id, def, t: 0, door, pokes: {} };
    this.held = null;
    this.search = null;
    this.sound.engine(false);
    this.sound.siren(false);
    this.sound.play('door');
    this.caption = { text: def.name, who: 'place', t: 0, dur: 2 };
    if (def.enter) def.enter(this);
    this.save();
  },
  exitScene() {
    const s = this.scene;
    if (!s) return;
    if (this.keypadOn) this.keypadOn = false;
    this.scene = null;
    this.dialog = null;
    this.held = null;
    this.sound.play('door');
    const p = this.player;
    if (s.door) {
      p.x = s.door.x + 20;
      p.y = s.door.y + 20;
      this.world.collide(p);
    }
    p.walk = null;
    if (s.id === 'control' && !this.f('power') && !this.f('hunted')) this.startHunt();
    this.save();
  },
  // tap on a hotspot / overlay item / character inside a scene
  sceneHot(h) {
    const s = this.scene;
    if (!s) return;
    s.pokes[h.id] = 1;
    if (this.held) {
      const fn = h.use && h.use[this.held];
      const it = this.held;
      this.held = null;
      if (fn) return fn(this, h);
      return this.failUse(it, h.name);
    }
    if (h.tap) h.tap(this, h);
  },
  sceneItem(it) {
    if (this.held) {
      const held = this.held;
      this.held = null;
      return this.failUse(held, ITEMS[it.id] ? ITEMS[it.id].name : 'THING');
    }
    it.take(this);
  },
  sceneChar(c) {
    const s = this.scene;
    if (s) s.pokes['char_' + c.id] = 1;
    if (this.held) {
      const it = this.held;
      this.held = null;
      return this.giveTo(c.id, it);
    }
    this.talk(c.id);
  },
  giveTo(charId, itemId) {
    const fn = GIFTS[charId] && GIFTS[charId][itemId];
    if (fn) return fn(this);
    const who = CHARS[charId] ? CHARS[charId].name : 'THEY';
    this.line(who + pick([" DOESN'T WANT THE ", ' LOOKS AT THE ', ' POLITELY DECLINES THE ']) + ITEMS[itemId].name + pick(['.', '. AWKWARD.', '. THEN AT YOU. THEN AWAY.']));
  },
  failUse(itemId, targetName) {
    const name = ITEMS[itemId] ? ITEMS[itemId].name : 'THING';
    this.line(pick(FAIL_USE).replace('{I}', name).replace('{T}', targetName || 'THING'));
  },

  // --- scene gimmicks (called from story.js) --------------------------------------------------------------
  brendaLeaves() {
    this.set('brendaAwayUntil', this.rt + 16);
    this.dialog = null;
    this.sound.play('door');
    this.line('BRENDA STORMS OUT TO DEFEND HER LAWN. THE ROOM IS SUDDENLY VERY QUIET. AND VERY UNSUPERVISED.');
  },
  brendaAway() {
    return (this.f('brendaAwayUntil') || 0) > this.rt;
  },
  moshing() {
    return (this.f('moshUntil') || 0) > this.rt;
  },
  jukebox(where) {
    this.sound.play('jukebox');
    const songs = SONGS[where] || SONGS.diner;
    const k = (this.f('song_' + where) || 0) % songs.length;
    this.set('song_' + where, k + 1);
    if (where === 'saloon') {
      this.set('moshUntil', this.rt + 14);
      this.sound.play('mosh');
      this.rate(2);
      return this.line(songs[k] + ' NOBODY IS WATCHING THE SHELF.');
    }
    this.line(songs[k]);
  },
  darts() {
    this.sound.play('thud');
    const r = Math.random();
    if (r < 0.2) {
      this.earn(1);
      return this.line('BULLSEYE! ...ON THE FIRST TRY. NOBODY SAW. YOU WIN ONE COUPON FROM YOURSELF.');
    }
    this.line(pick(['YOU THROW A DART. IT HITS THE WALL. THE WALL HAS SEEN WORSE.', 'TRIPLE TWENTY! ...ON THE NEXT BOARD OVER. THERE IS NO NEXT BOARD.', 'THE DART BOUNCES OFF AND LANDS IN YOUR SHOE. SKILL.', 'YOU HIT THE ALIEN PHOTO RIGHT BETWEEN THE EYES. ALL FOUR OF THEM.']));
  },
  radioChatter(police) {
    return pick(police ? POLICE : RADIO);
  },
  headline() {
    return pick(HEADLINES);
  },
  hoaRule() {
    return pick(HOA_RULES);
  },
  confess() {
    const n = this.f('confessed') || 0;
    const c = CONFESSIONS[n % CONFESSIONS.length];
    this.set('confessed', n + 1);
    if (n < 3) this.rep('church', 4);
    this.line('DALE: ' + c[0] + ' ' + c[1]);
  },
  collectionPlate() {
    if (this.f('plateT') && this.f('plateT') > this.rt) return this.line('THE PLATE IS EMPTY. YOU ALREADY TOOK IT. THE CONGREGATION REMEMBERS. THEY HUM ABOUT IT.');
    this.set('plateT', this.rt + 120);
    this.earn(4);
    this.rep('church', -12);
    this.line('YOU TAKE 4 COUPONS FROM THE COLLECTION PLATE. SOMEWHERE A CAMERA DRONE ZOOMS IN. GLORIA GASPS. THE LORD HAS RECEIPTS.');
  },
  lostAndFound() {
    if (!this.f('foundMegaphone')) {
      this.set('foundMegaphone');
      this.give('megaphone');
      return this.line('LOST AND FOUND: A MEGAPHONE. A NOTE: CONFISCATED FROM RESIDENT, FOR ENTHUSIASM.');
    }
    this.line(pick(['LOST AND FOUND: ONE SANDAL. A RETAINER. A DIVORCE. NOT YOURS.', 'LOST AND FOUND: A TINFOIL HAT, SIZE CHILD. A HAMSTER (ALIVE?). YOU CLOSE THE BOX.', 'LOST AND FOUND: A WEDDING RING. ENGRAVED: GARY. GARY IS IN SPACE.']));
  },
  alienSnack() {
    const s = pick(SNACKS);
    this.player.hp = clamp(this.player.hp + s[1], 1, this.player.maxHp);
    this.line(s[0]);
  },
  wantedPoster() {
    return 'WANTED: DALE. FOR ' + Math.round(this.damage).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + " IN PROPERTY DAMAGE. REWARD: 5 COUPONS. THE SHERIFF DREW YOU WITH MORE HAIR. IT'S A KINDNESS.";
  },
  keypad() {
    this.keypadOn = true;
    this.keypadCode = '';
  },
  keypadPress(k) {
    if (!this.keypadOn) return;
    this.sound.play('beep');
    if (k === 'C') return (this.keypadCode = '');
    if (k === 'X') return (this.keypadOn = false);
    if (this.keypadCode.length >= 4) return;
    this.keypadCode += k;
    if (this.keypadCode.length === 4) {
      if (this.keypadCode === '0704') {
        this.keypadOn = false;
        this.set('lockerOpen');
        this.set('usedSpare');
        this.give('keycard');
        this.rate(5);
        this.line("CLICK. 0704. ZORP'S BIRTHDAY. THE LOCKER OPENS. A SPARE KEYCARD. INTERNS, MAN.");
      } else {
        this.sound.play('empty');
        this.line(pick(['BZZT. WRONG CODE. THE LOCKER SIGHS AT YOU.', 'BZZT. THE KEYPAD SAYS: NICE TRY, TALENT.', 'BZZT. PEOPLE USE BIRTHDAYS. ALIENS TOO, PROBABLY.']));
        this.keypadCode = '';
      }
    }
  },
  zorpPie() {
    this.take('pie');
    this.rep('network', 5);
    if (this.has('keycard') || this.f('zorpRobbed')) return this.line('ZORP: PIE! FOR ME? NOBODY GIVES THE INTERN PIE. *SOBS* *EATS* *SOBS*');
    this.set('zorpEating');
    this.set('zorpEatUntil', this.rt + 18);
    this.line("ZORP: PIE! FOR ME? NOBODY GIVES THE INTERN PIE. HOLD ON, THE LANYARD KEEPS GETTING IN IT. *TAKES IT OFF* *PUTS IT ON THE TABLE* *WEEPS INTO PIE*");
  },

  // --- the studio gate ------------------------------------------------------------------------------------
  openGate(how) {
    if (this.f('gateOpen')) return;
    this.set('gateOpen');
    this.set('gateHow', how);
    this.world.openGate();
    this.act = Math.max(this.act, 2);
    this.dialog = null;
    if (how === 'pass') this.rep('hoa', 5, true);
    if (how === 'bribe') this.rep('network', -5, true);
    if (how === 'remote') this.rep('network', -10);
    this.rate(10);
    this.sound.play('power');
    this.showBanner('THE LOT IS OPEN', 'FIND THE KEYCARD. ZORP IS BACK AT HIS OFFICE NOW.');
    this.save();
  },
  blowGate() {
    if (this.f('gateOpen')) return;
    const cp = this.world.checkpoint;
    this.take('dynamite');
    this.line("YOU LIGHT THE DYNAMITE, TOSS IT AT THE BOOTH AND WALK AWAY WITHOUT LOOKING BACK. COOL GUYS DON'T LOOK AT EXPLOSIONS.");
    this.bombs.push({ x: cp.x, y: cp.y, t: 3, beep: 0, prop: cp, gate: true });
  },
  gateBoom(b) {
    const cp = this.world.checkpoint;
    if (cp) {
      this.world.removeProp(cp);
      this.world.checkpoint = null;
    }
    this.explode(b.x, b.y, 20, true, true);
    this.addDecal('crater', b.x, b.y, 1.6);
    this.set('gateBlown');
    this.openGate('dynamite');
    this.rep('network', -20);
    this.rep('rats', 10);
    this.rate(18);
    this.say('THE STUDIO GATE IS NOW A STUDIO HOLE. THE NETWORK IS FILING AN INSURANCE CLAIM WITH ITSELF.', true);
  },
  useRemoteOnGate() {
    this.line('YOU POINT THE HOLY REMOTE AT THE GATE AND PRESS THE BIG BUTTON. THE FORCE FIELD SWITCHES OFF. SO DOES THE GUARD. HE IS ASLEEP NOW. HOLY.');
    this.openGate('remote');
  },

  // --- the finale ---------------------------------------------------------------------------------------------
  enterControl() {
    this.set('sawConsole');
    this.act = Math.max(this.act, 3);
    if (this.f('power')) {
      this.line('THE CONSOLE HUMS. THE GIANT EYE WATCHES YOU. USE A TAPE ON THE TAPE DECK. OR TALK TO THE EYE. BOTH ARE TERRIFYING.');
      return;
    }
    this.line("THE CONTROL ROOM IS DARK. THE CONSOLE IS DEAD. THERE IS AN EMPTY, GLOWING SOCKET SHAPED LIKE A POWER CELL.");
    if (!this.f('kevinCellHint')) {
      this.set('kevinCellHint');
      this.say('KEVIN (WALKIE): NO POWER? THE CRASHED SAUCER AT THE OLD RANCH! IT HAS A POWER CELL! AND DALE... THEY KNOW YOU ARE IN THE TOWER. RUN.', true);
    }
  },
  startHunt() {
    this.set('hunted');
    this.showBanner('THE NETWORK KNOWS', 'THE MOTHERSHIP IS COMING FOR YOU');
    this.say('THE EXECUTIVE HERSELF IS COMING. GET THE POWER CELL FROM THE CRASH SITE (SOUTH) AND GET BACK TO THE TOWER.', true);
    if (!this.mother) this.spawnMother();
    this.mother.leaveT = 1e9;
    this.mother.hunt = true;
  },
  powerUp() {
    if (this.f('power')) return;
    this.take('fuse');
    this.set('power');
    this.sound.play('bigboom');
    this.rate(15);
    this.line('YOU JAM THE POWER CELL INTO THE SOCKET. THE CONSOLE ROARS TO LIFE. THE GIANT SCREEN FLICKERS ON. AN EYE OPENS. IT IS NOT HAPPY TO SEE YOU.');
    if (this.mother) this.mother.hunt = false;
    setTimeout(() => {
      if (this.scene && this.scene.id === 'control' && !this.dialog) this.talk('executive');
    }, 2600);
  },
  deck(tape) {
    if (!this.f('power')) return this.line('THE TAPE DECK IS DEAD. NO POWER. NO SHOW.');
    this.finale(tape);
  },
  finale(tape) {
    this.dialog = null;
    this.set('ending', tape);
    this.endingId = tape;
    this.endingT = 0;
    let found = [];
    try {
      found = JSON.parse(store.get(ENDINGS_KEY, '[]')) || [];
    } catch {}
    if (!found.includes(tape)) found.push(tape);
    store.set(ENDINGS_KEY, JSON.stringify(found));
    this.sound.play('mission');
    this.clearSave();
  },
  endingsFound() {
    try {
      return JSON.parse(store.get(ENDINGS_KEY, '[]')) || [];
    } catch {
      return [];
    }
  },

  // --- items in the world -------------------------------------------------------------------------------
  useSelf(id) {
    const it = ITEMS[id];
    const p = this.player;
    if (!it) return;
    this.held = null;
    if (it.eat) {
      this.take(id);
      p.hp = Math.min(p.maxHp, p.hp + it.eat);
      this.sound.play('pickup');
      return this.line(pick(['DELICIOUS. +' + it.eat + ' HP.', 'YOU EAT IT IN ONE BITE. NOBODY SAW. +' + it.eat + ' HP.', 'NOM. +' + it.eat + ' HP. THE APOCALYPSE DIET.']));
    }
    if (id === 'tinfoil') {
      this.set('foilUntil', this.rt + 90);
      return this.line('YOU FOLD A TINFOIL HAT AND PUT IT ON. YOU LOOK INSANE. SAUCERS IGNORE YOU FOR A WHILE. SO DOES EVERYONE ELSE.');
    }
    if (id === 'cowbell') return this.ringCowbell();
    if (id === 'megaphone') return this.megaphone();
    if (id === 'finebook') {
      this.held = 'finebook';
      return this.line('WHO GETS A FINE? TAP SOMEONE. BIKERS, CULTISTS, ALIENS. EVERYONE DESERVES ONE.');
    }
    if (it.tape) return this.line("YOU DON'T HAVE A VCR. NOBODY HAS A VCR. THE TOWER HAS A TAPE DECK.");
    this.held = id;
    this.line('TAP SOMETHING TO USE THE ' + it.name + ' ON IT.');
  },
  ringCowbell() {
    this.sound.play('cowbell');
    const p = this.player;
    let best = null, bd = 450 * 450;
    for (const c of this.cows) {
      if (c.state === 'abducted') continue;
      const d = dist2(c.x, c.y, p.x, p.y);
      if (d < bd) (bd = d), (best = c);
    }
    if (!best) return this.line('CLONK CLONK. NO COWS NEARBY. A DISTANT COW MOOS SARCASTICALLY.');
    best.followUntil = this.rt + 70;
    best.state = 'walk';
    this.float('MOO?', best.x, best.y, 13, 1.4);
    this.line(this.q('sacredcow') === 1 ? 'CLONK CLONK. A COW LOOKS UP AND TROTS AFTER YOU. NOW WALK HER TO THE CHURCH. SLOWLY. SHE HAS FOUR KNEES AND NO PATIENCE.' : 'CLONK CLONK. A COW FOLLOWS YOU. YOU ARE A COWBOY NOW. KIND OF.');
    this.rate(1);
  },
  megaphone() {
    if ((this.f('megaT') || 0) > this.rt) return this.line('YOUR THROAT HURTS. GIVE IT A SECOND.');
    this.set('megaT', this.rt + 4);
    const p = this.player;
    this.sound.play('megaphone');
    this.float(pick(['EVERYBODY TO THE BUS!', 'THIS IS NOT A DRILL!', 'HEY! ALIENS! BOO!', 'ATTENTION: I HAVE A MEGAPHONE!']), p.x, p.y, 15, 1.6);
    for (const v of this.civs) if (!v.taken && dist2(v.x, v.y, p.x, p.y) < 650 * 650) v.hail = 6;
    for (const e of this.enemies)
      if (dist2(e.x, e.y, p.x, p.y) < 260 * 260) {
        e.stun = 1.2;
        const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
        e.kx += ((e.x - p.x) / d) * 180;
        e.ky += ((e.y - p.y) / d) * 180;
      }
    this.rate(2);
  },
  // use the held item on something in the world (hit from the renderer's picker)
  useOnWorld(id, hit) {
    this.held = null;
    const k = hit.k, o = hit.o;
    if (id === 'cowbell') return this.ringCowbell();
    if (id === 'megaphone') return this.megaphone();
    if (ITEMS[id] && ITEMS[id].eat && (k === 2 || k === 13)) {
      this.take(id);
      if (k === 2) {
        o.follow = true;
        o.life = 999;
      }
      return this.line('YOU HAND OVER THE ' + ITEMS[id].name + '. THEY EAT IT LIKE A RACCOON. ' + (k === 2 ? 'THEY FOLLOW YOU NOW.' : 'THEY LIKE YOU A LITTLE MORE.'), 'dale');
    }
    if (id === 'finebook') return this.fine(hit);
    if (k === 0 && o.type === 'checkpoint') {
      if (id === 'dynamite') return this.blowGate();
      if (id === 'remote') return this.useRemoteOnGate();
      if (id === 'setpass' || id === 'lanyard') return this.talk('guard');
    }
    if (k === 0 && o.type === 'pylon' && id === 'remote' && this.world.inLot(o.x, o.y - 70)) return this.useRemoteOnGate();
    if (k === 0 && o.type === 'tower' && id === 'keycard') return this.enterScene('control', o.door);
    if (id === 'fuse') return this.line('THE POWER CELL GOES IN THE CONSOLE. IN THE TOWER. UP NORTH. THIS IS NOT THE TOWER.');
    if (id === 'remote' && k === 14) {
      o.off = 6;
      return this.line('YOU POINT THE HOLY REMOTE AT THE CAMERA DRONE. IT POWERS DOWN AND DROPS. GLORIA WAS RIGHT. HOLY.');
    }
    this.failUse(id, this.hitName(hit));
  },
  fine(hit) {
    const k = hit.k, o = hit.o;
    let fac = null, text = null;
    if (k === 13) {
      fac = o.fac;
      if (fac === 'hoa') return this.line('THE HOA LADY FINES YOU BACK. FOR FINING WITHOUT A LICENSE. YOU OWE HER 2 COUPONS.'), this.spend(2);
      text = { rats: ['A FINE? FOR WHAT? ...FOR EXISTING? FAIR.', 'I WILL FRAME THIS. THEN BURN THE FRAME.'], church: ['A FINE! A TEST OF FAITH! I SHALL PAY IN PRAYERS.', 'BLESSED BE THE PINK TICKET.'], network: ['A HUMAN FINE? ADORABLE. I WILL SHOW THE OTHERS.', 'IS THIS... A RECEIPT? FOR ME?'] }[fac];
    } else if (k === 1) {
      fac = 'network';
      text = ['THE ALIEN READS THE FINE. IT EATS THE FINE. CASE CLOSED.', 'FINE: UNLICENSED INVASION. THE ALIEN LOOKS GENUINELY ASHAMED.'];
    } else if (k === 2) text = ['A FINE? I JUST ESCAPED A SAUCER!', 'IS THIS ABOUT MY LAWN? IT IS ABOUT MY LAWN.'];
    else if (k === 3) text = ['YOU FINE THE COW FOR LOITERING. THE COW DOES NOT ACKNOWLEDGE YOUR AUTHORITY.'];
    else if (k === 12) text = ['YOU FINE THE DOG. THE DOG EATS THE FINE. GOOD BOY. ILLEGAL BOY.'];
    else return this.failUse('finebook', this.hitName(hit));
    if (o.fined) return this.line('ALREADY FINED. DOUBLE JEOPARDY. EVEN THE HOA HAS LIMITS. BARELY.');
    o.fined = true;
    this.sound.play('fine');
    this.float(pick(text), o.x, o.y, 12, 2);
    this.float('FINED!', o.x, o.y, 15, 1.2);
    if (fac) this.rep(fac, -5, true);
    this.rate(2);
    if (this.q('fines') === 1) {
      this.set('fines', (this.f('fines') || 0) + 1);
      if (this.f('fines') >= 3) this.toast('3/3 FINES. TELL BRENDA.', 'it_finebook', '#7dff9a');
      else this.toast(this.f('fines') + '/3 FINES', 'it_finebook');
    }
    this.held = 'finebook';
  },
  hitName(hit) {
    const o = hit.o;
    switch (hit.k) {
      case 0: return (o.type || 'THING').replace(/_/g, ' ').toUpperCase();
      case 1: return 'ALIEN';
      case 2: return 'SURVIVOR';
      case 3: return 'COW';
      case 10: return 'CAR';
      case 12: return 'DOG';
      case 13: return CHARS[o.kind] ? CHARS[o.kind].name : 'PERSON';
      case 14: return 'CAMERA DRONE';
    }
    return 'THING';
  },

  // --- the world part of the story (called every frame) -----------------------------------------------------
  updateAdventure(dt) {
    this.rt += dt;
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter((t) => t.t < 3.2);
    if (this.caption && (this.caption.t += dt) > this.caption.dur) this.caption = null;
    if (this.dialog) this.dialog.t += dt;
    if (this.spin > 0) this.spin = Math.max(0, this.spin - dt);
    this.hintT = Math.max(0, this.hintT - dt);
    if (this.f('zorpEating') && this.rt > (this.f('zorpEatUntil') || 0)) this.set('zorpEating', false);
    if (this.scene) {
      this.scene.t += dt;
      // Brenda comes back from yelling at a cow
      if (this.scene.id === 'clubhouse' && this.f('brendaAwayUntil') && !this.brendaAway() && !this.f('brendaBackMsg')) {
        this.set('brendaBackMsg');
        this.line('BRENDA STOMPS BACK IN: THERE WAS NOBODY ON MY LAWN. THERE WAS A COW. I FINED THE COW.');
      }
      return;
    }
    if (this.f('brendaAwayUntil') && !this.brendaAway()) this.set('brendaBackMsg');
    if (this.mode !== 'story') return;
    const p = this.player;
    // the HOA counts every flamingo
    // (estate damage is tracked in addDamage)
    // cows on a cowbell follow Dale; delivered to the church they become sacred
    const church = this.world.landmarks.find((l) => l.id === 'church');
    for (const c of this.cows) {
      if (!c.followUntil || c.followUntil < this.rt || c.state === 'abducted') continue;
      const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy) || 1;
      if (d > 70) {
        const sp = Math.min(150, d * 0.9);
        c.vx = (dx / d) * sp;
        c.vy = (dy / d) * sp;
        c.state = 'walk';
        c.t = 0.3;
      }
      if (church && this.q('sacredcow') === 1 && dist2(c.x, c.y, church.x + 120, church.y + 160) < 260 * 260) {
        c.followUntil = 0;
        c.sacred = true;
        c.state = 'graze';
        this.qset('sacredcow', 2);
        this.rep('church', 30);
        this.float('THE SACRED COW HAS ARRIVED!', c.x, c.y, 15, 2.5);
        this.say('GLORIA (FROM INSIDE): THE COW! THE PROPHECY! EVERYBODY BOW! NOT TO THE COW. NEAR THE COW.', true);
        for (let i = 0; i < 10; i++) this.addFx('heart', c.x + rand(-20, 20), c.y + rand(-20, 20), 30, 0, 0, rand(40, 90), rand(0.8, 1.4));
      }
    }
    // the Rats fix your car if they like you
    const gar = this.world.garage;
    if (gar && p.car && this.f('ratsGarage') && dist2(p.x, p.y, gar.x, gar.y) < 110 * 110 && Math.abs(p.car.speed) < 40 && p.car.hp < p.car.maxHp - 5) {
      if (!this.garageT || this.garageT < this.rt) {
        this.garageT = this.rt + 45;
        p.car.hp = p.car.maxHp;
        p.car.fuel = p.car.maxFuel;
        this.float('THE RATS FIXED YOUR CAR. WITH OTHER CARS.', p.x, p.y, 13, 2.2);
        this.sound.play('rummage');
      }
    }
    // the mothership hunt: she does not leave until the console is powered
    if (this.f('hunted') && !this.f('power') && !this.mother && !this.over) {
      this.spawnMother();
      this.mother.leaveT = 1e9;
      this.mother.hunt = true;
    }
    this.saveT -= dt;
    if (this.saveT <= 0) {
      this.saveT = 20;
      this.save();
    }
  },

  // drop-off point for survivors: the evac bus, or the church while Gloria wants converts
  dropZone(x, y, r = 190) {
    const ev = this.world.evac;
    if (ev && dist2(x, y, ev.x, ev.y) < r * r) return { kind: 'evac', x: ev.x, y: ev.y };
    if (this.mode === 'story' && this.q('converts') === 1) {
      const ch = this.world.landmarks.find((l) => l.id === 'church');
      if (ch) {
        const cx = ch.x + 120, cy = ch.y + 150;
        if (dist2(x, y, cx, cy) < (r + 30) * (r + 30)) return { kind: 'church', x: cx, y: cy };
      }
    }
    return null;
  },
  converted(n) {
    this.set('converts', (this.f('converts') || 0) + n);
    const c = this.f('converts');
    this.toast(Math.min(3, c) + '/3 LOST SOULS', 'em_church');
    this.float(pick(['WE HAVE SNACKS!', 'WELCOME, BROTHER!', 'HERE IS YOUR ROBE!']), this.player.x, this.player.y, 13, 1.8);
  },

  // --- point & click in the world ---------------------------------------------------------------------------
  tapWorld(hit, wx, wy) {
    const p = this.player;
    if (this.over || this.endingId || p.dead) return;
    const held = this.held;
    if (p.car) {
      if (hit) this.lookAt(hit);
      return;
    }
    if (!hit) {
      if (held) {
        this.held = null;
        return this.line('YOU PUT THE ' + ITEMS[held].name + ' AWAY.');
      }
      return this.walkTo(wx, wy, null, null);
    }
    const o = hit.o;
    if (held) return this.walkTo(o.x, o.y, hit, 'use', held);
    switch (hit.k) {
      case 0:
        if (o.door && this.mode === 'story') return this.walkTo(o.door.x, o.door.y, hit, 'enter');
        if (o.type === 'checkpoint' && !this.f('gateOpen') && this.mode === 'story') return this.walkTo(o.x + 40, o.y + 90, hit, 'guard');
        if (o.search && !o.searched) {
          this.pokeProp(o, false);
          return this.walkTo(o.x, o.y, hit, 'search');
        }
        if (o.type === 'checkpoint' || o.type === 'drive_in' || o.type === 'tower' || o.type === 'landed_ufo' || ['phone_booth', 'icecream', 'speaker_pole', 'burn_barrel', 'pylon', 'flamingo', 'gnome', 'hydrant', 'water_tower'].includes(o.type)) {
          if (Math.hypot(o.x - p.x, o.y - p.y) < 90) return this.pokeProp(o, true);
          this.pokeProp(o, false);
          return this.walkTo(o.x, o.y, hit, 'poke');
        }
        return this.pokeProp(o, false);
      case 1:
        return this.line(pick(LOOK_ENEMY[o.type] || ['AN ALIEN.']));
      case 2:
        return this.walkTo(o.x, o.y, hit, 'talk');
      case 3:
        return this.walkTo(o.x, o.y, hit, 'pet');
      case 4:
        return this.walkTo(o.x, o.y, null, null);
      case 5:
        return this.line('A LANDED SAUCER. IT IS MAKING MORE ALIENS. RAM IT WITH A CAR. HARD. REPEATEDLY.');
      case 9:
        return this.line(pick(["IT'S ME, DALE. I LOOK GREAT. CONSIDERING.", 'DALE CHECKS HIS POCKETS: LINT, A RECEIPT, EXISTENTIAL DREAD.', 'YOU PAT YOURSELF ON THE BACK. NOBODY ELSE WILL.']));
      case 10:
        if (o.wreck) return this.line('A BURNING WRECK. EVEN THE ALIENS WOULD NOT DRIVE THAT.');
        return this.walkTo(o.x, o.y, hit, o.driver === 'ai' ? 'carjack' : 'drive');
      case 12:
        return this.walkTo(o.x, o.y, hit, 'pet');
      case 13:
        return this.walkTo(o.x, o.y, hit, 'chat');
      case 14:
        o.flash = 1;
        this.sound.play('camera');
        return this.line(pick(['A CAMERA DRONE. SMILE. YOU ARE ON A TRILLION SCREENS.', 'THE DRONE ZOOMS IN ON YOUR NOSTRILS. THE AUDIENCE GASPS.', 'A CAMERA DRONE. IT FOLLOWS YOU EVERYWHERE. LIKE YOUR EX-WIFE. BUT WITH BETTER LIGHTING.']));
      case 15:
        return this.line(pick(['A SAUCER. IF IT BEAMS SOMETHING UP, HONK AT IT. THEY HATE HONKING.', 'A FLYING SAUCER. IT IS WAVING A TRACTOR BEAM AROUND LIKE A FLASHLIGHT AT A CONCERT.']));
      case 16:
        return this.line('THE MOTHERSHIP. THE EXECUTIVE IS INSIDE. SHE HAS NINE MOUTHS AND ALL OF THEM ARE DISAPPOINTED IN YOU.');
    }
  },
  lookAt(hit) {
    const o = hit.o;
    if (hit.k === 0) return this.pokeProp(o, false);
    if (hit.k === 1) return this.line(pick(LOOK_ENEMY[o.type] || ['AN ALIEN.']));
    if (hit.k === 13) return this.float(pick(BARKS[o.fac][this.npcMood(o)]), o.x, o.y, 12, 2);
  },
  walkTo(x, y, hit, action, item) {
    const p = this.player;
    const path = this.world.findPath(p.x, p.y, x, y);
    if (!path) return this.line(pick(["DALE CAN'T GET THERE. DALE ALSO CAN'T DO TAXES.", 'NO WAY THROUGH. THE TOWN IS A MAZE. A BURNING MAZE.']));
    p.walk = { path, i: 0, hit, action, item, x, y, prog: 0, best: 1e9, repath: 0 };
    this.addFx('ring', x, y, 2, 0, 0, 0, 0.35, 40);
    if (!action || Math.hypot(x - p.x, y - p.y) > 30) this.sound.play('click');
  },
  // one step along the walk path; returns the direction or null when done
  walkStep(dt) {
    const p = this.player, w = p.walk, world = this.world;
    const hit = w.hit;
    const o = hit && hit.o;
    // follow moving targets
    if (o && (hit.k === 2 || hit.k === 3 || hit.k === 10 || hit.k === 12 || hit.k === 13)) {
      w.repath -= dt;
      if (w.repath <= 0 && Math.hypot(o.x - w.x, o.y - w.y) > 60) {
        w.repath = 0.8;
        const path = world.findPath(p.x, p.y, o.x, o.y);
        if (path) (w.path = path), (w.i = 0), (w.x = o.x), (w.y = o.y);
      }
    }
    // arrived at the target?
    const reach = { enter: 46, guard: 70, search: 60, poke: 80, talk: 55, pet: 55, drive: 64, carjack: 64, chat: 50, use: 70 }[w.action] || 0;
    if (w.action) {
      let d;
      if (o && o.box && w.action !== 'enter') {
        const nx = clamp(p.x, o.box.x0, o.box.x1), ny = clamp(p.y, o.box.y0, o.box.y1);
        d = Math.hypot(p.x - nx, p.y - ny);
      } else if (w.action === 'enter') d = Math.hypot(p.x - o.door.x, p.y - o.door.y);
      else if (o) d = Math.hypot(p.x - o.x, p.y - o.y) - (o.r || o.circle || 0);
      else d = Math.hypot(p.x - w.x, p.y - w.y);
      if (d < reach) {
        p.walk = null;
        this.walkArrive(w);
        return null;
      }
    }
    // smooth the path: skip waypoints that can be reached in a straight line
    while (w.i < w.path.length - 1 && this.walkClear(p.x, p.y, w.path[w.i + 1].x, w.path[w.i + 1].y)) w.i++;
    const q = w.path[w.i];
    const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
    if (d < 12) {
      w.i++;
      if (w.i >= w.path.length) {
        p.walk = null;
        if (w.action) this.walkArrive(w);
        return null;
      }
      return this.walkStep(dt);
    }
    // give up when stuck
    const left = Math.hypot(w.x - p.x, w.y - p.y);
    if (left < w.best - 4) (w.best = left), (w.prog = 0);
    else if ((w.prog += dt) > 1.6) {
      p.walk = null;
      if (w.action && left < 120) this.walkArrive(w);
      return null;
    }
    return [dx / d, dy / d];
  },
  walkClear(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 20);
    for (let k = 1; k <= n; k++) if (!this.world.isWalkable(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n)) return false;
    return true;
  },
  walkArrive(w) {
    const o = w.hit && w.hit.o;
    switch (w.action) {
      case 'enter':
        return this.enterScene(o.door.scene, o.door);
      case 'guard':
        return this.talk('guard');
      case 'search':
        if (!o.searched) this.search = { prop: o, t: 0, dur: 1.4, noise: 0 };
        return;
      case 'poke':
        return this.pokeProp(o, true);
      case 'use':
        return this.useOnWorld(w.item, w.hit);
      case 'talk':
      case 'pet':
      case 'drive':
      case 'carjack':
      case 'chat':
        if ((w.action === 'drive' || w.action === 'carjack') && (o.wreck || (o.driver === 'ai' && Math.abs(o.speed) > 70))) return;
        if (w.action === 'talk' && (o.taken || o.follow)) return;
        this.interact = { kind: w.action, o };
        return this.doAction();
    }
  },

  // --- saving ---------------------------------------------------------------------------------------------
  save() {
    if (this.mode !== 'story' || this.over || this.f('ending')) return;
    const p = this.player;
    const data = {
      v: 1, seed: this.world.seed, time: this.time, act: this.act, flags: this.flags, inv: this.inv, reps: this.reps,
      coupons: this.coupons, ratings: this.ratings, rescued: this.rescued, kills: this.kills, damage: this.damage,
      missionsDone: this.missionsDone, hp: p.hp, x: p.x, y: p.y, rt: this.rt, recasts: this.recasts || 0,
    };
    store.set(SAVE_KEY, JSON.stringify(data));
  },
  clearSave() {
    store.set(SAVE_KEY, '');
  },
  loadData() {
    try {
      const s = store.get(SAVE_KEY, '');
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  },
  applySave(d) {
    this.flags = d.flags || {};
    this.inv = d.inv || [];
    this.reps = Object.assign({ hoa: 0, church: 0, rats: 0, network: 0 }, d.reps || {});
    this.coupons = d.coupons || 0;
    this.ratings = d.ratings || 50;
    this.rescued = d.rescued || 0;
    this.kills = d.kills || 0;
    this.damage = d.damage || 0;
    this.missionsDone = d.missionsDone || 0;
    this.time = d.time || 0;
    this.rt = d.rt || 0;
    this.act = d.act || 0;
    this.recasts = d.recasts || 0;
    const p = this.player;
    p.hp = Math.max(40, d.hp || 100);
    if (d.x && d.y) {
      p.x = d.x;
      p.y = d.y;
      this.world.collide(p);
    }
    // world changes that the story made
    if (this.f('gateOpen')) this.world.openGate();
    if (this.f('gateBlown') && this.world.checkpoint) {
      this.world.removeProp(this.world.checkpoint);
      this.world.checkpoint = null;
      this.addDecal('crater', this.world.gate.x0 + 5 * TILE, this.world.gate.y + 80, 1.6);
    }
    this.set('zorpEating', false);
    this.set('brendaAwayUntil', 0);
    this.set('moshUntil', 0);
  },

  // Death in story mode is a recast, not a game over.
  recast() {
    const p = this.player;
    const b = this.world.landmarks.find((l) => l.id === 'bunker');
    this.over = false;
    this.overT = 0;
    p.dead = false;
    p.hp = p.maxHp;
    p.car = null;
    p.x = b.x + 100;
    p.y = b.y + 120;
    this.world.collide(p);
    this.recasts = (this.recasts || 0) + 1;
    const lost = Math.floor(this.coupons * 0.25);
    this.coupons -= lost;
    this.enemies = this.enemies.filter((e) => dist2(e.x, e.y, p.x, p.y) > 900 * 900);
    this.ebullets = [];
    this.meteors = [];
    this.ratings = clamp(this.ratings + 15, 0, 100);
    if (this.mother && !this.mother.hunt) this.mother = null;
    // a fresh ride, courtesy of the Network's props department
    if (!this.cars.some((c) => !c.wreck && !c.driver && dist2(c.x, c.y, p.x, p.y) < 500 * 500)) {
      const c = this.makeCar('police', p.x + 90, p.y + 10, 0, null);
      c.fuel = c.maxFuel;
      this.cars.push(c);
    }
    this.showBanner('DALE HAS BEEN RECAST', 'DUE TO CREATIVE DIFFERENCES. THE NEW DALE LOOKS EXACTLY THE SAME.');
    this.say('THE NETWORK RECAST DALE. NOBODY NOTICED. ' + (lost ? 'THE OLD DALE OWED ' + lost + ' COUPONS. THE NEW DALE PAID.' : ''), true);
    this.save();
  },
};

export { FACTION_IDS };
