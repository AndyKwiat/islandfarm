// Debug overlay for agents and humans: shows what the game thinks is solid. game.fx({ debug: true }), or ?debug in the URL.
// Red: colliders. Yellow: the walkable edge of each island. Cyan: ships' board range.
import * as THREE from "three";
import { rimRadius, surfaceHeight } from "../game/world.js";
import { WALK, SHIP } from "../game/config.js";

export function buildDebug(world) {
  const group = new THREE.Group(); group.name = "debug"; group.userData.noAO = true; group.visible = false;
  const lines = (pts, color) => { const g = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)); const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, fog: false, depthTest: false, transparent: true })); m.renderOrder = 20; m.frustumCulled = false; group.add(m); };
  const circle = (out, x, z, r, y, n = 24) => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, b = ((i + 1) / n) * Math.PI * 2; out.push(x + Math.cos(a) * r, y, z + Math.sin(a) * r, x + Math.cos(b) * r, y, z + Math.sin(b) * r); } };
  const red = [], yellow = [], cyan = [];
  for (const c of world.colliders) {
    if (c.kind === "circle") circle(red, c.x, c.z, c.r, c.h, 12);
    else { const q = [[c.x0, c.z0], [c.x1, c.z0], [c.x1, c.z1], [c.x0, c.z1]]; q.forEach(([x, z], i) => { const [u, v] = q[(i + 1) % 4]; red.push(x, c.h, z, u, c.h, v); }); }
  }
  for (const isl of world.islands) {
    const n = 90, P = (i) => { const a = (i / n) * Math.PI * 2, r = rimRadius(isl, a) - WALK.edgeMargin, x = Math.cos(a) * r, z = Math.sin(a) * r; return [isl.x + x, surfaceHeight(isl, x, z) + 1, isl.z + z]; };
    for (let i = 0; i < n; i++) yellow.push(...P(i), ...P(i + 1));
  }
  for (const s of world.ships) circle(cyan, s.x, s.z, SHIP.boardRange, s.y + 1);
  lines(red, "#ff3030"); lines(yellow, "#ffe040"); lines(cyan, "#40e0ff");
  return group;
}
