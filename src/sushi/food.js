import {
  MeshPhysicalMaterial,
  CylinderGeometry,
  BufferAttribute,
  CapsuleGeometry,
  CatmullRomCurve3,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { bakeFoodCoords, foodMaterial, plain, riceGrainGeometry, riceGrainMaterial } from './materials.js';
import { bodyMesh, extrudedSolid, lumpNoise, Squishy, unitSphere } from './meshes.js';
import { mulberry } from './set.js';

// Shared materials and geometry, created once.
let M = null;
function mats() {
  if (M) return M;
  const grainGeo = riceGrainGeometry(CapsuleGeometry);
  M = {
    rice: foodMaterial('rice'),
    grain: riceGrainMaterial(),
    grainGeo,
    salmon: foodMaterial('salmon'),
    tuna: foodMaterial('tuna'),
    // Blocks are thick and large: deep translucency there shows the counter
    // through the fish, so they keep the gloss but stay nearly opaque.
    salmonBlock: foodMaterial('salmon', { transmission: 0.12 }),
    tunaBlock: foodMaterial('tuna', { transmission: 0.1 }),
    tamago: (() => {
      const t = foodMaterial('tamago');
      t.userData.uniforms.uParam.value.x = BLOCKS.tamago.H;
      return t;
    })(),
    wasabi: foodMaterial('wasabi'),
    unagi: foodMaterial('unagi'),
    nori: foodMaterial('nori'),
    ikura: plain.ikura(),
    yolk: plain.yolk(),
    sesame: plain.sesame(),
    scallion: plain.scallion(),
    sauce: plain.sauce(),
    roeGeo: new IcosahedronGeometry(0.12, 3),
    yolkGeo: new IcosahedronGeometry(0.045, 1),
    seedGeo: (() => {
      const g = new IcosahedronGeometry(0.024, 2);
      g.scale(1, 0.45, 1.75);
      return g;
    })(),
    ringGeo: new TorusGeometry(0.062, 0.017, 8, 22),
  };
  return M;
}

const UP = new Vector3(0, 1, 0);
const _o = new Object3D();
const _n = new Vector3();
const _t = new Vector3();
const _p = new Vector3();
const _q = new Quaternion();

// ---------------------------------------------------------------------------
// Rice: starts as a loose clump, each press moves it toward a neat nigiri
// mound. Pressing too hard squashes it flat. The surface is a soft body and
// real grains ride on top of it.

const RICE_SIM = {
  sim: { spring: 260, damping: 4, coupling: 2600, pressure: 70, softLimit: 0.12, maxDisplacement: 0.24, gridCell: 0.075, depthFalloff: 0.8 },
  modes: { shearSpring: 95, squashSpring: 130, damping: 3.4, maxShear: 0.14, maxSquash: 0.38, breathing: 0, tremble: 0.0006 },
};

export class RiceMound {
  // kind: 'nigiri' presses into a long mound; 'onigiri' into a puffy
  // triangle that stands up.
  constructor(scoop, seed = 1, kind = 'nigiri') {
    const m = mats();
    this.scoop = scoop;
    this.kind = kind;
    const s = 0.8 + scoop * 0.45;
    this.size = s;
    const base = unitSphere(13);
    this.idx = base.idx;
    const noise = lumpNoise(seed);
    this.shapes = {
      clump: shapeFrom(base.pos, (x, y, z) => {
        const r = 1 + 0.17 * noise(x * 1.3, y * 1.3, z * 1.3) + 0.05 * noise(x * 4, y * 4, z * 4);
        const yy = Math.max(-0.55, y * r);
        return [x * r * 0.74 * s, yy > 0 ? yy * 0.72 * s : yy * 0.45 * s, z * r * 0.62 * s];
      }),
      formed:
        kind === 'onigiri'
          ? shapeFrom(base.pos, (x, y, z) => {
              // A rounded triangle, apex up, puffy front and back.
              const a = Math.atan2(y, x);
              const rho = Math.hypot(x, y);
              const k = (((a - Math.PI / 2) % ((2 * Math.PI) / 3)) + (2 * Math.PI) / 3) % ((2 * Math.PI) / 3);
              const tri = Math.cos(Math.PI / 3) / Math.cos(k - Math.PI / 3);
              const r = (0.62 * tri + 0.38) * 1.02 * s;
              return [Math.cos(a) * rho * r, Math.sin(a) * rho * r * 1.02, sp(z, 0.75) * 0.5 * s];
            })
          : shapeFrom(base.pos, (x, y, z) => [sp(x, 0.84) * 1.06 * s, y > 0 ? Math.pow(y, 0.9) * 0.74 * s : y * 0.1 * s, sp(z, 0.84) * 0.52 * s]),
      flat: shapeFrom(base.pos, (x, y, z) => [sp(x, 0.62) * 1.3 * s, y > 0 ? Math.pow(y, 0.7) * 0.36 * s : y * 0.05 * s, sp(z, 0.62) * 0.64 * s]),
    };
    const start = this.shapes.clump.slice();
    const mesh = bodyMesh(start, this.idx);
    this.squishy = new Squishy(mesh, m.rice, RICE_SIM, bakeFoodCoords({ attributes: { position: { array: start } } }, 1));
    this.body = this.squishy.body;
    this.group = new Group();
    this.group.add(this.squishy.mesh);
    this.formed = 0;
    this.over = 0;
    this.presses = [];
    this.morph = null;

    // Grains: tied to random vertices on the upper surface.
    const rand = mulberry(seed * 13 + 5);
    const cand = [];
    for (let i = 0; i < this.body.N; i++) if (start[i * 3 + 1] > this.body.height * 0.1) cand.push(i);
    const n = 420;
    this.grains = new InstancedMesh(m.grainGeo, m.grain, n);
    // The mound casts the shadow; each grain's own is a texel at most.
    this.grains.castShadow = false;
    this.grains.receiveShadow = true;
    this.grainVerts = new Int32Array(n);
    this.grainDirs = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) {
      this.grainVerts[k] = cand[Math.floor(rand() * cand.length)];
      const d = new Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
      d.toArray(this.grainDirs, k * 3);
    }
    this.group.add(this.grains);
    this.updateGrains();
  }

  // Blend toward the formed shape (0..1), then toward flat by `over`.
  targetShape(formed, over) {
    const { clump, formed: f, flat } = this.shapes;
    const out = new Float32Array(clump.length);
    for (let i = 0; i < out.length; i++) {
      const a = clump[i] + (f[i] - clump[i]) * formed;
      out[i] = a + (flat[i] - a) * over;
    }
    return out;
  }

  // One press. quality 0..1 (how well timed), over 0..1 (how much too hard).
  press(quality, over) {
    this.presses.push({ quality, over });
    const from = this.targetShape(this.formed, this.over);
    this.formed = Math.min(1, this.formed + 0.2 + 0.2 * quality);
    this.over = Math.min(1, this.over + over * 0.45);
    const to = this.targetShape(this.formed, this.over);
    this.morph = { from, to, t: 0, len: 0.22 };
    this.body.kickAll(0, 2.2 + over * 2, 0);
    this.body.impulse(0, this.body.height, 0, 0, -1, 0, 1.2, 0.6);
  }

  update(dt) {
    dt = Math.max(0, dt);
    if (this.morph) {
      const mo = this.morph;
      mo.t = Math.min(1, mo.t + dt / mo.len);
      const k = 1 - Math.pow(1 - mo.t, 3);
      const cur = (mo.cur ||= new Float32Array(mo.from.length));
      for (let i = 0; i < cur.length; i++) cur[i] = mo.from[i] + (mo.to[i] - mo.from[i]) * k;
      this.body.setRest(cur, mo.t === 1);
      if (mo.t === 1) {
        this.morph = null;
        this.squishy.refreshBounds();
      }
    }
    this.squishy.step(dt);
    this.updateGrains();
  }

  updateGrains() {
    const { out, normal } = this.body;
    for (let k = 0; k < this.grainVerts.length; k++) {
      const i3 = this.grainVerts[k] * 3;
      _n.set(normal[i3], normal[i3 + 1], normal[i3 + 2]);
      _t.fromArray(this.grainDirs, k * 3);
      _t.addScaledVector(_n, -_t.dot(_n)).normalize();
      _q.setFromUnitVectors(UP, _t);
      _o.position.set(out[i3] + _n.x * 0.022, out[i3 + 1] + _n.y * 0.022, out[i3 + 2] + _n.z * 0.022);
      _o.quaternion.copy(_q);
      _o.scale.setScalar(1);
      _o.updateMatrix();
      this.grains.setMatrixAt(k, _o.matrix);
    }
    this.grains.instanceMatrix.needsUpdate = true;
  }

  // Top of the rice at its center, in its own space.
  get top() {
    return this.body.height;
  }

  get halfLength() {
    return this.body.width / 2;
  }

  // Pochi reshapes a squashed mound: back to a decent shape, though not a
  // perfect one, and the score remembers.
  fix() {
    const from = this.targetShape(this.formed, this.over);
    this.over *= 0.2;
    this.formed = Math.max(this.formed, 0.7);
    this.rescued = (this.rescued || 0) + 1;
    this.morph = { from, to: this.targetShape(this.formed, this.over), t: 0, len: 0.35 };
    this.body.kickAll(0, 2.6, 0);
  }

  // 0..1: shape (well formed, not squashed) and press timing.
  shapeScore() {
    const timing = this.presses.length ? this.presses.reduce((s, p) => s + p.quality, 0) / this.presses.length : 0;
    return Math.max(0, Math.min(1, this.formed * 0.55 + timing * 0.45 - this.over * 0.7 - (this.rescued || 0) * 0.15));
  }

  dispose() {
    this.squishy.dispose();
  }
}

function sp(v, e) {
  return Math.sign(v) * Math.pow(Math.abs(v), e);
}

function shapeFrom(unit, fn) {
  const out = new Float32Array(unit.length);
  let minY = Infinity;
  for (let i = 0; i < unit.length; i += 3) {
    const [x, y, z] = fn(unit[i], unit[i + 1], unit[i + 2]);
    out[i] = x;
    out[i + 1] = y;
    out[i + 2] = z;
    minY = Math.min(minY, y);
  }
  for (let i = 1; i < out.length; i += 3) out[i] -= minY;
  return out;
}

// ---------------------------------------------------------------------------
// Fish blocks and slices. Everything is built in block space: x along the
// block (0 at the far left end), y up, z across. The pattern coordinates are
// block space too, so a slice shows exactly the grain that was in the block.

export const BLOCKS = {
  salmon: { L: 7, H: 1.6, D: 1.15, angle: 45, thickness: 0.42 },
  tuna: { L: 7, H: 1.6, D: 1.15, angle: 45, thickness: 0.42 },
  tamago: { L: 7, H: 2.3, D: 1.15, angle: 0, thickness: 0.62 },
  unagi: { L: 7, H: 2.15, D: 1.25, angle: 0, thickness: 0.5 },
};

const BLOCK_SIM = {
  sim: { spring: 300, softLimit: 0.06, maxDisplacement: 0.12, pressure: 40, gridCell: 0.12 },
  modes: { shearSpring: 140, squashSpring: 180, maxShear: 0.05, maxSquash: 0.06, breathing: 0, tremble: 0 },
};

export class FishBlock {
  constructor(kind) {
    this.kind = kind;
    const b = BLOCKS[kind];
    this.L = b.L;
    this.H = b.H;
    this.D = b.D;
    // The end comes pre-trimmed at the ideal angle.
    const lean = Math.tan((b.angle * Math.PI) / 180) * b.H;
    this.end = [b.L - lean, b.L];
    this.group = new Group();
    this.rebuild();
  }

  outline() {
    return [
      [0, 0],
      [this.end[0], 0],
      [this.end[1], this.H],
      [0, this.H],
    ];
  }

  rebuild() {
    if (this.squishy) {
      this.group.remove(this.squishy.mesh);
      this.squishy.dispose();
    }
    const solid = extrudedSolid(this.outline(), this.D, { bevel: 0.18, bevelSegments: 6, maxEdge: 0.19, round: 0.22, roundSegments: 10, smooth: 4 });
    const food = solid.pos.slice();
    const mesh = bodyMesh(solid.pos, solid.idx);
    this.shift = mesh.shift;
    const mat = mats()[`${this.kind}Block`] || mats()[this.kind];
    this.squishy = new Squishy(mesh, mat, BLOCK_SIM, food);
    this.squishy.mesh.position.set(this.shift[0], this.shift[1], this.shift[2]);
    this.group.add(this.squishy.mesh);
  }

  // Remaining length along the bottom edge.
  get remaining() {
    return this.end[0];
  }

  update(dt) {
    this.squishy.step(dt);
  }

  wobble(s = 1) {
    this.squishy.body.kickAll(0.3 * s, 0.8 * s, 0);
  }
}

const SLICE_SIM = {
  sim: { spring: 200, damping: 4.5, coupling: 2200, pressure: 30, softLimit: 0.07, maxDisplacement: 0.16, gridCell: 0.07, depthFalloff: 0.9, anchor: 0.6 },
  modes: { shearSpring: 70, squashSpring: 110, damping: 3, maxShear: 0.12, maxSquash: 0.2, breathing: 0, tremble: 0.0008 },
};

export class FishSlice {
  // quad: block-space outline of the slice. Builds the slice in block space,
  // then re-expresses it in its own frame: x along the cut, y through the
  // thickness, z across.
  constructor(kind, quad, D) {
    this.kind = kind;
    // Soft, pillowy edges: a deep bevel across the width, well-rounded ends
    // and fine enough triangles that the drape stays smooth.
    const thick = Math.hypot(quad[1][0] - quad[0][0], quad[1][1] - quad[0][1]);
    const solid = extrudedSolid(quad, D, { bevel: Math.min(0.2, thick * 0.36), bevelSegments: 7, maxEdge: 0.105, round: 0.24, roundSegments: 12, smooth: 8 });
    const food = solid.pos.slice();
    const [p0, , , p3] = quad;
    const d = new Vector3(p3[0] - p0[0], p3[1] - p0[1], 0).normalize();
    const n = new Vector3(-d.y, d.x, 0);
    const local = new Float32Array(solid.pos.length);
    for (let i = 0; i < local.length; i += 3) {
      const x = solid.pos[i] - p0[0];
      const y = solid.pos[i + 1] - p0[1];
      local[i] = x * d.x + y * d.y;
      local[i + 1] = x * n.x + y * n.y;
      local[i + 2] = solid.pos[i + 2];
    }
    const mesh = bodyMesh(local, solid.idx);
    this.flat = mesh.positions.slice();
    // Where the slice sat inside the block, for the cut animation.
    const s = mesh.shift;
    this.blockPose = {
      position: new Vector3(p0[0] + d.x * s[0] + n.x * s[1], p0[1] + d.y * s[0] + n.y * s[1], s[2]),
      quaternion: new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(d, n, new Vector3(0, 0, 1))),
    };
    this.squishy = new Squishy(mesh, mats()[kind], SLICE_SIM, food);
    this.body = this.squishy.body;
    this.group = new Group();
    this.group.add(this.squishy.mesh);
    this.length = mesh.width;
    this.thickness = mesh.height;
    this.width = mesh.depth;
    this.morph = null;
    this.toppings = new Toppings(this);
    this.group.add(this.toppings.group);
  }

  // Bend over a rice mound whose top is `top` high and `half` long, so the
  // ends droop and the middle hugs the rice.
  drapeShape(top, half, halfWidth) {
    const out = this.flat.slice();
    const t = this.thickness;
    for (let i = 0; i < out.length; i += 3) {
      const x = out[i];
      const z = out[i + 2];
      const q = Math.abs(x) / (half * 1.12);
      let base = top * Math.pow(Math.max(0, 1 - Math.pow(q, 2.4)), 0.5);
      base = Math.max(base, top * 0.22 * Math.exp(-(q - 1) * 1.5));
      base -= top * 0.18 * Math.pow(Math.min(1, Math.abs(z) / (halfWidth * 1.15)), 2);
      out[i + 1] = Math.max(0, base - t * 0.35) + out[i + 1];
    }
    return out;
  }

  drapeOver(rice, seconds = 0.35) {
    const shape = this.drapeShape(rice.top, rice.halfLength, rice.body.depth / 2);
    this.morph = { from: this.currentRest(), to: shape, t: 0, len: seconds };
    this.body.kickAll(0, 1.6, 0);
  }

  lieFlat(seconds = 0.25) {
    this.morph = { from: this.currentRest(), to: this.flat.slice(), t: 0, len: seconds };
  }

  currentRest() {
    return this.body.rest.slice();
  }

  update(dt) {
    dt = Math.max(0, dt);
    if (this.morph) {
      const mo = this.morph;
      mo.t = Math.min(1, mo.t + dt / mo.len);
      const k = 1 - Math.pow(1 - mo.t, 3);
      const cur = (mo.cur ||= new Float32Array(mo.from.length));
      for (let i = 0; i < cur.length; i++) cur[i] = mo.from[i] + (mo.to[i] - mo.from[i]) * k;
      this.body.setRest(cur, mo.t === 1);
      if (mo.t === 1) {
        this.morph = null;
        this.squishy.refreshBounds();
      }
    }
    this.squishy.step(dt);
    this.toppings.update();
  }

  dispose() {
    this.squishy.dispose();
    this.toppings.dispose();
  }
}

// ---------------------------------------------------------------------------
// Toppings ride on the slice: each item is pinned to a slice vertex and
// follows it as the fish wobbles.

export class Toppings {
  constructor(slice) {
    const m = mats();
    this.slice = slice;
    this.group = new Group();
    this.roe = new InstancedMesh(m.roeGeo, m.ikura, 12);
    this.yolk = new InstancedMesh(m.yolkGeo, m.yolk, 12);
    this.seeds = new InstancedMesh(m.seedGeo, m.sesame, 140);
    this.rings = new InstancedMesh(m.ringGeo, m.scallion, 40);
    for (const im of [this.roe, this.yolk, this.seeds, this.rings]) {
      im.count = 0;
      im.castShadow = true;
      im.frustumCulled = false;
      this.group.add(im);
    }
    this.items = { roe: [], seeds: [], rings: [] };
    this.sauce = null;
    this.sauceVerts = [];
    this.pop = [];
  }

  // Nearest upward-facing vertex to a point in slice space.
  anchor(x, z) {
    const { out, normal, N } = this.slice.body;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < N; i++) {
      if (normal[i * 3 + 1] < 0.5) continue;
      const d = (out[i * 3] - x) ** 2 + (out[i * 3 + 2] - z) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  addRoe(x, z) {
    if (this.items.roe.length >= 12) return false;
    this.items.roe.push({ v: this.anchor(x, z), born: performance.now(), lift: 0.1, spin: Math.random() * 6 });
    return true;
  }

  addSesame(x, z) {
    if (this.items.seeds.length >= 140) return false;
    for (let k = 0; k < 24 && this.items.seeds.length < 140; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 0.42;
      this.items.seeds.push({ v: this.anchor(x + Math.cos(a) * r, z + Math.sin(a) * r * 0.6), born: performance.now(), lift: 0.02, spin: Math.random() * 6 });
    }
    return true;
  }

  addScallion(x, z) {
    if (this.items.rings.length >= 40) return false;
    for (let k = 0; k < 7 && this.items.rings.length < 40; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 0.35;
      this.items.rings.push({ v: this.anchor(x + Math.cos(a) * r, z + Math.sin(a) * r * 0.6), born: performance.now(), lift: 0.03, spin: Math.random() * 6 });
    }
    return true;
  }

  // Sauce stroke: points in slice space, pinned to vertices.
  addSaucePoint(x, z) {
    const v = this.anchor(x, z);
    if (this.sauceVerts[this.sauceVerts.length - 1] === v) return;
    this.sauceVerts.push(v);
    this.rebuildSauce();
  }

  rebuildSauce() {
    if (this.sauce) {
      this.group.remove(this.sauce);
      this.sauce.geometry.dispose();
    }
    if (this.sauceVerts.length < 2) return;
    const { out, normal } = this.slice.body;
    const pts = this.sauceVerts.map((v) => new Vector3(out[v * 3] + normal[v * 3] * 0.03, out[v * 3 + 1] + normal[v * 3 + 1] * 0.03, out[v * 3 + 2] + normal[v * 3 + 2] * 0.03));
    const curve = new CatmullRomCurve3(pts);
    const geo = new TubeGeometry(curve, Math.min(120, pts.length * 6), 0.045, 8, false);
    this.sauce = new Mesh(geo, mats().sauce);
    this.sauce.castShadow = true;
    this.group.add(this.sauce);
  }

  get counts() {
    return { ikura: this.items.roe.length, sesame: this.items.seeds.length > 0, scallion: this.items.rings.length > 0, sauce: this.sauceVerts.length >= 4 };
  }

  update() {
    const { out, normal } = this.slice.body;
    const now = performance.now();
    const place = (inst, list, scale, extra) => {
      list.forEach((it, k) => {
        const i3 = it.v * 3;
        _n.set(normal[i3], normal[i3 + 1], normal[i3 + 2]);
        const age = Math.min(1, (now - it.born) / 220);
        const pop = age < 1 ? 1 + Math.sin(age * Math.PI) * 0.35 : 1;
        _p.set(out[i3], out[i3 + 1], out[i3 + 2]).addScaledVector(_n, it.lift * scale);
        _o.position.copy(_p);
        _o.position.y += (1 - age) * 0.5;
        _o.quaternion.setFromUnitVectors(UP, _n);
        _o.rotateY(it.spin);
        if (extra) extra(_o, it);
        _o.scale.setScalar(scale * pop);
        _o.updateMatrix();
        inst.setMatrixAt(k, _o.matrix);
      });
      inst.count = list.length;
      inst.instanceMatrix.needsUpdate = true;
    };
    place(this.roe, this.items.roe, 1);
    place(this.yolk, this.items.roe, 1, (o) => o.translateX(0.035).translateY(0.02));
    place(this.seeds, this.items.seeds, 1);
    place(this.rings, this.items.rings, 1, (o) => o.rotateX(Math.PI / 2));
  }

  dispose() {
    if (this.sauce) this.sauce.geometry.dispose();
  }
}

// A dab of wasabi on the rice, under the fish.
export function wasabiDab(seed) {
  const g = new IcosahedronGeometry(0.16, 4);
  const noise = lumpNoise(seed);
  const p = g.attributes.position.array;
  for (let i = 0; i < p.length; i += 3) {
    const r = 1 + 0.25 * noise(p[i] * 8, p[i + 1] * 8, p[i + 2] * 8);
    p[i] *= r * 1.3;
    p[i + 1] *= r * 0.55;
    p[i + 2] *= r;
  }
  g.computeVertexNormals();
  g.setAttribute('aFood', new BufferAttribute(bakeFoodCoords(g, 1), 3));
  const m = new Mesh(g, mats().wasabi);
  m.castShadow = true;
  return m;
}

// One nigiri being assembled on the serving board.
// An onigiri: shaped rice with a filling pressed in and a nori wrap round
// the bottom. A peek of the filling shows at the top, so you can tell them
// apart.
export class Onigiri {
  constructor(rice) {
    this.rice = rice;
    this.filling = null;
    this.group = new Group();
    this.group.add(rice.group);
    this.nori = null;
  }

  addFilling(kind, color) {
    this.filling = kind;
    const ball = new Mesh(new IcosahedronGeometry(0.2, 3), new MeshPhysicalMaterial({ color, roughness: 0.35, clearcoat: 0.7, sheen: 0.3 }));
    ball.castShadow = true;
    ball.position.set(0, this.rice.body.height + 0.12, 0);
    ball.userData.born = performance.now();
    this.ball = ball;
    this.group.add(ball);
  }

  wrap() {
    if (this.nori) return false;
    const b = this.rice.body;
    const geo = new CylinderGeometry(1, 1, b.width * 0.62, 48, 1, true);
    geo.rotateZ(Math.PI / 2);
    geo.scale(1, b.height * 0.34, b.depth / 2 + 0.035);
    geo.translate(0, b.height * 0.22, 0);
    geo.setAttribute('aFood', new BufferAttribute(bakeFoodCoords(geo, 1), 3));
    const band = new Mesh(geo, mats().nori);
    band.material.side = 2;
    band.castShadow = true;
    band.userData.born = performance.now();
    this.nori = band;
    this.group.add(band);
    return true;
  }

  update(dt) {
    this.rice.update(dt);
    // The filling sinks into the rice as it is pressed, leaving a peek on top.
    if (this.ball) {
      const f = this.rice.formed;
      const top = this.rice.body.height;
      const sink = Math.min(1, f * 1.2);
      this.ball.position.y = top + 0.12 - sink * 0.2;
      this.ball.scale.set(1 - sink * 0.35, 1 - sink * 0.6, 1 - sink * 0.35);
    }
    if (this.nori) {
      const a = Math.min(1, (performance.now() - this.nori.userData.born) / 260);
      this.nori.scale.set(1, 0.6 + 0.4 * a, 0.6 + 0.4 * a);
    }
  }

  dispose() {
    this.rice.dispose();
  }

  static ideal(kind, color, seed = 21) {
    const rice = new RiceMound(0.65, seed, 'onigiri');
    rice.formed = 1;
    rice.body.setRest(rice.targetShape(1, 0));
    rice.presses = [{ quality: 1, over: 0 }];
    const o = new Onigiri(rice);
    o.addFilling(kind, color);
    o.wrap();
    o.nori.userData.born = -1e9;
    o.update(0);
    return o;
  }
}

export class Piece {
  constructor(rice) {
    this.rice = rice;
    this.slice = null;
    this.wasabi = [];
    this.group = new Group();
    this.group.add(rice.group);
    this.fishGroup = new Group();
    this.group.add(this.fishGroup);
    this.placement = null; // offset and angle of the fish when dropped
  }

  addWasabi() {
    if (this.slice || this.wasabi.length >= 3) return false;
    const d = wasabiDab(this.wasabi.length + 3);
    const k = this.wasabi.length;
    d.position.set((k - 1) * 0.28, this.rice.top - 0.05, 0);
    d.scale.setScalar(0.01);
    d.userData.born = performance.now();
    this.wasabi.push(d);
    this.group.add(d);
    return true;
  }

  // Everything on top of the rice, nori belt included, as the ticket counts it.
  get tops() {
    return { ...(this.slice ? this.slice.toppings.counts : {}), nori: !!this.nori };
  }

  // A strip of nori around the middle of the piece, over fish and rice.
  addNori() {
    if (this.nori || !this.slice) return false;
    const top = this.rice.top + this.slice.thickness * 0.75;
    const ry = top / 2 + 0.05;
    const rz = this.rice.body.depth / 2 + 0.06;
    const geo = new CylinderGeometry(1, 1, 0.42, 48, 1, true);
    geo.rotateZ(Math.PI / 2);
    geo.scale(1, ry, rz);
    geo.setAttribute('aFood', new BufferAttribute(bakeFoodCoords(geo, 1), 3));
    const band = new Mesh(geo, mats().nori);
    band.material.side = 2;
    band.position.set(this.placement ? this.placement.dx : 0, ry - 0.04, 0);
    band.castShadow = true;
    band.scale.set(1, 0.01, 0.01);
    band.userData.born = performance.now();
    this.nori = band;
    this.group.add(band);
    return true;
  }

  setSlice(slice, dx, angle) {
    this.slice = slice;
    this.placement = { dx, angle };
    slice.group.position.set(dx, 0, 0);
    slice.group.rotation.set(0, angle, 0);
    this.fishGroup.add(slice.group);
    slice.drapeOver(this.rice);
  }

  update(dt) {
    this.rice.update(dt);
    if (this.slice) this.slice.update(dt);
    const now = performance.now();
    if (this.nori) {
      // Wraps on with a little overshoot.
      const a = Math.min(1, (now - this.nori.userData.born) / 260);
      const k = a < 1 ? a + Math.sin(a * Math.PI) * 0.12 : 1;
      this.nori.scale.set(1, k, k);
    }
    for (const d of this.wasabi) {
      const a = Math.min(1, (now - d.userData.born) / 200);
      d.scale.setScalar(a < 1 ? 0.2 + 0.8 * a + Math.sin(a * Math.PI) * 0.25 : 1);
      d.position.y = this.rice.top - 0.06;
    }
  }

  dispose() {
    this.rice.dispose();
    if (this.slice) this.slice.dispose();
  }
}

// One of each food, for compiling shaders before play. Returns a group.
export function warmFoods() {
  const g = new Group();
  const rice = new RiceMound(0.6, 1);
  g.add(rice.group);
  for (const kind of Object.keys(BLOCKS)) {
    const b = new FishBlock(kind);
    b.group.position.x = 2;
    g.add(b.group);
  }
  const B = BLOCKS.salmon;
  const slice = new FishSlice('salmon', [[3, 0], [3.4, 0], [3.4 + B.H, B.H], [3 + B.H, B.H]], B.D);
  slice.toppings.addRoe(0, 0);
  slice.toppings.addSesame(0, 0);
  slice.toppings.addScallion(0, 0);
  for (let k = 0; k < 4; k++) slice.toppings.addSaucePoint(-0.6 + k * 0.4, 0);
  slice.toppings.update();
  g.add(slice.group);
  g.add(wasabiDab(1));
  return g;
}
