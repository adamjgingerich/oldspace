// NPC pilots: pirates, patrols, freighters and contract targets.
// They fly by exactly the same rules you do.

import { clamp, angleDiff, hashString } from '../core/util.js';
import { WEAPON_BY_ID } from '../data/weapons.js';

export class AIController {
  constructor(ship, { role, universe, home = { x: 0, z: 0 }, cruise = null, leader = null, slot = 0, mini = false }) {
    this.ship = ship;
    this.role = role; // 'pirate' | 'navy' | 'trader' | 'bounty' | 'house' | 'escort'
    this.universe = universe;
    this.home = home;
    this.cruise = cruise; // {x, z} for traders
    this.state = 'cruise';
    this.target = null;
    this.wp = null;
    this.fleeTimer = 0;
    this._thinkTimer = 0;
    this._wandered = false;
    // fleet wing fields
    this.leader = leader;
    this.slot = slot;
    this.mini = mini;
    this.recall = false; // minis heading home to the bays
    this.forcedTarget = null; // set by "fleet: attack my target"
    // personality: how long a pilot argues with the maths before running
    this.bravado = 0.3 + ((hashString(`${ship.name}:${role}`) % 1000) / 1000) * 0.6;
    if (role === 'navy') this.bravado = Math.min(1, this.bravado + 0.25);
    if (role === 'bounty') this.bravado = Math.min(1, this.bravado + 0.3);
    if (role === 'house') this.bravado = Math.min(1, this.bravado + 0.15);
    if (role === 'trader') this.bravado = 0.2;
    this.witnessed = null; // the hull that hurt our friends — deal with it first
    this.fleeing = false;
    this._fleeDecided = false;
    this._willFlee = false;
    this._huntTimer = 8 + ((hashString(`hunt:${ship.name}`) % 1000) / 1000) * 10;
    // gunner focus: a fresh lock starts shaky and tightens as the pilot settles
    this._focus = 0;
    this._focusTarget = null;
  }

  update(dt) {
    const ship = this.ship;
    if (!ship.alive) return;
    const u = this.universe;

    if (this.role === 'escort') {
      this.updateEscort(dt);
      return;
    }

    // a hull that has struck its colours heaves to and waits to be boarded
    if (ship.surrendered) {
      this.state = 'surrendered';
      ship.turnInput = 0;
      ship.throttleCmd = 0;
      ship.brakeCmd = ship.speed > 16 ? 0.8 : 0;
      return;
    }

    // a snared hull has no helm, no guns and nothing to say — it drifts
    if (ship.disabled) {
      this.state = 'snared';
      this.target = null;
      ship.turnInput = 0;
      ship.throttleCmd = 0;
      ship.brakeCmd = 0;
      return;
    }

    this._thinkTimer -= dt;
    if (this._thinkTimer <= 0) {
      this._thinkTimer = 0.25;
      // pirates size the captain up now and then — they need a reason to bite,
      // and the lanes only have so much violence in them at a time
      if (this.role === 'pirate' && !ship.hunting && !ship.aggroed && !u.grudgeActive(ship.faction)) {
        this._huntTimer -= 0.25;
        if (this._huntTimer <= 0) {
          this._huntTimer = 26 + Math.random() * 28;
          const p = u.player;
          if (p && p.alive && u.ambushReady()
            && Math.hypot(p.x - ship.x, p.z - ship.z) < 1900
            && Math.random() < u.pirateInterest()) {
            ship.hunting = true;
            u.noteAmbush();
          }
        }
      }
      // a friend in trouble outranks everything else
      const witness = this.witnessed && this.witnessed.alive && u.isHostile(ship, this.witnessed)
        ? this.witnessed : null;
      this.target = witness || u.findHostileTarget(ship, 2200);
    }
    if (this.target && !this.target.alive) this.target = null;

    // a new lock needs a moment to settle: gunners start wide and tighten up as
    // they focus, and taking hits scatters that focus again (flinch below)
    if (this.target !== this._focusTarget) {
      this._focusTarget = this.target;
      this._focus = 0;
    }
    const settle = Math.max(2.2, 4.4 - this.bravado * 1.8); // steady hands settle faster
    this._focus = Math.min(1, this._focus + dt / settle);
    ship.focusErr = this.target?.alive ? (1 - this._focus) * 0.06 : 0;

    const hurt = ship.hull < ship.stats.hull * (this.role === 'trader' || this.role === 'broker' ? 0.72 : 0.3);

    switch (this.role) {
      case 'trader':
        this.updateTrader(dt, hurt);
        break;
      case 'broker':
        this.updateBroker(dt, hurt);
        break;
      case 'bounty':
      case 'pirate':
      case 'navy':
      case 'house':
        this.updateWarrior(dt, hurt);
        break;
      default:
        this.updateTrader(dt, hurt);
        break;
    }
  }

  updateTrader(dt, hurt) {
    const ship = this.ship;
    if (hurt || this.state === 'flee') {
      this.state = 'flee';
      const flee = this.pickFleePoint();
      this.steerTo(flee.x, flee.z);
      ship.throttleCmd = 1;
      ship.brakeCmd = 0;
      if (Math.hypot(ship.x - flee.x, ship.z - flee.z) < 320) ship.despawn = true;
      return;
    }
    if (!this.cruise) this.cruise = this.pickFleePoint();

    // skittish traffic: freighters give an active shooting match a wide berth
    this._avoidTimer = (this._avoidTimer || 0) - dt;
    if (this._avoidTimer <= 0) {
      this._avoidTimer = 0.5;
      this._avoid = null;
      for (const other of this.universe.ships) {
        if (other === ship || !other.alive || other.despawn || other.surrendered) continue;
        if (!(other.aggroed || other.hunting || other.witnessed)) continue;
        const dd = (other.x - ship.x) ** 2 + (other.z - ship.z) ** 2;
        if (dd < 800 * 800) {
          const away = Math.atan2(ship.x - other.x, ship.z - other.z);
          this._avoid = { x: ship.x + Math.sin(away) * 900, z: ship.z + Math.cos(away) * 900 };
          break;
        }
      }
    }
    if (this._avoid) {
      this.steerTo(this._avoid.x, this._avoid.z);
      ship.throttleCmd = 1;
      ship.brakeCmd = 0;
      if (Math.hypot(ship.x - this._avoid.x, ship.z - this._avoid.z) < 400) this._avoid = null;
      return;
    }

    const d = this.steerTo(this.cruise.x, this.cruise.z);
    ship.throttleCmd = Math.abs(d) > 1.4 ? 0.45 : 1;
    ship.brakeCmd = 0;
    if (Math.hypot(ship.x - this.cruise.x, ship.z - this.cruise.z) < 140) ship.despawn = true;
  }

  /**
   * A broker works where she pleases: she comes to a stop on her own patch of
   * sky and stays there for as long as the day lasts, so a captain who has been
   * told where to look can actually find her. Provoke her and she runs like any
   * other merchant.
   */
  updateBroker(dt, hurt) {
    const ship = this.ship;
    if (hurt || this.state === 'flee') {
      this.state = 'flee';
      const flee = this.pickFleePoint();
      this.steerTo(flee.x, flee.z);
      ship.throttleCmd = 1;
      ship.brakeCmd = 0;
      if (Math.hypot(ship.x - flee.x, ship.z - flee.z) < 320) ship.despawn = true;
      return;
    }
    const home = this.home || { x: ship.x, z: ship.z };
    const ring = this.loiterRadius || 620;
    this._loiter = this._loiter || 0;
    const nextPoint = () => {
      const a = (this._loiter += 1.7) + (home.haseed || 0) * 6.28;
      return { x: home.x + Math.cos(a) * ring, z: home.z + Math.sin(a) * ring };
    };
    if (!this.cruise) this.cruise = nextPoint();
    const d = this.steerTo(this.cruise.x, this.cruise.z);
    ship.throttleCmd = Math.abs(d) > 0.9 ? 0.3 : 0.16;
    ship.brakeCmd = 0;
    if (Math.hypot(ship.x - this.cruise.x, ship.z - this.cruise.z) < ring * 0.42) this.cruise = nextPoint();
  }

  updateWarrior(dt, hurt) {
    const ship = this.ship;
    // break off when the odds stop being survivable — some pilots sooner than others
    if (!this.fleeing && this.target && this.shouldBreakOff()) this.fleeing = true;
    if (this.fleeing && !this.target) this.fleeing = false;
    const desperate = hurt && this.target && this.role !== 'navy' && this.role !== 'bounty';
    if (this.fleeing || desperate) {
      this.state = 'flee';
      const flee = this.pickFleePoint();
      this.steerTo(flee.x, flee.z);
      ship.throttleCmd = 1;
      ship.brakeCmd = 0;
      if (Math.hypot(ship.x - flee.x, ship.z - flee.z) < 340) ship.despawn = true;
      return;
    }
    this.state = this.target ? 'attack' : 'patrol';

    if (this.state === 'patrol') {
      const t = this.universe.time;
      const a = t * 0.04 + (this.home.haseed || 0) * 7;
      const px = this.home.x + Math.cos(a) * 620;
      const pz = this.home.z + Math.sin(a) * 620;
      const d = this.steerTo(px, pz);
      ship.throttleCmd = Math.abs(d) > 0.9 ? 0.5 : 0.85;
      ship.brakeCmd = 0;
      return;
    }

    // ---- attack run ----
    this.attackRun(dt, this.target, this.role === 'bounty' ? 300 : 380);
  }

  /** A pilot breaks off when the maths is hopeless — sometimes. Personality decides. */
  shouldBreakOff() {
    const ship = this.ship;
    const u = this.universe;
    const hp = ship.hull / ship.stats.hull;
    const kin = u.ships.filter((s) => s.alive && !s.isPlayer && s.faction === ship.faction
      && Math.hypot(s.x - ship.x, s.z - ship.z) < 1400).length;
    const foes = u.ships.filter((s) => s.alive && (s.isPlayer || s.role === 'escort')
      && Math.hypot(s.x - ship.x, s.z - ship.z) < 1400).length;
    const losing = hp < 0.55 - 0.3 * this.bravado
      || (hp < 0.5 && kin <= 1 && foes >= 2)
      || (hp < 0.42 && this.target?.isPlayer
        && this.target.hull > this.target.stats.hull * 0.8);
    if (!losing) return false;
    if (!this._fleeDecided) {
      this._fleeDecided = true;
      this._willFlee = Math.random() < 0.4 + 0.6 * (1 - this.bravado);
    }
    return this._willFlee;
  }

  /** Wing behaviour: ordered attack, self-defence, then formation on the leader. */
  updateEscort(dt) {
    const ship = this.ship;
    const leader = this.leader;
    const u = this.universe;

    // recalled minis run for the hangar
    if (this.recall && this.mini) {
      if (!leader || !leader.alive) {
        ship.despawn = true;
        return;
      }
      const d = Math.hypot(leader.x - ship.x, leader.z - ship.z);
      this.steerTo(leader.x, leader.z);
      ship.throttleCmd = 1;
      ship.brakeCmd = d < 280 ? 0.6 : 0;
      if (d < 140) {
        ship.despawn = true;
        ship.recovered = true;
      }
      this.state = 'recall';
      return;
    }

    // pick an enemy: the captain's order, the leader's target, or a nearby threat
    this._thinkTimer -= dt;
    if (this._thinkTimer <= 0) {
      this._thinkTimer = 0.35;
      const ordered = this.forcedTarget && this.forcedTarget.alive ? this.forcedTarget : null;
      const leaders = u.playerTarget && u.playerTarget.alive && u.isHostile(ship, u.playerTarget)
        ? u.playerTarget : null;
      if (ordered || leaders) {
        this.target = ordered || leaders;
      } else {
        const close = u.findHostileTarget(ship, 1200);
        const nearLeader = leader
          ? u.ships.find((s) => s.alive && u.isHostile(ship, s)
            && Math.hypot(s.x - leader.x, s.z - leader.z) < 900
            && Math.hypot(s.x - ship.x, s.z - ship.z) < 1800)
          : null;
        this.target = close || nearLeader || null;
      }
      if (this.target && !this.target.alive) this.target = null;
    }

    if (this.target && this.target.alive) {
      this.state = 'attack';
      this.attackRun(dt, this.target, this.mini ? 250 : 320);
      return;
    }

    // formation: hold station off the leader's quarter
    if (!leader || !leader.alive) {
      ship.throttleCmd = 0.2;
      ship.brakeCmd = 0.4;
      return;
    }
    const fx = Math.sin(leader.heading);
    const fz = Math.cos(leader.heading);
    const sx = Math.cos(leader.heading);
    const sz = -Math.sin(leader.heading);
    const side = (this.slot % 2 === 0 ? -1 : 1) * (110 + 50 * Math.floor(this.slot / 2));
    const back = 130 + 60 * Math.floor(this.slot / 2);
    const tx = leader.x - fx * back + sx * side;
    const tz = leader.z - fz * back + sz * side;
    const d = Math.hypot(tx - ship.x, tz - ship.z);
    const err = this.steerTo(tx, tz);
    if (d > 320) {
      ship.throttleCmd = 1;
      ship.brakeCmd = 0;
    } else if (d > 90) {
      ship.throttleCmd = Math.abs(err) > 1.2 ? 0.4 : 0.7;
      ship.brakeCmd = 0;
    } else {
      const rel = Math.hypot(ship.vx - leader.vx, ship.vz - leader.vz);
      ship.throttleCmd = rel < 40 ? 0.25 : 0;
      ship.brakeCmd = rel >= 40 ? 0.5 : 0;
    }
    this.state = 'formation';
  }

  /** Close in and fire every hardpoint that lines up. */
  attackRun(dt, target, holdRange = 380) {
    const ship = this.ship;
    const dist = Math.hypot(target.x - ship.x, target.z - ship.z);
    const lead = this.universe.leadPoint(ship, target, this.primarySpeed());
    const desired = Math.atan2(lead.x - ship.x, lead.z - ship.z);
    const aimErr = angleDiff(ship.heading, desired);
    ship.turnInput = clamp(aimErr * 2.6, -1, 1);

    if (dist > holdRange + 160) {
      ship.throttleCmd = 1;
      ship.brakeCmd = 0;
    } else if (dist < holdRange - 120) {
      ship.throttleCmd = 0.25;
      ship.brakeCmd = 0.8;
    } else {
      ship.throttleCmd = 0.55;
      ship.brakeCmd = 0;
    }

    // fire when the shot lines up
    for (let s = 0; s < ship.weapons.length; s++) {
      const w = WEAPON_BY_ID[ship.weapons[s]];
      if (!w) continue;
      if (w.kind === 'missile') {
        if (dist > 420 && dist < w.range * 0.9 && Math.abs(aimErr) < 0.5 && ship.energy > w.energy * 2.5) {
          this.universe.fireShip(ship, s, target);
        }
      } else if (dist < w.range * 0.9 && Math.abs(aimErr) < 0.24 && ship.energy > w.energy * 2.5) {
        this.universe.fireShip(ship, s, target);
      }
    }

    // occasionally jink so fights are not jousts
    if (Math.sin(this.universe.time * 0.7 + (this.home.haseed || 0)) > 0.96) {
      ship.turnInput = clamp(ship.turnInput + 0.7, -1, 1);
    }
  }

  primarySpeed() {
    const w = WEAPON_BY_ID[this.ship.weapons[0]];
    return w ? w.speed : 900;
  }

  steerTo(tx, tz) {
    const ship = this.ship;
    const desired = Math.atan2(tx - ship.x, tz - ship.z);
    const d = angleDiff(ship.heading, desired);
    ship.turnInput = clamp(d * 2.4, -1, 1);
    return d;
  }

  /** Taking hits rattles the aim — the lock goes wide for a few seconds. */
  flinch() {
    this._focus = Math.min(this._focus, 0.3);
  }

  pickFleePoint() {
    // run for open space: away from the player (or anywhere sober) out to the rim
    const p = this.universe.player;
    const ship = this.ship;
    const a = p?.alive
      ? Math.atan2(ship.x - p.x, ship.z - p.z) + (Math.random() - 0.5) * 0.9
      : Math.random() * Math.PI * 2;
    const r = 2300 + Math.random() * 800;
    return { x: Math.cos(a) * r, z: Math.sin(a) * r };
  }
}
