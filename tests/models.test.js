// Model geometry: closed shapes must face outward, or you see the inside of them.
import { describe, test, expect } from "bun:test";
import { Builder } from "../src/engine/geo.js";
import { spindle } from "../src/engine/models.js";
import { envelope } from "../src/render/customModels.js";

/** Signed volume of a triangle list: positive when the faces wind outward. */
function signedVolume(g) {
  const p = g.attributes.position.array; let v = 0;
  for (let i = 0; i < p.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = p.slice(i, i + 9);
    v += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
  }
  return v / 6;
}
/** Every face of a shape along x must point away from that axis (or along it, at the tips). */
function inwardFaces(g, cy) {
  const p = g.attributes.position.array, n = g.attributes.normal.array; let bad = 0;
  for (let i = 0; i < p.length; i += 9) {
    const my = (p[i + 1] + p[i + 4] + p[i + 7]) / 3 - cy, mz = (p[i + 2] + p[i + 5] + p[i + 8]) / 3;
    if (n[i + 1] * my + n[i + 2] * mz < -1e-6) bad++;
  }
  return bad;
}

describe("balloons face outward", () => {
  for (const [name, paint] of [
    ["skiff envelope", (b) => envelope(b, -25, 25, 28, 10, 12, ["#ff0000", "#ffffff"])],
    ["cargo ship envelope", (b) => spindle(b, -22, 26, 34, 12.5, 10, ["#e0c890"])],
  ]) {
    test(name, () => {
      const b = new Builder(); paint(b); const g = b.build();
      expect(signedVolume(g)).toBeGreaterThan(0);
      expect(inwardFaces(g, name.startsWith("skiff") ? 28 : 34)).toBe(0);
    });
  }
});
