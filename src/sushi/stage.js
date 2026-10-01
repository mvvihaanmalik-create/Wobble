import {
  ACESFilmicToneMapping,
  CanvasTexture,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  PCFShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  PointLight,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CAMERA, VIEWS } from './config.js';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    const r = (this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
    r.outputColorSpace = SRGBColorSpace;
    r.toneMapping = ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = PCFShadowMap;
    r.transmissionResolutionScale = 0.75;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    r.setPixelRatio(this.pixelRatio);

    const scene = (this.scene = new Scene());
    scene.background = new Color('#1b120d');
    scene.fog = new Fog('#1b120d', 30, 60);

    const pmrem = new PMREMGenerator(r);
    const room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    scene.environmentIntensity = 0.55;
    room.dispose();
    pmrem.dispose();

    // Warm key from above the counter: the one shadow caster.
    const key = (this.key = new DirectionalLight('#ffe6c4', 2.6));
    key.position.set(-6, 18, 9);
    key.target.position.set(0, 0, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera;
    sc.left = -18;
    sc.right = 18;
    sc.top = 12;
    sc.bottom = -12;
    sc.near = 2;
    sc.far = 45;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 4;
    scene.add(key, key.target);

    // Cool rim from behind the customers, and the lanterns' warm spill.
    const rim = new DirectionalLight('#cfe0ff', 0.8);
    rim.position.set(4, 8, -14);
    scene.add(rim);
    scene.add(new HemisphereLight('#fff0dc', '#3a2418', 0.45));
    this.lanternLights = [new PointLight('#ffb35c', 30, 22, 1.6), new PointLight('#ffb35c', 30, 22, 1.6)];
    this.lanternLights[0].position.set(-9, 7.2, -10);
    this.lanternLights[1].position.set(9, 7.2, -10);
    scene.add(...this.lanternLights);

    this.camera = new PerspectiveCamera(40, 1, 0.1, 120);
    this.rig = { from: null, to: VIEWS.title, t: 1, pos: new Vector3(), target: new Vector3(), fov: 40, fitW: 18 };
    this.applyView(VIEWS.title);
    this.shake = 0;
    this.time = 0;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this._v = new Vector3();
    this._w = new Vector3();
  }

  // Narrow portrait screens get their own framing where a view defines one.
  viewFor(view) {
    return this.width && this.width / this.height < 0.8 && view.portrait ? view.portrait : view;
  }

  applyView(view) {
    view = this.viewFor(view);
    const r = this.rig;
    r.pos.fromArray(view.pos);
    r.target.fromArray(view.target);
    r.fov = view.fov;
    r.fitW = view.fitW;
  }

  // Glide to a station's angle. Returns a promise for when it lands.
  goTo(viewName, snap = false) {
    this.viewName = viewName;
    const to = this.viewFor(VIEWS[viewName]);
    const r = this.rig;
    if (snap || this.reducedMotion.matches) {
      this.applyView(to);
      r.t = 1;
      r.to = to;
      return Promise.resolve();
    }
    r.from = { pos: r.pos.clone(), target: r.target.clone(), fov: r.fov, fitW: r.fitW };
    r.to = to;
    r.t = 0;
    return new Promise((res) => (r.done = res));
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    const wasPortrait = this.width && this.width / this.height < 0.8;
    this.width = w;
    this.height = h;
    this.camera.aspect = w / h;
    if (this.viewName && wasPortrait !== w / h < 0.8) this.goTo(this.viewName, true);
  }

  setPixelRatio(pr) {
    this.pixelRatio = pr;
    this.renderer.setPixelRatio(pr);
    this.resize();
  }

  addShake(a) {
    if (!this.reducedMotion.matches) this.shake = Math.max(this.shake, a);
  }

  update(dt) {
    this.time += dt;
    const r = this.rig;
    if (r.t < 1 && r.from) {
      r.t = Math.min(1, r.t + dt / CAMERA.moveSeconds);
      const k = ease(r.t);
      const to = r.to;
      r.pos.lerpVectors(r.from.pos, this._v.fromArray(to.pos), k);
      // Lift the path a little so moves arc over the counter.
      r.pos.y += Math.sin(Math.PI * k) * 1.2;
      r.target.lerpVectors(r.from.target, this._w.fromArray(to.target), k);
      r.fov = r.from.fov + (to.fov - r.from.fov) * k;
      r.fitW = r.from.fitW + (to.fitW - r.from.fitW) * k;
      if (r.t === 1 && r.done) {
        r.done();
        r.done = null;
      }
    }
    const cam = this.camera;
    cam.position.copy(r.pos);
    if (!this.reducedMotion.matches) {
      const d = CAMERA.drift * r.pos.distanceTo(r.target);
      cam.position.x += Math.sin(this.time * 0.21) * d;
      cam.position.y += Math.sin(this.time * 0.17 + 1) * d * 0.5;
    }
    if (this.shake > 0.001) {
      cam.position.x += (Math.random() - 0.5) * this.shake;
      cam.position.y += (Math.random() - 0.5) * this.shake;
      this.shake *= Math.exp(-dt * 9);
    }
    cam.lookAt(r.target);
    // Keep fitW of the scene visible across the screen, widening the lens on
    // narrow screens instead of cropping the station.
    const dist = r.pos.distanceTo(r.target);
    const needV = (2 * Math.atan(r.fitW / 2 / dist / cam.aspect) * 180) / Math.PI;
    cam.fov = Math.min(75, Math.max(r.fov, needV));
    cam.updateProjectionMatrix();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

// Soft round glow for lanterns and sparkles.
export function glowTexture(inner = 'rgba(255,214,150,1)', outer = 'rgba(255,170,80,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}
