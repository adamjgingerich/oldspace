# THEWINDS

**A star-lane trading & combat adventure in the browser.** Fly a ship of your own
choosing across fifty-two systems, run cargo, take contracts, hunt bounties,
dodge the law — and keep up to **15 adventures** saved locally in your browser.

Built with [Three.js](https://threejs.org/) + [Vite](https://vite.dev/). Inspired
by the classic top-down space sandboxes (`Escape Velocity Nova`); all ships,
stations, sounds and systems here are original procedural work — no assets.

---

## Play it

No install needed — the game runs entirely in your browser:

**https://adamjgingerich.github.io/oldspace/**

Deployed automatically from the `main` branch to GitHub Pages. To run it
locally instead, see Quick start below.

---

## Quick start

```bash
npm install
npm run dev      # play at http://localhost:5173
npm run build    # production bundle in dist/
npm run preview  # serve the production build
```

Node 18+ recommended. Everything runs client-side; there is no server component.

---

## Controls

| Action | Key |
| --- | --- |
| Turn the bow | `A` / `D` or `←` / `→` |
| Main drive | `W` (or `↑`) |
| Retro / reverse | `S` (or `↓`) — kills your drift, then pushes astern |
| Engine burst | hold `Shift` — harder thrust than the drive; the tank recharges over time |
| Fire primary weapon | `Space` |
| Fire secondary / missile | `Q` |
| Cycle hostile target | `Tab` |
| Fleet: focus fire my target | `B` |
| Fleet: regroup on my wing | `N` |
| Scramble docked small craft | `G` |
| Recall launched small craft | `H` |
| Zoom view | scroll wheel, trackpad pinch, or `-` / `=` |
| Fullscreen | corner button (top right) or `F` |
| Volume / mute | corner speaker button (click for the mixer) or `V` |
| Simulation speed | corner ×N button, `X` faster, `Z` slower |
| Dock / scan | `E` — dock at a station; near a world or star, hold close and slow to survey |
| Ship's computer | `M` or `J` — star map, missions, inventory, logs |
| Warp a lane | pick a neighbouring system on the star map, then warp from the bay |
| Skill tree | `K` |
| Pause / save / load | `Esc` |

**Flight is inertial.** Turning the bow does not turn your momentum. The
flight-vector dial (top left) shows your true course relative to the bow:

- **green** — you are tracking straight;
- **amber** — you are drifting, and the readout tells you how far;
- **RETRO** authority shows how hard you can kill that drift.

In a knife fight, whoever manages their slide best gets the first clean shot.

**Pacing** — the simulation runs at **×0.5** by default for a deliberate, readable
pace. The corner ×N button (or `X` / `Z`) steps through ×0.5 → ×1 → ×2 → ×3 → ×4
when you want to cross a system in a hurry. Your choice is remembered.

---

## The loop

- **Trade** — buy where a good is produced, sell where it is demanded. Prices
  are deterministic per world seed + day, and drift every few days.
- **Contracts** — station bars post deliveries, bounties, surveys, raider
  sweeps, recoveries and relic hunts. You can hold six at once; deadlines are
  in game days.
- **Surveys** — fly close to a world or star, slow down and press `E` to log a
  survey. First scans pay a bounty, and a scan can flush out salvage drifting
  in orbit.
- **Outfit & upgrade** — weapons (needlers, pulse lances, railguns, homing
  harpoons), shields, capacitors, engines, plating, bigger holds, repair
  drones, sensors, lumen tanks.
- **Ships** — over a hundred hulls, from starter cutters up to rare capital
  ships, each built from a procedural model. Shipyards trade in your old hull
  at 70%.
- **The law** — four factions (Free Ports, Helion Combine, The Vigil, Reaver
  Clans) remember what you do. Wrong a faction past −60 and their ports
  refuse you — though contract business still earns a grudging berth.
- **Death is a setback, not the end** — an escape pod drags you to your last
  dock, lighter part of your purse; your hold and contracts ride with you.

**Lumen** is warp fuel: one unit per lane, two for a wormhole transit. Refuel
at any station berth — or call a lumen courier if you run dry in the black.

### The cluster

Fifty-two systems make up *The Ten Lanes & the Outer Reach* — the busy Free
Port core (Haven, Coriolis, Meridian…) ringed by the Combine's foundry lanes,
the Vigil's marches, the Kreth Houses' deep holds, and the Reaver Clans' outer
rim. Each faction flies its colours over its own block of the chart; each system
has its own governments, tech levels, markets, pirates and patrols.

---

## The 15 saved adventures

- Starting a new adventure asks for a commander name and a **berth** (slot 1–15).
- Saves live in your browser's `localStorage` (`thewinds.save.1` … `.15`), so
  they persist across reloads and restarts of the browser, on that machine.
- **Autosave** writes to your chosen slot whenever you dock, undock or warp a
  lane. Manual saves are in the pause menu (`Esc`) and the station Berth tab.
- The load screen shows commander, ship, credits, system, day, playtime and
  real-world save time for each slot, with per-slot delete.

---

## Development notes

- `window.GAME` exposes the live `game`, `engine` and `ui` for console
  poking, plus `GAME.debug` helpers (`grant`, `gosys`, `zoom`, `fast`,
  `nearStation`, `spawnPirate`, `purse`, `panels`).
- URL test hooks (handy when iterating): open `/#test=dock` to continue the
  latest save parked at a station, `/#test=pirates` for immediate traffic,
  `/#test=rich` for a flush purse, or `/#test=chart` to open the star map.
- Layout:

```
src/
  core/      engine, meshes (procedural ship/station models), fx, input, audio, rng
  data/      ships, weapons, outfits, commodities, factions, systems, names
  game/      state + saves, universe simulation, ship physics, AI, combat,
             economy, missions, the Game controller
  ui/        HUD (flight vector + radar), station interface, star chart,
             menus (title, 15-slot browser, pause, help), title backdrop
```

Ships are assembled from dozens of parts (lathed fuselages, extruded wings,
engine bells with fins, turrets, greebles, RCS quads, nav-light arrays) and
merged to one mesh per material, so detail stays cheap.
