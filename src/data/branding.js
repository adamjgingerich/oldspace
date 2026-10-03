// ------------------------------------------------------------------
// GAME IDENTITY — change these strings to rename the game.
// Everything player-visible (title screen, page title, star chart) reads
// from here.
//
// Note: localStorage keys elsewhere ("thewinds.save.*", "thewinds.audio",
// "thewinds.timescale") are deliberately NOT derived from the title — they
// stay fixed so your 15 save slots survive any rename.
// ------------------------------------------------------------------

export const GAME_TITLE = 'Oldspace';
export const GAME_SAGA = 'Saga 1'; // first of many — future sagas slot in beside this
// Saga 1's own name:
export const GAME_CHAPTER = 'The Descent of Glory';
export const GAME_TITLE_HTML = 'OLD<b>SPACE</b>';
export const GAME_SUBTITLE = `${GAME_SAGA} — ${GAME_CHAPTER}`;
export const GAME_TAGLINE = '“Run the lanes. Dodge the reavers. Outrun the light.”';
export const GAME_PAGE_TITLE = `${GAME_TITLE} — ${GAME_SAGA}: ${GAME_CHAPTER}`;

/** The name of the cluster on the star chart. */
export const CLUSTER_NAME = 'The Ten Lanes & the Outer Reach';
