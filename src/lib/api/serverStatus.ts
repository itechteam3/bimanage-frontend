import { useSyncExternalStore } from "react";

// Render's free plan sleeps the backend after ~15 idle minutes; the first
// request can take up to a minute. The UI shows a "waking the server"
// banner while status is "waking".
export type ServerStatus = "unknown" | "waking" | "up" | "unreachable";

let status: ServerStatus = "unknown";
const listeners = new Set<() => void>();

export const serverStatus = {
  get: () => status,
  set(next: ServerStatus) {
    if (next === status) return;
    status = next;
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export const useServerStatus = () =>
  useSyncExternalStore(serverStatus.subscribe, serverStatus.get, serverStatus.get);
