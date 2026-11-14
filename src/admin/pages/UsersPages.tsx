import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { count } from "@/lib/format";
import { Button } from "@/components/ui";
import { AdminPage, Toolbar, SearchBox, FilterSelect, Metrics, Records, Guidance, Pager, Section, Facts, Pill, ReasonDialog, ErrorBox, Loading, dateOnly, dateTime, words, useDebounced, type Column } from "../components/AdminKit";
import { useAdminAction, useCan, useOverview, useUser, useUsers } from "../lib/hooks";
import type { AdminUserRow } from "../lib/types";

// 16.02 User accounts: find accounts, review status, suspend or reactivate
// (decision A8: a reason is required; the person is emailed, signed out, and
// their store and listings are hidden; every action is in the audit trail).

const STATUS: Array<[string, string]> = [
  ["", "All accounts"],
  ["active", "Active"],
  ["suspended", "Suspended"],
  ["unverified", "Email not verified"],
  ["closing", "Closing"],
];

export const accountState = (u: AdminUserRow) => (u.isSuspended ? "suspended" : u.closure?.status === "closing" ? "closing" : u.isVerified === false ? "pending" : "active");
const STATE_LABEL: Record<string, string> = { suspended: "Suspended", closing: "Closing", pending: "Unverified", active: "Active" };

export function UsersPage() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const status = params.get("status") || "";
  const page = Number(params.get("page") || 1);
  const query = useDebounced(q);
  const users = useUsers({ q: query, status, page, limit: 20 });
  const ov = useOverview({ range: "30d" });
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== "page") next.delete("page");
    setParams(next, { replace: true });
  };
  const columns: Column<AdminUserRow>[] = [
    { key: "account", label: "Account", cell: (u) => u.name || u.email },
    { key: "email", label: "Email", cell: (u) => <span className="[overflow-wrap:anywhere]">{u.email}</span> },
    { key: "joined", label: "Joined", cell: (u) => dateOnly(u.createdAt), desktopOnly: true },
    { key: "state", label: "State", cell: (u) => <Pill value={accountState(u)} label={STATE_LABEL[accountState(u)]} /> },
  ];
  return (
    <AdminPage title="User accounts" intro="Find accounts, review status and manage platform access.">
      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="Search users by name or email" />
        <FilterSelect label="Account status" value={status} onChange={(v) => set("status", v)} options={STATUS} />
      </Toolbar>
      {ov.data && (
        <Metrics
          items={[
            { tone: "orders", label: "Accounts", value: count(ov.data.users.total), caption: `${count(ov.data.users.verified)} with a verified email` },
            { tone: "stock", label: "Suspended users", value: count(ov.data.users.suspended), caption: "Administrative action" },
            { tone: "revenue", label: "New this month", value: count(ov.data.users.new), caption: "Last 30 days" },
          ]}
        />
      )}
      <Records
        title="Merchant directory & account access"
        subtitle={users.data ? `${count(users.data.total)} account${users.data.total === 1 ? "" : "s"}` : undefined}
        columns={columns}
        rows={users.data?.users}
        rowKey={(u) => u._id}
        rowLink={(u) => `/admin/users/${u._id}`}
        loading={users.isPending}
        error={users.error}
        onRetry={() => void users.refetch()}
        empty={query || status ? "No accounts match." : "No accounts yet."}
        footer={users.data && <Pager page={users.data.page} totalPages={users.data.totalPages} onPage={(p) => set("page", String(p))} />}
        side={<Guidance title="Account safety" rules={["Check identity and activity before a suspension or reactivation.", "A suspension needs a reason. The person sees it in their email.", "Every administrator action is kept in the audit trail."]} />}
      />
    </AdminPage>
  );
}

export function UserDetailPage() {
  const { id = "" } = useParams();
  const user = useUser(id);
  const can = useCan();
  const [dialog, setDialog] = useState<"suspend" | "activate" | null>(null);
  const suspend = useAdminAction<{ reason: string }>("PUT", (v) => `/admin/users/${v.id}/suspend`);
  const activate = useAdminAction<Record<string, unknown>>("PUT", (v) => `/admin/users/${v.id}/activate`);
  const [done, setDone] = useState<string | null>(null);

  if (user.error) return <ErrorBox error={user.error} onRetry={() => void user.refetch()} />;
  if (!user.data) return <Loading />;
  const d = user.data;
  const u = d.user;
  const state = accountState(u);
  return (
    <AdminPage
      title={u.name || u.email}
      actions={
        can("users.manage") && state !== "closing" ? (
          u.isSuspended ? (
            <Button size="md" onClick={() => (setDone(null), setDialog("activate"))}>
              Reactivate account
            </Button>
          ) : (
            <Button size="md" variant="destructive" onClick={() => (setDone(null), setDialog("suspend"))}>
              Suspend account
            </Button>
          )
        ) : undefined
      }
    >
      <p className="-mt-3">
        <Link to="/admin/users" className="text-body-sm font-semibold text-ink-brand">
          ← All users
        </Link>
      </p>
      {done && <p className="rounded-lg bg-success-bg px-4 py-3 text-body-lg text-success" role="status">{done}</p>}
      {d.suspension && (
        <section className="rounded-xl border border-danger bg-danger-bg p-4 text-body-lg text-danger">
          <p className="font-semibold">Suspended since {dateTime(d.suspension.since)}{d.suspension.by ? ` by ${d.suspension.by}` : ""}</p>
          <p className="mt-1">Reason: {d.suspension.reason}</p>
          <p className="mt-1 text-body-sm">
            {d.suspension.storeHidden ? "Their online store is offline. " : ""}
            {d.suspension.supplierPaused ? "Their BiSupplyNet listings are paused. " : ""}
            Reactivating brings back exactly what was on.
          </p>
        </section>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Account">
          <Facts
            rows={[
              ["Email", u.email],
              ["Phone", u.phone || "—"],
              ["State", <Pill key="s" value={state} label={STATE_LABEL[state]} />],
              ["Joined", dateOnly(u.createdAt)],
              ["Sign-in", u.googleLinked ? "Password and Google" : "Password"],
              ["Password changed", dateOnly(u.passwordChangedAt)],
            ]}
          />
        </Section>
        <Section title="Business">
          <Facts
            rows={[
              ["Business", d.businessProfile?.businessName || "Not set"],
              ["Plan", d.plan ? `${words(d.plan.access)}${d.plan.source && d.plan.source !== "plan" ? ` (${words(d.plan.source)})` : ""}` : "Freemium"],
              d.plan?.currentPeriodEnd ? ["Paid until", dateOnly(d.plan.currentPeriodEnd)] : null,
              d.plan?.trialEndDate ? ["Trial ends", dateOnly(d.plan.trialEndDate)] : null,
              ["Online store", d.store ? `${d.store.storeName} (${d.store.isPublished ? "published" : "draft"})` : "Not created"],
              d.store?.customDomain ? ["Custom domain", d.store.customDomain] : null,
              ["Orders · products", `${count(d.stats.totalOrders)} · ${count(d.stats.totalProducts)}`],
              d.memberOf ? ["Team member of", <Link key="m" to={`/admin${d.memberOf.link}`} className="font-semibold text-ink-brand">another business ({d.memberOf.role})</Link>] : null,
            ]}
          />
        </Section>
      </div>
      {d.wholesalerProfile && (
        <Section title="BiSupplyNet supplier" actions={can("suppliers.review") ? <Link to={`/admin/suppliers/${d.wholesalerProfile._id}`} className="text-body-sm font-semibold text-ink-brand">Open application →</Link> : undefined}>
          <Facts rows={[["Supplier", d.wholesalerProfile.businessName], ["Verification", <Pill key="v" value={d.wholesalerProfile.verificationStatus} />], ["Payout account", d.wholesalerProfile.accountNumber ? `${d.wholesalerProfile.bankName || "Bank"} ${d.wholesalerProfile.accountNumber}` : "Not set"]]} />
        </Section>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title={`Team (${d.team.length})`}>
          {d.team.length ? (
            <ul className="flex flex-col gap-2">
              {d.team.map((t) => (
                <li key={t._id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-surface-pale px-3 py-2 text-body-lg">
                  <Link to={`/admin/users/${t._id}`} className="font-semibold text-ink-brand">{t.name}</Link>
                  <span className="text-ink-secondary">{words(t.role)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body-lg text-ink-secondary">No teammates.</p>
          )}
        </Section>
        <Section title="Recent support tickets">
          {d.tickets.length ? (
            <ul className="flex flex-col gap-2">
              {d.tickets.map((t) => (
                <li key={t._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-pale px-3 py-2 text-body-lg">
                  {can("support.manage") ? <Link to={`/admin${t.link}`} className="font-semibold text-ink-brand">{t.ticketNumber}</Link> : <span>{t.ticketNumber}</span>}
                  <span className="min-w-0 flex-1 truncate text-ink-secondary">{t.subject}</span>
                  <Pill value={t.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body-lg text-ink-secondary">No tickets.</p>
          )}
        </Section>
      </div>
      <Section title="Admin history">
        {d.history.length ? (
          <ol className="flex flex-col gap-2">
            {d.history.map((h, i) => (
              <li key={i} className="rounded-lg bg-surface-pale px-3 py-2 text-body-lg">
                <p className="font-semibold text-ink-strong">{words(h.action.replace(/\./g, " "))}</p>
                <p className="text-body-sm text-ink-secondary">{dateTime(h.at)} · {h.by}{h.role ? ` (${words(h.role)})` : ""}</p>
                {h.reason && <p className="mt-1 text-body-sm text-ink-strong">Reason: {h.reason}</p>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-body-lg text-ink-secondary">No admin actions on this account.</p>
        )}
      </Section>

      <ReasonDialog
        open={dialog === "suspend"}
        onClose={() => setDialog(null)}
        tone="danger"
        title={`Suspend ${u.name || u.email}?`}
        description="They and their team are signed out straight away and can't sign in. Their online store goes offline and their BiSupplyNet listings are paused. They get an email with your reason."
        label="Reason (they'll see this)"
        confirm="Suspend account"
        pending={suspend.isPending}
        error={suspend.error}
        onConfirm={(reason) =>
          suspend.mutate(
            { id, reason },
            {
              onSuccess: (r) => {
                setDialog(null);
                setDone(r.message || "Account suspended.");
              },
            }
          )
        }
      />
      <ReasonDialog
        open={dialog === "activate"}
        onClose={() => setDialog(null)}
        title={`Reactivate ${u.name || u.email}?`}
        description="They and their team can sign in again, and their store and listings come back as they were. They get an email."
        label=""
        minLength={0}
        confirm="Reactivate"
        pending={activate.isPending}
        error={activate.error}
        onConfirm={() =>
          activate.mutate(
            { id },
            {
              onSuccess: (r) => {
                setDialog(null);
                setDone(r.message || "Account active again.");
              },
            }
          )
        }
      />
    </AdminPage>
  );
}
