import {
  ACESFilmicToneMapping,
  CanvasTexture,
  DirectionalLight,
  Group,
  HemisphereLight,
  Color,
  Mesh,
  MultiplyBlending,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SCENE } from './config.js';

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    const r = this.renderer;
    r.outputColorSpace = SRGBColorSpace;
    r.toneMapping = ACESFilmicToneMapping;
    r.toneMappingExposure = SCENE.exposure;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, SCENE.maxPixelRatio);
    r.setPixelRatio(this.pixelRatio);
    // Refraction is sampled blurred anyway; a smaller buffer saves fill rate.
    r.transmissionResolutionScale = SCENE.transmissionScale;

    this.scene = new Scene();
    this.scene.background = this.backdropTexture();

    const pmrem = new PMREMGenerator(r);
    const room = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(room, 0.035).texture;
    this.scene.environmentIntensity = 0.95;
    room.dispose();
    pmrem.dispose();

    // One soft key light from above and behind, so light comes through the
    // jelly toward the camera, plus a gentle warm fill.
    this.key = new DirectionalLight(0xfff4e6, 2.2);
    this.key.position.set(-3, 6, 2.5);
    this.scene.add(this.key);
    this.rim = new DirectionalLight(0xffffff, 1.2);
    this.rim.position.set(2.5, 3, -4);
    this.scene.add(this.rim);
    this.scene.add(new HemisphereLight(0xfff8ee, 0xd9cbb4, 0.4));

    this.camera = new PerspectiveCamera(SCENE.fov, 1, 0.1, 100);
    this.world = new Group();
    this.scene.add(this.world);

    this.buildFloor();

    this.view = {
      dist: 8,
      targetDist: 8,
      cx: 0,
      cy: 0,
      targetCx: 0,
      targetCy: 0,
      lookY: 0.35,
      targetLookY: 0.35,
      yaw: 0,
      pitch: 0,
    };
    this.shake = { t: 0, amp: 0 };
    this.pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this._v = new Vector3();
  }

  backdropTexture() {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 512;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, SCENE.background[0]);
    g.addColorStop(1, SCENE.background[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 512);
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }

  // Floor effects: a soft contact shadow and a pool of colored light, both
  // multiplied onto the backdrop. They sit in the opaque pass on purpose, so
  // the jelly's transmission picks them up and you can see them through it.
  buildFloor() {
    this.floorCanvas = document.createElement('canvas');
    this.floorCanvas.width = 1024;
    this.floorCanvas.height = 256;
    this.floorTex = new CanvasTexture(this.floorCanvas);
    this.floorMat = new ShaderMaterial({
      uniforms: {
        map: { value: this.floorTex },
        tint: { value: new Color(1, 0.8, 0.5) },
        shade: { value: new Color(0x5a4632) },
      },
      vertexShader: `varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      // r: shadow amount, g: light pool amount.
      fragmentShader: `uniform sampler2D map; uniform vec3 tint; uniform vec3 shade; varying vec2 vUv;
        void main() {
          vec4 t = texture2D(map, vUv);
          vec3 c = mix(vec3(1.0), shade, t.r);
          c *= mix(vec3(1.0), tint, t.g);
          gl_FragColor = vec4(c, 1.0);
        }`,
      blending: MultiplyBlending,
      premultipliedAlpha: true,
      transparent: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.floor = new Mesh(new PlaneGeometry(1, 1), this.floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = 0.001;
    this.floor.renderOrder = -1;
    this.scene.add(this.floor);
  }

  // Redraw the floor texture for a new word.
  layoutFloor(glyphs, width, depth) {
    const W = width + 1.6;
    const D = depth + 1.6;
    const c = this.floorCanvas;
    const ctx = c.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = 'lighter';
    const sx = c.width / W;
    const sz = c.height / D;
    const cy = c.height / 2;
    for (const g of glyphs) {
      const x = (g.cx + W / 2) * sx;
      const w = (g.maxX - g.minX) * sx;
      // Shadow: a wide soft blob and a tight dark core where it touches.
      blob(ctx, x, cy + depth * 0.1 * sz, w * 0.7, depth * sz * 0.9, 'rgba(255,0,0,0.22)');
      blob(ctx, x, cy, w * 0.52, depth * sz * 0.56, 'rgba(255,0,0,0.30)');
      // Light pool: thrown forward, toward the camera.
      blob(ctx, x, cy + depth * 0.95 * sz, w * 0.6, depth * sz * 0.75, 'rgba(0,255,0,0.4)');
    }
    this.floorTex.needsUpdate = true;
    this.floor.scale.set(W, D, 1);
  }

  setGlowColor(color) {
    this.floorMat.uniforms.tint.value.copy(color);
  }

  setPixelRatio(pr) {
    this.pixelRatio = pr;
    this.renderer.setPixelRatio(pr);
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.width = w;
    this.height = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // Frame the word inside a rectangle of the canvas (CSS pixels).
  frame(rect, wordW, wordH, snap = false) {
    const H = this.height || 1;
    const t = Math.tan((SCENE.fov * Math.PI) / 360) * 2;
    const bw = wordW + 0.35;
    const bh = wordH + 0.5;
    // Portrait stages are width-bound, so let the word run closer to the edges.
    const fitW = rect.w < rect.h ? SCENE.fitWidthPortrait : SCENE.fitWidth;
    const dW = (bw * H) / (t * rect.w * fitW);
    const dH = (bh * H) / (t * rect.h * SCENE.fitHeight);
    const v = this.view;
    v.targetDist = Math.max(dW, dH, 2.5);
    v.targetCx = rect.x + rect.w / 2;
    v.targetCy = rect.y + rect.h / 2;
    v.targetLookY = wordH * 0.46;
    if (snap) {
      v.dist = v.targetDist;
      v.cx = v.targetCx;
      v.cy = v.targetCy;
      v.lookY = v.targetLookY;
    }
  }

  addShake(amount, ms) {
    if (this.reducedMotion.matches) return;
    this.shake.amp = Math.max(this.shake.amp, amount);
    this.shake.t = ms / 1000;
    this.shake.len = ms / 1000;
  }

  update(dt, time) {
    const v = this.view;
    const k = 1 - Math.exp(-dt * 4.5);
    v.dist += (v.targetDist - v.dist) * k;
    v.cx += (v.targetCx - v.cx) * k;
    v.cy += (v.targetCy - v.cy) * k;
    v.lookY += (v.targetLookY - v.lookY) * k;

    const still = this.reducedMotion.matches;
    const p = this.pointer;
    p.sx += (p.x - p.sx) * (1 - Math.exp(-dt * 2.5));
    p.sy += (p.y - p.sy) * (1 - Math.exp(-dt * 2.5));
    const yaw = still ? 0 : SCENE.drift * Math.sin(time * 0.13) + SCENE.parallax * p.sx;
    const pitch = still ? 0 : SCENE.drift * 0.4 * Math.sin(time * 0.097 + 1) - SCENE.parallax * 0.5 * p.sy;

    const cam = this.camera;
    const elev = SCENE.camTilt + pitch;
    cam.position.set(
      Math.sin(yaw) * Math.cos(elev) * v.dist,
      v.lookY + Math.sin(elev) * v.dist,
      Math.cos(yaw) * Math.cos(elev) * v.dist,
    );
    const look = this._v.set(0, v.lookY, 0);
    if (this.shake.t > 0) {
      this.shake.t -= dt;
      const a = this.shake.amp * Math.max(0, this.shake.t / this.shake.len);
      cam.position.x += (Math.random() - 0.5) * a * v.dist * 0.25;
      cam.position.y += (Math.random() - 0.5) * a * v.dist * 0.25;
    }
    cam.lookAt(look);
    cam.near = Math.max(0.05, v.dist * 0.2);
    cam.far = v.dist * 6;
    const W = this.width, H = this.height;
    cam.setViewOffset(W, H, W / 2 - v.cx, H / 2 - v.cy, W, H);
    cam.updateProjectionMatrix();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

function blob(ctx, x, y, rx, ry, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, color);
  g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

