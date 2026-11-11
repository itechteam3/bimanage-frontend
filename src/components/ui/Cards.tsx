import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { IconArrowUpRight, IconArrowDownRight } from "@tabler/icons-react";
import { cn } from "@/lib/cn";

/** Plain white card — finance, tables and forms (DS guidance 1917:1431). */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn("rounded-lg border border-line-default bg-surface-card p-4 lg:rounded-2xl lg:p-6", className)}>
      {children}
    </section>
  );
}

// BiManage / Metric card / Premium (Figma 1917:1434).
export interface MetricCardProps {
  label: string;
  value: ReactNode;
  /** e.g. "12.8% this month"; sign decides the arrow and colour. */
  change?: { value: string; direction: "up" | "down" | "flat" };
  footnote?: string;
  className?: string;
}

export function MetricCard({ label, value, change, footnote, className }: MetricCardProps) {
  return (
    <section className={cn("flex flex-col gap-1 rounded-icon border border-line-subtle bg-surface-card p-5 lg:p-6", className)}>
      <h3 className="text-body-sm font-semibold uppercase text-ink-muted">{label}</h3>
      <p className="text-title-md text-ink-brand lg:text-metric">{value}</p>
      {change && (
        <p
          className={cn(
            "flex items-center gap-1 text-body-sm font-semibold",
            change.direction === "up" && "text-success",
            change.direction === "down" && "text-danger",
            change.direction === "flat" && "text-ink-muted"
          )}
        >
          {change.direction === "up" && <IconArrowUpRight aria-hidden="true" className="size-4" />}
          {change.direction === "down" && <IconArrowDownRight aria-hidden="true" className="size-4" />}
          <span>
            <span className="sr-only">{change.direction === "up" ? "Up " : change.direction === "down" ? "Down " : ""}</span>
            {change.value}
          </span>
        </p>
      )}
      {footnote && <p className="text-micro text-ink-muted">{footnote}</p>}
    </section>
  );
}

// BiManage / Premium info card (Figma 1917:1439) — tinted, for promotion/context.
export interface InfoCardProps {
  eyebrow: string;
  title: string;
  body?: ReactNode;
  action?: { label: string; to: string };
  tone?: "blue" | "aqua" | "lavender" | "warm";
  className?: string;
}

const tints = {
  blue: "bg-surface-tint-blue",
  aqua: "bg-surface-tint-aqua",
  lavender: "bg-surface-tint-lavender",
  warm: "bg-surface-tint-warm",
} as const;

export function InfoCard({ eyebrow, title, body, action, tone = "blue", className }: InfoCardProps) {
  return (
    <section className={cn("flex flex-col gap-2 rounded-icon p-5 lg:p-6", tints[tone], className)}>
      <p className="text-caption font-semibold uppercase text-ink-brand">{eyebrow}</p>
      <h3 className="text-section-title text-ink-strong">{title}</h3>
      {body && <div className="text-body-sm text-ink-muted">{body}</div>}
      {action && (
        <Link to={action.to} className="mt-1 inline-flex items-center gap-1 self-start text-body-sm font-semibold text-ink-brand hover:underline">
          {action.label}
          <IconArrowUpRight aria-hidden="true" className="size-4" />
        </Link>
      )}
    </section>
  );
}

// BiManage / Guided empty state (Figma 1917:1444).
export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, body, action, className }: EmptyStateProps) {
  return (
    <section className={cn("flex flex-col items-start gap-3 rounded-2xl border border-line-subtle bg-surface-card p-6", className)}>
      <div aria-hidden="true" className="flex size-empty-icon items-center justify-center rounded-xl bg-surface-tint-blue text-ink-brand">
        {icon}
      </div>
      <h3 className="text-section-title text-ink-strong">{title}</h3>
      {body && <div className="text-body-sm text-ink-muted">{body}</div>}
      {action}
    </section>
  );
}
