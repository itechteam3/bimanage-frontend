// Build-time configuration. Everything here ends up in public JavaScript,
// so it must never hold secrets — only public URLs.
const trimSlash = (s: string) => s.replace(/\/+$/, "");

const apiBase = trimSlash(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api");

export const env = {
  /** e.g. https://bimanage-backend.onrender.com/api */
  apiBaseUrl: apiBase,
  /** Server root (health check, Google sign-in redirect, Socket.io). */
  serverUrl: trimSlash(import.meta.env.VITE_SOCKET_URL ?? apiBase.replace(/\/api$/, "")),
  /** Router basename, from Vite's `base`. */
  basePath: trimSlash(import.meta.env.BASE_URL) || "/",
} as const;
