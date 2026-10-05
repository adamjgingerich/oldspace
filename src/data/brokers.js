// The crate trade: a handful of factors, brokers and chandlers who work the
// lanes rather than a fixed quay. Every one of them carries gear that is
// otherwise licensed, vaulted or simply not for sale — relic guns out of the
// sealed vaults, faction line-guns, the odd quest-hauled curiosity — and every
// one of them asks a little over the odds for it.
//
// Nothing here touches the DOM or the scene: what a broker is carrying on a
// given day, and what she wants for it, is a pure function of the world seed,
// the system and the stardate, so a crate can be audited headlessly and a
// captain who leaves and comes back finds the same goods at the same prices.

import { rngOf } from '../core/rng.js';
import { WEAPONS } from './weapons.js';
import { OUTFITS } from './outfits.js';
import { SYSTEMS } from './systems.js';

/**
 * Brokers are not shops. A crate is a morning's work: a small, opinionated
 * selection, priced by how far it had to travel and how many questions the
 * customer would rather not answer.
 */
export const BROKERS = [
  {
    id: 'faraday',
    name: 'the Faraday Bourse',
    captain: 'Factor Ilse Marrow',
    tag: 'chandler',
    hull: 'palladium',
    escorts: ['marlin', 'marlin'],
    blurb:
      'A chandlery under way: licensed guns and fittings, laid out on a hangar deck that smells of oil and hot brass. Nothing here is stolen; most of it is simply not yours to buy.',
    goods: { licences: ['com', 'vig', 'rea', 'quest'] },
    size: [3, 5],
    markup: [1.08, 1.15],
    visit: { chance: 0.07, minTech: 6, maxDanger: 0.5 },
  },
  {
    id: 'surplus',
    name: 'the Odd Lot',
    captain: 'Master Tinker Bellweather',
    tag: 'salvager',
    hull: 'tinker',
    escorts: ['lynx'],
    blurb:
      'A salvage tender with a manifest written in three hands and one grudge. Her captain deals in finds: the gear you would have had to walk somebody else’s story to earn.',
    goods: { licences: ['quest', 'com'] },
    size: [3, 4],
    markup: [1.1, 1.16],
    visit: { chance: 0.05, minTech: 5 },
  },
  {
    id: 'ashgrove',
    name: 'the Ashgrove Bourse',
    captain: 'Broker Cade Ashgrove',
    tag: 'relic',
    hull: 'relict',
    escorts: ['sabre', 'sabre'],
    blurb:
      'Half market, half reliquary: banded vault gear under lamps, stamped and sworn to by a broker who has been asked to prove provenance exactly once.',
    goods: { licences: ['relic'], bands: [1, 2] },
    size: [3, 4],
    markup: [1.12, 1.18],
    visit: { chance: 0.06, minDanger: 0.4 },
  },
  {
    id: 'quietfair',
    name: 'the Quiet Fair',
    captain: 'the Fair’s Keeper',
    tag: 'relic',
    hull: 'cathedral',
    escorts: ['sabre', 'sabre', 'marlin'],
    blurb:
      'An ark refitted into a travelling auction house, and the last place in the Reach where a third-band relic changes hands in daylight. The Keeper does not haggle; she decides.',
    goods: { licences: ['relic'], bands: [2, 3] },
    size: [2, 4],
    markup: [1.15, 1.22],
    visit: { chance: 0.045, minDanger: 0.55, minTech: 6 },
  },
];

export const BROKER_BY_ID = Object.fromEntries(BROKERS.map((b) => [b.id, b]));

/** No papers for it: the broker's own fee, and she carries the risk. */
export const NO_PAPERS_FEE = 1.1;

/** A crate never asks more than this over list, however rare the day. */
export const BROKER_MARKUP_CAP = 1.6;

/** Relic bands, in the order the vaults grade them. */
export const RELIC_BANDS = ['', 'I', 'II', 'III'];

const round250 = (n) => Math.max(250, Math.round(n / 250) * 250);

/** Every piece of gear a broker of this kind could conceivably be carrying. */
export function brokerPool(broker) {
  const out = [];
  const wanted = broker.goods.licences || [];
  const bands = broker.goods.bands || null;
  for (const w of WEAPONS) {
    if (!w.unique || !wanted.includes(w.unique)) continue;
    if (w.unique === 'relic' && bands && !bands.includes(w.band)) continue;
    out.push({ kind: 'weapon', id: w.id, name: w.name, licence: w.unique, band: w.band || 0, desc: w.desc, base: w.price });
  }
  for (const o of OUTFITS) {
    if (!o.unique || !wanted.includes(o.unique)) continue;
    if (o.unique === 'relic' && bands && !bands.includes(o.band)) continue;
    out.push({ kind: 'outfit', id: o.id, name: o.name, licence: o.unique, band: o.band || 0, desc: o.desc, base: o.prices[0] });
  }
  return out.sort((a, b) => (a.kind === b.kind ? (a.id < b.id ? -1 : 1) : a.kind < b.kind ? -1 : 1));
}

/** Whether this broker works a system at all: some stay in the law's lanes. */
export function brokerWorksHere(broker, system) {
  if (!system) return false;
  const v = broker.visit || {};
  const danger = system.danger?.pirates ?? 0;
  if (v.minTech != null && (system.tech ?? 0) < v.minTech) return false;
  if (v.maxDanger != null && danger > v.maxDanger) return false;
  if (v.minDanger != null && danger < v.minDanger) return false;
  return true;
}

/**
 * Who is working a system today, if anyone. One roll per system per stardate,
 * so the lanes are not a vending machine: most days a given system has no
 * broker in it at all, and the one you do find is worth a detour.
 */
export function brokerVisit(state, systemId) {
  const system = SYSTEMS[systemId];
  if (!system || system.freefire) return null;
  const here = BROKERS.filter((b) => brokerWorksHere(b, system));
  if (!here.length) return null;
  const day = state?.day ?? 1;
  const rng = rngOf(state?.worldSeed ?? 0, 'broker', systemId, day);
  const total = here.reduce((n, b) => n + (b.visit?.chance || 0), 0);
  if (total <= 0) return null;
  const roll = rng.float(0, 1);
  if (roll > total) return null;
  let pick = roll;
  for (const b of here) {
    pick -= b.visit?.chance || 0;
    if (pick <= 0) return b;
  }
  return here[here.length - 1];
}

/**
 * The crate itself: what is on the deck on this stardate. Deterministic per
 * (world seed, broker, system, day) so the same day's stock is the same crate
 * however many times a captain hails her.
 */
export function brokerCrate(broker, state, systemId) {
  const day = state?.day ?? 1;
  const pool = brokerPool(broker);
  if (!pool.length) return [];
  const rng = rngOf(state?.worldSeed ?? 0, 'crate', broker.id, systemId, day);
  const size = broker.size || [2, 4];
  const want = Math.max(1, Math.min(pool.length, rng.int(size[0], size[1])));
  const shuffled = rng.shuffle(pool);
  const chosen = shuffled.slice(0, want);
  // a crate is a spread, not a pile of one thing: where the pool allows it,
  // there is always at least one gun and at least one fitting on the deck
  const swapIn = (kind) => {
    if (want < 2 || chosen.some((i) => i.kind === kind)) return;
    const missing = shuffled.find((i) => i.kind === kind);
    const crowded = chosen.find((i) => chosen.filter((c) => c.kind === i.kind).length > 1);
    if (missing && crowded) chosen[chosen.indexOf(crowded)] = missing;
  };
  swapIn('weapon');
  swapIn('outfit');
  const licensed = new Set(state?.story?.unlocked || []);
  return chosen
    .map((item) => {
      const itemRng = rngOf(state?.worldSeed ?? 0, 'markup', broker.id, item.id);
      const markup = Math.min(BROKER_MARKUP_CAP, itemRng.float(broker.markup[0], broker.markup[1]));
      const papers = licensed.has(item.id);
      const jitter = itemRng.float(0.97, 1.03);
      const asking = round250(Math.min(item.base * BROKER_MARKUP_CAP, item.base * markup * jitter * (papers ? 1 : NO_PAPERS_FEE)));
      return { ...item, markup, papers, asking, over: Math.round((asking / item.base - 1) * 100), grade: item.band ? RELIC_BANDS[item.band] : null };
    })
    .sort((a, b) => b.asking - a.asking);
}

/** One row of a crate, priced as it stands right now — never trust a cached price. */
export function brokerCrateRow(broker, state, systemId, kind, id) {
  return brokerCrate(broker, state, systemId).find((r) => r.kind === kind && r.id === id) || null;
}
