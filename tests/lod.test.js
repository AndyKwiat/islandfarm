// Level of detail and adaptive quality decisions.
import { describe, test, expect } from "bun:test";
import { lodLevel, nextQuality, rimDistance } from "../src/game/lod.js";
import { LOD, QUALITY } from "../src/game/config.js";
import { compileLevel } from "../src/game/world.js";
import { LEVELS } from "../src/levels/index.js";
import { bakedModel, bakedProxy, mergeBaked } from "../src/render/bake.js";
import { MODELS, modelGeometry } from "../src/engine/models.js";
import "../src/render/customModels.js";

describe("LOD levels", () => {
  test("detail falls with distance", () => {
    expect(lodLevel(0)).toBe(0); expect(lodLevel((LOD.near + LOD.mid) / 2)).toBe(1); expect(lodLevel(LOD.mid * 3)).toBe(2);
  });
  test("no flicker: small moves around a boundary don't switch back and forth", () => {
    expect(lodLevel(LOD.near + 5, 0)).toBe(0);
    expect(lodLevel(LOD.near - 5, 1)).toBe(1);
    expect(lodLevel(LOD.mid + 5, 1)).toBe(1);
    expect(lodLevel(LOD.mid - 5, 2)).toBe(2);
    expect(lodLevel(LOD.near + LOD.hysteresis + 1, 0)).toBe(1);
    expect(lodLevel(LOD.near - LOD.hysteresis - 1, 1)).toBe(0);
  });
  test("standing on an island is full detail, wherever on it", () => {
    const w = compileLevel(LEVELS.main), isl = w.byId.palace;
    expect(rimDistance(isl, isl.x, isl.top + 10, isl.z)).toBe(0);
    expect(lodLevel(rimDistance(isl, isl.x + isl.radius, isl.top + 30, isl.z))).toBe(0);
  });
  test("adaptive quality steps down when slow, holds when fast, stops at the bottom", () => {
    expect(nextQuality(1 / 20, 0, 4)).toBe(1); expect(nextQuality(1 / 60, 1, 4)).toBe(1); expect(nextQuality(1 / 10, 4, 4)).toBe(4);
    expect(QUALITY[QUALITY.length - 1].ao).toBe(false);
  });
});

describe("baking", () => {
  test("a proxy is far smaller than the model and stays inside its bounds", () => {
    for (const name of ["home1", "pagoda", "palace_great_hall", "tree_round", "stall", "manor"]) {
      const p = bakedProxy(name), box = modelGeometry(name).boundingBox;
      expect(p.P.length / 9).toBeLessThanOrEqual(36);
      expect(p.P.length).toBeLessThan(bakedModel(name).P.length / 2);
      for (let i = 0; i < p.P.length; i += 3) { expect(p.P[i]).toBeGreaterThanOrEqual(box.min.x - 0.01); expect(p.P[i]).toBeLessThanOrEqual(box.max.x + 0.01); }
    }
  });
  test("no model has a face with no colour (the Builder paints those magenta)", () => {
    for (const name of Object.keys(MODELS)) {
      const c = modelGeometry(name).attributes.color.array;
      for (let i = 0; i < c.length; i += 3) if (c[i] === 1 && c[i + 1] === 0 && c[i + 2] === 1) throw new Error(`${name} has an unpainted face`);
    }
  });
  test("tiny props have no proxy at all", () => { expect(bakedProxy("lantern_post")).toBeNull(); });
  test("every model can be baked", () => { for (const name of Object.keys(MODELS)) expect(bakedModel(name).C.length).toBe(modelGeometry(name).attributes.color.array.length); });
  test("colour slots are resolved per prop", () => {
    const red = bakedModel("home1", { roof: "#ff0000" }).C, blue = bakedModel("home1", { roof: "#0000ff" }).C;
    expect(red).not.toEqual(blue); expect(bakedModel("home1", { roof: "#ff0000" })).toBe(bakedModel("home1", { roof: "#ff0000" }));
  });
  test("merging places and turns pieces", () => {
    const b = { P: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), N: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]), C: new Float32Array(9) };
    const g = mergeBaked([{ baked: b, x: 10, y: 20, z: 30, rot: 1 }, { baked: null, x: 0, y: 0, z: 0 }]);
    const p = g.attributes.position.array;
    expect(p.length).toBe(9); expect(p[0]).toBeCloseTo(10, 5); expect(p[2]).toBeCloseTo(29, 5);   // quarter turn: (1, 0) → (0, -1)
  });
});
