import { useCallback, useEffect } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";

// A record of this tab's in-app history, so "Back" knows whether there is a
// previous view to return to (and what it is). Kept in sessionStorage so it
// survives a refresh; location keys tell us where we are after Back/Forward.

interface Entry {
  key: string;
  path: string; // pathname + search
}
const STORE = "bimanage.nav";
const MAX = 50;

let stack: Entry[] = [];
let index = -1;

function load() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE) || "null") as { stack: Entry[]; index: number } | null;
    if (saved && Array.isArray(saved.stack)) {
      stack = saved.stack;
      index = saved.index;
    }
  } catch {
    /* private mode: memory only */
  }
}
function save() {
  try {
    sessionStorage.setItem(STORE, JSON.stringify({ stack, index }));
  } catch {
    /* ignore */
  }
}
load();

/** Called on every location change (see useTrackHistory). Exported for tests. */
export function record(type: "PUSH" | "REPLACE" | "POP", entry: Entry) {
  if (type === "PUSH") {
    stack = [...stack.slice(0, index + 1), entry].slice(-MAX);
    index = stack.length - 1;
  } else if (type === "REPLACE" && index >= 0) {
    stack[index] = entry;
  } else {
    const at = stack.findIndex((e) => e.key === entry.key);
    if (at >= 0) {
      index = at;
      stack[at] = entry;
    } else {
      // First load, or a history entry we never saw: start over here.
      stack = [entry];
      index = 0;
    }
  }
  save();
}

export function resetHistory() {
  stack = [];
  index = -1;
  save();
}

/** Is there an earlier view from this app in this tab? */
export const hasInAppHistory = () => index > 0;
/** The view "Back" would return to, if any. */
export const previousPath = () => (index > 0 ? (stack[index - 1]?.path ?? null) : null);

/** Mount once near the root. */
export function useTrackHistory() {
  const location = useLocation();
  const type = useNavigationType();
  useEffect(() => {
    record(type, { key: location.key, path: location.pathname + location.search });
  }, [location.key, location.pathname, location.search, type]);
}

const pathOnly = (p: string) => (p.split(/[?#]/)[0] ?? "").replace(/\/+$/, "");

/**
 * After a save or delete, go to `to`. If the previous view is that same
 * page (e.g. the filtered list you opened the form from), step back to it
 * so its filters and scroll return; otherwise replace the form with `to`,
 * so Back doesn't reopen a form that's already been submitted.
 */
export function useReturnTo() {
  const navigate = useNavigate();
  return useCallback(
    (to: string, state?: unknown) => {
      const prev = previousPath();
      if (!state && prev && pathOnly(prev) === pathOnly(to)) navigate(-1);
      else navigate(to, { replace: true, state });
    },
    [navigate]
  );
}
