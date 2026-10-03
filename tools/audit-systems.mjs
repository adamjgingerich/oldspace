// Data integrity audit for the systems added for the melee rings, the shield
// lattices, the disruptor family, the karma acts and the character cards.
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

/* ---- the melee rings ---- */
const melee = Object.values(SYSTEMS).filter((s) => s.melee);
if (melee.length < 2) fail(`only ${melee.length} melee systems`);
for (const sys of melee) {
  if (sys.stations.length !== 1) fail(`${sys.id} melee ring has ${sys.stations.length} stations, want 1`);
  if (sys.danger.navy > 0) fail(`${sys.id} melee ring still has a navy presence`);
  if (sys.danger.pirates < 1) fail(`${sys.id} melee ring has too little contender traffic`);
  if (sys.gov !== 'free') fail(`${sys.id} melee ring is owned by ${sys.gov}`);
}
console.log('melee rings:', melee.map((s) => `${s.name} (${s.id})`).join(', '));

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
console.log(`systems: ${ids.size}  charted: ${layout.size}  bad: ${bad}`);
process.exit(bad ? 1 : 0);
