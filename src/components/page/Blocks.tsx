import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// Recurring layout blocks on app screens (Figma 02.xx, 03.xx, 07.xx).

/** Page title — "Business dashboard", "Startup packages" (27–28px semibold). */
export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <h1 className="text-title-lg text-ink-strong lg:text-page-title">{children}</h1>
      {actions}
    </div>
  );
}

/** "UX • State introduction" — pale card with eyebrow, title and body (07.13, 03.02 "DASHBOARD • Intro"). */
export function IntroCard({ eyebrow, title, children, className }: { eyebrow: string; title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl bg-surface-pale px-5 py-4 shadow-card lg:px-6 lg:py-5", className)}>
      <p className="text-caption font-semibold uppercase text-ink-brand">{eyebrow}</p>
      <h2 className="mt-2 text-section-title text-ink-strong">{title}</h2>
      {children && <div className="mt-2 text-body-sm text-ink-muted">{children}</div>}
    </section>
  );
}

/** "UX • Journey overview" — four numbered steps, the current one highlighted. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol aria-label="Progress" className="grid grid-cols-2 gap-1.5 rounded-lg border border-line-card bg-surface-card p-2 md:grid-cols-4 md:p-2">
      {steps.map((label, i) => {
        const active = i === current;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className={cn("rounded-md px-2.5 py-2 text-body-sm", active ? "bg-surface-tint-blue font-semibold text-ink-brand" : i < current ? "text-ink-strong" : "text-ink-muted")}
          >
            {String(i + 1).padStart(2, "0")}&nbsp;&nbsp;{label}
          </li>
        );
      })}
    </ol>
  );
}

/** White card with outline and soft shadow ("UX • Relevant account details"). */
export function Panel({ title, subtitle, children, className, tone = "card" }: { title?: ReactNode; subtitle?: ReactNode; children?: ReactNode; className?: string; tone?: "card" | "pale" }) {
  return (
    // min-w-0: as a grid/flex child, never let wide content (tables) widen the page
    <section className={cn("min-w-0 rounded-2xl p-5 shadow-card lg:p-6", tone === "card" ? "border border-line-card bg-surface-card" : "bg-surface-pale", className)}>
      {title && <h2 className="text-title-sm text-ink-strong">{title}</h2>}
      {subtitle && <p className="mt-1 text-body-sm text-ink-muted">{subtitle}</p>}
      {children && <div className={cn(title || subtitle ? "mt-4" : "")}>{children}</div>}
    </section>
  );
}

/** Numbered tips in a pale side panel ("01  Know what you are buying"). */
export function TipList({ title, tips }: { title: string; tips: Array<{ title: string; body: ReactNode }> }) {
  return (
    <Panel tone="pale" title={title}>
      <ol className="flex flex-col gap-6">
        {tips.map((t, i) => (
          <li key={t.title}>
            <p className="text-body-lg font-semibold text-ink-brand">
              <span className="mr-3">{String(i + 1).padStart(2, "0")}</span>
              {t.title}
            </p>
            <p className="mt-2 text-body-sm text-ink-muted">{t.body}</p>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/** Bottom help strip with an optional action ("Need to compare first?"). */
export function InfoStrip({ title, children, action, tone = "pale" }: { title: string; children: ReactNode; action?: ReactNode; tone?: "pale" | "warm" }) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-xl px-5 py-4 md:flex-row md:items-start md:justify-between", tone === "warm" ? "bg-surface-tint-warm" : "bg-surface-pale")}>
      <div>
        <h2 className="text-body-lg font-semibold text-ink-strong">{title}</h2>
        <div className="mt-2 text-body-sm text-ink-muted">{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </section>
  );
}

/** Two-column label/value rows ("Package — Starter"). */
export function DetailRows({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-[minmax(0,10rem)_1fr] gap-x-4 gap-y-3 text-body-lg">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-muted">{k}</dt>
          <dd className="text-ink-strong">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** "ONE-TIME PACKAGE PRICE ₦199,999" box. */
export function PriceBox({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-pale px-4 py-4">
      <p className="text-caption font-semibold uppercase text-ink-brand">{label}</p>
      <p className="mt-2 text-title-md text-ink-brand lg:text-metric">{value}</p>
    </div>
  );
}

export type KpiTone = "revenue" | "orders" | "invoices" | "stock";
const kpiTone: Record<KpiTone, { bg: string; fg: string; line: string }> = {
  revenue: { bg: "bg-kpi-revenue-bg", fg: "text-kpi-revenue-fg", line: "text-kpi-revenue-line" },
  orders: { bg: "bg-kpi-orders-bg", fg: "text-kpi-orders-fg", line: "text-kpi-orders-line" },
  invoices: { bg: "bg-kpi-invoices-bg", fg: "text-kpi-invoices-fg", line: "text-kpi-invoices-line" },
  stock: { bg: "bg-kpi-stock-bg", fg: "text-kpi-stock-fg", line: "text-kpi-stock-line" },
};

/** KPI tile (03.02 "KPI • REVENUE"): tinted, label, big value, caption, optional sparkline. */
export function KpiCard({ tone, label, value, caption, trend }: { tone: KpiTone; label: string; value: ReactNode; caption: string; trend?: number[] }) {
  const t = kpiTone[tone];
  return (
    <section className={cn("relative flex min-h-32 flex-col justify-between overflow-hidden rounded-lg border border-line-card p-4 shadow-card", t.bg)}>
      <h3 className="text-caption font-semibold uppercase text-ink-muted">{label}</h3>
      <p className={cn("text-title-md", t.fg)}>{value}</p>
      <p className="text-caption text-ink-muted">{caption}</p>
      {trend && trend.length > 1 && <Sparkline values={trend} className={cn("absolute bottom-6 right-4 h-10 w-20", t.line)} />}
    </section>
  );
}

function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 70 + 2, 34 - ((v - min) / (max - min || 1)) * 28]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x!.toFixed(1)},${y!.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1]!;
  return (
    <svg viewBox="0 0 74 38" className={className} aria-hidden="true">
      <path d={`${line} L72,38 L2,38 Z`} fill="currentColor" opacity="0.09" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill="currentColor" stroke="var(--color-surface-card)" strokeWidth="1.2" />
    </svg>
  );
}
