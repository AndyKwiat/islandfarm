/** Headless Chrome driven over the DevTools protocol, shared by shot.ts and e2e.ts. Serves the project on a free port. */
import { serve } from "./serve";

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export async function openGame({ params = "", width = 1280, height = 800, timeout = 240 } = {}) {
  const server = serve(0);
  const port = 9400 + Math.floor(Math.random() * 500);
  const profile = `${process.env.TMPDIR ?? "/tmp"}/islandfarm-chrome-${process.pid}`;
  const chrome = Bun.spawn([process.env.CHROME ?? CHROME, "--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-first-run",
    `--remote-debugging-port=${port}`, `--window-size=${width},${height}`, `--user-data-dir=${profile}`, "about:blank"], { stdout: "ignore", stderr: "ignore" });
  const close = () => { chrome.kill(); server.stop(true); };
  // An agent must never hang on this: give up after a while, loudly.
  setTimeout(() => { console.error(`FAILED: gave up after ${timeout} s`); close(); process.exit(1); }, timeout * 1000);

  let page: any;
  for (let i = 0; i < 80 && !page; i++) { await Bun.sleep(150); page = (await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json()).catch(() => [])).find((x: any) => x.type === "page"); }
  if (!page) throw new Error("chrome did not start");
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map<number, (v: any) => void>(), logs: string[] = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(String(m.data));
    if (d.id && pending.has(d.id)) { pending.get(d.id)!(d); pending.delete(d.id); }
    if (d.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(d.params.type)) logs.push(`console.${d.params.type}: ${d.params.args.map((a: any) => a.value ?? a.description).join(" ")}`);
    if (d.method === "Runtime.exceptionThrown") logs.push("EXCEPTION " + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text));
  };
  const send = (method: string, p = {}) => new Promise<any>((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params: p })); });
  const evalJS = async (expr: string) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? "eval failed"); return r.result?.result?.value; };
  await send("Runtime.enable"); await send("Page.enable");
  await send("Page.navigate", { url: `http://127.0.0.1:${server.port}/?${params}` });
  const t0 = Date.now();
  while (!(await evalJS("window.game && (window.game.ready || window.game.error) ? true : false").catch(() => false))) { if (Date.now() - t0 > 180000) throw new Error("page never became ready: " + logs.join("\n")); await Bun.sleep(300); }
  const err = await evalJS("window.game.error || ''"); if (err) throw new Error("page error: " + err);
  console.log(`ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const KEY: Record<string, [string, number]> = { w: ["KeyW", 87], a: ["KeyA", 65], s: ["KeyS", 83], d: ["KeyD", 68], e: ["KeyE", 69], m: ["KeyM", 77], space: ["Space", 32], shift: ["ShiftLeft", 16] };
  const key = (name: string, type: "keyDown" | "keyUp") => send("Input.dispatchKeyEvent", { type, code: KEY[name][0], windowsVirtualKeyCode: KEY[name][1], key: name === "space" ? " " : name });
  return {
    send, evalJS, logs, close,
    /** Hold real keyboard keys for some real time. */
    async hold(names: string, ms: number) { const list = names.split(","); for (const k of list) await key(k, "keyDown"); await Bun.sleep(ms); for (const k of list) await key(k, "keyUp"); },
    /** Press a real key once. */
    async tap(name: string) { await key(name, "keyDown"); await Bun.sleep(60); await key(name, "keyUp"); await Bun.sleep(60); },
    /** Drag with the real mouse. */
    async drag(dx: number, dy = 0) {
      const x = width / 2, y = height / 2;
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
      for (let i = 1; i <= 5; i++) await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x + (dx * i) / 5, y: y + (dy * i) / 5, button: "left", buttons: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x + dx, y: y + dy, button: "left", clickCount: 1 });
    },
  };
}
