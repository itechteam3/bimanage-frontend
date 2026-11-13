import { useEffect, useState } from "react";
import { env } from "@/config/env";

// New-version check. Each production build writes /version.json with its
// build id and bakes the same id into the app (__APP_VERSION__). When the
// two differ, a newer BiManage is deployed: we offer a reload, and reload by
// ourselves on the next page change (forms already guard unsaved work).

declare const __APP_VERSION__: string;
export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

const CHECK_EVERY_MS = 5 * 60_000;

/** Fetch the deployed build id; null if unknown (offline, dev, not deployed). */
export async function fetchDeployedVersion(fetcher: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await fetcher(`${env.basePath.replace(/\/$/, "")}/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { version?: unknown };
    return typeof body.version === "string" && body.version ? body.version : null;
  } catch {
    return null;
  }
}

let outdated = false;
const listeners = new Set<() => void>();
/** True once a newer build has been seen (stays true until reload). */
export const isOutdated = () => outdated;
export const _resetVersionCheck = () => void (outdated = false);
export function markOutdated() {
  if (outdated) return;
  outdated = true;
  for (const l of listeners) l();
}

/** Checks now, on focus and every few minutes (production only). */
export function useNewVersion(current = APP_VERSION, fetcher?: typeof fetch) {
  const [isNew, setNew] = useState(outdated);
  useEffect(() => {
    const onMark = () => setNew(true);
    listeners.add(onMark);
    if (current === "dev") return () => void listeners.delete(onMark);
    let last = 0;
    const check = async () => {
      if (outdated || Date.now() - last < 30_000) return;
      last = Date.now();
      const deployed = await fetchDeployedVersion(fetcher);
      if (deployed && deployed !== current) markOutdated();
    };
    void check();
    const id = setInterval(() => document.visibilityState === "visible" && void check(), CHECK_EVERY_MS);
    const onVisible = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      listeners.delete(onMark);
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [current, fetcher]);
  return isNew;
}
