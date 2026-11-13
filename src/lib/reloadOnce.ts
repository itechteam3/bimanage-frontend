import { reloader } from "@/components/feedback/VersionBanner";

// After a deploy, an open tab can ask for page files that no longer exist
// ("Failed to fetch dynamically imported module"). Reload once to pick up
// the new version, instead of showing an error. Never loops: at most one
// automatic reload a minute.

const KEY = "bimanage.reloadedForUpdateAt";

export const isStaleBuildError = (err: unknown) =>
  /dynamically imported module|Importing a module script failed|error loading dynamically imported|Failed to fetch dynamically|ChunkLoadError|Unable to preload CSS/i.test(
    String((err as { message?: string } | null)?.message ?? err ?? "")
  );

/** Reload the page unless we already did in the last minute. Returns whether it reloaded. */
export function reloadForNewVersion(now = Date.now()): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(KEY) || 0);
    if (now - last < 60_000) return false;
    window.sessionStorage.setItem(KEY, String(now));
  } catch {
    /* storage blocked: still reload once */
  }
  reloader.reload();
  return true;
}
