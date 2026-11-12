import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export const initialsOf = (name?: string | null) =>
  (name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

/**
 * The signed-in person's photo — only ever their own upload or their own
 * Google picture (set by the server) — or their initials on a brand circle.
 * One size everywhere (Figma sidebar avatar, 36px) unless a page needs a
 * large preview.
 */
export function Avatar({ name, src, size = "default", className }: { name?: string | null; src?: string | null; size?: "default" | "large"; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const cls = cn(size === "large" ? "size-24 text-title-md" : "size-avatar-sidebar text-body-sm", "shrink-0 rounded-full", className);
  if (src && !failed) {
    // no-referrer: Google profile pictures refuse some cross-site referrers.
    return <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={cn(cls, "object-cover")} />;
  }
  return (
    <span aria-hidden="true" className={cn(cls, "flex items-center justify-center bg-brand-navy-mid font-semibold text-ink-on-brand")}>
      {initialsOf(name)}
    </span>
  );
}
