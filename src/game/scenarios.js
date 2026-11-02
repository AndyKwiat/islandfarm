// Scripted playthroughs: the same script runs headless (`bun run sim -- <name>`), in tests (tests/scenarios.test.js)
// and in the browser for screenshots (`bun run shot -- --scenario <name>`).
//
// A scenario is { level, steps: [...] }. A step is one of:
//   { hold: "w,a", for: 2, camYaw }          hold keys for seconds
//   { wait: 1 }                              do nothing
//   { tap: "e" }                             press and release a key
//   { walkTo: [x, z] | "ship" | "island:ID" }  autopilot on foot, using real keys
//   { boardNearest: true }                   walk to the nearest ship and press E
//   { flyTo: "island:ID" | [x, z], alt }     autopilot in the air, using real keys (alt defaults to clear the target)
//   { land: true }                           press E and wait until back on foot
//   { expect: (state, game) => bool, note }  fail the scenario if false
//   { shot: "name", from?: [x,y,z], at?: [x,y,z] }   a photo stop; only the browser runner takes it
//   { do: (game) => {} }                     anything else
// Add a scenario by adding a key here. The test suite runs every scenario in this file.
import { STEP } from "./config.js";
import { walkTo, flyTo } from "./pilot.js";

const KEYS = (s) => Object.fromEntries((s ?? "").split(",").filter(Boolean).map((k) => [k.trim(), true]));

export const SCENARIOS = {
  /** Run a few steps around the home island. */
  walk_home: {
    level: "main",
    steps: [
      { expect: (s) => s.mode === "walk" && s.island === "home", note: "starts on foot at home" },
      { hold: "w", for: 1.5, camYaw: 0 },
      { hold: "d", for: 1, camYaw: 0 },
      { tap: "space" },
      { wait: 1 },
      { expect: (s) => s.island === "home" && s.player.grounded, note: "still home, back on the ground" },
      { shot: "walk_home" },
    ],
  },

  /** The main loop: board the ship at home, fly to the market, land, jump out, walk about. */
  fly_to_market: {
    level: "main",
    steps: [
      { boardNearest: true },
      { expect: (s) => s.mode === "fly", note: "aboard" },
      { shot: "aboard" },
      { hold: "w,space", for: 1.2 },
      { expect: (s, g) => !g.riding().landed, note: "took off" },
      { hold: "w,space", for: 0.8 },
      { shot: "cruise" },
      { flyTo: "island:market", alt: 480 },
      { shot: "arriving" },
      { expect: (s) => s.island === "market", note: "over the market" },
      { land: true },
      { expect: (s) => s.mode === "walk" && s.island === "market", note: "on foot at the market" },
      { shot: "at_market" },
      { hold: "w", for: 1.5, camYaw: 1 },
      { shot: "market_walk" },
    ],
  },

  /** A lap of every island in the level: the same flight an agent should check after changing the world. */
  grand_tour: {
    level: "main",
    steps: [
      { boardNearest: true },
      { hold: "w,space", for: 1.5 },
      ...["market", "pagoda", "pine", "manor", "bamboo", "station_low", "station_high", "orchard", "palace", "home"].flatMap((id) => [
        { flyTo: `island:${id}`, alt: 640 },
        { expect: (s) => s.island === id, note: `reached ${id}` },
      ]),
      { land: true },
      { expect: (s) => s.mode === "walk" && s.island === "home", note: "back home on foot" },
    ],
  },

  /** Fly straight at a cliff: the ship slides off it. */
  cliff_bump: {
    level: "hop",
    steps: [
      { boardNearest: true },
      { hold: "w", for: 8 },
      { expect: (s, g) => { const r = g.riding(); return Math.hypot(r.x - g.world.byId.b.x, r.z - g.world.byId.b.z) > g.world.byId.b.radius * 0.5 || r.y > g.world.byId.b.top; }, note: "not inside the cliff" },
    ],
  },
};

/**
 * Run a scenario step by step. A generator: yields at every `shot` step and after finishing, so a browser can take
 * pictures between yields and Node can just drain it. `stepFn(input)` advances one fixed step (the browser passes one
 * that also updates its camera rig).
 */
export function* runScenario(game, scenario, stepFn = (input) => game.step(input), log = () => {}) {
  const state = game.state;
  let camYaw = 0;
  const run = (seconds, input) => { const n = Math.round(seconds / STEP); for (let i = 0; i < n; i++) stepFn({ camYaw, ...input }); };
  const until = (limit, what, fn) => {
    const n = Math.round(limit / STEP);
    for (let i = 0; i < n; i++) { const input = fn(); if (input === null) return; if (input.camYaw !== undefined) camYaw = input.camYaw; stepFn({ camYaw, ...input }); }
    throw new Error(`scenario: ${what} did not finish in ${limit} s (mode ${state.mode}, at ${state.player.x.toFixed(0)}, ${state.player.z.toFixed(0)})`);
  };
  const target = (t) => {
    if (Array.isArray(t)) return t;
    if (t === "ship") { const s = game.state.ships[0]; return [s.x, s.z]; }
    const isl = game.world.byId[t.slice("island:".length)];
    if (!isl) throw new Error(`scenario: no island in ${t}`);
    return [isl.x, isl.z, isl];
  };

  for (const step of scenario.steps) {
    if (step.camYaw !== undefined) camYaw = step.camYaw;
    if (step.hold !== undefined) run(step.for ?? 1, KEYS(step.hold));
    else if (step.wait !== undefined) run(step.wait, {});
    else if (step.tap) { run(0.05, KEYS(step.tap)); run(0.05, {}); }
    else if (step.walkTo) { const [x, z] = target(step.walkTo); until(30, "walkTo", () => walkTo(game, x, z)); run(0.1, {}); }
    else if (step.boardNearest) {
      const nearest = () => state.ships.reduce((a, b) => (Math.hypot(a.x - state.player.x, a.z - state.player.z) < Math.hypot(b.x - state.player.x, b.z - state.player.z) ? a : b));
      const s = nearest();
      until(30, "walk to ship", () => (state.prompt?.action === "board" ? null : walkTo(game, s.x, s.z)));
      run(0.05, { e: true }); run(0.05, {});
      until(5, "boarding", () => (state.mode === "fly" ? null : {}));
    }
    else if (step.flyTo) {
      const [x, z, isl] = target(step.flyTo), alt = step.alt ?? (isl ? isl.top + 90 : game.riding().y);
      until(120, `flyTo ${step.flyTo}`, () => flyTo(game, x, z, alt, isl ? isl.radius * 0.45 : 40));
      run(0.2, {});
    }
    else if (step.land) {
      until(20, "getting low enough to land", () => (state.prompt?.action === "land" || state.prompt?.action === "exit" ? null : { shift: true }));
      run(0.05, { e: true }); run(0.05, {});
      until(30, "landing", () => (state.mode === "walk" ? null : {}));
    }
    else if (step.expect) {
      if (!step.expect(state, game)) throw new Error(`scenario expectation failed: ${step.note ?? step.expect.toString()}`);
      log(`ok: ${step.note ?? ""}`);
    }
    else if (step.do) step.do(game);
    if (step.shot) yield { shot: step.shot, from: step.from, at: step.at };
  }
}
