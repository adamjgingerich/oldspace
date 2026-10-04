// Faction politics: wealth, influence and the slow, patient expansion of
// territory. The flags mostly keep to their own marches — but a rich faction
// occasionally buys, bullies or bargains its way onto a border system, and
// two flags that share an enemy sometimes stand together for a season.

import { FACTIONS, FACTION_IDS } from '../data/factions.js';
import { SYSTEMS } from '../data/systems.js';
import { rngOf } from '../core/rng.js';

/** How many days between expansion checks — the lanes change slowly. */
export const EXPAND_EVERY_DAYS = 8;
/** A faction needs this much wealth in hand to push a claim. */
export const EXPAND_WEALTH_COST = 120;

/**
 * The flag that actually holds sway over a system: a save-time override if
 * the politics sim has moved it, otherwise the system's standing government.
 */
export function factionOf(state, sysId) {
  return (state.influence?.[sysId]) || SYSTEMS[sysId]?.gov || 'free';
}

/** The systems a faction presently holds. */
export function systemsOf(state, factionId) {
  const out = [];
  for (const id of Object.keys(SYSTEMS)) {
    if (factionOf(state, id) === factionId) out.push(id);
  }
  return out;
}

/** Daily income for a faction — its territory produces wealth. */
export function factionIncomePerDay(state, factionId) {
  let income = 0;
  for (const id of systemsOf(state, factionId)) {
    const sys = SYSTEMS[id];
    if (!sys) continue;
    const dangerCut = 1 - (sys.danger?.pirates ?? 0) * 0.6;
    income += (10 + sys.tech * 3) * dangerCut;
  }
  return Math.round(income);
}

/** Ensure a state carries the faction sim fields (wealth per flag). */
export function ensureFactions(state) {
  if (!state.factions) state.factions = {};
  for (const id of FACTION_IDS) {
    if (state.factions[id] == null) {
      state.factions[id] = { wealth: FACTIONS[id]?.startWealth ?? 200 };
    } else if (typeof state.factions[id] === 'number') {
      state.factions[id] = { wealth: state.factions[id] };
    }
  }
  if (!state.influence) state.influence = {};
  return state.factions;
}

/**
 * Advance the sim one day. Returns a list of event descriptions (strings with
 * a `kind` — 'good' | 'bad' | 'warn') for the toast feed. Factions accrue
 * wealth from their holdings; every EXPAND_EVERY_DAYS a rich faction may press
 * a claim on a border system, and flags that share an enemy may stand together.
 */
export function tickPolitics(state) {
  ensureFactions(state);
  const events = [];

  // daily accrual
  for (const id of FACTION_IDS) {
    state.factions[id].wealth += factionIncomePerDay(state, id);
  }

  // periodic expansion + diplomacy
  if (state.day % EXPAND_EVERY_DAYS !== 0) return events;

  const rng = rngOf(state.worldSeed, 'politics', state.day);
  const expanded = [];
  for (const id of FACTION_IDS) {
    const wealth = state.factions[id].wealth;
    if (wealth < EXPAND_WEALTH_COST) continue;
    // find a border system: adjacent to our territory, not a rival home, not already ours
    const ours = new Set(systemsOf(state, id));
    const border = new Set();
    for (const sysId of ours) {
      for (const nb of SYSTEMS[sysId]?.links || []) {
        if (!ours.has(nb) && !border.has(nb)) border.add(nb);
      }
    }
    const candidates = [...border].filter((nb) => {
      // nobody presses a claim on free-fire space — that is the one rule every
      // flag quietly agrees on, and the charts would be useless without it
      if (SYSTEMS[nb]?.freefire) return false;
      const home = FACTIONS[factionOf(state, nb)]?.home || [];
      return !home.includes(nb); // never take a rival's heart
    }).filter((nb) => !expanded.some((e) => e.system === nb)); // one claim per system, even mid-tick
    if (!candidates.length) continue;
    if (!rng.chance(0.4)) continue; // mostly they stay put
    const target = rng.pick(candidates);
    state.factions[id].wealth -= EXPAND_WEALTH_COST;
    state.influence[target] = id;
    expanded.push({ faction: id, system: target });
  }

  for (const e of expanded) {
    const f = FACTIONS[e.faction];
    const s = SYSTEMS[e.system];
    events.push({ kind: 'warn', text: `${f.name} pressed a claim on ${s.name} — their colours now fly there.` });
  }

  // shared enemies stand together: two flags that oppose the same foe patch a truce
  const byFoe = {};
  for (const id of FACTION_IDS) {
    const foe = FACTIONS[id]?.opposes;
    if (foe && foe !== id) (byFoe[foe] = byFoe[foe] || []).push(id);
  }
  for (const [foe, allies] of Object.entries(byFoe)) {
    if (allies.length >= 2 && rng.chance(0.35)) {
      const foeName = FACTIONS[foe]?.name || foe;
      const names = allies.map((a) => FACTIONS[a]?.name).join(' and ');
      events.push({ kind: 'good', text: `${names} stand together against ${foeName} — patrols run joint sweeps this season.` });
    }
  }

  return events;
}
