import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { count } from "@/lib/format";
import { Button, ButtonLink, Field, TextArea, TextInput } from "@/components/ui";
import { cn } from "@/lib/cn";
import { AdminPage, Toolbar, FilterSelect, Metrics, Records, Guidance, Pager, Section, Facts, Pill, ErrorBox, Loading, NotAllowedNote, dateTime, type Column } from "../components/AdminKit";
import { adminApi, adminError, fieldOf } from "../lib/api";
import { useAdminAction, useAdminMe, useAnnouncement, useAnnouncementPreview, useAnnouncements } from "../lib/hooks";
import type { Announcement } from "../lib/types";

// 16.06 Announcements (decision A9): drafts, audience, channel, preview,
// schedule. An email to everyone needs a second admin's approval.

const STATUS: Array<[string, string]> = [
  ["", "All"],
  ["draft", "Drafts"],
  ["pending_approval", "Needs approval"],
  ["scheduled", "Scheduled"],
  ["sending", "Sending"],
  ["sent", "Sent"],
  ["cancelled", "Cancelled"],
];
const PLANS: Array<[string, string]> = [
  ["freemium", "Freemium"],
  ["trial", "Free trial"],
  ["standard", "Standard"],
  ["premium", "Premium"],
];
export const audienceLabel = (a: Announcement["audience"]) => (a.kind === "all" ? "Everyone" : a.kind === "suppliers" ? "Verified suppliers" : a.plans.map((p) => PLANS.find((x) => x[0] === p)?.[1] || p).join(", "));
export const channelLabel = (c: Announcement["channels"]) => (c.inApp && c.email ? "In-app and email" : c.email ? "Email" : "In-app");

export function AnnouncementsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") || "";
  const page = Number(params.get("page") || 1);
  const list = useAnnouncements({ status, page, limit: 20 });
  const drafts = useAnnouncements({ status: "draft", limit: 1 });
  const approvals = useAnnouncements({ status: "pending_approval", limit: 1 });
  const columns: Column<Announcement>[] = [
    { key: "title", label: "Announcement", cell: (a) => a.title },
    { key: "audience", label: "Audience", cell: (a) => audienceLabel(a.audience) },
    { key: "channel", label: "Channel", cell: (a) => channelLabel(a.channels) },
    { key: "status", label: "Status", cell: (a) => <Pill value={a.status} /> },
  ];
  return (
    <AdminPage title="Announcements" intro="Prepare notices for the dashboard and email." actions={<ButtonLink to="/admin/announcements/new" size="md">Create notice →</ButtonLink>}>
      <Toolbar>
        <FilterSelect label="Status" value={status} onChange={(v) => setParams(v ? { status: v } : {}, { replace: true })} options={STATUS} />
      </Toolbar>
      <Metrics
        items={[
          { tone: "orders", label: "Saved drafts", value: drafts.data ? count(drafts.data.total) : "—", caption: "Not sent yet" },
          { tone: "invoices", label: "Needs approval", value: approvals.data ? count(approvals.data.total) : "—", caption: "Email to everyone: a second admin approves" },
          { tone: "revenue", label: "Email delivery", value: "250 a day", caption: "Sent in batches; resumes the next day" },
        ]}
      />
      <Records
        title="Broadcast announcements"
        columns={columns}
        rows={list.data?.announcements}
        rowKey={(a) => a._id}
        rowLink={(a) => `/admin/announcements/${a._id}`}
        loading={list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        empty="No announcements yet."
        footer={list.data && <Pager page={list.data.page} totalPages={list.data.totalPages} onPage={(p) => setParams({ ...(status ? { status } : {}), page: String(p) }, { replace: true })} />}
        side={<Guidance title="Pre-publish review" rules={["Write a title, the message, the audience and the channel.", "Preview it and send yourself a test. Email to everyone needs a second admin.", "Avoid misleading language about payments, balances or downtime."]} />}
      />
    </AdminPage>
  );
}

interface Draft {
  title: string;
  body: string;
  linkLabel: string;
  linkUrl: string;
  kind: "all" | "plan" | "suppliers";
  plans: string[];
  inApp: boolean;
  email: boolean;
}
const EMPTY: Draft = { title: "", body: "", linkLabel: "", linkUrl: "", kind: "all", plans: [], inApp: true, email: false };
const toBody = (d: Draft) => ({ title: d.title, body: d.body, link: d.linkUrl ? { label: d.linkLabel || "Open BiManage", url: d.linkUrl } : null, audience: { kind: d.kind, plans: d.kind === "plan" ? d.plans : [] }, channels: { inApp: d.inApp, email: d.email } });

export function AnnouncementEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const me = useAdminMe().data;
  const existing = useAnnouncement(id);
  const [d, setD] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [version, setVersion] = useState(0);
  const [when, setWhen] = useState<"now" | "later">("now");
  const [at, setAt] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const preview = useAnnouncementPreview(id, version);
  const submit = useAdminAction<{ scheduledAt?: string }>("POST", (v) => `/admin/announcements/${v.id}/submit`);
  const approve = useAdminAction("POST", (v) => `/admin/announcements/${v.id}/approve`);
  const cancel = useAdminAction("POST", (v) => `/admin/announcements/${v.id}/cancel`);
  const test = useAdminAction("POST", (v) => `/admin/announcements/${v.id}/test`);
  const a = existing.data;
  useEffect(() => {
    if (a) setD({ title: a.title, body: a.body, linkLabel: a.link?.label || "", linkUrl: a.link?.url || "", kind: a.audience.kind, plans: a.audience.plans, inApp: a.channels.inApp, email: a.channels.email });
  }, [a]);
  if (id && existing.error) return <ErrorBox error={existing.error} onRetry={() => void existing.refetch()} />;
  if (id && !a) return <Loading />;
  const editable = !a || a.editable;
  const needsApproval = d.email && d.kind === "all";
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!id) {
        const created = await adminApi<Announcement>("/admin/announcements", { method: "POST", body: toBody(d) });
        navigate(`/admin/announcements/${created._id}`, { replace: true });
      } else {
        await adminApi(`/admin/announcements/${id}`, { method: "PUT", body: toBody(d) });
        await existing.refetch();
        setVersion((v) => v + 1);
        setDone("Draft saved.");
      }
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };
  const field = fieldOf(error);
  const canApprove = a && a.status === "pending_approval" && me && a.createdBy?.email !== me.email && a.submittedBy?.email !== me.email;
  return (
    <AdminPage title={a ? a.title : "New announcement"} actions={a ? <Pill value={a.status} /> : undefined}>
      <p className="-mt-3">
        <Link to="/admin/announcements" className="text-body-sm font-semibold text-ink-brand">← Announcements</Link>
      </p>
      {done && <p className="rounded-lg bg-success-bg px-4 py-3 text-body-lg text-success" role="status">{done}</p>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Section title={editable ? "Compose" : "Message"}>
          <fieldset disabled={!editable} className="flex flex-col gap-4">
            <Field label="Title" required error={field === "title" ? adminError(error) : undefined}>
              <TextInput value={d.title} onChange={(e) => set("title", e.target.value)} maxLength={120} />
            </Field>
            <Field label="Message" required hint="Plain text. Leave a blank line between paragraphs." error={field === "body" ? adminError(error) : undefined}>
              <TextArea rows={8} value={d.body} onChange={(e) => set("body", e.target.value)} maxLength={4000} />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Button label (optional)">
                <TextInput value={d.linkLabel} onChange={(e) => set("linkLabel", e.target.value)} maxLength={40} placeholder="See what's new" />
              </Field>
              <Field label="Button link (optional)" hint="https://… or a BiManage page like /invoices" error={field === "link" ? adminError(error) : undefined}>
                <TextInput value={d.linkUrl} onChange={(e) => set("linkUrl", e.target.value)} placeholder="/invoices" />
              </Field>
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-body-sm font-semibold text-ink-secondary">Who gets it</legend>
              {(
                [
                  ["all", "Everyone (verified accounts)"],
                  ["plan", "Businesses on some plans"],
                  ["suppliers", "Verified BiSupplyNet suppliers"],
                ] as const
              ).map(([v, l]) => (
                <label key={v} className="flex items-center gap-3 text-body-lg">
                  <input type="radio" name="audience" checked={d.kind === v} onChange={() => set("kind", v)} className="size-5" /> {l}
                </label>
              ))}
              {d.kind === "plan" && (
                <div className="ml-8 flex flex-wrap gap-3">
                  {PLANS.map(([v, l]) => (
                    <label key={v} className="flex items-center gap-2 text-body-lg">
                      <input type="checkbox" className="size-5" checked={d.plans.includes(v)} onChange={(e) => set("plans", e.target.checked ? [...d.plans, v] : d.plans.filter((p) => p !== v))} /> {l}
                    </label>
                  ))}
                </div>
              )}
              {field === "audience" && <p className="text-body-sm text-danger">{adminError(error)}</p>}
            </fieldset>
            <fieldset className="flex flex-wrap gap-4">
              <legend className="mb-2 text-body-sm font-semibold text-ink-secondary">Channel</legend>
              <label className="flex items-center gap-2 text-body-lg">
                <input type="checkbox" className="size-5" checked={d.inApp} onChange={(e) => set("inApp", e.target.checked)} /> In-app notice
              </label>
              <label className="flex items-center gap-2 text-body-lg">
                <input type="checkbox" className="size-5" checked={d.email} onChange={(e) => set("email", e.target.checked)} /> Email
              </label>
            </fieldset>
            {needsApproval && <p className="rounded-lg bg-warning-bg px-3 py-2 text-body-sm text-warning">An email to everyone needs another admin to approve it before it goes.</p>}
            {error && !field ? <ErrorBox error={error} /> : null}
            {editable && (
              <Button onClick={() => void save()} loading={saving} className="self-start">
                {id ? "Save draft" : "Save and preview"}
              </Button>
            )}
          </fieldset>
        </Section>
        <div className="flex min-w-0 flex-col gap-5">
          {id && (
            <Section title="Preview">
              {preview.data ? (
                <div className="flex flex-col gap-3">
                  <p className="text-body-lg text-ink-strong">
                    Goes to <strong>{count(preview.data.recipients)}</strong> {preview.data.recipients === 1 ? "person" : "people"}.
                  </p>
                  {preview.data.inApp && (
                    <div className="rounded-lg border border-line-card bg-surface-pale p-3">
                      <p className="text-caption font-semibold uppercase text-ink-muted">In-app notice</p>
                      <p className="mt-1 font-semibold text-ink-strong">{preview.data.inApp.title}</p>
                      <p className="text-body-sm text-ink-secondary">{preview.data.inApp.message}</p>
                    </div>
                  )}
                  {preview.data.email && (
                    <div>
                      <p className="text-caption font-semibold uppercase text-ink-muted">Email · {preview.data.email.subject}</p>
                      <iframe title="Email preview" sandbox="" srcDoc={preview.data.email.html} className="mt-1 h-96 w-full rounded-lg border border-line-card bg-surface-card" />
                      <Button variant="secondary" size="md" className="mt-2" loading={test.isPending} onClick={() => test.mutate({ id }, { onSuccess: (r) => setDone(r.message || "Test email sent.") })}>
                        Send me a test email
                      </Button>
                      {test.error ? <ErrorBox error={test.error} /> : null}
                    </div>
                  )}
                </div>
              ) : preview.error ? (
                <ErrorBox error={preview.error} />
              ) : (
                <Loading />
              )}
            </Section>
          )}
          {a && <SendBox a={a} when={when} setWhen={setWhen} at={at} setAt={setAt} submit={submit} approve={approve} cancel={cancel} canApprove={Boolean(canApprove)} onDone={setDone} />}
        </div>
      </div>
    </AdminPage>
  );
}

interface Action {
  mutate: (vars: Record<string, unknown> & { id?: string }, opts?: { onSuccess?: (r: { message?: string }) => void }) => void;
  isPending: boolean;
  error: unknown;
}
function SendBox({ a, when, setWhen, at, setAt, submit, approve, cancel, canApprove, onDone }: { a: Announcement; when: "now" | "later"; setWhen: (v: "now" | "later") => void; at: string; setAt: (v: string) => void; submit: Action; approve: Action; cancel: Action; canApprove: boolean; onDone: (m: string) => void }) {
  const p = a.progress;
  return (
    <Section title="Send">
      <div className="flex flex-col gap-3">
        <Facts
          rows={[
            ["Audience", audienceLabel(a.audience)],
            ["Channel", channelLabel(a.channels)],
            a.scheduledAt && a.status !== "draft" ? ["Goes out", dateTime(a.scheduledAt)] : null,
            a.submittedBy?.email ? ["Sent for sending by", a.submittedBy.email] : null,
            a.approvedBy?.email ? ["Approved by", a.approvedBy.email] : null,
            a.cancelledBy?.email ? ["Cancelled by", a.cancelledBy.email] : null,
          ]}
        />
        {p && p.startedAt && (
          <p className="rounded-lg bg-surface-pale px-3 py-2 text-body-sm text-ink-strong">
            {a.channels.inApp ? `In-app: ${count(p.inAppSent)} of ${count(p.recipients)}. ` : ""}
            {a.channels.email ? `Email: ${count(p.emailed)} of ${count(p.recipients)}${p.emailFailed ? `, ${count(p.emailFailed)} failed` : ""}.` : ""}
            {p.pausedUntil ? ` Paused for today's email limit; continues ${dateTime(p.pausedUntil)}.` : ""}
          </p>
        )}
        {a.status === "draft" && (
          <>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-body-lg">
                <input type="radio" name="when" checked={when === "now"} onChange={() => setWhen("now")} className="size-5" /> As soon as possible
              </label>
              <label className="flex items-center gap-2 text-body-lg">
                <input type="radio" name="when" checked={when === "later"} onChange={() => setWhen("later")} className="size-5" /> At a set time (Lagos)
              </label>
              {when === "later" && <TextInput type="datetime-local" aria-label="Send at" value={at} onChange={(e) => setAt(e.target.value)} />}
            </div>
            {submit.error ? <ErrorBox error={submit.error} /> : null}
            <Button
              loading={submit.isPending}
              disabled={when === "later" && !at}
              onClick={() => submit.mutate({ id: a._id, ...(when === "later" && at ? { scheduledAt: new Date(`${at}:00+01:00`).toISOString() } : {}) }, { onSuccess: (r) => onDone(r.message || "Sent for sending.") })}
            >
              {a.needsApproval ? "Send for approval" : when === "later" ? "Schedule" : "Send"}
            </Button>
          </>
        )}
        {a.status === "pending_approval" &&
          (canApprove ? (
            <>
              {approve.error ? <ErrorBox error={approve.error} /> : null}
              <Button loading={approve.isPending} onClick={() => approve.mutate({ id: a._id }, { onSuccess: (r) => onDone(r.message || "Approved.") })}>
                Approve and send
              </Button>
            </>
          ) : (
            <NotAllowedNote>Waiting for another admin to approve. You wrote or sent this one.</NotAllowedNote>
          ))}
        {["draft", "pending_approval", "scheduled", "sending"].includes(a.status) && (
          <>
            {cancel.error ? <ErrorBox error={cancel.error} /> : null}
            <Button variant="secondary" className={cn(a.status === "draft" && "mt-1")} loading={cancel.isPending} onClick={() => cancel.mutate({ id: a._id }, { onSuccess: (r) => onDone(r.message || "Cancelled.") })}>
              {a.status === "sending" ? "Stop sending" : "Cancel"}
            </Button>
          </>
        )}
      </div>
    </Section>
  );
}
