// Seeded RNG so systems, prices and missions stay stable between visits & saves.

import { hashString } from './util.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seedStr) {
    this.seedStr = String(seedStr);
    this.rand = mulberry32(hashString(this.seedStr));
  }
  float(min = 0, max = 1) {
    return min + (max - min) * this.rand();
  }
  int(min, max) {
    return Math.floor(this.float(min, max + 1));
  }
  chance(p) {
    return this.rand() < p;
  }
  pick(arr) {
    return arr[Math.floor(this.rand() * arr.length) % arr.length];
  }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

/** Build an RNG from any number of parts, e.g. rngOf(seed, 'price', sysId, cmdId, day). */
export function rngOf(...parts) {
  return new RNG(parts.join('|'));
}
