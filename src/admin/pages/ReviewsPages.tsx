import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconArrowLeft, IconStarFilled, IconInfoCircle } from "@tabler/icons-react";
import { Button, Dialog, Field, TextArea } from "@/components/ui";
import { adminApi } from "../lib/api";
import { useAdminMe } from "../lib/hooks";
import type { Paged } from "../lib/types";
import { AdminPage, ErrorBox, Facts, FilterSelect, Loading, Metrics, Pager, Pill, Records, SearchBox, Section, Toolbar, dateOnly, dateTime, useDebounced, words, type Column } from "../components/AdminKit";

// Platform review moderation (/admin/reviews). New and edited reviews wait as
// "pending"; only approved ones are public. Every action needs a reason from
// a fixed list ("Other" needs a note) and is recorded for admins only. The
// author is never told. Deleted reviews are kept 30 days; only a superadmin
// can restore one.

export type ReviewStatus = "pending" | "approved" | "rejected" | "deleted";
export type ReviewAction = "approve" | "reject" | "unpublish" | "delete" | "restore";
interface ModerationEntry {
  action: string;
  from: string | null;
  to: string | null;
  reason: string;
  reasonLabel: string;
  note: string | null;
  by: { name: string; email: string } | null;
  at: string;
}
export interface AdminReview {
  _id: string;
  headline: string;
  review: string;
  rating: number;
  category: string;
  featuresUsed: string[];
  businessName: string;
  isVerified: boolean;
  status: ReviewStatus;
  reviewer: { _id: string | null; name: string; email: string };
  createdAt: string;
  updatedAt: string;
  edited: boolean;
  moderatedAt: string | null;
  deletedAt: string | null;
  restoreUntil: string | null;
  lastAction: ModerationEntry | null;
  history?: ModerationEntry[];
}
type Reasons = Record<ReviewAction, Array<{ value: string; label: string }>>;

const POLICY = "Don't reject reviews just because they're negative. Moderate for spam, abuse, personal data, off-topic or fake content.";
const ACTION_LABEL: Record<ReviewAction, string> = { approve: "Approve", reject: "Reject", unpublish: "Un-publish", delete: "Delete", restore: "Restore" };
const ACTION_HELP: Record<ReviewAction, string> = {
  approve: "It appears on the public reviews page and counts in the ratings.",
  reject: "It stays off the public page. The author isn't told and still sees what they wrote.",
  unpublish: "It leaves the public page and goes back to the pending queue.",
  delete: "It leaves every list except Deleted. A superadmin can restore it for 30 days, then it's removed for good.",
  restore: "It goes back to the status it had before it was deleted.",
};
const NEXT: Record<ReviewStatus, ReviewAction[]> = { pending: ["approve", "reject", "delete"], approved: ["unpublish", "reject", "delete"], rejected: ["approve", "delete"], deleted: ["restore"] };
const ALL_STATUSES: Array<[ReviewStatus | "", string]> = [["", "All statuses"], ["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"], ["deleted", "Deleted"]];
const RATINGS: Array<[string, string]> = [["", "Any rating"], ["5", "5 stars"], ["4", "4 stars"], ["3", "3 stars"], ["2", "2 stars"], ["1", "1 star"]];

// ── Data ─────────────────────────────────────────────────────────────────
type Query = Record<string, string | number | undefined>;
const useReviews = (q: Query) =>
  useQuery({ queryKey: ["admin", "reviews", q], queryFn: () => adminApi<Paged & { reviews: AdminReview[]; counts: Record<ReviewStatus, number>; reasons: Reasons }>("/admin/reviews", { query: q }), placeholderData: keepPreviousData });
const useReview = (id: string) => useQuery({ queryKey: ["admin", "review", id], queryFn: () => adminApi<{ review: AdminReview; reasons: Reasons }>(`/admin/reviews/${id}`) });
function useModerate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, reason, note }: { action: ReviewAction; reason: string; note: string }) => adminApi<{ message: string; review: AdminReview }>(`/admin/reviews/${id}/${action}`, { method: "POST", body: { reason, ...(note ? { note } : {}) } }),
    onSuccess: (data) => {
      qc.setQueryData(["admin", "review", id], (old: { review: AdminReview; reasons: Reasons } | undefined) => (old ? { ...old, review: data.review } : old));
      void qc.invalidateQueries({ queryKey: ["admin", "reviews"] });
      void qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
    },
  });
}

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-ink-strong" aria-label={`${n} out of 5 stars`}>
      <IconStarFilled aria-hidden="true" className="size-4 text-warning" /> {n}/5
    </span>
  );
}

function PolicyNote() {
  return (
    <p className="flex items-start gap-2">
      <IconInfoCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ink-brand" />
      <span>{POLICY}</span>
    </p>
  );
}

// ── List ─────────────────────────────────────────────────────────────────
export function ReviewsPage() {
  const [params, setParams] = useSearchParams();
  const status = (params.get("status") ?? "") as ReviewStatus | "";
  const [search, setSearch] = useState("");
  const [rating, setRating] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());
  useEffect(() => setPage(1), [status, rating, from, to, q]);
  const list = useReviews({ status: status || undefined, rating: rating || undefined, from: from || undefined, to: to || undefined, q: q || undefined, page, limit: 20 });
  const counts = list.data?.counts;
  const setStatus = (v: ReviewStatus | "") => setParams((p) => (v ? (p.set("status", v), p) : (p.delete("status"), p)), { replace: true });
  const columns: Column<AdminReview>[] = [
    { key: "review", label: "Review", className: "lg:min-w-56", cell: (r) => <span className="block max-w-md [overflow-wrap:anywhere]">{r.headline || r.review.slice(0, 80) || "(no headline)"}</span> },
    { key: "rating", label: "Rating", cell: (r) => <Stars n={r.rating} /> },
    { key: "reviewer", label: "Reviewer", className: "lg:min-w-48 lg:max-w-64", cell: (r) => (
      <span className="block min-w-0 [overflow-wrap:anywhere]">
        <span className="block font-medium text-ink-strong">{r.reviewer.name || "—"}</span>
        {r.reviewer.email && <span className="block text-body-sm text-ink-muted">{r.reviewer.email}</span>}
        {r.businessName && <span className="block text-body-sm text-ink-muted">{r.businessName}</span>}
      </span>
    ) },
    { key: "status", label: "Status", cell: (r) => <Pill value={r.status} /> },
    { key: "date", label: "Submitted", cell: (r) => <span className="whitespace-nowrap">{dateOnly(r.createdAt)}{r.edited ? " (edited)" : ""}</span> },
  ];
  return (
    <AdminPage title="Reviews" eyebrow="Moderation policy" intro={<PolicyNote />}>
      <Metrics
        items={[
          { tone: "stock", label: "Pending", value: counts?.pending ?? "—", caption: "Waiting for a decision" },
          { tone: "orders", label: "Approved", value: counts?.approved ?? "—", caption: "Shown publicly" },
          { tone: "invoices", label: "Rejected or deleted", value: counts ? counts.rejected + counts.deleted : "—", caption: "Not public; kept for admins" },
        ]}
      />
      <Toolbar>
        <SearchBox value={search} onChange={setSearch} placeholder="Search text, reviewer or business" />
        <FilterSelect<ReviewStatus | ""> label="Status" value={status} onChange={setStatus} options={ALL_STATUSES} />
        <FilterSelect label="Rating" value={rating} onChange={setRating} options={RATINGS} />
        <label className="flex min-w-0 flex-col lg:w-44">
          <span className="sr-only">Submitted from</span>
          <input type="date" aria-label="Submitted from" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="h-control-md w-full min-w-0 rounded-lg border border-line-default bg-surface-card px-3 text-body-lg text-ink-strong focus:outline-none focus:shadow-focus" />
        </label>
        <label className="flex min-w-0 flex-col lg:w-44">
          <span className="sr-only">Submitted to</span>
          <input type="date" aria-label="Submitted to" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="h-control-md w-full min-w-0 rounded-lg border border-line-default bg-surface-card px-3 text-body-lg text-ink-strong focus:outline-none focus:shadow-focus" />
        </label>
      </Toolbar>
      <Records
        title={status ? `${words(status)} reviews` : "All reviews"}
        subtitle={list.data ? `${list.data.total} review${list.data.total === 1 ? "" : "s"}` : undefined}
        columns={columns}
        rows={list.data?.reviews}
        rowKey={(r) => r._id}
        rowLink={(r) => `/admin/reviews/${r._id}`}
        empty={status === "pending" ? "No reviews waiting. Nice work." : "No reviews match these filters."}
        loading={list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        footer={list.data ? <Pager page={page} totalPages={list.data.totalPages} onPage={setPage} /> : null}
      />
    </AdminPage>
  );
}

// ── Detail and actions ───────────────────────────────────────────────────
export function ReviewDetailPage() {
  const { id = "" } = useParams();
  const one = useReview(id);
  const me = useAdminMe().data;
  const [action, setAction] = useState<ReviewAction | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const r = one.data?.review;
  const now = Date.now();
  const actions = r ? NEXT[r.status].filter((a) => a !== "restore" || (me?.role === "superadmin" && r.restoreUntil && new Date(r.restoreUntil).getTime() > now)) : [];
  return (
    <AdminPage
      title="Review"
      eyebrow="Moderation policy"
      intro={<PolicyNote />}
      actions={
        <Link to="/admin/reviews" className="inline-flex h-control-md items-center gap-2 rounded-lg px-3 text-body-lg font-semibold text-ink-brand hover:bg-surface-pale">
          <IconArrowLeft aria-hidden="true" className="size-4" /> All reviews
        </Link>
      }
    >
      {one.error ? (
        <ErrorBox error={one.error} onRetry={() => void one.refetch()} />
      ) : !r ? (
        <Loading label="Loading the review" />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 desktop:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-5">
            <Section title="What they wrote" actions={<Pill value={r.status} />}>
              <div className="flex flex-col gap-2">
                <Stars n={r.rating} />
                {r.headline && <p className="[overflow-wrap:anywhere] text-title-sm text-ink-strong">{r.headline}</p>}
                <p className="whitespace-pre-line [overflow-wrap:anywhere] text-body-lg text-ink-strong">{r.review || "(no text)"}</p>
                {r.featuresUsed.length > 0 && <p className="text-body-sm text-ink-muted">Uses: {r.featuresUsed.map(words).join(", ")}</p>}
              </div>
            </Section>
            <Section title="Reviewer">
              <Facts
                rows={[
                  ["Name", r.reviewer.name || "—"],
                  ["Email", r.reviewer.email || "—"],
                  ["Business", r.businessName || "—"],
                  ["Review type", words(r.category)],
                  ["Submitted", dateTime(r.createdAt)],
                  ["Last edited", r.edited ? dateTime(r.updatedAt) : "Not edited"],
                  r.reviewer._id ? ["Account", <Link key="u" to={`/admin/users/${r.reviewer._id}`} className="font-semibold text-ink-brand hover:underline">Open the account</Link>] : null,
                ]}
              />
            </Section>
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            <Section title="Moderate">
              <div className="flex flex-col gap-3">
                {r.status === "deleted" && r.restoreUntil && (
                  <p className="rounded-lg bg-surface-pale px-3 py-2 text-body-sm text-ink-secondary">
                    Deleted {dateOnly(r.deletedAt)}. {new Date(r.restoreUntil).getTime() > now ? `A superadmin can restore it until ${dateOnly(r.restoreUntil)}.` : "It can no longer be restored."}
                  </p>
                )}
                {actions.length === 0 ? (
                  <p className="text-body-sm text-ink-secondary">{r.status === "deleted" ? "Only a superadmin can restore a deleted review." : "No actions available."}</p>
                ) : (
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
                    {actions.map((a) => (
                      <Button key={a} variant={a === "approve" || a === "restore" ? "primary" : a === "delete" ? "destructive" : "secondary"} onClick={() => (setDone(null), setAction(a))}>
                        {ACTION_LABEL[a]}
                      </Button>
                    ))}
                  </div>
                )}
                {done && (
                  <p role="status" className="text-body-sm text-success">
                    {done}
                  </p>
                )}
                <p className="text-caption text-ink-muted">The author isn't told about moderation. Reasons and notes are visible to admins only.</p>
              </div>
            </Section>
            <Section title="Moderation history">
              {(r.history ?? []).length === 0 ? (
                <p className="text-body-sm text-ink-secondary">No moderation yet.</p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {[...(r.history ?? [])].reverse().map((h, i) => (
                    <li key={`${h.at}-${i}`} className="rounded-lg border border-line-card bg-surface-pale p-3 text-body-sm">
                      <p className="font-semibold text-ink-strong">
                        {words(h.action)}: {words(h.from || "new")} → {words(h.to || "")}
                      </p>
                      <p className="text-ink-secondary">
                        {h.reasonLabel}
                        {h.note ? `: ${h.note}` : ""}
                      </p>
                      <p className="mt-1 [overflow-wrap:anywhere] text-caption text-ink-muted">
                        {h.by ? h.by.name || h.by.email : "System"} · {dateTime(h.at)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </Section>
          </div>
        </div>
      )}
      {r && action && one.data && <ModerateDialog id={id} action={action} reasons={one.data.reasons[action] ?? []} onClose={() => setAction(null)} onDone={(m) => (setAction(null), setDone(m))} />}
    </AdminPage>
  );
}

function ModerateDialog({ id, action, reasons, onClose, onDone }: { id: string; action: ReviewAction; reasons: Array<{ value: string; label: string }>; onClose: () => void; onDone: (message: string) => void }) {
  const moderate = useModerate(id);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const needsNote = reason === "other" && note.trim().length < 3;
  const danger = action === "delete" || action === "reject";
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${ACTION_LABEL[action]} this review?`}
      description={ACTION_HELP[action]}
      tone={danger ? "danger" : "default"}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={moderate.isPending}>
            Cancel
          </Button>
          <Button
            variant={danger ? "destructive" : "primary"}
            disabled={!reason || needsNote}
            loading={moderate.isPending}
            loadingText="Saving…"
            onClick={() => moderate.mutate({ action, reason, note: note.trim() }, { onSuccess: (d) => onDone(d.message) })}
          >
            {ACTION_LABEL[action]}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Reason" required>
          <select aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} className="h-control-md w-full rounded-lg border border-line-default bg-surface-card px-3 text-body-lg text-ink-strong focus:outline-none focus:shadow-focus">
            <option value="">Choose a reason</option>
            {reasons.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={reason === "other" ? "Note (required for Other)" : "Note (optional)"} hint={needsNote ? "Explain the reason in a few words." : "Admins only. The author never sees it."}>
          <TextArea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} />
        </Field>
        {moderate.error ? <ErrorBox error={moderate.error} /> : null}
      </div>
    </Dialog>
  );
}
