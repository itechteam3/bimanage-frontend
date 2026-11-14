import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { count } from "@/lib/format";
import { Button, Dialog, Field, PasswordInput, SelectInput, TextArea, TextInput } from "@/components/ui";
import { AdminPage, Toolbar, SearchBox, FilterSelect, Metrics, Records, Guidance, Pager, Section, Pill, ErrorBox, dateOnly, dateTime, words, useDebounced, type Column } from "../components/AdminKit";
import { adminApi, adminError, fieldOf } from "../lib/api";
import { adminSession } from "../lib/session";
import { useAdminAction, useAdminMe, useAdmins, useAudit, useStoreDomains, type DomainRow } from "../lib/hooks";
import type { AdminAccount, AdminRole, AuditEntry } from "../lib/types";

// 16.08 Admin permissions, the audit trail (superadmin), store domains, and
// the admin's own account.

export const ROLE_INFO: Array<{ role: AdminRole; label: string; privilege: string; risk: "critical" | "high" | "medium" }> = [
  { role: "superadmin", label: "Superadmin", privilege: "Everything, including admin accounts and the audit trail", risk: "critical" },
  { role: "admin", label: "Administrator", privilege: "Users, suppliers, support, announcements, domains", risk: "high" },
  { role: "finance", label: "Finance", privilege: "Dispute decisions, refunds, test money, payments", risk: "high" },
  { role: "support", label: "Support agent", privilege: "Tickets, service requests, FAQs, reviews, FELI knowledge", risk: "medium" },
  { role: "reviewer", label: "Reviewer", privilege: "Supplier verification evidence", risk: "medium" },
];
const RISK: Record<string, string> = { critical: "urgent", high: "high", medium: "medium" };

export function RolesPage() {
  const admins = useAdmins();
  const me = useAdminMe().data;
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AdminAccount | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const list = (admins.data || []).filter((a) => (!role || a.role === role) && (!q || `${a.name} ${a.email}`.toLowerCase().includes(q.toLowerCase())));
  const cols: Column<AdminAccount>[] = [
    { key: "name", label: "Administrator", cell: (a) => `${a.name}${a._id === me?._id ? " (you)" : ""}` },
    { key: "role", label: "Role", cell: (a) => a.roleLabel },
    { key: "state", label: "Access", cell: (a) => (!a.isActive ? <Pill value="suspended" label="Deactivated" /> : a.twoFactorEnabled ? <Pill value="active" label="Two-step on" /> : <Pill value="pending" label="Set-up pending" />) },
    { key: "last", label: "Last sign-in", cell: (a) => dateTime(a.lastLogin), desktopOnly: true },
    { key: "act", label: "", cell: (a) => <Button size="md" variant="secondary" onClick={() => (setDone(null), setEditing(a))}>Manage</Button> },
  ];
  const roleCols: Column<(typeof ROLE_INFO)[number]>[] = [
    { key: "role", label: "Role", cell: (r) => r.label },
    { key: "priv", label: "Privilege", cell: (r) => r.privilege },
    { key: "risk", label: "Risk", cell: (r) => <Pill value={RISK[r.risk]} label={words(r.risk)} /> },
    { key: "n", label: "People", cell: (r) => count((admins.data || []).filter((a) => a.role === r.role && a.isActive).length) },
  ];
  return (
    <AdminPage title="Admin permissions" intro="Control elevated access and protect sensitive actions." actions={<Button size="md" onClick={() => (setDone(null), setAdding(true))}>Add an admin</Button>}>
      {done && <p className="rounded-lg bg-success-bg px-4 py-3 text-body-lg text-success" role="status">{done}</p>}
      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="Search administrator" />
        <FilterSelect label="Role" value={role} onChange={setRole} options={[["", "All roles"], ...ROLE_INFO.map((r) => [r.role, r.label] as [string, string])]} />
      </Toolbar>
      <Metrics
        items={[
          { tone: "orders", label: "Admin accounts", value: admins.data ? count(admins.data.filter((a) => a.isActive).length) : "—", caption: "Active" },
          { tone: "stock", label: "Superadmin role", value: admins.data ? count(admins.data.filter((a) => a.role === "superadmin" && a.isActive).length) : "—", caption: "Restricted: at least one always" },
          { tone: "invoices", label: "Two-step pending", value: admins.data ? count(admins.data.filter((a) => a.isActive && !a.twoFactorEnabled).length) : "—", caption: "Set up at their first sign-in" },
        ]}
      />
      <Records title="Administrators" columns={cols} rows={admins.data ? list : undefined} rowKey={(a) => a._id} loading={admins.isPending} error={admins.error} onRetry={() => void admins.refetch()} empty="No admins match." side={<Guidance title="Access rules" rules={["Two-step sign-in is required for every admin.", "Money actions are Finance or superadmin only.", "You can't change your own role. There's always at least one superadmin."]} />} />
      <Records title="Roles and what they can do" columns={roleCols} rows={ROLE_INFO} rowKey={(r) => r.role} empty="" />
      <AddAdminDialog open={adding} onClose={() => setAdding(false)} onDone={(m) => (setAdding(false), setDone(m))} />
      {editing && <EditAdminDialog admin={editing} self={editing._id === me?._id} onClose={() => setEditing(null)} onDone={(m) => (setEditing(null), setDone(m))} />}
    </AdminPage>
  );
}

function AddAdminDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (m: string) => void }) {
  const [f, setF] = useState({ name: "", email: "", role: "support" as AdminRole, password: "" });
  const add = useAdminAction<typeof f, { message?: string }>("POST", () => "/admin/admins");
  const field = fieldOf(add.error);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add an admin"
      description="They sign in with this temporary password, set up two-step sign-in and get their own recovery codes. Share the password privately."
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={add.isPending} disabled={!f.name || !f.email || f.password.length < 12} onClick={() => add.mutate(f, { onSuccess: (r) => (setF({ name: "", email: "", role: "support", password: "" }), onDone(r.message || "Admin added.")) })}>
            Add admin
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Name" required error={field === "name" ? adminError(add.error) : undefined}>
          <TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Email" required error={field === "email" ? adminError(add.error) : undefined}>
          <TextInput type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <Field label="Role" required>
          <SelectInput value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as AdminRole })}>
            {ROLE_INFO.map((r) => <option key={r.role} value={r.role}>{r.label}: {r.privilege}</option>)}
          </SelectInput>
        </Field>
        <Field label="Temporary password" required hint="At least 12 characters, with letters and numbers." error={field === "password" ? adminError(add.error) : undefined}>
          <PasswordInput autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </Field>
        {add.error && !field ? <ErrorBox error={add.error} /> : null}
      </div>
    </Dialog>
  );
}

function EditAdminDialog({ admin, self, onClose, onDone }: { admin: AdminAccount; self: boolean; onClose: () => void; onDone: (m: string) => void }) {
  const [role, setRole] = useState<AdminRole>(admin.role);
  const [reason, setReason] = useState("");
  const update = useAdminAction<{ role?: AdminRole; isActive?: boolean; resetTwoFactor?: boolean; reason?: string }, { admin?: AdminAccount }>("PUT", (v) => `/admin/admins/${v.id}`);
  const run = (body: { role?: AdminRole; isActive?: boolean; resetTwoFactor?: boolean }, msg: string) => update.mutate({ id: admin._id, ...body, reason: reason.trim() || undefined }, { onSuccess: () => onDone(msg) });
  return (
    <Dialog open onClose={onClose} title={`Manage ${admin.name}`} description={`${admin.email} · ${admin.roleLabel}`} actions={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <div className="flex flex-col gap-4">
        {self ? (
          <p className="rounded-lg bg-surface-pale px-3 py-2 text-body-sm text-ink-secondary">You can't change your own role or deactivate yourself. Ask another superadmin.</p>
        ) : (
          <>
            <Field label="Role">
              <SelectInput value={role} onChange={(e) => setRole(e.target.value as AdminRole)}>
                {ROLE_INFO.map((r) => <option key={r.role} value={r.role}>{r.label}</option>)}
              </SelectInput>
            </Field>
            <Button variant="outlined" disabled={role === admin.role} loading={update.isPending} onClick={() => run({ role }, `${admin.name} is now ${ROLE_INFO.find((r) => r.role === role)?.label}. Their sessions ended.`)}>
              Change role
            </Button>
          </>
        )}
        <Field label="Reason (kept in the audit trail)">
          <TextArea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </Field>
        <div className="grid gap-2 md:grid-cols-2">
          <Button variant="secondary" loading={update.isPending} disabled={!admin.twoFactorEnabled} onClick={() => run({ resetTwoFactor: true }, `Two-step sign-in reset for ${admin.name}. They set it up again at their next sign-in.`)}>
            Reset two-step sign-in
          </Button>
          {!self && (
            <Button variant={admin.isActive ? "destructive" : "primary"} loading={update.isPending} onClick={() => run({ isActive: !admin.isActive }, admin.isActive ? `${admin.name} can no longer sign in.` : `${admin.name} can sign in again.`)}>
              {admin.isActive ? "Deactivate" : "Reactivate"}
            </Button>
          )}
        </div>
        <p className="text-body-sm text-ink-muted">Use "Reset two-step sign-in" when someone loses their authenticator and has no recovery codes left.</p>
        {update.error ? <ErrorBox error={update.error} /> : null}
      </div>
    </Dialog>
  );
}

// ── Audit trail (superadmin) ───────────────────────────────────────────────

export function AuditPage() {
  const [params, setParams] = useSearchParams();
  const [action, setAction] = useState(params.get("action") || "");
  const [admin, setAdmin] = useState("");
  const via = params.get("via") || "";
  const page = Number(params.get("page") || 1);
  const a = useDebounced(action);
  const who = useDebounced(admin);
  const audit = useAudit({ action: a, admin: who, via, page, limit: 50 });
  const [manual, setManual] = useState(false);
  const cols: Column<AuditEntry>[] = [
    { key: "when", label: "When", cell: (e) => dateTime(e.at) },
    { key: "action", label: "Action", cell: (e) => <span className="font-mono text-body-sm">{e.action}</span> },
    { key: "by", label: "By", cell: (e) => <span className="[overflow-wrap:anywhere]">{e.by || "—"}{e.role ? ` (${words(e.role)})` : ""}</span> },
    { key: "what", label: "Details", cell: (e) => <span>{[e.targetType && `${words(e.targetType)} ${e.targetId || ""}`.trim(), e.summary, e.reason && `Reason: ${e.reason}`].filter(Boolean).join(" · ") || "—"}{e.via !== "admin" && <span className="ml-2"><Pill value="pending" label={e.via === "manual" ? "Recorded by hand" : "Server command"} /></span>}</span> },
  ];
  return (
    <AdminPage title="Audit trail" intro="Every change an admin makes. Entries can't be edited or removed." actions={<Button size="md" variant="secondary" onClick={() => setManual(true)}>Record a manual action</Button>}>
      <Toolbar>
        <SearchBox value={action} onChange={setAction} placeholder="Action starts with… (user., dispute., admin.)" label="Action" />
        <label className="min-w-0 lg:w-72">
          <span className="sr-only">Admin email</span>
          <input value={admin} onChange={(e) => setAdmin(e.target.value)} placeholder="Admin email" className="h-control-md w-full rounded-lg border border-line-default bg-surface-card px-3 text-body-lg focus:outline-none focus:shadow-focus" />
        </label>
        <FilterSelect label="Source" value={via} onChange={(v) => setParams(v ? { via: v } : {}, { replace: true })} options={[["", "All sources"], ["admin", "Admin area"], ["manual", "Recorded by hand"], ["command", "Server command"]]} />
      </Toolbar>
      <Records title="Entries" subtitle={audit.data ? `${count(audit.data.total)} entr${audit.data.total === 1 ? "y" : "ies"}, newest first` : undefined} columns={cols} rows={audit.data?.entries} rowKey={(e) => e.id} loading={audit.isPending} error={audit.error} onRetry={() => void audit.refetch()} empty="No entries match." footer={audit.data && <Pager page={audit.data.page} totalPages={audit.data.totalPages} onPage={(p) => setParams({ ...(via ? { via } : {}), page: String(p) }, { replace: true })} />} />
      <ManualEntryDialog open={manual} onClose={() => setManual(false)} />
    </AdminPage>
  );
}

function ManualEntryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [f, setF] = useState({ action: "", summary: "", reason: "", occurredAt: "", targetType: "", targetId: "" });
  const add = useAdminAction<typeof f, { message?: string }>("POST", () => "/admin/audit/manual");
  const field = fieldOf(add.error);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Record a manual action"
      description="For something done outside the admin area, for example directly in the database. It can't be edited or removed afterwards."
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={add.isPending} disabled={!f.action || f.summary.trim().length < 10} onClick={() => add.mutate(f, { onSuccess: () => (setF({ action: "", summary: "", reason: "", occurredAt: "", targetType: "", targetId: "" }), onClose()) })}>
            Record it
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Action" required hint="A short name like admin.delete or user.update." error={field === "action" ? adminError(add.error) : undefined}>
          <TextInput value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} />
        </Field>
        <Field label="What was done" required error={field === "summary" ? adminError(add.error) : undefined}>
          <TextArea rows={3} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} maxLength={1000} />
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="About (type)">
            <TextInput value={f.targetType} onChange={(e) => setF({ ...f, targetType: e.target.value })} placeholder="admin, user…" />
          </Field>
          <Field label="About (id or email)">
            <TextInput value={f.targetId} onChange={(e) => setF({ ...f, targetId: e.target.value })} />
          </Field>
        </div>
        <Field label="When it happened" error={field === "occurredAt" ? adminError(add.error) : undefined}>
          <TextInput type="date" value={f.occurredAt} onChange={(e) => setF({ ...f, occurredAt: e.target.value })} />
        </Field>
        <Field label="Why (optional)">
          <TextInput value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
        </Field>
        {add.error && !field ? <ErrorBox error={add.error} /> : null}
      </div>
    </Dialog>
  );
}

// ── Store domains ──────────────────────────────────────────────────────────

export function StoreDomainsPage() {
  const [status, setStatus] = useState("pending");
  const q = useStoreDomains(status);
  const mark = useAdminAction<{ added: boolean }>("PUT", (v) => `/admin/store-domains/${v.id}/hosting`);
  const cols: Column<DomainRow>[] = [
    { key: "domain", label: "Domain", cell: (d) => <span className="[overflow-wrap:anywhere] font-semibold">{d.domain}</span> },
    { key: "store", label: "Store", cell: (d) => d.storeName },
    { key: "dns", label: "DNS", cell: (d) => <Pill value={d.dnsVerified ? "verified" : "pending"} label={d.dnsVerified ? "Verified" : "Not yet"} /> },
    { key: "hosting", label: "Hosting", cell: (d) => <Pill value={d.hosting} label={d.hosting === "added" ? `Added ${dateOnly(d.hostingAddedAt)}` : "To add"} /> },
    { key: "act", label: "", cell: (d) => <Button size="md" variant={d.hosting === "added" ? "secondary" : "primary"} loading={mark.isPending && mark.variables?.id === d.storeId} onClick={() => mark.mutate({ id: d.storeId, added: d.hosting !== "added" })}>{d.hosting === "added" ? "Undo" : "Mark added"}</Button> },
  ];
  return (
    <AdminPage title="Custom store domains" intro={q.data ? `Add each domain to the ${q.data.vercelProject} project in Vercel, then mark it added. The business is told.` : "Add each domain to the hosting project, then mark it added."}>
      <Toolbar>
        <FilterSelect label="Show" value={status} onChange={setStatus} options={[["pending", "To add"], ["added", "Added"], ["all", "All"]]} />
      </Toolbar>
      {mark.error ? <ErrorBox error={mark.error} /> : null}
      <Records title="Domains" columns={cols} rows={q.data?.domains} rowKey={(d) => d.storeId} loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} empty={status === "pending" ? "No domains waiting." : "No domains."} />
    </AdminPage>
  );
}

// ── My account ─────────────────────────────────────────────────────────────

export function AdminAccountPage() {
  const me = useAdminMe().data;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const change = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await adminApi<{ token: string }>("/admin/me/password", { method: "PUT", body: { currentPassword: current, newPassword: next } });
      adminSession.set(r.token);
      setCurrent("");
      setNext("");
      setDone(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  const field = fieldOf(error);
  return (
    <AdminPage title="My admin account">
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Profile">
          <dl className="flex flex-col gap-2 text-body-lg">
            <div><dt className="text-caption font-semibold uppercase text-ink-muted">Name</dt><dd>{me?.name}</dd></div>
            <div><dt className="text-caption font-semibold uppercase text-ink-muted">Email</dt><dd>{me?.email}</dd></div>
            <div><dt className="text-caption font-semibold uppercase text-ink-muted">Role</dt><dd>{me?.roleLabel}</dd></div>
            <div><dt className="text-caption font-semibold uppercase text-ink-muted">Two-step sign-in</dt><dd>{me?.twoFactorEnabled ? "On" : "Off"}</dd></div>
          </dl>
          <p className="mt-3 text-body-sm text-ink-muted">Lost your authenticator? Use a recovery code at sign-in, or ask another superadmin to reset your two-step sign-in.</p>
        </Section>
        <Section title="Change password">
          <div className="flex flex-col gap-3">
            {done && <p className="rounded-lg bg-success-bg px-3 py-2 text-body-sm text-success" role="status">Password changed. Your other admin sessions ended.</p>}
            <Field label="Current password" error={field === "currentPassword" ? adminError(error) : undefined}>
              <PasswordInput autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </Field>
            <Field label="New password" hint="At least 12 characters, with letters and numbers." error={field === "newPassword" ? adminError(error) : undefined}>
              <PasswordInput autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            </Field>
            {error && !field ? <ErrorBox error={error} /> : null}
            <Button onClick={() => void change()} loading={busy} disabled={!current || next.length < 12} className="self-start">
              Change password
            </Button>
          </div>
        </Section>
      </div>
    </AdminPage>
  );
}
