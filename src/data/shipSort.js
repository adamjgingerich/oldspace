// How a yard board is laid out. Kept out of the UI so the order it produces can
// be checked without a browser — a board sorted wrongly is a board that loses a
// sale, and it is not the kind of thing a pilot reports, they just leave.

/** Every way the slips can be read. `dir` is the order the label first gives. */
export const SHIP_SORTS = [
  { key: 'price', label: 'Price', dir: -1, value: (s) => s.price },
  { key: 'hull', label: 'Hull', dir: -1, value: (s) => s.hull },
  { key: 'shield', label: 'Shield', dir: -1, value: (s) => s.shield },
  { key: 'speed', label: 'Top speed', dir: -1, value: (s) => s.maxSpeed },
  { key: 'cargo', label: 'Hold', dir: -1, value: (s) => s.cargo },
  { key: 'mounts', label: 'Hardpoints', dir: -1, value: (s) => s.maxMounts ?? s.mounts ?? 0 },
  { key: 'bays', label: 'Bays', dir: -1, value: (s) => s.maxBays ?? s.bays ?? 0 },
  { key: 'name', label: 'Name', dir: 1, value: (s) => s.name },
];

export const DEFAULT_SORT = { key: 'price', dir: -1 };

/** The spec for a key, falling back to the default rather than throwing. */
export function shipSort(key) {
  return SHIP_SORTS.find((s) => s.key === key) || SHIP_SORTS[0];
}

/**
 * Sort a list of hulls by one of the keys above. Ties fall back to price (the
 * dearer hull first), so the same board always reads the same way.
 */
export function sortShips(list, sort = DEFAULT_SORT) {
  const spec = shipSort(sort?.key);
  const dir = sort?.dir < 0 ? -1 : 1;
  const rank = (ship) => {
    const v = spec.value(ship);
    return typeof v === 'string' ? v.toLowerCase() : v;
  };
  // the id breaks the last tie, so a board of identical hulls still reads the
  // same way every time it is opened
  const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return [...list].sort((a, b) => {
    const va = rank(a);
    const vb = rank(b);
    const d = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
    return (d || b.price - a.price || byId(a, b)) * dir;
  });
}

/** Flip or change the sort the way a click on the bar does. */
export function nextSort(current, key) {
  if (!SHIP_SORTS.some((s) => s.key === key)) return current || DEFAULT_SORT;
  if (current?.key === key) return { key, dir: -(current.dir || -1) };
  return { key, dir: shipSort(key).dir };
}
