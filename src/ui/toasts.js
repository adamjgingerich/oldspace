// Transient messages, bottom-left of the HUD.

import { el } from './dom.js';

export class Toasts {
  constructor(root) {
    this.root = root;
    this.items = [];
  }

  push(text, kind = '') {
    const node = el('div', { class: `toast ${kind}` }, [text]);
    const item = {
      node,
      t: 0,
      dimmed: false,
      life: 4.2 + Math.min(6, String(text).length * 0.03),
    };
    // the mouse can rest on a popup to read it back at full strength
    node.addEventListener('mouseenter', () => node.classList.remove('dim'));
    node.addEventListener('mouseleave', () => {
      if (item.dimmed) node.classList.add('dim');
    });
    this.root.append(node);
    this.items.push(item);
    while (this.items.length > 7) this._remove(0);
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      // after two seconds an unread popup goes quiet — unless it is hovered
      if (!it.dimmed && it.t >= 2) {
        it.dimmed = true;
        if (!it.node.matches(':hover')) it.node.classList.add('dim');
      }
      if (it.t > it.life) {
        it.node.classList.add('fading');
        if (it.t > it.life + 0.5) this._remove(i);
      }
    }
  }

  _remove(i) {
    const it = this.items[i];
    if (!it) return;
    it.node.remove();
    this.items.splice(i, 1);
  }

  clear() {
    for (const it of this.items) it.node.remove();
    this.items.length = 0;
  }
}
