// Every number that changes how Squish looks, sounds, or feels lives here.
// Distances are in "em": 1 em is the font size of the jelly word.

export const APP = {
  defaultWord: 'Monday', // word shown on first load
  maxChars: 12, // input limit
  presets: ['Monday', 'Q4 goals', 'Inbox', 'Deadline'], // preset chips
  watermark: 'Squish.', // wordmark drawn into recordings and screenshots
  url: 'squish.example', // short URL drawn under the wordmark. Change me.
  rebuildDebounceMs: 260, // wait this long after typing stops before rebuilding the mesh
  storageKey: 'squish.v1', // localStorage prefix
};

export const FLAVORS = {
  amber: {
    label: 'Amber',
    color: '#ffe3a3', // base tint of the jelly surface
    attenuation: '#ffb02e', // color light picks up as it travels through
    attenuationDistance: 1.6, // shorter = deeper color in thick parts
    speck: '#5a2c06', // tiny dark specks suspended inside
    glow: '#ffae3a', // colored light pooled on the floor
  },
  lime: {
    label: 'Lime',
    color: '#ecfaa8',
    attenuation: '#b4e04e',
    attenuationDistance: 1.6,
    speck: '#28420a',
    glow: '#c4ec60',
  },
  berry: {
    label: 'Berry',
    color: '#ffc2d6',
    attenuation: '#f0588e',
    attenuationDistance: 1.3,
    speck: '#4a0619',
    glow: '#ff7aa4',
  },
};
export const DEFAULT_FLAVOR = 'amber';

export const GEOMETRY = {
  depth: 0.42, // extrusion depth of the letters, before bevel
  bevelThickness: 0.1, // how far the rounded bevel reaches front and back
  bevelSize: 0.04, // how far the bevel grows the outline sideways
  bevelSegments: 5, // rings in the bevel. More = rounder edges, fewer left for the faces
  curveSegments: 5, // points per glyph curve for short words
  curveSegmentsLong: 4, // points per glyph curve for long words (8+ chars)
  vertexBudget: 26000, // target vertex count at full quality
  vertexBudgetLow: 15000, // target vertex count after auto quality drops
  minEdge: 0.028, // never subdivide below this edge length
  sideEdgeFactor: 2.2, // sides and bevels subdivide this much coarser than the faces
  tracking: -0.02, // extra space between letters
  squashBand: 0.09, // height of the bottom band that sags onto the floor
  squashAmount: 0.025, // how much the bottom band sags and spreads
};

export const SIM = {
  dt: 1 / 120, // fixed physics timestep in seconds
  maxSubsteps: 4, // cap per frame so a lagging tab cannot spiral
  spring: 150, // pull of each vertex back to rest (scaled by Firmness)
  damping: 3.2, // velocity loss per second (scaled by Damping)
  anchor: 2.0, // extra spring near the floor so the base stays stuck down
  coupling: 3000, // neighbor Laplacian stiffness, spreads a poke through the body
  couplingViscosity: 30, // neighbor velocity smoothing, kills buzzing (keep under 0.5 / dt)
  pressure: 110, // volume term: dents push nearby surface outward
  gridCell: 0.085, // cell size of the coarse volume grid
  gridBlur: 3, // blur radius of that grid in cells
  softLimit: 0.3, // past this offset the jelly stiffens progressively
  softStiffen: 6, // how much stiffer it gets at the hard clamp
  maxDisplacement: 0.62, // hard clamp on any vertex offset. Keeps it from tearing
  depthFalloff: 0.45, // pokes and grabs fall off this much slower through the depth, so the back moves with the front
  floorFriction: 0.8, // how much bottom vertices stick sideways to the floor
  sleepEnergy: 2e-6, // below this the per-vertex layer parks until touched
};

export const MODES = {
  // Whole-letter wobble layered on top of the per-vertex body.
  shearSpring: 60, // stiffness of the side to side sway
  squashSpring: 95, // stiffness of the squash and stretch
  damping: 2.4, // how fast the sway dies down
  neighborCoupling: 26, // how much sway travels to the next letter
  maxShear: 0.32, // clamp on sway at the top of a letter
  maxSquash: 0.3, // clamp on squash (fraction of height)
  breathing: 0.006, // idle squash amplitude, the page breathing
  breathingRate: 1.3, // idle breathing speed, radians per second
  tremble: 0.0035, // idle sway amplitude, never dead still
};

export const INPUT = {
  tapMaxMs: 170, // presses shorter than this are taps
  dragThresholdPx: 7, // pointer travel before a press becomes a drag
  doubleTapMs: 320, // max gap between taps for a double tap
  doubleTapPx: 40, // max distance between taps for a double tap
  grabRadius: 0.32, // gaussian radius of a grab. Widens up to 1.5x on long pulls
  grabStiffness: 520, // how hard a grab pulls the surface to the pointer
  maxPull: 0.8, // longest stretch a drag can make
  leanShare: 0.55, // share of a drag taken by the whole letter leaning and stretching
  pokeRadius: 0.22, // gaussian radius of a tap
  pokeImpulse: 2.6, // inward speed of a quick tap
  pokeImpulseMax: 4.6, // inward speed of a long press
  pressDepth: 0.2, // how far a long press sinks in while held
  pressMaxMs: 650, // press duration that reaches full strength
  modeKick: 1.6, // how much a poke rocks the whole letter
  nudgeImpulse: 4.2, // the Nudge button
  pinchSquash: 0.9, // how strongly a two finger pinch squashes the word
};

export const WEIGHT = {
  size: [0.62, 0.46, 0.46], // width, height, depth of the weight
  radius: 0.12, // corner rounding of the weight
  dropHeight: 3.2, // how far above the word it starts
  gravity: 24, // em per second squared
  contactStiffness: 1500, // how hard the jelly pushes back
  contactDamping: 9, // energy lost on impact
  kickSideways: 3.4, // sideways speed after the bounce, sends it out of frame
  spin: 5, // spin after the bounce
  modeImpulse: 7, // squash kick given to the letters it lands on
  shake: 0.045, // screen shake strength
  shakeMs: 320, // screen shake length
};

export const SCENE = {
  background: ['#f6f1e8', '#e9e1d3'], // backdrop gradient, top to bottom
  fov: 28, // camera vertical field of view
  camTilt: 0.16, // how far above the word the camera sits, relative to distance
  fitWidth: 0.82, // fraction of the stage width the word may fill
  fitWidthPortrait: 0.94, // same, when the stage is taller than wide
  fitHeight: 0.62, // fraction of the stage height the word may fill
  drift: 0.06, // slow camera drift amount, radians
  parallax: 0.05, // pointer parallax amount, radians
  exposure: 1.05, // tone mapping exposure
  maxPixelRatio: 2, // device pixel ratio cap
  transmissionScale: 0.75, // resolution of the buffer the jelly refracts
};

export const STRESS = {
  scale: 1.0, // energy needed for about 63% released. Higher = slower climb. ~40s of play to finish
  idleFloor: 0.0009, // kinetic energy below this is ignored (idle tremble)
  ease: 2.4, // how fast the shown number chases the real one
  finish: 0.985, // fraction that counts as fully decompressed
};

export const RECORD = {
  seconds: 6, // clip length
  fps: 60, // capture frame rate
  longSide: 1280, // output resolution on the long side
  bitrate: 8_000_000, // video bitrate
  aspects: { '9:16': 9 / 16, '1:1': 1, '16:9': 16 / 9 },
  defaultAspect: '9:16',
};

export const AUDIO = {
  volume: 0.5, // master volume for effects
  squelchGapMs: 55, // minimum gap between squelches
};

export const PERF = {
  slowFrameMs: 22, // average frame time that counts as struggling
  window: 2.5, // seconds of slow frames before quality drops
  pixelRatioSteps: [2, 1.5, 1.25, 1], // pixel ratios tried in order
};
