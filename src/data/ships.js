// Ship classes. `shape` selects a procedural hull in core/meshes.js.
//
// Acquisition routes:
//   (default)   sold at shipyards, gated by `minTech` against system tech
//   `yards`     sold only at those systems' shipyards (built-to-order hulls)
//   `unique`    licensed — earned via a story path ('vig'|'rea'|'com') or a
//               side-quest chain (chain id); appears in shipyards once unlocked
//   `capture`   prize-only — never sold. Force one to strike its colours in
//               flight and claim the hulk. `price` is only a salvage basis.

export const SHIPS = [
  {
    id: 'wayfarer', name: 'Wayfarer Cutter', cls: 'Cutter', price: 0, minTech: 0,
    hull: 290, shield: 175, shieldRegen: 5.4, energy: 125, energyRegen: 17,
    accel: 54, maxSpeed: 228, brake: 85, turn: 2.8, cargo: 50,
    len: 26, radius: 15, shape: 'cutter', color: 0x9fd8ff,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['pulse', 'needler'],
    desc: 'A nimble cutter with a fresh keel and honest drives. Fast on the helm, cheap to run, forgiving of mistakes.',
  },
  {
    id: 'sparrowhawk', name: 'Sparrowhawk Interceptor', cls: 'Interceptor', price: 36000, minTech: 6,
    hull: 185, shield: 160, shieldRegen: 5.1, energy: 110, energyRegen: 15,
    accel: 58, maxSpeed: 245, brake: 90, turn: 2.4, cargo: 25,
    len: 30, radius: 16, shape: 'sloop', color: 0xbde3ff,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['pulse', null],
    desc: 'A duellist’s hull: light, quick on the helm, hungry for a knife fight.',
  },
  {
    id: 'vagrant', name: 'Vagrant Hauler', cls: 'Freighter', price: 52000, minTech: 4,
    hull: 385, shield: 145, shieldRegen: 3.2, energy: 120, energyRegen: 14,
    accel: 30, maxSpeed: 155, brake: 55, turn: 1.5, cargo: 140,
    len: 42, radius: 22, shape: 'freighter', color: 0xd8cfa8,
    mounts: 2, maxMounts: 2, bays: 0, maxBays: 0, defaultWeapons: ['needler', null],
    desc: 'A broad-beamed hauler with honest holds and a slow helm. Profitable, if it lives.',
  },
  {
    id: 'corsair', name: 'Corsair Raider', cls: 'Raider', price: 68000, minTech: 7,
    hull: 305, shield: 190, shieldRegen: 4.2, energy: 110, energyRegen: 14,
    accel: 52, maxSpeed: 260, brake: 85, turn: 2.2, cargo: 30,
    len: 34, radius: 18, shape: 'corsair', color: 0xffb0a0,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['needler', 'harpoon'],
    desc: 'Reaver-built raider. Fast off the mark, faster out of trouble.',
  },
  {
    id: 'stormgalleon', name: 'Stormgalleon', cls: 'Heavy Freighter', price: 132000, minTech: 6,
    hull: 690, shield: 255, shieldRegen: 3.8, energy: 130, energyRegen: 14,
    accel: 22, maxSpeed: 120, brake: 45, turn: 1.0, cargo: 320,
    len: 58, radius: 30, shape: 'galleon', color: 0xe8d9b0,
    mounts: 2, maxMounts: 3, bays: 1, maxBays: 2, defaultWeapons: ['needler', null],
    desc: 'A mountain of cargo with drives to match. The lanes whisper its name and get out of its way.',
  },
  {
    id: 'halcyon', name: 'Halcyon Frigate', cls: 'Frigate', price: 188000, minTech: 9,
    hull: 740, shield: 540, shieldRegen: 5.4, energy: 150, energyRegen: 17,
    accel: 44, maxSpeed: 205, brake: 80, turn: 1.9, cargo: 60,
    len: 46, radius: 24, shape: 'keel', color: 0xcfe8ff,
    mounts: 3, maxMounts: 5, bays: 1, maxBays: 2, defaultWeapons: ['pulse', 'sunbeam', null],
    desc: 'Vigil-built frigate: a warship that deigns to carry your luggage.',
  },
  {
    id: 'voskar', name: 'Voskar War-Cutter', cls: 'War-Cutter', price: 96000, minTech: 8,
    hull: 415, shield: 240, shieldRegen: 4.5, energy: 120, energyRegen: 15,
    accel: 50, maxSpeed: 240, brake: 88, turn: 2.3, cargo: 45,
    len: 36, radius: 19, shape: 'corsair', color: 0xe8a05a,
    mounts: 3, maxMounts: 4, bays: 0, maxBays: 0, defaultWeapons: ['twinpulse', 'harpoon', null],
    desc: 'Struck in the Houses’ forges to carry a grievance across a whole lane. They sell to outsiders — for a price, and a story about how you mean to use it.',
  },
  {
    id: 'anvil', name: 'Anvil Cruiser', cls: 'Cruiser', price: 320000, minTech: 8,
    hull: 980, shield: 780, shieldRegen: 6.7, energy: 180, energyRegen: 19,
    accel: 38, maxSpeed: 190, brake: 70, turn: 1.7, cargo: 120,
    len: 62, radius: 31, shape: 'citadel', color: 0xa8c4e8,
    mounts: 4, maxMounts: 6, bays: 2, maxBays: 4, defaultWeapons: ['flenser', 'flenser', 'pulse', 'harpoon', null],
    desc: 'A line cruiser built around its gun decks and two small launch bays. Fleet captains park their reputations in this hull.',
  },
  {
    id: 'hearth', name: 'Hearth Carrier', cls: 'Carrier', price: 420000, minTech: 9,
    hull: 1025, shield: 610, shieldRegen: 6.1, energy: 200, energyRegen: 20,
    accel: 26, maxSpeed: 150, brake: 55, turn: 1.2, cargo: 260,
    len: 74, radius: 37, shape: 'ark', variant: 'fleet', color: 0xd8e0ea,
    mounts: 2, maxMounts: 4, bays: 4, maxBays: 6, defaultWeapons: ['pulse', 'pulse', 'harpoon', null],
    desc: 'Less a warship than a flying harbour: four launch bays, workshops, and room for everything that follows you home.',
  },
  {
    id: 'wasp', name: 'Wasp Interceptor', cls: 'Fighter', price: 9200, minTech: 5,
    hull: 90, shield: 65, shieldRegen: 4.2, energy: 60, energyRegen: 11,
    accel: 78, maxSpeed: 290, brake: 110, turn: 3.1, cargo: 0,
    len: 18, radius: 10, shape: 'sloop', color: 0xffe0a0,
    mini: true, mounts: 1, maxMounts: 1, bays: 0, maxBays: 0, defaultWeapons: ['needler', null],
    desc: 'A single-seat interceptor small enough to nest in a docking bay. Cheap, agile, and utterly fearless for exactly eleven seconds.',
  },
  {
    id: 'vanguard', name: 'Vigil Vanguard', cls: 'Picketing Frigate', price: 96000, minTech: 8, unique: 'vig',
    hull: 335, shield: 335, shieldRegen: 6.4, energy: 140, energyRegen: 17,
    accel: 58, maxSpeed: 248, brake: 92, turn: 2.5, cargo: 40,
    len: 38, radius: 20, shape: 'sloop', color: 0xbfe9ff,
    mounts: 3, maxMounts: 4, bays: 0, maxBays: 1, defaultWeapons: ['pulse', 'harpoon', null],
    desc: 'A Watch picket hull: fast enough to catch raiders, plated enough to hold them until the line arrives. Fitted to sworn pilots of the Long Watch.',
  },
  {
    id: 'ravager', name: 'Clan Ravager', cls: 'War-Raider', price: 104000, minTech: 8, unique: 'rea',
    hull: 480, shield: 270, shieldRegen: 4.8, energy: 130, energyRegen: 15,
    accel: 60, maxSpeed: 252, brake: 95, turn: 2.5, cargo: 35,
    len: 40, radius: 21, shape: 'corsair', color: 0xffa080,
    mounts: 3, maxMounts: 4, bays: 0, maxBays: 1, defaultWeapons: ['flenser', 'harpoon', null],
    desc: 'A corsair rebuilt by Clan hands: more plate, more spite, and a helm that answers before you ask. Sold to the blood-oathful.',
  },
  {
    id: 'clipper', name: 'Combine Clipper', cls: 'Fast Freighter', price: 148000, minTech: 9, unique: 'com',
    hull: 545, shield: 240, shieldRegen: 4.8, energy: 130, energyRegen: 15,
    accel: 42, maxSpeed: 214, brake: 80, turn: 1.6, cargo: 260,
    len: 50, radius: 26, shape: 'galleon', color: 0xe8d8a8,
    mounts: 2, maxMounts: 3, bays: 1, maxBays: 2, defaultWeapons: ['needler', 'pulse', null],
    desc: 'A Combine runabout: holds like a warehouse, manners of a courier, registry that opens doors. Licensed only to the Combine’s own.',
  },
  {
    id: 'mule', name: 'Mule Tender', cls: 'Light Freighter', price: 21000, minTech: 3,
    hull: 235, shield: 115, shieldRegen: 3.4, energy: 115, energyRegen: 14,
    accel: 34, maxSpeed: 168, brake: 60, turn: 1.7, cargo: 95,
    len: 38, radius: 20, shape: 'freighter', color: 0xcfc49a,
    mounts: 2, maxMounts: 2, bays: 0, maxBays: 0, defaultWeapons: ['needler', null],
    desc: 'A barn door with engines and a bookkeeper’s soul. Slower than gossip and twice as reliable.',
  },
  {
    id: 'cutlass', name: 'Cutlass Interceptor', cls: 'Fighter', price: 14000, minTech: 6,
    hull: 105, shield: 75, shieldRegen: 4.4, energy: 65, energyRegen: 12,
    accel: 82, maxSpeed: 298, brake: 115, turn: 3.2, cargo: 0,
    len: 19, radius: 10, shape: 'sloop', color: 0xffc8a0,
    mini: true, mounts: 1, maxMounts: 1, bays: 0, maxBays: 0, defaultWeapons: ['pulse', null],
    desc: 'A bay-launched knife with a cockpit bolted on as an afterthought. The Vigil flies them in flocks.',
  },
  {
    id: 'shrike', name: 'Shrike Lancer', cls: 'Fighter', price: 16500, minTech: 7,
    hull: 120, shield: 85, shieldRegen: 4.6, energy: 70, energyRegen: 12,
    accel: 74, maxSpeed: 276, brake: 105, turn: 2.9, cargo: 0,
    len: 21, radius: 11, shape: 'sloop', color: 0xc8e8b0,
    mini: true, mounts: 1, maxMounts: 1, bays: 0, maxBays: 0, defaultWeapons: ['needler', null],
    desc: 'Small craft, hit-and-run doctrine. Impatient pilots love it; patient enemies learn to.',
  },
  {
    id: 'harrier', name: 'Harrier Scout', cls: 'Scout', price: 44000, minTech: 5,
    hull: 225, shield: 205, shieldRegen: 5.6, energy: 120, energyRegen: 16,
    accel: 64, maxSpeed: 262, brake: 100, turn: 3.0, cargo: 20,
    len: 27, radius: 15, shape: 'sloop', color: 0xffd8a8,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['pulse', null],
    desc: 'Built to look at things and leave quickly. The looking is optional; the leaving is not.',
  },
  {
    id: 'prospector', name: 'Prospector Rig', cls: 'Survey Ship', price: 58000, minTech: 4,
    hull: 340, shield: 150, shieldRegen: 3.0, energy: 130, energyRegen: 15,
    accel: 28, maxSpeed: 150, brake: 52, turn: 1.6, cargo: 155,
    len: 46, radius: 24, shape: 'freighter', color: 0xd8c8a0,
    mounts: 2, maxMounts: 2, bays: 1, maxBays: 2, defaultWeapons: ['needler', null],
    desc: 'Half laboratory, half quarry, all patience. The survey fees pay better than the ore, which infuriates miners.',
  },
  {
    id: 'breaker', name: 'Breaker Tug', cls: 'Salvage Tug', price: 88000, minTech: 4, yards: ['rusthaven'],
    hull: 520, shield: 190, shieldRegen: 3.6, energy: 125, energyRegen: 15,
    accel: 32, maxSpeed: 158, brake: 70, turn: 1.7, cargo: 130,
    len: 44, radius: 22, shape: 'cradle', color: 0xc8b8a8,
    mounts: 2, maxMounts: 3, bays: 1, maxBays: 1, defaultWeapons: ['needler', null],
    desc: 'A wrecker’s tug with cutters on the bow and a hold for what the cutters find. Rusthaven builds them; Rusthaven is where they find their work.',
  },
  {
    id: 'litany', name: 'Litany Pilgrim', cls: 'Pilgrim Liner', price: 96000, minTech: 6, yards: ['vekta'],
    hull: 520, shield: 260, shieldRegen: 3.8, energy: 135, energyRegen: 15,
    accel: 24, maxSpeed: 142, brake: 50, turn: 1.2, cargo: 180,
    len: 52, radius: 27, shape: 'spire', color: 0xe8d8c8,
    mounts: 2, maxMounts: 3, bays: 1, maxBays: 2, defaultWeapons: ['needler', null],
    desc: 'The Houses’ answer to a passenger liner: wine racks, shrine alcoves, and a hold for the pilgrims’ luggage. Sold only from Kor’vath, to those the Houses judge worth carrying.',
  },
  {
    id: 'tortoise', name: 'Tortoise Bulwark', cls: 'Bulwark', price: 124000, minTech: 7,
    hull: 640, shield: 430, shieldRegen: 4.6, energy: 140, energyRegen: 15,
    accel: 26, maxSpeed: 138, brake: 50, turn: 1.3, cargo: 55,
    len: 50, radius: 26, shape: 'block', color: 0xc8b890,
    mounts: 2, maxMounts: 4, bays: 0, maxBays: 0, defaultWeapons: ['flenser', null],
    desc: 'A wall that can be convinced to move. Convoy captains pray to it; raider captains curse it.',
  },
  {
    id: 'spite', name: 'Spite Cutter', cls: 'Clan Raider', price: 118000, minTech: 5, yards: ['houndstooth'],
    hull: 500, shield: 300, shieldRegen: 5.2, energy: 135, energyRegen: 16,
    accel: 56, maxSpeed: 244, brake: 90, turn: 2.4, cargo: 50,
    len: 38, radius: 20, shape: 'corsair', color: 0xff9a70,
    mounts: 3, maxMounts: 4, bays: 0, maxBays: 0, defaultWeapons: ['flenser', 'needler', null],
    desc: 'Welded together in the Ballykerra yards out of whatever the last raid brought home. Sold on Houndstooth only — the Clans call that quality control.',
  },
  {
    id: 'lance', name: 'Lance Corvette', cls: 'Corvette', price: 155000, minTech: 8,
    hull: 450, shield: 400, shieldRegen: 6.0, energy: 150, energyRegen: 17,
    accel: 52, maxSpeed: 242, brake: 92, turn: 2.2, cargo: 40,
    len: 40, radius: 21, shape: 'corsair', color: 0xa8d8e8,
    mounts: 3, maxMounts: 4, bays: 0, maxBays: 0, defaultWeapons: ['pulse', 'pulse', null],
    desc: 'A sprint hull with gun decks. Designed to arrive before the rumour of it does.',
  },
  {
    id: 'magnate', name: 'Magnate Yacht', cls: 'Yacht', price: 190000, minTech: 8, unique: 'broker',
    hull: 480, shield: 420, shieldRegen: 5.4, energy: 155, energyRegen: 18,
    accel: 40, maxSpeed: 260, brake: 78, turn: 1.8, cargo: 140,
    len: 48, radius: 24, shape: 'crown', color: 0xf8e8b8,
    mounts: 2, maxMounts: 4, bays: 1, maxBays: 2, defaultWeapons: ['pulse', null],
    desc: 'Walnut panels, gold trim, a bar the size of a gun deck, and a registry that makes inspectors find urgent business elsewhere. The broker’s own yard builds one a year, for one client.',
  },
  {
    id: 'longwake', name: 'Longwake Packet', cls: 'Packet', price: 210000, minTech: 9,
    hull: 420, shield: 330, shieldRegen: 5.0, energy: 150, energyRegen: 18,
    accel: 46, maxSpeed: 272, brake: 88, turn: 1.9, cargo: 110,
    len: 44, radius: 23, shape: 'cutter', color: 0xbfd8f0,
    mounts: 2, maxMounts: 3, bays: 1, maxBays: 2, defaultWeapons: ['pulse', 'needler', null],
    desc: 'The mail packet out of Grand Bank: fastest honest hull in the Reach. Its schedule is a mild suggestion, its deadlines are not.',
  },
  {
    id: 'ironclad', name: 'Foundry Ironclad', cls: 'Ironclad', price: 265000, minTech: 9,
    hull: 1050, shield: 760, shieldRegen: 5.6, energy: 160, energyRegen: 17,
    accel: 30, maxSpeed: 165, brake: 60, turn: 1.5, cargo: 90,
    len: 58, radius: 29, shape: 'drum', color: 0xb0a888,
    mounts: 4, maxMounts: 6, bays: 1, maxBays: 3, defaultWeapons: ['flenser', 'pulse', null],
    desc: 'Poured, not built. The Foundry’s answer to a question nobody survived to repeat.',
  },
  {
    id: 'caravan', name: 'Caravan Barge', cls: 'Bulk Freighter', price: 340000, minTech: 8,
    hull: 920, shield: 320, shieldRegen: 3.6, energy: 150, energyRegen: 14,
    accel: 18, maxSpeed: 112, brake: 40, turn: 0.9, cargo: 520,
    len: 68, radius: 34, shape: 'stack', color: 0xe0d0a8,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['needler', null],
    desc: 'Not a ship so much as a warehouse that resigned itself to travel. Escorts are not optional; they are arithmetic.',
  },
  {
    id: 'silverwing', name: 'Silverwing Courser', cls: 'Racing Courier', price: 175000, minTech: 9, unique: 'helm',
    hull: 300, shield: 280, shieldRegen: 5.8, energy: 150, energyRegen: 18,
    accel: 72, maxSpeed: 310, brake: 105, turn: 2.6, cargo: 30,
    len: 32, radius: 17, shape: 'cutter', color: 0xf0f0ff,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['pulse', null],
    desc: 'A racing hull with a courier license and a famous grudge against the clock. The Ghost of the Lanes crew builds one a season, and only for their own.',
  },
  {
    id: 'theseus', name: 'Theseus Amalgam', cls: 'Patchwork', price: 132000, minTech: 7, unique: 'hullbone',
    hull: 700, shield: 380, shieldRegen: 4.8, energy: 145, energyRegen: 16,
    accel: 36, maxSpeed: 172, brake: 66, turn: 1.6, cargo: 100,
    len: 54, radius: 27, shape: 'cross', color: 0xcfcfc0,
    mounts: 3, maxMounts: 5, bays: 1, maxBays: 3, defaultWeapons: ['flenser', 'needler', null],
    desc: 'Every plate numbered, every weld signed by a different berth. Rebuilt so many times the original hull is a rumour — and it still flies.',
  },
  {
    id: 'thorn', name: 'Thorn Duellist', cls: 'Duellist', price: 138000, minTech: 8, unique: 'gunhand',
    hull: 380, shield: 340, shieldRegen: 6.2, energy: 140, energyRegen: 17,
    accel: 64, maxSpeed: 266, brake: 98, turn: 2.7, cargo: 25,
    len: 34, radius: 18, shape: 'sloop', color: 0xffb0c0,
    mounts: 3, maxMounts: 4, bays: 0, maxBays: 0, defaultWeapons: ['twinpulse', 'harpoon', null],
    desc: 'A gunhand’s hull: light armour, heavy arguments, and grips worn smooth where better pilots held them.',
  },
  {
    id: 'vulture', name: 'Vulture Marauder', cls: 'Marauder', price: 145000, capture: true,
    hull: 560, shield: 260, shieldRegen: 4.6, energy: 140, energyRegen: 16,
    accel: 48, maxSpeed: 218, brake: 84, turn: 2.0, cargo: 70,
    len: 46, radius: 24, shape: 'corsair', color: 0xd8a080,
    mounts: 3, maxMounts: 4, bays: 0, maxBays: 0, defaultWeapons: ['flenser', 'harpoon', null],
    desc: 'A raider captain’s hull, plated with the wreckage of everyone who tried to take it. Prizes only — nobody sells a Vulture, or admits to owning one.',
  },
  {
    id: 'hound', name: 'Hound Packleader', cls: 'Packleader', price: 120000, capture: true,
    hull: 460, shield: 300, shieldRegen: 5.4, energy: 135, energyRegen: 16,
    accel: 62, maxSpeed: 258, brake: 96, turn: 2.5, cargo: 40,
    len: 40, radius: 21, shape: 'corsair', color: 0xff8866,
    mounts: 3, maxMounts: 4, bays: 0, maxBays: 0, defaultWeapons: ['flenser', 'harpoon', null],
    desc: 'The lead hull of a Reaver pack: fast enough to catch the stragglers, mean enough to eat first. A prize worth bleeding for.',
  },
  {
    id: 'relict', name: 'Relict Marauder', cls: 'Relict', price: 230000, capture: true,
    hull: 900, shield: 500, shieldRegen: 5.8, energy: 160, energyRegen: 18,
    accel: 40, maxSpeed: 196, brake: 74, turn: 1.8, cargo: 90,
    len: 56, radius: 28, shape: 'truss', color: 0x9fb8d0,
    mounts: 3, maxMounts: 5, bays: 1, maxBays: 3, defaultWeapons: ['flenser', 'flenser', null],
    desc: 'Pre-descent bones, dredged out of the quiet graves and refit by hands that know old machinery. The Clans fly them when the water is deep and the law is thin.',
  },

  /* ------------------------------------------------------------------ */
  /* The stepping-stone ladder: low-to-mid hulls from the bottom of the  */
  /* trail up to three-quarters. Commerce, work, and the wars that fits. */
  /* ------------------------------------------------------------------ */
  {
    id: 'skiff', name: 'Skiff Lighter', cls: 'Lighter', price: 4500, minTech: 1,
    hull: 140, shield: 60, shieldRegen: 3.0, energy: 80, energyRegen: 10,
    accel: 60, maxSpeed: 240, brake: 80, turn: 2.6, cargo: 30,
    len: 22, radius: 12, shape: 'shuttle', color: 0xd8c8a0,
    mounts: 1, maxMounts: 2, bays: 0, maxBays: 0, defaultWeapons: ['needler', null],
    desc: 'The first keel most pilots ever own: a dock lighter with a cabin bolted on. It will not win fights; it will pay for the next hull.',
  },
  {
    id: 'hopper', name: 'Hopper Shuttle', cls: 'Shuttle', price: 7800, minTech: 2,
    hull: 165, shield: 75, shieldRegen: 3.2, energy: 85, energyRegen: 11,
    accel: 52, maxSpeed: 185, brake: 75, turn: 2.2, cargo: 55,
    len: 26, radius: 14, shape: 'shuttle', variant: 'van', color: 0xc8d0a8,
    mounts: 1, maxMounts: 2, bays: 0, maxBays: 0, defaultWeapons: ['needler', null],
    desc: 'A tall-sided ferry van for people and parcels. The doors are dented, the schedule is printed, and both are taken seriously.',
  },
  {
    id: 'tern', name: 'Tern Courier', cls: 'Courier', price: 11000, minTech: 3,
    hull: 130, shield: 95, shieldRegen: 4.6, energy: 75, energyRegen: 12,
    accel: 74, maxSpeed: 268, brake: 100, turn: 2.9, cargo: 15,
    len: 24, radius: 13, shape: 'arrow', variant: 'dart', color: 0xffe8b0,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['pulse', null],
    desc: 'A fast little dart with a mail slot and no patience. Couriers fly them like the cargo is on fire and the pay is not.',
  },
  {
    id: 'mole', name: 'Mole Prospector', cls: 'Prospector', price: 13500, minTech: 2,
    hull: 260, shield: 110, shieldRegen: 3.0, energy: 120, energyRegen: 14,
    accel: 30, maxSpeed: 150, brake: 60, turn: 1.5, cargo: 70,
    len: 34, radius: 19, shape: 'miner', color: 0xd8b888,
    mounts: 1, maxMounts: 2, bays: 0, maxBays: 0, defaultWeapons: ['needler', null],
    desc: 'One drill, two floodlights, and a hold that smells of rock dust. Every strike starts with a hull like this and a claim nobody has filed yet.',
  },
  {
    id: 'hoy', name: 'Hoy Lighter', cls: 'Lighter', price: 15800, minTech: 2,
    hull: 230, shield: 95, shieldRegen: 2.8, energy: 110, energyRegen: 13,
    accel: 26, maxSpeed: 142, brake: 52, turn: 1.3, cargo: 120,
    len: 36, radius: 20, shape: 'boxcar', variant: 'flat', color: 0xc8b898,
    mounts: 1, maxMounts: 2, bays: 0, maxBays: 0, defaultWeapons: ['needler', null],
    desc: 'A flat-decked harbour hoy: containers on, containers off, nothing fancy in between. Docks keep a dozen on standby.',
  },
  {
    id: 'skua', name: 'Skua Skirmisher', cls: 'Skirmisher', price: 19000, minTech: 4,
    hull: 100, shield: 80, shieldRegen: 4.8, energy: 70, energyRegen: 12,
    accel: 88, maxSpeed: 300, brake: 115, turn: 3.3, cargo: 0,
    len: 19, radius: 10, shape: 'arrow', variant: 'dart', color: 0xa8d8c8,
    mini: true, mounts: 1, maxMounts: 2, bays: 0, maxBays: 0, defaultWeapons: ['pulse', null],
    desc: 'A bay-launched skirmisher with a delta wing and a grudge. It harasses convoys for a living and hides in crags for free.',
  },

  {
    id: 'drayman', name: 'Drayman Freighter', cls: 'Freighter', price: 24000, minTech: 3,
    hull: 280, shield: 120, shieldRegen: 3.0, energy: 115, energyRegen: 13,
    accel: 28, maxSpeed: 152, brake: 55, turn: 1.4, cargo: 170,
    len: 42, radius: 23, shape: 'boxcar', color: 0xd0c090,
    mounts: 2, maxMounts: 2, bays: 0, maxBays: 0, defaultWeapons: ['needler', null],
    desc: 'The working freighter of a hundred small lanes: stacked containers, a crane that groans, and a captain who knows every tariff by heart.',
  },
  {
    id: 'dhow', name: 'Dhow Trader', cls: 'Trader', price: 27000, minTech: 4,
    hull: 300, shield: 150, shieldRegen: 3.6, energy: 120, energyRegen: 14,
    accel: 40, maxSpeed: 190, brake: 72, turn: 1.9, cargo: 90,
    len: 34, radius: 19, shape: 'manta', color: 0xc8d0b0,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['pulse', null],
    desc: 'A broad, patient trader that rides the lanes like a tide. Carries spices one day, machine parts the next, and a good story every time.',
  },
  {
    id: 'sentinel', name: 'Sentinel Cutter', cls: 'Patrol Cutter', price: 30000, minTech: 5,
    hull: 260, shield: 160, shieldRegen: 4.2, energy: 115, energyRegen: 14,
    accel: 46, maxSpeed: 240, brake: 82, turn: 2.1, cargo: 35,
    len: 30, radius: 16, shape: 'hammer', color: 0xb8c8d8,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['pulse', null],
    desc: 'A hammer-headed picket hull: slow enough to argue, fast enough to catch a smuggler, cheap enough for every harbour authority to fly a few.',
  },
  {
    id: 'dromond', name: 'Dromond Freighter', cls: 'Bulk Freighter', price: 64000, minTech: 4,
    hull: 420, shield: 170, shieldRegen: 3.2, energy: 125, energyRegen: 14,
    accel: 30, maxSpeed: 162, brake: 62, turn: 1.5, cargo: 200,
    len: 46, radius: 25, shape: 'manta', variant: 'heavy', color: 0xd8c8a8,
    mounts: 2, maxMounts: 2, bays: 0, maxBays: 0, defaultWeapons: ['needler', null],
    desc: 'The manta grown fat on freight: cargo cells slung under wide wings, and a wake that tells every raider exactly how much it is worth.',
  },
  {
    id: 'kite', name: 'Kite Clipper', cls: 'Clipper', price: 40000, minTech: 5,
    hull: 210, shield: 170, shieldRegen: 4.8, energy: 110, energyRegen: 15,
    accel: 56, maxSpeed: 235, brake: 90, turn: 2.3, cargo: 45,
    len: 32, radius: 17, shape: 'spine', color: 0xe8e0c8,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['pulse', null],
    desc: 'A slim ring-hulled clipper that turns heads at every berth. Fast, elegant, and just fragile enough to teach humility.',
  },

  {
    id: 'marlin', name: 'Marlin Lancer', cls: 'Lancer', price: 44000, minTech: 6,
    hull: 210, shield: 160, shieldRegen: 5.0, energy: 105, energyRegen: 14,
    accel: 68, maxSpeed: 252, brake: 95, turn: 2.6, cargo: 20,
    len: 30, radius: 16, shape: 'dart', variant: 'heavy', color: 0xb0d8e8,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['pulse', 'needler'],
    desc: 'A heavy delta built for the charge: all its teeth forward, all its doubts left at the dock.',
  },
  {
    id: 'rapier', name: 'Rapier Duelist', cls: 'Duelist', price: 46000, minTech: 6,
    hull: 235, shield: 175, shieldRegen: 5.0, energy: 110, energyRegen: 14,
    accel: 62, maxSpeed: 240, brake: 92, turn: 2.5, cargo: 25,
    len: 32, radius: 17, shape: 'hammer', color: 0xd8d8e8,
    mounts: 3, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['twinpulse', null],
    desc: 'A duellist’s hammerhead with a single hardpoint array and an opinion about the correct distance to fight at.',
  },
  {
    id: 'wrangler', name: 'Wrangler Tug', cls: 'Tug', price: 50000, minTech: 4,
    hull: 360, shield: 150, shieldRegen: 3.4, energy: 125, energyRegen: 15,
    accel: 34, maxSpeed: 158, brake: 66, turn: 1.6, cargo: 80,
    len: 28, radius: 16, shape: 'tug', color: 0xccb890,
    mounts: 2, maxMounts: 2, bays: 0, maxBays: 0, defaultWeapons: ['needler', null],
    desc: 'Grapples forward, winch aft, and a stubbornness rating off the charts. The tug that hauls the haulers home.',
  },
  {
    id: 'ox', name: 'Ox Hauler', cls: 'Heavy Hauler', price: 54000, minTech: 4,
    hull: 500, shield: 170, shieldRegen: 3.2, energy: 135, energyRegen: 14,
    accel: 22, maxSpeed: 128, brake: 48, turn: 1.1, cargo: 260,
    len: 50, radius: 27, shape: 'boxcar', color: 0xd8c8a0,
    mounts: 2, maxMounts: 2, bays: 0, maxBays: 0, defaultWeapons: ['needler', null],
    desc: 'A container stack with a bridge on the shoulder. Slow as the tide and twice as strong, if twice as slow is possible.',
  },
  {
    id: 'watchman', name: 'Watchman Picket', cls: 'Picket', price: 60000, minTech: 6,
    hull: 340, shield: 240, shieldRegen: 5.2, energy: 130, energyRegen: 15,
    accel: 52, maxSpeed: 222, brake: 86, turn: 2.2, cargo: 40,
    len: 36, radius: 19, shape: 'hammer', variant: 'twin', color: 0xa8c8d8,
    mounts: 3, maxMounts: 4, bays: 0, maxBays: 0, defaultWeapons: ['pulse', 'needler', null],
    desc: 'A twin-bar hammerhead that spends its life in the dark between lanes, waiting to be the first thing a raider regrets seeing.',
  },
  {
    id: 'ketch', name: 'Ketch Trader', cls: 'Freighter', price: 62000, minTech: 5,
    hull: 420, shield: 195, shieldRegen: 3.8, energy: 130, energyRegen: 14,
    accel: 36, maxSpeed: 178, brake: 68, turn: 1.7, cargo: 150,
    len: 40, radius: 22, shape: 'manta', color: 0xd0d8a8,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['pulse', null],
    desc: 'A two-masted soul in a metal hull: the ketch trades wide and light, turning bulk freight into margins one berth at a time.',
  },
  {
    id: 'schooner', name: 'Schooner Freighter', cls: 'Freighter', price: 66000, minTech: 6,
    hull: 520, shield: 210, shieldRegen: 3.6, energy: 130, energyRegen: 14,
    accel: 26, maxSpeed: 148, brake: 56, turn: 1.3, cargo: 280,
    len: 48, radius: 26, shape: 'freighter', color: 0xe0d8b8,
    mounts: 2, maxMounts: 2, bays: 0, maxBays: 0, defaultWeapons: ['needler', null],
    desc: 'The classic mid-lane freighter: honest holds, honest helm, and a captain who has already told the pirates where to find him.',
  },

  {
    id: 'brig', name: 'Brig Escort', cls: 'Escort', price: 74000, minTech: 6,
    hull: 420, shield: 300, shieldRegen: 5.4, energy: 140, energyRegen: 16,
    accel: 50, maxSpeed: 230, brake: 88, turn: 2.2, cargo: 45,
    len: 40, radius: 21, shape: 'hammer', variant: 'twin', color: 0xb8d0d8,
    mounts: 3, maxMounts: 4, bays: 0, maxBays: 0, defaultWeapons: ['pulse', 'needler', null],
    desc: 'A convoy escort built to stand between the cargo and the problem. It rarely wins alone; it never fights alone.',
  },
  {
    id: 'brigantine', name: 'Brigantine Raider', cls: 'Raider', price: 78000, minTech: 6,
    hull: 480, shield: 260, shieldRegen: 4.8, energy: 135, energyRegen: 15,
    accel: 46, maxSpeed: 226, brake: 84, turn: 2.0, cargo: 60,
    len: 40, radius: 21, shape: 'manta', color: 0xd8a888,
    mounts: 3, maxMounts: 4, bays: 0, maxBays: 0, defaultWeapons: ['needler', 'harpoon', null],
    desc: 'A manta rebuilt for the taking rather than the trading: gill intakes, hidden launchers, and a reputation it did not ask for.',
  },
  {
    id: 'fluyt', name: 'Fluyt Freighter', cls: 'Bulk Freighter', price: 82000, minTech: 5,
    hull: 620, shield: 220, shieldRegen: 3.4, energy: 140, energyRegen: 14,
    accel: 20, maxSpeed: 124, brake: 46, turn: 1.0, cargo: 340,
    len: 56, radius: 30, shape: 'boxcar', color: 0xd0c8a8,
    mounts: 2, maxMounts: 2, bays: 0, maxBays: 0, defaultWeapons: ['needler', null],
    desc: 'The fluyt was designed to carry the most cargo for the least crew, and five centuries later it still is. Ugliness is part of the specification.',
  },
  {
    id: 'sabre', name: 'Sabre Corvette', cls: 'Corvette', price: 86000, minTech: 7,
    hull: 320, shield: 270, shieldRegen: 5.8, energy: 140, energyRegen: 16,
    accel: 66, maxSpeed: 260, brake: 98, turn: 2.6, cargo: 30,
    len: 36, radius: 19, shape: 'twin', variant: 'heavy', color: 0xc8d8f0,
    mounts: 3, maxMounts: 4, bays: 0, maxBays: 0, defaultWeapons: ['twinpulse', 'harpoon', null],
    desc: 'A heavy delta corvette that fights the way its name suggests: straight, fast, and only one of you walks away impressed.',
  },
  {
    id: 'pinnace', name: 'Pinnace Runner', cls: 'Runner', price: 90000, minTech: 6,
    hull: 340, shield: 280, shieldRegen: 5.6, energy: 140, energyRegen: 16,
    accel: 58, maxSpeed: 252, brake: 92, turn: 2.3, cargo: 60,
    len: 38, radius: 20, shape: 'spine', color: 0xe8e8d8,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['pulse', 'needler', null],
    desc: 'A ring-hulled runner for dispatches and delicate passengers: quick, quiet at the helm, and always booked.',
  },
  {
    id: 'carrack', name: 'Carrack Freighter', cls: 'Galleon', price: 96000, minTech: 6,
    hull: 680, shield: 300, shieldRegen: 4.2, energy: 140, energyRegen: 15,
    accel: 24, maxSpeed: 142, brake: 52, turn: 1.3, cargo: 320,
    len: 58, radius: 30, shape: 'galleon', color: 0xd8c8a0,
    mounts: 3, maxMounts: 4, bays: 0, maxBays: 0, defaultWeapons: ['pulse', 'needler', null],
    desc: 'The carrack is half warehouse and half gun deck — a hull that expects the lanes to be trouble and charges accordingly.',
  },

  {
    id: 'monitor', name: 'Monitor Gunboat', cls: 'Gunboat', price: 108000, minTech: 7,
    hull: 640, shield: 380, shieldRegen: 4.8, energy: 150, energyRegen: 15,
    accel: 30, maxSpeed: 158, brake: 60, turn: 1.4, cargo: 50,
    len: 46, radius: 24, shape: 'hammer', variant: 'twin', color: 0xa8b8c8,
    mounts: 3, maxMounts: 4, bays: 0, maxBays: 0, defaultWeapons: ['flenser', 'pulse', null],
    desc: 'A gun platform with an engine bolted to it and opinions about movement. Where a monitor parks, lanes close.',
  },
  {
    id: 'galleass', name: 'Galleass Cruiser', cls: 'Cruiser', price: 122000, minTech: 7,
    hull: 760, shield: 380, shieldRegen: 4.6, energy: 150, energyRegen: 16,
    accel: 28, maxSpeed: 162, brake: 58, turn: 1.5, cargo: 200,
    len: 60, radius: 31, shape: 'citadel', variant: 'cruiser', color: 0xe0d0a0,
    mounts: 3, maxMounts: 4, bays: 1, maxBays: 2, defaultWeapons: ['flenser', 'pulse', null],
    desc: 'A galleon with its teeth out: a trade hull armoured to the gunwales, built for captains who deliver their own cargo personally.',
  },
  {
    id: 'pathfinder', name: 'Pathfinder Explorer', cls: 'Explorer', price: 138000, minTech: 7,
    hull: 470, shield: 360, shieldRegen: 5.6, energy: 150, energyRegen: 17,
    accel: 46, maxSpeed: 238, brake: 86, turn: 2.1, cargo: 120,
    len: 46, radius: 24, shape: 'spine', variant: 'twin', color: 0xd8e0e8,
    mounts: 2, maxMounts: 3, bays: 1, maxBays: 1, defaultWeapons: ['pulse', 'needler', null],
    desc: 'Two habitat rings, one very good telescope, and charts that end where the rumours begin. The long lanes are drawn by hulls like this.',
  },
  {
    id: 'venturer', name: 'Venturer Cruiser', cls: 'Cruiser', price: 158000, minTech: 8,
    hull: 560, shield: 420, shieldRegen: 6.0, energy: 160, energyRegen: 17,
    accel: 44, maxSpeed: 230, brake: 84, turn: 2.0, cargo: 150,
    len: 50, radius: 26, shape: 'spine', variant: 'twin', color: 0xf0e0b8,
    mounts: 3, maxMounts: 4, bays: 1, maxBays: 2, defaultWeapons: ['pulse', 'flenser', null],
    desc: 'A grand twin-ring cruiser for captains who trade far and arrive in style: strong enough to be alone, fast enough to stay that way.',
  },
  {
    id: 'express', name: 'Express Pinnace', cls: 'Fast Courier', price: 178000, minTech: 8,
    hull: 400, shield: 360, shieldRegen: 6.4, energy: 155, energyRegen: 17,
    accel: 72, maxSpeed: 288, brake: 105, turn: 2.5, cargo: 50,
    len: 40, radius: 21, shape: 'star', variant: 'heavy', color: 0xe8f0f8,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['twinpulse', 'harpoon', null],
    desc: 'The express contract: sealed case, standing fee, no questions, no slowing down. Built entirely around the second half of that sentence.',
  },
  {
    id: 'sovereign', name: 'Sovereign Liner', cls: 'Liner', price: 215000, minTech: 8,
    hull: 720, shield: 460, shieldRegen: 5.4, energy: 165, energyRegen: 17,
    accel: 38, maxSpeed: 208, brake: 78, turn: 1.8, cargo: 260,
    len: 56, radius: 29, shape: 'manta', variant: 'heavy', color: 0xf8e8c0,
    mounts: 3, maxMounts: 4, bays: 1, maxBays: 2, defaultWeapons: ['pulse', 'flenser', null],
    desc: 'A broad-winged liner for delegations, dignitaries and the very wealthy in a hurry. Its passenger list is shorter than its list of enemies, but only barely.',
  },

  {
    id: 'gig', name: 'Gig Tender', cls: 'Lighter', price: 6500, minTech: 1,
    hull: 130, shield: 70, shieldRegen: 4.0, energy: 70, energyRegen: 12,
    accel: 60, maxSpeed: 230, brake: 90, turn: 2.6, cargo: 25,
    len: 20, radius: 11, shape: 'shuttle', color: 0xcfd8c8,
    mounts: 1, maxMounts: 2, bays: 0, maxBays: 0, defaultWeapons: ['needler', null],
    desc: 'A station’s own runabout: paint tin cockpit, two earnest engines, and a hold that smells of coffee. Everyone’s first keel.',
  },
  {
    id: 'coaster', name: 'Coaster Tramp', cls: 'Tramp Freighter', price: 9800, minTech: 2,
    hull: 220, shield: 95, shieldRegen: 3.2, energy: 100, energyRegen: 13,
    accel: 30, maxSpeed: 150, brake: 58, turn: 1.5, cargo: 85,
    len: 34, radius: 18, shape: 'boxcar', variant: 'flat', color: 0xcdc49c,
    mounts: 2, maxMounts: 2, bays: 0, maxBays: 0, defaultWeapons: ['needler', null],
    desc: 'A tramp that goes wherever the price is embarrassing and the paperwork is thin. Slow, honest, and impossible to kill off.',
  },
  {
    id: 'coble', name: 'Coble Fisher', cls: 'Fisher', price: 15000, minTech: 2,
    hull: 260, shield: 110, shieldRegen: 3.4, energy: 105, energyRegen: 13,
    accel: 32, maxSpeed: 158, brake: 60, turn: 1.55, cargo: 55,
    len: 28, radius: 15, shape: 'tug', color: 0xb8c8b0,
    mounts: 2, maxMounts: 2, bays: 0, maxBays: 0, defaultWeapons: ['needler', null],
    desc: 'A working boat that drags nets through gas shoals and calls it a living. The derricks fold flat when the weather turns — which it does.',
  },
  {
    id: 'scow', name: 'Scow Freighter', cls: 'Scow', price: 22000, minTech: 3,
    hull: 380, shield: 130, shieldRegen: 3.2, energy: 105, energyRegen: 13,
    accel: 24, maxSpeed: 138, brake: 52, turn: 1.2, cargo: 195,
    len: 44, radius: 23, shape: 'boxcar', variant: 'flat', color: 0xc4b890,
    mounts: 2, maxMounts: 2, bays: 0, maxBays: 0, defaultWeapons: ['needler', null],
    desc: 'A flat deck with a promise: if it fits, it flies. Dockmasters love it and its own helm officer has never once been seen smiling.',
  },
  {
    id: 'lark', name: 'Lark Courier', cls: 'Courier', price: 33000, minTech: 5,
    hull: 185, shield: 150, shieldRegen: 5.0, energy: 120, energyRegen: 15,
    accel: 66, maxSpeed: 275, brake: 100, turn: 2.6, cargo: 25,
    len: 30, radius: 16, shape: 'arrow', variant: 'dart', color: 0xd8e8f8,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['pulse', null],
    desc: 'A postal hull with a racing pedigree: light, loud, and booked to the minute. Couriers swear by it and at it in the same breath.',
  },
  {
    id: 'picket', name: 'Picket Skiff', cls: 'Picket', price: 36000, minTech: 5,
    hull: 320, shield: 200, shieldRegen: 4.6, energy: 115, energyRegen: 14,
    accel: 40, maxSpeed: 215, brake: 75, turn: 1.9, cargo: 30,
    len: 32, radius: 17, shape: 'hammer', color: 0xbcc8d4,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['pulse', null],
    desc: 'A cheap customs skiff that parks itself across a lane and waits to be resented. Its single gun is mostly a legal argument.',
  },
  {
    id: 'joiner', name: 'Joiner Packet', cls: 'Packet', price: 43000, minTech: 5,
    hull: 330, shield: 180, shieldRegen: 4.2, energy: 115, energyRegen: 14,
    accel: 44, maxSpeed: 210, brake: 80, turn: 2.0, cargo: 85,
    len: 36, radius: 19, shape: 'shuttle', variant: 'van', color: 0xd0c8a8,
    mounts: 2, maxMounts: 2, bays: 0, maxBays: 0, defaultWeapons: ['needler', null],
    desc: 'The packet boat that threads the little lanes: spare parts, mail, and the occasional passenger with no fixed name.',
  },
  {
    id: 'nester', name: 'Nester Salvage', cls: 'Salvage Rig', price: 48000, minTech: 4,
    hull: 470, shield: 240, shieldRegen: 4.2, energy: 120, energyRegen: 14,
    accel: 38, maxSpeed: 190, brake: 72, turn: 1.7, cargo: 70,
    len: 38, radius: 20, shape: 'tug', variant: 'heavy', color: 0xbfae94,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['needler', null],
    desc: 'Built to sit in a wreck field for a month and leave with everything that was not bolted down, plus the bolts.',
  },
  {
    id: 'barque', name: 'Barque Trader', cls: 'Trader', price: 57000, minTech: 5,
    hull: 430, shield: 230, shieldRegen: 4.2, energy: 125, energyRegen: 14,
    accel: 36, maxSpeed: 196, brake: 74, turn: 1.75, cargo: 115,
    len: 42, radius: 21, shape: 'manta', color: 0xd8cc9c,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['pulse', null],
    desc: 'The lanes’ middle child: a broad trade hull quick enough to run the tariff gates and roomy enough to make it worth the trip.',
  },
  {
    id: 'lynx', name: 'Lynx Prowler', cls: 'Prowler', price: 61000, minTech: 6,
    hull: 400, shield: 280, shieldRegen: 5.2, energy: 125, energyRegen: 15,
    accel: 58, maxSpeed: 255, brake: 92, turn: 2.4, cargo: 35,
    len: 34, radius: 18, shape: 'twinhull', color: 0xc8d4e8,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['pulse', 'needler'],
    desc: 'A delta hull that hunts in the gaps between patrols: quiet drives, sharp nose, very little patience.',
  },
  {
    id: 'terrier', name: 'Terrier Skirmisher', cls: 'Skirmisher', price: 64000, minTech: 6,
    hull: 470, shield: 260, shieldRegen: 4.6, energy: 125, energyRegen: 14,
    accel: 42, maxSpeed: 220, brake: 78, turn: 1.95, cargo: 30,
    len: 36, radius: 19, shape: 'hammer', color: 0xb8c4cc,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['twinpulse', null],
    desc: 'Square-jawed little brawler that snaps at anything crossing its post. Shipwrights joke it was designed by a docking clamp.',
  },
  {
    id: 'surveyor', name: 'Surveyor Rig', cls: 'Survey Ship', price: 68000, minTech: 5,
    hull: 420, shield: 260, shieldRegen: 5.0, energy: 130, energyRegen: 15,
    accel: 38, maxSpeed: 198, brake: 75, turn: 1.8, cargo: 95,
    len: 40, radius: 20, shape: 'miner', variant: 'twin', color: 0xcfd0b8,
    mounts: 1, maxMounts: 2, bays: 0, maxBays: 0, defaultWeapons: ['pulse', null],
    desc: 'Two drill towers swapped for telescope booms; a hull that maps the dark for a living and invoices the Vigil for the honour.',
  },
  {
    id: 'hussar', name: 'Hussar Lancer', cls: 'Lancer', price: 72000, minTech: 6,
    hull: 520, shield: 330, shieldRegen: 5.4, energy: 130, energyRegen: 15,
    accel: 50, maxSpeed: 245, brake: 88, turn: 2.15, cargo: 40,
    len: 38, radius: 20, shape: 'wheel', variant: 'heavy', color: 0xd0c0b0,
    mounts: 3, maxMounts: 4, bays: 0, maxBays: 0, defaultWeapons: ['flenser', 'harpoon', null],
    desc: 'A strike hull built for one pass done properly: heavy nose gun, missile rails, and trim that argues with both.',
  },
  {
    id: 'tinker', name: 'Tinker Workshop', cls: 'Workshop', price: 74000, minTech: 6,
    hull: 520, shield: 230, shieldRegen: 4.4, energy: 135, energyRegen: 15,
    accel: 32, maxSpeed: 172, brake: 64, turn: 1.4, cargo: 125,
    len: 46, radius: 24, shape: 'boxcar', color: 0xc8c0a0,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['needler', null],
    desc: 'A flying machine shop: lathes, a forge, and a crew who will fix anything for anyone, cash first, stories after.',
  },
  {
    id: 'merlin', name: 'Merlin Interceptor', cls: 'Interceptor', price: 76000, minTech: 7,
    hull: 420, shield: 360, shieldRegen: 6.0, energy: 130, energyRegen: 15,
    accel: 70, maxSpeed: 285, brake: 104, turn: 2.6, cargo: 20,
    len: 32, radius: 17, shape: 'arrow', variant: 'dart', color: 0xe0ecf8,
    mounts: 3, maxMounts: 4, bays: 0, maxBays: 0, defaultWeapons: ['twinpulse', 'needler', null],
    desc: 'A duelling dart that arrives before the rumour of it. The Vigil buys every one the yards can finish.',
  },
  {
    id: 'pintail', name: 'Pintail Recon', cls: 'Recon', price: 80000, minTech: 6,
    hull: 400, shield: 300, shieldRegen: 5.6, energy: 140, energyRegen: 16,
    accel: 52, maxSpeed: 258, brake: 94, turn: 2.3, cargo: 45,
    len: 42, radius: 21, shape: 'spine', color: 0xc8d8e0,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['pulse', null],
    desc: 'A long-ringed spyglass of a ship, tuned to listen further than sense allows. Its pilots come back with charts and no opinions.',
  },
  {
    id: 'rampart', name: 'Rampart Corvette', cls: 'Corvette', price: 84000, minTech: 7,
    hull: 560, shield: 340, shieldRegen: 4.8, energy: 135, energyRegen: 15,
    accel: 38, maxSpeed: 210, brake: 74, turn: 1.8, cargo: 40,
    len: 40, radius: 21, shape: 'hammer', variant: 'twin', color: 0xa8b4c4,
    mounts: 3, maxMounts: 4, bays: 0, maxBays: 0, defaultWeapons: ['pulse', 'flenser', null],
    desc: 'A convoy’s favourite argument: twin turret ring, thick cheek plates, and a captain who has done this before.',
  },
  {
    id: 'vintner', name: 'Vintner Cellars', cls: 'Cellar Ship', price: 88000, minTech: 6,
    hull: 640, shield: 330, shieldRegen: 4.4, energy: 135, energyRegen: 15,
    accel: 30, maxSpeed: 168, brake: 62, turn: 1.35, cargo: 175,
    len: 50, radius: 26, shape: 'manta', variant: 'heavy', color: 0xe0d0a8,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['needler', null],
    desc: 'Holds insulated and numbered like a cellar; some of what it carries is older than the systems on its route. It flies gently on purpose.',
  },
  {
    id: 'skulker', name: 'Skulker Runner', cls: 'Runner', price: 92000, minTech: 7,
    hull: 400, shield: 235, shieldRegen: 5.2, energy: 135, energyRegen: 15.5,
    accel: 52, maxSpeed: 235, brake: 88, turn: 2.25, cargo: 90,
    len: 40, radius: 21, shape: 'keel', color: 0x9aa4b0,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['pulse', null],
    desc: 'A low, quiet keel boat with hidden lockers and a transponder that lies politely. Preferred by people who never dock at midday.',
  },
  {
    id: 'grazier', name: 'Grazier Herder', cls: 'Grazier', price: 94000, minTech: 5,
    hull: 700, shield: 260, shieldRegen: 3.8, energy: 130, energyRegen: 14,
    accel: 26, maxSpeed: 150, brake: 56, turn: 1.3, cargo: 245,
    len: 54, radius: 28, shape: 'boxcar', color: 0xcbbd93,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['needler', null],
    desc: 'A livestock barge for the agri-worlds: stacked pens, vet bays, and a smell its crews stop noticing after the first week.',
  },
  {
    id: 'quayman', name: 'Quayman Tender', cls: 'Harbour Tender', price: 106000, minTech: 6,
    hull: 720, shield: 380, shieldRegen: 4.6, energy: 140, energyRegen: 15,
    accel: 32, maxSpeed: 172, brake: 64, turn: 1.45, cargo: 130,
    len: 52, radius: 27, shape: 'tug', variant: 'heavy', color: 0xb8ae94,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['pulse', null],
    desc: 'The heaviest tug in any berth: press it into service and it will nudge a freighter off the quay or a wreck off your course.',
  },
  {
    id: 'dredger', name: 'Dredger Works', cls: 'Dredge', price: 110000, minTech: 6,
    hull: 740, shield: 360, shieldRegen: 4.4, energy: 145, energyRegen: 15,
    accel: 30, maxSpeed: 166, brake: 62, turn: 1.4, cargo: 150,
    len: 56, radius: 29, shape: 'miner', color: 0xb0a888,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['pulse', null],
    desc: 'A rock-chewer built around its own refinery: it enters an asteroid field as a ship and leaves it as a smaller ship plus a full hold.',
  },
  {
    id: 'harquebus', name: 'Harquebus Gunboat', cls: 'Gunboat', price: 112000, minTech: 7,
    hull: 640, shield: 400, shieldRegen: 5.0, energy: 150, energyRegen: 15,
    accel: 32, maxSpeed: 190, brake: 70, turn: 1.6, cargo: 45,
    len: 46, radius: 24, shape: 'hammer', variant: 'twin', color: 0xa8b0b8,
    mounts: 3, maxMounts: 5, bays: 0, maxBays: 0, defaultWeapons: ['flenser', 'harpoon', null],
    desc: 'A missile boat with an old name and new teeth. It fires twice and then the argument is generally over.',
  },
  {
    id: 'dragoon', name: 'Dragoon Cavalry', cls: 'Strike Cruiser', price: 126000, minTech: 7,
    hull: 720, shield: 440, shieldRegen: 5.4, energy: 150, energyRegen: 15.5,
    accel: 44, maxSpeed: 228, brake: 84, turn: 1.9, cargo: 50,
    len: 46, radius: 24, shape: 'spike', variant: 'heavy', color: 0xc8b8a0,
    mounts: 3, maxMounts: 5, bays: 0, maxBays: 0, defaultWeapons: ['flenser', 'twinpulse', null],
    desc: 'A strike hull for riders who fight mounted: it closes fast, hits once, and is already turning for the next pass.',
  },
  {
    id: 'cuirassier', name: 'Cuirassier Line', cls: 'Line Ship', price: 142000, minTech: 7,
    hull: 660, shield: 430, shieldRegen: 6.0, energy: 155, energyRegen: 16.5,
    accel: 40, maxSpeed: 205, brake: 74, turn: 1.85, cargo: 70,
    len: 54, radius: 27, shape: 'keel', color: 0x9fb0c0,
    mounts: 3, maxMounts: 4, bays: 0, maxBays: 0, defaultWeapons: ['flenser', 'flenser', null],
    desc: 'A keel-hulled line ship in the old pattern: two gun decks, a breastwork of plate, and no interest in cleverness.',
  },
  {
    id: 'outrider', name: 'Outrider Screen', cls: 'Screen Ship', price: 158000, minTech: 8,
    hull: 700, shield: 470, shieldRegen: 6.2, energy: 160, energyRegen: 16,
    accel: 42, maxSpeed: 226, brake: 84, turn: 1.95, cargo: 90,
    len: 52, radius: 26, shape: 'manta', variant: 'heavy', color: 0xbcccda,
    mounts: 3, maxMounts: 5, bays: 0, maxBays: 0, defaultWeapons: ['pulse', 'flenser', null],
    desc: 'The hull that rides ahead of a column and finds the trouble first, on purpose, with notes.',
  },
  {
    id: 'basilisk', name: 'Basilisk Battery', cls: 'Battery Ship', price: 174000, minTech: 8,
    hull: 900, shield: 560, shieldRegen: 5.6, energy: 165, energyRegen: 16,
    accel: 34, maxSpeed: 196, brake: 70, turn: 1.65, cargo: 60,
    len: 50, radius: 25, shape: 'hammer', variant: 'twin', color: 0x98a4b0,
    mounts: 4, maxMounts: 6, bays: 0, maxBays: 0, defaultWeapons: ['flenser', 'flenser', 'pulse', null],
    desc: 'Four hardpoints wrapped in more armour than the treaty allows, which is why the treaty has a footnote about it.',
  },
  {
    id: 'templar', name: 'Templar Cruiser', cls: 'Line Cruiser', price: 196000, minTech: 8,
    hull: 880, shield: 600, shieldRegen: 6.8, energy: 170, energyRegen: 18,
    accel: 36, maxSpeed: 198, brake: 70, turn: 1.7, cargo: 100,
    len: 62, radius: 31, shape: 'keel', color: 0xc0ccd8,
    mounts: 4, maxMounts: 6, bays: 0, maxBays: 0, defaultWeapons: ['flenser', 'flenser', 'harpoon', null],
    desc: 'A sworn-order cruiser with clean lines and a graven silhouette: discipline made visible, and armed to keep it that way.',
  },
  {
    id: 'paladin', name: 'Paladin Cruiser', cls: 'Heavy Cruiser', price: 232000, minTech: 8,
    hull: 1010, shield: 690, shieldRegen: 7.2, energy: 180, energyRegen: 18.5,
    accel: 34, maxSpeed: 192, brake: 68, turn: 1.65, cargo: 110,
    len: 66, radius: 33, shape: 'keel', color: 0xd0d8e0,
    mounts: 4, maxMounts: 6, bays: 1, maxBays: 3, defaultWeapons: ['flenser', 'flenser', 'twinpulse', null],
    desc: 'The best a lone captain can hold: a heavyweight cruiser that answers to no column and waits for nobody.',
  },
  {
    id: 'warden', name: 'Warden Command Cruiser', cls: 'Command Cruiser', price: 285000, minTech: 9,
    hull: 950, shield: 720, shieldRegen: 7.4, energy: 185, energyRegen: 19,
    accel: 34, maxSpeed: 190, brake: 70, turn: 1.7, cargo: 150,
    len: 72, radius: 36, shape: 'spine', variant: 'twin', color: 0xbfd0e0,
    mounts: 4, maxMounts: 6, bays: 2, maxBays: 4, defaultWeapons: ['flenser', 'flenser', 'pulse', null],
    desc: 'A twin-ring command hull flying a flag mast of antennae: it carries the squadron’s maps, its doctor, and its last word.',
  },
  {
    id: 'marshal', name: 'Marshal Heavy Cruiser', cls: 'Heavy Cruiser', price: 318000, minTech: 9,
    hull: 1080, shield: 760, shieldRegen: 7.6, energy: 190, energyRegen: 19,
    accel: 30, maxSpeed: 168, brake: 62, turn: 1.6, cargo: 120,
    len: 88, radius: 44, shape: 'citadel', variant: 'cruiser', color: 0xa8b8c8,
    mounts: 4, maxMounts: 6, bays: 2, maxBays: 4, defaultWeapons: ['flenser', 'flenser', 'twinpulse', null],
    desc: 'A pocket line-ship built around one big citadel and a knot of guns. Where a marshal anchors, the lane behaves.',
  },
  {
    id: 'legion', name: 'Legion Assault Ship', cls: 'Assault Ship', price: 355000, minTech: 9,
    hull: 1150, shield: 780, shieldRegen: 7.2, energy: 200, energyRegen: 20,
    accel: 30, maxSpeed: 170, brake: 62, turn: 1.55, cargo: 160,
    len: 90, radius: 45, shape: 'wedge', variant: 'assault', color: 0xb0bac4,
    mounts: 4, maxMounts: 6, bays: 2, maxBays: 5, defaultWeapons: ['flenser', 'flenser', 'harpoon', null],
    desc: 'A wedge of plate with a ramp where the nose should be: it lands its troops first and negotiates afterwards.',
  },
  {
    id: 'palladium', name: 'Palladium Liner', cls: 'Liner', price: 465000, minTech: 9,
    hull: 1250, shield: 850, shieldRegen: 6.8, energy: 210, energyRegen: 19,
    accel: 30, maxSpeed: 150, brake: 60, turn: 1.4, cargo: 380,
    len: 84, radius: 42, shape: 'gantry', color: 0xf4e4c0,
    mounts: 3, maxMounts: 4, bays: 2, maxBays: 4, defaultWeapons: ['pulse', 'flenser', null],
    desc: 'The grandest civilian keel afloat: promenades, vaults, and enough armour to sail the outer lanes like a diplomatic pouch.',
  },
  {
    id: 'tempest', name: 'Tempest Battlecruiser', cls: 'Battlecruiser', price: 520000, minTech: 9,
    hull: 1350, shield: 1050, shieldRegen: 7.5, energy: 220, energyRegen: 21,
    accel: 34, maxSpeed: 186, brake: 66, turn: 1.5, cargo: 140,
    len: 92, radius: 46, shape: 'wedge', color: 0x9fb4c8,
    mounts: 5, maxMounts: 7, bays: 1, maxBays: 3, defaultWeapons: ['flenser', 'flenser', 'twinpulse', 'harpoon', null],
    desc: 'The first true capital: a battlecruiser that outguns anything quicker and outruns anything heavier. Everything smaller yields; everything bigger remembers it.',
  },
  {
    id: 'rookery', name: 'Rookery Strike Carrier', cls: 'Strike Carrier', price: 640000, minTech: 9, yards: ['vesper', 'coriolis', 'meridian'],
    hull: 1500, shield: 980, shieldRegen: 7.0, energy: 230, energyRegen: 21,
    accel: 26, maxSpeed: 158, brake: 58, turn: 1.25, cargo: 220,
    len: 104, radius: 52, shape: 'ark', color: 0xaebcc8,
    mounts: 3, maxMounts: 5, bays: 4, maxBays: 7, defaultWeapons: ['pulse', 'flenser', 'harpoon', null],
    desc: 'A flight deck with a warship bolted underneath. Its launches darken a lane before its guns have even opened their shutters.',
  },
  {
    id: 'redoubt', name: 'Redoubt Battleship', cls: 'Battleship', price: 720000, minTech: 9, yards: ['vesper', 'coriolis', 'grandbank'],
    hull: 1950, shield: 1350, shieldRegen: 8.2, energy: 240, energyRegen: 22,
    accel: 24, maxSpeed: 150, brake: 56, turn: 1.1, cargo: 180,
    len: 116, radius: 58, shape: 'citadel', color: 0x9aa8b8,
    mounts: 6, maxMounts: 8, bays: 1, maxBays: 3, defaultWeapons: ['flenser', 'flenser', 'flenser', 'twinpulse', 'harpoon', null],
    desc: 'A wall of guns that chooses where the lane ends. Fleets are measured against it, and mostly found wanting.',
  },
  {
    id: 'leviathan', name: 'Leviathan Fleet Carrier', cls: 'Fleet Carrier', price: 880000, minTech: 9, yards: ['coriolis', 'meridian', 'vesper'],
    hull: 2100, shield: 1400, shieldRegen: 8.5, energy: 250, energyRegen: 22,
    accel: 22, maxSpeed: 146, brake: 54, turn: 1.05, cargo: 300,
    len: 128, radius: 64, shape: 'ark', variant: 'fleet', color: 0xb8c4d0,
    mounts: 4, maxMounts: 6, bays: 6, maxBays: 9, defaultWeapons: ['pulse', 'flenser', 'flenser', 'harpoon', null],
    desc: 'Six bays of squadron power with a hull around them. A fleet carrier does not win the fight so much as stop needing to attend it.',
  },
  {
    id: 'monarch', name: 'Monarch Dreadnought', cls: 'Dreadnought', price: 1200000, minTech: 9, yards: ['vesper', 'grandbank'],
    hull: 2850, shield: 2000, shieldRegen: 9.5, energy: 280, energyRegen: 24,
    accel: 20, maxSpeed: 142, brake: 52, turn: 0.95, cargo: 200,
    len: 142, radius: 71, shape: 'crown', color: 0xaab6c4,
    mounts: 6, maxMounts: 8, bays: 2, maxBays: 4, defaultWeapons: ['flenser', 'flenser', 'flenser', 'twinpulse', 'harpoon', null],
    desc: 'The throne of the Vigil’s line: a pronged dreadnought that sails where the treaty ends. Captains salute it; admirals get out of its way.',
  },
  {
    id: 'colossus', name: 'Colossus Supercarrier', cls: 'Supercarrier', price: 1450000, minTech: 9, yards: ['vesper', 'coriolis'],
    hull: 2600, shield: 1900, shieldRegen: 9.4, energy: 290, energyRegen: 24,
    accel: 19, maxSpeed: 138, brake: 50, turn: 0.9, cargo: 360,
    len: 150, radius: 75, shape: 'ark', variant: 'super', color: 0xc2ccd8,
    mounts: 4, maxMounts: 6, bays: 8, maxBays: 11, defaultWeapons: ['flenser', 'flenser', 'twinpulse', 'harpoon', null],
    desc: 'Eight launch decks stacked in a hull the length of a small town. Entire squadrons speak of it the way pilgrims speak of weather.',
  },
  {
    id: 'sceptre', name: 'Sceptre Command Ship', cls: 'Command Ship', price: 1650000, minTech: 9, yards: ['vesper', 'meridian'],
    hull: 3300, shield: 2400, shieldRegen: 10.2, energy: 320, energyRegen: 26,
    accel: 18, maxSpeed: 136, brake: 50, turn: 0.88, cargo: 260,
    len: 158, radius: 79, shape: 'crown', variant: 'command', color: 0xccd6e0,
    mounts: 6, maxMounts: 8, bays: 4, maxBays: 7, defaultWeapons: ['flenser', 'flenser', 'flenser', 'twinpulse', 'twinpulse', 'harpoon', null],
    desc: 'The largest keel any yard admits to building: a flagship citadel with a fleet’s worth of doctrine wired into its mast. One exists per decade, and it is never sold cheaply.',
  },

  /* ------------------------------------------------------------------ */
  /* The second yard wave: hulls drawn on new lines — ring drives, twin  */
  /* catamarans, flying wings, spinal lances, radial pods, swept arcs,   */
  /* saucers and monoliths. Same lanes, other silhouettes.               */
  /* ------------------------------------------------------------------ */

  {
    id: 'gnat', name: 'Gnat Snipe', cls: 'Fighter', price: 11500, minTech: 4,
    hull: 85, shield: 70, shieldRegen: 4.4, energy: 60, energyRegen: 11,
    accel: 86, maxSpeed: 302, brake: 118, turn: 3.4, cargo: 0,
    len: 17, radius: 9, shape: 'dart', color: 0xd8f0ff,
    mini: true, mounts: 1, maxMounts: 2, bays: 0, maxBays: 0, defaultWeapons: ['needler', null],
    desc: 'A bay-launched flying wing with no fuselage to speak of: one lifting body, three buried exhausts, and a range measured in nerve.',
  },
  {
    id: 'halberd', name: 'Halberd Lance', cls: 'Lancer', price: 22500, minTech: 6,
    hull: 120, shield: 100, shieldRegen: 4.8, energy: 72, energyRegen: 12,
    accel: 78, maxSpeed: 292, brake: 110, turn: 3.1, cargo: 0,
    len: 21, radius: 11, shape: 'lance', color: 0xffd0b0,
    mini: true, mounts: 1, maxMounts: 2, bays: 0, maxBays: 0, defaultWeapons: ['pulse', null],
    desc: 'A needle with two drives slung on booms amidships. Everything forward of the cockpit is gun, and everything aft is thrust.',
  },
  {
    id: 'puffer', name: 'Puffer Tender', cls: 'Tender', price: 17500, minTech: 2,
    hull: 215, shield: 105, shieldRegen: 3.0, energy: 110, energyRegen: 13,
    accel: 46, maxSpeed: 172, brake: 70, turn: 2.0, cargo: 60,
    len: 30, radius: 16, shape: 'dome', color: 0xd8c8a8,
    mounts: 1, maxMounts: 2, bays: 0, maxBays: 0, defaultWeapons: ['needler', null],
    desc: 'A flat saucer of a harbour tender: a wide lift deck under a domed wheelhouse, with its drives set in a ring around the rim.',
  },
  {
    id: 'claw', name: 'Claw Workpod', cls: 'Salvage Pod', price: 26500, minTech: 3,
    hull: 255, shield: 120, shieldRegen: 3.2, energy: 118, energyRegen: 14,
    accel: 40, maxSpeed: 164, brake: 66, turn: 1.8, cargo: 70,
    len: 31, radius: 17, shape: 'crab', color: 0xc8b090,
    mounts: 1, maxMounts: 2, bays: 0, maxBays: 0, defaultWeapons: ['needler', null],
    desc: 'A spine with four pods on truss arms, each pod its own engine and its own lamp. It can work a wreck field in a way no sleek hull can.',
  },
  {
    id: 'skimmer', name: 'Skimmer Crescent', cls: 'Yacht', price: 34500, minTech: 5,
    hull: 200, shield: 170, shieldRegen: 4.6, energy: 105, energyRegen: 13,
    accel: 58, maxSpeed: 252, brake: 92, turn: 2.5, cargo: 30,
    len: 28, radius: 15, shape: 'crescent', color: 0xe8e0d0,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['pulse', null],
    desc: 'Three hull segments set along a gentle arc, drives on the convex edge. Brokers buy them for the silhouette; pilots buy them for the turn.',
  },
  {
    id: 'nettle', name: 'Nettle Skirmisher', cls: 'Skirmisher', price: 49500, minTech: 5,
    hull: 245, shield: 205, shieldRegen: 5.0, energy: 115, energyRegen: 15,
    accel: 70, maxSpeed: 268, brake: 100, turn: 2.9, cargo: 10,
    len: 30, radius: 16, shape: 'dart', color: 0xa8e8c8,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['twinpulse', null],
    desc: 'A wide delta with a hard leading edge and launcher cells buried in the wing roots. It turns like a leaf and hits like a wasp.',
  },
  {
    id: 'sidewinder', name: 'Sidewinder Prowler', cls: 'Prowler', price: 58000, minTech: 6,
    hull: 290, shield: 230, shieldRegen: 5.0, energy: 125, energyRegen: 15,
    accel: 62, maxSpeed: 258, brake: 94, turn: 2.4, cargo: 25,
    len: 34, radius: 18, shape: 'dart', variant: 'heavy', color: 0xa8b8c8,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['pulse', 'harpoon'],
    desc: 'A heavy flying wing: no spine to hit, no tail to lose, and a missile bay where a fuselage ought to be.',
  },
  {
    id: 'tarn', name: 'Tarn Deep Surveyor', cls: 'Survey Ship', price: 64000, minTech: 5,
    hull: 380, shield: 240, shieldRegen: 4.0, energy: 140, energyRegen: 16,
    accel: 32, maxSpeed: 160, brake: 60, turn: 1.6, cargo: 130,
    len: 44, radius: 23, shape: 'crab', color: 0xbfd0c0,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 1, defaultWeapons: ['needler', null],
    desc: 'Four instrument pods swung wide of the spine so nothing the hull does can shake the readings. Slow, ugly, and the only hull that will fly a tarn at all.',
  },
  {
    id: 'kestrel', name: 'Kestrel Interceptor', cls: 'Interceptor', price: 68000, minTech: 7,
    hull: 300, shield: 258, shieldRegen: 5.4, energy: 130, energyRegen: 16,
    accel: 68, maxSpeed: 274, brake: 104, turn: 2.7, cargo: 20,
    len: 32, radius: 17, shape: 'lance', color: 0xcfe8ff,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 1, defaultWeapons: ['stiletto', null],
    desc: 'A spinal interceptor with its drives out on booms, so the nose can be all gun and no compromise. Watch the drift; there is no weight forward of the cockpit.',
  },
  {
    id: 'ferryman', name: 'Ferryman Catamaran', cls: 'Ferry', price: 72000, minTech: 4,
    hull: 430, shield: 215, shieldRegen: 3.4, energy: 130, energyRegen: 14,
    accel: 34, maxSpeed: 178, brake: 64, turn: 1.6, cargo: 190,
    len: 46, radius: 24, shape: 'cat', color: 0xd8d0b0,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 1, defaultWeapons: ['needler', null],
    desc: 'Two slim hulls under a wide cross-deck: the whole freight floor is flat, level and easy to crane onto. Twice the hulls, no more to hit.',
  },
  {
    id: 'mainsail', name: 'Mainsail Clipper', cls: 'Clipper', price: 84000, minTech: 7,
    hull: 400, shield: 300, shieldRegen: 4.8, energy: 135, energyRegen: 15,
    accel: 50, maxSpeed: 244, brake: 88, turn: 2.0, cargo: 120,
    len: 44, radius: 23, shape: 'cat', color: 0xe8e0c0,
    mounts: 2, maxMounts: 4, bays: 0, maxBays: 1, defaultWeapons: ['pulse', null],
    desc: 'The fast freight answer: a catamaran built long and light, with a bank of drives under each hull. It will outrun anything carrying its tonnage.',
  },
  {
    id: 'sluice', name: 'Sluice Tanker', cls: 'Tanker', price: 90000, minTech: 5,
    hull: 545, shield: 250, shieldRegen: 3.2, energy: 140, energyRegen: 14,
    accel: 24, maxSpeed: 150, brake: 54, turn: 1.2, cargo: 320,
    len: 50, radius: 26, shape: 'dome', color: 0xc8ccc0,
    mounts: 2, maxMounts: 3, bays: 0, maxBays: 0, defaultWeapons: ['needler', null],
    desc: 'A saucer full of whatever the market is short of, its drive ring set low so the tanks can fill the whole disc. Nothing about it is fast, and that is the point.',
  },
  {
    id: 'censer', name: 'Censer Pilgrim', cls: 'Pilgrim Ship', price: 96000, minTech: 6, yards: ['vekta'],
    hull: 570, shield: 300, shieldRegen: 3.6, energy: 145, energyRegen: 15,
    accel: 26, maxSpeed: 148, brake: 56, turn: 1.3, cargo: 150,
    len: 46, radius: 24, shape: 'dome', color: 0xe8dcc8,
    mounts: 1, maxMounts: 2, bays: 1, maxBays: 2, defaultWeapons: ['needler', null],
    desc: 'A shrine disc that walks the holy systems at a pilgrim’s pace, swinging its window ring toward whatever it is passing. The Houses build one a year.',
  },
  {
    id: 'gantryman', name: 'Gantryman Truss', cls: 'Heavy Lifter', price: 165000, minTech: 6, yards: ['wreckerbay'],
    hull: 700, shield: 380, shieldRegen: 4.2, energy: 150, energyRegen: 16,
    accel: 30, maxSpeed: 146, brake: 58, turn: 1.4, cargo: 200,
    len: 54, radius: 28, shape: 'crab', variant: 'heavy', color: 0xc0b498,
    mounts: 3, maxMounts: 4, bays: 1, maxBays: 2, defaultWeapons: ['flenser', null],
    desc: 'Four drive pods on gantries, so it can hold a derelict steady and still keep station. Wrecker Bay’s own answer to heavy lifting.',
  },
  {
    id: 'cabochon', name: 'Cabochon Ring Liner', cls: 'Liner', price: 190000, minTech: 8,
    hull: 780, shield: 520, shieldRegen: 5.2, energy: 165, energyRegen: 18,
    accel: 32, maxSpeed: 168, brake: 62, turn: 1.4, cargo: 220,
    len: 58, radius: 30, shape: 'torus', color: 0xe8e0f0,
    mounts: 2, maxMounts: 4, bays: 1, maxBays: 3, defaultWeapons: ['twinpulse', null],
    desc: 'A long spine through a spinning habitat ring: passengers get an up they can trust, and the hull gets an engine room you could dock a cutter in.',
  },
  {
    id: 'sickle', name: 'Sickle Crescent', cls: 'Raider', price: 175000, minTech: 7, yards: ['houndstooth'],
    hull: 640, shield: 420, shieldRegen: 5.6, energy: 150, energyRegen: 17,
    accel: 56, maxSpeed: 256, brake: 96, turn: 2.3, cargo: 45,
    len: 46, radius: 24, shape: 'crescent', color: 0xff9a70,
    mounts: 3, maxMounts: 4, bays: 0, maxBays: 1, defaultWeapons: ['flenser', 'harpoon', null],
    desc: 'A bent blade of a hull with its drives on the outside of the arc. It comes at a convoy off-axis and leaves the same way.',
  },
  {
    id: 'balefire', name: 'Balefire Lance Cruiser', cls: 'Lance Cruiser', price: 230000, minTech: 9,
    hull: 860, shield: 620, shieldRegen: 6.4, energy: 175, energyRegen: 19,
    accel: 48, maxSpeed: 232, brake: 88, turn: 2.0, cargo: 60,
    len: 62, radius: 31, shape: 'lance', variant: 'heavy', color: 0xffd8a0,
    mounts: 4, maxMounts: 5, bays: 0, maxBays: 1, defaultWeapons: ['hellbore', 'twinpulse', null],
    desc: 'A spinal cruiser: one long hull, one very large gun, and two drives dragged out on booms to keep the muzzle clear. Everything else on it is support.',
  },
  {
    id: 'quill', name: 'Quill Escort', cls: 'Escort Catamaran', price: 205000, minTech: 8,
    hull: 820, shield: 560, shieldRegen: 6.0, energy: 170, energyRegen: 18,
    accel: 44, maxSpeed: 212, brake: 82, turn: 1.9, cargo: 70,
    len: 56, radius: 28, shape: 'cat', variant: 'heavy', color: 0xb8d8e8,
    mounts: 4, maxMounts: 6, bays: 1, maxBays: 3, defaultWeapons: ['gauss', 'pulse', 'harpoon', null],
    desc: 'A twin-hull escort built to sit beside something much larger and soak what comes at it. Two engine rooms means it comes home on one.',
  },
  {
    id: 'orrery', name: 'Orrery Observatory', cls: 'Observatory', price: 210000, minTech: 9,
    hull: 720, shield: 500, shieldRegen: 5.6, energy: 180, energyRegen: 19,
    accel: 30, maxSpeed: 158, brake: 60, turn: 1.4, cargo: 180,
    len: 60, radius: 30, shape: 'torus', variant: 'fleet', color: 0xcfe4ff,
    mounts: 2, maxMounts: 4, bays: 1, maxBays: 2, defaultWeapons: ['scalpel', null],
    desc: 'A ring of instruments around a spine of labs. It reads a star’s mass off the ring’s own flex, which is either science or a very expensive way to break a hull.',
  },
  {
    id: 'stalwart', name: 'Stalwart Line Cruiser', cls: 'Line Cruiser', price: 295000, minTech: 8,
    hull: 1020, shield: 700, shieldRegen: 6.8, energy: 185, energyRegen: 20,
    accel: 40, maxSpeed: 194, brake: 76, turn: 1.7, cargo: 110,
    len: 66, radius: 33, shape: 'cat', variant: 'heavy', color: 0xa8bcd8,
    mounts: 4, maxMounts: 6, bays: 1, maxBays: 3, defaultWeapons: ['gauss', 'flenser', 'pulse', null],
    desc: 'The line of battle, drawn as two hulls under one deck: a gun deck, a hangar deck, and no single point where losing one ends the fight.',
  },
  {
    id: 'hammerfall', name: 'Hammerfall Assault Cruiser', cls: 'Assault Cruiser', price: 340000, minTech: 9,
    hull: 1150, shield: 780, shieldRegen: 7.0, energy: 190, energyRegen: 20,
    accel: 36, maxSpeed: 186, brake: 72, turn: 1.6, cargo: 120,
    len: 74, radius: 37, shape: 'obelisk', color: 0xc8b088,
    mounts: 5, maxMounts: 7, bays: 2, maxBays: 4, defaultWeapons: ['flenser', 'flenser', 'twinpulse', 'harpoon', null],
    desc: 'A monolith: stacked armour decks, a squared ram, and a fortress stern with a hangar mouth under it. It does not manoeuvre; it arrives.',
  },
  {
    id: 'longclaw', name: 'Longclaw Spinal Cruiser', cls: 'Spinal Cruiser', price: 385000, minTech: 9,
    hull: 1080, shield: 860, shieldRegen: 7.4, energy: 200, energyRegen: 21,
    accel: 42, maxSpeed: 202, brake: 80, turn: 1.8, cargo: 90,
    len: 88, radius: 40, shape: 'lance', variant: 'heavy', color: 0xd8c8f0,
    mounts: 4, maxMounts: 6, bays: 2, maxBays: 3, defaultWeapons: ['hellbore', 'arbiter', 'twinpulse', null],
    desc: 'Eighty-eight metres of hull built around one barrel, with the drives hung out on booms so the recoil has somewhere to go.',
  },

  /* ---- the flagships of the new yards: ten keels nobody argues with ---- */
  {
    id: 'halfmoon', name: 'Halfmoon Line Cruiser', cls: 'Line Cruiser', price: 560000, minTech: 9,
    hull: 1600, shield: 1150, shieldRegen: 8.0, energy: 240, energyRegen: 23,
    accel: 32, maxSpeed: 182, brake: 70, turn: 1.6, cargo: 160,
    len: 96, radius: 48, shape: 'crescent', variant: 'heavy', color: 0xe0d8c8,
    mounts: 5, maxMounts: 7, bays: 2, maxBays: 4, defaultWeapons: ['hellbore', 'flenser', 'twinpulse', 'harpoon', null],
    desc: 'A capital hull bent along a shallow arc so every broadside gun bears on the same point. It fights in a curve and everyone else fights straight.',
  },
  {
    id: 'harrow', name: 'Harrow Alpha', cls: 'Alpha Cruiser', price: 690000, minTech: 9,
    hull: 1850, shield: 1320, shieldRegen: 8.4, energy: 260, energyRegen: 24,
    accel: 30, maxSpeed: 176, brake: 68, turn: 1.5, cargo: 180,
    len: 104, radius: 50, shape: 'crab', variant: 'heavy', color: 0xb0c0d0,
    mounts: 6, maxMounts: 8, bays: 2, maxBays: 4, defaultWeapons: ['hellbore', 'flenser', 'flenser', 'twinpulse', 'harpoon', null],
    desc: 'A fleet’s worth of batteries hung on four drive pods. Break one pod off and the other three simply carry the argument.',
  },
  {
    id: 'cataract', name: 'Cataract Assault Carrier', cls: 'Assault Carrier', price: 760000, minTech: 9,
    hull: 1750, shield: 1250, shieldRegen: 8.2, energy: 250, energyRegen: 23,
    accel: 28, maxSpeed: 168, brake: 64, turn: 1.4, cargo: 240,
    len: 112, radius: 54, shape: 'cat', variant: 'heavy', color: 0xc8d8e0,
    mounts: 5, maxMounts: 7, bays: 5, maxBays: 7, defaultWeapons: ['flenser', 'twinpulse', 'pulse', null],
    desc: 'Twin capital hulls joined by a launch deck: the whole span between them is a flight line, and the wings go out both sides at once.',
  },
  {
    id: 'thunderhead', name: 'Thunderhead Battleship', cls: 'Battleship', price: 820000, minTech: 9,
    hull: 2250, shield: 1580, shieldRegen: 9.0, energy: 280, energyRegen: 25,
    accel: 26, maxSpeed: 162, brake: 62, turn: 1.3, cargo: 200,
    len: 118, radius: 58, shape: 'obelisk', color: 0xb8bcc8,
    mounts: 6, maxMounts: 8, bays: 2, maxBays: 4, defaultWeapons: ['gauss', 'gauss', 'flenser', 'twinpulse', 'harpoon', null],
    desc: 'A slab of stacked decks with a fortress stern, driven by one enormous bell and two outriggers. Its broadside is a wall of gun houses.',
  },
  {
    id: 'coliseum', name: 'Coliseum Ring Carrier', cls: 'Ring Carrier', price: 980000, minTech: 9,
    hull: 1900, shield: 1400, shieldRegen: 8.6, energy: 270, energyRegen: 24,
    accel: 24, maxSpeed: 156, brake: 60, turn: 1.3, cargo: 300,
    len: 124, radius: 60, shape: 'torus', variant: 'fleet', color: 0xe8d8b0,
    mounts: 4, maxMounts: 6, bays: 6, maxBays: 8, defaultWeapons: ['flenser', 'twinpulse', 'harpoon', null],
    desc: 'A habitat ring turned launch ring: the whole rim is bays, and a wing can be sent away in any direction without ever turning the ship.',
  },
  {
    id: 'ironveil', name: 'Ironveil Siege Monitor', cls: 'Siege Monitor', price: 1250000, minTech: 9, yards: ['coriolis', 'grandbank'],
    hull: 2600, shield: 1900, shieldRegen: 9.4, energy: 300, energyRegen: 26,
    accel: 20, maxSpeed: 148, brake: 56, turn: 1.1, cargo: 160,
    len: 108, radius: 54, shape: 'obelisk', variant: 'heavy', color: 0xc0b0a0,
    mounts: 6, maxMounts: 8, bays: 1, maxBays: 3, defaultWeapons: ['siege', 'breach', 'flenser', 'twinpulse', null],
    desc: 'Built to reduce a station, not to chase anything: most of its mass is magazine and most of its magazine is torpedo. The Combine keeps four and hopes never to sign for them.',
  },
  {
    id: 'matriarch', name: 'Matriarch Dreadnought', cls: 'Dreadnought', price: 1350000, minTech: 9,
    hull: 3000, shield: 2150, shieldRegen: 9.8, energy: 320, energyRegen: 27,
    accel: 18, maxSpeed: 142, brake: 52, turn: 1.0, cargo: 240,
    len: 140, radius: 68, shape: 'obelisk', variant: 'heavy', color: 0xd0b8a0,
    mounts: 7, maxMounts: 8, bays: 3, maxBays: 5, defaultWeapons: ['griefheart', 'flenser', 'flenser', 'twinpulse', 'twinpulse', 'harpoon', null],
    desc: 'The Houses’ dreadnought: a five-deck monolith with gun houses down both flanks and the family name cut a metre deep into the prow.',
  },
  {
    id: 'cathedral', name: 'Cathedral Ark', cls: 'Ark', price: 1750000, minTech: 9, yards: ['vekta', 'vesper'],
    hull: 3200, shield: 2100, shieldRegen: 9.2, energy: 320, energyRegen: 26,
    accel: 16, maxSpeed: 132, brake: 48, turn: 0.95, cargo: 460,
    len: 152, radius: 74, shape: 'torus', variant: 'heavy', color: 0xf0e0c8,
    mounts: 4, maxMounts: 7, bays: 6, maxBays: 8, defaultWeapons: ['warden', 'flenser', 'twinpulse', null],
    desc: 'A ring habitat that can fold space: sixty thousand souls ride the rim while the priests walk the spine. It carries a gun deck only because the Houses insist.',
  },
  {
    id: 'worldheart', name: 'Worldheart Supercarrier', cls: 'Supercarrier', price: 1850000, minTech: 9, yards: ['meridian', 'coriolis'],
    hull: 3000, shield: 2200, shieldRegen: 9.6, energy: 330, energyRegen: 27,
    accel: 16, maxSpeed: 130, brake: 48, turn: 0.95, cargo: 380,
    len: 150, radius: 72, shape: 'dome', variant: 'heavy', color: 0xd8e4f0,
    mounts: 4, maxMounts: 7, bays: 8, maxBays: 11, defaultWeapons: ['arbiter', 'flenser', 'twinpulse', null],
    desc: 'Half a disc of flight deck over a ring of drives, with the hangars set in the rim itself. Whatever it launches is already pointed at you.',
  },
  {
    id: 'sunspire', name: 'Sunspire Command Ship', cls: 'Command Ship', price: 2100000, minTech: 9, yards: ['vesper', 'meridian'],
    hull: 3600, shield: 2600, shieldRegen: 10.6, energy: 350, energyRegen: 28,
    accel: 16, maxSpeed: 136, brake: 50, turn: 0.95, cargo: 260,
    len: 158, radius: 78, shape: 'obelisk', variant: 'heavy', color: 0xffe6b0,
    mounts: 7, maxMounts: 8, bays: 4, maxBays: 7, defaultWeapons: ['evenstar', 'griefheart', 'flenser', 'twinpulse', 'twinpulse', 'harpoon', null],
    desc: 'A monolith with a mast you can see across a system. Every flag that matters has one; every flag pretends it does not.',
  },

  /* ------------------------------------------------------------------------
   * The great keels: ten hulls above everything else on the lanes. They are
   * ordered rather than stocked — only the greatest yards will even discuss
   * them — and they are rare enough that most pilots finish their careers
   * having seen two, both of them at a distance.
   * --------------------------------------------------------------------- */
  {
    id: 'juggernaut', name: 'Juggernaut Dreadnought', cls: 'Dreadnought', price: 3400000, minTech: 10, yard: 'capital',
    hull: 4600, shield: 3100, shieldRegen: 11.4, energy: 420, energyRegen: 30,
    accel: 14, maxSpeed: 136, brake: 50, turn: 0.95, cargo: 260,
    len: 168, radius: 84, shape: 'crab', variant: 'heavy', color: 0xa8b8c8,
    mounts: 8, maxMounts: 10, bays: 3, maxBays: 6, defaultWeapons: ['gauss', 'flenser', 'flenser', 'twinpulse', 'twinpulse', 'harpoon', null, null],
    desc: 'Eight hardpoints on four drive pods, and enough deck to lose a boarding party on. The clans build them from wrecks of each other and no two are the same size.',
  },
  {
    id: 'everest', name: 'Everest Siege Platform', cls: 'Siege Platform', price: 3900000, minTech: 10, yard: 'capital',
    hull: 5200, shield: 3400, shieldRegen: 11.0, energy: 460, energyRegen: 31,
    accel: 11, maxSpeed: 124, brake: 44, turn: 0.85, cargo: 320,
    len: 156, radius: 78, shape: 'obelisk', variant: 'heavy', color: 0xbcb4a4,
    mounts: 8, maxMounts: 10, bays: 2, maxBays: 5, defaultWeapons: ['siege', 'breach', 'gauss', 'flenser', 'twinpulse', 'harpoon', null, null],
    desc: 'A magazine with a hull wrapped round it. It cannot chase anything, which it regards as someone else’s problem.',
  },
  {
    id: 'halo', name: 'Halo Ring Fortress', cls: 'Ring Fortress', price: 4400000, minTech: 10, yard: 'capital',
    hull: 4400, shield: 3600, shieldRegen: 12.2, energy: 480, energyRegen: 32,
    accel: 12, maxSpeed: 128, brake: 46, turn: 0.9, cargo: 640,
    len: 164, radius: 88, shape: 'torus', variant: 'fleet', color: 0xdcd0b4,
    mounts: 6, maxMounts: 9, bays: 8, maxBays: 12, defaultWeapons: ['arbiter', 'flenser', 'flenser', 'twinpulse', null, null],
    desc: 'A Ring Fortress is a yard that grew a driveshaft: the rim is armour, hangar and customs house at once, and it will happily do business with whoever is winning.',
  },
  {
    id: 'concord', name: 'Concord Star Bastion', cls: 'Star Bastion', price: 4900000, minTech: 10, yard: 'capital',
    hull: 5600, shield: 3800, shieldRegen: 12.0, energy: 500, energyRegen: 32,
    accel: 13, maxSpeed: 132, brake: 48, turn: 0.9, cargo: 400,
    len: 172, radius: 90, shape: 'bastion', variant: 'heavy', color: 0xc4d4e4,
    mounts: 8, maxMounts: 11, bays: 4, maxBays: 8, defaultWeapons: ['arbiter', 'gauss', 'flenser', 'flenser', 'twinpulse', 'harpoon', null, null],
    desc: 'The Vigil’s answer to a siege: a bastion with a jump drive, ribbed like a dry dock and lit like a cathedral. Four of them exist and the Watch will not say where.',
  },
  {
    id: 'suzerain', name: 'Suzerain Battlecruiser', cls: 'Battlecruiser', price: 5600000, minTech: 10, yard: 'capital',
    hull: 5000, shield: 4200, shieldRegen: 12.8, energy: 520, energyRegen: 34,
    accel: 16, maxSpeed: 142, brake: 52, turn: 1.0, cargo: 300,
    len: 166, radius: 82, shape: 'lance', variant: 'heavy', color: 0xe0d4f0,
    mounts: 9, maxMounts: 11, bays: 3, maxBays: 6, defaultWeapons: ['evenstar', 'griefheart', 'flenser', 'flenser', 'twinpulse', 'harpoon', null, null, null],
    desc: 'One spinal lance with a whole ship built around its recoil, and enough secondary battery that the lance is almost a courtesy.',
  },
  {
    id: 'behemoth', name: 'Behemoth Assault Ark', cls: 'Assault Ark', price: 6400000, minTech: 10, yard: 'capital',
    hull: 6400, shield: 4400, shieldRegen: 12.6, energy: 560, energyRegen: 35,
    accel: 12, maxSpeed: 130, brake: 48, turn: 0.9, cargo: 720,
    len: 186, radius: 96, shape: 'citadel', variant: 'heavy', color: 0xc8bca8,
    mounts: 8, maxMounts: 10, bays: 6, maxBays: 10, defaultWeapons: ['gauss', 'gauss', 'flenser', 'flenser', 'twinpulse', 'harpoon', null, null],
    desc: 'Half troop ship, half gun deck, all of it bolted together in orbit over a world that no longer exists. It carries a war with it and lands it.',
  },
  {
    id: 'praetor', name: 'Praetor Fleet Carrier', cls: 'Fleet Carrier', price: 7300000, minTech: 10, yard: 'capital',
    hull: 5800, shield: 4600, shieldRegen: 13.0, energy: 580, energyRegen: 36,
    accel: 13, maxSpeed: 134, brake: 50, turn: 0.95, cargo: 860,
    len: 182, radius: 94, shape: 'cat', variant: 'heavy', color: 0xd4e0ec,
    mounts: 6, maxMounts: 9, bays: 10, maxBays: 14, defaultWeapons: ['arbiter', 'flenser', 'flenser', 'twinpulse', null, null],
    desc: 'Two hundred metres of flight deck on twin hulls, with the hangars set so deep that a launch runs the length of the ship first. Nothing it sends out has to turn.',
  },
  {
    id: 'monolith', name: 'Monolith Citadel', cls: 'Citadel', price: 8500000, minTech: 10, yard: 'capital',
    hull: 7400, shield: 5200, shieldRegen: 13.4, energy: 620, energyRegen: 38,
    accel: 11, maxSpeed: 126, brake: 46, turn: 0.85, cargo: 520,
    len: 196, radius: 100, shape: 'monolith', variant: 'heavy', color: 0xb4b0b8,
    mounts: 9, maxMounts: 12, bays: 4, maxBays: 8, defaultWeapons: ['breach', 'flenser', 'flenser', 'twinpulse', 'twinpulse', 'harpoon', null, null, null],
    desc: 'Terrace after terrace of armour, each one a generation’s answer to the last war, still carrying the scars of both. The lower decks have their own weather.',
  },
  {
    id: 'crownworld', name: 'Crownworld Command Titan', cls: 'Command Titan', price: 10200000, minTech: 10, yard: 'capital',
    hull: 8600, shield: 6000, shieldRegen: 14.2, energy: 680, energyRegen: 40,
    accel: 10, maxSpeed: 120, brake: 44, turn: 0.8, cargo: 620,
    len: 208, radius: 106, shape: 'dome', variant: 'heavy', color: 0xe8e4d8,
    mounts: 9, maxMounts: 12, bays: 6, maxBays: 10, defaultWeapons: ['arbiter', 'arbiter', 'flenser', 'flenser', 'twinpulse', 'harpoon', null, null, null],
    desc: 'A fleet command that happens to be a ship: half a disc of armour over a ring of drives, with a staff deck where the flag sits and watches the plot fill in.',
  },
  {
    id: 'apex', name: 'Apex Warspire', cls: 'Warspire', price: 12500000, minTech: 10, yard: 'capital',
    hull: 9800, shield: 7200, shieldRegen: 15.0, energy: 760, energyRegen: 44,
    accel: 9, maxSpeed: 116, brake: 40, turn: 0.75, cargo: 760,
    len: 224, radius: 112, shape: 'apex', variant: 'heavy', color: 0xf0dca8,
    mounts: 10, maxMounts: 12, bays: 5, maxBays: 9, defaultWeapons: ['evenstar', 'evenstar', 'flenser', 'flenser', 'flenser', 'twinpulse', 'harpoon', null, null, null],
    desc: 'The last word in the argument: a spire of gantries, batteries and pressure decks, most of it built while the war that ordered it was still being lost. Two were laid down. One answered a hail.',
  },
];

/** How big a yard is, and therefore what it will even talk about. */
export const YARD_TIERS = { outpost: 0, port: 1, capital: 2 };

const MAJOR_YARD_TYPES = new Set(['bastion', 'spacedock', 'yard']);

/** Above this price a hull is a line capital: only a great port keeps the slips. */
export const CAPITAL_PRICE = 1000000;

/** Below this price a hull is ordinary trade: any yard with a slip will quote her. */
export const PORT_PRICE = 250000;

/**
 * The tier of the yard at a station. A slip in a backwater can patch a hull;
 * it cannot order you a battleship, and it will not read you the specification
 * of one either. Only the great ports — the bastions, the high docks and the
 * yards that build for a fleet — carry everything.
 */
export function yardTier(system, station) {
  const tech = system?.tech ?? 0;
  const type = station?.type || '';
  if (MAJOR_YARD_TYPES.has(type) && tech >= 9) return 'capital';
  if (tech >= 5) return 'port';
  return 'outpost';
}

/**
 * What a yard makes of a hull:
 *   'stocked'   — on the slips, and the berth can fit her out
 *   'gated'     — stocked by this class of yard, but the berth's tech is too low
 *                 (the yard will not even show you the sheet)
 *   'unstocked' — not a hull this size of yard ever carries
 *
 * Built-to-order hulls (`yards`) are only ever stocked at their own yards; the
 * great keels (`yard: 'capital'`) and the line capitals (`CAPITAL_PRICE` and up)
 * are stocked only at the great yards. An ordinary port shows nothing above its
 * own station in life, and a frontier slip nothing above a freighter.
 */
export function yardStock(def, system, station) {
  if (!def) return 'unstocked';
  if (def.capture) return 'unstocked'; // prizes are never sold anywhere
  if (def.yards && !def.yards.includes(system?.id)) return 'unstocked';
  const tier = YARD_TIERS[yardTier(system, station)] ?? 0;
  const need = def.yard ? YARD_TIERS[def.yard] ?? 2 : (def.price || 0) >= CAPITAL_PRICE ? 2 : (def.price || 0) >= PORT_PRICE ? 1 : 0;
  if (need > tier) return 'unstocked';
  return (def.minTech || 0) > (system?.tech ?? 0) ? 'gated' : 'stocked';
}

/**
 * The ten great keels, in one place: the hulls a yard needs a licence, a dock
 * and a customer with a war to order.
 */
export const CAPITAL_SHIPS = SHIPS.filter((s) => s.yard === 'capital');

/**
 * Handling calibration: the lanes read too quick in the view, so hull top
 * speeds are trimmed to 50%, thrust to 45%, retro burn to 55% and helm
 * authority to 75% of the original table. Applied once here so every consumer
 * — shipyard sheets, NPC crews, player stats — reads the trimmed numbers.
 * (Actual top speed works out near maxSpeed / 0.6 in flight.)
 */
const HANDLING_TRIM = { maxSpeed: 0.5, accel: 0.45, brake: 0.55, turn: 0.75 };
for (const def of SHIPS) {
  def.maxSpeed = Math.round(def.maxSpeed * HANDLING_TRIM.maxSpeed);
  def.accel = Math.round(def.accel * HANDLING_TRIM.accel);
  def.brake = Math.round(def.brake * HANDLING_TRIM.brake);
  def.turn = Math.round(def.turn * HANDLING_TRIM.turn * 100) / 100;
}

/** Save-migration factor: hull/shield pools grew by this much in one balance pass. */
export const HULL_SCALE = 1.6;

export const SHIP_BY_ID = Object.fromEntries(SHIPS.map((s) => [s.id, s]));

/** Ship ids that existed before a rename, so old saves keep flying. */
export const LEGACY_SHIP_IDS = { windshear: 'wayfarer' };

export function resolveShipId(id) {
  if (SHIP_BY_ID[id]) return id;
  const mapped = LEGACY_SHIP_IDS[id];
  return SHIP_BY_ID[mapped] ? mapped : 'wayfarer';
}
