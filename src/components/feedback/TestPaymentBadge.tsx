import { Status } from "@/components/ui";
import { cn } from "@/lib/cn";

// Test-mode guard (security fix P0-3). While production may run a Paystack
// test key, an order "paid" in test mode moved no real money: it must never be
// shipped. Shown on store orders, BiSupplyNet orders and in the admin area.

/** Paid, but not with a live Paystack payment (unknown mode counts as test). */
export const isTestPayment = (o: { isPaid?: boolean | null; paymentMode?: string | null }) => Boolean(o.isPaid) && o.paymentMode !== "live";

export const TEST_PAYMENT_LABEL = "Test payment — don't ship";

export function TestPaymentBadge({ className }: { className?: string }) {
  return (
    <Status tone="warning" className={className}>
      {TEST_PAYMENT_LABEL}
    </Status>
  );
}

/** Plans and packages refuse test payments in production (reason "test_payment"). */
export const TEST_PAYMENT_REFUSED = "This was a Paystack test payment, so no real money was paid and nothing was activated. Please pay again with a real card or bank account.";
export const paymentFailureText = (reason: string | null | undefined) => (reason === "test_payment" ? TEST_PAYMENT_REFUSED : reason ?? null);

/** A full-width warning for an order's detail page. */
export function TestPaymentNotice({ className }: { className?: string }) {
  return (
    <p role="note" className={cn("rounded-xl bg-warning-bg px-5 py-3 text-body-sm text-ink-strong", className)}>
      <strong className="text-warning">{TEST_PAYMENT_LABEL}.</strong> This order was paid with a Paystack test payment, so no real money was paid. Don&apos;t send the goods.
    </p>
  );
}
