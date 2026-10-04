// The material kit — what makes a hull or a station read clean and bright.
//
// Two pieces, both small on purpose:
//
//   1. A fresnel rim light injected into any standard/physical material. Three's
//      PBR shading goes flat and grey on a hull in open space; a rim term puts a
//      bright edge along every silhouette, which is what makes a ship look lit
//      and machined rather than muddy.
//   2. A tiny procedural environment map. Metals need something to reflect —
//      without it `metalness` just darkens a surface. This builds a 32×32
//      equirectangular gradient in code (no assets), runs it through PMREM, and
//      hands the result to `scene.environment`.
//
// Both are cached: one env map for the whole game, one compiled program per
// rim configuration.

import * as THREE from 'three';

const RIM_PARS = `
uniform vec3 uRimColor;
uniform float uRimPower;
uniform float uRimStrength;
uniform float uRimLift;
`;

const RIM_BODY = `
  {
    vec3 rimN = normalize( normal );
    vec3 rimV = normalize( vViewPosition );
    float rimF = 1.0 - clamp( dot( rimN, rimV ), 0.0, 1.0 );
    float rim = pow( rimF, uRimPower );
    gl_FragColor.rgb += uRimColor * rim * uRimStrength;
    gl_FragColor.rgb += uRimColor * uRimLift * rimF;
  }
`;

/**
 * Give a material a bright fresnel edge and a touch of clean-coat lift.
 * Safe to call on any MeshStandardMaterial or MeshPhysicalMaterial; other
 * material types are returned untouched.
 */
export function withRim(material, opts = {}) {
  const {
    color = 0x9fe8ff,
    power = 2.6,
    strength = 0.42,
    lift = 0.05,
  } = opts;
  if (!material || !(material.isMeshStandardMaterial || material.isMeshPhysicalMaterial)) return material;

  const rimColor = new THREE.Color(color);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = { value: rimColor };
    shader.uniforms.uRimPower = { value: power };
    shader.uniforms.uRimStrength = { value: strength };
    shader.uniforms.uRimLift = { value: lift };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>${RIM_PARS}`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>${RIM_BODY}`);
  };
  // distinct rim settings must not share a compiled program
  material.customProgramCacheKey = () => `rim:${rimColor.getHexString()}:${power}:${strength}:${lift}`;
  material.userData.rim = { color: rimColor, power, strength, lift };
  material.needsUpdate = true;
  return material;
}

let sharedEnv = null;
/**
 * A small, asset-free environment: cool light above, a bright band at the
 * horizon, near-black below. Enough for metals to have something to reflect,
 * which is most of what "clean and bright" means for a PBR hull.
 */
export function sceneEnvironment(renderer, { top = 0x8fd0ff, horizon = 0x2a4c72, ground = 0x05070c } = {}) {
  if (sharedEnv) return sharedEnv;
  if (!renderer) return null;
  try {
    const size = 32;
    const data = new Uint8Array(size * size * 4);
    const cTop = new THREE.Color(top);
    const cHor = new THREE.Color(horizon);
    const cGnd = new THREE.Color(ground);
    const tmp = new THREE.Color();
    for (let y = 0; y < size; y++) {
      const v = y / (size - 1); // 0 = up, 1 = down
      if (v < 0.5) tmp.copy(cTop).lerp(cHor, v / 0.5);
      else tmp.copy(cHor).lerp(cGnd, (v - 0.5) / 0.5);
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        data[i] = Math.round(tmp.r * 255);
        data[i + 1] = Math.round(tmp.g * 255);
        data[i + 2] = Math.round(tmp.b * 255);
        data[i + 3] = 255;
      }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    const pmrem = new THREE.PMREMGenerator(renderer);
    sharedEnv = pmrem.fromEquirectangular(tex).texture;
    tex.dispose();
    pmrem.dispose();
    return sharedEnv;
  } catch (err) {
    // No environment is survivable — the materials simply look flatter.
    return null;
  }
}

/** Attach the shared environment to a scene (renderer must be live). */
export function applyEnvironment(scene, renderer) {
  const env = sceneEnvironment(renderer);
  if (env) scene.environment = env;
  return env;
}

// ---------------------------------------------------------------------------
// Shield shell — the bubble that rides a raised lattice.
//
// A hull's shield has to be visible without hiding the hull. A flat glowing
// ball does the opposite: it fogs the ship you are trying to read. So the shell
// is a fresnel shell — almost perfectly clear where you look straight through
// it, bright along every silhouette — drawn additively so it never darkens
// anything behind it.
//
//   uAlpha   overall strength (driven by shield state)
//   uCore    how much of the flat centre shows; keep it tiny
//   uRim     how hard the edge reads
//   uCrackle field instability — a fast flicker that grows as the lattice fails
//
// Colour is a uniform, so a shell can redden as it is beaten down without
// touching its program.
// ---------------------------------------------------------------------------

const BUBBLE_VERT = /* glsl */ `
varying vec3 vBubbleN;
varying vec3 vBubbleV;
varying vec3 vBubbleP;

void main() {
  vec4 worldPos = modelMatrix * vec4( position, 1.0 );
  vBubbleP = worldPos.xyz;
  vBubbleN = normalize( mat3( modelMatrix ) * normal );
  vBubbleV = normalize( cameraPosition - worldPos.xyz );
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const BUBBLE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uCore;
uniform float uRim;
uniform float uCrackle;
uniform float uTime;

varying vec3 vBubbleN;
varying vec3 vBubbleV;
varying vec3 vBubbleP;

void main() {
  float face = clamp( abs( dot( normalize( vBubbleN ), normalize( vBubbleV ) ) ), 0.0, 1.0 );
  float rim = pow( 1.0 - face, 2.4 );

  // a slow cell-crawl across the shell, so the field reads as a lattice
  float crawl = sin( vBubbleP.y * 0.21 + vBubbleP.x * 0.05 - uTime * 1.3 )
              * sin( vBubbleP.z * 0.18 - uTime * 0.9 );
  // instability: fast bands that only show up as the field starts to fail
  float strain = sin( vBubbleP.x * 0.85 + vBubbleP.z * 0.62 - uTime * 11.0 );

  float alpha = uAlpha * ( uCore + rim * uRim + crawl * 0.1 * rim + uCrackle * strain * rim );
  gl_FragColor = vec4( uColor * ( 0.88 + 0.24 * rim ), clamp( alpha, 0.0, 1.0 ) );

  #include <colorspace_fragment>
}
`;

/**
 * A shield shell material. Additive, depth-write off and double-sided: the
 * inside of the far wall brightens the rim too, which is what gives a bubble
 * its glassy thickness.
 */
export function shieldBubbleMaterial(color = 0x6fd8ff) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uAlpha: { value: 0 },
      uCore: { value: 0.075 },
      uRim: { value: 1.15 },
      uCrackle: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: BUBBLE_VERT,
    fragmentShader: BUBBLE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

/**
 * Unit sphere for a shield shell — scale the mesh to the radius you want, so
 * one geometry shape serves every hull size. Kept per ship (never shared) so a
 * ship's `dispose()` can free it without disturbing anyone else's bubble.
 */
export function shieldBubbleGeometry(detail = 16) {
  return new THREE.SphereGeometry(1, detail, Math.max(8, Math.round(detail * 0.6)));
}
