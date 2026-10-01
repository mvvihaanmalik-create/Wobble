import { BufferAttribute, BufferGeometry, DynamicDrawUsage, ExtrudeGeometry, IcosahedronGeometry, Mesh, Shape, Sphere, Vector3 } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { subdivide, reorder } from '../meshutils.js';
import { SoftBody } from '../jelly.js';

// Unit icosphere with shared vertices: a uniform, pole-free starting point
// for anything round. Returned as plain arrays.
export function unitSphere(detail) {
  const g = new IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  const m = mergeVertices(g, 1e-5);
  g.dispose();
  return { pos: Float32Array.from(m.attributes.position.array), idx: Uint32Array.from(m.index.array) };
}

// Round every corner of a 2D outline with an arc. The radius is limited so
// it never eats more than 40% of either edge.
export function filletOutline(points, radius, segments = 6) {
  if (radius <= 0) return points;
  const n = points.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const a = points[(i + n - 1) % n];
    const b = points[(i + 1) % n];
    const da = [a[0] - p[0], a[1] - p[1]];
    const db = [b[0] - p[0], b[1] - p[1]];
    const la = Math.hypot(...da);
    const lb = Math.hypot(...db);
    const ua = [da[0] / la, da[1] / la];
    const ub = [db[0] / lb, db[1] / lb];
    const ang = Math.acos(Math.max(-1, Math.min(1, ua[0] * ub[0] + ua[1] * ub[1])));
    // Distance from the corner to where the arc meets each edge.
    let t = radius / Math.tan(ang / 2);
    t = Math.min(t, la * 0.4, lb * 0.4);
    const r = t * Math.tan(ang / 2);
    const s0 = [p[0] + ua[0] * t, p[1] + ua[1] * t];
    const s1 = [p[0] + ub[0] * t, p[1] + ub[1] * t];
    // Arc center along the bisector.
    const bis = [ua[0] + ub[0], ua[1] + ub[1]];
    const bl = Math.hypot(...bis) || 1;
    const cd = r / Math.sin(ang / 2);
    const c = [p[0] + (bis[0] / bl) * cd, p[1] + (bis[1] / bl) * cd];
    const a0 = Math.atan2(s0[1] - c[1], s0[0] - c[0]);
    let a1 = Math.atan2(s1[1] - c[1], s1[0] - c[0]);
    let delta = a1 - a0;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    for (let k = 0; k <= segments; k++) {
      const aa = a0 + (delta * k) / segments;
      out.push([c[0] + Math.cos(aa) * r, c[1] + Math.sin(aa) * r]);
    }
  }
  return out;
}

// Taubin smoothing: alternating shrink and inflate steps that round off
// edges without the mesh losing volume.
export function taubin(pos, idx, iterations = 4, lambda = 0.5, mu = -0.53) {
  const n = pos.length / 3;
  const deg = new Int32Array(n);
  for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) deg[idx[t + e]] += 2;
  const start = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) start[i + 1] = start[i] + deg[i];
  const fill = start.slice(0, n);
  const nb = new Int32Array(start[n]);
  for (let t = 0; t < idx.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = idx[t + e];
      const b = idx[t + ((e + 1) % 3)];
      nb[fill[a]++] = b;
      nb[fill[b]++] = a;
    }
  }
  const tmp = new Float32Array(pos.length);
  const pass = (f) => {
    for (let i = 0; i < n; i++) {
      let x = 0, y = 0, z = 0;
      const s = start[i], e = start[i + 1];
      for (let k = s; k < e; k++) {
        const j = nb[k] * 3;
        x += pos[j]; y += pos[j + 1]; z += pos[j + 2];
      }
      const inv = 1 / Math.max(1, e - s);
      tmp[i * 3] = pos[i * 3] + f * (x * inv - pos[i * 3]);
      tmp[i * 3 + 1] = pos[i * 3 + 1] + f * (y * inv - pos[i * 3 + 1]);
      tmp[i * 3 + 2] = pos[i * 3 + 2] + f * (z * inv - pos[i * 3 + 2]);
    }
    pos.set(tmp);
  };
  for (let it = 0; it < iterations; it++) {
    pass(lambda);
    pass(mu);
  }
  return pos;
}

// Extrude a 2D outline (array of [x, y]) along z with rounded edges, then
// subdivide so it can bend smoothly. round: corner fillet radius. smooth:
// Taubin iterations to soften everything after subdividing.
export function extrudedSolid(points, depth, { bevel = 0.04, maxEdge = 0.1, curveSegments = 4, round = 0, smooth = 0, bevelSegments = 3 } = {}) {
  const outline = filletOutline(points, round);
  const shape = new Shape(outline.map(([x, y]) => ({ x, y })));
  const geo = new ExtrudeGeometry(shape, {
    depth: Math.max(0.01, depth - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelOffset: -bevel * 0.8,
    bevelSegments,
    curveSegments,
  });
  geo.translate(0, 0, -depth / 2 + bevel);
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  const merged = mergeVertices(geo, 1e-5);
  geo.dispose();
  const pos = Float32Array.from(merged.attributes.position.array);
  const idx = Uint32Array.from(merged.index.array);
  const glyph = new Uint8Array(pos.length / 3);
  const out = subdivide(pos, idx, glyph, maxEdge, 1);
  if (smooth) taubin(out.pos, out.idx, smooth);
  const res = { pos: out.pos, idx: out.idx, glyphOf: out.glyphOf };
  reorder(res);
  return res;
}

// Wrap plain arrays as the mesh description SoftBody expects: centered on x,
// resting on y = 0, one part.
export function bodyMesh(pos, idx) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    minX = Math.min(minX, pos[i]); maxX = Math.max(maxX, pos[i]);
    minY = Math.min(minY, pos[i + 1]); maxY = Math.max(maxY, pos[i + 1]);
    minZ = Math.min(minZ, pos[i + 2]); maxZ = Math.max(maxZ, pos[i + 2]);
  }
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  for (let i = 0; i < pos.length; i += 3) {
    pos[i] -= cx;
    pos[i + 1] -= minY;
    pos[i + 2] -= cz;
  }
  const w = maxX - minX;
  return {
    positions: pos,
    indices: idx,
    glyphOf: new Uint8Array(pos.length / 3),
    glyphs: [{ cx: 0, minX: -w / 2, maxX: w / 2, height: maxY - minY }],
    width: w,
    height: maxY - minY,
    depth: maxZ - minZ,
    shift: [cx, minY, cz],
  };
}

// A soft body with a GPU mesh bound to its arrays.
export class Squishy {
  constructor(mesh, material, simOpts, foodCoords) {
    this.body = new SoftBody(mesh, simOpts);
    this.body.compose();
    const geo = new BufferGeometry();
    geo.setIndex(new BufferAttribute(this.body.index, 1));
    geo.setAttribute('position', new BufferAttribute(this.body.out, 3).setUsage(DynamicDrawUsage));
    geo.setAttribute('normal', new BufferAttribute(this.body.normal, 3).setUsage(DynamicDrawUsage));
    if (foodCoords) geo.setAttribute('aFood', new BufferAttribute(foodCoords, 3));
    this.geometry = geo;
    this.refreshBounds();
    this.mesh = new Mesh(geo, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
  }

  refreshBounds() {
    const b = this.body;
    const r = Math.hypot(b.width / 2, b.height, b.depth / 2) + 0.6;
    this.geometry.boundingSphere = new Sphere(new Vector3(0, b.height / 2, 0), r);
  }

  step(dt) {
    this.body.step(dt, null);
    const changed = this.body.compose();
    this.geometry.attributes.position.needsUpdate = true;
    if (changed) this.geometry.attributes.normal.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
  }
}

// Small deterministic noise for lumpy shapes.
export function lumpNoise(seed) {
  const r = mulberry(seed);
  const waves = [];
  for (let i = 0; i < 7; i++) {
    const v = new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(1.5 + r() * 3);
    waves.push([v.x, v.y, v.z, r() * 6.28]);
  }
  return (x, y, z) => {
    let s = 0;
    for (const [a, b, c, ph] of waves) s += Math.sin(a * x + b * y + c * z + ph);
    return s / waves.length;
  };
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
