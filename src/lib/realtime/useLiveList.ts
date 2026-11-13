import { useEffect, useRef, useState } from "react";

export const HIGHLIGHT_MS = 6_000;

/**
 * Items that appeared since the list was first shown (e.g. a new order
 * arriving live). Returns the ids to highlight for a few seconds. The first
 * load highlights nothing. Rows are never reordered here, so nothing moves
 * under the user's finger beyond what the list itself does.
 */
export function useNewItems(ids: readonly string[] | undefined): Set<string> {
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const key = ids ? ids.join(",") : null;

  useEffect(() => {
    if (!ids) return;
    if (!seen.current) {
      seen.current = new Set(ids);
      return;
    }
    const added = ids.filter((id) => !seen.current!.has(id));
    for (const id of ids) seen.current.add(id);
    if (added.length === 0) return;
    setFresh((prev) => new Set([...prev, ...added]));
    const t = setTimeout(() => setFresh((prev) => new Set([...prev].filter((id) => !added.includes(id)))), HIGHLIGHT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return fresh;
}

/** Re-render every `ms` (for "Updated 2 min ago" labels). */
export function useNow(ms = 15_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
