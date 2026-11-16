// Product screenshots for the landing page, from the REAL app with SAMPLE data.
//
//   npm run build:layout            # the app, built against the local fixture API
//   npm run screenshots:marketing   # → src/assets/landing/screens/*.webp + *.png (1x fallback)
//   node scripts/marketing/screenshots.mjs --only=dashboard,wallet
//
// Data: scripts/layout/mock-api.mjs + the invented "Adunni Fashion House"
// overlay (scripts/marketing/sample-business.mjs), with illustrated avatars
// (scripts/marketing/avatars/, from make-avatars.mjs) and our own shop logo
// (scripts/marketing/logo/). Never point this at a real account or real
// customer data. The landing page labels these "Sample data".
//
// Desktop: 1280 × 800 at 2x, shown in BrowserFrame.
// Phone: iPhone 18 Pro Max — 2868 × 1320 px at 460 ppi, i.e. 440 × 956 pt at
// 3x (https://www.apple.com/iphone-18-pro/specs/, checked 16 Nov 2026). The
// landing page draws the phone, Dynamic Island and the 62 pt iOS status bar
// (src/pages/landing/IPhoneFrame.tsx), so the app is captured BELOW the status
// bar: 440 × 894 pt at 3x (1320 × 2682 px), with the 34 pt home-indicator
// safe area at the bottom. The colour at the top/bottom of each phone capture
// goes to phone-chrome.json so the status bar matches the app's header and
// its glyphs are dark on light screens and light on navy ones.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

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
// Keep in step with IPHONE in src/pages/landing/IPhoneFrame.tsx.
const IPHONE = { width: 440, height: 956, dpr: 3, statusBar: 62, homeInset: 34 };
const PROFILES = [
  { name: "desktop", width: 1280, height: 800, dpr: 2, mobile: false, quality: 80 },
  { name: "phone", width: IPHONE.width, height: IPHONE.height - IPHONE.statusBar, dpr: IPHONE.dpr, mobile: true, quality: 74, inset: { top: 0, bottom: IPHONE.homeInset, left: 0, right: 0 } },
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

/** One pixel of the current page (CSS px), from a 1×1 PNG capture. */
async function pixel(x, y) {
  const png = Buffer.from((await send("Page.captureScreenshot", { format: "png", clip: { x, y, width: 1, height: 1, scale: 1 } })).result.data, "base64");
  const idat = [];
  let colorType = 2;
  for (let o = 8; o < png.length; ) {
    const len = png.readUInt32BE(o), type = png.toString("ascii", o + 4, o + 8);
    if (type === "IHDR") colorType = png[o + 17];
    if (type === "IDAT") idat.push(png.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)); // [filter, r, g, b(, a)]: one pixel, so no filter maths
  return colorType === 0 || colorType === 4 ? [raw[1], raw[1], raw[1]] : [raw[1], raw[2], raw[3]];
}
const hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
const isDark = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b < 140;
const CHROME_FILE = join(OUT, "phone-chrome.json");
const chrome = existsSync(CHROME_FILE) ? JSON.parse(readFileSync(CHROME_FILE, "utf8")) : {};

await send("Page.enable");
await send("Page.navigate", { url: ORIGIN + "/login" });
await sleep(1500);
await evaluate(`localStorage.setItem("bimanage.session", "sample-business"); true`);

const made = [];
for (const p of PROFILES) {
  for (const [name, path] of SCREENS) {
    await send("Emulation.setDeviceMetricsOverride", { width: p.width, height: p.height, deviceScaleFactor: p.dpr, mobile: p.mobile });
    // The home-indicator safe area, so env(safe-area-inset-bottom) works (newer Chromium only).
    await send("Emulation.setSafeAreaInsetsOverride", { insets: p.inset ?? { top: 0, bottom: 0, left: 0, right: 0 } });
    await send("Page.navigate", { url: ORIGIN + path });
    await sleep(300);
    const landed = await evaluate(SETTLE);
    if (landed !== path.split("?")[0]) console.warn(`  ! ${name} (${p.name}) landed on ${landed}`);
    const file = `${name}-${p.name}`;
    // Some screens (FELI's chat) scroll themselves after loading: start at the top.
    await evaluate(`window.scrollTo(0, 0); new Promise((r) => setTimeout(() => r(window.scrollY), 300))`);
    if (p.name === "phone") {
      // Status bar = the app's top colour; home indicator tone = the bottom's.
      const top = await pixel(3, 1), bottom = await pixel(3, p.height - 4);
      chrome[name] = { bar: hex(top), glyphs: isDark(top) ? "light" : "dark", home: isDark(bottom) ? "light" : "dark" };
    }
    const webp = await send("Page.captureScreenshot", { format: "webp", quality: p.quality });
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
writeFileSync(CHROME_FILE, JSON.stringify(Object.fromEntries(Object.entries(chrome).sort()), null, 2) + "\n");
console.log(`${made.length} screens → ${OUT}`);
// Close the headless browser properly (killing the launcher can leave Edge running).
ws.close();
try {
  const bws = new WebSocket((await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl);
  await Promise.race([new Promise((r) => (bws.onopen = r)), sleep(2000)]);
  bws.send(JSON.stringify({ id: 1, method: "Browser.close" }));
  await sleep(1000);
} catch {}
process.exit(0);
