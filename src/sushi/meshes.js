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

// Extrude a 2D outline (array of [x, y]) along z with rounded edges, then
// subdivide so it can bend smoothly.
export function extrudedSolid(points, depth, { bevel = 0.04, maxEdge = 0.1, curveSegments = 4 } = {}) {
  const shape = new Shape(points.map(([x, y]) => ({ x, y })));
  const geo = new ExtrudeGeometry(shape, {
    depth: Math.max(0.01, depth - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelOffset: -bevel * 0.8,
    bevelSegments: 3,
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
