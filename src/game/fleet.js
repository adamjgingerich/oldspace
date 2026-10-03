// Your fleet: escorts that fly with you, and small craft parked in your bays.
//
// Roster entries live in state.fleet and survive saves. Names are runtime
// entities — universe.js spawns/despawns them to match the roster.

import { SHIP_BY_ID } from '../data/ships.js';
import { SHIP_NAMES } from '../data/names.js';
import { computeStats } from './state.js';

let uidCounter = 0;
const newUid = () => `f${Date.now().toString(36)}${(uidCounter++).toString(36)}`;

export function isMini(shipId) {
  return !!SHIP_BY_ID[shipId]?.mini;
}

export function fleetCapacity(state) {
  const s = computeStats(state);
  return { escorts: s.fleetSlots || 0, bays: s.bays || 0 };
}

export function countEscorts(state) {
  return (state.fleet || []).filter((m) => m.status === 'escort').length;
}

export function countDocked(state) {
  return (state.fleet || []).filter((m) => m.status === 'bay').length;
}

export function freeEscortSlots(state) {
  return Math.max(0, fleetCapacity(state).escorts - countEscorts(state));
}

export function freeBays(state) {
  return Math.max(0, fleetCapacity(state).bays - countDocked(state));
}

export function nextFreeBay(state) {
  const used = new Set((state.fleet || []).filter((m) => m.status === 'bay').map((m) => m.bay));
  for (let i = 0; i < 99; i++) {
    if (!used.has(i)) return i;
  }
  return 0;
}

export function entryByUid(state, uid) {
  return (state.fleet || []).find((m) => m.uid === uid) || null;
}

function freshName(state) {
  const taken = new Set([state.shipName, ...(state.fleet || []).map((m) => m.name)]);
  const pool = SHIP_NAMES.filter((n) => !taken.has(n));
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : `Lance ${Math.floor(Math.random() * 900 + 100)}`;
}

/**
 * Buy a hull into the fleet. Small craft prefer a bay cradle; anything can
 * fly as an escort if a fleet-slot is free.
 * @returns {{ok: boolean, entry?: object, error?: string}}
 */
export function addToFleet(state, shipId, name = null) {
  const def = SHIP_BY_ID[shipId];
  if (!def) return { ok: false, error: 'Unknown hull.' };
  const entry = { uid: newUid(), shipId, name: name || freshName(state), status: null, bay: null };
  if (isMini(shipId) && freeBays(state) > 0) {
    entry.status = 'bay';
    entry.bay = nextFreeBay(state);
  } else if (freeEscortSlots(state) > 0) {
    entry.status = 'escort';
  } else if (isMini(shipId)) {
    return { ok: false, error: 'No free docking bay or escort slot — free one up or refit first.' };
  } else {
    return { ok: false, error: 'No free escort slot — install a Fleet Command Uplink at a mechanic.' };
  }
  state.fleet.push(entry);
  return { ok: true, entry };
}

export function removeFromFleet(state, uid) {
  const idx = (state.fleet || []).findIndex((m) => m.uid === uid);
  if (idx === -1) return null;
  const [entry] = state.fleet.splice(idx, 1);
  return entry;
}

/** Sell back at 60% of list price. */
export function fleetSellValue(shipId) {
  const def = SHIP_BY_ID[shipId];
  return def ? Math.round(def.price * 0.6) : 0;
}

/** Spawn weapons + ammo for a fleet ship from its hull defaults. */
export function fleetLoadout(shipId) {
  const def = SHIP_BY_ID[shipId];
  const weapons = [...(def?.defaultWeapons || ['pulse', null])];
  const ammo = {};
  for (const w of weapons) {
    if (w === 'harpoon') ammo.harpoon = 6;
  }
  return { weapons, ammo };
}
