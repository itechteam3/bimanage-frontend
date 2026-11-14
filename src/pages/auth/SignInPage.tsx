import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout, AuthNote, AuthActions } from "@/components/layout/AuthLayout";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { Button, ButtonLink, Field, PasswordInput, TextInput } from "@/components/ui";
import { authApi } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { pendingInvite, safeNext } from "@/lib/auth/pending";
import { ApiError } from "@/lib/api/client";
import { cooldownMessage, errorMessage } from "@/lib/api/errorMessage";

// 01.01 Sign in, 01.08 Invalid sign-in (Figma 1882:1388 / 1888:2872, 1929:1462 / 1929:1512).
const schema = z.object({
  email: z.string().trim().min(1, "Enter your email address.").email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});
type Values = z.infer<typeof schema>;

const reasonNotice: Record<string, string> = {
  expired: "Your session has expired. Please sign in again.",
  ended: "You were signed out on this device because the password was changed or all other devices were signed out.",
  closed: "Your account is closing. Sign in again any time before the removal date to keep it.",
  suspended: "This account has been suspended. Please contact support for help.",
  "signed-out": "You've signed out.",
};

export function SignInPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { signIn, signOutReason, enterClosing } = useAuth();
  const [invalid, setInvalid] = useState<{ attemptsRemaining?: number } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { register, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: params.get("email") ?? "", password: "" },
  });

  const urlError = params.get("error");
  const notice =
    formError ??
    (urlError === "suspended"
      ? reasonNotice.suspended
      : urlError === "google"
        ? "Google sign-in didn't complete. Please try again."
        : signOutReason
          ? reasonNotice[signOutReason]
          : null);

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    try {
      const res = await authApi.login(email.trim(), password);
      if (res.accountClosing) {
        enterClosing(res.token, res.purgeAt ?? null);
        navigate("/account-closing", { replace: true });
        return;
      }
      await signIn(res.token);
      navigate(pendingInvite.get() ? "/invite/accept" : safeNext(params.get("next"), "/"), { replace: true });
    } catch (err) {
      if (!(err instanceof ApiError)) return setFormError(errorMessage(err));
      if (err.status === 401) {
        setInvalid({ attemptsRemaining: err.data.attemptsRemaining as number | undefined });
      } else if (err.status === 403 && err.data.isVerified === false) {
        navigate(`/verify?email=${encodeURIComponent(email.trim())}`, { state: { fromLogin: true } });
      } else if (err.status === 403 && err.data.suspended) {
        setFormError(reasonNotice.suspended!);
      } else if (err.status === 429) {
        setFormError(cooldownMessage(err));
      } else {
        setFormError(errorMessage(err));
      }
    }
  });

  return (
    <AuthLayout
      panel={invalid ? "security" : "showcase"}
      kicker="Welcome back"
      title={invalid ? "Check your sign-in details" : "Sign in to BiManage"}
      mobileTitle={invalid ? "Check your sign-in details" : "Welcome back"}
      subtitle={invalid ? "The email or password was not recognised. Please try again." : "Access your business workspace securely."}
      mobileSubtitle={
        invalid ? "The details entered do not match. You can reset your password." : "Sign in to your BiManage workspace."
      }
      reassurance={!invalid}
    >
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4 lg:gap-5">
        {notice && <AuthNote tone="danger">{notice}</AuthNote>}
        {invalid?.attemptsRemaining !== undefined && invalid.attemptsRemaining > 0 && (
          <AuthNote tone="danger">
            {invalid.attemptsRemaining} attempt{invalid.attemptsRemaining === 1 ? "" : "s"} left before a short cooldown.
          </AuthNote>
        )}

        <div className="flex flex-col gap-3.5 rounded-lg border border-line-default bg-surface-card p-5 lg:gap-5 lg:border-0 lg:bg-transparent lg:p-0">
          <Field label="Email address" required error={formState.errors.email?.message}>
            <TextInput type="email" autoComplete="email" inputMode="email" autoFocus {...register("email")} />
          </Field>
          <Field
            label="Password"
            required
            error={formState.errors.password?.message}
            hint={<span className="hidden lg:inline">Security: repeated incorrect sign-in attempts trigger a temporary cooldown.</span>}
          >
            <PasswordInput autoComplete="current-password" {...register("password")} />
          </Field>
        </div>

        {!invalid && (
          <div className="order-2 flex flex-col gap-3 lg:order-1">
            <p className="hidden text-field-label uppercase text-ink-secondary lg:block">Or sign in with</p>
            <GoogleButton className="lg:w-fit" />
          </div>
        )}

        <Button type="submit" fullWidth loading={formState.isSubmitting} loadingText="Signing in…" className="order-1 lg:order-2">
          {invalid ? "Try again" : "Sign in"}
        </Button>

        <div className="order-3">
          <AuthActions>
            <ButtonLink to="/forgot-password" variant="secondary" size="md">
              Forgot password?
            </ButtonLink>
            <ButtonLink to="/register" variant="secondary" size="md">
              <span className="lg:hidden">Create account</span>
              <span className="hidden lg:inline">Create an account</span>
            </ButtonLink>
          </AuthActions>
        </div>

        <AuthNote tone="success" className="order-4">
          <span className="lg:hidden">
            {invalid ? "Your account remains protected. Try again or reset your password." : "Your business information remains secured."}
          </span>
          <span className="hidden lg:inline">Your connection is encrypted.</span>
        </AuthNote>
      </form>
    </AuthLayout>
  );
}
