// Experience, karma, faction allegiance and skill learning.
//
// Skills live in data/skills.js; this module knows how to earn, gate,
// learn and aggregate them. All aggregation functions are pure reads of
// state so they are safe to call from hot paths (computeStats, combat).

import { SKILL_BY_ID, TREE_BY_ID, TIER_RANK_REQ } from '../data/skills.js';
import { FACTIONS } from '../data/factions.js';
import { STORY_LINES } from './story.js';
import { SIDE_BY_ID } from './sidequests.js';
import { clamp } from '../core/util.js';

/** The highest commander level. Effectively open-ended — the curve just keeps climbing. */
export const MAX_LEVEL = 999;

/**
 * Cumulative XP needed to reach each level (index 0 = level 1). Levels 1–20
 * are the early game, tuned by hand; 21 onward is a procedural climb with no
 * ceiling in sight — the lanes keep paying, and the numbers keep growing.
 */
export const XP_TABLE = (() => {
  const t = [
    0, 100, 260, 500, 850, 1300, 1900, 2700, 3700, 5000,
    6600, 8600, 11000, 14000, 17500, 21500, 26000, 31000, 36500, 42500,
  ];
  for (let lvl = t.length; lvl < MAX_LEVEL; lvl++) {
    // each late level costs a little more than the last — a climb, not a wall
    t.push(t[t.length - 1] + Math.round(5500 + (lvl - 20) * 380));
  }
  return t;
})();

export function levelFromXp(xp) {
  let level = 1;
  for (let i = 0; i < XP_TABLE.length; i++) {
    if (xp >= XP_TABLE[i]) level = i + 1;
  }
  return level;
}

/** Progress in the current level: { level, into, span, next }. */
export function xpProgress(state) {
  const level = levelFromXp(state.xp || 0);
  const floor = XP_TABLE[Math.min(level - 1, XP_TABLE.length - 1)];
  const next = XP_TABLE[Math.min(level, XP_TABLE.length - 1)];
  const span = Math.max(1, next - floor);
  return { level, into: (state.xp || 0) - floor, span, next, maxed: level >= XP_TABLE.length };
}

/** Award XP. Returns { levels, points, level }. */
export function addXp(state, amount) {
  const gain = Math.max(0, Math.round(amount));
  if (!gain) return { levels: 0, points: 0, level: levelFromXp(state.xp || 0) };
  const before = levelFromXp(state.xp || 0);
  state.xp = (state.xp || 0) + gain;
  const after = levelFromXp(state.xp);
  const levels = after - before;
  if (levels > 0) state.skillPoints = (state.skillPoints || 0) + levels;
  return { levels, points: levels, level: after };
}

export function addKarma(state, delta, reason = '') {
  const before = state.karma || 0;
  state.karma = clamp(before + delta, -100, 100);
  const applied = state.karma - before;
  if (applied !== 0 && reason) {
    if (!Array.isArray(state.karmaLog)) state.karmaLog = [];
    state.karmaLog.unshift({ day: state.day, delta: applied, reason, karma: state.karma });
    if (state.karmaLog.length > 40) state.karmaLog.length = 40;
  }
}

/* ------------------------------------------------------------------ */
/* Deliberate karma: acts, not accidents                              */
/* ------------------------------------------------------------------ */

/**
 * A captain can work on their own name. Every act is a ledger entry with a
 * price: charity and medicine brighten it, arming raiders and drinking with
 * them darken it. An act is limited to a few a day and each repeat costs more,
 * so a reputation is leaned on rather than simply bought.
 */
export const KARMA_ACTS = [
  {
    id: 'relief', name: 'Fund a relief convoy', delta: 4, base: 8000,
    blurb: 'Grain, blankets and spare parts to whoever the last raid left short. The clerks file it; the lanes hear it.',
  },
  {
    id: 'triage', name: 'Fly medicine to a fever port', delta: 8, base: 0,
    cargo: { id: 'medicine', qty: 3 },
    blurb: 'Three crates of medicine off your own manifest, handed to a port that has none. Costly, and it shows.',
  },
  {
    id: 'wake', name: 'Stand a round at a Clan wake', delta: -4, base: 8000,
    blurb: 'Drink to the fallen of a raider crew and pay for the room. The Clans approve. The Vigil notes it.',
  },
  {
    id: 'guns', name: 'Sell surplus guns to the Clans', delta: -8, base: 15000,
    blurb: 'Warheads and plate, no questions, no manifest. It pays well, and it is written down somewhere.',
  },
  {
    id: 'restitution', name: 'Pay restitution', delta: 2, base: 24000, rep: 12,
    blurb: 'An indemnity to the flag that likes you least, for damage you may or may not have caused. Money, then manners.',
  },
];

export const KARMA_ACT_BY_ID = Object.fromEntries(KARMA_ACTS.map((a) => [a.id, a]));

function actCount(state, day, id) {
  return state.karmaActs?.[day]?.[id] || 0;
}

/** What the act costs today: repeats within the day get dearer. */
export function karmaActCost(state, act) {
  const n = actCount(state, state.day, act.id);
  return Math.round((act.base || 0) * (1 + n * 0.55));
}

/** The faction restitution would pay off: whoever likes you least. */
export function karmaActFaction(state, act) {
  if (!act.rep) return null;
  let worst = null;
  let worstRep = Infinity;
  for (const id of Object.keys(FACTIONS)) {
    const r = state.rep?.[id] ?? 0;
    if (r < worstRep) { worstRep = r; worst = id; }
  }
  return worst;
}

/** Why an act cannot be done right now — or null if it can. */
export function karmaActBlock(state, actId) {
  const act = KARMA_ACT_BY_ID[actId];
  if (!act) return 'Unknown act.';
  if (actCount(state, state.day, act.id) >= 3) return 'That is enough of that for one day.';
  const cost = karmaActCost(state, act);
  if (cost > (state.credits || 0)) return `Not enough credits — that costs ₡${cost.toLocaleString()}.`;
  if (act.cargo && (state.cargo?.[act.cargo.id] || 0) < act.cargo.qty) {
    return `You would need ${act.cargo.qty} × ${act.cargo.id} in the hold.`;
  }
  if (act.delta > 0 && (state.karma || 0) >= 100) return 'Your name cannot get any cleaner.';
  if (act.delta < 0 && (state.karma || 0) <= -100) return 'Your name cannot get any blacker.';
  return null;
}

/** Do the act, pay for it, and log it. Returns { ok, error?, text? }. */
export function doKarmaAct(state, actId) {
  const act = KARMA_ACT_BY_ID[actId];
  if (!act) return { ok: false, error: 'Unknown act.' };
  const block = karmaActBlock(state, actId);
  if (block) return { ok: false, error: block };
  const cost = karmaActCost(state, act);
  if (cost > 0) state.addCredits(-cost);
  if (act.cargo) state.removeCargo(act.cargo.id, act.cargo.qty);
  state.karmaActs = state.karmaActs || {};
  // only the last few days are ever consulted
  for (const key of Object.keys(state.karmaActs)) {
    if (Number(key) < state.day - 3) delete state.karmaActs[key];
  }
  const day = (state.karmaActs[state.day] = state.karmaActs[state.day] || {});
  day[act.id] = (day[act.id] || 0) + 1;
  const fid = karmaActFaction(state, act);
  if (fid) state.addRep(fid, act.rep);
  addKarma(state, act.delta, act.name.toLowerCase());
  return { ok: true, karma: state.karma, text: `${act.name} — karma ${state.karma >= 0 ? '+' : ''}${state.karma}.` };
}

export function karmaLabel(karma) {
  const k = karma || 0;
  if (k >= 60) return 'Beacon of the lanes';
  if (k >= 30) return 'Clean name';
  if (k >= 10) return 'Light-touched';
  if (k > -10) return 'Unaligned';
  if (k > -30) return 'Shady dealings';
  if (k > -60) return 'Black reputation';
  return 'Black-hearted';
}

/* ------------------------------------------------------------------ */
/* Ranks and aggregation                                              */
/* ------------------------------------------------------------------ */

export function skillRank(state, skillId) {
  return state.skills?.[skillId] || 0;
}

export function treeRanks(state, treeId) {
  const tree = TREE_BY_ID[treeId];
  if (!tree) return 0;
  let n = 0;
  for (const s of tree.skills) n += skillRank(state, s.id);
  return n;
}

/** Flat stat bonuses from learned skills, merged by computeStats. */
export function skillStatAdds(state) {
  const out = {};
  for (const [id, rank] of Object.entries(state.skills || {})) {
    const skill = SKILL_BY_ID[id];
    if (!skill || !rank || !skill.stat || !skill.add) continue;
    out[skill.stat] = (out[skill.stat] || 0) + skill.add * rank;
  }
  return out;
}

/** Fractional modifiers (positive = bonus) aggregated from all learned skills. */
export function modAdds(state) {
  const out = {};
  for (const [id, rank] of Object.entries(state.skills || {})) {
    const skill = SKILL_BY_ID[id];
    if (!skill || !rank || !skill.mod) continue;
    for (const [key, per] of Object.entries(skill.mod)) {
      out[key] = (out[key] || 0) + per * rank;
    }
  }
  return out;
}

export function combatMods(state) {
  const m = modAdds(state);
  const q = questMods(state);
  return {
    dmg: (m.dmg || 0) + (q.dmg || 0),
    dmgTaken: (m.dmgTaken || 0) + (q.dmgTaken || 0),
  };
}

/** Reputation modifiers (diplomacy tree) — read by GameState.addRep. */
export function repAdds(state) {
  const m = modAdds(state);
  const q = questMods(state);
  return {
    repGain: (m.repGain || 0) + (q.repGain || 0),
    repLossCut: Math.min(0.75, (m.repLossCut || 0) + (q.repLossCut || 0)),
  };
}

/** Wing (escort) modifiers — applied when fleet ships spawn in universe.js. */
export function wingMods(state) {
  const m = modAdds(state);
  const q = questMods(state);
  return {
    wingDmg: (m.wingDmg || 0) + (q.wingDmg || 0),
    wingArmor: (m.wingArmor || 0) + (q.wingArmor || 0),
  };
}

/** Permanent modifiers earned from storylines and side-quest chains. */
function questMods(state) {
  const out = {};
  for (const block of [state.story?.mods, state.side?.mods]) {
    if (!block) continue;
    for (const [key, val] of Object.entries(block)) out[key] = (out[key] || 0) + val;
  }
  return out;
}

export function economyMods(state) {
  const m = modAdds(state);
  const q = questMods(state);
  return {
    buy: Math.max(0.5, 1 + (m.buy || 0) + (q.buy || 0)),
    sell: 1 + (m.sell || 0) + (q.sell || 0),
    illegalSell: 1 + (m.illegalSell || 0) + (q.illegalSell || 0),
    repair: Math.max(0.3, 1 + (m.repair || 0) + (q.repair || 0)),
    contract: 1 + (m.contract || 0) + (q.contract || 0),
    survey: 1 + (m.survey || 0) + (q.survey || 0),
    podCredits: 1 + (m.podCredits || 0) + (q.podCredits || 0),
    killLoot: 1 + (m.killLoot || 0) + (q.killLoot || 0),
  };
}

/* ------------------------------------------------------------------ */
/* Learning                                                           */
/* ------------------------------------------------------------------ */

/** Why a skill cannot be learned right now — or null if it can. */
export function learnBlockReason(state, skillId) {
  const skill = SKILL_BY_ID[skillId];
  if (!skill) return 'Unknown skill.';
  const rank = skillRank(state, skillId);
  if (rank >= skill.max) return 'Already at maximum rank.';
  const tree = TREE_BY_ID[skill.tree];
  if (tree.faction && state.allegiance !== tree.faction) {
    const fname = FACTIONS[tree.faction]?.name || tree.name;
    return `Requires allegiance to ${fname}.`;
  }
  const tReq = TIER_RANK_REQ[skill.tier] || 0;
  if (tReq > 0 && treeRanks(state, tree.id) < tReq) {
    return `Needs ${tReq} ranks in ${tree.name} to open tier ${skill.tier}.`;
  }
  if (skill.karmaMin != null && (state.karma || 0) < skill.karmaMin) {
    return `Requires karma +${skill.karmaMin} or better.`;
  }
  if (skill.karmaMax != null && (state.karma || 0) > skill.karmaMax) {
    return `Requires karma ${skill.karmaMax} or lower.`;
  }
  if (skill.karmaAbs != null && Math.abs(state.karma || 0) > skill.karmaAbs) {
    return `Requires karma within ±${skill.karmaAbs} of neutral.`;
  }
  if (skill.rep != null && tree.faction && (state.rep[tree.faction] ?? 0) < skill.rep) {
    return `Requires ${tree.name} standing ${skill.rep}.`;
  }
  // elite skills carry unlock requirements: story chapters, side chains, kills, level
  const req = skill.req;
  if (req) {
    if (req.level != null && levelFromXp(state.xp || 0) < req.level) {
      return `Requires level ${req.level}.`;
    }
    if (req.kills != null && (state.stats?.kills || 0) < req.kills) {
      return `Requires ${req.kills} raiders destroyed (${state.stats?.kills || 0} so far).`;
    }
    if (req.story) {
      const [line, chapter] = req.story;
      const rank = state.story?.rank?.[line] || 0;
      if (rank < chapter) {
        const lineName = STORY_LINES[line]?.name || 'a story path';
        return `Unlocked by Chapter ${chapter} of ${lineName}.`;
      }
    }
    if (req.side) {
      const done = state.side?.done || [];
      if (!done.includes(req.side)) {
        const q = SIDE_BY_ID[req.side];
        return `Unlocked by finishing ${q ? `the ${q.name} side jobs` : 'a side job chain'}.`;
      }
    }
  }
  const cost = skill.cost || 1;
  if ((state.skillPoints || 0) < cost) return `Needs ${cost} skill point${cost > 1 ? 's' : ''}.`;
  return null;
}

export function learnSkill(state, skillId) {
  const reason = learnBlockReason(state, skillId);
  if (reason) return { ok: false, error: reason };
  const skill = SKILL_BY_ID[skillId];
  const cost = skill.cost || 1;
  state.skillPoints -= cost;
  state.skills[skillId] = skillRank(state, skillId) + 1;
  return { ok: true, skill, rank: state.skills[skillId] };
}

/* ------------------------------------------------------------------ */
/* Faction allegiance                                                 */
/* ------------------------------------------------------------------ */

export const FACTION_ALLEGIANCE_REP = 40;
/** What the flag you walk away from thinks of the walk. */
export const DEFECT_REP_COST = -25;
/** A free-port broker's rates: introductions, papers, and a quiet amnesty. */
export const BROKER_STANDING_COST = 8000;
export const BROKER_STANDING_GAIN = 10;
export const BROKER_PAPERS_COST = 60000;
export const BROKER_AMNESTY_COST = 45000;
/** Days a broker desk makes you wait between each of its services. */
export const BROKER_COOLDOWN_DAYS = 1;
export const AMNESTY_COOLDOWN_DAYS = 5;

/**
 * A broker's amnesty: the desk knows somebody who knows somebody, and a hunted
 * name edges back off the wanted lists. It never buys goodwill — only distance
 * from the firing line.
 */
export const AMNESTY_FLOOR = -30;

export function canJoinFaction(state, factionId) {
  if (state.allegiance === factionId) return { ok: false, error: 'You already fly those colours.' };
  const rep = state.rep[factionId] ?? 0;
  if (rep < FACTION_ALLEGIANCE_REP) {
    return { ok: false, error: `Standing ${rep}/${FACTION_ALLEGIANCE_REP} — the recruiters are not convinced yet.` };
  }
  return { ok: true };
}

export function joinFaction(state, factionId) {
  const check = canJoinFaction(state, factionId);
  if (!check.ok) return check;
  const old = state.allegiance;
  state.allegiance = factionId;
  state.factionLine = { faction: factionId, stage: 0 };
  return { ok: true, old };
}

export function renounceFaction(state) {
  if (!state.allegiance) return { ok: false, error: 'You carry no flag to renounce.' };
  const old = state.allegiance;
  state.allegiance = null;
  state.factionLine = null;
  state.addRep(old, -10);
  return { ok: true, old };
}

/**
 * Defection: swear to a new flag while still flying the old one's colours. The
 * recruiters will take you, but the flag you leave writes it down.
 */
export function defectFaction(state, factionId) {
  if (!state.allegiance) return joinFaction(state, factionId);
  if (state.allegiance === factionId) return { ok: false, error: 'You already fly those colours.' };
  const rep = state.rep[factionId] ?? 0;
  if (rep < FACTION_ALLEGIANCE_REP) {
    return { ok: false, error: `${FACTIONS[factionId]?.name || factionId} wants standing ${FACTION_ALLEGIANCE_REP}; you have ${rep}.` };
  }
  const old = state.allegiance;
  state.allegiance = factionId;
  state.factionLine = { faction: factionId, stage: 0 };
  state.addRep(old, DEFECT_REP_COST);
  return { ok: true, old };
}

/** Where the broker desk stands with today's books. */
export function brokerStatus(state, kind) {
  const b = state.broker || {};
  if (kind === 'amnesty') {
    const until = b.amnestyDay ?? -999;
    return { ready: state.day >= until, waitDays: Math.max(0, until - state.day) };
  }
  const until = b.day ?? -999;
  return { ready: state.day >= until, waitDays: Math.max(0, until - state.day) };
}

/** Buy introductions: a word in the right ear, paid for in credits. */
export function buyStanding(state, factionId) {
  const st = brokerStatus(state, 'standing');
  if (!st.ready) return { ok: false, error: `The desk has nothing more to say today — try again in ${st.waitDays} day${st.waitDays === 1 ? '' : 's'}.` };
  if ((state.credits || 0) < BROKER_STANDING_COST) {
    return { ok: false, error: `The broker wants ₡${BROKER_STANDING_COST.toLocaleString()} for the introductions.` };
  }
  state.addCredits(-BROKER_STANDING_COST);
  state.addRep(factionId, BROKER_STANDING_GAIN);
  state.broker = { ...(state.broker || {}), day: state.day + BROKER_COOLDOWN_DAYS };
  return { ok: true, gain: BROKER_STANDING_GAIN, rep: state.rep[factionId] ?? 0 };
}

/** Buy an amnesty: the deepest of your hunted names is quietly forgotten a while. */
export function buyAmnesty(state) {
  const st = brokerStatus(state, 'amnesty');
  if (!st.ready) return { ok: false, error: `The papers are still in transit — ${st.waitDays} day${st.waitDays === 1 ? '' : 's'} yet.` };
  const hunted = Object.entries(state.rep || {})
    .filter(([, v]) => v < AMNESTY_FLOOR)
    .sort((a, b) => a[1] - b[1]);
  if (!hunted.length) return { ok: false, error: 'Nobody has a file on you worth shredding.' };
  if ((state.credits || 0) < BROKER_AMNESTY_COST) {
    return { ok: false, error: `The broker wants ₡${BROKER_AMNESTY_COST.toLocaleString()} to lose the file.` };
  }
  const [faction, worst] = hunted[0];
  state.addCredits(-BROKER_AMNESTY_COST);
  const target = Math.min(AMNESTY_FLOOR, worst);
  state.addRep(faction, target - worst);
  state.broker = { ...(state.broker || {}), amnestyDay: state.day + AMNESTY_COOLDOWN_DAYS };
  return { ok: true, faction, from: worst, to: state.rep[faction] ?? target };
}

/** Broker-arranged defection: colours changed without the wait for recruiters. */
export function brokerDefect(state, factionId) {
  if (state.allegiance === factionId) return { ok: false, error: 'You already fly those colours.' };
  if ((state.credits || 0) < BROKER_PAPERS_COST) {
    return { ok: false, error: `The broker wants ₡${BROKER_PAPERS_COST.toLocaleString()} for clean papers.` };
  }
  state.addCredits(-BROKER_PAPERS_COST);
  const old = state.allegiance;
  state.allegiance = factionId;
  state.factionLine = { faction: factionId, stage: 0 };
  if (old) state.addRep(old, Math.round(DEFECT_REP_COST * 0.6)); // quieter than a public defection
  return { ok: true, old };
}

/** Quick summary used by HUD / career views. */
export function careerSummary(state) {
  return {
    level: levelFromXp(state.xp || 0),
    points: state.skillPoints || 0,
    karma: state.karma || 0,
    label: karmaLabel(state.karma || 0),
  };
}
