// Camera rigs: third person on foot, chase in the air, no cuts between them.
import { describe, test, expect } from "bun:test";
import { createGame } from "../src/game/game.js";
import { createCameraRig } from "../src/game/cameraRig.js";
import { LEVELS } from "../src/levels/index.js";
import { groundAt } from "../src/game/world.js";
import { CAMERA } from "../src/game/config.js";

const frames = (g, rig, n, input = {}) => { for (let i = 0; i < n; i++) { g.advance(1 / 60, { ...input, camYaw: rig.yaw }); rig.update(1 / 60); } };

describe("camera", () => {
  test("on foot the camera sits behind and above, at about the set distance", () => {
    const g = createGame(LEVELS.flat), rig = createCameraRig(g); frames(g, rig, 60);
    const p = g.state.player, d = Math.hypot(rig.pos[0] - p.x, rig.pos[1] - p.y, rig.pos[2] - p.z);
    expect(d).toBeGreaterThan(CAMERA.walk.distance * 0.8); expect(d).toBeLessThan(CAMERA.walk.distance * 1.3);
    expect(rig.pos[1]).toBeGreaterThan(p.y);
  });
  test("w moves away from the camera", () => {
    const g = createGame(LEVELS.flat), rig = createCameraRig(g); frames(g, rig, 30);
    const p = g.state.player, before = Math.hypot(rig.pos[0] - p.x, rig.pos[2] - p.z), x = p.x, z = p.z;
    frames(g, rig, 30, { w: true });
    const moved = [p.x - x, p.z - z], look = [rig.target[0] - rig.pos[0], rig.target[2] - rig.pos[2]];
    expect(moved[0] * look[0] + moved[1] * look[1]).toBeGreaterThan(0);
    expect(before).toBeGreaterThan(0);
  });
  test("mouse look turns the camera, running swings it back, the ground never gets in the way", () => {
    const g = createGame(LEVELS.flat), rig = createCameraRig(g), y0 = rig.yaw;
    rig.look(200, 0); expect(rig.yaw).toBeLessThan(y0);
    rig.look(0, -5000);   // look from as low as it goes
    frames(g, rig, 60);
    expect(rig.pos[1]).toBeGreaterThan(groundAt(g.world, rig.pos[0], rig.pos[2]) ?? -1e9);
  });
  test("a wall between the camera and the character pulls the camera in", () => {
    const g = createGame(LEVELS.flat), rig = createCameraRig(g), hut = g.world.colliders.find((c) => c.model === "home1");
    g.state.player.x = (hut.x0 + hut.x1) / 2; g.state.player.z = hut.z1 + 6;
    rig.yaw = 0; rig.pitch = 0.05; rig.focus = [g.state.player.x, g.state.player.y + 9, g.state.player.z];
    frames(g, rig, 60);
    expect(rig.pos[2]).toBeGreaterThan(hut.z1 - 1);
  });
  test("boarding switches to the chase camera without a jump", () => {
    const g = createGame(LEVELS.flat), rig = createCameraRig(g), s = g.state.ships[0];
    g.state.player.x = s.x - 8; g.state.player.z = s.z; frames(g, rig, 30);
    g.step({ e: true });
    let prev = rig.pos.slice(), worst = 0;
    for (let i = 0; i < 120; i++) { frames(g, rig, 1); worst = Math.max(worst, Math.hypot(rig.pos[0] - prev[0], rig.pos[1] - prev[1], rig.pos[2] - prev[2])); prev = rig.pos.slice(); }
    expect(rig.mode).toBe("fly");
    expect(worst).toBeLessThan(6);   // units per frame: fast, but a move rather than a cut
  });
  test("the chase camera stays behind the ship at full speed", () => {
    const g = createGame(LEVELS.hop), rig = createCameraRig(g), s = g.state.ships[0];
    g.state.player.x = s.x + 8; g.state.player.z = s.z; g.step({ e: true }); frames(g, rig, 60);
    frames(g, rig, 120, { w: true, space: true });
    const hx = Math.sin(s.yaw), hz = Math.cos(s.yaw), back = (s.x - rig.pos[0]) * hx + (s.z - rig.pos[2]) * hz;
    expect(back).toBeGreaterThan(40);
    expect(rig.pos[1]).toBeGreaterThan(s.y);
    expect(rig.fov).toBeGreaterThan(CAMERA.fly.fov);
  });
  test("mouse look in the air recentres on its own", () => {
    const g = createGame(LEVELS.flat), rig = createCameraRig(g), s = g.state.ships[0];
    g.state.player.x = s.x - 8; g.state.player.z = s.z; g.step({ e: true }); frames(g, rig, 60);
    rig.look(300, 0); expect(Math.abs(rig.lookYaw)).toBeGreaterThan(0.5);
    frames(g, rig, 240);
    expect(Math.abs(rig.lookYaw)).toBeLessThan(0.1);
  });
});
