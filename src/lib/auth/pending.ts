// Small, short-lived values carried across the auth flow. sessionStorage so
// they vanish with the tab; every access guarded (storage can be blocked).
const read = (k: string) => {
  try {
    return window.sessionStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v === null) window.sessionStorage.removeItem(k);
    else window.sessionStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};

/** Team invite token from /invite/accept?token=…, kept while the person signs in or registers. */
export const pendingInvite = {
  get: () => read("bimanage.pendingInvite"),
  set: (token: string) => write("bimanage.pendingInvite", token),
  clear: () => write("bimanage.pendingInvite", null),
};

/** Where to go after signing in (only same-app paths). */
export const safeNext = (next: string | null | undefined, fallback = "/dashboard") =>
  // In-app paths only: no "//host", and no backslashes ("/\host" is read as another site).
  next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : fallback;

/**
 * Where to land once signed in and onboarded, picked on a public page (e.g.
 * the landing page's "Become a supplier" button). Only paths on this allowlist
 * are ever stored or returned, so it can never send anyone off the app.
 */
export const NEXT_ALLOWLIST = ["/bisupplynet/sell/apply"] as const;
const allowedNext = (v: string | null | undefined) => (v && (NEXT_ALLOWLIST as readonly string[]).includes(v) ? v : null);

export const pendingNext = {
  get: () => allowedNext(read("bimanage.pendingNext")),
  set: (path: string) => {
    if (allowedNext(path)) write("bimanage.pendingNext", path);
  },
  clear: () => write("bimanage.pendingNext", null),
};

/** Where sign-in, sign-up and Google sign-in go: a pending invite first, then a pending destination, else the fallback. */
export const afterAuthPath = (fallback: string) => (pendingInvite.get() ? "/invite/accept" : pendingNext.get() ?? fallback);
