import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { IconAlertTriangle, IconCheck, IconMail, IconPhone, IconSearch } from "@tabler/icons-react";
import { Button, ButtonLink, Dialog, Status } from "@/components/ui";
import { DetailRows, HelpPanel, IntroCard, PageTitle, Panel } from "@/components/page/Blocks";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { count, naira, shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useCan } from "@/lib/auth/useCan";
import { useUrlState } from "@/lib/nav/useUrlState";
import {
  STORE_ORDER_STATUS,
  useMerchantStoreOrder,
  useMerchantStoreOrders,
  useSetStoreOrderStatus,
  type MerchantStoreOrder,
  type Store,
  type StoreOrderFilter,
  type StoreOrderStatus,
} from "@/lib/store/api";
import { Loading, StoreTabs, WithStore, opsEyebrow } from "./shared";

// Store orders (merchant). There's no Figma frame for this; it follows the
// 05.02 orders list and 08.xx store screens: title, store tabs, intro card,
// search + status tabs, then a detail page with actions on the right.

const FILTERS: Array<[StoreOrderFilter, string]> = [
  ["all", "All"],
  ["payment_confirmed", "New"],
  ["processing", "Processing"],
  ["shipped", "Shipped"],
  ["delivered", "Delivered"],
  ["completed", "Completed"],
  ["pending", "Awaiting payment"],
  ["cancelled", "Cancelled"],
];

const badge = (s: StoreOrderStatus) => STORE_ORDER_STATUS[s] ?? { label: s, tone: "neutral" as const };

// ── List ──────────────────────────────────────────────────────────────────

export function StoreOrdersPage() {
  return <WithStore>{(store) => <StoreOrders store={store} />}</WithStore>;
}

function StoreOrders({ store }: { store: Store }) {
  const [status, setStatus] = useUrlState<StoreOrderFilter>("status", "all", FILTERS.map(([k]) => k));
  const [query, setQuery] = useUrlState<string>("q", "");
  const [pageKey, setPageKey] = useUrlState<string>("page", "1");
  const [typed, setTyped] = useState(query);
  const page = Math.max(1, Number(pageKey) || 1);
  const orders = useMerchantStoreOrders(status, query, page);
  const data = orders.data;

  const choose = (k: StoreOrderFilter) => {
    setStatus(k);
    setPageKey("1");
  };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Store orders</PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Orders customers placed in your online store.</p>
      <StoreTabs />
      <IntroCard eyebrow={opsEyebrow(store)} title="Paid orders move from New to Completed. Completing an order releases your earnings to your wallet." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)]">
        <Panel>
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(typed.trim());
              setPageKey("1");
            }}
          >
            <label className="flex h-control-lg items-center gap-2 rounded-md bg-surface-pale px-3">
              <IconSearch aria-hidden="true" className="size-icon text-ink-muted" />
              <span className="sr-only">Search store orders</span>
              <input
                type="search"
                value={typed}
                onChange={(e) => {
                  setTyped(e.target.value);
                  if (!e.target.value) setQuery("");
                }}
                placeholder="Search order number, customer name or email"
                className="h-full flex-1 bg-transparent text-input text-ink-strong outline-none placeholder:text-ink-muted"
              />
            </label>
          </form>
          <div className="-mx-5 mt-3 overflow-x-auto px-5 lg:mx-0 lg:px-0">
            <div role="tablist" aria-label="Filter by status" className="flex w-max items-center gap-1 rounded-md bg-surface-pale p-1">
              {FILTERS.map(([k, label]) => (
                <button key={k} type="button" role="tab" aria-selected={status === k} onClick={() => choose(k)} className={cn("min-h-11 whitespace-nowrap rounded-sm px-3 text-action font-semibold", status === k ? "bg-surface-card text-ink-brand shadow-card" : "text-ink-muted")}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {orders.isLoading ? (
            <Loading />
          ) : orders.error ? (
            <ErrorNote error={orders.error} fallback="We couldn't load your store orders." onRetry={() => void orders.refetch()} className="mt-4" />
          ) : !data || data.orders.length === 0 ? (
            <div className="mt-6 rounded-xl bg-surface-pale p-5">
              <p className="text-body-lg font-semibold text-ink-strong">{query || status !== "all" ? "No orders match" : "No store orders yet"}</p>
              <p className="mt-1 text-body-sm text-ink-muted">{query || status !== "all" ? "Try another filter or search." : "When customers buy from your store, their orders appear here."}</p>
            </div>
          ) : (
            <>
              <ul className="mt-4 flex flex-col divide-y divide-line-subtle">
                {data.orders.map((o) => {
                  const b = badge(o.status);
                  const units = o.items.reduce((s, i) => s + i.quantity, 0);
                  return (
                    <li key={o._id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-3 md:grid-cols-[1.2fr_1.4fr_auto_auto]">
                      <Link to={`/store/orders/${o._id}`} className="font-semibold text-ink-strong hover:underline">
                        {o.trackingNo}
                      </Link>
                      <span className="text-right font-semibold text-ink-strong md:order-3">{naira(o.total)}</span>
                      <span className="truncate text-body-sm text-ink-muted md:order-2">
                        {o.customerName} · {count(units)} {units === 1 ? "item" : "items"} · {shortDate(o.createdAt)}
                      </span>
                      <span className="justify-self-end md:order-4">
                        <Status tone={b.tone}>{b.label}</Status>
                      </span>
                    </li>
                  );
                })}
              </ul>
              {data.totalPages > 1 && (
                <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-3">
                  <Button variant="secondary" size="md" disabled={page <= 1} onClick={() => setPageKey(String(page - 1))}>
                    Previous
                  </Button>
                  <span className="text-body-sm text-ink-muted">
                    Page {page} of {data.totalPages} · {count(data.total)} orders
                  </span>
                  <Button variant="secondary" size="md" disabled={page >= data.totalPages} onClick={() => setPageKey(String(page + 1))}>
                    Next
                  </Button>
                </nav>
              )}
            </>
          )}
        </Panel>
        <HelpPanel
          items={[
            ["New", "Paid; start preparing it"],
            ["Shipped → Delivered", "Customer gets an email at each step"],
            ["Completed", "Earnings move to your available balance (automatically 7 days after delivery)"],
            ["Cancel", "Stock goes back; refund paid orders in Paystack"],
          ]}
        />
      </div>
    </div>
  );
}

// ── Detail ────────────────────────────────────────────────────────────────

type Next = "processing" | "shipped" | "delivered" | "completed";
const NEXT_LABEL: Record<Next, { label: string; body: string }> = {
  processing: { label: "Mark processing", body: "You're preparing the order. The customer gets an email." },
  shipped: { label: "Mark shipped", body: "The order is on its way. The customer gets an email." },
  delivered: { label: "Mark delivered", body: "The customer has it. It completes on its own after 7 days." },
  completed: { label: "Mark completed", body: "Releases your earnings for this order to your available balance." },
};
const HISTORY_LABEL: Partial<Record<StoreOrderStatus, string>> = { pending: "Order placed", payment_confirmed: "Payment confirmed" };

export function StoreOrderDetailPage() {
  const { id = "" } = useParams();
  return <WithStore>{(store) => <StoreOrderDetail store={store} id={id} />}</WithStore>;
}

function StoreOrderDetail({ store, id }: { store: Store; id: string }) {
  const order = useMerchantStoreOrder(id);
  const setStatus = useSetStoreOrderStatus(id);
  const canAct = useCan("createOrders");
  const [error, setError] = useState<unknown>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [refund, setRefund] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (order.isLoading) return <Loading />;
  if (!order.data) return <ErrorNote error={order.error ?? true} fallback="We couldn't load this order." onRetry={() => void order.refetch()} />;
  const o: MerchantStoreOrder = order.data;
  const b = badge(o.status);
  const next = (o.nextStatuses ?? []).filter((s): s is Next => s in NEXT_LABEL);
  const canCancel = (o.nextStatuses ?? []).includes("cancelled");
  const units = o.items.reduce((s, i) => s + i.quantity, 0);

  const move = async (status: Next | "cancelled") => {
    setError(null);
    setNotice(null);
    try {
      const res = await setStatus.mutateAsync(status);
      setConfirmCancel(false);
      if (res.refundNeeded) setRefund(`Refund ${naira(o.total)} to ${o.customerName} from your Paystack dashboard (Transactions → this payment → Refund).`);
      setNotice(status === "cancelled" ? "Order cancelled. Its stock is back in your store." : `Order marked ${badge(status === "completed" ? "completed" : status).label.toLowerCase()}.`);
    } catch (err) {
      setConfirmCancel(false);
      setError(err);
      void order.refetch();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        actions={
          <span className="flex flex-wrap gap-2">
            {o.paymentMode === "test" && <Status tone="neutral">Test payment (no money moved)</Status>}
            <Status tone={b.tone}>{b.label}</Status>
          </span>
        }
      >
        Order {o.trackingNo}
      </PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">
        Placed {shortDate(o.createdAt)} · {count(units)} {units === 1 ? "item" : "items"} · {o.isPaid ? `paid ${shortDate(o.paidAt)}` : "not paid"}
      </p>
      <IntroCard eyebrow={opsEyebrow(store)} title={o.isPaid ? "Prepare, ship and complete this order." : "This order hasn't been paid. Don't send anything yet."} />
      {refund && (
        <section role="alert" className="flex gap-3 rounded-xl bg-danger-bg px-5 py-4">
          <IconAlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-danger" />
          <div>
            <p className="font-semibold text-ink-strong">Refund needed</p>
            <p className="text-body-sm text-ink-secondary">{refund}</p>
          </div>
        </section>
      )}
      {o.status === "cancelled" && o.isPaid && o.earningsReversed && !refund && (
        <p className="rounded-xl bg-surface-tint-warm px-5 py-3 text-body-sm text-ink-strong">This paid order was cancelled. If you haven't yet, refund the customer from your Paystack dashboard.</p>
      )}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Panel title="Items">
            <ul className="flex flex-col divide-y divide-line-subtle">
              {o.items.map((i, n) => (
                <li key={`${i.product}-${n}`} className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 py-3">
                  {i.productImage ? <img src={i.productImage} alt="" className="size-12 rounded-md object-cover" /> : <span aria-hidden="true" className="size-12 rounded-md bg-surface-tint-blue" />}
                  <span className="min-w-0">
                    <Link to={`/store/products/${i.product}`} className="block truncate font-semibold text-ink-strong hover:underline">
                      {i.productName}
                    </Link>
                    <span className="text-body-sm text-ink-muted">
                      {count(i.quantity)} × {naira(i.price)}
                    </span>
                  </span>
                  <span className="font-semibold text-ink-strong">{naira(i.total)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-line-subtle pt-4">
              <DetailRows
                rows={[
                  ["Subtotal", naira(o.subtotal)],
                  ["Delivery", o.deliveryFee ? naira(o.deliveryFee) : "Free"],
                  ["Customer paid", <strong key="t">{naira(o.total)}</strong>],
                  ...(o.commissionAmount !== undefined ? ([[`BiManage fee (${o.commissionRate ?? 3}%)`, `− ${naira(o.commissionAmount)}`]] as Array<[string, string]>) : []),
                  ...(o.vendorPayout !== undefined ? ([["Your earnings", <strong key="p">{naira(o.vendorPayout)}</strong>]] as Array<[string, ReactNode]>) : []),
                ]}
              />
            </div>
          </Panel>
          <Panel title="History">
            <ol className="flex flex-col gap-2">
              {o.statusHistory.length === 0 ? (
                <li className="text-body-sm text-ink-muted">Order placed {shortDate(o.createdAt)}</li>
              ) : (
                o.statusHistory.map((h, n) => (
                  <li key={`${h.status}-${n}`} className="flex items-center justify-between gap-3 rounded-md bg-surface-pale px-4 py-2 text-body-sm">
                    <span className="flex items-center gap-2 font-semibold text-ink-strong">
                      <IconCheck aria-hidden="true" className="size-4 text-success" />
                      {HISTORY_LABEL[h.status] ?? badge(h.status).label}
                    </span>
                    <span className="text-ink-muted">{new Date(h.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })}</span>
                  </li>
                ))
              )}
            </ol>
          </Panel>
        </div>
        <div className="flex flex-col gap-5">
          <Panel title="Next step">
            {notice && (
              <p role="status" className="mb-3 text-body-sm text-success-ink">
                {notice}
              </p>
            )}
            <ErrorNote error={error} fallback="We couldn't update this order. Please try again." className="mb-3" />
            {!canAct ? (
              <p className="text-body-sm text-ink-muted">Your role can view store orders but not change them.</p>
            ) : next.length === 0 && !canCancel ? (
              <p className="text-body-sm text-ink-muted">{o.status === "completed" ? "This order is complete. Your earnings are in your available balance." : "Nothing more to do on this order."}</p>
            ) : (
              <div className="flex flex-col gap-3">
                {next.map((s, n) => (
                  <div key={s} className="flex flex-col gap-1">
                    <Button variant={n === 0 ? "primary" : "secondary"} onClick={() => void move(s)} loading={setStatus.isPending && setStatus.variables === s} loadingText="Saving…" disabled={setStatus.isPending}>
                      {NEXT_LABEL[s].label}
                    </Button>
                    <p className="text-caption text-ink-muted">{NEXT_LABEL[s].body}</p>
                  </div>
                ))}
                {canCancel && (
                  <Button variant="secondary" className="text-danger" onClick={() => setConfirmCancel(true)} disabled={setStatus.isPending}>
                    Cancel order
                  </Button>
                )}
              </div>
            )}
          </Panel>
          <Panel tone="pale" title="Customer">
            <DetailRows
              rows={[
                ["Name", o.customerName],
                ["Delivery address", [o.deliveryAddress, o.city, o.state].filter(Boolean).join(", ")],
                ...(o.notes ? ([["Note", o.notes]] as Array<[string, string]>) : []),
              ]}
            />
            <div className="mt-4 flex flex-col gap-2">
              <ButtonLink to={`mailto:${o.customerEmail}?subject=${encodeURIComponent(`Your order ${o.trackingNo} from ${store.storeName}`)}`} reloadDocument variant="secondary" size="md">
                <IconMail aria-hidden="true" className="size-4" /> Email {o.customerEmail}
              </ButtonLink>
              {o.customerPhone && (
                <ButtonLink to={`tel:${o.customerPhone.replace(/\s+/g, "")}`} reloadDocument variant="secondary" size="md">
                  <IconPhone aria-hidden="true" className="size-4" /> Call {o.customerPhone}
                </ButtonLink>
              )}
            </div>
          </Panel>
        </div>
      </div>
      <Dialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        tone="danger"
        icon={<IconAlertTriangle aria-hidden="true" className="size-7" />}
        title={`Cancel order ${o.trackingNo}?`}
        description={
          o.isPaid
            ? `The ${count(units)} ${units === 1 ? "item goes" : "items go"} back into stock and your earnings for this order are reversed. ${o.customerName} paid ${naira(o.total)}: you'll need to refund them from your Paystack dashboard.`
            : `The ${count(units)} ${units === 1 ? "item goes" : "items go"} back into stock. The customer hasn't paid, so there's nothing to refund.`
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmCancel(false)}>
              Keep order
            </Button>
            <Button variant="destructive" loading={setStatus.isPending} loadingText="Cancelling…" onClick={() => void move("cancelled")}>
              Cancel order
            </Button>
          </>
        }
      />
    </div>
  );
}
