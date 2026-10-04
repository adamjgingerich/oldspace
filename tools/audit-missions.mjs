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
import { generateBoard, missionGuide, FACTION_LINES, PROCEDURAL_POOLS, factionChain, factionQuestOffers, factionDesks } from '../src/game/missions.js';
import { STORY_LINES } from '../src/game/story.js';
import { SIDE_QUESTS } from '../src/game/sidequests.js';
import { rngOf } from '../src/core/rng.js';

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
    if (!FACTIONS[st.owner] && st.owner !== 'none') bad(`${id}/${st.id}: owner '${st.owner}' unknown`);
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

// 6) every flag's own line, stage by stage, at its desk and nowhere else
{
  const PLACEHOLDER = /\{[a-z]+\}/i;
  const ownDesk = {};
  const rivalDesk = {};
  for (const [id, sys] of Object.entries(SYSTEMS)) {
    for (const st of sys.stations || []) {
      if (!ownDesk[st.owner]) ownDesk[st.owner] = { sys, st };
      else if (!rivalDesk[st.owner]) rivalDesk[st.owner] = { sys, st };
    }
  }
  for (const flag of Object.keys(FACTIONS)) {
    const bench = ownDesk[flag];
    checks += 1;
    if (!bench) { bad(`flag ${flag}: keeps no station, so its line has nowhere to post`); continue; }
    const line = FACTION_LINES[flag] || [];
    const chain = factionChain(flag);
    checks += 1;
    if (chain.length < 8) bad(`flag ${flag}: its line is only ${chain.length} stages`);
    checks += 1;
    if (new Set(line.map((s) => s.key)).size !== line.length) bad(`flag ${flag}: two stages share a key`);
    // every type the desk repeats must have a stage of that type to borrow the
    // flag's own phrasing from, or its repeats are written for other work
    checks += 1;
    for (const t of PROCEDURAL_POOLS[flag] || []) {
      if (!line.some((s) => s.type === t)) bad(`flag ${flag}: repeats ${t} work but its line has no ${t} stage to phrase it`);
    }

    // every desk the flag keeps hands over the same stage, wherever it is: a
    // posting has to be flyable from each of them, not just the home office
    const ours = Object.values(SYSTEMS).flatMap((sys) => (sys.stations || [])
      .filter((st) => st.owner === flag)
      .map((st) => ({ sys, st })));
    for (let stage = 0; stage < chain.length; stage++) {
      for (const bench of ours) {
        const st = new GameState({ worldSeed: 9000 + stage, commander: 'Audit' });
        st.allegiance = flag;
        st.factionLine = { faction: flag, stage };
        st.systemId = bench.sys.id;
        st.day = 3;
        const rng = rngOf(st.worldSeed, 'audit-line', flag, stage, bench.st.id);
        const out = factionQuestOffers(st, bench.st, rng);
        const w = `line ${flag} stage ${stage} at ${bench.st.id}`;
        checks += 1;
        if (out.length !== 1) { bad(`${w}: ${out.length} postings from the desk, expected 1`); continue; }
        const o = out[0];
        checks += 1;
        if (o.line?.faction !== flag || o.line?.stage !== stage) bad(`${w}: posting carries ${JSON.stringify(o.line)}`);
        checks += 1;
        if (PLACEHOLDER.test(o.title) || PLACEHOLDER.test(o.desc)) bad(`${w}: un-filled placeholder in "${o.title}"`);
        checks += 1;
        if (!(Number.isFinite(o.reward) && o.reward > 500)) bad(`${w}: reward ${o.reward}`);
        checks += 1;
        if (!(o.deadlineDay > st.day)) bad(`${w}: deadline ${o.deadlineDay}`);
        checks += 1;
        if (!o.dest || !SYSTEMS[o.dest.systemId]) bad(`${w}: unknown dest ${o.dest?.systemId}`);
        else if (!routeBetween(st.systemId, o.dest.systemId)) bad(`${w}: dest ${o.dest.systemId} unreachable from ${st.systemId}`);
        checkObjective(w, { type: o.type, dest: o.dest?.systemId, cargo: o.cargo, target: o.target, kills: o.kills?.need, pods: o.pods?.need, foe: o.foe });
        // what each kind of work needs in hand, and what it must not need
        checks += 1;
        if (o.type === 'delivery' && !o.cargo) bad(`${w}: a delivery with nothing to carry`);
        if (o.type === 'courier' && !o.cargo) bad(`${w}: a courier with nothing to carry`);
        if (o.type === 'recovery' && !(o.pods?.need >= 1)) bad(`${w}: recovery needs ${o.pods?.need} pods`);
        if (o.type === 'sweep') {
          if (!(o.kills?.need >= 1)) bad(`${w}: sweep needs ${o.kills?.need} kills`);
          // a sweep is flown where the enemy is, or it is a wasted trip
          const g = SYSTEMS[o.dest.systemId].danger;
          if ((o.foe === 'navy' ? g.navy : g.pirates) < 0.35) bad(`${w}: sweep sent to ${o.dest.systemId}, which has no ${o.foe} to break`);
        }
        if (o.type === 'survey' && o.cargo) bad(`${w}: a survey is not carried, it is flown`);
        // the written chapters come first in every chain that has them
        const writtenRun = chain.filter((s2) => s2.kind === 'story').length;
        checks += 1;
        if (stage < writtenRun && !o.story) bad(`${w}: the written chapters run first, but this is not one`);
      }
      // the isolation rule: no other flag's desk hands you your own line
      for (const other of Object.keys(FACTIONS)) {
        if (other === flag) continue;
        const remote = rivalDesk[other];
        if (!remote) continue;
        const s2 = new GameState({ worldSeed: 9000 + stage, commander: 'Audit' });
        s2.allegiance = flag;
        s2.factionLine = { faction: flag, stage };
        s2.systemId = remote.sys.id;
        checks += 1;
        if (factionQuestOffers(s2, remote.st, rngOf(2, 'audit-line', other, stage)).length) {
          bad(`line ${flag} stage ${stage}: a ${other} desk posted ${flag} line work`);
        }
      }
    }

    // the written line run out: standing work, several at a time, all distinct
    const st2 = new GameState({ worldSeed: 5150, commander: 'Audit' });
    st2.allegiance = flag;
    st2.factionLine = { faction: flag, stage: chain.length };
    st2.systemId = bench.sys.id;
    const standing = factionQuestOffers(st2, bench.st, rngOf(7, 'audit-standing', flag));
    checks += 1;
    if (standing.length < 2) bad(`flag ${flag}: the desk posts ${standing.length} posting(s) with its line run out`);
    checks += 1;
    if (standing.some((o) => !o.line?.repeat)) bad(`flag ${flag}: standing work is not marked repeatable`);
    checks += 1;
    if (new Set(standing.map((o) => `${o.type}:${o.dest.systemId}`)).size !== standing.length) {
      bad(`flag ${flag}: two standing postings are the same job in the same place`);
    }
    checks += 1;
    if (standing.some((o) => PLACEHOLDER.test(o.title) || PLACEHOLDER.test(o.desc))) bad(`flag ${flag}: un-filled placeholder in standing work`);
  }
  console.log(`lines: ${Object.keys(FACTIONS).length} flags, ${Object.values(FACTION_LINES).reduce((n, l) => n + l.length, 0)} written stages`);
}

// 7) the desk finder: every flag's desks, nearest first, from every system
{
  for (const flag of Object.keys(FACTIONS)) {
    for (const from of ['haven', 'coriolis', 'vesper', 'rusthaven', 'vekta']) {
      const d = factionDesks(flag, from);
      const w = `desks ${flag} from ${from}`;
      checks += 1;
      if (!d.desks.length) bad(`${w}: no desks found at all`);
      checks += 1;
      if (!d.desks.every((x, i) => i === 0 || d.desks[i - 1].hops <= x.hops)) bad(`${w}: not sorted by distance`);
      checks += 1;
      if (!d.desks.every((x) => routeBetween(from, x.systemId))) bad(`${w}: a desk is unreachable`);
      checks += 1;
      const hereHasDesk = (SYSTEMS[from].stations || []).some((s2) => s2.owner === flag);
      if (!!d.here !== hereHasDesk) bad(`${w}: 'here' is ${!!d.here} but this system ${hereHasDesk ? 'has' : 'has no'} ${flag} station`);
      checks += 1;
      if (d.nearest !== (d.desks[0] || null)) bad(`${w}: nearest is not the first desk`);
    }
  }
}

console.log(`\naudit: ${checks} checks, ${offers} board offers generated (min board ${minCount}), ${fails} FAILURE(S)`);
process.exit(fails ? 1 : 0);
