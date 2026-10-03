// Shield lattices.
//
// A shield is not just a number. Every lattice has a character: how much it
// holds, how fast it comes back, how long it sulks after a hit, how well it
// shrugs off shield-breaker warheads, and how hard it is to snare with a
// disruptor. Ten profiles, from the plain deflector every yard ships to the
// specialist weaves the great flags keep for their own.
//
// Profile fields (1 = the standard deflector lattice, all are multipliers):
//   cap     — shield pool
//   regen   — recovery rate
//   delay   — seconds before recovery resumes after a hit (lower is better)
//   breaker — incoming shield-bonus damage taken (lower is better)
//   disrupt — 0..1 resistance to disruptor snare charge (1 = immune)
//   bleed   — fraction of an absorbed hit that leaks through to the hull
//   hull    — fraction of normal damage that reaches the hull while the
//             lattice holds (low = the lattice eats almost everything)

export const SHIELD_TYPES = [
  {
    id: 'lattice', name: 'Deflector Lattice', short: 'Lattice', tier: 1,
    cap: 1, regen: 1, delay: 3, breaker: 1, disrupt: 0, bleed: 0, hull: 1,
    color: 0x6fd8ff, css: '#6fd8ff',
    desc: 'The honest bubble every yard bolts on first. Even hands, no opinions, cheap to replace.',
  },
  {
    id: 'flowweave', name: 'Flowweave Mesh', short: 'Flowweave', tier: 1,
    cap: 0.85, regen: 1.8, delay: 1.5, breaker: 1.1, disrupt: 0.05, bleed: 0, hull: 1,
    color: 0x7ce8ff, css: '#7ce8ff',
    desc: 'Woven for turnaround rather than staying power. Thin, but it is back before the next pass.',
  },
  {
    id: 'duelist', name: 'Duelist Veil', short: 'Duelist', tier: 2,
    cap: 0.7, regen: 2.4, delay: 1, breaker: 1.25, disrupt: 0.1, bleed: 0, hull: 1,
    color: 0xffb070, css: '#ffb070',
    desc: 'Kreth work: a veil that snaps back between exchanges. It does not want to be hit twice, so it is not.',
  },
  {
    id: 'ledger', name: 'Ledger Weave', short: 'Ledger', tier: 2,
    cap: 1.15, regen: 1.35, delay: 2.2, breaker: 0.95, disrupt: 0.3, bleed: 0, hull: 1,
    color: 0xffd27a, css: '#ffd27a',
    desc: 'Combine lattice, tuned like a margin: nothing wasted, everything accounted. Sound against snaring.',
  },
  {
    id: 'oathward', name: 'Oathward Lattice', short: 'Oathward', tier: 3,
    cap: 1.3, regen: 1.05, delay: 2.6, breaker: 0.7, disrupt: 0.55, bleed: 0, hull: 1,
    color: 0x8ff6ff, css: '#8ff6ff',
    desc: 'Vigil line-work, grown rather than built. Rebukes breaker warheads and largely ignores snare coils.',
  },
  {
    id: 'ember', name: 'Ember Ward', short: 'Ember', tier: 2,
    cap: 1.4, regen: 0.75, delay: 5, breaker: 1.4, disrupt: 0.15, bleed: 0, hull: 1,
    color: 0xff8a5c, css: '#ff8a5c',
    desc: 'Clan ward: a hot, thick skin that soaks a beating and then takes its time. Breaker warheads eat it alive.',
  },
  {
    id: 'aegis', name: 'Aegis Plate', short: 'Aegis', tier: 3,
    cap: 1.5, regen: 0.65, delay: 4.5, breaker: 0.8, disrupt: 0.2, bleed: 0, hull: 1,
    color: 0xcfe8ff, css: '#cfe8ff',
    desc: 'Capital-grade shielding built to outlast a bombardment. Slow to return, hard to take away.',
  },
  {
    id: 'capacitor', name: 'Burst Capacitor', short: 'Capacitor', tier: 3,
    cap: 1.85, regen: 0.3, delay: 6.5, breaker: 1.15, disrupt: 0, bleed: 0, hull: 1,
    color: 0xffe066, css: '#ffe066',
    desc: 'One enormous reservoir, dumped into the first exchange and then empty for a long while.',
  },
  {
    id: 'faraday', name: 'Faraday Weave', short: 'Faraday', tier: 2,
    cap: 0.9, regen: 1.15, delay: 2.4, breaker: 0.45, disrupt: 0.75, bleed: 0, hull: 1,
    color: 0xa8ffd0, css: '#a8ffd0',
    desc: 'A grounded cage that laughs at ion warheads and snare coils alike. Built by captains who expect to be hunted.',
  },
  {
    id: 'ghostveil', name: 'Ghostveil', short: 'Ghostveil', tier: 3,
    cap: 0.65, regen: 1.6, delay: 1.2, breaker: 1.2, disrupt: 0.2, bleed: 0.12, hull: 1,
    color: 0xc0a0ff, css: '#c0a0ff',
    desc: 'Silk from the Brasstide looms. Barely there, quick to resume — and what it fails to catch arrives as shrapnel.',
  },
];

export const SHIELD_BY_ID = Object.fromEntries(SHIELD_TYPES.map((s) => [s.id, s]));

export const DEFAULT_SHIELD_TYPE = 'lattice';

/** Which lattice a hull flies by default, before any refit. */
export function defaultShieldType(faction, role) {
  if (role === 'navy') return 'oathward';
  if (role === 'house') return 'duelist';
  if (role === 'pirate') return 'ember';
  if (role === 'trader' || role === 'courier' || role === 'transit') return 'flowweave';
  return latticeForFaction(faction);
}

function latticeForFaction(faction) {
  switch (faction) {
    case 'vigil': return 'oathward';
    case 'reaver': return 'ember';
    case 'combine': return 'ledger';
    case 'kreth': return 'duelist';
    default: return DEFAULT_SHIELD_TYPE;
  }
}

/** Resolve the lattice a hull actually flies: its own, else its flag's. */
export function shieldTypeFor(def, faction, role) {
  if (def?.shieldType) return def.shieldType;
  return defaultShieldType(faction, role);
}

export function shieldProfile(typeId) {
  return SHIELD_BY_ID[typeId] || SHIELD_BY_ID[DEFAULT_SHIELD_TYPE];
}

/**
 * Fold a lattice's character into a stat block. Mutates and returns `stats`,
 * so both the NPC base stats and the player's computed stats go through the
 * same door and the numbers on the HUD are the numbers in the fight.
 */
export function applyShieldProfile(stats, typeId) {
  const p = shieldProfile(typeId);
  stats.shieldType = p.id;
  stats.shield = Math.max(1, Math.round(stats.shield * p.cap));
  stats.shieldRegen = Math.round(stats.shieldRegen * p.regen * 100) / 100;
  stats.shieldDelay = p.delay;
  stats.shieldBreak = p.breaker;
  stats.shieldDisrupt = p.disrupt;
  stats.shieldBleed = p.bleed;
  stats.shieldHull = p.hull;
  return stats;
}
