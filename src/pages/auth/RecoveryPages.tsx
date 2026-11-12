import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthActions, AuthLayout, AuthNote, InfoRow } from "@/components/layout/AuthLayout";
import { CodeInput } from "@/components/auth/CodeInput";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { Button, ButtonLink, Field, PasswordInput, TextInput, buttonClasses } from "@/components/ui";
import { authApi, isExpiredCodeError } from "@/lib/auth/api";
import { newPasswordSchema } from "@/lib/auth/password";
import { SUPPORT_EMAIL } from "@/config/links";
import { ApiError } from "@/lib/api/client";
import { cooldownMessage, errorMessage } from "@/lib/api/errorMessage";

// Password recovery. The backend emails a 6-digit code (not a link), so the
// Figma "link" screens are adapted: 01.09 "Check your email" also takes the
// code, and 01.10 "Invalid reset link" covers an expired reset session.
// The 15-minute reset token lives only in router state (memory), never the URL.

interface RecoveryState {
  email?: string;
  resetToken?: string;
}
const useRecoveryState = () => (useLocation().state ?? {}) as RecoveryState;

const BackToSignIn = () => (
  <ButtonLink to="/login" variant="secondary" size="md">
    Back to sign in
  </ButtonLink>
);

// 01.04 Forgot password · 01.11 Sending · 01.14 Request failed
export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const initial = useRecoveryState().email ?? "";
  const [failed, setFailed] = useState<string | null>(null);
  const schema = z.object({ email: z.string().trim().min(1, "Enter your email address.").email("Enter a valid email address.") });
  const { register, handleSubmit, formState } = useForm<{ email: string }>({
    resolver: zodResolver(schema),
    defaultValues: { email: initial },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setFailed(null);
    try {
      await authApi.forgotPassword(email.trim());
      navigate("/forgot-password/code", { state: { email: email.trim() } satisfies RecoveryState });
    } catch (err) {
      const fallback = "Your request could not be sent. Please try again."; // 01.14
      if (err instanceof ApiError && err.status === 429) setFailed(cooldownMessage(err));
      else if (err instanceof ApiError && err.status === 400) setFailed(errorMessage(err, fallback));
      else setFailed(errorMessage(err, fallback));
    }
  });

  const sending = formState.isSubmitting;
  return (
    <AuthLayout
      panel="security"
      kicker={sending ? "Secure recovery" : "Account recovery"}
      title="Reset your password"
      subtitle={sending ? "Your reset request is being processed." : "Enter the email linked to your account."}
      mobileSubtitle={sending ? "Your reset request is being processed." : "Enter the email on your account."}
    >
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4 lg:gap-5">
        <div className="flex flex-col gap-3.5 rounded-lg border border-line-default bg-surface-card p-5 lg:border-0 lg:bg-transparent lg:p-0">
          <Field label="Email address" required error={formState.errors.email?.message}>
            <TextInput type="email" autoComplete="email" inputMode="email" autoFocus disabled={sending} {...register("email")} />
          </Field>
        </div>
        {failed && <AuthNote tone="danger">{failed}</AuthNote>}
        {sending && <AuthNote>This may take a few seconds. Please wait before trying again.</AuthNote>}
        <Button type="submit" fullWidth loading={sending} loadingText="Sending…">
          {failed ? "Try again" : "Send reset code"}
        </Button>
        <AuthActions>
          <BackToSignIn />
        </AuthActions>
        <AuthNote tone="success">For privacy, we don't reveal whether an email is registered.</AuthNote>
        <AuthNote className="hidden lg:block">We'll send a 6-digit code when an eligible account is found.</AuthNote>
      </form>
    </AuthLayout>
  );
}

// 01.09 Check your email — enter the code from the email.
export function ResetCodePage() {
  const navigate = useNavigate();
  const { email } = useRecoveryState();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  if (!email) return <ResetExpired />;

  const submit = async () => {
    if (code.length !== 6) return setError("Enter all six digits of the code.");
    setSubmitting(true);
    setError(null);
    try {
      const { resetToken } = await authApi.verifyResetCode(email, code);
      navigate("/reset-password", { replace: true, state: { email, resetToken } satisfies RecoveryState });
    } catch (err) {
      if (err instanceof ApiError && isExpiredCodeError(err.message)) setError("This code has expired. Send a new one below.");
      else if (err instanceof ApiError && err.status === 400) setError("The code is incorrect. Check the six digits and try again.");
      else if (err instanceof ApiError && err.status === 429) setError(cooldownMessage(err));
      else setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setError(null);
    try {
      await authApi.forgotPassword(email);
      setCode("");
      setNotice("If an eligible account exists, a new code has been sent.");
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? cooldownMessage(err) : "Your request could not be sent. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout panel="security" kicker="Account recovery" title="Check your email" subtitle="If an eligible account exists, we've sent a 6-digit code to reset your password.">
      <form
        noValidate
        className="flex flex-col gap-4 lg:gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <InfoRow label="Email entered">{email}</InfoRow>
        <div className="rounded-lg border border-line-default bg-surface-card p-5 lg:border-0 lg:bg-transparent lg:p-0">
          <Field label="Reset code" required error={error ?? undefined}>
            <CodeInput value={code} autoFocus onChange={(e) => setCode(e.target.value)} />
          </Field>
        </div>
        {notice && <AuthNote tone="success">{notice}</AuthNote>}
        <Button type="submit" fullWidth loading={submitting} loadingText="Checking…">
          Continue
        </Button>
        <AuthActions>
          <BackToSignIn />
          <Button variant="secondary" size="md" onClick={resend} loading={resending} loadingText="Sending…">
            Resend code
          </Button>
        </AuthActions>
        <AuthNote>For privacy, we don't confirm whether an account exists. If you requested a code recently, wait a moment before sending another.</AuthNote>
      </form>
    </AuthLayout>
  );
}

// 01.05 Choose a new password · 01.12 Passwords do not match · 01.10 expired
export function NewPasswordPage() {
  const navigate = useNavigate();
  const { email, resetToken } = useRecoveryState();
  const [expired, setExpired] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, watch, formState } = useForm<z.infer<typeof newPasswordSchema>>({
    resolver: zodResolver(newPasswordSchema),
  });
  const password = watch("password") ?? "";

  if (!resetToken || expired) return <ResetExpired email={email} />;

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null);
    try {
      await authApi.resetPassword(resetToken, password);
      navigate("/reset-password/done", { replace: true, state: { email } satisfies RecoveryState });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setExpired(true);
      else setFormError(errorMessage(err));
    }
  });

  return (
    <AuthLayout
      panel="security"
      kicker="Secure recovery"
      title="Choose a new password"
      subtitle="Use 8+ characters with mixed character types."
    >
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4 lg:gap-5">
        {formError && <AuthNote tone="danger">{formError}</AuthNote>}
        <div className="flex flex-col gap-3.5 rounded-lg border border-line-default bg-surface-card p-5 lg:gap-5 lg:border-0 lg:bg-transparent lg:p-0">
          <Field label="New password" required error={formState.errors.password?.message}>
            <PasswordInput autoComplete="new-password" autoFocus {...register("password")} />
          </Field>
          <Field label="Confirm password" required error={formState.errors.confirm?.message}>
            <PasswordInput autoComplete="new-password" {...register("confirm")} />
          </Field>
          <PasswordStrength password={password} />
        </div>
        <Button type="submit" fullWidth loading={formState.isSubmitting} loadingText="Updating…">
          Update password
        </Button>
        <AuthActions>
          <BackToSignIn />
        </AuthActions>
        <AuthNote tone="success">Choose a password you have not used on this account.</AuthNote>
        <AuthNote>Other sessions may need to sign in again after a password change.</AuthNote>
      </form>
    </AuthLayout>
  );
}

// 01.10 Invalid / expired reset
function ResetExpired({ email }: { email?: string }) {
  return (
    <AuthLayout panel="security" kicker="Account recovery" title="This reset has expired" subtitle="Reset codes and sessions only last a short time. Request a new code to continue.">
      <div className="flex flex-col gap-4 lg:gap-5">
        {email && <InfoRow label="Destination email">{email}</InfoRow>}
        <InfoRow label="Next step">Request a new code, then use the latest email in your inbox.</InfoRow>
        <ButtonLink to="/forgot-password" state={{ email } satisfies RecoveryState} fullWidth>
          Request new code
        </ButtonLink>
        <AuthActions>
          <BackToSignIn />
        </AuthActions>
      </div>
    </AuthLayout>
  );
}

// 01.06 Password changed
export function PasswordChangedPage() {
  const { email } = useRecoveryState();
  return (
    <AuthLayout
      panel="security"
      kicker="Account recovery complete"
      title="Password successfully updated"
      mobileTitle="Password updated"
      subtitle="Your account is protected with your new password."
      mobileSubtitle="Your account can now be accessed securely."
    >
      <div className="flex flex-col gap-4 lg:gap-5">
        {email && <InfoRow label="Account">{email}</InfoRow>}
        <InfoRow label="Security status">Password change complete</InfoRow>
        <ButtonLink to={email ? `/login?email=${encodeURIComponent(email)}` : "/login"} fullWidth className="mt-2 lg:mt-10">
          Back to sign in
        </ButtonLink>
        <AuthActions>
          <a href={`mailto:${SUPPORT_EMAIL}`} className={buttonClasses({ variant: "secondary", size: "md" })}>
            Need help? Contact support
          </a>
        </AuthActions>
        <AuthNote tone="success">Sign in again with your new password to access your BiManage workspace.</AuthNote>
      </div>
    </AuthLayout>
  );
}
