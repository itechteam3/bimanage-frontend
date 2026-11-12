import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconArrowRight, IconPlus, IconSearch, IconTrash } from "@tabler/icons-react";
import { Button, ButtonLink, Field, SelectInput, Spinner, Status, TextInput } from "@/components/ui";
import { DetailRows, InfoStrip, IntroCard, KpiCard, PageTitle, Panel, TipList } from "@/components/page/Blocks";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { useProducts } from "@/lib/inventory/api";
import {
  PAYMENT_METHODS,
  createInvoiceFromOrder,
  customerName,
  existingInvoiceOf,
  orderBadge,
  useCancelOrder,
  useCreateOrder,
  useOrder,
  useOrderStats,
  useOrders,
  useUpdateOrderStatus,
  type Order,
  type OrderFilter,
} from "@/lib/sales/api";
import { applyFieldErrors } from "@/lib/api/errorMessage";
import { useCan } from "@/lib/auth/useCan";
import { count, naira, shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";

const Loading = () => (
  <div className="flex justify-center py-16 text-ink-brand" role="status">
    <Spinner className="size-8" />
    <span className="sr-only">Loading…</span>
  </div>
);

const FILTERS: Array<[OrderFilter, string]> = [
  ["all", "All"],
  ["awaiting_payment", "Pending"],
  ["paid", "Paid"],
  ["unfulfilled", "Unfulfilled"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
];

/** Striped order table used by 05.01 and 05.02. */
export function OrderTable({ orders, empty }: { orders: Order[]; empty: React.ReactNode }) {
  if (!orders.length) return <div className="py-8 text-center text-body-lg text-ink-secondary">{empty}</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-left text-body-sm">
        <thead className="bg-surface-pale text-caption font-semibold uppercase text-ink-muted">
          <tr>
            <th scope="col" className="rounded-l-lg px-3 py-3">Order</th>
            <th scope="col" className="px-3 py-3">Customer</th>
            <th scope="col" className="px-3 py-3">Amount</th>
            <th scope="col" className="rounded-r-lg px-3 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const b = orderBadge(o);
            return (
              <tr key={o._id} className="border-b border-line-subtle last:border-0">
                <td className="px-3 py-4">
                  <Link to={`/orders/${o._id}`} className="font-semibold text-ink-strong hover:underline">
                    {o.trackingNo}
                  </Link>
                  <p className="text-caption text-ink-muted">{shortDate(o.createdAt)}</p>
                </td>
                <td className="px-3 py-4 text-ink-strong">{customerName(o)}</td>
                <td className="px-3 py-4 text-ink-strong">{naira(o.totalAmount)}</td>
                <td className="px-3 py-4">
                  <Status tone={b.tone}>{b.label}</Status>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// 05.02 Orders & sales history
export function OrdersPage() {
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const orders = useOrders(filter, query);
  const stats = useOrderStats();
  const canCreate = useCan("createOrders");
  const s = stats.data;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle actions={canCreate && <ButtonLink to="/orders/new" size="md">Create order</ButtonLink>}>Orders &amp; sales history</PageTitle>
      <IntroCard eyebrow="Orders / Record and manage sales" title="Every sale, payment and fulfilment in one place.">
        Search your history, filter by status or create a new order.
      </IntroCard>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard tone="orders" label="All orders" value={count(s?.all)} caption={s ? `${count(s.cancelled)} cancelled` : "—"} />
        <KpiCard tone="revenue" label="Awaiting payment" value={count(s?.awaitingPayment)} caption="Track collections" />
        <KpiCard tone="invoices" label="Unfulfilled" value={count(s?.unfulfilled)} caption="Eligible for cancellation" />
        <KpiCard tone="stock" label="Completed" value={count(s?.completed)} caption={s ? `${naira(s.revenue)} revenue` : "—"} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)]">
        <Panel>
          <div className="flex flex-col gap-3 md:flex-row">
            <form
              role="search"
              className="flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                setQuery(q.trim());
              }}
            >
              <label className="flex h-control-lg items-center gap-2 rounded-md bg-surface-pale px-3">
                <IconSearch aria-hidden="true" className="size-icon text-ink-muted" />
                <span className="sr-only">Search orders</span>
                <input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    if (!e.target.value) setQuery("");
                  }}
                  placeholder="Search order, customer, product…"
                  className="h-full flex-1 bg-transparent text-input text-ink-strong outline-none placeholder:text-ink-muted"
                />
              </label>
            </form>
            <div role="tablist" aria-label="Filter by status" className="flex flex-wrap items-center gap-1 rounded-md bg-surface-pale p-1">
              {FILTERS.map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  type="button"
                  aria-selected={filter === key}
                  onClick={() => setFilter(key)}
                  className={cn("rounded-sm px-2.5 py-1.5 text-body-sm font-medium", filter === key ? "bg-surface-card text-ink-brand shadow-card" : "text-ink-secondary hover:text-ink-brand")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            {orders.isLoading ? (
              <Loading />
            ) : orders.error ? (
              <ErrorNote error={orders.error} fallback="We couldn't load your orders. Please try again." onRetry={() => void orders.refetch()} />
            ) : (
              <OrderTable
                orders={orders.data ?? []}
                empty={query || filter !== "all" ? "No orders match this search or filter." : "No orders yet. Record your first sale to see it here."}
              />
            )}
          </div>
        </Panel>
        <Panel tone="pale" title="Quick actions">
          <dl className="flex flex-col gap-6">
            <div>
              <dt><Link to="/orders/new" className="text-body-lg font-semibold text-ink-brand hover:underline">Record a sale</Link></dt>
              <dd className="mt-1 text-body-sm text-ink-muted">Products, quantity, customer and payment.</dd>
            </div>
            <div>
              <dt><Link to="/invoices/new" className="text-body-lg font-semibold text-ink-brand hover:underline">Create an invoice</Link></dt>
              <dd className="mt-1 text-body-sm text-ink-muted">Email a branded PDF to customers.</dd>
            </div>
            <div>
              <dt>
                <button type="button" onClick={() => setFilter("unfulfilled")} className="text-body-lg font-semibold text-ink-brand hover:underline">
                  Cancel unfulfilled
                </button>
              </dt>
              <dd className="mt-1 text-body-sm text-ink-muted">Restores stock automatically.</dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-col gap-2">
            {canCreate && <ButtonLink to="/orders/new" fullWidth>Create order</ButtonLink>}
            <ButtonLink to="/invoices" variant="secondary" fullWidth>Invoices</ButtonLink>
          </div>
        </Panel>
      </div>
    </div>
  );
}

// 05.09 Create a sales order
const whole = z.preprocess((v) => (typeof v === "string" ? v.replace(/[,\s]/g, "") : v), z.coerce.number({ invalid_type_error: "Enter a quantity." }).int("Use a whole number.").min(1, "At least 1."));
const orderSchema = z.object({
  customerName: z.string().trim().max(100),
  customerEmail: z.string().trim().max(120).refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Enter a valid email."),
  customerPhone: z.string().trim().max(30),
  paymentMethod: z.enum(["cash", "transfer", "card", "pos", "other"]),
  paymentStatus: z.enum(["paid", "pending"]),
  fulfilmentStatus: z.enum(["fulfilled", "unfulfilled"]),
  deliveryFee: z.preprocess((v) => (typeof v === "string" ? v.replace(/[₦,\s]/g, "") || "0" : v), z.coerce.number({ invalid_type_error: "Enter an amount." }).min(0, "Can't be negative.")),
  notes: z.string().trim().max(1000),
  items: z.array(z.object({ productId: z.string().min(1, "Choose a product."), quantity: whole })).min(1, "Add at least one product."),
});
type OrderValues = z.infer<typeof orderSchema>;

export function CreateOrderPage() {
  const navigate = useNavigate();
  const products = useProducts();
  const create = useCreateOrder();
  const [formError, setFormError] = useState<unknown>(null);
  const { register, control, handleSubmit, watch, setError, formState } = useForm<OrderValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      paymentMethod: "cash",
      paymentStatus: "paid",
      fulfilmentStatus: "fulfilled",
      deliveryFee: 0,
      notes: "",
      items: [{ productId: "", quantity: 1 }],
    } as unknown as OrderValues,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const byId = useMemo(() => new Map((products.data ?? []).map((p) => [p._id, p])), [products.data]);

  const watched = watch();
  const lines = (watched.items ?? []).map((i) => {
    const p = byId.get(i.productId);
    const qty = Number(String(i.quantity ?? "").replace(/[,\s]/g, "")) || 0;
    return { p, qty, total: p ? p.sellingPrice * qty : 0 };
  });
  const units = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const delivery = Number(String(watched.deliveryFee ?? "").replace(/[₦,\s]/g, "")) || 0;

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    // Stock check before sending (the server checks again, atomically).
    let short = false;
    v.items.forEach((i, n) => {
      const p = byId.get(i.productId);
      if (p && i.quantity > p.stockQuantity) {
        setError(`items.${n}.quantity`, { message: `Only ${count(p.stockQuantity)} in stock.` });
        short = true;
      }
    });
    if (short) return;
    try {
      const order = await create.mutateAsync({
        items: v.items,
        customer: { name: v.customerName || undefined, email: v.customerEmail || undefined, phone: v.customerPhone || undefined },
        paymentMethod: v.paymentMethod,
        paymentStatus: v.paymentStatus,
        fulfilmentStatus: v.fulfilmentStatus,
        deliveryFee: v.deliveryFee || undefined,
        notes: v.notes || undefined,
      });
      navigate(`/orders/${order._id}/created`, { state: { order } });
    } catch (err) {
      const data = (err as { data?: { productId?: string; available?: number } }).data;
      const n = data?.productId ? v.items.findIndex((i) => i.productId === data.productId) : -1;
      if (n >= 0) setError(`items.${n}.quantity`, { message: `Only ${count(data?.available)} in stock.` });
      else if (!applyFieldErrors(err, setError, ["customerEmail", "deliveryFee", "notes"])) setFormError(err);
    }
  });

  if (products.isLoading) return <Loading />;
  const available = (products.data ?? []).filter((p) => p.stockQuantity > 0);

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Create a sales order</PageTitle>
      <IntroCard eyebrow="New sale / Order creation" title="Record the sale. We'll keep inventory in sync.">
        Select items, quantity, customer and payment method before saving.
      </IntroCard>
      {!products.data?.length ? (
        <InfoStrip title="Add a product first" action={<ButtonLink to="/inventory/products/new" size="md">Add product</ButtonLink>}>
          Orders are made from your inventory products, so stock stays accurate.
        </InfoStrip>
      ) : (
        <form noValidate onSubmit={onSubmit} className="grid gap-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
          <Panel title="Customer and items">
            <div className="grid gap-4 md:grid-cols-2 md:gap-x-8 md:gap-y-5">
              <Field label="Customer name">
                <TextInput autoComplete="off" placeholder="Amina Yusuf" {...register("customerName")} />
              </Field>
              <Field label="Customer email" hint="They get an order confirmation." error={formState.errors.customerEmail?.message}>
                <TextInput type="email" autoComplete="off" placeholder="amina@example.com" {...register("customerEmail")} />
              </Field>
              <Field label="Customer phone">
                <TextInput type="tel" autoComplete="off" placeholder="+234 803 000 0000" {...register("customerPhone")} />
              </Field>
              <Field label="Payment method">
                <SelectInput {...register("paymentMethod")}>
                  {PAYMENT_METHODS.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Payment">
                <SelectInput {...register("paymentStatus")}>
                  <option value="paid">Paid</option>
                  <option value="pending">Awaiting payment</option>
                </SelectInput>
              </Field>
              <Field label="Fulfilment">
                <SelectInput {...register("fulfilmentStatus")}>
                  <option value="fulfilled">Fulfilled (handed over)</option>
                  <option value="unfulfilled">Unfulfilled (to deliver)</option>
                </SelectInput>
              </Field>
              <Field label="Delivery fee (₦)" error={formState.errors.deliveryFee?.message}>
                <TextInput inputMode="decimal" placeholder="0" {...register("deliveryFee")} />
              </Field>
              <Field label="Order notes">
                <TextInput placeholder="Optional customer or delivery notes" {...register("notes")} />
              </Field>
            </div>

            <h3 className="mt-8 text-title-sm text-ink-strong">Items in this sale</h3>
            <ul className="mt-3 flex flex-col gap-3">
              {fields.map((f, n) => {
                const l = lines[n];
                const err = formState.errors.items?.[n];
                return (
                  <li key={f.id} className="rounded-lg bg-surface-pale p-4">
                    <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] md:items-end">
                      <Field label="Product" error={err?.productId?.message}>
                        <SelectInput {...register(`items.${n}.productId` as const)}>
                          <option value="">Choose a product…</option>
                          {available.map((p) => (
                            <option key={p._id} value={p._id}>
                              {p.name} · {naira(p.sellingPrice)} · {count(p.stockQuantity)} in stock
                            </option>
                          ))}
                        </SelectInput>
                      </Field>
                      <Field label="Quantity" error={err?.quantity?.message}>
                        <TextInput inputMode="numeric" {...register(`items.${n}.quantity` as const)} />
                      </Field>
                      {fields.length > 1 && (
                        <Button variant="secondary" size="md" onClick={() => remove(n)} aria-label={`Remove item ${n + 1}`}>
                          <IconTrash aria-hidden="true" className="size-icon" />
                        </Button>
                      )}
                    </div>
                    {l?.p && (
                      <p className="mt-3 text-body-sm text-ink-muted">
                        Unit price {naira(l.p.sellingPrice)} · Available {count(l.p.stockQuantity)} ·{" "}
                        <span className="font-semibold text-ink-brand">Line total {naira(l.total)}</span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
            {formState.errors.items?.message && <p className="mt-2 text-body-sm text-danger">{formState.errors.items.message}</p>}
            {fields.length < 50 && (
              <button
                type="button"
                onClick={() => append({ productId: "", quantity: 1 } as never)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-surface-pale py-3 text-body-sm font-semibold text-ink-brand hover:bg-surface-tonal"
              >
                <IconPlus aria-hidden="true" className="size-icon-sm" /> Add another inventory product
              </button>
            )}
          </Panel>
          <div className="flex flex-col gap-4">
            <Panel tone="pale" title="Order summary">
              <dl className="flex flex-col gap-3">
                {[
                  ["Items", `${count(units)} unit${units === 1 ? "" : "s"}`],
                  ["Subtotal", naira(subtotal)],
                  ["Delivery", naira(delivery)],
                  ["Estimated total", naira(subtotal + delivery)],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between rounded-md bg-surface-card px-4 py-4">
                    <dt className="text-body-sm text-ink-muted">{k}</dt>
                    <dd className="text-body-lg font-semibold text-ink-brand">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-body-sm text-ink-muted">On save, inventory and order history are updated.</p>
              <ErrorNote className="mt-4" error={formError} fallback="We couldn't save this order. Check your connection and try again." onRetry={() => void onSubmit()} />
              <div className="mt-5 flex flex-col gap-2">
                <Button type="submit" fullWidth loading={formState.isSubmitting} loadingText="Creating…">
                  Create order
                </Button>
                <ButtonLink to="/orders" variant="secondary" fullWidth>
                  Review current orders
                </ButtonLink>
              </div>
            </Panel>
          </div>
        </form>
      )}
    </div>
  );
}

/** Shared "next steps" panel for the confirmation pages. */
function NextSteps({ title, steps, tone = "brand" }: { title: string; steps: Array<[string, string]>; tone?: "brand" | "danger" }) {
  return (
    <Panel tone="pale" title={title}>
      <ol className="flex flex-col gap-8">
        {steps.map(([t, b], i) => (
          <li key={t}>
            <p className={cn("text-body-lg font-semibold", tone === "danger" ? "text-danger" : "text-ink-brand")}>
              <span className="mr-3">{String(i + 1).padStart(2, "0")}</span>
              {t}
            </p>
            <p className="mt-2 text-body-sm text-ink-muted">{b}</p>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

const Banner = ({ tone, eyebrow, title, body }: { tone: "success" | "danger" | "brand"; eyebrow: string; title: string; body: string }) => (
  <section className={cn("rounded-2xl px-5 py-4 shadow-card lg:px-6 lg:py-5", tone === "success" ? "bg-success-bg" : tone === "danger" ? "bg-danger-bg" : "bg-surface-pale")}>
    <p className={cn("text-caption font-semibold uppercase", tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-ink-brand")}>{eyebrow}</p>
    <h2 className="mt-2 text-section-title text-ink-strong">{title}</h2>
    <p className="mt-2 text-body-sm text-ink-muted">{body}</p>
  </section>
);

/** Loads an order by :id (or uses the one passed from the previous page). */
function useRouteOrder() {
  const { id } = useParams();
  return useOrder(id);
}

/** "Create an invoice" from an order: reuses the order's invoice if one exists. */
function useInvoiceFromOrder() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const run = async (orderId: string) => {
    setBusy(true);
    setError(null);
    try {
      const invoice = await createInvoiceFromOrder(orderId);
      navigate(`/invoices/${invoice._id}/edit`);
    } catch (err) {
      const existing = existingInvoiceOf(err);
      if (existing) navigate(`/invoices/${existing._id}`);
      else setError(err);
    } finally {
      setBusy(false);
    }
  };
  return { run, busy, error };
}

// 05.12 Order created
export function OrderCreatedPage() {
  const order = useRouteOrder();
  const invoice = useInvoiceFromOrder();
  if (order.isLoading) return <Loading />;
  if (!order.data) return <ErrorNote error={order.error ?? true} fallback="We couldn't load this order. Please try again." onRetry={() => void order.refetch()} />;
  const o = order.data;
  const b = orderBadge(o);
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Order created</PageTitle>
      <Banner tone="success" eyebrow={b.label} title="Your order is in the system." body="Sale details are recorded. Fulfilment and payment can now be managed." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel title="Record summary" subtitle="See the important details without leaving this page.">
          <div className="rounded-xl bg-success-bg px-4 py-4">
            <p className="text-caption font-semibold uppercase text-success">{b.label}</p>
            <p className="mt-1 text-title-md text-ink-brand">Saved</p>
          </div>
          <div className="mt-5">
            <DetailRows
              rows={[
                ["Order", o.trackingNo],
                ["Customer", customerName(o)],
                ["Items", o.items.map((i) => `${i.quantity} × ${i.name}`).join(", ")],
                ["Total", naira(o.totalAmount)],
                ["Inventory", "Stock deducted on this recorded sale"],
                ["Payment", o.paymentStatus === "paid" ? "Paid" : "Awaiting payment"],
              ]}
            />
          </div>
          <ErrorNote className="mt-4" error={invoice.error} fallback="We couldn't create the invoice. Please try again." />
          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <ButtonLink to={`/orders/${o._id}`} className="md:flex-1">View order details</ButtonLink>
            <Button variant="secondary" className="md:flex-1" loading={invoice.busy} loadingText="Preparing…" onClick={() => void invoice.run(o._id)}>
              Create an invoice
            </Button>
          </div>
        </Panel>
        <NextSteps
          title="Move this order forward"
          steps={[
            ["Review item quantities", "Verify products and customer details."],
            ["Send the confirmation", o.customer.email ? `A confirmation was emailed to ${o.customer.email}.` : "Add a customer email on future orders to send a confirmation."],
            ["Manage fulfilment", "Track the status or create an invoice."],
          ]}
        />
      </div>
      <InfoStrip title="Good to know">Unfulfilled orders may be cancelled; when cancelled, stock quantities are automatically restored.</InfoStrip>
    </div>
  );
}

// 05.04 Order details and fulfilment
export function OrderDetailsPage() {
  const order = useRouteOrder();
  const update = useUpdateOrderStatus(order.data?._id ?? "");
  const invoice = useInvoiceFromOrder();
  const canEdit = useCan("createOrders");
  const canCancel = useCan("deleteOrders");
  const [error, setError] = useState<unknown>(null);

  if (order.isLoading) return <Loading />;
  if (!order.data) return <ErrorNote error={order.error ?? true} fallback="We couldn't load this order. Please try again." onRetry={() => void order.refetch()} />;
  const o = order.data;
  const cancelled = o.status === "cancelled";

  const set = async (input: Parameters<typeof update.mutateAsync>[0]) => {
    setError(null);
    try {
      await update.mutateAsync(input);
      await order.refetch();
    } catch (err) {
      setError(err);
    }
  };

  const StatusBox = ({ label, value, tone, action }: { label: string; value: string; tone: "warning" | "success" | "neutral"; action?: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-3 rounded-md bg-surface-card px-4 py-3">
      <div>
        <p className="text-caption font-semibold uppercase text-ink-muted">{label}</p>
        <p className={cn("mt-1 text-body-lg font-semibold", tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-ink-brand")}>{value}</p>
      </div>
      {action}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Order {o.trackingNo} — Details</PageTitle>
      <IntroCard eyebrow="Order detail" title="A complete view of this sale.">
        Follow the payment, items and fulfilment status in one place.
      </IntroCard>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel title="Products in this order" subtitle={`Customer: ${customerName(o)} · Created ${shortDate(o.createdAt)}`}>
          <div className="overflow-x-auto rounded-lg bg-surface-pale p-3">
            <table className="w-full min-w-[30rem] text-left text-body-sm">
              <thead className="text-caption font-semibold uppercase text-ink-muted">
                <tr>
                  <th scope="col" className="px-3 py-2">Item</th>
                  <th scope="col" className="px-3 py-2">Qty</th>
                  <th scope="col" className="px-3 py-2">Unit price</th>
                  <th scope="col" className="px-3 py-2 text-ink-brand">Total</th>
                </tr>
              </thead>
              <tbody>
                {o.items.map((i, n) => (
                  <tr key={n} className="bg-surface-card [&>td:first-child]:rounded-l-md [&>td:last-child]:rounded-r-md">
                    <td className="px-3 py-3 text-ink-strong">{i.name}</td>
                    <td className="px-3 py-3 text-ink-strong">{count(i.quantity)}</td>
                    <td className="px-3 py-3 text-ink-strong">{naira(i.unitPrice)}</td>
                    <td className="px-3 py-3 font-semibold text-ink-brand">{naira(i.total)}</td>
                  </tr>
                ))}
                {o.deliveryFee > 0 && (
                  <tr className="bg-surface-card">
                    <td className="px-3 py-3 text-ink-strong">Delivery</td>
                    <td className="px-3 py-3 text-ink-strong">1</td>
                    <td className="px-3 py-3 text-ink-strong">{naira(o.deliveryFee)}</td>
                    <td className="px-3 py-3 font-semibold text-ink-brand">{naira(o.deliveryFee)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <h3 className="mt-6 text-title-sm text-ink-strong">Notes and customer contact</h3>
          <div className="mt-3 rounded-lg bg-surface-pale px-4 py-3 text-body-sm text-ink-secondary">
            <p>Customer email · {o.customer.email || "—"}</p>
            {o.customer.phone && <p className="mt-1">Phone · {o.customer.phone}</p>}
            <p className="mt-2 whitespace-pre-line">Notes · {o.notes || "—"}</p>
          </div>
          <ErrorNote className="mt-4" error={error ?? invoice.error} fallback="We couldn't update this order. Please try again." />
          <div className="mt-5 flex flex-col gap-3 md:flex-row">
            {!cancelled && (
              <Button className="md:flex-1" loading={invoice.busy} loadingText="Preparing…" onClick={() => void invoice.run(o._id)}>
                Create an invoice
              </Button>
            )}
            {canCancel && o.canCancel && (
              <ButtonLink to={`/orders/${o._id}/cancel`} variant="secondary" className="md:flex-1 bg-surface-tint-warm">
                Cancel unfulfilled order
              </ButtonLink>
            )}
          </div>
        </Panel>
        <Panel tone="pale" title="Payment and fulfilment">
          <div className="flex flex-col gap-3">
            <StatusBox
              label="Payment"
              value={cancelled ? "Cancelled" : o.paymentStatus === "paid" ? `Paid${o.paidAt ? ` · ${shortDate(o.paidAt)}` : ""}` : "Pending"}
              tone={o.paymentStatus === "paid" ? "success" : "warning"}
              action={
                canEdit && !cancelled && (
                  <Button size="md" variant="secondary" disabled={update.isPending} onClick={() => void set({ paymentStatus: o.paymentStatus === "paid" ? "pending" : "paid" })}>
                    {o.paymentStatus === "paid" ? "Mark unpaid" : "Mark paid"}
                  </Button>
                )
              }
            />
            <StatusBox
              label="Fulfilment"
              value={cancelled ? "Cancelled" : o.fulfilmentStatus === "fulfilled" ? `Fulfilled${o.fulfilledAt ? ` · ${shortDate(o.fulfilledAt)}` : ""}` : "Unfulfilled"}
              tone={o.fulfilmentStatus === "fulfilled" ? "success" : "neutral"}
              action={
                canEdit && !cancelled && (
                  <Button size="md" variant="secondary" disabled={update.isPending} onClick={() => void set({ fulfilmentStatus: o.fulfilmentStatus === "fulfilled" ? "unfulfilled" : "fulfilled" })}>
                    {o.fulfilmentStatus === "fulfilled" ? "Mark unfulfilled" : "Mark fulfilled"}
                  </Button>
                )
              }
            />
            <StatusBox label="Stock" value={cancelled ? "Restored on cancellation" : "Deducted when sale recorded"} tone="neutral" />
            <StatusBox label="Customer email" value={o.customer.email ? "Confirmation sent on creation" : "No email on this order"} tone="neutral" />
          </div>
          <p className="mt-6 text-caption font-semibold uppercase text-ink-muted">Order total</p>
          <p className="mt-2 text-title-md text-ink-brand lg:text-metric">{naira(o.totalAmount)}</p>
        </Panel>
      </div>
      <InfoStrip title="Cancellation and stock rules">
        Only unfulfilled orders can be cancelled. Cancellation restores stock. If the order is already fulfilled, cancellation isn't available.
      </InfoStrip>
    </div>
  );
}

// 05.07 Order cancellation (confirm)
export function CancelOrderPage() {
  const navigate = useNavigate();
  const order = useRouteOrder();
  const cancel = useCancelOrder(order.data?._id ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<unknown>(null);
  if (order.isLoading) return <Loading />;
  if (!order.data) return <ErrorNote error={order.error ?? true} fallback="We couldn't load this order. Please try again." onRetry={() => void order.refetch()} />;
  const o = order.data;

  const confirm = async () => {
    setError(null);
    try {
      await cancel.mutateAsync(reason.trim() || undefined);
      navigate(`/orders/${o._id}/cancelled`, { replace: true });
    } catch (err) {
      setError(err);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Order cancellation</PageTitle>
      <Banner tone="danger" eyebrow="Review required" title="Cancel this unfulfilled order?" body="Review the order and inventory changes before confirming." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel title={`Order ${o.trackingNo} · ${customerName(o)}`} subtitle="Check the fulfilment status and expected stock changes.">
          {o.canCancel ? (
            <div className="rounded-lg bg-danger-bg px-4 py-3">
              <p className="text-body-lg font-semibold text-danger">Eligible for cancellation</p>
              <p className="mt-1 text-body-sm text-ink-strong">Fulfilment status: Unfulfilled</p>
            </div>
          ) : (
            <div className="rounded-lg bg-surface-pale px-4 py-3">
              <p className="text-body-lg font-semibold text-ink-strong">This order can't be cancelled</p>
              <p className="mt-1 text-body-sm text-ink-secondary">{o.status === "cancelled" ? "It was already cancelled." : "It has been fulfilled."}</p>
            </div>
          )}
          <p className="mt-5 text-caption font-semibold uppercase text-ink-muted">Items in this order</p>
          <ul className="mt-2 flex flex-col gap-2">
            {o.items.map((i, n) => (
              <li key={n} className="grid grid-cols-[minmax(0,1.5fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-md bg-surface-pale px-4 py-3 text-body-sm">
                <span className="font-medium text-ink-strong">{i.name}</span>
                <span className="text-ink-muted">{count(i.quantity)} units</span>
                <span className="font-semibold text-danger">{count(i.quantity)} units restored</span>
              </li>
            ))}
            {o.deliveryFee > 0 && (
              <li className="grid grid-cols-[minmax(0,1.5fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-md bg-surface-pale px-4 py-3 text-body-sm">
                <span className="font-medium text-ink-strong">Delivery</span>
                <span className="text-ink-muted">1 item</span>
                <span className="font-semibold text-danger">No stock change</span>
              </li>
            )}
          </ul>
          {o.canCancel && (
            <div className="mt-5">
              <Field label="Reason (optional)" hint="Kept in the order notes.">
                <TextInput value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="Customer changed their mind" />
              </Field>
            </div>
          )}
          <div className="mt-5 rounded-lg bg-surface-pale px-4 py-3">
            <p className="text-body-lg font-semibold text-ink-brand">Only unfulfilled orders can be cancelled</p>
            <p className="mt-1 text-body-sm text-ink-muted">Cancelling restores stock automatically. You can't cancel an order that's already fulfilled.</p>
          </div>
          <ErrorNote className="mt-4" error={error} fallback="We couldn't cancel this order. Please try again." onRetry={() => void confirm()} />
          <div className="mt-5 flex flex-col-reverse gap-3 md:flex-row">
            <ButtonLink to={`/orders/${o._id}`} variant="secondary" className="md:flex-1">Keep the order</ButtonLink>
            {o.canCancel && (
              <Button variant="destructive" className="md:flex-1" loading={cancel.isPending} loadingText="Cancelling…" onClick={() => void confirm()}>
                Confirm order cancellation
              </Button>
            )}
          </div>
        </Panel>
        <NextSteps
          tone="danger"
          title="What cancellation changes"
          steps={[
            ["Review the order", "Confirm the customer and items are correct."],
            ["Restore inventory", "Stock for each cancelled item is returned."],
            ["Keep the history", "The cancelled order remains in your records."],
          ]}
        />
      </div>
      <InfoStrip title="Before you cancel">Check any customer communication or payment follow-up separately. Cancellation restores stock; refunds aren't handled here.</InfoStrip>
    </div>
  );
}

// 05.08 Order cancellation completed
export function OrderCancelledPage() {
  const order = useRouteOrder();
  if (order.isLoading) return <Loading />;
  if (!order.data) return <ErrorNote error={order.error ?? true} fallback="We couldn't load this order. Please try again." onRetry={() => void order.refetch()} />;
  const o = order.data;
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Order cancelled</PageTitle>
      <Banner tone="brand" eyebrow="Cancellation complete" title="The order was cancelled and stock restored." body="The order stays in your records as Cancelled." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel title="What changed">
          <DetailRows
            rows={[
              ["Order", o.trackingNo],
              ["Customer", customerName(o)],
              ["Stock restored", o.items.map((i) => `${count(i.quantity)} × ${i.name}`).join(", ")],
              ["Cancelled", shortDate(o.cancelledAt ?? new Date().toISOString())],
              ["Customer email", o.customer.email ? `A cancellation notice was emailed to ${o.customer.email}.` : "No customer email on this order."],
            ]}
          />
          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <ButtonLink to="/orders" className="md:flex-1">
              Back to orders <IconArrowRight aria-hidden="true" className="size-4" />
            </ButtonLink>
            <ButtonLink to="/inventory/products" variant="secondary" className="md:flex-1">Check inventory</ButtonLink>
          </div>
        </Panel>
        <TipList
          title="Next steps"
          tips={[
            { title: "Follow up on payment", body: o.paymentStatus === "paid" ? "This order was marked paid — arrange any refund with the customer directly." : "No payment was recorded for this order." },
            { title: "Keep the record", body: "Cancelled orders stay in your history and reports." },
          ]}
        />
      </div>
    </div>
  );
}
