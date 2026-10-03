// The ship's computer: the star map, the mission manifest, the ship's inventory
// and the ship's log — one screen, sections grouped down the left rail like the
// station menu. M or J opens it in flight, Escape (or Back to helm) closes it.

import { el, clear, btn } from './dom.js';
import { buildLog, missionCard } from './log.js';
import { ChartUI } from './chart.js';
import { SYSTEMS, routeBetween } from '../data/systems.js';
import { COMMODITY_BY_ID } from '../data/commodities.js';
import { WEAPON_BY_ID } from '../data/weapons.js';
import { OUTFIT_BY_ID } from '../data/outfits.js';
import { SHIP_BY_ID } from '../data/ships.js';
import { computeStats } from '../game/state.js';
import { sellPrice } from '../game/economy.js';
import { MISSION_COLORS, MISSION_TAGS, tierStars, missionProgress, missionGuide, missionStationName } from '../game/missions.js';
import { STORY_LINES } from '../game/story.js';
import { SIDE_BY_ID } from '../game/sidequests.js';
import { fmtCredits, fmtNum, formatDeadline } from '../core/util.js';

/** Accent colour for a mission, matching the boards and map markers. */
function missionColor(m) {
  if (m.story) return STORY_LINES[m.story.line]?.color || '#ffd166';
  if (m.side) return SIDE_BY_ID[m.side.group]?.color || '#63ffc0';
  return MISSION_COLORS[m.type] || '#ffd166';
}

/** One-line tag for a mission (story chapter, side-quest step, or contract). */
function missionTag(m) {
  if (m.story) {
    const line = STORY_LINES[m.story.line];
    return `${line ? line.name : 'Story'} · CH ${m.story.chapter}`;
  }
  if (m.side) {
    const q = SIDE_BY_ID[m.side.group];
    return `${q ? q.name : 'Side quest'} · step ${m.side.step + 1}`;
  }
  return MISSION_TAGS[m.type] || 'CONTRACT';
}

export class ComputerUI {
  constructor(root) {
    this.root = root;
    this.wrap = null;
    this.ctx = null;
    this.tab = 'map';
    this.chart = new ChartUI();
    /** Selected mission whose course is plotted on the star map. */
    this.missionId = null;
  }

  open(tab = 'map', ctx) {
    this.ctx = ctx;
    if (ctx.trackedMissionId !== undefined) this.missionId = ctx.trackedMissionId || null;
    const ids = this._nav().flatMap((g) => g.items.map((i) => i.id));
    this.tab = ids.includes(tab) ? tab : 'map';
    if (!this.wrap) {
      this.head = el('div', { class: 'comp-head' });
      this.nav = el('div', { class: 'ui-nav' });
      this.body = el('div', { class: 'comp-body' });
      this.shell = el('div', { class: 'comp-shell' }, [
        this.head,
        el('div', { class: 'ui-split' }, [this.nav, this.body]),
      ]);
      this.wrap = el('div', { class: 'computerui' }, [this.shell]);
      this.root.append(this.wrap);
    }
    this.render();
  }

  close() {
    this.chart.unmount();
    this.wrap?.remove();
    this.wrap = null;
    this.ctx = null;
  }

  /** The mission behind the plotted course — null once it leaves the manifest. */
  _selectedMission() {
    const m = (this.ctx?.state.missions || []).find((mm) => mm.id === this.missionId);
    if (!m) this.missionId = null;
    return m || null;
  }

  /** Lane route from the captain's position to a system (or null). */
  _routeTo(systemId) {
    return routeBetween(this.ctx.state.systemId, systemId);
  }

  /** Sections for the rail — same grouped pattern as the station menu. */
  _nav() {
    const { state } = this.ctx;
    const active = (state.missions || []).length;
    const cargo = state.cargoUsed?.() || 0;
    return [
      {
        label: 'The lanes',
        items: [
          { id: 'map', label: 'Star map', hint: `Now at ${SYSTEMS[state.systemId].name}` },
          { id: 'missions', label: 'Missions', hint: 'Contracts, story & courses', badge: active },
        ],
      },
      {
        label: 'Aboard',
        items: [
          { id: 'inventory', label: 'Inventory', hint: 'Hold, systems & fleet', badge: cargo },
        ],
      },
      {
        label: 'Records',
        items: [
          { id: 'logs', label: 'Logs', hint: 'Story, codex & record' },
        ],
      },
    ];
  }

  /** Track (or clear) the job whose course is plotted on the star map. */
  trackMission(id) {
    this.missionId = id && id !== this.missionId ? id : null;
    this.ctx?.onTrackMission?.(this.missionId);
    return this.missionId;
  }

  render() {
    if (!this.ctx?.state) return;
    const { state } = this.ctx;

    // ---- head ----
    clear(this.head);
    this.head.append(
      el('h2', { text: 'Ship’s computer' }),
      el('span', {
        class: 'note',
        text: `${state.commander} · ${state.shipName} · day ${state.day} · ${SYSTEMS[state.systemId].name}`,
      }),
      el('div', { class: 'spacer' }),
      btn('Back to helm', () => this.ctx.onClose(), 'btn'),
    );

    // ---- navigation: sections grouped like the station rail ----
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
    this.chart.unmount();
    this._selectedMission(); // drop the selection if the job is gone
    this.ctx.onTrackMission?.(this.missionId); // keep the game's tracker in step
    switch (this.tab) {
      case 'map': this._renderMap(); break;
      case 'missions': this._renderMissions(); break;
      case 'inventory': this._renderInventory(); break;
      case 'logs': this._renderLogs(); break;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Star map                                                           */
  /* ------------------------------------------------------------------ */

  _renderMap() {
    const { state, actions, onJump, warpBlock, hasPlotter } = this.ctx;
    const pane = el('div', { class: 'comp-pane map-pane' });
    this.body.append(pane);

    const selected = this._selectedMission();
    const guide = selected ? missionGuide(state, selected, state.systemId) : null;
    const route = guide?.systemId ? this._routeTo(guide.systemId) : null;

    this.chart.mount(pane, {
      state,
      actions,
      onJump,
      warpBlock,
      hasPlotter,
      route,
      routeMissionId: selected?.id ?? null,
      routeTitle: selected?.title ?? null,
      routeColor: selected ? missionColor(selected) : null,
      onTrackMission: (id) => { this.trackMission(id); this.render(); },
      onRouteClear: () => {
        this.missionId = null;
        this.ctx.onTrackMission?.(null);
        this.render();
      },
    });
  }

  /* ------------------------------------------------------------------ */
  /* Missions                                                           */
  /* ------------------------------------------------------------------ */

  _renderMissions() {
    const { state, actions } = this.ctx;
    const listPane = el('div', { class: 'mission-list' });
    const detailPane = el('div', { class: 'mission-detail' });
    this.body.append(el('div', { class: 'missions-grid' }, [listPane, detailPane]));

    const missions = [...(state.missions || [])].sort((a, b) => (a.deadlineDay ?? 0) - (b.deadlineDay ?? 0));

    listPane.append(el('p', {
      class: 'note',
      text: missions.length
        ? 'Pick a job to track it — its details open here and its course lights up on the star map. Pick it again to clear the course.'
        : 'No active work on the manifest. Station bars and the contracts boards carry jobs.',
    }));

    for (const m of missions) {
      const picked = m.id === this.missionId;
      const prog = missionProgress(m);
      const g = missionGuide(state, m, state.systemId);
      const gWhere = g.systemId
        ? (g.stationId ? `${missionStationName(g.systemId, g.stationId)} \u00b7 ${SYSTEMS[g.systemId].name}` : SYSTEMS[g.systemId].name)
        : '\u2014';
      const row = el('div', {
        class: `mrow ${m.type} ${picked ? 'sel' : ''}`,
        style: `--mcol: ${missionColor(m)}`,
        onclick: () => {
          // track toggles: the detail pane follows, the course lights on the map
          this.trackMission(m.id);
          this.render();
        },
      }, [
        el('div', { class: 'mtop' }, [
          el('b', { text: m.title }),
          picked ? el('span', { class: 'mtrack', text: '◆ tracked' }) : null,
          el('span', { class: 'mrew', text: `₡${m.reward.toLocaleString()}` }),
        ]),
        el('div', { class: 'mwhere' }, [
          el('span', { class: 'mdest', text: `▸ ${SYSTEMS[m.dest?.systemId]?.name || '—'}` }),
          el('span', {
            class: 'msub',
            html: `${missionTag(m)} · ${tierStars(m.tier)}${m.urgent ? ' · <span class="urgent">URGENT</span>' : ''}`
              + ` · ${formatDeadline(m.deadlineDay, state.day)}`
              + (prog ? ` · ${prog}` : ''),
          }),
        ]),        el('div', { class: `mnext${g.phase === 'return' ? ' return' : ''}` }, [
          el('span', { class: 'mverb', text: g.phase === 'return' ? '\u25c0 RETURN TO' : g.verb }),
          ` ${gWhere}${g.here ? ' \u00b7 you are here' : ''}`,
        ]),      ]);
      listPane.append(row);
    }

    // ---- detail panel ----
    const m = this._selectedMission();
    if (!m) {
      detailPane.append(el('div', { class: 'panel' }, [
        el('h2', { text: 'Flight plan' }),
        el('p', {
          class: 'note',
          text: 'Select a job from the list and its course is drawn on the star map — every lane from your position to the destination, turn by turn.',
        }),
        missions.length ? null : el('p', { class: 'note', text: `Completed ${state.missionsDone || 0} · failed ${state.missionsFailed || 0} · day ${state.day}` }),
      ]));
      return;
    }
    detailPane.append(
      el('div', { class: 'tracked-band', style: `--mcol: ${missionColor(m)}` }, [
        el('span', { class: 'tb-chip', text: '◆ Tracked' }),
        el('span', { class: 'tb-note', text: 'Course lit on the star map' }),
      ]),
      missionCard(state, m),
    );
    const guide = missionGuide(state, m, state.systemId);
    const route = guide.systemId ? this._routeTo(guide.systemId) : null;
    const whereName = guide.systemId
      ? (guide.stationId ? `${missionStationName(guide.systemId, guide.stationId)} \u00b7 ${SYSTEMS[guide.systemId].name}` : SYSTEMS[guide.systemId].name)
      : null;
    const routePanel = el('div', { class: 'panel' }, [
      el('h3', { text: whereName ? `${guide.phase === 'return' ? '\u25c0 Return course' : 'Course'} \u2014 ${whereName}` : 'Course' }),
      el('p', { class: 'note', text: `${guide.verb}${guide.here ? ' \u00b7 you are already in this system' : ''} \u2014 ${guide.note}` }),
    ]);
    if (!route) {
      routePanel.append(el('p', { class: 'note', text: 'No lane route found \u2014 something is off the charts.' }));
    } else if (route.length === 1) {
      routePanel.append(el('p', { class: 'note', text: guide.stationId
        ? `You are in ${SYSTEMS[guide.systemId].name} \u2014 dock at ${missionStationName(guide.systemId, guide.stationId)} to finish it.`
        : `You are already in ${SYSTEMS[guide.systemId].name}.` }));
    } else {
      routePanel.append(el('p', {
        class: 'note',
        text: `${route.length - 1} lane${route.length === 2 ? '' : 's'}: `
          + route.map((id) => SYSTEMS[id].name).join(' → '),
      }));
    }
    routePanel.append(el('div', { class: 'msel-actions' }, [
      btn('Open star map', () => {
        this.tab = 'map';
        this.render();
      }, 'btn primary small'),
      btn('Drop contract', () => {
        actions.actAbandonMission(m.id);
        this.missionId = null;
        this.render();
      }, 'btn small ghost'),
    ]));
    detailPane.append(routePanel);
  }

  /* ------------------------------------------------------------------ */
  /* Inventory                                                          */
  /* ------------------------------------------------------------------ */

  _renderInventory() {
    const { state } = this.ctx;
    const stats = computeStats(state);
    const grid = el('div', { class: 'inv-grid' });
    this.body.append(grid);

    // ---- hold ----
    const hold = el('div', { class: 'panel' }, [
      el('h2', { text: 'Hold' }),
      el('div', { class: 'kv' }, [el('span', { text: 'Capacity' }), el('b', { text: `${state.cargoUsed()} / ${stats.cargo}` })]),
      el('div', { class: 'kv' }, [el('span', { text: 'Free space' }), el('b', { text: String(Math.max(0, stats.cargo - state.cargoUsed())) })]),
    ]);
    const entries = Object.entries(state.cargo).filter(([, q]) => q > 0);
    let holdValue = 0;
    if (!entries.length) hold.append(el('p', { class: 'note', text: 'Empty — the market tab at any station is where cargo comes from.' }));
    for (const [id, qty] of entries) {
      const c = COMMODITY_BY_ID[id];
      const unit = sellPrice(state, state.systemId, id);
      holdValue += unit * qty;
      hold.append(el('div', { class: 'kv' }, [
        el('span', { text: `${c?.name || id} × ${qty}` }),
        el('b', { text: `₡${(unit * qty).toLocaleString()}` }),
      ]));
    }
    for (const m of state.missions) {
      if (m.cargoLoaded) {
        hold.append(el('div', { class: 'kv' }, [
          el('span', { text: `contract: ${COMMODITY_BY_ID[m.cargoLoaded.id]?.name || m.cargoLoaded.id} × ${m.cargoLoaded.qty}` }),
          el('b', { text: 'bonded' }),
        ]));
      }
    }
    if (holdValue > 0) {
      hold.append(el('p', { class: 'note', text: `Hold sells here for about ₡${holdValue.toLocaleString()}.` }));
    }
    grid.append(hold);

    // ---- fitted systems ----
    const fits = el('div', { class: 'panel' }, [el('h2', { text: 'Fitted systems' })]);
    fits.append(el('h3', { text: 'Weapons' }));
    const mounts = stats.mounts ?? state.weapons.length;
    for (let i = 0; i < Math.max(mounts, state.weapons.length); i++) {
      const wid = state.weapons[i];
      const w = wid ? WEAPON_BY_ID[wid] : null;
      fits.append(el('div', { class: 'kv' }, [
        el('span', { text: `Hardpoint ${i + 1}` }),
        el('b', {
          text: w
            ? `${w.name}${w.kind === 'missile' ? ` · ${state.ammo[wid] || 0} in the racks` : ''}`
            : '—',
        }),
      ]));
    }
    fits.append(el('h3', { text: 'Outfits' }));
    const outfits = Object.entries(state.outfits || {}).filter(([, lvl]) => lvl > 0);
    if (!outfits.length) fits.append(el('p', { class: 'note', text: 'No upgrades fitted — mechanics along the lanes sell them.' }));
    for (const [id, lvl] of outfits) {
      fits.append(el('div', { class: 'kv' }, [
        el('span', { text: OUTFIT_BY_ID[id]?.name || id }),
        el('b', { text: `level ${lvl}` }),
      ]));
    }
    grid.append(fits);

    // ---- purse & ship ----
    const purse = el('div', { class: 'panel' }, [
      el('h2', { text: 'Purse & ship' }),
      el('p', { class: 'note', text: `${SHIP_BY_ID[state.shipId]?.name || state.shipId} · ${state.shipName}` }),
      el('div', { class: 'kv' }, [el('span', { text: 'Credits' }), el('b', { text: fmtCredits(state.credits) })]),
      el('div', { class: 'kv' }, [el('span', { text: 'Lumen tanks' }), el('b', { text: `${state.lumen} / ${stats.lumenMax}` })]),
      el('div', { class: 'kv' }, [el('span', { text: 'Hull / shield' }), el('b', { text: `${fmtNum(stats.hull)} / ${fmtNum(stats.shield)}` })]),
      el('div', { class: 'kv' }, [el('span', { text: 'Compartments' }), el('b', { text: `mounts ${stats.mounts} · bays ${stats.bays || 0} · escorts ${stats.fleetSlots || 0}` })]),
    ]);
    const pods = this.ctx.game?.universe?.pods?.length || 0;
    if (pods > 0) purse.append(el('p', { class: 'note', text: `${pods} salvage pod${pods === 1 ? '' : 's'} adrift in this system.` }));
    grid.append(purse);

    // ---- fleet ----
    const fleet = el('div', { class: 'panel' }, [el('h2', { text: 'Fleet' })]);
    if (!state.fleet?.length) {
      fleet.append(el('p', { class: 'note', text: 'No other hulls fly your colours yet.' }));
    } else {
      for (const entry of state.fleet) {
        fleet.append(el('div', { class: 'kv' }, [
          el('span', { text: entry.name }),
          el('b', { text: `${SHIP_BY_ID[entry.shipId]?.name || entry.shipId} · ${entry.status === 'escort' ? 'flying wing' : 'docked'}` }),
        ]));
      }
    }
    grid.append(fleet);
  }

  /* ------------------------------------------------------------------ */
  /* Logs                                                               */
  /* ------------------------------------------------------------------ */

  _renderLogs() {
    const pane = el('div', { class: 'comp-pane logs-pane' });
    this.body.append(pane);
    // the manifest lives in the Missions tab, so the log keeps the record & codex
    pane.append(buildLog(this.ctx.state, { missionLog: false, style: 'flex:none;min-height:0' }));
  }
}
