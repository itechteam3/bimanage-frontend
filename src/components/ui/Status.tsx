import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// BiManage / Status (Figma 1850:1361): pill, 12/18 semibold.
export type StatusTone = "success" | "warning" | "danger" | "neutral" | "live";

const tones: Record<StatusTone, string> = {
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  neutral: "bg-neutral-bg text-neutral",
  live: "bg-success-bg text-success",
};

export function Status({ tone = "neutral", children, className }: { tone?: StatusTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        // One line normally; wraps (never overflows) when its column is narrower than the label.
        "inline-flex min-h-status max-w-full items-center gap-1.5 rounded-full px-3 py-0.5 text-body-sm font-semibold",
        tones[tone],
        className
      )}
    >
      {tone === "live" && <span aria-hidden="true" className="size-2 rounded-full bg-success" />}
      {children}
    </span>
  );
}
