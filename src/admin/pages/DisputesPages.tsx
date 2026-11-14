import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { naira, count } from "@/lib/format";
import { Button, Field, TextInput } from "@/components/ui";
import { cn } from "@/lib/cn";
import { AdminPage, Toolbar, FilterSelect, Metrics, Records, Guidance, Pager, Section, Facts, Pill, ReasonDialog, ErrorBox, Loading, NotAllowedNote, TestTag, dateTime, words, type Column } from "../components/AdminKit";
import { useAdminAction, useCan, useDispute, useDisputes, useOverview, useSupplyOrder, useSupplyOrders } from "../lib/hooks";
import type { DisputeRow, LedgerEntry, Money, Parties } from "../lib/types";

// 16.04 Dispute resolution: order history, delivery evidence and both
// parties' responses. Deciding moves money (refund the buyer, pay the
// supplier, or split), so only Finance and superadmins can (decision A10).

const STATUS: Array<[string, string]> = [
  ["", "All disputes"],
  ["open", "Open"],
  ["under_review", "Under review"],
  ["resolved_client", "Refunded buyer"],
  ["resolved_vendor", "Paid supplier"],
  ["resolved_partial", "Split"],
  ["closed", "Closed"],
];

export function DisputesPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "open";
  const page = Number(params.get("page") || 1);
  const list = useDisputes({ status, page, limit: 20 });
  const ov = useOverview({ range: "30d" });
  const columns: Column<DisputeRow>[] = [
    { key: "case", label: "Dispute", cell: (d) => d.reference || d.order?.trackingNo || "Dispute" },
    { key: "parties", label: "Parties", cell: (d) => `${d.client?.name || "Buyer"} / ${d.wholesaler?.businessName || "Supplier"}` },
    { key: "amount", label: "Amount", cell: (d) => (d.order ? naira(d.order.totalAmount) : "—") },
    { key: "reason", label: "Reason", cell: (d) => words(d.reason), desktopOnly: true },
    { key: "status", label: "Status", cell: (d) => <Pill value={d.status} /> },
  ];
  return (
    <AdminPage title="Dispute resolution" intro="Review order history, delivery evidence and both parties' responses.">
      <Toolbar>
        <FilterSelect label="Dispute status" value={status} onChange={(v) => setParams(v ? { status: v } : { status: "" }, { replace: true })} options={STATUS} />
        <Link to="/admin/bisupplynet/orders?refund=failed" className="text-body-sm font-semibold text-ink-brand lg:ml-auto">
          Failed refunds →
        </Link>
      </Toolbar>
      {ov.data && (
        <Metrics
          items={[
            { tone: "stock", label: "Open disputes", value: count(ov.data.queues.openDisputes), caption: "Awaiting a decision" },
            ov.data.balances ? { tone: "revenue", label: "Funds frozen", value: naira(ov.data.balances.escrowFrozen), caption: "Held in escrow until decided" } : { tone: "revenue", label: "Funds frozen", value: "—", caption: "Finance can see amounts" },
            { tone: "invoices", label: "Failed refunds", value: count(ov.data.queues.failedRefunds), caption: "A buyer is still owed money" },
          ]}
        />
      )}
      <Records
        title="Escrow dispute casework"
        columns={columns}
        rows={list.data?.disputes}
        rowKey={(d) => d._id}
        rowLink={(d) => `/admin/bisupplynet/disputes/${d._id}`}
        loading={list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        empty={status === "open" ? "No open disputes." : "No disputes here."}
        footer={list.data && <Pager page={list.data.page} totalPages={list.data.totalPages} onPage={(p) => setParams({ status, page: String(p) }, { replace: true })} />}
        side={<Guidance title="Decision path" rules={["Compare proof of order, delivery times, photos and messages.", "Outcomes: full refund to the buyer, full payout to the supplier, or a split.", "Escrow is released only by the decision. It can't be undone."]} />}
      />
    </AdminPage>
  );
}

function MoneyFacts({ m }: { m: Money }) {
  return (
    <>
      {m.isTest && (
        <p className="mb-3 flex items-center gap-2 rounded-lg bg-surface-pale px-3 py-2 text-body-sm text-ink-secondary">
          <TestTag /> Test payment (not real money).
        </p>
      )}
      <Facts
        rows={[
          ["Order total", naira(m.totalAmount)],
          ["Escrow", <Pill key="e" value={m.escrowStatus} />],
          ["BiManage commission", `${naira(m.commissionAmount)} (${m.commissionRate}%)`],
          ["Supplier payout", naira(m.supplierPayout)],
          m.refundAmount ? ["Refund", `${naira(m.refundAmount)} · ${words(m.refundStatus)}`] : null,
          m.supplierReceived != null ? ["Supplier received", naira(m.supplierReceived)] : null,
          m.releasedAt ? ["Released", dateTime(m.releasedAt)] : null,
        ]}
      />
    </>
  );
}

function PartiesFacts({ p }: { p: Parties }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <h3 className="text-caption font-semibold uppercase text-ink-muted">Buyer</h3>
        {p.buyer ? (
          <p className="mt-1 text-body-lg text-ink-strong">
            <Link to={`/admin${p.buyer.link}`} className="font-semibold text-ink-brand">{p.buyer.name}</Link>
            {p.buyer.business ? ` · ${p.buyer.business}` : ""}
            <br />
            <span className="[overflow-wrap:anywhere] text-body-sm text-ink-secondary">{p.buyer.email}{p.buyer.phone ? ` · ${p.buyer.phone}` : ""}</span>
          </p>
        ) : (
          <p className="text-body-lg">—</p>
        )}
      </div>
      <div>
        <h3 className="text-caption font-semibold uppercase text-ink-muted">Supplier</h3>
        {p.supplier ? (
          <p className="mt-1 text-body-lg text-ink-strong">
            {p.supplier.link ? <Link to={`/admin${p.supplier.link}`} className="font-semibold text-ink-brand">{p.supplier.businessName}</Link> : p.supplier.businessName}{" "}
            <Pill value={p.supplier.verificationStatus} />
            <br />
            <span className="[overflow-wrap:anywhere] text-body-sm text-ink-secondary">{p.supplier.owner ? `${p.supplier.owner.name} · ${p.supplier.owner.email}` : ""}</span>
          </p>
        ) : (
          <p className="text-body-lg">—</p>
        )}
      </div>
    </div>
  );
}

function Ledger({ entries }: { entries: LedgerEntry[] }) {
  if (!entries.length) return <p className="text-body-lg text-ink-secondary">No escrow entries yet.</p>;
  return (
    <ol className="flex flex-col gap-2">
      {entries.map((e) => (
        <li key={e._id || e.reference} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-pale px-3 py-2 text-body-lg">
          <span className="font-semibold text-ink-strong">{words(e.type)}</span>
          <span>{naira(e.amount)}</span>
          <span className="flex items-center gap-2 text-body-sm text-ink-secondary">
            {e.mode === "test" && <TestTag />}
            {e.status !== "completed" && <Pill value={e.status} />}
            {dateTime(e.createdAt)}
          </span>
          {e.failureReason && <p className="w-full text-body-sm text-danger">{e.failureReason}</p>}
        </li>
      ))}
    </ol>
  );
}

type Outcome = "refund" | "release" | "partial";

export function DisputeDetailPage() {
  const { id = "" } = useParams();
  const q = useDispute(id);
  const can = useCan();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [refund, setRefund] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const decide = useAdminAction<{ outcome: Outcome; refundAmount?: number; resolution: string; reason: string }>("PUT", (v) => `/disputes/${v.id}/resolve`);
  const retry = useAdminAction("POST", (v) => `/disputes/${v.id}/retry-refund`);
  if (q.error) return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data) return <Loading />;
  const d = q.data;
  const dis = d.dispute;
  const total = d.money?.totalAmount ?? 0;
  const partial = Number(refund);
  const partialOk = outcome !== "partial" || (partial > 0 && partial < total);
  const LABEL: Record<Outcome, string> = { refund: "Refund the buyer in full", release: "Pay the supplier in full", partial: "Split: part refund" };
  return (
    <AdminPage title={`Dispute ${dis.reference || ""}`.trim()}>
      <p className="-mt-3">
        <Link to="/admin/bisupplynet/disputes" className="text-body-sm font-semibold text-ink-brand">
          ← All disputes
        </Link>
      </p>
      {done && <p className="rounded-lg bg-success-bg px-4 py-3 text-body-lg text-success" role="status">{done}</p>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Section title="The case" actions={<Pill value={dis.status} />}>
            <Facts
              rows={[
                ["Reason", words(dis.reason)],
                ["Opened", dateTime(dis.createdAt)],
                ["Buyer asks for", words(dis.requestedResolution || "—")],
                dis.amountDisputed ? ["Amount disputed", naira(dis.amountDisputed)] : null,
                dis.affectedQuantity ? ["Quantity affected", count(dis.affectedQuantity)] : null,
                dis.dateReceived ? ["Received on", dateTime(dis.dateReceived)] : null,
              ]}
            />
            <p className="mt-3 whitespace-pre-wrap rounded-lg bg-surface-pale p-3 text-body-lg text-ink-strong">{dis.description}</p>
          </Section>
          <Section title="Evidence and responses">
            {(dis.evidenceFiles?.length || dis.evidence?.length) ? (
              <ul className="mb-3 flex flex-wrap gap-2">
                {(dis.evidenceFiles?.length ? dis.evidenceFiles : (dis.evidence || []).map((url) => ({ url, name: undefined as string | undefined, by: "buyer" }))).map((f, i) => (
                  <li key={i}>
                    <a href={f.url} target="_blank" rel="noreferrer noopener" className="inline-flex h-10 items-center rounded-lg bg-surface-tonal px-3 text-body-sm font-semibold text-ink-brand">
                      {f.name || `File ${i + 1}`}{f.by ? ` (${words(f.by)})` : ""}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            {dis.responses.length ? (
              <ol className="flex flex-col gap-2">
                {dis.responses.map((r) => (
                  <li key={r._id} className="rounded-lg bg-surface-pale p-3 text-body-lg">
                    <p className="text-body-sm text-ink-secondary">
                      {words(r.by)}{r.name ? ` · ${r.name}` : ""} · {dateTime(r.createdAt)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-ink-strong">{r.message}</p>
                    {r.evidence.map((u, i) => (
                      <a key={i} href={u} target="_blank" rel="noreferrer noopener" className="mr-2 text-body-sm font-semibold text-ink-brand underline">
                        Attachment {i + 1}
                      </a>
                    ))}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-body-lg text-ink-secondary">No responses yet.</p>
            )}
          </Section>
          <Section title="Parties">
            <PartiesFacts p={d} />
          </Section>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          {d.money && (
            <Section title="Money">
              <MoneyFacts m={d.money} />
            </Section>
          )}
          {d.canDecide && (
            <Section title="Decision">
              {can("money.manage") ? (
                <div className="flex flex-col gap-2">
                  {(["refund", "release", "partial"] as Outcome[]).map((o) => (
                    <Button key={o} variant={o === "partial" ? "secondary" : "outlined"} fullWidth onClick={() => (setDone(null), setRefund(""), setOutcome(o))}>
                      {LABEL[o]}
                    </Button>
                  ))}
                </div>
              ) : (
                <NotAllowedNote>Deciding a dispute moves money, so only Finance and superadmins can.</NotAllowedNote>
              )}
            </Section>
          )}
          {d.money?.refundStatus === "failed" && (
            <Section title="Refund failed">
              <p className="text-body-lg text-danger">Paystack refused the refund. The buyer is still owed {naira(d.money.refundAmount)}.</p>
              {can("money.manage") ? (
                <Button className="mt-3" fullWidth loading={retry.isPending} onClick={() => retry.mutate({ id }, { onSuccess: (r) => setDone(r.message || "Refund sent again.") })}>
                  Retry the refund
                </Button>
              ) : (
                <NotAllowedNote>Finance can retry the refund.</NotAllowedNote>
              )}
              {retry.error ? <ErrorBox error={retry.error} /> : null}
            </Section>
          )}
          {d.order && (
            <Section title="Order">
              <Facts rows={[["Order", <Link key="o" to={`/admin${d.order.link}`} className="font-semibold text-ink-brand">{d.order.trackingNo}</Link>], ["Product", `${d.order.productName} × ${count(d.order.quantity)}`], ["Order status", <Pill key="s" value={d.order.status} />], ["Delivered", dateTime(d.order.deliveredAt)]]} />
            </Section>
          )}
          <Section title="Escrow ledger">
            <Ledger entries={d.ledger} />
          </Section>
        </div>
      </div>
      <ReasonDialog
        open={outcome !== null}
        onClose={() => setOutcome(null)}
        tone="danger"
        title={outcome ? `${LABEL[outcome]}?` : ""}
        description={outcome === "refund" ? `${naira(total)} goes back to the buyer. The supplier gets nothing.` : outcome === "release" ? `The supplier is paid ${naira(d.money?.supplierPayout)} after commission. The buyer gets nothing back.` : "Enter the refund. The rest goes to the supplier, less commission."}
        label="Decision note (both parties see this)"
        confirm="Confirm decision"
        pending={decide.isPending}
        error={decide.error}
        onConfirm={(note) => {
          if (!outcome || !partialOk) return;
          decide.mutate({ id, outcome, ...(outcome === "partial" ? { refundAmount: partial } : {}), resolution: note, reason: note }, { onSuccess: (r) => (setOutcome(null), setDone(r.message || "Decision recorded.")) });
        }}
      >
        {outcome === "partial" && (
          <Field label={`Refund to the buyer (less than ${naira(total)})`} error={refund && !partialOk ? "Enter an amount above ₦0 and below the order total." : undefined}>
            <TextInput inputMode="decimal" value={refund} onChange={(e) => setRefund(e.target.value.replace(/[^0-9.]/g, ""))} />
          </Field>
        )}
        <p className="text-body-sm font-semibold text-danger">This can't be undone.</p>
      </ReasonDialog>
    </AdminPage>
  );
}

export function SupplyOrdersPage() {
  const [params, setParams] = useSearchParams();
  const refund = params.get("refund") || "";
  const page = Number(params.get("page") || 1);
  const list = useSupplyOrders({ refund, page, limit: 20 });
  type Row = { _id: string; trackingNo: string; productName: string; totalAmount: number; status: string; refundStatus?: string; paymentMode?: string; client?: { name: string }; wholesaler?: { businessName: string } };
  const columns: Column<Row>[] = [
    { key: "order", label: "Order", cell: (o) => o.trackingNo },
    { key: "parties", label: "Buyer / supplier", cell: (o) => `${o.client?.name || "—"} / ${o.wholesaler?.businessName || "—"}` },
    { key: "amount", label: "Amount", cell: (o) => <span className="inline-flex items-center gap-2">{naira(o.totalAmount)}{o.paymentMode === "test" && <TestTag />}</span> },
    { key: "status", label: "Status", cell: (o) => <Pill value={o.refundStatus === "failed" ? "failed" : o.status} label={o.refundStatus === "failed" ? "Refund failed" : undefined} /> },
  ];
  return (
    <AdminPage title="BiSupplyNet orders">
      <Toolbar>
        <div role="tablist" className="flex gap-1">
          {([["", "All orders"], ["failed", "Failed refunds"]] as Array<[string, string]>).map(([v, l]) => (
            <button key={v} role="tab" type="button" aria-selected={refund === v} onClick={() => setParams(v ? { refund: v } : {}, { replace: true })} className={cn("h-10 rounded-lg px-3 text-body-sm font-semibold", refund === v ? "bg-surface-tonal text-ink-brand" : "text-ink-secondary hover:bg-surface-pale")}>
              {l}
            </button>
          ))}
        </div>
      </Toolbar>
      <Records title="Orders" columns={columns} rows={list.data?.orders as Row[] | undefined} rowKey={(o) => o._id} rowLink={(o) => `/admin/bisupplynet/orders/${o._id}`} loading={list.isPending} error={list.error} onRetry={() => void list.refetch()} empty={refund ? "No failed refunds." : "No orders yet."} footer={list.data && <Pager page={list.data.page} totalPages={list.data.totalPages} onPage={(p) => setParams({ ...(refund ? { refund } : {}), page: String(p) }, { replace: true })} />} />
    </AdminPage>
  );
}

export function SupplyOrderDetailPage() {
  const { id = "" } = useParams();
  const q = useSupplyOrder(id);
  if (q.error) return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data) return <Loading />;
  const d = q.data;
  const o = d.order;
  return (
    <AdminPage title={`Order ${o.trackingNo}`}>
      <p className="-mt-3">
        <Link to="/admin/bisupplynet/orders" className="text-body-sm font-semibold text-ink-brand">← BiSupplyNet orders</Link>
      </p>
      {d.dispute && (
        <p className="rounded-lg bg-warning-bg px-4 py-3 text-body-lg text-warning">
          Disputed: <Link to={`/admin${d.dispute.link}`} className="font-semibold underline">{d.dispute.reference || "open the dispute"}</Link> (<Pill value={d.dispute.status} />)
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Section title="Order" actions={<Pill value={o.status} />}>
            <Facts
              rows={[
                ["Product", `${o.productName} × ${count(o.quantity)}`],
                ["Price per unit", naira(o.pricePerUnit)],
                ["Placed", dateTime(o.createdAt)],
                ["Deliver to", o.receivingBusiness ? `${o.receivingBusiness}, ${o.deliveryAddress}` : o.deliveryAddress],
                ["Contact phone", o.contactPhone || "—"],
                ["Expected by", dateTime(o.expectedBy)],
                ["Shipped", dateTime(o.shippedAt)],
                ["Delivered", dateTime(o.deliveredAt)],
                o.cancelReason ? ["Cancelled because", o.cancelReason] : null,
              ]}
            />
          </Section>
          <Section title="Parties">
            <PartiesFacts p={d} />
          </Section>
          <Section title="Status history">
            <ol className="flex flex-col gap-1 text-body-lg">
              {o.statusHistory.map((h, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2 rounded-lg bg-surface-pale px-3 py-2">
                  <span className="font-semibold">{words(h.status)}</span>
                  <span className="text-body-sm text-ink-secondary">{dateTime(h.at)}{h.by ? ` · ${words(h.by)}` : ""}</span>
                </li>
              ))}
            </ol>
          </Section>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <Section title="Money">
            <MoneyFacts m={d.money} />
          </Section>
          <Section title="Escrow ledger">
            <Ledger entries={d.ledger} />
          </Section>
        </div>
      </div>
    </AdminPage>
  );
}
