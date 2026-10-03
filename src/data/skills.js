// Skill trees.
//
// Six categories of commander training: Defence, Offence, Economic,
// Propulsion, Fleet and Diplomatic. Spend the points you earn per level;
// tiers open as you invest ranks in a category, and a handful of elite
// skills are unlocked by finishing story chapters and side jobs.
//
// Skill shapes:
//   stat/add   — flat bonus per rank, merged into computeStats()
//   mod        — fractional multipliers per rank (combat, trade, repairs…)
//   cost       — skill points per rank (tier 1 = 1 … elite tier 4 = 4)
//   req        — story chapter / side-chain / kills / level unlock gates
//   karmamin/karmamax/karmaabs — alignment gates (see canLearn in game/skills.js)
export const SKILL_TREES = [
  {
    id: 'def',
    name: 'Defence',
    color: '#63d8ff',
    desc: 'Staying alive is a discipline. Plating, lattices, damage control and the cold art of being harder to kill than you look.',
    skills: [
      {
        id: 'patch', name: 'Patched Hull', tier: 1, max: 3, cost: 1,
        stat: 'hull', add: 36,
        desc: 'You weld like someone who has been spaced before and objected.',
      },
      {
        id: 'oathplate', name: 'Oathplate', tier: 1, max: 3, cost: 1,
        stat: 'shield', add: 48,
        desc: 'Vigil armourers overbuild every plate. The oath is heavy; the shielding is heavier.',
      },
      {
        id: 'recirculate', name: 'Shield Recirculators', tier: 1, max: 3, cost: 1,
        stat: 'shieldRegen', add: 0.7,
        desc: 'Plumbing the lattice like a connoisseur. The shield comes back while the argument is still going.',
      },
      {
        id: 'bulwark', name: 'Bulwark Drills', tier: 1, max: 3, cost: 1,
        mod: { dmgTaken: -0.02 },
        desc: 'Angle the hull, show the shoulder, let the plate do the talking. Incoming damage −2% per rank.',
      },
      {
        id: 'grit', name: 'Frontier Grit', tier: 1, max: 3, cost: 1,
        stat: 'hull', add: 40,
        desc: 'Free port yards patch honest holes with honest steel. Hull +40 per rank.',
      },
      {
        id: 'counter', name: 'Countermeasures', tier: 2, max: 3, cost: 2,
        mod: { dmgTaken: -0.04 },
        desc: 'Chaff patterns and shield harmonics. Incoming damage −4% per rank.',
      },
      {
        id: 'redoubt', name: 'Redoubt Plating', tier: 2, max: 3, cost: 2,
        stat: 'hull', add: 52,
        desc: 'Layered spall liners over the vitals. When the lattice fails, this is what argues back.',
      },
      {
        id: 'layering', name: 'Ablative Layering', tier: 2, max: 3, cost: 2,
        stat: 'shield', add: 65,
        desc: 'Ceramic over lattice over stubbornness. Shield +65 per rank.',
      },
      {
        id: 'nanoweld', name: 'Nanite Welders', tier: 2, max: 2, cost: 2,
        stat: 'armorRegen', add: 0.8,
        desc: 'Tiny devoted welders that stitch the hull mid-fight. They never ask what caused the hole.',
      },
      {
        id: 'houseplate', name: 'House Plate', tier: 3, max: 3, cost: 3,
        stat: 'shield', add: 55,
        desc: 'Armour struck in the ancestor forges and fitted to a living captain. Shield +55 per rank.',
      },
      {
        id: 'damagecontrol', name: 'Damage Control Parties', tier: 3, max: 3, cost: 3,
        stat: 'armorRegen', add: 0.5,
        desc: 'Crews who run toward the bad noise with extinguishers and bad language.',
      },
      {
        id: 'warden', name: "Warden's Oathplate", tier: 4, max: 1, cost: 4, req: { story: ['vig', 2] },
        stat: 'shield', add: 160, mod: { dmgTaken: -0.04 },
        desc: 'Sworn, sealed, and standing between. Unlocked by Chapter 2 of The Long Watch.',
      },
      {
        id: 'nameofhouse', name: 'Name of the House', tier: 4, max: 1, cost: 4,
        karmaMin: 30,
        stat: 'shield', add: 130, mod: { dmg: 0.08, contract: 0.1 },
        desc: 'A warrior’s name is collateral; let it be worth something. Requires karma +30.',
      },
      {
        id: 'laststand', name: 'Last Stand Protocol', tier: 4, max: 1, cost: 4, req: { kills: 120 },
        stat: 'hull', add: 110, mod: { dmgTaken: -0.05 },
        desc: 'You have been dead twice on paper and disagreed both times. Unlocked by destroying 120 raiders.',
      },
    ],
  },
  {
    id: 'off',
    name: 'Offence',
    color: '#ff6b8a',
    desc: 'Guns, charge discipline and the fine line between a duel and an execution. Everything here makes the fight shorter.',
    skills: [
      {
        id: 'trigger', name: 'Trigger Work', tier: 1, max: 3, cost: 1,
        mod: { dmg: 0.04 },
        desc: 'Weapon damage +4% per rank. Fire discipline learned the hard way.',
      },
      {
        id: 'coolant', name: 'Coolant Discipline', tier: 1, max: 3, cost: 1,
        stat: 'energyRegen', add: 1.6,
        desc: 'Heat is just wasted money. Charge regen +1.6 per rank.',
      },
      {
        id: 'capacitors', name: 'Gun Capacitors', tier: 1, max: 3, cost: 1,
        stat: 'energy', add: 25,
        desc: 'Bigger buffers between trigger and silence. Energy +25 per rank.',
      },
      {
        id: 'automation', name: 'Automation Doctrine', tier: 2, max: 3, cost: 2,
        stat: 'energyRegen', add: 2,
        desc: 'Bench-tested power routing. Charge regen +2 per rank.',
      },
      {
        id: 'bloodlust', name: 'Bloodlust', tier: 2, max: 3, cost: 2,
        mod: { dmg: 0.05 },
        desc: 'The pack smells hesitation before it smells blood. Weapon damage +5% per rank.',
      },
      {
        id: 'hunter', name: "Hunter's Instinct", tier: 2, max: 3, cost: 2,
        mod: { killLoot: 0.1, dmg: 0.01 },
        desc: 'Wrecks yield more when the victor checks the manifest first. Kill drops +10% per rank.',
      },
      {
        id: 'bladehonor', name: 'Blade Honor', tier: 3, max: 3, cost: 3,
        mod: { dmg: 0.04 },
        desc: 'Strike as though your name were watching. Weapon damage +4% per rank.',
      },
      {
        id: 'marksman', name: "Marksman's Patience", tier: 3, max: 3, cost: 3,
        stat: 'radar', add: 180, mod: { dmg: 0.02 },
        desc: 'Read the fight before it starts: longer sensor reach and a little more bite.',
      },
      {
        id: 'executioner', name: 'Executioner Cadence', tier: 3, max: 3, cost: 3,
        mod: { dmg: 0.05 },
        desc: 'No wasted bolts, no wasted breath. Weapon damage +5% per rank.',
      },
      {
        id: 'gunslinger', name: 'Gunslinger Drills', tier: 3, max: 3, cost: 3,
        stat: 'energyRegen', add: 1.2, mod: { dmg: 0.025 },
        desc: 'Fast hands, faster recharge. Charge +1.2 and damage +2.5% per rank.',
      },
      {
        id: 'warlord', name: "Warlord's Banner", tier: 4, max: 1, cost: 4, req: { story: ['rea', 2] },
        mod: { dmg: 0.08, killLoot: 0.25, dmgTaken: 0.03 },
        desc: 'Packs fight harder under a known name — and fly closer to the edge. Unlocked by Chapter 2 of Blood in the Black.',
      },
      {
        id: 'overkill', name: 'Overkill Doctrine', tier: 4, max: 1, cost: 4, req: { side: 'gunhand' },
        mod: { dmg: 0.09 },
        desc: 'There is no such thing as too much gun. Unlocked by finishing the Gunhand side jobs.',
      },
    ],
  },
  {
    id: 'eco',
    name: 'Economic',
    color: '#ffc857',
    desc: 'Buy low, sell dear, file early. Every skill here pays for itself — the trick is surviving long enough to collect.',
    skills: [
      {
        id: 'haggler', name: 'Haggler', tier: 1, max: 3, cost: 1,
        mod: { sell: 0.03, buy: -0.02 },
        desc: 'A raised eyebrow is worth two percent at any counter in the lanes.',
      },
      {
        id: 'salvager', name: 'Salvager', tier: 1, max: 3, cost: 1,
        mod: { podCredits: 0.15 },
        desc: 'Salvage claims pay +15% per rank. Nothing burns forever.',
      },
      {
        id: 'windfall', name: 'Windfall', tier: 1, max: 3, cost: 1,
        mod: { survey: 0.12 },
        desc: 'You file first surveys the way other people breathe. Survey bounties +12% per rank.',
      },
      {
        id: 'scavenger', name: "Scavenger's Rights", tier: 1, max: 3, cost: 1,
        mod: { podCredits: 0.1, killLoot: 0.07 },
        desc: 'First to the wreck owns the wreck. Salvage +10%, kill drops +7% per rank.',
      },
      {
        id: 'logistics', name: 'Logistics Chains', tier: 2, max: 3, cost: 2,
        stat: 'cargo', add: 45,
        desc: 'Containers that stack like an accountant’s smile. Hold +45 per rank.',
      },
      {
        id: 'foundry', name: 'Foundry Access', tier: 2, max: 3, cost: 2,
        mod: { repair: -0.08 },
        desc: 'Yard rates, parts at cost. Repair bills -8% per rank.',
      },
      {
        id: 'charter', name: 'Merchant Charter', tier: 2, max: 3, cost: 2,
        mod: { buy: -0.03 },
        desc: 'Your signature clears customs before your hull does. Buy prices -3% per rank.',
      },
      {
        id: 'blacksun', name: 'Black Sun Deals', tier: 2, max: 3, cost: 2,
        mod: { illegalSell: 0.1 },
        desc: 'Fences from here to Ashfall take your call. Contraband prices +10% per rank.',
      },
      {
        id: 'broker', name: 'Free Broker', tier: 3, max: 3, cost: 3,
        mod: { sell: 0.025, buy: -0.015 },
        desc: 'Every factor, fixer and fence in the free ports owes you a small favour.',
      },
      {
        id: 'wanted', name: 'Wanted Alive', tier: 3, max: 3, cost: 3,
        mod: { contract: 0.08 },
        desc: 'The Vigil pays bounty on paperwork, not corpses. Contract pay +8% per rank.',
      },
      {
        id: 'contractlaw', name: 'Contract Law', tier: 3, max: 2, cost: 3,
        mod: { contract: 0.08 },
        desc: 'You have read the fine print so the clerks stop writing it. Contract pay +8% per rank.',
      },
      {
        id: 'speculator', name: 'Lane Speculator', tier: 3, max: 2, cost: 3, req: { side: 'heirloom' },
        mod: { survey: 0.15, sell: 0.03 },
        desc: 'You buy rumours the way other people buy futures. Unlocked by finishing the Heirloom side jobs.',
      },
      {
        id: 'executive', name: 'Executive Authority', tier: 4, max: 1, cost: 4, req: { story: ['com', 2] },
        stat: 'lumenMax', add: 2, mod: { contract: 0.1 },
        desc: 'A ship with your seal moves lanes the rest of us queue for. Unlocked by Chapter 2 of First in the Ledger.',
      },
      {
        id: 'tradeking', name: 'Master of the Ledger', tier: 4, max: 1, cost: 4, req: { side: 'broker' },
        mod: { buy: -0.06, sell: 0.05 },
        desc: 'The counter recognises you before you speak. Unlocked by finishing the Broker side jobs.',
      },
    ],
  },
  {
    id: 'prop',
    name: 'Propulsion',
    color: '#8fe08f',
    desc: 'Speed is armour, and agility is mercy. Helm, thrust, braking and the long-range endurance to get home on fumes.',
    skills: [
      {
        id: 'piloting', name: 'Helm Instinct', tier: 1, max: 3, cost: 1,
        stat: 'turn', add: 0.04,
        desc: 'Years of muscle memory: the bow answers before you finish the thought.',
      },
      {
        id: 'burn', name: 'Burn Discipline', tier: 1, max: 3, cost: 1,
        stat: 'accel', add: 3,
        desc: 'Cleaner fuel maps and a lighter touch on the throttle quadrant.',
      },
      {
        id: 'retro', name: 'Retro Authority', tier: 1, max: 3, cost: 1,
        stat: 'brake', add: 18,
        desc: 'Stopping is just winning in reverse. Brake force +18 per rank.',
      },
      {
        id: 'lanesense', name: 'Lane Sense', tier: 2, max: 3, cost: 2,
        stat: 'maxSpeed', add: 8,
        desc: 'Tide-readers of the lane currents. Top speed +8 per rank.',
      },
      {
        id: 'dueling', name: 'Dueling Cadence', tier: 2, max: 3, cost: 2,
        stat: 'turn', add: 0.05,
        desc: 'Footwork drilled in the ring at Kratha until the helm moves like a blade. Turn rate +0.05 per rank.',
      },
      {
        id: 'ghost', name: 'Ghost Drive', tier: 2, max: 3, cost: 2,
        stat: 'accel', add: 4,
        desc: 'Hollow mechanics strip safety interlocks and call it tuning. Thrust +4 per rank.',
      },
      {
        id: 'dancer', name: 'Thruster Dance', tier: 3, max: 3, cost: 3,
        stat: 'turn', add: 0.04,
        desc: 'Three thrusters, one thought. Turn rate +0.04 per rank.',
      },
      {
        id: 'sprint', name: 'Combat Sprint', tier: 3, max: 3, cost: 3,
        stat: 'maxSpeed', add: 12,
        desc: 'A reserve of burn held back for the moment a fight becomes a race.',
      },
      {
        id: 'charting', name: 'Lane Charting', tier: 3, max: 2, cost: 3,
        stat: 'lumenMax', add: 1,
        desc: 'Old charts, folded twice and trusted anyway. Jump coils hold +1 lumen per rank.',
      },
      {
        id: 'vector', name: 'Vector Control', tier: 3, max: 3, cost: 3,
        stat: 'brake', add: 12, mod: { dmgTaken: -0.01 },
        desc: 'Drift with intent. Brake +12 per rank, and a little less of you gets caught square.',
      },
      {
        id: 'slipstream', name: 'Slipstream Runner', tier: 4, max: 1, cost: 4, req: { side: 'runner-lanes' },
        stat: 'maxSpeed', add: 26,
        desc: 'You know where the lane exhales. Top speed +26. Unlocked by finishing the Runner side jobs.',
      },
    ],
  },
  {
    id: 'fleet',
    name: 'Fleet',
    color: '#b388ff',
    desc: 'A wing is a multiplier. Command capacity, docking bays, sensors and the drills that make escorts worth their slot.',
    skills: [
      {
        id: 'vigilance', name: 'Vigilance', tier: 1, max: 3, cost: 1,
        stat: 'radar', add: 150,
        desc: 'Watch rotations, watch standings, watch everything. Sensor range +150 per rank.',
      },
      {
        id: 'winglead', name: 'Wing Leadership', tier: 1, max: 3, cost: 1,
        mod: { wingDmg: 0.04 },
        desc: 'Clear orders, clean vectors. Escort damage +4% per rank.',
      },
      {
        id: 'warfleet', name: 'War Fleet Discipline', tier: 2, max: 3, cost: 2,
        mod: { wingArmor: 0.04 },
        desc: 'Formation drills older than the lanes themselves. Escorts take 4% less damage per rank.',
      },
      {
        id: 'screens', name: 'Screen Tactics', tier: 2, max: 3, cost: 2,
        stat: 'radar', add: 80, mod: { wingDmg: 0.025 },
        desc: 'The wing sees first and hits first. Sensors +80 and escort damage +2.5% per rank.',
      },
      {
        id: 'formation', name: 'Formation Command', tier: 2, max: 2, cost: 2,
        stat: 'fleetSlots', add: 1,
        desc: 'Four ships flying as one. +1 escort slot per rank.',
      },
      {
        id: 'dockmaster', name: 'Dockmaster Papers', tier: 3, max: 1, cost: 3,
        stat: 'bays', add: 1,
        desc: 'A spare cradle and the paperwork to fill it. +1 docking bay.',
      },
      {
        id: 'swarmtactics', name: 'Swarm Tactics', tier: 3, max: 3, cost: 3,
        mod: { wingDmg: 0.03 },
        desc: 'Small craft sting in squadrons, not singly. Escort damage +3% per rank.',
      },
      {
        id: 'tender', name: 'Tender Protocols', tier: 3, max: 2, cost: 3,
        mod: { wingArmor: 0.03, wingDmg: 0.02 },
        desc: 'Somebody has to patch the wing back together mid-lane. Escorts take 3% less and deal 2% more.',
      },
      {
        id: 'signalmast', name: 'Signal Mast', tier: 3, max: 2, cost: 2,
        stat: 'radar', add: 180,
        desc: 'A tall antenna and a patient officer. Sensor range +180 per rank.',
      },
      {
        id: 'admiral', name: "Admiral's Mast", tier: 4, max: 1, cost: 4, req: { side: 'old-crew' },
        mod: { wingDmg: 0.08, wingArmor: 0.06 },
        desc: 'Your wing flies for you, not for the pay. Unlocked by finishing the Old Crew side jobs.',
      },
    ],
  },
  {
    id: 'dip',
    name: 'Diplomatic',
    color: '#ffb26e',
    desc: 'Standing is a currency. Make friends faster, make enemies slower, and let paperwork do the talking.',
    skills: [
      {
        id: 'etiquette', name: 'Lane Etiquette', tier: 1, max: 3, cost: 1,
        mod: { repGain: 0.05 },
        desc: 'The right salute, the right wine, the right silence. Reputation gains +5% per rank.',
      },
      {
        id: 'tongues', name: 'Trade Tongues', tier: 1, max: 3, cost: 1,
        mod: { buy: -0.02, sell: 0.02 },
        desc: 'Six dialects of haggling and one of apology. Buy -2%, sell +2% per rank.',
      },
      {
        id: 'safepassage', name: 'Safe Passage', tier: 2, max: 3, cost: 2,
        mod: { repLossCut: 0.1 },
        desc: 'An incident is not an insult if the right form is filed. Reputation losses reduced 10% per rank.',
      },
      {
        id: 'envoy', name: 'Envoy Protocols', tier: 2, max: 3, cost: 2,
        mod: { contract: 0.05, repGain: 0.03 },
        desc: 'You are the message. Contract pay +5% and reputation gains +3% per rank.',
      },
      {
        id: 'brokerage', name: 'Diplomatic Brokerage', tier: 2, max: 3, cost: 2,
        mod: { contract: 0.08 },
        desc: 'Every dispute has a price list. Contract pay +8% per rank.',
      },
      {
        id: 'mediator', name: 'Mediator', tier: 3, max: 3, cost: 3,
        mod: { repGain: 0.06, repLossCut: 0.06 },
        desc: 'Both sides leave thinking they won. Reputation gains +6% and losses -6% per rank.',
      },
      {
        id: 'compacts', name: 'Port Compacts', tier: 3, max: 3, cost: 3,
        mod: { buy: -0.03, sell: 0.03 },
        desc: 'A standing table at every port that matters. Buy -3%, sell +3% per rank.',
      },
      {
        id: 'consulate', name: 'Consular Reach', tier: 3, max: 3, cost: 3,
        mod: { contract: 0.04, repGain: 0.04 },
        desc: 'Letters of introduction that open doors and purses alike.',
      },
      {
        id: 'independent', name: 'Independent Streak', tier: 4, max: 1, cost: 4,
        karmaAbs: 15,
        mod: { dmg: 0.06, dmgTaken: -0.05, contract: 0.08 },
        desc: 'No flag, no leash, no favours owed either way. Requires karma within ±15 of neutral.',
      },
      {
        id: 'consul', name: 'Consul of the Ten', tier: 4, max: 1, cost: 4, req: { level: 12 },
        karmaMin: 10,
        mod: { repGain: 0.12, repLossCut: 0.12, buy: -0.05 },
        desc: 'A name spoken carefully in six languages. Requires level 12 and karma +10.',
      },
      {
        id: 'infiltrator', name: 'Mask of Many Flags', tier: 4, max: 1, cost: 4, req: { side: 'quiet' },
        mod: { repLossCut: 0.2, contract: 0.1 },
        desc: 'Nobody is sure whose colours you fly, least of all the people who paid for them. Unlocked by finishing the Quiet side jobs.',
      },
    ],
  },
];

export const SKILL_BY_ID = Object.fromEntries(
  SKILL_TREES.flatMap((t) => t.skills.map((s) => [s.id, { ...s, tree: t.id }])),
);
export const TREE_BY_ID = Object.fromEntries(SKILL_TREES.map((t) => [t.id, t]));

export const TIER_RANK_REQ = { 1: 0, 2: 3, 3: 7, 4: 12 }; // category ranks needed to open a tier
