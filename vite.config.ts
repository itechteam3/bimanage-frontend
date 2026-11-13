import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// Served at the domain root (Vercel). VITE_BASE_PATH overrides it if the app
// is ever hosted under a sub-path.
const base = process.env.VITE_BASE_PATH ?? "/";

// Build id: the deployed commit on Vercel, else the build time. The app
// compares it with /version.json to offer a reload after a deploy.
const buildVersion = (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 12) || `b${Date.now().toString(36)}`;

const versionFile = (version: string): Plugin => ({
  name: "bimanage-version-file",
  apply: "build",
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ version }) });
  },
});

export default defineConfig(({ command }) => {
  const version = command === "build" ? buildVersion : "dev";
  return {
    base,
    plugins: [react(), tailwindcss(), versionFile(version)],
    define: { __APP_VERSION__: JSON.stringify(version) },
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    server: { port: 5173, strictPort: true },
  };
});
