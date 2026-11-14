import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  IconBell,
  IconBuildingStore,
  IconChevronRight,
  IconCreditCard,
  IconDeviceDesktop,
  IconLock,
  IconShieldLock,
  IconAdjustments,
  IconUserCircle,
  IconUsersGroup,
  IconDoorExit,
} from "@tabler/icons-react";
import { Button, ButtonLink, Field, PasswordInput, SelectInput, Spinner, TextArea, TextInput } from "@/components/ui";
import { HelpPanel, IntroCard, PageTitle, Panel } from "@/components/page/Blocks";
import { StateCard } from "@/components/page/StateCard";
import { AuthNote } from "@/components/layout/AuthLayout";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { BusinessProfileForm } from "@/components/business/BusinessProfileForm";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useCan } from "@/lib/auth/useCan";
import { MIN_PASSWORD } from "@/lib/auth/password";
import { ApiError } from "@/lib/api/client";
import { applyFieldErrors, cooldownMessage } from "@/lib/api/errorMessage";
import { BUSINESS_CATEGORIES, BUSINESS_TYPES, useBusinessProfile } from "@/lib/workspace/api";
import {
  START_PAGES,
  changePassword,
  closeAccount,
  longDate,
  signOutOtherDevices,
  useAccountProfile,
  useClosureCheck,
  useSaveWorkspacePreferences,
  useWorkspacePreferences,
  type StartPage,
} from "@/lib/account/api";
import { naira } from "@/lib/format";
import { cn } from "@/lib/cn";

// Account & settings (Figma 13.01–13.08).

const Loading = () => (
  <div className="flex justify-center py-16 text-ink-brand" role="status">
    <Spinner className="size-8" />
    <span className="sr-only">Loading…</span>
  </div>
);

// ── Settings hub ──────────────────────────────────────────────────────────
function HubLink({ to, icon, title, body, aside }: { to: string; icon: ReactNode; title: string; body: string; aside?: ReactNode }) {
  return (
    <li>
      <Link to={to} className="flex min-w-0 items-center gap-4 rounded-xl border border-line-card bg-surface-card px-4 py-4 shadow-card hover:bg-surface-pale">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-tint-blue text-ink-brand">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body-lg font-semibold text-ink-strong">{title}</span>
          <span className="block break-words text-body-sm text-ink-muted">{body}</span>
          {aside}
        </span>
        <IconChevronRight aria-hidden="true" className="size-5 shrink-0 text-ink-brand" />
      </Link>
    </li>
  );
}

export function SettingsHubPage() {
  const { workspace } = useAuth();
  const isOwner = !workspace || workspace.role === "owner";
  const canTeam = useCan("manageTeam");
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Settings</PageTitle>
      <IntroCard eyebrow="Workspace / Account settings" title="Your account, your business and how BiManage works for you." />
      <ul className="grid gap-3 md:grid-cols-2">
        <HubLink to="/settings/profile" icon={<IconUserCircle className="size-icon" />} title="Profile" body="Your name, photo and contact details." />
        <HubLink to="/settings/business" icon={<IconBuildingStore className="size-icon" />} title="Business profile" body="The details on your invoices, store and supplier profile." />
        <HubLink to="/settings/preferences" icon={<IconAdjustments className="size-icon" />} title="Workspace preferences" body="Start page, larger text and reduced motion." />
        <HubLink to="/settings/security" icon={<IconShieldLock className="size-icon" />} title="Security and password" body="Change your password and keep your account safe." />
        <HubLink
          to="/notifications/preferences"
          icon={<IconBell className="size-icon" />}
          title="Notifications"
          body="Choose which alerts reach you in the app and by email."
          aside={
            <span className="mt-1 flex items-center gap-1.5 text-caption text-ink-secondary">
              <IconLock aria-hidden="true" className="size-3.5" /> Security alerts: always on
            </span>
          }
        />
        <HubLink to="/settings/sessions" icon={<IconDeviceDesktop className="size-icon" />} title="Sessions and devices" body="This device, and signing out everywhere else." />
        {canTeam && <HubLink to="/settings/team" icon={<IconUsersGroup className="size-icon" />} title="Team" body="Invite teammates and set what they can do." />}
        {isOwner && <HubLink to="/subscription" icon={<IconCreditCard className="size-icon" />} title="Subscription" body="Your plan, credits and billing." />}
        <HubLink to="/settings/close-account" icon={<IconDoorExit className="size-icon" />} title="Close account" body={isOwner ? "Close the business, with 30 days to change your mind." : "Only the owner can close the business."} />
      </ul>
    </div>
  );
}

// ── 13.01 Business profile ────────────────────────────────────────────────
const label = (list: ReadonlyArray<readonly [string, string]>, v?: string) => list.find(([k]) => k === v)?.[1] ?? "";
const FIELD_NAMES: Record<string, string> = {
  businessName: "Business name",
  businessType: "Business type",
  businessCategory: "Category",
  businessEmail: "Business email",
  businessPhone: "Phone",
  businessAddress: "Address",
  logo: "Logo",
  businessDescription: "About the business",
};

export function BusinessProfilePage() {
  const profile = useBusinessProfile();
  const canEdit = useCan("manageSettings");
  if (profile.isLoading) return <Loading />;
  if (profile.error || !profile.data) return <ErrorNote error={profile.error ?? true} fallback="We couldn't load your business profile. Please try again." onRetry={() => void profile.refetch()} />;
  const p = profile.data;
  const c = p.completeness;
  const store = p.store;
  const storeUrl = store?.customDomain ? `https://${store.customDomain}` : store?.url ?? null;
  const rows: Array<[string, ReactNode]> = [
    ["Business name", p.businessName || "Not added yet"],
    ["Business type and category", [label(BUSINESS_TYPES, p.businessType), label(BUSINESS_CATEGORIES, p.businessCategory)].filter(Boolean).join(" · ") || "Not added yet"],
    ["CAC registration", p.cacNumber || "Not added yet"],
    ["Business address", p.businessAddress || "Not added yet"],
    ["Phone and email", [p.businessPhone, p.businessEmail].filter(Boolean).join(" · ") || "Not added yet"],
    ["Website", p.businessWebsite || "Not added yet"],
  ];
  return (
    <div className="flex flex-col gap-6">
      <PageTitle actions={canEdit && <ButtonLink to="/settings/business/edit" size="md">Edit business profile</ButtonLink>}>Business profile</PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Your registered business identity across BiManage.</p>
      <IntroCard eyebrow="Workspace / Account settings" title="These details also appear on invoices, the store and BiSupplyNet." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel title="Business registration and contact details" subtitle={c ? `Profile completeness: ${c.percent}%.` : undefined}>
          <dl className="flex flex-col overflow-hidden rounded-xl">
            {rows.map(([k, v], i) => (
              <div key={k} className={cn("grid gap-1 px-3 py-3 text-body-sm md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] md:gap-3", i % 2 === 0 && "bg-surface-pale")}>
                <dt className="font-semibold text-ink-strong">{k}</dt>
                <dd className="min-w-0 break-words text-ink-secondary">{v}</dd>
              </div>
            ))}
          </dl>
          {!canEdit && <p className="mt-4 text-body-sm text-ink-muted">Only people who can manage settings can change these details.</p>}
        </Panel>
        <Panel tone="pale" title="Key information">
          <dl className="flex flex-col gap-4">
            {c && (
              <div className="rounded-md bg-surface-card px-3 py-2">
                <dt className="text-caption font-semibold uppercase text-ink-muted">Profile completeness</dt>
                <dd className="text-body-lg text-ink-strong">
                  {c.percent}%
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-disabled" role="progressbar" aria-label="Profile completeness" aria-valuenow={c.percent} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full rounded-full bg-success" style={{ width: `${c.percent}%` }} />
                  </div>
                  {c.missing.length > 0 && <p className="mt-2 break-words text-caption text-ink-muted">Still to add: {c.missing.map((m) => FIELD_NAMES[m] ?? m).join(", ")}.</p>}
                </dd>
              </div>
            )}
            <div className="rounded-md bg-surface-card px-3 py-2">
              <dt className="text-caption font-semibold uppercase text-ink-muted">Account owner</dt>
              <dd className="break-words text-body-lg text-ink-strong">{p.owner?.name ?? "Not available"}</dd>
            </div>
            <div className="rounded-md bg-surface-card px-3 py-2">
              <dt className="text-caption font-semibold uppercase text-ink-muted">Online store</dt>
              <dd className="break-words text-body-lg text-ink-strong">
                {store ? (
                  <>
                    {store.name}
                    <span className="block text-body-sm text-ink-muted">{store.published ? "Published" : "Not published yet"}</span>
                    {storeUrl && store.published ? (
                      <a href={storeUrl} target="_blank" rel="noreferrer" className="block break-all text-body-sm font-semibold text-ink-brand hover:underline">
                        Visit store
                      </a>
                    ) : (
                      <Link to="/store" className="block text-body-sm font-semibold text-ink-brand hover:underline">
                        Open store settings
                      </Link>
                    )}
                  </>
                ) : (
                  <Link to="/store/create" className="text-body-sm font-semibold text-ink-brand hover:underline">
                    Create your store
                  </Link>
                )}
              </dd>
            </div>
            <div className="rounded-md bg-surface-card px-3 py-2">
              <dt className="text-caption font-semibold uppercase text-ink-muted">Logo and brand</dt>
              <dd className="flex items-center gap-3 text-body-lg text-ink-strong">
                {p.logo ? <img src={p.logo} alt="Business logo" className="size-10 rounded-md object-contain" /> : "No logo yet"}
              </dd>
            </div>
            <div className="rounded-md bg-surface-card px-3 py-2">
              <dt className="text-caption font-semibold uppercase text-ink-muted">Used by</dt>
              <dd className="text-body-lg text-ink-strong">Invoices · Store · Suppliers</dd>
            </div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}

// ── 13.02 Edit business profile ───────────────────────────────────────────
export function EditBusinessProfilePage() {
  const navigate = useNavigate();
  const profile = useBusinessProfile();
  const canEdit = useCan("manageSettings");
  if (!canEdit) {
    return (
      <StateCard
        label="Read only"
        icon={<IconLock className="size-icon" />}
        eyebrow="Business profile"
        title="You can view these details, not change them"
        body="Ask the business owner for permission to manage settings."
        rows={[]}
        actions={<ButtonLink to="/settings/business" size="md">Back to business profile</ButtonLink>}
      />
    );
  }
  if (profile.isLoading) return <Loading />;
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Edit business details</PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Update the information shown throughout your business tools.</p>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <BusinessProfileForm
          profile={profile.data}
          extended
          title="Legal and business information"
          subtitle="Use the same registered name as on your formal documents."
          submitLabel="Save business details"
          onSaved={() => navigate("/settings/business", { replace: true })}
        />
        <HelpPanel
          items={[
            ["Identity", "Shown on invoices"],
            ["Checkout", "Support contact for shoppers"],
            ["Suppliers", "Your BiSupplyNet profile"],
          ]}
        />
      </div>
    </div>
  );
}

// ── 13.03 Workspace preferences ───────────────────────────────────────────
export function WorkspacePreferencesPage() {
  const prefs = useWorkspacePreferences();
  const save = useSaveWorkspacePreferences();
  const profile = useBusinessProfile();
  const [draft, setDraft] = useState<{ startPage: StartPage; reduceMotion: boolean; largerText: boolean } | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (prefs.data && !draft) setDraft({ startPage: prefs.data.startPage, reduceMotion: prefs.data.reduceMotion, largerText: prefs.data.largerText });
  }, [prefs.data, draft]);
  if (prefs.isLoading) return <Loading />;
  if (prefs.error || !prefs.data || !draft) return <ErrorNote error={prefs.error ?? true} fallback="We couldn't load your preferences. Please try again." onRetry={() => void prefs.refetch()} />;
  const p = prefs.data;
  const dirty = draft.startPage !== p.startPage || draft.reduceMotion !== p.reduceMotion || draft.largerText !== p.largerText;
  const pages = (p.startPages ?? (Object.keys(START_PAGES) as StartPage[])).filter((k) => START_PAGES[k]);
  const change = (patch: Partial<typeof draft>) => {
    setSaved(false);
    setDraft({ ...draft, ...patch });
  };
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Workspace preferences</PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Personalise how BiManage works for you. These settings are yours alone.</p>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <form
          className="flex min-w-0 flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(draft, { onSuccess: () => setSaved(true) });
          }}
        >
          <Panel title="Your preferences" subtitle="Where BiManage opens, and how it looks for you.">
            <div className="flex flex-col gap-5">
              <Field label="Dashboard start page" hint="Where BiManage opens after you sign in.">
                <SelectInput value={draft.startPage} onChange={(e) => change({ startPage: e.target.value as StartPage })}>
                  {pages.map((k) => (
                    <option key={k} value={k}>
                      {START_PAGES[k].label}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <fieldset className="flex flex-col gap-3">
                <legend className="text-field-label uppercase text-ink-secondary">Accessibility</legend>
                <label className="flex items-start gap-3 text-body-lg text-ink-strong">
                  <input type="checkbox" className="mt-0.5 size-5 accent-[var(--color-brand-navy)]" checked={draft.largerText} onChange={(e) => change({ largerText: e.target.checked })} />
                  <span>
                    Larger text
                    <span className="block text-body-sm text-ink-muted">Makes text and controls a little bigger.</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 text-body-lg text-ink-strong">
                  <input type="checkbox" className="mt-0.5 size-5 accent-[var(--color-brand-navy)]" checked={draft.reduceMotion} onChange={(e) => change({ reduceMotion: e.target.checked })} />
                  <span>
                    Reduce motion
                    <span className="block text-body-sm text-ink-muted">Turns off animations and smooth scrolling.</span>
                  </span>
                </label>
              </fieldset>
            </div>
          </Panel>
          <Panel title="Business settings" subtitle="The same for every BiManage account for now.">
            <dl className="grid gap-3 md:grid-cols-2">
              {(
                [
                  ["Business timezone", p.timezone === "Africa/Lagos" ? "Africa/Lagos (Nigeria, UTC+1)" : p.timezone],
                  ["Default currency", p.currency === "NGN" ? "Nigerian naira (NGN)" : p.currency],
                  ["Date format", p.dateFormat === "DD MMM YYYY" ? "14 Nov 2026" : p.dateFormat],
                  ["Language", p.language],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="min-w-0 rounded-md bg-surface-pale px-3 py-2">
                  <dt className="flex items-center gap-1.5 text-caption font-semibold uppercase text-ink-muted">
                    <IconLock aria-hidden="true" className="size-3.5" /> {k}
                  </dt>
                  <dd className="break-words text-body-lg text-ink-strong">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-body-sm text-ink-muted">BiManage works in Lagos time and naira. More options will come later.</p>
          </Panel>
          <ErrorNote error={save.error} fallback="We couldn't save your preferences. Please try again." />
          <div className="flex flex-wrap items-center justify-end gap-3">
            {saved && !dirty && (
              <p role="status" className="text-body-sm text-success">
                Preferences saved.
              </p>
            )}
            <Button type="submit" loading={save.isPending} loadingText="Saving…" disabled={!dirty}>
              Save preferences
            </Button>
          </div>
        </form>
        <HelpPanel
          items={[
            ["Workspace", profile.data?.businessName || "Your business"],
            ["Local time", "Nigeria, UTC+1"],
            ["Currency", "NGN for every transaction"],
          ]}
        />
      </div>
    </div>
  );
}

// ── 13.04 Security and password ───────────────────────────────────────────
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z.string().min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters.`),
    confirmPassword: z.string().min(1, "Repeat your new password."),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match. Re-enter your new password." })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ["newPassword"], message: "Choose a password you haven't used here before." });
type PasswordValues = z.infer<typeof passwordSchema>;

/** "Sign out of all other devices": this device stays in with a fresh token. */
function SignOutOthers() {
  const { renewToken } = useAuth();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const res = await signOutOtherDevices();
      renewToken(res.token);
      setDone(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <Button variant="outlined" size="md" className="w-full md:w-auto md:self-start" loading={busy} loadingText="Signing out…" onClick={() => void run()}>
        Sign out of all other devices
      </Button>
      {done && <AuthNote tone="success">You've been signed out of all other devices. You're still signed in here.</AuthNote>}
      {error instanceof ApiError && error.status === 429 ? <AuthNote tone="danger">{cooldownMessage(error)}</AuthNote> : <ErrorNote error={error} fallback="We couldn't sign out your other devices. Please try again." />}
    </div>
  );
}

export function SecurityPage() {
  const { user, renewToken } = useAuth();
  const profile = useAccountProfile();
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [otherError, setOtherError] = useState<unknown>(null);
  const { register, handleSubmit, reset, setError, watch, formState } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" } });
  const newPassword = watch("newPassword");

  const onSubmit = handleSubmit(async (v) => {
    setSuccess(false);
    setFormError(null);
    setOtherError(null);
    try {
      const res = await changePassword(v);
      renewToken(res.token);
      reset();
      setSuccess(true);
      void profile.refetch();
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) return setFormError(cooldownMessage(err));
      if (err instanceof ApiError && err.status === 400 && /current password/i.test(err.message)) return setError("currentPassword", { message: "That isn't your current password. Check it and try again." }, { shouldFocus: true });
      if (!applyFieldErrors(err, setError, ["currentPassword", "newPassword", "confirmPassword"])) setOtherError(err);
    }
  });

  if (profile.isLoading) return <Loading />;
  const p = profile.data;
  const changedAt = p?.passwordChangedAt ? longDate(p.passwordChangedAt) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Password and security</PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Keep your BiManage account secure.</p>
      <IntroCard eyebrow="Workspace / Account settings" title="Important changes are confirmed by email.">
        When your password changes, we email you and sign out your other devices.
      </IntroCard>
      <ErrorNote error={profile.error} fallback="We couldn't load your security details. Please try again." onRetry={() => void profile.refetch()} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          {p && !p.hasPassword ? (
            <Panel title="You sign in with Google">
              <p className="text-body-lg text-ink-strong">Your account doesn't have a BiManage password, so there's nothing to change here.</p>
              <p className="mt-2 text-body-sm text-ink-muted">To protect your account, keep your Google account secure. If you'd like a password as well, use Forgot password on the sign-in page.</p>
            </Panel>
          ) : (
            <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
              <Panel title="Change your password" subtitle="Use a strong password you don't use anywhere else.">
                <div className="flex flex-col gap-4">
                  <Field label="Current password" required error={formState.errors.currentPassword?.message}>
                    <PasswordInput autoComplete="current-password" {...register("currentPassword")} />
                  </Field>
                  {/* Side by side only where the form is wide enough (tablets without
                      the sidebar, large desktops); between 1024 and 1440 they stack. */}
                  <div className="grid gap-4 md:grid-cols-2 md:gap-x-6 lg:grid-cols-1 desktop:grid-cols-2 desktop:gap-x-10">
                    <Field label="New password" required error={formState.errors.newPassword?.message} hint={`At least ${MIN_PASSWORD} characters.`}>
                      <PasswordInput autoComplete="new-password" {...register("newPassword")} />
                    </Field>
                    <Field label="Confirm password" required error={formState.errors.confirmPassword?.message}>
                      <PasswordInput autoComplete="new-password" {...register("confirmPassword")} />
                    </Field>
                  </div>
                  <PasswordStrength password={newPassword} />
                </div>
              </Panel>
              {success && <AuthNote tone="success">Password changed. Your other devices have been signed out, and we've emailed you to confirm.</AuthNote>}
              {formError && <AuthNote tone="danger">{formError}</AuthNote>}
              <ErrorNote error={otherError} fallback="We couldn't change your password. Please try again." />
              <Button type="submit" className="w-full md:w-auto md:self-end" loading={formState.isSubmitting} loadingText="Updating…">
                Update password
              </Button>
            </form>
          )}
          <Panel title="Other devices" subtitle="Signed in somewhere you don't recognise? Sign out everywhere else.">
            <SignOutOthers />
          </Panel>
        </div>
        <HelpPanel
          items={[
            ["Email verification", user?.isVerified ? "Verified" : "Not verified yet"],
            ["Last password change", changedAt ?? (p?.hasPassword === false ? "Not applicable" : "Not changed yet")],
            ["Password rules", `At least ${MIN_PASSWORD} characters`],
            ["Notification", "We email you after security changes"],
          ]}
          callout={{ title: "Recommendation", body: <Link to="/settings/sessions" className="font-semibold text-ink-brand hover:underline">Review sessions and devices</Link> }}
        />
      </div>
    </div>
  );
}

// ── 13.06 Sessions and devices ────────────────────────────────────────────
/** "Chrome on Windows" from the browser's user agent. */
export function describeDevice(ua: string): string {
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Your browser";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

export function SessionsPage() {
  const device = describeDevice(typeof navigator !== "undefined" ? navigator.userAgent : "");
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Sessions and devices</PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Where your BiManage account is signed in.</p>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="This device">
            <div className="flex min-w-0 items-center gap-3 rounded-md bg-surface-pale px-4 py-3">
              <IconDeviceDesktop aria-hidden="true" className="size-6 shrink-0 text-ink-brand" />
              <div className="min-w-0">
                <p className="break-words text-body-lg font-semibold text-ink-strong">{device}</p>
                <p className="text-body-sm text-success">Current session · Active</p>
              </div>
            </div>
          </Panel>
          <Panel title="Other devices" subtitle="A full list of signed-in devices is coming in a later update.">
            <p className="text-body-sm text-ink-secondary">For now you can sign out every other phone, tablet and computer in one go. This device stays signed in.</p>
            <div className="mt-4">
              <SignOutOthers />
            </div>
          </Panel>
        </div>
        <HelpPanel
          items={[
            ["Current device", device],
            ["Changing your password", "Also signs out your other devices"],
            ["Alerts", "We email you after security changes"],
          ]}
        />
      </div>
    </div>
  );
}

// ── 13.08 Close account ───────────────────────────────────────────────────
export function CloseAccountPage() {
  const navigate = useNavigate();
  const { workspace, user, endLocal } = useAuth();
  const isOwner = !workspace || workspace.role === "owner";
  const check = useClosureCheck(isOwner);
  const profile = useAccountProfile();
  const [secret, setSecret] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const ownerOnly = !isOwner || (check.error instanceof ApiError && check.error.status === 403 && Boolean(check.error.data.ownerOnly));
  if (ownerOnly) {
    return (
      <div className="flex flex-col gap-6">
        <PageTitle>Close account</PageTitle>
        <StateCard
          label="Owner only"
          icon={<IconLock className="size-icon" />}
          eyebrow="Account closure"
          title="Only the owner can close the business"
          body="To stop using this business, ask the owner to remove you from the team."
          rows={[]}
          actions={<ButtonLink to="/settings" size="md">Back to settings</ButtonLink>}
        />
      </div>
    );
  }
  if (check.isLoading || profile.isLoading) return <Loading />;
  if (check.error || !check.data) return <ErrorNote error={check.error ?? true} fallback="We couldn't check your account. Please try again." onRetry={() => void check.refetch()} />;

  const c = check.data;
  const google = profile.data?.hasPassword === false;
  const blocked = !c.canClose;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldError(null);
    if (!secret.trim()) return setFieldError(google ? "Type your account email to confirm." : "Enter your current password.");
    setBusy(true);
    try {
      const res = await closeAccount({ ...(google ? { confirmEmail: secret.trim() } : { password: secret }), ...(reason.trim() ? { reason: reason.trim() } : {}) });
      navigate("/account-closed", { replace: true, state: { purgeAt: res.purgeAt } });
      endLocal("closed");
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.status === 400 && (err.data.field === "password" || err.data.field === "confirmEmail")) setFieldError(google ? "That doesn't match your account email." : "That isn't your current password.");
      else if (err instanceof ApiError && err.status === 409 && Array.isArray(err.data.blockers)) void check.refetch();
      else if (err instanceof ApiError && err.status === 429) setFieldError(cooldownMessage(err));
      else setError(err);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Close account</PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Closing a business is a serious step. Read what happens first.</p>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title={`Close ${c.businessName || "your business"}?`} subtitle={blocked ? "A few things need sorting out before the account can close." : "Nothing is stopping the account from closing."}>
            {blocked ? (
              <ul aria-label="Things to sort out first" className="flex flex-col gap-2">
                {c.blockers.map((b) => (
                  <li key={b.key} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md bg-danger-bg px-4 py-3 text-body-sm">
                    <span className="min-w-0 break-words text-ink-strong">
                      <span className="font-semibold">{b.label}</span>
                      <span className="text-ink-secondary"> · {b.amount !== undefined ? naira(b.amount) : b.count}</span>
                    </span>
                    <Link to={b.link} className="font-semibold text-ink-brand hover:underline">
                      Sort this out<span className="sr-only">: {b.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="flex list-disc flex-col gap-2 pl-5 text-body-sm text-ink-strong">
                <li>You have {c.graceDays} days to change your mind. Sign in and choose Keep my account to restore everything.</li>
                <li>Everyone is signed out, and your team loses access straight away.</li>
                <li>Your online store goes offline.</li>
                <li>Your paid plan stops renewing.</li>
                <li>We email you now, and again 7 days before the account is removed.</li>
                <li>Financial records, such as invoices and payment history, are kept as the law requires.</li>
              </ul>
            )}
          </Panel>
          <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-5">
            <Panel title="Confirm it's you">
              <div className="flex flex-col gap-4">
                {google ? (
                  <Field label="Type your account email" required error={fieldError ?? undefined} hint={user?.email ? `This is ${user.email}.` : undefined}>
                    <TextInput type="email" autoComplete="off" value={secret} disabled={blocked} onChange={(e) => setSecret(e.target.value)} />
                  </Field>
                ) : (
                  <Field label="Current password" required error={fieldError ?? undefined}>
                    <PasswordInput autoComplete="current-password" value={secret} disabled={blocked} onChange={(e) => setSecret(e.target.value)} />
                  </Field>
                )}
                <Field label="Why are you leaving? (optional)">
                  <TextArea rows={3} maxLength={500} value={reason} disabled={blocked} onChange={(e) => setReason(e.target.value)} />
                </Field>
              </div>
            </Panel>
            <ErrorNote error={error} fallback="We couldn't close the account. Please try again." />
            <div className="flex flex-wrap justify-end gap-3">
              <ButtonLink to="/settings" variant="outlined">
                Keep my account
              </ButtonLink>
              <Button type="submit" variant="destructive" disabled={blocked} loading={busy} loadingText="Closing…">
                Request closure
              </Button>
            </div>
          </form>
        </div>
        <HelpPanel
          items={[
            ["Business", c.businessName || "Your business"],
            ["Time to change your mind", `${c.graceDays} days`],
            ["Restore", "Sign in and choose Keep my account"],
          ]}
        />
      </div>
    </div>
  );
}
