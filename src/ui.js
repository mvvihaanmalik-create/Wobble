import { APP, FLAVORS, RECORD, STRESS } from './config.js';

const $ = (id) => document.getElementById(id);

// Accumulates kinetic energy with diminishing returns: 1 - e^(-energy/scale).
// The shown number eases toward the real one and never jumps upward.
export class Stress {
  constructor(onTick, onDone) {
    this.onTick = onTick;
    this.onDone = onDone;
    this.reset();
  }

  reset() {
    this.raw = 0;
    this.target = 0;
    this.done = false;
    this.shown = this.shown || 0;
    this.quarter = Math.floor(this.shown * 4 + 1e-6);
  }

  // A touch after finishing starts a fresh round.
  touch() {
    if (this.done) this.reset();
  }

  update(dt, kinetic) {
    if (!this.done) {
      this.raw += Math.max(0, kinetic - STRESS.idleFloor) * dt;
      this.target = 1 - Math.exp(-this.raw / STRESS.scale);
      if (this.target >= STRESS.finish) this.target = 1;
    }
    const k = 1 - Math.exp(-dt * STRESS.ease * (this.target < this.shown ? 2.5 : 1));
    this.shown += (this.target - this.shown) * k;
    if (this.target === 1 && this.shown > 0.9985) this.shown = 1;
    const q = Math.floor(this.shown * 4 + 1e-6);
    if (q > this.quarter) {
      this.quarter = q;
      this.onTick(q);
      if (q === 4 && !this.done) {
        this.done = true;
        this.onDone();
      }
    } else if (q < this.quarter) {
      this.quarter = q;
    }
  }

  get percent() {
    return this.done && this.shown === 1 ? 100 : Math.min(99, Math.floor(this.shown * 100));
  }
}

export class UI {
  constructor(handlers) {
    this.h = handlers;
    this.panel = $('panel');
    this.word = $('word');
    this.wordCount = $('wordCount');
    this.stage = $('stage');
    this.meter = $('meter');
    this.flavorKey = null;
    this.aspect = RECORD.defaultAspect;
    this.readoutTimer = 0;
    this.stageRect = { x: 0, y: 0, w: 1, h: 1 };

    this.buildPresets();
    this.buildFlavors();
    this.buildAspects();
    this.bindWord();
    this.bindSliders();
    this.bindButtons();
    this.measure();
    const ro = new ResizeObserver(() => this.measure());
    ro.observe(this.panel);
    ro.observe(document.body);
    window.addEventListener('resize', () => this.measure());
    $('recMark').textContent = APP.watermark;
    $('recUrl').textContent = APP.url;
  }

  measure() {
    const mobile = window.matchMedia('(max-width: 720px)').matches;
    document.documentElement.style.setProperty('--sheet-h', mobile ? `${this.panel.offsetHeight}px` : '0px');
    const r = this.stage.getBoundingClientRect();
    this.stageRect = { x: r.left, y: r.top, w: Math.max(40, r.width), h: Math.max(40, r.height) };
    if (this.h.onLayout) this.h.onLayout();
  }

  buildPresets() {
    const wrap = $('presets');
    for (const p of APP.presets) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = p;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => {
        this.setWord(p);
        this.h.onWord(p, true);
      });
      wrap.appendChild(b);
    }
  }

  buildFlavors() {
    const wrap = $('flavors');
    for (const [key, f] of Object.entries(FLAVORS)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'flavor';
      b.dataset.key = key;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', f.label);
      b.innerHTML = `<span class="dot" style="background:${f.attenuation}"></span>${f.label}`;
      b.addEventListener('click', () => {
        this.setFlavor(key);
        this.h.onFlavor(key);
      });
      wrap.appendChild(b);
    }
  }

  buildAspects() {
    const wrap = $('aspects');
    for (const key of Object.keys(RECORD.aspects)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = key;
      b.setAttribute('role', 'radio');
      b.addEventListener('click', () => this.setAspect(key));
      wrap.appendChild(b);
    }
    this.setAspect(this.aspect);
  }

  bindWord() {
    let timer = 0;
    this.word.maxLength = APP.maxChars;
    this.word.addEventListener('input', () => {
      this.updateCount();
      this.markPreset();
      clearTimeout(timer);
      timer = setTimeout(() => this.h.onWord(this.word.value, false), APP.rebuildDebounceMs);
    });
    this.word.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(timer);
        this.h.onWord(this.word.value, true);
        this.word.blur();
      }
    });
  }

  bindSliders() {
    const firm = $('firmness');
    const damp = $('damping');
    const fire = () => {
      $('firmOut').textContent = firm.value;
      $('dampOut').textContent = damp.value;
      this.h.onFeel(firm.value / 100, damp.value / 100);
    };
    firm.addEventListener('input', fire);
    damp.addEventListener('input', fire);
    this.fireFeel = fire;
  }

  bindButtons() {
    document.querySelectorAll('[data-action]').forEach((b) => {
      b.addEventListener('click', () => {
        const a = b.dataset.action;
        if (a === 'more') {
          const open = this.panel.classList.toggle('open');
          b.setAttribute('aria-expanded', String(open));
          requestAnimationFrame(() => this.measure());
          return;
        }
        this.h.onAction(a);
      });
    });
    $('record').addEventListener('click', () => this.h.onRecord(this.aspect));
    $('recordQuick').addEventListener('click', () => this.h.onRecord(this.aspect));
    $('screenshot').addEventListener('click', () => this.h.onScreenshot(this.aspect));
  }

  setWord(w) {
    this.word.value = w;
    this.updateCount();
    this.markPreset();
  }

  updateCount() {
    this.wordCount.textContent = `${this.word.value.length}/${APP.maxChars}`;
  }

  markPreset() {
    const v = this.word.value.trim().toLowerCase();
    $('presets').querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c.textContent.toLowerCase() === v)));
  }

  setFlavor(key) {
    this.flavorKey = key;
    $('flavors').querySelectorAll('.flavor').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.key === key)));
  }

  setAspect(key) {
    this.aspect = key;
    $('aspects').querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-checked', String(b.textContent === key)));
  }

  setMuted(m) {
    document.querySelectorAll('[data-action="mute"]').forEach((b) => {
      b.setAttribute('aria-pressed', String(m));
      b.textContent = m ? 'Muted' : 'Mute';
    });
  }

  setCaption(word, flavor) {
    $('figCaption').textContent = `${word}, in ${FLAVORS[flavor].label.toLowerCase()}`;
    $('recWord').textContent = `“${word}”`;
  }

  // Cheap per-frame updates; text readouts refresh a few times a second.
  frame(dt, stress, kinetic, vertices) {
    const pct = stress.percent;
    if (pct !== this.lastPct) {
      this.lastPct = pct;
      $('stressValue').textContent = pct;
      $('recValue').textContent = pct;
    }
    const frac = `${(stress.shown * 100).toFixed(2)}%`;
    $('stressBar').style.width = frac;
    $('recBar').style.width = frac;
    const done = stress.done && stress.shown === 1;
    if (done !== this.lastDone) {
      this.lastDone = done;
      this.meter.classList.toggle('done', done);
      $('meterLabel').textContent = done ? 'Fully decompressed.' : 'Stress released';
      $('recLabel').textContent = done ? 'Fully decompressed.' : 'Stress released';
    }
    this.readoutTimer -= dt;
    if (this.readoutTimer <= 0) {
      this.readoutTimer = 0.2;
      $('keValue').textContent = (kinetic * 100).toFixed(2);
      $('vertCount').textContent = vertices.toLocaleString('en-US');
    }
  }

  setRecording(on, crop) {
    document.body.classList.toggle('recording', on);
    const f = $('recFrame');
    f.hidden = !on;
    if (on) this.placeCrop(crop);
  }

  placeCrop(crop) {
    const f = $('recFrame');
    f.style.setProperty('--cx', `${crop.x}px`);
    f.style.setProperty('--cy', `${crop.y}px`);
    f.style.setProperty('--cw', `${crop.w}px`);
    f.style.setProperty('--ch', `${crop.h}px`);
    f.style.setProperty('--cmin', `${Math.min(crop.w, crop.h)}px`);
  }

  setRing(progress) {
    $('ringProg').style.strokeDashoffset = String(119.38 * (1 - progress));
    $('ringText').textContent = String(Math.max(0, Math.ceil(RECORD.seconds * (1 - progress))));
  }

  toast(text, ms = 2200) {
    const t = $('toast');
    t.textContent = text;
    t.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (t.hidden = true), ms);
  }

  // Preview of a clip or screenshot with Share / Download / Try again.
  showPreview(file, url, isVideo, { share, download, again, close }) {
    const box = $('preview');
    const media = $('previewMedia');
    media.innerHTML = '';
    if (isVideo) {
      const v = document.createElement('video');
      v.src = url;
      v.autoplay = true;
      v.loop = true;
      v.muted = true;
      v.playsInline = true;
      v.controls = true;
      media.appendChild(v);
    } else {
      const img = document.createElement('img');
      img.src = url;
      img.alt = 'Screenshot';
      media.appendChild(img);
    }
    $('previewTitle').textContent = isVideo ? `Clip ready. ${RECORD.seconds} seconds.` : 'Screenshot ready.';
    const shareBtn = $('previewShare');
    shareBtn.hidden = !share;
    shareBtn.onclick = share;
    $('previewDownload').onclick = download;
    $('previewDownload').classList.toggle('btn-solid', !share);
    $('previewAgain').hidden = !isVideo;
    $('previewAgain').onclick = again;
    $('previewClose').onclick = close;
    box.hidden = false;
  }

  hidePreview() {
    $('preview').hidden = true;
    $('previewMedia').innerHTML = '';
  }
}
