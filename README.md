# Oldspace

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
| Vector Challenge (at a port or station) | `R` — then `W`/`S` work the power lever, `A`/`D` steer, `Space` fire, `Shift` burns the turbo tank, `Esc` steps out |
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
- **Ships** — over a hundred and forty hulls, from starter cutters up to the
  great keels, each built from a procedural model. Yards are not equal: a
  frontier outpost stocks light hulls, a port stocks the working trade, and only
  the great ports — bastions, spacedocks and the big yards at tech 9 and 10 —
  keep the capital slips and the ten great keels. A yard that cannot sell you a
  hull still knows it exists: the card shows up redacted, with nothing but the
  berth it would need. Shipyards trade in your old hull at 70%, and when you buy
  bigger the desk asks whether to **trade her in** or **keep her in the fleet** —
  a paid-for escort that will fly with you. Sort the slips by price, hull,
  shield, speed, hold, mounts, bays or name.
- **The Vector Challenge** — every port with a bar keeps a holo-sim rig older
  than half the hulls outside. Press `R` to fly a *duel* (three pilots, last one
  flying), a *harvest* (two minutes on the crystal field) or a *chute run* (six
  pilots down a winding tube of wire through open space that breathes and lifts
  as it goes: gates to pass, ramps to jump, squeezes where the road pulls in and
  splits where it opens out around a divider — two ways through and a prize in
  one of them — where a gun costs a rival its thrust rather than its hull), on a
  wire-and-phosphor orb, in your own hull with the guns you actually carry. The
  rig lays a course of walls, hills and launch ramps on one patch of the world,
  marks its edges on the ground, and shows you where the other pilots are —
  with item pads for drive bursts, rapid fire, shields and stars.
  `Shift` burns the turbo tank in every discipline: the bar at the foot of the
  glass shows what is in the tank, it refills as you fly, and a star tops it up
  in one go. In the chute `W`/`S` work a power lever rather than a throttle
  switch, so a pilot can hold a speed as well as build one, and the stars strung
  along the road are what keeps a tank fed. The rest of the field flies the same
  hulls, so the tank and the stars are where a race is won.
  The house comes with the rig: sponsor boards hung over the course, a
  jumbotron reading the running order, and a ticker along the foot of the glass.
  Winners take the purse; the desk pays consolation.
- **The law** — four factions (Free Ports, Helion Combine, The Vigil, Reaver
  Clans) remember what you do. Wrong a faction past −60 and their ports
  refuse you — though contract business still earns a grudging berth. A flag
  also answers to its own books: a Vigil patrol does not open fire over a
  quarrel you had with the Combine, and a grudge lasts a day, not a career.
- **Cooling off** — nothing in the lanes holds a grudge for its own sake. A
  raider that takes against you keeps it up only while you are in reach; break
  contact, run the lane, and it goes back to its own business. Provoke a flag
  and their patrols will come for you, but the lanes themselves only spring so
  many unprovoked attacks in one stretch — a pass-through is not a war.
- **Death is a setback, not the end** — an escape pod drags you to your last
  dock, lighter part of your purse; your hold and contracts ride with you.

**Lumen** is warp fuel: one unit per lane, two for a wormhole transit. Refuel
at any station berth — or call a lumen courier if you run dry in the black.

### The cluster

Fifty-five systems make up *The Ten Lanes & the Outer Reach* — the busy Free
Port core (Haven, Coriolis, Meridian…) ringed by the Combine's foundry lanes,
the Vigil's marches, the Kreth Houses' deep holds, and the Reaver Clans' outer
rim. Each faction flies its colours over its own block of the chart; each system
has its own governments, tech levels, markets, pirates and patrols.

---

## The 15 saved adventures

- Starting a new adventure asks for a commander name and a **berth** (slot 1–15).
- Saves live in your browser's `localStorage` (`oldspace.save.1` … `.15`), so
  they persist across reloads and restarts of the browser, on that machine.
- **Autosave** writes to your chosen slot whenever you dock, undock or warp a
  lane. Manual saves are in the pause menu (`Esc`) and the station Berth tab.
- The load screen shows commander, ship, credits, system, day, playtime and
  real-world save time for each slot, with per-slot delete.
- **A berth travels as a `.os` file.** The `⤓` button on any berth downloads it
  as `oldspace-<commander>-day<day>-v<build>.os`, and **Upload Save (.os)** on
  the title screen reads one back into a berth — an empty one, or one you are
  willing to lose. The file is a self-describing document: the game, the build
  that wrote it, the save layout, the export date, the berth it came from, a
  plain-language summary (commander, ship, level, system, day, credits, playtime,
  contracts, kills, reputation, hull and shields) and then the state itself,
  untouched.
- Because of that, a file written by any build can be read by any later one. A
  log from a newer build imports with a warning rather than a refusal — whatever
  that build added is simply missing and the defaults take over — and an old log
  keeps its own save version, so the migrations that shipped with v2 still apply
  to it (a v1 log's hull and shields are rescaled on the way in).

---

## Development notes

- `window.GAME` exposes the live `game`, `engine` and `ui` for console
  poking, plus `GAME.debug` helpers (`grant`, `zoom`, `fast`, `overPlanet`,
  `atWarp`, `wormhole`, `scan`, `gosys`, `teleport`, `nearStation`,
  `spawnPirate`, `purse`, `panels`).
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
