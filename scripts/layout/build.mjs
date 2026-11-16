// Builds the app against the local fixture API for the layout check.
// LAYOUT_API_PORT picks another fixture-API port (default 5099); pass the same
// port to the checker with --apiPort when another check is already using 5099.
import { spawnSync } from "node:child_process";
const port = process.env.LAYOUT_API_PORT ?? "5099";
const env = { ...process.env, VITE_API_BASE_URL: `http://127.0.0.1:${port}/api`, VITE_SOCKET_URL: `http://127.0.0.1:${port}` };
const r = spawnSync(process.execPath, ["node_modules/vite/bin/vite.js", "build"], { stdio: "inherit", env });
process.exit(r.status ?? 1);
