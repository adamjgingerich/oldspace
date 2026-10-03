// Mission completability audit — run with: node tools/audit-missions.mjs
// Validates every contract source: generated boards (across renown bands,
// days and every station), story chapters and side-quest steps.
// Checks that destinations exist and are lane-reachable, cargo/ships/items
// resolve, and every type carries what its completion path needs.
import { SYSTEMS, routeBetween } from '../src/data/systems.js';
import { COMMODITY_BY_ID } from '../src/data/commodities.js';
import { SHIP_BY_ID } from '../src/data/ships.js';
import { WEAPON_BY_ID } from '../src/data/weapons.js';
import { OUTFIT_BY_ID } from '../src/data/outfits.js';
import { FACTIONS } from '../src/data/factions.js';
import { GameState } from '../src/game/state.js';
import { generateBoard, missionGuide } from '../src/game/missions.js';
import { STORY_LINES } from '../src/game/story.js';
import { SIDE_QUESTS } from '../src/game/sidequests.js';

let fails = 0;
let checks = 0;
const bad = (msg) => { fails += 1; console.log(`  FAIL ${msg}`); };
const TYPES = new Set(['delivery', 'courier', 'bounty', 'survey', 'sweep', 'recovery', 'relic']);

function checkObjective(where, o) {
  checks += 1;
  if (!o || !TYPES.has(o.type)) return bad(`${where}: unknown objective type ${o?.type}`);
  if (o.dest && !SYSTEMS[o.dest]) bad(`${where}: dest '${o.dest}' does not exist`);
  if (o.cargo) {
    if (!COMMODITY_BY_ID[o.cargo.id]) bad(`${where}: cargo '${o.cargo.id}' unknown`);
    if (!(o.cargo.qty >= 1)) bad(`${where}: cargo qty ${o.cargo.qty}`);
  }
  if (o.target) {
    if (!SHIP_BY_ID[o.target.shipId]) bad(`${where}: target ship '${o.target.shipId}' unknown`);
    if (!['pirate', 'vigil'].includes(o.target.kind)) bad(`${where}: target kind ${o.target.kind}`);
    if (!(o.target.escorts >= 0)) bad(`${where}: escorts ${o.target.escorts}`);
  }
  if (o.type === 'sweep') {
    if (!(o.kills >= 1)) bad(`${where}: sweep kills ${o.kills}`);
    if (o.foe !== 'navy' && o.foe !== 'pirate') bad(`${where}: sweep foe ${o.foe}`);
  }
  if (o.type === 'recovery' && !(o.pods >= 1)) bad(`${where}: pods ${o.pods}`);
}

// 1) the lane graph is fully connected and symmetric
{
  const seen = new Set(['haven']);
  const q = ['haven'];
  while (q.length) {
    const cur = q.shift();
    for (const n of SYSTEMS[cur].links) if (!seen.has(n)) { seen.add(n); q.push(n); }
  }
  checks += 1;
  if (seen.size !== Object.keys(SYSTEMS).length) {
    bad(`systems unreachable from haven: ${Object.keys(SYSTEMS).filter((id) => !seen.has(id)).join(', ')}`);
  } else {
    console.log(`reach: all ${seen.size} systems reachable from haven`);
  }
}
for (const [id, sys] of Object.entries(SYSTEMS)) {
  for (const n of sys.links) {
    checks += 1;
    if (!SYSTEMS[n]) bad(`${id}: link to unknown system ${n}`);
    else if (!SYSTEMS[n].links.includes(id)) bad(`lane ${id}-${n} is one-way`);
  }
  for (const st of sys.stations || []) {
    checks += 1;
    if (!FACTIONS[st.owner]) bad(`${id}/${st.id}: owner '${st.owner}' unknown`);
  }
}

// 2) story chapters
for (const [key, line] of Object.entries(STORY_LINES)) {
  for (const ch of line.chapters) {
    const where = `story ${key} ch${ch.n}`;
    checkObjective(where, ch.objective);
    checks += 1;
    if (!(ch.reward > 0)) bad(`${where}: reward ${ch.reward}`);
    if (ch.penalty && !FACTIONS[ch.penalty.faction]) bad(`${where}: penalty faction ${ch.penalty.faction}`);
    for (const item of ch.unlock || []) {
      checks += 1;
      if (!SHIP_BY_ID[item] && !WEAPON_BY_ID[item] && !OUTFIT_BY_ID[item]) bad(`${where}: unlock '${item}' unknown`);
    }
  }
}

// 3) side quests
for (const q of SIDE_QUESTS) {
  checks += 1;
  if (!q.steps?.length) bad(`side ${q.id}: no steps`);
  for (const [i, step] of (q.steps || []).entries()) {
    checkObjective(`side ${q.id} step ${i + 1}`, step.objective);
    checks += 1;
    if (!(step.reward > 0)) bad(`side ${q.id} step ${i + 1}: reward ${step.reward}`);
  }
  for (const item of q.finale?.unlock || []) {
    checks += 1;
    if (!SHIP_BY_ID[item] && !WEAPON_BY_ID[item] && !OUTFIT_BY_ID[item]) bad(`side ${q.id}: unlock '${item}' unknown`);
  }
  if (q.faction && !FACTIONS[q.faction]) bad(`side ${q.id}: faction ${q.faction}`);
}

// 4) generated boards across renown bands x days x every station
let offers = 0;
let minCount = Infinity;
for (const xp of [0, 1200, 6000, 20000, 60000]) {
  for (let day = 1; day <= 3; day++) {
    const st = new GameState({ worldSeed: 424242 + day, commander: 'Audit' });
    st.xp = xp;
    st.day = day;
    for (const [sysId, sys] of Object.entries(SYSTEMS)) {
      st.systemId = sysId;
      st.visited[sysId] = true;
      for (const station of sys.stations || []) {
        const board = generateBoard(st, station);
        minCount = Math.min(minCount, board.length);
        checks += 1;
        if (board.length < 5) bad(`board ${sysId}/${station.id} xp${xp} d${day}: only ${board.length} offers`);
        for (const o of board) {
          offers += 1;
          const w = `board ${sysId}/${station.id} ${o.id}`;
          checks += 1;
          if (!o.title || !o.desc) bad(`${w}: empty title/desc`);
          if (!(Number.isFinite(o.reward) && o.reward > 0)) bad(`${w}: reward ${o.reward}`);
          if (!(o.deadlineDay > st.day)) bad(`${w}: deadline ${o.deadlineDay} <= day ${st.day}`);
          if (o.dest && !SYSTEMS[o.dest.systemId]) bad(`${w}: unknown dest ${o.dest.systemId}`);
          else if (!routeBetween(sysId, o.dest.systemId)) bad(`${w}: dest ${o.dest.systemId} unreachable from ${sysId}`);
          if (o.cargo && !COMMODITY_BY_ID[o.cargo.id]) bad(`${w}: cargo ${o.cargo.id}`);
          if (o.type === 'recovery' && !(o.pods?.need >= 1)) bad(`${w}: pods ${JSON.stringify(o.pods)}`);
          if (o.type === 'sweep' && !(o.kills?.need >= 1)) bad(`${w}: kills ${JSON.stringify(o.kills)}`);
          if (o.type === 'bounty') {
            if (!['pirate', 'vigil'].includes(o.target?.kind)) bad(`${w}: target kind ${o.target?.kind}`);
            if (!SHIP_BY_ID[o.target?.shipId]) bad(`${w}: target ship ${o.target?.shipId}`);
            for (const arm of o.target?.weapons || []) if (arm && !WEAPON_BY_ID[arm]) bad(`${w}: arm ${arm}`);
          }
          if (o.type === 'relic') {
            const item = WEAPON_BY_ID[o.relic?.itemId] || OUTFIT_BY_ID[o.relic?.itemId];
            if (!item || !item.legend) bad(`${w}: relic ${o.relic?.itemId} not legendary`);
          }
          const guide = missionGuide(st, {
            type: o.type, dest: o.dest, issuer: o.issuer,
            pods: o.pods ? { need: o.pods.need, taken: [] } : null,
            kills: o.kills, target: o.target, scanned: false,
          }, sysId);
          if (!guide.systemId || !SYSTEMS[guide.systemId]) bad(`${w}: guide has no target system (${o.type})`);
        }
      }
    }
  }
}

// 5) missionGuide phases for the hand-in types
{
  const st = new GameState({ worldSeed: 1 });
  const base = { id: 'x', issuer: { systemId: 'coriolis', stationId: 'coriolis-skyforge' }, dest: { systemId: 'meridian' } };
  const g1 = missionGuide(st, { ...base, type: 'delivery' }, 'coriolis');
  const g2 = missionGuide(st, { ...base, type: 'survey', scanned: true }, 'meridian');
  const g3 = missionGuide(st, { ...base, type: 'survey', scanned: false }, 'meridian');
  const g4 = missionGuide(st, { ...base, type: 'recovery', pods: { need: 2, taken: [0, 1] } }, 'coriolis');
  const g5 = missionGuide(st, { ...base, type: 'recovery', pods: { need: 2, taken: [] } }, 'coriolis');
  checks += 1;
  if (g1.phase !== 'deliver' || g2.phase !== 'return' || !g2.stationId || g3.phase !== 'survey' || g4.phase !== 'return' || g5.phase !== 'recover') {
    bad(`guide phases wrong: ${JSON.stringify([g1.phase, g2.phase, g3.phase, g4.phase, g5.phase])}`);
  }
  checks += 1;
  if (!SYSTEMS.coriolis.stations.some((s) => s.id === 'coriolis-skyforge')) bad('coriolis-skyforge missing');
}

console.log(`\naudit: ${checks} checks, ${offers} board offers generated (min board ${minCount}), ${fails} FAILURE(S)`);
process.exit(fails ? 1 : 0);
