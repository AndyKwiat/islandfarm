// Turns a compiled island (game/world.js) into meshes: a grassy top with a painted ground texture, a jagged banded cliff
// dropping into the mist, and scattered ground cover. Everything comes from the island's seed, so it is stable.
//
// Ground paint (level data, island.paint[]):
//   { kind: "path", points: [[x, z], ...], width }     packed earth, local coordinates
//   { kind: "plaza", x, z, r }                         flagstones
// Fields (level data, fields[]) paint tilled soil here as well; game/world.js levels the ground beneath them.
import * as THREE from "three";
import { Builder } from "../engine/geo.js";
import { rimRadius, surfaceHeight, cliffRadius, islandAt, isClear } from "../game/world.js";
import { MIST } from "../game/config.js";
import { rng, clamp } from "../game/rng.js";
import { rockMat, plainMat } from "./materials.js";

const TAU = Math.PI * 2;
const ROCK = ["#b4afa4", "#a8a49a", "#bdb7aa", "#a09d96", "#aea89c", "#9c9a94"];
const MOSS = ["#6a8f50", "#5d8248", "#74985a"];

/** Painted ground canvas for an island: local (x, z) maps to pixels at `S` per unit. */
function groundCanvas(isl, world, res) {
  const half = isl.outerRadius + 4, S = clamp(res / half, 1, 5), size = Math.ceil(half * 2 * S);
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"); g.setTransform(S, 0, 0, S, half * S, half * S);
  const R = rng(isl.seed + 9), rnd = (a, b) => a + R() * (b - a), pick = (a) => a[Math.floor(R() * a.length)];
  // grass with soft patches and flower specks: the same recipe as the tech demo's ground texture
  g.fillStyle = "#6cbc4a"; g.fillRect(-half, -half, half * 2, half * 2);
  const area = half * half * 4;
  for (let i = 0; i < area / 170; i++) { g.fillStyle = pick(["#66b646", "#72c050", "#6ab848", "#5eae42"]); g.beginPath(); g.ellipse(rnd(-half, half), rnd(-half, half), rnd(6, 26), rnd(5, 18), rnd(0, 3), 0, TAU); g.fill(); }
  for (let i = 0; i < area / 50; i++) { g.fillStyle = pick(["#ffffff", "#ffe050", "#ff90b0", "#b0c8ff"]); g.beginPath(); g.arc(rnd(-half, half), rnd(-half, half), 0.32, 0, TAU); g.fill(); }
  for (const p of isl.paint) {
    if (p.kind === "path") {
      g.lineCap = g.lineJoin = "round";
      for (const [w, col] of [[p.width + 2, "#b89a6c"], [p.width, "#cdb084"], [p.width * 0.45, "#d6bc92"]]) {
        g.strokeStyle = col; g.lineWidth = w; g.beginPath(); p.points.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z))); g.stroke();
      }
    } else if (p.kind === "plaza") {
      g.save(); g.beginPath(); g.arc(p.x, p.z, p.r, 0, TAU); g.fillStyle = "#b8a47c"; g.fill(); g.clip();
      for (let z = -p.r; z < p.r; z += 4) for (let x = -p.r + ((z + p.r) / 4 % 2 ? 3 : 0); x < p.r; x += 6) { g.fillStyle = pick(["#e2d2a8", "#dccb9e", "#e8dab4", "#ddcca0"]); g.fillRect(p.x + x + 0.25, p.z + z + 0.25, 5.5, 3.5); }
      g.restore();
    }
  }
  for (const f of world.fields.filter((f) => f.island === isl.id)) {
    const x0 = f.x - f.w / 2, z0 = f.z - f.d / 2;
    g.fillStyle = "#9a7040"; g.fillRect(x0 - 2, z0 - 2, f.w + 4, f.d + 4);
    g.fillStyle = "#b8844a"; g.fillRect(x0, z0, f.w, f.d);
    g.fillStyle = "#9a6a38"; const rowGap = f.crop === "wheat" ? 3 : 5;
    for (let z = z0 + 1; z < z0 + f.d; z += rowGap) g.fillRect(x0, z, f.w, 1.2);
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return { tex, half };
}

/** The top: concentric rings with flat-shaded facets, heights straight from surfaceHeight so the mesh matches physics. */
function topMesh(isl, tex, half, seg) {
  const ringStep = 13, rings = Math.max(3, Math.round(isl.radius / ringStep));
  const R = rng(isl.seed + 3), P = [], N = [], UV = [];
  const vert = [];
  for (let k = 1; k <= rings; k++) {
    const row = [];
    for (let i = 0; i < seg; i++) {
      // every other ring is staggered half a segment; the outermost is not, so it meets the cliff vertex for vertex
      const theta = ((i + ((rings - k) % 2) * 0.5) / seg) * TAU, f = k / rings, jitter = k < rings ? 0.012 : 0;
      const r = rimRadius(isl, theta) * f * (1 + (R() - 0.5) * jitter * 2 / f), x = Math.cos(theta) * r, z = Math.sin(theta) * r;
      row.push([x, surfaceHeight(isl, x, z), z]);
    }
    vert.push(row);
  }
  const push = (a, b, c) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (const p of [a, b, c]) { P.push(p[0], p[1], p[2]); N.push(nx, ny, nz); UV.push((p[0] + half) / (2 * half), 1 - (p[2] + half) / (2 * half)); }
  };
  const centre = [0, surfaceHeight(isl, 0, 0), 0];
  for (let i = 0; i < seg; i++) push(centre, vert[0][(i + 1) % seg], vert[0][i]);
  for (let k = 0; k < rings - 1; k++) {
    const A = vert[k], B = vert[k + 1], odd = (rings - (k + 1)) % 2 === 0;
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      // the rings are staggered by half a segment, so stitch them in zig-zag
      if (odd) { push(A[i], A[j], B[i]); push(A[j], B[j], B[i]); }
      else { push(A[i], A[j], B[j]); push(A[i], B[j], B[i]); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
  return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex }));
}

/** The cliff: rings of jittered points stepping down past the bottom of the mist, ledges every few rings, moss on the ledges. */
function cliffMesh(isl, rimTheta) {
  const b = new Builder(), seg = rimTheta.length, R = rng(isl.seed + 7), bottom = MIST.bottom - 60;
  const noiseAt = (i, j) => { const n = rng(isl.seed * 31 + i * 101 + j * 7919)(); return n - 0.5; };
  const blockAt = (i, j) => noiseAt(Math.floor(i / 3) + (j % 2), j + 900);   // chunks a few segments wide: reads as blocks of rock
  const rows = [];
  // a little grass lip first: the top face folds over the edge
  rows.push({ y: null, r: 0, lip: true });
  let depth = 4, j = 0;
  while (isl.top - depth > bottom) {
    const y = isl.top - depth, ledge = j % 3 === 2;
    rows.push({ y, depth, ledge, j });
    depth += ledge ? 3 + R() * 3 : 11 + R() * 15;
    j++;
  }
  rows.push({ y: bottom, depth: isl.top - bottom, j: j + 1 });
  const P = rows.map((row, k) => rimTheta.map((theta, i) => {
    if (row.lip) { const r = rimRadius(isl, theta); return [Math.cos(theta) * r, surfaceHeight(isl, Math.cos(theta) * r, Math.sin(theta) * r), Math.sin(theta) * r]; }
    const y = row.y + noiseAt(i, row.j + 500) * 5 * (k === 1 ? 0.2 : 1);
    const wobble = noiseAt(i, row.j) * 3.5 + blockAt(i, row.j) * 11 + noiseAt(i >> 2, row.j >> 2) * 9;
    const r = cliffRadius(isl, theta, y) + (k === 1 ? 0.4 : wobble - (row.ledge ? 5 : 0));
    return [Math.cos(theta) * r, y, Math.sin(theta) * r];
  }));
  const colAt = (cy, ny, i, k) => {
    if (k === 0) return "#5ea644";                // the grass folding over the edge
    const h = rng(Math.floor(i / 2) * 13 + k * 97 + isl.seed)();
    if (ny > 0.6) return MOSS[Math.floor(h * MOSS.length)];
    return ROCK[Math.floor(h * ROCK.length)];
  };
  const tri = (a, c, d, i, k) => {
    const ux = c[0] - a[0], uy = c[1] - a[1], uz = c[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let ny = uz * vx - ux * vz; const nx = uy * vz - uz * vy, nz = ux * vy - uy * vx; ny /= Math.hypot(nx, ny, nz) || 1;
    b.tri(a, c, d, colAt((a[1] + c[1] + d[1]) / 3, ny, i, k));
  };
  for (let k = 0; k < P.length - 1; k++) for (let i = 0; i < seg; i++) {
    const j2 = (i + 1) % seg, a = P[k][i], c = P[k][j2], dd = P[k + 1][j2], e = P[k + 1][i];
    tri(a, c, e, i, k); tri(c, dd, e, i, k);
  }
  const mesh = new THREE.Mesh(b.build(), rockMat);
  return mesh;
}

/** Small instanced ground cover: tufts and flowers, the same little meshes as the tech demo. */
function tuftGeometry() {
  const b = new Builder();
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU;
    b.tri([Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5], [Math.cos(a + 1.2) * 0.5, 0, Math.sin(a + 1.2) * 0.5], [Math.cos(a + 0.6) * 0.9, 1.6 + k * 0.3, Math.sin(a + 0.6) * 0.9], "#ffffff");
    b.tri([Math.cos(a + 0.6) * 0.9, 1.6 + k * 0.3, Math.sin(a + 0.6) * 0.9], [Math.cos(a + 1.2) * 0.5, 0, Math.sin(a + 1.2) * 0.5], [Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5], "#cccccc");
  }
  const g = b.build();
  // normals straight up: tufts take the light of the ground they stand on, instead of going dark on their shaded side
  const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}
const bushGeo = (() => { let g = null; return () => { if (!g) { const b = new Builder(); b.blob(0, 1.2, 0, 1.9, 1.5, 1.9, ["#ffffff", "#e8e8e8", "#ffffff"], { seed: 3, jitter: 0.22, flat: -0.5 }); g = b.build(); } return g; }; })();
const rockGeo = (() => { let g = null; return () => { if (!g) { const b = new Builder(); b.blob(0, 0.6, 0, 2.2, 1.7, 1.9, ["#7a7c82", "#8c8e94", "#9ea0a4", "#a8aaa8"], { seed: 5, jitter: 0.28, flat: -0.35 }); g = b.build(); } return g; }; })();
const tuftGeo = (() => { let g = null; return () => (g ??= tuftGeometry()); })();

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), C3 = new THREE.Color(), UP = new THREE.Vector3(0, 1, 0);
function scatter(group, geo, pts, shadow) {
  if (!pts.length) return;
  const im = new THREE.InstancedMesh(geo, plainMat, pts.length);
  pts.forEach(({ x, y, z, s = 1, sy = 1, yaw, c }, i) => { Q.setFromAxisAngle(UP, yaw); im.setMatrixAt(i, M4.compose(V.set(x, y, z), Q, S.set(s, s * sy, s))); im.setColorAt(i, C3.set(c)); });
  im.castShadow = shadow; im.receiveShadow = true; group.add(im);
}

function groundCover(isl, world, group) {
  const R = rng(isl.seed + 21), rnd = (a, b) => a + R() * (b - a), pick = (a) => a[Math.floor(R() * a.length)];
  const fieldsHere = world.fields.filter((f) => f.island === isl.id);
  const pads = world.props.filter((p) => p.island === isl.id && p.model === "landing_pad").map((p) => [p.x - isl.x, p.z - isl.z]);
  const onPainted = (lx, lz) => pads.some(([x, z]) => Math.hypot(lx - x, lz - z) < 23) || fieldsHere.some((f) => Math.abs(lx - f.x) < f.w / 2 + 3 && Math.abs(lz - f.z) < f.d / 2 + 3)
    || isl.paint.some((p) => (p.kind === "plaza" ? Math.hypot(lx - p.x, lz - p.z) < p.r + 1 : p.points.some((q, i) => { if (!i) return false; const [ax, az] = p.points[i - 1], [bx, bz] = q, t = clamp(((lx - ax) * (bx - ax) + (lz - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2), 0, 1); return Math.hypot(lx - ax - (bx - ax) * t, lz - az - (bz - az) * t) < p.width / 2 + 1; })));
  const spot = (margin) => {
    for (let t = 0; t < 6; t++) {
      const a = R() * TAU, r = Math.sqrt(R()) * isl.outerRadius, lx = Math.cos(a) * r, lz = Math.sin(a) * r, x = isl.x + lx, z = isl.z + lz;
      if (islandAt(world, x, z, margin) !== isl || onPainted(lx, lz) || !isClear(world, x, z, 2)) continue;
      return { x, z, y: surfaceHeight(isl, lx, lz) };
    }
    return null;
  };
  const area = Math.PI * isl.radius * isl.radius, tufts = [], bushes = [], rocks = [];
  for (let i = 0; i < area * 0.024 * isl.grass; i++) { const p = spot(2); if (p) tufts.push({ ...p, yaw: rnd(0, 6.28), s: rnd(0.6, 1.1), c: pick(["#5aaa40", "#6cbc4a", "#4e9a38", "#90d866"]) }); }
  for (let i = 0; i < area * 0.0014 * isl.grass; i++) { const p = spot(5); if (p) bushes.push({ ...p, yaw: rnd(0, 6.28), s: rnd(0.8, 1.6), sy: rnd(0.7, 1.1), c: pick(["#3aa848", "#2e8a3a", "#4cb85a", "#58c060", "#3a9a40", "#f8b8c8", "#f0e060"]) }); }
  // boulders along the rim: a hint that the edge is the edge
  const nRim = Math.round(isl.radius * 0.28 * Math.min(1, isl.grass * 2));
  for (let i = 0; i < nRim; i++) {
    const a = R() * TAU, r = rimRadius(isl, a) - rnd(1, 5), lx = Math.cos(a) * r, lz = Math.sin(a) * r, x = isl.x + lx, z = isl.z + lz;
    if (!isClear(world, x, z, 3) || onPainted(lx, lz)) continue;
    rocks.push({ x, z, y: surfaceHeight(isl, lx, lz) - 0.4, yaw: rnd(0, 6.28), s: rnd(0.8, 2.4), sy: rnd(0.7, 1.2), c: pick(["#ffffff", "#e0e0e0", "#c8c8c8"]) });
  }
  scatter(group, tuftGeo(), tufts, false);
  scatter(group, bushGeo(), bushes, true);
  scatter(group, rockGeo(), rocks, true);
}

/** Build one island's group, positioned in the world. */
export function buildIsland(isl, world, groundRes) {
  const group = new THREE.Group(); group.name = "island:" + isl.id;
  const { tex, half } = groundCanvas(isl, world, groundRes);
  const seg = clamp(Math.round(isl.radius * 0.5), 28, 110);
  const top = topMesh(isl, tex, half, seg); top.receiveShadow = true; top.castShadow = false;
  const thetas = Array.from({ length: seg }, (_, i) => (i / seg) * TAU);
  const cliff = cliffMesh(isl, thetas); cliff.receiveShadow = true; cliff.castShadow = true;
  const holder = new THREE.Group(); holder.position.set(isl.x, 0, isl.z); holder.add(top, cliff);
  group.add(holder);
  groundCover(isl, world, group);
  return group;
}

/** Crops on the fields: the demo's cabbage and wheat. */
export function buildCrops(world) {
  const group = new THREE.Group(); group.name = "crops";
  const cab = new Builder(); cab.blob(0, 0.6, 0, 1.1, 0.8, 1.1, ["#d8d8d8", "#ffffff"], { seed: 6, jitter: 0.15, flat: -0.6 });
  const wh = new Builder();
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI, dx = Math.cos(a) * 0.35, dz = Math.sin(a) * 0.35, t = 2.6 + k * 0.4;
    wh.tri([-dx, 0, -dz], [dx, 0, dz], [dx * 0.2, t, dz * 0.2], "#e0e0e0"); wh.tri([dx * 0.2, t, dz * 0.2], [dx, 0, dz], [-dx, 0, -dz], "#c8c8c8");
    wh.tri([-dx * 0.9, t - 1.2, -dz * 0.9], [dx * 0.9, t - 1.2, dz * 0.9], [0, t + 0.6, 0], "#ffffff"); wh.tri([0, t + 0.6, 0], [dx * 0.9, t - 1.2, dz * 0.9], [-dx * 0.9, t - 1.2, -dz * 0.9], "#f0f0f0");
  }
  const geos = { cabbage: cab.build(), wheat: wh.build() }, cols = { cabbage: ["#58c060", "#3aa848", "#7ad870"], wheat: ["#e8c048", "#d8b038", "#f0d060"] };
  const R = rng(77), rnd = (a, b) => a + R() * (b - a);
  const pts = { cabbage: [], wheat: [] };
  for (const f of world.fields) {
    const isl = world.byId[f.island], wheat = f.crop === "wheat";
    for (let z = f.z - f.d / 2 + 2; z < f.z + f.d / 2 - 1; z += wheat ? 3 : 5) for (let x = f.x - f.w / 2 + 2; x < f.x + f.w / 2 - 1; x += wheat ? 2 : 4) {
      const lx = x + rnd(-0.4, 0.4), s = wheat ? rnd(0.9, 1.25) : rnd(0.85, 1.25);
      pts[f.crop].push({ x: isl.x + lx, z: isl.z + z, y: surfaceHeight(isl, lx, z), yaw: rnd(0, 6.28), s, c: cols[f.crop][Math.floor(R() * 3)] });
    }
  }
  for (const k of Object.keys(pts)) scatter(group, geos[k], pts[k], true);
  return group;
}
