import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { IconCheck, IconCircle, IconMinus, IconPlus, IconSearch, IconShoppingBag, IconTrash } from "@tabler/icons-react";
import { Button, ButtonLink, EmailSuggestion, Field, SelectInput, Spinner, Status, TextArea, TextInput } from "@/components/ui";
import { suggestEmail } from "@/lib/emailTypos";
import { hasInAppHistory } from "@/lib/nav/history";
import { DetailRows, Panel } from "@/components/page/Blocks";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { ApiError } from "@/lib/api/client";
import { applyFieldErrors } from "@/lib/api/errorMessage";
import { count, naira } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useUrlState } from "@/lib/nav/useUrlState";
import { useLeaveGuard } from "@/lib/nav/useLeaveGuard";
import {
  PRODUCT_CATEGORIES,
  categoryLabel,
  isPaymentsUnavailable,
  retryStorePayment,
  startCheckout,
  storeKeys,
  trackStoreOrder,
  useCart,
  useCartActions,
  usePublicProduct,
  verifyStorePayment,
  browser,
  type PublicOrder,
  type PublicProduct,
  type StoreOrderStatus,
} from "@/lib/store/api";
import { useShopProduct, useShopProducts, useStorefront } from "./StorefrontLayout";

const Loading = ({ label = "Loading…" }: { label?: string }) => (
  <div className="flex justify-center py-16 text-ink-brand" role="status">
    <Spinner className="size-8" />
    <span className="sr-only">{label}</span>
  </div>
);

/** Page heading block used on every storefront page (pale card, title + line). */
function Hero({ title, children, tone = "pale" }: { title: string; children?: ReactNode; tone?: "pale" | "blue" | "brand" }) {
  return (
    <section className={cn("rounded-2xl px-5 py-6 lg:px-7 lg:py-8", tone === "brand" ? "bg-gradient-brand-panel text-ink-on-brand" : tone === "blue" ? "bg-surface-tint-blue" : "bg-surface-pale")}>
      <h1 className={cn("text-title-lg lg:text-page-title", tone === "brand" ? "text-ink-on-brand" : "text-ink-strong")}>{title}</h1>
      {children && <div className={cn("mt-2 text-body-lg", tone === "brand" ? "text-ink-on-brand-muted" : "text-ink-muted")}>{children}</div>}
    </section>
  );
}

/** Why a shopper can't buy right now (or null if they can). */
function useBuyBlock(): string | null {
  const { store, preview } = useStorefront();
  if (preview) return "Preview only: buying is turned off until you publish your store.";
  if (store.paymentsComingSoon) return "Online payment is coming soon for this store. Contact the store to order.";
  if (!store.acceptingOrders) return "This store isn't taking online orders yet. Contact the store to order.";
  return null;
}

function ContactStore() {
  const { store } = useStorefront();
  if (!store.contactEmail && !store.contactPhone) return null;
  return (
    <p className="text-body-sm text-ink-secondary">
      Contact {store.storeName}:{" "}
      {store.contactEmail && (
        <a href={`mailto:${store.contactEmail}`} className="font-semibold text-ink-brand hover:underline">
          {store.contactEmail}
        </a>
      )}
      {store.contactEmail && store.contactPhone && " · "}
      {store.contactPhone && (
        <a href={`tel:${store.contactPhone.replace(/\s+/g, "")}`} className="font-semibold text-ink-brand hover:underline">
          {store.contactPhone}
        </a>
      )}
    </p>
  );
}

const ProductImage = ({ p, className }: { p: Pick<PublicProduct, "images" | "name">; className?: string }) =>
  p.images[0] ? <img src={p.images[0]} alt={p.name} loading="lazy" className={cn("w-full rounded-xl object-cover", className)} /> : <div aria-hidden="true" className={cn("w-full rounded-xl bg-surface-tint-blue", className)} />;

// ── 08.11 / 08.12 Storefront home, search and filters ─────────────────────

const PRICES: Array<[string, string, string?, string?]> = [
  ["any", "Price: Any"],
  ["u10", "Under ₦10,000", undefined, "9999.99"],
  ["10-50", "₦10,000 – ₦50,000", "10000", "50000"],
  ["o50", "Over ₦50,000", "50000.01"],
];

export function StorefrontHomePage() {
  const { slug, store } = useStorefront();
  const [params] = useSearchParams();
  const [search, setSearch] = useUrlState<string>("q", "");
  const [category, setCategory] = useUrlState<string>("category", "");
  const [price, setPrice] = useUrlState<string>("price", "any", PRICES.map(([k]) => k));
  const [stock, setStock] = useUrlState<"all" | "in">("stock", "all", ["all", "in"]);
  const [typed, setTyped] = useState(search);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (params.get("focus") === "search") searchRef.current?.focus();
  }, [params]);
  const p = PRICES.find(([k]) => k === price)!;
  const q: Record<string, string> = {};
  if (search) q.search = search;
  if (category) q.category = category;
  if (p[2]) q.minPrice = p[2];
  if (p[3]) q.maxPrice = p[3];
  const products = useShopProducts(q);
  const all = useShopProducts({});
  const categories = [...new Set((all.data ?? []).map((x) => x.category))];
  const list = (products.data ?? []).filter((x) => stock === "all" || x.inStock);
  const filtered = Boolean(search || category || price !== "any" || stock !== "all");
  const featured = store.template === "premium" ? (all.data ?? []).filter((x) => x.isFeatured).slice(0, 3) : [];

  return (
    <div className="flex flex-col gap-6">
      <Hero title={store.description ? store.storeName : "Shop the collection"} tone={store.template === "premium" ? "brand" : store.template === "standard" ? "blue" : "pale"}>
        {store.description ?? "Browse products and add them to your bag."}
      </Hero>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(typed.trim());
        }}
        className="grid gap-2 rounded-2xl border border-line-card bg-surface-card p-3 md:grid-cols-[2fr_1fr_1fr_auto]"
      >
        <label className="flex h-control-lg items-center gap-2 rounded-md bg-surface-pale px-3">
          <IconSearch aria-hidden="true" className="size-icon text-ink-muted" />
          <span className="sr-only">Search products</span>
          <input
            ref={searchRef}
            type="search"
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value);
              if (!e.target.value) setSearch("");
            }}
            placeholder="Search products"
            className="h-full flex-1 bg-transparent text-input text-ink-strong outline-none placeholder:text-ink-muted"
          />
        </label>
        <label className="contents">
          <span className="sr-only">Category</span>
          <SelectInput value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {PRODUCT_CATEGORIES.filter(([k]) => categories.includes(k) || k === category).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </SelectInput>
        </label>
        <label className="contents">
          <span className="sr-only">Price</span>
          <SelectInput value={price} onChange={(e) => setPrice(e.target.value)}>
            {PRICES.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </SelectInput>
        </label>
        <label className="flex h-control-lg items-center gap-2 rounded-md bg-surface-pale px-3 text-action font-semibold text-ink-brand">
          <input type="checkbox" className="size-5 accent-brand-navy" checked={stock === "in"} onChange={(e) => setStock(e.target.checked ? "in" : "all")} />
          In stock
        </label>
      </form>

      {featured.length > 0 && !filtered && (
        <section aria-labelledby="featured">
          <h2 id="featured" className="text-title-md text-ink-strong">
            Featured
          </h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-3">{featured.map((x) => <ProductCard key={x._id} p={x} slug={slug} />)}</ul>
        </section>
      )}

      <section aria-labelledby="collection">
        <h2 id="collection" className="text-title-md text-ink-strong">
          {filtered ? "Search results" : "Shop the collection"}
        </h2>
        <p className="mt-1 text-body-sm text-ink-muted">{filtered ? `${count(list.length)} ${list.length === 1 ? "product" : "products"}` : "Open an item to see details and add it to your bag."}</p>
        {products.isLoading ? (
          <Loading label="Loading products…" />
        ) : products.error ? (
          <ErrorNote error={products.error} fallback="We couldn't load products. Please try again." onRetry={() => void products.refetch()} className="mt-4" />
        ) : list.length === 0 ? (
          <div className="mt-6 flex flex-col items-start gap-3 rounded-xl bg-surface-pale p-5">
            <p className="text-body-lg font-semibold text-ink-strong">{filtered ? "No products match your filters" : "No products yet"}</p>
            {filtered && (
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setTyped("");
                  setSearch("");
                  setCategory("");
                  setPrice("any");
                  setStock("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <ul className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{list.map((x) => <ProductCard key={x._id} p={x} slug={slug} />)}</ul>
        )}
      </section>
    </div>
  );
}

function ProductCard({ p, slug }: { p: PublicProduct; slug: string }) {
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-line-card bg-surface-card p-3 shadow-card">
      <ProductImage p={p} className="aspect-[4/3]" />
      <div className="flex flex-col gap-1 px-1">
        <h3 className="text-card-heading text-ink-strong">{p.name}</h3>
        <p className="text-body-sm text-ink-muted">{categoryLabel(p.category)}</p>
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 px-1 pb-1">
        <p className="text-title-sm text-ink-brand">
          {naira(p.price)}
          {p.comparePrice && p.comparePrice > p.price ? <span className="ml-2 text-body-sm text-ink-muted line-through">{naira(p.comparePrice)}</span> : null}
        </p>
        {p.inStock ? (
          <ButtonLink to={`/s/${slug}/products/${p._id}`} size="md" aria-label={`View details: ${p.name}`}>
            View details →
          </ButtonLink>
        ) : (
          <Status tone="neutral">Sold out</Status>
        )}
      </div>
    </li>
  );
}

// ── 08.13 Public product detail ───────────────────────────────────────────

export function StorefrontProductPage() {
  const { productId = "" } = useParams();
  const { slug, store, preview } = useStorefront();
  const pub = usePublicProduct(slug, productId);
  const own = useShopProduct(productId);
  const p = preview ? own : pub.data;
  const { add } = useCartActions(slug);
  const block = useBuyBlock();
  const [qty, setQty] = useState(1);
  const [photo, setPhoto] = useState(0);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (!preview && pub.isLoading) return <Loading />;
  if (!preview && pub.error) return <ErrorNote error={pub.error} fallback="We couldn't load this product." onRetry={() => void pub.refetch()} />;
  if (!p) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Hero title="This product isn't available">It may have sold out or been removed.</Hero>
        <ButtonLink to={`/s/${slug}`}>Explore products</ButtonLink>
      </div>
    );
  }
  const min = Math.max(1, p.minimumOrderQuantity ?? 1);

  const onAdd = async () => {
    setError(null);
    setAdded(false);
    try {
      await add.mutateAsync({ productId: p._id, quantity: Math.max(qty, min) });
      setAdded(true);
    } catch (err) {
      setError(err);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Hero title={p.name}>
        {categoryLabel(p.category)} · {store.storeName}
      </Hero>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Product gallery and details">
          <ProductImage p={{ ...p, images: p.images.slice(photo, photo + 1).concat(p.images).slice(0, 1) }} className="aspect-[4/3]" />
          {p.images.length > 1 && (
            <ul className="mt-3 flex gap-2 overflow-x-auto" aria-label="More photos">
              {p.images.map((src, i) => (
                <li key={src}>
                  <button type="button" onClick={() => setPhoto(i)} aria-label={`Photo ${i + 1}`} aria-pressed={photo === i} className={cn("rounded-lg border-2", photo === i ? "border-brand-navy" : "border-transparent")}>
                    <img src={src} alt="" className="size-16 rounded-md object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {p.description && <p className="mt-5 whitespace-pre-line text-body-lg text-ink-secondary">{p.description}</p>}
        </Panel>
        <Panel title="Choose your options">
          <p className="text-metric text-ink-brand">
            {naira(p.price)}
            {p.comparePrice && p.comparePrice > p.price ? <span className="ml-3 text-body-lg text-ink-muted line-through">{naira(p.comparePrice)}</span> : null}
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <div className="rounded-md bg-surface-pale px-4 py-3">
              <p id="qty-label" className="text-caption font-semibold uppercase text-ink-brand">
                Quantity
              </p>
              <div role="group" aria-labelledby="qty-label" className="mt-1 flex items-center gap-3">
                <button type="button" aria-label="One fewer" disabled={qty <= min} onClick={() => setQty((n) => Math.max(min, n - 1))} className="flex size-11 items-center justify-center rounded-md text-ink-brand hover:bg-surface-tonal disabled:opacity-40">
                  <IconMinus aria-hidden="true" className="size-5" />
                </button>
                <output aria-live="polite" className="min-w-8 text-center text-body-lg font-semibold text-ink-strong">
                  {Math.max(qty, min)}
                </output>
                <button type="button" aria-label="One more" disabled={!p.inStock} onClick={() => setQty((n) => Math.min(999, n + 1))} className="flex size-11 items-center justify-center rounded-md text-ink-brand hover:bg-surface-tonal disabled:opacity-40">
                  <IconPlus aria-hidden="true" className="size-5" />
                </button>
              </div>
              {min > 1 && <p className="text-caption text-ink-muted">Minimum {count(min)} per order.</p>}
            </div>
            <div className="rounded-md bg-surface-pale px-4 py-3">
              <p className="text-caption font-semibold uppercase text-ink-brand">Availability</p>
              <p className="mt-1 text-body-lg text-ink-strong">{!p.inStock ? "Sold out" : p.lowStock ? "Only a few left" : "In stock"}</p>
            </div>
          </div>
          <p className="mt-4 text-body-sm text-ink-muted">Secure checkout and order tracking included. No account needed.</p>
          {block ? (
            <div className="mt-4 flex flex-col gap-2 rounded-md bg-surface-tint-warm px-4 py-3">
              <p className="text-body-sm font-semibold text-ink-strong">{block}</p>
              <ContactStore />
            </div>
          ) : (
            <Button fullWidth className="mt-4" disabled={!p.inStock} onClick={() => void onAdd()} loading={add.isPending} loadingText="Adding…">
              {p.inStock ? "Add to bag →" : "Sold out"}
            </Button>
          )}
          {added && (
            <p role="status" className="mt-3 flex flex-wrap items-center gap-2 text-body-sm text-success-ink">
              <IconCheck aria-hidden="true" className="size-4" /> Added to your bag.
              <Link to={`/s/${slug}/cart`} className="font-semibold text-ink-brand hover:underline">
                View bag
              </Link>
            </p>
          )}
          <ErrorNote error={error} fallback="We couldn't add this to your bag. Please try again." className="mt-3" />
        </Panel>
      </div>
    </div>
  );
}

// ── 08.14 Shopping bag / 08.20 empty bag ──────────────────────────────────

function EmptyBag() {
  const { slug } = useStorefront();
  return (
    <div className="flex flex-col gap-6">
      <Hero title="Your bag is empty">Add products to your bag to check out. No account needed.</Hero>
      <Panel>
        <div className="flex flex-col items-start gap-4">
          <IconShoppingBag aria-hidden="true" className="size-10 text-ink-brand" />
          <DetailRows
            rows={[
              ["Bag", "No items yet"],
              ["Checkout", "Guest checkout, no account needed"],
              ["Payment", "Secure Paystack payment"],
            ]}
          />
          <ButtonLink to={`/s/${slug}`}>Explore products</ButtonLink>
        </div>
      </Panel>
    </div>
  );
}

export function CartPage() {
  const { slug, preview } = useStorefront();
  const cart = useCart(slug);
  const { update, remove } = useCartActions(slug);
  const block = useBuyBlock();
  const [error, setError] = useState<unknown>(null);
  if (preview) return <EmptyBag />;
  if (cart.isLoading) return <Loading label="Loading your bag…" />;
  if (cart.error) return <ErrorNote error={cart.error} fallback="We couldn't load your bag." onRetry={() => void cart.refetch()} />;
  const c = cart.data;
  if (!c || c.items.length === 0) return <EmptyBag />;

  const setQty = async (productId: string, quantity: number) => {
    setError(null);
    try {
      await (quantity === 0 ? remove.mutateAsync(productId) : update.mutateAsync({ productId, quantity }));
    } catch (err) {
      setError(err);
    }
  };
  const short = c.items.some((i) => i.quantity < i.requested);
  const toFree = c.freeDeliveryAbove && c.deliveryFee > 0 ? c.freeDeliveryAbove - c.subtotal : 0;

  return (
    <div className="flex flex-col gap-6">
      <Hero title="Your bag">
        {count(c.itemCount)} {c.itemCount === 1 ? "item" : "items"}
      </Hero>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Items">
          <ul className="flex flex-col divide-y divide-line-subtle">
            {c.items.map((i) => (
              <li key={i.product._id} className="grid grid-cols-[4rem_1fr] gap-3 py-3 md:grid-cols-[4rem_1fr_auto]">
                <ProductImage p={i.product} className="size-16" />
                <div className="min-w-0">
                  <Link to={`/s/${slug}/products/${i.product._id}`} className="font-semibold text-ink-strong hover:underline">
                    {i.product.name}
                  </Link>
                  <p className="text-body-sm text-ink-muted">{naira(i.product.price)} each</p>
                  {i.quantity < i.requested && <p className="text-body-sm text-danger">{i.available > 0 ? `Only ${count(i.available)} left. We've adjusted your bag.` : "Sold out. Remove it to continue."}</p>}
                </div>
                <div className="col-span-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 md:col-span-1 md:flex-col md:items-end">
                  <div role="group" aria-label={`Quantity of ${i.product.name}`} className="flex items-center gap-1 rounded-md bg-surface-pale">
                    <button type="button" aria-label="One fewer" onClick={() => void setQty(i.product._id, i.quantity - 1)} className="flex size-11 items-center justify-center text-ink-brand">
                      <IconMinus aria-hidden="true" className="size-4" />
                    </button>
                    <output className="min-w-6 text-center font-semibold text-ink-strong">{i.quantity}</output>
                    <button type="button" aria-label="One more" disabled={i.quantity >= i.available} onClick={() => void setQty(i.product._id, i.quantity + 1)} className="flex size-11 items-center justify-center text-ink-brand disabled:opacity-40">
                      <IconPlus aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                  <p className="font-semibold text-ink-strong">{naira(i.lineTotal)}</p>
                  <button type="button" onClick={() => void setQty(i.product._id, 0)} className="flex min-h-11 items-center gap-1 text-body-sm font-semibold text-danger">
                    <IconTrash aria-hidden="true" className="size-4" /> Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <ErrorNote error={error} fallback="We couldn't update your bag." className="mt-3" />
        </Panel>
        <Panel title="Order summary">
          <DetailRows
            rows={[
              ["Items subtotal", naira(c.subtotal)],
              ["Delivery", c.deliveryFee ? naira(c.deliveryFee) : "Free"],
              ["Order total", <strong key="t">{naira(c.total)}</strong>],
            ]}
          />
          {toFree > 0 && <p className="mt-3 text-body-sm text-ink-secondary">Add {naira(toFree)} more for free delivery.</p>}
          {block ? (
            <div className="mt-4 flex flex-col gap-2 rounded-md bg-surface-tint-warm px-4 py-3">
              <p className="text-body-sm font-semibold text-ink-strong">{block}</p>
              <ContactStore />
            </div>
          ) : (
            <ButtonLink to={`/s/${slug}/checkout`} fullWidth className={cn("mt-5", short && c.items.every((i) => i.quantity === 0) && "pointer-events-none opacity-50")}>
              Proceed to checkout
            </ButtonLink>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ── 08.15 Guest checkout ──────────────────────────────────────────────────

const checkoutSchema = z.object({
  customerName: z.string().trim().min(2, "Enter your full name.").max(100),
  customerEmail: z.string().trim().email("Enter a valid email address."),
  customerPhone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number."),
  deliveryAddress: z.string().trim().min(5, "Enter your full delivery address.").max(300),
  city: z.string().trim().min(2, "Enter your city.").max(80),
  state: z.string().trim().min(2, "Enter your state.").max(80),
  notes: z.string().trim().max(500).optional(),
});
type CheckoutValues = z.infer<typeof checkoutSchema>;
const CHECKOUT_EMAIL = "bimanage.checkout.email";

export function CheckoutPage() {
  const { slug } = useStorefront();
  const cart = useCart(slug);
  const block = useBuyBlock();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [formError, setFormError] = useState<unknown>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [paying, setPaying] = useState(false);
  const { register, handleSubmit, setError, setValue, getValues, watch, formState } = useForm<CheckoutValues>({ resolver: zodResolver(checkoutSchema) });
  const guard = useLeaveGuard(formState.isDirty && !redirecting);
  const email = watch("customerEmail");

  if (cart.isLoading) return <Loading label="Loading your bag…" />;
  const c = cart.data;
  if (!c || c.items.length === 0) return <EmptyBag />;

  // Step 2 (?step=review) is a real URL, so Back returns to the details. After a
  // refresh the form is empty, so it starts again at the details.
  const reviewing = params.get("step") === "review" && Boolean(getValues("customerEmail"));
  const backToDetails = () => (params.get("step") === "review" && hasInAppHistory() ? navigate(-1) : setParams({}, { replace: true }));

  const toReview = handleSubmit(() => {
    setFormError(null);
    setParams({ step: "review" });
  });

  const pay = async () => {
    const v = getValues();
    setFormError(null);
    setUnavailable(false);
    setPaying(true);
    try {
      const res = await startCheckout(slug, { ...v, customerEmail: v.customerEmail.trim(), notes: v.notes || undefined });
      try {
        sessionStorage.setItem(CHECKOUT_EMAIL, v.customerEmail);
      } catch {
        /* ignore */
      }
      guard.allow();
      setRedirecting(true);
      browser.go(res.authorizationUrl);
    } catch (err) {
      setPaying(false);
      if (isPaymentsUnavailable(err)) setUnavailable(true);
      else if (applyFieldErrors(err, setError, ["customerName", "customerEmail", "customerPhone", "deliveryAddress", "city", "state", "notes"])) setParams({}, { replace: true });
      else setFormError(err);
      void cart.refetch();
    }
  };

  const field = (name: keyof CheckoutValues) => formState.errors[name]?.message;
  const v = getValues();
  const typo = reviewing ? suggestEmail(v.customerEmail ?? "") : null;
  return (
    <div className="flex flex-col gap-6">
      {guard.dialog}
      <Hero title={reviewing ? "Check your details" : "Secure guest checkout"}>
        {reviewing ? "Step 2 of 2 · Make sure your email is right: your receipt and tracking link go there." : "Step 1 of 2 · No account required · Your delivery details stay protected"}
      </Hero>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {reviewing ? (
          <Panel title="Review your order">
            <section aria-labelledby="confirm-email" className="rounded-xl bg-surface-tint-blue px-4 py-4">
              <h3 id="confirm-email" className="text-caption font-semibold uppercase text-ink-brand">
                Is this your email?
              </h3>
              <p className="mt-1 break-all text-title-sm text-ink-strong" data-testid="review-email">
                {v.customerEmail}
              </p>
              <p className="mt-1 text-body-sm text-ink-secondary">We&apos;ll send your receipt and tracking link here. If it&apos;s wrong, you won&apos;t get them.</p>
              {typo && (
                <div role="alert" className="mt-3 flex flex-col gap-2 rounded-md bg-surface-tint-warm px-3 py-2 md:flex-row md:items-center md:justify-between">
                  <p className="text-body-sm text-ink-strong">
                    Did you mean <strong>{typo}</strong>?
                  </p>
                  <Button size="md" variant="secondary" onClick={() => setValue("customerEmail", typo, { shouldDirty: true })}>
                    Use {typo}
                  </Button>
                </div>
              )}
            </section>
            <div className="mt-4">
              <DetailRows
                rows={[
                  ["Name", v.customerName],
                  ["Phone", v.customerPhone],
                  ["Deliver to", [v.deliveryAddress, v.city, v.state].filter(Boolean).join(", ")],
                  ...(v.notes ? ([["Note", v.notes]] as Array<[string, string]>) : []),
                ]}
              />
            </div>
            <Button variant="secondary" size="md" className="mt-5" onClick={backToDetails}>
              Edit details
            </Button>
          </Panel>
        ) : (
          <form id="checkout" noValidate onSubmit={toReview} className="flex flex-col gap-5">
            <Panel title="Delivery and contact details" subtitle="Guest checkout · no account creation needed">
              <div className="grid gap-4 md:grid-cols-2 md:gap-x-8 md:gap-y-5">
                <Field label="Full name" required error={field("customerName")}>
                  <TextInput autoComplete="name" {...register("customerName")} />
                </Field>
                <div className="flex flex-col gap-1">
                  <Field label="Email address" required error={field("customerEmail")} hint="Your receipt and tracking link go here.">
                    <TextInput type="email" autoComplete="email" inputMode="email" {...register("customerEmail")} />
                  </Field>
                  <EmailSuggestion value={email} onAccept={(e) => setValue("customerEmail", e, { shouldDirty: true, shouldValidate: true })} />
                </div>
                <Field label="Phone number" required error={field("customerPhone")}>
                  <TextInput type="tel" autoComplete="tel" placeholder="+234 803 000 0000" {...register("customerPhone")} />
                </Field>
                <Field label="Delivery address" required error={field("deliveryAddress")} className="md:col-span-2">
                  <TextInput autoComplete="street-address" {...register("deliveryAddress")} />
                </Field>
                <Field label="City" required error={field("city")}>
                  <TextInput autoComplete="address-level2" {...register("city")} />
                </Field>
                <Field label="State" required error={field("state")}>
                  <TextInput autoComplete="address-level1" {...register("state")} />
                </Field>
                <Field label="Delivery note" error={field("notes")} className="md:col-span-2">
                  <TextArea rows={2} placeholder="Optional directions for the courier" {...register("notes")} />
                </Field>
              </div>
              <div className="mt-5 rounded-xl bg-surface-tint-blue px-4 py-3">
                <p className="font-semibold text-ink-brand">Payment provider: Paystack</p>
                <p className="text-body-sm text-ink-secondary">You&apos;ll check your details, then go to a secure payment page to finish your order.</p>
              </div>
            </Panel>
          </form>
        )}
        <Panel title="Order summary">
          <ul className="flex flex-col gap-2 text-body-sm">
            {c.items.map((i) => (
              <li key={i.product._id} className="flex justify-between gap-3 rounded-md border border-line-subtle px-3 py-2">
                <span className="text-ink-secondary">
                  {i.product.name} × {i.quantity}
                </span>
                <span className="font-semibold text-ink-brand">{naira(i.lineTotal)}</span>
              </li>
            ))}
            <li className="flex justify-between gap-3 rounded-md border border-line-subtle px-3 py-2">
              <span className="text-ink-secondary">Delivery</span>
              <span className="font-semibold text-ink-brand">{c.deliveryFee ? naira(c.deliveryFee) : "Free"}</span>
            </li>
            <li className="flex justify-between gap-3 rounded-md border border-line-subtle px-3 py-2">
              <span className="text-ink-secondary">Amount due</span>
              <span className="font-semibold text-ink-brand">{naira(c.total)}</span>
            </li>
          </ul>
          <p className="mt-3 text-body-sm text-ink-muted">Order confirmation and tracking will be sent to the email you give.</p>
          {block || unavailable ? (
            <div className="mt-4 flex flex-col gap-2 rounded-md bg-surface-tint-warm px-4 py-3">
              <p className="text-body-sm font-semibold text-ink-strong">{block ?? "Online payment is coming soon for this store. Contact the store to order."}</p>
              <ContactStore />
            </div>
          ) : reviewing ? (
            <Button fullWidth className="mt-4" onClick={() => void pay()} loading={paying || redirecting} loadingText={redirecting ? "Opening Paystack…" : "Reserving your items…"}>
              Confirm and pay with Paystack →
            </Button>
          ) : (
            <Button type="submit" form="checkout" fullWidth className="mt-4">
              Review order →
            </Button>
          )}
          <ErrorNote error={formError} fallback="We couldn't start your payment. Please try again." className="mt-3" />
          {formError instanceof ApiError && formError.status === 409 && (
            <Link to={`/s/${slug}/cart`} className="mt-2 inline-block text-body-sm font-semibold text-ink-brand hover:underline">
              Review your bag
            </Link>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ── 08.16 / 08.17 / 08.18 Payment result ──────────────────────────────────

export function PaymentPage() {
  const { slug, store } = useStorefront();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const reference = params.get("reference") ?? params.get("trxref") ?? "";
  const [state, setState] = useState<{ status: "checking" | "paid" | "failed" | "pending" | "missing"; order?: PublicOrder }>({ status: reference ? "checking" : "missing" });
  const [error, setError] = useState<unknown>(null);
  const [retrying, setRetrying] = useState(false);
  const tries = useRef(0);

  const check = async () => {
    setError(null);
    setState((s) => ({ ...s, status: "checking" }));
    try {
      const res = await verifyStorePayment(slug, reference);
      setState({ status: res.status, order: res.order });
      if (res.status === "paid") void qc.invalidateQueries({ queryKey: storeKeys.cart(slug) });
      // Paystack can take a few seconds; check again on its own twice.
      if (res.status === "pending" && tries.current < 2) {
        tries.current += 1;
        setTimeout(() => void check(), 4000);
      }
    } catch (err) {
      setError(err);
      setState((s) => ({ ...s, status: err instanceof ApiError && err.status === 404 ? "missing" : "pending" }));
    }
  };
  useEffect(() => {
    if (reference) void check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  const retry = async () => {
    const o = state.order;
    if (!o) return;
    setError(null);
    setRetrying(true);
    try {
      const res = await retryStorePayment(slug, o.trackingNo, o.customerEmail);
      browser.go(res.authorizationUrl);
    } catch (err) {
      setRetrying(false);
      setError(err);
    }
  };

  const o = state.order;
  const rows: Array<[string, ReactNode]> = o
    ? [
        ["Order", o.trackingNo],
        [state.status === "paid" ? "Total paid" : "Amount", naira(o.total)],
        ["Receipt", o.customerEmail],
        ["Store", store.storeName],
      ]
    : [];

  if (state.status === "checking" && !o) return <Loading label="Checking your payment…" />;
  if (state.status === "missing") {
    return (
      <div className="flex flex-col items-start gap-4">
        <Hero title="We couldn't find this payment">If you were charged, your receipt email has your order number. You can track it below.</Hero>
        <ButtonLink to={`/s/${slug}/track`}>Track an order</ButtonLink>
        <ContactStore />
      </div>
    );
  }
  const title = state.status === "paid" ? "Payment successful" : state.status === "failed" ? "Payment not completed" : "Verifying your payment";
  const line = state.status === "paid" ? "Your order has been confirmed." : state.status === "failed" ? "You weren't charged for this attempt. Your items are held for a short time, so you can try again." : "This usually takes a few seconds. Don't pay twice.";

  return (
    <div className="flex flex-col gap-6">
      <Hero title={title}>{line}</Hero>
      <section aria-live="polite" className="mx-auto w-full max-w-3xl rounded-2xl border border-line-card bg-surface-card p-5 shadow-card lg:p-8">
        <h2 className="text-title-md text-ink-strong">{state.status === "paid" ? `Thanks for shopping with ${store.storeName}` : `Order with ${store.storeName}`}</h2>
        <p className="mt-2 text-body-lg text-ink-muted">{state.status === "paid" ? "A receipt and your tracking details were sent by email." : state.status === "failed" ? "Use the button below to pay with the same order." : "We're confirming the payment with Paystack."}</p>
        <div className="mt-5">
          <DetailRows rows={rows} />
        </div>
        <ErrorNote error={error} fallback="Something went wrong. Please try again." className="mt-4" />
        <div className="mt-6 flex flex-col gap-3 md:flex-row">
          {state.status === "paid" && o && <ButtonLink to={`/s/${slug}/track?order=${encodeURIComponent(o.trackingNo)}`}>Track order</ButtonLink>}
          {state.status === "failed" && o && (
            <Button onClick={() => void retry()} loading={retrying} loadingText="Opening Paystack…">
              Retry payment
            </Button>
          )}
          {(state.status === "pending" || state.status === "checking") && (
            <Button onClick={() => void check()} loading={state.status === "checking"} loadingText="Checking…">
              Check payment status
            </Button>
          )}
          <ButtonLink to={`/s/${slug}`} variant="secondary">
            Continue shopping
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}

// ── 08.19 Guest order tracking ────────────────────────────────────────────

const TIMELINE: Array<{ key: string; title: string; body: string; reached: (o: PublicOrder) => boolean }> = [
  { key: "placed", title: "Order placed", body: "Purchase recorded", reached: () => true },
  { key: "paid", title: "Payment verified", body: "Paystack confirmation received", reached: (o) => o.isPaid },
  { key: "processing", title: "Order processing", body: "The store is preparing your items", reached: (o) => ["processing", "shipped", "delivered", "completed"].includes(o.status) },
  { key: "shipped", title: "Dispatched", body: "On its way to you", reached: (o) => ["shipped", "delivered", "completed"].includes(o.status) },
  { key: "delivered", title: "Delivered", body: "You've received your order", reached: (o) => ["delivered", "completed"].includes(o.status) },
];
type PayState = NonNullable<PublicOrder["payment"]>["state"];

/** Where an order stands (from the server's payment summary; older servers: from the status). */
function payStateOf(o: PublicOrder): { state: PayState; holdExpiresAt: string | null; canRetryPayment: boolean } {
  if (o.payment) return o.payment;
  const map: Partial<Record<StoreOrderStatus, PayState>> = { pending: "awaiting_payment", payment_failed: "payment_failed", expired: "expired", cancelled: "cancelled", refunded: "refunded" };
  return { state: o.isPaid && !map[o.status] ? "paid" : map[o.status] ?? "paid", holdExpiresAt: null, canRetryPayment: false };
}
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });

function PaymentNotice({ o, onRetry, retrying }: { o: PublicOrder; onRetry: () => void; retrying: boolean }) {
  const { slug } = useStorefront();
  const p = payStateOf(o);
  if (p.state === "paid") return null;
  const copy: Record<Exclude<PayState, "paid">, { title: string; body: string }> = {
    awaiting_payment: { title: "This order hasn't been paid yet", body: p.holdExpiresAt ? `Your items are held until ${time(p.holdExpiresAt)}. Pay before then to keep them.` : "Pay to confirm your order." },
    payment_failed: { title: "Your payment didn't go through", body: p.holdExpiresAt ? `You weren't charged. Your items are held until ${time(p.holdExpiresAt)}, so you can try again.` : "You weren't charged." },
    expired: { title: "This order wasn't paid and has expired", body: "Your bag was released, so the items are back on sale. Place a new order to buy them." },
    cancelled: { title: "This order was cancelled", body: o.isPaid ? "If you paid, the store will arrange your refund. Contact them below if you have questions." : "Nothing was charged." },
    refunded: { title: "This order was refunded", body: "The payment was returned to you." },
  };
  const c = copy[p.state];
  return (
    <section role="status" className={cn("rounded-md px-4 py-3", p.state === "expired" || p.state === "cancelled" || p.state === "refunded" ? "bg-surface-tint-warm" : "bg-danger-bg")}>
      <p className="font-semibold text-ink-strong">{c.title}</p>
      <p className="mt-1 text-body-sm text-ink-secondary">{c.body}</p>
      {p.canRetryPayment && (
        <Button size="md" className="mt-3" onClick={onRetry} loading={retrying} loadingText="Opening Paystack…">
          {p.state === "payment_failed" ? "Try payment again" : "Pay now"}
        </Button>
      )}
      {p.state === "expired" && (
        <ButtonLink to={`/s/${slug}`} size="md" variant="secondary" className="mt-3">
          Shop again
        </ButtonLink>
      )}
    </section>
  );
}

const trackSchema = z.object({ order: z.string().trim().min(4, "Enter your order number."), email: z.string().trim().email("Enter the email you used.") });

export function TrackOrderPage() {
  const { slug, store } = useStorefront();
  const [orderParam, setOrderParam] = useUrlState<string>("order", "");
  const [result, setResult] = useState<PublicOrder | null>(null);
  const [error, setError] = useState<unknown>(null);
  const { register, handleSubmit, getValues, formState } = useForm<z.infer<typeof trackSchema>>({ resolver: zodResolver(trackSchema), defaultValues: { order: orderParam, email: "" } });
  const navigate = useNavigate();
  const [retrying, setRetrying] = useState(false);
  const retry = async () => {
    if (!result) return;
    setError(null);
    setRetrying(true);
    try {
      const res = await retryStorePayment(result.store?.storeSlug ?? slug, result.trackingNo, getValues("email"));
      browser.go(res.authorizationUrl);
    } catch (err) {
      setRetrying(false);
      setError(err);
    }
  };

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    setResult(null);
    try {
      const o = await trackStoreOrder(v.order.trim(), v.email.trim());
      if (o.store && o.store.storeSlug !== slug) {
        navigate(`/s/${o.store.storeSlug}/track?order=${encodeURIComponent(o.trackingNo)}`);
        return;
      }
      setOrderParam(o.trackingNo);
      setResult(o);
    } catch (err) {
      setError(err);
    }
  });

  const o = result;
  const pay = o ? payStateOf(o) : null;
  const showTimeline = Boolean(pay && (pay.state === "paid" || pay.state === "cancelled" || pay.state === "refunded"));
  return (
    <div className="flex flex-col gap-6">
      <Hero title="Track an order">Follow delivery progress using your order number and email.</Hero>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title={o ? "Delivery timeline" : "Find your order"}>
          <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4 md:flex-row md:items-start">
            <Field label="Order number" required error={formState.errors.order?.message} className="flex-1">
              <TextInput placeholder="BM-7K2Q-9MXA" autoCapitalize="characters" {...register("order")} />
            </Field>
            <Field label="Email used at checkout" required error={formState.errors.email?.message} className="flex-1">
              <TextInput type="email" autoComplete="email" {...register("email")} />
            </Field>
            <Button type="submit" size="md" loading={formState.isSubmitting} loadingText="Searching…" className="md:mt-7">
              Track
            </Button>
          </form>
          <ErrorNote error={error} fallback="We couldn't find an order with that number and email. Check the order number in your confirmation email (it starts with BM-) and the email you typed at checkout, including its spelling." className="mt-4" />
          {o && (
            <div className="mt-6">
              <PaymentNotice o={o} onRetry={() => void retry()} retrying={retrying} />
            </div>
          )}
          {o && showTimeline && (
            <ol className="mt-4 flex flex-col gap-2">
              {TIMELINE.map((step) => {
                const done = step.reached(o);
                return (
                  <li key={step.key} className={cn("rounded-md px-4 py-3", done ? "bg-success-bg" : "bg-surface-pale")}>
                    <p className="flex items-center gap-2 font-semibold text-ink-brand">
                      {done ? <IconCheck aria-hidden="true" className="size-4" /> : <IconCircle aria-hidden="true" className="size-4" />}
                      {step.title}
                      <span className="sr-only">{done ? " — done" : " — not yet"}</span>
                    </p>
                    <p className="text-body-sm text-ink-secondary">{step.body}</p>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
        <Panel title="Order details">
          {o ? (
            <DetailRows
              rows={[
                ["Order number", o.trackingNo],
                ["Payment", o.isPaid ? "Paid" : "Not paid"],
                ["Total", naira(o.total)],
                ["Delivery address", [o.deliveryAddress, o.city, o.state].filter(Boolean).join(", ")],
                ["Store", o.store?.storeName ?? store.storeName],
              ]}
            />
          ) : (
            <p className="text-body-sm text-ink-muted">Your order number is in your confirmation email (it starts with BM-).</p>
          )}
          <div className="mt-5">
            <ContactStore />
          </div>
        </Panel>
      </div>
    </div>
  );
}
