import { useState } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AuthActions, AuthLayout, AuthNote, InfoRow } from "@/components/layout/AuthLayout";
import { Button, ButtonLink, Spinner } from "@/components/ui";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { useAuth } from "@/lib/auth/AuthProvider";
import { safeNext } from "@/lib/auth/pending";
import { longDate, restoreAccount, useClosureStatus } from "@/lib/account/api";

// Public account screens: 13.07 Session expired, and the account closure
// states (13.08): "closing" (restore during the grace period) and "closed".

// 13.07 Session expired (Figma 1879:3434 / 1888:2805)
export function SessionExpiredPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"), "");
  return (
    <AuthLayout
      panel="security"
      kicker="Session expired"
      title="Your session has expired"
      subtitle="For security, sign in again to continue."
      mobileSubtitle="For security, sign in again to continue."
    >
      <div className="flex flex-col gap-4 lg:gap-5">
        <AuthNote>Your saved business information remains unchanged.</AuthNote>
        <InfoRow label="Session">Ended on this device</InfoRow>
        <InfoRow label="Why">The password was changed, or all other devices were signed out.</InfoRow>
        <InfoRow label="Protected data">Saved safely</InfoRow>
        <ButtonLink to={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} fullWidth className="mt-2">
          Sign in again
        </ButtonLink>
        <AuthActions>
          <ButtonLink to="/forgot-password" variant="secondary" size="md">
            Reset password
          </ButtonLink>
        </AuthActions>
        <AuthNote tone="success">If you didn't make this change, reset your password straight away.</AuthNote>
      </div>
    </AuthLayout>
  );
}

// Signed in to an account in its closure grace period: keep it, or sign out.
export function AccountClosingPage() {
  const navigate = useNavigate();
  const { status, purgeAt, signIn, endLocal } = useAuth();
  const closure = useClosureStatus(status === "closing");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center text-ink-brand" role="status">
        <Spinner className="size-8" />
        <span className="sr-only">Loading…</span>
      </div>
    );
  }
  if (status === "authenticated" && !busy) return <Navigate to="/dashboard" replace />;
  if (status === "anonymous") return <Navigate to="/login" replace />;

  const when = longDate(closure.data?.purgeAt ?? purgeAt);

  const keep = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await restoreAccount();
      await signIn(res.token);
      navigate("/dashboard", { replace: true, state: { restored: true, planNote: res.planNote ?? null } });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      panel="security"
      kicker="Account closing"
      title="Your account is closing"
      subtitle={when ? `It will be removed on ${when}. You can still keep it.` : "You can still keep it."}
      mobileSubtitle={when ? `It will be removed on ${when}.` : undefined}
    >
      <div className="flex flex-col gap-4 lg:gap-5">
        {when && <InfoRow label="Removal date">{when}</InfoRow>}
        <InfoRow label="Until then">Your store is offline and your team can't sign in.</InfoRow>
        <InfoRow label="If you keep it">Your store, your team's access and your plan come back as they were.</InfoRow>
        <ErrorNote error={error} fallback="We couldn't restore your account. Please try again." />
        <Button fullWidth loading={busy} loadingText="Restoring…" onClick={() => void keep()}>
          Keep my account
        </Button>
        <AuthActions>
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              endLocal("closed");
              navigate("/login", { replace: true });
            }}
          >
            Sign out
          </Button>
        </AuthActions>
        <AuthNote>Financial records, such as invoices and payment history, are kept as the law requires.</AuthNote>
      </div>
    </AuthLayout>
  );
}

// Shown right after closing (everyone is signed out).
export function AccountClosedPage() {
  const location = useLocation();
  const purgeAt = (location.state as { purgeAt?: string } | null)?.purgeAt ?? null;
  const when = longDate(purgeAt);
  return (
    <AuthLayout panel="security" kicker="Account closure" title="Your account is closing" subtitle="You've been signed out on every device.">
      <div className="flex flex-col gap-4 lg:gap-5">
        {when && <InfoRow label="Removal date">{when}</InfoRow>}
        <InfoRow label="Changed your mind?">Sign in before the removal date and choose Keep my account.</InfoRow>
        <InfoRow label="Email">We've sent you the details, and a reminder will follow 7 days before removal.</InfoRow>
        <ButtonLink to="/login" fullWidth className="mt-2">
          Back to sign in
        </ButtonLink>
        <AuthNote>Financial records, such as invoices and payment history, are kept as the law requires.</AuthNote>
      </div>
    </AuthLayout>
  );
}
