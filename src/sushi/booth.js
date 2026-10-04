import {
  BoxGeometry,
  BufferAttribute,
  Color,
  DirectionalLight,
  Group,
  HalfFloatType,
  HemisphereLight,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  ShaderMaterial,
  UnsignedByteType,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  SpotLight,
  Vector3,
  WebGLRenderTarget,
} from 'three';
import { BLOCKS, FishSlice, Onigiri, Piece, RiceMound } from './food.js';
import { bakeFoodCoords, foodMaterial } from './materials.js';
import { LAYOUT, ONIGIRI } from './config.js';
import { hotOf, makiOf, nigiriOf, onigiriOf, plateLayout } from './orders.js';
import { GyozaPlate, TakoBoat, UdonBowl } from './hot.js';
import { platedMaki } from './maki.js';
import { Customer } from './critters.js';

// Photo booth: small still renders made on the main renderer between frames.
// Used for the picture on each ticket (what the plate should look like) and
// for a photo of every plate served, which goes to the gallery.
//
// Jobs run at the start of a frame. Each shot renders into its own
// multisampled buffer exactly the way the bar renders into the post chain
// (linear, untoned, the same lights and fog), so a photo never needs shader
// variants of its own: on phones, where every new shader stalls the frame,
// that is the difference between a smooth serve and a long freeze. The shot
// is then toned and copied out of the canvas corner before the main pass
// draws over it, so nothing ever flashes.
export class PhotoBooth {
  constructor(stage, set) {
    this.stage = stage;
    this.set = set;
    this.jobs = [];
    this.scene = new Scene();
    this.scene.background = new Color('#2a1b13');
    this.scene.environment = stage.scene.environment;
    this.scene.environmentIntensity = 0.7;
    this.scene.fog = stage.scene.fog;
    this.camera = new PerspectiveCamera(30, 1.6, 0.5, 60);
    // The same kinds and numbers of lights as the bar (three directional,
    // the first with a shadow, five spots, a sky light and two points), so
    // every material shares its shader with the bar. The extras are dark.
    const key = new DirectionalLight('#fff1dc', 2.6);
    key.position.set(-3, 9, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 4;
    const rim = new DirectionalLight('#ffd2a8', 1.2);
    rim.position.set(4, 3, -6);
    const fill = new DirectionalLight('#ffe6cc', 0.35);
    fill.position.set(0, 4, 10);
    this.scene.add(key, key.target, rim, fill, new HemisphereLight('#fff4e6', '#3a2416', 0.5));
    // A soft pool from above, like the bar's pin spots; four more stay off.
    for (let i = 0; i < 5; i++) {
      const s = new SpotLight('#fff1dc', i === 0 ? 14 : 0, 30, 0.6, 0.7, 1.4);
      s.position.set(-2, 10, 4);
      this.scene.add(s, s.target);
    }
    for (let i = 0; i < 2; i++) this.scene.add(new PointLight('#ff9f45', 0, 10, 1.7));
    // Tone and encode a finished shot into a small 8-bit buffer that is read
    // back without stalling: ACES, the photo exposure, then sRGB.
    this.quadMat = new ShaderMaterial({
      uniforms: { map: { value: null }, exposure: { value: 0.92 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D map; uniform float exposure; varying vec2 vUv;
vec3 rrtOdt(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 aces(vec3 c) {
  const mat3 inM = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 outM = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  c *= exposure / 0.6;
  c = inM * c; c = rrtOdt(c); c = outM * c;
  return clamp(c, 0.0, 1.0);
}
vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() { vec3 c = texture2D(map, vUv).rgb; gl_FragColor = vec4(toSRGB(aces(max(c, 0.0))), 1.0); }`,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.quad = new Mesh(new PlaneGeometry(2, 2), this.quadMat);
    this.quadScene = new Scene();
    this.quadScene.add(this.quad);
    this.quadCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    // A strip of counter under the board.
    const wood = new BoxGeometry(30, 0.4, 14);
    wood.setAttribute('aFood', new BufferAttribute(bakeFoodCoords(wood, 1, [0, 0, 0]), 3));
    const counter = new Mesh(wood, foodMaterial('hinoki'));
    counter.position.y = -0.2;
    counter.receiveShadow = true;
    this.scene.add(counter);
    this.board = new Group();
    for (const p of set.getaParts) this.board.add(p.clone());
    this.scene.add(this.board);
  }

  // Build the plate an order asks for, perfectly made, and photograph it.
  async orderPhoto(order, w = 480, h = 300) {
    const hot = hotOf(order)[0];
    if (hot) return this.hotPhoto(hot, w, h);
    const oni = onigiriOf(order)[0];
    if (oni) return this.hotPhoto(oni, w, h);
    const g = LAYOUT.geta;
    const layout = plateLayout(order);
    const wantNigiri = nigiriOf(order);
    const pieces = wantNigiri.map((want, i) => idealPiece(want, i));
    const holder = new Group();
    pieces.forEach((p, i) => {
      p.group.position.set(layout.nigiri[i] ?? 0, g.h, 0);
      p.group.rotation.y = LAYOUT.slotAngle;
      holder.add(p.group);
    });
    for (const want of makiOf(order)) {
      const roll = platedMaki(want.maki);
      roll.position.set(layout.maki ?? 0, g.h, 0);
      holder.add(roll);
    }
    // Let the fish settle over the rice, then place toppings on it.
    for (let k = 0; k < 24; k++) for (const p of pieces) p.update(1 / 30);
    pieces.forEach((p, i) => dress(p, wantNigiri[i]));
    for (let k = 0; k < 6; k++) for (const p of pieces) p.update(1 / 30);
    for (const p of pieces) if (p.slice) p.slice.toppings.update();
    // A roll with a nigiri needs the wider shot.
    const count = makiOf(order).length ? (pieces.length ? 2 : 1.4) : pieces.length;
    // The plate is only in the booth for its own shot, so queued jobs never
    // photograph each other's plates.
    const url = await this.shoot(w, h, () => {
      this.scene.add(holder);
      this.aim(count, layout);
    }, null, this.scene, () => this.scene.remove(holder));
    for (const p of pieces) p.dispose();
    return url;
  }

  // A stove dish, made perfectly, on the board.
  async hotPhoto(want, w, h) {
    const dish = want.udon || want.ramen ? UdonBowl.ideal(want.udon || want.ramen) : want.takoyaki ? TakoBoat.ideal() : want.onigiri ? Onigiri.ideal(want.onigiri, ONIGIRI[want.onigiri].color, 4) : GyozaPlate.ideal();
    if (want.onigiri) for (let k = 0; k < 30; k++) dish.update(1 / 30);
    const holder = dish.group;
    holder.position.set(-0.55, LAYOUT.geta.h, 0);
    const url = await this.shoot(w, h, () => {
      this.scene.add(holder);
      frame(this.camera, new Vector3(-0.55, LAYOUT.geta.h + 0.5, 0), 1.2);
    }, null, this.scene, () => this.scene.remove(holder));
    dish.dispose();
    return url;
  }

  // A portrait of a regular for the Sushi book.
  async critterPhoto(look, w = 280, h = 280) {
    const c = new Customer(look, 3);
    c.setExpression('smile');
    for (let k = 0; k < 20; k++) c.update(1 / 30);
    const H = c.height;
    const url = await this.shoot(w, h, () => {
      this.board.visible = false;
      this.scene.add(c.group);
      // Head and paws, a little from above, the way a character select screen does it.
      this.camera.position.set(0.8, H * 0.74, H * 1.6);
      this.camera.lookAt(0, H * 0.57, 0);
    }, null, this.scene, () => {
      this.scene.remove(c.group);
      this.board.visible = true;
    });
    c.dispose();
    return url;
  }

  aim(count, layout) {
    const xs = [...(layout ? layout.nigiri : [-0.55]), ...(layout && layout.maki != null ? [layout.maki] : [])];
    const cx = xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    frame(this.camera, new Vector3(cx, LAYOUT.geta.h + 0.45, 0), count);
  }

  // Photograph the real serving board as it sits in the scene.
  platePhoto(w = 480, h = 300, count = 1) {
    const geta = this.set.geta;
    const at = geta.position;
    return this.shoot(w, h, null, (cam) => frame(cam, new Vector3(at.x - 0.55, at.y + LAYOUT.geta.h + 0.45, at.z), count), this.stage.scene);
  }

  shoot(w, h, aim, aimCam, scene = this.scene, after = null) {
    return new Promise((resolve) => this.jobs.push({ w, h, aim, aimCam, scene, after, resolve }));
  }

  // A reusable multisampled, half float shot buffer, and an 8-bit one the
  // toned shot is read back from.
  target(w, h) {
    if (!this.rt) {
      this.rt = new WebGLRenderTarget(w, h, { type: HalfFloatType, samples: 4, minFilter: LinearFilter, magFilter: LinearFilter, generateMipmaps: false });
      this.ldr = new WebGLRenderTarget(w, h, { type: UnsignedByteType, depthBuffer: false, generateMipmaps: false });
    } else if (this.rt.width !== w || this.rt.height !== h) {
      this.rt.setSize(w, h);
      this.ldr.setSize(w, h);
    }
    return this.rt;
  }

  // Called by the stage right before the main pass. Nothing here waits on
  // the GPU: each shot is read back asynchronously and encoded when ready.
  flush() {
    if (!this.jobs.length) return;
    const r = this.stage.renderer;
    const jobs = this.jobs.splice(0);
    const prevTarget = r.getRenderTarget();
    for (const job of jobs) {
      const w = Math.max(8, Math.floor(job.w));
      const h = Math.max(8, Math.floor(job.h));
      if (job.aim) job.aim();
      const cam = this.camera;
      cam.aspect = w / h;
      if (job.aimCam) job.aimCam(cam);
      cam.updateProjectionMatrix();
      // 4x MSAA into a linear buffer, the way the bar renders into its post chain.
      const rt = this.target(w, h);
      r.setRenderTarget(rt);
      r.render(job.scene, cam);
      if (job.after) job.after();
      // Tone and encode into the 8-bit buffer, then read it back.
      this.quadMat.uniforms.map.value = rt.texture;
      r.setRenderTarget(this.ldr);
      r.render(this.quadScene, this.quadCam);
      const px = new Uint8Array(w * h * 4);
      const read = r.readRenderTargetPixelsAsync ? r.readRenderTargetPixelsAsync(this.ldr, 0, 0, w, h, px) : Promise.resolve(r.readRenderTargetPixels(this.ldr, 0, 0, w, h, px));
      read.then(() => job.resolve(encode(px, w, h))).catch(() => job.resolve(encode(px, w, h)));
    }
    r.setRenderTarget(prevTarget);
  }
}

// Both pieces sit centered on the same point; two need twice the width.
function frame(cam, target, count) {
  const dist = count > 1.5 ? 7.6 : count > 1 ? 6.2 : 4.6;
  cam.position.set(target.x - 0.25, target.y + dist * 0.56, target.z + dist * 0.83);
  cam.lookAt(target);
}

// A nigiri made perfectly: formed rice, a clean 45 degree slice.
function idealPiece(want, seed) {
  const rice = new RiceMound(0.65, 11 + seed * 7);
  rice.formed = 1;
  rice.body.setRest(rice.targetShape(1, 0));
  rice.presses = [{ quality: 1, over: 0 }];
  const p = new Piece(rice);
  for (let k = 0; k < (want.wasabi || 0); k++) p.addWasabi();
  for (const d of p.wasabi) d.userData.born = -1e9;
  const b = BLOCKS[want.fish];
  const rad = (b.angle * Math.PI) / 180;
  const lean = Math.tan(rad) * b.H;
  const t = b.thickness / Math.cos(rad);
  const x0 = 3.3;
  const slice = new FishSlice(want.fish, [[x0, 0], [x0 + t, 0], [x0 + t + lean, b.H], [x0 + lean, b.H]], b.D);
  slice.cutScore = 1;
  p.setSlice(slice, 0, 0);
  return p;
}

// Toppings, laid out the way a careful chef would.
function dress(p, want) {
  const t = p.slice && p.slice.toppings;
  if (!t || !want.toppings) return;
  const tp = want.toppings;
  const old = () => -1e9;
  const n = tp.ikura || 0;
  for (let k = 0; k < n; k++) t.addRoe((k - (n - 1) / 2) * 0.3, (k % 2) * 0.16 - 0.08);
  if (tp.scallion) {
    t.addScallion(-0.35, 0);
    t.addScallion(0.3, 0.02);
  }
  if (tp.sesame) t.addSesame(0, 0);
  if (tp.sauce) for (let k = 0; k <= 8; k++) t.addSaucePoint(-0.9 + k * 0.225, k % 2 ? 0.12 : -0.12);
  if (tp.nori) {
    p.addNori();
    p.nori.userData.born = -1e9;
  }
  for (const list of Object.values(t.items)) for (const it of list) it.born = old();
}

// GL rows run bottom to top: flip them into a 2D canvas and encode a JPEG.
function encode(px, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  const img = x.createImageData(w, h);
  const row = w * 4;
  for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * row, (h - y) * row), y * row);
  x.putImageData(img, 0, 0);
  return c.toDataURL('image/jpeg', 0.84);
}
