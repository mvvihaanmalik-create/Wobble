// GLSL for the generated food textures. Every pattern is a function of the
// food's own 3D coordinates (aFood), baked when the piece is made, so a cut
// face shows the grain that was inside the block and the pattern rides along
// when the piece deforms.

export const NOISE = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

// Simplex noise, Ashima Arts / Stefan Gustavson (MIT).
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float fbm(vec3 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * snoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}

vec3 hash3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453123);
}

// Worley: x = distance to nearest cell point, y = to second nearest.
vec2 worley(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int z = -1; z <= 1; z++)
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 o = hash3(i + g);
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return vec2(d1, d2);
}

// Bump from a height value, after three's bumpmap chunk (perturbNormalArb).
vec3 foodBump(vec3 surfPos, vec3 surfNorm, float hgt, float scale, float faceDir) {
  vec2 dHdxy = vec2(dFdx(hgt), dFdy(hgt)) * scale;
  vec3 sx = normalize(dFdx(surfPos));
  vec3 sy = normalize(dFdy(surfPos));
  vec3 r1 = cross(sy, surfNorm);
  vec3 r2 = cross(surfNorm, sx);
  float det = dot(sx, r1) * faceDir;
  vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
  return normalize(abs(det) * surfNorm - grad);
}

// Thin line at every integer of u, antialiased.
float lines(float u, float width) {
  float d = abs(fract(u + 0.5) - 0.5);
  float aa = fwidth(u) * 0.75 + 1e-4;
  return 1.0 - smoothstep(width - aa, width + aa, d);
}
`;

// Each recipe fills albedo (linear), a bump height and a roughness scale.
// uA..uD are palette colors set from JS.
export const RECIPES = {
  // Salmon: orange flesh with pale fat lines (myosepta) that bend into
  // chevrons across the width, finer lines between, and fibers along them.
  salmon: /* glsl */ `
  // Salmon: glossy orange flesh, soft peach seams that bend into shallow
  // chevrons, and a fine juicy pulp texture between them, like citrus
  // vesicles. Low contrast on purpose: it should read as luscious, not marbled.
  void food(vec3 p, out vec3 col, out float h, out float r) {
    float warp = fbm(p * vec3(0.32, 0.5, 0.45)) * 0.3 + 0.02 * sin(p.y * 3.0 + p.z * 1.7);
    float u = (p.x * 0.8 + p.y * 0.6 + abs(p.z - 0.12) * 0.42 + warp) * 2.6;
    float cell = floor(u);
    float d = abs(fract(u + 0.5) - 0.5);
    float jitter = fract(sin(cell * 91.7) * 4375.85);
    float width = 0.05 + 0.04 * (0.5 + 0.5 * snoise(vec3(p.x * 0.8, p.y * 1.2, cell))) + jitter * 0.02;
    float seam = 1.0 - smoothstep(width * 0.2, width * 1.4, d);
    seam *= 0.5 + 0.5 * smoothstep(-0.4, 0.4, snoise(p * 0.9 + cell));
    // Pulp: small elongated cells running along the muscle.
    vec2 pc = worley(vec3(u * 5.0, p.y * 16.0, p.z * 16.0));
    float pulp = smoothstep(0.0, 0.3, pc.y - pc.x);
    float tone = fbm(p * 1.2) * 0.5 + 0.5;
    vec3 flesh = mix(uA, uB, clamp(tone * 0.5 + d * 0.8, 0.0, 1.0));
    flesh = mix(flesh * 1.04, flesh * 0.95, pulp);
    col = mix(flesh, uC, seam * 0.7);
    h = seam * 0.35 + (1.0 - pulp) * 0.18;
    r = mix(1.0, 0.75, seam);
  }`,
  // Tuna (akami): deep garnet with faint pale connective lines and darker
  // patches toward the blood line.
  tuna: /* glsl */ `
  void food(vec3 p, out vec3 col, out float h, out float r) {
    float tone = fbm(p * 1.1) * 0.5 + 0.5;
    float u = (p.x * 0.75 + p.y * 0.65 + abs(p.z) * 0.35 + fbm(p * 0.9) * 0.5) * 2.2;
    float lineMask = smoothstep(0.0, 0.5, snoise(p * 0.8 + 4.0));
    float sinew = (1.0 - smoothstep(0.008, 0.025, abs(fract(u + 0.5) - 0.5))) * lineMask;
    float fiber = snoise(vec3(u * 12.0, p.y * 40.0, p.z * 40.0));
    float blood = smoothstep(0.2, 0.7, snoise(vec3(p.x * 0.4, p.y * 1.2, p.z * 2.0) + 2.0));
    vec3 flesh = mix(uA, uB, tone);
    flesh = mix(flesh, uD, blood * 0.35);
    flesh *= 0.94 + 0.06 * fiber;
    col = mix(flesh, uC, sinew * 0.12);
    h = sinew * 0.15 + fiber * 0.08;
    r = 0.85 - sinew * 0.1;
  }`,
  // Tamago: folded omelette layers, browned top, tiny air pockets.
  tamago: /* glsl */ `
  void food(vec3 p, out vec3 col, out float h, out float r) {
    float v = p.y * 6.5 + fbm(p * vec3(0.8, 2.0, 1.4)) * 0.35;
    float layer = lines(v, 0.035);
    float tone = fbm(p * 2.2) * 0.5 + 0.5;
    vec3 egg = mix(uA, uB, tone);
    vec2 cell = worley(p * 14.0);
    float pore = 1.0 - smoothstep(0.0, 0.16, cell.x);
    col = mix(egg, uC, layer * 0.7);
    col = mix(col, uC * 0.8, pore * 0.35);
    float top = smoothstep(uParam.x - 0.12, uParam.x, p.y) * smoothstep(0.0, 0.4, snoise(p * 3.0) + 0.2);
    col = mix(col, uD, top * 0.85);
    h = -pore * 0.5 - layer * 0.3;
    r = 1.0;
  }`,
  // Unagi: eel grilled over charcoal and lacquered with tare. Deep amber
  // glaze, darker where it caramelised, grill bars across the fillet, a pale
  // flaky core and a thin dark skin along one edge.
  unagi: /* glsl */ `
  void food(vec3 p, out vec3 col, out float h, out float r) {
    // Glaze: caramel pooled darker in the dips, lighter on the rises.
    float t = fbm(p * vec3(2.2, 2.2, 2.6)) * 0.5 + 0.5;
    vec3 glaze = mix(uA, uB, smoothstep(0.25, 0.85, t));
    // Grill bars: dark charred stripes across the fillet, ragged at the edges.
    float u = p.y * 1.55 + p.z * 0.35 + snoise(p * vec3(2.5, 1.0, 2.5)) * 0.08;
    float bar = 1.0 - smoothstep(0.06, 0.16, abs(fract(u) - 0.5));
    bar *= 0.6 + 0.4 * smoothstep(-0.4, 0.4, snoise(p * 4.0));
    // Char speckles where the tare caught the coals.
    vec2 c = worley(p * 9.0);
    float speck = (1.0 - smoothstep(0.0, 0.12, c.x)) * step(0.55, fract(c.y * 7.3));
    col = mix(glaze, uC, bar * 0.85);
    col = mix(col, uC, speck * 0.6);
    // Skin along one long edge.
    float skin = 1.0 - smoothstep(0.08, 0.2, p.z);
    col = mix(col, uD, skin);
    h = bar * 0.6 + speck * 0.3 + t * 0.2 - skin * 0.2;
    r = mix(0.7, 1.6, bar * 0.8 + speck * 0.4);
  }`,
  // Nori: roasted seaweed. Near black green, a fibrous sheen, faint
  // pressed ripples and pinholes.
  nori: /* glsl */ `
  void food(vec3 p, out vec3 col, out float h, out float r) {
    vec3 q = p * vec3(14.0, 14.0, 14.0);
    float fib = fbm(q * vec3(1.0, 0.25, 0.3)) * 0.5 + 0.5;
    float ripple = snoise(p * vec3(3.0, 3.0, 9.0)) * 0.5 + 0.5;
    col = mix(uA, uB, fib * 0.7 + ripple * 0.3);
    vec2 c = worley(p * 22.0);
    float pin = 1.0 - smoothstep(0.0, 0.08, c.x);
    col = mix(col, uC, pin * 0.5);
    h = fib * 0.6 + ripple * 0.3 - pin * 0.4;
    r = mix(0.85, 1.15, fib);
  }`,
  // Rice: packed grains. Worley cells read as grains, shadowed between.
  rice: /* glsl */ `
  // The packed surface under the loose grains: rounded grain tops with
  // soft shadow between them.
  void food(vec3 p, out vec3 col, out float h, out float r) {
    vec3 q = p * vec3(10.0, 12.0, 10.0) + snoise(p * 3.0) * 0.35;
    vec2 c = worley(q);
    float edge = clamp((c.y - c.x) * 2.4, 0.0, 1.0);
    col = mix(uB, uA, smoothstep(0.0, 0.45, edge));
    col *= 0.98 + 0.02 * snoise(p * 25.0);
    h = edge;
    r = mix(1.2, 0.8, edge);
  }`,
  // Wasabi: grated, fibrous green paste.
  wasabi: /* glsl */ `
  void food(vec3 p, out vec3 col, out float h, out float r) {
    float n = fbm(p * 9.0) * 0.5 + 0.5;
    vec2 c = worley(p * 22.0);
    float grit = 1.0 - smoothstep(0.0, 0.25, c.x);
    col = mix(uA, uB, n);
    col = mix(col, uC, grit * 0.35);
    h = n * 0.6 + grit * 0.4;
    r = 1.0;
  }`,
  // Hinoki and other woods: long grain along x with growth lines.
  wood: /* glsl */ `
  // uParam: x growth rings per unit, y knife scratches, z plank width (0 = none).
  void food(vec3 p, out vec3 col, out float h, out float r) {
    // Rings: warped bands across the board, long along x.
    vec3 q = p * vec3(0.07, 1.0, 1.0);
    float warp = fbm(q * 1.3 + 3.1) * 1.3 + snoise(vec3(p.x * 0.04, p.y, p.z * 0.25)) * 1.8;
    float rc = (p.z + 0.4 * p.y) * uParam.x + warp;
    float ring = fract(rc);
    float late = smoothstep(0.0, 0.06, ring) * (1.0 - smoothstep(0.06, 0.5, ring));
    float fine = lines(rc * 4.0 + fbm(q * 4.0), 0.06) * 0.35;
    // Pores and flecks run along the grain.
    float pores = smoothstep(0.5, 0.8, snoise(vec3(p.x * 1.5, p.y * 38.0, p.z * 38.0)));
    float fleck = smoothstep(0.7, 0.9, snoise(vec3(p.x * 0.6, p.y * 9.0, p.z * 9.0) + 11.0));
    float tone = fbm(vec3(p.x * 0.09, p.y * 3.0, p.z * 3.0)) * 0.5 + 0.5;
    col = mix(uA, uB, tone * 0.7);
    col = mix(col, uC, clamp(late * 0.55 + fine * 0.25, 0.0, 1.0));
    col *= 1.0 - pores * 0.14;
    col = mix(col, uA * 1.06, fleck * 0.25);
    h = late * 0.35 + fine * 0.15 - pores * 0.45;
    r = mix(1.0, 0.82, late) + pores * 0.25;
    // Plank seams.
    if (uParam.z > 0.0) {
      float seam = lines(p.z / uParam.z, 0.006 / uParam.z);
      col *= 1.0 - seam * 0.55;
      h -= seam * 1.2;
    }
    // Knife scratches in a few directions, worn in patches.
    if (uParam.y > 0.0) {
      float sc = 0.0;
      for (int k = 0; k < 3; k++) {
        float a = float(k) * 2.1 + 0.4;
        vec2 d = vec2(cos(a), sin(a));
        float u = dot(p.xz, d) * 16.0 + snoise(vec3(p.xz * 0.7, float(k) * 5.0)) * 2.0;
        float mask = smoothstep(0.3, 0.65, snoise(vec3(p.xz * 0.55, float(k) * 7.0 + 2.0)));
        sc += lines(u, 0.018) * mask;
      }
      sc = clamp(sc, 0.0, 1.0) * uParam.y;
      col = mix(col, uD, sc * 0.45);
      h -= sc * 0.5;
      r += sc * 0.35;
      // Damp patches where the board has been wiped.
      float damp = smoothstep(0.35, 0.7, fbm(vec3(p.xz * 0.35, 4.0)));
      col *= 1.0 - damp * 0.1;
      r *= 1.0 - damp * 0.45;
    }
  }`,
  // Glazed stoneware: glaze that pools darker, iron speckles, raw clay foot.
  // uParam.x: height of the foot (unglazed below it).
  ceramic: /* glsl */ `
  void food(vec3 p, out vec3 col, out float h, out float r) {
    float n = fbm(p * 2.6);
    float speck = smoothstep(0.74, 0.82, snoise(p * 26.0));
    float pool = clamp(smoothstep(0.5, 0.05, p.y) * 0.55 + (n * 0.5 + 0.5) * 0.35, 0.0, 1.0);
    col = mix(uA, uB, pool);
    col = mix(col, uC, speck * 0.85);
    float foot = 1.0 - smoothstep(uParam.x - 0.015, uParam.x + 0.015, p.y);
    col = mix(col, uD * (0.9 + 0.2 * snoise(p * 18.0)), foot);
    h = speck * 0.25 + n * 0.06 + foot * snoise(p * 40.0) * 0.35;
    r = mix(1.0, 5.0, foot) + speck * 0.4;
  }`,
  // Indigo noren cloth with a seigaiha (overlapping waves) print and weave.
  noren: /* glsl */ `
  void food(vec3 p, out vec3 col, out float h, out float r) {
    vec2 uv = p.xy * 0.9;
    float best = 0.0;
    for (int k = 0; k < 2; k++) {
      vec2 g = uv * vec2(1.0, 2.0) + vec2(float(k) * 0.5, float(k) * 0.5);
      vec2 f = fract(g) - vec2(0.5, 0.0);
      float d = length(f * vec2(1.0, 0.5)) * 2.0;
      float rings = lines(d * 4.0, 0.09) * step(d, 0.98);
      best = max(best, rings);
    }
    float weave = (sin(p.x * 140.0) * sin(p.y * 140.0)) * 0.5 + 0.5;
    col = mix(uA, uB, best * 0.85);
    col *= 0.9 + 0.1 * weave;
    h = weave * 0.2;
    r = 1.0;
  }`,
};
