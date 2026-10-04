// Faction emblems — the five sigils the flags paint on their hulls, their
// desks and their worlds.
//
// Each emblem is a small set of draw-ops in a 0..100 box, so one definition
// renders three ways: inline SVG for the UI, a 2D canvas for hull decals, and
// a billboarded sprite for stations and worlds. Colour comes from the flag
// itself (data/factions.js) — primary, a lighter accent for highlights, and a
// near-black ink for the cut lines — so every sigil follows its flag's colours
// with no extra wiring.
//
//   free     — the open hub: three lanes radiating out of a ring (the ports)
//   combine  — the cog: an eight-tooth wheel (the foundries)
//   vigil    — the eye: a wide-open watch (the law)
//   reaver   — the claw: three slashes left by a wreck (the Clans)
//   kreth    — the sigil: a diamond within a diamond, sealed and old (the Houses)

import * as THREE from 'three';
import { FACTIONS, isFaction } from '../data/factions.js';

/** Parse '#rrggbb' into [r, g, b]. */
function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Blend a faction colour toward white by `t` (0..1) for an accent shade. */
function lighten(hex, t) {
  const [r, g, b] = hexRgb(hex);
  const mix = (v) => Math.round(v + (255 - v) * t);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

/** Palette for a flag: primary, accent, ink. */
function palette(id) {
  const color = FACTIONS[id]?.color || '#9fb0c6';
  return { p: color, a: lighten(color, 0.42), i: '#08131d' };
}

/** Eight cog teeth around the hub. */
function cogTeeth() {
  const ops = [];
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    ops.push({
      t: 'line',
      x1: 50 + Math.cos(a) * 34, y1: 50 + Math.sin(a) * 34,
      x2: 50 + Math.cos(a) * 45, y2: 50 + Math.sin(a) * 45,
      c: 'p', w: 9,
    });
  }
  return ops;
}

const EMBLEMS = {
  free: [
    { t: 'line', x1: 50, y1: 50, x2: 50, y2: 11, c: 'p', w: 7 },
    { t: 'line', x1: 50, y1: 50, x2: 16, y2: 70, c: 'p', w: 7 },
    { t: 'line', x1: 50, y1: 50, x2: 84, y2: 70, c: 'p', w: 7 },
    { t: 'circle', cx: 50, cy: 50, r: 26, stroke: 'p', w: 6 },
    { t: 'circle', cx: 50, cy: 50, r: 9, fill: 'a' },
  ],
  combine: [
    ...cogTeeth(),
    { t: 'circle', cx: 50, cy: 50, r: 28, stroke: 'p', w: 7 },
    { t: 'circle', cx: 50, cy: 50, r: 11, fill: 'a' },
    { t: 'circle', cx: 50, cy: 50, r: 4.5, fill: 'i' },
  ],
  vigil: [
    { t: 'path', d: 'M50 16 C32 16 18 32 18 50 C18 68 32 84 50 84 C68 84 82 68 82 50 C82 32 68 16 50 16 Z', stroke: 'p', w: 7 },
    { t: 'circle', cx: 50, cy: 50, r: 17, fill: 'a' },
    { t: 'circle', cx: 50, cy: 50, r: 7, fill: 'i' },
  ],
  reaver: [
    { t: 'poly', pts: [[22, 8], [33, 8], [44, 92], [33, 92]], fill: 'p' },
    { t: 'poly', pts: [[44, 8], [55, 8], [66, 92], [55, 92]], fill: 'a' },
    { t: 'poly', pts: [[66, 8], [77, 8], [88, 92], [77, 92]], fill: 'p' },
  ],
  kreth: [
    { t: 'poly', pts: [[50, 6], [94, 50], [50, 94], [6, 50]], stroke: 'p', w: 7 },
    { t: 'poly', pts: [[50, 22], [72, 50], [50, 78], [28, 50]], stroke: 'a', w: 5 },
    { t: 'circle', cx: 50, cy: 50, r: 7, fill: 'p' },
  ],
};

/** An emblem as an inline SVG string, for the UI. */
export function emblemSVG(id, size = 18) {
  if (!isFaction(id)) return '';
  const pal = palette(id);
  const parts = [];
  for (const op of EMBLEMS[id]) {
    const col = (k) => pal[k] || 'none';
    const stroke = op.stroke ? ` stroke="${col(op.stroke)}" stroke-width="${op.w ?? 6}" stroke-linecap="round" stroke-linejoin="round"` : '';
    const fill = op.fill ? ` fill="${col(op.fill)}"` : (op.stroke ? ' fill="none"' : '');
    if (op.t === 'line') {
      parts.push(`<line x1="${op.x1}" y1="${op.y1}" x2="${op.x2}" y2="${op.y2}"${stroke}${fill}/>`);
    } else if (op.t === 'circle') {
      parts.push(`<circle cx="${op.cx}" cy="${op.cy}" r="${op.r}"${stroke}${fill}/>`);
    } else if (op.t === 'poly') {
      const pts = op.pts.map(([x, y]) => `${x},${y}`).join(' ');
      parts.push(`<polygon points="${pts}"${stroke}${fill}/>`);
    } else if (op.t === 'path') {
      parts.push(`<path d="${op.d}"${stroke}${fill}/>`);
    }
  }
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
}

/** Draw an emblem's ops onto a 2D context, box = ctx size. */
function drawOps(ctx, id, size) {
  const pal = palette(id);
  const s = size / 100;
  ctx.clearRect(0, 0, size, size);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const op of EMBLEMS[id]) {
    if (op.t === 'path') {
      const p = new Path2D(op.d);
      if (op.fill) { ctx.fillStyle = pal[op.fill]; ctx.fill(p); }
      if (op.stroke) { ctx.strokeStyle = pal[op.stroke]; ctx.lineWidth = (op.w ?? 6) * s; ctx.stroke(p); }
      continue;
    }
    ctx.beginPath();
    if (op.t === 'line') {
      ctx.moveTo(op.x1 * s, op.y1 * s);
      ctx.lineTo(op.x2 * s, op.y2 * s);
    } else if (op.t === 'circle') {
      ctx.arc(op.cx * s, op.cy * s, op.r * s, 0, Math.PI * 2);
    } else if (op.t === 'poly') {
      ctx.moveTo(op.pts[0][0] * s, op.pts[0][1] * s);
      for (let i = 1; i < op.pts.length; i++) ctx.lineTo(op.pts[i][0] * s, op.pts[i][1] * s);
      ctx.closePath();
    }
    if (op.fill) { ctx.fillStyle = pal[op.fill]; ctx.fill(); }
    if (op.stroke) { ctx.strokeStyle = pal[op.stroke]; ctx.lineWidth = (op.w ?? 6) * s; ctx.stroke(); }
  }
}

const texCache = new Map();

/** A cached canvas texture of an emblem, for hull decals and sprites. */
export function emblemTexture(id) {
  if (!isFaction(id)) return null;
  if (texCache.has(id)) return texCache.get(id);
  const px = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = px;
  drawOps(canvas.getContext('2d'), id, px);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  texCache.set(id, tex);
  return tex;
}

/**
 * A billboarded emblem sprite — the flag's sigil floating over a hull, a
 * station or a world. Shared texture per faction; the material is per sprite so
 * callers may keep or dispose it freely.
 */
export function emblemSprite(id, size = 40) {
  const tex = emblemTexture(id);
  if (!tex) return null;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(size, size, 1);
  spr.userData.factionEmblem = id;
  return spr;
}
