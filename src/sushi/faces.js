import { CanvasTexture, SRGBColorSpace } from 'three';

// Hand-drawn faces, the way 2000s handheld and console games did them: the
// eyes, brows, mouth and cheeks are little painted textures swapped per
// expression. Drawn here on canvases at load, so nothing is downloaded.
//
// Every eye is painted as the critter's right eye (on the left of the
// screen), inner corner on the right of the canvas. The other eye is the
// same decal flipped.

const INK = '#2a160f';
const cache = new Map();

function tex(key, w, h, draw) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  x.lineCap = 'round';
  x.lineJoin = 'round';
  draw(x, w, h);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

const mix = (a, b, k) => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};

function ellipse(x, cx, cy, rx, ry) {
  x.beginPath();
  x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
}

function star(x, cx, cy, r, inner = 0.32) {
  x.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * inner : r;
    x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  x.closePath();
}

function heartPath(x, cx, cy, s) {
  x.beginPath();
  x.moveTo(cx, cy + s * 0.9);
  x.bezierCurveTo(cx - s * 1.5, cy - s * 0.1, cx - s * 0.9, cy - s * 1.1, cx, cy - s * 0.45);
  x.bezierCurveTo(cx + s * 0.9, cy - s * 1.1, cx + s * 1.5, cy - s * 0.1, cx, cy + s * 0.9);
  x.closePath();
}

// Eye canvas: 256 by 320. The brow lives in the top band, the eye below.
const EW = 256;
const EH = 320;
const EC = [128, 196]; // eye center
const ER = [80, 104]; // eye radii

function brow(x, kind, color) {
  if (kind === 'none') return;
  x.strokeStyle = color;
  x.lineWidth = 17;
  x.beginPath();
  // Outer end on the left, inner end (toward the nose) on the right.
  const [o, i] = {
    neutral: [[70, 54], [176, 44]],
    raised: [[66, 36], [178, 24]],
    worried: [[74, 46], [176, 26]],
    angry: [[72, 34], [182, 64]],
    flat: [[70, 58], [182, 58]],
  }[kind];
  const mx = (o[0] + i[0]) / 2;
  const my = Math.min(o[1], i[1]) - (kind === 'flat' ? 0 : 10);
  x.moveTo(o[0], o[1]);
  x.quadraticCurveTo(mx, my, i[0], i[1]);
  x.stroke();
}

function openEye(x, iris, { lashes, sparkle, tear, lid } = {}) {
  const [cx, cy] = EC;
  const [rx, ry] = ER;
  x.save();
  if (lid) {
    // Half-closed: everything above the lid line is cut away.
    x.beginPath();
    x.rect(0, cy - ry * 0.05, EW, EH);
    x.clip();
  }
  ellipse(x, cx, cy, rx, ry);
  x.fillStyle = INK;
  x.fill();
  // Iris: dark at the top, glowing with color toward the bottom.
  const g = x.createLinearGradient(0, cy - ry, 0, cy + ry);
  g.addColorStop(0, INK);
  g.addColorStop(0.42, mix(iris, '#000000', 0.45));
  g.addColorStop(0.8, iris);
  g.addColorStop(1, mix(iris, '#ffffff', 0.5));
  ellipse(x, cx, cy + 6, rx - 11, ry - 12);
  x.fillStyle = g;
  x.fill();
  // Pupil.
  ellipse(x, cx + 2, cy + 6, 34, 50);
  x.fillStyle = 'rgba(14,7,4,0.85)';
  x.fill();
  // A ring of lighter iris low down, like a reflection off the counter.
  x.strokeStyle = mix(iris, '#ffffff', 0.35);
  x.globalAlpha = 0.55;
  x.lineWidth = 7;
  x.beginPath();
  x.ellipse(cx, cy + 10, rx - 26, ry - 26, 0, Math.PI * 0.2, Math.PI * 0.8);
  x.stroke();
  x.globalAlpha = 1;
  // Highlights.
  x.fillStyle = '#ffffff';
  if (sparkle) {
    star(x, cx + 26, cy - 40, 42);
    x.fill();
    star(x, cx - 30, cy + 46, 20);
    x.fill();
  } else {
    ellipse(x, cx + 28, cy - 42, 30, 38);
    x.fill();
    ellipse(x, cx - 30, cy + 52, 14, 14);
    x.fill();
    ellipse(x, cx + 34, cy + 40, 7, 7);
    x.fill();
  }
  if (tear) {
    // A wobbly pool of tears along the bottom.
    x.fillStyle = 'rgba(160,220,255,0.75)';
    x.beginPath();
    x.ellipse(cx, cy + ry - 14, rx - 8, 22, 0, 0, Math.PI);
    x.fill();
    x.fillStyle = '#ffffff';
    ellipse(x, cx + 30, cy + ry - 12, 9, 6);
    x.fill();
  }
  x.restore();
  if (lid) {
    x.strokeStyle = INK;
    x.lineWidth = 16;
    x.beginPath();
    x.moveTo(cx - rx - 4, cy - ry * 0.05 + 2);
    x.lineTo(cx + rx + 2, cy - ry * 0.05 - 4);
    x.stroke();
  }
  if (lashes) {
    x.strokeStyle = INK;
    x.lineWidth = 11;
    x.beginPath();
    x.moveTo(cx - rx + 18, cy - ry + 30);
    x.quadraticCurveTo(cx - rx - 10, cy - ry + 18, cx - rx - 22, cy - ry + 34);
    x.moveTo(cx - rx + 6, cy - ry + 52);
    x.quadraticCurveTo(cx - rx - 18, cy - ry + 50, cx - rx - 26, cy - ry + 66);
    x.stroke();
  }
}

const EYES = {
  open: (x, iris, o) => openEye(x, iris, o),
  star: (x, iris, o) => openEye(x, mix(iris, '#ffffff', 0.2), { ...o, sparkle: true }),
  sad: (x, iris, o) => openEye(x, iris, { ...o, tear: true }),
  half: (x, iris, o) => openEye(x, iris, { ...o, lid: true }),
  // ^ : the happy squint.
  happy: (x) => {
    x.strokeStyle = INK;
    x.lineWidth = 24;
    x.beginPath();
    x.arc(EC[0], EC[1] + 46, 70, Math.PI * 1.12, Math.PI * 1.88);
    x.stroke();
  },
  // A soft closed line for blinks.
  closed: (x) => {
    x.strokeStyle = INK;
    x.lineWidth = 20;
    x.beginPath();
    x.arc(EC[0], EC[1] - 30, 70, Math.PI * 0.18, Math.PI * 0.82);
    x.stroke();
  },
  // > : squeezed shut, toward the nose.
  angry: (x) => {
    x.strokeStyle = INK;
    x.lineWidth = 24;
    x.beginPath();
    x.moveTo(EC[0] - 52, EC[1] - 56);
    x.lineTo(EC[0] + 48, EC[1]);
    x.lineTo(EC[0] - 52, EC[1] + 56);
    x.stroke();
  },
  heart: (x) => {
    heartPath(x, EC[0], EC[1] + 8, 74);
    x.fillStyle = '#ff4f7e';
    x.fill();
    x.lineWidth = 10;
    x.strokeStyle = '#a3163f';
    x.stroke();
    x.fillStyle = '#ffffff';
    ellipse(x, EC[0] + 30, EC[1] - 20, 16, 20);
    x.fill();
  },
};

export function eyeTexture(kind, browKind, iris, { lashes = false, brow: browColor = INK } = {}) {
  return tex(`eye|${kind}|${browKind}|${iris}|${lashes}|${browColor}`, EW, EH, (x) => {
    brow(x, browKind, browColor);
    EYES[kind](x, iris, { lashes });
  });
}

// Mouth canvas: 256 by 192.
const MOUTH = {
  // The little ω every 2000s mascot had.
  smile: (x) => {
    x.strokeStyle = INK;
    x.lineWidth = 13;
    // Two little bumps that meet in the middle: left to right along the bottoms.
    x.beginPath();
    x.arc(100, 66, 28, Math.PI, 0, true);
    x.arc(156, 66, 28, Math.PI, 0, true);
    x.stroke();
  },
  flat: (x) => {
    x.strokeStyle = INK;
    x.lineWidth = 13;
    x.beginPath();
    x.moveTo(98, 92);
    x.lineTo(158, 90);
    x.stroke();
  },
  frown: (x) => {
    x.strokeStyle = INK;
    x.lineWidth = 12;
    x.beginPath();
    for (let i = 0; i <= 24; i++) {
      const px = 76 + i * 4.3;
      const py = 92 + Math.sin(i * 0.78) * 9 - (1 - Math.abs(i - 12) / 12) * 10;
      if (i) x.lineTo(px, py);
      else x.moveTo(px, py);
    }
    x.stroke();
  },
  pout: (x) => {
    x.strokeStyle = INK;
    x.lineWidth = 13;
    x.beginPath();
    x.moveTo(104, 104);
    x.quadraticCurveTo(128, 70, 152, 104);
    x.stroke();
  },
  chew: (x) => {
    x.strokeStyle = INK;
    x.lineWidth = 13;
    x.beginPath();
    x.moveTo(90, 84);
    x.quadraticCurveTo(108, 104, 124, 82);
    x.quadraticCurveTo(140, 62, 162, 86);
    x.stroke();
  },
  open: (x, fang) => {
    x.beginPath();
    x.moveTo(92, 66);
    x.quadraticCurveTo(128, 60, 164, 66);
    x.bezierCurveTo(164, 146, 92, 146, 92, 66);
    x.fillStyle = '#7a2228';
    x.fill();
    x.save();
    x.clip();
    x.fillStyle = '#ff8597';
    ellipse(x, 128, 132, 34, 22);
    x.fill();
    x.restore();
    x.lineWidth = 11;
    x.strokeStyle = INK;
    x.stroke();
    if (fang) teeth(x, 106, 70);
  },
  grin: (x, fang) => {
    x.beginPath();
    x.moveTo(62, 60);
    x.quadraticCurveTo(128, 72, 194, 60);
    x.bezierCurveTo(186, 168, 70, 168, 62, 60);
    x.fillStyle = '#7a2228';
    x.fill();
    x.save();
    x.clip();
    x.fillStyle = '#ff8597';
    ellipse(x, 128, 150, 52, 34);
    x.fill();
    x.restore();
    x.lineWidth = 12;
    x.strokeStyle = INK;
    x.stroke();
    if (fang) teeth(x, 84, 64);
  },
};

// One little fang, yaeba style.
function teeth(x, px, py) {
  x.fillStyle = '#ffffff';
  x.beginPath();
  x.moveTo(px, py);
  x.lineTo(px + 22, py + 2);
  x.lineTo(px + 10, py + 22);
  x.closePath();
  x.fill();
  x.lineWidth = 4;
  x.strokeStyle = INK;
  x.stroke();
}

export function mouthTexture(kind, fang = false) {
  return tex(`mouth|${kind}|${fang}`, 256, 192, (x) => MOUTH[kind](x, fang));
}

// Cheek: a soft pink blush with the little hatch lines, and whiskers for
// the cats and foxes. Painted as the critter's right cheek.
export function cheekTexture(whiskers = null) {
  return tex(`cheek|${whiskers}`, 256, 160, (x) => {
    const g = x.createRadialGradient(140, 82, 0, 140, 82, 74);
    g.addColorStop(0, 'rgba(255,128,158,0.85)');
    g.addColorStop(0.6, 'rgba(255,140,166,0.55)');
    g.addColorStop(1, 'rgba(255,150,170,0)');
    x.fillStyle = g;
    x.save();
    x.scale(1, 0.62);
    x.beginPath();
    x.arc(140, 132, 74, 0, Math.PI * 2);
    x.fill();
    x.restore();
    x.strokeStyle = 'rgba(255,255,255,0.85)';
    x.lineWidth = 6;
    for (let k = 0; k < 3; k++) {
      x.beginPath();
      x.moveTo(118 + k * 18, 96);
      x.lineTo(130 + k * 18, 70);
      x.stroke();
    }
    if (whiskers) {
      x.strokeStyle = whiskers;
      x.lineWidth = 5;
      for (let k = 0; k < 3; k++) {
        x.beginPath();
        x.moveTo(96, 70 + k * 16);
        x.quadraticCurveTo(50, 62 + k * 20, 8, 66 + k * 26);
        x.stroke();
      }
    }
  });
}

// Emote bubbles: the little manga symbols that pop over a head.
const EMOTES = {
  surprise: (x) => {
    x.fillStyle = '#ffd23f';
    x.strokeStyle = INK;
    x.lineWidth = 10;
    x.beginPath();
    x.moveTo(52, 14);
    x.lineTo(78, 14);
    x.lineTo(72, 82);
    x.lineTo(58, 82);
    x.closePath();
    x.fill();
    x.stroke();
    ellipse(x, 65, 106, 13, 13);
    x.fill();
    x.stroke();
  },
  question: (x) => {
    x.strokeStyle = INK;
    x.lineWidth = 30;
    x.beginPath();
    x.arc(64, 44, 26, Math.PI * 1.1, Math.PI * 0.45);
    x.lineTo(64, 84);
    x.stroke();
    x.strokeStyle = '#7fd0ff';
    x.lineWidth = 16;
    x.stroke();
    ellipse(x, 64, 108, 12, 12);
    x.fillStyle = '#7fd0ff';
    x.fill();
    x.lineWidth = 8;
    x.strokeStyle = INK;
    x.stroke();
  },
  note: (x) => {
    const draw = (ox, oy, s) => {
      x.save();
      x.translate(ox, oy);
      x.scale(s, s);
      x.beginPath();
      x.moveTo(30, 8);
      x.lineTo(30, 70);
      x.moveTo(30, 8);
      x.quadraticCurveTo(50, 18, 52, 38);
      x.lineWidth = 9;
      x.strokeStyle = INK;
      x.stroke();
      ellipse(x, 18, 72, 16, 12);
      x.fillStyle = '#ff7aa2';
      x.fill();
      x.lineWidth = 7;
      x.stroke();
      x.restore();
    };
    draw(8, 26, 1);
    draw(66, 8, 0.8);
  },
  heart: (x) => {
    heartPath(x, 64, 66, 40);
    x.fillStyle = '#ff5c8a';
    x.fill();
    x.lineWidth = 8;
    x.strokeStyle = INK;
    x.stroke();
    ellipse(x, 80, 48, 9, 11);
    x.fillStyle = '#ffffff';
    x.fill();
  },
  // The four-cornered anger vein.
  anger: (x) => {
    x.strokeStyle = '#e8263c';
    x.lineWidth = 14;
    for (let k = 0; k < 4; k++) {
      x.save();
      x.translate(64, 64);
      x.rotate((k * Math.PI) / 2 + Math.PI / 4);
      x.beginPath();
      x.moveTo(12, 40);
      x.quadraticCurveTo(12, 12, 40, 12);
      x.stroke();
      x.restore();
    }
  },
  sweat: (x) => {
    x.beginPath();
    x.moveTo(64, 10);
    x.bezierCurveTo(84, 46, 98, 64, 98, 84);
    x.arc(64, 84, 34, 0, Math.PI);
    x.bezierCurveTo(30, 64, 44, 46, 64, 10);
    x.fillStyle = '#9fdcff';
    x.fill();
    x.lineWidth = 8;
    x.strokeStyle = '#2f6f9a';
    x.stroke();
    ellipse(x, 52, 82, 8, 13);
    x.fillStyle = '#ffffff';
    x.fill();
  },
  sparkle: (x) => {
    x.fillStyle = '#fff2a0';
    x.strokeStyle = '#d99a16';
    x.lineWidth = 6;
    for (const [cx, cy, r] of [[46, 56, 38], [96, 30, 20], [94, 96, 16]]) {
      star(x, cx, cy, r, 0.3);
      x.fill();
      x.stroke();
    }
  },
  gloom: (x) => {
    x.strokeStyle = '#7b5ca8';
    x.lineWidth = 9;
    for (let k = 0; k < 4; k++) {
      x.beginPath();
      for (let i = 0; i <= 10; i++) {
        const py = 10 + i * 10;
        const px = 22 + k * 26 + Math.sin(i * 1.2 + k) * 4;
        if (i) x.lineTo(px, py);
        else x.moveTo(px, py);
      }
      x.stroke();
    }
  },
};

export function emoteTexture(kind) {
  return tex(`emote|${kind}`, 128, 128, (x) => EMOTES[kind](x));
}

export const EMOTE_KINDS = Object.keys(EMOTES);
