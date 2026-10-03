// Wormholes: rare long-range shortcuts across the cluster, placed once per
// galaxy from the save's worldSeed. They are hidden from every chart until a
// captain flies close enough to map one — then both mouths are known.
//
// Placement is thoughtful, not random noise: only systems that sit many lanes
// apart are eligible, endpoints are never reused, and each mouth anchors beyond
// the system's outermost world so it reads as a destination of its own.

import { SYSTEMS } from '../data/systems.js';
import { rngOf } from '../core/rng.js';

const HOLE_COUNT = 4;
const TAU = Math.PI * 2;

/** Lane-hop distances from one system (BFS over the lane graph). */
function laneDepths(from) {
  const dist = { [from]: 0 };
  const queue = [from];
  while (queue.length) {
    const id = queue.shift();
    for (const to of SYSTEMS[id].links) {
      if (dist[to] === undefined) {
        dist[to] = dist[id] + 1;
        queue.push(to);
      }
    }
  }
  return dist;
}

function generate(seed) {
  const rng = rngOf(seed, 'wormholes');
  const ids = Object.keys(SYSTEMS);
  const candidates = [];
  for (let i = 0; i < ids.length; i++) {
    const depths = laneDepths(ids[i]);
    for (let j = i + 1; j < ids.length; j++) {
      const hops = depths[ids[j]];
      if (hops !== undefined) candidates.push({ a: ids[i], b: ids[j], hops });
    }
  }

  const pick = (minHops) => {
    const pool = candidates
      .filter((c) => c.hops >= minHops)
      .map((c) => ({ ...c, score: c.hops * 1.4 + rng.float(0, 4) }))
      .sort((x, y) => y.score - x.score);
    const holes = [];
    const used = new Set();
    for (const c of pool) {
      if (holes.length >= HOLE_COUNT) break;
      if (used.has(c.a) || used.has(c.b)) continue;
      used.add(c.a);
      used.add(c.b);
      const posRng = rngOf(seed, 'wormhole-pos', c.a, c.b);
      const mouth = (sysId) => {
        const sys = SYSTEMS[sysId];
        const far = sys.planets.reduce((m, pl) => Math.max(m, pl.dist + pl.radius), 0);
        return {
          angle: posRng.float(0, TAU),
          dist: Math.round(far + posRng.float(420, 900)),
        };
      };
      holes.push({
        id: `wh:${c.a}:${c.b}`,
        a: c.a,
        b: c.b,
        hops: c.hops,
        pos: { [c.a]: mouth(c.a), [c.b]: mouth(c.b) },
      });
    }
    return holes;
  };

  let holes = pick(6);
  if (holes.length < HOLE_COUNT) holes = pick(4);
  return holes;
}

let cacheSeed = null;
let cache = [];

/** Every wormhole in this galaxy — deterministic from the save's worldSeed. */
export function wormholesFor(state) {
  const seed = state?.worldSeed ?? 1;
  if (cacheSeed !== seed) {
    cacheSeed = seed;
    cache = generate(seed);
  }
  return cache;
}

/** The wormhole anchored in a system, or null. */
export function holeInSystem(state, sysId) {
  return wormholesFor(state).find((h) => h.a === sysId || h.b === sysId) || null;
}

/** The far mouth of a hole, given the near one. */
export function farEnd(hole, sysId) {
  return hole.a === sysId ? hole.b : hole.a;
}

/** In-system anchor of a hole at one of its ends. */
export function holePos(hole, sysId) {
  const p = hole.pos[sysId] || { angle: 0.5, dist: 1800 };
  return { x: Math.cos(p.angle) * p.dist, z: Math.sin(p.angle) * p.dist };
}

/** Has the captain mapped this hole? */
export function isDiscovered(state, holeId) {
  return !!state?.wormholes?.[holeId];
}
