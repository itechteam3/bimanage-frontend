import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// The 26 Nov 2026 "flow" template (selling channels, shared inventory):
// a warm header band with the title and lead, a hero card, four summary
// tiles with a coloured indicator, a main card beside a side column, an
// actions band and a footnote. Figma e.g. 4370:2242 "Business selling channels".

export type TileTone = "teal" | "violet" | "blue" | "gold";

const TILE: Record<TileTone, { bg: string; ink: string; bar: string }> = {
  teal: { bg: "bg-success-bg", ink: "text-accent-green", bar: "bg-accent-green" },
  violet: { bg: "bg-surface-tint-violet", ink: "text-accent-lavender", bar: "bg-accent-lavender" },
  blue: { bg: "bg-surface-tint-blue", ink: "text-accent-blue", bar: "bg-accent-blue" },
  gold: { bg: "bg-surface-tint-gold", ink: "text-accent-gold", bar: "bg-accent-gold" },
};

export function FlowPage({ title, lead, children }: { title: ReactNode; lead?: ReactNode; children: ReactNode }) {
  return (
    <div className="relative flex flex-col gap-8">
      <div aria-hidden="true" className="pointer-events-none absolute -inset-x-5 -top-5 h-[300px] bg-surface-tint-gold lg:-inset-x-12 lg:-top-6 lg:h-[330px]" />
      <div className="relative flex flex-col gap-2">
        <h1 className="text-title-lg text-ink-strong lg:text-[26px] lg:leading-[39px]">{title}</h1>
        {lead && <p className="max-w-3xl text-[13px] leading-5 text-ink-muted">{lead}</p>}
      </div>
      <div className="relative flex flex-col gap-8">{children}</div>
    </div>
  );
}

/** Hero card: a warm accent dot, title, body and a small uppercase line. */
export function FlowHero({ title, children, eyebrow, icon }: { title: ReactNode; children: ReactNode; eyebrow?: string; icon?: ReactNode }) {
  return (
    <section className="flex gap-[18px] rounded-lg border border-line-card bg-surface-card p-[18px]">
      <span aria-hidden="true" className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-surface-tint-gold text-accent-gold">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-3">
        <h2 className="text-[19px] font-semibold leading-7 text-ink-strong">{title}</h2>
        <p className="text-caption text-ink-muted">{children}</p>
        {eyebrow && <p className="text-[10px] font-medium uppercase leading-[15px] tracking-[0.02em] text-accent-gold">{eyebrow}</p>}
      </div>
    </section>
  );
}

export function FlowTiles({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">{children}</div>;
}

/** Summary tile: label, big value, coloured caption and indicator. */
export function FlowTile({ tone, label, value, caption, icon }: { tone: TileTone; label: string; value: ReactNode; caption: ReactNode; icon?: ReactNode }) {
  const t = TILE[tone];
  return (
    <div className={cn("relative flex min-w-0 flex-col overflow-hidden rounded-lg border border-line-card px-[14px] pb-5 pt-3", t.bg)}>
      <span aria-hidden="true" className={cn("absolute right-[14px] top-[13px] flex size-[29px] items-center justify-center rounded-full bg-surface-card", t.ink)}>
        {icon}
      </span>
      <span className="pr-9 text-[11px] font-medium leading-4 text-ink-muted">{label}</span>
      <span className="mt-4 break-words text-[22px] font-semibold leading-[33px] text-ink-strong">{value}</span>
      <span className={cn("mt-3 text-[10px] leading-[15px]", t.ink)}>{caption}</span>
      <span aria-hidden="true" className={cn("absolute inset-x-0 bottom-0 h-[3px]", t.bar)} />
    </div>
  );
}

/** Main card beside a side column (stacked on phones). */
export function FlowColumns({ main, side }: { main: ReactNode; side: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-[18px] lg:grid-cols-[minmax(0,736fr)_minmax(0,386fr)]">
      <div className="min-w-0">{main}</div>
      <div className="flex min-w-0 flex-col gap-[19px]">{side}</div>
    </div>
  );
}

export function FlowCard({ title, subtitle, children, className }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col rounded-lg border border-line-card bg-surface-card p-[18px]", className)}>
      <h2 className="text-title-sm text-ink-strong">{title}</h2>
      {subtitle && <p className="mt-1 text-[11px] leading-4 text-ink-muted">{subtitle}</p>}
      <div className="mt-6 flex flex-col gap-6">{children}</div>
    </section>
  );
}

/** Rule rows in the side card ("One BiManage account" …), alternating warm and plain. */
export function FlowRules({ title, rules }: { title: ReactNode; rules: Array<{ title: string; body: ReactNode }> }) {
  return (
    <section className="flex flex-col gap-[18px] rounded-lg border border-line-card bg-surface-card p-[17px]">
      <h2 className="text-[17px] font-semibold leading-[26px] text-ink-strong">{title}</h2>
      <ul className="flex flex-col gap-[10px]">
        {rules.map((r, i) => (
          <li key={r.title} className={cn("flex gap-3 rounded-sm px-3 py-[10px]", i % 2 ? "bg-surface-page" : "bg-surface-tint-gold")}>
            <span aria-hidden="true" className="mt-[6px] size-[7px] shrink-0 rounded-full bg-accent-gold" />
            <span className="flex flex-col gap-[11px]">
              <span className="text-caption font-semibold text-ink-strong">{r.title}</span>
              <span className="text-[11px] leading-4 text-ink-muted">{r.body}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FlowActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 rounded-lg bg-surface-tint-blue p-[17px] md:flex-row md:flex-wrap md:items-center md:gap-10">{children}</div>;
}

export function FlowFootnote({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-line-card bg-surface-card px-5 py-6 lg:px-[54px]">
      <p className="text-body-lg font-semibold text-ink-strong">{title}</p>
      <p className="text-[11px] leading-4 text-ink-muted">{children}</p>
    </section>
  );
}
