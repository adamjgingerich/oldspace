// Persistence: 15 adventure slots in localStorage, each a full self-contained
// save. A slot also travels as a .os file — the state, plus everything a reader
// needs to make sense of it — so a log can leave the browser it was flown in and
// come back after the game has moved on.

import { storageGet, storageSet, storageRemove } from '../core/storage.js';
import { GAME_TITLE, GAME_SAGA, GAME_CHAPTER, GAME_VERSION } from '../data/branding.js';
import { SYSTEMS } from '../data/systems.js';
import { SHIP_BY_ID } from '../data/ships.js';
import { levelFromXp } from './skills.js';

export const SLOT_COUNT = 15;
export const SAVE_VERSION = 2;

/** What a .os file is, and which shape of it this build writes. */
export const SAVE_FILE_FORMAT = 'oldspace.save';
export const SAVE_FILE_VERSION = 1;
export const SAVE_FILE_EXT = '.os';
const GAME_NAME = `${GAME_TITLE} — ${GAME_SAGA}: ${GAME_CHAPTER}`;

export function saveToSlot(slot, state) {
  try {
    const payload = {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      meta: {
        commander: state.commander,
        shipName: state.shipName,
        credits: state.credits,
        systemId: state.systemId,
        day: state.day,
        playtime: state.playtime,
      },
      state: state.toJSON(),
    };
    storageSet(`save.${slot}`, JSON.stringify(payload));
    return { ok: true };
  } catch (err) {
    console.error('[saves] write failed', err);
    return { ok: false, error: 'Could not write save (browser storage may be full).' };
  }
}

export function readSlot(slot) {
  try {
    const raw = storageGet(`save.${slot}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !data.state) return null;
    data.slot = slot; // remember where this came from so autosaves land back here
    return data;
  } catch (err) {
    console.warn('[saves] corrupt slot', slot, err);
    return null;
  }
}

export function slotInfo(slot) {
  const data = readSlot(slot);
  if (!data) return { slot, empty: true };
  const meta = data.meta || {};
  return {
    slot,
    empty: false,
    savedAt: data.savedAt,
    commander: meta.commander || 'Unknown',
    shipName: meta.shipName || '—',
    credits: meta.credits ?? 0,
    systemId: meta.systemId || 'haven',
    day: meta.day ?? 1,
    playtime: meta.playtime ?? 0,
    version: data.version,
    imported: data.imported || null,
  };
}

export function listSlots() {
  const out = [];
  for (let i = 1; i <= SLOT_COUNT; i++) out.push(slotInfo(i));
  return out;
}

export function deleteSlot(slot) {
  try {
    storageRemove(`save.${slot}`);
    return true;
  } catch (err) {
    console.error('[saves] delete failed', err);
    return false;
  }
}

/** Most recently saved slot, for "Continue". */
export function latestSlot() {
  let best = null;
  for (let i = 1; i <= SLOT_COUNT; i++) {
    const info = slotInfo(i);
    if (!info.empty && (!best || info.savedAt > best.savedAt)) best = info;
  }
  return best;
}

export function hasAnySave() {
  return latestSlot() !== null;
}

/* --------------------------------------------------------------------------
 * The .os file: one log, in a document that explains itself
 * -------------------------------------------------------------------------- */

/**
 * Everything worth knowing about a log, read out of the payload alone. This is
 * what a berth, a file name and an imported log are all described by, and it is
 * deliberately the product of fields the save has always carried — a build that
 * has moved on can still say who a file belongs to.
 */
export function describeSave(payload) {
  const state = (payload && payload.state) || {};
  const meta = (payload && payload.meta) || {};
  const shipId = state.shipId || meta.shipId || null;
  const systemId = state.systemId || meta.systemId || 'haven';
  const day = meta.day ?? state.day ?? 1;
  return {
    commander: meta.commander || state.commander || 'Unknown',
    shipName: meta.shipName || state.shipName || '—',
    shipId,
    shipClass: SHIP_BY_ID[shipId]?.cls || null,
    credits: meta.credits ?? state.credits ?? 0,
    day,
    playtime: meta.playtime ?? state.playtime ?? 0,
    systemId,
    systemName: SYSTEMS[systemId]?.name || systemId,
    level: levelFromXp(state.xp || 0),
    xp: state.xp || 0,
    skillPoints: state.skillPoints || 0,
    missionsDone: state.missionsDone ?? 0,
    missionsFailed: state.missionsFailed ?? 0,
    kills: state.stats?.kills ?? 0,
    deaths: state.stats?.deaths ?? 0,
    hull: state.integrity?.hull ?? null,
    shield: state.integrity?.shield ?? null,
    rep: { ...(state.rep || {}) },
    vector: { played: 0, wins: 0, ...(state.vector || {}) },
    saveVersion: (payload && payload.version) ?? null,
    savedAt: (payload && payload.savedAt) ?? null,
  };
}

/**
 * Wrap a stored slot payload as the .os document. It carries the game, the
 * build, the save layout, when it left and where from — plus the state itself,
 * untouched. Nothing here is derived from anything that changes between builds,
 * so a file written today reads the same way in a year.
 */
export function buildSaveDocument(payload, { slot = null, now = Date.now(), exportedAt = null } = {}) {
  const state = payload && payload.state;
  if (!state || typeof state !== 'object' || Array.isArray(state)) return null;
  return {
    format: SAVE_FILE_FORMAT,
    fileVersion: SAVE_FILE_VERSION,
    game: GAME_NAME,
    gameVersion: GAME_VERSION,
    saveVersion: payload.version ?? SAVE_VERSION,
    exportedAt: exportedAt || new Date(now).toISOString(),
    sourceSlot: slot ?? payload.slot ?? null,
    summary: describeSave(payload),
    meta: { ...(payload.meta || {}) },
    state,
  };
}

/** A file name that says what is inside it: who, how far in, and which build. */
export function saveFileName(doc) {
  const who = String(doc?.summary?.commander || 'commander')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'commander';
  const day = doc?.summary?.day ?? 1;
  const ver = doc?.gameVersion || GAME_VERSION;
  return `oldspace-${who}-day${day}-v${ver}${SAVE_FILE_EXT}`;
}

/** Read a berth and turn it into the text of a .os file. */
export function exportSlot(slot, opts = {}) {
  const payload = readSlot(slot);
  if (!payload) return { ok: false, error: `Berth #${slot} is empty.` };
  const doc = buildSaveDocument(payload, { slot, ...opts });
  if (!doc) return { ok: false, error: `Berth #${slot} has no log in it.` };
  return { ok: true, filename: saveFileName(doc), text: `${JSON.stringify(doc, null, 2)}\n`, doc };
}

/** Numeric compare of dotted version strings; >0 when `a` is newer than `b`. */
function compareVersions(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

/**
 * Read a .os file. Takes the document this build writes, the bare payload a slot
 * stores, or a bare state object, and says what it found rather than refusing on
 * sight: a file from a newer build is imported with a warning, since anything it
 * added is simply missing here and the defaults take over.
 */
export function parseSaveFile(text, { from = null } = {}) {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'That file is empty.' };
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not readable — it is not an Oldspace log.' };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'That file does not hold a log.' };
  }
  if (raw.format && raw.format !== SAVE_FILE_FORMAT) {
    return { ok: false, error: `That file is a "${raw.format}" file, not an Oldspace log.` };
  }

  const warnings = [];
  let doc = raw;
  // a bare state: a log written out by hand, or an older shape of export
  if (!doc.state) {
    if (raw.commander || raw.shipId || raw.systemId) {
      doc = { fileVersion: null, version: raw.version ?? null, meta: {}, state: raw };
    } else {
      return { ok: false, error: 'That file does not hold a log.' };
    }
  }
  if (!doc.state || typeof doc.state !== 'object' || Array.isArray(doc.state)) {
    return { ok: false, error: 'That file has no log in it.' };
  }
  if (!doc.state.commander && !doc.state.shipId) {
    warnings.push('That file has no commander in it — imported as-is, but it may not be a log.');
  }

  if (typeof doc.fileVersion === 'number' && doc.fileVersion > SAVE_FILE_VERSION) {
    warnings.push(`That file is export format ${doc.fileVersion}; this build writes ${SAVE_FILE_VERSION}.`);
  }
  if (doc.gameVersion && compareVersions(doc.gameVersion, GAME_VERSION) > 0) {
    warnings.push(`That log was flown on v${doc.gameVersion}; this build is v${GAME_VERSION}, so anything newer builds added will be missing.`);
  }
  const saveVersion = doc.saveVersion ?? doc.version ?? null;
  if (typeof saveVersion === 'number' && saveVersion > SAVE_VERSION) {
    warnings.push(`That log is save layout ${saveVersion}; this build knows ${SAVE_VERSION}.`);
  }

  const version = typeof saveVersion === 'number' ? saveVersion : SAVE_VERSION;
  const state = doc.state;
  // an old log that never stamped itself takes the version the file declares, so
  // the migrations in GameState.fromJSON still recognise it
  if (version !== SAVE_VERSION && state.version == null) state.version = version;

  const data = {
    version,
    savedAt: Date.parse(doc.exportedAt || '') || doc.savedAt || Date.now(),
    meta: { ...(doc.meta || {}) },
    state,
    exportedAt: doc.exportedAt || null,
    gameVersion: doc.gameVersion || null,
    sourceSlot: doc.sourceSlot ?? null,
    from: from || null,
  };
  return {
    ok: true,
    data,
    warnings,
    summary: describeSave({ version: doc.saveVersion ?? null, meta: data.meta, state }),
  };
}

/** Put a read log into a berth, keyed the way a slot of this build is keyed. */
export function importSlot(slot, data) {
  if (!data || !data.state || typeof data.state !== 'object') {
    return { ok: false, error: 'There is no log to place.' };
  }
  try {
    const s = describeSave({ version: data.version, meta: data.meta, state: data.state });
    storageSet(`save.${slot}`, JSON.stringify({
      version: SAVE_VERSION,
      savedAt: Date.now(),
      imported: { from: data.from || null, exportedAt: data.exportedAt || null, gameVersion: data.gameVersion || null },
      meta: {
        commander: s.commander,
        shipName: s.shipName,
        credits: s.credits,
        systemId: s.systemId,
        day: s.day,
        playtime: s.playtime,
      },
      state: data.state,
    }));
    return { ok: true };
  } catch (err) {
    console.error('[saves] import failed', err);
    return { ok: false, error: 'Could not write the log (browser storage may be full).' };
  }
}

/** First empty berth, or null when every berth is taken. */
export function firstEmptySlot() {
  for (let i = 1; i <= SLOT_COUNT; i++) if (slotInfo(i).empty) return i;
  return null;
}
