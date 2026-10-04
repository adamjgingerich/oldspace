// ------------------------------------------------------------------
// GAME IDENTITY — change these strings to rename the game.
// Everything player-visible (title screen, page title) reads from here.
//
// Note: localStorage keys elsewhere ("oldspace.save.*", "oldspace.audio",
// "oldspace.timescale") are deliberately NOT derived from the title — they
// stay fixed so your 15 save slots survive any rename.
// ------------------------------------------------------------------

export const GAME_TITLE = 'Oldspace';
export const GAME_SAGA = 'Saga 1'; // first of many — future sagas slot in beside this
// Saga 1's own name:
export const GAME_CHAPTER = 'The Descent of Glory';
export const GAME_TITLE_HTML = 'OLD<b>SPACE</b>';
export const GAME_SUBTITLE = `${GAME_SAGA} — ${GAME_CHAPTER}`;
export const GAME_PAGE_TITLE = `${GAME_TITLE} — ${GAME_SAGA}: ${GAME_CHAPTER}`;

/**
 * Build version, shown as a discrete stamp in the bottom-left corner.
 *
 * BUMP THIS BY ONE HUNDREDTH (0.01) WITH EVERY SIGNIFICANT EDIT, in the same
 * change that touches gameplay — 0.43 → 0.44 → 0.45. Two captains comparing
 * screenshots can then tell in one glance whose build is older, and a bug
 * report can name the version it came from.
 */
export const GAME_VERSION = '0.52';
