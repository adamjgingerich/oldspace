// Geometry and gun audit for the Vector Challenge.
//
//   node tools/audit-vector.mjs
//
// The sim keeps every hull, shot, crystal and barrier as a direction from the
// orb's centre with a heading along the surface, so a mistake in that maths
// shows up as a ship sliding sideways, a barrier that is solid an inch from
// where it is drawn, a hull parked inside a wall, or a bolt that freezes in
// mid-air because it and the next gun share a vector. None of that needs a
// browser to check, and ground truth comes from three.js itself: barriers are
// measured against a real Object3D seated the way the sim seats the mesh, so a
// collision frame that has drifted from what is drawn cannot pass.
import * as THREE from 'three';
import { VectorChallenge, simWeapon, ZONE_COUNTS, courseRadius, CHUTE_SPEC } from '../src/game/vector.js';
import { WEAPONS, WEAPON_BY_ID } from '../src/data/weapons.js';

// The tightest orb on the circuit, and the widest. Chord-versus-arc error grows
// as the world gets smaller, so the first is the worst case the sim can be asked
// to fly; the second is where a course has the most room to be lost in.
const R = 1800;
const COURSE_ORBS = [1800, 3200];
const V3 = () => new THREE.Vector3();

let bad = 0;
const fail = (msg) => {
  console.log('BAD', msg);
  bad++;
};

/** An instance without the constructor — no DOM, no canvas, no WebGL. */
function makeOrb(orbR = R, seed = 1) {
  const v = Object.create(VectorChallenge.prototype);
  let s = seed;
  const next = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  v.rng = { float: (a, b) => a + next() * (b - a), pick: (arr) => arr[Math.floor(next() * arr.length)] };
  v.orbR = orbR;
  v.reach = orbR / 820;
  v.t = 0;
  v.walls = [];
  v.mounds = [];
  v.ramps = [];
  v.pickups = [];
  v.crystals = [];
  v._flyers = [];
  v._mv = V3();
  for (const k of ['_c1', '_c2', '_c3', '_c4', '_c5', '_c6']) v[k] = V3();
  v._cFrame = { t: V3(), side: V3(), up: V3() };
  v._cUp = new THREE.Vector3(0, 1, 0);
  for (const k of ['_s1', '_s2', '_s3', '_s4', '_s5', '_s6', '_w1', '_w2', '_w3', '_w4', '_w5']) v[k] = V3();
  v._p2 = new THREE.Vector2();
  v._q1 = new THREE.Quaternion();
  v._mat = new THREE.Matrix4();
  v._col = new THREE.Color();
  v._col2 = new THREE.Color();
  return v;
}

/** The pieces _loose and _stepShots need: a shot pool and something to burst with. */
function addShots(v, count = 8) {
  v.shotGeos = {
    laser: new THREE.BoxGeometry(1.6, 1.6, 5),
    kinetic: new THREE.BoxGeometry(2.2, 2.2, 4),
    beam: new THREE.BoxGeometry(1.1, 1.1, 16),
    missile: new THREE.OctahedronGeometry(2.4),
    disruptor: new THREE.TetrahedronGeometry(2.6),
  };
  v.shotPool = [];
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(v.shotGeos.laser, new THREE.MeshBasicMaterial());
    mesh.visible = false;
    v.shotPool.push(mesh);
  }
  v.shots = [];
  v.burstPool = [{ spr: new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial()), t: 0, max: 0.45 }];
  v.match = { mode: 'duel', time: 0, over: false };
  return v;
}

/** A pilot with guns on it, standing still, pointed at `heading`. */
function makeShooter(v, weaponId, mounts = 2, at = null) {
  const p = {
    isPlayer: true, color: 0x6effa8, y: 0, speed: 0, rapid: 0,
    alive: true, invuln: 0, respawn: 0, hull: 100, elims: 0,
    u: at ? at.clone() : v._scatter(V3()),
    mounts: Array.from({ length: mounts }, () => simWeapon(WEAPON_BY_ID[weaponId])),
    mountCd: Array.from({ length: mounts }, () => 0),
  };
  p.fwd = v._randomHeading(p.u, V3());
  return p;
}

/** A rival parked a given distance dead ahead of the shooter. */
function makeTarget(v, shooter, dist) {
  const t = {
    isPlayer: false, alive: true, invuln: 0, respawn: 0, hull: 1e6,
    speed: 0, y: 0, color: 0xff6b7a, u: v._ahead(shooter.u, shooter.fwd, dist, V3()),
  };
  t.fwd = shooter.fwd.clone();
  return t;
}

/** Barrier records laid out the way _buildTerrain lays them out. */
function makeWalls(v, count = 12) {
  const walls = [];
  const taken = [];
  const spot = () => {
    const u = V3();
    for (let i = 0; i < 240; i++) {
      v._scatter(u);
      if (taken.every((q) => v._arc(u, q) > 150)) { taken.push(u.clone()); return u; }
    }
    return u;
  };
  for (let i = 0; i < count; i++) {
    const u = spot();
    const [t1, t2] = v._frameAt(u, v.rng.float(0, Math.PI));
    walls.push(i % 3 === 0 ? { u, t1, t2, hw: 40, hd: 5, h: 22 } : { u, t1, t2, r: 20, h: 30 });
  }
  return walls;
}

const v = makeOrb();
const f = (n, d = 4) => Number(n).toFixed(d);

/** An instance with a chute built on it, and nothing that needs a screen. */
function makeChute(tier = 1, seed = 3) {
  const c = makeOrb(1800, seed);
  c.tier = tier;
  c.scene = { add() {} };
  c.terrain = [];
  c.shots = [];
  c.pilots = [];
  c.simReach = 1;
  c.t = 0;
  c.match = { mode: 'chute', time: 0, over: false };
  c._pop = () => {};
  c._announce = () => {};
  c._finishMatch = () => {};
  c._keys = new Set();
  addShots(c, 12);
  c._buildChute();
  return c;
}

/** A racer in the chute's own terms: a lane along the track, and across it. */
function makeRacer(c, i, isPlayer = false) {
  return {
    name: isPlayer ? 'CMDR' : `RACER ${i}`,
    isPlayer,
    color: 0xff6b7a,
    group: new THREE.Object3D(),
    api: { pulse() {}, setThrottle() {} },
    mounts: [simWeapon(WEAPON_BY_ID.pulse, 1)],
    mountCd: [0],
    s: -CHUTE_SPEC.gridGap * i,
    lat: 0, air: 0, vy: 0, speed: 0,
    alive: true, hull: 100, hullMax: 100,
    score: 0, elims: 0, fireCd: 0,
    wallT: -99, flashUntil: -1, wobble: i * 1.7,
    turbo: 0, turboCharge: 1, daze: 0, spoilGuard: 0, finishAt: null,
  };
}

/* ---- walking the surface ---- */
{
  const u = v._scatter(V3());
  const fwd = v._randomHeading(u, V3());
  if (Math.abs(fwd.length() - 1) > 1e-9 || Math.abs(u.dot(fwd)) > 1e-9) fail('a heading is not a unit tangent');

  const walked = v._arc(u, v._ahead(u, fwd, 123.4, V3()));
  if (Math.abs(walked - 123.4) > 1e-6) fail(`a step walks ${f(walked, 4)} of arc, not 123.4`);

  const u2 = u.clone();
  const f2 = fwd.clone();
  v._advance(u2, f2, 300);
  if (Math.abs(u2.dot(f2)) > 1e-9) fail('a step knocked the heading off the tangent');
  const astern = v._bearing(u2, f2, u);
  if (Math.abs(Math.abs(astern) - Math.PI) > 0.02) fail(`after a step the start is ${f(astern, 3)} rad off astern`);

  // all the way round the orb and back to where it started
  const u3 = u.clone();
  const f3 = fwd.clone();
  const lap = Math.PI * 2 * v.orbR;
  for (let i = 0; i < 720; i++) v._advance(u3, f3, lap / 720);
  if (v._arc(u, u3) > 1e-6 || Math.abs(f3.dot(fwd) - 1) > 1e-6) {
    fail(`a lap of the orb closes to ${f(v._arc(u, u3), 9)} units of arc`);
  }
}

/* ---- bearings, aim and the helm ---- */
{
  const u = v._scatter(V3());
  const fwd = v._randomHeading(u, V3());
  const target = v._scatter(V3());
  const turned = v._headingAt(u, fwd, v._bearing(u, fwd, target), V3());
  const residual = Math.abs(v._bearing(u, turned, target));
  if (residual > 1e-6) fail(`turning by the bearing leaves ${f(residual, 9)} rad of error`);

  if (v._bearing(u, fwd, v._headingAt(u, fwd, 0.7, V3())) < 0.69) fail('a port turn does not read positive');
  if (v._bearing(u, fwd, v._headingAt(u, fwd, -0.7, V3())) > -0.69) fail('a starboard turn does not read negative');

  const ahead = v._ahead(u, fwd, 90, V3());
  if (Math.abs(v._arc(u, ahead) - 90) > 1e-6 || Math.abs(v._bearing(u, fwd, ahead)) > 1e-6) {
    fail('_ahead does not land the asked distance dead ahead');
  }
}

/* ---- barrier frames against the mesh that gets drawn ---- */
{
  const walls = makeWalls(v, 9);
  let off = 0;
  for (const w of walls) {
    // the frame must be orthonormal, right-handed, with t2 = up x t1
    const right = V3().crossVectors(w.u, w.t1);
    if (Math.abs(w.t2.dot(right) - 1) > 1e-9) off++;
    if (Math.abs(w.t1.length() - 1) > 1e-9 || Math.abs(w.t1.dot(w.u)) > 1e-9) off++;

    // and it must seat a mesh exactly the way the sim seats the drawn one
    const node = new THREE.Object3D();
    v._seat(node, w.u, w.t1);
    node.updateMatrixWorld(true);
    const ex = V3().set(1, 0, 0).transformDirection(node.matrixWorld);
    const ey = V3().set(0, 1, 0).transformDirection(node.matrixWorld);
    const ez = V3().set(0, 0, 1).transformDirection(node.matrixWorld);
    if (Math.abs(ey.dot(w.u)) < 0.999999 || Math.abs(ex.dot(w.t1)) < 0.999999) off++;
    if (w.hw && Math.abs(Math.abs(ez.dot(w.t2)) - 1) > 1e-6) off++;
    if (Math.abs(node.position.length() - v.orbR) > 1e-6) off++;
  }
  if (off) fail(`${off} barrier frames do not match the meshes they draw`);

  // local coordinates round-trip, and three.js agrees about what is inside
  const w = walls.find((q) => q.hw);
  const node = new THREE.Object3D();
  v._seat(node, w.u, w.t1);
  node.updateMatrixWorld(true);
  let worst = 0;
  for (const [lx, lz] of [[0, 0], [39, 4], [-39, -4], [0, 5], [39, 0], [10, -5]]) {
    const spot = v._ahead(w.u, v._frameDir(w, lx, lz, V3()), Math.hypot(lx, lz), V3());
    const got = v._localTo(w, spot, new THREE.Vector2());
    worst = Math.max(worst, Math.abs(got.x - lx), Math.abs(got.y - lz));
    const local = node.worldToLocal(spot.clone());
    const drawnInside = Math.abs(local.x) < w.hw + 1e-6 && Math.abs(local.z) < w.hd + 1e-6;
    if (drawnInside !== (Math.abs(got.x) < w.hw && Math.abs(got.y) < w.hd)) worst = 999;
  }
  if (worst > 0.6) fail(`local coordinates disagree with three.js by ${f(worst, 4)} units`);
}

/* ---- flying hulls at the field ---- */
{
  const walls = makeWalls(v, 14);
  v.walls = walls;

  // an independent measure of "inside a barrier", straight from the frame
  const pen = (p, w, r) => {
    const rel = p.clone().addScaledVector(w.u, -p.dot(w.u));
    const lx = rel.dot(w.t1) * v.orbR;
    const lz = rel.dot(w.t2) * v.orbR;
    if (w.hw) {
      const ox = Math.max(Math.abs(lx) - w.hw, 0);
      const oz = Math.max(Math.abs(lz) - w.hd, 0);
      return r - Math.hypot(ox, oz);
    }
    return (w.r || 20) + r - Math.hypot(lx, lz);
  };
  const deepest = (u, r) => Math.max(...walls.map((w) => pen(u, w, r)));

  const dt = 1 / 60;
  let trapped = 0;
  let stalled = 0;
  let drift = 0;
  let worstPen = -Infinity;
  for (let t = 0; t < 2000; t++) {
    const u = v._scatter(V3());
    const fwd = v._randomHeading(u, V3());
    const p = { u, fwd, speed: v.rng.float(0, 250), collideR: 14, strafeDir: 1, wallT: -99, y: 0 };
    for (let i = 0; i < 240; i++) {
      p.speed = Math.min(250, p.speed + 240 * dt);
      v._advance(p.u, p.fwd, p.speed * dt);
      if (Math.abs(p.u.dot(p.fwd)) > 1e-6) drift++;
      v._collideWalls(p);
    }
    const d = deepest(p.u, 14);
    worstPen = Math.max(worstPen, d);
    if (d > 0.05) trapped++;
    if (p.speed < 20) stalled++;
  }
  if (trapped || stalled) fail(`2000 hulls on the field: ${trapped} stuck, ${stalled} stalled (worstPen ${f(worstPen, 3)})`);
  if (drift) fail(`collisions knocked a heading off the tangent on ${drift} frames`);

  // dropped dead centre in every barrier, a hull must be freed at once
  let inside = 0;
  let agreed = 0;
  for (const w of walls) {
    // control: the measure must agree that dead centre is inside, or the line
    // below would pass without proving anything
    if (deepest(w.u, 14) > 0) agreed++;
    const p = { u: w.u.clone(), fwd: v._frameAt(w.u)[0].clone(), speed: 100, collideR: 14, strafeDir: 1, wallT: -99, y: 0 };
    v._collideWalls(p);
    if (deepest(p.u, 14) > 0.05) inside++;
  }
  if (agreed !== walls.length) fail(`the penetration measure only saw ${agreed} of ${walls.length} barriers as solid`);
  if (inside) fail(`${inside} of ${walls.length} barriers still hold a hull dropped at their centre`);

  // a fresh hit bounces off the face; leaning on it slides the hull along
  const w = walls.find((q) => q.hw);
  const n = w.t2.clone();
  const face = v._ahead(w.u, n, w.hd, V3());
  const inward = () => v._headingAt(face, n, Math.PI, V3());
  const p = { u: face.clone(), fwd: inward(), speed: 250, collideR: 14, strafeDir: 1, wallT: -999, y: 0 };
  v._collideWalls(p);
  if (p.speed < 60 || pen(p.u, w, 14) > 0) fail(`a fresh hit left speed ${f(p.speed, 1)} and penetration ${f(pen(p.u, w, 14), 2)}`);
  p.u = face.clone();
  p.fwd = inward();
  p.speed = 250;
  p.wallT = v.t;
  v._collideWalls(p);
  if (p.speed < 245 || Math.abs(p.fwd.dot(n)) > 0.05) {
    fail(`leaning on a face left speed ${f(p.speed, 1)} and ${f(p.fwd.dot(n), 3)} into the normal`);
  }
}

/* ---- ground sampling ---- */
{
  const u = v._scatter(V3());
  const [t1, t2] = v._frameAt(u, v.rng.float(0, Math.PI));
  const frame = { u, t1, t2 };
  const at = (lx, lz) => v._ahead(u, v._frameDir(frame, lx, lz, V3()), Math.hypot(lx, lz), V3());

  v.mounds = [{ u, t1, t2, h: 18, r2: 72 * 72 }];
  const peak = v.groundAt(at(0, 0));
  const rim = v.groundAt(at(72, 0));
  if (Math.abs(peak - 18) > 0.02 || rim >= peak || v.groundAt(at(200, 0)) !== 0) {
    fail(`a hill reads ${f(peak, 2)} at its centre and ${f(rim, 2)} at its rim`);
  }

  v.mounds = [];
  v.ramps = [{ u, t1, t2, l: 40, w: 8, rise: 26, minSpeed: 150, vy: 215 }];
  const foot = v.groundAt(at(-39, 0));
  const lip = v.groundAt(at(39, 0));
  if (foot >= 1 || lip < 24) fail(`a ramp reads ${f(foot, 1)} at its foot and ${f(lip, 1)} at its lip`);
  if (v.launchAt(at(39, 0), 250) !== 215) fail('a fast hull is not thrown by a ramp');
  if (v.launchAt(at(39, 0), 100) !== 0) fail('a slow hull is thrown by a ramp');
}

/* ---- the chart's guns, as the sim flies them ---- */
{
  let low = Infinity;
  let high = 0;
  let heavy = 0;
  for (const w of WEAPONS) {
    const s = simWeapon(w);
    if (!(s.dmg > 0) || !(s.cd > 0) || !(s.speed > 0) || !(s.life > 0)) fail(`${w.id} is not a gun the sim can fly`);
    const dps = s.dmg / s.cd;
    low = Math.min(low, dps);
    high = Math.max(high, dps);
    if (s.dmg > 45 + 1e-9) heavy++;
  }
  // the pull toward the middle of the charts is the whole point: taking their
  // damage-per-second literally makes a disruptor fit a duel nobody can win
  if (low < 12) fail(`the weakest gun in the sim does ${f(low, 1)} dps — a pea-shooter`);
  if (high > 30) fail(`the strongest gun in the sim does ${f(high, 1)} dps — a duel that ends itself`);
  if (heavy) fail(`${heavy} weapons can take more than half a hull in one hit`);

  // A wider orb is fought at wider ranges — the sim fires at 320 field-widths
  // and leads by more — so the guns have to come with it. Scaling one side and
  // not the other is a field where rivals shoot from outside their own range.
  for (const orbR of COURSE_ORBS) {
    const reach = orbR / 820;
    const short = WEAPONS.filter((w) => simWeapon(w, reach).range < 320 * reach);
    if (short.length) {
      fail(`${short.length} guns cannot reach the ${Math.round(320 * reach)} units the sim fires at on the ${orbR} orb`);
    }
  }
  if (courseRadius(3200) <= courseRadius(1800) * 1.4) {
    fail(`a wider orb does not lay out a wider course: ${Math.round(courseRadius(3200))} against ${Math.round(courseRadius(1800))}`);
  }
}

/* ---- shots ---- */
{
  const g = addShots(makeOrb());
  const dt = 1 / 60;

  // two mounts fired in the same frame are two shots, each with its own course.
  // Sharing a vector between them freezes bolts in mid-air, which is exactly
  // what the sim used to do.
  const far = makeShooter(g, 'gauss', 2);
  g.pilots = [far, makeTarget(g, far, 1800)];
  if (!g._fire(far)) fail('a hull with two guns off cooldown fired nothing');
  if (g.shots.length !== 2) fail(`two mounts loosed ${g.shots.length} shots`);
  if (g.shots[0].u === g.shots[1].u || g.shots[0].dir === g.shots[1].dir) {
    fail('two shots share one position or one heading');
  }
  const from = g.shots.map((s) => s.u.clone());
  const speed = g.shots[0].speed;
  for (let i = 0; i < 30; i++) g._stepShots(dt);
  for (let i = 0; i < g.shots.length; i++) {
    const flown = g._arc(from[i], g.shots[i].u);
    if (Math.abs(flown - speed * 0.5) > 0.05 * speed * 0.5) {
      fail(`a bolt flew ${f(flown, 1)} units in half a second, not ${f(speed * 0.5, 1)}`);
    }
  }
  if (g.shots.length === 2 && g._arc(g.shots[0].u, g.shots[1].u) < 0.5) fail('two bolts in flight are stacked on each other');

  // a target on the line takes hits, at ranges and frame lengths that used to
  // swallow them whole
  const damage = (dist, step, weapon = 'gauss', mounts = 2) => {
    const v2 = addShots(makeOrb());
    const p = makeShooter(v2, weapon, mounts);
    const t = makeTarget(v2, p, dist);
    v2.pilots = [p, t];
    const before = t.hull;
    for (let i = 0; i < Math.ceil(3 / step); i++) {
      for (let k = 0; k < p.mountCd.length; k++) p.mountCd[k] = Math.max(0, p.mountCd[k] - step);
      v2._fire(p);
      v2._stepShots(step);
    }
    return before - t.hull;
  };
  for (const d of [120, 400, 900, 1100]) {
    if (damage(d, dt) <= 0) fail(`nothing lands on a target ${d} units dead ahead`);
  }
  // one frame of 0.05s carries a gauss slug further than a hull is wide, so a
  // single-point test would fly straight through the target
  if (damage(700, 0.05) <= 0) fail('a bolt skips past a target when the frame is long');
  // and the guns the commander actually flies with have to land too
  for (const w of ['snare', 'hush', 'pulse', 'flechette', 'torpedo']) {
    if (damage(400, dt, w) <= 0) fail(`${w} cannot hit a target 400 units dead ahead`);
  }
}

/* ---- wedged between barriers ---- */
{
  // Two faces pushing against each other have opposed normals, so anything
  // derived from a face — its left, the way its frame is turned — is opposed as
  // well. A hull caught between them used to be handed one direction by each and
  // cancel its own escape, which is how a pilot ends up pinned at a standstill.
  // Sim time advances here, as it does in the game: with it frozen the hull never
  // leaves the first moment of contact, which is not a state the field can be in.
  const pinned = (gap, count) => {
    const w = makeOrb();
    const origin = w._scatter(V3());
    let stalled = 0;
    let penetrating = 0;
    for (let trial = 0; trial < 120; trial++) {
      const heading = w._randomHeading(origin, V3());
      const spots = [origin.clone()];
      if (count > 1) spots.push(w._ahead(origin, heading, gap, V3()));
      if (count > 2) spots.push(w._ahead(origin, heading, -gap, V3()));
      w.walls = spots.map((u) => {
        const [t1, t2] = w._frameAt(u);
        return { u, t1: t1.clone(), t2: t2.clone(), r: 20, h: 30 };
      });
      const p = {
        u: origin.clone(), fwd: w._randomHeading(origin, V3()), speed: 250,
        collideR: 14, strafeDir: trial % 2 ? -1 : 1, wallT: -99, y: 0,
      };
      for (let i = 0; i < 420; i++) {
        w.t = i / 60;
        w._advance(p.u, p.fwd, p.speed / 60);
        w._collideWalls(p);
      }
      // where it finished only matters if it is still touching something
      const clear = Math.min(...w.walls.map((q) => w._arc(p.u, q.u))) - 34;
      if (clear < -0.05) penetrating++;
      if (p.speed < 20 && clear < 0) stalled++;
    }
    return { stalled, penetrating };
  };
  for (const count of [2, 3]) {
    for (const gap of [60, 68, 80, 100]) {
      const { stalled, penetrating } = pinned(gap, count);
      if (stalled) fail(`${stalled}/120 hulls stall wedged between ${count} barriers ${gap} apart`);
      if (penetrating) fail(`${penetrating}/120 hulls end up inside one of ${count} barriers ${gap} apart`);
    }
  }
}

/* ---- the course, as _buildTerrain actually lays it out ---- */
{
  // the tightest and the widest orb: the course has the least room on one and
  // has to still read as a course on the other
  const density = {};
  for (const orbR of COURSE_ORBS) {
    const c = makeOrb(orbR, 7);
    c.scene = { add() {} };
    c.terrain = [];
    c.orbR = orbR;
    c.zone = { u: c._scatter(V3()), r: courseRadius(orbR) };
    c._buildTerrain();

    const solids = [
      ...c.walls.map((w) => ({ u: w.u, r: w.hw ? 44 : 20 })),
      ...c.mounds.map((m) => ({ u: m.u, r: 72 })),
      ...c.ramps.map((r2) => ({ u: r2.u, r: 44 })),
    ];
    const want = ZONE_COUNTS.pyramids + ZONE_COUNTS.bars + ZONE_COUNTS.mounds + ZONE_COUNTS.ramps;
    if (c.walls.length + c.mounds.length + c.ramps.length !== want) {
      fail(`the ${orbR} orb carries ${c.walls.length + c.mounds.length + c.ramps.length} pieces of course, not ${want}`);
    }
    let outside = 0;
    for (const s of solids) if (c._arc(c.zone.u, s.u) > c.zone.r + 1e-6) outside++;
    if (outside) fail(`${outside} pieces of the ${orbR} course are off the patch`);

    // Nothing may be laid on top of anything else, and every pair has to leave a
    // hull's width of daylight between them: a gap a hull cannot fit down is a
    // gap a hull can be wedged in.
    let touching = 0;
    let narrow = 0;
    let crowded = 0;
    for (let i = 0; i < solids.length; i++) {
      for (let j = i + 1; j < solids.length; j++) {
        const d = c._arc(solids[i].u, solids[j].u);
        const room = solids[i].r + solids[j].r;
        if (d < room) touching++;
        else if (d < room + 34) narrow++;
        else if (d < room * 1.6) crowded++;
      }
    }
    if (touching) fail(`${touching} pairs of course pieces overlap on the ${orbR} orb`);
    if (narrow) fail(`${narrow} pairs of course pieces on the ${orbR} orb leave no room for a hull between them`);
    // a wide orb wants open ground between pieces; a pebble is meant to be tight
    density[orbR] = crowded;
  }
  // the widest orb has to be the open one — that is the whole point of flying a
  // wide one — so it can never be more crowded than the tight one
  if (density[COURSE_ORBS[1]] > density[COURSE_ORBS[0]]) {
    fail(`the wide ${COURSE_ORBS[1]} orb is more crowded (${density[COURSE_ORBS[1]]} pairs) than the tight ${COURSE_ORBS[0]} one (${density[COURSE_ORBS[0]]})`);
  }
}

/* ---- the projection, drawn on the ground ---- */
{
  // The ring a pilot can see has to be the boundary the helm actually uses, or
  // the field nags a pilot for crossing a line nobody could see.
  for (const orbR of COURSE_ORBS) {
    const c = makeOrb(orbR, 11);
    c.scene = { add() {} };
    c.terrain = [];
    c.orbR = orbR;
    c.zone = { u: c._scatter(V3()), r: courseRadius(orbR) };
    c._buildCourseEdges();
    if (c.terrain.length !== 2) fail(`the ${orbR} orb draws ${c.terrain.length} course rings, not 2`);
    for (const [i, ring] of c.terrain.entries()) {
      const pos = ring.geometry.attributes.position;
      const want = i === 0 ? c.zone.r : Math.min(c.zone.r * 1.35, orbR * Math.PI * 0.9);
      let offArc = 0;
      let offSurface = 0;
      for (let k = 0; k < pos.count; k++) {
        const u = V3().fromBufferAttribute(pos, k);
        const height = u.length() - orbR;
        u.normalize();
        if (Math.abs(c._arc(c.zone.u, u) - want) > want * 0.01 + 1) offArc++;
        if (Math.abs(height - 5) > 0.5) offSurface++;
      }
      if (offArc) fail(`${offArc} points of ring ${i} on the ${orbR} orb are not on the course boundary`);
      if (offSurface) fail(`${offSurface} points of ring ${i} on the ${orbR} orb are not on the surface`);
    }
  }
}

/* ---- the rival board and the markers on the glass ---- */
{
  // the sim reads the glass' size to pin a marker to its edge
  globalThis.window = { innerWidth: 1280, innerHeight: 720 };
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 1, 30000);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  const stub = () => {
    const set = new Set();
    return {
      style: {},
      textContent: '',
      classList: {
        toggle: (c, on) => { if (on) set.add(c); else set.delete(c); },
        has: (c) => set.has(c),
      },
    };
  };
  const board = (rivalU, alive = true) => {
    const b = makeOrb(3200, 5);
    b.camera = cam;
    const me = { isPlayer: true, u: b._scatter(V3()) };
    const q = {
      isPlayer: false, name: 'MIRA', color: 0xff6b7a, alive, respawn: 0,
      hull: alive ? 40 : 0, hullMax: 100, flashUntil: -1, u: rivalU,
      group: new THREE.Object3D(),
    };
    b.pilots = [me, q];
    b.t = 10;
    const row = stub();
    const mark = stub();
    const bar = stub();
    const range = stub();
    const markRange = stub();
    b._rivalRows = [{ q, row, bar, range, mark, markRange }];
    return { b, q, row, bar, range, mark, markRange };
  };
  // A marker that leaves the glass is a marker nobody reads, so wherever the
  // rival is, the chip is pinned inside the frame.
  const inFront = board(new THREE.Vector3(0, 0, -500).normalize());
  inFront.q.group.position.set(0, 0, -500);
  inFront.b._updateRivals();
  if (inFront.mark.classList.has('hidden')) fail('a rival dead ahead gets no marker');
  const t1 = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(inFront.mark.style.transform || '');
  if (!t1) fail('a live marker was never placed on the glass');
  else {
    const [x, y] = [Number(t1[1]), Number(t1[2])];
    if (x < 40 || x > 1280 - 40 || y < 40 || y > 720 - 40) fail(`a marker sits off the glass at ${x},${y}`);
  }
  if (inFront.range.textContent.length === 0) fail('the board shows no range to a live rival');
  if (!inFront.bar.style.width) fail('the board shows no hull for a live rival');

  // wide of the frame: pinned to the edge rather than drawn outside it
  const aside = board(new THREE.Vector3(1, 0, 0));
  aside.q.group.position.set(60000, 0, -500);
  aside.b._updateRivals();
  const t2 = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(aside.mark.style.transform || '');
  if (!t2) fail('a rival wide of the frame got no marker');
  else if (Number(t2[1]) > 1280 - 40 + 0.5) fail('a marker wide of the frame is drawn outside it');
  if (!aside.mark.classList.has('edge')) fail('a rival wide of the frame is not marked as off the glass');

  // behind the camera, and a hull that is out: no marker at all rather than one
  // that points the wrong way
  const behind = board(new THREE.Vector3(0, 0, 1));
  behind.q.group.position.set(0, 0, 500);
  behind.b._updateRivals();
  if (!behind.mark.classList.has('hidden')) fail('a rival behind the camera still gets a marker');
  const out = board(new THREE.Vector3(0, 0, -500), false);
  out.q.group.position.set(0, 0, -500);
  out.b._updateRivals();
  if (!out.mark.classList.has('hidden')) fail('a hull that is out still gets a marker');
  if (out.range.textContent !== 'DOWN') fail(`a hull that is out reads "${out.range.textContent}" on the board`);

  // a seeker must never chase the hull that threw it
  const n = makeOrb();
  const self = { u: n._scatter(V3()) };
  const other = { u: n._ahead(self.u, n._randomHeading(self.u, V3()), n._arc(self.u, n._scatter(V3())), V3()) };
  if (n._nearest(self, [self, other]) !== other) fail('a seeker picks its own launcher as the nearest hull');
  if (n._nearest(self, [self]) !== null) fail('a seeker with only its launcher to chase picks something');
}

/* ---- the chute, as _buildChute actually lays it out ---- */
{
  const c = makeChute(1, 3);

  // the spiral has to be a spiral: a course that comes back near itself is a
  // course a racer can cut across
  const pts = [];
  for (let s = 0; s <= c.chute.length; s += 40) pts.push({ s, p: c._chutePoint(s, V3()) });
  let close = 0;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      if (Math.abs(pts[i].s - pts[j].s) < CHUTE_SPEC.halfW * 6) continue;
      if (pts[i].p.distanceTo(pts[j].p) < CHUTE_SPEC.halfW * 2 + 20) close++;
    }
  }
  if (close) fail(`${close} pairs of the chute come close enough to cut across`);
  if (pts[pts.length - 1].p.y <= pts[0].p.y) fail('the chute does not climb');

  // gates in order, and the line is the last of them
  for (let i = 1; i < c.chute.gates.length; i++) {
    if (c.chute.gates[i] <= c.chute.gates[i - 1]) fail('the chute gates are out of order');
    if (c.chute.gates[i] - c.chute.gates[i - 1] < 400) fail('two gates are closer together than a race');
  }
  if (c.chute.gates[c.chute.gates.length - 1] !== c.chute.length) fail('the last gate is not the line');
  if (c.chute.gates[0] > 1200) fail('the first gate is further than a run-up');

  // every ramp has a gap after it, and the gaps are a test rather than a wall:
  // a hull at full drive clears one, and a hull crawling into it does not
  const flight = (CHUTE_SPEC.air + Math.sqrt(CHUTE_SPEC.air ** 2 + 2 * CHUTE_SPEC.gravity * CHUTE_SPEC.rampRise)) / CHUTE_SPEC.gravity;
  if (!c.chute.ramps.length) fail('the chute has no ramps to jump');
  for (const tier of [1, 8]) {
    const t = makeChute(tier, 5);
    for (const r of t.chute.ramps) {
      const gap = t.chute.gaps.find((g) => g.from === r.to);
      if (!gap) { fail(`the ramp at ${r.from} has no gap after it`); continue; }
      const len = gap.to - gap.from;
      if (len > 250 * flight) fail(`the gap at ${gap.from} on bracket ${tier} needs more than full drive to clear`);
      if (len < 120 * flight) fail(`the gap at ${gap.from} on bracket ${tier} is no obstacle at all`);
    }
    if (t.chute.gaps.some((g, i) => i && g.from !== t.chute.ramps[i].to)) fail('the chute gaps and ramps disagree');
  }

  // a hit in the chute takes a rival's drive, not its hull
  {
    const g = makeChute(2, 9);
    const shooter = makeRacer(g, 0, true);
    const victim = makeRacer(g, 1);
    victim.speed = 250;
    shooter.speed = 250;
    const capClean = g._chuteCap(victim);
    g._chuteHit(victim, shooter);
    if (victim.daze <= 0) fail('a hit in the chute costs a rival nothing');
    if (victim.hull !== victim.hullMax) fail('a hit in the chute took a rival’s hull rather than its drive');
    if (g._chuteCap(victim) >= capClean) fail('a spoiled hull is as quick as a clean one');
    if (g._chutePlace(victim) !== 1 && g._chutePlace(victim) !== 2) fail('the chute cannot work out who is ahead');
    // and it cannot be chain-stunned: the bolt after the bolt does nothing
    victim.daze = 0;
    g._chuteHit(victim, shooter);
    if (victim.daze !== 0) fail('a hull was spoiled twice in a row with no guard');
  }

  // and the whole thing flies: four racers, the real stepping function, from a
  // standing start to the line — nobody stuck, nobody outside the walls
  {
    const r = makeChute(1, 7);
    r.pilots = [0, 1, 2, 3].map((i) => makeRacer(r, i, i === 0));
    r._keys.add('KeyW'); // the commander holds the drive down and lives with it
    const dt = 1 / 60;
    let offTrack = 0;
    let nan = 0;
    let steps = 0;
    const wall = CHUTE_SPEC.halfW - CHUTE_SPEC.hullSide;
    while (steps < 60 * 200 && r.pilots.some((p) => p.finishAt == null)) {
      steps += 1;
      r.match.time += dt;
      r.t += dt;
      r._chuteStep(dt);
      for (const p of r.pilots) {
        if (!Number.isFinite(p.s) || !Number.isFinite(p.lat) || !Number.isFinite(p.air)) nan++;
        if (Math.abs(p.lat) > wall + 0.5) offTrack++;
        if (p.air < -1) nan++;
      }
    }
    const home = r.pilots.filter((p) => p.finishAt != null).length;
    if (nan) fail(`the chute produced ${nan} frames of nonsense — a NaN lane, or a hull under the deck`);
    if (offTrack) fail(`${offTrack} frames put a racer outside the chute walls`);
    if (home !== r.pilots.length) fail(`${home} of ${r.pilots.length} racers finished inside 200 seconds`);
    if (r.match.playerHome !== true) fail('the commander never reached the line');
  }

  // the guns work in the chute too: a bolt up the lane reaches the hull ahead
  {
    const g = makeChute(2, 11);
    const hunter = makeRacer(g, 0);
    const prey = makeRacer(g, 1);
    hunter.s = 100;
    prey.s = 400;
    hunter.lat = 8;
    prey.lat = 8;
    g.pilots = [hunter, prey];
    if (!g._chuteLoose(hunter, hunter.mounts[0], 0)) fail('a gun in the chute fired nothing');
    for (let i = 0; i < 180 && g.shots.length; i++) g._chuteStepShots(1 / 60);
    if (prey.daze <= 0) fail('a bolt fired up the chute never reached the hull ahead of it');
    if (prey.hull !== prey.hullMax) fail('a bolt in the chute took hull rather than drive');
  }
}

console.log(bad === 0 ? 'vector orb: all checks passed' : `vector orb: ${bad} problem(s)`);
process.exitCode = bad ? 1 : 0;
