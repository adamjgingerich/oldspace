// Key bindings: defaults, player overrides, and pretty labels.
//
// Bindings are stored per browser under 'thewinds.keys' and read everywhere
// through `binds.get(actionId)`. Rebinding swaps with any action that already
// held the key, so no action is ever left unreachable.

const STORE_KEY = 'thewinds.keys';

export const BIND_ACTIONS = [
  { id: 'thrust', label: 'Main drive', code: 'KeyW' },
  { id: 'brake', label: 'Retro / reverse', code: 'KeyS' },
  { id: 'turnLeft', label: 'Turn left', code: 'KeyA' },
  { id: 'turnRight', label: 'Turn right', code: 'KeyD' },
  { id: 'fire', label: 'Primary weapon', code: 'Space' },
  { id: 'fireAlt', label: 'Secondary / missiles', code: 'KeyQ' },
  { id: 'burst', label: 'Engine burst (hold)', code: 'ShiftLeft' },
  { id: 'target', label: 'Cycle hostile target', code: 'Tab' },
  { id: 'dock', label: 'Dock / scan', code: 'KeyE' },
  { id: 'claim', label: 'Claim prize', code: 'KeyC' },
  { id: 'jump', label: 'Ship’s computer', code: 'KeyJ' },
  { id: 'chart', label: 'Ship’s computer', code: 'KeyM' },
  { id: 'skills', label: 'Skill tree', code: 'KeyK' },
  { id: 'pause', label: 'Pause / back', code: 'Escape' },
  { id: 'scramble', label: 'Scramble small craft', code: 'KeyG' },
  { id: 'recall', label: 'Recall small craft', code: 'KeyH' },
  { id: 'focusFire', label: 'Fleet: focus fire', code: 'KeyB' },
  { id: 'regroup', label: 'Fleet: regroup', code: 'KeyN' },
  { id: 'zoomIn', label: 'Zoom in', code: 'Equal' },
  { id: 'zoomOut', label: 'Zoom out', code: 'Minus' },
  { id: 'speedUp', label: 'Simulation faster', code: 'KeyX' },
  { id: 'speedDown', label: 'Simulation slower', code: 'KeyZ' },
  { id: 'fullscreen', label: 'Fullscreen', code: 'KeyF' },
  { id: 'mute', label: 'Mute', code: 'KeyV' },
];

const LABELS = {
  Space: 'Space', Tab: 'Tab', Escape: 'Esc', Enter: 'Enter',
  Backquote: '`', Minus: '−', Equal: '=', BracketLeft: '[', BracketRight: ']',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
  ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl',
  AltLeft: 'Alt', AltRight: 'Alt', CapsLock: 'Caps', Backspace: '⌫', Delete: 'Del',
};

/** Human-readable key label ('KeyW' → 'W', 'ArrowLeft' → '←'). */
export function codeLabel(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return LABELS[code] || code;
}

class Keybinds {
  constructor() {
    this.map = {};
    for (const a of BIND_ACTIONS) this.map[a.id] = a.code;
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        for (const [id, code] of Object.entries(saved)) {
          if (id in this.map && typeof code === 'string' && code) this.map[id] = code;
        }
      }
    } catch (err) {
      /* first run or blocked storage */
    }
  }

  get(id) {
    return this.map[id] || null;
  }

  /** Rebind; whoever held the key takes over the old one (a fair swap). */
  set(id, code) {
    if (!(id in this.map) || !code) return;
    const prev = this.map[id];
    for (const other of Object.keys(this.map)) {
      if (other !== id && this.map[other] === code) this.map[other] = prev;
    }
    this.map[id] = code;
    this.save();
  }

  reset(id) {
    const def = BIND_ACTIONS.find((a) => a.id === id);
    if (def) {
      this.map[id] = def.code;
      this.save();
    }
  }

  resetAll() {
    for (const a of BIND_ACTIONS) this.map[a.id] = a.code;
    this.save();
  }

  /** Is any action bound to this key code? (used to suppress browser defaults) */
  isBound(code) {
    for (const v of Object.values(this.map)) {
      if (v === code) return true;
    }
    return false;
  }

  save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.map));
    } catch (err) {
      /* storage full or blocked — bindings stay for this session */
    }
  }
}

export const binds = new Keybinds();
