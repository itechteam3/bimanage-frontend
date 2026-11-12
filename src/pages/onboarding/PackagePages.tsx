import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { IconCheck, IconArrowRight, IconAlertTriangle } from "@tabler/icons-react";
import { Button, ButtonLink, Spinner, buttonClasses } from "@/components/ui";
import { DetailRows, InfoStrip, IntroCard, PageTitle, Panel, PriceBox, Stepper, TipList } from "@/components/page/Blocks";
import { AuthNote } from "@/components/layout/AuthLayout";
import { startCheckout, useStartupPackages, verifyPayment, keys, type PaymentState, type StartupPackage } from "@/lib/workspace/api";
import { naira } from "@/lib/format";
import { friendlyText, errorMessage } from "@/lib/api/errorMessage";
import { SUPPORT_EMAIL } from "@/config/links";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";

// Startup packages: 07.12 list → 07.13/07.02 review & pay → Paystack →
// 07.03 processing / 07.04 success / 07.05 unsuccessful.

const DETAILS: Record<StartupPackage["id"], { eyebrow: string; features: string[]; tone: string }> = {
  starter: {
    eyebrow: "The essentials",
    tone: "bg-surface-pale",
    features: ["Core business features", "Inventory and orders", "Task and project tracking", "Business dashboard access", "30 days of package access"],
  },
  standard: {
    eyebrow: "Full feature set",
    tone: "bg-kpi-revenue-bg",
    features: ["Full feature set for 30 days", "Inventory, sales and projects", "Invoicing and analytics", "Online store and BiSupplyNet", "30 days of package access"],
  },
  premium: {
    eyebrow: "Full FELI & store",
    tone: "bg-surface-pale",
    features: ["Everything in Standard", "Premium store template", "Full FELI actions", "Access across business modules", "30 days of package access"],
  },
};

const LAST_REF = "bimanage.lastPaymentRef";
const rememberRef = (ref: string) => {
  try {
    window.sessionStorage.setItem(LAST_REF, ref);
  } catch {
    /* ignore */
  }
};
const recallRef = () => {
  try {
    return window.sessionStorage.getItem(LAST_REF);
  } catch {
    return null;
  }
};

const Loading = () => (
  <div className="flex justify-center py-16 text-ink-brand" role="status">
    <Spinner className="size-8" />
    <span className="sr-only">Loading…</span>
  </div>
);

// 07.12 Startup packages
export function PackagesPage() {
  const packages = useStartupPackages();
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Startup packages</PageTitle>
      <IntroCard eyebrow="Startup packages • One-time payment" title="Give your new business a head start">
        Pick a 30-day startup package to prepare your first products, orders and online store.
      </IntroCard>
      {packages.isLoading && <Loading />}
      {packages.error && <AuthNote tone="danger">{errorMessage(packages.error)}</AuthNote>}
      <div className="grid gap-4 lg:grid-cols-3">
        {packages.data?.map((p) => {
          const d = DETAILS[p.id];
          return (
            <section key={p.id} className="flex flex-col rounded-2xl border border-line-card bg-surface-card p-5 shadow-card">
              <p className={cn("rounded-sm px-2 py-1.5 text-caption font-semibold uppercase text-ink-brand", d.tone)}>{d.eyebrow}</p>
              <h2 className="mt-3 text-title-sm text-ink-strong">{p.name}</h2>
              <p className="mt-4 text-title-md text-ink-brand">{naira(p.amount)}</p>
              <p className="mt-1 text-body-sm text-ink-muted">{p.tagline}</p>
              <p className="mt-5 border-b border-line-card pb-2 text-caption font-medium uppercase text-ink-muted">Included with this package</p>
              <ul className="mt-4 flex flex-1 flex-col gap-4">
                {d.features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-body-sm text-ink-strong">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success-bg text-success">
                      <IconCheck aria-hidden="true" className="size-3.5" stroke={3} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <ButtonLink to={`/onboarding/packages/${p.id}`} fullWidth className="mt-6">
                Review {p.name} package
              </ButtonLink>
            </section>
          );
        })}
      </div>
      <Panel tone="pale" title="Getting started, step by step">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Choose a package", "Review the features and one-time price before proceeding to checkout."],
            ["Set up your business", "Follow the seven-step onboarding tracker: profile, logo, products, orders and online store."],
            ["What happens next", "The startup package provides 30-day access. A subscription is needed to continue afterward."],
          ].map(([t, b], i) => (
            <div key={t} className="rounded-xl bg-surface-card p-4">
              <p className="text-caption font-semibold uppercase text-ink-brand">
                {String(i + 1).padStart(2, "0")}&nbsp;&nbsp;{t}
              </p>
              <p className="mt-3 text-body-sm text-ink-muted">{b}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// 07.13 Review + 07.02 Secure payment, as one step before Paystack.
export function CheckoutPage() {
  const { packageId } = useParams();
  const packages = useStartupPackages();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pkg = packages.data?.find((p) => p.id === packageId);

  if (packages.isLoading) return <Loading />;
  if (!pkg) {
    return (
      <div className="flex flex-col gap-6">
        <PageTitle>Package not found</PageTitle>
        <ButtonLink to="/onboarding/packages" className="self-start">
          Compare startup packages
        </ButtonLink>
      </div>
    );
  }

  const pay = async () => {
    setPaying(true);
    setError(null);
    try {
      const res = await startCheckout(pkg.id);
      rememberRef(res.reference);
      window.location.assign(res.authorizationUrl); // Paystack returns to /onboarding/payment
    } catch (err) {
      setError(errorMessage(err, "We couldn't start the payment. Please try again."));
      setPaying(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Review your startup package</PageTitle>
      <IntroCard eyebrow="Checkout / Step 2 of 4" title="Double-check the details before paying.">
        {pkg.name} package · Everything important, in one place.
      </IntroCard>
      <Stepper steps={["Choose package", "Review details", "Secure payment", "Activate access"]} current={1} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel title="Your package, at a glance" subtitle="One-time startup package · Selected for this checkout">
          <div className="flex flex-col gap-5">
            <PriceBox label="One-time package price" value={naira(pkg.amount)} />
            <DetailRows
              rows={[
                ["Package", `${pkg.name} — ${pkg.summary.toLowerCase()}`],
                ["Duration", `${pkg.days} days of access`],
                ["Payment", "Single package payment via Paystack"],
                ["After access", "Select a subscription to continue"],
              ]}
            />
            {error && <AuthNote tone="danger">{error}</AuthNote>}
            <Button fullWidth onClick={pay} loading={paying} loadingText="Opening Paystack…">
              Pay {naira(pkg.amount)} with Paystack
            </Button>
            <p className="text-body-sm text-ink-muted">You'll be taken to Paystack's secure checkout (card, bank transfer or USSD), then brought back here.</p>
          </div>
        </Panel>
        <TipList
          title="Before you continue"
          tips={[
            { title: "Know what you are buying", body: `${pkg.name} includes ${pkg.summary.toLowerCase()} for ${pkg.days} days.` },
            { title: "Keep your payment reference", body: "You can use it when checking a payment issue." },
            { title: "Return for verification", body: "Access begins only after confirmed payment." },
          ]}
        />
      </div>
      <InfoStrip
        title="Need to compare first?"
        action={
          <Link to="/onboarding/packages" className={buttonClasses({ variant: "secondary", size: "md" })}>
            Compare startup packages
          </Link>
        }
      >
        You can review the other startup packages before confirming this purchase.
      </InfoStrip>
    </div>
  );
}

// 07.03 processing · 07.04 success · 07.05 unsuccessful
export function PaymentStatusPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const reference = params.get("reference") ?? params.get("trxref") ?? recallRef();
  const [state, setState] = useState<PaymentState | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempts = useRef(0);

  const check = async () => {
    if (!reference) return;
    setChecking(true);
    setError(null);
    try {
      const res = await verifyPayment(reference);
      setState(res);
      if (res.status === "success") {
        void qc.invalidateQueries({ queryKey: keys.onboarding });
        void qc.invalidateQueries({ queryKey: keys.steps });
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setChecking(false);
    }
  };

  // Verify on arrival, then re-check a few times while Paystack is still processing.
  useEffect(() => {
    void check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);
  useEffect(() => {
    if (state?.status !== "pending" || attempts.current >= 4) return;
    const t = setTimeout(() => {
      attempts.current += 1;
      void check();
    }, 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!reference) {
    return (
      <div className="flex flex-col gap-6">
        <PageTitle>No payment to check</PageTitle>
        <p className="text-body-lg text-ink-secondary">We couldn't find a payment reference. Start from the startup packages.</p>
        <ButtonLink to="/onboarding/packages" className="self-start">
          Startup packages
        </ButtonLink>
      </div>
    );
  }

  const pkg = state?.package;
  const status = state?.status ?? "pending";

  if (status === "success") {
    return (
      <div className="flex flex-col gap-6">
        <PageTitle>Package activated</PageTitle>
        <IntroCard eyebrow="Payment / Confirmed" title="You're all set. Welcome aboard.">
          Your {pkg?.name} package is active — here's how to make the most of it.
        </IntroCard>
        <Stepper steps={["Selected", "Paid", "Verified", "Start building"]} current={3} />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <Panel title="Your access is ready" subtitle={`${pkg?.name} · One-time startup package`}>
            <div className="flex flex-col gap-5">
              <PriceBox label="Package access" value={`${pkg?.days ?? 30} days`} />
              <DetailRows
                rows={[
                  ["Payment status", <span className="font-semibold text-success">Confirmed</span>],
                  ["Package", `${pkg?.name} · ${pkg?.summary}`],
                  ["Reference", <span className="break-all">{state?.reference}</span>],
                  ["Next step", "Complete the business setup tracker"],
                ]}
              />
              <Button fullWidth onClick={() => navigate("/onboarding/business")}>
                Start setting up your business <IconArrowRight aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </Panel>
          <TipList
            title="Make your first moves"
            tips={[
              { title: "Complete your profile", body: "Add your business details and logo." },
              { title: "Start selling", body: "Add your first product and create an order." },
              { title: "Open your store", body: "Finish the online store setup step." },
            ]}
          />
        </div>
      </div>
    );
  }

  if (status === "failed" || status === "abandoned") {
    return (
      <div className="flex flex-col gap-6">
        <PageTitle>Payment was unsuccessful</PageTitle>
        <IntroCard eyebrow="Payment / Needs attention" title="Let's get your payment sorted.">
          Your payment hasn't been confirmed, so no package has been activated.
        </IntroCard>
        <Stepper steps={["Selected", "Checkout", "Not confirmed", "Resolve"]} current={2} />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <Panel title="Payment needs attention" subtitle="Your package choice is saved.">
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3 rounded-xl bg-danger-bg px-4 py-4 text-danger">
                <IconAlertTriangle aria-hidden="true" className="size-6 shrink-0" />
                <p className="text-body-lg font-semibold">{status === "abandoned" ? "Checkout was not completed" : "Not confirmed"}</p>
              </div>
              <DetailRows
                rows={[
                  ["Selected package", `${pkg?.name} · ${pkg?.days ?? 30}-day access`],
                  ["Expected amount", naira(state?.amount)],
                  ["Access", "Not yet activated"],
                  ["Reference", <span className="break-all">{state?.reference}</span>],
                ]}
              />
              <ButtonLink to={`/onboarding/packages/${pkg?.id ?? ""}`} fullWidth>
                Try the payment again
              </ButtonLink>
            </div>
          </Panel>
          <TipList
            title="Here's the safest next step"
            tips={[
              { title: "Check your account", body: "See whether your bank or card was debited." },
              { title: "Verify before retrying", body: "Avoid a duplicate charge while the status is unclear." },
              { title: "Reach our support team", body: "Share the payment reference above." },
            ]}
          />
        </div>
        <InfoStrip
          title="Were you debited?"
          action={
            <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Payment ${state?.reference ?? ""}`)}`} className={buttonClasses({ variant: "secondary", size: "md" })}>
              Contact support
            </a>
          }
        >
          A failed or interrupted checkout doesn't always mean no charge was made. If money left your account, contact support with the reference.
        </InfoStrip>
      </div>
    );
  }

  // pending / still checking
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Confirming your payment</PageTitle>
      <IntroCard eyebrow="Payment / Verification" title="Your payment is being checked.">
        You can leave this screen and come back — we'll keep the result.
      </IntroCard>
      <Stepper steps={["Select", "Checkout", "Verify", "Access"]} current={2} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel title="Payment verification" subtitle="We are waiting for a confirmed transaction result.">
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3 rounded-xl bg-surface-pale px-4 py-4 text-ink-brand" role="status">
              <Spinner className="size-6" />
              <p className="text-body-lg font-semibold">Processing</p>
            </div>
            <DetailRows
              rows={[
                ["Package", pkg ? `${pkg.name} · ${pkg.days}-day access` : "—"],
                ["Amount", state ? naira(state.amount) : "—"],
                ["Provider", "Paystack"],
                ["Activation", "After successful verification"],
              ]}
            />
            {(error || state?.message) && <AuthNote tone="danger">{error ?? friendlyText(state?.message, "We couldn't confirm this payment yet. Check again in a moment.")}</AuthNote>}
            <Button fullWidth onClick={check} loading={checking} loadingText="Checking…">
              Check payment status <IconArrowRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </Panel>
        <TipList
          title="Stay in control"
          tips={[
            { title: "Avoid paying twice", body: "Check the existing transaction before retrying." },
            { title: "Keep the reference handy", body: <span className="break-all">{reference}</span> },
            { title: "Need a hand?", body: "If confirmation is delayed, contact support." },
          ]}
        />
      </div>
      <InfoStrip title="Payment still pending?">A payment in progress is not the same as a failed payment. Don't repeat it until its status has been verified.</InfoStrip>
    </div>
  );
}
