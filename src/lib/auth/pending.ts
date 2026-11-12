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
  next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
