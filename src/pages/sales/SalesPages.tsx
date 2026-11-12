import { useState } from "react";
import { Link } from "react-router-dom";
import { IconArrowRight, IconDownload } from "@tabler/icons-react";
import { Button, ButtonLink, Spinner } from "@/components/ui";
import { IntroCard, KpiCard, PageTitle, Panel } from "@/components/page/Blocks";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { OrderTable } from "@/pages/orders/OrderPages";
import { useDashboard } from "@/lib/workspace/api";
import { useFeature } from "@/lib/workspace/subscription";
import { downloadSalesCsv, useInvoiceStats, useOrders, useSalesAnalytics, type AnalyticsRange } from "@/lib/sales/api";
import { saveBlob } from "@/lib/api/client";
import { count, naira, nairaCompact } from "@/lib/format";
import { cn } from "@/lib/cn";

const Loading = () => (
  <div className="flex justify-center py-16 text-ink-brand" role="status">
    <Spinner className="size-8" />
    <span className="sr-only">Loading…</span>
  </div>
);

// 05.01 Sales dashboard
export function SalesOverviewPage() {
  const dash = useDashboard();
  const recent = useOrders("all");
  const invoicesOn = useFeature("invoices").access === true;
  const s = dash.data?.stats;
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Sales dashboard</PageTitle>
      <IntroCard eyebrow="Workspace overview" title="Know what's selling and who has paid.">
        Monitor recorded orders, revenue trends, customers and invoice follow-ups.
      </IntroCard>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard tone="orders" label="Revenue" value={nairaCompact(s?.revenue)} caption="Completed orders" />
        <KpiCard tone="revenue" label="Total orders" value={count(s?.totalOrders)} caption="All recorded orders" />
        <KpiCard tone="invoices" label="Open invoices" value={count(s?.openInvoices)} caption="Awaiting payment" />
        <KpiCard tone="stock" label="Low stock" value={count(s?.lowStock)} caption="Restock reminders" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <Panel title="Recent sales activity">
          {recent.isLoading ? (
            <Loading />
          ) : recent.error ? (
            <ErrorNote error={recent.error} fallback="We couldn't load recent sales. Please try again." onRetry={() => void recent.refetch()} />
          ) : (
            <OrderTable orders={(recent.data ?? []).slice(0, 6)} empty="No sales yet. Record your first order to see it here." />
          )}
          {(recent.data?.length ?? 0) > 6 && (
            <Link to="/orders" className="mt-4 inline-flex items-center gap-1 text-body-sm font-semibold text-ink-brand hover:underline">
              See all orders <IconArrowRight aria-hidden="true" className="size-4" />
            </Link>
          )}
        </Panel>
        <Panel tone="pale" title="Move your business forward">
          <dl className="flex flex-col gap-7">
            <div>
              <dt><Link to="/orders" className="text-body-lg font-semibold text-ink-brand hover:underline">Create and track orders</Link></dt>
              <dd className="mt-1 text-body-sm text-ink-muted">Sales adjust inventory levels.</dd>
            </div>
            {invoicesOn && (
              <div>
                <dt><Link to="/invoices" className="text-body-lg font-semibold text-ink-brand hover:underline">Follow invoice payments</Link></dt>
                <dd className="mt-1 text-body-sm text-ink-muted">Draft, Sent, Paid and Overdue.</dd>
              </div>
            )}
            <div>
              <dt><Link to="/sales/analytics" className="text-body-lg font-semibold text-ink-brand hover:underline">Sales analytics and reports</Link></dt>
              <dd className="mt-1 text-body-sm text-ink-muted">Revenue by day, top products and CSV export.</dd>
            </div>
          </dl>
        </Panel>
      </div>
      <div className="grid gap-3 rounded-2xl bg-surface-pale p-4 md:grid-cols-2">
        <ButtonLink to="/orders/new" fullWidth>Create an order →</ButtonLink>
        {invoicesOn ? <ButtonLink to="/invoices/new" fullWidth>Create invoice →</ButtonLink> : <ButtonLink to="/sales/analytics" fullWidth>Sales analytics →</ButtonLink>}
      </div>
    </div>
  );
}

// ── Bar chart (05.05 "Sales revenue by day") ─────────────────────────────
// One series: no legend (the title names it). Bars scale to the container
// width (flex, no fixed pixel widths); the latest bar is highlighted; every
// bar has a hover/focus tooltip; a visually hidden table carries the data.
export interface BarDatum {
  key: string;
  label: string; // short axis label (Mon, 12 Nov)
  long: string; // tooltip / table label
  value: number;
  detail?: string;
}

export function BarChart({ data, format, title }: { data: BarDatum[]; format: (n: number) => string; title: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 1);
  // Thin labels when there are many bars, so they never collide.
  const every = data.length > 16 ? Math.ceil(data.length / 8) : data.length > 8 ? 2 : 1;
  return (
    <figure className="min-w-0">
      <figcaption className="sr-only">{title}</figcaption>
      <div className="relative" aria-hidden="true">
        <div className="flex h-56 items-end gap-[2px] border-b border-line-subtle md:h-64 md:gap-1">
          {data.map((d, i) => (
            <div key={d.key} className="relative flex h-full min-w-0 flex-1 items-end justify-center" onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}>
              <div
                className={cn(
                  "w-full max-w-12 rounded-t-[4px] transition-colors",
                  i === data.length - 1 ? "bg-brand-sky" : "bg-brand-navy",
                  active === i && "opacity-80"
                )}
                style={{ height: `${d.value > 0 ? Math.max((d.value / max) * 100, 2) : 0}%` }}
              />
              {active === i && (
                <div className="pointer-events-none absolute bottom-full z-10 mb-2 w-max max-w-[12rem] rounded-md bg-ink-strong px-3 py-2 text-caption text-ink-on-brand shadow-floating">
                  <p className="font-semibold">{d.long}</p>
                  <p>{format(d.value)}</p>
                  {d.detail && <p className="opacity-80">{d.detail}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-[2px] md:gap-1">
          {data.map((d, i) => (
            <span key={d.key} className="min-w-0 flex-1 truncate text-center text-caption text-ink-muted">
              {i % every === 0 || i === data.length - 1 ? d.label : ""}
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.long}</th>
              <td>
                {format(d.value)}
                {d.detail ? ` (${d.detail})` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

const RANGES: Array<[AnalyticsRange, string, number]> = [
  ["7days", "7 days", 7],
  ["30days", "30 days", 30],
  ["3months", "3 months", 90],
];

/** Fill missing days with zero so the axis is continuous. */
function dailySeries(rows: Array<{ _id: { year: number; month: number; day: number }; totalSales: number; totalOrders: number }>, days: number): BarDatum[] {
  const byKey = new Map(rows.map((r) => [`${r._id.year}-${r._id.month}-${r._id.day}`, r]));
  const out: BarDatum[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const r = byKey.get(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
    out.push({
      key: d.toISOString().slice(0, 10),
      label: days <= 7 ? d.toLocaleDateString("en-NG", { weekday: "short" }) : d.toLocaleDateString("en-NG", { day: "numeric", month: "short" }),
      long: d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" }),
      value: r?.totalSales ?? 0,
      detail: r ? `${count(r.totalOrders)} order${r.totalOrders === 1 ? "" : "s"}` : "No sales",
    });
  }
  return out;
}

// 05.05 Sales analytics
export function SalesAnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>("7days");
  const analytics = useSalesAnalytics(range);
  const invoicesOn = useFeature("invoices").access === true;
  const invoiceStats = useInvoiceStats(invoicesOn);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<unknown>(null);
  const a = analytics.data;
  const days = RANGES.find(([r]) => r === range)![2];

  const exportCsv = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const { blob, filename } = await downloadSalesCsv();
      saveBlob(blob, filename === "download" ? "sales-report.csv" : filename);
    } catch (err) {
      setExportError(err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        actions={
          <Button size="md" variant="secondary" loading={exporting} loadingText="Preparing…" onClick={() => void exportCsv()}>
            <IconDownload aria-hidden="true" className="size-icon" /> Export sales CSV
          </Button>
        }
      >
        Sales analytics
      </PageTitle>
      <IntroCard eyebrow="Select a date range" title="Understand your sales, not just your totals.">
        Revenue, orders, invoice collections and products — with exports.
      </IntroCard>
      <ErrorNote error={exportError} fallback="We couldn't prepare the export. Please try again." />
      {analytics.isLoading ? (
        <Loading />
      ) : analytics.error || !a ? (
        <ErrorNote error={analytics.error ?? true} fallback="We couldn't load your analytics. Please try again." onRetry={() => void analytics.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <KpiCard tone="orders" label="Revenue" value={nairaCompact(a.sales.totalSales)} caption={`Last ${RANGES.find(([r]) => r === range)![1]}`} />
            <KpiCard tone="revenue" label="Orders" value={count(a.sales.totalOrders)} caption={`${count(a.sales.completedOrders)} completed`} />
            <KpiCard tone="invoices" label="Paid invoices" value={count(invoiceStats.data?.paid ?? a.invoices.paid)} caption="Payment status" />
            <KpiCard tone="stock" label="Pending" value={count(invoiceStats.data ? invoiceStats.data.sent + invoiceStats.data.overdue : a.invoices.pending)} caption="Awaiting collection" />
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Panel title="Sales revenue by day">
              <div role="tablist" aria-label="Date range" className="-mt-2 mb-6 flex flex-wrap gap-1 text-body-sm">
                {RANGES.map(([r, l]) => (
                  <button
                    key={r}
                    role="tab"
                    type="button"
                    aria-selected={range === r}
                    onClick={() => setRange(r)}
                    className={cn("rounded-sm px-2.5 py-1", range === r ? "bg-surface-tint-blue font-semibold text-ink-brand" : "text-ink-secondary hover:text-ink-brand")}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <BarChart data={dailySeries(a.salesByDay, days)} format={naira} title={`Revenue from completed orders per day, last ${days} days`} />
            </Panel>
            {invoicesOn && (
              <Panel tone="pale" title="Invoice health">
                <dl className="flex flex-col gap-3">
                  {(
                    [
                      ["Paid", invoiceStats.data?.paid],
                      ["Sent", invoiceStats.data?.sent],
                      ["Overdue", invoiceStats.data?.overdue],
                      ["Draft", invoiceStats.data?.draft],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between rounded-md bg-surface-card px-4 py-5">
                      <dt className="text-body-lg text-ink-strong">{k}</dt>
                      <dd className="text-title-md text-ink-brand">{count(v)}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>
            )}
          </div>
          <Panel title="Top-selling products">
            {a.topProducts.filter((p) => p.totalSold > 0).length === 0 ? (
              <p className="py-4 text-body-lg text-ink-secondary">No products sold yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {a.topProducts
                  .filter((p) => p.totalSold > 0)
                  .map((p) => (
                    <li key={p._id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md bg-surface-pale px-4 py-3 text-body-sm md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                      <span className="truncate font-medium text-ink-strong">{p.name}</span>
                      <span className="text-ink-muted">{count(p.totalSold)} sold</span>
                      <span className="col-span-2 font-semibold text-ink-brand md:col-span-1">{naira(p.totalSold * p.sellingPrice)}</span>
                    </li>
                  ))}
              </ul>
            )}
            {invoicesOn && (
              <ButtonLink to="/invoices/new" size="md" className="mt-5">Create invoice</ButtonLink>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
