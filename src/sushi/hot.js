import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Object3D,
  Shape,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { LAYOUT, UDON } from './config.js';
import { bakeFoodCoords, foodMaterial, plain } from './materials.js';
import { mulberry } from './set.js';

// Stove food: udon in a bowl of dashi, gyoza that fold, pleat and brown, and
// the little two-burner stove they cook on. Everything is built here from
// code, like the rest of the bar.

const _o = new Object3D();
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Shared materials, made once.
let HM = null;
function hm() {
  if (HM) return HM;
  HM = {
    dashi: new MeshPhysicalMaterial({ color: '#d9a85c', roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.86, specularIntensity: 1 }),
    water: new MeshPhysicalMaterial({ color: '#b6d6dc', roughness: 0.03, clearcoat: 1, transparent: true, opacity: 0.5, depthWrite: false }),
    kamaboko: new MeshPhysicalMaterial({ color: '#fbf6ee', roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.2, sheen: 0.5, sheenColor: new Color('#ffffff') }),
    kamabokoPink: new MeshPhysicalMaterial({ color: '#ff7a9a', roughness: 0.32, clearcoat: 0.5 }),
    aburaage: new MeshPhysicalMaterial({ color: '#d08835', roughness: 0.4, clearcoat: 0.9, clearcoatRoughness: 0.18, sheen: 0.4, sheenColor: new Color('#ffd28a') }),
    batter: new MeshPhysicalMaterial({ color: '#f0bf62', roughness: 0.6, sheen: 0.6, sheenColor: new Color('#fff0b8'), clearcoat: 0.25, clearcoatRoughness: 0.4 }),
    tail: new MeshPhysicalMaterial({ color: '#ec4b2a', roughness: 0.3, clearcoat: 0.9 }),
    scallion: plain.scallion(),
    ringGeo: new TorusGeometry(0.07, 0.022, 8, 22),
    filling: new MeshPhysicalMaterial({ color: '#d99a84', roughness: 0.55, sheen: 0.3, sheenColor: new Color('#ffd9c8') }),
    steel: plain.steel(),
    iron: new MeshPhysicalMaterial({ color: '#2e2a28', metalness: 0.5, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3 }),
    enamel: new MeshPhysicalMaterial({ color: '#f2e9da', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 }),
    top: new MeshPhysicalMaterial({ color: '#2a2725', metalness: 0.35, roughness: 0.4, clearcoat: 0.6 }),
    grate: new MeshPhysicalMaterial({ color: '#1a1817', metalness: 0.6, roughness: 0.5 }),
    knob: new MeshPhysicalMaterial({ color: '#e2483a', roughness: 0.25, clearcoat: 1 }),
    wood: plain.handle(),
    sauce: plain.sauce(),
    flame: new MeshBasicMaterial({ color: new Color(0.7, 1.6, 6), transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
    flameCore: new MeshBasicMaterial({ color: new Color(3, 4, 6), transparent: true, opacity: 0.7, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
  };
  return HM;
}

function glazed(geo, glaze) {
  geo.setAttribute('aFood', new BufferAttribute(bakeFoodCoords(geo, 1), 3));
  const m = new Mesh(geo, foodMaterial(glaze));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function shade(mesh, cast = true, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

// ---------------------------------------------------------------------------
// Udon noodles: thick, glossy, a little translucent once cooked. raw -> 0,
// cooked -> 1 moves the color from floury to glossy white.

export function noodleMaterial() {
  return new MeshPhysicalMaterial({ color: '#e8d9b8', roughness: 0.7, clearcoat: 0.1, clearcoatRoughness: 0.4, sheen: 0.5, sheenColor: new Color('#ffffff'), sheenRoughness: 0.4 });
}

const RAW = new Color('#e8d9b8');
const COOKED = new Color('#fbf6ea');
export function setNoodleCook(mat, k) {
  mat.color.copy(RAW).lerp(COOKED, Math.min(1, k));
  mat.roughness = 0.7 - 0.45 * Math.min(1, k);
  mat.clearcoat = 0.1 + 0.75 * Math.min(1, k);
}

// A nest of noodles inside a radius profile: rOf(y) is the space available
// at height y. Each noodle is a lazy spiral.
function noodleNest(seed, { count, rOf, y0, y1, radius = 0.055, turns = 1.2 }) {
  const rand = mulberry(seed);
  const geos = [];
  for (let i = 0; i < count; i++) {
    const pts = [];
    const a0 = rand() * Math.PI * 2;
    const dir = rand() < 0.5 ? -1 : 1;
    const steps = 8;
    const r0 = 0.25 + rand() * 0.55;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const y = y0 + (y1 - y0) * (0.25 + 0.75 * rand()) * (0.6 + 0.4 * Math.sin(t * Math.PI));
      const room = Math.max(0.1, rOf(y) - radius * 2.2);
      const r = Math.min(room, room * (r0 + 0.35 * Math.sin(t * 5 + i)));
      const a = a0 + dir * t * turns * Math.PI * 2 * 0.5;
      pts.push(new Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
    }
    geos.push(new TubeGeometry(new CatmullRomCurve3(pts), 36, radius, 6));
  }
  const g = mergeGeometries(geos);
  for (const x of geos) x.dispose();
  return g;
}

// The noodles in the pot: a loose tangle that swirls when stirred.
export function potNoodles(mat, seed = 7) {
  return shade(new Mesh(noodleNest(seed, { count: 14, rOf: () => 1.15, y0: 0.35, y1: 1.05, turns: 1.6 }), mat), true, false);
}

// ---------------------------------------------------------------------------
// The donburi and what goes in it.

// Thrown donburi profile: foot ring, curved wall, rolled rim. INNER is the
// wall the broth meets, as [radius, height] pairs.
const BOWL_PROFILE = [
  [0, 0.05], [0.5, 0.05], [0.52, 0], [0.62, 0], [0.64, 0.08], [0.95, 0.3], [1.2, 0.62], [1.35, 0.95], [1.38, 1.0], [1.33, 1.0],
  [1.29, 0.93], [1.15, 0.62], [0.92, 0.33], [0.55, 0.16], [0, 0.14],
];
const INNER = [[0, 0.14], [0.55, 0.16], [0.92, 0.33], [1.15, 0.62], [1.29, 0.93]];
function innerRadius(y) {
  for (let i = 1; i < INNER.length; i++) {
    const [r0, y0] = INNER[i - 1];
    const [r1, y1] = INNER[i];
    if (y <= y1) return r0 + ((r1 - r0) * Math.max(0, y - y0)) / (y1 - y0);
  }
  return INNER[INNER.length - 1][0];
}
// Broth height for a fill level 0..1.
export const brothY = (level) => 0.2 + level * 0.7;

let BOWL_GEO = null;
function bowlGeometry() {
  return (BOWL_GEO ||= new LatheGeometry(BOWL_PROFILE.map(([x, y]) => new Vector2(x, y)), 64));
}

let SHARED = null;
function sharedGeo() {
  if (SHARED) return SHARED;
  // Kamaboko: a D-shaped slice of fish cake with a pink rind.
  const d = new Shape();
  d.moveTo(-0.36, 0);
  d.lineTo(0.36, 0);
  d.absarc(0, 0, 0.36, 0, Math.PI, false);
  const body = new ExtrudeGeometry(d, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 20 });
  body.scale(1, 0.78, 1);
  const rind = new Shape();
  rind.absarc(0, 0, 0.41, 0, Math.PI, false);
  rind.absarc(0, 0, 0.355, Math.PI, 0, true);
  const pink = new ExtrudeGeometry(rind, { depth: 0.07, bevelEnabled: false, curveSegments: 20 });
  pink.scale(1, 0.78, 1);
  pink.translate(0, 0, 0.005);
  // Aburaage: a soft, wrinkled square of fried tofu.
  const age = new RoundedBoxGeometry(0.95, 0.16, 0.72, 4, 0.07);
  const ap = age.attributes.position.array;
  for (let i = 0; i < ap.length; i += 3) ap[i + 1] += 0.025 * Math.sin(ap[i] * 11) * Math.cos(ap[i + 2] * 9) + 0.02 * Math.sin(ap[i] * 4 + ap[i + 2] * 5);
  age.computeVertexNormals();
  // Ebi tempura: a curled, crunchy shrimp with a red tail.
  const curve = new CatmullRomCurve3([new Vector3(-0.75, 0, 0.05), new Vector3(-0.35, 0.07, -0.08), new Vector3(0.1, 0.09, -0.06), new Vector3(0.5, 0.05, 0.05), new Vector3(0.72, 0.02, 0.18)]);
  const segs = 48;
  const rad = 10;
  const shrimp = new TubeGeometry(curve, segs, 0.2, rad, false);
  const sp = shrimp.attributes.position.array;
  const rand = mulberry(41);
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const c = curve.getPointAt(t);
    const taper = Math.pow(Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.5 + 0.12), 0.6) * (1 - 0.55 * t);
    for (let j = 0; j <= rad; j++) {
      const k = (i * (rad + 1) + j) * 3;
      const crunch = 1 + (rand() - 0.5) * 0.35;
      sp[k] = c.x + (sp[k] - c.x) * taper * crunch;
      sp[k + 1] = c.y + (sp[k + 1] - c.y) * taper * crunch;
      sp[k + 2] = c.z + (sp[k + 2] - c.z) * taper * crunch;
    }
  }
  shrimp.computeVertexNormals();
  const tail = new ConeGeometry(0.16, 0.34, 10);
  tail.scale(1, 1, 0.35);
  tail.rotateZ(-Math.PI / 2);
  tail.translate(0.86, 0.02, 0.22);
  SHARED = { kamaboko: body, rind: pink, age, shrimp, tail };
  return SHARED;
}

// A bowl of udon. Starts empty; noodles, dashi and toppings go in as the
// player makes it. ideal() builds a finished bowl for photos.
export class UdonBowl {
  constructor(kind, seed = 3) {
    this.kind = kind;
    this.seed = seed;
    this.group = new Group();
    this.group.add(glazed(bowlGeometry().clone(), kind === 'kitsune' ? 'glazeTenmoku' : 'glazeIndigo'));
    this.noodleMat = noodleMaterial();
    setNoodleCook(this.noodleMat, 1);
    this.noodles = shade(new Mesh(noodleNest(seed, { count: 16, rOf: innerRadius, y0: 0.24, y1: 0.78 }), this.noodleMat));
    this.noodles.visible = false;
    this.group.add(this.noodles);
    this.broth = new Mesh(new CircleGeometry(1, 48), hm().dashi);
    this.broth.rotation.x = -Math.PI / 2;
    this.broth.visible = false;
    this.broth.receiveShadow = true;
    this.group.add(this.broth);
    this.level = 0;
    this.tops = {};
    this.pops = [];
  }

  setLevel(level) {
    this.level = Math.max(0, Math.min(1.05, level));
    const y = brothY(Math.min(1, this.level));
    this.broth.visible = this.level > 0.02;
    this.broth.position.y = y;
    const r = innerRadius(y) - 0.01;
    this.broth.scale.set(r, r, 1);
  }

  showNoodles(cook = 1) {
    setNoodleCook(this.noodleMat, cook);
    this.noodles.visible = true;
  }

  // Toppings float at the broth line, or sit on the noodles if there is little.
  surface() {
    return Math.max(brothY(Math.min(1, this.level)), 0.62);
  }

  addTopping(k, instant = false) {
    if (this.tops[k]) return false;
    const m = hm();
    const g = sharedGeo();
    const y = this.surface();
    const grp = new Group();
    if (k === 'kamaboko') {
      for (const [x, z, r] of [[0.48, 0.42, 0.5], [0.66, 0.08, 0.2]]) {
        const s = new Group();
        s.add(shade(new Mesh(g.kamaboko, m.kamaboko)), shade(new Mesh(g.rind, m.kamabokoPink)));
        s.position.set(x, y + 0.04, z);
        s.rotation.set(-1.25, r, 0.1);
        grp.add(s);
      }
    } else if (k === 'scallion') {
      const n = 22;
      const rings = new InstancedMesh(m.ringGeo, m.scallion, n);
      const rand = mulberry(this.seed * 9 + 2);
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2;
        const rr = Math.sqrt(rand()) * 0.36;
        _o.position.set(-0.45 + Math.cos(a) * rr, y + 0.03 + rand() * 0.05, -0.25 + Math.sin(a) * rr);
        _o.rotation.set(Math.PI / 2 + (rand() - 0.5) * 0.9, rand() * 6, (rand() - 0.5) * 0.9);
        _o.scale.setScalar(0.85 + rand() * 0.4);
        _o.updateMatrix();
        rings.setMatrixAt(i, _o.matrix);
      }
      rings.castShadow = true;
      grp.add(rings);
    } else if (k === 'aburaage') {
      const a = shade(new Mesh(g.age, m.aburaage));
      a.position.set(0.02, y + 0.06, -0.42);
      a.rotation.set(0.12, 0.35, -0.06);
      grp.add(a);
    } else if (k === 'tempura') {
      const s = new Group();
      s.add(shade(new Mesh(g.shrimp, m.batter)), shade(new Mesh(g.tail, m.tail)));
      s.position.set(-0.05, y + 0.14, 0.05);
      s.rotation.set(0.08, -0.55, 0.06);
      grp.add(s);
    } else return false;
    this.tops[k] = grp;
    this.group.add(grp);
    if (!instant) {
      grp.scale.setScalar(0.01);
      this.pops.push({ obj: grp, t: 0 });
    }
    return true;
  }

  // Slurp: the noodles and toppings go, a little broth stays.
  eat(frac) {
    const s = Math.max(0.001, 1 - frac);
    this.noodles.scale.set(1, s, 1);
    for (const g of Object.values(this.tops)) g.scale.setScalar(s);
    this.setLevel(Math.min(this.level, 0.25 + 0.6 * s));
  }

  update(dt) {
    for (const p of this.pops) {
      p.t = Math.min(1, p.t + dt / 0.35);
      const k = p.t;
      const back = 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2;
      p.obj.scale.setScalar(Math.max(0.01, back));
    }
    this.pops = this.pops.filter((p) => p.t < 1);
  }

  dispose() {
    this.noodles.geometry.dispose();
    this.broth.geometry.dispose();
    this.noodleMat.dispose();
  }

  static ideal(kind, seed = 5) {
    const b = new UdonBowl(kind, seed);
    b.showNoodles(1);
    b.setLevel(0.76);
    for (const t of UDON[kind].toppings) b.addTopping(t, true);
    return b;
  }
}

// ---------------------------------------------------------------------------
// Gyoza: one grid that is a flat round wrapper at fold 0 and a pleated
// crescent dumpling at fold 1. Each pleat adds a ruffle on the front of the
// ridge. The bottom browns in the pan.

const GU = 30;
const GV = 20;
const GR = 0.62; // half length
const PLEATS = 5;

function wrapperMaterial() {
  const m = new MeshPhysicalMaterial({ color: '#f6eedc', roughness: 0.46, sheen: 0.7, sheenColor: new Color('#ffffff'), sheenRoughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.3, side: DoubleSide });
  const brown = { value: 0 };
  m.userData.brown = brown;
  m.onBeforeCompile = (s) => {
    s.uniforms.uBrown = brown;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLocal;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLocal;\nuniform float uBrown;').replace(
      '#include <color_fragment>',
      `#include <color_fragment>
{
  // The flat bottom browns first, in patches; a little color creeps up.
  float bottom = 1.0 - smoothstep(0.02, 0.14, vLocal.y);
  vec2 cell = floor(vLocal.xz * 28.0);
  float n = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
  float b = uBrown * (bottom * (0.8 + 0.4 * n) + 0.12 * (1.0 - smoothstep(0.1, 0.3, vLocal.y)));
  vec3 golden = vec3(0.62, 0.3, 0.07);
  vec3 dark = vec3(0.16, 0.07, 0.02);
  diffuseColor.rgb = mix(diffuseColor.rgb, golden, smoothstep(0.05, 0.85, b));
  diffuseColor.rgb = mix(diffuseColor.rgb, dark, smoothstep(0.95, 1.45, b));
}`,
    );
  };
  m.customProgramCacheKey = () => 'gyoza-wrapper';
  return m;
}

export class Gyoza {
  constructor() {
    this.fold = 0;
    this.foldTo = 0;
    this.pleatAmp = new Float32Array(PLEATS);
    this.pleatTo = new Float32Array(PLEATS);
    this.fillAmount = 0;
    this.wob = 0;
    this.wobV = 0;
    const n = GU * GV;
    this.pos = new Float32Array(n * 3);
    const idx = [];
    for (let i = 0; i < GU - 1; i++) {
      for (let j = 0; j < GV - 1; j++) {
        const a = i * GV + j;
        const b = a + GV;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    this.geo = new BufferGeometry();
    this.geo.setIndex(idx);
    this.geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    this.material = wrapperMaterial();
    this.mesh = shade(new Mesh(this.geo, this.material));
    this.filling = shade(new Mesh(new IcosahedronGeometry(0.3, 3), hm().filling), true, false);
    this.filling.scale.setScalar(0.001);
    this.body = new Group();
    this.body.add(this.mesh, this.filling);
    this.group = new Group();
    this.group.add(this.body);
    this.dirty = true;
    this.rebuild();
  }

  point(u, v, out, o) {
    const w = Math.sqrt(Math.max(0, 1 - u * u));
    // Flat wrapper.
    const fx = GR * u;
    const fy = 0.012;
    const fz = GR * v * w;
    // Folded dumpling. s: 0 at the bottom center line, 1 at the ridge.
    const s = Math.abs(v);
    const side = v >= 0 ? 1 : -1;
    const phi = s * Math.PI;
    const D = 0.3 * Math.pow(w, 0.7);
    const H = 0.46 * Math.pow(w, 0.55);
    let y = (H * (1 - Math.cos(phi))) / 2;
    let z = side * D * Math.sin(phi) * (phi < Math.PI / 2 ? 1.14 : 1);
    const x = GR * u * (1 - 0.05 * Math.sin(phi));
    // A crescent: the middle sits forward of the tips.
    z += 0.12 * (1 - u * u);
    // Pleats ruffle the front of the ridge.
    if (side > 0) {
      let amp = 0;
      for (let p = 0; p < PLEATS; p++) {
        const c = -0.72 + (1.44 * p) / (PLEATS - 1);
        amp += this.pleatAmp[p] * Math.exp(-(((u - c) / 0.12) ** 2));
      }
      const top = smooth(0.6, 1, s);
      z += 0.075 * amp * top;
      y -= 0.03 * amp * top;
    }
    const f = smooth(0, 1, this.fold);
    out[o] = fx + (x - fx) * f;
    out[o + 1] = fy + (y - fy) * f;
    out[o + 2] = fz + (z - fz) * f;
  }

  rebuild() {
    for (let i = 0; i < GU; i++) {
      const u = -1 + (2 * i) / (GU - 1);
      for (let j = 0; j < GV; j++) {
        const v = -1 + (2 * j) / (GV - 1);
        this.point(u, v, this.pos, (i * GV + j) * 3);
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
    this.dirty = false;
    // The filling sits on the wrapper, then gets tucked in as it folds.
    const f = smooth(0, 1, this.fold);
    const a = this.fillAmount;
    const s = Math.max(0.001, a);
    this.filling.scale.set(s * (1.25 - 0.15 * f), s * (0.6 - 0.05 * f), s * (0.85 - 0.25 * f));
    this.filling.position.set(0, 0.03 + s * 0.12 + f * 0.06, f * 0.1);
  }

  setFill(a) {
    this.fillAmount = a;
    this.dirty = true;
  }

  setFold(f) {
    this.foldTo = f;
  }

  pleat(i, amount = 1) {
    this.pleatTo[i] = amount;
    this.poke(0.8);
  }

  poke(a = 1) {
    this.wobV += a * 6;
  }

  setBrown(b) {
    this.material.userData.brown.value = b;
  }

  update(dt) {
    if (Math.abs(this.foldTo - this.fold) > 1e-3) {
      this.fold += (this.foldTo - this.fold) * Math.min(1, dt * 10);
      this.dirty = true;
    }
    for (let p = 0; p < PLEATS; p++) {
      if (Math.abs(this.pleatTo[p] - this.pleatAmp[p]) > 1e-3) {
        this.pleatAmp[p] += (this.pleatTo[p] - this.pleatAmp[p]) * Math.min(1, dt * 14);
        this.dirty = true;
      }
    }
    if (this.dirty) this.rebuild();
    // Jelly wobble on pinches and landings.
    this.wobV += (-this.wob * 160 - this.wobV * 9) * dt;
    this.wob += this.wobV * dt;
    const w = Math.max(-0.3, Math.min(0.3, this.wob * 0.05));
    this.body.scale.set(1 + w * 0.6, 1 - w, 1 + w * 0.6);
  }

  dispose() {
    this.geo.dispose();
    this.material.dispose();
    this.filling.geometry.dispose();
  }

  static ideal() {
    const g = new Gyoza();
    g.fillAmount = 0.62;
    g.fold = g.foldTo = 1;
    g.pleatAmp.fill(1);
    g.pleatTo.fill(1);
    g.setBrown(0.68);
    g.rebuild();
    return g;
  }
}

// Gyoza plated browned side up, with a dish of dipping sauce.
let PLATE_GEO = null;
export class GyozaPlate {
  constructor(gyozas) {
    this.group = new Group();
    PLATE_GEO ||= (() => {
      const g = new LatheGeometry([[0, 0.04], [0.85, 0.04], [0.88, 0], [0.98, 0], [1.0, 0.04], [1.18, 0.13], [1.24, 0.17], [1.2, 0.18], [1.1, 0.12], [0.9, 0.08], [0, 0.07]].map(([x, y]) => new Vector2(x, y)), 56);
      g.scale(1.3, 1, 0.82);
      return g;
    })();
    this.group.add(glazed(PLATE_GEO.clone(), 'glazeWhite'));
    const dish = glazed(new LatheGeometry([[0, 0.02], [0.2, 0.02], [0.24, 0], [0.3, 0], [0.33, 0.12], [0.31, 0.13], [0.27, 0.06], [0, 0.05]].map(([x, y]) => new Vector2(x, y)), 32), 'glazeIndigo');
    dish.position.set(1.15, 0, 0.55);
    const sauce = new Mesh(new CircleGeometry(0.26, 24), hm().sauce);
    sauce.rotation.x = -Math.PI / 2;
    sauce.position.y = 0.09;
    dish.add(sauce);
    this.group.add(dish);
    this.gyozas = gyozas;
    gyozas.forEach((gz, i) => this.seat(gz, i, gyozas.length));
  }

  // Overlapping, browned bottoms up, the way they come out of the pan.
  seat(gz, i, n) {
    const x = (i - (n - 1) / 2) * 0.62;
    gz.group.position.set(x - 0.15, 0.07 + 0.46, 0.02 * i);
    gz.group.rotation.set(Math.PI, Math.PI / 2 + 0.25, -0.12);
    this.group.add(gz.group);
  }

  update(dt) {
    for (const g of this.gyozas) g.update(dt);
  }

  dispose() {
    for (const g of this.gyozas) g.dispose();
  }

  static ideal() {
    return new GyozaPlate([Gyoza.ideal(), Gyoza.ideal(), Gyoza.ideal()]);
  }
}

// ---------------------------------------------------------------------------
// The stove: a cream enamel two-burner with a pot of water on the left and
// an iron pan on the right, a board for folding gyoza, a ladle and a lid.

function puffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(48, 48, 0, 48, 48, 48);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 96, 96);
  return new CanvasTexture(c);
}

// Rising wisps over a spot. strength 0..1 sets how much.
class Steam {
  constructor(n, spread) {
    const tex = puffTexture();
    this.group = new Group();
    this.puffs = [];
    const rand = mulberry(n * 7 + 3);
    for (let i = 0; i < n; i++) {
      const s = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
      s.userData = { x: (rand() - 0.5) * spread, z: (rand() - 0.5) * spread * 0.6, offset: rand() * 3, life: 2 + rand() * 1.2, size: 0.7 + rand() * 0.6 };
      this.group.add(s);
      this.puffs.push(s);
    }
    this.strength = 0;
  }

  update(t) {
    for (const s of this.puffs) {
      const d = s.userData;
      const a = ((t + d.offset) % d.life) / d.life;
      s.position.set(d.x + Math.sin(t * 0.7 + d.offset) * 0.25 * a, a * 2.6, d.z);
      s.scale.setScalar(d.size * (0.5 + a * 1.4));
      s.material.opacity = Math.sin(Math.PI * a) ** 1.5 * 0.28 * this.strength;
      s.visible = this.strength > 0.01;
    }
  }
}

export class Stove {
  constructor() {
    const L = LAYOUT.stove;
    const m = hm();
    this.group = new Group();
    const top = L.top;
    // Body.
    const body = shade(new Mesh(new RoundedBoxGeometry(7.8, top, 2.9, 4, 0.14), m.enamel));
    body.position.set(L.x, top / 2, L.z);
    const plate = shade(new Mesh(new RoundedBoxGeometry(7.4, 0.06, 2.5, 2, 0.03), m.top), false, true);
    plate.position.set(L.x, top + 0.01, L.z);
    this.group.add(body, plate);
    // Knobs on the front.
    for (const [x] of [L.pot, L.pan]) {
      const k = shade(new Mesh(new CylinderGeometry(0.16, 0.18, 0.14, 20), m.knob));
      k.rotation.x = Math.PI / 2;
      k.position.set(x, top * 0.5, L.z + 1.5);
      this.group.add(k);
    }
    // Burners: a ring, a grate and a crown of flames each.
    this.flames = [];
    const flameGeo = new ConeGeometry(0.07, 0.34, 6, 1, true);
    flameGeo.translate(0, 0.17, 0);
    for (const [x, z] of [L.pot, L.pan]) {
      const ring = shade(new Mesh(new TorusGeometry(0.5, 0.06, 8, 32), m.grate), false, true);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, top + 0.06, z);
      this.group.add(ring);
      for (let k = 0; k < 4; k++) {
        const bar = shade(new Mesh(new RoundedBoxGeometry(1.7, 0.06, 0.08, 1, 0.02), m.grate));
        bar.rotation.y = (k * Math.PI) / 4;
        bar.position.set(x, top + 0.1, z);
        this.group.add(bar);
      }
      const crown = new Group();
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        const f = new Mesh(flameGeo, m.flame);
        f.position.set(Math.cos(a) * 0.48, 0, Math.sin(a) * 0.48);
        f.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
        f.userData.phase = k * 1.7;
        crown.add(f);
      }
      crown.position.set(x, top + 0.04, z);
      crown.visible = false;
      this.group.add(crown);
      this.flames.push(crown);
    }
    // Pot with water.
    const pot = new Group();
    const potGeo = new LatheGeometry([[0, 0.02], [1.32, 0.02], [1.42, 0.08], [1.45, 1.5], [1.5, 1.55], [1.4, 1.55], [1.38, 1.5], [1.36, 0.1], [0, 0.1]].map(([x, y]) => new Vector2(x, y)), 48);
    pot.add(shade(new Mesh(potGeo, m.steel)));
    for (const s of [-1, 1]) {
      const h = shade(new Mesh(new TorusGeometry(0.22, 0.05, 8, 16, Math.PI), m.steel));
      h.position.set(s * 1.5, 1.25, 0);
      h.rotation.set(0, s > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
      pot.add(h);
    }
    this.water = new Mesh(new CircleGeometry(1.36, 40), m.water);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = 1.12;
    pot.add(this.water);
    // Bubbles: small domes that rise and pop at the surface.
    this.bubbles = new InstancedMesh(new SphereGeometry(0.06, 8, 6), m.water, 30);
    this.bubbles.count = 0;
    this.bubbleState = Array.from({ length: 30 }, (_, i) => ({ x: 0, z: 0, t: Math.random(), speed: 0.6 + Math.random() * 0.8, seed: i }));
    pot.add(this.bubbles);
    pot.position.set(L.pot[0], top + 0.12, L.pot[1]);
    this.pot = pot;
    this.group.add(pot);
    // Pan, handle toward the chef.
    const pan = new Group();
    const panGeo = new LatheGeometry([[0, 0.02], [1.25, 0.02], [1.38, 0.08], [1.48, 0.32], [1.52, 0.34], [1.44, 0.34], [1.36, 0.12], [1.22, 0.07], [0, 0.07]].map(([x, y]) => new Vector2(x, y)), 48);
    pan.add(shade(new Mesh(panGeo, m.iron)));
    const arm = shade(new Mesh(new CylinderGeometry(0.07, 0.09, 1.2, 12), m.iron));
    arm.rotation.x = Math.PI / 2 - 0.25;
    arm.position.set(0.45, 0.4, 1.95);
    const grip = shade(new Mesh(new CylinderGeometry(0.11, 0.12, 1.1, 14), m.wood));
    grip.rotation.x = Math.PI / 2 - 0.25;
    grip.position.set(0.68, 0.6, 2.9);
    arm.rotation.z = 0.35;
    grip.rotation.z = 0.35;
    pan.add(arm, grip);
    pan.position.set(L.pan[0], top + 0.12, L.pan[1]);
    this.pan = pan;
    this.group.add(pan);
    // Lid, waiting above the pan.
    this.lid = new Group();
    // A glass lid with a steel rim, so the steam shows inside.
    const glass = new MeshPhysicalMaterial({ color: '#eef6f8', roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.28, depthWrite: false, side: DoubleSide, specularIntensity: 1 });
    const dome = new Mesh(new SphereGeometry(2.05, 48, 14, 0, Math.PI * 2, 0, 0.78), glass);
    dome.position.y = -2.05 * Math.cos(0.78);
    const rim = shade(new Mesh(new TorusGeometry(2.05 * Math.sin(0.78), 0.05, 8, 48), m.steel));
    rim.rotation.x = Math.PI / 2;
    const knob = shade(new Mesh(new CylinderGeometry(0.13, 0.17, 0.2, 16), m.wood));
    knob.position.y = 2.05 * (1 - Math.cos(0.78)) + 0.08;
    this.lid.add(dome, rim, knob);
    this.lidHome = new Vector3(L.pan[0] + 2.2, 5.5, L.pan[1] - 1.5);
    this.lidOn = new Vector3(L.pan[0], top + 0.12 + 0.34, L.pan[1]);
    this.lid.position.copy(this.lidHome);
    this.lid.visible = false;
    this.group.add(this.lid);
    // Folding board for gyoza.
    const board = shade(new Mesh(new CylinderGeometry(1.15, 1.2, 0.16, 40), m.wood), true, true);
    board.position.set(L.prep[0], 0.08, L.prep[1]);
    this.group.add(board);
    // Ladle for the dashi.
    this.ladle = new Group();
    const cupMat = m.steel.clone();
    cupMat.side = DoubleSide;
    const cup = shade(new Mesh(new SphereGeometry(0.42, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), cupMat));
    const stick = shade(new Mesh(new CylinderGeometry(0.045, 0.045, 2.4, 10), m.wood));
    stick.position.set(0, 0.95, 0.75);
    stick.rotation.x = -0.75;
    this.ladleDashi = new Mesh(new CircleGeometry(0.38, 24), m.dashi);
    this.ladleDashi.rotation.x = -Math.PI / 2;
    this.ladleDashi.position.y = -0.06;
    this.ladle.add(cup, stick, this.ladleDashi);
    this.stream = new Mesh(new CylinderGeometry(0.05, 0.07, 1, 10, 1, true), m.dashi);
    this.stream.visible = false;
    this.group.add(this.stream);
    this.ladle.visible = false;
    this.group.add(this.ladle);
    // Steam over the pot and the pan.
    this.potSteam = new Steam(9, 1.6);
    this.potSteam.group.position.set(L.pot[0], top + 1.8, L.pot[1]);
    this.panSteam = new Steam(9, 1.8);
    this.panSteam.group.position.set(L.pan[0], top + 0.6, L.pan[1]);
    this.group.add(this.potSteam.group, this.panSteam.group);
    this.boil = 0; // 0..1 how hard the pot is boiling
    this.time = 0;
  }

  setFlame(i, on) {
    this.flames[i].visible = on;
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    for (const crown of this.flames) {
      if (!crown.visible) continue;
      for (const f of crown.children) f.scale.set(1, 0.75 + 0.35 * Math.sin(t * 23 + f.userData.phase) * Math.sin(t * 7.3 + f.userData.phase * 2), 1);
    }
    // Bubbles while boiling.
    const n = Math.round(30 * this.boil);
    this.bubbles.count = n;
    for (let i = 0; i < n; i++) {
      const b = this.bubbleState[i];
      b.t += dt * b.speed;
      if (b.t >= 1) {
        b.t = 0;
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * 1.2;
        b.x = Math.cos(a) * r;
        b.z = Math.sin(a) * r;
      }
      const s = 0.4 + Math.sin(b.t * Math.PI) * 0.9;
      _o.position.set(b.x, 1.1 + b.t * 0.05, b.z);
      _o.scale.set(s, s * 0.6, s);
      _o.rotation.set(0, 0, 0);
      _o.updateMatrix();
      this.bubbles.setMatrixAt(i, _o.matrix);
    }
    this.bubbles.instanceMatrix.needsUpdate = true;
    this.water.position.y = 1.12 + Math.sin(t * 9) * 0.01 * this.boil;
    this.potSteam.strength += (this.boil * 0.9 - this.potSteam.strength) * Math.min(1, dt * 2);
    this.potSteam.update(t);
    this.panSteam.update(t);
  }

  // Point the ladle at a bowl and show the stream while pouring.
  pour(at, on) {
    this.ladle.visible = on;
    this.stream.visible = on;
    if (!on) return;
    this.ladle.position.set(at.x - 0.75, at.y + 1.6, at.z - 0.2);
    this.ladle.rotation.set(0, 0, -0.85);
    const top = this.ladle.position.y - 0.15;
    const bottom = at.y;
    this.stream.position.set(at.x - 0.35, (top + bottom) / 2, at.z - 0.15);
    this.stream.scale.set(1, Math.max(0.05, top - bottom), 1);
  }
}

// Everything a stove dish needs compiled before play, for the warm-up pass.
export function warmHot() {
  const g = new Group();
  g.add(UdonBowl.ideal('tempura').group, UdonBowl.ideal('kitsune').group, GyozaPlate.ideal().group);
  return g;
}
