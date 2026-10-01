import { BUILD, CUSTOMER_LOOKS, DAYS, FISH, KNIFE, RICE, SCORE, TOPPINGS } from './config.js';
import { mulberry } from './set.js';

// One order: a customer and one or two nigiri, each with fish, wasabi and
// toppings.
export function makeOrders(dayIndex, seed = Date.now()) {
  const day = DAYS[dayIndex];
  const rand = mulberry(seed);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const looks = [...CUSTOMER_LOOKS].sort(() => rand() - 0.5);
  const orders = [];
  for (let c = 0; c < day.customers; c++) {
    const count = day.pieces[0] + Math.floor(rand() * (day.pieces[1] - day.pieces[0] + 1));
    const pieces = [];
    for (let k = 0; k < count; k++) {
      const fish = pick(day.fish);
      const piece = { fish, wasabi: fish === 'tamago' ? 0 : pick([0, 1, 1, 2, 2, 3]), toppings: {} };
      // Toppings that suit each fish.
      const fits = { salmon: ['ikura', 'sesame', 'scallion'], tuna: ['scallion', 'sesame', 'sauce'], tamago: ['sauce', 'sesame'] }[fish];
      const options = day.toppings.filter((t) => fits.includes(t));
      if (options.length && rand() < 0.6) piece.toppings[pick(options)] = true;
      if (piece.toppings.ikura) piece.toppings.ikura = BUILD.ikuraTarget;
      pieces.push(piece);
    }
    orders.push({ look: looks[c % looks.length], pieces, patience: day.patience });
  }
  return orders;
}

export function describePiece(p) {
  const lines = [`${FISH[p.fish].label} nigiri`];
  if (p.fish !== 'tamago' || p.wasabi) lines.push(p.wasabi ? `${cap(BUILD.wasabiLevels[p.wasabi])} wasabi` : 'No wasabi');
  for (const [t, v] of Object.entries(p.toppings)) lines.push(t === 'ikura' ? `${v} ikura on top` : `${TOPPINGS[t].label}`);
  return lines;
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Score a scoop: 1 inside the band, falling off outside it.
export function scoopScore(v) {
  const [a, b] = RICE.scoopTarget;
  if (v >= a && v <= b) return 1;
  const d = v < a ? a - v : v - b;
  return clamp01(1 - d / 0.3);
}

export function cutScore(angle, thickness, ideal) {
  const a = clamp01(1 - Math.abs(angle - ideal.angle) / KNIFE.angleTolerance);
  const t = clamp01(1 - Math.abs(thickness - ideal.thickness) / KNIFE.thicknessTolerance);
  return { angle: a, thickness: t, total: a * 0.5 + t * 0.5 };
}

// Score a served plate against the order. Built pieces are matched to
// ordered pieces of the same fish where possible.
export function scorePlate(order, built, waited) {
  const want = order.pieces.map((p, i) => ({ ...p, i, used: false }));
  const results = [];
  for (const b of built) {
    let match = want.find((w) => !w.used && w.fish === b.fish) || want.find((w) => !w.used);
    if (!match) continue;
    match.used = true;
    const wrongFish = match.fish !== b.fish;
    const rice = scoopScore(b.scoop) * 0.4 + b.shape * 0.6;
    const cut = wrongFish ? 0 : b.cut;
    const wasabi = [1, 0.5, 0, 0][Math.min(3, Math.abs(b.wasabi - match.wasabi))];
    const place = clamp01(1 - Math.abs(b.dx) / 0.6);
    let top = 1;
    const asked = Object.keys(match.toppings);
    const given = Object.entries(b.toppings).filter(([, v]) => v).map(([k]) => k);
    for (const t of asked) {
      if (!b.toppings[t]) top -= 1 / Math.max(1, asked.length);
      else if (t === 'ikura') top -= (Math.min(1, Math.abs(b.toppings.ikura - match.toppings.ikura) / 4) * 0.5) / asked.length;
    }
    for (const t of given) if (!asked.includes(t)) top -= 0.3;
    const build = clamp01(wasabi * 0.3 + place * 0.3 + clamp01(top) * 0.4);
    results.push({ fish: b.fish, wrongFish, rice, cut, build });
  }
  // Missing pieces count as zero.
  const missing = want.filter((w) => !w.used).length;
  for (let k = 0; k < missing; k++) results.push({ fish: null, rice: 0, cut: 0, build: 0, missing: true });
  const avg = (key) => results.reduce((s, r) => s + r[key], 0) / Math.max(1, results.length);
  const wait = clamp01(1 - Math.max(0, waited - order.patience * 0.35) / (order.patience * 0.65));
  const w = SCORE.weights;
  const parts = { rice: avg('rice'), cut: avg('cut'), build: avg('build'), wait };
  const total = Math.round(100 * (parts.rice * w.rice + parts.cut * w.cut + parts.build * w.build + parts.wait * w.wait));
  return { total, parts, results, missing, extra: built.length - (order.pieces.length - missing) };
}

export function tipFor(total, dayIndex) {
  const base = SCORE.tipBase * (1 + dayIndex * SCORE.tipPerDay);
  return Math.round((base * Math.pow(total / 100, 1.6)) / 10) * 10;
}

export function rankFor(avg) {
  if (avg >= 92) return 'Counter legend';
  if (avg >= 80) return 'Trusted itamae';
  if (avg >= 65) return 'Steady hands';
  if (avg >= 45) return 'Rice rookie';
  return 'Apprentice';
}
