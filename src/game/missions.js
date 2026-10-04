// Mission board: deliveries, bounties, sweeps, surveys and black-box recoveries.
// Offers are deterministic per world-seed + station + day; accepted missions live
// in the save file. Contracts come in five risk tiers — the board offers harder,
// richer work as the commander's renown grows.

import { SYSTEMS } from '../data/systems.js';
import { FACTIONS, isFaction } from '../data/factions.js';
import { COMMODITY_BY_ID } from '../data/commodities.js';
import { PIRATE_FIRST, PIRATE_EPITHET } from '../data/names.js';
import { SHIP_BY_ID } from '../data/ships.js';
import { WEAPONS } from '../data/weapons.js';
import { OUTFITS } from '../data/outfits.js';
import { BRIEFS, TWIST_INFO, OUTROS } from '../data/voices.js';
import { rngOf } from '../core/rng.js';
import { addKarma, economyMods, levelFromXp } from './skills.js';
import { clamp } from '../core/util.js';
import { advanceSide } from './sidequests.js';
import { STORY_LINES, buildStoryOffer, applyStoryRewards, ensureStory } from './story.js';

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
    case 'vector':
      return m.done
        ? { phase: 'return', verb: 'CLAIM', systemId: m.issuer.systemId, stationId: m.issuer.stationId, here: here(m.issuer.systemId), note: 'collect the purse at the issuing desk' }
        : { phase: 'compete', verb: 'COMPETE', systemId: dest, stationId: null, here: here(dest), note: 'win one Vector Challenge match at the meetup' };
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
  delivery: 'DELIVERY', courier: 'COURIER', bounty: 'BOUNTY', survey: 'SURVEY', sweep: 'SWEEP', recovery: 'RECOVERY', relic: 'RELIC HUNT', vector: 'VECTOR',
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
  vector: '#7dffa8',
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
  if (m.type === 'vector') return m.done ? 'match won — claim the purse at the issuing desk' : 'win one match at the meetup';
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
const PIRATE_BOUNTY_SHIPS = [null, 'wayfarer', 'marlin', 'voskar', ['dragoon', 'cuirassier', 'rapier'], 'tempest', ['tempest', 'legion', 'harrow'], ['redoubt', 'marshal', 'thunderhead'], ['monarch', 'sceptre', 'matriarch']];
const VIGIL_BOUNTY_SHIPS = [null, 'sparrowhawk', 'watchman', ['halcyon', 'watchman'], ['paladin', 'marshal'], 'monarch', ['monarch', 'leviathan', 'sunspire'], ['redoubt', 'colossus', 'cathedral'], ['colossus', 'sceptre', 'worldheart']];
/** Target gun fit by tier — rookies face a single barrel; eight-star marks carry dreadnought batteries. */
const BOUNTY_ARMS = [null, ['pulse', null], ['pulse', null], ['pulse', 'harpoon'], ['twinpulse', 'harpoon'], ['flenser', 'flenser', 'harpoon'], ['flenser', 'flenser', 'harpoon'], ['flenser', 'twinpulse', 'harpoon'], ['flenser', 'flenser', 'twinpulse', 'harpoon']];
const BOUNTY_AMMO = [0, 0, 0, 3, 5, 8, 8, 9, 10];
/** Marks above this hull size are already monsters — buffs are damped so a capital stays a fight, not a wall. */
const BIG_MARK_HULL = 1100;
/** Capital marks pay a hull tithe on top of the contract fee. */
const HULL_TITHE = 0.07;

/** The grain price — the yardstick premium cargo is measured against. */
const DELIVERY_STANDARD_BASE = 61;

/**
 * How much of a commodity a delivery asks you to haul. Premium cargo rides as
 * a small, valuable consignment rather than a hold full of it, so the manifest
 * value — and therefore the fee — stays in the same band whatever the goods.
 * One case of the good vintage is a fortune; ten are a fleet.
 */
function deliveryQty(rng, c, tier) {
  const qty = rng.int(4, 8 + tier * 2);
  const norm = Math.max(1, Math.round((qty * DELIVERY_STANDARD_BASE) / Math.max(1, c.base)));
  return Math.min(qty, norm);
}

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

// The lane graph never changes at runtime, so hop scans are memoized forever.
const REACH_CACHE = new Map();
function reachableFrom(sysId, maxHops = 2) {
  const key = `${sysId}:${maxHops}`;
  let out = REACH_CACHE.get(key);
  if (!out) {
    out = [];
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
    REACH_CACHE.set(key, out);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Faction mission lines & open contracts                              */
/* ------------------------------------------------------------------ */

/** Job types every desk will hand to any captain, whatever colours they fly. */
const NEUTRAL_TYPES = ['delivery', 'courier', 'survey'];

/**
 * A flag's written line: the postings its own desks hand to its own pilots,
 * in order, from a rookie's errand up to a genuine war at the top. Each one is
 * authored — the flag's voice, the flag's work, the flag's enemies — and the
 * chain runs through all of them before the desk falls back on standing work.
 *
 * The line is your branch of the board: it is shown only at your flag's own
 * desks, and only to captains flying its colours, so nobody else's work ever
 * leaks onto it and the open contracts beside it never touch it.
 *
 * Stage order is tier order: [2, 3, 4, 5, 5, 6, 7, 8].
 */
export const FACTION_LINES = {
  free: [
    { key: 'lane', type: 'sweep', foe: 'pirate', tier: 2, rep: 5, days: 4, title: 'Keep the {dest} lane open', desc: 'Raiders have been picking at the {dest} approaches and the harbour board is tired of paying for new hulls. Put {kills} of them down and the ports will remember your name.' },
    { key: 'bond', type: 'courier', tier: 3, rep: 4, days: 3, title: 'Bond to {dest}', desc: 'A sealed case, countersigned at both ends, and a desk at {dest} that opens for nobody but the bearer. No questions are asked on this run, and none are answered.' },
    { key: 'depot', type: 'delivery', tier: 4, rep: 5, days: 4, title: 'Standing order — {dest}', desc: 'The ports keep each other fed because somebody carries the difference. {qty} × {commodity} is on the depot floor and {dest} is short.' },
    { key: 'barge', type: 'recovery', tier: 5, rep: 5, days: 5, title: 'The barge at {dest}', desc: 'A harbour barge went under on the {dest} run with the season\'s tallies still in her belly. Bring back {need} recorder pods and the board will settle the salvage line by line.' },
    { key: 'charter', type: 'courier', tier: 5, rep: 5, days: 3, title: 'Charter run — {dest}', desc: 'A harbour charter with three seals on it and no patience at all. Carry it into {dest} inside the window and the ports will know your name is good for the short runs.' },
    { key: 'gate', type: 'bounty', foe: 'pirate', tier: 6, rep: 7, days: 5, title: 'Clear the gate — {name}', desc: '{name} has been taxing the approaches to {dest} and the ports have had enough. Run the mark down and the harbour board will open every door it has.' },
    { key: 'deep', type: 'survey', tier: 7, rep: 9, days: 6, title: 'Chart the deep lane — {dest}', desc: 'The Free Ports mean to map a lane the great flags will not touch. Fly to {dest}, lock the beacon for a full sweep, and bring the tape home. The charts are the prize.' },
    { key: 'muster', type: 'sweep', foe: 'pirate', tier: 8, rep: 11, days: 6, title: 'Break the {dest} muster', desc: 'The raiders are mustering in the open at {dest} for the first time in years, and every harbour board on the lane has read the same report. Put {kills} of them down and the inner lanes stop paying protection.' },
  ],
  combine: [
    { key: 'manifest', type: 'delivery', tier: 2, rep: 4, days: 3, title: 'Manifest to {dest}', desc: 'A Combine freight order, filed in triplicate and priced to the minute. {qty} × {commodity}, landed on schedule — the auditors read the arrival stamp, not the story.' },
    { key: 'tariff', type: 'sweep', foe: 'pirate', tier: 3, rep: 5, days: 4, title: 'Tariff enforcement — {dest}', desc: 'Every hull taken off the {dest} lane is a tariff the Combine never collects. Clear {kills} raiders out of it and the subsidy clears the same day.' },
    { key: 'ledger', type: 'recovery', tier: 4, rep: 5, days: 5, title: 'Recover the ledger — {dest}', desc: 'A bonded courier went down on the {dest} approach with the season\'s ledgers aboard. Bring back {need} recorder pods and the consortium will owe you a favour it can actually pay.' },
    { key: 'dispatch', type: 'courier', tier: 5, rep: 5, days: 3, title: 'Dispatch rider — {dest}', desc: 'A bonded dispatch with a Combine seal goes into {dest} by hand, not by wire. The consortium trusts couriers more than it trusts relay operators, and pays accordingly.' },
    { key: 'toll', type: 'sweep', foe: 'pirate', tier: 5, rep: 6, days: 4, title: 'Toll gate at {dest}', desc: 'Every raider working the {dest} toll is a toll the Combine never books. Remove {kills} of them and the quarter closes square for once.' },
    { key: 'audit', type: 'bounty', foe: 'pirate', tier: 6, rep: 7, days: 5, title: 'Audit — {name}', desc: '{name} has been skimming the {dest} lanes without a charter, and the Combine does not share. Execute the writ and the margin is yours.' },
    { key: 'monopoly', type: 'delivery', tier: 7, rep: 9, days: 6, title: 'Corner the {dest} market', desc: 'The Combine is ready to own the {dest} exchange, and the last crate in the way is in your hold. Land {qty} × {commodity} and the desk will owe you a percentage of a percentage.' },
    { key: 'embargo', type: 'sweep', foe: 'pirate', tier: 8, rep: 11, days: 6, title: 'Enforce the {dest} embargo', desc: 'The Board has closed the {dest} trade and the word is being cheerfully ignored. Clear {kills} hulls running the embargo and the Board will make sure the right people hear who held the line.' },
  ],
  vigil: [
    { key: 'warrant', type: 'bounty', foe: 'pirate', tier: 2, rep: 5, days: 5, title: 'Warrant: {name}', desc: '{name} is named on enough counts to fill a drawer and has been seen on the {dest} lanes. The Watch wants the warrant executed, not negotiated. Fly there and end it.' },
    { key: 'patrol', type: 'sweep', foe: 'pirate', tier: 3, rep: 5, days: 4, title: 'Patrol sweep — {dest}', desc: 'The Watch is a hull short on the {dest} station and the raiders have noticed. Break {kills} of them and the log will show the lane held.' },
    { key: 'inquiry', type: 'recovery', tier: 4, rep: 5, days: 5, title: 'Board of inquiry — {dest}', desc: 'A hull is missing on the {dest} approach and the board wants the recorder before the insurance men do. Recover {need} pods and bring them home.' },
    { key: 'escort', type: 'delivery', tier: 5, rep: 5, days: 4, title: 'Convoy escort — {dest}', desc: 'A relief convoy needs a hull carrying guns it does not have to explain. Land {qty} × {commodity} at {dest} under the escort writ and the Watch will log who rode with it.' },
    { key: 'census', type: 'survey', tier: 5, rep: 6, days: 5, title: 'Census run — {dest}', desc: 'The Watch counts hulls, lanes and mouths, and does not trust second-hand numbers. Fly to {dest}, lock the beacon for a full sweep, and bring the tape home for the ledger.' },
    { key: 'crusade', type: 'sweep', foe: 'pirate', tier: 6, rep: 7, days: 5, title: 'The {dest} crusade', desc: 'The Watch is clearing the {dest} lane hull by hull, and this is your cut of the line. Break {kills} raiders and the Vigil will call you its own.' },
    { key: 'dread', type: 'bounty', foe: 'pirate', tier: 7, rep: 9, days: 6, title: 'The warrant on {name}', desc: '{name} has a capital hull, a long memory, and a warrant older than most captains. The Watch wants the name struck off. Fly to {dest} and do it.' },
    { key: 'assize', type: 'sweep', foe: 'pirate', tier: 8, rep: 11, days: 6, title: 'The {dest} assize', desc: 'The Watch is holding an assize at {dest} and the raiders mean to make a point of it. Break {kills} of them and the point becomes the Watch\'s, entered in the log with your name on it.' },
  ],
  reaver: [
    { key: 'silence', type: 'bounty', foe: 'vigil', tier: 2, rep: 5, days: 5, title: 'Silence {name} of the Vigil', desc: '{name} has been working the {dest} lanes with a warrant book and a very smug look. The Clans want the lane quiet and the example loud.' },
    { key: 'break', type: 'sweep', foe: 'navy', tier: 3, rep: 6, days: 4, title: 'Break the {dest} patrol', desc: 'The Vigil keeps a picket on the {dest} lane because it thinks that makes the lane theirs. Break {kills} patrols and the Clans will hear of it before the Watch does.' },
    { key: 'fence', type: 'delivery', tier: 4, rep: 5, days: 4, title: 'Move the haul — {dest}', desc: 'Last week\'s takings need a hull nobody logs. {qty} × {commodity} rides with you, and {dest} pays in coin with no names on it.' },
    { key: 'snatch', type: 'courier', tier: 5, rep: 5, days: 3, title: 'Snatch and run — {dest}', desc: 'A strongbox came off a convoy and the Clans want it a long way from where it was taken. Get it into {dest} before anyone with a ledger thinks to start looking.' },
    { key: 'prizes', type: 'recovery', tier: 5, rep: 6, days: 5, title: 'Prize salvage at {dest}', desc: 'Two prizes went down hard on the {dest} crossing with the good part still aboard. Bring back {need} recorder pods and the Elders will cut you in on the rest.' },
    { key: 'takings', type: 'recovery', tier: 6, rep: 7, days: 5, title: 'The wreck at {dest}', desc: 'A prize hull went down on the {dest} crossing with the Clans\' cut still aboard. Bring back {need} recorder pods and the Elders will drink to your name.' },
    { key: 'warlord', type: 'bounty', foe: 'vigil', tier: 7, rep: 9, days: 6, title: 'The price on {name}', desc: 'The Clans have put a proper price on {name} of the Vigil, and the honour of collecting it is yours. Fly to {dest} and bring the Watch word of it.' },
    { key: 'reckoning', type: 'sweep', foe: 'navy', tier: 8, rep: 11, days: 6, title: 'The {dest} reckoning', desc: 'The Watch has leaned on the Clans\' lanes for a season and the Clans have settled on when that stops. Break {kills} patrols at {dest} and the lesson will carry further than the lane.' },
  ],
  kreth: [
    { key: 'debt', type: 'bounty', foe: 'pirate', tier: 2, rep: 5, days: 5, title: 'A name to collect — {name}', desc: '{name} raised a hand to a House factor on the {dest} run, and the Houses are patient accountants. The debt is payable in full, in person.' },
    { key: 'honour', type: 'delivery', tier: 3, rep: 4, days: 4, title: 'Honour freight — {dest}', desc: 'A consignment with a seal on it and a name cut into the seal. {qty} × {commodity} goes to {dest}, and the Houses will remember who carried it.' },
    { key: 'heirloom', type: 'recovery', tier: 4, rep: 5, days: 5, title: 'Recover the House cargo — {dest}', desc: 'A House launch was lost on the {dest} crossing with something aboard that is older than the ship. Bring back {need} recorder pods and the name on that seal is yours to call.' },
    { key: 'errand', type: 'courier', tier: 5, rep: 5, days: 3, title: 'A quiet errand — {dest}', desc: 'A name-seal, a closed case, and a House that writes nothing down. Carry it into {dest} and the Houses will count it as an errand done properly, which is the only way they count anything.' },
    { key: 'chronicle', type: 'survey', tier: 5, rep: 6, days: 5, title: 'The chronicle at {dest}', desc: 'The Houses keep an ancestor\'s beacon at {dest} that has gone quiet, and quiet is not a word they accept. Fly there, lock the beacon, and bring the tape home. The record is the debt.' },
    { key: 'duel', type: 'bounty', foe: 'pirate', tier: 6, rep: 7, days: 5, title: 'A duel, by proxy — {name}', desc: 'A House champion wants {name} removed without the Houses\' fingerprints on it. You are the blade. Fly to {dest} and finish the duel.' },
    { key: 'ancestor', type: 'recovery', tier: 7, rep: 9, days: 6, title: 'The ancestor\'s due — {dest}', desc: 'Something that belonged to an ancestor lies in the wreck field at {dest}, and the Houses pay in names, not coin. Recover {need} recorder pods and the debt is theirs to you.' },
    { key: 'vendetta', type: 'sweep', foe: 'pirate', tier: 8, rep: 11, days: 6, title: 'The {dest} vendetta', desc: 'A hundred-year account has come due at {dest} and the Houses settle those in the open. Put {kills} of them down and a page of the ledger of names closes.' },
  ],
};

function fillText(s, vars) {
  return s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
}

/** Legal commodities, for salvage bonuses on open contracts. */
const LEGAL_COMMODITIES = Object.values(COMMODITY_BY_ID).filter((c) => !c.illegal);

/** Static index: faction id -> its written storyline, built once. */
const STORY_LINE_BY_FACTION = new Map(
  Object.values(STORY_LINES).map((l) => [l.faction, l]),
);

/** Story chapters run first in a flag's chain, then its templated work. */
function storyStages(faction) {
  const line = STORY_LINE_BY_FACTION.get(faction);
  if (!line) return [];
  return line.chapters.map((ch) => ({ kind: 'story', line: line.id, chapter: ch.n }));
}

function factionStages(faction) {
  return (FACTION_LINES[faction] || []).map((s) => ({ kind: 'faction', ...s }));
}

/** The flag's one quest chain: written story, written work, then procedural. */
const CHAIN_CACHE = new Map();
export function factionChain(faction) {
  let chain = CHAIN_CACHE.get(faction);
  if (!chain) {
    chain = [...storyStages(faction), ...factionStages(faction)];
    CHAIN_CACHE.set(faction, chain);
  }
  return chain;
}

/** Work each flag keeps generating once its written line is run out. */
export const PROCEDURAL_POOLS = {
  free: ['sweep', 'delivery', 'courier', 'survey', 'recovery'],
  combine: ['delivery', 'sweep', 'recovery', 'courier'],
  vigil: ['bounty', 'sweep', 'recovery', 'delivery', 'survey'],
  reaver: ['bounty', 'sweep', 'delivery', 'recovery', 'courier'],
  kreth: ['bounty', 'delivery', 'recovery', 'courier', 'survey'],
};

/**
 * How many postings a desk puts up once its written line is run out. The line
 * itself is one stage at a time — it is a path, and a path has one next step —
 * but a desk whose path is finished still has a board, so it shows a few.
 */
const REPEAT_POSTINGS = 3;

/**
 * Beyond the written chain the desk keeps generating the same honest work in
 * the flag's own voice, priced higher each time it is asked. `stage` is the
 * 0-based chain position, already past the end of the chain.
 */
function proceduralFactionStage(flag, stage, rng) {
  const line = FACTION_LINES[flag];
  const chainLen = factionChain(flag).length;
  const type = rng.pick(PROCEDURAL_POOLS[flag] || ['delivery', 'bounty']);
  // borrow the flag's own phrasing from a written stage of the same type
  const template = line.find((s) => s.type === type) || line[line.length - 1];
  const foe = template.foe
    || (flag === 'reaver' ? (type === 'bounty' ? 'vigil' : type === 'sweep' ? 'navy' : 'pirate') : 'pirate');
  return {
    key: `repeat-${stage}`,
    type,
    foe,
    tier: clamp(7 + (stage - chainLen), 7, 8),
    rep: 8 + Math.floor(stage / 3),
    days: 5 + Math.floor(stage / 4),
    title: template.title,
    desc: template.desc,
  };
}

/**
 * Build a templated faction-stage (or repeatable procedural) posting.
 */
function buildFactionStageOffer(state, station, rng, flag, spec, stageIdx, repeat) {
  const chainLen = factionChain(flag).length;
  const tier = clamp(spec.tier ?? 3, 2, 8);
  const reach = reachableFrom(state.systemId, MAX_HOPS[tier]);
  const cands = reach.length ? reach : reachableFrom(state.systemId, 2);
  if (!cands.length) return null;
  // A sweep has to be flown where the enemy actually is: sending a pilot to
  // break Vigil patrols in a system the Watch does not fly is a wasted trip. If
  // the tier's own reach holds none of them, look further before settling for
  // anywhere at all.
  const foe = spec.type === 'sweep' ? (spec.foe || 'pirate') : null;
  const isHot = (id) => {
    const g = SYSTEMS[id].danger;
    return (foe === 'navy' ? g.navy : g.pirates) >= 0.35;
  };
  let hot = foe ? cands.filter((c) => isHot(c.id)) : [];
  if (foe && !hot.length) {
    const wider = reachableFrom(state.systemId, MAX_HOPS[tier] + 2);
    hot = wider.filter((c) => isHot(c.id));
    if (!hot.length) hot = reachableFrom(state.systemId, 2).filter((c) => isHot(c.id));
  }
  const dest = weightedDest(rng, hot.length ? hot : cands, tier);
  const dname = SYSTEMS[dest.id].name;
  // repeatable postings climb a little in pay each time they are asked
  const climb = repeat ? 1 + (stageIdx - chainLen + 1) * 0.16 : 1;
  const mul = TIER_MULT[tier] * riskBonus(dest.id) * deepPay(dest.id) * 1.15 * climb;
  const issuer = { stationId: station.id, systemId: state.systemId, faction: flag };
  const offer = {
    id: `${station.id}-d${state.day}-line-${spec.key}-${rng.int(100, 999)}`,
    type: spec.type,
    tier,
    line: { faction: flag, stage: stageIdx, repeat },
    issuer,
    dest: { systemId: dest.id },
    rep: { faction: flag, amount: spec.rep },
    deadlineDay: state.day + spec.days + dest.hops * 2,
  };

  if (spec.type === 'sweep') {
    const kills = tier <= 2 ? clamp(rng.int(tier, tier + 1), 2, 6) : clamp(rng.int(1 + tier, 2 + tier), 2, 6);
    offer.foe = foe || 'pirate';
    offer.kills = { need: kills, got: 0 };
    offer.reward = Math.round((rng.int(600, 1100) + kills * 420) * mul);
    offer.title = fillText(spec.title, { dest: dname, kills });
    offer.desc = fillText(spec.desc, { dest: dname, kills });
  } else if (spec.type === 'bounty') {
    const kind = spec.foe === 'vigil' ? 'vigil' : 'pirate';
    const entry = (kind === 'vigil' ? VIGIL_BOUNTY_SHIPS : PIRATE_BOUNTY_SHIPS)[tier];
    const shipId = Array.isArray(entry) ? rng.pick(entry) : (entry || 'corsair');
    const markDef = SHIP_BY_ID[shipId];
    const bigMark = (markDef?.hull || 0) >= BIG_MARK_HULL;
    const tithe = Math.round((markDef?.price || 0) * HULL_TITHE);
    const escorts = Math.min(5, tier >= 4 ? tier - 2 : 0);
    const name = `${rng.pick(PIRATE_FIRST)} ${rng.pick(PIRATE_EPITHET)}`;
    offer.target = {
      name, shipId, kind, escorts,
      hullMult: bigMark ? 1.15 : HULL_MULT[tier],
      shieldMult: bigMark ? 1.1 : SHIELD_MULT[tier],
      weapons: [...BOUNTY_ARMS[tier]],
      harpoonAmmo: BOUNTY_AMMO[tier],
    };
    offer.reward = Math.round(rng.int(1600, 3000) * mul * (1 + escorts * 0.18)) + tithe;
    if (kind === 'vigil') offer.repPenalty = { faction: 'vigil', amount: -6 };
    offer.title = fillText(spec.title, { dest: dname, name });
    offer.desc = fillText(spec.desc, { dest: dname, name });
  } else if (spec.type === 'recovery') {
    const need = 2 + Math.floor(tier / 2);
    offer.pods = { need };
    offer.reward = Math.round((rng.int(900, 1500) + need * 380) * mul);
    offer.title = fillText(spec.title, { dest: dname, need });
    offer.desc = fillText(spec.desc, { dest: dname, need });
  } else if (spec.type === 'courier') {
    const [commodityId, noun] = rng.pick([['electronics', 'dispatch core'], ['medicine', 'sealed case']]);
    const qty = rng.int(1, 2);
    const shortReach = reachableFrom(state.systemId, 1);
    const cDest = rng.pick(shortReach.length ? shortReach : cands);
    offer.dest = { systemId: cDest.id };
    offer.cargo = { id: commodityId, qty };
    offer.reward = Math.round((rng.int(380, 700) + qty * 60) * TIER_MULT[tier] * riskBonus(cDest.id) * 1.15 * climb);
    offer.title = fillText(spec.title, { dest: SYSTEMS[cDest.id].name, noun });
    offer.desc = `${fillText(spec.desc, { dest: SYSTEMS[cDest.id].name, noun })} ${noun[0].toUpperCase()}${noun.slice(1)} in the hold.`;
    offer.deadlineDay = state.day + 2 + cDest.hops;
  } else if (spec.type === 'survey') {
    // a survey is flown rather than carried: the beacon lock is the work, so
    // there is no cargo to fill the hold with, and the tape is the proof
    offer.reward = Math.round(rng.int(700, 1400) * mul);
    offer.title = fillText(spec.title, { dest: dname });
    offer.desc = fillText(spec.desc, { dest: dname });
  } else {
    const legalPool = (SYSTEMS[state.systemId].economy.produces.length
      ? SYSTEMS[state.systemId].economy.produces
      : ['grain', 'ore', 'ice']).filter((c) => !COMMODITY_BY_ID[c]?.illegal);
    const commodityId = rng.pick(legalPool.length ? legalPool : ['grain']);
    const c = COMMODITY_BY_ID[commodityId];
    const qty = deliveryQty(rng, c, tier);
    offer.cargo = { id: commodityId, qty };
    offer.reward = Math.round((qty * c.base * 1.45 + rng.float(300, 950)) * mul);
    offer.title = fillText(spec.title, { dest: dname, qty, commodity: c.name });
    offer.desc = fillText(spec.desc, { dest: dname, qty, commodity: c.name });
  }
  return offer;
}

/**
 * The postings from your flag's chain, if this is your flag's desk. Empty
 * anywhere else — rival flags, free ports and no-flag berths carry no chain
 * work for you, so nothing from another branch ever reaches your board.
 *
 * The chain hands over one stage at a time, because a path has one next step:
 * finish a stage and the next unlocks. Once the written line is run out, the
 * desk keeps the same honest work coming and puts a short shelf of it up at
 * once, priced higher each time it is asked.
 */
export function factionQuestOffers(state, station, rng) {
  const flag = state.allegiance;
  if (!isFaction(flag) || station.owner !== flag) return [];
  const chain = factionChain(flag);
  if (!chain.length) return [];
  const ls = state.factionLine && state.factionLine.faction === flag
    ? state.factionLine
    : { faction: flag, stage: 0 };
  const stageIdx = ls.stage;
  if (stageIdx < chain.length) {
    const spec = chain[stageIdx];
    if (spec.kind === 'story') {
      const line = STORY_LINES[spec.line];
      const ch = line.chapters[spec.chapter - 1];
      const offer = buildStoryOffer(line, ch, state, station);
      offer.line = { faction: flag, stage: stageIdx, repeat: false };
      return [offer];
    }
    const offer = buildFactionStageOffer(state, station, rng, flag, spec, stageIdx, false);
    return offer ? [offer] : [];
  }
  // the written line is run out: standing work, several at a time, and never
  // two postings that are the same job in the same place
  const out = [];
  const seen = new Set();
  for (let i = 0; i < 14 && out.length < REPEAT_POSTINGS; i++) {
    const spec = proceduralFactionStage(flag, ls.stage + i, rng);
    const offer = buildFactionStageOffer(state, station, rng, flag, spec, ls.stage + i, true);
    if (!offer) continue;
    const key = `${offer.type}:${offer.dest.systemId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(offer);
  }
  return out;
}

/** The one posting your flag's desk is leading with, for callers that show one. */
/* ------------------------------------------------------------------ */
/* Where a flag's desks are                                            */
/* ------------------------------------------------------------------ */

// Lanes never move, so distances from a system are memoized forever.
const DESK_CACHE = new Map();

/**
 * Every desk a flag keeps, nearest first, with how many lanes away each one is.
 * A sworn pilot is shown this wherever they dock: the line only posts at these
 * stations, so knowing where they are is the difference between flying a path
 * and wondering where the path went.
 */
export function factionDesks(faction, fromSystemId) {
  const key = `${faction}:${fromSystemId}`;
  let out = DESK_CACHE.get(key);
  if (out) return out;
  // walk outward once: the first time a system is reached is the shortest way
  const hops = new Map([[fromSystemId, 0]]);
  let frontier = [fromSystemId];
  while (frontier.length) {
    const next = [];
    for (const id of frontier) {
      for (const l of SYSTEMS[id].links) {
        if (hops.has(l)) continue;
        hops.set(l, hops.get(id) + 1);
        next.push(l);
      }
    }
    frontier = next;
  }
  const desks = [];
  for (const [id, d] of hops) {
    const mine = (SYSTEMS[id].stations || []).filter((st) => st.owner === faction);
    if (!mine.length) continue;
    desks.push({
      systemId: id,
      systemName: SYSTEMS[id].name,
      hops: d,
      count: mine.length,
      stationId: mine[0].id,
      stationName: mine[0].name,
      stationType: mine[0].type,
    });
  }
  desks.sort((a, b) => a.hops - b.hops || a.systemName.localeCompare(b.systemName));
  out = {
    faction,
    fromSystemId,
    desks,
    here: desks.find((d) => d.hops === 0) || null,
    nearest: desks[0] || null,
  };
  DESK_CACHE.set(key, out);
  return out;
}

/**
 * Where a flag's line posts, as words: its nearest desks and how many lanes away
 * each one is. The chain is only handed over at a flag's own stations, so a
 * pilot needs the distance, not just the name — and this is the one place that
 * phrasing lives, so the board, the log and the allegiance panel all agree.
 */
export function deskHint(faction, fromSystemId, max = 3) {
  const find = factionDesks(faction, fromSystemId);
  if (!find.desks.length) return 'no desk charted';
  const near = find.desks.slice(0, max).map((d) => {
    const where = d.hops === 0 ? 'here' : `${d.hops} lane${d.hops === 1 ? '' : 's'}`;
    return `${d.systemName} (${where})`;
  });
  const more = find.desks.length - near.length;
  return `${near.join(', ')}${more > 0 ? `, and ${more} more` : ''}`;
}

/**
 * Random bonus reward for open contracts — a credit windfall, a clean name, a
 * crate of salvage, or (rarely) a skill point. Long contracts always carry
 * one; the rest do sometimes, more often as renown grows.
 */
function rollBonus(rng, tier, long) {
  if (!long && !rng.chance(0.3 + tier * 0.04)) return null;
  const t = clamp(tier + (long ? 1 : 0), 1, 9);
  const r = rng.float(0, 1);
  if (r < 0.48) return { kind: 'credits', amount: Math.round(rng.int(60, 150) * t * (long ? 1.8 : 1)) };
  if (r < 0.72) return { kind: 'karma', amount: rng.int(2, 4) };
  if (r < 0.9) {
    const c = rng.pick(LEGAL_COMMODITIES);
    return { kind: 'salvage', commodityId: c.id, qty: rng.int(1, 3) };
  }
  if (r < 0.97 && t >= 2) return { kind: 'skillPoint', amount: 1 };
  return { kind: 'credits', amount: Math.round(rng.int(120, 260) * t) };
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

  // a desk under another flag keeps things civil: no war work that pits you
  // against the colours you fly, and nothing from a branch that is not yours
  const civilOnly = isFaction(station.owner) && state.allegiance && station.owner !== state.allegiance;

  // more work on the board while green — rookies always have something honest to haul
  let count = myTier <= 2 ? rng.int(6, 8) : outer ? rng.int(6, 7) : rng.int(5, 6);
  if (civilOnly) count = Math.min(count, rng.int(3, 4));
  for (let i = 0; i < count; i++) {
    // risk tier: usually around the commander's renown, sometimes easier or aspirational —
    // out here, the board skews one notch nastier than the pilot
    const tier = clamp(myTier + rng.int(-2, 1) + (outer ? 1 : 0), 1, 8);
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
    if (civilOnly && !NEUTRAL_TYPES.includes(job)) job = rng.pick(NEUTRAL_TYPES);

    // a long contract runs deeper, pays better, and always carries a bonus
    const longable = NEUTRAL_TYPES.includes(job) || job === 'recovery';
    const long = longable && rng.chance(0.2 + tier * 0.04);

    const reachT = reachableFrom(state.systemId, MAX_HOPS[tier] + (long ? 2 : 0));
    // late-game money runs deep: higher tiers aim at the far systems
    const dest = weightedDest(rng, reachT.length ? reachT : reach, tier);
    const mult = TIER_MULT[tier] * riskBonus(dest.id) * deepPay(dest.id);

    let offer;
    if (job === 'delivery') {
      // ---- delivery ----
      const legalPool = (sys.economy.produces.length ? sys.economy.produces : ['grain', 'ore', 'ice'])
        .filter((c) => !COMMODITY_BY_ID[c]?.illegal);
      const commodityId = rng.pick(legalPool.length ? legalPool : ['grain']);
      const c = COMMODITY_BY_ID[commodityId];
      const qty = deliveryQty(rng, c, tier);
      const urgent = rng.chance(0.12 + tier * 0.06);
      const reward = Math.round((qty * c.base * 1.45 + rng.float(250, 900)) * mult * (urgent ? 1.6 : 1));
      offer = {
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
      };
    } else if (job === 'courier') {
      // ---- courier: a sealed case, a short hop, and the clerk pays on the barrelhead ----
      const pools = [['electronics', 'dispatch core'], ['medicine', 'sealed case']];
      const [commodityId, noun] = rng.pick(pools);
      const qty = rng.int(1, 2);
      const shortReach = reachableFrom(state.systemId, (tier <= 2 ? 1 : 2) + (long ? 2 : 0));
      const cDest = rng.pick(shortReach.length ? shortReach : reach);
      const reward = Math.round((rng.int(320, 620) + qty * 60) * TIER_MULT[tier] * riskBonus(cDest.id));
      offer = {
        id, type: 'courier', tier,
        title: `Courier run — ${SYSTEMS[cDest.id].name}`,
        desc: `A ${noun} logged and signed for. ${SYSTEMS[cDest.id].name} wants it by the next bell — hand it over at any berth there. Light, quick, and it pays cash over the desk.`,
        issuer: { stationId: station.id, systemId: state.systemId, faction: station.owner },
        dest: { systemId: cDest.id },
        cargo: { id: commodityId, qty },
        reward,
        rep: { faction: station.owner, amount: repAmount },
        deadlineDay: state.day + 2 + cDest.hops,
      };
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
      offer = {
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
      };
    } else if (job === 'survey') {
      // ---- survey ----
      const reward = Math.round(rng.int(700, 1400) * mult);
      offer = {
        id, type: 'survey', tier,
        title: `Signal survey at ${SYSTEMS[dest.id].name}`,
        desc: `The survey office pays for fresh readings. Fly to ${SYSTEMS[dest.id].name}, lock the beacon for a few seconds, then bring the tape home.`,
        issuer: { stationId: station.id, systemId: state.systemId, faction: station.owner },
        dest: { systemId: dest.id },
        reward,
        rep: { faction: station.owner, amount: repAmount },
        deadlineDay: state.day + 4 + dest.hops * 2,
      };
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
      offer = {
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
      };
    } else {
      // ---- recovery: black-box recorder pods in a wreck field ----
      const need = 2 + Math.floor(tier / 2);
      const reward = Math.round((rng.int(900, 1500) + need * 380) * mult);
      offer = {
        id, type: 'recovery', tier,
        title: `Black-box recovery — ${SYSTEMS[dest.id].name}`,
        desc: `A courier went down in the ${SYSTEMS[dest.id].name} approaches. Recover ${need} recorder pods from the wreck field and bring them back here to the office. The pods answer a standard hail.`,
        issuer: { stationId: station.id, systemId: state.systemId, faction: station.owner },
        dest: { systemId: dest.id },
        pods: { need },
        reward,
        rep: { faction: station.owner, amount: 3 },
        deadlineDay: state.day + 5 + dest.hops * 2,
      };
    }

    // long contracts: deeper, fatter, and guaranteed to carry a bonus
    if (long) {
      offer.long = true;
      offer.reward = Math.round(offer.reward * 1.7);
      offer.deadlineDay += 4;
    }
    const bonus = rollBonus(rng, tier, long);
    if (bonus) offer.bonus = bonus;

    // every desk finds its own words — and some jobs come with a warning
    const brief = BRIEFS[job] ? rng.pick(BRIEFS[job]) : null;
    if (brief) offer.desc += ` ${brief}`;
    const twist = rollTwist(rng, job, tier);
    if (twist) {
      offer.twist = { kind: twist };
      offer.desc += ` ${TWIST_INFO[twist].brief}`;
      if (twist === 'gratuity') offer.reward = Math.round(offer.reward * 1.35);
      if (twist === 'graft') offer.reward = Math.round(offer.reward * 1.15);
    }
    offers.push(offer);
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

  // ---- the circuit comes through: a Vector Challenge meetup ----
  // Bars host the holo-sim circuit, and a travelling meetup needs a local
  // pilot to make the field. Place first — one match, three pilots.
  if (station.services?.includes('bar') && rng.chance(0.26)) {
    const vTier = clamp(myTier + rng.int(-1, 1), 1, 6);
    const vReach = reachableFrom(state.systemId, MAX_HOPS[vTier]);
    const dest = weightedDest(rng, vReach.length ? vReach : reach, vTier);
    const dname = SYSTEMS[dest.id].name;
    const reward = Math.round(rng.int(900, 1600) * TIER_MULT[vTier] * deepPay(dest.id) * 1.15);
    offers.push({
      id: `${station.id}-d${state.day}-vec-${rng.int(100, 999)}`,
      type: 'vector',
      tier: vTier,
      title: `The Vector Challenge — ${dname} meetup`,
      desc: `The holo-sim circuit is holding a meetup at ${dname}, and the bracket needs a third pilot. Enter the Vector Challenge and place first — old-school wire and phosphor, three to a field, and the purse goes to the last one flying.`,
      issuer: { stationId: station.id, systemId: state.systemId, faction: station.owner },
      dest: { systemId: dest.id },
      reward,
      rep: { faction: station.owner, amount: 3 + vTier },
      deadlineDay: state.day + 6 + dest.hops * 2,
    });
  }

  // ---- your flag's line: the postings that are yours alone ----
  for (const offer of factionQuestOffers(state, station, rng)) offers.push(offer);
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
    line: offer.line ? { ...offer.line } : null,
    bonus: offer.bonus ? { ...offer.bonus } : null,
    defect: offer.defect ? { ...offer.defect } : null,
    long: !!offer.long,
    done: offer.type === 'vector' ? false : null,
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
  return { ok: true, mission };
}

export function findMission(state, id) {
  return state.missions.find((m) => m.id === id) || null;
}

/** Karma earned for completing each contract type. */
export const CONTRACT_KARMA = { delivery: 2, courier: 1, survey: 3, bounty: 1, sweep: 2, recovery: 2, relic: 4, vector: 2 };

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
    if (m.type === 'vector' && m.done && m.issuer.systemId === systemId && m.issuer.stationId === stationId) {
      ready.push({ mission: m, verb: 'Claim the purse' });
    }
  }
  return ready;
}

/**
 * A Vector Challenge match was won in `systemId`. Meetup contracts held for
 * that system settle their win condition. Returns the completed missions.
 */
export function noteVectorWin(state, systemId) {
  const completed = [];
  for (const m of state.missions) {
    if (m.type !== 'vector' || m.done || m.dest.systemId !== systemId) continue;
    m.done = true;
    completed.push(m);
  }
  return completed;
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
  if (mission.story) mission.storyResult = applyStoryRewards(state, mission.story);
  if (mission.side) mission.sideResult = advanceSide(state, mission.side);

  // open-contract bonus: a windfall, a clean name, salvage or a rare skill point
  const extras = [];
  if (mission.bonus) {
    const b = mission.bonus;
    if (b.kind === 'credits') {
      mission.rewardAwarded += b.amount;
      state.addCredits(b.amount);
      extras.push(`+₡${b.amount.toLocaleString()} bonus`);
    } else if (b.kind === 'karma') {
      addKarma(state, b.amount, 'contract bonus');
      extras.push(`+${b.amount} karma`);
    } else if (b.kind === 'skillPoint') {
      state.skillPoints = (state.skillPoints || 0) + b.amount;
      extras.push(`+${b.amount} skill point${b.amount > 1 ? 's' : ''}`);
    } else if (b.kind === 'salvage') {
      const c = COMMODITY_BY_ID[b.commodityId];
      if (state.addCargo(b.commodityId, b.qty).ok) {
        extras.push(`+${b.qty} × ${c?.name || 'salvage'} in the hold`);
      } else {
        state.addCredits(b.qty * (c?.base || 40));
        extras.push('hold full — salvage sold for credits');
      }
    }
  }

  // your flag's line advances one posting — the next stage waits at their desks.
  // Standing work repeats, so it never moves the line: a desk whose path is
  // finished should not keep reporting that the next posting has unlocked.
  if (mission.line && !mission.line.repeat
    && state.factionLine?.faction === mission.line.faction && state.factionLine.stage === mission.line.stage) {
    state.factionLine.stage += 1;
    const flag = FACTIONS[mission.line.faction];
    extras.push(`next ${flag?.short || 'flag'} posting unlocked`);
  }

  // a defection errand switches your colours on delivery — the old flag
  // writes it down, and the new flag's line starts from the top
  if (mission.defect && state.allegiance !== mission.defect.faction) {
    const old = state.allegiance;
    state.allegiance = mission.defect.faction;
    state.factionLine = { faction: mission.defect.faction, stage: 0 };
    if (old) state.addRep(old, -8);
    extras.push(`now flying ${FACTIONS[mission.defect.faction]?.name || mission.defect.faction} colours`);
  }
  mission.extraNote = extras.length ? extras.join(' · ') : null;

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
