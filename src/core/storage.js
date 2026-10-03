// Browser storage with a bridge for renamed keys.
//
// Save slots and preferences live under "oldspace.*". Older builds stored them
// under a different prefix; reads fall back to it once so existing saves and
// settings survive the rename, and the next write moves them to the new name.

const PREFIX = 'oldspace.';
const LEGACY_PREFIX = 'thewinds.'; // pre-rename key prefix — migration shim only

/** Read a stored value by its short name (e.g. 'save.3', 'audio'). */
export function storageGet(name) {
  try {
    const value = localStorage.getItem(PREFIX + name);
    if (value != null) return value;
    return localStorage.getItem(LEGACY_PREFIX + name);
  } catch {
    return null;
  }
}

/** Write a stored value by its short name, clearing any legacy copy. */
export function storageSet(name, value) {
  try {
    localStorage.setItem(PREFIX + name, value);
    localStorage.removeItem(LEGACY_PREFIX + name);
  } catch {
    /* storage full or blocked — the value stays for this session */
  }
}

/** Remove a stored value under both the current and legacy names. */
export function storageRemove(name) {
  try {
    localStorage.removeItem(PREFIX + name);
    localStorage.removeItem(LEGACY_PREFIX + name);
  } catch {
    /* ignore */
  }
}
