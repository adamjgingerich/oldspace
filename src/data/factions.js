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
    home: ['haven', 'meridian', 'coldvane', 'brasstide', 'orchard', 'pelican'],
    opposes: null, // neutral — every flag trades here
    startWealth: 260,
  },
  combine: {
    id: 'combine', name: 'Helion Combine', color: '#7ec8ff', short: 'Combine',
    desc: 'Industrial consortium. Owns the foundries, the tariffs and the patrol routes.',
    home: ['coriolis', 'sunward', 'grandbank', 'emberlight', 'caldera', 'smeltway'],
    opposes: 'reaver', // the Clans raid their convoys
    startWealth: 310,
  },
  vigil: {
    id: 'vigil', name: 'The Vigil', color: '#b48cff', short: 'Vigil',
    desc: 'Sworn protectors of the trade lanes. They answer piracy with fire, and everything else with paperwork.',
    home: ['vesper', 'northgate', 'vigiledge', 'saintsrest', 'lamphold', 'oathfall'],
    opposes: 'reaver', // the law hunts the Clans
    startWealth: 270,
  },
  reaver: {
    id: 'reaver', name: 'Reaver Clans', color: '#ff8a6a', short: 'Reaver',
    desc: 'Dust-riders and wreckers. They take what the lanes forget to guard.',
    home: ['rusthaven', 'doldrums', 'tinderbox', 'copperhead', 'houndstooth', 'brokenjaw'],
    opposes: 'vigil', // the Clans answer the law with fire
    startWealth: 200,
  },
  kreth: {
    id: 'kreth', name: 'Kreth Houses', color: '#e8a05a', short: 'Kreth',
    desc: 'Old blood and older oaths. The Houses measure a captain by the deeds carried in the name — and they are patient accountants.',
    home: ['vekta', 'kratha', 'tidemill', 'bloodoath', 'ancestors', 'forgelight'],
    opposes: 'combine', // old blood distrusts new money
    startWealth: 240,
  },
};

/** Faction ids in stable order. */
export const FACTION_IDS = Object.keys(FACTIONS);

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
