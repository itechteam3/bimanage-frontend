import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
// @ts-expect-error: plain JS module shared with vercel.json's check (scripts/check-csp.mjs).
import { cspFor, PERMISSIONS_POLICY } from "./csp.config.mjs";

// Served at the domain root (Vercel). VITE_BASE_PATH overrides it if the app
// is ever hosted under a sub-path.
const base = process.env.VITE_BASE_PATH ?? "/";

// The public site address (share tags, canonical links, sitemap): ONE
// setting. index.html reads it as %VITE_PUBLIC_SITE_URL%; set it on Vercel
// to move domains. No trailing slash.
process.env.VITE_PUBLIC_SITE_URL = (process.env.VITE_PUBLIC_SITE_URL || "https://bimanage-frontend.vercel.app").replace(/\/+$/, "");

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
    // `vite preview` (used by the layout check) serves the same
    // Content-Security-Policy as production, for the API this build talks to,
    // so every screen is checked under it.
    preview: {
      headers: {
        "Content-Security-Policy": cspFor({ apiUrl: process.env.VITE_API_BASE_URL || "http://localhost:5000/api", socketUrl: process.env.VITE_SOCKET_URL || undefined }),
        "Permissions-Policy": PERMISSIONS_POLICY,
      },
    },
  };
});
