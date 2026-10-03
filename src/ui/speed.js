// Simulation speed control: ×0.5 → ×1 → ×2 → ×3 → ×4 in the corner tray.
//
// The value button keeps the old muscle memory (left-click faster, right-click
// slower), and the flanking − / + buttons make slowing down obvious. The ⟲
// button — or a middle-click, or a scroll — drops straight back to the ship's
// deliberate cruising ×0.5. Keys: ] faster, [ slower, \ reset.

import { el } from './dom.js';

export function installSpeedControl(root, game) {
  const hint = 'Simulation speed — [ slower · ] faster · \\ back to ×0.5 (or click, right-click, scroll)';

  const value = el('button', {
    class: 'speed-btn',
    type: 'button',
    text: '×0.5',
    title: hint,
    'aria-label': 'Simulation speed',
  });
  const slower = el('button', { class: 'spd-step', type: 'button', text: '−', title: 'Slower ( [ )', 'aria-label': 'Slower' });
  const faster = el('button', { class: 'spd-step', type: 'button', text: '+', title: 'Faster ( ] )', 'aria-label': 'Faster' });
  const reset = el('button', { class: 'spd-reset', type: 'button', text: '⟲', title: 'Back to ×0.5 ( \\ )', 'aria-label': 'Reset speed' });

  const sync = () => {
    const v = game.timeScale;
    value.textContent = `×${v}`;
    value.classList.toggle('fast', v > 1);
    value.classList.toggle('slow', v < 1);
    value.title = `Simulation speed ×${v} — ${hint}`;
  };

  value.addEventListener('click', () => game.cycleTimeScale(1));
  value.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    game.cycleTimeScale(-1);
  });
  value.addEventListener('auxclick', (e) => {
    if (e.button === 1) {
      e.preventDefault();
      game.resetTimeScale();
    }
  });
  value.addEventListener('wheel', (e) => {
    e.preventDefault();
    game.cycleTimeScale(e.deltaY < 0 ? 1 : -1);
  }, { passive: false });

  slower.addEventListener('click', () => game.cycleTimeScale(-1));
  faster.addEventListener('click', () => game.cycleTimeScale(1));
  reset.addEventListener('click', () => game.resetTimeScale());

  const wrap = el('div', { class: 'speed-ctl' }, [slower, value, faster, reset]);
  root.append(wrap);
  sync();
  return { sync, button: value, wrap };
}
