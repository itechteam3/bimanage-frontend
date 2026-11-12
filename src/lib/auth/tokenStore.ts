// The session JWT (7-day, from the backend). Kept in localStorage so a
// reload keeps you signed in; every access is guarded because storage can
// be unavailable (private mode, blocked site data).
const KEY = "bimanage.session";

let memory: string | null = null;
// false once localStorage refuses a write (then memory is the only copy).
let storageOk = true;

export const tokenStore = {
  key: KEY,
  get(): string | null {
    try {
      // localStorage is the shared source of truth across tabs; memory is
      // only a fallback when storage is unavailable.
      return storageOk ? window.localStorage.getItem(KEY) : memory;
    } catch {
      return memory;
    }
  },
  set(token: string): void {
    memory = token;
    try {
      window.localStorage.setItem(KEY, token);
      storageOk = true;
    } catch {
      storageOk = false;
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
