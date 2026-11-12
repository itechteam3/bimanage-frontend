import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconCheck, IconCircleDashed, IconCopy, IconExternalLink, IconLock, IconWorld } from "@tabler/icons-react";
import { Button, ButtonLink, Dialog, Field, SelectInput, Status, TextArea, TextInput } from "@/components/ui";
import { HelpPanel, IntroCard, KpiCard, PageTitle, Panel } from "@/components/page/Blocks";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { useAuth } from "@/lib/auth/AuthProvider";
import { applyFieldErrors } from "@/lib/api/errorMessage";
import { ApiError } from "@/lib/api/client";
import { naira } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useLeaveGuard } from "@/lib/nav/useLeaveGuard";
import {
  STORE_CATEGORIES,
  useCreateStore,
  useDomain,
  useDomainActions,
  useLaunchChecklist,
  useMyStore,
  usePublish,
  useSetTemplate,
  useTemplates,
  useUpdateStore,
  type ChecklistStep,
  type DomainState,
  type Store,
  type TemplateKey,
} from "@/lib/store/api";
import { Loading, StoreTabs, WithStore, opsEyebrow, storefrontPath } from "./shared";

const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
const money = z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : Number(String(v).replace(/[₦,\s]/g, ""))), z.number({ invalid_type_error: "Enter an amount." }).min(0, "Can't be negative.").optional());

// ── 08.01 Create storefront ───────────────────────────────────────────────

const createSchema = z.object({
  storeName: z.string().trim().min(2, "Enter your store name.").max(50, "Keep it under 50 characters."),
  category: z.string().min(1, "Choose a business category."),
  description: z.string().trim().min(10, "Describe your store in a sentence or two.").max(500, "Keep it under 500 characters."),
  contactEmail: z.string().trim().email("Enter a valid email address."),
  contactPhone: z.string().trim().max(20).optional(),
});
type CreateValues = z.infer<typeof createSchema>;

export function CreateStorePage() {
  const navigate = useNavigate();
  const mine = useMyStore();
  const { user } = useAuth();
  const create = useCreateStore();
  const [formError, setFormError] = useState<unknown>(null);
  const { register, handleSubmit, watch, setError, reset, formState } = useForm<CreateValues>({ resolver: zodResolver(createSchema), defaultValues: { storeName: "", category: "", description: "", contactEmail: "", contactPhone: "" } });
  const guard = useLeaveGuard(formState.isDirty && !formState.isSubmitSuccessful);
  useEffect(() => {
    if (user?.email) reset({ storeName: "", category: "", description: "", contactEmail: user.email, contactPhone: "" });
  }, [user?.email, reset]);

  if (mine.isLoading) return <Loading />;
  if (mine.data) return <Navigate to="/store" replace />;

  const name = watch("storeName") ?? "";
  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    try {
      await create.mutateAsync({ ...v, contactPhone: v.contactPhone || undefined });
      guard.allow();
      navigate("/store", { replace: true });
    } catch (err) {
      if (!applyFieldErrors(err, setError, ["storeName", "category", "description", "contactEmail", "contactPhone"])) setFormError(err);
    }
  });

  return (
    <div className="flex flex-col gap-6">
      {guard.dialog}
      <PageTitle>Create your online store</PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Set up a storefront customers can buy from without an account.</p>
      <IntroCard eyebrow="Store operations / New store" title="Your store starts as a draft. Only you can see it until you publish." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
          <Panel title="Store details" subtitle="Fields marked * are required.">
            <div className="grid gap-4 md:grid-cols-2 md:gap-x-10 md:gap-y-6">
              <Field label="Store name" required error={formState.errors.storeName?.message}>
                <TextInput placeholder="Elijah Apparel" autoComplete="organization" {...register("storeName")} />
              </Field>
              <Field label="Business category" required error={formState.errors.category?.message}>
                <SelectInput {...register("category")}>
                  <option value="">Choose a category</option>
                  {STORE_CATEGORIES.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Store description" required error={formState.errors.description?.message} className="md:col-span-2">
                <TextArea rows={3} placeholder="Linen shirts and everyday essentials, made in Lagos." {...register("description")} />
              </Field>
              <Field label="Business email" required error={formState.errors.contactEmail?.message} hint="Customers reply to this address.">
                <TextInput type="email" autoComplete="email" {...register("contactEmail")} />
              </Field>
              <Field label="Support phone" error={formState.errors.contactPhone?.message}>
                <TextInput type="tel" autoComplete="tel" placeholder="+234 803 000 0000" {...register("contactPhone")} />
              </Field>
              <Field label="Free store URL" hint="Your link on BiManage. You can add your own domain later." className="md:col-span-2">
                <TextInput readOnly value={`${window.location.origin}/s/${slugOf(name) || "yourstore"}`} />
              </Field>
            </div>
          </Panel>
          <ErrorNote error={formError} fallback="We couldn't create your store. Please try again." />
          <Button type="submit" loading={create.isPending} loadingText="Creating store…" className="md:self-end md:px-10">
            Create store
          </Button>
        </form>
        <HelpPanel
          items={[
            ["Starts as", "Draft (private)"],
            ["Checkout", "Guest checkout, no customer account needed"],
            ["Payments", "Paystack"],
            ["Next", "Add products, choose a template, publish"],
          ]}
        />
      </div>
    </div>
  );
}

// ── 08.02 Launch checklist (the store's start view) ──────────────────────

const STEP_LINK: Record<ChecklistStep["key"], string | null> = {
  identity: "/store/settings",
  template: "/store/templates",
  products: "/store/products",
  checkout: null,
};

export function StoreOverviewPage() {
  return <WithStore>{(store) => <StoreOverview store={store} />}</WithStore>;
}

function StoreOverview({ store }: { store: Store }) {
  const checklist = useLaunchChecklist();
  const publish = usePublish();
  const [error, setError] = useState<unknown>(null);
  const [confirmDraft, setConfirmDraft] = useState(false);
  const c = checklist.data;
  const live = c?.status === "published";

  const run = async (on: boolean) => {
    setError(null);
    try {
      await publish.mutateAsync(on);
      setConfirmDraft(false);
    } catch (err) {
      // Plan limits open the upgrade dialog; anything else shows here.
      if (!(err instanceof ApiError && err.status === 403)) setError(err);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        actions={
          <ButtonLink to={storefrontPath(store)} size="md" variant={live ? "primary" : "secondary"}>
            {live ? "Visit store" : "Preview store"} <IconExternalLink aria-hidden="true" className="size-4" />
          </ButtonLink>
        }
      >
        {live ? "Your store is live" : "Ready to launch?"}
      </PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">{live ? "Customers can visit your store and buy from it." : "Finish every step before sharing your store."}</p>
      <StoreTabs />
      <IntroCard eyebrow={opsEyebrow(store)} title="All critical store settings in one place." />
      {checklist.isLoading ? (
        <Loading />
      ) : !c ? (
        <ErrorNote error={checklist.error ?? true} fallback="We couldn't load your launch checklist." onRetry={() => void checklist.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <KpiCard tone="invoices" label="Completion" value={`${c.percent}%`} caption={`${c.completed} of ${c.total} steps`} />
            <KpiCard tone="stock" label="Products" value={String(c.products.total)} caption={`${c.products.published} published`} />
            <KpiCard tone="orders" label="Template" value={c.template.name} caption={c.plan.name} />
            <KpiCard tone="revenue" label="Status" value={live ? "Live" : "Draft"} caption={live ? "Published" : "Not published"} />
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Panel title="Store readiness" subtitle="Required steps must be done before you publish.">
              <ul className="flex flex-col gap-2">
                {c.steps.map((s) => {
                  const to = STEP_LINK[s.key];
                  return (
                    <li key={s.key} className="grid grid-cols-[auto_1fr] items-start gap-3 rounded-md bg-surface-pale px-4 py-3 md:grid-cols-[auto_1.3fr_1fr_1.4fr_auto] md:items-center">
                      {s.done ? <IconCheck aria-hidden="true" className="mt-0.5 size-5 text-success md:mt-0" /> : <IconCircleDashed aria-hidden="true" className="mt-0.5 size-5 text-ink-muted md:mt-0" />}
                      <p className="font-semibold text-ink-strong">
                        {s.label}
                        <span className="sr-only">{s.done ? " — done" : " — to do"}</span>
                        {!s.required && <span className="ml-2 text-caption font-normal text-ink-muted">(optional)</span>}
                      </p>
                      <p className="col-start-2 text-body-sm text-ink-secondary md:col-start-auto">{s.value}</p>
                      <p className="col-start-2 text-body-sm text-ink-muted md:col-start-auto">{s.detail}</p>
                      <span className="col-start-2 md:col-start-auto">
                        {to && !s.done ? (
                          <Link to={to} className="text-action font-semibold text-ink-brand hover:underline">
                            Fix
                          </Link>
                        ) : to ? (
                          <Link to={to} className="text-action text-ink-brand hover:underline">
                            Edit
                          </Link>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <ErrorNote error={error} fallback="We couldn't update your store. Please try again." className="mt-4" />
              <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
                {live ? (
                  <Button variant="secondary" onClick={() => setConfirmDraft(true)}>
                    Switch back to draft
                  </Button>
                ) : (
                  <Button onClick={() => void run(true)} loading={publish.isPending} loadingText="Publishing…" disabled={!c.canPublish}>
                    Publish store
                  </Button>
                )}
                {!live && !c.canPublish && <p className="text-body-sm text-ink-muted">{c.blockers[0]}</p>}
                {!live && !c.plan.canPublish && (
                  <ButtonLink to="/subscription" variant="tonal" size="md">
                    <IconLock aria-hidden="true" className="size-4" /> See plans
                  </ButtonLink>
                )}
              </div>
            </Panel>
            <Panel tone="pale" title="Next actions and insights">
              <dl className="flex flex-col gap-3">
                {[
                  ["Store URL", <a key="u" href={c.storeUrl} className="break-all text-ink-brand hover:underline">{c.storeUrl.replace(/^https?:\/\//, "")}</a>],
                  ["Launch action", c.blockers[0] ?? (live ? "Share your store link" : "Publish your store")],
                  ["Customer checkout", c.paymentsEnabled ? "Guest checkout enabled" : "Payments coming soon"],
                  ["Delivery", store.deliveryFee ? `${naira(store.deliveryFee)} flat${store.freeDeliveryAbove ? `, free above ${naira(store.freeDeliveryAbove)}` : ""}` : "Free delivery"],
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-md bg-surface-card px-3 py-2">
                    <dt className="text-caption font-semibold uppercase text-ink-muted">{k}</dt>
                    <dd className="text-body-lg text-ink-strong">{v}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </div>
        </>
      )}
      <Dialog
        open={confirmDraft}
        onClose={() => setConfirmDraft(false)}
        title="Switch your store back to draft?"
        description="Customers won't be able to open your store or place orders until you publish it again. Existing orders aren't affected."
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmDraft(false)}>
              Keep it live
            </Button>
            <Button variant="destructive" loading={publish.isPending} loadingText="Saving…" onClick={() => void run(false)}>
              Switch to draft
            </Button>
          </>
        }
      />
    </div>
  );
}

// ── Store details & delivery (checklist "Business identity") ─────────────

const settingsSchema = createSchema.extend({
  address: z.string().trim().max(200).optional(),
  deliveryFee: money,
  freeDeliveryAbove: money,
});
type SettingsValues = z.infer<typeof settingsSchema>;

export function StoreSettingsPage() {
  return <WithStore>{(store) => <StoreSettings store={store} />}</WithStore>;
}

function StoreSettings({ store }: { store: Store }) {
  const update = useUpdateStore();
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);
  const defaults = (s: Store): SettingsValues => ({
    storeName: s.storeName,
    category: s.category,
    description: s.description ?? "",
    contactEmail: s.contactEmail ?? "",
    contactPhone: s.contactPhone ?? "",
    address: s.address ?? "",
    deliveryFee: s.deliveryFee ?? 0,
    freeDeliveryAbove: s.freeDeliveryAbove ?? undefined,
  });
  const { register, handleSubmit, reset, setError, formState } = useForm<SettingsValues>({ resolver: zodResolver(settingsSchema), defaultValues: defaults(store) });
  const guard = useLeaveGuard(formState.isDirty);

  const onSubmit = handleSubmit(async (v) => {
    setSaved(false);
    setFormError(null);
    try {
      const next = await update.mutateAsync({ ...v, contactPhone: v.contactPhone ?? "", address: v.address ?? "", deliveryFee: v.deliveryFee ?? 0, freeDeliveryAbove: v.freeDeliveryAbove ?? null });
      reset(defaults({ ...store, ...next }));
      setSaved(true);
    } catch (err) {
      if (!applyFieldErrors(err, setError, ["storeName", "category", "description", "contactEmail", "contactPhone", "address", "deliveryFee", "freeDeliveryAbove"])) setFormError(err);
    }
  });

  return (
    <div className="flex flex-col gap-6">
      {guard.dialog}
      <PageTitle>Store settings</PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Your store's identity, contact details and delivery fee.</p>
      <StoreTabs />
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <Panel title="Business identity" subtitle="Shown on your storefront and order emails.">
          <div className="grid gap-4 md:grid-cols-2 md:gap-x-10 md:gap-y-6">
            <Field label="Store name" required error={formState.errors.storeName?.message}>
              <TextInput {...register("storeName")} />
            </Field>
            <Field label="Business category" required error={formState.errors.category?.message}>
              <SelectInput {...register("category")}>
                {STORE_CATEGORIES.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Store description" required error={formState.errors.description?.message} className="md:col-span-2">
              <TextArea rows={3} {...register("description")} />
            </Field>
            <Field label="Business email" required error={formState.errors.contactEmail?.message}>
              <TextInput type="email" {...register("contactEmail")} />
            </Field>
            <Field label="Support phone" error={formState.errors.contactPhone?.message}>
              <TextInput type="tel" {...register("contactPhone")} />
            </Field>
            <Field label="Address" error={formState.errors.address?.message} className="md:col-span-2">
              <TextInput {...register("address")} />
            </Field>
          </div>
        </Panel>
        <Panel title="Delivery" subtitle="One flat fee per order. Leave the second field empty if delivery is never free.">
          <div className="grid gap-4 md:grid-cols-2 md:gap-x-10">
            <Field label="Delivery fee (NGN)" error={formState.errors.deliveryFee?.message} hint="0 for free delivery.">
              <TextInput inputMode="decimal" {...register("deliveryFee")} />
            </Field>
            <Field label="Free delivery above (NGN)" error={formState.errors.freeDeliveryAbove?.message} hint="Orders at or above this amount ship free.">
              <TextInput inputMode="decimal" placeholder="e.g. 50,000" {...register("freeDeliveryAbove")} />
            </Field>
          </div>
        </Panel>
        <ErrorNote error={formError} fallback="We couldn't save your store settings. Please try again." />
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
          {saved && (
            <p role="status" className="text-body-sm text-success-ink">
              Saved.
            </p>
          )}
          <Button type="submit" loading={update.isPending} loadingText="Saving…" className="md:px-10">
            Save settings
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── 08.08 Template selection ──────────────────────────────────────────────

const TEMPLATE_COPY: Record<TemplateKey, { plan: string; body: string; note: string; tint: string }> = {
  basic: { plan: "Freemium · Included", body: "Clean storefront with products and cart.", note: "Simple layout and checkout.", tint: "bg-surface-pale" },
  standard: { plan: "Standard plan", body: "Editorial collections and enhanced navigation.", note: "Requires Standard or higher.", tint: "bg-surface-tint-blue" },
  premium: { plan: "Premium plan", body: "Richer layout and featured sections.", note: "Requires the Premium plan.", tint: "bg-surface-tint-lavender" },
};

export function TemplatesPage() {
  return <WithStore>{(store) => <Templates store={store} />}</WithStore>;
}

function Templates({ store }: { store: Store }) {
  const templates = useTemplates();
  const choose = useSetTemplate();
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState<TemplateKey | null>(null);

  const pick = async (key: TemplateKey) => {
    setError(null);
    setPending(key);
    try {
      await choose.mutateAsync(key);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 403)) setError(err);
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Choose a storefront template</PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Pick the look that fits your subscription.</p>
      <StoreTabs />
      <IntroCard eyebrow={opsEyebrow(store)} title="Products and checkout stay the same when you switch." />
      {templates.isLoading ? (
        <Loading />
      ) : !templates.data ? (
        <ErrorNote error={templates.error ?? true} fallback="We couldn't load templates." onRetry={() => void templates.refetch()} />
      ) : (
        <>
          <ul className="grid gap-4 md:grid-cols-3">
            {templates.data.templates.map((t) => {
              const copy = TEMPLATE_COPY[t.key];
              const current = templates.data.current === t.key;
              return (
                <li key={t.key} className={cn("flex flex-col rounded-2xl border bg-surface-card p-5 shadow-card", current ? "border-brand-navy" : "border-line-card")}>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-title-md text-ink-strong">{t.name}</h2>
                    {current && <Status tone="success">Current</Status>}
                  </div>
                  <p className="mt-1 text-body-sm font-semibold text-ink-brand">{copy.plan}</p>
                  <div aria-hidden="true" className={cn("mt-4 flex min-h-36 flex-col gap-2 rounded-xl p-4", copy.tint)}>
                    <p className="text-body-lg font-semibold uppercase text-ink-brand">{store.storeName}</p>
                    <p className="text-card-heading text-ink-strong">{t.key === "premium" ? "Featured collection" : "The everyday edit"}</p>
                    <p className="text-caption font-semibold text-ink-brand">Browse collection →</p>
                  </div>
                  <p className="mt-4 text-body-sm text-ink-strong">{copy.body}</p>
                  <p className="mt-1 text-caption text-ink-muted">{copy.note}</p>
                  <div className="mt-auto pt-5">
                    {t.allowed ? (
                      <Button fullWidth variant={current ? "secondary" : "primary"} disabled={current} loading={pending === t.key} loadingText="Saving…" onClick={() => void pick(t.key)}>
                        {current ? "Selected" : `Choose ${t.name}`}
                      </Button>
                    ) : (
                      <ButtonLink to="/subscription" fullWidth variant="tonal">
                        <IconLock aria-hidden="true" className="size-4" /> Upgrade for {t.name}
                      </ButtonLink>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <ErrorNote error={error} fallback="We couldn't change the template. Please try again." />
        </>
      )}
    </div>
  );
}

// ── 08.09 Domains and website settings ────────────────────────────────────

function CopyValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-md bg-surface-pale px-4 py-3">
      <span className="text-caption font-semibold uppercase text-ink-muted">{label}</span>
      <div className="flex items-center justify-between gap-2">
        <code className="min-w-0 break-all text-body-lg font-semibold text-ink-strong">{value}</code>
        <button
          type="button"
          onClick={() => void navigator.clipboard?.writeText(value).then(() => setCopied(true), () => undefined)}
          className="flex min-h-11 shrink-0 items-center gap-1 rounded-sm px-2 text-action font-semibold text-ink-brand hover:bg-surface-tonal"
          aria-label={`Copy ${label.toLowerCase()}`}
        >
          {copied ? <IconCheck aria-hidden="true" className="size-4" /> : <IconCopy aria-hidden="true" className="size-4" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

const domainSchema = z.object({ domain: z.string().trim().min(4, "Enter your domain, for example shop.yourbusiness.com.") });

export function DomainPage() {
  return <WithStore>{(store) => <DomainSettings store={store} />}</WithStore>;
}

type StepState = "done" | "waiting" | "todo";
function Step({ n, title, state, children }: { n: number; title: string; state: StepState; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[auto_1fr] gap-3 rounded-xl bg-surface-pale p-4">
      <span aria-hidden="true" className={cn("flex size-8 items-center justify-center rounded-full text-action font-semibold", state === "done" ? "bg-success text-ink-on-brand" : "bg-surface-card text-ink-brand")}>
        {state === "done" ? <IconCheck className="size-4" /> : n}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-body-lg font-semibold text-ink-strong">{title}</h3>
          <Status tone={state === "done" ? "success" : state === "waiting" ? "warning" : "neutral"}>{state === "done" ? "Done" : state === "waiting" ? "Waiting" : "To do"}</Status>
        </div>
        <div className="mt-2 flex flex-col gap-3 text-body-sm text-ink-secondary">{children}</div>
      </div>
    </li>
  );
}

function DomainSettings({ store }: { store: Store }) {
  const domain = useDomain();
  const { save, verify, remove } = useDomainActions();
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const { register, handleSubmit, reset, setError: setFieldError, formState } = useForm<{ domain: string }>({ resolver: zodResolver(domainSchema), defaultValues: { domain: "" } });
  const guard = useLeaveGuard(formState.isDirty);
  const d: DomainState | undefined = domain.data;
  useEffect(() => {
    reset({ domain: d?.customDomain ?? "" });
  }, [d?.customDomain, reset]);

  if (domain.isLoading) return <Loading />;
  if (!d) return <ErrorNote error={domain.error ?? true} fallback="We couldn't load your domain settings." onRetry={() => void domain.refetch()} />;

  const planAllows = d.planAllows !== false;
  const hosting = d.hosting ?? (d.customDomain ? "pending" : "none");
  const dns = d.dnsInstructions;

  const onSave = handleSubmit(async ({ domain: value }) => {
    setError(null);
    setNotice(null);
    try {
      await save.mutateAsync(value);
      reset({ domain: value.trim().toLowerCase() });
      setNotice("Domain saved. Add the DNS record below at your domain provider, then verify.");
    } catch (err) {
      if (!applyFieldErrors(err, setFieldError, ["domain"]) && !(err instanceof ApiError && err.status === 403)) setError(err);
    }
  });
  const onVerify = async () => {
    setError(null);
    setNotice(null);
    try {
      await verify.mutateAsync();
      setNotice("DNS record found. Your domain is verified.");
    } catch (err) {
      setError(err);
    }
  };
  const onRemove = async () => {
    setError(null);
    try {
      await remove.mutateAsync();
      setConfirmRemove(false);
      setNotice("Custom domain removed. Your store is still at its BiManage address.");
    } catch (err) {
      setConfirmRemove(false);
      setError(err);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {guard.dialog}
      <PageTitle
        actions={
          <ButtonLink to={storefrontPath(store)} size="md">
            Visit store
          </ButtonLink>
        }
      >
        Domains and website settings
      </PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Manage your public address and custom domain.</p>
      <StoreTabs />
      <IntroCard eyebrow={opsEyebrow(store)} title="Custom domains require Standard or Premium." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Panel title="Your addresses" subtitle="The BiManage address always works, on every plan.">
            <div className="flex flex-col gap-4">
              <CopyValue label="BiManage address" value={d.bimanageAddress.replace(/^https?:\/\//, "")} />
              {planAllows ? (
                <form noValidate onSubmit={onSave} className="flex flex-col gap-3 md:flex-row md:items-end">
                  <Field label="Custom domain" error={formState.errors.domain?.message} hint="Use a sub-domain you own, such as shop.yourbusiness.com." className="flex-1">
                    <TextInput placeholder="shop.yourbusiness.com" autoCapitalize="none" spellCheck={false} {...register("domain")} />
                  </Field>
                  <Button type="submit" variant="secondary" size="md" loading={save.isPending} loadingText="Saving…" className="md:mb-0.5">
                    {d.customDomain ? "Change domain" : "Save domain"}
                  </Button>
                </form>
              ) : (
                <div className="flex flex-col gap-3 rounded-md bg-surface-pale px-4 py-3 md:flex-row md:items-center md:justify-between">
                  <p className="text-body-sm text-ink-secondary">Your own domain (like shop.yourbusiness.com) is part of the Standard and Premium plans.</p>
                  <ButtonLink to="/subscription" size="md" variant="tonal">
                    <IconLock aria-hidden="true" className="size-4" /> See plans
                  </ButtonLink>
                </div>
              )}
            </div>
          </Panel>

          {d.customDomain && dns && (
            <Panel title={`Connect ${d.customDomain}`} subtitle="Three steps. Your store keeps working at its BiManage address the whole time.">
              <ol className="flex flex-col gap-3">
                <Step n={1} title="Add this DNS record at your domain provider" state={d.verified ? "done" : "todo"}>
                  <p>
                    Sign in where you bought <strong className="text-ink-strong">{d.customDomain.split(".").slice(-2).join(".")}</strong> (for example GoDaddy, Namecheap, Whogohost or Cloudflare), open its DNS settings and add a new record with exactly these values. Delete any other record for the same host first.
                  </p>
                  <div className="grid gap-2 md:grid-cols-2">
                    <CopyValue label="Type" value={dns.type} />
                    <CopyValue label="Host / name" value={dns.host} />
                    <CopyValue label="Value / target / points to" value={dns.value} />
                    <CopyValue label="TTL" value={`${dns.ttl} (or Automatic)`} />
                  </div>
                  <p>On Cloudflare, set the record to "DNS only" (grey cloud). Some providers want the full name ({dns.name}) instead of just the host; both work.</p>
                </Step>
                <Step n={2} title="Verify the record" state={d.verified ? "done" : "todo"}>
                  <p>{d.verified ? "We found your DNS record." : "DNS changes usually show within an hour, but can take up to 48 hours. You can try as often as you like."}</p>
                  {!d.verified && (
                    <Button onClick={() => void onVerify()} loading={verify.isPending} loadingText="Checking DNS…" className="md:self-start">
                      Verify domain
                    </Button>
                  )}
                </Step>
                <Step n={3} title="BiManage connects your domain to our hosting" state={hosting === "added" ? "done" : "waiting"}>
                  <p>
                    Your domain must also be added to our hosting provider (Vercel) before it can load your store. That issues the free HTTPS certificate. You don't need to do anything: we're notified automatically when you save your domain, and it's usually done within one business day.
                  </p>
                  {hosting !== "added" && <p className="font-semibold text-ink-strong">Status: waiting for BiManage to add {d.customDomain}.</p>}
                </Step>
              </ol>
              <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p role="status" className={cn("flex items-center gap-2 text-body-lg font-semibold", d.live ? "text-success-ink" : "text-ink-secondary")}>
                  <IconWorld aria-hidden="true" className="size-5" />
                  {d.live ? `Live at https://${d.customDomain}` : "Not live on this domain yet"}
                </p>
                <Button variant="secondary" size="md" onClick={() => setConfirmRemove(true)}>
                  Remove domain
                </Button>
              </div>
            </Panel>
          )}
          {notice && (
            <p role="status" className="text-body-sm text-success-ink">
              {notice}
            </p>
          )}
          <ErrorNote error={error} fallback="Something went wrong with your domain. Please try again." />
        </div>
        <HelpPanel
          items={[
            ["Free address", "Works on every plan"],
            ["Custom address", "Standard and Premium"],
            ["DNS record", dns ? `${dns.type} ${dns.host} → ${dns.value}` : "Shown after you save a domain"],
            ["Verification", d.customDomain ? (d.verified ? "Verified" : "Awaiting DNS") : "—"],
            ["Hosting (BiManage)", d.customDomain ? (hosting === "added" ? "Connected" : "Waiting for BiManage") : "—"],
            ["SSL certificate", d.customDomain ? (d.live ? "Active" : "Issued once steps 2 and 3 are done") : "—"],
          ]}
        />
      </div>
      <Dialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        tone="danger"
        title={`Remove ${d.customDomain ?? "this domain"}?`}
        description={`Customers using ${d.customDomain ?? "it"} won't reach your store any more. Your BiManage address keeps working.`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmRemove(false)}>
              Keep domain
            </Button>
            <Button variant="destructive" loading={remove.isPending} loadingText="Removing…" onClick={() => void onRemove()}>
              Remove domain
            </Button>
          </>
        }
      />
    </div>
  );
}
