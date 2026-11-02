// Small deterministic helpers shared by world generation and rendering. No dependencies, safe in Node/Bun tests.

/** Deterministic RNG in [0, 1). */
export function rng(seed = 1) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Exponential smoothing factor, framerate independent: use as lerp(a, b, damp(rate, dt)). */
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

/** Shortest signed difference a → b between two angles. */
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Move v toward target by at most maxDelta. */
export function approach(v, target, maxDelta) {
  return v < target ? Math.min(v + maxDelta, target) : Math.max(v - maxDelta, target);
}
