// Shipboard weapons. Missiles are bought as racks that add ammo.
//
// kind: 'laser' | 'kinetic' | 'beam' | 'missile' | 'disruptor'
//
// Shield-aware damage fields:
//   shieldBonus — extra bite while the target's lattice holds (missiles/lasers)
//   hullBonus   — extra bite once the lattice is down (armour crackers)
//   hullFactor  — what little a shield-flayer manages against bare hull
// Disruptors carry `disablePower`: they snare a hull whose shields are down.
// Every disruptor snare bites exactly as hard as every other — the variants
// differ in reach, cadence and cost, never in what they do to a caught ship.

export const WEAPONS = [
  {
    id: 'needler', name: 'Needler Array', kind: 'kinetic', size: 'light',
    dmg: 6, speed: 500, cooldown: 0.22, energy: 1.6, range: 640, spread: 0.085,
    price: 2600, color: 0xffd27a,
    desc: 'A spray of ferrous splinters. Cheap, rude, effective up close.',
  },
  {
    id: 'pulse', name: 'Pulse Lance', kind: 'laser', size: 'light',
    dmg: 10, speed: 610, cooldown: 0.34, energy: 4, range: 720, spread: 0.02,
    price: 5800, color: 0x6ef0ff,
    desc: 'The standard duelling laser of the trade lanes.',
  },
  {
    id: 'twinpulse', name: 'Twin Pulse', kind: 'laser', size: 'light',
    dmg: 9, speed: 610, cooldown: 0.2, energy: 3.2, range: 720, spread: 0.045,
    price: 11400, color: 0x9af7ff, twin: true,
    desc: 'Two emitters, one trigger. A river of light.',
  },
  {
    id: 'sunbeam', name: 'Sunbeam Cannon', kind: 'laser', size: 'heavy',
    dmg: 23, speed: 540, cooldown: 0.78, energy: 11, range: 840, spread: 0.01,
    price: 15200, color: 0xffe066,
    desc: 'Focuses a sliver of the local star. Punishing, thirsty, slow.',
  },
  {
    id: 'flenser', name: 'Flenser Railgun', kind: 'kinetic', size: 'heavy',
    dmg: 31, speed: 660, cooldown: 1.1, energy: 9, range: 940, spread: 0.005,
    price: 17800, color: 0xff8a5c,
    desc: 'Hypervelocity slugs that ignore polite conversation.',
  },
  {
    id: 'harpoon', name: 'Harpoon Missile', kind: 'missile', size: 'light',
    dmg: 52, speed: 275, turn: 2.4, cooldown: 1.7, energy: 6, range: 1500,
    price: 3400, color: 0xff5f8f, rack: 4, maxAmmo: 12,
    desc: 'Homing. Sold in racks of four. Refuses polite conversation entirely.',
  },
  {
    id: 'dart', name: 'Dart Swarm', kind: 'missile', size: 'light',
    dmg: 28, speed: 380, turn: 4.1, cooldown: 1.1, energy: 4, range: 1050,
    price: 2200, color: 0x9fffd0, rack: 6, maxAmmo: 24,
    desc: 'A fan of tiny, viciously agile seekers. Made to run down interceptors and other regrets.',
  },
  {
    id: 'ion', name: 'Ion Breaker Missile', kind: 'missile', size: 'light',
    dmg: 33, shieldBonus: 2.4, speed: 305, turn: 2.3, cooldown: 1.6, energy: 6, range: 1300,
    price: 5800, color: 0x7cd8ff, rack: 4, maxAmmo: 12,
    desc: 'Tuned to detonate against energy lattices: more than double damage while shields hold, a shrug once they fall.',
  },
  {
    id: 'ripper', name: 'Ripper Autolaser', kind: 'laser', size: 'light',
    dmg: 5.5, speed: 575, cooldown: 0.14, energy: 2.0, range: 640, spread: 0.09,
    price: 15200, color: 0xa0ffd0,
    desc: 'A shredder of a laser: obscene rate of fire, the aim of a sprinkler.',
  },
  {
    id: 'flechette', name: 'Flechette Rack', kind: 'kinetic', size: 'light',
    dmg: 4, speed: 510, cooldown: 0.13, energy: 1.3, range: 560, spread: 0.17,
    price: 12400, color: 0xd8ffb0,
    desc: 'A cloud of spinning darts. Individually harmless; collectively a bad decision.',
  },
  {
    id: 'stiletto', name: 'Stiletto Beam', kind: 'beam', size: 'light',
    dmg: 4.5, cooldown: 0.15, energy: 2.4, range: 620,
    price: 16800, color: 0xff9ad0,
    desc: 'A needle of coherent light. Draws a line to whatever it hates and keeps drawing.',
  },
  {
    id: 'scalpel', name: 'Scalpel Ray', kind: 'beam', size: 'light',
    dmg: 4, cooldown: 0.14, energy: 2.8, range: 820,
    price: 21500, color: 0x7ce8ff,
    desc: 'Surgical wavelength, clinic manners. Finds seams in shields you did not know were there.',
  },
  {
    id: 'hellbore', name: 'Hellbore Lance', kind: 'beam', size: 'heavy',
    dmg: 13, cooldown: 0.46, energy: 10, range: 900,
    price: 44000, color: 0xff7040,
    desc: 'A drilling beam that eats through hull the way a lecture eats through dinner.',
  },
  {
    id: 'gauss', name: 'Gauss Driver', kind: 'kinetic', size: 'heavy',
    dmg: 51, speed: 850, cooldown: 1.5, energy: 11, range: 1150, spread: 0.003,
    price: 32000, color: 0xcfe8ff,
    desc: 'One slug, no conversation. The recoil is somebody else’s problem.',
  },
  {
    id: 'torpedo', name: 'Torpedo Rack', kind: 'missile', size: 'heavy',
    dmg: 92, speed: 235, turn: 1.8, cooldown: 2.7, energy: 10, range: 1900,
    price: 18600, color: 0xffc060, rack: 2, maxAmmo: 8,
    desc: 'Homing warheads for people you have stopped negotiating with. Sold in pairs.',
  },
  {
    id: 'cruise', name: 'Lance Cruise Missile', kind: 'missile', size: 'heavy',
    dmg: 80, speed: 210, turn: 1.2, cooldown: 2.3, energy: 8, range: 2600,
    price: 12500, color: 0xd0a0ff, rack: 2, maxAmmo: 6,
    desc: 'A patient, long-legged seeker for targets who think distance is safety. It disagrees, slowly.',
  },
  {
    id: 'siege', name: 'Siege Torpedo', kind: 'missile', size: 'heavy',
    dmg: 150, speed: 185, turn: 0.9, cooldown: 3.5, energy: 12, range: 2200,
    price: 34000, color: 0xff8a5c, rack: 1, maxAmmo: 4,
    desc: 'One colossal warhead on a slow engine, built to open things that call themselves armoured. Sold singly.',
  },
  {
    id: 'warden', name: 'Warden Lance', kind: 'laser', size: 'heavy', unique: 'vig',
    dmg: 26, speed: 630, cooldown: 0.7, energy: 9, range: 980, spread: 0.015,
    price: 34000, color: 0x8ff6ff,
    desc: 'A Vigil line-gun with the reach of a courtroom writ. Precise, patient, final. Fitted only to those who hold the Watch’s line.',
  },
  {
    id: 'clanfang', name: 'Clanfang Ripper', kind: 'kinetic', size: 'medium', unique: 'rea',
    dmg: 12, speed: 520, cooldown: 0.18, energy: 2.8, range: 620, spread: 0.09,
    price: 30000, color: 0xff9a6a,
    desc: 'Teeth of the Clans: a hailstorm of splintered plating torn off lesser ships and fired back at their friends.',
  },
  {
    id: 'arbiter', name: 'Arbiter Beam', kind: 'beam', size: 'heavy', unique: 'com',
    dmg: 13, cooldown: 0.46, energy: 10, range: 900,
    price: 38000, color: 0xffd27a,
    desc: 'Combine arbitration, delivered as light. Settles most disputes in a single pass of the ledger.',
  },
  {
    id: 'carver', name: "Chef's Carver", kind: 'kinetic', size: 'light', unique: 'quest',
    dmg: 15, speed: 520, cooldown: 0.6, energy: 3.6, range: 700, spread: 0.03,
    price: 21500, color: 0xffe0b0,
    desc: 'Ground fine, shipped fresh, rated for both. The blade you can hear across eight hundred metres of vacuum.',
  },
  {
    id: 'encore', name: 'Encore', kind: 'laser', size: 'light', unique: 'quest',
    dmg: 18, speed: 630, cooldown: 0.46, energy: 5, range: 760, spread: 0.015,
    price: 26500, color: 0xc0a0ff,
    desc: 'One more number, always one more. The dead broadcaster’s twin emitters, rebuilt and remastered.',
  },
  {
    id: 'shepherd', name: 'Shepherd Rack', kind: 'missile', size: 'light', unique: 'quest',
    dmg: 29, speed: 420, turn: 4.5, cooldown: 1.0, energy: 4, range: 1100,
    price: 24000, color: 0xd0ffe0, rack: 8, maxAmmo: 32,
    desc: 'Herds strays with a gentle hand. The strays are hostile interceptors; the hand is not gentle.',
  },

  /* ------------------------------------------------------------------ */
  /* Shield-flayers and armour-crackers — the rock to the disruptor's      */
  /* scissors. Strip the lattice, snare the drives, take the ship whole.   */
  /* ------------------------------------------------------------------ */
  {
    id: 'ionlash', name: 'Ion Lash', kind: 'laser', size: 'light',
    dmg: 11, shieldBonus: 2.6, hullFactor: 0.35, speed: 600, cooldown: 0.4, energy: 4.5, range: 700, spread: 0.02,
    price: 14200, color: 0x9fd8ff,
    desc: 'Tuned to the resonance of a lattice and useless against a bare keel. Whistle the bubble away, then send in something that bites metal.',
  },
  {
    id: 'spike', name: 'Spike Driver', kind: 'kinetic', size: 'medium',
    dmg: 22, hullBonus: 1.9, speed: 700, cooldown: 0.85, energy: 7, range: 860, spread: 0.008,
    price: 21000, color: 0xd8e8ff,
    desc: 'Long-rod penetrators that only care about armour. Pointless against a raised lattice, ruinous once it is down.',
  },
  {
    id: 'breach', name: 'Breach Missile', kind: 'missile', size: 'heavy',
    dmg: 64, hullBonus: 2.1, speed: 240, turn: 1.9, cooldown: 2.4, energy: 9, range: 1700,
    price: 22800, color: 0xffb070, rack: 2, maxAmmo: 8,
    desc: 'A tandem warhead for a hull you have already undressed. Fired into a raised shield it is just an expensive firework.',
  },

  /* ------------------------------------------------------------------ */
  /* Disruptors — snare coils. Fired with X. They do almost nothing to a   */
  /* raised lattice and nothing at all to bare hull; what they do is put   */
  /* the drives and guns of an unshielded ship to sleep. Three good hits   */
  /* snare a hull, whatever the emitter is bolted to.                      */
  /* ------------------------------------------------------------------ */
  {
    id: 'snare', name: 'Snare Coil', kind: 'disruptor', size: 'light',
    dmg: 3, disablePower: 1, speed: 430, cooldown: 0.5, energy: 4.5, range: 560, spread: 0.06,
    price: 7400, color: 0xb08cff,
    desc: 'The yard-standard snare. Short-legged, cheap, and enough to leave a stripped hull drifting and quiet.',
  },
  {
    id: 'hush', name: 'Hush Emitter', kind: 'disruptor', size: 'light',
    dmg: 2.5, disablePower: 1, speed: 520, cooldown: 0.42, energy: 4, range: 500, spread: 0.09,
    price: 11200, color: 0xc0a8ff,
    desc: 'A fast, sloppy snare for knife-range work. Spray it at a bare hull and let the noise do the arithmetic.',
  },
  {
    id: 'damping', name: 'Damping Lance', kind: 'disruptor', size: 'light',
    dmg: 4, disablePower: 1, speed: 480, cooldown: 0.46, energy: 5.2, range: 700, spread: 0.03,
    price: 16900, color: 0x9aa8ff,
    desc: 'A disciplined snare with the reach of a duelling laser. The favoured tool of captains who take ships rather than break them.',
  },
  {
    id: 'mute', name: 'Mute Projector', kind: 'disruptor', size: 'light',
    dmg: 3.5, disablePower: 1, speed: 500, cooldown: 0.38, energy: 5, range: 640, spread: 0.05,
    price: 19400, color: 0xa8c8ff,
    desc: 'Rapid alternation between two snare frequencies. Most crews hear the second one arriving.',
  },
  {
    id: 'lien', name: 'Lien Projector', kind: 'disruptor', size: 'light', unique: 'com',
    dmg: 3, disablePower: 1, speed: 540, cooldown: 0.34, energy: 4.2, range: 660, spread: 0.04,
    price: 30000, color: 0xffd27a,
    desc: 'Combine enforcement hardware: a snare filed as a claim. It stops your drives and then bills you for the recovery.',
  },
  {
    id: 'hobble', name: 'Hobble Lance', kind: 'disruptor', size: 'medium', unique: 'rea',
    dmg: 5, disablePower: 1, speed: 470, cooldown: 0.5, energy: 6, range: 720, spread: 0.04,
    price: 31000, color: 0xff9a6a,
    desc: 'Clan work, blunt and personal. Meant to leave a prize intact enough to be worth towing home.',
  },
  {
    id: 'pax', name: 'Pax Emitter', kind: 'disruptor', size: 'heavy',
    dmg: 5, disablePower: 1, speed: 450, cooldown: 0.72, energy: 9, range: 880, spread: 0.02,
    price: 28500, color: 0x8fe0ff,
    desc: 'A heavy snare with a statesman’s reach and a statesman’s patience. Argues a hull into silence from well outside its own guns.',
  },
  {
    id: 'interdictor', name: 'Interdictor Coil', kind: 'disruptor', size: 'heavy', unique: 'vig',
    dmg: 6.5, disablePower: 1, speed: 430, cooldown: 0.62, energy: 9, range: 900, spread: 0.02,
    price: 42000, color: 0x8ff6ff,
    desc: 'Watch interdiction gear: a lawful order, delivered as a coil. Bring a raider to a stop without a single casualty report.',
  },
  {
    id: 'silencer', name: 'Silence Projector', kind: 'disruptor', size: 'heavy',
    dmg: 6, disablePower: 1, speed: 410, cooldown: 0.8, energy: 10, range: 960, spread: 0.015,
    price: 39000, color: 0xa090ff,
    desc: 'Long-range snaring for hulls that would rather leave. Reaches further than most captains think to run.',
  },
  {
    id: 'quietword', name: 'Quiet Word', kind: 'disruptor', size: 'heavy', unique: 'relic', legend: true, band: 3,
    dmg: 7, disablePower: 1, speed: 380, cooldown: 0.55, energy: 12, range: 1050, spread: 0.02,
    price: 90000, color: 0xd8c0ff,
    desc: 'Pre-descent interdiction, kept in a shrine because nobody wanted it sold. It does not damage a ship. It simply ends the argument.',
  },

  /* ------------------------------------------------------------------ */
  /* Relics — legendary gear out of the sealed vaults. `band` grades them   */
  /* for their era: I suits young pilots, III suits the far end of the      */
  /* ladder. Recovered by relic-hunt contracts; fitted at mechanics once    */
  /* the collector has logged the find.                                    */
  /* ------------------------------------------------------------------ */
  {
    id: 'bellwether', name: 'Bellwether Autogun', kind: 'kinetic', size: 'light', unique: 'relic', legend: true, band: 1,
    dmg: 11, speed: 540, cooldown: 0.4, energy: 2.6, range: 700, spread: 0.05,
    price: 36000, color: 0xffd27a,
    desc: 'Salvaged from a wayside shrine, still wearing its votive tags. The first shot always rings true; the rest argue pleasantly.',
  },
  {
    id: 'thornlight', name: 'Thornlight', kind: 'laser', size: 'light', unique: 'relic', legend: true, band: 1,
    dmg: 13, speed: 640, cooldown: 0.46, energy: 4.2, range: 780, spread: 0.012,
    price: 41000, color: 0xc0ffe8,
    desc: 'A duelling emitter from before the Descent, its housing grown over with braided wire like a rose stem. It has opinions about your aim.',
  },
  {
    id: 'griefheart', name: 'Griefheart Rail', kind: 'kinetic', size: 'heavy', unique: 'relic', legend: true, band: 2,
    dmg: 38, speed: 680, cooldown: 1.05, energy: 9, range: 960, spread: 0.004,
    price: 128000, color: 0xffa060,
    desc: 'The rail remembers every round fired through it; the log is full, and the last entry is in a different hand. It does not miss twice.',
  },
  {
    id: 'evenstar', name: 'Evenstar Lance', kind: 'laser', size: 'heavy', unique: 'relic', legend: true, band: 2,
    dmg: 30, speed: 620, cooldown: 0.66, energy: 9.5, range: 900, spread: 0.01,
    price: 142000, color: 0xfff0c0,
    desc: 'A star-metal emitter that holds its light like a held breath, then lets it go. Two centuries of gunnery, none of it improving the weather it fired into.',
  },
  {
    id: 'lastargument', name: 'Last Argument', kind: 'beam', size: 'heavy', unique: 'relic', legend: true, band: 3,
    dmg: 18, cooldown: 0.42, energy: 11, range: 950,
    price: 330000, color: 0xffe8d0,
    desc: 'The old admirals kept one weapon for the day diplomacy failed, and named it honestly. The beam does not taper. Neither does the argument.',
  },
  {
    id: 'silentbell', name: 'Silent Bell', kind: 'missile', size: 'heavy', unique: 'relic', legend: true, band: 3,
    dmg: 120, speed: 250, turn: 2.0, cooldown: 2.2, energy: 10, range: 2100,
    price: 300000, color: 0xd8c0ff, rack: 2, maxAmmo: 10,
    desc: 'A warhead from the quiet years, tuned to a note nobody hears until after. It does not ring; it resolves.',
  },
];

/**
 * Gun-velocity trim — one knob for every hull in the sky, player or npc.
 * Projectile speed (bolts, slugs and missiles alike) is scaled here; beams
 * are instant rays and carry no speed. Damage, cadence and range are untouched.
 */
export const GUN_SPEED_TRIM = 0.75;
for (const w of WEAPONS) {
  if (typeof w.speed === 'number') w.speed = Math.round(w.speed * GUN_SPEED_TRIM);
}

export const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));
