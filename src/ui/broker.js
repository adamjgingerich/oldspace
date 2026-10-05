// The crate trader's manifest: what a factor, broker or chandler is carrying
// today, and what she wants for it. Opened by coming alongside a broker in the
// lanes (E) or by hailing her on the radio (T) — never from a station.
//
// Every figure on this panel comes out of src/data/brokers.js, so the panel and
// the trade itself can never disagree: rows are re-read (and re-priced) on every
// render, and a purchase whose crate has moved on simply refuses.

import { el, clear, btn } from './dom.js';
import { RELIC_BANDS, brokerCrate } from '../data/brokers.js';
import { fmtCredits } from '../core/util.js';
import { WEAPON_BY_ID } from '../data/weapons.js';
import { OUTFIT_BY_ID } from '../data/outfits.js';
import { computeStats, outfitInstallBlock } from '../game/state.js';

const LICENCE_NAME = {
  com: 'Combine licence', vig: 'Vigil licence', rea: 'Clan licence',
  quest: 'salvage papers', relic: 'vault licence',
};

const STAT_LABELS = {
  hull: 'Hull', shield: 'Shield', shieldRegen: 'Shield regen', energy: 'Charge',
  energyRegen: 'Charge regen', accel: 'Thrust', maxSpeed: 'Top speed', brake: 'Brake',
  turn: 'Turn rate', cargo: 'Hold', radar: 'Sensor range', lumenMax: 'Lumen tanks',
  mounts: 'Hardpoints', bays: 'Docking bays', fleetSlots: 'Escort slots', armorRegen: 'Hull regen',
};

/** A label-over-value cell, in the same shape every other sheet uses. */
const statCell = (label, value) => el('div', { class: 'stat' }, [
  el('span', { class: 'sl', text: label }),
  el('b', { class: 'sv', text: String(value) }),
]);

const statGrid = (cells) => el('div', { class: 'statgrid' }, cells.map(([label, value]) => statCell(label, value)));

/** Where this piece of gear would normally come from, and what she wants for it. */
function rowTag(row) {
  const kind = row.kind === 'weapon' ? 'weapon' : 'fitting';
  const paper = row.papers ? 'papers on file' : `${LICENCE_NAME[row.licence] || 'no papers'} — broker’s fee`;
  if (row.licence === 'relic') return `relic · band ${RELIC_BANDS[row.band] || 'I'} · ${paper}`;
  return `${kind} · ${paper}`;
}

export class BrokerUI {
  constructor(root) {
    this.ctx = null;
    this.title = el('h2', { text: 'Manifest' });
    this.sub = el('span', { class: 'csub', text: '' });
    this.closeBtn = el('button', { class: 'btn small', type: 'button', text: 'Back to the helm (E)' });
    this.closeBtn.addEventListener('click', () => this.ctx?.onClose?.());
    this.lede = el('div', { class: 'broker-lede' });
    this.body = el('div', { class: 'broker-body' });
    this.foot = el('div', { class: 'broker-foot' });
    this.panel = el('div', { class: 'broker hidden' }, [
      el('div', { class: 'broker-box' }, [
        el('header', {}, [this.title, this.sub, this.closeBtn]),
        this.lede,
        this.body,
        this.foot,
      ]),
    ]);
    root.append(this.panel);
  }

  open(ctx) {
    this.ctx = ctx;
    this.panel.classList.remove('hidden');
    this.render();
  }

  close() {
    this.panel.classList.add('hidden');
    this.ctx = null;
  }

  /** Re-read the manifest — prices, papers and the purse all move. */
  refresh() {
    if (this.ctx) this.render();
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return;
    const { state, broker } = ctx;
    // read the crate fresh every time: prices, papers and the purse all move
    const stock = ctx.systemId ? brokerCrate(broker, state, ctx.systemId) : ctx.stock;
    this.title.textContent = broker.name;
    this.sub.textContent = `${broker.captain} · alongside`;
    clear(this.lede);
    clear(this.body);
    clear(this.foot);

    this.lede.append(
      el('p', { class: 'note', text: broker.blurb }),
      el('div', { class: 'broker-purse' }, [
        el('span', {}, ['On hand ', el('b', { text: fmtCredits(state.credits) })]),
        el('span', { class: 'note', text: 'Credits only. She keeps no log of who bought what.' }),
      ]),
    );

    if (!stock.length) {
      this.body.append(el('p', { class: 'note', text: 'The deck is empty — she sold the last of it days ago.' }));
      return;
    }

    const stats = computeStats(state);
    const grid = el('div', { class: 'broker-grid' });
    for (const row of stock) grid.append(this._row(row, stats, ctx));
    this.body.append(grid);

    const relics = stock.filter((r) => r.licence === 'relic').length;
    this.foot.append(el('p', {
      class: 'note',
      text: `Pieces on the deck: ${stock.length}${relics ? ` · relic-grade: ${relics}` : ''}. Buy one and the licence comes with the crate: a mechanic will fit her out again if you ever take her off.`,
    }));
  }

  _row(row, stats, ctx) {
    const def = row.kind === 'weapon' ? WEAPON_BY_ID[row.id] : OUTFIT_BY_ID[row.id];
    return el('div', { class: `card ${row.licence === 'relic' ? 'relic' : ''}` }, [
      el('h4', {}, [
        row.name,
        row.licence === 'relic' ? el('span', { class: 'h4tag relic', text: 'RELIC' }) : null,
        el('span', { class: 'h4tag', text: row.kind === 'weapon' ? def.kind : 'fitting' }),
      ]),
      el('div', { class: 'cdesc', text: def.desc }),
      el('div', { class: 'cnote', text: rowTag(row) }),
      statGrid(this._cells(row, def)),
      el('div', { class: 'cfoot' }, [
        el('span', { class: 'price', text: `${fmtCredits(row.asking)} · list ${fmtCredits(row.base)}, +${row.over}%` }),
        this._controls(row, def, stats, ctx),
      ]),
    ]);
  }

  _cells(row, def) {
    if (row.kind === 'weapon') {
      const cells = [
        ['Damage', def.dmg],
        ['Rate', `${(1 / def.cooldown).toFixed(1)}/s`],
        ['Charge', def.energy],
        ['Range', def.range],
      ];
      if (def.kind === 'missile') {
        cells.push(['Rack size', def.rack], ['Ammo', def.maxAmmo]);
        if (def.shieldBonus) cells.push(['vs shields', `×${def.shieldBonus}`]);
      }
      return cells;
    }
    const cells = [];
    if (def.add) cells.push([STAT_LABELS[def.stat] || def.stat, `+${def.add[def.add.length - 1]}`]);
    if (def.add2) cells.push([STAT_LABELS[def.add2.stat] || def.add2.stat, `+${def.add2.add[def.add2.add.length - 1]}`]);
    if (!cells.length && def.effectText) cells.push(['Effect', def.effectText]);
    return cells;
  }

  _controls(row, def, stats, ctx) {
    const { actions, state } = ctx;
    const affordable = row.asking <= state.credits;
    const wrap = el('div', { class: 'broker-buy' });
    if (row.kind === 'weapon') {
      for (let i = 0; i < stats.mounts; i++) {
        const fitted = state.weapons[i] === row.id;
        const b = btn(fitted ? `P${i + 1} ✓` : `P${i + 1}`, () => actions.buyWeapon(row.id, i), `btn small ${fitted ? '' : 'primary'}`);
        if (fitted) b.disabled = true;
        else if (!affordable) b.disabled = true;
        if (!affordable && !fitted) b.title = 'Not enough credits.';
        wrap.append(b);
      }
      return wrap;
    }
    const level = state.outfits[row.id] || 0;
    const maxed = level >= (def.prices?.length || 1);
    const block = maxed ? null : outfitInstallBlock(state, row.id);
    const b = btn(maxed ? 'Already fitted' : `Fit · ${fmtCredits(row.asking)}`, () => actions.buyOutfit(row.id), `btn small ${maxed ? '' : 'primary'}`);
    if (maxed || block || !affordable) {
      b.disabled = true;
      b.title = block || (maxed ? 'You already run the best of these.' : 'Not enough credits.');
    }
    wrap.append(b);
    return wrap;
  }
}
