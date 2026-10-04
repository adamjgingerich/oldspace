// ---------------------------------------------------------------------------
// The three storylines. Each line runs four chapters. The first three chapters
// of every line are open to any pilot — but the fourth is an OATH: taking one
// line's oath closes the other two for good. Chapters hand out hand-written
// contracts; completing one pays, grants a permanent passive, and from chapter
// two onward unlocks unique weapons, outfits and ships in the shops.
// ---------------------------------------------------------------------------

import { SYSTEMS } from '../data/systems.js';
import { levelFromXp } from './skills.js';
import { rngOf } from '../core/rng.js';

export const STORY_LINES = {
  vig: {
    id: 'vig', name: 'The Long Watch', faction: 'vigil', color: '#56e6ff',
    blurb: 'Carry the Vigil into the lanes and keep them clean. The Watch rewards those who hold the line.',
    chapters: [
      {
        n: 1, lvl: 1,
        title: 'Report to the Watch',
        desc: 'The Vigil keeps a mustering post at Meridian. Present your papers and the sealed orders you are handed at any berth there.',
        objective: { type: 'courier', dest: 'meridian', cargo: { id: 'electronics', qty: 1 } },
        reward: 1800, rep: 6,
        mods: { contract: 0.05 },
        rewards: ['Contract pay +5% — the Watch vouches for you'],
      },
      {
        n: 2, lvl: 3,
        title: 'Clear the Hollow',
        desc: 'Raiders have grown bold in the Hollow and the Watch is stretched thin. Put down three of them and the lane breathes again.',
        objective: { type: 'sweep', dest: 'doldrums', foe: 'pirate', kills: 3 },
        reward: 4200, rep: 8,
        unlock: ['aegis'],
        mods: { contract: 0.05 },
        rewards: ['Aegis Lattice unlocked at mechanics', 'Contract pay +10% total'],
      },
      {
        n: 3, lvl: 5,
        title: 'The Cleaver of Rusthaven',
        desc: 'A reaver captain called Skarn the Cleaver has been cutting the Rusthaven run to pieces. The Watch does not take prisoners, and does not want one.',
        objective: {
          type: 'bounty', dest: 'rusthaven',
          target: {
            name: 'Skarn the Cleaver', shipId: 'voskar', kind: 'pirate', escorts: 1,
            hullMult: 1.25, shieldMult: 1.15, weapons: ['pulse', null], harpoonAmmo: 0, dmgMult: 0.75,
          },
        },
        reward: 9000, rep: 10,
        unlock: ['warden'],
        rewards: ['Warden Lance unlocked at mechanics'],
      },
      {
        n: 4, lvl: 8, oath: true,
        title: 'The Oath of the Watch',
        desc: 'The Vesper Gate is burning and the fleet needs every gun. Swear the oath, fly with the Watch, and break the raider tide where it is staging — out of Cordon, before it reaches the Gate. From that day your name is theirs, and so are their enemies.',
        objective: { type: 'sweep', dest: 'cordon', foe: 'pirate', kills: 5 },
        reward: 22000, rep: 18,
        penalty: { faction: 'reaver', amount: -25 },
        unlock: ['vanguard'],
        mods: { dmgTaken: 0.15, contract: 0.1 },
        rewards: ['Vigil Vanguard unlocked at shipyards', 'Damage taken −15%', 'Contract pay +20% total'],
      },
    ],
  },

  rea: {
    id: 'rea', name: 'Blood in the Black', faction: 'reaver', color: '#ff5f7a',
    blurb: 'Run with the Clans. Every patrol broken and every hold cracked pays the pilot who did it.',
    chapters: [
      {
        n: 1, lvl: 1,
        title: 'The Culragh Handshake',
        desc: 'A case with no manifest and a smile with no humour. Culragh is waiting, and the Clans remember who carries their post.',
        objective: { type: 'courier', dest: 'doldrums', cargo: { id: 'medicine', qty: 2 } },
        reward: 2000, rep: 6,
        mods: { killLoot: 0.15 },
        rewards: ['Kill drops +15% — the Clans cut you in'],
      },
      {
        n: 2, lvl: 3,
        title: 'Silence the Watch',
        desc: 'The Vigil is leaning on Haven again. Break three patrols over Haven and the lanes belong to whoever is left standing.',
        objective: { type: 'sweep', dest: 'haven', foe: 'navy', kills: 3 },
        reward: 4500, rep: 8,
        unlock: ['warcraft'],
        mods: { killLoot: 0.15, illegalSell: 0.2 },
        rewards: ['Clan Warplating unlocked at mechanics', 'Contraband prices +20%'],
      },
      {
        n: 3, lvl: 5,
        title: "The Marshal's Head",
        desc: 'Marshal Ivo Grell has sworn to hang every Clan pilot in the Ten. Word is he flies alone out of Meridian, all the better to be a legend. Bring the legend home in a box.',
        objective: {
          type: 'bounty', dest: 'meridian',
          target: {
            name: 'Marshal Ivo Grell', shipId: 'halcyon', kind: 'vigil', escorts: 0,
            hullMult: 1.15, shieldMult: 1.05, weapons: ['pulse', null], harpoonAmmo: 0, dmgMult: 0.75,
          },
        },
        reward: 10000, rep: 10,
        penalty: { faction: 'vigil', amount: -10 },
        unlock: ['clanfang'],
        rewards: ['Clanfang Ripper unlocked at mechanics'],
      },
      {
        n: 4, lvl: 8, oath: true,
        title: 'The Blood Oath',
        desc: 'The Clans are calling in every debt at Coriolis. Swear the blood oath and break the Combine line — after that the Vigil will know your transponder by heart.',
        objective: { type: 'sweep', dest: 'coriolis', foe: 'navy', kills: 4 },
        reward: 24000, rep: 18,
        penalty: { faction: 'vigil', amount: -25 },
        unlock: ['ravager'],
        mods: { dmg: 0.1, killLoot: 0.3 },
        rewards: ['Clan Ravager unlocked at shipyards', 'Weapon damage +10%', 'Kill drops +45% total'],
      },
    ],
  },

  com: {
    id: 'com', name: 'First in the Ledger', faction: 'combine', color: '#ffc857',
    blurb: 'Make the Combine money and the Combine makes you. Buy low, sell dear, and never miss a delivery.',
    chapters: [
      {
        n: 1, lvl: 1,
        title: 'Sign the Registry',
        desc: 'The Combine registers factors at Coriolis. Carry your letters of credit there and your name goes on the right ledgers.',
        objective: { type: 'courier', dest: 'coriolis', cargo: { id: 'electronics', qty: 1 } },
        reward: 1800, rep: 6,
        mods: { sell: 0.05 },
        rewards: ['Sale prices +5% — registered factor’s rates'],
      },
      {
        n: 2, lvl: 3,
        title: 'Open the Sunward Line',
        desc: 'The Sunward rig has been short of parts for a month. Land ten crates of machinery and the Combine will remember who opened the line.',
        objective: { type: 'delivery', dest: 'sunward', cargo: { id: 'machinery', qty: 10 } },
        reward: 4500, rep: 8,
        unlock: ['uplink'],
        mods: { buy: -0.05, sell: 0.05 },
        rewards: ['Trade Uplink unlocked at mechanics', 'Buy prices −5%'],
      },
      {
        n: 3, lvl: 5,
        title: "The Wreckers' Ledger",
        desc: 'A rival convoy went down hard in Ashfall, and its recorder pods are still talking. The Combine would rather audit them than let the Wreckers read them aloud.',
        objective: { type: 'recovery', dest: 'ashfall', pods: 3 },
        reward: 9500, rep: 10,
        unlock: ['arbiter'],
        mods: { podCredits: 0.25 },
        rewards: ['Arbiter Beam unlocked at mechanics', 'Salvage value +25%'],
      },
      {
        n: 4, lvl: 8, oath: true,
        title: "The Director's Hand",
        desc: 'The trade road to Ashfall is strangled and the Board wants it open by the quarter’s end. Swear the director’s oath, clear four raiders from the lane, and the Combine’s ships will fly behind your name.',
        objective: { type: 'sweep', dest: 'ashfall', foe: 'pirate', kills: 4 },
        reward: 24000, rep: 18,
        penalty: { faction: 'reaver', amount: -18 },
        unlock: ['clipper'],
        mods: { buy: -0.05, sell: 0.1, contract: 0.05 },
        rewards: ['Combine Clipper unlocked at shipyards', 'Buy −10%, sales +15% total', 'Contract pay +5%'],
      },
    ],
  },
};

/** Make sure a save has a story block (older saves predate it). */
export function ensureStory(state) {
  if (!state.story || typeof state.story !== 'object') {
    state.story = { mods: {}, unlocked: [] };
  }
  if (!state.story.mods) state.story.mods = {};
  if (!Array.isArray(state.story.unlocked)) state.story.unlocked = [];
  return state.story;
}

/** Build a fixed story-chapter offer from a line + chapter. */
export function buildStoryOffer(line, ch, state, station) {
  const o = ch.objective;
  const offer = {
    id: `story-${line.id}-${ch.n}`,
    type: o.type,
    tier: Math.min(5, 1 + ch.n),
    story: { line: line.id, chapter: ch.n, oath: !!ch.oath },
    title: ch.title,
    desc: ch.desc,
    issuer: { stationId: station.id, systemId: state.systemId, faction: line.faction },
    dest: { systemId: o.dest },
    reward: ch.reward,
    rep: { faction: line.faction, amount: ch.rep || 5 },
    repPenalty: ch.penalty ? { ...ch.penalty } : null,
    deadlineDay: state.day + 14,
  };
  if (o.cargo) offer.cargo = { ...o.cargo };
  if (o.target) offer.target = { ...o.target };
  if (o.type === 'sweep') {
    offer.foe = o.foe || 'pirate';
    offer.kills = { need: o.kills, got: 0 };
  }
  if (o.type === 'recovery') offer.pods = { need: o.pods };
  return offer;
}

/**
 * Chapter-one openings for an unsworn pilot — one per flag with a written
 * path. Running one signs you on with that flag.
 */
export function joinOffers(state, station) {
  const lvl = levelFromXp(state.xp || 0);
  const out = [];
  for (const line of Object.values(STORY_LINES)) {
    const ch = line.chapters[0];
    if (lvl < (ch.lvl || 1)) continue;
    const offer = buildStoryOffer(line, ch, state, station);
    offer.line = { faction: line.faction, stage: 0, repeat: false };
    out.push(offer);
  }
  return out;
}

/**
 * Settle a completed story chapter: merge passives, unlock gear, and — on the
 * chapter-one opening — sign an unsworn pilot on with the flag. Progress down
 * the chain itself is carried by state.factionLine.
 */
export function applyStoryRewards(state, meta) {
  const line = STORY_LINES[meta.line];
  if (!line) return null;
  const s = ensureStory(state);
  const ch = line.chapters[meta.chapter - 1];
  if (!ch) return null;
  for (const [key, val] of Object.entries(ch.mods || {})) {
    s.mods[key] = (s.mods[key] || 0) + val;
  }
  for (const id of ch.unlock || []) {
    if (!s.unlocked.includes(id)) s.unlocked.push(id);
  }
  if (meta.chapter === 1 && !state.allegiance) {
    state.allegiance = line.faction;
    state.factionLine = { faction: line.faction, stage: 0 };
  }
  return {
    line: line.id,
    lineName: line.name,
    chapter: meta.chapter,
    rewards: ch.rewards || [],
    oath: !!ch.oath,
  };
}

/**
 * The papers themselves: one quiet errand per flag. Carrying them to a flag's
 * home is signing on with them — no standing, no broker, just the run.
 * Completing one switches your colours and starts that flag's line from the
 * top. Which of these a desk will actually hand you, and when, is decided by
 * defectionOffers below — they are not all on offer at once.
 */
export const SWITCH_QUESTS = {
  free: {
    name: 'Papers for the Free Ports', dest: 'haven', reward: 2600,
    desc: 'The Ports keep a berth for any captain who brings their own registry to Haven. Deliver the papers, and no flag will own you — but every port will deal with you.',
  },
  combine: {
    name: 'Papers for the Combine', dest: 'coriolis', reward: 2800,
    desc: 'The Combine registers factors at Coriolis. Carry your letters of credit there and your name goes on the right ledgers — steel in, freight out, margin on every leg.',
  },
  vigil: {
    name: 'Papers for the Watch', dest: 'vesper', reward: 2800,
    desc: 'The Watch musters at Vesper Gate. Present your papers there and the Vigil will call you its own — a lane is only as safe as the ships that fly it.',
  },
  reaver: {
    name: 'Papers for the Clans', dest: 'rusthaven', reward: 2800,
    desc: 'The Clans keep no court but Rusthaven. Carry the writ there and you run with them — nothing in the deep is owned, only held.',
  },
  kreth: {
    name: 'Papers for the Houses', dest: 'vekta', reward: 2800,
    desc: "The Houses keep their books at Vek'Tal. Deliver the name-seal there and a name is a debt — yours, to them, from that bell on.",
  },
};

/**
 * A way out, and a rare one. A sworn pilot does not shop for colours. Only
 * once they have flown their flag long enough to be worth poaching does a desk
 * now and then put a single quiet errand in front of them — for one flag, and
 * only in some windows of days. The rest of the time the flag's own work is
 * the only thing on the board, which is as it should be: changing sides is not
 * a thing a captain does often.
 */
const DEFECTION_MIN_STAGE = 3;     // postings served before anyone bothers to poach you
const DEFECTION_WINDOW_DAYS = 12;  // the offer is decided per window, not per visit
const DEFECTION_CHANCE = 0.15;     // ...and most windows pass with nothing at all

/** Defection errand open to a sworn pilot, when one is open at all. */
export function defectionOffers(state, station) {
  if (!state.allegiance) return [];
  // your own desk does not hand you the papers to leave it
  if (station.owner === state.allegiance) return [];
  const stage = state.factionLine?.faction === state.allegiance ? (state.factionLine.stage || 0) : 0;
  if (stage < DEFECTION_MIN_STAGE) return [];
  const window = Math.floor(state.day / DEFECTION_WINDOW_DAYS);
  const rng = rngOf(state.worldSeed, 'defect', station.id, window);
  if (!rng.chance(DEFECTION_CHANCE)) return [];
  // one errand, never a menu: the flag is settled by the same roll
  const candidates = Object.keys(SWITCH_QUESTS).filter((fid) => fid !== state.allegiance);
  if (!candidates.length) return [];
  const fid = rng.pick(candidates);
  const q = SWITCH_QUESTS[fid];
  return [{
    id: `defect-${fid}-w${window}`,
    type: 'courier',
    tier: 3,
    defect: { faction: fid },
    title: q.name,
    desc: q.desc,
    issuer: { stationId: station.id, systemId: state.systemId, faction: station.owner },
    dest: { systemId: q.dest },
    cargo: { id: 'electronics', qty: 1 },
    reward: q.reward,
    rep: { faction: fid, amount: 8 },
    deadlineDay: state.day + 10,
  }];
}
