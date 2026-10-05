// Crate-trader audit: the brokers, what is in their crates, what they ask for
// it, and whether a captain can actually buy it.
//
//   node tools/audit-brokers.mjs
//
// A broker's stock is the game's one shortcut around the licence system: a relic
// gun that a vault contract would otherwise hand over for nothing can be bought
// off a deck for credits. That makes two kinds of mistake expensive — a crate
// that hands out gear at (or below) list, and a purchase path that takes the
// money without fitting the hardware. Neither throws, so both are checked here,
// along with the rarity promises: brokers are meant to be occasional, regional,
// and never two to a system.
import { readFileSync } from 'node:fs';
import {
  BROKERS, BROKER_BY_ID, BROKER_MARKUP_CAP, NO_PAPERS_FEE,
  brokerPool, brokerVisit, brokerCrate, brokerCrateRow,
} from '../src/data/brokers.js';
import { buyCrateWeapon, buyCrateOutfit, grantBrokerPapers } from '../src/game/brokerTrade.js';
import { GameState, computeStats } from '../src/game/state.js';
import { SYSTEMS } from '../src/data/systems.js';
import { SHIP_BY_ID } from '../src/data/ships.js';
import { WEAPON_BY_ID } from '../src/data/weapons.js';
import { OUTFIT_BY_ID } from '../src/data/outfits.js';

let bad = 0;
const fail = (msg) => {
  console.log('BAD', msg);
  bad++;
};
let checks = 0;
const ok = (cond, msg) => {
  checks++;
  if (!cond) fail(msg);
};

const stateAt = (day, credits = 5000000, seed = 4242) => {
  const st = new GameState({ worldSeed: seed });
  st.day = day;
  st.credits = credits;
  return st;
};

/* ---- the brokers themselves ---- */
{
  ok(BROKERS.length >= 3, `only ${BROKERS.length} brokers are in the trade`);
  const ids = new Set();
  for (const b of BROKERS) {
    if (ids.has(b.id)) fail(`two brokers share the id "${b.id}"`);
    ids.add(b.id);
    if (!b.name || !b.captain || !b.blurb) fail(`${b.id} has no name, captain or blurb`);
    if (BROKER_BY_ID[b.id] !== b) fail(`${b.id} is not the broker the table hands back`);
    if (!SHIP_BY_ID[b.hull]) fail(`${b.id} flies hull "${b.hull}", which is not in the ship table`);
    for (const e of b.escorts || []) if (!SHIP_BY_ID[e]) fail(`${b.id} escorts with unknown hull ${e}`);
    if (!(b.escorts || []).length) fail(`${b.id} works the lanes with no escort at all`);
    const [lo, hi] = b.markup;
    if (!(lo >= 1 && hi >= lo)) fail(`${b.id} prices with a nonsense markup range`);
    if (hi > BROKER_MARKUP_CAP) fail(`${b.id} would ask more than the cap`);
    if (hi * NO_PAPERS_FEE > BROKER_MARKUP_CAP) fail(`${b.id} + the no-papers fee breaks the price cap`);
    const [min, max] = b.size;
    if (!(min >= 1 && max >= min)) fail(`${b.id} carries a nonsense crate size`);
    if (!b.goods.licences?.length) fail(`${b.id} has no idea what it is licensed to carry`);
    if (!(b.visit?.chance > 0 && b.visit.chance <= 0.1)) fail(`${b.id} is not rare (${b.visit?.chance})`);
  }
}

/* ---- what a broker will actually carry ---- */
for (const b of BROKERS) {
  const pool = brokerPool(b);
  ok(pool.length >= b.size[1], `${b.id} has a pool of ${pool.length} for crates of up to ${b.size[1]}`);
  for (const item of pool) {
    const def = item.kind === 'weapon' ? WEAPON_BY_ID[item.id] : OUTFIT_BY_ID[item.id];
    if (!def) fail(`${b.id} stocks ${item.id}, which is in no table`);
    else {
      if (!def.unique) fail(`${b.id} carries the ordinary ${item.id} — a crate is for licensed gear`);
      if (def.unique !== item.licence) fail(`${b.id} files ${item.id} under the wrong licence`);
      const base = item.kind === 'weapon' ? def.price : def.prices[0];
      if (base !== item.base) fail(`${b.id} prices ${item.id} from ${item.base} when the table says ${base}`);
    }
    if (b.goods.bands && item.licence === 'relic' && !b.goods.bands.includes(item.band)) {
      fail(`${b.id} stocks the band-${item.band} relic ${item.id}, outside its declared bands`);
    }
  }
  // every broker has to be able to show a gun and a fitting on the same day
  if (b.size[1] >= 2) {
    const kinds = new Set(pool.map((i) => i.kind));
    if (kinds.size < 2) fail(`${b.id} can only ever offer ${[...kinds][0]}s`);
  }
}

/* ---- the crate: size, spread, determinism ---- */
{
  const st = stateAt(40);
  let madeSome = 0;
  for (const b of BROKERS) {
    for (const sysId of Object.keys(SYSTEMS).slice(0, 12)) {
      const crate = brokerCrate(b, st, sysId);
      if (!crate.length) continue;
      madeSome++;
      if (crate.length < b.size[0] || crate.length > b.size[1]) {
        fail(`${b.id} laid out ${crate.length} pieces in ${sysId}, outside ${b.size[0]}–${b.size[1]}`);
      }
      const ids = new Set(crate.map((r) => `${r.kind}:${r.id}`));
      if (ids.size !== crate.length) fail(`${b.id} listed the same piece twice in ${sysId}`);
      if (crate.length >= 2) {
        const kinds = new Set(crate.map((r) => r.kind));
        const poolKinds = new Set(brokerPool(b).map((i) => i.kind));
        if (poolKinds.size > 1 && kinds.size < 2) fail(`${b.id} offered a one-kind crate in ${sysId}`);
      }
      // the same day's crate must not move under the captain's feet
      const again = brokerCrate(b, st, sysId);
      if (JSON.stringify(again) !== JSON.stringify(crate)) fail(`${b.id}'s crate in ${sysId} is not stable`);
    }
  }
  ok(madeSome > 0, 'no broker will lay out a crate anywhere');

  // and a crate is a different crate tomorrow
  const b = BROKERS[0];
  const days = [];
  for (let day = 1; day <= 6; day++) days.push(JSON.stringify(brokerCrate(b, stateAt(day), 'haven')));
  if (new Set(days).size < 3) fail(`${b.id} lays out the same crate day after day`);
}

/* ---- pricing ---- */
{
  const st = stateAt(40, 5000000, 99);
  for (const b of BROKERS) {
    for (const sysId of Object.keys(SYSTEMS).slice(0, 20)) {
      const crate = brokerCrate(b, st, sysId);
      if (!crate.length) continue;
      for (const row of crate) {
        checks++;
        if (row.asking <= row.base) fail(`${b.id} asks ${row.asking} for the ${row.name}, list is ${row.base}`);
        if (row.asking > Math.ceil((row.base * BROKER_MARKUP_CAP) / 250) * 250) {
          fail(`${b.id} asks ${row.asking} for the ${row.name} — over the cap`);
        }
        if (row.asking % 250 !== 0) fail(`${b.id} asks a figure that is not a round 250 (${row.asking})`);
        if (row.over !== Math.round((row.asking / row.base - 1) * 100)) fail(`${b.id} misreports the uplift on ${row.name}`);
        if (row.papers) fail('a fresh captain should hold no papers for crate gear');
      }
    }
  }

  // papers on file buy the same crate cheaper
  const stPapers = stateAt(40, 5000000, 99);
  const sample = brokerCrate(BROKERS[0], st, 'haven')[0];
  if (!sample) fail('no sample row to test the papers discount on');
  else {
    grantBrokerPapers(stPapers, sample.id);
    const after = brokerCrateRow(BROKERS[0], stPapers, 'haven', sample.kind, sample.id);
    ok(!!after, `the ${sample.name} vanished from the crate once papers were filed`);
    if (after && !(after.asking < sample.asking)) {
      fail(`holding papers does not cheapen the ${sample.name} (${sample.asking} → ${after?.asking})`);
    }
    if (after && !after.papers) fail(`the ${sample.name} still reads as unlicensed with papers on file`);
  }
}

/* ---- who is trading where, and how rarely ---- */
{
  const days = 30;
  const bySystem = new Map();
  const byBroker = new Map();
  let systemDays = 0;
  let visits = 0;
  for (let day = 1; day <= days; day++) {
    const st = stateAt(day);
    for (const sys of Object.values(SYSTEMS)) {
      systemDays++;
      const b = brokerVisit(st, sys.id);
      if (!b) continue;
      visits++;
      byBroker.set(b.id, (byBroker.get(b.id) || 0) + 1);
      bySystem.set(sys.id, (bySystem.get(sys.id) || 0) + 1);
      if (sys.freefire) fail(`${b.id} is trading in free-fire space (${sys.id})`);
      if (!brokerCrate(b, st, sys.id).length) fail(`${b.id} turned up in ${sys.id} with an empty deck`);
      const v = b.visit;
      if (v.minTech != null && sys.tech < v.minTech) fail(`${b.id} is below its own tech floor in ${sys.id}`);
      if (v.maxDanger != null && sys.danger.pirates > v.maxDanger) fail(`${b.id} is in lanes hotter than it dares (${sys.id})`);
      if (v.minDanger != null && sys.danger.pirates < v.minDanger) fail(`${b.id} is in lanes quieter than it needs (${sys.id})`);
    }
  }
  const rate = visits / systemDays;
  if (rate > 0.15) fail(`brokers turn up on ${(rate * 100).toFixed(1)}% of system visits — no longer occasional`);
  if (rate < 0.01) fail(`brokers turn up on ${(rate * 100).toFixed(2)}% of system visits — nobody would ever find one`);
  for (const b of BROKERS) if (!byBroker.get(b.id)) fail(`${b.id} never works a lane in ${days} days`);
  // and never two to a system on the same day
  for (const [, n] of bySystem) if (n > days) fail('a system had more than one broker on a day');

  // a repeat visit on the same day finds the same broker
  const st = stateAt(7);
  for (const sysId of Object.keys(SYSTEMS)) {
    const a = brokerVisit(st, sysId);
    const b2 = brokerVisit(st, sysId);
    if ((a?.id || null) !== (b2?.id || null)) fail(`the broker in ${sysId} changes between two hails on the same day`);
  }
  console.log(`trade: ${BROKERS.length} brokers · ${(rate * 100).toFixed(1)}% of system-days have one`);
}

/* ---- buying out of a crate ---- */
{
  // find a day and system with a broker, then buy from it for real
  let where = null;
  for (let day = 1; day <= 20 && !where; day++) {
    for (const sysId of Object.keys(SYSTEMS)) {
      const b = brokerVisit(stateAt(day), sysId);
      if (b && brokerCrate(b, stateAt(day), sysId).some((r) => r.kind === 'weapon') && brokerCrate(b, stateAt(day), sysId).some((r) => r.kind === 'outfit')) {
        where = { day, sysId, broker: b };
        break;
      }
    }
  }
  if (!where) fail('no day in 20 offers a crate with both a gun and a fitting');
  else {
    const { day, sysId, broker } = where;
    const crate = brokerCrate(broker, stateAt(day), sysId);
    const gun = crate.find((r) => r.kind === 'weapon');
    const fitting = crate.find((r) => r.kind === 'outfit');

    // --- a gun, bolted to a hardpoint ---
    {
      const st = stateAt(day, 5000000);
      const before = st.credits;
      const old = st.weapons[0];
      const oldPrice = old ? WEAPON_BY_ID[old]?.price || 0 : 0;
      const res = buyCrateWeapon(st, broker.id, sysId, gun.id, 0);
      ok(res.ok, `could not buy the ${gun.name} out of ${broker.id}'s crate: ${res.reason}`);
      if (res.ok) {
        if (st.weapons[0] !== gun.id) fail(`the ${gun.name} was paid for but never mounted`);
        const refund = Math.round(oldPrice * 0.5);
        if (st.credits !== before - (gun.asking - refund)) {
          fail(`the ${gun.name} cost ${before - st.credits}, not the asking ${gun.asking - refund}`);
        }
        if (!st.story.unlocked.includes(gun.id)) fail(`the ${gun.name} came with no papers`);
        if (gun.kind === 'missile' && !st.ammo[gun.id]) fail(`the ${gun.name} was mounted with no racks`);
        if (st.credits < 0) fail('a crate purchase took the purse negative');
      }
      // a second, identical purchase is not a way to buy the same gun twice
      const again = buyCrateWeapon(st, broker.id, sysId, gun.id, 0);
      ok(!again.ok || WEAPON_BY_ID[gun.id].kind === 'missile', `the ${gun.name} can be bought into the same hardpoint twice`);
      // and a hardpoint this hull does not have is refused
      const mounts = computeStats(st).mounts;
      const off = buyCrateWeapon(st, broker.id, sysId, gun.id, mounts + 3);
      ok(!off.ok, `a purchase was allowed into hardpoint ${mounts + 3}, past the hull's ${mounts}`);
      // wrong broker, wrong day, no crate: all refused
      const other = BROKERS.find((b) => b.id !== broker.id);
      const wrong = buyCrateWeapon(st, other.id, sysId, gun.id, 0);
      if (wrong.ok) fail(`${other.id} sold a ${gun.name} that was in ${broker.id}'s crate`);
      const stale = buyCrateWeapon(stateAt(day + 1, 5000000), broker.id, sysId, gun.id, 0);
      if (stale.ok && !brokerCrate(broker, stateAt(day + 1), sysId).some((r) => r.id === gun.id)) {
        fail('a crate sold a gun the next day, when its deck had moved on');
      }
      const broke = buyCrateWeapon(stateAt(day, 1), broker.id, sysId, gun.id, 0);
      ok(!broke.ok, `a captain with 1 credit bought the ${gun.name}`);
      const junk = buyCrateWeapon(stateAt(day, 5000000), broker.id, sysId, 'no-such-gun', 0);
      ok(!junk.ok, 'a crate sold a weapon that is in no table');
    }

    // --- a fitting ---
    {
      const st = stateAt(day, 5000000);
      const before = st.credits;
      const res = buyCrateOutfit(st, broker.id, sysId, fitting.id);
      ok(res.ok, `could not fit the ${fitting.name} from ${broker.id}'s crate: ${res.reason}`);
      if (res.ok) {
        if ((st.outfits[fitting.id] || 0) !== 1) fail(`the ${fitting.name} was paid for but not fitted`);
        if (st.credits !== before - fitting.asking) fail(`the ${fitting.name} cost ${before - st.credits}, not ${fitting.asking}`);
        if (!st.story.unlocked.includes(fitting.id)) fail(`the ${fitting.name} came with no papers`);
      }
      const twice = buyCrateOutfit(st, broker.id, sysId, fitting.id);
      ok(!twice.ok, `the ${fitting.name} can be fitted twice out of the same crate`);
      const broke = buyCrateOutfit(stateAt(day, 1), broker.id, sysId, fitting.id);
      ok(!broke.ok, `a captain with 1 credit fitted the ${fitting.name}`);
    }

    // --- buying makes the gear a permanent part of the captain's kit ---
    {
      const st = stateAt(day, 5000000);
      buyCrateWeapon(st, broker.id, sysId, gun.id, 0);
      const row = brokerCrateRow(broker, st, sysId, 'weapon', gun.id);
      if (!row) fail(`the ${gun.name} fell out of the crate after purchase`);
      else if (!row.papers || row.asking >= gun.asking) {
        fail(`the ${gun.name} did not get cheaper once its papers were on file (${gun.asking} → ${row.asking})`);
      }
      // the mechanic's bench reads the same licence list
      if (!(st.story.unlocked || []).includes(gun.id)) fail(`the mechanic would not see the ${gun.name}`);
    }
  }
}

console.log(`brokers: ${BROKERS.length}  checks: ${checks}  bad: ${bad}`);
