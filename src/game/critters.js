// Ambient life: animals and villagers that potter around a home spot. Decoration only; nothing depends on them.
// Level data: { island, x, z, animal: "chicken" } or { island, x, z, person: "farmer" }, optional range (0 = stands still).
import { clampToIsland, islandAt, surfaceHeight, pushOutOfColliders } from "./world.js";
import { damp, angleDiff } from "./rng.js";

const SPEED = { chicken: 9, cat: 11, dog: 14, pig: 8, sheep: 7, cow: 6, duck: 8, person: 10 };

export function createCritterState(world) {
  return world.critters.map((c) => {
    const isl = islandAt(world, c.homeX, c.homeZ);
    return {
      id: c.id, island: isl?.id ?? null, x: c.homeX, z: c.homeZ, y: isl ? surfaceHeight(isl, c.homeX - isl.x, c.homeZ - isl.z) : 0,
      yaw: c.yaw ?? c.id * 1.7, moving: false, wait: 0.5 + (c.id % 5), stride: c.id, goalX: c.homeX, goalZ: c.homeZ,
    };
  });
}

export function stepCritters(state, world, dt, R) {
  state.critters.forEach((c, i) => {
    const def = world.critters[i], range = def.range ?? 22;
    if (range === 0 || !c.island) return;
    if (!c.moving) {
      c.wait -= dt;
      if (c.wait <= 0) { const a = R() * Math.PI * 2, d = range * Math.sqrt(R()); c.goalX = def.homeX + Math.sin(a) * d; c.goalZ = def.homeZ + Math.cos(a) * d; c.moving = true; c.wait = 6; }
      return;
    }
    const dx = c.goalX - c.x, dz = c.goalZ - c.z, d = Math.hypot(dx, dz), sp = SPEED[def.animal ?? "person"] ?? 8;
    c.wait -= dt;
    if (d < 1 || c.wait <= 0) { c.moving = false; c.wait = 1.5 + R() * 5; return; }
    const isl = world.byId[c.island];
    let nx = c.x + (dx / d) * sp * dt, nz = c.z + (dz / d) * sp * dt;
    [nx, nz] = pushOutOfColliders(world, nx, nz, 2);
    [nx, nz] = clampToIsland(isl, nx, nz, 8);
    c.stride += Math.hypot(nx - c.x, nz - c.z) * 0.6;
    c.x = nx; c.z = nz; c.y = surfaceHeight(isl, nx - isl.x, nz - isl.z);
    c.yaw += angleDiff(c.yaw, Math.atan2(dx, dz)) * damp(6, dt);
  });
}
