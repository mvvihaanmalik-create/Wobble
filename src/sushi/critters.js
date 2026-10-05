import {
  PlaneGeometry,
  RepeatWrapping,
  BackSide,
  BufferAttribute,
  CanvasTexture,
  CapsuleGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Quaternion,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { bodyMesh, Squishy, unitSphere } from './meshes.js';
import { cheekTexture, emoteTexture, eyeTexture, mouthTexture } from './faces.js';

// Chibi mochi animals, 2000s Japanese game style: a big, soft, round head
// (a soft body that squashes and wobbles) on a small round body with stubby
// arms, little feet and a tail. Faces are painted textures swapped per
// expression: big glossy eyes, ^^ squints, heart eyes, a little ω mouth,
// hatched blush. Manga emotes pop over their heads.

const CRITTER_SIM = {
  // Stiff enough that a big hop never folds the face over itself.
  sim: { spring: 170, damping: 3.6, coupling: 2200, pressure: 110, maxDisplacement: 0.28, softLimit: 0.16 },
  modes: { shearSpring: 52, squashSpring: 80, damping: 3, maxShear: 0.26, maxSquash: 0.32, breathing: 0.02, breathingRate: 2.1, tremble: 0.003 },
};

// Head shapes from a unit sphere: round, a touch wider than tall.
const HEADS = {
  round: (x, y, z) => [x * 1.0, y * 0.92, z * 0.94],
  // Fluffy cheeks low on the sides, for the cat and the fox.
  cheeky: (x, y, z) => {
    const cheek = Math.exp(-(((y + 0.28) / 0.34) ** 2)) * (1 - Math.abs(z) * 0.35);
    return [x * (1 + 0.13 * cheek), y * 0.9, z * 0.94];
  },
  tall: (x, y, z) => [x * 0.93, y * 0.98, z * 0.9],
};

// Patches are ellipsoids in normalized head space: x and z run -1..1 across
// the head, y runs 0..1 from chin to crown, the face looks down +z.
// iris: eye color. brow: brow color. lashes, fang, whiskers: face details.
// body, belly, arms, paws, feet: body colors. tail and acc: extras.
export const SPECIES = {
  cat: {
    head: 'cheeky',
    fur: '#fff8f1',
    ear: 'cat',
    inner: '#ffb3c1',
    nose: '#ff8ea4',
    iris: '#d08a1a',
    eyes: 'lash',
    fang: true,
    whiskers: '#8d7a72',
    patches: [
      { c: [0.62, 0.9, 0.05], r: [0.52, 0.42, 0.8], col: '#f0a35c' },
      { c: [-0.7, 0.72, -0.45], r: [0.42, 0.38, 0.6], col: '#4a3a33' },
    ],
    body: '#fff8f1',
    belly: '#ffffff',
    tail: { kind: 'cat', color: '#f0a35c' },
    acc: 'collar',
  },
  shiba: {
    head: 'round',
    fur: '#eb9c56',
    ear: 'shiba',
    inner: '#fff1de',
    nose: '#2b1d18',
    iris: '#6a3a1a',
    eyes: 'bead',
    brow: '#fff4e4', // the shiba's pale eyebrow spots
    patches: [{ c: [0, 0.22, 0.95], r: [0.78, 0.32, 0.55], col: '#fff4e4' }],
    body: '#eb9c56',
    belly: '#fff4e4',
    paws: '#fff4e4',
    tail: { kind: 'curl', color: '#eb9c56' },
    acc: 'bandana',
  },
  bunny: {
    head: 'tall',
    fur: '#fff3f5',
    ear: 'bunny',
    inner: '#ffbccb',
    nose: '#ff99b1',
    iris: '#c2405a',
    eyes: 'lash',
    patches: [{ c: [0, 0.26, 0.95], r: [0.42, 0.22, 0.4], col: '#ffffff' }],
    body: '#fff3f5',
    belly: '#ffffff',
    tail: { kind: 'puff', color: '#ffffff' },
    acc: 'bow',
  },
  bear: {
    head: 'round',
    fur: '#b88760',
    ear: 'round',
    inner: '#ecd0b0',
    nose: '#3b241a',
    iris: '#5b3420',
    eyes: 'dot',
    patches: [{ c: [0, 0.26, 0.95], r: [0.42, 0.24, 0.45], col: '#f3dec6' }],
    body: '#b88760',
    belly: '#f3dec6',
    tail: { kind: 'puff', color: '#b88760' },
    acc: 'scarf',
  },
  panda: {
    head: 'round',
    fur: '#fbfaf6',
    ear: 'round',
    earColor: '#2a2527',
    inner: '#2a2527',
    nose: '#2a2527',
    iris: '#6a4a3a',
    eyes: 'ringed',
    brow: '#6a5a60',
    // Small, soft teardrop patches that droop outward: sleepy, not spooky.
    patches: [{ c: [0.4, 0.45, 0.9], r: [0.2, 0.15, 0.4], col: '#4a4146', mirror: true, tilt: 0.55 }],
    body: '#fbfaf6',
    arms: '#2a2527',
    feet: '#2a2527',
    tail: { kind: 'puff', color: '#fbfaf6' },
    acc: 'leaf',
  },
  fox: {
    head: 'cheeky',
    fur: '#f48b3d',
    ear: 'fox',
    inner: '#fff3e6',
    nose: '#2b1d18',
    iris: '#e08a2a',
    eyes: 'sleepy',
    fang: true,
    whiskers: '#5a3b2b',
    patches: [
      { c: [0.4, 0.26, 0.9], r: [0.42, 0.28, 0.45], col: '#fff6ec', mirror: true },
      { c: [0, 0.12, 0.9], r: [0.5, 0.22, 0.4], col: '#fff6ec' },
    ],
    body: '#f48b3d',
    belly: '#fff6ec',
    paws: '#4a2c1e',
    feet: '#4a2c1e',
    tail: { kind: 'fox', color: '#f48b3d' },
    acc: 'yuzu',
  },
};

const MAX_PATCHES = 4;

// Shirt fabric, painted once per pattern: stripes, gingham, polka dots or
// plaid, in the guest's colors.
const shirtCache = new Map();
function shirtTexture({ color, alt = '#fffaf0', pattern = 'plain' }) {
  const key = `${color}|${alt}|${pattern}`;
  if (shirtCache.has(key)) return shirtCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = color;
  x.fillRect(0, 0, 256, 256);
  x.fillStyle = alt;
  if (pattern === 'stripes') {
    for (let y = 0; y < 256; y += 32) x.fillRect(0, y, 256, 14);
  } else if (pattern === 'gingham') {
    x.globalAlpha = 0.5;
    for (let k = 0; k < 256; k += 32) {
      x.fillRect(k, 0, 16, 256);
      x.fillRect(0, k, 256, 16);
    }
    x.globalAlpha = 1;
  } else if (pattern === 'dots') {
    for (let y = 0; y < 8; y++) {
      for (let k = 0; k < 8; k++) {
        x.beginPath();
        x.arc(k * 32 + (y % 2) * 16 + 8, y * 32 + 16, 6.5, 0, Math.PI * 2);
        x.fill();
      }
    }
  } else if (pattern === 'plaid') {
    x.globalAlpha = 0.35;
    for (let k = 0; k < 256; k += 64) {
      x.fillRect(k, 0, 24, 256);
      x.fillRect(0, k, 256, 24);
    }
    x.globalAlpha = 0.8;
    for (let k = 40; k < 256; k += 64) {
      x.fillRect(k, 0, 4, 256);
      x.fillRect(0, k, 256, 4);
    }
    x.globalAlpha = 1;
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(4, 2);
  t.anisotropy = 4;
  shirtCache.set(key, t);
  return t;
}

// Fur material: soft satin with a velvet sheen and a little glow from inside,
// like mochi. Markings are mixed in per pixel from baked body coordinates.
export function furMaterial(sp) {
  const m = new MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.48,
    sheen: 1,
    sheenRoughness: 0.42,
    sheenColor: new Color('#fff6ee').multiplyScalar(0.55),
    clearcoat: 0.3,
    clearcoatRoughness: 0.35,
    specularIntensity: 0.6,
  });
  const pc = [];
  const pr = [];
  const pk = [];
  const pm = [];
  for (let i = 0; i < MAX_PATCHES; i++) {
    const p = sp.patches[i];
    pc.push(new Vector3(...(p ? p.c : [9, 9, 9])));
    pr.push(new Vector3(...(p ? p.r : [0.01, 0.01, 0.01])));
    pk.push(new Color(p ? p.col : sp.fur));
    pm.push(new Vector3(p && p.mirror ? 1 : 0, p ? p.tilt || 0 : 0, 0));
  }
  const uniforms = {
    uFur: { value: new Color(sp.fur) },
    uPC: { value: pc },
    uPR: { value: pr },
    uPK: { value: pk },
    uPM: { value: pm },
  };
  m.userData.uniforms = uniforms;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aFood;\nvarying vec3 vCrit;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCrit = aFood;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vCrit;
uniform vec3 uFur;
uniform vec3 uPC[${MAX_PATCHES}];
uniform vec3 uPR[${MAX_PATCHES}];
uniform vec3 uPK[${MAX_PATCHES}];
uniform vec3 uPM[${MAX_PATCHES}];
float critPatch(vec3 p, vec3 c, vec3 r, float tilt) {
  vec3 d = p - c;
  float cs = cos(tilt), sn = sin(tilt);
  d.xy = mat2(cs, -sn, sn, cs) * d.xy;
  float l = length(d / r);
  return 1.0 - smoothstep(0.82, 1.0, l);
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec3 p = vCrit;
  vec3 col = uFur;
  for (int i = 0; i < ${MAX_PATCHES}; i++) {
    float k = critPatch(p, uPC[i], uPR[i], uPM[i].y);
    if (uPM[i].x > 0.5) k = max(k, critPatch(vec3(-p.x, p.yz), uPC[i], uPR[i], uPM[i].y));
    col = mix(col, uPK[i], k);
  }
  // A touch lighter at the crown and cheeks, a touch deeper at the seat.
  col *= mix(0.9, 1.04, smoothstep(0.0, 0.8, p.y));
  diffuseColor.rgb *= col;
}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * 0.045;
${RIM_GLSL}`,
      );
  };
  return m;
}

export function softMaterial(color, opts = {}) {
  const m = new MeshPhysicalMaterial({
    color: new Color(color),
    roughness: 0.48,
    sheen: 1,
    sheenRoughness: 0.42,
    sheenColor: new Color('#fff6ee').multiplyScalar(0.5),
    clearcoat: 0.3,
    clearcoatRoughness: 0.35,
    emissive: new Color(color).multiplyScalar(0.045),
    specularIntensity: 0.6,
    ...opts,
  });
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${RIM_GLSL}`);
  };
  m.customProgramCacheKey = () => 'critter-soft';
  return m;
}

// A soft rim of light around every critter, brighter at the top, and a
// faint warm glow through the body: the plush, lit-from-everywhere look of
// a console mascot. Cheap: a few lines in the fragment shader.
const RIM_GLSL = /* glsl */ `
{
  vec3 vdir = normalize(vViewPosition);
  float facing = clamp(dot(normal, vdir), 0.0, 1.0);
  float rim = pow(1.0 - facing, 2.6);
  float up = clamp(normal.y * 0.5 + 0.6, 0.0, 1.0);
  // Pale fur is already bright: give it less rim so it never blows out.
  float pale = smoothstep(0.55, 0.9, dot(diffuseColor.rgb, vec3(0.333)));
  totalEmissiveRadiance += (vec3(1.0, 0.95, 0.88) * mix(0.32, 0.12, pale) * up + diffuseColor.rgb * 0.14) * rim;
  totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.6, 0.45) * 0.05 * (1.0 - facing);
}`;

// Ear shapes: an ellipsoid pinched toward the tip, pointing +y, facing +z.
function earGeometry(w, h, d, taper, bend = 0) {
  const g = new IcosahedronGeometry(1, 4);
  const p = g.attributes.position.array;
  for (let i = 0; i < p.length; i += 3) {
    const t = (p[i + 1] + 1) / 2;
    const k = 1 - taper * Math.pow(t, 1.4);
    p[i] *= w * k;
    p[i + 2] *= d * (1 - taper * 0.5 * t);
    p[i + 1] = (p[i + 1] + 1) * h * 0.5;
    p[i + 2] += bend * t * t;
  }
  g.computeVertexNormals();
  return g;
}

const EARS = {
  cat: { at: [0.62, 0.9], tilt: 0.55, outer: () => earGeometry(0.2, 0.36, 0.09, 0.8), inner: () => earGeometry(0.12, 0.25, 0.04, 0.8), innerAt: [0, 0.03, 0.06] },
  shiba: { at: [0.58, 0.92], tilt: 0.4, outer: () => earGeometry(0.21, 0.4, 0.09, 0.72), inner: () => earGeometry(0.13, 0.28, 0.04, 0.75), innerAt: [0, 0.03, 0.06] },
  fox: { at: [0.55, 0.92], tilt: 0.35, outer: () => earGeometry(0.21, 0.5, 0.08, 0.82), inner: () => earGeometry(0.12, 0.36, 0.04, 0.82), innerAt: [0, 0.04, 0.055] },
  round: { at: [0.66, 0.86], tilt: 0.7, outer: () => earGeometry(0.17, 0.3, 0.09, 0.1), inner: () => earGeometry(0.1, 0.18, 0.04, 0.1), innerAt: [0, 0.05, 0.06] },
  bunny: { at: [0.32, 0.98], tilt: 0.2, outer: () => earGeometry(0.12, 0.78, 0.07, 0.35, -0.06), inner: () => earGeometry(0.065, 0.6, 0.03, 0.4, -0.06), innerAt: [0, 0.06, 0.05] },
};

const _q = new Quaternion();
const _n = new Vector3();
const _rn = new Vector3();
const _m = new Matrix4();
const UP = new Vector3(0, 1, 0);
const AX_X = new Vector3(1, 0, 0);
const AX_Z = new Vector3(0, 0, 1);

function frame(normal, axis = 'z') {
  // Rest orientation: the part's +z (face parts) or +y (ears, hats) follows
  // the normal, with the other axes kept as upright as possible.
  const n = normal.clone().normalize();
  if (axis === 'z') {
    const x = new Vector3().crossVectors(UP, n);
    if (x.lengthSq() < 1e-6) x.set(1, 0, 0);
    x.normalize();
    const y = new Vector3().crossVectors(n, x);
    return new Quaternion().setFromRotationMatrix(_m.makeBasis(x, y, n));
  }
  const fwd = new Vector3(0, 0, 1);
  const x = new Vector3().crossVectors(n, fwd);
  if (x.lengthSq() < 1e-6) x.set(1, 0, 0);
  x.normalize();
  const z = new Vector3().crossVectors(x, n);
  return new Quaternion().setFromRotationMatrix(_m.makeBasis(x, n, z));
}


// --- Toon outline ----------------------------------------------------------------
// The soft ink line around every part, the way 2000s console mascots were
// drawn: the back faces of the same mesh, pushed out along the normals.

const OUTLINE_COLOR = '#3b1f14';
const outlineMats = new Map();
function outlineMaterial(thickness) {
  const key = thickness.toFixed(4);
  if (outlineMats.has(key)) return outlineMats.get(key);
  const m = new MeshBasicMaterial({ color: OUTLINE_COLOR, side: BackSide });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += normalize(normal) * ${key};`);
  };
  m.customProgramCacheKey = () => `critter-outline-${key}`;
  outlineMats.set(key, m);
  return m;
}

function outline(mesh, thickness = 0.02) {
  const o = new Mesh(mesh.geometry, outlineMaterial(thickness));
  o.position.copy(mesh.position);
  o.quaternion.copy(mesh.quaternion);
  o.scale.copy(mesh.scale);
  o.castShadow = false;
  o.receiveShadow = false;
  o.userData.outline = true;
  return o;
}

// A mesh and its outline, in a group.
function inked(geo, mat, thickness = 0.02, shadow = true) {
  const g = new Group();
  const m = new Mesh(geo, mat);
  m.castShadow = shadow;
  m.receiveShadow = true;
  g.add(m, outline(m, thickness));
  return g;
}

// --- Face decals -------------------------------------------------------------------

// A small patch bent to sit on a round head of radius R.
const decalGeos = new Map();
function decalGeometry(w, h, R) {
  const key = `${w}|${h}|${R.toFixed(3)}`;
  if (decalGeos.has(key)) return decalGeos.get(key);
  const g = new PlaneGeometry(w, h, 8, 8);
  const p = g.attributes.position.array;
  for (let i = 0; i < p.length; i += 3) p[i + 2] -= (p[i] * p[i] + p[i + 1] * p[i + 1]) / (2 * R);
  g.computeVertexNormals();
  decalGeos.set(key, g);
  return g;
}

function decalMaterial(map) {
  return new MeshBasicMaterial({ map, color: new Color(0.96, 0.96, 0.96), transparent: true, depthWrite: false, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
}

// Each expression: which eyes, brows, mouth and how much blush.
const EXPRESSIONS = {
  smile: { eye: 'open', brow: 'neutral', mouth: 'smile', blush: 0.75 },
  open: { eye: 'open', brow: 'raised', mouth: 'open', blush: 0.8 },
  chew: { eye: 'happy', brow: 'neutral', mouth: 'chew', blush: 1 },
  grin: { eye: 'happy', brow: 'raised', mouth: 'grin', blush: 1 },
  frown: { eye: 'sad', brow: 'worried', mouth: 'frown', blush: 0.35 },
  flat: { eye: 'half', brow: 'flat', mouth: 'flat', blush: 0.35 },
  love: { eye: 'heart', brow: 'raised', mouth: 'grin', blush: 1.2 },
  wow: { eye: 'star', brow: 'raised', mouth: 'open', blush: 1 },
  angry: { eye: 'angry', brow: 'angry', mouth: 'pout', blush: 0 },
};
export const EXPRESSION_NAMES = Object.keys(EXPRESSIONS);
const BLINKS = new Set(['open', 'star', 'sad', 'half']);

// Arm poses: rotation about x (swing forward and up) and z (out to the side).
const POSES = {
  rest: () => [-1.0, 0.16],
  banzai: (t, s) => [-2.85, 0.42 + 0.08 * Math.sin(t * 16 + s)],
  wave: (t, s) => (s > 0 ? [-2.7, 0.3 + 0.38 * Math.sin(t * 15)] : [-1.0, 0.16]),
  eat: () => [-2.0, -0.32],
  tap: (t, s) => (s > 0 ? [-1.0 + 0.22 * Math.max(0, Math.sin(t * 11)), 0.16] : [-1.0, 0.16]),
  hop: (t, s) => [-0.5, 0.95 + 0.25 * Math.sin(t * 22 + s)],
};

// --- Body parts ---------------------------------------------------------------------

const HEAD_Y = 0.8; // where the head sits on the body
const TORSO = { r: 0.62, sx: 1.05, sy: 0.82, sz: 0.95, y: 0.5 };
let BODY_GEO = null;
function bodyGeo() {
  if (BODY_GEO) return BODY_GEO;
  const torso = new SphereGeometry(TORSO.r, 36, 22);
  torso.scale(TORSO.sx, TORSO.sy, TORSO.sz);
  const belly = new SphereGeometry(0.42, 28, 18);
  belly.scale(1, 1.02, 0.5);
  const arm = new CapsuleGeometry(0.14, 0.26, 6, 16);
  arm.translate(0, -0.2, 0);
  const paw = new SphereGeometry(0.18, 22, 14);
  paw.scale(1, 0.88, 1);
  const foot = new SphereGeometry(0.2, 22, 14);
  foot.scale(1, 0.55, 1.35);
  const puff = new IcosahedronGeometry(0.17, 3);
  BODY_GEO = { torso, belly, arm, paw, foot, puff };
  return BODY_GEO;
}

function tailGeometry(kind) {
  const tube = (pts, r) => new TubeGeometry(new CatmullRomCurve3(pts.map((p) => new Vector3(...p))), 24, r, 10, false);
  if (kind === 'cat') return tube([[0, 0.24, -0.5], [0.12, 0.3, -0.78], [0.26, 0.62, -0.86], [0.2, 0.92, -0.76], [0.06, 1.0, -0.66]], 0.075);
  if (kind === 'curl') return tube([[0, 0.34, -0.5], [0.04, 0.62, -0.72], [0.14, 0.82, -0.6], [0.16, 0.7, -0.42], [0.08, 0.58, -0.5]], 0.1);
  if (kind === 'fox') {
    const g = new CapsuleGeometry(0.2, 0.55, 8, 18);
    g.rotateX(-0.75);
    g.translate(0, 0.52, -0.82);
    return g;
  }
  return null;
}

export class Critter {
  constructor(species, seed = 1) {
    const sp = typeof species === 'string' ? SPECIES[species] : species;
    this.sp = sp;
    this.mats = [];
    // The head: a soft body that squashes, wobbles and carries the face.
    const base = unitSphere(12);
    const fn = HEADS[sp.head] || HEADS.round;
    const pos = new Float32Array(base.pos.length);
    for (let i = 0; i < pos.length; i += 3) {
      const [x, y, z] = fn(base.pos[i], base.pos[i + 1], base.pos[i + 2]);
      pos[i] = x;
      pos[i + 1] = y;
      pos[i + 2] = z;
    }
    const mesh = bodyMesh(pos, base.idx);
    this.squishy = new Squishy(mesh, furMaterial(sp), CRITTER_SIM);
    this.body = this.squishy.body;
    this.squishy.geometry.setAttribute('aFood', new BufferAttribute(this.normalizedRest(), 3));
    this.group = new Group();
    this.inner = new Group(); // hop offsets live here
    this.group.add(this.inner);
    this.headY = HEAD_Y;
    this.head = new Group();
    this.head.position.y = this.headY;
    this.head.add(this.squishy.mesh, outline(this.squishy.mesh, 0.024));
    this.inner.add(this.head);
    this.buildBody();
    // Contact shadow: a soft dark pool on whatever the critter sits on. It
    // stays put and fades as the critter hops.
    this.blob = new Mesh(blobGeometry(), blobMaterial());
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.position.y = 0.012;
    this.blob.scale.set(1.5, 1.25, 1);
    this.blob.renderOrder = 1;
    this.blobBase = this.blob.scale.clone();
    this.group.add(this.blob);
    this.parts = [];
    this.buildFace();
    this.buildEars();
    this.buildAccessory();
    this.expression = 'smile';
    this.setExpression('smile');
    this.pose = 'rest';
    this.poseUntil = 0;
    this.squash = 0;
    this.squashV = 0;
    this.hop = null;
    this.blinkAt = 1 + Math.random() * 3;
    this.time = Math.random() * 10;
    this.impatience = 0;
    this.hearts = [];
    this.seed = seed;
  }

  // Total height and width, in the critter's own units.
  get height() {
    return this.headY + this.body.height;
  }

  get width() {
    return Math.max(this.body.width, TORSO.r * 2 * TORSO.sx);
  }

  normalizedRest() {
    const { rest, N, width, height, depth } = this.body;
    const out = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      out[i * 3] = rest[i * 3] / (width / 2);
      out[i * 3 + 1] = rest[i * 3 + 1] / height;
      out[i * 3 + 2] = rest[i * 3 + 2] / (depth / 2);
    }
    return out;
  }

  soft(color, opts) {
    const m = softMaterial(color, opts);
    this.mats.push(m);
    return m;
  }

  // Round little body, stubby arms with paws, feet and a tail. Guests wear
  // a patterned shirt with little sleeves, the way village folk do.
  buildBody() {
    const sp = this.sp;
    const geo = bodyGeo();
    const furCol = sp.body || sp.fur;
    const shirt = sp.shirt;
    const bodyMat = shirt ? this.soft('#ffffff', { map: shirtTexture(shirt), sheen: 0.6, sheenRoughness: 0.6, clearcoat: 0.05, roughness: 0.75, emissive: new Color(shirt.color).multiplyScalar(0.04) }) : this.soft(furCol);
    this.torso = new Group();
    const torso = inked(geo.torso, bodyMat, 0.022);
    torso.position.y = TORSO.y;
    this.torso.add(torso);
    if (sp.belly && !shirt) {
      const belly = new Mesh(geo.belly, this.soft(sp.belly));
      belly.position.set(0, TORSO.y - 0.04, TORSO.r * TORSO.sz - 0.17);
      belly.receiveShadow = true;
      this.torso.add(belly);
    }
    this.inner.add(this.torso);
    const armMat = shirt ? bodyMat : sp.arms ? this.soft(sp.arms) : bodyMat;
    const pawMat = sp.paws ? this.soft(sp.paws) : shirt ? this.soft(sp.arms || furCol) : armMat;
    this.arms = [-1, 1].map((side) => {
      const g = new Group();
      g.position.set(side * 0.5, 0.74, 0.1);
      const arm = inked(geo.arm, armMat, 0.018);
      const paw = inked(geo.paw, pawMat, 0.018);
      paw.position.y = -0.42;
      g.add(arm, paw);
      g.userData.side = side;
      this.inner.add(g);
      return g;
    });
    const footMat = sp.feet ? this.soft(sp.feet) : sp.paws ? pawMat : shirt ? this.soft(furCol) : bodyMat;
    this.feet = [-1, 1].map((side) => {
      const f = inked(geo.foot, footMat, 0.016);
      f.position.set(side * 0.27, 0.07, 0.38);
      f.rotation.y = side * 0.25;
      this.inner.add(f);
      return f;
    });
    const t = sp.tail;
    if (t) {
      const tailMat = this.soft(t.color);
      if (t.kind === 'puff') {
        const p = inked(geo.puff, tailMat, 0.016);
        p.position.set(0, 0.32, -0.56);
        this.tail = p;
      } else {
        const g = tailGeometry(t.kind);
        this.tail = inked(g, tailMat, 0.016);
        this.tailGeo = g;
        if (t.kind === 'fox') {
          const tip = new Mesh(geo.puff, this.soft('#fff8ee'));
          tip.scale.set(1.15, 1.3, 1.15);
          tip.position.set(0, 0.86, -1.12);
          this.tail.add(tip);
        }
      }
      this.inner.add(this.tail);
    }
  }

  // Neck accessories ride on the body; head ones are pinned to the head.
  buildAccessory() {
    const acc = this.sp.acc;
    const neckY = this.headY + 0.06;
    const ring = (color, r = 0.5, tube = 0.065) => {
      const m = new Mesh(new TorusGeometry(r, tube, 12, 40), this.soft(color, { sheen: 0.4, roughness: 0.55 }));
      m.rotation.x = Math.PI / 2;
      m.position.y = neckY;
      m.castShadow = true;
      return m;
    };
    if (acc === 'collar') {
      this.inner.add(ring('#e2483a', 0.5, 0.06));
      const bell = new Mesh(new SphereGeometry(0.11, 20, 14), new MeshPhysicalMaterial({ color: '#f2c14e', metalness: 0.9, roughness: 0.25, clearcoat: 0.6 }));
      this.mats.push(bell.material);
      bell.position.set(0, neckY - 0.1, 0.5);
      const slit = new Mesh(new CylinderGeometry(0.012, 0.012, 0.1, 6), new MeshBasicMaterial({ color: '#5a3a10' }));
      slit.rotation.x = Math.PI / 2;
      slit.position.set(0, -0.04, 0.07);
      bell.add(slit);
      this.inner.add(bell);
    } else if (acc === 'bandana' || acc === 'scarf') {
      const color = acc === 'bandana' ? this.sp.bandana || '#3e6fb5' : '#4f9a5b';
      this.inner.add(ring(color, 0.5, acc === 'scarf' ? 0.1 : 0.06));
      const cloth = this.soft(color, { sheen: 0.5, roughness: 0.6, side: DoubleSide });
      if (acc === 'bandana') {
        const tri = new Mesh(new ConeGeometry(0.34, 0.42, 3), cloth);
        tri.rotation.set(Math.PI, Math.PI / 6, 0);
        tri.scale.set(1, 1, 0.25);
        tri.position.set(0, neckY - 0.2, 0.47);
        tri.castShadow = true;
        this.inner.add(tri);
      } else {
        const end = new Mesh(new CapsuleGeometry(0.09, 0.28, 4, 10), cloth);
        end.position.set(0.24, neckY - 0.22, 0.46);
        end.rotation.z = 0.2;
        end.castShadow = true;
        this.inner.add(end);
      }
    } else if (acc === 'bow') {
      const g = new Group();
      const mat = this.soft('#ff7aa8', { sheen: 0.6 });
      for (const s of [-1, 1]) {
        const lobe = new Mesh(new SphereGeometry(0.15, 16, 12), mat);
        lobe.scale.set(1.3, 0.85, 0.45);
        lobe.position.x = s * 0.15;
        lobe.rotation.z = s * 0.25;
        g.add(lobe);
      }
      const knot = new Mesh(new SphereGeometry(0.075, 12, 10), mat);
      g.add(knot);
      g.traverse((o) => o.isMesh && (o.castShadow = true));
      const H = this.body.height;
      this.pin(g, this.nearest(-0.42, H * 0.86, null, new Vector3(-0.3, 1, 0.5).normalize(), 0.2), 0.03, { axis: 'y', dir: new Vector3(-0.35, 1, 0.45).normalize() });
    } else if (acc === 'leaf' || acc === 'yuzu') {
      const g = new Group();
      const leafMat = this.soft('#5cae4a', { sheen: 0.3, roughness: 0.4, side: DoubleSide });
      const leaf = (rx, rz, len) => {
        const l = new Mesh(new SphereGeometry(1, 16, 8), leafMat);
        l.scale.set(0.07, 0.015, len);
        l.position.set(Math.sin(rz) * len * 0.8, 0.04, Math.cos(rz) * len * 0.8 - 0.05);
        l.rotation.set(rx, rz, 0);
        l.castShadow = true;
        return l;
      };
      if (acc === 'leaf') {
        g.add(leaf(-0.3, 0.4, 0.3), leaf(-0.25, -0.5, 0.26));
        const stem = new Mesh(new CylinderGeometry(0.025, 0.03, 0.2, 8), this.soft('#7a9a3a'));
        stem.position.y = 0.06;
        g.add(stem);
      } else {
        const fruit = new Mesh(new SphereGeometry(0.15, 20, 14), this.soft('#ffc93c', { roughness: 0.35, clearcoat: 0.7 }));
        fruit.position.y = 0.12;
        fruit.castShadow = true;
        g.add(fruit, leaf(-0.4, 0.7, 0.16));
      }
      const H = this.body.height;
      const x = acc === 'yuzu' ? 0.5 : 0.05;
      this.pin(g, this.nearest(x, H, null, new Vector3(x, 1, 0.2).normalize(), 0.3), -0.02, { axis: 'y', dir: new Vector3(x * 0.6, 1, 0.2).normalize() });
    }
  }

  // Surface vertex nearest a point, among those facing a direction.
  nearest(x, y, z, facing, minDot = 0.3) {
    const { rest, restNormal, N } = this.body;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      if (restNormal[i3] * facing.x + restNormal[i3 + 1] * facing.y + restNormal[i3 + 2] * facing.z < minDot) continue;
      const d = (rest[i3] - x) ** 2 + (rest[i3 + 1] - y) ** 2 + (z == null ? 0 : (rest[i3 + 2] - z) ** 2);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  restNormalOf(v) {
    const n = this.body.restNormal;
    return new Vector3(n[v * 3], n[v * 3 + 1], n[v * 3 + 2]);
  }

  // Pin an object to a head vertex. axis: which local axis follows the normal.
  pin(obj, v, lift, { axis = 'z', dir = null } = {}) {
    const rn = this.restNormalOf(v);
    this.head.add(obj);
    const part = { obj, v, lift, restN: rn, restQ: frame(dir || rn, axis), extra: new Quaternion() };
    this.parts.push(part);
    return part;
  }

  // Face parts sit on the front of the head: x across, y up, in head units.
  pinFace(obj, x, y, lift) {
    return this.pin(obj, this.nearest(x, y, null, new Vector3(0, 0, 1)), lift);
  }

  buildFace() {
    const sp = this.sp;
    const H = this.body.height;
    const W = this.body.width;
    const R = Math.min(W, this.body.depth) / 2;
    // Big eyes, set low and wide: the baby face that made the era.
    const eyeX = W * 0.22;
    const eyeY = H * 0.47;
    const blank = eyeTexture('open', 'neutral', sp.iris || '#5a3420', { style: sp.eyes || 'anime' });
    this.eyes = [-1, 1].map((side) => {
      const m = new Mesh(decalGeometry(0.5, 0.625, R * 0.92), decalMaterial(blank));
      m.renderOrder = 3;
      // The painted eye is the one on the left of the screen; flip the other.
      m.scale.x = side < 0 ? 1 : -1;
      this.mats.push(m.material);
      this.pinFace(m, side * eyeX, eyeY, 0.012);
      return m;
    });
    this.cheeks = [-1, 1].map((side) => {
      const m = new Mesh(decalGeometry(0.46, 0.29, R * 0.9), decalMaterial(cheekTexture(sp.whiskers || null)));
      m.renderOrder = 2;
      m.scale.x = side < 0 ? 1 : -1;
      this.mats.push(m.material);
      this.pinFace(m, side * W * 0.32, H * 0.31, 0.01);
      return m;
    });
    const nose = new Mesh(new IcosahedronGeometry(0.045, 3).scale(1.4, 0.85, 0.6), new MeshPhysicalMaterial({ color: sp.nose, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }));
    this.mats.push(nose.material);
    this.pinFace(nose, 0, H * 0.355, 0.02);
    this.mouth = new Mesh(decalGeometry(0.36, 0.27, R * 0.92), decalMaterial(mouthTexture('smile')));
    this.mouth.renderOrder = 3;
    this.mats.push(this.mouth.material);
    this.pinFace(this.mouth, 0, H * 0.255, 0.012);
  }

  buildEars() {
    const sp = this.sp;
    const e = EARS[sp.ear];
    if (!e) return;
    const W = this.body.width;
    const H = this.body.height;
    const outerMat = this.soft(sp.earColor || sp.fur);
    const innerMat = this.soft(sp.inner, { sheen: 0.6 });
    const outerGeo = e.outer();
    const innerGeo = e.inner();
    this.ears = [-1, 1].map((side) => {
      const g = new Group();
      g.scale.setScalar(1.3);
      const o = new Mesh(outerGeo, outerMat);
      const i = new Mesh(innerGeo, innerMat);
      i.position.set(...e.innerAt);
      o.castShadow = true;
      g.add(o, outline(o, 0.014), i);
      const v = this.nearest(side * (W / 2) * e.at[0], H * e.at[1], 0, new Vector3(0, 1, 0), -0.2);
      // Ears lean out from the crown, a little forward.
      const n = this.restNormalOf(v);
      const dir = new Vector3(n.x * e.tilt, 1, 0.12).normalize();
      const part = this.pin(g, v, -0.05, { axis: 'y', dir });
      part.side = side;
      part.ear = true;
      return part;
    });
  }

  setExpression(name) {
    const e = EXPRESSIONS[name];
    if (!e) return;
    this.expression = name;
    this.face = e;
    this.paintEyes(e.eye);
    const sp = this.sp;
    this.mouth.material.map = mouthTexture(e.mouth, !!sp.fang && (e.mouth === 'open' || e.mouth === 'grin'));
    for (const c of this.cheeks) c.material.opacity = Math.min(1, e.blush);
  }

  paintEyes(kind) {
    const sp = this.sp;
    const t = eyeTexture(kind, this.face.brow, sp.iris || '#5a3420', { lashes: !!sp.lashes, brow: sp.brow || '#2a160f', style: sp.eyes || 'anime' });
    for (const m of this.eyes) m.material.map = t;
    this.eyeKind = kind;
  }

  // The middle of the mouth, a touch in front of the face, in world space.
  mouthWorld(out = new Vector3()) {
    this.mouth.updateWorldMatrix(true, false);
    this.mouth.getWorldPosition(out);
    const s = this.group.scale.x;
    out.z += 0.12 * s;
    out.y -= 0.02 * s;
    return out;
  }

  // Strike a pose with the arms for a while.
  setPose(name, seconds = 1) {
    this.pose = name;
    this.poseUntil = this.time + seconds;
  }

  // A manga symbol over the head for a moment: surprise, question, note,
  // heart, anger, sweat, sparkle or gloom.
  emote(kind, ms = 1500) {
    if (!this.emoteSprite) {
      this.emoteSprite = new Sprite(new SpriteMaterial({ map: emoteTexture(kind), transparent: true, depthWrite: false }));
      this.mats.push(this.emoteSprite.material);
      this.inner.add(this.emoteSprite);
    }
    const s = this.emoteSprite;
    s.material.map = emoteTexture(kind);
    const H = this.body.height;
    const W = this.body.width;
    const top = this.headY + H;
    const at = kind === 'sweat' ? [W * 0.42, this.headY + H * 0.82, 0.35] : kind === 'gloom' ? [0, top + 0.12, 0.4] : [W * 0.4, top + 0.22, 0.15];
    s.position.set(...at);
    s.visible = true;
    this.emoteState = { t: 0, life: ms / 1000, kind, y: at[1] };
  }

  // Squash hello: little hop in place. A real poke gets a wave and a note.
  poke(strength = 1) {
    this.body.impulse(0, this.body.height * 0.6, 0.6, 0, -0.3, -1, 2.2 * strength, 0.45);
    this.body.kickAll((Math.random() - 0.5) * 1.2, 1.3 * strength, -0.6);
    this.squashV += 2.2 * strength;
    this.earFlick = 1;
    if (strength >= 1) {
      this.setPose('wave', 0.9);
      this.emote(Math.random() < 0.5 ? 'note' : 'heart', 1100);
    }
  }

  hopTo(target, duration = 0.55, height = 1.2, scale = null) {
    // A new hop replaces one in flight; the old one counts as done.
    if (this.hop) this.hop.resolve();
    return new Promise((resolve) => {
      this.hop = { from: this.group.position.clone(), to: target.clone(), s0: this.group.scale.x, s1: scale ?? this.group.scale.x, t: 0, duration, height, resolve };
      this.body.kickAll(0, -1.6, 0);
      this.squashV += 3;
    });
  }

  celebrate() {
    const s = sharedParts();
    for (let i = 0; i < 5; i++) {
      const h = new Sprite(s.heart);
      h.scale.setScalar(0.3);
      h.position.set((Math.random() - 0.5) * 0.9, this.headY + this.body.height * 0.95, 0.3);
      h.userData = { vy: 0.9 + Math.random() * 0.6, vx: (Math.random() - 0.5) * 0.5, life: 0, delay: i * 0.12 };
      h.visible = false;
      this.inner.add(h);
      this.hearts.push(h);
    }
    this.setExpression(this.cheer || 'love');
    this.setPose('banzai', 1.4);
    this.emote('sparkle', 1400);
    this.body.kickAll(0, -2.4, 0);
    this.squashV += 3;
    this.earFlick = 1.4;
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    const b = this.body;
    // Waiting too long: sag, droop the ears, tap a paw on the counter.
    b.userMode[1] = 0.16 * this.impatience;
    if (this.hop) {
      const h = this.hop;
      h.t = Math.min(1, h.t + dt / h.duration);
      const k = h.t;
      // Ease the travel so take-off and landing read; the arc stays a sine.
      const e = k * k * (3 - 2 * k);
      this.group.position.lerpVectors(h.from, h.to, e);
      if (h.s0 !== h.s1) this.group.scale.setScalar(h.s0 + (h.s1 - h.s0) * e);
      this.inner.position.y = Math.sin(Math.PI * k) * h.height;
      if (k === 1) {
        this.hop = null;
        this.inner.position.y = 0;
        b.kickAll(0, 2.4, 0);
        this.squashV -= 3.5;
        this.earFlick = 1;
        h.resolve();
      }
    }
    this.squishy.step(dt);
    // The body squashes on a spring and breathes; the head rides on top.
    this.squashV += (-this.squash * 170 - this.squashV * 9) * dt;
    this.squash += this.squashV * dt;
    const sq = Math.max(-0.25, Math.min(0.25, this.squash * 0.06));
    const breath = 0.022 * Math.sin(t * 2.1 + this.seed);
    this.torso.scale.set(1 + sq * 0.6 - breath * 0.4, 1 - sq + breath, 1 + sq * 0.6 - breath * 0.4);
    this.head.position.y = this.headY * (1 - sq + breath);
    // Arms.
    let pose = this.time < this.poseUntil ? this.pose : this.impatience > 0.5 ? 'tap' : 'rest';
    if (this.hop) pose = 'hop';
    for (const a of this.arms) {
      const s = a.userData.side;
      const [rx, rz] = POSES[pose](t, s);
      const k = Math.min(1, dt * 12);
      a.rotation.x += (rx - a.rotation.x) * k;
      a.rotation.z += (s * rz - a.rotation.z) * k;
      a.position.y = 0.74 * (1 - sq * 0.8 + breath);
    }
    for (const f of this.feet) f.scale.y = this.hop ? 0.7 : 1;
    if (this.tail) this.tail.rotation.y = Math.sin(t * (this.impatience > 0.5 ? 9 : 2.4)) * 0.18;

    const lift = Math.max(0, this.inner.position.y);
    const kk = 1 / (1 + lift * 0.9);
    this.blob.scale.set(this.blobBase.x * (0.7 + 0.3 * kk), this.blobBase.y * (0.7 + 0.3 * kk), 1);
    this.blob.material.opacity = 0.55 * kk;

    this.earFlick = Math.max(0, (this.earFlick || 0) - dt * 2.5);
    const flick = Math.sin(t * 26) * this.earFlick * 0.18;
    const droop = this.impatience * (this.sp.ear === 'bunny' ? 0.9 : 0.45);
    // Parts follow the surface: rotate their rest pose by how far the
    // normal under them has turned.
    const { out, normal } = b;
    for (const p of this.parts) {
      const i3 = p.v * 3;
      _n.set(normal[i3], normal[i3 + 1], normal[i3 + 2]);
      p.obj.position.set(out[i3] + _n.x * p.lift, out[i3 + 1] + _n.y * p.lift, out[i3 + 2] + _n.z * p.lift);
      _rn.copy(p.restN);
      _q.setFromUnitVectors(_rn, _n);
      p.obj.quaternion.multiplyQuaternions(_q, p.restQ);
      if (p.ear) {
        // Droop outward and back; flick on hops and pokes.
        p.extra.setFromAxisAngle(AX_Z, -p.side * (droop * 0.9 + flick));
        p.obj.quaternion.multiply(p.extra);
        p.extra.setFromAxisAngle(AX_X, -droop * 0.5);
        p.obj.quaternion.multiply(p.extra);
      }
    }
    // Blink: swap to closed eyes for a moment, when the eyes are open.
    this.blinkAt -= dt;
    if (this.blinkAt < 0 && BLINKS.has(this.face.eye)) {
      if (this.eyeKind !== 'closed') this.paintEyes('closed');
      if (this.blinkAt < -0.13) {
        this.paintEyes(this.face.eye);
        this.blinkAt = 1.8 + Math.random() * 3.5;
      }
    } else if (this.blinkAt < -0.13) this.blinkAt = 1.8 + Math.random() * 3.5;
    // Emote: pop in, bob, fade out.
    const em = this.emoteState;
    if (em) {
      em.t += dt;
      const s = this.emoteSprite;
      const pop = em.t < 0.22 ? 1 + 2.4 * (em.t / 0.22 - 1) ** 3 + 1.4 * (em.t / 0.22 - 1) ** 2 : 1;
      const size = em.kind === 'gloom' ? 0.8 : 0.62;
      s.scale.setScalar(Math.max(0.01, size * pop));
      s.position.y = em.y + (em.kind === 'sweat' ? -em.t * 0.12 : Math.sin(em.t * 6) * 0.03);
      s.material.opacity = Math.min(1, (em.life - em.t) / 0.25);
      if (em.t >= em.life) {
        s.visible = false;
        this.emoteState = null;
      }
    }
    // Hearts float up and fade.
    for (const h of this.hearts) {
      const u = h.userData;
      if (u.delay > 0) {
        u.delay -= dt;
        continue;
      }
      h.visible = true;
      u.life += dt;
      h.position.y += u.vy * dt;
      h.position.x += u.vx * dt;
      h.scale.setScalar(0.3 + u.life * 0.15);
    }
    this.hearts = this.hearts.filter((h) => {
      if (h.userData.life > 1.4) {
        this.inner.remove(h);
        return false;
      }
      return true;
    });
  }

  dispose() {
    this.squishy.dispose();
    this.squishy.mesh.material.dispose();
    this.blob.material.dispose();
    for (const m of this.mats) m.dispose();
    if (this.tailGeo) this.tailGeo.dispose();
  }
}

// A guest at the counter.
export class Customer extends Critter {
  constructor(look, seed = 1) {
    super({ ...SPECIES[look.species], shirt: look.shirt }, seed);
    this.look = look;
  }
}

// The sous chef: a shiba in a little chef's toque and a red neckerchief.
export class SousChef extends Critter {
  constructor() {
    super({ ...SPECIES.shiba, acc: 'bandana', bandana: '#e2483a' }, 3);
    this.cheer = 'grin';
    const H = this.body.height;
    const hat = new Group();
    const white = this.soft('#fbf8f2', { sheen: 0.8, roughness: 0.7, clearcoat: 0 });
    const band = new Mesh(new CylinderGeometry(0.34, 0.36, 0.22, 32), white);
    band.position.y = 0.1;
    hat.add(band);
    const puffs = [[0, 0.4, 0, 0.34], [0.19, 0.33, 0.05, 0.22], [-0.19, 0.33, 0.05, 0.22], [0, 0.33, -0.18, 0.22], [0.09, 0.56, 0.04, 0.22], [-0.11, 0.53, -0.04, 0.22]];
    for (const [x, y, z, r] of puffs) {
      const m = new Mesh(new IcosahedronGeometry(r, 3), white);
      m.position.set(x, y, z);
      m.castShadow = true;
      hat.add(m);
    }
    const v = this.nearest(0.1, H, -0.05, new Vector3(0, 1, 0), 0.5);
    this.pin(hat, v, -0.08, { axis: 'y', dir: new Vector3(0.14, 1, -0.15).normalize() });
  }
}

// Hearts for celebrations.
let shared = null;
function sharedParts() {
  return (shared ||= { heart: new SpriteMaterial({ map: heartTexture(), transparent: true, depthWrite: false }) });
}

// The chef's paw: a cream forearm out of a white chef's sleeve, with pink
// toe beans underneath. The origin is the middle of the paw, pads down.
export class Paw {
  constructor() {
    this.group = new Group();
    const fur = softMaterial('#fff6ec');
    const pad = new MeshPhysicalMaterial({ color: '#ff9cb0', roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2, sheen: 0.4, sheenColor: '#ffffff' });
    const cloth = softMaterial('#f6f2ea', { roughness: 0.85, sheen: 0.8, clearcoat: 0 });
    const stripe = softMaterial('#2c3a5e', { roughness: 0.8, clearcoat: 0 });
    // The arm leans up and back toward the chef.
    const arm = new Group();
    arm.rotation.x = 1.0;
    const fore = new Mesh(new CapsuleGeometry(0.34, 1.3, 6, 20), fur);
    fore.position.y = 0.85;
    const sleeve = new Mesh(new CapsuleGeometry(0.5, 1.6, 6, 24), cloth);
    sleeve.position.y = 2.35;
    const band = new Mesh(new CylinderGeometry(0.52, 0.52, 0.14, 28), stripe);
    band.position.y = 1.65;
    arm.add(fore, sleeve, band);
    const hand = new Mesh(new IcosahedronGeometry(0.52, 4).scale(1, 0.62, 1.08), fur);
    hand.position.y = 0.12;
    const big = new Mesh(new IcosahedronGeometry(0.2, 3).scale(1.15, 0.35, 0.9), pad);
    big.position.set(0, -0.18, 0.1);
    this.group.add(arm, hand, big);
    const toes = [[-0.27, -0.16], [-0.1, -0.3], [0.1, -0.3], [0.27, -0.16]];
    for (const [x, z] of toes) {
      const t = new Mesh(new IcosahedronGeometry(0.085, 3).scale(1, 0.4, 1.1), pad);
      t.position.set(x, -0.12, z);
      this.group.add(t);
    }
    this.group.traverse((m) => {
      if (m.isMesh) m.castShadow = true;
    });
    this.group.visible = false;
  }
}

let BLOB = null;
function blobGeometry() {
  return (BLOB ||= new PlaneGeometry(1, 1));
}

// Each critter gets its own material so its shadow can fade on its own.
let BLOB_TEX = null;
function blobMaterial() {
  if (!BLOB_TEX) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,0.85)');
    g.addColorStop(0.45, 'rgba(0,0,0,0.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    BLOB_TEX = new CanvasTexture(c);
  }
  return new MeshBasicMaterial({ map: BLOB_TEX, color: '#3a1c0c', transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, toneMapped: false });
}

// A loose contact shadow, for places a critter touches that are not under it.
export function contactShadow() {
  const m = new Mesh(blobGeometry(), blobMaterial());
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}

function softDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function heartTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ff5c8a';
  ctx.beginPath();
  ctx.moveTo(32, 54);
  ctx.bezierCurveTo(4, 36, 6, 10, 22, 10);
  ctx.bezierCurveTo(28, 10, 32, 15, 32, 19);
  ctx.bezierCurveTo(32, 15, 36, 10, 42, 10);
  ctx.bezierCurveTo(58, 10, 60, 36, 32, 54);
  ctx.fill();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}
