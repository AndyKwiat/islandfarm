// Level-of-detail and quality decisions, as plain functions so they can be tested. Distances are from the camera to the
// island's rim. All the numbers are in LOD in config.js.
//   level 0: full detail, ambient occlusion, shadows, grass
//   level 1: full buildings, simplified terrain
//   level 2: buildings become a few boxes
import { LOD } from "./config.js";

/** The LOD level for a distance. Moving out switches a little later than moving in, so nothing flickers on the boundary. */
export function lodLevel(distance, current = 2) {
  const out = (limit, level) => distance > limit + (current <= level ? LOD.hysteresis : -LOD.hysteresis);
  if (out(LOD.mid, 1)) return 2;
  if (out(LOD.near, 0)) return 1;
  return 0;
}

/** Distance from a point to an island's rim (0 when above it). */
export function rimDistance(island, x, y, z) {
  return Math.max(0, Math.hypot(x - island.x, y - island.top, z - island.z) - island.outerRadius);
}

/**
 * Adaptive quality: given the average frame time, the quality step to use next. It only ever steps down, so a slow moment
 * can't set off an endless up-and-down that is worse than either setting.
 */
export function nextQuality(avgFrameSeconds, step, lastStep) {
  return avgFrameSeconds > LOD.slowFrame && step < lastStep ? step + 1 : step;
}
