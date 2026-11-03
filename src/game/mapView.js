// Map projection, as plain math: world (x, z) → pixels on a square map that fits the whole level. North (-z) is up, +x is right.
// Small islands are drawn larger than life (`minRadius`), or they would vanish on the minimap.
import { rimRadius } from "./world.js";

export function mapView(world, size, { pad = 14, minRadius = 3, exaggerate = 1 } = {}) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const i of world.islands) {
    x0 = Math.min(x0, i.x - i.outerRadius); x1 = Math.max(x1, i.x + i.outerRadius);
    z0 = Math.min(z0, i.z - i.outerRadius); z1 = Math.max(z1, i.z + i.outerRadius);
  }
  for (const d of world.drafts ?? []) { x0 = Math.min(x0, d.x - d.r); x1 = Math.max(x1, d.x + d.r); z0 = Math.min(z0, d.z - d.r); z1 = Math.max(z1, d.z + d.r); }
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

/**
 * Where each island's name goes on the map, without names landing on each other or on other islands. Big islands hold their
 * name; the rest try below, above, the sides and the corners, and take the first free spot (or the least bad one, if none is).
 * measure(text) gives a width in pixels. Returns [{ id, text, x, y }], x centred, y the top of a line `lineHeight` tall.
 */
export function placeLabels(world, view, measure, { lineHeight = 14, north = [] } = {}) {
  const { size } = view, rects = [], placed = [], boxes = new Map();
  for (const isl of world.islands) {
    const pts = view.outline(isl), xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    boxes.set(isl.id, { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) });
  }
  const hits = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  // the most constrained go first: big islands, then the smallest
  const order = [...world.islands].sort((a, b) => b.radius - a.radius);
  const reach = (isl) => (boxes.get(isl.id).x1 - boxes.get(isl.id).x0) / 2;
  for (const isl of order) {
    const b = boxes.get(isl.id), w = measure(isl.name) + 6, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, big = reach(isl) > w / 2 + 4;
    const gap = 3, spots = big ? [[cx, cy - lineHeight / 2]] : [[cx, b.y1 + gap], [cx, b.y0 - lineHeight - gap], [b.x1 + w / 2 + gap, cy - lineHeight / 2], [b.x0 - w / 2 - gap, cy - lineHeight / 2],
      [b.x1 + w / 2 + gap, b.y1 + gap], [b.x0 - w / 2 - gap, b.y1 + gap], [b.x1 + w / 2 + gap, b.y0 - lineHeight - gap], [b.x0 - w / 2 - gap, b.y0 - lineHeight - gap]];
    if (north.includes(isl.id)) spots.reverse().sort((p, q) => p[1] - q[1]);
    let best = null, bestScore = Infinity;
    for (const [sx, sy] of spots) {
      const x = Math.max(w / 2, Math.min(size - w / 2, sx)), y = Math.max(0, Math.min(size - lineHeight, sy));
      const rect = { x0: x - w / 2, x1: x + w / 2, y0: y, y1: y + lineHeight };
      let score = 0;
      for (const r of rects) if (hits(rect, r)) score += 10;
      if (!big) for (const [id, box] of boxes) if (id !== isl.id && hits(rect, box)) score += 3;
      if (score < bestScore) { bestScore = score; best = { rect, x, y }; }
      if (score === 0) break;
    }
    rects.push(best.rect); placed.push({ id: isl.id, text: isl.name, x: best.x, y: best.y });
  }
  return placed;
}
