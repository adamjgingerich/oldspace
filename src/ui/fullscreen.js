// Fullscreen toggle: a corner button plus a hotkey (F).

import { el } from './dom.js';

const EXPAND_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>`;

const COLLAPSE_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>`;

export function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

/**
 * Toggle fullscreen. Resolves to { ok } or { ok: false, blocked: true } so
 * callers can explain when the browser or embedded view refuses the request.
 */
export function toggleFullscreen() {
  const rootEl = document.documentElement;
  if (isFullscreen()) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    try {
      const p = exit?.call(document);
      if (p && typeof p.then === 'function') {
        return p.then(() => ({ ok: true })).catch(() => ({ ok: false, blocked: true }));
      }
      return Promise.resolve({ ok: true });
    } catch (err) {
      console.warn('[fullscreen] exit failed', err);
      return Promise.resolve({ ok: false, blocked: true });
    }
  }
  const req = rootEl.requestFullscreen || rootEl.webkitRequestFullscreen;
  if (!req) return Promise.resolve({ ok: false, blocked: true, reason: 'unsupported' });
  try {
    const p = req.call(rootEl);
    if (p && typeof p.then === 'function') {
      return p.then(() => ({ ok: true })).catch((err) => {
        console.warn('[fullscreen] request blocked', err);
        return { ok: false, blocked: true, reason: String((err && err.name) || err) };
      });
    }
    return Promise.resolve({ ok: true });
  } catch (err) {
    console.warn('[fullscreen] request failed', err);
    return Promise.resolve({ ok: false, blocked: true, reason: String((err && err.name) || err) });
  }
}

export function installFullscreenButton(root, { onBlocked } = {}) {
  const button = el('button', {
    class: 'fs-btn',
    type: 'button',
    title: 'Fullscreen (F)',
    'aria-label': 'Toggle fullscreen',
    html: EXPAND_ICON,
  });

  const sync = () => {
    const on = isFullscreen();
    button.innerHTML = on ? COLLAPSE_ICON : EXPAND_ICON;
    button.classList.toggle('on', on);
    button.title = on ? 'Exit fullscreen (F)' : 'Fullscreen (F)';
  };

  button.addEventListener('click', () => {
    toggleFullscreen().then((res) => {
      if (res && !res.ok && res.blocked) {
        button.classList.add('denied');
        window.setTimeout(() => button.classList.remove('denied'), 800);
        onBlocked?.(res);
      }
      // the change event may not fire in every embedder; sync defensively
      window.setTimeout(sync, 120);
    });
  });
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  root.append(button);
  sync();
  return button;
}
