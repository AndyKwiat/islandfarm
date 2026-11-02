// The camera, as plain math: given the game state and mouse movement it answers "where should the camera be?".
// No three.js, so tests can check it. Two rigs, blended on a mode change:
//   walk: standard third-person orbit around the character, swings gently behind you as you run, never clips the ground
//   fly:  chase camera behind and above the ship, lags in turns, widens its FOV with speed; the mouse looks around and
//         the view recentres when you stop moving it
import { CAMERA, SHIP } from "./config.js";
import { groundAt, colliderTopAt, pushOutOfCliffs } from "./world.js";
import { clamp, lerp, damp, angleDiff } from "./rng.js";
import { heading } from "./game.js";

export function createCameraRig(game) {
  const { world, state } = game, W = CAMERA.walk, F = CAMERA.fly;
  const p0 = state.player;
  const rig = {
    yaw: p0.yaw,                 // the direction the camera looks: walking input is relative to this
    pitch: W.pitch, distance: W.distance,
    pos: [p0.x - Math.sin(p0.yaw) * W.distance, p0.y + 24, p0.z - Math.cos(p0.yaw) * W.distance],
    target: [p0.x, p0.y + W.targetHeight, p0.z],
    fov: W.fov,
    mode: "walk",                // walk | fly: which rig is in charge
    chaseYaw: p0.yaw, lookYaw: 0, lookPitch: 0, sinceLook: 99,
    blendPos: [0, 0, 0], blendTarget: [0, 0, 0], smoothDist: W.distance,
    focus: [p0.x, p0.y + W.targetHeight, p0.z],
    override: null,              // {pos, target}: a fixed camera set by an agent or test
  };

  /** Mouse movement in pixels; wheel in wheel units. */
  rig.look = (dx, dy) => {
    if (rig.mode === "walk") { rig.yaw -= dx * CAMERA.mouseYaw; rig.pitch = clamp(rig.pitch + dy * CAMERA.mousePitch, W.minPitch, W.maxPitch); }
    else { rig.lookYaw -= dx * CAMERA.mouseYaw; rig.lookPitch = clamp(rig.lookPitch + dy * CAMERA.mousePitch, -0.5, 0.8); }
    rig.sinceLook = 0;
  };
  rig.zoom = (delta) => { rig.distance = clamp(rig.distance * (1 + delta * CAMERA.zoomStep), W.minDistance, W.maxDistance); };

  /** Is the point inside something solid? */
  const blocked = (x, y, z) => {
    const g = groundAt(world, x, z);
    if (g !== null && y < g + 2) return true;
    return colliderTopAt(world, x, z, 1.5) > y;
  };

  function walkDesired(dt) {
    const p = state.player;
    // swing behind a running character, unless the player is steering the camera or running toward it
    const running = state.mode === "walk" && p.speed > 5;
    if (running && rig.sinceLook > 1.2) {
      const d = angleDiff(rig.yaw, p.yaw);
      if (Math.abs(d) < 2.3) rig.yaw += d * W.autoYaw * dt;
    }
    for (let i = 0; i < 3; i++) rig.focus[i] = lerp(rig.focus[i], [p.x, p.y + W.targetHeight, p.z][i], damp(W.followLag, dt));
    const cp = Math.cos(rig.pitch), sp = Math.sin(rig.pitch), [hx, hz] = heading(rig.yaw);
    // shorten the boom when something is in the way, ease back out when it clears
    let dist = rig.distance;
    for (let i = 1; i <= 10; i++) {
      const d = (rig.distance * i) / 10;
      if (blocked(rig.focus[0] - hx * cp * d, rig.focus[1] + sp * d, rig.focus[2] - hz * cp * d)) { dist = Math.max(3, d - rig.distance / 10); break; }
    }
    rig.smoothDist = dist < rig.smoothDist ? lerp(rig.smoothDist, dist, damp(18, dt)) : lerp(rig.smoothDist, dist, damp(2.5, dt));
    const d = rig.smoothDist;
    return {
      pos: [rig.focus[0] - hx * cp * d, rig.focus[1] + sp * d, rig.focus[2] - hz * cp * d],
      target: rig.focus.slice(),
      fov: W.fov,
    };
  }

  function flyDesired(dt) {
    const s = game.riding(); if (!s) return walkDesired(dt);
    rig.chaseYaw += angleDiff(rig.chaseYaw, s.yaw) * damp(F.yawLag, dt);
    if (rig.sinceLook > F.recenter) { rig.lookYaw *= Math.exp(-2.5 * dt); rig.lookPitch *= Math.exp(-2.5 * dt); }
    const speed = clamp(Math.hypot(s.vx, s.vz) / SHIP.maxSpeed, 0, 1);
    const yaw = rig.chaseYaw + rig.lookYaw, [hx, hz] = heading(yaw), [shx, shz] = heading(s.yaw);
    const dist = F.distance * (1 + speed * 0.18) * Math.cos(rig.lookPitch), h = F.height + Math.sin(rig.lookPitch) * F.distance;
    const pos = [s.x - hx * dist, s.y + h, s.z - hz * dist];
    [pos[0], pos[2]] = pushOutOfCliffs(world, pos[0], pos[2], pos[1], 8);
    const g = groundAt(world, pos[0], pos[2]);
    if (g !== null) pos[1] = Math.max(pos[1], g + 6);
    return {
      pos,
      target: [s.x + shx * F.lookAhead * speed, s.y + F.targetHeight, s.z + shz * F.lookAhead * speed],
      fov: lerp(F.fov, F.fovFast, speed * speed),
    };
  }

  /** Move the camera along. Call once per rendered frame with its real dt. */
  rig.update = (dt) => {
    rig.sinceLook += dt;
    const wants = state.mode === "fly" || state.mode === "boarding" ? "fly" : "walk";
    if (wants !== rig.mode) {
      // hold on to where the camera is now and let that offset melt away: no cuts
      if (wants === "fly") { rig.chaseYaw = game.riding()?.yaw ?? rig.yaw; rig.lookYaw = angleDiff(rig.chaseYaw, rig.yaw); rig.lookPitch = 0; rig.sinceLook = 0; }
      else { rig.yaw = rig.chaseYaw + rig.lookYaw; rig.pitch = W.pitch; const p = state.player; rig.focus = [p.x, p.y + W.targetHeight, p.z]; rig.smoothDist = rig.distance; }
      rig.mode = wants;
      const want = wants === "fly" ? flyDesired(0) : walkDesired(0);
      for (let i = 0; i < 3; i++) { rig.blendPos[i] = rig.pos[i] - want.pos[i]; rig.blendTarget[i] = rig.target[i] - want.target[i]; }
    }
    if (rig.override) { rig.pos = rig.override.pos.slice(); rig.target = rig.override.target.slice(); return rig; }
    const want = rig.mode === "fly" ? flyDesired(dt) : walkDesired(dt);
    const k = Math.exp(-CAMERA.blendRate * dt);
    for (let i = 0; i < 3; i++) {
      rig.blendPos[i] *= k; rig.blendTarget[i] *= k;
      rig.pos[i] = want.pos[i] + rig.blendPos[i];
      rig.target[i] = want.target[i] + rig.blendTarget[i];
    }
    rig.fov = lerp(rig.fov, want.fov, damp(4, dt));
    return rig;
  };
  return rig;
}
