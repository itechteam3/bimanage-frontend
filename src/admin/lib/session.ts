// The admin session (Phase 16, decision A1): separate from the business
// sign-in. Its own key, so signing in or out of /admin never touches the
// business session, and a business token never works here (the backend uses a
// separate secret and audience too). Every storage access is guarded.

const KEY = "bimanage.admin.session";
let memory: string | null = null;
type Listener = (reason: "signed-out" | "ended") => void;
const listeners = new Set<Listener>();

export const adminSession = {
  key: KEY,
  get(): string | null {
    try {
      return window.localStorage.getItem(KEY) ?? memory;
    } catch {
      return memory;
    }
  },
  set(token: string) {
    memory = token;
    try {
      window.localStorage.setItem(KEY, token);
    } catch {
      /* memory only */
    }
  },
  clear(reason: "signed-out" | "ended" = "signed-out") {
    memory = null;
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* nothing stored */
    }
    listeners.forEach((l) => l(reason));
  },
  onClear(l: Listener): () => void {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

// The short-lived step between password and two-step code (5 minutes, server side).
const STEP_KEY = "bimanage.admin.step";
export const adminStep = {
  get(): { token: string; kind: "2fa" | "enrol"; email: string } | null {
    try {
      const raw = window.sessionStorage.getItem(STEP_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  set(v: { token: string; kind: "2fa" | "enrol"; email: string }) {
    try {
      window.sessionStorage.setItem(STEP_KEY, JSON.stringify(v));
    } catch {
      /* the page keeps it in state too */
    }
  },
  clear() {
    try {
      window.sessionStorage.removeItem(STEP_KEY);
    } catch {
      /* nothing stored */
    }
  },
};
