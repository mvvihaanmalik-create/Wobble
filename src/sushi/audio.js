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

  whoosh() {
    if (!this.ready()) return;
    const t = this.ctx.currentTime + 0.005;
    this.noiseBurst(t, 0.35, 400, 1400, 0.8, 0.05);
  }
}
