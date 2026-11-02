/**
 * End-to-end check with REAL keyboard and mouse events through the real-time loop, in headless Chrome: walk → board → fly →
 * land → jump out. Slow (software GL, about a minute); covers what `bun test` can't: input.js, main.js, the render loop.
 *
 *   bun run e2e
 */
import { openGame } from "./browser";

let failed = 0, close = () => {};
const check = (name: string, ok: boolean, detail: unknown = "") => { console.log(`${ok ? "ok  " : "FAIL"} ${name}`, ok ? "" : JSON.stringify(detail)); if (!ok) failed++; };

try {
  const page = await openGame({ params: "level=hop&low&noao&noshadow", width: 800, height: 500 });
  close = page.close;
  const snap = () => page.evalJS("game.snapshot()");
  // software GL runs at a few frames per second, so give every action real time and poll for the result
  const waitFor = async (what: string, test: (s: any) => boolean, ms = 15000) => { const t0 = Date.now(); let s; do { s = await snap(); if (test(s)) { check(what, true); return s; } await Bun.sleep(200); } while (Date.now() - t0 < ms); check(what, false, s); return s; };

  await page.evalJS(`new Promise((resolve) => { let n = 0; const tick = () => (++n > 3 ? resolve() : requestAnimationFrame(tick)); tick(); })`);
  check("real-time loop is running", true);
  const before = await snap();

  await page.hold("w", 1500);
  const moved = await snap();
  check("W moves the character", Math.hypot(moved.player[0] - before.player[0], moved.player[2] - before.player[2]) > 5, moved);

  const yaw0 = await page.evalJS("game.rig.yaw");
  await page.drag(120, 0);
  check("dragging the mouse turns the camera", Math.abs((await page.evalJS("game.rig.yaw")) - yaw0) > 0.1);

  check("the minimap is on screen", await page.evalJS("(() => { const r = document.getElementById('minimap').getBoundingClientRect(); return r.width > 100 && r.right <= innerWidth && r.bottom <= innerHeight && r.right > innerWidth - 30 && r.bottom > innerHeight - 30; })()"));
  await page.tap("m");
  check("M opens the map screen", await page.evalJS("game.map() && getComputedStyle(document.getElementById('mapscreen')).display === 'flex'"));
  await page.tap("m");
  check("M closes it again", await page.evalJS("!game.map() && getComputedStyle(document.getElementById('mapscreen')).display === 'none'"));

  await page.evalJS("(() => { const s = game.state.ships[0], p = game.state.player; p.x = s.x + 10; p.z = s.z; p.vx = p.vz = 0; })()");
  await waitFor("next to the ship, E is offered", (s) => s.prompt === "board");
  await page.tap("e");
  const aboard = await waitFor("E boards the ship", (s) => s.mode === "fly");

  await page.hold("space", 2000);
  const up = await snap();
  check("Space climbs", up.ship?.pos[1] > aboard.ship.pos[1] + 30, up);

  const yawShip = await page.evalJS("game.state.ships[0].yaw");
  await page.hold("a", 700);
  check("A turns the ship", Math.abs((await page.evalJS("game.state.ships[0].yaw")) - yawShip) > 0.3);

  await page.tap("e");
  await waitFor("E from the air lands and jumps out", (s) => s.mode === "walk" && s.island !== null, 30000);

  const errors = page.logs.filter((l) => l.startsWith("EXCEPTION") || l.startsWith("console.error"));
  check("no page errors", errors.length === 0, errors);
} catch (e: any) { console.error("FAILED:", e.message); failed++; } finally { close(); }
console.log(failed ? `${failed} check(s) failed` : "e2e OK");
process.exit(failed ? 1 : 0);
