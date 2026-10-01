import {
  BufferAttribute,
  CanvasTexture,
  CapsuleGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Quaternion,
  Shape,
  ShapeGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
} from 'three';
import { bodyMesh, Squishy, unitSphere } from './meshes.js';

// Soft mochi animals: a squishy body with fur markings drawn in the shader,
// and ears, eyes, nose and mouth pinned to the moving surface.

const CRITTER_SIM = {
  sim: { spring: 110, damping: 2.6, coupling: 2200, pressure: 90, maxDisplacement: 0.4, softLimit: 0.22 },
  modes: { shearSpring: 38, squashSpring: 60, damping: 2.2, maxShear: 0.35, maxSquash: 0.42, breathing: 0.02, breathingRate: 2.1, tremble: 0.004 },
};

// Body shapes from a unit sphere: wide, soft and a little bottom heavy.
const SHAPES = {
  mochi: (x, y, z) => [x * 1.06, y > 0 ? Math.pow(y, 0.82) * 1.0 : y * 0.22, z * 0.96],
  round: (x, y, z) => [x * 1.0, y > 0 ? Math.pow(y, 0.86) * 1.08 : y * 0.24, z * 0.96],
  bean: (x, y, z) => [x * 0.86, y > 0 ? y * 1.16 : y * 0.36, z * 0.82],
  drop: (x, y, z) => {
    const t = (y + 1) / 2;
    const k = 1 - 0.38 * Math.pow(t, 2.4);
    return [x * 0.98 * k, y > 0 ? y * 1.12 : y * 0.3, z * 0.9 * k];
  },
};

// Patches are ellipsoids in normalized body space: x and z run -1..1 across
// the body, y runs 0..1 from the seat to the crown, the face looks down +z.
export const SPECIES = {
  cat: {
    shape: 'mochi',
    fur: '#fff8f1',
    ear: 'cat',
    inner: '#ffb3c1',
    nose: '#ff8ea4',
    whiskers: '#8d7a72',
    patches: [
      { c: [0.62, 0.95, 0.1], r: [0.5, 0.42, 0.75], col: '#f0a35c' },
      { c: [-0.7, 0.6, -0.4], r: [0.42, 0.4, 0.6], col: '#4a3a33' },
    ],
  },
  shiba: {
    shape: 'mochi',
    fur: '#eb9c56',
    ear: 'shiba',
    inner: '#fff1de',
    nose: '#2b1d18',
    patches: [
      { c: [0, 0.3, 0.95], r: [0.7, 0.36, 0.5], col: '#fff4e4' },
      { c: [0.3, 0.74, 0.9], r: [0.09, 0.055, 0.3], col: '#fff4e4', mirror: true },
    ],
  },
  bunny: {
    shape: 'bean',
    fur: '#fff3f5',
    ear: 'bunny',
    inner: '#ffbccb',
    nose: '#ff99b1',
    patches: [{ c: [0, 0.38, 0.95], r: [0.42, 0.22, 0.4], col: '#ffffff' }],
  },
  bear: {
    shape: 'round',
    fur: '#b88760',
    ear: 'round',
    inner: '#ecd0b0',
    nose: '#3b241a',
    patches: [{ c: [0, 0.36, 0.95], r: [0.42, 0.24, 0.45], col: '#f3dec6' }],
  },
  panda: {
    shape: 'round',
    fur: '#fbfaf6',
    ear: 'round',
    earColor: '#2a2527',
    inner: '#2a2527',
    nose: '#2a2527',
    patches: [{ c: [0.33, 0.55, 0.9], r: [0.2, 0.17, 0.35], col: '#2e292b', mirror: true, tilt: 0.5 }],
  },
  fox: {
    shape: 'drop',
    fur: '#f48b3d',
    ear: 'fox',
    inner: '#fff3e6',
    nose: '#2b1d18',
    whiskers: '#5a3b2b',
    patches: [
      { c: [0.38, 0.32, 0.9], r: [0.42, 0.3, 0.45], col: '#fff6ec', mirror: true },
      { c: [0, 0.0, 0.9], r: [0.5, 0.25, 0.4], col: '#fff6ec' },
    ],
  },
};

const MAX_PATCHES = 4;

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
totalEmissiveRadiance += diffuseColor.rgb * 0.045;`,
      );
  };
  return m;
}

export function softMaterial(color, opts = {}) {
  return new MeshPhysicalMaterial({
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
}

// Lines for the mouth, drawn as thin tubes. Filled shapes for open mouths.
const MOUTHS = {
  smile: [[-0.1, 0.012], [-0.068, -0.03], [-0.028, -0.026], [0, 0.002], [0.028, -0.026], [0.068, -0.03], [0.1, 0.012]],
  flat: [[-0.055, -0.018], [0, -0.022], [0.055, -0.018]],
  frown: [[-0.075, -0.05], [-0.035, -0.022], [0, -0.016], [0.035, -0.022], [0.075, -0.05]],
  chew: [[-0.06, -0.02], [-0.025, -0.045], [0.02, -0.012], [0.06, -0.036]],
  grin: [[-0.1, 0.012], [-0.068, -0.03], [-0.028, -0.026], [0, 0.002], [0.028, -0.026], [0.068, -0.03], [0.1, 0.012]],
  open: [[-0.1, 0.012], [-0.068, -0.03], [-0.028, -0.026], [0, 0.002], [0.028, -0.026], [0.068, -0.03], [0.1, 0.012]],
};
const FILLS = {
  grin: (s) => {
    s.moveTo(-0.07, -0.022);
    s.quadraticCurveTo(0, -0.02, 0.07, -0.022);
    s.bezierCurveTo(0.065, -0.11, -0.065, -0.11, -0.07, -0.022);
  },
  open: (s) => {
    s.moveTo(0, -0.025);
    s.bezierCurveTo(0.05, -0.025, 0.05, -0.095, 0, -0.095);
    s.bezierCurveTo(-0.05, -0.095, -0.05, -0.025, 0, -0.025);
  },
};

let shared = null;
function sharedParts() {
  if (shared) return shared;
  const eye = new IcosahedronGeometry(0.1, 4);
  eye.scale(1, 1.14, 0.5);
  const tubes = {};
  for (const [k, pts] of Object.entries(MOUTHS)) {
    tubes[k] = new TubeGeometry(new CatmullRomCurve3(pts.map(([x, y]) => new Vector3(x, y, 0))), 40, 0.011, 6);
  }
  const fills = {};
  for (const [k, draw] of Object.entries(FILLS)) {
    const s = new Shape();
    draw(s);
    fills[k] = new ShapeGeometry(s, 16);
  }
  // Closed happy eyes, like ^ ^.
  const arc = new CatmullRomCurve3([[-0.08, -0.02], [-0.045, 0.03], [0, 0.048], [0.045, 0.03], [0.08, -0.02]].map(([x, y]) => new Vector3(x, y, 0)));
  const whisker = new TubeGeometry(new CatmullRomCurve3([new Vector3(0, 0, 0), new Vector3(0.12, 0.012, -0.01), new Vector3(0.24, 0.0, -0.03)]), 12, 0.0055, 4);
  shared = {
    eye,
    shine: new IcosahedronGeometry(0.028, 2),
    shine2: new IcosahedronGeometry(0.013, 2),
    happy: new TubeGeometry(arc, 24, 0.015, 6),
    whisker,
    philtrum: new TubeGeometry(new CatmullRomCurve3([new Vector3(0, 0.0, 0), new Vector3(0, 0.025, 0), new Vector3(0, 0.05, 0)]), 4, 0.01, 6),
    tubes,
    fills,
    blush: new CircleGeometry(0.085, 24).scale(1.35, 0.8, 1),
    nose: new IcosahedronGeometry(0.042, 3).scale(1.35, 0.85, 0.6),
    ink: new MeshPhysicalMaterial({ color: '#0a0606', roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, specularIntensity: 0.4, envMapIntensity: 0.25 }),
    mouthInk: new MeshPhysicalMaterial({ color: '#3a1c1c', roughness: 0.3 }),
    tongue: new MeshPhysicalMaterial({ color: '#c24456', roughness: 0.4 }),
    white: new MeshBasicMaterial({ color: new Color(6, 6, 6) }),
    blushMat: new MeshBasicMaterial({ map: softDot(), color: '#ff7f9c', transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    heart: new SpriteMaterial({ map: heartTexture(), transparent: true, depthWrite: false }),
  };
  return shared;
}

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

export class Critter {
  constructor(species, seed = 1) {
    const sp = typeof species === 'string' ? SPECIES[species] : species;
    this.sp = sp;
    const base = unitSphere(12);
    const fn = SHAPES[sp.shape] || SHAPES.mochi;
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
    this.inner.add(this.squishy.mesh);
    this.group.add(this.inner);
    this.parts = [];
    this.buildFace();
    this.buildEars();
    this.expression = 'smile';
    this.setExpression('smile');
    this.hop = null;
    this.blinkAt = 1 + Math.random() * 3;
    this.time = Math.random() * 10;
    this.impatience = 0;
    this.hearts = [];
    this.seed = seed;
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

  // Pin an object to a vertex. axis: which local axis follows the normal.
  pin(obj, v, lift, { axis = 'z', dir = null } = {}) {
    const rn = this.restNormalOf(v);
    this.inner.add(obj);
    const part = { obj, v, lift, restN: rn, restQ: frame(dir || rn, axis), extra: new Quaternion() };
    this.parts.push(part);
    return part;
  }

  // Face parts sit on the front of the body: x across, y up, in body units.
  pinFace(obj, x, y, lift) {
    return this.pin(obj, this.nearest(x, y, null, new Vector3(0, 0, 1)), lift);
  }

  buildFace() {
    const s = sharedParts();
    const sp = this.sp;
    const H = this.body.height;
    const W = this.body.width;
    const eyeY = H * (sp.shape === 'bean' ? 0.5 : 0.48);
    const spread = Math.min(0.34, W * 0.17);
    this.eyeY = eyeY;
    this.eyes = [-1, 1].map((side) => {
      const g = new Group();
      const open = new Group();
      const e = new Mesh(s.eye, s.ink);
      const shine = new Mesh(s.shine, s.white);
      shine.position.set(0.03, 0.04, 0.05);
      const shine2 = new Mesh(s.shine2, s.white);
      shine2.position.set(-0.032, -0.04, 0.05);
      open.add(e, shine, shine2);
      const closed = new Mesh(s.happy, s.ink);
      closed.visible = false;
      g.add(open, closed);
      g.userData = { open, closed };
      this.pinFace(g, side * spread, eyeY, 0.02);
      return g;
    });
    for (const side of [-1, 1]) {
      const b = new Mesh(s.blush, s.blushMat);
      this.pinFace(b, side * (spread + 0.16), eyeY - 0.12, 0.012);
    }
    const nose = new Mesh(s.nose, new MeshPhysicalMaterial({ color: sp.nose, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }));
    this.pinFace(nose, 0, eyeY - 0.075, 0.018);
    this.mouth = new Group();
    this.mouthLine = new Mesh(s.tubes.smile, s.ink);
    this.mouthFill = new Mesh(s.fills.grin, s.mouthInk);
    this.mouthFill.position.z = -0.004;
    // A short line from the nose down to the mouth, so the two read as one.
    const philtrum = new Mesh(s.philtrum, s.ink);
    this.mouth.add(this.mouthLine, this.mouthFill, philtrum);
    this.mouth.scale.setScalar(0.8);
    this.pinFace(this.mouth, 0, eyeY - 0.14, 0.016);
    if (sp.whiskers) {
      const mat = new MeshBasicMaterial({ color: sp.whiskers, transparent: true, opacity: 0.75 });
      for (const side of [-1, 1]) {
        const g = new Group();
        for (let k = 0; k < 3; k++) {
          const w = new Mesh(s.whisker, mat);
          w.rotation.z = (k - 1) * 0.22;
          w.position.y = (k - 1) * 0.025;
          g.add(w);
        }
        g.scale.x = side;
        this.pinFace(g, side * (spread + 0.12), eyeY - 0.09, 0.008);
      }
    }
  }

  buildEars() {
    const sp = this.sp;
    const e = EARS[sp.ear];
    if (!e) return;
    const W = this.body.width;
    const H = this.body.height;
    const outerMat = softMaterial(sp.earColor || sp.fur);
    const innerMat = softMaterial(sp.inner, { sheen: 0.6 });
    const outerGeo = e.outer();
    const innerGeo = e.inner();
    this.ears = [-1, 1].map((side) => {
      const g = new Group();
      g.scale.setScalar(1.25);
      const o = new Mesh(outerGeo, outerMat);
      const i = new Mesh(innerGeo, innerMat);
      i.position.set(...e.innerAt);
      o.castShadow = true;
      g.add(o, i);
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
    if (!MOUTHS[name]) return;
    const s = sharedParts();
    this.expression = name;
    this.mouthLine.geometry = s.tubes[name];
    this.mouthFill.visible = !!s.fills[name];
    if (s.fills[name]) this.mouthFill.geometry = s.fills[name];
    const happy = name === 'grin';
    for (const e of this.eyes) {
      e.userData.open.visible = !happy;
      e.userData.closed.visible = happy;
    }
  }

  // Squash hello: little hop in place.
  poke(strength = 1) {
    this.body.impulse(0, this.body.height * 0.6, 0.6, 0, -0.3, -1, 2.2 * strength, 0.45);
    this.body.kickAll((Math.random() - 0.5) * 1.2, 1.3 * strength, -0.6);
    this.earFlick = 1;
  }

  hopTo(target, duration = 0.55, height = 1.2) {
    return new Promise((resolve) => {
      this.hop = { from: this.group.position.clone(), to: target.clone(), t: 0, duration, height, resolve };
      this.body.kickAll(0, -1.6, 0);
    });
  }

  celebrate() {
    const s = sharedParts();
    for (let i = 0; i < 5; i++) {
      const h = new Sprite(s.heart);
      h.scale.setScalar(0.3);
      h.position.set((Math.random() - 0.5) * 0.9, this.body.height * 0.95, 0.3);
      h.userData = { vy: 0.9 + Math.random() * 0.6, vx: (Math.random() - 0.5) * 0.5, life: 0, delay: i * 0.12 };
      h.visible = false;
      this.inner.add(h);
      this.hearts.push(h);
    }
    this.setExpression('grin');
    this.body.kickAll(0, -2.4, 0);
    this.earFlick = 1.4;
  }

  update(dt) {
    this.time += dt;
    const b = this.body;
    // Waiting too long: sag, droop the ears, lose the smile.
    b.userMode[1] = 0.16 * this.impatience;
    if (this.hop) {
      const h = this.hop;
      h.t = Math.min(1, h.t + dt / h.duration);
      const k = h.t;
      this.group.position.lerpVectors(h.from, h.to, k);
      this.inner.position.y = Math.sin(Math.PI * k) * h.height;
      if (k === 1) {
        this.hop = null;
        this.inner.position.y = 0;
        b.kickAll(0, 2.4, 0);
        this.earFlick = 1;
        h.resolve();
      }
    }
    this.squishy.step(dt);

    this.earFlick = Math.max(0, (this.earFlick || 0) - dt * 2.5);
    const flick = Math.sin(this.time * 26) * this.earFlick * 0.18;
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
        p.extra.setFromAxisAngle(new Vector3(0, 0, 1), -p.side * (droop * 0.9 + flick));
        p.obj.quaternion.multiply(p.extra);
        p.extra.setFromAxisAngle(new Vector3(1, 0, 0), -droop * 0.5);
        p.obj.quaternion.multiply(p.extra);
      }
    }
    // Blink.
    this.blinkAt -= dt;
    const closing = this.blinkAt < 0 ? Math.max(0.08, Math.abs(this.blinkAt + 0.07) / 0.07) : 1;
    if (this.blinkAt < -0.14) this.blinkAt = 2 + Math.random() * 4;
    for (const e of this.eyes) e.userData.open.scale.y = Math.min(1, closing) * (this.impatience > 0.7 ? 0.6 : 1);
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
  }
}

// A guest at the counter.
export class Customer extends Critter {
  constructor(look, seed = 1) {
    super(look.species, seed);
    this.look = look;
  }
}

// The sous chef: a shiba in a little chef's toque.
export class SousChef extends Critter {
  constructor() {
    super('shiba', 3);
    const H = this.body.height;
    const hat = new Group();
    const white = softMaterial('#fbf8f2', { sheen: 0.8, roughness: 0.7, clearcoat: 0 });
    const band = new Mesh(new CylinderGeometry(0.3, 0.32, 0.2, 32), white);
    band.position.y = 0.1;
    hat.add(band);
    const puffs = [[0, 0.36, 0, 0.3], [0.17, 0.3, 0.05, 0.2], [-0.17, 0.3, 0.05, 0.2], [0, 0.3, -0.16, 0.2], [0.08, 0.5, 0.04, 0.2], [-0.1, 0.48, -0.04, 0.2]];
    for (const [x, y, z, r] of puffs) {
      const m = new Mesh(new IcosahedronGeometry(r, 3), white);
      m.position.set(x, y, z);
      m.castShadow = true;
      hat.add(m);
    }
    const v = this.nearest(0.08, H, -0.05, new Vector3(0, 1, 0), 0.5);
    this.pin(hat, v, -0.06, { axis: 'y', dir: new Vector3(0.12, 1, -0.15).normalize() });
  }
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
