// Small math & formatting helpers shared across the game.

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const TAU = Math.PI * 2;

/** Wrap angle into (-PI, PI]. */
export function wrapAngle(a) {
  a = (a + Math.PI) % TAU;
  if (a <= 0) a += TAU;
  return a - Math.PI;
}

/** Shortest signed difference from a to b. */
export const angleDiff = (a, b) => wrapAngle(b - a);

/** Move angle a toward b by at most step. */
export function dist2(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

export function distSq2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

export function fmtNum(n) {
  return Math.round(n).toLocaleString('en-US');
}

export function fmtCredits(n) {
  return `₡${fmtNum(n)}`;
}

/** seconds -> "3h 12m" / "12m 05s" */
export function fmtPlaytime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function fmtDate(ms) {
  try {
    const d = new Date(ms);
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export const pick = (arr, rnd = Math.random) => arr[Math.floor(rnd() * arr.length) % arr.length];

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/** Deterministic 2D-ish hash of strings -> uint32 */
export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function formatDeadline(day, currentDay) {
  const left = day - currentDay;
  if (left < 0) return 'overdue';
  if (left === 0) return 'due today';
  return `${left} day${left === 1 ? '' : 's'} left`;
}
