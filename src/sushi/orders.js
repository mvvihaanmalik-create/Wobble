import { BUILD, CUSTOMER_LOOKS, DAYS, FISH, KNIFE, RICE, RUSH, SCORE, TOPPINGS, dishKey } from './config.js';
import { FILLINGS } from './maki.js';
import { mulberry } from './set.js';

// One order: a guest and a few pieces. A piece is a nigiri ({ fish, wasabi,
// toppings }) or a roll ({ maki: filling }). Rolls come with at most one
// nigiri, so the board has room for six roll pieces.
export function makeOrders(dayIndex, seed = Date.now()) {
  const day = DAYS[dayIndex];
  const rand = mulberry(seed);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const looks = [...CUSTOMER_LOOKS].sort(() => rand() - 0.5);
  const orders = [];
  const [r0, r1] = day.rush || [-1, -2];
  // One nigiri with the wasabi and toppings that suit its fish.
  const nigiri = (fish) => {
    const piece = { fish, wasabi: fish === 'tamago' || fish === 'unagi' ? 0 : pick([0, 1, 1, 2, 2, 3]), toppings: {} };
    const has = (t) => day.toppings.includes(t);
    if (fish === 'tamago' && has('nori')) piece.toppings.nori = true;
    if (fish === 'unagi') {
      if (has('sauce')) piece.toppings.sauce = true;
      if (has('nori')) piece.toppings.nori = true;
      if (has('sesame') && rand() < 0.5) piece.toppings.sesame = true;
      return piece;
    }
    const fits = { salmon: ['ikura', 'sesame', 'scallion'], tuna: ['scallion', 'sesame', 'sauce'], tamago: ['sauce', 'sesame'] }[fish];
    const options = day.toppings.filter((t) => fits.includes(t));
    if (options.length && rand() < 0.6) piece.toppings[pick(options)] = true;
    if (piece.toppings.ikura) piece.toppings.ikura = BUILD.ikuraTarget;
    return piece;
  };
  for (let c = 0; c < day.customers; c++) {
    let count = day.pieces[0] + Math.floor(rand() * (day.pieces[1] - day.pieces[0] + 1));
    const pieces = [];
    if (day.maki && rand() < day.makiChance) {
      pieces.push({ maki: pick(day.maki), wasabi: 0, toppings: {} });
      count = Math.min(count, 1) - (c === 0 && dayIndex === 3 ? 1 : 0); // the first roll of Day 4 comes alone
    }
    for (let k = 0; k < count; k++) pieces.push(nigiri(pick(day.fish)));
    // Regulars often ask for their favourite, when the day has it.
    const look = looks[c % looks.length];
    const [kind, what] = look.fav.split(':');
    const can = kind === 'm' ? (day.maki || []).includes(what) : day.fish.includes(what);
    if (can && rand() < 0.45 && !pieces.some((p) => dishKey(p) === look.fav)) {
      const i = pieces.findIndex((p) => !!p.maki === (kind === 'm'));
      if (i >= 0) pieces[i] = kind === 'm' ? { maki: what, wasabi: 0, toppings: {} } : nigiri(what);
    }
    // Nigiri first on the ticket, the roll last: the order you make them.
    pieces.sort((a, b) => (a.maki ? 1 : 0) - (b.maki ? 1 : 0));
    const rush = c >= r0 && c <= r1;
    orders.push({ look, pieces, patience: day.patience * (rush ? RUSH.patience : 1), rush });
  }
  return orders;
}

export const isMaki = (p) => !!p.maki;
export const nigiriOf = (order) => order.pieces.filter((p) => !p.maki);
export const makiOf = (order) => order.pieces.filter((p) => p.maki);

// Where things sit on the serving board for an order: nigiri x positions,
// and the center of the roll's 3 by 2 grid.
export function plateLayout(order) {
  const n = nigiriOf(order).length;
  const m = makiOf(order).length;
  if (!m) return { nigiri: { 1: [-0.55], 2: [-1.85, 0.75], 3: [-2.3, -0.75, 0.8] }[Math.max(1, Math.min(3, n))], maki: null };
  return n ? { nigiri: [-2.15], maki: 0.4 } : { nigiri: [], maki: -0.5 };
}

export function describePiece(p) {
  if (p.maki) return [FILLINGS[p.maki].roll];
  const lines = [`${FISH[p.fish].label} nigiri`];
  if ((p.fish !== 'tamago' && p.fish !== 'unagi') || p.wasabi) lines.push(p.wasabi ? `${cap(BUILD.wasabiLevels[p.wasabi])} wasabi` : 'No wasabi');
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
    const same = (w) => (b.maki ? w.maki === b.maki : !w.maki && w.fish === b.fish);
    const kind = (w) => !!w.maki === !!b.maki;
    let match = want.find((w) => !w.used && same(w)) || want.find((w) => !w.used && kind(w)) || want.find((w) => !w.used);
    if (!match) continue;
    match.used = true;
    const wrongFish = !same(match);
    const rice = scoopScore(b.scoop) * 0.4 + b.shape * 0.6;
    const cut = wrongFish ? 0 : b.cut;
    const wasabi = [1, 0.5, 0, 0][Math.min(3, Math.abs(b.wasabi - (match.wasabi || 0)))];
    const place = clamp01(1 - Math.abs(b.dx) / 0.6);
    let top = 1;
    const asked = Object.keys(match.toppings || {});
    const given = Object.entries(b.toppings).filter(([, v]) => v).map(([k]) => k);
    for (const t of asked) {
      if (!b.toppings[t]) top -= 1 / Math.max(1, asked.length);
      else if (t === 'ikura') top -= (Math.min(1, Math.abs(b.toppings.ikura - match.toppings.ikura) / 4) * 0.5) / asked.length;
    }
    for (const t of given) if (!asked.includes(t)) top -= 0.3;
    const build = clamp01(wasabi * 0.3 + place * 0.3 + clamp01(top) * 0.4);
    results.push({ fish: b.fish || b.maki, wrongFish, rice, cut, build });
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

// Bigger orders tip more; a roll counts as one and a half pieces of work.
export function orderSize(order) {
  return order.pieces.reduce((n, p) => n + (p.maki ? 1.5 : 1), 0);
}

export function tipFor(total, dayIndex, size = 1) {
  const base = SCORE.tipBase * (1 + dayIndex * SCORE.tipPerDay) * (1 + 0.55 * (size - 1));
  return Math.round((base * Math.pow(total / 100, 1.6)) / 10) * 10;
}

// What a perfect day would earn, for the star goals.
export function perfectDay(orders, dayIndex) {
  return orders.reduce((s, o) => s + tipFor(100, dayIndex, orderSize(o)) * (o.rush ? RUSH.tip : 1), 0);
}

export function starsFor(tips, perfect) {
  return RUSH.stars.filter((k) => tips >= perfect * k).length;
}

export function rankFor(avg) {
  if (avg >= 92) return 'Counter legend';
  if (avg >= 80) return 'Trusted itamae';
  if (avg >= 65) return 'Steady hands';
  if (avg >= 45) return 'Rice rookie';
  return 'Apprentice';
}
