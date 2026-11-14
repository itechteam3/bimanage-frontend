import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { IconDownload, IconLock, IconSearch } from "@tabler/icons-react";
import { Button, ButtonLink, EmptyState, Field, SelectInput, Spinner, Status, TextInput } from "@/components/ui";
import { IntroCard, KpiCard, PageTitle, Panel } from "@/components/page/Blocks";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { BarChart, type BarDatum } from "@/pages/sales/SalesPages";
import { useCan } from "@/lib/auth/useCan";
import { saveBlob } from "@/lib/api/client";
import { count, naira, nairaCompact, shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useUrlState } from "@/lib/nav/useUrlState";
import {
  HEALTH,
  INVOICE_STATE,
  LEDGER_STATUS,
  RANGES,
  exportAnalytics,
  exportInventory,
  exportInvoices,
  exportLedger,
  productLink,
  useInventoryHealth,
  useInvoiceCollections,
  useReportOverview,
  useSalesLedger,
  type Health,
  type InvoiceState,
  type LedgerStatus,
  type Period,
  type RangeKey,
} from "@/lib/reports/api";

// Reports (Figma 14.01–14.04). Plan gate "analytics" sits on the routes;
// the "View analytics" permission is checked here.

const Loading = () => (
  <div className="flex justify-center py-16 text-ink-brand" role="status">
    <Spinner className="size-8" />
    <span className="sr-only">Loading…</span>
  </div>
);

/** Team members without "View analytics" see why, not an error. */
function ReportsAccess({ children }: { children: ReactNode }) {
  const allowed = useCan("viewAnalytics");
  if (allowed) return <>{children}</>;
  return (
    <EmptyState
      className="max-w-xl"
      icon={<IconLock className="size-7" />}
      title="Reports aren't available to you"
      body="Ask the business owner to give you access to analytics and reports."
      action={
        <ButtonLink to="/dashboard" variant="tonal" size="md">
          Back to dashboard
        </ButtonLink>
      }
    />
  );
}

const TABS: Array<[string, string]> = [
  ["/reports", "Overview"],
  ["/reports/sales", "Sales"],
  ["/reports/inventory", "Inventory"],
  ["/reports/invoices", "Invoices"],
];

function ReportTabs() {
  return (
    <nav aria-label="Reports" className="flex flex-wrap gap-1 rounded-xl border border-line-card bg-surface-card p-1.5">
      {TABS.map(([to, label]) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) => cn("rounded-md px-3 py-1.5 text-body-sm", isActive ? "bg-surface-tint-blue font-semibold text-ink-brand" : "text-ink-secondary hover:text-ink-brand")}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

/** Period in the URL: ?range=7d, or ?range=custom&from&to. */
function usePeriod(): [Period, (p: Period) => void] {
  const [range, setRange] = useUrlState<RangeKey>("range", "30d", RANGES.map(([r]) => r));
  const [from, setFrom] = useUrlState<string>("from", "");
  const [to, setTo] = useUrlState<string>("to", "");
  const set = (p: Period) => {
    setRange(p.range);
    setFrom(p.range === "custom" ? (p.from ?? "") : "");
    setTo(p.range === "custom" ? (p.to ?? "") : "");
  };
  return [{ range, from: from || undefined, to: to || undefined }, set];
}

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });

function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const [from, setFrom] = useState(value.from ?? "");
  const [to, setTo] = useState(value.to ?? today());
  const custom = value.range === "custom";
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div role="group" aria-label="Period" className="flex flex-wrap gap-1 text-body-sm">
        {RANGES.map(([r, l]) => (
          <button
            key={r}
            type="button"
            aria-pressed={value.range === r}
            onClick={() => onChange(r === "custom" ? { range: "custom", from: value.from, to: value.to } : { range: r })}
            className={cn("rounded-sm px-2.5 py-1", value.range === r ? "bg-surface-tint-blue font-semibold text-ink-brand" : "text-ink-secondary hover:text-ink-brand")}
          >
            {l}
          </button>
        ))}
      </div>
      {custom && (
        <form
          className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (from && to) onChange({ range: "custom", from: from <= to ? from : to, to: from <= to ? to : from });
          }}
        >
          <Field label="From">
            <TextInput type="date" value={from} max={today()} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <TextInput type="date" value={to} max={today()} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Button type="submit" size="md" variant="secondary" disabled={!from || !to}>
            Show period
          </Button>
        </form>
      )}
    </div>
  );
}

function useExport(run: () => Promise<{ blob: Blob; filename: string }>, fallbackName: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const { blob, filename } = await run();
      saveBlob(blob, filename === "download" ? fallbackName : filename);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  const button = (label: string) => (
    <Button size="md" variant="secondary" loading={busy} loadingText="Preparing…" onClick={() => void go()}>
      <IconDownload aria-hidden="true" className="size-icon" /> {label}
    </Button>
  );
  const note = <ErrorNote error={error} fallback="We couldn't prepare the export. Please try again." />;
  return { button, note };
}

/** "Paid · 3  Pending · 1": a share bar plus counts (status mix, stock health). */
function MixBar<K extends string>({ items, label }: { items: Array<{ key: K; label: string; count: number; tone: string }>; label: string }) {
  const total = items.reduce((s, i) => s + i.count, 0);
  const bg: Record<string, string> = { success: "bg-success", warning: "bg-warning", danger: "bg-danger", neutral: "bg-line-strong" };
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-disabled" role="img" aria-label={`${label}: ${items.map((i) => `${i.label} ${i.count}`).join(", ")}`}>
        {total > 0 && items.map((i) => (i.count ? <span key={i.key} className={bg[i.tone]} style={{ width: `${(i.count / total) * 100}%` }} /> : null))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-body-sm">
        {items.map((i) => (
          <li key={i.key} className="flex items-center gap-1.5 text-ink-secondary">
            <span aria-hidden="true" className={cn("size-2 rounded-full", bg[i.tone])} />
            {i.label} · <span className="font-semibold text-ink-strong">{count(i.count)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-body-sm text-ink-secondary">
      <span>
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <Button size="md" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button size="md" variant="secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

/** Search box that updates the URL once typing pauses. */
function SearchBox({ value, onChange, label, placeholder }: { value: string; onChange: (v: string) => void; label: string; placeholder: string }) {
  const [text, setText] = useState(value);
  useEffect(() => {
    if (text === value) return;
    const t = setTimeout(() => onChange(text), 350);
    return () => clearTimeout(t);
  }, [text, value, onChange]);
  return (
    <Field label={label}>
      <TextInput type="search" value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} trailing={<IconSearch aria-hidden="true" className="size-icon text-ink-muted" />} />
    </Field>
  );
}

const usePage = () => {
  const [raw, set] = useUrlState<string>("page", "1");
  const page = Math.max(1, Number.parseInt(raw, 10) || 1);
  return [page, (p: number) => set(String(p))] as const;
};

const dayLabel = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00`);
  return {
    label: days <= 7 ? d.toLocaleDateString("en-GB", { weekday: "short" }) : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    long: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
  };
};

const changeText = (c: number | null) => (c === null ? "No earlier sales to compare" : c === 0 ? "Same as the period before" : `${c > 0 ? "Up" : "Down"} ${Math.abs(c)}% on the period before`);

const periodText = (p: { from: string; to: string } | undefined) => (p ? (p.from === p.to ? shortDate(p.from) : `${shortDate(p.from)} to ${shortDate(p.to)}`) : "");

// ── 14.01 Overview ────────────────────────────────────────────────────────
export function ReportsOverviewPage() {
  return (
    <ReportsAccess>
      <Overview />
    </ReportsAccess>
  );
}

function Overview() {
  const [period, setPeriod] = usePeriod();
  const overview = useReportOverview(period);
  const exp = useExport(() => exportAnalytics(period), "analytics.csv");
  const a = overview.data;
  const series: BarDatum[] = (a?.series ?? []).map((d) => ({
    key: d.date,
    ...dayLabel(d.date, a?.series.length ?? 0),
    value: d.revenue,
    detail: d.orders ? `${count(d.orders)} order${d.orders === 1 ? "" : "s"}` : "No sales",
  }));
  const lowStock = (a?.inventory.lowStock ?? 0) + (a?.inventory.outOfStock ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <PageTitle actions={exp.button("Export analytics CSV")}>Analytics and reports</PageTitle>
      <IntroCard eyebrow="Workspace / Reports" title="A joined view of revenue, stock and collections.">
        Choose today, 7 days, 30 days, 90 days or any custom period.
      </IntroCard>
      <ReportTabs />
      {exp.note}
      <Panel>
        <PeriodPicker value={period} onChange={setPeriod} />
        {a && <p className="mt-3 text-caption text-ink-muted">Showing {periodText(a.period)}, Lagos time.</p>}
      </Panel>
      {overview.isLoading ? (
        <Loading />
      ) : overview.error || !a ? (
        <ErrorNote error={overview.error ?? true} fallback="We couldn't load your reports. Please try again." onRetry={() => void overview.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <KpiCard tone="orders" label="Revenue" value={nairaCompact(a.revenue.total)} caption={changeText(a.revenue.change)} />
            <KpiCard tone="revenue" label="Orders" value={count(a.sales.totalOrders)} caption="Paid orders in the period" />
            <KpiCard tone="invoices" label="Average order" value={nairaCompact(a.sales.averageOrderValue)} caption="Revenue per order" />
            <KpiCard tone="stock" label="Low stock" value={count(lowStock)} caption={`${count(a.inventory.outOfStock)} out of stock`} />
          </div>
          {(a.test.orders > 0 || a.test.revenue > 0) && (
            <section aria-label="Test payments" className="flex flex-col gap-1 rounded-xl border border-dashed border-line-strong bg-surface-pale px-5 py-4">
              <p className="flex flex-wrap items-center gap-2 text-body-lg font-semibold text-ink-strong">
                <Status tone="neutral">Test</Status> Test payments: {naira(a.test.revenue)} from {count(a.test.orders)} order{a.test.orders === 1 ? "" : "s"}
              </p>
              <p className="text-body-sm text-ink-muted">Not real money, and not added to revenue or orders above.</p>
            </section>
          )}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Panel title="Revenue trend" subtitle="Money taken each day: direct sales and live online store payments.">
              {series.length ? <BarChart data={series} format={naira} title="Revenue per day in the selected period" /> : <p className="py-6 text-body-lg text-ink-secondary">No days in this period.</p>}
            </Panel>
            <Panel tone="pale" title="Revenue performance">
              <ul className="flex flex-col gap-3">
                {a.channels.map((c) => (
                  <li key={c.key} data-channel={c.key} className="min-w-0 rounded-md bg-surface-card px-4 py-3">
                    <p className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-body-lg font-semibold text-ink-strong">{c.key === "online" ? "Online store" : c.key === "direct" ? "Direct sales" : "Paid invoices"}</span>
                      <span className="text-title-sm text-ink-brand">{naira(c.key === "invoices" ? c.amount : c.revenue)}</span>
                    </p>
                    <p className="text-caption text-ink-muted">
                      {c.key === "invoices" ? `${count(c.count)} invoice${c.count === 1 ? "" : "s"} · Collections, not added to revenue` : `${count(c.orders)} order${c.orders === 1 ? "" : "s"} · ${c.key === "online" ? "Online" : "In person"}`}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Panel title="Best sellers" subtitle="By units sold in the period, both channels.">
              {a.bestSellers.length === 0 ? (
                <p className="py-4 text-body-lg text-ink-secondary">No products sold in this period.</p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {a.bestSellers.map((b, i) => (
                    <li key={b.name} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md bg-surface-pale px-4 py-3 text-body-sm">
                      <span className="text-ink-muted">{String(i + 1).padStart(2, "0")}</span>
                      <span className="min-w-0">
                        <span className="block break-words font-medium text-ink-strong">{b.name}</span>
                        <span className="text-caption text-ink-muted">{count(b.quantity)} sold</span>
                      </span>
                      <span className="font-semibold text-ink-brand">{naira(b.revenue)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
            <Panel tone="pale" title="What to watch next">
              <dl className="flex flex-col gap-3">
                {(
                  [
                    ["Stock value", naira(a.inventory.stockValue), "/reports/inventory"],
                    ["Restock alerts", `${count(lowStock)} product${lowStock === 1 ? "" : "s"}`, "/reports/inventory?health=low"],
                    ["Overdue invoices", count(a.invoices.overdue), "/reports/invoices?status=overdue"],
                    ["Draft invoices", count(a.invoices.draft), "/reports/invoices?status=draft"],
                  ] as const
                ).map(([k, v, to]) => (
                  <div key={k} className="rounded-md bg-surface-card px-3 py-2">
                    <dt className="text-caption font-semibold uppercase text-ink-muted">{k}</dt>
                    <dd className="flex flex-wrap items-center justify-between gap-2 text-body-lg text-ink-strong">
                      {v}
                      <Link to={to} className="text-body-sm font-semibold text-ink-brand hover:underline">
                        View
                      </Link>
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

// ── 14.02 Sales ledger ────────────────────────────────────────────────────
export function SalesLedgerPage() {
  return (
    <ReportsAccess>
      <Ledger />
    </ReportsAccess>
  );
}

const CHANNELS = ["all", "online", "direct"] as const;
const LEDGER_STATUSES = ["all", "paid", "pending", "fulfilment", "refunded", "cancelled"] as const;

function Ledger() {
  const [period, setPeriod] = usePeriod();
  const [channel, setChannel] = useUrlState<(typeof CHANNELS)[number]>("channel", "all", CHANNELS);
  const [status, setStatus] = useUrlState<(typeof LEDGER_STATUSES)[number]>("status", "all", LEDGER_STATUSES);
  const [search, setSearch] = useUrlState<string>("q", "");
  const [test, setTest] = useUrlState<"" | "1">("test", "", ["", "1"]);
  const [page, setPage] = usePage();
  const filters = { period, channel, status, search, includeTest: test === "1", page };
  const ledger = useSalesLedger(filters);
  const exp = useExport(() => exportLedger(filters), "sales-ledger.csv");
  const d = ledger.data;
  const reset = () => setPage(1);

  return (
    <div className="flex flex-col gap-6">
      <PageTitle actions={exp.button("Export sales ledger")}>Sales ledger</PageTitle>
      <IntroCard eyebrow="Workspace / Reports" title="Find, compare and export payments by order and customer.">
        The CSV matches your active report filters.
      </IntroCard>
      <ReportTabs />
      {exp.note}
      <Panel>
        <div className="flex min-w-0 flex-col gap-4">
          <PeriodPicker
            value={period}
            onChange={(p) => {
              setPeriod(p);
              reset();
            }}
          />
          <div className="grid min-w-0 gap-3 md:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <SearchBox
              label="Search"
              placeholder="Order or customer"
              value={search}
              onChange={(v) => {
                setSearch(v);
                reset();
              }}
            />
            <Field label="Channel">
              <SelectInput
                value={channel}
                onChange={(e) => {
                  setChannel(e.target.value as typeof channel);
                  reset();
                }}
              >
                <option value="all">All channels</option>
                <option value="online">Online store</option>
                <option value="direct">Direct sales</option>
              </SelectInput>
            </Field>
            <Field label="Status">
              <SelectInput
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as typeof status);
                  reset();
                }}
              >
                <option value="all">All statuses</option>
                {(Object.keys(LEDGER_STATUS) as LedgerStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {LEDGER_STATUS[s].label}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-body-sm text-ink-strong">
            <input
              type="checkbox"
              className="size-5 accent-[var(--color-brand-navy)]"
              checked={test === "1"}
              onChange={(e) => {
                setTest(e.target.checked ? "1" : "");
                reset();
              }}
            />
            Include test payments (marked Test, never counted as revenue)
          </label>
        </div>
      </Panel>
      {ledger.isLoading ? (
        <Loading />
      ) : ledger.error || !d ? (
        <ErrorNote error={ledger.error ?? true} fallback="We couldn't load the sales ledger. Please try again." onRetry={() => void ledger.refetch()} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Panel title="Orders and transaction values" subtitle={d.period ? periodText(d.period) : undefined}>
            {d.rows.length === 0 ? (
              <p className="py-6 text-body-lg text-ink-secondary">No orders match these filters.</p>
            ) : (
              <>
                {/* Phones: stacked cards. md and up: a table. */}
                <ul className="flex flex-col gap-2 md:hidden">
                  {d.rows.map((r) => (
                    <li key={r.id} className="min-w-0 rounded-md bg-surface-pale px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link to={r.link} className="font-semibold text-ink-strong hover:underline">
                          {r.orderNumber || "Order"}
                        </Link>
                        <span className="flex flex-wrap gap-1.5">
                          {r.money === "test" && <Status tone="neutral">Test</Status>}
                          <Status tone={LEDGER_STATUS[r.status].tone}>{LEDGER_STATUS[r.status].label}</Status>
                        </span>
                      </div>
                      <p className="mt-1 break-words text-body-sm text-ink-secondary">{r.customer || "Walk-in customer"}</p>
                      <p className="mt-1 flex flex-wrap justify-between gap-2 text-caption text-ink-muted">
                        <span>
                          {shortDate(r.date)} · {r.channel === "online" ? "Online store" : "Direct sale"}
                        </span>
                        <span className="text-body-sm font-semibold text-ink-strong">{naira(r.total)}</span>
                      </p>
                    </li>
                  ))}
                </ul>
                <table className="hidden w-full table-fixed text-left text-body-sm md:table">
                  <caption className="sr-only">Sales ledger</caption>
                  <thead className="bg-surface-pale text-caption font-semibold uppercase text-ink-muted">
                    <tr>
                      <th scope="col" className="rounded-l-lg px-3 py-3">Order</th>
                      <th scope="col" className="px-3 py-3">Customer</th>
                      <th scope="col" className="px-3 py-3">Channel</th>
                      <th scope="col" className="px-3 py-3 text-right">Amount</th>
                      <th scope="col" className="rounded-r-lg px-3 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.rows.map((r) => (
                      <tr key={r.id} className="border-b border-line-subtle last:border-0">
                        <td className="px-3 py-3">
                          <Link to={r.link} className="break-words font-semibold text-ink-strong hover:underline">
                            {r.orderNumber || "Order"}
                          </Link>
                          <p className="text-caption text-ink-muted">{shortDate(r.date)}</p>
                        </td>
                        <td className="break-words px-3 py-3 text-ink-strong">{r.customer || "Walk-in customer"}</td>
                        <td className="px-3 py-3 text-ink-secondary">{r.channel === "online" ? "Online" : "Direct"}</td>
                        <td className="px-3 py-3 text-right text-ink-strong">{naira(r.total)}</td>
                        <td className="px-3 py-3">
                          <span className="flex flex-wrap gap-1.5">
                            {r.money === "test" && <Status tone="neutral">Test</Status>}
                            <Status tone={LEDGER_STATUS[r.status].tone}>{LEDGER_STATUS[r.status].label}</Status>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            <Pager page={d.page} totalPages={d.totalPages} onPage={setPage} />
          </Panel>
          <Panel tone="pale" title="Status mix">
            <MixBar label="Order status" items={d.summary.statusMix.map((m) => ({ key: m.status, label: LEDGER_STATUS[m.status]?.label ?? m.status, count: m.count, tone: LEDGER_STATUS[m.status]?.tone ?? "neutral" }))} />
            <dl className="mt-5 flex flex-col gap-3">
              <div className="rounded-md bg-surface-card px-3 py-2">
                <dt className="text-caption font-semibold uppercase text-ink-muted">Sales value</dt>
                <dd className="text-body-lg text-ink-strong">{naira(d.summary.totalValue)}</dd>
              </div>
              <div className="rounded-md bg-surface-card px-3 py-2">
                <dt className="text-caption font-semibold uppercase text-ink-muted">Orders found</dt>
                <dd className="text-body-lg text-ink-strong">{count(d.total)}</dd>
              </div>
              {filters.includeTest && (
                <div className="rounded-md border border-dashed border-line-strong bg-surface-card px-3 py-2">
                  <dt className="text-caption font-semibold uppercase text-ink-muted">Test payments shown</dt>
                  <dd className="text-body-lg text-ink-strong">{count(d.summary.testOrders)} (not in the sales value)</dd>
                </div>
              )}
            </dl>
          </Panel>
        </div>
      )}
    </div>
  );
}

// ── 14.03 Inventory health ────────────────────────────────────────────────
export function InventoryReportPage() {
  return (
    <ReportsAccess>
      <InventoryReport />
    </ReportsAccess>
  );
}

const HEALTHS = ["all", "healthy", "low", "out"] as const;

function InventoryReport() {
  const [health, setHealth] = useUrlState<(typeof HEALTHS)[number]>("health", "all", HEALTHS);
  const [category, setCategory] = useUrlState<string>("category", "");
  const [search, setSearch] = useUrlState<string>("q", "");
  const [page, setPage] = usePage();
  const filters = { health, category, search, page };
  const inv = useInventoryHealth(filters);
  const exp = useExport(() => exportInventory(filters), "inventory-report.csv");
  const d = inv.data;
  const s = d?.summary;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle actions={exp.button("Export inventory report")}>Inventory health report</PageTitle>
      <IntroCard eyebrow="Workspace / Reports" title="Understand stock values and low-stock risks.">
        Inventory is updated whenever sales or adjustments happen.
      </IntroCard>
      <ReportTabs />
      {exp.note}
      {inv.isLoading ? (
        <Loading />
      ) : inv.error || !d || !s ? (
        <ErrorNote error={inv.error ?? true} fallback="We couldn't load the inventory report. Please try again." onRetry={() => void inv.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <KpiCard tone="orders" label="Products" value={count(s.products)} caption="In your inventory" />
            <KpiCard tone="revenue" label="Units" value={count(s.units)} caption="In stock now" />
            <KpiCard tone="invoices" label="Stock value" value={nairaCompact(s.stockValue)} caption="At selling price" />
            <KpiCard tone="stock" label="Low stock" value={count(s.low + s.out)} caption={`${count(s.out)} out of stock`} />
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Panel title="Stock health">
              <MixBar
                label="Stock health"
                items={(["healthy", "low", "out"] as Health[]).map((h) => ({ key: h, label: HEALTH[h].label, count: s[h], tone: HEALTH[h].tone }))}
              />
              <div className="mt-5 grid min-w-0 gap-3 md:grid-cols-3">
                <SearchBox
                  label="Search"
                  placeholder="Product or SKU"
                  value={search}
                  onChange={(v) => {
                    setSearch(v);
                    setPage(1);
                  }}
                />
                <Field label="Health">
                  <SelectInput
                    value={health}
                    onChange={(e) => {
                      setHealth(e.target.value as typeof health);
                      setPage(1);
                    }}
                  >
                    <option value="all">All products</option>
                    {(Object.keys(HEALTH) as Health[]).map((h) => (
                      <option key={h} value={h}>
                        {HEALTH[h].label}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Category">
                  <SelectInput
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All categories</option>
                    {s.categories.map((c) => (
                      <option key={c.category} value={c.category}>
                        {c.category}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              </div>
              {category && <p className="mt-2 text-caption text-ink-muted">The export includes every category.</p>}
              {d.rows.length === 0 ? (
                <p className="py-6 text-body-lg text-ink-secondary">No products match these filters.</p>
              ) : (
                <ul className="mt-4 flex flex-col gap-2">
                  {d.rows.map((r) => (
                    <li key={r.id} className="grid min-w-0 gap-2 rounded-md bg-surface-pale px-4 py-3 text-body-sm md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
                      <span className="min-w-0">
                        <Link to={productLink(r.id)} className="block break-words font-semibold text-ink-strong hover:underline">
                          {r.name}
                        </Link>
                        <span className="break-words text-caption text-ink-muted">
                          {r.category}
                          {r.sku ? ` · ${r.sku}` : ""}
                        </span>
                      </span>
                      <span className="text-ink-secondary">
                        {count(r.stock)} unit{r.stock === 1 ? "" : "s"}
                      </span>
                      <span className="text-ink-strong">{naira(r.stockValue)}</span>
                      <span className="flex flex-wrap items-center gap-2">
                        <Status tone={HEALTH[r.health].tone}>{HEALTH[r.health].label}</Status>
                        {r.health !== "healthy" && (
                          <Link to={`${productLink(r.id)}/adjust`} className="font-semibold text-ink-brand hover:underline">
                            Restock<span className="sr-only"> {r.name}</span>
                          </Link>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Pager page={d.page} totalPages={d.totalPages} onPage={setPage} />
            </Panel>
            <div className="flex min-w-0 flex-col gap-5">
              <Panel tone="pale" title="Categories">
                {s.categories.length === 0 ? (
                  <p className="text-body-sm text-ink-secondary">No products yet.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {s.categories.map((c) => (
                      <li key={c.category} className="min-w-0 rounded-md bg-surface-card px-3 py-2">
                        <p className="flex flex-wrap justify-between gap-2">
                          <span className="break-words font-semibold text-ink-strong">{c.category}</span>
                          <span className="text-ink-brand">{naira(c.value)}</span>
                        </p>
                        <p className="text-caption text-ink-muted">
                          {count(c.products)} product{c.products === 1 ? "" : "s"} · {count(c.units)} units{c.low ? ` · ${count(c.low)} need restocking` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel tone="pale" title="Restock alerts">
                {s.restock.length === 0 ? (
                  <p className="text-body-sm text-ink-secondary">Everything is above its low-stock level.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {s.restock.map((r) => (
                      <li key={r.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md bg-surface-card px-3 py-2 text-body-sm">
                        <span className="min-w-0 break-words text-ink-strong">
                          {r.name} <span className="text-ink-muted">· {count(r.stock)} left</span>
                        </span>
                        <Link to={`${productLink(r.id)}/adjust`} className="font-semibold text-ink-brand hover:underline">
                          Restock<span className="sr-only"> {r.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── 14.04 Invoice collections ─────────────────────────────────────────────
export function InvoiceReportPage() {
  return (
    <ReportsAccess>
      <InvoiceReport />
    </ReportsAccess>
  );
}

const INVOICE_STATES = ["all", "paid", "open", "overdue", "draft"] as const;

function InvoiceReport() {
  const [status, setStatus] = useUrlState<(typeof INVOICE_STATES)[number]>("status", "all", INVOICE_STATES);
  const [search, setSearch] = useUrlState<string>("q", "");
  const [page, setPage] = usePage();
  const filters = { status, search, page };
  const inv = useInvoiceCollections(filters);
  const exp = useExport(() => exportInvoices(filters), "invoice-collections.csv");
  const d = inv.data;
  const s = d?.summary;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle actions={exp.button("Export invoice collections")}>Invoice collections</PageTitle>
      <IntroCard eyebrow="Workspace / Reports" title="See paid, open and overdue invoices together.">
        Send reminders for overdue invoices from the invoice page.
      </IntroCard>
      <ReportTabs />
      {exp.note}
      {inv.isLoading ? (
        <Loading />
      ) : inv.error || !d || !s ? (
        <ErrorNote error={inv.error ?? true} fallback="We couldn't load invoice collections. Please try again." onRetry={() => void inv.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <KpiCard tone="revenue" label="Paid" value={nairaCompact(s.paid.amount)} caption={`${count(s.paid.count)} invoice${s.paid.count === 1 ? "" : "s"}`} />
            <KpiCard tone="orders" label="Open" value={nairaCompact(s.open.amount)} caption={`${count(s.open.count)} awaiting payment`} />
            <KpiCard tone="stock" label="Overdue" value={nairaCompact(s.overdue.amount)} caption={`${count(s.overdue.count)} past the due date`} />
            <KpiCard tone="invoices" label="Draft" value={nairaCompact(s.draft.amount)} caption={`${count(s.draft.count)} not sent yet`} />
          </div>
          <Panel title="Customer invoice records">
            <MixBar label="Invoice status" items={(["paid", "open", "overdue", "draft"] as InvoiceState[]).map((k) => ({ key: k, label: INVOICE_STATE[k].label, count: s[k].count, tone: INVOICE_STATE[k].tone }))} />
            <div className="mt-5 grid min-w-0 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <SearchBox
                label="Search"
                placeholder="Invoice or customer"
                value={search}
                onChange={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
              />
              <Field label="Status">
                <SelectInput
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as typeof status);
                    setPage(1);
                  }}
                >
                  <option value="all">All statuses</option>
                  {(Object.keys(INVOICE_STATE) as InvoiceState[]).map((k) => (
                    <option key={k} value={k}>
                      {INVOICE_STATE[k].label}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </div>
            {d.rows.length === 0 ? (
              <p className="py-6 text-body-lg text-ink-secondary">No invoices match these filters.</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {d.rows.map((r) => (
                  <li key={r.id} className="grid min-w-0 gap-2 rounded-md bg-surface-pale px-4 py-3 text-body-sm md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
                    <span className="min-w-0">
                      <Link to={r.link} className="block break-words font-semibold text-ink-strong hover:underline">
                        {r.invoiceNumber}
                      </Link>
                      <span className="break-words text-caption text-ink-muted">{r.client}</span>
                    </span>
                    <span className="text-ink-strong">{naira(r.total)}</span>
                    <span className="text-ink-secondary">
                      {r.status === "overdue" ? `${count(r.daysOverdue)} day${r.daysOverdue === 1 ? "" : "s"} overdue` : r.dueDate ? `Due ${shortDate(r.dueDate)}` : shortDate(r.createdAt)}
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <Status tone={INVOICE_STATE[r.status].tone}>{INVOICE_STATE[r.status].label}</Status>
                      {(r.status === "overdue" || r.status === "open") && (
                        <Link to={r.link} className="font-semibold text-ink-brand hover:underline">
                          Remind<span className="sr-only"> about {r.invoiceNumber}</span>
                        </Link>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Pager page={d.page} totalPages={d.totalPages} onPage={setPage} />
          </Panel>
        </>
      )}
    </div>
  );
}
