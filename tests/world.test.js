// The level data and world queries: is every level valid, and do islands behave like islands?
import { describe, test, expect } from "bun:test";
import { LEVELS } from "../src/levels/index.js";
import { compileLevel, islandAt, groundAt, surfaceHeight, rimRadius, cliffRadius, isClear, findLandingSpot } from "../src/game/world.js";
import { PROPS } from "../src/game/props.js";
import { SCENARIOS } from "../src/game/scenarios.js";
import { MIST, SHIP } from "../src/game/config.js";

describe("level data", () => {
  for (const [id, def] of Object.entries(LEVELS)) {
    const world = compileLevel(def);
    test(`${id}: spawn and ships are on islands, on clear ground`, () => {
      expect(islandAt(world, world.spawn.x, world.spawn.z)).not.toBeNull();
      expect(isClear(world, world.spawn.x, world.spawn.z, 2.4)).toBe(true);
      for (const s of world.ships) { expect(islandAt(world, s.x, s.z)).not.toBeNull(); expect(isClear(world, s.x, s.z, 8)).toBe(true); }
    });
    test(`${id}: every prop stands on its own island`, () => {
      const off = world.props.filter((p) => islandAt(world, p.x, p.z)?.id !== p.island).map((p) => {
        const i = world.byId[p.island], lx = p.x - i.x, lz = p.z - i.z;
        return `${p.island}: ${p.model} at local ${lx.toFixed(0)},${lz.toFixed(0)} (rim there ${rimRadius(i, Math.atan2(lz, lx)).toFixed(0)}, prop at ${Math.hypot(lx, lz).toFixed(0)})`;
      });
      if (off.length) throw new Error("props off their island:\n" + off.join("\n"));
    });
    test(`${id}: every critter starts on its island`, () => {
      for (const c of world.critters) { if (islandAt(world, c.homeX, c.homeZ)?.id !== c.island) throw new Error(`critter ${c.person ?? c.animal} at ${c.x},${c.z} is off ${c.island}`); }
    });
    test(`${id}: island tops stay clear of the mist and do not overlap`, () => {
      for (const a of world.islands) {
        expect(a.top).toBeGreaterThan(MIST.top);
        for (const b of world.islands) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(a.outerRadius + b.outerRadius);
      }
    });
    test(`${id}: every prop model is known`, () => { for (const p of def.props ?? []) expect(PROPS[p.model]).toBeDefined(); });
  }
  test("the main level has thirty islands of varied sizes", () => {
    const r = LEVELS.main.islands.map((i) => i.radius);
    expect(r.length).toBe(30);
    expect(Math.max(...r) / Math.min(...r)).toBeGreaterThan(3);
  });
  test("islands are close together, with room to fly between them", () => {
    const w = compileLevel(LEVELS.main);
    for (const a of w.islands) {
      let nearest = Infinity;
      for (const b of w.islands) {
        if (a === b) continue;
        const gap = Math.hypot(a.x - b.x, a.z - b.z) - a.outerRadius - b.outerRadius;
        nearest = Math.min(nearest, gap);
        if (gap < 200) throw new Error(`${a.id} and ${b.id} are only ${gap.toFixed(0)} apart: the ship needs a way between them`);
      }
      if (nearest > 500) throw new Error(`${a.id} is ${nearest.toFixed(0)} from its nearest neighbour: too far`);
    }
  });
  test("about a third of the islands are big towns, with several buildings each", () => {
    const w = compileLevel(LEVELS.main), BUILDINGS = new Set(["home1", "home2", "shop", "inn", "manor", "hall_house", "compound", "teahouse", "pagoda", "stall", "tower", "city_gate", "palace_great_hall", "statue"]);
    const big = w.islands.filter((i) => i.radius >= 340);
    expect(big.length).toBe(10);
    for (const i of big) { const n = w.props.filter((p) => p.island === i.id && BUILDINGS.has(p.model)).length; if (n < 6) throw new Error(`${i.id} only has ${n} buildings`); }
    const old = [60, 240], smallest = Math.min(...big.map((i) => i.radius));
    expect(smallest).toBeGreaterThan(old[1]);
  });
  test("no two buildings stand in each other", () => {
    const boxes = compileLevel(LEVELS.main).colliders.filter((c) => c.kind === "box"), bad = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1) bad.push(`${a.model} at ${a.x0.toFixed(0)},${a.z0.toFixed(0)} and ${b.model} at ${b.x0.toFixed(0)},${b.z0.toFixed(0)}`);
    }
    if (bad.length) throw new Error("overlapping:\n" + bad.join("\n"));
  });
  test("the grand tour visits every island", () => {
    const steps = SCENARIOS.grand_tour.steps.filter((s) => s.flyTo).map((s) => s.flyTo.slice("island:".length));
    for (const i of LEVELS.main.islands) expect(steps).toContain(i.id);
  });
  test("every island is inside the flyable world", () => {
    const w = compileLevel(LEVELS.main);
    for (const i of w.islands) expect(Math.hypot(i.x, i.z) + i.outerRadius).toBeLessThan(SHIP.worldRadius);
  });
  test("gondolas: each line joins two nearby islands, with a clear span between them", () => {
    const w = compileLevel(LEVELS.main);
    expect(w.gondolas.length).toBeGreaterThanOrEqual(2);
    for (const g of w.gondolas) {
      const span = Math.hypot(g.from[0] - g.to[0], g.from[2] - g.to[2]);
      expect(g.from[0]).toBeCloseTo(g.to[0], 5);          // the station models only line up along z
      expect(span).toBeGreaterThan(200); expect(span).toBeLessThan(700);
      expect(g.to[2]).toBeLessThan(g.from[2]);            // the upper station is north (-z) of the lower one
      expect(g.to[1]).toBeGreaterThan(g.from[1] - 40);
    }
  });
});

describe("world queries", () => {
  const world = compileLevel(LEVELS.hop), a = world.byId.a;
  test("groundAt is null over the void and island height on the island", () => {
    expect(groundAt(world, 0, 250)).toBeNull();
    expect(Math.abs(groundAt(world, 0, 0) - a.top)).toBeLessThan(10);
  });
  test("rim and cliff radii", () => {
    const th = 1.2, rim = rimRadius(a, th);
    expect(islandAt(world, a.x + Math.cos(th) * (rim - 1), a.z + Math.sin(th) * (rim - 1))).toBe(a);
    expect(islandAt(world, a.x + Math.cos(th) * (rim + 1), a.z + Math.sin(th) * (rim + 1))).toBeNull();
    expect(cliffRadius(a, th, a.top - 100)).toBeGreaterThan(rim);
  });
  test("flats level the ground under big props", () => {
    const w = compileLevel(LEVELS.main), hut = w.byId.home.flats[0];
    const h0 = surfaceHeight(w.byId.home, hut.x, hut.z), h1 = surfaceHeight(w.byId.home, hut.x + 10, hut.z + 10);
    expect(Math.abs(h0 - h1)).toBeLessThan(0.01);
  });
  test("findLandingSpot steers clear of buildings", () => {
    const w = compileLevel(LEVELS.main), hut = w.props.find((p) => p.model === "home1");
    const s = findLandingSpot(w, hut.x, hut.z);
    expect(s).not.toBeNull(); expect(isClear(w, s.x, s.z, 10)).toBe(true);
  });
});

describe("collider grid", () => {
  const world = compileLevel(LEVELS.main);
  test("agrees with checking every collider", () => {
    const brute = (x, z, r) => { for (const c of world.colliders) { const hit = c.kind === "circle" ? Math.hypot(x - c.x, z - c.z) < c.r + r : Math.hypot(x - Math.max(c.x0, Math.min(c.x1, x)), z - Math.max(c.z0, Math.min(c.z1, z))) < r; if (hit) return true; } return false; };
    let s = 1; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 4000; i++) {
      const isl = world.islands[Math.floor(R() * world.islands.length)], x = isl.x + (R() - 0.5) * isl.radius * 2, z = isl.z + (R() - 0.5) * isl.radius * 2, r = R() * 12;
      expect(isClear(world, x, z, r)).toBe(!brute(x, z, r));
    }
  });
});
