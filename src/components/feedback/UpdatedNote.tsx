import { useRef } from "react";
import { cn } from "@/lib/cn";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";
import { useNow } from "@/lib/realtime/useLiveList";

/**
 * "Updated just now" under a list or figures, shown once the data has been
 * refreshed after the screen opened (a live change, reconnect or fallback
 * refresh). Says so when live updates are paused.
 */
export function UpdatedNote({ updatedAt, className }: { updatedAt: number; className?: string }) {
  const { connected } = useRealtime();
  const first = useRef<number>(0);
  if (!first.current && updatedAt) first.current = updatedAt;
  const now = useNow();
  const refreshed = updatedAt > 0 && updatedAt !== first.current;
  if (!refreshed) return null;
  const mins = Math.floor(Math.max(0, now - updatedAt) / 60_000);
  const label = mins < 1 ? "Updated just now" : `Updated ${mins} min ago`;
  return (
    <p role="status" aria-live="polite" className={cn("text-caption text-ink-muted", className)}>
      {label}
      {!connected && " · live updates paused, refreshing every minute"}
    </p>
  );
}

/** Background for a row that just arrived live. */
export const newRowClass = "bg-surface-tint-blue transition-colors duration-700";
