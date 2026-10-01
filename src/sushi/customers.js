import {
  CanvasTexture,
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
  const eye = new IcosahedronGeometry(0.1, 3);
  eye.scale(1, 1.2, 0.55);
  const tubes = {};
  for (const [k, pts] of Object.entries(MOUTHS)) {
    const curve = new CatmullRomCurve3(pts.map(([x, y]) => new Vector3(x, y, 0)), k === 'open');
    tubes[k] = new TubeGeometry(curve, 24, 0.022, 6, k === 'open');
  }
  shared = {
    eye,
    shine: new IcosahedronGeometry(0.028, 1),
    blush: new CircleGeometry(0.1, 20),
    tubes,
    ink: new MeshPhysicalMaterial({ color: '#1a1412', roughness: 0.15, clearcoat: 1 }),
    white: new MeshBasicMaterial({ color: '#ffffff' }),
    blushMat: new MeshBasicMaterial({ color: '#ff7f9c', transparent: true, opacity: 0.45, depthWrite: false }),
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
    this.body = this.squishy.body;
    this.group = new Group();
    this.inner = new Group(); // hop offsets live here
    this.inner.add(this.squishy.mesh);
    this.group.add(this.inner);
    this.buildFace();
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
      return add(g, side * spread, eyeY, 0.03);
    });
    for (const side of [-1, 1]) {
      const b = new Mesh(s.blush, s.blushMat);
      add(b, side * (spread + 0.16), eyeY - 0.17, 0.025);
    }
    this.mouth = new Mesh(s.tubes.smile, s.ink);
    add(this.mouth, 0, eyeY - 0.24, 0.03);
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
