import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// A state that explains why something can't be done and the way forward
// (FELI 11.03 / 11.04, BiSupplyNet upgrade and permission states): icon,
// eyebrow, title, body, striped facts, an optional note and actions.
export function StateCard({ icon, eyebrow, title, body, rows, note, actions, compact, label }: { icon: ReactNode; eyebrow: string; title: string; body: ReactNode; rows: Array<[string, ReactNode]>; note?: ReactNode; actions: ReactNode; compact?: boolean; label: string }) {
  return (
    <section aria-label={label} className={cn("min-w-0 rounded-2xl border border-line-card bg-surface-card shadow-card", compact ? "p-4" : "p-5 lg:p-8")}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-tint-blue text-ink-brand">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-caption font-semibold uppercase text-ink-brand">{eyebrow}</p>
          <h2 className={cn("break-words text-ink-strong", compact ? "text-body-lg font-semibold" : "text-title-md")}>{title}</h2>
        </div>
      </div>
      <div className="mt-3 break-words text-body-sm text-ink-muted">{body}</div>
      {rows.length > 0 && (
        <dl className="mt-4 flex flex-col overflow-hidden rounded-xl">
          {rows.map(([k, v], i) => (
            <div key={k} className={cn("grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 px-3 py-3 text-body-sm", i % 2 === 0 && "bg-surface-pale")}>
              <dt className="min-w-0 font-semibold text-ink-strong">{k}</dt>
              <dd className="min-w-0 break-words text-ink-brand">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {note && <div className="mt-4 rounded-xl bg-surface-tint-blue px-4 py-3 text-body-sm text-ink-strong">{note}</div>}
      <div className="mt-5 flex flex-wrap gap-3">{actions}</div>
    </section>
  );
}

