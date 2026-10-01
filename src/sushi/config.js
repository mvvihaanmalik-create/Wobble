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
  customer: { x: 0, z: -7.4, y: -0.9, scale: 3.6 }, // seated, peeking over the counter
  queue: { x: 9.5, z: -12.5, y: -0.4, scale: 2.4 }, // next in line
};

// Camera angle for each station. fitW is the world width that must stay in
// view at the target, so portrait phones widen the lens instead of cropping.
export const VIEWS = {
  title: { pos: [0, 7.6, 15], target: [0, 3.2, -6], fov: 40, fitW: 18 },
  counter: { pos: [0, 8.4, 13.5], target: [0, 2.6, -6], fov: 40, fitW: 17 },
  rice: { pos: [-7.6, 11.5, 7.2], target: [-7.6, 0.2, 1.3], fov: 36, fitW: 11 },
  knife: { pos: [-0.2, 2.9, 10.5], target: [-0.2, 0.85, 1.3], fov: 30, fitW: 10.5 },
  build: { pos: [8.7, 7.6, 10.2], target: [8.7, 0.3, 2.9], fov: 36, fitW: 11 },
};
export const CAMERA = {
  moveSeconds: 0.75, // station to station camera move
  drift: 0.012, // idle camera sway, radians
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
};

export const TOPPINGS = {
  ikura: { label: 'Ikura' },
  sesame: { label: 'Sesame' },
  scallion: { label: 'Scallion' },
  sauce: { label: 'Sweet sauce' },
};

// Each day adds something. pieces: [min, max] per order.
export const DAYS = [
  { title: 'Day 1', note: 'Salmon only. Learn the counter.', customers: 3, fish: ['salmon'], toppings: [], pieces: [1, 1], patience: 150 },
  { title: 'Day 2', note: 'Tuna arrives. So do toppings.', customers: 4, fish: ['salmon', 'tuna'], toppings: ['sesame', 'scallion'], pieces: [1, 2], patience: 170 },
  { title: 'Day 3', note: 'Egg, ikura and sweet sauce. Busy night.', customers: 5, fish: ['salmon', 'tuna', 'tamago'], toppings: ['sesame', 'scallion', 'ikura', 'sauce'], pieces: [1, 2], patience: 190 },
];

// How the final score is weighted.
export const SCORE = {
  weights: { rice: 0.25, cut: 0.25, build: 0.35, wait: 0.15 },
  tipBase: 300, // yen for a perfect plate on day 1
  tipPerDay: 0.25, // extra multiplier per day
};

export const CUSTOMER_LOOKS = [
  { name: 'Mochi', shape: 'mochi', color: '#ffe3ef', attenuation: '#ff9cc0' },
  { name: 'Yuzu', shape: 'drop', color: '#fff2b3', attenuation: '#ffc93c' },
  { name: 'Matcha', shape: 'bean', color: '#e6f7c4', attenuation: '#8cc63a' },
  { name: 'Ume', shape: 'mochi', color: '#ffd0c4', attenuation: '#ff6f61' },
  { name: 'Ramune', shape: 'drop', color: '#d9f3ff', attenuation: '#4fb6f0' },
  { name: 'Kinako', shape: 'bean', color: '#f6e2c4', attenuation: '#d9a05b' },
];

export const PERF = {
  slowFrameMs: 24,
  window: 2.5,
  pixelRatioSteps: [2, 1.5, 1.25, 1],
};
