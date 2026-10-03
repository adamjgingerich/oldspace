// Simulation speed control: a corner button cycling ×0.5 → ×1 → ×2 → ×3 → ×4.
// Left-click speeds up, right-click slows down; the choice persists.

import { el } from './dom.js';

export function installSpeedControl(root, game) {
  const button = el('button', {
    class: 'speed-btn',
    type: 'button',
    text: '×0.5',
    title: 'Simulation speed — click for faster, right-click for slower (X / Z)',
    'aria-label': 'Simulation speed',
  });

  const sync = () => {
    const v = game.timeScale;
    button.textContent = `×${v}`;
    button.classList.toggle('fast', v > 1);
    button.classList.toggle('slow', v < 1);
    button.title = `Simulation speed ×${v} — click for faster, right-click for slower (X / Z)`;
  };

  button.addEventListener('click', () => game.cycleTimeScale(1));
  button.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    game.cycleTimeScale(-1);
  });

  root.append(button);
  sync();
  return { sync, button };
}
