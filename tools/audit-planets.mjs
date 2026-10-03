// Temporary one-off check: planet data integrity.
import { SYSTEMS } from '../src/data/systems.js';

const VISUAL = new Set(['terran', 'ocean', 'jungle', 'ice', 'rocky', 'moon', 'gas', 'molten', 'desert', 'dusty', 'crystal', 'toxic']);
const names = new Map();
const counts = {};
let bad = 0;

for (const sys of Object.values(SYSTEMS)) {
  const pnames = new Set(sys.planets.map((p) => p.name));
  for (const st of sys.stations || []) {
    if (st.parent && !pnames.has(st.parent)) {
      console.log('BAD parent:', sys.id, st.id, '->', st.parent);
      bad++;
    }
  }
  for (const p of sys.planets) {
    if (!VISUAL.has(p.type)) {
      console.log('BAD visual type:', sys.id, p.name, p.type);
      bad++;
    }
    counts[p.type] = (counts[p.type] || 0) + 1;
    if (names.has(p.name)) {
      console.log('DUP name:', p.name, 'in', names.get(p.name), 'and', sys.id);
      bad++;
    } else {
      names.set(p.name, sys.id);
    }
  }
}

console.log('systems:', Object.keys(SYSTEMS).length, 'bodies:', names.size, 'bad:', bad);
console.log('type counts:', JSON.stringify(counts));
