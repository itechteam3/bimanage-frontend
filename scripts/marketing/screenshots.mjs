// Product screenshots for the landing page, from the REAL app with SAMPLE data.
//
//   npm run build:layout            # the app, built against the local fixture API
//   npm run screenshots:marketing   # → src/assets/landing/screens/*.webp (2x) + *.png (1x fallback)
//   node scripts/marketing/screenshots.mjs --only=dashboard,wallet
//
// Data: scripts/layout/mock-api.mjs + the invented "Adunni Fashion House"
// overlay (scripts/marketing/sample-business.mjs). Never point this at a real
// account or real customer data. The landing page labels these "Sample data".
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")));
const OUT = "src/assets/landing/screens";
const API = 5099;
const WEB = 4181;
const ORIGIN = `http://127.0.0.1:${WEB}`;

// name → path. Each is captured at desktop and phone size.
const SCREENS = [
  ["dashboard", "/dashboard"],
  ["inventory", "/inventory"],
  ["orders", "/orders"],
  ["invoice", "/invoices/i1"],
  ["store", "/s/adunnifashion"],
  ["checkout", "/s/adunnifashion/checkout"],
  ["store-orders", "/store/orders"],
  ["wallet", "/wallet"],
  ["customers", "/customers"],
  ["projects", "/projects/p1"],
  ["feli", "/feli"],
  ["bisupplynet", "/bisupplynet/suppliers"],
  ["reports", "/reports"],
].filter(([n]) => !args.only || args.only.split(",").includes(n));
const PROFILES = [
  { name: "desktop", width: 1280, height: 800, mobile: false },
  { name: "phone", width: 390, height: 844, mobile: true },
];

const BROWSER = [process.env.CHROME_PATH, "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) => p && existsSync(p));
if (!BROWSER) { console.error("No Chrome/Edge found; set CHROME_PATH."); process.exit(2); }
if (!existsSync("dist/index.html")) { console.error("No dist/: run `npm run build:layout` first."); process.exit(2); }
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kids = [];
process.on("exit", () => kids.forEach((k) => { try { k.kill(); } catch {} }));
kids.push(spawn(process.execPath, ["scripts/layout/mock-api.mjs", String(API)], { stdio: "ignore", env: { ...process.env, FIXTURE_OVERLAY: "scripts/marketing/sample-business.mjs", LAYOUT_LONG: "0" } }));
kids.push(spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--port", String(WEB), "--strictPort", "--host", "127.0.0.1"], { stdio: "ignore" }));
for (const u of [`http://127.0.0.1:${API}/api/auth/me`, ORIGIN]) {
  for (let t = 0; t < 120; t++) { try { if ((await fetch(u)).status < 500) break; } catch {} await sleep(250); }
}

const port = 9460;
kids.push(spawn(BROWSER, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "shots-"))}`, "--no-first-run", "--hide-scrollbars", "--force-color-profile=srgb", "about:blank"], { stdio: "ignore" }));
let target;
for (let i = 0; i < 80 && !target; i++) { await sleep(250); try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); } catch {} }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) pending.get(m.id)(m), pending.delete(m.id); };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
const SETTLE = `(async () => {
  for (let t = 0; t < 80; t++) {
    const busy = [...document.querySelectorAll('[role="status"]')].some((e) => e.getBoundingClientRect().width > 0 && /loading|opening|checking/i.test(e.textContent));
    if (document.querySelector('h1') && !busy) break;
    await new Promise((r) => setTimeout(r, 150));
  }
  try { await document.fonts.ready; } catch {}
  await Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 3000); })));
  // Hide transient chrome (server wake / new-version banners, toasts).
  for (const el of document.querySelectorAll('[data-transient], [role="alert"][data-banner]')) el.style.display = 'none';
  window.scrollTo(0, 0);
  await new Promise((r) => setTimeout(r, 600));
  return location.pathname;
})()`;

await send("Page.enable");
await send("Page.navigate", { url: ORIGIN + "/login" });
await sleep(1500);
await evaluate(`localStorage.setItem("bimanage.session", "sample-business"); true`);

const made = [];
for (const p of PROFILES) {
  for (const [name, path] of SCREENS) {
    await send("Emulation.setDeviceMetricsOverride", { width: p.width, height: p.height, deviceScaleFactor: 2, mobile: p.mobile });
    await send("Page.navigate", { url: ORIGIN + path });
    await sleep(300);
    const landed = await evaluate(SETTLE);
    if (landed !== path.split("?")[0]) console.warn(`  ! ${name} (${p.name}) landed on ${landed}`);
    const file = `${name}-${p.name}`;
    const webp = await send("Page.captureScreenshot", { format: "webp", quality: 80 });
    writeFileSync(join(OUT, `${file}.webp`), Buffer.from(webp.result.data, "base64"));
    // PNG fallback at 1x (same layout, smaller file).
    await send("Emulation.setDeviceMetricsOverride", { width: p.width, height: p.height, deviceScaleFactor: 1, mobile: p.mobile });
    await sleep(250);
    const png = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(OUT, `${file}.png`), Buffer.from(png.result.data, "base64"));
    made.push(file);
    console.log(`  ✓ ${file}`);
  }
}
console.log(`${made.length} screens → ${OUT}`);
ws.close();
process.exit(0);
