import {
  BackSide,
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Fog,
  HalfFloatType,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  NoToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  PointLight,
  Scene,
  SphereGeometry,
  SpotLight,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  BloomEffect,
  BrightnessContrastEffect,
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  HueSaturationEffect,
  RenderPass,
  SMAAEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { CAMERA, VIEWS } from './config.js';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Quality tiers. The game starts on the tier that suits the device and steps
// down on its own if frames run slow.
// pixelRatio is a cap; below 1 renders under native resolution and lets the
// browser scale it up. glass: false turns off see-through food and garnish.
export const TIERS = {
  high: { pixelRatio: 1.75, ao: true, aoHalf: false, dof: true, bloom: true, smaa: true, shadow: 2048, transmission: 0.6, glass: true },
  medium: { pixelRatio: 1.25, ao: true, aoHalf: true, dof: true, bloom: true, smaa: true, shadow: 2048, transmission: 0.45, glass: true },
  low: { pixelRatio: 1, ao: false, aoHalf: true, dof: false, bloom: true, smaa: true, shadow: 1024, transmission: 0.35, glass: true },
  minimal: { pixelRatio: 0.75, ao: false, aoHalf: true, dof: false, bloom: false, smaa: false, shadow: 1024, transmission: 0.25, glass: false },
};

// Pick a starting tier from the GPU's name. Integrated and mobile GPUs start
// low; software renderers start at the bottom. Unknown GPUs start on medium.
export function guessTier(coarse) {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return 'minimal';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).toLowerCase();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    if (/swiftshader|llvmpipe|software|basic render/.test(name)) return 'minimal';
    if (coarse || /intel|uhd|iris|mali|adreno|powervr|apple gpu|vivante|videocore/.test(name)) return 'low';
    if (/rtx|radeon rx|rx \d{4}|geforce gtx 1[0-9]{3}|apple m[2-9] (pro|max|ultra)/.test(name)) return 'high';
    return 'medium';
  } catch {
    return 'low';
  }
}
export const TIER_ORDER = ['high', 'medium', 'low', 'minimal'];

export class Stage {
  constructor(canvas, tier = 'high') {
    this.canvas = canvas;
    // Antialiasing comes from SMAA in the post chain, so no MSAA here.
    const r = (this.renderer = new WebGLRenderer({ canvas, antialias: false, stencil: false, powerPreference: 'high-performance' }));
    r.outputColorSpace = SRGBColorSpace;
    r.toneMapping = NoToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = PCFShadowMap;

    const scene = (this.scene = new Scene());
    scene.background = new Color('#0e0806');
    scene.fog = new Fog('#0e0806', 34, 70);

    const pmrem = new PMREMGenerator(r);
    const env = restaurantEnvironment();
    scene.environment = pmrem.fromScene(env, 0.02).texture;
    scene.environmentIntensity = 0.95;
    pmrem.dispose();

    this.buildLights();

    this.camera = new PerspectiveCamera(40, 1, 0.5, 120);
    this.rig = { from: null, to: VIEWS.title, t: 1, pos: new Vector3(), target: new Vector3(), fov: 40, fitW: 18 };
    this.applyView(VIEWS.title);
    this.focus = new Vector3();
    this.pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    this.shake = 0;
    this.time = 0;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this._v = new Vector3();
    this._w = new Vector3();

    this.buildComposer();
    this.setTier(tier);
  }

  buildLights() {
    const scene = this.scene;
    // Key: a soft warm overhead light, like a pin spot over the counter.
    const key = (this.key = new DirectionalLight('#fff0d8', 1.9));
    key.position.set(-6, 22, 12);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera;
    Object.assign(sc, { left: -26, right: 18, top: 12, bottom: -12, near: 4, far: 50 });
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.025;
    key.shadow.radius = 5;
    scene.add(key, key.target);

    // Pin spots that pool light on each station.
    this.spots = [];
    for (const [x, z, power] of [[-8.5, 1.4, 55], [0, 1.4, 45], [9.5, 1.8, 65], [0, -7.4, 90], [-19.5, 1.8, 60]]) {
      const s = new SpotLight('#ffd9a8', power, 26, 0.42, 0.75, 1.6);
      s.position.set(x, 13, z + 2);
      s.target.position.set(x, 0, z);
      scene.add(s, s.target);
      this.spots.push(s);
    }
    // Cool rim from behind the guests separates them from the wall.
    const rim = new DirectionalLight('#c4d8ff', 1.4);
    rim.position.set(6, 9, -18);
    scene.add(rim);
    // Bright, warm sky fill: shadows stay soft and readable, never murky.
    scene.add(new HemisphereLight('#fff3e0', '#8a5a3a', 0.62));
    // A soft fill from the camera side, so faces are always lit.
    const fill = new DirectionalLight('#ffe6cc', 0.55);
    fill.position.set(0, 7, 22);
    scene.add(fill);
    this.lanternLights = [new PointLight('#ff9f45', 26, 20, 1.7), new PointLight('#ff9f45', 26, 20, 1.7)];
    this.lanternLights[0].position.set(-9, 7.2, -10.5);
    this.lanternLights[1].position.set(9, 7.2, -10.5);
    scene.add(...this.lanternLights);
  }

  buildComposer() {
    const r = this.renderer;
    this.composer = new EffectComposer(r, { frameBufferType: HalfFloatType });
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.ao = new N8AOPostPass(this.scene, this.camera, 1, 1);
    Object.assign(this.ao.configuration, {
      aoRadius: 1.4,
      distanceFalloff: 0.8,
      intensity: 1.25,
      gammaCorrection: false,
      color: new Color('#1a0d06'),
      aoSamples: 12,
      denoiseSamples: 6,
      denoiseRadius: 10,
    });
    this.composer.addPass(this.ao);

    // Food-photography focus: sharp on the station, soft beyond it.
    this.dof = new DepthOfFieldEffect(this.camera, { focusDistance: 10, focusRange: 4, bokehScale: 3.2, resolutionScale: 0.5 });
    this.dof.target = this.focus;
    this.dofPass = new EffectPass(this.camera, this.dof);
    this.composer.addPass(this.dofPass);

    this.bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 0.86, luminanceSmoothing: 0.3, intensity: 0.7, radius: 0.7 });
    // A clean, bright console look: neutral tone mapping keeps colors vivid,
    // a touch more saturation and contrast, a light vignette, no grain.
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL });
    const sat = new HueSaturationEffect({ saturation: 0.12 });
    const contrast = new BrightnessContrastEffect({ contrast: 0.1, brightness: 0.02 });
    const vignette = new VignetteEffect({ offset: 0.38, darkness: 0.32 });
    this.gradePass = new EffectPass(this.camera, this.bloom, tone, sat, contrast, vignette);
    this.composer.addPass(this.gradePass);

    this.smaaPass = new EffectPass(this.camera, new SMAAEffect());
    this.composer.addPass(this.smaaPass);
  }

  setTier(name) {
    const t = TIERS[name] || TIERS.medium;
    this.tierName = name;
    this.tier = t;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, t.pixelRatio);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.glass = t.glass;
    if (!t.glass) this.dropGlass();
    this.renderer.transmissionResolutionScale = t.transmission;
    this.ao.enabled = t.ao;
    this.ao.configuration.halfRes = t.aoHalf;
    this.dofPass.enabled = t.dof;
    this.bloom.blendMode.opacity.value = t.bloom ? 1 : 0;
    this.smaaPass.enabled = t.smaa;
    // Only the last enabled pass may draw to the screen. With SMAA off, that
    // is the grade pass; without this the canvas would get nothing at all.
    const live = this.composer.passes.filter((p) => p.enabled);
    for (const p of this.composer.passes) p.renderToScreen = p === live[live.length - 1];
    if (this.key.shadow.mapSize.x !== t.shadow) {
      this.key.shadow.mapSize.set(t.shadow, t.shadow);
      if (this.key.shadow.map) {
        this.key.shadow.map.dispose();
        this.key.shadow.map = null;
      }
    }
    if (this.width) this.resize();
  }

  // Turn off transmission on every material in the scene. Called on the
  // lowest tier, and again now and then for food made since.
  dropGlass() {
    this.scene.traverse((o) => {
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) {
        if (m.transmission > 0) {
          m.transmission = 0;
          m.needsUpdate = true;
        }
      }
    });
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
    r.focus = view.focus || view.target;
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
    this.composer.setSize(w, h, false);
    const wasPortrait = this.width && this.width / this.height < 0.8;
    this.width = w;
    this.height = h;
    this.camera.aspect = w / h;
    if (this.viewName && wasPortrait !== w / h < 0.8) this.goTo(this.viewName, true);
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
    const still = this.reducedMotion.matches;
    const p = this.pointer;
    p.sx += (p.x - p.sx) * (1 - Math.exp(-dt * 3));
    p.sy += (p.y - p.sy) * (1 - Math.exp(-dt * 3));
    if (!still) {
      const d = r.pos.distanceTo(r.target);
      cam.position.x += Math.sin(this.time * 0.21) * CAMERA.drift * d + p.sx * CAMERA.parallax * d;
      cam.position.y += Math.sin(this.time * 0.17 + 1) * CAMERA.drift * d * 0.5 - p.sy * CAMERA.parallax * d * 0.5;
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
    // Focus follows the station's subject; range scales with distance.
    const f = r.to && r.to.focus ? this._v.fromArray(r.to.focus) : r.target;
    this.focus.lerp(f, 1 - Math.exp(-dt * 6));
    this.dof.cocMaterial.focusRange = Math.max(2.2, dist * 0.32);
    // Gentle depth of field: the background softens, it does not smear.
    this.dof.bokehScale = (r.to && r.to.bokeh != null ? r.to.bokeh : 3.2) * 0.55;
  }

  render(dt = 1 / 60) {
    if (this.beforeRender) this.beforeRender();
    if (!this.glass && (this.glassCheck = (this.glassCheck || 0) + 1) % 60 === 0) this.dropGlass();
    // If the post chain fails (a driver bug, a lost resource), draw the scene
    // plainly rather than leaving a frozen frame, and tell the game.
    try {
      if (this.plain) this.renderer.render(this.scene, this.camera);
      else this.composer.render(dt);
    } catch (err) {
      console.error(err);
      this.failures = (this.failures || 0) + 1;
      if (this.failures >= 3) this.plain = true;
      try {
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.scene, this.camera);
      } catch {
        // Nothing more to do this frame.
      }
      if (this.onFailure) this.onFailure(err);
    }
  }
}

// A warm restaurant for reflections: dark wood room, a long softbox over the
// counter, two lanterns and a dim front fill. Values above 1 are HDR.
function restaurantEnvironment() {
  const s = new Scene();
  const hdr = (r, g, b) => new MeshBasicMaterial({ color: new Color(r, g, b), side: BackSide });
  const room = new Mesh(new BoxGeometry(60, 24, 60), hdr(0.09, 0.055, 0.035));
  room.position.y = 8;
  s.add(room);
  const panel = (w, h, color, pos, rotX = 0, rotY = 0) => {
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color, side: 2 }));
    m.position.set(...pos);
    m.rotation.set(rotX, rotY, 0);
    s.add(m);
  };
  panel(26, 5, new Color(4, 3.6, 3.1), [0, 14, 2], Math.PI / 2); // softbox over the counter
  panel(10, 3, new Color(2.2, 1.9, 1.6), [0, 9, 20], 0, Math.PI); // front fill
  panel(60, 10, new Color(0.35, 0.22, 0.12), [0, -4, 0], -Math.PI / 2); // warm counter bounce
  for (const x of [-10, 10]) {
    const l = new Mesh(new SphereGeometry(1.4, 16, 12), new MeshBasicMaterial({ color: new Color(9, 4.2, 1.4) }));
    l.position.set(x, 8, -12);
    s.add(l);
  }
  return s;
}

// Soft round glow, for sparkles.
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
