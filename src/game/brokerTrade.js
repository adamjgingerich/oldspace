// Buying from a broker's crate.
//
// The rules of the crate trade live here rather than in game.js so they can be
// audited without a browser: a purchase always re-reads the crate, prices the
// row again from the broker's own figures, checks the customer can actually
// carry the thing, and only then moves credits and hardware. Buying gear whose
// papers you do not hold is the whole point of the trade — and the papers come
// with the crate, so the mechanic will fit her out again if you swap her off
// later.

import { BROKER_BY_ID, NO_PAPERS_FEE, brokerCrateRow } from '../data/brokers.js';
import { WEAPON_BY_ID } from '../data/weapons.js';
import { OUTFIT_BY_ID } from '../data/outfits.js';
import { outfitInstallBlock, computeStats } from './state.js';
import { ensureStory } from './story.js';

/** Papers on file: the captain may buy, fit and refit this item anywhere. */
export function brokerPapers(state, itemId) {
  return (state?.story?.unlocked || []).includes(itemId);
}

/** Log the find: from now on the item is licensed to this captain. */
export function grantBrokerPapers(state, itemId) {
  const s = ensureStory(state);
  if (!s.unlocked.includes(itemId)) s.unlocked.push(itemId);
}

/** What the broker wants for a row, given whether the captain holds papers. */
export function askingPrice(base, markup, papers) {
  const raw = base * markup * (papers ? 1 : NO_PAPERS_FEE);
  return Math.max(250, Math.round(raw / 250) * 250);
}

/**
 * Buy a gun out of the crate and have it bolted to a hardpoint. Mirrors the
 * mechanic's fitting rules — the replaced gun comes off at half its list price
 * — but pays the broker's asking price, not the list price.
 */
export function buyCrateWeapon(state, brokerId, systemId, weaponId, slot) {
  const broker = BROKER_BY_ID[brokerId];
  const weapon = WEAPON_BY_ID[weaponId];
  if (!broker || !weapon) return { ok: false, reason: 'That crate has moved on.' };
  const row = brokerCrateRow(broker, state, systemId, 'weapon', weaponId);
  if (!row) return { ok: false, reason: `${broker.name} is not carrying a ${weapon.name} today.` };
  if (!Number.isInteger(slot) || slot < 0) return { ok: false, reason: 'No hardpoint there.' };
  const mounts = computeStats(state).mounts;
  if (slot >= mounts) return { ok: false, reason: `This hull carries ${mounts} hardpoint${mounts === 1 ? '' : 's'}.` };
  const current = state.weapons[slot] || null;
  if (current === weaponId && weapon.kind !== 'missile') {
    return { ok: false, reason: `She is already in hardpoint ${slot + 1}.` };
  }
  let refund = 0;
  if (current && current !== weaponId) {
    const old = WEAPON_BY_ID[current];
    if (old) refund = Math.round(old.price * 0.5);
  }
  const net = row.asking - refund;
  if (net > state.credits) {
    return { ok: false, reason: `Not enough credits — she wants ${row.asking.toLocaleString()}.` };
  }
  state.addCredits(-net);
  if (current && current !== weaponId && WEAPON_BY_ID[current]?.kind === 'missile') state.ammo[current] = 0;
  state.weapons[slot] = weaponId;
  if (weapon.kind === 'missile') {
    state.ammo[weaponId] = Math.min(weapon.maxAmmo, (state.ammo[weaponId] || 0) + weapon.rack);
  }
  grantBrokerPapers(state, weaponId);
  return { ok: true, spent: net, refund, row, weapon, slot };
}

/**
 * Buy a fitting out of the crate. Rare fittings are one level deep, so this is
 * install-once; the usual hull limits (extra mounts, bays) still apply.
 */
export function buyCrateOutfit(state, brokerId, systemId, outfitId) {
  const broker = BROKER_BY_ID[brokerId];
  const outfit = OUTFIT_BY_ID[outfitId];
  if (!broker || !outfit) return { ok: false, reason: 'That crate has moved on.' };
  const row = brokerCrateRow(broker, state, systemId, 'outfit', outfitId);
  if (!row) return { ok: false, reason: `${broker.name} is not carrying a ${outfit.name} today.` };
  const level = state.outfits[outfitId] || 0;
  if (level >= outfit.prices.length) return { ok: false, reason: `The ${outfit.name} is already fitted.` };
  const block = outfitInstallBlock(state, outfitId);
  if (block) return { ok: false, reason: block };
  if (row.asking > state.credits) {
    return { ok: false, reason: `Not enough credits — she wants ${row.asking.toLocaleString()}.` };
  }
  state.addCredits(-row.asking);
  state.outfits[outfitId] = level + 1;
  grantBrokerPapers(state, outfitId);
  return { ok: true, spent: row.asking, row, outfit, level: level + 1 };
}
