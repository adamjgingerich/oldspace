// ---------------------------------------------------------------------------
// The Vector Challenge — the lanes' oldest holo-sim circuit. Every port with a
// bar keeps a rig, and every rig runs the same wire-and-phosphor arena. The
// sim flies the pilots' real hulls, rebuilt as glowing vector models so a
// freighter reads like a freighter even in green lines.
//
// Two cards on the machine:
//   Duel     — three pilots, last one flying takes the purse.
//   Harvest  — ninety seconds on the crystal field, most crystals wins.
//
// The field fights modern: hills the hulls ride over, straight walls that
// stop shots and bounce hulls, launch ramps that throw you clean over the
// walls when you cross them fast — and item pads, the circuit's one mercy.
// A pad hands out a burst of drive, a rapid-fire rig or a shield, and the
// other pilots take them too. Everything wraps around the grid — nothing
// leaves the field.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { buildShip } from '../core/meshes.js';
import { glowSprite } from '../core/fx.js';
import { SHIP_BY_ID, SHIPS } from '../data/ships.js';
import { computeStats } from './state.js';
import { audio } from '../core/audio.js';
import { rngOf } from '../core/rng.js';
import { clamp } from '../core/util.js';
import { el, btn, clear } from '../ui/dom.js';

const ARENA = 560;            // half-extent of the square field
const PLAYER_COLOR = 0x6effa8;
const AI_COLORS = [0xff6b7a, 0xffb45c, 0x8fd0ff, 0xc792ff];
const CRYSTAL_COLOR = 0x5cffd8;
const PAD_COLOR = 0xffe66b;
const HARVEST_TIME = 90;      // seconds per harvest match
const CALLSIGNS = ['MIRA', 'KESTREL', 'OCHRE', 'SABLE', 'JUNO', 'PIKE', 'TALON', 'VIGO'];

const MODE_INFO = {
  duel: {
    name: 'Duel',
    line: 'Three pilots, one field. Last pilot flying takes the purse.',
  },
  harvest: {
    name: 'Harvest',
    line: 'Ninety seconds over the crystal field. Most crystals when the clock runs out.',
  },
};

const PICKUP_KINDS = ['burst', 'rapid', 'shield'];
const PICKUP_NAMES = { burst: 'DRIVE BURST', rapid: 'RAPID FIRE', shield: 'SHIELD' };
// the world wants numeric colors, the HUD pop-out wants CSS strings
const PICKUP_COLORS = { burst: 0xffb45c, rapid: 0x8fd0ff, shield: 0xc792ff };
const PICKUP_CSS = { burst: '#ffb45c', rapid: '#8fd0ff', shield: '#c792ff' };

const roundAng = (a) => {
  let b = a;
  while (b > Math.PI) b -= Math.PI * 2;
  while (b < -Math.PI) b += Math.PI * 2;
  return b;
};

/** Classic wire look: dark fill, bright phosphor edges, engine glows kept. */
function vectorize(group, colorHex) {
  const fill = new THREE.MeshBasicMaterial({
    color: 0x0b111a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false,
  });
  const wire = new THREE.LineBasicMaterial({
    color: colorHex, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  group.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    n.material = fill;
    n.add(new THREE.LineSegments(new THREE.EdgesGeometry(n.geometry, 24), wire));
  });
}

export class VectorChallenge {
  constructor({ host, state, autoMode = null, onFinish = null, onQuit = null }) {
    this.host = host;
    this.state = state;
    this.onFinish = onFinish;
    this.onQuit = onQuit;
    this.rec = state.vector || { played: 0, wins: 0, best: 0, champion: null };

    this.rng = rngOf(state.worldSeed, 'vector', Date.now() % 100000);
    this.shipId = state.shipId || 'wayfarer';
    this.commander = state.commander || 'Commander';
    this.shipName = state.shipName || SHIP_BY_ID[this.shipId]?.name || 'Cutter';

    this.match = null;
    this.pilots = [];
    this.shots = [];
    this.crystals = [];
    this.pickups = [];
    this.terrain = [];        // three.js objects rebuilt per match
    this.walls = [];          // solid barriers
    this.mounds = [];         // elevation bumps
    this.ramps = [];          // launch ramps
    this.t = 0;
    this._last = performance.now();
    this._keys = new Set();
    this._done = false;
    if (typeof window !== 'undefined') window.__vec = this; // dev peek

    this._buildDom();
    this._buildScene();
    this._bindKeys();
    this._resize();
    window.addEventListener('resize', this._onResize);
    this._raf = requestAnimationFrame(this._tick);

    if (autoMode) this.startMatch(autoMode);
    else this._showLobby();
  }

  /* ------------------------------------------------------------------ */
  /* DOM                                                                */
  /* ------------------------------------------------------------------ */

  _buildDom() {
    this.wrap = el('div', { class: 'vec-overlay' }, [
      (this.canvas = el('canvas', { class: 'vec-canvas' })),
      el('div', { class: 'vec-scan' }),
      el('div', { class: 'vec-title' }, [
        el('span', { class: 'vec-title-main', text: 'VECTOR CHALLENGE' }),
        el('span', { class: 'vec-title-sub', text: 'holo-sim · est. before the charts were honest' }),
      ]),
      (this.hud = el('div', { class: 'vec-hud hidden' }, [
        el('span', { class: 'vh-mode' }),
        el('span', { class: 'vh-score' }),
        el('span', { class: 'vh-lives' }),
        el('span', { class: 'vh-clock' }),
        (this.pop = el('span', { class: 'vh-pop' })),
      ])),
      (this.lobby = el('div', { class: 'vec-lobby hidden' })),
      (this.over = el('div', { class: 'vec-over hidden' })),
    ]);
    this.host.append(this.wrap);
    this._hudScore = this.wrap.querySelector('.vh-score');
    this._hudLives = this.wrap.querySelector('.vh-lives');
    this._hudClock = this.wrap.querySelector('.vh-clock');
  }

  _pop(text, color = '#fff1a8') {
    this.pop.textContent = text;
    this.pop.style.color = color;
    this.pop.classList.add('on');
    window.clearTimeout(this._popTimer);
    this._popTimer = window.setTimeout(() => this.pop.classList.remove('on'), 1600);
  }

  _showLobby() {
    clear(this.lobby);
    const shipDef = SHIP_BY_ID[this.shipId] || SHIP_BY_ID.wayfarer;
    const wins = this.rec.wins || 0;
    this.lobby.append(el('div', { class: 'vec-panel' }, [
      el('h2', { text: 'The Vector Challenge' }),
      el('p', { class: 'note', text: 'Every port with a bar keeps a rig older than half the hulls outside. The sim reads your registry and flies your own ship — wire and phosphor, like the old pilots ran it. Three to a field; winners take the pot.' }),
      el('div', { class: 'vec-lobby-grid' }, [
        el('div', { class: 'vec-stat' }, [
          el('span', { class: 'vs-label', text: 'Your rig' }),
          el('span', { class: 'vs-value', text: this.shipName }),
          el('span', { class: 'vs-note', text: `${shipDef.cls} · flown as it sits in the bay` }),
        ]),
        el('div', { class: 'vec-stat' }, [
          el('span', { class: 'vs-label', text: 'Circuit record' }),
          el('span', { class: 'vs-value', text: `${wins} win${wins === 1 ? '' : 's'} · best ${this.rec.best || 0}` }),
          el('span', { class: 'vs-note', text: this.rec.champion ? `champion: ${this.rec.champion}` : 'no champion yet' }),
        ]),
      ]),
      el('div', { class: 'vec-mode-btns' }, [
        btn('Duel — three pilots, last one flying', () => this.startMatch('duel'), 'btn primary'),
        btn('Harvest — ninety seconds on the crystal field', () => this.startMatch('harvest'), 'btn primary'),
      ]),
      el('p', { class: 'vec-keys' }, [
        'W/S thrust · A/D yaw · SPACE fire · ESC step out. ',
        'The field has hills, walls and launch ramps — cross a ramp fast and the field throws you over the walls. ',
        'Item pads hand out drive bursts, rapid fire and shields. Everything wraps around the grid.',
      ]),
      btn('Step out', () => this.quit(), 'btn ghost'),
    ]));
    this.hud.classList.add('hidden');
    this.lobby.classList.remove('hidden');
    this.over.classList.add('hidden');
  }

  _showResults(result) {
    clear(this.over);
    const r = this.rec;
    const place = ['', 'first', 'second', 'third'][result.place] || `${result.place}th`;
    this.over.append(el('div', { class: 'vec-panel' }, [
      el('h2', { text: result.place === 1 ? 'The field is yours' : `You took ${place}` }),
      el('p', { class: 'note', text: result.note }),
      el('div', { class: 'vec-lobby-grid' }, [
        el('div', { class: 'vec-stat' }, [
          el('span', { class: 'vs-label', text: 'Score' }),
          el('span', { class: 'vs-value', text: String(result.score) }),
          el('span', { class: 'vs-note', text: `circuit best: ${Math.max(r.best || 0, result.score)}` }),
        ]),
        el('div', { class: 'vec-stat' }, [
          el('span', { class: 'vs-label', text: 'Payout' }),
          el('span', { class: 'vs-value', text: `₡${result.payout.toLocaleString()} · +${result.xp} XP` }),
          el('span', { class: 'vs-note', text: result.place === 1 ? 'the meetup marks the win' : 'the desk pays consolation' }),
        ]),
      ]),
      el('div', { class: 'vec-mode-btns' }, [
        btn('Run another', () => this.startMatch(this._lastMode), 'btn primary'),
        btn('Step out', () => this.quit(), 'btn ghost'),
      ]),
    ]));
    this.hud.classList.add('hidden');
    this.lobby.classList.add('hidden');
    this.over.classList.remove('hidden');
  }

  /* ------------------------------------------------------------------ */
  /* Scene                                                              */
  /* ------------------------------------------------------------------ */

  _buildScene() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: false, stencil: false });
    this.renderer.setClearColor(0x020408);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 1, 4000);
    this.camera.position.set(0, 60, -140);

    // stars far below the grid — the sim never lets you forget it is night
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(340 * 3);
    for (let i = 0; i < 340; i++) {
      starPos[i * 3] = (this.rng.float(0, 1) - 0.5) * 4000;
      starPos[i * 3 + 1] = -60 - this.rng.float(0, 1) * 800;
      starPos[i * 3 + 2] = (this.rng.float(0, 1) - 0.5) * 4000;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0x3a5f8a, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0.8,
    })));

    // the grid floor
    this.grid = new THREE.GridHelper(ARENA * 2, 44, 0x2cff9a, 0x145234);
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.32;
    this.grid.material.depthWrite = false;
    this.scene.add(this.grid);

    // the boundary rail — the only wall the sim respects is a bright line
    const railGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(ARENA * 2, ARENA * 2));
    const rail = new THREE.LineSegments(railGeo, new THREE.LineBasicMaterial({
      color: 0x2cff9a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending,
    }));
    rail.rotation.x = -Math.PI / 2;
    rail.position.y = 0.4;
    this.scene.add(rail);

    // shot pool: glowing dashes, one mesh per shot, reused forever
    this.shotPool = [];
    const shotGeo = new THREE.BoxGeometry(1.6, 1.6, 5);
    for (let i = 0; i < 48; i++) {
      const mesh = new THREE.Mesh(shotGeo, new THREE.MeshBasicMaterial({
        transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      mesh.visible = false;
      this.scene.add(mesh);
      this.shotPool.push(mesh);
    }

    // burst pool for hits, deaths and pickups
    this.burstPool = [];
    for (let i = 0; i < 26; i++) {
      const spr = glowSprite(0xffffff, 30);
      spr.visible = false;
      this.scene.add(spr);
      this.burstPool.push({ spr, t: 0, vx: 0, vz: 0, max: 0.5 });
    }
  }

  _spawnBurst(x, y, z, color, size = 1) {
    const b = this.burstPool.find((p) => p.t <= 0) || this.burstPool[0];
    b.t = 0.45;
    b.max = 0.45;
    b.spr.material.color.setHex(color);
    b.spr.material.opacity = 0.9;
    b.spr.visible = true;
    b.spr.position.set(x, y + 6, z);
    b.spr.scale.setScalar(26 * size);
    audio.boom(0.35 * size);
  }

  /* ------------------------------------------------------------------ */
  /* Terrain                                                            */
  /* ------------------------------------------------------------------ */

  /** Height of the field under (x, z). Ships hover 6 units above it. */
  groundAt(x, z) {
    let h = 0;
    for (const b of this.mounds) {
      const d2 = (x - b.x) ** 2 + (z - b.z) ** 2;
      if (d2 < b.r2) h += b.h * Math.exp(-d2 / b.r2);
    }
    for (const r of this.ramps) {
      if (x > r.x - r.l && x < r.x + r.l && z > r.z - r.w && z < r.z + r.w) {
        const t = (x - (r.x - r.l)) / (r.l * 2); // 0 → 1 along the ramp
        h += r.rise * clamp(t, 0, 1);
      }
    }
    return h;
  }

  /** A launch the pilot can take right now — 0 when there is no ramp here. */
  launchAt(x, z, speed) {
    for (const r of this.ramps) {
      if (x > r.x - r.l && x < r.x + r.l && z > r.z - r.w && z < r.z + r.w && speed > r.minSpeed) {
        return r.vy;
      }
    }
    return 0;
  }

  /** The field: hills, straight walls, pyramids and launch ramps. */
  _buildTerrain() {
    this.terrain = [];
    this.walls = [];
    this.mounds = [];
    this.ramps = [];
    const add = (obj) => { this.scene.add(obj); this.terrain.push(obj); };

    // pyramids — solid walls now, the way the old field always wanted
    const pyGeo = new THREE.ConeGeometry(16, 30, 4);
    const pyEdges = new THREE.EdgesGeometry(pyGeo, 30);
    const pyFill = new THREE.MeshBasicMaterial({ color: 0x0a1420, transparent: true, opacity: 0.6, depthWrite: false });
    const pyWire = new THREE.LineBasicMaterial({ color: 0xff5f8f, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending });
    let placed = 0;
    let guard = 0;
    while (placed < 9 && guard++ < 200) {
      const x = this.rng.float(0, 1) * ARENA * 1.6 - ARENA * 0.8;
      const z = this.rng.float(0, 1) * ARENA * 1.6 - ARENA * 0.8;
      if (Math.hypot(x, z) < 170) continue;
      const g = new THREE.Group();
      const m = new THREE.Mesh(pyGeo, pyFill);
      m.add(new THREE.LineSegments(pyEdges, pyWire));
      g.add(m);
      g.position.set(x, 15, z);
      add(g);
      this.walls.push({ x, z, r: 20, h: 30 });
      placed++;
    }

    // straight wall slabs — the shots die on them and hulls bounce off
    const barGeo = new THREE.BoxGeometry(80, 22, 10);
    const barEdges = new THREE.EdgesGeometry(barGeo);
    const barFill = new THREE.MeshBasicMaterial({ color: 0x0d1622, transparent: true, opacity: 0.7, depthWrite: false });
    const barWire = new THREE.LineBasicMaterial({ color: 0xffb45c, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 4; i++) {
      const a = this.rng.float(0, 1) * Math.PI;
      const x = Math.cos(a) * (260 + this.rng.float(0, 1) * 180);
      const z = Math.sin(a) * (260 + this.rng.float(0, 1) * 180);
      const m = new THREE.Mesh(barGeo, barFill);
      m.add(new THREE.LineSegments(barEdges, barWire));
      m.rotation.y = a;
      m.position.set(x, 11, z);
      add(m);
      this.walls.push({ x, z, hw: 40, hd: 5, h: 22, rot: a });
    }

    // hills — soft elevation the ships ride over
    const moundGeo = new THREE.ConeGeometry(70, 30, 6);
    const moundEdges = new THREE.EdgesGeometry(moundGeo, 40);
    const moundFill = new THREE.MeshBasicMaterial({ color: 0x08131c, transparent: true, opacity: 0.65, depthWrite: false });
    const moundWire = new THREE.LineBasicMaterial({ color: 0x2c6f8f, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
    let mPlaced = 0;
    let mGuard = 0;
    while (mPlaced < 3 && mGuard++ < 200) {
      const x = this.rng.float(0, 1) * ARENA * 1.2 - ARENA * 0.6;
      const z = this.rng.float(0, 1) * ARENA * 1.2 - ARENA * 0.6;
      if (Math.hypot(x, z) < 190) continue;
      const m = new THREE.Mesh(moundGeo, moundFill);
      m.add(new THREE.LineSegments(moundEdges, moundWire));
      m.position.set(x, 15, z);
      add(m);
      this.mounds.push({ x, z, h: 18, r2: 72 * 72 });
      mPlaced++;
    }

    // launch ramps — cross them fast and the field throws you over the walls
    const rampGeo = new THREE.BoxGeometry(80, 4, 16);
    const rampEdges = new THREE.EdgesGeometry(rampGeo);
    const rampFill = new THREE.MeshBasicMaterial({ color: 0x12201a, transparent: true, opacity: 0.75, depthWrite: false });
    const rampWire = new THREE.LineBasicMaterial({ color: 0x7dffa8, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 2; i++) {
      const a = this.rng.float(0, 1) * Math.PI;
      const x = Math.cos(a) * 300;
      const z = Math.sin(a) * 300;
      const m = new THREE.Mesh(rampGeo, rampFill);
      m.add(new THREE.LineSegments(rampEdges, rampWire));
      m.rotation.y = a;
      m.position.set(x, 10, z);
      add(m);
      this.ramps.push({ x, z, l: 40, w: 8, rise: 26, minSpeed: 150, vy: 215 });
    }
  }

  /** Solid-wall resolve: push out and slide along the face. */
  _collideWalls(p) {
    for (const w of this.walls) {
      if (w.hw) {
        // rotated bar: transform the pilot into the bar's frame
        const dx = p.x - w.x;
        const dz = p.z - w.z;
        const c = Math.cos(-w.rot);
        const s = Math.sin(-w.rot);
        const lx = dx * c - dz * s;
        const lz = dx * s + dz * c;
        const px = clamp(lx, -w.hw, w.hw);
        const pz = clamp(lz, -w.hd, w.hd);
        const ox = lx - px;
        const oz = lz - pz;
        const d2 = ox * ox + oz * oz;
        if (d2 < 12 * 12) {
          const rot = new THREE.Matrix4().makeRotationY(w.rot);
          const v = new THREE.Vector3(ox, 0, oz).applyMatrix4(rot);
          p.x += v.x;
          p.z += v.z;
          p.speed *= 0.55;
        }
        continue;
      }
      const dx = p.x - w.x;
      const dz = p.z - w.z;
      const d = Math.hypot(dx, dz);
      const r = (w.r || 20) + 10;
      if (d < r && d > 0.0001) {
        p.x = w.x + (dx / d) * r;
        p.z = w.z + (dz / d) * r;
        p.speed *= 0.55;
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Item pads                                                          */
  /* ------------------------------------------------------------------ */

  _buildPickups() {
    this.pickups = [];
    const padGeo = new THREE.OctahedronGeometry(7);
    const padEdges = new THREE.EdgesGeometry(padGeo);
    const padFill = new THREE.MeshBasicMaterial({ color: 0x171305, transparent: true, opacity: 0.8, depthWrite: false });
    const padWire = new THREE.LineBasicMaterial({ color: PAD_COLOR, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 4; i++) {
      const x = this.rng.float(0, 1) * ARENA * 1.5 - ARENA * 0.75;
      const z = this.rng.float(0, 1) * ARENA * 1.5 - ARENA * 0.75;
      const g = new THREE.Group();
      const m = new THREE.Mesh(padGeo, padFill);
      m.add(new THREE.LineSegments(padEdges, padWire));
      g.add(m);
      g.position.set(x, 12, z);
      this.scene.add(g);
      this.terrain.push(g);
      this.pickups.push({ x, z, group: g, alive: true, respawn: 0, kind: PICKUP_KINDS[i % PICKUP_KINDS.length], phase: i * 1.7 });
    }
  }

  _grabPickup(p, pad) {
    pad.alive = false;
    pad.group.visible = false;
    pad.respawn = 12;
    this._spawnBurst(pad.x, 10, pad.z, PICKUP_COLORS[pad.kind], 0.7);
    audio.coin();
    if (pad.kind === 'burst') {
      p.boost = 3;
    } else if (pad.kind === 'rapid') {
      p.rapid = 5;
    } else {
      p.shieldT = 4;
      p.invuln = Math.max(p.invuln, 4);
    }
    if (p.isPlayer) this._pop(PICKUP_NAMES[pad.kind], PICKUP_CSS[pad.kind]);
  }

  _updatePickups(dt) {
    for (const pad of this.pickups) {
      pad.phase += dt;
      if (pad.respawn > 0) {
        pad.respawn -= dt;
        if (pad.respawn <= 0) {
          pad.x = this.rng.float(0, 1) * ARENA * 1.5 - ARENA * 0.75;
          pad.z = this.rng.float(0, 1) * ARENA * 1.5 - ARENA * 0.75;
          pad.kind = this.rng.pick(PICKUP_KINDS);
          pad.alive = true;
          pad.group.visible = true;
        }
        continue;
      }
      pad.group.position.set(pad.x, this.groundAt(pad.x, pad.z) + 12 + Math.sin(pad.phase * 2.6) * 3, pad.z);
      pad.group.rotation.y += dt * 1.8;
      if (!pad.alive) continue;
      for (const p of this.pilots) {
        if (!p.alive || p.respawn > 0) continue;
        if ((p.x - pad.x) ** 2 + (p.z - pad.z) ** 2 < 16 ** 2) {
          this._grabPickup(p, pad);
          break;
        }
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Pilots & match                                                     */
  /* ------------------------------------------------------------------ */

  _pilotShipId(i) {
    if (i === 0) return this.shipId;
    return this.rng.pick(SHIPS.map((s) => s.id)) || 'sparrowhawk';
  }

  _makePilot(i, isPlayer) {
    const def = SHIP_BY_ID[this._pilotShipId(i)] || SHIP_BY_ID.wayfarer;
    const color = isPlayer ? PLAYER_COLOR : AI_COLORS[(i - 1) % AI_COLORS.length];
    // the sim reads your registry: your hull, your guns, your rigging. Rivals
    // fly their own hull's standard fit.
    const loadout = isPlayer
      ? {
        weapons: this.state.weapons || def.defaultWeapons,
        outfits: this.state.outfits || {},
        mountCap: computeStats(this.state).mounts,
        showEmpty: true,
      }
      : { weapons: def.defaultWeapons || ['pulse', null] };
    const { group, api } = buildShip(def, { accent: color, isPlayer, loadout });
    vectorize(group, color);
    const s = clamp(26 / Math.max(14, def.len), 0.3, 1.5);
    group.scale.setScalar(s);
    this.scene.add(group);

    const shieldGlow = glowSprite(0x9fd8ff, 30);
    shieldGlow.visible = false;
    group.add(shieldGlow);

    const x = this.rng.float(0, 1) * ARENA * 1.4 - ARENA * 0.7;
    const z = this.rng.float(0, 1) * ARENA * 1.4 - ARENA * 0.7;
    const heading = this.rng.float(0, 1) * Math.PI * 2;
    return {
      name: isPlayer ? this.commander : this.rng.pick(CALLSIGNS),
      isPlayer, color, def, group, api, shieldGlow,
      x, z, y: 0, vy: 0,
      heading, speed: 0,
      alive: true,
      lives: isPlayer ? 3 : 2,
      respawn: 0,
      invuln: 2,
      score: 0,
      elims: 0,
      fireCd: this.rng.float(0, 1),
      strafeDir: this.rng.float(0, 1) < 0.5 ? 1 : -1,
      wobble: this.rng.float(0, 1) * 10,
      boost: 0, rapid: 0, shieldT: 0,
    };
  }

  startMatch(mode) {
    this._lastMode = mode;
    this._teardownMatch();
    this.match = { mode, time: mode === 'harvest' ? HARVEST_TIME : 0, over: false };
    this.pilots = [this._makePilot(0, true)];
    for (let i = 1; i <= 2; i++) this.pilots.push(this._makePilot(i, false));
    for (const sm of this.shotPool) sm.visible = false;
    this.shots.length = 0;
    this._place = 1;

    this._buildTerrain();
    this._buildPickups();

    // the crystal field for the harvest
    this.crystals = [];
    const cryGeo = new THREE.OctahedronGeometry(5);
    const cryWire = new THREE.EdgesGeometry(cryGeo);
    const cryMat = new THREE.MeshBasicMaterial({
      color: CRYSTAL_COLOR, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    for (let i = 0; i < 8; i++) {
      const c = {
        x: this.rng.float(0, 1) * ARENA * 1.7 - ARENA * 0.85,
        z: this.rng.float(0, 1) * ARENA * 1.7 - ARENA * 0.85,
        phase: this.rng.float(0, 1) * 10,
        alive: true,
      };
      const g = new THREE.Group();
      const m = new THREE.Mesh(cryGeo, new THREE.MeshBasicMaterial({
        color: 0x08382e, transparent: true, opacity: 0.7, depthWrite: false,
      }));
      m.add(new THREE.LineSegments(cryWire, cryMat));
      g.add(m);
      g.visible = mode === 'harvest';
      this.scene.add(g);
      c.group = g;
      this.crystals.push(c);
    }

    this.lobby.classList.add('hidden');
    this.over.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.hud.querySelector('.vh-mode').textContent = `${MODE_INFO[mode].name.toUpperCase()} · ${MODE_INFO[mode].line}`;
    audio.dock();
    this._announce(mode === 'duel' ? 'DUEL — LAST PILOT FLYING' : 'HARVEST — THE FIELD IS SEEDED');
  }

  _announce(text) {
    clear(this.over);
    this.over.append(el('div', { class: 'vec-panel vec-announce' }, [el('h2', { text })]));
    this.over.classList.remove('hidden');
    window.clearTimeout(this._announceTimer);
    this._announceTimer = window.setTimeout(() => {
      if (this.over && this.over.querySelector('.vec-announce')) {
        this.over.classList.add('hidden');
        clear(this.over);
      }
    }, 1500);
  }

  _teardownMatch() {
    for (const p of this.pilots) {
      this.scene.remove(p.group);
      p.group.traverse((n) => {
        if (n.geometry) n.geometry.dispose();
      });
    }
    for (const c of this.crystals) this.scene.remove(c.group);
    for (const t of this.terrain) {
      this.scene.remove(t);
      t.traverse((n) => {
        if (n.geometry) n.geometry.dispose();
      });
    }
    this.pilots = [];
    this.crystals = [];
    this.pickups = [];
    this.terrain = [];
    this.walls = [];
    this.mounds = [];
    this.ramps = [];
  }

  /* ------------------------------------------------------------------ */
  /* Input                                                              */
  /* ------------------------------------------------------------------ */

  _bindKeys() {
    this._kd = (e) => {
      const code = e.code;
      if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
        e.preventDefault();
      }
      if (code === 'Escape') {
        e.preventDefault();
        if (this.match && !this.match.over) this._forfeit();
        else this.quit();
        return;
      }
      this._keys.add(code);
    };
    this._ku = (e) => this._keys.delete(e.code);
    window.addEventListener('keydown', this._kd, true);
    window.addEventListener('keyup', this._ku, true);
  }

  _forfeit() {
    if (!this.match || this.match.over) return;
    this.match.over = true;
    this.match.forfeit = true;
    this._finishMatch();
  }

  quit() {
    if (this._done) return;
    this._done = true;
    window.removeEventListener('keydown', this._kd, true);
    window.removeEventListener('keyup', this._ku, true);
    window.removeEventListener('resize', this._onResize);
    cancelAnimationFrame(this._raf);
    window.clearTimeout(this._announceTimer);
    window.clearTimeout(this._popTimer);
    this._teardownMatch();
    this.shotPool.forEach((m) => {
      m.geometry.dispose();
      m.material.dispose();
      this.scene.remove(m);
    });
    this.burstPool.forEach((p) => {
      this.scene.remove(p.spr);
    });
    this.wrap.remove();
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
    this.onQuit?.();
  }

  /* ------------------------------------------------------------------ */
  /* Loop                                                               */
  /* ------------------------------------------------------------------ */

  _onResize = () => this._resize();

  _resize() {
    const w = Math.max(2, window.innerWidth);
    const h = Math.max(2, window.innerHeight);
    const scale = 0.45; // the sim renders chunky on purpose — that is the look
    this.renderer.setSize(Math.round(w * scale), Math.round(h * scale), false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _tick = (now) => {
    if (this._done) return;
    this._raf = requestAnimationFrame(this._tick);
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    this.t += dt;
    if (this.match && !this.match.over) this._update(dt);
    this._render(dt);
  };

  _update(dt) {
    const m = this.match;
    for (const p of this.pilots) {
      if (!p.alive) continue;
      if (p.respawn > 0) {
        p.respawn -= dt;
        if (p.respawn > 0) continue;
        this._respawn(p);
      }
      p.invuln = Math.max(0, p.invuln - dt);
      p.fireCd = Math.max(0, p.fireCd - dt);
      p.boost = Math.max(0, p.boost - dt);
      p.rapid = Math.max(0, p.rapid - dt);
      p.shieldT = Math.max(0, p.shieldT - dt);
      p.shieldGlow.visible = p.shieldT > 0;
      p.shieldGlow.material.opacity = p.shieldT > 0 ? 0.7 : 0;

      if (p.isPlayer) this._playerStep(p, dt);
      else this._aiStep(p, dt);

      const maxSpd = p.boost > 0 ? 330 : 250;
      p.speed = clamp(p.speed, 0, maxSpd);
      p.x += Math.sin(p.heading) * p.speed * dt;
      p.z += Math.cos(p.heading) * p.speed * dt;
      // wrap-around — nothing ever leaves the field
      if (p.x > ARENA) p.x -= ARENA * 2;
      if (p.x < -ARENA) p.x += ARENA * 2;
      if (p.z > ARENA) p.z -= ARENA * 2;
      if (p.z < -ARENA) p.z += ARENA * 2;

      // ground, gravity and jumps
      if (p.y > 0.5 || p.vy !== 0) {
        p.vy -= 430 * dt;
        p.y += p.vy * dt;
        if (p.y <= 0) { p.y = 0; p.vy = 0; }
      } else {
        p.y = 0;
        const jump = this.launchAt(p.x, p.z, p.speed);
        if (jump) {
          p.vy = jump;
          p.y = 1;
          audio.missile(0.5);
        }
      }

      // walls stop low hulls; a launched hull sails over them
      if (p.y < 20) this._collideWalls(p);

      const g = this.groundAt(p.x, p.z);
      p.group.position.set(p.x, g + p.y + 6 + Math.sin(this.t * 2.2 + p.wobble) * 1.2, p.z);
      // nose is +Z, forward is (sin h, cos h) — the same convention the lanes
      // use, so the helm turns the way the nose points
      p.group.rotation.y = p.heading;
      p.api.pulse(this.t);
      p.api.setThrottle(clamp(p.speed / 200, 0.08, 1));
    }

    // harvest clock
    if (m.mode === 'harvest') {
      m.time -= dt;
      if (m.time <= 0) {
        m.time = 0;
        m.over = true;
        this._finishMatch();
        return;
      }
    }

    this._stepShots(dt);
    this._stepBursts(dt);
    this._updateCrystals(dt);
    this._updatePickups(dt);
    this._updateHud();
  }

  /* ------------------------------------------------------------------ */
  /* Helm & AI                                                          */
  /* ------------------------------------------------------------------ */

  _playerStep(p, dt) {
    // The helm's own mapping is written for the top-down lane view. This rig
    // looks over the hull's shoulder instead, so starboard — forward crossed
    // with up — turns clockwise on screen: a right-hand input has to walk the
    // heading down, or the nose swings the wrong way.
    let turn = 0;
    if (this._keys.has('KeyA') || this._keys.has('ArrowLeft')) turn += 1; // to port
    if (this._keys.has('KeyD') || this._keys.has('ArrowRight')) turn -= 1; // to starboard
    p.heading += turn * 2.7 * dt;
    const accel = p.boost > 0 ? 400 : 240;
    if (this._keys.has('KeyW') || this._keys.has('ArrowUp')) p.speed += accel * dt;
    if (this._keys.has('KeyS') || this._keys.has('ArrowDown')) p.speed -= 200 * dt;
    p.speed *= Math.max(0, 1 - 0.6 * dt);
    if (this._keys.has('Space') && p.fireCd <= 0) {
      this._fire(p);
      p.fireCd = p.rapid > 0 ? 0.12 : 0.26;
    }
  }

  _aiStep(p, dt) {
    const enemies = this.pilots.filter((q) => q !== p && q.alive);
    const m = this.match;
    let targetAngle = p.heading;
    let wantFire = false;
    let wantSpeed = 150;

    if (m.mode === 'duel') {
      const target = enemies[0] ? this._nearest(p, enemies) : null;
      if (target) {
        targetAngle = Math.atan2(target.x - p.x, target.z - p.z);
        const d = Math.hypot(target.x - p.x, target.z - p.z);
        const aimErr = Math.abs(roundAng(targetAngle - p.heading));
        if (d < 260 && aimErr < 0.09 && p.fireCd <= 0) wantFire = true;
        // duellists circle instead of ramming once the nose is on target
        if (d < 150 && aimErr < 0.5) {
          targetAngle = Math.atan2(target.x - p.x, target.z - p.z) + p.strafeDir * 1.15;
          wantSpeed = 175;
        } else if (d < 110) {
          wantSpeed = 60;
        }
      }
    } else {
      // harvest: the crystal is the job; the gun is for the pilot in the way
      let best = null;
      let bestD = Infinity;
      for (const c of this.crystals) {
        if (!c.alive) continue;
        const d = (c.x - p.x) ** 2 + (c.z - p.z) ** 2;
        if (d < bestD) { bestD = d; best = c; }
      }
      if (best) targetAngle = Math.atan2(best.x - p.x, best.z - p.z);
      const player = this.pilots[0];
      if (player.alive) {
        const d = Math.hypot(player.x - p.x, player.z - p.z);
        const aimErr = Math.abs(roundAng(Math.atan2(player.x - p.x, player.z - p.z) - p.heading));
        if (d < 240 && aimErr < 0.09 && p.fireCd <= 0) wantFire = true;
      }
    }

    targetAngle = this._avoidObstacles(p, targetAngle);

    const diff = roundAng(targetAngle - p.heading);
    p.heading += clamp(diff, -2.3 * dt, 2.3 * dt);
    p.speed += clamp(wantSpeed - p.speed, -160 * dt, 160 * dt);
    if (wantFire) {
      this._fire(p);
      p.fireCd = (p.rapid > 0 ? 0.3 : 0.85) + this.rng.float(0, 0.6);
    }
  }

  _nearest(p, list) {
    let best = null;
    let bd = Infinity;
    for (const q of list) {
      const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2;
      if (d < bd) { bd = d; best = q; }
    }
    return best;
  }

  _avoidObstacles(p, targetAngle) {
    const probe = 46;
    const sx = p.x + Math.sin(p.heading) * probe;
    const sz = p.z + Math.cos(p.heading) * probe;
    for (const o of this.walls) {
      const r = (o.r || 20) + 14;
      if ((sx - o.x) ** 2 + (sz - o.z) ** 2 < r * r) {
        const l = p.heading - 0.9;
        const r2 = p.heading + 0.9;
        const lx = p.x + Math.sin(l) * probe;
        const lz = p.z + Math.cos(l) * probe;
        const rx = p.x + Math.sin(r2) * probe;
        const rz = p.z + Math.cos(r2) * probe;
        const lc = this.walls.some((o2) => (lx - o2.x) ** 2 + (lz - o2.z) ** 2 < ((o2.r || 20) + 14) ** 2);
        const rc = this.walls.some((o2) => (rx - o2.x) ** 2 + (rz - o2.z) ** 2 < ((o2.r || 20) + 14) ** 2);
        return lc && !rc ? r2 : !rc ? r2 : l;
      }
    }
    return targetAngle;
  }

  _fire(p) {
    if (this.shots.length >= this.shotPool.length) return;
    const speed = 430;
    const vx = Math.sin(p.heading) * speed;
    const vz = Math.cos(p.heading) * speed;
    const mesh = this.shotPool[this.shots.length];
    mesh.visible = true;
    mesh.material.color.setHex(p.isPlayer ? PLAYER_COLOR : p.color);
    const groundY = this.groundAt(p.x, p.z) + p.y + 6;
    mesh.position.set(p.x + Math.sin(p.heading) * 14, groundY + 2, p.z + Math.cos(p.heading) * 14);
    mesh.rotation.y = p.heading;
    this.shots.push({ x: p.x, z: p.z, y: groundY + 2, vx, vz, owner: p, life: 1.5, mesh });
    audio.laser(false, 0.5);
  }

  _stepShots(dt) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= dt;
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      if (s.x > ARENA) s.x -= ARENA * 2;
      if (s.x < -ARENA) s.x += ARENA * 2;
      if (s.z > ARENA) s.z -= ARENA * 2;
      if (s.z < -ARENA) s.z += ARENA * 2;
      s.mesh.position.set(s.x, s.y, s.z);

      let dead = s.life <= 0;
      // walls eat shots that fly low; launched shots clear the slabs
      for (const o of this.walls) {
        const r = (o.r || 20) + 3;
        if ((s.x - o.x) ** 2 + (s.z - o.z) ** 2 < r * r && s.y < (o.h || 40)) {
          this._spawnBurst(s.x, s.y, s.z, 0xff5f8f, 0.4);
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const q of this.pilots) {
          if (q === s.owner || !q.alive || q.invuln > 0 || q.respawn > 0) continue;
          if ((s.x - q.x) ** 2 + (s.z - q.z) ** 2 < 12 ** 2) {
            this._hit(q, s.owner);
            dead = true;
            break;
          }
        }
      }
      if (dead) {
        s.mesh.visible = false;
        this.shots.splice(i, 1);
      }
    }
  }

  _hit(victim, shooter) {
    this._spawnBurst(victim.x, victim.y + 6, victim.z, victim.color, 0.8);
    audio.hit();
    if (this.match.mode === 'harvest') {
      // the harvest has no final answer — knocked pilots sit out a moment
      // and scatter crystals where they fell
      if (victim.score > 0) {
        victim.score = Math.max(0, victim.score - 2);
        this._placeCrystalAt(victim.x, victim.z);
        this._placeCrystalAt(victim.x, victim.z);
      }
      victim.respawn = 3;
      victim.invuln = 1.5;
      victim.group.visible = false;
      return;
    }
    victim.lives -= 1;
    if (victim.lives <= 0) {
      victim.alive = false;
      victim.group.visible = false;
      if (!victim.isPlayer) {
        shooter.elims += 1;
        // last rival down — the field is ours
        if (!this.pilots.some((q) => !q.isPlayer && q.alive)) {
          this._place = 1;
          this.match.over = true;
          this._finishMatch();
          return;
        }
      }
      if (victim.isPlayer) {
        this._place = 1 + this.pilots.filter((q) => !q.isPlayer && !q.alive).length;
        this.match.over = true;
        this._finishMatch();
      }
    } else {
      victim.respawn = 2.5;
      victim.invuln = 1.8;
      victim.group.visible = false;
    }
  }

  _respawn(p) {
    let x = 0;
    let z = 0;
    for (let tries = 0; tries < 60; tries++) {
      x = this.rng.float(0, 1) * ARENA * 1.4 - ARENA * 0.7;
      z = this.rng.float(0, 1) * ARENA * 1.4 - ARENA * 0.7;
      const crowded = this.pilots.some((q) => q.alive && q !== p && Math.hypot(q.x - x, q.z - z) < 130);
      if (!crowded) break;
    }
    p.x = x;
    p.z = z;
    p.y = 0;
    p.vy = 0;
    p.heading = this.rng.float(0, 1) * Math.PI * 2;
    p.speed = 0;
    p.group.visible = true;
  }

  _updateCrystals(dt) {
    if (this.match.mode !== 'harvest') return;
    for (const c of this.crystals) {
      c.phase += dt;
      if (c.group.visible) {
        c.group.position.set(c.x, this.groundAt(c.x, c.z) + 10 + Math.sin(c.phase * 2.4) * 3, c.z);
        c.group.rotation.y += dt * 1.4;
      }
      if (!c.alive) continue;
      for (const p of this.pilots) {
        if (!p.alive || p.respawn > 0) continue;
        if ((p.x - c.x) ** 2 + (p.z - c.z) ** 2 < 16 ** 2) {
          c.alive = false;
          c.group.visible = false;
          p.score += 1;
          this._spawnBurst(c.x, 8, c.z, CRYSTAL_COLOR, 0.5);
          audio.coin();
          break;
        }
      }
    }
    const empty = this.crystals.filter((c) => !c.alive).length;
    for (let i = 0; i < empty; i++) {
      const c = this.crystals.find((cc) => !cc.alive);
      if (!c) break;
      c.x = this.rng.float(0, 1) * ARENA * 1.7 - ARENA * 0.85;
      c.z = this.rng.float(0, 1) * ARENA * 1.7 - ARENA * 0.85;
      c.alive = true;
      c.group.visible = true;
    }
  }

  _placeCrystalAt(x, z) {
    const c = this.crystals.find((cc) => !cc.alive);
    if (!c) return;
    c.x = clamp(x + this.rng.float(-1, 1) * 30, -ARENA + 10, ARENA - 10);
    c.z = clamp(z + this.rng.float(-1, 1) * 30, -ARENA + 10, ARENA - 10);
    c.alive = true;
    c.group.visible = true;
  }

  _stepBursts(dt) {
    for (const b of this.burstPool) {
      if (b.t <= 0) continue;
      b.t -= dt;
      b.spr.position.x += b.vx * dt;
      b.spr.position.z += b.vz * dt;
      const k = Math.max(0, b.t / b.max);
      b.spr.material.opacity = 0.9 * k;
      b.spr.scale.setScalar(30 * (1.4 - k * 0.6));
      if (b.t <= 0) b.spr.visible = false;
    }
  }

  _updateHud() {
    const m = this.match;
    const p = this.pilots[0];
    this._hudScore.textContent = `SCORE ${p.score}`;
    if (m.mode === 'duel') {
      const left = this.pilots.filter((q) => q.alive).length;
      this._hudLives.textContent = `LIVES ${p.lives} · PILOTS ${left}`;
      this._hudClock.textContent = '';
    } else {
      this._hudLives.textContent = p.respawn > 0 ? 'IN THE PIT' : '';
      this._hudClock.textContent = `TIME ${Math.ceil(m.time)}`;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Results                                                            */
  /* ------------------------------------------------------------------ */

  _finishMatch() {
    const m = this.match;
    if (m.finished) return;
    m.finished = true;
    m.over = true;
    const p = this.pilots[0];
    const place = m.mode === 'duel' ? this._place : this._harvestPlace();
    const score = m.mode === 'duel' ? p.elims : p.score;
    const { payout, xp } = this._payout(m.mode, place, score, m.forfeit);
    const result = { mode: m.mode, place, score, payout, xp, forfeit: !!m.forfeit, note: '' };
    result.note = m.forfeit
      ? 'You stepped out before the field was settled. The circuit pays nothing for a walk.'
      : m.mode === 'duel'
        ? `Eliminations: ${p.elims}. ${place === 1 ? 'Both rivals down — the purse is yours.' : 'The field keeps flying without you.'}`
        : `${p.score} crystal${p.score === 1 ? '' : 's'} hauled. ${place === 1 ? 'The clock agrees: yours.' : 'Someone else read the field better.'}`;
    this._showResults(result);
    this.onFinish?.(result);
  }

  _harvestPlace() {
    const sorted = [...this.pilots].sort((a, b) => b.score - a.score || b.elims - a.elims);
    return sorted.indexOf(this.pilots[0]) + 1;
  }

  _payout(mode, place, score, forfeit) {
    if (forfeit) return { payout: 0, xp: 0 };
    if (mode === 'duel') {
      const credits = Math.round((place === 1 ? 1200 : 250) + score * 450);
      return { payout: Math.min(4000, credits), xp: Math.min(250, 30 + score * 50) };
    }
    const credits = Math.round(250 + score * 120 + (place === 1 ? 900 : 0));
    return { payout: Math.min(3500, credits), xp: Math.min(250, 20 + score * 25) };
  }

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */

  _render(dt) {
    if (this.match && !this.match.over) {
      const p = this.pilots[0];
      if (p) {
        const bx = Math.sin(p.heading + Math.PI);
        const bz = Math.cos(p.heading + Math.PI);
        const tx = p.x + bx * 78;
        const ty = this.groundAt(p.x, p.z) + p.y + 52;
        const tz = p.z + bz * 78;
        const k = 1 - Math.pow(0.0025, dt);
        this.camera.position.x += (tx - this.camera.position.x) * k;
        this.camera.position.y += (ty - this.camera.position.y) * k;
        this.camera.position.z += (tz - this.camera.position.z) * k;
        this.camera.lookAt(p.x + Math.sin(p.heading) * 44, this.groundAt(p.x, p.z) + p.y + 10, p.z + Math.cos(p.heading) * 44);
      }
    } else {
      // between matches the rig shows the whole field, slow and stately
      const a = this.t * 0.12;
      this.camera.position.set(Math.sin(a) * 620, 260, Math.cos(a) * 620);
      this.camera.lookAt(0, 0, 0);
    }
    this.renderer.render(this.scene, this.camera);
  }
}
