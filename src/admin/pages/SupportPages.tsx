import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { count } from "@/lib/format";
import { Button, Field, SelectInput, TextArea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { AdminPage, Toolbar, SearchBox, FilterSelect, Metrics, Records, Guidance, Pager, Section, Facts, Pill, ErrorBox, Loading, dateTime, words, useDebounced, type Column } from "../components/AdminKit";
import { useAdminAction, useAdminMe, useAssignees, useOverview, useServiceRequest, useServiceRequests, useTicket, useTickets } from "../lib/hooks";
import type { ServiceRequest, Sla, TicketRow } from "../lib/types";

// 16.05 Support operations: tickets (first reply due by priority: urgent 2h,
// high 4h, medium 24h, low 72h; claim or assign) and custom service requests.

const VIEWS: Array<[string, string, Record<string, string>]> = [
  ["active", "Active", { status: "active" }],
  ["mine", "Mine", { assigned: "me", status: "active" }],
  ["unassigned", "Unassigned", { assigned: "unassigned", status: "active" }],
  ["overdue", "Overdue", { sla: "breached" }],
  ["all", "All", {}],
];
const PRIORITY: Array<[string, string]> = [
  ["", "Any priority"],
  ["urgent", "Urgent"],
  ["high", "High"],
  ["medium", "Medium"],
  ["low", "Low"],
];

export function SlaBadge({ sla }: { sla: Sla }) {
  const due = new Date(sla.dueAt);
  const mins = Math.round((due.getTime() - Date.now()) / 60000);
  const left = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m left` : mins > 0 ? `${mins}m left` : "";
  return <Pill value={sla.state} label={sla.state === "on_track" || sla.state === "due_soon" ? left || "Due now" : undefined} />;
}

export function SupportPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "requests" ? "requests" : "tickets";
  const view = params.get("view") || (params.get("sla") === "breached" ? "overdue" : "active");
  const priority = params.get("priority") || "";
  const page = Number(params.get("page") || 1);
  const [q, setQ] = useState("");
  const query = useDebounced(q);
  const base = VIEWS.find((v) => v[0] === view)?.[2] ?? {};
  const tickets = useTickets({ ...base, priority, q: query, page, limit: 20 });
  const requests = useServiceRequests({ page, limit: 20 });
  const ov = useOverview({ range: "30d" });
  const set = (next: Record<string, string>) => setParams(Object.fromEntries(Object.entries({ tab, view, priority, ...next }).filter(([, v]) => v)), { replace: true });

  const ticketCols: Column<TicketRow>[] = [
    { key: "ref", label: "Reference", cell: (t) => t.ticketNumber },
    { key: "subject", label: "Request", cell: (t) => <span className="line-clamp-2">{t.subject}</span> },
    { key: "priority", label: "Priority", cell: (t) => <Pill value={t.priority} /> },
    { key: "owner", label: "Owner", cell: (t) => t.assignedTo?.name || <span className="text-ink-muted">Unassigned</span>, desktopOnly: true },
    { key: "sla", label: "Reply target", cell: (t) => <SlaBadge sla={t.sla} /> },
  ];
  const requestCols: Column<ServiceRequest>[] = [
    { key: "ref", label: "Reference", cell: (r) => r.requestNumber },
    { key: "type", label: "Request type", cell: (r) => words(r.serviceType) },
    { key: "biz", label: "Business", cell: (r) => r.businessName },
    { key: "status", label: "Status", cell: (r) => <Pill value={r.status} /> },
  ];
  return (
    <AdminPage title="Support operations" intro="Manage issues, assistance requests and service enquiries.">
      <div role="tablist" aria-label="Support" className="flex gap-1">
        {([["tickets", "Tickets"], ["requests", "Service requests"]] as Array<[string, string]>).map(([v, l]) => (
          <button key={v} role="tab" type="button" aria-selected={tab === v} onClick={() => setParams({ tab: v }, { replace: true })} className={cn("h-10 rounded-lg px-4 text-body-lg font-semibold", tab === v ? "bg-surface-tonal text-ink-brand" : "text-ink-secondary hover:bg-surface-pale")}>
            {l}
          </button>
        ))}
      </div>
      {ov.data && (
        <Metrics
          items={[
            { tone: "orders", label: "Open tickets", value: count(ov.data.queues.openTickets), caption: "Not yet resolved" },
            { tone: "stock", label: "Overdue replies", value: count(ov.data.queues.overdueTickets), caption: "Past the first-reply target" },
            { tone: "revenue", label: "Reply targets", value: "2h to 72h", caption: "Urgent 2h · high 4h · medium 24h · low 72h" },
          ]}
        />
      )}
      {tab === "tickets" ? (
        <>
          <Toolbar>
            <SearchBox value={q} onChange={setQ} placeholder="Search ticket number, subject or email" />
            <FilterSelect label="View" value={view} onChange={(v) => set({ view: v, page: "" })} options={VIEWS.map(([v, l]) => [v, l] as [string, string])} />
            <FilterSelect label="Priority" value={priority} onChange={(v) => set({ priority: v, page: "" })} options={PRIORITY} />
          </Toolbar>
          <Records
            title="Customer support tickets"
            subtitle="Soonest reply due first."
            columns={ticketCols}
            rows={tickets.data?.tickets}
            rowKey={(t) => t._id}
            rowLink={(t) => `/admin/support/tickets/${t._id}`}
            loading={tickets.isPending}
            error={tickets.error}
            onRetry={() => void tickets.refetch()}
            empty={view === "overdue" ? "No overdue tickets." : "No tickets here."}
            footer={tickets.data && <Pager page={tickets.data.page} totalPages={tickets.data.totalPages} onPage={(p) => set({ page: String(p) })} />}
            side={<Guidance title="Support service levels" rules={["Every ticket has its own reference (TKT-00001).", "First reply targets: urgent 2h, high 4h, medium 24h, low 72h.", "Whoever replies first to an unassigned ticket takes it. Overdue tickets email ops."]} />}
          />
        </>
      ) : (
        <Records
          title="Custom service requests"
          columns={requestCols}
          rows={requests.data?.requests}
          rowKey={(r) => r._id}
          rowLink={(r) => `/admin/support/service-requests/${r._id}`}
          loading={requests.isPending}
          error={requests.error}
          onRetry={() => void requests.refetch()}
          empty="No service requests yet."
          footer={requests.data && <Pager page={requests.data.page} totalPages={requests.data.totalPages} onPage={(p) => setParams({ tab, page: String(p) }, { replace: true })} />}
          side={<Guidance title="Service requests" rules={["Contact the business within 48 hours.", "Keep the status up to date as the work moves.", "Notes are for the BiTechTeam team only."]} />}
        />
      )}
    </AdminPage>
  );
}

const TICKET_STATUS: Array<[string, string]> = [
  ["open", "Open"],
  ["in_progress", "In progress"],
  ["awaiting_reply", "Awaiting customer"],
  ["resolved", "Resolved"],
  ["closed", "Closed"],
];

export function TicketDetailPage() {
  const { id = "" } = useParams();
  const t = useTicket(id);
  const me = useAdminMe().data;
  const assignees = useAssignees();
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const reply = useAdminAction<{ message?: string; status?: string; priority?: string }>("PUT", (v) => `/support/admin/tickets/${v.id}/reply`);
  const assign = useAdminAction<{ adminId: string | null }>("PUT", (v) => `/admin/support/tickets/${v.id}/assign`);
  useEffect(() => {
    if (t.data) {
      setStatus((s) => s || t.data.status);
      setPriority((p) => p || t.data.priority);
    }
  }, [t.data]);
  if (t.error) return <ErrorBox error={t.error} onRetry={() => void t.refetch()} />;
  if (!t.data) return <Loading />;
  const d = t.data;
  const canAssignOthers = me && (me.role === "superadmin" || me.role === "admin");
  const send = () => {
    const body: { message?: string; status?: string; priority?: string } = {};
    if (message.trim()) body.message = message.trim();
    if (status && status !== d.status) body.status = status;
    if (priority && priority !== d.priority) body.priority = priority;
    if (!Object.keys(body).length) return;
    reply.mutate({ id, ...body }, { onSuccess: () => (setMessage(""), setDone(body.message ? "Reply sent. The customer has been emailed." : "Ticket updated.")) });
  };
  return (
    <AdminPage title={`${d.ticketNumber}: ${d.subject}`}>
      <p className="-mt-3">
        <Link to="/admin/support/tickets" className="text-body-sm font-semibold text-ink-brand">← Support queue</Link>
      </p>
      {done && <p className="rounded-lg bg-success-bg px-4 py-3 text-body-lg text-success" role="status">{done}</p>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Section title="Conversation">
            <ol className="flex flex-col gap-3">
              <li className="rounded-lg bg-surface-pale p-3">
                <p className="text-body-sm text-ink-secondary">{d.user?.name || "Customer"} · {dateTime(d.createdAt)}</p>
                <p className="mt-1 whitespace-pre-wrap text-body-lg text-ink-strong">{d.message}</p>
                {(d.attachments || []).map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noreferrer noopener" className="mr-3 text-body-sm font-semibold text-ink-brand underline">{a.name || `Attachment ${i + 1}`}</a>
                ))}
              </li>
              {d.replies.map((r) => (
                <li key={r._id} className={cn("rounded-lg p-3", r.by === "admin" ? "ml-6 bg-surface-tonal" : "mr-6 bg-surface-pale")}>
                  <p className="text-body-sm text-ink-secondary">{r.by === "admin" ? `${r.name || "BiTechTeam"} (BiTechTeam)` : r.name || "Customer"} · {dateTime(r.createdAt)}</p>
                  <p className="mt-1 whitespace-pre-wrap text-body-lg text-ink-strong">{r.message}</p>
                  {r.attachments.map((a, i) => (
                    <a key={i} href={a.url} target="_blank" rel="noreferrer noopener" className="mr-3 text-body-sm font-semibold text-ink-brand underline">{a.name || `Attachment ${i + 1}`}</a>
                  ))}
                </li>
              ))}
            </ol>
          </Section>
          <Section title="Reply">
            <div className="flex flex-col gap-3">
              <Field label="Your reply (the customer gets it by email and in the app)">
                <TextArea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={5000} />
              </Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Status">
                  <SelectInput value={status} onChange={(e) => setStatus(e.target.value)}>
                    {TICKET_STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </SelectInput>
                </Field>
                <Field label="Priority">
                  <SelectInput value={priority} onChange={(e) => setPriority(e.target.value)}>
                    {PRIORITY.slice(1).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </SelectInput>
                </Field>
              </div>
              <p className="text-body-sm text-ink-muted">A reply without a status change marks the ticket "Awaiting customer".</p>
              {reply.error ? <ErrorBox error={reply.error} /> : null}
              <Button onClick={send} loading={reply.isPending} disabled={!message.trim() && status === d.status && priority === d.priority} className="self-end">
                {message.trim() ? "Send reply" : "Update ticket"}
              </Button>
            </div>
          </Section>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <Section title="Ticket">
            <Facts
              rows={[
                ["Status", <Pill key="s" value={d.status} />],
                ["Priority", <Pill key="p" value={d.priority} />],
                ["Reply target", <SlaBadge key="t" sla={d.sla} />],
                ["Due by", dateTime(d.sla.dueAt)],
                ["Category", words(d.category)],
                d.relatedReference ? ["About", d.relatedReference] : null,
              ]}
            />
          </Section>
          <Section title="Owner">
            <p className="text-body-lg text-ink-strong">{d.assignedTo ? `${d.assignedTo.name} (${d.assignedTo.email})` : "Nobody yet"}</p>
            <div className="mt-3 flex flex-col gap-2">
              {me && d.assignedTo?._id !== me._id && (
                <Button variant="secondary" fullWidth loading={assign.isPending} onClick={() => assign.mutate({ id, adminId: "me" }, { onSuccess: () => setDone("The ticket is yours.") })}>
                  Take this ticket
                </Button>
              )}
              {canAssignOthers && (
                <Field label="Assign to">
                  <SelectInput value={d.assignedTo?._id || ""} onChange={(e) => assign.mutate({ id, adminId: e.target.value || null }, { onSuccess: (r) => setDone(r.message || "Updated.") })}>
                    <option value="">Nobody</option>
                    {(assignees.data || []).map((a) => <option key={a._id} value={a._id}>{a.name} · {words(a.role)}</option>)}
                  </SelectInput>
                </Field>
              )}
              {assign.error ? <ErrorBox error={assign.error} /> : null}
            </div>
          </Section>
          <Section title="Customer">
            <Facts rows={[["Name", d.user ? <Link key="u" to={`/admin/users/${d.user._id}`} className="font-semibold text-ink-brand">{d.user.name}</Link> : "—"], ["Email", d.contactEmail || d.user?.email || "—"], ["Business", d.business?.name || "—"]]} />
          </Section>
        </div>
      </div>
    </AdminPage>
  );
}

const REQUEST_STATUS: Array<[string, string]> = [
  ["pending", "New"],
  ["reviewed", "Reviewed"],
  ["in_progress", "In progress"],
  ["completed", "Completed"],
  ["rejected", "Not taken on"],
];

export function ServiceRequestDetailPage() {
  const { id = "" } = useParams();
  const r = useServiceRequest(id);
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const save = useAdminAction<{ status?: string; adminNotes?: string }>("PUT", (v) => `/support/admin/service-requests/${v.id}`);
  if (r.error) return <ErrorBox error={r.error} onRetry={() => void r.refetch()} />;
  if (!r.data) return <Loading />;
  const d = r.data;
  const st = status || d.status;
  const nt = notes ?? d.adminNotes ?? "";
  return (
    <AdminPage title={`${d.requestNumber}: ${words(d.serviceType)}`}>
      <p className="-mt-3">
        <Link to="/admin/support/tickets?tab=requests" className="text-body-sm font-semibold text-ink-brand">← Service requests</Link>
      </p>
      {done && <p className="rounded-lg bg-success-bg px-4 py-3 text-body-lg text-success" role="status">{done}</p>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Section title="The request">
          <Facts
            rows={[
              ["Project", d.projectTitle || "—"],
              ["Business", d.businessName],
              ["Contact", `${d.contactEmail}${d.contactPhone ? ` · ${d.contactPhone}` : ""}`],
              ["Budget", d.budget || "—"],
              ["Timeline", d.timeline || "—"],
              ["Start", words(d.preferredStart || "flexible")],
              ["Received", dateTime(d.createdAt)],
              ["Customer", d.user ? <Link key="u" to={`/admin/users/${d.user._id}`} className="font-semibold text-ink-brand">{d.user.name}</Link> : "—"],
            ]}
          />
          <h3 className="mt-4 text-caption font-semibold uppercase text-ink-muted">Project goals</h3>
          <p className="mt-1 whitespace-pre-wrap rounded-lg bg-surface-pale p-3 text-body-lg text-ink-strong">{d.description}</p>
          {d.brandMaterials && <p className="mt-2 text-body-sm text-ink-secondary">Brand materials: {d.brandMaterials}</p>}
          {(d.referenceFiles || []).map((f, i) => (
            <a key={i} href={f.url} target="_blank" rel="noreferrer noopener" className="mr-3 text-body-sm font-semibold text-ink-brand underline">{f.name || `File ${i + 1}`}</a>
          ))}
        </Section>
        <Section title="Progress">
          <div className="flex flex-col gap-3">
            <Field label="Status">
              <SelectInput value={st} onChange={(e) => setStatus(e.target.value)}>
                {REQUEST_STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </SelectInput>
            </Field>
            <Field label="Team notes (not shown to the customer)">
              <TextArea rows={5} value={nt} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
            </Field>
            {save.error ? <ErrorBox error={save.error} /> : null}
            <Button loading={save.isPending} disabled={st === d.status && nt === (d.adminNotes ?? "")} onClick={() => save.mutate({ id, ...(st !== d.status ? { status: st } : {}), ...(nt !== (d.adminNotes ?? "") ? { adminNotes: nt } : {}) }, { onSuccess: () => setDone("Saved.") })}>
              Save
            </Button>
          </div>
        </Section>
      </div>
    </AdminPage>
  );
}
