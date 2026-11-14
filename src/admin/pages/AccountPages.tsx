import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { IconCamera } from "@tabler/icons-react";
import { AuthLayout, AuthNote } from "@/components/layout/AuthLayout";
import { Avatar, Button, Field, OtpInput, PasswordInput, TextInput } from "@/components/ui";
import { PhotoEditorDialog } from "@/components/profile/PhotoDialog";
import { AdminPage, Section, ErrorBox, dateOnly } from "../components/AdminKit";
import { adminApi, adminError, fieldOf } from "../lib/api";
import { adminSession } from "../lib/session";
import { adminKeys, useAdminMe } from "../lib/hooks";
import { RecoveryCodesPanel } from "../components/RecoveryCodesPanel";

// An admin's own account (2026-11-14): profile photo, and changing the
// password with the current password AND a two-step code. Forgot password
// and the reset link live here too. Two-step sign-in is never skipped.

export function AdminAccountPage() {
  const me = useAdminMe().data;
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [photo, setPhoto] = useState(params.get("photo") === "1");
  useEffect(() => {
    if (params.get("photo") === "1") {
      setPhoto(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);
  const refresh = () => qc.invalidateQueries({ queryKey: adminKeys.all });
  return (
    <AdminPage title="My admin account">
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Profile">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={me?.name} src={me?.avatar} size="large" />
            <div className="min-w-0">
              <p className="text-title-sm text-ink-strong">{me?.name}</p>
              <p className="text-body-lg text-ink-secondary [overflow-wrap:anywhere]">{me?.email}</p>
              <p className="text-body-sm text-ink-muted">{me?.roleLabel} · two-step sign-in {me?.twoFactorEnabled ? "on" : "off"}</p>
            </div>
          </div>
          <Button variant="secondary" size="md" className="mt-4" onClick={() => setPhoto(true)}>
            <IconCamera aria-hidden="true" className="size-icon" /> {me?.avatar ? "Change or remove photo" : "Add a photo"}
          </Button>
          <p className="mt-2 text-body-sm text-ink-muted">Shown beside your name in the admin area: the header, ticket assignments, replies and the audit trail.</p>
        </Section>
        <ChangePassword />
        <NewRecoveryCodes />
      </div>
      <PhotoEditorDialog
        open={photo}
        onClose={() => setPhoto(false)}
        name={me?.name}
        avatar={me?.avatar}
        onUpload={async (blob) => {
          const form = new FormData();
          form.append("photo", blob, "photo.jpg");
          await adminApi("/admin/me/photo", { method: "POST", body: form });
          await refresh();
        }}
        onRemove={async () => {
          await adminApi("/admin/me/photo", { method: "DELETE" });
          await refresh();
        }}
      />
    </AdminPage>
  );
}

function ChangePassword() {
  const me = useAdminMe().data;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [recovery, setRecovery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const r = await adminApi<{ token: string }>("/admin/me/password", { method: "PUT", body: { currentPassword: current, newPassword: next, ...(useRecovery ? { recoveryCode: recovery } : { code }) } });
      adminSession.set(r.token);
      setCurrent("");
      setNext("");
      setCode("");
      setRecovery("");
      setDone(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  const field = fieldOf(error);
  return (
    <Section title="Change password">
      <form noValidate onSubmit={submit} className="flex flex-col gap-3">
        {done && <p className="rounded-lg bg-success-bg px-3 py-2 text-body-sm text-success" role="status">Password changed. Your other admin sessions were signed out, and we emailed you to confirm.</p>}
        {me?.passwordChangedAt && <p className="text-body-sm text-ink-muted">Last changed {dateOnly(me.passwordChangedAt)}.</p>}
        <Field label="Current password" error={field === "currentPassword" ? adminError(error) : undefined}>
          <PasswordInput autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label="New password" hint="At least 12 characters, with letters and numbers." error={field === "newPassword" ? adminError(error) : undefined}>
          <PasswordInput autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        {useRecovery ? (
          <Field label="Recovery code" error={field === "recoveryCode" ? adminError(error) : undefined}>
            <TextInput autoComplete="one-time-code" value={recovery} onChange={(e) => setRecovery(e.target.value)} />
          </Field>
        ) : (
          <div>
            <OtpInput value={code} onChange={setCode} label="Code from your authenticator app" />
            {field === "code" && <p className="mt-1 text-body-sm text-danger">{adminError(error)}</p>}
          </div>
        )}
        <button type="button" className="self-start text-body-sm font-semibold text-ink-brand" onClick={() => setUseRecovery((v) => !v)}>
          {useRecovery ? "Use the authenticator code instead" : "No phone? Use a recovery code"}
        </button>
        {error && !field ? <ErrorBox error={error} /> : null}
        <Button type="submit" loading={busy} disabled={!current || next.length < 12 || (useRecovery ? recovery.trim().length < 8 : code.length !== 6)} className="self-start">
          Change password
        </Button>
        <p className="text-body-sm text-ink-muted">Your other admin sessions are signed out. This one stays signed in.</p>
      </form>
    </Section>
  );
}

/** New recovery codes (the old ones stop working). Needs a two-step code. */
function NewRecoveryCodes() {
  const me = useAdminMe().data;
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [codes, setCodes] = useState<{ list: string[]; at: Date } | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await adminApi<{ recoveryCodes: string[]; generatedAt: string }>("/admin/me/recovery-codes", { method: "POST", body: { code } });
      setCodes({ list: r.recoveryCodes, at: new Date(r.generatedAt) });
      setCode("");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section title="Recovery codes">
      {codes && me ? (
        <RecoveryCodesPanel codes={codes.list} owner={{ name: me.name, email: me.email, roleLabel: me.roleLabel }} generatedAt={codes.at} onDone={() => setCodes(null)} doneLabel="Done" />
      ) : (
        <form noValidate onSubmit={submit} className="flex flex-col gap-3">
          <p className="text-body-lg text-ink-secondary">Used up your recovery codes, or think someone saw them? Get 10 new ones. The old codes stop working straight away.</p>
          <OtpInput value={code} onChange={setCode} label="Code from your authenticator app" />
          {error ? <ErrorBox error={error} /> : null}
          <Button type="submit" variant="secondary" loading={busy} disabled={code.length !== 6} className="self-start">
            Generate new recovery codes
          </Button>
        </form>
      )}
    </Section>
  );
}

export function AdminForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await adminApi<{ message: string }>("/admin/password/forgot", { method: "POST", body: { email }, anonymous: true });
      setSent(r.message);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthLayout panel="security" kicker="BiManage platform admin" title="Forgot your password?" subtitle="Enter your admin email. If it's an admin account, we'll email a link to set a new password." mobileSubtitle="We'll email a link to set a new password.">
      {sent ? (
        <div className="flex flex-col gap-4">
          <AuthNote tone="success">{sent}</AuthNote>
          <AuthNote>The link works once. You'll still sign in with your authenticator app afterwards. No email? Check spam, or ask a superadmin to reset your password.</AuthNote>
          <Link to="/admin/login" className="text-center text-body-lg font-semibold text-ink-brand">Back to admin sign-in</Link>
        </div>
      ) : (
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Admin email" required>
            <TextInput type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {error ? <AuthNote tone="danger">{adminError(error)}</AuthNote> : null}
          <Button type="submit" fullWidth loading={busy} disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)}>
            Email me a link
          </Button>
          <Link to="/admin/login" className="text-center text-body-lg font-semibold text-ink-brand">Back to admin sign-in</Link>
        </form>
      )}
    </AuthLayout>
  );
}

export function AdminResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  if (!token) return <Navigate to="/admin/forgot-password" replace />;
  const mismatch = confirm.length > 0 && confirm !== password;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mismatch) return;
    setBusy(true);
    setError(null);
    try {
      await adminApi("/admin/password/reset", { method: "POST", body: { token, newPassword: password }, anonymous: true });
      adminSession.clear("signed-out");
      setDone(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  const restart = Boolean((error as { data?: { restart?: boolean } } | null)?.data?.restart);
  return (
    <AuthLayout panel="security" kicker="BiManage platform admin" title={done ? "Password set" : "Set a new password"} subtitle={done ? "Sign in with your new password and your authenticator app." : "Choose a new admin password. Two-step sign-in stays on."}>
      {done ? (
        <Button fullWidth onClick={() => navigate("/admin/login", { replace: true })}>Go to admin sign-in</Button>
      ) : (
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          <Field label="New password" required hint="At least 12 characters, with letters and numbers." error={fieldOf(error) === "newPassword" ? adminError(error) : undefined}>
            <PasswordInput autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Confirm new password" required error={mismatch ? "The passwords don't match." : undefined}>
            <PasswordInput autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          {error && fieldOf(error) !== "newPassword" ? <AuthNote tone="danger">{adminError(error)}</AuthNote> : null}
          {restart ? (
            <Link to="/admin/forgot-password" className="text-center text-body-lg font-semibold text-ink-brand">Ask for a new link</Link>
          ) : (
            <Button type="submit" fullWidth loading={busy} disabled={password.length < 12 || password !== confirm}>
              Set new password
            </Button>
          )}
        </form>
      )}
    </AuthLayout>
  );
}
