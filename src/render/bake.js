// Static props get baked: one island's props merge into one mesh with their colour slots resolved, so an island costs a
// single draw call and is culled as a whole. Far away a model is replaced by its proxy: three stacked boxes, generated from
// the model itself, in its own colours. Nothing to author: any model in engine/models.js gets one automatically.
import * as THREE from "three";
import { Builder, SLOT_DEFAULT, SLOTS } from "../engine/geo.js";
import { modelGeometry } from "../engine/models.js";

const SLOT_NAMES = Object.fromEntries(Object.entries(SLOTS).map(([k, v]) => [v, k]));
const C = new THREE.Color();
const bakedCache = new Map(), proxyCache = new Map();
const keyOf = (model, colors) => model + "|" + (colors ? JSON.stringify(colors) : "");

/** Vertex data for a model with these colours: {P, N, C}, colour slots multiplied in. */
export function bakedModel(model, colors) {
  const key = keyOf(model, colors); let b = bakedCache.get(key); if (b) return b;
  const g = modelGeometry(model), P = g.attributes.position.array, N = g.attributes.normal.array, src = g.attributes.color.array, slot = g.attributes.aSlot.array;
  const out = new Float32Array(src.length);
  const tint = {}; for (const [id, name] of Object.entries(SLOT_NAMES)) { C.set(colors?.[name] ?? SLOT_DEFAULT[name]); tint[id] = [C.r, C.g, C.b]; }
  for (let v = 0; v < slot.length; v++) {
    const t = slot[v] > 0.5 ? tint[Math.round(slot[v])] : null;
    for (let i = 0; i < 3; i++) out[v * 3 + i] = t ? src[v * 3 + i] * t[i] : src[v * 3 + i];
  }
  b = { P, N, C: out }; bakedCache.set(key, b); return b;
}

/**
 * The far-away stand-in for a model: its bottom, middle and top thirds as boxes with that part's footprint and colour, or
 * null if it is too small to matter from a distance. Colours favour faces that look up, since that is what you see from a
 * ship. About 30 triangles, whatever the model was.
 */
export function bakedProxy(model, colors) {
  const key = keyOf(model, colors); if (proxyCache.has(key)) return proxyCache.get(key);
  const m = bakedModel(model, colors), box = modelGeometry(model).boundingBox;
  const area = (box.max.x - box.min.x) * (box.max.z - box.min.z);
  if (area < 60) { proxyCache.set(key, null); return null; }
  const TIERS = 3, h = Math.max(0.01, box.max.y - box.min.y), bins = Array.from({ length: TIERS }, () => ({ x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, r: 0, g: 0, b: 0, w: 0 }));
  const { P, N, C: col } = m;
  for (let v = 0; v + 8 < P.length; v += 9) {
    const cy = (P[v + 1] + P[v + 4] + P[v + 7]) / 3, bin = bins[Math.min(TIERS - 1, Math.floor(((cy - box.min.y) / h) * TIERS))];
    for (let k = 0; k < 3; k++) { const x = P[v + k * 3], z = P[v + k * 3 + 2]; bin.x0 = Math.min(bin.x0, x); bin.x1 = Math.max(bin.x1, x); bin.z0 = Math.min(bin.z0, z); bin.z1 = Math.max(bin.z1, z); }
    const ux = P[v + 3] - P[v], uy = P[v + 4] - P[v + 1], uz = P[v + 5] - P[v + 2], wx = P[v + 6] - P[v], wy = P[v + 7] - P[v + 1], wz = P[v + 8] - P[v + 2];
    const a = Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx) * (0.25 + Math.max(0, N[v + 1]));
    bin.r += col[v] * a; bin.g += col[v + 1] * a; bin.b += col[v + 2] * a; bin.w += a;
  }
  const b = new Builder();
  bins.forEach((t, i) => {
    if (!t.w) return;
    const y0 = box.min.y + (h * i) / TIERS, y1 = box.min.y + (h * (i + 1)) / TIERS, top = i === TIERS - 1;
    const inset = top ? [(t.x1 - t.x0) * 0.32, (t.z1 - t.z0) * 0.32] : 0;
    b.box(t.x0, y0, t.z0, t.x1, y1, t.z1, [t.r / t.w, t.g / t.w, t.b / t.w], { bottom: false, inset });
  });
  const g = b.build(), p = { P: g.attributes.position.array, N: g.attributes.normal.array, C: g.attributes.color.array };
  proxyCache.set(key, p); return p;
}

const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), NM = new THREE.Matrix3(), A = new THREE.Vector3();

/** Merge placed pieces [{ baked: {P, N, C}, x, y, z, rot (quarter turns), scale }] into one geometry. Null if there are none. */
export function mergeBaked(items) {
  const list = items.filter((i) => i.baked);
  const total = list.reduce((n, i) => n + i.baked.P.length, 0); if (!total) return null;
  const P = new Float32Array(total), N = new Float32Array(total), Cc = new Float32Array(total); let o = 0;
  for (const it of list) {
    Q.setFromAxisAngle(UP, ((it.rot ?? 0) * Math.PI) / 2); M.compose(V.set(it.x, it.y, it.z), Q, S.setScalar(it.scale ?? 1)); NM.getNormalMatrix(M);
    const { P: p, N: n, C: c } = it.baked;
    for (let v = 0; v < p.length; v += 3, o += 3) {
      A.set(p[v], p[v + 1], p[v + 2]).applyMatrix4(M); P[o] = A.x; P[o + 1] = A.y; P[o + 2] = A.z;
      A.set(n[v], n[v + 1], n[v + 2]).applyMatrix3(NM).normalize(); N[o] = A.x; N[o + 1] = A.y; N[o + 2] = A.z;
      Cc[o] = c[v]; Cc[o + 1] = c[v + 1]; Cc[o + 2] = c[v + 2];
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(P, 3)); g.setAttribute("normal", new THREE.BufferAttribute(N, 3)); g.setAttribute("color", new THREE.BufferAttribute(Cc, 3));
  g.computeBoundingSphere();
  return g;
}
