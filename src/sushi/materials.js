import { Color, DoubleSide, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, Vector4 } from 'three';
import { NOISE, RECIPES } from './glsl.js';

// Palettes (sRGB hex) and surface settings for each recipe in glsl.js.
const KINDS = {
  salmon: {
    colors: ['#e3502a', '#ff9460', '#fff0e6'],
    bump: 0.55,
    physical: { roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25, sheen: 0.4, sheenColor: '#ffb090', sheenRoughness: 0.45 },
  },
  tuna: {
    colors: ['#8e0b22', '#c21e36', '#f3c0c0'],
    bump: 0.45,
    physical: { roughness: 0.34, clearcoat: 0.65, clearcoatRoughness: 0.2, iridescence: 0.22, iridescenceIOR: 1.3, sheen: 0.25, sheenColor: '#ff6a7a' },
  },
  tamago: {
    colors: ['#f9d257', '#f0b52e', '#c98a22', '#8d4f18'],
    param: [1.0, 0, 0, 0], // x: top surface height, for the browned skin
    bump: 0.5,
    physical: { roughness: 0.62, clearcoat: 0.15, sheen: 0.3, sheenColor: '#ffe08a' },
  },
  rice: {
    colors: ['#fcfaf3', '#d6cdb9'],
    bump: 0.9,
    physical: { roughness: 0.48, clearcoat: 0.25, clearcoatRoughness: 0.4, sheen: 0.5, sheenColor: '#ffffff', sheenRoughness: 0.6 },
  },
  wasabi: {
    colors: ['#76992a', '#a9c64c', '#4b6618'],
    bump: 0.6,
    physical: { roughness: 0.72, clearcoat: 0.1 },
  },
  hinoki: {
    recipe: 'wood',
    colors: ['#e2c18e', '#c99e66', '#a0733f', '#b8996c'],
    param: [4.5, 0, 0, 0], // x: grain lines per unit across, y: knife scratches
    bump: 0.25,
    physical: { roughness: 0.58, clearcoat: 0.25, clearcoatRoughness: 0.5 },
  },
  board: {
    recipe: 'wood',
    colors: ['#efe2c6', '#dfcca6', '#c4a676', '#a8926f'],
    param: [3.2, 1, 0, 0],
    bump: 0.3,
    physical: { roughness: 0.66 },
  },
  geta: {
    recipe: 'wood',
    colors: ['#a8744a', '#7c4e2c', '#5a3519', '#6b4428'],
    param: [5.5, 0, 0, 0],
    bump: 0.3,
    physical: { roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.35 },
  },
  tub: {
    recipe: 'wood',
    colors: ['#e2c79a', '#c8a571', '#a37a45', '#b89a70'],
    param: [7.0, 0, 0, 0],
    bump: 0.3,
    physical: { roughness: 0.6, clearcoat: 0.2 },
  },
  noren: {
    colors: ['#1c2850', '#efe6d2'],
    bump: 0.15,
    physical: { roughness: 0.92, side: DoubleSide, sheen: 0.6, sheenColor: '#3a4f8f', sheenRoughness: 0.7 },
  },
};

const linear = (hex) => new Color(hex);

// A MeshPhysicalMaterial whose color, bump and roughness come from a recipe
// in glsl.js, sampled at the mesh's aFood attribute.
export function foodMaterial(kind, overrides = {}) {
  const k = KINDS[kind];
  const recipe = RECIPES[k.recipe || kind];
  const { sheenColor, ...physical } = { ...k.physical, ...overrides };
  const mat = new MeshPhysicalMaterial({ color: 0xffffff, ...physical });
  if (sheenColor) mat.sheenColor = new Color(sheenColor);
  const c = k.colors.map(linear);
  while (c.length < 4) c.push(c[c.length - 1].clone());
  const uniforms = {
    uA: { value: c[0] },
    uB: { value: c[1] },
    uC: { value: c[2] },
    uD: { value: c[3] },
    uParam: { value: new Vector4(...(k.param || [0, 0, 0, 0])) },
    uBump: { value: k.bump ?? 0.5 },
  };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aFood;\nvarying vec3 vFood;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFood = aFood;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vFood;
uniform vec3 uA, uB, uC, uD;
uniform vec4 uParam;
uniform float uBump;
${NOISE}
${recipe}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
vec3 foodCol; float foodH; float foodR;
food(vFood, foodCol, foodH, foodR);
diffuseColor.rgb *= foodCol;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor * foodR, 0.04, 1.0);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
normal = foodBump(-vViewPosition, normal, foodH, uBump, faceDirection);`,
      );
  };
  mat.customProgramCacheKey = () => `food-${kind}`;
  return mat;
}

// Copies positions into aFood so the pattern is fixed to the shape it was
// made in. Pass a transform to place the pattern (for example block space).
export function bakeFoodCoords(geometry, scale = 1, offset = [0, 0, 0]) {
  const pos = geometry.attributes.position.array;
  const out = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    out[i] = (pos[i] + offset[0]) * scale;
    out[i + 1] = (pos[i + 1] + offset[1]) * scale;
    out[i + 2] = (pos[i + 2] + offset[2]) * scale;
  }
  return out;
}

// Plain materials for everything that is not generated.
export const plain = {
  copper: () => new MeshPhysicalMaterial({ color: '#c47a4a', metalness: 1, roughness: 0.32, clearcoat: 0.3 }),
  steel: () => new MeshPhysicalMaterial({ color: '#dfe3e8', metalness: 1, roughness: 0.16, clearcoat: 0.4 }),
  horn: () => new MeshPhysicalMaterial({ color: '#1d1a17', roughness: 0.3, clearcoat: 0.8 }),
  handle: () => new MeshPhysicalMaterial({ color: '#d9c8a0', roughness: 0.55, sheen: 0.3, sheenColor: new Color('#fff3d6') }),
  ceramic: (color = '#f3efe7') => new MeshPhysicalMaterial({ color, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }),
  glaze: (color) => new MeshPhysicalMaterial({ color, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }),
  wall: () => new MeshStandardMaterial({ color: '#3a2a20', roughness: 0.95 }),
  plaster: () => new MeshStandardMaterial({ color: '#c9b08c', roughness: 0.95 }),
  dark: () => new MeshStandardMaterial({ color: '#1e1612', roughness: 0.85 }),
  lantern: () => new MeshStandardMaterial({ color: '#fff1d6', emissive: new Color('#ffb05a'), emissiveIntensity: 1.6, roughness: 0.9, side: DoubleSide }),
  ikura: () =>
    new MeshPhysicalMaterial({
      color: '#ffc28a',
      transmission: 1,
      thickness: 0.25,
      ior: 1.36,
      roughness: 0.04,
      clearcoat: 1,
      attenuationColor: new Color('#ff5200'),
      attenuationDistance: 0.18,
      specularIntensity: 1,
    }),
  yolk: () => new MeshStandardMaterial({ color: '#ff6a1a', emissive: new Color('#ff3c00'), emissiveIntensity: 0.25, roughness: 0.4 }),
  sesame: () => new MeshPhysicalMaterial({ color: '#ead6a6', roughness: 0.45, clearcoat: 0.4, sheen: 0.5, sheenColor: new Color('#fff6dd') }),
  scallion: () => new MeshPhysicalMaterial({ color: '#7cc34a', roughness: 0.3, clearcoat: 0.6, transmission: 0.25, thickness: 0.05, sheen: 0.4, sheenColor: new Color('#d8ffb0') }),
  sauce: () => new MeshPhysicalMaterial({ color: '#3a170a', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, specularIntensity: 1 }),
  ginger: () => new MeshPhysicalMaterial({ color: '#ffc7c4', roughness: 0.3, transmission: 0.5, thickness: 0.05, clearcoat: 0.6, side: DoubleSide }),
  shiso: () => new MeshPhysicalMaterial({ color: '#2f8a3a', roughness: 0.4, clearcoat: 0.5, side: DoubleSide, sheen: 0.4, sheenColor: new Color('#9bd17a') }),
  glow: (texture) => new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, blending: 2, toneMapped: false }),
};

// Translucent jelly for customers, same family as the word toy.
export function jellyCustomerMaterial(color, attenuation) {
  return new MeshPhysicalMaterial({
    color: new Color(color),
    transmission: 0.72,
    thickness: 0.5, // in local units; the body is scaled up, so keep this low
    ior: 1.4,
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    attenuationColor: new Color(attenuation),
    attenuationDistance: 3.5,
    specularIntensity: 1,
    envMapIntensity: 1,
  });
}
