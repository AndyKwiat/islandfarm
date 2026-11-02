// The game simulation: one character, some airships, a mode machine. Pure logic, no three.js and no DOM, so it runs
// the same in the browser, in `bun test` and in `bun run sim`.
//
//   const game = createGame(levelDefinition);
//   game.step({ w: true, camYaw: 0 });         // one fixed step of STEP seconds
//   game.advance(2, { w: true });              // two seconds with those keys held
//   game.state                                 // plain JSON-friendly data; see createGame below
//
// Input is the set of held keys, by role: { w, a, s, d, space, shift, e, camYaw }. Meaning depends on the mode:
//   walk: w/a/s/d run relative to camYaw, space jumps, shift sprints, e boards a nearby ship
//   fly:  w/s throttle, a/d turn, space climbs, shift descends, e lands and jumps out
//
// Yaw convention: heading = (sin yaw, cos yaw) in (x, z). yaw 0 faces +z, and increasing yaw turns left.
//
// Modes: walk → boarding → fly → exiting → walk. Boarding and exiting are short scripted hops (HOP in config.js).
import { STEP, WALK, SHIP, HOP } from "./config.js";
import {
  compileLevel, islandAt, surfaceHeight, groundAt, pushOutOfColliders, clampToIsland, pushOutOfCliffs,
  colliderTopAt, findDismountSpot, findLandingSpot,
} from "./world.js";
import { rng, clamp, lerp, damp, angleDiff, approach } from "./rng.js";
import { stepCritters, createCritterState } from "./critters.js";

export const heading = (yaw) => [Math.sin(yaw), Math.cos(yaw)];
const rightOf = (yaw) => [-Math.cos(yaw), Math.sin(yaw)];

export function createGame(levelDef) {
  const world = compileLevel(levelDef);
  const spawnIsland = islandAt(world, world.spawn.x, world.spawn.z);
  if (!spawnIsland) throw new Error(`level "${world.id}": spawn is not on an island`);

  const state = {
    time: 0,
    mode: "walk",                 // walk | boarding | fly | exiting
    shipId: null,                 // the ship being ridden (or boarded / left)
    island: spawnIsland.id,       // island under the character (or ship), null over the void
    player: {
      x: world.spawn.x, y: surfaceHeight(spawnIsland, world.spawn.x - spawnIsland.x, world.spawn.z - spawnIsland.z), z: world.spawn.z,
      yaw: world.spawn.yaw, vx: 0, vy: 0, vz: 0, grounded: true, speed: 0, stride: 0,
    },
    ships: world.ships.map((s) => ({
      id: s.id, name: s.name, x: s.x, y: s.y, z: s.z, yaw: s.yaw, vx: 0, vy: 0, vz: 0, yawRate: 0,
      landed: true, autoLand: null, throttle: 0, bank: 0, tilt: 0, prop: 0,
    })),
    hop: null,                    // {t, from: [x, y, z], to: [x, z] | null}
    critters: createCritterState(world),
    prompt: null,                 // what `e` would do right now, for the HUD: {action, text}
  };
  const events = [];              // [{t, type, ...}]: boarded, landed, jumped_out, arrived, ...
  const R = rng(1234);
  let prevE = false, prevSpace = false;
  const emit = (type, data = {}) => events.push({ t: +state.time.toFixed(3), type, ...data });

  const shipById = (id) => state.ships.find((s) => s.id === id) ?? null;
  const riding = () => shipById(state.shipId);

  // ---- walking
  function stepWalk(input, dt, jumpPressed) {
    const p = state.player, isl = world.byId[state.island] ?? islandAt(world, p.x, p.z);
    const f = (input.w ? 1 : 0) - (input.s ? 1 : 0), r = (input.d ? 1 : 0) - (input.a ? 1 : 0);
    const camYaw = input.camYaw ?? 0, [fx, fz] = heading(camYaw), [rx, rz] = rightOf(camYaw);
    let dx = fx * f + rx * r, dz = fz * f + rz * r;
    const len = Math.hypot(dx, dz);
    const speed = input.shift ? WALK.sprint : WALK.speed;
    if (len > 0) { dx /= len; dz /= len; }
    const rate = (len > 0 ? WALK.accel : WALK.friction) * (p.grounded ? 1 : 0.55) * dt;
    p.vx = approach(p.vx, dx * speed, rate);
    p.vz = approach(p.vz, dz * speed, rate);
    if (len > 0) p.yaw += angleDiff(p.yaw, Math.atan2(dx, dz)) * damp(WALK.turnRate, dt);

    let nx = p.x + p.vx * dt, nz = p.z + p.vz * dt;
    [nx, nz] = pushOutOfColliders(world, nx, nz, WALK.radius);
    if (isl) [nx, nz] = clampToIsland(isl, nx, nz);
    const moved = Math.hypot(nx - p.x, nz - p.z);
    p.speed = moved / dt;
    p.stride += moved * 0.34;
    p.x = nx; p.z = nz;

    const ground = isl ? surfaceHeight(isl, p.x - isl.x, p.z - isl.z) : p.y;
    if (p.grounded) {
      p.y = ground;
      if (jumpPressed) { p.vy = WALK.jumpSpeed; p.grounded = false; emit("jumped"); }
    }
    if (!p.grounded) {
      p.vy -= WALK.gravity * dt;
      p.y += p.vy * dt;
      if (p.y <= ground) { p.y = ground; p.vy = 0; p.grounded = true; }
    }
  }

  /** The nearest landed ship the character can reach. */
  function boardableShip() {
    const p = state.player; let best = null, bd = SHIP.boardRange;
    for (const s of state.ships) { if (!s.landed) continue; const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < bd) { bd = d; best = s; } }
    return best;
  }

  // ---- flying
  function shipFloor(s) {
    const ground = groundAt(world, s.x, s.z);
    if (ground === null) return null;
    const top = colliderTopAt(world, s.x, s.z, SHIP.radius * 0.6);
    return { ground, floor: Math.max(ground, top), clear: top <= ground };
  }

  function stepShip(s, input, dt) {
    const steer = input.w || input.s || input.a || input.d || input.space;
    if (steer && s.autoLand) { s.autoLand = null; emit("autoland_cancelled"); }
    if (steer && s.landed) { s.landed = false; emit("took_off", { ship: s.id }); }
    if (s.landed) { s.vx = s.vy = s.vz = s.yawRate = 0; s.throttle = 0; s.bank = lerp(s.bank, 0, damp(6, dt)); s.tilt = lerp(s.tilt, 0, damp(6, dt)); return; }

    const auto = s.autoLand;
    const f = auto ? 0 : (input.w ? 1 : 0) - (input.s ? 1 : 0), t = auto ? 0 : (input.a ? 1 : 0) - (input.d ? 1 : 0);
    const v = auto ? -1 : (input.space ? 1 : 0) - (input.shift ? 1 : 0);

    // steering
    const spFrac = clamp(Math.hypot(s.vx, s.vz) / SHIP.maxSpeed, 0, 1);
    const targetRate = t * lerp(SHIP.turnRate, SHIP.turnRateFast, spFrac);
    s.yawRate += (targetRate - s.yawRate) * damp(SHIP.turnResponse, dt);
    s.yaw += s.yawRate * dt;

    // forward speed and sideways drift, measured against the new heading
    const [hx, hz] = heading(s.yaw), [rx, rz] = rightOf(s.yaw);
    let sp = s.vx * hx + s.vz * hz, side = s.vx * rx + s.vz * rz;
    if (f > 0) sp = Math.min(sp < SHIP.maxSpeed ? sp + SHIP.accel * dt : sp, Math.max(sp, SHIP.maxSpeed));
    else if (f < 0) sp = sp > 0 ? Math.max(0, sp - SHIP.brake * dt) : Math.max(-SHIP.reverseSpeed, sp - SHIP.accel * 0.5 * dt);
    else sp *= Math.exp(-SHIP.drag * dt);
    // converting drift back into forward speed keeps the ship fast through turns
    const newSide = side * Math.exp(-SHIP.sideGrip * dt);
    if (f >= 0 && sp >= 0) sp = Math.sqrt(Math.max(0, sp * sp + side * side - newSide * newSide));
    side = newSide;
    s.vx = hx * sp + rx * side;
    s.vz = hz * sp + rz * side;

    // auto-land: drift to a clear spot, then descend
    if (auto) {
      const dx = auto.x - s.x, dz = auto.z - s.z, d = Math.hypot(dx, dz), want = Math.min(d * 2.2, SHIP.autoLandSpeed);
      const k = d > 1e-3 ? want / d : 0, rate = damp(3.5, dt);
      s.vx = lerp(s.vx, dx * k, rate);
      s.vz = lerp(s.vz, dz * k, rate);
    }

    // vertical
    let climb = auto ? -SHIP.autoLandSpeed : v * SHIP.climbSpeed;
    // soft walls: nothing here ever punishes you, it just eases you back
    climb = clamp(climb, -SHIP.climbSpeed * clamp((s.y - SHIP.floor) / 80, 0, 1), SHIP.climbSpeed * clamp((SHIP.ceiling - s.y) / 80, 0, 1));
    if (s.y < SHIP.floor) climb = (SHIP.floor - s.y) * 2;
    if (s.y > SHIP.ceiling) climb = (SHIP.ceiling - s.y) * 2;
    s.vy += (climb - s.vy) * damp(SHIP.climbResponse, dt);
    const dist = Math.hypot(s.x, s.z);
    if (dist > SHIP.worldRadius) { const k = ((dist - SHIP.worldRadius) * 1.5 * dt) / dist; s.vx -= s.x * k; s.vz -= s.z * k; }

    // integrate and collide
    const bx = s.x + s.vx * dt, bz = s.z + s.vz * dt;
    let nx = bx, nz = bz; s.y += s.vy * dt;
    [nx, nz] = pushOutOfCliffs(world, nx, nz, s.y, SHIP.radius);
    [nx, nz] = pushOutOfColliders(world, nx, nz, SHIP.radius * 0.7, s.y);
    const px = nx - bx, pz = nz - bz, pl = Math.hypot(px, pz);
    if (pl > 1e-6) { const nX = px / pl, nZ = pz / pl, vn = s.vx * nX + s.vz * nZ; if (vn < 0) { s.vx -= nX * vn; s.vz -= nZ * vn; } }
    s.x = nx; s.z = nz;

    const under = shipFloor(s);
    if (under) {
      const wantsDown = v < 0, cushion = wantsDown ? 0 : SHIP.hoverClearance;
      if (s.y < under.floor + cushion) s.y = lerp(s.y, under.floor + cushion, damp(wantsDown ? 40 : 7, dt));
      if (s.y <= under.floor) { s.y = under.floor; s.vy = Math.max(s.vy, 0); }
      const touching = s.y <= under.floor + 0.6;
      if (touching && wantsDown) {
        if (under.clear) { const skid = Math.exp(-7 * dt); s.vx *= skid; s.vz *= skid; }
        if (under.clear && Math.hypot(s.vx, s.vz) < SHIP.landSpeed) {
          s.landed = true; s.y = under.ground; s.vx = s.vy = s.vz = s.yawRate = 0;
          const isl = islandAt(world, s.x, s.z);
          emit("landed", { ship: s.id, island: isl?.id ?? null });
          if (s.autoLand) { s.autoLand = null; startExit(s); }
        }
      }
    }

    // visual attitude only: bank into turns, nose follows throttle and climb
    const spNow = Math.hypot(s.vx, s.vz) / SHIP.maxSpeed;
    s.throttle = lerp(s.throttle, Math.abs(f) || (spNow > 0.1 ? 0.3 : 0.12), damp(4, dt));
    s.bank = lerp(s.bank, clamp(s.yawRate * (0.1 + spNow * 0.26), -0.5, 0.5), damp(5, dt));
    s.tilt = lerp(s.tilt, clamp(s.vy / 500, -0.2, 0.2) - f * 0.05 * (1 - spNow), damp(4, dt));
  }

  function startExit(s) {
    const spot = findDismountSpot(world, s.x, s.z, s.yaw);
    if (!spot) { emit("cant_exit", { reason: "no room" }); return false; }
    const p = state.player;
    state.mode = "exiting";
    state.hop = { t: 0, from: [p.x, p.y, p.z], to: [spot.x, spot.z] };
    p.yaw = Math.atan2(spot.x - s.x, spot.z - s.z);
    return true;
  }

  /** What pressing E would do now: {action, text} or null. */
  function currentPrompt() {
    if (state.mode === "walk") { const s = boardableShip(); return s ? { action: "board", ship: s.id, text: `Board the ${s.name}` } : null; }
    if (state.mode !== "fly") return null;
    const s = riding();
    if (s.landed) return { action: "exit", text: "Jump out" };
    if (s.autoLand) return { action: "cancel", text: "Cancel landing" };
    const ground = groundAt(world, s.x, s.z);
    if (ground !== null && s.y - ground < SHIP.autoLandMaxHeight) return { action: "land", text: "Land and jump out" };
    return null;
  }

  function interact() {
    const prompt = currentPrompt();
    if (!prompt) { if (state.mode === "fly") emit("cant_land", { reason: "no ground below" }); return; }
    if (prompt.action === "board") {
      const s = shipById(prompt.ship), p = state.player;
      state.mode = "boarding"; state.shipId = s.id;
      state.hop = { t: 0, from: [p.x, p.y, p.z], to: null };
    } else if (prompt.action === "exit") {
      startExit(riding());
    } else if (prompt.action === "cancel") {
      riding().autoLand = null; emit("autoland_cancelled");
    } else if (prompt.action === "land") {
      const s = riding(), spot = findLandingSpot(world, s.x, s.z);
      if (!spot) { emit("cant_land", { reason: "no clear spot" }); return; }
      s.autoLand = spot; emit("autoland", { x: spot.x, z: spot.z });
    }
  }

  function stepHop(dt) {
    const h = state.hop, s = riding(), p = state.player;
    h.t = Math.min(1, h.t + dt / HOP.duration);
    const toX = h.to ? h.to[0] : s.x, toZ = h.to ? h.to[1] : s.z;
    const isl = h.to ? islandAt(world, toX, toZ) : null;
    const toY = h.to ? surfaceHeight(isl, toX - isl.x, toZ - isl.z) : s.y + SHIP.deckY;
    const e = h.t * h.t * (3 - 2 * h.t);
    p.x = lerp(h.from[0], toX, e); p.z = lerp(h.from[2], toZ, e);
    p.y = lerp(h.from[1], toY, h.t) + Math.sin(h.t * Math.PI) * HOP.height;
    if (h.to === null) p.yaw += angleDiff(p.yaw, s.yaw) * damp(10, dt);
    p.speed = 0;
    if (h.t < 1) return;
    state.hop = null;
    if (h.to === null) { state.mode = "fly"; p.vx = p.vy = p.vz = 0; emit("boarded", { ship: s.id }); }
    else {
      state.mode = "walk"; state.shipId = null; p.vx = p.vy = p.vz = 0; p.grounded = true;
      state.island = isl.id; emit("jumped_out", { island: isl.id });
    }
  }

  function step(input = {}, dt = STEP) {
    state.time += dt;
    const ePressed = !!input.e && !prevE, jumpPressed = !!input.space && !prevSpace;
    prevE = !!input.e; prevSpace = !!input.space;
    if (ePressed) interact();

    if (state.mode === "walk") stepWalk(input, dt, jumpPressed);
    else if (state.mode === "boarding" || state.mode === "exiting") stepHop(dt);
    if (state.mode === "fly") {
      const s = riding(), p = state.player;
      stepShip(s, input, dt);
      if (state.mode === "fly") { p.x = s.x; p.y = s.y + SHIP.deckY; p.z = s.z; p.yaw = s.yaw; }
    }
    // propellers run while the ship is flying
    for (const s of state.ships) s.prop = (s.prop + (s === riding() && !s.landed ? 6 + s.throttle * 40 : 0) * dt) % (Math.PI * 2);

    stepCritters(state, world, dt, R);

    const focus = state.mode === "fly" ? riding() : state.player;
    const here = islandAt(world, focus.x, focus.z);
    if ((here?.id ?? null) !== state.island) {
      state.island = here?.id ?? null;
      if (here) emit("arrived", { island: here.id, name: here.name });
    }
    state.prompt = currentPrompt();
  }

  /** Run for `seconds` with the given input held. */
  function advance(seconds, input = {}) {
    const n = Math.round(seconds / STEP);
    for (let i = 0; i < n; i++) step(input);
  }

  return { world, state, events, step, advance, riding, shipById };
}
