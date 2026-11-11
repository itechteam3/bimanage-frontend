import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/index.css";
import { App } from "./App";
import { wakeServer } from "@/lib/api/client";

// Start waking a sleeping Render backend as early as possible.
void wakeServer();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
