import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconAlertTriangle, IconBuildingWarehouse, IconCircleCheck, IconEyeOff, IconPhoto, IconTrash, IconX } from "@tabler/icons-react";
import { Button, ButtonLink, Dialog, EmptyState, Field, SelectInput, Status, TextArea, TextInput } from "@/components/ui";
import { HelpPanel, KpiCard, Panel } from "@/components/page/Blocks";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { AttachmentPicker } from "@/components/attachments/AttachmentPicker";
import { applyFieldErrors } from "@/lib/api/errorMessage";
import { useLeaveGuard } from "@/lib/nav/useLeaveGuard";
import { count, naira, nairaCompact, shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Attachment } from "@/lib/attachments";
import {
  CATEGORIES,
  DELIVERY,
  categoryLabel,
  deleteBlocked,
  isNotWholesaler,
  orderStatus,
  trustLevel,
  uploadProductImage,
  useApply,
  useDeleteProduct,
  useIncomingConnections,
  useMyProducts,
  useMyWholesalerProfile,
  useProduct,
  useReceivedOrders,
  useRespondConnection,
  useSaveProduct,
  useScorePreview,
  useSellerDashboard,
  useSetAvailability,
  type ApplicationInput,
  type Delivery,
  type MyWholesalerProfile,
  type ScorePart,
  type SupplyCategory,
  type SupplyProduct,
} from "@/lib/bisupplynet/api";
import { FactsPanel, Heading, Intro, Loading, ProtectionBox, RecordRows, SellTabs, SummaryRows, isNigerianPhone } from "./shared";

// ── /bisupplynet/sell: where a seller lands ──────────────────────────────

export function SellHomePage() {
  const profile = useMyWholesalerProfile();
  if (profile.isLoading) return <Loading label="Loading your seller profile…" />;
  if (profile.error && isNotWholesaler(profile.error)) return <Navigate to="/bisupplynet/sell/apply" replace />;
  if (!profile.data) return <ErrorNote error={profile.error ?? true} fallback="We couldn't load your seller profile." onRetry={() => void profile.refetch()} />;
  return <Navigate to={profile.data.status === "verified" ? "/bisupplynet/sell/earnings" : "/bisupplynet/sell/application"} replace />;
}

// ── 10.03 Wholesaler application ─────────────────────────────────────────

const applySchema = z.object({
  businessName: z.string().trim().min(2, "Enter the registered business name.").max(100, "Keep the name under 100 characters."),
  cacNumber: z.string().trim().max(30, "The CAC number is too long."),
  category: z.string().min(1, "Choose your main supply category."),
  extra: z.array(z.string()).max(2, "Choose up to 2 more categories."),
  state: z.string().trim().min(1, "Enter the state.").max(60, "The state is too long."),
  city: z.string().trim().min(1, "Enter the city.").max(80, "The city is too long."),
  businessAddress: z.string().trim().min(5, "Enter the full business address.").max(300, "The address is too long."),
  businessEmail: z.string().trim().email("Enter a valid business email."),
  phone: z.string().trim().refine(isNigerianPhone, "Enter a valid Nigerian phone number, e.g. 0803 123 4567."),
  minimumOrderQuantity: z.coerce.number({ invalid_type_error: "Enter a minimum order quantity." }).int("Use a whole number.").min(1, "The minimum order is at least 1."),
  deliveryCapability: z.string(),
  deliveryTimeline: z.string().trim().max(100, "Keep this under 100 characters."),
  description: z.string().trim().max(300, "Keep the description under 300 characters."),
});
type ApplyForm = z.infer<typeof applySchema>;

/** A short delay, so the live score isn't asked for on every key press. */
function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  const json = JSON.stringify(value);
  useEffect(() => {
    const t = setTimeout(() => setV(JSON.parse(json) as T), ms);
    return () => clearTimeout(t);
  }, [json, ms]);
  return v;
}

export function ApplyPage() {
  const profile = useMyWholesalerProfile();
  if (profile.isLoading) return <Loading label="Loading your seller profile…" />;
  const notYet = profile.error && isNotWholesaler(profile.error);
  if (!notYet && !profile.data) return <ErrorNote error={profile.error ?? true} fallback="We couldn't load your seller profile." onRetry={() => void profile.refetch()} />;
  if (profile.data && profile.data.status !== "rejected") return <Navigate to="/bisupplynet/sell/application" replace />;
  return <ApplyFormView previous={profile.data ?? null} />;
}

function ApplyFormView({ previous }: { previous: MyWholesalerProfile | null }) {
  const navigate = useNavigate();
  const apply = useApply();
  const [doc, setDoc] = useState<Attachment[]>(previous?.verificationDocument?.url ? [{ url: previous.verificationDocument.url, name: previous.verificationDocument.name ?? "Verification document", type: previous.verificationDocument.type ?? "", size: 0 }] : []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const p = previous;
  const { register, handleSubmit, control, formState, setError: setFieldError, setValue } = useForm<ApplyForm>({
    resolver: zodResolver(applySchema),
    defaultValues: {
      businessName: p?.businessName ?? "",
      cacNumber: p?.cacNumber ?? "",
      category: p?.category ?? "",
      extra: (p?.categories ?? []).filter((c) => c !== p?.category).slice(0, 2),
      state: p?.state ?? "",
      city: p?.city ?? "",
      businessAddress: p?.businessAddress ?? "",
      businessEmail: p?.businessEmail ?? "",
      phone: p?.businessPhone ?? "",
      minimumOrderQuantity: p?.minimumOrderQuantity ?? ("" as unknown as number),
      deliveryCapability: p?.deliveryCapability ?? "state",
      deliveryTimeline: p?.deliveryTimeline ?? "",
      description: p?.description ?? "",
    },
  });
  const guard = useLeaveGuard((formState.isDirty || (doc.length > 0 && !previous)) && !formState.isSubmitSuccessful);
  const values = useWatch({ control });
  const params = useMemo(() => {
    const out: Record<string, string> = {};
    for (const k of ["businessName", "cacNumber", "category", "state", "city", "businessAddress", "businessEmail", "phone", "description", "deliveryCapability"] as const) {
      const v = values[k];
      if (typeof v === "string" && v.trim()) out[k] = v.trim();
    }
    if (values.minimumOrderQuantity) out.minimumOrderQuantity = String(values.minimumOrderQuantity);
    if (doc[0]) out.verificationDocument = doc[0].url;
    return out;
  }, [values, doc]);
  const preview = useScorePreview(useDebounced(params));
  const score = preview.data;
  const e = formState.errors;
  const extra = values.extra ?? [];

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    const body: ApplicationInput = {
      businessName: v.businessName,
      ...(v.cacNumber ? { cacNumber: v.cacNumber } : {}),
      category: v.category as SupplyCategory,
      categories: [v.category, ...v.extra].filter((c, i, a) => a.indexOf(c) === i) as SupplyCategory[],
      state: v.state,
      city: v.city,
      businessAddress: v.businessAddress,
      businessEmail: v.businessEmail,
      phone: v.phone,
      minimumOrderQuantity: Number(v.minimumOrderQuantity),
      ...(v.deliveryCapability ? { deliveryCapability: v.deliveryCapability as Delivery } : {}),
      ...(v.deliveryTimeline ? { deliveryTimeline: v.deliveryTimeline } : {}),
      ...(v.description ? { description: v.description } : {}),
      verificationDocument: doc[0] ? { url: doc[0].url, name: doc[0].name, type: doc[0].type } : null,
    };
    try {
      await apply.mutateAsync(body);
      guard.allow();
      navigate("/bisupplynet/sell/application", { replace: true, state: { submitted: true } });
    } catch (err) {
      if (!applyFieldErrors(err, setFieldError, ["businessName", "cacNumber", "category", "state", "city", "businessAddress", "businessEmail", "phone", "minimumOrderQuantity", "deliveryCapability", "deliveryTimeline", "description"])) setError(err);
    }
  });

  return (
    <div className="flex flex-col gap-6">
      {guard.dialog}
      <Heading title={previous ? "Apply again as a wholesaler" : "Apply as a wholesaler"} subtitle="Submit your business details for BiSupplyNet verification." />
      <Intro>Strong, complete profiles with a valid CAC number and a verification document may be approved automatically.</Intro>
      {previous?.rejectionReason && (
        <p role="status" className="break-words rounded-xl bg-surface-tint-warm px-5 py-3 text-body-sm text-ink-strong">
          Your last application wasn't approved: {previous.rejectionReason}
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <form noValidate onSubmit={onSubmit} className="flex min-w-0 flex-col gap-5">
          <Panel title="Business verification" subtitle="Accurate business details improve your trust assessment.">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-x-10 md:gap-y-6">
              <Field label="Registered business name" required error={e.businessName?.message}>
                <TextInput maxLength={100} {...register("businessName")} />
              </Field>
              <Field label="CAC registration number" hint="RC, BN or IT followed by the number" error={e.cacNumber?.message}>
                <TextInput maxLength={30} placeholder="RC 1234567" {...register("cacNumber")} />
              </Field>
              <Field label="Supply category" required error={e.category?.message}>
                <SelectInput {...register("category")}>
                  <option value="">Choose a category</option>
                  {CATEGORIES.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="State / region" required error={e.state?.message}>
                <TextInput maxLength={60} placeholder="Lagos" {...register("state")} />
              </Field>
              <Field label="City" required error={e.city?.message}>
                <TextInput maxLength={80} placeholder="Ikeja" {...register("city")} />
              </Field>
              <Field label="Business address" required error={e.businessAddress?.message}>
                <TextInput maxLength={300} autoComplete="street-address" {...register("businessAddress")} />
              </Field>
              <Field label="Email address" required error={e.businessEmail?.message}>
                <TextInput type="email" autoComplete="email" {...register("businessEmail")} />
              </Field>
              <Field label="Business phone" required error={e.phone?.message}>
                <TextInput type="tel" autoComplete="tel" placeholder="0803 123 4567" {...register("phone")} />
              </Field>
              <Field label="Usual minimum order" required error={e.minimumOrderQuantity?.message}>
                <TextInput type="number" inputMode="numeric" min={1} {...register("minimumOrderQuantity")} />
              </Field>
              <Field label="Delivery" error={e.deliveryCapability?.message}>
                <SelectInput {...register("deliveryCapability")}>
                  {DELIVERY.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Delivery time" hint="For example: 3 to 5 business days" error={e.deliveryTimeline?.message}>
                <TextInput maxLength={100} {...register("deliveryTimeline")} />
              </Field>
              <Field label="Profile trust score">
                <TextInput value={score ? `${score.profileScore}%` : "Working it out…"} readOnly aria-live="polite" />
              </Field>
              <fieldset className="min-w-0 md:col-span-2">
                <legend className="text-field-label uppercase text-ink-secondary">More categories (up to 2, optional)</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CATEGORIES.filter(([k]) => k !== values.category).map(([k, l]) => {
                    const on = extra.includes(k);
                    return (
                      <label key={k} className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-body-sm", on ? "border-brand-navy bg-surface-tint-blue text-ink-brand" : "border-line-default text-ink-strong")}>
                        <input
                          type="checkbox"
                          className="size-4 accent-brand-navy"
                          checked={on}
                          disabled={!on && extra.length >= 2}
                          onChange={(ev) => setValue("extra", ev.target.checked ? [...extra, k] : extra.filter((x) => x !== k), { shouldDirty: true })}
                        />
                        {l}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <Field label="About your business" hint="Optional, up to 300 characters" error={e.description?.message} className="md:col-span-2">
                <TextArea rows={3} maxLength={300} {...register("description")} />
              </Field>
              <div className="min-w-0 md:col-span-2">
                <AttachmentPicker label="Verification document" value={doc} onChange={setDoc} onBusy={setUploading} max={1} />
                <p className="mt-2 text-body-sm text-ink-muted">Your CAC certificate or another document that proves the business is registered.</p>
              </div>
            </div>
            <div className="mt-6">
              <ProtectionBox />
            </div>
          </Panel>
          <ErrorNote error={error} fallback="We couldn't send your application. Please try again." />
          <Button type="submit" className="md:self-end md:px-10" loading={apply.isPending} loadingText="Submitting…" disabled={uploading}>
            Submit application
          </Button>
        </form>
        <div className="flex min-w-0 flex-col gap-5">
          <HelpPanel
            items={[
              ["Auto approval", "High scores with a valid CAC number and document"],
              ["Manual review", "Incomplete details or a low score"],
              ["Profile fields", "Business identity and contact"],
              ["Application status", score?.autoApprove ? "Ready for automatic approval" : "Will be reviewed by BiTechTeam"],
            ]}
          />
          <ScoreBreakdown score={score?.profileScore} parts={score?.breakdown} reasons={score?.reviewReasons} />
        </div>
      </div>
    </div>
  );
}

function ScoreBreakdown({ score, parts, reasons, title = "Live profile score" }: { score?: number; parts?: ScorePart[]; reasons?: string[]; title?: string }) {
  return (
    <section aria-label={title} className="min-w-0 rounded-2xl border border-line-card bg-surface-card p-4 shadow-card">
      <p className="text-caption font-semibold uppercase text-ink-brand">{title}</p>
      <p className="mt-1 text-title-md text-ink-strong">{score === undefined ? "…" : `${score}%`}</p>
      {parts && (
        <ul className="mt-3 flex flex-col gap-2 text-body-sm">
          {parts.map((p) => (
            <li key={p.key} className="flex items-start justify-between gap-3">
              <span className={cn("flex min-w-0 items-start gap-2 break-words", p.earned ? "text-ink-strong" : "text-ink-muted")}>
                {p.earned ? <IconCircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" /> : <IconX aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
                {p.label ?? p.key}
              </span>
              <span className="shrink-0 text-ink-muted">
                {p.earned}/{p.points}
              </span>
            </li>
          ))}
        </ul>
      )}
      {reasons && reasons.length > 0 && (
        <div className="mt-3 rounded-lg bg-surface-pale px-3 py-2 text-caption text-ink-muted">
          <p className="font-semibold text-ink-strong">Why it would go to review</p>
          <ul className="mt-1 list-disc pl-4">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ── 10.04 Application review ─────────────────────────────────────────────

const APP_STATUS = { pending: "In review", verified: "Approved", rejected: "Not approved" } as const;

export function ApplicationPage() {
  const profile = useMyWholesalerProfile();
  if (profile.isLoading) return <Loading label="Loading your application…" />;
  if (profile.error && isNotWholesaler(profile.error)) return <Navigate to="/bisupplynet/sell/apply" replace />;
  if (!profile.data) return <ErrorNote error={profile.error ?? true} fallback="We couldn't load your application." onRetry={() => void profile.refetch()} />;
  const a = profile.data;
  const title = a.status === "verified" ? "Application approved" : a.status === "rejected" ? "Application not approved" : "Application in review";
  const card = a.status === "verified" ? "You're a verified wholesaler" : a.status === "rejected" ? "Your application needs changes" : "Wholesaler verification pending";
  const action =
    a.status === "rejected" ? (
      <ButtonLink to="/bisupplynet/sell/apply" size="md">
        Apply again
      </ButtonLink>
    ) : a.status === "verified" ? (
      <ButtonLink to="/bisupplynet/sell/listings" size="md">
        Manage listings
      </ButtonLink>
    ) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <Heading title={title} subtitle={a.submittedAt ? `Your wholesaler profile was submitted on ${shortDate(a.submittedAt)}.` : "Your wholesaler profile has been submitted."} action={action} />
      {a.status === "verified" && <SellTabs />}
      <Intro>{a.status === "pending" ? "You will be notified once verification is finished." : a.status === "verified" ? "Buyers can now find you and order your listings." : "Update your details and apply again whenever you're ready."}</Intro>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-2xl border border-line-card bg-surface-card p-5 shadow-card lg:p-10">
          <h2 className="text-title-md text-ink-strong lg:text-page-title">{card}</h2>
          <p className="mt-3 text-body-lg text-ink-muted">{a.status === "pending" ? "We are checking your business profile and supporting information." : a.status === "verified" ? "Add wholesale listings to start taking orders." : "BiTechTeam reviewed your details and couldn't approve them yet."}</p>
          <div className="mt-5">
            <SummaryRows
              rows={[
                ["Application reference", a.reference ?? "Not given yet"],
                ["Business", a.businessName],
                ["Profile score", `${a.profileScore}%`],
                ["Current status", APP_STATUS[a.status] ?? a.status],
                ...(a.status === "rejected" && a.rejectionReason ? ([["Reason", a.rejectionReason]] as Array<[string, ReactNode]>) : []),
              ]}
            />
          </div>
          {a.status === "pending" && <p className="mt-4 text-body-sm font-semibold text-ink-brand">You will be notified once verification is finished.</p>}
          <div className="mt-4 rounded-xl bg-surface-tint-blue px-4 py-4">
            <p className="text-caption font-semibold uppercase text-ink-brand">Verification rule</p>
            <p className="mt-2 text-body-lg text-ink-strong">High scores with a valid CAC number and a verification document can be approved automatically.</p>
            <p className="mt-1 text-body-sm text-ink-muted">Incomplete or failed checks are verified by BiTechTeam.</p>
          </div>
        </section>
        <ScoreBreakdown title="Profile score" score={a.profileScore} parts={a.breakdown} />
      </div>
    </div>
  );
}

// ── Listings ─────────────────────────────────────────────────────────────

export function ListingsPage() {
  const products = useMyProducts();
  const availability = useSetAvailability();
  const remove = useDeleteProduct();
  const [deleting, setDeleting] = useState<SupplyProduct | null>(null);
  const [blocked, setBlocked] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const photoFailed = (useLocation().state as { imageProblem?: string[] } | null)?.imageProblem;

  const close = () => {
    setDeleting(null);
    setBlocked(null);
  };
  const doDelete = async () => {
    if (!deleting) return;
    setError(null);
    try {
      await remove.mutateAsync(deleting._id);
      setNotice(`${deleting.name} was deleted.`);
      close();
    } catch (err) {
      const b = deleteBlocked(err);
      if (b) setBlocked(b.openOrders);
      else {
        close();
        setError(err);
      }
    }
  };
  const hide = async (p: SupplyProduct, isAvailable: boolean) => {
    setError(null);
    try {
      await availability.mutateAsync({ id: p._id, isAvailable });
      setNotice(isAvailable ? `${p.name} is visible to buyers again.` : `${p.name} is hidden from buyers. Open orders carry on as normal.`);
      close();
    } catch (err) {
      close();
      setError(err);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Heading
        title="Your wholesale listings"
        subtitle="Products other businesses can order from you in bulk."
        action={
          <ButtonLink to="/bisupplynet/sell/listings/new" size="md">
            + Add wholesale listing
          </ButtonLink>
        }
      />
      <SellTabs />
      <Intro>Buyers pay into escrow. You're paid when they confirm delivery.</Intro>
      {notice && (
        <p role="status" className="text-body-sm text-success-ink">
          {notice}
        </p>
      )}
      {photoFailed?.length ? (
        <p role="alert" className="break-words text-body-sm text-danger">
          The listing is saved, but we couldn't upload {photoFailed.join(", ")}. Edit the listing to try again.
        </p>
      ) : null}
      <ErrorNote error={error} fallback="We couldn't update this listing. Please try again." />
      <Panel>
        {products.isLoading ? (
          <Loading label="Loading your listings…" />
        ) : products.error ? (
          <ErrorNote error={products.error} fallback="We couldn't load your listings." onRetry={() => void products.refetch()} />
        ) : !products.data?.length ? (
          <EmptyState
            className="border-0 p-0"
            icon={<IconBuildingWarehouse className="size-7" />}
            title="No listings yet"
            body="Add your first wholesale product with its price, minimum order and stock."
            action={<ButtonLink to="/bisupplynet/sell/listings/new" size="md">Add a listing</ButtonLink>}
          />
        ) : (
          <ul aria-label="Your listings" className="flex flex-col divide-y divide-line-subtle">
            {products.data.map((p) => (
              <li key={p._id} className="grid grid-cols-[minmax(0,1fr)] gap-3 py-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-center lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
                <div className="flex min-w-0 items-center gap-3">
                  {p.images[0] ? <img src={p.images[0]} alt="" className="size-12 shrink-0 rounded-md object-cover" /> : <span aria-hidden="true" className="size-12 shrink-0 rounded-md bg-surface-tint-blue" />}
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-ink-strong">{p.name}</p>
                    <p className="text-body-sm text-ink-muted">{categoryLabel(p.category)}</p>
                  </div>
                </div>
                <div className="min-w-0 text-body-sm">
                  <p className="text-ink-strong">
                    {naira(p.pricePerUnit)} per {p.unit}
                  </p>
                  <p className="text-ink-muted">
                    MOQ {count(p.minimumOrderQuantity)} • {count(p.availableQuantity)} in stock
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:col-span-2 lg:col-span-1 lg:justify-end">
                  <Status tone={p.isAvailable ? "success" : "neutral"}>{p.isAvailable ? "Visible" : "Hidden"}</Status>
                  <ButtonLink to={`/bisupplynet/sell/listings/${p._id}/edit`} size="md" variant="outlined">
                    Edit <span className="sr-only">{p.name}</span>
                  </ButtonLink>
                  <Button size="md" variant="secondary" onClick={() => void hide(p, !p.isAvailable)} disabled={availability.isPending}>
                    {p.isAvailable ? "Hide" : "Show"} <span className="sr-only">{p.name}</span>
                  </Button>
                  <Button size="md" variant="secondary" className="text-danger" aria-label={`Delete ${p.name}`} onClick={() => setDeleting(p)}>
                    <IconTrash aria-hidden="true" className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Dialog
        open={Boolean(deleting)}
        onClose={close}
        tone={blocked === null ? "danger" : "default"}
        icon={blocked === null ? <IconTrash aria-hidden="true" className="size-7" /> : <IconEyeOff aria-hidden="true" className="size-7" />}
        title={blocked === null ? `Delete ${deleting?.name ?? "this listing"}?` : "This listing has open orders"}
        description={
          blocked === null
            ? "Buyers won't see it any more. This can't be undone."
            : `${deleting?.name ?? "This listing"} has ${count(blocked)} open ${blocked === 1 ? "order" : "orders"}, so it can't be deleted yet. Hide it instead: buyers can't order it, and open orders carry on.`
        }
        actions={
          blocked === null ? (
            <>
              <Button variant="secondary" onClick={close}>
                Keep it
              </Button>
              <Button variant="destructive" loading={remove.isPending} loadingText="Deleting…" onClick={() => void doDelete()}>
                Delete listing
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={close}>
                Not now
              </Button>
              <Button loading={availability.isPending} loadingText="Hiding…" onClick={() => deleting && void hide(deleting, false)}>
                Hide it instead
              </Button>
            </>
          )
        }
      />
    </div>
  );
}

const listingSchema = z.object({
  name: z.string().trim().min(2, "Enter the product name.").max(100, "Keep the name under 100 characters."),
  description: z.string().trim().min(10, "Describe the product (at least 10 characters).").max(500, "Keep the description under 500 characters."),
  category: z.string().min(1, "Choose a category."),
  pricePerUnit: z.coerce.number({ invalid_type_error: "Enter the price." }).min(0, "The price can't be negative."),
  unit: z.string().trim().min(1, "Enter the unit, for example bag or carton.").max(40, "Keep the unit short."),
  minimumOrderQuantity: z.coerce.number({ invalid_type_error: "Enter the minimum order." }).int("Use a whole number.").min(1, "The minimum order is at least 1."),
  availableQuantity: z.coerce.number({ invalid_type_error: "Enter the stock." }).int("Use a whole number.").min(0, "Stock can't be negative."),
  deliveryCapability: z.string(),
  isAvailable: z.boolean(),
});
type ListingForm = z.infer<typeof listingSchema>;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGES = 5;

export function ListingFormPage() {
  const { id } = useParams();
  const product = useProduct(id ?? "");
  if (id && product.isLoading) return <Loading label="Loading the listing…" />;
  if (id && !product.data) return <ErrorNote error={product.error ?? true} fallback="We couldn't load this listing." onRetry={() => void product.refetch()} />;
  return <ListingFormView key={id ?? "new"} existing={id ? product.data! : null} />;
}

function ListingFormView({ existing }: { existing: SupplyProduct | null }) {
  const navigate = useNavigate();
  const save = useSaveProduct(existing?._id);
  const [images, setImages] = useState<string[]>(existing?.images ?? []);
  const [pending, setPending] = useState<File[]>([]);
  const [imageProblem, setImageProblem] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { register, handleSubmit, formState, setError: setFieldError } = useForm<ListingForm>({
    resolver: zodResolver(listingSchema),
    defaultValues: existing
      ? { name: existing.name, description: existing.description, category: existing.category, pricePerUnit: existing.pricePerUnit, unit: existing.unit, minimumOrderQuantity: existing.minimumOrderQuantity, availableQuantity: existing.availableQuantity, deliveryCapability: existing.deliveryCapability ?? "", isAvailable: existing.isAvailable }
      : { name: "", description: "", category: "", pricePerUnit: "" as unknown as number, unit: "", minimumOrderQuantity: 1, availableQuantity: "" as unknown as number, deliveryCapability: "", isAvailable: true },
  });
  const guard = useLeaveGuard((formState.isDirty || pending.length > 0) && !formState.isSubmitSuccessful);
  const e = formState.errors;

  const pick = (list: FileList | null) => {
    setImageProblem(null);
    const next = [...pending];
    for (const f of Array.from(list ?? [])) {
      if (images.length + next.length >= MAX_IMAGES) {
        setImageProblem(`Add up to ${MAX_IMAGES} photos.`);
        break;
      }
      if (!IMAGE_TYPES.includes(f.type)) {
        setImageProblem(`${f.name} isn't a JPG, PNG or WebP photo.`);
        continue;
      }
      if (f.size > 5 * 1024 * 1024) {
        setImageProblem(`${f.name} is larger than 5 MB.`);
        continue;
      }
      next.push(f);
    }
    setPending(next);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    setSaving(true);
    try {
      const saved = await save.mutateAsync({
        name: v.name,
        description: v.description,
        category: v.category as SupplyCategory,
        pricePerUnit: Number(v.pricePerUnit),
        unit: v.unit,
        minimumOrderQuantity: Number(v.minimumOrderQuantity),
        availableQuantity: Number(v.availableQuantity),
        ...(v.deliveryCapability ? { deliveryCapability: v.deliveryCapability as Delivery } : {}),
        isAvailable: v.isAvailable,
        ...(existing ? { images } : {}),
      });
      const failed: string[] = [];
      for (const f of pending) {
        try {
          await uploadProductImage(saved._id, f);
        } catch {
          failed.push(f.name);
        }
      }
      guard.allow();
      navigate("/bisupplynet/sell/listings", { state: failed.length ? { imageProblem: failed } : undefined });
    } catch (err) {
      if (!applyFieldErrors(err, setFieldError, ["name", "description", "category", "pricePerUnit", "unit", "minimumOrderQuantity", "availableQuantity", "deliveryCapability"])) setError(err);
    }
    setSaving(false);
  });

  return (
    <div className="flex flex-col gap-6">
      {guard.dialog}
      <Heading title={existing ? `Edit ${existing.name}` : "Add a wholesale listing"} subtitle="Set the bulk price, minimum order and stock buyers see." />
      <Intro>Stock is held for a buyer when they order, and comes back if they don't pay within 24 hours.</Intro>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <form noValidate onSubmit={onSubmit} className="flex min-w-0 flex-col gap-5">
          <Panel title="Listing details" subtitle="Fields marked * are required.">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-x-10 md:gap-y-6">
              <Field label="Product name" required error={e.name?.message}>
                <TextInput maxLength={100} placeholder="Premium rice 50kg" {...register("name")} />
              </Field>
              <Field label="Category" required error={e.category?.message}>
                <SelectInput {...register("category")}>
                  <option value="">Choose a category</option>
                  {CATEGORIES.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Price per unit (₦)" required error={e.pricePerUnit?.message}>
                <TextInput type="number" inputMode="decimal" min={0} {...register("pricePerUnit")} />
              </Field>
              <Field label="Unit" required hint="For example: bag, carton, roll" error={e.unit?.message}>
                <TextInput maxLength={40} {...register("unit")} />
              </Field>
              <Field label="Minimum order quantity" required error={e.minimumOrderQuantity?.message}>
                <TextInput type="number" inputMode="numeric" min={1} {...register("minimumOrderQuantity")} />
              </Field>
              <Field label="Stock available" required error={e.availableQuantity?.message}>
                <TextInput type="number" inputMode="numeric" min={0} {...register("availableQuantity")} />
              </Field>
              <Field label="Delivery" error={e.deliveryCapability?.message}>
                <SelectInput {...register("deliveryCapability")}>
                  <option value="">Same as my profile</option>
                  {DELIVERY.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <label className="flex min-h-11 items-center gap-2 self-end text-body-sm text-ink-strong">
                <input type="checkbox" className="size-4 accent-brand-navy" {...register("isAvailable")} />
                Show to buyers
              </label>
              <Field label="Description" required error={e.description?.message} className="md:col-span-2">
                <TextArea rows={4} maxLength={500} {...register("description")} />
              </Field>
              <div className="flex min-w-0 flex-col gap-3 md:col-span-2">
                <p className="text-field-label uppercase text-ink-secondary">Product photos</p>
                <p className="text-body-sm text-ink-muted">Up to {MAX_IMAGES} photos: JPG, PNG or WebP, 5 MB each.</p>
                {(images.length > 0 || pending.length > 0) && (
                  <ul aria-label="Product photos" className="flex flex-wrap gap-2">
                    {images.map((src) => (
                      <li key={src} className="relative">
                        <img src={src} alt="" className="size-20 rounded-md object-cover" />
                        <button type="button" aria-label="Remove photo" onClick={() => setImages(images.filter((x) => x !== src))} className="absolute right-1 top-1 flex size-8 items-center justify-center rounded-full bg-surface-card shadow-card">
                          <IconX aria-hidden="true" className="size-4" />
                        </button>
                      </li>
                    ))}
                    {pending.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-full bg-surface-tint-blue py-1 pl-3 pr-1 text-body-sm text-ink-brand">
                        <IconPhoto aria-hidden="true" className="size-4 shrink-0" />
                        <span className="max-w-40 truncate">{f.name}</span>
                        <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setPending(pending.filter((_, j) => j !== i))} className="flex size-8 items-center justify-center rounded-full hover:bg-surface-card">
                          <IconX aria-hidden="true" className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <input ref={fileRef} type="file" multiple accept={IMAGE_TYPES.join(",")} className="sr-only" tabIndex={-1} aria-label="Add product photos" onChange={(ev) => pick(ev.target.files)} />
                <Button type="button" size="md" variant="outlined" className="self-start" disabled={images.length + pending.length >= MAX_IMAGES} onClick={() => fileRef.current?.click()}>
                  <IconPhoto aria-hidden="true" className="size-4" /> Add photos
                </Button>
                {imageProblem && (
                  <p role="alert" className="text-body-sm text-danger">
                    {imageProblem}
                  </p>
                )}
              </div>
            </div>
          </Panel>
          <ErrorNote error={error} fallback="We couldn't save this listing. Please try again." />
          <Button type="submit" className="md:self-end md:px-10" loading={saving} loadingText="Saving…">
            {existing ? "Save changes" : "Publish listing"}
          </Button>
        </form>
        <HelpPanel
          items={[
            ["Minimum order", "Buyers can't order less than this"],
            ["Stock", "Held when a buyer orders"],
            ["Hidden listings", "Buyers can't find or order them"],
            ["Payment", "Released to your wallet after delivery"],
          ]}
        />
      </div>
    </div>
  );
}

// ── Incoming orders (seller) ─────────────────────────────────────────────

export function SellerOrdersPage() {
  const orders = useReceivedOrders();
  return (
    <div className="flex flex-col gap-6">
      <Heading title="Wholesale orders received" subtitle="Bulk orders other businesses placed with you." />
      <SellTabs />
      <Intro>Update paid orders within 48 hours. Unshipped paid orders are refunded to the buyer after 7 days.</Intro>
      <Panel>
        {orders.isLoading ? (
          <Loading label="Loading orders…" />
        ) : orders.error ? (
          <ErrorNote error={orders.error} fallback="We couldn't load your orders." onRetry={() => void orders.refetch()} />
        ) : !orders.data?.length ? (
          <EmptyState className="border-0 p-0" icon={<IconBuildingWarehouse className="size-7" />} title="No orders yet" body="When a business orders one of your listings, it appears here." />
        ) : (
          <RecordRows
            label="Orders received"
            rows={orders.data.map((o) => {
              const st = orderStatus(o.status);
              return {
                key: o._id,
                cells: [
                  <Link key="t" to={`/bisupplynet/orders/${o._id}`} className="hover:underline">
                    {o.trackingNo}
                  </Link>,
                  `${count(o.quantity)} × ${o.productName}${o.client?.name ? ` • ${o.client.name}` : ""}`,
                  `${naira(o.totalAmount)} • ${shortDate(o.createdAt)}`,
                  <Status key="s" tone={st.tone}>
                    {st.label}
                  </Status>,
                ],
              };
            })}
          />
        )}
      </Panel>
    </div>
  );
}

// ── Connection requests ──────────────────────────────────────────────────

export function ConnectionsPage() {
  const list = useIncomingConnections();
  const respond = useRespondConnection();
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const answer = (id: string, name: string, status: "accepted" | "rejected") => {
    setError(null);
    respond.mutateAsync({ id, status }).then(
      () => setNotice(status === "accepted" ? `You accepted ${name}'s request.` : `You declined ${name}'s request.`),
      (err) => setError(err)
    );
  };
  return (
    <div className="flex flex-col gap-6">
      <Heading title="Connection requests" subtitle="Businesses asking for a quote or to work with you." />
      <SellTabs />
      <Intro>Buyers can order without connecting first. A request is a good moment to agree terms.</Intro>
      {notice && (
        <p role="status" className="text-body-sm text-success-ink">
          {notice}
        </p>
      )}
      <ErrorNote error={error} fallback="We couldn't answer this request. Please try again." />
      <Panel>
        {list.isLoading ? (
          <Loading label="Loading requests…" />
        ) : list.error ? (
          <ErrorNote error={list.error} fallback="We couldn't load connection requests." onRetry={() => void list.refetch()} />
        ) : !list.data?.length ? (
          <EmptyState className="border-0 p-0" icon={<IconBuildingWarehouse className="size-7" />} title="No new requests" body="When a business asks to connect, you can accept or decline here." />
        ) : (
          <ul aria-label="Connection requests" className="flex flex-col divide-y divide-line-subtle">
            {list.data.map((c) => {
              const name = c.client?.name ?? "A business";
              return (
                <li key={c._id} className="grid grid-cols-[minmax(0,1fr)] gap-3 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] md:items-center">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-strong">{name}</p>
                    {c.message && <p className="break-words text-body-sm text-ink-strong">{c.message}</p>}
                    <p className="text-caption text-ink-muted">Sent {shortDate(c.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="md" disabled={respond.isPending} onClick={() => answer(c._id, name, "accepted")}>
                      Accept <span className="sr-only">{name}</span>
                    </Button>
                    <Button size="md" variant="outlined" disabled={respond.isPending} onClick={() => answer(c._id, name, "rejected")}>
                      Decline <span className="sr-only">{name}</span>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

// ── 10.12 Supplier earnings ──────────────────────────────────────────────

export function EarningsPage() {
  const dash = useSellerDashboard();
  if (dash.isLoading) return <Loading label="Loading your earnings…" />;
  if (dash.error && isNotWholesaler(dash.error)) return <Navigate to="/bisupplynet/sell/apply" replace />;
  if (!dash.data) return <ErrorNote error={dash.error ?? true} fallback="We couldn't load your earnings." onRetry={() => void dash.refetch()} />;
  const e = dash.data.earnings;
  const test = e.currentMode === "test";
  const book = test ? e.test : e.live;
  const badge = test ? "TEST" : undefined;
  const total = book.released.allTime + book.held;
  const paidPct = total > 0 ? Math.round((book.released.allTime / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <Heading
        title="Supplier orders and earnings"
        subtitle="Monitor seller trust, protected funds and payouts."
        action={
          <ButtonLink to="/bisupplynet/sell/orders" size="md">
            View wholesale orders
          </ButtonLink>
        }
      />
      <SellTabs />
      <Intro>Escrow releases only when the buyer confirms delivery.</Intro>
      {test && (
        <p role="status" className="flex items-start gap-2 rounded-xl bg-surface-tint-warm px-5 py-3 text-body-sm text-ink-strong">
          <IconAlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
          <span>
            <strong>Test payments: not withdrawable.</strong> These figures come from test orders. No real money moved.
          </span>
        </p>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[repeat(4,minmax(0,1fr))]">
        <KpiCard tone="revenue" label="Trust score" value={`${Math.round(e.trustScore)}%`} caption={trustLevel(e.trustScore)} />
        <KpiCard tone="orders" label="Order value" value={nairaCompact(book.orderValue30d)} caption="Last 30 days" badge={badge} />
        <KpiCard tone="invoices" label="Escrow held" value={nairaCompact(book.held)} caption="Awaiting buyer" badge={badge} />
        <KpiCard tone="stock" label="Paid out" value={nairaCompact(book.released.allTime)} caption="Net earnings" badge={badge} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel title="Recent supplier payout activity" subtitle="Latest paid orders and where the money is.">
          {book.recentPayouts.length === 0 ? (
            <p className="text-body-sm text-ink-muted">No paid orders yet. When a buyer pays, it shows here.</p>
          ) : (
            <RecordRows
              label="Recent payouts"
              rows={book.recentPayouts.map((p) => ({
                key: p.orderId,
                cells: [
                  <Link key="t" to={`/bisupplynet/orders/${p.orderId}`} className="hover:underline">
                    {p.trackingNo}
                  </Link>,
                  `${naira(p.totalAmount)} • your share ${naira(p.sellerShare)}`,
                  p.orderState,
                  p.moneyState,
                ],
              }))}
            />
          )}
        </Panel>
        <FactsPanel
          title="Next actions & insights"
          items={[
            ["BiManage fee", `${naira(book.commission30d)} in the last 30 days`],
            ["Refunded to buyers", `${naira(book.refunded30d)} in the last 30 days`],
            ["Fulfilment update", "Within 48 hours of payment"],
            ["Ghost order rule", "7-day auto-refund and trust penalty"],
          ]}
        >
          <section aria-label="Supplier funds" className="rounded-xl border border-line-card bg-surface-card p-4">
            <p className="text-caption font-semibold uppercase text-ink-strong">Supplier funds{test ? " • test" : ""}</p>
            <p className="text-caption text-ink-muted">Paid out versus held in escrow</p>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-surface-tint-lavender" aria-hidden="true">
              <span className="h-full bg-success" style={{ width: `${paidPct}%` }} />
              <span className="h-full flex-1 bg-brand-violet" />
            </div>
            <p className="mt-3 text-body-sm font-semibold text-success">Paid out {naira(book.released.allTime)}</p>
            <p className="text-body-sm font-semibold text-brand-violet">Escrow held {naira(book.held)}</p>
          </section>
          {test ? (
            <p className="text-body-sm text-ink-muted">Test money can't be withdrawn.</p>
          ) : (
            <ButtonLink to={e.walletLink?.startsWith("/") ? e.walletLink : "/wallet"} variant="outlined" size="md" fullWidth>
              Withdraw from Wallet
            </ButtonLink>
          )}
        </FactsPanel>
      </div>
    </div>
  );
}

