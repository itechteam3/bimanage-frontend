import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconAlertTriangle, IconCircleCheck, IconPaperclip, IconShieldCheck, IconScale } from "@tabler/icons-react";
import { Button, ButtonLink, Dialog, EmptyState, Field, SelectInput, Spinner, Status, TextArea, TextInput } from "@/components/ui";
import { HelpPanel, Panel } from "@/components/page/Blocks";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { AttachmentPicker } from "@/components/attachments/AttachmentPicker";
import { applyFieldErrors, errorMessage, friendlyText } from "@/lib/api/errorMessage";
import { ApiError } from "@/lib/api/client";
import { useLeaveGuard } from "@/lib/nav/useLeaveGuard";
import { count, naira, shortDate } from "@/lib/format";
import { browser } from "@/lib/store/api";
import { isPaymentsUnavailable } from "@/lib/workspace/api";
import type { Attachment } from "@/lib/attachments";
import {
  DISPUTE_REASONS,
  RESOLUTIONS,
  bsnKeys,
  disputeOpen,
  disputeStatus,
  orderStatus,
  reasonLabel,
  resolutionLabel,
  startPayment,
  useAddEvidence,
  useAddReview,
  useConfirmDelivery,
  useDispute,
  useFileDispute,
  useMyDisputes,
  useOrder,
  useReplyDispute,
  useSetOrderStatus,
  useVendorDisputes,
  verifyPayment,
  type DisputeDetail,
  type DisputeReason,
  type DisputeSummary,
  type OrderDetail,
  type Resolution,
  type VerifyResult,
} from "@/lib/bisupplynet/api";
import { useQueryClient } from "@tanstack/react-query";
import { BsnTabs, FactsPanel, Heading, Intro, Loading, ProtectionBox, RecordRows, SellTabs, SummaryRows, dateTime } from "./shared";

const unitsOf = (d: OrderDetail) => `${count(d.order.quantity)} ${d.product.unit ?? (d.order.quantity === 1 ? "unit" : "units")}`;
const messageLink = (d: { conversationId: string | null }) => (d.conversationId ? `/messages/${d.conversationId}` : "/messages");

// ── 10.08 Order tracking (buyer and seller), 10.07 after payment ─────────

export function OrderDetailPage() {
  const { id = "" } = useParams();
  const order = useOrder(id);
  const [params] = useSearchParams();
  const reference = params.get("reference") ?? params.get("trxref");
  const returning = params.get("payment") === "success" && Boolean(reference);

  if (returning && reference) return <PaymentReturn id={id} reference={reference} />;
  if (order.isLoading) return <Loading label="Loading your order…" />;
  if (!order.data) return <ErrorNote error={order.error ?? true} fallback="We couldn't load this order." onRetry={() => void order.refetch()} />;
  return <OrderTracking d={order.data} />;
}

/** Back from Paystack: verify once, then show 10.07. */
function PaymentReturn({ id, reference }: { id: string; reference: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const order = useOrder(id);
  const [state, setState] = useState<{ result: VerifyResult | "error"; message?: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const started = useRef(false);

  const check = async () => {
    setChecking(true);
    try {
      const res = await verifyPayment(reference);
      setState({ result: res.result, message: res.message });
      void qc.invalidateQueries({ queryKey: bsnKeys.all });
    } catch (err) {
      const result = err instanceof ApiError && typeof err.data.result === "string" ? (err.data.result as VerifyResult) : "error";
      setState({ result, message: err instanceof ApiError ? err.message : undefined });
    }
    setChecking(false);
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const track = () => navigate(`/bisupplynet/orders/${id}`, { replace: true });

  if (!state || !order.data) return <Loading label="Checking your payment…" />;
  const d = order.data;

  if (state.result === "paid" || state.result === "already_paid") {
    return (
      <div className="flex flex-col gap-6">
        <Heading title="Escrow payment protected" subtitle="Your money is securely held until delivery confirmation." action={<Button size="md" onClick={track}>Track bulk order</Button>} />
        <Intro>Only confirm delivery after inspecting the ordered goods.</Intro>
        <section aria-label="Buyer protection is active" className="mx-auto w-full max-w-3xl min-w-0 rounded-2xl border border-line-card bg-surface-card p-5 shadow-card lg:p-10">
          <div className="flex items-center gap-3">
            <IconShieldCheck aria-hidden="true" className="size-8 shrink-0 text-success" />
            <h2 className="text-title-md text-ink-strong lg:text-page-title">Buyer protection is active</h2>
          </div>
          <p className="mt-3 text-body-lg text-ink-muted">Both businesses can follow the order milestones and message each other.</p>
          <div className="mt-5">
            <SummaryRows
              rows={[
                ["Order reference", d.order.trackingNo],
                ["Wholesaler", d.seller?.businessName ?? "Your supplier"],
                ["Funds held", naira(d.escrow.heldAmount || d.escrow.totalAmount)],
                ["Escrow status", "Protected"],
                ["Next milestone", "Supplier dispatch"],
              ]}
            />
          </div>
          <p className="mt-4 text-body-sm font-semibold text-ink-brand">Only confirm delivery after inspecting the ordered goods.</p>
          {d.order.paymentMode === "test" && <p className="mt-2 text-body-sm text-ink-muted">This was a test payment. No real money moved.</p>}
        </section>
        <Button className="md:self-center md:px-16" onClick={track}>
          Track bulk order
        </Button>
      </div>
    );
  }

  const pending = state.result === "pending";
  const text = pending
    ? "Paystack is still confirming your payment. This usually takes a minute."
    : state.result === "refunded_late"
      ? friendlyText(state.message, "This order was cancelled before your payment arrived, so we're refunding you in full.")
      : "We couldn't confirm this payment. If money left your account, contact support with your order number.";
  return (
    <div className="flex flex-col gap-6">
      <Heading title={pending ? "Checking your payment" : "Payment not confirmed"} subtitle={`Order ${d.order.trackingNo}`} />
      <section role={pending ? "status" : "alert"} className="flex gap-3 rounded-xl bg-surface-tint-warm px-5 py-4">
        {pending ? <Spinner className="size-5 shrink-0 text-ink-brand" /> : <IconAlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />}
        <p className="text-body-sm text-ink-strong">{text}</p>
      </section>
      <div className="flex flex-wrap gap-3">
        {pending && (
          <Button size="md" loading={checking} loadingText="Checking…" onClick={() => void check()}>
            Check again
          </Button>
        )}
        <Button size="md" variant="outlined" onClick={track}>
          View order
        </Button>
        {!pending && (
          <ButtonLink to={`/support/tickets/new?category=bisupplynet&ref=${encodeURIComponent(d.order.trackingNo)}`} size="md" variant="outlined">
            Contact support
          </ButtonLink>
        )}
      </div>
    </div>
  );
}

const SELLER_STEP: Record<string, { label: string; body: string }> = {
  processing: { label: "Mark processing", body: "You're preparing the order. The buyer is told." },
  shipped: { label: "Mark shipped", body: "The goods are on their way. The buyer can then confirm delivery." },
  delivered: { label: "Mark delivered", body: "The buyer has them. The payment is released when they confirm, or 7 days after delivery." },
};

function OrderTracking({ d }: { d: OrderDetail }) {
  const location = useLocation();
  const seller = d.role === "seller";
  const o = d.order;
  const actions = new Set(d.allowedActions);
  const st = orderStatus(o.status);
  const nav = location.state as { payProblem?: "soon" | "failed"; confirmed?: boolean } | null;
  const payProblem = nav?.payProblem;

  // Upcoming milestones, after what has happened (timeline comes from the API).
  const done = d.timeline.map((t) => ({ key: `${t.status}-${t.at}`, cells: [dateTime(t.at), t.label, t.status === "payment_confirmed" ? naira(o.totalAmount) : t.by === "wholesaler" ? "Supplier" : t.by === "buyer" ? "Buyer" : "BiManage", "Done"] as [ReactNode, ReactNode, ReactNode, ReactNode] }));
  const next: Array<[ReactNode, ReactNode, ReactNode, ReactNode]> = [];
  if (o.status === "pending") next.push(["Within 24 hours", "Payment into escrow", naira(o.totalAmount), "Waiting"]);
  if (["pending", "payment_confirmed"].includes(o.status)) next.push(["Within 48 hours of payment", "Supplier update", "Expected", "Pending"]);
  if (["pending", "payment_confirmed", "processing"].includes(o.status)) next.push(["Delivery date", d.expectedBy ? shortDate(d.expectedBy) : "To be confirmed", o.deliveryAddress, "Pending"]);
  if (["pending", "payment_confirmed", "processing", "shipped", "delivered"].includes(o.status)) {
    next.push(["Buyer checks", "Check the goods", "Confirm or report a problem", "Next"]);
    next.push([
      d.escrow.autoReleaseAt ? `By ${shortDate(d.escrow.autoReleaseAt)}` : "After confirmation",
      "Escrow release",
      seller && d.escrow.commissionRate !== undefined ? `Less ${d.escrow.commissionRate}% fee` : "Paid to the supplier",
      "Locked",
    ]);
  }

  return (
    <div className="flex flex-col gap-6">
      <Heading
        title={`Wholesale order ${o.trackingNo}`}
        subtitle="Track fulfilment, delivery and escrow release."
        action={
          actions.has("message") ? (
            <ButtonLink to={messageLink(d)} size="md">
              {seller ? "Contact buyer" : "Contact supplier"}
            </ButtonLink>
          ) : undefined
        }
      />
      {seller ? <SellTabs /> : <BsnTabs />}
      <Intro>{seller ? "Update paid orders within 48 hours so the buyer knows what's happening." : "Suppliers must update paid orders within 48 hours."}</Intro>
      {nav?.confirmed && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-success-bg px-5 py-3 text-body-sm text-success">
          <IconCircleCheck aria-hidden="true" className="size-5 shrink-0" /> Delivery confirmed. The payment is released to the supplier. You can now rate them.
        </p>
      )}
      {payProblem && o.status === "pending" && (
        <p role="alert" className="rounded-xl bg-surface-tint-warm px-5 py-3 text-body-sm text-ink-strong">
          {payProblem === "soon"
            ? "Your order is saved, but online payments are coming soon. We hold the stock for 24 hours; try paying again later."
            : "Your order is saved, but we couldn't open the payment page. We hold the stock for 24 hours; try paying again."}
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Order milestone timeline" subtitle="Delivery must be checked before funds release.">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Status tone={st.tone}>{st.label}</Status>
              {o.paymentMode === "test" && <Status tone="neutral">Test payment (no money moved)</Status>}
            </div>
            <RecordRows label="Order milestones" rows={[...done, ...next.map((cells, i) => ({ key: `next-${i}`, cells }))]} />
          </Panel>
          {seller ? <SellerActions d={d} /> : <BuyerActions d={d} />}
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <FactsPanel
            items={[
              ...(seller
                ? ([["Buyer", d.buyer?.businessName || d.buyer?.name || "The buyer"]] as Array<[string, ReactNode]>)
                : ([["Seller", d.seller ? <Link key="s" className="text-ink-brand hover:underline" to={`/bisupplynet/suppliers/${d.seller._id}`}>{d.seller.businessName}</Link> : "Your supplier"]] as Array<[string, ReactNode]>)),
              ["Quantity", `${unitsOf(d)} of ${d.product.name}`],
              ["Order total", naira(o.totalAmount)],
              ["Escrow", `${d.escrow.moneyState}${d.escrow.heldAmount ? ` • ${naira(d.escrow.heldAmount)} held` : ""}`],
              ...(seller && d.escrow.sellerShare !== undefined
                ? ([
                    ["Your share", naira(d.escrow.sellerShare)],
                    ["BiManage fee", naira(d.escrow.commission ?? 0)],
                  ] as Array<[string, ReactNode]>)
                : []),
              ["Deliver to", [o.receivingBusiness, o.deliveryAddress].filter(Boolean).join(", ")],
              ...(o.contactPhone ? ([["Contact phone", o.contactPhone]] as Array<[string, ReactNode]>) : []),
            ]}
          />
          <section className="min-w-0 rounded-2xl border border-line-card bg-surface-card p-4 shadow-card">
            <h2 className="text-body-lg font-semibold text-ink-brand">Ghost order protection</h2>
            <div className="mt-3 rounded-xl bg-surface-tint-blue p-3">
              <p className="font-semibold text-ink-brand">48-hour seller update</p>
              <p className="text-body-sm text-ink-muted">The supplier must update the order status after payment.</p>
            </div>
            <div className="mt-3 rounded-xl bg-success-bg p-3">
              <p className="font-semibold text-success">7-day automatic refund</p>
              <p className="text-body-sm text-ink-muted">If the supplier doesn't ship, the buyer is refunded in full and the supplier is flagged.</p>
            </div>
            <p className="mt-3 text-caption text-ink-muted">The buyer's confirmation releases the escrow payment.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

function BuyerActions({ d }: { d: OrderDetail }) {
  const actions = new Set(d.allowedActions);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = d.order._id;

  const pay = async () => {
    setError(null);
    setPaying(true);
    try {
      const res = await startPayment(id);
      browser.go(res.authorizationUrl);
    } catch (err) {
      setPaying(false);
      setError(isPaymentsUnavailable(err) ? "Online payments are coming soon. Your order is saved; try again later." : errorMessage(err, "We couldn't open the payment page. Please try again."));
    }
  };

  const confirmable = d.order.isPaid && d.escrow.status === "held" && ["shipped", "delivered"].includes(d.order.status);
  const any = actions.has("pay") || actions.has("confirm_delivery") || actions.has("dispute") || actions.has("review") || d.dispute;

  return (
    <Panel title="Available actions">
      {error && (
        <p role="alert" className="mb-3 text-body-sm text-danger">
          {error}
        </p>
      )}
      {!any ? (
        <p className="text-body-sm text-ink-muted">{d.order.status === "completed" ? "This order is complete. Thank you for buying on BiSupplyNet." : "Nothing for you to do right now. We'll let you know when the supplier updates the order."}</p>
      ) : (
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
          {actions.has("pay") && (
            <Button onClick={() => void pay()} loading={paying} loadingText="Opening payment…">
              Pay {naira(d.order.totalAmount)} securely
            </Button>
          )}
          {actions.has("confirm_delivery") && <ButtonLink to={`/bisupplynet/orders/${id}/confirm`}>Confirm received goods</ButtonLink>}
          {actions.has("dispute") && (
            <ButtonLink to={`/bisupplynet/orders/${id}/dispute`} variant="outlined">
              Report a problem
            </ButtonLink>
          )}
          {d.dispute && (
            <ButtonLink to={`/bisupplynet/disputes/${d.dispute.id}`} variant="outlined">
              View dispute
            </ButtonLink>
          )}
        </div>
      )}
      {confirmable && !actions.has("confirm_delivery") && !d.dispute && (
        <p className="mt-3 text-body-sm text-ink-muted">Only the business owner or an admin can confirm delivery, because it releases the payment.</p>
      )}
      {actions.has("review") && <OrderReview orderId={id} supplier={d.seller?.businessName ?? "the supplier"} />}
    </Panel>
  );
}

function OrderReview({ orderId, supplier }: { orderId: string; supplier: string }) {
  const add = useAddReview();
  const [rating, setRating] = useState("");
  const [comment, setComment] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  if (done) return <p role="status" className="mt-4 text-body-sm text-success-ink">Thank you. Your review of {supplier} is saved.</p>;
  return (
    <form
      className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-3 border-t border-line-subtle pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        setProblem(null);
        if (!rating) return setProblem("Choose a rating.");
        add.mutateAsync({ orderId, rating: Number(rating), comment: comment.trim() }).then(
          () => setDone(true),
          (err) => setProblem(errorMessage(err, "We couldn't save your review. Please try again."))
        );
      }}
    >
      <p className="font-semibold text-ink-strong">Rate {supplier}</p>
      <Field label="Rating">
        <SelectInput value={rating} onChange={(e) => setRating(e.target.value)}>
          <option value="">Choose a rating</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "star" : "stars"}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field label="Your experience">
        <TextArea rows={3} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>
      {problem && (
        <p role="alert" className="text-body-sm text-danger">
          {problem}
        </p>
      )}
      <Button type="submit" size="md" className="md:self-start" loading={add.isPending} loadingText="Saving…">
        Submit review
      </Button>
    </form>
  );
}

function SellerActions({ d }: { d: OrderDetail }) {
  const set = useSetOrderStatus(d.order._id);
  const steps = d.allowedActions.filter((a): a is "processing" | "shipped" | "delivered" => a in SELLER_STEP);
  const canCancel = d.allowedActions.includes("cancelled");
  const [expectedBy, setExpectedBy] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const datable = steps.some((s) => s === "processing" || s === "shipped");

  const move = async (status: "processing" | "shipped" | "delivered" | "cancelled") => {
    setError(null);
    setNotice(null);
    try {
      await set.mutateAsync({ status, ...(expectedBy && (status === "processing" || status === "shipped") ? { expectedBy } : {}) });
      setCancelOpen(false);
      setNotice(status === "cancelled" ? (d.order.isPaid ? "Order cancelled. The buyer is being refunded in full." : "Order cancelled. The stock is back on your listing.") : `Order marked ${orderStatus(status).label.toLowerCase()}.`);
    } catch (err) {
      setCancelOpen(false);
      setError(err);
    }
  };

  return (
    <Panel title="Update this order">
      {notice && (
        <p role="status" className="mb-3 text-body-sm text-success-ink">
          {notice}
        </p>
      )}
      <ErrorNote error={error} fallback="We couldn't update this order. Please try again." className="mb-3" />
      {steps.length === 0 && !canCancel ? (
        <p className="text-body-sm text-ink-muted">
          {d.order.status === "pending" ? "Waiting for the buyer to pay. Don't send anything yet." : d.order.status === "completed" ? "This order is complete. Your share is in your wallet." : "Nothing more to do on this order."}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {datable && (
            <Field label="Expected delivery date (optional)" hint="The buyer sees this on their order.">
              <TextInput type="date" value={expectedBy} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setExpectedBy(e.target.value)} />
            </Field>
          )}
          {steps.map((s, i) => (
            <div key={s} className="flex flex-col gap-1">
              <Button variant={i === 0 ? "primary" : "secondary"} className="md:self-start" disabled={set.isPending} loading={set.isPending && set.variables?.status === s} loadingText="Saving…" onClick={() => void move(s)}>
                {SELLER_STEP[s]!.label}
              </Button>
              <p className="text-caption text-ink-muted">{SELLER_STEP[s]!.body}</p>
            </div>
          ))}
          {canCancel && (
            <Button variant="secondary" className="text-danger md:self-start" disabled={set.isPending} onClick={() => setCancelOpen(true)}>
              Cancel order
            </Button>
          )}
        </div>
      )}
      <Dialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        tone="danger"
        icon={<IconAlertTriangle aria-hidden="true" className="size-7" />}
        title={`Cancel order ${d.order.trackingNo}?`}
        description={
          d.order.isPaid
            ? `The buyer paid ${naira(d.order.totalAmount)}. Cancelling refunds them in full and the stock goes back on your listing. Cancelling paid orders also lowers your trust score.`
            : "The buyer hasn't paid yet, so there's nothing to refund. The stock goes back on your listing."
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              Keep order
            </Button>
            <Button variant="destructive" loading={set.isPending} loadingText="Cancelling…" onClick={() => void move("cancelled")}>
              {d.order.isPaid ? "Cancel and refund" : "Cancel order"}
            </Button>
          </>
        }
      />
    </Panel>
  );
}

// ── 10.09 Confirm delivery ───────────────────────────────────────────────

export function ConfirmDeliveryPage() {
  const { id = "" } = useParams();
  const order = useOrder(id);
  if (order.isLoading) return <Loading label="Loading your order…" />;
  if (!order.data) return <ErrorNote error={order.error ?? true} fallback="We couldn't load this order." onRetry={() => void order.refetch()} />;
  return <ConfirmDelivery d={order.data} />;
}

function ConfirmDelivery({ d }: { d: OrderDetail }) {
  const navigate = useNavigate();
  const confirm = useConfirmDelivery(d.order._id);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const allowed = d.allowedActions.includes("confirm_delivery");
  const canDispute = d.allowedActions.includes("dispute");
  const supplier = d.seller?.businessName ?? "the supplier";

  const go = async () => {
    setError(null);
    try {
      await confirm.mutateAsync();
      setOpen(false);
      navigate(`/bisupplynet/orders/${d.order._id}`, { replace: true, state: { confirmed: true } });
    } catch (err) {
      setOpen(false);
      setError(err);
    }
  };

  const button = (
    <Button size="md" onClick={() => setOpen(true)} disabled={!allowed}>
      Confirm delivery
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <Heading title="Confirm goods received" subtitle="Inspect your delivery before releasing funds." action={allowed ? button : undefined} />
      <Intro>Confirming releases the escrow payment to the supplier.</Intro>
      <section className="mx-auto w-full max-w-3xl min-w-0 rounded-2xl border border-line-card bg-surface-card p-5 shadow-card lg:p-10">
        <h2 className="text-title-md text-ink-strong lg:text-page-title">Confirm receipt of this order</h2>
        <p className="mt-3 text-body-lg text-ink-muted">Report a problem if goods are missing or damaged.</p>
        <div className="mt-5">
          <SummaryRows
            rows={[
              ["Order", d.order.trackingNo],
              ["Items", `${unitsOf(d)} of ${d.product.name}`],
              ["Escrow amount", naira(d.escrow.heldAmount || d.escrow.totalAmount)],
              ["Decision", canDispute ? "Confirm • Report a problem" : "Confirm"],
            ]}
          />
        </div>
        <p className="mt-4 text-body-sm font-semibold text-ink-brand">Confirming releases the escrow payment to {supplier}. This can't be undone.</p>
        <div className="mt-4 rounded-xl bg-surface-tint-blue px-4 py-4">
          <p className="text-caption font-semibold uppercase text-ink-brand">Confirm delivery carefully</p>
          <p className="mt-2 text-body-lg text-ink-strong">Check the quantity and condition of the goods first.</p>
          <p className="mt-1 text-body-sm text-ink-muted">Only the buying business's owner or an admin can release escrow funds.</p>
        </div>
        {!allowed && (
          <p role="status" className="mt-4 text-body-sm text-ink-strong">
            {d.order.status === "completed" || d.escrow.status === "released"
              ? "Delivery is already confirmed for this order."
              : d.dispute
                ? "This order has an open dispute. BiTechTeam will decide where the money goes."
                : d.order.isPaid && ["shipped", "delivered"].includes(d.order.status)
                  ? "Only the business owner or an admin can confirm delivery, because it releases the payment."
                  : "You can confirm delivery once the supplier has shipped the order."}
          </p>
        )}
        <ErrorNote error={error} fallback="We couldn't confirm delivery. Please try again." className="mt-4" />
      </section>
      <div className="flex flex-col gap-3 md:flex-row md:justify-center">
        {allowed && button}
        {canDispute && (
          <ButtonLink to={`/bisupplynet/orders/${d.order._id}/dispute`} size="md" variant="outlined">
            Report a problem
          </ButtonLink>
        )}
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        icon={<IconCircleCheck className="size-7" />}
        title={`Release ${naira(d.escrow.heldAmount || d.escrow.totalAmount)} to ${supplier}?`}
        description="Only confirm if you've received the goods and checked them. The payment goes to the supplier straight away and can't be taken back."
        actions={
          <>
            <Button variant="outlined" onClick={() => setOpen(false)}>
              Not yet
            </Button>
            <Button loading={confirm.isPending} loadingText="Releasing…" onClick={() => void go()}>
              Yes, release payment
            </Button>
          </>
        }
      />
    </div>
  );
}

// ── 10.10 File a dispute ─────────────────────────────────────────────────

export function FileDisputePage() {
  const { id = "" } = useParams();
  const order = useOrder(id);
  if (order.isLoading) return <Loading label="Loading your order…" />;
  if (!order.data) return <ErrorNote error={order.error ?? true} fallback="We couldn't load this order." onRetry={() => void order.refetch()} />;
  const d = order.data;
  if (!d.allowedActions.includes("dispute")) {
    return (
      <EmptyState
        className="max-w-xl"
        icon={<IconScale className="size-7" />}
        title={d.dispute ? "A dispute is already open" : "This order can't be disputed here"}
        body={
          d.dispute
            ? "Follow the case and add evidence on the dispute page."
            : !d.order.isPaid
              ? "You can report a problem once the order is paid."
              : "Problems must be reported within 7 days of delivery, while the payment is still held. Contact support if you still need help."
        }
        action={
          d.dispute ? (
            <ButtonLink to={`/bisupplynet/disputes/${d.dispute.id}`} size="md">
              View dispute
            </ButtonLink>
          ) : (
            <ButtonLink to={`/support/tickets/new?category=bisupplynet&ref=${encodeURIComponent(d.order.trackingNo)}`} size="md" variant="outlined">
              Contact support
            </ButtonLink>
          )
        }
      />
    );
  }
  return <DisputeForm d={d} />;
}

const disputeSchema = (max: { quantity: number; total: number }) =>
  z.object({
    reason: z.string().min(1, "Choose what went wrong."),
    dateReceived: z.string(),
    affectedQuantity: z.string().refine((v) => !v || (Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= max.quantity), `Enter a whole number from 1 to ${count(max.quantity)}.`),
    amountDisputed: z.string().refine((v) => !v || (Number(v) > 0 && Number(v) <= max.total), `Enter an amount up to ${naira(max.total)}, the order total.`),
    description: z.string().trim().min(10, "Describe the problem (at least 10 characters).").max(2000, "Keep the description under 2,000 characters."),
    requestedResolution: z.string(),
  });
type DisputeForm = z.infer<ReturnType<typeof disputeSchema>>;

function DisputeForm({ d }: { d: OrderDetail }) {
  const navigate = useNavigate();
  const file = useFileDispute();
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const { register, handleSubmit, formState, setError: setFieldError } = useForm<DisputeForm>({
    resolver: zodResolver(disputeSchema({ quantity: d.order.quantity, total: d.order.totalAmount })),
    defaultValues: { reason: "", dateReceived: d.deliveredAt ? d.deliveredAt.slice(0, 10) : "", affectedQuantity: "", amountDisputed: "", description: "", requestedResolution: "" },
  });
  const guard = useLeaveGuard((formState.isDirty || files.length > 0) && !formState.isSubmitSuccessful);
  const e = formState.errors;

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      const res = await file.mutateAsync({
        orderId: d.order._id,
        reason: v.reason as DisputeReason,
        description: v.description.trim(),
        ...(v.dateReceived ? { dateReceived: v.dateReceived } : {}),
        ...(v.affectedQuantity ? { affectedQuantity: Number(v.affectedQuantity) } : {}),
        ...(v.amountDisputed ? { amountDisputed: Number(v.amountDisputed) } : {}),
        ...(v.requestedResolution ? { requestedResolution: v.requestedResolution as Resolution } : {}),
        evidence: files,
      });
      guard.allow();
      navigate(`/bisupplynet/disputes/${res.dispute._id}?created=1`, { replace: true });
    } catch (err) {
      if (!applyFieldErrors(err, setFieldError, ["reason", "dateReceived", "affectedQuantity", "amountDisputed", "description", "requestedResolution"])) setError(err);
    }
  });

  return (
    <div className="flex flex-col gap-6">
      {guard.dialog}
      <Heading
        title="Report an order issue"
        subtitle="Open a dispute within seven days of delivery, or any time before it arrives."
        action={
          <ButtonLink to={`/bisupplynet/orders/${d.order._id}`} size="md">
            Open order details
          </ButtonLink>
        }
      />
      <Intro>Attach evidence and describe any wrong, damaged or missing items.</Intro>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <form noValidate onSubmit={onSubmit} className="flex min-w-0 flex-col gap-5">
          <Panel title="Dispute case details" subtitle={`Order ${d.order.trackingNo}${d.seller ? ` • ${d.seller.businessName}` : ""}.`}>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-x-10 md:gap-y-6">
              <Field label="Dispute reason" required error={e.reason?.message}>
                <SelectInput {...register("reason")}>
                  <option value="">Choose a reason</option>
                  {DISPUTE_REASONS.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Order reference">
                <TextInput value={d.order.trackingNo} readOnly />
              </Field>
              <Field label="Date received" error={e.dateReceived?.message}>
                <TextInput type="date" max={new Date().toISOString().slice(0, 10)} {...register("dateReceived")} />
              </Field>
              <Field label="Affected quantity" hint={`Of ${unitsOf(d)}`} error={e.affectedQuantity?.message}>
                <TextInput type="number" inputMode="numeric" min={1} max={d.order.quantity} {...register("affectedQuantity")} />
              </Field>
              <Field label="Amount disputed (₦)" hint={`Up to ${naira(d.order.totalAmount)}`} error={e.amountDisputed?.message}>
                <TextInput type="number" inputMode="decimal" min={1} max={d.order.totalAmount} {...register("amountDisputed")} />
              </Field>
              <Field label="Requested resolution" error={e.requestedResolution?.message}>
                <SelectInput {...register("requestedResolution")}>
                  <option value="">Choose what you'd like</option>
                  {RESOLUTIONS.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Description" required error={e.description?.message} className="md:col-span-2">
                <TextArea rows={5} maxLength={2000} placeholder="For example: Two bags arrived torn and the rice was wet." {...register("description")} />
              </Field>
              <div className="min-w-0 md:col-span-2">
                <AttachmentPicker label="Supporting evidence" value={files} onChange={setFiles} onBusy={setUploading} />
              </div>
            </div>
            <div className="mt-6">
              <ProtectionBox />
            </div>
          </Panel>
          <ErrorNote error={error} fallback="We couldn't open the dispute. Please try again." />
          <Button type="submit" className="md:self-end md:px-10" loading={file.isPending} loadingText="Submitting…" disabled={uploading}>
            Submit dispute
          </Button>
        </form>
        <HelpPanel
          items={[
            ["Filing window", "Within 7 days of delivery"],
            ["Evidence", "Photos • Messages • Documents"],
            ["Protection", "Escrow held during review"],
            ["Possible decisions", "Full refund • Partial refund • Supplier paid"],
          ]}
          callout={{ title: "Order evidence", body: "Keep order updates, delivery details and messages together. BiTechTeam reviews both sides." }}
        />
      </div>
    </div>
  );
}

// ── Dispute lists ────────────────────────────────────────────────────────

function DisputeRows({ list, seller }: { list: DisputeSummary[]; seller?: boolean }) {
  return (
    <RecordRows
      label="Disputes"
      rows={list.map((x) => {
        const st = disputeStatus(x.status);
        const other = seller ? (typeof x.client === "object" && x.client ? x.client.name : "") : typeof x.wholesaler === "object" && x.wholesaler ? x.wholesaler.businessName : "";
        return {
          key: x._id,
          cells: [
            <Link key="r" to={`/bisupplynet/disputes/${x._id}`} className="hover:underline">
              {x.reference ?? `Dispute on ${x.order?.trackingNo ?? "an order"}`}
            </Link>,
            [x.order?.trackingNo, x.order?.productName, other].filter(Boolean).join(" • "),
            `${reasonLabel(x.reason)} • ${shortDate(x.createdAt)}`,
            <Status key="s" tone={st.tone}>
              {st.label}
            </Status>,
          ],
        };
      })}
    />
  );
}

export function MyDisputesPage() {
  const list = useMyDisputes();
  return (
    <div className="flex flex-col gap-6">
      <Heading title="Order disputes" subtitle="Problems you reported on wholesale orders." />
      <BsnTabs />
      <Intro>Escrow stays frozen while BiTechTeam reviews a dispute.</Intro>
      <Panel>
        {list.isLoading ? (
          <Loading label="Loading disputes…" />
        ) : list.error ? (
          <ErrorNote error={list.error} fallback="We couldn't load your disputes." onRetry={() => void list.refetch()} />
        ) : !list.data?.length ? (
          <EmptyState className="border-0 p-0" icon={<IconScale className="size-7" />} title="No disputes" body="If an order arrives damaged, short or not at all, report it from the order page." />
        ) : (
          <DisputeRows list={list.data} />
        )}
      </Panel>
    </div>
  );
}

export function SellerDisputesPage() {
  const list = useVendorDisputes();
  return (
    <div className="flex flex-col gap-6">
      <Heading title="Disputes on your orders" subtitle="Reply with your side and evidence before BiTechTeam decides." />
      <SellTabs />
      <Intro>The payment stays held until each dispute is resolved.</Intro>
      <Panel>
        {list.isLoading ? (
          <Loading label="Loading disputes…" />
        ) : list.error ? (
          <ErrorNote error={list.error} fallback="We couldn't load disputes." onRetry={() => void list.refetch()} />
        ) : !list.data?.length ? (
          <EmptyState className="border-0 p-0" icon={<IconScale className="size-7" />} title="No disputes" body="Buyers haven't reported a problem with any of your orders." />
        ) : (
          <DisputeRows list={list.data} seller />
        )}
      </Panel>
    </div>
  );
}

// ── 10.11 Dispute review ─────────────────────────────────────────────────

export function DisputeDetailPage() {
  const { id = "" } = useParams();
  const dispute = useDispute(id);
  if (dispute.isLoading) return <Loading label="Loading the dispute…" />;
  if (!dispute.data) return <ErrorNote error={dispute.error ?? true} fallback="We couldn't load this dispute." onRetry={() => void dispute.refetch()} />;
  return <DisputeView x={dispute.data} />;
}

const fileName = (url: string, name?: string) => name || decodeURIComponent(url.split("/").pop() ?? "File");

function DisputeView({ x }: { x: DisputeDetail }) {
  const [params] = useSearchParams();
  const seller = x.role === "seller";
  const st = disputeStatus(x.status);
  const open = disputeOpen(x.status);
  const left = Math.max(0, x.evidenceLimit.perParty - x.evidenceLimit.used);
  const files = x.evidenceFiles ?? [];
  const buyerFiles = files.filter((f) => f.by === "client");
  const sellerFiles = files.filter((f) => f.by === "vendor");
  const sellerReplied = (x.responses ?? []).some((r) => r.by === "vendor");
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const outcome = x.escrow?.outcome;
  const created = params.get("created") === "1";

  return (
    <div className="flex flex-col gap-6">
      <Heading
        title={`Dispute case ${x.reference ?? ""}`.trim()}
        subtitle={`Case timeline, evidence and ${seller ? "buyer" : "supplier"} responses.`}
        action={
          open && left > 0 ? (
            <Button size="md" onClick={() => setEvidenceOpen(true)}>
              Add evidence
            </Button>
          ) : undefined
        }
      />
      {seller ? <SellTabs /> : <BsnTabs />}
      <Intro>Both businesses can send proof before BiManage's decision.</Intro>
      {created && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-success-bg px-5 py-3 text-body-sm text-success">
          <IconCircleCheck aria-hidden="true" className="size-5 shrink-0" /> Dispute opened. The payment stays held until BiTechTeam reviews it, usually within 48 hours.
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Review dispute progress" subtitle={`Case status: ${st.label}.`}>
            <RecordRows
              label="Dispute progress"
              rows={[
                { key: "opened", cells: ["Case opened", shortDate(x.createdAt), reasonLabel(x.reason), "Received"] },
                { key: "buyer", cells: ["Buyer evidence", `${count(buyerFiles.length)} ${buyerFiles.length === 1 ? "file" : "files"}`, x.order ? `Order ${x.order.trackingNo}` : "Order details", buyerFiles.length ? "Submitted" : "None yet"] },
                { key: "seller", cells: ["Seller response", sellerReplied ? "Replied" : "Awaiting reply", `${count(sellerFiles.length)} ${sellerFiles.length === 1 ? "file" : "files"}`, sellerReplied ? "Submitted" : "Pending"] },
                { key: "escrow", cells: ["Escrow status", x.escrow ? naira(x.escrow.frozenAmount || x.escrow.totalAmount) : "", x.escrow?.moneyState ?? "", open ? "Protected" : "Settled"] },
                {
                  key: "outcome",
                  cells: [
                    "Outcome",
                    outcome === "refund" ? "Full refund to the buyer" : outcome === "partial" ? `Partial refund${x.escrow?.refundAmount ? ` of ${naira(x.escrow.refundAmount)}` : ""}` : outcome === "release" ? "Paid to the supplier" : "Not decided",
                    "BiTechTeam review",
                    open ? "Review" : "Decided",
                  ],
                },
                {
                  key: "messages",
                  cells: [
                    "Message history",
                    "Kept with the case",
                    "Case evidence",
                    <Link key="m" to={x.conversationId ? `/messages/${x.conversationId}` : "/messages"} className="hover:underline">
                      View
                    </Link>,
                  ],
                },
              ]}
            />
            {x.resolution && <p className="mt-4 break-words rounded-xl bg-surface-pale px-4 py-3 text-body-sm text-ink-strong">{x.resolution}</p>}
          </Panel>
          <Panel title="Case details">
            <div className="flex flex-col gap-3 text-body-sm">
              <p className="break-words text-ink-strong">{x.description}</p>
              <SummaryRows
                rows={[
                  ...(x.order ? ([["Order", `${x.order.trackingNo} • ${x.order.productName}`]] as Array<[string, ReactNode]>) : []),
                  ...(x.dateReceived ? ([["Date received", shortDate(x.dateReceived)]] as Array<[string, ReactNode]>) : []),
                  ...(x.affectedQuantity ? ([["Affected quantity", count(x.affectedQuantity)]] as Array<[string, ReactNode]>) : []),
                  ...(x.amountDisputed ? ([["Amount disputed", naira(x.amountDisputed)]] as Array<[string, ReactNode]>) : []),
                  ...(x.requestedResolution ? ([["Requested resolution", resolutionLabel(x.requestedResolution)]] as Array<[string, ReactNode]>) : []),
                ]}
              />
              {files.length > 0 && (
                <ul aria-label="Evidence files" className="flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <li key={`${f.url}-${i}`} className="min-w-0">
                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-2 rounded-full bg-surface-tint-blue px-3 py-1 text-ink-brand hover:underline">
                        <IconPaperclip aria-hidden="true" className="size-4 shrink-0" />
                        <span className="max-w-48 truncate">{fileName(f.url, f.name)}</span>
                        <span className="text-ink-muted">• {f.by === "client" ? "Buyer" : "Supplier"}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>
          <Replies x={x} />
        </div>
        <FactsPanel
          items={[
            ["Dispute deadline", "Within 7 days of delivery"],
            ["Outcomes", "Full refund • Partial • Supplier paid"],
            ["Evidence", `${count(left)} of ${count(x.evidenceLimit.perParty)} files left for you`],
            ["Current status", st.label],
          ]}
        >
          {x.order && (
            <ButtonLink to={`/bisupplynet/orders/${x.order._id}`} variant="outlined" size="md" fullWidth>
              Open order
            </ButtonLink>
          )}
        </FactsPanel>
      </div>
      <EvidenceDialog open={evidenceOpen} onClose={() => setEvidenceOpen(false)} disputeId={x._id} left={left} />
    </div>
  );
}

function EvidenceDialog({ open, onClose, disputeId, left }: { open: boolean; onClose: () => void; disputeId: string; left: number }) {
  const add = useAddEvidence(disputeId);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const close = () => {
    setFiles([]);
    setError(null);
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      icon={<IconPaperclip className="size-7" />}
      title="Add dispute evidence"
      description={`Photos or PDFs that show what happened. You can add ${count(left)} more ${left === 1 ? "file" : "files"}.`}
      actions={
        <>
          <Button variant="outlined" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={!files.length || busy}
            loading={add.isPending}
            loadingText="Adding…"
            onClick={() => {
              setError(null);
              add.mutateAsync(files).then(close, (err) => setError(err));
            }}
          >
            Add {files.length ? count(files.length) : ""} {files.length === 1 ? "file" : "files"}
          </Button>
        </>
      }
    >
      <AttachmentPicker label="Evidence" value={files} onChange={setFiles} onBusy={setBusy} max={left} />
      <ErrorNote error={error} fallback="We couldn't add the files. Please try again." />
    </Dialog>
  );
}

function Replies({ x }: { x: DisputeDetail }) {
  const reply = useReplyDispute(x._id);
  const open = disputeOpen(x.status);
  const left = Math.max(0, x.evidenceLimit.perParty - x.evidenceLimit.used);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const mine = x.role === "seller" ? "vendor" : "client";
  const who = (by: string) => (by === mine ? "You" : by === "admin" ? "BiTechTeam" : by === "vendor" ? "Supplier" : "Buyer");

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setProblem(null);
    setError(null);
    if (!message.trim()) return setProblem("Write a reply.");
    try {
      await reply.mutateAsync({ message: message.trim(), ...(files.length ? { evidence: files } : {}) });
      setMessage("");
      setFiles([]);
    } catch (err) {
      setError(err);
    }
  };

  return (
    <Panel title="Responses" subtitle={open ? "Both sides can reply until BiTechTeam decides." : "This dispute is closed to new replies."}>
      {(x.responses ?? []).length === 0 ? (
        <p className="text-body-sm text-ink-muted">No replies yet.</p>
      ) : (
        <ol aria-label="Dispute replies" className="flex flex-col gap-3">
          {(x.responses ?? []).map((r, i) => (
            <li key={r._id ?? i} className="min-w-0 rounded-xl bg-surface-pale px-4 py-3">
              <p className="text-caption font-semibold uppercase text-ink-brand">
                {who(r.by)}
                {r.createdAt ? ` • ${dateTime(r.createdAt)}` : ""}
              </p>
              <p className="mt-1 break-words text-body-sm text-ink-strong">{r.message}</p>
              {r.evidence?.length ? <p className="mt-1 text-caption text-ink-muted">{count(r.evidence.length)} {r.evidence.length === 1 ? "file" : "files"} attached</p> : null}
            </li>
          ))}
        </ol>
      )}
      {open && (
        <form onSubmit={(e) => void send(e)} className="mt-5 flex flex-col gap-3 border-t border-line-subtle pt-4">
          <Field label="Your reply" error={problem ?? undefined}>
            <TextArea rows={3} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Explain your side, or answer the other business." />
          </Field>
          {left > 0 && <AttachmentPicker label="Evidence with your reply" value={files} onChange={setFiles} onBusy={setBusy} max={left} />}
          <ErrorNote error={error} fallback="We couldn't send your reply. Please try again." />
          <Button type="submit" size="md" className="md:self-end" loading={reply.isPending} loadingText="Sending…" disabled={busy}>
            Send reply
          </Button>
        </form>
      )}
    </Panel>
  );
}

