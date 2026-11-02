// Models added for this game, painted with the same Builder and palette as the tech demo's models (engine/models.js).
// They register into the same MODELS table, so modelGeometry("airship_skiff") works like any other model.
// Same conventions: centred in x/z, y = 0 at the floor, front +z; vehicles and airships face +x.
import { CLOTHC, ROOF, shade } from "../engine/geo.js";
import { MODELS, C, lantern, railing } from "../engine/models.js";

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

/** The player's little airship: a boat hull on skids, slung under a striped envelope, a brass boiler at the stern. */
function airshipSkiff(b) {
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
  // envelope: slot-coloured stripes, so each ship can have its own cloth
  const Y = 28.5;
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
  // rigging between the hull and the envelope
  for (const x of [-8, 0, 8]) for (const s of [-1, 1]) b.beam([x, yd + 1.5, s * 4], [x * 1.25, Y - 8, s * 5.5], 0.13, C.rope);
  b.beam([14.5, yd, 0], [18, Y - 6, 0], 0.13, C.rope); b.beam([-13, yd, 0], [-18, Y - 7, 0], 0.13, C.rope);
  lantern(b, 13, yd + 0.4, 0, 0.7);
  lantern(b, 0, Y - 9.6, 0, 0.7);
  // little outrigger pods for the side propellers
  for (const s of [-1, 1]) { b.beam([-3, yd - 1, s * 4.2], [-3, yd + 1.5, s * 9], 0.3, C.iron); b.cyl(-3, yd + 0.5, s * 9, 0.9, yd + 2.5, 0.9, 6, BRASS); }
}

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

Object.assign(MODELS, { airship_skiff: airshipSkiff, airship_prop: airshipProp, fence, scarecrow, landing_pad: landingPad });
export const PROP_POSITIONS = [[-15.4, 8.4, 0], [-3, 7.6, -9], [-3, 7.6, 9]];   // where propellers go on the skiff
