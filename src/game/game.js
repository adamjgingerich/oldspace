// The Game controller: flight input, docking, trade actions, missions, saves.

import { GameState, computeStats, outfitInstallBlock, HOSTILE_REP } from './state.js';
import { Universe } from './universe.js';
import { audio } from '../core/audio.js';
import { input } from '../core/input.js';
import { SYSTEMS, laneAngle, RIM_RADIUS } from '../data/systems.js';
import { SHIP_BY_ID } from '../data/ships.js';
import { OUTFIT_BY_ID } from '../data/outfits.js';
import { WEAPON_BY_ID } from '../data/weapons.js';
import { COMMODITY_BY_ID } from '../data/commodities.js';
import { FACTIONS } from '../data/factions.js';
import { buyPrice, sellPrice, marketRows, tradeableAt } from './economy.js';
import * as missions from './missions.js';
import * as story from './story.js';
import * as sidequests from './sidequests.js';
import { saveToSlot, readSlot } from './saves.js';
import { planetInfo } from './planetSurvey.js';
import {
  addXp, addKarma, joinFaction, renounceFaction, learnSkill, combatMods, economyMods, levelFromXp,
} from './skills.js';
import { applyCharacter } from './character.js';
import { binds } from '../core/keybinds.js';
import { openKeybinds } from '../ui/keys.js';
import {
  addToFleet, removeFromFleet, entryByUid, fleetSellValue, freeEscortSlots, freeBays, nextFreeBay,
} from './fleet.js';
import { rngOf } from '../core/rng.js';
import { TWIST_INFO, HAILS, RELIC_OPENED } from '../data/voices.js';
import * as wormholes from './wormholes.js';
import * as expeditions from './expeditions.js';
import * as politics from './politics.js';
import { flashWarp } from '../ui/dom.js';
import { toggleFullscreen } from '../ui/fullscreen.js';
import { clamp, dist2 } from '../core/util.js';
import { storageGet, storageSet } from '../core/storage.js';

export const LUMEN_REFUEL_COST = 120;
export const REPAIR_COST_PER_HP = 2.8;
export const WORMHOLE_LUMEN_COST = 2;
export const WORMHOLE_LICENCE_COST = 400000;
export const LUMEN_COURIER_FEE_BASE = 100; // the courier's standing charge, before the tithe
export const LUMEN_COURIER_WEALTH_CUT = 0.06; // ...plus this slice of the purse, so it always stings
// Survey work pays in experience: a world's first reading is the big one,
// stars read deeper still, and fresh readings on a later day pay a little.
export const PLANET_SCAN_XP = 25;
export const STAR_SCAN_XP = 45;
export const RESCAN_XP = 6;
/** Surveys are a held reading: stay close and under this speed or the tape is lost. */
export const SCAN_SPEED_LIMIT = 45;
export const PLANET_SCAN_SECONDS = 2.2;
export const STAR_SCAN_SECONDS = 3;

/** What a lumen courier costs right now: ₡100 + the lumen, plus a cut of the purse. */
export function lumenCourierFee(state) {
  const raw = LUMEN_COURIER_FEE_BASE + LUMEN_REFUEL_COST + (state.credits || 0) * LUMEN_COURIER_WEALTH_CUT;
  return Math.round(raw / 100) * 100;
}

/** Late-game charters: owning worlds and stations, and the convoys that pay. */
const HOLDING_MIN_LEVEL = 12;
const HOLDING_MAX = 5;
const FREIGHTER_MAX = 6;
const PATROL_MAX = 4;

/** Selectable simulation speeds. The game ships at a deliberate ×0.5. */
export const TIME_STEPS = [0.5, 1, 2, 3, 4];

export class Game {
  constructor({ engine, ui }) {
    this.engine = engine;
    this.ui = ui; // { toasts, hud, dock, chart, menus }
    this.state = null;
    this.universe = null;
    this.mode = 'idle'; // idle | flight | docked | paused | computer | skills
    this.autosaveSlot = null;
    this.target = null;
    this.station = null;
    this.trackedMissionId = null; // the job whose course is plotted on the charts
    this.scanHold = null; // a held planet/star survey in progress
    this.pendingRespawn = false;
    this._lastShield = 0;
    this._lastHull = 0;
    this._hintTimer = 0;
    this.timeScale = TIME_STEPS[0];
    const saved = Number(storageGet('timescale'));
    if (TIME_STEPS.includes(saved)) this.timeScale = saved;
  }

  /** Step through the simulation speeds. dir 1 = faster, -1 = slower. */
  cycleTimeScale(dir = 1) {
    const idx = TIME_STEPS.indexOf(this.timeScale);
    const next = TIME_STEPS[(idx + dir + TIME_STEPS.length) % TIME_STEPS.length];
    this.timeScale = next;
    storageSet('timescale', String(next));
    if (this.isActive()) this.ui.toasts.push(`Simulation speed ×${next}.`, next === 0.5 ? '' : 'warn');
    this.ui.speed?.sync();
  }

  isActive() {
    return this.mode !== 'idle' && !!this.universe;
  }

  /** Fullscreen toggle with a note when the host browser refuses the request. */
  toggleFs() {
    toggleFullscreen().then((res) => {
      if (res && !res.ok && res.blocked) {
        this.ui.toasts.push('Fullscreen was blocked by the browser or embedded view — try the game in its own tab.', 'warn');
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Lifecycle                                                          */
  /* ------------------------------------------------------------------ */

  newGame({ commander, backgroundId, driveId, slot }) {
    const state = new GameState({ commander });
    const made = applyCharacter(state, backgroundId, driveId);
    const res = saveToSlot(slot, state);
    if (!res.ok) this.ui.toasts.push(res.error, 'bad');
    this.autosaveSlot = slot;
    this.begin(state);
    this.ui.toasts.push(`New log opened. Welcome to the lanes, ${state.commander}.`, 'good');
    this.ui.toasts.push(`${made.background.name} · ${made.drive.name} — your past is loaded; your future is not.`, '');
    this.hint('thrust', 'Hold W to burn, A / D to turn. You keep your momentum — lead your turns, and S kills your drift.');
  }

  loadGame(slotData) {
    const state = GameState.fromJSON(slotData.state);
    this.autosaveSlot = slotData.slot;
    this.begin(state);
    this.ui.toasts.push(`Loaded: ${state.commander} — day ${state.day}.`, 'good');
  }

  begin(state) {
    this.state = state;
    if (this.universe) this.universe.dispose();
    this.universe = new Universe(this.engine, state);
    this.universe.onEvent = (t, p) => this.onUniverseEvent(t, p);
    this.universe.load(state.systemId);
    this.mode = 'flight';
    this.target = null;
    this.station = null;
    this.trackedMissionId = null;
    this.scanHold = null;
    this.applyStatsToPlayer();
    this._lastShield = this.universe.player.shield;
    this._lastHull = this.universe.player.hull;
    this.ui.hud.show();
  }

  quitToTitle() {
    if (this.universe) this.universe.dispose();
    this.universe = null;
    this.state = null;
    this.mode = 'idle';
    this.ui.hud.hide();
    this.ui.dock.close();
    this.ui.computer.close();
    this.ui.menus.closeAll();
    this.onQuitToTitle?.();
  }

  /** Opened from the dock berth tab. */
  openSaveFromDock() {
    this.ui.menus.openSave({
      mode: 'save',
      onPick: (slot) => {
        this.save(slot);
        this.ui.menus.closeSave();
        this.ui.dock.refreshIfOpen();
      },
      onClose: () => {},
    });
  }

  /* ------------------------------------------------------------------ */
  /* Saving                                                             */
  /* ------------------------------------------------------------------ */

  save(slot, { silent = false } = {}) {
    if (!this.state || !this.universe) return { ok: false, error: 'No active adventure.' };
    const p = this.universe.player;
    this.state.pos = { x: p.x, z: p.z };
    this.state.heading = p.heading;
    this.state.integrity = { hull: p.hull, shield: p.shield };
    if (this.station) this.state.lastStation = { systemId: this.state.systemId, stationId: this.station.id };
    const res = saveToSlot(slot, this.state);
    if (res.ok && !silent) this.ui.toasts.push(`Adventure saved to slot ${slot}.`, 'good');
    if (!res.ok) this.ui.toasts.push(res.error, 'bad');
    return res;
  }

  autosave() {
    if (this.autosaveSlot) this.save(this.autosaveSlot, { silent: true });
  }

  /* ------------------------------------------------------------------ */
  /* Flight frame                                                       */
  /* ------------------------------------------------------------------ */

  update(dt) {
    if (!this.universe || !this.state) return;

    // UI-mode keys
    if (this.mode === 'planet') {
      if (input.wasPressed(binds.get('pause')) || input.wasPressed(binds.get('dock'))) this.closePlanet();
      this.ui.hud.update(this.hudContext());
      input.endFrame();
      return;
    }
    if (this.mode === 'docked') {
      if (input.wasPressed(binds.get('pause'))) this.undock();
      if (input.wasPressed(binds.get('fullscreen'))) this.toggleFs();
      if (input.wasPressed(binds.get('mute'))) audio.toggleMuted();
      this.ui.hud.update(this.hudContext());
      input.endFrame();
      return;
    }
    if (this.mode === 'paused') {
      if (input.wasPressed(binds.get('pause'))) this.resume();
      input.endFrame();
      return;
    }
    if (this.mode === 'computer') {
      if (input.wasPressed(binds.get('pause')) || input.wasPressed(binds.get('chart')) || input.wasPressed(binds.get('jump'))) this.closeComputer();
      input.endFrame();
      return;
    }
    if (this.mode === 'skills') {
      if (input.wasPressed(binds.get('pause')) || input.wasPressed(binds.get('skills'))) this.closeSkills();
      input.endFrame();
      return;
    }

    const p = this.universe.player;
    const st = this.state;

    if (p.alive) {
      // ---- helm ----
      let turn = 0;
      if (input.isDown(binds.get('turnLeft')) || input.isDown('ArrowLeft')) turn -= 1;
      if (input.isDown(binds.get('turnRight')) || input.isDown('ArrowRight')) turn += 1;
      p.turnInput = turn;
      p.throttleCmd = input.isDown(binds.get('thrust')) || input.isDown('ArrowUp') ? 1 : 0;
      p.brakeCmd = input.isDown(binds.get('brake')) || input.isDown('ArrowDown') ? 1 : 0;
      const burstKey = binds.get('burst');
      p.boostInput = input.isDown(burstKey)
        || (burstKey.startsWith('Shift') && (input.isDown('ShiftLeft') || input.isDown('ShiftRight')));

      // ---- view zoom: wheel & pinch flow through Input, keys as fallback ----
      let zd = input.consumeZoom();
      if (input.wasPressed(binds.get('zoomIn')) || input.wasPressed('NumpadAdd')) zd -= 0.4;
      if (input.wasPressed(binds.get('zoomOut')) || input.wasPressed('NumpadSubtract')) zd += 0.4;
      if (zd !== 0) this.universe.applyZoomDelta(zd);
      if (input.wasPressed(binds.get('fullscreen'))) this.toggleFs();
      if (input.wasPressed(binds.get('mute'))) audio.toggleMuted();

      // ---- guns ----
      const targetOk = this.target && this.target.alive
        && dist2(p.x, p.z, this.target.x, this.target.z) < 2800;
      if (!targetOk) this.target = null;
      if (input.isDown(binds.get('fire'))) {
        // every non-missile hardpoint fires together
        for (let s = 0; s < p.weapons.length; s++) {
          const w = WEAPON_BY_ID[p.weapons[s]];
          if (w && w.kind !== 'missile') this.universe.fireShip(p, s, this.target);
        }
      }
      if (input.wasPressed(binds.get('fireAlt'))) {
        for (let s = 0; s < p.weapons.length; s++) {
          const w = WEAPON_BY_ID[p.weapons[s]];
          if (!w) continue;
          if (w.kind === 'missile') {
            const ok = this.universe.fireShip(p, s, this.target);
            if (!ok && (st.ammo[p.weapons[s]] || 0) <= 0) {
              this.ui.toasts.push('Missile racks empty. Buy more at a station.', 'warn');
            }
          } else {
            this.universe.fireShip(p, s, this.target);
          }
        }
      }
      if (input.wasPressed(binds.get('target'))) this.cycleTarget();
      // the wing reads your lock for focus fire
      this.universe.playerTarget = this.target;
      // ---- fleet commands ----
      if (input.wasPressed(binds.get('scramble'))) this.actScramble();
      if (input.wasPressed(binds.get('recall'))) this.actRecallMinis();
      if (input.wasPressed(binds.get('focusFire'))) this.actFleetAttack();
      if (input.wasPressed(binds.get('regroup'))) this.actFleetRegroup();

      // ---- interactions ----
      if (input.wasPressed(binds.get('dock'))) {
        if (this.universe.nearStation) this.dock();
        else if (this.universe.nearWormhole) this.enterWormhole();
        else if (this.universe.nearPlanet) this.beginScan('planet');
        else if (this.universe.nearStar) this.beginScan('star');
      }
      if (input.wasPressed(binds.get('claim'))) this.actClaimPrize();
      // J and M both raise the ship's computer — one menu, no separate charts
      if (input.wasPressed(binds.get('jump')) || input.wasPressed(binds.get('chart'))) this.openComputer('map');
      if (input.wasPressed(binds.get('skills'))) this.openSkills();
      if (input.wasPressed(binds.get('pause'))) this.pause();
    }

    // ---- clock & time scale ----
    if (input.wasPressed(binds.get('speedUp'))) this.cycleTimeScale(1);
    if (input.wasPressed(binds.get('speedDown'))) this.cycleTimeScale(-1);
    const simDt = dt * this.timeScale;
    const dayChanged = st.tickClock(simDt);
    if (dayChanged) this.onDayChanged();
    this._updateScanHold(simDt);

    // ---- world (sub-stepped so fast modes cannot tunnel collisions) ----
    const steps = Math.max(1, Math.ceil(simDt / 0.035));
    const stepDt = simDt / steps;
    for (let i = 0; i < steps; i++) {
      this.universe.update(stepDt, i === steps - 1 ? dt : 0);
    }

    // ---- feedback: shake on damage ----
    const pl = this.universe.player;
    if (pl.alive) {
      const dmgTaken = (this._lastShield - pl.shield) + (this._lastHull - pl.hull);
      if (dmgTaken > 0.5) this.universe.addShake(clamp(dmgTaken * 0.05, 0, 0.9));
      this._lastShield = pl.shield;
      this._lastHull = pl.hull;
    }

    // ---- audio loops ----
    audio.setEngine(pl.alive ? Math.max(pl.throttleCmd, pl.brakeCmd * 0.3, pl.boostActive ? 1 : 0) : 0);

    // ---- respawn after death (deferred out of the sim loop) ----
    if (this.pendingRespawn) {
      this.pendingRespawn = false;
      this.respawn();
    }

    // ---- tutorial nudges ----
    this._hintTimer -= dt;
    if (this._hintTimer <= 0) {
      this._hintTimer = 4;
      this.pushContextHints();
    }

    // ---- HUD ----
    this.ui.hud.update(this.hudContext());
    input.endFrame();
  }

  pushContextHints() {
    const u = this.universe;
    if (!u || !u.player.alive) return;
    if (u.nearStation) this.hint('dock', 'Press E to dock — trade, refit, and take contracts.');
    if (u.nearPlanet) this.hint('scan', 'Press E to scan a planet — first surveys pay a bounty.');
    if (u.nearStar) this.hint('scanstar', 'Press E for deep-core readings on the star — first surveys pay XP.');
    if (!u.warpBlock) this.hint('warp', 'Press J in open space to warp a lane — one lumen per jump.');
    if (u.player.speed > 75) this.hint('burst', 'Hold SHIFT for an engine burst — a hard shove of thrust that recharges over time.');
    if (this.state.credits < 1500) this.hint('broke', 'Low on credits? Dock and check the Contracts board, or buy low and sell high.');
  }

  hint(key, text) {
    if (this.state?.hints?.[key]) return;
    if (this.state) this.state.hints[key] = true;
    this.ui.toasts.push(text, 'warn');
  }

  hudContext() {
    const u = this.universe;
    // the tracker drops stale ids — a handed-in job should not haunt the helm
    if (this.trackedMissionId && !this.state.missions.some((m) => m.id === this.trackedMissionId)) {
      this.trackedMissionId = null;
    }
    const prompt = this.currentPrompt();
    let scan = null;
    for (const b of u.beacons) {
      const m = this.state.missions.find((mm) => mm.id === b.missionId);
      if (!m || m.scanned) continue;
      if (dist2(b.x, b.z, u.player.x, u.player.z) < 460) {
        const need = m.type === 'relic' ? 5 : 3; // the cipher takes longer than a survey
        scan = { progress: clamp((u.scanTimers[b.missionId] || 0) / need, 0, 1), title: m.title };
      }
    }
    // a held planet/star survey shows its tape on the prompt line too
    if (!scan && this.scanHold) {
      scan = { progress: clamp(this.scanHold.t / this.scanHold.total, 0, 1), title: this.scanHold.label };
    }
    return {
      state: this.state,
      universe: u,
      player: u.player,
      system: u.system,
      target: this.target,
      prompt,
      scan,
      trackedMissionId: this.trackedMissionId,
      time: u.time,
    };
  }

  currentPrompt() {
    const u = this.universe;
    if (!u) return null;
    if (u.nearStation && u.player.speed < 30) {
      const ready = missions.completionsAt(this.state, this.state.systemId, u.nearStation.record.id).length;
      return { key: 'E', text: `Dock at ${u.nearStation.record.name}${ready ? ` — hand in ${ready} contract${ready === 1 ? '' : 's'}` : ''}` };
    }
    if (u.nearStation) {
      return { text: `Slow to 30 to dock at ${u.nearStation.record.name}`, warn: true };
    }
    if (u.nearWormhole?.discovered) {
      const dest = SYSTEMS[wormholes.farEnd(u.nearWormhole.record, u.systemId)].name;
      if (this.state.cargoUsed() > 0 && !this.state.wormholeLicence) {
        return { key: 'E', text: `Wormhole → ${dest} · cargo needs a shipping licence`, warn: true };
      }
      return { key: 'E', text: `Enter wormhole → ${dest} (${WORMHOLE_LUMEN_COST} lumen)` };
    }
    if (u.nearPlanet) {
      if (u.player.speed < SCAN_SPEED_LIMIT) return { key: 'E', text: `Scan ${u.nearPlanet.record.name} — hold close while the tape runs` };
      return { text: `Slow below ${SCAN_SPEED_LIMIT} to scan ${u.nearPlanet.record.name}`, warn: true };
    }
    if (u.nearStar) {
      if (u.player.speed < SCAN_SPEED_LIMIT) return { key: 'E', text: `Scan the ${u.system.name} star — hold close while the tape runs` };
      return { text: `Slow below ${SCAN_SPEED_LIMIT} to take deep-core readings`, warn: true };
    }
    const prize = this.nearestPrize();
    if (prize) return { key: 'C', text: `Claim the surrendered ${prize.def.name}` };
    if (!u.warpBlock) return { key: 'J', text: 'Warp — plot a lane' };
    if ((this.state.outfits?.warpplotter || 0) > 0) {
      return { text: `Warp dampened — ${Math.round(u.warpBlock.dist)} m to clear space`, warn: true };
    }
    return null;
  }

  cycleTarget() {
    const u = this.universe;
    const p = u.player;
    // any nearby contact can be held in the sights — hostile or not
    const candidates = u.ships
      .filter((s) => !s.isPlayer && s.role !== 'escort' && s.alive && dist2(p.x, p.z, s.x, s.z) < 2800)
      .sort((a, b) => dist2(p.x, p.z, a.x, a.z) - dist2(p.x, p.z, b.x, b.z));
    if (candidates.length === 0) {
      this.target = null;
      return;
    }
    const idx = candidates.indexOf(this.target);
    this.target = candidates[(idx + 1) % candidates.length];
    audio.ui();
  }

  /* ------------------------------------------------------------------ */
  /* Universe events                                                    */
  /* ------------------------------------------------------------------ */

  onUniverseEvent(type, payload) {
    switch (type) {
      case 'wormholeFound': {
        const h = payload.hole;
        this.ui.toasts.push(`Anomaly mapped — a wormhole links ${SYSTEMS[h.a].name} and ${SYSTEMS[h.b].name}.`, 'good');
        this.hint('wormhole', 'Wormholes bridge whole stretches of the Reach. Personal transit flies free — moving trade cargo through takes a Consortium shipping licence.');
        this.autosave();
        break;
      }
      case 'lumenDelivered': {
        audio.coin();
        this.ui.toasts.push('Lumen delivered — one charge aboard. Enough to run a lane.', 'good');
        this.autosave();
        break;
      }
      case 'courierDepart': {
        audio.warp();
        flashWarp();
        break;
      }
      case 'playerDestroyed':
        this.pendingRespawn = true;
        break;
      case 'shipSurrendered':
        this.ui.toasts.push(`A ${payload.ship.def.name} strikes its colours — close alongside and press C to claim the prize.`, 'good');
        this.hint('prize', 'Claimed prizes need a free escort slot or docking bay — otherwise the hulk is stripped for salvage credits.');
        break;
      case 'hullSighted': {
        const def = SHIP_BY_ID[payload.shipId];
        if (def) this.ui.toasts.push(`New hull sighted: ${def.name} — filed in the ship's log.`, 'good');
        break;
      }
      case 'pickup':
        this.ui.toasts.push(payload.text, 'good');
        break;
      case 'surveyScanned': {
        const m = payload.mission;
        const where = m
          ? `${missions.missionStationName(m.issuer.systemId, m.issuer.stationId)}, ${SYSTEMS[m.issuer.systemId]?.name}`
          : 'the issuing station';
        this.ui.toasts.push(`Survey recorded \u2014 RETURN to ${where} to file it.`, 'good');
        audio.coin();
        break;
      }
      case 'relicScanned': {
        const m = payload.mission;
        const relic = m?.relic;
        if (!relic) break;
        const st = this.state;
        if (!st.story.unlocked.includes(relic.itemId)) st.story.unlocked.push(relic.itemId);
        const done = missions.finishMission(st, m);
        const paid = done.rewardAwarded ?? done.reward;
        this.ui.toasts.push(rngOf(st.worldSeed, 'relicopen', m.id).pick(RELIC_OPENED), 'good');
        this.ui.toasts.push(
          `Relic recovered — ${relic.itemName} (band ${['', 'I', 'II', 'III'][relic.band] || 'I'}). `
          + `The collector pays ₡${paid.toLocaleString()}; any mechanic will fit the find now.`,
          'good',
        );
        st.stats.relics = (st.stats.relics || 0) + 1;
        this._xp(Math.max(20, Math.round(paid / 250)));
        audio.coin();
        this.autosave();
        this.ui.dock.refreshIfOpen();
        break;
      }
      case 'missionTwist': {
        const info = TWIST_INFO[payload.kind];
        if (info?.arrival) this.ui.toasts.push(info.arrival, 'warn');
        if (payload.kind === 'rival' && payload.ship) {
          this.ui.toasts.push(`${payload.ship.name} is on the scope — the same prize, a worse temper.`, 'warn');
        }
        break;
      }
      case 'shipHail': {
        const ship = payload.ship;
        const pool = ship.role === 'bounty' ? HAILS.rival : HAILS.pirate;
        const line = pool[Math.floor(Math.random() * pool.length)];
        this.ui.toasts.push(`${ship.name}: “${line}”`, 'warn');
        break;
      }
      case 'bountyContractComplete': {
        const m = missions.findMission(this.state, payload.missionId);
        if (m) {
          const done = missions.finishMission(this.state, m);
          const paid = done.rewardAwarded ?? done.reward;
          this.ui.toasts.push(`Contract complete — ${done.title}. +₡${paid.toLocaleString()}`, 'good');
          if (done.outro) this.ui.toasts.push(done.outro, '');
          this._xp(Math.max(10, Math.round(paid / 300)));
          audio.coin();
          if (done.storyResult) this._storyToasts(done.storyResult);
          if (done.sideResult) this._sideToasts(done.sideResult);
        }
        break;
      }
      case 'bountyMarkLost': {
        const m = missions.findMission(this.state, payload.missionId);
        if (m) this.ui.toasts.push(`${m.title}: the office reports your mark was destroyed by another hand \u2014 a fresh lead is being cut.`, 'warn');
        break;
      }
      case 'raiderKill': {
        // sweep contracts count kills in their target system
        const res = missions.noteRaiderKill(this.state, payload.systemId, payload.role);
        for (const u of res.updated) {
          if (u.complete) continue;
          this.ui.toasts.push(`${u.mission.title} — ${u.mission.kills.got}/${u.mission.kills.need}.`, 'good');
        }
        for (const m of res.completed) {
          const done = missions.finishMission(this.state, m);
          if (!done) continue;
          const paid = done.rewardAwarded ?? done.reward;
          this.ui.toasts.push(`Sweep complete — ${done.title}. +₡${paid.toLocaleString()}`, 'good');
          if (done.outro) this.ui.toasts.push(done.outro, '');
          this._xp(Math.max(10, Math.round(paid / 300)));
          audio.coin();
          if (done.storyResult) this._storyToasts(done.storyResult);
          if (done.sideResult) this._sideToasts(done.sideResult);
          this.ui.dock.refreshIfOpen();
        }
        break;
      }
      case 'missionPod': {
        const res = missions.notePodTaken(this.state, payload.missionId, payload.index);
        if (res) {
          const where = `${missions.missionStationName(res.mission.issuer.systemId, res.mission.issuer.stationId)}, ${SYSTEMS[res.mission.issuer.systemId]?.name}`;
          this.ui.toasts.push(
            res.complete
              ? `All recorder pods aboard (${res.got}/${res.need}) \u2014 RETURN to ${where} to deliver them.`
              : `Recorder pod recovered (${res.got}/${res.need}).`,
            'good',
          );
          this.ui.dock.refreshIfOpen();
        }
        break;
      }
      case 'xpGain':
        if (payload.levels > 0) {
          this.ui.toasts.push(
            `Level ${payload.level}! +${payload.points} skill point${payload.points > 1 ? 's' : ''} — open the Career tab at any station.`,
            'good',
          );
        }
        break;
      case 'npcDestroyed': {
        const killer = payload.killer;
        if (killer === this.universe.player) {
          this.ui.toasts.push(`${payload.ship.name} destroyed.`, 'good');
        }
        break;
      }
      case 'traderKill':
        this.ui.toasts.push('You have killed a merchant crew. The lanes will remember.', 'bad');
        break;
      case 'navyKill':
        this.ui.toasts.push('You have fired on the Vigil. Patrols will answer.', 'bad');
        break;
      case 'houseKill':
        this.ui.toasts.push('You have spilled House blood. The Kreth are patient accountants.', 'bad');
        break;
      case 'fleetShipLost':
        this.ui.toasts.push(`${payload.ship.name} is gone. The wing is one shorter.`, 'bad');
        this.autosave();
        this.ui.dock.refreshIfOpen();
        break;
      case 'fleetDocked':
        this.ui.toasts.push(`${payload.name} docked in the cradles.`, 'good');
        this.ui.dock.refreshIfOpen();
        break;
      default:
        break;
    }
  }

  onDayChanged() {
    const failed = missions.failOverdue(this.state);
    for (const f of failed) {
      this.ui.toasts.push(`Contract overdue: ${f.mission.title} (${f.reason}).`, 'bad');
    }
    if (failed.length) this.ui.dock.refreshIfOpen();
    // old grudges cool — a name can always be mended
    const mended = this.state.mendRep();
    for (const faction of mended) {
      this.ui.toasts.push(`Word travels: ${FACTIONS[faction].name} no longer counts you hunted.`, 'good');
    }
    this._settleHoldings();
    this._settleExpeditions();
    for (const e of politics.tickPolitics(this.state)) {
      this.ui.toasts.push(e.text, e.kind);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Docking                                                            */
  /* ------------------------------------------------------------------ */

  dock() {
    const u = this.universe;
    const st = u.nearStation;
    if (!st || !u.player.alive) return;
    const owner = st.record.owner;
    const rep = this.state.rep[owner] ?? 0;
    if (owner !== 'free' && rep <= HOSTILE_REP) {
      // even a hunted captain delivers — contract business earns a grudging berth
      const writ = missions.completionsAt(this.state, this.state.systemId, st.record.id).length > 0;
      if (!writ) {
        this.ui.toasts.push(`${st.record.name} refuses you: ${FACTIONS[owner].name} has marked you hunted.`, 'bad');
        this.hint('hunted', 'A hunted name mends: clear their enemies from the lanes for their goodwill, and old records fade a little every day.');
        return;
      }
      this.ui.toasts.push(`${st.record.name} opens a berth under contract writ — ${FACTIONS[owner].name} still wants your hull.`, 'warn');
    }
    this.mode = 'docked';
    this.station = st.record;
    this.state.lastStation = { systemId: this.state.systemId, stationId: st.record.id };
    audio.dock();
    const p = u.player;
    p.vx *= 0.1;
    p.vz *= 0.1;
    this.autosave();
    this.ui.dock.open(this.dockContext());
    input.reset();
  }

  undock() {
    if (this.mode !== 'docked') return;
    const u = this.universe;
    this.mode = 'flight';
    this.ui.dock.close();
    audio.undock();
    const p = u.player;
    // drift out of the dock gently
    const away = Math.atan2(p.x - this._dockedStationPos().x, p.z - this._dockedStationPos().z);
    p.heading = away;
    p.vx = Math.sin(away) * 30;
    p.vz = Math.cos(away) * 30;
    this.applyStatsToPlayer();
    this.autosave();
    input.reset();
    this.station = null;
  }

  _dockedStationPos() {
    const u = this.universe;
    const st = u.stations.find((s) => s.record === this.station);
    return st || { x: 0, z: 0 };
  }

  applyStatsToPlayer() {
    const u = this.universe;
    if (!u) return;
    const stats = computeStats(this.state);
    const p = u.player;
    p.stats = stats;
    p.hull = clamp(p.hull, 1, stats.hull);
    p.shield = clamp(p.shield, 0, stats.shield);
    p.energy = clamp(p.energy, 0, stats.energy);
    this.state.lumen = clamp(this.state.lumen, 0, stats.lumenMax);
    // skill-driven combat modifiers
    const cm = combatMods(this.state);
    p.dmgMult = 1 + cm.dmg;
    p.dmgTakenMult = Math.max(0.5, 1 - cm.dmgTaken);
    // auto-tracking computer: wider gun arc, tighter spread
    const tl = this.state.outfits?.targeting || 0;
    p.trackCone = tl === 0 ? 0.5 : [0.5, 1.05, 2.1, Math.PI][Math.min(tl, 3)];
    p.spreadMult = tl === 0 ? 1 : [1, 0.8, 0.65, 0.5][Math.min(tl, 3)];
  }

  /** Award XP and celebrate level-ups. */
  _xp(amount) {
    const res = addXp(this.state, amount);
    if (res.levels > 0) {
      this.ui.toasts.push(
        `Level ${res.level}! +${res.points} skill point${res.points > 1 ? 's' : ''} — press K for the skill tree, or open the Skills tab at any station.`,
        'good',
      );
    }
    this.ui.skillBtn?.sync();
    return res;
  }

  /** Celebrate a settled story chapter. */
  _storyToasts(res) {
    this.ui.toasts.push(`Story · ${res.lineName} — chapter ${res.chapter} complete.`, 'good');
    for (const line of res.rewards) this.ui.toasts.push(line, 'good');
    if (res.complete) this.ui.toasts.push(`${res.lineName} is finished. The gear is in the shops; the story is yours.`, 'good');
    this.ui.dock.refreshIfOpen();
  }

  /** Side-chain step settled, or a whole chain closed out. */
  _sideToasts(res) {
    if (res.done) {
      this.ui.toasts.push(`Side work complete — ${res.name}.`, 'good');
      for (const line of res.rewards) this.ui.toasts.push(line, 'good');
    } else {
      this.ui.toasts.push(`${res.name}: next step — “${res.nextTitle}”. Check the notices at any station.`, '');
    }
    this.ui.dock.refreshIfOpen();
  }

  /* ------------------------------------------------------------------ */
  /* Station actions                                                    */
  /* ------------------------------------------------------------------ */

  dockContext() {
    const st = this.station;
    const system = SYSTEMS[this.state.systemId];
    return {
      state: this.state,
      system,
      systemId: this.state.systemId,
      station: st,
      actions: this,
    };
  }

  actBuy(cid, qty = 1) {
    const st = this.state;
    const station = this.station;
    if (!station || !tradeableAt(station, cid)) return;
    const price = buyPrice(st, st.systemId, cid);
    const cost = price * qty;
    if (cost > st.credits) {
      this.ui.toasts.push('Not enough credits.', 'warn');
      return;
    }
    if (st.cargoFree() < qty) {
      this.ui.toasts.push('Not enough free cargo space.', 'warn');
      return;
    }
    st.addCredits(-cost);
    st.addCargo(cid, qty);
    audio.ui();
    this.ui.dock.refreshIfOpen();
  }

  actSell(cid, qty = 1) {
    const st = this.state;
    const station = this.station;
    if (!station || !tradeableAt(station, cid)) return;
    const have = st.cargo[cid] || 0;
    const n = Math.min(qty, have);
    if (n <= 0) return;
    const price = sellPrice(st, st.systemId, cid);
    st.removeCargo(cid, n);
    st.addCredits(price * n);
    if (COMMODITY_BY_ID[cid]?.illegal) addKarma(st, -1);
    audio.coin();
    this.ui.dock.refreshIfOpen();
  }

  actSellAll(cid) {
    this.actSell(cid, this.state.cargo[cid] || 0);
  }

  actBuyOutfit(id) {
    const st = this.state;
    const outfit = OUTFIT_BY_ID[id];
    if (!outfit) return;
    const block = outfitInstallBlock(st, id);
    if (block) {
      this.ui.toasts.push(block, 'warn');
      return;
    }
    const level = st.outfits[id] || 0;
    if (level >= outfit.prices.length) {
      this.ui.toasts.push('That upgrade is already at maximum.', 'warn');
      return;
    }
    const price = outfit.prices[level];
    if (price > st.credits) {
      this.ui.toasts.push('Not enough credits.', 'warn');
      return;
    }
    st.addCredits(-price);
    st.outfits[id] = level + 1;
    if (this.universe) this.rebuildPlayerShip(true);
    else this.applyStatsToPlayer();
    audio.coin();
    this.ui.toasts.push(`${outfit.name} installed (level ${level + 1}).`, 'good');
    this.ui.dock.refreshIfOpen();
  }

  /* ------------------------------------------------------------------ */
  /* Holdings: charters over worlds and stations                        */
  /* ------------------------------------------------------------------ */

  /**
   * The charter asset in a system. A planet spacedock — an orbital yard fed by
   * the world below — is the richest prize; else the primary station; else the
   * main world itself.
   */
  holdingAsset(sysId) {
    const sys = SYSTEMS[sysId];
    const dock = (sys?.stations || []).find((s) => s.type === 'spacedock');
    if (dock) return { kind: 'spacedock', name: dock.name, owner: dock.owner || sys.gov };
    const st = sys?.stations?.[0];
    if (st) return { kind: 'station', name: st.name, owner: st.owner || sys.gov };
    const pl = (sys?.planets || []).find((p) => p.type !== 'moon') || sys?.planets?.[0];
    return { kind: 'planet', name: pl ? pl.name : `${sys.name} prime`, owner: sys.gov };
  }

  holdingPrice(sysId) {
    const sys = SYSTEMS[sysId];
    if (!sys) return 0;
    const asset = this.holdingAsset(sysId);
    const base = asset.kind === 'spacedock' ? 2100000 : asset.kind === 'station' ? 850000 : 1350000;
    const techF = 0.7 + sys.tech * 0.09;
    const safeF = 1.6 - sys.danger.pirates * 0.75;
    const jitter = 0.92 + rngOf(this.state.worldSeed, 'charter', sysId).float(0, 1) * 0.16;
    let price = base * techF * safeF * jitter;
    if ((this.state.rep[asset.owner] ?? 0) < 40) price *= 1.6; // the locals need convincing
    return Math.round(price / 1000) * 1000;
  }

  holdingIncomePerDay(sysId) {
    const h = this.state.holdings?.[sysId];
    if (!h) return 0;
    const sys = SYSTEMS[sysId];
    const kindF = h.asset === 'spacedock' ? 1.35 : h.asset === 'planet' ? 1.15 : 1;
    const whF = this.state.wormholeLicence && wormholes.holeInSystem(this.state, sysId) ? 1.25 : 1;
    const per = Math.round((700 + sys.tech * 220) * (1.35 - sys.danger.pirates * 0.7) * kindF * whF);
    return per * (h.units?.freighter || 0);
  }

  freighterCost(sysId) {
    const n = this.state.holdings?.[sysId]?.units?.freighter || 0;
    return Math.round((90000 * (1 + 0.55 * n)) / 1000) * 1000;
  }

  patrolCost(sysId) {
    const n = this.state.holdings?.[sysId]?.units?.patrol || 0;
    return Math.round((120000 * (1 + 0.6 * n)) / 1000) * 1000;
  }

  /** Why a charter cannot be signed right now — or null if it can. */
  holdingBlock(sysId) {
    const st = this.state;
    const sys = SYSTEMS[sysId];
    if (!sys) return 'Unknown system.';
    if (st.holdings?.[sysId]) return 'Already yours.';
    if (!st.visited?.[sysId]) return 'Beyond your charts — fly there first.';
    if (levelFromXp(st.xp || 0) < HOLDING_MIN_LEVEL) return `Requires level ${HOLDING_MIN_LEVEL}.`;
    if (Object.keys(st.holdings || {}).length >= HOLDING_MAX) return `The Concord allows no more than ${HOLDING_MAX} charters.`;
    if ((st.credits || 0) < this.holdingPrice(sysId)) return 'Not enough credits.';
    return null;
  }

  actBuyHolding(sysId) {
    const block = this.holdingBlock(sysId);
    if (block) {
      this.ui.toasts.push(block, 'warn');
      return;
    }
    const st = this.state;
    const price = this.holdingPrice(sysId);
    const asset = this.holdingAsset(sysId);
    st.addCredits(-price);
    st.holdings[sysId] = { asset: asset.kind, units: { freighter: 0, patrol: 0 }, day: st.day };
    audio.coin();
    this.ui.toasts.push(`Charter signed: ${asset.name} now flies your colours.`, 'good');
    this.hint('holdings', 'Commission freighters at your holding for daily income — patrol cutters keep the raiders away.');
    this.autosave();
    this.ui.dock.refreshIfOpen();
  }

  actCommissionUnit(sysId, kind) {
    const st = this.state;
    const h = st.holdings?.[sysId];
    if (!h) {
      this.ui.toasts.push('You do not hold that charter.', 'warn');
      return;
    }
    h.units = h.units || { freighter: 0, patrol: 0 };
    if (kind === 'freighter') {
      if (h.units.freighter >= FREIGHTER_MAX) {
        this.ui.toasts.push(`That holding already flies ${FREIGHTER_MAX} freighters.`, 'warn');
        return;
      }
      const cost = this.freighterCost(sysId);
      if (st.credits < cost) {
        this.ui.toasts.push('Not enough credits.', 'warn');
        return;
      }
      st.addCredits(-cost);
      h.units.freighter += 1;
      audio.coin();
      this.ui.toasts.push(`Freighter commissioned at ${SYSTEMS[sysId].name} (${h.units.freighter}/${FREIGHTER_MAX}).`, 'good');
    } else if (kind === 'patrol') {
      if (h.units.patrol >= PATROL_MAX) {
        this.ui.toasts.push(`That holding already flies ${PATROL_MAX} patrol cutters.`, 'warn');
        return;
      }
      const cost = this.patrolCost(sysId);
      if (st.credits < cost) {
        this.ui.toasts.push('Not enough credits.', 'warn');
        return;
      }
      st.addCredits(-cost);
      h.units.patrol += 1;
      audio.coin();
      this.ui.toasts.push(`Patrol cutter commissioned at ${SYSTEMS[sysId].name} (${h.units.patrol}/${PATROL_MAX}).`, 'good');
    }
    this.autosave();
    this.ui.dock.refreshIfOpen();
  }

  /** Daily reckoning for every holding: convoys earn, raiders prowl. */
  _settleHoldings() {
    const st = this.state;
    const entries = Object.entries(st.holdings || {});
    if (!entries.length) return;
    let income = 0;
    const events = [];
    for (const [sysId, h] of entries) {
      const sys = SYSTEMS[sysId];
      if (!sys) continue;
      const patrols = h.units?.patrol || 0;
      let day = this.holdingIncomePerDay(sysId);
      const raid = sys.danger.pirates * 0.5 * Math.max(0.15, 1 - 0.18 * patrols);
      if (Math.random() < raid) {
        if (patrols > 0 && Math.random() < 0.75) {
          events.push({ t: `Your cutters drove a raid off ${sys.name}.`, k: 'good' });
        } else if ((h.units?.freighter || 0) > 0) {
          h.units.freighter -= 1;
          events.push({ t: `Reaver raiders caught your convoy at ${sys.name} — one freighter lost.`, k: 'bad' });
        }
      } else if (day > 0 && Math.random() < 0.12) {
        const bonus = Math.round(day * 0.6);
        day += bonus;
        events.push({ t: `Boom market at ${sys.name}: convoys earned +\u20a1${bonus.toLocaleString()}.`, k: 'good' });
      }
      income += day;
    }
    if (income > 0) {
      st.addCredits(income);
      this.ui.toasts.push(`Holdings payday: +\u20a1${income.toLocaleString()}.`, 'good');
    }
    for (const e of events.slice(0, 2)) this.ui.toasts.push(e.t, e.k);
  }

  /* Fleet expeditions: your hulls run the lanes while you take the credit. */

  _settleExpeditions() {
    const st = this.state;
    if (!st.fleet?.some((e) => e.status === 'away')) return;
    const survivors = [];
    let settled = false;
    for (const e of st.fleet) {
      if (e.status === 'away' && e.away && st.day >= e.away.returnDay) {
        settled = true;
        const res = expeditions.settleExpedition(st, e);
        if (!res.lost) survivors.push(e);
        if (res.xp) {
          const r = addXp(st, res.xp);
          if (r.levels > 0) this.ui.toasts.push(`Level ${r.level} — the fleet work has taught you well. +${r.levels} skill point${r.levels > 1 ? 's' : ''}.`, 'good');
        }
        this.ui.toasts.push(res.text, res.kind);
      } else {
        survivors.push(e);
      }
    }
    if (settled) {
      st.fleet = survivors;
      this.autosave();
      this.ui.dock.refreshIfOpen();
    }
  }

  expeditionTypes() { return expeditions.EXPEDITION_TYPES; }

  expeditionDestinations(sysId) { return expeditions.expeditionDestinations(this.state, sysId); }

  availableExpeditionShips() { return expeditions.availableExpeditionShips(this.state); }

  expeditionBlock(shipUid, fromSysId, type, destSysId) {
    return expeditions.expeditionBlock(this.state, shipUid, fromSysId, type, destSysId);
  }

  actDispatchExpedition(shipUid, fromSysId, type, destSysId) {
    const res = expeditions.dispatchExpedition(this.state, shipUid, fromSysId, type, destSysId);
    if (!res.ok) {
      this.ui.toasts.push(res.error, 'warn');
      return;
    }
    audio.ui();
    this.ui.toasts.push(`${res.entry.name} is away — a ${res.label} to ${res.destName}. Back by day ${res.returnDay}.`, 'good');
    this.autosave();
    this.ui.dock.refreshIfOpen();
  }

  actEquipWeapon(weaponId, slot) {
    const st = this.state;
    const weapon = WEAPON_BY_ID[weaponId];
    if (!weapon) return;
    const stats = computeStats(st);
    if (slot >= stats.mounts) {
      this.ui.toasts.push('No hardpoint there — this hull carries fewer mounts.', 'warn');
      return;
    }
    const current = st.weapons[slot];
    if (current === weaponId && weapon.kind !== 'missile') {
      this.ui.toasts.push('That weapon is already in that hardpoint.', 'warn');
      return;
    }
    let cost = weapon.price;
    let refund = 0;
    if (current && current !== weaponId) {
      const old = WEAPON_BY_ID[current];
      if (old) refund = Math.round(old.price * 0.5);
    } else if (current === weaponId && weapon.kind === 'missile') {
      cost = 0; // buying more racks handled by actBuyAmmo
    }
    if (cost - refund > st.credits) {
      this.ui.toasts.push('Not enough credits.', 'warn');
      return;
    }
    st.addCredits(-(cost - refund));
    if (current && current !== weaponId && WEAPON_BY_ID[current]?.kind === 'missile') {
      st.ammo[current] = 0;
    }
    st.weapons[slot] = weaponId;
    if (weapon.kind === 'missile') {
      st.ammo[weaponId] = Math.min(weapon.maxAmmo, (st.ammo[weaponId] || 0) + weapon.rack);
    }
    // ship firepower lives on the ship entity too
    this.universe.player.weapons = st.weapons;
    this.universe.player.ammo = st.ammo;
    // and the hull shows what is bolted to it
    this.rebuildPlayerShip(true);
    audio.coin();
    this.ui.toasts.push(`${weapon.name} mounted to hardpoint ${slot + 1}.`, 'good');
    this.ui.dock.refreshIfOpen();
  }

  actBuyAmmo(weaponId, racks = 1) {
    const st = this.state;
    const weapon = WEAPON_BY_ID[weaponId];
    if (!weapon || weapon.kind !== 'missile') return;
    const perRack = weapon.rack;
    const current = st.ammo[weaponId] || 0;
    const canTake = Math.floor((weapon.maxAmmo - current) / perRack);
    const n = Math.min(racks, canTake);
    if (n <= 0) {
      this.ui.toasts.push('Your racks are full.', 'warn');
      return;
    }
    const cost = n * (weapon.price / 4) | 0;
    if (cost > st.credits) {
      this.ui.toasts.push('Not enough credits.', 'warn');
      return;
    }
    st.addCredits(-cost);
    st.ammo[weaponId] = current + n * perRack;
    audio.coin();
    this.ui.dock.refreshIfOpen();
  }

  actBuyShip(shipId) {
    const st = this.state;
    const def = SHIP_BY_ID[shipId];
    if (!def) return;
    const block = this._shipBuyBlock(def);
    if (block) {
      this.ui.toasts.push(block, 'warn');
      return;
    }
    if (def.id === st.shipId) {
      this.ui.toasts.push('That is already your ship.', 'warn');
      return;
    }
    const oldDef = SHIP_BY_ID[st.shipId];
    const tradein = Math.round((oldDef?.price || 0) * 0.7);
    const net = def.price - tradein;
    if (net > st.credits) {
      this.ui.toasts.push(`Not enough credits (need ₡${net.toLocaleString()} after trade-in).`, 'warn');
      return;
    }
    const newCap = computeStats({ ...st.toJSON(), shipId }).cargo;
    if (st.cargoUsed() > newCap) {
      this.ui.toasts.push(`Cargo too large for the ${def.name} (${st.cargoUsed()}/${newCap}). Sell some crates first.`, 'warn');
      return;
    }
    st.addCredits(-net);
    st.shipId = shipId;
    st.integrity = { hull: null, shield: null };
    this.noteSighting(shipId, 'yard');
    // hardpoints follow the hull's mounts
    const mountCap = Math.max(2, def.mounts ?? 2);
    st.weapons = st.weapons.slice(0, mountCap);
    while (st.weapons.length < mountCap) st.weapons.push(null);
    audio.dock();
    this.ui.toasts.push(`You take command of the ${def.name}.`, 'good');
    // rebuild the player's model in place
    this.rebuildPlayerShip();
    this.ui.dock.refreshIfOpen();
  }

  rebuildPlayerShip(carry = false) {
    const u = this.universe;
    const old = u.player;
    const def = SHIP_BY_ID[this.state.shipId];
    const NewShip = old.constructor;
    const stats = computeStats(this.state);
    const ship = new NewShip({
      def,
      stats,
      scene: u.scene,
      x: old.x,
      z: old.z,
      heading: old.heading,
      faction: 'free',
      isPlayer: true,
      name: this.state.shipName,
      role: 'player',
      loadout: {
        weapons: this.state.weapons,
        outfits: this.state.outfits,
        mountCap: stats.mounts,
        showEmpty: true,
      },
    });
    if (carry) {
      // keep the ship's condition through outfit / weapon refits
      ship.hull = clamp(old.hull, 1, ship.stats.hull);
      ship.shield = clamp(old.shield, 0, ship.stats.shield);
      ship.energy = clamp(old.energy, 0, ship.stats.energy);
      ship.vx = old.vx;
      ship.vz = old.vz;
    }
    ship.weapons = this.state.weapons;
    ship.ammo = this.state.ammo;
    u.scene.remove(old.group);
    const idx = u.ships.indexOf(old);
    if (idx >= 0) u.ships[idx] = ship;
    u.player = ship;
    this.target = null;
    this._lastShield = ship.shield;
    this._lastHull = ship.hull;
    this.applyStatsToPlayer();
  }

  actRefuel(fill = true) {
    const st = this.state;
    const stats = computeStats(st);
    if (st.lumen >= stats.lumenMax) {
      this.ui.toasts.push('Lumen tanks are full.', 'warn');
      return;
    }
    const missing = stats.lumenMax - st.lumen;
    const cost = missing * LUMEN_REFUEL_COST;
    if (cost > st.credits) {
      this.ui.toasts.push('Not enough credits for a full refill.', 'warn');
      return;
    }
    st.addCredits(-cost);
    st.lumen = stats.lumenMax;
    audio.coin();
    this.ui.toasts.push(`Tanks filled: ${missing} lumen for ₡${cost.toLocaleString()}.`, 'good');
    this.ui.dock.refreshIfOpen();
  }

  actRepair() {
    const st = this.state;
    const p = this.universe.player;
    const stats = computeStats(st);
    const missing = Math.ceil(stats.hull - p.hull);
    if (missing <= 0) {
      this.ui.toasts.push('Your hull is already sound.', 'warn');
      return;
    }
    const cost = Math.round(missing * REPAIR_COST_PER_HP * economyMods(st).repair);
    if (cost > st.credits) {
      this.ui.toasts.push(`Full repair costs ₡${cost.toLocaleString()} — you cannot afford it.`, 'warn');
      return;
    }
    st.addCredits(-cost);
    p.hull = stats.hull;
    this.ui.toasts.push(`Hull repaired for ₡${cost.toLocaleString()}.`, 'good');
    audio.coin();
    this.ui.dock.refreshIfOpen();
  }

  /* ------------------------------------------------------------------ */
  /* Wormholes: long-range transit and the Consortium licence           */
  /* ------------------------------------------------------------------ */

  /** Fly into a mapped wormhole: many lanes at once, for a bite of lumen. */
  enterWormhole() {
    const u = this.universe;
    const st = this.state;
    const w = u?.nearWormhole;
    if (!w || !w.discovered || this.mode !== 'flight') return;
    if (st.cargoUsed() > 0 && !st.wormholeLicence) {
      this.ui.toasts.push('Commercial transit refused — the Wormhole Consortium requires a shipping licence to move trade cargo. Personal, empty-hold passage flies free.', 'bad');
      this.hint('wormlic', 'The Wormhole Consortium shipping licence is sold in the Berth at any station — with it, cargo and convoys may cross the holes.');
      return;
    }
    if (st.lumen < WORMHOLE_LUMEN_COST) {
      this.ui.toasts.push(`A wormhole crossing drinks ${WORMHOLE_LUMEN_COST} lumen — the coils are too dry.`, 'warn');
      return;
    }
    const hole = w.record;
    const to = wormholes.farEnd(hole, st.systemId);
    st.lumen -= WORMHOLE_LUMEN_COST;
    st.stats.jumps++;
    st.wormholes[hole.id] = true; // you went through it — it is charted now
    this._xp(6);
    audio.warp();
    flashWarp();
    this.mode = 'warp';
    window.setTimeout(() => {
      const mouth = wormholes.holePos(hole, to);
      const out = Math.atan2(mouth.z, mouth.x);
      const entry = { x: mouth.x + Math.cos(out) * 330, z: mouth.z + Math.sin(out) * 330 };
      st.systemId = to;
      st.pos = { ...entry };
      const heading = Math.atan2(entry.x - mouth.x, entry.z - mouth.z);
      st.heading = heading;
      this.universe.load(to, { entry, playerHeading: heading });
      this.applyStatsToPlayer();
      this._lastShield = this.universe.player.shield;
      this._lastHull = this.universe.player.hull;
      this.target = null;
      this.mode = 'flight';
      this.autosave();
      this.ui.toasts.push(`The hole spits you out at ${SYSTEMS[to].name} — the lanes never saw you coming.`, 'good');
    }, 650);
  }

  /** The Consortium licence: expensive, and it buys commercial transit. */
  actBuyWormholeLicence() {
    const st = this.state;
    if (st.wormholeLicence) {
      this.ui.toasts.push('You already hold the shipping licence.', 'warn');
      return;
    }
    if (st.credits < WORMHOLE_LICENCE_COST) {
      this.ui.toasts.push(`The licence costs ₡${WORMHOLE_LICENCE_COST.toLocaleString()} — not enough credits.`, 'warn');
      return;
    }
    st.addCredits(-WORMHOLE_LICENCE_COST);
    st.wormholeLicence = true;
    audio.coin();
    this.ui.toasts.push('Shipping licence issued — cargo may cross the holes, and convoys at wormhole systems earn +25%.', 'good');
    this.autosave();
    this.ui.dock.refreshIfOpen();
  }

  /** Stranded without lumen? Summon a courier to fold in and hand one over. */
  actCallLumenCourier() {
    const st = this.state;
    const u = this.universe;
    if (!u) return;
    if (u.courier) {
      this.ui.toasts.push('A courier is already folding in — hold position.', 'warn');
      return;
    }
    const stats = computeStats(st);
    if (st.lumen >= stats.lumenMax) {
      this.ui.toasts.push('Lumen tanks are already full.', 'warn');
      return;
    }
    const fee = lumenCourierFee(st);
    if (st.credits < fee) {
      this.ui.toasts.push(`A lumen courier costs ₡${fee.toLocaleString()} — the Consortium does not extend credit.`, 'warn');
      return;
    }
    if (this.mode === 'computer') this.closeComputer();
    if (!u.summonLumenCourier()) return;
    st.addCredits(-fee);
    audio.warp();
    flashWarp();
    this.autosave();
    this.ui.toasts.push(`Courier contracted — ₡${fee.toLocaleString()} debited. She is folding in now.`, 'warn');
    this.hint('lumencourier', 'The courier will close and hand over one lumen — enough to run a lane.');
  }

  actAcceptMission(offerId) {
    const station = this.station;
    const offer = missions.generateBoard(this.state, station).find((o) => o.id === offerId)
      || story.storyOffers(this.state, station).find((o) => o.id === offerId)
      || sidequests.sideOffers(this.state, station).find((o) => o.id === offerId);
    if (!offer) return;
    const res = missions.acceptMission(this.state, offer);
    if (!res.ok) {
      this.ui.toasts.push(res.error, 'warn');
      return;
    }
    // a fresh contract takes the helm's tracker \u2014 the way forward is lit at once
    this.trackedMissionId = res.mission?.id ?? this.trackedMissionId;
    // accepted work always names its ground: the destination system is the headline
    const destName = SYSTEMS[offer.dest?.systemId]?.name;
    this.ui.toasts.push(`Contract accepted: ${offer.title}${destName ? ` → ${destName}` : ''}`, 'good');
    if (offer.story) {
      const line = story.STORY_LINES[offer.story.line];
      this.ui.toasts.push(
        offer.story.oath
          ? `The oath is taken. ${line.name} is your path now — the other lines are closed.`
          : `${line.name} — chapter ${offer.story.chapter} begins.`,
        offer.story.oath ? 'warn' : 'good',
      );
    }
    if (offer.side) {
      const quest = sidequests.SIDE_BY_ID[offer.side.group];
      if (quest) this.ui.toasts.push(`${quest.name} — step ${offer.side.step + 1} of ${quest.steps.length} accepted.`, '');
    }
    // a contract signed at a berth still puts its mark into the local sky
    if (this.universe && offer.dest?.systemId && offer.dest.systemId === this.state.systemId
      && this.universe.systemId === this.state.systemId) {
      this.universe._spawnMissionObjects();
    }
    audio.ui();
    this.ui.dock.refreshIfOpen();
  }

  actCompleteMission(missionId) {
    const m = missions.findMission(this.state, missionId);
    if (!m) return;
    const done = missions.finishMission(this.state, m);
    if (done) {
      const paid = done.rewardAwarded ?? done.reward;
      this.ui.toasts.push(`${done.title} — complete. +₡${paid.toLocaleString()}`, 'good');
      if (done.outro) this.ui.toasts.push(done.outro, '');
      this._xp(Math.max(10, Math.round(paid / 300)));
      audio.coin();
      if (done.storyResult) this._storyToasts(done.storyResult);
      if (done.sideResult) this._sideToasts(done.sideResult);
      this.ui.dock.refreshIfOpen();
    }
  }

  actAbandonMission(missionId) {
    const m = missions.findMission(this.state, missionId);
    if (!m) return;
    missions.failMission(this.state, m, 'abandoned');
    this.ui.toasts.push(`Abandoned: ${m.title}.`, 'warn');
    this.ui.dock.refreshIfOpen();
  }

  /* ------------------------------------------------------------------ */
  /* Career: factions and skills                                        */
  /* ------------------------------------------------------------------ */

  actJoinFaction(factionId) {
    const res = joinFaction(this.state, factionId);
    if (!res.ok) {
      this.ui.toasts.push(res.error, 'warn');
      return;
    }
    audio.dock();
    this.ui.toasts.push(
      `You swear the oath. ${FACTIONS[factionId]?.name || factionId} numbers you among its own.`,
      'good',
    );
    this._xp(20);
    this.autosave();
    this.ui.dock.refreshIfOpen();
  }

  actRenounceFaction() {
    const res = renounceFaction(this.state);
    if (!res.ok) {
      this.ui.toasts.push(res.error, 'warn');
      return;
    }
    this.ui.toasts.push('You hand back the colours. What you learned stays learned; the door closes behind it.', 'warn');
    this.ui.dock.refreshIfOpen();
  }

  actLearnSkill(skillId) {
    const res = learnSkill(this.state, skillId);
    if (!res.ok) {
      this.ui.toasts.push(res.error, 'warn');
      return;
    }
    this.applyStatsToPlayer();
    audio.coin();
    this.ui.toasts.push(`${res.skill.name} — rank ${res.rank}.`, 'good');
    this.ui.dock.refreshIfOpen();
    this.ui.skilltree?.refresh();
    this.ui.skillBtn?.sync();
  }

  /* ------------------------------------------------------------------ */
  /* Fleet                                                              */
  /* ------------------------------------------------------------------ */

  /** Shipyard: buy a hull straight into the fleet (full price, no trade-in). */
  actBuyFleetShip(shipId) {
    const st = this.state;
    const def = SHIP_BY_ID[shipId];
    if (!def) return;
    const block = this._shipBuyBlock(def);
    if (block) {
      this.ui.toasts.push(block, 'warn');
      return;
    }
    if (def.price > st.credits) {
      this.ui.toasts.push('Not enough credits.', 'warn');
      return;
    }
    const res = addToFleet(st, shipId);
    if (!res.ok) {
      this.ui.toasts.push(res.error, 'warn');
      return;
    }
    st.addCredits(-def.price);
    audio.dock();
    this.ui.toasts.push(
      `${def.name} joins your fleet — “${res.entry.name}”, ${res.entry.status === 'bay' ? 'docked in a cradle' : 'flying your wing'}.`,
      'good',
    );
    this.noteSighting(shipId, 'yard');
    if (res.entry.status === 'escort' && this.universe) {
      const slot = this.universe.ships.filter((s) => s.role === 'escort').length;
      this.universe.spawnFleetShip(res.entry, slot);
    }
    this.autosave();
    this.ui.dock.refreshIfOpen();
  }

  /* ------------------------------------------------------------------ */
  /* Prizes                                                             */
  /* ------------------------------------------------------------------ */

  /** Nearest hull that has struck its colours, within claiming distance. */
  nearestPrize() {
    const u = this.universe;
    if (!u?.player?.alive) return null;
    let best = null;
    let bd = 260;
    for (const s of u.ships) {
      if (s.isPlayer || !s.alive || s.despawn || !s.surrendered) continue;
      const d = dist2(s.x, s.z, u.player.x, u.player.z);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  /** Claim a surrendered ship: into the fleet, or stripped for salvage. */
  actClaimPrize() {
    const u = this.universe;
    const st = this.state;
    if (!u || !u.player?.alive) return;
    const prize = this.nearestPrize();
    if (!prize) {
      this.ui.toasts.push('No struck-colours hull alongside to claim.', 'warn');
      return;
    }
    const def = prize.def;
    this.noteSighting(def.id, 'prize');
    st.stats.prizes = (st.stats.prizes || 0) + 1;
    const res = addToFleet(st, def.id);
    if (res.ok) {
      this.ui.toasts.push(`The ${def.name} joins your fleet — “${res.entry.name}”.`, 'good');
      if (res.entry.status === 'escort') {
        const slot = u.ships.filter((s) => s.role === 'escort').length;
        u.spawnFleetShip(res.entry, slot);
      }
    } else {
      const strip = Math.max(400, Math.round((def.price || 40000) * 0.35));
      st.addCredits(strip);
      audio.coin();
      this.ui.toasts.push(`No free berth — the ${def.name} is stripped for parts and records: +₡${strip.toLocaleString()}.`, 'good');
    }
    audio.dock();
    prize.despawn = true;
    this.autosave();
    this.ui.dock.refreshIfOpen();
  }

  /** Log a hull in the player's codex (first sighting wins). */
  noteSighting(shipId, via = 'yard') {
    const st = this.state;
    if (!st || !SHIP_BY_ID[shipId]) return;
    st.sighted = st.sighted || {};
    if (st.sighted[shipId]) return;
    st.sighted[shipId] = { day: st.day, systemId: st.systemId, via };
  }

  /** Purchase gates shared by “Take command” and “Add to fleet”. */
  _shipBuyBlock(def) {
    const st = this.state;
    if (def.capture) return 'That hull is never sold — take one as a prize out in the lanes.';
    if (def.unique && !story.ensureStory(st).unlocked.includes(def.id)) {
      return `The ${def.name} is not licensed to you — yet.`;
    }
    if (def.yards && !def.yards.includes(st.systemId)) {
      const where = def.yards.map((id) => SYSTEMS[id]?.name || id).join(' and ');
      return `The ${def.name} is built to order — only the ${where} yards stock it.`;
    }
    const tech = SYSTEMS[st.systemId]?.tech ?? 0;
    if ((def.minTech || 0) > tech) return `This berth's tech (${tech}) is too low to fit out a ${def.name}.`;
    return null;
  }

  actSellFleetShip(uid) {
    const st = this.state;
    const entry = entryByUid(st, uid);
    if (!entry) return;
    const value = fleetSellValue(entry.shipId);
    const u = this.universe;
    if (u) {
      const ship = u.ships.find((s) => s.fleetUid === uid);
      if (ship) u._removeShip(ship);
    }
    removeFromFleet(st, uid);
    st.addCredits(value);
    audio.coin();
    this.ui.toasts.push(`${entry.name} sold for ₡${value.toLocaleString()}.`, 'good');
    this.autosave();
    this.ui.dock.refreshIfOpen();
  }

  /** At a station slip: swap hulls with a fleet ship — no trade-in fee. */
  actFlyFleetShip(uid) {
    const st = this.state;
    const entry = entryByUid(st, uid);
    if (!entry) return;
    if (entry.status !== 'escort' && freeEscortSlots(st) === 0) {
      this.ui.toasts.push('No free escort slot for the ship you would leave behind.', 'warn');
      return;
    }
    const oldId = st.shipId;
    const oldName = st.shipName;
    const newDef = SHIP_BY_ID[entry.shipId];
    if (!newDef) return;
    st.shipId = entry.shipId;
    st.shipName = entry.name;
    entry.shipId = oldId;
    entry.name = oldName;
    entry.status = 'escort';
    entry.bay = null;
    st.integrity = { hull: null, shield: null };
    const mountCap = Math.max(2, newDef.mounts ?? 2);
    st.weapons = st.weapons.slice(0, mountCap);
    while (st.weapons.length < mountCap) st.weapons.push(null);
    audio.dock();
    this.ui.toasts.push(`You take the helm of the ${newDef.name}. ${oldName} joins the wing.`, 'good');
    const u = this.universe;
    if (u) {
      const old = u.ships.find((s) => s.fleetUid === uid);
      if (old) u._removeShip(old);
      this.rebuildPlayerShip();
      const slot = u.ships.filter((s) => s.role === 'escort').length;
      u.spawnFleetShip(entry, slot);
      this.applyStatsToPlayer();
    }
    this.autosave();
    this.ui.dock.refreshIfOpen();
  }

  /** Dock tab: send a small craft back into a cradle (flown home if in space). */
  actDockFleet(uid) {
    const st = this.state;
    const entry = entryByUid(st, uid);
    if (!entry || entry.status !== 'escort') return;
    if (!SHIP_BY_ID[entry.shipId]?.mini) {
      this.ui.toasts.push('Only small craft fit the docking cradles.', 'warn');
      return;
    }
    if (freeBays(st) < 1) {
      this.ui.toasts.push('No free docking bay.', 'warn');
      return;
    }
    const u = this.universe;
    const ship = u?.ships.find((s) => s.fleetUid === uid);
    if (ship && this.mode === 'flight') {
      ship.ai.recall = true;
      this.ui.toasts.push(`${entry.name} is heading for the cradle.`, '');
    } else {
      const bay = nextFreeBay(st);
      entry.status = 'bay';
      entry.bay = bay;
      if (ship) u._removeShip(ship);
      this.ui.toasts.push(`${entry.name} docked in bay ${bay + 1}.`, 'good');
    }
    this.autosave();
    this.ui.dock.refreshIfOpen();
  }

  /** Dock tab: launch a bayed craft to join the wing. */
  actLaunchFleet(uid) {
    const st = this.state;
    const entry = entryByUid(st, uid);
    if (!entry || entry.status !== 'bay') return;
    const bay = entry.bay ?? 0;
    if (this.universe) this.universe.launchMini(entry);
    audio.undock();
    this.ui.toasts.push(`${entry.name} launches from bay ${bay + 1}.`, 'good');
    this.autosave();
    this.ui.dock.refreshIfOpen();
  }

  /** Flight: launch every docked craft at once. */
  actScramble() {
    const st = this.state;
    const bayed = (st.fleet || []).filter((m) => m.status === 'bay' && SHIP_BY_ID[m.shipId]?.mini);
    if (!bayed.length) {
      this.ui.toasts.push('Nothing docked to scramble.', 'warn');
      return;
    }
    for (const entry of bayed) {
      if (this.universe) this.universe.launchMini(entry);
    }
    audio.undock();
    this.ui.toasts.push(`${bayed.length} interceptor${bayed.length > 1 ? 's' : ''} away.`, 'good');
    this.ui.dock.refreshIfOpen();
  }

  /** Flight: order launched small craft home. */
  actRecallMinis() {
    const st = this.state;
    let n = 0;
    for (const ship of this.universe?.ships || []) {
      if (ship.role !== 'escort' || !ship.alive) continue;
      const entry = entryByUid(st, ship.fleetUid);
      if (entry && SHIP_BY_ID[entry.shipId]?.mini) {
        ship.ai.recall = true;
        n++;
      }
    }
    if (!n) {
      this.ui.toasts.push('No launched craft to recall.', 'warn');
      return;
    }
    this.ui.toasts.push('Recall sent — they are running for the cradles.', '');
  }

  /** Flight: focus the whole wing on your current lock. */
  actFleetAttack() {
    if (!this.target) {
      this.ui.toasts.push('No target locked — press Tab to cycle hostiles.', 'warn');
      return;
    }
    let n = 0;
    for (const ship of this.universe?.ships || []) {
      if (ship.role === 'escort' && ship.alive) {
        ship.ai.forcedTarget = this.target;
        n++;
      }
    }
    this.ui.toasts.push(
      n ? `Fleet: focus fire on ${this.target.name}.` : 'No wing in the air.',
      n ? 'good' : 'warn',
    );
  }

  /** Flight: clear orders and reform on your wing. */
  actFleetRegroup() {
    for (const ship of this.universe?.ships || []) {
      if (ship.role === 'escort' && ship.alive) ship.ai.forcedTarget = null;
    }
    this.ui.toasts.push('Fleet: reform on your wing.', '');
  }

  /* ------------------------------------------------------------------ */
  /* Chart / jump / pause                                               */
  /* ------------------------------------------------------------------ */

  /** Raise the ship's computer — star map, missions, inventory and logs. */
  openComputer(tab = 'map') {
    if (this.mode !== 'flight') return;
    this.mode = 'computer';
    this.ui.computer.open(tab, {
      state: this.state,
      actions: this,
      game: this,
      warpBlock: this.universe?.warpClearance() || null,
      hasPlotter: (this.state.outfits?.warpplotter || 0) > 0,
      courierEnRoute: !!this.universe?.courier,
      trackedMissionId: this.trackedMissionId,
      onTrackMission: (id) => { this.trackedMissionId = id || null; },
      onJump: (toId) => this.jumpTo(toId),
      onClose: () => this.closeComputer(),
    });
    input.reset();
  }

  closeComputer() {
    if (this.mode !== 'computer') return;
    this.mode = 'flight';
    this.ui.computer.close();
    input.reset();
  }

  openSkills() {
    if (this.mode !== 'flight') return;
    this.mode = 'skills';
    this.ui.skilltree.open({
      state: this.state,
      actions: { learn: (id) => this.actLearnSkill(id) },
      onClose: () => this.closeSkills(),
    });
    this.ui.skillBtn?.sync();
    input.reset();
  }

  closeSkills() {
    if (this.mode !== 'skills') return;
    this.mode = 'flight';
    this.ui.skilltree.close();
    input.reset();
  }

  jumpTo(toId) {
    const st = this.state;
    const u = this.universe;
    this.scanHold = null; // a warp breaks any held survey
    if (!SYSTEMS[st.systemId].links.includes(toId)) {
      this.ui.toasts.push('No lane runs there from here.', 'warn');
      return;
    }
    const stats = computeStats(st);
    if (st.lumen < 1) {
      this.ui.toasts.push('No lumen left — refuel at a station, or summon a lumen courier from a warp bay.', 'bad');
      return;
    }
    const block = u.warpClearance();
    if (block) {
      this.ui.toasts.push('Warp field dampened — clear space before jumping.', 'warn');
      this.closeComputer();
      return;
    }
    st.lumen -= 1;
    st.stats.jumps++;
    this._xp(8);
    audio.warp();
    flashWarp();
    this.closeComputer();
    this.mode = 'warp';
    window.setTimeout(() => {
      // drop out of warp on the rim facing back home, clear of every field
      const backAngle = laneAngle(toId, st.systemId);
      const entry = {
        x: Math.cos(backAngle) * (RIM_RADIUS - 90),
        z: Math.sin(backAngle) * (RIM_RADIUS - 90),
      };
      st.systemId = toId;
      st.pos = { x: entry.x, z: entry.z };
      const heading = Math.atan2(-entry.x, -entry.z);
      st.heading = heading;
      this.universe.load(toId, { entry, playerHeading: heading });
      this.applyStatsToPlayer();
      this._lastShield = this.universe.player.shield;
      this._lastHull = this.universe.player.hull;
      this.target = null;
      this.mode = 'flight';
      this.autosave();
      this.ui.toasts.push(`You drop out of warp above ${SYSTEMS[toId].name}.`, 'good');
      this.hint('arrived', 'Dock prompts appear when you slow down near a station.');
    }, 650);
  }

  pause() {
    if (this.mode !== 'flight') return;
    this.mode = 'paused';
    audio.setEngine(0);
    this.ui.menus.openPause({
      onResume: () => this.resume(),
      onSave: () => this.ui.menus.openSave({ mode: 'save', onPick: (slot) => { this.save(slot); this.ui.menus.closeSave(); this.resume(); }, onClose: () => {} }),
      onLoad: () => this.ui.menus.openSave({ mode: 'load', onPick: (slot) => this.loadFromSlotUI(slot), onClose: () => {} }),
      onHelp: () => this.ui.menus.openHelp(),
      onKeys: () => openKeybinds(),
      onQuit: () => this.quitToTitle(),
    });
    input.reset();
  }

  resume() {
    this.ui.menus.closePause();
    if (this.mode === 'paused') this.mode = 'flight';
    input.reset();
  }

  loadFromSlotUI(slot) {
    const data = readSlot(slot);
    if (!data) {
      this.ui.toasts.push('That slot is empty.', 'warn');
      return;
    }
    this.ui.menus.closeAll();
    this.loadGame(data);
  }

  /* ------------------------------------------------------------------ */
  /* Dev/test helpers (used by URL hooks and the console handle)        */
  /* ------------------------------------------------------------------ */

  debugTeleportToStation() {
    const u = this.universe;
    if (!u) return;
    const st = u.stations[0];
    if (!st) return;
    const p = u.player;
    p.x = st.x + 70;
    p.z = st.z + 70;
    p.vx = 0;
    p.vz = 0;
    p.heading = Math.atan2(st.x - p.x, st.z - p.z);
  }

  debugTeleportToPlanet() {
    const u = this.universe;
    if (!u) return;
    const pl = u.planets[0];
    if (!pl) return;
    const p = u.player;
    p.x = pl.x + pl.record.radius * 0.25;
    p.z = pl.z + pl.record.radius * 0.25;
    p.vx = 0;
    p.vz = 0;
    p.heading = Math.atan2(pl.x - p.x, pl.z - p.z);
  }

  /** Test support: drop the ship into open space on the system rim, ready to warp. */
  debugTeleportToRim() {
    const u = this.universe;
    if (!u) return;
    const p = u.player;
    const a = 0.65;
    const r = RIM_RADIUS - 220;
    p.x = Math.cos(a) * r;
    p.z = Math.sin(a) * r;
    p.vx = 0;
    p.vz = 0;
    p.heading = Math.atan2(-p.x, -p.z); // nose back toward the star
  }

  /** Test support: stand off the nearest wormhole (warps to one if none here). */
  debugTeleportToWormhole() {
    const u = this.universe;
    const st = this.state;
    if (!u) return;
    const hole = wormholes.holeInSystem(st, st.systemId) || wormholes.wormholesFor(st)[0];
    if (!hole) return;
    const sysId = hole.a === st.systemId || hole.b === st.systemId ? st.systemId : hole.a;
    const pos = wormholes.holePos(hole, sysId);
    const entry = { x: pos.x + 260, z: pos.z + 260 };
    if (sysId !== st.systemId) {
      st.systemId = sysId;
      st.pos = { ...entry };
      st.heading = Math.atan2(pos.x - entry.x, pos.z - entry.z);
      u.load(sysId, { entry, playerHeading: st.heading });
      this.applyStatsToPlayer();
    } else {
      const p = u.player;
      p.x = entry.x;
      p.z = entry.z;
      p.vx = 0;
      p.vz = 0;
      p.heading = Math.atan2(pos.x - p.x, pos.z - p.z);
    }
  }

  debugSpawnPirates() {
    const u = this.universe;
    if (!u) return;
    u.spawnTimer = 0;
    u._manageSpawns(false);
  }

  /** Dev hook: jump to a system with a ringed planet and park over the ring band. */
  debugGoToRings() {
    const sys = Object.values(SYSTEMS).find((s) => s.planets.some((pl) => pl.rings));
    if (!sys) return;
    this.state.systemId = sys.id;
    this.state.pos = { x: 0, z: 0 };
    this.universe.load(sys.id);
    const pl = this.universe.planets.find((pt) => pt.record.rings);
    if (!pl) return;
    const p = this.universe.player;
    p.x = pl.x + pl.record.radius * 1.7;
    p.z = pl.z + pl.record.radius * 0.25;
    p.vx = 0;
    p.vz = 0;
    p.heading = Math.atan2(pl.x - p.x, pl.z - p.z);
  }

  /* ------------------------------------------------------------------ */
  /* Planet surveys                                                     */
  /* ------------------------------------------------------------------ */

  /** Start (or continue) a held survey — it finishes only if the ship keeps station. */
  beginScan(kind) {
    const u = this.universe;
    if (this.mode !== 'flight' || !u) return;
    const target = kind === 'planet' ? u.nearPlanet : null;
    if (kind === 'planet' && !target) return;
    if (kind === 'star' && !u.nearStar) return;
    if (this.scanHold && this.scanHold.kind === kind && this.scanHold.target === target) return; // already reading
    this.scanHold = {
      kind,
      target,
      t: 0,
      total: kind === 'star' ? STAR_SCAN_SECONDS : PLANET_SCAN_SECONDS,
      label: kind === 'star' ? `${u.system.name} star` : target.record.name,
    };
    audio.ui();
  }

  /**
   * A survey is a held reading: the ship must stay close and slow while the
   * tape runs. Break either and the reading is lost.
   */
  _updateScanHold(dt) {
    const h = this.scanHold;
    if (!h) return;
    const u = this.universe;
    const p = u.player;
    const inRange = h.kind === 'star' ? !!u.nearStar : u.nearPlanet === h.target;
    if (!inRange || p.speed >= SCAN_SPEED_LIMIT) {
      this.scanHold = null;
      this.ui.toasts.push(`Reading lost — hold close and under ${SCAN_SPEED_LIMIT} to finish the survey.`, 'warn');
      return;
    }
    h.t += dt;
    if (h.t < h.total) return;
    this.scanHold = null;
    if (h.kind === 'star') this.scanStar();
    else this.scanPlanet(h.target);
  }

  scanPlanet(planetEntry) {
    if (this.mode !== 'flight' || !planetEntry) return;
    const name = planetEntry.record.name;
    const info = planetInfo(this.state, name, planetEntry.record);
    const known = this.state.planets[name];
    let cache = false;
    if (!known) {
      const reward = Math.round(info.reward * economyMods(this.state).survey);
      this.state.planets[name] = { day: this.state.day, lastDay: this.state.day, reward };
      this.state.addCredits(reward);
      addKarma(this.state, 2);
      this._xp(PLANET_SCAN_XP);
      audio.coin();
      this.ui.toasts.push(`Survey logged: ${name} — first-scan bounty +₡${reward.toLocaleString()} · +${PLANET_SCAN_XP} XP.`, 'good');
      const rng = rngOf(this.state.worldSeed, 'cache', name);
      cache = rng.chance(0.4);
      if (cache) {
        this.universe.spawnPodNear(planetEntry);
        this.ui.toasts.push('The scan pings a salvage pod in orbit.', 'warn');
      }
      this.autoincSurvey();
      this.autosave();
    } else if (this.state.day > (known.lastDay ?? known.day)) {
      // a fresh day, a fresh reading — the office pays a little for the update
      known.lastDay = this.state.day;
      this._xp(RESCAN_XP);
      this.ui.toasts.push(`Fresh readings on ${name} — +${RESCAN_XP} XP.`, 'good');
    }
    this.mode = 'planet';
    this.ui.planet.open({
      state: this.state,
      planet: planetEntry.record,
      info,
      known: known || { day: this.state.day, reward: info.reward },
      first: !known,
      onClose: () => this.closePlanet(),
    });
    input.reset();
  }

  /**
   * Deep-core readings from the local star. The first survey pays real XP;
   * coming back on a later day pays a little for the updated tape.
   */
  scanStar() {
    const u = this.universe;
    if (this.mode !== 'flight' || !u?.nearStar) return;
    const name = `${u.system.name} star`;
    const record = this.state.stars[u.systemId];
    if (!record) {
      this.state.stars[u.systemId] = { day: this.state.day, lastDay: this.state.day };
      addKarma(this.state, 1);
      this._xp(STAR_SCAN_XP);
      this.state.stats.starSurveys = (this.state.stats.starSurveys || 0) + 1;
      audio.coin();
      this.ui.toasts.push(`Star survey logged: ${name} — deep-core readings filed. +${STAR_SCAN_XP} XP.`, 'good');
      this.autosave();
    } else if (this.state.day > (record.lastDay ?? record.day)) {
      record.lastDay = this.state.day;
      this._xp(RESCAN_XP);
      this.ui.toasts.push(`Fresh readings off ${name} — +${RESCAN_XP} XP.`, 'good');
    }
  }

  autoincSurvey() {
    this.state.stats.surveys = (this.state.stats.surveys || 0) + 1;
  }

  closePlanet() {
    this.ui.planet.close();
    if (this.mode === 'planet') this.mode = 'flight';
    input.reset();
  }

  /* ------------------------------------------------------------------ */
  /* Death & respawn                                                    */
  /* ------------------------------------------------------------------ */

  respawn() {
    const st = this.state;
    const u = this.universe;
    st.stats.deaths++;
    // death costs money and pride — the hold and contracts ride the escape pod
    const green = missions.playerTier(st) <= 2;
    const lostCredits = Math.round(st.credits * (green ? 0.05 : 0.1));
    st.addCredits(-lostCredits);

    const dest = st.lastStation || { systemId: 'haven', stationId: 'haven-anchor' };
    const destSys = SYSTEMS[dest.systemId] || SYSTEMS.haven;
    const stationRec = destSys.stations.find((s) => s.id === dest.stationId) || destSys.stations[0];
    const stats = computeStats(st);
    const dist = stationRec.dist + 260;
    const x = Math.cos(stationRec.angle) * dist;
    const z = Math.sin(stationRec.angle) * dist;
    st.systemId = dest.systemId;
    st.pos = { x, z };
    st.heading = Math.atan2(-x, -z);
    st.integrity = { hull: Math.max(40, stats.hull * 0.25), shield: stats.shield };

    u.load(dest.systemId, { entry: st.pos, playerHeading: st.heading });
    this.applyStatsToPlayer();
    this._lastShield = u.player.shield;
    this._lastHull = u.player.hull;
    this.target = null;
    this.mode = 'flight';
    this.autosave();

    this.ui.toasts.push('Your hull is opened to vacuum. An escape pod drags you to safe moorage.', 'bad');
    this.ui.toasts.push(`Lost ${lostCredits.toLocaleString()} credits in the wreck — the hold and your contracts made it to the pod.`, 'bad');
    this.ui.toasts.push(`Recovered at ${stationRec.name}, ${destSys.name}.`, '');
  }
}
