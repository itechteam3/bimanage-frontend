import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

// A filter, search or tab kept in the URL query (?status=paid&q=ada), so
// Back, refresh and shared links all return to the same view. Changes
// replace the current history entry: typing a search doesn't add a Back step.
export function useUrlState<T extends string>(key: string, fallback: T, allowed?: readonly T[]): [T, (next: T) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get(key);
  const value = (raw !== null && (!allowed || (allowed as readonly string[]).includes(raw)) ? raw : fallback) as T;

  const set = useCallback(
    (next: T) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === fallback || next === "") p.delete(key);
          else p.set(key, next);
          return p;
        },
        { replace: true, preventScrollReset: true }
      );
    },
    [fallback, key, setParams]
  );

  return [value, set];
}
