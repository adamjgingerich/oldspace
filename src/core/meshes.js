// Procedural models for the game.
// Ships are assembled from many small parts — lathed fuselages, extruded
// wings, engine bells with rings and fins, turrets, panel rows, greeble
// clusters, RCS quads and nav-light arrays — then merged down to one mesh
// per material so detail stays cheap.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { withRim } from './materials.js';
import { glowSprite } from './fx.js';
import { rngOf } from './rng.js';
import { factionHex } from '../data/factions.js';
import { WEAPON_BY_ID } from '../data/weapons.js';
import { OUTFIT_BY_ID } from '../data/outfits.js';

export const factionColor = (id) => new THREE.Color(factionHex(id));

/* ------------------------------------------------------------------ */
/* Shared materials                                                    */
/*                                                                     */
/* Every hull and station surface wears a fresnel rim so silhouettes    */
/* stay bright against black space, and a small shared environment map  */
/* gives the metals something to reflect. Tuned for clean, not grubby.  */
/* ------------------------------------------------------------------ */

const matCache = new Map();
function cached(key, make) {
  let m = matCache.get(key);
  if (!m) {
    m = make();
    matCache.set(key, m);
  }
  return m;
}
const hullMat = (color) => cached(`hull-${color}`, () => withRim(new THREE.MeshStandardMaterial({
  color, metalness: 0.44, roughness: 0.48, envMapIntensity: 1.3,
}), { color: 0x9fe8ff, power: 2.7, strength: 0.4, lift: 0.05 }));
const plateMat = (color) => cached(`plate-${color}`, () => withRim(new THREE.MeshStandardMaterial({
  color, metalness: 0.62, roughness: 0.34, envMapIntensity: 1.45,
}), { color: 0xc8f2ff, power: 2.3, strength: 0.5, lift: 0.06 }));
const lightMat = () => cached('light-plate', () => withRim(new THREE.MeshStandardMaterial({
  color: 0xe4eefa, metalness: 0.3, roughness: 0.44, envMapIntensity: 1.35,
}), { color: 0xffffff, power: 2.1, strength: 0.58, lift: 0.07 }));
const darkMat = () => cached('dark', () => withRim(new THREE.MeshStandardMaterial({
  color: 0x2a3040, metalness: 0.72, roughness: 0.42, envMapIntensity: 1.2,
}), { color: 0x7cc4ff, power: 3, strength: 0.26, lift: 0.03 }));
const ventMat = () => cached('vent', () => withRim(new THREE.MeshStandardMaterial({
  color: 0x161a22, metalness: 0.5, roughness: 0.8, envMapIntensity: 0.8,
}), { color: 0x5a86a8, power: 3.2, strength: 0.18 }));
const glassMat = () => cached('glass', () => withRim(new THREE.MeshPhysicalMaterial({
  color: 0x0c2436, metalness: 0.85, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.08,
  emissive: 0x11405f, emissiveIntensity: 1.05, envMapIntensity: 1.7,
}), { color: 0xbdf0ff, power: 1.9, strength: 0.72, lift: 0.08 }));
const accentMat = (hex) => cached(`acc-${hex}`, () => withRim(new THREE.MeshStandardMaterial({
  color: hex, metalness: 0.42, roughness: 0.44, emissive: hex, emissiveIntensity: 0.72,
  envMapIntensity: 1.3,
}), { color: hex, power: 2.2, strength: 0.5, lift: 0.06 }));
const nozzleMat = () => cached('nozzle', () => withRim(new THREE.MeshStandardMaterial({
  color: 0x4a5262, metalness: 0.86, roughness: 0.3, side: THREE.DoubleSide, envMapIntensity: 1.4,
}), { color: 0xa8d8ff, power: 2.5, strength: 0.44, lift: 0.05 }));

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                    */
/* ------------------------------------------------------------------ */

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

function xf(geo, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  _e.set(rot[0], rot[1], rot[2]);
  _q.setFromEuler(_e);
  _m4.compose(_v.set(pos[0], pos[1], pos[2]), _q, _s.set(scale[0], scale[1], scale[2]));
  geo.applyMatrix4(_m4);
  return geo;
}

class PartBucket {
  constructor() {
    this.map = new Map();
  }
  put(matKey, geo) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    let list = this.map.get(matKey);
    if (!list) {
      list = [];
      this.map.set(matKey, list);
    }
    list.push(g);
  }
  build(materialFor) {
    const group = new THREE.Group();
    for (const [key, geos] of this.map) {
      const merged = mergeGeometries(geos, false);
      if (!merged) {
        console.warn('[meshes] merge failed for', key);
        continue;
      }
      merged.computeBoundingSphere();
      group.add(new THREE.Mesh(merged, materialFor(key)));
    }
    return group;
  }
}

/** Lathed fuselage, nose +Z. Profile runs stern (t=0) to nose (t=1). */
function fuselage(len, maxR, seg = 14, stops = null, flatten = 0.72) {
  const profile = stops || [
    [0, 0.66], [0.10, 0.82], [0.28, 0.95], [0.46, 1.0], [0.62, 0.99],
    [0.78, 0.80], [0.90, 0.46], [1, 0.0],
  ];
  const pts = profile.map(([t, r]) => new THREE.Vector2(Math.max(0.0001, maxR * r), (t - 0.5) * len));
  const geo = new THREE.LatheGeometry(pts, seg);
  geo.rotateX(Math.PI / 2);
  if (flatten !== 1) {
    geo.scale(1, flatten, 1);
    geo.computeVertexNormals();
  }
  return geo;
}

/** Single swept wing plate spanning both sides (no mirroring). */
function wingPlate(span, rootChord, tipChord, sweep, thickness) {
  const s = new THREE.Shape();
  s.moveTo(0, rootChord * 0.5);
  s.lineTo(span, tipChord * 0.5 - sweep);
  s.lineTo(span, -tipChord * 0.5 - sweep);
  s.lineTo(0, -rootChord * 0.5);
  s.lineTo(-span, -tipChord * 0.5 - sweep);
  s.lineTo(-span, tipChord * 0.5 - sweep);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: thickness, bevelEnabled: true,
    bevelThickness: thickness * 0.35, bevelSize: thickness * 0.35, bevelSegments: 1,
  });
  geo.rotateX(Math.PI / 2);
  return geo;
}

/** Vertical fin: chord along Z, height along Y, thickness along X. */
function finPlate(chord, height, thickness, sweep = 0) {
  const s = new THREE.Shape();
  s.moveTo(chord * 0.5, 0);
  s.lineTo(-chord * 0.5, 0);
  s.lineTo(-chord * 0.5 + sweep, height);
  s.lineTo(chord * 0.5 - sweep * 1.6, height);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: thickness, bevelEnabled: true,
    bevelThickness: thickness * 0.3, bevelSize: thickness * 0.3, bevelSegments: 1,
  });
  geo.rotateY(-Math.PI / 2);
  return geo;
}

function engineBell(r, len) {
  const bell = new THREE.CylinderGeometry(r * 0.72, r, len, 12, 1, true);
  bell.rotateX(Math.PI / 2);
  return bell;
}
function engineDisc(r) {
  const disc = new THREE.CircleGeometry(r * 0.72, 12);
  disc.rotateY(Math.PI);
  return disc;
}

function tinyRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const planetTexCache = new Map();

/** Soft irregular blob used by the planet surfaces. */
function blob(ctx, cx, cy, r, rng) {
  ctx.beginPath();
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.72 + rng() * 0.5);
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr * 0.8;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

/** Random walk stroke (cracks, streaks) that wraps around the seam. */
function wander(ctx, W, H, rng, segs, step) {
  ctx.beginPath();
  let x = rng() * W;
  let y = rng() * H;
  ctx.moveTo(x, y);
  for (let s = 0; s < segs; s++) {
    x += (rng() - 0.35) * step;
    y += (rng() - 0.5) * step * 0.5;
    if (x < 0) x += W;
    if (x > W) x -= W;
    ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/** Per-type procedural surface so every world reads as a place, not a dot. */
function planetTexture(hex, seedStr, type) {
  const key = `${hex}-${seedStr}-${type}`;
  if (planetTexCache.has(key)) return planetTexCache.get(key);
  const W = 512;
  const H = 256;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  const base = new THREE.Color(hex);
  const rng = tinyRng(hashStr(`${seedStr}:surf`));
  const shade = (l, s = 0, h = 0) => `#${base.clone().offsetHSL(h, s, l).getHexString()}`;

  // base wash with gentle latitude shading (poles darker, belt brighter)
  const lat = ctx.createLinearGradient(0, 0, 0, H);
  lat.addColorStop(0, shade(0.1));
  lat.addColorStop(0.5, shade(0.02));
  lat.addColorStop(1, shade(-0.12));
  ctx.fillStyle = lat;
  ctx.fillRect(0, 0, W, H);

  if (type === 'gas') {
    // deep weather bands with wavy edges
    for (let i = 0; i < 30; i++) {
      const y = (i / 30) * H;
      const h = 4 + rng() * 14;
      ctx.fillStyle = shade((rng() - 0.55) * 0.3, (rng() - 0.5) * 0.16, (rng() - 0.5) * 0.03);
      ctx.globalAlpha = 0.3 + rng() * 0.4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= W; x += 32) ctx.lineTo(x, y + Math.sin((x / W) * 6.3 + i) * 3.5);
      ctx.lineTo(W, y + h);
      for (let x = W; x >= 0; x -= 32) ctx.lineTo(x, y + h + Math.sin((x / W) * 6.3 + i + 1.5) * 3.5);
      ctx.closePath();
      ctx.fill();
    }
    // storm ovals
    const storms = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < storms; i++) {
      const sx = rng() * W;
      const sy = H * (0.25 + rng() * 0.5);
      const sr = 14 + rng() * 26;
      const tint = shade(0.06, 0.2, (rng() - 0.5) * 0.08);
      for (let k = 4; k >= 0; k--) {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = k % 2 ? tint : shade(0.2);
        ctx.beginPath();
        ctx.ellipse(sx, sy, sr * (0.4 + k * 0.16), sr * (0.24 + k * 0.1), 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (type === 'terran') {
    // seas, then continents with coast shelves and highlands
    for (let i = 0; i < 7; i++) {
      const cx = rng() * W;
      const cy = H * (0.18 + rng() * 0.64);
      const rr = 26 + rng() * 60;
      ctx.fillStyle = shade(-0.24, 0.06, 0.01);
      ctx.globalAlpha = 0.5;
      blob(ctx, cx, cy, rr * 1.35, rng);
      ctx.fillStyle = shade(0, 0.05, -0.02);
      ctx.globalAlpha = 0.9;
      blob(ctx, cx, cy, rr, rng);
      ctx.fillStyle = shade(0.14, 0);
      ctx.globalAlpha = 0.6;
      blob(ctx, cx + rr * 0.2, cy - rr * 0.15, rr * 0.55, rng);
    }
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = shade((rng() - 0.4) * 0.25, 0.05, 0);
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(rng() * W, rng() * H, 2 + rng() * 7, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.globalAlpha = 0.1 + rng() * 0.16;
      ctx.lineWidth = 3 + rng() * 6;
      let x = rng() * W;
      let y = rng() * H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 4; s++) {
        x += 20 + rng() * 50;
        y += (rng() - 0.5) * 10;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (type === 'ice') {
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = shade((rng() - 0.3) * 0.3, 0.03, 0);
      ctx.globalAlpha = 0.25 + rng() * 0.3;
      blob(ctx, rng() * W, rng() * H, 10 + rng() * 40, rng);
    }
    ctx.strokeStyle = shade(-0.3, 0.1);
    for (let i = 0; i < 34; i++) {
      ctx.globalAlpha = 0.3 + rng() * 0.3;
      ctx.lineWidth = 0.8 + rng() * 1.4;
      wander(ctx, W, H, rng, 5 + rng() * 5, 44);
    }
  } else if (type === 'rocky' || type === 'moon') {
    const craters = type === 'moon' ? 130 : 80;
    for (let i = 0; i < craters; i++) {
      const cx = rng() * W;
      const cy = rng() * H;
      const cr = 2 + rng() * (type === 'moon' ? 14 : 11);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = shade(0.16);
      ctx.beginPath();
      ctx.arc(cx, cy, cr * 1.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = shade(-0.22);
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();
      if (cr > 4) {
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = shade(0.22);
        ctx.beginPath();
        ctx.arc(cx - cr * 0.15, cy + cr * 0.15, cr * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = shade((rng() - 0.5) * 0.2);
    for (let i = 0; i < 12; i++) {
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 1.5 + rng() * 3;
      wander(ctx, W, H, rng, 3, 90);
    }
  } else if (type === 'ocean') {
    // deep water, island chains, reef shallows and slow currents
    for (let i = 0; i < 14; i++) {
      const cx = rng() * W;
      const cy = H * (0.15 + rng() * 0.7);
      const rr = 10 + rng() * 40;
      ctx.fillStyle = shade(-0.18, 0.14, -0.02);
      ctx.globalAlpha = 0.85;
      blob(ctx, cx, cy, rr, rng);
      ctx.fillStyle = shade(0.08, 0.16, 0.01);
      ctx.globalAlpha = 0.9;
      blob(ctx, cx + rr * 0.3, cy - rr * 0.2, rr * 0.5, rng);
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = shade(0.2, 0.25, 0.02);
      ctx.globalAlpha = 0.35;
      blob(ctx, rng() * W, rng() * H, 8 + rng() * 24, rng);
    }
    ctx.strokeStyle = shade(-0.35, 0.15);
    for (let i = 0; i < 26; i++) {
      ctx.globalAlpha = 0.2 + rng() * 0.2;
      ctx.lineWidth = 1 + rng() * 2.5;
      wander(ctx, W, H, rng, 6 + rng() * 6, 30);
    }
  } else if (type === 'desert') {
    // crescent dune seas and mesa buttes
    for (let i = 0; i < 46; i++) {
      const cx = rng() * W;
      const cy = rng() * H;
      const rr = 6 + rng() * 22;
      ctx.fillStyle = shade((rng() - 0.5) * 0.2, (rng() - 0.5) * 0.12, 0);
      ctx.globalAlpha = 0.28 + rng() * 0.3;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rr, rr * 0.35, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = shade(0.16, 0.06, 0);
      ctx.globalAlpha = 0.5;
      blob(ctx, rng() * W, rng() * H, 8 + rng() * 26, rng);
    }
  } else if (type === 'dusty') {
    // storm-carved ochre: mesa flats, wind streaks and drifting dust veils
    for (let i = 0; i < 22; i++) {
      ctx.fillStyle = shade((rng() - 0.5) * 0.22, 0.08, 0);
      ctx.globalAlpha = 0.3 + rng() * 0.3;
      blob(ctx, rng() * W, rng() * H, 12 + rng() * 38, rng);
    }
    ctx.strokeStyle = shade(0.18, 0.12);
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = 0.16 + rng() * 0.2;
      ctx.lineWidth = 1 + rng() * 3;
      let y = rng() * H;
      let x = 0;
      ctx.beginPath();
      ctx.moveTo(0, y);
      while (x < W) {
        x += 26 + rng() * 40;
        ctx.lineTo(x, y + (rng() - 0.5) * 22);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = '#e8d8b8';
      ctx.globalAlpha = 0.05 + rng() * 0.08;
      ctx.fillRect(0, rng() * H, W, 6 + rng() * 20);
    }
  } else if (type === 'jungle') {
    // dense canopy, bright clearings and river threads
    for (let i = 0; i < 16; i++) {
      const cx = rng() * W;
      const cy = H * (0.15 + rng() * 0.7);
      const rr = 18 + rng() * 44;
      ctx.fillStyle = shade(-0.22, 0.18, 0.01);
      ctx.globalAlpha = 0.8;
      blob(ctx, cx, cy, rr, rng);
      ctx.fillStyle = shade(0.1, 0.2, 0.01);
      ctx.globalAlpha = 0.7;
      blob(ctx, cx + rr * 0.15, cy - rr * 0.1, rr * 0.6, rng);
    }
    ctx.strokeStyle = shade(0.24, 0.25, 0.03);
    for (let i = 0; i < 12; i++) {
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 2 + rng() * 3;
      wander(ctx, W, H, rng, 5 + rng() * 4, 40);
    }
  } else if (type === 'crystal') {
    // angular shards and glints on a dark bed
    for (let i = 0; i < 26; i++) {
      const cx = rng() * W;
      const cy = rng() * H;
      const s = 6 + rng() * 22;
      ctx.globalAlpha = 0.5 + rng() * 0.4;
      ctx.fillStyle = shade((rng() - 0.5) * 0.28, 0.25, (rng() - 0.5) * 0.04);
      ctx.beginPath();
      ctx.moveTo(cx, cy - s);
      ctx.lineTo(cx + s * (0.5 + rng() * 0.5), cy - s * 0.3);
      ctx.lineTo(cx + s * (rng() - 0.5) * 0.6, cy + s);
      ctx.lineTo(cx - s * (0.4 + rng() * 0.5), cy + s * 0.2);
      ctx.closePath();
      ctx.fill();
    }
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = rng() < 0.5 ? '#ffffff' : '#aef4ff';
      ctx.globalAlpha = 0.4 + rng() * 0.6;
      ctx.fillRect(rng() * W, rng() * H, 1 + rng() * 2, 1 + rng() * 2);
    }
  } else if (type === 'toxic') {
    // sickly swirl — gas-like decks in venom greens
    for (let i = 0; i < 30; i++) {
      const y = (i / 30) * H;
      const h = 4 + rng() * 14;
      ctx.fillStyle = shade((rng() - 0.55) * 0.26, (rng() - 0.5) * 0.2, (rng() - 0.5) * 0.06);
      ctx.globalAlpha = 0.3 + rng() * 0.4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= W; x += 32) ctx.lineTo(x, y + Math.sin((x / W) * 6.3 + i) * 3.5);
      ctx.lineTo(W, y + h);
      for (let x = W; x >= 0; x -= 32) ctx.lineTo(x, y + h + Math.sin((x / W) * 6.3 + i + 1.5) * 3.5);
      ctx.closePath();
      ctx.fill();
    }
    for (let i = 0; i < 18; i++) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = shade(-0.24, 0.1);
      ctx.beginPath();
      ctx.arc(rng() * W, rng() * H, 3 + rng() * 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (type === 'molten') {
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = shade(-0.35);
      blob(ctx, rng() * W, rng() * H, 8 + rng() * 30, rng);
    }
    ctx.strokeStyle = '#ffb066';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 34; i++) {
      ctx.globalAlpha = 0.4 + rng() * 0.5;
      wander(ctx, W, H, rng, 6, 26);
    }
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = '#ffd9a0';
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.arc(rng() * W, rng() * H, 3 + rng() * 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // polar ice caps (airless and hot worlds skip them)
  if (type !== 'molten' && type !== 'gas' && type !== 'crystal' && type !== 'toxic') {
    const capH = type === 'ice' ? H * 0.22 : H * (0.06 + rng() * 0.09);
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = type === 'terran' ? 'rgba(244,250,255,0.9)' : 'rgba(235,242,250,0.6)';
    ctx.fillRect(0, 0, W, capH);
    ctx.fillRect(0, H - capH, W, capH);
  }
  // fine grain over everything
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = rng() < 0.5 ? '#000000' : '#ffffff';
    ctx.fillRect(rng() * W, rng() * H, 1, 1);
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  planetTexCache.set(key, tex);
  return tex;
}

const cloudTexCache = new Map();
/** Soft alpha cloud veil for worlds with weather. */
function cloudTexture(seedStr, type) {
  const key = `${seedStr}-${type}`;
  if (cloudTexCache.has(key)) return cloudTexCache.get(key);
  const W = 512;
  const H = 256;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  const rng = tinyRng(hashStr(`${seedStr}:clouds`));
  if (type === 'gas') {
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = 0.05 + rng() * 0.1;
      ctx.fillStyle = rng() < 0.6 ? '#ffffff' : '#0b1020';
      ctx.fillRect(0, rng() * H, W, 3 + rng() * 10);
    }
  } else {
    for (let i = 0; i < 46; i++) {
      const cx = rng() * W;
      const cy = H * (0.06 + rng() * 0.88);
      const r = 12 + rng() * 50;
      ctx.globalAlpha = 0.05 + rng() * 0.12;
      ctx.fillStyle = '#ffffff';
      blob(ctx, cx, cy, r, rng);
      ctx.globalAlpha *= 0.6;
      blob(ctx, cx + r * 0.4, cy + r * 0.2, r * 0.6, rng);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  cloudTexCache.set(key, tex);
  return tex;
}

let ringTex = null;
/** Banded ring texture with a Cassini-style gap; planar-maps onto RingGeometry. */
function ringTexture() {
  if (ringTex) return ringTex;
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const inner = S * 0.337; // RingGeometry inner/outer ratio (~1.45/2.15) in texture radii
  for (let r = inner; r < S / 2; r += 1) {
    const t = (r - inner) / (S / 2 - inner);
    const band = 0.5 + 0.5 * Math.sin(t * 34) * Math.sin(t * 7 + 1);
    let a = 0.18 + band * 0.4;
    if (t > 0.42 && t < 0.48) a *= 0.15;
    if (t > 0.78 && t < 0.82) a *= 0.3;
    ctx.strokeStyle = `rgba(235,225,195,${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ringTex = new THREE.CanvasTexture(cv);
  ringTex.colorSpace = THREE.SRGBColorSpace;
  return ringTex;
}

let limbTex = null;
/** Radial limb-darkening disc laid over a planet's visible cap. */
function limbTexture() {
  if (limbTex) return limbTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.72, 'rgba(0,0,0,0.015)');
  g.addColorStop(0.88, 'rgba(0,0,0,0.05)');
  g.addColorStop(0.96, 'rgba(0,0,0,0.12)');
  g.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  limbTex = new THREE.CanvasTexture(cv);
  limbTex.colorSpace = THREE.SRGBColorSpace;
  return limbTex;
}

/* ------------------------------------------------------------------ */
/* Detail kit (used by every hull)                                     */
/* ------------------------------------------------------------------ */

/** A ring of small armour plates around the hull. */
function panelRing(bucket, key, { z, r, count = 10, w = 0.02, h = 0.02, d = 0.05, skip = 0.3 }) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.2;
    if (Math.abs(Math.cos(a)) < skip) continue; // keep the keel clean
    const x = Math.sin(a) * r;
    const y = Math.cos(a) * r;
    bucket.put(key, xf(new THREE.BoxGeometry(w, h, d), [x, y, z], [0, 0, -a]));
  }
}

/** RCS quad: dark base block with four tiny nozzles. */
function rcsQuad(bucket, L, x, y, z, rotZ = 0) {
  const s = L * 0.03;
  bucket.put('D', xf(new THREE.BoxGeometry(s * 1.6, s * 0.5, s * 1.1), [x, y, z], [0, 0, rotZ]));
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    bucket.put('N', xf(
      new THREE.CylinderGeometry(s * 0.2, s * 0.3, s * 0.5, 6, 1, true),
      [x + dx * s * 0.8, y + dy * s * 0.28, z],
      [Math.PI / 2, 0, 0],
    ));
  }
}

/** Vent: angled louvre strip. */
function vent(bucket, L, x, y, z, rotY = 0) {
  bucket.put('V', xf(new THREE.BoxGeometry(L * 0.05, L * 0.012, L * 0.018), [x, y, z], [0, rotY, 0.25]));
  bucket.put('V', xf(new THREE.BoxGeometry(L * 0.045, L * 0.012, L * 0.014), [x, y - L * 0.02, z], [0, rotY, 0.25]));
}

/** Antenna mast with a tip, optionally a dish. */
function antenna(bucket, L, x, y, z, h, dish = false) {
  bucket.put('D', xf(new THREE.CylinderGeometry(L * 0.005, L * 0.008, h, 6), [x, y + h * 0.5, z]));
  bucket.put('A', xf(new THREE.SphereGeometry(L * 0.008, 6, 5), [x, y + h, z]));
  if (dish) {
    bucket.put('L', xf(new THREE.SphereGeometry(L * 0.03, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.45), [x, y + h * 0.6, z], [Math.PI * 0.7, 0, 0], [1, 0.5, 1]));
  }
}

/** Small twin-barrel gun turret. */
function turret(bucket, L, x, y, z, scale = 1, rotY = 0) {
  const r = L * 0.055 * scale;
  bucket.put('D', xf(new THREE.CylinderGeometry(r * 0.9, r * 1.15, r * 0.6, 10), [x, y, z], [0, rotY, 0]));
  bucket.put('T', xf(new THREE.BoxGeometry(r * 1.1, r * 0.5, r * 1.3), [x, y + r * 0.4, z], [0, rotY, 0]));
  for (const s of [-1, 1]) {
    const bx = x + Math.cos(rotY) * s * r * 0.4;
    const bz = z - Math.sin(rotY) * s * r * 0.4;
    bucket.put('D', xf(new THREE.CylinderGeometry(L * 0.008, L * 0.009, r * 2.4, 6), [bx, y + r * 0.4, bz + r * 1.4], [Math.PI / 2, 0, 0]));
  }
  // heat fins
  for (let i = 0; i < 3; i++) {
    bucket.put('L', xf(new THREE.BoxGeometry(r * 0.16, r * 0.5, r * 0.5), [x + r * 1.0, y + r * 0.35, z + (i - 1) * r * 0.5], [0, 0, 0]));
  }
}

/**
 * Greeble cluster: mixed micro-parts along the upper hull.
 * Stays off the centreline so silhouettes stay clean.
 */
function greebles(bucket, L, R, rng, count) {
  const kinds = ['box', 'box', 'drum', 'dome', 'vent'];
  for (let i = 0; i < count; i++) {
    const s = rng() < 0.5 ? -1 : 1;
    const x = s * L * (0.05 + rng() * 0.09);
    const y = L * 0.015 + rng() * L * 0.045;
    const z = (rng() - 0.45) * L * 0.62;
    const kind = kinds[Math.floor(rng() * kinds.length)];
    const key = rng() < 0.72 ? 'D' : 'L';
    if (kind === 'box') {
      bucket.put(key, xf(new THREE.BoxGeometry(L * 0.02, L * 0.012, L * (0.02 + rng() * 0.035)), [x, y, z]));
    } else if (kind === 'drum') {
      bucket.put(key, xf(new THREE.CylinderGeometry(L * 0.009, L * 0.009, L * 0.022, 8), [x, y + L * 0.006, z], [0, 0, Math.PI / 2]));
    } else if (kind === 'dome') {
      bucket.put(key, xf(new THREE.SphereGeometry(L * 0.012, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), [x, y, z]));
    } else {
      bucket.put('V', xf(new THREE.BoxGeometry(L * 0.03, L * 0.008, L * 0.012), [x, y, z], [0, 0, s * 0.2]));
    }
  }
}

/** A row of lit window panes. */
function windowBand(bucket, L, x, y, z, rotY, panes, step, size = 0.014) {
  for (let i = 0; i < panes; i++) {
    const off = (i - (panes - 1) / 2) * step;
    bucket.put('A', xf(
      new THREE.BoxGeometry(L * size, L * size * 0.6, L * size * 0.35),
      [x + Math.cos(rotY) * off, y, z + Math.sin(rotY) * off],
      [0, rotY, 0],
    ));
  }
}

/** Circular airlock hatch set into a hull flank, with accent ring and hinge lugs. */
function hatch(bucket, L, x, y, z, side = 1, scale = 1) {
  const r = L * 0.02 * scale;
  bucket.put('D', xf(new THREE.CylinderGeometry(r, r * 1.06, L * 0.009, 10), [x, y, z], [0, 0, Math.PI / 2]));
  bucket.put('A', xf(new THREE.TorusGeometry(r * 1.16, r * 0.12, 6, 12), [x + side * L * 0.004, y, z], [0, Math.PI / 2, 0]));
  bucket.put('L', xf(new THREE.BoxGeometry(L * 0.004, r * 0.34, r * 2.0), [x, y + r * 1.3, z]));
  bucket.put('L', xf(new THREE.BoxGeometry(L * 0.004, r * 0.34, r * 0.7), [x, y - r * 1.6, z]));
}

/** Radiator bank: housing with stacked, canted heat-sink fins. side=±1. */
function radiator(bucket, L, x, y, z, side = 1, count = 4, scale = 1) {
  bucket.put('D', xf(new THREE.BoxGeometry(L * 0.014, L * 0.05 * scale, L * 0.11 * scale), [x, y, z]));
  for (let i = 0; i < count; i++) {
    const off = (i - (count - 1) / 2) * L * 0.022 * scale;
    bucket.put('L', xf(
      new THREE.BoxGeometry(L * 0.006, L * 0.032 * scale, L * 0.09 * scale),
      [x + side * L * 0.012, y + off, z],
      [0, 0, side * 0.4],
    ));
  }
}

/** Straight pipe run between two points, with end flanges. */
function pipe(bucket, L, p0, p1, r = 0.007, key = 'D') {
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const dz = p1[2] - p0[2];
  const len = Math.hypot(dx, dy, dz);
  const geo = new THREE.CylinderGeometry(L * r, L * r, len, 6);
  const dir = new THREE.Vector3(dx, dy, dz).normalize();
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
  geo.translate((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2);
  bucket.put(key, geo);
  for (const p of [p0, p1]) {
    bucket.put('L', xf(new THREE.SphereGeometry(L * r * 1.7, 6, 5), p));
  }
}

/** Missile battery: armoured pod with visible launch tubes facing +Z. */
function missilePod(bucket, L, x, y, z, tubes = 6, scale = 1, key = 'V') {
  const w = L * 0.08 * scale;
  const h = L * 0.05 * scale;
  const d = L * 0.1 * scale;
  bucket.put('T', xf(new THREE.BoxGeometry(w, h, d), [x, y, z]));
  bucket.put('A', xf(new THREE.BoxGeometry(w * 1.02, L * 0.006, d * 0.1), [x, y - h * 0.56, z + d * 0.28]));
  const cols = Math.ceil(tubes / 2);
  for (let i = 0; i < tubes; i++) {
    const c = i % cols;
    const row = i < cols ? 1 : -1;
    const ox = (c - (cols - 1) / 2) * w * 0.28;
    bucket.put(key, xf(new THREE.CylinderGeometry(L * 0.012 * scale, L * 0.012 * scale, h * 0.3, 8), [x + ox, y + row * h * 0.22, z + d * 0.46], [Math.PI / 2, 0, 0]));
    bucket.put('N', xf(new THREE.CylinderGeometry(L * 0.008 * scale, L * 0.0095 * scale, h * 0.24, 8), [x + ox, y + row * h * 0.22, z + d * 0.52], [Math.PI / 2, 0, 0]));
  }
}

/** Rows of raised armour plates along a hull flank. */
function plateBelt(bucket, L, x, y, z, side = 1, rows = 2, cols = 5, scale = 1, key = 'T') {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      bucket.put(key, xf(
        new THREE.BoxGeometry(L * 0.007 * scale, L * 0.026 * scale, L * 0.05 * scale),
        [x + side * r * L * 0.006, y + (r - (rows - 1) / 2) * L * 0.032 * scale, z + (c - (cols - 1) / 2) * L * 0.058 * scale],
        [0, 0, side * 0.06],
      ));
    }
  }
}

/** Sensor mast with dish and phased-array plate. */
function sensorArray(bucket, L, x, y, z, h = 0.26, dishes = true) {
  bucket.put('D', xf(new THREE.CylinderGeometry(L * 0.006, L * 0.009, L * h, 8), [x, y + L * h * 0.5, z]));
  bucket.put('A', xf(new THREE.SphereGeometry(L * 0.011, 8, 6), [x, y + L * h, z]));
  if (dishes) {
    bucket.put('L', xf(new THREE.SphereGeometry(L * 0.034, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), [x, y + L * h * 0.55, z - L * 0.03], [Math.PI * 0.55, 0, 0], [1, 0.55, 1]));
    bucket.put('D', xf(new THREE.CylinderGeometry(L * 0.004, L * 0.004, L * 0.05, 6), [x, y + L * h * 0.45, z], [Math.PI / 2 - 0.3, 0, 0]));
  }
  bucket.put('D', xf(new THREE.BoxGeometry(L * 0.03, L * 0.008, L * 0.05), [x, y + L * h * 0.24, z + L * 0.045]));
  bucket.put('A', xf(new THREE.BoxGeometry(L * 0.024, L * 0.004, L * 0.04), [x, y + L * h * 0.24, z + L * 0.047]));
}

/** Small hull clutter on the flanks — clamps, tank drums, service boxes. */
function hullClutter(bucket, L, R, rng, count) {
  for (let i = 0; i < count; i++) {
    const s = rng() < 0.5 ? -1 : 1;
    const x = s * R * (0.55 + rng() * 0.4);
    const y = (rng() - 0.5) * L * 0.06;
    const z = (rng() - 0.5) * L * 0.7;
    const kind = rng();
    if (kind < 0.4) {
      bucket.put('D', xf(new THREE.BoxGeometry(L * 0.02, L * 0.012, L * 0.03), [x, y, z], [0, 0, s * 0.1]));
    } else if (kind < 0.7) {
      bucket.put('L', xf(new THREE.CylinderGeometry(L * 0.011, L * 0.011, L * 0.05, 8), [x, y, z], [Math.PI / 2, 0, 0]));
    } else {
      bucket.put('T', xf(new THREE.BoxGeometry(L * 0.014, L * 0.02, L * 0.02), [x, y, z]));
      bucket.put('A', xf(new THREE.BoxGeometry(L * 0.015, L * 0.006, L * 0.008), [x, y + L * 0.008, z]));
    }
  }
}

/* ------------------------------------------------------------------ */
/* Fitted equipment (weapons + outfit modules)                         */
/* ------------------------------------------------------------------ */

/** A weapon in a hardpoint: shared pivot, then class-specific barrels. */
function fittedWeapon(bucket, L, w, x, y, z) {
  const kind = w?.kind || 'laser';
  const heavy = w?.size === 'heavy';
  // mount base + pivot yoke
  bucket.put('D', xf(new THREE.BoxGeometry(L * 0.034, L * 0.016, L * 0.05), [x, y, z]));
  bucket.put('T', xf(new THREE.CylinderGeometry(L * 0.013, L * 0.016, L * 0.026, 8), [x, y + L * 0.018, z]));
  if (kind === 'missile') {
    // launch pod with visible tube mouths
    const pw = heavy ? L * 0.14 : L * 0.1;
    const ph = heavy ? L * 0.06 : L * 0.05;
    const pd = heavy ? L * 0.2 : L * 0.15;
    const py = y + L * 0.05;
    const pz = z + pd * 0.4;
    bucket.put('T', xf(new THREE.BoxGeometry(pw, ph, pd), [x, py, pz]));
    bucket.put('A', xf(new THREE.BoxGeometry(pw * 1.02, L * 0.006, pd * 0.12), [x, py - ph * 0.5, pz]));
    const cols = heavy ? 3 : 2;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < 2; r++) {
        const ox = (c - (cols - 1) / 2) * pw * 0.28;
        const oy = (r - 0.5) * ph * 0.44;
        bucket.put('V', xf(new THREE.CylinderGeometry(L * 0.011, L * 0.011, L * 0.012, 8), [x + ox, py + oy, pz + pd * 0.5], [Math.PI / 2, 0, 0]));
        bucket.put('N', xf(new THREE.CylinderGeometry(L * 0.007, L * 0.008, L * 0.02, 8), [x + ox, py + oy, pz + pd * 0.53], [Math.PI / 2, 0, 0]));
      }
    }
    return;
  }
  const laser = kind === 'laser';
  const r = heavy ? L * 0.024 : L * 0.012;
  const len = heavy ? L * 0.4 : L * 0.24;
  const barrels = w?.twin ? [-1, 1] : [0];
  for (const b of barrels) {
    const bx = x + b * r * 1.5;
    const by = y + (heavy ? L * 0.032 : L * 0.024);
    const bz = z + len * 0.52;
    if (laser) {
      bucket.put('T', xf(new THREE.CylinderGeometry(r, r * 1.12, len, 8), [bx, by, bz], [Math.PI / 2, 0, 0]));
      bucket.put('D', xf(new THREE.CylinderGeometry(r * 0.6, r * 0.6, len * 0.16, 8), [bx, by, bz + len * 0.56], [Math.PI / 2, 0, 0]));
      bucket.put('A', xf(new THREE.TorusGeometry(r * 0.72, r * 0.2, 6, 10), [bx, by, bz + len * 0.6]));
      bucket.put('L', xf(new THREE.BoxGeometry(r * 0.5, r * 0.5, len * 0.4), [bx, by + r * 1.2, bz - len * 0.1]));
    } else {
      // kinetic: blocky barrel, side magazine, cooling rings, muzzle
      bucket.put('T', xf(new THREE.BoxGeometry(r * 2.1, r * 1.7, len), [bx, by, bz]));
      bucket.put('D', xf(new THREE.CylinderGeometry(r * 1.15, r * 1.15, len * 0.1, 8), [bx + r * 1.5, by - r * 0.35, bz + len * 0.2], [Math.PI / 2, 0, 0]));
      for (let i = 0; i < (heavy ? 3 : 2); i++) {
        bucket.put('L', xf(new THREE.BoxGeometry(r * 2.4, r * 0.22, r * 0.5), [bx, by, bz + len * (0.05 + i * 0.22)]));
      }
      bucket.put('N', xf(new THREE.CylinderGeometry(r * 0.8, r * 0.9, r * (heavy ? 2.6 : 1.8), 6), [bx, by, bz + len * 0.56], [Math.PI / 2, 0, 0]));
    }
  }
}

/** An owned-but-empty hardpoint: pylon and open socket. */
function emptyPylon(bucket, L, x, y, z) {
  bucket.put('D', xf(new THREE.BoxGeometry(L * 0.03, L * 0.014, L * 0.045), [x, y, z]));
  bucket.put('T', xf(new THREE.CylinderGeometry(L * 0.012, L * 0.015, L * 0.024, 8), [x, y + L * 0.016, z]));
  bucket.put('V', xf(new THREE.BoxGeometry(L * 0.02, L * 0.012, L * 0.026), [x, y + L * 0.03, z]));
}

/** Visible modules for fitted outfits, aggregated by the stat they modify. */
function equipModules(bucket, L, R, outfits) {
  const u = {};
  for (const [id, lvl] of Object.entries(outfits || {})) {
    const o = OUTFIT_BY_ID[id];
    if (!o || !lvl) continue;
    if (o.stat) u[o.stat] = (u[o.stat] || 0) + lvl;
    if (o.add2?.stat) u[o.add2.stat] = (u[o.add2.stat] || 0) + lvl;
  }
  // armour plating: extra belts + a bow glacis per level
  const armour = Math.min(3, u.hull || 0);
  for (let i = 0; i < armour; i++) {
    const yy = -R * 0.15 + i * R * 0.42;
    for (const s of [-1, 1]) {
      for (let c = 0; c < 4; c++) {
        bucket.put('T', xf(new THREE.BoxGeometry(L * 0.008, L * 0.03, L * 0.07), [s * R * 0.98, yy, L * (0.3 - c * 0.17)], [0, 0, s * 0.05]));
      }
    }
    bucket.put('T', xf(new THREE.BoxGeometry(R * 0.7, R * 0.16, L * 0.05), [0, R * 0.2, L * 0.42], [0.5, 0, 0]));
  }
  // shield boosters: emitter nodes around the waist
  const nodes = Math.min(5, u.shield || 0);
  const nodeSpots = [
    [-R * 1.02, R * 0.2, L * 0.12], [R * 1.02, R * 0.2, L * 0.12],
    [-R * 1.0, R * 0.1, -L * 0.24], [R * 1.0, R * 0.1, -L * 0.24],
    [0, R * 1.06, -L * 0.06],
  ];
  for (let i = 0; i < nodes; i++) {
    const [ex, ey, ez] = nodeSpots[i];
    bucket.put('D', xf(new THREE.CylinderGeometry(L * 0.014, L * 0.018, L * 0.03, 8), [ex, ey, ez]));
    bucket.put('A', xf(new THREE.SphereGeometry(L * 0.016, 8, 6), [ex, ey + L * 0.02, ez]));
    bucket.put('L', xf(new THREE.TorusGeometry(L * 0.018, L * 0.004, 6, 10), [ex, ey + L * 0.02, ez], [Math.PI / 2, 0, 0]));
  }
  // shield flow regulators: conduit runs with coil rings
  const flow = Math.min(4, u.shieldRegen || 0);
  for (let i = 0; i < flow; i++) {
    const s = i % 2 ? 1 : -1;
    const z0 = L * (0.28 - i * 0.14);
    pipe(bucket, L, [s * R * 0.92, R * 0.42, z0], [s * R * 0.95, -R * 0.35, z0 - L * 0.22], 0.006);
    bucket.put('A', xf(new THREE.TorusGeometry(L * 0.02, L * 0.005, 6, 10), [s * R * 0.94, R * 0.05, z0 - L * 0.1]));
  }
  // capacitor banks: lit domes along the spine
  const cap = Math.min(4, u.energy || 0);
  for (let i = 0; i < cap; i++) {
    const cz = L * (0.26 - i * 0.16);
    bucket.put('D', xf(new THREE.CylinderGeometry(L * 0.02, L * 0.024, L * 0.02, 8), [0, R * 0.86, cz]));
    bucket.put('A', xf(new THREE.SphereGeometry(L * 0.018, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), [0, R * 0.88, cz]));
  }
  // auxiliary dynamo: heat-fin stacks on the aft spine
  const dyn = Math.min(3, u.energyRegen || 0);
  for (let i = 0; i < dyn; i++) {
    const dz = -L * (0.16 + i * 0.13);
    radiator(bucket, L, -R * 0.3, R * 0.85, dz, 1, 3, 0.65);
    radiator(bucket, L, R * 0.3, R * 0.85, dz, -1, 3, 0.65);
  }
  // engine tune: extra nozzles aft + intake fins forward
  const eng = Math.min(3, Math.max(u.accel || 0, u.maxSpeed || 0));
  for (let i = 0; i < eng; i++) {
    const s = i % 2 ? 1 : -1;
    const ex = s * R * 0.85;
    const ey = -R * 0.1 - i * L * 0.02;
    bucket.put('N', xf(new THREE.CylinderGeometry(L * 0.02, L * 0.026, L * 0.06, 8), [ex, ey, -L * 0.52], [Math.PI / 2, 0, 0]));
    bucket.put('T', xf(new THREE.BoxGeometry(L * 0.03, L * 0.03, L * 0.08), [ex, ey, -L * 0.45]));
    bucket.put('A', xf(new THREE.TorusGeometry(L * 0.021, L * 0.004, 6, 10), [ex, ey, -L * 0.49]));
    bucket.put('L', xf(new THREE.BoxGeometry(L * 0.012, L * 0.05, L * 0.1), [ex, R * 0.12, L * 0.3], [0, 0, s * 0.3]));
  }
  // maneuvering thrusters: high-authority retro quads forward
  const retro = Math.min(3, u.brake || 0);
  for (let i = 0; i < retro; i++) {
    const s = i % 2 ? 1 : -1;
    rcsQuad(bucket, L, s * R * 0.95, -R * 0.2, L * (0.36 - i * 0.16));
  }
  // inertial gyros: gyro drums on the belly
  const gyro = Math.min(2, u.turn || 0);
  for (let i = 0; i < gyro; i++) {
    const s = i ? 1 : -1;
    bucket.put('D', xf(new THREE.BoxGeometry(L * 0.05, L * 0.02, L * 0.05), [s * R * 0.55, -R * 0.82, L * 0.02]));
    bucket.put('L', xf(new THREE.CylinderGeometry(L * 0.03, L * 0.03, L * 0.018, 10), [s * R * 0.55, -R * 0.87, L * 0.02], [0.3, 0, 0]));
    bucket.put('A', xf(new THREE.TorusGeometry(L * 0.024, L * 0.005, 6, 10), [s * R * 0.55, -R * 0.89, L * 0.02], [Math.PI / 2 - 0.3, 0, 0]));
  }
  // cargo pods: strapped containers on the flanks
  const pods = Math.min(3, u.cargo || 0);
  for (let i = 0; i < pods; i++) {
    for (const s of [-1, 1]) {
      const pz = L * (0.1 - i * 0.18);
      bucket.put('D', xf(new THREE.BoxGeometry(L * 0.06, L * 0.05, L * 0.16), [s * R * 1.15, -R * 0.25, pz]));
      bucket.put('L', xf(new THREE.BoxGeometry(L * 0.064, L * 0.008, L * 0.03), [s * R * 1.15, -R * 0.2, pz]));
      bucket.put('A', xf(new THREE.BoxGeometry(L * 0.062, L * 0.006, L * 0.14), [s * R * 1.15, -R * 0.27, pz]));
    }
  }
  // lumen tanks: belly drums
  const tanks = Math.min(3, u.lumenMax || 0);
  for (let i = 0; i < tanks; i++) {
    const tz = L * (0.18 - i * 0.16);
    bucket.put('L', xf(new THREE.CylinderGeometry(L * 0.026, L * 0.026, L * 0.14, 10), [0, -R * 0.9, tz], [Math.PI / 2, 0, 0]));
    bucket.put('A', xf(new THREE.TorusGeometry(L * 0.027, L * 0.005, 6, 10), [0, -R * 0.9, tz + L * 0.07]));
  }
  // sensor array: mast dish cluster
  const sens = Math.min(2, u.radar || 0);
  for (let i = 0; i < sens; i++) {
    antenna(bucket, L, (i ? -1 : 1) * R * 0.32, R * 0.7, -L * (0.08 + i * 0.08), L * (0.22 + i * 0.08), true);
  }
  // repair drones: launch tubes + drone carriers at the stern
  const drones = Math.min(3, u.armorRegen || 0);
  for (let i = 0; i < drones; i++) {
    for (const s of [-1, 1]) {
      const dz = -L * (0.42 - i * 0.07);
      bucket.put('D', xf(new THREE.BoxGeometry(L * 0.03, L * 0.02, L * 0.03), [s * R * 0.6, R * 0.52, dz]));
      bucket.put('N', xf(new THREE.CylinderGeometry(L * 0.012, L * 0.014, L * 0.05, 6), [s * R * 0.6, R * 0.45, dz], [Math.PI / 2, 0, 0]));
    }
  }
  // docking bays: ventral bay modules with lit door frames
  const bays = Math.min(3, u.bays || 0);
  for (let i = 0; i < bays; i++) {
    const bz = L * (0.08 - i * 0.2);
    bucket.put('D', xf(new THREE.BoxGeometry(R * 0.9, R * 0.3, L * 0.16), [0, -R * 0.95, bz]));
    bucket.put('A', xf(new THREE.BoxGeometry(R * 0.94, R * 0.05, L * 0.13), [0, -R * 1.02, bz]));
    bucket.put('L', xf(new THREE.BoxGeometry(R * 0.06, R * 0.26, L * 0.15), [R * 0.42, -R * 0.95, bz]));
    bucket.put('L', xf(new THREE.BoxGeometry(R * 0.06, R * 0.26, L * 0.15), [-R * 0.42, -R * 0.95, bz]));
  }
  // fleet command uplink: command masts at the stern
  const fleet = Math.min(2, u.fleetSlots || 0);
  for (let i = 0; i < fleet; i++) {
    antenna(bucket, L, (i ? 1 : -1) * R * 0.4, R * 0.6, -L * 0.34, L * (0.3 - i * 0.06), false);
    bucket.put('A', xf(new THREE.BoxGeometry(L * 0.01, L * 0.02, L * 0.02), [(i ? 1 : -1) * R * 0.4, R * 0.72, -L * 0.34]));
  }
  // auto-tracking computer: fire-control dome at the bow
  if ((outfits?.targeting || 0) > 0) {
    bucket.put('D', xf(new THREE.CylinderGeometry(L * 0.02, L * 0.024, L * 0.02, 8), [0, R * 0.55, L * 0.3]));
    bucket.put('A', xf(new THREE.SphereGeometry(L * 0.014, 8, 6), [0, R * 0.57, L * 0.3]));
    bucket.put('L', xf(new THREE.BoxGeometry(L * 0.012, L * 0.012, L * 0.05), [0, R * 0.56, L * 0.34]));
  }
}

/* ------------------------------------------------------------------ */
/* Ships                                                               */
/* ------------------------------------------------------------------ */

export function buildShip(def, { accent = 0x9fd8ff, isPlayer = false, loadout = null } = {}) {
  const L = def.len;
  const bucket = new PartBucket();
  const accentHex = new THREE.Color(accent).getHex();
  const engineGlows = [];
  const engineDiscMats = [];
  const navLights = [];
  const group = new THREE.Group();

  const materials = new Map([
    ['H', hullMat(def.color)],
    ['T', plateMat(new THREE.Color(def.color).multiplyScalar(0.68).getHex())],
    ['L', lightMat()],
    ['D', darkMat()],
    ['V', ventMat()],
    ['A', accentMat(accentHex)],
    ['G', glassMat()],
    ['N', nozzleMat()],
  ]);

  const addEngineCluster = (positions, r, len, glowScale = 1, flared = false) => {
    for (const [x, y, z] of positions) {
      // bell + outer ring + fins
      bucket.put('N', xf(engineBell(r, len), [x, y, z]));
      bucket.put('T', xf(new THREE.TorusGeometry(r * 1.02, r * 0.14, 6, 14), [x, y, z - len * 0.42], [0, 0, 0]));
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        bucket.put('L', xf(
          new THREE.BoxGeometry(r * 0.12, r * 0.7, len * 0.5),
          [x + Math.cos(a) * r * 1.15, y + Math.sin(a) * r * 1.15, z - len * 0.1],
          [0, 0, a],
        ));
      }
      // inner throat + injector glow
      bucket.put('D', xf(new THREE.CylinderGeometry(r * 0.64, r * 0.5, len * 1.1, 8), [x, y, z - len * 0.04]));
      if (flared) bucket.put('L', xf(new THREE.TorusGeometry(r * 0.8, r * 0.08, 6, 14), [x, y, z - len * 0.52]));
      const disc = new THREE.Mesh(engineDisc(r * 0.92), new THREE.MeshBasicMaterial({
        color: 0x8fe2ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      disc.position.set(x, y, z - len * 0.55);
      disc.renderOrder = 2;
      engineDiscMats.push(disc.material);
      group.add(disc);
      const glow = glowSprite(0x7fd8ff, r * 9 * glowScale);
      glow.position.set(x, y, z - len * 0.95);
      glow.material.opacity = 0.2;
      engineGlows.push({ spr: glow, base: r * 9 * glowScale });
      group.add(glow);
    }
  };

  const addRunningLight = (color, x, y, z, size) => {
    const spr = glowSprite(color, size);
    spr.position.set(x, y, z);
    spr.material.opacity = 0.85;
    navLights.push({ spr, base: size, phase: Math.random() * Math.PI * 2 });
    group.add(spr);
  };

  /** Small vernier thrusters beside the main cluster. */
  const addVerniers = (positions, r) => {
    for (const [x, y, z] of positions) {
      bucket.put('N', xf(engineBell(r, L * 0.05), [x, y, z]));
      bucket.put('D', xf(new THREE.CylinderGeometry(r * 0.6, r * 0.5, L * 0.05, 6), [x, y, z]));
    }
  };

  const rng = tinyRng(hashStr(def.id) ^ Math.round(def.len * 131));

  const hardpoints = [];
  let hullR = def.len * 0.13;

  switch (def.shape) {
    /* ------------------------------------ Wayfarer cutter (sleek scout) */
    case 'cutter': {
      const R = L * 0.082;
      hullR = R;
      // weapon hardpoints: wing pair, spine, outer-wing pair
      hardpoints.push(
        [-L * 0.3, -R * 0.05, L * 0.02],
        [L * 0.3, -R * 0.05, L * 0.02],
        [0, R * 0.72, -L * 0.02],
        [-L * 0.5, -R * 0.12, -L * 0.12],
        [L * 0.5, -R * 0.12, -L * 0.12],
      );
      // long slim blade hull with a needle nose
      bucket.put('H', fuselage(L, R, 16, [
        [0, 0.44], [0.08, 0.68], [0.2, 0.9], [0.36, 1.0], [0.52, 1.0], [0.66, 0.86], [0.78, 0.6], [0.89, 0.32], [0.97, 0.12], [1, 0],
      ], 0.62));
      // dorsal blade spine running most of the hull
      bucket.put('T', xf(finPlate(L * 0.52, R * 0.72, R * 0.2, L * 0.12), [0, R * 0.5, -L * 0.1]));
      bucket.put('A', xf(new THREE.BoxGeometry(R * 0.06, R * 0.2, L * 0.5), [0, R * 0.62, -L * 0.1]));
      // needle nose: lance cone, pitot mast, sensor cap
      bucket.put('T', xf(new THREE.ConeGeometry(R * 0.3, L * 0.24, 10), [0, 0, L * 0.57], [Math.PI / 2, 0, 0]));
      bucket.put('D', xf(new THREE.CylinderGeometry(L * 0.0035, L * 0.0045, L * 0.2, 6), [0, 0, L * 0.76], [Math.PI / 2, 0, 0]));
      bucket.put('A', xf(new THREE.SphereGeometry(L * 0.008, 6, 5), [0, 0, L * 0.86]));
      // long low canopy with frame ribs + dorsal fairing behind
      bucket.put('G', xf(new THREE.SphereGeometry(R * 0.46, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), [0, R * 0.5, L * 0.24], [0, 0, 0], [1, 0.55, 2.6]));
      for (let i = 0; i < 4; i++) {
        bucket.put('D', xf(new THREE.BoxGeometry(R * 1.0, R * 0.016, R * 0.07), [0, R * 0.6, L * (0.1 + i * 0.075)]));
      }
      bucket.put('T', xf(new THREE.BoxGeometry(R * 0.5, R * 0.24, L * 0.1), [0, R * 0.58, L * 0.01]));
      // slim swept wings: leading slats, trailing ailerons, canted winglets
      bucket.put('H', xf(wingPlate(L * 0.64, L * 0.46, L * 0.14, L * 0.26, L * 0.036), [0, -R * 0.16, -L * 0.04]));
      for (const s of [-1, 1]) {
        bucket.put('L', xf(new THREE.BoxGeometry(L * 0.26, L * 0.006, L * 0.028), [s * L * 0.4, R * 0.06, L * 0.08], [0, s * 0.34, 0]));
        bucket.put('L', xf(new THREE.BoxGeometry(L * 0.2, L * 0.005, L * 0.02), [s * L * 0.46, -R * 0.2, -L * 0.2], [0, s * 0.3, 0]));
        // wingtip pod + canted winglet + nav lens + stub barrel
        bucket.put('T', xf(new THREE.CylinderGeometry(L * 0.014, L * 0.018, L * 0.24, 8), [s * L * 0.62, -R * 0.1, -L * 0.2], [Math.PI / 2, 0, 0]));
        bucket.put('H', xf(finPlate(L * 0.14, L * 0.09, L * 0.016, L * 0.05), [s * L * 0.62, -R * 0.1, -L * 0.3], [0, 0, -s * 0.55]));
        bucket.put('A', xf(new THREE.BoxGeometry(L * 0.006, L * 0.02, L * 0.1), [s * L * 0.625, -R * 0.02, -L * 0.28], [0, 0, -s * 0.55]));
        bucket.put('D', xf(new THREE.CylinderGeometry(L * 0.006, L * 0.006, L * 0.2, 6), [s * L * 0.63, -R * 0.16, -L * 0.14], [Math.PI / 2, 0, 0]));
        vent(bucket, L, s * R * 0.6, R * 0.3, -L * 0.02, s * 0.5);
      }
      // twin canted tail fins + ventral keel blade + skew fins
      for (const s of [-1, 1]) {
        bucket.put('H', xf(finPlate(L * 0.16, L * 0.13, L * 0.02, L * 0.07), [s * L * 0.09, R * 0.3, -L * 0.4], [0, 0, -s * 0.22]));
        bucket.put('A', xf(new THREE.BoxGeometry(L * 0.005, L * 0.02, L * 0.09), [s * L * 0.09, R * 0.42, -L * 0.4], [0, 0, -s * 0.22]));
        bucket.put('H', xf(finPlate(L * 0.12, L * 0.07, L * 0.016, L * 0.05), [s * L * 0.1, -R * 0.5, -L * 0.36], [0, 0, s * 0.9]));
      }
      bucket.put('T', xf(new THREE.BoxGeometry(R * 0.18, R * 0.7, L * 0.3), [0, -R * 0.85, -L * 0.1]));
      // hull dressing: armour belts, seam, hatches, radiators, spine lights
      plateBelt(bucket, L, R * 0.9, R * 0.1, L * 0.12, 1, 2, 4, 1);
      plateBelt(bucket, L, -R * 0.9, R * 0.1, L * 0.12, -1, 2, 4, 1);
      bucket.put('D', xf(new THREE.BoxGeometry(R * 0.05, R * 0.5, L * 0.5), [0, -R * 0.6, L * 0.02]));
      hatch(bucket, L, R * 0.88, -R * 0.05, -L * 0.18, 1, 0.9);
      hatch(bucket, L, -R * 0.88, -R * 0.05, -L * 0.18, -1, 0.9);
      radiator(bucket, L, R * 0.78, R * 0.34, -L * 0.32, 1, 3, 0.85);
      radiator(bucket, L, -R * 0.78, R * 0.34, -L * 0.32, -1, 3, 0.85);
      panelRing(bucket, 'L', { z: -L * 0.28, r: R * 0.8, count: 9, w: L * 0.016, h: L * 0.01, d: L * 0.045 });
      for (let i = 0; i < 4; i++) {
        bucket.put(i % 2 ? 'A' : 'D', xf(new THREE.BoxGeometry(R * 0.95, L * 0.01, L * 0.018), [0, R * 0.42, L * (0.32 - i * 0.1)]));
      }
      rcsQuad(bucket, L, -R * 0.78, R * 0.18, L * 0.3);
      rcsQuad(bucket, L, R * 0.78, R * 0.18, L * 0.3);
      rcsQuad(bucket, L, -R * 0.9, -R * 0.1, -L * 0.36);
      rcsQuad(bucket, L, R * 0.9, -R * 0.1, -L * 0.36);
      greebles(bucket, L, R, rng, 26);
      hullClutter(bucket, L, R, rng, 10);
      sensorArray(bucket, L, R * 0.4, R * 0.5, L * 0.06, 0.14, false);
      antenna(bucket, L, -R * 0.45, R * 0.5, -L * 0.2, L * 0.16, false);
      // engines: central main bell + slim nacelles with intake lips and heat vanes
      addEngineCluster([[0, 0, -L * 0.5 - L * 0.03]], R * 0.7, L * 0.14, 1.15, true);
      for (const s of [-1, 1]) {
        bucket.put('T', xf(new THREE.CylinderGeometry(L * 0.036, L * 0.03, L * 0.3, 10), [s * L * 0.115, -R * 0.2, -L * 0.38], [Math.PI / 2, 0, 0]));
        bucket.put('A', xf(new THREE.TorusGeometry(L * 0.036, L * 0.006, 6, 14), [s * L * 0.115, -R * 0.2, -L * 0.23]));
        bucket.put('D', xf(new THREE.CylinderGeometry(L * 0.022, L * 0.026, L * 0.06, 8), [s * L * 0.115, -R * 0.2, -L * 0.2], [Math.PI / 2, 0, 0]));
        bucket.put('D', xf(new THREE.BoxGeometry(L * 0.008, R * 0.5, L * 0.05), [s * L * 0.115, -R * 0.05, -L * 0.36]));
        addEngineCluster([[s * L * 0.115, -R * 0.2, -L * 0.53]], R * 0.4, L * 0.1, 0.9);
      }
      addVerniers([[-R * 0.8, R * 0.1, -L * 0.46], [R * 0.8, R * 0.1, -L * 0.46]], R * 0.22);
      addRunningLight(0xff5566, -L * 0.63, -R * 0.1, -L * 0.16, L * 0.09);
      addRunningLight(0x55ff88, L * 0.63, -R * 0.1, -L * 0.16, L * 0.09);
      addRunningLight(0xffffff, 0, R * 0.75, L * 0.02, L * 0.06);
      break;
    }

    /* --------------------------------------- Sparrowhawk interceptor */
    case 'sloop': {
      const R = L * 0.105;
      hullR = R;
      // weapon hardpoints: wing pair, spine, wingtip pair
      hardpoints.push(
        [-L * 0.3, -R * 0.02, L * 0.04],
        [L * 0.3, -R * 0.02, L * 0.04],
        [0, R * 0.66, -L * 0.02],
        [-L * 0.52, -R * 0.08, -L * 0.08],
        [L * 0.52, -R * 0.08, -L * 0.08],
      );
      // dart hull with drawn-out nose
      bucket.put('H', fuselage(L, R, 16, [
        [0, 0.56], [0.1, 0.76], [0.26, 0.94], [0.44, 1.0], [0.6, 0.94], [0.74, 0.72], [0.87, 0.4], [1, 0],
      ]));
      // nose lance + pitot + sensor cap
      bucket.put('T', xf(new THREE.ConeGeometry(R * 0.2, L * 0.3, 8), [0, 0, L * 0.52], [Math.PI / 2, 0, 0]));
      bucket.put('D', xf(new THREE.CylinderGeometry(L * 0.003, L * 0.004, L * 0.16, 6), [0, 0, L * 0.72], [Math.PI / 2, 0, 0]));
      bucket.put('A', xf(new THREE.SphereGeometry(L * 0.011, 6, 5), [0, 0, L * 0.8]));
      // canards: forward trimming fins with lit edges
      bucket.put('H', xf(wingPlate(L * 0.22, L * 0.14, L * 0.07, L * 0.04, L * 0.022), [0, R * 0.12, L * 0.34]));
      for (const s of [-1, 1]) {
        bucket.put('A', xf(new THREE.BoxGeometry(L * 0.08, L * 0.005, L * 0.014), [s * L * 0.12, R * 0.18, L * 0.3], [0, 0, s * 0.25]));
      }
      // canopy with frame + dorsal fairing
      bucket.put('G', xf(new THREE.SphereGeometry(R * 0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), [0, R * 0.42, L * 0.12], [0, 0, 0], [1, 0.68, 2.2]));
      for (let i = 0; i < 4; i++) {
        bucket.put('D', xf(new THREE.BoxGeometry(R * 1.1, R * 0.018, R * 0.08), [0, R * 0.58, L * (0.02 + i * 0.07)]));
      }
      bucket.put('A', xf(new THREE.BoxGeometry(R * 0.4, R * 0.05, L * 0.1), [0, R * 0.72, -L * 0.02]));
      // delta wings: slats, ailerons, root intake scoops, wingtip batteries
      bucket.put('H', xf(wingPlate(L * 0.74, L * 0.5, L * 0.24, L * 0.24, L * 0.046), [0, -R * 0.05, -L * 0.04]));
      for (const s of [-1, 1]) {
        bucket.put('L', xf(new THREE.BoxGeometry(L * 0.3, L * 0.006, L * 0.03), [s * L * 0.42, R * 0.06, L * 0.1], [0, s * 0.36, 0]));
        bucket.put('L', xf(new THREE.BoxGeometry(L * 0.24, L * 0.005, L * 0.022), [s * L * 0.5, -R * 0.14, -L * 0.24], [0, s * 0.3, 0]));
        // root intake scoop: dark mouth, accent lip, splitter
        bucket.put('D', xf(new THREE.BoxGeometry(L * 0.06, L * 0.045, L * 0.09), [s * L * 0.16, -R * 0.28, L * 0.04]));
        bucket.put('V', xf(new THREE.BoxGeometry(L * 0.05, L * 0.035, L * 0.02), [s * L * 0.16, -R * 0.28, L * 0.1]));
        bucket.put('A', xf(new THREE.BoxGeometry(L * 0.062, L * 0.006, L * 0.08), [s * L * 0.16, -R * 0.24, L * 0.05]));
        // underwing missile rail + pylon + seeker tip
        bucket.put('D', xf(new THREE.BoxGeometry(L * 0.014, L * 0.02, L * 0.16), [s * L * 0.44, -R * 0.28, L * 0.02]));
        bucket.put('L', xf(new THREE.BoxGeometry(L * 0.02, L * 0.012, L * 0.14), [s * L * 0.44, -R * 0.34, L * 0.02]));
        bucket.put('N', xf(new THREE.ConeGeometry(L * 0.012, L * 0.05, 6), [s * L * 0.44, -R * 0.3, L * 0.12], [Math.PI / 2, 0, 0]));
        // wingtip pod + cannon + cooling fins + tip fin + nav lens
        bucket.put('T', xf(new THREE.BoxGeometry(L * 0.045, L * 0.03, L * 0.18), [s * L * 0.66, 0, -L * 0.14]));
        bucket.put('D', xf(new THREE.CylinderGeometry(L * 0.016, L * 0.02, L * 0.46, 8), [s * L * 0.68, -L * 0.01, L * 0.06], [Math.PI / 2, 0, 0]));
        for (let i = 0; i < 3; i++) {
          bucket.put('L', xf(new THREE.BoxGeometry(L * 0.008, L * 0.03, L * 0.04), [s * L * 0.68, L * 0.015, L * (0.1 + i * 0.05)]));
        }
        bucket.put('H', xf(finPlate(L * 0.12, L * 0.08, L * 0.014, L * 0.045), [s * L * 0.66, L * 0.015, -L * 0.26], [0, 0, -s * 0.5]));
        bucket.put('A', xf(new THREE.BoxGeometry(L * 0.05, L * 0.006, L * 0.16), [s * L * 0.66, L * 0.018, -L * 0.14]));
        vent(bucket, L, s * R * 0.62, R * 0.16, -L * 0.1, s * 0.6);
      }
      // twin canted tails with actuator fairings + spine fin
      for (const s of [-1, 1]) {
        bucket.put('H', xf(finPlate(L * 0.18, L * 0.2, L * 0.025, L * 0.11), [s * L * 0.16, R * 0.35, -L * 0.32], [0, 0, -s * 0.28]));
        bucket.put('A', xf(new THREE.BoxGeometry(L * 0.007, L * 0.03, L * 0.1), [s * L * 0.16, R * 0.5, -L * 0.32], [0, 0, -s * 0.28]));
        bucket.put('D', xf(new THREE.BoxGeometry(L * 0.02, L * 0.05, L * 0.08), [s * L * 0.14, R * 0.28, -L * 0.34], [0, 0, -s * 0.28]));
      }
      bucket.put('T', xf(new THREE.BoxGeometry(R * 0.5, R * 0.3, L * 0.3), [0, R * 0.5, -L * 0.06]));
      bucket.put('A', xf(new THREE.BoxGeometry(R * 1.08, L * 0.012, L * 0.3), [0, R * 0.42, -L * 0.02]));
      // armour belts, hatches, radiators, panels
      plateBelt(bucket, L, R * 0.9, R * 0.05, L * 0.14, 1, 2, 3, 0.9);
      plateBelt(bucket, L, -R * 0.9, R * 0.05, L * 0.14, -1, 2, 3, 0.9);
      hatch(bucket, L, R * 0.86, -R * 0.1, -L * 0.16, 1, 0.85);
      hatch(bucket, L, -R * 0.86, -R * 0.1, -L * 0.16, -1, 0.85);
      radiator(bucket, L, R * 0.72, R * 0.28, -L * 0.26, 1, 3, 0.8);
      radiator(bucket, L, -R * 0.72, R * 0.28, -L * 0.26, -1, 3, 0.8);
      panelRing(bucket, 'L', { z: L * 0.06, r: R * 0.86, count: 9, w: L * 0.016, h: L * 0.01, d: L * 0.045 });
      panelRing(bucket, 'L', { z: -L * 0.24, r: R * 0.84, count: 9, w: L * 0.016, h: L * 0.01, d: L * 0.04 });
      rcsQuad(bucket, L, -R * 0.8, R * 0.2, L * 0.32);
      rcsQuad(bucket, L, R * 0.8, R * 0.2, L * 0.32);
      rcsQuad(bucket, L, -R * 0.9, -R * 0.05, -L * 0.34);
      rcsQuad(bucket, L, R * 0.9, -R * 0.05, -L * 0.34);
      greebles(bucket, L, R, rng, 30);
      hullClutter(bucket, L, R, rng, 12);
      antenna(bucket, L, -R * 0.4, R * 0.5, -L * 0.02, L * 0.18, true);
      sensorArray(bucket, L, R * 0.44, R * 0.44, -L * 0.12, 0.14, false);
      // engines: twin bells with intake rings and heat exchanger pipes
      addEngineCluster([
        [-L * 0.055, 0, -L * 0.5 - L * 0.02],
        [L * 0.055, 0, -L * 0.5 - L * 0.02],
      ], R * 0.5, L * 0.14, 1.05, true);
      for (const s of [-1, 1]) {
        bucket.put('A', xf(new THREE.TorusGeometry(R * 0.52, L * 0.006, 6, 14), [s * L * 0.055, 0, -L * 0.44]));
        pipe(bucket, L, [s * L * 0.055, R * 0.3, -L * 0.34], [s * L * 0.16, R * 0.12, -L * 0.42], 0.006);
      }
      addVerniers([[-L * 0.14, R * 0.2, -L * 0.46], [L * 0.14, R * 0.2, -L * 0.46]], R * 0.22);
      addRunningLight(0xff5566, -L * 0.68, -L * 0.01, L * 0.04, L * 0.1);
      addRunningLight(0x55ff88, L * 0.68, -L * 0.01, L * 0.04, L * 0.1);
      addRunningLight(0xffffff, 0, R * 0.62, L * 0.06, L * 0.06);
      break;
    }

    /* --------------------------------------------- Vagrant freighter */
    case 'freighter': {
      const W = L * 0.3;
      const H = L * 0.2;
      hullR = H * 0.95;
      // weapon hardpoints: bow flanks, deck, aft flanks
      hardpoints.push(
        [-W * 0.5, H * 0.3, L * 0.34],
        [W * 0.5, H * 0.3, L * 0.34],
        [0, H * 0.78, L * 0.06],
        [-W * 0.5, H * 0.3, -L * 0.08],
        [W * 0.5, H * 0.3, -L * 0.08],
      );
      bucket.put('H', xf(new THREE.BoxGeometry(W, H, L * 0.92), [0, 0, 0]));
      bucket.put('T', xf(new THREE.BoxGeometry(W * 0.86, H * 0.86, L * 0.2), [0, -H * 0.02, L * 0.52], [0.06, 0, 0]));
      bucket.put('D', xf(new THREE.BoxGeometry(W * 0.6, H * 0.5, L * 0.16), [0, -H * 0.3, L * 0.56]));
      // hull plate rows + seam lines along the flanks
      for (const s of [-1, 1]) {
        for (let i = 0; i < 6; i++) {
          bucket.put(i % 2 ? 'L' : 'T', xf(
            new THREE.BoxGeometry(W * 0.03, H * 0.5, L * 0.12),
            [s * W * 0.51, H * 0.06, L * (0.36 - i * 0.14)],
          ));
        }
        plateBelt(bucket, L, s * W * 0.52, H * 0.3, L * 0.08, s, 2, 5, 0.9);
        // fuel/coolant pipe runs bow to stern
        pipe(bucket, L, [s * W * 0.5, H * 0.34, L * 0.4], [s * W * 0.62, H * 0.05, -L * 0.28], 0.007);
        pipe(bucket, L, [s * W * 0.44, -H * 0.28, L * 0.42], [s * W * 0.6, -H * 0.34, -L * 0.24], 0.006, 'L');
        // magnetic deck clamps
        for (let i = 0; i < 4; i++) {
          bucket.put('D', xf(new THREE.BoxGeometry(W * 0.1, H * 0.05, L * 0.03), [s * W * 0.36, -H * 0.54, L * (0.3 - i * 0.16)]));
        }
      }
      // hull seam rings
      for (let i = 0; i < 4; i++) {
        bucket.put('D', xf(new THREE.BoxGeometry(W * 1.02, L * 0.006, L * 0.006), [0, H * 0.5, L * (0.28 - i * 0.17)]));
        bucket.put('D', xf(new THREE.BoxGeometry(W * 1.02, L * 0.006, L * 0.006), [0, -H * 0.5, L * (0.24 - i * 0.19)]));
      }
      // docked lifter pod under the belly
      bucket.put('D', xf(new THREE.BoxGeometry(W * 0.34, H * 0.24, L * 0.16), [0, -H * 0.64, L * 0.14]));
      bucket.put('G', xf(new THREE.BoxGeometry(W * 0.2, H * 0.12, L * 0.04), [0, -H * 0.64, L * 0.23]));
      bucket.put('A', xf(new THREE.BoxGeometry(W * 0.3, L * 0.005, L * 0.1), [0, -H * 0.76, L * 0.14]));
      // bridge tower: tiered, lit windows, railing posts, floodlights
      bucket.put('T', xf(new THREE.BoxGeometry(W * 0.66, H * 0.5, L * 0.2), [0, H * 0.62, -L * 0.3]));
      bucket.put('T', xf(new THREE.BoxGeometry(W * 0.5, H * 0.4, L * 0.16), [0, H * 0.95, -L * 0.32]));
      bucket.put('G', xf(new THREE.BoxGeometry(W * 0.56, H * 0.28, L * 0.05), [0, H * 0.78, -L * 0.2]));
      windowBand(bucket, L, 0, H * 0.78, -L * 0.225, Math.PI / 2, 5, W * 0.09, 0.012);
      windowBand(bucket, L, W * 0.34, H * 0.62, -L * 0.3, Math.PI / 2, 3, W * 0.07, 0.01);
      for (let i = 0; i < 6; i++) {
        bucket.put('L', xf(new THREE.BoxGeometry(L * 0.006, L * 0.02, L * 0.006), [(i - 2.5) * W * 0.08, H * 1.18, -L * 0.34]));
      }
      for (const s of [-1, 1]) {
        bucket.put('A', xf(new THREE.BoxGeometry(L * 0.014, L * 0.01, L * 0.014), [s * W * 0.3, H * 0.44, -L * 0.2]));
      }
      // container racks: mixed sizes, lit seals, corner posts
      for (const s of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 2; j++) {
            const rx = s * (W * 0.5 + L * 0.055);
            const ry = -H * 0.36 + j * L * 0.09;
            const rz = L * 0.28 - i * L * 0.115;
            const big = rng() < 0.35;
            const cw = big ? L * 0.12 : L * 0.105;
            const ch = big ? L * 0.082 : L * 0.07;
            bucket.put('D', xf(new THREE.BoxGeometry(cw, ch, L * 0.09), [rx, ry, rz]));
            bucket.put('L', xf(new THREE.BoxGeometry(cw * 1.03, L * 0.008, L * 0.02), [rx, ry + ch * 0.5, rz]));
            bucket.put(rng() < 0.5 ? 'A' : 'L', xf(new THREE.BoxGeometry(cw * 1.02, L * 0.006, L * 0.012), [rx, ry - ch * 0.5, rz + L * 0.02]));
            for (const cs of [-1, 1]) {
              bucket.put('T', xf(new THREE.BoxGeometry(L * 0.008, ch, L * 0.008), [rx + cs * cw * 0.45, ry, rz - L * 0.045]));
            }
          }
        }
        // side engine pod with fins, intake ring and plating
        bucket.put('T', xf(new THREE.BoxGeometry(W * 0.3, H * 0.5, L * 0.3), [s * W * 0.62, -H * 0.1, -L * 0.28]));
        bucket.put('L', xf(new THREE.BoxGeometry(W * 0.02, H * 0.4, L * 0.26), [s * W * 0.78, -H * 0.1, -L * 0.28]));
        bucket.put('A', xf(new THREE.TorusGeometry(W * 0.16, L * 0.006, 6, 14), [s * W * 0.62, -H * 0.1, -L * 0.12]));
        bucket.put('D', xf(new THREE.BoxGeometry(W * 0.32, L * 0.01, L * 0.02), [s * W * 0.62, -H * 0.1 + H * 0.26, -L * 0.28]));
      }
      // dorsal spine + crane arms with pulleys
      bucket.put('T', xf(new THREE.BoxGeometry(W * 0.14, H * 0.2, L * 0.5), [0, H * 0.62, L * 0.1]));
      for (const s of [-1, 1]) {
        bucket.put('D', xf(new THREE.BoxGeometry(L * 0.01, L * 0.01, L * 0.26), [s * W * 0.4, H * 0.9, L * 0.3], [0.55, 0, 0]));
        bucket.put('D', xf(new THREE.CylinderGeometry(L * 0.008, L * 0.008, L * 0.02, 6), [s * W * 0.4, H * 0.72, L * 0.42]));
        bucket.put('L', xf(new THREE.TorusGeometry(L * 0.01, L * 0.003, 5, 8), [s * W * 0.4, H * 0.68, L * 0.42]));
      }
      bucket.put('D', xf(new THREE.BoxGeometry(L * 0.012, L * 0.012, L * 0.3), [0, H * 0.72, -L * 0.44], [0.5, 0, 0]));
      // radiators, hatches, sensors
      radiator(bucket, L, W * 0.5, H * 0.32, -L * 0.38, 1, 4, 1.0);
      radiator(bucket, L, -W * 0.5, H * 0.32, -L * 0.38, -1, 4, 1.0);
      hatch(bucket, L, W * 0.52, H * 0.05, -L * 0.1, 1, 1.1);
      hatch(bucket, L, -W * 0.52, H * 0.05, -L * 0.1, -1, 1.1);
      antenna(bucket, L, W * 0.2, H * 0.9, -L * 0.12, L * 0.3, true);
      antenna(bucket, L, -W * 0.2, H * 0.85, L * 0.16, L * 0.22, false);
      sensorArray(bucket, L, W * 0.28, H * 0.62, L * 0.05, 0.2, true);
      bucket.put('A', xf(new THREE.BoxGeometry(W * 1.02, L * 0.012, L * 0.1), [0, H * 0.55, -L * 0.34]));
      rcsQuad(bucket, L, -W * 0.5, H * 0.1, L * 0.42);
      rcsQuad(bucket, L, W * 0.5, H * 0.1, L * 0.42);
      rcsQuad(bucket, L, -W * 0.55, -H * 0.2, -L * 0.44);
      rcsQuad(bucket, L, W * 0.55, -H * 0.2, -L * 0.44);
      greebles(bucket, L, W * 0.5, rng, 34);
      hullClutter(bucket, L, W * 0.5, rng, 16);
      addEngineCluster([
        [-W * 0.62, -H * 0.1, -L * 0.45],
        [W * 0.62, -H * 0.1, -L * 0.45],
      ], L * 0.075, L * 0.14, 1);
      addEngineCluster([[0, 0, -L * 0.5 - L * 0.02]], L * 0.09, L * 0.13, 1.2, true);
      addVerniers([[-W * 0.4, H * 0.2, -L * 0.47], [W * 0.4, H * 0.2, -L * 0.47]], L * 0.03);
      addRunningLight(0xff5566, -W * 0.62, H * 0.3, L * 0.4, L * 0.1);
      addRunningLight(0x55ff88, W * 0.62, H * 0.3, L * 0.4, L * 0.1);
      addRunningLight(0xffffff, 0, H * 1.25, -L * 0.34, L * 0.07);
      break;
    }

    /* ------------------------------------------------ Corsair raider */
    case 'corsair': {
      const R = L * 0.1;
      hullR = R;
      // weapon hardpoints: wing pair, spine, outer-wing pair
      hardpoints.push(
        [-L * 0.3, -R * 0.02, -L * 0.14],
        [L * 0.3, -R * 0.02, -L * 0.14],
        [0, R * 0.62, -L * 0.06],
        [-L * 0.5, -R * 0.06, -L * 0.22],
        [L * 0.5, -R * 0.06, -L * 0.22],
      );
      bucket.put('H', fuselage(L * 0.86, R, 14, [
        [0, 0.6], [0.14, 0.84], [0.34, 1.0], [0.52, 0.96], [0.7, 0.78], [0.86, 0.5], [1, 0.18],
      ], 0.68));
      // barbed bow prongs + jaw blades + secondary fangs
      for (const s of [-1, 1]) {
        bucket.put('T', xf(new THREE.ConeGeometry(R * 0.3, L * 0.42, 6), [s * R * 0.62, -R * 0.1, L * 0.5], [Math.PI / 2, 0, 0]));
        bucket.put('D', xf(new THREE.ConeGeometry(R * 0.14, L * 0.12, 5), [s * R * 0.62, -R * 0.32, L * 0.36], [Math.PI / 2, 0.4, 0]));
        bucket.put('A', xf(new THREE.BoxGeometry(L * 0.006, L * 0.02, L * 0.14), [s * R * 0.86, R * 0.1, L * 0.4]));
        bucket.put('T', xf(new THREE.ConeGeometry(R * 0.16, L * 0.2, 5), [s * R * 0.95, -R * 0.35, L * 0.3], [Math.PI / 2, 0, s * 0.3]));
      }
      bucket.put('G', xf(new THREE.SphereGeometry(R * 0.5, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), [0, R * 0.42, L * 0.04], [0, 0, 0], [1, 0.62, 1.7]));
      bucket.put('D', xf(new THREE.BoxGeometry(R * 1.0, R * 0.02, R * 0.09), [0, R * 0.6, L * 0.04]));
      // trophy plating: scavenged patches welded unevenly across the hull
      for (let i = 0; i < 10; i++) {
        const s = rng() < 0.5 ? -1 : 1;
        const px = s * R * (0.72 + rng() * 0.22);
        const py = (rng() - 0.5) * R * 1.3;
        const pz = (rng() - 0.5) * L * 0.62;
        const key = ['T', 'L', 'H'][Math.floor(rng() * 3)];
        bucket.put(key, xf(
          new THREE.BoxGeometry(L * 0.008, L * (0.02 + rng() * 0.03), L * (0.03 + rng() * 0.05)),
          [px, py, pz],
          [0, 0, s * (rng() * 0.2 - 0.1)],
        ));
      }
      // forward-swept wings with spikes + underwing missile pods
      bucket.put('H', xf(wingPlate(L * 0.66, L * 0.34, L * 0.26, -L * 0.16, L * 0.05), [0, -R * 0.05, -L * 0.2]));
      for (const s of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          bucket.put('D', xf(new THREE.ConeGeometry(L * 0.012, L * (0.07 + i * 0.015), 5), [s * L * (0.24 + i * 0.13), 0, -L * (0.14 + i * 0.07)], [Math.PI / 2, 0, s * 0.4]));
        }
        missilePod(bucket, L, s * L * 0.34, -R * 0.5, L * 0.06, 4, 0.72);
        bucket.put('D', xf(new THREE.BoxGeometry(L * 0.012, L * 0.02, L * 0.08), [s * L * 0.34, -R * 0.35, L * 0.06]));
        // engine pod with intake spike, ring, fins and exhaust vanes
        bucket.put('T', xf(new THREE.CylinderGeometry(L * 0.05, L * 0.06, L * 0.34, 10), [s * L * 0.6, 0, -L * 0.18], [Math.PI / 2, 0, 0]));
        bucket.put('D', xf(new THREE.ConeGeometry(L * 0.028, L * 0.12, 8), [s * L * 0.6, 0, L * 0.005], [Math.PI / 2, 0, 0]));
        bucket.put('L', xf(new THREE.TorusGeometry(L * 0.055, L * 0.006, 6, 12), [s * L * 0.6, 0, -L * 0.3]));
        for (let i = 0; i < 3; i++) {
          bucket.put('L', xf(new THREE.BoxGeometry(L * 0.05, L * 0.008, L * 0.03), [s * L * 0.6, L * 0.05, L * (-0.1 - i * 0.06)]));
        }
        bucket.put('A', xf(new THREE.BoxGeometry(L * 0.06, L * 0.006, L * 0.2), [s * L * 0.6, L * 0.052, -L * 0.16]));
        // exposed truss over the pod
        pipe(bucket, L, [s * L * 0.44, R * 0.3, -L * 0.06], [s * L * 0.58, R * 0.12, -L * 0.3], 0.006);
        pipe(bucket, L, [s * L * 0.58, R * 0.12, -L * 0.3], [s * L * 0.6, -R * 0.2, -L * 0.34], 0.005);
        vent(bucket, L, s * R * 0.7, R * 0.15, -L * 0.04, s * 0.5);
        hatch(bucket, L, s * R * 0.82, -R * 0.2, L * 0.12, s, 0.85);
      }
      // dorsal fins + blades + war stripes
      bucket.put('H', xf(finPlate(L * 0.24, L * 0.15, L * 0.03, -L * 0.1), [0, R * 0.5, -L * 0.24]));
      bucket.put('D', xf(finPlate(L * 0.1, L * 0.08, L * 0.026, -L * 0.02), [0, R * 0.6, -L * 0.42]));
      for (const s of [-1, 1]) {
        bucket.put('A', xf(new THREE.BoxGeometry(L * 0.01, L * 0.09, L * 0.22), [s * (R + L * 0.03), R * 0.2, L * 0.1], [0, 0, s * 0.5]));
        bucket.put('D', xf(new THREE.BoxGeometry(L * 0.03, L * 0.02, L * 0.3), [s * R * 0.5, -R * 0.75, -L * 0.1]));
        // flank spike rows
        for (let i = 0; i < 3; i++) {
          bucket.put('T', xf(new THREE.ConeGeometry(L * 0.008, L * 0.05, 5), [s * R * 0.88, R * 0.35, L * (0.2 - i * 0.14)], [0, 0, -s * 1.1]));
        }
      }
      plateBelt(bucket, L, R * 0.86, R * 0.05, -L * 0.16, 1, 2, 3, 0.85);
      plateBelt(bucket, L, -R * 0.86, R * 0.05, -L * 0.16, -1, 2, 3, 0.85);
      radiator(bucket, L, R * 0.7, R * 0.3, -L * 0.4, 1, 3, 0.7);
      radiator(bucket, L, -R * 0.7, R * 0.3, -L * 0.4, -1, 3, 0.7);
      panelRing(bucket, 'L', { z: -L * 0.06, r: R * 0.8, count: 8, w: L * 0.016, h: L * 0.01, d: L * 0.04 });
      rcsQuad(bucket, L, -R * 0.85, R * 0.15, L * 0.18);
      rcsQuad(bucket, L, R * 0.85, R * 0.15, L * 0.18);
      rcsQuad(bucket, L, -R * 0.9, -R * 0.15, -L * 0.3);
      rcsQuad(bucket, L, R * 0.9, -R * 0.15, -L * 0.3);
      greebles(bucket, L, R, rng, 28);
      hullClutter(bucket, L, R, rng, 14);
      antenna(bucket, L, 0, R * 0.6, -L * 0.08, L * 0.2, false);
      sensorArray(bucket, L, -R * 0.5, R * 0.4, -L * 0.16, 0.12, false);
      addEngineCluster([
        [-L * 0.6, 0, -L * 0.36 - L * 0.02],
        [L * 0.6, 0, -L * 0.36 - L * 0.02],
        [0, 0, -L * 0.44 - L * 0.02],
      ], R * 0.5, L * 0.13, 1);
      addRunningLight(0xff5566, -L * 0.66, 0, -L * 0.05, L * 0.1);
      addRunningLight(0x55ff88, L * 0.66, 0, -L * 0.05, L * 0.1);
      addRunningLight(0xffffff, 0, R * 0.66, -L * 0.44, L * 0.06);
      break;
    }

    /* ------------------------------------------------- Stormgalleon */
    case 'galleon': {
      const R = L * 0.17;
      hullR = R;
      // weapon hardpoints: fore flank pair, centre deck, low flank pair
      hardpoints.push(
        [-R * 0.6, R * 0.56, L * 0.34],
        [R * 0.6, R * 0.56, L * 0.34],
        [0, R * 1.02, -L * 0.02],
        [-R * 0.7, -R * 0.34, L * 0.12],
        [R * 0.7, -R * 0.34, L * 0.12],
      );
      bucket.put('H', fuselage(L, R, 18, [
        [0, 0.72], [0.1, 0.86], [0.26, 0.97], [0.44, 1.0], [0.6, 0.98], [0.76, 0.82], [0.9, 0.5], [1, 0.12],
      ], 0.78));
      // ribs + X-braced truss lattice between them
      const ribT = [0.16, 0.34, 0.52, 0.7];
      for (const t of ribT) {
        bucket.put('T', xf(new THREE.TorusGeometry(R * (1.02 - t * 0.16), L * 0.012, 8, 20), [0, 0, (t - 0.5) * L], [Math.PI / 2, 0, 0], [1, 0.78, 1]));
      }
      for (let i = 0; i < ribT.length - 1; i++) {
        const z0 = (ribT[i] - 0.5) * L;
        const z1 = (ribT[i + 1] - 0.5) * L;
        for (const s of [-1, 1]) {
          pipe(bucket, L, [s * R * 0.85, R * 0.5, z0], [s * R * 0.85, R * 0.5, z1], 0.005);
          pipe(bucket, L, [s * R * 0.85, R * 0.05, z0], [s * R * 0.85, R * 0.78, z1], 0.004);
          pipe(bucket, L, [s * R * 0.85, R * 0.78, z0], [s * R * 0.85, R * 0.05, z1], 0.004);
          pipe(bucket, L, [s * R * 0.85, -R * 0.5, z0], [s * R * 0.85, -R * 0.5, z1], 0.005);
        }
      }
      // armour belts + crew window rows along the long hull
      plateBelt(bucket, L, R * 0.96, -R * 0.5, 0, 1, 3, 8, 1.15);
      plateBelt(bucket, L, -R * 0.96, -R * 0.5, 0, -1, 3, 8, 1.15);
      for (const s of [-1, 1]) {
        windowBand(bucket, L, s * R * 0.94, R * 0.3, -L * 0.06, Math.PI / 2, 9, L * 0.052, 0.012);
        windowBand(bucket, L, s * R * 0.92, -R * 0.12, L * 0.16, Math.PI / 2, 6, L * 0.05, 0.011);
        pipe(bucket, L, [s * R * 0.9, R * 0.52, L * 0.44], [s * R * 0.92, R * 0.22, -L * 0.44], 0.007);
      }
      // side hangar recesses with glow strips and a parked shuttle in each
      for (const s of [-1, 1]) {
        bucket.put('D', xf(new THREE.BoxGeometry(R * 0.3, R * 0.4, L * 0.14), [s * R * 0.78, -R * 0.2, -L * 0.02]));
        bucket.put('A', xf(new THREE.BoxGeometry(R * 0.06, R * 0.34, L * 0.12), [s * R * 0.92, -R * 0.2, -L * 0.02]));
        bucket.put('T', xf(new THREE.BoxGeometry(R * 0.16, R * 0.14, L * 0.05), [s * R * 0.58, -R * 0.2, -L * 0.02]));
        bucket.put('G', xf(new THREE.BoxGeometry(R * 0.1, R * 0.06, L * 0.015), [s * R * 0.58, -R * 0.2, L * 0.015]));
      }
      // tiered superstructure with lit window bands + railings + forward observation deck
      bucket.put('T', xf(new THREE.BoxGeometry(R * 1.4, R * 0.55, L * 0.24), [0, R * 0.75, -L * 0.3]));
      bucket.put('T', xf(new THREE.BoxGeometry(R * 1.0, R * 0.45, L * 0.16), [0, R * 1.15, -L * 0.34]));
      bucket.put('G', xf(new THREE.BoxGeometry(R * 0.9, R * 0.28, L * 0.04), [0, R * 1.05, -L * 0.26]));
      bucket.put('G', xf(new THREE.BoxGeometry(R * 0.7, R * 0.22, L * 0.035), [0, R * 0.6, L * 0.3]));
      windowBand(bucket, L, 0, R * 1.05, -L * 0.26, Math.PI / 2, 6, R * 0.12, 0.012);
      windowBand(bucket, L, 0, R * 0.62, L * 0.3, Math.PI / 2, 5, R * 0.1, 0.011);
      for (let i = 0; i < 8; i++) {
        bucket.put('L', xf(new THREE.BoxGeometry(L * 0.006, L * 0.022, L * 0.006), [(i - 3.5) * R * 0.14, R * 1.42, -L * 0.36]));
      }
      bucket.put('T', xf(new THREE.BoxGeometry(R * 0.5, R * 0.3, L * 0.1), [0, R * 0.9, L * 0.3]));
      bucket.put('G', xf(new THREE.BoxGeometry(R * 0.42, R * 0.16, L * 0.03), [0, R * 0.96, L * 0.34]));
      windowBand(bucket, L, 0, R * 0.96, L * 0.35, Math.PI / 2, 4, R * 0.1, 0.011);
      // broad cargo wings + underwing pods with straps + landing struts
      bucket.put('H', xf(wingPlate(L * 0.6, L * 0.6, L * 0.34, L * 0.2, L * 0.06), [0, -R * 0.3, -L * 0.05]));
      const podGeo = new THREE.BoxGeometry(L * 0.13, L * 0.1, L * 0.3);
      for (const s of [-1, 1]) {
        bucket.put('D', xf(podGeo.clone(), [s * L * 0.42, -R * 0.5, L * 0.02]));
        bucket.put('L', xf(new THREE.BoxGeometry(L * 0.134, L * 0.012, L * 0.04), [s * L * 0.42, -R * 0.45, L * 0.02]));
        bucket.put('A', xf(new THREE.BoxGeometry(L * 0.01, L * 0.012, L * 0.28), [s * L * 0.42, -R * 0.44, L * 0.02]));
        // loading cranes with pulleys
        bucket.put('D', xf(new THREE.BoxGeometry(L * 0.012, L * 0.012, L * 0.3), [s * R * 0.5, R * 0.7, L * 0.28], [0.5, 0, 0]));
        bucket.put('L', xf(new THREE.TorusGeometry(L * 0.012, L * 0.004, 5, 8), [s * R * 0.5, R * 0.5, L * 0.42], [0, Math.PI / 2, 0]));
        bucket.put('D', xf(new THREE.BoxGeometry(L * 0.012, L * 0.012, L * 0.28), [s * R * 0.42, R * 0.62, -L * 0.42], [0.55, 0, s * 0.2]));
        bucket.put('L', xf(new THREE.TorusGeometry(L * 0.01, L * 0.0035, 5, 8), [s * R * 0.42, R * 0.44, -L * 0.56], [0, Math.PI / 2, 0]));
        // landing struts
        bucket.put('D', xf(new THREE.BoxGeometry(L * 0.014, L * 0.05, L * 0.014), [s * R * 0.6, -R * 0.85, L * 0.24], [0, 0, s * 0.3]));
      }
      // gun deck: four turrets + underslung missile battery
      turret(bucket, L, -R * 0.72, R * 0.5, L * 0.2, 1.0, 0.35);
      turret(bucket, L, R * 0.72, R * 0.5, L * 0.2, 1.0, -0.35);
      turret(bucket, L, -R * 0.66, R * 0.4, -L * 0.34, 0.85, 0.5);
      turret(bucket, L, R * 0.66, R * 0.4, -L * 0.34, 0.85, -0.5);
      missilePod(bucket, L, 0, -R * 0.82, L * 0.38, 6, 1.0);
      // masts, dishes, pennant
      antenna(bucket, L, 0, R * 1.4, -L * 0.1, L * 0.34, false);
      antenna(bucket, L, 0, R * 1.3, L * 0.14, L * 0.22, true);
      sensorArray(bucket, L, R * 0.5, R * 0.62, -L * 0.16, 0.22, true);
      bucket.put('A', xf(new THREE.BoxGeometry(L * 0.004, L * 0.05, L * 0.09), [0, R * 1.75, -L * 0.1]));
      panelRing(bucket, 'L', { z: L * 0.3, r: R * 0.94, count: 12, w: L * 0.02, h: L * 0.012, d: L * 0.05, skip: 0.25 });
      panelRing(bucket, 'T', { z: -L * 0.1, r: R * 0.9, count: 12, w: L * 0.02, h: L * 0.012, d: L * 0.05, skip: 0.25 });
      // radiators, hatches, service runs
      radiator(bucket, L, R * 0.9, R * 0.4, -L * 0.52, 1, 5, 1.3);
      radiator(bucket, L, -R * 0.9, R * 0.4, -L * 0.52, -1, 5, 1.3);
      for (const s of [-1, 1]) {
        hatch(bucket, L, s * R * 0.97, R * 0.05, L * 0.34, s, 1.3);
        hatch(bucket, L, s * R * 0.97, -R * 0.08, -L * 0.28, s, 1.2);
      }
      rcsQuad(bucket, L, -R * 0.9, R * 0.2, L * 0.36);
      rcsQuad(bucket, L, R * 0.9, R * 0.2, L * 0.36);
      rcsQuad(bucket, L, -R * 0.95, -R * 0.3, -L * 0.42);
      rcsQuad(bucket, L, R * 0.95, -R * 0.3, -L * 0.42);
      greebles(bucket, L, R, rng, 46);
      hullClutter(bucket, L, R, rng, 20);
      // heavy engine block: six bells, intake pylons, exhaust vanes
      addEngineCluster([
        [-R * 0.75, R * 0.15, -L * 0.5 - L * 0.02],
        [R * 0.75, R * 0.15, -L * 0.5 - L * 0.02],
        [-R * 0.75, -R * 0.55, -L * 0.5 - L * 0.02],
        [R * 0.75, -R * 0.55, -L * 0.5 - L * 0.02],
        [-R * 0.28, -R * 0.16, -L * 0.54 - L * 0.02],
        [R * 0.28, -R * 0.16, -L * 0.54 - L * 0.02],
      ], R * 0.42, L * 0.12, 1.15, true);
      for (const s of [-1, 1]) {
        bucket.put('L', xf(new THREE.BoxGeometry(R * 0.1, R * 0.55, L * 0.08), [s * R * 1.08, R * 0.35, -L * 0.47], [0, 0, s * 0.3]));
        bucket.put('D', xf(new THREE.BoxGeometry(R * 0.08, R * 0.4, L * 0.06), [s * R * 0.5, R * 0.42, -L * 0.5], [0, 0, s * 0.2]));
        pipe(bucket, L, [s * R * 0.5, R * 0.6, -L * 0.4], [s * R * 0.75, R * 0.15, -L * 0.52], 0.007);
      }
      addVerniers([[-R * 1.1, 0, -L * 0.46], [R * 1.1, 0, -L * 0.46]], R * 0.18);
      addRunningLight(0xff5566, -L * 0.42, 0, -L * 0.22, L * 0.11);
      addRunningLight(0x55ff88, L * 0.42, 0, -L * 0.22, L * 0.11);
      addRunningLight(0xffffff, 0, R * 1.6, -L * 0.24, L * 0.08);
      break;
    }

    /* ------------------------------------ Warship (Halcyon and sisters) */
    default: {
      const R = L * 0.13;
      hullR = R;
      // weapon hardpoints: fore quarter pair, underbow, aft quarter pair
      hardpoints.push(
        [-R * 0.66, R * 0.42, L * 0.3],
        [R * 0.66, R * 0.42, L * 0.3],
        [0, -R * 0.58, L * 0.34],
        [-R * 0.72, R * 0.34, -L * 0.22],
        [R * 0.72, R * 0.34, -L * 0.22],
      );
      bucket.put('H', fuselage(L, R, 16, [
        [0, 0.68], [0.12, 0.85], [0.3, 0.96], [0.48, 1.0], [0.62, 0.97], [0.76, 0.78], [0.9, 0.44], [1, 0],
      ], 0.7));
      // stepped decks: dorsal citadel, upper command deck, ventral keel box
      bucket.put('T', xf(new THREE.BoxGeometry(R * 0.9, R * 0.34, L * 0.62), [0, R * 0.62, -L * 0.04]));
      bucket.put('T', xf(new THREE.BoxGeometry(R * 0.6, R * 0.26, L * 0.3), [0, R * 0.85, -L * 0.14]));
      bucket.put('T', xf(new THREE.BoxGeometry(R * 0.5, R * 0.3, L * 0.5), [0, -R * 0.72, -L * 0.06]));
      // armour belts + crew window rows along the flanks
      plateBelt(bucket, L, R * 0.95, -R * 0.35, L * 0.05, 1, 2, 6, 1.05);
      plateBelt(bucket, L, -R * 0.95, -R * 0.35, L * 0.05, -1, 2, 6, 1.05);
      for (const s of [-1, 1]) {
        windowBand(bucket, L, s * R * 0.92, R * 0.28, -L * 0.16, Math.PI / 2, 6, L * 0.05, 0.011);
        pipe(bucket, L, [s * R * 0.88, R * 0.5, L * 0.36], [s * R * 0.9, R * 0.24, -L * 0.4], 0.006);
      }
      // dorsal VLS grid: two rows of missile cells with dark bores
      for (let row = 0; row < 2; row++) {
        for (let c = 0; c < 4; c++) {
          const gx = (row - 0.5) * R * 0.52;
          const gz = L * (0.04 - c * 0.055);
          bucket.put('V', xf(new THREE.CylinderGeometry(R * 0.14, R * 0.14, R * 0.1, 8), [gx, R * 0.78, gz]));
          bucket.put('N', xf(new THREE.CylinderGeometry(R * 0.1, R * 0.1, R * 0.14, 8), [gx, R * 0.8, gz]));
        }
        bucket.put('A', xf(new THREE.BoxGeometry(R * 0.12, R * 0.02, L * 0.24), [(row - 0.5) * R * 0.62, R * 0.79, -L * 0.05]));
      }
      // main turret, flank secondaries, aft turret, underbow missile battery
      turret(bucket, L, 0, R * 0.95, L * 0.06, 1.15, 0);
      turret(bucket, L, -R * 0.8, R * 0.3, -L * 0.06, 0.7, 0.5);
      turret(bucket, L, R * 0.8, R * 0.3, -L * 0.06, 0.7, -0.5);
      turret(bucket, L, 0, R * 0.92, -L * 0.38, 0.9, 0);
      missilePod(bucket, L, 0, -R * 0.66, L * 0.32, 6, 0.9);
      // launch bay recess with glow strip + parked shuttle
      bucket.put('D', xf(new THREE.BoxGeometry(R * 0.7, R * 0.2, L * 0.16), [0, -R * 0.45, L * 0.24]));
      bucket.put('A', xf(new THREE.BoxGeometry(R * 0.72, R * 0.03, L * 0.14), [0, -R * 0.56, L * 0.24]));
      bucket.put('T', xf(new THREE.BoxGeometry(R * 0.4, R * 0.14, L * 0.05), [0, -R * 0.5, L * 0.12]));
      bucket.put('G', xf(new THREE.BoxGeometry(R * 0.24, R * 0.06, L * 0.015), [0, -R * 0.5, L * 0.155]));
      // dorsal docking collar with lit ring
      bucket.put('D', xf(new THREE.CylinderGeometry(R * 0.22, R * 0.26, R * 0.12, 10), [0, R * 0.42, L * 0.4]));
      bucket.put('A', xf(new THREE.TorusGeometry(R * 0.22, R * 0.03, 6, 14), [0, R * 0.44, L * 0.4], [Math.PI / 2, 0, 0]));
      // wings: sponsons, slats, canted fins, wingtip sensor pods
      bucket.put('H', xf(wingPlate(L * 0.5, L * 0.4, L * 0.26, L * 0.16, L * 0.05), [0, -R * 0.15, -L * 0.1]));
      for (const s of [-1, 1]) {
        bucket.put('L', xf(new THREE.BoxGeometry(L * 0.2, L * 0.006, L * 0.024), [s * L * 0.3, R * 0.04, L * 0.02], [0, s * 0.3, 0]));
        bucket.put('T', xf(new THREE.BoxGeometry(L * 0.05, L * 0.04, L * 0.26), [s * L * 0.46, 0, -L * 0.18]));
        bucket.put('H', xf(finPlate(L * 0.2, L * 0.18, L * 0.025, L * 0.1), [s * L * 0.28, R * 0.2, -L * 0.3], [0, 0, -s * 0.2]));
        bucket.put('A', xf(new THREE.BoxGeometry(L * 0.008, L * 0.03, L * 0.14), [s * L * 0.28, R * 0.3, -L * 0.3], [0, 0, -s * 0.2]));
        bucket.put('T', xf(new THREE.CylinderGeometry(L * 0.016, L * 0.02, L * 0.14, 8), [s * L * 0.5, 0, -L * 0.24], [Math.PI / 2, 0, 0]));
        bucket.put('A', xf(new THREE.SphereGeometry(L * 0.01, 6, 5), [s * L * 0.5, 0, -L * 0.165]));
        vent(bucket, L, s * R * 0.75, R * 0.2, L * 0.16, s * 0.55);
        hatch(bucket, L, s * R * 0.9, -R * 0.05, L * 0.3, s, 1.1);
      }
      // sensor mast + dishes + phased array
      bucket.put('D', xf(new THREE.CylinderGeometry(L * 0.007, L * 0.012, L * 0.3, 6), [0, R * 1.15, -L * 0.14]));
      bucket.put('A', xf(new THREE.SphereGeometry(L * 0.018, 8, 6), [0, R * 1.3, -L * 0.14]));
      antenna(bucket, L, -R * 0.5, R * 0.75, -L * 0.26, L * 0.18, true);
      antenna(bucket, L, R * 0.5, R * 0.75, -L * 0.26, L * 0.14, false);
      sensorArray(bucket, L, -R * 0.4, R * 0.6, L * 0.18, 0.16, true);
      bucket.put('A', xf(new THREE.BoxGeometry(R * 1.1, L * 0.012, L * 0.4), [0, R * 0.45, 0]));
      // radiators, panels, RCS
      radiator(bucket, L, R * 0.85, R * 0.25, -L * 0.42, 1, 4, 1.15);
      radiator(bucket, L, -R * 0.85, R * 0.25, -L * 0.42, -1, 4, 1.15);
      panelRing(bucket, 'L', { z: L * 0.14, r: R * 0.86, count: 10, w: L * 0.018, h: L * 0.01, d: L * 0.045, skip: 0.28 });
      panelRing(bucket, 'L', { z: -L * 0.2, r: R * 0.88, count: 10, w: L * 0.018, h: L * 0.01, d: L * 0.045, skip: 0.28 });
      rcsQuad(bucket, L, -R * 0.85, R * 0.2, L * 0.34);
      rcsQuad(bucket, L, R * 0.85, R * 0.2, L * 0.34);
      rcsQuad(bucket, L, -R * 0.9, -R * 0.1, -L * 0.38);
      rcsQuad(bucket, L, R * 0.9, -R * 0.1, -L * 0.38);
      greebles(bucket, L, R, rng, 40);
      hullClutter(bucket, L, R, rng, 18);
      // engine block: three bells, exhaust vanes, exchanger pipes
      addEngineCluster([
        [-R * 0.45, R * 0.1, -L * 0.5 - L * 0.02],
        [R * 0.45, R * 0.1, -L * 0.5 - L * 0.02],
        [0, -R * 0.5, -L * 0.5 - L * 0.02],
      ], R * 0.5, L * 0.13, 1.1, true);
      for (const s of [-1, 1]) {
        bucket.put('L', xf(new THREE.BoxGeometry(R * 0.09, R * 0.5, L * 0.07), [s * R * 1.0, R * 0.3, -L * 0.46], [0, 0, s * 0.3]));
        pipe(bucket, L, [s * R * 0.5, R * 0.55, -L * 0.36], [s * R * 0.7, R * 0.12, -L * 0.5], 0.006);
      }
      addVerniers([[-R * 0.95, R * 0.3, -L * 0.46], [R * 0.95, R * 0.3, -L * 0.46]], R * 0.2);
      addRunningLight(0xff5566, -L * 0.52, 0, L * 0.04, L * 0.11);
      addRunningLight(0x55ff88, L * 0.52, 0, L * 0.04, L * 0.11);
      addRunningLight(0xffffff, 0, R * 1.35, -L * 0.16, L * 0.07);
      addRunningLight(0xffffff, 0, -R * 0.9, -L * 0.2, L * 0.06);
      break;
    }

    /* ------------------------------------- light shuttle / utility van */
    case 'shuttle': {
      const R = L * 0.15;
      hullR = R;
      const van = def.variant === 'van';
      // weapon hardpoints: chin pair
      hardpoints.push(
        [-L * 0.14, -R * 0.72, L * 0.26],
        [L * 0.14, -R * 0.72, L * 0.26],
      );
      // slab body with a sloping flight deck up front
      bucket.put('H', xf(new THREE.BoxGeometry(R * 1.5, R * 0.9, L * 0.6), [0, 0, -L * 0.08]));
      bucket.put('H', xf(new THREE.BoxGeometry(R * 1.2, R * (van ? 1.05 : 0.7), L * 0.28), [0, R * (van ? 0.75 : 0.6), L * 0.16], [0.2, 0, 0]));
      bucket.put('G', xf(new THREE.BoxGeometry(R * 0.9, R * 0.42, L * 0.1), [0, R * (van ? 0.95 : 0.78), L * 0.3], [0.45, 0, 0]));
      // cargo rib frame down the flanks + lit tail gate
      for (const s of [-1, 1]) {
        bucket.put('T', xf(new THREE.BoxGeometry(R * 0.1, R * 0.14, L * 0.56), [s * R * 0.77, -R * 0.1, -L * 0.08]));
        plateBelt(bucket, L, s * R * 0.79, R * 0.28, -L * 0.1, s, 2, 4, 0.75, 'T');
      }
      bucket.put('D', xf(new THREE.BoxGeometry(R * 1.25, R * 0.62, R * 0.16), [0, 0, -L * 0.4]));
      bucket.put('A', xf(new THREE.BoxGeometry(R * 1.0, R * 0.08, L * 0.02), [0, -R * 0.42, -L * 0.4]));
      // landing skids
      for (const s of [-1, 1]) {
        bucket.put('L', xf(new THREE.BoxGeometry(R * 0.12, R * 0.5, L * 0.3), [s * R * 0.52, -R * 0.78, -L * 0.04]));
        bucket.put('L', xf(new THREE.BoxGeometry(R * 0.2, R * 0.09, L * 0.34), [s * R * 0.52, -R * 1.0, -L * 0.04]));
      }
      hatch(bucket, L, R * 0.75, R * 0.3, -L * 0.18, 1, 0.9);
      radiator(bucket, L, -R * 0.68, R * 0.42, -L * 0.28, -1, 3, 0.7);
      antenna(bucket, L, R * 0.45, R * 0.5, L * 0.02, L * 0.11, false);
      greebles(bucket, L, R, rng, 12);
      hullClutter(bucket, L, R, rng, 6);
      rcsQuad(bucket, L, -R * 0.76, R * 0.1, -L * 0.34);
      rcsQuad(bucket, L, R * 0.76, R * 0.1, -L * 0.34);
      // twin tail bells
      addEngineCluster([[-R * 0.5, R * 0.08, -L * 0.44], [R * 0.5, R * 0.08, -L * 0.44]], R * 0.32, L * 0.08, 0.9);
      addVerniers([[-R * 0.78, -R * 0.3, L * 0.2], [R * 0.78, -R * 0.3, L * 0.2]], R * 0.16);
      addRunningLight(0xff5566, -R * 0.8, R * 0.05, L * 0.05, L * 0.06);
      addRunningLight(0x55ff88, R * 0.8, R * 0.05, L * 0.05, L * 0.06);
      addRunningLight(0xffffff, 0, R * 1.0, -L * 0.3, L * 0.05);
      break;
    }

    /* ----------------------------------------------- delta interceptor */
    case 'arrow': {
      const R = L * 0.088;
      hullR = R;
      const heavy = def.variant === 'heavy';
      const dart = def.variant === 'dart';
      // weapon hardpoints: wing pair, spine, outer-wing pair
      hardpoints.push(
        [-L * 0.2, -R * 0.25, L * 0.1],
        [L * 0.2, -R * 0.25, L * 0.1],
        [0, R * 0.45, L * 0.3],
        [-L * 0.42, -R * 0.35, -L * 0.18],
        [L * 0.42, -R * 0.35, -L * 0.18],
      );
      // dart fuselage, sleek or stubby
      bucket.put('H', fuselage(L * (dart ? 1.06 : 0.92), R, 12, null, 0.62));
      // broad delta wing with a hard leading edge
      bucket.put('H', xf(wingPlate(L * (heavy ? 0.5 : 0.62), L * (dart ? 0.4 : 0.52), L * 0.12, L * (dart ? 0.36 : 0.28), L * 0.032), [0, -R * 0.12, -L * 0.14]));
      bucket.put('T', xf(new THREE.BoxGeometry(L * 0.9, L * 0.008, L * 0.05), [0, -R * 0.05, L * 0.02]));
      // twin canted fins + wingtip pods with nav stripes
      for (const s of [-1, 1]) {
        bucket.put('H', xf(finPlate(L * 0.15, L * 0.12, L * 0.02, L * 0.06), [s * L * 0.13, R * 0.28, -L * 0.4], [0, 0, -s * 0.2]));
        bucket.put('T', xf(new THREE.CylinderGeometry(L * 0.014, L * 0.018, L * 0.22, 8), [s * L * 0.56, -R * 0.2, -L * 0.26], [Math.PI / 2, 0, 0]));
        bucket.put('A', xf(new THREE.BoxGeometry(L * 0.006, L * 0.02, L * 0.09), [s * L * 0.56, -R * 0.12, -L * 0.32], [0, 0, -s * 0.4]));
      }
      // canopy + dorsal blade
      bucket.put('G', xf(new THREE.SphereGeometry(R * 0.5, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.5), [0, R * 0.42, L * 0.2], [0, 0, 0], [1, 0.5, 2.2]));
      bucket.put('T', xf(finPlate(L * 0.4, R * 0.6, R * 0.16, L * 0.1), [0, R * 0.4, -L * 0.12]));
      bucket.put('A', xf(new THREE.BoxGeometry(R * 0.05, R * 0.16, L * 0.3), [0, R * 0.5, -L * 0.12]));
      // launcher cells on the wing roots
      missilePod(bucket, L, -L * 0.14, -R * 0.2, L * 0.06, heavy ? 6 : 4, 0.8);
      missilePod(bucket, L, L * 0.14, -R * 0.2, L * 0.06, heavy ? 6 : 4, 0.8);
      plateBelt(bucket, L, R * 0.9, R * 0.1, L * 0.1, 1, 2, 4, 0.8);
      plateBelt(bucket, L, -R * 0.9, R * 0.1, L * 0.1, -1, 2, 4, 0.8);
      greebles(bucket, L, R, rng, 18);
      hullClutter(bucket, L, R, rng, 8);
      rcsQuad(bucket, L, -R * 0.85, R * 0.15, L * 0.3);
      rcsQuad(bucket, L, R * 0.85, R * 0.15, L * 0.3);
      // single big bell + slim verniers
      addEngineCluster([[0, 0, -L * 0.5 - L * 0.02]], R * 0.78, L * 0.15, 1.2, true);
      addVerniers([[-R * 0.85, R * 0.05, -L * 0.42], [R * 0.85, R * 0.05, -L * 0.42]], R * 0.2);
      addRunningLight(0xff5566, -L * 0.56, -R * 0.2, -L * 0.2, L * 0.08);
      addRunningLight(0x55ff88, L * 0.56, -R * 0.2, -L * 0.2, L * 0.08);
      addRunningLight(0xffffff, 0, R * 0.6, L * 0.02, L * 0.055);
      break;
    }

    /* -------------------------------------------- industrial prospector */
    case 'miner': {
      const R = L * 0.19;
      hullR = R;
      const twin = def.variant === 'twin';
      // weapon hardpoints: flank pair
      hardpoints.push(
        [-R * 1.05, R * 0.1, L * 0.12],
        [R * 1.05, R * 0.1, L * 0.12],
      );
      // fat ore drum
      bucket.put('H', fuselage(L * 0.74, R, 14, [[0, 0.82], [0.16, 1], [0.7, 1], [0.9, 0.86], [1, 0.58]], 0.94));
      // drill assemblies forward
      if (twin) {
        for (const s of [-1, 1]) {
          bucket.put('D', xf(new THREE.ConeGeometry(R * 0.26, L * 0.3, 8), [s * R * 0.5, -R * 0.05, L * 0.58], [Math.PI / 2, 0, 0]));
          bucket.put('T', xf(new THREE.CylinderGeometry(R * 0.1, R * 0.14, L * 0.16, 8), [s * R * 0.5, -R * 0.05, L * 0.44], [Math.PI / 2, 0, 0]));
        }
      } else {
        bucket.put('D', xf(new THREE.ConeGeometry(R * 0.34, L * 0.4, 10), [0, -R * 0.05, L * 0.62], [Math.PI / 2, 0, 0]));
        bucket.put('T', xf(new THREE.CylinderGeometry(R * 0.13, R * 0.18, L * 0.2, 8), [0, -R * 0.05, L * 0.46], [Math.PI / 2, 0, 0]));
      }
      // drill gantry arch over the nose
      pipe(bucket, L, [-R * 0.95, R * 0.35, L * 0.3], [R * 0.95, R * 0.35, L * 0.3], 0.014, 'T');
      for (const s of [-1, 1]) pipe(bucket, L, [s * R * 0.95, R * 0.35, L * 0.3], [s * R * 1.0, -R * 0.4, L * 0.12], 0.014, 'T');
      // ore pods clamped along both flanks
      for (const s of [-1, 1]) {
        for (let i = 0; i < 2; i++) {
          const z = L * (0.02 - i * 0.26);
          bucket.put('T', xf(new THREE.CylinderGeometry(R * 0.3, R * 0.3, L * 0.22, 10), [s * R * 1.02, -R * 0.15, z], [Math.PI / 2, 0, 0]));
          bucket.put('L', xf(new THREE.TorusGeometry(R * 0.31, R * 0.035, 6, 12), [s * R * 1.02, -R * 0.15, z + L * 0.06]));
          bucket.put('A', xf(new THREE.BoxGeometry(R * 0.1, R * 0.05, L * 0.02), [s * R * 1.25, -R * 0.15, z]));
        }
      }
      // work floodlights on the gantry
      addRunningLight(0xffe0a0, -R * 0.8, R * 0.5, L * 0.34, L * 0.09);
      addRunningLight(0xffe0a0, R * 0.8, R * 0.5, L * 0.34, L * 0.09);
      // dorsal walkway, crane arm, hull dressings
      bucket.put('D', xf(new THREE.BoxGeometry(R * 0.5, R * 0.16, L * 0.66), [0, R * 0.92, -L * 0.06]));
      pipe(bucket, L, [0, R * 0.6, L * 0.28], [0, R * 1.0, -L * 0.3], 0.016, 'T');
      hatch(bucket, L, R * 0.98, R * 0.2, -L * 0.1, 1, 1.1);
      hatch(bucket, L, -R * 0.98, R * 0.2, -L * 0.1, -1, 1.1);
      radiator(bucket, L, -R * 0.5, R * 0.95, -L * 0.3, -1, 3, 0.8);
      sensorArray(bucket, L, 0, R * 0.95, L * 0.26, 0.16, false);
      greebles(bucket, L, R, rng, 16);
      hullClutter(bucket, L, R, rng, 10);
      rcsQuad(bucket, L, -R * 1.0, -R * 0.05, L * 0.2);
      rcsQuad(bucket, L, R * 1.0, -R * 0.05, L * 0.2);
      // heavy twin bells aft
      addEngineCluster([[-R * 0.45, -R * 0.1, -L * 0.4], [R * 0.45, -R * 0.1, -L * 0.4]], R * 0.42, L * 0.12, 1.0, true);
      addVerniers([[-R * 0.9, R * 0.3, -L * 0.3], [R * 0.9, R * 0.3, -L * 0.3]], R * 0.2);
      addRunningLight(0xff5566, -R * 1.05, -R * 0.15, -L * 0.05, L * 0.07);
      addRunningLight(0x55ff88, R * 1.05, -R * 0.15, -L * 0.05, L * 0.07);
      addRunningLight(0xffffff, 0, R * 1.05, -L * 0.2, L * 0.06);
      break;
    }

    /* ---------------------------------------------- container hauler */
    case 'boxcar': {
      const R = L * 0.13;
      hullR = R;
      const flat = def.variant === 'flat';
      // weapon hardpoints: dorsal ring pair
      hardpoints.push(
        [-R * 1.1, R * 0.95, L * 0.06],
        [R * 1.1, R * 0.95, L * 0.06],
      );
      // through-spine keel
      bucket.put('D', xf(new THREE.BoxGeometry(R * 0.55, R * 1.5, L * 0.9), [0, -R * 0.15, 0]));
      // stacked container cells (two tiers unless flat)
      const tiers = flat ? 1 : 2;
      for (let t = 0; t < tiers; t++) {
        for (const s of [-1, 1]) {
          for (let c = 0; c < 5; c++) {
            const z = -L * 0.33 + c * L * 0.145;
            const y = R * (0.42 - t * 1.05);
            bucket.put((t + c) % 3 === 0 ? 'T' : 'H', xf(new THREE.BoxGeometry(R * 1.1, R * 0.86, L * 0.125), [s * R * 0.92, y, z]));
            bucket.put('L', xf(new THREE.BoxGeometry(R * 1.16, R * 0.05, L * 0.02), [s * R * 0.92, y + R * 0.38, z + L * 0.05]));
          }
        }
      }
      // bridge cab perched forward, glass banded
      bucket.put('H', xf(new THREE.BoxGeometry(R * 1.05, R * 0.78, L * 0.13), [0, R * 1.15, L * 0.36]));
      bucket.put('G', xf(new THREE.BoxGeometry(R * 0.86, R * 0.32, L * 0.02), [0, R * 1.3, L * 0.425]));
      // gantry crane beam over the roof
      bucket.put('T', xf(new THREE.BoxGeometry(R * 0.4, R * 0.3, L * 0.8), [0, R * 1.7, -L * 0.02]));
      bucket.put('D', xf(new THREE.BoxGeometry(R * 0.5, R * 0.2, R * 0.6), [0, R * 1.55, L * 0.12]));
      // nose tug block + tail power deck
      bucket.put('T', xf(new THREE.BoxGeometry(R * 1.2, R * 0.7, L * 0.1), [0, 0, L * 0.44]));
      bucket.put('D', xf(new THREE.BoxGeometry(R * 1.4, R * 1.1, L * 0.08), [0, -R * 0.2, -L * 0.46]));
      plateBelt(bucket, L, R * 0.7, -R * 1.05, -L * 0.2, 1, 1, 5, 0.9);
      plateBelt(bucket, L, -R * 0.7, -R * 1.05, -L * 0.2, -1, 1, 5, 0.9);
      hatch(bucket, L, R * 0.98, R * 0.5, -L * 0.2, 1, 1.2);
      greebles(bucket, L, R, rng, 14);
      hullClutter(bucket, L, R, rng, 8);
      rcsQuad(bucket, L, -R * 1.35, R * 0.1, L * 0.3);
      rcsQuad(bucket, L, R * 1.35, R * 0.1, L * 0.3);
      addEngineCluster([[-R * 0.55, -R * 0.35, -L * 0.44], [R * 0.55, -R * 0.35, -L * 0.44]], R * 0.4, L * 0.1, 1.0);
      addVerniers([[-R * 0.85, R * 0.8, -L * 0.3], [R * 0.85, R * 0.8, -L * 0.3]], R * 0.18);
      addRunningLight(0xff5566, -R * 1.4, R * 0.15, -L * 0.4, L * 0.065);
      addRunningLight(0x55ff88, R * 1.4, R * 0.15, -L * 0.4, L * 0.065);
      addRunningLight(0xffffff, 0, R * 2.0, -L * 0.1, L * 0.055);
      break;
    }

    /* --------------------------------------------- hammerhead patrol */
    case 'hammer': {
      const R = L * 0.095;
      hullR = R;
      const twin = def.variant === 'twin';
      // weapon hardpoints: hammer ends, spine deck, lower bow pair
      hardpoints.push(
        [-L * 0.42, R * 0.5, L * 0.41],
        [L * 0.42, R * 0.5, L * 0.41],
        [0, R * 0.85, L * 0.02],
        [-R * 0.9, -R * 0.5, L * 0.3],
        [R * 0.9, -R * 0.5, L * 0.3],
      );
      // slim spine hull
      bucket.put('H', fuselage(L * 0.94, R, 12, [[0, 0.55], [0.18, 0.92], [0.5, 1], [0.8, 0.74], [1, 0.2]], 0.7));
      // hammer head: wide crossbar with end pods
      bucket.put('T', xf(new THREE.BoxGeometry(L * 0.62, R * 0.46, L * 0.1), [0, 0, L * 0.42]));
      bucket.put('H', xf(new THREE.BoxGeometry(L * 0.66, R * 0.32, L * 0.07), [0, R * 0.04, L * 0.43]));
      for (const s of [-1, 1]) {
        bucket.put('H', xf(new THREE.CylinderGeometry(R * 0.6, R * 0.68, L * 0.16, 10), [s * L * 0.42, 0, L * 0.42], [Math.PI / 2, 0, 0]));
        bucket.put('A', xf(new THREE.TorusGeometry(R * 0.62, R * 0.08, 6, 14), [s * L * 0.42, 0, L * 0.5]));
        bucket.put('G', xf(new THREE.BoxGeometry(R * 0.9, R * 0.3, L * 0.012), [s * L * 0.32, R * 0.28, L * 0.47]));
        turret(bucket, L, s * L * 0.42, R * 0.5, L * 0.41, 1.0, 0);
        if (twin) turret(bucket, L, s * L * 0.42, -R * 0.5, L * 0.41, 1.0, 0);
      }
      // sensor stalks on the hammer
      antenna(bucket, L, -L * 0.3, R * 0.3, L * 0.46, L * 0.16, true);
      antenna(bucket, L, L * 0.3, R * 0.3, L * 0.46, L * 0.16, true);
      // dorsal gun deck
      bucket.put('T', xf(new THREE.BoxGeometry(R * 1.3, R * 0.4, L * 0.34), [0, R * 0.62, -L * 0.08]));
      turret(bucket, L, 0, R * 0.85, -L * 0.02, 1.1, Math.PI);
      if (twin) turret(bucket, L, 0, R * 0.85, -L * 0.22, 1.1, Math.PI);
      // canopy + plating
      bucket.put('G', xf(new THREE.SphereGeometry(R * 0.46, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.5), [0, R * 0.4, L * 0.22], [0, 0, 0], [1, 0.55, 2.0]));
      plateBelt(bucket, L, R * 0.92, R * 0.05, -L * 0.05, 1, 2, 5, 0.9);
      plateBelt(bucket, L, -R * 0.92, R * 0.05, -L * 0.05, -1, 2, 5, 0.9);
      hatch(bucket, L, R * 0.94, R * 0.3, -L * 0.24, 1, 1.0);
      hatch(bucket, L, -R * 0.94, R * 0.3, -L * 0.24, -1, 1.0);
      radiator(bucket, L, R * 0.8, R * 0.4, -L * 0.34, 1, 3, 0.85);
      radiator(bucket, L, -R * 0.8, R * 0.4, -L * 0.34, -1, 3, 0.85);
      greebles(bucket, L, R, rng, 18);
      hullClutter(bucket, L, R, rng, 8);
      rcsQuad(bucket, L, -R * 0.9, R * 0.2, L * 0.28);
      rcsQuad(bucket, L, R * 0.9, R * 0.2, L * 0.28);
      // triple bell stern
      addEngineCluster([[0, R * 0.15, -L * 0.5 - L * 0.02]], R * 0.6, L * 0.13, 1.15, true);
      addEngineCluster([[-R * 0.55, -R * 0.3, -L * 0.47], [R * 0.55, -R * 0.3, -L * 0.47]], R * 0.34, L * 0.1, 0.85);
      addVerniers([[-R * 0.9, -R * 0.2, -L * 0.4], [R * 0.9, -R * 0.2, -L * 0.4]], R * 0.2);
      addRunningLight(0xff5566, -L * 0.5, R * 0.1, L * 0.4, L * 0.075);
      addRunningLight(0x55ff88, L * 0.5, R * 0.1, L * 0.4, L * 0.075);
      addRunningLight(0xffffff, 0, R * 1.15, -L * 0.2, L * 0.06);
      break;
    }

    /* ------------------------------------------ spine explorer / liner */
    case 'spine': {
      const R = L * 0.082;
      hullR = R;
      const twin = def.variant === 'twin';
      // weapon hardpoints: flank pair, spine
      hardpoints.push(
        [-L * 0.18, -R * 0.4, L * 0.26],
        [L * 0.18, -R * 0.4, L * 0.26],
        [0, R * 0.55, -L * 0.12],
      );
      // long slim fuselage
      bucket.put('H', fuselage(L * 1.0, R, 14, [[0, 0.45], [0.16, 0.85], [0.5, 1], [0.82, 0.66], [1, 0.1]], 0.85));
      // habitat ring encircling mid-hull
      const ringR = R * 2.3;
      bucket.put('T', xf(new THREE.TorusGeometry(ringR, R * 0.17, 8, 28), [0, 0, -L * 0.06]));
      bucket.put('A', xf(new THREE.TorusGeometry(ringR, R * 0.05, 6, 28), [0, 0, -L * 0.06 + R * 0.22]));
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.4;
        bucket.put('D', xf(new THREE.BoxGeometry(ringR * 0.62, R * 0.07, R * 0.16), [Math.cos(a) * ringR * 0.62, Math.sin(a) * ringR * 0.62, -L * 0.06], [0, 0, a]));
        bucket.put('L', xf(new THREE.BoxGeometry(R * 0.1, R * 0.1, L * 0.02), [Math.cos(a) * ringR * 0.98, Math.sin(a) * ringR * 0.98, -L * 0.06]));
      }
      // a second, smaller ring aft for the grand variant
      if (twin) {
        bucket.put('T', xf(new THREE.TorusGeometry(ringR * 0.78, R * 0.13, 8, 24), [0, 0, -L * 0.34]));
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 + 1.2;
          bucket.put('D', xf(new THREE.BoxGeometry(ringR * 0.5, R * 0.06, R * 0.13), [Math.cos(a) * ringR * 0.45, Math.sin(a) * ringR * 0.45, -L * 0.34], [0, 0, a]));
        }
      }
      // bridge blister + window rows
      bucket.put('G', xf(new THREE.SphereGeometry(R * 0.62, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), [0, R * 0.4, L * 0.3], [0, 0, 0], [1, 0.6, 1.9]));
      windowBand(bucket, L, R * 0.92, R * 0.25, -L * 0.1, Math.PI / 2, 8, L * 0.05, 0.015);
      windowBand(bucket, L, -R * 0.92, R * 0.25, -L * 0.1, Math.PI / 2, 8, L * 0.05, 0.015);
      windowBand(bucket, L, 0, R * 0.5, L * 0.4, 0, 4, R * 0.4, 0.014);
      // dorsal fin + sensor mast
      bucket.put('T', xf(finPlate(L * 0.3, R * 0.7, R * 0.12, L * 0.12), [0, R * 0.42, -L * 0.42]));
      sensorArray(bucket, L, 0, R * 0.5, L * 0.08, 0.2, true);
      plateBelt(bucket, L, R * 0.9, R * 0.05, L * 0.05, 1, 2, 5, 0.8);
      plateBelt(bucket, L, -R * 0.9, R * 0.05, L * 0.05, -1, 2, 5, 0.8);
      hatch(bucket, L, R * 0.9, -R * 0.25, -L * 0.16, 1, 0.9);
      hatch(bucket, L, -R * 0.9, -R * 0.25, -L * 0.16, -1, 0.9);
      radiator(bucket, L, R * 0.7, R * 0.5, -L * 0.52, 1, 3, 0.8);
      radiator(bucket, L, -R * 0.7, R * 0.5, -L * 0.52, -1, 3, 0.8);
      greebles(bucket, L, R, rng, 16);
      hullClutter(bucket, L, R, rng, 8);
      rcsQuad(bucket, L, -R * 0.85, R * 0.15, L * 0.34);
      rcsQuad(bucket, L, R * 0.85, R * 0.15, L * 0.34);
      // single clean bell + verniers
      addEngineCluster([[0, 0, -L * 0.5 - L * 0.02]], R * 0.72, L * 0.14, 1.1, true);
      addVerniers([[-R * 0.8, R * 0.1, -L * 0.42], [R * 0.8, R * 0.1, -L * 0.42]], R * 0.18);
      addRunningLight(0xff5566, -ringR, 0, -L * 0.06, L * 0.075);
      addRunningLight(0x55ff88, ringR, 0, -L * 0.06, L * 0.075);
      addRunningLight(0xffffff, 0, R * 0.75, L * 0.14, L * 0.05);
      break;
    }

    /* ------------------------------------------------- the manta trader */
    case 'manta': {
      const R = L * 0.12;
      hullR = R;
      const heavy = def.variant === 'heavy';
      // weapon hardpoints: wing pair, nose, outer-wing pair
      hardpoints.push(
        [-L * 0.34, -R * 0.15, L * 0.08],
        [L * 0.34, -R * 0.15, L * 0.08],
        [0, R * 0.35, L * 0.3],
        [-L * 0.5, -R * 0.2, -L * 0.2],
        [L * 0.5, -R * 0.2, -L * 0.2],
      );
      // broad flat hull (manta profile) with a hard taper
      bucket.put('H', fuselage(L * 0.92, R * 1.45, 18, [[0, 0.4], [0.18, 0.85], [0.45, 1], [0.72, 0.8], [0.9, 0.42], [1, 0.08]], 0.32));
      // swept manta wings + dorsal vanes
      bucket.put('H', xf(wingPlate(L * 0.62, L * 0.44, L * 0.12, L * 0.32, L * 0.026), [0, -R * 0.02, -L * 0.14]));
      for (const s of [-1, 1]) {
        bucket.put('T', xf(finPlate(L * 0.2, L * 0.14, L * 0.02, L * 0.08), [s * L * 0.42, R * 0.02, -L * 0.3], [0, 0, -s * 0.35]));
        // wingtip horn cones
        bucket.put('T', xf(new THREE.ConeGeometry(R * 0.16, L * 0.2, 6), [s * L * 0.6, -R * 0.05, -L * 0.25], [Math.PI / 2, 0, s * 0.5]));
      }
      // canopy bubble + cockpit ridge
      bucket.put('G', xf(new THREE.SphereGeometry(R * 0.6, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), [0, R * 0.32, L * 0.28], [0, 0, 0], [1, 0.5, 1.8]));
      bucket.put('T', xf(new THREE.BoxGeometry(R * 0.5, R * 0.3, L * 0.3), [0, R * 0.3, L * 0.02]));
      // belly cargo cells (heavy) or a slim keel
      if (heavy) {
        for (let i = 0; i < 3; i++) {
          const z = L * (0.14 - i * 0.2);
          bucket.put('D', xf(new THREE.BoxGeometry(R * 1.1, R * 0.5, L * 0.16), [0, -R * 0.72, z]));
          bucket.put('A', xf(new THREE.BoxGeometry(R * 1.14, R * 0.05, L * 0.13), [0, -R * 0.95, z]));
        }
      } else {
        bucket.put('D', xf(new THREE.BoxGeometry(R * 0.5, R * 0.4, L * 0.6), [0, -R * 0.6, -L * 0.04]));
      }
      // gill intakes on the wing roots
      for (const s of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          bucket.put('V', xf(new THREE.BoxGeometry(R * 0.3, R * 0.09, L * 0.08), [s * R * 1.15, -R * 0.05, L * (0.16 - i * 0.09)], [0, s * 0.25, 0.2]));
        }
      }
      plateBelt(bucket, L, R * 1.2, R * 0.2, -L * 0.02, 1, 2, 5, 0.9);
      plateBelt(bucket, L, -R * 1.2, R * 0.2, -L * 0.02, -1, 2, 5, 0.9);
      radiator(bucket, L, R * 0.55, R * 0.5, -L * 0.36, 1, 3, 0.8);
      radiator(bucket, L, -R * 0.55, R * 0.5, -L * 0.36, -1, 3, 0.8);
      greebles(bucket, L, R, rng, 16);
      hullClutter(bucket, L, R, rng, 8);
      rcsQuad(bucket, L, -R * 1.1, -R * 0.1, L * 0.3);
      rcsQuad(bucket, L, R * 1.1, -R * 0.1, L * 0.3);
      addEngineCluster([[-R * 0.5, R * 0.02, -L * 0.46], [R * 0.5, R * 0.02, -L * 0.46]], R * 0.38, L * 0.11, 1.0, true);
      addVerniers([[-R * 0.9, R * 0.25, -L * 0.36], [R * 0.9, R * 0.25, -L * 0.36]], R * 0.18);
      addRunningLight(0xff5566, -L * 0.6, -R * 0.02, -L * 0.2, L * 0.07);
      addRunningLight(0x55ff88, L * 0.6, -R * 0.02, -L * 0.2, L * 0.07);
      addRunningLight(0xffffff, 0, R * 0.55, L * 0.06, L * 0.05);
      break;
    }

    /* ------------------------------------------------------ salvage tug */
    case 'tug': {
      const R = L * 0.17;
      hullR = R;
      const heavy = def.variant === 'heavy';
      // weapon hardpoints: shoulder pair
      hardpoints.push(
        [-R * 0.95, -R * 0.15, L * 0.2],
        [R * 0.95, -R * 0.15, L * 0.2],
      );
      // stubby barrel body
      bucket.put('H', fuselage(L * 0.72, R, 12, [[0, 0.8], [0.2, 1], [0.62, 0.96], [0.86, 0.7], [1, 0.32]], 0.95));
      // grapple arms reaching forward
      for (const s of [-1, 1]) {
        pipe(bucket, L, [s * R * 0.7, -R * 0.25, L * 0.26], [s * R * 1.15, R * 0.28, L * 0.5], 0.02, 'T');
        bucket.put('D', xf(new THREE.ConeGeometry(R * 0.13, L * 0.16, 6), [s * R * 1.16, R * 0.3, L * 0.57], [Math.PI / 2, -s * 0.35, 0]));
      }
      // winch drum + tow line
      bucket.put('T', xf(new THREE.CylinderGeometry(R * 0.3, R * 0.3, R * 0.5, 10), [0, R * 0.75, -L * 0.1], [0, 0, Math.PI / 2]));
      pipe(bucket, L, [0, R * 0.75, L * 0.08], [R * 0.6, R * 0.1, L * 0.42], 0.01, 'L');
      // cab, offset to one side like a working boat
      bucket.put('H', xf(new THREE.BoxGeometry(R * 0.7, R * 0.6, L * 0.16), [R * 0.45, R * 0.78, L * 0.2]));
      bucket.put('G', xf(new THREE.BoxGeometry(R * 0.54, R * 0.3, L * 0.02), [R * 0.45, R * 0.9, L * 0.275]));
      // hull plating + heavy fenders
      plateBelt(bucket, L, R * 1.0, -R * 0.3, -L * 0.02, 1, 2, 4, 1.0, 'T');
      plateBelt(bucket, L, -R * 1.0, -R * 0.3, -L * 0.02, -1, 2, 4, 1.0, 'T');
      if (heavy) {
        bucket.put('T', xf(new THREE.BoxGeometry(R * 0.35, R * 1.1, L * 0.3), [0, -R * 0.4, L * 0.3]));
        bucket.put('T', xf(new THREE.BoxGeometry(R * 0.35, R * 1.1, L * 0.3), [0, -R * 0.4, -L * 0.3]));
      }
      hatch(bucket, L, R * 1.0, R * 0.15, -L * 0.2, 1, 0.9);
      radiator(bucket, L, -R * 0.6, R * 0.85, -L * 0.24, -1, 3, 0.75);
      greebles(bucket, L, R, rng, 14);
      hullClutter(bucket, L, R, rng, 8);
      rcsQuad(bucket, L, -R * 1.0, -R * 0.05, L * 0.16);
      rcsQuad(bucket, L, R * 1.0, -R * 0.05, L * 0.16);
      addEngineCluster([[-R * 0.5, -R * 0.05, -L * 0.4], [R * 0.5, -R * 0.05, -L * 0.4]], R * 0.45, L * 0.13, 1.15, true);
      addVerniers([[-R * 0.95, R * 0.3, -L * 0.28], [R * 0.95, R * 0.3, -L * 0.28]], R * 0.2);
      addRunningLight(0xffd9a0, 0, R * 0.55, L * 0.5, L * 0.11);
      addRunningLight(0xff5566, -R * 1.1, -R * 0.25, -R * 0.1, L * 0.07);
      addRunningLight(0x55ff88, R * 1.1, -R * 0.25, -R * 0.1, L * 0.07);
      break;
    }

    /* ------------------------------------------- keel (long mid-weight line) */
    case 'keel': {
      const R = L * 0.11;
      hullR = R;
      // weapon hardpoints: outrigger pair, dorsal pair, chin pair
      hardpoints.push(
        [-R * 1.5, 0, L * 0.18],
        [R * 1.5, 0, L * 0.18],
        [-R * 0.55, R * 0.6, L * 0.02],
        [R * 0.55, R * 0.6, L * 0.02],
        [-R * 0.4, -R * 0.45, L * 0.3],
        [R * 0.4, -R * 0.45, L * 0.3],
      );
      // long low hull with a hard forefoot
      bucket.put('H', fuselage(L * 0.94, R, 12, [[0, 0.55], [0.15, 0.9], [0.55, 1], [0.85, 0.85], [1, 0.55]], 0.55));
      // outrigger hulls, strutted off the flanks
      for (const s of [-1, 1]) {
        bucket.put('T', xf(new THREE.CylinderGeometry(R * 0.3, R * 0.3, L * 0.46, 10), [s * R * 1.5, 0, -L * 0.02], [Math.PI / 2, 0, 0]));
        bucket.put('D', xf(new THREE.ConeGeometry(R * 0.3, L * 0.16, 8), [s * R * 1.5, 0, L * 0.28], [Math.PI / 2, 0, 0]));
        bucket.put('D', xf(new THREE.ConeGeometry(R * 0.26, L * 0.12, 8), [s * R * 1.5, 0, -L * 0.3], [-Math.PI / 2, 0, 0]));
        bucket.put('A', xf(new THREE.BoxGeometry(R * 0.06, R * 0.06, L * 0.12), [s * R * 1.5, R * 0.3, L * 0.16]));
        pipe(bucket, L, [s * R * 0.85, R * 0.05, L * 0.2], [s * R * 1.42, 0, L * 0.2], 0.016, 'T');
        pipe(bucket, L, [s * R * 0.85, R * 0.05, -L * 0.24], [s * R * 1.42, 0, -L * 0.24], 0.016, 'T');
      }
      // dorsal gun deck with a walkway ridge
      bucket.put('T', xf(new THREE.BoxGeometry(R * 1.1, R * 0.35, L * 0.5), [0, R * 0.85, -L * 0.04]));
      windowBand(bucket, L, R * 0.56, R * 0.75, -L * 0.04, Math.PI / 2, 5, L * 0.07);
      windowBand(bucket, L, -R * 0.56, R * 0.75, -L * 0.04, -Math.PI / 2, 5, L * 0.07);
      // bow ram + forecastle
      bucket.put('T', xf(new THREE.ConeGeometry(R * 0.5, L * 0.2, 10), [0, -R * 0.05, L * 0.5], [Math.PI / 2, 0, 0]));
      bucket.put('T', xf(new THREE.BoxGeometry(R * 0.9, R * 0.2, L * 0.12), [0, R * 0.5, L * 0.36], [0.4, 0, 0]));
      // plate belts down both beams
      plateBelt(bucket, L, R * 1.0, -R * 0.2, -L * 0.02, 1, 3, 5, 1.0, 'T');
      plateBelt(bucket, L, -R * 1.0, -R * 0.2, -L * 0.02, -1, 3, 5, 1.0, 'T');
      radiator(bucket, L, R * 0.5, R * 1.0, -L * 0.3, 1, 3, 0.85);
      radiator(bucket, L, -R * 0.5, R * 1.0, -L * 0.3, -1, 3, 0.85);
      hatch(bucket, L, R * 1.0, R * 0.05, -L * 0.16, 1, 1);
      hatch(bucket, L, -R * 1.0, R * 0.05, -L * 0.16, -1, 1);
      sensorArray(bucket, L, 0, R * 0.9, L * 0.28, 0.18, false);
      greebles(bucket, L, R, rng, 18);
      hullClutter(bucket, L, R, rng, 9);
      rcsQuad(bucket, L, -R * 1.0, R * 0.1, L * 0.26);
      rcsQuad(bucket, L, R * 1.0, R * 0.1, L * 0.26);
      // long stern bank of bells
      addEngineCluster([[-R * 0.42, -R * 0.05, -L * 0.45], [R * 0.42, -R * 0.05, -L * 0.45]], R * 0.42, L * 0.11, 1.0, true);
      addVerniers([[-R * 0.9, R * 0.35, -L * 0.34], [R * 0.9, R * 0.35, -L * 0.34]], R * 0.19);
      addRunningLight(0xff5566, -R * 1.5, R * 0.32, L * 0.2, L * 0.055);
      addRunningLight(0x55ff88, R * 1.5, R * 0.32, L * 0.2, L * 0.055);
      addRunningLight(0xffffff, 0, R * 0.95, L * 0.4, L * 0.05);
      break;
    }

    /* ------------------------------------------------- capital wedge (ram) */
    case 'wedge': {
      const R = L * 0.13;
      hullR = R;
      const assault = def.variant === 'assault';
      // weapon hardpoints: flank casemate pairs, deck turrets, prow
      hardpoints.push(
        [-R * 1.35, R * 0.05, L * 0.12],
        [R * 1.35, R * 0.05, L * 0.12],
        [-R * 0.8, R * 0.55, -L * 0.1],
        [R * 0.8, R * 0.55, -L * 0.1],
        [0, R * 0.75, L * 0.16],
        [-R * 0.5, -R * 0.35, L * 0.3],
        [R * 0.5, -R * 0.35, L * 0.3],
        [0, -R * 0.5, L * 0.42],
      );
      // broad arrowhead hull, deep keel, hard taper to the ram
      bucket.put('H', fuselage(L * 0.96, R * 1.5, 16, [[0, 0.42], [0.18, 0.9], [0.5, 1], [0.76, 0.84], [0.92, 0.5], [1, 0.18]], 0.5));
      // swept casemate plates laid back along the flanks
      for (const s of [-1, 1]) {
        bucket.put('T', xf(wingPlate(L * 0.55, L * 0.5, L * 0.16, L * 0.3, L * 0.035), [s * R * 0.95, -R * 0.1, -L * 0.16], [0, 0, 0]));
        // gun steps descending toward the bow
        for (let i = 0; i < 3; i++) {
          bucket.put('T', xf(new THREE.BoxGeometry(R * 0.4, R * 0.34, L * 0.12), [s * R * (1.15 - i * 0.16), R * (0.28 - i * 0.16), L * (0.16 - i * 0.18)]));
          bucket.put('A', xf(new THREE.BoxGeometry(R * 0.42, R * 0.06, L * 0.05), [s * R * (1.15 - i * 0.16), R * (0.4 - i * 0.16), L * (0.2 - i * 0.18)]));
        }
      }
      // prow ram: flattened blade of plate
      bucket.put('T', xf(new THREE.ConeGeometry(R * 0.55, L * 0.22, 12), [0, -R * 0.1, L * 0.55], [Math.PI / 2, 0, 0], [1.4, 1, 0.6]));
      bucket.put('D', xf(new THREE.BoxGeometry(R * 0.3, R * 0.2, L * 0.1), [0, -R * 0.25, L * 0.44]));
      // dorsal command tower + sensor mast
      bucket.put('T', xf(new THREE.BoxGeometry(R * 0.95, R * 0.6, L * 0.2), [0, R * 1.0, -L * 0.14]));
      bucket.put('G', xf(new THREE.BoxGeometry(R * 0.8, R * 0.24, L * 0.012), [0, R * 1.16, L * 0.0]));
      windowBand(bucket, L, R * 0.5, R * 1.0, -L * 0.14, Math.PI / 2, 4, L * 0.045);
      windowBand(bucket, L, -R * 0.5, R * 1.0, -L * 0.14, -Math.PI / 2, 4, L * 0.045);
      antenna(bucket, L, R * 0.3, R * 1.35, -L * 0.2, 0.24, false);
      sensorArray(bucket, L, -R * 0.3, R * 1.35, -L * 0.2, 0.2, true);
      plateBelt(bucket, L, R * 1.4, R * 0.1, -L * 0.02, 1, 3, 6, 1.15, 'T');
      plateBelt(bucket, L, -R * 1.4, R * 0.1, -L * 0.02, -1, 3, 6, 1.15, 'T');
      // deck batteries
      turret(bucket, L, R * 0.35, R * 0.72, L * 0.1, 1.1);
      turret(bucket, L, -R * 0.35, R * 0.72, L * 0.1, 1.1);
      missilePod(bucket, L, R * 0.7, R * 0.62, -L * 0.2, 6, 1.0);
      missilePod(bucket, L, -R * 0.7, R * 0.62, -L * 0.2, 6, 1.0);
      if (assault) {
        // ventral drop bay and landing feet
        bucket.put('D', xf(new THREE.BoxGeometry(R * 1.0, R * 0.5, L * 0.3), [0, -R * 0.6, L * 0.16]));
        bucket.put('A', xf(new THREE.BoxGeometry(R * 1.05, R * 0.06, L * 0.26), [0, -R * 0.86, L * 0.16]));
        for (const s of [-1, 1]) {
          bucket.put('T', xf(new THREE.BoxGeometry(R * 0.3, R * 0.5, L * 0.05), [s * R * 0.9, -R * 0.5, L * 0.3], [0, 0, s * 0.25]));
          bucket.put('T', xf(new THREE.BoxGeometry(R * 0.3, R * 0.5, L * 0.05), [s * R * 0.9, -R * 0.5, -L * 0.16], [0, 0, s * 0.25]));
        }
      } else {
        // battlecruiser: layered extra deck armour
        bucket.put('T', xf(new THREE.BoxGeometry(R * 1.6, R * 0.25, L * 0.4), [0, R * 0.6, -L * 0.02]));
      }
      radiator(bucket, L, R * 0.75, R * 0.8, -L * 0.36, 1, 4, 1.0);
      radiator(bucket, L, -R * 0.75, R * 0.8, -L * 0.36, -1, 4, 1.0);
      hatch(bucket, L, R * 1.45, R * 0.05, -L * 0.1, 1, 1.3);
      hatch(bucket, L, -R * 1.45, R * 0.05, -L * 0.1, -1, 1.3);
      greebles(bucket, L, R, rng, 26);
      hullClutter(bucket, L, R, rng, 12);
      rcsQuad(bucket, L, -R * 1.4, R * 0.2, L * 0.24);
      rcsQuad(bucket, L, R * 1.4, R * 0.2, L * 0.24);
      // capital stern: four heavy bells in a bank
      addEngineCluster([
        [-R * 0.75, R * 0.1, -L * 0.46], [R * 0.75, R * 0.1, -L * 0.46],
        [-R * 0.3, -R * 0.12, -L * 0.5], [R * 0.3, -R * 0.12, -L * 0.5],
      ], R * 0.42, L * 0.1, 1.05, true);
      addVerniers([[-R * 1.3, R * 0.35, -L * 0.34], [R * 1.3, R * 0.35, -L * 0.34]], R * 0.22);
      addRunningLight(0xff5566, -R * 1.5, R * 0.15, -L * 0.05, L * 0.05);
      addRunningLight(0x55ff88, R * 1.5, R * 0.15, -L * 0.05, L * 0.05);
      addRunningLight(0xffffff, 0, R * 1.35, -L * 0.22, L * 0.05);
      addRunningLight(0xaad4ff, 0, -R * 0.2, L * 0.6, L * 0.05);
      break;
    }

    /* ---------------------------------------- citadel (stacked fortress) */
    case 'citadel': {
      const R = L * 0.135;
      hullR = R;
      const cruiser = def.variant === 'cruiser';
      // weapon hardpoints: broadside pairs, deck turrets, prow pair
      hardpoints.push(
        [-R * 1.4, R * 0.1, L * 0.1],
        [R * 1.4, R * 0.1, L * 0.1],
        [-R * 1.25, R * 0.1, -L * 0.24],
        [R * 1.25, R * 0.1, -L * 0.24],
        [0, R * 0.95, L * 0.02],
        [-R * 0.6, R * 0.55, -L * 0.3],
        [R * 0.6, R * 0.55, -L * 0.3],
        [-R * 0.5, -R * 0.3, L * 0.3],
        [R * 0.5, -R * 0.3, L * 0.3],
      );
      // deep chunky base hull
      bucket.put('H', fuselage(L * 0.9, R * 1.3, 14, [[0, 0.6], [0.18, 0.98], [0.68, 1], [0.88, 0.82], [1, 0.42]], 0.6));
      // tiered superstructure: three shrinking slab decks
      const tiers = cruiser ? 2 : 3;
      for (let i = 0; i < tiers; i++) {
        const w = 1.5 - i * 0.34;
        bucket.put('T', xf(new THREE.BoxGeometry(R * w, R * 0.34, L * (0.5 - i * 0.1)), [0, R * (0.95 + i * 0.28), -L * (0.06 + i * 0.01)]));
        bucket.put('A', xf(new THREE.BoxGeometry(R * w * 1.02, R * 0.05, L * (0.5 - i * 0.1)), [0, R * (1.06 + i * 0.28), -L * (0.06 + i * 0.01)]));
        windowBand(bucket, L, R * (w * 0.5 - 0.02), R * (1.02 + i * 0.28), -L * (0.06 + i * 0.01), Math.PI / 2, 4, L * 0.045);
        windowBand(bucket, L, -R * (w * 0.5 - 0.02), R * (1.02 + i * 0.28), -L * (0.06 + i * 0.01), -Math.PI / 2, 4, L * 0.045);
      }
      // central citadel tower with a mast crown
      const top = R * (0.95 + tiers * 0.28);
      bucket.put('T', xf(new THREE.BoxGeometry(R * 0.6, R * 0.5, L * 0.1), [0, top, -L * 0.12]));
      bucket.put('G', xf(new THREE.BoxGeometry(R * 0.5, R * 0.16, L * 0.012), [0, top + R * 0.12, -L * 0.12 + L * 0.05]));
      antenna(bucket, L, R * 0.18, top + R * 0.3, -L * 0.14, 0.3, true);
      sensorArray(bucket, L, -R * 0.18, top + R * 0.3, -L * 0.14, 0.24, false);
      // armoured prow wedge + forecastle
      bucket.put('T', xf(new THREE.ConeGeometry(R * 0.6, L * 0.22, 12), [0, -R * 0.05, L * 0.52], [Math.PI / 2, 0, 0], [1.5, 1, 0.62]));
      bucket.put('T', xf(new THREE.BoxGeometry(R * 1.0, R * 0.3, L * 0.12), [0, R * 0.55, L * 0.32], [0.35, 0, 0]));
      // heavy broadsides: plate rows, missile banks, deck turrets
      plateBelt(bucket, L, R * 1.32, -R * 0.1, -L * 0.02, 1, 3, 6, 1.25, 'T');
      plateBelt(bucket, L, -R * 1.32, -R * 0.1, -L * 0.02, -1, 3, 6, 1.25, 'T');
      missilePod(bucket, L, R * 1.15, R * 0.42, -L * 0.3, 8, 1.15);
      missilePod(bucket, L, -R * 1.15, R * 0.42, -L * 0.3, 8, 1.15);
      turret(bucket, L, R * 0.7, R * 0.75, L * 0.14, 1.25, 0.5);
      turret(bucket, L, -R * 0.7, R * 0.75, L * 0.14, 1.25, -0.5);
      turret(bucket, L, 0, R * 0.8, -L * 0.34, 1.15, 0);
      radiator(bucket, L, R * 0.8, R * 0.9, -L * 0.4, 1, 4, 1.1);
      radiator(bucket, L, -R * 0.8, R * 0.9, -L * 0.4, -1, 4, 1.1);
      hatch(bucket, L, R * 1.42, R * 0.0, -L * 0.08, 1, 1.4);
      hatch(bucket, L, -R * 1.42, R * 0.0, -L * 0.08, -1, 1.4);
      greebles(bucket, L, R, rng, 30);
      hullClutter(bucket, L, R, rng, 14);
      rcsQuad(bucket, L, -R * 1.35, R * 0.25, L * 0.22);
      rcsQuad(bucket, L, R * 1.35, R * 0.25, L * 0.22);
      // massive stern block of bells
      addEngineCluster([
        [-R * 0.7, R * 0.15, -L * 0.44], [R * 0.7, R * 0.15, -L * 0.44],
        [-R * 0.32, -R * 0.15, -L * 0.5], [R * 0.32, -R * 0.15, -L * 0.5],
      ], R * 0.45, L * 0.1, 1.1, true);
      addVerniers([[-R * 1.2, R * 0.4, -L * 0.36], [R * 1.2, R * 0.4, -L * 0.36]], R * 0.24);
      addRunningLight(0xff5566, -R * 1.5, R * 0.2, L * 0.05, L * 0.05);
      addRunningLight(0x55ff88, R * 1.5, R * 0.2, L * 0.05, L * 0.05);
      addRunningLight(0xffffff, 0, top + R * 0.55, -L * 0.12, L * 0.045);
      break;
    }

    /* --------------------------------------------------- ark (carrier) */
    case 'ark': {
      const R = L * 0.12;
      hullR = R;
      const superHull = def.variant === 'super';
      const fleet = def.variant === 'fleet' || superHull;
      // weapon hardpoints: deck edge pairs, bow pair, stern turrets
      hardpoints.push(
        [-R * 1.15, R * 1.0, L * 0.1],
        [R * 1.15, R * 1.0, L * 0.1],
        [-R * 1.0, R * 0.9, -L * 0.26],
        [R * 1.0, R * 0.9, -L * 0.26],
        [-R * 0.5, R * 0.4, L * 0.34],
        [R * 0.5, R * 0.4, L * 0.34],
        [0, R * 1.5, -L * 0.3],
      );
      // fat hull under the deck
      bucket.put('H', fuselage(L * 0.92, R, 14, [[0, 0.55], [0.16, 0.92], [0.6, 1], [0.86, 0.85], [1, 0.5]], 0.8));
      // flight deck slab with hazard edging
      const deckY = R * 0.82;
      bucket.put('T', xf(new THREE.BoxGeometry(R * 1.9, R * 0.2, L * 0.74), [0, deckY, -L * 0.04]));
      bucket.put('A', xf(new THREE.BoxGeometry(R * 1.92, R * 0.03, L * 0.74), [0, deckY - R * 0.1, -L * 0.04]));
      for (let i = 0; i < 5; i++) {
        bucket.put('A', xf(new THREE.BoxGeometry(R * 0.06, R * 0.04, L * 0.5), [R * (0.62 - i * 0.3), deckY + R * 0.12, -L * 0.04]));
      }
      // bow ramp, angled over the prow
      bucket.put('T', xf(new THREE.BoxGeometry(R * 1.5, R * 0.16, L * 0.16), [0, deckY - R * 0.1, L * 0.4], [-0.3, 0, 0]));
      bucket.put('D', xf(new THREE.BoxGeometry(R * 1.2, R * 0.1, L * 0.05), [0, deckY - R * 0.2, L * 0.46], [-0.3, 0, 0]));
      // island tower (offset, like a flattop's), second island for big decks
      const islands = superHull ? [[R * 0.62, deckY], [-R * 0.62, deckY]] : fleet ? [[R * 0.62, deckY], [R * 0.62, deckY + R * 0.5]] : [[R * 0.62, deckY]];
      for (const [ix, iy] of islands) {
        bucket.put('T', xf(new THREE.BoxGeometry(R * 0.5, R * 0.5, L * 0.14), [ix, iy + R * 0.3, -L * 0.24]));
        bucket.put('G', xf(new THREE.BoxGeometry(R * 0.44, R * 0.2, L * 0.012), [ix, iy + R * 0.42, -L * 0.24 + L * 0.07]));
        antenna(bucket, L, ix, iy + R * 0.55, -L * 0.26, 0.3, false);
        antenna(bucket, L, ix + R * 0.14, iy + R * 0.55, -L * 0.26, 0.22, true);
      }
      if (superHull) {
        // a second flight gallery above the first
        bucket.put('T', xf(new THREE.BoxGeometry(R * 1.7, R * 0.18, L * 0.6), [0, deckY + R * 0.85, -L * 0.06]));
        bucket.put('A', xf(new THREE.BoxGeometry(R * 1.72, R * 0.03, L * 0.6), [0, deckY + R * 0.76, -L * 0.06]));
        for (const s of [-1, 1]) pipe(bucket, L, [s * R * 0.85, deckY, -L * 0.3], [s * R * 0.8, deckY + R * 0.9, -L * 0.08], 0.02, 'T');
        for (const s of [-1, 1]) pipe(bucket, L, [s * R * 0.85, deckY, L * 0.22], [s * R * 0.8, deckY + R * 0.9, L * 0.18], 0.02, 'T');
      }
      // hangar mouth at the stern + flank deck-edge doors
      bucket.put('D', xf(new THREE.BoxGeometry(R * 1.3, R * 0.7, L * 0.08), [0, deckY - R * 0.15, -L * 0.4]));
      bucket.put('A', xf(new THREE.BoxGeometry(R * 1.34, R * 0.06, L * 0.1), [0, deckY - R * 0.5, -L * 0.4]));
      for (const s of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          bucket.put('D', xf(new THREE.BoxGeometry(R * 0.06, R * 0.4, L * 0.07), [s * R * 1.0, deckY - R * 0.55, L * (0.18 - i * 0.16)]));
          bucket.put('A', xf(new THREE.BoxGeometry(R * 0.08, R * 0.05, L * 0.07), [s * R * 1.0, deckY - R * 0.36, L * (0.18 - i * 0.16)]));
        }
      }
      // defensive turrets on the deck edge
      turret(bucket, L, -R * 0.95, deckY - R * 0.05, L * 0.28, 1.0, 0.6);
      turret(bucket, L, R * 0.95, deckY - R * 0.05, L * 0.28, 1.0, -0.6);
      // deck-edge running lights, port red starboard green
      for (let i = 0; i < 4; i++) {
        const lz = L * (0.26 - i * 0.18);
        addRunningLight(0xff5566, -R * 0.98, deckY + R * 0.12, lz, L * 0.028);
        addRunningLight(0x55ff88, R * 0.98, deckY + R * 0.12, lz, L * 0.028);
      }
      plateBelt(bucket, L, R * 1.1, -R * 0.25, -L * 0.02, 1, 3, 6, 1.15, 'T');
      plateBelt(bucket, L, -R * 1.1, -R * 0.25, -L * 0.02, -1, 3, 6, 1.15, 'T');
      radiator(bucket, L, R * 0.9, -R * 0.7, -L * 0.36, 1, 3, 1.0);
      radiator(bucket, L, -R * 0.9, -R * 0.7, -L * 0.36, -1, 3, 1.0);
      hatch(bucket, L, R * 1.1, -R * 0.3, L * 0.06, 1, 1.3);
      hatch(bucket, L, -R * 1.1, -R * 0.3, L * 0.06, -1, 1.3);
      greebles(bucket, L, R, rng, 28);
      hullClutter(bucket, L, R, rng, 12);
      rcsQuad(bucket, L, -R * 1.15, R * 0.1, L * 0.3);
      rcsQuad(bucket, L, R * 1.15, R * 0.1, L * 0.3);
      // wide stern bank: the hangar deck's engines
      addEngineCluster([
        [-R * 0.75, R * 0.1, -L * 0.46], [R * 0.75, R * 0.1, -L * 0.46],
        [-R * 0.28, -R * 0.2, -L * 0.48], [R * 0.28, -R * 0.2, -L * 0.48],
        [0, R * 0.28, -L * 0.44],
      ], R * 0.4, L * 0.09, 1.1, true);
      addVerniers([[-R * 1.05, R * 0.35, -L * 0.36], [R * 1.05, R * 0.35, -L * 0.36]], R * 0.2);
      addRunningLight(0xffffff, 0, deckY + R * 0.3, L * 0.34, L * 0.045);
      addRunningLight(0xffd9a0, 0, deckY + R * 0.2, -L * 0.36, L * 0.05);
      break;
    }

    /* ------------------------------------------------- crown (flagship) */
    case 'crown': {
      const R = L * 0.125;
      hullR = R;
      const command = def.variant === 'command';
      // weapon hardpoints: prong tips, broadside pairs, deck turrets
      hardpoints.push(
        [-R * 0.62, 0, L * 0.52],
        [R * 0.62, 0, L * 0.52],
        [-R * 1.35, R * 0.1, L * 0.02],
        [R * 1.35, R * 0.1, L * 0.02],
        [-R * 1.2, R * 0.1, -L * 0.26],
        [R * 1.2, R * 0.1, -L * 0.26],
        [0, R * 0.95, -L * 0.06],
        [-R * 0.65, R * 0.6, -L * 0.34],
        [R * 0.65, R * 0.6, -L * 0.34],
      );
      // massive core hull
      bucket.put('H', fuselage(L * 0.86, R * 1.25, 16, [[0, 0.6], [0.18, 0.98], [0.6, 1], [0.85, 0.85], [1, 0.5]], 0.6));
      // twin prong prow around a heavy lance battery
      for (const s of [-1, 1]) {
        bucket.put('T', xf(new THREE.CylinderGeometry(R * 0.28, R * 0.34, L * 0.42, 10), [s * R * 0.62, 0, L * 0.3], [Math.PI / 2, 0, 0]));
        bucket.put('T', xf(new THREE.ConeGeometry(R * 0.34, L * 0.18, 10), [s * R * 0.62, 0, L * 0.58], [Math.PI / 2, 0, 0]));
        bucket.put('A', xf(new THREE.BoxGeometry(R * 0.1, R * 0.1, L * 0.1), [s * R * 0.62, R * 0.2, L * 0.44]));
        // web plates tying prongs to the core
        bucket.put('T', xf(new THREE.BoxGeometry(R * 0.5, R * 0.22, L * 0.16), [s * R * 0.62, 0, L * 0.14], [0, s * 0.2, 0]));
        pipe(bucket, L, [s * R * 0.55, R * 0.25, L * 0.5], [s * R * 0.5, R * 0.55, L * 0.06], 0.02, 'T');
      }
      bucket.put('D', xf(new THREE.BoxGeometry(R * 0.75, R * 0.45, L * 0.24), [0, 0, L * 0.3]));
      bucket.put('A', xf(new THREE.BoxGeometry(R * 0.8, R * 0.06, L * 0.2), [0, -R * 0.28, L * 0.3]));
      // crown of aft fins, fanned like a sceptre head
      bucket.put('T', xf(finPlate(L * 0.16, L * 0.2, L * 0.03, -L * 0.06), [0, R * 1.0, -L * 0.34]));
      for (const s of [-1, 1]) {
        bucket.put('T', xf(finPlate(L * 0.14, L * 0.16, L * 0.03, -L * 0.05), [s * R * 0.4, R * 0.95, -L * 0.36], [0, 0, -s * 0.18]));
      }
      // two-tier superstructure; command variant adds the flag mast
      for (let i = 0; i < 2; i++) {
        const w = 1.35 - i * 0.4;
        bucket.put('T', xf(new THREE.BoxGeometry(R * w, R * 0.4, L * (0.42 - i * 0.08)), [0, R * (1.0 + i * 0.33), -L * (0.08 + i * 0.01)]));
        windowBand(bucket, L, R * (w * 0.5 - 0.02), R * (1.1 + i * 0.33), -L * (0.08 + i * 0.01), Math.PI / 2, 4, L * 0.045);
        windowBand(bucket, L, -R * (w * 0.5 - 0.02), R * (1.1 + i * 0.33), -L * (0.08 + i * 0.01), -Math.PI / 2, 4, L * 0.045);
      }
      const top = R * 1.66;
      bucket.put('G', xf(new THREE.BoxGeometry(R * 0.5, R * 0.18, L * 0.01), [0, top + R * 0.1, -L * 0.04]));
      antenna(bucket, L, 0, top + R * 0.3, -L * 0.1, command ? 0.4 : 0.28, false);
      sensorArray(bucket, L, R * 0.35, top + R * 0.28, -L * 0.1, 0.2, command);
      sensorArray(bucket, L, -R * 0.35, top + R * 0.28, -L * 0.1, 0.2, false);
      if (command) {
        // ceremonial mast ring + extra beacon
        pipe(bucket, L, [0, top + R * 0.5, -L * 0.08], [R * 0.7, top + R * 0.2, -L * 0.12], 0.02, 'T');
        pipe(bucket, L, [0, top + R * 0.5, -L * 0.08], [-R * 0.7, top + R * 0.2, -L * 0.12], 0.02, 'T');
        addRunningLight(0xaad4ff, 0, top + R * 0.62, -L * 0.08, L * 0.06);
      }
      // broadsides: plates, missile banks, three turrets a side
      plateBelt(bucket, L, R * 1.3, -R * 0.1, -L * 0.02, 1, 3, 6, 1.25, 'T');
      plateBelt(bucket, L, -R * 1.3, -R * 0.1, -L * 0.02, -1, 3, 6, 1.25, 'T');
      missilePod(bucket, L, R * 1.05, R * 0.42, -L * 0.34, 8, 1.2);
      missilePod(bucket, L, -R * 1.05, R * 0.42, -L * 0.34, 8, 1.2);
      turret(bucket, L, R * 0.75, R * 0.7, L * 0.2, 1.3, 0.4);
      turret(bucket, L, -R * 0.75, R * 0.7, L * 0.2, 1.3, -0.4);
      turret(bucket, L, R * 0.7, R * 0.7, -L * 0.16, 1.2, 0.2);
      turret(bucket, L, -R * 0.7, R * 0.7, -L * 0.16, 1.2, -0.2);
      turret(bucket, L, R * 0.65, R * 0.68, -L * 0.34, 1.1, 0);
      turret(bucket, L, -R * 0.65, R * 0.68, -L * 0.34, 1.1, 0);
      radiator(bucket, L, R * 0.8, R * 0.85, -L * 0.4, 1, 4, 1.15);
      radiator(bucket, L, -R * 0.8, R * 0.85, -L * 0.4, -1, 4, 1.15);
      hatch(bucket, L, R * 1.35, -R * 0.05, L * 0.0, 1, 1.4);
      hatch(bucket, L, -R * 1.35, -R * 0.05, L * 0.0, -1, 1.4);
      greebles(bucket, L, R, rng, 32);
      hullClutter(bucket, L, R, rng, 14);
      rcsQuad(bucket, L, -R * 1.3, R * 0.2, L * 0.18);
      rcsQuad(bucket, L, R * 1.3, R * 0.2, L * 0.18);
      // flagship stern: six bells in two banks
      addEngineCluster([
        [-R * 0.8, R * 0.15, -L * 0.46], [R * 0.8, R * 0.15, -L * 0.46],
        [-R * 0.34, -R * 0.12, -L * 0.5], [R * 0.34, -R * 0.12, -L * 0.5],
        [0, R * 0.4, -L * 0.42],
      ], R * 0.42, L * 0.09, 1.15, true);
      addVerniers([[-R * 1.25, R * 0.4, -L * 0.36], [R * 1.25, R * 0.4, -L * 0.36]], R * 0.24);
      addRunningLight(0xff5566, -R * 1.45, R * 0.15, L * 0.05, L * 0.05);
      addRunningLight(0x55ff88, R * 1.45, R * 0.15, L * 0.05, L * 0.05);
      addRunningLight(0xffffff, 0, -R * 0.15, L * 0.62, L * 0.055);
      break;
    }

    /* ----------------------------------------- ring-drive habitat (liner) */
    case 'torus': {
      const R = L * 0.1;
      hullR = R;
      const heavy = def.variant === 'heavy';
      const fleet = def.variant === 'fleet';
      const ringR = L * (heavy ? 0.25 : fleet ? 0.22 : 0.19);
      const tube = ringR * (heavy ? 0.28 : 0.22);
      // hardpoints: prow pair, spine, waist pair, stern pair, keel
      hardpoints.push(
        [-L * 0.13, -R * 0.5, L * 0.34], [L * 0.13, -R * 0.5, L * 0.34],
        [0, R * 0.66, L * 0.24],
        [-L * 0.24, -R * 0.2, 0], [L * 0.24, -R * 0.2, 0],
        [-L * 0.18, -R * 0.35, -L * 0.3], [L * 0.18, -R * 0.35, -L * 0.3],
        [0, -R * 0.5, -L * 0.44],
      );
      // the spine: one long flattened hull threaded through the hub
      bucket.put('H', fuselage(L, R, 14, null, 0.8));
      // prow: armoured wedge, shoulder domes, mast
      bucket.put('T', xf(new THREE.ConeGeometry(R * 0.8, L * 0.15, 12), [0, 0, L * 0.52], [Math.PI / 2, 0, 0]));
      bucket.put('D', xf(new THREE.CylinderGeometry(R * 0.34, R * 0.44, L * 0.08, 10), [0, 0, L * 0.45], [Math.PI / 2, 0, 0]));
      bucket.put('A', xf(new THREE.SphereGeometry(R * 0.24, 10, 8), [0, 0, L * 0.57]));
      for (const s of [-1, 1]) {
        bucket.put('D', xf(new THREE.SphereGeometry(R * 0.3, 10, 8), [s * R * 0.72, 0, L * 0.3]));
        antenna(bucket, L, s * R * 0.5, R * 0.5, L * 0.2, L * 0.07, true);
      }
      // the habitation ring: torus, keel band, hub spokes, lit outer windows
      bucket.put('T', xf(new THREE.TorusGeometry(ringR, tube, 10, 30)));
      bucket.put('D', xf(new THREE.TorusGeometry(ringR, tube * 0.32, 6, 26), [0, 0, -tube * 0.95]));
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        bucket.put('L', xf(new THREE.BoxGeometry(tube * 0.45, ringR, R * 0.42), [Math.cos(a) * ringR * 0.5, Math.sin(a) * ringR * 0.5, 0], [0, 0, a]));
      }
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        bucket.put('A', xf(new THREE.BoxGeometry(tube * 0.42, tube * 0.18, R * 0.3), [Math.cos(a) * (ringR + tube * 0.72), Math.sin(a) * (ringR + tube * 0.72), 0], [0, 0, a]));
      }
      for (const s of [-1, 1]) {
        for (const a of [0.7, 2.44]) {
          pipe(bucket, L, [0, 0, s * L * 0.14], [Math.cos(a) * ringR * 0.8, Math.sin(a) * ringR * 0.8, s * L * 0.05], 0.008);
        }
      }
      // detail pass
      plateBelt(bucket, L, R * 0.94, R * 0.1, L * 0.1, 1, 2, 5, 1);
      plateBelt(bucket, L, -R * 0.94, R * 0.1, L * 0.1, -1, 2, 5, 1);
      hatch(bucket, L, R * 0.96, -R * 0.05, -L * 0.2, 1, 1.1);
      hatch(bucket, L, -R * 0.96, -R * 0.05, -L * 0.2, -1, 1.1);
      radiator(bucket, L, R * 0.86, R * 0.3, -L * 0.34, 1, 4, 1);
      radiator(bucket, L, -R * 0.86, R * 0.3, -L * 0.34, -1, 4, 1);
      turret(bucket, L, R * 0.7, R * 0.55, -L * 0.06, 1.1, 0.3);
      turret(bucket, L, -R * 0.7, R * 0.55, -L * 0.06, 1.1, -0.3);
      sensorArray(bucket, L, 0, R * 0.72, -L * 0.26, 0.2);
      greebles(bucket, L, R, rng, 22);
      hullClutter(bucket, L, R, rng, 10);
      rcsQuad(bucket, L, -R * 0.9, R * 0.2, L * 0.26);
      rcsQuad(bucket, L, R * 0.9, R * 0.2, L * 0.26);
      // propulsion: a linear bank on the spine stern, verniers out on the ring
      addEngineCluster([
        [0, R * 0.05, -L * 0.5], [-R * 0.85, R * 0.05, -L * 0.46], [R * 0.85, R * 0.05, -L * 0.46],
      ], R * 0.42, L * 0.09, 1.1, heavy);
      addVerniers([[-ringR * 0.72, 0, -L * 0.08], [ringR * 0.72, 0, -L * 0.08]], R * 0.26);
      addRunningLight(0xff5566, -ringR * 1.12, 0, L * 0.02, L * 0.05);
      addRunningLight(0x55ff88, ringR * 1.12, 0, L * 0.02, L * 0.05);
      addRunningLight(0xffffff, 0, 0, L * 0.63, L * 0.05);
      break;
    }

    /* ----------------------------------------------- twin-hull catamaran */
    case 'cat': {
      const R = L * 0.072;
      hullR = R;
      const heavy = def.variant === 'heavy';
      const span = L * (heavy ? 0.19 : 0.23);
      hardpoints.push(
        [-span, -R * 0.3, L * 0.3], [span, -R * 0.3, L * 0.3],
        [0, R * 1.55, L * 0.06],
        [-span * 1.12, R * 0.2, -L * 0.1], [span * 1.12, R * 0.2, -L * 0.1],
        [0, -R * 0.7, -L * 0.3], [0, R * 1.1, -L * 0.26],
      );
      for (const s of [-1, 1]) {
        // slim outrigger hull with a plough bow
        bucket.put('H', xf(fuselage(L * 0.92, R, 12, null, 0.85), [s * span, 0, 0]));
        bucket.put('T', xf(new THREE.ConeGeometry(R * 0.9, L * 0.12, 10), [s * span, 0, L * 0.48], [Math.PI / 2, 0, 0]));
        plateBelt(bucket, L, s * span + s * R * 0.95, R * 0.05, L * 0.02, s, 2, 5, 0.8);
        hatch(bucket, L, s * span + s * R * 0.96, -R * 0.05, -L * 0.2, s, 0.9);
        vent(bucket, L, s * span, R * 0.9, -L * 0.3, 0);
      }
      // cross-deck: three armoured bridges, a boom, cable runs
      bucket.put('T', xf(new THREE.BoxGeometry(span * 2.05, R * 0.5, L * 0.2), [0, 0, L * 0.2]));
      bucket.put('T', xf(new THREE.BoxGeometry(span * 2.0, R * 0.42, L * 0.16), [0, R * 0.1, -L * 0.06]));
      bucket.put('T', xf(new THREE.BoxGeometry(span * 1.85, R * 0.4, L * 0.14), [0, 0, -L * 0.3]));
      bucket.put('H', xf(new THREE.BoxGeometry(span * 0.6, R * 1.9, L * 0.34), [0, R * 0.9, L * 0.04]));
      // bridge island: glass band, lit sill, sensor mast
      bucket.put('G', xf(new THREE.BoxGeometry(span * 0.52, R * 0.5, L * 0.06), [0, R * 1.7, L * 0.18]));
      bucket.put('A', xf(new THREE.BoxGeometry(span * 0.62, R * 0.08, L * 0.28), [0, R * 1.75, 0]));
      sensorArray(bucket, L, 0, R * 2.2, -L * 0.02, 0.18);
      bucket.put('D', xf(new THREE.BoxGeometry(span * 0.34, R * 0.3, L * 0.5), [0, -R * 0.5, -L * 0.12]));
      for (const s of [-1, 1]) {
        pipe(bucket, L, [s * span * 0.5, R * 0.4, L * 0.24], [s * span * 0.95, -R * 0.1, -L * 0.24], 0.006);
        radiator(bucket, L, s * span * 0.55, R * 0.9, -L * 0.34, s, 3, 0.7);
        turret(bucket, L, s * span * 0.5, R * 0.75, L * 0.26, 0.9, s * 0.3);
        missilePod(bucket, L, s * span * 0.6, -R * 0.2, L * 0.1, 4, 0.7);
        rcsQuad(bucket, L, s * span, R * 0.25, L * 0.12);
      }
      greebles(bucket, L, R, rng, 20);
      hullClutter(bucket, L, R, rng, 10);
      // propulsion: one bank per hull — the reason a catamaran is fast
      for (const s of [-1, 1]) {
        addEngineCluster([
          [s * span, R * 0.06, -L * 0.48], [s * span * 1.04, -R * 0.35, -L * 0.44],
        ], R * 0.42, L * 0.08, 0.95);
      }
      addVerniers([[-span * 0.6, R * 0.3, -L * 0.2], [span * 0.6, R * 0.3, -L * 0.2]], R * 0.24);
      addRunningLight(0xff5566, -span, R * 0.4, L * 0.16, L * 0.045);
      addRunningLight(0x55ff88, span, R * 0.4, L * 0.16, L * 0.045);
      addRunningLight(0xffffff, 0, R * 2.4, -L * 0.06, L * 0.05);
      break;
    }

    /* ------------------------------------------------ flying-wing delta */
    case 'dart': {
      const R = L * 0.062;
      hullR = R;
      const heavy = def.variant === 'heavy';
      const span = L * (heavy ? 0.5 : 0.44);
      hardpoints.push(
        [-L * 0.16, -R * 0.4, L * 0.06], [L * 0.16, -R * 0.4, L * 0.06],
        [0, R * 0.5, L * 0.02],
        [-L * 0.34, -R * 0.3, -L * 0.16], [L * 0.34, -R * 0.3, -L * 0.16],
      );
      // one broad lifting body: a thick delta plate, no separate fuselage
      const plan = new THREE.Shape();
      plan.moveTo(0, L * 0.5);
      plan.lineTo(span, -L * 0.24);
      plan.lineTo(span * 0.84, -L * 0.4);
      plan.lineTo(-span * 0.84, -L * 0.4);
      plan.lineTo(-span, -L * 0.24);
      plan.closePath();
      bucket.put('H', xf(new THREE.ExtrudeGeometry(plan, {
        depth: R * 1.15, bevelEnabled: true, bevelThickness: R * 0.4, bevelSize: R * 0.34, bevelSegments: 1,
      }), [0, R * 0.35, 0], [Math.PI / 2, 0, 0]));
      // armoured leading edge, spine strake, cockpit blister
      bucket.put('T', xf(new THREE.BoxGeometry(span * 1.5, R * 0.3, L * 0.16), [0, R * 0.55, L * 0.14]));
      bucket.put('A', xf(new THREE.BoxGeometry(span * 1.2, R * 0.06, L * 0.03), [0, R * 0.67, L * 0.2]));
      bucket.put('G', xf(new THREE.SphereGeometry(R * 1.5, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.5), [0, R * 0.5, L * 0.14], [0, 0, 0], [1, 0.42, 1.7]));
      bucket.put('D', xf(new THREE.BoxGeometry(R * 0.5, R * 0.16, L * 0.05), [0, R * 0.6, -L * 0.02]));
      // wingtip fins, nav lenses, intake louvres, strake domes
      for (const s of [-1, 1]) {
        bucket.put('H', xf(finPlate(L * 0.2, L * 0.1, L * 0.016, L * 0.05), [s * span * 0.8, R * 0.35, -L * 0.3], [0, 0, -s * 0.18]));
        bucket.put('A', xf(new THREE.BoxGeometry(L * 0.005, L * 0.024, L * 0.06), [s * span * 0.8, R * 0.35 + L * 0.07, -L * 0.3], [0, 0, -s * 0.18]));
        vent(bucket, L, s * span * 0.54, R * 0.72, L * 0.06, s * 0.4);
        rcsQuad(bucket, L, s * span * 0.48, R * 0.25, L * 0.2);
        bucket.put('L', xf(new THREE.SphereGeometry(R * 0.3, 8, 6), [s * span * 0.62, R * 0.7, -L * 0.14]));
        bucket.put('D', xf(new THREE.BoxGeometry(R * 1.6, R * 0.24, L * 0.14), [s * span * 0.45, R * 0.42, -L * 0.2]));
      }
      greebles(bucket, L, R, rng, 16);
      hullClutter(bucket, L, R, rng, 8);
      // propulsion: three recessed nozzles buried in the trailing edge
      addEngineCluster([
        [0, R * 0.45, -L * 0.4], [-L * 0.12, R * 0.45, -L * 0.39], [L * 0.12, R * 0.45, -L * 0.39],
      ], R * 0.34, L * 0.06, 0.8);
      addRunningLight(0xff5566, -span * 0.86, R * 0.3, -L * 0.24, L * 0.05);
      addRunningLight(0x55ff88, span * 0.86, R * 0.3, -L * 0.24, L * 0.05);
      addRunningLight(0xffffff, 0, R * 0.7, L * 0.4, L * 0.05);
      break;
    }

    /* ------------------------------------- spinal lance (outrigger drive) */
    case 'lance': {
      const R = L * 0.062;
      hullR = R;
      const heavy = def.variant === 'heavy';
      hardpoints.push(
        [0, R * 0.55, L * 0.34],
        [-L * 0.1, -R * 0.4, L * 0.12], [L * 0.1, -R * 0.4, L * 0.12],
        [-L * 0.16, R * 0.1, -L * 0.12], [L * 0.16, R * 0.1, -L * 0.12],
      );
      // a needle: one long slim spindle, thin at the waist, plated aft
      bucket.put('H', fuselage(L * 1.08, R, 12, [
        [0, 0.5], [0.06, 0.72], [0.18, 0.92], [0.38, 1.0], [0.58, 0.98], [0.74, 0.84], [0.88, 0.6], [0.96, 0.3], [1, 0],
      ], 0.66));
      // prow: spinal gun housing, muzzle, targeting eye
      bucket.put('T', xf(new THREE.CylinderGeometry(R * 0.5, R * 0.78, L * 0.24, 10), [0, R * 0.05, L * 0.42], [Math.PI / 2, 0, 0]));
      bucket.put('D', xf(new THREE.CylinderGeometry(R * 0.26, R * 0.3, L * 0.14, 8), [0, R * 0.05, L * 0.6], [Math.PI / 2, 0, 0]));
      bucket.put('N', xf(new THREE.CylinderGeometry(R * 0.18, R * 0.2, L * 0.04, 8), [0, R * 0.05, L * 0.68], [Math.PI / 2, 0, 0]));
      bucket.put('A', xf(new THREE.SphereGeometry(R * 0.16, 8, 6), [0, R * 0.5, L * 0.4]));
      // engine booms carried amidships — the drives sit forward of the stern
      for (const s of [-1, 1]) {
        bucket.put('T', xf(new THREE.CylinderGeometry(R * 0.34, R * 0.4, L * 0.3, 8), [s * R * 1.55, -R * 0.05, L * 0.1], [Math.PI / 2, 0, 0]));
        bucket.put('D', xf(new THREE.BoxGeometry(R * 0.24, R * 0.5, L * 0.2), [s * R * 0.9, -R * 0.05, L * 0.1]));
        pipe(bucket, L, [s * R * 0.6, 0, L * 0.24], [s * R * 1.4, 0, L * 0.24], 0.006);
        plateBelt(bucket, L, s * R * 0.95, R * 0.1, 0, s, 2, 5, 0.75);
        vent(bucket, L, s * R * 0.8, R * 0.5, -L * 0.08, s * 0.6);
        rcsQuad(bucket, L, s * R * 0.85, R * 0.15, L * 0.3);
      }
      bucket.put('H', xf(finPlate(L * 0.22, L * 0.14, L * 0.02, L * 0.08), [0, R * 0.5, -L * 0.3]));
      radiator(bucket, L, R * 0.7, R * 0.6, -L * 0.24, 1, 3, 0.7);
      radiator(bucket, L, -R * 0.7, R * 0.6, -L * 0.24, -1, 3, 0.7);
      hatch(bucket, L, R * 0.95, -R * 0.1, L * 0.05, 1, 0.8);
      hatch(bucket, L, -R * 0.95, -R * 0.1, L * 0.05, -1, 0.8);
      greebles(bucket, L, R, rng, 16);
      hullClutter(bucket, L, R, rng, 8);
      // propulsion: two heavy outrigger bells on the booms, one small stern bell
      addEngineCluster([
        [-R * 1.55, -R * 0.05, -L * 0.06], [R * 1.55, -R * 0.05, -L * 0.06],
      ], R * 0.58, L * 0.15, 1.15, heavy);
      addEngineCluster([[0, 0, -L * 0.55]], R * 0.42, L * 0.09, 0.9);
      addVerniers([[-R * 0.6, -R * 0.3, L * 0.4], [R * 0.6, -R * 0.3, L * 0.4]], R * 0.2);
      addRunningLight(0xff5566, -R * 1.8, 0, L * 0.2, L * 0.06);
      addRunningLight(0x55ff88, R * 1.8, 0, L * 0.2, L * 0.06);
      addRunningLight(0xffffff, 0, R * 0.6, L * 0.72, L * 0.05);
      break;
    }

    /* ------------------------------------ radial-pod industrial (crab) */
    case 'crab': {
      const R = L * 0.085;
      hullR = R;
      const heavy = def.variant === 'heavy';
      const podR = L * (heavy ? 0.36 : 0.32);
      hardpoints.push(
        [0, R * 0.7, L * 0.3],
        [-L * 0.2, -R * 0.5, L * 0.1], [L * 0.2, -R * 0.5, L * 0.1],
        [0, -R * 0.95, -L * 0.28], [0, R * 0.95, -L * 0.28],
        [-L * 0.28, 0, -L * 0.12], [L * 0.28, 0, -L * 0.12],
      );
      // a short central spine with a cutting head forward
      bucket.put('H', xf(fuselage(L * 0.78, R * 0.72, 12, null, 0.8)));
      bucket.put('T', xf(new THREE.CylinderGeometry(R * 0.62, R * 0.5, L * 0.1, 12), [0, 0, L * 0.4], [Math.PI / 2, 0, 0]));
      bucket.put('L', xf(new THREE.TorusGeometry(R * 0.6, R * 0.09, 6, 16), [0, 0, L * 0.45]));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        bucket.put('D', xf(new THREE.ConeGeometry(R * 0.14, L * 0.05, 6), [Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, L * 0.48], [Math.PI / 2, 0, 0]));
      }
      // four pods on truss arms, each with its own bell, lamp and cradle
      for (const a of heavy ? [0.55, 1.9, 3.7, 5.05] : [0.62, 2.14, 3.76, 5.28]) {
        const px = Math.cos(a) * podR;
        const py = Math.sin(a) * podR;
        pipe(bucket, L, [Math.cos(a) * R * 0.7, Math.sin(a) * R * 0.7, -L * 0.02], [px, py, -L * 0.02], 0.01, 'T');
        pipe(bucket, L, [Math.cos(a) * R * 0.7, Math.sin(a) * R * 0.7, L * 0.14], [px, py, L * 0.1], 0.007);
        bucket.put('H', xf(new THREE.CylinderGeometry(R * 0.5, R * 0.56, L * 0.34, 10), [px, py, 0], [Math.PI / 2, 0, 0]));
        bucket.put('T', xf(new THREE.TorusGeometry(R * 0.52, R * 0.08, 6, 14), [px, py, L * 0.17]));
        bucket.put('A', xf(new THREE.SphereGeometry(R * 0.14, 8, 6), [px, py, L * 0.2]));
        bucket.put('D', xf(new THREE.BoxGeometry(R * 0.5, R * 0.5, L * 0.06), [px, py, -L * 0.17]));
        addEngineCluster([[px, py, -L * 0.18]], R * 0.34, L * 0.07, 0.85);
      }
      radiator(bucket, L, R * 0.9, R * 0.9, -L * 0.2, 1, 3, 0.8);
      radiator(bucket, L, -R * 0.9, -R * 0.9, -L * 0.2, -1, 3, 0.8);
      hatch(bucket, L, R * 0.72, 0, L * 0.05, 1, 0.9);
      hatch(bucket, L, -R * 0.72, 0, L * 0.05, -1, 0.9);
      greebles(bucket, L, R, rng, 18);
      hullClutter(bucket, L, R, rng, 10);
      addVerniers([[-R * 0.6, -R * 0.6, L * 0.2], [R * 0.6, R * 0.6, L * 0.2]], R * 0.2);
      addRunningLight(0xff5566, -podR, 0, -L * 0.1, L * 0.05);
      addRunningLight(0x55ff88, podR, 0, -L * 0.1, L * 0.05);
      addRunningLight(0xffffff, 0, 0, L * 0.5, L * 0.06);
      break;
    }

    /* ------------------------------------------- crescent (swept-arc hull) */
    case 'crescent': {
      const R = L * 0.088;
      hullR = R;
      const heavy = def.variant === 'heavy';
      const bend = heavy ? 0.1 : 0.15;
      hardpoints.push(
        [-L * 0.08, R * 0.5, L * 0.24], [L * 0.14, R * 0.5, L * 0.14],
        [0, -R * 0.5, L * 0.2], [0, -R * 0.6, -L * 0.16],
        [L * 0.32, R * 0.3, -L * 0.08], [-L * 0.16, -R * 0.5, -L * 0.28],
      );
      // the hull is three spindle segments set along a gentle arc: a crescent
      const segs = [
        { t: 0.31, a: 0, r: 0.86 },
        { t: 0.0, a: bend, r: 1 },
        { t: -0.31, a: bend * 2.05, r: 0.82 },
      ];
      for (const s of segs) {
        const x = Math.sin(s.a) * L * 0.46;
        const z = s.t * L;
        bucket.put('H', xf(fuselage(L * 0.44, R * s.r, 12, null, 0.84), [x, 0, z], [0, s.a, 0]));
      }
      // inner fairing fills the concave side; a strake rides the convex edge
      bucket.put('T', xf(new THREE.BoxGeometry(R * 0.5, R * 0.6, L * 0.5), [L * 0.18, 0, -L * 0.02], [0, bend, 0]));
      for (let i = 0; i < 3; i++) {
        bucket.put('T', xf(new THREE.BoxGeometry(R * 0.22, R * 0.3, L * 0.16), [L * (0.3 - i * 0.14), R * 0.05, L * (0.24 - i * 0.24)], [0, bend * 0.8, 0]));
      }
      // bow: ram, eye, twin masts; the nose is canted off-axis
      bucket.put('T', xf(new THREE.ConeGeometry(R * 0.7, L * 0.14, 10), [L * 0.05, 0, L * 0.48], [Math.PI / 2, 0, 0]));
      bucket.put('A', xf(new THREE.SphereGeometry(R * 0.2, 8, 6), [0, 0, L * 0.5]));
      antenna(bucket, L, -L * 0.04, R * 0.5, L * 0.2, L * 0.08, true);
      bucket.put('H', xf(finPlate(L * 0.24, L * 0.13, L * 0.02, L * 0.07), [L * 0.02, R * 0.5, -L * 0.22], [0, bend * 1.6, 0]));
      // side blisters and detail work
      for (const s of [-1, 1]) {
        bucket.put('D', xf(new THREE.SphereGeometry(R * 0.42, 10, 8), [s * R * 0.7, 0, L * (s > 0 ? -0.12 : 0.16)]));
        vent(bucket, L, s * R * 0.8, R * 0.3, L * (s > 0 ? 0.02 : 0.3), s * 0.5);
        radiator(bucket, L, s * R * 0.8, R * 0.45, -L * 0.26, s, 3, 0.75);
        rcsQuad(bucket, L, s * R * 0.85, R * 0.1, L * (s > 0 ? 0.26 : -0.02));
      }
      hatch(bucket, L, L * 0.1, -R * 0.6, L * 0.06, 1, 0.9);
      greebles(bucket, L, R, rng, 18);
      hullClutter(bucket, L, R, rng, 9);
      // propulsion: drive pods on the convex side, angled along the arc
      addEngineCluster([
        [L * 0.3, -R * 0.35, -L * 0.3], [L * 0.12, R * 0.45, -L * 0.4],
      ], R * 0.46, L * 0.12, 1.05, heavy);
      addEngineCluster([[L * 0.42, R * 0.1, -L * 0.14]], R * 0.3, L * 0.08, 0.8);
      addVerniers([[-L * 0.18, -R * 0.3, L * 0.34], [L * 0.08, -R * 0.5, L * 0.3]], R * 0.22);
      addRunningLight(0xff5566, -L * 0.16, R * 0.2, L * 0.08, L * 0.05);
      addRunningLight(0x55ff88, L * 0.46, R * 0.2, -L * 0.1, L * 0.05);
      addRunningLight(0xffffff, 0, 0, L * 0.56, L * 0.05);
      break;
    }

    /* -------------------------------------------------- saucer (dome) */
    case 'dome': {
      // the disc is the hull, so its diameter is the ship's length — a saucer
      // reads at its true size next to a spindle of the same tonnage
      const R = L * 0.5;
      hullR = R * 0.72;
      const heavy = def.variant === 'heavy';
      // ring of gun mounts: the dorsal shoulders first, then the rim
      hardpoints.push(
        [-R * 0.45, R * 0.16, R * 0.2], [R * 0.45, R * 0.16, R * 0.2],
        [0, R * 0.5, -R * 0.18],
        [-R * 0.62, R * 0.14, -R * 0.16], [R * 0.62, R * 0.14, -R * 0.16],
        [0, -R * 0.2, R * 0.62], [0, -R * 0.2, -R * 0.62],
      );
      // a wide flat disc: hull plate, armoured rim, dorsal dome, ventral boss
      bucket.put('H', xf(new THREE.CylinderGeometry(R, R * 0.86, R * 0.28, 26), [0, 0, 0]));
      bucket.put('T', xf(new THREE.TorusGeometry(R * 0.99, R * 0.07, 6, 30), [0, 0, 0]));
      bucket.put('H', xf(new THREE.SphereGeometry(R * 0.52, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), [0, R * 0.12, 0]));
      bucket.put('G', xf(new THREE.CylinderGeometry(R * 0.34, R * 0.36, R * 0.14, 18), [0, R * 0.38, 0]));
      bucket.put('D', xf(new THREE.CylinderGeometry(R * 0.3, R * 0.44, R * 0.24, 12), [0, -R * 0.2, 0]));
      sensorArray(bucket, L, 0, R * 0.48, -R * 0.14, 0.16);
      // lit window ring on the rim, rim turrets, intake louvres forward
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2;
        bucket.put('A', xf(new THREE.BoxGeometry(R * 0.16, R * 0.06, R * 0.03), [Math.cos(a) * R * 0.98, 0, Math.sin(a) * R * 0.98], [0, -a, 0]));
      }
      for (const a of [0.5, 2.2, 3.9, 5.6]) {
        turret(bucket, L, Math.cos(a) * R * 0.78, R * 0.16, Math.sin(a) * R * 0.78, 0.9, -a);
      }
      for (const a of [1.1, 1.9]) {
        vent(bucket, L, Math.cos(a) * R * 0.7, R * 0.16, Math.sin(-a) * R * 0.7, 0);
      }
      for (const s of [-1, 1]) {
        bucket.put('D', xf(new THREE.BoxGeometry(R * 0.5, R * 0.2, R * 0.5), [s * R * 0.55, -R * 0.2, 0]));
        hatch(bucket, L, s * R * 0.9, 0, 0, s, 1.2);
      }
      greebles(bucket, L, R * 0.7, rng, 20);
      hullClutter(bucket, L, R * 0.7, rng, 10);
      // propulsion: a ring of bells around the aft rim, plus one central drive
      for (const a of [Math.PI * 1.14, Math.PI * 1.36, Math.PI * 1.64, Math.PI * 1.86]) {
        addEngineCluster([[Math.cos(a) * R * 0.74, -R * 0.08, Math.sin(a) * R * 0.74]], R * 0.2, L * 0.05, 0.7);
      }
      addEngineCluster([[0, -R * 0.16, -R * 0.3]], R * 0.42, L * 0.08, 1.15, heavy);
      addVerniers([[0, R * 0.2, -R * 0.9], [0, R * 0.2, R * 0.9]], R * 0.16);
      addRunningLight(0xff5566, -R * 1.05, 0, 0, L * 0.05);
      addRunningLight(0x55ff88, R * 1.05, 0, 0, L * 0.05);
      addRunningLight(0xffffff, 0, R * 0.5, 0, L * 0.06);
      break;
    }

    /* ---------------------------------------------- monolith (obelisk) */
    case 'obelisk': {
      const R = L * 0.1;
      hullR = R;
      const heavy = def.variant === 'heavy';
      const decks = heavy ? 4 : 3;
      hardpoints.push(
        [0, R * (0.5 + decks * 0.5), L * 0.36],
        [-R * 1.05, R * 0.5, L * 0.2], [R * 1.05, R * 0.5, L * 0.2],
        [-R * 1.1, R * 0.1, -L * 0.06], [R * 1.1, R * 0.1, -L * 0.06],
        [0, -R * 0.95, L * 0.1],
        [-R * 1.0, R * 0.45, -L * 0.3], [R * 1.0, R * 0.45, -L * 0.3],
        [0, R * (0.5 + decks * 0.5), -L * 0.2], [0, -R * 0.9, -L * 0.32],
      );
      // a monolith: stacked armour decks rising from a wide keel box
      bucket.put('H', xf(new THREE.BoxGeometry(R * 1.9, R * 0.6, L * 0.84), [0, 0, -L * 0.02]));
      for (let i = 0; i < decks; i++) {
        const w = R * (1.6 - i * 0.22);
        const h = R * (0.5 - i * 0.05);
        bucket.put(i === decks - 1 ? 'H' : 'T', xf(new THREE.BoxGeometry(w, h, L * (0.74 - i * 0.09)), [0, R * (0.3 + i * 0.5), L * 0.02 + i * L * 0.01]));
        // lit window rows along each deck
        for (const s of [-1, 1]) {
          windowBand(bucket, L, s * w * 0.5, R * (0.3 + i * 0.5), L * (0.1 - i * 0.06), s > 0 ? 0 : Math.PI, 4, L * 0.07);
        }
      }
      // prow: a squared wedge shoved through the deck stack, with a ram face
      bucket.put('H', xf(new THREE.ConeGeometry(R * 1.15, L * 0.24, 4), [0, R * 0.2, L * 0.46], [Math.PI / 2, 0, Math.PI * 0.25]));
      bucket.put('T', xf(new THREE.BoxGeometry(R * 0.9, R * 0.5, L * 0.06), [0, R * 0.2, L * 0.56]));
      bucket.put('A', xf(new THREE.BoxGeometry(R * 0.8, R * 0.06, L * 0.02), [0, R * 0.42, L * 0.56]));
      // fortress stern: casemate block, hangar mouth, gantry cranes
      bucket.put('T', xf(new THREE.BoxGeometry(R * 1.7, R * 0.9, L * 0.16), [0, R * 0.4, -L * 0.46]));
      bucket.put('D', xf(new THREE.BoxGeometry(R * 0.9, R * 0.34, L * 0.05), [0, -R * 0.1, -L * 0.52]));
      bucket.put('A', xf(new THREE.BoxGeometry(R * 0.84, R * 0.05, L * 0.02), [0, -R * 0.28, -L * 0.52]));
      for (const s of [-1, 1]) {
        pipe(bucket, L, [s * R * 1.4, R * 0.6, -L * 0.3], [s * R * 0.7, R * 0.9, -L * 0.42], 0.008);
        plateBelt(bucket, L, s * R * 1.42, R * 0.05, L * 0.02, s, 3, 6, 1.05, 'T');
        radiator(bucket, L, s * R * 1.5, R * 0.55, -L * 0.12, s, 4, 1.1);
        turret(bucket, L, s * R * 0.85, R * 0.62, L * 0.3, 1.2, s * 0.35);
        turret(bucket, L, s * R * 0.8, R * 1.05, -L * 0.08, 1.1, s * 0.2);
        hatch(bucket, L, s * R * 1.9, -R * 0.05, -L * 0.02, s, 1.3);
        missilePod(bucket, L, s * R * 0.95, R * 0.62, -L * 0.22, 8, 1.15);
        rcsQuad(bucket, L, s * R * 1.6, R * 0.15, L * 0.2);
      }
      sensorArray(bucket, L, 0, R * (0.5 + decks * 0.5), -L * 0.14, 0.22);
      greebles(bucket, L, R, rng, 30);
      hullClutter(bucket, L, R, rng, 14);
      // propulsion: one fortress bell astern, two great outrigger drives
      addEngineCluster([[0, R * 0.15, -L * 0.5]], R * 0.62, L * 0.13, 1.25, heavy);
      addEngineCluster([
        [-R * 1.05, -R * 0.2, -L * 0.46], [R * 1.05, -R * 0.2, -L * 0.46],
      ], R * 0.42, L * 0.1, 1.05);
      addVerniers([[0, R * 0.7, -L * 0.42], [-R * 1.35, R * 0.3, L * 0.1], [R * 1.35, R * 0.3, L * 0.1]], R * 0.26);
      addRunningLight(0xff5566, -R * 1.95, R * 0.1, L * 0.05, L * 0.055);
      addRunningLight(0x55ff88, R * 1.95, R * 0.1, L * 0.05, L * 0.055);
      addRunningLight(0xffffff, 0, R * 0.2, L * 0.6, L * 0.05);
      break;
    }
  }

  // fitted loadout: hardpoint pylons with weapon models, plus outfit modules
  if (loadout) {
    const weapons = loadout.weapons || [];
    const cap = Math.min(hardpoints.length, Math.max(weapons.length, loadout.mountCap || 0, def.mounts ?? 2));
    for (let i = 0; i < cap; i++) {
      const [hx, hy, hz] = hardpoints[i];
      const wid = weapons[i];
      if (wid && WEAPON_BY_ID[wid]) fittedWeapon(bucket, L, WEAPON_BY_ID[wid], hx, hy, hz);
      else if (loadout.showEmpty) emptyPylon(bucket, L, hx, hy, hz);
    }
    equipModules(bucket, L, hullR, loadout.outfits || {});
  }

  group.add(bucket.build((key) => materials.get(key)));

  const api = {
    setThrottle(t) {
      const k = Math.max(0, Math.min(1, t));
      for (const m of engineDiscMats) m.opacity = 0.22 + k * 0.78;
      for (const g of engineGlows) {
        g.spr.material.opacity = 0.14 + k * 0.8;
        const s = g.base * (0.72 + 0.5 * k);
        g.spr.scale.set(s, s, 1);
      }
    },
    pulse(t) {
      for (const l of navLights) {
        const k = 0.55 + 0.45 * Math.sin(t * 2.4 + l.phase);
        l.spr.material.opacity = 0.35 + 0.6 * k;
      }
    },
    accentColor: new THREE.Color(accentHex),
  };
  api.setThrottle(0);
  return { group, api };
}

/* ------------------------------------------------------------------ */
/* Stations                                                            */
/* ------------------------------------------------------------------ */

export function buildStation(station) {
  const group = new THREE.Group();
  const col = factionColor(station.owner);
  const rng = rngOf('station', station.id || station.name || 'x');
  const spinners = [];
  const pulses = []; // soft breathing lamps
  const strobes = []; // hard blinking lamps

  // deterministic look: hull tint, size and lamp flavour — a given station
  // always builds the same way; two berths of one trade never look alike
  const hullTint = rng.pick([0x8792a8, 0x8a94a8, 0x9aa0ac, 0x7d7f86, 0x8a7a68, 0x99a3b0]);
  const darkTint = new THREE.Color(hullTint).multiplyScalar(0.62).getHex();
  const beaconTint = col.clone().offsetHSL(rng.float(-0.06, 0.06), 0, rng.float(-0.05, 0.2)).getHex();
  const scale = rng.float(0.85, 1.45);
  const spinDir = rng.chance(0.5) ? 1 : -1;

  // station plating: clean machined metal, with a rim so it reads against the
  // dark and an environment to reflect
  const metal = (c, m = 0.55, r = 0.44) => withRim(new THREE.MeshStandardMaterial({
    color: c, metalness: m, roughness: r, envMapIntensity: 1.35,
  }), { color: 0xbfe8ff, power: 2.5, strength: 0.42, lift: 0.06 });
  const hull = metal(hullTint);
  const dark = metal(darkTint, 0.5, 0.56);
  const pane = metal(new THREE.Color(hullTint).lerp(new THREE.Color(0xffffff), 0.34).getHex(), 0.35, 0.36);
  const litWindows = new THREE.MeshBasicMaterial({ color: 0xffe6bc, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const darkWindows = new THREE.MeshBasicMaterial({ color: 0x1d2c3a, transparent: true, opacity: 0.95, depthWrite: false });
  const glowBand = (opacity = 0.9) => new THREE.MeshBasicMaterial({ color: beaconTint, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

  /** A ring of lit / dark cabins — some rooms flicker out by seed. */
  const windows = (radius, count, y, w, h, lit = 0.75) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.4), rng.chance(lit) ? litWindows : darkWindows);
      seg.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius);
      seg.rotation.y = Math.PI / 2 - a;
      group.add(seg);
    }
  };

  /** A strobe / running light: flashes on its own phase, sharp and bright. */
  const addStrobe = (x, y, z, color = 0xffffff, size = 9, speed = 1.4, phase = rng.float(0, Math.PI * 2)) => {
    const spr = glowSprite(color, size);
    spr.position.set(x, y, z);
    spr.material.opacity = 0.15;
    group.add(spr);
    strobes.push({ spr, base: size, speed, phase });
  };

  /** Civilian running lights: green to starboard, red to port. */
  const addNavPair = (radius, y = 0) => {
    addStrobe(radius, y, 0, 0x66ff88, 7, 1.05);
    addStrobe(-radius, y, 0, 0xff6666, 7, 1.05, 2.4);
  };

  /** Dots of light around a rim — the station's skyline at night. */
  const addRimLights = (radius, count, y, size = 5, color = 0xffffff) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const spr = glowSprite(i % 2 ? color : beaconTint, size);
      spr.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius);
      spr.material.opacity = 0.3;
      group.add(spr);
      strobes.push({ spr, base: size, speed: 0.7 + (i % 3) * 0.22, phase: a * 1.7 });
    }
  };

  /** The main lamp atop the mast — breathes, so the station feels alive. */
  const addBeacon = (radius, y = 8, phase = rng.float(0, Math.PI * 2)) => {
    const spr = glowSprite(beaconTint, radius);
    spr.position.y = y;
    spr.material.opacity = 0.85;
    group.add(spr);
    pulses.push({ spr, base: radius, phase });
  };

  // --- shape variant: each trade draws from its own set of silhouettes ---
  const byType = {
    haven: ['wheel', 'tower', 'twin'],
    yard: ['gantry', 'cradle', 'twinhull'],
    bastion: ['star', 'spike', 'block'],
    spacedock: ['wheelport', 'spire', 'stack'],
    port: ['drum', 'truss', 'cross'],
    depot: ['drum', 'truss'],
  };
  const variants = byType[station.type] || byType.port;
  const kind = variants[Math.floor(rng.float(0, variants.length)) % variants.length];

  switch (kind) {
    case 'wheel': {
      // the classic port wheel: rim, spokes, hub — cabins lit around the rim
      const R = rng.float(68, 86);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(R, R * 0.14, 10, 48), hull);
      rim.rotation.x = Math.PI / 2;
      group.add(rim);
      spinners.push({ obj: rim, speed: 0.045 * spinDir });
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.24, R * 0.31, R * 0.6, 10), dark);
      group.add(hub);
      windows(R * 0.25, 10, R * 0.16, 6, 4.6, 0.72);
      windows(R * 0.26, 10, -R * 0.14, 6, 4.2, 0.55);
      for (let i = 0; i < 4; i++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(R * 0.76, 5, 8), pane);
        spoke.rotation.y = (i / 4) * Math.PI * 2;
        group.add(spoke);
      }
      const bandRing = new THREE.Mesh(new THREE.TorusGeometry(R, R * 0.035, 6, 48), glowBand(0.85));
      bandRing.rotation.x = Math.PI / 2;
      bandRing.position.y = R * 0.17;
      group.add(bandRing);
      addRimLights(R + R * 0.16 + 4, 12, 2, 4.5);
      addNavPair(R + 8, 6);
      addBeacon(R * 1.8, R * 0.28);
      break;
    }
    case 'tower': {
      // a spindle: dock drum below, lit habitat saucer riding the top
      const capR = rng.float(52, 68);
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(20, 26, 26, 10), dark);
      drum.position.y = -30;
      group.add(drum);
      windows(23, 10, -26, 6, 3.6, 0.65);
      const spine = new THREE.Mesh(new THREE.CylinderGeometry(7, 10, 58, 8), hull);
      group.add(spine);
      const saucer = new THREE.Mesh(new THREE.CylinderGeometry(capR, capR * 0.76, 13, 26), hull);
      saucer.position.y = 36;
      group.add(saucer);
      windows(capR * 0.93, 26, 32, 5, 3.4, 0.75);
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(capR * 0.52, capR * 0.66, 9, 20), pane);
      skirt.position.y = 25;
      group.add(skirt);
      const midRing = new THREE.Mesh(new THREE.TorusGeometry(40, 2.8, 6, 38), glowBand(0.7));
      midRing.rotation.x = Math.PI / 2;
      midRing.position.y = 6;
      group.add(midRing);
      spinners.push({ obj: midRing, speed: 0.09 * spinDir });
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 24, 6), pane);
      mast.position.y = 52;
      group.add(mast);
      addStrobe(0, 64, 0, 0xffffff, 8, 1.1);
      addBeacon(115, 48);
      addNavPair(capR + 6, 36);
      break;
    }
    case 'twin': {
      // two counter-turning wheels stacked on one hub
      const R1 = rng.float(54, 64);
      const R2 = R1 * 1.32;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(16, 20, 74, 10), hull);
      group.add(hub);
      windows(20.5, 10, 8, 5.5, 4, 0.7);
      windows(20.5, 10, -12, 5.5, 4, 0.55);
      const wheel = (R, y, dir, tube) => {
        const holder = new THREE.Group();
        holder.position.y = y;
        const t = new THREE.Mesh(new THREE.TorusGeometry(R, tube, 8, 42), pane);
        t.rotation.x = Math.PI / 2;
        holder.add(t);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          const strut = new THREE.Mesh(new THREE.BoxGeometry(R * 0.8, 4, 6), dark);
          strut.position.set(Math.cos(a) * R * 0.42, 0, Math.sin(a) * R * 0.42);
          strut.rotation.y = -a;
          holder.add(strut);
        }
        const halo = new THREE.Mesh(new THREE.TorusGeometry(R, 2.4, 6, 42), glowBand(0.7));
        halo.rotation.x = Math.PI / 2;
        halo.position.y = tube + 3;
        holder.add(halo);
        group.add(holder);
        spinners.push({ obj: holder, speed: 0.05 * dir });
      };
      wheel(R1, 24, spinDir, R1 * 0.12);
      wheel(R2, -20, -spinDir, R2 * 0.09);
      addRimLights(R2 + 8, 10, -20, 4);
      addBeacon(R2 * 1.7, 30);
      addNavPair(R2 + 4, 0);
      break;
    }
    case 'gantry': {
      // an old yard: build hall boxed in crane arms, sparks in every shift
      const core = new THREE.Mesh(new THREE.BoxGeometry(58, 30, 92), hull);
      group.add(core);
      for (const s of [-1, 1]) {
        for (let i = 0; i < 5; i++) {
          const seg = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.4, 11), rng.chance(0.75) ? litWindows : darkWindows);
          seg.position.set(29.6 * s, 12, -36 + i * 18);
          group.add(seg);
        }
      }
      const gantry = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(150, 4, 5), pane);
        arm.rotation.y = (i / 3) * Math.PI * 2;
        arm.position.y = 18;
        gantry.add(arm);
      }
      gantry.add(new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 26, 6), dark));
      group.add(gantry);
      spinners.push({ obj: gantry, speed: 0.1 * spinDir });
      const dock = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 40), dark);
      dock.position.set(56, -6, 0);
      group.add(dock);
      addStrobe(0, 22, 0, 0xffffff, 8, 1.0);
      addBeacon(115, 20);
      addNavPair(62, 0);
      break;
    }
    case 'cradle': {
      // an open drydock: a keel bed under floodlights, rails, and a crane beam
      const L = rng.float(150, 180);
      const bed = new THREE.Mesh(new THREE.BoxGeometry(L, 10, 30), hull);
      bed.position.y = -18;
      group.add(bed);
      const keel = new THREE.Mesh(new THREE.BoxGeometry(L * 0.9, 4, 6), glowBand(0.3));
      keel.position.set(0, -12.6, 0);
      group.add(keel);
      for (const s of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(L, 7, 7), pane);
        rail.position.set(0, -4, s * 17);
        group.add(rail);
      }
      for (let i = 0; i < 4; i++) {
        const x = -L * 0.36 + (i / 3) * L * 0.72;
        const frame = new THREE.Mesh(new THREE.BoxGeometry(9, 40, 44), dark);
        frame.position.set(x, 14, 0);
        group.add(frame);
        const lamp = glowSprite(0xffd9a0, 13);
        lamp.position.set(x, 27, 0);
        lamp.material.opacity = 0.45;
        group.add(lamp);
        pulses.push({ spr: lamp, base: 13, phase: rng.float(0, Math.PI * 2) });
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(L * 0.92, 5, 6), pane);
      beam.position.set(0, 37, 0);
      group.add(beam);
      const trolley = new THREE.Mesh(new THREE.BoxGeometry(10, 7, 12), dark);
      trolley.position.set(L * 0.12, 31, 0);
      group.add(trolley);
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 16, 5), dark);
      cable.position.set(L * 0.12, 20, 0);
      group.add(cable);
      addStrobe(-L * 0.45, 36, 0, 0xffffff, 8, 1.0);
      addStrobe(L * 0.45, 36, 0, 0xffffff, 8, 1.0, 2.6);
      addBeacon(105, 30);
      addNavPair(L * 0.58, -12);
      break;
    }
    case 'twinhull': {
      // two construction hulls bridged by trusses, crane rail on top
      const L = rng.float(130, 158);
      for (const s of [-1, 1]) {
        const block = new THREE.Mesh(new THREE.BoxGeometry(L, 24, 30), hull);
        block.position.set(0, 0, s * 27);
        group.add(block);
        for (let i = 0; i < 6; i++) {
          const seg = new THREE.Mesh(new THREE.BoxGeometry(9, 3.4, 3), rng.chance(0.7) ? litWindows : darkWindows);
          seg.position.set(-L * 0.38 + i * L * 0.152, 7, s * 42.6);
          group.add(seg);
        }
      }
      for (let i = 0; i < 3; i++) {
        const x = -L * 0.32 + i * L * 0.32;
        const truss = new THREE.Mesh(new THREE.BoxGeometry(14, 9, 56), dark);
        truss.position.set(x, 0, 0);
        group.add(truss);
      }
      const tower = new THREE.Mesh(new THREE.BoxGeometry(24, 22, 18), pane);
      tower.position.set(L * 0.27, 21, 27);
      group.add(tower);
      const towerWin = new THREE.Mesh(new THREE.BoxGeometry(16, 4, 1.2), litWindows);
      towerWin.position.set(L * 0.27, 24, 36.2);
      group.add(towerWin);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(L * 0.8, 4, 6), glowBand(0.5));
      rail.position.y = 13.5;
      group.add(rail);
      addStrobe(0, 15, 0, 0xffffff, 8, 1.1);
      addBeacon(120, 28);
      addNavPair(L * 0.52, 0);
      break;
    }
    case 'star': {
      // a fortress of spines and guns: the classic bastion silhouette
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(50, 0), hull);
      group.add(core);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(7, 54, 6), dark);
        spike.position.set(dx * 62, 0, dz * 62);
        spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, 0, dz));
        group.add(spike);
      }
      for (const [x, z] of [[-46, 28], [46, -28]]) {
        const turret = new THREE.Mesh(new THREE.CylinderGeometry(7, 9, 24, 6), dark);
        turret.position.set(x, -14, z);
        group.add(turret);
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(72, 3, 6, 40), glowBand(0.7));
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
      spinners.push({ obj: ring, speed: -0.08 * spinDir });
      addStrobe(0, 58, 0, 0xff7766, 10, 1.5);
      addBeacon(140, 24);
      break;
    }
    case 'spike': {
      // a mine made into a castle: one crystal core, six long spines
      const core = new THREE.Mesh(new THREE.DodecahedronGeometry(32, 0), new THREE.MeshStandardMaterial({
        color: hullTint, metalness: 0.65, roughness: 0.38, flatShading: true,
      }));
      group.add(core);
      const up = new THREE.Vector3(0, 1, 0);
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const dir = new THREE.Vector3(dx, dy, dz);
        const spike = new THREE.Mesh(new THREE.ConeGeometry(5.5, 42, 5), dark);
        spike.position.copy(dir).multiplyScalar(46);
        spike.quaternion.setFromUnitVectors(up, dir);
        group.add(spike);
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(58, 2.6, 6, 40), glowBand(0.65));
      ring.rotation.x = Math.PI / 2 + 0.2;
      ring.rotation.z = 0.4;
      group.add(ring);
      spinners.push({ obj: ring, speed: 0.05 * spinDir });
      addStrobe(0, 58, 0, 0xff7766, 9, 1.6);
      addRimLights(58, 8, 0, 4);
      addBeacon(125, 8);
      break;
    }
    case 'block': {
      // a watch fortress: heavy slab, towers, a shield collar
      const slab = new THREE.Mesh(new THREE.BoxGeometry(96, 34, 56), hull);
      group.add(slab);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(104, 20, 44), pane);
      deck.position.y = 4;
      group.add(deck);
      for (const s of [-1, 1]) {
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(8, 10, 30, 8), dark);
        tower.position.set(s * 34, 30, 12);
        group.add(tower);
        const dish = new THREE.Mesh(new THREE.ConeGeometry(12, 9, 12, 1, true), pane);
        dish.position.set(s * 34, 47, 12);
        dish.rotation.x = Math.PI;
        group.add(dish);
        for (let i = 0; i < 4; i++) {
          const seg = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.2, 9), rng.chance(0.7) ? litWindows : darkWindows);
          seg.position.set(48.7 * s, 6 - i * 6, -8);
          group.add(seg);
        }
      }
      const shield = new THREE.Mesh(new THREE.TorusGeometry(66, 2.8, 6, 42), glowBand(0.55));
      shield.rotation.x = Math.PI / 2;
      group.add(shield);
      spinners.push({ obj: shield, speed: 0.035 * spinDir });
      addStrobe(0, 30, -30, 0xff8866, 9, 1.4);
      addBeacon(120, 22);
      break;
    }
    case 'wheelport': {
      // an orbital ring port: habitat wheel with bay modules over the world it serves
      const R = rng.float(88, 100);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 13, 10, 56), hull);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
      spinners.push({ obj: ring, speed: 0.055 * spinDir });
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(16, 20, 74, 8), dark);
      group.add(hub);
      windows(20.5, 10, 14, 5.5, 4, 0.7);
      windows(20.5, 10, -12, 5.5, 4, 0.55);
      const doorMat = new THREE.MeshBasicMaterial({ color: 0x8fe4ff, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(R, 5, 10), pane);
        spoke.position.set(Math.cos(a) * R * 0.49, 0, Math.sin(a) * R * 0.49);
        spoke.rotation.y = -a;
        group.add(spoke);
        // hangar bay module clamped to the rim, doors facing open space
        const bay = new THREE.Mesh(new THREE.BoxGeometry(30, 16, 18), dark);
        bay.position.set(Math.cos(a) * R, -4, Math.sin(a) * R);
        bay.rotation.y = Math.PI / 2 - a;
        group.add(bay);
        for (const dy of [0.5, -8]) {
          const door = new THREE.Mesh(new THREE.BoxGeometry(24, 2.2, 1.6), doorMat);
          door.position.set(Math.cos(a) * (R + 10), -4 + dy, Math.sin(a) * (R + 10));
          door.rotation.y = Math.PI / 2 - a;
          group.add(door);
        }
        const win = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.6, 9), rng.chance(0.8) ? litWindows : darkWindows);
        win.position.set(Math.cos(a) * (R + 16), 0, Math.sin(a) * (R + 16));
        win.rotation.y = -a;
        group.add(win);
      }
      const bandRing = new THREE.Mesh(new THREE.TorusGeometry(R, 2.4, 6, 56), glowBand(0.8));
      bandRing.rotation.x = Math.PI / 2;
      bandRing.position.y = 15;
      group.add(bandRing);
      addRimLights(R + 16, 14, 2, 4.5);
      addNavPair(R + 20, -4);
      addBeacon(R * 1.65, 24);
      break;
    }
    case 'spire': {
      // a spire dock: counterweight drum, long stem, one wide canopy below the dark
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(11, 13, 96, 10), hull);
      stem.position.y = -10;
      group.add(stem);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(24, 28, 26, 12), dark);
      base.position.y = -46;
      group.add(base);
      windows(25, 10, -46, 5, 3.6, 0.6);
      const canopy = new THREE.Mesh(new THREE.CylinderGeometry(52, 40, 14, 26), pane);
      canopy.position.y = 46;
      group.add(canopy);
      windows(46, 22, 41, 5, 3.2, 0.75);
      const halo = new THREE.Mesh(new THREE.TorusGeometry(58, 3, 6, 40), glowBand(0.75));
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 33;
      group.add(halo);
      spinners.push({ obj: halo, speed: 0.07 * spinDir });
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.4;
        const lift = new THREE.Mesh(new THREE.BoxGeometry(6, 72, 6), dark);
        lift.position.set(Math.cos(a) * 15, -6, Math.sin(a) * 15);
        group.add(lift);
      }
      addRimLights(58, 10, 33, 4.2);
      addStrobe(0, 62, 0, 0xffffff, 9, 1.15);
      addBeacon(140, 55);
      break;
    }
    case 'stack': {
      // three stacked turning rings braced around a spine — easy to spot at range
      const column = new THREE.Mesh(new THREE.CylinderGeometry(13, 15, 96, 10), hull);
      group.add(column);
      windows(15.5, 8, 28, 4.5, 3.4, 0.6);
      windows(15.5, 8, -30, 4.5, 3.4, 0.5);
      const tiers = [[74, 26], [58, 0], [42, -26]];
      for (let i = 0; i < tiers.length; i++) {
        const [R, y] = tiers[i];
        const holder = new THREE.Group();
        holder.position.y = y;
        const t = new THREE.Mesh(new THREE.TorusGeometry(R, 8.5, 8, 44), i === 1 ? pane : hull);
        t.rotation.x = Math.PI / 2;
        holder.add(t);
        const halo = new THREE.Mesh(new THREE.TorusGeometry(R, 1.9, 6, 44), glowBand(0.8));
        halo.rotation.x = Math.PI / 2;
        halo.position.y = 9.5;
        holder.add(halo);
        group.add(holder);
        if (i !== 1) spinners.push({ obj: holder, speed: (0.03 + i * 0.012) * (i === 0 ? 1 : -1) * spinDir });
        else {
          for (let k = 0; k < 4; k++) {
            const a = (k / 4) * Math.PI * 2;
            const mod = new THREE.Mesh(new THREE.BoxGeometry(18, 13, 13), dark);
            mod.position.set(Math.cos(a) * R, y, Math.sin(a) * R);
            mod.rotation.y = -a;
            group.add(mod);
            const win = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.8, 10), rng.chance(0.7) ? litWindows : darkWindows);
            win.position.set(Math.cos(a) * (R + 7.4), y, Math.sin(a) * (R + 7.4));
            win.rotation.y = -a;
            group.add(win);
          }
        }
      }
      addRimLights(74 + 9, 12, 26, 4);
      addStrobe(0, -42, 0, 0xff7766, 8, 1.5);
      addBeacon(130, 54);
      break;
    }
    case 'drum': {
      // a workhorse cylinder: glowing hoops, side panels, and a tank farm
      const R = rng.float(30, 38);
      const L = rng.float(66, 86);
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 12), hull);
      drum.rotation.z = Math.PI / 2;
      group.add(drum);
      for (const xx of [-L * 0.3, 0, L * 0.3]) {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(R + 0.7, 1.7, 6, 30), litWindows);
        hoop.rotation.y = Math.PI / 2;
        hoop.position.x = xx;
        group.add(hoop);
      }
      for (const s of [-1, 1]) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(96, 2, 40), withRim(new THREE.MeshStandardMaterial({
          color: 0x2a4c74, metalness: 0.3, roughness: 0.6, emissive: 0x14304e, emissiveIntensity: 1.1, envMapIntensity: 1.2,
        }), { color: 0x9fe0ff, power: 2.4, strength: 0.4 }));
        panel.position.set(0, 0, s * 62);
        panel.rotation.y = s * 0.3;
        group.add(panel);
      }
      const collar = new THREE.Mesh(new THREE.TorusGeometry(R + 2.5, 2.5, 6, 40), glowBand(0.8));
      collar.rotation.x = Math.PI / 2;
      collar.position.y = 6;
      group.add(collar);
      if ((station.services || []).includes('refuel')) {
        const farm = new THREE.Group();
        for (let i = 0; i < 3; i++) {
          const tank = new THREE.Mesh(new THREE.SphereGeometry(7, 12, 10), pane);
          tank.position.set(0, 0, (i - 1) * 16);
          farm.add(tank);
        }
        const rack = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 40), dark);
        rack.position.y = -8;
        farm.add(rack);
        farm.position.set(L * 0.5 + 22, -4, 0);
        group.add(farm);
      }
      addStrobe(0, R + 6, 0, 0xffffff, 8, 1.1);
      addNavPair(L * 0.5 + 8, 0);
      addBeacon(105, 16);
      break;
    }
    case 'truss': {
      // a cross of trusses with wing panels — station as space-frame machine
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(24, 28, 46, 10), hull);
      group.add(hub);
      windows(26.5, 10, 8, 6, 3.8, 0.7);
      const panelMat = withRim(new THREE.MeshStandardMaterial({
        color: 0x2a4c74, metalness: 0.35, roughness: 0.55, emissive: 0x1a4064, emissiveIntensity: 1.1, envMapIntensity: 1.25,
      }), { color: 0x9fe0ff, power: 2.4, strength: 0.42 });
      for (const s of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(56, 2.4, 26), panelMat);
        wing.position.set(s * 64, 0, 0);
        group.add(wing);
        const boom = new THREE.Mesh(new THREE.BoxGeometry(76, 4.5, 6), dark);
        boom.position.set(s * 36, 0, 0);
        group.add(boom);
      }
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i / 4) * Math.PI * 2;
        const arm = new THREE.Mesh(new THREE.BoxGeometry(76, 6, 9), dark);
        arm.position.set(Math.cos(a) * 60, 0, Math.sin(a) * 60);
        arm.rotation.y = -a;
        group.add(arm);
        const pod = new THREE.Mesh(new THREE.BoxGeometry(20, 17, 20), i % 2 ? pane : hull);
        pod.position.set(Math.cos(a) * 100, 0, Math.sin(a) * 100);
        pod.rotation.y = -a;
        group.add(pod);
        addStrobe(Math.cos(a) * 101, 10, Math.sin(a) * 101, 0xffffff, 6.5, 0.85 + i * 0.18);
      }
      addRimLights(28, 8, -18, 4);
      addBeacon(110, 26);
      break;
    }
    case 'cross': {
      // a sphere with four gun-ready arms and a listening dish
      const core = new THREE.Mesh(new THREE.SphereGeometry(30, 20, 14), hull);
      group.add(core);
      const up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i / 4) * Math.PI * 2;
        const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 64, 8), dark);
        arm.position.copy(dir).multiplyScalar(32);
        arm.quaternion.setFromUnitVectors(up, dir);
        group.add(arm);
        const pod = new THREE.Mesh(new THREE.BoxGeometry(16, 14, 16), pane);
        pod.position.copy(dir).multiplyScalar(68);
        pod.rotation.y = -a;
        group.add(pod);
        addStrobe(dir.x * 74, 4, dir.z * 74, 0xffffff, 6.5, 0.9 + i * 0.2);
      }
      const equator = new THREE.Mesh(new THREE.TorusGeometry(31, 2.4, 6, 36), glowBand(0.8));
      equator.rotation.x = Math.PI / 2;
      group.add(equator);
      spinners.push({ obj: equator, speed: 0.1 * spinDir });
      windows(29.5, 12, 6, 5, 3.4, 0.7);
      const dish = new THREE.Mesh(new THREE.ConeGeometry(16, 10, 14, 1, true), pane);
      dish.position.y = 38;
      dish.rotation.x = Math.PI;
      group.add(dish);
      addBeacon(115, 24);
      break;
    }
    default: {
      // unknown trade: a simple lit drum, so nothing ever renders bare
      const R = 32;
      const L = 74;
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 10), hull);
      drum.rotation.z = Math.PI / 2;
      group.add(drum);
      const collar = new THREE.Mesh(new THREE.TorusGeometry(R + 2, 2.4, 6, 40), glowBand(0.8));
      collar.rotation.x = Math.PI / 2;
      group.add(collar);
      addBeacon(105, 16);
      break;
    }
  }

  group.userData.animate = (dt, t) => {
    for (const s of spinners) s.obj.rotation.y += s.speed * dt;
    for (const p of pulses) {
      const k = 0.8 + 0.2 * Math.sin(t * 2.2 + p.phase);
      p.spr.scale.set(p.base * k, p.base * k, 1);
    }
    for (const s of strobes) {
      const k = Math.max(0, Math.sin(t * s.speed + s.phase));
      s.spr.material.opacity = 0.12 + 0.85 * k * k;
      const sc = s.base * (0.85 + 0.35 * k);
      s.spr.scale.set(sc, sc, 1);
    }
  };
  group.scale.setScalar(scale);
  group.userData.radiusScale = scale;
  return group;
}

/* ------------------------------------------------------------------ */
/* Wormholes                                                          */
/* ------------------------------------------------------------------ */

/** A swirling violet mouth: arcs in the plane, a dark throat, soft halos. */
export function buildWormhole() {
  const group = new THREE.Group();
  const spinners = [];
  const pulses = [];

  const arcGeo = (r, tube, sweep, steps = 44) => {
    const g = new THREE.TorusGeometry(r, tube, 8, steps, sweep);
    g.rotateX(Math.PI / 2); // lie flat, on the flight plane
    return g;
  };
  const glowMat = (color, opacity) => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
  });

  const ring = (r, tube, sweep, count, color, opacity, speed, tilt = 0, phase = 0) => {
    const holder = new THREE.Group();
    holder.rotation.z = tilt;
    const spin = new THREE.Group();
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(arcGeo(r, tube, sweep), glowMat(color, opacity));
      mesh.rotation.y = phase + (i / count) * Math.PI * 2;
      spin.add(mesh);
    }
    holder.add(spin);
    group.add(holder);
    spinners.push({ obj: spin, speed });
  };

  ring(122, 2.2, Math.PI * 2, 1, 0xb08cff, 0.4, 0.34); // the firm rim
  ring(122, 7.5, 0.85, 3, 0x7a4cff, 0.5, 0.34); // heavy swirl arcs
  ring(94, 5, 1.05, 3, 0x9a6cff, 0.55, -0.5, 0.32, 1.1);
  ring(62, 3.4, 1.3, 2, 0xd0b0ff, 0.65, 0.75, -0.28, 2.3);

  // the throat: a dark disc with a bright lip
  const lip = new THREE.Mesh(arcGeo(46, 1.6, Math.PI * 2), glowMat(0xe8d8ff, 0.8));
  group.add(lip);
  const throat = new THREE.Mesh(
    new THREE.CircleGeometry(44, 40),
    new THREE.MeshBasicMaterial({ color: 0x05020e }),
  );
  throat.rotation.x = -Math.PI / 2;
  throat.position.y = 0.6;
  group.add(throat);

  // halos that breathe
  const halo = glowSprite(0xa070ff, 240);
  halo.position.y = 8;
  halo.material.opacity = 0.26;
  group.add(halo);
  pulses.push({ spr: halo, base: 240, phase: 0 });
  const heart = glowSprite(0xe8d8ff, 70);
  heart.position.y = 10;
  heart.material.opacity = 0.7;
  group.add(heart);
  pulses.push({ spr: heart, base: 70, phase: 1.7 });

  group.userData.animate = (dt, t) => {
    for (const s of spinners) s.obj.rotation.y += s.speed * dt;
    for (const p of pulses) {
      const k = 0.85 + 0.15 * Math.sin(t * 1.6 + p.phase);
      p.spr.scale.set(p.base * k, p.base * k, 1);
    }
  };
  return group;
}

/* ------------------------------------------------------------------ */
/* Planets, star, asteroids, pods, wrecks                       */
/* ------------------------------------------------------------------ */

export function buildPlanet(p, { limb = true } = {}) {
  const group = new THREE.Group();
  const rng = tinyRng(hashStr(`${p.name || p.color}:${p.radius}`));
  const tex = planetTexture(p.color, p.name || String(p.color), p.type);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex,
    emissive: new THREE.Color(p.color),
    emissiveMap: tex,
    emissiveIntensity: p.type === 'molten' ? 0.6 : 0.46,
    roughness: 0.95,
    metalness: 0.05,
  });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(p.radius, 48, 32), mat);
  const tilt = new THREE.Group();
  tilt.rotation.z = (rng() - 0.5) * 0.5; // axial tilt
  tilt.add(sphere);
  group.add(tilt);

  // cloud veil for worlds with weather
  let clouds = null;
  if (p.type === 'terran' || p.type === 'ocean' || p.type === 'jungle' || p.type === 'gas') {
    const ctex = cloudTexture(p.name || String(p.color), p.type);
    clouds = new THREE.Mesh(
      new THREE.SphereGeometry(p.radius * 1.025, 48, 32),
      new THREE.MeshStandardMaterial({
        map: ctex,
        transparent: true,
        depthWrite: false,
        emissive: new THREE.Color(0xffffff),
        emissiveMap: ctex,
        emissiveIntensity: 0.12,
        roughness: 1,
        metalness: 0,
      }),
    );
    tilt.add(clouds);
  }

  // atmosphere rim — a soft halo in the world's own hue
  if (p.type === 'terran' || p.type === 'ocean' || p.type === 'jungle' || p.type === 'ice' || p.type === 'gas' || p.type === 'toxic' || p.type === 'desert' || p.type === 'dusty') {
    const tint = new THREE.Color(p.color).offsetHSL(0.02, 0.15, 0.25).getHex();
    const atmo = glowSprite(tint, p.radius * 3.1);
    atmo.material.opacity = p.type === 'gas' ? 0.3 : 0.24;
    atmo.position.y = 8;
    group.add(atmo);
  }

  // limb darkening so the visible cap still reads as a sphere from above
  if (limb) {
    const shade = new THREE.Mesh(
      new THREE.CircleGeometry(p.radius * 1.004, 48),
      new THREE.MeshBasicMaterial({ map: limbTexture(), transparent: true, depthWrite: false }),
    );
    shade.rotation.x = -Math.PI / 2;
    shade.position.y = p.radius + 0.6;
    group.add(shade);
  }

  // moonlets circling the big worlds
  const moons = [];
  if (p.radius >= 70 && p.type !== 'moon') {
    const n = p.type === 'gas' && rng() < 0.6 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const mr = p.radius * (0.14 + rng() * 0.1);
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(mr, 16, 12),
        new THREE.MeshStandardMaterial({
          color: p.type === 'ice' ? 0xcfe2ee : 0x99968c,
          roughness: 0.95,
          metalness: 0.05,
        }),
      );
      const carrier = new THREE.Group();
      carrier.rotation.z = (rng() - 0.5) * 0.6;
      const orbitR = p.radius * (2.0 + rng() * 1.0);
      m.position.set(orbitR, 0, 0);
      carrier.add(m);
      group.add(carrier);
      moons.push({ carrier, m, speed: (0.1 + rng() * 0.12) * (rng() < 0.2 ? -1 : 1), spin: 0.3 + rng() * 0.5 });
    }
  }

  if (p.rings) {
    // Additive glow drawn ahead of every opaque object (renderOrder -1), so the
    // ring — which sits below the flight plane but can pass near the camera —
    // never veils ships, stations or pods. The planet body still covers its far side.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(p.radius * 1.45, p.radius * 2.15, 64),
      new THREE.MeshBasicMaterial({
        color: 0xcfc5a5, map: ringTexture(), transparent: true, opacity: 0.85,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.rotation.y = 0.15;
    ring.renderOrder = -1;
    group.add(ring);
  }
  if (p.type === 'molten') {
    const spr = glowSprite(0xff7a3a, p.radius * 3.4);
    spr.position.y = 10;
    spr.material.opacity = 0.5;
    group.add(spr);
  }
  const spin = 0.012 + rng() * 0.03;
  group.userData.animate = (dt) => {
    sphere.rotation.y += dt * spin;
    if (clouds) clouds.rotation.y += dt * (spin * 0.45 + 0.004);
    for (const mo of moons) {
      mo.carrier.rotation.y += dt * mo.speed;
      mo.m.rotation.y += dt * mo.spin;
    }
  };
  return group;
}

export function buildStar(cfg) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(cfg.size, 48, 32),
    new THREE.MeshBasicMaterial({ color: cfg.color }),
  );
  group.add(core);
  const halo = glowSprite(cfg.color, cfg.size * 7);
  halo.material.opacity = 0.55;
  group.add(halo);
  const halo2 = glowSprite(0xffffff, cfg.size * 3.2);
  halo2.material.opacity = 0.85;
  group.add(halo2);
  group.userData.animate = (dt, t) => {
    const k = 1 + 0.02 * Math.sin(t * 0.7);
    halo.scale.set(cfg.size * 7 * k, cfg.size * 7 * k, 1);
  };
  return group;
}

export function buildStarLight(cfg, intensity = 1.15) {
  const light = new THREE.DirectionalLight(cfg.color, intensity);
  light.position.set(0.25, 1, 0.18).normalize().multiplyScalar(5000);
  return light;
}

export function buildAsteroidField(config, rng) {
  const group = new THREE.Group();
  const list = [];
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.95, metalness: 0.1, flatShading: true });
  for (let i = 0; i < config.count; i++) {
    const r = rng.float(8, 30);
    const mesh = new THREE.Mesh(geo, mat);
    const a = rng.float(0, Math.PI * 2);
    const d = config.dist + rng.float(-config.spread, config.spread);
    mesh.position.set(Math.cos(a) * d, rng.float(-30, 30), Math.sin(a) * d);
    mesh.scale.set(r, r * rng.float(0.6, 1.2), r);
    mesh.rotation.set(rng.float(0, 3), rng.float(0, 3), rng.float(0, 3));
    group.add(mesh);
    list.push({ x: mesh.position.x, z: mesh.position.z, r: r * 0.9, mesh, spin: rng.float(-0.4, 0.4) });
  }
  group.userData.animate = (dt) => {
    for (const a of list) a.mesh.rotation.y += a.spin * dt;
  };
  return { group, list };
}

export function buildBeacon(tint = 0x8bf0a8) {
  const group = new THREE.Group();
  const pylon = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 5, 46, 6),
    new THREE.MeshStandardMaterial({ color: 0x556070, metalness: 0.6, roughness: 0.5 }),
  );
  group.add(pylon);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(26, 1.6, 6, 32),
    new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  const glow = glowSprite(tint, 70);
  glow.position.y = 24;
  group.add(glow);
  group.userData.animate = (dt, t) => {
    ring.rotation.z += dt * 0.8;
    const k = 0.85 + 0.15 * Math.sin(t * 4);
    glow.scale.set(70 * k, 70 * k, 1);
  };
  return group;
}

export function buildPod(color = 0xffc060) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.OctahedronGeometry(9, 0),
    new THREE.MeshStandardMaterial({ color: 0xccb080, metalness: 0.6, roughness: 0.4, flatShading: true }),
  );
  group.add(body);
  const spr = glowSprite(color, 42);
  group.add(spr);
  group.userData.animate = (dt) => {
    body.rotation.y += dt * 1.4;
    body.rotation.x += dt * 0.6;
  };
  return group;
}

export function buildWreck(rng) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x5a5f6a, metalness: 0.55, roughness: 0.6 });
  for (let i = 0; i < 3; i++) {
    const chunk = new THREE.Mesh(
      new THREE.BoxGeometry(rng.float(20, 60), rng.float(6, 16), rng.float(20, 70)),
      mat,
    );
    chunk.position.set(rng.float(-30, 30), rng.float(-8, 8), rng.float(-30, 30));
    chunk.rotation.set(rng.float(0, 1), rng.float(0, 3), rng.float(0, 1));
    group.add(chunk);
  }
  group.userData.animate = (dt) => {
    group.rotation.y += dt * 0.02;
  };
  return group;
}
