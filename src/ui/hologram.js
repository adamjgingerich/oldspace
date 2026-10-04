// Target ID hologram: a small live model of the hull you have locked up.
//
// The lanes are flown from overhead, so the plate shows the same hull from the
// same angle — screen-true heading and all — and the model turns exactly as the
// ship turns in the window. One renderer lives for the whole flight (WebGL
// contexts are precious): locking a different hull swaps the model, it never
// opens a second context.

import * as THREE from 'three';
import { buildShip } from '../core/meshes.js';
import { applyEnvironment } from '../core/materials.js';

/** Yaw easing — the model catches up with a hard turn instead of snapping. */
const YAW_RATE = 7;
/** Seconds for a freshly locked hull to settle onto the cradle. */
const POP_TIME = 0.32;

export class Hologram {
  constructor(host) {
    this.host = host;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'holo-canvas';
    host.append(this.canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, stencil: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    // same overhead framing as the flight camera, tipped just enough to show
    // some flank so the hull does not read as a flat silhouette
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.5, 8000);
    this.camera.up.set(0, 0, -1);

    this.scene.add(new THREE.HemisphereLight(0x9cc4ff, 0x1a2434, 1.1));
    const key = new THREE.DirectionalLight(0xfff2d8, 1.8);
    key.position.set(500, 1400, 600);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x7fc0ff, 0.9);
    rim.position.set(-700, 900, -900);
    this.scene.add(rim);
    applyEnvironment(this.scene, this.renderer);

    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);

    this.visible = false;
    this.alive = true;
    this.ship = null;
    this._key = null;
    this._d = 40;
    this._yaw = 0;
    this._wantedYaw = 0;
    this._pop = 1;
    this._t = 0;
    this._last = performance.now();

    this._resize();
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(host);

    this._tick = this._tick.bind(this);
    this._raf = requestAnimationFrame(this._tick);
  }

  /**
   * Put a hull on the cradle. Rebuilds only when the hull actually changes, so
   * holding a lock costs nothing frame to frame.
   */
  setTarget(def, loadout, accent) {
    if (!def) return;
    const kit = (loadout?.weapons || []).join(',');
    const key = `${def.id}|${accent}|${kit}`;
    if (key === this._key && this.ship) return;
    this._key = key;

    this._clearShip();
    const { group, api } = buildShip(def, { accent, loadout });
    api.setThrottle(0.34);
    this.pivot.add(group);
    this.ship = { group, api };

    const d = Math.max(26, def.len * 2.3);
    this._d = d;
    this.camera.position.set(0, d * 0.94, d * 0.36);
    this.camera.lookAt(0, 0, 0);
    this._pop = 0;
    this._yaw = this._wantedYaw;
  }

  /** Screen-true heading, in radians — the model turns with the world. */
  orient(heading) {
    this._wantedYaw = heading;
  }

  setVisible(on) {
    this.visible = !!on;
    this.host.classList.toggle('on', this.visible);
  }

  _clearShip() {
    if (!this.ship) return;
    this.pivot.remove(this.ship.group);
    // burn the built geometries (sprites share cached resources — leave them)
    this.ship.group.traverse((n) => {
      if (n.isMesh && n.geometry) n.geometry.dispose();
    });
    this.ship = null;
  }

  _resize() {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _tick(now) {
    if (!this.alive) return;
    this._raf = requestAnimationFrame(this._tick);
    const dt = Math.min(0.06, (now - this._last) / 1000);
    this._last = now;
    if (!this.visible || !this.ship) return;

    this._t += dt;
    // shortest way round, eased — a hull crossing your bow does not spin
    let delta = this._wantedYaw - this._yaw;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this._yaw += delta * Math.min(1, dt * YAW_RATE);
    this.pivot.rotation.y = this._yaw;

    this._pop = Math.min(1, this._pop + dt / POP_TIME);
    const scale = 0.86 + 0.14 * (1 - Math.pow(1 - this._pop, 3));
    this.pivot.scale.setScalar(scale);
    this.pivot.position.y = Math.sin(this._t * 1.1) * this._d * 0.008;
    this.ship.api.pulse(this._t);

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.alive === false) return;
    this.alive = false;
    cancelAnimationFrame(this._raf);
    this._ro?.disconnect();
    this._clearShip();
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
    this.canvas.remove();
  }
}
