// Fleet expeditions: send ships from your fleet out from a charter you own.
// They return in a few days with profit, salvage and reputation — or, on the
// wrong lane, not at all. This is the endgame: your flag flies on every lane
// and your hulls do the work while you take the credit.

import { SHIP_BY_ID } from '../data/ships.js';
import { SYSTEMS } from '../data/systems.js';
import { FACTIONS } from '../data/factions.js';
import { COMMODITY_BY_ID } from '../data/commodities.js';
import { rngOf } from '../core/rng.js';
import { clamp } from '../core/util.js';
import { levelFromXp } from './skills.js';

/** The fleet flies on your word once you are a known name on the lanes. */
export const EXPEDITION_MIN_LEVEL = 16;

/**
 * The missions a fleet ship can run from a charter you own.
 *   days      — how long the ship is away (in game days)
 *   risk      — base chance of losing the ship outright (scaled by danger)
 *   credit    — pay = shipPrice * credit * techFactor * (1 + danger * dangerPay)
 *   rep       — { gain } goodwill with the home flag, or { target } anger at the far end
 *   reaverGain — standing gained with the Clans for audacity
 *   xp        — experience earned for the commander
 *   loot      — salvage may also bring cargo home
 */
export const EXPEDITION_TYPES = {
  trade: {
    label: 'Trade run', risk: 0.04, credit: 0.055, dangerPay: 0.7, rep: null, reaverGain: 0, xp: 20, loot: false,
    days: [1, 2],
    desc: 'Haul local produce to a neighbouring market and back. Steady money, small risk.',
  },
  salvage: {
    label: 'Salvage sweep', risk: 0.08, credit: 0.05, dangerPay: 1.0, rep: null, reaverGain: 0, xp: 35, loot: true,
    days: [2, 3],
    desc: 'Work a wreck field on the far side. Cash, and sometimes a hold of recovered cargo.',
  },
  patrol: {
    label: 'Patrol duty', risk: 0.06, credit: 0.03, dangerPay: 0.6, rep: { gain: 2 }, reaverGain: 0, xp: 25, loot: false,
    days: [2, 2],
    desc: 'Fly your colours along the local lanes. Modest pay, and the home flag remembers the favour.',
  },
  raid: {
    label: 'Deep raid', risk: 0.22, credit: 0.11, dangerPay: 1.3, rep: { target: -6 }, reaverGain: 3, xp: 60, loot: false,
    days: [2, 3],
    desc: 'Hit shipping under someone else’s flag. Rich, and dangerous — the far end will not be pleased.',
  },
  survey: {
    label: 'Survey expedition', risk: 0.05, credit: 0.02, dangerPay: 0.4, rep: null, reaverGain: 0, xp: 80, loot: false,
    days: [1, 2],
    desc: 'Chart an unexplored pocket of the cluster and file the readings. Pays in knowledge and experience.',
  },
};

/** Systems a charter can reach from here — its lane neighbours. */
export function expeditionDestinations(state, fromSysId) {
  const sys = SYSTEMS[fromSysId];
  return (sys?.links || []).filter((id) => SYSTEMS[id]);
}

/** Fleet ships free to be sent out. */
export function availableExpeditionShips(state) {
  return (state.fleet || []).filter((m) => m.status !== 'away' && SHIP_BY_ID[m.shipId]);
}

/** Why an expedition cannot be dispatched right now — or null if it can. */
export function expeditionBlock(state, shipUid, fromSysId, type, destSysId) {
  if (!state.holdings?.[fromSysId]) return 'You do not hold a charter there.';
  if (levelFromXp(state.xp || 0) < EXPEDITION_MIN_LEVEL) return `Requires level ${EXPEDITION_MIN_LEVEL}.`;
  const entry = (state.fleet || []).find((m) => m.uid === shipUid);
  if (!entry) return 'That ship is not in your fleet.';
  if (entry.status === 'away') return `${entry.name} is already out on a run.`;
  if (!SHIP_BY_ID[entry.shipId]) return 'That hull is not in your records.';
  if (!EXPEDITION_TYPES[type]) return 'Unknown expedition.';
  if (!SYSTEMS[destSysId]) return 'Unknown destination.';
  return null;
}

/** Send a fleet ship out. Marks it 'away' with a return day. */
export function dispatchExpedition(state, shipUid, fromSysId, type, destSysId) {
  const block = expeditionBlock(state, shipUid, fromSysId, type, destSysId);
  if (block) return { ok: false, error: block };
  const entry = state.fleet.find((m) => m.uid === shipUid);
  const t = EXPEDITION_TYPES[type];
  // the lane decides, the way every other roll in the lanes does — seeded, so
  // a save loaded twice plays out the same days
  const days = t.days[0] + rngOf(state.worldSeed, 'expedition-days', shipUid, state.day).int(0, t.days[1] - t.days[0]);
  entry.away = {
    fromSysId, destSysId, type,
    returnDay: state.day + days,
    prevStatus: entry.status,
    prevBay: entry.bay,
  };
  entry.status = 'away';
  entry.bay = null;
  return { ok: true, entry, returnDay: entry.away.returnDay, label: t.label, destName: SYSTEMS[destSysId].name };
}

/**
 * Resolve an expedition whose return day has come. Mutates state (credits,
 * rep, cargo, xp) and the entry itself; returns a description for the toast
 * and whether the ship was lost.
 */
export function settleExpedition(state, entry) {
  const away = entry.away;
  const t = EXPEDITION_TYPES[away.type] || EXPEDITION_TYPES.trade;
  const from = SYSTEMS[away.fromSysId];
  const dest = SYSTEMS[away.destSysId];
  const def = SHIP_BY_ID[entry.shipId];
  const rng = rngOf(state.worldSeed, 'expedition', entry.uid, state.day);

  const techF = 0.55 + (from?.tech ?? 5) * 0.15;
  const danger = dest?.danger?.pirates ?? 0.3;
  const price = def?.price ?? 40000;

  // the deeper the far lane, the likelier the hull never comes home
  const lostChance = clamp(t.risk + danger * 0.15, 0, 0.6);
  const lost = rng.chance(lostChance);

  let credits = 0;
  let text;
  let kind = 'good';
  const xp = t.xp;

  if (lost) {
    credits = Math.round(price * 0.25); // salvors bring a share of the wreck home
    kind = 'bad';
    text = `${entry.name} never came home — ${dest?.name || 'the far lane'} swallowed it. Salvors recovered \u20a1${credits.toLocaleString()} of wreck.`;
  } else {
    const reward = Math.round(price * t.credit * techF * (1 + danger * t.dangerPay));
    credits = reward;
    text = `${entry.name} returned from ${dest?.name || 'the far lane'} with \u20a1${reward.toLocaleString()}.`;
    if (t.loot && rng.chance(0.5)) {
      const pool = ['ore', 'ice', 'grain', 'textiles', 'electronics', 'medicine'];
      const loot = { id: rng.pick(pool), qty: rng.int(2, 6) };
      const c = COMMODITY_BY_ID[loot.id];
      const res = state.addCargo(loot.id, loot.qty);
      if (res.ok) text += ` And ${loot.qty} crates of ${c?.name || loot.id}.`;
      else text += ` The recovered ${c?.name || 'cargo'} would not fit — sold off for \u20a1${(loot.qty * (c?.base || 20)).toLocaleString()}.`;
    }
    if (t.rep?.gain) {
      const owner = from?.gov ?? 'free';
      state.addRep(owner, t.rep.gain);
      text += ` ${FACTIONS[owner]?.name || owner} remembers the favour.`;
    }
    if (t.rep?.target) {
      const owner = dest?.gov ?? 'free';
      state.addRep(owner, t.rep.target);
      text += ` ${FACTIONS[owner]?.name || owner} is furious about the raid.`;
    }
    if (t.reaverGain) state.addRep('reaver', t.reaverGain);
  }

  if (credits > 0) state.addCredits(credits);

  if (lost) return { text, kind, lost: true, xp: 0 };

  // welcome the hull home — back to its old cradle or onto the wing
  entry.status = away.prevStatus === 'bay' ? 'bay' : 'escort';
  entry.bay = entry.status === 'bay' ? (away.prevBay ?? 0) : null;
  delete entry.away;
  return { text, kind, lost: false, xp };
}
