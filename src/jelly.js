import { SIM, MODES, INPUT } from './config.js';

const MAX_GRABS = 4;

// CPU soft body over the vertices of the word mesh.
//
// Two layers move together:
//  1. Per-vertex offsets with springs, Laplacian neighbor coupling, a coarse
//     volume grid (dents push nearby surface out) and a displacement clamp.
//  2. Per-letter "modes": sway and squash of each letter as a whole, anchored
//     at the floor and chained to the neighboring letters.
// Final position = rest + offset + mode displacement.
export class SoftBody {
  constructor(mesh) {
    const N = mesh.positions.length / 3;
    this.N = N;
    this.rest = mesh.positions;
    this.index = mesh.indices;
    this.glyphOf = mesh.glyphOf;
    this.glyphs = mesh.glyphs;
    this.width = mesh.width;
    this.height = mesh.height;
    this.depth = mesh.depth;

    this.u = new Float32Array(N * 3); // offset from rest
    this.v = new Float32Array(N * 3); // velocity
    // u + a little velocity, what neighbors read for coupling. Double-buffered
    // so each substep reads last substep's values without an extra pass.
    this.w = new Float32Array(N * 3);
    this.w2 = new Float32Array(N * 3);
    this.md = new Float32Array(N * 3); // per-letter mode displacement
    this.out = new Float32Array(N * 3); // final positions
    this.restNormal = new Float32Array(N * 3);
    this.normal = new Float32Array(N * 3);
    this.anchor = new Float32Array(N); // spring multiplier, stiffer near the floor
    this.h = new Float32Array(N); // 0 at the floor, 1 at the top of its letter

    computeNormals(this.rest, this.index, this.restNormal);
    this.normal.set(this.restNormal);
    this.out.set(this.rest);

    for (let i = 0; i < N; i++) {
      const g = this.glyphs[this.glyphOf[i]];
      const h = Math.min(1.2, this.rest[i * 3 + 1] / g.height);
      this.h[i] = h;
      const low = Math.max(0, 1 - h * 2.2);
      this.anchor[i] = 1 + SIM.anchor * low * low;
    }

    this.buildAdjacency();
    this.buildGrid();
    this.edge = this.averageEdge();

    // Vertices close enough to the floor that they could be pushed through it.
    const low = [];
    for (let i = 0; i < N; i++) if (this.rest[i * 3 + 1] < SIM.maxDisplacement + 0.02) low.push(i);
    this.floorVerts = new Int32Array(low);

    // Per-letter modes: sway x, sway z, squash y, with velocities and targets.
    const G = this.glyphs.length;
    this.G = G;
    this.mode = new Float32Array(G * 3);
    this.modeV = new Float32Array(G * 3);
    this.modeT = new Float32Array(G * 3);
    this.userMode = new Float32Array(3); // pinch and twist targets shared by all letters
    this.grabMode = new Float32Array(G * 3); // lean targets from active drags, per letter

    this.grabs = [];
    for (let s = 0; s < MAX_GRABS; s++) {
      this.grabs.push({ active: false, count: 0, idx: new Int32Array(N), d2: new Float32Array(N), wt: new Float32Array(N), D: new Float32Array(3), k: 0, glyph: 0, sigma: 0, hy: 1, hh: 1 });
    }

    this.accum = 0;
    this.time = 0;
    this.kinetic = 0;
    this.asleep = true; // per-vertex layer at rest; only the letter modes run
    this.quiet = 0;
    this.params = { firmness: 1, damping: 1 };
  }

  buildAdjacency() {
    const N = this.N;
    const idx = this.index;
    const keys = new Float64Array(idx.length);
    let n = 0;
    for (let t = 0; t < idx.length; t += 3) {
      for (let e = 0; e < 3; e++) {
        const a = idx[t + e];
        const b = idx[t + ((e + 1) % 3)];
        keys[n++] = a < b ? a * N + b : b * N + a;
      }
    }
    keys.sort();
    const deg = new Int32Array(N + 1);
    const pairs = [];
    let prev = -1;
    for (let k = 0; k < n; k++) {
      const key = keys[k];
      if (key === prev) continue;
      prev = key;
      const a = Math.floor(key / N);
      const b = key - a * N;
      if (a === b) continue;
      pairs.push(a, b);
      deg[a]++;
      deg[b]++;
    }
    const start = new Int32Array(N + 1);
    for (let i = 0; i < N; i++) start[i + 1] = start[i] + deg[i];
    const fill = start.slice(0, N);
    const list = new Int32Array(start[N]);
    for (let p = 0; p < pairs.length; p += 2) {
      const a = pairs[p];
      const b = pairs[p + 1];
      list[fill[a]++] = b;
      list[fill[b]++] = a;
    }
    this.adjStart = start;
    this.adj = list;
  }

  averageEdge() {
    let sum = 0;
    let count = 0;
    const r = this.rest;
    for (let i = 0; i < this.N; i += 7) {
      for (let k = this.adjStart[i]; k < this.adjStart[i + 1]; k++) {
        const j = this.adj[k];
        const dx = r[i * 3] - r[j * 3], dy = r[i * 3 + 1] - r[j * 3 + 1], dz = r[i * 3 + 2] - r[j * 3 + 2];
        sum += Math.sqrt(dx * dx + dy * dy + dz * dz);
        count++;
      }
    }
    return count ? sum / count : 0.04;
  }

  // Coarse 2D grid over the front view. Each vertex splats how far it is
  // pushed in, the grid is blurred, and each vertex reads back the average
  // dent around it. That becomes outward pressure: push one spot in and the
  // surface around it bulges out, a cheap stand-in for volume preservation.
  buildGrid() {
    const c = SIM.gridCell;
    const pad = c * (SIM.gridBlur + 2);
    this.gx0 = -this.width / 2 - pad;
    this.gy0 = -pad;
    this.gw = Math.ceil((this.width + pad * 2) / c) + 2;
    this.gh = Math.ceil((this.height + pad * 2) / c) + 2;
    const cells = this.gw * this.gh;
    this.grid = new Float32Array(cells);
    this.gridTmp = new Float32Array(cells);
    this.cell = new Int32Array(this.N);
    this.fx = new Float32Array(this.N);
    this.fy = new Float32Array(this.N);
    for (let i = 0; i < this.N; i++) {
      const gx = (this.rest[i * 3] - this.gx0) / c;
      const gy = (this.rest[i * 3 + 1] - this.gy0) / c;
      const ix = Math.min(this.gw - 2, Math.max(0, Math.floor(gx)));
      const iy = Math.min(this.gh - 2, Math.max(0, Math.floor(gy)));
      this.cell[i] = iy * this.gw + ix;
      this.fx[i] = Math.min(1, Math.max(0, gx - ix));
      this.fy[i] = Math.min(1, Math.max(0, gy - iy));
    }
    this.gPress = new Float32Array(this.N);
    const R = SIM.gridBlur;
    this.kernel = new Float32Array(R * 2 + 1);
    let ks = 0;
    for (let k = -R; k <= R; k++) {
      const v = Math.exp(-(k * k) / (2 * (R * 0.55) ** 2));
      this.kernel[k + R] = v;
      ks += v;
    }
    for (let k = 0; k < this.kernel.length; k++) this.kernel[k] /= ks;
    // Vertex density never changes, so the normalization is computed once.
    this.splat((i) => 1);
    this.blurGrid();
    this.gInv = new Float32Array(this.N);
    for (let i = 0; i < this.N; i++) this.gInv[i] = 1 / (this.sample(i) + 1e-6);
  }

  splat(valueOf) {
    const { N, grid, gw, cell, fx, fy } = this;
    grid.fill(0);
    for (let i = 0; i < N; i++) {
      const val = valueOf(i);
      const c0 = cell[i];
      const ax = fx[i], ay = fy[i];
      grid[c0] += val * (1 - ax) * (1 - ay);
      grid[c0 + 1] += val * ax * (1 - ay);
      grid[c0 + gw] += val * (1 - ax) * ay;
      grid[c0 + gw + 1] += val * ax * ay;
    }
  }

  sample(i) {
    const { grid, gw, cell, fx, fy } = this;
    const c0 = cell[i];
    const ax = fx[i], ay = fy[i];
    return grid[c0] * (1 - ax) * (1 - ay) + grid[c0 + 1] * ax * (1 - ay) + grid[c0 + gw] * (1 - ax) * ay + grid[c0 + gw + 1] * ax * ay;
  }

  updateGrid() {
    const { N, u, restNormal: n, grid, gw, cell, fx, fy, gPress, gInv } = this;
    grid.fill(0);
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      const dent = -(u[i3] * n[i3] + u[i3 + 1] * n[i3 + 1] + u[i3 + 2] * n[i3 + 2]);
      const c0 = cell[i];
      const ax = fx[i], ay = fy[i];
      const bx = 1 - ax;
      grid[c0] += dent * bx * (1 - ay);
      grid[c0 + 1] += dent * ax * (1 - ay);
      grid[c0 + gw] += dent * bx * ay;
      grid[c0 + gw + 1] += dent * ax * ay;
    }
    this.blurGrid();
    for (let i = 0; i < N; i++) {
      const c0 = cell[i];
      const ax = fx[i], ay = fy[i];
      const bx = 1 - ax;
      gPress[i] = (grid[c0] * bx * (1 - ay) + grid[c0 + 1] * ax * (1 - ay) + grid[c0 + gw] * bx * ay + grid[c0 + gw + 1] * ax * ay) * gInv[i];
    }
  }

  blurGrid() {
    const { grid, gridTmp, gw, gh, kernel } = this;
    const R = (kernel.length - 1) / 2;
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        let a = 0;
        for (let k = -R; k <= R; k++) {
          const xx = x + k;
          if (xx >= 0 && xx < gw) a += grid[y * gw + xx] * kernel[k + R];
        }
        gridTmp[y * gw + x] = a;
      }
    }
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        let a = 0;
        for (let k = -R; k <= R; k++) {
          const yy = y + k;
          if (yy >= 0 && yy < gh) a += gridTmp[yy * gw + x] * kernel[k + R];
        }
        grid[y * gw + x] = a;
      }
    }
  }

  // Advance by a frame. weight is the optional falling weight collider.
  step(frameDt, weight) {
    this.accum = Math.min(this.accum + frameDt, SIM.dt * SIM.maxSubsteps);
    const steps = Math.floor(this.accum / SIM.dt);
    this.simulated = 0;
    if (steps === 0) return;
    this.accum -= steps * SIM.dt;
    this.simulated = steps * SIM.dt;
    const busy = (weight && weight.active) || this.grabs.some((g) => g.active);
    if (busy) this.wake();
    if (!this.asleep) this.updateGrid();
    for (let s = 0; s < steps; s++) {
      this.time += SIM.dt;
      if (!this.asleep) this.substep(SIM.dt);
      this.stepModes(SIM.dt);
      if (weight && weight.active) {
        weight.substep(SIM.dt, this);
        this.collideWeight(weight);
      }
      if (!this.asleep) this.collideFloor();
    }
    this.measure();
    // Nothing moving and nothing holding it: park the per-vertex layer.
    if (!this.asleep && !busy && this.vertexEnergy < SIM.sleepEnergy) {
      this.quiet += frameDt;
      if (this.quiet > 0.6) this.sleep();
    } else {
      this.quiet = 0;
    }
  }

  wake() {
    if (!this.asleep) return;
    this.asleep = false;
    this.quiet = 0;
    const { u, v, w, w2 } = this;
    const beta = this.beta || 0;
    for (let i = 0; i < u.length; i++) w[i] = w2[i] = u[i] + beta * v[i];
  }

  sleep() {
    this.asleep = true;
    this.u.fill(0);
    this.v.fill(0);
  }

  substep(dt) {
    const { N, u, v, w, restNormal: n, anchor, adjStart, adj, gPress } = this;
    const firm = this.params.firmness;
    const k = SIM.spring * firm;
    const c = SIM.damping * this.params.damping;
    // Neighbor stiffness is scaled so a poke spreads the same distance in em
    // whatever the mesh density turns out to be.
    const kc = Math.min(SIM.coupling * firm * (0.035 / this.edge) ** 2, 0.35 / (dt * dt));
    const beta = SIM.couplingViscosity / Math.max(kc, 1);
    this.beta = beta;
    const kp = SIM.pressure * firm;
    const maxD2 = SIM.maxDisplacement * SIM.maxDisplacement;
    const soft2 = SIM.softLimit * SIM.softLimit;
    const invSoftBand = 1 / (SIM.maxDisplacement - SIM.softLimit);
    const wOut = this.w2;

    // Grab springs: pull each captured vertex toward weight * target offset.
    for (const g of this.grabs) {
      if (!g.active) continue;
      const gk = g.k * firm * dt;
      const Dx = g.D[0], Dy = g.D[1], Dz = g.D[2];
      for (let q = 0; q < g.count; q++) {
        const i3 = g.idx[q] * 3;
        const wt = g.wt[q];
        v[i3] += gk * wt * (wt * Dx - u[i3]);
        v[i3 + 1] += gk * wt * (wt * Dy - u[i3 + 1]);
        v[i3 + 2] += gk * wt * (wt * Dz - u[i3 + 2]);
      }
    }

    const damp = Math.exp(-c * dt);
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      const s = adjStart[i], e = adjStart[i + 1];
      let lx = 0, ly = 0, lz = 0;
      for (let q = s; q < e; q++) {
        const j3 = adj[q] * 3;
        lx += w[j3]; ly += w[j3 + 1]; lz += w[j3 + 2];
      }
      const inv = e > s ? 1 / (e - s) : 0;
      const ux = u[i3], uy = u[i3 + 1], uz = u[i3 + 2];
      // Stiffen smoothly past the soft limit so a hard stretch rounds off
      // instead of flattening against the clamp.
      const d0 = ux * ux + uy * uy + uz * uz;
      let ka = k * anchor[i];
      if (d0 > soft2) {
        const over = (Math.sqrt(d0) - SIM.softLimit) * invSoftBand;
        ka *= 1 + over * over * SIM.softStiffen;
      }
      const p = kp * gPress[i];
      const ax = -ka * ux + kc * (lx * inv - w[i3]) + p * n[i3];
      const ay = -ka * uy + kc * (ly * inv - w[i3 + 1]) + p * n[i3 + 1];
      const az = -ka * uz + kc * (lz * inv - w[i3 + 2]) + p * n[i3 + 2];
      let vx = (v[i3] + ax * dt) * damp;
      let vy = (v[i3 + 1] + ay * dt) * damp;
      let vz = (v[i3 + 2] + az * dt) * damp;
      let nx = ux + vx * dt, ny = uy + vy * dt, nz = uz + vz * dt;
      const d2 = nx * nx + ny * ny + nz * nz;
      if (d2 > maxD2) {
        // Clamp: pull back onto the limit and drop the outward velocity.
        const f = SIM.maxDisplacement / Math.sqrt(d2);
        nx *= f; ny *= f; nz *= f;
        const dir = (vx * nx + vy * ny + vz * nz) / (SIM.maxDisplacement * SIM.maxDisplacement);
        if (dir > 0) { vx -= dir * nx; vy -= dir * ny; vz -= dir * nz; }
      }
      u[i3] = nx; u[i3 + 1] = ny; u[i3 + 2] = nz;
      v[i3] = vx; v[i3 + 1] = vy; v[i3 + 2] = vz;
      wOut[i3] = nx + beta * vx; wOut[i3 + 1] = ny + beta * vy; wOut[i3 + 2] = nz + beta * vz;
    }
    this.w2 = w;
    this.w = wOut;
  }

  stepModes(dt) {
    const { G, mode, modeV, modeT, userMode } = this;
    const firm = this.params.firmness;
    const t = this.time;
    const damp = Math.exp(-MODES.damping * this.params.damping * dt);
    for (let g = 0; g < G; g++) {
      const ph = g * 1.7;
      const gm = this.grabMode;
      modeT[g * 3] = MODES.tremble * Math.sin(t * 0.83 + ph) + userMode[0] + gm[g * 3];
      modeT[g * 3 + 1] = MODES.breathing * Math.sin(t * MODES.breathingRate + g * 0.35) + userMode[1] + gm[g * 3 + 1];
      modeT[g * 3 + 2] = MODES.tremble * 0.7 * Math.sin(t * 0.61 + ph * 1.3) + userMode[2] + gm[g * 3 + 2];
    }
    for (let g = 0; g < G; g++) {
      for (let a = 0; a < 3; a++) {
        const o = g * 3 + a;
        const k = (a === 1 ? MODES.squashSpring : MODES.shearSpring) * firm;
        let acc = -k * (mode[o] - modeT[o]);
        if (g > 0) acc += MODES.neighborCoupling * (mode[o - 3] - mode[o]);
        if (g < G - 1) acc += MODES.neighborCoupling * (mode[o + 3] - mode[o]);
        modeV[o] = (modeV[o] + acc * dt) * damp;
      }
    }
    for (let o = 0; o < G * 3; o++) {
      mode[o] += modeV[o] * dt;
      const lim = o % 3 === 1 ? MODES.maxSquash : MODES.maxShear;
      if (mode[o] > lim) { mode[o] = lim; if (modeV[o] > 0) modeV[o] *= -0.3; }
      if (mode[o] < -lim) { mode[o] = -lim; if (modeV[o] < 0) modeV[o] *= -0.3; }
    }
  }

  collideFloor() {
    const { u, v, rest, md, floorVerts } = this;
    const fr = 1 - SIM.floorFriction;
    for (let q = 0; q < floorVerts.length; q++) {
      const i3 = floorVerts[q] * 3;
      const y = rest[i3 + 1] + u[i3 + 1] + md[i3 + 1];
      if (y < 0) {
        u[i3 + 1] -= y;
        if (v[i3 + 1] < 0) v[i3 + 1] = 0;
        v[i3] *= fr;
        v[i3 + 2] *= fr;
      }
    }
  }

  // Push vertices out from under the weight's rounded underside.
  collideWeight(wt) {
    const { N, u, v, rest, md } = this;
    const hx = wt.hx, hz = wt.hz, r = wt.r;
    const x0 = wt.x - hx, x1 = wt.x + hx;
    const bottom = wt.y - wt.hy;
    const top = wt.y + wt.hy;
    let pressed = 0;
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      const px = rest[i3] + u[i3] + md[i3];
      if (px < x0 || px > x1) continue;
      const pz = rest[i3 + 2] + u[i3 + 2] + md[i3 + 2];
      const ex = Math.max(0, Math.abs(px - wt.x) - (hx - r));
      const ez = Math.max(0, Math.abs(pz - wt.z) - (hz - r));
      const e2 = ex * ex + ez * ez;
      if (e2 >= r * r) continue;
      const floor = bottom + r - Math.sqrt(r * r - e2);
      const py = rest[i3 + 1] + u[i3 + 1] + md[i3 + 1];
      if (py > floor && py < top) {
        u[i3 + 1] -= py - floor;
        if (v[i3 + 1] > wt.vy) v[i3 + 1] = wt.vy;
        pressed++;
      }
    }
    wt.pressed = pressed;
  }

  measure() {
    const { v, N, modeV } = this;
    let e = 0;
    if (!this.asleep) {
      // Every third vertex is plenty for an average.
      for (let i = 0; i < N * 3; i += 9) e += v[i] * v[i] + v[i + 1] * v[i + 1] + v[i + 2] * v[i + 2];
      e = (0.5 * e) / Math.ceil(N / 3);
    }
    let m = 0;
    for (let o = 0; o < modeV.length; o++) m += modeV[o] * modeV[o];
    this.vertexEnergy = e;
    const ke = e + 0.5 * (m / Math.max(1, this.G)) * 0.6;
    if (!Number.isFinite(ke)) {
      this.reset();
      this.kinetic = 0;
      return;
    }
    this.kinetic = ke;
  }

  reset() {
    this.sleep();
    this.mode.fill(0);
    this.modeV.fill(0);
    this.userMode.fill(0);
    this.grabMode.fill(0);
    for (const g of this.grabs) g.active = false;
  }

  // Mode displacement plus final positions and normals, written for the GPU.
  compose() {
    const { N, rest, u, md, out, glyphOf, glyphs, h, mode } = this;
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      const g = glyphOf[i];
      const hh = h[i];
      const hs = hh * hh;
      const sx = mode[g * 3], sy = mode[g * 3 + 1], sz = mode[g * 3 + 2];
      const x = rest[i3], y = rest[i3 + 1], z = rest[i3 + 2];
      const bulge = sy * 0.5 * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, hh)));
      const dx = sx * hs + (x - glyphs[g].cx) * bulge;
      const dy = -sy * y;
      const dz = sz * hs + z * bulge;
      md[i3] = dx; md[i3 + 1] = dy; md[i3 + 2] = dz;
      out[i3] = x + u[i3] + dx;
      out[i3 + 1] = y + u[i3 + 1] + dy;
      out[i3 + 2] = z + u[i3 + 2] + dz;
    }
    // At rest only the tiny idle sway moves things, so the rest normals are
    // close enough and the normal pass can be skipped.
    // Returns true when the normals changed and need uploading.
    if (!this.asleep || this.modeEnergy() > 1e-4) {
      computeNormals(out, this.index, this.normal);
      this.showingRestNormals = false;
      return true;
    }
    if (!this.showingRestNormals) {
      this.normal.set(this.restNormal);
      this.showingRestNormals = true;
      return true;
    }
    return false;
  }

  modeEnergy() {
    let m = 0;
    for (let o = 0; o < this.modeV.length; o++) m += this.modeV[o] * this.modeV[o];
    return m / Math.max(1, this.G);
  }

  // --- Interaction ---------------------------------------------------------

  // Velocity kick with gaussian falloff around a rest-space point.
  impulse(px, py, pz, dx, dy, dz, strength, radius) {
    this.wake();
    const { N, rest, v } = this;
    const inv2 = 1 / (2 * radius * radius);
    const cut = (radius * 3) ** 2;
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      const ex = rest[i3] - px, ey = rest[i3 + 1] - py, ez = (rest[i3 + 2] - pz) * SIM.depthFalloff;
      const d2 = ex * ex + ey * ey + ez * ez;
      if (d2 > cut) continue;
      const f = strength * Math.exp(-d2 * inv2);
      v[i3] += dx * f;
      v[i3 + 1] += dy * f;
      v[i3 + 2] += dz * f;
    }
  }

  kickMode(g, sx, sy, sz) {
    if (g < 0 || g >= this.G) return;
    this.modeV[g * 3] += sx;
    this.modeV[g * 3 + 1] += sy;
    this.modeV[g * 3 + 2] += sz;
  }

  kickAll(sx, sy, sz) {
    for (let g = 0; g < this.G; g++) this.kickMode(g, sx, sy, sz);
  }

  glyphAt(x) {
    let best = 0;
    let bd = Infinity;
    this.glyphs.forEach((g, i) => {
      const d = x < g.minX ? g.minX - x : x > g.maxX ? x - g.maxX : 0;
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  // Start a grab around a rest-space point, limited to one letter so a pull
  // never drags the neighbors along. Returns a slot index or -1.
  grab(px, py, pz, glyph, stiffness = INPUT.grabStiffness) {
    const slot = this.grabs.findIndex((g) => !g.active);
    if (slot < 0) return -1;
    const g = this.grabs[slot];
    const { N, rest, glyphOf } = this;
    // Candidates out to the widest the kernel can grow to; weights are
    // recomputed as the pull changes.
    const cut = (INPUT.grabRadius * 1.5 * 2.6) ** 2;
    let n = 0;
    for (let i = 0; i < N; i++) {
      if (glyphOf[i] !== glyph) continue;
      const i3 = i * 3;
      const ex = rest[i3] - px, ey = rest[i3 + 1] - py, ez = (rest[i3 + 2] - pz) * SIM.depthFalloff;
      const d2 = ex * ex + ey * ey + ez * ez;
      if (d2 > cut) continue;
      g.idx[n] = i;
      g.d2[n] = d2;
      n++;
    }
    g.count = n;
    g.k = stiffness;
    g.glyph = glyph;
    g.hy = Math.max(0.2, py);
    g.hh = Math.min(1.2, Math.max(0.3, py / this.glyphs[glyph].height));
    g.D.fill(0);
    g.sigma = 0;
    this.weighGrab(g, INPUT.grabRadius);
    g.active = n > 0;
    if (g.active) this.wake();
    return g.active ? slot : -1;
  }

  weighGrab(g, sigma) {
    if (Math.abs(sigma - g.sigma) < 0.005) return;
    g.sigma = sigma;
    const inv2 = 1 / (2 * sigma * sigma);
    for (let q = 0; q < g.count; q++) g.wt[q] = Math.exp(-g.d2[q] * inv2);
  }

  // Pointer target as an offset from the grabbed rest point. The letter's own
  // lean and stretch take a share of it (anchored at the floor, so it reads
  // as the whole letter giving way); the local surface pull does the rest.
  // The kernel widens with distance so the trailing side never folds over.
  setGrabTarget(slot, dx, dy, dz, share = INPUT.leanShare) {
    const g = this.grabs[slot];
    if (!g || !g.active) return;
    const o = g.glyph * 3;
    const hs = g.hh * g.hh;
    const lx = Math.max(-MODES.maxShear, Math.min(MODES.maxShear, (dx * share) / hs));
    const lz = Math.max(-MODES.maxShear, Math.min(MODES.maxShear, (dz * share) / hs));
    const ly = Math.max(-MODES.maxSquash, Math.min(MODES.maxSquash, -(dy * share) / g.hy));
    this.grabMode[o] += lx;
    this.grabMode[o + 1] += ly;
    this.grabMode[o + 2] += lz;
    // Whatever the modes cannot take stays with the local pull.
    const rx = dx - lx * hs;
    const ry = dy + ly * g.hy;
    const rz = dz - lz * hs;
    const comp = 1 + SIM.spring / g.k;
    g.D[0] = rx * comp;
    g.D[1] = ry * comp;
    g.D[2] = rz * comp;
    const len = Math.hypot(g.D[0], g.D[1], g.D[2]);
    this.weighGrab(g, Math.min(INPUT.grabRadius * 1.5, Math.max(INPUT.grabRadius, len * 1.3)));
  }

  release(slot) {
    if (this.grabs[slot]) this.grabs[slot].active = false;
  }

  // Current displacement (offset + mode) at a vertex, for grabbing continuity.
  displacementAt(i, target) {
    const i3 = i * 3;
    target[0] = this.u[i3] + this.md[i3];
    target[1] = this.u[i3 + 1] + this.md[i3 + 1];
    target[2] = this.u[i3 + 2] + this.md[i3 + 2];
    return target;
  }

  // Highest rest surface under a footprint, for the weight to land on.
  topUnder(x, hx) {
    const { N, rest } = this;
    let top = -1;
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      if (Math.abs(rest[i3] - x) < hx && rest[i3 + 1] > top) top = rest[i3 + 1];
    }
    return top;
  }
}

export function computeNormals(pos, index, out) {
  out.fill(0);
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t] * 3, b = index[t + 1] * 3, c = index[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    out[a] += nx; out[a + 1] += ny; out[a + 2] += nz;
    out[b] += nx; out[b + 1] += ny; out[b + 2] += nz;
    out[c] += nx; out[c + 1] += ny; out[c + 2] += nz;
  }
  for (let i = 0; i < out.length; i += 3) {
    const x = out[i], y = out[i + 1], z = out[i + 2];
    const l = Math.sqrt(x * x + y * y + z * z);
    if (l > 0) { out[i] = x / l; out[i + 1] = y / l; out[i + 2] = z / l; }
    else { out[i + 2] = 1; }
  }
}
