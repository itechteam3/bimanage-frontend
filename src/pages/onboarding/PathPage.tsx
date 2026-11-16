import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { IconArrowRight, IconCheck } from "@tabler/icons-react";
import { Button } from "@/components/ui";
import { IntroCard, InfoStrip, PageTitle } from "@/components/page/Blocks";
import { AuthNote } from "@/components/layout/AuthLayout";
import { useOnboardingStatus, useSelectPath, useStartTrial } from "@/lib/workspace/api";
import { ApiError } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errorMessage";
import { useAuth } from "@/lib/auth/AuthProvider";
import { authApi } from "@/lib/auth/api";
import { LEGAL_LAST_UPDATED } from "@/config/legal";

// 02.06B "Compare onboarding paths" (Figma 2234:676): starting a business
// (paid 30-day startup package) or existing business (14-day free trial).
function PathCard({
  eyebrow,
  title,
  offer,
  body,
  points,
  cta,
  onChoose,
  busy,
}: {
  eyebrow: string;
  title: string;
  offer: string;
  body: string;
  points: string[];
  cta: string;
  onChoose: () => void;
  busy: boolean;
}) {
  return (
    <section className="flex flex-col rounded-2xl border border-line-card bg-surface-card p-5 shadow-card lg:p-6">
      <p className="text-caption font-semibold uppercase text-ink-brand">{eyebrow}</p>
      <h2 className="mt-3 text-title-sm text-ink-strong">{title}</h2>
      <p className="mt-4 text-title-md text-ink-brand">{offer}</p>
      <p className="mt-3 text-body-sm text-ink-muted">{body}</p>
      <ul className="mt-6 flex flex-1 flex-col gap-2">
        {points.map((p) => (
          <li key={p} className="flex items-center gap-2 rounded-lg bg-surface-pale px-3 py-4 text-body-sm font-medium text-ink-strong">
            <IconCheck aria-hidden="true" className="size-4 shrink-0 text-ink-strong" />
            {p}
          </li>
        ))}
      </ul>
      <Button className="mt-2" fullWidth onClick={onChoose} loading={busy} loadingText="One moment…">
        {cta} <IconArrowRight aria-hidden="true" className="size-4" />
      </Button>
    </section>
  );
}

export function PathPage() {
  const navigate = useNavigate();
  const status = useOnboardingStatus();
  const selectPath = useSelectPath();
  const startTrial = useStartTrial();
  const [busy, setBusy] = useState<"startup" | "existing" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Google sign-ups have no sign-up form, so they agree to the terms here
  // (POST /auth/accept-terms) before choosing a path.
  const { user, refresh } = useAuth();
  const needsTerms = Boolean(user) && !user?.termsAcceptedAt;
  const [agreed, setAgreed] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);

  /** Records the agreement first if it's still needed; false = stop. */
  const termsOk = async () => {
    if (!needsTerms) return true;
    if (!agreed) {
      setTermsError("Tick the box to agree to the Terms of Service and Privacy Policy.");
      return false;
    }
    await authApi.acceptTerms(LEGAL_LAST_UPDATED);
    void refresh();
    return true;
  };

  const chooseStartup = async () => {
    setBusy("startup");
    setError(null);
    try {
      if (!(await termsOk())) return;
      await selectPath.mutateAsync("startup");
      navigate("/onboarding/packages");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const chooseExisting = async () => {
    setBusy("existing");
    setError(null);
    try {
      if (!(await termsOk())) return;
      await selectPath.mutateAsync("existing_business");
      if (!status.data?.isTrialUsed) await startTrial.mutateAsync();
      navigate("/onboarding/trial");
    } catch (err) {
      if (err instanceof ApiError && /already been used/i.test(err.message)) {
        setError("Your free trial has already been used. Choose a subscription plan to continue.");
      } else setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Compare onboarding paths</PageTitle>
      <IntroCard eyebrow="First things first" title="Which of these sounds most like your business?">
        We'll guide you through the setup process, whichever path you choose.
      </IntroCard>
      {error && <AuthNote tone="danger">{error}</AuthNote>}
      {needsTerms && (
        <div className="flex flex-col gap-1 rounded-xl border border-line-card bg-surface-card p-4">
          <label className="flex cursor-pointer items-start gap-3 text-body-lg text-ink-strong">
            <input
              type="checkbox"
              className="mt-0.5 size-5 shrink-0 accent-brand-navy"
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked);
                if (e.target.checked) setTermsError(null);
              }}
              aria-invalid={termsError ? true : undefined}
              aria-describedby={termsError ? "path-terms-error" : undefined}
            />
            <span>
              I agree to the{" "}
              <Link to="/terms" target="_blank" rel="noreferrer" className="font-semibold text-ink-brand underline">Terms of Service</Link>{" "}
              and{" "}
              <Link to="/privacy" target="_blank" rel="noreferrer" className="font-semibold text-ink-brand underline">Privacy Policy</Link>
              <span className="sr-only"> (open in a new tab)</span>
            </span>
          </label>
          {termsError && (
            <p id="path-terms-error" role="alert" className="text-body-sm text-danger">{termsError}</p>
          )}
        </div>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-2">
        <PathCard
          eyebrow="Startup path"
          title="I'm starting a new business"
          offer="30-day startup package"
          body="Get your operations, first products and online store off the ground."
          points={["Starter / Standard / Premium packages", "One-time package prices apply", "30 days of package access"]}
          cta="Explore startup packages"
          onChoose={chooseStartup}
          busy={busy === "startup"}
        />
        <PathCard
          eyebrow="Existing business"
          title="I already run a business"
          offer="14-day free trial"
          body="Explore the platform before choosing an ongoing subscription."
          points={["Try the full feature set", "Bring products and team details", "Choose a plan after the trial"]}
          cta="Start existing-business setup"
          onChoose={chooseExisting}
          busy={busy === "existing"}
        />
      </div>
      <InfoStrip title="About startup access" tone="warm">
        Startup packages offer one-time paid access for 30 days. Compare package benefits before choosing what fits your business.
      </InfoStrip>
    </div>
  );
}
