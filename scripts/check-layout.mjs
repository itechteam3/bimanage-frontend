// Responsive layout check for EVERY screen (app, /admin, storefront, auth).
//
// Opens each route from the router at 360, 390, 768, 1024, 1280 and 1440px in
// headless Chrome/Edge, against the local fixture API in LONG-data mode (long
// names and emails, 12+ rows per list, nine-figure ₦ amounts), and fails if:
//   - the page scrolls sideways
//   - something sticks out of the screen, or out of its card/form, without a
//     scroll container of its own (tables must scroll inside their container)
//   - text is cut off (hidden overflow that isn't an intentional ellipsis)
//   - buttons, links or fields overlap
//   - a dialog is larger than the screen
//   - a tap target is smaller than 44×44px on a phone (≤ 430px)
// It also presses the buttons that usually open dialogs and checks those.
//
//   npm run build:layout      # builds against the fixture API (port 5099)
//   npm run check:layout      # starts the fixture API + preview, checks everything
//   node scripts/check-layout.mjs --only=/settings/team/invite --widths=360,1440
//
// Screenshots of every failure go to layout-check/ (gitignored), with
// report.json. Exit code 1 when anything fails.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { allRoutes, DIALOG_OPENERS } from "./layout/routes.mjs";

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")));
const WIDTHS = (args.widths ?? "360,390,768,1024,1280,1440").split(",").map(Number);
const OUT = args.out ?? "layout-check";
const API_PORT = Number(args.apiPort ?? 5099);
const WEB_PORT = Number(args.webPort ?? 4179);
const ORIGIN = args.origin ?? `http://127.0.0.1:${WEB_PORT}`;
const ONLY = args.only ? args.only.split(",") : null;
const DIALOGS = args.dialogs !== "off";
const SHOTS_ALL = args.shots === "all"; // --shots=all saves every page, not just failures
const PHONE = 430;

const BROWSER = [process.env.CHROME_PATH, "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find((p) => p && existsSync(p));
if (!BROWSER) { console.error("No Chrome/Edge found; set CHROME_PATH."); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const children = [];
const cleanup = () => { for (const c of children) try { c.kill(); } catch {} };
process.on("exit", cleanup);
process.on("SIGINT", () => process.exit(130));

async function waitFor(url, ms = 30000) {
  for (let t = 0; t < ms; t += 250) { try { if ((await fetch(url)).status < 500) return true; } catch {} await sleep(250); }
  throw new Error(`timed out waiting for ${url}`);
}

// ── Servers: the fixture API (long data) and the built app ──
if (!args.origin) {
  if (!existsSync("dist/index.html")) { console.error("No dist/: run `npm run build:layout` first."); process.exit(2); }
  children.push(spawn(process.execPath, ["scripts/layout/mock-api.mjs", String(API_PORT)], { stdio: "ignore", env: { ...process.env, LAYOUT_LONG: "1" } }));
  children.push(spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--port", String(WEB_PORT), "--strictPort", "--host", "127.0.0.1"], { stdio: "ignore" }));
  await waitFor(`http://127.0.0.1:${API_PORT}/__mode/long`);
  await waitFor(ORIGIN);
}

// ── One headless browser per width, run in parallel ──
async function browser(width, port) {
  const proc = spawn(BROWSER, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "layout-"))}`, "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--disable-gpu", "--no-sandbox", "about:blank"], { stdio: "ignore" });
  children.push(proc);
  let target;
  for (let i = 0; i < 80 && !target; i++) { await sleep(250); try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); } catch {} }
  if (!target) throw new Error(`browser for ${width}px didn't start`);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) pending.get(m.id)(m), pending.delete(m.id); };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expression, ms = 15000) => {
    const r = await Promise.race([send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }), sleep(ms).then(() => ({ timeout: true }))]);
    return r.timeout ? undefined : r.result?.result?.value;
  };
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height: width <= PHONE ? 800 : 900, deviceScaleFactor: 1, mobile: width <= PHONE });
  if (width <= PHONE) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  const shot = async (file) => {
    const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    if (r.result?.data) writeFileSync(join(OUT, file), Buffer.from(r.result.data, "base64"));
  };
  return { send, evaluate, shot, close: () => { ws.close(); proc.kill(); } };
}

// In-page audit. Returns a list of { type, detail } problems.
const AUDIT = (phone) => `(() => {
  const W = document.documentElement.clientWidth, H = innerHeight;
  const problems = [];
  const add = (type, el, detail) => problems.push({ type, el: el ? describe(el) : '', detail });
  function describe(el) {
    const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').replace(/\\s+/g, ' ').trim().slice(0, 40);
    const cls = String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || '').split(/\\s+/).slice(0, 4).join('.');
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '') + (name ? ' "' + name + '"' : '');
  }
  const visible = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.01; };
  const srOnly = (el) => { for (let p = el; p; p = p.parentElement) { const s = getComputedStyle(p); if ((s.clip === 'rect(0px, 0px, 0px, 0px)' || s.clipPath === 'inset(50%)') && p.getBoundingClientRect().width <= 1) return true; } return false; };
  const scrollParent = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth + 1) return p; } return null; };
  const clippedBy = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (/(hidden|clip|auto|scroll)/.test(s.overflowX)) return p; } return null; };
  // The part of an element that can actually be seen: clipped by every
  // ancestor that hides or scrolls its overflow (content scrolled out of a
  // chat log is not "overlapping" what is below it).
  const visibleRect = (el, base) => {
    let r = base || el.getBoundingClientRect();
    let x1 = r.left, y1 = r.top, x2 = r.right, y2 = r.bottom;
    for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.overflowX === "visible" && s.overflowY === "visible") continue;
      const c = p.getBoundingClientRect();
      if (s.overflowX !== "visible") { x1 = Math.max(x1, c.left); x2 = Math.min(x2, c.right); }
      if (s.overflowY !== "visible") { y1 = Math.max(y1, c.top); y2 = Math.min(y2, c.bottom); }
    }
    return x2 - x1 < 1 || y2 - y1 < 1 ? null : { left: x1, top: y1, right: x2, bottom: y2 };
  };
  const fixedish = (el) => { for (let p = el; p; p = p.parentElement) { const s = getComputedStyle(p); if (s.position === 'fixed' || s.position === 'sticky') return true; } return false; };

  // 1. Sideways scroll.
  const sw = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  if (sw > W + 1) {
    const past = [...document.querySelectorAll('body *')].filter((e) => visible(e) && e.getBoundingClientRect().right > W + 1);
    const unclipped = past.filter((e) => !clippedBy(e));
    const worst = (unclipped.length ? unclipped : past).sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right).slice(0, 3);
    // Nothing sticks out? Then it is content wider than its box (text, inline items).
    const spill = worst.length ? [] : [...document.querySelectorAll('body *')].filter((e) => visible(e) && e.clientWidth > 0 && e.getBoundingClientRect().left + e.scrollWidth > W + 1 && getComputedStyle(e).overflowX === 'visible').sort((a, b) => b.scrollWidth - b.clientWidth - (a.scrollWidth - a.clientWidth)).slice(0, 3);
    add('sideways-scroll', worst[0] || spill[0], 'page is ' + sw + 'px wide on a ' + W + 'px screen (html ' + document.documentElement.scrollWidth + ', body ' + document.body.scrollWidth + ')' + (worst.length ? '; widest: ' + worst.map(describe).join(' | ') : spill.length ? '; content wider than its box: ' + spill.map((e) => describe(e) + ' ' + e.scrollWidth + '/' + e.clientWidth).join(' | ') : ''));
  }

  // 2. Out of the screen / out of its container (no scroll container of its own).
  const containers = 'section, form, fieldset, article, aside, [class*="rounded"][class*="border"], [role="dialog"], dialog, td, th, li';
  for (const el of document.querySelectorAll('input, select, textarea, button, a, table, img, svg, label, h1, h2, h3, p, [role="grid"], [role="table"]')) {
    if (!visible(el) || srOnly(el) || fixedish(el)) continue;
    const r = el.getBoundingClientRect();
    const sp = scrollParent(el);
    if (sp) continue; // inside its own horizontal scroller: fine (tables etc.)
    if (r.right > W + 1 || r.left < -1) { if (!clippedBy(el)) add('off-screen', el, 'spans ' + Math.round(r.left) + '…' + Math.round(r.right) + 'px of ' + W + 'px'); continue; }
    const box = el.parentElement && el.parentElement.closest(containers);
    if (box && box !== el && visibleRect(el)) {
      const b = box.getBoundingClientRect();
      if (r.right > b.right + 2 || r.left < b.left - 2) add('overflows-container', el, 'sticks out of ' + describe(box) + ' by ' + Math.round(Math.max(r.right - b.right, b.left - r.left)) + 'px');
    }
  }

  // 3. Tables wider than their container must scroll inside it.
  for (const t of document.querySelectorAll('table')) {
    if (!visible(t) || srOnly(t)) continue;
    const parent = t.parentElement; if (!parent) continue;
    if (t.scrollWidth > parent.clientWidth + 2 && !scrollParent(t) && !/(auto|scroll)/.test(getComputedStyle(parent).overflowX)) add('table-not-scrollable', t, 'table ' + t.scrollWidth + 'px in ' + parent.clientWidth + 'px without its own scroll');
  }

  // 4. Cut-off text: hidden overflow that isn't an intentional ellipsis/line clamp.
  for (const el of document.querySelectorAll('h1, h2, h3, h4, p, span, button, a, label, td, th, dd, dt, li, div')) {
    if (!visible(el) || srOnly(el) || el.children.length > 3) continue;
    const s = getComputedStyle(el);
    if (!/(hidden|clip)/.test(s.overflowX + s.overflowY)) continue;
    if (s.textOverflow === 'ellipsis' || s.webkitLineClamp !== 'none' && s.webkitLineClamp) continue;
    if (!el.textContent.trim()) continue;
    if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 4 && s.overflowY !== 'visible' && /(hidden|clip)/.test(s.overflowY) && el.clientHeight > 0) add('text-cut-off', el, 'content ' + el.scrollWidth + '×' + el.scrollHeight + ' in ' + el.clientWidth + '×' + el.clientHeight);
  }

  // 4b. Text squeezed into a sliver (a word broken one letter per line).
  for (const el of document.querySelectorAll('dd, td, th, p, span, a, h1, h2, h3, li')) {
    if (!visible(el) || srOnly(el) || el.children.length) continue;
    const text = el.textContent.trim(); if (text.length < 6) continue;
    const r = el.getBoundingClientRect(); const lh = parseFloat(getComputedStyle(el).lineHeight) || 20;
    if (r.width < 56 && r.height > lh * 2.5 && /[A-Za-z]{4,}/.test(text)) add('text-squeezed', el, Math.round(r.width) + 'px wide, ' + Math.round(r.height / lh) + ' lines');
  }

  // 5. Overlapping controls.
  const ctrls = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea')].filter((e) => visible(e) && !srOnly(e) && !fixedish(e));
  // Line boxes (a link that wraps onto two lines is two boxes), clipped to what is visible.
  const boxes = ctrls.map((e) => [...e.getClientRects()].map((r) => visibleRect(e, r)).filter(Boolean));
  const ovl = (A, B) => { let t = 0; for (const a of A) for (const b of B) t += Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)); return t; };
  for (let i = 0; i < ctrls.length; i++) for (let j = i + 1; j < ctrls.length; j++) {
    if (ctrls[i].contains(ctrls[j]) || ctrls[j].contains(ctrls[i])) continue;
    const ov = ovl(boxes[i], boxes[j]);
    if (ov > 16) add('overlap', ctrls[i], 'overlaps ' + describe(ctrls[j]) + ' (' + Math.round(ov) + 'px²)');
  }

  // 6. Dialogs fit the screen.
  for (const d of document.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"]')) {
    if (!visible(d)) continue;
    const r = d.getBoundingClientRect();
    if (r.left < -1 || r.right > W + 1 || r.width > W) add('dialog-too-wide', d, Math.round(r.width) + 'px wide on ' + W + 'px');
    if (r.height > H + 1 && !/(auto|scroll)/.test(getComputedStyle(d).overflowY)) add('dialog-too-tall', d, Math.round(r.height) + 'px tall on ' + H + 'px without scrolling');
  }

  // 7. Tap targets ≥ 44×44 on phones (inline text links inside a sentence are exempt, as in WCAG).
  if (${phone}) {
    for (const el of ctrls) {
      if (el.disabled || el.closest('[aria-hidden="true"]')) continue;
      const s = getComputedStyle(el);
      if (el.tagName === 'A' && s.display === 'inline' && el.parentElement && /^(P|LI|SPAN|SMALL|DD|TD)$/.test(el.parentElement.tagName) && el.parentElement.textContent.trim().length > el.textContent.trim().length + 3) continue;
      // The tap area: the element, or its invisible ::after tap area (index.css),
      // or for a checkbox/radio its label's.
      const area = (node) => { const b = node.getBoundingClientRect(); const a = getComputedStyle(node, '::after'); const pw = a.content !== 'none' && a.position === 'absolute' ? parseFloat(a.width) || 0 : 0; const ph = a.content !== 'none' && a.position === 'absolute' ? parseFloat(a.height) || 0 : 0; return { width: Math.max(b.width, pw), height: Math.max(b.height, ph) }; };
      let r = area(el);
      if ((el.type === 'checkbox' || el.type === 'radio') && el.labels && el.labels[0]) { const l = area(el.labels[0]); r = { width: Math.max(r.width, l.width), height: Math.max(r.height, l.height) }; }
      if (r.width < 43 || r.height < 43) add('tap-target-small', el, Math.round(r.width) + '×' + Math.round(r.height) + 'px');
    }
  }
  // De-duplicate (same type + element).
  const seen = new Set();
  return problems.filter((p) => { const k = p.type + p.el; if (seen.has(k)) return false; seen.add(k); return true; });
})()`;

const SETTLE = `(async () => {
  for (let t = 0; t < 60; t++) {
    const busy = [...document.querySelectorAll('[role="status"]')].some((e) => e.getBoundingClientRect().width > 0 && /loading|opening|checking/i.test(e.textContent));
    if (document.querySelector('h1, main') && !busy) break;
    await new Promise((r) => setTimeout(r, 150));
  }
  // Measure with the real font (Poppins), not the wider fallback.
  try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 3000))]); } catch {}
  await new Promise((r) => setTimeout(r, 350));
  return location.pathname;
})()`;

const routes = allRoutes().filter((r) => !ONLY || ONLY.some((o) => r.path === o || (!args.exact && r.url.startsWith(o))));
console.log(`layout check: ${routes.length} screens × ${WIDTHS.length} widths (${WIDTHS.join(", ")}) → ${routes.length * WIDTHS.length} page checks${DIALOGS ? " + dialogs" : ""}`);

const results = [];
async function runWidth(width, port) {
  const b = await browser(width, port);
  const go = async (url) => { await b.send("Page.navigate", { url: ORIGIN + url }); await sleep(150); return b.evaluate(SETTLE, 20000); };
  // Signed-out screens first, then sign in (fixture tokens only; nothing real).
  await go("/login");
  for (const r of routes.filter((x) => x.guest)) await check(r);
  await b.evaluate(`localStorage.setItem("bimanage.session", "layout-check-token"); localStorage.setItem("bimanage.admin.session", "layout-check-admin"); true`);
  for (const r of routes.filter((x) => !x.guest)) await check(r);
  b.close();

  async function check(r) {
    const landed = await go(r.url);
    let problems = (await b.evaluate(AUDIT(width <= PHONE))) ?? [{ type: "audit-failed", el: "", detail: "page didn't respond" }];
    // Real layout bugs persist; look again once before reporting (skips a frame caught mid-render).
    if (problems.length) { await sleep(800); problems = (await b.evaluate(AUDIT(width <= PHONE))) ?? problems; }
    const slug = (r.url.replace(/[?].*$/, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "root") + "-" + width;
    if (problems.length || SHOTS_ALL) await b.shot(slug + ".png");
    results.push({ path: r.path, url: r.url, width, landed, problems });
    // Dialogs: press likely openers (phone and desktop widths only, to keep it quick).
    if (DIALOGS && (width === 360 || width === 1440)) {
      const labels = (await b.evaluate(`JSON.stringify([...document.querySelectorAll('main button, [role="main"] button, button')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && !e.disabled && ${DIALOG_OPENERS}.test((e.textContent || e.getAttribute('aria-label') || '').trim()); }).map((e) => (e.textContent || e.getAttribute('aria-label') || '').trim()).filter((v, i, a) => a.indexOf(v) === i).slice(0, 4))`)) ?? "[]";
      for (const label of JSON.parse(labels)) {
        const opened = await b.evaluate(`(async () => {
          const btn = [...document.querySelectorAll('button')].find((e) => (e.textContent || e.getAttribute('aria-label') || '').trim() === ${JSON.stringify(label)} && e.getBoundingClientRect().width > 0);
          if (!btn) return false;
          btn.click();
          for (let t = 0; t < 20; t++) { if (document.querySelector('dialog[open], [role="dialog"], [role="alertdialog"]')) return true; await new Promise((r) => setTimeout(r, 100)); }
          return false;
        })()`);
        if (opened) {
          await sleep(250);
          const dp = ((await b.evaluate(AUDIT(width <= PHONE))) ?? []).filter((p) => p.type !== "sideways-scroll" || true);
          const name = `${r.path} › dialog "${label}"`;
          if (dp.length) await b.shot(`${slug}-dialog-${label.replace(/[^a-z0-9]+/gi, "-").slice(0, 30)}.png`);
          results.push({ path: name, url: r.url, width, landed: r.url, problems: dp });
        }
        // Back to a clean page for the next opener.
        if ((await b.evaluate("location.pathname + location.search")) !== r.url || opened) await go(r.url);
      }
    }
  }
}

const started = Date.now();
await Promise.all(WIDTHS.map((w, i) => runWidth(w, 9400 + i)));

// ── Report ──
const failing = results.filter((r) => r.problems.length);
const byType = {};
for (const r of failing) for (const p of r.problems) byType[p.type] = (byType[p.type] ?? 0) + 1;
writeFileSync(join(OUT, "report.json"), JSON.stringify({ widths: WIDTHS, checked: results.length, failing: failing.length, byType, results: failing }, null, 2));
for (const r of failing.sort((a, b) => a.path.localeCompare(b.path) || a.width - b.width)) {
  console.log(`✖ ${r.width}px ${r.path}${r.landed && !r.url.startsWith(r.landed) ? ` (landed on ${r.landed})` : ""}`);
  for (const p of r.problems.slice(0, 6)) console.log(`    ${p.type}: ${p.el} — ${p.detail}`);
  if (r.problems.length > 6) console.log(`    … ${r.problems.length - 6} more`);
}
console.log(`\n${results.length} checks in ${Math.round((Date.now() - started) / 1000)}s: ${failing.length} failing. ${JSON.stringify(byType)}`);
console.log(`Screenshots and report.json in ${OUT}/`);
cleanup();
process.exit(failing.length ? 1 : 0);
