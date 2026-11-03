// Small levels for testing one thing at a time. Open with ?level=<id> or createGame(LEVELS.<id>) in a test.
import { PROPS } from "../game/props.js";

/** flat: one big round island, no swell, a ship, and one of each obstacle shape. For walking, collision and camera work. */
export const flat = {
  id: "flat",
  name: "Flat test island",
  spawn: { island: "a", x: 0, z: 0 },
  islands: [{ id: "a", x: 0, z: 0, top: 300, radius: 260, roughness: 0, swell: 0, grass: 0.3 }],
  ships: [{ id: "s", island: "a", x: 80, z: 0 }],
  props: [
    { island: "a", model: "home1", x: -80, z: -60 },
    { island: "a", model: "tree_round", x: 40, z: -60 },
    { island: "a", model: "well", x: -20, z: 60 },
    { island: "a", model: "mooring_mast", x: 120, z: 80 },
  ],
  views: { top: [[0, 700, 1], [0, 300, 0]] },
};

/** hop: two islands 500 apart with a ship on A. For take-off, cliffs, and landing. */
export const hop = {
  id: "hop",
  name: "Two-island hop",
  spawn: { island: "a", x: 0, z: 30 },
  islands: [
    { id: "a", name: "Island A", x: 0, z: 0, top: 300, radius: 100, roughness: 0.2 },
    { id: "b", name: "Island B", x: 0, z: 500, top: 360, radius: 110, roughness: 0.2 },
  ],
  ships: [{ id: "s", island: "a", x: 0, z: 0, yaw: 0 }],
  props: [{ island: "b", model: "home1", x: 0, z: -10 }],
  views: { side: [[600, 420, 250], [0, 300, 250]] },
};

/** flight: a landing island with an updraft and a downdraft in plain view, for trying the handling and the drafts. */
export const flight = {
  id: "flight",
  name: "Flight test",
  spawn: { island: "a", x: 0, z: 30 },
  islands: [{ id: "a", name: "Island", x: 0, z: 0, top: 300, radius: 110, roughness: 0.15 }],
  ships: [{ id: "s", island: "a", x: 0, z: 0, yaw: 0 }],
  drafts: { list: [{ x: 0, z: 420, r: 100, lift: 220, top: 800 }, { x: 420, z: 0, r: 90, lift: -130 }] },
  views: { up: [[420, 440, 700], [0, 480, 420]], down: [[700, 460, 340], [420, 380, 0]] },
};

/** mist: a stack of islands at every height. For tuning the fade into nothing. */
export const mist = {
  id: "mist",
  name: "Mist test",
  spawn: { island: "i0", x: 0, z: 0 },
  islands: [190, 240, 300, 380, 480, 600].map((top, i) => ({ id: `i${i}`, x: i * 300, z: 0, top, radius: 90, roughness: 0.2 })),
  ships: [{ id: "s", island: "i0", x: 20, z: 20 }],
  views: { side: [[750, 400, 1050], [750, 240, 0]], low: [[750, 150, 700], [750, 200, 0]] },
};

/** gallery: every prop in the table on one island, in rows. For checking models and colliders. */
const names = Object.keys(PROPS);
const COLS = 7, GAP = 62;
export const gallery = {
  id: "gallery",
  name: "Prop gallery",
  spawn: { island: "a", x: 0, z: 300 },
  islands: [{ id: "a", x: 0, z: 0, top: 300, radius: 540, roughness: 0, swell: 0, grass: 0 }],
  ships: [{ id: "s", island: "a", x: 120, z: 300 }],
  props: names.filter((m) => m !== "palace_great_hall").map((model, i) => ({
    island: "a", model, x: (i % COLS - (COLS - 1) / 2) * GAP, z: Math.floor(i / COLS) * GAP - 180,
  })),
  views: { top: [[0, 820, 460], [0, 300, 40]] },
};
