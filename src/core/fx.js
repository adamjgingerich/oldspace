// Glow textures + a lightweight effects system (explosions, sparks, flashes).

import * as THREE from 'three';

const texCache = new Map();

/** Radial glow texture, cached per colour. */
export function glowTexture(color = 0xffffff) {
  const key = String(color);
  if (texCache.has(key)) return texCache.get(key);
  const size = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const c = new THREE.Color(color);
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  const grad = ctx.createRadialGradient(64, 64, 1, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.22, `rgba(${r},${g},${b},0.9)`);
  grad.addColorStop(0.55, `rgba(${r},${g},${b},0.28)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}

export function glowSprite(color, scale = 40) {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(color),
    color,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(scale, scale, 1);
  return spr;
}

export class Fx {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
  }

  explosion(pos, { size = 60, color = 0xffb060, life = 0.75, sparkCount = 10 } = {}) {
    const spr = glowSprite(color, size * 0.6);
    spr.position.copy(pos);
    spr.position.y = 6;
    this.scene.add(spr);
    this.items.push({ kind: 'boom', obj: spr, t: 0, life, size, growth: size * 1.9 });

    const core = glowSprite(0xffffff, size * 0.34);
    core.position.copy(spr.position);
    this.scene.add(core);
    this.items.push({ kind: 'boom', obj: core, t: 0, life: life * 0.55, size: size * 0.34, growth: size * 0.9 });

    for (let i = 0; i < sparkCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 60 + Math.random() * size * 4;
      const s = glowSprite(color, 8 + Math.random() * 10);
      s.position.copy(pos);
      s.position.y = 6;
      this.scene.add(s);
      this.items.push({
        kind: 'spark',
        obj: s,
        t: 0,
        life: 0.3 + Math.random() * 0.5,
        vx: Math.cos(a) * v,
        vz: Math.sin(a) * v,
      });
    }
  }

  hitFlash(pos, { size = 18, color = 0x8fd8ff } = {}) {
    const spr = glowSprite(color, size);
    spr.position.copy(pos);
    spr.position.y = 5;
    this.scene.add(spr);
    this.items.push({ kind: 'boom', obj: spr, t: 0, life: 0.22, size, growth: size * 1.4 });
  }

  trailPuff(pos, { color = 0x88ddff, size = 10, life = 0.35, vx = 0, vz = 0, alpha = 1 } = {}) {
    const spr = glowSprite(color, size);
    spr.position.copy(pos);
    spr.position.y = 4;
    spr.material.opacity = alpha;
    this.scene.add(spr);
    this.items.push({ kind: 'spark', obj: spr, t: 0, life, vx, vz, alpha });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      const k = it.t / it.life;
      if (k >= 1) {
        this.scene.remove(it.obj);
        it.obj.material.dispose?.();
        this.items.splice(i, 1);
        continue;
      }
      if (it.kind === 'boom') {
        const s = it.size + (it.growth - it.size) * k;
        it.obj.scale.set(s, s, 1);
        it.obj.material.opacity = 1 - k * k;
      } else {
        it.obj.position.x += it.vx * dt;
        it.obj.position.z += it.vz * dt;
        it.vx *= 1 - 1.6 * dt;
        it.vz *= 1 - 1.6 * dt;
        const s = it.obj.scale.x * (1 - 0.7 * dt);
        it.obj.scale.set(s, s, 1);
        it.obj.material.opacity = (it.alpha ?? 1) * (1 - k);
      }
    }
  }

  clear() {
    for (const it of this.items) {
      this.scene.remove(it.obj);
      it.obj.material.dispose?.();
    }
    this.items.length = 0;
  }
}
