import {
  Color,
  DoubleSide,
  IcosahedronGeometry,
  InstancedMesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Object3D,
} from 'three';
import { FLAVORS } from './config.js';

export class JellyMaterial {
  constructor(flavorKey) {
    const f = FLAVORS[flavorKey];
    this.material = new MeshPhysicalMaterial({
      color: new Color(f.color),
      transmission: 1,
      thickness: 0.9,
      ior: 1.4,
      roughness: 0.14,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      attenuationColor: new Color(f.attenuation),
      attenuationDistance: f.attenuationDistance,
      specularIntensity: 1,
      envMapIntensity: 0.9,
      side: DoubleSide,
    });
    this.speckMaterial = new MeshBasicMaterial({ color: new Color(f.speck) });
    this.bubbleMaterial = new MeshBasicMaterial({ color: new Color('#fff1d6'), transparent: false });
    this.target = { ...this.snapshot(f) };
    this.current = { ...this.snapshot(f) };
    this.key = flavorKey;
  }

  snapshot(f) {
    return {
      color: new Color(f.color),
      attenuation: new Color(f.attenuation),
      speck: new Color(f.speck),
      glow: new Color(f.glow),
      distance: f.attenuationDistance,
    };
  }

  setFlavor(key) {
    this.key = key;
    this.target = this.snapshot(FLAVORS[key]);
  }

  // Ease the colors toward the chosen flavor.
  update(dt) {
    const t = 1 - Math.exp(-dt * 5);
    const c = this.current;
    const g = this.target;
    // Blend in HSL so Berry to Lime does not pass through brown.
    c.color.lerpHSL(g.color, t);
    c.attenuation.lerpHSL(g.attenuation, t);
    c.speck.lerpHSL(g.speck, t);
    c.glow.lerpHSL(g.glow, t);
    c.distance += (g.distance - c.distance) * t;
    const m = this.material;
    m.color.copy(c.color);
    m.attenuationColor.copy(c.attenuation);
    m.attenuationDistance = c.distance;
    this.speckMaterial.color.copy(c.speck);
    return c.glow;
  }
}

// Tiny dark specks and pale bubbles suspended inside the letters. Each one
// rides along with the vertex it was seeded from, so they move with the wobble.
export class Inclusions {
  constructor(jellyMaterial) {
    const speckGeo = new IcosahedronGeometry(1, 0);
    const bubbleGeo = new IcosahedronGeometry(1, 1);
    this.speckCap = 40;
    this.bubbleCap = 9;
    this.specks = new InstancedMesh(speckGeo, jellyMaterial.speckMaterial, this.speckCap);
    this.bubbles = new InstancedMesh(bubbleGeo, jellyMaterial.bubbleMaterial, this.bubbleCap);
    this.dummy = new Object3D();
    this.items = [];
  }

  seed(body) {
    const { rest, restNormal: n, N } = body;
    const candidates = [];
    for (let i = 0; i < N; i++) if (n[i * 3 + 2] > 0.985 && rest[i * 3 + 1] > 0.08) candidates.push(i);
    let seed = 1 + N;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    this.items = [];
    const total = this.speckCap + this.bubbleCap;
    for (let k = 0; k < total && candidates.length; k++) {
      const i = candidates[Math.floor(rand() * candidates.length)];
      const depth = 0.1 + rand() * (body.depth - 0.2);
      const bubble = k >= this.speckCap;
      this.items.push({
        i,
        x: rest[i * 3] + (rand() - 0.5) * 0.02,
        y: rest[i * 3 + 1] + (rand() - 0.5) * 0.02,
        z: rest[i * 3 + 2] - depth,
        s: bubble ? 0.006 + rand() * 0.007 : 0.004 + rand() * 0.006,
        mesh: bubble ? this.bubbles : this.specks,
        slot: bubble ? k - this.speckCap : k,
      });
    }
    this.specks.count = this.items.filter((it) => it.mesh === this.specks).length;
    this.bubbles.count = this.items.filter((it) => it.mesh === this.bubbles).length;
  }

  update(body) {
    const d = this.dummy;
    const { u, md } = body;
    for (const it of this.items) {
      const i3 = it.i * 3;
      d.position.set(
        it.x + (u[i3] + md[i3]) * 0.75,
        it.y + (u[i3 + 1] + md[i3 + 1]) * 0.75,
        it.z + (u[i3 + 2] + md[i3 + 2]) * 0.5,
      );
      d.scale.setScalar(it.s);
      d.updateMatrix();
      it.mesh.setMatrixAt(it.slot, d.matrix);
    }
    this.specks.instanceMatrix.needsUpdate = true;
    this.bubbles.instanceMatrix.needsUpdate = true;
  }
}
