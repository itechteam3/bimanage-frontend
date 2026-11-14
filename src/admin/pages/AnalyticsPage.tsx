import { useState } from "react";
import { naira, count } from "@/lib/format";
import { Button } from "@/components/ui";
import { saveBlob } from "@/lib/api/client";
import { BarChart, type BarDatum } from "@/pages/sales/SalesPages";
import { AdminPage, Toolbar, FilterSelect, Metrics, Records, Guidance, Section, ErrorBox, Loading, TestTag, type Column } from "../components/AdminKit";
import { useOverview } from "../lib/hooks";
import type { Overview } from "../lib/types";
import { longDay, shortDay } from "./OverviewPage";

// 16.07 Platform analytics: adoption, transaction volume and workload, per
// Lagos day. Revenue is live money BiTechTeam earned; test money is apart.

const RANGES: Array<[string, string]> = [
  ["7d", "Last 7 days"],
  ["30d", "Last 30 days"],
  ["90d", "Last 90 days"],
];

/** Spreadsheet-safe CSV (a cell starting with = + - @ can't run as a formula). */
export function toCsv(rows: Array<Array<string | number>>): string {
  const cell = (v: string | number) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\n");
}

function exportCsv(o: Overview) {
  const money = Boolean(o.revenue);
  const head = ["Date (Lagos)", "Sign-ups", ...(money ? ["BiTechTeam revenue (NGN, live)", "Online store sales (NGN, live)", "BiSupplyNet sales (NGN, live)"] : [])];
  const rows = o.series.map((d) => [d.date, d.signups, ...(money ? [d.revenue ?? 0, d.storeSales ?? 0, d.bisupplynetSales ?? 0] : [])]);
  const csv = toCsv([head, ...rows]);
  saveBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `bimanage-platform-${o.period.from}-to-${o.period.to}.csv`);
}

interface Line {
  key: string;
  metric: string;
  source: string;
  value: string;
}

export function AnalyticsPage() {
  const [range, setRange] = useState("30d");
  const ov = useOverview({ range });
  const o = ov.data;
  const label = RANGES.find((r) => r[0] === range)?.[1] ?? "";
  const lines: Line[] | undefined = o
    ? [
        ...(o.revenue
          ? [
              { key: "plans", metric: "Plans and startup packages", source: "Paystack payments (successful, live)", value: naira(o.revenue.plans) },
              { key: "store", metric: "Store commission (3%)", source: "Paid online store orders", value: naira(o.revenue.storeCommission) },
              { key: "bsn", metric: "BiSupplyNet commission", source: "Escrow ledger", value: naira(o.revenue.bisupplynetCommission) },
            ]
          : []),
        { key: "signups", metric: "New accounts", source: "Sign-ups", value: count(o.users.new) },
        { key: "tickets", metric: "Support workload", source: "Open and overdue tickets", value: `${count(o.queues.openTickets)} open · ${count(o.queues.overdueTickets)} overdue` },
      ]
    : undefined;
  const cols: Column<Line>[] = [
    { key: "metric", label: "Metric", cell: (l) => l.metric },
    { key: "source", label: "Source", cell: (l) => l.source },
    { key: "period", label: "Period", cell: () => label, desktopOnly: true },
    { key: "value", label: "Value", cell: (l) => <strong>{l.value}</strong> },
  ];
  return (
    <AdminPage title="Platform analytics" intro="Compare adoption, transaction volume and service workload.">
      <Toolbar>
        <FilterSelect label="Period" value={range} onChange={setRange} options={RANGES} />
        <p className="text-body-sm text-ink-muted lg:flex-1">{o ? `${o.period.from} to ${o.period.to}, Lagos time` : " "}</p>
        <Button size="md" disabled={!o} onClick={() => o && exportCsv(o)}>
          Export CSV →
        </Button>
      </Toolbar>
      {ov.error ? <ErrorBox error={ov.error} onRetry={() => void ov.refetch()} /> : null}
      {!o && !ov.error ? <Loading /> : null}
      {o && (
        <>
          <Metrics
            items={[
              { tone: "orders", label: "Transaction volume", value: o.volume ? naira(o.volume.storeSales + o.volume.bisupplynetSales) : "—", caption: o.volume ? `${count(o.volume.storeOrders + o.volume.bisupplynetOrders)} live orders` : "Finance and Administrators see money" },
              { tone: "revenue", label: "Platform revenue", value: o.revenue ? naira(o.revenue.total) : "—", caption: o.revenue ? (o.revenue.change != null ? `${o.revenue.change > 0 ? "+" : ""}${o.revenue.change}% on the period before` : "Live payments only") : "Finance and Administrators see money" },
              { tone: "stock", label: "Accounts", value: count(o.users.total), caption: `${count(o.users.new)} new in the period` },
            ]}
          />
          {o.test && o.test.total > 0 && (
            <p className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-pale px-4 py-3 text-body-sm text-ink-secondary">
              <TestTag /> {o.test.label}: {naira(o.test.total)} in fees and {naira(o.test.storeSales + o.test.bisupplynetSales)} in sales during the period. Not included above.
            </p>
          )}
          <Records title="Platform performance" columns={cols} rows={lines} rowKey={(l) => l.key} empty="No figures yet." side={<Guidance title="Metric integrity" rules={["Fees: 3% of paid online store sales, plus the BiSupplyNet commission.", "Plan revenue counts successful live payments only.", "Never publish test figures as real revenue or customer totals."]} />} />
          {o.revenue && (
            <Section title="BiTechTeam revenue per day (live)">
              <BarChart data={o.series.map((d): BarDatum => ({ key: d.date, label: shortDay(d.date), long: longDay(d.date), value: d.revenue ?? 0 }))} format={naira} title="BiTechTeam revenue per day" />
            </Section>
          )}
          {o.volume && (
            <Section title="Sales through BiManage per day (live)">
              <BarChart data={o.series.map((d): BarDatum => ({ key: d.date, label: shortDay(d.date), long: longDay(d.date), value: (d.storeSales ?? 0) + (d.bisupplynetSales ?? 0), detail: `Store ${naira(d.storeSales)} · BiSupplyNet ${naira(d.bisupplynetSales)}` }))} format={naira} title="Online store and BiSupplyNet sales per day" valueLabel="Sales" />
            </Section>
          )}
          <Section title="Sign-ups per day">
            <BarChart data={o.series.map((d): BarDatum => ({ key: d.date, label: shortDay(d.date), long: longDay(d.date), value: d.signups }))} format={(n) => `${count(n)} sign-up${n === 1 ? "" : "s"}`} title="Sign-ups per day" valueLabel="Sign-ups" />
          </Section>
        </>
      )}
    </AdminPage>
  );
}
