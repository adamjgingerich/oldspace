// Experience, karma, faction allegiance and skill learning.
//
// Skills live in data/skills.js; this module knows how to earn, gate,
// learn and aggregate them. All aggregation functions are pure reads of
// state so they are safe to call from hot paths (computeStats, combat).

import { SKILL_BY_ID, SKILL_TREES, TREE_BY_ID, TIER_RANK_REQ } from '../data/skills.js';
import { FACTIONS } from '../data/factions.js';
import { STORY_LINES } from './story.js';
import { SIDE_BY_ID } from './sidequests.js';
import { clamp } from '../core/util.js';

/** The highest commander level. */
export const MAX_LEVEL = 40;

/**
 * Cumulative XP needed to reach each level (index 0 = level 1). Levels 1–20
 * are the early game, tuned by hand; 21–40 are the long climb to a flag of
 * your own — the endgame of fleets, charters and the deep lanes.
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

export function addKarma(state, delta) {
  state.karma = clamp((state.karma || 0) + delta, -100, 100);
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

export function canJoinFaction(state, factionId) {
  if (state.allegiance) return { ok: false, error: 'You are already sworn to a flag. Renounce it first.' };
  const rep = state.rep[factionId] ?? 0;
  if (rep < FACTION_ALLEGIANCE_REP) {
    return { ok: false, error: `Standing ${rep}/40 — the recruiters are not convinced yet.` };
  }
  return { ok: true };
}

export function joinFaction(state, factionId) {
  const check = canJoinFaction(state, factionId);
  if (!check.ok) return check;
  state.allegiance = factionId;
  return { ok: true };
}

export function renounceFaction(state) {
  if (!state.allegiance) return { ok: false, error: 'You carry no flag to renounce.' };
  const old = state.allegiance;
  state.allegiance = null;
  state.addRep(old, -10);
  return { ok: true, old };
}

export function isTreeUnlocked(state, treeId) {
  const tree = TREE_BY_ID[treeId];
  if (!tree) return false;
  return !tree.faction || state.allegiance === tree.faction;
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
