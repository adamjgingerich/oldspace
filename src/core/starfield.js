// Background starfield + soft nebula washes.

import * as THREE from 'three';
import { glowSprite } from './fx.js';

export function buildStarfield({ count = 2600, radius = 9000 } = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    // Uniform on a shallow dome above the plane, plus some below.
    const a = Math.random() * Math.PI * 2;
    const r = radius * (0.35 + 0.65 * Math.random());
    const y = (Math.random() - 0.5) * radius * 0.9;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = Math.sin(a) * r;
    const t = Math.random();
    if (t < 0.72) c.setHSL(0.58, 0.1, 0.75 + Math.random() * 0.25);
    else if (t < 0.88) c.setHSL(0.09, 0.5, 0.8);
    else c.setHSL(0.75, 0.45, 0.8);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 2.1,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = -10;
  return points;
}

/** Two huge soft washes with the system's nebula colours. */
export function buildNebula(colorA = 0x24486e, colorB = 0x1a2c4a) {
  const group = new THREE.Group();
  const a = glowSprite(colorA, 9000);
  a.material.opacity = 0.37;
  a.position.set(-3200, -1500, -2600);
  const b = glowSprite(colorB, 7500);
  b.material.opacity = 0.32;
  b.position.set(3600, -1400, 2400);
  const c = glowSprite(colorA, 5200);
  c.material.opacity = 0.2;
  c.position.set(1400, -1600, -4200);
  group.add(a, b, c);
  group.renderOrder = -9;
  return group;
}

/* ------------------------------------------------------------------ */
/* Deep-field flavour: far galaxies, gas clouds, dust, comets, debris  */
/* ------------------------------------------------------------------ */

const PASTELS = [0xffd9ec, 0xcfe0ff, 0xffe9c9, 0xd9fff2, 0xe8d9ff, 0xffe0d0];

/** Distant lightly-tinted galaxies: a bright core wrapped in tilted pastel discs. */
export function buildFarGalaxies(rng) {
  const group = new THREE.Group();
  const count = 2 + Math.floor(rng.float(0, 3));
  for (let i = 0; i < count; i++) {
    const g = new THREE.Group();
    const tint = rng.pick(PASTELS);
    const R = 260 + rng.float(0, 420);
    const puffs = 7 + Math.floor(rng.float(0, 6));
    for (let k = 0; k < puffs; k++) {
      const a = (k / puffs) * Math.PI * 2 + rng.float(0, 0.4);
      const rr = R * (0.5 + 0.5 * rng.float(0, 1));
      const spr = glowSprite(tint, rr * 0.9);
      spr.position.set(
        Math.cos(a) * R * (0.85 + rng.float(0, 0.3)),
        Math.sin(a) * R * 0.32,
        rng.float(-30, 30),
      );
      spr.material.opacity = 0.05 + rng.float(0, 0.06);
      g.add(spr);
    }
    const core = glowSprite(0xffffff, R * 0.5);
    core.material.opacity = 0.32;
    g.add(core);
    const haze = glowSprite(tint, R * 2.2);
    haze.material.opacity = 0.08;
    g.add(haze);
    g.rotation.z = rng.float(0, Math.PI);
    const a0 = rng.float(0, Math.PI * 2);
    const dist = 1700 + rng.float(0, 900);
    const high = rng.float(0, 1) < 0.5;
    g.position.set(
      Math.cos(a0) * dist,
      high ? 1300 + rng.float(0, 800) : -(1400 + rng.float(0, 900)),
      Math.sin(a0) * dist,
    );
    group.add(g);
  }
  group.userData.animate = (dt) => {
    group.rotation.y += dt * 0.0012; // barely-there drift
  };
  group.renderOrder = -8;
  return group;
}

/** Soft pastel gas clouds drifting at the system's edge. */
export function buildGasClouds(rng, theme = [0x24486e, 0x1a2c4a]) {
  const group = new THREE.Group();
  const count = 1 + Math.floor(rng.float(0, 2));
  for (let i = 0; i < count; i++) {
    const cl = new THREE.Group();
    const tint = rng.float(0, 1) < 0.5 ? rng.pick(PASTELS) : rng.pick(theme);
    const R = 900 + rng.float(0, 900);
    const puffs = 7 + Math.floor(rng.float(0, 5));
    for (let k = 0; k < puffs; k++) {
      const spr = glowSprite(tint, R * (0.55 + rng.float(0, 0.6)));
      spr.position.set(rng.float(-0.8, 0.8) * R, rng.float(-0.25, 0.25) * R, rng.float(-0.8, 0.8) * R);
      spr.material.opacity = 0.045 + rng.float(0, 0.05);
      cl.add(spr);
    }
    const a = rng.float(0, Math.PI * 2);
    const d = 1500 + rng.float(0, 1100);
    cl.position.set(Math.cos(a) * d, -800 - rng.float(0, 1200), Math.sin(a) * d);
    cl.userData.spin = rng.float(-0.004, 0.004);
    group.add(cl);
  }
  group.userData.animate = (dt) => {
    for (const cl of group.children) cl.rotation.y += cl.userData.spin * dt;
  };
  group.renderOrder = -8;
  return group;
}

/** Faint shoals of space dust — many tiny motes drifting in flattened discs. */
export function buildDustPatches(rng) {
  const group = new THREE.Group();
  const count = 2 + Math.floor(rng.float(0, 3));
  for (let i = 0; i < count; i++) {
    const n = 40 + Math.floor(rng.float(0, 50));
    const pos = new Float32Array(n * 3);
    const R = 420 + rng.float(0, 520);
    for (let k = 0; k < n; k++) {
      const a = rng.float(0, Math.PI * 2);
      const d = Math.sqrt(rng.float(0, 1)) * R;
      pos[k * 3] = Math.cos(a) * d;
      pos[k * 3 + 1] = rng.float(-30, 30);
      pos[k * 3 + 2] = Math.sin(a) * d;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xbfd4e8, size: 3.4, transparent: true, opacity: 0.3,
      depthWrite: false, sizeAttenuation: true,
    });
    const pts = new THREE.Points(geo, mat);
    const a2 = rng.float(0, Math.PI * 2);
    const d2 = 1200 + rng.float(0, 2100);
    pts.position.set(Math.cos(a2) * d2, rng.float(-130, 130), Math.sin(a2) * d2);
    pts.userData.drift = { x0: pts.position.x, z0: pts.position.z, ph: rng.float(0, 6.28) };
    group.add(pts);
  }
  group.userData.animate = (dt, t) => {
    for (const p of group.children) {
      const d = p.userData.drift;
      p.position.x = d.x0 + Math.sin(t * 0.05 + d.ph) * 120;
      p.position.z = d.z0 + Math.cos(t * 0.04 + d.ph) * 90;
    }
  };
  return group;
}

/** A comet: bright head, comet tail streaming against its own motion. */
export function buildComet(rng) {
  const group = new THREE.Group();
  const head = glowSprite(0xdff3ff, 120);
  head.material.opacity = 0.9;
  const core = glowSprite(0xffffff, 48);
  core.material.opacity = 1;
  group.add(head, core);
  const tails = [];
  for (let i = 0; i < 12; i++) {
    const spr = glowSprite(i < 6 ? 0xcfeaff : 0x9ec8e8, 90 - i * 6);
    group.add(spr);
    tails.push(spr);
  }
  const a = rng.float(0, Math.PI * 2);
  const dist = 4300;
  group.position.set(Math.cos(a) * dist, rng.float(40, 130), Math.sin(a) * dist);
  const speed = rng.float(26, 52);
  const dir = Math.atan2(-Math.sin(a), -Math.cos(a)) + rng.float(-0.3, 0.3);
  const vx = Math.cos(dir) * speed;
  const vz = Math.sin(dir) * speed;
  const span = 4700;
  group.userData.animate = (dt, t) => {
    group.position.x += vx * dt;
    group.position.z += vz * dt;
    if (Math.abs(group.position.x) > span || Math.abs(group.position.z) > span) {
      group.position.x = -Math.sign(vx || 1) * span * 0.9;
      group.position.z = -Math.sign(vz || 1) * span * 0.9;
    }
    const vlen = Math.hypot(vx, vz) || 1;
    const ux = vx / vlen;
    const uz = vz / vlen;
    tails.forEach((s, i) => {
      const d = 30 + i * 34 + 6 * Math.sin(t * 1.4 + i * 0.5);
      s.position.set(-ux * d, 0, -uz * d);
      s.material.opacity = 0.32 * (1 - i / 12) * (0.75 + 0.25 * Math.sin(t * 2 + i));
    });
    const k = 120 * (1 + 0.08 * Math.sin(t * 3 + 1));
    head.scale.set(k, k, 1);
  };
  return group;
}

/** Drifting junk: tumbling shards, panels and gravel left by old battles. */
export function buildDebrisField(rng) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x7d7a72, roughness: 0.9, metalness: 0.2, flatShading: true });
  const n = 7 + Math.floor(rng.float(0, 9));
  const R = 140 + rng.float(0, 180);
  const parts = [];
  for (let i = 0; i < n; i++) {
    const geo = rng.float(0, 1) < 0.5
      ? new THREE.TetrahedronGeometry(4 + rng.float(0, 14), 0)
      : new THREE.BoxGeometry(4 + rng.float(0, 16), 2 + rng.float(0, 8), 3 + rng.float(0, 12));
    const m = new THREE.Mesh(geo, mat);
    m.position.set(rng.float(-R, R), rng.float(-R * 0.25, R * 0.25), rng.float(-R, R));
    m.rotation.set(rng.float(0, 3), rng.float(0, 3), rng.float(0, 3));
    group.add(m);
    parts.push({ m, sp: rng.float(-0.35, 0.35), ph: rng.float(0, 6.28) });
  }
  const a = rng.float(0, Math.PI * 2);
  const d = 1400 + rng.float(0, 1600);
  group.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
  group.userData.animate = (dt, t) => {
    for (const p of parts) {
      p.m.rotation.x += p.sp * dt;
      p.m.rotation.y += p.sp * 0.7 * dt;
      p.m.position.y += Math.sin(t * 0.3 + p.ph) * dt * 1.2;
    }
  };
  return group;
}
