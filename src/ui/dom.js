// Tiny DOM helpers.

export const $ = (sel, root = document) => root.querySelector(sel);

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function btn(label, onClick, cls = 'btn') {
  return el('button', { class: cls, onclick: onClick }, [label]);
}

const WARP_QUIPS = [
  '· vworp ·',
  'Space folds politely.',
  'Please keep your tentacles inside the vessel.',
  'Reality is on a short break.',
  'Folding space, not laundry.',
  'Somewhere, a physicist sighs.',
  'The lanes approve of this manoeuvre.',
  'Hold my lumen.',
  'Not that kind of warp. The fast one.',
  'Your atoms called. They want a raise.',
];

let warpEl = null;
export function flashWarp() {
  if (!warpEl) {
    warpEl = el('div', { id: 'warp' }, [
      el('div', { class: 'warp-streaks' }),
      el('div', { class: 'warp-quip' }),
    ]);
    document.getElementById('app')?.append(warpEl);
  }
  warpEl.querySelector('.warp-quip').textContent = WARP_QUIPS[Math.floor(Math.random() * WARP_QUIPS.length)];
  warpEl.classList.remove('on');
  void warpEl.offsetWidth; // restart the animation on repeat jumps
  warpEl.classList.add('on');
  window.setTimeout(() => warpEl.classList.remove('on'), 1400);
}
