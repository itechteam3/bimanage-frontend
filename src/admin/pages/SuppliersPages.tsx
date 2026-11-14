import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { count } from "@/lib/format";
import { Button, Field, TextInput } from "@/components/ui";
import { cn } from "@/lib/cn";
import { AdminPage, Toolbar, SearchBox, Metrics, Records, Guidance, Pager, Section, Facts, Pill, ReasonDialog, ErrorBox, Loading, NotAllowedNote, dateOnly, dateTime, words, useDebounced, type Column } from "../components/AdminKit";
import { useAdminAction, useCan, useSupplier, useSuppliers } from "../lib/hooks";
import type { SupplierRow, SupplierStatus } from "../lib/types";

// 16.03 Wholesaler verification: trust score, CAC and completeness before a
// supplier can sell. Approve; reject with a reason; or request more
// information (the application stays in review until they send it again).

const TABS: Array<[SupplierStatus, string]> = [
  ["pending", "Waiting"],
  ["info_requested", "Info requested"],
  ["verified", "Verified"],
  ["rejected", "Rejected"],
];

export function SuppliersPage() {
  const [params, setParams] = useSearchParams();
  const status = (params.get("status") as SupplierStatus) || "pending";
  const page = Number(params.get("page") || 1);
  const [q, setQ] = useState("");
  const query = useDebounced(q);
  const list = useSuppliers({ status, q: query, page, limit: 20 });
  const counts = list.data?.counts;
  const go = (s: SupplierStatus) => setParams({ status: s }, { replace: true });
  const columns: Column<SupplierRow>[] = [
    { key: "supplier", label: "Supplier", cell: (s) => s.businessName },
    { key: "score", label: "Completeness", cell: (s) => (s.profileScore != null ? `${s.profileScore}%` : "—") },
    { key: "status", label: "Verification", cell: (s) => <Pill value={s.status} /> },
    { key: "when", label: status === "pending" || status === "info_requested" ? "Waiting" : "Reviewed", cell: (s) => (s.waitingDays != null ? `${s.waitingDays} day${s.waitingDays === 1 ? "" : "s"}` : `${dateOnly(s.reviewedAt)}${s.reviewedBy ? ` · ${s.reviewedBy}` : ""}`) },
  ];
  return (
    <AdminPage title="Wholesaler verification" intro="Review trust score, CAC registration and completeness before a supplier can sell.">
      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="Search supplier or application number" />
        <div role="tablist" aria-label="Applications" className="flex flex-wrap gap-1 md:col-span-2 lg:col-span-1">
          {TABS.map(([v, l]) => (
            <button key={v} role="tab" type="button" aria-selected={status === v} onClick={() => go(v)} className={cn("h-10 rounded-lg px-3 text-body-sm font-semibold", status === v ? "bg-surface-tonal text-ink-brand" : "text-ink-secondary hover:bg-surface-pale")}>
              {l}
              {counts ? ` (${count(counts[v])})` : ""}
            </button>
          ))}
        </div>
      </Toolbar>
      <Metrics
        items={[
          { tone: "orders", label: "Verification queue", value: counts ? count(counts.pending + counts.info_requested) : "—", caption: counts ? `${count(counts.info_requested)} waiting on the applicant` : "Applications in review" },
          { tone: "revenue", label: "Auto-approval threshold", value: ">70%", caption: "Complete profile with CAC and a document" },
          { tone: "invoices", label: "Manual review", value: "≤70%", caption: "Request evidence if anything is missing" },
        ]}
      />
      <Records
        title="Wholesale verification queue"
        subtitle={status === "pending" ? "Oldest first." : undefined}
        columns={columns}
        rows={list.data?.suppliers}
        rowKey={(s) => s._id}
        rowLink={(s) => `/admin/suppliers/${s._id}`}
        loading={list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        empty={status === "pending" ? "No applications waiting. Nice." : "Nothing here."}
        footer={list.data && <Pager page={list.data.page} totalPages={list.data.totalPages} onPage={(p) => setParams({ status, page: String(p) }, { replace: true })} />}
        side={<Guidance title="Verification checklist" rules={["Business identity · CAC registration · location · contact details.", "Above 70% completeness with valid documents: approved automatically.", "At or below 70%: check the evidence, or ask the applicant for what's missing."]} />}
      />
    </AdminPage>
  );
}

export function SupplierDetailPage() {
  const { id = "" } = useParams();
  const s = useSupplier(id);
  const can = useCan();
  const [dialog, setDialog] = useState<"approve" | "reject" | "info" | null>(null);
  const [items, setItems] = useState<string[]>(["", ""]);
  const [done, setDone] = useState<string | null>(null);
  const approve = useAdminAction("PUT", (v) => `/admin/suppliers/${v.id}/approve`);
  const reject = useAdminAction<{ reason: string }>("PUT", (v) => `/admin/suppliers/${v.id}/reject`);
  const info = useAdminAction<{ message: string; items: string[] }>("PUT", (v) => `/admin/suppliers/${v.id}/request-info`);
  if (s.error) return <ErrorBox error={s.error} onRetry={() => void s.refetch()} />;
  if (!s.data) return <Loading />;
  const d = s.data;
  const w = d.supplier;
  const ok = (r: { message?: string }) => (setDialog(null), setDone(r.message || "Done."));
  return (
    <AdminPage
      title={w.businessName}
      actions={
        d.canDecide && can("suppliers.review") ? (
          <>
            <Button size="md" variant="secondary" onClick={() => (setDone(null), setDialog("info"))}>
              Request info
            </Button>
            <Button size="md" variant="destructive" onClick={() => (setDone(null), setDialog("reject"))}>
              Reject
            </Button>
            <Button size="md" onClick={() => (setDone(null), setDialog("approve"))}>
              Approve
            </Button>
          </>
        ) : undefined
      }
    >
      <p className="-mt-3">
        <Link to="/admin/suppliers" className="text-body-sm font-semibold text-ink-brand">
          ← Verification queue
        </Link>
      </p>
      {done && <p className="rounded-lg bg-success-bg px-4 py-3 text-body-lg text-success" role="status">{done}</p>}
      {w.infoRequest?.open && (
        <section className="rounded-xl bg-warning-bg p-4 text-body-lg text-warning">
          <p className="font-semibold">Waiting on the applicant since {dateTime(w.infoRequest.requestedAt)}{w.infoRequest.requestedBy ? ` (asked by ${w.infoRequest.requestedBy})` : ""}</p>
          <p className="mt-1">{w.infoRequest.message}</p>
          {w.infoRequest.items.length > 0 && <p className="mt-1 text-body-sm">Needed: {w.infoRequest.items.join(", ")}</p>}
        </section>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Application">
          <Facts
            rows={[
              ["Status", <Pill key="s" value={w.status} />],
              ["Application", w.applicationRef || "—"],
              ["Submitted", dateTime(w.submittedAt)],
              ["Completeness", w.profileScore != null ? `${w.profileScore}%` : "—"],
              ["Trust score", String(w.trustScore ?? 0)],
              w.reviewedBy ? ["Reviewed by", `${w.reviewedBy} · ${dateOnly(w.reviewedAt)}`] : null,
              w.rejectionReason ? ["Rejection reason", w.rejectionReason] : null,
            ]}
          />
        </Section>
        <Section title="Documents">
          <Facts
            rows={[
              ["CAC number", d.documents.cacNumber || <span key="n" className="text-warning">Not given</span>],
              [
                "Certificate",
                d.documents.verificationDocument ? (
                  <a key="d" href={d.documents.verificationDocument.url} target="_blank" rel="noreferrer noopener" className="font-semibold text-ink-brand underline">
                    {d.documents.verificationDocument.name || "Open document"}
                  </a>
                ) : (
                  <span key="n" className="text-warning">Not uploaded</span>
                ),
              ],
            ]}
          />
          <p className="mt-3 text-body-sm text-ink-muted">Check the name and number against the CAC register before approving.</p>
        </Section>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Business">
          <Facts
            rows={[
              ["Category", words(String(w.category || "—"))],
              ["Location", [w.city, w.state].filter(Boolean).join(", ") || "—"],
              ["Address", w.businessAddress || d.business?.address || "—"],
              ["Business email", w.businessEmail || "—"],
              ["Business phone", w.businessPhone || "—"],
              ["Website", d.business?.website || "—"],
              ["Description", w.description || "—"],
            ]}
          />
        </Section>
        <Section title="Owner and plan">
          <Facts
            rows={[
              ["Owner", d.owner ? <Link key="o" to={`/admin${d.owner.link}`} className="font-semibold text-ink-brand">{d.owner.name}</Link> : "—"],
              ["Email", d.owner?.email || "—"],
              ["Plan", words(d.plan.tier)],
              ["Can sell after approval", d.plan.canSell ? "Yes" : "No: selling needs Premium"],
              ["Payout account", w.accountNumber ? `${w.bankName || "Bank"} ${w.accountNumber} (${w.accountName || "name not set"})` : "Not set"],
              ["Products · paid orders", `${count(d.stats.products)} · ${count(d.stats.paidOrders)}`],
            ]}
          />
        </Section>
      </div>
      <Section title="History">
        <ol className="flex flex-col gap-2">
          {d.history.map((h, i) => (
            <li key={i} className="rounded-lg bg-surface-pale px-3 py-2 text-body-lg">
              <span className="font-semibold text-ink-strong">{words(h.event)}</span>
              <span className="text-body-sm text-ink-secondary"> · {h.reference} · {dateTime(h.at)}{h.by ? ` · ${h.by}` : ""}</span>
              {h.reason && <p className="text-body-sm text-ink-strong">{h.reason}</p>}
            </li>
          ))}
        </ol>
      </Section>
      {!can("suppliers.review") && <NotAllowedNote>Only Administrators and Reviewers decide applications.</NotAllowedNote>}

      <ReasonDialog open={dialog === "approve"} onClose={() => setDialog(null)} title={`Approve ${w.businessName}?`} description={d.plan.canSell ? "They can list products on BiSupplyNet straight away. They'll get an email." : "They'll be verified. Selling still needs a Premium plan. They'll get an email."} label="" minLength={0} confirm="Approve" pending={approve.isPending} error={approve.error} onConfirm={() => approve.mutate({ id }, { onSuccess: ok })} />
      <ReasonDialog open={dialog === "reject"} onClose={() => setDialog(null)} tone="danger" title={`Reject ${w.businessName}?`} description="They'll see your reason and can update their details and apply again." label="Reason (they'll see this)" confirm="Reject" pending={reject.isPending} error={reject.error} onConfirm={(reason) => reject.mutate({ id, reason }, { onSuccess: ok })} />
      <ReasonDialog
        open={dialog === "info"}
        onClose={() => setDialog(null)}
        title="Ask for more information"
        description="The application stays in review. They get an email with what you need and update their application."
        label="What do you need? (they'll see this)"
        confirm="Send request"
        placeholder="For example: the CAC certificate is blurry. Please upload a clear photo or PDF."
        pending={info.isPending}
        error={info.error}
        onConfirm={(message) => info.mutate({ id, message, items: items.map((x) => x.trim()).filter(Boolean) }, { onSuccess: ok })}
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="text-body-sm font-semibold text-ink-secondary">Checklist (optional)</legend>
          {items.map((it, i) => (
            <Field key={i} label={`Item ${i + 1}`}>
              <TextInput value={it} onChange={(e) => setItems((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))} placeholder={i === 0 ? "CAC certificate (clear photo or PDF)" : "Proof of address"} />
            </Field>
          ))}
          {items.length < 6 && (
            <button type="button" className="self-start text-body-sm font-semibold text-ink-brand" onClick={() => setItems((xs) => [...xs, ""])}>
              + Add an item
            </button>
          )}
        </fieldset>
      </ReasonDialog>
    </AdminPage>
  );
}
