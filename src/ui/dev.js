// Developer mode: Alt+D toggles a blue-washed viewscreen with cheat tools —
// level editing, free skill ranks, and instant warp to any system.

import { el, btn } from './dom.js';
import { SKILL_TREES } from '../data/skills.js';
import { XP_TABLE, levelFromXp } from '../game/skills.js';
import { SYSTEMS, RIM_RADIUS, laneAngle } from '../data/systems.js';
import { clamp } from '../core/util.js';

export class DevMode {
  constructor(app, game) {
    this.app = app;
    this.game = game;
    this.on = false;

    // viewscreen wash + tag (pointer-free) and the tool panel
    this.glow = el('div', { class: 'dev-glow hidden' });
    this.tag = el('div', { class: 'dev-tag hidden', text: 'dev mode' });
    this.panel = el('div', { class: 'dev-panel hidden' });
    app.append(this.glow, this.tag, this.panel);

    this._build();
    window.addEventListener('keydown', (e) => this._onKey(e), true);
  }

  /* ------------------------------------------------------------------ */
  /* Toggle                                                              */
  /* ------------------------------------------------------------------ */

  _onKey(e) {
    if (e.altKey && e.code === 'KeyD' && !e.repeat) {
      // keep the browser (and the helm keybinds) from seeing the combo
      e.preventDefault();
      e.stopImmediatePropagation();
      this.toggle();
    }
  }

  toggle(force) {
    this.on = force ?? !this.on;
    for (const node of [this.glow, this.tag, this.panel]) node.classList.toggle('hidden', !this.on);
    if (this.on) this._refresh();
  }

  /* ------------------------------------------------------------------ */
  /* Panel                                                               */
  /* ------------------------------------------------------------------ */

  _build() {
    this.lvlText = el('b', { text: 'Lv 1' });
    this.xpText = el('span', { class: 'rk', text: '' });
    this.warpSelect = el('select');
    for (const [id, sys] of Object.entries(SYSTEMS)) {
      this.warpSelect.append(el('option', { value: id, text: sys.name }));
    }
    this.skillsWrap = el('div');

    this.panel.append(
      el('div', { class: 'dev-head' }, ['dev tools', el('span', { class: 'dev-hint', text: 'alt+d to hide' })]),
      el('div', { class: 'dev-section' }, [
        el('h4', { text: 'Level' }),
        el('div', { class: 'dev-row' }, [
          el('span', { class: 'nm', text: 'Commander' }),
          btn('\u2212', () => this._stepLevel(-1), 'dev-btn'),
          this.lvlText,
          btn('+', () => this._stepLevel(1), 'dev-btn'),
          this.xpText,
        ]),
      ]),
      el('div', { class: 'dev-section' }, [
        el('h4', { text: 'Free warp' }),
        el('div', { class: 'dev-row' }, [
          this.warpSelect,
          btn('Warp', () => this._warp(this.warpSelect.value), 'dev-btn'),
        ]),
      ]),
      el('div', { class: 'dev-section' }, [
        el('h4', { text: 'Vector Challenge' }),
        el('div', { class: 'dev-row' }, [
          btn('Duel', () => this._vector('duel'), 'dev-btn'),
          btn('Harvest', () => this._vector('harvest'), 'dev-btn'),
        ]),
      ]),
      el('div', { class: 'dev-section' }, [el('h4', { text: 'Skills (free)' }), this.skillsWrap]),
    );
  }

  _refresh() {
    const st = this.game?.state;
    if (!st) return;
    this.lvlText.textContent = `Lv ${levelFromXp(st.xp || 0)}/${XP_TABLE.length}`;
    this.xpText.textContent = `${Math.round(st.xp || 0)} xp`;
    if (SYSTEMS[st.systemId]) this.warpSelect.value = st.systemId;

    this.skillsWrap.innerHTML = '';
    for (const tree of SKILL_TREES) {
      this.skillsWrap.append(el('h5', { class: 'dev-tree', text: tree.name }));
      for (const s of tree.skills) {
        const rank = st.skills?.[s.id] || 0;
        this.skillsWrap.append(el('div', { class: 'dev-row' }, [
          el('span', { class: 'nm', text: s.name }),
          el('span', { class: 'rk', text: `${rank}/${s.max}` }),
          btn('\u2212', () => this._bumpSkill(s, -1), 'dev-btn'),
          btn('+', () => this._bumpSkill(s, 1), 'dev-btn'),
        ]));
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Cheats                                                              */
  /* ------------------------------------------------------------------ */

  _stepLevel(delta) {
    const st = this.game?.state;
    if (!st) return;
    const cur = levelFromXp(st.xp || 0);
    const next = clamp(cur + delta, 1, XP_TABLE.length);
    if (next === cur) return;
    st.xp = XP_TABLE[next - 1];
    st.skillPoints = Math.max(0, (st.skillPoints || 0) + delta);
    this._apply();
  }

  _bumpSkill(skill, delta) {
    const st = this.game?.state;
    if (!st) return;
    const cur = st.skills?.[skill.id] || 0;
    const next = clamp(cur + delta, 0, skill.max);
    if (next === cur) return;
    if (next === 0) delete st.skills[skill.id];
    else st.skills[skill.id] = next;
    this._apply();
  }

  /** Instant, free, and from anywhere — dampener fields and lanes ignored. */
  _warp(systemId) {
    const g = this.game;
    const st = g?.state;
    if (!st || !g.universe) return;
    if (g.mode !== 'flight') {
      g.ui.toasts.push('DEV: warp flies from the helm — undock first.', 'warn');
      return;
    }
    if (!SYSTEMS[systemId] || systemId === st.systemId) return;
    const backAngle = laneAngle(systemId, st.systemId);
    const entry = {
      x: Math.cos(backAngle) * (RIM_RADIUS - 90),
      z: Math.sin(backAngle) * (RIM_RADIUS - 90),
    };
    st.systemId = systemId;
    st.pos = { x: entry.x, z: entry.z };
    const heading = Math.atan2(-entry.x, -entry.z);
    st.heading = heading;
    g.universe.load(systemId, { entry, playerHeading: heading });
    g.applyStatsToPlayer();
    g._lastShield = g.universe.player.shield;
    g._lastHull = g.universe.player.hull;
    g.target = null;
    g.ui.toasts.push(`DEV: warped to ${SYSTEMS[systemId].name} — free of charge.`, 'warn');
  }

  /** Jump straight into a Vector Challenge match — dev shortcut. */
  _vector(mode) {
    const g = this.game;
    if (!g?.state) return;
    g.openVectorChallenge(mode);
    this.toggle(false);
  }

  /** Push edited state through the game (ship stats, dock, HUD). */
  _apply() {
    const g = this.game;
    g.applyStatsToPlayer?.();
    g.ui?.dock?.refreshIfOpen?.();
    g.ui?.skilltree?.refresh?.();
    this._refresh();
  }
}
