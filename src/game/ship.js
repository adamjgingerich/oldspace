// A ship in flight: classic inertial movement — thrust, drift, retro burn.

import * as THREE from 'three';
import { buildShip, factionColor } from '../core/meshes.js';
import { glowSprite } from '../core/fx.js';
import { emblemSprite } from '../core/emblem.js';
import { shieldBubbleGeometry, shieldBubbleMaterial } from '../core/materials.js';
import { clamp, wrapAngle } from '../core/util.js';
import { SHIP_BY_ID } from '../data/ships.js';
import { DEFAULT_SHIELD_TYPE, applyShieldProfile, shieldProfile, shieldTypeFor } from '../data/shields.js';

/**
 * Engine burst (hold Shift): a long shove of extra thrust out of a tank that
 * refills over time. The tank is generous enough to cross a knife-fight in one
 * burn; cutting it out empty requires a partial re-arm, so it cannot be
 * stuttered at zero.
 */
export const BURST = { duration: 3.4, recharge: 10.5, rearm: 0.35, accel: 1.4 };

/**
 * Disruptor snares. A snare coil does nothing to a raised lattice — three
 * clean hits on an unshielded hull put the drives, guns and helm to sleep for
 * DISABLE_TIME. A hull that shakes a snare off is briefly immune, so nobody
 * can be locked down forever.
 */
export const DISRUPT_NEED = 3;
export const DISABLE_TIME = 9;
/**
 * A snared hull with you aboard reboots faster: the crew is motivated. Nine
 * seconds of dead stick is fair for a prize; it is a death sentence in a ring.
 */
export const PLAYER_DISABLE_TIME = 5;
export const DISRUPT_IMMUNITY = 8;

/**
 * The shield shell. How long it takes to blow out once the lattice fails, and
 * the fraction of capacity that has to come back before it re-forms — a shell
 * that flickered up on the first trickle of regeneration would read as if the
 * shield had never gone down at all.
 */
export const SHIELD_POP_TIME = 0.45;
export const SHIELD_BUBBLE_REARM = 0.06;
/** Lattice failure colours: a shell heats amber, then burns red. */
const BUBBLE_AMBER = new THREE.Color(0xffa03c);
const BUBBLE_RED = new THREE.Color(0xff2f2f);

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

export function baseStats(def, { faction = 'free', role = 'neutral', shieldType = null } = {}) {
  return applyShieldProfile({
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
  }, shieldType || shieldTypeFor(def, faction, role));
}

export class Ship {
  constructor({
    def, stats, scene, x = 0, z = 0, heading = 0, faction = 'free',
    isPlayer = false, name = '', role = 'neutral', loadout = null, shieldType = null,
  }) {
    this.def = def;
    this.stats = stats || baseStats(def, { faction, role, shieldType });
    this.scene = scene;
    this.shipProfile = shieldProfile(this.stats.shieldType || DEFAULT_SHIELD_TYPE);
    // kept so a view can rebuild this exact hull — gun fit and all
    this.loadout = loadout;
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

    // shield bubble glow — tinted by the lattice the hull actually flies
    this.shieldGlow = glowSprite(this.shipProfile.color, def.len * 2.6);
    this.shieldGlow.material.opacity = 0;
    group.add(this.shieldGlow);

    // shield shell — the bubble itself. Big enough to clear the whole hull
    // (nose to stern, fins and all), clear enough to read the hull through it.
    this.shieldBubbleR = Math.max(def.len * 0.6, this.radius * 1.45);
    this.shieldBubble = new THREE.Mesh(
      shieldBubbleGeometry(def.len > 90 ? 24 : def.len > 40 ? 18 : 14),
      shieldBubbleMaterial(this.shipProfile.color),
    );
    this.shieldBubble.scale.setScalar(this.shieldBubbleR);
    this.shieldBubble.visible = false;
    this.shieldBubble.renderOrder = 4;
    group.add(this.shieldBubble);
    this._bubbleColor = new THREE.Color(this.shipProfile.color);
    this._latticeColor = new THREE.Color(this.shipProfile.color);
    this._bubbleArmed = true;
    this._shieldPopT = 0;

    // hull glow — a wound sheen that only appears once the plating is opened
    this.hullGlow = glowSprite(0xff7040, def.len * 2.1);
    this.hullGlow.material.opacity = 0;
    this.hullGlow.visible = false;
    group.add(this.hullGlow);

    // snare glow — the cold violet crackle of a snared drive
    this.snareGlow = glowSprite(0xb08cff, def.len * 3);
    this.snareGlow.material.opacity = 0;
    this.snareGlow.visible = false;
    group.add(this.snareGlow);
    this._snarePhase = Math.random() * Math.PI * 2;

    // enemy halo — a soft light-red sheen worn while this hull is hostile
    this.hostileGlow = glowSprite(0xff6a6a, def.len * 3.1);
    this.hostileGlow.material.opacity = 0;
    this.hostileGlow.visible = false;
    group.add(this.hostileGlow);
    this._hostileFx = 0;
    this._hostilePhase = Math.random() * Math.PI * 2;

    // faction emblem — the flag's sigil hung over the dorsal hull
    const emblemSize = Math.max(5, def.len * 0.3);
    this.emblem = emblemSprite(this.faction, emblemSize);
    if (this.emblem) {
      this.emblem.position.set(0, Math.max(5, def.len * 0.26), 0);
      this.emblem.renderOrder = 6;
      this.emblem.material.opacity = 0.92;
      group.add(this.emblem);
    }

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

    // disruptor state: charge carries between hits, a snare stops the ship dead
    this.disabled = false;
    this.disableTimer = 0;
    this.disruptCharge = 0;
    this.disruptImmune = 0;
    this._shieldFlashT = 0;
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

    // --- snare timers ---
    if (this.disruptImmune > 0) this.disruptImmune = Math.max(0, this.disruptImmune - dt);
    if (this._shieldFlashT > 0) this._shieldFlashT = Math.max(0, this._shieldFlashT - dt);
    if (this.disabled) {
      this.disableTimer -= dt;
      if (this.disableTimer <= 0) this.recover();
    } else if (this.disruptCharge > 0) {
      // the charge leaks away again: a snare only holds a hull whose lattice
      // has stayed down
      this.disruptCharge = Math.max(0, this.disruptCharge - dt * 0.55);
    }
    const offline = this.disabled;
    if (offline) {
      // dead stick — the helm, the drive and the burst are all somebody else's
      this.throttleCmd = 0;
      this.brakeCmd = 0;
      this.turnInput = 0;
      this.boostInput = false;
    }

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
    if (!offline && this.shieldRegenDelay === 0 && this.shield < st.shield) {
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

    // --- condition sheen: shield, wounds and snare, readable at a glance ---
    const shieldRatio = st.shield > 0 ? clamp(this.shield / st.shield, 0, 1) : 0;
    const now = performance.now() * 0.001;
    // the flat halo is only a hit flash now: the shell carries the shield's
    // story, and a bright haze here would fog the hull inside it
    const shieldBase = shieldRatio > 0 ? 0.022 + shieldRatio * 0.05 : 0;
    const shimmer = shieldRatio > 0 ? 0.012 * Math.sin(now * 2 + this._hostilePhase) : 0;
    const cur = this.shieldGlow.material.opacity;
    this.shieldGlow.visible = shieldRatio > 0 && cur > 0.004;
    this.shieldGlow.material.opacity = Math.max(shieldBase + shimmer, cur - dt * 1.4);

    this._paintShieldBubble(dt, shieldRatio, now);

    // opened plating glows, and a wreck glows a lot
    const hullRatio = clamp(this.hull / st.hull, 0, 1);
    const wound = hullRatio < 0.62 ? (1 - hullRatio / 0.62) * 0.32 : 0;
    this.hullGlow.visible = wound > 0.002;
    this.hullGlow.material.opacity += (wound - this.hullGlow.material.opacity) * Math.min(1, dt * 4);

    // a snared drive crackles violet until it is shaken off
    if (offline) {
      this.snareGlow.visible = true;
      this.snareGlow.material.opacity = 0.34 + 0.16 * Math.sin(now * 7.5 + this._snarePhase);
    } else if (this.snareGlow.visible) {
      this.snareGlow.material.opacity = Math.max(0, this.snareGlow.material.opacity - dt * 1.2);
      if (this.snareGlow.material.opacity <= 0.01) this.snareGlow.visible = false;
    }
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
   * Run the shield shell for this frame.
   *
   * The shell is the ship's shield made visible: it rides the lattice colour
   * while the field is healthy, reddens and starts to crackle as the field is
   * beaten down, then swells and blows out the instant the lattice fails. It
   * grows back only once there is a real field to show.
   */
  _paintShieldBubble(dt, ratio, now) {
    const shell = this.shieldBubble;
    if (!shell) return;
    if (this._shieldPopT > 0) this._shieldPopT = Math.max(0, this._shieldPopT - dt);
    const popping = this._shieldPopT > 0;

    if (ratio >= SHIELD_BUBBLE_REARM) this._bubbleArmed = true;
    else if (!popping) this._bubbleArmed = false;
    if (!this._bubbleArmed && !popping) {
      shell.visible = false;
      return;
    }
    shell.visible = true;

    // how far gone the field is, and how bright the last hit was
    const death = 1 - ratio;
    const flash = this._shieldFlashT > 0 ? this._shieldFlashT / 0.2 : 0;
    // reddening starts at half strength and is complete by a fifth
    const urgency = clamp((0.5 - ratio) / 0.5, 0, 1);
    const popFrac = popping ? this._shieldPopT / SHIELD_POP_TIME : 0; // 1 → 0

    const u = shell.material.uniforms;
    u.uTime.value = now;
    u.uCrackle.value = urgency * urgency * 0.55 + flash * 0.3;
    // heat the shell in two beats — lattice to amber to red — so it never
    // passes through the grey a direct cyan-to-red blend would give
    if (urgency < 0.5) this._bubbleColor.copy(this._latticeColor).lerp(BUBBLE_AMBER, urgency * 2);
    else this._bubbleColor.copy(BUBBLE_AMBER).lerp(BUBBLE_RED, (urgency - 0.5) * 2);
    u.uColor.value.copy(this._bubbleColor);

    let alpha = (0.06 + ratio * 0.024) * (1 + flash * 1.6 + death * 0.25);
    if (popping) alpha *= Math.pow(popFrac, 0.75);
    u.uAlpha.value = alpha;

    // a failing field strains outward, and a burst throws the shell wide
    const swell = 1 + death * death * 0.045 + flash * 0.025 + (popping ? (1 - popFrac) * 0.45 : 0);
    shell.scale.setScalar(this.shieldBubbleR * swell);
  }

  /** A lattice failing: the shell thrown outward as a ring of light. */
  _shieldPopFX(fx) {
    if (!fx) return;
    const color = this._bubbleColor.getHex();
    const r = this.shieldBubbleR * 0.9;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.random() * 0.35;
      fx.trailPuff(
        { x: this.x + Math.cos(a) * r, y: 4 + Math.random() * 8, z: this.z + Math.sin(a) * r },
        {
          color,
          size: this.def.len * (0.18 + Math.random() * 0.14),
          life: 0.45 + Math.random() * 0.25,
          alpha: 0.8,
          vx: Math.cos(a) * 52,
          vz: Math.sin(a) * 52,
        },
      );
    }
  }

  /**
   * Apply damage. The lattice character decides how much gets through: a
   * shield absorbs the bulk, `shieldBleed` leaks a little of what it eats,
   * and `shieldHull` is the fraction of the remainder that carries on to the
   * plating (1 = the lattice stops everything until it drops).
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
      this.shieldGlow.material.opacity = 0.5;
      this._shieldFlashT = 0.2;
      if (this.shield <= 0) {
        // the lattice has gone: the shell blows out and the drives are open
        this._shieldFlashT = 0.28;
        this._shieldPopT = SHIELD_POP_TIME;
        this._bubbleColor.copy(BUBBLE_RED);
        this._shieldPopFX(fx);
      }
      remaining = remaining * (1 - (this.stats.shieldHull ?? 1)) + absorbed * (this.stats.shieldBleed ?? 0);
    }
    this.shieldRegenDelay = this.stats.shieldDelay ?? 3;
    let hullHit = 0;
    if (remaining > 0) {
      hullHit = remaining;
      this.hull -= remaining;
    }
    const destroyed = this.hull <= 0;
    return { destroyed, shieldHit, hullHit };
  }

  /** 0..1 progress towards a snare — what the HUD reads to show the charge. */
  get snareProgress() {
    return clamp(this.disruptCharge / DISRUPT_NEED, 0, 1);
  }

  /**
   * Feed a disruptor hit into the snare. A raised lattice shrugs the coil off
   * entirely — the hardshield gate the whole mechanic hangs on — and a hull
   * that just shook one off is briefly immune.
   * @returns {{disabled: boolean, held: boolean, immune: boolean, progress: number}}
   */
  addDisrupt(power = 1) {
    const none = { disabled: false, held: false, immune: false, progress: this.snareProgress };
    if (!this.alive || this.disabled) return none;
    if (this.shield > 0) return { ...none, held: true };
    if (this.disruptImmune > 0) return { ...none, immune: true };
    const resist = this.stats.shieldDisrupt ?? 0;
    this.disruptCharge += power * (1 - resist);
    if (this.disruptCharge >= DISRUPT_NEED) {
      this.snare();
      return { disabled: true, held: false, immune: false, progress: 1 };
    }
    return { disabled: false, held: false, immune: false, progress: this.snareProgress };
  }

  /** Stop the ship: drives, guns and helm all go quiet. */
  snare() {
    this.disabled = true;
    this.disableTimer = this.isPlayer ? PLAYER_DISABLE_TIME : DISABLE_TIME;
    this.disruptCharge = 0;
    this.throttleCmd = 0;
    this.brakeCmd = 0;
    this.turnInput = 0;
    this.boostInput = false;
    this.boostActive = false;
    this.shieldRegenDelay = Math.max(this.shieldRegenDelay, DISABLE_TIME);
    // a snared hull is out of the fight — nobody shoots a drifting wreck
    this.aggroed = false;
    this.hunting = false;
    if (this.ai) this.ai.state = 'idle';
  }

  /** Shake the snare off: controls return, with a short immunity to follow. */
  recover() {
    this.disabled = false;
    this.disableTimer = 0;
    this.disruptCharge = 0;
    this.disruptImmune = DISRUPT_IMMUNITY;
    this.shieldRegenDelay = Math.max(this.shieldRegenDelay, 1.5);
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
