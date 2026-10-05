// Data integrity audit for the free-fire systems, the shield lattices, the
// disruptor family, the karma acts and the character cards.
//
//   node tools/audit-systems.mjs
//
// Chart layout lives in ui/chart.js, which touches the DOM, so it is read as
// text rather than imported — the positions are a plain object literal.
import { readFileSync } from 'node:fs';
import { SYSTEMS } from '../src/data/systems.js';
import { SHIELD_BY_ID } from '../src/data/shields.js';
import { WEAPONS, WEAPON_BY_ID } from '../src/data/weapons.js';
import { OUTFITS, OUTFIT_BY_ID } from '../src/data/outfits.js';
import { COMMODITY_BY_ID } from '../src/data/commodities.js';
import { SKILL_BY_ID } from '../src/data/skills.js';
import { KARMA_ACTS } from '../src/game/skills.js';
import { BACKGROUNDS, DRIVES } from '../src/data/backgrounds.js';
import { HULL_SCALE } from '../src/data/ships.js';
import { GAME_VERSION } from '../src/data/branding.js';
import {
  SAVE_FILE_FORMAT, SAVE_FILE_VERSION, SAVE_FILE_EXT, SAVE_VERSION,
  buildSaveDocument, saveFileName, exportSlot, parseSaveFile, importSlot, slotInfo, firstEmptySlot,
} from '../src/game/saves.js';
import { GameState } from '../src/game/state.js';
import { levelFromXp } from '../src/game/skills.js';

let bad = 0;
const fail = (msg) => {
  console.log('BAD', msg);
  bad++;
};

const ids = new Set(Object.keys(SYSTEMS));
const chart = readFileSync(new URL('../src/ui/chart.js', import.meta.url), 'utf8');
const layoutBlock = chart.slice(chart.indexOf('const LAYOUT = {'), chart.indexOf('/** Star chart view limits'));
const layout = new Set([...layoutBlock.matchAll(/^\s{2}(\w+): \[/gm)].map((m) => m[1]));

/* ---- lanes ---- */
for (const sys of Object.values(SYSTEMS)) {
  if (!Array.isArray(sys.links) || !sys.links.length) fail(`${sys.id} has no links`);
  for (const to of sys.links || []) {
    if (!ids.has(to)) fail(`${sys.id} links to unknown ${to}`);
    else if (!SYSTEMS[to].links.includes(sys.id)) fail(`${sys.id} -> ${to} is one-way`);
  }
  if (!layout.has(sys.id)) fail(`${sys.id} has no chart position`);
  if (!sys.planets?.length) fail(`${sys.id} has no planets`);
  if (!sys.stations?.length) fail(`${sys.id} has no stations`);
  for (const st of sys.stations || []) {
    if (st.parent && !sys.planets.some((p) => p.name === st.parent)) {
      fail(`${sys.id} station ${st.id} parents unknown world ${st.parent}`);
    }
  }
}

/* ---- the free-fire systems ---- */
const freefire = Object.values(SYSTEMS).filter((s) => s.freefire);
if (freefire.length < 2) fail(`only ${freefire.length} free-fire systems`);
for (const sys of freefire) {
  if (sys.stations.length !== 1) fail(`${sys.id} has ${sys.stations.length} stations, want 1`);
  if (sys.danger.navy > 0) fail(`${sys.id} still has a navy presence`);
  if (sys.danger.pirates < 1) fail(`${sys.id} has too little raider traffic`);
  if (sys.gov !== 'none') fail(`${sys.id} is owned by ${sys.gov} — free-fire ground flies no flag`);
  for (const st of sys.stations) {
    if (st.owner !== 'none') fail(`${sys.id}/${st.id} is owned by ${st.owner} — free-fire stations are unclaimed`);
  }
}
console.log('free-fire systems:', freefire.map((s) => `${s.name} (${s.id})`).join(', '));

/* ---- disruptors and shield-aware weapons ---- */
const kinds = new Set(['laser', 'kinetic', 'beam', 'missile', 'disruptor']);
const disruptors = WEAPONS.filter((w) => w.kind === 'disruptor');
for (const w of WEAPONS) {
  if (!kinds.has(w.kind)) fail(`${w.id} has unknown kind ${w.kind}`);
  if (w.kind === 'disruptor') {
    if (w.disablePower !== disruptors[0].disablePower) fail(`${w.id} snare power differs from the family`);
    if (!(w.speed > 0) || !(w.range > 0)) fail(`${w.id} disruptor needs travel speed and range`);
  }
  if (w.shieldBonus && w.shieldBonus <= 1) fail(`${w.id} shieldBonus is meant to be a bonus`);
  if (w.hullBonus && w.hullBonus <= 1) fail(`${w.id} hullBonus is meant to be a bonus`);
  if (w.kind === 'missile' && !(w.rack > 0 && w.maxAmmo > 0)) fail(`${w.id} missile has no rack size`);
}
if (disruptors.length < 4) fail(`only ${disruptors.length} disruptor variants`);
const power = disruptors[0]?.disablePower;
console.log(`weapons: ${WEAPONS.length} (${disruptors.length} snares, all power ${power})`);

/* ---- shield lattices and the refits that swap them ---- */
for (const id of Object.keys(SHIELD_BY_ID)) {
  const p = SHIELD_BY_ID[id];
  if (!(p.cap > 0) || !(p.regen > 0) || !(p.delay >= 0)) fail(`shield ${id} has nonsense numbers`);
  if (p.disrupt < 0 || p.disrupt > 1) fail(`shield ${id} disrupt resistance out of range`);
  if (p.bleed < 0 || p.bleed > 1) fail(`shield ${id} bleed out of range`);
  if (!p.css?.startsWith('#') || typeof p.color !== 'number') fail(`shield ${id} needs both colours`);
}
for (const o of OUTFITS) {
  if (o.shieldType && !SHIELD_BY_ID[o.shieldType]) fail(`outfit ${o.id} swaps in unknown shield ${o.shieldType}`);
  if (o.stat && !o.add) fail(`outfit ${o.id} declares a stat with no add values`);
}
console.log('shield lattices:', Object.keys(SHIELD_BY_ID).length);

/* ---- karma acts and character cards ---- */
for (const act of KARMA_ACTS) {
  if (!act.delta) fail(`karma act ${act.id} does nothing`);
  if (act.cargo && !COMMODITY_BY_ID[act.cargo.id]) fail(`karma act ${act.id} wants unknown cargo`);
  if (!act.blurb) fail(`karma act ${act.id} has no explanation`);
}
for (const bg of BACKGROUNDS) {
  if (!bg.strengths?.length) fail(`background ${bg.id} lists no strengths`);
  if (!bg.tradeoffs?.length) fail(`background ${bg.id} lists no trade-offs`);
  if (!bg.signature?.name || !bg.signature?.desc) fail(`background ${bg.id} has no signature trait`);
  const p = bg.perks || {};
  for (const [id, level] of Object.entries(p.outfits || {})) {
    if (!OUTFIT_BY_ID[id]) fail(`background ${bg.id} grants unknown outfit ${id}`);
    if (!(level > 0)) fail(`background ${bg.id} grants outfit ${id} at level ${level}`);
  }
  for (const [id, rank] of Object.entries(p.skills || {})) {
    if (!SKILL_BY_ID[id]) fail(`background ${bg.id} grants unknown skill ${id}`);
    if (!(rank > 0)) fail(`background ${bg.id} grants skill ${id} at rank ${rank}`);
  }
  if (p.weapons && !WEAPON_BY_ID[p.weapons.id]) fail(`background ${bg.id} grants unknown weapon ${p.weapons.id}`);
  for (const [id, qty] of Object.entries(p.cargo || {})) {
    if (!COMMODITY_BY_ID[id]) fail(`background ${bg.id} grants unknown cargo ${id}`);
    if (!(qty > 0)) fail(`background ${bg.id} grants ${qty} of ${id}`);
  }
}
for (const d of DRIVES) {
  if (!d.boon || !d.cost) fail(`drive ${d.id} does not spell out its boon and cost`);
}
console.log('character starts:', BACKGROUNDS.length, 'backgrounds,', DRIVES.length, 'drives');
/* ---- the .os save file ---- */
{
  // a browser-shaped store, so the export can be read back the way the game
  // reads a berth
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
  };

  // the format and its version are what old files are read by: changing either
  // silently orphans every .os file already out there
  if (SAVE_FILE_FORMAT !== 'oldspace.save') fail(`the save file format is now "${SAVE_FILE_FORMAT}" — old .os files will not read`);
  if (SAVE_FILE_VERSION !== 1) fail(`the save file version is now ${SAVE_FILE_VERSION} — old .os files will not read`);
  if (SAVE_FILE_EXT !== '.os') fail(`save files are named ${SAVE_FILE_EXT}`);

  // a real log, built the way the game builds one
  const live = GameState.fromJSON({
    version: SAVE_VERSION,
    commander: 'Tess "Ace" O\u2019Brien',
    shipId: 'wayfarer',
    shipName: 'Glory',
    credits: 12345,
    day: 42,
    playtime: 3671,
    systemId: 'haven',
    xp: 4800,
    missionsDone: 11,
    integrity: { hull: 233, shield: 150 },
    rep: { free: 12, combine: -3, vigil: 0, reaver: -18, kreth: 4 },
  });
  const state = live.toJSON();
  const payload = {
    version: SAVE_VERSION,
    savedAt: Date.UTC(2026, 9, 4, 19, 0, 0),
    meta: { commander: state.commander, shipName: state.shipName, credits: state.credits, systemId: state.systemId, day: state.day, playtime: state.playtime },
    state,
  };

  const doc = buildSaveDocument(payload, { slot: 3, now: Date.UTC(2026, 9, 4, 19, 0, 0) });
  if (!doc) fail('a real log could not be wrapped as a .os document');
  else {
    if (doc.format !== SAVE_FILE_FORMAT) fail(`a .os document calls itself "${doc.format}"`);
    if (doc.fileVersion !== SAVE_FILE_VERSION) fail('a .os document carries the wrong file version');
    if (doc.saveVersion !== SAVE_VERSION) fail('a .os document does not say which save layout it holds');
    if (!doc.game || !doc.gameVersion) fail('a .os document does not say which game and build wrote it');
    if (!doc.exportedAt || !Number.isFinite(Date.parse(doc.exportedAt))) fail(`a .os document has no usable export date (${doc.exportedAt})`);
    if (doc.sourceSlot !== 3) fail('a .os document does not remember the berth it came from');
    if (JSON.stringify(doc.state) !== JSON.stringify(state)) fail('a .os document does not carry the state untouched');
    // the summary is what a reader who has never seen this build can show
    const s = doc.summary;
    if (s.commander !== state.commander) fail('the summary loses the commander name');
    if (s.day !== 42 || s.credits !== 12345 || s.playtime !== 3671) fail('the summary loses the log standing');
    if (s.level !== levelFromXp(state.xp)) fail(`the summary says level ${s.level}, the curve says ${levelFromXp(state.xp)}`);
    if (s.systemName !== SYSTEMS.haven.name) fail(`the summary names the system "${s.systemName}"`);
    if (s.rep.reaver !== -18) fail('the summary loses the reputation books');
    if (s.hull !== state.integrity.hull || s.shield !== state.integrity.shield) fail('the summary loses the hull and shields');
    if (s.missionsDone !== 11) fail('the summary loses the contract count');
    const name = saveFileName(doc);
    if (!name.endsWith(SAVE_FILE_EXT) || name.endsWith(`-${SAVE_FILE_EXT}`)) fail(`a .os file is named "${name}"`);
    if (!/^[a-z0-9.-]+\.os$/.test(name)) fail(`a .os file name is not safe for a file system: "${name}"`);
    if (!name.includes('day42')) fail(`a .os file name does not say where the log stands: "${name}"`);
    if (!name.includes(`v${GAME_VERSION}`)) fail(`a .os file name does not say which build wrote it: "${name}"`);
  }

  // berth -> text -> berth, with nothing of the log lost on the way
  const written = importSlot(4, { ...parseSaveFile(JSON.stringify(doc)).data });
  if (!written.ok) fail(`a .os document would not go into a berth: ${written.error}`);
  const back = exportSlot(4, { now: Date.UTC(2026, 9, 4, 19, 5, 0) });
  if (!back.ok) fail(`a berth would not export: ${back.error}`);
  else {
    const reread = parseSaveFile(back.text);
    if (!reread.ok) fail(`a file this build wrote would not read back: ${reread.error}`);
    else if (JSON.stringify(reread.data.state) !== JSON.stringify(state)) {
      fail('a log changed on the way out of the berth and back');
    }
    const info = slotInfo(4);
    if (info.empty) fail('a berth written from a .os file reads as empty');
    else {
      if (info.commander !== state.commander) fail(`the berth shows "${info.commander}"`);
      if (info.day !== 42 || info.credits !== 12345) fail('the berth does not show the log standing');
      if (!info.imported) fail('a berth does not remember that its log was recovered');
    }
  }
  if (firstEmptySlot() !== 1) fail(`the first free berth reads as ${firstEmptySlot()}`);

  // the shapes a file can arrive in
  const shapes = [
    ['the document this build writes', JSON.stringify(doc)],
    ['a bare stored payload', JSON.stringify(payload)],
    ['a bare state, written out by hand', JSON.stringify(state)],
  ];
  for (const [what, text] of shapes) {
    const res = parseSaveFile(text);
    if (!res.ok) fail(`${what} would not read: ${res.error}`);
    else if (JSON.stringify(res.data.state) !== JSON.stringify(state)) fail(`${what} does not read back as the same log`);
    else if (res.warnings.length) fail(`${what} warns about itself: ${res.warnings[0]}`);
  }

  // and the shapes that are not logs at all
  const junk = [
    ['', 'empty'],
    ['   ', 'blank'],
    ['not json at all', 'not json'],
    ['[]', 'an array'],
    ['{}', 'an empty object'],
    ['{"format":"something.else","state":{}}', 'another format'],
    ['{"state":5}', 'a state that is not an object'],
    ['{"state":[]}', 'a state that is an array'],
    ['{"hello":"there"}', 'an object with nothing in it'],
    ['null', 'null'],
  ];
  for (const [text, what] of junk) {
    const res = parseSaveFile(text);
    if (res.ok) fail(`${what} was accepted as a log`);
    else if (!res.error) fail(`${what} was refused without saying why`);
  }

  // a file from a newer build is read anyway: what it added is simply missing
  const future = JSON.parse(JSON.stringify(doc));
  future.fileVersion = SAVE_FILE_VERSION + 4;
  future.gameVersion = '99.4';
  future.saveVersion = SAVE_VERSION + 3;
  const futureRes = parseSaveFile(JSON.stringify(future), { from: 'from-a-later-build.os' });
  if (!futureRes.ok) fail('a log from a newer build was refused rather than read as best it can');
  else {
    if (futureRes.warnings.length < 2) fail('a log from a newer build imports without warning the pilot');
    if (futureRes.data.from !== 'from-a-later-build.os') fail('an imported log does not remember the file it came from');
    if (JSON.stringify(futureRes.data.state) !== JSON.stringify(state)) fail('a newer log was altered on the way in');
  }

  // an old log keeps its own version, so the migrations still recognise it
  const v1 = JSON.parse(JSON.stringify(state));
  v1.version = 1;
  v1.integrity = { hull: Math.round(233 / HULL_SCALE), shield: Math.round(150 / HULL_SCALE) };
  const v1res = parseSaveFile(JSON.stringify({ version: 1, meta: payload.meta, state: v1 }));
  if (!v1res.ok) fail(`a v1 log would not read: ${v1res.error}`);
  else {
    if (v1res.data.state.version !== 1) fail('a v1 log was stamped with the current save version instead of its own');
    const migrated = GameState.fromJSON(v1res.data.state);
    if (Math.abs(migrated.integrity.hull - 233) > 1) {
      fail(`a v1 log's hull came back as ${migrated.integrity.hull}, not the 233 it was written with`);
    }
  }
  // and a v1 log with no stamp of its own takes the one the file declares
  const unstamped = JSON.parse(JSON.stringify(state));
  unstamped.version = 1;
  delete unstamped.version;
  unstamped.integrity = { hull: Math.round(233 / HULL_SCALE), shield: Math.round(150 / HULL_SCALE) };
  const unstampedRes = parseSaveFile(JSON.stringify({ version: 1, state: unstamped }));
  if (!unstampedRes.ok) fail('a stamped-only v1 log would not read');
  else if (unstampedRes.data.state.version !== 1) fail('a v1 log with no stamp of its own is not told what it is');

  delete globalThis.localStorage;
  console.log('save files:', `${SAVE_FILE_FORMAT} v${SAVE_FILE_VERSION}`, `${SAVE_FILE_EXT}`, `build v${GAME_VERSION}`);
}

console.log(`systems: ${ids.size}  charted: ${layout.size}  bad: ${bad}`);
process.exit(bad ? 1 : 0);
