import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import fontUrl from './fonts/TitanOne-Regular.ttf?url';
import { GEOMETRY } from './config.js';
import { subdivide, reorder } from './meshutils.js';

export { subdivide, reorder };

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
