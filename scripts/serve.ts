/** Static server (no build step). `bun run dev` → http://localhost:3012 (PORT overrides). */
import { resolve, normalize } from "node:path";

const ROOT = resolve(import.meta.dir, "..");

export function serve(port = Number(process.env.PORT ?? 3012)) {
  return Bun.serve({
    port,
    async fetch(req) {
      let p = decodeURIComponent(new URL(req.url).pathname);
      if (p === "/") p = "/index.html";
      const file = normalize(resolve(ROOT, "." + p));
      if (!file.startsWith(ROOT)) return new Response("forbidden", { status: 403 });
      const f = Bun.file(file);
      if (!(await f.exists())) return new Response("not found", { status: 404 });
      return new Response(f, { headers: { "cache-control": "no-store" } });
    },
  });
}

if (import.meta.main) {
  const s = serve();
  console.log(`Mist Isles → http://localhost:${s.port}/   (?level=main|flat|hop|mist|gallery, &view=<name>, &low, &noao, &noshadow, &paused)`);
}
