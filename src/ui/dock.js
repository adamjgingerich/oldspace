// The station interface: market, mechanic, shipyard, contracts, berth.

import { el, clear, btn } from './dom.js';
import { buildLog } from './log.js';
import { ShipViewer } from './shipviewer.js';
import { SYSTEMS } from '../data/systems.js';
import { FACTIONS, repLabel } from '../data/factions.js';
import { COMMODITY_BY_ID } from '../data/commodities.js';
import { OUTFITS, OUTFIT_BY_ID } from '../data/outfits.js';
import { WEAPONS, WEAPON_BY_ID } from '../data/weapons.js';
import { SHIPS, SHIP_BY_ID } from '../data/ships.js';
import { computeStats, outfitInstallBlock } from '../game/state.js';
import { marketRows } from '../game/economy.js';
import { fleetSellValue } from '../game/fleet.js';
import * as missions from '../game/missions.js';
import * as story from '../game/story.js';
import * as sidequests from '../game/sidequests.js';
import { fmtCredits, fmtNum, formatDeadline, clamp } from '../core/util.js';
import { RUMORS } from '../data/names.js';
import { rngOf } from '../core/rng.js';
import { SKILL_TREES } from '../data/skills.js';
import {
  skillRank, treeRanks, learnBlockReason, xpProgress, karmaLabel, isTreeUnlocked, FACTION_ALLEGIANCE_REP,
} from '../game/skills.js';
import { backgroundOf, driveOf } from '../game/character.js';
import { LUMEN_REFUEL_COST, REPAIR_COST_PER_HP, WORMHOLE_LICENCE_COST } from '../game/game.js';
import { holeInSystem } from '../game/wormholes.js';
import { EXPEDITION_MIN_LEVEL } from '../game/expeditions.js';

/** Human-readable names for outfit stat keys. */
const STAT_LABELS = {
  hull: 'Hull', shield: 'Shield', shieldRegen: 'Shield regen', energy: 'Charge',
  energyRegen: 'Charge regen', accel: 'Thrust', maxSpeed: 'Top speed', brake: 'Brake',
  turn: 'Turn rate', cargo: 'Hold', radar: 'Sensor range', lumenMax: 'Lumen tanks',
  armorRegen: 'Hull repair', mounts: 'Hardpoints', bays: 'Docking bays',
  fleetSlots: 'Escort slots',
};

/** Complication chip on a contract card, e.g. " · WATCHED". */
function twistChip(tw) {
  const label = tw && missions.twistLabel(tw.kind);
  return label ? ` · <span class="twist">${label}</span>` : '';
}

/* ---- stat sheets: the shared way ships and parts show their numbers. One
   label-over-value cell per reading, grouped and in a stable order, so the
   same figures never read differently from one menu to the next. ---- */

/** A label-over-value cell. */
const statCell = (label, value) => el('div', { class: 'stat' }, [
  el('span', { class: 'sl', text: label }),
  el('b', { class: 'sv', text: String(value) }),
]);

/** A grid of stat cells: label small and quiet above, value bright below. */
const statGrid = (cells) => el('div', { class: 'statgrid' }, cells.map(([label, value]) => statCell(label, value)));

/** A titled group — related readings kept together instead of one run-on line. */
const statGroup = (label, cells) => el('div', { class: 'statgroup' }, [
  el('div', { class: 'sghead', text: label }),
  statGrid(cells),
]);

/** The same hull readings, in the same order, at every slip and yard. */
function shipStatGroups(ship) {
  return [
    ['Frame', [
      ['Hull', ship.hull],
      ['Shield', ship.shield],
      ['Shield regen', `+${ship.shieldRegen}/s`],
      ['Charge', ship.energy],
      ['Charge regen', `+${ship.energyRegen}/s`],
    ]],
    ['Stores', [
      ['Hold', ship.cargo],
      ['Mounts', ship.mounts ?? 2],
      ['Bays', ship.bays ?? 0],
    ]],
    ['Drive', [
      ['Top speed', ship.maxSpeed],
      ['Thrust', ship.accel],
      ['Turn rate', ship.turn],
      ['Brake', ship.brake],
    ]],
  ];
}

/** The full stat sheet element for a hull. */
function shipStatSheet(ship) {
  return el('div', { class: 'statsheet' }, shipStatGroups(ship).map(([label, cells]) => statGroup(label, cells)));
}

export class DockUI {
  constructor(root) {
    this.root = root;
    this.wrap = null;
    this.ctx = null;
    this.tab = 'trade';
  }

  open(ctx) {
    this.ctx = ctx;
    const items = this._nav().flatMap((g) => g.items);
    if (!items.find((t) => t.id === this.tab)) this.tab = items[0]?.id || 'berth';
    if (!this.wrap) {
      this.body = el('div', { class: 'dock-body' });
      this.head = el('div', { class: 'dock-head' });
      this.nav = el('div', { class: 'ui-nav' });
      this.shell = el('div', { class: 'dock-shell' }, [
        this.head,
        el('div', { class: 'ui-split' }, [this.nav, this.body]),
      ]);
      this.wrap = el('div', { class: 'dockui' }, [this.shell]);
      this.root.append(this.wrap);
    }
    this.render();
  }

  close() {
    this._yardViewer?.dispose();
    this._yardViewer = null;
    this._yardCards = null;
    this._yardInfo = null;
    this.wrap?.remove();
    this.wrap = null;
    this.ctx = null;
  }

  refreshIfOpen() {
    if (this.wrap && this.ctx) this.render();
  }

  /** The berth's services, grouped by what they are for — not a flat tab list. */
  _nav() {
    const { state, station } = this.ctx;
    const s = station.services;
    const cap = computeStats(state);
    const groups = [];

    const port = [];
    if (s.includes('trade')) port.push({ id: 'trade', label: 'Market', hint: 'Buy low, sell high' });
    if (s.includes('bar')) port.push({ id: 'contracts', label: 'Contracts', hint: 'Work on the board' });
    if (port.length) groups.push({ label: 'The port', items: port });

    const ship = [{ id: 'berth', label: 'Berth', hint: 'Status · refuel · save' }];
    if (s.includes('mechanic')) ship.push({ id: 'mechanic', label: 'Mechanic', hint: 'Repairs, guns, rigging' });
    if (s.includes('shipyard')) ship.push({ id: 'shipyard', label: 'Shipyard', hint: 'Hulls in the slips' });
    groups.push({ label: 'Your ship', items: ship });

    const command = [];
    if ((state.fleet?.length || 0) > 0 || cap.fleetSlots > 0 || cap.bays > 0) {
      command.push({ id: 'fleet', label: 'Fleet', hint: 'Wings & cradles', badge: state.fleet?.length || 0 });
    }
    command.push({ id: 'holdings', label: 'Holdings', hint: 'Charters & convoys', badge: Object.keys(state.holdings || {}).length });
    groups.push({ label: 'Command', items: command });

    groups.push({
      label: 'Captain',
      items: [
        { id: 'career', label: 'Career', hint: 'Factions & standing' },
        { id: 'skills', label: 'Skills', hint: 'Talent trees', badge: state.skillPoints || 0, tone: 'good' },
        { id: 'log', label: 'Ship’s Log', hint: 'Story & codex' },
      ],
    });

    // work waiting at this counter outranks quiet badges
    const readyCount = missions.completionsAt(state, this.ctx.systemId, station.id).length;
    const contracts = port.find((i) => i.id === 'contracts');
    if (contracts && readyCount > 0) {
      contracts.badge = readyCount;
      contracts.tone = 'good';
    }
    return groups;
  }

  render() {
    // the yard's 3D cradle holds a WebGL context — hand it back before redraw
    this._yardViewer?.dispose();
    this._yardViewer = null;
    this._yardCards = null;
    this._yardInfo = null;
    const { state, station, system } = this.ctx;
    const owner = FACTIONS[station.owner];
    const rep = state.rep[station.owner] ?? 0;

    // ---- head ----
    clear(this.head);
    const headChildren = [
      el('div', { class: 'stn' }, [
        station.name,
        el('small', { text: `${system.name} · ${station.type} · ${owner?.name || station.owner}` }),
      ]),
      el('span', { class: 'chip faction', text: `${repLabel(rep)} (${rep >= 0 ? '+' : ''}${rep})` }),
      el('div', { class: 'spacer' }),
      el('div', { class: 'purse' }, [fmtCredits(state.credits), el('small', { text: 'ON HAND' })]),
      btn('Undock', () => this.ctx.actions.undock(), 'btn primary'),
    ];
    if (station.blackmarket) headChildren.splice(2, 0, el('span', { class: 'chip off', text: 'no questions asked' }));
    this.head.append(...headChildren);

    // ---- navigation: services grouped by what they are for ----
    clear(this.nav);
    for (const group of this._nav()) {
      const g = el('div', { class: 'navgroup' }, [el('div', { class: 'nglabel', text: group.label })]);
      for (const item of group.items) {
        g.append(el('button', {
          class: `navitem ${item.id === this.tab ? 'active' : ''}`,
          onclick: () => {
            if (this.tab === item.id) return;
            this.tab = item.id;
            this.render();
          },
        }, [
          el('span', { class: 'nlabel', text: item.label }),
          el('span', { class: 'nhint', text: item.hint || '' }),
          item.badge > 0 ? el('span', { class: `nbadge ${item.tone || ''}`, text: item.badge > 99 ? '99+' : String(item.badge) }) : null,
        ]));
      }
      this.nav.append(g);
    }

    // ---- body ----
    clear(this.body);
    this.body.scrollTop = 0;

    const ready = missions.completionsAt(state, this.ctx.systemId, station.id);
    if (ready.length) {
      const banner = el('div', { class: 'panel', style: 'margin-bottom:16px;border-color:rgba(126,240,138,0.35)' }, [
        el('h3', { text: 'Ready for handover' }),
      ]);
      for (const r of ready) {
        banner.append(el('div', { class: 'mfoot', style: 'margin-top:6px' }, [
          el('span', { text: `${r.mission.title} — reward ₡${r.mission.reward.toLocaleString()}` }),
          btn(`${r.verb} now`, () => this.ctx.actions.actCompleteMission(r.mission.id), 'btn primary small'),
        ]));
      }
      this.body.append(banner);
    }

    switch (this.tab) {
      case 'trade': this._renderTrade(); break;
      case 'mechanic': this._renderMechanic(); break;
      case 'holdings': this._renderHoldings(); break;
      case 'shipyard': this._renderShipyard(); break;
      case 'contracts': this._renderContracts(); break;
      case 'fleet': this._renderFleet(); break;
      case 'career': this._renderCareer(); break;
      case 'skills': this._renderSkills(); break;
      case 'log': this._renderLog(); break;
      default: this._renderBerth(); break;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Market                                                             */
  /* ------------------------------------------------------------------ */

  _renderTrade() {
    const { state, station, systemId, actions } = this.ctx;
    const rows = marketRows(state, systemId, station);
    const stat = computeStats(state);

    const cols = el('div', { class: 'cols' }, [
      el('div', { class: 'panel' }, [
        el('h2', { text: 'Commodity market' }),
        el('p', { class: 'note', text: 'Buy low where a world produces; sell high where it hungers. Prices drift every few days.' }),
        this._tradeTable(rows, actions),
      ]),
      el('div', {}, [
        el('div', { class: 'panel' }, [
          el('h2', { text: 'Hold' }),
          el('div', { class: 'kv' }, [
            el('span', { text: 'Cargo used' }),
            el('b', { text: `${state.cargoUsed()} / ${stat.cargo}` }),
          ]),
          el('div', { class: 'kv' }, [el('span', { text: 'Free space' }), el('b', { text: String(state.cargoFree()) })]),
          el('h3', { text: 'Manifest' }),
          ...this._manifest(state),
        ]),
      ]),
    ]);
    this.body.append(cols);
  }

  _tradeTable(rows, actions) {
    const table = el('table', { class: 'tbl' });
    table.append(el('tr', {}, [
      el('th', { text: 'Commodity' }),
      el('th', { class: 'num', text: 'Buy' }),
      el('th', { class: 'num', text: 'Sell' }),
      el('th', { class: 'num', text: 'Hold' }),
      el('th', { text: '' }),
    ]));
    for (const r of rows) {
      const canBuy1 = true;
      table.append(el('tr', {}, [
        el('td', { class: `cname ${r.commodity.illegal ? 'illegal' : ''}` }, [
          el('b', { text: r.commodity.name }),
          el('small', { text: r.commodity.desc }),
        ]),
        el('td', { class: 'num', text: fmtNum(r.buy) }),
        el('td', { class: 'num', text: fmtNum(r.sell) }),
        el('td', { class: 'num', text: String(r.held) }),
        el('td', {}, [
          el('div', { style: 'display:flex;gap:4px;justify-content:flex-end;flex-wrap:wrap' }, [
            btn('+1', () => actions.actBuy(r.commodity.id, 1), 'btn tiny'),
            btn('+10', () => actions.actBuy(r.commodity.id, 10), 'btn tiny'),
            btn('−1', () => actions.actSell(r.commodity.id, 1), 'btn tiny'),
            btn('All', () => actions.actSellAll(r.commodity.id), 'btn tiny ghost'),
          ]),
        ]),
      ]));
    }
    return table;
  }

  _manifest(state) {
    const out = [];
    const entries = Object.entries(state.cargo).filter(([, q]) => q > 0);
    if (!entries.length) out.push(el('p', { class: 'note', text: 'Hold empty.' }));
    for (const [id, qty] of entries) {
      out.push(el('div', { class: 'kv' }, [
        el('span', { text: COMMODITY_BY_ID[id]?.name || id }),
        el('b', { text: `${qty} crates` }),
      ]));
    }
    for (const m of state.missions) {
      if (m.cargoLoaded) {
        out.push(el('div', { class: 'kv' }, [
          el('span', { text: `contract: ${COMMODITY_BY_ID[m.cargoLoaded.id]?.name || m.cargoLoaded.id}` }),
          el('b', { text: `${m.cargoLoaded.qty} crates` }),
        ]));
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Holdings                                                           */
  /* ------------------------------------------------------------------ */

  _renderHoldings() {
    const { state, actions } = this.ctx;
    const holdings = state.holdings || {};
    const ownedIds = Object.keys(holdings);
    const body = el('div', {}, [el('h2', { text: 'Holdings & shipping' })]);
    const totalIncome = ownedIds.reduce((sum, id) => sum + actions.holdingIncomePerDay(id), 0);
    body.append(el('p', {
      class: 'note',
      text: 'Charters over worlds and stations fly your own colours. Freighters ply the lanes under your flag and pay daily; '
        + 'patrol cutters keep raiders off your shipping — and out of your system. '
        + `${ownedIds.length}/5 charters held · ${fmtCredits(totalIncome)} per day · requires level 12.`,
    }));

    if (ownedIds.length) {
      body.append(el('h3', { text: 'Your charters' }));
      const grid = el('div', { class: 'card-grid' });
      for (const sid of ownedIds) {
        const sys = SYSTEMS[sid];
        const h = holdings[sid];
        const units = h.units || { freighter: 0, patrol: 0 };
        const income = actions.holdingIncomePerDay(sid);
        const fBtn = btn(
          units.freighter >= 6 ? 'Freighters maxed' : `Commission freighter (${fmtCredits(actions.freighterCost(sid))})`,
          () => actions.actCommissionUnit(sid, 'freighter'),
          `btn small ${units.freighter < 6 ? 'primary' : ''}`,
        );
        const pBtn = btn(
          units.patrol >= 4 ? 'Patrols maxed' : `Commission patrol cutter (${fmtCredits(actions.patrolCost(sid))})`,
          () => actions.actCommissionUnit(sid, 'patrol'),
          'btn small',
        );
        if (units.freighter >= 6 || state.credits < actions.freighterCost(sid)) fBtn.disabled = true;
        if (units.patrol >= 4 || state.credits < actions.patrolCost(sid)) pBtn.disabled = true;
        grid.append(el('div', { class: 'card owned' }, [
          el('h4', { text: `${h.asset === 'spacedock' ? 'Planet spacedock charter' : h.asset === 'planet' ? 'World charter' : 'Station licence'} · ${sys.name}` }),
          el('div', { class: 'cstats', text: `Freighters ${units.freighter}/6 · patrol cutters ${units.patrol}/4 · income ${fmtCredits(income)}/day` }),
          h.asset === 'spacedock' ? el('div', { class: 'cstats', style: 'color:#7fd8ef', text: 'The world below feeds this dock — convoys earn +35%.' }) : null,
          h.asset === 'planet' ? el('div', { class: 'cstats', style: 'color:#7fd8ef', text: 'The world itself fills your holds — convoys earn +15%.' }) : null,
          state.wormholeLicence && holeInSystem(state, sid) ? el('div', { class: 'cstats', style: 'color:#c8a8ff', text: 'Wormhole shipping — convoys cross the holes: +25% income.' }) : null,
          el('div', { class: 'cstats', style: 'color:#7fd8ef', text: units.patrol > 0 ? `Deterrence: raiders at ${sys.name} cut by ~${Math.round(Math.min(0.7, 0.15 * units.patrol) * 100)}%, raids mostly driven off.` : 'No patrols — your convoys run naked.' }),
          el('div', { class: 'cfoot' }, [fBtn, pBtn]),
        ]));
      }
      body.append(grid);
    }

    body.append(el('h3', { text: 'Available charters' }));
    const grid2 = el('div', { class: 'card-grid' });
    let any = false;
    for (const [sid, sys] of Object.entries(SYSTEMS)) {
      if (holdings[sid]) continue;
      if (!state.visited?.[sid]) continue; // fog of war: you must have charted it
      any = true;
      const block = actions.holdingBlock(sid);
      const price = actions.holdingPrice(sid);
      const asset = actions.holdingAsset(sid);
      const card = el('div', { class: 'card' }, [
        el('h4', { text: `${asset.kind === 'spacedock' ? 'Planet spacedock charter' : asset.kind === 'planet' ? 'World charter' : 'Station licence'} · ${sys.name}` }),
        el('div', { class: 'cdesc', text: sys.tagline }),
        el('div', { class: 'cstats', text: `${asset.name} · tech ${sys.tech} · pirates ${Math.round(sys.danger.pirates * 100)}%${holeInSystem(state, sid) ? ' · wormhole hub' : ''}` }),
        asset.kind === 'spacedock' ? el('div', { class: 'cstats', style: 'color:#7fd8ef', text: 'Orbital yards fed by the world below — the richest charter on offer (+35% convoy income).' }) : null,
        asset.kind === 'planet' ? el('div', { class: 'cstats', style: 'color:#7fd8ef', text: 'A whole world to exploit — convoys earn +15%.' }) : null,
        el('div', { class: 'cfoot' }, [
          el('span', { class: 'price', text: fmtCredits(price) }),
          btn('Acquire charter', () => actions.actBuyHolding(sid), 'btn small primary'),
        ]),
      ]);
      if (block) {
        const b = card.querySelector('button');
        b.disabled = true;
        b.title = block;
        card.append(el('div', { class: 'cstats', style: 'color:#c98a6a', text: block }));
      }
      grid2.append(card);
    }
    if (!any) {
      body.append(el('p', { class: 'note', text: 'No charters on offer — explore more systems and their ports will open their books.' }));
    }
    body.append(grid2);

    // ---- fleet expeditions: your hulls run the lanes while you take the credit ----
    const types = actions.expeditionTypes();
    body.append(el('h3', { text: 'Fleet expeditions' }));
    if (xpProgress(state).level < EXPEDITION_MIN_LEVEL) {
      body.append(el('p', { class: 'note', text: `Send ships from your fleet out on missions from your charters — requires level ${EXPEDITION_MIN_LEVEL}.` }));
    } else {
      body.append(el('p', { class: 'note', text: 'Fleet ships run missions from your charters and come home with credits, salvage, reputation and experience. The far lane is the price of the far pay.' }));
      const ships = actions.availableExpeditionShips();
      for (const sid of ownedIds) {
        const sys = SYSTEMS[sid];
        const dests = actions.expeditionDestinations(sid);
        const shipSel = el('select', { style: 'flex:1;min-width:150px' },
          ships.length
            ? ships.map((s) => el('option', { value: s.uid, text: `${s.name} — ${SHIP_BY_ID[s.shipId]?.name || s.shipId}` }))
            : [el('option', { value: '', text: '— no free ships —' })]);
        const typeSel = el('select', { style: 'flex:1;min-width:120px' },
          Object.entries(types).map(([id, t]) => el('option', { value: id, text: t.label })));
        const destSel = el('select', { style: 'flex:1;min-width:120px' },
          dests.length
            ? dests.map((d) => el('option', { value: d, text: SYSTEMS[d].name }))
            : [el('option', { value: '', text: '— no lanes —' })]);
        const sendBtn = btn('Send', () => actions.actDispatchExpedition(shipSel.value, sid, typeSel.value, destSel.value), 'btn small primary');
        if (!ships.length || !dests.length) sendBtn.disabled = true;
        body.append(el('div', { class: 'card' }, [
          el('h4', { text: `Dispatch from ${sys.name}` }),
          el('div', { class: 'cdesc', text: 'Pick a free fleet ship, the work, and the far lane.' }),
          el('div', { class: 'cstats', style: 'display:flex;gap:6px;flex-wrap:wrap;align-items:center' }, [shipSel, typeSel, destSel, sendBtn]),
        ]));
      }
    }
    const away = state.fleet.filter((m) => m.status === 'away');
    if (away.length) {
      body.append(el('p', {
        class: 'note',
        text: 'Out on the lanes: ' + away.map((m) => `${m.name} — ${types[m.away?.type]?.label || 'run'} to ${SYSTEMS[m.away?.destSysId]?.name || '?'} · back day ${m.away?.returnDay}`).join(' · '),
      }));
    }

    this.body.append(body);
  }

  /* ------------------------------------------------------------------ */
  /* Mechanic: hull work, upgrades and armament                         */
  /* ------------------------------------------------------------------ */

  _renderMechanic() {
    const { state, actions } = this.ctx;
    const stats = computeStats(state);
    const player = actions.universe.player;
    const missingHull = Math.max(0, Math.ceil(stats.hull - player.hull));
    const repairCost = Math.round(missingHull * REPAIR_COST_PER_HP);

    this.body.append(el('div', { class: 'panel', style: 'margin-bottom:14px' }, [
      el('h3', { text: 'Hull & frame' }),
      el('div', { class: 'kv' }, [el('span', { text: 'Hull plating' }), el('b', { text: `${Math.ceil(player.hull)} / ${stats.hull}` })]),
      el('p', { class: 'note', style: 'margin:6px 0 0', text: repairCost === 0 ? 'Nothing to hammer out — the plating is sound.' : 'The mechanic will weld her back to spec, charged per point of plate.' }),
      el('div', { style: 'margin-top:10px' }, [
        this._priceBtn(`Repair hull (${fmtCredits(repairCost)})`, repairCost === 0 || repairCost > state.credits, () => actions.actRepair()),
      ]),
    ]));

    const left = el('div', {}, [el('h2', { text: 'Rigging & systems' }), el('div', { class: 'card-grid', style: 'margin-top:10px' })]);
    const grid = left.lastChild;
    const unlocked = new Set(story.ensureStory(state).unlocked);
    for (const o of OUTFITS) {
      if (o.unique && !unlocked.has(o.id)) continue;
      const level = state.outfits[o.id] || 0;
      const maxed = level >= o.prices.length;
      const price = maxed ? 0 : o.prices[level];
      const blockReason = maxed ? null : outfitInstallBlock(state, o.id);
      const pips = o.prices.map((_, i) => (i < level ? '●' : '○')).join(' ');
      const effects = this._outfitEffects(o);
      const card = el('div', { class: `card ${level > 0 ? 'owned' : ''}` }, [
        el('h4', {}, [o.name, o.legend ? el('span', { class: 'h4tag relic', text: 'RELIC' }) : null, el('span', { class: 'h4tag', text: pips })]),
        el('div', { class: 'cdesc', text: o.desc }),
        effects ? statGrid(effects) : (o.effectText ? el('div', { class: 'cnote', text: o.effectText }) : null),
        blockReason ? el('div', { class: 'cnote warn', text: blockReason }) : null,
        el('div', { class: 'cfoot' }, [
          el('span', { class: 'price', text: maxed ? 'MAXED' : fmtCredits(price) }),
          btn(maxed ? 'Installed' : `Install (L${level + 1})`, () => actions.actBuyOutfit(o.id), `btn small ${maxed ? '' : 'primary'}`),
        ]),
      ]);
      if (maxed) card.querySelector('button').disabled = true;
      else if (blockReason) {
        const b = card.querySelector('button');
        b.disabled = true;
        b.title = blockReason;
      } else if (price > state.credits) card.querySelector('button').disabled = true;
      grid.append(card);
    }

    const right = el('div', {}, [el('h2', { text: 'Armament' })]);
    const hp = el('div', { class: 'panel', style: 'margin-top:10px' }, [
      el('h3', { text: 'Hardpoints' }),
    ]);
    for (let i = 0; i < stats.mounts; i++) {
      const wid = state.weapons[i];
      const w = wid ? WEAPON_BY_ID[wid] : null;
      hp.append(el('div', { class: 'kv' }, [
        el('span', { text: `Hardpoint ${i + 1}` }),
        el('b', { text: w ? w.name : '— empty —' }),
      ]));
    }
    const missiles = Object.entries(state.ammo).filter(([id]) => WEAPON_BY_ID[id]?.kind === 'missile');
    for (const [id, n] of missiles) {
      if (!state.weapons.includes(id)) continue;
      const w = WEAPON_BY_ID[id];
      hp.append(el('div', { class: 'kv' }, [
        el('span', { text: `${w.name} racks` }),
        el('b', { text: `${n} / ${w.maxAmmo}` }),
      ]));
      const ammoBtn = btn(`Buy 4 racks (${fmtCredits(Math.round(w.price / 4))})`, () => actions.actBuyAmmo(id, 1), 'btn small');
      if (n + w.rack > w.maxAmmo) ammoBtn.disabled = true;
      hp.append(el('div', { style: 'margin-top:8px' }, [ammoBtn]));
    }
    right.append(hp);

    const wgrid = el('div', { class: 'card-grid', style: 'margin-top:12px' });
    for (const w of WEAPONS) {
      if (w.unique && !unlocked.has(w.id)) continue;
      const dps = (w.dmg / w.cooldown).toFixed(1);
      const cells = [
        ['Damage', w.dmg],
        ['Rate', `${(1 / w.cooldown).toFixed(1)}/s`],
        ['DPS', dps],
        ['Range', w.range],
        ['Charge', w.energy],
      ];
      if (w.kind === 'missile') {
        cells.push(['Rack size', w.rack], ['Speed', w.speed], ['Tracking', w.turn]);
        if (w.shieldBonus) cells.push(['vs shields', `×${w.shieldBonus}`]);
      }
      const card = el('div', { class: `card ${state.weapons.includes(w.id) ? 'owned' : ''}` }, [
        el('h4', {}, [w.name, w.legend ? el('span', { class: 'h4tag relic', text: 'RELIC' }) : null, el('span', { class: 'h4tag', text: w.kind })]),
        el('div', { class: 'cdesc', text: w.desc }),
        statGrid(cells),
        el('div', { class: 'cfoot' }, [
          el('span', { class: 'price', text: fmtCredits(w.price) }),
          el('div', { style: 'display:flex;gap:5px;flex-wrap:wrap' }, Array.from({ length: stats.mounts }, (_, i) => (
            btn(`P${i + 1}`, () => actions.actEquipWeapon(w.id, i), `btn tiny ${state.weapons[i] === w.id ? '' : 'primary'}`)
          ))),
        ]),
      ]);
      card.querySelectorAll('button').forEach((b) => {
        if (w.price > state.credits) b.disabled = true;
      });
      wgrid.append(card);
    }
    right.append(el('h3', { text: 'Weapons for sale' }), wgrid);

    this.body.append(el('div', { class: 'cols' }, [left, right]));

    this.body.append(el('div', { style: 'margin-top:14px' }, [
      statGroup('Current fit', [
        ['Hull', Math.round(stats.hull)],
        ['Shield', Math.round(stats.shield)],
        ['Charge', Math.round(stats.energy)],
        ['Hold', stats.cargo],
      ]),
    ]));
  }

  /** Effect rows for an outfit card: [label, "+20 → +60"] pairs in a stable order. */
  _outfitEffects(o) {
    if (!o.add) return null;
    const label = (stat) => STAT_LABELS[stat] || stat;
    const fmtVal = (stat, v) => {
      if (stat === 'turn') return `+${Math.round(v * 57.3)}°/s`; // rad/s reads badly
      const rounded = Math.round(v * 100) / 100;
      return `${rounded >= 0 ? '+' : ''}${rounded}`;
    };
    const rangeText = (spec) => {
      const first = fmtVal(spec.stat, spec.add[0]);
      const last = fmtVal(spec.stat, spec.add[spec.add.length - 1]);
      return spec.add.length > 1 ? `${first} → ${last}` : first;
    };
    const rows = [[label(o.stat), rangeText(o)]];
    if (o.add2) rows.push([label(o.add2.stat), rangeText(o.add2)]);
    return rows;
  }

  /* ------------------------------------------------------------------ */
  /* Shipyard                                                           */
  /* ------------------------------------------------------------------ */

  _renderShipyard() {
    const { state, system, actions } = this.ctx;
    const current = SHIP_BY_ID[state.shipId];
    const tradein = Math.round((current?.price || 0) * 0.7);

    this.body.append(el('div', { class: 'panel', style: 'margin-bottom:16px' }, [
      el('h2', { text: 'In the slips' }),
      el('p', { class: 'note', text: `Your ${current.name} (${current.cls}) will fetch about ${fmtCredits(tradein)} in trade. Outfits, weapons and cargo transfer with you.` }),
      el('p', { class: 'note', text: 'Click a hull to walk around her on the cradle. Most hulls travel the lanes; a few are built to order and stocked only at their home yards. Prize hulls are never sold at all — take one in flight.' }),
    ]));

    // ---- every hull this yard can show ----
    const unlocked = new Set(story.ensureStory(state).unlocked);
    const offered = [];
    for (const ship of SHIPS) {
      if (ship.capture) continue; // prizes are never sold — claim one in flight
      if (ship.yards && !ship.yards.includes(state.systemId)) continue; // built-to-order hull
      if (ship.unique && !unlocked.has(ship.id)) continue;
      offered.push(ship);
    }
    if (!offered.length) {
      this.body.append(el('p', { class: 'note', text: 'No hulls on offer at this yard today.' }));
      return;
    }
    if (!offered.some((s) => s.id === this.yardSel)) this.yardSel = offered[0].id;

    // ---- right column: the viewing cradle ----
    const viewCol = el('div', {}, [
      el('div', { class: 'panel' }, [
        el('h3', { text: 'On the cradle' }),
        el('div', { class: 'yard-stage' }),
        el('div', { class: 'yard-info' }),
      ]),
    ]);
    this._yardViewer = new ShipViewer(viewCol.querySelector('.yard-stage'));
    this._yardInfo = viewCol.querySelector('.yard-info');

    // ---- left column: the hulls for sale ----
    const grid = el('div', { class: 'card-grid yard-grid' });
    const cards = new Map();
    for (const ship of offered) {
      actions.noteSighting?.(ship.id, 'yard');
      const isCurrent = ship.id === state.shipId;
      const gated = ship.minTech > system.tech;
      const net = ship.price - tradein;
      const card = el('div', { class: `card ${isCurrent ? 'owned' : ''}` }, [
        el('h4', {}, [ship.name, el('span', { class: 'h4tag', text: ship.cls })]),
        el('div', { class: 'cdesc', text: ship.desc }),
        shipStatSheet(ship),
        ship.mini ? el('div', { class: 'cnote', text: 'small craft' }) : null,
        el('div', { class: 'cfoot' }, [
          el('span', { class: 'price', text: isCurrent ? 'YOUR SHIP' : gated ? `requires tech ${ship.minTech}` : `${fmtCredits(ship.price)} (net ${fmtCredits(Math.max(0, net))})` }),
          el('div', { style: 'display:flex;gap:5px;flex-wrap:wrap' }, [
            isCurrent ? null : btn('Take command', () => actions.actBuyShip(ship.id), 'btn small primary'),
            isCurrent ? null : btn('Add to fleet', () => actions.actBuyFleetShip(ship.id), 'btn small'),
          ]),
        ]),
      ]);
      const cbtns = card.querySelectorAll('button');
      if (cbtns[0]) cbtns[0].disabled = gated || net > state.credits;
      if (cbtns[1]) cbtns[1].disabled = gated || ship.price > state.credits;
      card.addEventListener('click', () => this._selectYardShip(ship.id));
      grid.append(card);
      cards.set(ship.id, card);
    }
    this._yardCards = cards;

    this.body.append(el('div', { class: 'cols' }, [grid, viewCol]));
    this._refreshYard();
  }

  /** Put a hull on the cradle: highlight her card, spin her up, print the sheet. */
  _selectYardShip(id) {
    this.yardSel = id;
    this._refreshYard();
  }

  _refreshYard() {
    const { state, system } = this.ctx;
    if (!this._yardCards || !this._yardViewer || !this._yardInfo) return;
    for (const [id, node] of this._yardCards) node.classList.toggle('sel', id === this.yardSel);
    const ship = SHIP_BY_ID[this.yardSel];
    if (!ship) return;

    // she flies with your guns, rigging and colours — show what you would get
    const cap = Math.max(2, ship.mounts ?? 2);
    const weapons = state.weapons.slice(0, cap);
    while (weapons.length < cap) weapons.push(null);
    this._yardViewer.show(ship, { weapons, outfits: state.outfits, mountCap: cap, showEmpty: true });

    const isCurrent = ship.id === state.shipId;
    const gated = ship.minTech > system.tech;
    const net = ship.price - Math.round((SHIP_BY_ID[state.shipId]?.price || 0) * 0.7);
    clear(this._yardInfo);
    this._yardInfo.append(...[
      el('div', { class: 'yard-name' }, [ship.name, el('span', { class: 'yard-cls', text: ship.cls })]),
      el('div', { class: 'cdesc', text: ship.desc }),
      shipStatSheet(ship),
      ship.mini ? el('div', { class: 'cnote', text: 'small craft' }) : null,
      el('div', { class: 'yard-price', text: isCurrent ? 'YOUR SHIP — no trade needed' : gated ? `Requires tech ${ship.minTech} to fit out.` : `${fmtCredits(ship.price)} · net ${fmtCredits(Math.max(0, net))} after trade-in` }),
    ].filter(Boolean));
  }

  /* ------------------------------------------------------------------ */
  /* Fleet                                                              */
  /* ------------------------------------------------------------------ */

  _renderFleet() {
    const { state, actions } = this.ctx;
    const stats = computeStats(state);
    const escorts = state.fleet.filter((m) => m.status === 'escort').length;
    const docked = state.fleet.filter((m) => m.status === 'bay').length;
    const escMax = stats.fleetSlots || 0;
    const bayMax = stats.bays || 0;

    this.body.append(el('div', { class: 'panel', style: 'margin-bottom:16px' }, [
      el('h2', { text: 'Your fleet' }),
      el('p', {
        class: 'note',
        text: 'Escorts fly your wing; small craft ride the docking cradles and scramble on your order (G in flight). Buy hulls with “Add to fleet” at any shipyard, and grow capacity with Docking Bays and a Fleet Command Uplink at mechanics.',
      }),
      el('div', { class: 'kv' }, [el('span', { text: 'Escort slots' }), el('b', { text: `${escorts} / ${escMax}` })]),
      el('div', { class: 'kv' }, [el('span', { text: 'Docking bays' }), el('b', { text: `${docked} / ${bayMax}` })]),
      el('div', { class: 'kv' }, [el('span', { text: 'In flight' }), el('b', { text: 'B focus fire · N regroup · G scramble · H recall' })]),
    ]));

    if (!state.fleet.length) {
      this.body.append(el('p', { class: 'note', text: 'No ships in your fleet yet. A wing is cheaper than a funeral — start at the shipyard.' }));
      return;
    }

    const grid = el('div', { class: 'card-grid' });
    for (const entry of state.fleet) {
      const def = SHIP_BY_ID[entry.shipId];
      if (!def) continue;
      const inBay = entry.status === 'bay';
      const away = entry.status === 'away';
      const isMini = !!def.mini;
      const buttons = [];
      if (!away) {
        if (inBay) {
          buttons.push(btn('Launch', () => actions.actLaunchFleet(entry.uid), 'btn tiny primary'));
        } else if (isMini) {
          buttons.push(btn('Dock in bay', () => actions.actDockFleet(entry.uid), 'btn tiny'));
        }
        buttons.push(btn('Fly this ship', () => actions.actFlyFleetShip(entry.uid), 'btn tiny'));
        buttons.push(btn(`Sell ₡${fleetSellValue(entry.shipId).toLocaleString()}`, () => actions.actSellFleetShip(entry.uid), 'btn tiny danger'));
      }
      const chip = away
        ? el('span', { class: 'chip off', text: `AWAY — back day ${entry.away?.returnDay ?? '?'}` })
        : el('span', { class: `chip ${inBay ? 'off' : 'on'}`, text: inBay ? `IN BAY ${(entry.bay ?? 0) + 1}` : 'FLYING' });
      grid.append(el('div', { class: `card ${inBay ? 'owned' : ''}` }, [
        el('h4', {}, [entry.name, el('span', { class: 'h4tag', text: def.cls })]),
        el('div', { class: 'cdesc' }, [chip, ` ${def.name}`]),
        shipStatSheet(def),
        isMini ? el('div', { class: 'cnote', text: 'small craft' }) : null,
        away ? el('div', { class: 'cnote', text: `${actions.expeditionTypes()[entry.away?.type]?.label || 'Expedition'} → ${SYSTEMS[entry.away?.destSysId]?.name || 'the lanes'}` }) : null,
        el('div', { class: 'cfoot' }, [
          el('div', { style: 'display:flex;gap:5px;flex-wrap:wrap' }, buttons),
        ]),
      ]));
    }
    this.body.append(grid);
  }

  /* ------------------------------------------------------------------ */
  /* Career: history, karma, factions and skill trees                   */
  /* ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------ */
  /* Ship's log                                                         */
  /* ------------------------------------------------------------------ */

  _renderLog() {
    this.body.append(buildLog(this.ctx.state, { actions: this.ctx.actions }));
  }

  /* ------------------------------------------------------------------ */
  /* Skills: the six category trees (same content as the K overlay)     */
  /* ------------------------------------------------------------------ */

  _renderSkills() {
    const { state, actions } = this.ctx;
    const points = state.skillPoints || 0;
    this.body.append(el('h2', { text: 'Skill trees' }));
    this.body.append(el('div', { class: 'kbanner' }, [
      el('b', { class: 'bignum', text: String(points) }),
      el('span', { class: 'note', text: `skill point${points === 1 ? '' : 's'} unspent — one arrives with each level; elites unlock through play` }),
    ]));
    this.body.append(el('p', { class: 'note', text: 'Six disciplines. Tiers open as you invest ranks; the tier-4 elites unlock through story chapters, side jobs, kill counts and level. In flight, press K for the same tree.' }));
    const filterRow = el('div', { class: 'chips', style: 'margin:8px 0 14px' });
    const pick = (id) => {
      this.skillFilter = id;
      this.render();
    };
    filterRow.append(el('span', {
      class: `chip ${(!this.skillFilter || this.skillFilter === 'all') ? 'on' : ''}`,
      text: 'All',
      style: 'cursor:pointer',
      onclick: () => pick('all'),
    }));
    for (const t of SKILL_TREES) {
      filterRow.append(el('span', {
        class: `chip ${this.skillFilter === t.id ? 'on' : ''}`,
        text: `${t.name} · ${treeRanks(state, t.id)}`,
        style: `cursor:pointer; color:${t.color}`,
        onclick: () => pick(t.id),
      }));
    }
    this.body.append(filterRow);
    const treeList = (!this.skillFilter || this.skillFilter === 'all')
      ? SKILL_TREES
      : SKILL_TREES.filter((t) => t.id === this.skillFilter);
    for (const tree of treeList) {
      const block = el('div', { class: 'tree-block' }, [
        el('div', { class: 'tree-head' }, [
          el('h3', { style: `color:${tree.color}`, text: tree.name }),
          el('span', { class: 'chip', text: `${treeRanks(state, tree.id)} ranks` }),
        ]),
        el('p', { class: 'note', text: tree.desc }),
      ]);
      const grid = el('div', { class: 'skill-grid' });
      for (const skill of tree.skills) grid.append(this._skillCard(skill, state, actions));
      block.append(grid);
      this.body.append(block);
    }
  }

  _renderCareer() {
    const { state, station, actions } = this.ctx;
    const bg = backgroundOf(state);
    const drive = driveOf(state);
    const prog = xpProgress(state);

    // ---- left: commander dossier + allegiance ----
    const left = el('div');
    const dossier = el('div', { class: 'panel' }, [
      el('h2', { text: `Commander ${state.commander}` }),
      el('div', { class: 'kv' }, [el('span', { text: 'Level' }), el('b', { text: `${prog.level}` })]),
      el('div', { class: 'kv' }, [el('span', { text: 'Skill points' }), el('b', { text: `${state.skillPoints || 0} unspent` })]),
      el('div', { class: 'kv' }, [
        el('span', { text: 'Karma' }),
        el('b', { text: `${state.karma > 0 ? '+' : ''}${state.karma} — ${karmaLabel(state.karma)}` }),
      ]),
      this._xpBar(prog),
      el('h3', { text: 'History' }),
      el('div', { class: 'kv' }, [
        el('span', { text: 'Background' }),
        el('b', { text: bg ? bg.name : 'Unrecorded' }),
      ]),
      bg ? el('p', { class: 'note', text: bg.blurb }) : el('p', { class: 'note', text: 'Your past predates the logs — the lanes remember what you choose to do next.' }),
      bg?.leans ? el('p', { class: 'note', title: 'Leans toward — the skill disciplines this past pairs best with. Find them in the Skills tab. A nudge, never a lock.', text: `Leans toward: ${bg.leans}` }) : null,
      drive
        ? el('div', { class: 'kv' }, [el('span', { text: 'Drive' }), el('b', { text: drive.name })])
        : null,
      drive ? el('p', { class: 'note', text: drive.blurb }) : null,
    ]);
    left.append(dossier);

    const oath = el('div', { class: 'panel', style: 'margin-top:14px' }, [el('h3', { text: 'Allegiance' })]);
    if (state.allegiance) {
      const f = FACTIONS[state.allegiance];
      oath.append(
        el('div', { class: 'kv' }, [el('span', { text: 'Sworn to' }), el('b', { text: f?.name || state.allegiance })]),
        el('div', { class: 'kv' }, [el('span', { text: 'Standing' }), el('b', { text: `${state.rep[state.allegiance] ?? 0}` })]),
        el('p', { class: 'note', text: 'Sworn colours open doors: standing with your flag grows 10% faster. The elites of every discipline still answer only to deeds.' }),
        el('div', { style: 'margin-top:8px' }, [btn('Renounce the oath', () => actions.actRenounceFaction(), 'btn small danger')]),
      );
    } else {
      oath.append(el('p', { class: 'note', text: 'Swearing marks your transponder with a flag: standing with them grows 10% faster, and their recruiters keep the best desks open. Learned ranks stay if you later renounce.' }));
      for (const fid of ['vigil', 'combine', 'reaver', 'free', 'kreth']) {
        const f = FACTIONS[fid];
        const rep = state.rep[fid] ?? 0;
        const here = station?.owner === fid;
        const ready = rep >= FACTION_ALLEGIANCE_REP;
        const b = btn(ready ? 'Swear the oath' : `${rep}/40 standing`, () => actions.actJoinFaction(fid), `btn small ${ready && here ? 'primary' : ''}`);
        b.disabled = !(ready && here);
        if (ready && !here) b.title = `Travel to a ${f.name} station to swear.`;
        oath.append(
          el('div', { class: 'kv' }, [
            el('span', { text: `${f.name}${here ? ' · this station' : ''}` }),
            el('b', { text: `${rep >= 0 ? '+' : ''}${rep}` }),
          ]),
          el('div', { style: 'margin:4px 0 8px' }, [b]),
        );
      }
    }
    left.append(oath);

    // ---- right: skill-point summary; the trees live in the Skills tab ----
    const points = state.skillPoints || 0;
    const right = el('div', {}, [
      el('h2', { text: 'Skill points' }),
      el('div', { class: 'kbanner' }, [
        el('b', { class: 'bignum', text: String(points) }),
        el('span', { class: 'note', text: points ? 'unspent — open the Skills tab to train' : 'nothing unspent — one point arrives with each level' }),
      ]),
      el('p', { class: 'note', text: 'Six disciplines — Defence, Offence, Economic, Propulsion, Fleet and Diplomatic. Tiers open as you invest ranks; the tier-4 elites unlock through story chapters and side jobs. In flight, press K for the same tree.' }),
      el('div', { style: 'margin:10px 0 4px' }, [
        btn('Open the skill tree', () => {
          this.tab = 'skills';
          this.render();
        }, 'btn primary'),
      ]),
      el('div', { style: 'margin-top:12px' }, SKILL_TREES.map((t) => el('div', { class: 'kv' }, [
        el('span', { style: `color:${t.color}`, text: t.name }),
        el('b', { text: `${treeRanks(state, t.id)} ranks` }),
      ]))),
    ]);

    this.body.append(el('div', { class: 'career-cols' }, [left, right]));
  }

  _xpBar(prog) {
    const fill = el('i');
    fill.style.width = `${clamp((prog.into / prog.span) * 100, 0, 100)}%`;
    return el('div', { class: 'bar' }, [
      el('div', { class: 'lbl' }, [
        el('span', { text: `Level ${prog.level}` }),
        el('span', { text: prog.maxed ? 'MAX' : `${prog.into} / ${prog.span} XP` }),
      ]),
      el('div', { class: 'fill' }, [fill]),
    ]);
  }

  _skillCard(skill, state, actions) {
    const rank = skillRank(state, skill.id);
    const reason = learnBlockReason(state, skill.id);
    const cost = skill.cost || 1;
    const maxed = rank >= skill.max;
    const pips = Array.from({ length: skill.max }, (_, i) => (i < rank ? '●' : '○')).join(' ');
    const learn = btn(maxed ? 'Mastered' : `Learn (${cost})`, () => actions.actLearnSkill(skill.id), `btn tiny ${reason ? '' : 'primary'}`);
    learn.disabled = maxed || !!reason;
    if (reason) learn.title = reason;
    return el('div', { class: `skill-card ${rank > 0 ? 'owned' : ''} ${reason ? 'blocked' : ''}` }, [
      el('h4', {}, [skill.name, el('span', { class: 'pips', text: pips })]),
      el('div', { class: 'cstats', text: `Tier ${skill.tier}` }),
      el('div', { class: 'sdesc', text: skill.desc }),
      el('div', { class: 'seffect', text: this._skillEffectText(skill) }),
      el('div', { class: 'sfoot2' }, [
        el('span', { class: 'why', text: reason || '' }),
        learn,
      ]),
    ]);
  }

  _skillEffectText(skill) {
    const parts = [];
    if (skill.stat && skill.add) {
      const label = STAT_LABELS[skill.stat] || skill.stat;
      const v = skill.stat === 'turn' ? `${Math.round(skill.add * 57.3)}°/s` : `${skill.add}`;
      parts.push(`${label} +${v} / rank`);
    }
    const MOD_LABELS = {
      dmg: 'Weapon damage', dmgTaken: 'Damage taken', buy: 'Buy prices', sell: 'Sell prices',
      illegalSell: 'Contraband prices', repair: 'Repair costs', contract: 'Contract pay',
      survey: 'Survey bounties', podCredits: 'Salvage value', killLoot: 'Kill drops',
      repGain: 'Reputation gains', repLossCut: 'Reputation losses',
      wingDmg: 'Wing damage', wingArmor: 'Wing durability',
    };
    if (skill.mod) {
      for (const [key, per] of Object.entries(skill.mod)) {
        const pct = Math.round(per * 100);
        parts.push(`${MOD_LABELS[key] || key} ${pct > 0 ? '+' : ''}${pct}% / rank`);
      }
    }
    return parts.join(' · ');
  }

  /* ------------------------------------------------------------------ */
  /* Contracts                                                          */
  /* ------------------------------------------------------------------ */

  _renderContracts() {
    const { state, station, actions } = this.ctx;

    // ---- the three storylines ----
    const s = story.ensureStory(state);
    this.body.append(el('h2', { text: 'The story so far' }));
    this.body.append(el('p', { class: 'note', text: 'Three paths run through the Ten. Follow any of them to the third chapter — the fourth is an oath, and it closes the other two for good. Story assignments do not count against your contract limit.' }));
    for (const line of Object.values(story.STORY_LINES)) {
      const rank = s.rank[line.id] || 0;
      const closed = !!s.oath && s.oath !== line.id;
      const done = rank >= line.chapters.length;
      const pips = line.chapters.map((_, i) => (i < rank ? '●' : '○')).join(' ');
      const status = done ? 'complete' : closed ? 'path closed' : `chapter ${rank + 1} of ${line.chapters.length}`;
      this.body.append(el('div', { class: `story-row ${closed ? 'closed' : ''}`, style: `--mcol: ${line.color}` }, [
        el('h4', { text: line.name }),
        el('span', { class: 'srank', text: `${pips} · ${status}` }),
        el('p', { class: 'note', text: line.blurb }),
      ]));
    }
    const storyBoard = story.storyOffers(state, station).filter((o) => !state.missions.some((m) => m.id === o.id));
    for (const o of storyBoard) {
      const line = story.STORY_LINES[o.story.line];
      const accept = btn(o.story.oath ? 'Swear the oath' : 'Take the assignment', () => actions.actAcceptMission(o.id), `btn small ${o.story.oath ? 'danger' : 'primary'}`);
      this.body.append(el('div', { class: `mission ${o.type}`, style: `--mcol: ${line.color}` }, [
        el('div', {
          class: 'mtag',
          html: `${line.name.toUpperCase()} · CHAPTER ${o.story.chapter}${o.story.oath ? ' · <span class="urgent">OATH — CLOSES THE OTHER PATHS</span>' : ''}`,
        }),
        el('h4', { text: o.title }),
        el('p', { text: o.desc }),
        el('div', { class: 'mfoot' }, [
          el('span', { class: 'mwhere' }, [
            el('span', { class: 'mdest', text: `▸ ${SYSTEMS[o.dest.systemId].name}` }),
            el('span', { text: `₡${o.reward.toLocaleString()}` }),
          ]),
          accept,
        ]),
      ]));
    }

    // ---- side work: notices pinned by whoever needs something ----
    const notices = sidequests.sideOffers(state, station).filter((o) => !state.missions.some((m) => m.id === o.id));
    if (notices.length) {
      this.body.append(el('h3', { text: 'Notices & side work' }));
      this.body.append(el('p', { class: 'note', text: 'Small chains left by strangers, colleagues and old friends. Finish a whole chain for a lasting edge.' }));
      const heldNow = state.missions.filter((m) => !m.story).length;
      for (const o of notices) {
        const quest = sidequests.SIDE_BY_ID[o.side.group];
        const accept = btn(`Take it on (${o.side.step + 1}/${quest.steps.length})`, () => actions.actAcceptMission(o.id), 'btn small primary');
        if (heldNow >= missions.MAX_ACTIVE) accept.disabled = true;
        this.body.append(el('div', { class: `mission ${o.type}`, style: `--mcol: ${quest.color}` }, [
          el('div', { class: 'mtag', html: `${quest.name.toUpperCase()} · STEP ${o.side.step + 1} OF ${quest.steps.length}` }),
          el('h4', { text: o.title }),
          el('p', { text: o.desc }),
          el('div', { class: 'mfoot' }, [
            el('span', { class: 'mwhere' }, [
              el('span', { class: 'mdest', text: `▸ ${SYSTEMS[o.dest.systemId].name}` }),
              el('span', { text: `₡${o.reward.toLocaleString()}` }),
            ]),
            accept,
          ]),
        ]));
      }
    }

    // active
    this.body.append(el('h2', { text: 'Your contracts' }));
    if (!state.missions.length) {
      this.body.append(el('p', { class: 'note', text: 'No active contracts. The board below is always open.' }));
    }
    const activeWrap = el('div', { style: 'margin-top:10px' });
    for (const m of state.missions) {
      const line = m.story ? story.STORY_LINES[m.story.line] : null;
      const sideQ = m.side ? sidequests.SIDE_BY_ID[m.side.group] : null;
      const tag = line ? `${line.name} · CH ${m.story.chapter}`
        : sideQ ? `${sideQ.name} · ${m.side.step + 1}/${sideQ.steps.length}`
          : (missions.MISSION_TAGS[m.type] || 'CONTRACT');
      const ready = missions.completionsAt(state, this.ctx.systemId, station.id).some((r) => r.mission.id === m.id);
      const progress = missions.missionProgress(m);
      let status = formatDeadline(m.deadlineDay, state.day);
      if (m.type === 'survey' && m.scanned) status = 'survey recorded';
      if (m.type === 'recovery' && m.pods && m.pods.taken.length >= m.pods.need) status = 'pods ready to hand over';
      const cardAttrs = { class: `mission ${m.type}` };
      if (line) cardAttrs.style = `--mcol: ${line.color}`;
      else if (sideQ) cardAttrs.style = `--mcol: ${sideQ.color}`;
      activeWrap.append(el('div', cardAttrs, [
        el('div', {
          class: 'mtag',
          html: `${tag} · ${missions.tierStars(m.tier)}${m.urgent ? ' · <span class="urgent">URGENT</span>' : ''}${twistChip(m.twist)} · ${status}`,
        }),
        el('h4', { text: m.title }),
        el('p', { text: m.desc }),
        progress ? el('p', { class: 'note', style: 'color: var(--mcol); opacity: 0.92', text: progress }) : null,
        el('div', { class: 'mfoot' }, [
          el('span', { class: 'mwhere' }, [
            el('span', { class: 'mdest', text: `▸ ${SYSTEMS[m.dest.systemId].name}` }),
            el('span', { text: `₡${m.reward.toLocaleString()}` }),
          ]),
          el('div', { style: 'display:flex;gap:6px' }, [
            ready ? btn('Complete', () => actions.actCompleteMission(m.id), 'btn small primary') : null,
            btn('Abandon', () => actions.actAbandonMission(m.id), 'btn small ghost'),
          ]),
        ]),
      ]));
    }
    this.body.append(activeWrap);

    // board
    this.body.append(el('h3', { text: `Board — day ${state.day} · your renown ${missions.tierStars(missions.playerTier(state))}` }));
    this.body.append(el('p', { class: 'note', text: 'Bold work finds you as your renown grows: more stars, tougher marks, fatter pay. One star is honest cargo runs; eight stars is a war.' }));
    const offers = missions.generateBoard(state, station)
      .filter((o) => !state.missions.some((m) => m.id === o.id));
    const boardWrap = el('div', { style: 'margin-top:8px' });
    for (const o of offers) {
      const tag = missions.MISSION_TAGS[o.type] || 'CONTRACT';
      const accept = btn('Accept', () => actions.actAcceptMission(o.id), 'btn small primary');
      if (state.missions.filter((m) => !m.story).length >= missions.MAX_ACTIVE) accept.disabled = true;
      boardWrap.append(el('div', { class: `mission ${o.type}` }, [
        el('div', {
          class: 'mtag',
          html: `${tag} · ${missions.tierStars(o.tier)}${o.urgent ? ' · <span class="urgent">URGENT</span>' : ''}${twistChip(o.twist)} · by day ${o.deadlineDay}`,
        }),
        el('h4', { text: o.title }),
        el('p', { text: o.desc }),
        el('div', { class: 'mfoot' }, [
          el('span', { class: 'mwhere' }, [
            el('span', { class: 'mdest', text: `▸ ${SYSTEMS[o.dest.systemId].name}` }),
            el('span', { text: `₡${o.reward.toLocaleString()}` }),
          ]),
          accept,
        ]),
      ]));
    }
    this.body.append(boardWrap);

    const rng = rngOf(state.worldSeed, 'rumor', station.id, state.day);
    this.body.append(el('p', { class: 'note', style: 'margin-top:16px;font-style:italic', text: `“${rng.pick(RUMORS)}” — someone at the bar` }));
  }

  /* ------------------------------------------------------------------ */
  /* Berth: status + services                                           */
  /* ------------------------------------------------------------------ */

  _renderBerth() {
    const { state, station, systemId, actions, system } = this.ctx;
    const stats = computeStats(state);
    const player = actions.universe.player;
    const refuelCost = (stats.lumenMax - state.lumen) * LUMEN_REFUEL_COST;

    const status = el('div', { class: 'panel' }, [
      el('h2', { text: state.shipName }),
      el('p', { class: 'note', text: `${player.def.name} · ${player.def.cls}` }),
      el('div', { class: 'kv' }, [el('span', { text: 'Hull' }), el('b', { text: `${Math.ceil(player.hull)} / ${stats.hull}` })]),
      el('div', { class: 'kv' }, [el('span', { text: 'Shield' }), el('b', { text: `${Math.ceil(player.shield)} / ${stats.shield}` })]),
      el('div', { class: 'kv' }, [el('span', { text: 'Charge' }), el('b', { text: `${Math.round(player.energy)} / ${stats.energy}` })]),
      el('div', { class: 'kv' }, [el('span', { text: 'Hold' }), el('b', { text: `${state.cargoUsed()} / ${stats.cargo}` })]),
      el('div', { class: 'kv' }, [el('span', { text: 'Lumen' }), el('b', { text: `${state.lumen} / ${stats.lumenMax}` })]),
      el('h3', { text: 'Weapons' }),
      ...state.weapons.slice(0, stats.mounts).map((wid, i) => el('div', { class: 'kv' }, [
        el('span', { text: `Hardpoint ${i + 1}` }),
        el('b', { text: wid ? WEAPON_BY_ID[wid].name : '—' }),
      ])),
      el('h3', { text: 'Fitted systems' }),
      ...Object.entries(state.outfits)
        .filter(([, lvl]) => lvl > 0)
        .map(([id, lvl]) => el('div', { class: 'kv' }, [
          el('span', { text: OUTFIT_BY_ID[id]?.name || id }),
          el('b', { text: `level ${lvl}` }),
        ])),
      ...(Object.keys(state.outfits).length ? [] : [el('p', { class: 'note', text: 'No upgrades fitted yet.' })]),
    ]);

    const services = el('div', {}, [el('h2', { text: 'Dockside services' })]);
    const svcGrid = el('div', { class: 'services-grid', style: 'margin-top:10px' });

    if (station.services.includes('refuel')) {
      svcGrid.append(el('div', { class: 'svc' }, [
        el('h4', { text: 'Lumen berth' }),
        el('p', { text: 'Refill the lumen bunkers. Hull work is the mechanic’s trade — see the Mechanic tab.' }),
        el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, [
          this._priceBtn(`Refuel full (${fmtCredits(refuelCost)})`, refuelCost === 0, () => actions.actRefuel()),
        ]),
      ]));
    }

    const holesFound = Object.keys(state.wormholes || {}).length;
    if (holesFound > 0) {
      svcGrid.append(el('div', { class: 'svc' }, [
        el('h4', { text: 'Wormhole Consortium' }),
        el('p', {
          text: state.wormholeLicence
            ? `Licence active — your ship carries trade cargo through the holes, and convoys at a wormhole system earn +25%. ${holesFound} wormhole${holesFound > 1 ? 's' : ''} on your charts.`
            : 'Wormholes move freight faster than any lane. Without the Consortium licence only personal passage — an empty hold — is allowed through. Licensed captains also earn +25% at holdings anchored to a wormhole system.',
        }),
        state.wormholeLicence
          ? el('p', { class: 'note', style: 'margin:0', text: `Licence held · ${holesFound} wormhole${holesFound > 1 ? 's' : ''} mapped` })
          : this._priceBtn(`Buy shipping licence (${fmtCredits(WORMHOLE_LICENCE_COST)})`, state.credits < WORMHOLE_LICENCE_COST, () => actions.actBuyWormholeLicence()),
      ]));
    }

    svcGrid.append(el('div', { class: 'svc' }, [
      el('h4', { text: 'Ship’s log' }),
      el('p', { text: 'Your adventure auto-saves here each dock. Write a manual save any time.' }),
      btn('Save adventure…', () => actions.openSaveFromDock(), 'btn small primary'),
    ]));

    svcGrid.append(el('div', { class: 'svc' }, [
      el('h4', { text: 'Career' }),
      el('p', {
        class: 'note',
        text: `Kills ${state.stats.kills} · deaths ${state.stats.deaths} · jumps ${state.stats.jumps} · contracts ${state.missionsDone} done, ${state.missionsFailed} failed`,
      }),
      el('p', { class: 'note', text: `Reputation — Combine ${state.rep.combine}, Vigil ${state.rep.vigil}, Reavers ${state.rep.reaver}, Free ports ${state.rep.free}` }),
    ]));

    services.append(svcGrid);
    services.append(el('p', { class: 'note', style: 'margin-top:12px', text: `${SYSTEMS[systemId].name} — ${SYSTEMS[systemId].desc}` }));

    this.body.append(el('div', { class: 'cols' }, [status, services]));
  }

  _priceBtn(label, disabled, fn) {
    const b = btn(label, fn, 'btn small');
    b.disabled = !!disabled;
    return b;
  }
}
