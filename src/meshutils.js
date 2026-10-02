import { GEOMETRY } from './config.js';

// Mesh helpers for the soft bodies.

// Red-green style refinement: every edge longer than maxEdge is split at its
// midpoint, and each triangle is re-cut according to how many of its edges
// were split. Splits are decided per edge, so neighbors always agree and the
// mesh never gets T-junctions (which would crack open when it deforms).
export function subdivide(pos0, idx0, glyph0, maxEdge, sideFactor = GEOMETRY.sideEdgeFactor) {
  const pos = Array.from(pos0);
  const glyph = Array.from(glyph0);
  let idx = Array.from(idx0);
  // Flat front and back faces are what people poke, so they get the target
  // edge length. Bevels and sides are already dense along the sweep and use
  // a longer one. An edge splits if either triangle next to it wants it to.
  const capL2 = maxEdge * maxEdge;
  const sideL2 = capL2 * sideFactor ** 2;
  const KEY = 2 ** 22;

  const d2 = (a, b) => {
    const dx = pos[a * 3] - pos[b * 3];
    const dy = pos[a * 3 + 1] - pos[b * 3 + 1];
    const dz = pos[a * 3 + 2] - pos[b * 3 + 2];
    return dx * dx + dy * dy + dz * dz;
  };

  for (let pass = 0; pass < 12; pass++) {
    const mids = new Map();
    const split = (a, b, L2) => {
      const key = a < b ? a * KEY + b : b * KEY + a;
      if (mids.has(key) || d2(a, b) <= L2) return;
      const m = pos.length / 3;
      pos.push(
        (pos[a * 3] + pos[b * 3]) / 2,
        (pos[a * 3 + 1] + pos[b * 3 + 1]) / 2,
        (pos[a * 3 + 2] + pos[b * 3 + 2]) / 2,
      );
      glyph.push(glyph[a]);
      mids.set(key, m);
    };
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
      const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const cap = nz * nz > 0.9 * (nx * nx + ny * ny + nz * nz);
      const L2 = cap ? capL2 : sideL2;
      split(a, b, L2);
      split(b, c, L2);
      split(c, a, L2);
    }
    if (mids.size === 0) break;

    const mid = (a, b) => {
      const m = mids.get(a < b ? a * KEY + b : b * KEY + a);
      return m === undefined ? -1 : m;
    };
    const out = [];
    for (let t = 0; t < idx.length; t += 3) {
      let a = idx[t], b = idx[t + 1], c = idx[t + 2];
      let mab = mid(a, b), mbc = mid(b, c), mca = mid(c, a);
      const n = (mab >= 0) + (mbc >= 0) + (mca >= 0);
      if (n === 0) {
        out.push(a, b, c);
      } else if (n === 3) {
        out.push(a, mab, mca, mab, b, mbc, mca, mbc, c, mab, mbc, mca);
      } else if (n === 1) {
        // Rotate so the split edge is a-b.
        if (mbc >= 0) [a, b, c, mab] = [b, c, a, mbc];
        else if (mca >= 0) [a, b, c, mab] = [c, a, b, mca];
        out.push(a, mab, c, mab, b, c);
      } else {
        // Rotate so the unsplit edge is c-a.
        if (mab < 0) [a, b, c, mab, mbc] = [b, c, a, mbc, mca];
        else if (mbc < 0) [a, b, c, mab, mbc] = [c, a, b, mca, mab];
        out.push(mab, b, mbc);
        if (d2(a, mbc) < d2(mab, c)) out.push(a, mab, mbc, a, mbc, c);
        else out.push(mab, mbc, c, a, mab, c);
      }
    }
    idx = out;
  }

  return {
    pos: new Float32Array(pos),
    idx: new Uint32Array(idx),
    glyphOf: new Uint8Array(glyph),
  };
}

// Sort vertices along a Morton curve, and triangles by their first vertex, so
// neighbors sit close together in memory. The simulation touches every
// vertex's neighbors every substep, and this keeps those reads in cache.
export function reorder(mesh) {
  const { pos, idx, glyphOf } = mesh;
  const n = pos.length / 3;
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    minX = Math.min(minX, pos[i * 3]); maxX = Math.max(maxX, pos[i * 3]);
    minY = Math.min(minY, pos[i * 3 + 1]); maxY = Math.max(maxY, pos[i * 3 + 1]);
    minZ = Math.min(minZ, pos[i * 3 + 2]); maxZ = Math.max(maxZ, pos[i * 3 + 2]);
  }
  const spread = (v) => {
    v = (v | (v << 16)) & 0x030000ff;
    v = (v | (v << 8)) & 0x0300f00f;
    v = (v | (v << 4)) & 0x030c30c3;
    return (v | (v << 2)) & 0x09249249;
  };
  const q = (v, lo, hi) => Math.min(1023, Math.floor(((v - lo) / (hi - lo || 1)) * 1023));
  const keys = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const code = spread(q(pos[i * 3], minX, maxX)) | (spread(q(pos[i * 3 + 1], minY, maxY)) << 1) | (spread(q(pos[i * 3 + 2], minZ, maxZ)) << 2);
    keys[i] = (code >>> 0) * 131072 + i;
  }
  keys.sort();
  const newOf = new Uint32Array(n);
  const p2 = new Float32Array(n * 3);
  const g2 = new Uint8Array(n);
  for (let k = 0; k < n; k++) {
    const old = keys[k] % 131072;
    newOf[old] = k;
    p2[k * 3] = pos[old * 3];
    p2[k * 3 + 1] = pos[old * 3 + 1];
    p2[k * 3 + 2] = pos[old * 3 + 2];
    g2[k] = glyphOf[old];
  }
  const tris = idx.length / 3;
  const tkeys = new Float64Array(tris);
  for (let t = 0; t < tris; t++) {
    const a = newOf[idx[t * 3]], b = newOf[idx[t * 3 + 1]], c = newOf[idx[t * 3 + 2]];
    tkeys[t] = Math.min(a, b, c) * 4194304 + t;
  }
  tkeys.sort();
  const i2 = new Uint32Array(idx.length);
  for (let k = 0; k < tris; k++) {
    const t = tkeys[k] % 4194304;
    i2[k * 3] = newOf[idx[t * 3]];
    i2[k * 3 + 1] = newOf[idx[t * 3 + 1]];
    i2[k * 3 + 2] = newOf[idx[t * 3 + 2]];
  }
  mesh.pos = p2;
  mesh.idx = i2;
  mesh.glyphOf = g2;
}
