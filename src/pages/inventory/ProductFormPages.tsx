import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { IconPhoto, IconPrinter, IconScan, IconTrash } from "@tabler/icons-react";
import { Button, ButtonLink, Dialog, Field, Spinner, TextInput } from "@/components/ui";
import { DetailRows, HelpPanel, IntroCard, PageTitle, Panel } from "@/components/page/Blocks";
import { ScanButton } from "@/components/scanner/ScanButton";
import { ChannelPricingEditor, ChannelPricingSummary, channelsFrom, draftFrom, type ChannelDraft } from "@/components/inventory/ChannelPricing";
import { useSellingChannels } from "@/lib/workspace/channels";
import { interpretScan } from "@/lib/scanner/scanner";
import { StockBadge } from "@/components/inventory/StockBadge";
import {
  findInInventory,
  lookupBarcode,
  thresholdOf,
  uploadProductImage,
  useCreateProduct,
  useDeleteProduct,
  useProduct,
  useUpdateProduct,
  type BarcodeInfo,
  type Product,
} from "@/lib/inventory/api";
import { ApiError } from "@/lib/api/client";
import { applyFieldErrors, errorMessage } from "@/lib/api/errorMessage";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { count, naira } from "@/lib/format";
import { useCan } from "@/lib/auth/useCan";
import { useLeaveGuard } from "@/lib/nav/useLeaveGuard";
import { useReturnTo } from "@/lib/nav/history";

const Loading = () => (
  <div className="flex justify-center py-16 text-ink-brand" role="status">
    <Spinner className="size-8" />
    <span className="sr-only">Loading…</span>
  </div>
);

// Numbers typed as "22,500" or "₦22,500" are accepted.
const money = z.preprocess(
  (v) => (typeof v === "string" ? v.replace(/[₦,\s]/g, "") : v),
  z.coerce.number({ invalid_type_error: "Enter an amount." }).min(0, "Enter a positive amount.")
);
const whole = (msg: string) =>
  z.preprocess((v) => (typeof v === "string" ? v.replace(/[,\s]/g, "") : v), z.coerce.number({ invalid_type_error: msg }).int("Use a whole number.").min(0, "Can't be negative."));
const optionalCode = (re: RegExp, msg: string) =>
  z.string().trim().max(40).optional().refine((v) => !v || re.test(v), msg);

const productSchema = z.object({
  name: z.string().trim().min(2, "Enter a product name (at least 2 characters).").max(100),
  category: z.string().trim().min(1, "Enter a category.").max(50),
  sku: z.string().trim().min(1, "Enter a SKU.").max(40).regex(/^[A-Za-z0-9._/-]+$/, "Use letters, numbers and . _ / - only."),
  barcode: optionalCode(/^[A-Za-z0-9-]+$/, "Use letters, numbers and - only."),
  sellingPrice: money,
  stockQuantity: whole("Enter a quantity."),
  lowStockThreshold: whole("Enter a number."),
  brand: z.string().trim().max(50).optional(),
});
type ProductValues = z.infer<typeof productSchema>;

const clean = <T extends Record<string, unknown>>(v: T) =>
  Object.fromEntries(Object.entries(v).filter(([, x]) => x !== "" && x !== undefined)) as Partial<T>;

/** Product photo picker; uploads immediately when the product exists. */
function PhotoField({ productId, image, onPicked }: { productId?: string; image?: string | null; onPicked: (f: File | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(image ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setPreview(image ?? null), [image]);
  const pick = async (file?: File) => {
    setError(null);
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return setError("Use a PNG, JPG or WebP photo.");
    if (file.size > 5 * 1024 * 1024) return setError("Keep the photo under 5 MB.");
    setPreview(URL.createObjectURL(file));
    if (!productId) return onPicked(file);
    setBusy(true);
    try {
      await uploadProductImage(productId, file);
    } catch (err) {
      setError(errorMessage(err, "We couldn't upload the photo. Check your connection and try again."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Field label="Product media" error={error ?? undefined} hint={busy ? "Uploading…" : undefined}>
      <div className="flex items-center gap-3 lg:h-control-lg lg:rounded-sm lg:border lg:border-line-default lg:bg-surface-card lg:pl-2 lg:pr-1.5">
        {preview ? <img src={preview} alt="Product" className="size-9 rounded-md object-cover" /> : <IconPhoto aria-hidden="true" className="size-6 text-ink-muted" />}
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="flex-1 text-left text-input font-normal text-ink-strong lg:font-medium">
          {preview ? "Replace product photo" : "Upload product photo"}
        </button>
        <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} onChange={(e) => void pick(e.target.files?.[0])} />
      </div>
    </Field>
  );
}

const stockHelp: Array<[string, string]> = [
  ["After sale", "Stock decreases automatically"],
  ["Low stock", "Alert when at or below the threshold"],
  ["Online store", "Optional publication"],
  ["Validation", "SKU must be unique"],
];

// 09.05 Add / edit inventory product
export function ProductFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const location = useLocation();
  const prefill = (location.state ?? {}) as Partial<BarcodeInfo>;
  const existing = useProduct(id);
  const create = useCreateProduct();
  const update = useUpdateProduct(id ?? "");
  const remove = useDeleteProduct();
  const [photo, setPhoto] = useState<File | null>(null);
  const [formError, setFormError] = useState<unknown>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Selling rules per channel (backend #118): retail price is the price field below.
  const [draft, setDraft] = useState<ChannelDraft>(() => draftFrom());
  const [draftDirty, setDraftDirty] = useState(false);
  const [channelErrors, setChannelErrors] = useState<Record<string, string>>({});
  const channels = useSellingChannels();
  const wholesaleSetUp = (channels.data?.channels.wholesale.status ?? "available") !== "available";

  const { register, handleSubmit, reset, setError, setValue, watch, formState } = useForm<ProductValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: prefill.name ?? "",
      category: prefill.category?.split(",")[0]?.trim() ?? "",
      brand: prefill.brand ?? "",
      barcode: prefill.barcode ?? "",
      sku: "",
      lowStockThreshold: 10,
    } as unknown as ProductValues,
  });
  const guard = useLeaveGuard((formState.isDirty || draftDirty || Boolean(photo)) && !formState.isSubmitSuccessful);
  const returnTo = useReturnTo();

  useEffect(() => {
    const p = existing.data;
    if (!p) return;
    reset({
      name: p.name,
      category: p.category ?? "",
      sku: p.sku ?? "",
      barcode: p.barcode ?? "",
      sellingPrice: p.sellingPrice,
      stockQuantity: p.stockQuantity,
      lowStockThreshold: thresholdOf(p),
      brand: p.brand ?? "",
    }, { keepDirtyValues: true });
    if (!draftDirty) setDraft(draftFrom(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing.data, reset]);

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    setChannelErrors({});
    const channelRules = channelsFrom(draft, Number(v.sellingPrice) || undefined);
    try {
      if (editing) {
        const { stockQuantity: _ignored, ...rest } = v;
        void _ignored;
        await update.mutateAsync({ ...clean(rest), sku: v.sku, barcode: v.barcode ?? "", channels: channelRules } as never);
        guard.allow();
        returnTo("/inventory/products");
      } else {
        const product = await create.mutateAsync({ ...(clean(v) as ProductValues), channels: channelRules, image: prefill.image ?? undefined } as never);
        if (photo) await uploadProductImage(product._id, photo).catch(() => undefined);
        guard.allow();
        returnTo("/inventory/products");
      }
    } catch (err) {
      const data = err instanceof ApiError ? (err.data as { field?: string; errors?: Array<{ field: string; message: string }> }) : undefined;
      if (err instanceof ApiError && err.status === 409) setError("sku", { message: "Another product already uses this SKU. Use a different one." });
      else if (data?.field?.startsWith("channels")) {
        // Retail price problems belong on the price field; the rest on the channel section.
        const list = data.errors ?? [{ field: data.field, message: err instanceof Error ? err.message : "" }];
        const out: Record<string, string> = {};
        for (const e of list) {
          if (e.field === "channels.retail.price") setError("sellingPrice", { message: e.message });
          else out[e.field] = out[e.field] ?? e.message;
        }
        setChannelErrors(out);
      } else if (!applyFieldErrors(err, setError, ["name", "category", "sku", "barcode", "sellingPrice", "stockQuantity", "lowStockThreshold", "brand"])) setFormError(err);
    }
  });

  const priceNow = Number(String(watch("sellingPrice") ?? "").replace(/[₦,\s]/g, "")) || 0;
  const liveChannels = channelsFrom(draft, priceNow || undefined);

  if (editing && existing.isLoading) return <Loading />;
  if (editing && existing.error) return <ErrorNote error={existing.error} fallback="We couldn't load this product. Please try again." onRetry={() => void existing.refetch()} />;

  return (
    <div className="flex flex-col gap-6">
      {guard.dialog}
      <PageTitle
        actions={
          editing && (
            <div className="flex flex-wrap gap-3">
              <ButtonLink to={`/inventory/labels?ids=${id}`} size="md" variant="secondary">
                <IconPrinter aria-hidden="true" className="size-icon" /> Print label
              </ButtonLink>
              <ButtonLink to={`/inventory/products/${id}/adjust`} size="md">
                Adjust stock
              </ButtonLink>
            </div>
          )
        }
      >
        {editing ? "Edit inventory product" : "Add inventory product"}
      </PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Keep pricing, quantity and stock alerts accurate.</p>
      <IntroCard eyebrow="Workspace / Inventory" title="Stock can be published to your online store after saving." />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
          <Panel title="Product and stock information" subtitle="Required fields keep the inventory consistent.">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 md:gap-x-10 md:gap-y-6">
              <Field label="Product name" required error={formState.errors.name?.message}>
                <TextInput placeholder="Classic linen shirt" {...register("name")} />
              </Field>
              <Field label="Category" required error={formState.errors.category?.message}>
                <TextInput placeholder="Clothing" {...register("category")} />
              </Field>
              <Field label="SKU" required error={formState.errors.sku?.message}>
                <TextInput placeholder="APP-101" autoCapitalize="characters" {...register("sku")} />
              </Field>
              <Field label="Barcode" error={formState.errors.barcode?.message}>
                <TextInput inputMode="numeric" placeholder="8901234567890" {...register("barcode")} trailing={<ScanButton iconOnly onCode={(c) => setValue("barcode", c, { shouldDirty: true, shouldValidate: true })} className="mr-1 min-h-0 px-3 py-2" />} />
              </Field>
              {editing ? (
                <Field
                  label="Current stock"
                  hint={existing.data?.stock ? `On hand ${count(existing.data.stock.onHand)} · Reserved ${count(existing.data.stock.reserved)} · Available ${count(existing.data.stock.available)}. Change quantities with a stock adjustment, so it's recorded.` : "Change quantities with a stock adjustment, so it's recorded."}
                >
                  <TextInput value={`${count(existing.data?.stockQuantity)} units`} readOnly disabled />
                </Field>
              ) : (
                <Field label="Initial quantity" required error={formState.errors.stockQuantity?.message}>
                  <TextInput inputMode="numeric" placeholder="28" {...register("stockQuantity")} />
                </Field>
              )}
              <Field label="Low-stock alert at" error={formState.errors.lowStockThreshold?.message} hint="We alert you at or below this many units.">
                <TextInput inputMode="numeric" placeholder="10" {...register("lowStockThreshold")} />
              </Field>
              <PhotoField productId={id} image={existing.data?.image ?? prefill.image} onPicked={setPhoto} />
            </div>
            <div className="mt-6">
              <ChannelPricingEditor
                value={draft}
                onChange={(d) => {
                  setDraft(d);
                  setDraftDirty(true);
                }}
                errors={channelErrors}
                wholesaleAvailable={wholesaleSetUp}
                retailPriceField={
                  <Field label="Retail price (₦)" required error={formState.errors.sellingPrice?.message}>
                    <TextInput inputMode="decimal" placeholder="22,500" {...register("sellingPrice")} />
                  </Field>
                }
              />
            </div>
            <div className="mt-6 rounded-xl bg-surface-pale p-4">
              <p className="text-caption font-semibold uppercase text-ink-brand">Stock integrity</p>
              <p className="mt-2 text-body-lg text-ink-strong">Changes update stock values and connected online listings.</p>
            </div>
          </Panel>
          <ErrorNote error={formError} fallback="We couldn't save this product. Check your connection and try again." onRetry={() => void onSubmit()} />
          <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-between">
            {editing ? (
              <Button variant="secondary" size="md" onClick={() => setConfirmDelete(true)} className="text-danger">
                <IconTrash aria-hidden="true" className="size-icon" /> Delete product
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" loading={formState.isSubmitting} loadingText="Saving…">
              Save inventory item
            </Button>
          </div>
        </form>
        <div className="flex flex-col gap-5">
          <ChannelPricingSummary channels={liveChannels} available={existing.data?.stock?.available ?? existing.data?.stockQuantity ?? 0} />
          <HelpPanel items={stockHelp} callout={{ title: "Audit and verification", body: "Keep a barcode, SKU and adjustment reason where needed." }} />
        </div>
      </div>
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        tone="danger"
        icon={<IconTrash className="size-7" />}
        title={`Delete ${existing.data?.name ?? "this product"}?`}
        description="It will be removed from your inventory. Past orders keep their records. This can't be undone."
        actions={
          <>
            <Button variant="outlined" onClick={() => setConfirmDelete(false)}>
              Keep product
            </Button>
            <Button
              variant="destructive"
              loading={remove.isPending}
              loadingText="Deleting…"
              onClick={async () => {
                try {
                  await remove.mutateAsync(id!);
                  guard.allow();
                  returnTo("/inventory/products");
                } catch (err) {
                  setConfirmDelete(false);
                  setFormError(err);
                }
              }}
            >
              Delete product
            </Button>
          </>
        }
      />
    </div>
  );
}

// 09.09 Add your first inventory product (empty inventory)
export function AddFirstProduct() {
  const navigate = useNavigate();
  const create = useCreateProduct();
  const [formError, setFormError] = useState<unknown>(null);
  const schema = productSchema.extend({ sku: z.string().trim().max(40).optional(), lowStockThreshold: whole("Enter a number.").optional() });
  const { register, handleSubmit, setError, setValue, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const guard = useLeaveGuard(formState.isDirty && !formState.isSubmitSuccessful);
  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    try {
      await create.mutateAsync(clean(v) as never);
      guard.allow();
      navigate("/inventory/products", { replace: true });
    } catch (err) {
      if (!applyFieldErrors(err, setError, ["name", "category", "sku", "barcode", "sellingPrice", "stockQuantity", "lowStockThreshold", "brand"])) setFormError(err);
    }
  });
  return (
    <div className="flex flex-col gap-6">
      {guard.dialog}
      <PageTitle>Add your first inventory product</PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Start tracking products and stock from one place.</p>
      <IntroCard eyebrow="Inventory" title="Every sale reduces stock automatically, so you always know what you have." />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
          <Panel title="Product details" subtitle="You can add photos, barcodes and alerts later.">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 md:gap-x-10 md:gap-y-6">
              <Field label="Product name" required error={formState.errors.name?.message}>
                <TextInput placeholder="Classic linen shirt" autoFocus {...register("name")} />
              </Field>
              <Field label="Category" required error={formState.errors.category?.message}>
                <TextInput placeholder="Clothing" {...register("category")} />
              </Field>
              <Field label="Unit price (₦)" required error={formState.errors.sellingPrice?.message}>
                <TextInput inputMode="decimal" placeholder="22,500" {...register("sellingPrice")} />
              </Field>
              <Field label="Stock quantity" required error={formState.errors.stockQuantity?.message}>
                <TextInput inputMode="numeric" placeholder="28" {...register("stockQuantity")} />
              </Field>
              <Field label="SKU" error={formState.errors.sku?.message}>
                <TextInput placeholder="APP-101" {...register("sku")} />
              </Field>
              <Field label="Barcode / product code" error={formState.errors.barcode?.message}>
                <TextInput inputMode="numeric" placeholder="Enter or scan barcode" {...register("barcode")} trailing={<ScanButton iconOnly onCode={(c) => setValue("barcode", c, { shouldDirty: true, shouldValidate: true })} className="mr-1 min-h-0 px-3 py-2" />} />
              </Field>
            </div>
          </Panel>
          <ErrorNote error={formError} fallback="We couldn't add this product. Check your connection and try again." onRetry={() => void onSubmit()} />
          <Button type="submit" className="self-end" loading={formState.isSubmitting} loadingText="Adding…">
            Add product
          </Button>
        </form>
        <HelpPanel
          items={[
            ["Stock", "Decreases automatically with each sale"],
            ["Barcode", "Scan to find products instantly"],
            ["Online store", "Publish products when you're ready"],
          ]}
        />
      </div>
    </div>
  );
}

// 09.06 Adjust stock: see StockFlowPages.tsx (shared stock flow, 26 Nov designs).

// 09.04 Scan or enter barcode
type LookupResult =
  | { kind: "inventory"; products: Product[] }
  | { kind: "catalogue"; info: BarcodeInfo }
  | { kind: "none"; code: string };

export function BarcodeLookupPage() {
  const navigate = useNavigate();
  const canEdit = useCan("manageInventory");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);

  const find = async (raw: string) => {
    const meant = interpretScan(raw);
    if (meant.kind === "link") return setError(`This QR code is a link to ${meant.host}, not a product code.`);
    const c = meant.code;
    if (meant.code !== raw.trim()) setCode(c);
    if (!c) return setError("Enter a barcode, SKU or product name.");
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const products = await findInInventory(c);
      if (products.length) return setResult({ kind: "inventory", products });
      if (/^\d{8,14}$/.test(c)) {
        const info = await lookupBarcode(c).catch((e) => (e instanceof ApiError && e.status === 404 ? null : Promise.reject(e)));
        if (info) return setResult({ kind: "catalogue", info });
      }
      setResult({ kind: "none", code: c });
    } catch (err) {
      setError(errorMessage(err, "We couldn't look that up. Check your connection and try again."));
    } finally {
      setBusy(false);
    }
  };


  // A BiManage label's QR code opens /inventory/lookup?code=… (phone camera): look it up straight away.
  const [params] = useSearchParams();
  const fromLabel = params.get("code");
  const looked = useRef<string | null>(null);
  useEffect(() => {
    if (!fromLabel || looked.current === fromLabel) return;
    looked.current = fromLabel;
    setCode(fromLabel);
    void find(fromLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromLabel]);
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Scan or enter barcode</PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Find a product using its barcode, SKU or name.</p>
      <IntroCard eyebrow="Workspace / Inventory" title="Existing products load instantly without duplicate entry." />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Panel title="Barcode and product lookup" subtitle="Scan with the camera, use a barcode reader, or type a code.">
            <form
              noValidate
              className="flex flex-col gap-4 md:flex-row md:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                void find(code);
              }}
            >
              <div className="min-w-0 flex-1">
                <Field label="Barcode / EAN, SKU or name" error={error ?? undefined}>
                  <TextInput autoFocus inputMode="search" placeholder="8901234567890" value={code} onChange={(e) => setCode(e.target.value)} />
                </Field>
              </div>
              <div className="flex shrink-0 gap-3">
                <ScanButton
                  onCode={(c) => {
                    setCode(c);
                    void find(c);
                  }}
                />
                <Button type="submit" loading={busy} loadingText="Finding…">
                  <IconScan aria-hidden="true" className="size-icon" /> Find product
                </Button>
              </div>
            </form>
          </Panel>

          {result?.kind === "inventory" &&
            result.products.map((p) => (
              <Panel key={p._id} title={p.name} subtitle="In your inventory">
                <DetailRows
                  rows={[
                    ["Barcode", p.barcode ?? "—"],
                    ["SKU", p.sku ?? "—"],
                    ["Price", naira(p.sellingPrice)],
                    ["Current stock", <span className="flex items-center gap-3">{count(p.stockQuantity)} units <StockBadge product={p} /></span>],
                    ["Category", p.category ?? "—"],
                  ]}
                />
                {canEdit && (
                  <div className="mt-5 flex flex-wrap gap-3">
                    <ButtonLink to={`/inventory/products/${p._id}/adjust`} size="md">
                      Adjust stock
                    </ButtonLink>
                    <ButtonLink to={`/inventory/products/${p._id}`} variant="secondary" size="md">
                      Edit product
                    </ButtonLink>
                  </div>
                )}
              </Panel>
            ))}

          {result?.kind === "catalogue" && (
            <Panel title="Not in your inventory yet" subtitle={`Found in the ${result.info.source === "openfoodfacts" ? "Open Food Facts" : "UPC"} product database.`}>
              <div className="flex gap-4">
                {result.info.image && <img src={result.info.image} alt="" className="size-20 rounded-lg object-cover" />}
                <DetailRows rows={[["Product", result.info.name], ["Brand", result.info.brand ?? "—"], ["Barcode", result.info.barcode]]} />
              </div>
              {canEdit && (
                <Button className="mt-5" onClick={() => navigate("/inventory/products/new", { state: result.info })}>
                  Add as a new product
                </Button>
              )}
            </Panel>
          )}

          {result?.kind === "none" && (
            <Panel title="No match" subtitle={`Nothing in your inventory matches “${result.code}”.`}>
              {canEdit && (
                <Button onClick={() => navigate("/inventory/products/new", { state: { barcode: /^\d+$/.test(result.code) ? result.code : undefined, name: /^\d+$/.test(result.code) ? undefined : result.code } })}>
                  Add a new product
                </Button>
              )}
            </Panel>
          )}
        </div>
        <HelpPanel
          items={[
            ["Scanner", "Phone or laptop camera, barcode reader or keyboard"],
            ["No match", "Add a new product"],
            ["Duplicate check", "Existing SKU and barcode are re-used"],
          ]}
          callout={{ title: "Tip", body: <>USB and Bluetooth barcode scanners type the code and press Enter — just scan into the field. <Link to="/inventory/products" className="font-semibold text-ink-brand hover:underline">Browse products</Link></> }}
        />
      </div>
    </div>
  );
}
