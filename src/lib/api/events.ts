// App-wide signals raised by the API client, handled once in the shell
// (upgrade dialog, session-expired screen, suspended notice).
export type UpgradeReason =
  | { kind: "plan"; feature?: string; currentPlan?: string; message: string }
  | { kind: "credits"; creditsRemaining?: number; creditsNeeded?: number; resetsAt?: string; message: string }
  | { kind: "feli-limit"; dailyLimit?: number; message: string };

export interface ApiEventMap {
  "upgrade-required": UpgradeReason;
  /** `ended`: signed out on purpose elsewhere (password change, "sign out of all other devices"). */
  "session-expired": { message: string; ended?: boolean };
  suspended: { message: string };
  /** The account is in its closure grace period: only restore is possible. */
  "account-closing": { purgeAt: string | null };
  /** This device was given a fresh session token (the live connection reconnects with it). */
  "session-renewed": Record<string, never>;
}

type Handler<K extends keyof ApiEventMap> = (detail: ApiEventMap[K]) => void;

// Typed at the API surface; stored loosely inside.
const handlers = new Map<keyof ApiEventMap, Set<(detail: never) => void>>();

export const apiEvents = {
  on<K extends keyof ApiEventMap>(type: K, handler: Handler<K>): () => void {
    let set = handlers.get(type);
    if (!set) handlers.set(type, (set = new Set()));
    const h = handler as (detail: never) => void;
    set.add(h);
    return () => {
      set.delete(h);
    };
  },
  emit<K extends keyof ApiEventMap>(type: K, detail: ApiEventMap[K]): void {
    handlers.get(type)?.forEach((h) => (h as Handler<K>)(detail));
  },
};
