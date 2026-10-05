// A small rotating hologram of a hull for the shipyard: its own tiny renderer,
// lit like the world beyond the glass. Disposed whenever the dock redraws —
// WebGL contexts are precious, so one canvas in, one canvas out.

import * as THREE from 'three';
import { buildShip } from '../core/meshes.js';
import { applyEnvironment } from '../core/materials.js';

export class ShipViewer {
  constructor(host) {
    this.host = host;
    this.alive = true;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'yard-canvas';
    host.append(this.canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, stencil: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 8000);

    // lighting matches the flight scene (see Backdrop / Universe)
    this.scene.add(new THREE.HemisphereLight(0x9cc4ff, 0x1a2434, 1.05));
    const key = new THREE.DirectionalLight(0xfff2d8, 1.85);
    key.position.set(400, 1600, 700);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x6fb6ff, 0.8);
    rim.position.set(700, 600, -1100);
    this.scene.add(rim);
    // the yard glass shows the same materials as the lanes, so it needs the
    // same environment for the metals to read
    applyEnvironment(this.scene, this.renderer);

    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);

    this.ship = null;
    this.t = 0;
    this._d = 40;
    this._last = performance.now();

    this._resize();
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(host);

    this._tick = this._tick.bind(this);
    this._raf = requestAnimationFrame(this._tick);
  }

  /** Put a hull on the cradle. `loadout` follows buildShip's shape. */
  show(def, loadout = null) {
    if (!this.alive) return;
    this._clearShip();
    const { group, api } = buildShip(def, { loadout });
    api.setThrottle(0.45); // idle moored: engines warm, glow soft
    this.pivot.add(group);
    this.pivot.rotation.y = -0.5;
    this.ship = { group, api };

    const d = Math.max(30, def.len * 2.3);
    this._d = d;
    this.camera.position.set(d * 0.62, d * 0.5, d * 0.95);
    this.camera.lookAt(0, 0, 0);
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

  /** Take whatever is on the cradle away, for a hull the yard will not show. */
  clear() {
    this._clearShip();
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
    this.t += dt;
    if (this.ship) {
      this.pivot.rotation.y += dt * 0.5;
      this.pivot.position.y = Math.sin(this.t * 0.8) * this._d * 0.012;
      this.ship.api.pulse(this.t);
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (!this.alive) return;
    this.alive = false;
    cancelAnimationFrame(this._raf);
    this._ro?.disconnect();
    this._clearShip();
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
    this.canvas.remove();
  }
}
