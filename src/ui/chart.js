// Star map view: the cluster, your position, plotted courses and lane warps.
// Lives inside the ship's computer (ui/computer.js) as its star-map tab.

import { el, btn } from './dom.js';
import { SYSTEMS } from '../data/systems.js';
import { FACTIONS, isFaction } from '../data/factions.js';
import { clamp, formatDeadline, fmtCredits } from '../core/util.js';
import { rngOf } from '../core/rng.js';
import { lumenCourierFee } from '../game/game.js';
import { levelFromXp } from '../game/skills.js';
import * as missions from '../game/missions.js';
import * as story from '../game/story.js';
import * as sidequests from '../game/sidequests.js';
import { wormholesFor } from '../game/wormholes.js';
import { trafficLabel } from '../game/traffic.js';

// Layout comes from a force-directed pass over the lane graph (springs pull linked
// systems together, the old core ten hug the middle, the Outer Reach spirals out),
// then a separation pass pushes every pair of systems to at least ~0.15 of the
// canvas apart so the lanes between them read clearly. Fractions of the canvas —
// deliberately an organic sprawl, not a grid.
const LAYOUT = {
  haven: [0.365, 0.237],
  coriolis: [0.670, 0.359],
  brasstide: [0.548, 0.454],
  coldvane: [0.638, 0.203],
  meridian: [0.658, 0.566],
  sunward: [0.785, 0.471],
  doldrums: [0.354, 0.557],
  rusthaven: [0.200, 0.583],
  ashfall: [0.505, 0.600],
  vesper: [0.781, 0.674],
  vekta: [0.137, 0.730],
  kratha: [0.235, 0.427],
  // outer reach
  pelican: [0.808, 0.126],
  grandbank: [0.814, 0.286],
  vigiledge: [0.960, 0.351],
  kestrel: [0.953, 0.511],
  northgate: [0.960, 0.671],
  saintsrest: [0.889, 0.814],
  deadmansmile: [0.824, 0.960],
  quietus: [0.613, 0.721],
  houndstooth: [0.393, 0.405],
  tinderbox: [0.562, 0.063],
  emberlight: [0.511, 0.298],
  orchard: [0.456, 0.753],
  caldera: [0.730, 0.830],
  glassfall: [0.577, 0.877],
  oldhomestead: [0.302, 0.709],
  saltmarch: [0.078, 0.879],
  lastlight: [0.041, 0.561],
  piperun: [0.077, 0.402],
  tidemill: [0.040, 0.235],
  copperhead: [0.207, 0.263],
  // the marches (faction territories redrawn)
  lamphold: [0.890, 0.610],
  greywatch: [0.930, 0.240],
  oathfall: [0.870, 0.740],
  cordon: [0.890, 0.790],
  sentinels: [0.810, 0.780],
  vesperrim: [0.970, 0.300],
  lanternkeep: [0.930, 0.470],
  bloodoath: [0.170, 0.580],
  housedeep: [0.140, 0.400],
  ancestors: [0.200, 0.800],
  forgelight: [0.280, 0.300],
  ironvow: [0.100, 0.280],
  steepledark: [0.110, 0.780],
  graverest: [0.380, 0.330],
  smeltway: [0.710, 0.300],
  lattice: [0.630, 0.520],
  foundryline: [0.630, 0.430],
  scarmarch: [0.140, 0.550],
  brokenjaw: [0.090, 0.420],
  wreckerbay: [0.680, 0.130],
  // the free-fire systems — off the trade lanes, and on nobody's books
  thelists: [0.430, 0.930],
  gallowsring: [0.690, 0.960],
  emberdrome: [0.885, 0.075],
};

/** Star chart view limits (scale 1 = the whole cluster fit to the canvas). */
const CHART_ZOOM_MIN = 0.6;
const CHART_ZOOM_MAX = 4;

export class ChartUI {
  constructor() {
    this.wrap = null;
    this.route = null; // plotted course: system ids from here to the destination
    this.routeMeta = null; // { missionId, title, color } for the tracked job's course
    this.selected = null;
    this.ctx = null;
    this._onCanvasClick = null;
    /** Camera over the map: scale plus screen-space pan offset (CSS px). */
    this.cam = { scale: 1, x: 0, y: 0 };
    this._pointers = new Map();
    this._pinch = null;
    this._dragDist = 0;
    this._dragged = false;
  }

  /**
   * Quest activity keyed by system id:
   *   story    — open story chapters waiting here (with their line colours)
   *   missions — active contract objectives here
   *   turnins  — finished surveys/recoveries to be handed in here
   */
  _questInfo() {
    const { state } = this.ctx;
    const info = {};
    const rec = (id) => (info[id] = info[id] || { story: [], missions: 0, turnins: 0 });
    for (const m of state.missions || []) {
      if (m.dest?.systemId) rec(m.dest.systemId).missions += 1;
      if ((m.type === 'survey' || m.type === 'recovery') && m.issuer?.systemId) {
        rec(m.issuer.systemId).turnins += 1;
      }
    }
    const lvl = levelFromXp(state.xp || 0);
    if (state.allegiance) {
      // your flag's next written chapter, if the chain is still in its story run
      const chain = missions.factionChain(state.allegiance);
      const stage = state.factionLine?.faction === state.allegiance ? state.factionLine.stage : 0;
      if (stage < chain.length && chain[stage].kind === 'story') {
        const spec = chain[stage];
        const line = story.STORY_LINES[spec.line];
        const ch = line.chapters[spec.chapter - 1];
        if (ch) {
          const dest = ch.objective?.dest;
          if (dest) rec(dest).story.push(line);
        }
      }
    } else {
      // unsworn: every flag's chapter-one opening beckons from its home desk
      for (const line of Object.values(story.STORY_LINES)) {
        const ch = line.chapters[0];
        if (lvl < (ch.lvl || 1)) continue;
        const dest = ch.objective?.dest;
        if (!dest) continue;
        const bag = rec(dest).story;
        if (!bag.some((l) => l.id === line.id)) bag.push(line);
      }
    }
    return info;
  }

  /** Render the map into a host element (the computer's star-map tab). */
  mount(host, ctx) {
    this.unmount();
    this.ctx = ctx;
    this.selected = ctx.state.systemId;

    this.canvas = el('canvas', { id: 'chartcanvas' });
    this.side = el('div', { class: 'chart-side' });

    this.chartBody = el('div', { class: 'chart-body' }, [
      el('div', { class: 'chart-canvas-wrap' }, [this.canvas]),
      this.side,
    ]);

    this.wrap = el('div', { class: 'chart-view' }, [
      el('div', { class: 'chart-head' }, [
        el('h2', { text: 'Star chart' }),
        el('span', { class: 'note', text: 'Names, lanes and faction colours \u2014 select a mission to light its course \u00b7 violet threads: mapped wormholes \u00b7 drag to pan, scroll to zoom' }),
        el('div', { class: 'spacer' }),
        btn('Reset view', () => this._resetCam(), 'btn small ghost'),
      ]),
      this.chartBody,
    ]);
    host.append(this.wrap);

    this._onCanvasClick = (e) => {
      if (this._dragged) { // a pan/pinch just ended — do not treat it as a pick
        this._dragged = false;
        return;
      }
      const rect = this.canvas.getBoundingClientRect();
      const [mx, my] = this._screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const vis = this._visibility();
      let best = null;
      let bestD = 30 / this.cam.scale;
      for (const id of Object.keys(SYSTEMS)) {
        if (!vis.has(id)) continue; // uncharted systems cannot be selected
        const [fx, fy] = LAYOUT[id];
        const x = fx * rect.width;
        const y = fy * rect.height;
        const d = Math.hypot(mx - x, my - y);
        if (d < bestD) {
          bestD = d;
          best = id;
        }
      }
      if (best) {
        this.selected = best;
        this._renderSide();
        this._draw();
      }
    };
    this._onWheel = (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      // trackpad pinch arrives as ctrl+wheel — give it a stronger step
      const k = e.ctrlKey ? 0.007 : 0.0016;
      this._zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * k));
    };
    this._onDblClick = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this._zoomAt(e.clientX - rect.left, e.clientY - rect.top, 1.7);
    };
    this._onPointerDown = (e) => {
      this.canvas.setPointerCapture(e.pointerId);
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this._dragDist = 0;
      this._dragged = false;
      if (this._pointers.size >= 2) {
        this._pinch = this._pinchState();
        this._dragged = true;
      }
      this.canvas.classList.add('dragging');
    };
    this._onPointerMove = (e) => {
      const p = this._pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (this._pointers.size >= 2) {
        // two-finger pinch: zoom about the midpoint and pan with it
        const rect = this.canvas.getBoundingClientRect();
        const pin = this._pinchState();
        this._dragged = true;
        if (this._pinch) {
          this.cam.x += pin.cx - this._pinch.cx;
          this.cam.y += pin.cy - this._pinch.cy;
          this._zoomAt(pin.cx - rect.left, pin.cy - rect.top,
            clamp(pin.dist / Math.max(1, this._pinch.dist), 0.4, 2.5));
        }
        this._pinch = pin;
        return;
      }
      // single pointer: drag to pan
      this._dragDist += Math.hypot(dx, dy);
      if (this._dragDist > 4) this._dragged = true;
      if (this._dragged) {
        this.cam.x += dx;
        this.cam.y += dy;
        this._clampCam();
        this._draw();
      }
    };
    this._onPointerUp = (e) => {
      this._pointers.delete(e.pointerId);
      if (this._pointers.size < 2) this._pinch = null;
      if (this._pointers.size === 0) this.canvas.classList.remove('dragging');
    };
    this.canvas.addEventListener('click', this._onCanvasClick);
    this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
    this.canvas.addEventListener('dblclick', this._onDblClick);
    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    this.canvas.addEventListener('pointermove', this._onPointerMove);
    this.canvas.addEventListener('pointerup', this._onPointerUp);
    this.canvas.addEventListener('pointercancel', this._onPointerUp);

    this._resize();
    this.routeMeta = {
      missionId: ctx.routeMissionId || null,
      title: ctx.routeTitle || null,
      color: ctx.routeColor || null,
    };
    this.setRoute(ctx.route || null);
    if (this.route && this.route.length > 1) this.fitRoute(this.route);
    else this._focusOnSystem(ctx.state.systemId);
    this._renderSide();
    this._draw();
  }

  /** Set (or clear) the plotted course drawn as a bright route line. */
  setRoute(ids) {
    this.route = ids && ids.length ? [...ids] : null;
  }

  /** Re-centre the camera on a system (used by the mission list). */
  focusSystem(id) {
    if (!this.wrap || !SYSTEMS[id]) return;
    this.selected = id;
    this._focusOnSystem(id);
    this._renderSide();
    this._draw();
  }

  /** Fit the camera so a plotted course is fully in view. */
  fitRoute(ids) {
    const rect = this.canvas?.getBoundingClientRect();
    if (!rect?.width || !ids?.length) return;
    let minX = 1;
    let minY = 1;
    let maxX = 0;
    let maxY = 0;
    for (const id of ids) {
      const [fx, fy] = LAYOUT[id] || [0.5, 0.5];
      minX = Math.min(minX, fx);
      minY = Math.min(minY, fy);
      maxX = Math.max(maxX, fx);
      maxY = Math.max(maxY, fy);
    }
    const pad = 90; // CSS px of breathing room around the route
    const spanX = Math.max(0.04, maxX - minX) * rect.width;
    const spanY = Math.max(0.04, maxY - minY) * rect.height;
    const s = clamp(Math.min((rect.width - pad * 2) / spanX, (rect.height - pad * 2) / spanY), CHART_ZOOM_MIN, 2.2);
    const midX = ((minX + maxX) / 2) * rect.width;
    const midY = ((minY + maxY) / 2) * rect.height;
    this.cam.scale = s;
    this.cam.x = rect.width / 2 - midX * s;
    this.cam.y = rect.height / 2 - midY * s;
    this._clampCam();
    this.selected = ids[ids.length - 1];
    this._renderSide();
    this._draw();
  }

  /** Open the chart a little zoomed in on wherever the captain is. */
  _focusOnSystem(id) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const [fx, fy] = LAYOUT[id] || [0.5, 0.5];
    const s = 1.5;
    this.cam.scale = s;
    this.cam.x = rect.width / 2 - fx * rect.width * s;
    this.cam.y = rect.height / 2 - fy * rect.height * s;
    this._clampCam();
    this._draw();
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(10, rect.width * dpr);
    this.canvas.height = Math.max(10, rect.height * dpr);
    this._dpr = dpr;
    this._draw();
  }

  _draw() {
    const c = this.canvas.getContext('2d');
    const dpr = this._dpr || 1;
    const w = this.canvas.width / dpr; // base map space: CSS pixels at scale 1
    const h = this.canvas.height / dpr;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // camera: base map space -> device pixels
    const { scale, x: camX, y: camY } = this.cam;
    c.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * camX, dpr * camY);
    // one CSS pixel in base-map units at the current zoom — keeps labels, markers
    // and strokes a constant size on screen, so zooming in spreads them apart
    const r = dpr / scale;

    const posOf = (id) => {
      const [fx, fy] = LAYOUT[id];
      return [fx * w, fy * h];
    };
    const quests = this._questInfo();
    const vis = this._visibility(quests);

    // deep-space backdrop first: gradient, then nebula washes on a slower
    // parallax layer so the chart floats in front of the sky
    this._drawBackdrop(c, w, h);

    // lanes that trail off toward uncharted space fade out into the fog
    c.lineWidth = 1.6 * r;
    const chartedLanes = [];
    for (const id of Object.keys(SYSTEMS)) {
      for (const to of SYSTEMS[id].links) {
        if (id > to) continue;
        const va = vis.get(id);
        const vb = vis.get(to);
        if (!va && !vb) continue;
        if (va && vb) {
          chartedLanes.push([id, to]);
          continue;
        }
        const from = va ? id : to;
        const [x1, y1] = posOf(from);
        const [x2, y2] = posOf(va ? to : id);
        const grad = c.createLinearGradient(x1, y1, x2, y2);
        const a = va === 'core' || vb === 'core' ? 0.13 : 0.08;
        grad.addColorStop(0, `rgba(126,152,178,${a})`);
        grad.addColorStop(0.62, 'rgba(126,152,178,0)');
        grad.addColorStop(1, 'rgba(126,152,178,0)');
        c.strokeStyle = grad;
        c.beginPath();
        c.moveTo(x1, y1);
        c.lineTo(x1 + (x2 - x1) * 0.62, y1 + (y2 - y1) * 0.62);
        c.stroke();
      }
    }

    // fog of war: everything outside the clearings of charted systems is lost
    this._drawFog(c, vis, w, h);

    // faction territories: a soft wash in each flag's colour, glowing through
    // the fog so the political map reads at a glance
    this._drawTerritories(c, w, h);

    // charted lanes sit above the fog: one light colour, every lane equal, so
    // the plotted course is the only thing on the map that ever shouts
    c.strokeStyle = 'rgba(158,186,210,0.36)';
    c.lineWidth = 1.4 * r;
    for (const [id, to] of chartedLanes) {
      const [x1, y1] = posOf(id);
      const [x2, y2] = posOf(to);
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(x2, y2);
      c.stroke();
    }

    // mapped wormholes: a violet thread between the two mouths
    for (const h of wormholesFor(this.ctx.state)) {
      if (!this.ctx.state.wormholes?.[h.id]) continue;
      const [ax, ay] = posOf(h.a);
      const [bx, by] = posOf(h.b);
      c.strokeStyle = 'rgba(196, 156, 255, 0.5)';
      c.lineWidth = 2 * r;
      c.beginPath();
      c.moveTo(ax, ay);
      c.lineTo(bx, by);
      c.stroke();
      c.lineWidth = 1.4 * r;
      for (const [hx, hy] of [[ax, ay], [bx, by]]) {
        c.beginPath();
        c.arc(hx, hy, 6.5 * r, 0, Math.PI * 2);
        c.stroke();
      }
    }

    // plotted course: a bright running line the captain can follow lane by lane,
    // drawn in the tracked contract's colour so map and manifest always agree
    if (this.route && this.route.length > 1) {
      const rc = this.routeMeta?.color || '#8cffd7';
      for (const [w, alpha] of [[7 * r, 0.16], [2.6 * r, 0.85]]) {
        c.globalAlpha = alpha;
        c.strokeStyle = rc;
        c.lineWidth = w;
        c.beginPath();
        for (let i = 0; i < this.route.length - 1; i++) {
          const [rx1, ry1] = posOf(this.route[i]);
          const [rx2, ry2] = posOf(this.route[i + 1]);
          c.moveTo(rx1, ry1);
          c.lineTo(rx2, ry2);
        }
        c.stroke();
      }
      c.globalAlpha = 0.65;
      for (let i = 1; i < this.route.length - 1; i++) {
        const [wx, wy] = posOf(this.route[i]);
        c.strokeStyle = rc;
        c.lineWidth = 1.4 * r;
        c.beginPath();
        c.arc(wx, wy, 9 * r, 0, Math.PI * 2);
        c.stroke();
      }
      c.globalAlpha = 1;
    }

    // charted systems: a quiet point of light and a name. No halos, badges,
    // rings or faction colours — the side panel carries that — and the only
    // thing that ever highlights is the course plotted for the selected job.
    for (const [id, sys] of Object.entries(SYSTEMS)) {
      const tier = vis.get(id);
      if (!tier) continue;
      const [x, y] = posOf(id);
      const here = id === this.ctx.state.systemId;
      const sel = id === this.selected;
      c.globalAlpha = tier === 'core' ? 1 : 0.55;

      // a faction-coloured glow under every charted star — whose colours fly
      // here reads at a glance, and how far each flag's reach extends
      const fac = FACTIONS[this.ctx.state.influence?.[id] || sys.gov];
      if (sys.freefire) {
        // free-fire ground: nobody's colours, and the chart says so out loud
        c.save();
        c.strokeStyle = 'rgba(255, 150, 120, 0.55)';
        c.lineWidth = 1.5 * r;
        c.setLineDash([4 * r, 4.5 * r]);
        c.beginPath();
        c.arc(x, y, 15 * r, 0, Math.PI * 2);
        c.stroke();
        c.restore();
        c.font = `${8.5 * r}px "Segoe UI", sans-serif`;
        c.fillStyle = 'rgba(255, 176, 148, 0.92)';
        c.textAlign = 'center';
        c.fillText('NO FLAG', x, y + 27 * r);
      } else if (fac) {
        const halo = c.createRadialGradient(x, y, 2 * r, x, y, 13 * r);
        halo.addColorStop(0, `${fac.color}55`);
        halo.addColorStop(0.55, `${fac.color}1e`);
        halo.addColorStop(1, `${fac.color}00`);
        c.fillStyle = halo;
        c.beginPath();
        c.arc(x, y, 13 * r, 0, Math.PI * 2);
        c.fill();
      } else {
        const bloom = c.createRadialGradient(x, y, 0, x, y, 10 * r);
        bloom.addColorStop(0, 'rgba(188, 218, 250, 0.14)');
        bloom.addColorStop(1, 'rgba(188, 218, 250, 0)');
        c.fillStyle = bloom;
        c.beginPath();
        c.arc(x, y, 10 * r, 0, Math.PI * 2);
        c.fill();
      }

      if (here) {
        const hg = c.createRadialGradient(x, y, 3 * r, x, y, 22 * r);
        hg.addColorStop(0, 'rgba(190,240,255,0.4)');
        hg.addColorStop(1, 'rgba(140,220,255,0)');
        c.fillStyle = hg;
        c.beginPath();
        c.arc(x, y, 22 * r, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.9)';
        c.lineWidth = 1.8 * r;
        c.beginPath();
        c.arc(x, y, 12 * r, 0, Math.PI * 2);
        c.stroke();
      } else if (sel) {
        c.strokeStyle = 'rgba(255,255,255,0.4)';
        c.lineWidth = 1.1 * r;
        c.beginPath();
        c.arc(x, y, 9.5 * r, 0, Math.PI * 2);
        c.stroke();
      }

      c.fillStyle = here || sel ? '#ffffff' : (fac ? fac.color : 'rgba(206,224,242,0.85)');
      c.beginPath();
      c.arc(x, y, (here ? 4.6 : 3.2) * r, 0, Math.PI * 2);
      c.fill();

      // the closing waypoint of the plotted course wears a dashed ring in the
      // contract's colour plus a caption — the one highlight the map keeps
      if (this.route && id === this.route[this.route.length - 1]) {
        const rc = this.routeMeta?.color || '#8cffd7';
        c.globalAlpha = 1;
        c.strokeStyle = rc;
        c.lineWidth = 2 * r;
        c.setLineDash([6 * r, 5 * r]);
        c.beginPath();
        c.arc(x, y, 26 * r, 0, Math.PI * 2);
        c.stroke();
        c.setLineDash([]);
        c.font = `${9.5 * r}px "Segoe UI", sans-serif`;
        c.fillStyle = rc;
        c.textAlign = 'center';
        c.fillText('◈ tracked course', x, y + 39 * r);
      }

      c.font = `${11 * r}px "Segoe UI", sans-serif`;
      c.fillStyle = here ? '#ffffff' : 'rgba(202,220,238,0.8)';
      c.textAlign = 'center';
      c.fillText(sys.name, x, y - 12 * r);
      c.globalAlpha = 1;
    }
  }

  /**
   * Chart visibility per system: 'core' = you have been there, 'edge' = glimpsed
   * (a lane runs there from charted space, or a live contract names the place).
   * Everything else is lost in the fog.
   */
  _visibility(quests = this._questInfo()) {
    const st = this.ctx.state;
    const vis = new Map();
    vis.set(st.systemId, 'core');
    for (const [id, seen] of Object.entries(st.visited || {})) {
      if (seen && SYSTEMS[id]) vis.set(id, 'core');
    }
    for (const id of [...vis.keys()]) {
      for (const to of SYSTEMS[id].links) {
        if (!vis.has(to)) vis.set(to, 'edge');
      }
    }
    for (const id of Object.keys(quests)) {
      if (quests[id] && !vis.has(id)) vis.set(id, 'edge');
    }
    // a plotted course is drawn on the charts whether or not you have been there
    for (const id of this.route || []) {
      if (!vis.has(id)) vis.set(id, 'edge');
    }
    // a mapped wormhole reveals both of its mouths
    for (const h of wormholesFor(st)) {
      if (!st.wormholes?.[h.id]) continue;
      if (!vis.has(h.a)) vis.set(h.a, 'edge');
      if (!vis.has(h.b)) vis.set(h.b, 'edge');
    }
    return vis;
  }

  /**
   * Deep-space backdrop: a soft vignette plus seeded nebula washes drawn on a
   * slower parallax layer, so panning and zooming the chart feels like drifting
   * past clouds of gas rather than sliding a flat picture.
   */
  _drawBackdrop(c, w, h) {
    const dpr = this._dpr || 1;
    const seed = this.ctx.state.worldSeed ?? 1;
    if (!this._nebula || this._nebulaSeed !== seed) {
      const rng = rngOf(seed, 'chartnebula');
      const palette = [
        [70, 130, 156],
        [86, 74, 156],
        [58, 96, 168],
        [138, 88, 146],
      ];
      this._nebula = Array.from({ length: 9 }, () => ({
        x: rng.float(0.05, 0.95),
        y: rng.float(0.05, 0.95),
        r: rng.float(0.16, 0.34),
        a: rng.float(0.05, 0.1),
        col: rng.pick(palette),
      }));
      this._nebulaSeed = seed;
    }

    c.save();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const base = c.createRadialGradient(w / 2, h * 0.42, 30, w / 2, h * 0.5, Math.max(w, h) * 0.78);
    base.addColorStop(0, 'rgba(15, 29, 47, 1)');
    base.addColorStop(0.55, 'rgba(7, 14, 24, 1)');
    base.addColorStop(1, 'rgba(3, 6, 11, 1)');
    c.fillStyle = base;
    c.fillRect(0, 0, w, h);

    // nebulae zoom at ~45% and pan at ~55% of the chart — slower than the map,
    // which is exactly what sells the depth
    const pz = 1 + (this.cam.scale - 1) * 0.45;
    c.setTransform(dpr * pz, 0, 0, dpr * pz, dpr * this.cam.x * 0.55, dpr * this.cam.y * 0.55);
    for (const b of this._nebula) {
      const x = b.x * w;
      const y = b.y * h;
      const rr = b.r * Math.max(w, h);
      const g = c.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, `rgba(${b.col[0]}, ${b.col[1]}, ${b.col[2]}, ${b.a})`);
      g.addColorStop(0.6, `rgba(${b.col[0]}, ${b.col[1]}, ${b.col[2]}, ${(b.a * 0.45).toFixed(3)})`);
      g.addColorStop(1, `rgba(${b.col[0]}, ${b.col[1]}, ${b.col[2]}, 0)`);
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, rr, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  /**
   * Faction territories: a soft wash in each flag's colour over the systems it
   * holds, glowing through the fog — whose space you are flying in reads at a
   * glance, even before every star on the far side is charted.
   */
  _drawTerritories(c, w, h) {
    const st = this.ctx.state;
    for (const fac of Object.values(FACTIONS)) {
      const ids = Object.keys(SYSTEMS).filter((id) => (st.influence?.[id] || SYSTEMS[id].gov) === fac.id);
      if (!ids.length) continue;
      let cx = 0;
      let cy = 0;
      for (const id of ids) {
        cx += LAYOUT[id][0];
        cy += LAYOUT[id][1];
      }
      cx = (cx / ids.length) * w;
      cy = (cy / ids.length) * h;
      const rr = Math.max(w, h) * 0.2;
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, rr);
      g.addColorStop(0, `${fac.color}16`);
      g.addColorStop(0.55, `${fac.color}0a`);
      g.addColorStop(1, `${fac.color}00`);
      c.fillStyle = g;
      c.beginPath();
      c.arc(cx, cy, rr, 0, Math.PI * 2);
      c.fill();
    }
  }

  /** Seeded cloud puffs that chew at a system's fog clearing so it reads as mist. */
  _wispsFor(id) {    const seed = this.ctx.state.worldSeed ?? 1;
    if (!this._wisps || this._wispsSeed !== seed) {
      this._wisps = new Map();
      this._wispsSeed = seed;
    }
    let wp = this._wisps.get(id);
    if (!wp) {
      const rng = rngOf(seed, 'chartwisps', id);
      wp = Array.from({ length: 6 }, () => ({
        a: rng.float(0, Math.PI * 2),
        d: rng.float(0.82, 1.2),
        r: rng.float(0.12, 0.3),
        alpha: rng.float(0.18, 0.5),
      }));
      this._wisps.set(id, wp);
    }
    return wp;
  }

  /**
   * Fog layer: a deep blue-black haze with layered clearings — a wide dim halo
   * of charted space, a soft-core parting, then seeded wisps chewing the rim so
   * the boundary looks like rolling cloud instead of stamped circles.
   */
  _drawFog(c, vis, w, h) {
    const dw = this.canvas.width;
    const dh = this.canvas.height;
    if (!this._fog) this._fog = document.createElement('canvas');
    if (this._fog.width !== dw || this._fog.height !== dh) {
      this._fog.width = dw;
      this._fog.height = dh;
    }
    const fc = this._fog.getContext('2d');
    fc.setTransform(1, 0, 0, 1, 0, 0);
    fc.clearRect(0, 0, dw, dh);
    const wash = fc.createLinearGradient(0, 0, 0, dh);
    wash.addColorStop(0, 'rgba(8, 14, 26, 0.96)');
    wash.addColorStop(0.5, 'rgba(5, 9, 18, 0.93)');
    wash.addColorStop(1, 'rgba(3, 6, 12, 0.96)');
    fc.fillStyle = wash;
    fc.fillRect(0, 0, dw, dh);
    fc.globalCompositeOperation = 'destination-out';
    const dpr = this._dpr || 1;
    const s = this.cam.scale;
    for (const [id, tier] of vis) {
      const [fx, fy] = LAYOUT[id];
      const x = (fx * w * s + this.cam.x) * dpr;
      const y = (fy * h * s + this.cam.y) * dpr;
      const r = (tier === 'core' ? 175 : 118) * s * dpr;
      // the fog thins long before it parts — a wide, dim breath of known space
      const halo = fc.createRadialGradient(x, y, 0, x, y, r * 1.55);
      halo.addColorStop(0, 'rgba(0, 0, 0, 0.32)');
      halo.addColorStop(0.6, 'rgba(0, 0, 0, 0.1)');
      halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
      fc.fillStyle = halo;
      fc.beginPath();
      fc.arc(x, y, r * 1.55, 0, Math.PI * 2);
      fc.fill();
      // the parting itself, soft-edged
      const g = fc.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.42, 'rgba(0,0,0,1)');
      g.addColorStop(0.78, 'rgba(0,0,0,0.55)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      fc.fillStyle = g;
      fc.beginPath();
      fc.arc(x, y, r, 0, Math.PI * 2);
      fc.fill();
      // wisps around settled space: cloud, not circles
      if (tier === 'core') {
        for (const wp of this._wispsFor(id)) {
          const wx = x + Math.cos(wp.a) * r * wp.d;
          const wy = y + Math.sin(wp.a) * r * wp.d;
          const wr = r * wp.r;
          const wg = fc.createRadialGradient(wx, wy, 0, wx, wy, wr);
          wg.addColorStop(0, `rgba(0,0,0,${wp.alpha})`);
          wg.addColorStop(1, 'rgba(0,0,0,0)');
          fc.fillStyle = wg;
          fc.beginPath();
          fc.arc(wx, wy, wr, 0, Math.PI * 2);
          fc.fill();
        }
      }
    }
    fc.globalCompositeOperation = 'source-over';
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this._fog, 0, 0);
    c.restore();
  }

  _renderSide() {
    const side = this.side;
    side.innerHTML = '';
    const { state, onJump } = this.ctx;
    const sys = SYSTEMS[this.selected];
    if (!this._visibility().has(this.selected)) {
      side.append(
        el('h3', { text: 'Beyond the charts' }),
        el('h2', { text: 'Uncharted' }),
        el('p', { class: 'note', text: 'No charts for this space yet. Fly the lanes past the fog — or take a contract that names the place — and it will appear.' }),
      );
      return;
    }
    const here = this.selected === state.systemId;
    const adjacent = SYSTEMS[state.systemId].links.includes(this.selected);

    // warp bay — any lane touching your position can be run from here
    if (adjacent && !here) {
      const block = this.ctx.warpBlock || null;
      const canJump = !block && state.lumen >= 1;
      const warpBtn = btn(
        block ? 'Warp field dampened'
          : state.lumen < 1 ? 'No lumen left'
            : `Warp the lane \u2192 ${sys.name} (1 lumen \u00b7 have ${state.lumen})`,
        () => {
          if (canJump) {
            onJump(this.selected);
            this.unmount();
          }
        },
        `btn ${canJump ? 'primary' : ''}`,
      );
      warpBtn.disabled = !canJump;
      const bay = el('div', { class: 'warpbay' }, [warpBtn]);
      if (block) {
        bay.append(el('p', {
          class: 'note',
          style: 'color:#ffb347',
          text: `Dampened by ${block.source.label} — ${Math.round(block.dist)} m to clear space.`
            + (this.ctx.hasPlotter ? ' Fly clear, then follow the plotter line.' : ' Fly clear of worlds and stations, then warp.'),
        }));
      } else if (state.lumen < 1) {
        const fee = lumenCourierFee(state);
        bay.append(el('p', { class: 'note', text: `No lumen left — refuel at a station, or call a courier (${fmtCredits(fee)}).`, style: 'color:#ffb347' }));
        const canCall = state.credits >= fee && !this.ctx.courierEnRoute;
        const callBtn = btn(
          `Call a lumen courier (${fmtCredits(fee)})`,
          () => this.ctx.actions.actCallLumenCourier(),
          `btn ${canCall ? 'primary' : ''}`,
        );
        callBtn.disabled = !canCall;
        if (this.ctx.courierEnRoute) callBtn.title = 'A courier is already on her way.';
        bay.append(el('div', { style: 'margin-top:8px' }, [callBtn]));
        bay.append(el('p', { class: 'note', text: 'She folds in beside you and hands over one lumen — ₡100 and the lumen, plus a tithe that climbs with your fortune.' }));
      }
      side.append(bay);
    } else if (!here) {
      side.append(el('p', { class: 'note dim', text: 'No direct lane from your position \u2014 warping runs to a neighbouring system.' }));
    }

    // plotted course banner — the tracked job whose path is lit up on the map
    if (this.route && this.route.length) {
      const destId = this.route[this.route.length - 1];
      const hops = this.route.length - 1;
      const meta = this.routeMeta || {};
      const box = el('div', { class: 'coursebox', style: meta.color ? `--mcol: ${meta.color}` : '' }, [
        el('div', { class: 'cb-title', text: `\u25C8 ${meta.title || 'Plotted course'}` }),
        el('div', { class: 'kv' }, [
          el('span', { text: 'Destination' }),
          el('b', { text: `${SYSTEMS[destId].name} \u00b7 ${hops} lane${hops === 1 ? '' : 's'}` }),
        ]),
        btn('Clear course', () => {
          this.setRoute(null);
          this.ctx.onRouteClear?.();
          this._renderSide();
          this._draw();
        }, 'btn small ghost'),
      ]);
      side.append(box);
    }

    side.append(
      el('h3', { text: here ? 'You are here' : 'System' }),
      el('h2', { text: sys.name }),
      el('p', { class: 'note', text: sys.tagline }),
    );

    const kv = (k, v) => el('div', { class: 'kv' }, [el('span', { text: k }), el('b', { text: v })]);
    const govId = state.influence?.[this.selected] || sys.gov;
    side.append(
      kv('Government', isFaction(govId) ? FACTIONS[govId].name : sys.freefire ? 'No flag — free-fire' : 'No flag'),
      kv('Traffic', trafficLabel(state, this.selected)),
      kv('Tech level', String(sys.tech)),
      kv('Jump lanes', String(sys.links.length)),
      kv('Pirate activity', `${Math.round(sys.danger.pirates * 100)}%`),
      kv('Vigil presence', `${Math.round(sys.danger.navy * 100)}%`),
      kv('Services', [...new Set(sys.stations.flatMap((s) => s.services))].join(', ')),
    );
    if (sys.freefire) {
      side.append(el('p', {
        class: 'note freefire-note',
        text: 'Free-fire ground. No flag holds these orbits, no ledger follows a hull in, and none follows it out: '
          + 'any hull may be attacked or taken here, and no standing or karma turns on it.',
      }));
    }
    const charter = state.holdings?.[this.selected];
    if (charter) {
      side.append(kv('Charter', charter.asset === 'spacedock' ? 'planet spacedock — yours' : charter.asset === 'planet' ? 'world charter — yours' : 'station licence — yours'));
    }

    side.append(el('h3', { text: 'Lanes' }));
    const links = el('div', { class: 'chips' }, sys.links.map((l) => el('span', {
      class: `chip ${l === state.systemId ? 'on' : ''}`,
      text: SYSTEMS[l].name,
      style: 'cursor:pointer',
      onclick: () => {
        this.selected = l;
        this._renderSide();
        this._draw();
      },
    })));
    side.append(links);

    side.append(el('h3', { text: 'Word' }), el('p', { class: 'note', text: sys.desc }));

    // quest activity for the selected system — why you might fly here
    const q = this._questInfo()[this.selected];
    if (q) {
      side.append(el('h3', { text: `Quest activity — ${sys.name}` }));
      for (const line of q.story) {
        side.append(el('div', { class: 'kv' }, [
          el('span', { text: 'Story chapter' }),
          el('b', { style: `color:${line.color}`, text: line.name }),
        ]));
      }
      if (q.missions) {
        side.append(el('div', { class: 'kv' }, [
          el('span', { text: 'Contract objectives' }),
          el('b', { style: 'color:#ffd166', text: `\u25C6 ${q.missions}` }),
        ]));
      }
      if (q.turnins) {
        side.append(el('div', { class: 'kv' }, [
          el('span', { text: 'Turn-ins at station' }),
          el('b', { style: 'color:#63ffc0', text: `\u2713 ${q.turnins}` }),
        ]));
      }
    }

    // active contracts recap — click one to plot its course, drop it to abandon
    if (state.missions.length) {
      side.append(el('h3', { text: 'Active contracts' }));
      if (this.ctx?.onTrackMission) {
        side.append(el('p', { class: 'note', text: 'Click a contract to plot its course — the tracked job is lit on the map.' }));
      }
      for (const m of state.missions) {
        const line = m.story ? story.STORY_LINES[m.story.line] : null;
        const sideQ = m.side ? sidequests.SIDE_BY_ID[m.side.group] : null;
        const tracked = this.routeMeta?.missionId === m.id;
        const tag = line ? `${line.name} CH ${m.story.chapter}`
          : sideQ ? `${sideQ.name} ${m.side.step + 1}/${sideQ.steps.length}`
            : (missions.MISSION_TAGS[m.type] || 'CONTRACT');
        const progress = missions.missionProgress(m);
        const styleBits = [];
        if (line) styleBits.push(`--mcol: ${line.color}`);
        else if (sideQ) styleBits.push(`--mcol: ${sideQ.color}`);
        if (this.ctx?.onTrackMission) styleBits.push('cursor: pointer');
        const cardAttrs = { class: `mission ${m.type}${tracked ? ' tracked' : ''}` };
        if (styleBits.length) cardAttrs.style = styleBits.join('; ');
        if (this.ctx?.onTrackMission) {
          cardAttrs.onclick = (e) => {
            if (e.target.closest('button')) return;
            this.ctx.onTrackMission(m.id);
          };
        }
        const card = el('div', cardAttrs, [
          el('div', {
            class: 'mtag',
            html: `${tag} · ${missions.tierStars(m.tier)}${m.urgent ? ' · <span class="urgent">URGENT</span>' : ''} · ${formatDeadline(m.deadlineDay, state.day)}`
              + `${tracked ? ' · <span class="mtrack">\u25C6 TRACKED</span>' : ''}`,
          }),
          el('h4', { text: m.title }),
          el('p', { class: 'mwhere' }, [
            el('span', { class: 'mdest', text: `▸ ${SYSTEMS[m.dest.systemId].name}` }),
            el('span', { text: `fee ₡${m.reward.toLocaleString()}` }),
          ]),
        ]);
        if (progress) card.append(el('p', { class: 'note', style: 'color: var(--mcol); opacity: 0.92', text: progress }));
        if (this.ctx?.actions?.actAbandonMission) {
          card.append(el('div', { class: 'mfoot' }, [
            el('span', { class: 'note', text: 'Drop loses the contract — and the pay.' }),
            btn('Drop', () => {
              this.ctx.actions.actAbandonMission(m.id);
              this._renderSide();
              this._draw();
            }, 'btn small ghost'),
          ]));
        }
        side.append(card);
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Map camera: pan & zoom                                            */
  /* ---------------------------------------------------------------- */

  /** Canvas-local screen point -> base map coordinates. */
  _screenToWorld(sx, sy) {
    return [(sx - this.cam.x) / this.cam.scale, (sy - this.cam.y) / this.cam.scale];
  }

  /** Zoom by `factor` keeping the map point under (mx, my) fixed on screen. */
  _zoomAt(mx, my, factor) {
    const s0 = this.cam.scale;
    const s1 = clamp(s0 * factor, CHART_ZOOM_MIN, CHART_ZOOM_MAX);
    if (Math.abs(s1 - s0) < 1e-4) return;
    this.cam.x = mx - (mx - this.cam.x) * (s1 / s0);
    this.cam.y = my - (my - this.cam.y) * (s1 / s0);
    this.cam.scale = s1;
    this._clampCam();
    this._draw();
  }

  /** Keep part of the map reachable: never pan it fully off the canvas. */
  _clampCam() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const m = 60;
    const s = this.cam.scale;
    this.cam.x = clamp(this.cam.x, m - rect.width * s, rect.width - m);
    this.cam.y = clamp(this.cam.y, m - rect.height * s, rect.height - m);
  }

  _resetCam() {
    this.cam.scale = 1;
    this.cam.x = 0;
    this.cam.y = 0;
    this._draw();
  }

  /** Midpoint + finger distance of the first two active pointers. */
  _pinchState() {
    const [a, b] = [...this._pointers.values()];
    return {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
    };
  }

  unmount() {
    if (this.wrap) {
      this.canvas.removeEventListener('click', this._onCanvasClick);
      this.canvas.removeEventListener('wheel', this._onWheel);
      this.canvas.removeEventListener('dblclick', this._onDblClick);
      this.canvas.removeEventListener('pointerdown', this._onPointerDown);
      this.canvas.removeEventListener('pointermove', this._onPointerMove);
      this.canvas.removeEventListener('pointerup', this._onPointerUp);
      this.canvas.removeEventListener('pointercancel', this._onPointerUp);
      this._pointers.clear();
      this._pinch = null;
      this.wrap.remove();
      this.wrap = null;
    }
    this.route = null;
    this.routeMeta = null;
    this.ctx = null;
  }
}
