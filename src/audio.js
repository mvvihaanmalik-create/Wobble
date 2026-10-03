import { APP, AUDIO } from './config.js';

// Every sound is synthesized. The context starts on the first user gesture.
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = readMuted();
    this.lastSquelch = 0;
    this.recordDest = null;
  }

  unlock() {
    if (this.ctx) {
      // iOS can leave the context 'interrupted' after a call or a trip to
      // the home screen; any tap brings it back.
      if (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted') this.ctx.resume();
      if (this.keepAlive && this.keepAlive.paused) this.keepAlive.play().catch(() => {});
      return;
    }
    playThroughSilentSwitch(this);
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : AUDIO.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp);
    comp.connect(ctx.destination);
    this.out = comp;
    // One second of white noise, reused by every burst.
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    if (this.onUnlock) this.onUnlock();
  }

  setMuted(m) {
    this.muted = m;
    try {
      localStorage.setItem(`${APP.storageKey}.muted`, m ? '1' : '0');
    } catch {
      // Storage can be unavailable; muting still works for this visit.
    }
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : AUDIO.volume, this.ctx.currentTime, 0.02);
  }

  // A stream of the mix, for recordings.
  stream() {
    if (!this.ctx) return null;
    if (!this.recordDest) {
      this.recordDest = this.ctx.createMediaStreamDestination();
      this.out.connect(this.recordDest);
    }
    return this.recordDest.stream;
  }

  // Sounds scheduled while the context is still starting play once it runs.
  ready() {
    return this.ctx && !this.muted && this.ctx.state !== 'closed';
  }

  noiseBurst(t, dur, f0, f1, q, gain) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = q;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5, dur + 0.05);
  }

  tone(t, type, f0, f1, dur, gain, attack = 0.006) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // Soft wet squelch: filtered noise with a falling pitch underneath.
  squelch(strength = 1) {
    if (!this.ready()) return;
    const now = performance.now();
    if (now - this.lastSquelch < AUDIO.squelchGapMs) return;
    this.lastSquelch = now;
    const s = Math.min(1.4, Math.max(0.25, strength));
    const t = this.ctx.currentTime + 0.005;
    const pitch = 0.85 + Math.random() * 0.3;
    this.noiseBurst(t, 0.16 + s * 0.05, 1500 * pitch, 260 * pitch, 3.5, 0.42 * s);
    this.tone(t, 'sine', 360 * pitch, 95 * pitch, 0.14 + s * 0.04, 0.3 * s);
    this.tone(t + 0.03, 'triangle', 700 * pitch, 240 * pitch, 0.07, 0.06 * s);
  }

  // Quieter squelch for a stretched surface snapping back.
  snap(strength = 1) {
    if (!this.ready()) return;
    const s = Math.min(1.2, Math.max(0.2, strength));
    const t = this.ctx.currentTime + 0.005;
    this.noiseBurst(t, 0.12, 900, 2200, 5, 0.18 * s);
    this.tone(t, 'sine', 180, 420, 0.1, 0.16 * s);
  }

  // Low, wet thump for the weight landing.
  thump(strength = 1) {
    if (!this.ready()) return;
    const s = Math.min(1.3, Math.max(0.4, strength));
    const t = this.ctx.currentTime + 0.005;
    this.tone(t, 'sine', 140, 38, 0.42, 0.9 * s, 0.004);
    this.tone(t, 'triangle', 90, 45, 0.2, 0.25 * s, 0.004);
    this.noiseBurst(t, 0.3, 700, 120, 1.2, 0.5 * s);
    this.noiseBurst(t + 0.05, 0.22, 1800, 300, 4, 0.2 * s);
  }

  tick(level = 1) {
    if (!this.ready()) return;
    const t = this.ctx.currentTime + 0.005;
    this.tone(t, 'sine', 1500 + level * 180, 1400 + level * 180, 0.05, 0.12, 0.002);
  }

  // Two soft notes for reaching 100%.
  done() {
    if (!this.ready()) return;
    const t = this.ctx.currentTime + 0.01;
    this.tone(t, 'sine', 523.25, 523.25, 0.5, 0.16);
    this.tone(t + 0.12, 'sine', 783.99, 783.99, 0.7, 0.14);
  }
}

// iPhones play Web Audio on the ringer channel, which the silent switch
// mutes. Asking for media playback (or, on older iOS, playing a silent
// looping <audio>) moves it to the media channel like a video would.
function playThroughSilentSwitch(sound) {
  try {
    if (navigator.audioSession) {
      navigator.audioSession.type = 'playback';
      return;
    }
    const apple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 0;
    if (!apple) return;
    const a = new Audio(silentWav());
    a.loop = true;
    a.setAttribute('playsinline', '');
    a.play().catch(() => {});
    sound.keepAlive = a;
  } catch {
    // Not fatal: sound still plays when the switch is off.
  }
}

// A quarter second of silence as a WAV data URL, made here so nothing is
// fetched.
function silentWav() {
  const n = 2000;
  const b = new Uint8Array(44 + n);
  const v = new DataView(b.buffer);
  const str = (o, s) => [...s].forEach((c, i) => (b[o + i] = c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n, true);
  str(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  str(36, 'data');
  v.setUint32(40, n, true);
  b.fill(128, 44);
  let bin = '';
  for (const x of b) bin += String.fromCharCode(x);
  return `data:audio/wav;base64,${btoa(bin)}`;
}

function readMuted() {
  try {
    return localStorage.getItem(`${APP.storageKey}.muted`) === '1';
  } catch {
    return false;
  }
}
