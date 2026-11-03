// Models added for this game, painted with the same Builder and palette as the tech demo's models (engine/models.js).
// They register into the same MODELS table, so modelGeometry("airship_skiff") works like any other model.
// Same conventions: centred in x/z, y = 0 at the floor, front +z; vehicles and airships face +x.
import { CLOTHC, ROOF, WALLC, shade } from "../engine/geo.js";
import { MODELS, C, lantern, railing, crate } from "../engine/models.js";

const BRASS = "#c8963e", BRASSD = "#8a6428", COPPER = "#b86a3a";

/** Gas envelope along x: lengthwise stripes (the demo's spindle() paints a chequerboard), a brass cap at each end. */
export function envelope(b, x0, x1, cy, rmax, n, cols) {
  const K = 12, prof = (t) => Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t))), 0.62);
  const ring = (k) => { const t = k / K, x = x0 + (x1 - x0) * t, r = rmax * prof(t * 0.96 + 0.02); return [...Array(n)].map((_, i) => { const a = (i / n) * Math.PI * 2; return [x, cy + Math.cos(a) * r, Math.sin(a) * r]; }); };
  const tip0 = [x0 - 0.4, cy, 0], tip1 = [x1 + 0.4, cy, 0]; let prev = null;
  for (let k = 0; k <= K; k++) {
    const R = ring(k);
    if (k === 0) for (let i = 0; i < n; i++) b.tri(tip0, R[(i + 1) % n], R[i], BRASS);
    if (prev) for (let i = 0; i < n; i++) { const j = (i + 1) % n; b.quad(prev[j], R[j], R[i], prev[i], cols[i % cols.length]); }
    if (k === K) for (let i = 0; i < n; i++) b.tri(tip1, R[i], R[(i + 1) % n], BRASS);
    prev = R;
  }
}

const SKIFF_Y = 28.5;   // the middle of the envelope

/** The player's little airship is two parts, so the hull can swing on its ropes: this is the boat hull on skids, with a brass boiler. */
function skiffHull(b) {
  // skids
  for (const z of [-3.6, 3.6]) {
    b.beam([-11, 0.5, z], [12, 0.5, z], 0.45, C.woodD);
    b.beam([12, 0.5, z], [14.5, 1.8, z * 0.8], 0.4, C.woodD);
    for (const x of [-7, 7]) b.beam([x, 0.5, z], [x, 2.6, z * 0.8], 0.35, C.iron);
  }
  // hull: half width at the deck per station along x
  const hull = [[-13, 2.2], [-10, 4.2], [8, 4.4], [16, 0.5]], yk = 2.2, yd = 6.2;
  for (let i = 0; i < hull.length - 1; i++) {
    const [xa, wa] = hull[i], [xb, wb] = hull[i + 1];
    b.quad([xa, yk, -wa * 0.5], [xb, yk, -wb * 0.5], [xb, yd, -wb], [xa, yd, -wa], C.wood);
    b.quad([xa, yd, wa], [xb, yd, wb], [xb, yk, wb * 0.5], [xa, yk, wa * 0.5], C.wood);
    b.quad([xa, yk, wa * 0.5], [xb, yk, wb * 0.5], [xb, yk, -wb * 0.5], [xa, yk, -wa * 0.5], C.woodD);
    b.quad([xa, yd, -wa], [xb, yd, -wb], [xb, yd, wb], [xa, yd, wa], C.woodL);
    // a painted strake along the hull
    b.quad([xa, yd - 1.3, -wa * 0.9 - 0.06], [xb, yd - 1.3, -wb * 0.9 - 0.06], [xb, yd - 0.6, -wb * 0.97 - 0.06], [xa, yd - 0.6, -wa * 0.97 - 0.06], ROOF(1));
    b.quad([xa, yd - 0.6, wa * 0.97 + 0.06], [xb, yd - 0.6, wb * 0.97 + 0.06], [xb, yd - 1.3, wb * 0.9 + 0.06], [xa, yd - 1.3, wa * 0.9 + 0.06], ROOF(1));
  }
  b.quad([-13, yk, 1.1], [-13, yk, -1.1], [-13, yd, -2.2], [-13, yd, 2.2], C.woodD);
  railing(b, [-10, -4], [8, -4.1], yd, 1.5); railing(b, [-10, 4], [8, 4.1], yd, 1.5); railing(b, [-13, -2], [-13, 2], yd, 1.5);
  // patched up over the years: mismatched planks, dangling sandbags
  for (const [x, z, w] of [[-5, 1, 1.4], [3, -1, 1.1]]) { const s = Math.sign(z), a = hull[1], side = a[1] * 0.97 + 0.08; b.quad(s > 0 ? [x - w, yd - 3, side] : [x + w, yd - 3, -side], s > 0 ? [x + w, yd - 3, side] : [x - w, yd - 3, -side], s > 0 ? [x + w, yd - 1.8, side] : [x - w, yd - 1.8, -side], s > 0 ? [x - w, yd - 1.8, side] : [x + w, yd - 1.8, -side], C.woodL); }
  for (const [x, z, h] of [[-7, 4.5, 2.2], [1, 4.6, 3], [5, -4.7, 2.5], [-3, -4.5, 1.8]]) { b.beam([x, yd + 1.3, z], [x, yd - h, z * 1.06], 0.08, C.rope); b.blob(x, yd - h - 0.5, z * 1.06, 0.7, 0.9, 0.7, "#b89a68", { seed: 4 }); }
  // brass boiler and funnels at the stern
  b.cyl(-9.5, yd, 0, 2.4, yd + 5.2, 2.4, 8, BRASS, { top: BRASSD });
  b.cyl(-9.5, yd + 1.2, 0, 2.55, yd + 1.8, 2.55, 8, COPPER, { top: false, bottom: false });
  b.cyl(-9.5, yd + 3.6, 0, 2.55, yd + 4.2, 2.55, 8, COPPER, { top: false, bottom: false });
  b.cyl(-9.5, yd + 5.2, 0, 0.8, yd + 9.5, 1.1, 6, C.iron); b.cyl(-9.5, yd + 9.5, 0, 1.2, yd + 10, 1.2, 6, BRASS);
  b.beam([-7.2, yd + 3, 0], [-3.5, yd + 0.4, 2.4], 0.3, COPPER); b.beam([-7.2, yd + 3, 0], [-3.5, yd + 0.4, -2.4], 0.3, COPPER);
  b.beam([-11.6, yd + 2, 0], [-14.6, yd - 0.4, 0], 0.55, BRASSD);   // shaft to the stern propeller
  // helm: a post and a little brass wheel
  b.cyl(6, yd, 0, 0.4, yd + 3.6, 0.3, 6, C.woodD);
  b.save(() => { b.t(5.6, yd + 3.8, 0).rz(Math.PI / 2 - 0.5); b.cyl(0, -0.2, 0, 1.3, 0.2, 1.3, 8, BRASS, { top: BRASSD }); });
  // rigging between the hull and the envelope
  for (const x of [-8, 0, 8]) for (const s of [-1, 1]) b.beam([x, yd + 1.5, s * 4], [x * 1.25, SKIFF_Y - 8, s * 5.5], 0.13, C.rope);
  b.beam([14.5, yd, 0], [18, SKIFF_Y - 6, 0], 0.13, C.rope); b.beam([-13, yd, 0], [-18, SKIFF_Y - 7, 0], 0.13, C.rope);
  lantern(b, 13, yd + 0.4, 0, 0.7);
  lantern(b, 0, SKIFF_Y - 9.6, 0, 0.7);
  // little outrigger pods for the side propellers
  for (const s of [-1, 1]) { b.beam([-3, yd - 1, s * 4.2], [-3, yd + 1.5, s * 9], 0.3, C.iron); b.cyl(-3, yd + 0.5, s * 9, 0.9, yd + 2.5, 0.9, 6, BRASS); }
}

/** ... and the striped envelope above it, with one or two patches. */
function skiffEnvelope(b) {
  const Y = SKIFF_Y;
  // envelope: slot-coloured stripes, so each ship can have its own cloth
  envelope(b, -25, 25, Y, 10, 12, [CLOTHC(1), "#f4e8c8"]);
  // brass hoops round the envelope
  for (const x of [-14, 0, 14]) { const r = 10 * Math.pow(Math.sin(Math.PI * (((x + 25) / 50) * 0.96 + 0.02)), 0.62) + 0.15;
    b.save(() => { b.t(x, Y, 0).rz(Math.PI / 2); b.cyl(0, -0.35, 0, r, 0.35, r, 12, BRASS, { top: false, bottom: false, rot: Math.PI / 2 }); }); }
  // tail fins
  for (const [dy, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const P = (x, r) => [x, Y + dy * r, dz * r];
    b.quad(P(-13, 7), P(-21, 13.5), P(-26, 13.5), P(-23, 2), ROOF(1));
    b.quad(P(-23, 2), P(-26, 13.5), P(-21, 13.5), P(-13, 7), ROOF(0.75));
  }
  // patches on the gas bag, sitting just proud of it
  for (const [x, a, w, col] of [[9, 0.55, 2.4, "#c8b890"], [-8, 2.3, 2, "#a8c0c8"], [13, -1.2, 1.7, "#d8c8a0"]]) {
    const r = 10 * Math.pow(Math.sin(Math.PI * (((x + 25) / 50) * 0.96 + 0.02)), 0.62) + 0.14, P = (dx, da) => { const q = a + da; return [x + dx, Y + Math.cos(q) * r, Math.sin(q) * r]; }, d = w / r;
    b.quad(P(-w, -d), P(w, -d), P(w, d), P(-w, d), col);
  }
}
/** The whole ship, as one mesh, for the ones flying past in the distance. */
function airshipSkiff(b) { skiffHull(b); skiffEnvelope(b); }

/** One propeller, turning about x, drawn at the origin. Spun by render/actors.js. */
function airshipProp(b) {
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2, P = (t, r) => [0, Math.cos(a + t) * r, Math.sin(a + t) * r];
    b.quad(P(0, 0.4), P(0, 4), P(0.5, 4.2), P(0.5, 0.4), C.woodL);
    b.quad(P(0.5, 0.4), P(0.5, 4.2), P(0, 4), P(0, 0.4), C.woodD);
  }
  b.save(() => { b.rz(Math.PI / 2); b.cyl(0, -0.5, 0, 0.7, 0.5, 0.7, 6, BRASS); });
}

/** A run of farm fence, 20 long along x. */
function fence(b) {
  railing(b, [-10, 0], [10, 0], 0, 2.4, C.woodL, 5);
}

/** Straw figure in an old coat. */
function scarecrow(b) {
  b.beam([0, 0, 0], [0, 11, 0], 0.35, C.woodD); b.beam([-5, 8, 0], [5, 8, 0], 0.3, C.woodD);
  b.cyl(0, 4.5, 0, 2, 9, 2.4, 6, CLOTHC(0.9), { kz: 0.6 });
  for (const s of [-1, 1]) { b.beam([s * 2, 8.2, 0], [s * 5, 7.8, 0], 0.7, CLOTHC(0.8)); b.blob(s * 5.4, 7.6, 0, 0.7, 0.7, 0.7, C.straw, { seed: 3 }); }
  b.blob(0, 10.4, 0, 1.5, 1.5, 1.5, C.straw, { seed: 4 });
  b.cone(0, 11.2, 0, 3.6, 2, 8, C.strawD, { bottomCol: shade(C.strawD, 0.8) });
}

/** A round flagstone landing pad, flush with the ground. */
function landingPad(b) {
  const ring = (r0, r1, y, col, n = 16) => { for (let k = 0; k < n; k++) { const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2, P = (a, r) => [Math.cos(a) * r, y, Math.sin(a) * r]; b.quad(P(a1, r0), P(a0, r0), P(a0, r1), P(a1, r1), k % 2 ? col : shade(col, 0.93)); } };
  b.cyl(0, 0.05, 0, 21, 0.35, 21, 16, C.stoneL, { bottom: false, top: C.stoneL });
  ring(20.8, 19, 0.4, C.stoneD); ring(9.5, 8.2, 0.4, C.red);
}

// ---------------------------------------------------------------------------------------------------------------
// sky traffic: every other kind of airship. All face +x with y = 0 at the bottom. Slots: cloth for the envelope, roof for trim.

/** A boat hull: stations [[x, half width at the deck], ...], keel at yk, deck at yd. */
function boatHull(b, stations, yk, yd, col = C.wood) {
  for (let i = 0; i < stations.length - 1; i++) {
    const [xa, wa] = stations[i], [xb, wb] = stations[i + 1];
    b.quad([xa, yk, -wa * 0.5], [xb, yk, -wb * 0.5], [xb, yd, -wb], [xa, yd, -wa], col);
    b.quad([xa, yd, wa], [xb, yd, wb], [xb, yk, wb * 0.5], [xa, yk, wa * 0.5], col);
    b.quad([xa, yk, wa * 0.5], [xb, yk, wb * 0.5], [xb, yk, -wb * 0.5], [xa, yk, -wa * 0.5], C.woodD);
    b.quad([xa, yd, -wa], [xb, yd, -wb], [xb, yd, wb], [xa, yd, wa], C.woodL);
  }
  const [x0, w0] = stations[0], [x1, w1] = stations[stations.length - 1];
  b.quad([x0, yk, w0 * 0.5], [x0, yk, -w0 * 0.5], [x0, yd, -w0], [x0, yd, w0], C.woodD);
  b.quad([x1, yk, -w1 * 0.5], [x1, yk, w1 * 0.5], [x1, yd, w1], [x1, yd, -w1], C.woodD);
}
/** A flat panel seen from both sides. */
function panel(b, pts, col, back) {
  b.poly(pts, col); b.poly([...pts].reverse(), back ?? col);
}

/** Flying junk: a Chinese hull with battened fan sails, carried by two long floats. */
function airshipJunk(b) {
  boatHull(b, [[-24, 5], [-18, 9], [14, 9], [28, 2]], 6, 14);
  b.box(-24, 14, -6.5, -12, 20, 6.5, C.wood, { top: C.woodL }); railing(b, [-24, -6.5], [-12, -6.5], 20, 1.5); railing(b, [-24, 6.5], [-12, 6.5], 20, 1.5);
  b.box(-22, 20, -3.5, -15, 24, 3.5, WALLC(1)); b.roof(-22, -15, -3.5, 3.5, 24, 2.6, { ov: 1.2, up: 0.7, bands: 2 });
  for (const [x, h, w] of [[-6, 30, 15], [8, 36, 18], [21, 24, 11]]) {
    b.beam([x, 14, 0], [x, 14 + h + 2, 0], 0.5, C.woodD);
    // a sail of ribbed panels, fanned toward the stern
    const n = 5;
    for (let i = 0; i < n; i++) {
      const y0 = 18 + (h * i) / n, y1 = 18 + (h * (i + 1)) / n, w0 = w * (0.72 + 0.28 * Math.sin(((i + 0.3) / n) * Math.PI)), w1 = w * (0.72 + 0.28 * Math.sin(((i + 1.3) / n) * Math.PI));
      panel(b, [[x + 2, y0, 0], [x + 2, y1, 0], [x - w1, y1 + 1.5, 0], [x - w0, y0 + 1.5, 0]].reverse(), i % 2 ? CLOTHC(1) : CLOTHC(0.82), CLOTHC(0.72));
      b.beam([x + 2, y1, 0], [x - w1, y1 + 1.5, 0], 0.16, C.woodD);
    }
  }
  for (const s of [-1, 1]) {
    b.save(() => { b.t(0, 0, s * 15); envelope(b, -26, 24, 8, 6, 8, ["#f0e0b8", ROOF(1)]); });
    for (const x of [-14, 10]) b.beam([x, 13, s * 8], [x, 9, s * 13], 0.4, C.woodD);
  }
  b.beam([28, 13, 0], [37, 18, 0], 0.4, C.woodD);
  lantern(b, -24, 19, 0, 0.8); lantern(b, 26, 14, 0, 0.8);
}

/** Festival dragon: a long winding gas body with a head and a tail, towing a small gondola. */
function airshipDragon(b) {
  const P = (i) => [-44 + i * 8.6, 34 + Math.sin(i * 0.95) * 3.2, Math.sin(i * 0.8) * 4.6], RAD = [1.2, 3, 5, 6.6, 7.6, 8.2, 8.2, 7.8, 7, 6.2, 5.4];
  for (let i = 0; i < 10; i++) {
    const p = P(i), q = P(i + 1);
    b.beam(p, q, RAD[i], i % 2 ? CLOTHC(1) : C.gold, 8, { r1: RAD[i + 1] });
    const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 + RAD[i], (p[2] + q[2]) / 2];
    panel(b, [[m[0] - 3, m[1] - 1, m[2]], [m[0] + 3, m[1] - 1, m[2]], [m[0] - 1.5, m[1] + 4 + RAD[i] * 0.2, m[2]]], ROOF(1), ROOF(0.8));   // back spines
    if (i >= 3 && i <= 6) panel(b, [[m[0] - 3, m[1] - RAD[i] * 2 - 0.5, m[2]], [m[0] - 1, m[1] - RAD[i] * 2 - 5, m[2]], [m[0] + 3, m[1] - RAD[i] * 2 - 0.5, m[2]]], C.gold, C.goldD);
  }
  const h = P(10);
  b.blob(h[0] + 4, h[1] + 1, h[2], 8, 5.6, 5.6, [CLOTHC(0.8), CLOTHC(1)], { seed: 4, jitter: 0.1 });       // head
  b.blob(h[0] + 10, h[1] - 0.8, h[2], 5, 3, 4, [C.gold, CLOTHC(1)], { seed: 7, jitter: 0.1 });              // snout
  for (const s of [-1, 1]) {
    b.blob(h[0] + 7, h[1] + 3.8, h[2] + s * 3.6, 1.3, 1.3, 1.3, "#fff4d8", { seed: 2 });                    // eyes
    b.blob(h[0] + 8, h[1] + 3.8, h[2] + s * 4.2, 0.6, 0.7, 0.6, C.ink, { seed: 2 });
    b.beam([h[0] + 1, h[1] + 4, h[2] + s * 2.4], [h[0] - 8, h[1] + 12, h[2] + s * 6], 0.6, C.gold, 5, { r1: 0.15 });       // horns
    b.beam([h[0] + 13, h[1] - 1, h[2] + s * 2.4], [h[0] + 19, h[1] + 3, h[2] + s * 10], 0.25, C.gold, 4, { r1: 0.08 });    // whiskers
  }
  panel(b, [[-44, 34, -0.3], [-54, 42, 0], [-58, 32, 0], [-54, 25, 0]], ROOF(1), ROOF(0.8));   // tail fan
  // gondola
  boatHull(b, [[-10, 2], [-7, 4], [6, 4], [11, 1]], 0.5, 4.5);
  railing(b, [-7, -3.8], [6, -3.8], 4.5, 1.3); railing(b, [-7, 3.8], [6, 3.8], 4.5, 1.3);
  for (const x of [-8, 0, 8]) for (const z of [-3, 3]) b.beam([x, 4.5, z], [x, 26, z * 0.7], 0.12, C.rope);
  lantern(b, 10, 8, 0, 0.7); lantern(b, -9, 8, 0, 0.7);
}

/** Steampunk paddle steamer: a broad hull, funnels, side wheels, a big envelope above. */
function airshipPaddle(b) {
  boatHull(b, [[-24, 7], [-18, 11], [14, 11], [26, 3]], 6, 14, C.woodD);
  b.box(-16, 14, -7, 10, 22, 7, WALLC(1), { top: C.woodD });
  for (let x = -13; x < 9; x += 5) for (const z of [7.06, -7.06]) b.quad(z > 0 ? [x, 17, z] : [x + 3, 17, z], z > 0 ? [x + 3, 17, z] : [x, 17, z], z > 0 ? [x + 3, 20, z] : [x, 20, z], z > 0 ? [x, 20, z] : [x + 3, 20, z], BRASS);
  b.box(-17, 22, -8, 11, 23, 8, ROOF(1), { top: ROOF(0.85) });
  for (const x of [-9, 1]) { b.cyl(x, 23, 0, 1.8, 33, 2.2, 8, C.iron, { top: C.ink }); b.cyl(x, 30, 0, 2.3, 31, 2.3, 8, COPPER, { top: false, bottom: false }); }
  for (const s of [-1, 1]) {
    b.save(() => { b.t(-4, 11, s * 12.5).rx(Math.PI / 2);
      b.cyl(0, -1.6, 0, 7, 1.6, 7, 10, ROOF(1), { top: C.woodD, bottomCol: C.woodD });
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; b.box(Math.cos(a) * 7 - 1, -1.2, Math.sin(a) * 7 - 1, Math.cos(a) * 7 + 1, 1.2, Math.sin(a) * 7 + 1, C.woodL); } });
  }
  railing(b, [14, -8], [14, 8], 14, 1.5);
  const Y = 47; envelope(b, -34, 34, Y, 13.5, 14, [CLOTHC(1), CLOTHC(1), "#f4e8c8"]);
  for (const x of [-22, -6, 10]) for (const s of [-1, 1]) b.beam([x, 23, s * 7], [x * 1.2, Y - 11, s * 7], 0.16, C.rope);
  for (const x of [-20, 0, 20]) { const r = 13.5 * Math.pow(Math.sin(Math.PI * (((x + 34) / 68) * 0.96 + 0.02)), 0.62) + 0.2; b.save(() => { b.t(x, Y, 0).rz(Math.PI / 2); b.cyl(0, -0.45, 0, r, 0.45, r, 14, BRASS, { top: false, bottom: false, rot: Math.PI / 2 }); }); }
  lantern(b, 24, 13, 0, 0.8);
}

/** Grand liner: twin envelopes over a long hull with a pagoda-roofed saloon. */
function airshipLiner(b) {
  boatHull(b, [[-32, 6], [-26, 10], [20, 10], [36, 3]], 5, 13);
  b.box(-24, 13, -7.5, 16, 21, 7.5, WALLC(1), { top: C.woodD });
  for (let x = -21; x < 14; x += 5) for (const z of [7.56, -7.56]) { const a = [x, 15.5, z], c = [x + 3, 15.5, z], d = [x + 3, 19, z], e = [x, 19, z]; if (z > 0) b.quad(a, c, d, e, C.paper); else b.quad(c, a, e, d, C.paper); }
  b.roof(-24, 16, -7.5, 7.5, 21, 5, { ov: 2.4, up: 1.4, bands: 3 });
  b.box(-12, 26, -3.5, 4, 30, 3.5, WALLC(1)); b.roof(-12, 4, -3.5, 3.5, 30, 3.6, { ov: 1.8, up: 1, bands: 2 });
  railing(b, [18, -6], [18, 6], 13, 1.5); railing(b, [-26, -7], [-26, 7], 13, 1.5);
  const Y = 50;
  for (const s of [-1, 1]) {
    b.save(() => { b.t(0, 0, s * 13); envelope(b, -38, 38, Y, 11.5, 12, [CLOTHC(1), "#f4e8c8"]);
      for (const [dy, dz] of [[1, 0], [0, 1], [0, -1]]) panel(b, [[-24, Y + dy * 7, dz * 7], [-40, Y + dy * 15, dz * 15], [-44, Y + dy * 15, dz * 15], [-36, Y + dy * 2, dz * 2]], ROOF(1), ROOF(0.75)); });
    for (const x of [-22, -4, 14]) b.beam([x, 21, s * 7], [x * 1.1, Y - 10, s * 13], 0.18, C.rope);
  }
  for (const x of [-20, 0, 20]) b.beam([x, Y, -13], [x, Y, 13], 0.5, BRASSD);
  for (let x = -22; x < 18; x += 8) lantern(b, x, 12.5, 10.3, 0.7);
  b.beam([-26, 13, 0], [-26, 28, 0], 0.25, C.woodD); panel(b, [[-26, 28, 0], [-26, 24, 0], [-36, 25.5, 0], [-36, 27.5, 0]], ROOF(1), ROOF(0.8));
}

/** Ornithopter: a one-seat flapping machine. The wings are tagged for the walk shader, so they beat. */
function airshipOrnithopter(b) {
  boatHull(b, [[-9, 1.2], [-5, 2.6], [4, 2.6], [10, 0.5]], 1, 5, C.woodL);
  b.blob(0, 7.4, 0, 1.6, 1.8, 1.6, C.skin, { seed: 3 }); b.cyl(-0.3, 4.6, 0, 1.6, 6.4, 1.4, 6, ROOF(1)); b.cone(0, 8.6, 0, 3, 1.3, 8, C.straw, { bottomCol: C.strawD });
  b.cyl(-7, 4.5, 0, 1.3, 9, 1.3, 7, BRASS, { top: BRASSD });
  panel(b, [[-9, 5, 0], [-20, 5.4, 0], [-22, 11, 0], [-14, 9, 0]].reverse(), CLOTHC(1), CLOTHC(0.8));
  panel(b, [[-8, 4.8, -0.6], [-20, 4.8, -6], [-22, 4.8, 6], [-8, 4.8, 0.6]], CLOTHC(0.9), CLOTHC(0.7));
  for (const s of [-1, 1]) {
    b.part = [s, 7, s * 1.5];
    const w = (x, z) => [x, 7, s * z];
    const a = [w(5, 1.5), w(7, 12), w(3, 22), w(-3, 19), w(-7, 8), w(-5, 1.5)];
    if (s > 0) panel(b, a, CLOTHC(1), CLOTHC(0.75)); else panel(b, [...a].reverse(), CLOTHC(1), CLOTHC(0.75));
    for (const [x, z] of [[7, 12], [3, 22], [-3, 19]]) b.beam(w(0, 1.5), w(x, z), 0.17, C.woodD);
    b.part = null;
  }
}

/** Cargo raft: a flat barge of crates under three round balloons. */
function airshipBarge(b) {
  b.box(-16, 3, -9, 16, 5.4, 9, C.wood, { top: C.woodL, bottom: C.woodD });
  for (const x of [-12, -4, 4, 12]) b.box(x - 0.3, 5.4, -9, x + 0.3, 5.6, 9, C.woodD, { bottom: false });
  for (const [x, z, n] of [[-10, -4, 5], [-9, 4, 4], [-2, -3, 5], [3, 4, 4], [10, -3, 5]]) crate(b, x, 5.4, z, n, C.woodL);
  crate(b, -2, 10.4, -3, 3.6, C.wood); b.cone(10, 5.4, 4, 3.4, 5, 7, C.hay);
  railing(b, [-16, -9], [16, -9], 5.4, 1.3); railing(b, [-16, 9], [16, 9], 5.4, 1.3);
  for (const [x, z, r, c] of [[-12, 0, 9, CLOTHC(1)], [12, 0, 9, CLOTHC(1)], [0, 0, 12, "#f4e8c8"]]) {
    const y = r === 12 ? 42 : 34;
    b.blob(x, y, z, r, r * 1.05, r, [c, c, "#f4e8c8", c], { seed: 3 + x, detail: 1, jitter: 0.03 });
    for (const [dx, dz] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) b.beam([x + dx * 1.1, 5.4, dz * 1.1], [x + dx * 0.4, y - r * 0.8, z + dz * 0.4], 0.13, C.rope);
  }
  lantern(b, 16, 5, 0, 0.7); lantern(b, -16, 5, 0, 0.7);
}

/** Paper sky lantern, floating. */
function skyLantern(b) {
  b.cyl(0, 0, 0, 1.3, 3.2, 1.9, 6, CLOTHC(1), { top: C.paper, bottomCol: "#ffd060", sideCols: [CLOTHC(1), CLOTHC(0.88)] });
}

// ---------------------------------------------------------------------------------------------------------------
// birds: front +z, centred on the origin. Wings are tagged for the walk shader (k ±3 pivots about the body axis, so they beat).

/** A bird of the given shape. span is tip to tip, len beak to tail. */
function bird(o) {
  return (b) => {
    const { span, len, body, belly = body, wing, tip = wing, tail = wing, r = len * 0.13, head = body, beak = "#d8a040", tailFork = 0, chord = len * 0.42 } = o;
    // body
    b.beam([0, 0, -len * 0.3], [0, 0, len * 0.08], r * 0.7, body, 6, { r1: r });
    b.beam([0, 0, len * 0.08], [0, r * 0.3 + (o.neckUp ?? 0), len * (o.neck ?? 0.28)], r, belly, 6, { r1: r * (o.neck ? 0.32 : 0.85) });
    const hz = len * (o.neck ?? 0.28), hy = r * 0.3 + (o.neckUp ?? 0), hr = r * (o.neck ? 0.72 : 0.9);
    b.blob(0, hy, hz, hr, hr, hr, head, { seed: 2, jitter: 0.06 });
    b.save(() => { b.t(0, hy, hz + hr * 0.6).rx(Math.PI / 2); b.cone(0, 0, 0, hr * 0.42, len * (o.beakLen ?? 0.1), 4, beak); });
    if (o.cap) b.blob(0, hy + hr * 0.75, hz, hr * 0.55, hr * 0.32, hr * 0.55, o.cap, { seed: 3 });
    // tail
    const tz = -len * 0.3, tl = len * (o.tailLen ?? 0.28), tw = o.tailWidth ?? r * 1.5;
    if (tailFork) { for (const s of [-1, 1]) panel(b, [[s * 0.12 * r, 0, tz], [s * tw, 0, tz - tl * (1 + tailFork)], [s * tw * 0.15, 0, tz - tl * 0.55]].sort((p, q) => s * (p[0] - q[0])), tail); }
    else panel(b, [[-r * 0.6, 0, tz], [-tw, 0, tz - tl], [tw, 0, tz - tl], [r * 0.6, 0, tz]], tail, o.tailUnder ?? tail);
    if (o.legs) for (const s of [-1, 1]) b.beam([s * r * 0.3, -r * 0.4, -len * 0.25], [s * r * 0.35, -r * 0.3, -len * 0.25 - o.legs], r * 0.1, "#3a3440");
    if (o.streamers) for (const [x, c] of [[-1.3, o.streamers[0]], [0, o.streamers[1]], [1.3, o.streamers[0]]]) panel(b, [[x * r * 0.5 - r * 0.2, 0, tz], [x * r * 1.2 - r * 0.15, 0, tz - tl * 3], [x * r * 1.2 + r * 0.15, 0, tz - tl * 3], [x * r * 0.5 + r * 0.2, 0, tz]], c);
    // wings: inner panel + outer panel, each one mesh seen from both sides
    for (const s of [-1, 1]) {
      b.part = [3 * s, 0, s * r * 0.5];
      const f = chord / 2, half = span / 2, q = (x, z) => [s * x, 0, z];
      const inner = [q(r * 0.5, f), q(half * 0.55, f * 0.92), q(half * 0.55, -f * 0.95), q(r * 0.5, -f)], outer = [q(half * 0.55, f * 0.92), q(half, f * 0.1), q(half * 0.92, -f * 0.5), q(half * 0.55, -f * 0.95)];
      const draw = (pts, top, under) => { const up = s > 0 ? [...pts].reverse() : pts; b.poly(up, top); b.poly([...up].reverse(), under); };
      draw(inner, wing, o.under ?? shade(wing, 0.82)); draw(outer, tip, o.tipUnder ?? shade(tip, 0.82));
      b.part = null;
    }
  };
}

Object.assign(MODELS, {
  airship_skiff: airshipSkiff, airship_skiff_hull: skiffHull, airship_skiff_envelope: skiffEnvelope, airship_prop: airshipProp, fence, scarecrow, landing_pad: landingPad,
  airship_junk: airshipJunk, airship_dragon: airshipDragon, airship_paddle: airshipPaddle, airship_liner: airshipLiner, airship_ornithopter: airshipOrnithopter, airship_barge: airshipBarge, sky_lantern: skyLantern,
  bird_swallow: bird({ span: 5.5, len: 3.6, body: "#2a3a6a", belly: "#f4e8d8", wing: "#26345e", tail: "#20284e", tailFork: 0.9, beak: "#2a1f2d", cap: "#c0483a", r: 0.42 }),
  bird_finch: bird({ span: 3.8, len: 2.6, body: "#b08a50", belly: "#f0d060", wing: "#7a5a38", tail: "#6a4a30", r: 0.5, beak: "#e0a040" }),
  bird_pigeon: bird({ span: 6.5, len: 4.2, body: "#9aa0b0", head: "#5e6c8a", wing: "#b0b4c0", tip: "#5a5e6e", tail: "#6a6e80", r: 0.72 }),
  bird_goose: bird({ span: 15, len: 10, body: "#b8ae9c", belly: "#e8e0d0", head: "#2a2a30", wing: "#a09684", tip: "#6a6254", neck: 0.62, tailLen: 0.14, r: 1.3, beak: "#2a2a30" }),
  bird_crane: bird({ span: 24, len: 16, body: "#f6f4ee", wing: "#f6f4ee", tip: "#2a2a30", head: "#f6f4ee", tail: "#2a2a30", cap: "#d8342a", neck: 0.64, neckUp: 0.6, tailLen: 0.14, legs: 9, r: 1.6, beakLen: 0.14, beak: "#c8a060", under: "#d8d4cc" }),
  bird_eagle: bird({ span: 32, len: 13, body: "#6a4a30", head: "#f4efe2", wing: "#5e4028", tip: "#3a2818", tail: "#f0ebe0", r: 1.9, beak: "#f0c040", beakLen: 0.09, tailWidth: 3, chord: 7 }),
  bird_roc: bird({ span: 92, len: 38, body: "#c8402a", belly: "#f0c040", head: "#e0a030", wing: "#d8502e", tip: "#f0c040", tail: "#c8402a", under: "#f0a040", tipUnder: "#e08020", r: 5, beak: "#f4e8c8", beakLen: 0.1, tailWidth: 8, chord: 19, cap: "#2aa0a0", streamers: ["#f0c040", "#2aa0a0"] }),
});
export const SKIFF_SWING_PIVOT = SKIFF_Y - 10;   // where the hull's ropes meet the envelope
export const PROP_POSITIONS = [[-15.4, 8.4, 0], [-3, 7.6, -9], [-3, 7.6, 9]];   // where propellers go on the skiff
