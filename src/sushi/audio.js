import { Sound } from '../audio.js';

// The shared synth plus sounds for the bar. Everything is generated.
export class BarSound extends Sound {
  // Door bell for a new guest.
  bell() {
    if (!this.ready()) return;
    const t = this.ctx.currentTime + 0.01;
    for (const [f, d] of [[1318.5, 0], [1760, 0.09]]) {
      this.tone(t + d, 'sine', f, f, 0.9, 0.12, 0.003);
      this.tone(t + d, 'sine', f * 2.76, f * 2.76, 0.35, 0.03, 0.003);
    }
  }

  // Rice scooped out of the tub.
  scoop() {
    if (!this.ready()) return;
    const t = this.ctx.currentTime + 0.005;
    this.noiseBurst(t, 0.12, 900, 300, 1.5, 0.25);
    this.tone(t, 'sine', 240, 140, 0.1, 0.12);
  }

  // A long knife pull through fish: bright hiss with a low drag under it.
  slice(strength = 1) {
    if (!this.ready()) return;
    const t = this.ctx.currentTime + 0.005;
    this.noiseBurst(t, 0.28, 5200, 2400, 2.5, 0.16 * strength);
    this.noiseBurst(t + 0.02, 0.22, 900, 400, 1.2, 0.12 * strength);
    this.tone(t + 0.22, 'triangle', 220, 160, 0.06, 0.06);
  }

  // Board tap when a slice lands.
  tap() {
    if (!this.ready()) return;
    const t = this.ctx.currentTime + 0.005;
    this.tone(t, 'triangle', 520, 300, 0.07, 0.12, 0.002);
    this.noiseBurst(t, 0.05, 2400, 1200, 2, 0.06);
  }

  sprinkle() {
    if (!this.ready()) return;
    const t = this.ctx.currentTime + 0.005;
    for (let i = 0; i < 6; i++) this.noiseBurst(t + i * 0.025 + Math.random() * 0.01, 0.03, 6000 + Math.random() * 3000, 4000, 6, 0.05);
  }

  plop() {
    if (!this.ready()) return;
    const t = this.ctx.currentTime + 0.005;
    this.tone(t, 'sine', 700, 260, 0.09, 0.18, 0.002);
  }

  chomp() {
    if (!this.ready()) return;
    const t = this.ctx.currentTime + 0.005;
    this.noiseBurst(t, 0.09, 1600, 500, 1.4, 0.3);
    this.tone(t, 'sine', 180, 90, 0.08, 0.2);
  }

  // Small rising chirp for a happy guest, falling for an unhappy one.
  voice(mood) {
    if (!this.ready()) return;
    const t = this.ctx.currentTime + 0.01;
    if (mood > 0.75) {
      this.tone(t, 'sine', 620, 980, 0.16, 0.16);
      this.tone(t + 0.15, 'sine', 820, 1320, 0.2, 0.14);
    } else if (mood > 0.45) {
      this.tone(t, 'sine', 560, 700, 0.18, 0.13);
    } else {
      this.tone(t, 'sine', 520, 300, 0.4, 0.14);
    }
  }

  coins(n = 3) {
    if (!this.ready()) return;
    const t = this.ctx.currentTime + 0.02;
    for (let i = 0; i < n; i++) {
      const f = 2200 + Math.random() * 600;
      this.tone(t + i * 0.07, 'square', f, f, 0.06, 0.035, 0.001);
      this.tone(t + i * 0.07, 'sine', f * 1.5, f * 1.5, 0.12, 0.04, 0.001);
    }
  }

  // One sound per step grade: a sparkly run up for perfect, a bright ding
  // for great, a soft tick for OK, and a sagging boing for a slip.
  grade(tier) {
    if (!this.ready()) return;
    const t = this.ctx.currentTime + 0.01;
    if (tier === 'perfect') {
      [1046.5, 1318.5, 1568, 2093].forEach((f, i) => {
        this.tone(t + i * 0.055, 'sine', f, f, 0.22, 0.11, 0.002);
        this.tone(t + i * 0.055, 'triangle', f * 2, f * 2, 0.08, 0.025, 0.002);
      });
    } else if (tier === 'great') {
      this.tone(t, 'sine', 1174.7, 1174.7, 0.18, 0.11, 0.002);
      this.tone(t + 0.07, 'sine', 1568, 1568, 0.26, 0.1, 0.002);
    } else if (tier === 'ok') {
      this.tone(t, 'triangle', 880, 880, 0.12, 0.08, 0.002);
    } else {
      this.tone(t, 'sine', 420, 190, 0.32, 0.13);
      this.tone(t + 0.02, 'triangle', 300, 150, 0.3, 0.05);
    }
  }

  // Boiling water: a soft low blup.
  bubble() {
    if (!this.ready()) return;
    const t = this.ctx.currentTime + 0.005;
    const f = 160 + Math.random() * 140;
    this.tone(t, 'sine', f, f * 1.9, 0.07, 0.07, 0.004);
  }

  // A crackly hiss that runs while something fries. level 0 stops it.
  sizzle(level) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    if (level > 0 && this.ready()) {
      if (!this.sizzleSrc) {
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        src.loop = true;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 2600;
        const g = ctx.createGain();
        g.gain.value = 0;
        // Crackle: the hiss flutters at a jittery rate.
        const lfo = ctx.createOscillator();
        lfo.type = 'square';
        lfo.frequency.value = 17;
        const depth = ctx.createGain();
        depth.gain.value = 0.35;
        const amp = ctx.createGain();
        amp.gain.value = 0.65;
        lfo.connect(depth).connect(amp.gain);
        src.connect(hp).connect(amp).connect(g).connect(this.master);
        src.start();
        lfo.start();
        this.sizzleSrc = { src, lfo, g };
      }
      this.sizzleSrc.lfo.frequency.setTargetAtTime(11 + Math.random() * 14, t, 0.05);
      this.sizzleSrc.g.gain.setTargetAtTime(0.11 * level, t, 0.08);
    } else if (this.sizzleSrc) {
      const { src, lfo, g } = this.sizzleSrc;
      g.gain.setTargetAtTime(0, t, 0.08);
      src.stop(t + 0.5);
      lfo.stop(t + 0.5);
      this.sizzleSrc = null;
    }
  }

  // Dashi pouring from the ladle, while held.
  pouring(on) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    if (on && this.ready() && !this.pourSrc) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 700;
      bp.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(0.16, t, 0.05);
      src.connect(bp).connect(g).connect(this.master);
      src.start();
      this.pourSrc = { src, g, bp };
    } else if (!on && this.pourSrc) {
      this.pourSrc.g.gain.setTargetAtTime(0, t, 0.05);
      this.pourSrc.src.stop(t + 0.3);
      this.pourSrc = null;
    }
    if (this.pourSrc) this.pourSrc.bp.frequency.setTargetAtTime(600 + Math.random() * 300, t, 0.05);
  }

  // Pinching a pleat in a gyoza wrapper.
  pinch() {
    if (!this.ready()) return;
    const t = this.ctx.currentTime + 0.005;
    this.tone(t, 'sine', 820, 560, 0.06, 0.12, 0.002);
    this.noiseBurst(t, 0.05, 2600, 1400, 3, 0.08);
  }

  // A big happy slurp of udon.
  slurp() {
    if (!this.ready()) return;
    const t = this.ctx.currentTime + 0.005;
    this.noiseBurst(t, 0.32, 900, 3200, 2.5, 0.2);
    this.tone(t, 'sine', 260, 520, 0.3, 0.08);
  }

  // The pan lid going on or off: a small metal clank.
  lid() {
    if (!this.ready()) return;
    const t = this.ctx.currentTime + 0.005;
    this.tone(t, 'triangle', 1180, 1150, 0.25, 0.08, 0.002);
    this.tone(t, 'sine', 1720, 1700, 0.35, 0.05, 0.002);
    this.noiseBurst(t, 0.06, 4000, 2500, 2, 0.06);
  }

  whoosh() {
    if (!this.ready()) return;
    const t = this.ctx.currentTime + 0.005;
    this.noiseBurst(t, 0.35, 400, 1400, 0.8, 0.05);
  }
}
