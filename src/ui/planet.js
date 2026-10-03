// Planet dossier overlay: opened by scanning a world from your ship.

import { el, btn } from './dom.js';
import { formatPopulation } from '../game/planetSurvey.js';

export class PlanetUI {
  constructor(root) {
    this.root = root;
    this.wrap = null;
  }

  open({ planet, info, known, first, onClose }) {
    this.close();
    const kv = (k, v) => el('div', { class: 'kv' }, [el('span', { text: k }), el('b', { text: v })]);

    const status = first
      ? el('span', { class: 'chip on', text: `new survey · +₡${info.reward.toLocaleString()}` })
      : el('span', { class: 'chip', text: `surveyed day ${known.day}` });

    this.wrap = el('div', { class: 'overlay' }, [
      el('div', { class: 'panel modal', style: 'width:540px' }, [
        el('div', { style: 'display:flex;align-items:center;gap:12px' }, [
          el('h2', { text: planet.name }),
          status,
        ]),
        el('p', { class: 'note', style: 'margin-top:2px', text: `${info.typeLabel} · ${info.radiusKm.toLocaleString()} km across` }),
        el('div', { style: 'margin-top:12px' }, [
          kv('Gravity', `${info.gravity} g`),
          kv('Atmosphere', info.atmosphere),
          kv('Population', formatPopulation(info.population)),
          kv('Resources', info.resources.join(' · ')),
        ]),
        el('p', { class: 'note', style: 'margin-top:12px;font-style:italic', text: `“${info.flavor}”` }),
        el('div', { class: 'modal-actions' }, [
          btn('Close', () => onClose(), 'btn primary'),
        ]),
      ]),
    ]);
    this.root.append(this.wrap);
  }

  close() {
    this.wrap?.remove();
    this.wrap = null;
  }
}
