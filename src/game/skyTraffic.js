// Life in the sky: airships on their rounds and birds in flocks. Pure maths: positions are a function of time alone, so this
// needs no state and is cheap to run. Scenery only: nothing here touches the player.
//
//   createSkyTraffic(world, level.sky) → { ships: [...], flocks: [...] }
//   shipPose(ship, t) → { x, y, z, yaw, bank }        birdPose(flock, i, t) → { x, y, z, yaw, bank, phase, amp }
//
// Every route is an ellipse, generated from the seed and kept only if it clears all cliffs, buildings, gondola ropes and other
// ships. To add a type: paint a model in src/render/customModels.js, add it to SHIP_TYPES or BIRD_TYPES, ask for some in the level.
import { cliffRadius, rimRadius } from "./world.js";
import { PROPS } from "./props.js";
import { rng } from "./rng.js";

const TAU = Math.PI * 2;

// radius and height: how much room the model takes. y: the altitudes it likes. speed: units per second. looks: per-ship colours.
const CLOTHS = ["#e8583e", "#3a8ad0", "#3aa060", "#e0a830", "#8a4ab0", "#2aa0a0", "#d04a6a"], TRIMS = ["#2a8aa0", "#d8b040", "#c8342a", "#3a3440"];
const look = (R) => ({ cloth: CLOTHS[Math.floor(R() * CLOTHS.length)], roof: TRIMS[Math.floor(R() * TRIMS.length)] });
export const SHIP_TYPES = {
  airship_small: { radius: 14, height: 44, y: [420, 960], speed: [18, 30] },
  airship_cargo: { radius: 28, height: 48, y: [620, 980], speed: [34, 48] },
  airship_skiff: { radius: 26, height: 42, y: [340, 760], speed: [70, 110], looks: true },
  airship_junk: { radius: 38, height: 58, y: [400, 860], speed: [36, 56], looks: true },
  airship_dragon: { radius: 62, height: 50, y: [520, 940], speed: [44, 66], looks: true },
  airship_paddle: { radius: 36, height: 62, y: [470, 900], speed: [30, 46], looks: true },
  airship_liner: { radius: 46, height: 66, y: [680, 1040], speed: [26, 38], looks: true },
  airship_ornithopter: { radius: 24, height: 14, y: [320, 800], speed: [64, 96], looks: true, flap: 3.2, flapAmp: 0.55 },
  airship_barge: { radius: 24, height: 56, y: [440, 860], speed: [20, 32], looks: true },
};

// rate: wingbeats per second. amp: how far the wings swing. habit: where it flies (see routeFor). formation: how a flock holds together.
export const BIRD_TYPES = {
  swallow: { model: "bird_swallow", rate: 7, amp: 0.8, speed: [52, 74], radius: 34, habit: "around", formation: "swirl", spread: 26 },
  finch: { model: "bird_finch", rate: 11, amp: 0.85, speed: [36, 50], radius: 24, habit: "around", formation: "swirl", spread: 16 },
  pigeon: { model: "bird_pigeon", rate: 5, amp: 0.7, speed: [38, 54], radius: 30, habit: "around", formation: "swirl", spread: 22 },
  goose: { model: "bird_goose", rate: 2.6, amp: 0.5, speed: [52, 68], radius: 70, habit: "highway", formation: "vee", spacing: 15 },
  crane: { model: "bird_crane", rate: 1.7, amp: 0.45, speed: [38, 52], radius: 90, habit: "highway", formation: "vee", spacing: 24 },
  eagle: { model: "bird_eagle", rate: 1.5, amp: 0.4, speed: [30, 44], radius: 22, habit: "soar", formation: "solo", glide: true },
  roc: { model: "bird_roc", rate: 0.7, amp: 0.34, speed: [46, 60], radius: 60, habit: "skyway", formation: "solo", glide: true },
  lantern: { model: "sky_lantern", rate: 0, amp: 0, speed: [5, 9], radius: 40, habit: "drift", formation: "cloud", spread: 46 },
};

/** Point on a route at angle a. */
function routePoint(r, a) {
  const px = Math.cos(a) * r.rx, pz = Math.sin(a) * r.rz, c = Math.cos(r.tilt), s = Math.sin(r.tilt);
  return [r.cx + px * c - pz * s, r.cz + px * s + pz * c];
}
const AVG = (r) => (r.rx + r.rz) / 2;

/** Where along its route something is at time t, with its heading and a lean into the bend. */
function routePose(r, t) {
  const a = r.phase + r.dir * (t * r.speed) / AVG(r), [x, z] = routePoint(r, a), [x2, z2] = routePoint(r, a + r.dir * 0.02);
  return { x, z, yaw: Math.atan2(x2 - x, z2 - z), a };
}

export function shipPose(ship, t) {
  const r = ship.route, p = routePose(r, t);
  return { x: p.x, y: r.y + Math.sin(t * 0.3 + r.phase) * 5, z: p.z, yaw: p.yaw, bank: r.dir * Math.min(0.14, (r.speed / AVG(r)) * 1.6), flapPhase: t * (ship.type.flap ?? 0) * TAU };
}

/** Position of bird i of a flock at time t. */
export function birdPose(flock, i, t) {
  const r = flock.route, type = flock.type, p = routePose(r, t), [hx, hz] = [Math.sin(p.yaw), Math.cos(p.yaw)], m = flock.members[i];
  let x = p.x, y = r.y, z = p.z, yaw = p.yaw;
  if (type.formation === "swirl") {
    // a loose cloud, every bird on its own little wander
    const s = type.spread, ox = Math.sin(t * m.a + m.p) * s, oy = Math.sin(t * m.b + m.q) * s * 0.4, oz = Math.cos(t * m.c + m.r) * s;
    x += ox; y += oy; z += oz;
    yaw += Math.sin(t * m.a * 1.3 + m.q) * 0.5;
  } else if (type.formation === "vee") {
    // leader in front, the others stepping back along both arms of the V
    const rank = Math.ceil(i / 2), side = i % 2 ? 1 : -1, back = rank * type.spacing, wide = side * rank * type.spacing * 0.7;
    x += -hx * back + hz * wide + Math.sin(t * 0.7 + i) * 0.8; z += -hz * back - hx * wide + Math.cos(t * 0.6 + i) * 0.8; y += Math.sin(t * 0.5 + i * 1.7) * 1.4;
  } else if (type.formation === "cloud") {
    x += m.ox; z += m.oz; y += m.oy + Math.sin(t * 0.4 + m.p) * 3;
  }
  // flapping; big birds mostly glide, with a few beats now and then
  let amp = type.amp;
  if (type.glide) amp = Math.sin(t * 0.17 + m.p) > 0.45 ? type.amp : 0.05;
  const bank = type.formation === "solo" ? r.dir * Math.min(0.5, (r.speed / AVG(r)) * 7) : 0;
  return { x, y, z, yaw, bank, phase: t * type.rate * TAU + m.p, amp };
}

/** Does a route keep clear of everything solid? */
function clearOfWorld(route, room, height, world, tallest) {
  const n = 72;
  for (let k = 0; k < n; k++) {
    const [x, z] = routePoint(route, (k / n) * TAU);
    for (const isl of world.islands) {
      const dx = x - isl.x, dz = z - isl.z, d = Math.hypot(dx, dz), th = Math.atan2(dz, dx);
      if (route.y < isl.top + tallest.get(isl.id) + 12) {
        // not above this island's roofs: it must stay outside its cliffs, measured at the ship's lowest point
        const wall = route.y >= isl.top ? rimRadius(isl, th) : cliffRadius(isl, th, route.y);
        if (d < wall + room + 10) return false;
      }
    }
    for (const g of world.gondolas) {
      const ax = g.from[0], az = g.from[2], bx = g.to[0], bz = g.to[2], l2 = (bx - ax) ** 2 + (bz - az) ** 2, u = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / l2));
      const ropeY = g.from[1] + (g.to[1] - g.from[1]) * u;
      if (Math.hypot(x - ax - (bx - ax) * u, z - az - (bz - az) * u) < room + 8 && route.y - 40 < ropeY + 8 && route.y + height > ropeY - 40) return false;
    }
  }
  return true;
}

/** Could two ships on these routes ever touch? Points are spaced closer than the ships are wide, so none can slip between them. */
function clearOfShip(a, roomA, heightA, b, roomB, heightB) {
  if (a.y > b.y + heightB + 8 || b.y > a.y + heightA + 8) return true;   // never at the same height
  const need = roomA + roomB + 8, reachA = Math.max(a.rx, a.rz), reachB = Math.max(b.rx, b.rz);
  if (Math.hypot(a.cx - b.cx, a.cz - b.cz) > reachA + reachB + need) return true;
  const count = (r) => Math.min(240, Math.ceil((TAU * Math.max(r.rx, r.rz)) / need) + 8), nA = count(a), nB = count(b), pts = [];
  for (let j = 0; j < nB; j++) pts.push(routePoint(b, (j / nB) * TAU));
  for (let i = 0; i < nA; i++) { const [x, z] = routePoint(a, (i / nA) * TAU); for (const [u, v] of pts) if (Math.hypot(x - u, z - v) < need * 1.5) return false; }
  return true;
}

/** A candidate route for a bird's habit. */
function routeFor(habit, type, world, R) {
  const rnd = (a, b) => a + R() * (b - a), isl = world.islands[Math.floor(R() * world.islands.length)];
  const base = { tilt: rnd(0, TAU), phase: rnd(0, TAU), dir: R() < 0.5 ? -1 : 1, speed: rnd(type.speed[0], type.speed[1]) };
  if (habit === "around") { const r = isl.outerRadius + rnd(46, 130); return { ...base, cx: isl.x, cz: isl.z, rx: r, rz: r * rnd(0.85, 1), y: isl.top + rnd(10, 70) }; }
  if (habit === "soar") { const r = rnd(110, 280); return { ...base, cx: isl.x, cz: isl.z, rx: r, rz: r * rnd(0.8, 1), y: isl.top + rnd(110, 260) }; }
  if (habit === "highway") { const r = rnd(500, 1500); return { ...base, cx: rnd(-1000, 1000), cz: rnd(-1000, 1000), rx: r, rz: r * rnd(0.5, 1), y: rnd(470, 860) }; }
  if (habit === "skyway") { const r = rnd(700, 1700); return { ...base, cx: rnd(-600, 600), cz: rnd(-600, 600), rx: r, rz: r * rnd(0.6, 1), y: rnd(760, 1050) }; }
  /* drift */ const r = rnd(60, 280); return { ...base, cx: isl.x, cz: isl.z, rx: r, rz: r * rnd(0.7, 1), y: isl.top + rnd(70, 200) };
}

export function createSkyTraffic(world, spec) {
  const out = { ships: [], flocks: [] }; if (!spec) return out;
  const R = rng(spec.seed ?? 8), rnd = (a, b) => a + R() * (b - a), tallest = new Map(world.islands.map((i) => [i.id, 0]));
  for (const p of world.props) tallest.set(p.island, Math.max(tallest.get(p.island), (PROPS[p.model]?.h ?? 0) * p.scale));
  // one big ring first would leave the small ones nowhere to go: give the most room-hungry types first pick
  const wanted = Object.entries(spec.ships ?? {}).sort((a, b) => SHIP_TYPES[b[0]].radius - SHIP_TYPES[a[0]].radius);
  for (const [model, count] of wanted) {
    const type = SHIP_TYPES[model]; if (!type) throw new Error(`no ship type "${model}"`);
    for (let n = 0; n < count; n++) {
      for (let attempt = 0; attempt < 400; attempt++) {
        // a third of the routes loop round an island, the rest cross the map; high up is always easier, so failure drifts upward
        const centre = R() < 0.35 ? world.islands[Math.floor(R() * world.islands.length)] : null, big = rnd(320, 1900);
        const y = Math.min(type.y[1] + 60, rnd(type.y[0], type.y[1]) + attempt * 0.4);
        const route = { cx: centre ? centre.x : rnd(-1500, 1500), cz: centre ? centre.z : rnd(-1500, 1500), rx: big, rz: big * rnd(0.45, 1), tilt: rnd(0, TAU), y, phase: rnd(0, TAU), dir: R() < 0.5 ? -1 : 1, speed: rnd(type.speed[0], type.speed[1]) };
        if (!clearOfWorld(route, type.radius, type.height, world, tallest)) continue;
        if (!out.ships.every((o) => clearOfShip(route, type.radius, type.height, o.route, o.type.radius, o.type.height))) continue;
        out.ships.push({ model, type, route, colors: type.looks ? look(R) : null });
        break;
      }
    }
  }
  for (const f of spec.flocks ?? []) {
    const type = BIRD_TYPES[f.type]; if (!type) throw new Error(`no bird type "${f.type}"`);
    for (let n = 0; n < f.flocks; n++) {
      for (let attempt = 0; attempt < 200; attempt++) {
        const route = routeFor(type.habit, type, world, R);
        if (!clearOfWorld(route, type.radius, 10, world, tallest)) continue;
        const size = Math.round(rnd(f.size[0], f.size[1]));
        const members = Array.from({ length: size }, () => {
          const s = type.spread ?? 0;
          return { a: rnd(0.25, 0.6), b: rnd(0.3, 0.7), c: rnd(0.25, 0.6), p: rnd(0, TAU), q: rnd(0, TAU), r: rnd(0, TAU), ox: rnd(-s, s), oz: rnd(-s, s), oy: rnd(-s * 0.5, s * 0.5) };
        });
        out.flocks.push({ species: f.type, type, route, members });
        break;
      }
    }
  }
  return out;
}
