// Every tuning number for the game feel lives here. Change a value, run `bun test`, take a screenshot.
// Units: a person is about 10 units tall. Speeds are units per second, angles radians.

export const STEP = 1 / 120;   // fixed simulation step (seconds); the game is deterministic for a given input stream

export const MIST = {
  top: 170,        // world y where cliffs start to fade into the mist
  bottom: 10,      // world y where they are fully gone
};

export const WALK = {
  speed: 40,          // default run
  sprint: 66,         // holding Shift
  accel: 340,         // how fast you reach speed
  friction: 420,      // how fast you stop with no input
  turnRate: 13,       // how fast the body turns to face the movement
  jumpSpeed: 40,
  gravity: 120,
  edgeMargin: 5,      // invisible wall this far inside the cliff edge
  radius: 2.4,        // collision radius of the character
};

export const SHIP = {
  maxSpeed: 340,      // top forward speed
  reverseSpeed: 90,
  accel: 420,         // forward thrust
  brake: 620,         // S while moving forward
  drag: 1.0,          // speed lost per second with no throttle (fraction)
  sideGrip: 5.0,      // how quickly sideways drift is killed: high = goes where it points
  turnRate: 2.5,      // yaw rate at low speed
  turnRateFast: 1.8,  // yaw rate at top speed
  turnResponse: 9,    // how quickly yaw rate follows the keys
  climbSpeed: 120,    // Space / Shift vertical speed
  climbResponse: 6,
  radius: 15,         // collision radius of the hull
  ceiling: 1100,      // gently pushed down above this
  floor: 110,         // gently pushed up below this (the mist is not a place to land)
  worldRadius: 4600,  // gently turned back beyond this
  hoverClearance: 5,  // cushion above the ground unless you are descending on purpose
  landSpeed: 14,      // touching down below this horizontal speed counts as landed
  autoLandMaxHeight: 240,   // E works from up to this high above ground
  autoLandSpeed: 110,
  boardRange: 24,     // how close the character must be to board
  deckY: 6.2,         // y of the deck in the model, where the rider stands
};

export const HOP = {
  duration: 0.55,     // seconds for the jump on / off the ship
  height: 9,          // arc height above the higher end
};

export const CAMERA = {
  walk: {
    distance: 46, minDistance: 16, maxDistance: 110,
    pitch: 0.36, minPitch: -0.12, maxPitch: 1.25,
    targetHeight: 9,
    followLag: 12,        // how tightly the camera tracks the character
    autoYaw: 0.75,        // how fast the camera swings behind a running character (0 = never)
    fov: 42,
  },
  fly: {
    distance: 104, height: 46, targetHeight: 25, lookAhead: 40,
    yawLag: 3.6,          // chase camera yaw lag: lower = swings wider in turns
    recenter: 0.9,        // seconds after the last mouse move before the view recentres behind the ship
    fov: 50, fovFast: 66,
  },
  blendRate: 3.2,         // how quickly a mode change blends between cameras
  mouseYaw: 0.0032, mousePitch: 0.0026, zoomStep: 0.0012,
};

export const LOD = {
  near: 350,          // within this of the rim: full detail, AO, shadows, grass
  mid: 1000,          // within this: full buildings on simplified terrain. Beyond it: proxy boxes
  hysteresis: 50,     // how far past a boundary you go before switching back
  crops: 620,         // crops turn into a coloured slab beyond this
  critters: 700,      // people and animals stop being drawn beyond this
  propellers: 500,    // parked ships' propellers stop being drawn beyond this
  slowFrame: 1 / 38,  // average frame time that makes adaptive quality step down
};

// Adaptive quality: starts at step 0, steps down while frames stay slow (src/main.js). ?hq turns this off and maxes things out.
export const QUALITY = [
  { pixelRatio: 1.5, ao: true },
  { pixelRatio: 1.25, ao: true },
  { pixelRatio: 1, ao: true },
  { pixelRatio: 1, ao: false },
  { pixelRatio: 0.75, ao: false },
];
