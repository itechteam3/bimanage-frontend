import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconBuildingWarehouse, IconShieldCheck, IconStarFilled, IconStar } from "@tabler/icons-react";
import { Button, ButtonLink, Dialog, EmptyState, Field, SelectInput, Status, TextArea, TextInput } from "@/components/ui";
import { HelpPanel, Panel } from "@/components/page/Blocks";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { applyFieldErrors, errorMessage } from "@/lib/api/errorMessage";
import { useUrlState } from "@/lib/nav/useUrlState";
import { count, naira, shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { browser } from "@/lib/store/api";
import { isPaymentsUnavailable } from "@/lib/workspace/api";
import {
  CATEGORIES,
  DELIVERY,
  categoryLabel,
  deliveryLabel,
  orderStatus,
  responseLabel,
  startPayment,
  trustLevel,
  useAddReview,
  useMyOrders,
  usePlaceOrder,
  useProduct,
  useProducts,
  useRequestConnection,
  useSupplier,
  useSupplierProducts,
  useSupplierReviews,
  useSuppliers,
  type Supplier,
  type SupplyProduct,
} from "@/lib/bisupplynet/api";
import { BsnTabs, FactsPanel, Heading, Intro, Loading, Pager, ProtectionBox, RecordRows, isNigerianPhone, useBsnAccess } from "./shared";

const place = (s?: Pick<Supplier, "city" | "state"> | null) => [s?.city, s?.state].filter(Boolean).join(", ");
const supplierOf = (p: SupplyProduct) => (typeof p.wholesaler === "object" ? p.wholesaler : null);

// ── 10.01 Find suppliers ─────────────────────────────────────────────────

const SORTS = [
  ["", "Best rated"],
  ["trust", "Highest trust"],
  ["rating", "Most reviewed"],
  ["newest", "Newest"],
] as const;
const TRUST = [
  ["", "Any trust score"],
  ["60", "60% and above"],
  ["70", "70% and above"],
  ["80", "80% and above"],
  ["90", "90% and above"],
] as const;

export function SuppliersPage() {
  const [search, setSearch] = useUrlState<string>("q", "");
  const [category, setCategory] = useUrlState<string>("category", "");
  const [state, setState] = useUrlState<string>("state", "");
  const [minTrust, setMinTrust] = useUrlState<string>("minTrust", "");
  const [sort, setSort] = useUrlState<string>("sort", "");
  const [pageKey, setPage] = useUrlState<string>("page", "1");
  const [typed, setTyped] = useState(search);
  const [typedState, setTypedState] = useState(state);
  const page = Math.max(1, Number(pageKey) || 1);
  const list = useSuppliers({ search, category, state, minTrust, sort, page });
  const data = list.data;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSearch(typed.trim());
    setState(typedState.trim());
    setPage("1");
  };
  const choose = (set: (v: string) => void) => (v: string) => {
    set(v);
    setPage("1");
  };

  return (
    <div className="flex flex-col gap-6">
      <Heading
        title="Find wholesale suppliers"
        subtitle="Compare verified sellers by category, reputation and location."
        action={
          <ButtonLink to="/bisupplynet/products" size="md">
            Explore products
          </ButtonLink>
        }
      />
      <BsnTabs />
      <Intro>Buyer payments are held securely in escrow until delivery is confirmed.</Intro>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)]">
        <Panel title="Verified wholesale partners" subtitle="Filter by category, location and trust score.">
          <form role="search" onSubmit={submit} className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Field label="Search">
              <TextInput type="search" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Search supplier or product" />
            </Field>
            <Field label="Category">
              <SelectInput value={category} onChange={(e) => choose(setCategory)(e.target.value)}>
                <option value="">All categories</option>
                {CATEGORIES.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="State">
              <TextInput value={typedState} onChange={(e) => setTypedState(e.target.value)} placeholder="For example: Lagos" />
            </Field>
            <Field label="Trust score">
              <SelectInput value={minTrust} onChange={(e) => choose(setMinTrust)(e.target.value)}>
                {TRUST.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Sort by">
              <SelectInput value={sort} onChange={(e) => choose(setSort)(e.target.value)}>
                {SORTS.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Button type="submit" className="md:self-end">
              Search
            </Button>
          </form>
          <div className="mt-6">
            {list.isLoading ? (
              <Loading label="Loading suppliers…" />
            ) : list.error ? (
              <ErrorNote error={list.error} fallback="We couldn't load suppliers. Please try again." onRetry={() => void list.refetch()} />
            ) : !data?.wholesalers.length ? (
              <div className="rounded-xl bg-surface-pale p-5">
                <p className="text-body-lg font-semibold text-ink-strong">No suppliers match</p>
                <p className="mt-1 text-body-sm text-ink-muted">Try another category, state or trust score.</p>
              </div>
            ) : (
              <>
                <RecordRows
                  label="Suppliers"
                  rows={data.wholesalers.map((s) => ({
                    key: s._id,
                    cells: [
                      <Link key="n" to={`/bisupplynet/suppliers/${s._id}`} className="hover:underline">
                        {s.businessName}
                      </Link>,
                      [categoryLabel(s.category), s.state].filter(Boolean).join(" • "),
                      `${Math.round(s.trustScore ?? 0)}% trust`,
                      "Verified",
                    ],
                  }))}
                />
                <Pager page={page} totalPages={data.totalPages} onPage={(p) => setPage(String(p))} />
              </>
            )}
          </div>
        </Panel>
        <FactsPanel
          items={[
            ["Buyer protection", "Secure escrow payment"],
            ["Trust score", "Fulfilment reliability"],
            ["Marketplace", `${CATEGORIES.length} supply categories`],
            ["After delivery", "Rate the supplier"],
          ]}
        />
      </div>
    </div>
  );
}

// ── 10.02 Verified supplier profile ──────────────────────────────────────

const stock = (p: SupplyProduct) => (p.availableQuantity <= 0 ? "Out of stock" : p.availableQuantity < p.minimumOrderQuantity ? "Low stock" : "In stock");

export function SupplierProfilePage() {
  const { id = "" } = useParams();
  const supplier = useSupplier(id);
  const takingOrders = supplier.data ? supplier.data.takingOrders !== false : true;
  const products = useSupplierProducts(id, Boolean(supplier.data) && takingOrders);
  const [showReviews, setShowReviews] = useState(false);
  const reviews = useSupplierReviews(id, showReviews);
  const [connectOpen, setConnectOpen] = useState(false);

  if (supplier.isLoading) return <Loading label="Loading supplier…" />;
  if (!supplier.data) return <ErrorNote error={supplier.error ?? true} fallback="We couldn't load this supplier." onRetry={() => void supplier.refetch()} />;
  const s = supplier.data;
  const rating = s.rating?.average ?? s.averageRating ?? 0;
  const ratings = s.rating?.count ?? s.totalReviews ?? 0;
  const trust = Math.round(s.trustScore ?? s.activityMetrics?.trustScore ?? 0);
  const categories = (s.categories?.length ? s.categories : [s.category]).map(categoryLabel).join(" • ");

  return (
    <div className="flex flex-col gap-6">
      <Heading
        title={s.businessName}
        subtitle={`Verified ${categoryLabel(s.category).toLowerCase()} supplier${place(s) ? ` based in ${place(s)}` : ""}.`}
        action={
          takingOrders ? (
            <Button size="md" onClick={() => setConnectOpen(true)}>
              Request connection
            </Button>
          ) : undefined
        }
      />
      <BsnTabs />
      <Intro>
        Trust {trust}% • {count(s.completedOrders)} orders fulfilled • {ratings ? `${rating.toFixed(1)}-star buyer rating` : "No ratings yet"}.
      </Intro>
      {!takingOrders && (
        <p role="status" className="rounded-xl bg-surface-tint-warm px-5 py-3 text-body-sm text-ink-strong">
          This supplier isn't taking new orders right now. Your existing orders aren't affected.
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)]">
        <Panel title="Supplier trust and product catalogue" subtitle="Review credentials before bulk ordering.">
          <RecordRows
            label="Supplier credentials"
            rows={[
              { key: "verified", cells: ["Verified business", s.cacVerified ? "CAC checked" : "CAC check pending", "Profile complete", "Approved"] },
              { key: "trust", cells: ["Trust score", `${trust}%`, `${count(s.completedOrders)} orders fulfilled`, trustLevel(trust)] },
              {
                key: "reviews",
                cells: [
                  "Buyer reviews",
                  ratings ? `${rating.toFixed(1)} / 5` : "No ratings yet",
                  `${count(ratings)} ${ratings === 1 ? "rating" : "ratings"}`,
                  ratings ? (
                    <button key="v" type="button" className="text-ink-brand underline-offset-2 hover:underline" aria-expanded={showReviews} onClick={() => setShowReviews((v) => !v)}>
                      {showReviews ? "Hide" : "View"}
                    </button>
                  ) : (
                    "None yet"
                  ),
                ],
              },
              { key: "response", cells: ["Typical response", responseLabel(s.responseTime), s.deliveryTimeline ? `Delivery ${s.deliveryTimeline}` : "Business days", s.responseTime !== null && s.responseTime <= 48 ? "Reliable" : "Building"] },
            ]}
          />
          {showReviews && (
            <div className="mt-4 rounded-xl bg-surface-pale p-4">
              {reviews.isLoading ? (
                <Loading label="Loading reviews…" />
              ) : reviews.error ? (
                <ErrorNote error={reviews.error} fallback="We couldn't load the reviews." onRetry={() => void reviews.refetch()} />
              ) : (
                <ul aria-label="Buyer reviews" className="flex flex-col gap-3">
                  {(reviews.data ?? []).map((r) => (
                    <li key={r._id} className="min-w-0 break-words text-body-sm">
                      <span className="font-semibold text-ink-strong">{r.rating} / 5</span> <span className="text-ink-muted">• {shortDate(r.createdAt)}</span>
                      {r.comment && <p className="text-ink-strong">{r.comment}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <h3 className="mt-6 text-body-lg font-semibold text-ink-strong">Wholesale catalogue</h3>
          <div className="mt-3">
            {!takingOrders ? (
              <p className="text-body-sm text-ink-muted">Their catalogue is hidden while they aren't taking orders.</p>
            ) : products.isLoading ? (
              <Loading label="Loading products…" />
            ) : products.error ? (
              <ErrorNote error={products.error} fallback="We couldn't load this supplier's products." onRetry={() => void products.refetch()} />
            ) : !products.data?.products.length ? (
              <p className="text-body-sm text-ink-muted">This supplier has no products listed right now.</p>
            ) : (
              <RecordRows
                label="Wholesale catalogue"
                rows={products.data.products.map((p) => ({
                  key: p._id,
                  cells: [
                    p.name,
                    naira(p.pricePerUnit),
                    `Minimum ${count(p.minimumOrderQuantity)} ${p.unit}`,
                    p.availableQuantity >= p.minimumOrderQuantity ? (
                      <Link key="o" to={`/bisupplynet/checkout/${p._id}`} className="font-semibold hover:underline">
                        Order <span className="sr-only">{p.name}</span>
                        <span className="font-normal text-ink-muted"> • {stock(p)}</span>
                      </Link>
                    ) : (
                      stock(p)
                    ),
                  ],
                }))}
              />
            )}
          </div>
        </Panel>
        <div className="flex min-w-0 flex-col gap-5">
          <FactsPanel
            items={[
              ["Supplier location", place(s) || "Not given"],
              ["Categories", categories],
              ["Delivery", deliveryLabel(s.deliveryCapability) || "Ask the supplier"],
              ["Contact", takingOrders ? "Request a quote or message" : "Message about existing orders"],
              ["Protection", "Escrow for every order"],
            ]}
          />
          <ReviewCard supplierId={s._id} rating={rating} ratings={ratings} />
        </div>
      </div>
      <ConnectDialog open={connectOpen} onClose={() => setConnectOpen(false)} supplier={s} />
    </div>
  );
}

function Stars({ value, label }: { value: number; label?: string }) {
  return (
    <span className="flex gap-1 text-warning" role="img" aria-label={label ?? `${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (n <= Math.round(value) ? <IconStarFilled key={n} aria-hidden="true" className="size-5" /> : <IconStar key={n} aria-hidden="true" className="size-5" />))}
    </span>
  );
}

function ReviewCard({ supplierId, rating, ratings }: { supplierId: string; rating: number; ratings: number }) {
  const add = useAddReview();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setProblem(null);
    if (!stars) return setProblem("Choose a star rating.");
    try {
      await add.mutateAsync({ wholesalerId: supplierId, rating: stars, comment: comment.trim() });
      setDone(true);
    } catch (err) {
      setProblem(errorMessage(err, "We couldn't save your review. Please try again."));
    }
  };

  return (
    <section className="min-w-0 rounded-2xl border border-line-card bg-surface-card p-4 shadow-card">
      <h2 className="text-body-lg font-semibold text-ink-brand">Buyer ratings &amp; feedback</h2>
      <p className="mt-2 text-body-lg text-ink-strong">{ratings ? `${rating.toFixed(1)} / 5 from ${count(ratings)} buyer ${ratings === 1 ? "rating" : "ratings"}` : "No buyer ratings yet"}</p>
      <div className="mt-2">
        <Stars value={rating} />
      </div>
      <p className="mt-3 text-caption text-ink-muted">Only buyers with a completed order can review.</p>
      {done ? (
        <p role="status" className="mt-3 text-body-sm text-success-ink">
          Thank you. Your review is saved.
        </p>
      ) : (
        <form onSubmit={(e) => void submit(e)} className="mt-3 flex flex-col gap-3">
          <fieldset>
            <legend className="text-field-label uppercase text-ink-secondary">Your rating</legend>
            <div role="radiogroup" aria-label="Your rating" className="mt-1 flex flex-wrap gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={stars === n}
                  aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
                  onClick={() => setStars(n)}
                  className={cn("flex size-11 items-center justify-center rounded-md", n <= stars ? "text-warning" : "text-ink-disabled")}
                >
                  {n <= stars ? <IconStarFilled aria-hidden="true" className="size-6" /> : <IconStar aria-hidden="true" className="size-6" />}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="sr-only" htmlFor="supplier-review">
            Your experience
          </label>
          <textarea
            id="supplier-review"
            rows={3}
            maxLength={500}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Write a supplier review…"
            className="w-full rounded-md bg-surface-pale px-3 py-2 text-body-sm text-ink-strong outline-none placeholder:text-ink-muted focus:shadow-focus"
          />
          {problem && (
            <p role="alert" className="text-body-sm text-danger">
              {problem}
            </p>
          )}
          <Button type="submit" loading={add.isPending} loadingText="Saving…">
            Submit review
          </Button>
        </form>
      )}
    </section>
  );
}

function ConnectDialog({ open, onClose, supplier }: { open: boolean; onClose: () => void; supplier: Supplier }) {
  const connect = useRequestConnection(supplier._id);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const close = () => {
    onClose();
    setError(null);
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      icon={<IconBuildingWarehouse className="size-7" />}
      title={sent ? "Request sent" : `Connect with ${supplier.businessName}`}
      description={sent ? `${supplier.businessName} will see your request and can reply. You don't need to wait to place an order.` : "Ask for a quote or introduce your business. You can order without connecting first."}
      actions={
        sent ? (
          <Button onClick={close}>Done</Button>
        ) : (
          <>
            <Button variant="outlined" onClick={close}>
              Not now
            </Button>
            <Button
              loading={connect.isPending}
              loadingText="Sending…"
              onClick={() => {
                setError(null);
                connect.mutateAsync(message.trim()).then(
                  () => setSent(true),
                  (err) => setError(err)
                );
              }}
            >
              Send request
            </Button>
          </>
        )
      }
    >
      {!sent && (
        <>
          <Field label="Message (optional)">
            <TextArea rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="For example: Can you quote for 50 bags each month?" />
          </Field>
          <ErrorNote error={error} fallback="We couldn't send your request. Please try again." />
        </>
      )}
    </Dialog>
  );
}

// ── 10.05 Wholesale product catalogue ────────────────────────────────────

export function ProductsPage() {
  const { canSell, sellPlan } = useBsnAccess();
  const [search, setSearch] = useUrlState<string>("q", "");
  const [category, setCategory] = useUrlState<string>("category", "");
  const [delivery, setDelivery] = useUrlState<string>("delivery", "");
  const [minPrice, setMinPrice] = useUrlState<string>("minPrice", "");
  const [maxPrice, setMaxPrice] = useUrlState<string>("maxPrice", "");
  const [pageKey, setPage] = useUrlState<string>("page", "1");
  const [typed, setTyped] = useState({ search, minPrice, maxPrice });
  const page = Math.max(1, Number(pageKey) || 1);
  const list = useProducts({ search, category, delivery, minPrice, maxPrice, page });
  const data = list.data;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSearch(typed.search.trim());
    setMinPrice(typed.minPrice.trim());
    setMaxPrice(typed.maxPrice.trim());
    setPage("1");
  };

  return (
    <div className="flex flex-col gap-6">
      <Heading
        title="Wholesale product listings"
        subtitle="Browse bulk quantities, pricing and available stock."
        action={
          canSell && sellPlan ? (
            <ButtonLink to="/bisupplynet/sell/listings/new" size="md">
              + Add wholesale listing
            </ButtonLink>
          ) : undefined
        }
      />
      <BsnTabs />
      <Intro>Minimum order quantities vary by supplier and product.</Intro>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)]">
        <Panel title="Browse wholesale inventory" subtitle="Compare products from verified suppliers.">
          <form role="search" onSubmit={submit} className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Field label="Search" className="md:col-span-2">
              <TextInput type="search" value={typed.search} onChange={(e) => setTyped({ ...typed, search: e.target.value })} placeholder="Search wholesale items" />
            </Field>
            <Field label="Category">
              <SelectInput
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage("1");
                }}
              >
                <option value="">All categories</option>
                {CATEGORIES.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Delivery">
              <SelectInput
                value={delivery}
                onChange={(e) => {
                  setDelivery(e.target.value);
                  setPage("1");
                }}
              >
                <option value="">Any delivery</option>
                {DELIVERY.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Lowest price (₦)">
              <TextInput inputMode="numeric" value={typed.minPrice} onChange={(e) => setTyped({ ...typed, minPrice: e.target.value.replace(/[^\d]/g, "") })} />
            </Field>
            <Field label="Highest price (₦)">
              <TextInput inputMode="numeric" value={typed.maxPrice} onChange={(e) => setTyped({ ...typed, maxPrice: e.target.value.replace(/[^\d]/g, "") })} />
            </Field>
            <Button type="submit" className="md:col-span-2 md:justify-self-end md:px-10">
              Search
            </Button>
          </form>
          <div className="mt-6">
            {list.isLoading ? (
              <Loading label="Loading products…" />
            ) : list.error ? (
              <ErrorNote error={list.error} fallback="We couldn't load products. Please try again." onRetry={() => void list.refetch()} />
            ) : !data?.products.length ? (
              <div className="rounded-xl bg-surface-pale p-5">
                <p className="text-body-lg font-semibold text-ink-strong">No products match</p>
                <p className="mt-1 text-body-sm text-ink-muted">Try another search, category or price range.</p>
              </div>
            ) : (
              <>
                <RecordRows
                  label="Wholesale products"
                  rows={data.products.map((p) => {
                    const sup = supplierOf(p);
                    return {
                      key: p._id,
                      cells: [
                        <Link key="n" to={`/bisupplynet/checkout/${p._id}`} className="hover:underline">
                          {p.name}
                        </Link>,
                        sup ? (
                          <Link key="s" to={`/bisupplynet/suppliers/${sup._id}`} className="hover:underline">
                            {sup.businessName}
                          </Link>
                        ) : (
                          ""
                        ),
                        naira(p.pricePerUnit),
                        `MOQ ${count(p.minimumOrderQuantity)}`,
                      ],
                    };
                  })}
                />
                <Pager page={page} totalPages={data.totalPages} onPage={(p) => setPage(String(p))} />
              </>
            )}
          </div>
        </Panel>
        <FactsPanel
          items={[
            ["Payment", "Buyer-protected escrow"],
            ["Order minimum", "Per product and supplier"],
            ["Seller quality", "Trust score and reviews"],
            ["Shipping", "Confirm terms before paying"],
          ]}
        />
      </div>
    </div>
  );
}

// ── 10.06 Bulk order checkout ────────────────────────────────────────────

export function CheckoutPage() {
  const { productId = "" } = useParams();
  const product = useProduct(productId);
  if (product.isLoading) return <Loading label="Loading product…" />;
  if (!product.data) return <ErrorNote error={product.error ?? true} fallback="We couldn't load this product." onRetry={() => void product.refetch()} />;
  return <Checkout p={product.data} />;
}

const checkoutSchema = (p: SupplyProduct) =>
  z.object({
    quantity: z.coerce
      .number({ invalid_type_error: "Enter a quantity." })
      .int("Use a whole number.")
      .min(p.minimumOrderQuantity, `The minimum order is ${count(p.minimumOrderQuantity)} ${p.unit}.`)
      .max(Math.max(p.availableQuantity, p.minimumOrderQuantity), `Only ${count(p.availableQuantity)} ${p.unit} are in stock.`),
    deliveryAddress: z.string().trim().min(5, "Enter the full delivery address."),
    receivingBusiness: z.string().trim().max(120, "Keep the business name under 120 characters."),
    contactPhone: z.string().trim().refine((v) => !v || isNigerianPhone(v), "Enter a valid Nigerian phone number, e.g. 0803 123 4567."),
  });
type CheckoutForm = { quantity: number; deliveryAddress: string; receivingBusiness: string; contactPhone: string };

function Checkout({ p }: { p: SupplyProduct }) {
  const navigate = useNavigate();
  const sup = supplierOf(p);
  const placeOrder = usePlaceOrder();
  const [review, setReview] = useState<CheckoutForm | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const { register, handleSubmit, control, setError: setFieldError, formState } = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema(p)),
    defaultValues: { quantity: p.minimumOrderQuantity, deliveryAddress: "", receivingBusiness: "", contactPhone: "" },
  });
  const qty = Number(useWatch({ control, name: "quantity" })) || 0;
  const total = qty * p.pricePerUnit;
  const e = formState.errors;
  const soldOut = !p.isAvailable || p.availableQuantity < p.minimumOrderQuantity;

  const pay = async (v: CheckoutForm) => {
    setError(null);
    setPaying(true);
    let orderId: string | null = null;
    try {
      const order = await placeOrder.mutateAsync({
        productId: p._id,
        quantity: Number(v.quantity),
        deliveryAddress: v.deliveryAddress.trim(),
        ...(v.receivingBusiness.trim() ? { receivingBusiness: v.receivingBusiness.trim() } : {}),
        ...(v.contactPhone.trim() ? { contactPhone: v.contactPhone.trim() } : {}),
      });
      orderId = order._id;
      const res = await startPayment(order._id);
      browser.go(res.authorizationUrl); // Paystack returns to /bisupplynet/orders/:id?payment=success
    } catch (err) {
      setPaying(false);
      setReview(null);
      if (orderId) {
        // The order exists (stock is held); payment can be retried from the order page.
        navigate(`/bisupplynet/orders/${orderId}`, { state: { payProblem: isPaymentsUnavailable(err) ? "soon" : "failed" } });
        return;
      }
      if (!applyFieldErrors(err, setFieldError, ["quantity", "deliveryAddress", "receivingBusiness", "contactPhone"])) setError(err);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Heading
        title="Place a wholesale order"
        subtitle="Review your bulk purchase and protected payment."
        action={
          sup ? (
            <ButtonLink to={`/bisupplynet/suppliers/${sup._id}`} size="md">
              Supplier details
            </ButtonLink>
          ) : undefined
        }
      />
      <Intro>Escrow is held until the buyer confirms goods received.</Intro>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <form noValidate onSubmit={handleSubmit((v) => setReview(v))} className="flex min-w-0 flex-col gap-5">
          <Panel title="Order and delivery details" subtitle={sup ? `Supplier: ${sup.businessName} • Verified.` : undefined}>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-x-10 md:gap-y-6">
              <Field label="Product">
                <TextInput value={p.name} readOnly />
              </Field>
              <Field label="Unit price">
                <TextInput value={naira(p.pricePerUnit)} readOnly />
              </Field>
              <Field label={`Quantity • min ${count(p.minimumOrderQuantity)}`} required error={e.quantity?.message} hint={`${count(p.availableQuantity)} ${p.unit} in stock`}>
                <TextInput type="number" inputMode="numeric" min={p.minimumOrderQuantity} max={p.availableQuantity} step={1} {...register("quantity")} />
              </Field>
              <Field label="Items total">
                <TextInput value={naira(total)} readOnly aria-live="polite" />
              </Field>
              <Field label="Delivery address" required error={e.deliveryAddress?.message}>
                <TextInput autoComplete="street-address" placeholder="For example: 14 Adebayo Street, Yaba" {...register("deliveryAddress")} />
              </Field>
              <Field label="Receiving business" error={e.receivingBusiness?.message}>
                <TextInput maxLength={120} placeholder="Who receives the goods" {...register("receivingBusiness")} />
              </Field>
              <Field label="Contact phone" error={e.contactPhone?.message}>
                <TextInput type="tel" autoComplete="tel" placeholder="0803 123 4567" {...register("contactPhone")} />
              </Field>
              <Field label="Payment method">
                <TextInput value="Secure BiManage escrow" readOnly />
              </Field>
            </div>
            <div className="mt-6">
              <ProtectionBox />
            </div>
          </Panel>
          <ErrorNote error={error} fallback="We couldn't place your order. Please try again." />
          {soldOut && <p className="text-body-sm text-danger">This product doesn't have enough stock for an order right now.</p>}
          <Button type="submit" className="md:self-end md:px-10" disabled={soldOut}>
            Review and pay
          </Button>
        </form>
        <HelpPanel
          items={[
            ["Escrow amount", naira(total)],
            ["Buyer protection", "Held until delivery confirmed"],
            ["Supplier update", "Due within 48 hours of payment"],
            ["After payment", "Track the order"],
          ]}
          callout={{ title: "Order evidence", body: "Keep order updates, delivery details and messages together. Every step shows on the order page." }}
        />
      </div>
      <Dialog
        open={Boolean(review)}
        onClose={() => (paying ? undefined : setReview(null))}
        dismissible={!paying}
        icon={<IconShieldCheck className="size-7" />}
        title={`Pay ${naira(review ? Number(review.quantity) * p.pricePerUnit : 0)} into escrow?`}
        description={
          review
            ? `${count(Number(review.quantity))} ${p.unit} of ${p.name}${sup ? ` from ${sup.businessName}` : ""}. We hold the stock for you for 24 hours while you pay. BiManage keeps your payment safe until you confirm the goods arrived.`
            : undefined
        }
        actions={
          <>
            <Button variant="outlined" disabled={paying} onClick={() => setReview(null)}>
              Change order
            </Button>
            <Button loading={paying} loadingText="Opening payment…" onClick={() => review && void pay(review)}>
              Pay securely
            </Button>
          </>
        }
      />
    </div>
  );
}

// ── Buyer's orders ───────────────────────────────────────────────────────

export function MyOrdersPage() {
  const orders = useMyOrders();
  return (
    <div className="flex flex-col gap-6">
      <Heading title="My wholesale orders" subtitle="Orders you placed with BiSupplyNet suppliers." action={<ButtonLink to="/bisupplynet/products" size="md">Order more stock</ButtonLink>} />
      <BsnTabs />
      <Intro>Your payment stays protected in escrow until you confirm delivery.</Intro>
      <Panel>
        {orders.isLoading ? (
          <Loading label="Loading your orders…" />
        ) : orders.error ? (
          <ErrorNote error={orders.error} fallback="We couldn't load your orders." onRetry={() => void orders.refetch()} />
        ) : !orders.data?.length ? (
          <EmptyState
            className="border-0 p-0"
            icon={<IconBuildingWarehouse className="size-7" />}
            title="No wholesale orders yet"
            body="Find a verified supplier and order in bulk. Your payment is protected until delivery."
            action={<ButtonLink to="/bisupplynet/suppliers" size="md">Find suppliers</ButtonLink>}
          />
        ) : (
          <RecordRows
            label="Your wholesale orders"
            rows={orders.data.map((o) => {
              const st = orderStatus(o.status);
              return {
                key: o._id,
                cells: [
                  <Link key="t" to={`/bisupplynet/orders/${o._id}`} className="hover:underline">
                    {o.trackingNo}
                  </Link>,
                  `${o.productName}${o.wholesaler?.businessName ? ` • ${o.wholesaler.businessName}` : ""}`,
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
