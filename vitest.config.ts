// Vitest runs on its own bundled Vite, so its config lives apart from
// vite.config.ts (whose plugins target Vite 6).
import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    restoreMocks: true,
    // Flow tests click and type through whole screens; 5 s (the default) is
    // too tight on a busy machine or CI. Each `findBy` still gives up after 8 s (src/test/setup.ts).
    testTimeout: 20_000,
  },
});
