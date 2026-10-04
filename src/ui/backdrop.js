// The title screen's living backdrop: a small parade of ships on the lanes.
// It doubles as a showcase for the ship models — slow yaw, engine glow, rim light.

import * as THREE from 'three';
import { buildStarfield, buildNebula } from '../core/starfield.js';
import { buildShip, buildStation, buildPlanet } from '../core/meshes.js';
import { glowSprite } from '../core/fx.js';
import { applyEnvironment } from '../core/materials.js';
import { SHIP_BY_ID } from '../data/ships.js';
import { FACTIONS } from '../data/factions.js';

const UP = new THREE.Vector3(0, 1, 0);

export class Backdrop {
  constructor(engine) {
    this.engine = engine;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x091120);
    this.scene.fog = new THREE.Fog(0x091120, 2600, 9800);

    this.camera = new THREE.PerspectiveCamera(46, engine.width / engine.height, 1, 40000);
    this.camera.position.set(0, 430, 430);
    this.camera.lookAt(0, 0, -120);

    // --- lighting: top-down key + cool rim + fill ---
    this.scene.add(new THREE.HemisphereLight(0x9cc4ff, 0x0a0e16, 0.9));
    const key = new THREE.DirectionalLight(0xfff2d8, 1.85);
    key.position.set(400, 1600, 700);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x6fb6ff, 0.8);
    rim.position.set(700, 600, -1100);
    this.scene.add(rim);

    this.scene.add(buildStarfield({ count: 3400, radius: 14000 }));
    this.scene.add(buildNebula(0x2c5480, 0x3c2a52));
    applyEnvironment(this.scene, this.engine.renderer);

    // --- distant scenery: star, planet, station ---
    const star = glowSprite(0xffd9a0, 3200);
    star.material.opacity = 0.5;
    star.position.set(-2600, -600, -5200);
    this.scene.add(star);
    const starCore = glowSprite(0xffffff, 900);
    starCore.material.opacity = 0.9;
    starCore.position.copy(star.position);
    this.scene.add(starCore);

    const planet = buildPlanet({
      name: 'Haven Prime', radius: 320, color: 0x4f7fa8, type: 'ocean',
    }, { limb: false });
    planet.position.set(-1450, -520, -2200);
    this.scene.add(planet);

    const station = buildStation({
      id: 'backdrop', name: 'Anchorage', type: 'haven', owner: 'free', services: [],
    });
    station.position.set(1500, 60, -2600);
    station.scale.setScalar(1.6);
    this.scene.add(station);

    // --- the parade (orbits sit in front of the camera) ---
    this.ships = [];
    const addShip = (shipId, faction, scale, radius, speed, phase, height, cx, cz) => {
      const def = SHIP_BY_ID[shipId];
      const { group, api } = buildShip(def, { accent: new THREE.Color(FACTIONS[faction].color).getHex() });
      group.scale.setScalar(scale);
      api.setThrottle(0.55);
      this.scene.add(group);
      this.ships.push({ group, api, radius, speed, phase, height, cx, cz });
    };
    addShip('wayfarer', 'free', 3.2, 170, 0.12, 0.4, 30, -430, -300);
    addShip('sparrowhawk', 'vigil', 2.8, 180, -0.13, 1.8, -10, 420, -300);
    addShip('corsair', 'reaver', 2.3, 230, 0.09, 3.1, 60, -60, -520);
    addShip('halcyon', 'combine', 2.1, 190, -0.08, 5.2, 20, 470, -680);
    addShip('stormgalleon', 'combine', 1.8, 300, 0.06, 4.2, 80, -40, -620);
    addShip('vagrant', 'free', 2.6, 210, 0.1, 2.3, 45, -180, -430);

    this.time = 0;
    // now and then one of the parade breaks off, comes over for a look at the
    // pilot, then remembers itself and hurries back onto its lane
    this.flyby = null;
    this.nextFlybyAt = 4 + Math.random() * 6;
    this._pose = { pos: new THREE.Vector3(), yaw: 0, roll: 0 };
    this._v1 = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._s = {
      m: new THREE.Matrix4(),
      qa: new THREE.Quaternion(),
      qb: new THREE.Quaternion(),
      flip: new THREE.Quaternion(0, 1, 0, 0), // 180° about Y: -Z over to +Z
      e: new THREE.Euler(),
    };

    engine.onResize((w, h) => {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    });
  }

  update(dt) {
    this.time += dt;

    if (!this.flyby && this.time >= this.nextFlybyAt) this._startFlyby();
    for (const s of this.ships) this._updateShip(s, dt);

    // gentle camera drift keeps the composition alive
    this.camera.position.x = Math.sin(this.time * 0.07) * 70;
    this.camera.position.y = 430 + Math.cos(this.time * 0.05) * 26;
    this.camera.position.z = 430 + Math.sin(this.time * 0.04) * 46;
    this.camera.lookAt(0, 0, -120);
  }

  /** Where a ship would sit if it had never left its lane. */
  _orbitPose(s) {
    const t = this.time * s.speed + s.phase;
    this._pose.pos.set(
      s.cx + Math.cos(t) * s.radius,
      s.height + Math.sin(this.time * 0.4 + s.phase) * 4,
      s.cz + Math.sin(t) * s.radius * 0.7,
    );
    this._pose.yaw = Math.atan2(-Math.sin(t) * s.radius * s.speed, Math.cos(t) * s.radius * 0.7 * s.speed);
    this._pose.roll = Math.sin(this.time * 0.5 + s.phase) * 0.06;
    return this._pose;
  }

  /**
   * A quaternion that points the hull's nose (+Z) straight at the pilot, pitch
   * and all — not merely its bearing, so it genuinely looks at you.
   */
  _aimQuat(group, out) {
    this._s.m.lookAt(group.position, this.camera.position, UP);
    out.setFromRotationMatrix(this._s.m);
    // lookAt aims -Z at the target and the nose is +Z, so spin it about
    return out.multiply(this._s.flip);
  }

  /** The lane's own orientation, so a ship can be blended back onto it. */
  _orbitQuat(pose, out) {
    this._s.e.set(0, pose.yaw, pose.roll);
    return out.setFromEuler(this._s.e);
  }

  _updateShip(s, dt) {
    const orbit = this._orbitPose(s);
    if (!s.flyby) {
      s.group.position.copy(orbit.pos);
      s.group.rotation.set(0, orbit.yaw, orbit.roll);
      s.api.pulse(this.time);
      return;
    }

    const f = s.flyby;
    f.t += dt;

    if (f.state === 'approach') {
      const k = Math.min(1, f.t / 1.7);
      const e = 1 - Math.pow(1 - k, 3);
      // arrives a touch hot then settles back: a late brake
      s.group.position.lerpVectors(f.from, f.stage, Math.min(1.04, e + Math.sin(k * Math.PI) * 0.16 * k));
      s.group.quaternion.slerpQuaternions(f.startQuat, this._aimQuat(s.group, this._s.qa), e);
      s.group.rotateZ(Math.sin(f.t * 7) * 0.05 * (1 - k));
      s.api.setThrottle(0.8 * (1 - k) + 0.12);
      s.api.pulse(this.time);
      if (k >= 1) { f.state = 'stare'; f.t = 0; s.api.setThrottle(0.05); }
      return;
    }

    if (f.state === 'stare') {
      s.group.position.copy(f.stage);
      s.group.position.y += Math.sin(f.t * 3.2) * 4; // idling bob
      // keeps its nose on the pilot, tilting its head either way — the look a
      // dog gives something it does not trust
      this._aimQuat(s.group, s.group.quaternion);
      s.group.rotateY(Math.sin(f.t * 1.6) * 0.09);
      s.group.rotateZ(Math.sin(f.t * 2.4) * 0.17);
      s.api.pulse(f.blink ? this.time * 3.4 : this.time); // half of them blink
      s.api.setThrottle(0.05);
      if (f.t >= f.hold) {
        f.state = 'leave';
        f.t = 0;
        f.leaveFrom = s.group.position.clone();
        f.leaveQuat = s.group.quaternion.clone();
        s.api.setThrottle(1);
      }
      return;
    }

    // leave: turn back onto the lane and get out of it, a little too quickly
    const k = Math.min(1, f.t / 1.3);
    const e = k * k * (3 - 2 * k);
    s.group.position.lerpVectors(f.leaveFrom, orbit.pos, e);
    s.group.quaternion.slerpQuaternions(f.leaveQuat, this._orbitQuat(orbit, this._s.qb), e);
    s.group.rotateZ(Math.sin(f.t * 6) * 0.07 * (1 - e));
    s.api.setThrottle(1 - e * 0.4);
    s.api.pulse(this.time);
    if (k >= 1) {
      s.flyby = null;
      this.flyby = null;
      this._scheduleNextFlyby();
    }
  }

  /**
   * Send one ship over for a look. It comes in close — held off to one side so
   * the menu still reads — stares at the pilot for an uncomfortably long beat,
   * then remembers itself and hurries back onto its lane.
   */
  _startFlyby() {
    const free = this.ships.filter((s) => !s.flyby);
    if (!free.length) {
      this._scheduleNextFlyby();
      return;
    }
    const s = free[(Math.random() * free.length) | 0];
    const cam = this.camera;
    cam.getWorldDirection(this._v1);
    this._v2.crossVectors(this._v1, UP).normalize(); // the camera's right
    const sideSign = Math.random() < 0.5 ? -1 : 1;
    const dist = 350 + Math.random() * 80;
    // hold it off-centre by a fraction of what is actually visible, so it lands
    // beside the menu on any window shape rather than half off the edge
    const halfH = Math.tan((cam.fov * Math.PI) / 360) * dist;
    const halfW = halfH * cam.aspect;
    const stage = cam.position.clone()
      .addScaledVector(this._v1, dist)
      .addScaledVector(this._v2, halfW * (0.48 + Math.random() * 0.18) * sideSign);
    stage.y += 20 + Math.random() * 45;

    s.flyby = {
      state: 'approach',
      t: 0,
      from: s.group.position.clone(),
      stage,
      startQuat: s.group.quaternion.clone(),
      hold: 1.3 + Math.random() * 1.3,
      leaveFrom: null,
      leaveQuat: null,
      blink: Math.random() < 0.5,
    };
    this.flyby = s;
    s.api.setThrottle(0.8);
  }

  _scheduleNextFlyby() {
    // a good long gap between visits: a treat, not a parade of gawkers
    this.nextFlybyAt = this.time + 9 + Math.random() * 15;
  }

  render() {
    this.engine.render(this.scene, this.camera);
  }
}
