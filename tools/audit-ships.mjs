// Ship table audit: the great keels, the yards that carry them and the order
// the boards are read in.
//
//   node tools/audit-ships.mjs
//
// The ship table is the one file every other system reads — the yard, the AI,
// the prize rules, the fleet roster and every save. A duplicate id silently
// deletes a hull, a shape with no case in meshes.js silently becomes the generic
// warship, and a yard rule that is a little too generous quietly puts a
// battleship on a backwater slip. None of that throws, so it is checked here.
import { readFileSync } from 'node:fs';
import { SHIPS, SHIP_BY_ID, CAPITAL_SHIPS, CAPITAL_PRICE, PORT_PRICE, yardTier, yardStock } from '../src/data/ships.js';
import { WEAPON_BY_ID } from '../src/data/weapons.js';
import { SYSTEMS } from '../src/data/systems.js';
import { SHIP_SORTS, DEFAULT_SORT, sortShips, nextSort } from '../src/data/shipSort.js';

let bad = 0;
const fail = (msg) => {
  console.log('BAD', msg);
  bad++;
};

const meshes = readFileSync(new URL('../src/core/meshes.js', import.meta.url), 'utf8');
const shapeCases = new Set([...meshes.matchAll(/^\s+case '([a-z]+)':/gm)].map((m) => m[1]));
if (shapeCases.size < 40) fail(`meshes.js only defines ${shapeCases.size} hull shapes`);

/* ---- the table itself ---- */
{
  const ids = new Map();
  const names = new Map();
  for (const s of SHIPS) {
    ids.set(s.id, (ids.get(s.id) || 0) + 1);
    names.set(s.name, (names.get(s.name) || 0) + 1);
    if (!s.id || !s.name || !s.cls) fail(`a hull in the table has no id, name or class (${s.id})`);
    if (!(s.price >= 0) || !(s.hull > 0) || !(s.shield >= 0)) fail(`${s.id} has no sane price, hull or shields`);
    if (!shapeCases.has(s.shape)) fail(`${s.id} flies shape "${s.shape}", which meshes.js has no case for`);
    if (s.variant && !new RegExp(`def\\.variant === '${s.variant}'`).test(meshes)) {
      fail(`${s.id} asks for variant "${s.variant}", which its shape ignores`);
    }
    for (const w of s.defaultWeapons || []) {
      if (w && !WEAPON_BY_ID[w]) fail(`${s.id} lists unknown weapon ${w}`);
    }
    if ((s.mounts ?? 2) > (s.maxMounts ?? s.mounts ?? 2)) fail(`${s.id} has more mounts than it can ever fit`);
    if ((s.bays ?? 0) > (s.maxBays ?? s.bays ?? 0)) fail(`${s.id} has more bays than it can ever fit`);
    if (SHIP_BY_ID[s.id] !== s) fail(`${s.id} is not the hull the table hands back for its own id`);
  }
  for (const [id, n] of ids) if (n > 1) fail(`${n} hulls share the id "${id}" — all but the last are unreachable`);
  for (const [name, n] of names) if (n > 1) fail(`${n} hulls share the name "${name}"`);
  if (Object.keys(SHIP_BY_ID).length !== SHIPS.length) {
    fail(`the table holds ${SHIPS.length} hulls but only ${Object.keys(SHIP_BY_ID).length} ids resolve`);
  }
}

/* ---- the ten great keels ---- */
{
  if (CAPITAL_SHIPS.length !== 10) fail(`${CAPITAL_SHIPS.length} hulls claim the great-keel register, want 10`);

  // what the yards sold before them, as the ceiling they have to clear
  const rest = SHIPS.filter((s) => s.yard !== 'capital');
  const topPrice = Math.max(...rest.map((s) => s.price));
  const topHull = Math.max(...rest.map((s) => s.hull));
  const topShield = Math.max(...rest.map((s) => s.shield));

  for (const s of CAPITAL_SHIPS) {
    if (s.price <= topPrice) fail(`${s.name} costs ${s.price}, no more than the best hull already on sale`);
    if (s.hull <= topHull) fail(`${s.name} carries ${s.hull} hull, no more than the best hull already on sale`);
    if (s.shield <= topShield) fail(`${s.name} carries ${s.shield} shield, no more than the best hull already on sale`);
    if (s.minTech !== 10) fail(`${s.name} asks for tech ${s.minTech} — the great keels belong to the top tech`);
    if (s.capture || s.unique || s.yards) fail(`${s.name} is not an ordinary order — great keels are sold, not licensed`);
    if ((s.mounts ?? 0) < 6 || (s.maxMounts ?? 0) < 9) fail(`${s.name} carries only ${s.mounts}/${s.maxMounts} mounts`);
    if ((s.bays ?? 0) < 2) fail(`${s.name} has no hangar worth the name`);
    if (!s.desc || s.desc.length < 60) fail(`${s.name} has no lines written for it`);
    const shape = shapeCases.has(s.shape);
    if (!shape) fail(`${s.name} flies shape "${s.shape}", which meshes.js has no case for`);
  }

  // the register has to be a ladder, not a pile: the dearest is the toughest
  const byPrice = [...CAPITAL_SHIPS].sort((a, b) => a.price - b.price);
  if (byPrice[byPrice.length - 1].hull !== Math.max(...CAPITAL_SHIPS.map((s) => s.hull))) {
    fail('the dearest great keel is not the toughest one');
  }
  const spread = byPrice[byPrice.length - 1].price - byPrice[0].price;
  if (spread < byPrice[0].price) fail(`the great keels span only ₡${spread.toLocaleString()}`);
  // and a fleet has to grow into them: ten hulls on five different price steps
  const steps = new Set(byPrice.map((s) => Math.round(s.price / 1000000)));
  if (steps.size < 8) fail(`the ten great keels sit on only ${steps.size} price steps`);
}

/* ---- the yards ---- */
{
  const stations = [];
  for (const sys of Object.values(SYSTEMS)) {
    for (const st of sys.stations || []) {
      if ((st.services || []).includes('shipyard')) stations.push({ sys, st });
    }
  }
  if (stations.length < 10) fail(`only ${stations.length} berths have a shipyard at all`);

  const sellable = SHIPS.filter((s) => !s.capture);
  const tierCounts = { outpost: 0, port: 0, capital: 0 };
  const stockCount = [];
  for (const { sys, st } of stations) {
    const tier = yardTier(sys, st);
    tierCounts[tier]++;
    let n = 0;
    for (const s of sellable) if (yardStock(s, sys, st) !== 'unstocked') n++;
    stockCount.push({ sys, st, tier, n, tech: sys.tech });
    if (!n) fail(`${sys.id}/${st.id} has a shipyard and nothing on the slips`);
    // a yard must never admit to a hull it cannot fit out
    for (const s of sellable) {
      const stock = yardStock(s, sys, st);
      if (stock === 'gated' && s.minTech <= sys.tech) {
        fail(`${sys.id}/${st.id} hides a ${s.name} it could actually fit out`);
      }
      if (stock === 'stocked' && s.minTech > sys.tech) {
        fail(`${sys.id}/${st.id} would sell a ${s.name} above its own tech`);
      }
    }
  }
  if (!tierCounts.capital) fail('no berth in the galaxy is a great port');
  if (tierCounts.capital > stations.length / 2) fail(`${tierCounts.capital} of ${stations.length} yards are great ports`);

  const great = stockCount.filter((s) => s.tier === 'capital').sort((a, b) => b.n - a.n);
  const small = stockCount.filter((s) => s.tier !== 'capital').sort((a, b) => b.n - a.n);
  if (!great.length || !small.length) fail('the yards do not split into great ports and the rest');
  else {
    // only a great port carries everything, and nothing smaller gets close
    if (great[0].n < sellable.length - SHIPS.filter((s) => s.yards || s.unique).length) {
      fail(`the best yard carries ${great[0].n} hulls of ${sellable.length} — no berth stocks them all`);
    }
    if (small[0].n >= great[0].n) fail('a lesser yard stocks as much as a great port');
  }

  // every great keel must be obtainable somewhere, or it is a museum piece
  for (const s of CAPITAL_SHIPS) {
    const where = stations.filter(({ sys, st }) => yardStock(s, sys, st) === 'stocked');
    if (!where.length) fail(`no yard in the galaxy stocks a ${s.name}`);
    else if (where.length > 6) fail(`${where.length} yards stock a ${s.name} — a great keel is ordered, not stocked`);
    // and never out of a backwater
    for (const { sys, st } of where) {
      if (yardTier(sys, st) !== 'capital') fail(`${s.name} is on the slips at ${sys.id}/${st.id}, which is no great port`);
    }
  }

  // the hulls everybody else flies do not need the great ports
  const smallOnly = sellable.filter((s) => !s.yard && !s.yards && !s.unique && s.minTech <= 5);
  for (const s of smallOnly) {
    const where = stations.filter(({ sys, st }) => yardStock(s, sys, st) !== 'unstocked');
    if (!where.length) fail(`a light hull (${s.name}) is not on sale anywhere`);
  }

  // line capitals never sit on a lesser slip, however well stocked the counter is
  for (const { sys, st, tier } of stockCount) {
    if (tier === 'capital') continue;
    for (const s of sellable) {
      if (s.yard === 'capital') continue;
      if ((s.price || 0) < CAPITAL_PRICE) continue;
      if (yardStock(s, sys, st) !== 'unstocked') fail(`${sys.id}/${st.id} (a ${tier}) stocks the line capital ${s.name}`);
    }
    if (tier === 'outpost') {
      for (const s of sellable) {
        if ((s.price || 0) >= PORT_PRICE && yardStock(s, sys, st) !== 'unstocked') {
          fail(`${sys.id}/${st.id} (an outpost) stocks the ${s.name} at ${s.price}`);
        }
      }
    }
  }

  // and the sheet is hidden until the berth can fit her out
  const gatedKeels = stations.filter(({ sys, st }) => CAPITAL_SHIPS.some((s) => yardStock(s, sys, st) === 'gated'));
  if (!gatedKeels.length) fail('no great port declines to quote a great keel — the redaction path is never exercised');
  for (const { sys, st } of gatedKeels) {
    if (yardTier(sys, st) !== 'capital') fail(`${sys.id}/${st.id} hides a great keel and is no great port`);
    if (CAPITAL_SHIPS.some((s) => yardStock(s, sys, st) === 'stocked')) {
      fail(`${sys.id}/${st.id} both stocks and hides great keels`);
    }
  }
  const soldKeels = stations.filter(({ sys, st }) => CAPITAL_SHIPS.some((s) => yardStock(s, sys, st) === 'stocked'));
  if (!soldKeels.length) fail('no yard will quote a great keel at all');
}

/* ---- the order the boards are read in ---- */
{
  if (SHIP_SORTS.length < 6) fail(`the yard board offers only ${SHIP_SORTS.length} ways to sort it`);
  if (!SHIP_SORTS.some((s) => s.key === DEFAULT_SORT.key)) fail('the default sort is not one of the ways to sort it');

  const list = SHIPS.filter((s) => !s.capture).slice(0, 40);
  for (const spec of SHIP_SORTS) {
    const asc = sortShips(list, { key: spec.key, dir: 1 });
    const desc = sortShips(list, { key: spec.key, dir: -1 });
    if (asc.length !== list.length) fail(`sorting by ${spec.key} lost or gained hulls`);
    const keys = (rows) => rows.map((s) => spec.value(s));
    const seq = keys(asc);
    for (let i = 1; i < seq.length; i++) {
      const a = seq[i - 1];
      const b = seq[i];
      const d = typeof a === 'string' ? a.toLowerCase().localeCompare(b.toLowerCase()) : a - b;
      if (d > 0) fail(`the ${spec.key} board is out of order at row ${i}`);
    }
    if (JSON.stringify(keys(desc)) !== JSON.stringify([...seq].reverse())) {
      fail(`sorting by ${spec.key} does not reverse when the arrow is flipped`);
    }
    // sorting must not depend on the order the table happens to be in
    const shuffled = [...list].sort(() => Math.random() - 0.5);
    if (JSON.stringify(sortShips(shuffled, { key: spec.key, dir: 1 })) !== JSON.stringify(asc)) {
      fail(`the ${spec.key} board depends on the order the table is read in`);
    }
  }
  // a click on the bar flips the arrow, or takes the key's own default
  const flipped = nextSort({ key: 'price', dir: -1 }, 'price');
  if (flipped.dir !== 1) fail('clicking the selected sort does not flip it');
  const fresh = nextSort({ key: 'price', dir: -1 }, 'name');
  if (fresh.key !== 'name' || fresh.dir !== 1) fail('choosing a new sort does not take its own direction');
  if (nextSort({ key: 'price', dir: -1 }, 'nonsense').key !== 'price') {
    fail('an unknown sort key replaces the board order with nothing');
  }
  console.log('ship board:', SHIP_SORTS.length, 'sorts ·', CAPITAL_SHIPS.length, 'great keels ·', SHIPS.length, 'hulls');
}

console.log(`ships: ${SHIPS.length}  great keels: ${CAPITAL_SHIPS.length}  shapes: ${shapeCases.size}  bad: ${bad}`);
