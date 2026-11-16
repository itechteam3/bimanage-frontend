// Runs in `npm run build` (after vite build). The production security headers
// (Content-Security-Policy, Permissions-Policy, HSTS) live in vercel.json; this
// fails the build when they don't match csp.config.mjs for the API and socket
// addresses this build talks to (VITE_API_BASE_URL / VITE_SOCKET_URL), so a new
// API host can't ship blocked by the policy.
//   node scripts/check-csp.mjs          check
//   node scripts/check-csp.mjs --print  print the lines to paste into vercel.json
import { readFileSync } from "node:fs";
import { cspFor, PERMISSIONS_POLICY, HSTS, PRODUCTION_API } from "../csp.config.mjs";

const apiUrl = process.env.VITE_API_BASE_URL || PRODUCTION_API;
const socketUrl = process.env.VITE_SOCKET_URL || undefined;
const want = { "Content-Security-Policy": cspFor({ apiUrl, socketUrl }), "Permissions-Policy": PERMISSIONS_POLICY, "Strict-Transport-Security": HSTS };

if (process.argv.includes("--print")) {
  for (const [key, value] of Object.entries(want)) console.log(`        { "key": ${JSON.stringify(key)}, "value": ${JSON.stringify(value)} },`);
  process.exit(0);
}

const config = JSON.parse(readFileSync("vercel.json", "utf8"));
const all = (config.headers || []).find((h) => h.source === "/(.*)");
const problems = [];
if (!all) problems.push('vercel.json has no headers block for "/(.*)".');
else
  for (const [key, value] of Object.entries(want)) {
    const have = all.headers.find((h) => h.key === key);
    if (!have || have.value !== value) problems.push(`${key} in vercel.json doesn't match csp.config.mjs for API ${apiUrl}.`);
  }

if (problems.length) {
  console.error(`✖ Security headers check failed:\n  - ${problems.join("\n  - ")}\n  Run: node scripts/check-csp.mjs --print (with the same VITE_API_BASE_URL) and paste the lines into vercel.json's "/(.*)" headers.`);
  process.exit(1);
}
console.log(`✓ Security headers: CSP allows API ${apiUrl}`);
