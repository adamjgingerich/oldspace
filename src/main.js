// Entry point: wires the engine, UI and game together.

import { Engine } from './core/engine.js';
import { input } from './core/input.js';
import { audio } from './core/audio.js';
import { $, el } from './ui/dom.js';
import { GAME_PAGE_TITLE, GAME_VERSION } from './data/branding.js';
import { Toasts } from './ui/toasts.js';
import { Hud } from './ui/hud.js';
import { Menus } from './ui/menus.js';
import { DockUI } from './ui/dock.js';
import { ComputerUI } from './ui/computer.js';
import { PlanetUI } from './ui/planet.js';
import { installFullscreenButton } from './ui/fullscreen.js';
import { installKeybindButton } from './ui/keys.js';
import { installVolumeControl } from './ui/volume.js';
import { installSpeedControl } from './ui/speed.js';
import { SkillTreeUI, installSkillsButton } from './ui/skilltree.js';
import { CommsUI } from './ui/comms.js';
import { installScreenPanels } from './ui/panels.js';
import { DevMode } from './ui/dev.js';
import { Backdrop } from './ui/backdrop.js';
import { Game } from './game/game.js';
import { hasAnySave, latestSlot, readSlot, parseSaveFile, importSlot } from './game/saves.js';

function boot() {
  document.title = GAME_PAGE_TITLE;
  const canvas = $('#gl');
  const engine = new Engine(canvas);
  const toasts = new Toasts($('#toasts'));
  const hud = new Hud($('#hud'), $('#labels'));
  const menus = new Menus($('#overlays'));
  const dock = new DockUI($('#overlays'));
  const computer = new ComputerUI($('#overlays'));
  const planet = new PlanetUI($('#overlays'));
  const skilltree = new SkillTreeUI($('#overlays'));
  const comms = new CommsUI($('#overlays'));
  const backdrop = new Backdrop(engine);
  const ui = { toasts, hud, menus, dock, computer, planet, skilltree, comms };
  ui.panels = installScreenPanels(hud); // fold / drag the flight-screen panels
  menus.onToast = (text, kind) => toasts.push(text, kind); // berth exports report through the usual toasts
  const game = new Game({ engine, ui });
  ui.dev = new DevMode($('#app'), game);
  input.attach(window);
  input.attachZoomGestures(canvas);
  // one tidy corner tray — the controls can never stack or drift apart
  const tray = el('div', { class: 'corner-tray' });
  $('#app').append(tray);
  // build stamp: bottom-left, unobtrusive, click-through, on screen in every mode
  $('#app').append(el('div', {
    class: 'vstamp',
    text: `v${GAME_VERSION}`,
    title: `Build v${GAME_VERSION} — the version climbs by 0.01 with every significant edit.`,
  }));
  installKeybindButton(tray, $('#overlays'));
  installVolumeControl(tray);
  ui.speed = installSpeedControl(tray, game);
  ui.skillBtn = installSkillsButton(tray, game);
  installFullscreenButton(tray, {
    onBlocked: () => toasts.push('Fullscreen was blocked by the browser or embedded view — try the game in its own tab.', 'warn'),
  });

  const startMenu = () => {
    menus.closeAll();
    menus.hideTitle(); // rebuild from scratch, so a recovered log wakes Continue up
    menus.showTitle({
      hasSave: hasAnySave(),
      onNew: () => {
        menus.openNewGame({
          onStart: (name, backgroundId, driveId, factionId) => {
            menus.openSave({
              mode: 'new',
              onPick: (slot) => {
                menus.closeSave();
                menus.hideTitle();
                audio.ensure();
                game.newGame({ commander: name, backgroundId, driveId, factionId, slot });
              },
              onClose: () => {},
            });
          },
          onClose: () => {},
        });
      },
      onContinue: () => {
        const info = latestSlot();
        if (!info) return;
        const data = readSlot(info.slot);
        if (!data) return;
        menus.hideTitle();
        audio.ensure();
        game.loadGame(data);
      },
      onLoad: () => {
        menus.openSave({
          mode: 'load',
          onPick: (slot) => {
            const data = readSlot(slot);
            if (!data) return;
            menus.closeSave();
            menus.hideTitle();
            audio.ensure();
            game.loadGame(data);
          },
          onClose: () => {},
        });
      },
      onUpload: () => menus.pickSaveFile((text, file) => {
        if (text == null) {
          toasts.push('That file could not be read.', 'warn');
          return;
        }
        const res = parseSaveFile(text, { from: file?.name || null });
        if (!res.ok) {
          toasts.push(res.error, 'warn');
          return;
        }
        for (const w of res.warnings) toasts.push(w, 'warn');
        menus.openSave({
          mode: 'import',
          importInfo: res,
          onPick: (slot) => {
            const wrote = importSlot(slot, res.data);
            if (!wrote.ok) {
              toasts.push(wrote.error, 'warn');
              return;
            }
            menus.closeSave();
            toasts.push(`Recovered ${res.summary.commander} — day ${res.summary.day} — into berth #${slot}.`, 'good');
            startMenu(); // rebuild the title so Continue and Load wake up
          },
          onClose: () => {},
        });
      }),
      onHelp: () => menus.openHelp(),
    });
  };

  game.onQuitToTitle = () => startMenu();
  startMenu();

  // Dev entry hooks: #test=dock | #test=planet | #test=warp | #test=wormhole | #test=pirates | #test=rings | #test=chart
  try {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const test = params.get('test');
    if (test) {
      const info = latestSlot();
      const data = info ? readSlot(info.slot) : null;
      if (data) {
        menus.hideTitle();
        game.loadGame(data);
        if (test === 'dock') game.debugTeleportToStation();
        if (test === 'planet') game.debugTeleportToPlanet();
        if (test === 'warp') game.debugTeleportToRim();
        if (test === 'wormhole') game.debugTeleportToWormhole();
        if (test === 'pirates') game.debugSpawnPirates();
        if (test === 'rings') game.debugGoToRings();
        if (test === 'rich') {
          game.state.addCredits(150000);
          game.debugTeleportToStation();
        }
        if (test === 'chart') game.openComputer('map');
        if (test === 'missions') game.openComputer('missions');
        if (test === 'inventory') game.openComputer('inventory');
        if (test === 'logs') game.openComputer('logs');
      }
    }
  } catch (err) {
    console.warn('[boot] test hook failed', err);
  }

  // unlock audio on first gesture
  const unlock = () => audio.ensure();
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });

  // auto-pause when the tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.mode === 'flight') game.pause();
  });

  // ---- persistent stardate: the day counter stays on screen in every mode ----
  const dateChip = document.createElement('div');
  dateChip.id = 'datechip';
  (document.getElementById('app') || document.body).appendChild(dateChip);
  let dateChipText = '';
  const syncDateChip = () => {
    const text = game.state && game.mode !== 'idle' ? `DAY ${game.state.day}` : '';
    if (text === dateChipText) return;
    dateChipText = text;
    dateChip.textContent = text;
    dateChip.style.display = text ? 'block' : 'none';
  };

  // ---- main loop ----
  let last = performance.now();
  const frame = (now) => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;

    syncDateChip();
    toasts.update(dt);

    if (game.isActive()) {
      game.update(dt);
      const u = game.universe;
      if (u) engine.render(u.scene, u.camera);
      else {
        backdrop.update(dt);
        backdrop.render();
      }
    } else {
      backdrop.update(dt);
      backdrop.render();
      input.endFrame();
    }
  };
  requestAnimationFrame(frame);

  // ---- debug / console handle ----
  window.GAME = {
    game,
    engine,
    ui,
    backdrop,
    debug: {
      grant(n = 5000) {
        game.state?.addCredits(n);
        toasts.push(`+₡${n} (debug)`, 'good');
      },
      zoom(level = 1) {
        if (game.universe) game.universe.zoomTarget = Math.max(0.32, Math.min(5.6, level));
      },
      fast(n = 220) {
        const p = game.universe?.player;
        if (!p) return;
        p.vx = Math.sin(p.heading) * n;
        p.vz = Math.cos(p.heading) * n;
      },
      overPlanet() {
        game.debugTeleportToPlanet();
      },
      atWarp() {
        game.debugTeleportToRim();
      },
      wormhole() {
        game.debugTeleportToWormhole();
      },
      scan() {
        const u = game.universe;
        if (u?.nearPlanet) game.scanPlanet(u.nearPlanet);
      },
      gosys(id) {
        if (!game.universe) return;
        // jumping while berthed would leave the helm still believing it is
        // docked, with a station that belongs to the system just left — step
        // outside first so later docks are not silently swallowed
        if (game.mode === 'docked') {
          game.mode = 'flight';
          game.station = null;
          ui.dock.close();
        }
        game.state.systemId = id;
        game.universe.load(id);
        toasts.push(`Jumped to ${id} (debug)`, 'warn');
      },
      teleport(x = 0, z = 0) {
        const p = game.universe?.player;
        if (!p) return;
        p.x = x;
        p.z = z;
        p.vx = 0;
        p.vz = 0;
      },
      nearStation() {
        const u = game.universe;
        const p = u?.player;
        if (!p || !u.stations[0]) return;
        p.x = u.stations[0].x + 60;
        p.z = u.stations[0].z + 60;
        p.vx = 0;
        p.vz = 0;
      },
      spawnPirate() {
        const u = game.universe;
        if (!u) return;
        u.spawnTimer = 0;
        u._manageSpawns(false);
        toasts.push('Spawn pulse (debug)', 'warn');
      },
      purse() {
        const st = game.state;
        if (!st) return;
        st.addCredits(200000);
        toasts.push('Purse flushed (debug)', 'warn');
      },
      panels() {
        ui.panels?.resetAll();
        toasts.push('HUD panels reset (debug)', 'warn');
      },
    },
  };
}

boot();
