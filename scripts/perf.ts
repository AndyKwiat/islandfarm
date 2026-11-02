/**
 * Performance benchmark: draw calls and triangles from fixed cameras, plus CPU cost of the simulation.
 * Counts are exact and comparable between runs. Render times come from software GL, so only compare them to each other.
 *
 *   bun run perf       # exits 1 above the budget below (MAX_DRAWS, MAX_TRIS override it)
 */
import { openGame } from "./browser";
import { createGame } from "../src/game/game.js";
import { LEVELS } from "../src/levels/index.js";

// Fails above these, so a change that quietly undoes the batching or the LOD gets noticed. Raise them on purpose, not by accident.
const BUDGET = { drawCalls: Number(process.env.MAX_DRAWS ?? 180), triangles: Number(process.env.MAX_TRIS ?? 500000) };

const g = createGame(LEVELS.main), t0 = performance.now(); g.advance(60, { camYaw: 0 });
console.log(`simulation: 60 s of game in ${(performance.now() - t0).toFixed(0)} ms, level build included in page load below`);

let failed = false, close = () => {};
try {
  const page = await openGame({ params: "level=main&paused&low", width: 1280, height: 800 }); close = page.close;
  console.log("load (ms, cumulative):", JSON.stringify(await page.evalJS("game.loadTimes")));
  const shots: [string, string][] = [
    ["on foot at home", "game.cam(); game.advance(1)"],
    ["on foot in a town", "game.teleport('silk', 0, 12); game.advance(1)"],
    ["looking across the isles", "game.view('home')"],
    ["over the centre, high", "game.cam([0, 800, 900], [0, 300, -600])"],
    ["whole world from afar", "game.view('overview')"],
  ];
  const rows: any[] = [];
  for (const [name, setup] of shots) {
    await page.evalJS(`${setup}; 0`);
    const r = await page.evalJS(`(() => { const t = performance.now(); const gl = game.renderer.getContext(), px = new Uint8Array(4); for (let i = 0; i < 3; i++) { game.render(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } const ms = (performance.now() - t) / 3; const s = game.stats(); return { draws: s.drawCalls, tris: s.triangles, ms: Math.round(ms) }; })()`);
    rows.push({ view: name, drawCalls: r.draws, triangles: r.tris, "ms (software)": r.ms });
    if (r.draws > BUDGET.drawCalls || r.tris > BUDGET.triangles) failed = true;
  }
  console.table(rows);
  const errors = page.logs.filter((l) => l.startsWith("EXCEPTION") || l.startsWith("console.error"));
  if (errors.length) { console.log(errors.join("\n")); failed = true; }
} catch (e: any) { console.error("FAILED:", e.message); failed = true; } finally { close(); }
if (failed) console.log("over budget or errors");
process.exit(failed ? 1 : 0);
