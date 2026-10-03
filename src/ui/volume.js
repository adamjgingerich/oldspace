// Volume control: corner speaker button with a small slide-out mixer.
// Click the speaker to open the popover; the state persists between sessions.

import { el } from './dom.js';
import { audio } from '../core/audio.js';

const ICON_FULL = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 6a9 9 0 0 1 0 12"/></svg>`;

const ICON_LOW = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>`;

const ICON_MUTED = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M11 5 6 9H3v6h3l5 4z"/><line x1="16" y1="9" x2="22" y2="15"/><line x1="22" y1="9" x2="16" y2="15"/></svg>`;

export function installVolumeControl(root) {
  const slider = el('input', {
    type: 'range', min: '0', max: '100', step: '1', class: 'vol-slider', 'aria-label': 'Master volume',
  });
  const pct = el('span', { class: 'vol-pct', text: '45%' });
  const muteBtn = el('button', { class: 'vol-mute', type: 'button', 'aria-label': 'Mute', html: ICON_FULL });
  const pop = el('div', { class: 'vol-pop' }, [
    el('div', { class: 'vol-row' }, [muteBtn, slider, pct]),
  ]);
  const btn = el('button', {
    class: 'vol-btn', type: 'button', title: 'Volume (V mutes)', 'aria-label': 'Volume controls', html: ICON_FULL,
  });
  const wrap = el('div', { class: 'vol-wrap' }, [btn, pop]);

  const sync = () => {
    const v = Math.round(audio.getVolume() * 100);
    slider.value = String(v);
    pct.textContent = `${v}%`;
    const icon = audio.muted ? ICON_MUTED : (v < 40 ? ICON_LOW : ICON_FULL);
    btn.innerHTML = icon;
    muteBtn.innerHTML = audio.muted ? ICON_MUTED : ICON_FULL;
    muteBtn.title = audio.muted ? 'Unmute' : 'Mute';
    muteBtn.setAttribute('aria-pressed', String(audio.muted));
    btn.classList.toggle('muted', audio.muted);
    btn.title = audio.muted ? 'Muted — click for volume (V unmutes)' : 'Volume (V mutes)';
  };

  btn.addEventListener('click', () => {
    audio.ensure();
    wrap.classList.toggle('open');
    sync();
  });
  slider.addEventListener('input', () => {
    audio.ensure();
    audio.setVolume(Number(slider.value) / 100);
  });
  muteBtn.addEventListener('click', () => {
    audio.ensure();
    audio.toggleMuted();
  });
  document.addEventListener('pointerdown', (e) => {
    if (!wrap.contains(e.target)) wrap.classList.remove('open');
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') wrap.classList.remove('open');
  });

  audio.onChange = sync;
  root.append(wrap);
  sync();
  return wrap;
}
