import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { IconArrowRight, IconCheck, IconPhoto } from "@tabler/icons-react";
import { Button, ButtonLink, Field, SelectInput, Spinner, TextInput, buttonClasses } from "@/components/ui";
import { InfoStrip, IntroCard, PageTitle, Panel, Stepper, TipList } from "@/components/page/Blocks";
import { AuthNote } from "@/components/layout/AuthLayout";
import {
  BUSINESS_CATEGORIES,
  BUSINESS_TYPES,
  useBusinessProfile,
  useOnboardingStatus,
  useSaveBusinessProfile,
  useSetupSteps,
  useUploadLogo,
} from "@/lib/workspace/api";
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
const schema = z.object({
  businessName: z.string().trim().min(2, "Enter your legal business name.").max(100, "Keep it under 100 characters."),
  businessType: z.string().min(1, "Choose your business type."),
  businessCategory: z.string().min(1, "Choose a category."),
  cacNumber: z.string().trim().max(30).optional(),
  businessPhone: z.string().trim().min(7, "Enter a phone number.").max(20, "That phone number looks too long."),
  businessEmail: z.string().trim().min(1, "Enter a business email.").email("Enter a valid email address."),
  businessAddress: z.string().trim().max(200).optional(),
});
type Values = z.infer<typeof schema>;

export function BusinessIdentityPage() {
  const navigate = useNavigate();
  const profile = useBusinessProfile();
  const save = useSaveBusinessProfile();
  const upload = useUploadLogo();
  const fileRef = useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!profile.data) return;
    const p = profile.data;
    reset({
      businessName: p.businessName ?? "",
      businessType: p.businessType ?? "",
      businessCategory: p.businessCategory ?? "",
      cacNumber: p.cacNumber ?? "",
      businessPhone: p.businessPhone ?? "",
      businessEmail: p.businessEmail ?? "",
      businessAddress: p.businessAddress ?? "",
    });
  }, [profile.data, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const body = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "" && v !== undefined));
    try {
      await save.mutateAsync(body);
      navigate("/onboarding/checklist");
    } catch (err) {
      setFormError(errorMessage(err));
    }
  });

  const onLogo = async (file: File | undefined) => {
    setLogoError(null);
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(file.type)) return setLogoError("Use a PNG, JPG, WebP or SVG image.");
    if (file.size > 2 * 1024 * 1024) return setLogoError("Keep the logo under 2 MB.");
    try {
      await upload.mutateAsync(file);
    } catch (err) {
      setLogoError(errorMessage(err));
    }
  };

  if (profile.isLoading) return <Loading />;
  const logo = profile.data?.logo;

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
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
          <Panel title="Business identity setup" subtitle="Required details are marked with an asterisk.">
            <div className="grid gap-4 md:grid-cols-2 md:gap-x-10 md:gap-y-6">
              <Field label="Legal business name" required error={formState.errors.businessName?.message}>
                <TextInput autoComplete="organization" placeholder="Elijah Apparel Ltd" {...register("businessName")} />
              </Field>
              <Field label="Business type" required error={formState.errors.businessType?.message}>
                <SelectInput {...register("businessType")}>
                  <option value="">Choose…</option>
                  {BUSINESS_TYPES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Business category" required error={formState.errors.businessCategory?.message}>
                <SelectInput {...register("businessCategory")}>
                  <option value="">Choose…</option>
                  {BUSINESS_CATEGORIES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="CAC number" error={formState.errors.cacNumber?.message}>
                <TextInput placeholder="RC 1234567" {...register("cacNumber")} />
              </Field>
              <Field label="Phone number" required error={formState.errors.businessPhone?.message}>
                <TextInput type="tel" autoComplete="tel" inputMode="tel" placeholder="+234 803 555 0190" {...register("businessPhone")} />
              </Field>
              <Field label="Email address" required error={formState.errors.businessEmail?.message}>
                <TextInput type="email" autoComplete="email" inputMode="email" placeholder="hello@yourbusiness.com" {...register("businessEmail")} />
              </Field>
              <Field label="Business address" error={formState.errors.businessAddress?.message}>
                <TextInput autoComplete="street-address" placeholder="14 Adebayo St, Yaba" {...register("businessAddress")} />
              </Field>
              <Field label="Business logo" error={logoError ?? undefined} hint={upload.isPending ? "Uploading…" : logo ? "Logo uploaded." : undefined}>
                <div className="flex items-center gap-3 lg:h-control-lg lg:rounded-sm lg:border lg:border-line-default lg:bg-surface-card lg:pl-2 lg:pr-1.5">
                  {logo ? (
                    <img src={logo} alt="Current logo" className="size-9 rounded-md object-contain" />
                  ) : (
                    <IconPhoto aria-hidden="true" className="size-6 text-ink-muted" />
                  )}
                  <button type="button" onClick={() => fileRef.current?.click()} className="flex-1 text-left text-input font-normal text-ink-strong lg:font-medium" disabled={upload.isPending}>
                    {upload.isPending ? "Uploading…" : logo ? "Replace logo" : "Upload brand logo"}
                  </button>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" tabIndex={-1} onChange={(e) => void onLogo(e.target.files?.[0])} />
                </div>
              </Field>
            </div>
            <div className="mt-6 rounded-xl bg-surface-pale p-4">
              <p className="text-caption font-semibold uppercase text-ink-brand">Setup progress</p>
              <p className="mt-2 text-body-lg text-ink-strong">Complete your business identity before publishing or billing.</p>
              <ol className="mt-2 flex flex-col gap-1 text-body-sm text-ink-strong">
                <li>01 Complete business profile</li>
                <li>02 Verify contact and registration</li>
                <li>03 Continue setup checklist</li>
              </ol>
            </div>
          </Panel>
          {formError && <AuthNote tone="danger">{formError}</AuthNote>}
          <Button type="submit" className="self-end" loading={formState.isSubmitting} loadingText="Saving…">
            Save and continue
          </Button>
        </form>
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
