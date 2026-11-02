// Airship: board it, fly it, land it, jump out. Fast, nimble, forgiving.
import { describe, test, expect } from "bun:test";
import { createGame } from "../src/game/game.js";
import { LEVELS } from "../src/levels/index.js";
import { groundAt, islandAt, cliffRadius } from "../src/game/world.js";
import { SHIP } from "../src/game/config.js";

/** A game with the character already at the wheel. */
function aboard(level = "hop") {
  const g = createGame(LEVELS[level]), s = g.state.ships[0];
  g.state.player.x = s.x + 6; g.state.player.z = s.z;
  g.step({ e: true }); g.advance(1, {});
  expect(g.state.mode).toBe("fly");
  return g;
}

describe("boarding", () => {
  test("E near a ship boards it, E far from it does nothing", () => {
    const g = createGame(LEVELS.flat);
    expect(g.state.prompt).toBeNull();
    g.step({ e: true }); g.advance(0.1, {});
    expect(g.state.mode).toBe("walk");
    g.state.player.x = g.state.ships[0].x - 10; g.state.player.z = g.state.ships[0].z;
    g.step({});
    expect(g.state.prompt?.action).toBe("board");
    g.step({ e: true }); expect(g.state.mode).toBe("boarding");
    g.advance(1, {});
    expect(g.state.mode).toBe("fly");
    expect(g.events.map((e) => e.type)).toContain("boarded");
  });
  test("holding E does not board and immediately jump out", () => {
    const g = createGame(LEVELS.flat);
    g.state.player.x = g.state.ships[0].x - 10; g.state.player.z = g.state.ships[0].z;
    g.advance(2, { e: true });
    expect(g.state.mode).toBe("fly");
  });
  test("the rider stays on the deck", () => {
    const g = aboard(); g.advance(1, { w: true, space: true });
    const s = g.riding(), p = g.state.player;
    expect([p.x, p.z]).toEqual([s.x, s.z]);
    expect(p.y).toBeCloseTo(s.y + SHIP.deckY, 5);
  });
});

describe("flight feel", () => {
  test("fast: top speed inside a second or so", () => {
    const g = aboard(); g.advance(0.5, { space: true }); g.advance(1.2, { w: true, space: true });
    expect(Math.hypot(g.riding().vx, g.riding().vz)).toBeGreaterThan(SHIP.maxSpeed * 0.95);
  });
  test("nimble: a full-speed 180 takes under 2.5 seconds and goes where it points", () => {
    const g = aboard(); g.advance(0.5, { space: true }); g.advance(1.5, { w: true, space: true });
    const s = g.riding(), y0 = s.yaw;
    let t = 0; while (Math.abs(s.yaw - y0) < Math.PI && t < 5) { g.advance(0.05, { w: true, a: true, space: true }); t += 0.05; }
    expect(t).toBeLessThan(2.5);
    g.advance(0.5, { w: true, space: true });
    const [hx, hz] = [Math.sin(s.yaw), Math.cos(s.yaw)], speed = Math.hypot(s.vx, s.vz);
    expect((s.vx * hx + s.vz * hz) / speed).toBeGreaterThan(0.95);
    expect(speed).toBeGreaterThan(SHIP.maxSpeed * 0.9);
  });
  test("stops quickly when you let go and brake", () => {
    const g = aboard(); g.advance(0.5, { space: true }); g.advance(1.5, { w: true, space: true });
    g.advance(0.7, { s: true });
    expect(Math.hypot(g.riding().vx, g.riding().vz)).toBeLessThan(40);
  });
  test("a turns left, d turns right (seen from behind the ship)", () => {
    const g = aboard(), s = g.riding(), y0 = s.yaw;
    g.advance(0.5, { space: true, a: true });
    expect(s.yaw).toBeGreaterThan(y0);
    const h = aboard(), t = h.riding(), y1 = t.yaw;
    h.advance(0.5, { space: true, d: true });
    expect(t.yaw).toBeLessThan(y1);
  });
  test("space climbs and shift descends", () => {
    const g = aboard(), s = g.riding(), y0 = s.y;
    g.advance(1, { space: true });
    expect(s.y).toBeGreaterThan(y0 + 60);
    const y1 = s.y; g.advance(0.5, { shift: true }); g.advance(0.3, {});
    expect(s.y).toBeLessThan(y1);
  });
  test("altitude holds with no input", () => {
    const g = aboard(), s = g.riding(); g.advance(1, { space: true }); g.advance(1, {});
    const y = s.y; g.advance(2, {});
    expect(Math.abs(s.y - y)).toBeLessThan(0.5);
  });
});

describe("the ship can't get into trouble", () => {
  test("flying into a cliff slides off, never inside", () => {
    const g = aboard(), s = g.riding(), b = g.world.byId.b;
    g.advance(0.2, { space: true }); g.advance(0.5, {});
    for (let i = 0; i < 700; i++) {
      g.step({ w: true });
      if (s.y < b.top) expect(Math.hypot(s.x - b.x, s.z - b.z)).toBeGreaterThanOrEqual(cliffRadius(b, Math.atan2(s.z - b.z, s.x - b.x), s.y) + SHIP.radius - 0.01);
    }
  });
  test("diving at the ground stops above it", () => {
    const g = aboard(), s = g.riding();
    g.advance(1, { space: true, w: true }); g.advance(4, { shift: true, a: true });
    const ground = groundAt(g.world, s.x, s.z);
    if (ground !== null) expect(s.y).toBeGreaterThanOrEqual(ground);
  });
  test("the mist pushes you back up, the sky pushes you back down", () => {
    const g = aboard(), s = g.riding();
    g.advance(0.5, { space: true, w: true }); g.advance(1.2, { w: true });
    g.advance(20, { shift: true, a: true });
    expect(s.y).toBeGreaterThan(SHIP.floor - 20);
    g.advance(30, { space: true, a: true });
    expect(s.y).toBeLessThan(SHIP.ceiling + 20);
  });
  test("flying far out turns you back", () => {
    const g = aboard(), s = g.riding();
    g.advance(1, { space: true }); s.yaw = 2.2;
    g.advance(40, { w: true });
    expect(Math.hypot(s.x, s.z)).toBeLessThan(SHIP.worldRadius + 700);
  });
});

describe("landing", () => {
  test("holding shift over an island lands; you can then jump out onto solid ground", () => {
    const g = aboard(), s = g.riding();
    g.advance(1, { space: true }); g.advance(4, { shift: true });
    expect(s.landed).toBe(true);
    g.step({ e: true }); g.advance(1, {});
    expect(g.state.mode).toBe("walk");
    const p = g.state.player, ground = groundAt(g.world, p.x, p.z);
    expect(ground).not.toBeNull(); expect(p.y).toBeCloseTo(ground, 3);
    expect(g.state.shipId).toBeNull();
  });
  test("E from the air lands by itself and jumps out", () => {
    const g = aboard(), s = g.riding();
    g.advance(0.8, { space: true }); g.advance(0.15, { space: true, w: true });
    expect(g.state.island).toBe("a");
    expect(g.state.prompt?.action).toBe("land");
    g.step({ e: true }); g.advance(8, {});
    expect(s.landed).toBe(true); expect(g.state.mode).toBe("walk");
    expect(islandAt(g.world, g.state.player.x, g.state.player.z)?.id).toBe("a");
  });
  test("E over the void says no and keeps flying", () => {
    const g = aboard(), s = g.riding();
    g.advance(1, { space: true }); g.advance(1, { w: true });
    expect(g.state.island).toBeNull();
    g.step({ e: true }); g.advance(0.5, {});
    expect(g.state.mode).toBe("fly"); expect(s.landed).toBe(false);
    expect(g.events.map((e) => e.type)).toContain("cant_land");
  });
  test("steering cancels an auto-landing", () => {
    const g = aboard(), s = g.riding();
    g.advance(1.5, { space: true });
    g.step({ e: true }); g.advance(0.2, {});
    expect(s.autoLand).not.toBeNull();
    g.advance(0.2, { w: true });
    expect(s.autoLand).toBeNull();
  });
  test("auto-landing above a building picks a clear spot next to it", () => {
    const g = createGame(LEVELS.hop), s = g.state.ships[0];
    g.state.player.x = s.x; g.state.player.z = s.z + 10; g.step({ e: true }); g.advance(1, {});
    const hut = g.world.colliders[0];
    s.x = (hut.x0 + hut.x1) / 2; s.z = (hut.z0 + hut.z1) / 2; s.y = hut.h + 40; s.landed = false;
    g.step({ e: true }); g.advance(10, {});
    expect(g.state.mode).toBe("walk"); expect(g.state.island).toBe("b");
    expect(s.y).toBeLessThan(hut.h - 5);
  });
  test("ships you left behind stay put, and you can take them again", () => {
    const g = aboard(), s = g.riding();
    g.advance(1, { space: true }); g.step({ e: true }); g.advance(8, {});
    const x = s.x; g.advance(3, { w: true, camYaw: 0 });
    expect(s.x).toBe(x);
    g.state.player.x = s.x + 6; g.state.player.z = s.z; g.step({}); g.step({ e: true }); g.advance(1, {});
    expect(g.state.mode).toBe("fly");
  });
});
