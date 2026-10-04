// A live star system: visuals, traffic, warp fields, loot and prompts.

import * as THREE from 'three';
import {
  SYSTEMS,
} from '../data/systems.js';
import {
  buildStar, buildStarLight, buildStation, buildPlanet, buildAsteroidField,
  buildBeacon, buildPod, buildWreck, buildWormhole,
} from '../core/meshes.js';
import { buildStarfield, buildNebula, buildFarGalaxies, buildGasClouds, buildDustPatches, buildComet, buildDebrisField } from '../core/starfield.js';
import { applyEnvironment } from '../core/materials.js';
import { Fx } from '../core/fx.js';
import { emblemSprite } from '../core/emblem.js';
import { WarpFx } from '../core/warpfx.js';
import { makeTopDownCamera } from '../core/engine.js';
import { Combat, leadPoint } from './combat.js';
import { AIController } from './ai.js';
import { Ship } from './ship.js';
import { rngOf } from '../core/rng.js';
import { audio } from '../core/audio.js';
import { clamp, damp, dist2, distSq2, hashString, TAU, wrapAngle } from '../core/util.js';
import { SHIP_BY_ID } from '../data/ships.js';
import { HOUSE_NAMES, PIRATE_FIRST, PIRATE_EPITHET } from '../data/names.js';
import { computeStats, HOSTILE_REP } from './state.js';
import { addXp, addKarma, economyMods, levelFromXp, wingMods } from './skills.js';
import { fleetLoadout, nextFreeBay, removeFromFleet } from './fleet.js';
import { holeInSystem, holePos, isDiscovered } from './wormholes.js';
import { trafficFactor } from './traffic.js';

/** Character progress earned per kill, by the victim's role. */
const XP_BY_ROLE = { pirate: 30, bounty: 30, navy: 28, trader: 22, house: 28, transit: 80 };
const KARMA_BY_ROLE = { pirate: 3, bounty: 4, navy: -12, trader: -10, house: -6, transit: 0 };

/**
 * Taking a hull whole is not the same as breaking it. Blowing a patrol out of
 * the sky is butchery; snaring it, boarding it and putting the crew off at the
 * next berth is business. Captures pay a fraction of the karma and reputation
 * cost of a kill — and a spared crew is worth a little goodwill with their flag.
 */
const CAPTURE_KARMA = { pirate: 2, bounty: 3, navy: -2, trader: -2, house: -1, transit: 1 };
const CAPTURE_REP = {
  pirate: { vigil: 1, combine: 1, reaver: -1 },
  trader: { reaver: 1, combine: -1, free: -1 },
  navy: { vigil: -2, combine: -1, reaver: 1 },
  house: { kreth: -2 },
  transit: { vigil: -2 },
};
/** Goodwill for putting a beaten crew ashore instead of leaving them to die. */
const MERCY_KARMA = 1;
const MERCY_REP = 3;

/** Global dampener on unprovoked attacks — one knob for every system's temper. */
const AMBIENT_ATTACK_TRIM = 0.42;

/*
 * Cooling off. A raider that has taken against the captain holds that decision
 * only while it keeps the captain in reach: break contact past AGGRO_BREAK and
 * hold it for AGGRO_COOL and the pilot goes back to its own business. Nothing
 * here touches what a flag *remembers* — a grudge still runs for days — but a
 * lane the captain has run through once is not a lane that shoots at them for
 * the rest of their life.
 */
const AGGRO_BREAK = 2600;  // units — further out than a gun, a hail or a lock reaches
const AGGRO_COOL = 18;     // seconds of clear air before a hull stands down
/** The lanes only hold so much violence at a time: one unprovoked ambush per gap. */
const AMBUSH_GAP = 60;
/** The cooling-off figures, for the audit to hold the lanes to. */
export const AGGRO_SPEC = { breakOff: AGGRO_BREAK, cool: AGGRO_COOL, ambushGap: AMBUSH_GAP };

/** View zoom bounds: zoomTarget 1 is the normal helm view. */
const ZOOM_MIN = 0.32;
const ZOOM_MAX = 5.6;

/*
 * Warp field dampeners: every star, world, moon and station sings a field that
 * stalls jump coils. Ranges scale with the size and strength of the source —
 * a gas giant drowns a bigger radius than a moon — and each instance carries a
 * small deterministic variation so no two wells are identical.
 */
const DAMPEN_TYPE_MUL = { gas: 1.25, terran: 1.05, rocky: 0.95, ice: 0.85, moon: 0.6 };
const STATION_DAMPEN_BASE = { haven: 920, port: 760, depot: 610, spacedock: 870 };

/** ±6% per-instance variation, seeded from the source's own name. */
function dampenVar(key) {
  return 0.94 + ((hashString(`dampen:${key}`) % 1000) / 1000) * 0.12;
}

function starDampenerRadius(sys) {
  return (260 + sys.star.size * 8.2) * dampenVar(`${sys.id}:star`);
}

function planetDampenerRadius(sys, p) {
  const mul = DAMPEN_TYPE_MUL[p.type] || 1;
  return (500 + p.radius * 2.4 * mul) * dampenVar(`${sys.id}:${p.name}`);
}

function stationDampenerRadius(sys, st) {
  const base = STATION_DAMPEN_BASE[st.type] || 700;
  return base * dampenVar(`${sys.id}:${st.id}`);
}

/**
 * Where a station sits in a system. Spacedocks ride in orbit over the world
 * named by their `parent` field, nudged off the planet's own bearing so they
 * never sit inside its dampener well or visual disc. Everything else orbits
 * on its own recorded bearing.
 */
function stationPos(sys, st) {
  if (st.parent) {
    const pl = (sys.planets || []).find((p) => p.name === st.parent);
    if (pl) {
      const a = pl.angle + 0.16;
      const d = pl.dist + 150;
      return { x: Math.cos(a) * d, z: Math.sin(a) * d };
    }
  }
  return { x: Math.cos(st.angle) * st.dist, z: Math.sin(st.angle) * st.dist };
}

/** Every dampener field in a system: the star, its worlds and moons, and stations. */
function systemDampeners(sys) {
  const list = [{ x: 0, z: 0, r: starDampenerRadius(sys), label: `${sys.name} star` }];
  for (const p of sys.planets) {
    list.push({
      x: Math.cos(p.angle) * p.dist,
      z: Math.sin(p.angle) * p.dist,
      r: planetDampenerRadius(sys, p),
      label: p.type === 'moon' ? `${p.name} (moon)` : p.name,
    });
  }
  for (const st of sys.stations) {
    const sp = stationPos(sys, st);
    list.push({
      x: sp.x,
      z: sp.z,
      r: stationDampenerRadius(sys, st),
      label: st.name,
    });
  }
  return list;
}

/** Push a point out of every field it sits inside (a few relaxation passes). */
function pushClear(list, x, z, tries = 10) {
  for (let i = 0; i < tries; i++) {
    let moved = false;
    for (const d of list) {
      const dx = x - d.x;
      const dz = z - d.z;
      const dist = Math.hypot(dx, dz);
      if (dist < d.r) {
        const k = dist < 1e-3 ? 1 : dist;
        x = d.x + (dx / k) * (d.r + 8);
        z = d.z + (dz / k) * (d.r + 8);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return { x, z };
}

/** Soft radial dot used by the warp plotter guide line. */
let _warpDotTex = null;
function warpDotTexture() {
  if (_warpDotTex) return _warpDotTex;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.45, 'rgba(190,225,255,0.75)');
  grd.addColorStop(1, 'rgba(190,225,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  _warpDotTex = new THREE.CanvasTexture(c);
  return _warpDotTex;
}

const WARP_DOTS = 72;

/**
 * Blended menace score for world difficulty: character level plus learned
 * skills plus wealth in the bank. The challenge grows with the pilot's
 * abilities, interests and purse — not just their kill count.
 */
function threatLevel(state) {
  const lvl = levelFromXp(state.xp || 0);
  const wealth = Math.min(6, Math.floor((state.credits || 0) / 75000));
  let ranks = 0;
  for (const r of Object.values(state.skills || {})) ranks += r;
  const skill = Math.min(5, Math.floor(ranks / 4));
  return lvl + wealth + skill;
}

function disposeScene(scene) {
  scene.traverse((o) => {
    o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) m.dispose?.();
  });
}

export class Universe {
  constructor(engine, state) {
    this.engine = engine;
    this.state = state;
    this.scene = new THREE.Scene();
    this.camera = makeTopDownCamera(engine.width / engine.height);
    this.fx = new Fx(this.scene);
    this.combat = new Combat({ scene: this.scene, fx: this.fx, audio, universe: this });
    this.warpFx = new WarpFx(this.scene);
    this._warping = false;
    this._warpBaseFov = this.camera.fov;

    this.systemId = null;
    this.system = null;
    this.ships = [];
    this.player = null;
    this.stations = [];
    this.planets = [];
    this.asteroids = [];
    this.pods = [];
    this.beacons = [];
    this.visuals = [];
    this.scanTimers = {};
    this.time = 0;
    this.shake = 0;
    this.spawnTimer = 2;
    this.missionRefreshT = 0;
    this._capitalCd = 0; // cooldown between capital transits (see _maybeCapitalTransit)
    this._ambushReadyAt = 0; // when the lanes may spring another unprovoked attack
    this._hailTimer = 0; // radio chatter pacing
    this._sightTimer = 0;
    this._pick = new THREE.Vector3(); // scratch vector for click-to-select
    this.nearStation = null;
    this.nearWormhole = null;
    this.nearStar = null;
    this.wormholes = [];
    this.courier = null; // a lumen courier folding in, en route or handing over
    this.dampeners = []; // warp-blocking fields: star, worlds, moons, stations
    this.warpBlock = null; // nearest clear point when the coils are dampened
    this.warpGuide = null; // dotted exit vector (Warp Field Plotter owners)
    this._warpT = 0;
    this.playerTarget = null; // exported each frame so the wing can focus fire
    this.onEvent = null; // (type, payload) => void — wired by game.js
    this.zoomLevel = 1;
    this.zoomTarget = 1;

    engine.onResize((w, h) => {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    });
  }

  /* ------------------------------------------------------------------ */
  /* System construction                                                 */
  /* ------------------------------------------------------------------ */

  load(systemId, { entry = null, playerHeading = null } = {}) {
    const oldScene = this.scene;
    disposeScene(oldScene);

    const sys = SYSTEMS[systemId];
    if (!sys) throw new Error(`Unknown system ${systemId}`);
    this.systemId = systemId;
    this.system = sys;
    // free-fire ground: no flag polices it, and nothing done here is written down
    this.freefire = !!sys.freefire;
    if (this.state?.visited) this.state.visited[systemId] = true; // the fog lifts where you fly
    this.ships = [];
    this.stations = [];
    this.planets = [];
    this.asteroids = [];
    this.pods = [];
    this.beacons = [];
    this.visuals = [];
    this.scanTimers = {};
    this.time = 0;
    this.nearStation = null;
    this.nearWormhole = null;
    this.nearStar = null;
    this.wormholes = [];
    this.courier = null;
    this.dampeners = [];
    this.warpBlock = null;
    this.warpGuide = null;

    // --- fresh scene per system. The deep-space wash is lifted a step in
    // display space (so the bump is even across systems) and the fog pushed
    // farther out — most systems read clear and bright rather than murky ---
    this.scene = new THREE.Scene();
    const step = 15;
    const raw = sys.theme.bg;
    const liftedHex =
      (Math.min(255, ((raw >> 16) & 255) + step) << 16)
      | (Math.min(255, ((raw >> 8) & 255) + step) << 8)
      | Math.min(255, (raw & 255) + step);
    const bgColor = new THREE.Color(liftedHex);
    this.scene.background = bgColor;
    this.scene.fog = new THREE.Fog(bgColor, 3200, 7800);
    this.fx = new Fx(this.scene);
    this.combat = new Combat({ scene: this.scene, fx: this.fx, audio, universe: this });
    this.warpFx = new WarpFx(this.scene);
    this._warping = false;
    this._warpBaseFov = this.camera.fov;

    this.scene.add(buildStarfield({ count: 2400, radius: 9500 }));
    this.scene.add(buildNebula(sys.theme.nebula[0], sys.theme.nebula[1]));
    // seeded scenery: far galaxies, gas clouds, dust shoals, comets, old debris
    const decor = rngOf(this.state.worldSeed, 'decor', systemId);
    const setpieces = [buildFarGalaxies(decor), buildGasClouds(decor, sys.theme.nebula), buildDustPatches(decor)];
    for (let i = 0, n = Math.floor(decor.float(0, 3)); i < n; i++) setpieces.push(buildComet(decor));
    for (let i = 0, n = 1 + Math.floor(decor.float(0, 3)); i < n; i++) setpieces.push(buildDebrisField(decor));
    for (const piece of setpieces) {
      this.scene.add(piece);
      this.visuals.push(piece);
    }
    const star = buildStar(sys.star);
    star.position.y = -(sys.star.size + 10); // stars never occlude ships
    this.scene.add(star);
    this.visuals.push(star);
    this.scene.add(new THREE.HemisphereLight(sys.star.color, 0x243748, 1.05));
    this.scene.add(buildStarLight(sys.star, 1.5));

    // --- a three-point rig so hulls read clean and bright, not flat --------
    // key: the star, from above and one side — this is what shapes a hull
    const key = new THREE.DirectionalLight(0xfff4e0, 1.55);
    key.position.set(0.55, 1, 0.35).multiplyScalar(600);
    this.scene.add(key);
    // fill: cool, opposite the key, lifts the shadowed flank out of black
    const fill = new THREE.DirectionalLight(0x7fc4ff, 0.62);
    fill.position.set(-0.6, 0.5, -0.45).multiplyScalar(600);
    this.scene.add(fill);
    // rim: from behind and below, traces the silhouette edge
    const rim = new THREE.DirectionalLight(0xbfe8ff, 0.5);
    rim.position.set(-0.25, -0.6, -0.9).multiplyScalar(600);
    this.scene.add(rim);
    // the shared environment gives every metal something to reflect
    applyEnvironment(this.scene, this.engine.renderer);

    // --- planets (sunk below the flight plane so ships always pass overhead) ---
    for (const p of sys.planets) {
      const group = buildPlanet(p);
      group.position.set(
        Math.cos(p.angle) * p.dist,
        -(p.radius * 1.04 + 6),
        Math.sin(p.angle) * p.dist,
      );
      // the governing flag's sigil, hung over the world
      const sigil = emblemSprite(sys.gov, p.radius * 0.9);
      if (sigil) {
        sigil.position.set(0, p.radius * 1.5, 0);
        sigil.renderOrder = 6;
        group.add(sigil);
      }
      this.scene.add(group);
      this.visuals.push(group);
      this.planets.push({ record: p, group, x: group.position.x, z: group.position.z });
    }

    // --- stations ---
    for (const st of sys.stations) {
      const group = buildStation(st);
      const sp = stationPos(sys, st);
      group.position.set(sp.x, 0, sp.z);
      this.scene.add(group);
      this.visuals.push(group);
      this.stations.push({
        record: st,
        group,
        x: group.position.x,
        z: group.position.z,
        radius: (st.type === 'spacedock' ? 120 : 90) * (group.userData.radiusScale || 1),
      });
    }

    // --- wormholes: a mouth may anchor here — seen in the sky, silent on the
    // scope until the captain flies close enough for the read to resolve ---
    const hole = holeInSystem(this.state, systemId);
    if (hole) {
      const group = buildWormhole();
      const hp = holePos(hole, systemId);
      group.position.set(hp.x, 0, hp.z);
      this.scene.add(group);
      this.visuals.push(group);
      this.wormholes.push({
        record: hole,
        group,
        x: hp.x,
        z: hp.z,
        radius: 150,
        discovered: isDiscovered(this.state, hole.id),
      });
    }

    // --- warp field dampeners: the star, its worlds, and stations block jumps ---
    this.dampeners = systemDampeners(sys);

    // --- asteroids + wrecks ---
    if (sys.asteroids) {
      const rng = rngOf(this.state.worldSeed, 'rocks', systemId);
      const { group, list } = buildAsteroidField(sys.asteroids, rng);
      this.scene.add(group);
      this.visuals.push(group);
      this.asteroids = list;
      for (let i = 0; i < 2; i++) {
        const wreck = buildWreck(rng);
        const wa = rng.float(0, TAU);
        const wd = sys.asteroids.dist + rng.float(-sys.asteroids.spread, sys.asteroids.spread);
        wreck.position.set(Math.cos(wa) * wd, rng.float(-20, 20), Math.sin(wa) * wd);
        this.scene.add(wreck);
        this.visuals.push(wreck);
      }
    }

    // --- player ---
    const def = SHIP_BY_ID[this.state.shipId] || SHIP_BY_ID.wayfarer;
    let startX = entry ? entry.x : this.state.pos.x;
    let startZ = entry ? entry.z : this.state.pos.z;
    if (entry) {
      // never drop out of warp inside a dampener field
      const c = pushClear(this.dampeners, startX, startZ);
      startX = c.x;
      startZ = c.z;
    }
    const heading = playerHeading ?? (entry ? Math.atan2(-startX, -startZ) : this.state.heading);
    this.player = new Ship({
      def,
      stats: computeStats(this.state),
      scene: this.scene,
      x: startX,
      z: startZ,
      heading,
      faction: 'free',
      isPlayer: true,
      name: this.state.shipName,
      role: 'player',
      loadout: {
        weapons: this.state.weapons,
        outfits: this.state.outfits,
        mountCap: computeStats(this.state).mounts,
        showEmpty: true,
      },
    });
    this.player.weapons = this.state.weapons;
    this.player.ammo = this.state.ammo;
    if (this.state.integrity && this.state.integrity.hull != null) {
      this.player.hull = clamp(this.state.integrity.hull, 1, this.player.stats.hull);
    }
    if (this.state.integrity && this.state.integrity.shield != null) {
      this.player.shield = clamp(this.state.integrity.shield, 0, this.player.stats.shield);
    }
    this.ships.push(this.player);

    // --- your fleet falls in around you ---
    this.playerTarget = null;
    this._spawnFleet();

    // --- initial traffic ---
    this.spawnTimer = 0.5;
    this.missionRefreshT = 12;
    this._manageSpawns(true);
    this._spawnMissionObjects(true);

    // seed the dampener state immediately so prompts/hints are right on frame one
    this.warpBlock = this.warpClearance();
    this._syncWarpGuide();

    this.updateCamera(1, true);
    return this;
  }

  /* ------------------------------------------------------------------ */
  /* View zoom                                                          */
  /* ------------------------------------------------------------------ */

  /** +delta zooms out, -delta zooms in. Smoothed in updateCamera. */
  applyZoomDelta(delta) {
    const d = clamp(delta, -0.9, 0.9);
    let eff = d;
    if (d > 0) {
      // zooming out eases off toward the far limit, so the wide view is easy to trim
      const t = clamp((this.zoomTarget - 1) / (ZOOM_MAX - 1), 0, 1);
      eff = d * (1 - 0.72 * t * t);
    }
    this.zoomTarget = clamp(this.zoomTarget * Math.exp(eff * 0.42), ZOOM_MIN, ZOOM_MAX);
  }

  /* ------------------------------------------------------------------ */
  /* Loot helpers                                                       */
  /* ------------------------------------------------------------------ */

  /** Spawn a salvage pod in orbit around a planet. */
  spawnPodNear(planet, kind = 'credits') {
    const rng = rngOf(this.state.worldSeed, 'cache', planet.record.name, this.state.day);
    const a = rng.float(0, TAU);
    const d = planet.record.radius + rng.float(110, 240);
    const item = {
      kind,
      x: planet.x + Math.cos(a) * d,
      z: planet.z + Math.sin(a) * d,
      vx: Math.cos(a) * 12,
      vz: Math.sin(a) * 12,
      life: 120,
      amount: 0,
      commodityId: null,
    };
    if (kind === 'credits') {
      item.amount = rng.int(220, 900);
      item.mesh = buildPod(0xffc060);
    } else {
      const pool = ['ore', 'grain', 'textiles', 'machinery', 'ice', 'medicine'];
      item.commodityId = rng.pick(pool);
      item.amount = rng.int(2, 6);
      item.mesh = buildPod(0x8fd8ff);
    }
    item.mesh.position.set(item.x, 0, item.z);
    this.scene.add(item.mesh);
    this.pods.push(item);
    return item;
  }

  /* ------------------------------------------------------------------ */
  /* Traffic                                                            */
  /* ------------------------------------------------------------------ */

  _roleVisible(ship) {
    return dist2(ship.x, ship.z, this.player.x, this.player.z) < 4200;
  }

  _manageSpawns(initial = false) {
    const cfg = this.system.danger;
    // --- free-fire systems -------------------------------------------------
    // No patrols and no paperwork: just more hulls than the lanes would
    // normally carry, all of them fair game for each other.
    if (this.freefire) {
      let raiders = 0;
      for (const s of this.ships) {
        if (s.isPlayer || s.despawn || s.role === 'escort') continue;
        if (s.role === 'pirate' || s.role === 'bounty') raiders++;
      }
      const want = clamp(3 + Math.round(threatLevel(this.state) / 3), 3, 9);
      if (raiders < want) {
        this._spawnPirate(rngOf(this.state.worldSeed, 'freefire', this.systemId, Math.floor(this.time)));
      }
      return;
    }
    let pirates = 0;
    let navy = 0;
    let traders = 0;
    let houses = 0;
    for (const s of this.ships) {
      if (s.isPlayer || s.despawn) continue;
      if (s.role === 'pirate') pirates++;
      else if (s.role === 'navy') navy++;
      else if (s.role === 'trader') traders++;
      else if (s.role === 'house') houses++;
    }
    const rng = rngOf(this.state.worldSeed, 'spawn', this.systemId, Math.floor(this.time));

    // active sweeps stir up their quarry so a contract can be finished
    const sweeps = this.state.missions.filter((m) => m.type === 'sweep' && m.kills
      && m.dest.systemId === this.systemId && m.kills.got < m.kills.need);
    const huntPirates = sweeps.some((m) => (m.foe || 'pirate') === 'pirate');
    const huntNavy = sweeps.some((m) => m.foe === 'navy');
    // raider pressure ramps with the commander's renown — green pilots meet few raiders,
    // but a famous captain is hunted everywhere
    const threat = threatLevel(this.state);
    const heat = threat <= 4 ? 0.25 : threat <= 7 ? 0.45 : threat <= 12 ? 0.7
      : threat <= 18 ? 1 : threat <= 24 ? 1.35 : threat <= 32 ? 1.7 : threat <= 42 ? 2.1 : 2.6;
    let pirateTarget = Math.round((initial ? cfg.pirates * 5 : 1 + cfg.pirates * 6) * heat);
    // safe lanes can be truly quiet for a brand-new pilot; once you're known, nowhere is
    if (!initial && threat > 4) pirateTarget = Math.max(1, pirateTarget);
    let navyTarget = Math.round(cfg.navy * 5);
    if (huntPirates) pirateTarget += threat <= 7 ? 1 : threat <= 15 ? 2 : 3;
    // a contract the clans are watching stirs the whole lane up
    if (this.state.missions.some((m) => m.twist?.kind === 'watched' && m.dest?.systemId === this.systemId)) pirateTarget += 2;
    // the captain's own charters keep their lanes quieter — patrol cutters pay in deterrence
    const hold = this.state.holdings?.[this.systemId];
    if (hold) pirateTarget = Math.round(pirateTarget * Math.max(0.3, 1 - 0.15 * (hold.units?.patrol || 0)));
    if (huntNavy) navyTarget += 2;
    // traffic is a system's character, not a fresh dice roll every visit:
    // hubs teem with shipping, backwaters stay quiet, and a strange system may
    // invert the odds — a nothing rock piled with hulls, a hub turned silent
    const traffic = trafficFactor(this.state, this.systemId);
    const traderTarget = Math.max(0, Math.round(traffic * 3.2 - (cfg.pirates > 0.6 ? 1 : 0)));
    const houseTarget = this.system.gov === 'kreth' ? Math.round(cfg.navy * 4) : 0;

    if (pirates < pirateTarget) this._spawnPirate(rng);
    if (navy < navyTarget) this._spawnNavy(rng);
    if (houses < houseTarget) this._spawnHouse(rng);
    // a teeming port refills its shipping lanes faster — the sky should say so
    const refill = traffic >= 2 ? 2 : 1;
    for (let i = 0; i < refill && traders + i < traderTarget; i++) this._spawnTrader(rng);
    // and once in a long while, something enormous crosses the lane
    this._maybeCapitalTransit();
  }

  _edgePoint(rng, nearRocks = false) {
    const a = rng.float(0, TAU);
    let d;
    if (nearRocks && this.system.asteroids) {
      d = this.system.asteroids.dist + rng.float(-this.system.asteroids.spread, this.system.asteroids.spread);
    } else {
      d = rng.float(2200, 3200);
    }
    return { x: Math.cos(a) * d, z: Math.sin(a) * d };
  }

  /**
   * A raider in free-fire space. Same airframe rules as anywhere else, but
   * wearing whichever flag they feel like: with no law in the system, nobody
   * is keeping track of whose colours are whose.
   */
  _spawnPirate(rng) {
    const threat = threatLevel(this.state);
    const danger = this.system.danger.pirates;
    // the raiders you meet grow with your renown — knife-fights are earned
    let pool;
    if (threat <= 7) {
      // green lanes: patched cutters and worn haulers, nothing heavier
      pool = ['wayfarer', 'wayfarer', 'vagrant', 'skua'];
    } else if (threat <= 12) {
      pool = danger > 0.45 ? ['corsair', 'marlin', 'skua'] : ['wayfarer', 'corsair', 'marlin'];
    } else if (threat <= 15) {
      pool = danger > 0.6 ? ['corsair', 'rapier', 'voskar'] : ['marlin', 'corsair', 'vagrant'];
    } else {
      // a famous captain's space draws heavies, calm lanes or not
      pool = ['corsair', 'voskar', 'corsair'];
      if (threat >= 16 && rng.chance(0.35)) pool.push('spite');
      if (threat >= 18) pool.push('hound');
      if (threat >= 20 && (danger > 0.45 || rng.chance(0.5))) pool.push('vulture');
      if (threat >= 22 && (danger >= 0.6 || rng.chance(0.5))) pool.push('relict', 'halcyon');
      if (threat >= 24 && danger >= 0.5 && rng.chance(0.4)) pool.push('cuirassier'); // line ships shed to the clans
      if (threat >= 26 && rng.chance(0.35)) pool.push('anvil'); // a raider cruiser flies for the clan
      if (threat >= 28 && danger >= 0.55 && rng.chance(0.22)) pool.push('dragoon');
      if (threat >= 30 && danger >= 0.6 && rng.chance(0.1)) pool.push('tempest'); // only the deepest lanes ever see a clan battlecruiser
      if (threat >= 32 && danger >= 0.6 && rng.chance(0.12)) pool.push('legion'); // an assault hull on the prowl
      if (threat >= 34 && danger >= 0.65 && rng.chance(0.08)) pool.push('redoubt'); // a battleship flying a clan pennant
      if (threat >= 36 && danger >= 0.7 && rng.chance(0.05)) pool.push('monarch'); // the clan dreadnoughts answer only to the renown
      if (threat >= 16 && rng.chance(0.3)) pool.push('nettle'); // the new yards' light work, flown hard
      if (threat >= 20 && danger >= 0.4 && rng.chance(0.3)) pool.push('sidewinder', 'kestrel');
      if (threat >= 24 && danger >= 0.45 && rng.chance(0.25)) pool.push('sickle'); // a crescent raider, all curve and drive
      if (threat >= 30 && danger >= 0.55 && rng.chance(0.14)) pool.push('balefire'); // a spinal cruiser with one very long argument
      if (threat >= 34 && danger >= 0.62 && rng.chance(0.1)) pool.push('harrow', 'halfmoon'); // alpha cruisers on the clan rolls
      if (threat >= 37 && danger >= 0.68 && rng.chance(0.06)) pool.push('thunderhead', 'matriarch'); // and the monoliths behind them
    }
    const ace = threat >= 18 && rng.chance(0.15); // a named killer, living off this lane
    const shipId = rng.pick(pool);
    const p = this._edgePoint(rng, true);
    const harpoonChance = threat <= 7 ? 0 : threat <= 15 ? 0.2 : 0.35;
    const lightGun = rng.chance(0.5) ? 'needler' : 'pulse';
    // green raiders pack mostly cheap needlers
    let weapons = [threat <= 7 ? (rng.chance(0.75) ? 'needler' : 'pulse') : lightGun, rng.chance(harpoonChance) ? 'harpoon' : null];
    // the elite prize hulls carry proper batteries, not a single popgun
    if (shipId === 'spite') weapons = ['flenser', rng.chance(0.4) ? 'harpoon' : 'needler', null];
    if (shipId === 'hound') weapons = ['twinpulse', rng.chance(0.5) ? 'harpoon' : null, null];
    if (shipId === 'vulture') weapons = ['flenser', rng.chance(0.5) ? 'harpoon' : 'needler', null];
    if (shipId === 'relict') weapons = ['flenser', 'pulse', rng.chance(0.5) ? 'harpoon' : null];
    if (shipId === 'anvil') weapons = ['flenser', 'twinpulse', rng.chance(0.5) ? 'harpoon' : 'needler', null];
    if (shipId === 'cuirassier') weapons = ['flenser', 'flenser', rng.chance(0.4) ? 'harpoon' : null];
    if (shipId === 'dragoon') weapons = ['flenser', 'twinpulse', rng.chance(0.5) ? 'harpoon' : null];
    if (shipId === 'tempest') weapons = ['flenser', 'flenser', 'twinpulse', rng.chance(0.6) ? 'harpoon' : null];
    if (shipId === 'legion') weapons = ['flenser', 'flenser', 'twinpulse', rng.chance(0.5) ? 'harpoon' : null];
    if (shipId === 'redoubt') weapons = ['flenser', 'flenser', 'twinpulse', rng.chance(0.6) ? 'harpoon' : null, null];
    if (shipId === 'monarch') weapons = ['flenser', 'flenser', 'twinpulse', 'harpoon', null, null];
    if (shipId === 'nettle') weapons = ['twinpulse', rng.chance(0.3) ? 'harpoon' : null];
    if (shipId === 'sidewinder') weapons = ['pulse', rng.chance(0.5) ? 'harpoon' : 'dart', null];
    if (shipId === 'kestrel') weapons = ['stiletto', rng.chance(0.4) ? 'harpoon' : null];
    if (shipId === 'sickle') weapons = ['flenser', 'twinpulse', rng.chance(0.5) ? 'harpoon' : null, null];
    if (shipId === 'balefire') weapons = ['hellbore', 'flenser', 'twinpulse', rng.chance(0.5) ? 'harpoon' : null, null];
    if (shipId === 'harrow') weapons = ['gauss', 'flenser', 'flenser', 'twinpulse', null, null];
    if (shipId === 'halfmoon') weapons = ['hellbore', 'flenser', 'flenser', 'pulse', null, null];
    if (shipId === 'thunderhead') weapons = ['gauss', 'gauss', 'flenser', 'twinpulse', 'harpoon', null];
    if (shipId === 'matriarch') weapons = ['griefheart', 'flenser', 'flenser', 'twinpulse', 'harpoon', null];
    // veteran clans hunt prizes as readily as kills — a snare coil goes into a
    // free hardpoint once the lanes get serious, and shows on the hull
    if (threat >= 15 && rng.chance(0.3)) {
      const free = weapons.indexOf(null);
      if (free >= 0) weapons[free] = threat >= 26 ? 'damping' : 'snare';
    }
    // in free-fire space nobody checks your papers, so raiders fly whatever
    // colours they like — including each other's
    const raiderFaction = this.freefire
      ? rng.pick(['free', 'reaver', 'combine', 'kreth', 'vigil'])
      : 'reaver';
    const ship = Ship.npc(shipId, {
      scene: this.scene, x: p.x, z: p.z, heading: rng.float(0, TAU),
      faction: raiderFaction, role: 'pirate', name: 'Reaver raider',
      loadout: { weapons },
    });
    // green crews fly patched-up junk; veterans meet fully-kitted raiders
    const wear = threat <= 7 ? 0.55 : threat <= 15 ? 0.85 : 1;
    ship.hull = ship.stats.hull * wear;
    ship.shield = ship.stats.shield * wear;
    ship.weapons = weapons;
    ship.ammo = { harpoon: threat <= 15 ? 3 : 4 };
    if (shipId === 'tempest') ship.ammo = { harpoon: 6 };
    // green raiders are sloppy gunners on slow triggers — and their guns hit soft;
    // the lanes sharpen with you, and the top of the ladder is merciless
    if (threat <= 4) { ship.aimError = 0.07; ship.cdMult = 1.5; ship.dmgMult = 0.45; }
    else if (threat <= 7) { ship.aimError = 0.055; ship.cdMult = 1.35; ship.dmgMult = 0.6; }
    else if (threat <= 12) { ship.aimError = 0.032; ship.cdMult = 1.18; ship.dmgMult = 0.78; }
    else if (threat <= 18) { ship.aimError = 0.018; ship.cdMult = 1.05; ship.dmgMult = 0.95; }
    else if (threat <= 24) { ship.aimError = 0.01; ship.cdMult = 0.95; ship.dmgMult = 1.08; }
    else if (threat <= 32) { ship.aimError = 0.005; ship.cdMult = 0.88; ship.dmgMult = 1.2; }
    else { ship.aimError = 0.004; ship.cdMult = 0.82; ship.dmgMult = 1.32; }
    // renown draws trouble — but mostly in lanes that already belong to trouble,
    // and only in the stretches of lane that have not been shot up already
    if (this.ambushReady()) {
      const hostile = Math.min(1, this.hostileWeight());
      const keen = threat >= 18 && rng.chance(0.22 * hostile)
        ? true
        : threat >= 12 && rng.chance(0.15 * hostile);
      if (keen) {
        ship.hunting = true;
        this.noteAmbush();
      }
    }
    // nobody in a free-fire system is waiting for an excuse
    if (this.freefire) {
      ship.aggroed = true;
      if (ship.ai) ship.ai.bravado = 1;
    }
    if (ace) {
      ship.name = 'Reaver ace';
      ship.hull = ship.stats.hull;
      ship.shield = ship.stats.shield;
      ship.dmgMult = Math.min(1.35, ship.dmgMult + 0.12);
      ship.cdMult = Math.max(0.8, ship.cdMult - 0.08);
      ship.aimError = Math.max(0, ship.aimError - 0.006);
      ship.ammo.harpoon = 5;
      if (ship.ai) ship.ai.bravado = Math.max(ship.ai.bravado, 0.85); // aces do not run
    }
    this._addNpc(ship, 'pirate', p);
  }

  _spawnNavy(rng) {
    // frigate patrols only appear once the pilot has grown — early lanes get interceptors
    const threat = threatLevel(this.state);
    const halcyonChance = threat <= 12 ? 0 : clamp(0.15 + (threat - 12) * 0.04, 0, 0.6);
    const shipId = rng.chance(halcyonChance) ? 'halcyon'
      : threat > 18 && rng.chance(0.25) ? 'quill'
        : threat > 14 && rng.chance(0.3) ? 'kestrel'
          : threat > 8 && rng.chance(0.4) ? 'watchman' : 'sparrowhawk';
    const p = this._edgePoint(rng);
    const weapons = [shipId === 'halcyon' ? 'sunbeam' : shipId === 'quill' ? 'gauss' : shipId === 'kestrel' ? 'stiletto' : shipId === 'watchman' ? (rng.chance(0.5) ? 'twinpulse' : 'pulse') : 'pulse', null];
    const ship = Ship.npc(shipId, {
      scene: this.scene, x: p.x, z: p.z, heading: rng.float(0, TAU),
      faction: 'vigil', role: 'navy', name: 'Vigil patrol',
      loadout: { weapons },
    });
    ship.weapons = weapons;
    ship.ammo = {};
    if (threat <= 4) { ship.aimError = 0.06; ship.cdMult = 1.5; ship.dmgMult = 0.45; }
    else if (threat <= 7) { ship.aimError = 0.045; ship.cdMult = 1.3; ship.dmgMult = 0.6; }
    else if (threat <= 12) { ship.aimError = 0.03; ship.cdMult = 1.15; ship.dmgMult = 0.75; }
    else if (threat <= 18) { ship.aimError = 0.018; ship.cdMult = 1.05; ship.dmgMult = 0.92; }
    else { ship.aimError = 0.008; ship.cdMult = 0.95; ship.dmgMult = 1.05; }
    this._addNpc(ship, 'navy', p);
  }

  _spawnHouse(rng) {
    const threat = threatLevel(this.state);
    const shipId = rng.chance(0.3) ? 'voskar' : rng.chance(0.22) ? 'sickle' : rng.chance(0.5) ? 'corsair' : 'sparrowhawk';
    const p = this._edgePoint(rng);
    const house = rng.pick(HOUSE_NAMES);
    const weapons = [rng.chance(0.6) ? 'twinpulse' : 'pulse', rng.chance(0.4) ? 'harpoon' : null];
    const ship = Ship.npc(shipId, {
      scene: this.scene, x: p.x, z: p.z, heading: rng.float(0, TAU),
      faction: 'kreth', role: 'house', name: `${house} muster`,
      loadout: { weapons },
    });
    ship.weapons = weapons;
    ship.ammo = { harpoon: 4 };
    ship.aimError = threat <= 12 ? 0.035 : threat <= 18 ? 0.02 : 0.01;
    ship.cdMult = threat <= 12 ? 1.15 : threat <= 18 ? 1.02 : 0.94;
    ship.dmgMult = threat <= 12 ? 0.7 : threat <= 18 ? 0.88 : 1.02;
    this._addNpc(ship, 'house', p);
  }

  _spawnTrader(rng) {
    // the lanes roll a full market — lighters, traders, bulk haulers, and once
    // in a great while a grand liner that clears the whole lane by itself
    const pool = ['vagrant', 'mule', 'dhow', 'ketch', 'drayman', 'ox', 'schooner', 'dromond', 'barque', 'vintner', 'ferryman', 'mainsail', 'sluice'];
    const shipId = rng.chance(0.22) ? 'stormgalleon' : rng.chance(0.06) ? 'cabochon' : rng.chance(0.035) ? 'palladium' : rng.pick(pool);
    const p = this._edgePoint(rng);
    const station = rng.pick(this.stations);
    const weapons = [rng.chance(0.4) ? 'needler' : null, null];
    const ship = Ship.npc(shipId, {
      scene: this.scene, x: p.x, z: p.z, heading: rng.float(0, TAU),
      faction: this.system.gov === 'combine' ? 'combine' : this.system.gov === 'kreth' ? 'kreth' : 'free',
      role: 'trader', name: 'Merchant',
      loadout: { weapons },
    });
    ship.weapons = weapons;
    ship.ammo = {};
    this._addNpc(ship, 'trader', station ? { x: station.x, z: station.z } : p);
  }

  /**
   * Capitals are not lane traffic. Once in a long while one crosses the whole
   * system on a straight course — a squadron column, a banner ship, a liner
   * under Combine colours — and folds out the far side without ever stopping.
   * Board contracts are how you get one to hold still.
   */
  _maybeCapitalTransit() {
    if (this.ships.some((s) => s.role === 'transit')) return; // one at a time
    if (this._capitalCd > this.time) return;
    const threat = threatLevel(this.state);
    if (threat < 6) return; // green pilots do not get to gawp at the big hulls
    const cfg = this.system.danger;
    const rng = rngOf(this.state.worldSeed, 'transit', this.systemId, Math.floor(this.time / 40));
    const chance = clamp(0.004 + cfg.pirates * 0.01 + (threat - 6) * 0.0008, 0, 0.03);
    if (!rng.chance(chance)) return;
    this._capitalCd = this.time + 150 + rng.float(0, 120);
    const gov = this.system.gov;
    const a = rng.float(0, TAU);
    const d = rng.float(2600, 3200);
    const from = { x: Math.cos(a) * d, z: Math.sin(a) * d };
    const to = { x: -from.x, z: -from.z };
    let shipId; let faction; let name; let weapons;
    if (gov === 'reaver' ? rng.chance(0.75) : (cfg.pirates > 0.55 && rng.chance(0.35))) {
      // a clan column running the gauntlet — it has business elsewhere
      shipId = rng.pick(['tempest', 'redoubt', 'halfmoon', 'thunderhead']);
      faction = 'reaver'; name = 'Reaver war column';
      weapons = ['flenser', 'flenser', 'twinpulse', 'harpoon', null];
    } else if (gov === 'vigil' || (gov === 'free' && rng.chance(0.6))) {
      shipId = rng.pick(['redoubt', 'monarch', 'tempest', 'cathedral', 'sunspire']);
      faction = 'vigil'; name = 'Vigil line squadron';
      weapons = ['flenser', 'flenser', 'twinpulse', 'harpoon', null];
    } else if (gov === 'kreth') {
      shipId = rng.pick(['redoubt', 'monarch', 'sceptre', 'matriarch', 'cathedral']);
      faction = 'kreth'; name = `${rng.pick(HOUSE_NAMES)} banner`;
      weapons = ['flenser', 'twinpulse', 'harpoon', null];
    } else {
      shipId = rng.pick(['palladium', 'leviathan', 'worldheart', 'cataract', 'coliseum']);
      faction = 'combine'; name = 'Combine grand convoy';
      weapons = ['pulse', null];
    }
    const ship = Ship.npc(shipId, {
      scene: this.scene, x: from.x, z: from.z,
      heading: Math.atan2(to.x - from.x, to.z - from.z),
      faction, role: 'transit', name,
      loadout: { weapons },
    });
    ship.weapons = weapons;
    ship.ammo = { harpoon: 4 };
    // it flies with the calm of something that has never once been questioned
    ship.aimError = 0.02;
    ship.cdMult = 1.1;
    ship.dmgMult = 0.85;
    this._addNpc(ship, 'transit', to);
  }

  _addNpc(ship, role, cruise) {
    this.ships.push(ship);
    const home = { x: ship.x, z: ship.z };
    home.haseed = Math.random();
    const controller = new AIController(ship, {
      role: ship.role,
      universe: this,
      home: role === 'trader' && cruise ? cruise : home,
      cruise,
    });
    ship.ai = controller;
  }

  /* ------------------------------------------------------------------ */
  /* Fleet wings                                                        */
  /* ------------------------------------------------------------------ */

  _spawnFleet() {
    let slot = 0;
    for (const entry of this.state.fleet || []) {
      if (entry.status !== 'escort') continue;
      this.spawnFleetShip(entry, slot++);
    }
  }

  /** Spawn one roster ship near the player as a friendly AI wing. */
  spawnFleetShip(entry, slot = 0) {
    const def = SHIP_BY_ID[entry.shipId] || SHIP_BY_ID.wayfarer;
    const p = this.player;
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    const sx = Math.cos(p.heading);
    const sz = -Math.sin(p.heading);
    const side = (slot % 2 === 0 ? -1 : 1) * (110 + 50 * Math.floor(slot / 2));
    const back = 130 + 60 * Math.floor(slot / 2);
    const { weapons, ammo } = fleetLoadout(entry.shipId);
    const ship = new Ship({
      def,
      scene: this.scene,
      x: p.x - fx * back + sx * side,
      z: p.z - fz * back + sz * side,
      heading: p.heading,
      faction: 'free',
      name: entry.name,
      role: 'escort',
      loadout: { weapons, mountCap: def.mounts ?? 2 },
    });
    ship.weapons = weapons;
    ship.ammo = ammo;
    ship.vx = p.vx;
    ship.vz = p.vz;
    ship.fleetUid = entry.uid;
    // fleet-category skills sharpen and armour the wing
    const wf = wingMods(this.state);
    ship.dmgMult = 1 + wf.wingDmg;
    ship.dmgTakenMult = Math.max(0.4, 1 - wf.wingArmor);
    ship.ai = new AIController(ship, {
      role: 'escort',
      universe: this,
      home: { x: p.x, z: p.z },
      leader: p,
      slot,
      mini: !!def.mini,
    });
    this.ships.push(ship);
    return ship;
  }

  /** Scramble a docked craft: it slides out of the bay and joins the wing. */
  launchMini(entry) {
    entry.status = 'escort';
    entry.bay = null;
    const slot = this.ships.filter((s) => s.role === 'escort').length;
    const ship = this.spawnFleetShip(entry, slot);
    const p = this.player;
    ship.vx = p.vx - Math.sin(p.heading) * 40;
    ship.vz = p.vz - Math.cos(p.heading) * 40;
    return ship;
  }

  /** A recalled craft reached the ship — park it back in a cradle. */
  _recoverFleetShip(ship) {
    const entry = (this.state.fleet || []).find((m) => m.uid === ship.fleetUid);
    if (!entry) return;
    const bay = nextFreeBay(this.state);
    entry.status = 'bay';
    entry.bay = bay;
    this.onEvent?.('fleetDocked', { name: ship.name });
  }

  /**
   * Put active contracts' marks into this system's sky: beacons, vaults,
   * bounty targets and recorder pods. Safe to call again later (e.g. the
   * moment a contract is signed at a berth) — every block skips what already
   * stands. `arrival` gates the one-shot complications (ambush, rival).
   */
  _spawnMissionObjects(arrival = false) {
    // survey beacons and relic vaults for active contracts in this system
    for (const m of this.state.missions) {
      if ((m.type === 'survey' || m.type === 'relic') && m.dest.systemId === this.systemId && !m.scanned) {
        if (this.beacons.some((b) => b.missionId === m.id)) continue; // already standing
        const rng = rngOf(this.state.worldSeed, 'beacon', m.id);
        const p = this._edgePoint(rng);
        const beacon = buildBeacon(m.type === 'relic' ? 0xffd27a : 0x8bf0a8);
        beacon.position.set(p.x, 0, p.z);
        this.scene.add(beacon);
        this.visuals.push(beacon);
        this.beacons.push({ missionId: m.id, group: beacon, x: p.x, z: p.z });
      }
    }
    // bounty targets — scaled by contract risk tier, escorted at high tiers
    for (const m of this.state.missions) {
      if (m.type === 'bounty' && m.dest.systemId === this.systemId && m.target) {
        if (this.ships.some((s) => s.bountyMissionId === m.id && s.alive)) continue; // the mark already flies
        const rng = rngOf(this.state.worldSeed, 'bounty', m.id);
        const p = this._edgePoint(rng, true);
        const shipId = m.target.shipId || 'corsair';
        const faction = m.target.kind === 'vigil' ? 'vigil' : 'reaver';
        const tier = clamp(m.tier || 1, 1, 8);
        const weapons = m.target.weapons ? [...m.target.weapons] : (tier <= 2 ? ['pulse', null] : ['pulse', 'harpoon']);
        const ship = Ship.npc(shipId, {
          scene: this.scene, x: p.x, z: p.z, heading: rng.float(0, TAU),
          faction, role: 'bounty', name: m.target.name,
          loadout: { weapons },
        });
        ship.bountyMissionId = m.id;
        ship.weapons = weapons;
        ship.ammo = { harpoon: m.target.harpoonAmmo ?? [0, 0, 0, 3, 5, 6, 8, 9, 10][tier] };
        ship.stats = { ...ship.stats };
        ship.hull = ship.stats.hull * (m.target.hullMult || 1.2);
        ship.shield = ship.stats.shield * (m.target.shieldMult || 1.1);
        // green marks fly sloppier, squeeze slower and hit soft; aces are dead-eyed
        ship.aimError = [0, 0.05, 0.03, 0.016, 0.008, 0.003, 0.002, 0.0015, 0.001][tier];
        ship.dmgMult = m.target.dmgMult ?? [1, 0.7, 0.82, 0.95, 1.08, 1.2, 1.3, 1.38, 1.45][tier];
        ship.cdMult = m.target.cdMult ?? [1, 1.35, 1.2, 1.1, 1.0, 0.9, 0.86, 0.84, 0.8][tier];
        this._addNpc(ship, 'bounty', p);
        // wingmen for the top-tier marks — better hulls fly with better prey
        for (let i = 0; i < (m.target.escorts || 0); i++) {
          const a = rng.float(0, TAU);
          const ex = p.x + Math.cos(a) * rng.float(130, 230);
          const ez = p.z + Math.sin(a) * rng.float(130, 230);
          const wingId = tier >= 6 ? rng.pick(['dragoon', 'cuirassier']) : tier >= 5 ? rng.pick(['rapier', 'dragoon']) : tier >= 4 ? rng.pick(['corsair', 'marlin', 'rampart']) : 'corsair';
          const wingWeapons = tier >= 6 ? ['flenser', 'harpoon'] : tier >= 5 ? ['twinpulse', 'harpoon'] : tier >= 4 ? ['needler', 'harpoon'] : ['needler', null];
          const wing = Ship.npc(wingId, {
            scene: this.scene, x: ex, z: ez, heading: rng.float(0, TAU),
            faction, role: 'bounty', name: `${m.target.name}'s wing`,
            loadout: { weapons: wingWeapons },
          });
          wing.weapons = wingWeapons;
          wing.ammo = { harpoon: 3 };
          wing.aimError = 0.02;
          wing.dmgMult = tier >= 6 ? 1.0 : tier >= 5 ? 0.95 : 0.85;
          wing.cdMult = 1.05;
          this._addNpc(wing, 'bounty', { x: ex, z: ez });
        }
      }
    }
    // recovery: recorder pods adrift in the wreck field
    for (const m of this.state.missions) {
      if (m.type !== 'recovery' || m.dest.systemId !== this.systemId || !m.pods) continue;
      for (let i = 0; i < m.pods.need; i++) {
        if (m.pods.taken.includes(i)) continue;
        if (this.pods.some((pp) => pp.kind === 'mission' && pp.missionId === m.id && pp.podIndex === i)) continue; // already adrift
        const rng = rngOf(this.state.worldSeed, 'recover', m.id, i);
        const p = this._edgePoint(rng, !!this.system.asteroids);
        const item = {
          kind: 'mission',
          missionId: m.id,
          podIndex: i,
          x: p.x, z: p.z,
          vx: rng.float(-18, 18), vz: rng.float(-18, 18),
          life: 600,
          amount: 0,
          commodityId: null,
        };
        item.mesh = buildPod(0x9fffb0);
        item.mesh.position.set(item.x, 0, item.z);
        this.scene.add(item.mesh);
        this.pods.push(item);
      }
    }

    // complications fire on arrival — some contracts are followed, some manifests were bait
    if (arrival) for (const m of this.state.missions) {
      if (!m.twist || m.twist.fired || m.dest?.systemId !== this.systemId) continue;
      if (m.twist.kind === 'ambush') {
        m.twist.fired = true;
        const pack = clamp(2 + Math.floor((m.tier || 1) / 2), 2, 4);
        for (let i = 0; i < pack; i++) this._spawnPirate(rngOf(this.state.worldSeed, 'twist', m.id, i));
        this.onEvent?.('missionTwist', { mission: m, kind: 'ambush' });
      } else if (m.twist.kind === 'rival') {
        m.twist.fired = true;
        const rng = rngOf(this.state.worldSeed, 'twist', m.id);
        const shipId = rng.pick((m.tier || 1) >= 4 ? ['dragoon', 'rapier'] : ['marlin', 'rampart']);
        const p = this._edgePoint(rng, true);
        const weapons = ['twinpulse', 'harpoon', null];
        const rival = Ship.npc(shipId, {
          scene: this.scene, x: p.x, z: p.z, heading: rng.float(0, TAU),
          faction: 'reaver', role: 'bounty',
          name: `${rng.pick(PIRATE_FIRST)} ${rng.pick(PIRATE_EPITHET)} — the rival hand`,
          loadout: { weapons },
        });
        rival.weapons = weapons;
        rival.ammo = { harpoon: 4 };
        rival.aimError = 0.02;
        rival.dmgMult = 0.95;
        rival.cdMult = 1.0;
        this._addNpc(rival, 'bounty', p);
        this.onEvent?.('missionTwist', { mission: m, kind: 'rival', ship: rival });
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Hostility                                                          */
  /* ------------------------------------------------------------------ */

  npcHostileToPlayer(npc) {
    const st = this.state;
    if (!npc.alive) return false;
    // in free-fire space, anyone who is not flying your wing is a threat
    if (this.freefire) return npc.role !== 'escort';
    const grudge = this.grudgeActive(npc.faction);
    switch (npc.role) {
      case 'pirate':
        return npc.aggroed || npc.hunting || grudge || st.rep.reaver < -10;
      case 'bounty':
        return true;
      case 'navy': {
        // a patrol answers to its own flag's books: the Combine does not open
        // fire for the Vigil's quarrels, nor the other way round
        const books = npc.faction === 'combine' ? st.rep.combine
          : npc.faction === 'kreth' ? (st.rep.kreth ?? 0)
            : st.rep.vigil;
        return books <= HOSTILE_REP || npc.aggroed || grudge;
      }
      case 'house':
        return (st.rep.kreth ?? 0) <= HOSTILE_REP || npc.aggroed || grudge;
      default:
        return npc.aggroed === true || grudge;
    }
  }

  /** Days a faction holds a grudge after its kin are attacked — at least one warp. */
  noteGrudge(faction) {
    if (!faction) return;
    if (this.freefire) return; // nothing done in these systems follows you out
    const st = this.state;
    st.grudge[faction] = Math.max(st.grudge[faction] || 0, st.day + 1);
  }

  grudgeActive(faction) {
    if (!faction) return false;
    return (this.state.grudge?.[faction] || 0) >= this.state.day;
  }

  /**
   * The lanes have had their excitement for a while. Any unprovoked attack on
   * the captain — a raider that talks itself into a hunt, or one that spawns
   * with the bit between its teeth — spends this, so passing through a system
   * is worth at most one ambush per AMBUSH_GAP however much traffic rolls in.
   */
  noteAmbush() {
    this._ambushReadyAt = this.time + AMBUSH_GAP;
  }

  /** Whether an unprovoked attack is on the cards at all right now. */
  ambushReady() {
    return this.time >= (this._ambushReadyAt || 0);
  }

  /**
   * Cooling off: a hull that is up in arms against the captain holds that
   * decision only while it keeps the captain in reach. Called every frame, and
   * cheap — it reads two flags and one squared distance per hull.
   */
  _updateAggro(dt) {
    const p = this.player;
    if (!p?.alive) return;
    const limit = AGGRO_BREAK * AGGRO_BREAK;
    for (const s of this.ships) {
      if (s.isPlayer || !s.alive || s.role === 'escort' || s.despawn) continue;
      if (!s.hunting && !s.aggroed) {
        s.coolT = 0;
        continue;
      }
      if (distSq2(s.x, s.z, p.x, p.z) > limit) s.coolT = (s.coolT || 0) + dt;
      else s.coolT = 0;
      if (s.coolT >= AGGRO_COOL) this._calmDown(s);
    }
  }

  /**
   * Whatever this hull had against the captain is dropped. What the flag
   * remembers is untouched — a grudge still runs its days, a provoked faction
   * still counts the shots — but this pilot stops hunting, stops fleeing, and
   * goes back to the lane it was flying. It hails again if it ever takes
   * against the captain anew.
   */
  _calmDown(ship) {
    ship.hunting = false;
    ship.aggroed = false;
    ship.coolT = 0;
    ship._provoked = 0;
    ship._provokedT = -99;
    ship._hailed = false;
    if (!ship.ai) return;
    ship.ai.witnessed = null;
    ship.ai.fleeing = false;
    ship.ai._fleeDecided = false;
    ship.ai._willFlee = false;
    ship.ai.target = null;
    if (ship.ai.state === 'flee') ship.ai.state = 'cruise';
  }

  /**
   * How tempting the captain looks to a pirate right now. The roll is scaled by
   * territory — an unprovoked attack is a fact of life in clan space and the
   * deep lanes, and a rare event in the law's own backyard.
   */
  pirateInterest() {
    const st = this.state;
    const p = this.player;
    const threat = threatLevel(st);
    let w = 0.1;
    w += (this.system?.danger?.pirates ?? 0.3) * 0.35;
    w += clamp((threat - 8) * 0.025, 0, 0.45); // renown is its own bounty board
    if (st.rep.reaver < 0) w += 0.3; // clan business
    if (st.rep.vigil > 30 || st.rep.combine > 40) w += 0.2; // a friend of the law
    if (st.cargoUsed() > 0) w += 0.22; // something worth taking
    const escorts = (st.fleet || []).filter((m) => m.status === 'escort').length;
    if (escorts === 0) w += 0.08;
    else w -= 0.15 * Math.min(2, escorts);
    if (p && p.hull < p.stats.hull * 0.5) w += 0.15; // easy prey
    w *= this.hostileWeight();
    // the lanes breathe easier — ambushes are rarer everywhere, by decree
    w *= AMBIENT_ATTACK_TRIM;
    return clamp(w, threat > 18 ? 0.04 : 0.01, 0.45);
  }

  /**
   * How much this system invites random violence: ~0.2 in a patrolled core
   * system, climbing past 1.0 in clan space and the lawless deep.
   */
  hostileWeight() {
    const danger = this.system?.danger?.pirates ?? 0.3;
    const gov = this.system?.gov;
    let k = 0.16 + danger * 1.05;
    if (gov === 'reaver') k += 0.3;
    else if (gov === 'vigil' || gov === 'combine') k *= 0.75;
    return clamp(k, 0.14, 1.3);
  }

  /**
   * Called whenever a hull takes a hit. A REAL attack is punished instantly —
   * the victim fights back, its faction remembers, and its mates nearby join.
   * A stray tick (a single shaft through a passing freighter) only rattles the
   * pilot: ships are never dragged into a war by accident.
   */
  onShipAttacked(victim, attacker, damage = 0) {
    if (!victim || victim.isPlayer || !attacker) return;
    victim.lastAttacker = attacker;
    victim.ai?.flinch?.(); // hits rattle the aim — their focus scatters

    if (attacker.isPlayer && !this.npcHostileToPlayer(victim)) {
      // provocation meter: sustained fire counts, a clipped wing does not
      if (this.time - (victim._provokedT ?? -99) > 4) victim._provoked = 0;
      victim._provokedT = this.time;
      const need = clamp((victim.stats?.hull || 200) * 0.08, 18, 70);
      victim._provoked = (victim._provoked || 0) + damage;
      if (victim._provoked < need) return; // a warning shot is only a warning
    }

    victim.aggroed = true;
    if (attacker.isPlayer) {
      victim.hunting = true;
      // civilian crews do not brawl — they run for open space
      if (victim.role === 'trader' || victim.role === 'transit' || victim.role === 'courier') {
        if (victim.ai) victim.ai.state = 'flee';
      }
      this.noteGrudge(victim.faction);
    }
    if (victim._rallyT && this.time - victim._rallyT < 1.5) return;
    victim._rallyT = this.time;

    // only the lines and the clans answer a real attack, and only for their own —
    // freighters passing through never get drafted into someone else's war
    const rallyable = (s) => s.role === 'pirate' || s.role === 'navy' || s.role === 'house' || s.role === 'bounty';
    for (const s of this.ships) {
      if (s === victim || !s.alive || s.isPlayer || s.role === 'escort' || s.surrendered) continue;
      const kin = s.faction === victim.faction || (s.role === 'navy' && victim.role === 'trader');
      if (!kin) continue;
      if (dist2(s.x, s.z, victim.x, victim.z) > 800) continue;
      if (attacker.isPlayer) {
        if (!rallyable(s)) continue; // civilians don't join wars
        s.aggroed = true;
        if (s.ai) s.ai.witnessed = attacker;
      } else if (this.isHostile(s, attacker) && s.ai) {
        s.ai.witnessed = attacker;
      }
    }
  }

  isHostile(a, b) {
    if (!a || !b || a === b || !a.alive || !b.alive) return false;
    // a hull that has struck its colours is out of the fight — nobody targets prizes
    if (a.surrendered || b.surrendered) return false;
    // neither is a snared hull worth a shot: it is drifting, and it is salvage
    if (a.disabled || b.disabled) return false;
    // --- free-fire systems -------------------------------------------------
    // No flags, no kin and no rules: every hull in the system is fair game for
    // every other. The only exception is your own wing, which stays yours.
    if (this.freefire) {
      if (a.isPlayer || b.isPlayer) return this.npcHostileToPlayer(a.isPlayer ? b : a);
      if (a.role === 'escort' || b.role === 'escort') {
        return (a.role === 'escort') !== (b.role === 'escort');
      }
      return true;
    }
    if (a.isPlayer || a.role === 'escort') return this.npcHostileToPlayer(b);
    if (b.isPlayer || b.role === 'escort') return this.npcHostileToPlayer(a);
    if (a.faction === b.faction) return false;
    const prey = (s) => s.role === 'navy' || s.role === 'trader' || s.role === 'house' || s.role === 'transit';
    const pirate = (s) => s.role === 'pirate' || s.role === 'bounty';
    if (pirate(a) && prey(b)) return true;
    if (pirate(b) && prey(a)) return true;
    return false;
  }

  findHostileTarget(ship, range = 2200) {
    let best = null;
    let bestD = range * range;
    for (const other of this.ships) {
      if (!this.isHostile(ship, other)) continue;
      const d = (other.x - ship.x) ** 2 + (other.z - ship.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = other;
      }
    }
    return best;
  }

  fireShip(ship, slot, target) {
    return this.combat.fire(ship, slot, target);
  }

  leadPoint(shooter, target, speed) {
    return leadPoint(shooter, target, speed);
  }

  /* ------------------------------------------------------------------ */
  /* Destruction, loot, events                                          */
  /* ------------------------------------------------------------------ */

  onShipDestroyed(ship, killer) {
    if (!ship.alive) return;
    ship.destroy(this.fx);

    if (ship.isPlayer) {
      audio.boom(1.4);
      this.onEvent?.('playerDestroyed', { killer });
      return;
    }

    // a member of your own fleet went down
    if (ship.role === 'escort') {
      removeFromFleet(this.state, ship.fleetUid);
      audio.boom(1.1);
      this.onEvent?.('fleetShipLost', { ship });
      this._removeShip(ship);
      return;
    }

    audio.boom(1.1);
    if (dist2(ship.x, ship.z, this.player.x, this.player.z) < 2600) {
      this.onEvent?.('npcDestroyed', { ship, killer });
    }

    // loot — lumen cells are precious, so only a rare wreck keeps a spare one
    const rng = rngOf(this.state.worldSeed, 'loot', ship.name, Math.floor(this.time * 10));
    if (ship.role === 'trader') {
      const drops = rng.int(1, 3);
      for (let i = 0; i < drops; i++) this._dropPod(ship, rng, 'cargo');
      if (rng.chance(0.18)) this._dropPod(ship, rng, 'lumen'); // fuel haulers run with spares
    } else if (ship.role === 'transit') {
      // a capital wreck sheds salvage for a while — the reason anyone dares
      const drops = rng.int(2, 4);
      for (let i = 0; i < drops; i++) this._dropPod(ship, rng, 'credits');
      if (rng.chance(0.22)) this._dropPod(ship, rng, 'lumen');
    } else {
      if (rng.chance(0.75)) this._dropPod(ship, rng, 'credits');
      if (rng.chance(0.09)) this._dropPod(ship, rng, 'lumen'); // one wreck in eleven keeps a cell
    }

    // reputation consequences for the player
    if (killer === this.player) {
      const st = this.state;
      st.stats.kills++;
      // Free-fire ground: no flag is watching and no ledger is kept, so nothing
      // here costs karma or standing. Experience still counts.
      const freefire = this.freefire;
      if (!freefire) {
        if (ship.role === 'pirate') {
          st.addRep('vigil', 2);
          st.addRep('combine', 1);
          st.addRep('reaver', -2);
          this.onEvent?.('bountyKill', { ship });
        } else if (ship.role === 'trader') {
          st.stats.traderKills++;
          st.addRep('reaver', 2);
          if (ship.faction === 'combine') st.addRep('combine', -4);
          else st.addRep('free', -3);
          this.onEvent?.('traderKill', { ship });
        } else if (ship.role === 'navy') {
          st.stats.navyKills++;
          st.addRep('vigil', -7);
          st.addRep('combine', -4);
          st.addRep('reaver', 3);
          this.onEvent?.('navyKill', { ship });
        } else if (ship.role === 'house') {
          st.addRep('kreth', -7);
          this.onEvent?.('houseKill', { ship });
        } else if (ship.role === 'transit') {
          // word travels fast when a capital goes down — its owners take it badly
          if (ship.faction === 'vigil') st.addRep('vigil', -9);
          else if (ship.faction === 'kreth') st.addRep('kreth', -9);
          else if (ship.faction === 'reaver') st.addRep('reaver', -4);
          else if (ship.faction === 'combine') st.addRep('combine', -6);
          this.onEvent?.('capitalDown', { ship });
        }
      }
      // character progression: experience and karma
      const xpRes = addXp(st, XP_BY_ROLE[ship.role] || 20);
      if (!freefire) {
        addKarma(st, KARMA_BY_ROLE[ship.role] || 0, `destroyed a ${ship.role} — ${ship.def.name}`);
      }
      this.onEvent?.('xpGain', { ...xpRes, role: ship.role });
      if (ship.bountyMissionId) {
        this.onEvent?.('bountyContractComplete', { missionId: ship.bountyMissionId, ship });
      }
      // sweeps contracted here count their quarry
      if (ship.role === 'pirate' || ship.role === 'navy') {
        this.onEvent?.('raiderKill', { ship, systemId: this.systemId, role: ship.role });
      }
    } else if (ship.bountyMissionId) {
      // another hand put your mark down - the office cuts a fresh lead
      this.onEvent?.('bountyMarkLost', { missionId: ship.bountyMissionId });
    }

    // remove from the world (defer to keep loops safe)
    this._removeShip(ship);
  }

  _removeShip(ship) {
    const idx = this.ships.indexOf(ship);
    if (idx >= 0) this.ships.splice(idx, 1);
    ship.dispose();
  }

  /**
   * A hull taken rather than broken: prize crew aboard, prisoners in the hold,
   * and a very different ledger entry from a kill. Destroys nothing, so none of
   * the destroy reputation or karma is paid — only the much smaller capture toll.
   * @param {object} ship the claimed hull
   * @param {{mercy?: boolean}} [opts] mercy = the crew was put ashore alive
   */
  onShipCaptured(ship, { mercy = false } = {}) {
    const st = this.state;
    const role = ship.role;
    st.stats.captures = (st.stats.captures || 0) + 1;
    // In free-fire space a prize is just a prize: the hull changes hands and
    // nobody keeps a file on it. Only outside does the ledger run.
    if (this.freefire) {
      this.onEvent?.('shipCaptured', { ship, mercy, role });
      return;
    }
    const karma = CAPTURE_KARMA[role] ?? 0;
    addKarma(st, karma + (mercy ? MERCY_KARMA : 0), `took a ${role} hull as a prize`);
    const reps = CAPTURE_REP[role];
    if (reps) for (const [fid, delta] of Object.entries(reps)) st.addRep(fid, delta);
    if (mercy && ship.faction) st.addRep(ship.faction, MERCY_REP);
    st.grudge[ship.faction] = Math.max(st.grudge[ship.faction] || 0, 0);
    this.onEvent?.('shipCaptured', { ship, mercy, role });
  }

  /**
   * Crippled crews strike their colours: hull shot through and shields gone,
   * a beaten ship near the player may heave to and wait to be claimed (C).
   * Contract marks and the disciplined core of the Vigil seldom do.
   */
  _checkSurrenders(dt) {
    const p = this.player;
    if (!p?.alive) return;
    for (const ship of this.ships) {
      if (ship.isPlayer || ship.surrendered || !ship.alive || ship.despawn) continue;
      if (ship.role === 'escort' || ship.bountyMissionId) continue; // the mark never gives up
      if (ship.hull > ship.stats.hull * 0.18 || ship.shield > 2) continue;
      if (dist2(ship.x, ship.z, p.x, p.z) > 2600) continue;
      ship._surrTimer = (ship._surrTimer || 0) + dt;
      if (ship._surrTimer < 1.1) continue;
      ship._surrTimer = 0;
      const chance = ship.role === 'trader' ? 0.55 : ship.role === 'pirate' ? 0.4 : ship.role === 'house' ? 0.3 : 0.15;
      if (Math.random() >= chance) continue;
      ship.surrendered = true;
      this.onEvent?.('shipSurrendered', { ship });
    }
  }

  /**
   * The hull under the cursor, for click-to-select. Projects every live contact
   * and takes the nearest to the pointer inside a generous grab radius, so
   * picking a ship in a furball does not demand pixel accuracy.
   */
  shipAtScreen(px, py, maxPx = 46) {
    if (!this.camera || !this.player?.alive) return null;
    const w = window.innerWidth;
    const h = window.innerHeight;
    let best = null;
    let bestD = maxPx * maxPx;
    for (const s of this.ships) {
      if (s.isPlayer || !s.alive || s.despawn) continue;
      const d = dist2(s.x, s.z, this.player.x, this.player.z);
      if (d > 2800) continue;
      this._pick.copy({ x: s.x, y: 0, z: s.z });
      this._pick.project(this.camera);
      if (this._pick.z > 1) continue; // behind the camera
      const sx = (this._pick.x * 0.5 + 0.5) * w;
      const sy = (-this._pick.y * 0.5 + 0.5) * h;
      // a big hull is easier to hit than a fighter at the same distance
      const pad = maxPx + (s.def?.len ?? 20) * 0.5;
      const dx = sx - px;
      const dy = sy - py;
      const dd = dx * dx + dy * dy;
      if (dd > pad * pad) continue;
      if (dd < bestD) { bestD = dd; best = s; }
    }
    return best;
  }

  /** Raiders announce themselves before they bite — one voice at a time. */
  _updateHails(dt) {
    const p = this.player;
    if (!p?.alive) return;
    this._hailTimer -= dt;
    if (this._hailTimer > 0) return;
    this._hailTimer = 3;
    if (this._hailsMuted > this.time) return;
    for (const s of this.ships) {
      if (s.isPlayer || !s.alive || s.despawn || s._hailed || s.bountyMissionId) continue;
      if (s.role !== 'pirate' && s.role !== 'bounty') continue;
      if (!s.hunting && !s.aggroed) continue;
      if (dist2(s.x, s.z, p.x, p.z) > 1700) continue;
      s._hailed = true;
      this._hailsMuted = this.time + 14; // let the last one land before the next
      this.onEvent?.('shipHail', { ship: s });
      break;
    }
  }

  /** Hulls the player lays eyes on in the lanes fill in the codex. */
  _checkSightings(dt) {
    this._sightTimer -= dt;
    if (this._sightTimer > 0) return;
    this._sightTimer = 0.5;
    const p = this.player;
    if (!p?.alive) return;
    for (const ship of this.ships) {
      if (ship.isPlayer || ship.role === 'escort' || !ship.alive || ship.despawn) continue;
      const id = ship.def?.id;
      if (!id || this.state.sighted?.[id]) continue;
      if (dist2(ship.x, ship.z, p.x, p.z) > 1500) continue;
      this.state.sighted = this.state.sighted || {};
      this.state.sighted[id] = { day: this.state.day, systemId: this.systemId, via: 'space' };
      this.onEvent?.('hullSighted', { shipId: id });
    }
  }

  _dropPod(ship, rng, kind) {
    const a = rng.float(0, TAU);
    const item = {
      kind,
      x: ship.x + Math.cos(a) * 30,
      z: ship.z + Math.sin(a) * 30,
      vx: ship.vx * 0.6 + Math.cos(a) * 40,
      vz: ship.vz * 0.6 + Math.sin(a) * 40,
      life: 75,
      amount: 0,
      commodityId: null,
    };
    if (kind === 'lumen') {
      item.amount = 1;
      item.life = 130; // a cold cell keeps — worth a detour back
      item.mesh = buildPod(0xc8f8ff);
    } else if (kind === 'credits') {
      item.amount = Math.round(rng.int(120, 900) * economyMods(this.state).killLoot);
      item.mesh = buildPod(0xffc060);
    } else {
      const pool = ['ore', 'grain', 'textiles', 'machinery', 'ice'];
      item.commodityId = rng.pick(pool);
      item.amount = rng.int(1, 4);
      item.mesh = buildPod(0x8fd8ff);
    }
    item.mesh.position.set(item.x, 0, item.z);
    this.scene.add(item.mesh);
    this.pods.push(item);
  }

  /* ------------------------------------------------------------------ */
  /* Frame update                                                       */
  /* ------------------------------------------------------------------ */

  /** Light the fold: streaks pour toward the ship and the helm stretches. */
  beginWarp() {
    const p = this.player;
    this._warping = true;
    this._warpBaseFov = this.camera.fov;
    this.warpFx.begin(p ? p.x : 0, p ? p.z : 0);
  }

  /** End the fold cleanly — the next system's sky is already here. */
  endWarp() {
    this._warping = false;
    this._warpK = 0;
    this.warpFx.stop();
    this.camera.fov = this._warpBaseFov;
    this.camera.updateProjectionMatrix();
  }

  update(dt, realDt = dt) {
    this.time += dt;

    // the warp fold plays in real time, whatever the sim speed
    if (this._warping) {
      this.warpFx.update(realDt);
      const k = Math.min(1, this.warpFx.t / this.warpFx.dur);
      this._warpK = k;
      this.camera.fov = this._warpBaseFov * (1 + 0.4 * Math.sin(Math.PI * k));
      this.camera.updateProjectionMatrix();
      if (!this.warpFx.active) this.endWarp();
    }

    for (const v of this.visuals) v.userData.animate?.(dt, this.time);
    this.fx.update(dt);
    this._updateCourier(dt);

    // ships + AI
    for (const ship of [...this.ships]) {
      if (!ship.alive) continue;
      ship.ai?.update(dt);
      ship.update(dt, this.fx);
    }

    // hulls that have lost the captain go back to minding their own business
    this._updateAggro(dt);

    // enemy markers: every hull hostile to the captain wears a soft red halo
    for (const ship of this.ships) {
      if (ship.isPlayer) continue;
      ship.setHostileFX(!ship.surrendered && this.npcHostileToPlayer(ship), dt, this.time);
    }

    this.combat.update(dt);

    // crippled hulls strike their colours; eyes on the lanes fill the codex
    this._checkSurrenders(dt);
    this._checkSightings(dt);
    this._updateHails(dt);

    // despawns
    for (const ship of [...this.ships]) {
      if (!ship.isPlayer && ship.despawn) {
        if (ship.fleetUid) this._recoverFleetShip(ship);
        this._removeShip(ship);
      }
    }

    // traffic management
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 3.5;
      this._manageSpawns(false);
    }

    // contracts self-heal: a mark that left the sky without being settled
    // (third-party kills, aged-out pods) is put back on a slow sweep
    this.missionRefreshT -= dt;
    if (this.missionRefreshT <= 0) {
      this.missionRefreshT = 12;
      this._spawnMissionObjects();
    }

    this._updatePods(dt);
    this._updateBeacons(dt);
    this._updateProximity();
    this._updateWormholes();
    // warp clearance state + plotter guide (a few times a second is plenty)
    this._warpT += dt;
    if (this._warpT >= 0.1) {
      this._warpT = 0;
      this.warpBlock = this.warpClearance();
      this._syncWarpGuide();
    }
    // camera follows in real time so the view stays steady at any sim speed
    this.updateCamera(realDt);
  }

  _updatePods(dt) {
    const p = this.player;
    for (let i = this.pods.length - 1; i >= 0; i--) {
      const pod = this.pods[i];
      // mission pods belong to a contract; if it is gone, so are they
      if (pod.kind === 'mission'
        && !this.state.missions.some((mm) => mm.id === pod.missionId && mm.type === 'recovery')) {
        this.scene.remove(pod.mesh);
        this.pods.splice(i, 1);
        continue;
      }
      pod.life -= dt;
      pod.vx *= 1 - 0.8 * dt;
      pod.vz *= 1 - 0.8 * dt;
      // gentle magnet toward the player
      const d = dist2(pod.x, pod.z, p.x, p.z);
      if (d < 220) {
        const k = 260 * dt / Math.max(40, d);
        pod.vx += (p.x - pod.x) * k;
        pod.vz += (p.z - pod.z) * k;
      }
      pod.x += pod.vx * dt;
      pod.z += pod.vz * dt;
      pod.mesh.position.set(pod.x, 0, pod.z);
      pod.mesh.userData.animate?.(dt, this.time);

      if (d < p.radius + 22) {
        // pickup! (a lumen cell waits outside a full tank — she keeps, and so does she)
        let taken = true;
        if (pod.kind === 'lumen') {
          if (this.state.lumen >= computeStats(this.state).lumenMax) {
            taken = false;
          } else {
            this.state.lumen += 1;
            audio.coin();
            this.onEvent?.('pickup', { text: 'Lumen cell recovered — one charge for the coils' });
          }
        } else if (pod.kind === 'credits') {
          const claimed = Math.round(pod.amount * economyMods(this.state).podCredits);
          this.state.addCredits(claimed);
          audio.coin();
          this.onEvent?.('pickup', { text: `Salvage claim: ₡${claimed}` });
        } else if (pod.kind === 'mission') {
          audio.coin();
          this.onEvent?.('missionPod', { missionId: pod.missionId, index: pod.podIndex });
        } else {
          const res = this.state.addCargo(pod.commodityId, pod.amount);
          if (res.ok) {
            audio.coin();
            this.onEvent?.('pickup', { text: `Recovered ${pod.amount} crates of ${pod.commodityId}` });
          } else {
            this.onEvent?.('pickup', { text: 'No cargo space — the pod drifts away' });
          }
        }
        if (taken) {
          this.scene.remove(pod.mesh);
          this.pods.splice(i, 1);
          continue;
        }
      }
      if (pod.life <= 0) {
        this.scene.remove(pod.mesh);
        this.pods.splice(i, 1);
      }
    }
  }

  _updateBeacons(dt) {
    const p = this.player;
    for (const b of [...this.beacons]) {
      const mission = this.state.missions.find((m) => m.id === b.missionId);
      if (!mission || mission.scanned) continue;
      const d = dist2(b.x, b.z, p.x, p.z);
      if (d < 460) {
        const need = mission.type === 'relic' ? 5 : 3; // vaults take their time
        this.scanTimers[b.missionId] = (this.scanTimers[b.missionId] || 0) + dt;
        if (this.scanTimers[b.missionId] >= need) {
          mission.scanned = true;
          audio.dock();
          // the beacon or cipher has done its work — it folds out of the field
          this.scene.remove(b.group);
          const vi = this.visuals.indexOf(b.group);
          if (vi >= 0) this.visuals.splice(vi, 1);
          const bi = this.beacons.indexOf(b);
          if (bi >= 0) this.beacons.splice(bi, 1);
          this.onEvent?.(mission.type === 'relic' ? 'relicScanned' : 'surveyScanned', { mission });
        }
      } else {
        this.scanTimers[b.missionId] = 0;
      }
    }
  }

  _updateProximity() {
    const p = this.player;
    this.nearStation = null;
    let bestD = Infinity;
    for (const st of this.stations) {
      const d = dist2(st.x, st.z, p.x, p.z);
      if (d < st.radius + 90 && d < bestD) {
        bestD = d;
        this.nearStation = st;
      }
    }
    this.nearPlanet = null;
    bestD = Infinity;
    for (const pl of this.planets) {
      const d = dist2(pl.x, pl.z, p.x, p.z);
      if (d < pl.record.radius + 120 && d < bestD) {
        bestD = d;
        this.nearPlanet = pl;
      }
    }
    this.nearWormhole = null;
    bestD = Infinity;
    for (const w of this.wormholes) {
      const d = dist2(w.x, w.z, p.x, p.z);
      if (d < w.radius + 280 && d < bestD) {
        bestD = d;
        this.nearWormhole = w;
      }
    }
    // the local star: close enough to read its core
    this.nearStar = null;
    const starR = this.system.star.size * 2.4 + 200;
    if (dist2(p.x, p.z, 0, 0) < starR) {
      this.nearStar = { record: this.system.star, radius: starR };
    }
  }

  /** Fly close to a wormhole and it charts itself — both mouths at once. */
  _updateWormholes() {
    const p = this.player;
    for (const w of this.wormholes) {
      if (w.discovered) continue;
      if (dist2(w.x, w.z, p.x, p.z) < 620) {
        w.discovered = true;
        this.state.wormholes[w.record.id] = true;
        this.onEvent?.('wormholeFound', { hole: w.record, systemId: this.systemId });
      }
    }
  }

  /** Summon a parcel of lumen: a courier folds in near the captain. */
  summonLumenCourier() {
    if (this.courier || !this.player?.alive) return false;
    const p = this.player;
    const a = p.heading + (Math.random() - 0.5) * 0.7;
    const d = 950;
    const def = SHIP_BY_ID.silverwing ? 'silverwing' : 'vagrant';
    const ship = Ship.npc(def, {
      scene: this.scene,
      x: p.x + Math.sin(a) * d,
      z: p.z + Math.cos(a) * d,
      heading: a + Math.PI, // nose toward the captain
      faction: 'free',
      role: 'courier',
      name: 'Lumen courier',
      loadout: { weapons: [null, null] },
    });
    ship.weapons = [null, null];
    ship.ammo = {};
    this.ships.push(ship);
    this.courier = { ship, phase: 'approach', t: 0 };
    return true;
  }

  /** The courier's short life: close in, hand over one lumen, fold out. */
  _updateCourier(dt) {
    const c = this.courier;
    if (!c) return;
    const { ship } = c;
    const p = this.player;
    c.t += dt;
    if (!ship.alive || ship.despawn || !p.alive) {
      this.courier = null;
      return;
    }
    if (c.phase === 'approach') {
      const dx = p.x - ship.x;
      const dz = p.z - ship.z;
      const d = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      ship.turnInput = clamp(wrapAngle(want - ship.heading) * 2.4, -1, 1);
      ship.throttleCmd = d > 320 ? 1 : d > 190 ? 0.55 : 0.15;
      ship.brakeCmd = d < 150 ? 0.5 : 0;
      if (d < 170) {
        c.phase = 'handover';
        c.t = 0;
        this.state.lumen += 1;
        this.onEvent?.('lumenDelivered', { amount: 1 });
      }
    } else if (c.phase === 'handover') {
      ship.throttleCmd = 0;
      ship.brakeCmd = 0.6;
      if (c.t > 1.4) {
        c.phase = 'depart';
        c.t = 0;
        this.onEvent?.('courierDepart');
      }
    } else if (c.phase === 'depart') {
      ship.throttleCmd = 1;
      if (c.t > 0.5) {
        ship.despawn = true;
        this.courier = null;
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Warp fields                                                        */
  /* ------------------------------------------------------------------ */

  /**
   * Null when the captain may spin up the coils; otherwise the nearest point
   * of clear space, its distance, and the field that is drowning the coils.
   */
  warpClearance() {
    const p = this.player;
    if (!p) return null;
    let source = null;
    let deepest = -1;
    for (const d of this.dampeners) {
      const dist = dist2(d.x, d.z, p.x, p.z);
      if (dist >= d.r) continue;
      const depth = d.r - dist;
      if (depth > deepest) {
        deepest = depth;
        source = d;
      }
    }
    if (!source) return null;
    const c = pushClear(this.dampeners, p.x, p.z);
    return { x: c.x, z: c.z, dist: dist2(p.x, p.z, c.x, c.z), source };
  }

  /** Dotted exit vector drawn for owners of the Warp Field Plotter. */
  _syncWarpGuide() {
    const p = this.player;
    const has = (this.state.outfits?.warpplotter || 0) > 0;
    if (!p || !has || !this.warpBlock) {
      if (this.warpGuide) this.warpGuide.visible = false;
      return;
    }
    const b = this.warpBlock;
    if (!this.warpGuide) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WARP_DOTS * 3), 3));
      const mat = new THREE.PointsMaterial({
        color: 0x9fd8ff, size: 16, map: warpDotTexture(),
        transparent: true, opacity: 0.7, depthWrite: false,
        blending: THREE.AdditiveBlending, sizeAttenuation: true,
      });
      this.warpGuide = new THREE.Points(geo, mat);
      this.warpGuide.frustumCulled = false;
      this.scene.add(this.warpGuide);
    }
    const n = clamp(Math.floor(b.dist / 56), 2, WARP_DOTS);
    const pos = this.warpGuide.geometry.attributes.position;
    for (let i = 0; i < n; i++) {
      const t = (i + 1) / (n + 0.6);
      pos.setXYZ(i, p.x + (b.x - p.x) * t, 6, p.z + (b.z - p.z) * t);
    }
    pos.needsUpdate = true;
    this.warpGuide.geometry.setDrawRange(0, n);
    this.warpGuide.visible = true;
    this.warpGuide.material.opacity = clamp(0.35 + b.dist / 1600, 0.35, 0.75);
  }

  updateCamera(dt, snap = false) {
    const p = this.player;
    if (!p) return;
    const leadK = 0.42;
    const tx = p.x + p.vx * leadK;
    const tz = p.z + p.vz * leadK;
    const speed = p.speed;
    this.zoomLevel = snap ? this.zoomTarget : damp(this.zoomLevel, this.zoomTarget, 5, dt);
    const base = 300 + clamp(speed * 0.55, 0, 190);
    // the fold dives the helm down toward the ship, then lets it back up
    const warpDip = this._warping ? 1 - 0.4 * Math.sin(Math.PI * Math.min(1, this._warpK || 0)) : 1;
    const height = clamp(base * this.zoomLevel * warpDip, 60, 3300);
    const cam = this.camera;
    if (snap) {
      cam.position.set(tx, height, tz);
    } else {
      cam.position.x = damp(cam.position.x, tx, 6, dt);
      cam.position.z = damp(cam.position.z, tz, 6, dt);
      cam.position.y = damp(cam.position.y, height, 3, dt);
    }
    if (this.shake > 0.01) {
      this.shake = Math.max(0, this.shake - dt * 2.6);
      const s = this.shake;
      cam.position.x += (Math.random() - 0.5) * s * 26;
      cam.position.z += (Math.random() - 0.5) * s * 26;
    }
    cam.lookAt(cam.position.x, 0, cam.position.z);
  }

  addShake(amount) {
    this.shake = Math.min(1.6, this.shake + amount);
  }

  /* ------------------------------------------------------------------ */
  /* Departure                                                          */
  /* ------------------------------------------------------------------ */

  dispose() {
    this.combat.clear();
    this.fx.clear();
    disposeScene(this.scene);
    this.ships = [];
  }
}
