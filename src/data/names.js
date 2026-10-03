// Name generators for bounty targets and flavour text.

import { RELIC_RUMORS } from './voices.js';

export const PIRATE_FIRST = [
  'Skarn', 'Vale', 'Marrow', 'Kestrel', 'Dross', 'Tarnish', 'Gant', 'Rhoke',
  'Sable', 'Thorn', 'Cinder', 'Wreck', 'Pike', 'Lorn', 'Brass', 'Quill',
  'Havik', 'Mother', 'Old', 'Quick', 'Tarok', 'Brakk', 'Ossa', 'Vass',
];

export const PIRATE_EPITHET = [
  'the Lame', 'the Gilded', 'the Unmoored', 'of the Hollow', 'the Flayed Hull',
  'the Late', 'the Sly', 'Hullbreaker', 'the Faithless', 'Sunburnt', 'the Hollow',
  'Ashhand', 'the Widow', 'Ninefingers', 'the Patient', 'of Nowhere',
  'of the Broken Oath', 'Blade-Bound',
];

/** Old-blood houses of the Kreth. */
export const HOUSE_NAMES = [
  'House Sarn', 'House Morad', 'House Keth', 'House Vadu',
  'House Irdek', 'House Braal', 'House Torsk', 'House Askal',
];

export const SHIP_NAMES = [
  'Bright Penny', 'Second Star', 'Grey Gull', 'Long Odds', 'Kind Regret',
  'Patience', 'Saltline', 'The Argument', 'Nettle', 'First Light', 'Borrowed Time',
  'Wanderlust', 'Quiet Fury', 'Tidewash', 'Last Word', 'Half Fortune',
];

export const RUMORS = [
  'A hauler out of Sunward swore the sun leaned over and looked at him. He drinks now.',
  'Ember Ash fetches triple at Meridian. The Vigil fetches you at even odds.',
  'The Hollow has no patrols and no witnesses. Bring both yourself, or bring escorts.',
  'Old pilots say: never trust a docking clamp with more paint than welds.',
  'Stormgalleons move whole towns. Their captains move whole conversations toward money.',
  'The Vigil pays bounties without haggling. The Reavers pay without counting.',
  'Lumen tanks run dry exactly one lane short of anywhere.',
  'Every wreck on the Ashfall belt was “the fastest ship on the lane”.',
  'At Vek’Tal they say a debt unpaid is a wound unhealed. The Houses remember both.',
  'The Kreth duel for slights the rest of us would call weather. Decline twice and they stop asking nicely.',
  'Wine from Kratha is drunk warm, only for oaths and funerals. Both happen often there.',
  'A House captain will name her ancestors before herself. Learn one name, and you are owed a favour.',
  'Do not thank a Kreth for mercy. They will insist you earn it instead.',
  ...RELIC_RUMORS,
];
