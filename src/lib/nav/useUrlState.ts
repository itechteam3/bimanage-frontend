import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

// A filter, search or tab kept in the URL query (?status=paid&q=ada), so
// Back, refresh and shared links all return to the same view. Changes
// replace the current history entry: typing a search doesn't add a Back step.
//
// Several changes in one event (e.g. "choose a status" + "go back to page 1")
// must build on each other: React Router's updater sees the query from the
// last render, so the second change would undo the first. `pending` holds the
// query being built until the event finishes.
let pending: URLSearchParams | null = null;

export function useUrlState<T extends string>(key: string, fallback: T, allowed?: readonly T[]): [T, (next: T) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get(key);
  const value = (raw !== null && (!allowed || (allowed as readonly string[]).includes(raw)) ? raw : fallback) as T;

  const set = useCallback(
    (next: T) => {
      const p = new URLSearchParams(pending ?? params);
      if (next === fallback || next === "") p.delete(key);
      else p.set(key, next);
      if (!pending) queueMicrotask(() => (pending = null));
      pending = p;
      setParams(new URLSearchParams(p), { replace: true, preventScrollReset: true });
    },
    [fallback, key, params, setParams]
  );

  return [value, set];
}
