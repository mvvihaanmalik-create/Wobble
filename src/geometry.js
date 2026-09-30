import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import fontUrl from './fonts/TitanOne-Regular.ttf?url';
import { GEOMETRY } from './config.js';

export async function loadJellyFont() {
  const json = await new TTFLoader().loadAsync(fontUrl);
  return new Font(json);
}

// Keep only characters the font can draw, collapse whitespace, cap length.
export function sanitizeWord(font, text, maxChars) {
  const glyphs = font.data.glyphs;
  let out = '';
  for (const ch of text.replace(/\s+/g, ' ')) {
    if (ch === ' ' || glyphs[ch]) out += ch;
    if (out.length >= maxChars) break;
  }
  return out;
}

// Builds a dense, watertight jelly mesh for a word. Each glyph is extruded on
// its own so it can rest on the floor by its lowest point, then everything is
// subdivided until no edge is longer than the target length.
export const buildTimings = {};

// Extruded, merged glyphs are reused across rebuilds.
const glyphCache = new Map();

function extrudeGlyph(font, ch, long) {
  const G = GEOMETRY;
  const geo = new TextGeometry(ch, {
    font,
    size: 1,
    depth: G.depth,
    curveSegments: long ? G.curveSegmentsLong : G.curveSegments,
    bevelEnabled: true,
    bevelThickness: G.bevelThickness,
    bevelSize: G.bevelSize,
    bevelSegments: G.bevelSegments,
  });
  // Drop normals and UVs so vertices on hard edges merge into one, which
  // keeps the surface closed when it deforms.
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  const merged = mergeVertices(geo, 1e-4);
  geo.dispose();
  merged.computeBoundingBox();
  const out = { pos: merged.attributes.position.array, idx: merged.index.array, box: merged.boundingBox.clone() };
  merged.dispose();
  return out;
}

export function buildWordMesh(font, word, budget) {
  const G = GEOMETRY;
  let tMark = performance.now();
  const lap = (k) => {
    const now = performance.now();
    buildTimings[k] = (buildTimings[k] || 0) + now - tMark;
    tMark = now;
  };
  for (const k in buildTimings) delete buildTimings[k];
  const long = word.length >= 8;
  const scale = 1 / font.data.resolution;
  const zShift = -G.depth / 2;

  const parts = [];
  let penX = 0;
  for (const ch of word) {
    const glyph = font.data.glyphs[ch];
    const advance = (glyph ? glyph.ha * scale : 0.3) + G.tracking;
    if (ch === ' ' || !glyph || !glyph.o) {
      penX += advance;
      continue;
    }
    const cacheKey = `${ch}|${long ? 1 : 0}`;
    let cached = glyphCache.get(cacheKey);
    if (!cached) {
      cached = extrudeGlyph(font, ch, long);
      glyphCache.set(cacheKey, cached);
    }
    const bb = cached.box;
    const gpos = new Float32Array(cached.pos);
    for (let i = 0; i < gpos.length; i += 3) {
      gpos[i] += penX;
      gpos[i + 1] -= bb.min.y;
      gpos[i + 2] += zShift;
    }
    parts.push({
      pos: gpos,
      idx: cached.idx,
      minX: bb.min.x + penX,
      maxX: bb.max.x + penX,
      height: bb.max.y - bb.min.y,
    });
    penX += advance;
  }

  lap('glyphs');
  // Concatenate glyphs.
  let nv = 0;
  let ni = 0;
  for (const p of parts) {
    nv += p.pos.length / 3;
    ni += p.idx.length;
  }
  const pos = new Float32Array(nv * 3);
  const idx = new Uint32Array(ni);
  const glyphOf = new Uint8Array(nv);
  let vo = 0;
  let io = 0;
  parts.forEach((p, g) => {
    pos.set(p.pos, vo * 3);
    for (let i = 0; i < p.idx.length; i++) idx[io + i] = p.idx[i] + vo;
    glyphOf.fill(g, vo, vo + p.pos.length / 3);
    vo += p.pos.length / 3;
    io += p.idx.length;
  });

  // Center horizontally.
  let minX = Infinity;
  let maxX = -Infinity;
  for (const p of parts) {
    minX = Math.min(minX, p.minX);
    maxX = Math.max(maxX, p.maxX);
  }
  const cx = (minX + maxX) / 2;
  for (let i = 0; i < nv; i++) pos[i * 3] -= cx;

  // Pick an edge length that lands near the vertex budget. Added vertices
  // scale roughly with edge^-2.3 here. The first guess is calibrated on this
  // font and usually lands inside the band; otherwise a correction does.
  const area = surfaceArea(pos, idx);
  let edge = Math.max(G.minEdge, Math.sqrt(area / (0.25 * Math.max(budget - nv, budget * 0.25))));
  let result = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    result = subdivide(pos, idx, glyphOf, edge);
    lap('subdivide');
    buildTimings.attempts = attempt + 1;
    const count = result.pos.length / 3;
    if (Math.abs(count - budget) < budget * 0.18 || (count < budget && edge <= G.minEdge)) break;
    const added = Math.max(1, count - nv);
    const want = Math.max(budget * 0.2, budget - nv);
    edge = Math.max(G.minEdge, edge * Math.pow(added / want, 0.43));
  }

  const glyphs = parts.map((p) => ({
    minX: p.minX - cx,
    maxX: p.maxX - cx,
    cx: (p.minX + p.maxX) / 2 - cx,
    height: p.height,
  }));

  reorder(result);
  settleOntoFloor(result.pos, result.glyphOf, glyphs);
  lap('reorder');

  return {
    positions: result.pos,
    indices: result.idx,
    glyphOf: result.glyphOf,
    glyphs,
    width: maxX - minX,
    height: Math.max(...parts.map((p) => p.height)),
    depth: G.depth + G.bevelThickness * 2,
    edge,
  };
}

function surfaceArea(pos, idx) {
  let area = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3;
    const b = idx[t + 1] * 3;
    const c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
    area += Math.sqrt(x * x + y * y + z * z) / 2;
  }
  return area;
}

// Red-green style refinement: every edge longer than maxEdge is split at its
// midpoint, and each triangle is re-cut according to how many of its edges
// were split. Splits are decided per edge, so neighbors always agree and the
// mesh never gets T-junctions (which would crack open when it deforms).
function subdivide(pos0, idx0, glyph0, maxEdge) {
  const pos = Array.from(pos0);
  const glyph = Array.from(glyph0);
  let idx = Array.from(idx0);
  // Flat front and back faces are what people poke, so they get the target
  // edge length. Bevels and sides are already dense along the sweep and use
  // a longer one. An edge splits if either triangle next to it wants it to.
  const capL2 = maxEdge * maxEdge;
  const sideL2 = capL2 * GEOMETRY.sideEdgeFactor ** 2;
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
function reorder(mesh) {
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

// Let the bottom of each letter sag a little onto the floor, so it reads as
// sitting under its own weight instead of hovering.
function settleOntoFloor(pos, glyphOf, glyphs) {
  const band = GEOMETRY.squashBand;
  const amt = GEOMETRY.squashAmount;
  for (let i = 0; i < pos.length / 3; i++) {
    const y = pos[i * 3 + 1];
    if (y >= band) continue;
    const t = 1 - y / band;
    const s = t * t;
    const g = glyphs[glyphOf[i]];
    pos[i * 3 + 1] = Math.max(0, y - amt * s * 0.6);
    pos[i * 3] += (pos[i * 3] - g.cx) * amt * s * 0.35;
    pos[i * 3 + 2] *= 1 + amt * s * 1.2;
  }
}
