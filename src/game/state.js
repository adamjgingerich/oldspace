// The running adventure: commander, ship, cargo, reputation, missions, clock.

import { HULL_SCALE, SHIP_BY_ID, resolveShipId } from '../data/ships.js';
import { OUTFIT_BY_ID } from '../data/outfits.js';
import { COMMODITY_BY_ID } from '../data/commodities.js';
import { WEAPON_BY_ID } from '../data/weapons.js';
import { SHIP_NAMES } from '../data/names.js';
import { FACTIONS, FACTION_IDS } from '../data/factions.js';
import { SAVE_VERSION } from './saves.js';
import { rngOf } from '../core/rng.js';
import { skillStatAdds, repAdds } from './skills.js';
import { DEFAULT_SHIELD_TYPE, applyShieldProfile, defaultShieldType } from '../data/shields.js';

export const DAY_SECONDS = 150; // one in-game day per 2.5 minutes of flight

/**
 * Standing at or below this with a faction means their ports refuse you —
 * the "Hunted" tier on the reputation scale. Hard to reach, and it mends.
 */
export const HOSTILE_REP = -60;

/** Derived stats = base hull + outfit levels. Pure function of state. */
export function computeStats(state) {
  const base = SHIP_BY_ID[state.shipId] || SHIP_BY_ID.wayfarer;
  const s = {
    hull: base.hull,
    shield: base.shield,
    shieldRegen: base.shieldRegen,
    energy: base.energy,
    energyRegen: base.energyRegen,
    accel: base.accel,
    maxSpeed: base.maxSpeed,
    brake: base.brake,
    turn: base.turn,
    cargo: base.cargo,
    mounts: base.mounts ?? 2,
    maxMounts: base.maxMounts ?? base.mounts ?? 2,
    bays: base.bays ?? 0,
    maxBays: base.maxBays ?? base.bays ?? 0,
    fleetSlots: 0,
    lumenMax: 6,
    radar: 1400,
    armorRegen: 0,
  };
  for (const [id, level] of Object.entries(state.outfits || {})) {
    const outfit = OUTFIT_BY_ID[id];
    if (!outfit || !level) continue;
    const idx = outfit.add ? Math.min(level, outfit.add.length) - 1 : 0;
    if (outfit.add && outfit.stat && s[outfit.stat] !== undefined) s[outfit.stat] += outfit.add[idx];
    if (outfit.add2 && s[outfit.add2.stat] !== undefined) s[outfit.add2.stat] += outfit.add2.add[idx];
    // a lattice refit replaces the weave, it does not add to it
    if (outfit.shieldType) s.shieldType = outfit.shieldType;
  }
  // trained skills layer on top of outfits
  const skillAdds = skillStatAdds(state);
  for (const [key, value] of Object.entries(skillAdds)) {
    if (s[key] !== undefined) s[key] += value;
  }
  // hull limits are hard limits
  s.mounts = Math.min(s.mounts, s.maxMounts);
  s.bays = Math.min(s.bays, s.maxBays);
  // the lattice character goes on last so its multipliers apply to the tuned
  // pool, and so the HUD and the fight both read the same numbers
  applyShieldProfile(s, s.shieldType || (state.allegiance ? defaultShieldType(state.allegiance, 'player') : DEFAULT_SHIELD_TYPE));
  return s;
}

/** Why an outfit cannot be installed on the current hull — or null if it can. */
export function outfitInstallBlock(state, outfitId) {
  const outfit = OUTFIT_BY_ID[outfitId];
  if (!outfit) return 'Unknown outfit.';
  const def = SHIP_BY_ID[state.shipId] || SHIP_BY_ID.wayfarer;
  const level = state.outfits?.[outfitId] || 0;
  if (!outfit.add || level >= outfit.add.length) return null; // maxed — caller handles
  const addVal = outfit.add[level];
  if (outfit.stat === 'mounts') {
    const cap = def.maxMounts ?? def.mounts ?? 2;
    if ((def.mounts ?? 2) + addVal > cap) return `${def.name} cannot carry more than ${cap} gun mounts.`;
  }
  if (outfit.stat === 'bays') {
    const cap = def.maxBays ?? def.bays ?? 0;
    if (cap === 0) return `${def.name} has no room for a docking bay.`;
    if ((def.bays ?? 0) + addVal > cap) return `${def.name} cannot carry more than ${cap} docking bays.`;
  }
  return null;
}

export class GameState {
  constructor(opts = {}) {
    this.version = SAVE_VERSION;
    this.worldSeed = opts.worldSeed ?? (Date.now() % 2147483647);
    this.commander = opts.commander || 'Commander';
    this.shipId = opts.shipId || 'wayfarer';
    this.shipName = opts.shipName || rngOf(Date.now(), 'shipname').pick(SHIP_NAMES);
    this.credits = opts.credits ?? 2400;
    this.playtime = 0;
    this.day = 1;

    this.systemId = opts.systemId || 'haven';
    this.pos = opts.pos || { x: 420, z: 980 };
    this.heading = opts.heading ?? Math.PI * 0.9;
    this.lumen = opts.lumen ?? 4;
    this.visited = { [this.systemId]: true }; // the charts open as you fly the lanes

    this.cargo = {}; // commodityId -> qty (free cargo)
    this.weapons = ['pulse', 'needler']; // two hardpoints — a green pilot still gets teeth
    this.ammo = {}; // weaponId -> count (missiles)
    this.outfits = {}; // outfitId -> level
    this.rep = { free: 0, combine: 0, vigil: 0, reaver: 0, kreth: 0 };

    this.missions = [];
    this.missionsDone = 0;
    this.missionsFailed = 0;

    this.stats = { kills: 0, navyKills: 0, traderKills: 0, deaths: 0, jumps: 0, creditsEarned: 0, prizes: 0 };
    this.lastStation = null; // { systemId, stationId } — safe harbour & respawn
    this.hints = {}; // tutorial flags
    this.planets = {}; // planetName -> { day, lastDay, reward } survey records
    this.stars = {}; // sysId -> { day, lastDay } deep-core survey records
    this.grudge = {}; // faction -> last day its kin were attacked (the lanes remember)
    this.holdings = {}; // sysId -> { asset, units, day } — charters owned outright
    this.wormholes = {}; // holeId -> true — the anomalies the captain has mapped
    this.wormholeLicence = false; // Wormhole Consortium commercial transit licence
    // faction politics: each flag's treasury, and save-time influence overrides
    this.factions = {};
    for (const id of FACTION_IDS) this.factions[id] = { wealth: FACTIONS[id].startWealth };
    this.influence = {}; // systemId -> factionId — the politics sim's slow expansion
    this.integrity = { hull: null, shield: null }; // saved hull/shield of the current ship
    // hulls seen in the lanes / in the slips — fills in the codex
    this.sighted = opts.sighted ? { ...opts.sighted } : {};
    if (!this.sighted[this.shipId]) this.sighted[this.shipId] = { day: 1, systemId: this.systemId, via: 'own' };

    // character: where you come from, why you fly, and what you have learned
    this.background = opts.background || null;
    this.drive = opts.drive || null;
    this.allegiance = opts.allegiance || null; // faction id or null
    this.factionLine = opts.factionLine && typeof opts.factionLine === 'object'
      ? { faction: opts.factionLine.faction, stage: opts.factionLine.stage || 0 }
      : null; // { faction, stage } — progress down the flag's mission line
    this.broker = {}; // day stamps for the broker desk's introductions and amnesties
    this.karma = opts.karma ?? 0; // -100 (black) .. +100 (beacon)
    this.karmaLog = Array.isArray(opts.karmaLog) ? opts.karmaLog.map((e) => ({ ...e })) : [];
    this.karmaActs = opts.karmaActs ? { ...opts.karmaActs } : {}; // day -> { actId: count }
    this.xp = opts.xp ?? 0;
    this.skillPoints = opts.skillPoints ?? 1;
    this.skills = opts.skills ? { ...opts.skills } : {}; // skillId -> rank

    // your own fleet: escorts flying with you, and small craft in bay cradles
    this.fleet = Array.isArray(opts.fleet) ? opts.fleet.map((m) => ({ ...m })) : [];

    // permanent passives + shop unlocks earned down the flag's written path
    this.story = opts.story ? {
      mods: { ...(opts.story.mods || {}) },
      unlocked: [...(opts.story.unlocked || [])],
    } : { mods: {}, unlocked: [] };
    this.side = opts.side ? {
      active: { ...(opts.side.active || {}) },
      mods: { ...(opts.side.mods || {}) },
      done: [...(opts.side.done || [])],
    } : { active: {}, mods: {}, done: [] };
  }

  // ---------- clock ----------
  tickClock(dt) {
    this.playtime += dt;
    const day = 1 + Math.floor(this.playtime / DAY_SECONDS);
    if (day !== this.day) {
      this.day = day;
      return true; // day rolled over
    }
    return false;
  }

  // ---------- cargo ----------
  cargoUsed() {
    let used = 0;
    for (const qty of Object.values(this.cargo)) used += qty;
    for (const m of this.missions) {
      if (m.cargoLoaded) used += m.cargoLoaded.qty;
    }
    return used;
  }

  cargoCap() {
    return computeStats(this).cargo;
  }

  cargoFree() {
    return this.cargoCap() - this.cargoUsed();
  }

  addCargo(id, qty) {
    if (!COMMODITY_BY_ID[id]) return { ok: false, error: 'Unknown commodity.' };
    if (qty <= 0) return { ok: false, error: 'Nothing to load.' };
    if (this.cargoFree() < qty) return { ok: false, error: 'Not enough free cargo space.' };
    this.cargo[id] = (this.cargo[id] || 0) + qty;
    return { ok: true };
  }

  removeCargo(id, qty) {
    const have = this.cargo[id] || 0;
    if (have < qty) return { ok: false, error: 'You do not have that many crates.' };
    this.cargo[id] = have - qty;
    if (this.cargo[id] <= 0) delete this.cargo[id];
    return { ok: true };
  }

  addCredits(n) {
    this.credits = Math.max(0, Math.round(this.credits + n));
    if (n > 0) this.stats.creditsEarned += Math.round(n);
  }

  // ---------- reputation ----------
  addRep(faction, delta) {
    if (!(faction in this.rep)) return;
    let d = delta;
    // diplomatic training — and your own flag's fondness — colour the reception
    const r = repAdds(this);
    if (d > 0) d = Math.round(d * (1 + r.repGain + (this.allegiance === faction ? 0.1 : 0)));
    else if (d < 0) d = Math.round(d * Math.max(0.25, 1 - r.repLossCut));
    this.rep[faction] = Math.max(-100, Math.min(100, this.rep[faction] + d));
  }

  /**
   * Old grudges cool with time: every day a negative standing drifts toward
   * zero — one step, two when the blood is really bad. A name always mends.
   * Returns the factions that just climbed back out of the "Hunted" tier.
   */
  mendRep() {
    const mended = [];
    for (const faction of Object.keys(this.rep)) {
      const r = this.rep[faction];
      if (r >= 0) continue;
      const wasHunted = r <= HOSTILE_REP;
      this.rep[faction] = Math.min(0, r + (r <= -40 ? 2 : 1));
      if (wasHunted && this.rep[faction] > HOSTILE_REP) mended.push(faction);
    }
    return mended;
  }

  // ---------- ammo ----------
  ammoFor(weaponId) {
    const w = WEAPON_BY_ID[weaponId];
    if (!w || w.kind !== 'missile') return Infinity;
    return this.ammo[weaponId] || 0;
  }

  useAmmo(weaponId) {
    const w = WEAPON_BY_ID[weaponId];
    if (!w || w.kind !== 'missile') return true;
    if ((this.ammo[weaponId] || 0) <= 0) return false;
    this.ammo[weaponId] -= 1;
    return true;
  }

  // ---------- serialization ----------
  toJSON() {
    return {
      version: SAVE_VERSION,
      worldSeed: this.worldSeed,
      commander: this.commander,
      shipId: this.shipId,
      shipName: this.shipName,
      credits: this.credits,
      playtime: this.playtime,
      day: this.day,
      systemId: this.systemId,
      pos: { ...this.pos },
      heading: this.heading,
      lumen: this.lumen,
      cargo: { ...this.cargo },
      weapons: [...this.weapons],
      ammo: { ...this.ammo },
      outfits: { ...this.outfits },
      rep: { ...this.rep },
      missions: this.missions.map((m) => ({ ...m })),
      missionsDone: this.missionsDone,
      missionsFailed: this.missionsFailed,
      stats: { ...this.stats },
      lastStation: this.lastStation ? { ...this.lastStation } : null,
      hints: { ...this.hints },
      planets: { ...this.planets },
      stars: { ...this.stars },
      grudge: { ...this.grudge },
      holdings: { ...this.holdings },
      wormholes: { ...this.wormholes },
      wormholeLicence: this.wormholeLicence,
      factions: { ...this.factions },
      influence: { ...this.influence },
      integrity: { ...this.integrity },
      sighted: { ...this.sighted },
      visited: { ...this.visited },
      background: this.background,
      drive: this.drive,
      allegiance: this.allegiance,
      factionLine: this.factionLine ? { ...this.factionLine } : null,
      broker: { ...(this.broker || {}) },
      karma: this.karma,
      karmaLog: this.karmaLog.map((e) => ({ ...e })),
      karmaActs: { ...this.karmaActs },
      xp: this.xp,
      skillPoints: this.skillPoints,
      skills: { ...this.skills },
      fleet: this.fleet.map((m) => ({ ...m })),
      story: {
        mods: { ...this.story.mods },
        unlocked: [...this.story.unlocked],
      },
      side: {
        active: { ...this.side.active },
        mods: { ...this.side.mods },
        done: [...this.side.done],
      },
    };
  }

  static fromJSON(obj) {
    const st = new GameState({});
    st.version = obj.version || SAVE_VERSION;
    st.worldSeed = obj.worldSeed ?? 1;
    st.commander = obj.commander || 'Commander';
    st.shipId = resolveShipId(obj.shipId);
    st.shipName = obj.shipName || 'Wayfarer';
    st.credits = obj.credits ?? 0;
    st.playtime = obj.playtime ?? 0;
    st.day = obj.day ?? 1;
    st.systemId = obj.systemId || 'haven';
    st.pos = obj.pos ? { ...obj.pos } : { x: 420, z: 980 };
    st.heading = obj.heading ?? 0;
    st.lumen = obj.lumen ?? 4;
    st.cargo = { ...(obj.cargo || {}) };
    st.weapons = Array.isArray(obj.weapons) ? [...obj.weapons] : ['pulse', null];
    st.ammo = { ...(obj.ammo || {}) };
    st.outfits = { ...(obj.outfits || {}) };
    st.rep = { free: 0, combine: 0, vigil: 0, reaver: 0, kreth: 0, ...(obj.rep || {}) };
    st.missions = Array.isArray(obj.missions) ? obj.missions.map((m) => ({ ...m })) : [];
    st.missionsDone = obj.missionsDone ?? 0;
    st.missionsFailed = obj.missionsFailed ?? 0;
    st.stats = { kills: 0, navyKills: 0, traderKills: 0, deaths: 0, jumps: 0, creditsEarned: 0, prizes: 0, ...(obj.stats || {}) };
    st.lastStation = obj.lastStation ? { ...obj.lastStation } : null;
    st.hints = { ...(obj.hints || {}) };
    st.planets = { ...(obj.planets || {}) };
    st.stars = { ...(obj.stars || {}) };
    st.grudge = { ...(obj.grudge || {}) };
    st.holdings = {};
    for (const [sid, h] of Object.entries(obj.holdings || {})) {
      st.holdings[sid] = { ...h, units: { freighter: 0, patrol: 0, ...(h.units || {}) } };
    }
    st.wormholes = { ...(obj.wormholes || {}) };
    st.wormholeLicence = !!obj.wormholeLicence;
    st.factions = {};
    for (const id of FACTION_IDS) {
      const v = obj.factions?.[id];
      st.factions[id] = typeof v === 'number'
        ? { wealth: v }
        : (v && typeof v === 'object' ? { ...v, wealth: v.wealth ?? FACTIONS[id].startWealth } : { wealth: FACTIONS[id].startWealth });
    }
    st.influence = { ...(obj.influence || {}) };
    st.sighted = { ...(obj.sighted || {}) };
    if (!st.sighted[st.shipId]) st.sighted[st.shipId] = { day: st.day, systemId: st.systemId, via: 'own' };
    // charts: legacy saves open with only the current system charted
    st.visited = obj.visited && typeof obj.visited === 'object'
      ? { ...obj.visited }
      : { [st.systemId]: true };
    st.integrity = obj.integrity ? { ...obj.integrity } : { hull: null, shield: null };
    // v1 saves predate the hull/shield rescale — scale stored integrity to the new pools
    if ((obj.version || 0) < 2 && st.integrity.hull != null) {
      st.integrity.hull = Math.round(st.integrity.hull * HULL_SCALE);
      if (st.integrity.shield != null) st.integrity.shield = Math.round(st.integrity.shield * HULL_SCALE);
    }
    st.background = obj.background || null;
    st.drive = obj.drive || null;
    st.allegiance = obj.allegiance || null;
    st.factionLine = obj.factionLine && typeof obj.factionLine === 'object'
      ? { faction: obj.factionLine.faction, stage: obj.factionLine.stage || 0 }
      : null;
    st.broker = obj.broker && typeof obj.broker === 'object' ? { ...obj.broker } : {};
    st.karma = obj.karma ?? 0;
    st.karmaLog = Array.isArray(obj.karmaLog) ? obj.karmaLog.map((e) => ({ ...e })) : [];
    st.karmaActs = obj.karmaActs && typeof obj.karmaActs === 'object' ? { ...obj.karmaActs } : {};
    st.xp = obj.xp ?? 0;
    st.skillPoints = obj.skillPoints ?? 1;
    st.skills = { ...(obj.skills || {}) };
    st.fleet = Array.isArray(obj.fleet) ? obj.fleet.map((m) => ({ ...m })) : [];
    st.story = obj.story ? {
      mods: { ...(obj.story.mods || {}) },
      unlocked: [...(obj.story.unlocked || [])],
    } : { mods: {}, unlocked: [] };

    // migrate pre-0.48 saves: story rank + faction-line stage were two
    // separate counters; fold them into the one unified chain position
    if (obj.story && obj.story.rank && st.allegiance) {
      const LINE_FACTION = { vig: 'vigil', rea: 'reaver', com: 'combine' };
      const lineId = Object.keys(obj.story.rank)
        .find((lid) => LINE_FACTION[lid] === st.allegiance);
      const oldStoryRank = lineId ? (obj.story.rank[lineId] || 0) : 0;
      const oldFactionStage = obj.factionLine?.stage || 0;
      st.factionLine = { faction: st.allegiance, stage: oldStoryRank + oldFactionStage };
    }
    st.side = obj.side ? {
      active: { ...(obj.side.active || {}) },
      mods: { ...(obj.side.mods || {}) },
      done: [...(obj.side.done || [])],
    } : { active: {}, mods: {}, done: [] };
    // hardpoints track the hull: keep the weapons array long enough for its mounts
    const def0 = SHIP_BY_ID[st.shipId] || SHIP_BY_ID.wayfarer;
    while (st.weapons.length < Math.max(2, def0.mounts ?? 2)) st.weapons.push(null);
    return st;
  }
}
