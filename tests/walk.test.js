// Character controller: runs where you point it, stops at walls and at the edge of the world.
import { describe, test, expect } from "bun:test";
import { createGame } from "../src/game/game.js";
import { LEVELS } from "../src/levels/index.js";
import { islandAt } from "../src/game/world.js";
import { WALK } from "../src/game/config.js";

const flat = () => createGame(LEVELS.flat);

describe("walking", () => {
  test("w runs along the camera direction at running speed", () => {
    const g = flat(), z0 = g.state.player.z;
    g.advance(1, { w: true, camYaw: 0 });
    expect(g.state.player.z - z0).toBeGreaterThan(WALK.speed * 0.8);
    expect(Math.abs(g.state.player.x)).toBeLessThan(0.1);
    expect(g.state.player.speed).toBeCloseTo(WALK.speed, 0);
  });
  test("movement is relative to the camera", () => {
    const g = flat();
    g.advance(0.5, { w: true, camYaw: Math.PI / 2 });     // camera looks along +x
    expect(g.state.player.x).toBeGreaterThan(5);
    const h = flat();
    h.advance(0.5, { d: true, camYaw: Math.PI });         // camera looks along -z, so right is +x
    expect(h.state.player.x).toBeGreaterThan(5);
  });
  test("shift sprints, and stopping is quick", () => {
    const g = flat();
    g.advance(1, { w: true, shift: true, camYaw: 0 });
    expect(g.state.player.speed).toBeCloseTo(WALK.sprint, 0);
    g.advance(0.3, { camYaw: 0 });
    expect(g.state.player.speed).toBeLessThan(0.1);
  });
  test("the character turns to face the way it runs", () => {
    const g = flat();
    g.advance(1, { d: true, camYaw: Math.PI });
    expect(Math.sin(g.state.player.yaw)).toBeCloseTo(1, 1);
  });
  test("jumping goes up and comes back down", () => {
    const g = flat(), y0 = g.state.player.y;
    g.step({ space: true });
    g.advance(0.2, { space: true });
    expect(g.state.player.y).toBeGreaterThan(y0 + 4);
    expect(g.state.player.grounded).toBe(false);
    g.advance(1.5, {});
    expect(g.state.player.y).toBeCloseTo(y0, 3);
    expect(g.state.player.grounded).toBe(true);
  });
  test("you cannot run off the edge of the island", () => {
    const g = flat();
    for (const camYaw of [0, 1.3, 2.9, 4.4]) {
      g.advance(12, { w: true, shift: true, camYaw });
      expect(islandAt(g.world, g.state.player.x, g.state.player.z)?.id).toBe("a");
    }
  });
  test("buildings stop you, and you slide along them", () => {
    const g = flat(), hut = g.world.colliders.find((c) => c.model === "home1");
    g.state.player.x = (hut.x0 + hut.x1) / 2 + 3; g.state.player.z = hut.z1 + 10;
    g.advance(3, { w: true, camYaw: Math.PI });           // run straight at the front wall
    expect(g.state.player.z).toBeGreaterThanOrEqual(hut.z1 + WALK.radius - 0.01);
    const x = g.state.player.x;
    g.advance(0.4, { w: true, camYaw: Math.PI - 0.5 });     // run at it diagonally
    expect(Math.abs(g.state.player.x - x)).toBeGreaterThan(5);
    expect(g.state.player.z).toBeGreaterThanOrEqual(hut.z1 + WALK.radius - 0.01);
  });
  test("the simulation is deterministic", () => {
    const run = () => { const g = createGame(LEVELS.main); g.advance(3, { w: true, camYaw: 1 }); g.advance(2, { d: true, camYaw: 1 }); return JSON.stringify(g.state); };
    expect(run()).toBe(run());
  });
});
