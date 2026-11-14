import { Link, useNavigate } from "react-router-dom";
import { IconArrowRight, IconCheck } from "@tabler/icons-react";
import { ButtonLink, Spinner, buttonClasses } from "@/components/ui";
import { InfoStrip, IntroCard, PageTitle, Panel, Stepper, TipList } from "@/components/page/Blocks";
import { AuthNote } from "@/components/layout/AuthLayout";
import { BusinessProfileForm } from "@/components/business/BusinessProfileForm";
import { useBusinessProfile, useOnboardingStatus, useSetupSteps } from "@/lib/workspace/api";
import { errorMessage } from "@/lib/api/errorMessage";
import { cn } from "@/lib/cn";

const Loading = () => (
  <div className="flex justify-center py-16 text-ink-brand" role="status">
    <Spinner className="size-8" />
    <span className="sr-only">Loading…</span>
  </div>
);

// 02.01 Existing business — trial started (Figma 1683:2318)
export function TrialStartedPage() {
  const status = useOnboardingStatus();
  const days = status.data?.daysRemainingTrial ?? 14;
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Trial started</PageTitle>
      <IntroCard eyebrow="Onboarding / Existing business" title="Your business trial has started.">
        Explore BiManage with {days} days of full-feature trial access.
      </IntroCard>
      <Stepper steps={["Account", "Business profile", "First product", "Online store"]} current={0} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel title="Your first steps" subtitle="Work through the built-in seven-step setup tracker.">
          <div className="flex flex-col gap-4">
            <div className="rounded-xl bg-surface-pale px-4 py-4">
              <p className="text-caption font-semibold uppercase text-ink-brand">Free exploration period</p>
              <p className="mt-2 text-title-md text-ink-brand lg:text-metric">{days} days</p>
            </div>
            <ol className="grid grid-cols-[3rem_1fr] gap-y-3 text-body-lg">
              {["Create and verify your account", "Add your business profile and logo", "Add a product and create an order", "Set up your online store"].map((s, i) => (
                <li key={s} className="contents">
                  <span className="text-ink-muted">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-ink-strong">{s}</span>
                </li>
              ))}
            </ol>
            <ButtonLink to="/onboarding/business" fullWidth>
              Continue setting up <IconArrowRight aria-hidden="true" className="size-4" />
            </ButtonLink>
          </div>
        </Panel>
        <TipList
          title="What you can explore"
          tips={[
            { title: "Run your operations", body: "Work with inventory, orders and projects." },
            { title: "Meet FELI", body: "Ask about your business and its activity." },
            { title: "Create your storefront", body: "Set up products and the online store." },
          ]}
        />
      </div>
      <InfoStrip
        title="You'll choose a plan later"
        action={
          <Link to="/subscription" className={buttonClasses({ variant: "secondary", size: "md" })}>
            View subscription plans
          </Link>
        }
      >
        Existing-business users get a 14-day trial before choosing a subscription. We'll remind you before the trial ends.
      </InfoStrip>
    </div>
  );
}

// 02.03 Complete business identity (Figma 1897:2548)
export function BusinessIdentityPage() {
  const navigate = useNavigate();
  const profile = useBusinessProfile();

  if (profile.isLoading) return <Loading />;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        actions={
          <ButtonLink to="/onboarding/checklist" className="hidden lg:inline-flex">
            Setup checklist
          </ButtonLink>
        }
      >
        Tell us about your business
      </PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Set up your identity for orders, invoices and your online store.</p>
      <IntroCard eyebrow="Workspace / Onboarding" title="The same information is reused across BiManage modules." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <BusinessProfileForm profile={profile.data} title="Business identity setup" submitLabel="Save and continue" onSaved={() => navigate("/onboarding/checklist")}>
          <div className="mt-6 rounded-xl bg-surface-pale p-4">
            <p className="text-caption font-semibold uppercase text-ink-brand">Setup progress</p>
            <p className="mt-2 text-body-lg text-ink-strong">Complete your business identity before publishing or billing.</p>
            <ol className="mt-2 flex flex-col gap-1 text-body-sm text-ink-strong">
              <li>01 Complete business profile</li>
              <li>02 Verify contact and registration</li>
              <li>03 Continue setup checklist</li>
            </ol>
          </div>
        </BusinessProfileForm>
        <Panel tone="pale" title="Help and requirements">
          <dl className="flex flex-col gap-4">
            {[
              ["Used for", "Invoices • Storefront • Suppliers"],
              ["Verification", "CAC data may need review"],
              ["Next", "Add products and set up your store"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-md bg-surface-card px-3 py-2">
                <dt className="text-caption font-semibold uppercase text-ink-muted">{k}</dt>
                <dd className="text-body-lg text-ink-strong">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 rounded-xl border border-line-card bg-surface-card p-4">
            <p className="text-caption font-semibold uppercase text-ink-brand">Next steps</p>
            <p className="mt-2 text-body-lg text-ink-strong">Add stock, launch a store and invite your teammates.</p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

// 02.05 Setup tracker (Figma 1683:2488)
export function ChecklistPage() {
  const steps = useSetupSteps();
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Your business setup checklist</PageTitle>
      <IntroCard eyebrow="Welcome to BiManage" title="Seven small steps. One ready-to-run business.">
        Your progress updates automatically as you finish the steps.
      </IntroCard>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Setup progress" subtitle={steps.data ? `${steps.data.completedCount} of ${steps.data.totalSteps} complete — finish each step when you're ready.` : "Complete each step when you're ready."}>
          {steps.isLoading && <Loading />}
          {steps.error && <AuthNote tone="danger">{errorMessage(steps.error)}</AuthNote>}
          <ol className="flex flex-col gap-2.5">
            {steps.data?.steps.map((s, i) => (
              <li key={s.key}>
                <Link
                  to={s.link}
                  className={cn(
                    "flex items-center gap-6 rounded-lg px-4 py-5 transition-colors",
                    s.completed ? "bg-kpi-revenue-bg" : "bg-surface-pale hover:bg-surface-tonal"
                  )}
                >
                  <span className={cn("w-6 text-body-lg font-semibold", s.completed ? "text-success" : "text-ink-brand")}>
                    {s.completed ? <IconCheck aria-label="Done" className="size-5" stroke={2.5} /> : String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 text-body-lg font-medium text-ink-strong">
                    {s.label}
                    <span className="sr-only">{s.completed ? " (done)" : " (to do)"}</span>
                  </span>
                  {!s.completed && <IconArrowRight aria-hidden="true" className="size-4 text-ink-brand" />}
                </Link>
              </li>
            ))}
          </ol>
          {steps.data?.isComplete && (
            <ButtonLink to="/dashboard" fullWidth className="mt-5">
              Go to your dashboard
            </ButtonLink>
          )}
        </Panel>
        <TipList
          title="A stronger business starts here"
          tips={[
            { title: "Set up your identity", body: "Your profile details appear on your invoices, store and marketplace account." },
            { title: "Build your catalogue", body: "Products power your orders, stock tracking and online storefront." },
            { title: "Make your first sale", body: "Creating your first order connects sales with inventory." },
            { title: "Go live at your pace", body: "Continue your setup later from this tracker." },
          ]}
        />
      </div>
    </div>
  );
}
