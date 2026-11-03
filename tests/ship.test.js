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
  test("top speed is 80% of what it was, and takes a moment to reach", () => {
    expect(SHIP.maxSpeed).toBe(272);
    const g = aboard(), s = g.riding(); g.advance(0.5, { space: true });
    g.advance(0.5, { w: true, space: true }); expect(Math.hypot(s.vx, s.vz)).toBeLessThan(SHIP.maxSpeed * 0.65);
    g.advance(1.3, { w: true, space: true }); expect(Math.hypot(s.vx, s.vz)).toBeGreaterThan(SHIP.maxSpeed * 0.95);
  });
  test("heavy but manageable: a full-speed 180 takes about 3 seconds, and she slides on the way round", () => {
    const g = aboard(), s = g.riding(); g.advance(0.5, { space: true }); g.advance(2, { w: true, space: true });
    const y0 = s.yaw; let t = 0, maxSlip = 0;
    while (Math.abs(s.yaw - y0) < Math.PI && t < 6) {
      g.advance(0.05, { w: true, a: true, space: true }); t += 0.05;
      const sp = Math.hypot(s.vx, s.vz), along = (s.vx * Math.sin(s.yaw) + s.vz * Math.cos(s.yaw)) / sp;
      maxSlip = Math.max(maxSlip, Math.acos(Math.min(1, along)));
    }
    expect(t).toBeGreaterThan(2.4); expect(t).toBeLessThan(3.8);
    expect(maxSlip).toBeGreaterThan(0.15);      // the nose leads the direction of travel: that's the skill
    g.advance(1.6, { w: true, space: true });
    expect((s.vx * Math.sin(s.yaw) + s.vz * Math.cos(s.yaw)) / Math.hypot(s.vx, s.vz)).toBeGreaterThan(0.95);   // and it still sorts itself out
    expect(Math.hypot(s.vx, s.vz)).toBeGreaterThan(SHIP.maxSpeed * 0.85);
  });
  test("slowing down lets you turn tighter", () => {
    const radiusAt = (speedUp) => {
      const g = aboard(), s = g.riding(); g.advance(0.5, { space: true }); g.advance(speedUp, { w: true, space: true });
      const y0 = s.yaw; let t = 0; while (Math.abs(s.yaw - y0) < 1.5 && t < 6) { g.advance(0.05, { a: true, space: true }); t += 0.05; }
      return t;
    };
    expect(radiusAt(0.1)).toBeLessThan(radiusAt(2));
  });
  test("she doesn't start or stop turning at once", () => {
    const g = aboard(), s = g.riding(); g.advance(1, { space: true });
    g.advance(0.1, { a: true, space: true }); expect(s.yawRate).toBeLessThan(SHIP.turnRate * 0.5);
    g.advance(1.5, { a: true, space: true }); const r = s.yawRate; expect(r).toBeGreaterThan(SHIP.turnRate * 0.8);
    g.advance(0.1, { space: true }); expect(s.yawRate).toBeGreaterThan(r * 0.5);
  });
  test("brakes still work", () => {
    const g = aboard(); g.advance(0.5, { space: true }); g.advance(2, { w: true, space: true });
    g.advance(0.8, { s: true });
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
    expect(s.y).toBeGreaterThan(y0 + 40);
    const y1 = s.y; g.advance(0.5, { shift: true }); g.advance(0.3, {});
    expect(s.y).toBeLessThan(y1);
  });
  test("level flight wanders a little but stays about level", () => {
    const g = aboard(), s = g.riding(); g.advance(2, { space: true }); g.advance(1.5, {});
    const y = s.y; let spread = 0;
    for (let i = 0; i < 20; i++) { g.advance(0.5, {}); spread = Math.max(spread, Math.abs(s.y - y)); }
    expect(spread).toBeGreaterThan(0.2); expect(spread).toBeLessThan(25);
  });
});

describe("rickety", () => {
  test("the hull swings out in a turn and takes a while to settle", () => {
    const g = aboard(), s = g.riding(); g.advance(1.5, { space: true }); g.advance(1.5, { w: true });
    let max = 0; for (let i = 0; i < 30; i++) { g.advance(0.05, { w: true, a: true }); max = Math.max(max, Math.abs(s.swingRoll)); }
    expect(max).toBeGreaterThan(0.08);
    expect(s.swingRoll).toBeLessThan(0);        // turning left, the hull swings to the right
    g.advance(1, { w: true }); let crossings = 0, prev = s.swingRoll;
    for (let i = 0; i < 60; i++) { g.advance(0.05, { w: true }); if (Math.sign(s.swingRoll) !== Math.sign(prev)) crossings++; prev = s.swingRoll; }
    expect(crossings).toBeGreaterThan(0);       // it rocks back through the middle, not just returns
  });
  test("opening the throttle throws the hull back", () => {
    const g = aboard(), s = g.riding(); g.advance(1.5, { space: true });
    g.advance(0.25, { w: true }); expect(s.swingPitch).toBeLessThan(-0.02);
  });
  test("wind carries you off a straight line, a bit", () => {
    const g = aboard(), s = g.riding(); g.advance(2, { space: true }); g.advance(8, {});
    const x = s.x, z = s.z; g.advance(4, {}); const moved = Math.hypot(s.x - x, s.z - z);
    expect(moved).toBeGreaterThan(1); expect(moved).toBeLessThan(120);
  });
  test("close to the ground the air is calm: landing is as easy as it was", () => {
    const low = aboard(), a = low.riding(); low.advance(0.3, { space: true }); low.advance(0.7, {});
    const x = a.x, z = a.z; low.advance(2, {}); const lowMove = Math.hypot(a.x - x, a.z - z);
    const high = aboard(), b = high.riding(); high.advance(3, { space: true }); high.advance(0.7, {});
    const u = b.x, v = b.z; high.advance(2, {}); expect(lowMove).toBeLessThan(Math.hypot(b.x - u, b.z - v));
  });
  test("a deterministic ride: same keys, same flight", () => {
    const run = () => { const g = aboard(); g.advance(3, { w: true, space: true }); g.advance(2, { a: true, w: true }); const s = g.riding(); return [s.x, s.y, s.z, s.swingRoll]; };
    expect(run()).toEqual(run());
  });
});

describe("drafts", () => {
  const inAir = () => { const g = aboard("flight"), s = g.riding(); g.advance(2, { space: true }); return { g, s }; };
  const at = (s, x, z, y = 420) => { s.x = x; s.z = z; s.y = y; s.vx = s.vy = s.vz = 0; };
  test("an updraft lifts you faster than the engine can climb", () => {
    const { g, s } = inAir(); at(s, 0, 420); g.advance(1.5, {}); const y = s.y; g.advance(1, {});
    expect(s.y - y).toBeGreaterThan(SHIP.climbSpeed * 1.2);
    expect(g.events.some((e) => e.type === "entered_draft" && e.kind === "up")).toBe(true);
  });
  test("a downdraft pulls you down, even climbing against it you lose out", () => {
    const { g, s } = inAir(); at(s, 420, 0, 600); g.advance(1.5, {}); const y = s.y; g.advance(1, {});
    expect(s.y).toBeLessThan(y - 50);
    at(s, 420, 0, 600); g.advance(1.5, { space: true }); const y2 = s.y; g.advance(1, { space: true });
    expect(s.y).toBeLessThan(y2);
    expect(g.events.some((e) => e.type === "entered_draft" && e.kind === "down")).toBe(true);
  });
  test("outside the column the air is still", () => {
    const { g, s } = inAir(); at(s, -400, -400); g.advance(1.5, {}); const y = s.y; g.advance(1, {});
    expect(Math.abs(s.y - y)).toBeLessThan(12);
  });
  test("an updraft runs out: it can't throw you through the ceiling", () => {
    const { g, s } = inAir(); at(s, 0, 420); g.advance(12, {});
    expect(s.y).toBeLessThan(860);        // momentum carries her a little past the top
  });
  test("a downdraft can't push you into the mist floor", () => {
    const { g, s } = inAir(); at(s, 420, 0, 300); g.advance(10, { shift: true });
    expect(s.y).toBeGreaterThan(SHIP.floor - 20);
  });
  test("drafts stay out of the way of landing: auto-land ignores them", () => {
    const g = aboard("flight"), s = g.riding(); g.advance(1, { space: true }); g.step({ e: true }); g.advance(8, {});
    expect(s.landed).toBe(true); expect(g.state.mode).toBe("walk");
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
