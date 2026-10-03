// Tiny synthesized audio engine (no assets): lasers, booms and engine hum.

import { storageGet, storageSet } from './storage.js';

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.volume = 0.45;
    this.onChange = null; // set by the volume UI
    this._engine = null;
  }

  _loadPrefs() {
    try {
      const raw = storageGet('audio');
      if (!raw) return;
      const prefs = JSON.parse(raw);
      if (typeof prefs.volume === 'number') this.volume = Math.max(0, Math.min(1, prefs.volume));
      if (typeof prefs.muted === 'boolean') this.muted = prefs.muted;
    } catch (err) {
      /* first run / private mode */
    }
  }

  _savePrefs() {
    storageSet('audio', JSON.stringify({ volume: this.volume, muted: this.muted }));
  }

  _applyGain() {
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }

  /** Must be called from a user gesture at least once. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      this._loadPrefs();
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this._applyGain();
      this._buildLoops();
      return true;
    } catch (err) {
      console.warn('[audio] unavailable', err);
      return false;
    }
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, Number(v) || 0));
    this._applyGain();
    this._savePrefs();
    this.onChange?.();
  }

  getVolume() {
    return this.volume;
  }

  setMuted(m) {
    this.muted = !!m;
    this._applyGain();
    this._savePrefs();
    this.onChange?.();
  }

  toggleMuted() {
    this.setMuted(!this.muted);
  }

  _noiseBuffer(seconds = 2) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    return buf;
  }

  _buildLoops() {
    // engine rumble
    const eng = this.ctx.createBufferSource();
    eng.buffer = this._noiseBuffer(2);
    eng.loop = true;
    const engFilter = this.ctx.createBiquadFilter();
    engFilter.type = 'lowpass';
    engFilter.frequency.value = 180;
    const engGain = this.ctx.createGain();
    engGain.gain.value = 0;
    eng.connect(engFilter).connect(engGain).connect(this.master);
    eng.start();
    this._engine = { gain: engGain, filter: engFilter };
  }

  /** level 0..1 while flying; call every frame (cheap). */
  setEngine(level) {
    if (!this._engine) return;
    const t = this.ctx.currentTime;
    this._engine.gain.gain.setTargetAtTime(level * 0.28, t, 0.08);
    this._engine.filter.frequency.setTargetAtTime(140 + level * 320, t, 0.1);
  }

  _blip({ freq = 440, dur = 0.12, type = 'sine', vol = 0.25, slide = 0, delay = 0 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _burst({ dur = 0.5, vol = 0.5, freq = 300, type = 'lowpass' } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(Math.max(0.4, dur));
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    f.frequency.exponentialRampToValueAtTime(60, t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  laser(heavy = false, vol = 1) {
    const base = heavy ? 220 : 900;
    this._blip({
      freq: Math.round(base * (0.94 + Math.random() * 0.12)),
      slide: heavy ? -140 : -620,
      dur: heavy ? 0.22 : 0.1,
      type: heavy ? 'sawtooth' : 'square',
      vol: (heavy ? 0.13 : 0.07) * vol,
    });
  }
  kinetic(vol = 1) {
    this._blip({ freq: 160 + Math.random() * 24, slide: -90, dur: 0.09, type: 'triangle', vol: 0.11 * vol });
  }
  missile(vol = 1) {
    this._blip({ freq: 300, slide: 260, dur: 0.4, type: 'sawtooth', vol: 0.09 * vol });
  }
  boom(size = 1) {
    this._burst({ dur: 0.55 * size, vol: Math.min(0.6, 0.3 * size), freq: 400 / size });
  }
  hit(vol = 1) {
    this._blip({ freq: 140, slide: -60, dur: 0.12, type: 'square', vol: 0.12 * vol });
  }
  shieldHit(vol = 1) {
    this._blip({ freq: 700, slide: -320, dur: 0.12, type: 'sine', vol: 0.09 * vol });
  }
  dock() {
    this._blip({ freq: 520, dur: 0.16, type: 'sine', vol: 0.2 });
    this._blip({ freq: 780, dur: 0.22, type: 'sine', vol: 0.18, delay: 0.12 });
  }
  undock() {
    this._blip({ freq: 320, slide: 160, dur: 0.3, type: 'sine', vol: 0.18 });
  }
  ui() {
    this._blip({ freq: 1200, dur: 0.045, type: 'sine', vol: 0.05 });
  }
  coin() {
    this._blip({ freq: 1400, dur: 0.07, type: 'square', vol: 0.055 });
    this._blip({ freq: 1900, dur: 0.1, type: 'square', vol: 0.048, delay: 0.06 });
  }
  warp() {
    this._blip({ freq: 120, slide: 900, dur: 1.1, type: 'sawtooth', vol: 0.14 });
    this._burst({ dur: 1.2, vol: 0.25, freq: 900, type: 'bandpass' });
  }
  alarm() {
    this._blip({ freq: 880, dur: 0.18, type: 'square', vol: 0.12 });
    this._blip({ freq: 660, dur: 0.2, type: 'square', vol: 0.12, delay: 0.2 });
  }
}

export const audio = new AudioSys();
