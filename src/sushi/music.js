// Warm lofi for the bar, played live in Web Audio. Nothing is downloaded.
//
// Two little songs, written out as chords and a melody rather than made up
// on the fly: a soft electric piano with a slow chorus, a round bass, a
// mellow flute-like lead, brushed drums, a gentle sidechain pump and vinyl
// crackle, all through a warm tape chain. The tempo never changes; rush
// hour only makes the drums busier.

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// A chord: bass note and four voices for the piano, smooth from one to the
// next. beats: how long it lasts (a bar is 4).
const ch = (bass, keys, beats = 4) => ({ bass, keys, beats });

// Melody notes: [beat in the bar (eighths), midi, length in eighths].
const SONGS = {
  // "Evening at the counter", F major. Mellow, for the title and the end of
  // the day.
  evening: {
    bars: [
      [ch(41, [57, 60, 64, 67])],
      [ch(40, [55, 59, 62, 64], 2), ch(45, [55, 61, 64, 66], 2)],
      [ch(38, [57, 60, 64, 65])],
      [ch(48, [55, 58, 62, 63], 2), ch(41, [57, 62, 63, 67], 2)],
      [ch(46, [57, 60, 62, 65])],
      [ch(45, [55, 60, 64, 67])],
      [ch(43, [57, 58, 62, 65])],
      [ch(48, [58, 62, 65, 67])],
    ],
    melody: [
      [[2, 69, 2], [4, 72, 2], [6, 76, 2]],
      [[0, 74, 3], [4, 73, 2], [6, 76, 2]],
      [[0, 77, 4], [4, 76, 2], [6, 74, 2]],
      [[0, 72, 2], [2, 70, 2], [4, 69, 4]],
      [[2, 74, 2], [4, 77, 2], [6, 81, 2]],
      [[0, 79, 3], [3, 76, 1], [4, 72, 4]],
      [[0, 74, 2], [2, 77, 2], [4, 76, 2], [6, 74, 2]],
      [[0, 72, 6]],
    ],
  },
  // "Counter shuffle", A minor to C. A little brighter, for service.
  shuffle: {
    bars: [
      [ch(45, [55, 60, 64, 71])],
      [ch(38, [57, 60, 64, 65])],
      [ch(43, [53, 57, 59, 64])],
      [ch(48, [55, 59, 62, 64])],
      [ch(41, [57, 60, 64, 67])],
      [ch(40, [55, 59, 62, 67])],
      [ch(38, [57, 60, 64, 65])],
      [ch(43, [53, 60, 62, 67], 2), ch(43, [53, 59, 62, 65], 2)],
    ],
    melody: [
      [[0, 76, 2], [2, 79, 2], [4, 76, 2], [6, 74, 2]],
      [[0, 72, 4], [4, 74, 2], [6, 76, 2]],
      [[0, 74, 3], [3, 71, 1], [4, 67, 4]],
      [[2, 76, 2], [4, 79, 2], [6, 83, 2]],
      [[0, 81, 4], [4, 79, 2], [6, 76, 2]],
      [[0, 79, 2], [2, 76, 2], [4, 74, 4]],
      [[0, 77, 2], [2, 76, 2], [4, 74, 2], [6, 72, 2]],
      [[0, 74, 6]],
    ],
  },
};

// mood -> song and how busy the drums are.
const MOODS = {
  chill: { song: 'evening', hats: 0.5, kick: 0.85, level: 0.9 },
  groove: { song: 'shuffle', hats: 0.9, kick: 1, level: 1 },
  rush: { song: 'shuffle', hats: 1, kick: 1.1, shaker: true, level: 1.05 },
};

const BPM = 74;
const EIGHTH = 60 / BPM / 2;
const SWING = 0.14 * EIGHTH;

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
    this.tone.frequency.setTargetAtTime(ducked ? 900 : 7000, t, 0.15);
    this.bus.gain.setTargetAtTime(this.level(), t, 0.15);
  }

  level() {
    return 0.32 * MOODS[this.mood].level * this.duck;
  }

  build() {
    const ctx = this.s.ctx;
    // bus -> warmth (soft saturation, more low end, softer top) -> the
    // limiter, so it is heard on small speakers. Mute stops the band.
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    const drive = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 1.6) / Math.tanh(1.6);
    }
    drive.curve = curve;
    const low = ctx.createBiquadFilter();
    low.type = 'lowshelf';
    low.frequency.value = 220;
    low.gain.value = 2.5;
    const high = ctx.createBiquadFilter();
    high.type = 'highshelf';
    high.frequency.value = 5000;
    high.gain.value = -5;
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass';
    this.tone.frequency.value = 7000;
    this.tone.Q.value = 0.4;
    this.bus.connect(drive).connect(low).connect(high).connect(this.tone).connect(this.s.out);

    // The sidechain pump: piano and bass dip a little on every kick.
    this.pump = ctx.createGain();
    this.pump.connect(this.bus);

    // Piano: two slightly detuned voices panned apart make the chorus.
    this.keysBus = ctx.createGain();
    this.keysBus.gain.value = 0.9;
    const keysLp = ctx.createBiquadFilter();
    keysLp.type = 'lowpass';
    keysLp.frequency.value = 2600;
    keysLp.Q.value = 0.5;
    this.keysBus.connect(keysLp).connect(this.pump);
    this.panL = ctx.createStereoPanner();
    this.panL.pan.value = -0.35;
    this.panR = ctx.createStereoPanner();
    this.panR.pan.value = 0.35;
    this.panL.connect(this.keysBus);
    this.panR.connect(this.keysBus);

    this.bassBus = ctx.createGain();
    const bassLp = ctx.createBiquadFilter();
    bassLp.type = 'lowpass';
    bassLp.frequency.value = 700;
    this.bassBus.connect(bassLp).connect(this.pump);

    // Lead, with a soft echo.
    this.leadBus = ctx.createGain();
    this.leadBus.gain.value = 0.9;
    const leadLp = ctx.createBiquadFilter();
    leadLp.type = 'lowpass';
    leadLp.frequency.value = 2400;
    this.leadBus.connect(leadLp).connect(this.bus);
    const delay = ctx.createDelay(2);
    delay.delayTime.value = EIGHTH * 3;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    const wet = ctx.createBiquadFilter();
    wet.type = 'lowpass';
    wet.frequency.value = 1800;
    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.35;
    leadLp.connect(delay);
    delay.connect(wet).connect(fb).connect(delay);
    wet.connect(wetGain).connect(this.bus);

    this.drumBus = ctx.createGain();
    const drumLp = ctx.createBiquadFilter();
    drumLp.type = 'lowpass';
    drumLp.frequency.value = 5200;
    this.drumBus.connect(drumLp).connect(this.bus);

    // Vinyl: a little hiss and the odd soft click.
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      lp += ((Math.random() * 2 - 1) - lp) * 0.25;
      d[i] = lp * 0.02;
      if (Math.random() < 0.00018) d[i] += (Math.random() * 2 - 1) * 0.18;
    }
    this.vinylBuf = buf;
    this.vinylGain = ctx.createGain();
    this.vinylGain.gain.value = 1.1;
    this.vinylGain.connect(this.bus);
  }

  start() {
    const ctx = this.s.ctx;
    if (!this.bus) this.build();
    this.playing = true;
    const t = ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setValueAtTime(this.bus.gain.value, t);
    this.bus.gain.linearRampToValueAtTime(this.level(), t + 3);
    this.vinyl = ctx.createBufferSource();
    this.vinyl.buffer = this.vinylBuf;
    this.vinyl.loop = true;
    this.vinyl.connect(this.vinylGain);
    this.vinyl.start(t);
    this.bar = 0;
    this.step = 0;
    this.pass = 0;
    this.song = MOODS[this.mood].song;
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
      const swing = this.step % 2 ? SWING : 0;
      this.playStep(this.nextTime + swing);
      this.nextTime += EIGHTH;
      this.step++;
      if (this.step === 8) {
        this.step = 0;
        this.bar++;
        if (this.bar === 8) {
          this.bar = 0;
          this.pass++;
          // Songs change only at the top of the loop, so nothing lurches.
          this.song = MOODS[this.mood].song;
        }
      }
    }
    if (this.bus) this.bus.gain.setTargetAtTime(this.level(), now, 0.8);
  }

  playStep(t) {
    const m = MOODS[this.mood];
    const song = SONGS[this.song];
    const bar = song.bars[this.bar];
    const s = this.step;
    const beat = EIGHTH * 2;
    // Piano: each chord on its first beat, a soft repeat on the and-of-two.
    let at = 0;
    for (const c of bar) {
      const startStep = at * 2;
      if (s === startStep) {
        this.strum(c.keys, t, c.beats * beat * 0.95, 0.85);
        this.bass(c.bass, t, c.beats * beat * 0.9, 1);
      }
      if (c.beats === 4 && s === startStep + 3 && this.pass % 2) this.strum(c.keys, t, beat * 1.2, 0.35);
      if (c.beats === 4 && s === startStep + 5) this.bass(c.bass + 12, t, beat * 0.45, 0.45);
      at += c.beats;
    }
    // The melody plays every other time round, so it never wears thin.
    if (this.pass % 2 === 1) {
      for (const [st, note, len] of song.melody[this.bar]) {
        if (st === s) this.lead(note, t, len * EIGHTH * 0.92);
      }
    }
    // Drums: a soft kick, a brushed rim on two and four, light hats.
    if (s === 0 || (s === 5 && this.bar % 2 === 1)) this.kick(t, m.kick);
    if (s === 2 || s === 6) this.rim(t);
    if (Math.random() < m.hats) this.hat(t, s % 2 ? 0.45 : 0.8);
    if (m.shaker) this.hat(t + EIGHTH / 2, 0.3);
  }

  strum(notes, t, dur, vel) {
    notes.forEach((n, i) => this.keys(n, t + i * 0.022 + Math.random() * 0.01, dur, vel * (0.85 + Math.random() * 0.15)));
  }

  // Electric piano: a sine carrier with a sine modulator whose depth fades,
  // so each note starts bell-bright and settles warm. Two voices, a few
  // cents apart, one each side.
  keys(midi, t, dur, vel) {
    const ctx = this.s.ctx;
    const f = hz(midi);
    const end = t + dur + 1.2;
    for (const [pan, cents] of [[this.panL, -5], [this.panR, 5]]) {
      const g = ctx.createGain();
      const peak = 0.1 * vel;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
      g.gain.exponentialRampToValueAtTime(peak * 0.4, t + 1.4);
      g.gain.setTargetAtTime(0.0001, t + dur, 0.35);
      g.connect(pan);
      const car = ctx.createOscillator();
      car.type = 'sine';
      car.frequency.value = f;
      car.detune.value = cents;
      const mod = ctx.createOscillator();
      mod.type = 'sine';
      mod.frequency.value = f;
      mod.detune.value = cents;
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(f * 1.6 * vel, t);
      depth.gain.exponentialRampToValueAtTime(f * 0.25, t + 0.7);
      mod.connect(depth).connect(car.frequency);
      car.connect(g);
      car.start(t);
      mod.start(t);
      car.stop(end);
      mod.stop(end);
    }
  }

  bass(midi, t, dur, vel) {
    const ctx = this.s.ctx;
    const f = hz(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13 * vel, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.07 * vel, t + Math.min(dur, 0.8));
    g.gain.setTargetAtTime(0.0001, t + dur, 0.09);
    g.connect(this.bassBus);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = f * 2;
    const g2 = ctx.createGain();
    g2.gain.value = 0.18;
    o.connect(g);
    o2.connect(g2).connect(g);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.5);
    o2.stop(t + dur + 0.5);
  }

  // A soft, breathy lead: like a little flute, with a slow vibrato that
  // only comes in on longer notes.
  lead(midi, t, dur) {
    const ctx = this.s.ctx;
    const f = hz(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.05);
    g.gain.setTargetAtTime(0.055, t + 0.1, 0.2);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.12);
    g.connect(this.leadBus);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f;
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.2;
    const vd = ctx.createGain();
    vd.gain.setValueAtTime(0, t);
    vd.gain.linearRampToValueAtTime(dur > 0.5 ? f * 0.006 : 0, t + Math.min(dur, 0.5));
    vib.connect(vd);
    vd.connect(o.frequency);
    vd.connect(o2.frequency);
    const mix = ctx.createGain();
    mix.gain.value = 0.5;
    o.connect(mix).connect(g);
    o2.connect(g);
    // A breath of noise at the start of each note.
    const n = ctx.createBufferSource();
    n.buffer = this.s.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f * 2;
    bp.Q.value = 2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.012, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    n.connect(bp).connect(ng).connect(g);
    const end = t + dur + 0.5;
    for (const x of [o, o2, vib]) {
      x.start(t);
      x.stop(end);
    }
    n.start(t, Math.random() * 0.5, 0.15);
  }

  kick(t, vel) {
    const ctx = this.s.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.46 * vel, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 220;
    o.connect(lp).connect(g).connect(this.drumBus);
    o.start(t);
    o.stop(t + 0.36);
    // Pump the piano and bass a touch under the kick.
    const p = this.pump.gain;
    p.cancelScheduledValues(t);
    p.setValueAtTime(1, t);
    p.linearRampToValueAtTime(0.78, t + 0.02);
    p.linearRampToValueAtTime(1, t + 0.32);
  }

  // A brushed rim click: short, papery, never sharp.
  rim(t) {
    const ctx = this.s.ctx;
    const n = ctx.createBufferSource();
    n.buffer = this.s.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2200;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    n.connect(bp).connect(g).connect(this.drumBus);
    n.start(t, Math.random() * 0.5, 0.2);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(330, t);
    o.frequency.exponentialRampToValueAtTime(240, t + 0.05);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.03, t + 0.003);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(og).connect(this.drumBus);
    o.start(t);
    o.stop(t + 0.08);
  }

  hat(t, vel) {
    const ctx = this.s.ctx;
    const n = ctx.createBufferSource();
    n.buffer = this.s.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.02 * vel, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    n.connect(hp).connect(g).connect(this.drumBus);
    n.start(t, Math.random() * 0.8, 0.05);
  }
}

function readPref() {
  try {
    return localStorage.getItem('squishi.v1.music') !== '0';
  } catch {
    return true;
  }
}
