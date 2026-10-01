import { Color, DoubleSide, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, Vector4 } from 'three';
import { NOISE, RECIPES } from './glsl.js';

// Palettes (sRGB hex) and surface settings for each recipe in glsl.js.
const KINDS = {
  salmon: {
    colors: ['#ff5f1f', '#ff9a4d', '#ffc7a3'],
    bump: 0.32,
    // Deep translucency: light soaks in and glows orange, like fruit jelly.
    physical: { roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.25, sheenColor: '#ffb48f', sheenRoughness: 0.35, transmission: 0.5, thickness: 0.6, attenuationColor: '#ff4a08', attenuationDistance: 0.42, ior: 1.38, specularIntensity: 1 },
  },
  tuna: {
    colors: ['#8a1426', '#b02c3c', '#e6a0a6', '#56101a'],
    bump: 0.3,
    physical: { roughness: 0.13, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 0.25, iridescenceIOR: 1.3, iridescenceThicknessRange: [200, 500], sheen: 0.2, sheenColor: '#ff4a5a', transmission: 0.42, thickness: 0.55, attenuationColor: '#a00a1c', attenuationDistance: 0.32, ior: 1.38, specularIntensity: 1 },
  },
  tamago: {
    colors: ['#ffd84f', '#f6b92a', '#d99a2a', '#a25f1a'],
    param: [1.0, 0, 0, 0], // x: top surface height, for the browned skin
    bump: 0.35,
    physical: { roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.15, sheen: 0.4, sheenColor: '#fff0a0', transmission: 0.15, thickness: 0.5, attenuationColor: '#f0a010', attenuationDistance: 0.6 },
  },
  rice: {
    colors: ['#fffcf5', '#e6dece'],
    bump: 0.9,
    physical: { roughness: 0.48, clearcoat: 0.25, clearcoatRoughness: 0.4, sheen: 0.5, sheenColor: '#ffffff', sheenRoughness: 0.6 },
  },
  wasabi: {
    colors: ['#7fa62e', '#b1cf55', '#4b6618'],
    bump: 0.45,
    physical: { roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.2, sheen: 0.4, sheenColor: '#e4ffb0' },
  },
  hinoki: {
    recipe: 'wood',
    colors: ['#ecd4a8', '#dcbd8c', '#b88c56', '#b8996c'],
    param: [3.4, 0, 4.05, 0], // x: rings per unit, y: knife scratches, z: plank width
    bump: 0.3,
    physical: { roughness: 0.6, clearcoat: 0.12, clearcoatRoughness: 0.45, sheen: 0.15, sheenColor: '#fff0d0' },
  },
  board: {
    recipe: 'wood',
    colors: ['#e2d0ad', '#d2bc93', '#b89a6a', '#9c8562'],
    param: [2.6, 1, 0, 0],
    bump: 0.35,
    physical: { roughness: 0.62 },
  },
  geta: {
    recipe: 'wood',
    colors: ['#9a6640', '#74452a', '#4b2a16', '#6b4428'],
    param: [4.2, 0, 0, 0],
    bump: 0.3,
    physical: { roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.25 },
  },
  tub: {
    recipe: 'wood',
    colors: ['#e6cc9e', '#cfac78', '#a77d48', '#b89a70'],
    param: [6.0, 0, 0.62, 0],
    bump: 0.3,
    physical: { roughness: 0.55, clearcoat: 0.2 },
  },
  walnut: {
    recipe: 'wood',
    colors: ['#4a2d1c', '#3a2215', '#24130a', '#3a2215'],
    param: [3.0, 0, 0, 0],
    bump: 0.3,
    physical: { roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.4 },
  },
  // Glazes: [glaze, pooled glaze, speckle, raw clay foot]. param.x = foot height.
  glazeWhite: { recipe: 'ceramic', colors: ['#f1ece2', '#d9d0bf', '#5a4636', '#b98f66'], param: [0.05, 0, 0, 0], bump: 0.25, physical: { roughness: 0.16, clearcoat: 0.9, clearcoatRoughness: 0.08 } },
  glazeIndigo: { recipe: 'ceramic', colors: ['#2e4467', '#172238', '#c9b48a', '#a5794f'], param: [0.05, 0, 0, 0], bump: 0.25, physical: { roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.06 } },
  glazeCeladon: { recipe: 'ceramic', colors: ['#b9cbb2', '#8aa48a', '#4b5a44', '#b48a60'], param: [0.05, 0, 0, 0], bump: 0.25, physical: { roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 } },
  glazeTenmoku: { recipe: 'ceramic', colors: ['#3a2418', '#170d08', '#b5703b', '#9b6b45'], param: [0.05, 0, 0, 0], bump: 0.25, physical: { roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04 } },
  glazeShino: { recipe: 'ceramic', colors: ['#efe3d2', '#e2b99a', '#c0704a', '#c58e62'], param: [0.05, 0, 0, 0], bump: 0.3, physical: { roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 } },
  glazeRust: { recipe: 'ceramic', colors: ['#9b4a2a', '#5e2a16', '#e0b27a', '#a5794f'], param: [0.05, 0, 0, 0], bump: 0.25, physical: { roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 } },
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
  lantern: () => new MeshStandardMaterial({ color: '#fff1d6', emissive: new Color('#ffb466'), emissiveIntensity: 3.2, roughness: 0.9, side: DoubleSide }),
  ikura: () =>
    new MeshPhysicalMaterial({
      emissive: new Color('#ff6a12'),
      emissiveIntensity: 0.3, // stands in for light scattering inside the egg
      color: '#ffcf96',
      transmission: 1,
      thickness: 0.25,
      ior: 1.36,
      roughness: 0.04,
      clearcoat: 1,
      attenuationColor: new Color('#ff7a10'),
      attenuationDistance: 0.32,
      specularIntensity: 1,
    }),
  yolk: () => new MeshStandardMaterial({ color: '#ff6a1a', emissive: new Color('#ff3c00'), emissiveIntensity: 0.25, roughness: 0.4 }),
  sesame: () => new MeshPhysicalMaterial({ color: '#efdcb0', roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.3, sheen: 0.6, sheenColor: new Color('#fff3d6') }),
  scallion: () => new MeshPhysicalMaterial({ color: '#86c94e', roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.12, transmission: 0.35, thickness: 0.04, attenuationColor: new Color('#4f9a20'), attenuationDistance: 0.1, sheen: 0.4, sheenColor: new Color('#e2ffc0') }),
  sauce: () => new MeshPhysicalMaterial({ color: '#3a170a', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, specularIntensity: 1 }),
  ginger: () => new MeshPhysicalMaterial({ color: '#ffc7c4', roughness: 0.3, transmission: 0.5, thickness: 0.05, clearcoat: 0.6, side: DoubleSide }),
  shiso: () => new MeshPhysicalMaterial({ color: '#2f8a3a', roughness: 0.4, clearcoat: 0.5, side: DoubleSide, sheen: 0.4, sheenColor: new Color('#9bd17a') }),
  glow: (texture) => new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, blending: 2, toneMapped: false }),
};

// Cooked rice grain: glossy, slightly translucent, faintly warm inside.
export function riceGrainMaterial() {
  return new MeshPhysicalMaterial({
    color: '#fffdf8',
    emissive: new Color('#3a3226'), // light scattered inside the grain
    roughness: 0.18,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    transmission: 0.12,
    thickness: 0.08,
    attenuationColor: new Color('#efe0c0'),
    attenuationDistance: 0.25,
    sheen: 0.5,
    sheenColor: new Color('#ffffff'),
  });
}

// Grain shape: a plump rounded ellipsoid, a touch flatter on one axis.
export function riceGrainGeometry(CapsuleGeometry) {
  const g = new CapsuleGeometry(0.056, 0.075, 3, 10);
  g.scale(1, 1, 0.82);
  return g;
}
