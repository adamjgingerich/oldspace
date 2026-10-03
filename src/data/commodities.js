// Trade goods. `illegal` goods may only be traded at stations with a black market.

export const COMMODITIES = [
  {
    id: 'ice', name: 'Ion Ice', base: 42,
    desc: 'Frozen volatiles cut from comet tails. Lifeblood of hot systems.',
  },
  {
    id: 'ore', name: 'Raw Ore', base: 74,
    desc: 'Unrefined rock, still singing from the drill.',
  },
  {
    id: 'grain', name: 'Hydroponic Grain', base: 61,
    desc: 'Twelve thousand calories per crate, grown in spin gravity.',
  },
  {
    id: 'textiles', name: 'Smart Textiles', base: 126,
    desc: 'Weave that mends itself. Fashion’s quiet workhorse.',
  },
  {
    id: 'machinery', name: 'Machinery', base: 214,
    desc: 'Presses, turbines, tether winches. Heavy and honest.',
  },
  {
    id: 'electronics', name: 'Electronics', base: 348,
    desc: 'Avionics, sensor cores, and the odd illegal firmware.',
  },
  {
    id: 'medicine', name: 'Medicine', base: 540,
    desc: 'Spin-stabilised serums. Worth more than their mass in gold.',
  },
  {
    id: 'luxuries', name: 'Luxuries', base: 780,
    desc: 'Silk from Meridian, spice from nowhere, vintages of dubious age.',
  },
  {
    id: 'wine', name: 'Ancestral Wine', base: 620,
    desc: 'Cellared in the old halls and drunk warm, only for oaths and funerals. The Houses buy it by the crate.',
  },
  {
    id: 'ash', name: 'Ember Ash', base: 1020, illegal: true,
    desc: 'Residue scraped from burned-out reactor linings. Illegal in Combine space. Do not ask.',
  },
];

export const COMMODITY_BY_ID = Object.fromEntries(COMMODITIES.map((c) => [c.id, c]));
