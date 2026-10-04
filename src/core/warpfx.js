// Warp fold — the two seconds of stretched starlight between systems.
//
// Ninety thin, additive streak planes lie flat in the flight plane, each aimed
// along a radius from the ship. In warp they pour inward toward the ship, long
// axis first, lengthening as they come — the classic jump-to-light tunnel seen
// from the top-down helm. A hot core brightens at the centre mid-fold, and the
// whole field breathes in and out so the fold opens fast, holds, then lets go
// cleanly back into real space.

import * as THREE from 'three';

const STREAK_COUNT = 90;
const WARP_SECONDS = 2;

let streakTex = null;
function streakTexture() {
  if (streakTex) return streakTex;
  const w = 128;
  const h = 16;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(160,220,255,0)');
  g.addColorStop(0.5, 'rgba(235,248,255,1)');
  g.addColorStop(1, 'rgba(160,220,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  streakTex = tex;
  return streakTex;
}

export class WarpFx {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.t = 0;
    this.dur = WARP_SECONDS;
    this.cx = 0;
    this.cz = 0;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);

    this.streaks = [];
    const tex = streakTexture();
    for (let i = 0; i < STREAK_COUNT; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      mesh.rotation.x = -Math.PI / 2;
      this.group.add(mesh);
      this.streaks.push({ mesh, angle: 0, radius: 0, speed: 0, len: 0, wid: 0, y: 0 });
    }

    // the hot core at the heart of the fold
    this.core = null;
    const coreTex = new THREE.CanvasTexture((() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const x = c.getContext('2d');
      const grad = x.createRadialGradient(64, 64, 2, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.35, 'rgba(190,230,255,0.6)');
      grad.addColorStop(1, 'rgba(190,230,255,0)');
      x.fillStyle = grad;
      x.fillRect(0, 0, 128, 128);
      return c;
    })());
    coreTex.colorSpace = THREE.SRGBColorSpace;
    const coreMat = new THREE.MeshBasicMaterial({ map: coreTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.core = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), coreMat);
    this.core.rotation.x = -Math.PI / 2;
    this.group.add(this.core);
  }

  begin(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.t = 0;
    this.active = true;
    this.group.visible = true;
    for (const s of this.streaks) this._place(s, 0);
  }

  _place(s, k = 0) {
    s.angle = Math.random() * Math.PI * 2;
    s.radius = 520 + Math.random() * 2000;
    s.speed = 1150 + Math.random() * 1900;
    s.len = 90 + Math.random() * 260;
    s.wid = 3 + Math.random() * 9;
    s.y = -30 + Math.random() * 70;
    s.mesh.material.opacity = 0;
    s.mesh.scale.set(s.len, s.wid, 1);
    s.mesh.rotation.z = -s.angle;
    this._pos(s);
  }

  _pos(s) {
    s.mesh.position.set(
      this.cx + Math.cos(s.angle) * s.radius,
      s.y,
      this.cz + Math.sin(s.angle) * s.radius,
    );
  }

  /** k = 0..1 progress through the fold. */
  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const k = Math.min(1, this.t / this.dur);
    // fast in, hold, let go cleanly
    const env = Math.min(1, k * 5) * Math.min(1, (1 - k) * 5);

    for (const s of this.streaks) {
      s.radius -= s.speed * dt;
      if (s.radius < 90) this._place(s, k);
      // lengthen as the streak dives toward the ship
      const stretch = 0.6 + (1 - Math.min(1, s.radius / 2400)) * 3;
      s.mesh.scale.set(s.len * stretch, s.wid, 1);
      s.mesh.material.opacity = env * (0.35 + 0.65 * (1 - Math.min(1, s.radius / 2400)));
      this._pos(s);
    }

    // the core flares mid-fold, then lets go
    if (this.core) {
      const coreK = Math.sin(Math.PI * Math.min(1, k));
      this.core.material.opacity = coreK * 0.85;
      this.core.scale.set(320 + coreK * 900, 320 + coreK * 900, 1);
      this.core.position.set(this.cx, 2, this.cz);
    }

    if (k >= 1) {
      this.active = false;
      this.group.visible = false;
      if (this.core) this.core.material.opacity = 0;
    }
  }

  stop() {
    this.active = false;
    this.group.visible = false;
  }
}
