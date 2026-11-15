import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { naira } from "@/lib/format";
import { Button } from "@/components/ui";
import { AdminPage, Records, Section, Facts, Pill, ReasonDialog, ErrorBox, Loading, NotAllowedNote, TestTag, dateTime, words, type Column } from "../components/AdminKit";
import { adminApi } from "../lib/api";
import { useAdminAction, useCan } from "../lib/hooks";

// Store orders that need BiTechTeam (security fix P0-1): a customer reported a
// problem (the store's earnings wait), or Paystack refused a refund. The ops
// alert emails link here. Deciding moves money, so only Finance and
// superadmins can (money.manage), like BiSupplyNet disputes.

interface AttentionRow {
  trackingNo: string;
  status: string;
  total: number;
  paymentMode: "test" | "live" | null;
  customerName: string;
  problemOpen: boolean;
  refundFailed: boolean;
  createdAt: string;
}

interface StoreOrderMoney {
  order: { trackingNo: string; status: string; isPaid: boolean; paidAt: string | null; paymentMode: "test" | "live" | null; total: number; commissionAmount?: number; vendorPayout?: number; customerName: string; customerEmail: string; deliveredAt: string | null; deliveryConfirmedAt: string | null; statusHistory: Array<{ status: string; at: string }>; createdAt: string };
  store: { storeName: string; storeSlug: string } | null;
  payout: { status: string; holdDays: number; holdEndsAt: string | null; customerConfirmed: boolean; disputeOpen: boolean; releasedAt: string | null; releaseReason: string | null };
  dispute: { status: "open" | "resolved"; reason: string; message: string; openedAt: string; resolvedAt: string | null; outcome: "release" | "refund" | null; note: string | null } | null;
  refund: { status: "pending" | "processed" | "failed" | null; amount: number | null; refundedAt: string | null };
  ledger: Array<{ type: string; amount: number; mode: string; status: string; failureReason: string | null; note: string | null; at: string }>;
}

const PROBLEM: Record<string, string> = { not_received: "Order not received", wrong_item: "Wrong item received", damaged: "Damaged or faulty item", not_as_described: "Not as described", other: "Other" };

export function StoreOrdersAttentionPage() {
  const list = useQuery({ queryKey: ["admin", "store-orders"], queryFn: () => adminApi<{ orders: AttentionRow[] }>("/admin/store-orders") });
  const columns: Column<AttentionRow>[] = [
    { key: "order", label: "Order", cell: (o) => o.trackingNo },
    { key: "customer", label: "Customer", cell: (o) => o.customerName, desktopOnly: true },
    { key: "total", label: "Total", cell: (o) => <span className="inline-flex items-center gap-2">{naira(o.total)} {o.paymentMode !== "live" && <TestTag />}</span> },
    { key: "why", label: "Needs", cell: (o) => <Pill value={o.problemOpen ? "open" : "failed"} label={o.problemOpen ? "Reported problem" : "Refund failed"} /> },
  ];
  return (
    <AdminPage title="Store orders" intro="Online store orders where a customer reported a problem, or a refund didn't go through.">
      <Records
        title="Needs attention"
        columns={columns}
        rows={list.data?.orders}
        rowKey={(o) => o.trackingNo}
        rowLink={(o) => `/admin/store-orders/${encodeURIComponent(o.trackingNo)}`}
        loading={list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        empty="Nothing needs attention right now."
      />
    </AdminPage>
  );
}

export function StoreOrderMoneyPage() {
  const { orderNumber = "" } = useParams();
  const can = useCan();
  const q = useQuery({ queryKey: ["admin", "store-order", orderNumber], queryFn: () => adminApi<StoreOrderMoney>(`/admin/store-orders/${encodeURIComponent(orderNumber)}`) });
  const [outcome, setOutcome] = useState<"release" | "refund" | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const resolve = useAdminAction<{ outcome: "release" | "refund"; note: string }>("POST", () => `/admin/store-orders/${encodeURIComponent(orderNumber)}/dispute/resolve`);
  const retry = useAdminAction("POST", () => `/admin/store-orders/${encodeURIComponent(orderNumber)}/retry-refund`);
  if (q.error) return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data) return <Loading />;
  const d = q.data;
  const o = d.order;
  const mayDecide = can("money.manage");
  return (
    <AdminPage title={`Store order ${o.trackingNo}`}>
      <p className="-mt-3">
        <Link to="/admin/store-orders" className="text-body-sm font-semibold text-ink-brand">
          ← Store orders
        </Link>
      </p>
      {o.paymentMode !== "live" && o.isPaid && <p className="rounded-lg bg-warning-bg px-4 py-3 text-body-lg text-warning">Test payment: no real money moved.</p>}
      {done && (
        <p className="rounded-lg bg-success-bg px-4 py-3 text-body-lg text-success" role="status">
          {done}
        </p>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          {d.dispute && (
            <Section title="Reported problem" actions={<Pill value={d.dispute.status === "open" ? "open" : "resolved"} />}>
              <Facts
                rows={[
                  ["Problem", PROBLEM[d.dispute.reason] ?? words(d.dispute.reason)],
                  ["Reported", dateTime(d.dispute.openedAt)],
                  d.dispute.resolvedAt ? ["Resolved", `${dateTime(d.dispute.resolvedAt)} · ${d.dispute.outcome === "refund" ? "refunded the customer" : "paid the store"}`] : null,
                ]}
              />
              <p className="mt-3 whitespace-pre-wrap rounded-lg bg-surface-pale px-4 py-3 text-body-lg">{d.dispute.message}</p>
              {d.dispute.status === "open" &&
                (mayDecide ? (
                  <div className="mt-4 flex flex-col gap-2 md:flex-row">
                    <Button size="md" onClick={() => setOutcome("release")}>
                      Pay the store
                    </Button>
                    <Button size="md" variant="secondary" className="text-danger" onClick={() => setOutcome("refund")}>
                      Refund the customer
                    </Button>
                  </div>
                ) : (
                  <div className="mt-4">
                    <NotAllowedNote>Only Finance or a superadmin can decide.</NotAllowedNote>
                  </div>
                ))}
            </Section>
          )}
          <Section title="Order" actions={<Pill value={o.status} />}>
            <Facts
              rows={[
                ["Store", d.store?.storeName ?? "—"],
                ["Customer", `${o.customerName} · ${o.customerEmail}`],
                ["Placed", dateTime(o.createdAt)],
                ["Paid", o.isPaid ? dateTime(o.paidAt) : "Not paid"],
                ["Delivered", dateTime(o.deliveredAt)],
                ["Customer confirmed", o.deliveryConfirmedAt ? dateTime(o.deliveryConfirmedAt) : "Not yet"],
              ]}
            />
          </Section>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <Section title="Money">
            <Facts
              rows={[
                ["Customer paid", naira(o.total)],
                o.vendorPayout !== undefined ? ["Store's earnings", naira(o.vendorPayout)] : null,
                ["Earnings", d.payout.status === "held" ? (d.payout.holdEndsAt ? `On hold until ${dateTime(d.payout.holdEndsAt)}` : "On hold until delivery is confirmed") : words(d.payout.status)],
                ["Refund", d.refund.status ? `${words(d.refund.status)}${d.refund.amount ? ` · ${naira(d.refund.amount)}` : ""}` : "—"],
              ]}
            />
            {d.refund.status === "failed" &&
              (mayDecide ? (
                <div className="mt-4 flex flex-col gap-2">
                  <Button size="md" loading={retry.isPending} loadingText="Retrying…" onClick={() => retry.mutate({}, { onSuccess: (r) => setDone(r.message || "Refund sent to Paystack.") })}>
                    Retry refund
                  </Button>
                  {retry.error ? <ErrorBox error={retry.error} /> : null}
                </div>
              ) : (
                <div className="mt-4">
                  <NotAllowedNote>Only Finance or a superadmin can retry refunds.</NotAllowedNote>
                </div>
              ))}
          </Section>
          <Section title="Money ledger">
            {d.ledger.length === 0 ? (
              <p className="text-body-sm text-ink-secondary">No money movements recorded.</p>
            ) : (
              <ol className="flex flex-col gap-1 text-body-lg">
                {d.ledger.map((e, i) => (
                  <li key={i} className="flex flex-wrap justify-between gap-2 rounded-lg bg-surface-pale px-3 py-2">
                    <span className="font-semibold">
                      {words(e.type)} · {naira(e.amount)}
                    </span>
                    <span className="text-body-sm text-ink-secondary">
                      {words(e.status)} · {dateTime(e.at)}
                      {e.failureReason ? ` · ${e.failureReason}` : ""}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>
      </div>
      <ReasonDialog
        open={outcome !== null}
        onClose={() => setOutcome(null)}
        tone="danger"
        title={outcome === "refund" ? "Refund the customer in full?" : "Pay the store?"}
        description={outcome === "refund" ? `${naira(o.total)} goes back to the customer through Paystack. The store's earnings are taken back.` : `The store's earnings (${naira(o.vendorPayout)}) move to its available balance now.`}
        label="Decision note (kept in the audit trail)"
        confirm="Confirm decision"
        pending={resolve.isPending}
        error={resolve.error}
        onConfirm={(note) => {
          if (!outcome) return;
          resolve.mutate({ outcome, note }, { onSuccess: (r) => (setOutcome(null), setDone(r.message || "Decision recorded.")) });
        }}
      >
        <p className="text-body-sm font-semibold text-danger">This can't be undone.</p>
      </ReasonDialog>
    </AdminPage>
  );
}
