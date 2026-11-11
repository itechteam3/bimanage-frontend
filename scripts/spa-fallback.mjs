// GitHub Pages serves 404.html for unknown paths. Making it a copy of
// index.html lets the client-side router handle deep links such as
// /bimanage-frontend/oauth/callback?token=… and /invite/accept?token=…
// (GitHub still answers with HTTP 404, which browsers render normally).
import { copyFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dist = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const index = resolve(dist, "index.html");
if (!existsSync(index)) {
  console.error("spa-fallback: dist/index.html not found — run vite build first");
  process.exit(1);
}
copyFileSync(index, resolve(dist, "404.html"));
console.log("spa-fallback: dist/404.html written");
