import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconDownload, IconPhotoPlus, IconSearch, IconTrash, IconUpload, IconX } from "@tabler/icons-react";
import { Button, ButtonLink, Dialog, Field, SelectInput, Status, TextArea, TextInput } from "@/components/ui";
import { DetailRows, HelpPanel, IntroCard, PageTitle, Panel } from "@/components/page/Blocks";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { applyFieldErrors } from "@/lib/api/errorMessage";
import { saveBlob } from "@/lib/api/client";
import { count, naira } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useCan } from "@/lib/auth/useCan";
import { useProducts } from "@/lib/inventory/api";
import { useLeaveGuard } from "@/lib/nav/useLeaveGuard";
import { useReturnTo } from "@/lib/nav/history";
import { useUrlState } from "@/lib/nav/useUrlState";
import {
  PRODUCT_CATEGORIES,
  categoryLabel,
  uploadStoreImage,
  useBulkUpload,
  useDeleteStoreProduct,
  useSaveStoreProduct,
  useStoreProducts,
  useSyncInventory,
  type BulkResult,
  type ProductInput,
  type Store,
  type StoreProduct,
} from "@/lib/store/api";
import { Loading, StoreTabs, WithStore, opsEyebrow, storefrontPath } from "./shared";

const MAX_IMAGES = 8;
const visibility = (p: Pick<StoreProduct, "isAvailable">) => (p.isAvailable ? { label: "Published", tone: "success" as const } : { label: "Draft", tone: "neutral" as const });

function useStoreProduct(id?: string) {
  const products = useStoreProducts();
  return { ...products, product: products.data?.find((p) => p._id === id) };
}

// ── 08.03 Catalogue management ────────────────────────────────────────────

export function CataloguePage() {
  return <WithStore>{(store) => <Catalogue store={store} />}</WithStore>;
}

function Catalogue({ store }: { store: Store }) {
  const products = useStoreProducts();
  const canEdit = useCan("manageInventory");
  const [q, setQ] = useUrlState<string>("q", "");
  const [show, setShow] = useUrlState<"all" | "published" | "draft">("show", "all", ["all", "published", "draft"]);
  const all = products.data ?? [];
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return all.filter((p) => (show === "all" || (show === "published") === p.isAvailable) && (!term || [p.name, p.sku, categoryLabel(p.category)].some((v) => v?.toLowerCase().includes(term))));
  }, [all, q, show]);
  const published = all.filter((p) => p.isAvailable).length;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        actions={
          canEdit && (
            <div className="flex flex-wrap gap-2">
              <ButtonLink to="/store/products/sync" size="md" variant="secondary">
                Sync from inventory
              </ButtonLink>
              <ButtonLink to="/store/products/bulk" size="md" variant="secondary">
                Bulk upload
              </ButtonLink>
              <ButtonLink to="/store/products/new" size="md">
                + Add product
              </ButtonLink>
            </div>
          )
        }
      >
        Store products
      </PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Everything customers can see and buy in your store.</p>
      <StoreTabs />
      {/* Counts only once the list has loaded (it used to flash "0 products"). */}
      <IntroCard eyebrow={opsEyebrow(store)} title={products.isLoading ? "Loading your products…" : products.error ? "Store products" : `${count(all.length)} ${all.length === 1 ? "product" : "products"} · ${count(published)} published`} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)]">
        <Panel>
          <div className="flex flex-col gap-3 md:flex-row">
            <label className="flex h-control-lg flex-1 items-center gap-2 rounded-md bg-surface-pale px-3">
              <IconSearch aria-hidden="true" className="size-icon text-ink-muted" />
              <span className="sr-only">Search store products</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, SKU, category…" className="h-full flex-1 bg-transparent text-input text-ink-strong outline-none placeholder:text-ink-muted" />
            </label>
            <div role="tablist" aria-label="Show" className="flex items-center gap-1 rounded-md bg-surface-pale p-1">
              {(["all", "published", "draft"] as const).map((k) => (
                <button key={k} type="button" role="tab" aria-selected={show === k} onClick={() => setShow(k)} className={cn("min-h-11 rounded-sm px-3 text-action font-semibold capitalize", show === k ? "bg-surface-card text-ink-brand shadow-card" : "text-ink-muted")}>
                  {k}
                </button>
              ))}
            </div>
          </div>
          {products.isLoading ? (
            <Loading />
          ) : products.error ? (
            <ErrorNote error={products.error} fallback="We couldn't load your store products." onRetry={() => void products.refetch()} className="mt-4" />
          ) : all.length === 0 ? (
            <div className="mt-6 flex flex-col items-start gap-3 rounded-xl bg-surface-pale p-5">
              <p className="text-body-lg font-semibold text-ink-strong">No products in your store yet</p>
              <p className="text-body-sm text-ink-muted">Add one, upload a spreadsheet, or bring products over from your inventory.</p>
              {canEdit && <ButtonLink to="/store/products/new" size="md">Add your first product</ButtonLink>}
            </div>
          ) : list.length === 0 ? (
            <p className="mt-6 text-body-sm text-ink-muted">No products match your search.</p>
          ) : (
            <ul className="mt-4 flex flex-col divide-y divide-line-subtle">
              {list.map((p) => {
                const v = visibility(p);
                return (
                  <li key={p._id} className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 py-3">
                    {p.images[0] ? <img src={p.images[0]} alt="" className="size-12 rounded-md object-cover" /> : <span aria-hidden="true" className="size-12 rounded-md bg-surface-tint-blue" />}
                    <div className="min-w-0">
                      <Link to={`/store/products/${p._id}`} className="block truncate font-semibold text-ink-strong hover:underline">
                        {p.name}
                      </Link>
                      <p className="truncate text-body-sm text-ink-muted">
                        {p.sku ? `${p.sku} · ` : ""}
                        {naira(p.price)} · {p.stockQuantity > 0 ? `${count(p.stockQuantity)} in stock` : "Sold out"}
                        {p.inventoryProduct ? " · Synced with inventory" : ""}
                      </p>
                    </div>
                    <Status tone={v.tone}>{v.label}</Status>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <HelpPanel
          items={[
            ["Published", products.isLoading ? "…" : `${count(published)} of ${count(all.length)}`],
            ["Drafts", "Hidden from customers until published"],
            ["Synced products", "Stock comes from Inventory"],
            ["Storefront", <Link key="s" to={storefrontPath(store)} className="text-ink-brand hover:underline">Preview your store</Link>],
          ]}
        />
      </div>
    </div>
  );
}

// ── 08.04 Add & edit product ──────────────────────────────────────────────

const num = (msg: string) => z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : Number(String(v).replace(/[₦,\s]/g, ""))), z.number({ required_error: msg, invalid_type_error: msg }).min(0, "Can't be negative."));
const productSchema = z.object({
  name: z.string().trim().min(2, "Enter a product name.").max(100),
  category: z.string().min(1, "Choose a category."),
  price: num("Enter a price."),
  // Empty is fine: preprocess turns "" into undefined, so the number itself must be optional.
  comparePrice: z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : Number(String(v).replace(/[₦,\s]/g, ""))), z.number({ invalid_type_error: "Enter a number." }).min(0, "Can't be negative.").optional()),
  sku: z.string().trim().min(1, "Enter a SKU.").max(40).regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/, "Use letters, numbers, dashes, dots or slashes."),
  stockQuantity: num("Enter a quantity.").pipe(z.number().int("Use a whole number.")).optional(),
  description: z.string().trim().max(1000).optional(),
  visibility: z.enum(["published", "draft"]),
});
type ProductValues = z.infer<typeof productSchema>;

export function StoreProductFormPage() {
  const { id } = useParams();
  return <WithStore>{(store) => <ProductForm store={store} id={id} />}</WithStore>;
}

function ProductForm({ store, id }: { store: Store; id?: string }) {
  const editing = Boolean(id);
  const existing = useStoreProduct(id);
  if (editing && existing.isLoading) return <Loading />;
  if (editing && !existing.product) return <ErrorNote error={existing.error ?? true} fallback="We couldn't find this product." onRetry={() => void existing.refetch()} />;
  return <ProductFormInner store={store} product={existing.product} />;
}

function ProductFormInner({ store, product }: { store: Store; product?: StoreProduct }) {
  const returnTo = useReturnTo();
  const save = useSaveStoreProduct(product?._id);
  const linked = Boolean(product?.inventoryProduct);
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<unknown>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { register, handleSubmit, setValue, setError, formState } = useForm<ProductValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? "",
      category: product?.category ?? "",
      price: product?.price as number,
      comparePrice: product?.comparePrice ?? undefined,
      sku: product?.sku ?? "",
      stockQuantity: product?.stockQuantity ?? 0,
      description: product?.description ?? "",
      visibility: product ? (product.isAvailable ? "published" : "draft") : "published",
    },
  });
  const imagesChanged = images.join("|") !== (product?.images ?? []).join("|");
  const guard = useLeaveGuard((formState.isDirty || imagesChanged) && !formState.isSubmitSuccessful);

  const addFiles = async (files: FileList | null) => {
    setImageError(null);
    const list = [...(files ?? [])];
    if (!list.length) return;
    if (images.length + list.length > MAX_IMAGES) return setImageError(`Up to ${MAX_IMAGES} photos per product.`);
    for (const f of list) {
      if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) return setImageError("Use JPG, PNG or WebP photos.");
      if (f.size > 5 * 1024 * 1024) return setImageError("Each photo must be under 5 MB.");
    }
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of list) urls.push(await uploadStoreImage(f));
      setImages((prev) => [...prev, ...urls]);
    } catch {
      setImageError("We couldn't upload that photo. Please try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = (mode: "draft" | "publish" | "keep") =>
    handleSubmit(async (v) => {
      setFormError(null);
      const isAvailable = mode === "keep" ? v.visibility === "published" : mode === "publish";
      if (isAvailable && images.length === 0) {
        setImageError("Add at least one photo to publish this product, or save it as a draft.");
        return;
      }
      const body: Partial<ProductInput> = {
        name: v.name,
        category: v.category,
        price: v.price,
        comparePrice: v.comparePrice ?? null,
        sku: v.sku,
        description: v.description ?? "",
        images,
        isAvailable,
        ...(linked ? {} : { stockQuantity: v.stockQuantity ?? 0 }),
      };
      try {
        const saved = await save.mutateAsync(body);
        setValue("visibility", isAvailable ? "published" : "draft");
        guard.allow();
        returnTo(product ? `/store/products/${saved._id}` : "/store/products");
      } catch (err) {
        if (!applyFieldErrors(err, setError, ["name", "category", "price", "comparePrice", "sku", "stockQuantity", "description"])) {
          const field = (err as { data?: { field?: string } }).data?.field;
          if (field === "images") setImageError((err as Error).message);
          else setFormError(err);
        }
      }
    });

  return (
    <div className="flex flex-col gap-6">
      {guard.dialog}
      <PageTitle
        actions={
          <Button variant="secondary" size="md" onClick={() => void submit("draft")()} loading={save.isPending} loadingText="Saving…">
            Save draft
          </Button>
        }
      >
        {product ? `Edit ${product.name}` : "Add a product"}
      </PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Create a complete listing from one place.</p>
      <IntroCard eyebrow={opsEyebrow(store)} title={linked ? "Stock for this product comes from Inventory. Set a storefront price here." : "Set a storefront price, photos and stock."} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <form noValidate onSubmit={submit("keep")} className="flex flex-col gap-5">
          <Panel title="Product details" subtitle="Photos and category are required to publish.">
            <div className="grid gap-4 md:grid-cols-2 md:gap-x-10 md:gap-y-6">
              <Field label="Product name" required error={formState.errors.name?.message}>
                <TextInput placeholder="Classic linen shirt" {...register("name")} />
              </Field>
              <Field label="Category" required error={formState.errors.category?.message}>
                <SelectInput {...register("category")}>
                  <option value="">Choose a category</option>
                  {PRODUCT_CATEGORIES.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Price (NGN)" required error={formState.errors.price?.message}>
                <TextInput inputMode="decimal" placeholder="22,500" {...register("price")} />
              </Field>
              <Field label="Compare price" error={formState.errors.comparePrice?.message} hint="Optional. Shown crossed out.">
                <TextInput inputMode="decimal" placeholder="28,000" {...register("comparePrice")} />
              </Field>
              <Field label="SKU" required error={formState.errors.sku?.message} hint="Unique in your store.">
                <TextInput placeholder="APP-101" autoCapitalize="characters" {...register("sku")} />
              </Field>
              <Field label="Stock available" error={formState.errors.stockQuantity?.message} hint={linked ? "Change stock in Inventory." : undefined}>
                <TextInput inputMode="numeric" disabled={linked} {...register("stockQuantity")} />
              </Field>
              <Field label="Visibility" className="md:col-span-2">
                <SelectInput {...register("visibility")}>
                  <option value="published">Published: customers can see it</option>
                  <option value="draft">Draft: hidden from customers</option>
                </SelectInput>
              </Field>
              <Field label="Description" error={formState.errors.description?.message} className="md:col-span-2">
                <TextArea rows={4} placeholder="Lightweight, breathable linen in a relaxed fit." {...register("description")} />
              </Field>
            </div>
            <div className="mt-6">
              <p className="text-field-label uppercase text-ink-brand">
                Product images <span aria-hidden="true">*</span>
              </p>
              <ul className="mt-3 flex flex-wrap gap-3">
                {images.map((src, i) => (
                  <li key={src} className="relative">
                    <img src={src} alt={`Product photo ${i + 1}`} className="size-24 rounded-lg object-cover" />
                    <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => setImages((prev) => prev.filter((x) => x !== src))} className="absolute -right-2 -top-2 flex size-8 items-center justify-center rounded-full bg-surface-card text-danger shadow-card">
                      <IconX aria-hidden="true" className="size-4" />
                    </button>
                  </li>
                ))}
                {images.length < MAX_IMAGES && (
                  <li>
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex size-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line-strong text-caption font-semibold text-ink-brand hover:bg-surface-pale">
                      <IconPhotoPlus aria-hidden="true" className="size-6" />
                      {uploading ? "Uploading…" : "Add photos"}
                    </button>
                  </li>
                )}
              </ul>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => void addFiles(e.target.files)} aria-label="Add product photos" />
              {imageError && (
                <p role="alert" className="mt-2 text-body-sm text-danger">
                  {imageError}
                </p>
              )}
            </div>
          </Panel>
          <ErrorNote error={formError} fallback="We couldn't save this product. Please try again." />
          <div className="flex flex-col gap-3 md:flex-row md:justify-end">
            <Button type="button" onClick={() => void submit("publish")()} loading={save.isPending} loadingText="Saving…" className="md:px-10">
              {product?.isAvailable ? "Save changes" : "Publish product"}
            </Button>
          </div>
        </form>
        <HelpPanel
          items={[
            ["Required to publish", "Name · Category · Price · SKU · a photo"],
            ["Drafts", "Saved but hidden from customers"],
            ["Inventory sync", linked ? "Linked: stock follows Inventory" : "Not linked"],
            ["Photos", `Up to ${MAX_IMAGES}, JPG/PNG/WebP, under 5 MB`],
          ]}
          callout={{ title: "Storefront preview", body: <Link to={storefrontPath(store)} className="text-ink-brand hover:underline">See how customers see your store</Link> }}
        />
      </div>
    </div>
  );
}

// ── 08.07 Product detail ──────────────────────────────────────────────────

export function StoreProductDetailPage() {
  const { id } = useParams();
  return <WithStore>{(store) => <ProductDetail store={store} id={id!} />}</WithStore>;
}

function ProductDetail({ store, id }: { store: Store; id: string }) {
  const navigate = useNavigate();
  const returnTo = useReturnTo();
  const { product: p, isLoading, error, refetch } = useStoreProduct(id);
  const save = useSaveStoreProduct(id);
  const del = useDeleteStoreProduct();
  const canEdit = useCan("manageInventory");
  const [actionError, setActionError] = useState<unknown>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (isLoading) return <Loading />;
  if (!p) return <ErrorNote error={error ?? true} fallback="We couldn't find this product." onRetry={() => void refetch()} />;
  const v = visibility(p);

  const toggle = async () => {
    setActionError(null);
    try {
      await save.mutateAsync({ isAvailable: !p.isAvailable });
    } catch (err) {
      setActionError(err);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle actions={canEdit && <Button size="md" onClick={() => navigate(`/store/products/${p._id}/edit`)}>Edit product</Button>}>{p.name}</PageTitle>
      <IntroCard eyebrow={opsEyebrow(store)} title={<span className="flex flex-wrap items-center gap-2">{categoryLabel(p.category)} <Status tone={v.tone}>{v.label}</Status></span>} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel title="Product details">
          {p.images.length > 0 && (
            <ul className="mb-5 flex gap-3 overflow-x-auto">
              {p.images.map((src, i) => (
                <li key={src} className="shrink-0">
                  <img src={src} alt={`${p.name}, photo ${i + 1}`} className="size-32 rounded-xl object-cover" />
                </li>
              ))}
            </ul>
          )}
          <DetailRows
            rows={[
              ["Selling price", naira(p.price)],
              ["Compare price", p.comparePrice ? naira(p.comparePrice) : "—"],
              ["SKU", p.sku ?? "—"],
              ["Stock", p.stockQuantity > 0 ? `${count(p.stockQuantity)} available` : "Sold out"],
              ["Inventory", p.inventoryProduct ? "Synced with Inventory" : "Store only"],
              ["Sold", count(p.totalSold)],
              ["Views", count(p.totalViews)],
              ["Description", p.description || "—"],
            ]}
          />
        </Panel>
        <Panel tone="pale" title="Actions">
          <div className="flex flex-col gap-3">
            {canEdit && (
              <Button variant="secondary" onClick={() => void toggle()} loading={save.isPending} loadingText="Saving…" disabled={!p.isAvailable && p.images.length === 0}>
                {p.isAvailable ? "Unpublish (hide from customers)" : "Publish product"}
              </Button>
            )}
            {!p.isAvailable && p.images.length === 0 && <p className="text-body-sm text-ink-muted">Add a photo before publishing.</p>}
            <ButtonLink to={`${storefrontPath(store)}/products/${p._id}`} variant="tonal">
              View in store
            </ButtonLink>
            {p.inventoryProduct && (
              <ButtonLink to={`/inventory/products/${p.inventoryProduct}`} variant="tonal">
                Open in Inventory
              </ButtonLink>
            )}
            {canEdit && (
              <Button variant="secondary" onClick={() => setConfirmDelete(true)} className="text-danger">
                <IconTrash aria-hidden="true" className="size-4" /> Remove from store
              </Button>
            )}
            <ErrorNote error={actionError} fallback="We couldn't update this product." />
          </div>
        </Panel>
      </div>
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        tone="danger"
        title={`Remove ${p.name} from your store?`}
        description={p.inventoryProduct ? "It stays in your Inventory; only the store listing is removed." : "The listing is deleted. Past orders keep their details."}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Keep product
            </Button>
            <Button
              variant="destructive"
              loading={del.isPending}
              loadingText="Removing…"
              onClick={async () => {
                try {
                  await del.mutateAsync(p._id);
                  returnTo("/store/products");
                } catch (err) {
                  setConfirmDelete(false);
                  setActionError(err);
                }
              }}
            >
              Remove product
            </Button>
          </>
        }
      />
    </div>
  );
}

// ── 08.05 Bulk product upload ─────────────────────────────────────────────

const COLUMNS = ["name", "sku", "price", "quantity", "category", "publication", "compare_price", "description", "image_url"] as const;
const TEMPLATE_CSV = `${COLUMNS.join(",")}\nClassic linen shirt,APP-101,22500,28,fashion_men,published,28000,"Lightweight, breathable linen",https://example.com/shirt.jpg\nEveryday tote bag,APP-102,12000,40,bags_accessories,draft,,,\n`;
const MAX_ROWS = 50;

/** Small CSV reader: commas, quotes ("" escapes), CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

const CATEGORY_KEYS = new Set(PRODUCT_CATEGORIES.map(([k]) => k));
const CATEGORY_BY_LABEL = new Map(PRODUCT_CATEGORIES.map(([k, l]) => [l.toLowerCase(), k]));

interface Row {
  row: number;
  input: Partial<ProductInput>;
  problems: string[];
}

/** CSV → rows with friendly problems listed before anything is sent. */
export function rowsFromCsv(text: string): { rows: Row[]; error?: string } {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], error: "The file has no product rows. Use the template's columns." };
  const head = table[0]!.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const col = (name: string) => head.indexOf(name);
  if (col("name") < 0 || col("sku") < 0 || col("price") < 0) return { rows: [], error: "The first row must include the columns name, sku and price. Download the template to start." };
  const body = table.slice(1);
  if (body.length > MAX_ROWS) return { rows: [], error: `Upload up to ${MAX_ROWS} products at a time. This file has ${body.length}.` };
  const get = (r: string[], name: string) => (col(name) >= 0 ? (r[col(name)] ?? "").trim() : "");
  return {
    rows: body.map((r, i) => {
      const problems: string[] = [];
      const price = Number(get(r, "price").replace(/[₦,\s]/g, ""));
      const qtyRaw = get(r, "quantity").replace(/[,\s]/g, "");
      const qty = qtyRaw === "" ? 0 : Number(qtyRaw);
      const compareRaw = get(r, "compare_price").replace(/[₦,\s]/g, "");
      const catRaw = get(r, "category");
      const category = CATEGORY_KEYS.has(catRaw) ? catRaw : CATEGORY_BY_LABEL.get(catRaw.toLowerCase()) ?? (catRaw ? "" : "other");
      const pub = get(r, "publication").toLowerCase();
      const image = get(r, "image_url");
      const isAvailable = pub === "" ? Boolean(image) : !["draft", "hidden", "no", "false"].includes(pub);
      if (!get(r, "name")) problems.push("Name is missing.");
      if (!get(r, "sku")) problems.push("SKU is missing.");
      if (!Number.isFinite(price) || price < 0 || get(r, "price") === "") problems.push("Price must be a number.");
      if (!Number.isInteger(qty) || qty < 0) problems.push("Quantity must be a whole number.");
      if (!category) problems.push(`Unknown category "${catRaw}".`);
      if (isAvailable && !image) problems.push("Published products need an image_url (or set publication to draft).");
      return {
        row: i + 1,
        problems,
        input: {
          name: get(r, "name"),
          sku: get(r, "sku"),
          price,
          stockQuantity: qty,
          category: category || "other",
          comparePrice: compareRaw ? Number(compareRaw) : null,
          description: get(r, "description"),
          images: image ? [image] : [],
          isAvailable,
        },
      };
    }),
  };
}

export function BulkUploadPage() {
  return <WithStore>{(store) => <BulkUpload store={store} />}</WithStore>;
}

function BulkUpload({ store }: { store: Store }) {
  const upload = useBulkUpload();
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [results, setResults] = useState<BulkResult[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const valid = rows.filter((r) => r.problems.length === 0);
  const guard = useLeaveGuard(rows.length > 0 && !results);

  const onFile = async (file?: File) => {
    setFileError(null);
    setResults(null);
    setRows([]);
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) return setFileError("Upload a .csv file. In Excel or Google Sheets use File → Save as / Download → CSV.");
    setFileName(file.name);
    const parsed = rowsFromCsv(await file.text());
    if (parsed.error) setFileError(parsed.error);
    setRows(parsed.rows);
  };

  const onImport = async () => {
    setError(null);
    try {
      const res = await upload.mutateAsync(valid.map((r) => r.input));
      // Map server rows (1..n of what we sent) back to file rows.
      setResults(res.results.map((r) => ({ ...r, row: valid[r.row - 1]?.row ?? r.row })));
    } catch (err) {
      setError(err);
    }
  };
  const created = results?.filter((r) => r.status === "created").length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {guard.dialog}
      <PageTitle
        actions={
          <Button variant="secondary" size="md" onClick={() => saveBlob(new Blob([TEMPLATE_CSV], { type: "text/csv" }), "bimanage-store-products-template.csv")}>
            <IconDownload aria-hidden="true" className="size-4" /> Download template
          </Button>
        }
      >
        Bulk upload products
      </PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Add up to {MAX_ROWS} products from a spreadsheet.</p>
      <IntroCard eyebrow={opsEyebrow(store)} title="Each row is checked on its own. Good rows are added; you'll see what to fix in the others." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Panel title="Import file" subtitle="CSV with the template's columns. Categories use the keys in the template (e.g. fashion_men).">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                <IconUpload aria-hidden="true" className="size-4" /> {fileName ? "Choose another file" : "Choose CSV file"}
              </Button>
              <p className="text-body-sm text-ink-muted">{fileName ?? "No file chosen"}</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden aria-label="Choose CSV file" onChange={(e) => void onFile(e.target.files?.[0])} />
            {fileError && (
              <p role="alert" className="mt-3 text-body-sm text-danger">
                {fileError}
              </p>
            )}
          </Panel>
          {rows.length > 0 && !results && (
            <Panel title={`${count(rows.length)} rows · ${count(valid.length)} ready`} subtitle={valid.length < rows.length ? "Rows with problems won't be imported. Fix them in your file and upload it again." : "All rows look good."}>
              <ul className="flex flex-col divide-y divide-line-subtle">
                {rows.map((r) => (
                  <li key={r.row} className="flex flex-col gap-1 py-2 md:flex-row md:items-center md:justify-between">
                    <span className="text-body-sm text-ink-strong">
                      <span className="text-ink-muted">Row {r.row}</span> · {r.input.name || "—"} · {r.input.sku || "—"} · {Number.isFinite(r.input.price) ? naira(r.input.price) : "—"} · {r.input.isAvailable ? "Published" : "Draft"}
                    </span>
                    {r.problems.length ? <span className="text-body-sm text-danger">{r.problems.join(" ")}</span> : <Status tone="success">Ready</Status>}
                  </li>
                ))}
              </ul>
              <ErrorNote error={error} fallback="We couldn't import these products. Please try again." className="mt-4" />
              <Button className="mt-5" onClick={() => void onImport()} disabled={valid.length === 0} loading={upload.isPending} loadingText="Importing…">
                Import {count(valid.length)} {valid.length === 1 ? "product" : "products"}
              </Button>
            </Panel>
          )}
          {results && (
            <Panel title={`${count(created)} added${results.length - created ? `, ${count(results.length - created)} need fixing` : ""}`}>
              <ul className="flex flex-col divide-y divide-line-subtle">
                {results.map((r) => (
                  <li key={r.row} className="flex flex-col gap-1 py-2 md:flex-row md:items-center md:justify-between">
                    <span className="text-body-sm text-ink-strong">
                      Row {r.row}
                      {r.product ? ` · ${r.product.name}` : ""}
                    </span>
                    {r.status === "created" ? <Status tone="success">Added</Status> : <span className="text-body-sm text-danger">{(r.errors ?? []).map((e) => e.message).join(" ")}</span>}
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-col gap-3 md:flex-row">
                <ButtonLink to="/store/products">See store products</ButtonLink>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setRows([]);
                    setResults(null);
                    setFileName(null);
                  }}
                >
                  Upload another file
                </Button>
              </div>
            </Panel>
          )}
        </div>
        <HelpPanel
          items={[
            ["Batch size", `Up to ${MAX_ROWS} rows`],
            ["Required columns", "name · sku · price"],
            ["Optional", "quantity · category · publication · compare_price · description · image_url"],
            ["Publication", "published (needs image_url) or draft"],
          ]}
        />
      </div>
    </div>
  );
}

// ── 08.06 Inventory synchronization ───────────────────────────────────────

export function SyncInventoryPage() {
  return <WithStore>{(store) => <SyncInventory store={store} />}</WithStore>;
}

function SyncInventory({ store }: { store: Store }) {
  const inventory = useProducts();
  const storeProducts = useStoreProducts();
  const sync = useSyncInventory();
  const [q, setQ] = useUrlState<string>("q", "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const linked = new Set((storeProducts.data ?? []).map((p) => p.inventoryProduct).filter(Boolean) as string[]);
  const list = (inventory.data ?? []).filter((p) => !q.trim() || [p.name, p.sku, p.category].some((v) => v?.toLowerCase().includes(q.trim().toLowerCase())));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onSync = async () => {
    setError(null);
    setResult(null);
    try {
      const res = await sync.mutateAsync([...selected]);
      const added = res.results.filter((r) => r.action === "created").length;
      setResult(`${count(added)} added to your store, ${count(res.results.length - added)} updated.`);
      setSelected(new Set());
    } catch (err) {
      setError(err);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        actions={
          <Button size="md" onClick={() => void onSync()} disabled={selected.size === 0} loading={sync.isPending} loadingText="Syncing…">
            Sync {count(selected.size)} selected
          </Button>
        }
      >
        Sync from inventory
      </PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Bring products over from Inventory. Price and stock stay in step with it.</p>
      <IntroCard eyebrow={opsEyebrow(store)} title="Synced products use your inventory stock, so you never sell what you don't have." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)]">
        <Panel>
          <label className="flex h-control-lg items-center gap-2 rounded-md bg-surface-pale px-3">
            <IconSearch aria-hidden="true" className="size-icon text-ink-muted" />
            <span className="sr-only">Search inventory</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search inventory…" className="h-full flex-1 bg-transparent text-input text-ink-strong outline-none placeholder:text-ink-muted" />
          </label>
          {inventory.isLoading ? (
            <Loading />
          ) : inventory.error ? (
            <ErrorNote error={inventory.error} fallback="We couldn't load your inventory." onRetry={() => void inventory.refetch()} className="mt-4" />
          ) : list.length === 0 ? (
            <div className="mt-6 flex flex-col items-start gap-3">
              <p className="text-body-sm text-ink-muted">{(inventory.data ?? []).length ? "No inventory products match your search." : "Your inventory is empty."}</p>
              {!(inventory.data ?? []).length && <ButtonLink to="/inventory/products/new" size="md">Add an inventory product</ButtonLink>}
            </div>
          ) : (
            <ul className="mt-4 flex flex-col divide-y divide-line-subtle">
              {list.map((p) => (
                <li key={p._id}>
                  <label className="grid min-h-14 cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 py-2">
                    <input type="checkbox" className="size-5 accent-brand-navy" checked={selected.has(p._id)} onChange={() => toggle(p._id)} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink-strong">{p.name}</span>
                      <span className="block truncate text-body-sm text-ink-muted">
                        {p.sku ? `${p.sku} · ` : ""}
                        {naira(p.sellingPrice)} · {count(p.stockQuantity)} in stock
                      </span>
                    </span>
                    <Status tone={linked.has(p._id) ? "success" : "neutral"}>{linked.has(p._id) ? "In store" : "Not in store"}</Status>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {result && (
            <p role="status" className="mt-4 text-body-sm text-success-ink">
              {result}
            </p>
          )}
          <ErrorNote error={error} fallback="We couldn't sync these products. Please try again." className="mt-4" />
        </Panel>
        <HelpPanel
          items={[
            ["Selected", count(selected.size)],
            ["Already in store", count(linked.size)],
            ["Stock", "Always from Inventory"],
            ["Photos", "Inventory photo is copied; add more in the store"],
          ]}
        />
      </div>
    </div>
  );
}
