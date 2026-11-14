import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { AuthLayout, AuthNote } from "@/components/layout/AuthLayout";
import { Button, Field, OtpInput, PasswordInput, TextInput } from "@/components/ui";
import { adminApi, adminError, fieldOf } from "../lib/api";
import { adminSession, adminStep } from "../lib/session";
import { adminKeys } from "../lib/hooks";
import type { AdminMe } from "../lib/types";

// Admin sign-in (decision A3, 2026-11-14): password, then two-step sign-in
// (an authenticator app). The first time, the admin scans a QR code and gets
// 10 recovery codes, shown once. A lost authenticator: a recovery code, or a
// superadmin resets two-step sign-in (or the server command if there's none).

interface SignedIn {
  token: string;
  admin: AdminMe;
  recoveryCodes?: string[];
  recoveryCodesLeft?: number;
}

function useFinishSignIn() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  return (res: SignedIn, then?: string) => {
    adminSession.set(res.token);
    adminStep.clear();
    qc.removeQueries({ queryKey: ["admin"] });
    qc.invalidateQueries({ queryKey: adminKeys.me });
    const from = (location.state as { from?: string } | null)?.from;
    navigate(then || (from && from.startsWith("/admin") && !from.startsWith("/admin/login") ? from : "/admin"), { replace: true });
  };
}

export function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  if (adminSession.get() && !params.get("ended")) return <Navigate to="/admin" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await adminApi<{ twoFactorRequired?: boolean; enrolRequired?: boolean; stepToken: string }>("/admin/login", { method: "POST", body: { email, password }, anonymous: true });
      const kind = res.enrolRequired ? "enrol" : "2fa";
      adminStep.set({ token: res.stepToken, kind, email });
      navigate(kind === "enrol" ? "/admin/login/setup" : "/admin/login/verify", { state: location.state });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  const field = fieldOf(error);
  return (
    <AuthLayout panel="security" kicker="BiManage platform admin" title="Admin sign-in" subtitle="For the BiTechTeam team. Two-step sign-in is required." mobileSubtitle="Two-step sign-in is required.">
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        {params.get("ended") && <AuthNote>Your admin session ended. Please sign in again.</AuthNote>}
        <Field label="Email address" required>
          <TextInput type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" required error={field === "password" ? adminError(error) : undefined}>
          <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && field !== "password" ? <AuthNote tone="danger">{adminError(error)}</AuthNote> : null}
        <Button type="submit" fullWidth loading={busy} loadingText="Checking…" disabled={!email || !password}>
          Continue
        </Button>
        <AuthNote>Repeated wrong attempts lock the account for 15 minutes. This isn't the business sign-in: <Link to="/login" className="font-semibold text-ink-brand">go to the business sign-in</Link>.</AuthNote>
      </form>
    </AuthLayout>
  );
}

export function AdminVerifyPage() {
  const step = adminStep.get();
  const finish = useFinishSignIn();
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [recovery, setRecovery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [pending, setPending] = useState<SignedIn | null>(null);
  if (!step || step.kind !== "2fa") return <Navigate to="/admin/login" replace />;

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await adminApi<SignedIn>("/admin/login/verify", { method: "POST", body: useRecovery ? { stepToken: step.token, recoveryCode: recovery } : { stepToken: step.token, code }, anonymous: true });
      // After a recovery code: say how many are left before going in.
      if (typeof res.recoveryCodesLeft === "number") {
        setLeft(res.recoveryCodesLeft);
        setPending(res);
      } else finish(res);
    } catch (err) {
      setError(err);
      if ((err as { data?: { restart?: boolean } })?.data?.restart) adminStep.clear();
    } finally {
      setBusy(false);
    }
  };
  if (pending && left !== null) {
    return (
      <AuthLayout panel="security" kicker="Two-step sign-in" title="Recovery code used" subtitle={`You have ${left} recovery code${left === 1 ? "" : "s"} left.`}>
        <div className="flex flex-col gap-4">
          <AuthNote tone={left <= 3 ? "danger" : "muted"}>
            {left <= 3 ? "You're running low. " : ""}If your authenticator app is lost, ask another superadmin to reset your two-step sign-in, then set it up again for new recovery codes.
          </AuthNote>
          <Button fullWidth onClick={() => finish(pending)}>
            Continue to admin
          </Button>
        </div>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout panel="security" kicker="Two-step sign-in" title="Enter your code" subtitle={`Open your authenticator app and enter the 6-digit code for BiManage (${step.email}).`} mobileSubtitle="Enter the 6-digit code from your authenticator app.">
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        {useRecovery ? (
          <Field label="Recovery code" hint="One of the codes you saved when you set up two-step sign-in. Each works once.">
            <TextInput autoComplete="one-time-code" value={recovery} onChange={(e) => setRecovery(e.target.value)} placeholder="xxxx-xxxx-xxxx" />
          </Field>
        ) : (
          <OtpInput value={code} onChange={setCode} label="Authenticator code" />
        )}
        {error ? <AuthNote tone="danger">{adminError(error)}</AuthNote> : null}
        <Button type="submit" fullWidth loading={busy} loadingText="Checking…" disabled={useRecovery ? recovery.trim().length < 8 : code.length !== 6}>
          Sign in
        </Button>
        <button type="button" className="text-body-lg font-semibold text-ink-brand" onClick={() => (setUseRecovery((v) => !v), setError(null))}>
          {useRecovery ? "Use the authenticator code instead" : "Lost your authenticator? Use a recovery code"}
        </button>
        <Link to="/admin/login" onClick={() => adminStep.clear()} className="text-center text-body-sm text-ink-secondary">
          Start again
        </Link>
      </form>
    </AuthLayout>
  );
}

export function AdminEnrolPage() {
  const step = adminStep.get();
  const finish = useFinishSignIn();
  const [setup, setSetup] = useState<{ otpauthUrl: string; secret: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState<SignedIn | null>(null);

  useEffect(() => {
    if (!step || step.kind !== "enrol" || setup) return;
    adminApi<{ otpauthUrl: string; secret: string }>("/admin/2fa/setup", { method: "POST", body: { stepToken: step.token }, anonymous: true })
      .then((s) => {
        setSetup(s);
        // Drawn here, in the browser: the secret never goes anywhere else.
        return QRCode.toDataURL(s.otpauthUrl, { margin: 1, width: 220 }).then(setQr);
      })
      .catch(setError);
  }, [step, setup]);

  if (!step || step.kind !== "enrol") return done ? null : <Navigate to="/admin/login" replace />;
  if (done && done.recoveryCodes) return <RecoveryCodes codes={done.recoveryCodes} email={step.email} onDone={() => finish(done)} />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await adminApi<SignedIn>("/admin/2fa/enable", { method: "POST", body: { stepToken: step.token, code }, anonymous: true });
      setDone(res);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthLayout panel="security" kicker="Set up two-step sign-in" title="Scan the QR code" subtitle="Use an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…). Then enter the 6-digit code it shows." mobileSubtitle="Scan with your authenticator app, then enter its code.">
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-line-card bg-surface-card p-4">
          {qr ? <img src={qr} alt="QR code for your authenticator app" className="size-52" /> : <div className="size-52 animate-pulse rounded-lg bg-surface-pale" aria-label="Preparing the QR code" />}
          {setup && (
            <details className="w-full text-body-sm text-ink-secondary">
              <summary className="cursor-pointer font-semibold text-ink-brand">Can't scan? Enter this key instead</summary>
              <code className="mt-2 block [overflow-wrap:anywhere] rounded-md bg-surface-pale p-2 text-body-sm text-ink-strong">{setup.secret.replace(/(.{4})/g, "$1 ").trim()}</code>
            </details>
          )}
        </div>
        <OtpInput value={code} onChange={setCode} label="Code from your authenticator app" />
        {error ? <AuthNote tone="danger">{adminError(error)}</AuthNote> : null}
        <Button type="submit" fullWidth loading={busy} loadingText="Checking…" disabled={code.length !== 6 || !setup}>
          Turn on two-step sign-in
        </Button>
      </form>
    </AuthLayout>
  );
}

/** Shown once: 10 recovery codes. The admin confirms they've saved them. */
export function RecoveryCodes({ codes, email, onDone }: { codes: string[]; email: string; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = `BiManage admin recovery codes for ${email}\nEach code works once. Keep them somewhere safe and private.\n\n${codes.join("\n")}\n`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "bimanage-admin-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <AuthLayout panel="security" kicker="Two-step sign-in is on" title="Save your recovery codes" subtitle="If you lose your phone, each code lets you sign in once. They won't be shown again.">
      <div className="flex flex-col gap-4">
        <ol className="grid grid-cols-2 gap-2 rounded-xl border border-line-card bg-surface-card p-4 font-mono text-body-lg text-ink-strong">
          {codes.map((c) => (
            <li key={c} className="rounded-md bg-surface-pale px-2 py-1 text-center">
              {c}
            </li>
          ))}
        </ol>
        <div className="grid gap-2 md:grid-cols-2">
          <Button variant="secondary" onClick={() => void copy()}>
            {copied ? "Copied" : "Copy codes"}
          </Button>
          <Button variant="secondary" onClick={download}>
            Download as a file
          </Button>
        </div>
        <label className="flex items-start gap-3 text-body-lg text-ink-strong">
          <input type="checkbox" className="mt-1 size-5" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          I've saved these codes somewhere safe.
        </label>
        <Button fullWidth disabled={!saved} onClick={onDone}>
          Continue to admin
        </Button>
      </div>
    </AuthLayout>
  );
}
