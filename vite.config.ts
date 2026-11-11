import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// GitHub Pages serves the app at /bimanage-frontend/; Vercel (VERCEL=1 during
// its builds) and custom domains serve it at the root. VITE_BASE_PATH overrides both.
const base = process.env.VITE_BASE_PATH ?? (process.env.VERCEL ? "/" : "/bimanage-frontend/");

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { port: 5173, strictPort: true },
});
