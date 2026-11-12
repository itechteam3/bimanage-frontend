// Runs after `vite build`. Fails the build when the production bundle could
// talk to anything but the real API, or carries test/mock code:
//   - the API base must be an https URL (VITE_API_BASE_URL) and be in the bundle
//   - no localhost / 127.0.0.1 addresses
//   - no mock-backend or test-fixture code
// Usage: node scripts/check-bundle.mjs [distDir]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const dist = process.argv[2] ?? "dist";
const api = (process.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

const FORBIDDEN = [
  [/no fixture for/i, "mock API fixture message"],
  [/fixture for (GET|POST|PUT|PATCH|DELETE)|\/fixtures?\//i, "fixture code"],
  [/mock-api|mockApi|__mode\/(empty|populated)/, "mock API"],
  [/installFakeBackend|fakeBackend|FakeBackend/, "test fake backend"],
  [/\bvi\.(fn|stubGlobal|mock)\b|@testing-library|vitest/, "test tooling"],
  [/\/\/(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:\d+)?/, "local address"],
];

const problems = [];
if (!api) problems.push("VITE_API_BASE_URL is not set — production would call the built-in localhost default.");
else if (!/^https:\/\/[^/]+/.test(api)) problems.push(`VITE_API_BASE_URL must be an https URL, got "${api}".`);

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|mjs|css|html|json)$/.test(name)) files.push(p);
  }
};
try {
  walk(dist);
} catch {
  problems.push(`No build output in ${dist}/ — run vite build first.`);
}

let apiFound = false;
for (const file of files) {
  const text = readFileSync(file, "utf8");
  if (api && text.includes(api)) apiFound = true;
  for (const [re, what] of FORBIDDEN) {
    const m = text.match(re);
    if (m) {
      const at = Math.max(0, (m.index ?? 0) - 40);
      problems.push(`${what} in ${file}: …${text.slice(at, at + 100).replace(/\s+/g, " ")}…`);
    }
  }
}
if (api && files.length && !apiFound) problems.push(`The API base ${api} isn't in the bundle — calls may go somewhere else.`);

if (problems.length) {
  console.error("✖ Production bundle check failed:\n  - " + problems.join("\n  - "));
  process.exit(1);
}
console.log(`✓ Production bundle check: ${files.length} files, API ${api}, no mock/test/local code.`);
