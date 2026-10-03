// Cozy lofi for the bar, written live in Web Audio. Nothing is downloaded:
// a soft electric piano plays jazzy four-chord loops, a round bass walks
// under it, a music box hums little pentatonic tunes on top, and a dusty
// swung beat sits behind everything with some vinyl crackle. A new tune is
// made every few bars, so it never loops the same way twice.

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Chords: a bass note and an electric piano voicing, in MIDI.
const CHORDS = {
  Cmaj9: { bass: 36, keys: [64, 67, 71, 74] },
  Am9: { bass: 45, keys: [60, 64, 67, 71] },
  Dm9: { bass: 38, keys: [60, 64, 65, 69] },
  G13: { bass: 43, keys: [59, 64, 65, 69] },
  Fmaj9: { bass: 41, keys: [57, 60, 64, 67] },
  Em7: { bass: 40, keys: [59, 62, 67, 71] },
  E7: { bass: 40, keys: [59, 62, 64, 68] },
};

const PROGRESSIONS = [
  ['Fmaj9', 'Em7', 'Dm9', 'Cmaj9'],
  ['Cmaj9', 'Am9', 'Dm9', 'G13'],
  ['Am9', 'Fmaj9', 'Cmaj9', 'G13'],
  ['Dm9', 'G13', 'Cmaj9', 'Am9'],
  ['Fmaj9', 'G13', 'Em7', 'Am9'],
  ['Fmaj9', 'E7', 'Am9', 'G13'],
];

// The music box sings in C major pentatonic, two octaves.
const SCALE = [72, 74, 76, 79, 81, 84, 86, 88, 91];

// How busy the band is.
const MOODS = {
  chill: { bpm: 74, kick: 0.6, snare: 0.55, hat: 0.5, melody: 0.8, level: 0.85 },
  groove: { bpm: 80, kick: 1, snare: 1, hat: 1, melody: 1, level: 1 },
  rush: { bpm: 90, kick: 1.15, snare: 1.05, hat: 1.25, melody: 1.1, level: 1.05 },
};

const STEPS = 8; // eighth notes per bar
const SWING = 0.17; // how late the off-beats land, as a share of an eighth

export class LofiMusic {
  constructor(sound) {
    this.s = sound;
    this.on = readPref();
    this.playing = false;
    this.mood = 'chill';
    this.duck = 1;
  }

  // Play when it should be heard, stop when it should not.
  sync() {
    const want = this.on && this.s.ctx && !this.s.muted && !document.hidden;
    if (want && !this.playing) this.start();
    else if (!want && this.playing) this.stop();
  }

  setOn(on) {
    this.on = on;
    try {
      localStorage.setItem('squishi.v1.music', on ? '1' : '0');
    } catch {
      // Without storage the choice lasts for this visit.
    }
    this.sync();
  }

  setMood(mood) {
    if (MOODS[mood]) this.mood = mood;
  }

  // Muffle the band (pause menu), or bring it back.
  setDucked(ducked) {
    this.duck = ducked ? 0.35 : 1;
    if (!this.bus) return;
    const t = this.s.ctx.currentTime;
    this.tape.frequency.setTargetAtTime(ducked ? 900 : 5200, t, 0.15);
    this.bus.gain.setTargetAtTime(this.level(), t, 0.15);
  }

  level() {
    return 0.72 * MOODS[this.mood].level * this.duck;
  }

  build() {
    const ctx = this.s.ctx;
    // bus -> tape lowpass -> the limiter; clips include it.
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.tape = ctx.createBiquadFilter();
    this.tape.type = 'lowpass';
    this.tape.frequency.value = 5200;
    this.tape.Q.value = 0.5;
    // Straight into the limiter, past the effects volume, so it is heard on
    // laptop and phone speakers. Mute stops the band (see sync).
    this.bus.connect(this.tape).connect(this.s.out);

    // Electric piano: warm lowpass and a slow tremolo.
    this.keysBus = ctx.createGain();
    this.keysBus.gain.value = 1;
    const keysLp = ctx.createBiquadFilter();
    keysLp.type = 'lowpass';
    keysLp.frequency.value = 2800;
    this.keysBus.connect(keysLp).connect(this.bus);
    const trem = ctx.createOscillator();
    trem.frequency.value = 4.2;
    const tremDepth = ctx.createGain();
    tremDepth.gain.value = 0.12;
    trem.connect(tremDepth).connect(this.keysBus.gain);
    // Tape wow: every pitched voice drifts a few cents together.
    this.wow = ctx.createOscillator();
    this.wow.frequency.value = 0.35;
    this.wowDepth = ctx.createGain();
    this.wowDepth.gain.value = 7;
    this.wow.connect(this.wowDepth);

    // Music box through a soft echo.
    this.bellBus = ctx.createGain();
    this.bellBus.gain.value = 1;
    this.bellBus.connect(this.bus);
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.42;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const wet = ctx.createBiquadFilter();
    wet.type = 'lowpass';
    wet.frequency.value = 2600;
    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.45;
    this.bellBus.connect(delay);
    delay.connect(wet).connect(fb).connect(delay);
    wet.connect(wetGain).connect(this.bus);

    this.bassBus = ctx.createGain();
    const bassLp = ctx.createBiquadFilter();
    bassLp.type = 'lowpass';
    // Open enough that the bass's overtones reach small speakers.
    bassLp.frequency.value = 900;
    this.bassBus.connect(bassLp).connect(this.bus);

    // Drums sound like they were sampled off an old record.
    this.drumBus = ctx.createGain();
    const drumLp = ctx.createBiquadFilter();
    drumLp.type = 'lowpass';
    drumLp.frequency.value = 3800;
    this.drumBus.connect(drumLp).connect(this.bus);

    // Vinyl: sparse clicks and a little hiss, on a loop.
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * 0.012;
      if (Math.random() < 0.0004) d[i] += (Math.random() * 2 - 1) * (0.25 + Math.random() * 0.5);
    }
    this.vinylBuf = buf;
    this.vinylGain = ctx.createGain();
    this.vinylGain.gain.value = 0.32;
    const vinylLp = ctx.createBiquadFilter();
    vinylLp.type = 'lowpass';
    vinylLp.frequency.value = 5000;
    this.vinylGain.connect(vinylLp).connect(this.bus);

    trem.start();
    this.wow.start();
  }

  start() {
    const ctx = this.s.ctx;
    if (!this.bus) this.build();
    this.playing = true;
    const t = ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setValueAtTime(this.bus.gain.value, t);
    this.bus.gain.linearRampToValueAtTime(this.level(), t + 2.5);
    this.vinyl = ctx.createBufferSource();
    this.vinyl.buffer = this.vinylBuf;
    this.vinyl.loop = true;
    this.vinyl.connect(this.vinylGain);
    this.vinyl.start(t);
    this.bar = 0;
    this.step = 0;
    this.prog = null;
    this.nextTime = t + 0.15;
    this.timer = setInterval(() => this.schedule(), 50);
    this.schedule();
  }

  stop() {
    this.playing = false;
    clearInterval(this.timer);
    if (!this.bus) return;
    const t = this.s.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setValueAtTime(this.bus.gain.value, t);
    this.bus.gain.linearRampToValueAtTime(0, t + 0.6);
    if (this.vinyl) this.vinyl.stop(t + 0.7);
    this.vinyl = null;
  }

  // Look ahead a little and queue every note that falls in the window.
  schedule(until = this.s.ctx.currentTime + 0.3) {
    const now = this.s.ctx.currentTime;
    // After a stall (a background tab), skip ahead rather than cram.
    if (this.nextTime < now - 0.2) this.nextTime = now + 0.05;
    while (this.nextTime < until) {
      const m = MOODS[this.mood];
      const eighth = 60 / m.bpm / 2;
      const swing = this.step % 2 ? SWING * eighth : 0;
      this.playStep(this.nextTime + swing, eighth);
      this.nextTime += eighth;
      this.step++;
      if (this.step === STEPS) {
        this.step = 0;
        this.bar++;
      }
    }
    if (this.bus) this.bus.gain.setTargetAtTime(this.level(), now, 0.8);
  }

  playStep(t, eighth) {
    const m = MOODS[this.mood];
    const s = this.step;
    // Every eight bars: a fresh progression and a fresh tune.
    if (s === 0 && this.bar % 8 === 0) {
      let p;
      do p = PROGRESSIONS[Math.floor(Math.random() * PROGRESSIONS.length)];
      while (p === this.prog && PROGRESSIONS.length > 1);
      this.prog = p;
      this.tune = makeTune();
    }
    const chord = CHORDS[this.prog[this.bar % 4]];
    const beat = eighth * 2;

    // Piano: a soft strum on the one, sometimes a push on the and-of-three.
    if (s === 0) this.strum(chord.keys, t, beat * 3.6, 0.9);
    if (s === 5 && Math.random() < 0.45) this.strum(chord.keys, t, beat * 1.4, 0.45);
    if (s === 3 && Math.random() < 0.2) this.keys(chord.keys[3] + 12, t, beat, 0.3);

    // Bass: root on the one, a fifth or octave on the and-of-two.
    if (s === 0) this.bass(chord.bass, t, beat * 1.6, 1);
    if (s === 3) this.bass(chord.bass + (Math.random() < 0.5 ? 7 : 12), t, beat * 0.9, 0.7);
    if (s === 6 && Math.random() < 0.35) this.bass(chord.bass + 7, t, beat * 0.5, 0.55);

    // Music box: the tune for this half of the phrase.
    const slot = (this.bar % 2) * STEPS + s;
    const note = this.tune[slot];
    if (note != null && Math.random() < 0.92 * m.melody) this.bell(s % 2 ? note : fitTo(note, chord), t, 0.8 + Math.random() * 0.2);

    // Drums: boom, bap, and lazy hats.
    if ((s === 0 || (s === 5 && Math.random() < 0.6)) && m.kick > 0) this.kick(t, m.kick);
    if (s === 3 && Math.random() < 0.12) this.kick(t, m.kick * 0.6);
    if ((s === 2 || s === 6) && m.snare > 0) this.snare(t, m.snare);
    if (Math.random() < 0.85) this.hat(t, (s % 2 ? 0.55 : 1) * m.hat);
    if (this.mood === 'rush' && s % 2) this.hat(t + eighth / 2, 0.4 * m.hat);
  }

  strum(notes, t, dur, vel) {
    notes.forEach((n, i) => this.keys(n, t + i * 0.018 + Math.random() * 0.008, dur, vel * (0.85 + Math.random() * 0.15)));
  }

  // Electric piano voice: a sine body, a bell-like tine that fades fast, and
  // a quiet detuned layer for warmth.
  keys(midi, t, dur, vel) {
    const ctx = this.s.ctx;
    const f = midiHz(midi);
    const g = ctx.createGain();
    const peak = 0.1 * vel;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(peak * 0.45, t + 0.9);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.25);
    g.connect(this.keysBus);
    const end = t + dur + 1.4;
    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.value = f;
    this.wowDepth.connect(body.detune);
    body.connect(g);
    const warm = ctx.createOscillator();
    warm.type = 'triangle';
    warm.frequency.value = f;
    warm.detune.value = 6;
    const wg = ctx.createGain();
    wg.gain.value = 0.25;
    warm.connect(wg).connect(g);
    const tine = ctx.createOscillator();
    tine.type = 'sine';
    tine.frequency.value = f * 4;
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.18 * vel, t);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    tine.connect(tg).connect(g);
    for (const o of [body, warm, tine]) {
      o.start(t);
      o.stop(end);
    }
    body.onended = () => this.wowDepth.disconnect(body.detune);
  }

  bass(midi, t, dur, vel) {
    const ctx = this.s.ctx;
    const f = midiHz(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.15 * vel, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.085 * vel, t + dur * 0.6);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.08);
    g.connect(this.bassBus);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = f;
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;
    o.connect(g);
    o2.connect(g2).connect(g);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.6);
    o2.stop(t + dur + 0.6);
  }

  // Music box: a pure note with a glassy overtone, plucked.
  bell(midi, t, vel) {
    const ctx = this.s.ctx;
    const f = midiHz(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16 * vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    g.connect(this.bellBus);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    this.wowDepth.connect(o.detune);
    const h = ctx.createOscillator();
    h.type = 'sine';
    h.frequency.value = f * 3.01;
    const hg = ctx.createGain();
    hg.gain.setValueAtTime(0.35, t);
    hg.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g);
    h.connect(hg).connect(g);
    o.start(t);
    h.start(t);
    o.stop(t + 1.4);
    h.stop(t + 0.3);
    o.onended = () => this.wowDepth.disconnect(o.detune);
  }

  kick(t, vel) {
    const ctx = this.s.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(115, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.42 * vel, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g).connect(this.drumBus);
    o.start(t);
    o.stop(t + 0.35);
  }

  snare(t, vel) {
    const ctx = this.s.ctx;
    const n = ctx.createBufferSource();
    n.buffer = this.s.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1700;
    bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16 * vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    n.connect(bp).connect(g).connect(this.drumBus);
    n.start(t, Math.random() * 0.5, 0.25);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.07 * vel, t + 0.004);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(og).connect(this.drumBus);
    o.start(t);
    o.stop(t + 0.12);
  }

  hat(t, vel) {
    const ctx = this.s.ctx;
    const n = ctx.createBufferSource();
    n.buffer = this.s.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045 * vel, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    n.connect(hp).connect(g).connect(this.drumBus);
    n.start(t, Math.random() * 0.8, 0.06);
  }
}

// A two-bar tune: mostly steps along the scale, rests to breathe, and a
// longer note to end on.
function makeTune() {
  const out = new Array(STEPS * 2).fill(null);
  let i = 2 + Math.floor(Math.random() * 3);
  for (let s = 0; s < out.length; s++) {
    const onBeat = s % 2 === 0;
    if (Math.random() > (onBeat ? 0.55 : 0.3)) continue;
    i += [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)];
    i = Math.max(0, Math.min(SCALE.length - 1, i));
    out[s] = SCALE[i];
  }
  // Leave room at the end of the phrase.
  out[STEPS * 2 - 1] = null;
  return out;
}

// Nudge a tune note onto the chord when it would clash.
function fitTo(note, chord) {
  const pcs = new Set([chord.bass % 12, ...chord.keys.map((k) => k % 12)]);
  if (pcs.has(note % 12)) return note;
  for (const d of [-1, 1, -2, 2]) if (pcs.has((note + d + 12) % 12)) return note + d;
  return note;
}

function readPref() {
  try {
    return localStorage.getItem('squishi.v1.music') !== '0';
  } catch {
    return true;
  }
}
