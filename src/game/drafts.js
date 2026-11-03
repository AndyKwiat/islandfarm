// Drafts: columns of moving air between the islands. Updrafts lift the ship faster than its own engine can, so riding one is the
// quick way up; downdrafts do the opposite, so it pays to see them coming. Scenery you can use, never a hazard: they sit in the
// gaps, not over land, and the mist and the ceiling still ease you back.
//
// Level data: drafts: { seed, up: 16, down: 5 } to generate them, or drafts: { list: [{ x, z, r, lift, base, top }] } to place them.
// lift is units per second, negative for a downdraft. All the handling numbers are in DRAFT in config.js.
import { DRAFT } from "./config.js";
import { rng, smoothstep } from "./rng.js";

/** Build the drafts of a level. */
export function createDrafts(world, spec) {
  if (!spec) return [];
  if (spec.list) return spec.list.map((d, id) => ({ id, base: DRAFT.base, top: DRAFT.top[1], ...d }));
  const R = rng(spec.seed ?? 5), rnd = (a, b) => a + R() * (b - a), out = [];
  const kinds = [...Array(spec.up ?? 0).fill(1), ...Array(spec.down ?? 0).fill(-1)];
  // the early ones go near the centre of the world, so there is one to find soon after you take off
  kinds.forEach((sign, n) => {
    for (let attempt = 0; attempt < 600; attempt++) {
      const reach = n < 4 ? 1100 : DRAFT.spread, a = R() * Math.PI * 2, d = Math.sqrt(R()) * reach, x = Math.cos(a) * d, z = Math.sin(a) * d;
      const r = rnd(DRAFT.radius[0], DRAFT.radius[1]);
      if (world.islands.some((i) => Math.hypot(x - i.x, z - i.z) < i.outerRadius + r + 25)) continue;
      if (out.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + r + 140)) continue;
      const strength = sign > 0 ? rnd(DRAFT.up[0], DRAFT.up[1]) : -rnd(DRAFT.down[0], DRAFT.down[1]);
      out.push({ id: out.length, x, z, r, lift: strength, base: DRAFT.base, top: sign > 0 ? rnd(DRAFT.top[0], DRAFT.top[1]) : DRAFT.top[1] });
      break;
    }
  });
  return out;
}

const NONE = { draft: null, lift: 0, turbulence: 0, swirlX: 0, swirlZ: 0 };

/** The air at a point at time t: vertical speed it wants to give you, how rough it is, and its sideways swirl. */
export function draftAt(drafts, x, y, z, t) {
  for (const d of drafts) {
    const dx = x - d.x, dz = z - d.z, dist = Math.hypot(dx, dz);
    if (dist >= d.r) continue;
    const radial = smoothstep(d.r, d.r * 0.5, dist), height = smoothstep(d.top, d.top - 90, y) * smoothstep(d.base - 40, d.base + 40, y), k = radial * height;
    if (k <= 0.01) continue;
    // gusting in the middle of the column; turning you gently round it
    const pulse = 0.82 + 0.18 * Math.sin(t * 2.7 + d.id * 1.9), swirl = (DRAFT.swirl * k) / Math.max(dist, 12);
    return { draft: d, lift: d.lift * k * pulse, turbulence: k, swirlX: -dz * swirl, swirlZ: dx * swirl };
  }
  return NONE;
}
