import {
  CanvasTexture,
  Color,
  MeshStandardMaterial,
  CatmullRomCurve3,
  CircleGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
} from 'three';
import { bodyMesh, Squishy, unitSphere } from './meshes.js';
import { jellyCustomerMaterial } from './materials.js';
import { mulberry } from './set.js';

const CUSTOMER_SIM = {
  sim: { spring: 110, damping: 2.6, coupling: 2200, pressure: 90, maxDisplacement: 0.4, softLimit: 0.22 },
  modes: { shearSpring: 38, squashSpring: 60, damping: 2.2, maxShear: 0.35, maxSquash: 0.42, breathing: 0.02, breathingRate: 2.1, tremble: 0.006 },
};

// Body shapes, from a unit sphere. All end up roughly 1.6 tall.
const SHAPES = {
  mochi: (x, y, z) => [x * 1.05, y > 0 ? Math.pow(y, 0.8) * 1.05 : y * 0.18, z * 0.95],
  drop: (x, y, z) => {
    const t = (y + 1) / 2;
    const k = 1 - 0.62 * Math.pow(t, 2.2);
    return [x * 0.88 * k, y > 0 ? y * 1.25 : y * 0.32, z * 0.82 * k];
  },
  bean: (x, y, z) => [x * 0.78, y > 0 ? y * 1.18 : y * 0.42, z * 0.74],
};

const MOUTHS = {
  smile: [[-0.16, 0.03], [-0.08, -0.04], [0, -0.06], [0.08, -0.04], [0.16, 0.03]],
  grin: [[-0.2, 0.05], [-0.1, -0.07], [0, -0.1], [0.1, -0.07], [0.2, 0.05]],
  flat: [[-0.1, -0.02], [0, -0.025], [0.1, -0.02]],
  frown: [[-0.14, -0.06], [-0.07, -0.01], [0, 0.0], [0.07, -0.01], [0.14, -0.06]],
  open: [[0, 0.06], [0.07, 0.03], [0.08, -0.04], [0, -0.09], [-0.08, -0.04], [-0.07, 0.03], [0, 0.06]],
  chew: [[-0.07, -0.02], [-0.03, -0.05], [0.03, -0.01], [0.07, -0.04]],
};

let shared = null;
function sharedParts() {
  if (shared) return shared;
  const eye = new IcosahedronGeometry(0.088, 4);
  eye.scale(1, 1.12, 0.62);
  const tubes = {};
  for (const [k, pts] of Object.entries(MOUTHS)) {
    const curve = new CatmullRomCurve3(pts.map(([x, y]) => new Vector3(x, y, 0)), k === 'open');
    tubes[k] = new TubeGeometry(curve, 32, 0.011, 6, k === 'open');
  }
  shared = {
    eye,
    shine: new IcosahedronGeometry(0.02, 2),
    bubble: new IcosahedronGeometry(1, 2),
    tubes,
    ink: new MeshPhysicalMaterial({ color: '#0d0907', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1 }),
    white: new MeshBasicMaterial({ color: new Color(6, 6, 6) }),
    bubbleMat: new MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, transmission: 1, thickness: 0.02, ior: 1.1, clearcoat: 1 }),
    heart: new SpriteMaterial({ map: heartTexture(), transparent: true, depthWrite: false }),
  };
  return shared;
}

export class Customer {
  constructor(look, seed = 1) {
    this.look = look;
    const base = unitSphere(12);
    const fn = SHAPES[look.shape] || SHAPES.mochi;
    const pos = new Float32Array(base.pos.length);
    for (let i = 0; i < pos.length; i += 3) {
      const [x, y, z] = fn(base.pos[i], base.pos[i + 1], base.pos[i + 2]);
      pos[i] = x;
      pos[i + 1] = y;
      pos[i + 2] = z;
    }
    const mesh = bodyMesh(pos, base.idx);
    this.squishy = new Squishy(mesh, jellyCustomerMaterial(look.color, look.attenuation), CUSTOMER_SIM);
    this.squishy.mesh.castShadow = true;
    this.body = this.squishy.body;
    this.group = new Group();
    this.inner = new Group(); // hop offsets live here
    this.inner.add(this.squishy.mesh);
    this.group.add(this.inner);
    this.buildFace();
    this.buildCore();
    this.expression = 'smile';
    this.setExpression('smile');
    this.hop = null;
    this.blinkAt = 1 + Math.random() * 3;
    this.time = Math.random() * 10;
    this.impatience = 0;
    this.hearts = [];
    this.seed = seed;
  }

  // Pin each face part to the surface vertex nearest its spot on the front.
  anchorAt(x, y) {
    const { rest, restNormal, N } = this.body;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < N; i++) {
      if (restNormal[i * 3 + 2] < 0.3) continue;
      const d = (rest[i * 3] - x) ** 2 + (rest[i * 3 + 1] - y) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  buildFace() {
    const s = sharedParts();
    const H = this.body.height;
    const W = this.body.width;
    const eyeY = H * (this.look.shape === 'drop' ? 0.48 : 0.58);
    const spread = Math.min(0.32, W * 0.2);
    this.parts = [];
    const add = (obj, x, y, lift) => {
      this.inner.add(obj);
      this.parts.push({ obj, v: this.anchorAt(x, y), lift });
      return obj;
    };
    this.eyes = [-1, 1].map((side) => {
      const g = new Group();
      const e = new Mesh(s.eye, s.ink);
      const shine = new Mesh(s.shine, s.white);
      shine.position.set(0.03, 0.045, 0.05);
      g.add(e, shine);
      return add(g, side * spread * 0.85, eyeY, 0.022);
    });
    this.mouth = new Mesh(s.tubes.smile, s.ink);
    this.mouth.scale.setScalar(0.75);
    add(this.mouth, 0, eyeY - 0.2, 0.02);
  }

  // A softly lit candy core and a few suspended bubbles, seen through the
  // clear jelly. The core is opaque, so the jelly refracts and tints it.
  buildCore() {
    const s = sharedParts();
    const H = this.body.height;
    const core = new Mesh(
      new IcosahedronGeometry(1, 5),
      new MeshStandardMaterial({ color: new Color(this.look.core), emissive: new Color(this.look.core), emissiveIntensity: 0.18, roughness: 0.7 }),
    );
    core.scale.set(this.body.width * 0.26, H * 0.24, this.body.depth * 0.24);
    core.position.y = H * 0.36;
    this.core = core;
    this.coreRest = core.position.y;
    this.inner.add(core);
    this.bubbles = [];
    const rand = mulberry(this.look.name.length * 31 + 7);
    const { rest, N } = this.body;
    for (let k = 0; k < 9; k++) {
      const v = Math.floor(rand() * N);
      const b = new Mesh(s.bubble, s.bubbleMat);
      const r = 0.012 + rand() * 0.03;
      b.scale.setScalar(r);
      const depth = 0.25 + rand() * 0.45;
      this.bubbles.push({ mesh: b, v, depth });
      this.inner.add(b);
    }
    void rest;
  }

  setExpression(name) {
    if (!MOUTHS[name]) return;
    this.expression = name;
    this.mouth.geometry = sharedParts().tubes[name];
  }

  // Squash hello: little hop in place.
  poke(strength = 1) {
    this.body.impulse(0, this.body.height * 0.6, 0.6, 0, -0.3, -1, 2.2 * strength, 0.45);
    this.body.kickAll((Math.random() - 0.5) * 1.2, 1.3 * strength, -0.6);
  }

  hopTo(target, duration = 0.55, height = 1.2) {
    return new Promise((resolve) => {
      this.hop = { from: this.group.position.clone(), to: target.clone(), t: 0, duration, height, resolve };
      this.body.kickAll(0, -1.6, 0);
    });
  }

  celebrate() {
    const s = sharedParts();
    for (let i = 0; i < 5; i++) {
      const h = new Sprite(s.heart);
      h.scale.setScalar(0.3);
      h.position.set((Math.random() - 0.5) * 0.9, this.body.height * 0.9, 0.3);
      h.userData = { vy: 0.9 + Math.random() * 0.6, vx: (Math.random() - 0.5) * 0.5, life: 0, delay: i * 0.12 };
      h.visible = false;
      this.inner.add(h);
      this.hearts.push(h);
    }
    this.setExpression('grin');
    this.body.kickAll(0, -2.4, 0);
  }

  update(dt) {
    this.time += dt;
    const b = this.body;
    // Waiting too long: sag and lose the smile.
    b.userMode[1] = 0.16 * this.impatience;
    if (this.hop) {
      const h = this.hop;
      h.t = Math.min(1, h.t + dt / h.duration);
      const k = h.t;
      this.group.position.lerpVectors(h.from, h.to, k);
      this.inner.position.y = Math.sin(Math.PI * k) * h.height;
      if (k === 1) {
        this.hop = null;
        this.inner.position.y = 0;
        b.kickAll(0, 2.4, 0);
        h.resolve();
      }
    }
    this.squishy.step(dt);

    // Face follows the surface.
    const { out, normal } = b;
    for (const p of this.parts) {
      const i3 = p.v * 3;
      const n = new Vector3(normal[i3], normal[i3 + 1], normal[i3 + 2]);
      p.obj.position.set(out[i3] + n.x * p.lift, out[i3 + 1] + n.y * p.lift, out[i3 + 2] + n.z * p.lift);
      p.obj.lookAt(p.obj.position.clone().add(n));
    }
    // The core rides the squash a little behind the surface.
    const sq = this.body.mode[1];
    this.core.position.y = this.coreRest * (1 - sq * 0.8);
    this.core.position.x = this.body.mode[0] * 0.5;
    this.core.position.z = this.body.mode[2] * 0.5;
    for (const bb of this.bubbles) {
      const i3 = bb.v * 3;
      bb.mesh.position.set(out[i3] * (1 - bb.depth), out[i3 + 1] * (1 - bb.depth * 0.6) + 0.05, out[i3 + 2] * (1 - bb.depth));
    }
    // Blink.
    this.blinkAt -= dt;
    const closing = this.blinkAt < 0 ? Math.max(0.08, Math.abs(this.blinkAt + 0.07) / 0.07) : 1;
    if (this.blinkAt < -0.14) this.blinkAt = 2 + Math.random() * 4;
    for (const e of this.eyes) e.scale.y = Math.min(1, closing) * (this.impatience > 0.7 ? 0.6 : 1);
    // Hearts float up and fade.
    for (const h of this.hearts) {
      const u = h.userData;
      if (u.delay > 0) {
        u.delay -= dt;
        continue;
      }
      h.visible = true;
      u.life += dt;
      h.position.y += u.vy * dt;
      h.position.x += u.vx * dt;
      h.material.opacity = 1;
      h.scale.setScalar(0.3 + u.life * 0.15);
      if (u.life > 1.4) h.visible = false;
    }
    this.hearts = this.hearts.filter((h) => {
      if (h.userData.life > 1.4) {
        this.inner.remove(h);
        return false;
      }
      return true;
    });
  }

  dispose() {
    this.squishy.dispose();
    this.squishy.mesh.material.dispose();
  }
}

function heartTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ff5c8a';
  ctx.beginPath();
  ctx.moveTo(32, 54);
  ctx.bezierCurveTo(4, 36, 6, 10, 22, 10);
  ctx.bezierCurveTo(28, 10, 32, 15, 32, 19);
  ctx.bezierCurveTo(32, 15, 36, 10, 42, 10);
  ctx.bezierCurveTo(58, 10, 60, 36, 32, 54);
  ctx.fill();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}
