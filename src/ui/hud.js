// In-flight HUD: ship bars, flight vector, radar, target plate, world labels.

import * as THREE from 'three';
import { el, clear } from './dom.js';
import { fmtCredits, fmtNum, clamp, wrapAngle, dist2 } from '../core/util.js';
import { SYSTEMS, RIM_RADIUS, laneAngle } from '../data/systems.js';
import { farEnd } from '../game/wormholes.js';
import { FACTIONS } from '../data/factions.js';
import { careerSummary } from '../game/skills.js';
import { BURST } from '../game/ship.js';
import { MISSION_COLORS, missionGuide, missionStationName } from '../game/missions.js';

const ROLE_COLORS = {
  pirate: '#ff8a6a',
  bounty: '#ff5f6e',
  navy: '#b48cff',
  trader: '#9fd8a8',
  house: '#e8a05a',
  escort: '#8fe08f',
  courier: '#c8f0ff',
  player: '#ffffff',
};

/** Objective label colors, matched to the contract boards (dock + star chart). */
const OBJ_COLORS = {
  DELIVER: '#ffc857',
  COURIER: '#8fd0ff',
  FILE: '#ffc857',
  KILL: '#ff5f7a',
  SCAN: '#a58cff',
  RAID: '#ff9a3c',
  RECOVER: '#63ffc0',
  WARP: '#56e6ff',
};

/** Hull bars run green → amber → red as the plating is opened. */
function hullGradient(ratio) {
  const r = clamp(ratio, 0, 1);
  const hue = 6 + r * 132; // 6 = red, 138 = healthy green
  return `linear-gradient(180deg, hsl(${hue} 92% 64%), hsl(${hue} 82% 34%))`;
}

export class Hud {
  constructor(root, labelsRoot) {
    this.root = root;
    this.labelsRoot = labelsRoot;
    this.visible = false;
    this._labels = new Map();
    this._plates = new Map();
    this._lastUniverse = null;
    this._lastPlatesUniverse = null;
    this._project = new THREE.Vector3();
    this._project2 = new THREE.Vector3();

    // ---- selected-target reticle (white brackets around the enemy ship) ----
    this.reticle = el('div', { class: 'hud-reticle hidden' }, [
      el('span'), el('span'), el('span'), el('span'),
    ]);
    labelsRoot.append(this.reticle);

    // ---- top-left: ship status ----
    this.shipName = el('div', { class: 'stitle', text: '—' });
    this.barArmor = this._bar('armor', 'Hull');
    this.barShield = this._bar('shield', 'Shields');
    this.barEnergy = this._bar('energy', 'Energy');
    this.shieldNote = el('div', { class: 'snote', text: '' });
    this.statSpeed = el('b', { text: '0' });
    this.statDrift = el('b', { text: '0°' });
    this.statZoom = el('b', { text: '×1.0' });
    const tlInner = el('div', { class: 'rack' }, [
      this.shipName,
      this.barArmor.wrap, this.barShield.wrap, this.shieldNote, this.barEnergy.wrap,
      el('div', { class: 'statline' }, [el('span', { text: 'Speed' }), el('span', {}, [this.statSpeed, ' u/s'])]),
      el('div', { class: 'statline' }, [el('span', { text: 'Drift' }), el('span', {}, [this.statDrift])]),
      el('div', { class: 'statline' }, [el('span', { text: 'View' }), el('span', {}, [this.statZoom])]),
    ]);
    this.vane = el('canvas', { id: 'vectorvane', width: 212, height: 124 });
    const tl = el('div', { class: 'hud-box hud-tl' }, [tlInner, el('div', { class: 'rack' }, [this.vane])]);

    // ---- top-right: purse & clock ----
    this.credits = el('div', { class: 'credits', text: '₡0' });
    this.lineSystem = el('div', { class: 'line' });
    this.lineNav = el('div', { class: 'line nav' });
    this.lineMission = el('div', { class: 'line mission' });
    this.lineHold = el('div', { class: 'line' });
    this.lineLumen = el('div', { class: 'line' });
    this.lineRep = el('div', { class: 'line' });
    this.lineCareer = el('div', { class: 'line' });
    this.lineFleet = el('div', { class: 'line' });
    const tr = el('div', { class: 'hud-box hud-tr' }, [
      el('div', { class: 'rack' }, [this.credits, this.lineSystem, this.lineNav, this.lineMission, this.lineHold, this.lineLumen, this.lineRep, this.lineCareer, this.lineFleet]),
    ]);

    // ---- target plate ----
    this.tName = el('div', { class: 'tname', text: '' });
    this.tMeta = el('div', { class: 'tmeta', text: '' });
    this.tState = el('div', { class: 'tstate hidden', text: '' });
    this.tShield = this._bar('shield', 'Shields');
    this.tHull = this._bar('hull', 'Hull');
    this.tSnare = this._bar('snare', 'Snare');
    this.targetPlate = el('div', { class: 'hud-box hud-target targetplate' }, [
      this.tName, this.tMeta, this.tState, this.tShield.wrap, this.tHull.wrap, this.tSnare.wrap,
    ]);

    // ---- prompt ----
    this.prompt = el('div', { class: 'hud-box hud-prompt' });

    // ---- radar ----
    this.radar = el('canvas', { id: 'radar', width: 240, height: 240 });
    const br = el('div', { class: 'hud-box hud-br radar-wrap' }, [this.radar]);

    this.root.append(tl, tr, this.targetPlate, this.prompt, br);
    this._vaneCtx = this.vane.getContext('2d');
    this._radarCtx = this.radar.getContext('2d');
  }

  _bar(kind, label = '') {
    const fill = el('div', { class: `fill ${kind}` });
    const value = el('span', { class: 'bval', text: '' });
    const wrap = el('div', { class: 'bar' }, [
      el('div', { class: 'lbl' }, [el('span', { text: label }), value]),
      fill,
    ]);
    return { wrap, fill, value };
  }

  show() {
    this.visible = true;
    this.root.classList.remove('hidden');
    this.labelsRoot.classList.remove('hidden');
  }

  hide() {
    this.visible = false;
    this.root.classList.add('hidden');
    this.labelsRoot.classList.add('hidden');
    this._clearLabels();
    this._clearPlates();
  }

  update(ctx) {
    if (!this.visible) return;
    const { state, universe: u, player: p } = ctx;
    const st = p.stats;

    // ---- your own hull: colour-coded, with the numbers spelled out ----
    this.shipName.textContent = `${state.shipName} · ${p.def.name}`;
    const hullRatio = clamp(p.hull / st.hull, 0, 1);
    const shieldRatio = clamp(p.shield / st.shield, 0, 1);
    this.barArmor.fill.style.width = `${hullRatio * 100}%`;
    this.barArmor.value.textContent = `${Math.max(0, Math.round(p.hull))}/${Math.round(st.hull)}`;
    this.barArmor.fill.style.background = hullGradient(hullRatio);
    this.barArmor.wrap.classList.toggle('critical', hullRatio < 0.35);
    this.barShield.fill.style.width = `${shieldRatio * 100}%`;
    this.barShield.value.textContent = `${Math.max(0, Math.round(p.shield))}/${Math.round(st.shield)}`;
    this.barShield.fill.style.background = p.shipProfile?.css || '';
    this.barShield.wrap.classList.toggle('down', p.shield <= 0);
    this.barShield.wrap.classList.toggle('low', shieldRatio > 0 && shieldRatio < 0.3);
    this.barEnergy.fill.style.width = `${clamp(p.energy / st.energy, 0, 1) * 100}%`;
    this.barEnergy.value.textContent = `${Math.round(p.energy)}/${Math.round(st.energy)}`;
    this.shieldNote.textContent = p.disabled
      ? 'SNARED — drives, guns and helm are dead'
      : p.shield <= 0
        ? `SHIELDS DOWN — ${p.shipProfile?.name || 'lattice'} recharging`
        : `${p.shipProfile?.name || 'Deflector Lattice'} · +${Math.round(st.shieldRegen * 10) / 10}/s`;
    this.shieldNote.classList.toggle('warn', p.disabled || p.shield <= 0);

    this.statSpeed.textContent = Math.round(p.speed);
    this.statDrift.textContent = `${p.speed > 6 ? Math.round(p.driftDeg) : 0}°`;
    this.statZoom.textContent = `×${u.zoomLevel.toFixed(2)}`;

    this.credits.textContent = fmtCredits(state.credits);
    this.lineSystem.textContent = '';
    this.lineSystem.innerHTML = `${u.system.name} · day ${state.day} · ${u.system.links.length} lanes`;

    // warp field status: clear to fold space, or the bearing to open space
    if (!u.warpBlock) {
      this.lineNav.innerHTML = 'WARP FIELD <b>clear</b> — J plots a lane';
    } else {
      const theta = Math.atan2(u.warpBlock.x - p.x, -(u.warpBlock.z - p.z)); // screen-space bearing
      const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
      const idx = ((Math.round(theta / (Math.PI / 4)) % 8) + 8) % 8;
      this.lineNav.innerHTML = `FIELD DAMPENED ${arrows[idx]} <b>${Math.round(u.warpBlock.dist)} m</b> to clear space`;
    }

    this.lineHold.innerHTML = `Hold <b>${state.cargoUsed()}/${st.cargo}</b> · salvage <b>${u.pods.length}</b>`;

    // tracked contract — the job whose course is plotted on the star charts,
    // with the NEXT STEP spelled out (return legs point back at the office)
    const tracked = (state.missions || []).find((m) => m.id === ctx.trackedMissionId);
    if (tracked) {
      const guide = missionGuide(state, tracked, u.systemId);
      const col = MISSION_COLORS[tracked.type] || '#8cffd7';
      const where = guide.systemId
        ? (guide.stationId
          ? `${missionStationName(guide.systemId, guide.stationId)} \u00b7 ${SYSTEMS[guide.systemId].name}`
          : SYSTEMS[guide.systemId].name)
        : '\u2014';
      const returning = guide.phase === 'return';
      this.lineMission.classList.remove('hidden');
      this.lineMission.classList.toggle('return', returning);
      this.lineMission.innerHTML =
        `<span style="color:${returning ? '#ffd27a' : col}">\u25C6</span> `
        + `<span class="mverb">${returning ? '\u25C0 RETURN TO' : guide.verb}</span> <b>${where}</b>`
        + `${guide.here ? ' \u00b7 <span class="mhere">you are here</span>' : ''}`
        + `<span class="mnext">${tracked.title}${guide.note ? ` \u2014 ${guide.note}` : ''}</span>`;
    } else {
      this.lineMission.classList.add('hidden');
    }

    this.lineLumen.innerHTML = `Lumen <b>${state.lumen}/${st.lumenMax}</b>`;
    const rep = state.rep;
    this.lineRep.innerHTML = `Rep: Cmb <b>${rep.combine}</b> · Vgl <b>${rep.vigil}</b> · Rvr <b>${rep.reaver}</b> · Krh <b>${rep.kreth ?? 0}</b>`;
    const career = careerSummary(state);
    this.lineCareer.innerHTML = `Lv <b>${career.level}</b> · SP <b>${career.points}</b> · karma <b>${career.karma >= 0 ? '+' : ''}${career.karma}</b>`;

    // fleet wing status — only when you have capacity or ships
    const fleetSlots = p.stats.fleetSlots || 0;
    const baySlots = p.stats.bays || 0;
    const fleet = state.fleet || [];
    if (fleetSlots > 0 || baySlots > 0 || fleet.length > 0) {
      const escorts = fleet.filter((m) => m.status === 'escort').length;
      const docked = fleet.filter((m) => m.status === 'bay').length;
      this.lineFleet.classList.remove('hidden');
      this.lineFleet.innerHTML = `Wing <b>${escorts}/${fleetSlots}</b> · bays <b>${docked}/${baySlots}</b>`;
    } else {
      this.lineFleet.classList.add('hidden');
    }

    // prompt — only present when there is something to say
    const hasPrompt = !!(ctx.scan || ctx.prompt);
    this.prompt.classList.toggle('hidden', !hasPrompt);
    clear(this.prompt);
    if (ctx.scan) {
      this.prompt.append(el('span', { class: 'key', text: '⟳' }), ` Surveying ${ctx.scan.title}… ${Math.round(ctx.scan.progress * 100)}%`);
    } else if (ctx.prompt) {
      if (ctx.prompt.key) this.prompt.append(el('span', { class: 'key', text: ctx.prompt.key }));
      this.prompt.append(ctx.prompt.text);
    }

    // target — hidden entirely when nothing is locked up
    if (ctx.target) {
      const t = ctx.target;
      this.targetPlate.classList.remove('hidden');
      this.targetPlate.classList.add('on');
      this.tName.textContent = `${t.name}`;
      const d = dist2(p.x, p.z, t.x, t.z);
      const bearing = Math.atan2(t.x - p.x, t.z - p.z);
      const offBore = Math.abs(wrapAngle(bearing - p.heading));
      const arcOk = offBore <= (p.trackCone ?? 0.5);
      const tp = t.shipProfile;
      this.tMeta.innerHTML = `${t.def.cls} · ${t.faction.toUpperCase()} · ${Math.round(d)} m · `
        + `<b style="color:${arcOk ? '#8fe08f' : '#c98a6a'}">${arcOk ? 'SOLVED' : 'OUT OF ARC'}</b>`
        + `<br><span style="color:${tp?.css || '#6fd8ff'}">${tp?.name || 'Deflector Lattice'}</span>`;
      this.targetPlate.style.setProperty('--tcol', tp?.css || '#6fd8ff');
      this.tShield.fill.style.width = `${clamp(t.shield / t.stats.shield, 0, 1) * 100}%`;
      this.tShield.fill.style.background = tp?.css || '';
      this.tShield.value.textContent = `${Math.max(0, Math.round(t.shield))}/${Math.round(t.stats.shield)}`;
      this.tShield.wrap.classList.toggle('down', t.shield <= 0);
      this.tHull.fill.style.width = `${clamp(t.hull / t.stats.hull, 0, 1) * 100}%`;
      this.tHull.fill.style.background = hullGradient(t.hull / t.stats.hull);
      this.tHull.value.textContent = `${Math.max(0, Math.round(t.hull))}/${Math.round(t.stats.hull)}`;
      this.tHull.wrap.classList.toggle('critical', t.hull / t.stats.hull < 0.35);

      // what state they are in, and whether the snare is ready to bite
      const bits = [];
      if (t.disabled) bits.push(`SNARED · ${Math.max(0, t.disableTimer).toFixed(1)}s`);
      else if (t.surrendered) bits.push('STRUCK COLOURS — C to claim');
      if (!t.disabled && t.shield <= 0) {
        bits.push(t.disruptImmune > 0 ? `lattice down · snare-immune ${t.disruptImmune.toFixed(0)}s` : 'lattice down · X to snare');
      }
      this.tState.textContent = bits.join(' · ');
      this.tState.classList.toggle('hidden', bits.length === 0);
      const snare = t.disabled ? 0 : t.snareProgress;
      this.tSnare.wrap.classList.toggle('hidden', !(snare > 0.01));
      this.tSnare.fill.style.width = `${snare * 100}%`;
      this.tSnare.value.textContent = `${Math.round(snare * 100)}%`;
    } else {
      this.targetPlate.classList.remove('on');
      this.targetPlate.classList.add('hidden');
    }

    this._drawVector(ctx);
    this._drawRadar(ctx);
    this._updateLabels(ctx);
    this._updateReticle(ctx);
    this._updatePlates(ctx);
  }

  /* ---------------------------------------------------------------- */
  /* Flight vector                                                     */
  /* ---------------------------------------------------------------- */

  _drawVector(ctx) {
    const c = this._vaneCtx;
    const w = this.vane.width;
    const h = this.vane.height;
    c.clearRect(0, 0, w, h);
    const { player: p } = ctx;
    const cx = w * 0.3;
    const cy = h * 0.52;
    const R = 52;

    // dial
    c.strokeStyle = 'rgba(226,164,74,0.4)';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(cx, cy, R, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = 'rgba(226,164,74,0.2)';
    c.beginPath();
    c.arc(cx, cy, R * 0.55, 0, Math.PI * 2);
    c.stroke();
    // bow reference
    c.strokeStyle = 'rgba(232,220,194,0.55)';
    c.beginPath();
    c.moveTo(cx, cy - R);
    c.lineTo(cx, cy - R - 8);
    c.stroke();

    // true course relative to the bow
    const sp = p.speed;
    const rel = sp > 3 ? wrapAngle(p.velocityAngle - p.heading) : 0;
    const frac = Math.min(1, sp / Math.max(1, p.stats.maxSpeed));
    const ax = Math.sin(rel);
    const ay = -Math.cos(rel);
    const len = R * (0.25 + 0.75 * frac);
    const aligned = p.driftDeg < 8 || sp < 40;
    const col = sp < 3 ? 'rgba(140,160,190,0.6)' : aligned ? 'rgba(126,240,138,0.95)' : 'rgba(255,179,71,0.95)';
    c.strokeStyle = col;
    c.lineWidth = 2.6;
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx + ax * len, cy + ay * len);
    c.stroke();
    const hx = cx + ax * len;
    const hy = cy + ay * len;
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(hx + ax * 6, hy + ay * 6);
    c.lineTo(hx - ax * 8 - ay * 6, hy - ay * 8 + ax * 6);
    c.lineTo(hx - ax * 8 + ay * 6, hy - ay * 8 - ax * 6);
    c.closePath();
    c.fill();

    // burn / retro authority
    const barW = 92;
    const bx = w - barW - 14;
    c.font = '10px Consolas, monospace';
    c.fillStyle = '#a89a7c';
    c.fillText('BURN', bx, 26);
    c.fillText('RETRO', bx, 72);
    c.fillStyle = 'rgba(0,0,0,0.55)';
    c.fillRect(bx, 32, barW, 8);
    c.fillRect(bx, 78, barW, 8);
    c.fillStyle = 'rgba(255,176,58,0.92)';
    c.fillRect(bx, 32, barW * Math.min(1, p.throttleCmd), 8);
    c.fillStyle = 'rgba(255,107,74,0.92)';
    c.fillRect(bx, 78, barW * Math.min(1, p.brakeCmd), 8);

    // engine burst tank
    c.fillStyle = '#a89a7c';
    c.fillText('BURST', bx, 118);
    c.fillStyle = 'rgba(0,0,0,0.55)';
    c.fillRect(bx, 124, barW, 8);
    const charge = clamp(p.boostCharge ?? 1, 0, 1);
    c.fillStyle = p.boostActive
      ? 'rgba(143,228,255,1)'
      : charge >= BURST.rearm ? 'rgba(143,228,255,0.7)' : 'rgba(255,107,74,0.85)';
    c.fillRect(bx, 124, barW * charge, 8);

    // status
    c.font = '11px Consolas, monospace';
    c.fillStyle = '#e8dcc2';
    c.fillText(sp < 3 ? '—' : `${Math.round(sp)} u/s`, 10, h - 26);
    c.fillStyle = aligned ? '#8fe08f' : '#ffb03a';
    c.fillText(sp < 40 ? '' : aligned ? 'TRACKING' : `DRIFT ${Math.round(p.driftDeg)}°`, 10, h - 12);
  }

  /* ---------------------------------------------------------------- */
  /* Minimap — fixed orientation, matches the 3D view                 */
  /* ---------------------------------------------------------------- */

  _drawRadar(ctx) {
    const c = this._radarCtx;
    const w = this.radar.width;
    const h = this.radar.height;
    const { player: p, universe: u, target } = ctx;
    const cx = w / 2;
    const cy = h / 2;
    const R = w / 2 - 6;

    // one fixed scale for the whole system, so the layout never rescales:
    // world +X is right and world +Z is down, exactly like the main view
    const MAP_RANGE = RIM_RADIUS + 500;
    const s = R / MAP_RANGE;
    const mx = (x) => cx + x * s;
    const my = (z) => cy + z * s;

    c.clearRect(0, 0, w, h);

    // plate
    c.fillStyle = 'rgba(14,12,9,0.92)';
    c.beginPath();
    c.arc(cx, cy, R, 0, Math.PI * 2);
    c.fill();
    c.save();
    c.beginPath();
    c.arc(cx, cy, R, 0, Math.PI * 2);
    c.clip();

    // survey grid (1,000 m squares)
    c.strokeStyle = 'rgba(226,164,74,0.1)';
    c.lineWidth = 1;
    for (let k = -3; k <= 3; k++) {
      const g = k * 1000 * s;
      if (Math.abs(g) > R) continue;
      c.beginPath(); c.moveTo(cx + g, 0); c.lineTo(cx + g, h); c.stroke();
      c.beginPath(); c.moveTo(0, cy + g); c.lineTo(w, cy + g); c.stroke();
    }

    // orbit rings + system rim
    c.strokeStyle = 'rgba(226,164,74,0.16)';
    for (const pl of u.planets) {
      c.beginPath(); c.arc(cx, cy, pl.record.dist * s, 0, Math.PI * 2); c.stroke();
    }
    c.strokeStyle = 'rgba(201,160,255,0.25)';
    c.beginPath(); c.arc(cx, cy, RIM_RADIUS * s, 0, Math.PI * 2); c.stroke();

    // star
    c.fillStyle = 'rgba(255,190,90,0.18)';
    c.beginPath(); c.arc(cx, cy, 11, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,190,90,0.9)';
    c.beginPath(); c.arc(cx, cy, 4.5, 0, Math.PI * 2); c.fill();

    // planets
    for (const pl of u.planets) {
      c.fillStyle = 'rgba(200,178,138,0.75)';
      c.beginPath();
      c.arc(mx(pl.x), my(pl.z), clamp(pl.record.radius * s * 3, 2.5, 7), 0, Math.PI * 2);
      c.fill();
    }

    // stations
    for (const st of u.stations) {
      c.fillStyle = 'rgba(255,176,58,0.95)';
      c.fillRect(mx(st.x) - 3.5, my(st.z) - 3.5, 7, 7);
    }

    // mapped wormholes: a violet eye on the scope (silent until charted)
    for (const wh of u.wormholes || []) {
      if (!wh.discovered) continue;
      c.strokeStyle = 'rgba(196,156,255,0.9)';
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(mx(wh.x), my(wh.z), 6, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = 'rgba(232,216,255,0.95)';
      c.beginPath();
      c.arc(mx(wh.x), my(wh.z), 2.2, 0, Math.PI * 2);
      c.fill();
    }

    // ---- mission objectives: where to go to finish a contract ----
    const objectives = [];
    const dedupe = new Set();
    const pushObj = (kind, x, z, label = null, missionId = null) => {
      const key = `${kind}:${Math.round(x / 50)}:${Math.round(z / 50)}`;
      if (dedupe.has(key)) return;
      dedupe.add(key);
      objectives.push({ kind, x, z, label, missionId });
    };
    // contracts that finish elsewhere point at the rim: the bearing of that
    // lane, so the captain flies clear of the wells and folds space
    const pushForSystem = (kind, systemId, missionId) => {
      if (!systemId || systemId === u.systemId) return; // same system: real positions
      const a = laneAngle(u.systemId, systemId);
      pushObj('WARP', Math.cos(a) * (RIM_RADIUS - 240), Math.sin(a) * (RIM_RADIUS - 240), SYSTEMS[systemId].name, missionId);
    };
    for (const m of ctx.state.missions || []) {
      if ((m.type === 'delivery' || m.type === 'courier') && m.dest) {
        const tag = m.type === 'courier' ? 'COURIER' : 'DELIVER';
        if (m.dest.systemId === u.systemId) {
          for (const st of u.stations) pushObj(tag, st.x, st.z, st.record.name, m.id);
        } else {
          pushForSystem(tag, m.dest.systemId, m.id);
        }
      } else if (m.type === 'survey' || m.type === 'relic') {
        if (!m.scanned) {
          if (m.dest.systemId === u.systemId) {
            const b = u.beacons.find((bb) => bb.missionId === m.id);
            const weak = m.twist?.kind === 'silent';
            // a weak transponder only answers once you are close
            if (b && (!weak || dist2(b.x, b.z, p.x, p.z) < 1600)) {
              pushObj('SCAN', b.x, b.z, weak ? '\u25CB weak signal' : null, m.id);
            }
          } else {
            pushForSystem('SCAN', m.dest.systemId, m.id);
          }
        } else if (m.type === 'survey' && m.issuer) {
          if (m.issuer.systemId === u.systemId) {
            const st = u.stations.find((s) => s.record.id === m.issuer.stationId);
            if (st) pushObj('FILE', st.x, st.z, st.record.name, m.id);
          } else {
            pushForSystem('FILE', m.issuer.systemId, m.id);
          }
        }
      } else if (m.type === 'bounty' && m.dest) {
        if (m.dest.systemId === u.systemId) {
          const ship = u.ships.find((s) => s.bountyMissionId === m.id && s.alive);
          if (ship) pushObj('KILL', ship.x, ship.z, null, m.id);
        } else {
          pushForSystem('KILL', m.dest.systemId, m.id);
        }
      } else if (m.type === 'sweep' && m.dest && m.kills) {
        if (m.dest.systemId === u.systemId) {
          // point at the nearest quarry still on the board
          const foe = m.foe || 'pirate';
          let best = null;
          let bestD = Infinity;
          for (const s of u.ships) {
            if (!s.alive || s.role !== foe || s.isPlayer) continue;
            const dd = dist2(s.x, s.z, p.x, p.z);
            if (dd < bestD) { bestD = dd; best = s; }
          }
          if (best) pushObj(`RAID ${m.kills.got}/${m.kills.need}`, best.x, best.z, null, m.id);
        } else {
          pushForSystem('RAID', m.dest.systemId, m.id);
        }
      } else if (m.type === 'recovery' && m.dest && m.pods) {
        const allTaken = m.pods.taken.length >= m.pods.need;
        if (!allTaken && m.dest.systemId === u.systemId) {
          let best = null;
          let bestD = Infinity;
          for (const pod of u.pods) {
            if (pod.kind !== 'mission' || pod.missionId !== m.id) continue;
            const dd = dist2(pod.x, pod.z, p.x, p.z);
            if (dd < bestD) { bestD = dd; best = pod; }
          }
          // a silent wreck gives no pod pings until you are very close
          const weak = m.twist?.kind === 'silent' && !m.pods.taken.length;
          if (best && (!weak || bestD < 1200)) {
            pushObj(`RECOVER ${m.pods.taken.length}/${m.pods.need}`, best.x, best.z, weak ? '\u25CB faint ping' : null, m.id);
          }
        } else if (allTaken && m.issuer) {
          if (m.issuer.systemId === u.systemId) {
            const st = u.stations.find((s) => s.record.id === m.issuer.stationId);
            if (st) pushObj('DELIVER', st.x, st.z, st.record.name, m.id);
          } else {
            pushForSystem('DELIVER', m.issuer.systemId, m.id);
          }
        } else {
          pushForSystem('RECOVER', m.dest.systemId, m.id);
        }
      }
    }

    // sensor envelope around the player
    const px = mx(p.x);
    const py = my(p.z);
    c.setLineDash([3, 4]);
    c.strokeStyle = 'rgba(226,164,74,0.35)';
    c.beginPath(); c.arc(px, py, p.stats.radar * s, 0, Math.PI * 2); c.stroke();
    c.setLineDash([]);

    // contacts — only what the sensors can actually see
    const seen = (x, z) => dist2(x, z, p.x, p.z) < p.stats.radar;
    for (const pod of u.pods) {
      if (!seen(pod.x, pod.z)) continue;
      if (pod.kind === 'lumen') {
        // a lumen cell glows cold on the scope — worth a detour
        c.fillStyle = 'rgba(200,248,255,0.95)';
        c.beginPath(); c.arc(mx(pod.x), my(pod.z), 2.8, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(140,230,255,0.85)';
        c.lineWidth = 1;
        c.beginPath(); c.arc(mx(pod.x), my(pod.z), 5.5, 0, Math.PI * 2); c.stroke();
        continue;
      }
      c.fillStyle = 'rgba(255,192,96,0.9)';
      c.beginPath(); c.arc(mx(pod.x), my(pod.z), 2.4, 0, Math.PI * 2); c.fill();
    }
    for (const b of u.beacons) {
      if (!seen(b.x, b.z)) continue;
      c.strokeStyle = 'rgba(143,224,143,0.95)';
      c.strokeRect(mx(b.x) - 3, my(b.z) - 3, 6, 6);
    }
    for (const ship of u.ships) {
      if (ship === p || !ship.alive || !seen(ship.x, ship.z)) continue;
      const color = ROLE_COLORS[ship.role] || '#9fb8d8';
      const sx = mx(ship.x);
      const sy = my(ship.z);
      c.fillStyle = color;
      c.beginPath(); c.arc(sx, sy, ship === target ? 4.5 : 3, 0, Math.PI * 2); c.fill();
      if (ship.surrendered) {
        // a prize waiting to be claimed
        c.strokeStyle = '#ffd166';
        c.setLineDash([2, 2]);
        c.beginPath(); c.arc(sx, sy, 6, 0, Math.PI * 2); c.stroke();
        c.setLineDash([]);
      }
      if (ship === target) {
        c.strokeStyle = '#ffffff';
        c.beginPath(); c.arc(sx, sy, 7.5, 0, Math.PI * 2); c.stroke();
      }
    }

    // ---- mission markers: known from the contract, so never sensor-gated.
    // The tracked job's marker wears a second ring and a ◆ so it stands out. ----
    if (objectives.length) {
      const pulse = 0.5 + 0.5 * Math.sin((ctx.time || 0) * 4.5);
      c.font = '8px Consolas, monospace';
      c.textAlign = 'center';
      for (const o of objectives) {
        const ox = mx(o.x);
        const oy = my(o.z);
        const col = OBJ_COLORS[o.kind.split(' ')[0]] || '#ffd98a';
        const isTracked = o.missionId && o.missionId === ctx.trackedMissionId;
        c.globalAlpha = isTracked ? 1 : 0.68;
        c.strokeStyle = col;
        c.lineWidth = 2;
        c.beginPath();
        c.arc(ox, oy, (isTracked ? 7.5 : 6) + pulse * 4, 0, Math.PI * 2);
        c.stroke();
        if (isTracked) {
          c.globalAlpha = 0.45;
          c.beginPath();
          c.arc(ox, oy, 14 + pulse * 5, 0, Math.PI * 2);
          c.stroke();
          c.globalAlpha = 1;
        }
        c.fillStyle = col;
        const ds = isTracked ? 5.5 : 4.5;
        c.beginPath();
        c.moveTo(ox, oy - ds);
        c.lineTo(ox + ds, oy);
        c.lineTo(ox, oy + ds);
        c.lineTo(ox - ds, oy);
        c.closePath();
        c.fill();
        if (isTracked) c.fillStyle = '#ffffff';
        c.fillText((isTracked ? '\u25C6 ' : '') + (o.label || o.kind), ox, oy + 16);
      }
      c.globalAlpha = 1;
    }

    // player arrow — moves across the map, rotates with heading
    c.save();
    c.translate(px, py);
    c.rotate(Math.PI - p.heading);
    c.fillStyle = '#ffd98a';
    c.beginPath();
    c.moveTo(0, -7);
    c.lineTo(-5, 5);
    c.lineTo(0, 2.5);
    c.lineTo(5, 5);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.6)';
    c.lineWidth = 1;
    c.stroke();
    c.restore();

    // let the scope dissolve toward the rim — everything on the plate fades in
    // opacity as it approaches the edge of the circle (masked while clipped,
    // so the bezel captions drawn after the unclip stay untouched)
    const fade = c.createRadialGradient(cx, cy, 0, cx, cy, R);
    fade.addColorStop(0, 'rgba(0,0,0,1)');
    fade.addColorStop(0.62, 'rgba(0,0,0,1)');
    fade.addColorStop(0.85, 'rgba(0,0,0,0.45)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalCompositeOperation = 'destination-in';
    c.fillStyle = fade;
    c.beginPath();
    c.arc(cx, cy, R, 0, Math.PI * 2);
    c.fill();
    c.globalCompositeOperation = 'source-over';

    c.restore(); // unclip

    // bezel captions
    c.font = '10px Consolas, monospace';
    c.textAlign = 'left';
    c.fillStyle = 'rgba(168,154,124,0.95)';
    c.fillText(`SENSOR ${Math.round(p.stats.radar)} m`, 8, h - 8);
    c.textAlign = 'right';
    c.fillStyle = 'rgba(201,160,255,0.75)';
    c.fillText('◇ WARP RIM', w - 8, h - 8);
    c.fillStyle = 'rgba(255,217,138,0.85)';
    c.fillText('◆ MISSION', w - 8, h - 20);
  }

  /* ---------------------------------------------------------------- */
  /* World labels                                                      */
  /* ---------------------------------------------------------------- */

  _clearLabels() {
    for (const item of this._labels.values()) item.node.remove();
    this._labels.clear();
  }

  _labelFor(key, text, cls) {
    let item = this._labels.get(key);
    if (!item) {
      const node = el('div', { class: `wlabel ${cls}` }, [text]);
      this.labelsRoot.append(node);
      item = { node, text };
      this._labels.set(key, item);
    }
    if (item.text !== text) {
      item.text = text;
      item.node.textContent = text;
    }
    return item;
  }

  _updateLabels(ctx) {
    const { universe: u, player: p } = ctx;
    if (this._lastUniverse !== u) {
      this._clearLabels();
      this._lastUniverse = u;
    }
    const cam = u.camera;

    const seen = new Set();
    const place = (key, x, z, text, cls, maxDist = 3400) => {
      const d = dist2(p.x, p.z, x, z);
      if (d > maxDist) return;
      this._project.set(x, 0, z).project(cam);
      const sx = (this._project.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-this._project.y * 0.5 + 0.5) * window.innerHeight;
      if (sx < -60 || sy < -40 || sx > window.innerWidth + 60 || sy > window.innerHeight + 40) return;
      const item = this._labelFor(key, text, cls);
      seen.add(key);
      item.node.style.left = `${sx}px`;
      item.node.style.top = `${sy}px`;
      item.node.style.opacity = String(clamp(1.15 - d / maxDist, 0.15, 1));
      item.node.style.display = '';
    };

    place('star', 0, 0, u.system.star ? `${u.system.name} star` : 'star', 'star', 4200);
    for (const st of u.stations) place(`st-${st.record.id}`, st.x, st.z, st.record.name, 'station');
    for (const wh of u.wormholes || []) {
      if (!wh.discovered) continue;
      place(`wh-${wh.record.id}`, wh.x, wh.z, `Wormhole \u2194 ${SYSTEMS[farEnd(wh.record, u.systemId)].name}`, 'station');
    }
    for (const pl of u.planets) place(`pl-${pl.record.name}`, pl.x, pl.z, pl.record.name, 'planet');
    for (const b of u.beacons) {
      const bm = (ctx.state.missions || []).find((mm) => mm.id === b.missionId);
      // a weak transponder still lights its world label once you are close
      if (bm?.twist?.kind === 'silent' && !bm.scanned && dist2(b.x, b.z, p.x, p.z) > 900) continue;
      const bcTracked = ctx.trackedMissionId && b.missionId === ctx.trackedMissionId;
      const base = bm?.type === 'relic' ? 'Sealed vault' : 'Survey beacon';
      place(`bc-${b.missionId}`, b.x, b.z, bcTracked ? `\u25C6 ${base} — tracked` : base, 'beacon');
    }
    if (ctx.target) place('target', ctx.target.x, ctx.target.z, ctx.target.name, 'target', 4200);

    for (const [key, item] of this._labels) {
      if (!seen.has(key)) {
        item.node.remove();
        this._labels.delete(key);
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Ship condition plates                                             */
  /* ---------------------------------------------------------------- */

  _clearPlates() {
    for (const item of this._plates.values()) item.node.remove();
    this._plates.clear();
  }

  _plateFor(ship) {
    let item = this._plates.get(ship);
    if (!item) {
      const shieldFill = el('i');
      const hullFill = el('i');
      const snareFill = el('i');
      const name = el('span', { class: 'pname' });
      const state = el('span', { class: 'pstate' });
      const shieldBar = el('div', { class: 'pbar shield' }, [shieldFill]);
      const hullBar = el('div', { class: 'pbar hull' }, [hullFill]);
      const snareBar = el('div', { class: 'pbar snare' }, [snareFill]);
      const node = el('div', { class: 'splate' }, [
        el('div', { class: 'phead' }, [name, state]),
        shieldBar, hullBar, snareBar,
      ]);
      this.labelsRoot.append(node);
      item = { node, name, state, shieldFill, hullFill, snareFill, shieldBar, hullBar, snareBar };
      this._plates.set(ship, item);
    }
    return item;
  }

  /**
   * Minimalist condition plates: two thin bars that appear over a hull the
   * player is locked onto or has been firing at, and over any ship running
   * less than full shields or an opened hull. Colour-coded — the shield bar
   * wears the lattice's own colour, the hull bar runs green to red.
   */
  _updatePlates(ctx) {
    const { universe: u, player: p } = ctx;
    if (this._lastPlatesUniverse !== u) {
      this._clearPlates();
      this._lastPlatesUniverse = u;
    }
    const cam = u.camera;
    const now = u.time;
    const seen = new Set();

    for (const s of u.ships) {
      if (s.isPlayer || !s.alive || s.despawn) continue;
      const shieldRatio = clamp(s.shield / s.stats.shield, 0, 1);
      const hullRatio = clamp(s.hull / s.stats.hull, 0, 1);
      const isTarget = ctx.target === s;
      const engaged = (s._playerFireT ?? -99) > now - 6;
      const hurt = shieldRatio < 0.999 || hullRatio < 0.999 || s.disabled;
      if (!isTarget && !engaged && !hurt) continue;

      const d = dist2(p.x, p.z, s.x, s.z);
      if (d > 3400) continue;
      this._project.set(s.x, 0, s.z).project(cam);
      if (this._project.z > 1) continue; // behind the camera
      const sx = (this._project.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-this._project.y * 0.5 + 0.5) * window.innerHeight;
      if (sx < -80 || sy < -60 || sx > window.innerWidth + 80 || sy > window.innerHeight + 60) continue;

      const item = this._plateFor(s);
      seen.add(s);
      const loud = isTarget || engaged;
      item.node.className = `splate${loud ? ' loud' : ''}${isTarget ? ' target' : ''}`
        + `${s.disabled ? ' snared' : s.surrendered ? ' yielded' : ''}${hurt && !loud ? ' quiet' : ''}`;
      item.node.style.left = `${sx}px`;
      item.node.style.top = `${sy - 26}px`;
      item.node.style.opacity = String(clamp(1.1 - d / 3400, 0.25, 1));
      // the bars are sized off the hull so a cruiser's plate reads bigger
      item.node.style.setProperty('--pw', `${clamp(38 + (s.def?.len ?? 20) * 1.15, 40, 132)}px`);

      item.name.textContent = s.name;
      item.shieldFill.style.width = `${shieldRatio * 100}%`;
      item.shieldFill.style.background = s.shipProfile?.css || '';
      item.hullFill.style.width = `${hullRatio * 100}%`;
      item.hullFill.style.background = hullGradient(hullRatio);
      const snare = s.disabled ? 0 : s.snareProgress;
      item.snareBar.classList.toggle('hidden', !(snare > 0.01));
      item.snareFill.style.width = `${snare * 100}%`;
      item.state.textContent = s.disabled
        ? `SNARED ${Math.max(0, s.disableTimer).toFixed(0)}s`
        : s.surrendered
          ? 'STRUCK'
          : shieldRatio <= 0 && isTarget
            ? 'SHIELDS DOWN'
            : '';
    }

    for (const [ship, item] of this._plates) {
      if (seen.has(ship)) continue;
      item.node.remove();
      this._plates.delete(ship);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Selected-target reticle                                           */
  /* ---------------------------------------------------------------- */

  _updateReticle(ctx) {
    const t = ctx.target;
    if (!t) {
      this.reticle.classList.add('hidden');
      return;
    }
    const cam = ctx.universe.camera;
    this._project.set(t.x, 0, t.z).project(cam);
    if (this._project.z > 1) { // behind the camera
      this.reticle.classList.add('hidden');
      return;
    }
    const sx = (this._project.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-this._project.y * 0.5 + 0.5) * window.innerHeight;
    const pad = 80;
    if (sx < -pad || sy < -pad || sx > window.innerWidth + pad || sy > window.innerHeight + pad) {
      this.reticle.classList.add('hidden');
      return;
    }
    // size the brackets from the ship's length so they hug it at any zoom
    const len = t.def?.len || 30;
    this._project2.set(t.x + len, 0, t.z).project(cam);
    const spanPx = Math.abs(this._project2.x - this._project.x) * 0.5 * window.innerWidth;
    const size = clamp(spanPx * 2.1, 34, 460);
    this.reticle.classList.remove('hidden');
    this.reticle.style.left = `${sx}px`;
    this.reticle.style.top = `${sy}px`;
    this.reticle.style.width = `${size}px`;
    this.reticle.style.height = `${size}px`;
  }
}
