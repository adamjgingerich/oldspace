// Geometry audit for the Vector Challenge's orb field.
//
//   node tools/audit-vector.mjs
//
// The sim keeps every hull, shot, crystal and barrier as a direction from the
// orb's centre with a heading along the surface, so a mistake in that maths
// shows up as a ship sliding sideways, a barrier that is solid an inch from
// where it is drawn, or a hull parked inside a wall. None of that needs a
// browser to check, and ground truth comes from three.js itself: barriers are
// measured against a real Object3D seated the way the sim seats the mesh, so a
// collision frame that has drifted from what is drawn cannot pass.
import * as THREE from 'three';
import { VectorChallenge } from '../src/game/vector.js';

// The tightest orb on the circuit. Chord-versus-arc error grows as the world
// gets smaller, so this is the worst case the sim can actually be asked to fly.
const R = 1200;
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
  for (const k of ['_s1', '_s2', '_s3', '_s4', '_w1', '_w2', '_w3', '_w4', '_w5']) v[k] = V3();
  v._p2 = new THREE.Vector2();
  v._q1 = new THREE.Quaternion();
  v._mat = new THREE.Matrix4();
  v._col = new THREE.Color();
  v._col2 = new THREE.Color();
  return v;
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

console.log(bad === 0 ? 'vector orb: all checks passed' : `vector orb: ${bad} problem(s)`);
process.exitCode = bad ? 1 : 0;
