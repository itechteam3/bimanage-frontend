// Error tracking (Sentry, free tier): only when VITE_SENTRY_DSN is set at
// build time. The SDK is loaded as its own chunk after start-up, so builds
// without a DSN don't download it at all.
//
// Privacy: the browser SDK sends no personal data by default, and every event is scrubbed before it
// leaves the browser (scrubEvent): no request data, cookies or headers, no
// query strings (tokens, codes, emails live there), user = id only, and
// emails / phone numbers removed from messages, exceptions and breadcrumbs.
// Release = the deployed commit (__APP_VERSION__), so errors map to a deploy.

import { APP_VERSION } from "@/lib/version";

type Dict = Record<string, unknown>;
type SentryLike = { captureException: (e: unknown, ctx?: Dict) => unknown };

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /(?:\+?234|0)[789][01]\d{8}\b|\+?\d[\d\s-]{9,}\d/g;
const SECRET = /Bearer\s+[A-Za-z0-9._-]+|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

/** Remove emails, phone numbers and tokens from text. */
export const scrubText = (s: unknown) => (typeof s === "string" ? s.replace(SECRET, "[secret]").replace(EMAIL, "[email]").replace(PHONE, "[phone]") : s);
/** A URL without its query string or fragment. */
export const stripQuery = (u: unknown) => (typeof u === "string" ? u.split(/[?#]/)[0] : u);

/** beforeSend: strip everything personal from an event (pure, tested). */
export function scrubEvent<T extends Dict>(event: T): T {
  const e = event as Dict & {
    request?: Dict;
    user?: Dict;
    message?: string;
    exception?: { values?: Array<{ value?: string }> };
    breadcrumbs?: Array<Dict & { data?: Dict; message?: string }>;
    extra?: Dict;
  };
  if (e.request) e.request = { url: stripQuery(e.request.url) };
  if (e.user) e.user = e.user.id ? { id: String(e.user.id) } : undefined;
  if (e.message) e.message = scrubText(e.message) as string;
  for (const v of e.exception?.values ?? []) v.value = scrubText(v.value) as string;
  if (e.extra) e.extra = JSON.parse(String(scrubText(JSON.stringify(e.extra)))) as Dict;
  if (e.breadcrumbs) e.breadcrumbs = e.breadcrumbs.filter((b) => b.category !== "ui.input").map(scrubBreadcrumb);
  return event;
}

/** beforeBreadcrumb: no query strings in recorded URLs, no personal text. */
export function scrubBreadcrumb<T extends Dict & { data?: Dict; message?: string }>(b: T): T {
  const out = { ...b, message: scrubText(b.message) as string | undefined };
  if (b.data) out.data = Object.fromEntries(Object.entries(b.data).map(([k, v]) => [k, k === "url" || k === "from" || k === "to" ? stripQuery(v) : scrubText(v)]));
  return out;
}

let sentry: SentryLike | null = null;

/** Start Sentry when VITE_SENTRY_DSN is set. Never throws. */
export async function initMonitoring(env: Record<string, string | undefined> = import.meta.env as unknown as Record<string, string | undefined>) {
  const dsn = env.VITE_SENTRY_DSN;
  if (!dsn || env.MODE === "test") return false;
  try {
    const Sentry = await import("@sentry/react");
    Sentry.init({
      dsn,
      release: APP_VERSION,
      environment: env.VITE_SENTRY_ENVIRONMENT || env.MODE,
      sampleRate: 1,
      tracesSampleRate: 0,
      maxBreadcrumbs: 30,
      beforeSend: (event) => scrubEvent(event as unknown as Dict) as unknown as typeof event,
      beforeBreadcrumb: (b) => scrubBreadcrumb(b as unknown as Dict & { data?: Dict; message?: string }) as unknown as typeof b,
    });
    sentry = Sentry;
    return true;
  } catch {
    return false;
  }
}

/** Report an error that reached an error screen (no-op without a DSN). */
export function reportError(error: unknown, area = "route") {
  try {
    sentry?.captureException(error, { tags: { area } });
  } catch {
    /* never let reporting break the page */
  }
}
