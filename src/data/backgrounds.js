// Character backgrounds and personal drives.
//
// A background is where you come from; a drive is why you still fly.
// Both are deliberately open-ended: they set a tone, a few starting perks
// and a lean toward certain skills — they never lock content away, so the
// character can grow in any direction later.

export const BACKGROUNDS = [
  {
    id: 'hauler',
    name: 'Lane Hauler',
    blurb:
      'You grew up in the cab of a bulk hauler, learning margins before you learned to shave. '
      + 'Three runs a season on the grain circuit taught you which stations cheat and which stars drift. '
      + 'The ship is yours now — bought, not inherited, and not entirely paid for.',
    leans: 'Piloting · Haggler',
    role: 'Trader',
    strengths: [
      'Best starting hold in the game: cargo pods plus 20 ore already loaded for your first sale.',
      'Haggler training — you buy and sell better than any other start.',
      'Free ports already know you (+6 standing), so honest work comes easy.',
    ],
    tradeoffs: [
      'No weapon training and no combat gear: you start with the stock cutter and one harpoon short of a fight.',
      'Reputation with the Vigil and the Combine is neutral — you have not earned a discount anywhere.',
    ],
    signature: {
      name: 'Loadmaster',
      desc: 'You read a manifest like a chart. Rank 1 Haggler from the first second, and a hold that is already earning.',
    },
    tags: ['trader', 'free lanes'],
    perks: {
      credits: 1500,
      outfits: { cargopod: 1 },
      cargo: { ore: 20 },
      skills: { haggler: 1 },
      rep: { free: 6 },
    },
  },
  {
    id: 'cadet',
    name: 'Ex-Vigil Cadet',
    blurb:
      'Eleven years in the Vigil academy, one bad call over Coriolis, and a discharge stamped “honourable”. '
      + 'You can field-strip a shield relay blindfolded and you still flinch at the word “oath”. '
      + 'They gave you a mustering-out bonus and a warning: stay clear of the lanes they patrol.',
    leans: 'Countermeasures · Oathplate',
    role: 'Law · Combat',
    strengths: [
      'Shield Booster fitted from the outset — the toughest starting shields of any background.',
      'Countermeasures training: hostile missiles and seekers are markedly worse against you.',
      'The Vigil starts you at +10, so their stations, bounties and berths open early.',
    ],
    tradeoffs: [
      'The Clans start you at −4: Reaver space pays less and bites sooner.',
      'You carry paper, not guns — your starting firepower is the stock loadout.',
    ],
    signature: {
      name: 'Oathplate',
      desc: 'Vigil-grade shieldwork and the drills to use it. Rank 1 Countermeasures, and a shield booster bolted on before you fly.',
    },
    tags: ['law', 'combat'],
    perks: {
      credits: 1200,
      outfits: { shieldboost: 1 },
      skills: { counter: 1 },
      rep: { vigil: 10, reaver: -4 },
    },
  },
  {
    id: 'reaver',
    name: 'Reaver Whelp',
    blurb:
      'You ran with the Hollow packs before your voice broke, eating what the strong ships left. '
      + 'You know every fence, kennel and kill-pit from here to Ashfall — and exactly what they do to welps who outlive their welcome. '
      + 'One day you will have to answer for the name you carry; today you just need a hull to your back.',
    leans: 'Scavenger · Bloodlust',
    role: 'Outlaw · Risk',
    strengths: [
      'Bloodlust training — every kill you land feeds your next shot.',
      'A Harpoon missile rack fitted in your second hardpoint with 8 rounds, the heaviest opening punch available.',
      'Reaver space starts at +12: the Clans sell to you, brief you, and shoot past you.',
      'The largest credit stake of any start (₡1,800).',
    ],
    tradeoffs: [
      'Karma starts at −5 — the lanes already suspect you.',
      'The Vigil (−6) and Combine (−4) start cold: their stations gate you harder and their patrols watch.',
      'No hull, shield or hold upgrades: all of your advantage is spent on weapons.',
    ],
    signature: {
      name: 'Blood Oath',
      desc: 'You learned to fight before you learned to fly straight. Rank 1 Bloodlust, a loaded harpoon rack, and a name the Clans already know.',
    },
    tags: ['outlaw', 'risk'],
    perks: {
      credits: 1800,
      weapons: { slot: 1, id: 'harpoon', ammo: 8 },
      skills: { bloodlust: 1 },
      rep: { reaver: 12, vigil: -6, combine: -4 },
      karma: -5,
    },
  },
  {
    id: 'surveyor',
    name: 'Deep Surveyor',
    blurb:
      'Ten years logging dead worlds for the Combine taught you to love silence with an atmosphere reading in it. '
      + 'Your survey record is a graveyard of one-visit contracts — nobody funds second looks, and you never learned to stop looking. '
      + 'The instruments are yours; the questions are still open.',
    leans: 'Windfall · Vigilance',
    role: 'Explorer · Science',
    strengths: [
      'Windfall training — planet and star surveys pay you noticeably more.',
      'Sensor Array fitted: you see contacts and survey targets far earlier than anyone else.',
      'Combine and free-port standing both start positive (+4 each): uncontested docking almost everywhere.',
    ],
    tradeoffs: [
      'The weakest combat start: no weapons, no shield or hull upgrades.',
      'The Clans are neutral, so Reaver space is neither friendly nor dangerous — just unwelcoming.',
    ],
    signature: {
      name: 'First Look',
      desc: 'Nobody funds second surveys. Rank 1 Windfall, a full sensor array, and an eye for what a dead world is worth.',
    },
    tags: ['explorer', 'science'],
    perks: {
      credits: 1400,
      outfits: { sensors: 1 },
      skills: { windfall: 1 },
      rep: { combine: 4, free: 4 },
    },
  },
  {
    id: 'engineer',
    name: 'Foundry Engineer',
    blurb:
      'You bent your first power coupling on the Coriolis line and spent two decades keeping other people’s drives honest. '
      + 'The Directorate paid well and asked for your name on nothing. When they asked for your name anyway, you left with a toolkit and a grudge. '
      + 'Engines talk to you. People remain a work in progress.',
    leans: 'Automation · Foundry Access',
    role: 'Engineer · Combine',
    strengths: [
      'Automation Doctrine — your systems run cheaper and cooler than anyone else\'s.',
      'Auxiliary Dynamo fitted: your energy comes back faster, so your guns and shields recover sooner.',
      'Combine standing starts at +8: the best prices and the deepest shipyards open early.',
    ],
    tradeoffs: [
      'The Clans start at −3 and the free ports are neutral — the outer lanes are hostile ground.',
      'No weapons or cargo: you begin with systems, not firepower or freight.',
    ],
    signature: {
      name: 'Foundry Access',
      desc: 'Two decades of keeping other people\'s drives honest. Rank 1 Automation Doctrine, an aux dynamo, and a Combine that owes you a favour it never wrote down.',
    },
    tags: ['engineer', 'combine'],
    perks: {
      credits: 1600,
      outfits: { dynamo: 1 },
      skills: { automation: 1 },
      rep: { combine: 8, reaver: -3 },
    },
  },
  {
    id: 'marine',
    name: 'Discharged Marine',
    blurb:
      'The war at the Meridian reach ended four years ago. Your reflexes never got the message. '
      + 'You mustered out with a duelling piece, a crate of citations and hands that are steadier in a fight than at a bar. '
      + 'Nobody sells a purpose, but the lanes keep finding you work that fits.',
    leans: 'Trigger Work · Frontier Grit',
    role: 'Fighter · Independent',
    strengths: [
      'Trigger Work training: your guns hit harder and settle faster than any other start.',
      'Twin Pulse fitted in your first hardpoint — double the rate of fire of the stock pulse lance.',
      'Free ports (+5) and the Vigil (+4) both start friendly, so you can fight for either.',
    ],
    tradeoffs: [
      'Only ₡900 to your name — the smallest purse of any background.',
      'No hull, shield or cargo upgrade: a duelist\'s start, not a survivor\'s.',
    ],
    signature: {
      name: 'Steady Hands',
      desc: 'Your reflexes never got the message that the war ended. Rank 1 Trigger Work and a twin-pulse in the nose.',
    },
    tags: ['fighter', 'independent'],
    perks: {
      credits: 900,
      weapons: { slot: 0, id: 'twinpulse' },
      skills: { trigger: 1 },
      rep: { free: 5, vigil: 4 },
    },
  },
  {
    id: 'ward',
    name: 'House Ward',
    blurb:
      'Warded to a Kreth House before you could read, you learned the duelling cadence the way other children learn lullabies. '
      + 'The Houses kept you fed, taught and watched. When you left to fly your own hull they did not object — the Houses are patient accountants, and an oath-child can always be called home.',
    leans: 'House Plate · Dueling Cadence',
    role: 'Kreth · Honour',
    strengths: [
      'House Plate training: your plating takes punishment that would open another hull.',
      'Ablative Plating fitted — the largest raw hull pool of any background.',
      'Kreth standing starts at +8, and karma at +4: the Houses take your calls and your word.',
    ],
    tradeoffs: [
      'Slow off the mark: plating is weight, and the stock drive notices.',
      'No weapon upgrade and no cargo. The Vigil and Reavers are both neutral, so nobody covers for you.',
    ],
    signature: {
      name: 'Dueling Cadence',
      desc: 'You learned the cadence the way other children learn lullabies. Rank 1 House Plate, ablative plating, and an oath-child\'s name in the old halls.',
    },
    tags: ['kreth', 'honour'],
    perks: {
      credits: 1300,
      outfits: { plating: 1 },
      skills: { houseplate: 1 },
      rep: { kreth: 8 },
      karma: 4,
    },
  },
  {
    id: 'smuggler',
    name: 'Customs Runner',
    blurb:
      'You learned to fly by dodging the scans you grew up between. Customs offices up and down the Ten know your old transponder by heart and your manifests by smell. '
      + 'You went legit the day you bought this hull — mostly — and the old contacts still take your calls.',
    leans: 'Black Sun Deals · Free Broker',
    role: 'Outlaw · Trade',
    strengths: [
      'Black Sun Deals training — the black market opens to you and pays better.',
      'Six crates of medicine in the hold, worth a small fortune at the right port.',
      'Reaver (+4) and free-port (+4) standing: welcome on both sides of the law.',
    ],
    tradeoffs: [
      'The Combine starts at −3: their inspectors remember your old transponder.',
      'No combat or hull upgrades — the medicine is your seed capital and your risk.',
    ],
    signature: {
      name: 'Old Transponder',
      desc: 'Customs knows your manifests by smell. Rank 1 Black Sun Deals, and a hold of medicine that is not strictly declared.',
    },
    tags: ['outlaw', 'trade'],
    perks: {
      credits: 1700,
      cargo: { medicine: 6 },
      skills: { blacksun: 1 },
      rep: { reaver: 4, free: 4, combine: -3 },
    },
  },
  {
    id: 'drifter',
    name: 'Asteroid Drifter',
    blurb:
      'You grew up in a mining camp anchored to rock, checking the drift before you checked the weather. A claim gone bust and a partner gone worse sent you to the lanes with a cutting torch and a stubborn streak. '
      + 'Wrecks sing to you; you have learned the words.',
    leans: 'Scavenger’s Rights · Salvager',
    role: 'Miner · Independent',
    strengths: [
      'Salvager training — wrecks, pods and hulks yield more in your hands.',
      '14 crates of ore already aboard: money in the hold from the first berth you reach.',
      'Free ports start at +5, which is where most of the honest salvage work is posted.',
    ],
    tradeoffs: [
      'No combat rank and no weapons beyond the stock loadout — a claim jumper will outgun you.',
      'Nobody else\'s standing is special: the Vigil, Combine and Clans all treat you as a stranger.',
    ],
    signature: {
      name: 'Reads the Drift',
      desc: 'Wrecks sing to you and you have learned the words. Rank 1 Salvager, ore in the hold, and a cutting torch that has seen worse.',
    },
    tags: ['miner', 'independent'],
    perks: {
      credits: 1200,
      cargo: { ore: 14 },
      skills: { salvager: 1 },
      rep: { free: 5 },
    },
  },
];

export const DRIVES = [
  {
    id: 'debt',
    name: 'The Marker',
    blurb: 'A financier on Meridian holds your note, and the interest compounds with the days. ₡2,500 up front — you will meet again.',
    boon: '₡2,500 immediately — the biggest cash start in the game.',
    cost: 'You fly to pay it. The note is a story hook, and Meridian is where it collects.',
    perks: { credits: 2500 },
  },
  {
    id: 'name',
    name: 'The Name',
    blurb: 'One hull took everything from you. You keep the name filed under “soon”. The long shot starts with sharper instincts.',
    boon: '+1 skill point — a head start on any skill tree you like.',
    cost: 'No credits and no karma: you begin with a grudge and nothing else.',
    perks: { skillPoints: 1 },
  },
  {
    id: 'question',
    name: 'The Question',
    blurb: 'Something out there is still unanswered, and you are the only one left asking. A quiet credit reserve and an easy conscience.',
    boon: '₡800 and +3 karma — a modest purse that opens doors with the law-abiding.',
    cost: 'The smallest cash reserve of the four drives.',
    perks: { credits: 800, karma: 3 },
  },
  {
    id: 'weight',
    name: 'The Weight',
    blurb: 'You did the thing you tell no one about. The lanes are wide, and you intend to be wide enough to fit around it.',
    boon: '+8 karma — the cleanest name you can start: better prices from honest brokers, easier skills to learn.',
    cost: 'No credits at all, and the darker karma-gated skills stay out of reach until you fall.',
    perks: { karma: 8 },
  },
];

export const BACKGROUND_BY_ID = Object.fromEntries(BACKGROUNDS.map((b) => [b.id, b]));
export const DRIVE_BY_ID = Object.fromEntries(DRIVES.map((d) => [d.id, d]));
