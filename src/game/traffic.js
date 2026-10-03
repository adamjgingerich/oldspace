// Per-system traffic character: how busy the lanes and berths of a system are.
// Importance (tech, berths, crossroads, law) sets the base, and a wide seeded
// roll per system sets its temperament — some are perennially teeming, whole
// stretches of the Reach are ghost quiet, and the dice occasionally deal a
// strange hand: a nothing rock that is somehow a boom town, an old hub gone
// eerily silent.

import { SYSTEMS } from '../data/systems.js';
import { rngOf } from '../core/rng.js';
import { clamp } from '../core/util.js';

const LABELS = [
  [0.22, 'dead quiet'],
  [0.55, 'quiet'],
  [1.05, 'steady'],
  [1.7, 'busy'],
  [Infinity, 'teeming'],
];

let cacheSeed = null;
const cache = new Map();

/** 0 (no trader ever calls) .. ~2.6 (a permanent traffic jam). */
export function trafficFactor(state, sysId) {
  const seed = state?.worldSeed ?? 1;
  if (cacheSeed !== seed) cache.clear();
  cacheSeed = seed;
  const hit = cache.get(sysId);
  if (hit !== undefined) return hit;

  const sys = SYSTEMS[sysId];
  let factor = 1;
  if (sys) {
    // importance: trade tech, berths, crossroads and law all draw shipping.
    // This is the spine — 0.3-ish for a nowhere rock up to ~1.7 for a hub.
    factor = 0.3;
    factor += Math.min(0.7, sys.tech * 0.07);
    factor += Math.min(0.36, (sys.stations?.length || 0) * 0.16);
    factor += Math.min(0.24, Math.max(0, (sys.links?.length || 0) - 2) * 0.06);
    factor += sys.danger.pirates <= 0.25 ? 0.12 : sys.danger.pirates >= 0.7 ? -0.2 : 0;

    // the system's own temperament, stable across visits: a multiplier around
    // the importance — ghost stretches and perennially packed berths alike
    const rng = rngOf(seed, 'traffic', sysId);
    const roll = rng.float(0, 1);
    if (roll < 0.12) factor *= rng.float(0.15, 0.45);
    else if (roll < 0.32) factor *= rng.float(0.5, 0.75);
    else if (roll < 0.68) factor *= rng.float(0.85, 1.15);
    else if (roll < 0.9) factor *= rng.float(1.25, 1.6);
    else factor *= rng.float(1.7, 2.1);

    // strange occasions: now and then a system inverts its lot — a great hub
    // goes eerily silent for no stated reason, a nowhere rock becomes a boom
    if (rng.chance(0.07)) {
      factor = factor > 1.1 ? rng.float(0.35, 0.7) : rng.float(1.4, 1.9);
    }
    factor = clamp(factor, 0.04, 2.6);
  }

  cache.set(sysId, factor);
  return factor;
}

/** A short human label for the charts: 'teeming', 'dead quiet', ... */
export function trafficLabel(state, sysId) {
  const f = trafficFactor(state, sysId);
  const row = LABELS.find(([cap]) => f < cap);
  return row ? row[1] : 'teeming';
}
