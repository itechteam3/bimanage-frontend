import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconLock, IconMailForward, IconSearch, IconTrash, IconUserPlus } from "@tabler/icons-react";
import { Avatar, Button, ButtonLink, Dialog, EmptyState, Field, SelectInput, Spinner, Status, TextInput } from "@/components/ui";
import { InfoStrip, IntroCard, PageTitle, Panel } from "@/components/page/Blocks";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useCan } from "@/lib/auth/useCan";
import { applyFieldErrors } from "@/lib/api/errorMessage";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Permission } from "@/config/navigation";
import {
  PERMISSIONS,
  ROLE_DEFAULTS,
  ROLE_INFO,
  isEmailUnavailable,
  pendingInviteId,
  useCancelInvite,
  useInvite,
  useRemoveMember,
  useResendInvite,
  useTeamInvites,
  useTeamMembers,
  useUpdatePermissions,
  useUpdateRole,
  type InviteRole,
  type TeamInvite,
  type TeamMember,
} from "@/lib/team/api";

const Loading = () => (
  <div className="flex justify-center py-16 text-ink-brand" role="status">
    <Spinner className="size-8" />
    <span className="sr-only">Loading…</span>
  </div>
);

/** Shown to people without team management. */
function NoTeamAccess() {
  return (
    <EmptyState
      className="max-w-xl"
      icon={<IconLock className="size-7" />}
      title="Team management is for owners and admins"
      body="Ask the business owner if you need to invite people or change access."
      action={<ButtonLink to="/dashboard" size="md">Back to dashboard</ButtonLink>}
    />
  );
}

type Row =
  | { kind: "member"; key: string; member: TeamMember }
  | { kind: "invite"; key: string; invite: TeamInvite };

/** Who the signed-in person may change: owner → anyone but themselves; admin → managers and staff. */
function useManageRules() {
  const { user, workspace } = useAuth();
  const isOwner = !workspace || workspace.role === "owner";
  return {
    isOwner,
    canChange: (m: TeamMember) => !m.isOwner && m.user._id !== user?._id && (isOwner || m.role !== "admin"),
    canInviteRole: (r: InviteRole) => isOwner || r !== "admin",
    canGrant: (p: Permission) => isOwner || (p !== "manageTeam" && Boolean(workspace?.permissions[p])),
  };
}

/** Members + pending invites, searchable (04.01 / 04.05). */
function MembersPanel({ compact = false }: { compact?: boolean }) {
  const members = useTeamMembers();
  const invites = useTeamInvites();
  const rules = useManageRules();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const resend = useResendInvite();
  const cancel = useCancelInvite();
  const [actionError, setActionError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const rows: Row[] = useMemo(() => {
    const all: Row[] = [
      ...(members.data ?? []).map((m) => ({ kind: "member" as const, key: m._id, member: m })),
      ...(invites.data ?? []).map((i) => ({ kind: "invite" as const, key: i._id, invite: i })),
    ];
    const term = q.trim().toLowerCase();
    if (!term) return all;
    return all.filter((r) => {
      const hay = r.kind === "member" ? `${r.member.user.name} ${r.member.user.email} ${r.member.role}` : `${r.invite.name ?? ""} ${r.invite.email} ${r.invite.role}`;
      return hay.toLowerCase().includes(term);
    });
  }, [members.data, invites.data, q]);

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setActionError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(done);
    } catch (err) {
      setActionError(err);
    }
  };

  return (
    <Panel title="Team members">
      <label className="flex h-control-lg items-center gap-2 rounded-md bg-surface-pale px-3">
        <IconSearch aria-hidden="true" className="size-icon text-ink-muted" />
        <span className="sr-only">Search members</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members, emails or roles" className="h-full flex-1 bg-transparent text-input text-ink-strong outline-none placeholder:text-ink-muted" />
      </label>
      {members.isLoading || invites.isLoading ? (
        <Loading />
      ) : members.error ? (
        <ErrorNote className="mt-4" error={members.error} fallback="We couldn't load your team. Please try again." onRetry={() => void members.refetch()} />
      ) : (
        <ul className="mt-4 flex flex-col gap-2" aria-label="Team members and invitations">
          <li aria-hidden="true" className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] px-3 text-caption font-semibold uppercase text-ink-muted md:grid">
            <span>Member</span>
            <span>Role</span>
            <span>Access</span>
            <span>State</span>
          </li>
          {rows.length === 0 && <li className="py-6 text-center text-body-lg text-ink-secondary">No one matches “{q}”.</li>}
          {rows.map((r) =>
            r.kind === "member" ? (
              <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg bg-surface-pale px-3 py-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={r.member.user.name} src={r.member.user.avatar} />
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-ink-strong">{r.member.user.name}</p>
                    <p className="truncate text-caption text-ink-muted">{r.member.user.email}</p>
                  </div>
                </div>
                <span className="text-body-sm text-ink-strong">{ROLE_INFO[r.member.role].label}</span>
                <span className="col-span-2 text-body-sm text-ink-secondary md:col-span-1">{ROLE_INFO[r.member.role].access}</span>
                <div className="col-span-2 flex flex-wrap items-center gap-2 md:col-span-1">
                  <Status tone="success">Active</Status>
                  {!compact && rules.canChange(r.member) && (
                    <>
                      <button type="button" onClick={() => setEditing(r.member)} className="text-body-sm font-semibold text-ink-brand hover:underline">
                        Edit access
                      </button>
                      <button type="button" onClick={() => setRemoving(r.member)} className="text-body-sm font-semibold text-danger hover:underline">
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </li>
            ) : (
              <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg bg-surface-pale px-3 py-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={r.invite.name || r.invite.email} />
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-ink-strong">{r.invite.name || r.invite.email}</p>
                    <p className="truncate text-caption text-ink-muted">{r.invite.name ? r.invite.email : `Invite expires ${shortDate(r.invite.expiresAt)}`}</p>
                  </div>
                </div>
                <span className="text-body-sm text-ink-strong">{ROLE_INFO[r.invite.role].label}</span>
                <span className="col-span-2 text-body-sm text-ink-secondary md:col-span-1">{ROLE_INFO[r.invite.role].access}</span>
                <div className="col-span-2 flex flex-wrap items-center gap-2 md:col-span-1">
                  <Status tone="warning">Invited</Status>
                  {!compact && rules.canInviteRole(r.invite.role) && (
                    <>
                      <button type="button" disabled={resend.isPending} onClick={() => void run(() => resend.mutateAsync(r.invite._id), `Invitation resent to ${r.invite.email}.`)} className="text-body-sm font-semibold text-ink-brand hover:underline">
                        Resend
                      </button>
                      <button type="button" disabled={cancel.isPending} onClick={() => void run(() => cancel.mutateAsync(r.invite._id), `Invitation to ${r.invite.email} cancelled.`)} className="text-body-sm font-semibold text-danger hover:underline">
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </li>
            )
          )}
        </ul>
      )}
      <ErrorNote className="mt-3" error={actionError} fallback="That didn't work. Please try again." />
      {notice && <p role="status" className="mt-3 text-body-sm text-success">{notice}</p>}
      <p className="mt-5 text-body-lg font-semibold text-ink-brand">Use custom permissions for sensitive features</p>
      <p className="mt-1 text-body-sm text-ink-muted">Billing and business deletion are restricted to the owner.</p>
      {editing && <EditAccessDialog member={editing} onClose={() => setEditing(null)} />}
      {removing && <RemoveDialog member={removing} onClose={() => setRemoving(null)} />}
    </Panel>
  );
}

/** Role + module access checkboxes (invite form and edit dialog). */
function PermissionPicker({ value, onChange, disabled }: { value: Record<Permission, boolean>; onChange: (v: Record<Permission, boolean>) => void; disabled?: (p: Permission) => boolean }) {
  return (
    <fieldset className="grid gap-2 md:grid-cols-2">
      <legend className="sr-only">Module access</legend>
      {PERMISSIONS.map(([key, label, hint]) => {
        const off = disabled?.(key) && !value[key];
        return (
          <label key={key} className={cn("flex items-start gap-2 rounded-md bg-surface-card px-3 py-2", off && "opacity-60")}>
            <input type="checkbox" className="mt-1 size-4 accent-brand-navy" checked={Boolean(value[key])} disabled={off} onChange={(e) => onChange({ ...value, [key]: e.target.checked })} />
            <span>
              <span className="block text-body-sm font-semibold text-ink-strong">{label}</span>
              <span className="block text-caption text-ink-muted">{hint}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

function EditAccessDialog({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const rules = useManageRules();
  const updateRole = useUpdateRole(member._id);
  const updatePerms = useUpdatePermissions(member._id);
  const role = member.role as InviteRole;
  const [nextRole, setNextRole] = useState<InviteRole>(role);
  const [perms, setPerms] = useState<Record<Permission, boolean>>({ ...ROLE_DEFAULTS[role], ...(member.permissions as Record<Permission, boolean>) });
  const [error, setError] = useState<unknown>(null);
  const save = async () => {
    setError(null);
    try {
      if (nextRole !== role) await updateRole.mutateAsync(nextRole);
      const base = nextRole !== role ? ROLE_DEFAULTS[nextRole] : { ...ROLE_DEFAULTS[role], ...(member.permissions as Record<Permission, boolean>) };
      const changed = Object.fromEntries(PERMISSIONS.map(([k]) => [k, perms[k]]).filter(([k, v]) => base[k as Permission] !== v));
      if (Object.keys(changed).length) await updatePerms.mutateAsync(changed);
      onClose();
    } catch (err) {
      setError(err);
    }
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Access for ${member.user.name}`}
      description="Changing the role resets module access to that role's defaults; you can then adjust it."
      actions={
        <>
          <Button variant="outlined" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()} loading={updateRole.isPending || updatePerms.isPending} loadingText="Saving…">Save access</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-left">
        <Field label="Role">
          <SelectInput
            value={nextRole}
            onChange={(e) => {
              const r = e.target.value as InviteRole;
              setNextRole(r);
              setPerms(ROLE_DEFAULTS[r]);
            }}
          >
            {(["admin", "manager", "staff"] as InviteRole[]).filter(rules.canInviteRole).map((r) => (
              <option key={r} value={r}>{ROLE_INFO[r].label}</option>
            ))}
          </SelectInput>
        </Field>
        <PermissionPicker value={perms} onChange={setPerms} disabled={(p) => !rules.canGrant(p)} />
        <ErrorNote error={error} fallback="We couldn't save this access. Please try again." />
      </div>
    </Dialog>
  );
}

function RemoveDialog({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const remove = useRemoveMember();
  const [error, setError] = useState<unknown>(null);
  return (
    <Dialog
      open
      onClose={onClose}
      tone="danger"
      icon={<IconTrash className="size-7" />}
      title={`Remove ${member.user.name}?`}
      description="They'll lose access to this business straight away. Their past work stays in your records. You can invite them again later."
      actions={
        <>
          <Button variant="outlined" onClick={onClose}>Keep</Button>
          <Button
            variant="destructive"
            loading={remove.isPending}
            loadingText="Removing…"
            onClick={async () => {
              setError(null);
              try {
                await remove.mutateAsync(member._id);
                onClose();
              } catch (err) {
                setError(err);
              }
            }}
          >
            Remove
          </Button>
        </>
      }
    >
      <ErrorNote error={error} fallback="We couldn't remove this person. Please try again." />
    </Dialog>
  );
}

function PermissionsOverview() {
  return (
    <Panel tone="pale" title="Permissions overview" subtitle="Everyone gets their own account and a defined role.">
      <dl className="flex flex-col gap-4">
        {(["owner", "admin", "manager", "staff"] as const).map((r) => (
          <div key={r}>
            <dt className="text-caption font-semibold uppercase text-ink-brand">{ROLE_INFO[r].label}</dt>
            <dd className="mt-2 rounded-md bg-surface-card px-3 py-3 text-body-sm text-ink-strong">{ROLE_INFO[r].summary}</dd>
          </div>
        ))}
      </dl>
      <ButtonLink to="/settings/team/invite" fullWidth className="mt-6">
        <IconUserPlus aria-hidden="true" className="size-icon" /> Invite teammate
      </ButtonLink>
    </Panel>
  );
}

// 04.01 Team & roles
export function TeamDirectoryPage() {
  const canManage = useCan("manageTeam");
  if (!canManage) return <NoTeamAccess />;
  return (
    <div className="flex flex-col gap-6">
      <PageTitle actions={<ButtonLink to="/settings/team/invite" size="md">Invite teammate</ButtonLink>}>Team &amp; roles</PageTitle>
      <IntroCard eyebrow="Team management / Access control" title="Control who works with your business and what they can access.">
        Owner, Admin, Manager and Staff roles are supported.
      </IntroCard>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <MembersPanel />
        <PermissionsOverview />
      </div>
    </div>
  );
}

// 04.05 Invite a team member
const inviteSchema = z.object({
  name: z.string().trim().max(100),
  email: z.string().trim().min(1, "Enter the person's email address.").refine((v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Enter a valid email address."),
  role: z.enum(["admin", "manager", "staff"]),
});
type InviteValues = z.infer<typeof inviteSchema>;

export function InvitePage() {
  const navigate = useNavigate();
  const canManage = useCan("manageTeam");
  const rules = useManageRules();
  const invite = useInvite();
  const resend = useResendInvite();
  const [perms, setPerms] = useState<Record<Permission, boolean>>(ROLE_DEFAULTS.staff);
  const [formError, setFormError] = useState<unknown>(null);
  const [existingInvite, setExistingInvite] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const { register, handleSubmit, watch, setError, formState } = useForm<InviteValues>({ resolver: zodResolver(inviteSchema), defaultValues: { name: "", email: "", role: "staff" } });
  const role = watch("role");
  if (!canManage) return <NoTeamAccess />;

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    setExistingInvite(null);
    setUnavailable(false);
    // Only send permissions that differ from the role's defaults.
    const overrides = Object.fromEntries(PERMISSIONS.map(([k]) => [k, perms[k]]).filter(([k, val]) => ROLE_DEFAULTS[v.role][k as Permission] !== val));
    try {
      const res = await invite.mutateAsync({ email: v.email, name: v.name || undefined, role: v.role, permissions: Object.keys(overrides).length ? overrides : undefined });
      navigate("/settings/team/invite/sent", { state: { invite: res.invite } });
    } catch (err) {
      const id = pendingInviteId(err);
      if (id) setExistingInvite(id);
      else if (isEmailUnavailable(err)) setUnavailable(true);
      else if (!applyFieldErrors(err, setError, ["email", "name", "role"])) setFormError(err);
    }
  });

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Invite a team member</PageTitle>
      <IntroCard eyebrow="Team management / Access control" title="Invite securely by email and configure the right access.">
        Owner, Admin, Manager and Staff roles are supported.
      </IntroCard>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="order-2 lg:order-1">
          <MembersPanel compact />
        </div>
        <form noValidate onSubmit={onSubmit} className="order-1 lg:order-2">
          <Panel tone="pale" title="Send invitation" subtitle="Access is granted after the invitation is accepted.">
            <div className="flex flex-col gap-4">
              <Field label="Full name">
                <TextInput autoComplete="off" placeholder="Enter team member name" {...register("name")} />
              </Field>
              <Field label="Email address" required error={formState.errors.email?.message}>
                <TextInput type="email" autoComplete="off" placeholder="name@business.com" {...register("email")} />
              </Field>
              <Field label="Role" hint="Owner can't be invited; each business has one owner.">
                <SelectInput
                  {...register("role", {
                    onChange: (e) => setPerms(ROLE_DEFAULTS[e.target.value as InviteRole]),
                  })}
                >
                  {(["admin", "manager", "staff"] as InviteRole[]).filter(rules.canInviteRole).map((r) => (
                    <option key={r} value={r}>{ROLE_INFO[r].label} — {ROLE_INFO[r].access.toLowerCase()}</option>
                  ))}
                </SelectInput>
              </Field>
              <div>
                <p className="mb-2 text-caption font-semibold uppercase text-ink-brand">Permissions</p>
                <PermissionPicker value={perms} onChange={setPerms} disabled={(p) => !rules.canGrant(p)} />
                <p className="mt-2 text-caption text-ink-muted">Starts from the {ROLE_INFO[role].label.toLowerCase()} defaults. Only the owner can grant team management.</p>
              </div>
              {existingInvite && (
                <div role="status" className="rounded-lg bg-surface-tint-warm px-4 py-3 text-body-sm text-ink-strong">
                  <p className="font-semibold">An invitation is already waiting for this email.</p>
                  <Button
                    size="md"
                    variant="secondary"
                    className="mt-2"
                    loading={resend.isPending}
                    loadingText="Resending…"
                    onClick={async () => {
                      try {
                        const res = await resend.mutateAsync(existingInvite);
                        navigate("/settings/team/invite/sent", { state: { invite: res.invite, resent: true } });
                      } catch (err) {
                        setFormError(err);
                      }
                    }}
                  >
                    <IconMailForward aria-hidden="true" className="size-icon" /> Resend it
                  </Button>
                </div>
              )}
              {unavailable && <p role="status" className="rounded-lg bg-surface-tint-warm px-4 py-3 text-body-sm text-ink-strong">We couldn't send the invitation email right now, so no invite was created. Please try again in a few minutes.</p>}
              <ErrorNote error={formError} fallback="We couldn't send the invitation. Check your connection and try again." onRetry={() => void onSubmit()} />
              <Button type="submit" fullWidth loading={formState.isSubmitting} loadingText="Sending…">
                Send invitation
              </Button>
            </div>
          </Panel>
        </form>
      </div>
    </div>
  );
}

// 04.09 Invitation sent
export function InviteSentPage() {
  const location = useLocation();
  const state = location.state as { invite?: TeamInvite; resent?: boolean } | null;
  const invite = state?.invite;
  const resend = useResendInvite();
  const cancel = useCancelInvite();
  const navigate = useNavigate();
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  if (!invite) {
    return (
      <EmptyState
        className="max-w-xl"
        icon={<IconMailForward className="size-7" />}
        title="No invitation to show"
        body="Invitations you send appear in your team list."
        action={<ButtonLink to="/settings/team" size="md">Go to team</ButtonLink>}
      />
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Invitation sent</PageTitle>
      <section className="rounded-2xl bg-success-bg px-5 py-4 shadow-card lg:px-6 lg:py-5">
        <p className="text-caption font-semibold uppercase text-success">{state?.resent ? "Resent" : "Sent"}</p>
        <h2 className="mt-2 text-section-title text-ink-strong">We emailed {invite.name || invite.email} an invitation.</h2>
        <p className="mt-2 text-body-sm text-ink-muted">They get access as {ROLE_INFO[invite.role].label} once they accept. The link expires {shortDate(invite.expiresAt)}.</p>
      </section>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Invitation details">
          <dl className="grid grid-cols-[minmax(0,8rem)_1fr] gap-x-4 gap-y-3 text-body-lg">
            {invite.name && (
              <>
                <dt className="text-ink-muted">Name</dt>
                <dd className="text-ink-strong">{invite.name}</dd>
              </>
            )}
            <dt className="text-ink-muted">Email</dt>
            <dd className="break-all text-ink-strong">{invite.email}</dd>
            <dt className="text-ink-muted">Role</dt>
            <dd className="text-ink-strong">{ROLE_INFO[invite.role].label}</dd>
            <dt className="text-ink-muted">Access</dt>
            <dd className="text-ink-strong">{PERMISSIONS.filter(([k]) => invite.permissions[k]).map(([, l]) => l).join(", ") || "—"}</dd>
          </dl>
          <ErrorNote className="mt-4" error={error} fallback="That didn't work. Please try again." />
          {notice && <p role="status" className="mt-3 text-body-sm text-success">{notice}</p>}
          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <ButtonLink to="/settings/team" className="md:flex-1">Back to team</ButtonLink>
            <ButtonLink to="/settings/team/invite" variant="secondary" className="md:flex-1">Invite another</ButtonLink>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-body-sm">
            <button
              type="button"
              className="font-semibold text-ink-brand hover:underline"
              disabled={resend.isPending}
              onClick={async () => {
                setError(null);
                try {
                  await resend.mutateAsync(invite._id);
                  setNotice("Invitation resent.");
                } catch (err) {
                  setError(err);
                }
              }}
            >
              Resend invitation
            </button>
            <button
              type="button"
              className="font-semibold text-danger hover:underline"
              disabled={cancel.isPending}
              onClick={async () => {
                setError(null);
                try {
                  await cancel.mutateAsync(invite._id);
                  navigate("/settings/team", { replace: true });
                } catch (err) {
                  setError(err);
                }
              }}
            >
              Cancel invitation
            </button>
          </div>
        </Panel>
        <InfoStrip title="What happens next">
          They open the email, sign in or create an account with <strong>{invite.email}</strong>, and join your business. You'll get a notification when they accept.{" "}
          <Link to="/settings/team" className="font-semibold text-ink-brand hover:underline">See your team</Link>
        </InfoStrip>
      </div>
    </div>
  );
}
