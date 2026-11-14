import { Link, useLocation } from "react-router-dom";
import { IconArrowRight, IconFileCheck, IconListCheck } from "@tabler/icons-react";
import { ButtonLink, Spinner } from "@/components/ui";
import { IntroCard, KpiCard, PageTitle, Panel } from "@/components/page/Blocks";
import { AuthNote } from "@/components/layout/AuthLayout";
import { useDashboard, useSetupSteps, type DashboardSummary } from "@/lib/workspace/api";
import { count, naira, nairaCompact } from "@/lib/format";
import { errorMessage } from "@/lib/api/errorMessage";
import { cn } from "@/lib/cn";

// 03.01 Dashboard / Empty state, 03.02 Dashboard / Populated (Figma 1889:1388, 1889:1781).

const statusLabel: Record<string, { label: string; className: string }> = {
  completed: { label: "Paid", className: "text-ink-brand" },
  pending: { label: "Pending", className: "text-ink-brand" },
  cancelled: { label: "Cancelled", className: "text-ink-muted" },
};

/** Last 7 days, one value per day (missing days = 0). */
function lastSevenDays(chart: DashboardSummary["salesChart"]) {
  const out: Array<{ label: string; value: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const hit = chart.find((c) => c._id.year === d.getFullYear() && c._id.month === d.getMonth() + 1 && c._id.day === d.getDate());
    out.push({ label: d.toLocaleDateString("en-NG", { weekday: "short" }), value: hit?.totalSales ?? 0 });
  }
  return out;
}

function SetupBanner() {
  const steps = useSetupSteps();
  if (!steps.data || steps.data.isComplete) return null;
  return (
    <Link to="/onboarding/checklist" className="flex items-center gap-4 rounded-xl border border-line-card bg-surface-card px-5 py-4 shadow-card hover:bg-surface-pale">
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-tint-blue text-ink-brand">
        <IconListCheck className="size-icon" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body-lg font-semibold text-ink-strong">Finish setting up your business</p>
        <p className="text-body-sm text-ink-muted">
          {steps.data.completedCount} of {steps.data.totalSteps} steps done
        </p>
      </div>
      <div className="hidden h-2 w-40 overflow-hidden rounded-full bg-surface-disabled md:block" aria-hidden="true">
        <div className="h-full rounded-full bg-success" style={{ width: `${steps.data.percentage}%` }} />
      </div>
      <IconArrowRight aria-hidden="true" className="size-5 text-ink-brand" />
    </Link>
  );
}

function SalesTrend({ data }: { data: Array<{ label: string; value: number }> }) {
  const max = Math.max(...data.map((d) => d.value), 0);
  if (max === 0) return <p className="py-10 text-body-lg text-ink-secondary">Your sales trend appears here when you record orders.</p>;
  return (
    <figure>
      {/* Bars are sized as a share of the plot area, so the chart scales with its container. */}
      <div className="flex h-40 min-w-0 justify-between gap-2 pt-4 md:gap-8" data-sales-trend>
        {data.map((d) => (
          <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex w-full flex-1 items-end justify-center border-b border-line-subtle">
              <div
                className="w-full max-w-16 rounded-t-[4px] bg-brand-navy"
                style={{ height: d.value > 0 ? `${Math.max((d.value / max) * 100, 3)}%` : 0 }}
                title={`${d.label}: ${naira(d.value)}`}
              />
            </div>
            <span className="max-w-full truncate text-micro text-ink-muted">{d.label}</span>
          </div>
        ))}
      </div>
      <figcaption className="sr-only">
        Sales for the last seven days: {data.map((d) => `${d.label} ${naira(d.value)}`).join(", ")}.
      </figcaption>
    </figure>
  );
}

const barTones = ["bg-kpi-revenue-line", "bg-kpi-orders-line", "bg-brand-navy"];

export function DashboardPage() {
  // Just restored from account closure (13.08).
  const state = useLocation().state as { restored?: boolean; planNote?: string | null } | null;
  const restored = state?.restored ? state : null;
  const dash = useDashboard();
  const s = dash.data?.stats;
  const orders = dash.data?.recentOrders ?? [];
  const top = (dash.data?.topSelling ?? []).filter((p) => p.totalSold > 0).slice(0, 3);
  const trend = dash.data ? lastSevenDays(dash.data.salesChart) : [];
  const maxSold = Math.max(...top.map((p) => p.totalSold), 1);

  return (
    <div className="flex flex-col gap-5">
      <PageTitle>Business dashboard</PageTitle>
      {restored && (
        <AuthNote tone="success">
          Welcome back. Your account is restored.{restored.planNote ? ` ${restored.planNote}` : ""}
        </AuthNote>
      )}
      <SetupBanner />
      <IntroCard eyebrow="Workspace overview" title="Your entire business at a glance.">
        Follow orders, revenue, stock and invoices in one view.
      </IntroCard>

      {dash.isLoading && (
        <div className="flex justify-center py-16 text-ink-brand" role="status">
          <Spinner className="size-8" />
          <span className="sr-only">Loading dashboard…</span>
        </div>
      )}
      {dash.error && <AuthNote tone="danger">{errorMessage(dash.error, "We couldn't load your dashboard. Please refresh.")}</AuthNote>}

      {dash.data && (
        <>
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            <KpiCard tone="revenue" label="Revenue" value={nairaCompact(s?.revenue ?? s?.totalSales)} caption="Completed orders" trend={trend.map((t) => t.value)} />
            <KpiCard tone="orders" label="Total orders" value={count(s?.totalOrders ?? dash.data.analytics.totalOrders)} caption="All recorded orders" />
            <KpiCard tone="invoices" label="Open invoices" value={count(s?.openInvoices ?? 0)} caption="Awaiting payment" />
            <KpiCard tone="stock" label="Low stock" value={count(s?.lowStock ?? 0)} caption="Restock reminders" />
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.95fr)_minmax(0,1fr)]">
            <Panel title={orders.length ? "Recent orders" : "Recent orders • Empty"}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] border-separate border-spacing-0 text-left">
                  <thead>
                    <tr className="text-caption font-semibold uppercase text-ink-muted">
                      <th scope="col" className="rounded-l-lg bg-surface-pale px-3 py-4">Order</th>
                      <th scope="col" className="bg-surface-pale px-3 py-4">Product</th>
                      <th scope="col" className="bg-surface-pale px-3 py-4">Total</th>
                      <th scope="col" className="rounded-r-lg bg-surface-pale px-3 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-body-sm">
                    {orders.slice(0, 5).map((o) => (
                      <tr key={o.trackingNo}>
                        <td className="px-3 py-6 font-semibold text-ink-strong">{o.trackingNo}</td>
                        <td className="px-3 py-6 font-medium text-ink-strong">
                          {o.productName}
                          {o.quantity > 1 && <span className="text-ink-muted"> × {o.quantity}</span>}
                        </td>
                        <td className="px-3 py-6 font-medium text-ink-strong">{naira(o.totalAmount)}</td>
                        <td className={cn("px-3 py-6 font-medium", statusLabel[o.status]?.className)}>{statusLabel[o.status]?.label ?? o.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {orders.length === 0 && (
                <div className="mt-1 flex items-center gap-6 rounded-xl bg-surface-pale p-6 lg:p-10">
                  <div className="flex-1">
                    <p className="text-title-sm text-ink-brand">No orders recorded yet</p>
                    <p className="mt-3 text-body-sm text-ink-muted">Your latest customer orders will appear here once you make a sale.</p>
                    <Link to="/orders" className="mt-2 inline-block text-body-sm font-medium text-ink-brand hover:underline">
                      Create your first order to get started →
                    </Link>
                  </div>
                  <span aria-hidden="true" className="hidden size-20 items-center justify-center rounded-full bg-kpi-revenue-bg text-kpi-revenue-fg md:flex">
                    <IconFileCheck className="size-10" stroke={1.5} />
                  </span>
                </div>
              )}
            </Panel>
            <Panel tone="pale" title="Today's priorities">
              <ul className="flex flex-col gap-8">
                {[
                  ["Create and track orders", "Sales adjust inventory levels.", "/orders"],
                  ["Follow invoice payments", "Draft, Sent, Paid and Overdue.", "/invoices"],
                  ["Export your reports", "Filter sales by date and export CSV.", "/reports"],
                ].map(([t, b, to]) => (
                  <li key={t}>
                    <Link to={to!} className="text-body-lg-medium font-semibold text-ink-brand hover:underline">
                      {t}
                    </Link>
                    <p className="mt-3 text-body-sm text-ink-muted">{b}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <div className="grid gap-4 rounded-2xl bg-surface-pale p-4 md:grid-cols-2">
            <ButtonLink to="/orders" size="md">
              Create an order →
            </ButtonLink>
            <ButtonLink to="/invoices" size="md">
              Create invoice →
            </ButtonLink>
          </div>

          <Panel title="Sales trend" subtitle="Revenue performance · Last 7 days">
            <SalesTrend data={trend} />
          </Panel>

          <Panel title="Top-selling products">
            {top.length === 0 ? (
              <>
                <p className="text-body-lg text-ink-secondary">No products sold yet. Add products and record a sale to see rankings.</p>
                <p className="mt-6 text-body-sm text-ink-muted">Product performance updates automatically once sales begin.</p>
              </>
            ) : (
              <>
                <ol className="grid gap-3 md:grid-cols-3">
                  {top.map((p, i) => (
                    <li key={p._id} className="flex items-start gap-3 rounded-lg border border-line-card bg-surface-pale p-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-card text-caption font-semibold text-ink-brand">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body font-semibold text-ink-strong">{p.name}</p>
                        <p className="text-caption text-ink-muted">{count(p.totalSold)} sold</p>
                        <div className="mt-2 h-1 rounded-full bg-surface-disabled" aria-hidden="true">
                          <div className={cn("h-full rounded-full", barTones[i])} style={{ width: `${(p.totalSold / maxSold) * 100}%` }} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="mt-4 text-body-sm text-ink-muted">Ranked by units sold.</p>
              </>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
