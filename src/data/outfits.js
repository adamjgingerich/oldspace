// Ship upgrades. Effect values are per level (index 0 = level 1, index 1 = level 2).

export const OUTFITS = [
  {
    id: 'shieldboost', name: 'Shield Booster', stat: 'shield', add: [72, 160],
    prices: [9000, 23000],
    desc: 'Reinforces the deflector lattice. More room to be wrong.',
  },
  {
    id: 'shieldflow', name: 'Shield Flow Regulator', stat: 'shieldRegen', add: [2.6, 5.2],
    prices: [12000, 28000],
    desc: 'Recirculates shield ions. Recovery measured in heartbeats, not breaths.',
  },
  {
    id: 'capacitor', name: 'Capacitor Bank', stat: 'energy', add: [35, 80],
    prices: [8000, 19000],
    desc: 'Extra charge for engines and guns. The quiet luxury of headroom.',
  },
  {
    id: 'dynamo', name: 'Auxiliary Dynamo', stat: 'energyRegen', add: [4, 9],
    prices: [11000, 26000],
    desc: 'A second heart behind the first. Charge returns faster.',
  },
  {
    id: 'enginetune', name: 'Engine Tune', stat: 'accel', add: [7, 15], add2: { stat: 'maxSpeed', add: [22, 45] },
    prices: [14000, 32000],
    desc: 'Blue-tuned nozzles and a braver fuel map.',
  },
  {
    id: 'plating', name: 'Ablative Plating', stat: 'hull', add: [112, 256],
    prices: [7000, 17000],
    desc: 'Layers of ceramic that die so you don’t.',
  },
  {
    id: 'thrusters', name: 'Maneuvering Thrusters', stat: 'brake', add: [35, 70],
    prices: [9500, 22000],
    desc: 'A ring of high-authority retros. Heavy hulls learn to stop like light ones.',
  },
  {
    id: 'cargopod', name: 'Cargo Pods', stat: 'cargo', add: [60, 150],
    prices: [5000, 12000],
    desc: 'Bolt-on holds. Every crate is someone’s fortune.',
  },
  {
    id: 'sensors', name: 'Sensor Array', stat: 'radar', add: [450, 1000],
    prices: [6000, 15000],
    desc: 'Longer eyes. You will see them before they see you.',
  },
  {
    id: 'lumens', name: 'Lumen Tank', stat: 'lumenMax', add: [2, 4],
    prices: [8000, 18000],
    desc: 'Extra bunkerage for the jump coils. Two more lanes before you worry.',
  },
  {
    id: 'warpplotter', name: 'Warp Field Plotter',
    prices: [34000],
    effectText: 'Plots a light dotted line to the nearest clear space and reads out the distance, so you always know how far the field extends.',
    desc: 'A nav adjunct that listens to the drowned note every world and station sings into the ether. It draws the shortest way out of a dampened well — down to the metre.',
  },
  {
    id: 'repairdrones', name: 'Repair Drones', stat: 'armorRegen', add: [1.3, 2.9],
    prices: [24000, 52000],
    desc: 'Tiny devoted welders that stitch you back together mid-fight.',
  },
  {
    id: 'aegis', name: 'Aegis Lattice', stat: 'shield', add: [210], unique: 'vig',
    prices: [36000],
    desc: 'Vigil shieldwork: a lattice grown rather than built, woven over the whole hull. The Watch fits it to those who swear.',
  },
  {
    id: 'warcraft', name: 'Clan Warplating', stat: 'hull', add: [270], unique: 'rea',
    prices: [34000],
    desc: 'Plating beaten flat by hand and bolted on with grudges. It has already survived worse than you.',
  },
  {
    id: 'uplink', name: 'Trade Uplink', stat: 'cargo', add: [80], unique: 'com',
    prices: [32000],
    desc: 'A Combine manifest-cogitator and padded hold racks. Every crate finds its best price by itself.',
  },
  {
    id: 'gyros', name: 'Inertial Gyros', stat: 'turn', add: [0.25, 0.5],
    prices: [12000, 26000],
    desc: 'A rapid-response gyro cluster: higher turn rate. In a knife fight, coming about faster is everything.',
  },
  {
    id: 'gunmount', name: 'Auxiliary Gun Mount', stat: 'mounts', add: [1, 2],
    prices: [42000, 88000],
    desc: 'Weld-on hardpoints and fire-control runs. More guns, as long as the hull can carry them.',
  },
  {
    id: 'dockbay', name: 'Docking Bay', stat: 'bays', add: [1, 2],
    prices: [55000, 120000],
    desc: 'A pressurised bay and launch cradle. Holds one small craft, ready to scramble.',
  },
  {
    id: 'fleetcommand', name: 'Fleet Command Uplink', stat: 'fleetSlots', add: [2, 4],
    prices: [60000, 140000],
    desc: 'Fleet-band comms, formation software and the paperwork that lets other captains fly your wing.',
  },
  {
    id: 'targeting', name: 'Auto-Tracking Computer',
    prices: [28000, 65000, 120000],
    effectText: 'Guns follow your locked target: arc ±30° → ±60° → ±120° → full turret; spread tightens each level.',
    desc: 'Frees the guns from the nose. The computer holds the solution on your selected target — the wider the arc, the wilder the knife fight it can keep up with.',
  },
  {
    id: 'archivist', name: 'Archivist Core', stat: 'radar', add: [900], add2: { stat: 'lumenMax', add: [2] },
    prices: [58000], unique: 'quest',
    desc: 'A survey union’s master ledger in a shielded crate: charts, corrections and every petulant footnote. Sensors +900, jump coils +2.',
  },
  {
    id: 'foreman', name: "Foreman's Rig", stat: 'hull', add: [330], add2: { stat: 'armorRegen', add: [0.8] },
    prices: [62000], unique: 'quest',
    desc: 'Deep-rock bracing, bolt pattern unchanged since the first shaft was sunk. Hull +330, plus a welding crew’s worth of self-repair.',
  },
  {
    id: 'ghostweave', name: 'Ghostweave', stat: 'turn', add: [0.55], add2: { stat: 'maxSpeed', add: [26] },
    prices: [66000], unique: 'quest',
    desc: 'Shield-silk from a Brasstide loom, cut for a hull that refuses to be caught square. Turn +0.55 and top speed +26.',
  },

  /* Relics — vault-grade fittings, graded by era (band I → III). Unlocked by
     relic-hunt contracts and installed at mechanics like any other system. */
  {
    id: 'pilgrimplate', name: 'Pilgrim Plate', stat: 'hull', add: [150],
    prices: [34000], unique: 'relic', legend: true, band: 1,
    desc: 'Layered shutter-plate carried aboard a pre-descent pilgrimage ship, each dent still wearing its pilgrim’s chalk mark. Hull +150.',
  },
  {
    id: 'shrinecoils', name: 'Shrine Coils', stat: 'shield', add: [120], add2: { stat: 'shieldRegen', add: [1.4] },
    prices: [38000], unique: 'relic', legend: true, band: 1,
    desc: 'The votive lattice from a wayside shrine, rewound for a gun deck. Shield +120 and faster recovery — the acolytes never asked what it guarded against.',
  },
  {
    id: 'bulwarkheart', name: 'Bulwark Heart', stat: 'shield', add: [300],
    prices: [135000], unique: 'relic', legend: true, band: 2,
    desc: 'A line-ship’s master lattice, sealed in its own shrine for two hundred years and still warm to the touch. Shield +300.',
  },
  {
    id: 'dirgeplate', name: 'Dirge Plating', stat: 'hull', add: [420], add2: { stat: 'armorRegen', add: [0.5] },
    prices: [128000], unique: 'relic', legend: true, band: 2,
    desc: 'Armour laid down for a funeral barge that outlived its fleet. Hull +420, and it still creeps shut over its own scars.',
  },
  {
    id: 'crownofash', name: 'Crown of Ash', stat: 'turn', add: [0.6], add2: { stat: 'maxSpeed', add: [30] },
    prices: [310000], unique: 'relic', legend: true, band: 3,
    desc: 'The helm-gyro from the last admiral’s flagship, rescued before the pyre they built for it. Turn +0.6 and top speed +30 — it answers before you ask.',
  },
  {
    id: 'worldheart', name: 'Worldheart Frame', stat: 'hull', add: [540], add2: { stat: 'shield', add: [140] },
    prices: [380000], unique: 'relic', legend: true, band: 3,
    desc: 'A keel-drum cut from the spine of a shipwright world, light enough to fly and heavy enough to argue with a capital. Hull +540, shield +140.',
  },
];

export const OUTFIT_BY_ID = Object.fromEntries(OUTFITS.map((o) => [o.id, o]));
