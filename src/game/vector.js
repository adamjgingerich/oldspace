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
// The field is a planet. Not a plate with a horizon painted on it — a whole
// orb: hulls sit on the surface, nose along a great circle, and fly right
// around it. There is no edge, so there is nothing to wrap and nowhere to
// hide behind. The orb varies with the bracket: a wide one gives the long
// game room to breathe, a tight one turns every pass into a knife fight with
// the horizon in the way.
//
// The field fights modern: hills the hulls ride over, straight walls that
// stop shots and bounce hulls, launch ramps that throw you clean over the
// walls when you cross them fast — and item pads, the circuit's one mercy.
// A pad hands out a burst of drive, a rapid-fire rig or a shield, and the
// other pilots take them too. Weapons are the ones in your bay: the sim reads
// your mounts and flies them, and fits its own pilots to match the bracket.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { buildShip } from '../core/meshes.js';
import { glowSprite } from '../core/fx.js';
import { SHIP_BY_ID, SHIPS } from '../data/ships.js';
import { WEAPON_BY_ID } from '../data/weapons.js';
import { computeStats } from './state.js';
import { playerTier } from './missions.js';
import { audio } from '../core/audio.js';
import { rngOf } from '../core/rng.js';
import { clamp } from '../core/util.js';
import { el, btn, clear } from '../ui/dom.js';

const SCALE = 460;            // the orb every count on the field is tuned against
// The circuit's orbs, widest first. Bracket intensity picks one: the tighter
// the orb, the more of the field is in someone's way.
const ORBS = [
  { name: 'THE PLAIN', r: 820, note: 'a wide one — long runs, clear shots' },
  { name: 'BASIN', r: 700, note: 'steady ground and room to turn' },
  { name: 'MARBLE', r: 580, note: 'no long shots left on this one' },
  { name: 'PEBBLE', r: 460, note: 'tight — the horizon is always in the way' },
];
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

// The rig's own drawer of guns, bracket by bracket. Every one of them is a real
// weapon off the same charts the shipyards use, so a bracket-four rival is
// carrying something you could bolt to your own wing.
const AI_WEAPONS = [
  ['needler', 'flechette', 'pulse'],
  ['pulse', 'twinpulse', 'ripper', 'dart', 'snare'],
  ['sunbeam', 'flenser', 'carver', 'harpoon', 'ion'],
  ['gauss', 'hellbore', 'torpedo', 'spike', 'breach'],
];
const HULL = 100;      // what everyone flies in with
const SIM_DMG = 0.85;  // the charts are balanced for shield-and-hull fights

// a shot looks like what it is
const SHOT_COLOR = {
  laser: 0x9fffcf, kinetic: 0xffe0a8, beam: 0x8fd0ff, missile: 0xff9a6b, disruptor: 0xc792ff,
};
// beams have no muzzle speed of their own — they are a ray, so the sim flies
// them fast and thin instead
const BEAM_SPEED = 1150;

/**
 * A weapon as the sim flies it. Same damage, same cadence, same reach as the
 * real thing; the only translation is that a wireframe hull has 100 points of
 * structure and a real one has shields.
 */
function simWeapon(def) {
  const beam = def.kind === 'beam';
  const speed = def.speed || BEAM_SPEED;
  return {
    id: def.id,
    name: def.name,
    kind: def.kind,
    dmg: (def.dmg || 6) * SIM_DMG,
    speed,
    cd: Math.max(0.08, def.cooldown || 0.3),
    range: def.range || 700,
    life: (def.range || 700) / speed,
    spread: beam ? 0 : (def.spread || 0),
    turn: def.turn || 0,
    // the gun's own colour off the chart, so a rack of mixed weapons reads as
    // a rack of mixed weapons
    color: def.color || SHOT_COLOR[def.kind] || 0x9fffcf,
  };
}

const roundAng = (a) => {  let b = a;
  while (b > Math.PI) b -= Math.PI * 2;
  while (b < -Math.PI) b += Math.PI * 2;
  return b;
};

/**
 * The sim's ground: a wire globe rather than a wire square. Latitude rings and
 * meridians, drawn as plain line segments so the orb reads as a sphere from any
 * angle — which is the whole point of flying one.
 */
function orbGrid(radius, rings, meridians, segs) {
  const pts = [];
  const seg = (x0, y0, z0, x1, y1, z1) => {
    pts.push(x0, y0, z0, x1, y1, z1);
  };
  // latitude rings
  for (let i = 1; i < rings; i++) {
    const lat = (i / rings) * Math.PI - Math.PI / 2;
    const c = Math.cos(lat) * radius;
    const y = Math.sin(lat) * radius;
    for (let j = 0; j < segs; j++) {
      const t0 = (j / segs) * Math.PI * 2;
      const t1 = ((j + 1) / segs) * Math.PI * 2;
      seg(Math.cos(t0) * c, y, Math.sin(t0) * c, Math.cos(t1) * c, y, Math.sin(t1) * c);
    }
  }
  // meridians
  for (let i = 0; i < meridians; i++) {
    const t = (i / meridians) * Math.PI;
    const ct = Math.cos(t);
    const st = Math.sin(t);
    for (let j = 0; j < segs; j++) {
      const p0 = (j / segs) * Math.PI * 2;
      const p1 = ((j + 1) / segs) * Math.PI * 2;
      seg(Math.sin(p0) * ct * radius, Math.cos(p0) * radius, Math.sin(p0) * st * radius,
        Math.sin(p1) * ct * radius, Math.cos(p1) * radius, Math.sin(p1) * st * radius);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
  return geo;
}

/** The bracket the rig will run for this commander, unless one is given. */
export function challengeTier(state, intensity = null) {
  return clamp(Math.round(intensity ?? playerTier(state)), 1, 8);
}

/** Which orb a bracket is flown on: the sharper the board, the tighter the rock. */
export function orbForTier(tier) {
  const t = clamp(Math.round(tier || 1), 1, 8);
  return ORBS[clamp(Math.floor((t - 1) / 2), 0, ORBS.length - 1)];
}

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
  constructor({ host, state, autoMode = null, intensity = null, onFinish = null, onQuit = null }) {
    this.host = host;
    this.state = state;
    this.onFinish = onFinish;
    this.onQuit = onQuit;
    this.rec = state.vector || { played: 0, wins: 0, best: 0, champion: null };

    this.rng = rngOf(state.worldSeed, 'vector', Date.now() % 100000);
    this.shipId = state.shipId || 'wayfarer';
    this.commander = state.commander || 'Commander';
    this.shipName = state.shipName || SHIP_BY_ID[this.shipId]?.name || 'Cutter';

    // The bracket the rig will run. A commander who has grown into harder
    // boards gets a harder sim — which on this circuit means a smaller orb to
    // do it on, and pilots who have grown into better guns.
    this.tier = challengeTier(state, intensity);
    this.orb = orbForTier(this.tier);
    this.orbR = this.orb.r;
    // how much furniture the field carries, relative to the tuned-up orb
    this.density = this.orbR / SCALE;

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
          el('span', { class: 'vs-label', text: 'The orb' }),
          el('span', { class: 'vs-value', text: `${this.orb.name} · bracket ${this.tier}` }),
          el('span', { class: 'vs-note', text: this.orb.note }),
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
        'The field is an orb — fly far enough and you come back to where you started, so there is no edge to fall off and nowhere to run. ',
        'It carries hills, walls and launch ramps; cross a ramp fast and the field throws you over the walls. ',
        'Item pads hand out drive bursts, rapid fire and shields. ',
        'You fly the fit in your bay, mount for mount, and the bracket fits its own pilots to match.',
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
      el('h2', { text: result.forfeit ? 'You stepped out' : result.place === 1 ? 'The field is yours' : `You took ${place}` }),
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
          el('span', { class: 'vs-note', text: result.forfeit ? 'the circuit pays nothing for a walk' : result.place === 1 ? 'the meetup marks the win' : 'the desk pays consolation' }),
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
    this.camera = new THREE.PerspectiveCamera(60, 1, 1, 12000);
    this.camera.position.set(0, 60, -140);
    this.camera.up.set(0, 1, 0);

    // stars all around — the sim never lets you forget it is night
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(420 * 3);
    for (let i = 0; i < 420; i++) {
      const a = this.rng.float(0, 1) * Math.PI * 2;
      const y = this.rng.float(-1, 1);
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const d = 3000 + this.rng.float(0, 1) * 2600;
      starPos[i * 3] = Math.cos(a) * r * d;
      starPos[i * 3 + 1] = y * d;
      starPos[i * 3 + 2] = Math.sin(a) * r * d;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0x3a5f8a, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0.8,
    })));

    // the orb itself: a smooth shell, with the sim's wire globe drawn over it
    this.orbGroup = new THREE.Group();
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(this.orbR, 128, 64),
      new THREE.MeshBasicMaterial({ color: 0x061310, transparent: true, opacity: 0.92 }),
    );
    this.orbGroup.add(shell);
    this.orbGroup.add(new THREE.LineSegments(
      orbGrid(this.orbR * 1.0008, 18, 12, 96),
      new THREE.LineBasicMaterial({ color: 0x1c6b46, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending }),
    ));
    this.scene.add(this.orbGroup);

    // shot pool: one mesh per shot, reused forever. Geometry is swapped for
    // the loosed weapon's own shape — a railgun slug is not a missile.
    this.shotGeos = {
      laser: new THREE.BoxGeometry(1.6, 1.6, 5),
      kinetic: new THREE.BoxGeometry(2.2, 2.2, 4),
      beam: new THREE.BoxGeometry(1.1, 1.1, 16),
      missile: new THREE.OctahedronGeometry(2.4),
      disruptor: new THREE.TetrahedronGeometry(2.6),
    };
    this.shotPool = [];
    for (let i = 0; i < 64; i++) {
      const mesh = new THREE.Mesh(this.shotGeos.laser, new THREE.MeshBasicMaterial({
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
      this.burstPool.push({ spr, t: 0, vx: 0, vy: 0, vz: 0, max: 0.5 });
    }
  }

  _spawnBurst(u, height, color, size = 1) {
    const b = this.burstPool.find((p) => p.t <= 0) || this.burstPool[0];
    b.t = 0.45;
    b.max = 0.45;
    b.spr.material.color.setHex(color);
    b.spr.material.opacity = 0.9;
    b.spr.visible = true;
    this._pointAt(u, height, this._w1);
    b.spr.position.copy(this._w1);
    b.spr.scale.setScalar(26 * size);
    audio.boom(0.35 * size);
  }

  /* ------------------------------------------------------------------ */
  /* The orb                                                            */
  /* ------------------------------------------------------------------ */

  // Scratch vectors for the per-frame sphere maths. Anything that hands a
  // result back to a caller uses one of the four outer slots so an inner
  // helper can never stomp the value it is about to return.
  _s1 = new THREE.Vector3();
  _s2 = new THREE.Vector3();
  _s3 = new THREE.Vector3();
  _s4 = new THREE.Vector3();
  _w1 = new THREE.Vector3();
  _w2 = new THREE.Vector3();
  _w3 = new THREE.Vector3();
  _w4 = new THREE.Vector3();
  _w5 = new THREE.Vector3();
  _p2 = new THREE.Vector2();
  _q1 = new THREE.Quaternion();
  _q2 = new THREE.Quaternion();
  _mat = new THREE.Matrix4();
  _col = new THREE.Color();
  _col2 = new THREE.Color();

  /** A random direction — a random point on the orb. */
  _scatter(out) {
    const y = this.rng.float(-1, 1);
    const a = this.rng.float(0, 1) * Math.PI * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    return out.set(Math.cos(a) * r, y, Math.sin(a) * r);
  }

  /** How far apart two directions are, along the surface. */
  _arc(a, b) {
    return this.orbR * Math.acos(clamp(a.dot(b), -1, 1));
  }

  /**
   * Walk a hull `dist` along the surface: rotate its up and its heading about
   * the axis running across both. That is a great circle, so a hull that keeps
   * flying straight comes back to where it started.
   */
  _advance(u, fwd, dist) {
    if (!dist) return;
    const axis = this._s1.crossVectors(u, fwd);
    if (axis.lengthSq() < 1e-9) return;
    axis.normalize();
    this._q1.setFromAxisAngle(axis, dist / this.orbR);
    u.applyQuaternion(this._q1);
    fwd.applyQuaternion(this._q1);
  }

  /** Turn a heading about the local up. Port is positive — the way the helm reads. */
  _turn(fwd, u, angle) {
    if (angle) fwd.applyAxisAngle(u, angle);
  }

  /**
   * Where something sits relative to a hull's nose: 0 dead ahead, positive to
   * port, in radians. This is the sim's version of the lanes' heading maths.
   */
  _bearing(u, fwd, target) {
    const rel = this._s2.copy(target).addScaledVector(u, -target.dot(u));
    if (rel.lengthSq() < 1e-12) return 0;
    this._s3.crossVectors(u, fwd); // the port-side tangent
    return Math.atan2(rel.dot(this._s3), rel.dot(fwd));
  }

  /** A heading `angle` to port of the current one. */
  _headingAt(u, fwd, angle, out) {
    return out.copy(fwd).applyAxisAngle(u, angle).normalize();
  }

  /** Some heading at `u`, picked at random. */
  _randomHeading(u, out) {
    this._scatter(this._s4);
    out.copy(this._s4).addScaledVector(u, -this._s4.dot(u));
    if (out.lengthSq() < 1e-9) out.copy(this._s3.crossVectors(u, this._s4.set(0, 1, 0)));
    return out.normalize();
  }

  /** A direction `dist` ahead of a hull — where its nose is pointing. */
  _ahead(u, fwd, dist, out) {
    const axis = this._s1.crossVectors(u, fwd);
    if (axis.lengthSq() < 1e-9) return out.copy(u);
    axis.normalize();
    return out.copy(u).applyAxisAngle(axis, dist / this.orbR);
  }

  /** Point an object's nose along a heading, its roof on the local vertical. */
  _seatDir(obj, u, fwd) {
    const z = this._w4.copy(fwd).normalize();
    const y = this._w5.copy(u);
    const x = this._s1.crossVectors(y, z).normalize();
    obj.quaternion.setFromRotationMatrix(this._mat.makeBasis(x, y, z));
  }

  /** Where something standing `height` above the surface sits in the world. */
  _pointAt(u, height, out) {
    return out.copy(u).multiplyScalar(this.orbR + height);
  }

  /**
   * A barrier's own tangent frame, and the point on the orb it stands on. The
   * local 2D maths the field has always used runs in here, so a slab is still
   * a rectangle — it just lives on a curved world.
   */
  _frameAt(u, roll = 0, t1 = new THREE.Vector3(), t2 = new THREE.Vector3()) {
    // any tangent will do to start, then roll the pair around the up
    t1.set(0, 1, 0);
    if (Math.abs(u.y) > 0.9) t1.set(1, 0, 0);
    t2.crossVectors(u, t1).normalize();
    t1.crossVectors(t2, u).normalize();
    if (roll) {
      t1.applyAxisAngle(u, roll).normalize();
      t2.crossVectors(u, t1).normalize();
    }
    return [t1, t2];
  }

  /** World-space 2D coordinates of `u` inside a barrier's frame, in orb units. */
  _localTo(frame, u, out) {
    const rel = this._s4.copy(u).addScaledVector(frame.u, -u.dot(frame.u));
    return out.set(rel.dot(frame.t1) * this.orbR, rel.dot(frame.t2) * this.orbR);
  }

  /** The tangent heading that points from a barrier's frame back at the world. */
  _frameDir(frame, lx, lz, out) {
    return out.copy(frame.t1).multiplyScalar(lx).addScaledVector(frame.t2, lz).normalize();
  }

  /* ------------------------------------------------------------------ */
  /* Terrain                                                            */
  /* ------------------------------------------------------------------ */

  /** Height of the field under a direction on the orb. Hulls hover six above it. */
  groundAt(u) {
    const l = this._p2;
    let h = 0;
    for (const b of this.mounds) {
      this._localTo(b, u, l);
      const d2 = l.x * l.x + l.y * l.y;
      if (d2 < b.r2) h += b.h * Math.exp(-d2 / b.r2);
    }
    for (const r of this.ramps) {
      this._localTo(r, u, l);
      if (l.x > -r.l && l.x < r.l && l.y > -r.w && l.y < r.w) {
        h += r.rise * clamp((l.x + r.l) / (r.l * 2), 0, 1); // 0 → 1 along the ramp
      }
    }
    return h;
  }

  /** A launch the pilot can take right now — 0 when there is no ramp here. */
  launchAt(u, speed) {
    const l = this._p2;
    for (const r of this.ramps) {
      this._localTo(r, u, l);
      if (l.x > -r.l && l.x < r.l && l.y > -r.w && l.y < r.w && speed > r.minSpeed) {
        return r.vy;
      }
    }
    return 0;
  }

  /**
   * Stand an object on the orb at a direction, local +Y outward and (when the
   * object cares) local +X along `t1`.
   */
  _seat(obj, u, t1 = null) {
    obj.position.copy(u).multiplyScalar(this.orbR);
    const x = t1 ? t1.clone().normalize() : this._frameAt(u)[0];
    const y = u.clone();
    const z = new THREE.Vector3().crossVectors(x, y).normalize();
    const x2 = new THREE.Vector3().crossVectors(y, z).normalize();
    obj.quaternion.setFromRotationMatrix(this._mat.makeBasis(x2, y, z));
  }

  /** The field: hills, straight walls, pyramids and launch ramps, all on the orb. */
  _buildTerrain() {
    this.terrain = [];
    this.walls = [];
    this.mounds = [];
    this.ramps = [];
    const add = (obj) => { this.scene.add(obj); this.terrain.push(obj); };

    // Counts follow the orb: a wide one carries more of everything, a pebble
    // keeps only what it needs — which is what makes it a pebble.
    const n = (base, min) => Math.max(min, Math.round(base * this.density));
    // Nothing lands on top of anything else; this field is meant to be flown.
    const taken = [];
    const spot = (minArc) => {
      const u = new THREE.Vector3();
      for (let i = 0; i < 240; i++) {
        this._scatter(u);
        if (taken.every((q) => this._arc(u, q) > minArc)) { taken.push(u.clone()); return u; }
      }
      return u;
    };

    // pyramids — solid walls now, the way the old field always wanted
    const pyGeo = new THREE.ConeGeometry(16, 30, 4);
    const pyEdges = new THREE.EdgesGeometry(pyGeo, 30);
    const pyFill = new THREE.MeshBasicMaterial({ color: 0x0a1420, transparent: true, opacity: 0.6, depthWrite: false });
    const pyWire = new THREE.LineBasicMaterial({ color: 0xff5f8f, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending });
    for (let i = 0, cnt = n(9, 5); i < cnt; i++) {
      const u = spot(150);
      const [t1, t2] = this._frameAt(u, this.rng.float(0, 1) * Math.PI);
      const g = new THREE.Group();
      const m = new THREE.Mesh(pyGeo, pyFill);
      m.add(new THREE.LineSegments(pyEdges, pyWire));
      m.position.y = 15;
      g.add(m);
      this._seat(g, u, t1);
      add(g);
      this.walls.push({ u, t1, t2, r: 20, h: 30 });
    }

    // straight wall slabs — the shots die on them and hulls bounce off
    const barGeo = new THREE.BoxGeometry(80, 22, 10);
    const barEdges = new THREE.EdgesGeometry(barGeo);
    const barFill = new THREE.MeshBasicMaterial({ color: 0x0d1622, transparent: true, opacity: 0.7, depthWrite: false });
    const barWire = new THREE.LineBasicMaterial({ color: 0xffb45c, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
    for (let i = 0, cnt = n(4, 3); i < cnt; i++) {
      const u = spot(190);
      const [t1, t2] = this._frameAt(u, this.rng.float(0, 1) * Math.PI);
      const m = new THREE.Mesh(barGeo, barFill);
      m.add(new THREE.LineSegments(barEdges, barWire));
      m.position.y = 11;
      this._seat(m, u, t1);
      add(m);
      this.walls.push({ u, t1, t2, hw: 40, hd: 5, h: 22 });
    }

    // hills — soft elevation the ships ride over
    const moundGeo = new THREE.ConeGeometry(70, 30, 6);
    const moundEdges = new THREE.EdgesGeometry(moundGeo, 40);
    const moundFill = new THREE.MeshBasicMaterial({ color: 0x08131c, transparent: true, opacity: 0.65, depthWrite: false });
    const moundWire = new THREE.LineBasicMaterial({ color: 0x2c6f8f, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
    for (let i = 0, cnt = n(3, 2); i < cnt; i++) {
      const u = spot(170);
      const [t1, t2] = this._frameAt(u, this.rng.float(0, 1) * Math.PI);
      const m = new THREE.Mesh(moundGeo, moundFill);
      m.add(new THREE.LineSegments(moundEdges, moundWire));
      m.position.y = 15;
      this._seat(m, u, t1);
      add(m);
      this.mounds.push({ u, t1, t2, h: 18, r2: 72 * 72 });
    }

    // launch ramps — cross them fast and the field throws you over the walls
    const rampGeo = new THREE.BoxGeometry(80, 4, 16);
    const rampEdges = new THREE.EdgesGeometry(rampGeo);
    const rampFill = new THREE.MeshBasicMaterial({ color: 0x12201a, transparent: true, opacity: 0.75, depthWrite: false });
    const rampWire = new THREE.LineBasicMaterial({ color: 0x7dffa8, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 2; i++) {
      const u = spot(260);
      const [t1, t2] = this._frameAt(u, this.rng.float(0, 1) * Math.PI);
      const m = new THREE.Mesh(rampGeo, rampFill);
      m.add(new THREE.LineSegments(rampEdges, rampWire));
      m.position.y = 10;
      this._seat(m, u, t1);
      add(m);
      this.ramps.push({ u, t1, t2, l: 40, w: 8, rise: 26, minSpeed: 150, vy: 215 });
    }
  }

  /** True when a hull of radius `r` standing here touches no barrier at all. */
  _clearOfWalls(u, r) {
    const l = this._p2;
    for (const w of this.walls) {
      this._localTo(w, u, l);
      if (w.hw) {
        const ox = Math.max(Math.abs(l.x) - w.hw, 0);
        const oy = Math.max(Math.abs(l.y) - w.hd, 0);
        if (ox * ox + oy * oy < r * r) return false;
      } else if (l.length() < (w.r || 20) + r) {
        return false;
      }
    }
    return true;
  }

  /**
   * Solid geometry, resolved as a bounce with slide.
   *
   * The hull is lifted clear of the face, then only the part of its motion
   * heading into the wall is turned back out of it — whatever it had along the
   * face is kept, so a pilot grazing a barrier slides down it and carries on
   * instead of grinding to a halt. Two things matter for never getting stuck:
   * a ship whose centre has ended up *inside* a slab is still pushed out (via
   * whichever face is nearest), and speed is never simply zeroed on contact.
   *
   * The maths is the flat field's, run in each barrier's own tangent frame:
   * a slab is still a rectangle with a length and a depth, it just has both of
   * them on the surface of a world with an opinion about the horizon.
   */
  _collideWalls(p) {
    const R = p.collideR || 14;
    const SKIN = 3;    // daylight left behind, so contact cannot repeat every frame
    const REST = 0.35; // how hard the hull comes back off a face
    const SCRUB = 0.9; // scrape tax, charged once per impact
    const FRESH = 0.25; // a hit within this long of the last one is a lean, not a bang

    const vel = this._s1.copy(p.fwd).multiplyScalar(p.speed);
    const l = this._p2;
    let bounced = false;

    // walk the hull clear along a world tangent, and its heading with it, so
    // the pair never drift apart on the curved surface
    const shift = (nu, depth) => {
      this._s3.copy(nu).addScaledVector(p.u, -nu.dot(p.u));
      const axis = this._s4.crossVectors(p.u, this._s3);
      if (axis.lengthSq() < 1e-9) return;
      axis.normalize();
      this._q1.setFromAxisAngle(axis, (depth + SKIN) / this.orbR);
      p.u.applyQuaternion(this._q1);
      p.fwd.applyQuaternion(this._q1);
    };

    const push = (w, nx, nz, depth, hint) => {
      // the face normal and the slide direction, both in the barrier's frame
      const t1 = w.t1;
      const t2 = w.t2;
      let vx = vel.dot(t1);
      let vz = vel.dot(t2);
      const into = vx * nx + vz * nz;
      const tx = -nz;
      const tz = nx;
      const vt = vx * tx + vz * tz;
      const mag = Math.hypot(vx, vz);
      if (into < 0) {
        // An inward motion with nothing across the face has no side to slide
        // to, so the caller's hint picks one.
        const side = Math.abs(vt) > mag * 0.15 ? Math.sign(vt) : (hint || 1);
        if (this.t - (p.wallT ?? -99) < FRESH) {
          // still leaning on a surface: turn the whole of the hull's momentum
          // along the face. Holding the nose into a wall slides the ship down
          // it at the speed it arrived with, instead of bouncing it back and
          // forth until its speed has bled away.
          vx = tx * side * mag;
          vz = tz * side * mag;
        } else {
          // a fresh impact: kick off the face, keeping whatever ran along it
          vx = (tx * vt - nx * into * REST) * SCRUB;
          vz = (tz * vt - nz * into * REST) * SCRUB;
        }
        vel.copy(t1).multiplyScalar(vx).addScaledVector(t2, vz);
        bounced = true;
      }
      p.wallT = this.t;
      this._frameDir(w, nx, nz, this._s3);
      shift(this._s3, depth);
    };

    // two passes, so a hull wedged between two faces is freed by the second
    for (let pass = 0; pass < 2; pass++) {
      for (const w of this.walls) {
        this._localTo(w, p.u, l);
        if (w.hw) {
          const ex = w.hw + R;
          const ez = w.hd + R;
          if (Math.abs(l.x) < ex && Math.abs(l.y) < ez) {
            // inside the inflated slab: leave by the nearest face
            const penX = ex - Math.abs(l.x);
            const penZ = ez - Math.abs(l.y);
            let nx = 0;
            let nz = 0;
            let depth;
            if (penX < penZ) { nx = l.x < 0 ? -1 : 1; depth = penX; } else { nz = l.y < 0 ? -1 : 1; depth = penZ; }
            // along the length of the slab, out the nearer end — the short way
            // off a barrier, rather than scraping its whole eighty units
            const hint = penX < penZ ? (p.strafeDir || 1) : (l.x > 0 ? -1 : 1);
            push(w, nx, nz, depth, hint);
          }
          continue;
        }
        // pyramids and anything else round
        const rr = (w.r || 20) + R;
        const d = l.length();
        if (d < rr) {
          // dead centre has no direction of its own, so pick one
          const nx = d > 0.0001 ? l.x / d : 1;
          const nz = d > 0.0001 ? l.y / d : 0;
          push(w, nx, nz, rr - d, p.strafeDir || 1);
        }
      }
    }

    if (bounced) {
      const mag = vel.length();
      if (mag > 0.001) {
        p.fwd.copy(vel);
        // the bounce is expressed in a barrier's frame, so put the heading
        // back exactly on the hull's own tangent before flying it
        p.fwd.addScaledVector(p.u, -p.fwd.dot(p.u));
        if (p.fwd.lengthSq() > 1e-9) p.fwd.normalize();
        p.speed = clamp(mag, 0, 250);
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
    for (let i = 0, pads = Math.max(3, Math.round(4 * this.density)); i < pads; i++) {
      const u = new THREE.Vector3();
      this._scatter(u);
      const [t1, t2] = this._frameAt(u, this.rng.float(0, 1) * Math.PI);
      const g = new THREE.Group();
      const m = new THREE.Mesh(padGeo, padFill);
      m.add(new THREE.LineSegments(padEdges, padWire));
      g.add(m);
      this._seat(g, u, t1);
      this.scene.add(g);
      this.terrain.push(g);
      this.pickups.push({ u, t1, t2, group: g, mesh: m, alive: true, respawn: 0, kind: PICKUP_KINDS[i % PICKUP_KINDS.length], phase: i * 1.7 });
    }
  }

  /** Stand a pad back on the surface at a fresh spot. */
  _movePad(pad) {
    this._scatter(pad.u);
    const [t1, t2] = this._frameAt(pad.u, this.rng.float(0, 1) * Math.PI);
    pad.t1 = t1;
    pad.t2 = t2;
    pad.group.position.copy(pad.u).multiplyScalar(this.orbR);
    pad.kind = this.rng.pick(PICKUP_KINDS);
  }

  _grabPickup(p, pad) {
    pad.alive = false;
    pad.group.visible = false;
    pad.respawn = 12;
    this._spawnBurst(pad.u, 12, PICKUP_COLORS[pad.kind], 0.7);
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
          this._movePad(pad);
          pad.alive = true;
          pad.group.visible = true;
        }
        continue;
      }
      const h = this.groundAt(pad.u) + 12 + Math.sin(pad.phase * 2.6) * 3;
      this._pointAt(pad.u, h, this._w1);
      pad.group.position.copy(this._w1);
      pad.mesh.rotation.y += dt * 1.8;
      if (!pad.alive) continue;
      for (const p of this.pilots) {
        if (!p.alive || p.respawn > 0) continue;
        if (this._arc(p.u, pad.u) < 16) {
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

  /**
   * The guns a pilot flies with. The commander's are read straight off the
   * registry — the sim fires the fit in the bay, mount for mount — while the
   * rig fits its own pilots out of the bracket's drawer, so a hard board runs
   * into guns to match the ones it has grown used to.
   */
  _mountsFor(isPlayer, def) {
    const list = [];
    if (isPlayer) {
      const cap = Math.max(1, computeStats(this.state).mounts || 1);
      const fitted = this.state.weapons || def.defaultWeapons || [];
      for (let i = 0; i < cap; i++) {
        const w = WEAPON_BY_ID[fitted[i]];
        if (w) list.push(simWeapon(w));
      }
    } else {
      const bracket = AI_WEAPONS[clamp(Math.floor((this.tier - 1) / 2), 0, AI_WEAPONS.length - 1)];
      const mounts = this.tier <= 2 ? 1 : 2;
      for (let i = 0; i < mounts; i++) {
        const w = WEAPON_BY_ID[this.rng.pick(bracket)];
        if (w) list.push(simWeapon(w));
      }
    }
    return list.length ? list : [simWeapon(WEAPON_BY_ID.pulse)];
  }

  _makePilot(i, isPlayer) {
    const def = SHIP_BY_ID[this._pilotShipId(i)] || SHIP_BY_ID.wayfarer;
    const color = isPlayer ? PLAYER_COLOR : AI_COLORS[(i - 1) % AI_COLORS.length];
    // the sim reads your registry: your hull, your guns, your rigging
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
    // how much room the hull needs beside a wall, so it is pushed clear of the
    // face rather than parked inside it
    const collideR = Math.max(14, (def.radius ?? def.len * 0.5) * s);
    this.scene.add(group);

    const shieldGlow = glowSprite(0x9fd8ff, 30);
    shieldGlow.visible = false;
    group.add(shieldGlow);

    const mounts = this._mountsFor(isPlayer, def);
    const u = new THREE.Vector3();
    for (let tries = 0; tries < 60; tries++) {
      this._scatter(u);
      if (this._clearOfWalls(u, collideR + 6)) break;
    }
    return {
      name: isPlayer ? this.commander : this.rng.pick(CALLSIGNS),
      isPlayer, color, def, group, api, shieldGlow, collideR,
      mounts,
      mountCd: mounts.map(() => this.rng.float(0, 0.6)),
      u,
      fwd: this._randomHeading(u, new THREE.Vector3()),
      y: 0, vy: 0,
      speed: 0,
      alive: true,
      hull: isPlayer ? HULL : Math.round(HULL * (1 + 0.04 * (this.tier - 1))),
      hullMax: isPlayer ? HULL : Math.round(HULL * (1 + 0.04 * (this.tier - 1))),
      respawn: 0,
      invuln: 2,
      score: 0,
      elims: 0,
      fireCd: this.rng.float(0, 1),
      strafeDir: this.rng.float(0, 1) < 0.5 ? 1 : -1,
      wallT: -99, // when this hull last touched a barrier
      wobble: this.rng.float(0, 1) * 10,
      boost: 0, rapid: 0, shieldT: 0,
    };
  }

  startMatch(mode) {
    this._lastMode = mode;
    this._teardownMatch();
    this.match = { mode, time: mode === 'harvest' ? HARVEST_TIME : 0, over: false };
    // terrain first — the pilots need the barriers to spawn clear of
    this._buildTerrain();
    this.pilots = [this._makePilot(0, true)];
    for (let i = 1; i <= 2; i++) this.pilots.push(this._makePilot(i, false));
    for (const sm of this.shotPool) sm.visible = false;
    this.shots.length = 0;
    this._place = 1;

    this._buildPickups();

    // the crystal field for the harvest
    this.crystals = [];
    const cryGeo = new THREE.OctahedronGeometry(5);
    const cryWire = new THREE.EdgesGeometry(cryGeo);
    const cryMat = new THREE.LineBasicMaterial({
      color: CRYSTAL_COLOR, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    for (let i = 0, seeds = Math.max(8, Math.round(8 * this.density)); i < seeds; i++) {
      const c = {
        u: new THREE.Vector3(),
        phase: this.rng.float(0, 1) * 10,
        alive: true,
      };
      this._scatter(c.u);
      const g = new THREE.Group();
      const m = new THREE.Mesh(cryGeo, new THREE.MeshBasicMaterial({
        color: 0x08382e, transparent: true, opacity: 0.7, depthWrite: false,
      }));
      m.add(new THREE.LineSegments(cryWire, cryMat));
      g.add(m);
      g.visible = mode === 'harvest';
      this._seat(g, c.u);
      this.scene.add(g);
      c.group = g;
      c.mesh = m;
      this.crystals.push(c);
    }

    this.lobby.classList.add('hidden');
    this.over.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.hud.querySelector('.vh-mode').textContent = `${MODE_INFO[mode].name.toUpperCase()} · ${this.orb.name} · ${MODE_INFO[mode].line}`;
    audio.dock();
    this._announce(mode === 'duel' ? `DUEL — LAST PILOT FLYING ON ${this.orb.name}` : `HARVEST — ${this.orb.name} IS SEEDED`);
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
    for (const g of Object.values(this.shotGeos)) g.dispose();
    this.shotPool.forEach((m) => {
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
      // every mount runs its own clock, which is what makes a rack of mixed
      // weapons sound and feel like a rack of mixed weapons
      for (let i = 0; i < p.mountCd.length; i++) p.mountCd[i] = Math.max(0, p.mountCd[i] - dt);
      p.boost = Math.max(0, p.boost - dt);
      p.rapid = Math.max(0, p.rapid - dt);
      p.shieldT = Math.max(0, p.shieldT - dt);
      p.shieldGlow.visible = p.shieldT > 0;
      p.shieldGlow.material.opacity = p.shieldT > 0 ? 0.7 : 0;

      if (p.isPlayer) this._playerStep(p, dt);
      else this._aiStep(p, dt);

      const maxSpd = p.boost > 0 ? 330 : 250;
      p.speed = clamp(p.speed, 0, maxSpd);
      // along the surface — out here there is no edge to run off and nothing
      // to wrap around, only the far side of the same small world
      this._advance(p.u, p.fwd, p.speed * dt);

      // ground, gravity and jumps
      if (p.y > 0.5 || p.vy !== 0) {
        p.vy -= 430 * dt;
        p.y += p.vy * dt;
        if (p.y <= 0) { p.y = 0; p.vy = 0; }
      } else {
        p.y = 0;
        const jump = this.launchAt(p.u, p.speed);
        if (jump) {
          p.vy = jump;
          p.y = 1;
          audio.missile(0.5);
        }
      }

      // walls stop low hulls; a launched hull sails over them
      if (p.y < 20) this._collideWalls(p);

      const hover = this.groundAt(p.u) + p.y + 6 + Math.sin(this.t * 2.2 + p.wobble) * 1.2;
      p.group.position.copy(p.u).multiplyScalar(this.orbR + hover);
      // nose on +Z, roof on the local vertical — the same convention the lanes
      // use, so the helm turns the way the nose points
      this._seatDir(p.group, p.u, p.fwd);
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
    this._turn(p.fwd, p.u, turn * 2.7 * dt);
    const accel = p.boost > 0 ? 400 : 240;
    if (this._keys.has('KeyW') || this._keys.has('ArrowUp')) p.speed += accel * dt;
    if (this._keys.has('KeyS') || this._keys.has('ArrowDown')) p.speed -= 200 * dt;
    p.speed *= Math.max(0, 1 - 0.6 * dt);
    if (this._keys.has('Space')) this._fire(p);
  }

  _aiStep(p, dt) {
    const enemies = this.pilots.filter((q) => q !== p && q.alive);
    const m = this.match;
    // bearings are measured from this hull's own nose, so dead ahead is zero
    let targetAngle = 0;
    let wantFire = false;
    let wantSpeed = 150;

    if (m.mode === 'duel') {
      const target = enemies[0] ? this._nearest(p, enemies) : null;
      if (target) {
        const d = this._arc(p.u, target.u);
        const aim = this._bearing(p.u, p.fwd, target.u);
        targetAngle = aim;
        // A duellist that orbits with its nose off the target never gets to
        // pull the trigger, so it lines up whenever the gun is close to ready
        // and only circles while it reloads.
        const lining = p.fireCd < 0.8;
        if (!lining && d < 190) {
          targetAngle = aim + p.strafeDir * 1.15;
          wantSpeed = d < 110 ? 60 : 175;
        } else if (d < 90) {
          wantSpeed = 60;
        }
        if (d < 320 && Math.abs(aim) < this._aimTol(d) && p.fireCd <= 0) wantFire = true;
      }
    } else {
      // harvest: the crystal is the job; the gun is for the pilot in the way
      let best = null;
      let bestD = Infinity;
      for (const c of this.crystals) {
        if (!c.alive) continue;
        const d = this._arc(p.u, c.u);
        if (d < bestD) { bestD = d; best = c; }
      }
      if (best) targetAngle = this._bearing(p.u, p.fwd, best.u);
      const player = this.pilots[0];
      if (player.alive) {
        const d = this._arc(p.u, player.u);
        const aim = this._bearing(p.u, p.fwd, player.u);
        if (d < 260 && Math.abs(aim) < this._aimTol(d) && p.fireCd <= 0) wantFire = true;
      }
    }

    targetAngle = this._avoidObstacles(p, targetAngle);

    this._turn(p.fwd, p.u, clamp(roundAng(targetAngle), -2.3 * dt, 2.3 * dt));
    p.speed += clamp(wantSpeed - p.speed, -160 * dt, 160 * dt);
    if (wantFire) {
      this._fire(p);
      p.fireCd = (p.rapid > 0 ? 0.3 : 0.85) + this.rng.float(0, 0.6);
    }
  }

  /** How far off the nose can be and still land a shot at this range. */
  _aimTol(d) {
    return Math.max(0.05, Math.min(0.35, Math.atan(16 / Math.max(16, d))));
  }

  _nearest(p, list) {
    let best = null;
    let bd = Infinity;
    for (const q of list) {
      const d = this._arc(p.u, q.u);
      if (d < bd) { bd = d; best = q; }
    }
    return best;
  }

  /** True when a point on the orb is inside a barrier's footprint. */
  _blocked(u) {
    const l = this._p2;
    for (const o of this.walls) {
      this._localTo(o, u, l);
      if (o.hw) {
        if (Math.abs(l.x) < o.hw + 14 && Math.abs(l.y) < o.hd + 14) return true;
      } else if (l.length() < (o.r || 20) + 14) {
        return true;
      }
    }
    return false;
  }

  _avoidObstacles(p, targetAngle) {
    const probe = 46;
    this._ahead(p.u, p.fwd, probe, this._w1);
    if (!this._blocked(this._w1)) return targetAngle;
    const right = this._headingAt(p.u, p.fwd, -0.9, this._w2);
    this._ahead(p.u, right, probe, this._w3);
    // whichever way has room, with the starboard probe tried first
    return this._blocked(this._w3) ? targetAngle + 0.9 : -0.9;
  }

  /**
   * Let fly with every mount that is off cooldown. A hull with two guns throws
   * two bolts, the way it does in the lanes; a rig with one throws one. Each
   * mount keeps its own cadence, so a pulse lance next to a railgun sounds and
   * feels like a pulse lance next to a railgun.
   */
  _fire(p) {
    let fired = false;
    for (let i = 0; i < p.mounts.length; i++) {
      if (p.mountCd[i] > 0) continue;
      const w = p.mounts[i];
      p.mountCd[i] = w.cd * (p.rapid > 0 ? 0.45 : 1);
      if (this._loose(p, w, i)) fired = true;
    }
    return fired;
  }

  _loose(p, w, mount) {
    const mesh = this.shotPool.find((m) => !m.visible);
    if (!mesh) return false;
    const jitter = this.rng.float(-1, 1) * w.spread;
    const dir = this._headingAt(p.u, p.fwd, jitter, this._w1);
    const u = this._ahead(p.u, dir, 14 + mount * 2, this._w2);
    const height = this.groundAt(p.u) + p.y + 8;

    mesh.visible = true;
    mesh.geometry = this.shotGeos[w.kind] || this.shotGeos.laser;
    // the shot wears its own kind's colour; a rival's is pulled toward the
    // rival, so incoming fire still reads as someone else's problem
    this._col.setHex(w.color);
    if (!p.isPlayer) this._col.lerp(this._col2.setHex(p.color), 0.45);
    mesh.material.color.copy(this._col);
    this._pointAt(u, height, this._w3);
    mesh.position.copy(this._w3);
    this._seatDir(mesh, u, dir);

    this.shots.push({
      u, dir, height,
      speed: w.speed,
      dmg: w.dmg,
      kind: w.kind,
      turn: w.turn,
      life: w.life,
      owner: p,
      mesh,
    });
    audio.laser(w.kind === 'beam', 0.5);
    return true;
  }

  _stepShots(dt) {
    const l = this._p2;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= dt;
      // seekers lean onto the nearest hull that is not the one that threw them
      if (s.turn) {
        const target = this._nearest(s.owner, this.pilots.filter((q) => q !== s.owner && q.alive && q.respawn <= 0));
        if (target) {
          const want = this._bearing(s.u, s.dir, target.u);
          this._turn(s.dir, s.u, clamp(want, -s.turn * dt, s.turn * dt));
        }
      }
      this._advance(s.u, s.dir, s.speed * dt);
      const h = this.groundAt(s.u) + s.height;
      this._pointAt(s.u, h, this._w1);
      s.mesh.position.copy(this._w1);
      this._seatDir(s.mesh, s.u, s.dir);

      let dead = s.life <= 0;
      // walls eat shots that fly low; launched shots clear the slabs
      if (!dead) {
        for (const o of this.walls) {
          this._localTo(o, s.u, l);
          const hit = o.hw
            ? Math.abs(l.x) < o.hw + 3 && Math.abs(l.y) < o.hd + 3
            : l.length() < (o.r || 20) + 3;
          if (hit && s.height < (o.h || 40)) {
            this._spawnBurst(s.u, s.height, 0xff5f8f, 0.4);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const q of this.pilots) {
          if (q === s.owner || !q.alive || q.invuln > 0 || q.respawn > 0) continue;
          if (this._arc(s.u, q.u) < 12) {
            this._hit(q, s.owner, s.dmg, s.kind);
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

  _hit(victim, shooter, dmg, kind) {
    // a pilot already out cannot be hit again — the shots skip the dead, but
    // this keeps a stray call from counting a second kill
    if (!victim.alive) return;
    this._spawnBurst(victim.u, victim.y + 6, victim.color, 0.8);
    audio.hit();
    // a disruptor does not chew structure; it takes the rigging away
    if (kind === 'disruptor') {
      victim.boost = 0;
      victim.rapid = 0;
      victim.shieldT = 0;
      if (victim.isPlayer) this._pop('SYSTEMS SCRAMBLED', '#c792ff');
    }
    victim.hull -= dmg;

    if (this.match.mode === 'harvest') {
      // the harvest has no final answer — a hull that comes apart sits out a
      // moment and scatters crystals where it fell
      if (victim.hull > 0) return;
      victim.hull = victim.hullMax;
      if (victim.score > 0) {
        victim.score = Math.max(0, victim.score - 2);
        this._placeCrystalAt(victim.u);
        this._placeCrystalAt(victim.u);
      }
      this._spawnBurst(victim.u, victim.y + 6, victim.color, 1.3);
      victim.respawn = 3;
      victim.invuln = 1.5;
      victim.group.visible = false;
      return;
    }

    if (victim.hull > 0) {
      if (victim.isPlayer) this._pop(`HULL ${Math.max(0, Math.ceil(victim.hull))}%`, '#ff9a6b');
      return;
    }

    victim.alive = false;
    victim.group.visible = false;
    this._spawnBurst(victim.u, victim.y + 6, victim.color, 1.5);
    if (!victim.isPlayer) {
      shooter.elims += 1;
      // last rival down — the field is ours
      if (!this.pilots.some((q) => !q.isPlayer && q.alive)) {
        this._place = 1;
        this.match.over = true;
        this._finishMatch();
      }
      return;
    }
    // Everyone still flying outranks a pilot who just went out, so the place
    // counts the rivals left alive — not the ones already down.
    this._place = 1 + this.pilots.filter((q) => !q.isPlayer && q.alive).length;
    this.match.over = true;
    this._finishMatch();
  }

  _respawn(p) {
    const u = this._w1;
    for (let tries = 0; tries < 60; tries++) {
      this._scatter(u);
      const crowded = this.pilots.some((q) => q.alive && q !== p && this._arc(q.u, u) < 130);
      if (!crowded && this._clearOfWalls(u, (p.collideR || 14) + 6)) break;
    }
    p.u.copy(u);
    this._randomHeading(p.u, p.fwd);
    p.y = 0;
    p.vy = 0;
    p.speed = 0;
    p.hull = p.hullMax;
    p.group.visible = true;
  }

  _updateCrystals(dt) {
    if (this.match.mode !== 'harvest') return;
    for (const c of this.crystals) {
      c.phase += dt;
      if (c.group.visible) {
        const h = this.groundAt(c.u) + 10 + Math.sin(c.phase * 2.4) * 3;
        this._pointAt(c.u, h, this._w1);
        c.group.position.copy(this._w1);
        c.mesh.rotation.y += dt * 1.4;
      }
      if (!c.alive) continue;
      for (const p of this.pilots) {
        if (!p.alive || p.respawn > 0) continue;
        if (this._arc(p.u, c.u) < 16) {
          c.alive = false;
          c.group.visible = false;
          p.score += 1;
          this._spawnBurst(c.u, 8, CRYSTAL_COLOR, 0.5);
          audio.coin();
          break;
        }
      }
    }
    // the field reseeds itself — the field of play is the whole orb, so there
    // is always somewhere else for the next one
    const empty = this.crystals.filter((c) => !c.alive).length;
    for (let i = 0; i < empty; i++) {
      const c = this.crystals.find((cc) => !cc.alive);
      if (!c) break;
      this._scatter(c.u);
      this._seat(c.group, c.u);
      c.alive = true;
      c.group.visible = true;
    }
  }

  /** Drop a crystal a short hop away from where a hull came apart. */
  _placeCrystalAt(u) {
    const c = this.crystals.find((cc) => !cc.alive);
    if (!c) return;
    c.u.copy(u);
    this._advance(c.u, this._randomHeading(u, this._w1), this.rng.float(-1, 1) * 30);
    this._seat(c.group, c.u);
    c.alive = true;
    c.group.visible = true;
  }

  _stepBursts(dt) {
    for (const b of this.burstPool) {
      if (b.t <= 0) continue;
      b.t -= dt;
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
    const hull = `HULL ${Math.max(0, Math.ceil(p.hull))}`;
    if (m.mode === 'duel') {
      const left = this.pilots.filter((q) => q.alive).length;
      this._hudLives.textContent = `${hull} · PILOTS ${left}`;
      this._hudClock.textContent = '';
    } else {
      this._hudLives.textContent = p.respawn > 0 ? 'IN THE PIT' : hull;
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
    // Walking out is not staying on top of anything: a pilot who leaves the
    // field finishes behind everyone still flying it.
    const place = m.mode === 'duel'
      ? (m.forfeit ? 1 + this.pilots.filter((q) => !q.isPlayer && q.alive).length : this._place)
      : this._harvestPlace();
    const score = m.mode === 'duel' ? p.elims : p.score;
    const { payout, xp } = this._payout(m.mode, place, score, m.forfeit);
    const result = { mode: m.mode, place, score, payout, xp, forfeit: !!m.forfeit, note: '' };
    result.note = m.forfeit
      ? 'You stepped out before the field was settled. The circuit pays nothing for a walk.'
      : m.mode === 'duel'
        ? `Eliminations: ${p.elims}. ${place === 1 ? 'Both rivals down — the purse is yours.' : 'The field keeps flying without you.'}`
        : `${p.score} crystal${p.score === 1 ? '' : 's'} hauled. ${place === 1 ? 'The clock agrees: yours.' : 'Someone else read the field better.'}`;
    result.note += ` Flown on ${this.orb.name}, bracket ${this.tier}.`;
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
        const h = this.groundAt(p.u) + p.y;
        // over the shoulder, standing on the local vertical: on a small orb
        // that means the horizon leans with you all the way round
        const pos = this._pointAt(p.u, h + 52, this._w1)
          .addScaledVector(p.fwd, -78);
        const k = 1 - Math.pow(0.0025, dt);
        this.camera.position.lerp(pos, k);
        this.camera.up.copy(p.u);
        this._ahead(p.u, p.fwd, 44, this._w2);
        this._pointAt(this._w2, this.groundAt(this._w2) + p.y + 10, this._w3);
        this.camera.lookAt(this._w3);
      }
    } else {
      // between matches the rig shows the whole orb, slow and stately
      const a = this.t * 0.12;
      this.camera.up.set(0, 1, 0);
      this.camera.position.set(Math.sin(a) * this.orbR * 1.75, this.orbR * 0.65, Math.cos(a) * this.orbR * 1.75);
      this.camera.lookAt(0, 0, 0);
    }
    this.renderer.render(this.scene, this.camera);
  }
}
