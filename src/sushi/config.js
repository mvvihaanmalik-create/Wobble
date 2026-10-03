// Squishi tuning. World units: 1 unit is about 2 cm of real sushi.

export const GAME = {
  name: 'Squishi.',
  url: 'squish.example', // short URL drawn into clips and screenshots
  storageKey: 'squishi.v1',
};

// Where things sit on the counter (world space, counter top at y = 0).
export const LAYOUT = {
  counter: { x0: -25, x1: 16, zCustomer: -3.5, zChef: 4.6, thickness: 0.7 },
  tub: { x: -10, z: 1.3, radius: 2.7, height: 1.35 }, // hangiri rice tub
  mat: { x: -5.4, z: 1.6 }, // where rice is pressed
  board: { x: 0, z: 1.5, w: 9.4, d: 4.6, h: 0.32 }, // cutting board
  block: { x: -3.6, z: 1.35 }, // left end of the fish block, on the board
  tray: { x: 6.3, z: 1.7 }, // slices wait here
  geta: { x: 10.8, z: 1.4, w: 6.6, d: 2.9, h: 0.55 }, // serving board
  slots: { 1: [-0.55], 2: [-1.85, 0.75] }, // nigiri positions along the geta by piece count
  slotAngle: 0.32, // nigiri sit at a slight angle, the way they are plated
  customer: { x: 0, z: -6.4, y: -1.7, scale: 2.5 }, // seated, paws on the ledge, head over the counter
  queue: { x: 9.5, z: -12.5, y: -2.6, scale: 1.5 }, // next in line
  sous: { x: -7.9, z: -2.5, y: 0, scale: 1.05, turn: 0.35 }, // the sous chef, perched on the counter by the tub
  sousTitle: { x: 7.6, z: -5.6, y: -0.3, scale: 1.7, turn: -0.4 }, // on the title, next to the guest
  // The stove at the far left of the counter: a pot for udon, a pan for gyoza,
  // the udon bowl in front of the pot and the gyoza board in front of the pan.
  stove: { x: -19.5, z: 0.6, top: 0.5, pot: [-21.4, 0.6], pan: [-17.6, 0.6], bowl: [-21.4, 3.2], prep: [-17.6, 3.2] },
};

// Camera angle for each station. fitW is the world width that must stay in
// view at the target, so portrait phones widen the lens instead of cropping.
// focus: the point kept sharp by depth of field. bokeh: how soft the rest goes.
export const VIEWS = {
  title: { pos: [0, 7.6, 15], target: [0, 3.2, -6], focus: [0, 2.2, -7.4], bokeh: 4.5, fov: 40, fitW: 18, portrait: { pos: [0, 4.2, 12], target: [0, -2.6, -6.5], focus: [0, 1.6, -7.4], bokeh: 4.5, fov: 40, fitW: 9.5 } },
  counter: { pos: [0, 8.4, 13.5], target: [0, 2.6, -6], focus: [0, 2, -7.4], bokeh: 3.2, fov: 40, fitW: 17, portrait: { pos: [0, 7.4, 12], target: [0, 1.2, -5], focus: [0, 1.8, -7.4], bokeh: 3.2, fov: 40, fitW: 10 } },
  rice: { pos: [-7.6, 11.5, 7.2], target: [-7.6, 0.2, 1.3], focus: [-7.2, 0.6, 1.5], bokeh: 2.2, fov: 36, fitW: 11, portrait: { pos: [-8, 13.5, 9.2], target: [-8, 0.2, 3.1], focus: [-7.4, 0.6, 1.6], bokeh: 2.2, fov: 36, fitW: 9.5 } },
  knife: { pos: [-0.2, 2.9, 10.5], target: [-0.2, 0.85, 1.3], focus: [1.8, 1.1, 1.9], bokeh: 4.2, fov: 30, fitW: 10.5, portrait: { pos: [2.2, 3.4, 9.5], target: [2.2, 0.4, 1.3], focus: [2.4, 1.1, 1.9], bokeh: 4.2, fov: 30, fitW: 6 } },
  stove: { pos: [-20.1, 10.4, 9.6], target: [-20.1, 0.6, 1.9], focus: [-19.5, 0.9, 2.1], bokeh: 2.4, fov: 36, fitW: 10.8, portrait: { pos: [-19.5, 13.5, 10.6], target: [-19.5, 0.4, 2.6], focus: [-19.5, 0.9, 2.2], bokeh: 2.4, fov: 36, fitW: 8.4 } },
  // Close-ups for each stove dish, the way Cooking Mama frames a step.
  stoveUdon: { pos: [-21.1, 10.6, 10.4], target: [-21.1, 0.4, 2.9], focus: [-21.2, 1, 2.2], bokeh: 2.2, fov: 36, fitW: 7.8, portrait: { pos: [-21.1, 13, 11.2], target: [-21.1, 0.3, 3.2], focus: [-21.2, 1, 2.2], bokeh: 2.2, fov: 36, fitW: 6.4 } },
  stoveGyoza: { pos: [-17.8, 10.6, 10.4], target: [-17.8, 0.3, 3.0], focus: [-17.7, 0.5, 2.6], bokeh: 2.2, fov: 36, fitW: 7.8, portrait: { pos: [-17.8, 13, 11.2], target: [-17.8, 0.3, 3.3], focus: [-17.7, 0.5, 2.6], bokeh: 2.2, fov: 36, fitW: 6.4 } },
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

// Stove dishes. Rates are per second; bands are where to stop for a clean step.
export const HOT = {
  ramen: { cookRate: 1 / 5.5, cookBand: [0.58, 0.78], stirs: 3, pourRate: 0.45, pourBand: [0.66, 0.84], pourOver: 0.95 },
  takoyaki: { count: 6, fillRate: 0.6, fillBand: [0.6, 0.85], fillOver: 0.95, brownRate: 1 / 5, turnBand: [0.5, 0.8] },
  udon: { cookRate: 1 / 7, cookBand: [0.6, 0.8], stirs: 3, pourRate: 0.42, pourBand: [0.66, 0.84], pourOver: 0.95 },
  gyoza: { count: 3, fillRate: 0.75, fillBand: [0.5, 0.72], fillOver: 0.9, pleats: 5, pleatTime: 2.8, brownRate: 1 / 6.5, brownBand: [0.55, 0.78], steamRate: 1 / 4.5, steamBand: [0.6, 0.85] },
};

export const UDON = {
  kitsune: { label: 'Kitsune udon', jp: 'きつねうどん', toppings: ['kamaboko', 'scallion', 'aburaage'] },
  tempura: { label: 'Tempura udon', jp: '天ぷらうどん', toppings: ['kamaboko', 'scallion', 'tempura'] },
};

export const RAMEN = {
  shoyu: { label: 'Shoyu ramen', jp: '醤油ラーメン', broth: '#a8641e', toppings: ['chashu', 'naruto', 'menma', 'scallion'] },
  tonkotsu: { label: 'Tonkotsu ramen', jp: '豚骨ラーメン', broth: '#efe0c4', toppings: ['chashu', 'egg', 'nori', 'scallion'] },
};

export const ONIGIRI = {
  ume: { label: 'Ume onigiri', jp: '梅おにぎり', filling: 'Umeboshi', color: '#d63a4a' },
  sake: { label: 'Salmon onigiri', jp: '鮭おにぎり', filling: 'Salmon', color: '#ff8a5c' },
};

export const TAKOYAKI = { label: 'Takoyaki', jp: 'たこ焼き', count: 6, toppings: ['sauce', 'mayo', 'katsuobushi', 'aonori'] };

export const HOT_TOPPINGS = {
  kamaboko: { label: 'Kamaboko' },
  scallion: { label: 'Scallion' },
  aburaage: { label: 'Aburaage' },
  tempura: { label: 'Ebi tempura' },
  chashu: { label: 'Chashu' },
  naruto: { label: 'Naruto' },
  menma: { label: 'Menma' },
  egg: { label: 'Ajitama egg' },
  nori: { label: 'Nori' },
  sauce: { label: 'Takoyaki sauce' },
  mayo: { label: 'Mayo' },
  katsuobushi: { label: 'Bonito flakes' },
  aonori: { label: 'Aonori' },
};

// Ten stages. Each has its own menu: dishes and how often they come up.
// Orders are dealt from a shuffled bag of the menu, so no dish repeats back
// to back. Keys: n:<fish> nigiri, m:<filling> roll, o:<filling> onigiri,
// u:<kind> udon, r:<kind> ramen, g:gyoza, t:takoyaki.
// fish, toppings and maki: what the knife, build and roll steps offer.
// pieces: nigiri per sushi order. rush: guests (by index) who arrive in a
// rush. dish: what the stage introduces, shown on its intro card.
export const DAYS = [
  { title: 'Stage 1', name: 'First shift', note: 'Salmon nigiri. Learn the counter.', customers: 3, patience: 170, pieces: [1, 1], fish: ['salmon'], toppings: [], menu: [['n:salmon', 1]] },
  { title: 'Stage 2', name: 'Tuna day', note: 'Tuna arrives, with sesame and scallion.', customers: 4, patience: 175, pieces: [1, 2], fish: ['salmon', 'tuna'], toppings: ['sesame', 'scallion'], menu: [['n:tuna', 3], ['n:salmon', 2]], dish: 'tuna' },
  { title: 'Stage 3', name: 'Onigiri', note: 'Rice balls: fill, shape, wrap.', customers: 4, patience: 185, pieces: [1, 1], fish: ['salmon', 'tuna'], toppings: ['sesame', 'scallion'], menu: [['o:ume', 2], ['o:sake', 2], ['n:salmon', 1], ['n:tuna', 1]], dish: 'onigiri' },
  { title: 'Stage 4', name: 'Rolls', note: 'Spread, fill, roll and cut.', customers: 5, patience: 220, pieces: [1, 1], fish: ['salmon', 'tuna'], toppings: ['sesame', 'scallion'], maki: ['kappa', 'tekka'], menu: [['m:kappa', 2], ['m:tekka', 2], ['n:tuna', 1], ['o:ume', 1]], dish: 'maki' },
  { title: 'Stage 5', name: 'Sweet and glazed', note: 'Tamago in a nori belt, glazed unagi, ikura.', customers: 5, patience: 200, pieces: [1, 2], fish: ['salmon', 'tamago', 'unagi'], toppings: ['sesame', 'ikura', 'sauce', 'nori'], maki: ['sake'], menu: [['n:unagi', 2], ['n:tamago', 2], ['n:salmon', 1], ['m:sake', 1]], dish: 'unagi' },
  { title: 'Stage 6', name: 'Udon', note: 'Boil, stir and pour.', customers: 5, patience: 220, pieces: [1, 1], fish: ['salmon', 'tuna'], toppings: ['sesame', 'scallion'], maki: ['kappa'], menu: [['u:kitsune', 2], ['u:tempura', 2], ['n:salmon', 1], ['m:kappa', 1]], dish: 'udon' },
  { title: 'Stage 7', name: 'Gyoza', note: 'Fill, pleat and fry. First rush.', customers: 6, patience: 230, pieces: [1, 2], fish: ['salmon', 'tuna'], toppings: ['sesame', 'scallion'], menu: [['g:gyoza', 3], ['u:kitsune', 1], ['n:tuna', 1], ['o:sake', 1]], dish: 'gyoza', rush: [3, 4] },
  { title: 'Stage 8', name: 'Ramen', note: 'Noodles, broth and all the toppings.', customers: 6, patience: 230, pieces: [1, 1], fish: ['salmon', 'tuna'], toppings: ['sesame', 'scallion'], menu: [['r:shoyu', 2], ['r:tonkotsu', 2], ['g:gyoza', 1], ['o:ume', 1]], dish: 'ramen', rush: [3, 4] },
  { title: 'Stage 9', name: 'Takoyaki', note: 'Pour, turn, top. Keep them round.', customers: 6, patience: 225, pieces: [1, 2], fish: ['tuna', 'unagi'], toppings: ['sesame', 'sauce', 'nori'], maki: ['tekka'], menu: [['t:takoyaki', 3], ['r:shoyu', 1], ['n:unagi', 1], ['m:tekka', 1]], dish: 'takoyaki', rush: [2, 4] },
  { title: 'Stage 10', name: 'Grand night', note: 'The whole menu, and a long rush.', customers: 8, patience: 210, pieces: [2, 2], fish: ['salmon', 'tuna', 'tamago', 'unagi'], toppings: ['sesame', 'scallion', 'ikura', 'sauce', 'nori'], maki: ['kappa', 'tekka', 'sake'], menu: [['n:salmon', 1], ['n:tuna', 1], ['n:unagi', 1], ['n:tamago', 1], ['m:kappa', 1], ['m:tekka', 1], ['o:sake', 1], ['u:tempura', 1], ['r:tonkotsu', 1], ['g:gyoza', 1], ['t:takoyaki', 1]], rush: [3, 6] },
];

// While people are testing, every stage is open.
export const UNLOCK_ALL = true;

// Kinds of a dish type on a stage's menu, for example udon -> ['kitsune'].
export const menuKinds = (d, type) => [...new Set(d.menu.filter(([k]) => k.startsWith(`${type}:`)).map(([k]) => k.split(':')[1]))];
// Does a stage use the stove?
export const usesStove = (d) => d.menu.some(([k]) => /^[urgt]:/.test(k));

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
  { name: 'Mochi', species: 'cat', kind: 'Calico cat', shirt: { color: '#e86a5c', alt: '#fff4e6', pattern: 'stripes' }, fav: 'n:salmon' },
  { name: 'Kinako', species: 'shiba', kind: 'Shiba', shirt: { color: '#6fa3d8', alt: '#ffffff', pattern: 'gingham' }, fav: 'r:shoyu' },
  { name: 'Ume', species: 'bunny', kind: 'Bunny', shirt: { color: '#ff9cb8', alt: '#fffaf6', pattern: 'dots' }, fav: 'o:ume' }, // Ume loves ume onigiri
  { name: 'Azuki', species: 'bear', kind: 'Bear', shirt: { color: '#d9824a', alt: '#7a3f22', pattern: 'plaid' }, fav: 'n:unagi' },
  { name: 'Sasa', species: 'panda', kind: 'Panda', shirt: { color: '#ffd25e', alt: '#ff9a3c', pattern: 'dots' }, fav: 't:takoyaki' },
  { name: 'Yuzu', species: 'fox', kind: 'Fox', shirt: { color: '#3d5a8a', alt: '#f6f2ea', pattern: 'stripes' }, fav: 'u:kitsune' }, // a fox who loves kitsune udon, of course
];

// Every dish in the Sushi book. key: n:<fish> for nigiri, m:<filling> for
// rolls. day: the day it first appears. piece: how the book photographs it.
export const DISHES = [
  { key: 'n:salmon', name: 'Salmon nigiri', jp: '鮭', day: 0, piece: { fish: 'salmon', wasabi: 1, toppings: {} } },
  { key: 'n:tuna', name: 'Tuna nigiri', jp: '鮪', day: 1, piece: { fish: 'tuna', wasabi: 1, toppings: {} } },
  { key: 'o:ume', name: 'Ume onigiri', jp: '梅おにぎり', day: 2, piece: { onigiri: 'ume' } },
  { key: 'o:sake', name: 'Salmon onigiri', jp: '鮭おにぎり', day: 2, piece: { onigiri: 'sake' } },
  { key: 'm:kappa', name: 'Cucumber roll', jp: '河童巻き', day: 3, piece: { maki: 'kappa', wasabi: 0, toppings: {} } },
  { key: 'm:tekka', name: 'Tuna roll', jp: '鉄火巻き', day: 3, piece: { maki: 'tekka', wasabi: 0, toppings: {} } },
  { key: 'n:tamago', name: 'Tamago nigiri', jp: '玉子', day: 4, piece: { fish: 'tamago', wasabi: 0, toppings: { nori: true } } },
  { key: 'n:unagi', name: 'Unagi nigiri', jp: '鰻', day: 4, piece: { fish: 'unagi', wasabi: 0, toppings: { sauce: true, nori: true, sesame: true } } },
  { key: 'm:sake', name: 'Salmon roll', jp: '鮭巻き', day: 4, piece: { maki: 'sake', wasabi: 0, toppings: {} } },
  { key: 'u:kitsune', name: 'Kitsune udon', jp: 'きつねうどん', day: 5, piece: { udon: 'kitsune' } },
  { key: 'u:tempura', name: 'Tempura udon', jp: '天ぷらうどん', day: 5, piece: { udon: 'tempura' } },
  { key: 'g:gyoza', name: 'Gyoza', jp: '餃子', day: 6, piece: { gyoza: 3 } },
  { key: 'r:shoyu', name: 'Shoyu ramen', jp: '醤油ラーメン', day: 7, piece: { ramen: 'shoyu' } },
  { key: 'r:tonkotsu', name: 'Tonkotsu ramen', jp: '豚骨ラーメン', day: 7, piece: { ramen: 'tonkotsu' } },
  { key: 't:takoyaki', name: 'Takoyaki', jp: 'たこ焼き', day: 8, piece: { takoyaki: 6 } },
];
// u:<kind> udon, r:<kind> ramen, g:gyoza, t:takoyaki, o:<filling> onigiri,
// m:<filling> rolls, n:<fish> nigiri.
export const dishKey = (p) => (p.udon ? `u:${p.udon}` : p.ramen ? `r:${p.ramen}` : p.gyoza ? 'g:gyoza' : p.takoyaki ? 't:takoyaki' : p.onigiri ? `o:${p.onigiri}` : p.maki ? `m:${p.maki}` : `n:${p.fish}`);

export const PERF = {
  slowRatio: 1.18, // average frame time over the 60 fps budget by this much is slow
  scaleWindow: 0.6, // seconds of slow frames before trimming resolution
  scaleStep: 0.12, // how much resolution each trim takes
  recoverAfter: 6, // seconds of smooth frames before taking resolution back
  window: 1.5, // seconds of slow frames at the lowest scale before stepping down a tier
  settle: 2, // seconds to ignore after loading or a tier change
  pixelRatioSteps: [2, 1.5, 1.25, 1],
};
