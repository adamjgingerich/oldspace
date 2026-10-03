// Renderer + camera plumbing shared by the title backdrop and the game scene.

import * as THREE from 'three';

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x05070d, 1);
    this.width = 1;
    this.height = 1;
    this._resizeFns = [];
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  onResize(fn) {
    this._resizeFns.push(fn);
    fn(this.width, this.height);
  }

  resize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    for (const fn of this._resizeFns) {
      try {
        fn(w, h);
      } catch (err) {
        console.error('[engine] resize handler failed', err);
      }
    }
  }

  render(scene, camera) {
    this.renderer.render(scene, camera);
  }
}

/** A perspective camera that looks straight down at the ecliptic plane. */
export function makeTopDownCamera(aspect) {
  const cam = new THREE.PerspectiveCamera(55, aspect, 1, 20000);
  cam.up.set(0, 0, -1);
  cam.position.set(0, 300, 0);
  cam.lookAt(0, 0, 0);
  return cam;
}
