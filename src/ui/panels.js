// In-flight HUD panels made live: fold and drag — compact tabs that never sit
// on top of another panel, the corner buttons, the prompt or the target plate.
//
// Positions and folds persist in localStorage; a panel dropped on something
// else snaps back. Panels are sized by their content — no resizing.
import { el } from './dom.js';
import { clamp } from '../core/util.js';

const STORE_KEY = 'thewinds.hud-panels';
const MARGIN = 6; // gap kept between a panel and anything it must not cover

const DEFS = [
  { key: 'tl', sel: '.hud-tl', label: 'STATUS' },
  { key: 'tr', sel: '.hud-tr', label: 'NAV' },
  { key: 'br', sel: '.hud-br', label: 'RADAR' },
];

export function installScreenPanels(hud) {
  const root = hud.root;
  const entries = [];
  let drag = null;
  let loading = false; // suppress saves while restoring the stored layout

  /* ---------------------------------------------------------------- */
  /* Geometry helpers                                                  */
  /* ---------------------------------------------------------------- */

  const rootBox = () => {
    const r = root.getBoundingClientRect();
    return { w: r.width || window.innerWidth, h: r.height || window.innerHeight };
  };

  const hit = (a, b, m = MARGIN) => (
    a.x < b.x + b.w + m && a.x + a.w + m > b.x && a.y < b.y + b.h + m && a.y + a.h + m > b.y
  );

  const rectNow = (e) => {
    const r = e.panel.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    return { x: r.left - rr.left, y: r.top - rr.top, w: r.width, h: r.height };
  };

  /** Things a panel must not cover. `bands` = the reserved strips where the
   *  target plate and the prompt/toast stack live (drops are blocked there). */
  function obstacles(except, bands = true) {
    const out = [];
    for (const e of entries) {
      if (e === except) continue;
      const r = rectNow(e);
      if (r.w > 1 && r.h > 1) out.push(r);
    }
    const tray = document.querySelector('.corner-tray');
    if (tray) {
      const r = tray.getBoundingClientRect();
      if (r.width > 1) out.push({ x: r.left - 8, y: r.top - 8, w: r.width + 16, h: r.height + 16 });
    }
    if (bands) {
      const { w: W, h: H } = rootBox();
      const rr = root.getBoundingClientRect();
      // the target plate pops up centred near the top; the prompt sits centred low —
      // keep these strips clear so neither ever ends up covered by a panel
      out.push({ x: rr.left + W / 2 - 130, y: rr.top + 88, w: 260, h: 94 });
      out.push({ x: rr.left + W / 2 - 130, y: rr.top + H - 146, w: 260, h: 48 });
    }
    return out;
  }

  function applyPos(e) {
    if (!e.pos) return;
    e.panel.style.left = `${e.pos.x}px`;
    e.panel.style.top = `${e.pos.y}px`;
    e.panel.style.right = 'auto';
    e.panel.style.bottom = 'auto';
  }

  /** Pull the panel's live CSS position into explicit left/top so it can move. */
  function adopt(e) {
    if (e.pos) return;
    const r = rectNow(e);
    e.pos = { x: Math.round(r.x), y: Math.round(r.y) };
    applyPos(e);
  }

  function reset(e) {
    e.pos = null;
    e.panel.style.left = '';
    e.panel.style.top = '';
    e.panel.style.right = '';
    e.panel.style.bottom = '';
  }

  function clampPos(e) {
    if (!e.pos) return;
    const { w: W, h: H } = rootBox();
    const r = rectNow(e);
    e.pos.x = clamp(e.pos.x, 0, Math.max(0, W - r.w));
    e.pos.y = clamp(e.pos.y, 0, Math.max(0, H - r.h));
    applyPos(e);
  }

  /* ---------------------------------------------------------------- */
  /* Fold                                                              */
  /* ---------------------------------------------------------------- */

  function setFolded(e, on) {
    if (on === e.folded) return;
    adopt(e);
    e.folded = on;
    e.panel.classList.toggle('folded', on);
    e.foldBtn.textContent = on ? '\u25B8' : '\u25BE';
    e.foldBtn.title = on ? 'Unfold panel (double-click the tab works too)' : 'Fold panel (double-click the tab works too)';
    e.foldBtn.setAttribute('aria-label', `${on ? 'Unfold' : 'Fold'} ${e.def.label} panel`);
    // the box just changed size — keep the tab on screen
    const r = rectNow(e);
    const { w: W, h: H } = rootBox();
    e.pos = { x: clamp(e.pos.x, 0, Math.max(0, W - r.w)), y: clamp(e.pos.y, 0, Math.max(0, H - r.h)) };
    applyPos(e);
    save();
  }

  /* ---------------------------------------------------------------- */
  /* Drag                                                              */
  /* ---------------------------------------------------------------- */

  function begin(e, ev) {
    adopt(e);
    const start = rectNow(e);
    const obs = obstacles(e);
    drag = {
      e, pointerId: ev.pointerId,
      px: ev.clientX, py: ev.clientY,
      ox: e.pos.x, oy: e.pos.y,
      ow: Math.round(start.w), oh: Math.round(start.h),
      obs,
      // overlaps that already existed at pick-up don't block the drop
      startOverlap: new Set(obs.map((o, i) => (hit(start, o) ? i : -1)).filter((i) => i >= 0)),
      bad: false,
    };
    e.panel.setPointerCapture(ev.pointerId);
    e.panel.classList.add('dragging');
    ev.preventDefault();
  }

  function candidateOk(cand) {
    for (let i = 0; i < drag.obs.length; i++) {
      if (drag.startOverlap.has(i)) continue;
      if (hit(cand, drag.obs[i])) return false;
    }
    return true;
  }

  function onMove(ev) {
    if (!drag || ev.pointerId !== drag.pointerId) return;
    const e = drag.e;
    const dx = ev.clientX - drag.px;
    const dy = ev.clientY - drag.py;
    const { w: W, h: H } = rootBox();
    const x = clamp(Math.round(drag.ox + dx), 0, Math.max(0, W - drag.ow));
    const y = clamp(Math.round(drag.oy + dy), 0, Math.max(0, H - drag.oh));
    e.pos = { x, y };
    applyPos(e);
    drag.bad = !candidateOk({ x, y, w: drag.ow, h: drag.oh });
    e.panel.classList.toggle('pbad', drag.bad);
  }

  function onUp(ev) {
    if (!drag || (ev.pointerId !== undefined && ev.pointerId !== drag.pointerId)) return;
    const e = drag.e;
    e.panel.classList.remove('dragging');
    try { e.panel.releasePointerCapture(drag.pointerId); } catch { /* already gone */ }
    if (drag.bad) {
      // snap back to the pick-up pose — never leave a panel on top of anything
      e.pos = { x: drag.ox, y: drag.oy };
      applyPos(e);
      e.panel.classList.add('psnap');
      window.setTimeout(() => e.panel.classList.remove('psnap'), 340);
    } else {
      save();
    }
    e.panel.classList.remove('pbad');
    drag = null;
  }

  function attach(e) {
    e.panel.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      if (ev.target.closest('.pbtn')) return; // the fold button keeps its click
      begin(e, ev);
    });
    e.panel.addEventListener('dblclick', (ev) => {
      if (ev.target.closest('.pbtn')) return;
      setFolded(e, !e.folded);
    });
    e.panel.addEventListener('pointermove', onMove);
    e.panel.addEventListener('pointerup', onUp);
    e.panel.addEventListener('pointercancel', onUp);
  }

  /* ---------------------------------------------------------------- */
  /* Persistence                                                       */
  /* ---------------------------------------------------------------- */

  function save() {
    if (loading) return;
    const data = {};
    for (const e of entries) {
      if (!e.pos && !e.folded) continue;
      data[e.def.key] = {
        x: e.pos ? e.pos.x : null,
        y: e.pos ? e.pos.y : null,
        folded: e.folded,
      };
    }
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch { /* private mode */ }
  }

  function load() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch { saved = {}; }
    for (const e of entries) {
      const s = saved[e.def.key];
      if (!s) continue;
      if (Number.isFinite(s.x) && Number.isFinite(s.y)) {
        e.pos = { x: s.x, y: s.y };
        applyPos(e);
      }
      if (s.folded) setFolded(e, true);
    }
    for (const e of entries) {
      if (!e.pos) continue;
      clampPos(e);
      // a saved pose that sits on another panel (window shrank, etc.) resets to default
      const cand = rectNow(e);
      const clash = obstacles(e, false).some((o) => hit(cand, o));
      if (clash) reset(e);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Wire up                                                           */
  /* ---------------------------------------------------------------- */

  for (const def of DEFS) {
    const panel = root.querySelector(def.sel);
    if (!panel) continue;
    const e = { def, panel, pos: null, folded: false };
    e.chip = el('span', { class: 'pchip', text: def.label });
    e.foldBtn = el('button', {
      class: 'pbtn',
      title: 'Fold panel (double-click the tab works too)',
      'aria-label': `Fold ${def.label} panel`,
      text: '\u25BE',
      onclick: (ev) => { ev.stopPropagation(); setFolded(e, !e.folded); },
    });
    e.ctl = el('div', { class: 'pctl' }, [e.chip, e.foldBtn]);
    panel.classList.add('mgmt');
    panel.prepend(e.ctl);
    attach(e);
    entries.push(e);
  }

  loading = true;
  load();
  loading = false;

  window.addEventListener('resize', () => {
    for (const e of entries) clampPos(e);
  });

  return {
    /** Put every panel back where the shipwrights intended. */
    resetAll() {
      for (const e of entries) {
        if (e.folded) setFolded(e, false);
        reset(e);
      }
      save();
    },
  };
}
