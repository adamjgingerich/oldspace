// Keyboard + mouse input. Tracks both held state and per-frame "pressed" edges.

import { binds } from './keybinds.js';

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyF', 'KeyQ', 'KeyJ', 'KeyM', 'KeyV', 'KeyX', 'KeyZ',
  'Space', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'ShiftLeft', 'ShiftRight',
]);

export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.releasedSet = new Set();
    this.mouse = { x: 0, y: 0, down: false, pressed: false };
    this.zoomDelta = 0;
    this.enabled = true;
    this._bound = false;
    this._pinchDist = 0;
  }

  attach(target = window) {
    if (this._bound) return;
    this._bound = true;
    this._onKeyDown = (e) => {
      if (!this.enabled) return;
      // text fields get every key — hotkeys must never swallow typing
      const t = e.target;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable === true);
      if (typing) return;
      if (GAME_KEYS.has(e.code) || binds.isBound(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed.add(e.code);
    };
    this._onKeyUp = (e) => {
      this.down.delete(e.code);
      this.releasedSet.add(e.code);
    };
    this._onBlur = () => {
      this.down.clear();
      this.pressed.clear();
    };
    this._onMouseMove = (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    };
    this._onMouseDown = (e) => {
      if (e.button === 0) {
        this.mouse.down = true;
        this.mouse.pressed = true;
      }
    };
    this._onMouseUp = (e) => {
      if (e.button === 0) this.mouse.down = false;
    };
    target.addEventListener('keydown', this._onKeyDown, { passive: false });
    target.addEventListener('keyup', this._onKeyUp);
    target.addEventListener('blur', this._onBlur);
    target.addEventListener('mousemove', this._onMouseMove);
    target.addEventListener('mousedown', this._onMouseDown);
    target.addEventListener('mouseup', this._onMouseUp);
  }

  isDown(code) {
    return this.down.has(code);
  }

  /**
   * View-zoom gestures: two-finger touchpad scroll, trackpad pinch
   * (delivered as ctrl+wheel) and touchscreen pinch.
   */
  attachZoomGestures(el) {
    if (!el) return;
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const k = e.ctrlKey ? 0.016 : 0.0028; // pinch arrives as ctrl+wheel
      const dy = Math.max(-260, Math.min(260, e.deltaY));
      this.zoomDelta += dy * k;
    }, { passive: false });

    el.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) this._pinchDist = this._touchDist(e);
    }, { passive: true });
    el.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && this._pinchDist > 0) {
        const d = this._touchDist(e);
        this.zoomDelta += (this._pinchDist - d) * 0.007; // spread = zoom in
        this._pinchDist = d;
      }
    }, { passive: true });
    const endPinch = () => {
      this._pinchDist = 0;
    };
    el.addEventListener('touchend', endPinch);
    el.addEventListener('touchcancel', endPinch);
  }

  _touchDist(e) {
    const [a, b] = e.touches;
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  /** Read and clear the accumulated zoom gesture delta. */
  consumeZoom() {
    const v = this.zoomDelta;
    this.zoomDelta = 0;
    return v;
  }
  wasPressed(code) {
    return this.pressed.has(code);
  }
  /** Call at the end of every frame. */
  endFrame() {
    this.pressed.clear();
    this.releasedSet.clear();
    this.mouse.pressed = false;
    this.zoomDelta = 0;
  }
  /** Clear everything (used when pausing / changing screens). */
  reset() {
    this.down.clear();
    this.pressed.clear();
    this.releasedSet.clear();
    this.mouse.down = false;
    this.mouse.pressed = false;
    this.zoomDelta = 0;
    this._pinchDist = 0;
  }

  axis(negA, posA) {
    let v = 0;
    if (this.isDown(negA)) v -= 1;
    if (this.isDown(posA)) v += 1;
    return v;
  }
}

export const input = new Input();
