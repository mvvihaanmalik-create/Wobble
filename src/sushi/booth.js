import {
  ACESFilmicToneMapping,
  BoxGeometry,
  BufferAttribute,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  NoToneMapping,
  PerspectiveCamera,
  Scene,
  SpotLight,
  Vector3,
} from 'three';
import { BLOCKS, FishSlice, Piece, RiceMound } from './food.js';
import { bakeFoodCoords, foodMaterial } from './materials.js';
import { LAYOUT } from './config.js';

// Photo booth: small still renders made on the main renderer between frames.
// Used for the picture on each ticket (what the plate should look like) and
// for a photo of every plate served, which goes to the gallery.
//
// Jobs run at the start of a frame, straight to the canvas, and are copied
// out before the main pass draws over them, so nothing ever flashes.
export class PhotoBooth {
  constructor(stage, set) {
    this.stage = stage;
    this.set = set;
    this.jobs = [];
    this.scene = new Scene();
    this.scene.background = new Color('#2a1b13');
    this.scene.environment = stage.scene.environment;
    this.scene.environmentIntensity = 0.7;
    this.camera = new PerspectiveCamera(30, 1.6, 0.5, 60);
    const key = new SpotLight('#fff1dc', 34, 30, 0.6, 0.7, 1.4);
    key.position.set(-3, 9, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0004;
    key.shadow.radius = 4;
    const rim = new DirectionalLight('#ffd2a8', 1.2);
    rim.position.set(4, 3, -6);
    this.scene.add(key, key.target, rim, new HemisphereLight('#fff4e6', '#3a2416', 0.5));
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
    const g = LAYOUT.geta;
    const pieces = order.pieces.map((want, i) => idealPiece(want, i));
    const holder = new Group();
    const slots = LAYOUT.slots[pieces.length] || LAYOUT.slots[1];
    pieces.forEach((p, i) => {
      p.group.position.set(slots[i] ?? 0, g.h, 0);
      p.group.rotation.y = LAYOUT.slotAngle;
      holder.add(p.group);
    });
    // Let the fish settle over the rice, then place toppings on it.
    for (let k = 0; k < 24; k++) for (const p of pieces) p.update(1 / 30);
    pieces.forEach((p, i) => dress(p, order.pieces[i]));
    for (let k = 0; k < 6; k++) for (const p of pieces) p.update(1 / 30);
    for (const p of pieces) if (p.slice) p.slice.toppings.update();
    // The plate is only in the booth for its own shot, so queued jobs never
    // photograph each other's plates.
    const url = await this.shoot(w, h, () => {
      this.scene.add(holder);
      this.aim(pieces.length);
    }, null, this.scene, () => this.scene.remove(holder));
    for (const p of pieces) p.dispose();
    return url;
  }

  aim(count) {
    frame(this.camera, new Vector3(-0.55, LAYOUT.geta.h + 0.45, 0), count);
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

  // Called by the stage right before the main pass.
  flush() {
    if (!this.jobs.length) return;
    const r = this.stage.renderer;
    const canvas = r.domElement;
    const pr = r.getPixelRatio();
    const jobs = this.jobs.splice(0);
    for (const job of jobs) {
      const w = Math.min(job.w, canvas.width);
      const h = Math.min(job.h, canvas.height);
      if (job.aim) job.aim();
      const cam = this.camera;
      cam.aspect = w / h;
      if (job.aimCam) job.aimCam(cam);
      cam.updateProjectionMatrix();
      const prevTone = r.toneMapping;
      const prevExposure = r.toneMappingExposure;
      r.setRenderTarget(null);
      r.toneMapping = ACESFilmicToneMapping;
      r.toneMappingExposure = 0.92;
      r.setViewport(0, 0, w / pr, h / pr);
      r.setScissor(0, 0, w / pr, h / pr);
      r.setScissorTest(true);
      const fog = job.scene.fog;
      job.scene.fog = null;
      r.render(job.scene, cam);
      job.scene.fog = fog;
      if (job.after) job.after();
      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      out.getContext('2d').drawImage(canvas, 0, canvas.height - h, w, h, 0, 0, w, h);
      r.setScissorTest(false);
      r.setViewport(0, 0, canvas.width / pr, canvas.height / pr);
      r.toneMapping = prevTone;
      r.toneMappingExposure = prevExposure;
      job.resolve(out.toDataURL('image/jpeg', 0.82));
    }
  }
}

// Both pieces sit centered on the same point; two need twice the width.
function frame(cam, target, count) {
  const dist = count > 1 ? 7.6 : 4.6;
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
  for (const list of Object.values(t.items)) for (const it of list) it.born = old();
}
