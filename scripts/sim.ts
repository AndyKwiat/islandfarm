/**
 * Headless simulation: runs a scenario with the real game logic and no browser. Fast (a minute of play in milliseconds).
 *
 *   bun run sim                               # list scenarios
 *   bun run sim -- fly_to_market              # run it, print events and a position trace
 *   bun run sim -- fly_to_market --every 2    # trace every 2 simulated seconds
 *   bun run sim -- fly_to_market --json       # machine-readable { ok, events, trace, final }
 */
import { createGame } from "../src/game/game.js";
import { SCENARIOS, runScenario } from "../src/game/scenarios.js";
import { LEVELS } from "../src/levels/index.js";

const args = process.argv.slice(2), name = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--every");
const every = Number(args[args.indexOf("--every") + 1]) || 5, json = args.includes("--json");
if (!name || !SCENARIOS[name]) { console.log("scenarios:", Object.keys(SCENARIOS).join(", ")); process.exit(name ? 1 : 0); }

const sc = SCENARIOS[name], g = createGame(LEVELS[sc.level]), trace: any[] = [];
const started = performance.now(); let next = 0, error: string | null = null;
const sample = () => { const s = g.state, f: any = g.riding() ?? s.player; trace.push({ t: +s.time.toFixed(2), mode: s.mode, island: s.island, x: +f.x.toFixed(1), y: +f.y.toFixed(1), z: +f.z.toFixed(1), speed: +Math.hypot(f.vx ?? 0, f.vz ?? 0).toFixed(0) }); };
try {
  for (const _ of runScenario(g, sc, (input) => { g.step(input); if (g.state.time >= next) { sample(); next += every; } }, (m) => { if (!json) console.log(m); })) void _;
} catch (e: any) { error = e.message; }
sample();
if (json) console.log(JSON.stringify({ ok: !error, error, events: g.events, trace, final: { mode: g.state.mode, island: g.state.island } }));
else {
  console.table(trace);
  console.log("events:", g.events.map((e) => `${e.t}s ${e.type}${(e as any).island ? ":" + (e as any).island : ""}`).join("  "));
  console.log(`${g.state.time.toFixed(1)} s simulated in ${(performance.now() - started).toFixed(0)} ms`, error ? `\nFAILED: ${error}` : "OK");
}
process.exit(error ? 1 : 0);
