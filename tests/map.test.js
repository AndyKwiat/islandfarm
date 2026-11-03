// The map shows the whole world, north up, at any size.
import { describe, test, expect } from "bun:test";
import { compileLevel } from "../src/game/world.js";
import { mapView, mapHeading, placeLabels } from "../src/game/mapView.js";
import { LEVELS } from "../src/levels/index.js";

describe("map projection", () => {
  const world = compileLevel(LEVELS.main);
  for (const [name, size, opts] of [["minimap", 190, { pad: 12, minRadius: 3 }], ["map screen", 640, { pad: 34, minRadius: 7 }]]) {
    test(`${name}: every island is fully on the map`, () => {
      const v = mapView(world, size, opts);
      for (const isl of world.islands) for (const [x, y] of v.outline(isl)) {
        expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(size);
        expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(size);
      }
    });
    test(`${name}: even the smallest island can be seen`, () => {
      const v = mapView(world, size, opts);
      for (const isl of world.islands) { const pts = v.outline(isl), xs = pts.map((p) => p[0]); expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(opts.minRadius); }
    });
  }
  test("map screen: no two island names overlap, and all stay on the map", () => {
    const v = mapView(world, 640, { pad: 34, minRadius: 7 }), measure = (t) => t.length * 6.4, H = 14;
    const labels = placeLabels(world, v, measure, { lineHeight: H });
    expect(labels.length).toBe(world.islands.length);
    const rect = (l) => ({ x0: l.x - measure(l.text) / 2, x1: l.x + measure(l.text) / 2, y0: l.y, y1: l.y + H });
    for (let i = 0; i < labels.length; i++) {
      const a = rect(labels[i]);
      expect(a.x0).toBeGreaterThanOrEqual(0); expect(a.x1).toBeLessThanOrEqual(640); expect(a.y0).toBeGreaterThanOrEqual(0); expect(a.y1).toBeLessThanOrEqual(640);
      for (let j = i + 1; j < labels.length; j++) { const b = rect(labels[j]); if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1) throw new Error(`${labels[i].text} overlaps ${labels[j].text}`); }
    }
  });
  test("every draft is on the map too", () => {
    const v = mapView(world, 190, { pad: 12 });
    expect(world.drafts.length).toBeGreaterThan(0);
    for (const d of world.drafts) { const [x, y] = v.toMap(d.x, d.z); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(190); expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(190); }
  });
  test("north (-z) is up and east (+x) is right, at one scale", () => {
    const v = mapView(world, 500), [ax, ay] = v.toMap(0, 0), [bx, by] = v.toMap(100, 0), [cx, cy] = v.toMap(0, -100);
    expect(bx).toBeGreaterThan(ax); expect(by).toBeCloseTo(ay, 6);
    expect(cy).toBeLessThan(ay); expect(cx).toBeCloseTo(ax, 6);
    expect(bx - ax).toBeCloseTo(ay - cy, 6);
  });
  test("arrows point the way you are facing", () => {
    const [x0, y0] = mapHeading(0), [x1, y1] = mapHeading(Math.PI / 2);
    expect(x0).toBeCloseTo(0, 6); expect(y0).toBeCloseTo(1, 6);    // yaw 0 faces +z: down the map
    expect(x1).toBeCloseTo(1, 6); expect(y1).toBeCloseTo(0, 6);    // yaw 90° faces +x: right
  });
  test("small test levels fit too", () => {
    for (const id of ["flat", "hop", "mist", "gallery"]) { const v = mapView(compileLevel(LEVELS[id]), 190); expect(v.scale).toBeGreaterThan(0); expect(Number.isFinite(v.scale)).toBe(true); }
  });
});
