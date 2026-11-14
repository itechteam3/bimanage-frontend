import { useState } from "react";
import { Link } from "react-router-dom";
import { naira, count } from "@/lib/format";
import { ButtonLink } from "@/components/ui";
import { BarChart, type BarDatum } from "@/pages/sales/SalesPages";
import { AdminPage, Toolbar, FilterSelect, Metrics, Records, Guidance, ErrorBox, Loading, Section, Facts, Pill, TestTag, type Column } from "../components/AdminKit";
import { useCan, useOverview } from "../lib/hooks";
import type { Capability, Overview } from "../lib/types";

// 16.01 Platform overview: the queues that need an admin, platform health and
// (for roles that see money) BiTechTeam's own revenue, live money only.

const RANGES: Array<[string, string]> = [
  ["today", "Today"],
  ["7d", "Last 7 days"],
  ["30d", "Last 30 days"],
  ["90d", "Last 90 days"],
];

interface QueueRow {
  key: string;
  name: string;
  count: number;
  priority: "high" | "medium" | "low";
  state: string;
  action: string;
  to: string;
  can: Capability;
}

export function queuesOf(o: Overview): QueueRow[] {
  const q = o.queues;
  const rows: QueueRow[] = [
    { key: "overdue", name: "Overdue support tickets", count: q.overdueTickets, priority: "high", state: "Past the reply target", action: "Reply now", to: "/admin/support/tickets?sla=breached", can: "support.manage" },
    { key: "disputes", name: "BiSupplyNet disputes", count: q.openDisputes, priority: "high", state: "Money held until decided", action: "Open evidence", to: "/admin/bisupplynet/disputes", can: "disputes.read" },
    { key: "refunds", name: "Failed refunds", count: q.failedRefunds, priority: "high", state: "A buyer is still owed money", action: "Retry refund", to: "/admin/bisupplynet/orders?refund=failed", can: "money.manage" },
    { key: "suppliers", name: "Supplier verification", count: q.suppliersToReview, priority: "medium", state: "Waiting for a decision", action: "Review KYC", to: "/admin/suppliers?status=pending", can: "suppliers.review" },
    { key: "tickets", name: "Open support tickets", count: q.openTickets, priority: "medium", state: "In the support queue", action: "Assign owner", to: "/admin/support/tickets?status=active", can: "support.manage" },
    { key: "domains", name: "Custom domains to add", count: q.domainsToAdd, priority: "low", state: "Add to the hosting project", action: "Add domains", to: "/admin/store-domains", can: "domains.manage" },
  ];
  return rows;
}

export function OverviewPage() {
  const [range, setRange] = useState("30d");
  const ov = useOverview({ range });
  const can = useCan();
  const o = ov.data;
  const queues = o ? queuesOf(o).filter((r) => can(r.can)) : undefined;
  const waiting = queues ? queues.filter((r) => r.count > 0) : undefined;
  const first = waiting && waiting[0];
  const columns: Column<QueueRow>[] = [
    { key: "queue", label: "Queue", cell: (r) => `${r.name} · ${count(r.count)}` },
    { key: "priority", label: "Priority", cell: (r) => <Pill value={r.priority} /> },
    { key: "state", label: "Current state", cell: (r) => r.state },
    { key: "next", label: "Next step", cell: (r) => <Link to={r.to} className="inline-flex h-10 items-center rounded-lg bg-surface-tonal px-3 text-body-sm font-semibold text-ink-brand">{r.action}</Link> },
  ];

  return (
    <AdminPage title="Platform overview" intro="Monitor the queues that require administrator action.">
      <Toolbar>
        <FilterSelect label="Period" value={range} onChange={setRange} options={RANGES} />
        <p className="text-body-sm text-ink-muted lg:flex-1">{o ? `${o.period.from} to ${o.period.to}, Lagos time` : " "}</p>
        {first ? (
          <ButtonLink to={first.to} size="md">
            {first.action} →
          </ButtonLink>
        ) : null}
      </Toolbar>
      {ov.error ? <ErrorBox error={ov.error} onRetry={() => void ov.refetch()} /> : null}
      {!o && !ov.error ? <Loading /> : null}
      {o && (
        <>
          <Metrics
            items={[
              { tone: "orders", label: "Merchants", value: count(o.users.total), caption: `${count(o.users.new)} new in the period${o.users.newChange != null ? ` (${o.users.newChange > 0 ? "+" : ""}${o.users.newChange}%)` : ""}` },
              o.balances
                ? { tone: "revenue", label: "Protected funds", value: naira(o.balances.escrowHeld + o.balances.escrowFrozen), caption: `Escrow ledger · ${naira(o.balances.escrowFrozen)} frozen in disputes` }
                : { tone: "revenue", label: "Businesses on paid plans", value: count(o.businesses.standard + o.businesses.premium), caption: "Standard and Premium" },
              { tone: "stock", label: "Open disputes", value: count(o.queues.openDisputes), caption: "Awaiting resolution" },
            ]}
          />
          <Records
            title="Platform health & pending decisions"
            subtitle={waiting && waiting.length ? `${waiting.length} queue${waiting.length === 1 ? "" : "s"} need${waiting.length === 1 ? "s" : ""} attention.` : "Nothing is waiting. All queues are clear."}
            columns={columns}
            rows={queues}
            rowKey={(r) => r.key}
            empty="No queues for your role."
            side={
              <Guidance
                title="Admin workspace"
                rules={["Review pending verification, disputes and support from their own modules.", "Money figures count live payments only. Test payments are labelled and kept apart.", "Check the escrow ledger before deciding a dispute or retrying a refund."]}
              />
            }
          />
          {o.revenue && <MoneyBlocks o={o} />}
          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="Businesses by plan">
              <Facts rows={[["Freemium", count(o.businesses.freemium)], ["Free trial", count(o.businesses.trial)], ["Standard", count(o.businesses.standard)], ["Premium", count(o.businesses.premium)], ["Startup package", count(o.businesses.startupPackage)], ["Suspended accounts", count(o.users.suspended)]]} />
            </Section>
            <Section title="FELI today">
              <Facts
                rows={[
                  ["Messages", count(o.feli.today.messages)],
                  ["Tokens used", count(o.feli.today.totalTokens)],
                  ["Busiest minute", `${count(o.feli.today.peakTokensPerMinute)} tokens (limit 8,000)`],
                  ["Busy answers", o.feli.today.busyReplies ? <Pill value="failed" label={`${o.feli.today.busyReplies} busy`} /> : "None"],
                ]}
              />
            </Section>
          </div>
          <Section title="New sign-ups">
            <BarChart data={o.series.map((d): BarDatum => ({ key: d.date, label: shortDay(d.date), long: longDay(d.date), value: d.signups }))} format={(n) => `${count(n)} sign-up${n === 1 ? "" : "s"}`} title="New sign-ups per day" valueLabel="Sign-ups" />
          </Section>
        </>
      )}
    </AdminPage>
  );
}

function MoneyBlocks({ o }: { o: Overview }) {
  const r = o.revenue!;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Section title="BiTechTeam revenue (live)">
        <p className="text-title-lg text-ink-strong">{naira(r.total)}</p>
        <p className="text-body-sm text-ink-muted">{r.change != null ? `${r.change > 0 ? "+" : ""}${r.change}% on the period before (${naira(r.previous)})` : "No revenue in the period before to compare."}</p>
        <div className="mt-3">
          <Facts rows={[["Plans and packages", naira(r.plans)], ["Store commission (3%)", naira(r.storeCommission)], ["BiSupplyNet commission", naira(r.bisupplynetCommission)]]} />
        </div>
        {o.test && o.test.total > 0 ? (
          <p className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-surface-pale px-3 py-2 text-body-sm text-ink-secondary">
            <TestTag /> {o.test.label}: {naira(o.test.total)} in fees, {naira(o.test.storeSales + o.test.bisupplynetSales)} in sales. Not counted.
          </p>
        ) : null}
      </Section>
      <Section title="Money moving through BiManage">
        <Facts
          rows={[
            ["Online store sales", o.volume ? `${naira(o.volume.storeSales)} · ${count(o.volume.storeOrders)} orders` : "—"],
            ["BiSupplyNet sales", o.volume ? `${naira(o.volume.bisupplynetSales)} · ${count(o.volume.bisupplynetOrders)} orders` : "—"],
            ["Wallets: available", o.balances ? naira(o.balances.walletsAvailable) : "—"],
            ["Wallets: on hold", o.balances ? naira(o.balances.walletsOnHold) : "—"],
          ]}
        />
      </Section>
    </div>
  );
}

export const shortDay = (d: string) => new Date(`${d}T12:00:00+01:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });
export const longDay = (d: string) => new Date(`${d}T12:00:00+01:00`).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
