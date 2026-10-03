// Commodity pricing: deterministic per world-seed + system + day, so prices are
// stable for every visitor to a system on a given day and survive save/reload.

import { COMMODITY_BY_ID } from '../data/commodities.js';
import { SYSTEMS } from '../data/systems.js';
import { rngOf } from '../core/rng.js';
import { clamp } from '../core/util.js';
import { economyMods } from './skills.js';

export const SELL_SPREAD = 0.88; // stations buy back slightly cheaper

/** Base market price before buy/sell spread. */
export function marketPrice(state, systemId, commodityId, day = state.day) {
  const c = COMMODITY_BY_ID[commodityId];
  const sys = SYSTEMS[systemId];
  if (!c || !sys) return 0;
  let mult = 1;
  if (sys.economy.produces.includes(commodityId)) mult *= 0.62;
  if (sys.economy.demands.includes(commodityId)) mult *= 1.5;
  if (commodityId === 'electronics') mult *= 1.14 - sys.tech * 0.02;
  if (commodityId === 'medicine') mult *= 1.12 - sys.tech * 0.016;
  if (commodityId === 'luxuries') mult *= 1.06 - sys.tech * 0.008;
  if (c.illegal) {
    // Ember Ash: only traded where the law looks away.
    mult *= 1.0;
  }
  const jitter = rngOf(state.worldSeed, 'price', systemId, commodityId, Math.floor(day / 3))
    .float(0.93, 1.07);
  return clamp(c.base * mult * jitter, 4, 99999);
}

export function buyPrice(state, systemId, commodityId) {
  const c = COMMODITY_BY_ID[commodityId];
  const p = marketPrice(state, systemId, commodityId);
  const mods = economyMods(state);
  return c?.illegal ? Math.round(p * 1.15 * mods.buy) : Math.round(p * mods.buy);
}

export function sellPrice(state, systemId, commodityId) {
  const c = COMMODITY_BY_ID[commodityId];
  const p = marketPrice(state, systemId, commodityId);
  const mods = economyMods(state);
  return c?.illegal
    ? Math.round(p * 1.55 * mods.sell * mods.illegalSell)
    : Math.round(p * SELL_SPREAD * mods.sell);
}

/** Can this station deal in this commodity at all? */
export function tradeableAt(station, commodityId) {
  const c = COMMODITY_BY_ID[commodityId];
  if (!c) return false;
  if (c.illegal && !station.blackmarket) return false;
  return true;
}

/** Rows for the trade screen, cheapest first for convenience. */
export function marketRows(state, systemId, station) {
  const rows = [];
  for (const c of Object.values(COMMODITY_BY_ID)) {
    if (!tradeableAt(station, c.id)) continue;
    rows.push({
      commodity: c,
      buy: buyPrice(state, systemId, c.id),
      sell: sellPrice(state, systemId, c.id),
      held: state.cargo[c.id] || 0,
    });
  }
  return rows;
}
