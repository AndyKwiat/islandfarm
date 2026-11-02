// World queries: turn a plain level definition (src/levels/) into islands you can ask questions of.
// No three.js here, so tests and headless simulations can use it directly.
//
// An island is a top surface above a polar outline r(theta), and a cliff below it that flares outward as it descends.
// compileLevel() → { islands, props, colliders, ships, critters, spawn, ... } plus the query functions at the bottom.
import { WALK, SHIP } from "./config.js";
import { PROPS } from "./props.js";
import { rng, clamp, smoothstep } from "./rng.js";

const TAU = Math.PI * 2;

/** Smooth bumpy closed curve: a few sine harmonics with seeded phases. Returns f(theta) ≈ 1. */
function outlineFn(seed, roughness) {
  const R = rng(seed), harmonics = [];
  for (let k = 2; k <= 7; k++) harmonics.push({ k, a: (roughness * (0.6 + R() * 0.8)) / k, p: R() * TAU });
  return (theta) => { let v = 1; for (const h of harmonics) v += h.a * Math.sin(h.k * theta + h.p); return v; };
}

function compileIsland(def, index) {
  const seed = def.seed ?? index * 37 + 11;
  const out = outlineFn(seed, def.roughness ?? 0.28);
  const R = rng(seed + 5), phase = [R() * TAU, R() * TAU, R() * TAU, R() * TAU];
  const island = {
    id: def.id, name: def.name ?? def.id, index, seed,
    x: def.x, z: def.z, top: def.top, radius: def.radius,
    flare: def.flare ?? 0.22,           // how much wider the cliff is per unit of depth
    swell: def.swell ?? 2.2,            // amplitude of the gentle rolling ground
    mounds: def.mounds ?? [],           // [{x, z, r, h}] local coordinates
    flats: [],                          // [{x, z, r}] local coordinates, filled from props
    paint: def.paint ?? [],             // ground painting (see src/render/islandMesh.js)
    grass: def.grass ?? 1,              // density of grass tufts and flowers
    outline: out, phase,
    outerRadius: 0,
  };
  let max = 0;
  for (let i = 0; i < 90; i++) max = Math.max(max, out((i / 90) * TAU));
  island.outerRadius = def.radius * max;
  return island;
}

/** Outline radius of an island at an angle (world bearing from its centre). */
export const rimRadius = (island, theta) => island.radius * island.outline(theta);

/** Ground height at local offset (dx, dz), ignoring the rim. Exact counterpart of the rendered mesh. */
export function surfaceHeight(island, dx, dz) {
  const p = island.phase;
  let swell = Math.sin(dx * 0.021 + p[0]) * Math.cos(dz * 0.019 + p[1]) + 0.5 * Math.sin(dx * 0.047 + p[2]) * Math.sin(dz * 0.053 + p[3]);
  let flat = 1;
  for (const f of island.flats) { flat = Math.min(flat, smoothstep(f.r, f.r + 16, Math.hypot(dx - f.x, dz - f.z))); if (flat === 0) break; }
  let h = island.top + swell * island.swell * flat;
  for (const m of island.mounds) { const d = Math.hypot(dx - m.x, dz - m.z) / m.r; if (d < 1) h += m.h * (1 - d * d) * (1 - d * d); }
  return h;
}

/** Radius of the solid cliff at angle theta and world height y (the flare widens it going down). */
export function cliffRadius(island, theta, y) {
  const depth = Math.max(0, island.top - y);
  return rimRadius(island, theta) + depth * island.flare;
}

/** Build a world from a level definition. */
export function compileLevel(def) {
  const islands = def.islands.map(compileIsland);
  const byId = Object.fromEntries(islands.map((i) => [i.id, i]));
  const need = (id, what) => { const i = byId[id]; if (!i) throw new Error(`${what}: unknown island "${id}" in level "${def.id}"`); return i; };

  const props = [], colliders = [];
  // First pass: ground flats, so that the heights read in the second pass are the final ones.
  for (const p of def.props ?? []) {
    const spec = PROPS[p.model];
    if (!spec) throw new Error(`prop "${p.model}" has no entry in src/game/props.js`);
    if (spec.flat) need(p.island, p.model).flats.push({ x: p.x, z: p.z, r: spec.flat });
  }
  for (const s of def.ships ?? []) need(s.island, "ship").flats.push({ x: s.x, z: s.z, r: 24 });
  for (const f of def.fields ?? []) need(f.island, "field").flats.push({ x: f.x, z: f.z, r: Math.hypot(f.w, f.d) / 2 + 2 });
  for (const p of def.props ?? []) {
    const spec = PROPS[p.model], isl = need(p.island, p.model);
    const rot = (p.rot ?? 0), x = isl.x + p.x, z = isl.z + p.z, y = surfaceHeight(isl, p.x, p.z);
    const prop = { model: p.model, island: p.island, x, y, z, rot, colors: p.colors ?? null, scale: p.scale ?? 1 };
    props.push(prop);
    const c = colliderFor(spec, prop);
    if (c) colliders.push(c);
  }

  const ships = (def.ships ?? []).map((s, i) => {
    const isl = need(s.island, "ship"), x = isl.x + s.x, z = isl.z + s.z;
    return { id: s.id ?? `ship${i}`, name: s.name ?? "Airship", colors: s.colors ?? null, x, y: surfaceHeight(isl, s.x, s.z), z, yaw: s.yaw ?? 0 };
  });
  const critters = (def.critters ?? []).map((c, i) => {
    const isl = need(c.island, "critter");
    return { ...c, id: i, homeX: isl.x + c.x, homeZ: isl.z + c.z };
  });
  const spawnIsl = need(def.spawn.island, "spawn");
  const spawn = { x: spawnIsl.x + def.spawn.x, z: spawnIsl.z + def.spawn.z, yaw: def.spawn.yaw ?? 0 };

  const fields = (def.fields ?? []).map((f) => { const isl = need(f.island, "field"); return { ...f, wx: isl.x + f.x, wz: isl.z + f.z }; });
  // Gondola: two stations facing each other along the z axis (the demo's station models only line up on a quarter turn).
  const gondolas = (def.gondolas ?? []).map((g) => {
    const low = props.find((p) => p.model === "gondola_station_low" && p.island === g.low), high = props.find((p) => p.model === "gondola_station_high" && p.island === g.high);
    if (!low || !high) throw new Error(`gondola needs a station prop on ${g.low} and ${g.high}`);
    return { from: [low.x, low.y + 27, low.z - 28], to: [high.x, high.y + 19, high.z - 10.5], period: g.period ?? 40 };
  });

  return {
    grid: buildGrid(colliders),
    id: def.id, name: def.name ?? def.id, islands, byId, props, colliders, ships, critters, spawn, fields, gondolas, gondolaIslands: def.gondolas ?? [],
    balloons: def.balloons ?? [], views: Object.fromEntries(Object.entries(def.views ?? {}).map(([name, v]) => [name, resolveView(v, byId)])),
  };
}

// Colliders are looked up through a coarse grid: the character, the ship, the critters and the camera ask very often, and
// each only ever needs the few things around it.
const CELL = 120, GRID_MARGIN = 40, cellKey = (ix, iz) => ix * 100003 + iz, NONE = [];
function buildGrid(colliders) {
  const cells = new Map();
  for (const c of colliders) {
    const x0 = c.kind === "circle" ? c.x - c.r : c.x0, x1 = c.kind === "circle" ? c.x + c.r : c.x1, z0 = c.kind === "circle" ? c.z - c.r : c.z0, z1 = c.kind === "circle" ? c.z + c.r : c.z1;
    for (let ix = Math.floor((x0 - GRID_MARGIN) / CELL); ix <= Math.floor((x1 + GRID_MARGIN) / CELL); ix++)
      for (let iz = Math.floor((z0 - GRID_MARGIN) / CELL); iz <= Math.floor((z1 + GRID_MARGIN) / CELL); iz++) {
        const k = cellKey(ix, iz); let list = cells.get(k); if (!list) cells.set(k, (list = [])); list.push(c);
      }
  }
  return cells;
}
/** Colliders that could touch a disc at (x, z). */
function nearColliders(world, x, z, radius) {
  if (radius > GRID_MARGIN) return world.colliders;
  return world.grid.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL))) ?? NONE;
}

/** A level's camera is [position, target] in world coordinates, or [islandId | null, position, target] relative to an island's centre and top. */
function resolveView(v, byId) {
  if (v.length === 2) return v;
  const isl = v[0] ? byId[v[0]] : null;
  if (v[0] && !isl) throw new Error(`view: unknown island "${v[0]}"`);
  const at = ([x, y, z]) => (isl ? [isl.x + x, isl.top + y, isl.z + z] : [x, y, z]);
  return [at(v[1]), at(v[2])];
}

/** World-space collider for a prop: {kind: "circle"|"box", ...}. Quarter-turn rot only, like the tech demo. */
function colliderFor(spec, p) {
  if (spec.r) return { kind: "circle", x: p.x, z: p.z, r: spec.r * p.scale, h: p.y + spec.h * p.scale, model: p.model };
  if (spec.box) {
    const [a, b, c, d] = spec.box, s = p.scale, q = ((p.rot % 4) + 4) % 4;
    // Three.js rotates about +y counter-clockwise from above; a quarter turn maps (x, z) → (z, -x).
    const corners = [[a, c], [b, d]].map(([lx, lz]) => {
      let x = lx * s, z = lz * s;
      for (let i = 0; i < q; i++) [x, z] = [z, -x];
      return [x, z];
    });
    return { kind: "box", x0: p.x + Math.min(corners[0][0], corners[1][0]), x1: p.x + Math.max(corners[0][0], corners[1][0]), z0: p.z + Math.min(corners[0][1], corners[1][1]), z1: p.z + Math.max(corners[0][1], corners[1][1]), h: p.y + spec.h * s, model: p.model };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// queries

/** The island whose top contains (x, z), or null. margin > 0 shrinks the outline. */
export function islandAt(world, x, z, margin = 0) {
  for (const isl of world.islands) {
    const dx = x - isl.x, dz = z - isl.z, d = Math.hypot(dx, dz);
    if (d > isl.outerRadius + 1) continue;
    if (d <= rimRadius(isl, Math.atan2(dz, dx)) - margin) return isl;
  }
  return null;
}

/** Ground height at (x, z), or null over the void. */
export function groundAt(world, x, z) {
  const isl = islandAt(world, x, z);
  return isl ? surfaceHeight(isl, x - isl.x, z - isl.z) : null;
}

/** Push a circle (x, z, radius) out of every collider that reaches above height y. Returns [x, z]. */
export function pushOutOfColliders(world, x, z, radius, y = -Infinity) {
  for (const c of nearColliders(world, x, z, radius)) {
    if (y >= c.h) continue;
    if (c.kind === "circle") {
      const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), min = c.r + radius;
      if (d < min) { const k = d > 1e-6 ? min / d : 0; x = d > 1e-6 ? c.x + dx * k : c.x + min; z = d > 1e-6 ? c.z + dz * k : z; }
    } else {
      const nx = clamp(x, c.x0, c.x1), nz = clamp(z, c.z0, c.z1), dx = x - nx, dz = z - nz, d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 > 1e-9) { const d = Math.sqrt(d2), k = radius / d; x = nx + dx * k; z = nz + dz * k; }
      else { // centre inside the box: leave through the nearest side
        const l = x - c.x0, r = c.x1 - x, n = z - c.z0, f = c.z1 - z, m = Math.min(l, r, n, f);
        if (m === l) x = c.x0 - radius; else if (m === r) x = c.x1 + radius; else if (m === n) z = c.z0 - radius; else z = c.z1 + radius;
      }
    }
  }
  return [x, z];
}

/** Is the disc at (x, z) free of colliders (taller than the ground)? */
export function isClear(world, x, z, radius) {
  const [px, pz] = pushOutOfColliders(world, x, z, radius);
  return px === x && pz === z;
}

/** Highest collider top under the disc (x, z, radius), or -Infinity. The airship rests above these. */
export function colliderTopAt(world, x, z, radius) {
  let top = -Infinity;
  for (const c of nearColliders(world, x, z, radius)) {
    const hit = c.kind === "circle" ? Math.hypot(x - c.x, z - c.z) < c.r + radius
      : Math.hypot(x - clamp(x, c.x0, c.x1), z - clamp(z, c.z0, c.z1)) < radius;
    if (hit && c.h > top) top = c.h;
  }
  return top;
}

/** Keep a walker on its island: clamp inside the rim. Returns [x, z]. */
export function clampToIsland(island, x, z, margin = WALK.edgeMargin) {
  const dx = x - island.x, dz = z - island.z, d = Math.hypot(dx, dz), theta = Math.atan2(dz, dx), max = rimRadius(island, theta) - margin;
  if (d <= max) return [x, z];
  return [island.x + Math.cos(theta) * max, island.z + Math.sin(theta) * max];
}

/** Push the ship out of any cliff it has flown into. Returns [x, z, islandOrNull]. */
export function pushOutOfCliffs(world, x, z, y, radius) {
  let hit = null;
  for (const isl of world.islands) {
    const lowestRim = isl.top - isl.swell * 1.5;     // below this you are beside the cliff, above it over the ground
    if (y >= lowestRim) continue;
    const dx = x - isl.x, dz = z - isl.z, d = Math.hypot(dx, dz), theta = Math.atan2(dz, dx), min = cliffRadius(isl, theta, y) + radius;
    if (d < min) { x = isl.x + Math.cos(theta) * min; z = isl.z + Math.sin(theta) * min; hit = isl; }
  }
  return [x, z, hit];
}

/** The nearest spot beside (x, z) where a person can stand after jumping out of a ship, or null. */
export function findDismountSpot(world, x, z, yaw, reach = 24) {
  const tries = [Math.PI / 2, -Math.PI / 2, Math.PI, 0, (3 * Math.PI) / 4, (-3 * Math.PI) / 4, Math.PI / 4, -Math.PI / 4];
  for (const r of [reach, reach * 0.75, reach * 1.4, reach * 1.9]) {
    for (const a of tries) {
      const sx = x + Math.sin(yaw + a) * r, sz = z + Math.cos(yaw + a) * r;
      if (islandAt(world, sx, sz, WALK.edgeMargin + 1) && isClear(world, sx, sz, WALK.radius + 0.5)) return { x: sx, z: sz };
    }
  }
  return null;
}

/** The nearest spot on the same island where the whole ship fits clear of props, for auto-landing; or null. */
export function findLandingSpot(world, x, z, radius = SHIP.radius * 0.7) {
  const isl = islandAt(world, x, z); if (!isl) return null;
  const ok = (px, pz) => islandAt(world, px, pz, radius * 0.7) === isl && isClear(world, px, pz, radius);
  if (ok(x, z)) return { x, z };
  for (let r = 6; r < isl.outerRadius * 2; r += 6) for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
    if (ok(px, pz)) return { x: px, z: pz };
  }
  return null;
}
