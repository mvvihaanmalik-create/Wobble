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
  TorusGeometry,
  Vector2,
  CapsuleGeometry,
  CircleGeometry,
  CanvasTexture,
  MeshStandardMaterial,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LAYOUT } from './config.js';
import { softMaterial } from './critters.js';
import { bakeFoodCoords, foodMaterial, plain, riceGrainGeometry, riceGrainMaterial } from './materials.js';

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
    this.buildBench();
    this.buildSign();
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
    const apron = new Mesh(withFood(new BoxGeometry(w, 4, 0.3)), foodMaterial('walnut'));
    apron.position.set(top.position.x, -c.thickness - 2, c.zChef - 0.15);
    const ledge = shadowed(new Mesh(withFood(new BoxGeometry(w, 0.5, 2.2)), foodMaterial('geta')), true, true);
    ledge.position.set(top.position.x, -c.thickness - 0.25, c.zCustomer - 1.1);
    this.group.add(apron, ledge);
  }

  buildBackdrop() {
    // Dark back wall faced with vertical walnut slats.
    const wall = new Mesh(new PlaneGeometry(80, 40), plain.dark());
    wall.position.set(0, 6, -17.4);
    this.group.add(wall);
    const slats = [];
    for (let x = -34; x <= 26; x += 0.62) {
      const g = new BoxGeometry(0.42, 22, 0.3);
      g.translate(x, 6, -17);
      slats.push(g);
    }
    const slatGeo = mergeGeometries(slats);
    // Grain runs up the slats: swap x and y in the pattern coordinates.
    const sp = slatGeo.attributes.position.array;
    const sf = new Float32Array(sp.length);
    for (let i = 0; i < sp.length; i += 3) {
      sf[i] = sp[i + 1];
      sf[i + 1] = sp[i + 2];
      sf[i + 2] = sp[i];
    }
    slatGeo.setAttribute('aFood', new BufferAttribute(sf, 3));
    const slatMesh = new Mesh(slatGeo, foodMaterial('walnut'));
    slatMesh.receiveShadow = true;
    this.group.add(slatMesh);
    // Back shelf with sake bottles and cups behind the guests.
    const shelf = shadowed(new Mesh(withFood(new BoxGeometry(52, 0.4, 2.2), 1, [0, 0, 3]), foodMaterial('geta')));
    shelf.position.set(-11, 1.9, -15.6);
    const cabinet = shadowed(new Mesh(withFood(new BoxGeometry(52, 8, 2), 1, [0, 0, 5]), foodMaterial('walnut')), false, true);
    cabinet.position.set(-11, -2.3, -15.7);
    // A dark floor, so nothing past the counter's end is a void.
    const floor = new Mesh(new PlaneGeometry(90, 40), plain.dark());
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(-8, -6.2, -4);
    floor.receiveShadow = true;
    this.group.add(shelf, cabinet, floor);
    const bottle = [new Vector2(0, 0), new Vector2(0.55, 0), new Vector2(0.62, 0.15), new Vector2(0.62, 1.5), new Vector2(0.3, 2.1), new Vector2(0.2, 2.7), new Vector2(0.24, 2.8), new Vector2(0, 2.8)];
    const cup = [new Vector2(0, 0), new Vector2(0.28, 0), new Vector2(0.36, 0.1), new Vector2(0.42, 0.5), new Vector2(0.38, 0.5), new Vector2(0.3, 0.14), new Vector2(0, 0.12)];
    const glazes = ['glazeIndigo', 'glazeShino', 'glazeRust', 'glazeCeladon', 'glazeTenmoku', 'glazeWhite'];
    const bottleGeo = withFood(new LatheGeometry(bottle, 40));
    const cupGeo = withFood(new LatheGeometry(cup, 32));
    let gi = 0;
    for (const x of [-12.5, -11, -4.5, 4.8, 11.5, 13]) {
      const b = shadowed(new Mesh(bottleGeo, foodMaterial(glazes[gi++ % glazes.length])));
      b.position.set(x, 2.1, -15.4);
      b.scale.setScalar(x === -11 || x === 13 ? 0.8 : 1);
      this.group.add(b);
    }
    for (const x of [-9.6, -9, -2.6, 2.4, 3.1, 9.8]) {
      const c = shadowed(new Mesh(cupGeo, foodMaterial(glazes[gi++ % glazes.length])));
      c.position.set(x, 2.1, -15.1);
      this.group.add(c);
    }

    // Three noren panels with slits between, swaying slightly.
    this.noren = [];
    const mat = foodMaterial('noren');
    // The sway runs in the vertex shader: no per-frame vertex work or
    // re-upload on the CPU. Each panel gets its own phase from where it hangs.
    this.norenTime = { value: 0 };
    const foodCompile = mat.onBeforeCompile;
    mat.onBeforeCompile = (shader, r) => {
      foodCompile(shader, r);
      shader.uniforms.uSway = this.norenTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
uniform float uSway;
float norenPhase() { return modelMatrix[3][0] * 0.215; }`)
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
{
  float hang = (3.25 - position.y) / 6.5;
  float A = uSway * 0.9 + norenPhase() + position.x * 0.5;
  float B = uSway * 2.1 + position.x * 2.0;
  float dx = hang * hang * (0.11 * cos(A) + 0.12 * cos(B)) + 0.2 * cos(position.x * 4.0);
  float dy = -2.0 * hang / 6.5 * (0.22 * sin(A) + 0.06 * sin(B));
  objectNormal = normalize(vec3(-dx, -dy, 1.0));
}`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
{
  float hang = (3.25 - position.y) / 6.5;
  transformed.z += hang * hang * (0.22 * sin(uSway * 0.9 + norenPhase() + position.x * 0.5) + 0.06 * sin(uSway * 2.1 + position.x * 2.0)) + 0.05 * sin(position.x * 4.0);
}`,
        );
    };
    mat.customProgramCacheKey = () => 'food-noren-sway';
    for (let i = 0; i < 3; i++) {
      const geo = new PlaneGeometry(5.9, 6.5, 40, 24);
      const x = (i - 1) * 6.05;
      withFood(geo, 1, [x, 0, 0]);
      const m = new Mesh(geo, mat);
      m.position.set(x, 7.6, -16.2);
      m.receiveShadow = true;
      this.noren.push(m);
      this.group.add(m);
    }
    const rod = new Mesh(new CylinderGeometry(0.12, 0.12, 19.5, 12), plain.horn());
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0, 10.9, -16.1);
    this.group.add(rod);

    // Paper lanterns. Their glow comes from bloom in the post chain.
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
      g.position.set(x, 7.4, -12);
      g.userData.phase = x;
      this.group.add(g);
      (this.lanterns ||= []).push(g);
    }
  }

  buildTub() {
    const t = LAYOUT.tub;
    const g = new Group();
    const wallGeo = staveCoords(new CylinderGeometry(t.radius, t.radius * 0.94, t.height, 96, 1, true));
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
    g.add(scatterGrains(rice, 1800, t.radius * 0.93, (x, z) => 0.25 * (1 - (x * x + z * z) / (t.radius * t.radius))));
    g.position.set(t.x, 0, t.z);
    this.tub = g;
    this.tubRice = rice;
    this.steam = buildSteam(t.height + 0.1, t.radius * 0.6);
    g.add(this.steam);
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
    this.getaParts = [...grp.children]; // the bare board, for photo shoots
    this.group.add(grp);
  }

  // A tall wooden shop sign on the back wall: 寿司 in brushed ink and a red
  // seal. Drawn to a canvas once the Japanese font has loaded.
  buildSign() {
    const g = new Group();
    const board = shadowed(new Mesh(withFood(new RoundedBoxGeometry(2.1, 5.4, 0.22, 3, 0.06), 1, [3, 0, 0]), foodMaterial('hinoki')));
    const cap = shadowed(new Mesh(withFood(new RoundedBoxGeometry(2.7, 0.3, 0.5, 3, 0.08)), foodMaterial('walnut')));
    cap.position.set(0, 2.85, 0.08);
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 660;
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
    const face = new Mesh(new PlaneGeometry(2.1, 5.4), new MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.42, depthWrite: false }));
    face.position.z = 0.115;
    g.add(board, cap, face);
    g.position.set(13, 6.6, -16.6);
    g.rotation.y = -0.08;
    this.group.add(g);
    const draw = () => {
      const x = c.getContext('2d');
      x.clearRect(0, 0, c.width, c.height);
      x.fillStyle = '#16100c';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.font = '600 200px "Squishi JP", serif';
      x.fillText('寿', 128, 160);
      x.fillText('司', 128, 380);
      // Seal.
      x.fillStyle = '#c23a28';
      x.fillRect(92, 520, 72, 72);
      x.fillStyle = '#f5ead8';
      x.font = '600 54px "Squishi JP", serif';
      x.fillText('屋', 128, 558);
      tex.needsUpdate = true;
    };
    if (document.fonts && document.fonts.load) document.fonts.load('600 200px "Squishi JP"', '寿司屋').then(draw, draw);
    else draw();
  }

  // Where the next guest waits: a low walnut bench with a cushion.
  buildBench() {
    const q = LAYOUT.queue;
    const bench = new Mesh(withFood(new RoundedBoxGeometry(6.4, 4, 3.4, 3, 0.12)), foodMaterial('walnut'));
    bench.position.set(q.x, q.y - 2, q.z);
    bench.receiveShadow = true;
    const cushion = shadowed(new Mesh(new RoundedBoxGeometry(4.2, 0.36, 2.8, 4, 0.16), softMaterial('#7a2a2e', { roughness: 0.8, clearcoat: 0 })));
    cushion.position.set(q.x, q.y + 0.05, q.z);
    this.group.add(bench, cushion);
  }

  buildTray() {
    const t = LAYOUT.tray;
    const plate = shadowed(new Mesh(withFood(new RoundedBoxGeometry(3.4, 0.16, 3.2, 3, 0.07), 1, [0, 0.1, 0]), foodMaterial('glazeTenmoku')));
    plate.position.set(t.x, 0.08, t.z);
    this.tray = plate;
    this.group.add(plate);
  }

  // Small bowls along the chef's edge near the serving board. Tapping one in
  // the build view picks that topping.
  buildBowls() {
    const items = [
      { key: 'wasabi', x: 5.2, glaze: 'glazeWhite' },
      { key: 'sesame', x: 7.0, glaze: 'glazeTenmoku' },
      { key: 'scallion', x: 8.8, glaze: 'glazeCeladon' },
      { key: 'ikura', x: 10.6, glaze: 'glazeIndigo' },
      { key: 'sauce', x: 12.4, glaze: 'glazeShino' },
    ];
    this.bowls = {};
    // Thrown-bowl profile: a foot ring, a gentle belly, a thin rim.
    const profile = [
      new Vector2(0, 0.03), new Vector2(0.34, 0.03), new Vector2(0.36, 0), new Vector2(0.42, 0), new Vector2(0.43, 0.05),
      new Vector2(0.62, 0.16), new Vector2(0.78, 0.38), new Vector2(0.86, 0.6), new Vector2(0.875, 0.64), new Vector2(0.85, 0.645),
      new Vector2(0.83, 0.6), new Vector2(0.75, 0.4), new Vector2(0.6, 0.22), new Vector2(0.35, 0.12), new Vector2(0, 0.1),
    ];
    const lathe = withFood(new LatheGeometry(profile, 56));
    for (const it of items) {
      const g = new Group();
      g.add(shadowed(new Mesh(lathe, foodMaterial(it.glaze))));
      g.add(bowlFill(it.key));
      g.position.set(it.x, 0, 3.75);
      g.userData.topping = it.key;
      this.bowls[it.key] = g;
      this.group.add(g);
    }
  }

  update(t) {
    this.norenTime.value = t;
    for (const l of this.lanterns) l.rotation.z = Math.sin(t * 0.7 + l.userData.phase) * 0.025;
    // Steam: each puff loops on its own phase, so this needs no state.
    for (const s of this.steam.children) {
      const d = s.userData;
      const a = ((t + d.offset) % d.life) / d.life;
      s.position.set(d.x + Math.sin(t * 0.6 + d.offset) * 0.3 * a + a * 0.5, d.y + a * 3.2, d.z);
      s.scale.setScalar(d.size * (0.6 + a * 1.4));
      s.material.opacity = Math.sin(Math.PI * a) ** 1.5 * 0.18;
      s.material.rotation = d.spin + a * 0.8;
    }
  }
}

// Soft wisps over the warm rice: noisy sprite puffs that rise and fade.
function buildSteam(y, spread) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const rand = mulberry(7);
  for (let i = 0; i < 26; i++) {
    const px = 64 + (rand() - 0.5) * 50;
    const py = 64 + (rand() - 0.5) * 50;
    const r = 14 + rand() * 30;
    const grad = x.createRadialGradient(px, py, 0, px, py, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.22)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = grad;
    x.fillRect(0, 0, 128, 128);
  }
  const tex = new CanvasTexture(c);
  const g = new Group();
  g.name = 'steam';
  for (let i = 0; i < 9; i++) {
    const s = new Sprite(new SpriteMaterial({ map: tex, color: '#fff4e6', transparent: true, depthWrite: false, opacity: 0 }));
    s.userData = { x: (rand() - 0.5) * spread * 2, y, z: (rand() - 0.5) * spread, offset: rand() * 6, life: 5 + rand() * 2, size: 1.6 + rand() * 1.2, spin: rand() * 6 };
    s.renderOrder = 4;
    g.add(s);
  }
  return g;
}

function bowlFill(key) {
  const g = new Group();
  if (key === 'wasabi') {
    const geo = withFood(new IcosahedronGeometry(0.42, 5), 2);
    geo.scale(1, 0.55, 1);
    const m = shadowed(new Mesh(geo, foodMaterial('wasabi')));
    m.position.y = 0.2;
    g.add(m);
  } else if (key === 'ikura') {
    const roe = new InstancedMesh(new IcosahedronGeometry(0.11, 3), plain.ikura(), 44);
    const o = new Object3D();
    for (let i = 0; i < 44; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * 0.55;
      o.position.set(Math.cos(a) * r, 0.2 + (1 - r / 0.55) * 0.14 + rand() * 0.06, Math.sin(a) * r);
      o.updateMatrix();
      roe.setMatrixAt(i, o.matrix);
    }
    g.add(roe);
  } else if (key === 'sesame') {
    g.add(seedPile(plain.sesame(), 700, 0.6, 0.2));
  } else if (key === 'scallion') {
    const rings = new InstancedMesh(new TorusGeometry(0.062, 0.017, 8, 22), plain.scallion(), 90);
    const o = new Object3D();
    for (let i = 0; i < 90; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * 0.6;
      o.position.set(Math.cos(a) * r, 0.2 + (1 - r / 0.6) * 0.1 + rand() * 0.08, Math.sin(a) * r);
      o.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      o.updateMatrix();
      rings.setMatrixAt(i, o.matrix);
    }
    g.add(rings);
  } else if (key === 'sauce') {
    const s = new Mesh(new CircleGeometry(0.72, 40), plain.sauce());
    s.rotation.x = -Math.PI / 2;
    s.position.y = 0.36;
    const brush = new Group();
    const handle = shadowed(new Mesh(new CylinderGeometry(0.05, 0.05, 2.2, 8), plain.handle()));
    handle.position.y = 1.1;
    const tip = new Mesh(new CylinderGeometry(0.1, 0.06, 0.35, 10), plain.sauce());
    tip.position.y = 0.1;
    brush.add(handle, tip);
    brush.rotation.z = -0.5;
    brush.position.set(0.2, 0.3, 0);
    g.add(s, brush);
  }
  return g;
}

// Pattern coordinates for barrel staves: grain runs up each stave and the
// plank seams fall every stave width around the circumference.
function staveCoords(geo) {
  const p = geo.attributes.position.array;
  const out = new Float32Array(p.length);
  for (let i = 0; i < p.length; i += 3) {
    const a = Math.atan2(p[i + 2], p[i]);
    const r = Math.hypot(p[i], p[i + 2]);
    out[i] = p[i + 1] * 3;
    out[i + 1] = r;
    out[i + 2] = a * 2.7;
  }
  geo.setAttribute('aFood', new BufferAttribute(out, 3));
  return geo;
}

function seedPile(mat, n, radius, y) {
  const geo = new IcosahedronGeometry(0.022, 1);
  geo.scale(1, 0.45, 1.75);
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
  const geo = riceGrainGeometry(CapsuleGeometry);
  const mat = riceGrainMaterial();
  const inst = new InstancedMesh(geo, mat, n);
  const o = new Object3D();
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * radius;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    o.position.set(x, surfaceMesh.position.y + heightAt(x, z) + 0.02 + rand() * 0.03, z);
    o.rotation.set(Math.PI / 2 + (rand() - 0.5) * 0.5, rand() * 6.28, (rand() - 0.5) * 0.5);
    o.updateMatrix();
    inst.setMatrixAt(i, o.matrix);
  }
  // Loose grains lie on the rice: their shadows would be a texel or two.
  inst.castShadow = false;
  inst.receiveShadow = true;
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
