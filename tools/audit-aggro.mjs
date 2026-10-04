// Hostility and cooling-off audit for the lanes.
//
//   node tools/audit-aggro.mjs
//
// Who is shooting at the captain, and for how long. The answer used to be
// "everyone, forever": a raider that once took against you hunted you across the
// system for the rest of its life, a patrol opened fire for another flag's
// quarrel, and every few seconds of lane rolled a fresh ambush. None of that
// needs a browser — the rules are two tables and three timers — so they are run
// here against a stub universe and pinned down, including the AI side, which is
// driven for a simulated minute and a half to see whether it actually bites.
import { Universe, AGGRO_SPEC } from '../src/game/universe.js';
import { AIController } from '../src/game/ai.js';

let bad = 0;
let checks = 0;
const fail = (msg) => {
  console.log('BAD', msg);
  bad++;
};
const check = (ok, msg) => {
  checks += 1;
  if (!ok) fail(msg);
};

/** A universe with nothing in it but the rules under test. */
function makeUniverse(over = {}) {
  const u = Object.create(Universe.prototype);
  u.time = 0;
  u.freefire = over.freefire ?? false;
  u.ships = over.ships || [];
  u.player = over.player || { isPlayer: true, alive: true, x: 0, z: 0, hull: 120, stats: { hull: 120 } };
  u.state = {
    day: over.day ?? 5,
    xp: 0,
    credits: 0,
    skills: {},
    grudge: { ...(over.grudge || {}) },
    rep: { free: 0, vigil: 0, combine: 0, reaver: 0, kreth: 0, ...(over.rep || {}) },
    cargoUsed: () => over.cargo || 0,
    fleet: [],
  };
  u.system = { id: 'haven', gov: 'free', danger: { pirates: 0.3 }, ...(over.system || {}) };
  return u;
}

/** A hull in the lanes, with exactly the fields the rules read. */
const hull = (over = {}) => ({
  alive: true,
  isPlayer: false,
  role: 'pirate',
  faction: 'reaver',
  name: 'Audit Raider',
  x: 0, z: 0, heading: 0, speed: 0, vx: 0, vz: 0,
  hull: 120, stats: { hull: 120 },
  weapons: ['pulse'],
  surrendered: false, disabled: false,
  hunting: false, aggroed: false, despawn: false,
  ...over,
});

/* ---- a clean hull is left alone ---- */
{
  const u = makeUniverse();
  const traffic = [
    ['pirate', 'reaver'], ['pirate', 'free'], ['navy', 'vigil'], ['navy', 'combine'],
    ['house', 'kreth'], ['trader', 'free'], ['trader', 'combine'], ['transit', 'free'], ['courier', 'free'],
  ];
  for (const [role, faction] of traffic) {
    check(!u.npcHostileToPlayer(hull({ role, faction })),
      `a clean ${role} of the ${faction} opens fire on the captain with nothing against them`);
  }
}

/* ---- but a flag's books are still a flag's books ---- */
{
  const u = makeUniverse({ rep: { vigil: -80 } });
  check(u.npcHostileToPlayer(hull({ role: 'navy', faction: 'vigil' })),
    'a Vigil patrol ignores −80 standing with the Vigil');
  check(!u.npcHostileToPlayer(hull({ role: 'navy', faction: 'combine' })),
    'a Combine patrol opens fire for the Vigil’s quarrel, not its own books');

  const c = makeUniverse({ rep: { combine: -80 } });
  check(c.npcHostileToPlayer(hull({ role: 'navy', faction: 'combine' })),
    'a Combine patrol ignores −80 standing with the Combine');
  check(!c.npcHostileToPlayer(hull({ role: 'navy', faction: 'vigil' })),
    'a Vigil patrol opens fire for the Combine’s quarrel, not its own books');
  check(!c.npcHostileToPlayer(hull({ role: 'house', faction: 'kreth' })),
    'the Houses open fire over Combine standings');
}

/* ---- what the captain has done is still remembered ---- */
{
  const u = makeUniverse();
  check(u.npcHostileToPlayer(hull({ hunting: true })), 'a hull on the hunt is not treated as hostile');
  check(u.npcHostileToPlayer(hull({ aggroed: true })), 'a hull with its guns out is not treated as hostile');
  check(!u.npcHostileToPlayer(hull()), 'a hull with nothing against the captain is treated as hostile');

  u.noteGrudge('vigil');
  check(u.grudgeActive('vigil'), 'a fresh grudge is not held at all');
  check(u.npcHostileToPlayer(hull({ role: 'navy', faction: 'vigil' })), 'a held grudge does not put a patrol on the captain');
  u.state.day = 6;
  check(u.grudgeActive('vigil'), 'a grudge is dropped before the captain has made a warp');
  u.state.day = 7;
  check(!u.grudgeActive('vigil'), 'a grudge is held forever');

  const f = makeUniverse({ freefire: true });
  check(f.npcHostileToPlayer(hull({ role: 'trader' })), 'free-fire space is not free-fire');
  check(!f.npcHostileToPlayer(hull({ role: 'escort' })), 'free-fire space turns on the captain’s own wing');
}

/* ---- raiders cool off ---- */
{
  const u = makeUniverse();
  const near = hull({ hunting: true, aggroed: true, x: 900 });
  const far = hull({
    hunting: true, aggroed: true, x: AGGRO_SPEC.breakOff + 600,
    ai: { witnessed: {}, fleeing: true, state: 'flee' },
  });
  u.ships = [near, far];
  const dt = 1 / 60;
  for (let i = 0; i < 60 * (AGGRO_SPEC.cool - 2); i++) u._updateAggro(dt);
  check(far.hunting, 'a raider loses interest while the captain is still in the fight with it');
  check(near.hunting, 'a raider in the fight was talked out of it');

  for (let i = 0; i < 60 * 4; i++) u._updateAggro(dt);
  check(!far.hunting && !far.aggroed, 'a raider hunts the captain for the rest of its life');
  check(far.ai.witnessed === null, 'a hull that stood down still has the fight in its log');
  check(!far.ai.fleeing && far.ai.state !== 'flee', 'a hull that stood down is still running');
  check(near.hunting && near.aggroed, 'a raider standing off the captain cooled off as well');

  // ...but closing again puts it back on the hunt, and the clock starts over
  far.hunting = true;
  far.aggroed = true;
  far.x = 500;
  for (let i = 0; i < 60 * 5; i++) u._updateAggro(dt);
  check(far.hunting, 'a raider that closes on the captain forgets the fight it was in');

  // a hull that breaks off, comes back and breaks off again cools down twice
  far.x = AGGRO_SPEC.breakOff + 600;
  for (let i = 0; i < 60 * (AGGRO_SPEC.cool + 1); i++) u._updateAggro(dt);
  check(!far.hunting, 'a raider that has already stood down once cannot stand down again');
}

/* ---- the lanes only have so much violence in them ---- */
{
  const u = makeUniverse();
  check(u.ambushReady(), 'the lanes start with an ambush already owed');
  u.noteAmbush();
  check(!u.ambushReady(), 'an ambush does not spend the lanes’ temper');
  u.time += AGGRO_SPEC.ambushGap - 1;
  check(!u.ambushReady(), 'the lanes spring ambushes inside the gap they are meant to keep');
  u.time += 2;
  check(u.ambushReady(), 'the lanes never let another ambush happen');

  const core = makeUniverse({ system: { gov: 'vigil', danger: { pirates: 0.1 } } });
  const deep = makeUniverse({ system: { gov: 'reaver', danger: { pirates: 0.9 } } });
  const a = core.pirateInterest();
  const b = deep.pirateInterest();
  check(a < 0.12, `a patrolled core draws an unprovoked ambush on ${(a * 100).toFixed(0)}% of passes`);
  check(b > a, 'the deep lanes are no more dangerous than a patrolled core');
  check(b <= 0.45 + 1e-9, `the wildest lane ambushes on ${(b * 100).toFixed(0)}% of passes`);
}

/* ---- and the AI honours it ---- */
{
  const u = makeUniverse();
  let ready = false;
  let ambushes = 0;
  u.ambushReady = () => ready;
  u.noteAmbush = () => {
    ambushes += 1;
    ready = false;
  };
  u.pirateInterest = () => 1; // this raider has made up its mind; the lanes have not
  u.grudgeActive = () => false;
  u.findHostileTarget = () => null;
  u.isHostile = () => false;

  const run = (raider, seconds) => {
    const ai = new AIController(raider, { role: 'pirate', universe: u, home: { x: 0, z: 0 } });
    raider.ai = ai;
    for (let i = 0; i < 60 * seconds; i++) {
      u.time += 1 / 60;
      ai.update(1 / 60);
    }
    return raider;
  };

  const spent = run(hull({ x: 800 }), 90);
  check(!spent.hunting, 'a raider hunts the captain while the lanes are spent');

  ready = true;
  const keen = run(hull({ x: 800 }), 60);
  check(keen.hunting, 'a raider never takes its chance with the captain in reach and the lanes ready');
  check(ambushes === 1, 'a hunt that begins does not spend the lanes’ temper');

  ready = true;
  const distant = run(hull({ x: 3000 }), 90);
  check(!distant.hunting, 'a raider hunts the captain from outside its own eyesight');
}

console.log(`lanes: ${checks} checks  bad: ${bad}`);
process.exit(bad ? 1 : 0);
