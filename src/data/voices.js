// Voices of the Ten Lanes — briefing flourishes, desk dialogue, space hails and
// the lines people say when the paperwork is finally stamped.
//
// Pools are drawn with the board rng so every station's board reads differently.

/** Extra flavour appended to a contract's own words, by job type. */
export const BRIEFS = {
  delivery: [
    'The clerk stamps it twice, once for you and once for the insurance man.',
    '“Mind the manifests,” the factor says. “Paperwork hates vacuum.”',
    'A loader hums a hymn while bolting the crates down. Nobody translates it.',
    '“If it arrives wet, we never spoke,” says the quartermaster, signing anyway.',
  ],
  courier: [
    'The sender watches until the seal is pocketed. No receipt is offered, none is asked for.',
    '“Fast, quiet, tidy,” the clerk says, ticking each word like a wager.',
    'A boy on the gantry waves you off with both hands, like a drowning man.',
    'The case is warm on one side. You decide not to ask which.',
  ],
  bounty: [
    'The posting agent slides a photograph across the desk. It has been folded many times.',
    '“Professionals collect the bounty,” the clerk says. “Rookies collect the wounds.”',
    'Someone has inked a small skull in the margin. The ink looks fresh.',
    '“Bring the transponder, not the story,” the desk says, and returns to its ledger.',
  ],
  survey: [
    'The survey office smells of solder. An instrument hums behind the wall, slightly off key.',
    '“The last crew filed nothing,” the surveyor says. “File something.”',
    'They hand you a calibration shim and decline to explain what it is for.',
    'The contract includes a diagram of the beacon. The diagram has coffee on it.',
  ],
  sweep: [
    'The office windows are taped. This is explained neither before nor after.',
    '“Count is the count,” says the adjuster. “We pay on bodies, not enthusiasm.”',
    'A dispatcher chalks the lane name on a board already crowded with crossings-out.',
    'Somebody has left flowers under the duty desk. The shift change steps around them.',
  ],
  recovery: [
    'The insurance clerk’s hands shake until the tea arrives, then shake anyway.',
    '“Pods first, questions later,” the office says. “Preferably never.”',
    'A wall poster lists safety rules; three of them have been scratched out.',
    'The adjuster hands over the insurer’s seal and wishes you “a quiet field.”',
  ],
  relic: [
    'The collector pays in cash, counts it out twice and regrets it visibly.',
    '“The vault will hum when it tastes the cipher,” the collector says, as if reading weather.',
    'They insist the cipher is only a copy. They also insist you do not look at it.',
    '“Others have tried,” the collector adds, cheerfully. “Enjoy the lane.”',
  ],
};

/**
 * Contract complications — see missions.js rollTwist(). `brief` is desk
 * dialogue (appended to the offer), `arrival` is called out on reaching the
 * destination system, `label` is the chip on the contract card.
 */
export const TWIST_INFO = {
  watched: {
    label: 'WATCHED',
    brief: 'The desk clerk lowers their voice: “Word is the clans watch this lane. Expect company, and expect it early.”',
    arrival: 'This lane is watched — raider chatter spikes the moment you drop in.',
  },
  ambush: {
    label: 'AMBUSH',
    brief: '“The last two crews on this run never filed,” says the notice, in handwriting that presses through the paper. Someone has circled a single word: perhaps.',
    arrival: 'Ambush! They were waiting for this manifest.',
  },
  rival: {
    label: 'RIVAL',
    brief: 'A second posting for the same mark hangs beside yours, in fresh ink. Someone else means to collect.',
    arrival: 'A rival hand is hunting the same prize — they will shoot through you to take it.',
  },
  silent: {
    label: 'SILENT',
    brief: '“The transponder is weak,” the office warns. “The scope will only pick it up once you are close.”',
    arrival: 'The transponder is weak — the scope will pick it up only up close.',
  },
  gratuity: {
    label: 'GRATUITY',
    brief: '“The client pre-pays a gratuity,” the clerk admits. “Do not get used to it.”',
    arrival: '',
  },
  graft: {
    label: 'GREASED PALM',
    brief: 'The fee is higher than posted, and the clerk’s cousin is suddenly very interested in your manifest.',
    arrival: '',
  },
};

/** Lines spoken when a contract is settled. */
export const OUTROS = {
  delivery: [
    'The factor initials the manifest without reading it.',
    'Crates gone, receipt stamped, nobody asks about the smell.',
  ],
  courier: [
    'The case changes hands in a doorway. You never see the face.',
    'Payment lands before you have left the berth — the best kind of client.',
  ],
  bounty: [
    'The desk checks the transponder, nods, and files the name under “settled”.',
    'The posting agent peels the photograph off the wall and hands it to you.',
  ],
  survey: [
    'The office copies your tape, marks the beacon charted, and starts an argument over the results.',
    '“Clean readings,” the surveyor says, which is as close as they come to praise.',
  ],
  sweep: [
    'The dispatcher chalks the lane clean on the board.',
    'The adjuster counts your kills twice, in case you lied politely.',
  ],
  recovery: [
    'The insurer’s seal is pressed and the file closed in one motion.',
    'The clerk files the pods under “act of nobody’s fault”.',
  ],
  relic: [
    'The collector takes the readings, smiles at nothing, and walks away quickly.',
    'The cipher is returned empty. It hums faintly, unimpressed, all the way to the lockbox.',
  ],
};

/** The moment a vault gives way. */
export const RELIC_OPENED = [
  'The vault hums, tastes the cipher, and yawns open.',
  'Seals older than the Lanes crack in sequence, unhurried.',
  'The lock was never built for hurry. It opens anyway.',
];

/** Radio chatter — one voice at a time, close enough to mean it. */
export const HAILS = {
  pirate: [
    'Cut your engines and maybe we cut nothing else.',
    'That hold looks heavy, captain. We can help with that.',
    'You are in the wrong lane for keeping your cargo.',
    'Hand it over and we will let the story spread.',
    'Nothing personal. It is just arithmetic.',
    'We have been waiting on a hull like yours.',
    'Last chance to drop your manifest and run.',
    'The clans send their regards, and their invoice.',
  ],
  rival: [
    'That mark is mine, captain. Fly on, or burn.',
    'I was posted first. You are the complication.',
    'Nothing personal — the fee only clears once.',
    'Turn around and I will forget your transponder.',
  ],
};

/** New bar lines about vaults and relics (appended to names.js RUMORS). */
export const RELIC_RUMORS = [
  'A collector on Meridian pays for old vaults the way priests pay for relics — badly, but twice.',
  'Pre-descent vaults open for ciphers, not cutters. Bring the key, not the guns.',
  'Every relic in the Reach was somebody’s heirloom, and somebody is still cross about it.',
  'The vaults hum to themselves in the dark. Pilots who hear it twice start collecting.',
];
