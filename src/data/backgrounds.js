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
    tags: ['trader', 'free lanes'],
    perks: {
      credits: 1500,
      outfits: { cargopod: 1 },
      cargo: { ore: 20 },
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
    tags: ['law', 'combat'],
    perks: {
      credits: 1200,
      outfits: { shieldboost: 1 },
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
    tags: ['outlaw', 'risk'],
    perks: {
      credits: 1800,
      weapons: { slot: 1, id: 'harpoon', ammo: 8 },
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
    tags: ['explorer', 'science'],
    perks: {
      credits: 1400,
      outfits: { sensors: 1 },
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
    tags: ['engineer', 'combine'],
    perks: {
      credits: 1600,
      outfits: { dynamo: 1 },
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
    tags: ['fighter', 'independent'],
    perks: {
      credits: 900,
      weapons: { slot: 0, id: 'twinpulse' },
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
    tags: ['kreth', 'honour'],
    perks: {
      credits: 1300,
      outfits: { plating: 1 },
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
    tags: ['outlaw', 'trade'],
    perks: {
      credits: 1700,
      cargo: { medicine: 6 },
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
    tags: ['miner', 'independent'],
    perks: {
      credits: 1200,
      cargo: { ore: 14 },
      rep: { free: 5 },
    },
  },
];

export const DRIVES = [
  {
    id: 'debt',
    name: 'The Marker',
    blurb: 'A financier on Meridian holds your note, and the interest compounds with the days. ₡2,500 up front — you will meet again.',
    perks: { credits: 2500 },
  },
  {
    id: 'name',
    name: 'The Name',
    blurb: 'One hull took everything from you. You keep the name filed under “soon”. The long shot starts with sharper instincts.',
    perks: { skillPoints: 1 },
  },
  {
    id: 'question',
    name: 'The Question',
    blurb: 'Something out there is still unanswered, and you are the only one left asking. A quiet credit reserve and an easy conscience.',
    perks: { credits: 800, karma: 3 },
  },
  {
    id: 'weight',
    name: 'The Weight',
    blurb: 'You did the thing you tell no one about. The lanes are wide, and you intend to be wide enough to fit around it.',
    perks: { karma: 8 },
  },
];

export const BACKGROUND_BY_ID = Object.fromEntries(BACKGROUNDS.map((b) => [b.id, b]));
export const DRIVE_BY_ID = Object.fromEntries(DRIVES.map((d) => [d.id, d]));
