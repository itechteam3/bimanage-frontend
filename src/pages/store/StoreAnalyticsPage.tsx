import { useState } from "react";
import { Link } from "react-router-dom";
import { IconDownload } from "@tabler/icons-react";
import { Button } from "@/components/ui";
import { IntroCard, KpiCard, PageTitle, Panel } from "@/components/page/Blocks";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { BarChart, type BarDatum } from "@/pages/sales/SalesPages";
import { saveBlob } from "@/lib/api/client";
import { count, naira, nairaCompact } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useUrlState } from "@/lib/nav/useUrlState";
import { downloadStoreReport, useStoreAnalytics, type AnalyticsRange, type Store, type StoreAnalytics } from "@/lib/store/api";
import { Loading, StoreTabs, WithStore, opsEyebrow } from "./shared";

const RANGES: Array<[AnalyticsRange, string]> = [
  ["7d", "Last 7 days"],
  ["30d", "Last 30 days"],
  ["90d", "Last 90 days"],
];

const change = (n: number | null) => (n === null ? "No earlier data" : `${n > 0 ? "+" : ""}${n}% vs previous period`);

/** One bar per day; long ranges are grouped by week so bars stay readable. */
function bars(a: StoreAnalytics): BarDatum[] {
  const day = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { ...opts, timeZone: "Africa/Lagos" });
  if (a.series.length <= 31) {
    return a.series.map((d) => ({ key: d.date, label: a.series.length <= 7 ? day(d.date, { weekday: "short" }) : day(d.date, { day: "numeric", month: "short" }), long: day(d.date, { weekday: "long", day: "numeric", month: "short" }), value: d.revenue, detail: `${count(d.orders)} orders` }));
  }
  const weeks: BarDatum[] = [];
  for (let i = 0; i < a.series.length; i += 7) {
    const chunk = a.series.slice(i, i + 7);
    const first = chunk[0]!;
    weeks.push({ key: first.date, label: day(first.date, { day: "numeric", month: "short" }), long: `Week of ${day(first.date, { day: "numeric", month: "long" })}`, value: chunk.reduce((s, d) => s + d.revenue, 0), detail: `${count(chunk.reduce((s, d) => s + d.orders, 0))} orders` });
  }
  return weeks;
}

export function StoreAnalyticsPage() {
  return <WithStore>{(store) => <Analytics store={store} />}</WithStore>;
}

function Analytics({ store }: { store: Store }) {
  const [range, setRange] = useUrlState<AnalyticsRange>("range", "30d", RANGES.map(([r]) => r));
  const analytics = useStoreAnalytics(range);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<unknown>(null);
  const a = analytics.data;
  const rangeLabel = RANGES.find(([r]) => r === range)![1];

  const onExport = async () => {
    setExportError(null);
    setExporting(true);
    try {
      const { blob, filename } = await downloadStoreReport(range);
      saveBlob(blob, filename === "download" ? "store-orders.csv" : filename);
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
          <Button size="md" onClick={() => void onExport()} loading={exporting} loadingText="Preparing CSV…">
            <IconDownload aria-hidden="true" className="size-4" /> Export CSV
          </Button>
        }
      >
        Store performance
      </PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Follow order activity, product views and revenue.</p>
      <StoreTabs />
      <IntroCard eyebrow={opsEyebrow(store)} title={`${rangeLabel} · Download the orders as a spreadsheet.`} />
      <div role="tablist" aria-label="Date range" className="flex w-max items-center gap-1 rounded-md bg-surface-pale p-1">
        {RANGES.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={range === key} onClick={() => setRange(key)} className={cn("min-h-11 rounded-sm px-3 text-action font-semibold", range === key ? "bg-surface-card text-ink-brand shadow-card" : "text-ink-muted")}>
            {label}
          </button>
        ))}
      </div>
      <ErrorNote error={exportError} fallback="We couldn't prepare the CSV. Please try again." />
      {analytics.isLoading ? (
        <Loading />
      ) : !a ? (
        <ErrorNote error={analytics.error ?? true} fallback="We couldn't load your store performance." onRetry={() => void analytics.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <KpiCard
              tone="revenue"
              label="Revenue"
              value={nairaCompact(a.revenue)}
              caption={change(a.revenueChange)}
              badge={a.test?.revenue ? "TEST" : undefined}
              note={a.test?.revenue ? `Includes ${naira(a.test.revenue)} from test payments: not real money.` : undefined}
            />
            <KpiCard
              tone="orders"
              label="Orders"
              value={count(a.orders)}
              caption={`${count(a.fulfilled)} fulfilled`}
              badge={a.test?.orders ? "TEST" : undefined}
              note={a.test?.orders ? `Includes ${count(a.test.orders)} test ${a.test.orders === 1 ? "order" : "orders"}.` : undefined}
            />
            <KpiCard tone="stock" label="Product views" value={count(a.productViews)} caption={`${count(a.storeViews)} store visits (all time)`} />
            <KpiCard tone="invoices" label="Top product" value={a.topProduct?.name ?? "—"} caption={a.topProduct ? `${count(a.topProduct.sold)} sold` : "No sales yet"} />
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Panel title="Revenue trend" subtitle="Paid orders, by the day they were paid (Lagos time).">
              {a.orders === 0 ? <p className="text-body-sm text-ink-muted">No paid orders in this period yet.</p> : <BarChart data={bars(a)} format={naira} title={`Store revenue, ${rangeLabel.toLowerCase()}`} />}
              {a.topProducts.length > 0 && (
                <ul className="mt-6 flex flex-col divide-y divide-line-subtle">
                  {a.topProducts.map((p) => (
                    <li key={p.productId} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3 text-body-sm">
                      <Link to={`/store/products/${p.productId}`} className="truncate font-semibold text-ink-strong hover:underline">
                        {p.name}
                      </Link>
                      <span className="text-ink-secondary">{count(p.sold)} sold</span>
                      <span className="font-semibold text-ink-strong">{naira(p.revenue)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel tone="pale" title="Next actions and insights">
              <dl className="flex flex-col gap-3">
                {[
                  ["Average order", naira(a.averageOrderValue)],
                  ["Cancelled", count(a.cancelled)],
                  ["Checkout", "Guest checkout enabled"],
                  ["Payouts", <span key="p">{naira(a.payouts.pending)} pending · {naira(a.payouts.available)} available · <Link to="/wallet" className="text-ink-brand hover:underline">View wallet</Link></span>],
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-md bg-surface-card px-3 py-2">
                    <dt className="text-caption font-semibold uppercase text-ink-muted">{k}</dt>
                    <dd className="text-body-lg text-ink-strong">{v}</dd>
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
