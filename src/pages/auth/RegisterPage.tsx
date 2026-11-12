import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { AuthActions, AuthLayout, AuthNote } from "@/components/layout/AuthLayout";
import { Button, ButtonLink, Field, PasswordInput, TextInput, buttonClasses } from "@/components/ui";
import { authApi } from "@/lib/auth/api";
import { characterTypes, MIN_PASSWORD } from "@/lib/auth/password";
import { LEGAL } from "@/config/links";
import { ApiError } from "@/lib/api/client";
import { cooldownMessage, errorMessage } from "@/lib/api/errorMessage";
import { useLeaveGuard } from "@/lib/nav/useLeaveGuard";

// 01.02 Create an account (Figma 1882:1419 / 1888:2894); mismatch copy from 01.12.
const schema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name (at least 2 characters).").max(50, "Keep your name under 50 characters."),
    email: z.string().trim().min(1, "Enter your work email.").email("Enter a valid email address."),
    password: z
      .string()
      .min(MIN_PASSWORD, "Use at least 8 characters.")
      .refine((pw) => characterTypes(pw) >= 2, "Mix character types — e.g. letters and numbers."),
    confirm: z.string().min(1, "Repeat your password."),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match. Re-enter your password." });
type Values = z.infer<typeof schema>;

// Terms / Privacy buttons appear once BiTechTeam provides the URLs (src/config/links.ts).
const legalLinks = [
  { label: "Terms", href: LEGAL.termsUrl },
  { label: "Privacy Notice", href: LEGAL.privacyUrl },
].filter((l) => l.href);

export function RegisterPage() {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState } = useForm<Values>({ resolver: zodResolver(schema) });
  const guard = useLeaveGuard(formState.isDirty && !formState.isSubmitSuccessful);

  const onSubmit = handleSubmit(async ({ name, email, password }) => {
    setFormError(null);
    try {
      await authApi.register({ name: name.trim(), email: email.trim(), password });
      guard.allow();
      navigate(`/verify?email=${encodeURIComponent(email.trim())}`, { state: { justRegistered: true } });
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && /email already in use/i.test(err.message)) {
        setError("email", { message: "An account with this email already exists. Sign in instead." });
      } else if (err instanceof ApiError && err.status === 429) {
        setFormError(cooldownMessage(err));
      } else {
        setFormError(errorMessage(err));
      }
    }
  });

  return (
    <AuthLayout
      kicker="Get started"
      title="Create your account"
      mobileTitle="Start your business journey"
      subtitle="Build an organised business in one place."
      mobileSubtitle="Create your account to get started."
      reassurance
    >
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4 lg:gap-5">
        {formError && <AuthNote tone="danger">{formError}</AuthNote>}
        <div className="flex flex-col gap-3.5 rounded-lg border border-line-default bg-surface-card p-5 lg:gap-5 lg:border-0 lg:bg-transparent lg:p-0">
          <Field label="Full name" required error={formState.errors.name?.message}>
            <TextInput autoComplete="name" placeholder="Samuel Adebayo" autoFocus {...register("name")} />
          </Field>
          <Field label="Work email" required error={formState.errors.email?.message}>
            <TextInput type="email" autoComplete="email" inputMode="email" placeholder="you@yourbusiness.com" {...register("email")} />
          </Field>
          <Field label="Password" required error={formState.errors.password?.message} hint="8+ characters • mixed character types" hintTone="success">
            <PasswordInput autoComplete="new-password" placeholder="At least 8 characters" {...register("password")} />
          </Field>
          <Field label="Confirm password" required error={formState.errors.confirm?.message}>
            <PasswordInput autoComplete="new-password" placeholder="Repeat your password" {...register("confirm")} />
          </Field>
        </div>

        <Button type="submit" fullWidth loading={formState.isSubmitting} loadingText="Creating account…">
          Create account
        </Button>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <p className="text-body-lg text-ink-brand">Already have an account?</p>
          <ButtonLink to="/login" variant="secondary" size="md" className="lg:w-auth-action">
            Sign in
          </ButtonLink>
        </div>
        <p className="text-body-lg text-ink-brand">By creating an account, you agree to the Terms and Privacy Notice.</p>
        {legalLinks.length > 0 && (
          <AuthActions>
            {legalLinks.map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className={buttonClasses({ variant: "secondary", size: "md" })}>
                {l.label}
              </a>
            ))}
          </AuthActions>
        )}
        <AuthNote>
          <span className="lg:hidden">Next: choose Starting a Business or Existing Business.</span>
          <span className="hidden lg:inline">Next: choose Starting a Business or Existing Business onboarding.</span>
        </AuthNote>
      </form>
      {guard.dialog}
    </AuthLayout>
  );
}
