// ---------------------------------------------------------------------------
// The Vector Challenge — the lanes' oldest holo-sim circuit. Every port with a
// bar keeps a rig, and every rig runs the same wire-and-phosphor arena. The
// sim flies the pilots' real hulls, rebuilt as glowing vector models so a
// freighter reads like a freighter even in green lines.
//
// Two cards on the machine:
//   Duel     — three pilots, last one flying takes the purse.
//   Harvest  — two minutes on the crystal field, most crystals wins.
//   Chute Run — four pilots down a spiralling tube of wire: gates, ramps,
//               squeezes and splits with two ways through, plus burst plates
//               and a gun that costs a rival its thrust rather than its hull.
//
// The field is a planet. Not a plate with a horizon painted on it — a whole
// orb: hulls sit on the surface, nose along a great circle, and fly right
// around it. There is no edge, so there is nothing to wrap and nowhere to
// hide behind. The orb varies with the bracket: a wide one gives the long
// game room to breathe, a tight one turns every pass into a knife fight with
// the horizon in the way.
//
// The field fights modern: hills the hulls ride over, straight walls that
// stop shots and bounce hulls, launch ramps that throw you clean over the
// walls when you cross them fast — and item pads, the circuit's one mercy.
// A pad hands out a burst of drive, a rapid-fire rig or a shield, and the
// other pilots take them too. Weapons are the ones in your bay: the sim reads
// your mounts and flies them, and fits its own pilots to match the bracket.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { buildShip } from '../core/meshes.js';
import { glowSprite } from '../core/fx.js';
import { SHIP_BY_ID, SHIPS } from '../data/ships.js';
import { WEAPON_BY_ID } from '../data/weapons.js';
import { computeStats } from './state.js';
import { playerTier } from './missions.js';
import { audio } from '../core/audio.js';
import { rngOf } from '../core/rng.js';
import { clamp } from '../core/util.js';
import { el, btn, clear } from '../ui/dom.js';

// The circuit's orbs, widest first. Bracket intensity picks one: the tighter
// the orb, the more of the field is in someone's way. They are big worlds on
// purpose — a wide orb and a high chase rig are what let a pilot see a rival
// coming, and a fight you can see coming is a fight you can fly. Every distance
// in the sim that is not a hull's own size is measured against the orb, so a
// wider world is a longer race and a longer chase rather than a bigger empty
// one (see `reach`).
const ORBS = [
  { name: 'THE PLAIN', r: 3200, note: 'a wide one — long runs, clear shots' },
  { name: 'BASIN', r: 2700, note: 'steady ground and room to turn' },
  { name: 'MARBLE', r: 2200, note: 'no long shots left on this one' },
  { name: 'PEBBLE', r: 1800, note: 'tight — the horizon is always in the way' },
];
// The course is a patch of the orb, not the whole of it. Every barrier, mound,
// ramp, pad and crystal sits inside this patch. The rest of the world is
// deliberately open: the furniture you cannot see is furniture you cannot use,
// and a course scattered over a whole planet is just empty ground with the odd
// pyramid in it.
const ZONE_FRAC = 0.72;
const ZONE_MIN = 900;
const ZONE_MAX = 2400;
export const ZONE_COUNTS = { pyramids: 30, bars: 16, mounds: 10, ramps: 6, pads: 14, crystals: 26 };
/** How much of an orb a match's course covers — the one rule for its size. */
export function courseRadius(orbR) {
  return clamp(orbR * ZONE_FRAC, ZONE_MIN, ZONE_MAX);
}

// ---------------------------------------------------------------------------
// The chute — the circuit's other discipline. A spiralling tube of wire and
// phosphor wound through open space, wide enough for four hulls and long enough
// to be a race rather than a sprint. Nothing out here is shot down: a bolt up
// the chute costs a rival the thrust it needed for the next ramp, and the
// ramps are where a race is won. Everything about the chute is measured from
// its own centre line, so a longer track is a longer race rather than a bigger
// empty one — and every one of these figures is checked by the vector audit.
// ---------------------------------------------------------------------------
const CHUTE = {
  baseR: 700,      // radius of the spiral at the first gate
  openR: 1500,     // and at the last — the chute unwinds as it climbs
  turns: 1.6,      // how many times it winds around its own axis
  rise: 0.14,      // how far it climbs per unit of track
  // the space the track is wound through is not a tidy machine. It breathes,
  // wanders and lifts, seeded per race, so no two chutes are the same shape and
  // a pilot cannot fly one from memory.
  wobbleR: [120, 260], wobbleLen: [1500, 2300],   // the spiral's radius breathes…
  driftA: [0.22, 0.46], driftLen: [2200, 3400],   // …the winding rate swings…
  liftA: [70, 170], liftLen: [1500, 2400],        // …and the climb rolls over hills
  halfW: 60,       // how wide the chute is either side of the centre line
  halfH: 40,       // and how tall
  hullSide: 15,    // half a hull, for working out where the wall is
  turn: 92,        // units a second a pilot can slide across the chute
  // The power lever. A pilot winds the drive on and off with W and S, and the
  // drive chases the setting — so speed is something to fly rather than
  // something that happens, and a corner can be taken at the speed it wants.
  leverUp: 1.8,    // how fast the lever winds on…
  leverDown: 2.8,  // …and off
  accel: 340,      // how hard the drive pulls toward the setting…
  decel: 460,      // …and how hard it comes off it (braking is always stronger)
  rivalTop: 1,     // the field can match the commander's ceiling…
  rivalFall: 0.002, // …and each grid slot back is that much slower
  gridLever: 0.35, // where the commander's lever sits on the line
  ringEvery: 70,   // a wireframe rib every this many units
  chevEvery: 210,  // and a chevron painted on the road every this many
  gateEvery: 1300, // a gate to pass every this many units
  gateFirst: 900,  // the first gate, after the run-up
  length: 8400,    // the base length of a race
  perTier: 700,    // plus a little more for every bracket
  // features are laid down in sequence, with clear track between them, so no
  // two of them can ever land on each other
  featureFirst: 1100,
  featureGap: 330, // clear road between features — room to set up and settle
  tailClear: 900,
  rampLen: 240,    // how long a launch ramp is
  rampRise: 26,    // and how high it lifts a hull
  rampMin: 150,    // the speed a hull needs before the ramp will throw it
  gapBase: 106,    // the gap after a ramp…
  gapPerTier: 3,   // …and how much wider it gets per bracket, kept well inside
                   // what a hull at rampMin can actually clear
  forkLen: 780,    // how long a split runs
  forkMouth: 150,  // how long the island's nose takes to open
  islandHalf: 16,  // half-width of the divider island
  islandH: 56,     // and how tall it stands out of the road
  pinchLen: 620,   // a squeeze down to…
  pinchScale: 0.72, // …this much of the road
  pinchEase: 120,  // eased in and out so the walls never step
  riftMax: 2,      // at most this many lane rifts in a race
  padCount: 3,     // burst plates in a run
  padSpacing: 95,  // and how far apart they sit
  padR: 26,        // how close a hull must pass to take one
  padRespawn: 6,   // seconds before a taken plate comes back — short, so the
                   // traffic behind gets its share rather than losing the whole
                   // track to whoever is in front
  padHover: 12,    // how high a plate rides off the road
  rivalLook: 880,  // how far up the road a rival spots a pickup and goes for it
  stars: 9,        // stars along the track, the turbo tank's refill
  starTop: 0.22,   // how much of the tank one star puts back — enough to matter,
                   // not enough to run away with: the field takes stars too
  air: 215,        // the launch a ramp gives — the orb's ramps use the same
  gravity: 430,    // and the same pull back down
  rivals: 5,       // six fly: the commander and five
  daze: 1.5,       // seconds of drive a hit costs
  dazeCut: 0.4,    // and how much of the top speed goes with it
  spoilGuard: 3.4, // and how long a hull is left alone after being spoiled
  hitSpan: 26,     // how close a bolt has to pass to a hull to count
  rivalGunRange: 520, // how far up the road a rival bothers to shoot
  rivalTrigger: 1.6,  // and how long it waits between goes
  gridGap: 42,     // how far apart the grid starts, hull to hull
  camBack: 98,
  camUp: 22,
  camLook: 150,
  callTime: 300,   // the rig calls the race after this long
};
const CHUTE_COLORS = [0xff6b7a, 0xffb45c, 0x8fd0ff, 0xc792ff, 0x7dffa8, 0xffe66b];
// What a burst plate hands out: drive, rapid fire, or a field ward that keeps
// the other lanes' guns off a hull for a while.
const CHUTE_PAD_KINDS = ['burst', 'rapid', 'ward', 'star'];
const CHUTE_PAD_NAMES = { burst: 'DRIVE BURST', rapid: 'RAPID FIRE', ward: 'FIELD WARD', star: 'STAR — TURBO' };
const CHUTE_PAD_COLORS = { burst: 0xffb45c, rapid: 0x8fd0ff, ward: 0xc792ff, star: 0xffe66b };
const CHUTE_PAD_CSS = { burst: '#ffb45c', rapid: '#8fd0ff', ward: '#c792ff', star: '#ffe66b' };
/** The centre of one lane of a split, in the track's lateral coordinates. */
const laneCentre = (fork, side) => side * (CHUTE.islandHalf + (fork.halfW - CHUTE.islandHalf) * 0.5);
// Past this much of the course radius the field takes the helm. It only ever
// turns a stray hull back toward the middle of the course — it never stops one,
// and there is no wall to be pinned on, so nobody can get stuck on it. Without
// it a long chase wanders the whole orb and ends up over ground with nothing on
// it, which is the same empty world by another road.
const ZONE_RECALL = 1.35;
const RECALL_TURN = 2.6; // rad/s of correction at the edge of the projection
const RECALL_GAIN = 1.6; // and how much harder it pulls further out than that
// Two pieces of course keep at least a hull's width of daylight between them: a
// corridor a pilot can fly down rather than a crack to be wedged into. 44 is a
// hull (28 across) plus the daylight the collision leaves behind a contact.
const COURSE_CLEAR = 44;
// How far behind and above the hull the rig rides, and how far ahead it aims.
// Height and the aim point are what buy the long view — the height sets how far
// away the horizon is, and looking further ahead puts more of it on screen. The
// rig scales with the world it is flying over (see CAM_REF_ORB), so a wider orb
// reads as more ground rather than as a smaller ship.
const CAM_BACK = 135;
const CAM_UP = 165;
const CAM_LOOK = 120;
const CAM_AIM_H = 16;   // how high off the surface the rig aims
const CAM_REF_ORB = 2100; // the orb these figures were drawn for
// The turbo reserve. Every hull carries one and it is the pilot's to spend: hold
// SHIFT and the drive pushes past its governor for as long as the tank lasts,
// then it comes back. A chase is then something a pilot can win or lose rather
// than a race between two identical ships, and a corner can be taken faster than
// the hull would otherwise stand. The figures are the lanes' own engine burst,
// so the same hand works the same way in both seats.
const TURBO = { duration: 3.4, recharge: 8, rearm: 0.35 };
const TURBO_SPEED = 330;   // what the governor allows while it burns
const TURBO_ACCEL = 340;   // and the shove of thrust that gets the hull there
/** The chute's own ceiling, with the lever wide open and nothing burning. */
const CHUTE_TOP_SPEED = 250;
/** The chute's figures, for the audit to measure a track against. */
export const CHUTE_SPEC = { ...CHUTE, topSpeed: CHUTE_TOP_SPEED, turboSpeed: TURBO_SPEED };
// The sim normalises every hull to the same length so a freighter reads like a
// freighter; this is that length, sized so a rival is a shape rather than a dot
// at the ranges this field is fought over.
const HULL_LEN = 30;
const PLAYER_COLOR = 0x6effa8;
const AI_COLORS = [0xff6b7a, 0xffb45c, 0x8fd0ff, 0xc792ff];
const CRYSTAL_COLOR = 0x5cffd8;
const PAD_COLOR = 0xffe66b;
const HARVEST_TIME = 120;     // seconds per harvest match
const CALLSIGNS = ['MIRA', 'KESTREL', 'OCHRE', 'SABLE', 'JUNO', 'PIKE', 'TALON', 'VIGO'];

const MODE_INFO = {
  duel: {
    name: 'Duel',
    line: 'Three pilots, one field. Last pilot flying takes the purse.',
  },
  harvest: {
    name: 'Harvest',
    line: 'Two minutes over the crystal field. Most crystals when the clock runs out.',
  },
  chute: {
    name: 'Chute Run',
    line: 'Six pilots down the spiral. Gates to pass, splits to pick, stars for the turbo tank — and a gun to spoil someone else\'s line.',
  },
};

const PICKUP_KINDS = ['burst', 'rapid', 'shield'];
const PICKUP_NAMES = { burst: 'DRIVE BURST', rapid: 'RAPID FIRE', shield: 'SHIELD' };
// the world wants numeric colors, the HUD pop-out wants CSS strings
const PICKUP_COLORS = { burst: 0xffb45c, rapid: 0x8fd0ff, shield: 0xc792ff };
const PICKUP_CSS = { burst: '#ffb45c', rapid: '#8fd0ff', shield: '#c792ff' };
const cssHex = (n) => `#${n.toString(16).padStart(6, '0')}`;
/** A point in the chute's cross-section: `side` across the track, `up` above it. */
const cornerOf = (centre, frame, side, up) => centre.clone()
  .addScaledVector(frame.side, side)
  .addScaledVector(frame.up, up);

// The rig's own drawer of guns, bracket by bracket. Every one of them is a real
// weapon off the same charts the shipyards use, so a bracket-four rival is
// carrying something you could bolt to your own wing.
const AI_WEAPONS = [
  ['needler', 'flechette', 'pulse'],
  ['pulse', 'twinpulse', 'ripper', 'dart', 'snare'],
  ['sunbeam', 'flenser', 'carver', 'harpoon', 'ion'],
  ['gauss', 'hellbore', 'torpedo', 'spike', 'breach'],
];
const HULL = 100;      // what everyone flies in with
const SIM_DMG = 0.85;  // the charts are balanced for shield-and-hull fights
// Damage per second is the one chart figure the sim cannot take literally. The
// charts price a torpedo's reach and a disruptor's shut-down into their damage,
// so straight off the page a snare fit does five points a second where a gauss
// does thirty-four — a duel you cannot win with the guns you actually own. The
// sim pulls every gun toward the middle of that spread instead: the ordering
// survives, so do the reach and the cadence and the feel, and no fit is a
// pea-shooter. Heavy ordnance is also capped per hit, so no two bolts in one
// volley can take a pilot from untouched to out.
const SIM_DPS_REF = 24;    // the middle of the charts' damage-per-second spread
const SIM_DPS_CURVE = 0.3; // how hard a chart dps is pulled toward that middle
const SIM_HIT_CAP = HULL * 0.45;

// a shot looks like what it is
const SHOT_COLOR = {
  laser: 0x9fffcf, kinetic: 0xffe0a8, beam: 0x8fd0ff, missile: 0xff9a6b, disruptor: 0xc792ff,
};
// beams have no muzzle speed of their own — they are a ray, so the sim flies
// them fast and thin instead
const BEAM_SPEED = 1150;

/**
 * A weapon as the sim flies it. Same damage, same cadence, same reach as the
 * real thing; the only translation is that a wireframe hull has 100 points of
 * structure and a real one has shields, and that the charts' damage-per-second
 * spread is pulled in toward the middle of itself (see SIM_DPS_REF).
 *
 * `reach` is the orb the match is flown on, as a multiple of the world these
 * figures were drawn on. Everything the sim does at range — where a rival
 * decides to shoot, how tight a lead it flies, how far a bolt carries — is
 * measured against the world, so the guns are too: without it a wide orb's
 * rivals shoot from outside their own weapons' range and the field reads as a
 * place where nothing can be hit.
 */
export function simWeapon(def, reach = 1) {
  const beam = def.kind === 'beam';
  const speed = def.speed || BEAM_SPEED;
  const cd = Math.max(0.08, def.cooldown || 0.3);
  const chart = (def.dmg || 6) / cd;
  const dps = SIM_DMG * SIM_DPS_REF * Math.pow(chart / SIM_DPS_REF, SIM_DPS_CURVE);
  const range = (def.range || 700) * reach;
  return {
    id: def.id,
    name: def.name,
    kind: def.kind,
    dmg: Math.min(dps * cd, SIM_HIT_CAP),
    speed,
    cd,
    range,
    life: range / speed,
    spread: beam ? 0 : (def.spread || 0),
    turn: def.turn || 0,
    // the gun's own colour off the chart, so a rack of mixed weapons reads as
    // a rack of mixed weapons
    color: def.color || SHOT_COLOR[def.kind] || 0x9fffcf,
  };
}

/** Fold an angle into -π..π, so a turn takes the short way round. */
const roundAng = (a) => {
  let b = a;
  while (b > Math.PI) b -= Math.PI * 2;
  while (b < -Math.PI) b += Math.PI * 2;
  return b;
};

/**
 * The sim's ground: a wire globe rather than a wire square. Latitude rings and
 * meridians, drawn as plain line segments so the orb reads as a sphere from any
 * angle — which is the whole point of flying one.
 */
function orbGrid(radius, rings, meridians, segs) {
  const pts = [];
  const seg = (x0, y0, z0, x1, y1, z1) => {
    pts.push(x0, y0, z0, x1, y1, z1);
  };
  // latitude rings
  for (let i = 1; i < rings; i++) {
    const lat = (i / rings) * Math.PI - Math.PI / 2;
    const c = Math.cos(lat) * radius;
    const y = Math.sin(lat) * radius;
    for (let j = 0; j < segs; j++) {
      const t0 = (j / segs) * Math.PI * 2;
      const t1 = ((j + 1) / segs) * Math.PI * 2;
      seg(Math.cos(t0) * c, y, Math.sin(t0) * c, Math.cos(t1) * c, y, Math.sin(t1) * c);
    }
  }
  // meridians
  for (let i = 0; i < meridians; i++) {
    const t = (i / meridians) * Math.PI;
    const ct = Math.cos(t);
    const st = Math.sin(t);
    for (let j = 0; j < segs; j++) {
      const p0 = (j / segs) * Math.PI * 2;
      const p1 = ((j + 1) / segs) * Math.PI * 2;
      seg(Math.sin(p0) * ct * radius, Math.cos(p0) * radius, Math.sin(p0) * st * radius,
        Math.sin(p1) * ct * radius, Math.cos(p1) * radius, Math.sin(p1) * st * radius);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
  return geo;
}

/** The bracket the rig will run for this commander, unless one is given. */
export function challengeTier(state, intensity = null) {
  return clamp(Math.round(intensity ?? playerTier(state)), 1, 8);
}

/** Which orb a bracket is flown on: the sharper the board, the tighter the rock. */
export function orbForTier(tier) {
  const t = clamp(Math.round(tier || 1), 1, 8);
  return ORBS[clamp(Math.floor((t - 1) / 2), 0, ORBS.length - 1)];
}

/** Classic wire look: dark fill, bright phosphor edges, engine glows kept. */
function vectorize(group, colorHex) {
  const fill = new THREE.MeshBasicMaterial({
    color: 0x0b111a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false,
  });
  const wire = new THREE.LineBasicMaterial({
    color: colorHex, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  group.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    n.material = fill;
    n.add(new THREE.LineSegments(new THREE.EdgesGeometry(n.geometry, 24), wire));
  });
}

export class VectorChallenge {
  constructor({ host, state, autoMode = null, intensity = null, onFinish = null, onQuit = null }) {
    this.host = host;
    this.state = state;
    this.onFinish = onFinish;
    this.onQuit = onQuit;
    this.rec = state.vector || { played: 0, wins: 0, best: 0, champion: null };

    this.rng = rngOf(state.worldSeed, 'vector', Date.now() % 100000);
    this.shipId = state.shipId || 'wayfarer';
    this.commander = state.commander || 'Commander';
    this.shipName = state.shipName || SHIP_BY_ID[this.shipId]?.name || 'Cutter';

    // The bracket the rig will run. A commander who has grown into harder
    // boards gets a harder sim — which on this circuit means a smaller orb to
    // do it on, and pilots who have grown into better guns.
    this.tier = challengeTier(state, intensity);
    this.orb = orbForTier(this.tier);
    this.orbR = this.orb.r;
    // Where the course lies on this orb, and how much of the world it covers.
    // startMatch picks the spot; nothing is built before it does.
    this.zone = null;
    // Firing and circling ranges are tuned on an 820 orb; on a bigger world they
    // have to reach further, or the sim fights in the same little patch of it.
    this.reach = this.orbR / 820;
    // the chute is measured in its own units, so the guns fly at their chart
    // range out there rather than an orb's idea of it
    this.simReach = this.reach;
    this.chute = null; // the race track, while one is being flown
    // and the rig rides higher on a bigger world, so the extra ground is ground
    // a pilot can see rather than a horizon further away
    const cam = Math.sqrt(this.orbR / CAM_REF_ORB);
    this.camBack = CAM_BACK * cam;
    this.camUp = CAM_UP * cam;
    this.camLook = CAM_LOOK * cam;

    this.match = null;
    this.pilots = [];
    this.shots = [];
    this.crystals = [];
    this.pickups = [];
    this._rivalRows = [];     // the board's rival readouts, rebuilt per match
    this._flyers = [];        // hulls in the air this frame, gathered once
    this._callsigns = [...CALLSIGNS];
    this._mv = new THREE.Vector3();
    this.terrain = [];        // three.js objects rebuilt per match
    this.walls = [];          // solid barriers
    this.mounds = [];         // elevation bumps
    this.ramps = [];          // launch ramps
    this.t = 0;
    this._last = performance.now();
    this._keys = new Set();
    this._done = false;
    if (typeof window !== 'undefined') window.__vec = this; // dev peek

    this._buildDom();
    this._buildScene();
    this._bindKeys();
    this._resize();
    window.addEventListener('resize', this._onResize);
    this._raf = requestAnimationFrame(this._tick);

    if (autoMode) this.startMatch(autoMode);
    else this._showLobby();
  }

  /* ------------------------------------------------------------------ */
  /* DOM                                                                */
  /* ------------------------------------------------------------------ */

  _buildDom() {
    this.wrap = el('div', { class: 'vec-overlay' }, [
      (this.canvas = el('canvas', { class: 'vec-canvas' })),
      el('div', { class: 'vec-scan' }),
      el('div', { class: 'vec-title' }, [
        el('span', { class: 'vec-title-main', text: 'VECTOR CHALLENGE' }),
        el('span', { class: 'vec-title-sub', text: 'holo-sim · est. before the charts were honest' }),
      ]),
      (this.hud = el('div', { class: 'vec-hud hidden' }, [
        el('span', { class: 'vh-mode' }),
        el('span', { class: 'vh-score' }),
        el('span', { class: 'vh-hull' }),
        el('span', { class: 'vh-clock' }),
        (this._hudTurbo = el('span', { class: 'vh-turbo' })),
        (this.pop = el('span', { class: 'vh-pop' })),
      ])),
      (this._board = el('div', { class: 'vec-board hidden' })),
      (this._markers = el('div', { class: 'vec-markers hidden' })),
      (this.gauges = el('div', { class: 'vec-gauges hidden' }, [
        (this._leverRow = el('div', { class: 'vg-row' }, [
          el('span', { class: 'vg-label', text: 'POWER' }),
          (this._leverFill = el('i')),
        ])),
        el('div', { class: 'vg-row turbo' }, [
          el('span', { class: 'vg-label', text: 'TURBO' }),
          (this._turboFill = el('i')),
        ]),
        (this._gaugeNote = el('div', { class: 'vg-note' })),
      ])),
      (this.lobby = el('div', { class: 'vec-lobby hidden' })),
      (this.over = el('div', { class: 'vec-over hidden' })),
    ]);
    this.host.append(this.wrap);
    this._hudScore = this.wrap.querySelector('.vh-score');
    this._hudHull = this.wrap.querySelector('.vh-hull');
    this._hudClock = this.wrap.querySelector('.vh-clock');
  }

  _pop(text, color = '#fff1a8') {
    this.pop.textContent = text;
    this.pop.style.color = color;
    this.pop.classList.add('on');
    window.clearTimeout(this._popTimer);
    this._popTimer = window.setTimeout(() => this.pop.classList.remove('on'), 1600);
  }

  _showLobby() {
    clear(this.lobby);
    const shipDef = SHIP_BY_ID[this.shipId] || SHIP_BY_ID.wayfarer;
    const wins = this.rec.wins || 0;
    this.lobby.append(el('div', { class: 'vec-panel' }, [
      el('h2', { text: 'The Vector Challenge' }),
      el('p', { class: 'note', text: 'Every port with a bar keeps a rig older than half the hulls outside. The sim reads your registry and flies your own ship — wire and phosphor, like the old pilots ran it. Three to a field; winners take the pot.' }),
      el('div', { class: 'vec-lobby-grid' }, [
        el('div', { class: 'vec-stat' }, [
          el('span', { class: 'vs-label', text: 'Your rig' }),
          el('span', { class: 'vs-value', text: this.shipName }),
          el('span', { class: 'vs-note', text: `${shipDef.cls} · flown as it sits in the bay` }),
        ]),
        el('div', { class: 'vec-stat' }, [
          el('span', { class: 'vs-label', text: 'The orb' }),
          el('span', { class: 'vs-value', text: `${this.orb.name} · bracket ${this.tier}` }),
          el('span', { class: 'vs-note', text: this.orb.note }),
        ]),
        el('div', { class: 'vec-stat' }, [
          el('span', { class: 'vs-label', text: 'The chute' }),
          el('span', { class: 'vs-value', text: `Chute Run · bracket ${this.tier}` }),
          el('span', { class: 'vs-note', text: this._chuteRead() }),
        ]),
        el('div', { class: 'vec-stat' }, [
          el('span', { class: 'vs-label', text: 'Circuit record' }),
          el('span', { class: 'vs-value', text: `${wins} win${wins === 1 ? '' : 's'} · best ${this.rec.best || 0}` }),
          el('span', { class: 'vs-note', text: this.rec.champion ? `champion: ${this.rec.champion}` : 'no champion yet' }),
        ]),
      ]),
      el('div', { class: 'vec-mode-btns' }, [
        btn('Duel — three pilots, last one flying', () => this.startMatch('duel'), 'btn primary'),
        btn('Harvest — two minutes on the crystal field', () => this.startMatch('harvest'), 'btn primary'),
        btn(`Chute Run — six pilots down the spiral`, () => this.startMatch('chute'), 'btn primary'),
      ]),
      el('p', { class: 'vec-keys' }, [
        'W/S work the power lever · A/D yaw · SPACE fire · SHIFT burns the turbo reserve · ESC step out. ',
        'The rig lays its course on one patch of the orb, so the ground you can see is the ground you are flying over; leave it and the field turns you back. ',
        'It carries hills, walls and launch ramps; cross a ramp fast and the field throws you over the walls. ',
        'Item pads hand out drive bursts, rapid fire and shields. ',
        'In the chute there is no ground at all: six pilots race a winding tube of wire that breathes and lifts as it goes, with gates to pass, ramps to jump, squeezes where the road pulls in and splits where it opens out around a divider — two ways through, and no way back across once the nose has passed. W and S work the power lever: hold a speed through a squeeze, feather it over a ramp, open it right up on the straights. SHIFT burns the turbo tank, the bar at the bottom of the screen shows what is in it, and stars strung along the road top it back up — the field flies the same hulls you do, so the tank and the stars are the whole margin. And a hit up the chute costs a rival its thrust rather than its hull. ',
        'You fly the fit in your bay, mount for mount, and the bracket fits its own pilots to match.',
      ]),
      btn('Step out', () => this.quit(), 'btn ghost'),
    ]));
    this.hud.classList.add('hidden');
    this._board.classList.add('hidden');
    this._markers.classList.add('hidden');
    this.gauges.classList.add('hidden');
    this.lobby.classList.remove('hidden');
    this.over.classList.add('hidden');
  }

  _showResults(result) {
    clear(this.over);
    const r = this.rec;
    const place = ['', 'first', 'second', 'third'][result.place] || `${result.place}th`;
    this.over.append(el('div', { class: 'vec-panel' }, [
      el('h2', { text: result.forfeit ? 'You stepped out' : result.place === 1 ? 'The field is yours' : `You took ${place}` }),
      el('p', { class: 'note', text: result.note }),
      el('div', { class: 'vec-lobby-grid' }, [
        el('div', { class: 'vec-stat' }, [
          el('span', { class: 'vs-label', text: result.mode === 'chute' ? 'Time' : 'Score' }),
          el('span', { class: 'vs-value', text: result.mode === 'chute' ? `${(result.timeSec || 0).toFixed(1)}s` : String(result.score) }),
          el('span', { class: 'vs-note', text: result.mode === 'chute' ? `${this.chute ? this.chute.gates.length : 0} gates · ${this.pilots.length} flying` : `circuit best: ${Math.max(r.best || 0, result.score)}` }),
        ]),
        el('div', { class: 'vec-stat' }, [
          el('span', { class: 'vs-label', text: 'Payout' }),
          el('span', { class: 'vs-value', text: `₡${result.payout.toLocaleString()} · +${result.xp} XP` }),
          el('span', { class: 'vs-note', text: result.forfeit ? 'the circuit pays nothing for a walk' : result.place === 1 ? 'the meetup marks the win' : 'the desk pays consolation' }),
        ]),
      ]),
      el('div', { class: 'vec-mode-btns' }, [
        btn('Run another', () => this.startMatch(this._lastMode), 'btn primary'),
        btn('Step out', () => this.quit(), 'btn ghost'),
      ]),
    ]));
    this.hud.classList.add('hidden');
    this._board.classList.add('hidden');
    this._markers.classList.add('hidden');
    this.gauges.classList.add('hidden');
    this.lobby.classList.add('hidden');
    this.over.classList.remove('hidden');
  }

  /* ------------------------------------------------------------------ */
  /* Scene                                                              */
  /* ------------------------------------------------------------------ */

  _buildScene() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: false, stencil: false });
    this.renderer.setClearColor(0x020408);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 1, 30000);
    this.camera.position.set(0, 60, -140);
    this.camera.up.set(0, 1, 0);

    // stars all around — the sim never lets you forget it is night
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(420 * 3);
    for (let i = 0; i < 420; i++) {
      const a = this.rng.float(0, 1) * Math.PI * 2;
      const y = this.rng.float(-1, 1);
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const d = 9000 + this.rng.float(0, 1) * 8000;
      starPos[i * 3] = Math.cos(a) * r * d;
      starPos[i * 3 + 1] = y * d;
      starPos[i * 3 + 2] = Math.sin(a) * r * d;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0x3a5f8a, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0.8,
    })));

    // the orb itself: a smooth shell, with the sim's wire globe drawn over it
    this.orbGroup = new THREE.Group();
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(this.orbR, 128, 64),
      new THREE.MeshBasicMaterial({ color: 0x061310, transparent: true, opacity: 0.92 }),
    );
    this.orbGroup.add(shell);
    this.orbGroup.add(new THREE.LineSegments(
      orbGrid(this.orbR * 1.0008, 18, 12, 96),
      new THREE.LineBasicMaterial({ color: 0x1c6b46, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending }),
    ));
    this.scene.add(this.orbGroup);

    // shot pool: one mesh per shot, reused forever. Geometry is swapped for
    // the loosed weapon's own shape — a railgun slug is not a missile.
    this.shotGeos = {
      laser: new THREE.BoxGeometry(1.6, 1.6, 5),
      kinetic: new THREE.BoxGeometry(2.2, 2.2, 4),
      beam: new THREE.BoxGeometry(1.1, 1.1, 16),
      missile: new THREE.OctahedronGeometry(2.4),
      disruptor: new THREE.TetrahedronGeometry(2.6),
    };
    this.shotPool = [];
    for (let i = 0; i < 64; i++) {
      const mesh = new THREE.Mesh(this.shotGeos.laser, new THREE.MeshBasicMaterial({
        transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      mesh.visible = false;
      this.scene.add(mesh);
      this.shotPool.push(mesh);
    }

    // burst pool for hits, deaths and pickups
    this.burstPool = [];
    for (let i = 0; i < 26; i++) {
      const spr = glowSprite(0xffffff, 30);
      spr.visible = false;
      this.scene.add(spr);
      this.burstPool.push({ spr, t: 0, vx: 0, vy: 0, vz: 0, max: 0.5 });
    }
  }

  /** A burst of light at a world position — the sim's only explosion. */
  _burstAt(pos, color, size = 1) {
    const b = this.burstPool.find((p) => p.t <= 0) || this.burstPool[0];
    b.t = 0.45;
    b.max = 0.45;
    b.spr.material.color.setHex(color);
    b.spr.material.opacity = 0.9;
    b.spr.visible = true;
    b.spr.position.copy(pos);
    b.spr.scale.setScalar(26 * size);
    audio.boom(0.35 * size);
  }

  _spawnBurst(u, height, color, size = 1) {
    this._burstAt(this._pointAt(u, height, this._w1), color, size);
  }

  /* ------------------------------------------------------------------ */
  /* The orb                                                            */
  /* ------------------------------------------------------------------ */

  // Scratch vectors for the per-frame sphere maths. Anything that hands a
  // result back to a caller uses one of the four outer slots so an inner
  // helper can never stomp the value it is about to return.
  _s1 = new THREE.Vector3();
  _s2 = new THREE.Vector3();
  _s3 = new THREE.Vector3();
  _s4 = new THREE.Vector3();
  // kept clear of every other scratch: a swept shot reads these across a walk
  _s5 = new THREE.Vector3();
  _s6 = new THREE.Vector3();
  _w1 = new THREE.Vector3();
  _w2 = new THREE.Vector3();
  _w3 = new THREE.Vector3();
  _w4 = new THREE.Vector3();
  _w5 = new THREE.Vector3();
  // the chute's own scratch: two points, a spare, and the frame it flies in
  _c1 = new THREE.Vector3();
  _c2 = new THREE.Vector3();
  _c3 = new THREE.Vector3();
  _c4 = new THREE.Vector3();
  _c5 = new THREE.Vector3();
  _c6 = new THREE.Vector3();
  _cFrame = { t: new THREE.Vector3(), side: new THREE.Vector3(), up: new THREE.Vector3() };
  _cUp = new THREE.Vector3(0, 1, 0);
  _p2 = new THREE.Vector2();
  _q1 = new THREE.Quaternion();
  _mat = new THREE.Matrix4();
  _col = new THREE.Color();
  _col2 = new THREE.Color();

  /** A random direction — a random point on the orb. */
  _scatter(out) {
    const y = this.rng.float(-1, 1);
    const a = this.rng.float(0, 1) * Math.PI * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    return out.set(Math.cos(a) * r, y, Math.sin(a) * r);
  }

  /** How far apart two directions are, along the surface. */
  _arc(a, b) {
    return this.orbR * Math.acos(clamp(a.dot(b), -1, 1));
  }

  /**
   * Did the arc from `from` to `to` pass within `r` of `point`? A bolt covers
   * more ground in one frame than a hull is wide — and more again when the two
   * are closing on each other — so asking only where the shot ended up would
   * let a good shot fly straight through its target.
   */
  _sweptHit(from, to, point, r) {
    const steps = Math.max(1, Math.ceil(this._arc(from, to) / 8));
    for (let i = 1; i <= steps; i++) {
      this._s6.copy(from).lerp(to, i / steps).normalize();
      if (this._arc(this._s6, point) < r) return true;
    }
    return false;
  }

  /**
   * Walk a hull `dist` along the surface: rotate its up and its heading about
   * the axis running across both. That is a great circle, so a hull that keeps
   * flying straight comes back to where it started.
   */
  _advance(u, fwd, dist) {
    if (!dist) return;
    const axis = this._s1.crossVectors(u, fwd);
    if (axis.lengthSq() < 1e-9) return;
    axis.normalize();
    this._q1.setFromAxisAngle(axis, dist / this.orbR);
    u.applyQuaternion(this._q1);
    fwd.applyQuaternion(this._q1);
  }

  /** Turn a heading about the local up. Port is positive — the way the helm reads. */
  _turn(fwd, u, angle) {
    if (angle) fwd.applyAxisAngle(u, angle);
  }

  /**
   * Where something sits relative to a hull's nose: 0 dead ahead, positive to
   * port, in radians. This is the sim's version of the lanes' heading maths.
   */
  _bearing(u, fwd, target) {
    const rel = this._s2.copy(target).addScaledVector(u, -target.dot(u));
    if (rel.lengthSq() < 1e-12) return 0;
    this._s3.crossVectors(u, fwd); // the port-side tangent
    return Math.atan2(rel.dot(this._s3), rel.dot(fwd));
  }

  /** A heading `angle` to port of the current one. */
  _headingAt(u, fwd, angle, out) {
    return out.copy(fwd).applyAxisAngle(u, angle).normalize();
  }

  /** Some heading at `u`, picked at random. */
  _randomHeading(u, out) {
    this._scatter(this._s4);
    out.copy(this._s4).addScaledVector(u, -this._s4.dot(u));
    if (out.lengthSq() < 1e-9) out.copy(this._s3.crossVectors(u, this._s4.set(0, 1, 0)));
    return out.normalize();
  }

  /** A random direction within `maxArc` of another — a spot on the same patch. */
  _scatterNear(centre, maxArc, out) {
    const dir = this._randomHeading(centre, this._w1);
    out.copy(centre);
    // square root keeps the spread even across the patch rather than crowded
    // around the middle of it
    this._advance(out, dir, Math.sqrt(this.rng.float(0, 1)) * maxArc);
    return out;
  }

  /** A direction `dist` ahead of a hull — where its nose is pointing. */
  _ahead(u, fwd, dist, out) {
    const axis = this._s1.crossVectors(u, fwd);
    if (axis.lengthSq() < 1e-9) return out.copy(u);
    axis.normalize();
    return out.copy(u).applyAxisAngle(axis, dist / this.orbR);
  }

  /** Point an object's nose along a heading, its roof on the local vertical. */
  _seatDir(obj, u, fwd) {
    const z = this._w4.copy(fwd).normalize();
    const y = this._w5.copy(u);
    const x = this._s1.crossVectors(y, z).normalize();
    obj.quaternion.setFromRotationMatrix(this._mat.makeBasis(x, y, z));
  }

  /** Where something standing `height` above the surface sits in the world. */
  _pointAt(u, height, out) {
    return out.copy(u).multiplyScalar(this.orbR + height);
  }

  /**
   * A barrier's own tangent frame, and the point on the orb it stands on. The
   * local 2D maths the field has always used runs in here, so a slab is still
   * a rectangle — it just lives on a curved world.
   */
  _frameAt(u, roll = 0, t1 = new THREE.Vector3(), t2 = new THREE.Vector3()) {
    // any tangent will do to start, then roll the pair around the up
    t1.set(0, 1, 0);
    if (Math.abs(u.y) > 0.9) t1.set(1, 0, 0);
    t2.crossVectors(u, t1).normalize();
    t1.crossVectors(t2, u).normalize();
    if (roll) {
      t1.applyAxisAngle(u, roll).normalize();
      t2.crossVectors(u, t1).normalize();
    }
    return [t1, t2];
  }

  /** World-space 2D coordinates of `u` inside a barrier's frame, in orb units. */
  _localTo(frame, u, out) {
    const rel = this._s4.copy(u).addScaledVector(frame.u, -u.dot(frame.u));
    return out.set(rel.dot(frame.t1) * this.orbR, rel.dot(frame.t2) * this.orbR);
  }

  /** The tangent heading that points from a barrier's frame back at the world. */
  _frameDir(frame, lx, lz, out) {
    return out.copy(frame.t1).multiplyScalar(lx).addScaledVector(frame.t2, lz).normalize();
  }

  /* ------------------------------------------------------------------ */
  /* Terrain                                                            */
  /* ------------------------------------------------------------------ */

  /** Height of the field under a direction on the orb. Hulls hover six above it. */
  groundAt(u) {
    const l = this._p2;
    let h = 0;
    for (const b of this.mounds) {
      this._localTo(b, u, l);
      const d2 = l.x * l.x + l.y * l.y;
      if (d2 < b.r2) h += b.h * Math.exp(-d2 / b.r2);
    }
    for (const r of this.ramps) {
      this._localTo(r, u, l);
      if (l.x > -r.l && l.x < r.l && l.y > -r.w && l.y < r.w) {
        h += r.rise * clamp((l.x + r.l) / (r.l * 2), 0, 1); // 0 → 1 along the ramp
      }
    }
    return h;
  }

  /** A launch the pilot can take right now — 0 when there is no ramp here. */
  launchAt(u, speed) {
    const l = this._p2;
    for (const r of this.ramps) {
      this._localTo(r, u, l);
      if (l.x > -r.l && l.x < r.l && l.y > -r.w && l.y < r.w && speed > r.minSpeed) {
        return r.vy;
      }
    }
    return 0;
  }

  /**
   * Stand an object on the orb at a direction, local +Y outward and (when the
   * object cares) local +X along `t1`.
   */
  _seat(obj, u, t1 = null) {
    obj.position.copy(u).multiplyScalar(this.orbR);
    const x = t1 ? t1.clone().normalize() : this._frameAt(u)[0];
    const y = u.clone();
    const z = new THREE.Vector3().crossVectors(x, y).normalize();
    const x2 = new THREE.Vector3().crossVectors(y, z).normalize();
    obj.quaternion.setFromRotationMatrix(this._mat.makeBasis(x2, y, z));
  }

  /** The field: hills, straight walls, pyramids and launch ramps, all on the orb. */
  _buildTerrain() {
    this.terrain = [];
    this.walls = [];
    this.mounds = [];
    this.ramps = [];
    const add = (obj) => { this.scene.add(obj); this.terrain.push(obj); };

    // The whole course goes on the circuit patch. Keeping equal-sized things off
    // each other is what spreads them across it: `gap` is the mean spacing that
    // many pieces would have, and `k` trims it back far enough that spot() can
    // usually find room for the last of them. On a tight orb the last pieces in
    // have less room, so the spacing relaxes — but the footprint check never
    // does: two barriers in the same place is a hole in the course rather than a
    // crowded one, and less than COURSE_CLEAR between them is a crack a hull can
    // be wedged into.
    const taken = []; // { u, r } of everything laid down so far
    const gap = (count, k) => (k * this.zone.r) / Math.sqrt(count);
    const spot = (minArc, foot) => {
      const u = new THREE.Vector3();
      for (let relax = 0; relax <= 1.0001; relax += 0.2) {
        const want = minArc * (1 - relax);
        for (let i = 0; i < 150; i++) {
          this._scatterNear(this.zone.u, this.zone.r, u);
          if (taken.every((q) => this._arc(u, q.u) > Math.max(want, q.r + foot + COURSE_CLEAR))) {
            taken.push({ u: u.clone(), r: foot });
            return u;
          }
        }
      }
      taken.push({ u: u.clone(), r: foot });
      return u;
    };

    // pyramids — solid walls now, the way the old field always wanted
    const pyGeo = new THREE.ConeGeometry(16, 30, 4);
    const pyEdges = new THREE.EdgesGeometry(pyGeo, 30);
    const pyFill = new THREE.MeshBasicMaterial({ color: 0x0a1420, transparent: true, opacity: 0.6, depthWrite: false });
    const pyWire = new THREE.LineBasicMaterial({ color: 0xff5f8f, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending });
    for (let i = 0, cnt = ZONE_COUNTS.pyramids; i < cnt; i++) {
      const u = spot(gap(cnt, 0.26), 20);
      const [t1, t2] = this._frameAt(u, this.rng.float(0, 1) * Math.PI);
      const g = new THREE.Group();
      const m = new THREE.Mesh(pyGeo, pyFill);
      m.add(new THREE.LineSegments(pyEdges, pyWire));
      m.position.y = 15;
      g.add(m);
      this._seat(g, u, t1);
      add(g);
      this.walls.push({ u, t1, t2, r: 20, h: 30 });
    }

    // straight wall slabs — the shots die on them and hulls bounce off
    const barGeo = new THREE.BoxGeometry(80, 22, 10);
    const barEdges = new THREE.EdgesGeometry(barGeo);
    const barFill = new THREE.MeshBasicMaterial({ color: 0x0d1622, transparent: true, opacity: 0.7, depthWrite: false });
    const barWire = new THREE.LineBasicMaterial({ color: 0xffb45c, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
    for (let i = 0, cnt = ZONE_COUNTS.bars; i < cnt; i++) {
      const u = spot(gap(cnt, 0.32), 44);
      const [t1, t2] = this._frameAt(u, this.rng.float(0, 1) * Math.PI);
      const m = new THREE.Mesh(barGeo, barFill);
      m.add(new THREE.LineSegments(barEdges, barWire));
      m.position.y = 11;
      this._seat(m, u, t1);
      add(m);
      this.walls.push({ u, t1, t2, hw: 40, hd: 5, h: 22 });
    }

    // hills — soft elevation the ships ride over
    const moundGeo = new THREE.ConeGeometry(70, 30, 6);
    const moundEdges = new THREE.EdgesGeometry(moundGeo, 40);
    const moundFill = new THREE.MeshBasicMaterial({ color: 0x08131c, transparent: true, opacity: 0.65, depthWrite: false });
    const moundWire = new THREE.LineBasicMaterial({ color: 0x2c6f8f, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
    for (let i = 0, cnt = ZONE_COUNTS.mounds; i < cnt; i++) {
      const u = spot(gap(cnt, 0.36), 72);
      const [t1, t2] = this._frameAt(u, this.rng.float(0, 1) * Math.PI);
      const m = new THREE.Mesh(moundGeo, moundFill);
      m.add(new THREE.LineSegments(moundEdges, moundWire));
      m.position.y = 15;
      this._seat(m, u, t1);
      add(m);
      this.mounds.push({ u, t1, t2, h: 18, r2: 72 * 72 });
    }

    // launch ramps — cross them fast and the field throws you over the walls
    const rampGeo = new THREE.BoxGeometry(80, 4, 16);
    const rampEdges = new THREE.EdgesGeometry(rampGeo);
    const rampFill = new THREE.MeshBasicMaterial({ color: 0x12201a, transparent: true, opacity: 0.75, depthWrite: false });
    const rampWire = new THREE.LineBasicMaterial({ color: 0x7dffa8, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending });
    for (let i = 0, cnt = ZONE_COUNTS.ramps; i < cnt; i++) {
      const u = spot(gap(cnt, 0.32), 44);
      const [t1, t2] = this._frameAt(u, this.rng.float(0, 1) * Math.PI);
      const m = new THREE.Mesh(rampGeo, rampFill);
      m.add(new THREE.LineSegments(rampEdges, rampWire));
      m.position.y = 10;
      this._seat(m, u, t1);
      add(m);
      this.ramps.push({ u, t1, t2, l: 40, w: 8, rise: 26, minSpeed: 150, vy: 215 });
    }
  }

  /**
   * The projection, drawn on the ground: a phosphor ring where the course ends
   * and a dimmer amber one at the line where the field takes the helm. Without
   * them the only way to learn where the course stops is to be told, mid-fight,
   * that you have already left it — which is the difference between a field with
   * edges and a field that nags.
   */
  _buildCourseEdges() {
    const ring = (arcDist, color, opacity) => {
      const up = this.zone.u;
      const fwd = new THREE.Vector3(0, 1, 0).cross(up);
      if (fwd.lengthSq() < 1e-6) fwd.set(1, 0, 0);
      fwd.normalize();
      const pts = [];
      const steps = 96;
      for (let i = 0; i <= steps; i++) {
        const dir = this._headingAt(up, fwd, (i / steps) * Math.PI * 2, new THREE.Vector3());
        const u = this._ahead(up, dir, arcDist, new THREE.Vector3());
        pts.push(this._pointAt(u, 5, new THREE.Vector3()));
      }
      return new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({
          color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      );
    };
    const edge = ring(this.zone.r, 0x38ffa0, 0.4);
    const helm = ring(Math.min(this.zone.r * ZONE_RECALL, this.orbR * Math.PI * 0.9), 0xffb45c, 0.14);
    for (const r of [edge, helm]) {
      this.scene.add(r);
      this.terrain.push(r); // teardown disposes everything in here
    }
  }

  /** True when a hull of radius `r` standing here touches no barrier at all. */
  _clearOfWalls(u, r) {
    const l = this._p2;
    for (const w of this.walls) {
      this._localTo(w, u, l);
      if (w.hw) {
        const ox = Math.max(Math.abs(l.x) - w.hw, 0);
        const oy = Math.max(Math.abs(l.y) - w.hd, 0);
        if (ox * ox + oy * oy < r * r) return false;
      } else if (l.length() < (w.r || 20) + r) {
        return false;
      }
    }
    return true;
  }

  /**
   * A tangent direction that depends only on where a hull is, and not on which
   * face it happens to be touching. Two faces pushing against each other have
   * opposed normals, so anything derived from a face — its left, its right, the
   * way its frame is turned — is opposed as well, and a hull caught between them
   * would be handed one direction by each and cancel its own escape. This is the
   * reference that lets both of them agree on the way out.
   */
  _escapeDir(u, out) {
    if (Math.abs(u.y) > 0.9) out.set(1, 0, 0);
    else out.set(0, 1, 0);
    return out.addScaledVector(u, -out.dot(u)).normalize();
  }

  /**
   * Solid geometry, resolved as a bounce with slide.
   *
   * The hull is lifted clear of the face, then only the part of its motion
   * heading into the wall is turned back out of it — whatever it had along the
   * face is kept, so a pilot grazing a barrier slides down it and carries on
   * instead of grinding to a halt. Three things matter for never getting stuck:
   * a ship whose centre has ended up *inside* a slab is still pushed out (via
   * whichever face is nearest), speed is never simply zeroed on contact, and a
   * hull caught between two faces is sent the way out that both of them agree
   * on rather than the way each of them would send it alone.
   *
   * The maths is the flat field's, run in each barrier's own tangent frame:
   * a slab is still a rectangle with a length and a depth, it just has both of
   * them on the surface of a world with an opinion about the horizon.
   */
  _collideWalls(p) {
    const R = p.collideR || 14;
    const SKIN = 3;    // daylight left behind, so contact cannot repeat every frame
    const REST = 0.35; // how hard the hull comes back off a face
    const SCRUB = 0.9; // scrape tax, charged once per impact
    const FRESH = 0.25; // a hit within this long of the last one is a lean, not a bang

    const vel = this._s1.copy(p.fwd).multiplyScalar(p.speed);
    const l = this._p2;
    let bounced = false;

    // A hull caught between two faces needs a different answer from one leaning
    // on a single face, so the contact count is taken before any of them is
    // resolved (resolving the first changes the answer for the second).
    let contacts = 0;
    for (const w of this.walls) {
      this._localTo(w, p.u, l);
      const hit = w.hw
        ? Math.abs(l.x) < w.hw + R && Math.abs(l.y) < w.hd + R
        : l.length() < (w.r || 20) + R;
      if (hit) contacts++;
    }
    const pinned = contacts > 1;
    // the direction a pinned hull is sent along, fixed by where it is, so every
    // face around it agrees on it
    if (pinned) this._escapeDir(p.u, this._s6);

    // walk the hull clear along a world tangent, and its heading with it, so
    // the pair never drift apart on the curved surface
    const shift = (nu, depth) => {
      this._s3.copy(nu).addScaledVector(p.u, -nu.dot(p.u));
      const axis = this._s4.crossVectors(p.u, this._s3);
      if (axis.lengthSq() < 1e-9) return;
      axis.normalize();
      this._q1.setFromAxisAngle(axis, (depth + SKIN) / this.orbR);
      p.u.applyQuaternion(this._q1);
      p.fwd.applyQuaternion(this._q1);
    };

    const push = (w, nx, nz, depth, hint) => {
      // the face normal and the slide direction, both in the barrier's frame
      const t1 = w.t1;
      const t2 = w.t2;
      let vx = vel.dot(t1);
      let vz = vel.dot(t2);
      const into = vx * nx + vz * nz;
      const tx = -nz;
      const tz = nx;
      const vt = vx * tx + vz * tz;
      const mag = Math.hypot(vx, vz);
      if (into < 0) {
        // An inward motion with nothing across the face has no side of its own
        // to slide to, so one has to be picked: the caller's hint for a single
        // face, or — when the hull is pinned between faces — the one direction
        // every face agrees on. A face's own left would be no use there, because
        // two opposed normals have opposed lefts, so the faces would hand the
        // hull one direction each and it would cancel its own escape.
        const side = Math.abs(vt) > mag * 0.15
          ? Math.sign(vt)
          : (pinned ? Math.sign(tx * this._s6.dot(t1) + tz * this._s6.dot(t2)) || 1 : (hint || 1));
        if (pinned) {
          // wedged: turn the whole of the hull's momentum along the face it can
          // actually leave by, at the speed it arrived with
          vx = tx * side * mag;
          vz = tz * side * mag;
        } else if (this.t - (p.wallT ?? -99) < FRESH) {
          // still leaning on a surface: turn the whole of the hull's momentum
          // along the face. Holding the nose into a wall slides the ship down
          // it at the speed it arrived with, instead of bouncing it back and
          // forth until its speed has bled away.
          vx = tx * side * mag;
          vz = tz * side * mag;
        } else {
          // a fresh impact: kick off the face, keeping whatever ran along it
          vx = (tx * vt - nx * into * REST) * SCRUB;
          vz = (tz * vt - nz * into * REST) * SCRUB;
        }
        vel.copy(t1).multiplyScalar(vx).addScaledVector(t2, vz);
        bounced = true;
      }
      p.wallT = this.t;
      this._frameDir(w, nx, nz, this._s3);
      shift(this._s3, depth);
    };

    // two passes, so a hull wedged between two faces is freed by the second
    for (let pass = 0; pass < 2; pass++) {
      for (const w of this.walls) {
        this._localTo(w, p.u, l);
        if (w.hw) {
          const ex = w.hw + R;
          const ez = w.hd + R;
          if (Math.abs(l.x) < ex && Math.abs(l.y) < ez) {
            // inside the inflated slab: leave by the nearest face
            const penX = ex - Math.abs(l.x);
            const penZ = ez - Math.abs(l.y);
            let nx = 0;
            let nz = 0;
            let depth;
            if (penX < penZ) { nx = l.x < 0 ? -1 : 1; depth = penX; } else { nz = l.y < 0 ? -1 : 1; depth = penZ; }
            // along the length of the slab, out the nearer end — the short way
            // off a barrier, rather than scraping its whole eighty units
            const hint = penX < penZ ? (p.strafeDir || 1) : (l.x > 0 ? -1 : 1);
            push(w, nx, nz, depth, hint);
          }
          continue;
        }
        // pyramids and anything else round
        const rr = (w.r || 20) + R;
        const d = l.length();
        if (d < rr) {
          // dead centre has no direction of its own, so pick one
          const nx = d > 0.0001 ? l.x / d : 1;
          const nz = d > 0.0001 ? l.y / d : 0;
          push(w, nx, nz, rr - d, p.strafeDir || 1);
        }
      }
    }

    if (bounced) {
      const mag = vel.length();
      if (mag > 0.001) {
        p.fwd.copy(vel);
        // the bounce is expressed in a barrier's frame, so put the heading
        // back exactly on the hull's own tangent before flying it
        p.fwd.addScaledVector(p.u, -p.fwd.dot(p.u));
        if (p.fwd.lengthSq() > 1e-9) p.fwd.normalize();
        p.speed = clamp(mag, 0, 250);
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Item pads                                                          */
  /* ------------------------------------------------------------------ */

  _buildPickups() {
    this.pickups = [];
    const padGeo = new THREE.OctahedronGeometry(7);
    const padEdges = new THREE.EdgesGeometry(padGeo);
    const padFill = new THREE.MeshBasicMaterial({ color: 0x171305, transparent: true, opacity: 0.8, depthWrite: false });
    const padWire = new THREE.LineBasicMaterial({ color: PAD_COLOR, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending });
    // Pads are laid on the course as well, and kept clear of the barriers so a
    // pilot can always reach one without having to thread a wall
    const taken = [];
    for (let i = 0, pads = ZONE_COUNTS.pads; i < pads; i++) {
      const u = new THREE.Vector3();
      for (let tries = 0; tries < 60; tries++) {
        this._scatterNear(this.zone.u, this.zone.r, u);
        if (!this._clearOfWalls(u, 34)) continue;
        if (taken.some((q) => this._arc(u, q) < (0.22 * this.zone.r) / Math.sqrt(pads))) continue;
        break;
      }
      taken.push(u.clone());
      const [t1, t2] = this._frameAt(u, this.rng.float(0, 1) * Math.PI);
      const g = new THREE.Group();
      const m = new THREE.Mesh(padGeo, padFill);
      m.add(new THREE.LineSegments(padEdges, padWire));
      g.add(m);
      this._seat(g, u, t1);
      this.scene.add(g);
      this.terrain.push(g);
      this.pickups.push({ u, t1, t2, group: g, mesh: m, alive: true, respawn: 0, kind: PICKUP_KINDS[i % PICKUP_KINDS.length], phase: i * 1.7 });
    }
  }

  /** Stand a pad back on the surface at a fresh spot. */
  _movePad(pad) {
    this._scatterNear(this.zone.u, this.zone.r, pad.u);
    const [t1, t2] = this._frameAt(pad.u, this.rng.float(0, 1) * Math.PI);
    pad.t1 = t1;
    pad.t2 = t2;
    pad.group.position.copy(pad.u).multiplyScalar(this.orbR);
    pad.kind = this.rng.pick(PICKUP_KINDS);
  }

  _grabPickup(p, pad) {
    pad.alive = false;
    pad.group.visible = false;
    pad.respawn = 12;
    this._spawnBurst(pad.u, 12, PICKUP_COLORS[pad.kind], 0.7);
    audio.coin();
    if (pad.kind === 'burst') {
      p.boost = 3;
    } else if (pad.kind === 'rapid') {
      p.rapid = 5;
    } else {
      p.shieldT = 4;
      p.invuln = Math.max(p.invuln, 4);
    }
    if (p.isPlayer) this._pop(PICKUP_NAMES[pad.kind], PICKUP_CSS[pad.kind]);
  }

  _updatePickups(dt) {
    for (const pad of this.pickups) {
      pad.phase += dt;
      if (pad.respawn > 0) {
        pad.respawn -= dt;
        if (pad.respawn <= 0) {
          this._movePad(pad);
          pad.alive = true;
          pad.group.visible = true;
        }
        continue;
      }
      const h = this.groundAt(pad.u) + 12 + Math.sin(pad.phase * 2.6) * 3;
      this._pointAt(pad.u, h, this._w1);
      pad.group.position.copy(this._w1);
      pad.mesh.rotation.y += dt * 1.8;
      if (!pad.alive) continue;
      for (const p of this.pilots) {
        if (!p.alive || p.respawn > 0) continue;
        if (this._arc(p.u, pad.u) < 16) {
          this._grabPickup(p, pad);
          break;
        }
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Pilots & match                                                     */
  /* ------------------------------------------------------------------ */

  _pilotShipId(i) {
    if (i === 0) return this.shipId;
    return this.rng.pick(SHIPS.map((s) => s.id)) || 'sparrowhawk';
  }

  /**
   * The guns a pilot flies with. The commander's are read straight off the
   * registry — the sim fires the fit in the bay, mount for mount — while the
   * rig fits its own pilots out of the bracket's drawer, so a hard board runs
   * into guns to match the ones it has grown used to.
   */
  _mountsFor(isPlayer, def) {
    const list = [];
    if (isPlayer) {
      const cap = Math.max(1, computeStats(this.state).mounts || 1);
      const fitted = this.state.weapons || def.defaultWeapons || [];
      for (let i = 0; i < cap; i++) {
        const w = WEAPON_BY_ID[fitted[i]];
        if (w) list.push(simWeapon(w, this.simReach));
      }
    } else {
      const bracket = AI_WEAPONS[clamp(Math.floor((this.tier - 1) / 2), 0, AI_WEAPONS.length - 1)];
      const mounts = this.tier <= 2 ? 1 : 2;
      for (let i = 0; i < mounts; i++) {
        const w = WEAPON_BY_ID[this.rng.pick(bracket)];
        if (w) list.push(simWeapon(w, this.simReach));
      }
    }
    return list.length ? list : [simWeapon(WEAPON_BY_ID.pulse, this.simReach)];
  }

  _makePilot(i, isPlayer) {
    const def = SHIP_BY_ID[this._pilotShipId(i)] || SHIP_BY_ID.wayfarer;
    const color = isPlayer ? PLAYER_COLOR : AI_COLORS[(i - 1) % AI_COLORS.length];
    // the sim reads your registry: your hull, your guns, your rigging
    const loadout = isPlayer
      ? {
        weapons: this.state.weapons || def.defaultWeapons,
        outfits: this.state.outfits || {},
        mountCap: computeStats(this.state).mounts,
        showEmpty: true,
      }
      : { weapons: def.defaultWeapons || ['pulse', null] };
    const { group, api } = buildShip(def, { accent: color, isPlayer, loadout });
    vectorize(group, color);
    const s = clamp(HULL_LEN / Math.max(14, def.len), 0.3, 1.5);
    group.scale.setScalar(s);
    // how much room the hull needs beside a wall, so it is pushed clear of the
    // face rather than parked inside it
    const collideR = Math.max(14, (def.radius ?? def.len * 0.5) * s);
    this.scene.add(group);

    const shieldGlow = glowSprite(0x9fd8ff, 30);
    shieldGlow.visible = false;
    group.add(shieldGlow);

    const mounts = this._mountsFor(isPlayer, def);
    const u = new THREE.Vector3();
    // Everyone opens on the circuit: the commander in the middle of the course,
    // the rivals a short flight from them. On a world this size, a rival on the
    // far side is a rival you spend a minute flying to.
    const anchor = i > 0 && this.pilots[0] ? this.pilots[0].u : this.zone.u;
    const spread = i > 0 ? Math.min(this.orbR * 0.45, this.zone.r * 0.8) : this.zone.r * 0.12;
    for (let tries = 0; tries < 60; tries++) {
      this._scatterNear(anchor, spread, u);
      if (!this._clearOfWalls(u, collideR + 6)) continue;
      if (this.pilots.some((q) => this._arc(q.u, u) < 380)) continue;
      break;
    }
    return {
      name: isPlayer ? this.commander : this._callsigns[(i - 1) % this._callsigns.length],
      isPlayer, color, def, group, api, shieldGlow, collideR,
      mounts,
      mountCd: mounts.map(() => this.rng.float(0, 0.6)),
      u,
      fwd: this._randomHeading(u, new THREE.Vector3()),
      y: 0, vy: 0,
      speed: 0,
      alive: true,
      hull: isPlayer ? HULL : Math.round(HULL * (1 + 0.04 * (this.tier - 1))),
      hullMax: isPlayer ? HULL : Math.round(HULL * (1 + 0.04 * (this.tier - 1))),
      respawn: 0,
      invuln: 2,
      score: 0,
      elims: 0,
      fireCd: this.rng.float(0, 1),
      strafeDir: this.rng.float(0, 1) < 0.5 ? 1 : -1,
      wallT: -99, // when this hull last touched a barrier
      recall: 0,  // set once the field has taken the helm off the course
      flashUntil: -1, // last time this hull was hit by the commander
      wobble: this.rng.float(0, 1) * 10,
      boost: 0, rapid: 0, shieldT: 0,
      turbo: 0, turboCharge: 1,
    };
  }

  startMatch(mode) {
    this._lastMode = mode;
    this._teardownMatch();
    if (mode === 'chute') {
      this._startChute();
      return;
    }
    this.match = { mode, time: mode === 'harvest' ? HARVEST_TIME : 0, over: false };
    this.simReach = this.reach;
    // Where the course lies on this orb, and how much of the world it takes up.
    // It is picked before anything else is built, because everything is built on
    // it, and the pilots start on it.
    this.zone = { u: new THREE.Vector3(), r: courseRadius(this.orbR) };
    this._scatter(this.zone.u);
    // terrain first — the pilots need the barriers to spawn clear of
    this._buildTerrain();
    this._buildCourseEdges();
    // call signs off the board without repeating: two pilots flying under one
    // name are two pilots a commander cannot tell apart
    this._callsigns = this.rng.shuffle(CALLSIGNS);
    this.pilots = [this._makePilot(0, true)];
    for (let i = 1; i <= 2; i++) this.pilots.push(this._makePilot(i, false));
    for (const sm of this.shotPool) sm.visible = false;
    this.shots.length = 0;
    this._place = 1;

    this._buildPickups();

    // the crystal field for the harvest. It is the circuit itself: the crystals
    // are the reason to fly the course, and a crystal inside a pyramid is a
    // crystal nobody can take.
    this.field = { u: this.zone.u.clone(), r: this.zone.r };
    this.crystals = [];
    const cryGeo = new THREE.OctahedronGeometry(5);
    const cryWire = new THREE.EdgesGeometry(cryGeo);
    const cryMat = new THREE.LineBasicMaterial({
      color: CRYSTAL_COLOR, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    for (let i = 0, seeds = ZONE_COUNTS.crystals; i < seeds; i++) {
      const u = new THREE.Vector3();
      for (let tries = 0; tries < 60; tries++) {
        this._scatterNear(this.field.u, this.field.r, u);
        if (this._clearOfWalls(u, 12)) break;
      }
      const c = {
        u,
        phase: this.rng.float(0, 1) * 10,
        alive: true,
      };
      const g = new THREE.Group();
      const m = new THREE.Mesh(cryGeo, new THREE.MeshBasicMaterial({
        color: 0x08382e, transparent: true, opacity: 0.7, depthWrite: false,
      }));
      m.add(new THREE.LineSegments(cryWire, cryMat));
      g.add(m);
      g.visible = mode === 'harvest';
      this._seat(g, c.u);
      this.scene.add(g);
      c.group = g;
      c.mesh = m;
      this.crystals.push(c);
    }

    this.lobby.classList.add('hidden');
    this.over.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this._buildRivalBoard();
    this.hud.querySelector('.vh-mode').textContent = `${MODE_INFO[mode].name.toUpperCase()} · ${this.orb.name} · ${MODE_INFO[mode].line}`;
    audio.dock();
    this._announce(mode === 'duel' ? `DUEL — LAST PILOT FLYING ON ${this.orb.name}` : `HARVEST — ${this.orb.name} IS SEEDED`);
  }

  _announce(text) {
    clear(this.over);
    this.over.append(el('div', { class: 'vec-panel vec-announce' }, [el('h2', { text })]));
    this.over.classList.remove('hidden');
    window.clearTimeout(this._announceTimer);
    this._announceTimer = window.setTimeout(() => {
      if (this.over && this.over.querySelector('.vec-announce')) {
        this.over.classList.add('hidden');
        clear(this.over);
      }
    }, 1500);
  }

  _teardownMatch() {
    for (const p of this.pilots) {
      this.scene.remove(p.group);
      p.group.traverse((n) => {
        if (n.geometry) n.geometry.dispose();
      });
    }
    for (const c of this.crystals) this.scene.remove(c.group);
    for (const t of this.terrain) {
      this.scene.remove(t);
      t.traverse((n) => {
        if (n.geometry) n.geometry.dispose();
      });
    }
    for (const s of this.shots) s.mesh.visible = false;
    this.shots = [];
    this.chute = null;
    this.orbGroup.visible = true;
    this.pilots = [];
    this.crystals = [];
    this.pickups = [];
    this.terrain = [];
    this.walls = [];
    this.mounds = [];
    this.ramps = [];
    this._rivalRows = [];
    this._board.classList.add('hidden');
    this._markers.classList.add('hidden');
    this.gauges.classList.add('hidden');
  }

  /* ------------------------------------------------------------------ */
  /* Input                                                              */
  /* ------------------------------------------------------------------ */

  _bindKeys() {
    this._kd = (e) => {
      const code = e.code;
      if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
        e.preventDefault();
      }
      if (code === 'Escape') {
        e.preventDefault();
        if (this.match && !this.match.over) this._forfeit();
        else this.quit();
        return;
      }
      this._keys.add(code);
    };
    this._ku = (e) => this._keys.delete(e.code);
    window.addEventListener('keydown', this._kd, true);
    window.addEventListener('keyup', this._ku, true);
  }

  _forfeit() {
    if (!this.match || this.match.over) return;
    this.match.over = true;
    this.match.forfeit = true;
    this._finishMatch();
  }

  quit() {
    if (this._done) return;
    this._done = true;
    window.removeEventListener('keydown', this._kd, true);
    window.removeEventListener('keyup', this._ku, true);
    window.removeEventListener('resize', this._onResize);
    cancelAnimationFrame(this._raf);
    window.clearTimeout(this._announceTimer);
    window.clearTimeout(this._popTimer);
    this._teardownMatch();
    for (const g of Object.values(this.shotGeos)) g.dispose();
    this.orbGroup.traverse((n) => {
      if (n.geometry) n.geometry.dispose();
    });
    this.scene.remove(this.orbGroup);
    this.shotPool.forEach((m) => {
      m.material.dispose();
      this.scene.remove(m);
    });
    this.burstPool.forEach((p) => {
      this.scene.remove(p.spr);
    });
    this.wrap.remove();
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
    this.onQuit?.();
  }

  /* ------------------------------------------------------------------ */
  /* Loop                                                               */
  /* ------------------------------------------------------------------ */

  _onResize = () => this._resize();

  _resize() {
    const w = Math.max(2, window.innerWidth);
    const h = Math.max(2, window.innerHeight);
    const scale = 0.45; // the sim renders chunky on purpose — that is the look
    this.renderer.setSize(Math.round(w * scale), Math.round(h * scale), false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _tick = (now) => {
    if (this._done) return;
    this._raf = requestAnimationFrame(this._tick);
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    this.t += dt;
    if (this.match && !this.match.over) this._update(dt);
    this._render(dt);
  };

  _update(dt) {
    const m = this.match;
    if (this.chute) {
      this._chuteUpdate(dt);
      return;
    }
    for (const p of this.pilots) {
      if (!p.alive) continue;
      if (p.respawn > 0) {
        p.respawn -= dt;
        if (p.respawn > 0) continue;
        this._respawn(p);
      }
      p.invuln = Math.max(0, p.invuln - dt);
      p.fireCd = Math.max(0, p.fireCd - dt);
      // every mount runs its own clock, which is what makes a rack of mixed
      // weapons sound and feel like a rack of mixed weapons
      for (let i = 0; i < p.mountCd.length; i++) p.mountCd[i] = Math.max(0, p.mountCd[i] - dt);
      p.boost = Math.max(0, p.boost - dt);
      p.rapid = Math.max(0, p.rapid - dt);
      p.shieldT = Math.max(0, p.shieldT - dt);
      p.shieldGlow.visible = p.shieldT > 0;
      p.shieldGlow.material.opacity = p.shieldT > 0 ? 0.7 : 0;

      if (p.isPlayer) this._playerStep(p, dt);
      else this._aiStep(p, dt);

      const maxSpd = p.boost > 0 || p.turbo ? TURBO_SPEED : 250;
      p.speed = clamp(p.speed, 0, maxSpd);
      this._recall(p, dt);
      // along the surface — out here there is no edge to run off and nothing
      // to wrap around, only the far side of the same small world
      this._advance(p.u, p.fwd, p.speed * dt);

      // ground, gravity and jumps
      if (p.y > 0.5 || p.vy !== 0) {
        p.vy -= 430 * dt;
        p.y += p.vy * dt;
        if (p.y <= 0) { p.y = 0; p.vy = 0; }
      } else {
        p.y = 0;
        const jump = this.launchAt(p.u, p.speed);
        if (jump) {
          p.vy = jump;
          p.y = 1;
          audio.missile(0.5);
        }
      }

      // walls stop low hulls; a launched hull sails over them
      if (p.y < 20) this._collideWalls(p);

      const hover = this.groundAt(p.u) + p.y + 6 + Math.sin(this.t * 2.2 + p.wobble) * 1.2;
      p.group.position.copy(p.u).multiplyScalar(this.orbR + hover);
      // nose on +Z, roof on the local vertical — the same convention the lanes
      // use, so the helm turns the way the nose points
      this._seatDir(p.group, p.u, p.fwd);
      p.api.pulse(this.t);
      p.api.setThrottle(clamp(p.speed / 200, 0.08, 1));
    }

    // harvest clock
    if (m.mode === 'harvest') {
      m.time -= dt;
      if (m.time <= 0) {
        m.time = 0;
        m.over = true;
        this._finishMatch();
        return;
      }
    }

    this._stepShots(dt);
    this._stepBursts(dt);
    this._updateCrystals(dt);
    this._updatePickups(dt);
    this._updateHud();
  }

  /* ------------------------------------------------------------------ */
  /* Helm & AI                                                          */
  /* ------------------------------------------------------------------ */

  /**
   * Spend or refill the turbo reserve. Called with what the pilot is asking for.
   * It is held for as long as the tank lasts, refused until the tank has mostly
   * come back — so it cannot be stuttered on and off — and topped up the rest of
   * the time. Nothing is left in a state to keep track of beyond how much is in
   * the tank.
   */
  _spendTurbo(p, want, dt) {
    if (want && p.turboCharge >= TURBO.rearm) p.turbo = 1;
    if (p.turbo && (!want || p.turboCharge <= 0)) p.turbo = 0;
    if (p.turbo) p.turboCharge = Math.max(0, p.turboCharge - dt / TURBO.duration);
    else p.turboCharge = Math.min(1, p.turboCharge + dt / TURBO.recharge);
  }

  _playerStep(p, dt) {
    // The helm's own mapping is written for the top-down lane view. This rig
    // looks over the hull's shoulder instead, so starboard — forward crossed
    // with up — turns clockwise on screen: a right-hand input has to walk the
    // heading down, or the nose swings the wrong way.
    let turn = 0;
    if (this._keys.has('KeyA') || this._keys.has('ArrowLeft')) turn += 1; // to port
    if (this._keys.has('KeyD') || this._keys.has('ArrowRight')) turn -= 1; // to starboard
    this._turn(p.fwd, p.u, turn * 2.7 * dt);
    this._spendTurbo(p, this._keys.has('ShiftLeft') || this._keys.has('ShiftRight'), dt);
    const accel = p.boost > 0 ? 400 : p.turbo ? TURBO_ACCEL : 240;
    if (this._keys.has('KeyW') || this._keys.has('ArrowUp')) p.speed += accel * dt;
    if (this._keys.has('KeyS') || this._keys.has('ArrowDown')) p.speed -= 200 * dt;
    p.speed *= Math.max(0, 1 - 0.6 * dt);
    if (this._keys.has('Space')) this._fire(p);
  }

  /**
   * The projection has an edge, and past it the rig has the helm. A hull that
   * leaves the course is turned back toward the middle of it at whatever rate it
   * takes to beat the helm, at full speed and with nothing to run into, so a
   * match that runs long brings itself home instead of finishing over empty
   * ground. Nothing is ever stopped, so nothing can be pinned.
   */
  _recall(p, dt) {
    const d = this._arc(this.zone.u, p.u);
    const edge = this.zone.r * ZONE_RECALL;
    if (d < edge) {
      // hysteresis, so a hull riding the edge does not shout about it
      if (d < edge * 0.85) p.recall = 0;
      return;
    }
    const rate = RECALL_TURN + RECALL_GAIN * ((d - edge) / this.zone.r);
    this._turn(p.fwd, p.u, clamp(this._bearing(p.u, p.fwd, this.zone.u), -rate * dt, rate * dt));
    if (p.isPlayer && !p.recall) this._pop('OFF THE COURSE — THE RIG HAS THE HELM', '#ffb45c');
    p.recall = 1;
  }

  _aiStep(p, dt) {
    const enemies = this.pilots.filter((q) => q !== p && q.alive);
    const m = this.match;
    // bearings are measured from this hull's own nose, so dead ahead is zero
    let targetAngle = 0;
    let wantFire = false;
    let wantSpeed = 150;
    let wantTurbo = false;

    if (m.mode === 'duel') {
      // The purse goes to the last pilot flying, so the commander is the one
      // worth outlasting. Rivals that only ever chase whatever is nearest pair
      // off with each other and let a pilot wander off the far side of the orb.
      const player = this.pilots[0];
      const target = player.alive && player !== p
        ? player
        : (enemies[0] ? this._nearest(p, enemies) : null);
      if (target) {
        const d = this._arc(p.u, target.u);
        // Aim where the target is going, not where it is. On a world this wide
        // a pursuer that flies at a running target's tail just follows it round
        // the planet, nose permanently off the mark; a lead turns that into a
        // cut across its course, which is a firing position.
        let aimAt = target.u;
        if (target.speed > 1) {
          const lead = Math.min(2.5, d / Math.max(40, p.speed + 120));
          aimAt = this._ahead(target.u, target.fwd, target.speed * lead, this._w2);
        }
        const aim = this._bearing(p.u, p.fwd, aimAt);
        targetAngle = aim;
        // A duellist that orbits with its nose off the target never gets to
        // pull the trigger, so it lines up whenever the gun is close to ready
        // and only circles while it reloads.
        const lining = p.fireCd < 0.8;
        if (!lining && d < 190 * this.reach) {
          targetAngle = aim + p.strafeDir * 1.15;
          wantSpeed = d < 110 * this.reach ? 60 : 175;
        } else if (d < 90 * this.reach) {
          wantSpeed = 60;
        } else {
          // Out of the knife range it runs the target down at full throttle. On
          // an orb this wide, a rival ambling along at cruising speed just
          // watches the fight leave without it.
          wantSpeed = 250;
          // and it spends its own reserve doing it, or a commander with a turbo
          // simply leaves it standing
          wantTurbo = d > 420 * this.reach && Math.abs(aim) < 0.5;
        }
        // the field is bigger, so the gun's reach is measured in field-widths
        if (d < 320 * this.reach && Math.abs(aim) < this._aimTol(d) && p.fireCd <= 0) wantFire = true;
      }
    } else {
      // harvest: the crystal is the job; the gun is for the pilot in the way
      let best = null;
      let bestD = Infinity;
      for (const c of this.crystals) {
        if (!c.alive) continue;
        const d = this._arc(p.u, c.u);
        if (d < bestD) { bestD = d; best = c; }
      }
      if (best) targetAngle = this._bearing(p.u, p.fwd, best.u);
      wantTurbo = bestD > 500 * this.reach;
      const player = this.pilots[0];
      if (player.alive) {
        const d = this._arc(p.u, player.u);
        const aim = this._bearing(p.u, p.fwd, player.u);
        if (d < 260 * this.reach && Math.abs(aim) < this._aimTol(d) && p.fireCd <= 0) wantFire = true;
      }
    }

    targetAngle = this._avoidObstacles(p, targetAngle);

    this._turn(p.fwd, p.u, clamp(roundAng(targetAngle), -2.3 * dt, 2.3 * dt));
    this._spendTurbo(p, wantTurbo, dt);
    p.speed += clamp(wantSpeed - p.speed, -160 * dt, 160 * dt);
    if (wantFire) {
      this._fire(p);
      p.fireCd = (p.rapid > 0 ? 0.3 : 0.85) + this.rng.float(0, 0.6);
    }
  }

  /** How far off the nose can be and still land a shot at this range. */
  _aimTol(d) {
    return Math.max(0.05, Math.min(0.35, Math.atan((16 * this.reach) / Math.max(16 * this.reach, d))));
  }

  /** The nearest hull other than `p` itself — a seeker skips what threw it. */
  _nearest(p, list) {
    let best = null;
    let bd = Infinity;
    for (const q of list) {
      if (q === p) continue;
      const d = this._arc(p.u, q.u);
      if (d < bd) { bd = d; best = q; }
    }
    return best;
  }

  /** True when a point on the orb is inside a barrier's footprint. */
  _blocked(u) {
    const l = this._p2;
    for (const o of this.walls) {
      this._localTo(o, u, l);
      if (o.hw) {
        if (Math.abs(l.x) < o.hw + 14 && Math.abs(l.y) < o.hd + 14) return true;
      } else if (l.length() < (o.r || 20) + 14) {
        return true;
      }
    }
    return false;
  }

  _avoidObstacles(p, targetAngle) {
    const probe = 46;
    this._ahead(p.u, p.fwd, probe, this._w1);
    if (!this._blocked(this._w1)) return targetAngle;
    const right = this._headingAt(p.u, p.fwd, -0.9, this._w2);
    this._ahead(p.u, right, probe, this._w3);
    // whichever way has room, with the starboard probe tried first
    return this._blocked(this._w3) ? targetAngle + 0.9 : -0.9;
  }

  /**
   * Let fly with every mount that is off cooldown. A hull with two guns throws
   * two bolts, the way it does in the lanes; a rig with one throws one. Each
   * mount keeps its own cadence, so a pulse lance next to a railgun sounds and
   * feels like a pulse lance next to a railgun.
   */
  _fire(p) {
    let fired = false;
    for (let i = 0; i < p.mounts.length; i++) {
      if (p.mountCd[i] > 0) continue;
      const w = p.mounts[i];
      p.mountCd[i] = w.cd * (p.rapid > 0 ? 0.45 : 1);
      if (this._loose(p, w, i)) fired = true;
    }
    return fired;
  }

  _loose(p, w, mount) {
    if (this.chute) return this._chuteLoose(p, w, mount);
    const mesh = this.shotPool.find((m) => !m.visible);
    if (!mesh) return false;
    const jitter = this.rng.float(-1, 1) * w.spread;
    const dir = this._headingAt(p.u, p.fwd, jitter, this._w1);
    const u = this._ahead(p.u, dir, 14 + mount * 2, this._w2);
    const height = this.groundAt(p.u) + p.y + 8;

    mesh.visible = true;
    mesh.geometry = this.shotGeos[w.kind] || this.shotGeos.laser;
    // the shot wears its own kind's colour; a rival's is pulled toward the
    // rival, so incoming fire still reads as someone else's problem
    this._col.setHex(w.color);
    if (!p.isPlayer) this._col.lerp(this._col2.setHex(p.color), 0.45);
    mesh.material.color.copy(this._col);
    this._pointAt(u, height, this._w3);
    mesh.position.copy(this._w3);
    this._seatDir(mesh, u, dir);

    this.shots.push({
      // a shot's course is its own: the scratch vectors above are reused by
      // every gun in the field, and by the position maths in _stepShots
      u: u.clone(),
      dir: dir.clone(),
      height,
      speed: w.speed,
      dmg: w.dmg,
      kind: w.kind,
      turn: w.turn,
      life: w.life,
      owner: p,
      mesh,
    });
    audio.laser(w.kind === 'beam', 0.5);
    return true;
  }

  _stepShots(dt) {
    const l = this._p2;
    // The hulls a seeker may lean onto, gathered once for the frame instead of
    // once per bolt in the air — this runs for every shot, every frame.
    const flyers = this._flyers;
    flyers.length = 0;
    for (const q of this.pilots) {
      if (q.alive && q.respawn <= 0) flyers.push(q);
    }
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= dt;
      // seekers lean onto the nearest hull that is not the one that threw them
      if (s.turn) {
        const target = this._nearest(s.owner, flyers);
        if (target) {
          const want = this._bearing(s.u, s.dir, target.u);
          this._turn(s.dir, s.u, clamp(want, -s.turn * dt, s.turn * dt));
        }
      }
      const prev = this._s5.copy(s.u); // where it was, for the sweep below
      this._advance(s.u, s.dir, s.speed * dt);
      const h = this.groundAt(s.u) + s.height;
      this._pointAt(s.u, h, this._w1);
      s.mesh.position.copy(this._w1);
      this._seatDir(s.mesh, s.u, s.dir);

      let dead = s.life <= 0;
      // walls eat shots that fly low; launched shots clear the slabs
      if (!dead) {
        for (const o of this.walls) {
          this._localTo(o, s.u, l);
          const hit = o.hw
            ? Math.abs(l.x) < o.hw + 3 && Math.abs(l.y) < o.hd + 3
            : l.length() < (o.r || 20) + 3;
          if (hit && s.height < (o.h || 40)) {
            this._spawnBurst(s.u, s.height, 0xff5f8f, 0.4);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const q of this.pilots) {
          if (q === s.owner || !q.alive || q.invuln > 0 || q.respawn > 0) continue;
          if (this._sweptHit(prev, s.u, q.u, 12)) {
            this._hit(q, s.owner, s.dmg, s.kind);
            dead = true;
            break;
          }
        }
      }
      if (dead) {
        s.mesh.visible = false;
        this.shots.splice(i, 1);
      }
    }
  }

  _hit(victim, shooter, dmg, kind) {
    // a pilot already out cannot be hit again — the shots skip the dead, but
    // this keeps a stray call from counting a second kill
    if (!victim.alive) return;
    this._spawnBurst(victim.u, victim.y + 6, victim.color, 0.8);
    audio.hit();
    // the board pulses for a hit the commander landed, so a pass that connected
    // reads as a hit rather than as a rival that happened to be there
    if (shooter?.isPlayer && !victim.isPlayer) victim.flashUntil = this.t + 0.35;
    // a disruptor does not chew structure; it takes the rigging away
    if (kind === 'disruptor') {
      victim.boost = 0;
      victim.rapid = 0;
      victim.shieldT = 0;
      if (victim.isPlayer) this._pop('SYSTEMS SCRAMBLED', '#c792ff');
    }
    victim.hull -= dmg;

    if (this.match.mode === 'harvest') {
      // the harvest has no final answer — a hull that comes apart sits out a
      // moment and scatters crystals where it fell
      if (victim.hull > 0) return;
      victim.hull = victim.hullMax;
      if (victim.score > 0) {
        victim.score = Math.max(0, victim.score - 2);
        this._placeCrystalAt(victim.u);
        this._placeCrystalAt(victim.u);
      }
      this._spawnBurst(victim.u, victim.y + 6, victim.color, 1.3);
      victim.respawn = 3;
      victim.invuln = 1.5;
      victim.group.visible = false;
      return;
    }

    if (victim.hull > 0) {
      if (victim.isPlayer) this._pop(`HULL ${Math.max(0, Math.ceil(victim.hull))}%`, '#ff9a6b');
      return;
    }

    victim.alive = false;
    victim.group.visible = false;
    this._spawnBurst(victim.u, victim.y + 6, victim.color, 1.5);
    if (!victim.isPlayer) {
      shooter.elims += 1;
      // last rival down — the field is ours
      if (!this.pilots.some((q) => !q.isPlayer && q.alive)) {
        this._place = 1;
        this.match.over = true;
        this._finishMatch();
      }
      return;
    }
    // Everyone still flying outranks a pilot who just went out, so the place
    // counts the rivals left alive — not the ones already down.
    this._place = 1 + this.pilots.filter((q) => !q.isPlayer && q.alive).length;
    this.match.over = true;
    this._finishMatch();
  }

  _respawn(p) {
    const u = this._w1;
    // back onto the course, not onto the empty side of the world
    for (let tries = 0; tries < 60; tries++) {
      this._scatterNear(this.zone.u, this.zone.r, u);
      const crowded = this.pilots.some((q) => q.alive && q !== p && this._arc(q.u, u) < 130);
      if (!crowded && this._clearOfWalls(u, (p.collideR || 14) + 6)) break;
    }
    p.u.copy(u);
    this._randomHeading(p.u, p.fwd);
    p.y = 0;
    p.vy = 0;
    p.speed = 0;
    p.hull = p.hullMax;
    p.group.visible = true;
  }

  _updateCrystals(dt) {
    if (this.match.mode !== 'harvest') return;
    for (const c of this.crystals) {
      c.phase += dt;
      if (c.group.visible) {
        const h = this.groundAt(c.u) + 10 + Math.sin(c.phase * 2.4) * 3;
        this._pointAt(c.u, h, this._w1);
        c.group.position.copy(this._w1);
        c.mesh.rotation.y += dt * 1.4;
      }
      if (!c.alive) continue;
      for (const p of this.pilots) {
        if (!p.alive || p.respawn > 0) continue;
        if (this._arc(p.u, c.u) < 16) {
          c.alive = false;
          c.group.visible = false;
          p.score += 1;
          this._spawnBurst(c.u, 8, CRYSTAL_COLOR, 0.5);
          audio.coin();
          break;
        }
      }
    }
    // the field reseeds itself — always somewhere else in the same patch, so
    // the race stays a race
    const empty = this.crystals.filter((c) => !c.alive).length;
    for (let i = 0; i < empty; i++) {
      const c = this.crystals.find((cc) => !cc.alive);
      if (!c) break;
      this._scatterNear(this.field.u, this.field.r, c.u);
      this._seat(c.group, c.u);
      c.alive = true;
      c.group.visible = true;
    }
  }

  /** Drop a crystal a short hop from where a hull came apart. */
  _placeCrystalAt(u) {
    const c = this.crystals.find((cc) => !cc.alive);
    if (!c) return;
    // a short hop from where it fell, unless that is outside the field — a
    // crystal nobody can reach is a crystal nobody can race for
    if (this._arc(this.field.u, u) < this.field.r) {
      c.u.copy(u);
      this._advance(c.u, this._randomHeading(u, this._w1), this.rng.float(-1, 1) * 30);
    } else {
      this._scatterNear(this.field.u, this.field.r, c.u);
    }
    this._seat(c.group, c.u);
    c.alive = true;
    c.group.visible = true;
  }

  _stepBursts(dt) {
    for (const b of this.burstPool) {
      if (b.t <= 0) continue;
      b.t -= dt;
      const k = Math.max(0, b.t / b.max);
      b.spr.material.opacity = 0.9 * k;
      b.spr.scale.setScalar(30 * (1.4 - k * 0.6));
      if (b.t <= 0) b.spr.visible = false;
    }
  }

  _updateHud() {
    const m = this.match;
    const p = this.pilots[0];
    if (this.chute) {
      this._hudScore.textContent = `POS ${this._chutePlace(p)}/${this.pilots.length}`;
      this._hudHull.textContent = p.daze > 0
        ? `SPOILED · GATE ${p.gates}/${this.chute.gates.length}`
        : `GATE ${p.gates}/${this.chute.gates.length}`;
      this._hudClock.textContent = `TIME ${m.time.toFixed(1)}s`;
    } else {
      // a duel has no score to count — what a pilot won on is the eliminations
      this._hudScore.textContent = m.mode === 'duel' ? `ELIMS ${p.elims}` : `CRYSTALS ${p.score}`;
      const hull = `HULL ${Math.max(0, Math.ceil(p.hull))}`;
      if (m.mode === 'duel') {
        const left = this.pilots.filter((q) => q.alive).length;
        this._hudHull.textContent = `${hull} · PILOTS ${left}`;
        this._hudClock.textContent = '';
      } else {
        this._hudHull.textContent = p.respawn > 0 ? 'IN THE PIT' : hull;
        this._hudClock.textContent = `TIME ${Math.ceil(m.time)}`;
      }
    }
    // the gauges: how much drive the lever is asking for, how much turbo is in
    // the tank, and what the hull is actually doing
    this._leverRow.classList.toggle('hidden', !this.chute);
    const lever = this.chute ? (p.throttle ?? 1) : clamp(p.speed / CHUTE_TOP_SPEED, 0, 1);
    this._leverFill.style.width = `${Math.round(lever * 100)}%`;
    this._turboFill.style.width = `${Math.round(clamp(p.turboCharge, 0, 1) * 100)}%`;
    this._turboFill.style.background = p.turboCharge < 0.999
      ? (p.turboCharge > CHUTE.starTop ? '#8fd0ff' : '#ff9a6b')
      : '#6effa8';
    this._gaugeNote.textContent = [
      `${Math.round(p.speed)} u/s`,
      p.boost > 0 ? 'BURST' : p.turbo ? 'TURBO' : '',
      this.chute && p.stars ? `${p.stars} ★` : '',
    ].filter(Boolean).join(' · ');
    // what is left in the turbo reserve, and whether a burst plate is burning
    if (p.boost > 0) {
      this._hudTurbo.textContent = 'DRIVE BURST';
      this._hudTurbo.style.color = '#ffb45c';
    } else if (p.turbo) {
      this._hudTurbo.textContent = 'TURBO BURNING';
      this._hudTurbo.style.color = '#ffd166';
    } else if (p.turboCharge < 0.999) {
      this._hudTurbo.textContent = `TURBO ${Math.round(p.turboCharge * 100)}%`;
      this._hudTurbo.style.color = '#8fd0ff';
    } else {
      this._hudTurbo.textContent = 'TURBO READY · SHIFT';
      this._hudTurbo.style.color = '';
    }
    this._updateRivals();
  }

  /**
   * Who else is flying, what is left of their hull and how far off they are —
   * plus a marker on the glass for each of them. An orb is a world you can lose
   * a fight on by looking the wrong way, so the rig tells a pilot where the
   * others are instead of leaving them to guess.
   */
  _buildRivalBoard() {
    clear(this._board);
    clear(this._markers);
    this._rivalRows = [];
    for (const q of this.pilots) {
      if (q.isPlayer) continue;
      const bar = el('i');
      const row = el('div', { class: 'vb-row' }, [
        el('span', { class: 'vb-dot', style: `background:${cssHex(q.color)}; color:${cssHex(q.color)}` }),
        el('span', { class: 'vb-name', text: q.name }),
        el('span', { class: 'vb-bar' }, [bar]),
        el('span', { class: 'vb-range' }),
      ]);
      const mark = el('div', { class: 'vec-marker' }, [
        el('span', { class: 'vm-name', text: q.name, style: `color:${cssHex(q.color)}` }),
        el('span', { class: 'vm-range' }),
      ]);
      this._board.append(row);
      this._markers.append(mark);
      this._rivalRows.push({
        q,
        row,
        bar,
        range: row.querySelector('.vb-range'),
        mark,
        markRange: mark.querySelector('.vm-range'),
      });
    }
    this._board.classList.remove('hidden');
    this._markers.classList.remove('hidden');
    this.gauges.classList.remove('hidden');
  }

  /** Put a rival's chip on the glass, or pin it to the edge when it is off it. */
  _placeMarker(r, seen, nx, ny) {
    r.mark.classList.toggle('hidden', !seen);
    if (!seen) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const inset = 40;
    const x = clamp((nx * 0.5 + 0.5) * w, inset, w - inset);
    const y = clamp((-ny * 0.5 + 0.5) * h, inset, h - inset);
    r.mark.classList.toggle('edge', nx < -1 || nx > 1 || ny < -1 || ny > 1);
    r.mark.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  _updateRivals() {
    if (!this._rivalRows.length) return;
    const me = this.pilots[0];
    for (const r of this._rivalRows) {
      const q = r.q;
      // the marker rides the rival while the rig can see it, and pins to the
      // edge of the glass when the rival is off to one side. A hull behind the
      // camera gets no marker at all rather than a marker that lies.
      const ndc = this._mv.copy(q.group.position).project(this.camera);
      r.row.classList.toggle('hit', this.t < q.flashUntil);

      if (this.chute) {
        // a race: what matters is the gap, not what is left of anyone's hull
        const home = q.finishAt != null;
        const lead = Math.round(q.s - me.s);
        r.row.classList.remove('down');
        r.bar.style.width = `${Math.round(clamp(q.s / this.chute.length, 0, 1) * 100)}%`;
        r.bar.style.background = q.daze > 0 ? '#ff9a6b' : '#6effa8';
        r.range.textContent = home ? 'HOME' : `${lead > 0 ? '+' : ''}${lead}`;
        r.markRange.textContent = r.range.textContent;
        this._placeMarker(r, !home && ndc.z <= 1, ndc.x, ndc.y);
        continue;
      }

      const flying = q.alive && q.respawn <= 0;
      const frac = flying ? clamp(q.hull / q.hullMax, 0, 1) : 0;
      r.row.classList.toggle('down', !flying);
      r.bar.style.width = `${Math.round(frac * 100)}%`;
      r.bar.style.background = frac > 0.5 ? '#6effa8' : frac > 0.22 ? '#ffd166' : '#ff6b7a';
      const d = this._arc(me.u, q.u);
      const range = d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`;
      r.range.textContent = flying ? range : 'DOWN';
      r.markRange.textContent = range;
      this._placeMarker(r, flying && ndc.z <= 1, ndc.x, ndc.y);
    }
  }

  /* ------------------------------------------------------------------ */
  /* The chute — the race                                              */
  /* ------------------------------------------------------------------ */

  /**
   * A point on the chute's centre line, `s` units along the track. It winds
   * around its own axis and opens as it climbs, and on top of that the whole
   * path breathes, wanders and lifts — three seeded harmonics, so the track is
   * strange in its own way every race instead of the same tidy helix.
   */
  _chutePoint(s, out) {
    const c = this.chute;
    const t = clamp(s / c.length, 0, 1);
    const r = CHUTE.baseR + (CHUTE.openR - CHUTE.baseR) * t
      + Math.sin((s / c.wobbleLen) * Math.PI * 2 + c.wobblePhase) * c.wobbleR;
    const ang = t * CHUTE.turns * Math.PI * 2 + c.phase
      + Math.sin((s / c.driftLen) * Math.PI * 2 + c.driftPhase) * c.driftA;
    const y = s * CHUTE.rise
      + Math.sin((s / c.liftLen) * Math.PI * 2 + c.liftPhase) * c.liftA
      + Math.sin((s / (c.liftLen * 0.43)) * Math.PI * 2 + c.liftPhase * 1.7) * c.liftA * 0.35;
    return out.set(Math.cos(ang) * r, y, Math.sin(ang) * r);
  }

  /** How wide the road is at `s`: a split opens it out, a squeeze pulls it in. */
  _chuteHalf(s) {
    const c = this.chute;
    let w = CHUTE.halfW;
    for (const f of c.forks) {
      if (s >= f.wide && s <= f.to) { w = Math.max(w, f.halfW); break; }
    }
    for (const n of c.pinches) {
      if (s < n.from || s > n.to) continue;
      const k = clamp(Math.min(s - n.from, n.to - s) / n.ease, 0, 1);
      w *= 1 - (1 - CHUTE.pinchScale) * k;
      break;
    }
    return w;
  }

  /** Half-width of the divider island at `s` — 0 anywhere but a split. */
  _chuteIsland(s) {
    for (const f of this.chute.forks) {
      if (s < f.from || s > f.to) continue;
      const k = clamp(Math.min(s - f.from, f.to - s) / CHUTE.forkMouth, 0, 1);
      return CHUTE.islandHalf * k;
    }
    return 0;
  }

  /** Which side of an island a hull is on, against a feature's own lane. */
  _chuteInLane(lat, lane) {
    if (!lane) return true;
    if (Math.abs(lat) < 1) return false;
    return (lat > 0 ? 1 : -1) === lane;
  }

  /** Where a feature lies within the road, and the lane centres of a split. */
  _chuteLane(s, side) {
    const half = this._chuteHalf(s);
    const island = this._chuteIsland(s);
    return { centre: side * (island + (half - island) * 0.5), half: (half - island) * 0.5 };
  }

  /**
   * The chute's frame at `s`: the way the track runs, and which way is across
   * it and up. Side is horizontal, which is the axis a pilot steers along, and
   * up is square to it — so the chute's climb and its spiral are felt as the
   * track banking rather than as a hull sliding out of the tube.
   */
  _chuteFrame(s, out) {
    this._chutePoint(s - 6, this._c1);
    this._chutePoint(s + 6, this._c2);
    out.t.copy(this._c2).sub(this._c1);
    if (out.t.lengthSq() < 1e-9) out.t.set(0, 0, 1);
    out.t.normalize();
    out.side.crossVectors(out.t, this._cUp);
    if (out.side.lengthSq() < 1e-6) out.side.set(1, 0, 0);
    out.side.normalize();
    out.up.crossVectors(out.side, out.t).normalize();
    return out;
  }

  /** Where a racer sits in the world: along the track, across it, and above it. */
  _chuteWorld(p, out, extraUp = 0) {
    const f = this._chuteFrame(p.s, this._cFrame);
    this._chutePoint(p.s, out);
    return out.addScaledVector(f.side, p.lat).addScaledVector(f.up, p.air + extraUp);
  }

  /** Stand a hull in the chute: nose along the track, roof on the chute's up. */
  _seatChute(obj, s, lat, air, bank = 0) {
    const f = this._chuteFrame(s, this._cFrame);
    this._chutePoint(s, this._c1);
    obj.position.copy(this._c1).addScaledVector(f.side, lat).addScaledVector(f.up, air);
    const nose = this._c3.copy(f.t).addScaledVector(f.side, bank).normalize();
    const up = this._c4.crossVectors(f.side, nose).normalize();
    const side = this._c5.crossVectors(up, nose).normalize();
    obj.quaternion.setFromRotationMatrix(this._mat.makeBasis(side, up, nose));
  }

  /** The road under a racer: a ramp lifts the floor, and the rifts have none. */
  _chuteDeck(s, lat = 0) {
    for (const r of this.chute.ramps) {
      if (!this._chuteInLane(lat, r.lane)) continue;
      if (s >= r.from && s <= r.to) return CHUTE.rampRise * clamp((s - r.from) / CHUTE.rampLen, 0, 1);
    }
    return 0;
  }

  /** Is this point in the road over one of its holes? */
  _inGap(s, lat = 0) {
    return this.chute.gaps.some((g) => this._chuteInLane(lat, g.lane) && s >= g.from && s < g.to);
  }

  /** Who is ahead of whom: finishers by their time, everyone else by distance. */
  _chutePlace(p) {
    let ahead = 0;
    for (const q of this.pilots) {
      if (q === p) continue;
      if (q.finishAt != null) {
        if (p.finishAt == null || q.finishAt < p.finishAt) ahead += 1;
      } else if (p.finishAt == null && q.s > p.s) {
        ahead += 1;
      }
    }
    return ahead + 1;
  }

  /** How fast a racer's drive will take it right now. */
  _chuteCap(p, rival = false) {
    const top = p.turbo || p.boost > 0 ? TURBO_SPEED : CHUTE_TOP_SPEED;
    // Every pilot runs the same hull: what separates the field from the
    // commander is how hard each one dares to fly it, not a rule about who is
    // allowed to be quick.
    const ceiling = rival ? top * CHUTE.rivalTop * (p.skill ?? 1) : top;
    return p.daze > 0 ? ceiling * CHUTE.dazeCut : ceiling;
  }

  /**
   * What the lever is asking for. The turbo reserve, a burst plate and the
   * drive itself all raise the speed the lever can wind to — so the tank is
   * worth something real while it lasts rather than being a display that
   * empties.
   */
  _chuteWant(p) {
    const top = p.turbo || p.boost > 0 ? TURBO_SPEED : CHUTE_TOP_SPEED;
    return p.throttle * top;
  }

  /** Point the drive at a speed: pull toward it, come off it harder. */
  _chuteDrive(p, want, dt, rival = false) {
    const cap = this._chuteCap(p, rival);
    const target = clamp(want, 0, cap);
    const rate = target > p.speed ? CHUTE.accel : CHUTE.decel;
    p.speed += clamp(target - p.speed, -rate * dt, rate * dt);
  }

  /**
   * The track, as pure data: how long it runs, how it wanders, and every
   * feature along it. Deterministic for a bracket and a race number, so the
   * lobby can read the track the rig is about to lay without building a metre
   * of it — and the race that follows is the one the board described.
   */
  _chutePlan() {
    const key = `${this.tier}:${this.rec?.played || 0}`;
    if (this._planKey === key && this._plan) return this._plan;
    const rand = rngOf(this.state?.worldSeed ?? 1, 'chute', key);
    const length = Math.round(CHUTE.length + CHUTE.perTier * this.tier);
    const gapLen = Math.round(CHUTE.gapBase + CHUTE.gapPerTier * this.tier);
    const plan = {
      length, gapLen,
      phase: rand.float(0, Math.PI * 2),
      wobbleR: rand.float(CHUTE.wobbleR[0], CHUTE.wobbleR[1]),
      wobbleLen: rand.float(CHUTE.wobbleLen[0], CHUTE.wobbleLen[1]),
      wobblePhase: rand.float(0, Math.PI * 2),
      driftA: rand.float(CHUTE.driftA[0], CHUTE.driftA[1]),
      driftLen: rand.float(CHUTE.driftLen[0], CHUTE.driftLen[1]),
      driftPhase: rand.float(0, Math.PI * 2),
      liftA: rand.float(CHUTE.liftA[0], CHUTE.liftA[1]),
      liftLen: rand.float(CHUTE.liftLen[0], CHUTE.liftLen[1]),
      liftPhase: rand.float(0, Math.PI * 2),
      gates: [], ramps: [], gaps: [], forks: [], pinches: [], pads: [], stars: [],
    };

    // ---- the course, laid out in sequence so nothing lands on anything ----
    let bag = [];
    const nextKind = () => {
      // a jump-heavy track with the odd split and squeeze, and never two of
      // either back to back, so the shape of the race keeps changing
      if (!bag.length) bag = rand.shuffle(['ramp', 'fork', 'ramp', 'pinch', 'fork', 'ramp', 'pinch']);
      return bag.pop();
    };
    let s = CHUTE.featureFirst;
    let prevKind = null;
    let rifts = 0;
    while (s < length - CHUTE.tailClear) {
      let kind = nextKind();
      if (kind === prevKind && kind !== 'ramp') kind = 'ramp';
      prevKind = kind;
      if (kind === 'ramp') {
        plan.ramps.push({ from: s, to: s + CHUTE.rampLen, lane: 0 });
        plan.gaps.push({ from: s + CHUTE.rampLen, to: s + CHUTE.rampLen + gapLen, lane: 0 });
        s += CHUTE.rampLen + gapLen + CHUTE.featureGap;
      } else if (kind === 'pinch') {
        plan.pinches.push({ from: s, to: s + CHUTE.pinchLen, ease: CHUTE.pinchEase });
        s += CHUTE.pinchLen + CHUTE.featureGap;
      } else {
        // A split: the road opens out and an island grows down the middle of
        // it, so there are two ways through and no way back across once the
        // nose has passed. One lane carries the reward — a rift to jump, or a
        // run of burst plates — and the other is plain track. Rifts are rationed
        // on purpose: they are the hardest thing on the road, and a race that is
        // all jumps is a race nobody enjoys losing.
        const from = s;
        const to = s + CHUTE.forkLen;
        const lane = rand.float(0, 1) < 0.5 ? -1 : 1;
        const flavour = rifts < CHUTE.riftMax && rand.float(0, 1) < 0.5 ? 'rift' : 'plates';
        const fork = {
          from, to, lane, flavour,
          wide: from - CHUTE.forkMouth,
          halfW: CHUTE.halfW + CHUTE.islandHalf * 2 + 10,
        };
        plan.forks.push(fork);
        if (flavour === 'rift') {
          rifts += 1;
          const lip = from + Math.round(CHUTE.forkLen * 0.42);
          plan.ramps.push({ from: lip - CHUTE.rampLen, to: lip, lane });
          plan.gaps.push({ from: lip, to: lip + gapLen, lane });
        } else {
          for (let k = 0; k < CHUTE.padCount; k++) {
            plan.pads.push({
              s: from + Math.round(CHUTE.forkLen * 0.3) + k * CHUTE.padSpacing,
              lat: laneCentre(fork, lane),
              kind: k % 3 === 1 ? 'rapid' : k % 3 === 2 ? 'ward' : 'burst',
            });
          }
        }
        s = to + CHUTE.featureGap;
      }
      // now and then a lone plate on the plain track between features
      if (rand.float(0, 1) < 0.35) {
        plan.pads.push({
          s: Math.round(s - CHUTE.featureGap * 0.5),
          lat: rand.float(-0.4, 0.4) * CHUTE.halfW,
          kind: rand.pick(['burst', 'rapid', 'ward']),
        });
      }
    }

    // ---- stars: the turbo tank's refill, strung the length of the road ----
    {
      const first = CHUTE.featureFirst + 200;
      const last = length - 260;
      const step = (last - first) / CHUTE.stars;
      for (let i = 0; i < CHUTE.stars; i++) {
        const at = Math.round(first + i * step);
        // a star sits in the middle of the road — unless a split has opened
        // there, in which case it sits in the plain lane, so the lane with the
        // prize on it is still the one with the prize on it
        const fork = plan.forks.find((f) => at > f.from + 200 && at < f.to - 200);
        plan.stars.push({ s: at, lat: fork ? laneCentre(fork, -fork.lane) : 0, kind: 'star' });
      }
      // and they are pickups like any other, so the road only has one list
      plan.pads.push(...plan.stars);
    }

    // ---- gates, kept clear of anything that changes the shape of the road ----
    // A gate is also a reset point: a hull that falls into a rift is put back on
    // the last one it passed, so a gate inside a ramp or a hole would drop it
    // straight back into the thing it just failed.
    const spans = [...plan.ramps, ...plan.gaps, ...plan.forks, ...plan.pinches];
    for (let g = CHUTE.gateFirst; g < length; g += CHUTE.gateEvery) {
      let at = Math.round(g);
      let moved = true;
      for (let pass = 0; pass < 4 && moved; pass++) {
        moved = false;
        for (const f of spans) {
          if (at > f.from - 80 && at < f.to + 80) {
            at = Math.round(f.to + 100);
            moved = true;
          }
        }
      }
      if (at > length - 500) continue; // no cheap gate on the run to the line
      if (plan.gates.length && at - plan.gates[plan.gates.length - 1] < 420) continue;
      plan.gates.push(at);
    }
    plan.gates.push(length); // the line

    this._planKey = key;
    this._plan = plan;
    return plan;
  }

  /** A one-line read of the track the rig is about to lay — what is on it. */
  _chuteRead() {
    const p = this._chutePlan();
    const jumps = p.ramps.filter((r) => !r.lane).length;
    const rifts = p.ramps.filter((r) => r.lane).length;
    const field = CHUTE.rivals + 1;
    return `${field} flying · ${p.gates.length} gates · ${jumps} jumps · ${p.forks.length} splits · ${rifts} lane rifts · ${p.pinches.length} squeezes · ${p.stars.length} stars · ${p.pads.length - p.stars.length} plates`;
  }

  /**
   * The track itself, in wire and phosphor: a rib every ringEvery units with
   * rails down the corners, chevrons painted on the road, a gate to pass, ramps
   * with holes after them, squeezes where the road pulls in and splits where it
   * opens out around a divider. Ribs and rails are left out across a rift,
   * because a hole in the course has to be a hole a pilot can see.
   */
  _buildChute() {
    const plan = this._chutePlan();
    // a copy per match: the plan is shared with the lobby, the match owns its own
    this.chute = {
      ...plan,
      gates: [...plan.gates],
      ramps: plan.ramps.map((r) => ({ ...r })),
      gaps: plan.gaps.map((g) => ({ ...g })),
      forks: plan.forks.map((f) => ({ ...f })),
      pinches: plan.pinches.map((n) => ({ ...n })),
      pads: plan.pads.map((p) => ({ ...p })),
    };
    const length = this.chute.length;

    const addWire = (pts, color, opacity) => {
      const arr = new Float32Array(pts.length * 3);
      for (let i = 0; i < pts.length; i++) {
        arr[i * 3] = pts[i].x;
        arr[i * 3 + 1] = pts[i].y;
        arr[i * 3 + 2] = pts[i].z;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const obj = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
        color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      this.scene.add(obj);
      this.terrain.push(obj);
      return obj;
    };
    /** A point on the road: `s` along it, `lat` across it, `air` above it. */
    const at = (s, lat, air) => {
      const f = this._chuteFrame(s, this._cFrame);
      const c = this._chutePoint(s, this._c1).clone();
      return c.addScaledVector(f.side, lat).addScaledVector(f.up, air);
    };
    /** One chevron on the road, pointing down the track. */
    const chevron = (list, s, lat, size, air) => {
      list.push(
        at(s, lat - size, air), at(s + size * 1.7, lat, air),
        at(s + size * 1.7, lat, air), at(s, lat + size, air),
      );
    };
    /** A cross-section of the road at `s`: floor left/centre/right, roof. */
    const section = (s) => {
      const half = this._chuteHalf(s);
      const h = CHUTE.halfH;
      return {
        half,
        p: [
          at(s, -half, -h), at(s, 0, -h), at(s, half, -h), at(s, half, h), at(s, -half, h),
        ],
      };
    };
    const laneGone = (s, side) => this.chute.gaps.some((g) => g.lane === side && s >= g.from && s < g.to);

    // ---- the tube: ribs and rails, following the road's width ----
    const wire = [];
    let prev = null;
    for (let s = 0; s <= length; s += CHUTE.ringEvery) {
      const cur = section(s);
      const goneL = laneGone(s, -1);
      const goneR = laneGone(s, 1);
      // walls, floors and the centre line, per lane — the roof always stays, so
      // a rift still reads as a hole in the road rather than the end of space
      if (!goneL) { wire.push(cur.p[4], cur.p[0], cur.p[0], cur.p[1]); }
      if (!goneR) { wire.push(cur.p[1], cur.p[2], cur.p[2], cur.p[3]); }
      wire.push(cur.p[3], cur.p[4]);
      if (prev) {
        if (!goneL && !prev.goneL) wire.push(prev.p[0], cur.p[0], prev.p[4], cur.p[4]);
        if (!goneR && !prev.goneR) wire.push(prev.p[2], cur.p[2], prev.p[3], cur.p[3]);
        if (!(goneL && goneR) && !(prev.goneL && prev.goneR)) wire.push(prev.p[1], cur.p[1]);
      }
      prev = { p: cur.p, goneL, goneR };
    }
    addWire(wire, 0x2cff9a, 0.42);

    // ---- the gates: the line itself, and one to be sent back to after a rift ----
    const gateWire = [];
    for (const g of this.chute.gates) {
      const c = section(g);
      for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 4]]) gateWire.push(c.p[i], c.p[j]);
      if (g === length) {
        const d = section(g - 8);
        for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 4]]) gateWire.push(d.p[i], d.p[j]);
      }
    }
    addWire(gateWire, 0xffe66b, 0.7);

    // ---- the road markings: what the track is about to ask of a pilot ----
    const marks = [];
    for (let s = CHUTE.ringEvery * 2; s < length; s += CHUTE.chevEvery) {
      const goneL = laneGone(s, -1);
      const goneR = laneGone(s, 1);
      if (goneL && goneR) continue;
      const deck = this._chuteDeck(s, 0) - 7;
      for (const side of [-1, 1]) {
        if (side < 0 ? goneL : goneR) continue;
        const mid = side * this._chuteHalf(s) * 0.45;
        chevron(marks, s, mid, 13, deck);
      }
    }
    addWire(marks, 0x2cff9a, 0.2);

    // ---- what is coming: a split, a squeeze, or a rift in the lane you are in ----
    const warn = [];
    for (const f of this.chute.forks) {
      const deck = this._chuteDeck(f.from, 0) - 7;
      for (const side of [-1, 1]) {
        const mid = laneCentre(f, side);
        chevron(warn, f.wide - 30, mid, 18, deck);
        chevron(warn, f.wide + 40, mid, 18, deck);
      }
    }
    for (const n of this.chute.pinches) {
      const deck = this._chuteDeck(n.from, 0) - 7;
      for (const side of [-1, 1]) {
        const mid = side * CHUTE.halfW * 0.5;
        chevron(warn, n.from - 120, mid, 15, deck);
      }
    }
    for (const g of this.chute.gaps) {
      if (!g.lane) continue;
      // hard chevrons down the lane that owns the rift: this one has to be jumped
      const fork = this.chute.forks.find((f) => g.from >= f.from && g.from <= f.to) || { halfW: CHUTE.halfW };
      const mid = laneCentre(fork, g.lane);
      const deck = this._chuteDeck(g.from, mid) - 7;
      for (const back of [300, 240, 180]) chevron(warn, g.from - back, mid, 20, deck);
    }
    addWire(warn, 0xffb45c, 0.34);

    // ---- the divider islands: what turns a split into two ways through ----
    const isle = [];
    const floor = -CHUTE.halfH;
    for (const f of this.chute.forks) {
      let prevI = null;
      for (let s = f.from; s <= f.to; s += CHUTE.ringEvery * 0.5) {
        const half = this._chuteIsland(s);
        const base = at(s, 0, floor);
        const top = at(s, 0, floor + CHUTE.islandH);
        const l = at(s, -half, floor + CHUTE.islandH);
        const r = at(s, half, floor + CHUTE.islandH);
        isle.push(l, top, r, top, l, base, r, base);
        if (prevI) isle.push(prevI.l, l, prevI.r, r, prevI.top, top);
        prevI = { l, r, top };
      }
    }
    addWire(isle, 0xffb45c, 0.45);

    this._buildChutePads();
  }

  /** The pickups themselves: wire diamonds, and stars for the turbo tank. */
  _buildChutePads() {
    const geo = new THREE.OctahedronGeometry(9);
    const edges = new THREE.EdgesGeometry(geo);
    // a five-pointed star, extruded thin, for the turbo tank's refill
    const starGeo = (() => {
      const shape = new THREE.Shape();
      const spikes = 5;
      const outer = 11;
      const inner = 4.6;
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 ? inner : outer;
        const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      }
      shape.closePath();
      return new THREE.ExtrudeGeometry(shape, { depth: 2.4, bevelEnabled: false });
    })();
    const starEdges = new THREE.EdgesGeometry(starGeo);
    for (const pad of this.chute.pads) {
      const star = pad.kind === 'star';
      const g = new THREE.Group();
      const m = new THREE.Mesh(star ? starGeo : geo, new THREE.MeshBasicMaterial({
        color: star ? 0x2a2408 : 0x171305, transparent: true, opacity: 0.8, depthWrite: false,
      }));
      m.add(new THREE.LineSegments(star ? starEdges : edges, new THREE.LineBasicMaterial({
        color: CHUTE_PAD_COLORS[pad.kind] || PAD_COLOR,
        transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
      })));
      g.add(m);
      this.scene.add(g);
      this.terrain.push(g);
      pad.group = g;
      pad.mesh = m;
      pad.alive = true;
      pad.respawn = 0;
      pad.phase = this.rng.float(0, 10);
      this._seatChute(g, pad.s, pad.lat, this._chuteDeck(pad.s, pad.lat) + CHUTE.padHover, 0);
    }
  }

  /** One hull on the grid, in the chute's own terms. */
  _makeChutePilot(i) {
    const isPlayer = i === 0;
    const def = SHIP_BY_ID[this._pilotShipId(i)] || SHIP_BY_ID.wayfarer;
    const color = isPlayer ? PLAYER_COLOR : CHUTE_COLORS[(i - 1) % CHUTE_COLORS.length];
    const loadout = isPlayer
      ? {
        weapons: this.state.weapons || def.defaultWeapons,
        outfits: this.state.outfits || {},
        mountCap: computeStats(this.state).mounts,
        showEmpty: true,
      }
      : { weapons: def.defaultWeapons || ['pulse', null] };
    const { group, api } = buildShip(def, { accent: color, isPlayer, loadout });
    vectorize(group, color);
    group.scale.setScalar(clamp(HULL_LEN / Math.max(14, def.len), 0.3, 1.5));
    this.scene.add(group);

    const shieldGlow = glowSprite(0x9fd8ff, 30);
    shieldGlow.visible = false;
    group.add(shieldGlow);

    const mounts = this._mountsFor(isPlayer, def);
    const p = {
      name: isPlayer ? this.commander : this._callsigns[(i - 1) % this._callsigns.length],
      isPlayer, color, def, group, api, shieldGlow,
      mounts,
      mountCd: mounts.map(() => this.rng.float(0, 0.5)),
      // the grid: the commander on the line with the others strung out behind
      // the grid: the commander on the line, the rest strung out behind in a
      // long field so nobody is shooting anybody off the bumper at the start
      s: -Math.round(CHUTE.gridGap * i * 1.7),
      lat: (i % 2 ? 1 : -1) * 15,
      air: 0, vy: 0, speed: 0,
      alive: true, hull: HULL, hullMax: HULL,
      score: 0, elims: 0,
      // and nobody shoots for the first couple of seconds: a six-pilot grid
      // that opens fire on the line is a firing squad, not a race
      fireCd: 1.8 + i * 0.5,
      wallT: -99, flashUntil: -1, wobble: this.rng.float(0, 1) * 10,
      turbo: 0, turboCharge: 1, daze: 0, spoilGuard: 0, finishAt: null,
      // the race: gates passed, the lane a pilot has committed to in a split,
      // the power it is holding, and the place they last heard about
      gates: 0, lane: 0, forkId: 0, place: 1, showPlace: null,
      boost: 0, rapid: 0, warnFork: 0, warnRift: 0, warnPinch: 0, stars: 0,
      // the grid slot sets how hard a rival dares to fly: the pole sitter is
      // as quick as the commander, the back of the grid is not
      skill: isPlayer ? 1 : Math.max(0.9, CHUTE.rivalTop - i * CHUTE.rivalFall),
      // and the lever sits part open on the line: a race is something a pilot
      // opens up, not something the rig does on its own
      throttle: isPlayer ? CHUTE.gridLever : 1,
    };
    this._seatChute(group, p.s, p.lat, p.air, 0);
    return p;
  }

  _startChute() {
    this.match = { mode: 'chute', time: 0, over: false };
    this.simReach = 1;
    this._buildChute();
    this.orbGroup.visible = false;
    this.pilots = [];
    this._callsigns = this.rng.shuffle(CALLSIGNS);
    for (let i = 0; i <= CHUTE.rivals; i++) this.pilots.push(this._makeChutePilot(i));
    for (const sm of this.shotPool) sm.visible = false;
    this.shots.length = 0;
    this._place = 1;

    this.lobby.classList.add('hidden');
    this.over.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this._buildRivalBoard();
    this.hud.querySelector('.vh-mode').textContent = `${MODE_INFO.chute.name.toUpperCase()} · THE SPIRAL · ${MODE_INFO.chute.line}`;
    audio.dock();
    this._announce(`CHUTE RUN — ${this._chuteRead().toUpperCase()}`);  }

  /**
   * A hull that goes into a gap loses the race rather than the match: back to
   * the last gate it passed, with enough drive under it to clear the jump it
   * just missed — a hull sent back at a crawl loops there forever, and a race
   * with a pilot stuck in it is not a race.
   */
  _chuteFall(p) {
    const passed = this.chute.gates.filter((g) => g <= p.s);
    const gate = passed.length ? passed[passed.length - 1] : 0;
    p.s = gate;
    p.lat = 0;
    p.air = 0;
    p.vy = 0;
    p.speed = Math.max(70, CHUTE.rampMin * 1.35);
    p.daze = 0;
    this._burstAt(this._chuteWorld(p, this._c6, 8), 0xff6b7a, 1.1);
    if (p.isPlayer) this._pop('IN THE RIFT — BACK TO THE LAST GATE', '#ff9a6b');
  }

  /** Ramps, gravity and holes: the whole of the chute floor, in one place. */
  _chuteDeckStep(p, prev, dt) {
    const deck = this._chuteDeck(p.s, p.lat);
    // A ramp that ends under a hull throws it from the lip — and only if it came
    // in fast, because the gap after a ramp is wider than a slow hull can cross.
    // This has to be read off the crossing itself: by the time a hull is over
    // the lip the deck under it is already the hole it is flying across.
    for (const r of this.chute.ramps) {
      if (!this._chuteInLane(p.lat, r.lane)) continue;
      if (prev < r.to && p.s >= r.to && p.speed > CHUTE.rampMin) {
        p.air = Math.max(p.air, CHUTE.rampRise);
        p.vy = CHUTE.air;
      }
    }
    const inGap = this._inGap(p.s, p.lat);
    if (p.air > deck + 0.01 || p.vy > 0) {
      p.vy -= CHUTE.gravity * dt;
      p.air += p.vy * dt;
      if (p.air <= deck && !inGap) { p.air = deck; p.vy = 0; }
    } else {
      p.air = deck;
      p.vy = 0;
    }
    // a hull with no floor under it and nothing pushing it up is in the rift
    if (inGap && p.air <= 0.001 && p.vy <= 0) this._chuteFall(p);
  }

  _chutePlayer(p, dt) {
    let steer = 0;
    if (this._keys.has('KeyA') || this._keys.has('ArrowLeft')) steer -= 1; // to port
    if (this._keys.has('KeyD') || this._keys.has('ArrowRight')) steer += 1; // to starboard
    p.lat += steer * CHUTE.turn * dt;
    // The power lever. W winds it on and S winds it off, and the drive chases
    // the setting — so a pilot can hold a speed through a squeeze, feather it
    // over a ramp, or open it right up on the straights.
    const up = this._keys.has('KeyW') || this._keys.has('ArrowUp');
    const down = this._keys.has('KeyS') || this._keys.has('ArrowDown');
    if (up) p.throttle = Math.min(1, p.throttle + CHUTE.leverUp * dt);
    if (down) p.throttle = Math.max(0, p.throttle - CHUTE.leverDown * dt);
    this._spendTurbo(p, this._keys.has('ShiftLeft') || this._keys.has('ShiftRight'), dt);
    this._chuteDrive(p, this._chuteWant(p), dt);
    if (this._keys.has('Space')) this._fire(p);
  }

  /** Which lane of a split a rival takes: the one that asks less of it. */
  _chutePickLane(p, fork) {
    if (fork.flavour === 'plates') return fork.lane; // the plates are the prize
    // a rift is a jump, and most pilots would rather not: the field takes it
    // about one time in six, which is enough to keep a commander guessing
    if (this.rng.float(0, 1) < 0.16) return fork.lane;
    return -fork.lane;
  }

  /**
   * A rival's race: hold a lane, take the plates it likes, spend the reserve on
   * the straights, and put a bolt into whoever is just far enough ahead to be
   * worth spoiling.
   */
  _chuteAi(p, dt) {
    p.wobble += dt;
    const half = this._chuteHalf(p.s);
    let want = Math.sin((p.s + p.wobble * 90) / 320) * half * 0.3;

    // A split is a commitment: the island does not negotiate, so a rival picks
    // a lane while there is still road between the two of them, and once the
    // nose is past it flies the lane it is already in.
    const fork = this.chute.forks.find((f) => p.s > f.wide - 360 && p.s < f.to + 60);
    if (fork) {
      if (p.s >= fork.from + CHUTE.forkMouth) p.lane = p.lat >= 0 ? 1 : -1;
      else if (p.forkId !== fork.from) { p.forkId = fork.from; p.lane = this._chutePickLane(p, fork); }
      if (p.lane) want = laneCentre(fork, p.lane);
    } else {
      p.lane = 0;
      p.forkId = 0;
    }

    // plates are worth a detour while there is road to take one on
    let plate = null;
    for (const pad of this.chute.pads) {
      if (!pad.alive || pad.s <= p.s || pad.s - p.s > CHUTE.rivalLook) continue;
      const lane = Math.abs(pad.lat) > CHUTE.halfW * 0.5 ? Math.sign(pad.lat) : 0;
      if (lane && p.lane && lane !== p.lane) continue;
      if (!plate || pad.s < plate.s) plate = pad;
    }
    if (plate) want = plate.lat;

    // The lever drives the AI too: wide open on the straights, feathered
    // through a squeeze, and lit for a ramp it is fast enough to clear.
    p.lat += clamp(want - p.lat, -CHUTE.turn * 0.85 * dt, CHUTE.turn * 0.85 * dt);
    const squeezed = this.chute.pinches.some((n) => p.s > n.from - 120 && p.s < n.to + 120);
    const dazed = p.daze > 0;
    p.throttle = dazed ? 0.55 : squeezed ? 0.72 : 1;
    this._spendTurbo(p, !dazed && !squeezed && p.speed > 190, dt);
    this._chuteDrive(p, this._chuteWant(p), dt, true);

    let ahead = null;
    for (const q of this.pilots) {
      if (q === p || q.finishAt != null || q.spoilGuard > 0) continue;
      const lead = q.s - p.s;
      // a firing solution, not a tap on the bumper
      if (lead > 220 && lead < CHUTE.rivalGunRange && Math.abs(q.lat - p.lat) < CHUTE.hitSpan) {
        if (!ahead || lead < ahead.s - p.s) ahead = q;
      }
    }
    if (ahead && p.fireCd <= 0) {
      if (this._fire(p)) p.fireCd = CHUTE.rivalTrigger + this.rng.float(0, 0.9);
    }
  }

  /** A bolt up the chute: it carries the gun's reach and spoils what it hits. */
  _chuteLoose(p, w, mount) {
    const mesh = this.shotPool.find((m) => !m.visible);
    if (!mesh) return false;
    mesh.visible = true;
    mesh.geometry = this.shotGeos[w.kind] || this.shotGeos.laser;
    this._col.setHex(w.color);
    if (!p.isPlayer) this._col.lerp(this._col2.setHex(p.color), 0.45);
    mesh.material.color.copy(this._col);
    this.shots.push({
      s: p.s + 18 + mount * 2,
      lat: p.lat + (mount % 2 ? 7 : -7),
      air: p.air,
      vel: w.speed,
      life: w.life,
      owner: p,
      mesh,
    });
    audio.laser(w.kind === 'beam', 0.5);
    return true;
  }

  /** A pickup, taken: a plate's gift, or a star for the turbo tank. */
  _chuteTake(p, pad) {
    pad.alive = false;
    pad.group.visible = false;
    pad.respawn = CHUTE.padRespawn;
    this._burstAt(this._chuteWorld(p, this._c6, 4), CHUTE_PAD_COLORS[pad.kind] || PAD_COLOR, 0.7);
    audio.coin();
    if (pad.kind === 'star') {
      // a star tops the tank up, so the reserve is something a pilot can earn
      // back on the road instead of only waiting for it
      p.turboCharge = Math.min(1, p.turboCharge + CHUTE.starTop);
      p.stars = (p.stars || 0) + 1;
      if (p.isPlayer) this._pop(`STAR — TURBO ${Math.round(p.turboCharge * 100)}%`, CHUTE_PAD_CSS.star);
      return;
    }
    if (pad.kind === 'burst') p.boost = 3.2;
    else if (pad.kind === 'rapid') p.rapid = 6;
    else p.spoilGuard = Math.max(p.spoilGuard, 4);
    if (p.isPlayer) this._pop(CHUTE_PAD_NAMES[pad.kind] || 'PLATE', CHUTE_PAD_CSS[pad.kind] || '#fff1a8');
  }

  /** Plates float over the road, turn, and come back a while after they are taken. */
  _chutePadsStep(dt) {
    for (const pad of this.chute.pads) {
      pad.phase += dt;
      if (pad.respawn > 0) {
        pad.respawn -= dt;
        if (pad.respawn <= 0) { pad.alive = true; pad.group.visible = true; }
        continue;
      }
      const h = this._chuteDeck(pad.s, pad.lat) + CHUTE.padHover + Math.sin(pad.phase * 2.6) * 3;
      this._seatChute(pad.group, pad.s, pad.lat, h, 0);
      pad.mesh.rotation.y += dt * 1.8;
      if (!pad.alive) continue;
      for (const p of this.pilots) {
        if (p.finishAt != null) continue;
        if (Math.abs(p.s - pad.s) < CHUTE.padR && Math.abs(p.lat - pad.lat) < CHUTE.padR) {
          this._chuteTake(p, pad);
          break;
        }
      }
    }
  }

  /** Nothing is shot down out here: a hit takes a rival's drive, not its hull. */
  _chuteHit(victim, shooter) {
    // and a hull that has just been spoiled gets a moment: three rivals who can
    // chain-stun one pilot would make the race a firing squad, not a race
    if (victim.spoilGuard > 0) return;
    victim.spoilGuard = CHUTE.spoilGuard;
    victim.daze = Math.max(victim.daze, CHUTE.daze);
    this._burstAt(this._chuteWorld(victim, this._c6, 6), victim.color, 0.9);
    audio.hit();
    if (shooter?.isPlayer) victim.flashUntil = this.t + 0.35;
    if (victim.isPlayer) this._pop('DRIVE SPOILED', '#ff9a6b');
  }

  _chuteStepShots(dt) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const sh = this.shots[i];
      sh.life -= dt;
      sh.s += sh.vel * dt;
      let dead = sh.life <= 0 || sh.s > this.chute.length + 40;
      if (!dead) {
        // the divider of a split eats anything that flies into it
        const isle = this._chuteIsland(sh.s);
        if (isle > 0 && Math.abs(sh.lat) < isle + 2) dead = true;
      }
      if (!dead) {
        for (const q of this.pilots) {
          if (q === sh.owner || !q.alive || q.finishAt != null) continue;
          if (Math.abs(q.s - sh.s) < CHUTE.hitSpan && Math.abs(q.lat - sh.lat) < CHUTE.hitSpan) {
            this._chuteHit(q, sh.owner);
            dead = true;
            break;
          }
        }
      }
      if (dead) {
        sh.mesh.visible = false;
        this.shots.splice(i, 1);
        continue;
      }
      this._seatChute(sh.mesh, sh.s, sh.lat, sh.air, 0);
    }
  }

  /**
   * One frame of the race, with nothing in it that needs a screen: the audit
   * flies this exact function headlessly, so a chute that cannot be finished
   * cannot pass either.
   */
  _chuteStep(dt) {
    const m = this.match;
    for (const p of this.pilots) {
      if (p.finishAt != null) {
        // home: the hull coasts on past the line and stops
        p.speed *= Math.max(0, 1 - 1.4 * dt);
      } else {
        p.daze = Math.max(0, p.daze - dt);
        p.spoilGuard = Math.max(0, p.spoilGuard - dt);
        p.boost = Math.max(0, p.boost - dt);
        p.rapid = Math.max(0, p.rapid - dt);
        p.fireCd = Math.max(0, p.fireCd - dt);
        for (let i = 0; i < p.mountCd.length; i++) p.mountCd[i] = Math.max(0, p.mountCd[i] - dt);
        if (p.isPlayer) this._chutePlayer(p, dt);
        else this._chuteAi(p, dt);
      }
      const prev = p.s;
      if (p.finishAt == null) p.s += p.speed * dt;
      this._chuteDeckStep(p, prev, dt);
      // The walls are wherever the road is right now — it opens out at a split
      // and pulls in at a squeeze — and they let a hull slide: there is nothing
      // to stick to and nowhere to be pinned.
      const lim = this._chuteHalf(p.s) - CHUTE.hullSide;
      if (p.lat > lim || p.lat < -lim) {
        p.lat = clamp(p.lat, -lim, lim);
        p.wallT = this.t;
        p.speed *= 0.985;
      }
      // The divider of a split is just as solid, and it does not budge: a hull
      // that reaches it is put out into the lane it was already flying.
      const isle = this._chuteIsland(p.s);
      if (isle > 0) {
        const need = isle + CHUTE.hullSide;
        if (Math.abs(p.lat) < need) {
          p.lat = (p.lat >= 0 ? 1 : -1) * need;
          p.wallT = this.t;
          p.speed *= 0.985;
        }
      }
      // gates, and the running commentary a pilot races against
      while (p.gates < this.chute.gates.length && p.s >= this.chute.gates[p.gates]) {
        p.gates += 1;
        if (p.isPlayer) {
          this._pop(p.gates === this.chute.gates.length ? 'THE LINE' : `GATE ${p.gates} OF ${this.chute.gates.length}`, '#7dffa8');
        }
      }
      if (p.isPlayer) {
        const place = this._chutePlace(p);
        if (p.showPlace !== place) {
          if (p.showPlace != null) {
            this._pop(place < p.showPlace ? `P${place} — TAKEN` : `P${place} — LOST`, place < p.showPlace ? '#7dffa8' : '#ffb45c');
          }
          p.showPlace = place;
        }
      }
      if (p.finishAt == null && p.s >= this.chute.length) {
        p.finishAt = m.time;
        p.s = this.chute.length;
        if (p.isPlayer) {
          m.playerHome = true;
        } else {
          this._pop(`${p.name} IS HOME`, cssHex(p.color));
        }
      }
      this._seatChute(p.group, p.s, p.lat, p.air, 0);
      if (p.api) {
        p.api.pulse(this.t);
        p.api.setThrottle(clamp(p.speed / 200, 0.08, 1));
      }
    }
    this._chuteStepShots(dt);
  }

  _chuteUpdate(dt) {
    const m = this.match;
    m.time += dt;
    this._chuteStep(dt);
    this._chutePadsStep(dt);
    this._stepBursts(dt);
    this._chuteCall();
    if (m.playerHome) {
      this._announce(`THE LINE — ${m.time.toFixed(1)}s`);
      m.over = true;
      this._finishMatch();
      return;
    }
    this._updateHud();
    // the rig calls it, so a race nobody can finish is still a result
    if (m.time > CHUTE.callTime) {
      m.over = true;
      this._finishMatch();
    }
  }

  /** What the road is about to ask of the commander, called out in time. */
  _chuteCall() {
    const me = this.pilots[0];
    if (!me) return;
    const fork = this.chute.forks.find((f) => me.s > f.wide - 420 && me.s < f.wide);
    if (fork && me.warnFork !== fork.from) {
      me.warnFork = fork.from;
      this._pop('SPLIT AHEAD — PICK A LANE', '#ffb45c');
    }
    const rift = this.chute.gaps.find((g) => g.lane && me.s > g.from - 400 && me.s < g.from && this._chuteInLane(me.lat, g.lane));
    if (rift && me.warnRift !== rift.from) {
      me.warnRift = rift.from;
      this._pop('RIFT IN THIS LANE — JUMP IT', '#ff6b7a');
    }
    const pinch = this.chute.pinches.find((n) => me.s > n.from - 320 && me.s < n.from);
    if (pinch && me.warnPinch !== pinch.from) {
      me.warnPinch = pinch.from;
      this._pop('SQUEEZE AHEAD', '#8fd0ff');
    }
  }

  /* ------------------------------------------------------------------ */
  /* Results                                                            */
  /* ------------------------------------------------------------------ */

  _finishMatch() {
    const m = this.match;
    if (m.finished) return;
    m.finished = true;
    m.over = true;
    const p = this.pilots[0];
    // Walking out is not staying on top of anything: a pilot who leaves the
    // field finishes behind everyone still flying it.
    const place = m.mode === 'duel'
      ? (m.forfeit ? 1 + this.pilots.filter((q) => !q.isPlayer && q.alive).length : this._place)
      : m.mode === 'chute'
        ? (m.forfeit ? this.pilots.length : this._chutePlace(p))
        : this._harvestPlace();
    const score = m.mode === 'duel' ? p.elims : m.mode === 'chute' ? 0 : p.score;
    const { payout, xp } = this._payout(m.mode, place, score, m.forfeit);
    const result = {
      mode: m.mode,
      place,
      score,
      payout,
      xp,
      forfeit: !!m.forfeit,
      note: '',
      timeSec: m.mode === 'chute' ? m.time : null,
    };
    const ordinal = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth'][place] || `${place}th`;
    result.note = m.forfeit
      ? 'You stepped out before the field was settled. The circuit pays nothing for a walk.'
      : m.mode === 'duel'
        ? `Eliminations: ${p.elims}. ${place === 1 ? 'Both rivals down — the purse is yours.' : 'The field keeps flying without you.'}`
        : m.mode === 'chute'
          ? `Home in ${m.time.toFixed(1)}s — ${ordinal} of ${this.pilots.length}. ${place === 1 ? 'The line is yours.' : 'Someone else read the chute better.'}`
          : `${p.score} crystal${p.score === 1 ? '' : 's'} hauled. ${place === 1 ? 'The clock agrees: yours.' : 'Someone else read the field better.'}`;
    result.note += m.mode === 'chute'
      ? ` Flown down the spiral, bracket ${this.tier}.`
      : ` Flown on ${this.orb.name}, bracket ${this.tier}.`;
    this._showResults(result);
    this.onFinish?.(result);
  }

  _harvestPlace() {
    const sorted = [...this.pilots].sort((a, b) => b.score - a.score || b.elims - a.elims);
    return sorted.indexOf(this.pilots[0]) + 1;
  }

  _payout(mode, place, score, forfeit) {
    if (forfeit) return { payout: 0, xp: 0 };
    if (mode === 'chute') {
      // a race pays for the place, and the bracket raises the stake
      const credits = place === 1 ? 1500 + (this.tier - 1) * 130 : Math.max(160, 520 - (place - 2) * 90);
      const xpr = (place === 1 ? 120 : 45) + this.tier * 6;
      return { payout: Math.min(4000, Math.round(credits)), xp: Math.min(250, Math.round(xpr)) };
    }
    if (mode === 'duel') {
      const credits = Math.round((place === 1 ? 1200 : 250) + score * 450);
      return { payout: Math.min(4000, credits), xp: Math.min(250, 30 + score * 50) };
    }
    const credits = Math.round(250 + score * 120 + (place === 1 ? 900 : 0));
    return { payout: Math.min(3500, credits), xp: Math.min(250, 20 + score * 25) };
  }

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */

  _render(dt) {
    if (this.match && !this.match.over) {
      const p = this.pilots[0];
      if (p && this.chute) {
        // in the chute the rig rides the track itself, banked with the spiral
        const f = this._chuteFrame(p.s, this._cFrame);
        this._chutePoint(p.s - CHUTE.camBack, this._c1);
        this._c1.addScaledVector(f.side, p.lat).addScaledVector(f.up, p.air + CHUTE.camUp);
        this.camera.position.lerp(this._c1, 1 - Math.pow(0.0025, dt));
        this.camera.up.copy(f.up);
        this._chutePoint(p.s + CHUTE.camLook, this._c2);
        this.camera.lookAt(this._c2);
      } else if (p) {
        const h = this.groundAt(p.u) + p.y;
        // over the shoulder but well up off the deck: standing high on the
        // local vertical is what buys the long view, and on an orb the horizon
        // is only ever as far away as the rig is tall
        const pos = this._pointAt(p.u, h + this.camUp, this._w1)
          .addScaledVector(p.fwd, -this.camBack);
        const k = 1 - Math.pow(0.0025, dt);
        this.camera.position.lerp(pos, k);
        this.camera.up.copy(p.u);
        this._ahead(p.u, p.fwd, this.camLook, this._w2);
        this._pointAt(this._w2, this.groundAt(this._w2) + p.y + CAM_AIM_H, this._w3);
        this.camera.lookAt(this._w3);
      }
    } else if (this.chute) {
      // between races the rig shows the spiral, slow and stately
      const a = this.t * 0.12;
      this._chutePoint(this.chute.length * 0.5, this._c1);
      this.camera.up.set(0, 1, 0);
      this.camera.position.set(
        this._c1.x + Math.sin(a) * 900,
        this._c1.y + 420,
        this._c1.z + Math.cos(a) * 900,
      );
      this.camera.lookAt(this._c1);
    } else {
      // between matches the rig shows the whole orb, slow and stately
      const a = this.t * 0.12;
      this.camera.up.set(0, 1, 0);
      this.camera.position.set(Math.sin(a) * this.orbR * 1.75, this.orbR * 0.65, Math.cos(a) * this.orbR * 1.75);
      this.camera.lookAt(0, 0, 0);
    }
    this.renderer.render(this.scene, this.camera);
  }
}
