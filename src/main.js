import './style.css';
import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Group, Mesh, Sphere } from 'three';
import { APP, DEFAULT_FLAVOR, FLAVORS, GEOMETRY, INPUT, PERF, SCENE, SIM, WEIGHT } from './config.js';
import { loadJellyFont, sanitizeWord, buildWordMesh } from './geometry.js';
import { SoftBody } from './jelly.js';
import { JellyMaterial, Inclusions } from './material.js';
import { Stage } from './scene.js';
import { Input } from './input.js';
import { Weight } from './weight.js';
import { Sound } from './audio.js';
import { Recorder, cropRect, shareOrDownload, canShareFile, download } from './record.js';
import { UI, Stress } from './ui.js';

const params = new URLSearchParams(location.search);

class App {
  constructor(font) {
    this.font = font;
    this.canvas = document.getElementById('gl');
    this.stage = new Stage(this.canvas);
    this.sound = new Sound();
    this.recorder = new Recorder(this.canvas);
    this.flavor = FLAVORS[readStored('flavor')] ? readStored('flavor') : DEFAULT_FLAVOR;
    this.jellyMat = new JellyMaterial(this.flavor);
    this.inclusions = new Inclusions(this.jellyMat);
    this.weight = new Weight();
    this.weight.onImpact = (w, speed) => this.onWeightImpact(w, speed);
    this.stage.world.add(this.weight.group);

    this.jellyGroup = new Group();
    this.jellyGroup.add(this.inclusions.specks, this.inclusions.bubbles);
    this.stage.world.add(this.jellyGroup);
    this.pop = { s: 1, v: 0 };

    this.feel = { firmness: 1, damping: 1 };
    this.budget = GEOMETRY.vertexBudget;
    this.quality = { prIndex: 0, slowFor: 0, avg: 16, lowered: false, fixed: params.has('fixed') };
    const pr = Math.min(window.devicePixelRatio || 1, SCENE.maxPixelRatio);
    this.quality.prIndex = Math.max(0, PERF.pixelRatioSteps.findIndex((p) => p <= pr));
    // ?pr=0.5 forces a pixel ratio (handy for slow machines and debugging).
    if (params.has('pr')) {
      this.stage.setPixelRatio(Math.max(0.25, Math.min(3, +params.get('pr') || 1)));
      this.quality.fixed = true;
    }

    this.stress = new Stress(
      (q) => this.sound.tick(q),
      () => this.onDecompressed(),
    );

    this.ui = new UI({
      onWord: (w, now) => this.setWord(w, now),
      onFlavor: (k) => this.setFlavor(k),
      onFeel: (f, d) => this.setFeel(f, d),
      onAction: (a) => this.action(a),
      onRecord: (aspect) => this.record(aspect),
      onScreenshot: (aspect) => this.screenshot(aspect),
      onLayout: () => this.layout(),
    });
    this.ui.setFlavor(this.flavor);
    this.ui.setMuted(this.sound.muted);
    this.ui.fireFeel();

    this.input = new Input(this.canvas, this.stage, this);

    this.word = '';
    this.stage.resize();
    this.setWord(APP.defaultWord, true);
    this.ui.setWord(this.word);
    this.layout(true);

    this.last = performance.now();
    this.time = 0;
    this.running = false;
    document.addEventListener('visibilitychange', () => (document.hidden ? this.pause() : this.resume()));
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.recorder.busy) this.recorder.stop();
    });
    this.resume();
  }

  // --- Word and mesh -------------------------------------------------------

  setWord(raw, immediate) {
    let w = sanitizeWord(this.font, raw, APP.maxChars).trim();
    if (!w) return;
    if (w === this.word && !immediate) return;
    if (w === this.word && this.mesh) {
      this.popIn();
      return;
    }
    this.word = w;
    this.rebuild();
    this.popIn();
    this.ui.setCaption(w, this.flavor);
  }

  rebuild() {
    const data = buildWordMesh(this.font, this.word, this.budget);
    const body = new SoftBody(data);
    body.params = this.feel;
    body.compose();

    const geo = new BufferGeometry();
    geo.setIndex(new BufferAttribute(data.indices, 1));
    geo.setAttribute('position', new BufferAttribute(body.out, 3).setUsage(DynamicDrawUsage));
    geo.setAttribute('normal', new BufferAttribute(body.normal, 3).setUsage(DynamicDrawUsage));
    geo.computeBoundingBox();
    const margin = SIM.maxDisplacement + 0.35;
    geo.boundingBox.expandByScalar(margin);
    geo.boundingSphere = geo.boundingBox.getBoundingSphere(new Sphere());

    if (this.mesh) {
      this.jellyGroup.remove(this.mesh);
      this.mesh.geometry.dispose();
    }
    this.input && this.input.cancelAll();
    this.mesh = new Mesh(geo, this.jellyMat.material);
    this.mesh.renderOrder = 0;
    this.jellyGroup.add(this.mesh);
    this.body = body;
    this.inclusions.seed(body);
    this.inclusions.update(body);
    this.stage.layoutFloor(data.glyphs, data.width, data.depth);
    this.weight.active = false;
    this.weight.group.visible = false;
    this.layout();
  }

  popIn() {
    this.popQuiet = 1.2; // seconds before motion counts toward the stress meter
    this.pop.s = 0.55;
    this.pop.v = 0;
    if (this.body) this.body.kickAll(0, -1.4, 0);
  }

  layout(snap = false) {
    if (!this.body) return;
    this.stage.resize();
    const rect = this.recording ? this.recCrop : this.ui.stageRect;
    this.stage.frame(rect, this.body.width, this.body.height, snap);
    if (this.recording) this.ui.placeCrop(this.recCrop);
  }

  // --- Controls ------------------------------------------------------------

  setFlavor(key) {
    this.flavor = key;
    this.jellyMat.setFlavor(key);
    writeStored('flavor', key);
    this.ui.setCaption(this.word, key);
    if (this.body) this.body.kickAll(0, 0.5, 0);
  }

  // Sliders run 0..1 with 0.5 as the default feel.
  setFeel(f, d) {
    this.feel.firmness = Math.pow(2.6, (f - 0.5) * 2);
    this.feel.damping = Math.pow(3.2, (d - 0.5) * 2);
  }

  action(a) {
    this.sound.unlock();
    if (a === 'nudge') this.nudge();
    if (a === 'reset') this.reset();
    if (a === 'mute') {
      this.sound.setMuted(!this.sound.muted);
      this.ui.setMuted(this.sound.muted);
    }
  }

  nudge() {
    const body = this.body;
    if (!body) return;
    this.stress.touch();
    // Pick a random spot on a front face.
    let i = 0;
    for (let tries = 0; tries < 60; tries++) {
      i = Math.floor(Math.random() * body.N);
      if (body.restNormal[i * 3 + 2] > 0.9) break;
    }
    const x = body.rest[i * 3], y = body.rest[i * 3 + 1], z = body.rest[i * 3 + 2];
    const s = INPUT.nudgeImpulse * (0.8 + Math.random() * 0.4);
    const dx = (Math.random() - 0.5) * 0.8;
    body.impulse(x, y, z, dx, -0.2, -1, s, INPUT.pokeRadius * 1.3);
    const g = body.glyphOf[i];
    body.kickMode(g, (Math.random() - 0.5) * 2.4, 0.9, -0.8);
    this.sound.squelch(1);
  }

  reset() {
    if (!this.body) return;
    this.body.reset();
    this.weight.active = false;
    this.weight.group.visible = false;
    this.stress.shown = 0;
    this.stress.reset();
    this.popIn();
  }

  // --- Gestures (called by Input) -----------------------------------------

  onGesture() {
    this.sound.unlock();
    this.stress.touch();
  }

  onTap(s, held) {
    const body = this.body;
    const long = Math.min(1, Math.max(0, (held - INPUT.tapMaxMs) / (INPUT.pressMaxMs - INPUT.tapMaxMs)));
    const strength = INPUT.pokeImpulse + (INPUT.pokeImpulseMax - INPUT.pokeImpulse) * long;
    const d = s.press;
    body.impulse(s.rest.x, s.rest.y, s.rest.z, d.x, d.y, d.z, strength, INPUT.pokeRadius * (1 + long * 0.4));
    const g = s.glyph;
    const off = s.rest.x - body.glyphs[g].cx;
    const k = INPUT.modeKick * (strength / INPUT.pokeImpulse);
    body.kickMode(g, d.x * k * 0.6 - off * k * 0.4, k * 0.45, d.z * k * 0.5);
    this.sound.squelch(0.6 + long * 0.7);
  }

  onRelease(s, pull) {
    const r = pull / INPUT.maxPull;
    this.sound.snap(0.4 + r);
    this.body.kickMode(s.glyph, 0, 0.3 + r * 0.5, 0);
  }

  onDoubleTap(x) {
    this.dropWeight(x);
  }

  dropWeight(x) {
    const body = this.body;
    if (!body || this.weight.active) return;
    // Land on a letter: clamp into the word and snap out of gaps.
    const hx = this.weight.hx;
    x = Math.max(-body.width / 2 + hx * 0.6, Math.min(body.width / 2 - hx * 0.6, x));
    let top = body.topUnder(x, hx * 0.8);
    if (top < 0) {
      const g = body.glyphs[body.glyphAt(x)];
      x = g.cx;
      top = body.topUnder(x, hx * 0.8);
    }
    const halfW = this.frameHalfWidth();
    this.weight.drop(x, Math.max(0, top), halfW);
  }

  frameHalfWidth() {
    const v = this.stage.view;
    const t = Math.tan((SCENE.fov * Math.PI) / 360);
    return v.dist * t * (this.stage.width / this.stage.height) * 1.05;
  }

  onWeightImpact(w, speed) {
    const body = this.body;
    const s = Math.min(1.3, speed / 11);
    const g = body.glyphAt(w.x);
    body.kickMode(g, (Math.random() - 0.5) * 0.6, WEIGHT.modeImpulse * s, 0);
    body.kickMode(g - 1, 0.8 * s, WEIGHT.modeImpulse * 0.35 * s, 0);
    body.kickMode(g + 1, -0.8 * s, WEIGHT.modeImpulse * 0.35 * s, 0);
    body.impulse(w.x, w.top, 0, 0, -1, 0, 1.4 * s, 0.5);
    this.stage.addShake(WEIGHT.shake * s, WEIGHT.shakeMs);
    this.sound.thump(s);
  }

  onDecompressed() {
    this.sound.done();
    if (this.body) {
      this.body.kickAll(0, 2.4, 0);
      for (let g = 0; g < this.body.G; g++) this.body.kickMode(g, (g % 2 ? 1 : -1) * 1.2, 0, 0);
    }
  }

  // --- Capture -------------------------------------------------------------

  info() {
    return {
      word: this.word,
      percent: this.stress.percent,
      fraction: this.stress.shown,
      done: this.stress.done && this.stress.shown === 1,
    };
  }

  async record(aspect) {
    if (this.recorder.busy || this.recording) return;
    this.sound.unlock();
    this.recording = true;
    this.recCrop = cropRect(this.stage.width, this.stage.height, aspect);
    this.ui.setRecording(true, this.recCrop);
    this.ui.setRing(0);
    // Jump straight to the crop framing so the first frame is already right.
    this.layout(true);
    await new Promise((r) => setTimeout(r, 250));
    try {
      const clip = await this.recorder.start(aspect, this.sound.muted ? null : this.sound.stream(), this.recCrop);
      this.finishRecording();
      const file = new File([clip.blob], `squish-${slug(this.word)}-${stamp()}.${clip.ext}`, { type: clip.type });
      this.lastClip = file;
      this.presentFile(file, true, aspect);
    } catch (err) {
      this.finishRecording();
      this.ui.toast(err.message || 'Recording failed.');
    }
  }

  finishRecording() {
    this.recording = false;
    this.ui.setRecording(false);
    this.layout();
  }

  async screenshot(aspect) {
    this.sound.unlock();
    const crop = cropRect(this.stage.width, this.stage.height, aspect);
    // Reframe for the crop, wait for the camera, then grab a frame.
    this.recording = true;
    this.recCrop = crop;
    this.layout(true);
    const shot = await this.recorder.screenshot(aspect, crop);
    this.recording = false;
    this.layout();
    const file = new File([shot.blob], `squish-${slug(this.word)}-${stamp()}.png`, { type: 'image/png' });
    this.presentFile(file, false, aspect);
  }

  presentFile(file, isVideo, aspect) {
    const url = URL.createObjectURL(file);
    this.input.enabled = false;
    const close = () => {
      this.ui.hidePreview();
      URL.revokeObjectURL(url);
      this.input.enabled = true;
    };
    this.ui.showPreview(file, url, isVideo, {
      share: canShareFile(file) ? () => shareOrDownload(file, true) : null,
      download: () => download(file),
      again: () => {
        close();
        this.record(aspect);
      },
      close,
    });
  }

  // --- Loop ----------------------------------------------------------------

  pause() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  resume() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  frame(now) {
    if (!this.running) return;
    this.raf = requestAnimationFrame((t) => this.frame(t));
    const rawDt = (now - this.last) / 1000;
    this.last = now;
    const dt = Math.min(0.1, Math.max(0, rawDt));
    this.time += dt;
    this.watchPerformance(rawDt);

    const body = this.body;
    this.input.update();
    body.step(dt, this.weight.active ? this.weight : null);
    const normalsChanged = body.compose();
    const geo = this.mesh.geometry;
    geo.attributes.position.needsUpdate = true;
    if (normalsChanged) geo.attributes.normal.needsUpdate = true;
    this.inclusions.update(body);
    if (this.weight.active || this.weight.group.visible) this.weight.sync();

    const glow = this.jellyMat.update(dt);
    this.stage.setGlowColor(glow);

    // Pop-in spring on word change.
    const p = this.pop;
    for (let t = 0; t < dt; t += 1 / 240) {
      p.v += (-(p.s - 1) * 190 - p.v * 13) / 240;
      p.s += p.v / 240;
    }
    this.jellyGroup.scale.setScalar(p.s);

    this.popQuiet = Math.max(0, (this.popQuiet || 0) - dt);
    // Count simulated time, not wall time, so a slow device cannot inflate it.
    this.stress.update(dt, this.popQuiet > 0 ? 0 : body.kinetic * (body.simulated / Math.max(dt, 1e-4)));
    this.stage.update(dt, this.time);
    this.stage.render();
    this.recorder.capture(this.info());

    this.ui.frame(dt, this.stress, body.kinetic, body.N);
    if (this.recorder.state === 'recording') this.ui.setRing(this.recorder.progress());
  }

  // Step down pixel ratio, then mesh density, if frames stay slow.
  watchPerformance(rawDt) {
    const q = this.quality;
    if (q.fixed || this.recording || rawDt > 0.5) return;
    q.avg += (rawDt * 1000 - q.avg) * 0.05;
    if (q.avg > PERF.slowFrameMs) q.slowFor += rawDt;
    else q.slowFor = Math.max(0, q.slowFor - rawDt * 0.5);
    if (q.slowFor < PERF.window) return;
    q.slowFor = 0;
    q.avg = 16;
    if (q.prIndex < PERF.pixelRatioSteps.length - 1) {
      q.prIndex++;
      this.stage.setPixelRatio(PERF.pixelRatioSteps[q.prIndex]);
      this.stage.renderer.transmissionResolutionScale = q.prIndex >= 2 ? 0.75 : 1;
    } else if (!q.lowered) {
      q.lowered = true;
      this.budget = GEOMETRY.vertexBudgetLow;
      this.rebuild();
    }
  }
}

function slug(w) {
  return w.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'word';
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function readStored(key) {
  try {
    return localStorage.getItem(`${APP.storageKey}.${key}`);
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(`${APP.storageKey}.${key}`, value);
  } catch {
    // Not important if it cannot be remembered.
  }
}

async function boot() {
  const font = await loadJellyFont();
  await document.fonts.ready;
  const app = new App(font);
  if (import.meta.env.DEV || params.has('debug')) window.squish = app;
}

boot().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', '<p class="mono" style="position:fixed;left:16px;bottom:16px">Could not start. Try a different browser.</p>');
});

