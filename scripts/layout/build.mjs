// Builds the app against the local fixture API for the layout check.
import { spawnSync } from "node:child_process";
const env = { ...process.env, VITE_API_BASE_URL: "http://127.0.0.1:5099/api", VITE_SOCKET_URL: "http://127.0.0.1:5099" };
const r = spawnSync(process.execPath, ["node_modules/vite/bin/vite.js", "build"], { stdio: "inherit", env });
process.exit(r.status ?? 1);
