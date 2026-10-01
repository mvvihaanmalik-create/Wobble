import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  DynamicDrawUsage,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  OctahedronGeometry,
  Vector3,
} from 'three';
import { riceGrainGeometry, riceGrainMaterial } from './materials.js';

const _o = new Object3D();
const _v = new Vector3();

// Small pooled particle systems: rice grains that fly when you scoop and
// press, and bright glints that catch the bloom on good moves.
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.pools = {
      grain: this.pool(riceGrainGeometry(CapsuleGeometry), riceGrainMaterial(), 160),
      glint: this.pool(new OctahedronGeometry(0.06, 0), new MeshBasicMaterial({ color: new Color(8, 6.5, 4.2), toneMapped: false }), 120),
      droplet: this.pool(new OctahedronGeometry(0.035, 1), new MeshBasicMaterial({ color: new Color(1.6, 1.7, 1.8), transparent: true, opacity: 0.8 }), 80),
    };
    this.trail = new KnifeTrail(scene);
  }

  pool(geo, mat, n) {
    const mesh = new InstancedMesh(geo, mat, n);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    this.scene.add(mesh);
    return { mesh, items: [], max: n };
  }

  // kind: grain | glint | droplet. at: world position.
  burst(kind, at, count, { speed = 2.5, up = 2.5, spread = 1, life = 0.8, size = 1, gravity = 14 } = {}) {
    const p = this.pools[kind];
    for (let i = 0; i < count; i++) {
      if (p.items.length >= p.max) p.items.shift();
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      p.items.push({
        pos: at.clone().add(new Vector3((Math.random() - 0.5) * 0.3 * spread, 0, (Math.random() - 0.5) * 0.3 * spread)),
        vel: new Vector3(Math.cos(a) * s * spread, up * (0.5 + Math.random() * 0.8), Math.sin(a) * s * spread),
        spin: new Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12),
        rot: new Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        age: 0,
        life: life * (0.7 + Math.random() * 0.6),
        size: size * (0.7 + Math.random() * 0.6),
        gravity,
      });
    }
  }

  update(dt) {
    for (const p of Object.values(this.pools)) {
      p.items = p.items.filter((it) => (it.age += dt) < it.life);
      p.items.forEach((it, k) => {
        it.vel.y -= it.gravity * dt;
        it.pos.addScaledVector(it.vel, dt);
        if (it.pos.y < 0.02) {
          it.pos.y = 0.02;
          it.vel.multiplyScalar(0.3);
          it.vel.y = Math.abs(it.vel.y) * 0.3;
        }
        it.rot.addScaledVector(it.spin, dt);
        const t = it.age / it.life;
        _o.position.copy(it.pos);
        _o.rotation.set(it.rot.x, it.rot.y, it.rot.z);
        _o.scale.setScalar(it.size * (t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3));
        _o.updateMatrix();
        p.mesh.setMatrixAt(k, _o.matrix);
      });
      p.mesh.count = p.items.length;
      p.mesh.instanceMatrix.needsUpdate = true;
    }
    this.trail.update(dt);
  }
}

// A bright ribbon that follows the knife stroke and fades.
class KnifeTrail {
  constructor(scene) {
    this.max = 48;
    this.points = [];
    const geo = new BufferGeometry();
    this.pos = new Float32Array(this.max * 2 * 3);
    this.alpha = new Float32Array(this.max * 2);
    geo.setAttribute('position', new BufferAttribute(this.pos, 3).setUsage(DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < this.max - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(idx);
    this.geo = geo;
    this.mat = new MeshBasicMaterial({ color: new Color(3.2, 3.1, 2.9), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: 2, toneMapped: false });
    this.mesh = new Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    scene.add(this.mesh);
    this.fade = 0;
  }

  start() {
    this.points = [];
    this.fade = 1;
  }

  add(p) {
    this.points.push(p.clone());
    if (this.points.length > this.max) this.points.shift();
    this.fade = 1;
    this.rebuild();
  }

  end() {
    this.ending = true;
  }

  rebuild() {
    const pts = this.points;
    const n = pts.length;
    for (let i = 0; i < this.max; i++) {
      const p = pts[Math.min(i, n - 1)] || _v.set(0, -100, 0);
      const prev = pts[Math.max(0, Math.min(i, n - 1) - 1)] || p;
      const next = pts[Math.min(n - 1, i + 1)] || p;
      const dir = _v.subVectors(next, prev);
      const w = 0.07 * Math.min(1, (i + 1) / Math.max(1, n)) ;
      const nx = -dir.y;
      const ny = dir.x;
      const l = Math.hypot(nx, ny) || 1;
      this.pos.set([p.x + (nx / l) * w, p.y + (ny / l) * w, p.z], i * 6);
      this.pos.set([p.x - (nx / l) * w, p.y - (ny / l) * w, p.z], i * 6 + 3);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.setDrawRange(0, Math.max(0, (n - 1) * 6));
  }

  update(dt) {
    if (this.ending) this.fade = Math.max(0, this.fade - dt * 4);
    if (this.fade === 0) this.ending = false;
    this.mat.opacity = this.fade * 0.85;
  }
}

export function haptic(ms = 12) {
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch {
    // Not supported; fine.
  }
}

