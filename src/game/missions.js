// Mission board: deliveries, bounties, sweeps, surveys and black-box recoveries.
// Offers are deterministic per world-seed + station + day; accepted missions live
// in the save file. Contracts come in five risk tiers — the board offers harder,
// richer work as the commander's renown grows.

import { SYSTEMS } from '../data/systems.js';
import { COMMODITY_BY_ID } from '../data/commodities.js';
import { PIRATE_FIRST, PIRATE_EPITHET } from '../data/names.js';
import { SHIP_BY_ID } from '../data/ships.js';
import { WEAPONS } from '../data/weapons.js';
import { OUTFITS } from '../data/outfits.js';
import { BRIEFS, TWIST_INFO, OUTROS } from '../data/voices.js';
import { rngOf } from '../core/rng.js';
import { addKarma, economyMods, levelFromXp } from './skills.js';
import { clamp } from '../core/util.js';
import { advanceStory, onStoryAccepted, ensureStory } from './story.js';
import { advanceSide } from './sidequests.js';

export const MAX_ACTIVE = 6;

/**
 * The next step of a contract, phrased for the helm — where to fly RIGHT NOW,
 * what to do there, and whether it is a return leg. The HUD, the radar and
 * the ship's computer all speak from this one place.
 */
export function missionGuide(state, m, currentSystemId) {
  const dest = m.dest?.systemId ?? null;
  const here = (systemId) => systemId === currentSystemId;
  switch (m.type) {
    case 'delivery':
      return { phase: 'deliver', verb: 'DELIVER', systemId: dest, stationId: null, here: here(dest), note: 'hand the cargo over at any berth there' };
    case 'courier':
      return { phase: 'deliver', verb: 'COURIER', systemId: dest, stationId: null, here: here(dest), note: 'hand the case over at any berth there' };
    case 'survey':
      return m.scanned
        ? { phase: 'return', verb: 'RETURN', systemId: m.issuer.systemId, stationId: m.issuer.stationId, here: here(m.issuer.systemId), note: 'file the survey at the issuing office' }
        : { phase: 'survey', verb: 'SURVEY', systemId: dest, stationId: null, here: here(dest), note: 'lock the beacon for a full sweep' };
    case 'recovery': {
      const done = m.pods && m.pods.taken.length >= m.pods.need;
      return done
        ? { phase: 'return', verb: 'RETURN', systemId: m.issuer.systemId, stationId: m.issuer.stationId, here: here(m.issuer.systemId), note: 'deliver the recorder pods at the issuing office' }
        : { phase: 'recover', verb: 'RECOVER', systemId: dest, stationId: null, here: here(dest), note: `haul in ${m.pods ? Math.max(0, m.pods.need - m.pods.taken.length) : '?'} more pod(s) from the wreck field` };
    }
    case 'bounty':
      return { phase: 'hunt', verb: 'HUNT', systemId: dest, stationId: null, here: here(dest), note: `destroy ${m.target?.name || 'the mark'} — the bounty clears on the kill` };
    case 'sweep':
      return { phase: 'sweep', verb: 'SWEEP', systemId: dest, stationId: null, here: here(dest), note: `${m.kills?.got ?? 0}/${m.kills?.need ?? '?'} raiders down — it settles on the last kill` };
    case 'relic':
      return { phase: 'vault', verb: 'OPEN VAULT', systemId: dest, stationId: null, here: here(dest), note: 'hold station by the vault and crack the cipher' };
    default:
      return { phase: 'go', verb: 'FLY TO', systemId: dest, stationId: null, here: here(dest), note: '' };
  }
}

/** Display name for a station id inside a system (fallback: the system name). */
export function missionStationName(systemId, stationId) {
  const st = SYSTEMS[systemId]?.stations?.find((s) => s.id === stationId);
  return st ? st.name : (SYSTEMS[systemId]?.name ?? '—');
}

/** Human labels per contract type, shared by the dock and the star chart. */
export const MISSION_TAGS = {
  delivery: 'DELIVERY', courier: 'COURIER', bounty: 'BOUNTY', survey: 'SURVEY', sweep: 'SWEEP', recovery: 'RECOVERY', relic: 'RELIC HUNT',
};

/** Per-type accent colors — dock tags, chart list and HUD markers stay in sync. */
export const MISSION_COLORS = {
  delivery: '#ffc857',
  courier: '#8fd0ff',
  bounty: '#ff5f7a',
  survey: '#a58cff',
  sweep: '#ff9a3c',
  recovery: '#63ffc0',
  relic: '#ffd27a',
};

/**
 * Risk tier the commander has grown into. Blends level, learned skills and
 * wealth in the bank — the lanes grow meaner as the pilot grows stronger.
 */
export function playerTier(state) {
  const lvl = levelFromXp(state.xp || 0);
  const wealth = Math.min(6, Math.floor((state.credits || 0) / 75000));
  let ranks = 0;
  for (const r of Object.values(state.skills || {})) ranks += r;
  const skill = Math.min(5, Math.floor(ranks / 4));
  const threat = lvl + wealth + skill;
  return clamp(1 + Math.floor((threat - 1) / 6), 1, 8);
}

/** Star string for a risk tier, e.g. '★★★' (eight stars compress to '★★★★★+'). */
export function tierStars(tier) {
  const t = clamp(tier || 1, 1, 8);
  return '★'.repeat(Math.min(t, 5)) + (t > 5 ? '+' : '');
}

/** One-line progress for contract types that count something. */
export function missionProgress(m) {
  if (m.type === 'sweep' && m.kills) {
    const noun = m.foe === 'navy' ? 'Patrols broken' : 'Raiders downed';
    return `${noun}: ${m.kills.got}/${m.kills.need}`;
  }
  if (m.type === 'recovery' && m.pods) return `Recorder pods: ${m.pods.taken.length}/${m.pods.need}`;
  if (m.type === 'relic') return m.scanned ? 'the vault is open' : null;
  return null;
}

/** Contract pay multiplier by risk tier. */
const TIER_MULT = [0, 1, 1.7, 2.8, 4.3, 6.5, 9, 12, 16];
/** How many lane-jumps a job may reach from the issuing station, by tier. */
const MAX_HOPS = [0, 2, 2, 3, 4, 5, 5, 6, 6];
/** Elite target buffs by tier — a five-star mark is a genuinely nasty pilot. */
const HULL_MULT = [0, 1.05, 1.2, 1.35, 1.45, 1.6, 1.7, 1.75, 1.8];
const SHIELD_MULT = [0, 0.95, 1.05, 1.25, 1.4, 1.5, 1.55, 1.6, 1.65];
/**
 * Marks' hulls by tier — rookies hunt patched cutters and light raiders; the
 * top of the board puts real weight on the other side of the guns: cruisers at
 * four stars, and capitals only on five-star work. Entries may be a single id
 * or a short list to pick from.
 */
const PIRATE_BOUNTY_SHIPS = [null, 'wayfarer', 'marlin', 'voskar', ['dragoon', 'cuirassier', 'rapier'], 'tempest', ['tempest', 'legion'], ['redoubt', 'marshal'], 'monarch'];
const VIGIL_BOUNTY_SHIPS = [null, 'sparrowhawk', 'watchman', ['halcyon', 'watchman'], ['paladin', 'marshal'], 'monarch', ['monarch', 'leviathan'], ['redoubt', 'colossus'], ['colossus', 'sceptre']];
/** Target gun fit by tier — rookies face a single barrel; eight-star marks carry dreadnought batteries. */
const BOUNTY_ARMS = [null, ['pulse', null], ['pulse', null], ['pulse', 'harpoon'], ['twinpulse', 'harpoon'], ['flenser', 'flenser', 'harpoon'], ['flenser', 'flenser', 'harpoon'], ['flenser', 'twinpulse', 'harpoon'], ['flenser', 'flenser', 'twinpulse', 'harpoon']];
const BOUNTY_AMMO = [0, 0, 0, 3, 5, 8, 8, 9, 10];
/** Marks above this hull size are already monsters — buffs are damped so a capital stays a fight, not a wall. */
const BIG_MARK_HULL = 1100;
/** Capital marks pay a hull tithe on top of the contract fee. */
const HULL_TITHE = 0.07;

/** Legendary vault loot — graded so every era of pilot has a relic to chase. */
const LEGENDARIES = [...WEAPONS, ...OUTFITS].filter((d) => d.legend);
/** Job types that can pick up a complication, and which complications fit. */
const TWIST_POOL = {
  delivery: ['watched', 'ambush', 'gratuity', 'graft'],
  courier: ['watched', 'ambush', 'silent', 'gratuity', 'graft'],
  bounty: ['rival', 'gratuity', 'graft'],
  survey: ['silent', 'ambush', 'gratuity', 'graft'],
  sweep: ['watched', 'gratuity', 'graft'],
  recovery: ['silent', 'ambush', 'rival', 'gratuity', 'graft'],
  relic: ['silent', 'ambush'],
};

/** Card chip for a complication, or null. */
export function twistLabel(kind) {
  return TWIST_INFO[kind]?.label || null;
}

/** Roll at most one complication for a generated job. */
function rollTwist(rng, job, tier) {
  const pool = TWIST_POOL[job];
  if (!pool) return null;
  if (!rng.chance(clamp(0.28 + tier * 0.07, 0, 0.62))) return null;
  return rng.pick(pool);
}

/** Hot lanes pay better — destinations with heavy raider traffic add a bonus. */
function riskBonus(destId) {
  return SYSTEMS[destId].danger.pirates > 0.5 ? 1.2 : 1;
}

/** Lane-depth of every system from the core (hops from Haven); unvisited fall back to 6. */
const DEPTH = (() => {
  const d = { haven: 0 };
  const q = ['haven'];
  while (q.length) {
    const cur = q.shift();
    for (const l of SYSTEMS[cur].links) {
      if (d[l] === undefined) { d[l] = d[cur] + 1; q.push(l); }
    }
  }
  for (const id of Object.keys(SYSTEMS)) if (d[id] === undefined) d[id] = 6;
  return d;
})();

/**
 * How far out and how lawless a system is. Late-game work is aimed by this:
 * the deeper and meaner the destination, the more the board wants to send you there.
 */
export function reachScore(systemId) {
  return (DEPTH[systemId] ?? 3) + (SYSTEMS[systemId]?.danger.pirates ?? 0) * 3;
}

/** Long hauls past the core pay a distance premium. */
function deepPay(destId) {
  return 1 + reachScore(destId) * 0.04;
}

/** Pick a destination: green contracts keep to the quieter lanes, veteran work runs deep. */
function weightedDest(rng, cands, tier) {
  let total = 0;
  const weights = cands.map((c) => {
    const s = reachScore(c.id);
    let w;
    if (tier <= 2) {
      // green contracts keep to the safer inner lanes — outlaw systems are
      // avoided until the pilot has the teeth for them
      const hostile = (SYSTEMS[c.id]?.gov || 'free') === 'reaver';
      w = (hostile ? 0.12 : 1) + Math.max(0, 5.5 - s) * (tier === 1 ? 0.35 : 0.6);
    } else {
      w = Math.pow(1 + s * 0.35, tier - 1);
    }
    total += w;
    return w;
  });
  let r = rng.float(0, total);
  for (let i = 0; i < cands.length; i++) {
    r -= weights[i];
    if (r <= 0) return cands[i];
  }
  return cands[cands.length - 1];
}

function reachableFrom(sysId, maxHops = 2) {
  const out = [];
  const seen = new Set([sysId]);
  let frontier = [sysId];
  for (let hop = 1; hop <= maxHops; hop++) {
    const next = [];
    for (const s of frontier) {
      for (const l of SYSTEMS[s].links) {
        if (seen.has(l)) continue;
        seen.add(l);
        out.push({ id: l, hops: hop });
        next.push(l);
      }
    }
    frontier = next;
  }
  return out;
}

export function generateBoard(state, station) {
  const rng = rngOf(state.worldSeed, 'board', station.id, state.day);
  const sys = SYSTEMS[state.systemId];
  const myTier = playerTier(state);
  // the deep stations of the Outer Reach post harder and fuller boards
  const outer = reachScore(state.systemId) >= 5;
  const reach = reachableFrom(state.systemId, 2);
  const offers = [];
  if (reach.length === 0) return offers;

  // more work on the board while green — rookies always have something honest to haul
  const count = myTier <= 2 ? rng.int(6, 8) : outer ? rng.int(6, 7) : rng.int(5, 6);
  for (let i = 0; i < count; i++) {
    // risk tier: usually around the commander's renown, sometimes easier or aspirational —
    // out here, the board skews one notch nastier than the pilot
    const tier = clamp(myTier + rng.int(-2, 1) + (outer ? 1 : 0), 1, 8);
    const reachT = reachableFrom(state.systemId, MAX_HOPS[tier]);
    // late-game money runs deep: higher tiers aim at the far systems
    const dest = weightedDest(rng, reachT.length ? reachT : reach, tier);
    const mult = TIER_MULT[tier] * riskBonus(dest.id) * deepPay(dest.id);
    const id = `${station.id}-d${state.day}-${i}-${rng.int(100, 999)}`;
    const roll = rng.float(0, 1);
    const repAmount = 2 + Math.ceil(tier / 2);

    // job mix by renown — hauls and couriers for rookies, blades for veterans
    const mix = tier <= 2
      ? [['delivery', 0.34], ['courier', 0.2], ['survey', 0.16], ['bounty', 0.14], ['sweep', 0.08], ['recovery', 0.08]]
      : tier === 3
        ? [['delivery', 0.28], ['courier', 0.1], ['survey', 0.14], ['bounty', 0.22], ['sweep', 0.14], ['recovery', 0.12]]
        : [['delivery', 0.24], ['courier', 0.06], ['survey', 0.12], ['bounty', 0.26], ['sweep', 0.18], ['recovery', 0.14]];
    let job = 'delivery';
    let acc = 0;
    for (const [type, weight] of mix) {
      acc += weight;
      if (roll <= acc) { job = type; break; }
    }

    if (job === 'delivery') {
      // ---- delivery ----
      const legalPool = (sys.economy.produces.length ? sys.economy.produces : ['grain', 'ore', 'ice'])
        .filter((c) => !COMMODITY_BY_ID[c]?.illegal);
      const commodityId = rng.pick(legalPool.length ? legalPool : ['grain']);
      const c = COMMODITY_BY_ID[commodityId];
      const qty = rng.int(4, 8 + tier * 2);
      const urgent = rng.chance(0.12 + tier * 0.06);
      const reward = Math.round((qty * c.base * 1.45 + rng.float(250, 900)) * mult * (urgent ? 1.6 : 1));
      offers.push({
        id, type: 'delivery', tier, urgent,
        title: urgent ? `Rush order: ${qty} × ${c.name}` : `Haul ${qty} × ${c.name}`,
        desc: urgent
          ? `A factor at ${SYSTEMS[dest.id].name} is paying over the odds because the consignment is late already. Stands ready in your hold the moment you sign — fly fast, the clock is short.`
          : `${SYSTEMS[dest.id].name} is short on ${c.name.toLowerCase()}. Load it, run the lanes, and drop it at any berth there.`,
        issuer: { stationId: station.id, systemId: state.systemId, faction: station.owner },
        dest: { systemId: dest.id },
        cargo: { id: commodityId, qty },
        reward,
        rep: { faction: station.owner, amount: repAmount },
        deadlineDay: state.day + (urgent ? 1 + dest.hops : 3 + dest.hops * 2),
      });
    } else if (job === 'courier') {
      // ---- courier: a sealed case, a short hop, and the clerk pays on the barrelhead ----
      const pools = [['electronics', 'dispatch core'], ['medicine', 'sealed case']];
      const [commodityId, noun] = rng.pick(pools);
      const qty = rng.int(1, 2);
      const shortReach = reachableFrom(state.systemId, tier <= 2 ? 1 : 2);
      const cDest = rng.pick(shortReach.length ? shortReach : reach);
      const reward = Math.round((rng.int(320, 620) + qty * 60) * TIER_MULT[tier] * riskBonus(cDest.id));
      offers.push({
        id, type: 'courier', tier,
        title: `Courier run — ${SYSTEMS[cDest.id].name}`,
        desc: `A ${noun} logged and signed for. ${SYSTEMS[cDest.id].name} wants it by the next bell — hand it over at any berth there. Light, quick, and it pays cash over the desk.`,
        issuer: { stationId: station.id, systemId: state.systemId, faction: station.owner },
        dest: { systemId: cDest.id },
        cargo: { id: commodityId, qty },
        reward,
        rep: { faction: station.owner, amount: repAmount },
        deadlineDay: state.day + 2 + cDest.hops,
      });
    } else if (job === 'bounty') {
      // ---- bounty ----
      const reaverIssuer = station.owner === 'reaver';
      const targetKind = reaverIssuer ? 'vigil' : 'pirate';
      const shipEntry = (targetKind === 'vigil' ? VIGIL_BOUNTY_SHIPS : PIRATE_BOUNTY_SHIPS)[tier];
      const shipId = Array.isArray(shipEntry) ? rng.pick(shipEntry) : shipEntry;
      const markDef = SHIP_BY_ID[shipId];
      const bigMark = (markDef?.hull || 0) >= BIG_MARK_HULL;
      const tithe = Math.round((markDef?.price || 0) * HULL_TITHE); // a capital mark pays for the hull you must crack
      const escorts = Math.min(5, tier >= 4 ? tier - 2 : 0);
      const name = `${rng.pick(PIRATE_FIRST)} ${rng.pick(PIRATE_EPITHET)}`;
      const base = targetKind === 'vigil' ? rng.int(2000, 3600) : rng.int(1300, 2600);
      const reward = Math.round(base * mult * (1 + escorts * 0.18)) + tithe;
      const escortText = escorts === 1 ? ' A wingman flies with them.' : escorts > 1 ? ` They fly with ${escorts} wingmen — go in heavy or not at all.` : '';
      const capitalText = bigMark ? ' The mark rides a full capital hull; no board expects you to take it alone.' : '';
      offers.push({
        id, type: 'bounty', tier,
        title: targetKind === 'vigil' ? `Silence ${name} of the Vigil` : `Hunt ${name}`,
        desc: (targetKind === 'vigil'
          ? `${name} of the Vigil patrols ${SYSTEMS[dest.id].name}. The Clans want the lane quiet. Fly there and end it.`
          : `${name} has been cutting throats on the ${SYSTEMS[dest.id].name} lanes. Find the raider and put them down. The bounty clears on the kill.`) + escortText + capitalText,
        issuer: { stationId: station.id, systemId: state.systemId, faction: station.owner },
        dest: { systemId: dest.id },
        target: {
          name, shipId, kind: targetKind, escorts,
          hullMult: bigMark ? 1.15 : HULL_MULT[tier], shieldMult: bigMark ? 1.1 : SHIELD_MULT[tier],
          weapons: [...BOUNTY_ARMS[tier]], harpoonAmmo: BOUNTY_AMMO[tier],
        },
        reward,
        rep: { faction: station.owner, amount: targetKind === 'vigil' ? 5 : 4 },
        repPenalty: targetKind === 'vigil' ? { faction: 'vigil', amount: -6 } : null,
        deadlineDay: state.day + 5 + dest.hops * 2 - (tier >= 3 ? 1 : 0),
      });
    } else if (job === 'survey') {
      // ---- survey ----
      const reward = Math.round(rng.int(700, 1400) * mult);
      offers.push({
        id, type: 'survey', tier,
        title: `Signal survey at ${SYSTEMS[dest.id].name}`,
        desc: `The survey office pays for fresh readings. Fly to ${SYSTEMS[dest.id].name}, lock the beacon for a few seconds, then bring the tape home.`,
        issuer: { stationId: station.id, systemId: state.systemId, faction: station.owner },
        dest: { systemId: dest.id },
        reward,
        rep: { faction: station.owner, amount: repAmount },
        deadlineDay: state.day + 4 + dest.hops * 2,
      });
    } else if (job === 'sweep') {
      // ---- sweep: clear N raiders (or Vigil patrols, for Reaver patrons) ----
      const foe = station.owner === 'reaver' ? 'navy' : 'pirate';
      const hot = reachT.filter((d) => {
        const g = SYSTEMS[d.id].danger;
        return (foe === 'navy' ? g.navy : g.pirates) >= 0.35;
      });
      const sweepDest = weightedDest(rng, hot.length ? hot : (reachT.length ? reachT : reach), tier);
      // green-lane sweeps ask for fewer kills; veterans clear whole packs
      const kills = tier <= 2
        ? clamp(rng.int(tier, tier + 1), 2, 6)
        : clamp(rng.int(1 + tier, 2 + tier), 2, 6);
      const reward = Math.round((rng.int(600, 1100) + kills * 420) * TIER_MULT[tier] * riskBonus(sweepDest.id) * deepPay(sweepDest.id));
      const dname = SYSTEMS[sweepDest.id].name;
      offers.push({
        id, type: 'sweep', tier, foe,
        title: foe === 'navy' ? `Harass the Vigil — ${dname}` : `Raider sweep — ${dname}`,
        desc: foe === 'navy'
          ? `The office wants the Vigil off the ${dname} lanes. Break ${kills} patrols there and the Clans will hear of it. The pay clears on the last kill.`
          : `Raiders run the ${dname} lanes. Put down ${kills} of them and the lane breathes again. The pay clears on the last kill.`,
        issuer: { stationId: station.id, systemId: state.systemId, faction: station.owner },
        dest: { systemId: sweepDest.id },
        kills: { need: kills, got: 0 },
        reward,
        rep: { faction: station.owner, amount: repAmount },
        deadlineDay: state.day + 4 + sweepDest.hops * 2,
      });
    } else {
      // ---- recovery: black-box recorder pods in a wreck field ----
      const need = 2 + Math.floor(tier / 2);
      const reward = Math.round((rng.int(900, 1500) + need * 380) * mult);
      offers.push({
        id, type: 'recovery', tier,
        title: `Black-box recovery — ${SYSTEMS[dest.id].name}`,
        desc: `A courier went down in the ${SYSTEMS[dest.id].name} approaches. Recover ${need} recorder pods from the wreck field and bring them back here to the office. The pods answer a standard hail.`,
        issuer: { stationId: station.id, systemId: state.systemId, faction: station.owner },
        dest: { systemId: dest.id },
        pods: { need },
        reward,
        rep: { faction: station.owner, amount: 3 },
        deadlineDay: state.day + 5 + dest.hops * 2,
      });
    }

    // every desk finds its own words — and some jobs come with a warning
    const offer = offers[offers.length - 1];
    const brief = BRIEFS[job] ? rng.pick(BRIEFS[job]) : null;
    if (brief) offer.desc += ` ${brief}`;
    const twist = rollTwist(rng, job, tier);
    if (twist) {
      offer.twist = { kind: twist };
      offer.desc += ` ${TWIST_INFO[twist].brief}`;
      if (twist === 'gratuity') offer.reward = Math.round(offer.reward * 1.35);
      if (twist === 'graft') offer.reward = Math.round(offer.reward * 1.15);
    }
  }

  // ---- the collector's wire: a sealed vault and the relic inside it ----
  // Vaults are graded to the pilot: band I for the young, band III for the
  // famous. A relic you already own is never posted twice.
  const band = myTier <= 2 ? 1 : myTier <= 4 ? 2 : 3;
  const unlockedIds = new Set(ensureStory(state).unlocked);
  const locked = LEGENDARIES.filter((d) => d.band <= band && !unlockedIds.has(d.id));
  const sameBand = locked.filter((d) => d.band === band);
  const relicPool = sameBand.length ? sameBand : locked;
  if (relicPool.length && myTier >= 2 && rng.chance(0.34)) {
    const item = rng.pick(relicPool);
    const relicTier = clamp(band * 2 - 1 + rng.int(0, 1), 1, 8);
    const relicReach = reachableFrom(state.systemId, MAX_HOPS[relicTier]);
    const dest = weightedDest(rng, relicReach.length ? relicReach : reach, relicTier);
    const id = `${station.id}-d${state.day}-r-${rng.int(100, 999)}`;
    const reward = Math.round(rng.int(900, 1600) * TIER_MULT[relicTier] * deepPay(dest.id));
    const offer = {
      id, type: 'relic', tier: relicTier,
      relic: { itemId: item.id, itemName: item.name, band: item.band },
      title: `The sealed vault at ${SYSTEMS[dest.id].name}`,
      desc: `A collector’s wire, countersigned twice and paid in advance. ${SYSTEMS[dest.id].name} holds a pre-descent vault — the kind that answers one hail and opens for nobody. Hold station while the cipher reads the lock, and the fee settles twice over: cash on the desk, and the heirloom inside. The readings say it is the ${item.name}.`,
      issuer: { stationId: station.id, systemId: state.systemId, faction: station.owner },
      dest: { systemId: dest.id },
      reward,
      rep: { faction: station.owner, amount: 3 + item.band },
      deadlineDay: state.day + 6 + dest.hops * 2,
    };
    const brief = rng.pick(BRIEFS.relic);
    if (brief) offer.desc += ` ${brief}`;
    const twist = rollTwist(rng, 'relic', relicTier);
    if (twist) {
      offer.twist = { kind: twist };
      offer.desc += ` ${TWIST_INFO[twist].brief}`;
    }
    offers.push(offer);
  }
  return offers;
}

export function acceptMission(state, offer) {
  if (state.missions.some((m) => m.id === offer.id)) {
    return { ok: false, error: 'That contract is already on your manifest.' };
  }
  // story assignments fly outside the contract limit so the path never blocks
  const held = state.missions.filter((m) => !m.story).length;
  if (!offer.story && held >= MAX_ACTIVE) {
    return { ok: false, error: `You can only hold ${MAX_ACTIVE} active contracts.` };
  }
  const mission = {
    id: offer.id,
    type: offer.type,
    tier: offer.tier || 1,
    urgent: !!offer.urgent,
    foe: offer.foe || null,
    story: offer.story ? { ...offer.story } : null,
    side: offer.side ? { ...offer.side } : null,
    twist: offer.twist ? { ...offer.twist, fired: false } : null,
    relic: offer.relic ? { ...offer.relic } : null,
    title: offer.title,
    desc: offer.desc,
    issuer: { ...offer.issuer },
    dest: { ...offer.dest },
    reward: offer.reward,
    rep: { ...offer.rep },
    repPenalty: offer.repPenalty ? { ...offer.repPenalty } : null,
    deadlineDay: offer.deadlineDay,
    acceptedDay: state.day,
    scanned: false,
  };
  if (offer.cargo) {
    mission.cargoLoaded = { ...offer.cargo };
  }
  if (offer.target) {
    mission.target = { ...offer.target };
  }
  if (offer.kills) {
    mission.kills = { need: offer.kills.need, got: 0 };
  }
  if (offer.pods) {
    mission.pods = { need: offer.pods.need, taken: [] };
  }
  state.missions.push(mission);
  if (mission.story) onStoryAccepted(state, mission.story);
  return { ok: true, mission };
}

export function findMission(state, id) {
  return state.missions.find((m) => m.id === id) || null;
}

/** Karma earned for completing each contract type. */
export const CONTRACT_KARMA = { delivery: 2, courier: 1, survey: 3, bounty: 1, sweep: 2, recovery: 2, relic: 4 };

/** Deliveries ready for handover at this station, surveys to file, finished recoveries. */
export function completionsAt(state, systemId, stationId) {
  const ready = [];
  for (const m of state.missions) {
    if ((m.type === 'delivery' || m.type === 'courier') && m.dest.systemId === systemId) {
      ready.push({ mission: m, verb: 'Deliver' });
    }
    if (m.type === 'survey' && m.scanned && m.issuer.systemId === systemId && m.issuer.stationId === stationId) {
      ready.push({ mission: m, verb: 'File survey' });
    }
    if (
      m.type === 'recovery' && m.pods && m.pods.taken.length >= m.pods.need
      && m.issuer.systemId === systemId && m.issuer.stationId === stationId
    ) {
      ready.push({ mission: m, verb: 'Deliver pods' });
    }
  }
  return ready;
}

/**
 * A raider of the given role was destroyed in `systemId`. Sweeps contracted for
 * that system count the kill. Returns which missions advanced and which just
 * finished (they are NOT paid out here — the caller settles them).
 */
export function noteRaiderKill(state, systemId, role) {
  const updated = [];
  const completed = [];
  for (const m of state.missions) {
    if (m.type !== 'sweep' || !m.kills || m.dest.systemId !== systemId) continue;
    if ((m.foe || 'pirate') !== role || m.kills.got >= m.kills.need) continue;
    m.kills.got += 1;
    const complete = m.kills.got >= m.kills.need;
    updated.push({ mission: m, complete });
    if (complete) completed.push(m);
  }
  return { updated, completed };
}

/** A recorder pod was collected. Returns progress, or null if it was not ours. */
export function notePodTaken(state, missionId, index) {
  const m = state.missions.find((mm) => mm.id === missionId);
  if (!m || m.type !== 'recovery' || !m.pods) return null;
  if (m.pods.taken.includes(index)) return null;
  m.pods.taken.push(index);
  const got = m.pods.taken.length;
  return { mission: m, got, need: m.pods.need, complete: got >= m.pods.need };
}

export function finishMission(state, mission) {
  const idx = state.missions.findIndex((m) => m.id === mission.id);
  if (idx === -1) return null;
  state.missions.splice(idx, 1);
  state.missionsDone += 1;
  // a greased palm pays the desk, not the pilot
  if (mission.twist?.kind === 'graft' && mission.rep) {
    mission.rep.amount = Math.max(1, Math.floor(mission.rep.amount / 2));
  }
  mission.rewardAwarded = Math.round(mission.reward * economyMods(state).contract);
  state.addCredits(mission.rewardAwarded);
  addKarma(state, CONTRACT_KARMA[mission.type] || 1);
  if (mission.rep) state.addRep(mission.rep.faction, mission.rep.amount);
  if (mission.repPenalty) state.addRep(mission.repPenalty.faction, mission.repPenalty.amount);
  if (mission.story) mission.storyResult = advanceStory(state, mission.story);
  if (mission.side) mission.sideResult = advanceSide(state, mission.side);
  // the desk always gets the last word
  const pool = OUTROS[mission.type];
  mission.outro = pool ? rngOf(state.worldSeed, 'outro', mission.id).pick(pool) : null;
  return mission;
}

export function failMission(state, mission, reason = 'overdue') {
  const idx = state.missions.findIndex((m) => m.id === mission.id);
  if (idx === -1) return null;
  state.missions.splice(idx, 1);
  state.missionsFailed += 1;
  if (mission.rep) state.addRep(mission.rep.faction, -2);
  return { mission, reason };
}

export function failOverdue(state) {
  const failed = [];
  const now = state.day;
  for (const m of [...state.missions]) {
    if (now > m.deadlineDay) {
      const res = failMission(state, m, 'overdue');
      if (res) failed.push(res);
    }
  }
  return failed;
}
