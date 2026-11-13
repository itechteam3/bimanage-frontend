import type { Query, QueryClient } from "@tanstack/react-query";

// Live updates (backend: src/realtime). The server says WHICH data changed
// ("topic"), never the data itself; we refetch through the normal API, which
// applies the user's role and permissions.

export type Topic =
  | "orders"
  | "storeOrders"
  | "store"
  | "inventory"
  | "dashboard"
  | "invoices"
  | "projects"
  | "team"
  | "wallet"
  | "notifications"
  | "messages"
  | "profile"
  | "subscription"
  | "onboarding"
  | "analytics";

export interface ChangeEvent {
  topic: Topic;
  at: string;
  id?: string;
  action?: string;
  by?: string;
}

type Key = readonly unknown[];

/** Query-key prefixes to refresh for each topic. */
export const TOPIC_KEYS: Record<Topic, Key[]> = {
  orders: [["orders"], ["onboarding", "steps"]],
  storeOrders: [["store", "orders"], ["store", "order"]],
  store: [["store"]],
  inventory: [["inventory"], ["store", "products"]],
  dashboard: [["dashboard"], ["onboarding", "steps"]],
  invoices: [["invoices"]],
  projects: [["projects"]],
  team: [["team"]],
  wallet: [["wallet"]],
  notifications: [["unread"], ["notifications"]],
  messages: [["unread"], ["messages"]],
  profile: [["business-profile"]],
  subscription: [["subscription"]],
  onboarding: [["onboarding"]],
  analytics: [["analytics"], ["store", "analytics"]],
};

/** Reference data that never changes because of a business event. */
const NEVER: Key[] = [["wallet", "banks"], ["onboarding", "packages"], ["store", "templates"]];

const startsWith = (key: readonly unknown[], prefix: Key) => prefix.every((p, i) => key[i] === p);

/** The query keys a set of topics touches (prefix match). */
export function matchesTopics(queryKey: readonly unknown[], topics: Iterable<Topic>): boolean {
  if (NEVER.some((n) => startsWith(queryKey, n))) return false;
  for (const t of topics) if ((TOPIC_KEYS[t] ?? []).some((p) => startsWith(queryKey, p))) return true;
  return false;
}

/**
 * Mark matching queries stale; the ones on screen refetch now, the rest when
 * next shown. Returns how many queries matched.
 */
export function invalidateTopics(qc: QueryClient, topics: Iterable<Topic>) {
  const list = [...topics];
  let n = 0;
  const predicate = (q: Query) => {
    const hit = matchesTopics(q.queryKey, list);
    if (hit) n += 1;
    return hit;
  };
  void qc.invalidateQueries({ predicate });
  return n;
}
