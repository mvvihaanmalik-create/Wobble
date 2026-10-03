import { BUILD, CUSTOMER_LOOKS, DAYS, FISH, HOT, HOT_TOPPINGS, KNIFE, ONIGIRI, RAMEN, RICE, RUSH, SCORE, TAKOYAKI, TOPPINGS, UDON, dishKey } from './config.js';
import { FILLINGS } from './maki.js';
import { mulberry } from './set.js';

// One order: a guest and what they want. A piece is a nigiri ({ fish,
// wasabi, toppings }), a roll ({ maki }), an onigiri ({ onigiri }), a bowl
// of udon or ramen ({ udon | ramen, toppings }), gyoza ({ gyoza }) or
// takoyaki ({ takoyaki, toppings }). Stove dishes and onigiri come on their
// own; a nigiri order has one or two pieces; a roll comes with at most one
// nigiri, so the board has room.
//
// Dishes are dealt from a shuffled bag of the stage's menu, weighted, so
// the stage's own dish leads and nothing repeats back to back.
export function makeOrders(dayIndex, seed = Date.now()) {
  const day = DAYS[dayIndex];
  const rand = mulberry(seed);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const looks = [...CUSTOMER_LOOKS].sort(() => rand() - 0.5);
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
  const allOn = (list) => Object.fromEntries(list.map((t) => [t, true]));
  // The pieces for one dish key.
  const dish = (key) => {
    const [type, what] = key.split(':');
    if (type === 'u') return [{ udon: what, toppings: allOn(UDON[what].toppings) }];
    if (type === 'r') return [{ ramen: what, toppings: allOn(RAMEN[what].toppings) }];
    if (type === 'g') return [{ gyoza: HOT.gyoza.count }];
    if (type === 't') return [{ takoyaki: TAKOYAKI.count, toppings: allOn(TAKOYAKI.toppings) }];
    if (type === 'o') return [{ onigiri: what }];
    if (type === 'm') {
      const roll = { maki: what, wasabi: 0, toppings: {} };
      return day.pieces[1] > 1 && rand() < 0.4 ? [nigiri(pick(day.fish.filter((f) => f !== 'tamago')) || day.fish[0]), roll] : [roll];
    }
    const n = day.pieces[0] + Math.floor(rand() * (day.pieces[1] - day.pieces[0] + 1));
    const out = [nigiri(what)];
    // A second piece is a different fish when the stage has one.
    for (let k = 1; k < n; k++) out.push(nigiri(pick(day.fish.filter((f) => f !== what)) || what));
    return out;
  };
  // Deal the bag.
  const bag = [];
  const refill = () => {
    const b = day.menu.flatMap(([k, w]) => Array(w).fill(k)).sort(() => rand() - 0.5);
    bag.push(...b);
  };
  const keys = [];
  for (let c = 0; c < day.customers; c++) {
    if (!bag.length) refill();
    let i = 0;
    // Skip a repeat of the last dish if anything else is left.
    while (i < bag.length - 1 && bag[i] === keys[c - 1]) i++;
    keys.push(bag.splice(i, 1)[0]);
  }
  // The stage's new dish comes first, so its intro is the first ticket.
  const lead = day.menu[0][0];
  const li = keys.indexOf(lead);
  if (li > 0) [keys[0], keys[li]] = [keys[li], keys[0]];
  const orders = keys.map((key, c) => {
    const look = looks[c % looks.length];
    // Regulars often swap to their favourite when the menu has it.
    const menuHas = day.menu.some(([k]) => k === look.fav);
    if (c > 0 && menuHas && key !== look.fav && rand() < 0.4) key = look.fav;
    const pieces = dish(key);
    const rush = c >= r0 && c <= r1;
    const slow = pieces.some((p) => isHot(p)) ? 1.15 : 1;
    return { look, pieces, patience: day.patience * slow * (rush ? RUSH.patience : 1), rush };
  });
  return orders;
}

export const isMaki = (p) => !!p.maki;
export const isHot = (p) => !!(p.udon || p.ramen || p.gyoza || p.takoyaki);
export const nigiriOf = (order) => order.pieces.filter((p) => !p.maki && !isHot(p) && !p.onigiri);
export const onigiriOf = (order) => (order ? order.pieces.filter((p) => p.onigiri) : []);
export const makiOf = (order) => order.pieces.filter((p) => p.maki);
export const hotOf = (order) => (order ? order.pieces.filter(isHot) : []);

// Where things sit on the serving board for an order: nigiri x positions,
// and the center of the roll's 3 by 2 grid.
export function plateLayout(order) {
  if (hotOf(order).length || onigiriOf(order).length) return { nigiri: [], maki: null, hot: -0.55 };
  const n = nigiriOf(order).length;
  const m = makiOf(order).length;
  if (!m) return { nigiri: { 1: [-0.55], 2: [-1.85, 0.75], 3: [-2.3, -0.75, 0.8] }[Math.max(1, Math.min(3, n))], maki: null };
  return n ? { nigiri: [-2.15], maki: 0.4 } : { nigiri: [], maki: -0.5 };
}

export function describePiece(p) {
  if (p.udon) return [UDON[p.udon].label, ...Object.keys(p.toppings).map((t) => HOT_TOPPINGS[t].label)];
  if (p.ramen) return [RAMEN[p.ramen].label, ...Object.keys(p.toppings).map((t) => HOT_TOPPINGS[t].label)];
  if (p.gyoza) return [`Gyoza ×${p.gyoza}`];
  if (p.takoyaki) return [`Takoyaki ×${p.takoyaki}`, ...Object.keys(p.toppings).map((t) => HOT_TOPPINGS[t].label)];
  if (p.onigiri) return [ONIGIRI[p.onigiri].label];
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
  const special = (x) => isHot(x) || !!x.onigiri;
  for (const b of built) {
    // Stove dishes and onigiri carry a dish key and their three step scores.
    const same = (w) => (b.key ? dishKey(w) === b.key : b.maki ? w.maki === b.maki : !w.maki && !special(w) && w.fish === b.fish);
    const kind = (w) => (b.key ? special(w) : !!w.maki === !!b.maki && !special(w));
    let match = want.find((w) => !w.used && same(w)) || want.find((w) => !w.used && kind(w)) || want.find((w) => !w.used);
    if (!match) continue;
    match.used = true;
    const wrongFish = !same(match);
    if (b.key) {
      if (wrongFish) {
        results.push({ fish: b.key, wrongFish, rice: 0, cut: 0, build: 0 });
        continue;
      }
      let build = b.parts[2];
      // Toppings: every one asked for, nothing extra.
      if (match.toppings && b.toppings) {
        const asked = Object.keys(match.toppings);
        const given = Object.keys(b.toppings);
        let top = 1;
        for (const t of asked) if (!given.includes(t)) top -= 1 / asked.length;
        for (const t of given) if (!asked.includes(t)) top -= 0.3;
        build = clamp01(top) * (b.parts[2] ?? 1);
      }
      results.push({ fish: b.key, rice: clamp01(b.parts[0]), cut: clamp01(b.parts[1]), build: clamp01(build) });
      continue;
    }
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
  const sp = order.pieces.find(special);
  const labels = !sp ? ['Rice', 'Cut', 'Build'] : sp.udon ? ['Boil', 'Dashi', 'Toppings'] : sp.ramen ? ['Boil', 'Broth', 'Toppings'] : sp.gyoza ? ['Filling', 'Pleats', 'Frying'] : sp.takoyaki ? ['Batter', 'Turning', 'Toppings'] : ['Rice', 'Filling', 'Wrap'];
  return { total, parts, results, missing, labels, extra: built.length - (order.pieces.length - missing) };
}

// Bigger orders tip more; a roll counts as one and a half pieces of work.
export function orderSize(order) {
  return order.pieces.reduce((n, p) => n + (isHot(p) ? 2 : p.maki ? 1.5 : p.onigiri ? 1.3 : 1), 0);
}

// 1 inside the band, falling off over `fall` outside it.
export function bandScore(v, [a, b], fall = 0.25) {
  if (v >= a && v <= b) return 1;
  const d = v < a ? a - v : v - b;
  return clamp01(1 - d / fall);
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
