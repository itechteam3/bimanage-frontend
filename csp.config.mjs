// Content-Security-Policy (security fixes P2-4, P3-12): one definition used by
//   - vercel.json (production headers; scripts/check-csp.mjs fails the build
//     if it no longer matches the API and socket addresses being built in),
//   - `vite preview` (vite.config.ts), so the layout check loads every screen
//     under the same policy and reports any violation.
// To allow a new outside service, add it here, run `node scripts/check-csp.mjs --print`
// and paste the lines into vercel.json, then run the layout check.

/** The scheme + host of a URL ("" if it isn't one). */
export const originOf = (url) => {
  try {
    const u = new URL(String(url));
    return `${u.protocol}//${u.host}`;
  } catch {
    return "";
  }
};

/** The websocket origin for an http(s) server URL (Socket.io upgrades to it). */
export const wsOriginOf = (url) => originOf(url).replace(/^http/, "ws");

export const PRODUCTION_API = "https://bimanage-backend.onrender.com/api";

/** Where Sentry receives error reports (US and EU regions). */
export const SENTRY_INGEST = ["https://*.ingest.sentry.io", "https://*.ingest.us.sentry.io", "https://*.ingest.de.sentry.io"];

/** The policy for an app talking to this API (and Socket.io server). */
export function cspFor({ apiUrl = PRODUCTION_API, socketUrl, extraConnect = [] } = {}) {
  const api = originOf(apiUrl);
  const socket = originOf(socketUrl || String(apiUrl).replace(/\/api\/?$/, ""));
  // Sentry's ingest hosts (error reports; used only when VITE_SENTRY_DSN is set).
  const connect = [...new Set(["'self'", api, socket, wsOriginOf(socket), ...SENTRY_INGEST, ...extraConnect].filter(Boolean))];
  const directives = [
    ["default-src", ["'self'"]],
    ["script-src", ["'self'"]],
    // React and the UI kit set some inline styles.
    ["style-src", ["'self'", "'unsafe-inline'"]],
    // Our uploads (Cloudinary), Google profile pictures, QR codes and previews of picked files.
    ["img-src", ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://*.googleusercontent.com"]],
    ["font-src", ["'self'"]],
    ["connect-src", connect],
    ["media-src", ["'self'", "blob:"]],
    ["worker-src", ["'self'", "blob:"]],
    ["manifest-src", ["'self'"]],
    ["frame-src", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
  ];
  return directives.map(([k, v]) => `${k} ${v.join(" ")}`).join("; ");
}

/** Browser features the app may use: the camera for barcode scanning, nothing else. */
export const PERMISSIONS_POLICY = "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), magnetometer=(), gyroscope=(), accelerometer=(), browsing-topics=()";

export const HSTS = "max-age=63072000; includeSubDomains";
