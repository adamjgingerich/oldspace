// Weapons fire, projectiles, missiles, rams and impact bookkeeping.

import * as THREE from 'three';
import { WEAPON_BY_ID } from '../data/weapons.js';
import { glowSprite } from '../core/fx.js';
import { wrapAngle, angleDiff, clamp, distSq2 } from '../core/util.js';

export function leadPoint(shooter, target, projSpeed) {
  const dx = target.x - shooter.x;
  const dz = target.z - shooter.z;
  const t = Math.min(1.6, Math.hypot(dx, dz) / Math.max(1, projSpeed));
  return { x: target.x + target.vx * t, z: target.z + target.vz * t };
}

/** Shared unit box for beam visuals (one material per beam for fading). */
const BEAM_GEO = new THREE.BoxGeometry(1, 1, 1);

export class Combat {
  constructor({ scene, fx, audio, universe }) {
    this.scene = scene;
    this.fx = fx;
    this.audio = audio;
    this.universe = universe;
    this.projectiles = [];
    this.beams = [];
    this._npcSfxAt = 0;
  }

  /** Attempt to fire a weapon slot. Returns true if a shot left the rail. */
  fire(ship, slot, targetShip = null) {
    if (!ship.alive) return false;
    const weaponId = ship.weapons?.[slot];
    if (!weaponId) return false;
    const w = WEAPON_BY_ID[weaponId];
    if (!w) return false;
    if (ship.cooldowns[slot] > 0) return false;
    if (ship.energy < w.energy) return false;
    if (w.kind === 'missile') {
      if ((ship.ammo[weaponId] || 0) <= 0) {
        if (ship.isPlayer) this.audio.ui();
        return false;
      }
      ship.ammo[weaponId] -= 1;
    }
    ship.cooldowns[slot] = w.cooldown * (ship.cdMult ?? 1);
    ship.energy -= w.energy;

    // aim: follow the locked target inside the gun arc — the Auto-Tracking
    // Computer widens that arc from nose-cone to full turret
    let aim = ship.nosePoint(3);
    if (targetShip && targetShip.alive) {
      const lead = leadPoint(ship, targetShip, w.speed || 900);
      const want = Math.atan2(lead.x - ship.x, lead.z - ship.z);
      const offBore = Math.abs(wrapAngle(want - ship.heading));
      // missiles home, so they always take the lock
      if (w.kind === 'missile' || offBore <= (ship.trackCone ?? 0.5)) aim = lead;
    }
    const spread = (w.spread || 0) * (ship.spreadMult ?? 1) + (ship.aimError || 0) + (ship.focusErr || 0);
    const aimAngle = Math.atan2(aim.x - ship.x, aim.z - ship.z) + (Math.random() - 0.5) * 2 * spread;

    const nose = ship.nosePoint(w.kind === 'missile' ? 0.35 : 0.62);
    if (w.kind === 'beam') {
      this._fireBeam(ship, w, nose.x, nose.z, aimAngle);
    } else {
      const barrels = w.twin ? [-ship.def.len * 0.09, ship.def.len * 0.09] : [0];
      const perpX = Math.cos(ship.heading);
      const perpZ = -Math.sin(ship.heading);
      // multi-mount hulls stagger their muzzles across the beam
      const nSlots = Math.max(1, Math.min(ship.weapons.length, ship.def.mounts ?? ship.weapons.length));
      const slotOff = (slot - (nSlots - 1) / 2) * ship.def.len * 0.14;
      for (const off of barrels) {
        const lateral = off + slotOff;
        this._spawn(ship, w, nose.x + perpX * lateral, nose.z + perpZ * lateral, aimAngle, targetShip);
      }
    }
    this._shotSfx(ship, w);
    this.fx.hitFlash(
      { x: nose.x, y: 5, z: nose.z },
      { size: ship.def.len * (w.size === 'heavy' ? 0.8 : 0.45), color: w.color },
    );
    return true;
  }

  /** Shared weapon report — NPC fire is quieter and rate-limited. */
  _shotSfx(ship, w) {
    const now = performance.now();
    if (!ship.isPlayer && now - this._npcSfxAt <= 95) return;
    if (!ship.isPlayer) this._npcSfxAt = now;
    const vol = ship.isPlayer ? 1 : 0.38;
    if (w.kind === 'missile') this.audio.missile(vol);
    else if (w.kind === 'kinetic') this.audio.kinetic(vol);
    else this.audio.laser(w.size === 'heavy', vol);
  }

  /** Instant-hit ray: finds the nearest ship (or rock) along the line. */
  _fireBeam(ship, w, x, z, angle) {
    const dirX = Math.sin(angle);
    const dirZ = Math.cos(angle);
    let hitShip = null;
    let hitDist = w.range;

    for (const s of this.universe.ships) {
      if (!s.alive || s === ship) continue;
      if (!ship.isPlayer && !s.isPlayer && s.faction === ship.faction) continue;
      if (!ship.isPlayer && ship.role === 'escort' && s.isPlayer) continue;
      if (ship.isPlayer && s.role === 'escort') continue;
      const rx = s.x - x;
      const rz = s.z - z;
      const t = rx * dirX + rz * dirZ;
      if (t < 0 || t > hitDist) continue;
      const px = rx - dirX * t;
      const pz = rz - dirZ * t;
      const rr = s.radius + 6;
      if (px * px + pz * pz <= rr * rr) {
        hitDist = t;
        hitShip = s;
      }
    }
    // asteroids eat the beam too
    for (const a of this.universe.asteroids || []) {
      const rx = a.x - x;
      const rz = a.z - z;
      const t = rx * dirX + rz * dirZ;
      if (t < 0 || t > hitDist) continue;
      const px = rx - dirX * t;
      const pz = rz - dirZ * t;
      const rr = a.r + 4;
      if (px * px + pz * pz <= rr * rr) {
        hitDist = t;
        hitShip = null;
      }
    }

    const ex = x + dirX * hitDist;
    const ez = z + dirZ * hitDist;
    this._spawnBeam(x, z, ex, ez, w.color, w.size === 'heavy' ? 5 : 2.6);

    if (hitShip) {
      const res = hitShip.damage(w.dmg * (ship.dmgMult || 1), { fx: this.fx });
      const hitVol = hitShip.isPlayer ? 1 : 0.55;
      if (res.shieldHit) {
        this.audio.shieldHit(hitVol);
        this.fx.hitFlash({ x: ex, y: 5, z: ez }, { size: 20, color: 0x8fd8ff });
      } else {
        this.audio.hit(hitVol);
        this.fx.hitFlash({ x: ex, y: 5, z: ez }, { size: 24, color: 0xffb060 });
      }
      if (res.destroyed) this.universe.onShipDestroyed(hitShip, ship);
      else if (!hitShip.isPlayer) this.universe.onShipAttacked(hitShip, ship, w.dmg * (ship.dmgMult || 1));
    }
  }

  /** A fading lance of light between two points. */
  _spawnBeam(x1, z1, x2, z2, color, width) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const ang = Math.atan2(x2 - x1, z2 - z1);
    const mesh = new THREE.Mesh(
      BEAM_GEO,
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    mesh.position.set((x1 + x2) / 2, 6.5, (z1 + z2) / 2);
    mesh.rotation.y = ang;
    mesh.scale.set(width, 1.6, len);
    this.scene.add(mesh);
    this.beams.push({ mesh, life: 0.11 });
  }

  _spawn(owner, w, x, z, angle, targetShip) {
    const spr = glowSprite(w.color, 18);
    if (w.kind === 'missile') spr.scale.set(w.size === 'heavy' ? 16 : 12, w.size === 'heavy' ? 16 : 12, 1);
    else spr.scale.set(9, 24, 1);
    spr.position.set(x, 6, z);
    this.scene.add(spr);
    this.projectiles.push({
      mesh: spr,
      x, z,
      vx: Math.sin(angle) * w.speed,
      vz: Math.cos(angle) * w.speed,
      dmg: w.dmg * (owner.dmgMult || 1),
      shieldBonus: w.shieldBonus || 1,
      color: w.color,
      kind: w.kind,
      speed: w.speed,
      owner,
      life: w.range / w.speed,
      homing: w.kind === 'missile' && targetShip && targetShip.alive ? targetShip : null,
      turn: w.turn || 0,
      trailTimer: 0,
    });
  }

  update(dt) {
    const u = this.universe;
    const ships = u.ships;
    const asteroids = u.asteroids || [];

    // fade and retire beam lances
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.life -= dt;
      b.mesh.material.opacity = Math.max(0, b.life / 0.11) * 0.9;
      if (b.life <= 0) {
        this.scene.remove(b.mesh);
        b.mesh.material.dispose();
        this.beams.splice(i, 1);
      }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];

      if (p.homing && p.homing.alive) {
        const desired = Math.atan2(p.homing.x - p.x, p.homing.z - p.z);
        const cur = Math.atan2(p.vx, p.vz);
        const d = angleDiff(cur, desired);
        const na = wrapAngle(cur + clamp(d, -p.turn * dt, p.turn * dt));
        p.vx = Math.sin(na) * p.speed;
        p.vz = Math.cos(na) * p.speed;
      }

      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.life -= dt;
      p.mesh.position.set(p.x, 6, p.z);

      if (p.kind === 'missile') {
        p.trailTimer -= dt;
        if (p.trailTimer <= 0) {
          p.trailTimer = 0.05;
          this.fx.trailPuff(
            { x: p.x, y: 5, z: p.z },
            { color: p.color || 0xff8fb0, size: 9, life: 0.4, vx: -p.vx * 0.12, vz: -p.vz * 0.12 },
          );
        }
      }

      if (p.life <= 0) {
        this._kill(i, false);
        continue;
      }

      // --- ships ---
      let hit = false;
      for (const ship of ships) {
        if (!ship.alive || ship === p.owner) continue;
        // AI shots respect their own colours; player shots respect nothing
        if (!p.owner.isPlayer && !ship.isPlayer && ship.faction === p.owner.faction) continue;
        // your wing never hits you, and your guns never hit your wing
        if (!p.owner.isPlayer && p.owner.role === 'escort' && ship.isPlayer) continue;
        if (p.owner.isPlayer && ship.role === 'escort') continue;
        const rr = ship.radius + (p.kind === 'missile' ? 14 : 8);
        if (distSq2(p.x, p.z, ship.x, ship.z) < rr * rr) {
          // shield-breaker warheads bite hardest while the lattice holds
          const dealt = p.shieldBonus > 1 && ship.shield > 0 ? p.dmg * p.shieldBonus : p.dmg;
          const res = ship.damage(dealt, { fx: this.fx });
          const hitVol = ship.isPlayer ? 1 : 0.55;
          if (res.shieldHit) {
            this.audio.shieldHit(hitVol);
            this.fx.hitFlash({ x: p.x, y: 5, z: p.z }, { size: 22, color: 0x8fd8ff });
          } else {
            this.audio.hit(hitVol);
            this.fx.hitFlash({ x: p.x, y: 5, z: p.z }, { size: 26, color: 0xffb060 });
          }
          if (res.destroyed) {
            u.onShipDestroyed(ship, p.owner);
          } else if (!ship.isPlayer) {
            u.onShipAttacked(ship, p.owner, dealt);
          }
          hit = true;
          break;
        }
      }
      if (hit) {
        this._kill(i, true);
        continue;
      }

      // --- asteroids ---
      for (const a of asteroids) {
        const rr = a.r + 8;
        if (distSq2(p.x, p.z, a.x, a.z) < rr * rr) {
          this.fx.hitFlash({ x: p.x, y: 5, z: p.z }, { size: 24, color: 0xccbb99 });
          this.audio.hit();
          this._kill(i, true);
          hit = true;
          break;
        }
      }
      if (hit) continue;
    }

    // --- ship vs ship rams ---
    for (let i = 0; i < ships.length; i++) {
      const a = ships[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < ships.length; j++) {
        const b = ships[j];
        if (!b.alive) continue;
        const rr = a.radius + b.radius + 6;
        const d2 = distSq2(a.x, a.z, b.x, b.z);
        if (d2 < rr * rr) {
          const relSpeed = Math.hypot(a.vx - b.vx, a.vz - b.vz);
          // rams scratch hulls rather than execute: gentler factor, higher bar to bite
          if (relSpeed > 45) {
            const base = relSpeed * 0.06;
            const resA = a.damage(base * (b.dmgMult ?? 1), { fx: this.fx });
            const resB = b.damage(base * (a.dmgMult ?? 1), { fx: this.fx });
            if (resA.destroyed) u.onShipDestroyed(a, b);
            if (resB.destroyed) u.onShipDestroyed(b, a);
          }
          const d = Math.sqrt(Math.max(1e-4, d2));
          const nx = (a.x - b.x) / d;
          const nz = (a.z - b.z) / d;
          const push = 260 * dt;
          a.x += nx * push;
          a.z += nz * push;
          b.x -= nx * push;
          b.z -= nz * push;
        }
      }
    }
  }

  _kill(index, withImpact) {
    const p = this.projectiles[index];
    this.scene.remove(p.mesh);
    p.mesh.material.dispose?.();
    this.projectiles.splice(index, 1);
    if (withImpact && p.kind === 'missile') {
      this.fx.explosion({ x: p.x, y: 5, z: p.z }, { size: 46, color: p.color || 0xffa060, sparkCount: 6 });
      this.audio.boom(0.7);
    }
  }

  clear() {
    for (const p of this.projectiles) {
      this.scene.remove(p.mesh);
      p.mesh.material.dispose?.();
    }
    this.projectiles.length = 0;
    for (const b of this.beams) {
      this.scene.remove(b.mesh);
      b.mesh.material.dispose();
    }
    this.beams.length = 0;
  }
}
