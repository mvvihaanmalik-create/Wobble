import {
  BoxGeometry,
  BufferAttribute,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  Mesh,
  Object3D,
  PlaneGeometry,
  Shape,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector2,
  AdditiveBlending,
  CapsuleGeometry,
  CircleGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { LAYOUT } from './config.js';
import { bakeFoodCoords, foodMaterial, plain } from './materials.js';
import { glowTexture } from './stage.js';

const rand = mulberry(7);

function withFood(geo, scale = 1, offset) {
  geo.setAttribute('aFood', new BufferAttribute(bakeFoodCoords(geo, scale, offset), 3));
  return geo;
}

function shadowed(mesh, cast = true, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

// Everything that does not move much: counter, back wall, curtain, lanterns,
// tub, board, serving board, bowls and garnish.
export class SushiSet {
  constructor(scene) {
    this.group = new Group();
    scene.add(this.group);
    this.buildCounter();
    this.buildBackdrop();
    this.buildTub();
    this.buildMat();
    this.buildBoard();
    this.buildGeta();
    this.buildTray();
    this.buildBowls();
    this.knife = buildKnife();
    this.group.add(this.knife);
  }

  buildCounter() {
    const c = LAYOUT.counter;
    const w = c.x1 - c.x0;
    const d = c.zChef - c.zCustomer;
    const geo = withFood(new BoxGeometry(w, c.thickness, d, 1, 1, 1), 1, [0, 0, 0]);
    const top = shadowed(new Mesh(geo, foodMaterial('hinoki')), false, true);
    top.position.set((c.x0 + c.x1) / 2, -c.thickness / 2, (c.zChef + c.zCustomer) / 2);
    this.group.add(top);
    // Darker apron below the chef's edge, and a step down to the guests.
    const apron = new Mesh(new BoxGeometry(w, 4, 0.3), plain.dark());
    apron.position.set(top.position.x, -c.thickness - 2, c.zChef - 0.15);
    const ledge = shadowed(new Mesh(withFood(new BoxGeometry(w, 0.5, 2.2)), foodMaterial('geta')), true, true);
    ledge.position.set(top.position.x, -c.thickness - 0.25, c.zCustomer - 1.1);
    this.group.add(apron, ledge);
  }

  buildBackdrop() {
    const wall = new Mesh(new PlaneGeometry(80, 40), plain.wall());
    wall.position.set(0, 6, -17);
    this.group.add(wall);
    // Back shelf with sake bottles and cups behind the guests.
    const shelf = shadowed(new Mesh(withFood(new BoxGeometry(30, 0.4, 2.2), 1, [0, 0, 3]), foodMaterial('geta')));
    shelf.position.set(0, 1.9, -15.6);
    const cabinet = new Mesh(new BoxGeometry(30, 8, 2), plain.plaster());
    cabinet.position.set(0, -2.3, -15.7);
    this.group.add(shelf, cabinet);
    const bottle = [new Vector2(0, 0), new Vector2(0.55, 0), new Vector2(0.62, 0.15), new Vector2(0.62, 1.5), new Vector2(0.3, 2.1), new Vector2(0.2, 2.7), new Vector2(0.24, 2.8), new Vector2(0, 2.8)];
    const cup = [new Vector2(0, 0), new Vector2(0.28, 0), new Vector2(0.36, 0.1), new Vector2(0.42, 0.5), new Vector2(0.38, 0.5), new Vector2(0.3, 0.14), new Vector2(0, 0.12)];
    const glazes = ['#2f4d6b', '#e8dfcf', '#7a3b22', '#3d5a3a', '#d9c7a8'];
    let gi = 0;
    for (const x of [-12.5, -11, -4.5, 4.8, 11.5, 13]) {
      const b = shadowed(new Mesh(new LatheGeometry(bottle, 28), plain.glaze(glazes[gi++ % glazes.length])));
      b.position.set(x, 2.1, -15.4);
      b.scale.setScalar(x === -11 || x === 13 ? 0.8 : 1);
      this.group.add(b);
    }
    for (const x of [-9.6, -9, -2.6, 2.4, 3.1, 9.8]) {
      const c = shadowed(new Mesh(new LatheGeometry(cup, 24), plain.glaze(glazes[gi++ % glazes.length])));
      c.position.set(x, 2.1, -15.1);
      this.group.add(c);
    }

    // Three noren panels with slits between, swaying slightly.
    this.noren = [];
    const mat = foodMaterial('noren');
    for (let i = 0; i < 3; i++) {
      const geo = new PlaneGeometry(5.9, 6.5, 40, 24);
      const x = (i - 1) * 6.05;
      withFood(geo, 1, [x, 0, 0]);
      const m = new Mesh(geo, mat);
      m.position.set(x, 7.6, -16.2);
      m.receiveShadow = true;
      m.userData.rest = geo.attributes.position.array.slice();
      m.userData.phase = i * 1.3;
      this.noren.push(m);
      this.group.add(m);
    }
    const rod = new Mesh(new CylinderGeometry(0.12, 0.12, 19.5, 12), plain.horn());
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0, 10.9, -16.1);
    this.group.add(rod);

    // Paper lanterns with a soft glow.
    const glow = new SpriteMaterial({ map: glowTexture(), blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55, toneMapped: false });
    const profile = [];
    for (let k = 0; k <= 20; k++) {
      const t = k / 20;
      profile.push(new Vector2(Math.sin(Math.PI * t) * 1.05 + 0.25, -1.6 + t * 3.2));
    }
    for (const x of [-9, 9]) {
      const g = new Group();
      const body = new Mesh(new LatheGeometry(profile, 32), plain.lantern());
      g.add(body);
      for (let k = 1; k < 8; k++) {
        const t = k / 8;
        const rr = Math.sin(Math.PI * t) * 1.05 + 0.26;
        const rib = new Mesh(new TorusGeometry(rr, 0.018, 6, 40), plain.horn());
        rib.rotation.x = Math.PI / 2;
        rib.position.y = -1.6 + t * 3.2;
        g.add(rib);
      }
      for (const y of [-1.65, 1.65]) {
        const cap = new Mesh(new CylinderGeometry(0.42, 0.42, 0.22, 24), plain.horn());
        cap.position.y = y;
        g.add(cap);
      }
      const halo = new Sprite(glow);
      halo.scale.setScalar(7);
      g.add(halo);
      g.position.set(x, 7.4, -12);
      g.userData.phase = x;
      this.group.add(g);
      (this.lanterns ||= []).push(g);
    }
  }

  buildTub() {
    const t = LAYOUT.tub;
    const g = new Group();
    const wallGeo = withFood(new CylinderGeometry(t.radius, t.radius * 0.94, t.height, 64, 1, true), 1);
    const wall = shadowed(new Mesh(wallGeo, foodMaterial('tub', { side: 2 })));
    wall.position.y = t.height / 2;
    const base = shadowed(new Mesh(withFood(new CylinderGeometry(t.radius * 0.94, t.radius * 0.94, 0.12, 64)), foodMaterial('tub')));
    base.position.y = 0.06;
    g.add(wall, base);
    for (const y of [0.3, t.height - 0.25]) {
      const band = shadowed(new Mesh(new TorusGeometry(t.radius * (y < 0.5 ? 0.955 : 0.995) + 0.02, 0.055, 8, 80), plain.copper()));
      band.rotation.x = Math.PI / 2;
      band.position.y = y;
      g.add(band);
    }
    // The rice inside: a gently heaped surface and loose grains on top.
    const surf = new CircleGeometry(t.radius * 0.97, 64, 0, Math.PI * 2);
    surf.rotateX(-Math.PI / 2);
    const p = surf.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      const r = Math.hypot(p[i], p[i + 2]) / t.radius;
      p[i + 1] = 0.25 * (1 - r * r) + 0.04 * Math.sin(p[i] * 3.1) * Math.cos(p[i + 2] * 2.7);
    }
    surf.computeVertexNormals();
    withFood(surf, 1);
    const rice = shadowed(new Mesh(surf, foodMaterial('rice')), false, true);
    rice.position.y = t.height - 0.38;
    g.add(rice);
    g.add(scatterGrains(rice, 520, t.radius * 0.92, (x, z) => 0.25 * (1 - (x * x + z * z) / (t.radius * t.radius))));
    g.position.set(t.x, 0, t.z);
    this.tub = g;
    this.tubRice = rice;
    this.group.add(g);
  }

  // Bamboo rolling mat where the rice gets pressed.
  buildMat() {
    const m = LAYOUT.mat;
    const slats = 15;
    const geo = new CapsuleGeometry(0.11, 3.4, 4, 10);
    geo.rotateX(Math.PI / 2);
    const mat = plain.glaze('#c9b27a');
    mat.roughness = 0.5;
    const inst = new InstancedMesh(geo, mat, slats);
    const o = new Object3D();
    for (let i = 0; i < slats; i++) {
      o.position.set((i - (slats - 1) / 2) * 0.24, 0.11, 0);
      o.updateMatrix();
      inst.setMatrixAt(i, o.matrix);
    }
    shadowed(inst);
    inst.position.set(m.x, 0, m.z);
    this.mat = inst;
    this.group.add(inst);
  }

  buildBoard() {
    const b = LAYOUT.board;
    const geo = withFood(new RoundedBoxGeometry(b.w, b.h, b.d, 3, 0.06), 1, [b.x, 0, b.z]);
    const board = shadowed(new Mesh(geo, foodMaterial('board')));
    board.position.set(b.x, b.h / 2, b.z);
    this.board = board;
    this.group.add(board);
  }

  buildGeta() {
    const g = LAYOUT.geta;
    const grp = new Group();
    const topGeo = withFood(new RoundedBoxGeometry(g.w, 0.3, g.d, 3, 0.05), 1, [g.x, 0, g.z]);
    const top = shadowed(new Mesh(topGeo, foodMaterial('geta')));
    top.position.y = g.h - 0.15;
    grp.add(top);
    for (const x of [-g.w / 2 + 0.6, g.w / 2 - 0.6]) {
      const foot = shadowed(new Mesh(withFood(new BoxGeometry(0.35, g.h - 0.3, g.d * 0.92)), foodMaterial('geta')));
      foot.position.set(x, (g.h - 0.3) / 2, 0);
      grp.add(foot);
    }
    // Pickled ginger and a shiso leaf at the end of the board.
    const garnish = new Group();
    const gMat = plain.ginger();
    for (let i = 0; i < 7; i++) {
      const s = new Mesh(new CircleGeometry(0.38 + rand() * 0.12, 20), gMat);
      const pos = s.geometry.attributes.position.array;
      for (let k = 0; k < pos.length; k += 3) pos[k + 2] = 0.06 * Math.sin(pos[k] * 6 + i) + 0.05 * (pos[k] * pos[k] + pos[k + 1] * pos[k + 1]) * 3;
      s.geometry.computeVertexNormals();
      s.rotation.set(-Math.PI / 2 + (rand() - 0.5) * 0.9, (rand() - 0.5) * 0.6, rand() * 6);
      s.position.set((rand() - 0.5) * 0.35, 0.08 + i * 0.05, (rand() - 0.5) * 0.4);
      shadowed(s);
      garnish.add(s);
    }
    const leaf = shadowed(new Mesh(leafGeometry(), plain.shiso()));
    leaf.rotation.set(-Math.PI / 2 + 0.12, 0, 0.5);
    leaf.position.set(-0.1, 0.03, 0.1);
    garnish.add(leaf);
    garnish.position.set(g.w / 2 - 0.85, g.h, 0.25);
    grp.add(garnish);
    grp.position.set(g.x, 0, g.z);
    this.geta = grp;
    this.group.add(grp);
  }

  buildTray() {
    const t = LAYOUT.tray;
    const plate = shadowed(new Mesh(new RoundedBoxGeometry(3.4, 0.16, 3.2, 3, 0.07), plain.ceramic('#2c3b4f')));
    plate.position.set(t.x, 0.08, t.z);
    this.tray = plate;
    this.group.add(plate);
  }

  // Small bowls along the chef's edge near the serving board. Tapping one in
  // the build view picks that topping.
  buildBowls() {
    const items = [
      { key: 'wasabi', x: 5.2, color: '#e9e4da' },
      { key: 'sesame', x: 7.0, color: '#2d2a28' },
      { key: 'scallion', x: 8.8, color: '#f0ebe0' },
      { key: 'ikura', x: 10.6, color: '#1f2b3d' },
      { key: 'sauce', x: 12.4, color: '#b4502e' },
    ];
    this.bowls = {};
    const profile = [new Vector2(0, 0), new Vector2(0.45, 0), new Vector2(0.62, 0.12), new Vector2(0.8, 0.5), new Vector2(0.86, 0.62), new Vector2(0.8, 0.62), new Vector2(0.72, 0.5), new Vector2(0.55, 0.16), new Vector2(0, 0.14)];
    const lathe = new LatheGeometry(profile, 40);
    for (const it of items) {
      const g = new Group();
      g.add(shadowed(new Mesh(lathe, plain.ceramic(it.color))));
      g.add(bowlFill(it.key));
      g.position.set(it.x, 0, 3.75);
      g.userData.topping = it.key;
      this.bowls[it.key] = g;
      this.group.add(g);
    }
  }

  update(t) {
    for (const m of this.noren) {
      const pos = m.geometry.attributes.position.array;
      const rest = m.userData.rest;
      const ph = m.userData.phase;
      for (let i = 0; i < pos.length; i += 3) {
        const y = rest[i + 1];
        const hang = (3.25 - y) / 6.5; // 0 at the rod, 1 at the hem
        pos[i + 2] = rest[i + 2] + hang * hang * (0.22 * Math.sin(t * 0.9 + ph + rest[i] * 0.5) + 0.06 * Math.sin(t * 2.1 + rest[i] * 2.0)) + 0.05 * Math.sin(rest[i] * 4.0);
      }
      m.geometry.attributes.position.needsUpdate = true;
      m.geometry.computeVertexNormals();
    }
    for (const l of this.lanterns) l.rotation.z = Math.sin(t * 0.7 + l.userData.phase) * 0.025;
  }
}

function bowlFill(key) {
  const g = new Group();
  if (key === 'wasabi') {
    const geo = withFood(new IcosahedronGeometry(0.42, 5), 2);
    geo.scale(1, 0.55, 1);
    const m = shadowed(new Mesh(geo, foodMaterial('wasabi')));
    m.position.y = 0.32;
    g.add(m);
  } else if (key === 'ikura') {
    const roe = new InstancedMesh(new IcosahedronGeometry(0.11, 3), plain.ikura(), 18);
    const o = new Object3D();
    for (let i = 0; i < 18; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * 0.5;
      o.position.set(Math.cos(a) * r, 0.36 + rand() * 0.12, Math.sin(a) * r);
      o.updateMatrix();
      roe.setMatrixAt(i, o.matrix);
    }
    g.add(roe);
  } else if (key === 'sesame') {
    g.add(seedPile(plain.sesame(), 220, 0.58, 0.34));
  } else if (key === 'scallion') {
    const rings = new InstancedMesh(new TorusGeometry(0.075, 0.032, 6, 16), plain.scallion(), 40);
    const o = new Object3D();
    for (let i = 0; i < 40; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * 0.55;
      o.position.set(Math.cos(a) * r, 0.34 + rand() * 0.1, Math.sin(a) * r);
      o.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      o.updateMatrix();
      rings.setMatrixAt(i, o.matrix);
    }
    g.add(rings);
  } else if (key === 'sauce') {
    const s = new Mesh(new CircleGeometry(0.66, 32), plain.sauce());
    s.rotation.x = -Math.PI / 2;
    s.position.y = 0.42;
    const brush = new Group();
    const handle = shadowed(new Mesh(new CylinderGeometry(0.05, 0.05, 2.2, 8), plain.handle()));
    handle.position.y = 1.1;
    const tip = new Mesh(new CylinderGeometry(0.1, 0.06, 0.35, 10), plain.sauce());
    tip.position.y = 0.1;
    brush.add(handle, tip);
    brush.rotation.z = -0.5;
    brush.position.set(0.2, 0.4, 0);
    g.add(s, brush);
  }
  return g;
}

function seedPile(mat, n, radius, y) {
  const geo = new IcosahedronGeometry(0.03, 1);
  geo.scale(1, 0.5, 1.7);
  const inst = new InstancedMesh(geo, mat, n);
  const o = new Object3D();
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * radius;
    o.position.set(Math.cos(a) * r, y + (1 - r / radius) * 0.12 + rand() * 0.04, Math.sin(a) * r);
    o.rotation.set(rand() * 0.6, rand() * 6, rand() * 0.6);
    o.updateMatrix();
    inst.setMatrixAt(i, o.matrix);
  }
  return inst;
}

// Loose grains lying on a surface, for the rice tub.
function scatterGrains(surfaceMesh, n, radius, heightAt) {
  const geo = new CapsuleGeometry(0.035, 0.085, 2, 6);
  const mat = foodMaterial('rice');
  withFood(geo, 3);
  const inst = new InstancedMesh(geo, mat, n);
  const o = new Object3D();
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * radius;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    o.position.set(x, surfaceMesh.position.y + heightAt(x, z) + 0.03, z);
    o.rotation.set(Math.PI / 2 + (rand() - 0.5) * 0.5, rand() * 6.28, (rand() - 0.5) * 0.5);
    o.updateMatrix();
    inst.setMatrixAt(i, o.matrix);
  }
  inst.castShadow = true;
  return inst;
}

function leafGeometry() {
  const s = new Shape();
  s.moveTo(0, -0.75);
  s.bezierCurveTo(0.55, -0.4, 0.55, 0.35, 0, 0.8);
  s.bezierCurveTo(-0.55, 0.35, -0.55, -0.4, 0, -0.75);
  const geo = new ExtrudeGeometry(s, { depth: 0.01, bevelEnabled: false, curveSegments: 16 });
  const p = geo.attributes.position.array;
  for (let i = 0; i < p.length; i += 3) p[i + 2] += 0.12 * p[i] * p[i] - 0.05 * p[i + 1];
  geo.computeVertexNormals();
  return geo;
}

// Yanagiba: long single-bevel slicing knife.
export function buildKnife() {
  const g = new Group();
  const s = new Shape();
  s.moveTo(0, 0);
  s.lineTo(5.6, 0);
  s.quadraticCurveTo(6.5, 0.05, 6.9, 0.55);
  s.lineTo(0, 0.62);
  s.lineTo(0, 0);
  const blade = new Mesh(new ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 20 }), plain.steel());
  blade.position.set(0, -0.62, -0.015);
  const ferrule = new Mesh(new CylinderGeometry(0.17, 0.17, 0.35, 8), plain.horn());
  ferrule.rotation.z = Math.PI / 2;
  ferrule.position.set(-0.17, -0.3, 0);
  const handle = new Mesh(new CylinderGeometry(0.17, 0.15, 2.8, 8), plain.handle());
  handle.rotation.z = Math.PI / 2;
  handle.position.set(-1.75, -0.3, 0);
  g.add(blade, ferrule, handle);
  g.traverse((m) => (m.castShadow = true));
  g.visible = false;
  return g;
}

export function mulberry(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
