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
  customer: { x: 0, z: -7.4, y: -0.2, scale: 3.6 }, // seated, peeking over the counter
  queue: { x: 9.5, z: -12.5, y: -1.9, scale: 2.4 }, // next in line
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
  // species picks the animal in critters.js.
  { name: 'Mochi', species: 'cat' },
  { name: 'Kinako', species: 'shiba' },
  { name: 'Ume', species: 'bunny' },
  { name: 'Azuki', species: 'bear' },
  { name: 'Sasa', species: 'panda' },
  { name: 'Yuzu', species: 'fox' },
];

export const PERF = {
  slowFrameMs: 24,
  window: 2.5,
  pixelRatioSteps: [2, 1.5, 1.25, 1],
};
