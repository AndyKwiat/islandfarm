// Autopilots: turn "go there" into the same key input a player would press. Used by scenarios, tests and screenshots
// so an agent can drive the real controls without working out key timings.
import { angleDiff } from "./rng.js";
import { heading } from "./game.js";

/** Keys that walk the character toward (x, z). Sets camYaw to the direction of travel. */
export function walkTo(game, x, z) {
  const p = game.state.player, d = Math.hypot(x - p.x, z - p.z);
  if (d < 3) return null;   // arrived
  return { w: true, camYaw: Math.atan2(x - p.x, z - p.z) };
}

/**
 * Keys that fly the ridden ship toward (x, z) at altitude y. Returns null within `arrive` units, horizontally.
 * Eases off the throttle when pointing the wrong way, like a person would.
 */
export function flyTo(game, x, z, y, arrive = 40) {
  const s = game.riding(); if (!s) return null;
  const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz);
  if (d < arrive) return null;
  const err = angleDiff(s.yaw, Math.atan2(dx, dz)), input = {};
  if (err > 0.06) input.a = true; else if (err < -0.06) input.d = true;
  if (Math.abs(err) < 1.0) {
    // brake for a close target so it can be reached, not just overshot
    const [hx, hz] = heading(s.yaw), closing = s.vx * hx + s.vz * hz;
    if (d > closing * 0.8) input.w = true; else if (closing > 80) input.s = true;
  }
  if (y > s.y + 6) input.space = true; else if (y < s.y - 6) input.shift = true;
  return input;
}
