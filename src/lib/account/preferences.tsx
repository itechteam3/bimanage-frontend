import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Spinner } from "@/components/ui";
import { START_PAGES, useWorkspacePreferences, type WorkspacePreferences } from "./api";

// Workspace preferences (13.03) applied to the app:
// - "reduce motion" and "larger text" are classes on <html> (index.css honours them);
// - after sign-in the app opens on the chosen start page.

const CACHE_KEY = "bimanage.display";
type Display = Pick<WorkspacePreferences, "reduceMotion" | "largerText">;

export function applyDisplay(d: Display | null) {
  const html = document.documentElement;
  html.classList.toggle("reduce-motion", Boolean(d?.reduceMotion));
  html.classList.toggle("larger-text", Boolean(d?.largerText));
  try {
    if (d) window.localStorage.setItem(CACHE_KEY, JSON.stringify({ reduceMotion: d.reduceMotion, largerText: d.largerText }));
    else window.localStorage.removeItem(CACHE_KEY);
  } catch {
    /* storage unavailable: the classes still apply for this visit */
  }
}

/** On start-up: apply the last known display settings before the server answers (no flash). */
export function applyCachedDisplay() {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (raw) applyDisplay(JSON.parse(raw) as Display);
  } catch {
    /* ignore */
  }
}

/** Inside the signed-in shell: keep <html> in step with the saved preferences. */
export function DisplayPreferences() {
  const prefs = useWorkspacePreferences();
  const data = prefs.data;
  useEffect(() => {
    if (data) applyDisplay(data);
  }, [data]);
  // Signed out: personal display settings stop applying.
  useEffect(() => () => applyDisplay(null), []);
  return null;
}

/** "/" after sign-in: open the chosen start page (the dashboard if none or it can't load). */
export function StartRedirect() {
  const prefs = useWorkspacePreferences();
  if (prefs.isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-ink-brand" role="status">
        <Spinner className="size-8" />
        <span className="sr-only">Opening your workspace…</span>
      </div>
    );
  }
  const to = (prefs.data && START_PAGES[prefs.data.startPage]?.to) || "/dashboard";
  return <Navigate to={to} replace />;
}
