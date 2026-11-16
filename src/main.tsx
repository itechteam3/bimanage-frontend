import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/index.css";
import { App } from "./App";
import { wakeServer } from "@/lib/api/client";
import { reloadForNewVersion } from "@/lib/reloadOnce";
import { applyCachedDisplay } from "@/lib/account/preferences";

// A page file missing after a deploy: load the new version (once) instead of failing.
window.addEventListener("vite:preloadError", (event) => {
  if (reloadForNewVersion()) event.preventDefault();
});

// Larger text / reduced motion from the last visit, before the first paint.
applyCachedDisplay();

// Start waking a sleeping Render backend as early as possible.
void wakeServer();

// Error tracking, only when VITE_SENTRY_DSN is set (loaded after start-up).
void import("@/lib/monitoring/sentry").then((m) => m.initMonitoring());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
