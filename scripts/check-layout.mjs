// Layout check for the dashboard charts at phone, tablet and desktop widths.
// Opens the dashboard in a headless Chromium browser (Edge or Chrome) and fails
// if the KPI micro trend overlaps text or leaves its card, the trend line is
// clipped, the sales-trend chart overflows or its labels collide, or the page
// scrolls sideways.
//
//   npm run dev                                   # in another terminal
//   LAYOUT_TOKEN=<a session token for a test account> npm run check:layout
//   node scripts/check-layout.mjs <origin> <outDir> <label> [widths]
//
// The token is only put in the headless browser's own throwaway profile;
// use a test account, never paste a real user's token.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const [origin = "http://localhost:5173", outDir = "layout-check", label = "dashboard", widthsArg = "360,390,440,768,1440"] = process.argv.slice(2);
const widths = widthsArg.split(",").map(Number);
mkdirSync(outDir, { recursive: true });
import { existsSync } from "node:fs";
const BROWSER = [process.env.CHROME_PATH, "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) => p && existsSync(p));
if (!BROWSER) { console.error("No Chrome/Edge found; set CHROME_PATH."); process.exit(2); }
const EDGE = BROWSER;
const port = 9334;
const edge = spawn(EDGE, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "edge-dash-"))}`, "--no-first-run", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 40 && !target; i++) {
  await sleep(250);
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) pending.get(m.id)(m), pending.delete(m.id); };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;

await send("Page.enable");
await send("Page.navigate", { url: origin + "/login" });
await sleep(2500);
await evaluate(`localStorage.setItem("bimanage.session", ${JSON.stringify(process.env.LAYOUT_TOKEN || "mock-token")}); true`);
await send("Page.navigate", { url: origin + "/dashboard" }); // warm-up (dev server compiles on first visit)
await sleep(9000);

const MEASURE = `(() => {
  const r = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), r: Math.round(b.right), b: Math.round(b.bottom) }; };
  const overlap = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.y, b.y));
  const card = [...document.querySelectorAll('section')].find((s) => /revenue/i.test(s.querySelector('h3')?.textContent || ''));
  const out = { vw: innerWidth, scrollW: document.documentElement.scrollWidth };
  if (card) {
    const c = r(card), svg = card.querySelector('svg');
    const texts = [...card.querySelectorAll('h3, p')].map((t) => ({ t: t.textContent.trim().slice(0, 20), ...r(t) }));
    out.card = c;
    if (svg) {
      const s = r(svg);
      out.spark = s;
      out.sparkInsideCard = s.x >= c.x && s.r <= c.r && s.y >= c.y && s.b <= c.b;
      out.sparkOverlapsText = texts.filter((t) => overlap(s, t) > 0).map((t) => t.t + ' (' + overlap(s, t) + 'px²)');
      const path = svg.querySelector('path[fill=none]');
      if (path) { const pb = r(path); out.lineInsideSvg = pb.x >= s.x - 1 && pb.r <= s.r + 1 && pb.y >= s.y - 1 && pb.b <= s.b + 1; }
    }
    out.valueTextClipped = texts.filter((t) => t.r > c.r || t.x < c.x).map((t) => t.t);
  }
  const trend = [...document.querySelectorAll('section')].find((s) => /sales trend/i.test(s.querySelector('h2')?.textContent || ''));
  if (trend) {
    const fig = trend.querySelector('figure');
    if (fig) {
      const f = r(fig), t = r(trend);
      out.trend = { figW: f.w, panelW: t.w, inside: f.x >= t.x && f.r <= t.r, figScrollW: fig.scrollWidth, figClientW: fig.clientWidth };
      const labels = [...fig.querySelectorAll('span')].map(r);
      out.trend.labelOverlaps = labels.some((a, i) => labels.slice(i + 1).some((b) => overlap(a, b) > 0));
    }
  }
  const top = [...document.querySelectorAll('section')].find((s) => /top-selling/i.test(s.querySelector('h2')?.textContent || ''));
  if (top) { const t = r(top); out.top = { w: t.w, scrollW: top.scrollWidth, clientW: top.clientWidth, overflowing: top.scrollWidth > top.clientWidth }; }
  return out;
})()`;

const results = {};
for (const w of widths) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: w < 768 ? 844 : 1000, deviceScaleFactor: w < 768 ? 2 : 1, mobile: w < 768 });
  await send("Page.navigate", { url: origin + "/dashboard" });
  await sleep(7000);
  results[w] = await evaluate(MEASURE);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(outDir, `${label}-${w}.png`), Buffer.from(shot.result.data, "base64"));
  // Close-up of the KPI grid.
  const box = await evaluate(`(() => { const s = [...document.querySelectorAll('section')].find((s) => /revenue/i.test(s.querySelector('h3')?.textContent || '')); const g = s?.parentElement?.getBoundingClientRect(); return g ? { x: g.left, y: g.top, width: g.width, height: g.height } : null; })()`);
  if (box) {
    const clip = await send("Page.captureScreenshot", { format: "png", clip: { ...box, scale: 1 } });
    writeFileSync(join(outDir, `${label}-${w}-kpis.png`), Buffer.from(clip.result.data, "base64"));
  }
}
const problems = [];
for (const [w, v] of Object.entries(results)) {
  if (v.scrollW > v.vw) problems.push(`${w}px: page scrolls sideways (${v.scrollW}px wide)`);
  if (!v.card) problems.push(`${w}px: revenue tile not found (signed in? dashboard loaded?)`);
  if (v.spark && !v.sparkInsideCard) problems.push(`${w}px: micro trend leaves its card`);
  if (v.sparkOverlapsText?.length) problems.push(`${w}px: micro trend overlaps ${v.sparkOverlapsText.join(", ")}`);
  if (v.lineInsideSvg === false) problems.push(`${w}px: trend line clipped`);
  if (v.valueTextClipped?.length) problems.push(`${w}px: text cut off: ${v.valueTextClipped.join(", ")}`);
  if (v.trend && (!v.trend.inside || v.trend.figScrollW > v.trend.figClientW)) problems.push(`${w}px: sales trend overflows its panel`);
  if (v.trend?.labelOverlaps) problems.push(`${w}px: sales trend labels collide`);
  if (v.top?.overflowing) problems.push(`${w}px: top sellers overflow`);
}
ws.close();
edge.kill();
if (problems.length) {
  console.error(["✖ Layout check failed:", ...problems.map((p) => `  - ${p}`)].join("\n"));
  process.exit(1);
}
console.log(`✓ Layout check: ${Object.keys(results).join(", ")}px — no overlap, clipping or sideways scroll. Screenshots in ${outDir}/`);
