// Key-bindings UI: a small corner button that opens the rebind menu.

import { el, clear, btn } from './dom.js';
import { input } from '../core/input.js';
import { binds, BIND_ACTIONS, codeLabel } from '../core/keybinds.js';

const KEYS_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="2.5" y="6" width="19" height="12" rx="1.5"/>
  <path d="M6.5 10h.01M10.5 10h.01M14.5 10h.01M18 10h.01M7 14h10"/></svg>`;

let overlayRoot = null;
let openWrap = null;
let buttonEl = null;

function closeKeybinds(prevEnabled) {
  openWrap?.remove();
  openWrap = null;
  input.enabled = prevEnabled;
  buttonEl?.classList.remove('on');
}

/** Open (or focus) the key-bindings modal. Safe to call from anywhere. */
export function openKeybinds() {
  if (openWrap) return;
  const host = overlayRoot || document.getElementById('app') || document.body;
  const prevEnabled = input.enabled;
  input.enabled = false; // suspend flight controls while rebinding
  buttonEl?.classList.add('on');

  let capturing = false;

  const list = el('div', { class: 'bind-grid' });
  const render = () => {
    clear(list);
    for (const action of BIND_ACTIONS) {
      const chip = el('button', {
        class: 'bind-key',
        type: 'button',
        text: codeLabel(binds.get(action.id)),
        title: 'Click, then press a new key',
      });
      chip.addEventListener('click', () => startCapture(chip, action.id));
      list.append(el('div', { class: 'bind-row' }, [
        el('span', { text: action.label }),
        chip,
      ]));
    }
  };

  const startCapture = (chip, actionId) => {
    if (capturing) return;
    capturing = true;
    chip.classList.add('capturing');
    chip.textContent = 'press a key…';
    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.removeEventListener('keydown', handler, true);
      capturing = false;
      if (e.code !== 'Escape') binds.set(actionId, e.code); // Escape cancels
      render();
    };
    window.addEventListener('keydown', handler, true);
  };

  const onEscape = (e) => {
    if (e.code !== 'Escape' || capturing) return;
    e.preventDefault();
    e.stopPropagation();
    close();
  };
  window.addEventListener('keydown', onEscape, true);

  const close = () => {
    window.removeEventListener('keydown', onEscape, true);
    closeKeybinds(prevEnabled);
  };

  render();
  openWrap = el('div', { class: 'overlay' }, [
    el('div', { class: 'panel modal wide' }, [
      el('h2', { text: 'Key bindings' }),
      el('p', {
        class: 'note',
        text: 'Click a key, then press the one you want — Escape cancels. Arrow keys always duplicate steering, and changes are saved to this browser.',
      }),
      list,
      el('div', { class: 'modal-actions' }, [
        btn('Reset all', () => {
          binds.resetAll();
          render();
        }, 'btn ghost'),
        btn('Close', close, 'btn primary'),
      ]),
    ]),
  ]);
  host.append(openWrap);
}

/** Small corner button (top-right cluster). */
export function installKeybindButton(appRoot, overlays) {
  overlayRoot = overlays || overlayRoot;
  const button = el('button', {
    class: 'keys-btn',
    type: 'button',
    title: 'Key bindings',
    'aria-label': 'Key bindings',
    html: KEYS_ICON,
  });
  button.addEventListener('click', () => {
    if (openWrap) {
      // clicking the button again closes it
      const esc = new KeyboardEvent('keydown', { code: 'Escape' });
      window.dispatchEvent(esc);
      return;
    }
    openKeybinds();
  });
  appRoot.append(button);
  buttonEl = button;
  return button;
}
