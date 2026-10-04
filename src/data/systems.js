// The Ten Lanes and the Outer Reach — thirty-two systems joined by jump lanes.
// The original ten cluster at the core; the outer systems were charted later,
// and the further out you go, the thinner the law gets.

import { hashString } from '../core/util.js';

export const SYSTEMS = {
  haven: {
    id: 'haven', name: 'Haven', tagline: 'The old harbour',
    star: { color: 0xfff2c8, size: 120 },
    theme: { bg: 0x060a12, nebula: [0x24486e, 0x1a2c4a] },
    tech: 8, gov: 'free',
    links: ['coriolis', 'brasstide', 'coldvane', 'doldrums'],
    economy: { produces: ['grain'], demands: ['luxuries', 'medicine', 'wine'] },
    stations: [
      {
        id: 'haven-anchor', name: 'Ballymara', type: 'haven', owner: 'free',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 520, angle: 0.6,
        desc: 'Ringed berths, cheap coffee, and every rumour on the lanes.',
      },
      {
        id: 'prime-spacedock', name: 'Doonvaun Ring', type: 'spacedock', owner: 'free',
        parent: 'Haven Prime',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 950, angle: 2.1,
        desc: 'An orbital wheel turning over the old capital itself. The world below fills its yards with grain, water and recruits.',
      },
    ],
    planets: [
      { name: 'Haven Prime', radius: 95, dist: 950, angle: 2.1, color: 0x6fa86a, type: 'terran' },
      { name: 'Wick', radius: 26, dist: 1180, angle: 2.35, color: 0x9a9a9a, type: 'moon' },
    ],
    asteroids: null,
    danger: { pirates: 0.15, navy: 0.55 },
    desc: 'Where every new keel gets its first scars. The Vigil keeps the lanes clean and the tariffs cleaner.',
  },

  coriolis: {
    id: 'coriolis', name: 'Coriolis', tagline: 'The foundry sky',
    star: { color: 0xffd9a0, size: 105 },
    theme: { bg: 0x0d0a08, nebula: [0x5e4020, 0x3a2a18] },
    tech: 9, gov: 'combine',
    links: ['haven', 'meridian', 'ashfall', 'sunward', 'grandbank', 'smeltway', 'foundryline'],
    economy: { produces: ['machinery', 'electronics'], demands: ['ore', 'ice'] },
    stations: [
      {
        id: 'coriolis-foundry', name: 'Jinhuo', type: 'haven', owner: 'combine',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 620, angle: 3.4,
        desc: 'Spark-fall from three shifts a day. The Combine’s beating industrial heart.',
      },
      {
        id: 'tether-nine', name: 'Xuanmo', type: 'depot', owner: 'combine',
        services: ['trade', 'refuel', 'mechanic'],
        dist: 1050, angle: 1.2,
        desc: 'A cargo boom the length of a small town. Nothing here is decorative.',
      },
      {
        id: 'coriolis-skyforge', name: 'Tianluo Ring', type: 'spacedock', owner: 'combine',
        parent: 'Coriolis',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 820, angle: 0.9,
        desc: 'A forge-ring riding above the smelter world, taking ore up and sending finished machinery down. The night shift never sees the ground.',
      },
    ],
    planets: [
      { name: 'Coriolis', radius: 110, dist: 820, angle: 0.9, color: 0xb08a5a, type: 'rocky' },
      { name: 'Anvil', radius: 60, dist: 1300, angle: 4.2, color: 0x8a7a6a, type: 'rocky' },
      { name: 'Tarnish', radius: 46, dist: 1050, angle: 2.4, color: 0x9aaa3e, type: 'toxic' },
    ],
    asteroids: { count: 40, dist: 1650, spread: 420 },
    danger: { pirates: 0.2, navy: 0.6 },
    desc: 'Smelters and slipways. If it has a serial number, it was probably born here.',
  },

  brasstide: {
    id: 'brasstide', name: 'Brasstide', tagline: 'The warm breadbasket',
    star: { color: 0xffe9b0, size: 115 },
    theme: { bg: 0x0a0d06, nebula: [0x3e5220, 0x2a3416] },
    tech: 5, gov: 'combine',
    links: ['haven', 'coldvane', 'doldrums', 'oldhomestead', 'emberlight', 'foundryline'],
    economy: { produces: ['grain', 'textiles'], demands: ['machinery', 'medicine'] },
    stations: [
      {
        id: 'brasstide-granary', name: 'Shuqing Granary', type: 'port', owner: 'combine',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 700, angle: 5.1,
        desc: 'Grain silos in slow orbit. The smell of bread through a docking tube is real.',
      },
    ],
    planets: [
      { name: 'Brasstide', radius: 120, dist: 900, angle: 1.4, color: 0x7fb36a, type: 'terran' },
      { name: 'Till', radius: 45, dist: 1250, angle: 3.9, color: 0x9a8a6a, type: 'rocky' },
    ],
    asteroids: null,
    danger: { pirates: 0.3, navy: 0.35 },
    desc: 'Acres of green under agri-domes. Pirates raid the grain lanes for sport and for supper.',
  },

  coldvane: {
    id: 'coldvane', name: 'Coldvane', tagline: 'The comet orchard',
    star: { color: 0xff9a7a, size: 90 },
    theme: { bg: 0x050910, nebula: [0x1e3a54, 0x14253a] },
    tech: 6, gov: 'free',
    links: ['haven', 'brasstide', 'meridian', 'pelican', 'tinderbox'],
    economy: { produces: ['ice'], demands: ['grain', 'textiles', 'luxuries'] },
    stations: [
      {
        id: 'vane-refinery', name: 'Kazahiro', type: 'port', owner: 'free',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 850, angle: 2.2,
        desc: 'They crack ice here the way other ports crack jokes: constantly.',
      },
      {
        id: 'coldvane-skyring', name: 'Mizuhane Skyring', type: 'spacedock', owner: 'free',
        parent: 'Coldvane',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 1100, angle: 0.4,
        desc: 'A ring-dock strung through the comet orchard’s rings. Water up from the giant, ice down from the tail fields, warm bunks for the crews.',
      },
    ],
    planets: [
      { name: 'Coldvane', radius: 160, dist: 1100, angle: 0.4, color: 0x7a9ec8, type: 'gas', rings: true },
      { name: 'Shiver', radius: 52, dist: 1500, angle: 3.1, color: 0xbfe4f0, type: 'ice' },
    ],
    asteroids: null,
    danger: { pirates: 0.35, navy: 0.25 },
    desc: 'A red dwarf guarding a gas giant and its flock of comets. Ice is cheap; everything else dear.',
  },

  meridian: {
    id: 'meridian', name: 'Meridian', tagline: 'Where money docks',
    star: { color: 0xf4f8ff, size: 110 },
    theme: { bg: 0x08090e, nebula: [0x503a6e, 0x2e2444] },
    tech: 9, gov: 'free',
    links: ['coriolis', 'coldvane', 'vesper', 'orchard', 'caldera', 'glassfall'],
    economy: { produces: ['luxuries', 'medicine'], demands: ['ice', 'ore', 'wine'] },
    stations: [
      {
        id: 'meridian-concourse', name: 'Yunxia', type: 'haven', owner: 'free',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 560, angle: 4.4,
        desc: 'Gilded berths, glass promenades, and a discreet berth for discreet cargo.',
      },
      {
        id: 'the-lattice', name: 'Qingluo', type: 'port', owner: 'free',
        services: ['trade', 'bar', 'refuel', 'mechanic', 'shipyard'],
        dist: 980, angle: 1.8, blackmarket: true,
        desc: 'A latticework of a station. Ask no questions, receive excellent prices.',
      },
      {
        id: 'crown-harbour', name: 'Liuyin Ring', type: 'spacedock', owner: 'free',
        parent: 'Meridian',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 780, angle: 5.6,
        desc: 'Glass towers in orbit over a glassier sea. Yunxia handles the trade; Liuyin handles the yachts, and the view.',
      },
    ],
    planets: [
      { name: 'Meridian', radius: 105, dist: 780, angle: 5.6, color: 0x4f7fa8, type: 'ocean' },
      { name: 'Gilt', radius: 70, dist: 1350, angle: 0.7, color: 0xd8c08a, type: 'desert' },
    ],
    asteroids: null,
    danger: { pirates: 0.25, navy: 0.4 },
    desc: 'Luxury goods and medicine flow out; ore and ice flow in; manners are mandatory.',
  },

  sunward: {
    id: 'sunward', name: 'Sunward Reach', tagline: 'Close to the fire',
    star: { color: 0x9ac8ff, size: 130 },
    theme: { bg: 0x0a0e18, nebula: [0x2e5a8e, 0x1c3554] },
    tech: 7, gov: 'combine',
    links: ['coriolis', 'vesper', 'doldrums', 'kestrel', 'vigiledge', 'foundryline'],
    economy: { produces: ['ore'], demands: ['ice', 'medicine', 'grain'] },
    stations: [
      {
        id: 'sunward-rig', name: 'Hongsha Rig', type: 'port', owner: 'combine',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 900, angle: 1.1,
        desc: 'A mining rig skating the edge of the burn. Richer ore than sense, and twice the raiders.',
      },
      {
        id: 'cinder-anchorage', name: 'Yansha Anchorage', type: 'spacedock', owner: 'combine',
        parent: 'Cinder',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 1500, angle: 5.4,
        desc: 'A hard-bitten dock over the ash moon where ore barges unload before the burn — and miners spend their pay before the return leg.',
      },
    ],
    planets: [
      { name: 'Sunward', radius: 85, dist: 520, angle: 2.8, color: 0xff7a4a, type: 'molten' },
      { name: 'Cinder', radius: 40, dist: 1500, angle: 5.4, color: 0x8a5a4a, type: 'rocky' },
    ],
    asteroids: { count: 60, dist: 1900, spread: 500 },
    danger: { pirates: 0.55, navy: 0.3 },
    desc: 'A blue-white furnace and a belt of ore. The richest pickings in the Ten, and the hungriest raiders.',
  },

  doldrums: {
    id: 'doldrums', name: 'The Hollow', tagline: 'The long quiet',
    star: { color: 0xc08868, size: 60 },
    theme: { bg: 0x060608, nebula: [0x3a2a3e, 0x221a26] },
    tech: 3, gov: 'reaver',
    links: ['sunward', 'brasstide', 'rusthaven', 'vekta', 'lastlight', 'piperun', 'haven', 'brokenjaw'],
    economy: { produces: ['ash'], demands: ['machinery', 'medicine', 'luxuries'] },
    stations: [
      {
        id: 'deadlight', name: 'Culragh', type: 'port', owner: 'reaver',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 750, angle: 3.6, blackmarket: true,
        desc: 'Lamps deliberately half-dead. The docking fee is a story you don’t tell.',
      },
      {
        id: 'listening-stone', name: "Dru'keth", type: 'port', owner: 'kreth',
        services: ['trade', 'refuel', 'bar', 'mechanic'],
        dist: 1180, angle: 5.4,
        desc: 'A stone cairn in slow orbit, kept by a House that watches the Hollow and says little. Guests are fed before they are asked anything.',
      },
    ],
    planets: [
      { name: 'Gloam', radius: 75, dist: 850, angle: 1.9, color: 0x5a5a6a, type: 'rocky' },
      { name: 'Shroud', radius: 34, dist: 1150, angle: 3.4, color: 0xbfe4f0, type: 'ice' },
      { name: 'Wraith', radius: 48, dist: 1350, angle: 5.1, color: 0x9ec8e8, type: 'crystal' },
    ],
    asteroids: { count: 80, dist: 1500, spread: 650 },
    danger: { pirates: 0.9, navy: 0.05 },
    desc: 'A dead star’s ember at the edge of everything. Quiet, lawless, and rich in Ember Ash.',
  },

  rusthaven: {
    id: 'rusthaven', name: 'Rusthaven', tagline: 'The wrecker’s yard',
    star: { color: 0xffc890, size: 95 },
    theme: { bg: 0x0c0806, nebula: [0x5e3418, 0x3a2210] },
    tech: 4, gov: 'reaver',
    links: ['doldrums', 'ashfall', 'saltmarch', 'copperhead', 'oldhomestead', 'scarmarch'],
    economy: { produces: ['ash'], demands: ['medicine', 'luxuries', 'textiles', 'wine'] },
    stations: [
      {
        id: 'rusthaven-yard', name: 'Cloghraun Yards', type: 'yard', owner: 'reaver',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 820, angle: 0.3, blackmarket: true,
        desc: 'Ships welded from other ships. Every hull here has a history and a bounty.',
      },
    ],
    planets: [
      { name: 'Rust', radius: 90, dist: 800, angle: 2.6, color: 0x9a6a5a, type: 'dusty' },
      { name: 'Slag', radius: 54, dist: 1100, angle: 0.9, color: 0xb05a3a, type: 'molten' },
      { name: 'Oxide', radius: 26, dist: 1400, angle: 4.5, color: 0x9a8a7a, type: 'moon' },
    ],
    asteroids: { count: 50, dist: 1700, spread: 480 },
    danger: { pirates: 0.7, navy: 0.1 },
    desc: 'The Reaver capital. Hulls come here to die and leave reconstituted. Bring your nerves.',
  },

  vesper: {
    id: 'vesper', name: 'Vesper Gate', tagline: 'The Vigil lamps',
    star: { color: 0xd8e8ff, size: 125 },
    theme: { bg: 0x070a12, nebula: [0x3a4e7e, 0x243052] },
    tech: 10, gov: 'vigil',
    links: ['meridian', 'sunward', 'ashfall', 'northgate', 'saintsrest', 'deadmansmile', 'oathfall', 'sentinels'],
    economy: { produces: ['electronics'], demands: ['ore', 'ice', 'medicine'] },
    stations: [
      {
        id: 'vesper-bastion', name: 'Shiromori', type: 'bastion', owner: 'vigil',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 640, angle: 5.9,
        desc: 'Gun emplacements and spotless duty rosters. The safest moorage in the Ten.',
      },
      {
        id: 'gatewatch', name: 'Hoshigane Relay', type: 'depot', owner: 'vigil',
        services: ['refuel', 'bar', 'mechanic'],
        dist: 1150, angle: 2.4,
        desc: 'A listening post watching every lane that crosses the border.',
      },
      {
        id: 'vesper-highdock', name: 'Sorahara Highdock', type: 'spacedock', owner: 'vigil',
        parent: 'Vesper',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 760, angle: 4.8,
        desc: 'The Watch keeps a civil harbour over its home world: repair cradles, a clean brig, and yards that sell to any clean licence.',
      },
    ],
    planets: [
      { name: 'Vesper', radius: 100, dist: 760, angle: 4.8, color: 0x6f8fb8, type: 'terran' },
      { name: 'Sword', radius: 30, dist: 1000, angle: 5.1, color: 0xaaaaaa, type: 'moon' },
    ],
    asteroids: null,
    danger: { pirates: 0.1, navy: 0.9 },
    desc: 'The Vigil musters here. Pirate hulls use this system for target practice exactly once.',
  },

  ashfall: {
    id: 'ashfall', name: 'Ashfall', tagline: 'The quiet quarry',
    star: { color: 0xffb08a, size: 85 },
    theme: { bg: 0x0a0806, nebula: [0x4a3428, 0x2c2018] },
    tech: 4, gov: 'combine',
    links: ['coriolis', 'rusthaven', 'vesper', 'kratha', 'glassfall', 'quietus', 'lattice'],
    economy: { produces: ['ore'], demands: ['grain', 'medicine', 'machinery'] },
    stations: [
      {
        id: 'ashfall-pit', name: 'Guiyan Pit', type: 'port', owner: 'combine',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 680, angle: 4.0,
        desc: 'A pit head in orbit. Dust in the airlocks and ore on every manifest.',
      },
    ],
    planets: [
      { name: 'Ashfall', radius: 95, dist: 700, angle: 0.8, color: 0x8a7a6a, type: 'dusty' },
      { name: 'Ember', radius: 58, dist: 1150, angle: 2.6, color: 0xb04a3a, type: 'molten' },
      { name: 'Whisper', radius: 30, dist: 1400, angle: 5.0, color: 0xcfe8ff, type: 'ice' },
    ],
    asteroids: { count: 70, dist: 1400, spread: 550 },
    danger: { pirates: 0.4, navy: 0.2 },
    desc: 'Ore, dust, and a narrow sky. The Combine pays well for both.',
  },

  vekta: {
    id: 'vekta', name: "Vek'Tal", tagline: 'The ancestor forge',
    star: { color: 0xff8a5a, size: 95 },
    theme: { bg: 0x0a0606, nebula: [0x5e2418, 0x381410] },
    tech: 7, gov: 'kreth',
    links: ['doldrums', 'kratha', 'lastlight', 'orchard', 'oldhomestead', 'bloodoath', 'housedeep', 'ancestors', 'steepledark'],
    economy: { produces: ['wine', 'machinery'], demands: ['ore', 'ice', 'medicine'] },
    stations: [
      {
        id: 'muster-hall', name: "Kor'vath", type: 'haven', owner: 'kreth',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 640, angle: 2.7,
        desc: 'Every stone in its walls is a sworn deed, and every deed is remembered by someone with a blade.',
      },
      {
        id: 'ancestor-forge', name: "Mar'kugh", type: 'depot', owner: 'kreth',
        services: ['trade', 'refuel', 'mechanic', 'shipyard'],
        dist: 1080, angle: 5.3,
        desc: 'The slipways where the Houses strike their plate. Outsiders may buy what they can honour.',
      },
      {
        id: 'vektal-highhall', name: "Trak'sul", type: 'spacedock', owner: 'kreth',
        parent: "Vek'Tal",
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 820, angle: 1.2,
        desc: 'A House-ring above the ancestor forge-world, half dock and half court. Deals are struck in the shade of the plate-hulls under construction.',
      },
    ],
    planets: [
      { name: "Vek'Tal", radius: 105, dist: 820, angle: 1.2, color: 0xa85838, type: 'rocky' },
      { name: 'The Anvil', radius: 38, dist: 1180, angle: 4.4, color: 0x8a7a6a, type: 'moon' },
    ],
    asteroids: { count: 35, dist: 1550, spread: 380 },
    danger: { pirates: 0.35, navy: 0.75 },
    desc: 'The Houses mustered here before the lanes had names. Speak of your deeds, briefly, and be judged at leisure.',
  },

  kratha: {
    id: 'kratha', name: 'Kratha', tagline: 'The proving ground',
    star: { color: 0xffc27a, size: 100 },
    theme: { bg: 0x0c0704, nebula: [0x6e3a16, 0x3c2210] },
    tech: 6, gov: 'kreth',
    links: ['vekta', 'ashfall', 'tidemill', 'houndstooth', 'lastlight', 'bloodoath', 'housedeep', 'forgelight', 'graverest'],
    economy: { produces: ['wine'], demands: ['textiles', 'medicine', 'machinery'] },
    stations: [
      {
        id: 'proving-ring', name: "Qor'tal", type: 'port', owner: 'kreth',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 760, angle: 0.9, blackmarket: true,
        desc: 'A dock wrapped around a duelling ring. Quarrels are settled here, not in courts — and the bookmakers accept all flags.',
      },
    ],
    planets: [
      { name: 'Kratha', radius: 115, dist: 880, angle: 3.3, color: 0x9a4a3a, type: 'dusty' },
      { name: 'Verdict', radius: 44, dist: 1300, angle: 5.8, color: 0x7a6a5a, type: 'rocky' },
    ],
    asteroids: null,
    danger: { pirates: 0.6, navy: 0.5 },
    desc: 'A red world where quarrels are answered in the ring. The Houses trade here, and watch one another do it.',
  },

  /* ------------------------------------------------------------------ */
  /* The Outer Reach — charted late, governed loosely, priced accordingly */
  /* ------------------------------------------------------------------ */

  pelican: {
    id: 'pelican', name: 'Pelican Roads', tagline: 'Where four lanes meet',
    star: { color: 0xffe2b0, size: 100 },
    theme: { bg: 0x070a10, nebula: [0x2a4a66, 0x18293c] },
    tech: 6, gov: 'free',
    links: ['coldvane', 'grandbank', 'tinderbox', 'wreckerbay'],
    economy: { produces: ['textiles'], demands: ['machinery', 'ice'] },
    stations: [
      {
        id: 'pelican-crossing', name: 'Caherloon', type: 'port', owner: 'free',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 800, angle: 1.7,
        desc: 'A waypoint inn with docking clamps. Four lanes cross here and every one of them is somebody’s shortcut.',
      },
    ],
    planets: [
      { name: 'Pelican', radius: 95, dist: 900, angle: 3.2, color: 0x6f9a7a, type: 'terran' },
      { name: 'Egg Rock', radius: 24, dist: 1240, angle: 5.5, color: 0x9a9a9a, type: 'moon' },
    ],
    asteroids: null,
    danger: { pirates: 0.3, navy: 0.3 },
    desc: 'Crossroads of the outer lanes. The coffee is terrible, the gossip is excellent, and everything is for sale twice.',
  },

  tinderbox: {
    id: 'tinderbox', name: 'Tinderbox', tagline: 'Strike anywhere',
    star: { color: 0xff8a5a, size: 80 },
    theme: { bg: 0x0d0704, nebula: [0x6a3416, 0x3a1e0e] },
    tech: 4, gov: 'reaver',
    links: ['coldvane', 'pelican', 'emberlight', 'wreckerbay', 'emberdrome'],
    economy: { produces: ['ore'], demands: ['grain', 'medicine', 'textiles'] },
    stations: [
      {
        id: 'tinderbox-yards', name: 'Slievemara Yards', type: 'yard', owner: 'reaver',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'], blackmarket: true,
        dist: 720, angle: 2.9,
        desc: 'A refinery built out of whatever the last refinery was before it burned. The Clans call that a renovation.',
      },
    ],
    planets: [
      { name: 'Tinder', radius: 88, dist: 820, angle: 0.9, color: 0xb05a3a, type: 'molten' },
      { name: 'Box', radius: 42, dist: 1300, angle: 4.1, color: 0x7a6a5a, type: 'rocky' },
    ],
    asteroids: { count: 55, dist: 1600, spread: 480 },
    danger: { pirates: 0.75, navy: 0.1 },
    desc: 'A volcanic claim worked by Clan crews and surrounded by people who would like to inherit it. Ore cheap, tempers cheaper.',
  },

  grandbank: {
    id: 'grandbank', name: 'Grand Bank', tagline: 'The counting house',
    star: { color: 0xf4f8ff, size: 120 },
    theme: { bg: 0x080a10, nebula: [0x3a4e8e, 0x243058] },
    tech: 9, gov: 'combine',
    links: ['coriolis', 'pelican', 'vigiledge', 'kestrel', 'smeltway'],
    economy: { produces: ['electronics', 'machinery'], demands: ['ore', 'ice', 'wine'] },
    stations: [
      {
        id: 'grandbank-exchange', name: 'Mingluo Exchange', type: 'haven', owner: 'combine',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 610, angle: 3.8,
        desc: 'Marble in zero gravity, and auditors with sidearms. The Combine keeps its outer ledgers here.',
      },
      {
        id: 'vault-seven', name: 'Zhenlan Vault', type: 'depot', owner: 'combine',
        services: ['trade', 'refuel', 'mechanic'],
        dist: 1100, angle: 1.3,
        desc: 'A bonded warehouse the size of a small moon. No one has ever seen it empty.',
      },
      {
        id: 'bank-ring', name: 'Cuihuan Ring', type: 'spacedock', owner: 'combine',
        parent: 'Grand Bank',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 1050, angle: 5.2,
        desc: 'A counting-house dock threaded through the gas giant’s rings. Interest accrues; so does the ice traffic pushed up from the bands below.',
      },
    ],
    planets: [
      { name: 'Grand Bank', radius: 145, dist: 1050, angle: 5.2, color: 0x8a9ec8, type: 'gas', rings: true },
      { name: 'Ledger', radius: 48, dist: 1400, angle: 2.1, color: 0xb0a080, type: 'dusty' },
    ],
    asteroids: null,
    danger: { pirates: 0.25, navy: 0.65 },
    desc: 'Contracts are signed here that move ore across ten systems without the ore ever noticing. The interest compounds; so does the paperwork.',
  },

  vigiledge: {
    id: 'vigiledge', name: "Vigil's Edge", tagline: 'The last lamp on the lane',
    star: { color: 0xd8e8ff, size: 105 },
    theme: { bg: 0x070a12, nebula: [0x3a4e7e, 0x243052] },
    tech: 8, gov: 'vigil',
    links: ['sunward', 'grandbank', 'kestrel', 'greywatch', 'vesperrim', 'lanternkeep'],
    economy: { produces: ['electronics'], demands: ['ore', 'grain', 'medicine'] },
    stations: [
      {
        id: 'border-bastion', name: 'Yukinami', type: 'bastion', owner: 'vigil',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 680, angle: 4.7,
        desc: 'The Watch’s forward moorage: gun turrets, duty rosters, and a brig with an excellent view of nothing.',
      },
    ],
    planets: [
      { name: 'Edge', radius: 82, dist: 860, angle: 1.5, color: 0xbfe4f0, type: 'ice' },
      { name: 'Lantern', radius: 28, dist: 1150, angle: 3.9, color: 0xaaaaaa, type: 'moon' },
    ],
    asteroids: null,
    danger: { pirates: 0.35, navy: 0.8 },
    desc: 'Beyond this lamp the lanes run dark in both directions. The Vigil knows it, and charges accordingly.',
  },

  kestrel: {
    id: 'kestrel', name: 'Kestrel Reach', tagline: 'The top of the map',
    star: { color: 0xfff2c8, size: 88 },
    theme: { bg: 0x060a12, nebula: [0x24486e, 0x1a2c4a] },
    tech: 5, gov: 'free',
    links: ['sunward', 'vigiledge', 'northgate', 'grandbank', 'lamphold', 'greywatch', 'vesperrim', 'lanternkeep'],
    economy: { produces: ['ice'], demands: ['machinery', 'medicine', 'luxuries'] },
    stations: [
      {
        id: 'kestrel-roost', name: 'Soramiya', type: 'port', owner: 'free',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 810, angle: 2.4,
        desc: 'A hunting lodge for comet-chasers. The window seats are booked by people who never come inside.',
      },
    ],
    planets: [
      { name: 'Kestrel', radius: 130, dist: 1000, angle: 0.6, color: 0x7a9ec8, type: 'gas', rings: true },
      { name: 'Fledgling', radius: 30, dist: 1350, angle: 5.8, color: 0xbfe4f0, type: 'ice' },
    ],
    asteroids: { count: 40, dist: 1550, spread: 400 },
    danger: { pirates: 0.5, navy: 0.3 },
    desc: 'The chart ends here, politely. Everything past it is somebody’s private claim with an armed fence.',
  },

  northgate: {
    id: 'northgate', name: 'Northgate', tagline: 'The outer watch',
    star: { color: 0xcfe8ff, size: 92 },
    theme: { bg: 0x070a12, nebula: [0x324a7a, 0x1e2f4e] },
    tech: 7, gov: 'vigil',
    links: ['vesper', 'saintsrest', 'caldera', 'deadmansmile', 'kestrel', 'lamphold', 'oathfall', 'cordon', 'lanternkeep'],
    economy: { produces: ['electronics'], demands: ['ice', 'grain'] },
    stations: [
      {
        id: 'northgate-watch', name: 'Tsukigane Watch', type: 'bastion', owner: 'vigil',
        services: ['trade', 'refuel', 'bar', 'mechanic'],
        dist: 640, angle: 5.1,
        desc: 'A listening bastion with a chapel, a brig, and one long telescope pointed at the dark.',
      },
    ],
    planets: [
      { name: 'Northgate', radius: 78, dist: 830, angle: 2.2, color: 0x8a7a6a, type: 'rocky' },
      { name: 'Warder', radius: 26, dist: 1120, angle: 4.6, color: 0x9a9a9a, type: 'moon' },
    ],
    asteroids: null,
    danger: { pirates: 0.4, navy: 0.85 },
    desc: 'The Vigil’s second line. Patrols leave here two by two and return one by one, on the bad weeks.',
  },

  saintsrest: {
    id: 'saintsrest', name: "Saint's Rest", tagline: 'A chapel in the dark',
    star: { color: 0xffe9b0, size: 84 },
    theme: { bg: 0x0a0906, nebula: [0x4a4630, 0x2c2a1c] },
    tech: 4, gov: 'free',
    links: ['vesper', 'northgate', 'quietus', 'lamphold', 'oathfall', 'sentinels'],
    economy: { produces: ['grain', 'textiles'], demands: ['machinery', 'medicine', 'wine'] },
    stations: [
      {
        id: 'saintsrest-abbey', name: 'Kinsallagh Abbey', type: 'port', owner: 'free',
        services: ['trade', 'refuel', 'bar', 'mechanic'],
        dist: 700, angle: 1.9,
        desc: 'A hospital cloister that grew a dock instead of a steeple. They treat any flag, and judge none of them out loud.',
      },
    ],
    planets: [
      { name: 'Rest', radius: 100, dist: 880, angle: 4.3, color: 0x6fa86a, type: 'terran' },
      { name: 'Saint', radius: 34, dist: 1210, angle: 0.9, color: 0xaaaaaa, type: 'moon' },
    ],
    asteroids: null,
    danger: { pirates: 0.45, navy: 0.35 },
    desc: 'Bread, bandages, and a bell rung for ships overdue. Pirates leave it alone, mostly, and are remembered for the exception.',
  },

  quietus: {
    id: 'quietus', name: 'Quietus', tagline: 'Where signals go to die',
    star: { color: 0x9a88b8, size: 70 },
    theme: { bg: 0x060608, nebula: [0x3a2a4e, 0x221a30] },
    tech: 6, gov: 'free',
    links: ['ashfall', 'saintsrest', 'deadmansmile', 'houndstooth', 'glassfall', 'graverest', 'thelists'],
    economy: { produces: ['ice'], demands: ['electronics', 'luxuries'] },
    stations: [
      {
        id: 'quietus-relay', name: 'Suzumori Relay', type: 'depot', owner: 'free',
        services: ['trade', 'refuel', 'bar', 'mechanic'], blackmarket: true,
        dist: 760, angle: 3.0,
        desc: 'A comms relay that answers no hails and forwards no mail. Its antennas listen to something else.',
      },
    ],
    planets: [
      { name: 'Quietus', radius: 72, dist: 840, angle: 1.1, color: 0x5a5a6a, type: 'rocky' },
      { name: 'Hush', radius: 29, dist: 1180, angle: 4.9, color: 0x8a8a9a, type: 'moon' },
    ],
    asteroids: null,
    danger: { pirates: 0.65, navy: 0.2 },
    desc: 'Ships that enter the dead zone between the lanes are not lost; they are filed. The relay keeps the filing cabinet.',
  },

  deadmansmile: {
    id: 'deadmansmile', name: "Dead Man's Mile", tagline: 'The shortcut nobody takes twice',
    star: { color: 0xc08868, size: 55 },
    theme: { bg: 0x060506, nebula: [0x3a2430, 0x201420] },
    tech: 3, gov: 'reaver',
    links: ['vesper', 'caldera', 'quietus', 'northgate', 'cordon', 'gallowsring'],
    economy: { produces: ['ash'], demands: ['medicine', 'textiles', 'grain'] },
    stations: [
      {
        id: 'mile-end', name: 'Ballynoor', type: 'port', owner: 'reaver',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'], blackmarket: true,
        dist: 690, angle: 4.5,
        desc: 'A salvage station hung with the transponders of everyone who tried to run the Mile cold.',
      },
    ],
    planets: [
      { name: 'The Mile', radius: 86, dist: 950, angle: 2.5, color: 0x8a6a5a, type: 'dusty' },
      { name: 'Milepost', radius: 24, dist: 1250, angle: 4.6, color: 0x9a9a9a, type: 'moon' },
    ],
    asteroids: { count: 45, dist: 1500, spread: 420 },
    danger: { pirates: 0.85, navy: 0.1 },
    desc: 'A shortcut between two patrol zones that saves four hours and costs, on average, one hull per week.',
  },

  caldera: {
    id: 'caldera', name: 'Caldera Deep', tagline: 'The ring of fire',
    star: { color: 0xffb08a, size: 86 },
    theme: { bg: 0x0a0604, nebula: [0x5e2e16, 0x341a0e] },
    tech: 5, gov: 'combine',
    links: ['meridian', 'northgate', 'deadmansmile', 'glassfall', 'sentinels', 'lattice', 'gallowsring'],
    economy: { produces: ['ore'], demands: ['ice', 'grain', 'medicine'] },
    stations: [
      {
        id: 'caldera-rim', name: 'Chiyan', type: 'port', owner: 'combine',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 750, angle: 0.7,
        desc: 'A ring station that rides the shockwave of the planet it mines. The engineers call this “sport”.',
      },
    ],
    planets: [
      { name: 'Caldera', radius: 108, dist: 820, angle: 3.6, color: 0xff6a3a, type: 'molten' },
      { name: 'Rim', radius: 46, dist: 1290, angle: 5.3, color: 0x8a5a4a, type: 'rocky' },
    ],
    asteroids: { count: 60, dist: 1500, spread: 500 },
    danger: { pirates: 0.45, navy: 0.3 },
    desc: 'A molten world that pays out ore like a wound. The Rim is built to detach; it has detached twice.',
  },

  glassfall: {
    id: 'glassfall', name: 'Glassfall', tagline: 'The crystal rain',
    star: { color: 0xd8f0ff, size: 78 },
    theme: { bg: 0x06080c, nebula: [0x2e4e5e, 0x1c3038] },
    tech: 6, gov: 'free',
    links: ['ashfall', 'orchard', 'quietus', 'caldera', 'meridian', 'thelists'],
    economy: { produces: ['luxuries'], demands: ['machinery', 'ore', 'grain'] },
    stations: [
      {
        id: 'glassfall-camp', name: 'Xuelin Camp', type: 'port', owner: 'free',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 730, angle: 2.8,
        desc: 'A prospecting camp under a roof of falling glitter. The harvest shifts every pass — so does the camp.',
      },
    ],
    planets: [
      { name: 'Glassfall', radius: 90, dist: 870, angle: 5.0, color: 0xb8c8d8, type: 'crystal' },
      { name: 'Shard', radius: 40, dist: 1230, angle: 1.8, color: 0xcfe8ff, type: 'ice' },
    ],
    asteroids: { count: 40, dist: 1400, spread: 400 },
    danger: { pirates: 0.5, navy: 0.25 },
    desc: 'A world where the upper atmosphere grows crystal and sheds it. Pretty on approach, expensive in the hold, lethal in the intakes.',
  },

  orchard: {
    id: 'orchard', name: 'Orchard', tagline: 'A garden at the crossroads',
    star: { color: 0xfff2c8, size: 98 },
    theme: { bg: 0x060a08, nebula: [0x2a5038, 0x1a3024] },
    tech: 7, gov: 'free',
    links: ['meridian', 'emberlight', 'glassfall', 'vekta'],
    economy: { produces: ['grain'], demands: ['machinery', 'ice', 'textiles'] },
    stations: [
      {
        id: 'orchard-hall', name: 'Hanamori', type: 'haven', owner: 'free',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 590, angle: 4.2,
        desc: 'A station built through the boughs of an orbital orchard. Dock fees accepted in fruit, reluctantly.',
      },
    ],
    planets: [
      { name: 'Orchard', radius: 110, dist: 860, angle: 1.3, color: 0x6fb36a, type: 'terran' },
      { name: 'Sapling', radius: 27, dist: 1170, angle: 3.8, color: 0x9a9a9a, type: 'moon' },
      { name: 'Bramble', radius: 62, dist: 1320, angle: 5.6, color: 0x4f8a3e, type: 'jungle' },
    ],
    asteroids: null,
    danger: { pirates: 0.3, navy: 0.4 },
    desc: 'Four lanes water here, and the system feeds them all. The pear brandy alone justifies the traffic.',
  },

  emberlight: {
    id: 'emberlight', name: 'Emberlight', tagline: 'The all-night foundry',
    star: { color: 0xffc890, size: 96 },
    theme: { bg: 0x0c0806, nebula: [0x5e3418, 0x3a2210] },
    tech: 8, gov: 'combine',
    links: ['brasstide', 'orchard', 'tinderbox', 'smeltway', 'lattice', 'wreckerbay'],
    economy: { produces: ['machinery'], demands: ['ore', 'ice', 'wine'] },
    stations: [
      {
        id: 'emberlight-works', name: 'Honglu Works', type: 'haven', owner: 'combine',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 620, angle: 5.6,
        desc: 'Three shifts that never end because the sky never quite darkens. The Combine’s second forge.',
      },
    ],
    planets: [
      { name: 'Emberlight', radius: 94, dist: 880, angle: 2.7, color: 0x9a6a5a, type: 'rocky' },
      { name: 'Forge-Moon', radius: 44, dist: 1260, angle: 0.5, color: 0x8a7a6a, type: 'moon' },
    ],
    asteroids: { count: 45, dist: 1550, spread: 430 },
    danger: { pirates: 0.35, navy: 0.45 },
    desc: 'Smelters under a dim orange sun, running day and night on ore hauled in by whoever is brave enough.',
  },

  oldhomestead: {
    id: 'oldhomestead', name: 'Old Homestead', tagline: 'The first fields',
    star: { color: 0xffe9b0, size: 90 },
    theme: { bg: 0x080a06, nebula: [0x3e5220, 0x263016] },
    tech: 4, gov: 'free',
    links: ['brasstide', 'saltmarch', 'rusthaven', 'vekta', 'ancestors'],
    economy: { produces: ['grain', 'textiles'], demands: ['machinery', 'medicine'] },
    stations: [
      {
        id: 'homestead-green', name: 'Dromaha', type: 'port', owner: 'free',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 780, angle: 3.3,
        desc: 'The oldest settler station still running. The museum and the tavern share a wall, advisably.',
      },
    ],
    planets: [
      { name: 'Homestead', radius: 118, dist: 920, angle: 1.0, color: 0x7fb36a, type: 'terran' },
      { name: 'Plough', radius: 38, dist: 1280, angle: 4.4, color: 0x9a8a6a, type: 'dusty' },
    ],
    asteroids: null,
    danger: { pirates: 0.4, navy: 0.3 },
    desc: 'The first furrows dug outside the Ten, and still turned every spring. Settlers here measure time in harvests, not cycles.',
  },

  saltmarch: {
    id: 'saltmarch', name: 'Saltmarch', tagline: 'Tide country',
    star: { color: 0xcfe8ff, size: 100 },
    theme: { bg: 0x06090c, nebula: [0x2a4a5e, 0x183038] },
    tech: 5, gov: 'free',
    links: ['rusthaven', 'oldhomestead', 'lastlight', 'ancestors', 'steepledark', 'scarmarch'],
    economy: { produces: ['grain', 'ice'], demands: ['machinery', 'electronics', 'wine'] },
    stations: [
      {
        id: 'saltmarch-quay', name: "Vath'kor Quay", type: 'port', owner: 'free',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 740, angle: 2.0,
        desc: 'Floating pads on a world with no land worth the name. The quay rides the tide; the paperwork rides the tide too.',
      },
    ],
    planets: [
      { name: 'Saltmarch', radius: 112, dist: 900, angle: 5.4, color: 0x4f7fa8, type: 'ocean' },
      { name: 'Bracken', radius: 31, dist: 1230, angle: 2.6, color: 0x9a9a9a, type: 'moon' },
    ],
    asteroids: null,
    danger: { pirates: 0.55, navy: 0.2 },
    desc: 'An ocean world of storms and stilted towns. The salt trade built it; the storms keep rebuilding it.',
  },

  lastlight: {
    id: 'lastlight', name: 'Lastlight', tagline: 'The final beacon',
    star: { color: 0xffb08a, size: 74 },
    theme: { bg: 0x080608, nebula: [0x4a2e30, 0x2a1a1e] },
    tech: 5, gov: 'free',
    links: ['doldrums', 'piperun', 'vekta', 'saltmarch', 'kratha', 'steepledark'],
    economy: { produces: ['ice'], demands: ['medicine', 'machinery', 'luxuries'] },
    stations: [
      {
        id: 'lastlight-keep', name: 'Terthak Keep', type: 'depot', owner: 'free',
        services: ['trade', 'refuel', 'bar', 'mechanic'],
        dist: 800, angle: 4.9,
        desc: 'One lamp, one keeper, one very good telescope. Ships that make it here drink standing up.',
      },
    ],
    planets: [
      { name: 'Lastlight', radius: 76, dist: 900, angle: 1.6, color: 0x8a7a6a, type: 'rocky' },
      { name: 'Wickend', radius: 25, dist: 1180, angle: 3.7, color: 0x9a9a9a, type: 'moon' },
    ],
    asteroids: null,
    danger: { pirates: 0.7, navy: 0.15 },
    desc: 'The last station before the Hollow’s true dark. The keeper logs every ship outward, and prays over the ones that don’t come back.',
  },

  piperun: {
    id: 'piperun', name: 'Pipe Run', tagline: 'Thread the rocks',
    star: { color: 0xc08868, size: 62 },
    theme: { bg: 0x060605, nebula: [0x3a3028, 0x201a16] },
    tech: 3, gov: 'reaver',
    links: ['doldrums', 'lastlight', 'tidemill', 'ironvow', 'brokenjaw'],
    economy: { produces: ['ore'], demands: ['grain', 'medicine', 'textiles'] },
    stations: [
      {
        id: 'pipehead', name: 'Inveragh', type: 'port', owner: 'reaver',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'], blackmarket: true,
        dist: 700, angle: 2.3,
        desc: 'A tunnelled-out rock with air, lights, and a docking queue that moves in fist order.',
      },
    ],
    planets: [
      { name: 'Pipes', radius: 88, dist: 950, angle: 5.1, color: 0x8a6a5a, type: 'rocky' },
      { name: 'Lode', radius: 52, dist: 1180, angle: 2.9, color: 0x9a8a6a, type: 'dusty' },
      { name: 'Spring', radius: 32, dist: 1400, angle: 4.4, color: 0xbfe4f0, type: 'ice' },
    ],
    asteroids: { count: 90, dist: 1500, spread: 600 },
    danger: { pirates: 0.8, navy: 0.1 },
    desc: 'A belt so thick the lanes run through it like a threaded needle. The Run’s pilots sell their charts dear and their lives cheaper.',
  },

  tidemill: {
    id: 'tidemill', name: 'Tidemill', tagline: 'Where the lanes grind',
    star: { color: 0xffc27a, size: 94 },
    theme: { bg: 0x0a0704, nebula: [0x5e4416, 0x322410] },
    tech: 6, gov: 'kreth',
    links: ['kratha', 'piperun', 'copperhead', 'housedeep', 'forgelight', 'ironvow', 'brokenjaw'],
    economy: { produces: ['wine', 'machinery'], demands: ['ore', 'ice', 'medicine'] },
    stations: [
      {
        id: 'tidemill-hall', name: "Vangh'kor", type: 'port', owner: 'kreth',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 720, angle: 0.6,
        desc: 'A House hall straddling the tidal line, half over water and half over argument.',
      },
    ],
    planets: [
      { name: 'Tidemill', radius: 108, dist: 880, angle: 3.1, color: 0x4f7fa8, type: 'ocean' },
      { name: 'Millstone', radius: 42, dist: 1270, angle: 5.7, color: 0x7a6a5a, type: 'rocky' },
    ],
    asteroids: null,
    danger: { pirates: 0.55, navy: 0.5 },
    desc: 'The Houses grind grain, ore and grudges here, in that order. The tides do the heavy lifting; the oaths do the rest.',
  },

  copperhead: {
    id: 'copperhead', name: 'Copperhead Run', tagline: 'The snake’s road',
    star: { color: 0xff9a7a, size: 66 },
    theme: { bg: 0x0a0504, nebula: [0x5e2416, 0x32140c] },
    tech: 4, gov: 'reaver',
    links: ['rusthaven', 'houndstooth', 'tidemill', 'ironvow', 'scarmarch'],
    economy: { produces: ['ash'], demands: ['medicine', 'grain', 'luxuries'] },
    stations: [
      {
        id: 'copperhead-den', name: 'Rosmaera', type: 'port', owner: 'reaver',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'], blackmarket: true,
        dist: 660, angle: 1.4,
        desc: 'A den built into a split asteroid, lit red on purpose. The house rule is older than the station: no flags inside.',
      },
    ],
    planets: [
      { name: 'Copperhead', radius: 92, dist: 900, angle: 4.0, color: 0x9a5a3a, type: 'dusty' },
      { name: 'Scale', radius: 33, dist: 1210, angle: 2.8, color: 0x8a7a6a, type: 'rocky' },
    ],
    asteroids: { count: 50, dist: 1600, spread: 450 },
    danger: { pirates: 0.9, navy: 0.05 },
    desc: 'A raider road between two Clans’ hunting grounds. Convoys pay the toll once; the toll is everything you have or nothing you can prove.',
  },

  houndstooth: {
    id: 'houndstooth', name: 'Houndstooth', tagline: 'The Clans’ kennel',
    star: { color: 0xff7a5a, size: 82 },
    theme: { bg: 0x0b0505, nebula: [0x5e1e1e, 0x301010] },
    tech: 5, gov: 'reaver',
    links: ['kratha', 'copperhead', 'quietus', 'forgelight', 'graverest'],
    economy: { produces: ['ash'], demands: ['medicine', 'textiles', 'machinery'] },
    stations: [
      {
        id: 'kennel-gate', name: 'Ballykerra Yards', type: 'yard', owner: 'reaver',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'], blackmarket: true,
        dist: 690, angle: 5.8,
        desc: 'A war-yard where packs muster before a season’s raiding. Whelps sleep in the hulls they will fly.',
      },
    ],
    planets: [
      { name: 'Houndstooth', radius: 96, dist: 880, angle: 2.0, color: 0x8a4a3a, type: 'rocky' },
      { name: 'Fang', radius: 30, dist: 1160, angle: 4.8, color: 0x9a9a9a, type: 'moon' },
    ],
    asteroids: null,
    danger: { pirates: 0.95, navy: 0.05 },
    desc: 'The deepest den of the outer Clans. Ships enter in packs and leave in ones and twos, if at all.',
  },

  /* ------------------------------------------------------------------ */
  /* The marches — twenty systems added when the flags redrew their maps. */
  /* ------------------------------------------------------------------ */

  lamphold: {
    id: 'lamphold', name: 'Lamphold', tagline: 'The vigil\'s lamp-room',
    star: { color: 0xd8e8ff, size: 88 },
    theme: { bg: 0x070a12, nebula: [0x3a4e7e, 0x243052] },
    tech: 6, gov: 'vigil',
    links: ['northgate', 'saintsrest', 'kestrel'],
    economy: { produces: ['electronics'], demands: ['ore', 'grain'] },
    stations: [
      {
        id: 'lamphold-watch', name: 'Kiriage Watch', type: 'bastion', owner: 'vigil',
        services: ['trade', 'refuel', 'bar', 'mechanic'],
        dist: 660, angle: 2.1,
        desc: 'A lamp-keep over a quiet lane. The Watch lights the road for honest traffic and darkens it for everything else.',
      },
    ],
    planets: [
      { name: 'Lamphold', radius: 84, dist: 860, angle: 3.0, color: 0x6f8fb8, type: 'terran' },
      { name: 'Tallow', radius: 28, dist: 1180, angle: 5.2, color: 0x9a9a9a, type: 'moon' },
    ],
    asteroids: null,
    danger: { pirates: 0.2, navy: 0.7 },
    desc: 'Where the Watch keeps the lamps lit. Cross the border quietly and nobody asks your name.',
  },

  greywatch: {
    id: 'greywatch', name: 'Greywatch', tagline: 'The cold border',
    star: { color: 0xcfe8ff, size: 72 },
    theme: { bg: 0x060a10, nebula: [0x2e4a5e, 0x1c2c38] },
    tech: 5, gov: 'vigil',
    links: ['vigiledge', 'kestrel', 'vesperrim'],
    economy: { produces: ['ice'], demands: ['medicine', 'grain'] },
    stations: [
      {
        id: 'greywatch-relay', name: 'Yugure Relay', type: 'depot', owner: 'vigil',
        services: ['refuel', 'bar', 'mechanic'],
        dist: 620, angle: 4.8,
        desc: 'A relay on the frozen edge of Vigil space. The operators hear everything and repeat little.',
      },
    ],
    planets: [
      { name: 'Greywatch', radius: 68, dist: 800, angle: 1.4, color: 0xbfe4f0, type: 'ice' },
      { name: 'Frostline', radius: 26, dist: 1120, angle: 4.0, color: 0x9a9a9a, type: 'moon' },
    ],
    asteroids: { count: 40, dist: 1500, spread: 420 },
    danger: { pirates: 0.25, navy: 0.65 },
    desc: 'A frozen frontier the Watch patrols in strength. Raiders cross it once.',
  },

  oathfall: {
    id: 'oathfall', name: 'Oathfall', tagline: 'Where vows are kept',
    star: { color: 0xe0d8ff, size: 80 },
    theme: { bg: 0x080810, nebula: [0x3e3a5e, 0x262438] },
    tech: 4, gov: 'vigil',
    links: ['saintsrest', 'northgate', 'vesper'],
    economy: { produces: ['medicine'], demands: ['ore', 'textiles'] },
    stations: [
      {
        id: 'oathfall-watch', name: 'Shion Watch', type: 'bastion', owner: 'vigil',
        services: ['trade', 'refuel', 'bar', 'mechanic'],
        dist: 640, angle: 3.2,
        desc: 'A bastion named for the oaths its garrison keeps. Recruits take theirs on the flight deck.',
      },
    ],
    planets: [
      { name: 'Oathfall', radius: 76, dist: 840, angle: 5.5, color: 0x8a7a6a, type: 'rocky' },
      { name: 'Vow', radius: 25, dist: 1160, angle: 1.6, color: 0x9a9a9a, type: 'moon' },
    ],
    asteroids: null,
    danger: { pirates: 0.3, navy: 0.6 },
    desc: 'The Watch mends its broken here. Any captain may dock; few leave without a favour owed.',
  },

  cordon: {
    id: 'cordon', name: 'Cordon', tagline: 'The drawn line',
    star: { color: 0xd8c8b0, size: 64 },
    theme: { bg: 0x0a0806, nebula: [0x4a3428, 0x2c2018] },
    tech: 5, gov: 'vigil',
    links: ['northgate', 'deadmansmile'],
    economy: { produces: ['ore'], demands: ['medicine', 'grain'] },
    stations: [
      {
        id: 'cordon-bastion', name: 'Akanegawa Bastion', type: 'bastion', owner: 'vigil',
        services: ['refuel', 'bar', 'mechanic'],
        dist: 680, angle: 1.0,
        desc: 'The line the Watch drew between the law and the Mile. Nothing crosses unlogged.',
      },
    ],
    planets: [
      { name: 'Cordon', radius: 70, dist: 850, angle: 4.0, color: 0x8a7a6a, type: 'rocky' },
    ],
    asteroids: { count: 60, dist: 1500, spread: 500 },
    danger: { pirates: 0.55, navy: 0.5 },
    desc: 'A checkpoint world on the border of the reaver marches. The Watch scans every transponder twice.',
  },

  sentinels: {
    id: 'sentinels', name: 'Sentinels', tagline: 'The standing guard',
    star: { color: 0xe8e8ff, size: 92 },
    theme: { bg: 0x070a14, nebula: [0x3a4e7e, 0x243052] },
    tech: 6, gov: 'vigil',
    links: ['vesper', 'caldera', 'saintsrest'],
    economy: { produces: ['electronics'], demands: ['ice', 'medicine'] },
    stations: [
      {
        id: 'sentinels-highhall', name: 'Tsukiyo Highhall', type: 'spacedock', owner: 'vigil',
        parent: 'Sentinel',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 720, angle: 2.8,
        desc: 'A high dock over the garrison world, half shipyard and half parade ground.',
      },
    ],
    planets: [
      { name: 'Sentinel', radius: 98, dist: 720, angle: 2.8, color: 0x6f8fb8, type: 'terran' },
      { name: 'Vigilant', radius: 30, dist: 1100, angle: 5.9, color: 0xaaaaaa, type: 'moon' },
    ],
    asteroids: null,
    danger: { pirates: 0.15, navy: 0.8 },
    desc: 'The Watch musters here in force. Pirate hulls give the system a wide, respectful berth.',
  },

  vesperrim: {
    id: 'vesperrim', name: 'Vesperrim', tagline: 'The rim of the lamps',
    star: { color: 0xcfe8ff, size: 66 },
    theme: { bg: 0x060a10, nebula: [0x2e4a5e, 0x1c2c38] },
    tech: 7, gov: 'vigil',
    links: ['vigiledge', 'kestrel', 'greywatch'],
    economy: { produces: ['ice'], demands: ['electronics', 'grain'] },
    stations: [
      {
        id: 'vesperrim-relay', name: 'Kagerou Relay', type: 'depot', owner: 'vigil',
        services: ['refuel', 'bar', 'mechanic'],
        dist: 600, angle: 0.6,
        desc: 'The last relay before the long dark. Its beacon is the brightest light for three systems.',
      },
    ],
    planets: [
      { name: 'Vesperrim', radius: 62, dist: 780, angle: 3.8, color: 0xbfe4f0, type: 'ice' },
    ],
    asteroids: { count: 50, dist: 1400, spread: 460 },
    danger: { pirates: 0.3, navy: 0.6 },
    desc: 'A rim of ice and quiet, watched over by a relay that never sleeps.',
  },

  lanternkeep: {
    id: 'lanternkeep', name: 'Lanternkeep', tagline: 'The outer light',
    star: { color: 0xe8e8d8, size: 74 },
    theme: { bg: 0x080a10, nebula: [0x3a4a5e, 0x242c38] },
    tech: 5, gov: 'vigil',
    links: ['kestrel', 'vigiledge', 'northgate'],
    economy: { produces: ['medicine'], demands: ['ore', 'ice'] },
    stations: [
      {
        id: 'lanternkeep-watch', name: 'Yoiyami Watch', type: 'bastion', owner: 'vigil',
        services: ['trade', 'refuel', 'bar', 'mechanic'],
        dist: 640, angle: 5.0,
        desc: 'A watch post on the highest lane of the chart, lit against the dark beyond.',
      },
    ],
    planets: [
      { name: 'Lanternkeep', radius: 72, dist: 820, angle: 2.4, color: 0x8a7a6a, type: 'rocky' },
      { name: 'Glow', radius: 26, dist: 1140, angle: 0.8, color: 0x9a9a9a, type: 'moon' },
    ],
    asteroids: null,
    danger: { pirates: 0.35, navy: 0.6 },
    desc: 'The light at the top of the chart. Beyond it, the lanes thin out into rumour.',
  },

  bloodoath: {
    id: 'bloodoath', name: 'Bloodoath', tagline: 'The first vow',
    star: { color: 0xffa06a, size: 84 },
    theme: { bg: 0x0a0606, nebula: [0x5e2418, 0x381410] },
    tech: 5, gov: 'kreth',
    links: ['vekta', 'kratha'],
    economy: { produces: ['wine'], demands: ['ore', 'medicine'] },
    stations: [
      {
        id: 'bloodoath-hall', name: "Vekh'mor", type: 'haven', owner: 'kreth',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 620, angle: 1.8,
        desc: 'The hall where the first oath was sworn. Every deed in the Houses is measured against it.',
      },
    ],
    planets: [
      { name: 'Bloodoath', radius: 88, dist: 820, angle: 3.4, color: 0x9a6a5a, type: 'dusty' },
      { name: 'Witness', radius: 28, dist: 1150, angle: 5.0, color: 0x9a9a9a, type: 'moon' },
    ],
    asteroids: null,
    danger: { pirates: 0.4, navy: 0.3 },
    desc: 'Old blood, older oaths. The Houses count favours here the way bankers count coin.',
  },

  housedeep: {
    id: 'housedeep', name: 'Housedeep', tagline: 'The lower halls',
    star: { color: 0xffc27a, size: 78 },
    theme: { bg: 0x0a0704, nebula: [0x5e4416, 0x322410] },
    tech: 6, gov: 'kreth',
    links: ['kratha', 'tidemill', 'vekta'],
    economy: { produces: ['machinery'], demands: ['ore', 'ice'] },
    stations: [
      {
        id: 'housedeep-port', name: "Qhal'dur", type: 'port', owner: 'kreth',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 660, angle: 4.4,
        desc: 'A port carved into the deep stone. The lower halls run for miles and remember everything.',
      },
    ],
    planets: [
      { name: 'Housedeep', radius: 82, dist: 840, angle: 1.2, color: 0x8a7a6a, type: 'rocky' },
      { name: 'Cellar', radius: 27, dist: 1160, angle: 3.6, color: 0x9a9a9a, type: 'moon' },
    ],
    asteroids: { count: 35, dist: 1500, spread: 400 },
    danger: { pirates: 0.4, navy: 0.35 },
    desc: 'The Houses keep their ledgers and their grudges in the deep, in that order.',
  },

  ancestors: {
    id: 'ancestors', name: 'Ancestors', tagline: 'The honoured dead',
    star: { color: 0xffb08a, size: 76 },
    theme: { bg: 0x0a0604, nebula: [0x5e2e16, 0x341a0e] },
    tech: 7, gov: 'kreth',
    links: ['vekta', 'oldhomestead', 'saltmarch'],
    economy: { produces: ['wine'], demands: ['machinery', 'grain'] },
    stations: [
      {
        id: 'ancestors-hall', name: 'Dorveth', type: 'haven', owner: 'kreth',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 640, angle: 2.6,
        desc: 'A hall of remembrance. The names of the honoured dead are read here every season, and strangers are expected to listen.',
      },
    ],
    planets: [
      { name: 'Ancestors', radius: 90, dist: 800, angle: 4.8, color: 0x8a7a6a, type: 'rocky' },
      { name: 'Surname', radius: 26, dist: 1120, angle: 0.4, color: 0x9a9a9a, type: 'moon' },
    ],
    asteroids: null,
    danger: { pirates: 0.35, navy: 0.4 },
    desc: 'The Houses bury their great here, and weigh every captain against the names they carried.',
  },

  forgelight: {
    id: 'forgelight', name: 'Forgelight', tagline: 'The ember hall',
    star: { color: 0xff9a5a, size: 82 },
    theme: { bg: 0x0b0604, nebula: [0x5e2e16, 0x301a0e] },
    tech: 7, gov: 'kreth',
    links: ['kratha', 'tidemill', 'houndstooth'],
    economy: { produces: ['machinery'], demands: ['ore', 'ice'] },
    stations: [
      {
        id: 'forgelight-highhall', name: "Khel'tann", type: 'spacedock', owner: 'kreth',
        parent: 'Forgelight',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 700, angle: 3.0,
        desc: 'A forge-ring over a world that never cools. The Houses strike their plate and their bargains in the same heat.',
      },
    ],
    planets: [
      { name: 'Forgelight', radius: 94, dist: 700, angle: 3.0, color: 0xb04a3a, type: 'molten' },
      { name: 'Spark', radius: 30, dist: 1080, angle: 1.4, color: 0x8a7a6a, type: 'moon' },
    ],
    asteroids: { count: 45, dist: 1500, spread: 440 },
    danger: { pirates: 0.5, navy: 0.3 },
    desc: 'The Houses forge hulls and histories here, and do not always know which is which.',
  },

  ironvow: {
    id: 'ironvow', name: 'Ironvow', tagline: 'The bound word',
    star: { color: 0xffc890, size: 70 },
    theme: { bg: 0x0a0704, nebula: [0x5e4416, 0x322410] },
    tech: 4, gov: 'kreth',
    links: ['tidemill', 'piperun', 'copperhead'],
    economy: { produces: ['ore'], demands: ['grain', 'medicine'] },
    stations: [
      {
        id: 'ironvow-port', name: 'Morvath', type: 'port', owner: 'kreth',
        services: ['trade', 'refuel', 'bar', 'mechanic'],
        dist: 660, angle: 5.2,
        desc: 'A port bound by oaths older than its docks. A word given here is weighed and written down.',
      },
    ],
    planets: [
      { name: 'Ironvow', radius: 74, dist: 800, angle: 2.0, color: 0x9a8a6a, type: 'dusty' },
    ],
    asteroids: { count: 55, dist: 1400, spread: 480 },
    danger: { pirates: 0.55, navy: 0.2 },
    desc: 'The Houses keep a vow-hold on the border of the reaver lanes. Debts walk in and oaths walk out.',
  },

  steepledark: {
    id: 'steepledark', name: 'Steepledark', tagline: 'The black chapel',
    star: { color: 0xd8a87a, size: 62 },
    theme: { bg: 0x080606, nebula: [0x3a2420, 0x201414] },
    tech: 5, gov: 'kreth',
    links: ['vekta', 'saltmarch', 'lastlight'],
    economy: { produces: ['wine'], demands: ['machinery', 'textiles'] },
    stations: [
      {
        id: 'steepledark-hall', name: "Zhar'kel", type: 'depot', owner: 'kreth',
        services: ['refuel', 'bar', 'mechanic'],
        dist: 620, angle: 3.8,
        desc: 'A black chapel hung with the hulls of ships whose crews broke their word. A quiet, instructive place.',
      },
    ],
    planets: [
      { name: 'Steepledark', radius: 66, dist: 800, angle: 1.0, color: 0x7a6a5a, type: 'rocky' },
      { name: 'Belfry', radius: 25, dist: 1100, angle: 4.6, color: 0x9a9a9a, type: 'moon' },
    ],
    asteroids: null,
    danger: { pirates: 0.45, navy: 0.25 },
    desc: 'The Houses keep their black chapel on the dark edge of the Reach. Its bell rings for broken vows.',
  },

  graverest: {
    id: 'graverest', name: 'Graverest', tagline: 'The last ledger',
    star: { color: 0xc08868, size: 68 },
    theme: { bg: 0x070606, nebula: [0x3a2a20, 0x201816] },
    tech: 6, gov: 'kreth',
    links: ['kratha', 'houndstooth', 'quietus'],
    economy: { produces: ['wine'], demands: ['ore', 'medicine'] },
    stations: [
      {
        id: 'graverest-port', name: 'Urgath', type: 'port', owner: 'kreth',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 650, angle: 1.6,
        desc: 'The Houses settle their accounts here. The final page of every ledger is written in a steady hand.',
      },
    ],
    planets: [
      { name: 'Graverest', radius: 78, dist: 820, angle: 4.2, color: 0x9a6a5a, type: 'dusty' },
      { name: 'Slab', radius: 27, dist: 1140, angle: 0.2, color: 0x9a9a9a, type: 'moon' },
    ],
    asteroids: null,
    danger: { pirates: 0.5, navy: 0.2 },
    desc: 'The Houses rest their honoured here and their enemies beside them, all debts forgiven.',
  },

  smeltway: {
    id: 'smeltway', name: 'Smeltway', tagline: 'The molten artery',
    star: { color: 0xffd9a0, size: 96 },
    theme: { bg: 0x0d0a08, nebula: [0x5e4020, 0x3a2a18] },
    tech: 8, gov: 'combine',
    links: ['coriolis', 'grandbank', 'emberlight'],
    economy: { produces: ['machinery'], demands: ['ore', 'ice'] },
    stations: [
      {
        id: 'smeltway-haven', name: 'Ganglu', type: 'haven', owner: 'combine',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 640, angle: 2.2,
        desc: 'A foundry-haven on the molten artery between the forges. The cargo here moves hot and fast.',
      },
    ],
    planets: [
      { name: 'Smeltway', radius: 92, dist: 840, angle: 1.0, color: 0xff6a3a, type: 'molten' },
      { name: 'Dross', radius: 28, dist: 1160, angle: 4.4, color: 0x8a7a6a, type: 'moon' },
    ],
    asteroids: { count: 50, dist: 1500, spread: 460 },
    danger: { pirates: 0.35, navy: 0.4 },
    desc: 'The Combine moves ore through here like blood. The tariffs are steep and the paperwork is steep.',
  },

  lattice: {
    id: 'lattice', name: 'Lattice', tagline: 'The grid below the smog',
    star: { color: 0xffd0a0, size: 84 },
    theme: { bg: 0x0c0806, nebula: [0x5e3418, 0x3a2210] },
    tech: 7, gov: 'combine',
    links: ['emberlight', 'caldera', 'ashfall'],
    economy: { produces: ['electronics'], demands: ['ore', 'grain'] },
    stations: [
      {
        id: 'lattice-depot', name: 'Tieshan', type: 'depot', owner: 'combine',
        services: ['trade', 'refuel', 'mechanic'],
        dist: 660, angle: 4.6,
        desc: 'A lattice of rails and cranes below a permanent smog. Nothing here is decorative.',
      },
    ],
    planets: [
      { name: 'Lattice', radius: 80, dist: 820, angle: 2.8, color: 0x8a7a6a, type: 'rocky' },
      { name: 'Node', radius: 26, dist: 1120, angle: 5.4, color: 0x9a9a9a, type: 'moon' },
    ],
    asteroids: null,
    danger: { pirates: 0.4, navy: 0.35 },
    desc: 'A grid of industry under a smog-choked sky. The Combine runs it on three shifts and a prayer.',
  },

  foundryline: {
    id: 'foundryline', name: 'Foundryline', tagline: 'Where hulls are born',
    star: { color: 0xffd9a0, size: 100 },
    theme: { bg: 0x0d0a08, nebula: [0x5e4020, 0x3a2a18] },
    tech: 8, gov: 'combine',
    links: ['coriolis', 'sunward', 'brasstide'],
    economy: { produces: ['machinery'], demands: ['ore', 'grain', 'ice'] },
    stations: [
      {
        id: 'foundryline-port', name: 'Yelu', type: 'port', owner: 'combine',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 680, angle: 3.4,
        desc: 'The slipways where the Combine\'s hulls are born. Every keel here has a serial number and a buyer before it has a name.',
      },
    ],
    planets: [
      { name: 'Foundryline', radius: 88, dist: 840, angle: 1.6, color: 0xb08a5a, type: 'rocky' },
      { name: 'Cast', radius: 30, dist: 1160, angle: 4.8, color: 0x8a7a6a, type: 'moon' },
    ],
    asteroids: { count: 40, dist: 1550, spread: 440 },
    danger: { pirates: 0.3, navy: 0.4 },
    desc: 'The Combine lays keels here around the clock. If it has a serial number, it began on the line.',
  },

  scarmarch: {
    id: 'scarmarch', name: 'Scarmarch', tagline: 'The wound that walked',
    star: { color: 0xff9a7a, size: 70 },
    theme: { bg: 0x0a0504, nebula: [0x5e2416, 0x32140c] },
    tech: 3, gov: 'reaver',
    links: ['rusthaven', 'copperhead', 'saltmarch'],
    economy: { produces: ['ash'], demands: ['medicine', 'grain'] },
    stations: [
      {
        id: 'scarmarch-yard', name: 'Scarriff', type: 'yard', owner: 'reaver',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'], blackmarket: true,
        dist: 660, angle: 2.8,
        desc: 'A war-yard on the march. The hulls here are stitched from a dozen wrecks and fly meaner for it.',
      },
    ],
    planets: [
      { name: 'Scarmarch', radius: 80, dist: 820, angle: 4.0, color: 0x9a6a5a, type: 'dusty' },
      { name: 'Scab', radius: 26, dist: 1130, angle: 1.2, color: 0x9a9a9a, type: 'moon' },
    ],
    asteroids: { count: 60, dist: 1500, spread: 520 },
    danger: { pirates: 0.85, navy: 0.1 },
    desc: 'The Clans march through here when they raid the core. The lane never quite heals.',
  },

  brokenjaw: {
    id: 'brokenjaw', name: 'Brokenjaw', tagline: 'The cracked den',
    star: { color: 0xc08868, size: 58 },
    theme: { bg: 0x060506, nebula: [0x3a2430, 0x201420] },
    tech: 4, gov: 'reaver',
    links: ['doldrums', 'piperun', 'tidemill'],
    economy: { produces: ['ash'], demands: ['medicine', 'textiles'] },
    stations: [
      {
        id: 'brokenjaw-den', name: 'Ballygowan', type: 'port', owner: 'reaver',
        services: ['trade', 'refuel', 'bar', 'mechanic'], blackmarket: true,
        dist: 640, angle: 4.2,
        desc: 'A den cracked into the side of a dead moon. The house rule is older than the station: no flags inside.',
      },
    ],
    planets: [
      { name: 'Brokenjaw', radius: 72, dist: 800, angle: 2.4, color: 0x8a6a5a, type: 'rocky' },
      { name: 'Gum', radius: 25, dist: 1100, angle: 5.0, color: 0x9a9a9a, type: 'moon' },
    ],
    asteroids: null,
    danger: { pirates: 0.9, navy: 0.05 },
    desc: 'The Clans\' cracked den on the Hollow\'s edge. A smile here costs more than a hull.',
  },

  wreckerbay: {
    id: 'wreckerbay', name: 'Wreckerbay', tagline: 'Where wrecks come to rest',
    star: { color: 0xffb08a, size: 74 },
    theme: { bg: 0x0a0604, nebula: [0x4a3428, 0x2c2018] },
    tech: 4, gov: 'reaver',
    links: ['tinderbox', 'emberlight', 'pelican', 'emberdrome'],
    economy: { produces: ['ash'], demands: ['machinery', 'medicine'] },
    stations: [
      {
        id: 'wreckerbay-yard', name: 'Clonreagh', type: 'yard', owner: 'reaver',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'], blackmarket: true,
        dist: 660, angle: 1.0,
        desc: 'A bay where wrecks come to rest and leave reconstituted. Every hull has a history and a price on someone.',
      },
    ],
    planets: [
      { name: 'Wreckerbay', radius: 76, dist: 820, angle: 3.2, color: 0x8a6a5a, type: 'rocky' },
      { name: 'Keel', radius: 27, dist: 1120, angle: 0.6, color: 0x9a9a9a, type: 'moon' },
    ],
    asteroids: { count: 70, dist: 1500, spread: 540 },
    danger: { pirates: 0.8, navy: 0.1 },
    desc: 'The Clans\' wrecker bay on the inner edge of their space. Wrecks come in, warships go out.',
  },

  /* ------------------------------------------------------------------ */
  /* The free-fire systems.                                              */
  /*                                                                     */
  /* Three orbits no flag bothers to police. Whoever is in them is       */
  /* fair game for whoever else is in them, and nothing done here is     */
  /* written down against a captain: no bounty, no grudge, no karma, no  */
  /* standing lost. `freefire: true` is read by universe.js, which makes */
  /* every hull hostile to every other hull and suspends the reputation  */
  /* and karma consequences of fighting or taking a ship inside them.    */
  /* ------------------------------------------------------------------ */

  thelists: {
    id: 'thelists', name: 'Unwrit', tagline: 'No flag keeps a file',
    star: { color: 0xff9a6a, size: 76 },
    theme: { bg: 0x0c0508, nebula: [0x5e2a3a, 0x2a1420] },
    tech: 4, gov: 'none', freefire: true,
    links: ['quietus', 'glassfall'],
    economy: { produces: ['ore'], demands: ['medicine', 'luxuries', 'wine'] },
    stations: [
      {
        id: 'thelists-crosstree', name: 'Freehand', type: 'haven', owner: 'none',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 620, angle: 0.9,
        desc: 'A trading post bolted to a hollow rock. It sells to anyone, asks nothing, and keeps no records for anybody — which is exactly why it is still standing.',
      },
    ],
    planets: [
      { name: 'Unwrit', radius: 72, dist: 900, angle: 3.0, color: 0x8a5a4a, type: 'rocky' },
      { name: 'Stray', radius: 24, dist: 1180, angle: 5.2, color: 0x9a9a9a, type: 'moon' },
    ],
    asteroids: { count: 110, dist: 1450, spread: 620 },
    danger: { pirates: 1, navy: 0 },
    desc: 'A hollow belt off the lane chart where no flag keeps a file. The Vigil does not come here, the Combine does not invoice here, and the Clans do not bother claiming it. Attack who you like, take what you can hold, and no one will record a word of it against you.',
  },

  gallowsring: {
    id: 'gallowsring', name: 'Deadlight', tagline: 'Where the writ runs out',
    star: { color: 0xc8d0e0, size: 62 },
    theme: { bg: 0x06080c, nebula: [0x2e3a4e, 0x1a2028] },
    tech: 3, gov: 'none', freefire: true,
    links: ['deadmansmile', 'caldera'],
    economy: { produces: ['ice'], demands: ['medicine', 'grain', 'machinery'] },
    stations: [
      {
        id: 'gallowsring-wardens', name: 'Cold Harbour', type: 'bastion', owner: 'none',
        services: ['trade', 'refuel', 'bar', 'mechanic'],
        desc: 'A decommissioned station nobody patrols and nobody closed. It takes hulls for repair and crews for a drink, and asks no questions it would have to write down.',
      },
    ],
    planets: [
      { name: 'Deadlight', radius: 66, dist: 880, angle: 1.2, color: 0x6a6a72, type: 'rocky' },
      { name: 'Spur', radius: 22, dist: 1150, angle: 4.6, color: 0x8a8a8a, type: 'moon' },
    ],
    asteroids: { count: 80, dist: 1520, spread: 560 },
    danger: { pirates: 1, navy: 0 },
    desc: 'The last station on a lane that was never finished. Both marches quietly agree it belongs to neither, which means every hull in the system is unescorted, unregistered, and owed nothing by anyone. Settle whatever you like out here.',
  },

  emberdrome: {
    id: 'emberdrome', name: 'Cinderreach', tagline: 'Cinders, and no law',
    star: { color: 0xff8a4a, size: 88 },
    theme: { bg: 0x0b0402, nebula: [0x6a2c14, 0x301408] },
    tech: 5, gov: 'none', freefire: true,
    links: ['wreckerbay', 'tinderbox'],
    economy: { produces: ['ash', 'machinery'], demands: ['medicine', 'ice', 'grain'] },
    stations: [
      {
        id: 'emberdrome-cinder', name: 'Ashgate', type: 'spacedock', owner: 'none',
        parent: 'Cinderreach',
        services: ['trade', 'refuel', 'bar', 'mechanic', 'shipyard'],
        dist: 700, angle: 1.6,
        desc: 'A dock hung over a molten hemisphere by people who wanted to be somewhere nobody would look. Its yards will repair anything and ask for no paperwork doing it.',
      },
    ],
    planets: [
      { name: 'Cinderreach', radius: 92, dist: 900, angle: 1.6, color: 0xa8482a, type: 'molten' },
      { name: 'Slag', radius: 25, dist: 1200, angle: 4.1, color: 0x7a6a5a, type: 'moon' },
    ],
    asteroids: { count: 65, dist: 1560, spread: 500 },
    danger: { pirates: 1, navy: 0 },
    desc: 'A cinder world too hot to claim and too poor to garrison. Ships come here to meet each other without witnesses, which is why so few of them leave. No flag applies, and no flag will hear about it.',
  },
};

export const SYSTEM_IDS = Object.keys(SYSTEMS);

/** Nominal rim of a system — where ships drop out of warp. */
export const RIM_RADIUS = 3300;
export const SYSTEM_RADIUS = 3800;

/** Deterministic bearing of the lane between two systems (warp entry, guidance). */
export function laneAngle(fromId, toId) {
  const h = hashString(`${fromId}->${toId}`);
  return ((h % 3600) / 3600) * Math.PI * 2;
}

/**
 * Shortest lane route between two systems — a BFS over the lane graph.
 * Returns the full path including both endpoints, or null when unreachable.
 */
export function routeBetween(fromId, toId) {
  if (!SYSTEMS[fromId] || !SYSTEMS[toId]) return null;
  if (fromId === toId) return [fromId];
  const prev = { [fromId]: null };
  const queue = [fromId];
  while (queue.length) {
    const cur = queue.shift();
    for (const next of SYSTEMS[cur].links) {
      if (next in prev) continue;
      prev[next] = cur;
      if (next === toId) {
        const path = [];
        for (let c = toId; c !== null; c = prev[c]) path.unshift(c);
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}
