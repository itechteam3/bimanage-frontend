import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthNote } from "@/components/layout/AuthLayout";
import { IconArrowRight, IconCalendar, IconChartBar, IconListCheck, IconRefresh } from "@tabler/icons-react";
import { Button, ButtonLink, CountUp, DashboardSkeleton } from "@/components/ui";
import { FlowTile, FlowTiles, type TileTone } from "@/components/page/FlowLayout";
import { useSetupSteps } from "@/lib/workspace/api";
import { useSellingChannels } from "@/lib/workspace/channels";
import { RANGES, bucketSeries, useChannelDashboard, type DashChannel, type RangeId } from "@/lib/workspace/channelDashboard";
import { count, naira, nairaCompact } from "@/lib/format";
import { cn } from "@/lib/cn";
import { staggerStyle } from "@/lib/motion";

// 03.03 Retail dashboard, 03.04 Wholesale dashboard, 03.05 Combined business
// dashboard, 03.06 view & filters, 03.07 wholesale view selected, 03.08 no
// activity, 03.09 refresh failed, 03.10 loading (Figma 4244:376, 26 Nov 2026).
// The view filter only changes what the dashboard shows; it never switches a
// selling channel on or off. Stock is one shared record (never counted twice).

const VIEW = {
  all: { title: "Combined business dashboard", hero: "All-channel business performance", body: "See your entire business in one view, with channel-aware revenue, orders and shared inventory.", band: "bg-surface-tint-violet", line: "border-l-accent-lavender", ink: "text-accent-lavender", dot: "bg-surface-tint-violet" },
  retail: { title: "Retail dashboard", hero: "Retail business performance", body: "Understand your retail sales, customer orders and storefront performance in one place.", band: "bg-surface-tint-blue", line: "border-l-accent-blue", ink: "text-accent-blue", dot: "bg-surface-tint-blue" },
  wholesale: { title: "Wholesale dashboard", hero: "Wholesale business performance", body: "Track bulk orders, trade buyers and selling tiers without mixing up retail operations.", band: "bg-surface-tint-gold", line: "border-l-accent-gold", ink: "text-accent-gold", dot: "bg-surface-tint-gold" },
} as const;

const TABS: Array<{ id: DashChannel; label: string }> = [
  { id: "all", label: "All channels" },
  { id: "retail", label: "Retail" },
  { id: "wholesale", label: "Wholesale" },
];

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
        <div className="motion-bar-x h-full rounded-full bg-success" style={{ width: `${steps.data.percentage}%` }} />
      </div>
      <IconArrowRight aria-hidden="true" className="size-5 text-ink-brand" />
    </Link>
  );
}

const pctText = (n: number | null | undefined, period: string) => (n === null || n === undefined ? `Compared with the previous ${period}` : `${n > 0 ? "+" : ""}${n}% vs previous ${period}`);

/** Grouped bars: retail and wholesale side by side per period. */
function ChannelBars({ data, show }: { data: Array<{ label: string; retail: number; wholesale: number }>; show: DashChannel }) {
  const keys: Array<"retail" | "wholesale"> = show === "all" ? ["retail", "wholesale"] : [show];
  const max = Math.max(0, ...data.flatMap((d) => keys.map((k) => d[k])));
  if (max === 0)
    return (
      <div className="flex h-44 flex-col items-center justify-center gap-1 rounded-lg bg-surface-page text-center">
        <p className="text-body-lg font-semibold text-ink-strong">No sales to display yet</p>
        <p className="text-caption text-ink-muted">Your chart appears here as orders are recorded.</p>
      </div>
    );
  return (
    <figure>
      <div className="flex h-44 min-w-0 justify-between gap-2 border-b border-line-subtle pt-4 md:gap-6" data-sales-trend>
        {data.map((d, i) => (
          <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center">
            <div className="flex h-full w-full items-end justify-center gap-1">
              {keys.map((k) => (
                <div
                  key={k}
                  className={cn("motion-bar-y w-full max-w-[26px] rounded-t-[4px]", k === "retail" ? "bg-accent-green" : "bg-accent-lavender")}
                  style={{ ...staggerStyle(i), height: d[k] > 0 ? `${Math.max((d[k] / max) * 100, 3)}%` : 0 }}
                  title={`${d.label} · ${k === "retail" ? "Retail" : "Wholesale"}: ${naira(d[k])}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between gap-2 md:gap-6">
        {data.map((d) => (
          <span key={d.label} className="min-w-0 flex-1 truncate text-center text-micro text-ink-muted">
            {d.label}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">{data.map((d) => `${d.label}: ${keys.map((k) => `${k} ${naira(d[k])}`).join(", ")}`).join("; ")}.</figcaption>
    </figure>
  );
}

function Card({ title, subtitle, children, aside, className }: { title: string; subtitle?: string; children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-5 rounded-lg border border-line-card bg-surface-card p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-title-sm text-ink-strong">{title}</h2>
          {subtitle && <p className="mt-1 text-caption text-ink-muted">{subtitle}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

type Signal = { title: string; body: string; tone: "violet" | "gold" | "teal" | "blue" };
const DOT: Record<Signal["tone"], string> = { violet: "bg-accent-lavender", gold: "bg-accent-gold", teal: "bg-accent-green", blue: "bg-accent-blue" };

function Signals({ items }: { items: Signal[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((s) => (
        <li key={s.title} className="flex gap-3 rounded-md bg-surface-tint-blue px-3 py-3">
          <span aria-hidden="true" className={cn("mt-1.5 size-2 shrink-0 rounded-full", DOT[s.tone])} />
          <span className="flex flex-col gap-1">
            <span className="text-body-sm font-semibold text-ink-strong">{s.title}</span>
            <span className="text-caption text-ink-muted">{s.body}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function DashboardPage() {
  // Coming back from "Keep my account" (13.08): say so once.
  const state = useLocation().state as { restored?: boolean; planNote?: string | null } | null;
  const restored = state?.restored ? state : null;
  const channels = useSellingChannels();
  const ch = channels.data?.channels;
  // Tabs only when the business has both channels set up; otherwise its one view.
  const both = ch ? ch.retail.status !== "available" && ch.wholesale.status !== "available" : false;
  const single: DashChannel = ch && !both ? (ch.wholesale.status !== "available" && ch.retail.status === "available" ? "wholesale" : "retail") : "all";
  const [picked, setPicked] = useState<DashChannel>("all");
  const view: DashChannel = both ? picked : single;
  const [range, setRange] = useState<RangeId>("30d");
  const dash = useChannelDashboard(view, range);
  const v = VIEW[view];
  const rangeLabel = RANGES.find((r) => r.id === range)!.label;
  const period = range === "7d" ? "7 days" : range === "90d" ? "90 days" : range === "month" ? "period" : "30 days";
  const d = dash.data && "kpis" in dash.data ? dash.data : undefined;
  const failed = !dash.isLoading && !d;
  const empty = d ? d.kpis.orders === 0 && d.inventory.totalProducts === 0 : false;
  const activeCount = ch ? [ch.retail, ch.wholesale].filter((c) => c.status === "active").length : 0;
  const low = d ? d.inventory.lowStock + d.inventory.outOfStock : 0;

  const tiles: Array<{ tone: TileTone; label: string; value: ReactNode; caption: string }> = (() => {
    if (!d) return [];
    const k = d.kpis;
    const money = (n: number) => <CountUp value={n} format={nairaCompact} />;
    const num = (n: number) => <CountUp value={n} format={count} />;
    if (view === "retail")
      return [
        { tone: "teal", label: "Retail revenue", value: money(k.revenue), caption: pctText(d.change?.revenue, period) },
        { tone: "violet", label: "Retail orders", value: num(k.orders), caption: `${count(k.unitsSold)} units sold` },
        { tone: "blue", label: "Avg. order value", value: money(k.averageOrder), caption: "Across completed retail orders" },
        { tone: "gold", label: "Low-stock alerts", value: num(low), caption: "Shared stock across channels" },
      ];
    if (view === "wholesale")
      return [
        { tone: "teal", label: "Wholesale revenue", value: money(k.revenue), caption: pctText(d.change?.revenue, period) },
        { tone: "violet", label: "Bulk orders", value: num(d.wholesale.bulkOrders), caption: `${count(k.unitsSold)} units` },
        { tone: "blue", label: "Average bulk order", value: money(k.averageOrder), caption: "Across trade orders" },
        { tone: "gold", label: "Active trade buyers", value: num(d.wholesale.tradeBuyers), caption: "Buyers this period" },
      ];
    return [
      { tone: "teal", label: "Total revenue", value: money(k.revenue), caption: `Retail ${nairaCompact(d.byChannel.retail.revenue)} · Wholesale ${nairaCompact(d.byChannel.wholesale.revenue)}` },
      { tone: "violet", label: "Total orders", value: num(k.orders), caption: `${count(d.byChannel.retail.orders)} retail · ${count(d.byChannel.wholesale.orders)} wholesale` },
      { tone: "blue", label: "Active channels", value: `${activeCount} / 2`, caption: activeCount === 2 ? "Retail and wholesale live" : "Manage in Settings" },
      { tone: "gold", label: "Low-stock alerts", value: num(low), caption: "Shared stock across channels" },
    ];
  })();

  const signals: Signal[] = (() => {
    if (!d) return [];
    if (empty)
      return [
        { title: "Add your first product", body: "Set up a shared product catalogue", tone: "violet" },
        { title: "Choose channel pricing", body: "Set retail prices and bulk tiers", tone: "gold" },
        { title: "Record or receive an order", body: "Insights update when sales begin", tone: "teal" },
      ];
    const r = d.byChannel.retail;
    const w = d.byChannel.wholesale;
    if (view === "all") {
      const lead = w.revenue > r.revenue ? "Wholesale" : "Retail";
      const share = d.kpis.revenue ? Math.round((Math.max(w.revenue, r.revenue) / d.kpis.revenue) * 100) : 0;
      return [
        { title: `${lead} leads revenue`, body: `${share}% of revenue this period`, tone: "violet" },
        { title: `${r.orders >= w.orders ? "Retail" : "Wholesale"} orders drive volume`, body: `${count(Math.max(r.orders, w.orders))} of ${count(d.kpis.orders)} total orders`, tone: "gold" },
        { title: "One stock balance", body: low ? `${count(low)} product${low === 1 ? " needs" : "s need"} restocking` : "No duplicated product inventory", tone: "teal" },
      ];
    }
    const out: Signal[] = [];
    if (low) out.push({ title: `${count(low)} low-stock product${low === 1 ? "" : "s"}`, body: "Reorder items before they sell out", tone: "gold" });
    if (both) {
      out.push({ title: `${view === "retail" ? "Retail" : "Wholesale"} filter applied`, body: `${view === "retail" ? "Wholesale" : "Retail"} transactions are hidden here`, tone: "violet" });
      out.push({ title: "Your other channel stays live", body: "Filtering never changes selling settings", tone: "teal" });
    } else {
      out.push({ title: "One stock balance", body: "Every sale draws from the same inventory", tone: "teal" });
      out.push({ title: "Add another channel any time", body: "Activate it in Settings → Selling channels", tone: "violet" });
    }
    return out;
  })();

  return (
    <div className="relative flex flex-col gap-6">
      <div aria-hidden="true" className={cn("pointer-events-none absolute -inset-x-5 -top-5 h-[310px] lg:-inset-x-12 lg:-top-6 lg:h-[300px]", v.band)} />
      <div className="relative flex flex-col gap-1">
        <h1 className="text-title-lg text-ink-strong lg:text-page-title">{v.title}</h1>
        <p className="text-body-sm text-ink-muted">
          {v.hero} <span aria-hidden="true">&nbsp;/&nbsp;</span> {rangeLabel}
        </p>
      </div>
      {restored && (
        <div className="relative">
          <AuthNote tone="success">
            Welcome back. Your account is restored.{restored.planNote ? ` ${restored.planNote}` : ""}
          </AuthNote>
        </div>
      )}
      <div className="relative">
        <SetupBanner />
      </div>
      <div className="relative flex flex-col gap-3 lg:flex-row">
        {both && (
          <div role="tablist" aria-label="Dashboard view" className="grid flex-1 grid-cols-3 gap-1 rounded-lg border border-line-card bg-surface-card p-1.5">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={view === t.id} onClick={() => setPicked(t.id)} className={cn("min-h-11 rounded-md px-2 text-body-sm font-semibold transition-colors", view === t.id ? "bg-brand-navy text-ink-on-brand" : "text-ink-muted hover:text-ink-strong")}>
                {t.label}
              </button>
            ))}
          </div>
        )}
        <label className="flex min-h-[52px] items-center gap-2 rounded-lg border border-line-card bg-surface-card px-3 lg:w-[318px]">
          <IconCalendar aria-hidden="true" className="size-icon shrink-0 text-accent-blue" />
          <span className="sr-only">Date range</span>
          <select value={range} onChange={(e) => setRange(e.target.value as RangeId)} className="min-h-11 flex-1 bg-transparent text-body-sm text-ink-strong outline-none">
            {RANGES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className={cn("relative flex gap-4 rounded-lg border border-l-4 border-line-card bg-surface-card p-5", v.line)}>
        <span aria-hidden="true" className={cn("hidden size-[52px] shrink-0 items-center justify-center rounded-full md:flex", v.dot, v.ink)}>
          <IconChartBar className="size-6" />
        </span>
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="text-[19px] font-semibold leading-7 text-ink-strong">{failed ? "We couldn't refresh your dashboard" : empty ? "Your workspace is ready" : v.hero}</h2>
          <p className="text-body-sm text-ink-muted">
            {failed ? "Your account, orders and channel settings have not changed. Try again in a moment." : empty ? "Add products, set prices and record your first sale to fill the dashboard." : v.body}
          </p>
          {!failed && (
            <p className={cn("text-caption font-medium", v.ink)}>
              {view !== "all" && both ? `Viewing ${view} only · ${view === "retail" ? "Wholesale" : "Retail"} remains active` : "Shared stock · channel-specific pricing · one business account"}
            </p>
          )}
        </div>
      </section>

      {dash.isLoading && <DashboardSkeleton />}

      {failed && (
        <section role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-line-card bg-surface-card p-5">
          <p className="text-body-lg font-semibold text-ink-strong">Data is temporarily unavailable</p>
          <p className="text-body-sm text-ink-muted">Your sales records are safe. Check your connection, then retry.</p>
          <Button size="md" onClick={() => void dash.refetch()} loading={dash.isFetching} loadingText="Refreshing…">
            <IconRefresh aria-hidden="true" className="size-icon" /> Refresh dashboard
          </Button>
          <Link to="/support" className="text-body-sm font-semibold text-ink-brand hover:underline">
            Still having trouble? Contact support
          </Link>
        </section>
      )}

      {d && (
        <>
          <FlowTiles>
            {tiles.map((t) => (
              <FlowTile key={t.label} tone={t.tone} label={t.label} value={t.value} caption={t.caption} />
            ))}
          </FlowTiles>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,742fr)_minmax(0,378fr)]">
            <Card
              title={view === "all" ? "Revenue trend by selling channel" : "Sales performance trend"}
              subtitle={rangeLabel}
              aside={
                view === "all" ? (
                  <span className="flex gap-4 text-caption text-ink-muted">
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden="true" className="size-2 rounded-full bg-accent-green" /> Retail
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden="true" className="size-2 rounded-full bg-accent-lavender" /> Wholesale
                    </span>
                  </span>
                ) : undefined
              }
            >
              <ChannelBars data={bucketSeries(d.series)} show={view} />
            </Card>
            <Card title="Operational signals" subtitle="What needs attention">
              <Signals items={signals} />
            </Card>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,742fr)_minmax(0,378fr)]">
            <Card title={d.recentOrders.length ? "Recent orders" : "Your first orders will appear here"} subtitle="Orders across the selected selling view">
              {d.recentOrders.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[34rem] border-separate border-spacing-0 text-left text-body-sm">
                    <caption className="sr-only">Recent orders</caption>
                    <thead className="text-caption font-semibold uppercase text-ink-muted">
                      <tr className="bg-surface-tint-blue">
                        <th scope="col" className="rounded-l-md px-3 py-3">Order</th>
                        <th scope="col" className="px-3 py-3">Customer / buyer</th>
                        <th scope="col" className="px-3 py-3">Channel</th>
                        <th scope="col" className="px-3 py-3">Total</th>
                        <th scope="col" className="rounded-r-md px-3 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.recentOrders.map((o) => (
                        <tr key={o.id}>
                          <td className="border-b border-line-subtle px-3 py-3 font-semibold text-ink-strong">
                            <Link to={o.link} className="hover:underline">
                              {o.ref ?? "Order"}
                            </Link>
                          </td>
                          <td className="border-b border-line-subtle px-3 py-3 text-ink-strong">{o.name ?? "Walk-in customer"}</td>
                          <td className="border-b border-line-subtle px-3 py-3 capitalize text-ink-muted">{o.channel}</td>
                          <td className="border-b border-line-subtle px-3 py-3 text-ink-strong">{naira(o.total)}</td>
                          <td className={cn("border-b border-line-subtle px-3 py-3 font-semibold", /awaiting|processing|shipped/i.test(o.status) ? "text-warning" : "text-success")}>{o.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-start gap-3">
                  <p className="text-body-sm text-ink-muted">No orders yet. Create your first order to begin tracking revenue.</p>
                  <ButtonLink to="/orders/new" size="md">
                    Create your first order
                  </ButtonLink>
                </div>
              )}
            </Card>
            <Card title="Next best steps">
              <div className="flex flex-col gap-3">
                {(empty
                  ? [
                      { to: "/inventory/products/new", label: "Add product catalogue" },
                      { to: "/inventory/products", label: "Set retail and bulk prices" },
                      { to: "/orders/new", label: "Record your first order" },
                    ]
                  : [
                      { to: "/reports", label: "Review channel revenue" },
                      { to: "/inventory/products", label: "Check the shared stock list" },
                      { to: "/inventory/export", label: "Export a stock summary" },
                    ]
                ).map((s, i) => (
                  <Link key={s.label} to={s.to} className={cn("flex min-h-[57px] items-center justify-center rounded-md px-4 text-center text-body-sm font-semibold text-ink-strong hover:underline", i % 2 ? "bg-surface-page" : "bg-surface-tint-violet")}>
                    {s.label}
                  </Link>
                ))}
              </div>
            </Card>
          </div>

          <Card title="Inventory & channel health" subtitle="One connected stock source for retail and wholesale">
            <ul className="flex flex-col gap-2">
              {[
                { t: "Shared inventory synced", b: `All active channels view one stock balance · ${count(d.inventory.totalProducts)} products`, dot: "bg-accent-green" },
                { t: "Channel pricing", b: "Retail prices and wholesale tiers stay separate", dot: "bg-accent-blue" },
                { t: "Restock attention", b: low ? `${count(low)} product${low === 1 ? " is" : "s are"} close to or at the reorder point` : "Nothing needs restocking right now", dot: "bg-accent-gold" },
              ].map((r, i) => (
                <li key={r.t} className={cn("flex gap-3 rounded-md px-4 py-2.5", i % 2 ? "bg-surface-page" : "bg-surface-tint-blue")}>
                  <span aria-hidden="true" className={cn("mt-1.5 size-2 shrink-0 rounded-full", r.dot)} />
                  <span className="flex flex-col">
                    <span className="text-body-sm font-semibold text-ink-strong">{r.t}</span>
                    <span className="text-micro text-ink-muted">{r.b}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <section className="flex flex-col gap-2 rounded-lg bg-surface-tint-blue px-5 py-5 lg:px-12">
            <p className="text-body-sm font-semibold text-ink-strong">Dashboard view filtering does not change selling-channel activation, access, inventory or history.</p>
            <p className="text-caption text-ink-muted">Combined results count each order once. Inventory is never double-counted.</p>
          </section>
        </>
      )}
    </div>
  );
}
