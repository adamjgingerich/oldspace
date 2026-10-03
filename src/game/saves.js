// Persistence: 15 adventure slots in localStorage, each a full self-contained save.

export const SLOT_COUNT = 15;
export const SAVE_VERSION = 2;
const PREFIX = 'thewinds.save.';

const keyFor = (slot) => `${PREFIX}${slot}`;

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
    localStorage.setItem(keyFor(slot), JSON.stringify(payload));
    return { ok: true };
  } catch (err) {
    console.error('[saves] write failed', err);
    return { ok: false, error: 'Could not write save (browser storage may be full).' };
  }
}

export function readSlot(slot) {
  try {
    const raw = localStorage.getItem(keyFor(slot));
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
  };
}

export function listSlots() {
  const out = [];
  for (let i = 1; i <= SLOT_COUNT; i++) out.push(slotInfo(i));
  return out;
}

export function deleteSlot(slot) {
  try {
    localStorage.removeItem(keyFor(slot));
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
