import { useState } from "react";
import { Link } from "react-router-dom";
import { IconArrowRight } from "@tabler/icons-react";
import { ButtonLink, Spinner } from "@/components/ui";
import { IntroCard, KpiCard, PageTitle, Panel } from "@/components/page/Blocks";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { OrderTable } from "@/pages/orders/OrderPages";
import { useDashboard } from "@/lib/workspace/api";
import { useFeature } from "@/lib/workspace/subscription";
import { useOrders } from "@/lib/sales/api";
import { count, nairaCompact } from "@/lib/format";
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
              <dt><Link to="/reports" className="text-body-lg font-semibold text-ink-brand hover:underline">Reports and analytics</Link></dt>
              <dd className="mt-1 text-body-sm text-ink-muted">Revenue, stock and invoice reports with CSV export.</dd>
            </div>
          </dl>
        </Panel>
      </div>
      <div className="grid gap-3 rounded-2xl bg-surface-pale p-4 md:grid-cols-2">
        <ButtonLink to="/orders/new" fullWidth>Create an order →</ButtonLink>
        {invoicesOn ? <ButtonLink to="/invoices/new" fullWidth>Create invoice →</ButtonLink> : <ButtonLink to="/reports" fullWidth>Reports →</ButtonLink>}
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

export function BarChart({ data, format, title, valueLabel = "Revenue" }: { data: BarDatum[]; format: (n: number) => string; title: string; valueLabel?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 1);
  // Thin labels when there are many bars, so they never collide.
  // At most about five labels: they fit a phone-width chart without colliding.
  const every = data.length > 5 ? Math.ceil(data.length / 5) : 1;
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
        {/* Labels sit under their bar but may be wider than it, so they're
            placed absolutely instead of squeezed (and cut off) into each bar. */}
        <div className="relative mt-2 h-5">
          {data.map((d, i) => {
            const last = i === data.length - 1;
            if (!last && (i % every !== 0 || data.length - 1 - i < every / 2)) return null;
            const edge = i === 0 ? "left-0" : last ? "right-0" : "-translate-x-1/2";
            return (
              <span key={d.key} data-axis-label className={cn("absolute top-0 whitespace-nowrap text-caption text-ink-muted", edge)} style={i === 0 || last ? undefined : { left: `${((i + 0.5) / data.length) * 100}%` }}>
                {d.label}
              </span>
            );
          })}
        </div>
      </div>
      {/* sr-only on a wrapper: a <table> ignores the 1px width and can widen the page on phones. */}
      <div className="sr-only">
        <table>
          <caption>{title}</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">{valueLabel}</th>
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
      </div>
    </figure>
  );
}
