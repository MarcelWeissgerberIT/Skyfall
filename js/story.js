// EARTH: THE FINAL SEASON
// Characters, factions, items, interior scenes, dialogue trees, quests and endings.
// Text rules (the bitmap font): only A-Z 0-9 space ! : . + - / ? , ' ( ) % * & #
//
// The story: Earth got cancelled (one star). Before they wrap, the Network shoots one last cheap
// finale special on location in Pine Bluff. The aliens run the town like a film set, the humans have
// split into gangs, and after the finale the Network will STRIKE THE SET. Kevin (tinfoil, right about
// everything) has a plan: hijack the broadcast tower and give the universe a different ending.

import { pick } from './util.js';

// --- factions -----------------------------------------------------------------------------------------
export const FACTIONS = {
  hoa: {
    name: 'THE HOA', full: 'PINE BLUFF HOMEOWNERS ASSOCIATION', emblem: 'em_hoa', color: '#ff8fc8', rival: 'rats', leader: 'brenda',
    motto: 'ORDER. LAWNS. COMPLIANCE.', where: 'THE ESTATES (NORTH SIDE OF TOWN)',
    about: 'COLLABORATORS WITH CLIPBOARDS. THEY THINK THE ALIENS ARE JUST A STRICTER HOA.',
  },
  church: {
    name: 'THE CHURCH', full: 'CHURCH OF THE BLESSED PROBE', emblem: 'em_church', color: '#b48cff', rival: 'network', leader: 'gloria',
    motto: 'TAKE US. PLEASE. ANY TIME.', where: 'THE CHAPEL IN THE EAST DESERT',
    about: 'THEY WANT TO BE ABDUCTED. THE SAUCERS KEEP SAYING NO.',
  },
  rats: {
    name: 'THE DESERT RATS', full: 'THE DESERT RATS MOTORCYCLE CLUB', emblem: 'em_rats', color: '#ff8a3c', rival: 'hoa', leader: 'barb',
    motto: 'NO KINGS. NO HOA. NO DENTISTS.', where: 'THE JUNKYARD (WEST HIGHWAY)',
    about: 'ANARCHISTS ON MOTORCYCLES. THEY HAVE DYNAMITE AND NO IMPULSE CONTROL.',
  },
  network: {
    name: 'THE NETWORK', full: 'THE NETWORK. A TRILLION SCREENS.', emblem: 'em_network', color: '#e45cff', rival: 'church', leader: 'zorp',
    motto: 'STAY TUNED. OR ELSE.', where: 'THE STUDIO LOT (NORTH, BEHIND THE FORCE FIELD)',
    about: 'THE ALIENS. TECHNICALLY IN CHARGE. PRACTICALLY A FILM CREW WITH LASERS.',
  },
};
export const FACTION_IDS = ['hoa', 'church', 'rats', 'network'];

export function repLabel(v) {
  if (v >= 60) return 'ALLY';
  if (v >= 25) return 'FRIENDLY';
  if (v > -25) return 'NEUTRAL';
  if (v > -60) return 'HOSTILE';
  return 'BLOOD FEUD';
}

// --- people ------------------------------------------------------------------------------------------
// head = portrait crop of the sprite: centre x / y and size as fractions of the sprite height
export const CHARS = {
  dale: { name: 'DALE', sprite: 'player_front', head: [0.5, 0.15, 0.26], color: '#c4231b' },
  kevin: { name: 'KEVIN', sprite: 'npc_kevin', head: [0.5, 0.17, 0.2], color: '#8fe08f', title: 'TINFOIL. RIGHT ABOUT EVERYTHING.' },
  mel: { name: 'MEL', sprite: 'npc_mel', head: [0.48, 0.16, 0.2], color: '#f2c23b', title: 'DINER OWNER. NEUTRAL. TIRED.' },
  brenda: { name: 'BRENDA', sprite: 'npc_brenda', head: [0.52, 0.14, 0.18], color: '#ff8fc8', title: 'HOA PRESIDENT SINCE 1994.' },
  gloria: { name: 'REVEREND GLORIA', sprite: 'npc_gloria', head: [0.44, 0.21, 0.2], color: '#b48cff', title: 'CHURCH OF THE BLESSED PROBE.' },
  barb: { name: 'BIG BARB', sprite: 'npc_barb', head: [0.52, 0.14, 0.18], color: '#ff8a3c', title: 'QUEEN OF THE DESERT RATS.' },
  zorp: { name: 'ZORP', sprite: 'npc_zorp', head: [0.48, 0.15, 0.2], color: '#e45cff', title: 'PRODUCTION INTERN. THIRD CLASS.' },
  sheriff: { name: 'SHERIFF BUCK', sprite: 'npc_sheriff', head: [0.42, 0.17, 0.21], color: '#d9a75c', title: 'THE LAW. CURRENTLY LOCKED UP.' },
  guard: { name: 'GATE WARDEN', sprite: 'npc_warden', head: [0.5, 0.16, 0.2], color: '#e45cff', title: 'GUARDS THE STUDIO GATE.' },
  executive: { name: 'THE EXECUTIVE', sprite: null, color: '#e45cff', title: 'SHE HAS NINE MOUTHS. ALL OF THEM SAY NO.' },
  hoa: { name: 'HOA ENFORCER', sprite: 'npc_hoa', head: [0.52, 0.16, 0.2], color: '#ff8fc8' },
  biker: { name: 'DESERT RAT', sprite: 'npc_biker', head: [0.5, 0.14, 0.2], color: '#ff8a3c' },
  cultist: { name: 'CULTIST', sprite: 'npc_cultist', head: [0.5, 0.21, 0.22], color: '#b48cff' },
  warden: { name: 'ALIEN WARDEN', sprite: 'npc_warden', head: [0.5, 0.16, 0.2], color: '#e45cff' },
};

// --- items --------------------------------------------------------------------------------------------
// icon = sprite key; use = what happens when Dale uses it on himself (returns true if handled)
export const ITEMS = {
  tape_kevin: { name: "KEVIN'S TAPE", icon: 'it_tape_kevin', desc: "KEVIN'S DOCUMENTARY. NINE HOURS ABOUT CHEMTRAILS. WRAPPED IN FOIL SO THE CHEMTRAILS CAN'T WATCH IT FIRST.", tape: true },
  tape_hoa: { name: 'HOA MEETING TAPE', icon: 'it_tape_hoa', desc: 'THE 1999 ANNUAL HOA MEETING. AGENDA ITEM ONE OF 312: MAILBOX COLORS. SIX HOURS. UNCUT.', tape: true },
  tape_sermon: { name: 'SERMON TAPE', icon: 'it_tape_sermon', desc: "GLORIA'S SERMON, 'PROBE ME, LORD'. FOUR HOURS. TWO INTERMISSIONS. ONE INTERPRETIVE DANCE.", tape: true },
  tape_metal: { name: 'SKULL GOAT MIXTAPE', icon: 'it_tape_metal', desc: "SKULL GOAT, LIVE AT THE DUMP. THE ONLY ALBUM. THE NEIGHBORS CALLED IT A WAR CRIME. THE NEIGHBORS MOVED.", tape: true },
  tape_cow: { name: "ZORP'S PILOT: COWS", icon: 'it_tape_cow', desc: 'NINETY MINUTES OF COWS. JUST COWS. IT TESTED SO WELL THAT AUDIENCES FORGOT TO EAT.', tape: true },
  beans: { name: 'BEANS', icon: 'it_beans', desc: 'A CAN OF BEANS FROM 1998. STILL GOOD. BEANS ARE ETERNAL. (USE TO EAT: +30 HP)', eat: 30 },
  tinfoil: { name: 'TINFOIL', icon: 'it_tinfoil', desc: 'A ROLL OF TINFOIL. KEVIN SAYS IT BLOCKS MIND RAYS. IT DEFINITELY BLOCKS STYLE. (USE TO WEAR)' },
  toolbox: { name: 'DUCT TAPE', icon: 'pk_tools', desc: 'A TOOLBOX WITH DUCT TAPE. FIXES EVERYTHING EXCEPT YOUR MARRIAGE.' },
  pie: { name: 'CHERRY PIE', icon: 'it_pie', desc: "A CHERRY PIE FROM MEL'S. THE LAST CHERRIES IN NEVADA. (USE TO EAT: +40 HP)", eat: 40 },
  coffee: { name: 'COFFEE', icon: 'it_coffee', desc: 'BLACK DINER COFFEE. IT COULD STRIP PAINT. IT HAS STRIPPED PAINT.' },
  donut: { name: 'DONUT', icon: 'it_donut', desc: "THE SHERIFF'S DONUT. PINK. SPRINKLES. EVIDENCE. (USE TO EAT: +15 HP)", eat: 15 },
  keys: { name: "SHERIFF'S KEYS", icon: 'it_keys', desc: "THE SHERIFF'S KEY RING. IT HAS A LITTLE DONUT ON IT. OF COURSE IT DOES." },
  cowbell: { name: 'COWBELL', icon: 'it_cowbell', desc: 'A COWBELL. RING IT AND COWS FOLLOW YOU. MORE COWBELL. ALWAYS MORE COWBELL. (USE TO RING)' },
  gnome: { name: 'GERALD', icon: 'it_gnome', desc: "BRENDA'S GARDEN GNOME. HE HAS SEEN THINGS. HE WILL NOT TALK ABOUT THEM." },
  trophy: { name: 'GOLDEN FLAMINGO', icon: 'it_trophy', desc: "THE HOA'S GOLDEN FLAMINGO. AWARDED TO BRENDA FOR BEST LAWN. BY BRENDA." },
  finebook: { name: 'FINE BOOK', icon: 'it_finebook', desc: 'A PINK BOOK OF HOA FINES. USE IT ON PEOPLE. OR ALIENS. ESPECIALLY ALIENS.' },
  setpass: { name: 'HOA SET PASS', icon: 'it_setpass', desc: 'AN OFFICIAL EXTRAS PASS FOR THE STUDIO LOT. LAMINATED. TWICE.' },
  lanyard: { name: 'STAFF LANYARD', icon: 'it_lanyard', desc: 'NETWORK CREW LANYARD. WARDENS TREAT YOU LIKE CREW. CREW DOES NOT GET PROBED. USUALLY.' },
  remote: { name: 'HOLY REMOTE', icon: 'it_remote', desc: 'AN ALIEN REMOTE CONTROL. TURNS OFF ANY HEAVENLY DEVICE. ALSO TVS. USE IT ON THE STUDIO GATE.' },
  dynamite: { name: 'DYNAMITE', icon: 'it_dynamite', desc: "BARB'S DYNAMITE. USE IT ON SOMETHING YOU DON'T LIKE. THE STUDIO GATE, FOR EXAMPLE." },
  keycard: { name: 'TOWER KEYCARD', icon: 'it_keycard', desc: 'OPENS THE BROADCAST TOWER. GLOWS PURPLE. SMELLS LIKE PIE.' },
  fuse: { name: 'POWER CELL', icon: 'it_fuse', desc: 'A GLOWING ALIEN POWER CELL FROM THE CRASHED SAUCER. HUMS. MAYBE DO NOT LICK IT.' },
  megaphone: { name: 'MEGAPHONE', icon: 'it_megaphone', desc: 'A MEGAPHONE. SURVIVORS COME RUNNING, ALIENS FLINCH, EVERYONE HATES YOU. (USE TO SHOUT)' },
  photo: { name: 'INCRIMINATING PHOTO', icon: 'it_photo', desc: "A POLAROID OF AN ALIEN EATING THE SHERIFF'S DONUTS ON THE JOB. IT LOOKS A LOT LIKE ZORP." },
  slime: { name: 'ALIEN GOO', icon: 'it_slime', desc: 'A JAR OF GLOWING ALIEN GOO. IT IS WARM. IT IS PURRING. KEVIN WOULD LOVE THIS.' },
  cables: { name: 'JUMPER CABLES', icon: 'it_cables', desc: 'JUMPER CABLES. FOR JUMPING CARS. NOT PEOPLE. NOT AGAIN.' },
};

// --- quests -------------------------------------------------------------------------------------------
// state: 0 unknown, 1 active, 2 done
export const QUESTS = {
  coffee: { title: 'COFFEE FOR ZORP', fac: 'network', text: (g) => (g.f('coffeeFixed') ? (g.has('coffee') ? 'GIVE ZORP THE COFFEE.' : "BUY A COFFEE FROM MEL (2 COUPONS).") : "FIX MEL'S COFFEE MACHINE. IT NEEDS TAPE. THE PLAZA STORE MIGHT HAVE SOME.") },
  shotlist: { title: 'THE SHOT LIST', fac: 'network', text: (g) => (g.f('shots') >= 3 ? 'TELL ZORP YOU GOT HIS SHOTS.' : 'COMPLETE ZORP\'S SHOT LIST ON THE RADIO: ' + (g.f('shots') || 0) + '/3') },
  gerald: { title: 'GERALD COMES HOME', fac: 'hoa', text: (g) => (g.has('gnome') ? 'BRING GERALD BACK TO BRENDA.' : "FIND BRENDA'S GNOME. SHE BLAMES THE DESERT RATS.") },
  fines: { title: 'LAW AND ORDER', fac: 'hoa', text: (g) => ((g.f('fines') || 0) >= 3 ? 'REPORT BACK TO BRENDA.' : 'USE THE FINE BOOK ON 3 LAWBREAKERS: ' + (g.f('fines') || 0) + '/3') },
  proveit: { title: 'NOT A COP', fac: 'rats', text: (g) => (g.f('estateDamage') >= 30000 ? 'TELL BARB ABOUT THE CARNAGE.' : 'WRECK 30,000 WORTH OF STUFF IN THE ESTATES: ' + Math.floor((g.f('estateDamage') || 0) / 1000) + 'K/30K') },
  flamingo: { title: 'THE GOLDEN FLAMINGO', fac: 'rats', text: (g) => (g.has('trophy') ? 'BRING THE GOLDEN FLAMINGO TO BARB.' : "STEAL THE GOLDEN FLAMINGO FROM THE HOA CLUBHOUSE. BRENDA NEVER LEAVES. MAKE HER.") },
  sacredcow: { title: 'THE SACRED COW', fac: 'church', text: (g) => (g.has('cowbell') ? 'RING THE COWBELL NEAR A COW AND LEAD IT TO THE CHURCH.' : 'FIND A COWBELL. THE OLD RANCH (SOUTH) USED TO HAVE ONE.') },
  converts: { title: 'LOST SOULS', fac: 'church', text: (g) => (g.f('converts') >= 3 ? 'RETURN TO GLORIA.' : 'BRING SURVIVORS TO THE CHURCH: ' + (g.f('converts') || 0) + '/3') },
  sheriff: { title: 'REVERSE JAILBREAK', fac: null, text: () => "THE SHERIFF LOCKED HIMSELF IN HIS OWN CELL. YOU KNOW WHERE HE LEAVES HIS KEYS." },
  slime: { title: 'FOR SCIENCE', fac: null, text: (g) => (g.has('slime') ? 'BRING THE ALIEN GOO TO KEVIN.' : 'KEVIN WANTS A SAMPLE OF ALIEN GOO. TRY THE CRASH SITE.') },
};

// Where the main story wants Dale to go next.
export function mainObjective(g) {
  if (!g.f('metKevin')) return { text: "FIND KEVIN'S BUNKER (WEST SIDE OF TOWN)", target: 'bunker' };
  if (g.f('ending')) return { text: 'THE END. SORT OF.', target: null };
  if (!g.f('gateOpen')) return { text: 'GET ONTO THE STUDIO LOT (NORTH). PASS, LANYARD, REMOTE, DYNAMITE OR 40 COUPONS.', target: 'gate' };
  if (!g.has('keycard')) return { text: "GET THE TOWER KEYCARD. ZORP HAS IT.", target: g.zorpWhere() };
  if (!g.f('sawConsole')) return { text: 'ENTER THE BROADCAST TOWER.', target: 'tower' };
  if (!g.f('power') && !g.has('fuse')) return { text: 'THE CONSOLE NEEDS POWER. GET THE POWER CELL FROM THE CRASHED SAUCER (SOUTH).', target: 'crash' };
  if (!g.f('power')) return { text: 'BRING THE POWER CELL TO THE TOWER. THE MOTHERSHIP IS HUNTING YOU.', target: 'tower' };
  return { text: 'BROADCAST A TAPE FROM THE CONTROL ROOM.', target: 'tower' };
}

// Kevin's walkie-talkie hints.
export function hint(g) {
  const o = mainObjective(g);
  if (!g.f('metKevin')) return "KEVIN: DALE! MY MOM'S BACKYARD. WEST SIDE. THE BUNKER WITH THE FOIL ON IT. ALL OF IT HAS FOIL ON IT.";
  if (!g.f('gateOpen')) {
    const opts = [];
    if (g.has('setpass') || g.has('lanyard')) return 'KEVIN: YOU HAVE A PASS! SHOW IT TO THE GATE WARDEN AT THE STUDIO GATE. NORTH HIGHWAY.';
    if (g.has('remote')) return 'KEVIN: USE THE HOLY REMOTE ON THE STUDIO GATE. POINT, CLICK, PRAY.';
    if (g.has('dynamite')) return 'KEVIN: DYNAMITE. GATE. YOU DO THE MATH. THEN RUN.';
    if (g.coupons >= 40) return 'KEVIN: YOU HAVE 40 COUPONS. THE GATE WARDEN TAKES BRIBES. EVERYONE TAKES BRIBES.';
    if (g.q('gerald') === 1 && !g.has('gnome')) opts.push("KEVIN: THE RATS HAVE BRENDA'S GNOME AT THEIR SALOON. BARB WON'T LET IT GO WHILE SHE'S WATCHING. DISTRACT HER. RATS LOVE LOUD MUSIC.");
    if (g.q('coffee') === 1 && !g.f('coffeeFixed') && !g.has('toolbox')) opts.push('KEVIN: DUCT TAPE. THE STORE IN THE PLAZA. SEARCH IT.');
    if (g.q('coffee') === 1 && g.has('toolbox')) opts.push("KEVIN: USE THE DUCT TAPE ON MEL'S COFFEE MACHINE. SELECT IT IN YOUR BAG, THEN TAP THE MACHINE.");
    if (g.q('flamingo') === 1 && !g.has('trophy')) opts.push('KEVIN: BRENDA NEVER LEAVES HER CLUBHOUSE. UNLESS SOMEONE PARKS ON HER LAWN. JUST SAYING.');
    if (g.q('sacredcow') === 1 && !g.has('cowbell')) opts.push('KEVIN: COWBELL. OLD RANCH. SOUTH. SEARCH THE TRAILER.');
    if (g.q('sacredcow') === 1 && g.has('cowbell')) opts.push('KEVIN: RING THE COWBELL NEXT TO A COW, THEN WALK TO THE CHURCH. SLOWLY. COWS DO NOT DO HIGHWAYS.');
    if (g.q('proveit') === 1) opts.push('KEVIN: BARB WANTS CARNAGE IN THE ESTATES. NORTH SIDE OF TOWN. FLAMINGOS, MAILBOXES, PALM TREES. GO WILD.');
    if (g.q('fines') === 1) opts.push('KEVIN: SELECT THE FINE BOOK IN YOUR BAG AND TAP A BIKER, A CULTIST OR AN ALIEN. FINES ARE THE HOA LOVE LANGUAGE.');
    if (g.q('converts') === 1) opts.push('KEVIN: SURVIVORS FOLLOW YOU WHEN YOU TALK TO THEM. DROP THEM AT THE CHURCH. EAST DESERT.');
    if (g.q('shotlist') === 1) opts.push('KEVIN: ZORP WANTS DRAMA. DO WHAT THE RADIO SAYS. CAMERA DRONES NEARBY MEAN BONUS RATINGS.');
    if (opts.length) return pick(opts);
    return 'KEVIN: EVERY GANG HAS A WAY ONTO THE LOT. HOA, CHURCH, RATS, OR ZORP AT THE DINER. TALK TO THEM. OR SAVE UP 40 COUPONS FOR A BRIBE.';
  }
  if (!g.has('keycard')) {
    if (g.has('photo')) return "KEVIN: THAT PHOTO OF ZORP EATING DONUTS ON THE JOB? THAT'S CALLED LEVERAGE, DALE. SHOW IT TO HIM.";
    if (g.f('lockerSeen')) return "KEVIN: A LOCKER WITH A CODE? PEOPLE USE THEIR BIRTHDAYS. ALIENS TOO. CHECK THE CASTING BOARD IN THE OFFICE.";
    return pick([
      'KEVIN: ZORP LOVES PIE. WHEN HE EATS, HE TAKES OFF HIS LANYARD. THE KEYCARD IS ON THE LANYARD. YOU SEE WHERE I AM GOING.',
      "KEVIN: MAKE ZORP LIKE YOU ENOUGH AND HE'LL JUST GIVE YOU THE KEYCARD. THE NETWORK LIKES HELPFUL PEOPLE.",
      'KEVIN: THE SHERIFF HAS DIRT ON EVERYONE. ALSO DONUTS. FREE HIM. HIS OFFICE IS NEXT TO THE EVAC FORT.',
      "KEVIN: ZORP'S OFFICE IS THE SILVER TRAILER ON THE LOT. HE MIGHT KEEP A SPARE CARD THERE.",
    ]);
  }
  if (o.target === 'crash') return 'KEVIN: THE CRASHED SAUCER AT THE OLD RANCH. SOUTH. SEARCH IT FOR A POWER CELL.';
  if (!g.f('power')) return 'KEVIN: GET THAT POWER CELL INTO THE CONSOLE! USE IT ON THE CONSOLE! DRIVE, DALE! DRIVE!';
  const tapes = Object.keys(ITEMS).filter((k) => ITEMS[k].tape && g.has(k)).length;
  if (tapes < 2) return 'KEVIN: MY TAPE WORKS. BUT THE GANGS HAVE TAPES TOO. DIFFERENT TAPES, DIFFERENT ENDINGS. JUST SAYING.';
  return 'KEVIN: USE A TAPE ON THE TAPE DECK IN THE CONTROL ROOM. CHOOSE WISELY. OR DON\'T. IT\'S THE APOCALYPSE.';
}

// Mel's gossip doubles as a hint system.
function gossip(g) {
  const lines = [
    'MEL: THE HOA AND THE RATS ARE AT WAR. LAST WEEK THE RATS STOLE A GNOME. THIS WEEK THE HOA FINED A MOTORCYCLE. IT WAS PARKED. IT WAS A MOTORCYCLE.',
    'MEL: THE CHURCH PEOPLE STAND UNDER SAUCERS AND YELL TAKE ME. THE SAUCERS DRIVE AROUND THEM. I RESPECT THE COMMITMENT.',
    'MEL: THE ALIEN KID, ZORP, TIPS IN COUPONS. EIGHT PERCENT. HE APOLOGIZES EVERY TIME.',
    'MEL: THE SHERIFF LOCKED HIMSELF IN HIS OWN JAIL. SAFEST PLACE IN TOWN, HE SAID. THEN HE LOST THE KEYS. EVERYBODY KNOWS WHERE HE KEEPS HIS KEYS. EXCEPT HIM.',
    'MEL: A SAUCER CRASHED AT THE OLD RANCH. SOUTH. THE ALIENS NEVER CAME BACK FOR IT. INSURANCE THING, I GUESS.',
    'MEL: THE NETWORK GATE TAKES PASSES. OR BRIBES. THE WARDEN THERE IS SAVING UP FOR SOMETHING. A HAT, MAYBE. THEY ALL WANT HATS.',
    "MEL: COUPONS ARE MONEY NOW. THE BANKS GOT ABDUCTED. NOBODY'S MISSING THEM.",
    'MEL: BRENDA FROM THE HOA ORDERS DECAF. THAT TELLS YOU EVERYTHING.',
  ];
  if (!g.f('coffeeFixed')) lines.push("MEL: MY COFFEE MACHINE NEEDS DUCT TAPE. THE STORE IN THE PLAZA HAD SOME. BEFORE THE LOOTERS. AND AFTER, PROBABLY. NOBODY LOOTS DUCT TAPE.");
  if (g.q('gerald') === 1) lines.push("MEL: BARB'S BOYS GO NUTS WHEN THE JUKEBOX PLAYS. NUTS. EYES CLOSED, HEADS BANGING. YOU COULD STEAL A KIDNEY.");
  if (g.q('flamingo') === 1) lines.push('MEL: BRENDA ONLY EVER LEAVES THAT CLUBHOUSE FOR ONE THING: SOMEBODY PARKING ON HER LAWN.');
  return pick(lines);
}

// --- dialogue trees -----------------------------------------------------------------------------------
// node: { say: string | string[] | (g) => string[], who?: char id, do?: (g) => void,
//         choices?: [{ t, if?, once?, go?, do? }], next?: node id }   (no choices + no next = end)
const tapes = (g) => Object.keys(ITEMS).filter((k) => ITEMS[k].tape && g.has(k));

export const DIALOG = {
  // ===================================================================== KEVIN
  kevin: {
    start: (g) => (g.f('metKevin') ? 'hub' : 'intro'),
    intro: {
      say: [
        "DALE! YOU CAME! I KNEW YOU WOULD. I ALSO KNEW THE ALIENS WOULD COME. NOBODY EVER LISTENS TO KEVIN.",
        "SIT. NOT THERE. THAT'S WHERE THE OTHER COUCH IS GOING TO BE.",
      ],
      choices: [
        { t: 'WHAT IS GOING ON OUT THERE?', go: 'plot' },
        { t: 'IS THAT A PIZZA BOX FROM 2019?', go: 'pizza' },
      ],
    },
    pizza: { say: ['2018. VINTAGE. I AM SAVING THE LAST SLICE FOR WHEN THE WORLD ENDS.', '...SO, TODAY. YOU WANT IT? NO? MORE FOR ME.'], next: 'intro2' },
    intro2: { say: ['ANYWAY.'], choices: [{ t: 'WHAT IS GOING ON OUT THERE?', go: 'plot' }] },
    plot: {
      say: [
        "THEY'RE NOT INVADING, DALE. THEY'RE FILMING.",
        'EARTH GOT CANCELLED. ONE STAR. BUT THE NETWORK STILL OWES THE SPONSORS ONE LAST EPISODE. THE SERIES FINALE.',
        "SO THEY'RE SHOOTING IT HERE. IN PINE BLUFF. ON LOCATION. WE ARE THE LOCATION.",
      ],
      choices: [
        { t: 'WHAT HAPPENS AFTER THE FINALE?', go: 'strike' },
        { t: 'WHY PINE BLUFF?', go: 'why' },
      ],
    },
    why: { say: ['CHEAP PERMITS. GREAT LIGHT. NO UNIONS. ALSO OUR MAYOR SOLD THE RIGHTS FOR A HOT TUB.'], choices: [{ t: 'WHAT HAPPENS AFTER THE FINALE?', go: 'strike' }] },
    strike: {
      say: [
        'AFTER THE FINALE THEY STRIKE THE SET. YOU KNOW WHAT A SET IS, DALE? WE ARE THE SET.',
        "THAT BIG SHIP THAT SHOWS UP SOMETIMES? THAT'S NOT A SHIP. THAT'S A VERY LARGE BROOM.",
      ],
      next: 'plan',
    },
    plan: {
      say: [
        "BUT. I HAVE A PLAN. THAT TOWER UP NORTH IS THEIR BROADCAST TOWER. EVERYTHING THEY FILM GOES OUT THROUGH IT. TO A TRILLION SCREENS.",
        'WE GET IN. WE PUT IN OUR OWN TAPE. WE GIVE THE UNIVERSE A DIFFERENT ENDING.',
        'WE NEED THREE THINGS. ONE: A WAY ONTO THEIR STUDIO LOT. TWO: THE TOWER KEYCARD. THREE: A TAPE WORTH BROADCASTING.',
      ],
      next: 'planq',
    },
    planq: {
      say: ['ASK ME ANYTHING. EXCEPT ABOUT MY MOM. SHE IS UPSTAIRS. SHE CAN HEAR US.'],
      choices: [
        { t: 'HOW DO I GET ONTO THE LOT?', go: 'lot', once: 'k_lot' },
        { t: 'WHO HAS THE KEYCARD?', go: 'card', once: 'k_card' },
        { t: 'WHAT TAPE?', go: 'tape', once: 'k_tape' },
        { t: "GOT IT. LET'S SAVE THE WORLD.", go: 'go', if: (g) => g.f('k_lot') && g.f('k_card') && g.f('k_tape') },
      ],
    },
    lot: {
      say: [
        'THE TOWN SPLIT INTO GANGS THE DAY THE SAUCERS LANDED. EVERY GANG HAS AN ANGLE ON THE NETWORK.',
        'THE HOA KISSES ALIEN BUTT FOR SET PASSES. THE CHURCH HAS A HOLY REMOTE THAT SWITCHES OFF ALIEN STUFF. THE DESERT RATS HAVE DYNAMITE. A LOT OF DYNAMITE.',
        'OR YOU BRIBE THE GATE WARDEN. 40 COUPONS. COUPONS ARE MONEY NOW. THE BANKS GOT ABDUCTED.',
      ],
      next: 'planq',
    },
    card: {
      say: ["AN ALIEN INTERN NAMED ZORP CARRIES IT. HE TAKES HIS LUNCH AT MEL'S DINER. SOUTH SIDE. EVERY DAY. HE ORDERS PIE AND QUIETLY CRIES."],
      next: 'planq',
    },
    tape: {
      say: [
        'TAKE THIS. MY DOCUMENTARY. NINE HOURS ON CHEMTRAILS. IT IS A WORK IN PROGRESS. SEASON ONE OF SIX.',
        "IF THAT DOESN'T SAVE THE WORLD, MAYBE THE GANGS HAVE SOMETHING BETTER. UNLIKELY. BUT I'M A BIG ENOUGH MAN TO SAY MAYBE.",
      ],
      do: (g) => g.give('tape_kevin'),
      next: 'planq',
    },
    go: {
      say: [
        'TAKE MY WALKIE-TALKIE. CALL ME IF YOU GET STUCK. OR LONELY. MOSTLY LONELY.',
        "OH, AND DALE? THE CAMERAS ARE EVERYWHERE. THE MORE CHAOS, THE BETTER THE RATINGS. AND WHEN THE RATINGS DROP... THEY ADD A PLOT TWIST.",
      ],
      do: (g) => g.startStory(),
    },
    hub: {
      say: (g) => [pick(["DALE. DID ANYONE FOLLOW YOU? DON'T LOOK. THAT'S WHAT THEY WANT.", "BACK ALREADY? THE TOWER IS NOT GOING TO HIJACK ITSELF.", "I'VE BEEN THINKING. THE COWS. WHY IS IT ALWAYS THE COWS?", 'MY MOM SAYS HI. MY MOM SAYS YOU NEED A HAIRCUT.'])],
      choices: [
        { t: 'ANY ADVICE?', go: 'advice' },
        { t: 'TELL ME ABOUT THE GANGS.', go: 'gangs' },
        { t: 'I FOUND SOME ALIEN GOO.', if: (g) => g.has('slime') && g.q('slime') !== 2, go: 'slime' },
        { t: 'CAN I BORROW SOME COUPONS?', once: 'k_loan', go: 'loan' },
        { t: 'WHAT IS IN THE STATIC ON YOUR MONITORS?', once: 'k_static', go: 'static' },
        { t: 'SEE YOU, KEVIN.' },
      ],
    },
    advice: { say: (g) => [hint(g).replace(/^KEVIN: /, '')], next: 'hub' },
    gangs: {
      say: [
        "THE HOA: BRENDA'S PEOPLE. THEY THINK THE ALIENS ARE A STRICTER HOMEOWNERS ASSOCIATION. THE ESTATES, NORTH SIDE.",
        'THE CHURCH OF THE BLESSED PROBE: REVEREND GLORIA. THEY WANT TO BE ABDUCTED SO BADLY. EAST DESERT.',
        'THE DESERT RATS: BIG BARB. BIKERS. ANARCHY. DYNAMITE. THE JUNKYARD ON THE WEST HIGHWAY.',
        "AND THE NETWORK: THE ALIENS THEMSELVES. HELP ONE GANG AND ITS RIVAL HATES YOU. HOA HATES RATS. CHURCH AND NETWORK HAVE... HISTORY. A RESTRAINING ORDER.",
      ],
      next: 'hub',
    },
    slime: {
      say: ['GOO! REAL ALIEN GOO! IT IS PURRING. WHY IS IT PURRING?', 'HERE. 15 COUPONS. FOR SCIENCE. AND FOR MY CHANNEL. I HAVE THREE SUBSCRIBERS. TWO ARE ME.'],
      do: (g) => {
        g.take('slime');
        g.earn(15);
        g.qset('slime', 2);
      },
      next: 'hub',
    },
    loan: { say: ["I'M NOT A BANK, DALE. ...FINE. TEN COUPONS. PAY ME BACK WHEN WE SAVE THE EARTH. WITH INTEREST. EMOTIONAL INTEREST."], do: (g) => g.earn(10), next: 'hub' },
    static: {
      say: ["THE STATIC? IT'S THE NETWORK'S BACKCHANNEL. I DECODED ONE WORD SO FAR.", 'THE WORD IS: SUBSCRIBE.', 'I DO NOT LIKE WHAT IT IMPLIES.'],
      do: (g) => g.qset('slime', g.q('slime') || 1),
      next: 'slimeq',
    },
    slimeq: { say: ["ALSO, IF YOU FIND ALIEN GOO, BRING ME SOME. THE CRASHED SAUCER AT THE OLD RANCH PROBABLY LEAKS. I'LL PAY."], next: 'hub' },
  },

  // ===================================================================== MEL
  mel: {
    start: (g) => (g.f('metMel') ? 'hub' : 'intro'),
    intro: {
      say: [
        'SIT ANYWHERE. EXCEPT THE BOOTH. THE BOOTH IS FOR THE ALIEN.',
        "HOUSE RULE: NO FIGHTING IN THE DINER. THAT RULE IS OLDER THAN THE ALIENS. OLDER THAN ME. I FOUND IT IN THE BUILDING WHEN I BOUGHT IT.",
      ],
      do: (g) => g.set('metMel'),
      next: 'hub',
    },
    hub: {
      say: (g) => [pick(['WHAT CAN I GET YOU?', "YOU LOOK LIKE A MAN WHO NEEDS PIE. OR A LAWYER. I ONLY HAVE PIE.", 'THE SPECIAL TODAY IS: STILL BEING ALIVE.'])],
      choices: [
        { t: "I'LL HAVE A PIE. (5 COUPONS)", go: 'pie' },
        { t: 'COFFEE, PLEASE. (2 COUPONS)', go: 'coffee' },
        { t: "WHAT'S THE GOSSIP?", go: 'gossip' },
        { t: 'WHAT HAPPENED TO THE COFFEE MACHINE?', if: (g) => !g.f('coffeeFixed'), go: 'machine' },
        { t: 'BYE, MEL.' },
      ],
    },
    pie: {
      say: (g) => {
        if (!g.spend(5)) return ['FIVE COUPONS. NO COUPONS, NO PIE. THAT IS CALLED ECONOMICS.'];
        g.give('pie');
        return ['ONE CHERRY PIE. THE LAST CHERRIES IN NEVADA. THE ALIENS ATE THE REST. THEY ATE THEM WITH THE PITS. MONSTERS.'];
      },
      next: 'hub',
    },
    coffee: {
      say: (g) => {
        if (!g.f('coffeeFixed')) return ['THE MACHINE IS BROKEN. IT MAKES SMOKE NOW. YOU WANT A CUP OF SMOKE? SMOKE IS FREE.'];
        if (!g.spend(2)) return ['TWO COUPONS. EVEN AT THE END OF THE WORLD, COFFEE IS NOT FREE.'];
        g.give('coffee');
        return ['ONE COFFEE. BLACK. LIKE MY FUTURE.'];
      },
      next: 'hub',
    },
    gossip: { say: (g) => [gossip(g).replace(/^MEL: /, '')], next: 'hub' },
    machine: {
      say: ['SOMETHING INSIDE WENT BANG WHEN THE SAUCERS CAME. NEEDS TAPE. EVERYTHING NEEDS TAPE.', "THE STORE IN THE PLAZA HAD DUCT TAPE. GO RUMMAGE. THE OWNER WON'T MIND. THE OWNER IS IN SPACE."],
      next: 'hub',
    },
  },

  // ===================================================================== ZORP
  zorp: {
    start: (g) => {
      if (g.f('zorpRobbed') && !g.f('zorpKnows')) return 'robbed';
      return g.f('metZorp') ? 'hub' : 'intro';
    },
    intro: {
      say: [
        "OH. A HUMAN. HI. I'M NOT SUPPOSED TO TALK TO THE TALENT.",
        "I'M ZORP. PRODUCTION INTERN. THIRD CLASS. THERE IS NO SECOND CLASS. THERE IS NO PAY.",
      ],
      do: (g) => g.set('metZorp'),
      next: 'hub',
    },
    robbed: {
      say: ["HEY. HEY! MY KEYCARD IS GONE. IT WAS RIGHT HERE. I WAS EATING PIE AND NOW IT'S GONE.", "YOU WOULDN'T... NO. YOU GAVE ME PIE. PIE PEOPLE DON'T STEAL. ...DO THEY?"],
      do: (g) => {
        g.set('zorpKnows');
        g.rep('network', -15);
      },
      next: 'hub',
    },
    hub: {
      say: (g) => [pick(['WHAT DO YOU NEED? PLEASE SAY NOTHING. NOTHING IS EASY.', "IF THIS IS ABOUT THE PROBING, I ONLY DO THE SCHEDULING.", 'HI AGAIN. SORRY. I SAY SORRY A LOT. IT IS A HUMAN WORD I LIKE.'])],
      choices: [
        { t: 'WHAT DO YOU DO FOR THE NETWORK?', go: 'job', once: 'z_job' },
        { t: 'WHY ARE YOU CRYING INTO YOUR PIE?', go: 'sad', once: 'z_sad' },
        { t: 'CAN I GET YOU ANYTHING?', if: (g) => !g.q('coffee'), go: 'want' },
        { t: "HERE'S YOUR COFFEE.", if: (g) => g.q('coffee') === 1 && g.has('coffee'), go: 'coffee' },
        { t: 'HOW CAN I HELP WITH THE RATINGS?', if: (g) => g.q('coffee') === 2 && !g.q('shotlist'), go: 'shots' },
        { t: 'I GOT YOUR THREE SHOTS.', if: (g) => g.q('shotlist') === 1 && g.f('shots') >= 3, go: 'lanyard' },
        { t: 'CAN I BORROW THE TOWER KEYCARD?', if: (g) => !g.has('keycard') && !g.f('zorpRobbed'), go: 'card' },
        { t: 'ABOUT THIS PHOTO OF YOU EATING DONUTS ON THE JOB...', if: (g) => g.has('photo') && !g.has('keycard'), go: 'photo' },
        { t: "WHAT'S IN THAT FILM CAN?", if: (g) => !g.has('tape_cow') && !g.f('cowTapeGiven'), go: 'pilot' },
        { t: 'BYE, ZORP.' },
      ],
    },
    job: {
      say: [
        'COFFEE. PROBES. SCHEDULING. I SCHEDULE THE PROBES. AND I GET THE COFFEE. FOR THE PROBERS.',
        "ALSO I HOLD THE KEYCARD TO THE TOWER. THEY GAVE IT TO ME BECAUSE NOBODY WOULD SUSPECT THE INTERN. ...AND NOW I'VE TOLD YOU. OH NO.",
      ],
      next: 'hub',
    },
    sad: {
      say: [
        'THE RATINGS ARE TERRIBLE. THE EXECUTIVE SAYS IF THE FINALE FLOPS, SHE CANCELS ME TOO.',
        'INTERNS GET CANCELLED DIFFERENTLY. WITH LASERS. FROM ORBIT. IT IS IN THE CONTRACT. PAGE ONE. IN BOLD.',
      ],
      next: 'hub',
    },
    want: {
      say: [
        "COFFEE. EARTH COFFEE. IT IS THE BEST THING YOUR SPECIES EVER MADE. BESIDES COWS.",
        "BUT MEL'S MACHINE IS BROKEN AND I'M NOT ALLOWED TO TOUCH HUMAN MACHINES. UNION RULES. WE DON'T HAVE A UNION. THAT IS THE RULE.",
      ],
      do: (g) => g.qset('coffee', 1),
      next: 'hub',
    },
    coffee: {
      say: ['COFFEE! REAL COFFEE! BLESS YOU. THAT IS A THING YOU SAY, RIGHT? WHEN SOMEONE IS NICE OR WHEN THEY SNEEZE?', 'I OWE YOU ONE. INTERNS NEVER FORGET. WE CAN NOT AFFORD TO.'],
      do: (g) => {
        g.take('coffee');
        g.qset('coffee', 2);
        g.rep('network', 20);
      },
      next: 'hub',
    },
    shots: {
      say: [
        'THE EXECUTIVE WANTS DRAMA. CRASHES. EXPLOSIONS. COWS. I NEED THREE GREAT SHOTS FOR THE FINALE REEL.',
        "I'LL RADIO YOU MY SHOT LIST. DO WHAT IT SAYS. GET ME THREE AND I'LL MAKE YOU CREW.",
      ],
      do: (g) => {
        g.qset('shotlist', 1);
        g.set('shots', 0);
      },
      next: 'hub',
    },
    lanyard: {
      say: [
        'I SAW THE FOOTAGE. THE EXECUTIVE SMILED. I THINK. SHE HAS NINE MOUTHS. AT LEAST FOUR WERE SMILING.',
        "HERE. A STAFF LANYARD. YOU'RE CREW NOW. THE WARDENS WILL LEAVE YOU ALONE. CREW DOESN'T GET PROBED. USUALLY.",
      ],
      do: (g) => {
        g.qset('shotlist', 2);
        g.give('lanyard');
        g.rep('network', 25);
      },
      next: 'hub',
    },
    card: {
      say: (g) => {
        if (g.repOf('network') >= 45) {
          g.give('keycard');
          g.rep('network', 5);
          return ['FOR YOU? ...YOU GOT ME COFFEE. YOU GOT ME SHOTS. NOBODY HAS EVER GOT ME ANYTHING.', 'TAKE IT. IF ANYONE ASKS, YOU STOLE IT. ACTUALLY, PLEASE STEAL IT. THEN IT IS NOT MY FAULT.'];
        }
        return ["HA. NO. I BARELY KNOW YOU. ALSO, I'D BE VAPORIZED. MOSTLY THE SECOND ONE.", 'MAYBE IF WE WERE FRIENDS. INTERNS DO NOT HAVE FRIENDS. INTERNS HAVE DEADLINES.'];
      },
      next: 'hub',
    },
    photo: {
      say: ["WHERE DID YOU GET THAT?! THAT WAS... THAT WAS A TASTE TEST! FOR CRAFT SERVICES!", 'OKAY. OKAY. NOBODY NEEDS TO SEE THAT. ESPECIALLY NOT HR. HR HAS ELEVEN EYES. WHAT DO YOU WANT?'],
      choices: [
        { t: 'THE TOWER KEYCARD.', go: 'photo2' },
        { t: 'NOTHING. I JUST REALLY LIKE THE PHOTO.', go: 'photo3' },
      ],
    },
    photo2: {
      say: ['FINE! TAKE IT! TAKE THE KEYCARD! JUST GIVE ME THE PHOTO. AND NEVER SPEAK OF THE DONUTS.'],
      do: (g) => {
        g.take('photo');
        g.give('keycard');
        g.rep('network', -10);
        g.rate(6);
      },
      next: 'hub',
    },
    photo3: { say: ['...THAT IS EITHER VERY SWEET OR VERY THREATENING. I WILL ASSUME SWEET. I HAVE TO. FOR MY HEALTH.'], do: (g) => g.rep('network', 5), next: 'hub' },
    pilot: {
      say: (g) => {
        if (g.repOf('network') >= 60) {
          g.give('tape_cow');
          g.set('cowTapeGiven');
          return ['MY PILOT. COWS. JUST COWS. NINETY MINUTES. THE EXECUTIVE SAID IT TESTED TOO WELL. AUDIENCES FORGOT TO EAT. TWO PLANETS STARVED.', "YOU'RE GOING TO THE TOWER, AREN'T YOU. TAKE IT. IF THE UNIVERSE IS GOING TO WATCH SOMETHING, IT SHOULD BE COWS."];
        }
        return ["MY PILOT. NOBODY GETS TO SEE MY PILOT. NOT UNTIL WE ARE CLOSE. CLOSER THAN THIS. WE'RE AT LIKE A FOUR."];
      },
      next: 'hub',
    },
  },

  // ===================================================================== BRENDA
  brenda: {
    start: (g) => {
      if (g.f('trophyStolen') && !g.f('brendaKnowsTrophy')) return 'stolen';
      return g.f('metBrenda') ? 'hub' : 'intro';
    },
    intro: {
      say: [
        "STOP. RIGHT THERE. YOU'RE DALE. NUMBER 12. THE LAWN.",
        "I'M BRENDA. PRESIDENT OF THE PINE BLUFF HOMEOWNERS ASSOCIATION SINCE 1994. UNOPPOSED. AFTER THE INCIDENT.",
      ],
      do: (g) => g.set('metBrenda'),
      next: 'hub',
    },
    stolen: {
      say: ['SOMEONE STOLE THE GOLDEN FLAMINGO. I HAVE A LIST OF SUSPECTS. YOU ARE ON IT.', 'EVERYONE IS ON IT. IT IS A LONG LIST. I LAMINATED IT.'],
      do: (g) => {
        g.set('brendaKnowsTrophy');
        g.rep('hoa', -25);
      },
      next: 'hub',
    },
    hub: {
      say: (g) => [pick(['WIPE YOUR FEET. BOTH OF THEM. IN ORDER.', 'MAKE IT QUICK. I HAVE 40 COMPLAINTS TO FILE BEFORE LUNCH.', 'YOU AGAIN. YOUR LAWN CALLED. IT MISSES YOU.'])],
      choices: [
        { t: 'YOU WORK WITH THE ALIENS?', go: 'collab', once: 'b_collab' },
        { t: 'I NEED A SET PASS.', if: (g) => !g.has('setpass') && !g.f('gotSetpass'), go: 'pass' },
        { t: 'HOW CAN I HELP THE COMMUNITY?', if: (g) => !g.q('gerald'), go: 'gerald' },
        { t: 'I FOUND GERALD.', if: (g) => g.has('gnome') && g.q('gerald') === 1, go: 'geraldback' },
        { t: 'ANYTHING ELSE?', if: (g) => g.q('gerald') && !g.q('fines'), go: 'fines' },
        { t: 'I HANDED OUT THREE FINES.', if: (g) => g.q('fines') === 1 && g.f('fines') >= 3, go: 'finesdone' },
        { t: 'WHAT IS ON THAT TAPE BY THE TV?', if: (g) => !g.has('tape_hoa') && !g.f('hoaTapeGiven'), go: 'tape' },
        { t: "I THINK SOMEONE IS PARKING ON YOUR LAWN.", if: (g) => !g.f('trophyStolen'), go: 'lawn' },
        { t: 'BYE, BRENDA.' },
      ],
    },
    collab: {
      say: [
        "WE COOPERATE. THE NETWORK HAS BEEN VERY REASONABLE. THEY ONLY VAPORIZE PEOPLE WHO DON'T MOW.",
        "IN EXCHANGE MY RESIDENTS GET SET PASSES. WE ARE EXTRAS NOW. BACKGROUND PERFORMERS. DIGNIFIED ONES. I HAVE A SPEAKING ROLE. I SAY: NO.",
      ],
      next: 'hub',
    },
    pass: {
      say: (g) => {
        if (g.repOf('hoa') >= 40) {
          g.give('setpass');
          g.set('gotSetpass');
          return ["HERE. A SET PASS. DON'T LAMINATE IT. IT'S ALREADY LAMINATED. I LAMINATED IT TWICE.", 'SHOW IT AT THE STUDIO GATE. AND STAND UP STRAIGHT. YOU REPRESENT THE ESTATES NOW.'];
        }
        return ['SET PASSES ARE FOR MEMBERS IN GOOD STANDING. YOU ARE IN... STANDING. BARELY.', 'DO SOMETHING FOR THE COMMUNITY. THEN WE WILL TALK.'];
      },
      next: 'hub',
    },
    gerald: {
      say: [
        'GERALD IS MISSING. MY GNOME. HE WAS A GIFT FROM MY FIRST HUSBAND. THE ONLY GOOD THING THAT MAN EVER GAVE ME.',
        'IT WAS THOSE RATS. THE BIKERS. I FOUND TIRE TRACKS IN MY PETUNIAS. BRING GERALD HOME.',
      ],
      do: (g) => g.qset('gerald', 1),
      next: 'hub',
    },
    geraldback: {
      say: ['GERALD! OH, GERALD. YOU SMELL LIKE MOTOR OIL AND BAD DECISIONS.', "THANK YOU, DALE. I'LL REDUCE YOUR OUTSTANDING FINES BY 2 PERCENT. AND HERE. COUPONS. DON'T SPEND THEM ALL IN ONE PLACE."],
      do: (g) => {
        g.take('gnome');
        g.qset('gerald', 2);
        g.rep('hoa', 25);
        g.earn(8);
      },
      next: 'hub',
    },
    fines: {
      say: [
        'THE TOWN IS LAWLESS. LAWLESS! I NEED SOMEONE TO HAND OUT FINES. YOU HAVE A FACE PEOPLE AVOID. PERFECT.',
        'HERE IS A FINE BOOK. FINE THREE LAWBREAKERS. BIKERS, CULTISTS, ALIENS. ANYONE WITHOUT A PERMIT. EVERYONE IS WITHOUT A PERMIT.',
      ],
      do: (g) => {
        g.give('finebook');
        g.qset('fines', 1);
        g.set('fines', 0);
      },
      next: 'hub',
    },
    finesdone: {
      say: ['THREE FINES! NOBODY HAS ISSUED THREE FINES IN ONE DAY SINCE ME. IN 1997. I CRIED. I AM NOT CRYING NOW. THIS IS ALLERGIES.'],
      do: (g) => {
        g.qset('fines', 2);
        g.rep('hoa', 25);
      },
      next: 'hub',
    },
    tape: {
      say: (g) => {
        if (g.repOf('hoa') >= 55) {
          g.give('tape_hoa');
          g.set('hoaTapeGiven');
          return ['THE 1999 ANNUAL MEETING. MAILBOX COLORS. SIX HOURS. UNCUT. A MASTERPIECE OF ORDER.', 'IF YOU EVER GET THE CHANCE TO SHOW THE UNIVERSE WHAT CIVILIZATION LOOKS LIKE... USE THIS.'];
        }
        return ['THAT IS THE 1999 ANNUAL MEETING. IT IS NOT FOR YOU. IT IS FOR PEOPLE WHO UNDERSTAND BEIGE.'];
      },
      next: 'hub',
    },
    lawn: {
      say: ['WHAT?! NOBODY PARKS ON MY LAWN. NOBODY. STAY HERE. TOUCH NOTHING.'],
      do: (g) => g.brendaLeaves(),
    },
  },

  // ===================================================================== BARB
  barb: {
    start: (g) => (g.f('metBarb') ? 'hub' : 'intro'),
    intro: {
      say: [
        "WELL, WELL. A MAN IN A COP CAR WALKS INTO MY BAR. THAT'S EITHER A JOKE OR A FUNERAL.",
        "I'M BIG BARB. THESE ARE THE DESERT RATS. WE BELIEVE IN FREEDOM. NO KINGS. NO HOA. NO ALIENS. NO DENTISTS.",
      ],
      do: (g) => g.set('metBarb'),
      next: 'hub',
    },
    hub: {
      say: (g) => [pick(['TALK FAST. MY BEER IS GETTING WARM. IT WAS ALWAYS WARM. STILL.', "YOU AGAIN. THE BOYS ARE STARTING TO LIKE YOU. I'M NOT.", 'WHAT. WHAT. WHAT DO YOU WANT.'])],
      choices: [
        { t: 'WHAT DO THE RATS WANT?', go: 'want', once: 'r_want' },
        { t: 'I NEED DYNAMITE.', if: (g) => !g.q('proveit'), go: 'dyn' },
        { t: "THE ESTATES ARE ON FIRE. YOU'RE WELCOME.", if: (g) => g.q('proveit') === 1 && g.f('estateDamage') >= 30000, go: 'proved' },
        { t: 'WHAT ELSE?', if: (g) => g.q('proveit') === 2 && !g.q('flamingo'), go: 'flamingo' },
        { t: 'ONE GOLDEN FLAMINGO, AS ORDERED.', if: (g) => g.has('trophy'), go: 'trophy' },
        { t: "WHAT'S WITH THE GNOME?", if: (g) => !g.f('geraldFree') && !g.has('gnome') && g.q('gerald') !== 2, go: 'gnome' },
        { t: 'GOT ANY MUSIC?', if: (g) => !g.has('tape_metal') && !g.f('metalTapeGiven'), go: 'music' },
        { t: 'CAN YOUR BOYS FIX MY CAR?', once: 'r_fix', go: 'fix' },
        { t: 'BYE, BARB.' },
      ],
    },
    want: { say: ['TO BURN IT ALL DOWN AND BUILD SOMETHING BETTER. FROM THE ASHES. AND TIRES. MOSTLY TIRES.', 'THE ALIENS? THEY ARE JUST ANOTHER HOA. WITH BETTER HATS.'], next: 'hub' },
    dyn: {
      say: [
        "EVERYBODY NEEDS DYNAMITE. NOT EVERYBODY GETS DYNAMITE. YOU ROLLED UP IN A COP CAR. PROVE YOU'RE NOT A COP.",
        "GO TO THE ESTATES. THE HOA'S LITTLE PARADISE, NORTH SIDE. BREAK 30,000 WORTH OF STUFF. FLAMINGOS COUNT. BONUS IF BRENDA CRIES.",
      ],
      do: (g) => g.qset('proveit', 1),
      next: 'hub',
    },
    proved: {
      say: ["I COULD SEE THE SMOKE FROM HERE. BEAUTIFUL. YOU'RE NOT A COP. COPS ARE BETTER DRIVERS."],
      do: (g) => {
        g.qset('proveit', 2);
        g.rep('rats', 25);
      },
      next: 'hub',
    },
    flamingo: {
      say: [
        "BRENDA HAS A GOLDEN FLAMINGO. A TROPHY. FOR LAWNS. SHE GAVE IT TO HERSELF.",
        "BRING IT TO ME. I'M GOING TO WELD IT ONTO MY BIKE. THEN YOU GET YOUR DYNAMITE.",
      ],
      do: (g) => g.qset('flamingo', 1),
      next: 'hub',
    },
    trophy: {
      say: ['LOOK AT IT. IT IS HIDEOUS. I LOVE IT.', "HERE. DYNAMITE. FOR THE STUDIO GATE. OR WHATEVER. I'M NOT YOUR MOM. LIGHT IT AND RUN. IN THAT ORDER."],
      do: (g) => {
        g.take('trophy');
        g.qset('flamingo', 2);
        g.give('dynamite');
        g.rep('rats', 30);
      },
      next: 'hub',
    },
    gnome: {
      say: (g) => {
        if (g.repOf('rats') >= 20) {
          g.set('geraldFree');
          return ["BRENDA'S GNOME. GERALD. WE KIDNAPPED HIM. THE RANSOM WAS ANARCHY. SHE NEVER PAID.", 'YOU WANT HIM? TAKE HIM. HE STARES AT ME WHEN I SLEEP.'];
        }
        return ["BRENDA'S GNOME. GERALD. OUR HOSTAGE. THE RANSOM IS ANARCHY.", 'TOUCH THE GNOME AND I TOUCH YOUR FACE. WITH THE BAT.'];
      },
      next: 'hub',
    },
    music: {
      say: (g) => {
        if (g.repOf('rats') >= 50) {
          g.give('tape_metal');
          g.set('metalTapeGiven');
          return ['MY OLD BAND. SKULL GOAT. ONE ALBUM. RECORDED LIVE AT THE DUMP. THE NEIGHBORS CALLED IT A WAR CRIME.', 'TAKE IT. PLAY IT LOUD. ALIEN EARS ARE DELICATE. I CHECKED.'];
        }
        return ["THE JUKEBOX. PLAY IT IF YOU WANT TO SEE THE BOYS LOSE THEIR MINDS. MY OWN TAPES ARE FOR FRIENDS. YOU'RE NOT A FRIEND. YOU'RE A GUY."];
      },
      next: 'hub',
    },
    fix: {
      say: (g) => {
        if (g.repOf('rats') >= 20) {
          g.set('ratsGarage');
          return ['PARK ON THE OIL STAINS OUT FRONT. THE BOYS WILL FIX IT. WITH PARTS FROM OTHER CARS. DO NOT ASK WHOSE.'];
        }
        return ['WE FIX CARS FOR FRIENDS. WE SET FIRE TO CARS FOR EVERYONE ELSE. YOU ARE IN BETWEEN.'];
      },
      next: 'hub',
    },
  },

  // ===================================================================== GLORIA
  gloria: {
    start: (g) => (g.f('metGloria') ? 'hub' : 'intro'),
    intro: {
      say: [
        'WELCOME, SEEKER! HAVE YOU BEEN PROBED? NO? NEITHER HAVE WE. WE WAIT. WE PRAY. WE WAIT SOME MORE.',
        'I AM REVEREND GLORIA OF THE CHURCH OF THE BLESSED PROBE. THE SAUCERS ARE ANGELS, DALE. THEY JUST KEEP... NOT TAKING US.',
      ],
      do: (g) => g.set('metGloria'),
      next: 'hub',
    },
    hub: {
      say: (g) => [pick(['BLESSINGS FROM ABOVE. LITERALLY ABOVE. LOOK UP.', 'THE SAUCERS FLEW OVER AGAIN TODAY. THEY WAVED. I THINK IT WAS A WAVE.', 'HAVE YOU COME TO JOIN US? WE HAVE ROBES IN EVERY SIZE. MOSTLY LARGE.'])],
      choices: [
        { t: 'WHY DO YOU WANT TO BE ABDUCTED?', go: 'why', once: 'g_why' },
        { t: 'WHAT IS THE HOLY REMOTE?', go: 'remote', once: 'g_remote' },
        { t: 'HOW DO I BECOME FAITHFUL?', if: (g) => !g.q('sacredcow'), go: 'cow' },
        { t: 'WHAT ELSE DOES THE CHURCH NEED?', if: (g) => g.q('sacredcow') === 2 && !g.q('converts'), go: 'converts' },
        { t: 'I BROUGHT YOU LOST SOULS.', if: (g) => g.q('converts') === 1 && g.f('converts') >= 3, go: 'convdone' },
        { t: 'MAY I CARRY THE HOLY REMOTE?', if: (g) => !g.has('remote') && !g.f('gotRemote'), go: 'remotereq' },
        { t: 'DO YOU HAVE A SERMON I COULD BORROW?', if: (g) => !g.has('tape_sermon') && !g.f('sermonGiven'), go: 'sermon' },
        { t: 'HERE, HAVE SOME HOLY TINFOIL.', if: (g) => g.has('tinfoil') && !g.f('gaveFoil'), go: 'foil' },
        { t: 'BYE, REVEREND.' },
      ],
    },
    why: {
      say: ['UP THERE IS THE GREAT STUDIO. NO TAXES. NO KNEES THAT HURT. AND THE FOOD! I ASSUME THE FOOD.', 'ALSO MY EX-HUSBAND LIVES DOWN HERE. SO.'],
      next: 'hub',
    },
    remote: {
      say: [
        'THE HOLY REMOTE! IT FELL FROM A SAUCER DURING A STORM. IT SWITCHES OFF ANY HEAVENLY DEVICE. FORCE FIELDS. DRONES. MY NEPHEW. IT IS A TRUE MIRACLE.',
        'ONLY THE FAITHFUL MAY CARRY IT.',
      ],
      next: 'hub',
    },
    cow: {
      say: [
        'THE PROPHECY SAYS: WHERE THE COW GOES, THE SAUCERS FOLLOW. BRING ME A COW. A LIVING ONE. FOR THE ALTAR. NOT LIKE THAT. FOR WORSHIP.',
        'COWS FOLLOW A COWBELL. THE OLD RANCH SOUTH OF TOWN HAD ONE. THE RANCHER WAS TAKEN. HIS COWS WERE NOT. HE WAS FURIOUS.',
      ],
      do: (g) => g.qset('sacredcow', 1),
      next: 'hub',
    },
    converts: {
      say: [
        "BRING ME THREE LOST SOULS. SURVIVORS. DROP THEM AT THE CHURCH INSTEAD OF THAT DREARY BUS. WE HAVE SNACKS. THE SNACKS ARE BLESSED.",
      ],
      do: (g) => {
        g.qset('converts', 1);
        g.set('converts', g.f('converts') || 0);
      },
      next: 'hub',
    },
    convdone: {
      say: ['THREE NEW BROTHERS AND SISTERS! ONE OF THEM IS ALREADY WEARING FOIL. THE SAUCERS WILL SURELY TAKE US NOW.'],
      do: (g) => {
        g.qset('converts', 2);
        g.rep('church', 25);
      },
      next: 'hub',
    },
    remotereq: {
      say: (g) => {
        if (g.q('sacredcow') === 2 && g.q('converts') === 2) {
          g.give('remote');
          g.set('gotRemote');
          return ['YOU HAVE BROUGHT THE COW AND THE SOULS. YOU ARE FAITHFUL. MOSTLY. ENOUGH.', 'TAKE THE HOLY REMOTE, CHILD. POINT IT AT THE STUDIO GATE. SAY SOMETHING HOLY. OR DON\'T. IT RUNS ON BATTERIES.'];
        }
        return ['NOT YET, CHILD. THE COW FIRST. THEN THE SOULS. THEN THE REMOTE. THAT IS THE ORDER OF THINGS. IT IS ON THE BULLETIN BOARD.'];
      },
      next: 'hub',
    },
    sermon: {
      say: (g) => {
        if (g.repOf('church') >= 55) {
          g.give('tape_sermon');
          g.set('sermonGiven');
          return ["MY SERMON. 'PROBE ME, LORD.' FOUR HOURS. TWO INTERMISSIONS. THE SAUCERS WILL HEAR IT AND KNOW WE ARE READY.", 'BROADCAST IT TO THE HEAVENS, DALE. LET THEM COME FOR US AT LAST.'];
        }
        return ['MY SERMONS ARE FOR THE CONGREGATION. YOU ARE MORE OF A... VISITOR. A TOURIST OF FAITH.'];
      },
      next: 'hub',
    },
    foil: {
      say: ['HOLY FOIL! YOU UNDERSTAND US, DALE. YOU REALLY DO.'],
      do: (g) => {
        g.set('gaveFoil');
        g.take('tinfoil');
        g.rep('church', 10);
      },
      next: 'hub',
    },
  },

  // ===================================================================== SHERIFF
  sheriff: {
    start: (g) => (g.f('sheriffFree') ? 'free' : g.f('metSheriff') ? 'cell' : 'intro'),
    intro: {
      say: [
        "DALE? THANK THE LORD. OR THE ALIENS. WHOEVER IS IN CHARGE NOW.",
        "I LOCKED MYSELF IN HERE WHEN THE SAUCERS CAME. SAFEST PLACE IN TOWN. THEN I DROPPED THE KEYS. THEN I REALIZED I DROPPED THE KEYS.",
      ],
      do: (g) => {
        g.set('metSheriff');
        if (!g.q('sheriff')) g.qset('sheriff', 1);
      },
      next: 'cell',
    },
    cell: {
      say: (g) => [pick(['GET ME OUT OF HERE, DALE. I HAVE BEEN EATING THE SAME DONUT FOR THREE DAYS.', 'THE BUCKET IS NOT A TOILET. I WANT THAT ON THE RECORD.', 'YOU STILL HERE? GOOD. KEEP BEING HERE.'])],
      choices: [
        { t: 'WHERE ARE THE KEYS?', go: 'keys' },
        { t: 'WHAT HAPPENED TO YOUR GUNS?', go: 'guns', once: 's_guns' },
        { t: 'HANG IN THERE, SHERIFF.' },
      ],
    },
    keys: { say: ["IF I KNEW THAT, DALE, I WOULDN'T BE IN HERE. I LOOKED EVERYWHERE. EXCEPT OUTSIDE THE CELL. FOR OBVIOUS REASONS."], next: 'cell' },
    guns: { say: ['FIRST THING THE ALIENS CONFISCATED. THEN THE DONUTS.', 'THEY GAVE BACK THE DONUTS. SAID THEY TASTED LIKE SADNESS. THEY DO. THAT IS THE APPEAL.'], next: 'cell' },
    freed: {
      say: [
        "FREE! I'M FREE! I'M ALSO STARVING.",
        "THANKS, DALE. HERE. I FOUND THIS IN MY DONUT BOX. ONE OF THEM ALIENS, STEALING MY DONUTS. ON CAMERA. THAT IS WHAT WE IN LAW ENFORCEMENT CALL LEVERAGE.",
        "I'M GONNA GO GUARD THE EVAC BUS. FROM INSIDE. WITH THE DOORS LOCKED.",
      ],
      do: (g) => {
        g.give('photo');
        g.earn(10);
        g.qset('sheriff', 2);
        g.set('sheriffFree');
      },
    },
    free: { say: ['THE SHERIFF IS AT THE EVAC BUS, GUARDING IT FROM INSIDE. HE LEFT A NOTE: GONE FISHING. THERE IS NO WATER.'], who: 'dale' },
  },

  // ===================================================================== GATE WARDEN
  guard: {
    start: () => 'hub',
    hub: {
      say: (g) => [g.f('gateOpen') ? 'THE GATE IS OPEN. DO NOT TOUCH THE CRAFT SERVICES. THE DONUTS ARE COUNTED.' : 'HALT. THIS IS A CLOSED SET. NO TALENT BEYOND THIS POINT WITHOUT A PASS.'],
      choices: [
        { t: 'SHOW THE HOA SET PASS.', if: (g) => g.has('setpass') && !g.f('gateOpen'), go: 'pass' },
        { t: 'SHOW THE STAFF LANYARD.', if: (g) => g.has('lanyard') && !g.f('gateOpen'), go: 'crew' },
        { t: 'HOW ABOUT 40 COUPONS?', if: (g) => !g.f('gateOpen'), go: 'bribe' },
        { t: "WHAT'S BEHIND THE FENCE?", go: 'what', once: 'gd_what' },
        { t: 'NICE HAT.', go: 'hat', once: 'gd_hat' },
        { t: 'NEVER MIND.' },
      ],
    },
    pass: { say: ['AN HOA SET PASS. LAMINATED TWICE. VERY PROFESSIONAL. GO ON THROUGH, EXTRA. HIT YOUR MARKS.'], do: (g) => g.openGate('pass') },
    crew: { say: ["OH! YOU'RE CREW. SORRY, BOSS. GO ON IN. TELL ZORP HE STILL OWES ME A COFFEE."], do: (g) => g.openGate('crew') },
    bribe: {
      say: (g) => {
        if (!g.spend(40)) return ['40 COUPONS. YOU HAVE ' + g.coupons + '. I CAN COUNT. I HAVE SIX HANDS FOR COUNTING.'];
        g.openGate('bribe');
        return ["...I'M SAVING UP FOR A TIMESHARE. ON EARTH. BEFORE IT'S STRUCK. LAST CHANCE, YOU KNOW?", 'FINE. NOBODY SAW ANYTHING. I DEFINITELY DID NOT.'];
      },
    },
    what: { say: ['THE STUDIO. THE TOWER. CRAFT SERVICES. NONE OF IT IS FOR YOU. YOU ARE BACKGROUND. YOU ARE FURNITURE THAT SCREAMS.'], next: 'hub' },
    hat: { say: ['...THANK YOU. NOBODY EVER SAYS THAT. IT IS A REGULATION CAP. I IRON IT.'], do: (g) => g.rep('network', 2), next: 'hub' },
  },

  // ===================================================================== THE EXECUTIVE
  executive: {
    start: () => 'intro',
    intro: {
      say: [
        'WELL, WELL. THE COMIC RELIEF FOUND THE CONTROL ROOM.',
        'DO YOU KNOW HOW MANY PLANETS I HAVE CANCELLED, DALE? FOURTEEN THOUSAND. NOT ONE OF THEM HIJACKED ITS OWN FINALE.',
        'GO ON, THEN. SHOW ME SOMETHING I HAVE NOT SEEN.',
      ],
      choices: [
        { t: "PLAY KEVIN'S TAPE.", if: (g) => g.has('tape_kevin'), do: (g) => g.finale('tape_kevin') },
        { t: 'PLAY THE HOA MEETING TAPE.', if: (g) => g.has('tape_hoa'), do: (g) => g.finale('tape_hoa') },
        { t: "PLAY GLORIA'S SERMON.", if: (g) => g.has('tape_sermon'), do: (g) => g.finale('tape_sermon') },
        { t: 'PLAY SKULL GOAT. LOUD.', if: (g) => g.has('tape_metal'), do: (g) => g.finale('tape_metal') },
        { t: "PLAY ZORP'S PILOT: COWS.", if: (g) => g.has('tape_cow'), do: (g) => g.finale('tape_cow') },
        { t: 'GIVE ME A MINUTE.', if: (g) => !tapes(g).length },
      ],
    },
  },
};

// --- one-liners from the townsfolk on the street ---------------------------------------------------------
export const BARKS = {
  hoa: {
    friendly: ['LOVELY LAWN WEATHER!', 'BRENDA SPEAKS HIGHLY OF YOU. FOR BRENDA.', 'NICE POSTURE TODAY, DALE.', 'KEEP IT BEIGE!'],
    neutral: ['IS THAT CAR REGISTERED WITH THE HOA?', 'THOSE BIKERS ARE A MENACE.', 'MY HYDRANGEAS HAVE BEEN PROBED.', "DON'T STEP ON THE GRASS."],
    hostile: ['YOU! STOP! THAT IS A FINE!', 'VIOLATION! VIOLATION!', 'I HAVE A CLIPBOARD AND I AM NOT AFRAID TO USE IT!', 'WRITING YOU UP!'],
  },
  rats: {
    friendly: ['DALE! MY MAN!', 'BURN IT ALL, BROTHER!', 'NICE WHEELS. STOLEN?', 'ANARCHY HIGH FIVE!'],
    neutral: ["WHAT ARE YOU LOOKING AT?", 'NO COPS IN THE JUNKYARD.', 'HAVE YOU SEEN MY OTHER BOOT?', 'THE HOA FINED MY BIKE. MY BIKE!'],
    hostile: ['GET HIM!', 'THAT IS THE NARC!', 'YOU PICKED THE WRONG JUNKYARD!', 'OI! BRENDA LOVER!'],
  },
  church: {
    friendly: ['BLESSED BE THE PROBE!', 'BROTHER DALE!', 'THE SAUCERS SMILE ON YOU!', 'TAKE US ALL SOON!'],
    neutral: ['HAVE YOU HEARD THE GOOD NEWS? WE ARE GOING TO SPACE.', 'TAKE ME! NOT YOU. ME.', 'THE PROBE PROVIDES.', 'JOIN US. WE HAVE SNACKS.'],
    hostile: ['HERETIC!', 'THE SAUCERS SEE YOU, SINNER!', 'REPENT! OR AT LEAST APOLOGIZE!', 'YOU SCARED OFF A SAUCER! WE SAW!'],
  },
  network: {
    friendly: ['MORNING, CREW.', 'GREAT TAKE TODAY.', 'NICE WORK ON THE RATINGS.', 'CRAFT SERVICES HAS DONUTS.'],
    neutral: ['MOVE ALONG, EXTRA.', 'QUIET ON SET.', 'PERMIT CHECK. JUST KIDDING. OR AM I.', 'YOU ARE BLOCKING THE SHOT.'],
    hostile: ['UNAUTHORIZED TALENT!', 'CURFEW VIOLATION!', 'OFF SCRIPT! OFF SCRIPT!', 'CUT! CUT HIM!'],
  },
};

// What Dale says when he looks at things in town (tap them).
export const LOOK = {
  house_a: ['A TWO-STORY HOUSE. THE LIGHTS ARE ON. NOBODY IS HOME. CLASSIC HORROR MOVIE MOVE.', 'GARY LIVES HERE. GARY WAS PROBED. GARY LEFT THE OVEN ON.'],
  house_b: ['A RANCH HOUSE. SOMEONE PAINTED HELP ON THE ROOF. THE ALIENS WROTE NO UNDER IT.', 'THE DOORMAT SAYS GO AWAY. FIRST HONEST DOORMAT IN TOWN.'],
  house_c: ['A HOUSE. THE CURTAINS TWITCHED. EITHER A NEIGHBOR OR A CRAWLER. BOTH BITE.', 'THERE IS A NOTE ON THE DOOR: BACK IN 5 MINUTES. DATED LAST TUESDAY.'],
  store: ['THE CORNER STORE. LOOTED. THE LOOTERS LEFT A THANK YOU NOTE.', 'THE OPEN SIGN STILL SAYS OPEN. TECHNICALLY TRUE. THE DOOR IS GONE.'],
  gas_station: ['THE GAS STATION. HIGHLY FLAMMABLE. YOU GET IDEAS.', 'GAS IS 9 COUPONS A GALLON. INFLATION IS OUT OF THIS WORLD.'],
  trailer: ['A TRAILER. IT HAS SEEN THINGS. MOSTLY TORNADOES.', 'SOMEONE LIVES HERE. SOMEONE WITH A LOT OF CATS. NONE OF THEM ARE HOME.'],
  water_tower: ['THE WATER TOWER. PINE BLUFF IS PAINTED ON IT. SOMEONE ADDED: WAS HERE.'],
  joshua_tree: ['A JOSHUA TREE. THREE HUNDRED YEARS OLD. IT HAS SEEN WORSE. NOT MUCH WORSE.'],
  saguaro: ['A SAGUARO. IT IS GIVING YOU THE FINGER. TWO FINGERS ACTUALLY.'],
  palm: ['A PALM TREE. IMPORTED. LIKE THE ALIENS.'],
  rocks: ['ROCKS. THE MOST RELIABLE THING IN TOWN.'],
  shrub: ['A SHRUB. IT HAS NO OPINIONS. REFRESHING.'],
  flamingo: ['A PLASTIC FLAMINGO. THE HOA REQUIRES THREE PER LAWN.', 'A PINK FLAMINGO. ITS LEG IS LOOSE. LIKE ITS MORALS.'],
  bin_mailbox: ['A MAILBOX. THE MAIL STILL COMES. THE MAILMAN WAS ABDUCTED. HE STILL COMES.', 'A TRASH BIN. SOMETHING INSIDE IS CHEWING.'],
  hydrant: ['A FIRE HYDRANT. FULL OF WATER AND POTENTIAL.'],
  streetlight: ['A STREETLIGHT. IT FLICKERS IN MORSE CODE. IT SAYS: HELP.'],
  sandbags: ['SANDBAGS. THE ARMY LEFT THEM. AND LEFT.'],
  bus: ['THE EVAC BUS. DROP SURVIVORS HERE. THE DRIVER IS HIDING UNDER THE SEATS. HE SAYS HE IS STILL DRIVING.'],
  tower: ['THE BROADCAST TOWER. A TRILLION SCREENS GET THEIR SIGNAL FROM HERE. IT HUMS IN B FLAT.', 'THE TOWER DOOR HAS A KEYCARD SLOT. AND A POLITE SIGN: NO.'],
  drive_in: ['THE OLD DRIVE-IN. THE NETWORK USES IT AS A MONITOR. YOU CAN SEE YOURSELF ON IT. YOU LOOK TIRED.'],
  net_trailer: ["THE PRODUCTION OFFICE. A SILVER TRAILER. THE DOOR SAYS: ZORP (INTERN). SOMEONE CROSSED OUT ZORP."],
  checkpoint: ['THE STUDIO GATE. A FORCE FIELD AND A BORED ALIEN IN A BOOTH.'],
  pylon: ['A FORCE-FIELD PYLON. IT BUZZES. YOUR FILLINGS BUZZ BACK.'],
  church: ["THE CHURCH OF THE BLESSED PROBE. THE STEEPLE HAS A SAUCER ON IT. THEY'RE NOT SUBTLE."],
  clubhouse: ['THE HOA CLUBHOUSE. PINK. PRISTINE. PASSIVE AGGRESSIVE.'],
  diner: ["MEL'S DINER. NO FIGHTING INSIDE. IT'S THE LAST RULE ANYONE FOLLOWS."],
  motel: ['THE SPACE AGE MOTEL. VACANCIES: ALL OF THEM.', 'THE MOTEL POOL IS EMPTY. THE ICE MACHINE STILL WORKS. PRIORITIES.'],
  saloon: ['THE RUSTY SPUR. THE DESERT RATS BUILT IT OUT OF CARS. SOME OF THE CARS WERE STILL RUNNING.'],
  bunker: ["KEVIN'S BUNKER. IN HIS MOM'S BACKYARD. THE SATELLITE DISHES ARE WRAPPED IN FOIL. SO IS THE CAT."],
  sheriff_office: ["THE SHERIFF'S OFFICE. SOMEONE IS YELLING INSIDE. IT SOUNDS LIKE: DONUTS."],
  billboard_a: ['A BILLBOARD: A SMILING ALIEN AND A COW. THE COW LOOKS NERVOUS. SMART COW.'],
  billboard_b: ['A BILLBOARD WITH A GIANT EYE. SOMEONE DREW A MUSTACHE ON IT. THE EYE SEEMS FINE WITH IT.'],
  burn_barrel: ['A BURN BARREL. WARM. SMELLS LIKE TIRES AND FREEDOM.'],
  barricade: ['A BARRICADE OF TIRES AND SPITE. THE DESERT RATS DECORATED.'],
  phone_booth: ['A PHONE BOOTH. IT STILL WORKS. NOBODY KNOWS WHO PAYS THE BILL.'],
  icecream: ['THE ICE CREAM TRUCK. NOBODY KNOWS WHO DRIVES IT. THE SONG STILL PLAYS AT NIGHT.'],
  porta_potty: ['A PORTA POTTY. DO NOT. JUST DO NOT.', 'A PORTA POTTY. SOMETHING INSIDE IS HUMMING THE NETWORK THEME.'],
  speaker_pole: ['AN ALIEN LOUDSPEAKER. IT ANNOUNCES THINGS. NOBODY LISTENS. VERY HUMAN OF IT.'],
  crashed_ufo: ['A CRASHED SAUCER. THE NETWORK NEVER CAME BACK FOR IT. INSURANCE, PROBABLY.'],
  junk_pile: ['A PILE OF JUNK. OR AS THE RATS CALL IT: THE PANTRY.'],
  gnome: ['A GARDEN GNOME. HE WINKED. GNOMES DO NOT WINK.'],
  landed_ufo: ['A PARKED SAUCER. IT HAS A PARKING TICKET. FROM BRENDA.'],
  car_wreck: ['A BURNED-OUT CAR. IT IS STILL WARM. LIKE A HUG. A BAD HUG.'],
};

export const LOOK_ENEMY = {
  grunt: ['A GRUNT. UNSCRIPTED EXTRA. HE LOOKS LIKE HE HATES HIS JOB.', 'AN ALIEN GRUNT. THE NETWORK CALLS THEM BACKGROUND. THEY BITE IN THE FOREGROUND.'],
  crawler: ['A CRAWLER. FAST. TEETH. NO MANNERS.'],
  spitter: ['A SPITTER. IT SPITS. THE NAME IS VERY LITERAL.'],
  brute: ['A BRUTE. IT EATS CARS. IT HAS TABLE MANNERS FOR CARS ONLY.'],
};

// --- interior scenes ----------------------------------------------------------------------------------
// r = hotspot rect [x0, y0, x1, y1] in fractions of the image. tap(g) = Hidden Folks style reaction.
// use = { itemId: (g) => ... } for items used on the hotspot. chars and items are overlay sprites.
const lines = (arr) => (g, h) => {
  h.n = (h.n || 0) + 1;
  return g.line(arr[(h.n - 1) % arr.length]);
};

export const SCENES = {
  // ----------------------------------------------------------------------------- KEVIN'S BUNKER
  bunker: {
    name: "KEVIN'S BUNKER",
    bg: 'bunker',
    music: 'bunker',
    chars: [{ id: 'kevin', x: 0.57, y: 0.84, h: 0.4 }],
    items: [
      { id: 'beans', x: 0.705, y: 0.33, s: 0.06, if: (g) => !g.f('tookBeans'), take: (g) => (g.set('tookBeans'), g.give('beans'), g.line("YOU TAKE A CAN OF BEANS. KEVIN: THOSE ARE MY END TIMES BEANS! ...KEEP THEM. THESE ARE THE END TIMES.")) },
      { id: 'tinfoil', x: 0.86, y: 0.88, s: 0.07, if: (g) => !g.f('tookFoil'), take: (g) => (g.set('tookFoil'), g.give('tinfoil'), g.line('A ROLL OF TINFOIL. KEVIN HAS 40 MORE. HE BUYS IN BULK. HE BUYS EVERYTHING IN BULK.')) },
    ],
    fx: [
      { t: 'glow', x: 0.85, y: 0.38, r: 0.12, c: 'green', fl: 2 },
      { t: 'static', r: [0.78, 0.31, 0.83, 0.39] },
      { t: 'static', r: [0.85, 0.35, 0.92, 0.42] },
      { t: 'static', r: [0.77, 0.41, 0.82, 0.47] },
      { t: 'glow', x: 0.4, y: 0.55, r: 0.06, c: 'red', fl: 0.5 },
      { t: 'blobs', x: 0.4, y: 0.555 },
      { t: 'glow', x: 0.96, y: 0.42, r: 0.08, c: 'warm', fl: 0.2 },
      { t: 'lights', pts: [[0.7, 0.07], [0.76, 0.1], [0.82, 0.13], [0.88, 0.15], [0.94, 0.19], [0.99, 0.23]] },
      { t: 'motes' },
    ],
    hot: [
      { id: 'board', r: [0.03, 0.1, 0.4, 0.42], name: 'CONSPIRACY BOARD', tap: lines([
        'THE CONSPIRACY BOARD. RED STRING CONNECTS THE MOON LANDING, BIGFOOT, THE HOA AND KEVIN\'S EX-GIRLFRIEND.',
        'A NEWSPAPER CLIPPING: SAUCER SEEN OVER PINE BLUFF. DATED 1997. KEVIN CIRCLED IT 40 TIMES.',
        'A PHOTO OF THE BROADCAST TOWER. KEVIN WROTE: THE BRAIN. UNDERLINED. TWICE. WITH A DIFFERENT PEN EACH TIME.',
        'A MAP OF TOWN. THE STUDIO LOT IS NORTH. THE CRASH SITE IS SOUTH. THE PIZZA PLACE IS CIRCLED. IT CLOSED IN 2011.',
      ]) },
      { id: 'ladder', r: [0.42, 0.0, 0.58, 0.44], name: 'LADDER', exit: true, tap: (g) => g.exitScene() },
      { id: 'dart', r: [0.55, 0.14, 0.62, 0.25], name: 'DARTBOARD', tap: (g) => g.darts() },
      { id: 'alienpic', r: [0.6, 0.09, 0.66, 0.17], name: 'ALIEN PORTRAIT', tap: lines(['A SIGNED PHOTO OF AN ALIEN. IT SAYS: TO KEVIN, STOP WRITING TO US.']) },
      { id: 'shelf', r: [0.63, 0.14, 0.8, 0.48], name: 'SUPPLY SHELF', tap: lines([
        'THREE HUNDRED CANS OF BEANS. KEVIN HAS PLANNED FOR THE APOCALYPSE. HE HAS NOT PLANNED FOR GAS.',
        'PAPER TOWELS, LANTERN OIL, A BOX LABELED EMERGENCY EMERGENCY. IT IS EMPTY.',
      ]) },
      { id: 'clock', r: [0.9, 0.21, 0.96, 0.33], name: 'CAT CLOCK', tap: lines(['A CAT CLOCK. ITS EYES FOLLOW YOU. KEVIN SAYS THEY ARE CAMERAS. KEVIN IS PROBABLY RIGHT.', 'TICK. TOCK. THE TAIL WAGS. THE APOCALYPSE CONTINUES.']) },
      { id: 'monitors', r: [0.76, 0.29, 0.95, 0.5], name: 'MONITORS', tap: lines([
        'GREEN STATIC. WAIT. THERE IS A FACE IN THE STATIC. IT IS YOUR FACE. YOU ARE ON TV.',
        'A NETWORK FEED: A COW, IN SLOW MOTION, WITH DRAMATIC MUSIC. THE RATINGS GRAPH GOES UP.',
        'THE NETWORK LOGO SPINS. A VOICE SAYS: COMING UP NEXT, THE END OF EVERYTHING. STAY TUNED.',
      ]) },
      { id: 'radio', r: [0.84, 0.46, 0.98, 0.6], name: 'HAM RADIO', tap: (g) => g.line(g.radioChatter()) },
      { id: 'lava', r: [0.37, 0.49, 0.43, 0.6], name: 'LAVA LAMP', tap: lines(['A LAVA LAMP. THE BLOBS NEVER TOUCH. KEVIN SAYS THAT IS A METAPHOR. FOR WHAT, HE WON\'T SAY.']) },
      { id: 'pizza', r: [0.2, 0.63, 0.37, 0.73], name: 'PIZZA BOX', tap: lines(['A PIZZA BOX. ONE SLICE LEFT. IT HAS A PULSE.', 'YOU CLOSE THE BOX. SOMETHING INSIDE CLOSES IT BACK.']) },
      { id: 'couch', r: [0.02, 0.43, 0.2, 0.9], name: 'COUCH', tap: lines(['A COUCH WITH A SLEEPING BAG. KEVIN HAS LIVED HERE SINCE 2009. HIS MOM CALLS IT A PHASE.']) },
      { id: 'fridge', r: [0.31, 0.32, 0.43, 0.49], name: 'MINI FRIDGE', tap: lines(['A MINI FRIDGE. MAYONNAISE AND POLAROIDS OF THE SKY. KEVIN, WHY.', "THE FRIDGE MAGNETS SPELL: THEY LIVE. AND: MILK."]) },
      { id: 'crates', r: [0.76, 0.72, 0.93, 0.93], name: 'CRATES', tap: lines(['ARMY SURPLUS CRATES. INSIDE: MORE CRATES. KEVIN BOUGHT THE CRATES FOR THE CRATES.']) },
      { id: 'mom', r: [0.44, 0.0, 0.56, 0.06], name: 'HATCH', hidden: true, tap: lines(["A VOICE FROM UPSTAIRS: KEVIN! IS THAT DALE? TELL DALE HE CAN'T STAY FOR DINNER!"]) },
    ],
    enter: (g) => {
      if (!g.f('metKevin')) g.talk('kevin');
    },
  },

  // ----------------------------------------------------------------------------- MEL'S DINER
  diner: {
    name: "MEL'S DINER",
    bg: 'diner',
    music: 'jukebox',
    chars: [
      { id: 'mel', x: 0.62, y: 0.73, h: 0.38 },
      { id: 'zorp', x: 0.3, y: 0.69, h: 0.36, if: (g) => g.zorpWhere() === 'diner' },
    ],
    items: [
      { id: 'keycard', x: 0.2, y: 0.47, s: 0.05, if: (g) => g.f('zorpEating') && !g.has('keycard') && !g.f('zorpRobbed'), take: (g) => {
        g.give('keycard');
        g.set('zorpRobbed');
        g.rate(5);
        g.line('YOU PALM THE KEYCARD OFF THE TABLE. ZORP IS TOO BUSY WEEPING INTO HIS PIE TO NOTICE. YOU FEEL TERRIBLE. FOR ABOUT A SECOND.');
      } },
    ],
    fx: [
      { t: 'smoke', x: 0.53, y: 0.17, rate: 3 },
      { t: 'glow', x: 0.35, y: 0.25, r: 0.08, c: 'orange', fl: 1.5 },
      { t: 'glow', x: 0.93, y: 0.43, r: 0.07, c: 'warm', fl: 0.2 },
      { t: 'saucer', x: 0.15, y: 0.19 },
      { t: 'motes' },
    ],
    hot: [
      { id: 'jukebox', r: [0.29, 0.16, 0.41, 0.35], name: 'JUKEBOX', tap: (g) => g.jukebox('diner') },
      { id: 'machine', r: [0.5, 0.18, 0.67, 0.33], name: 'COFFEE MACHINE', tap: (g) => g.line(g.f('coffeeFixed') ? 'THE COFFEE MACHINE GURGLES HAPPILY. IT SMELLS LIKE BURNING. MEL SAYS THAT IS THE FLAVOR.' : 'THE COFFEE MACHINE. IT IS SMOKING. NOT IN A COOL WAY. SOMETHING INSIDE IS LOOSE. IT NEEDS TAPE.'),
        use: { toolbox: (g) => {
          g.set('coffeeFixed');
          g.take('toolbox');
          g.sfx('rummage');
          g.rate(2);
          g.line("YOU DUCT TAPE THE COFFEE MACHINE. EVERYWHERE. IT WORKS! MEL: WELL I'LL BE. COFFEE'S BACK ON. TWO COUPONS.");
        } } },
      { id: 'pies', r: [0.85, 0.3, 1.0, 0.56], name: 'PIE CASE', tap: (g) => g.talk('mel', 'pie') },
      { id: 'window', r: [0.0, 0.1, 0.25, 0.4], name: 'WINDOW', tap: lines(['A SAUCER HOVERS OVER THE DESERT. IT HAS BEEN THERE ALL WEEK. MEL CHARGES IT FOR PARKING.', 'THE DESERT. THE SAUCER. A COW WALKING BY WITH DIGNITY.']) },
      { id: 'paper', r: [0.18, 0.46, 0.28, 0.53], name: 'NEWSPAPER', tap: (g) => g.line(g.headline()) },
      { id: 'creamer', r: [0.13, 0.43, 0.2, 0.51], name: 'COW CREAMER', tap: (g, h) => (g.sfx('moo'), lines(['YOU SQUEEZE THE COW CREAMER. IT MOOS. ACTUAL MOO. MEL REFUSES TO TALK ABOUT IT.', 'MOO.'])(g, h)) },
      { id: 'kitchen', r: [0.77, 0.13, 0.92, 0.4], name: 'KITCHEN DOOR', tap: lines(["MEL: NOBODY GOES IN MEL'S KITCHEN. NOT EVEN MEL.", 'SOMETHING IN THE KITCHEN IS SIZZLING. NOBODY IS COOKING.']) },
      { id: 'photo1', r: [0.4, 0.08, 0.49, 0.17], name: 'PHOTO', tap: lines(['A PHOTO OF THE DINER IN 1958. SAME CUSTOMERS. SAME PIE.']) },
      { id: 'sun', r: [0.55, 0.09, 0.62, 0.18], name: 'CLOCK', tap: lines(['A SUNBURST CLOCK. IT IS ALWAYS 4:20 HERE. IT HAS BEEN BROKEN SINCE 1977.']) },
      { id: 'stools', r: [0.35, 0.36, 0.86, 0.68], name: 'STOOLS', tap: (g, h) => (g.sfx('click'), lines(['YOU SPIN A STOOL. WHEEE. MEL STARES AT YOU. YOU STOP.', 'YOU SPIN ANOTHER STOOL. MEL STARES HARDER.', 'YOU SPIN ALL THE STOOLS. MEL SIGHS THE SIGH OF A THOUSAND DINERS.'])(g, h)) },
    ],
    enter: (g) => {
      if (!g.f('metMel')) g.talk('mel');
    },
  },

  // ----------------------------------------------------------------------------- CHURCH
  church: {
    name: 'CHURCH OF THE BLESSED PROBE',
    bg: 'church',
    music: 'organ',
    chars: [{ id: 'gloria', x: 0.5, y: 0.71, h: 0.36 }],
    items: [
      { id: 'remote', x: 0.5, y: 0.405, s: 0.045, if: (g) => !g.f('gotRemote'), take: (g) => g.line('THE HOLY REMOTE SITS ON ITS CUSHION BEHIND GLASS. GLORIA WATCHES YOU LIKE A HAWK. A HOLY HAWK.') },
    ],
    fx: [
      { t: 'glow', x: 0.5, y: 0.25, r: 0.18, c: 'cyan', fl: 0.3 },
      { t: 'candles', pts: [[0.05, 0.33], [0.11, 0.38], [0.38, 0.33], [0.41, 0.41], [0.36, 0.52], [0.62, 0.34], [0.59, 0.4], [0.63, 0.5], [0.67, 0.48], [0.71, 0.43], [0.9, 0.44], [0.94, 0.62], [0.42, 0.71], [0.57, 0.71], [0.42, 0.88], [0.58, 0.88]] },
      { t: 'spin', x: 0.505, y: 0.065 },
      { t: 'motes' },
    ],
    hot: [
      { id: 'glass', r: [0.41, 0.12, 0.59, 0.37], name: 'STAINED GLASS', tap: lines(['A STAINED GLASS WINDOW: A SAUCER BEAMING UP A COW. THE COW LOOKS SERENE. THE COW KNOWS SOMETHING.', 'IN THE CORNER OF THE WINDOW: A TINY GLORIA, WAVING. SHE PAID EXTRA.']) },
      { id: 'case', r: [0.44, 0.36, 0.56, 0.45], name: 'HOLY REMOTE', tap: (g) => (g.has('remote') ? g.line('AN EMPTY VELVET CUSHION. IT STILL HAS A REMOTE-SHAPED DENT. THE CONGREGATION PRAYS TO THE DENT NOW.') : g.talk('gloria', 'remotereq')) },
      { id: 'altar', r: [0.39, 0.45, 0.62, 0.57], name: 'ALTAR', tap: lines(['THE ALTAR. LAVENDER CLOTH, TINFOIL, AND A LITTLE PLASTIC COW. THE OFFERING BOWL HOLDS ONE (1) CANDY BAR.']) },
      { id: 'organ', r: [0.1, 0.24, 0.3, 0.52], name: 'ORGAN', tap: (g, h) => (g.sfx('organ'), lines(['YOU PLAY A CHORD. IT IS EITHER BACH OR THE NETWORK THEME. GLORIA WEEPS WITH JOY.', 'YOU PLAY CHOPSTICKS. A CULTIST FAINTS. IN A GOOD WAY.'])(g, h)) },
      { id: 'theremin', r: [0.11, 0.46, 0.2, 0.6], name: 'THEREMIN', tap: (g, h) => (g.sfx('theremin'), lines(['YOU WAVE YOUR HAND AT THE THEREMIN. WOOOOOO. A SAUCER OUTSIDE BLINKS BACK.', 'WOOOOO-OOOOO. YOU HAVE NEVER FELT MORE LIKE A 1950S MOVIE.'])(g, h)) },
      { id: 'booth', r: [0.74, 0.33, 0.9, 0.59], name: 'CONFESSION BOOTH', tap: (g) => g.confess() },
      { id: 'plate', r: [0.63, 0.49, 0.71, 0.61], name: 'COLLECTION PLATE', tap: (g) => g.collectionPlate() },
      { id: 'pews', r: [0.07, 0.6, 0.41, 0.86], name: 'PEWS', tap: lines(['YOU SIT IN A PEW. YOU FEEL JUDGED BY A HIGHER POWER. IT IS GLORIA.', 'A HYMN BOOK. HYMN 12: SWING LOW, SWEET SAUCER.']) },
      { id: 'pews2', r: [0.6, 0.6, 0.93, 0.86], name: 'PEWS', tap: lines(['SOMEONE CARVED INTO THE PEW: TAKE ME. SOMEONE ELSE CARVED: NO.', 'A FORGOTTEN TINFOIL HAT. SIZE XXL. GLORIA BUYS THEM BIG. FOR THE ANTENNAS.']) },
      { id: 'saucer', r: [0.4, 0.0, 0.61, 0.12], name: 'MODEL SAUCER', tap: (g) => (g.spin = 3, g.line('YOU GIVE THE HANGING SAUCER A SPIN. THE CONGREGATION GASPS. GLORIA: IT IS A SIGN!')) },
      { id: 'painting', r: [0.69, 0.28, 0.76, 0.39], name: 'PAINTING', tap: lines(['A PAINTING OF A SAUCER OVER A DESERT. PAINTED BY GLORIA. SIGNED: GLORIA. TITLED: SOON.']) },
    ],
    enter: (g) => {
      if (!g.f('metGloria')) g.talk('gloria');
    },
  },

  // ----------------------------------------------------------------------------- HOA CLUBHOUSE
  clubhouse: {
    name: 'HOA CLUBHOUSE',
    bg: 'clubhouse',
    music: 'muzak',
    chars: [{ id: 'brenda', x: 0.64, y: 0.6, h: 0.38, if: (g) => !g.brendaAway() }],
    items: [
      { id: 'trophy', x: 0.687, y: 0.2, s: 0.06, if: (g) => !g.f('trophyStolen'), take: (g) => {
        if (!g.brendaAway()) return g.line('YOU REACH FOR THE GOLDEN FLAMINGO. BRENDA CLEARS HER THROAT. LOUDLY. IN A WAY THAT HAS ENDED MARRIAGES.');
        g.set('trophyStolen');
        g.give('trophy');
        g.rate(8);
        g.line('YOU GRAB THE GOLDEN FLAMINGO AND STUFF IT IN YOUR PANTS. IT IS COLD. IT IS JUDGING YOU.');
      } },
    ],
    fx: [
      { t: 'glow', x: 0.95, y: 0.3, r: 0.1, c: 'cyan', fl: 0.4 },
      { t: 'glow', x: 0.69, y: 0.22, r: 0.05, c: 'yellow', fl: 1 },
      { t: 'sparkle', x: 0.69, y: 0.2 },
      { t: 'tv', r: [0.825, 0.335, 0.885, 0.4] },
      { t: 'motes' },
    ],
    hot: [
      { id: 'rules', r: [0.0, 0.08, 0.24, 0.62], name: 'RULES BOARD', tap: (g) => g.line(g.hoaRule()) },
      { id: 'portrait', r: [0.37, 0.05, 0.55, 0.25], name: 'PORTRAIT', tap: lines(['AN OIL PORTRAIT OF BRENDA. COMMISSIONED BY BRENDA. APPROVED BY BRENDA. THE EYES FOLLOW YOU AND ISSUE FINES.', 'THE BRASS PLAQUE SAYS: OUR FOUNDER, OUR LEADER, OUR BRENDA.']) },
      { id: 'desk', r: [0.32, 0.31, 0.6, 0.48], name: 'DESK', tap: lines(['A TIDY DESK. A RUBBER STAMP THAT SAYS DENIED. IT IS WORN DOWN TO THE HANDLE.', 'A FORM: APPLICATION TO BE ABDUCTED. HOA APPROVAL REQUIRED. SEVEN COPIES.']) },
      { id: 'bell', r: [0.52, 0.33, 0.58, 0.38], name: 'DESK BELL', tap: (g, h) => (g.sfx('ding'), lines(['DING. BRENDA: YES? ...DON\'T DO THAT.', 'DING. BRENDA: DALE.', 'DING. BRENDA: I WILL FINE YOU. I WILL FINE YOUR CHILDREN.'])(g, h)) },
      { id: 'trophies', r: [0.62, 0.11, 0.75, 0.44], name: 'TROPHY CABINET', tap: (g) => g.line(g.f('trophyStolen') ? 'THE TROPHY CABINET. THERE IS A FLAMINGO-SHAPED GAP. BRENDA HAS BEEN STARING AT IT FOR HOURS.' : 'THE TROPHY CABINET. BEST LAWN 1995, 1996, 1997... AND THE GOLDEN FLAMINGO. ALL AWARDED BY THE HOA. TO BRENDA. BY BRENDA.') },
      { id: 'tapes', r: [0.77, 0.08, 0.88, 0.46], name: 'TAPE SHELF', tap: lines(['VHS TAPES. HOA MEETING 1994. HOA MEETING 1995. HOA MEETING 1995 (DIRECTOR\'S CUT).', 'ONE TAPE IS LABELED: DO NOT WATCH. ALONE. IT IS THE 2003 BUDGET MEETING.']) },
      { id: 'tv', r: [0.8, 0.29, 0.93, 0.58], name: 'TV', tap: lines(['THE TV PLAYS THE 1999 MEETING. A MAN ASKS ABOUT MAILBOX COLORS. HE IS STILL ASKING. HOUR FOUR.', 'ON THE TV: BRENDA, 25 YEARS YOUNGER, SAYING NO. SOME THINGS NEVER CHANGE.']) },
      { id: 'punch', r: [0.11, 0.4, 0.21, 0.5], name: 'PUNCH BOWL', tap: lines(['THE PUNCH IS PINK. IT IS 90 PERCENT MAYONNAISE. THE OTHER 10 PERCENT IS RULES.']) },
      { id: 'book', r: [0.44, 0.55, 0.56, 0.62], name: 'COFFEE TABLE BOOK', tap: lines(['A COFFEE TABLE BOOK: LAWNS OF DISTINCTION. VOLUME 9. EVERY LAWN IN IT IS BRENDA\'S.']) },
      { id: 'lost', r: [0.81, 0.62, 0.93, 0.77], name: 'LOST AND FOUND', tap: (g) => g.lostAndFound() },
      { id: 'pool', r: [0.9, 0.1, 1.0, 0.5], name: 'POOL', tap: lines(['THE POOL. NOBODY HAS BEEN ALLOWED TO SWIM SINCE 1994. THE SIGN SAYS: NO SPLASHING. NO SWIMMING. NO WATER.']) },
      { id: 'chairs', r: [0.23, 0.56, 0.4, 0.73], name: 'ARMCHAIR', tap: lines(['A PINK ARMCHAIR. THERE IS STILL PLASTIC ON IT. THERE WILL ALWAYS BE PLASTIC ON IT.']) },
    ],
    enter: (g) => {
      if (!g.f('metBrenda') && !g.brendaAway()) g.talk('brenda');
      else if (g.f('trophyStolen') && !g.f('brendaKnowsTrophy') && !g.brendaAway()) g.talk('brenda');
    },
  },

  // ----------------------------------------------------------------------------- RATS SALOON
  saloon: {
    name: 'THE RUSTY SPUR',
    bg: 'saloon',
    music: 'metal',
    chars: [{ id: 'barb', x: 0.57, y: 0.73, h: 0.4 }],
    items: [
      { id: 'gnome', x: 0.48, y: 0.245, s: 0.055, if: (g) => !g.f('tookGerald') && g.q('gerald') !== 2, take: (g) => {
        if (!g.f('geraldFree') && !g.moshing()) return g.line("BARB: TOUCH THE GNOME AND I TOUCH YOUR FACE. (MAYBE SOMETHING COULD DISTRACT THEM. SOMETHING LOUD.)");
        g.set('tookGerald');
        g.give('gnome');
        if (!g.f('geraldFree')) g.rep('rats', -10, true);
        g.rate(4);
        g.line(g.f('geraldFree') ? 'YOU TAKE GERALD OFF THE SHELF. BARB WAVES GOODBYE. GERALD DOES NOT WAVE BACK.' : 'WHILE THE RATS HEADBANG, YOU SNATCH GERALD. NOBODY NOTICES. GERALD NOTICES. GERALD ALWAYS NOTICES.');
      } },
    ],
    fx: [
      { t: 'glow', x: 0.95, y: 0.24, r: 0.07, c: 'blue', fl: 2 },
      { t: 'glow', x: 0.29, y: 0.27, r: 0.08, c: 'orange', fl: 1 },
      { t: 'lights', pts: [[0.03, 0.15], [0.12, 0.1], [0.24, 0.07], [0.36, 0.06], [0.5, 0.06], [0.62, 0.07], [0.74, 0.1], [0.84, 0.12]] },
      { t: 'smoke', x: 0.44, y: 0.6, rate: 0.6 },
      { t: 'glow', x: 0.45, y: 0.65, r: 0.05, c: 'warm', fl: 0.5 },
      { t: 'glow', x: 0.77, y: 0.68, r: 0.05, c: 'warm', fl: 0.5 },
      { t: 'motes' },
    ],
    hot: [
      { id: 'jukebox', r: [0.22, 0.18, 0.36, 0.37], name: 'JUKEBOX', tap: (g) => g.jukebox('saloon') },
      { id: 'dart', r: [0.07, 0.17, 0.17, 0.29], name: 'DARTBOARD', tap: (g) => g.darts() },
      { id: 'moose', r: [0.3, 0.03, 0.5, 0.19], name: 'MOOSE', tap: lines(['A MOOSE HEAD IN A TINFOIL HAT. THE RATS SAY IT IS IRONIC. THE MOOSE DOES NOT SEEM AMUSED.', 'THERE ARE NO MOOSE IN NEVADA. NOBODY KNOWS WHERE IT CAME FROM. THE RATS SAY: FREEDOM.']) },
      { id: 'shelf', r: [0.41, 0.17, 0.55, 0.35], name: 'SHELF', tap: (g) => g.line(g.has('gnome') || g.q('gerald') === 2 ? 'AN EMPTY SHELF. A RANSOM NOTE: GIVE US ANARCHY OR THE GNOME GETS IT. NOBODY PAID.' : 'GERALD THE GNOME SITS ON THE SHELF WITH A RANSOM NOTE: GIVE US ANARCHY OR THE GNOME GETS IT.') },
      { id: 'bike', r: [0.1, 0.3, 0.36, 0.54], name: 'CHOPPER', tap: (g, h) => (g.sfx('engine'), lines(["BARB'S CHOPPER. YOU REV IT. THE WHOLE SALOON TURNS AROUND. YOU STOP REVVING IT.", 'THE TANK HAS FLAMES ON IT. THE FLAMES HAVE SMALLER FLAMES ON THEM.'])(g, h)) },
      { id: 'pool', r: [0.37, 0.36, 0.65, 0.58], name: 'POOL TABLE', tap: (g, h) => (g.sfx('click'), lines(['YOU SINK THE EIGHT BALL ON THE BREAK. NOBODY SAW IT. THIS IS YOUR LIFE.', 'A BIKER: TOUCH MY BALLS AGAIN AND SEE WHAT HAPPENS. ...THE POOL BALLS. HE MEANT THE POOL BALLS.'])(g, h)) },
      { id: 'bar', r: [0.62, 0.26, 0.99, 0.62], name: 'BAR', tap: lines(['THE BAR IS MADE OF CAR HOODS. THE BEER IS MADE OF REGRET.', 'BARB POURS YOU SOMETHING. IT IS GASOLINE. YOU POLITELY PRETEND TO SIP IT.']) },
      { id: 'bottles', r: [0.73, 0.09, 0.93, 0.36], name: 'BOTTLES', tap: lines(['A HUNDRED BOTTLES. ALL THE SAME BRAND: WHATEVER WAS IN THE TRUCK.']) },
      { id: 'crate', r: [0.04, 0.51, 0.2, 0.7], name: 'DYNAMITE CRATE', tap: (g) => g.line(g.has('dynamite') ? 'THE DYNAMITE CRATE. ONE BUNDLE LIGHTER. BARB COUNTED. BARB ALWAYS COUNTS.' : 'A CRATE OF DYNAMITE. PADLOCKED. A HAND-DRAWN SIGN: TOUCH IT AND DIE. THE SKULL IS VERY WELL DRAWN.') },
      { id: 'drums', r: [0.36, 0.62, 0.53, 0.84], name: 'OIL DRUM TABLE', tap: lines(['AN OIL DRUM TABLE. SOMEONE CARVED: BRENDA SUCKS. SOMEONE ELSE ADDED: AT PARKING.']) },
      { id: 'skull', r: [0.73, 0.12, 0.78, 0.18], name: 'SKULL', tap: lines(['A SKULL. PLASTIC. PROBABLY. YOU DO NOT ASK.']) },
    ],
    enter: (g) => {
      if (!g.f('metBarb')) g.talk('barb');
    },
  },

  // ----------------------------------------------------------------------------- PRODUCTION OFFICE
  office: {
    name: 'PRODUCTION OFFICE',
    bg: 'office',
    music: 'office',
    chars: [{ id: 'zorp', x: 0.56, y: 0.72, h: 0.38, if: (g) => g.zorpWhere() === 'office' }],
    items: [
      { id: 'keycard', x: 0.69, y: 0.25, s: 0.05, if: (g) => !g.f('lockerOpen') && !g.has('keycard') && !g.f('usedSpare'), locked: true, take: (g) => g.line('A SPARE KEYCARD BEHIND THE LOCKER GLASS. THE LOCKER HAS A 4-DIGIT KEYPAD.') },
    ],
    fx: [
      { t: 'glow', x: 0.43, y: 0.19, r: 0.1, c: 'cyan', fl: 0.5 },
      { t: 'glow', x: 0.69, y: 0.25, r: 0.08, c: 'violet', fl: 1 },
      { t: 'glow', x: 0.07, y: 0.62, r: 0.08, c: 'green', fl: 1 },
      { t: 'glow', x: 0.8, y: 0.55, r: 0.08, c: 'magenta', fl: 2 },
      { t: 'drip', x: 0.775, y: 0.39 },
      { t: 'motes' },
    ],
    hot: [
      { id: 'board', r: [0.0, 0.15, 0.19, 0.55], name: 'CASTING BOARD', tap: (g, h) => {
        g.set('sawCasting');
        return lines([
          'THE CASTING BOARD. YOUR POLAROID IS HERE. CAPTION: DALE. COMIC RELIEF. DIES IN EPISODE 3. YOU CHECK THE SCHEDULE. IT IS EPISODE 3.',
          'BRENDA: SPEAKING ROLE (ONE WORD). BARB: STUNTS. GLORIA: DO NOT CAST. RESTRAINING ORDER.',
          'A POLAROID OF ZORP HIMSELF: ZORP, INTERN. BORN ROSWELL, 07/04. PLEASE STOP ASKING.',
          'THE COW HAS THREE GOLD STARS AND A NOTE: LEAD? ASK EXECUTIVE.',
        ])(g, h);
      } },
      { id: 'computer', r: [0.35, 0.15, 0.52, 0.25], name: 'COMPUTER', tap: (g) => g.line('THE RATINGS GRAPH. CURRENT RATINGS: ' + Math.round(g.ratings) + '. A STICKY NOTE: IF BELOW 15, ADD PLOT TWIST.') },
      { id: 'desk', r: [0.21, 0.2, 0.6, 0.34], name: 'DESK', tap: lines(['SCRIPTS. THE FINALE IS ONE PAGE: EVERYONE SCREAMS. THEN BROOM.', 'A MEMO: INTERNS ARE NOT TO EAT THE TALENT. AGAIN.', 'A MUG: WORLD\'S OKAYEST INTERN. IT IS FULL OF PURPLE COFFEE.']) },
      { id: 'locker', r: [0.61, 0.09, 0.77, 0.4], name: 'GLASS LOCKER', tap: (g) => {
        g.set('lockerSeen');
        if (g.f('lockerOpen')) return g.line('THE LOCKER IS OPEN AND EMPTY. A STICKY NOTE INSIDE: NOTE TO SELF, CHANGE CODE.');
        if (g.has('keycard')) return g.line('A LOCKED GLASS LOCKER. YOU ALREADY HAVE A KEYCARD. ONE IS ENOUGH. PROBABLY.');
        g.keypad();
      } },
      { id: 'whiteboard', r: [0.83, 0.17, 1.0, 0.55], name: 'WHITEBOARD', tap: lines(['A DRAWING OF EARTH WITH A BIG RED X. UNDERNEATH: STRIKE THE SET - THURSDAY. CATERING - TBD.', 'ALSO ON THE BOARD: A SMILEY FACE. SOMEONE ADDED NINE MOUTHS.']) },
      { id: 'machine', r: [0.73, 0.32, 0.84, 0.47], name: 'COFFEE MACHINE', tap: lines(['AN ALIEN COFFEE MACHINE. IT DRIPS PURPLE. IT SMELLS LIKE BATTERIES AND SADNESS. NO WONDER ZORP WANTS EARTH COFFEE.']) },
      { id: 'snacks', r: [0.72, 0.48, 0.89, 0.64], name: 'CRAFT SERVICES', tap: (g) => g.alienSnack() },
      { id: 'donuts', r: [0.77, 0.6, 0.97, 0.73], name: 'DONUTS', tap: lines(["A BOX OF DONUTS. LABELED: SHERIFF'S. PROPERTY OF EVIDENCE. ZORP HAS BEEN BUSY."]) },
      { id: 'chair', r: [0.29, 0.53, 0.46, 0.78], name: "DIRECTOR'S CHAIR", tap: lines(["YOU SIT IN THE DIRECTOR'S CHAIR. YOU FEEL A SUDDEN URGE TO RUIN A BELOVED FRANCHISE.", 'THE BACK SAYS: THE EXECUTIVE. THE SEAT HAS NINE DENTS.']) },
      { id: 'cans', r: [0.11, 0.37, 0.28, 0.73], name: 'FILM CANS', tap: lines(['FILM CANS: EARTH SEASON 1 TO 70. ONE IS LABELED: BLOOPERS (DINOSAURS).']) },
      { id: 'cooler', r: [0.01, 0.53, 0.14, 0.82], name: 'WATER COOLER', tap: lines(['THE WATER COOLER BUBBLES GREEN. YOU HEAR TWO ALIENS GOSSIPED HERE. ABOUT YOU. YOU ARE TRENDING.']) },
    ],
    enter: (g) => {
      g.set('visitedOffice');
      if (g.zorpWhere() === 'office' && !g.f('metZorp')) g.talk('zorp');
    },
  },

  // ----------------------------------------------------------------------------- SHERIFF'S OFFICE
  sheriff: {
    name: "SHERIFF'S OFFICE",
    bg: 'sheriff',
    music: 'western',
    chars: [{ id: 'sheriff', x: 0.13, y: 0.66, h: 0.4, if: (g) => !g.f('sheriffFree'), bars: true }],
    items: [
      { id: 'keys', x: 0.555, y: 0.565, s: 0.045, if: (g) => !g.f('tookKeys'), take: (g) => {
        g.set('tookKeys');
        g.give('keys');
        g.give('donut', true);
        g.line("YOU LIFT THE LID OF THE DONUT BOX. THE KEYS. RIGHT THERE. UNDER THE DONUTS. WHERE THE SHERIFF ALWAYS LEAVES HIS KEYS. EVERYONE KNOWS THAT. YOU TAKE A DONUT TOO. FOR THE TROUBLE.");
      } },
    ],
    fx: [
      { t: 'fan', x: 0.5, y: 0.1 },
      { t: 'glow', x: 0.79, y: 0.5, r: 0.07, c: 'green', fl: 0.3 },
      { t: 'rays' },
      { t: 'motes' },
    ],
    hot: [
      { id: 'cell', r: [0.0, 0.09, 0.32, 0.7], name: 'JAIL CELL', tap: (g) => (g.f('sheriffFree') ? g.line('AN EMPTY CELL. THE BUCKET IS STILL THERE. NOBODY WILL EVER TOUCH THAT BUCKET.') : g.talk('sheriff')),
        use: { keys: (g) => {
          g.take('keys');
          g.sfx('door');
          g.talk('sheriff', 'freed');
        } } },
      { id: 'posters', r: [0.31, 0.14, 0.53, 0.3], name: 'WANTED POSTERS', tap: (g) => g.line(g.wantedPoster()) },
      { id: 'rack', r: [0.38, 0.26, 0.55, 0.44], name: 'GUN RACK', tap: lines(['AN EMPTY GUN RACK. A NOTE: CONFISCATED BY THE NETWORK. NO GUNS ON SET. HEALTH AND SAFETY.']) },
      { id: 'skull', r: [0.53, 0.07, 0.73, 0.18], name: 'LONGHORN SKULL', tap: lines(['A LONGHORN SKULL. THE SHERIFF SAYS HE WRESTLED THE BULL. THE RECEIPT SAYS GIFT SHOP.']) },
      { id: 'cabinet', r: [0.61, 0.19, 0.73, 0.44], name: 'FILING CABINET', tap: lines(['FILES ON EVERYONE. KEVIN\'S FILE IS 900 PAGES. ALL OF THEM ARE COMPLAINTS FROM KEVIN.', 'YOUR FILE: DALE. DIVORCED. ONE PARKING TICKET. UNPAID. THE TICKET IS FROM 1998.', "BRENDA'S FILE IS SEALED. BY BRENDA."]) },
      { id: 'hat', r: [0.76, 0.18, 0.85, 0.42], name: 'HAT RACK', tap: lines(["THE SHERIFF'S SPARE HAT. YOU TRY IT ON. YOU LOOK LIKE A SHERIFF. A SAD ONE. YOU PUT IT BACK."]) },
      { id: 'desk', r: [0.48, 0.5, 0.89, 0.74], name: 'DESK', tap: lines(['THE SHERIFF\'S DESK. A COFFEE MUG: WORLD\'S OKAYEST SHERIFF. A PATTERN EMERGES IN THIS TOWN.']) },
      { id: 'box', r: [0.51, 0.52, 0.6, 0.62], name: 'DONUT BOX', tap: (g) => g.line(g.f('tookKeys') ? 'THE DONUT BOX. ONE DONUT LEFT. IT LOOKS AT YOU. YOU LOOK AT IT. NOT TODAY.' : 'A PINK DONUT BOX. THE SHERIFF ALWAYS KEEPS SOMETHING UNDER THE DONUTS.') },
      { id: 'radio', r: [0.69, 0.51, 0.8, 0.59], name: 'POLICE RADIO', tap: (g) => g.line(g.radioChatter(true)) },
      { id: 'window', r: [0.9, 0.2, 0.99, 0.53], name: 'WINDOW', tap: lines(['THROUGH THE BLINDS: THE EVAC BUS, A BURNING MAILBOX, AND A COW CROSSING THE STREET AT THE CROSSWALK. GOOD COW.']) },
      { id: 'cactus', r: [0.83, 0.32, 0.88, 0.46], name: 'CACTUS', tap: lines(['A POTTED CACTUS. THE ONLY THING IN TOWN THAT GOT WATERED THIS WEEK.']) },
    ],
    enter: (g) => {
      if (!g.f('metSheriff')) g.talk('sheriff');
    },
  },

  // ----------------------------------------------------------------------------- TOWER CONTROL ROOM
  control: {
    name: 'TOWER CONTROL ROOM',
    bg: 'control',
    music: 'tower',
    chars: [],
    items: [],
    fx: [
      { t: 'eye', x: 0.43, y: 0.21 },
      { t: 'glow', x: 0.47, y: 0.42, r: 0.06, c: 'red', fl: 2 },
      { t: 'glow', x: 0.42, y: 0.56, r: 0.07, c: 'cyan', fl: 1 },
      { t: 'blink', pts: [[0.3, 0.47], [0.33, 0.5], [0.36, 0.46], [0.6, 0.45], [0.63, 0.47], [0.68, 0.52], [0.54, 0.56], [0.58, 0.58], [0.62, 0.6], [0.05, 0.35], [0.07, 0.42], [0.04, 0.47]] },
      { t: 'motes' },
    ],
    hot: [
      { id: 'screen', r: [0.15, 0.1, 0.6, 0.33], name: 'GIANT SCREEN', tap: (g) => (g.f('power') ? g.talk('executive') : g.line('A GIANT DARK SCREEN. YOUR REFLECTION LOOKS BACK. IT LOOKS LIKE IT NEEDS A NAP.')) },
      { id: 'deck', r: [0.34, 0.51, 0.5, 0.62], name: 'TAPE DECK', tap: (g) => g.line(g.f('power') ? 'THE TAPE DECK GLOWS. IT WANTS A TAPE. USE A TAPE ON IT.' : 'THE TAPE DECK IS DEAD. EVERYTHING IS DEAD. THE CONSOLE NEEDS POWER.'),
        use: { tape_kevin: (g) => g.deck('tape_kevin'), tape_hoa: (g) => g.deck('tape_hoa'), tape_sermon: (g) => g.deck('tape_sermon'), tape_metal: (g) => g.deck('tape_metal'), tape_cow: (g) => g.deck('tape_cow') } },
      { id: 'console', r: [0.25, 0.38, 0.76, 0.7], name: 'CONSOLE', tap: (g) => g.line(g.f('power') ? 'THE CONSOLE HUMS. A THOUSAND BUTTONS. ONE OF THEM IS LABELED, IN ENGLISH: DO NOT.' : 'THE CONSOLE IS DARK. THERE IS AN EMPTY GLOWING SOCKET SHAPED LIKE A POWER CELL.'),
        use: { fuse: (g) => g.powerUp() } },
      { id: 'button', r: [0.43, 0.35, 0.53, 0.47], name: 'BIG RED BUTTON', tap: lines(['A BIG RED BUTTON UNDER GLASS. A STICKER SAYS: SELF DESTRUCT (PLANET). YOU LEAVE IT ALONE. FOR NOW.', 'YOU TAP THE GLASS. THE BUTTON SEEMS TO WANT IT. YOU DO NOT GIVE IT WHAT IT WANTS.']) },
      { id: 'window', r: [0.7, 0.08, 0.96, 0.45], name: 'WINDOW', tap: lines(['PINE BLUFF AT NIGHT. FROM UP HERE IT LOOKS PEACEFUL. FROM UP HERE YOU CAN NOT HEAR THE SCREAMING.']) },
      { id: 'plant', r: [0.6, 0.24, 0.71, 0.42], name: 'OFFICE PLANT', tap: lines(['AN ALIEN OFFICE PLANT. IT TURNS TO LOOK AT YOU. IT IS ALSO ON THE PAYROLL.']) },
      { id: 'reel', r: [0.0, 0.2, 0.11, 0.55], name: 'TAPE MACHINE', tap: lines(['A REEL-TO-REEL LABELED: EARTH, FINAL CUT. THE REEL IS EMPTY. THEY HAVEN\'T SHOT IT YET. THEY\'RE SHOOTING IT NOW. ON YOU.']) },
    ],
    enter: (g) => g.enterControl(),
  },
};

// --- endings -----------------------------------------------------------------------------------------
export const ENDINGS = {
  tape_kevin: {
    title: 'THE TRUTH WAS OUT THERE',
    art: 'end_kevin',
    lines: [
      'THE NETWORK BROADCAST NINE HOURS OF KEVIN EXPLAINING CHEMTRAILS TO A TRILLION SCREENS.',
      'THE ALIENS WATCHED ALL OF IT. THEN THEY BELIEVED ALL OF IT.',
      'THE FLEET LEFT TO INVESTIGATE THEIR OWN GOVERNMENT. THEY ARE STILL INVESTIGATING.',
      'EARTH IS FREE. KEVIN WILL NEVER, EVER SHUT UP ABOUT IT.',
    ],
  },
  tape_hoa: {
    title: 'PROPERTY VALUES RESTORED',
    art: 'end_hoa',
    lines: [
      'SIX HOURS OF MAILBOX COLORS. HALFWAY THROUGH, THE EXECUTIVE CANCELLED THE CANCELLATION JUST TO MAKE IT STOP.',
      'THE NETWORK SIGNED A PEACE TREATY. BRENDA DRAFTED IT. IT IS 900 PAGES. IT HAS A SECTION ON LAWNS.',
      'BRENDA IS NOW SUPREME LEADER OF EARTH. ALL MAILBOXES ARE BEIGE.',
      'YOU ARE SAFE. YOU ARE ALSO BEING FINED. FOREVER.',
    ],
  },
  tape_sermon: {
    title: 'THE RAPTURE (SORT OF)',
    art: 'end_church',
    lines: [
      "THE SAUCERS HEARD GLORIA'S SERMON. FOUR HOURS. TWO INTERMISSIONS. THEY WERE MOVED. MOSTLY TO TEARS.",
      'THEY FINALLY TOOK THE CHURCH. ALL OF IT. GLORIA WAVED THE WHOLE WAY UP.',
      'THE NETWORK GOT ITS FINALE: A CULT ASCENDING IN SLOW MOTION. SEVENTEEN EMMYS. THE REST OF EARTH WAS QUIETLY RENEWED.',
      'THE CHURCH LEFT A FIVE STAR REVIEW. THE REST OF US GOT THEIR PARKING SPACES.',
    ],
  },
  tape_metal: {
    title: 'ANARCHY IN THE U.S.A.',
    art: 'end_metal',
    lines: [
      'SKULL GOAT, LIVE AT THE DUMP, REACHED A TRILLION SCREENS AT VOLUME ELEVEN.',
      'ALIEN EARS ARE NOT BUILT FOR THE GUITAR SOLO. THE FLEET FLED THE SOLAR SYSTEM WITH THEIR TENTACLES OVER THEIR EARS.',
      'BIG BARB RUNS PINE BLUFF NOW. THERE ARE NO RULES. THERE IS NO HOA. THERE IS ALSO NO DENTIST.',
      'BRENDA HAS FILED A COMPLAINT. BARB SET IT ON FIRE. THIS IS FINE.',
    ],
  },
  tape_cow: {
    title: 'RENEWED FOR SEASON 2',
    art: 'end_cow',
    lines: [
      "NINETY MINUTES OF COWS. ZORP'S PILOT BROKE THE RATINGS. THEN IT BROKE THE RATINGS OF THE RATINGS.",
      'THE EXECUTIVE CRIED WITH ALL NINE MOUTHS. EARTH WAS RENEWED FOR A SECOND SEASON.',
      'THE COWS ARE THE LEADS NOW. HUMANS ARE RECURRING GUEST STARS. ZORP GOT PROMOTED TO INTERN, SECOND CLASS.',
      'IT WAS ALWAYS ABOUT THE COWS. KEVIN SAYS HE KNEW. KEVIN DID NOT KNOW.',
    ],
  },
};
export const ENDING_IDS = Object.keys(ENDINGS);

// Epilogue lines based on how Dale got along with everybody.
export function epilogue(g) {
  const out = [];
  const r = (f) => g.repOf(f);
  out.push(r('hoa') >= 25 ? 'THE HOA NAMED A CUL-DE-SAC AFTER YOU. IT IS BEIGE.' : r('hoa') <= -25 ? 'THE HOA HAS SENT YOU A FINE FOR ' + Math.max(1, Math.round(g.damage / 1000)) + ',000 COUPONS. IT IS LAMINATED.' : 'THE HOA STILL DOES NOT KNOW YOUR NAME. THEY CALL YOU: NUMBER 12.');
  out.push(r('rats') >= 25 ? 'THE DESERT RATS PAINTED YOUR FACE ON A JUNK PILE. IT IS AN HONOR. IT IS ALSO ON FIRE.' : r('rats') <= -25 ? 'THE DESERT RATS STILL WANT TO PUNCH YOU. IT IS ON THEIR CALENDAR.' : 'THE DESERT RATS ARE INDIFFERENT. FROM THEM, THAT IS ALMOST LOVE.');
  out.push(r('church') >= 25 ? 'THE CHURCH WROTE A HYMN ABOUT YOU. IT RHYMES DALE WITH HOLY GRAIL. BARELY.' : r('church') <= -25 ? 'THE CHURCH PRAYS FOR YOU. AGGRESSIVELY. OUTSIDE YOUR WINDOW.' : 'THE CHURCH LEFT A PAMPHLET IN YOUR MAILBOX. AND IN YOUR CAR. AND IN YOUR SHOE.');
  out.push(r('network') >= 25 ? 'THE NETWORK OFFERED YOU A SPIN-OFF. YOU DECLINED. THEY MADE IT ANYWAY. IT IS ABOUT YOUR LAWN.' : r('network') <= -25 ? 'THE NETWORK HAS BANNED YOU FROM 14,000 PLANETS. YOU WERE NOT PLANNING TO GO.' : 'THE NETWORK LISTED YOU IN THE CREDITS AS: GUY 3.');
  out.push(g.rescued > 0 ? 'YOU SAVED ' + g.rescued + ' PEOPLE. ' + (g.rescued > 10 ? 'THEY THROW YOU A PARADE EVERY TUESDAY.' : 'THEY SEND A CARD EVERY CHRISTMAS. IT IS ALWAYS A COUPON.') : 'YOU SAVED NOBODY. BUT YOU SAVED EVERYBODY. TECHNICALLY. IT COUNTS.');
  return out;
}
