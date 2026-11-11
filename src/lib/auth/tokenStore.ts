// The session JWT (7-day, from the backend). Kept in localStorage so a
// reload keeps you signed in; every access is guarded because storage can
// be unavailable (private mode, blocked site data).
const KEY = "bimanage.session";

let memory: string | null = null;

export const tokenStore = {
  get(): string | null {
    try {
      return window.localStorage.getItem(KEY) ?? memory;
    } catch {
      return memory;
    }
  },
  set(token: string): void {
    memory = token;
    try {
      window.localStorage.setItem(KEY, token);
    } catch {
      /* memory only */
    }
  },
  clear(): void {
    memory = null;
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};
