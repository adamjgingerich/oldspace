// The title screen's living backdrop: a small parade of ships on the lanes.
// It doubles as a showcase for the ship models — slow yaw, engine glow, rim light.

import * as THREE from 'three';
import { buildStarfield, buildNebula } from '../core/starfield.js';
import { buildShip, buildStation, buildPlanet } from '../core/meshes.js';
import { glowSprite } from '../core/fx.js';
import { SHIP_BY_ID } from '../data/ships.js';
import { FACTIONS } from '../data/factions.js';

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
    engine.onResize((w, h) => {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    });
  }

  update(dt) {
    this.time += dt;

    for (const s of this.ships) {
      const t = this.time * s.speed + s.phase;
      const x = s.cx + Math.cos(t) * s.radius;
      const z = s.cz + Math.sin(t) * s.radius * 0.7;
      s.group.position.set(x, s.height + Math.sin(this.time * 0.4 + s.phase) * 4, z);
      const vx = -Math.sin(t) * s.radius * s.speed;
      const vz = Math.cos(t) * s.radius * 0.7 * s.speed;
      s.group.rotation.y = Math.atan2(vx, vz);
      s.group.rotation.z = Math.sin(this.time * 0.5 + s.phase) * 0.06;
      s.api.pulse(this.time);
    }

    // gentle camera drift keeps the composition alive
    this.camera.position.x = Math.sin(this.time * 0.07) * 70;
    this.camera.position.y = 430 + Math.cos(this.time * 0.05) * 26;
    this.camera.position.z = 430 + Math.sin(this.time * 0.04) * 46;
    this.camera.lookAt(0, 0, -120);
  }

  render() {
    this.engine.render(this.scene, this.camera);
  }
}
