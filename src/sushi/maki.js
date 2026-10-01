import {
  BoxGeometry,
  CapsuleGeometry,
  BufferAttribute,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshPhysicalMaterial,
  Object3D,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { bakeFoodCoords, foodMaterial, plain, riceGrainGeometry, riceGrainMaterial } from './materials.js';
import { NOISE } from './glsl.js';

// Hosomaki: thin rolls. A nori sheet on the mat, rice spread over it, one
// filling, rolled up, cut into six and stood on the board cut face up.

export const FILLINGS = {
  kappa: { label: 'Cucumber', roll: 'Cucumber roll', core: '#2f7a1c', inner: '#cfeaa0', seeds: true, size: 0.4 },
  tekka: { label: 'Tuna', roll: 'Tuna roll', core: '#9a0e22', inner: '#d4404f', seeds: false, size: 0.48 },
  sake: { label: 'Salmon', roll: 'Salmon roll', core: '#ff4f12', inner: '#ff9a5a', seeds: false, size: 0.48 },
};

export const MAKI = {
  sheetX: 2.4, // rolling direction
  sheetZ: 2.5, // length of the roll
  radius: 0.4,
  pieces: 6,
};

const _o = new Object3D();
let M = null;
function mats() {
  if (M) return M;
  M = {
    nori: foodMaterial('nori'),
    rice: foodMaterial('rice'),
    grain: riceGrainMaterial(),
    grainGeo: riceGrainGeometry(CapsuleGeometry),
    cucumber: plain.cucumber(),
    tuna: foodMaterial('tuna', { transmission: 0.15 }),
    salmon: foodMaterial('salmon', { transmission: 0.15 }),
    faces: {},
  };
  return M;
}

function withFood(geo, scale = 1) {
  geo.setAttribute('aFood', new BufferAttribute(bakeFoodCoords(geo, scale), 3));
  return geo;
}

// The cut face: nori ring, packed rice, then the filling. Drawn from the
// circle's uv so every piece shows a clean cross section.
function faceMaterial(filling) {
  const m = mats();
  if (m.faces[filling]) return m.faces[filling];
  const f = FILLINGS[filling];
  const mat = new MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.5, clearcoat: 0.12, clearcoatRoughness: 0.3, specularIntensity: 0.7 });
  const uniforms = {
    uCore: { value: new Color(f.core) },
    uInner: { value: new Color(f.inner) },
    uSeeds: { value: f.seeds ? 1 : 0 },
    uSeed: { value: Math.random() * 10 },
    uSize: { value: f.size },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vMk;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMk = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec2 vMk;
uniform vec3 uCore, uInner;
uniform float uSeeds, uSeed, uSize;
${NOISE}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec2 q = vMk - 0.5;
  float r = length(q) * 2.0;
  float ang = atan(q.y, q.x);
  float wob = snoise(vec3(q * 5.0, uSeed)) * 0.05;
  // Filling: slightly off center, the way a real roll comes out.
  vec2 fc = q - vec2(0.05, -0.04);
  float fr = length(fc) * 2.0 + wob;
  // Packed rice: grains as elongated cells, each a little different in
  // brightness, with dark gaps between.
  vec3 gq = vec3(q * vec2(24.0, 30.0), uSeed);
  gq.xy = mat2(cos(1.1), -sin(1.1), sin(1.1), cos(1.1)) * gq.xy;
  vec2 g = worley(gq);
  float edge = smoothstep(0.02, 0.22, g.y - g.x);
  float tone = fract(sin(dot(floor(gq.xy * 1.0), vec2(12.9, 78.2))) * 43758.5);
  vec3 rice = mix(vec3(0.45, 0.42, 0.38), mix(vec3(0.9, 0.88, 0.84), vec3(1.0), tone), edge);
  vec3 col = rice;
  float fill = 1.0 - smoothstep(uSize - 0.03, uSize, fr);
  vec3 core;
  if (uSeeds > 0.5) {
    // Cucumber: dark green skin, pale flesh, a seeded center.
    core = mix(uCore, uInner, smoothstep(uSize - 0.05, uSize - 0.14, fr));
    float seedRing = smoothstep(0.2, 0.08, fr) * (0.5 + 0.5 * sin(atan(fc.y, fc.x) * 7.0));
    core = mix(core, vec3(0.97, 1.0, 0.85), seedRing * 0.7);
  } else {
    // Fish: deep color with a soft lighter marble.
    float marble = snoise(vec3(fc * 7.0, uSeed)) * 0.5 + 0.5;
    core = mix(uCore, uInner, smoothstep(0.35, 0.9, marble) * 0.6);
    core *= 0.85 + 0.25 * smoothstep(uSize, 0.0, fr);
  }
  // A thin shadow where rice meets the filling.
  col *= 1.0 - 0.35 * smoothstep(uSize + 0.06, uSize, fr) * (1.0 - fill);
  col = mix(col, core, fill);
  // Nori: a near-black rim with a ragged inner edge.
  float rimIn = 0.82 + 0.03 * sin(ang * 9.0 + uSeed) + wob * 0.6;
  float nori = smoothstep(rimIn, rimIn + 0.03, r);
  col = mix(col, vec3(0.025, 0.035, 0.022), nori);
  diffuseColor.rgb *= col;
}`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
{
  float rr = length(vMk - 0.5) * 2.0;
  roughnessFactor = rr < 0.45 ? 0.2 : rr < 0.82 ? 0.62 : 0.95;
}`,
      );
  };
  mat.customProgramCacheKey = () => `maki-face-${filling}`;
  m.faces[filling] = mat;
  return mat;
}

// The sheet on the mat: nori, then rice spread over it, then the filling.
export class MakiSheet {
  constructor() {
    const m = mats();
    this.group = new Group();
    const nori = new Mesh(withFood(new BoxGeometry(MAKI.sheetX, 0.025, MAKI.sheetZ, 8, 1, 8)), m.nori);
    nori.position.y = 0.0125;
    nori.receiveShadow = true;
    this.nori = nori;
    this.sheet = new Group(); // scaled from the far edge while rolling
    this.sheet.add(nori);
    // The rice layer: arrives as a lump, spreads into a slab.
    const slab = new Mesh(withFood(new RoundedBoxGeometry(MAKI.sheetX - 0.25, 0.2, MAKI.sheetZ - 0.15, 3, 0.08)), m.rice);
    slab.position.y = 0.11;
    slab.castShadow = true;
    slab.receiveShadow = true;
    this.slab = slab;
    this.grains = new InstancedMesh(m.grainGeo, m.grain, 260);
    this.grains.castShadow = true;
    const rand = mulberry(7);
    for (let k = 0; k < 260; k++) {
      _o.position.set((rand() - 0.5) * (MAKI.sheetX - 0.35), 0.22, (rand() - 0.5) * (MAKI.sheetZ - 0.3));
      _o.rotation.set(Math.PI / 2 + (rand() - 0.5) * 0.6, rand() * 6, (rand() - 0.5) * 0.6);
      _o.scale.setScalar(0.85 + rand() * 0.3);
      _o.updateMatrix();
      this.grains.setMatrixAt(k, _o.matrix);
    }
    this.riceLayer = new Group();
    this.riceLayer.add(slab, this.grains);
    this.sheet.add(this.riceLayer);
    this.group.add(this.sheet);
    this.spreadAmount = 0;
    this.setSpread(0.12);
    this.filling = null;
    this.spreadQuality = 0;
    this.anim = null;
  }

  // 0: a lump in the middle, 1: an even layer to the edges.
  setSpread(k) {
    this.spreadAmount = k;
    const s = 0.28 + 0.72 * k;
    this.riceLayer.scale.set(s, 1 + (1 - k) * 2.6, s * 0.92 + 0.08);
  }

  spread(quality, over) {
    this.spreadQuality = Math.max(0, Math.min(1, quality - over * 0.5));
    this.anim = { kind: 'spread', from: this.spreadAmount, to: 0.65 + 0.35 * quality, t: 0, len: 0.35 };
  }

  addFilling(kind) {
    const m = mats();
    this.filling = kind;
    const g = new Group();
    const len = MAKI.sheetZ - 0.35;
    if (kind === 'kappa') {
      for (const dz of [-0.03, 0.03]) {
        const geo = new BoxGeometry(0.16, 0.16, len, 1, 1, 12);
        const stick = new Mesh(geo, m.cucumber);
        stick.position.set(dz * 3, 0, 0);
        stick.castShadow = true;
        g.add(stick);
      }
    } else {
      const geo = withFood(new RoundedBoxGeometry(0.34, 0.2, len, 2, 0.05));
      const stick = new Mesh(geo, kind === 'tekka' ? m.tuna : m.salmon);
      stick.castShadow = true;
      g.add(stick);
    }
    // Laid near the edge the roll starts from.
    g.position.set(-MAKI.sheetX * 0.28, 0.32, 0);
    g.scale.setScalar(0.01);
    this.fillGroup = g;
    this.sheet.add(g);
    this.anim = { kind: 'fill', t: 0, len: 0.22 };
  }

  // Roll from the near edge. Resolves with a MakiLog in the sheet's place.
  roll() {
    return new Promise((resolve) => {
      const log = new MakiLog(this.filling, this.spreadQuality);
      log.group.rotation.y = Math.PI / 2; // roll axis along z on the mat
      log.group.position.set(-MAKI.sheetX / 2, MAKI.radius, 0);
      log.group.scale.setScalar(0.3);
      this.group.add(log.group);
      this.log = log;
      this.anim = { kind: 'roll', t: 0, len: 0.7, resolve };
    });
  }

  update(dt) {
    const a = this.anim;
    if (!a) return;
    a.t = Math.min(1, a.t + dt / a.len);
    const e = 1 - Math.pow(1 - a.t, 3);
    if (a.kind === 'spread') this.setSpread(a.from + (a.to - a.from) * e);
    if (a.kind === 'fill') this.fillGroup.scale.setScalar(Math.max(0.01, e * (1 + Math.sin(a.t * Math.PI) * 0.25)));
    if (a.kind === 'roll') {
      // The sheet shrinks toward its far edge while the log grows and
      // travels across it, turning as it goes.
      const left = 1 - e;
      this.sheet.scale.x = Math.max(0.02, left);
      this.sheet.position.x = (MAKI.sheetX / 2) * (1 - left);
      const lg = this.log.group;
      lg.position.x = -MAKI.sheetX / 2 + MAKI.sheetX * e * 0.85;
      lg.scale.setScalar(0.3 + 0.7 * e);
      lg.rotation.z = -e * Math.PI * 3;
      if (a.t === 1) {
        this.sheet.visible = false;
        lg.rotation.z = 0;
        this.anim = null;
        a.resolve(this.log);
        return;
      }
    }
    if (a.t === 1) this.anim = null;
  }

  dispose() {}
}

// A rolled log, built as six pieces side by side so cutting just pulls them
// apart. Axis along local x.
export class MakiLog {
  constructor(filling, spreadQuality = 1) {
    const m = mats();
    this.filling = filling;
    this.spreadQuality = spreadQuality;
    this.group = new Group();
    this.pieces = [];
    const n = MAKI.pieces;
    const len = MAKI.sheetZ - 0.1;
    this.length = len;
    this.pieceLen = len / n;
    const sideGeo = withFood(new CylinderGeometry(MAKI.radius, MAKI.radius, this.pieceLen * 0.98, 40, 1, true));
    sideGeo.rotateZ(Math.PI / 2);
    const capGeo = new CircleGeometry(MAKI.radius * 0.995, 48);
    const face = faceMaterial(filling);
    for (let i = 0; i < n; i++) {
      const p = new Group();
      const side = new Mesh(sideGeo, m.nori);
      side.castShadow = true;
      side.receiveShadow = true;
      p.add(side);
      for (const s of [-1, 1]) {
        const cap = new Mesh(capGeo, face);
        cap.rotation.y = (s * Math.PI) / 2;
        cap.position.x = (s * this.pieceLen * 0.98) / 2;
        cap.rotation.z = Math.random() * 6; // each face a little different
        p.add(cap);
      }
      p.position.x = (i - (n - 1) / 2) * this.pieceLen;
      p.userData.rest = p.position.x;
      this.group.add(p);
      this.pieces.push(p);
    }
    this.cuts = []; // { index, score }
    this.squash = 0;
  }

  // x positions of the five cuts, in the log's own space.
  get guides() {
    const out = [];
    for (let i = 1; i < MAKI.pieces; i++) out.push((i - MAKI.pieces / 2) * this.pieceLen);
    return out;
  }

  // Cut at guide `index`; pieces to the right slide away a little.
  cut(index, score) {
    this.cuts.push({ index, score });
    const cut = new Set(this.cuts.map((c) => c.index));
    let shift = 0;
    this.pieces.forEach((p, i) => {
      if (i > 0 && cut.has(i - 1)) shift += 0.09;
      p.userData.target = p.userData.rest + shift - (cut.size * 0.09) / 2;
    });
    this.squash = 1;
  }

  get cutDone() {
    return this.cuts.length >= MAKI.pieces - 1;
  }

  get cutScore() {
    return this.cuts.length ? this.cuts.reduce((s, c) => s + c.score, 0) / (MAKI.pieces - 1) : 0;
  }

  update(dt) {
    for (const p of this.pieces) {
      if (p.userData.target == null || p.userData.plated) continue;
      p.position.x += (p.userData.target - p.position.x) * (1 - Math.exp(-dt * 14));
    }
    if (this.squash > 0) {
      this.squash = Math.max(0, this.squash - dt * 3);
      const s = Math.sin(this.squash * Math.PI * 3) * this.squash * 0.08;
      for (const p of this.pieces) if (!p.userData.plated) p.scale.set(1, 1 - s, 1 + s);
    }
  }
}

// Where six standing pieces sit on the serving board, around a center.
export function makiSpots(cx, cz = 0) {
  const out = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) out.push(new Vector3(cx + (c - 1) * 0.86, 0, cz + (r - 0.5) * 0.9));
  return out;
}

// A finished, plated roll for photos: six pieces standing cut face up.
export function platedMaki(filling) {
  const log = new MakiLog(filling, 1);
  const g = new Group();
  const spots = makiSpots(0);
  log.pieces.forEach((p, i) => {
    p.rotation.set(0, 0, Math.PI / 2);
    p.position.copy(spots[i]).setY(log.pieceLen / 2);
    g.add(p);
  });
  return g;
}

function mulberry(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
