/**
 * Headless screenshots: the main way for an agent to *see* a change. Runs real Chrome with software GL.
 *
 *   bun run shot                                    # the player's start → shots/start.png
 *   bun run shot -- --views home,farm,cliff --sheet # named cameras from the level, plus shots/sheet.png
 *   bun run shot -- --level hop --views side        # any level
 *   bun run shot -- --scenario fly_to_market        # play a scenario, one PNG per `shot` step
 *   bun run shot -- --cam 0,500,400:0,330,0         # any camera, position:target
 *   bun run shot -- --eval "game.advance(2,'w')"    # run JS in the page first
 *   bun run shot -- --size 1600x900 --hq --out shots/x --nohud --timeout 240
 *
 * Prints page errors, stats and the game snapshot, so regressions show up as text too.
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { openGame } from "./browser";

const ROOT = resolve(import.meta.dir, "..");
const args = process.argv.slice(2);
const opt = (k: string, d?: string) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const flag = (k: string) => args.includes(k);
const scenario = opt("--scenario");
const views = opt("--views")?.split(",") ?? [];
const [W, H] = (opt("--size") ?? "1280x800").split("x").map(Number);
const outDir = resolve(ROOT, opt("--out") ?? "shots");
const level = opt("--level") ?? "main";
mkdirSync(outDir, { recursive: true });

let failed = false;
let close = () => {};
try {
  const page = await openGame({ params: `level=${level}&paused${flag("--hq") ? "" : "&low"}`, width: W, height: H, timeout: Number(opt("--timeout") ?? 240) });
  close = page.close;
  const { send, evalJS, logs } = page;
  if (flag("--nohud")) await evalJS("game.fx({ hud: false })");
  if (opt("--eval") && !flag("--eval-after")) console.log("eval:", JSON.stringify(await evalJS(opt("--eval")!)));
  const files: string[] = [];
  const capture = async (name: string) => {
    await Bun.sleep(150);   // let the real-time loop draw once more
    const shot = await send("Page.captureScreenshot", { format: "png" });
    const file = resolve(outDir, `${name}.png`); writeFileSync(file, Buffer.from(shot.result.data, "base64")); files.push(file);
    console.log("wrote", file);
  };
  if (scenario) {
    let r = await evalJS(`game.scenario(${JSON.stringify(scenario)})`);
    while (r) { await capture(r.shot); r = await evalJS("game.scenarioNext()"); }
    console.log(`scenario ${scenario}: finished`);
  } else if (opt("--cam")) {
    const [p, q] = opt("--cam")!.split(":"); await evalJS(`game.cam([${p}],[${q}])`); await capture(opt("--name") ?? "custom");
  } else if (views.length) {
    for (const v of views) { await evalJS(`game.view(${JSON.stringify(v)})`); await capture(v); }
  } else { await evalJS("game.render()"); await capture(opt("--name") ?? "start"); }
  console.log("stats", JSON.stringify(await evalJS("game.stats()")));
  if (flag("--sheet") && files.length > 1) {
    const html = `<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(${Math.min(3, files.length)},1fr);gap:4px">${files.map((f) => `<img style="width:100%" src="data:image/png;base64,${readFileSync(f).toString("base64")}">`).join("")}</body>`;
    await send("Page.navigate", { url: "about:blank" }); await Bun.sleep(300);   // leave the game page first: a paused page never produces a frame to capture
    await evalJS(`document.documentElement.innerHTML = ${JSON.stringify(html)}; new Promise(r => setTimeout(r, 600))`);
    const s = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }); writeFileSync(resolve(outDir, "sheet.png"), Buffer.from(s.result.data, "base64")); console.log("wrote", resolve(outDir, "sheet.png"));
  }
  if (logs.length) { console.log(logs.slice(0, 20).join("\n")); if (logs.some((l) => l.startsWith("EXCEPTION") || l.startsWith("console.error"))) failed = true; }
} catch (e: any) { console.error("FAILED:", e.message); failed = true; } finally { close(); }
process.exit(failed ? 1 : 0);
