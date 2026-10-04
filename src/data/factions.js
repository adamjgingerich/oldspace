// Factions and how they feel about you.
//
// Each faction holds a block of the cluster — its `home` systems are the
// heart of its territory, where its colours fly unopposed. The Free Ports
// are the neutral core; the Reaver Clans hold the far rim. Between them the
// Combine, the Vigil and the Kreth Houses carve their own marches.

export const FACTIONS = {
  free: {
    id: 'free', name: 'Free Ports', color: '#8ef0b8', short: 'Free',
    desc: 'Harbours that answer to no flag but their own ledger. The inner lanes are their heart, and they keep them open.',
    creed: 'Keep the lanes open and the ledger honest. Nobody owns the inner worlds — that is the whole point of them.',
    home: ['haven', 'meridian', 'coldvane', 'brasstide', 'orchard', 'pelican'],
    opposes: null, // neutral — every flag trades here
    startWealth: 260,
  },
  combine: {
    id: 'combine', name: 'Helion Combine', color: '#7ec8ff', short: 'Combine',
    desc: 'Industrial consortium. Owns the foundries, the tariffs and the patrol routes.',
    creed: 'Steel in, freight out, and a margin on every leg. The Combine pays on time and expects the manifest to balance.',
    home: ['coriolis', 'sunward', 'grandbank', 'emberlight', 'caldera', 'smeltway'],
    opposes: 'reaver', // the Clans raid their convoys
    startWealth: 310,
  },
  vigil: {
    id: 'vigil', name: 'The Vigil', color: '#b48cff', short: 'Vigil',
    desc: 'Sworn protectors of the trade lanes. They answer piracy with fire, and everything else with paperwork.',
    creed: 'A lane is only as safe as the ships that fly it. Patrol, log, and answer the distress bands.',
    home: ['vesper', 'northgate', 'vigiledge', 'saintsrest', 'lamphold', 'oathfall'],
    opposes: 'reaver', // the law hunts the Clans
    startWealth: 270,
  },
  reaver: {
    id: 'reaver', name: 'Reaver Clans', color: '#ff8a6a', short: 'Reaver',
    desc: 'Dust-riders and wreckers. They take what the lanes forget to guard.',
    creed: 'Nothing in the deep is owned, only held. Convoys carry; Clans collect.',
    home: ['rusthaven', 'doldrums', 'tinderbox', 'copperhead', 'houndstooth', 'brokenjaw'],
    opposes: 'vigil', // the Clans answer the law with fire
    startWealth: 200,
  },
  kreth: {
    id: 'kreth', name: 'Kreth Houses', color: '#e8a05a', short: 'Kreth',
    desc: 'Old blood and older oaths. The Houses measure a captain by the deeds carried in the name — and they are patient accountants.',
    creed: 'A name is a debt. Carry ours well and the Houses will remember who you are.',
    home: ['vekta', 'kratha', 'tidemill', 'bloodoath', 'ancestors', 'forgelight'],
    opposes: 'combine', // old blood distrusts new money
    startWealth: 240,
  },
};

/** Faction ids in stable order. */
export const FACTION_IDS = Object.keys(FACTIONS);

/**
 * The owner id used by places that answer to nobody: free-fire systems and the
 * handful of habs out there that fly no colours at all. It is deliberately not
 * a faction — no standing, no desk, no law, no ledger.
 */
export const UNCLAIMED = 'none';

/** Standing you begin with when you swear to a flag at character creation. */
export const STARTING_SWEAR_REP = 45;

export function isFaction(id) {
  return !!FACTIONS[id];
}

/** Display name for any owner id, including places that fly no flag. */
export function factionLabel(id) {
  return FACTIONS[id]?.name || 'No flag';
}

/** Colour for any owner id; unclaimed space reads as gunmetal, never a flag. */
export function factionHex(id) {
  return FACTIONS[id]?.color || '#9fb0c6';
}

/** Short display tag for any owner id (chart chips, HUD plates). */
export function factionShort(id) {
  return FACTIONS[id]?.short || 'No flag';
}

export const REP_LABELS = [
  [-60, 'Hunted'],
  [-25, 'Distrusted'],
  [-1, 'Wary'],
  [0, 'Neutral'],
  [15, 'Known'],
  [40, 'Trusted'],
  [70, 'Sworn Ally'],
];

export function repLabel(v) {
  let label = REP_LABELS[0][1]; // deepest tier as the floor — a hunted name is never "Neutral"
  for (const [min, l] of REP_LABELS) {
    if (v >= min) label = l;
  }
  return label;
}
