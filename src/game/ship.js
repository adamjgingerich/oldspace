// A ship in flight: classic inertial movement — thrust, drift, retro burn.

import * as THREE from 'three';
import { buildShip, factionColor } from '../core/meshes.js';
import { glowSprite } from '../core/fx.js';
import { clamp, wrapAngle } from '../core/util.js';
import { SHIP_BY_ID } from '../data/ships.js';

/**
 * Engine burst (hold Shift): extra forward thrust for a short burn, with a
 * tank that refills over time. Cutting out empty requires a partial re-arm
 * so the tank cannot be stuttered at zero.
 */
export const BURST = { duration: 1.8, recharge: 6.5, rearm: 0.3, accel: 1.4 };

/**
 * Wake styles — every hull design trails the lanes its own way. The style is
 * hashed from the hull id, so a given ship always wakes the same way:
 *   steady — a soft blue ribbon (the common drive)
 *   long   — fast hulls cut a thin streak that hangs in space
 *   heavy  — multi-bell drives push fat twin plumes
 *   pulse  — an older drive that fires in bright dashes with dark between
 */
const WAKE_STYLES = {
  steady: { interval: 0.055, life: 0.5, size: 0.22, alpha: 0.85, drift: 26, color: 0x7fd8ff },
  long: { interval: 0.045, life: 0.95, size: 0.16, alpha: 0.7, drift: 14, color: 0x8fe0ff },
  heavy: { interval: 0.085, life: 0.8, size: 0.3, alpha: 0.8, drift: 22, color: 0x6fc8ff, twin: true },
  pulse: { life: 0.7, size: 0.24, alpha: 1, drift: 18, color: 0xa8ecff, pulse: { period: 0.9, count: 3, gap: 0.09 } },
};

function wakeStyleFor(def) {
  const id = def.id || def.name || 'ship';
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0;
  return ['steady', 'long', 'pulse', 'heavy', 'steady', 'long', 'heavy', 'pulse'][h % 8];
}

export function baseStats(def) {
  return {
    hull: def.hull,
    shield: def.shield,
    shieldRegen: def.shieldRegen,
    energy: def.energy,
    energyRegen: def.energyRegen,
    accel: def.accel,
    maxSpeed: def.maxSpeed,
    brake: def.brake,
    turn: def.turn,
    cargo: def.cargo,
    lumenMax: 6,
    radar: 1400,
    armorRegen: 0,
  };
}

export class Ship {
  constructor({
    def, stats, scene, x = 0, z = 0, heading = 0, faction = 'free',
    isPlayer = false, name = '', role = 'neutral', loadout = null,
  }) {
    this.def = def;
    this.stats = stats || baseStats(def);
    this.scene = scene;
    this.isPlayer = isPlayer;
    this.faction = faction;
    this.name = name || def.name;
    this.radius = def.radius ?? Math.max(10, def.len * 0.5); // collision/hit radius
    this.role = role; // 'player' | 'pirate' | 'navy' | 'trader' | 'bounty'
    this.bountyMissionId = null;

    const { group, api } = buildShip(def, { accent: factionColor(faction).getHex(), isPlayer, loadout });
    this.group = group;
    this.api = api;
    scene.add(group);

    // shield bubble glow
    this.shieldGlow = glowSprite(0x6fd8ff, def.len * 2.6);
    this.shieldGlow.material.opacity = 0;
    group.add(this.shieldGlow);

    // enemy halo — a soft light-red sheen worn while this hull is hostile
    this.hostileGlow = glowSprite(0xff6a6a, def.len * 3.1);
    this.hostileGlow.material.opacity = 0;
    this.hostileGlow.visible = false;
    group.add(this.hostileGlow);
    this._hostileFx = 0;
    this._hostilePhase = Math.random() * Math.PI * 2;

    this.x = x;
    this.z = z;
    this.vx = 0;
    this.vz = 0;
    this.heading = heading;

    this.hull = this.stats.hull;
    this.shield = this.stats.shield;
    this.energy = this.stats.energy;

    this.throttleCmd = 0; // 0..1 main drive
    this.brakeCmd = 0; // 0..1 retro/reverse
    this.turnInput = 0; // -1..1
    this.boostInput = false; // hold Shift
    this.boostActive = false;
    this.boostCharge = 1; // 0..1 burst tank
    this._boostFxTimer = 0;
    this.weapons = [null, null];
    this.ammo = {};

    this.cooldowns = [0, 0, 0, 0, 0, 0, 0, 0];
    this.shieldRegenDelay = 0;
    this.alive = true;
    this.despawn = false;
    this.wakeStyle = wakeStyleFor(def);
    this._trailTimer = 0;
    this._pulseTimer = Math.random() * 0.9;
    this._pulseBurst = 0;
    this._pulseGap = 0;
    this._rcsTimer = 0;
    this._massRumble = 0;

    this.api.setThrottle(0);
  }

  get speed() {
    return Math.hypot(this.vx, this.vz);
  }
  get velocityAngle() {
    return Math.atan2(this.vx, this.vz);
  }
  /** how far the drift angle is off the bow, in degrees (0 = tracking clean) */
  get driftDeg() {
    if (this.speed < 6) return 0;
    const d = Math.abs(wrapAngle(this.velocityAngle - this.heading));
    return (d * 180) / Math.PI;
  }

  update(dt, fx) {
    if (!this.alive) return;
    const st = this.stats;

    // --- helm ---
    this.heading = wrapAngle(this.heading + this.turnInput * st.turn * dt);

    const fwdX = Math.sin(this.heading);
    const fwdZ = Math.cos(this.heading);
    let ax = 0;
    let az = 0;

    // --- main drive ---
    const thr = clamp(this.throttleCmd, 0, 1);
    if (thr > 0.01) {
      ax += fwdX * st.accel * thr;
      az += fwdZ * st.accel * thr;
    }

    // --- retro burn: kills velocity first, then pushes astern ---
    if (this.brakeCmd > 0.01) {
      const sp = this.speed;
      if (sp > 8) {
        ax -= (this.vx / sp) * st.brake * this.brakeCmd;
        az -= (this.vz / sp) * st.brake * this.brakeCmd;
      } else {
        ax -= fwdX * st.brake * 0.55 * this.brakeCmd;
        az -= fwdZ * st.brake * 0.55 * this.brakeCmd;
      }
    }

    // --- engine burst: extra drive thrust while the tank lasts ---
    if (!this.boostInput) this.boostActive = false;
    if (this.boostActive) {
      this.boostCharge = Math.max(0, this.boostCharge - dt / BURST.duration);
      if (this.boostCharge <= 0) this.boostActive = false; // cut out — needs re-arm
    } else {
      this.boostCharge = Math.min(1, this.boostCharge + dt / BURST.recharge);
      if (this.boostInput && this.boostCharge >= BURST.rearm) this.boostActive = true;
    }
    if (this.boostActive) {
      ax += fwdX * st.accel * BURST.accel;
      az += fwdZ * st.accel * BURST.accel;
    }

    // --- space friction: light, so momentum carries and drifting matters ---
    const drag = (st.accel / Math.max(1, st.maxSpeed)) * 0.6;
    ax -= this.vx * drag;
    az -= this.vz * drag;

    this.vx += ax * dt;
    this.vz += az * dt;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // --- regeneration ---
    this.energy = Math.min(st.energy, this.energy + st.energyRegen * dt);
    this.shieldRegenDelay = Math.max(0, this.shieldRegenDelay - dt);
    if (this.shieldRegenDelay === 0 && this.shield < st.shield) {
      this.shield = Math.min(st.shield, this.shield + st.shieldRegen * dt);
    }
    if (st.armorRegen > 0 && this.hull < st.hull) {
      this.hull = Math.min(st.hull, this.hull + st.armorRegen * dt);
    }
    for (let i = 0; i < this.cooldowns.length; i++) this.cooldowns[i] = Math.max(0, this.cooldowns[i] - dt);

    // --- visuals ---
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
    this.api.setThrottle(this.boostActive ? 1 : Math.max(thr, this.brakeCmd * 0.25));
    this.api.pulse(performance.now() * 0.001);

    if (fx) {
      // engine wake — each hull's drive leaves its own kind of trail
      const burn = Math.max(thr, this.brakeCmd * 0.4);
      const wp = WAKE_STYLES[this.wakeStyle] || WAKE_STYLES.steady;
      const emit = (off, scale = 1) => {
        const backX = -Math.sin(this.heading);
        const backZ = -Math.cos(this.heading);
        const sideX = Math.cos(this.heading);
        const sideZ = -Math.sin(this.heading);
        const d = this.def.len * 0.6;
        fx.trailPuff(
          { x: this.x + backX * d + sideX * off, y: 4, z: this.z + backZ * d + sideZ * off },
          {
            color: wp.color,
            size: wp.size * this.def.len * scale,
            life: wp.life,
            alpha: wp.alpha,
            vx: -fwdX * wp.drift,
            vz: -fwdZ * wp.drift,
          },
        );
      };
      if (burn > 0.28) {
        if (wp.pulse) {
          // an older drive: bright dashes, then a beat of dark
          this._pulseTimer -= dt;
          if (this._pulseTimer <= 0) {
            this._pulseTimer = wp.pulse.period;
            this._pulseBurst = wp.pulse.count;
            this._pulseGap = 0;
          }
          if (this._pulseBurst > 0) {
            this._pulseGap -= dt;
            if (this._pulseGap <= 0) {
              this._pulseGap = wp.pulse.gap;
              this._pulseBurst -= 1;
              emit(0, 1.2);
            }
          }
        } else {
          this._trailTimer -= dt;
          if (this._trailTimer <= 0) {
            this._trailTimer = wp.interval;
            if (wp.twin) {
              const off = this.def.len * 0.055;
              emit(off);
              emit(-off);
            } else {
              emit(0);
            }
          }
        }
      }
      // burst wake — brighter and longer than the drive plume
      if (this.boostActive) {
        this._boostFxTimer -= dt;
        if (this._boostFxTimer <= 0) {
          this._boostFxTimer = 0.028;
          const wx = this.x - Math.sin(this.heading) * this.def.len * 0.66;
          const wz = this.z - Math.cos(this.heading) * this.def.len * 0.66;
          fx.trailPuff(
            { x: wx, y: 4, z: wz },
            { color: 0x8fe4ff, size: this.def.len * 0.36, life: 0.34, alpha: 0.9, vx: -fwdX * 74, vz: -fwdZ * 74 },
          );
        }
      }
      // RCS puffs while slewing
      this._rcsTimer -= dt;
      if (Math.abs(this.turnInput) > 0.4 && this._rcsTimer <= 0) {
        this._rcsTimer = 0.12;
        const side = Math.sign(this.turnInput);
        const px = Math.cos(this.heading) * side;
        const pz = -Math.sin(this.heading) * side;
        const nose = this.def.len * 0.3;
        fx.trailPuff(
          { x: this.x + px * this.def.len * 0.2 + Math.sin(this.heading) * nose, y: 3, z: this.z + pz * this.def.len * 0.2 + Math.cos(this.heading) * nose },
          { color: 0xcfe8ff, size: this.def.len * 0.09, life: 0.22, vx: px * 18, vz: pz * 18 },
        );
      }
    }

    // shield bubble shimmer
    const target = this.shield > 0 ? 0.06 : 0;
    const cur = this.shieldGlow.material.opacity;
    this.shieldGlow.material.opacity = Math.max(target, cur - dt * 1.4);
  }

  nosePoint(offset = 0.6) {
    const L = this.def.len * offset;
    return {
      x: this.x + Math.sin(this.heading) * L,
      z: this.z + Math.cos(this.heading) * L,
    };
  }

  /** Fade the soft red enemy-halo sheen on or off (driven by the universe). */
  setHostileFX(on, dt = 0.016, t = 0) {
    this._hostileFx += ((on ? 1 : 0) - this._hostileFx) * Math.min(1, dt * 6);
    if (!on && this._hostileFx < 0.02) {
      this.hostileGlow.visible = false;
      return;
    }
    this.hostileGlow.visible = true;
    this.hostileGlow.material.opacity = this._hostileFx * (0.2 + 0.08 * Math.sin(t * 3.1 + this._hostilePhase));
  }

  /**
   * Apply damage. Shields absorb first; armour takes the rest.
   * @returns {{destroyed: boolean, shieldHit: boolean, hullHit: number}}
   */
  damage(amount, { fx = null } = {}) {
    if (!this.alive) return { destroyed: false, shieldHit: false, hullHit: 0 };
    amount *= this.dmgTakenMult ?? 1;
    let remaining = amount;
    let shieldHit = false;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, remaining);
      this.shield -= absorbed;
      remaining -= absorbed;
      shieldHit = absorbed > 0;
      this.shieldGlow.material.opacity = 0.55;
    }
    this.shieldRegenDelay = 3;
    let hullHit = 0;
    if (remaining > 0) {
      hullHit = remaining;
      this.hull -= remaining;
    }
    const destroyed = this.hull <= 0;
    return { destroyed, shieldHit, hullHit };
  }

  destroy(fx) {
    if (!this.alive) return;
    this.alive = false;
    if (fx) {
      const size = this.def.len * 2.2;
      fx.explosion({ x: this.x, y: 6, z: this.z }, { size, sparkCount: 14 });
      fx.explosion({ x: this.x, y: 6, z: this.z }, { size: size * 0.6, color: 0xffffff, sparkCount: 6 });
    }
    this.scene.remove(this.group);
  }

  dispose() {
    this.destroy(null);
    this.group.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material && !o.material.map?.isCanvasTexture) o.material.dispose?.();
    });
  }

  /** NPC factory from a ship id. */
  static npc(shipId, opts) {
    const def = SHIP_BY_ID[shipId] || SHIP_BY_ID.wayfarer;
    return new Ship({ def, ...opts });
  }
}
