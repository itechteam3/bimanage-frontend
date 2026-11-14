import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { IconSearch, IconArrowRight, IconAlertTriangle } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { Button, Dialog, Field, Spinner, Status, TextArea, type StatusTone } from "@/components/ui";
import { KpiCard, type KpiTone } from "@/components/page/Blocks";
import { adminError } from "../lib/api";

// The admin page template (Figma 16.01–16.08, "CONTENT • …"): a module intro
// (#e9f3fa, "OPERATIONS" eyebrow), a toolbar (search, two filters, the main
// action), three metric cards, the records card (table on desktop, cards on
// phones) beside a guidance card, all on the shared tokens.

export function AdminPage({ title, intro, eyebrow = "Operations", actions, children }: { title: string; intro?: ReactNode; eyebrow?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-title-md text-ink-strong lg:text-title-lg">{title}</h1>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {intro && (
        <section className="rounded-xl bg-surface-tint-blue p-5 lg:px-6">
          <p className="text-label font-semibold uppercase tracking-wide text-ink-brand">{eyebrow}</p>
          <p className="mt-1 text-body-lg text-ink-strong">{intro}</p>
        </section>
      )}
      {children}
    </div>
  );
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-3 rounded-xl border border-line-card bg-surface-card p-3 shadow-card md:grid-cols-2 lg:flex lg:flex-wrap lg:items-center", className)}>{children}</div>;
}

export function SearchBox({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label?: string }) {
  return (
    <label className="relative flex min-w-0 items-center md:col-span-2 lg:min-w-72 lg:flex-1">
      <span className="sr-only">{label || placeholder}</span>
      <IconSearch aria-hidden="true" className="pointer-events-none absolute left-3 size-5 text-ink-muted" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-control-md w-full rounded-lg bg-surface-pale pl-10 pr-3 text-body-lg text-ink-strong placeholder:text-ink-muted focus:outline-none focus:shadow-focus" />
    </label>
  );
}

export function FilterSelect<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: Array<[T, string]> }) {
  return (
    <label className="min-w-0 lg:w-56">
      <span className="sr-only">{label}</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)} className="h-control-md w-full rounded-lg border border-line-default bg-surface-card px-3 text-body-lg text-ink-strong focus:outline-none focus:shadow-focus">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Metrics({ items }: { items: Array<{ tone: KpiTone; label: string; value: ReactNode; caption: string; badge?: string; note?: ReactNode }> }) {
  return (
    <div className={cn("grid gap-3 md:grid-cols-2", items.length >= 3 && "lg:grid-cols-3", items.length >= 4 && "desktop:grid-cols-4")}>
      {items.map((m) => (
        <KpiCard key={m.label} {...m} />
      ))}
    </div>
  );
}

export interface Column<T> {
  key: string;
  label: string;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Hidden on the phone card (shown elsewhere in it). */
  desktopOnly?: boolean;
}

/** Records: a table from lg, cards below. Each row can link to its page. */
export function Records<T>({ title, subtitle, columns, rows, rowKey, rowLink, empty, footer, side, loading, error, onRetry }: {
  title: string;
  subtitle?: ReactNode;
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  rowLink?: (row: T) => string;
  empty: string;
  footer?: ReactNode;
  side?: ReactNode;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
}) {
  const body = error ? (
    <ErrorBox error={error} onRetry={onRetry} />
  ) : loading && !rows ? (
    <Loading />
  ) : !rows || rows.length === 0 ? (
    <p className="rounded-lg bg-surface-pale px-4 py-6 text-center text-body-lg text-ink-secondary">{empty}</p>
  ) : (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-separate border-spacing-y-1 text-left">
          <thead>
            <tr className="bg-surface-tint-blue text-caption font-semibold uppercase text-ink-secondary">
              {columns.map((c, i) => (
                <th key={c.key} scope="col" className={cn("px-3 py-3", i === 0 && "rounded-l-lg", i === columns.length - 1 && "rounded-r-lg", c.className)}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={rowKey(r)} className={cn("text-body-lg text-ink-strong", idx % 2 === 0 ? "bg-surface-pale" : "bg-surface-card")}>
                {columns.map((c, i) => (
                  <td key={c.key} className={cn("px-3 py-3 align-middle", i === 0 && "rounded-l-lg", i === columns.length - 1 && "rounded-r-lg", c.className)}>
                    {i === 0 && rowLink ? (
                      <Link to={rowLink(r)} className="font-semibold text-ink-brand hover:underline">
                        {c.cell(r)}
                      </Link>
                    ) : (
                      c.cell(r)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-2 lg:hidden">
        {rows.map((r) => {
          const [first, ...rest] = columns;
          const content = (
            <>
              <p className="text-body-lg font-semibold text-ink-strong">{first!.cell(r)}</p>
              <dl className="mt-1 flex flex-col gap-1">
                {rest
                  .filter((c) => !c.desktopOnly)
                  .map((c) => (
                    <div key={c.key} className="flex flex-wrap items-center justify-between gap-2 text-body-sm">
                      <dt className="text-ink-muted">{c.label}</dt>
                      <dd className="min-w-0 text-right text-ink-strong">{c.cell(r)}</dd>
                    </div>
                  ))}
              </dl>
              {rowLink && (
                <p className="mt-2 flex items-center gap-1 text-body-sm font-semibold text-ink-brand">
                  Open <IconArrowRight aria-hidden="true" className="size-4" />
                </p>
              )}
            </>
          );
          return (
            <li key={rowKey(r)} className="rounded-lg border border-line-card bg-surface-pale p-4">
              {rowLink ? (
                <Link to={rowLink(r)} className="block">
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
  const card = (
    <section className="min-w-0 rounded-xl border border-line-card bg-surface-card p-4 shadow-card lg:p-5">
      <h2 className="text-title-sm text-ink-strong">{title}</h2>
      {subtitle && <p className="mt-1 text-body-sm text-ink-muted">{subtitle}</p>}
      <div className="mt-4">{body}</div>
      {footer && <div className="mt-4">{footer}</div>}
    </section>
  );
  if (!side) return card;
  return (
    <div className="grid gap-5 desktop:grid-cols-[minmax(0,2.15fr)_minmax(0,1fr)]">
      {card}
      {side}
    </div>
  );
}

/** "GUIDANCE • …" card: three short rules. */
export function Guidance({ title, rules, children }: { title: string; rules: ReactNode[]; children?: ReactNode }) {
  return (
    <aside className="flex min-w-0 flex-col gap-3 self-start rounded-xl bg-surface-pale p-5">
      <h2 className="text-label font-semibold uppercase tracking-wide text-ink-brand">{title}</h2>
      <ol className="flex flex-col gap-2">
        {rules.map((r, i) => (
          <li key={i} className={cn("rounded-xl p-3 text-body-sm text-ink-strong", i === 0 ? "bg-surface-tint-blue" : "border border-line-card bg-surface-card")}>
            {r}
          </li>
        ))}
      </ol>
      {children}
    </aside>
  );
}

export function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-3">
      <Button variant="secondary" size="md" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <span className="text-body-sm text-ink-secondary">
        Page {page} of {totalPages}
      </span>
      <Button variant="secondary" size="md" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </nav>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex justify-center py-8">
      <Spinner className="size-6 text-ink-brand" />
    </div>
  );
}

export function ErrorBox({ error, onRetry, fallback }: { error: unknown; onRetry?: () => void; fallback?: string }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-bg px-4 py-3 text-body-lg text-danger">
      <span className="flex items-center gap-2">
        <IconAlertTriangle aria-hidden="true" className="size-5 shrink-0" />
        {adminError(error, fallback)}
      </span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="font-semibold underline">
          Try again
        </button>
      )}
    </div>
  );
}

/** A section of a detail page. */
export function Section({ title, children, actions, className }: { title: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-xl border border-line-card bg-surface-card p-4 shadow-card lg:p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-title-sm text-ink-strong">{title}</h2>
        {actions}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Facts({ rows }: { rows: Array<[string, ReactNode] | null | false> }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 md:grid-cols-2">
      {rows.filter(Boolean).map((r) => {
        const [k, v] = r as [string, ReactNode];
        return (
          <div key={k} className="min-w-0">
            <dt className="text-caption font-semibold uppercase text-ink-muted">{k}</dt>
            <dd className="mt-0.5 [overflow-wrap:anywhere] text-body-lg text-ink-strong">{v ?? "—"}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Confirm a serious action with a reason (suspend, reject, decide a dispute…). */
export function ReasonDialog({ open, onClose, title, description, label, confirm, tone = "default", minLength = 10, onConfirm, pending, error, children, placeholder }: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  label: string;
  confirm: string;
  tone?: "default" | "danger";
  minLength?: number;
  onConfirm: (reason: string) => void;
  pending?: boolean;
  error?: unknown;
  children?: ReactNode;
  placeholder?: string;
}) {
  const [reason, setReason] = useState("");
  const short = reason.trim().length < minLength;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      tone={tone}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant={tone === "danger" ? "destructive" : "primary"} onClick={() => onConfirm(reason.trim())} disabled={short} loading={pending} loadingText="Working…">
            {confirm}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {children}
        {minLength > 0 && (
          <Field label={label} hint={short ? `At least ${minLength} characters.` : undefined}>
            <TextArea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} maxLength={1000} placeholder={placeholder} />
          </Field>
        )}
        {error ? <ErrorBox error={error} /> : null}
      </div>
    </Dialog>
  );
}

export function TestTag() {
  return <span className="rounded-sm border border-line-strong bg-surface-card px-1.5 py-px text-label font-semibold uppercase tracking-wide text-ink-strong">Test</span>;
}

export const dateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-NG", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
export const dateOnly = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric" }) : "—");
export const words = (v: string | null | undefined) => String(v || "").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

const TONES: Record<string, StatusTone> = {
  active: "success",
  verified: "success",
  sent: "success",
  resolved: "success",
  closed: "neutral",
  met: "success",
  completed: "success",
  delivered: "success",
  released: "success",
  processed: "success",
  added: "success",
  on_track: "neutral",
  draft: "neutral",
  cancelled: "neutral",
  open: "warning",
  pending: "warning",
  pending_approval: "warning",
  info_requested: "warning",
  under_review: "warning",
  in_progress: "warning",
  awaiting_reply: "neutral",
  scheduled: "live",
  sending: "live",
  due_soon: "warning",
  held: "warning",
  frozen: "danger",
  breached: "danger",
  suspended: "danger",
  rejected: "danger",
  failed: "danger",
  urgent: "danger",
  high: "warning",
  medium: "neutral",
  low: "neutral",
};
const LABELS: Record<string, string> = {
  info_requested: "Info requested",
  pending_approval: "Needs approval",
  on_track: "On track",
  due_soon: "Due soon",
  breached: "Overdue",
  met: "Replied in time",
  resolved_client: "Refunded buyer",
  resolved_vendor: "Paid supplier",
  resolved_partial: "Split",
  under_review: "Under review",
  awaiting_reply: "Awaiting customer",
};
export function Pill({ value, label }: { value: string | null | undefined; label?: string }) {
  const v = String(value || "");
  return <Status tone={TONES[v] ?? (v.startsWith("resolved") ? "success" : "neutral")}>{label ?? LABELS[v] ?? words(v)}</Status>;
}

export function NotAllowedNote({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-surface-pale px-4 py-3 text-body-sm text-ink-secondary">{children}</p>;
}

/** The value, once it has stopped changing for a moment (search boxes). */
export function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
