import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AuthActions, AuthLayout, AuthNote } from "@/components/layout/AuthLayout";
import { CodeInput } from "@/components/auth/CodeInput";
import { Button, ButtonLink, Field } from "@/components/ui";
import { authApi, isExpiredCodeError } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { pendingInvite } from "@/lib/auth/pending";
import { ApiError } from "@/lib/api/client";
import { cooldownMessage, errorMessage } from "@/lib/api/errorMessage";

// 01.03 Verify email, 01.07 Code expired, 01.13 Invalid code
// (Figma 1882:1456 / 1888:2922, 1929:1387 / 1929:1434, 01.13).
const RESEND_WAIT_S = 30; // codes are limited to 5 attempts per 10 minutes per account

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { signIn } = useAuth();
  const email = params.get("email") ?? "";

  const [code, setCode] = useState("");
  const [state, setState] = useState<"idle" | "invalid" | "expired">("idle");
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  // Arriving from sign-in with an unverified account: the original code may be stale.
  const fromLogin = (location.state as { fromLogin?: boolean } | null)?.fromLogin;

  if (!email) {
    return (
      <AuthLayout panel="security" kicker="One more step" title="Verify your email" subtitle="We need the email address you registered with.">
        <ButtonLink to="/register" fullWidth>
          Back to create account
        </ButtonLink>
      </AuthLayout>
    );
  }

  const verify = async () => {
    if (code.length !== 6) {
      setState("invalid");
      setMessage({ tone: "danger", text: "Enter all six digits of the code." });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await authApi.verifyEmail(email, code);
      await signIn(res.token);
      navigate(pendingInvite.get() ? "/invite/accept" : "/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && isExpiredCodeError(err.message)) {
        setState("expired");
        setMessage(null);
      } else if (err instanceof ApiError && /already verified/i.test(err.message)) {
        navigate(`/login?email=${encodeURIComponent(email)}`, { replace: true });
      } else if (err instanceof ApiError && err.status === 400) {
        setState("invalid");
        setMessage({ tone: "danger", text: "The code is incorrect. Check the six digits and try again." });
      } else if (err instanceof ApiError && err.status === 429) {
        setMessage({ tone: "danger", text: cooldownMessage(err) });
      } else {
        setMessage({ tone: "danger", text: errorMessage(err) });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setMessage(null);
    try {
      await authApi.resendVerification(email);
      setState("idle");
      setCode("");
      setWait(RESEND_WAIT_S);
      setMessage({ tone: "success", text: `A new code is on its way to ${email}.` });
    } catch (err) {
      if (err instanceof ApiError && /already verified/i.test(err.message)) {
        navigate(`/login?email=${encodeURIComponent(email)}`, { replace: true });
        return;
      }
      setMessage({ tone: "danger", text: err instanceof ApiError && err.status === 429 ? cooldownMessage(err) : errorMessage(err) });
    } finally {
      setResending(false);
    }
  };

  const expired = state === "expired";

  return (
    <AuthLayout
      panel="security"
      kicker="One more step"
      title={expired ? "Verification code expired" : "Verify your email"}
      subtitle={expired ? `The code sent to ${email} has expired.` : `Enter the six-digit code sent to ${email}.`}
    >
      <form
        noValidate
        className="flex flex-col gap-4 lg:gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (expired) void resend();
          else void verify();
        }}
      >
        <div className="flex flex-col gap-3.5 rounded-lg border border-line-default bg-surface-card p-5 lg:border-0 lg:bg-transparent lg:p-0">
          <Field label="Verification code" required error={state === "invalid" ? message?.text : undefined}>
            <CodeInput
              value={code}
              autoFocus
              disabled={expired}
              onChange={(e) => {
                setCode(e.target.value);
                if (state === "invalid") setState("idle");
              }}
            />
          </Field>
        </div>
        {fromLogin && state === "idle" && !message && (
          <AuthNote>Your email isn't verified yet. Enter the code we sent, or request a new one.</AuthNote>
        )}
        {message && state !== "invalid" && <AuthNote tone={message.tone}>{message.text}</AuthNote>}

        {expired ? (
          <Button type="submit" fullWidth loading={resending} loadingText="Sending…">
            Resend security code
          </Button>
        ) : (
          <Button type="submit" fullWidth loading={submitting} loadingText="Verifying…">
            Verify email
          </Button>
        )}

        <AuthActions>
          {!expired && (
            <Button variant="secondary" size="md" onClick={resend} disabled={resending || wait > 0}>
              {wait > 0 ? `Resend code in ${wait}s` : "Resend code"}
            </Button>
          )}
          <ButtonLink to="/register" variant="secondary" size="md">
            Change email
          </ButtonLink>
        </AuthActions>

        <AuthNote tone="success">
          {expired ? "Expired codes cannot be used. Request a new code above." : "Code expires in 10 minutes. You can request a new code now."}
        </AuthNote>
        <AuthNote className="hidden lg:block">Verified email is required before entering your business workspace.</AuthNote>
      </form>
    </AuthLayout>
  );
}
