// Character creation: backgrounds, drives, and the perks they grant.
// Everything here only touches the state at the moment a log is opened —
// the character stays fully flexible afterwards.

import { BACKGROUNDS, BACKGROUND_BY_ID, DRIVES, DRIVE_BY_ID } from '../data/backgrounds.js';
import { OUTFIT_BY_ID } from '../data/outfits.js';
import { WEAPON_BY_ID } from '../data/weapons.js';
import { COMMODITY_BY_ID } from '../data/commodities.js';
import { SKILL_BY_ID } from '../data/skills.js';
import { FACTIONS, STARTING_SWEAR_REP } from '../data/factions.js';
import { clamp } from '../core/util.js';

export { BACKGROUNDS, BACKGROUND_BY_ID, DRIVES, DRIVE_BY_ID };

const REP_NAMES = { vigil: 'Vigil', combine: 'Combine', reaver: 'Reavers', free: 'Free ports', kreth: 'Kreth Houses' };

/** Short human-readable list of what a perk block grants. */
export function describePerks(perks = {}) {
  const out = [];
  if (perks.credits) out.push(`${perks.credits > 0 ? '+' : ''}₡${perks.credits.toLocaleString()}`);
  if (perks.skillPoints) out.push(`+${perks.skillPoints} skill point${perks.skillPoints > 1 ? 's' : ''}`);
  if (perks.karma) out.push(`${perks.karma > 0 ? '+' : ''}${perks.karma} karma`);
  if (perks.outfits) {
    for (const [id, level] of Object.entries(perks.outfits)) out.push(`${OUTFIT_BY_ID[id]?.name || id} L${level}`);
  }
  if (perks.cargo) {
    for (const [id, qty] of Object.entries(perks.cargo)) out.push(`${qty}× ${COMMODITY_BY_ID[id]?.name || id}`);
  }
  if (perks.weapons) out.push(`${WEAPON_BY_ID[perks.weapons.id]?.name || perks.weapons.id} fitted`);
  if (perks.skills) {
    for (const [id, rank] of Object.entries(perks.skills)) {
      out.push(`${SKILL_BY_ID[id]?.name || id} rank ${rank}`);
    }
  }
  if (perks.rep) {
    for (const [faction, amount] of Object.entries(perks.rep)) {
      out.push(`${REP_NAMES[faction] || faction} ${amount > 0 ? '+' : ''}${amount}`);
    }
  }
  return out;
}

function applyPerks(state, perks = {}) {
  if (!perks) return;
  if (perks.credits) state.addCredits(perks.credits);
  if (perks.karma) state.karma = clamp(state.karma + perks.karma, -100, 100);
  if (perks.skillPoints) state.skillPoints += perks.skillPoints;
  if (perks.outfits) {
    for (const [id, level] of Object.entries(perks.outfits)) {
      state.outfits[id] = Math.max(state.outfits[id] || 0, level);
    }
  }
  if (perks.cargo) {
    for (const [id, qty] of Object.entries(perks.cargo)) state.cargo[id] = (state.cargo[id] || 0) + qty;
  }
  if (perks.weapons) {
    state.weapons[perks.weapons.slot] = perks.weapons.id;
    if (perks.weapons.ammo) state.ammo[perks.weapons.id] = (state.ammo[perks.weapons.id] || 0) + perks.weapons.ammo;
  }
  if (perks.skills) {
    for (const [id, rank] of Object.entries(perks.skills)) {
      state.skills[id] = Math.max(state.skills[id] || 0, rank);
    }
  }
  if (perks.rep) {
    for (const [faction, amount] of Object.entries(perks.rep)) state.addRep(faction, amount);
  }
}

/**
 * Swearing your colours before the first bell. The recruiters already know the
 * name, your flag's rivals have already heard it, and your flag's own desks —
 * and its skill tree — are open from the first second of the log.
 */
export function startingOath(state, factionId) {
  const f = FACTIONS[factionId];
  if (!f) return null;
  state.allegiance = factionId;
  state.factionLine = { faction: factionId, stage: 0 };
  state.addRep(factionId, STARTING_SWEAR_REP);
  if (f.opposes) state.addRep(f.opposes, -15);
  for (const [id, other] of Object.entries(FACTIONS)) {
    if (id === factionId || id === f.opposes) continue;
    if (other.opposes === factionId) state.addRep(id, -8);
  }
  return f;
}

/** Stamp a fresh character onto a new GameState. */
export function applyCharacter(state, backgroundId, driveId, factionId = null) {
  const bg = BACKGROUND_BY_ID[backgroundId] || BACKGROUNDS[0];
  const drive = DRIVE_BY_ID[driveId] || DRIVES[0];
  state.background = bg.id;
  state.drive = drive.id;
  applyPerks(state, bg.perks);
  applyPerks(state, drive.perks);
  const faction = factionId ? startingOath(state, factionId) : null;
  state.hints.bg = true;
  return { background: bg, drive, faction };
}

export function backgroundOf(state) {
  return state.background ? BACKGROUND_BY_ID[state.background] : null;
}

export function driveOf(state) {
  return state.drive ? DRIVE_BY_ID[state.drive] : null;
}
