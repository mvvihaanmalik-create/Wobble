// Squishi tuning. World units: 1 unit is about 2 cm of real sushi.

export const GAME = {
  name: 'Squishi.',
  url: 'squish.example', // short URL drawn into clips and screenshots
  storageKey: 'squishi.v1',
};

// Where things sit on the counter (world space, counter top at y = 0).
export const LAYOUT = {
  counter: { x0: -16, x1: 16, zCustomer: -3.5, zChef: 4.6, thickness: 0.7 },
  tub: { x: -10, z: 1.3, radius: 2.7, height: 1.35 }, // hangiri rice tub
  mat: { x: -5.4, z: 1.6 }, // where rice is pressed
  board: { x: 0, z: 1.5, w: 9.4, d: 4.6, h: 0.32 }, // cutting board
  block: { x: -3.6, z: 1.35 }, // left end of the fish block, on the board
  tray: { x: 6.3, z: 1.7 }, // slices wait here
  geta: { x: 10.8, z: 1.4, w: 6.6, d: 2.9, h: 0.55 }, // serving board
  slots: { 1: [-0.55], 2: [-1.85, 0.75] }, // nigiri positions along the geta by piece count
  slotAngle: 0.32, // nigiri sit at a slight angle, the way they are plated
  customer: { x: 0, z: -7.4, y: -2.05, scale: 3.85 }, // seated, peeking over the counter
  queue: { x: 9.5, z: -12.5, y: -2.6, scale: 2.3 }, // next in line
  sous: { x: -7.9, z: -2.5, y: 0, scale: 1.6, turn: 0.35 }, // the sous chef, perched on the counter by the tub
  sousTitle: { x: 7.6, z: -6, y: -0.3, scale: 2.8, turn: -0.4 }, // on the title, next to the guest
};

// Camera angle for each station. fitW is the world width that must stay in
// view at the target, so portrait phones widen the lens instead of cropping.
// focus: the point kept sharp by depth of field. bokeh: how soft the rest goes.
export const VIEWS = {
  title: { pos: [0, 7.6, 15], target: [0, 3.2, -6], focus: [0, 2.2, -7.4], bokeh: 4.5, fov: 40, fitW: 18, portrait: { pos: [0, 4.2, 12], target: [0, -2.6, -6.5], focus: [0, 1.6, -7.4], bokeh: 4.5, fov: 40, fitW: 9.5 } },
  counter: { pos: [0, 8.4, 13.5], target: [0, 2.6, -6], focus: [0, 2, -7.4], bokeh: 3.2, fov: 40, fitW: 17, portrait: { pos: [0, 7.4, 12], target: [0, 1.2, -5], focus: [0, 1.8, -7.4], bokeh: 3.2, fov: 40, fitW: 10 } },
  rice: { pos: [-7.6, 11.5, 7.2], target: [-7.6, 0.2, 1.3], focus: [-7.2, 0.6, 1.5], bokeh: 2.2, fov: 36, fitW: 11, portrait: { pos: [-8, 13.5, 9.2], target: [-8, 0.2, 3.1], focus: [-7.4, 0.6, 1.6], bokeh: 2.2, fov: 36, fitW: 9.5 } },
  knife: { pos: [-0.2, 2.9, 10.5], target: [-0.2, 0.85, 1.3], focus: [1.8, 1.1, 1.9], bokeh: 4.2, fov: 30, fitW: 10.5, portrait: { pos: [2.2, 3.4, 9.5], target: [2.2, 0.4, 1.3], focus: [2.4, 1.1, 1.9], bokeh: 4.2, fov: 30, fitW: 6 } },
  build: { pos: [8.7, 7.6, 10.2], target: [8.7, 0.3, 2.9], focus: [10.2, 0.8, 1.6], bokeh: 3, fov: 36, fitW: 11, portrait: { pos: [9.4, 11, 10.2], target: [9.4, 0.3, 3.6], focus: [10.4, 0.8, 1.6], bokeh: 3, fov: 36, fitW: 8.6 } },
};
export const CAMERA = {
  moveSeconds: 0.75, // station to station camera move
  drift: 0.01, // idle camera sway, as a fraction of the camera's distance
  parallax: 0.014, // how much the camera leans toward the pointer
};

// Rice station.
export const RICE = {
  scoopRate: 0.62, // scoop fill per second while holding the tub
  scoopTarget: [0.55, 0.75], // good scoop size band (0..1)
  pressRate: 0.85, // press meter fill per second while holding
  pressGood: [0.58, 0.82], // release inside this band for a clean press
  pressOver: 0.92, // above this the rice gets squashed flat
  presses: 3, // presses to form a piece
};

// Knife station.
export const KNIFE = {
  idealAngle: 45, // degrees from vertical
  idealThickness: 0.42, // slice thickness in units
  angleTolerance: 22, // degrees off before the score hits zero
  thicknessTolerance: 0.3, // units off before the score hits zero
  minThickness: 0.14,
  maxThickness: 1.2,
};

// Build station.
export const BUILD = {
  wasabiLevels: ['none', 'light', 'regular', 'extra'], // index = dabs
  ikuraTarget: 5,
};

export const FISH = {
  salmon: { label: 'Salmon', jp: 'Sake' },
  tuna: { label: 'Tuna', jp: 'Maguro' },
  tamago: { label: 'Egg', jp: 'Tamago' },
  unagi: { label: 'Eel', jp: 'Unagi' },
};

export const TOPPINGS = {
  ikura: { label: 'Ikura' },
  sesame: { label: 'Sesame' },
  scallion: { label: 'Scallion' },
  sauce: { label: 'Sweet sauce' },
  nori: { label: 'Nori belt' },
};

// Each day adds something. pieces: [min, max] per order.
export const DAYS = [
  // fish: nigiri on the menu. maki: roll fillings, with makiChance per order.
  // rush: guests (by index) who arrive in a rush: less patience, bigger tips.
  // dish: what the day introduces, shown on its intro card.
  { title: 'Day 1', note: 'Salmon only. Learn the counter.', customers: 3, fish: ['salmon'], toppings: [], pieces: [1, 1], patience: 150 },
  { title: 'Day 2', note: 'Tuna arrives. So do toppings.', customers: 4, fish: ['salmon', 'tuna'], toppings: ['sesame', 'scallion'], pieces: [1, 2], patience: 170, dish: 'tuna' },
  { title: 'Day 3', note: 'Egg nigiri in a nori belt. Ikura too.', customers: 4, fish: ['salmon', 'tuna', 'tamago'], toppings: ['sesame', 'scallion', 'ikura', 'nori'], pieces: [1, 2], patience: 185, dish: 'tamago' },
  { title: 'Day 4', note: 'Rolls. Spread, fill, roll and cut.', customers: 4, fish: ['salmon', 'tuna'], toppings: ['sesame', 'scallion'], maki: ['kappa', 'tekka'], makiChance: 0.65, pieces: [1, 1], patience: 230, dish: 'maki' },
  { title: 'Day 5', note: 'Unagi, grilled and glazed.', customers: 5, fish: ['salmon', 'unagi', 'tamago'], toppings: ['sesame', 'scallion', 'sauce', 'nori'], maki: ['kappa', 'tekka', 'sake'], makiChance: 0.3, pieces: [1, 2], patience: 210, dish: 'unagi' },
  { title: 'Day 6', note: 'Rush hour. They keep coming.', customers: 7, fish: ['salmon', 'tuna', 'tamago', 'unagi'], toppings: ['sesame', 'scallion', 'ikura', 'sauce', 'nori'], maki: ['kappa', 'tekka', 'sake'], makiChance: 0.25, pieces: [1, 2], patience: 175, rush: [2, 5] },
  { title: 'Day 7', note: 'Omakase night. Anything goes.', customers: 6, fish: ['salmon', 'tuna', 'tamago', 'unagi'], toppings: ['sesame', 'scallion', 'ikura', 'sauce', 'nori'], maki: ['kappa', 'tekka', 'sake'], makiChance: 0.4, pieces: [2, 2], patience: 240, rush: [3, 4] },
];

// Rush hour, combos and speed.
export const RUSH = {
  patience: 0.62, // rush guests have this much of the usual patience
  tip: 1.5, // and tip this much more
  comboAt: 80, // plates scoring this or better keep a combo going
  comboStep: 0.25, // each plate in a combo adds this to the tip multiplier
  comboMax: 2, // up to x2
  speedy: 0.4, // served within this share of patience: speed bonus
  speedyTip: 0.2,
  favouriteTip: 0.25, // a regular's favourite, done well
  favouriteAt: 85,
  stars: [0.4, 0.62, 0.82], // share of a perfect day's tips for one, two, three stars
};

// How the final score is weighted.
export const SCORE = {
  weights: { rice: 0.25, cut: 0.25, build: 0.35, wait: 0.15 },
  tipBase: 300, // yen for a perfect plate on day 1
  tipPerDay: 0.25, // extra multiplier per day
};

export const CUSTOMER_LOOKS = [
  // species picks the animal in critters.js. fav: the dish they love; nail
  // it and they tip more, and the Sushi book notes it.
  { name: 'Mochi', species: 'cat', kind: 'Calico cat', fav: 'n:salmon' },
  { name: 'Kinako', species: 'shiba', kind: 'Shiba', fav: 'n:tamago' },
  { name: 'Ume', species: 'bunny', kind: 'Bunny', fav: 'm:kappa' },
  { name: 'Azuki', species: 'bear', kind: 'Bear', fav: 'n:unagi' },
  { name: 'Sasa', species: 'panda', kind: 'Panda', fav: 'm:tekka' },
  { name: 'Yuzu', species: 'fox', kind: 'Fox', fav: 'n:tuna' },
];

// Every dish in the Sushi book. key: n:<fish> for nigiri, m:<filling> for
// rolls. day: the day it first appears. piece: how the book photographs it.
export const DISHES = [
  { key: 'n:salmon', name: 'Salmon nigiri', jp: '鮭', day: 0, piece: { fish: 'salmon', wasabi: 1, toppings: {} } },
  { key: 'n:tuna', name: 'Tuna nigiri', jp: '鮪', day: 1, piece: { fish: 'tuna', wasabi: 1, toppings: {} } },
  { key: 'n:tamago', name: 'Tamago nigiri', jp: '玉子', day: 2, piece: { fish: 'tamago', wasabi: 0, toppings: { nori: true } } },
  { key: 'm:kappa', name: 'Cucumber roll', jp: '河童巻き', day: 3, piece: { maki: 'kappa', wasabi: 0, toppings: {} } },
  { key: 'm:tekka', name: 'Tuna roll', jp: '鉄火巻き', day: 3, piece: { maki: 'tekka', wasabi: 0, toppings: {} } },
  { key: 'n:unagi', name: 'Unagi nigiri', jp: '鰻', day: 4, piece: { fish: 'unagi', wasabi: 0, toppings: { sauce: true, nori: true, sesame: true } } },
  { key: 'm:sake', name: 'Salmon roll', jp: '鮭巻き', day: 4, piece: { maki: 'sake', wasabi: 0, toppings: {} } },
];
export const dishKey = (p) => (p.maki ? `m:${p.maki}` : `n:${p.fish}`);

export const PERF = {
  slowFrameMs: 22, // average frame time that counts as slow
  window: 1.5, // seconds of slow frames before stepping down a tier
  settle: 2, // seconds to ignore after loading or a tier change
  pixelRatioSteps: [2, 1.5, 1.25, 1],
};
