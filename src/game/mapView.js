// Map projection, as plain math: world (x, z) → pixels on a square map that fits the whole level. North (-z) is up, +x is right.
// Small islands are drawn larger than life (`minRadius`), or they would vanish on the minimap.
import { rimRadius } from "./world.js";

export function mapView(world, size, { pad = 14, minRadius = 3, exaggerate = 1 } = {}) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const i of world.islands) {
    x0 = Math.min(x0, i.x - i.outerRadius); x1 = Math.max(x1, i.x + i.outerRadius);
    z0 = Math.min(z0, i.z - i.outerRadius); z1 = Math.max(z1, i.z + i.outerRadius);
  }
  const span = Math.max(x1 - x0, z1 - z0, 1), scale = (size - pad * 2) / span, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const toMap = (x, z) => [size / 2 + (x - cx) * scale, size / 2 + (z - cz) * scale];
  /** How much an island's outline is blown up on this map. */
  const growth = (isl) => Math.max(exaggerate, minRadius / (isl.radius * scale));
  /** The island's outline in map pixels. */
  const outline = (isl, n = 40) => {
    const [mx, my] = toMap(isl.x, isl.z), k = growth(isl) * scale;
    return Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2, r = rimRadius(isl, a) * k; return [mx + Math.cos(a) * r, my + Math.sin(a) * r]; });
  };
  return { size, scale, toMap, outline, growth };
}

/** Unit vector on the map for a heading yaw. */
export const mapHeading = (yaw) => [Math.sin(yaw), Math.cos(yaw)];
