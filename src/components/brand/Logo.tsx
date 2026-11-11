import { cn } from "@/lib/cn";

// TEMPORARY wordmark. The approved BiManage logo is an image/vector in Figma
// ("BRAND • Approved … iManage", "LOGO • BiManage / official white wordmark")
// that can't be exported until the Figma API quota resets. Replace this with
// the official SVG in src/assets/ — callers won't need to change.
export function Logo({ tone = "brand", compact = false, className }: { tone?: "brand" | "on-brand"; compact?: boolean; className?: string }) {
  const mark = tone === "on-brand" ? "bg-surface-card text-ink-brand" : "bg-brand-navy text-ink-on-brand";
  return (
    <span className={cn("inline-flex items-center gap-2", className)} aria-label="BiManage" role="img">
      <span aria-hidden="true" className={cn("flex size-9 items-center justify-center rounded-md text-card-heading", mark)}>
        B
      </span>
      {!compact && (
        <span aria-hidden="true" className={cn("text-section-title", tone === "on-brand" ? "text-ink-on-brand" : "text-ink-brand")}>
          BiManage
        </span>
      )}
    </span>
  );
}
