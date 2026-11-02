// Life in the sky: lots of it, every kind, and nothing flying through anything.
import { describe, test, expect } from "bun:test";
import { compileLevel, cliffRadius, rimRadius } from "../src/game/world.js";
import { createSkyTraffic, shipPose, birdPose, SHIP_TYPES, BIRD_TYPES } from "../src/game/skyTraffic.js";
import { PROPS } from "../src/game/props.js";
import { SHIP } from "../src/game/config.js";
import { LEVELS } from "../src/levels/index.js";
import { MODELS } from "../src/engine/models.js";
import "../src/render/customModels.js";

const world = compileLevel(LEVELS.main), sky = createSkyTraffic(world, LEVELS.main.sky);
const tallest = new Map(); for (const p of world.props) tallest.set(p.island, Math.max(tallest.get(p.island) ?? 0, PROPS[p.model]?.h ?? 0));

/** Is this point inside a cliff or among an island's buildings? */
function inSolid(x, y, z) {
  for (const i of world.islands) {
    const d = Math.hypot(x - i.x, z - i.z), th = Math.atan2(z - i.z, x - i.x);
    if (y < i.top ? d < cliffRadius(i, th, y) : (y < i.top + (tallest.get(i.id) ?? 0) && d < rimRadius(i, th))) return i.id;
  }
  return null;
}

describe("what's up there", () => {
  test("every kind of airship and every species asked for is flying, in the numbers asked for", () => {
    for (const [model, n] of Object.entries(LEVELS.main.sky.ships)) expect(sky.ships.filter((s) => s.model === model).length).toBe(n);
    for (const f of LEVELS.main.sky.flocks) expect(sky.flocks.filter((g) => g.species === f.type).length).toBe(f.flocks);
  });
  test("all known types are used, and all have a model", () => {
    for (const m of Object.keys(SHIP_TYPES)) { expect(LEVELS.main.sky.ships[m]).toBeGreaterThan(0); expect(MODELS[m]).toBeDefined(); }
    for (const [name, t] of Object.entries(BIRD_TYPES)) { expect(LEVELS.main.sky.flocks.some((f) => f.type === name)).toBe(true); expect(MODELS[t.model]).toBeDefined(); }
  });
  test("big and small birds: a wide range of sizes", async () => {
    const { modelGeometry } = await import("../src/engine/models.js"), span = (m) => { const b = modelGeometry(m).boundingBox; return b.max.x - b.min.x; };
    expect(span("bird_roc") / span("bird_finch")).toBeGreaterThan(15);
  });
  test("it is deterministic", () => {
    const again = createSkyTraffic(world, LEVELS.main.sky);
    expect(again.ships.map((s) => s.route)).toEqual(sky.ships.map((s) => s.route));
  });
  test("levels without a sky have an empty one", () => { const t = createSkyTraffic(world, null); expect(t.ships.length + t.flocks.length).toBe(0); });
});

describe("nothing flies through anything", () => {
  test("airships miss every cliff and building, all the way round", () => {
    for (const s of sky.ships) for (let k = 0; k < 90; k++) {
      const t = (k / 90) * ((Math.PI * 2 * (s.route.rx + s.route.rz)) / 2 / s.route.speed), p = shipPose(s, t), hit = inSolid(p.x, p.y, p.z);
      if (hit) throw new Error(`${s.model} flies through ${hit}`);
    }
  });
  test("two airships at the same height never share the same patch of sky", () => {
    const pts = (s) => Array.from({ length: 120 }, (_, k) => { const a = (k / 120) * Math.PI * 2, c = Math.cos(s.route.tilt), n = Math.sin(s.route.tilt), px = Math.cos(a) * s.route.rx, pz = Math.sin(a) * s.route.rz; return [s.route.cx + px * c - pz * n, s.route.cz + px * n + pz * c]; });
    for (let i = 0; i < sky.ships.length; i++) for (let j = i + 1; j < sky.ships.length; j++) {
      const a = sky.ships[i], b = sky.ships[j];
      if (a.route.y > b.route.y + b.type.height + 8 || b.route.y > a.route.y + a.type.height + 8) continue;
      for (const [x, z] of pts(a)) for (const [u, v] of pts(b)) if (Math.hypot(x - u, z - v) < a.type.radius + b.type.radius) throw new Error(`${a.model} and ${b.model} meet`);
    }
  });
  test("birds keep out of the rock", () => {
    for (const f of sky.flocks) for (let k = 0; k < 40; k++) {
      const p = birdPose(f, 0, k * 11);
      const hit = inSolid(p.x, p.y, p.z); if (hit) throw new Error(`${f.species} flies through ${hit}`);
    }
  });
  test("everything stays in the flyable sky, above the mist", () => {
    for (const s of sky.ships) { expect(s.route.y).toBeGreaterThan(SHIP.floor); expect(s.route.y).toBeLessThan(SHIP.ceiling + 60); }
  });
});

describe("how they move", () => {
  test("ships fly nose-first along their route", () => {
    const s = sky.ships[0], a = shipPose(s, 10), b = shipPose(s, 10.1), dx = b.x - a.x, dz = b.z - a.z;
    expect((dx * Math.sin(a.yaw) + dz * Math.cos(a.yaw)) / Math.hypot(dx, dz)).toBeGreaterThan(0.98);
    expect(Math.hypot(dx, dz) / 0.1).toBeGreaterThan(s.route.speed * 0.3);
  });
  test("a V keeps its shape: everyone behind the leader", () => {
    const f = sky.flocks.find((g) => g.species === "crane"), lead = birdPose(f, 0, 20), hx = Math.sin(lead.yaw), hz = Math.cos(lead.yaw);
    for (let i = 1; i < f.members.length; i++) { const p = birdPose(f, i, 20); expect((p.x - lead.x) * hx + (p.z - lead.z) * hz).toBeLessThan(0); }
  });
  test("big birds glide more than they flap; small birds never stop", () => {
    const eagle = sky.flocks.find((g) => g.species === "eagle"), finch = sky.flocks.find((g) => g.species === "finch");
    let gliding = 0; for (let t = 0; t < 400; t += 2) if (birdPose(eagle, 0, t).amp < 0.1) gliding++;
    expect(gliding).toBeGreaterThan(80);
    for (let t = 0; t < 40; t += 2) expect(birdPose(finch, 0, t).amp).toBeGreaterThan(0.5);
  });
});
