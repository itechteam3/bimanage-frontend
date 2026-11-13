import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router-dom";
import { IconAlertTriangle, IconArrowRight, IconBolt, IconCheck, IconClock, IconDownload, IconLock } from "@tabler/icons-react";
import { Button, ButtonLink, Dialog, EmptyState, Spinner, Status } from "@/components/ui";
import { DetailRows, InfoStrip, IntroCard, PageTitle, Panel, PriceBox, Stepper, TipList } from "@/components/page/Blocks";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { saveBlob } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useSubscription, type CurrentSubscription } from "@/lib/workspace/subscription";
import { useUrlState } from "@/lib/nav/useUrlState";
import { browser } from "@/lib/store/api";
import { SUPPORT_EMAIL } from "@/config/links";
import { count, naira, shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { PlanId } from "@/config/plans";
import {
  FEATURE_LABELS,
  cycleName,
  downloadSubscriptionReceipt,
  lastSubscriptionRef,
  perCycle,
  planName,
  startSubscriptionCheckout,
  useBillingHistory,
  useCancelPlan,
  useChangePlan,
  useKeepCurrentPlan,
  usePlans,
  useQuote,
  useResumePlan,
  useUsage,
  verifySubscriptionPayment,
  type BillingCycle,
  type BillingRow,
  type PlanInfo,
  type Quote,
} from "@/lib/subscription/api";

// Subscriptions & usage (Figma 07.01–07.11). Prices are provisional and set
// on the server (Render): every amount on these screens comes from the API.

const EYEBROW = "Subscription / Your account";
const DAY = 86_400_000;
const PROVISIONAL = "Prices are provisional while BiTechTeam finalises them. You always see the exact amount before you pay.";

const Loading = ({ label = "Loading your plan…" }: { label?: string }) => (
  <div className="flex justify-center py-16 text-ink-brand" role="status">
    <Spinner className="size-8" />
    <span className="sr-only">{label}</span>
  </div>
);

// 07.xx mobile tabs: Plans · Packages · Billing · More
function SubscriptionTabs() {
  const tabs: Array<[string, string, boolean?]> = [
    ["/subscription", "Plan & usage", true],
    ["/subscription/plans", "Plans"],
    ["/onboarding/packages", "Packages"],
    ["/subscription/billing", "Billing"],
  ];
  return (
    <nav aria-label="Subscription" className="-mx-5 overflow-x-auto px-5 lg:mx-0 lg:px-0">
      <ul className="flex w-max gap-1 rounded-md bg-surface-pale p-1">
        {tabs.map(([to, label, end]) => (
          <li key={to}>
            <NavLink to={to} end={end} className={({ isActive }) => cn("flex min-h-11 items-center rounded-sm px-4 text-action font-semibold", isActive ? "bg-surface-card text-ink-brand shadow-card" : "text-ink-muted hover:text-ink-brand")}>
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Billing is the owner's; team members see who to ask. */
function OwnerOnly({ children }: { children: ReactNode }) {
  const { workspace } = useAuth();
  if (workspace && workspace.role !== "owner")
    return <EmptyState className="max-w-xl" icon={<IconLock className="size-7" />} title="Only the business owner manages the subscription" body="Ask the owner to change the plan or see billing. Your access follows the business's plan." />;
  return <>{children}</>;
}

const daysLeft = (iso?: string | null, now = Date.now()) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - now) / DAY)) : 0);
const isPaid = (s?: CurrentSubscription | null) => Boolean(s && s.plan !== "freemium" && s.price && s.price > 0);
const trialState = (s?: CurrentSubscription | null): "ending" | "active" | "expired" | null => {
  if (!s) return null;
  if (s.isTrialActive && s.trialEndDate && new Date(s.trialEndDate).getTime() > Date.now()) return daysLeft(s.trialEndDate) <= 3 ? "ending" : "active";
  if (s.isTrialUsed && !isPaid(s) && s.access?.source === "plan" && s.plan === "freemium") return "expired";
  return null;
};

/** One-line plan + price, e.g. "Standard · ₦15,000/month". Price from the server. */
function planLine(s: CurrentSubscription) {
  if (s.access?.source === "trial") return "Free trial · all Premium features";
  if (s.access?.source === "startup_package") return `${s.startupPackage === "starter" ? "Starter" : planName(s.startupPackage)} startup package`;
  if (!isPaid(s)) return "Freemium · Free";
  return `${planName(s.plan)} · ${naira(s.price)}${perCycle(s.billingCycle)}`;
}

// ── Status notices shown on the overview (07.08 / 07.09 / past due / cancel / pending) ──
function PlanNotices({ s }: { s: CurrentSubscription }) {
  const resume = useResumePlan();
  const keep = useKeepCurrentPlan();
  const trial = trialState(s);
  const notes: ReactNode[] = [];
  if (trial === "ending")
    notes.push(
      <InfoStrip key="trial" tone="warm" title={`Your free trial ends in ${daysLeft(s.trialEndDate)} day${daysLeft(s.trialEndDate) === 1 ? "" : "s"}`} action={<ButtonLink to="/subscription/trial" size="md" variant="outlined">Review options</ButtonLink>}>
        After {shortDate(s.trialEndDate)} you move to Freemium unless you choose a plan.
      </InfoStrip>
    );
  if (trial === "expired")
    notes.push(
      <InfoStrip key="expired" tone="warm" title="Your free trial has ended" action={<ButtonLink to="/subscription/trial" size="md" variant="outlined">See what changed</ButtonLink>}>
        You're on Freemium with 100 daily credits. Your data is safe.
      </InfoStrip>
    );
  if (s.pastDueSince)
    notes.push(
      <InfoStrip key="pastdue" tone="warm" title="Your renewal payment didn't go through" action={<ButtonLink to={`/subscription/change?plan=${s.plan}&cycle=${s.billingCycle ?? "monthly"}`} size="md" variant="outlined">Pay again</ButtonLink>}>
        Your plan keeps working until {shortDate(s.graceEndsAt)}. After that you move to Freemium.
      </InfoStrip>
    );
  if (s.cancelAtPeriodEnd && isPaid(s))
    notes.push(
      <InfoStrip key="cancel" title={`${planName(s.plan)} ends on ${shortDate(s.currentPeriodEnd)}`} action={<Button size="md" variant="outlined" loading={resume.isPending} onClick={() => resume.mutate()}>Keep my plan</Button>}>
        You cancelled, so nothing more will be charged. You can keep the plan until then.
      </InfoStrip>
    );
  if (s.pendingChange)
    notes.push(
      <InfoStrip key="pending" title={`Moving to ${planName(s.pendingChange.plan)} (${cycleName(s.pendingChange.billingCycle)}) on ${shortDate(s.pendingChange.effectiveAt)}`} action={<Button size="md" variant="outlined" loading={keep.isPending} onClick={() => keep.mutate()}>Keep {planName(s.plan)}</Button>}>
        Your saved card is charged for the new plan on that date.
      </InfoStrip>
    );
  const err = resume.error ?? keep.error;
  if (!notes.length && !err) return null;
  return (
    <div className="flex flex-col gap-3">
      {notes}
      {err ? <ErrorNote error={err} /> : null}
    </div>
  );
}

function CreditMeter({ used, daily }: { used: number; daily: number }) {
  const pct = daily ? Math.min(100, Math.round((used / daily) * 100)) : 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-body-sm">
        <span className="text-ink-muted">Used today</span>
        <span className="font-semibold text-ink-strong">
          {count(used)} of {count(daily)} credits
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-tonal" role="progressbar" aria-label="Daily credits used" aria-valuemin={0} aria-valuemax={daily} aria-valuenow={used}>
        <div className={cn("h-full rounded-full", pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-brand-navy")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── 07.06 Plan and usage ─────────────────────────────────────────────────
export function SubscriptionOverviewPage() {
  return (
    <OwnerOnly>
      <Overview />
    </OwnerOnly>
  );
}

function Overview() {
  const sub = useSubscription();
  const usage = useUsage();
  const plans = usePlans();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const cancel = useCancelPlan();
  if (sub.isLoading) return <Loading />;
  if (sub.error || !sub.data) return <ErrorNote error={sub.error} fallback="We couldn't load your plan. Please try again." onRetry={() => void sub.refetch()} />;
  const s = sub.data;
  const unlimited = s.credits?.unlimited ?? s.access?.unlimitedCredits ?? false;
  const u = usage.data;
  const current = plans.data?.find((p) => p.id === (s.access?.tier as PlanId)) ?? plans.data?.find((p) => p.id === s.plan);
  const benefits = current ? FEATURE_LABELS.filter(([f]) => current.features[f] === true).map(([, l]) => l) : [];
  const rank: Record<string, number> = { freemium: 0, standard: 1, premium: 2 };
  const myRank = isPaid(s) ? rank[s.plan] ?? 0 : 0;
  const upgrades = (plans.data ?? []).filter((p) => (rank[p.id] ?? 0) > myRank);

  return (
    <div className="flex flex-col gap-6">
      <PageTitle actions={<ButtonLink to="/subscription/plans" size="md">Compare plans</ButtonLink>}>Your subscription</PageTitle>
      <SubscriptionTabs />
      <IntroCard eyebrow={EYEBROW} title="Know your plan. Make every credit count.">
        All the essentials for tracking access, daily usage and next steps.
      </IntroCard>
      <PlanNotices s={s} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel title="Your subscription overview" subtitle={unlimited ? "Unlimited use of everything in your plan." : "Core tools with a transparent daily allowance."}>
          <div className="flex flex-col gap-5">
            <PriceBox label="Current plan" value={planLine(s)} />
            <DetailRows
              rows={[
                ...(isPaid(s)
                  ? ([
                      ["Billing", `${naira(s.price)} ${cycleName(s.billingCycle)}`],
                      [s.cancelAtPeriodEnd ? "Ends on" : "Renews on", shortDate(s.currentPeriodEnd)],
                      ...(s.paymentMode === "test" ? ([["Payments", <Status tone="warning">Test mode</Status>]] as Array<[string, ReactNode]>) : []),
                    ] as Array<[string, ReactNode]>)
                  : []),
                ...(s.access?.source === "trial" ? ([["Trial ends", shortDate(s.trialEndDate)]] as Array<[string, ReactNode]>) : []),
                ...(s.access?.source === "startup_package" ? ([["Package ends", shortDate(s.startupPackageEndDate)]] as Array<[string, ReactNode]>) : []),
                ["Daily allowance", unlimited ? "Unlimited" : `${count(s.credits?.daily ?? 100)} credits`],
                ...((!unlimited ? (u?.prices ?? []).slice(0, 3).map((p) => [p.label, `${p.cost} credits${p.perDay ? " (once a day)" : ""}`]) : []) as Array<[string, ReactNode]>),
              ]}
            />
            <div className="flex flex-col gap-3 md:flex-row">
              <ButtonLink to="/subscription/plans" fullWidth>
                Compare subscription plans <IconArrowRight aria-hidden="true" className="size-4" />
              </ButtonLink>
              {isPaid(s) && !s.cancelAtPeriodEnd && (
                <Button variant="outlined" fullWidth onClick={() => setConfirmCancel(true)}>
                  Cancel plan
                </Button>
              )}
            </div>
            {cancel.error ? <ErrorNote error={cancel.error} /> : null}
          </div>
        </Panel>
        <Panel tone="pale" title="Daily usage" subtitle={unlimited ? "Your plan doesn't use credits." : `Resets at midnight (Lagos time), ${shortDate(u?.credits.resetsAt ?? s.credits?.resetsAt)}.`}>
          {unlimited ? (
            <p className="text-body-sm text-ink-secondary">Add products, create orders and view analytics as often as you need.</p>
          ) : usage.isLoading ? (
            <Loading label="Loading usage…" />
          ) : u ? (
            <div className="flex flex-col gap-4">
              <CreditMeter used={u.credits.used} daily={u.credits.daily} />
              <p className="text-body-sm text-ink-secondary">
                <span className="font-semibold text-ink-strong">{count(u.credits.remaining)}</span> credits left today.
              </p>
              {u.byAction.length ? (
                <ul className="flex flex-col divide-y divide-line-subtle">
                  {u.byAction.map((a) => (
                    <li key={a.action} className="flex justify-between py-2 text-body-sm">
                      <span className="text-ink-strong">
                        {a.label} <span className="text-ink-muted">× {a.times}</span>
                      </span>
                      <span className="font-semibold text-ink-strong">{a.credits} credits</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body-sm text-ink-muted">Nothing used yet today.</p>
              )}
              <ButtonLink to="/subscription/credits" variant="outlined" size="md">
                See what credits pay for
              </ButtonLink>
            </div>
          ) : (
            <ErrorNote error={usage.error} fallback="We couldn't load today's usage." onRetry={() => void usage.refetch()} />
          )}
        </Panel>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Benefits" subtitle="What your access includes right now.">
          {benefits.length ? (
            <ul className="grid gap-2 md:grid-cols-2">
              {benefits.map((b) => (
                <li key={b} className="flex items-center gap-2 text-body-sm text-ink-strong">
                  <IconCheck aria-hidden="true" className="size-4 shrink-0 text-success" /> {b}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body-sm text-ink-muted">Dashboard, settings and your business profile.</p>
          )}
        </Panel>
        <Panel title={upgrades.length ? "Upgrade options" : "You're on our top plan"} subtitle={upgrades.length ? "Change when it suits you; you see the price and date first." : "Everything BiManage offers is included."}>
          <ul className="flex flex-col gap-3">
            {upgrades.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-pale px-4 py-3">
                <span>
                  <span className="block font-semibold text-ink-strong">{p.name}</span>
                  <span className="text-body-sm text-ink-muted">
                    {naira(p.price.monthly)}/month or {naira(p.price.yearly)}/year
                  </span>
                </span>
                <ButtonLink to={`/subscription/change?plan=${p.id}&cycle=${s.billingCycle ?? "monthly"}`} size="md" variant="outlined">
                  Review
                </ButtonLink>
              </li>
            ))}
            <li className="text-body-sm text-ink-muted">Payments, renewals and receipts are under Billing.</li>
          </ul>
        </Panel>
      </div>
      <Dialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        tone="danger"
        title={`Cancel ${planName(s.plan)}?`}
        description={`You keep ${planName(s.plan)} until ${shortDate(s.currentPeriodEnd)}, then move to Freemium. Nothing more will be charged, and you can change your mind until then.`}
        actions={
          <>
            <Button variant="outlined" onClick={() => setConfirmCancel(false)}>
              Keep my plan
            </Button>
            <Button
              variant="destructive"
              loading={cancel.isPending}
              onClick={() => cancel.mutate(undefined, { onSettled: () => setConfirmCancel(false) })}
            >
              Cancel plan
            </Button>
          </>
        }
      />
    </div>
  );
}

// ── 07.01 Plan comparison ────────────────────────────────────────────────
export function PlansPage() {
  return (
    <OwnerOnly>
      <Plans />
    </OwnerOnly>
  );
}

function Plans() {
  const plans = usePlans();
  const sub = useSubscription();
  const [cycle, setCycle] = useUrlState<BillingCycle>("cycle", "monthly", ["monthly", "yearly"]);
  if (plans.isLoading || sub.isLoading) return <Loading label="Loading plans…" />;
  if (plans.error || !plans.data) return <ErrorNote error={plans.error} fallback="We couldn't load the plans. Please try again." onRetry={() => void plans.refetch()} />;
  const s = sub.data;
  const provisional = plans.data.some((p) => !p.pricesConfirmed);
  const paymentsOn = plans.data.every((p) => p.paymentsAvailable);

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Subscription plans</PageTitle>
      <SubscriptionTabs />
      <IntroCard eyebrow="Plans / Package comparison" title="Pick the plan that fits how you work.">
        Freemium is free with 100 daily credits. Standard and Premium are unlimited.
      </IntroCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Billing period" className="flex gap-1 rounded-md bg-surface-pale p-1">
          {(["monthly", "yearly"] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={cycle === c}
              onClick={() => setCycle(c)}
              className={cn("min-h-11 rounded-sm px-4 text-action font-semibold", cycle === c ? "bg-surface-card text-ink-brand shadow-card" : "text-ink-muted")}
            >
              {c === "monthly" ? "Monthly" : "Yearly"}
            </button>
          ))}
        </div>
        {provisional && <p className="text-caption text-ink-muted">{PROVISIONAL}</p>}
      </div>
      <ul className="grid gap-4 lg:grid-cols-3">
        {plans.data.map((p) => (
          <PlanCard key={p.id} p={p} cycle={cycle} s={s} />
        ))}
      </ul>
      <div className="grid gap-4 md:grid-cols-3">
        <Panel tone="pale" title="Credits & FELI">
          <p className="text-body-sm text-ink-secondary">Freemium gives 100 daily credits and 20 FELI messages. Standard and Premium don't use credits.</p>
        </Panel>
        <Panel tone="pale" title="Store & domain">
          <p className="text-body-sm text-ink-secondary">Publish your store and connect a custom domain on Standard and Premium. Premium adds the premium template.</p>
        </Panel>
        <Panel tone="pale" title="Payment status">
          <p className="text-body-sm text-ink-secondary">{paymentsOn ? "Pay securely with Paystack. Plans renew automatically; cancel any time and keep access to the end of the period." : "Online checkout isn't available yet. You can keep using Freemium or a startup package."}</p>
        </Panel>
      </div>
    </div>
  );
}

function PlanCard({ p, cycle, s }: { p: PlanInfo; cycle: BillingCycle; s?: CurrentSubscription | null }) {
  const price = p.price[cycle];
  const paid = isPaid(s);
  const current = p.id === "freemium" ? !paid : paid && s?.plan === p.id && s?.billingCycle === cycle;
  const benefits = p.id === "freemium" ? [`${count(typeof p.credits === "number" ? p.credits : 100)} credits each day`, "Inventory, orders and analytics with credits", "Store preview"] : FEATURE_LABELS.filter(([f]) => p.features[f] === true).map(([, l]) => l);
  const monthlyEquivalent = cycle === "yearly" && p.price.monthly ? Math.round(12 - p.price.yearly / p.price.monthly) : 0;
  return (
    <li className={cn("flex flex-col gap-4 rounded-2xl border bg-surface-card p-5", current ? "border-brand-navy" : "border-line-card")}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-title-sm font-semibold text-ink-strong">{p.name}</h2>
        {current ? <Status tone="success">Current plan</Status> : p.id === "premium" ? <Status tone="neutral">Advanced</Status> : null}
      </div>
      <p>
        <span className="text-title-lg font-semibold text-ink-brand" data-testid={`price-${p.id}`}>
          {price ? naira(price) : "Free"}
        </span>
        {price ? <span className="text-body-sm text-ink-muted">{perCycle(cycle)}</span> : null}
      </p>
      {monthlyEquivalent > 0 && <p className="-mt-3 text-caption text-success">{monthlyEquivalent} months free when paid yearly</p>}
      <p className="text-body-sm text-ink-secondary">{p.description}</p>
      <ul className="flex flex-1 flex-col gap-2">
        {benefits.map((b) => (
          <li key={b} className="flex items-center gap-2 text-body-sm text-ink-strong">
            <IconCheck aria-hidden="true" className="size-4 shrink-0 text-success" /> {b}
          </li>
        ))}
      </ul>
      {current ? (
        <Button variant="outlined" fullWidth disabled>
          Your current plan
        </Button>
      ) : p.id === "freemium" ? (
        <ButtonLink to="/subscription/change?plan=freemium" variant="outlined" fullWidth>
          Move to Freemium
        </ButtonLink>
      ) : !p.paymentsAvailable ? (
        <Button fullWidth disabled>
          Checkout unavailable
        </Button>
      ) : (
        <ButtonLink to={`/subscription/change?plan=${p.id}&cycle=${cycle}`} fullWidth>
          Choose {p.name}
        </ButtonLink>
      )}
    </li>
  );
}

// ── 07.10 Change plan review → 07.02 secure payment handoff ──────────────
export function ChangePlanPage() {
  return (
    <OwnerOnly>
      <ChangePlan />
    </OwnerOnly>
  );
}

const QUOTE_TITLE: Record<Quote["type"], string> = {
  subscribe: "Review your plan",
  upgrade: "Review your plan change",
  downgrade: "Review your plan change",
  cancel: "Move to Freemium",
  resume: "Keep your plan",
  same: "Nothing to change",
};

/** One plain sentence for the review (amounts and dates from the quote). */
function summary(q: Quote): string {
  const plan = `${planName(q.plan)} (${cycleName(q.billingCycle)})`;
  switch (q.type) {
    case "subscribe":
    case "upgrade":
      return `Pay ${naira(q.amount)} now. ${plan} starts today and renews on ${shortDate(q.nextChargeAt)}.`;
    case "downgrade":
      return `${plan} starts on ${shortDate(q.effectiveAt)}; ${naira(q.nextChargeAmount)} is charged to your saved card then.`;
    case "cancel":
      return `You keep ${planName(q.currentPlan)} until ${shortDate(q.effectiveAt)}, then move to Freemium. Nothing more is charged.`;
    case "resume":
      return `Keep ${plan}. It renews on ${shortDate(q.nextChargeAt)}.`;
    default:
      return q.message;
  }
}

function ChangePlan() {
  const [params] = useSearchParams();
  const plan = (params.get("plan") ?? "standard") as PlanId;
  const cycle = (params.get("cycle") === "yearly" ? "yearly" : "monthly") as BillingCycle;
  const quote = useQuote(plan, cycle);
  const plans = usePlans();
  const change = useChangePlan();
  const navigate = useNavigate();
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<unknown>(null);

  if (quote.isLoading) return <Loading label="Working out the price…" />;
  if (quote.error || !quote.data) return <ErrorNote error={quote.error} fallback="We couldn't price this change. Please try again." onRetry={() => void quote.refetch()} />;
  const q = quote.data;
  const target = plans.data?.find((p) => p.id === plan);
  const from = plans.data?.find((p) => p.id === q.currentPlan);
  const adds = target && from ? FEATURE_LABELS.filter(([f]) => target.features[f] === true && from.features[f] !== true).map(([, l]) => l) : [];
  const loses = target && from ? FEATURE_LABELS.filter(([f]) => from.features[f] === true && target.features[f] !== true).map(([, l]) => l) : [];
  const payNow = q.type === "subscribe" || q.type === "upgrade";

  const pay = async () => {
    setPayError(null);
    setPaying(true);
    try {
      const res = await startSubscriptionCheckout(plan, cycle);
      lastSubscriptionRef.set(res.reference);
      browser.go(res.authorizationUrl);
    } catch (err) {
      setPaying(false);
      setPayError(err);
    }
  };
  const confirmLater = () => change.mutate({ plan, billingCycle: cycle }, { onSuccess: () => navigate("/subscription") });

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>{QUOTE_TITLE[q.type]}</PageTitle>
      <IntroCard eyebrow="Subscription / Plan options" title={payNow ? "A better fit for how you work." : q.type === "cancel" ? "You keep your plan until it ends." : "Here's exactly what happens."}>
        You'll see the final price and the date before anything changes.
      </IntroCard>
      <Stepper steps={["Current plan", "Compare", "Review price", "Confirm change"]} current={2} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel title="Review the differences" subtitle={summary(q)}>
          <div className="flex flex-col gap-5">
            <PriceBox label="Requested plan" value={plan === "freemium" ? "Freemium" : `${planName(plan)} · ${cycleName(cycle)}`} />
            <DetailRows
              rows={[
                ["Current plan", q.currentPlan === "freemium" ? "Freemium · Free" : `${planName(q.currentPlan)} · ${cycleName(q.currentBillingCycle)}`],
                ...(payNow ? ([["Pay now", <span className="font-semibold">{naira(q.amount)}</span>], ["Starts", "Today"], ["Renews", `${shortDate(q.nextChargeAt)} at ${naira(q.nextChargeAmount)}`]] as Array<[string, ReactNode]>) : []),
                ...(q.type === "downgrade" ? ([["Starts", shortDate(q.effectiveAt)], ["Charged then", naira(q.nextChargeAmount)], ["Pay now", naira(0)]] as Array<[string, ReactNode]>) : []),
                ...(q.type === "cancel" ? ([["Plan ends", shortDate(q.effectiveAt)], ["Then", "Freemium · 100 daily credits"]] as Array<[string, ReactNode]>) : []),
                ...(q.type === "resume" ? ([["Renews", `${shortDate(q.nextChargeAt)} at ${naira(q.nextChargeAmount)}`]] as Array<[string, ReactNode]>) : []),
                ...(adds.length ? ([[`${planName(plan)} adds`, adds.join(", ")]] as Array<[string, ReactNode]>) : []),
                ...(loses.length ? ([["You'll lose", loses.join(", ")]] as Array<[string, ReactNode]>) : []),
              ]}
            />
            {q.notes?.length ? (
              <ul className="flex flex-col gap-1 rounded-xl bg-surface-pale px-4 py-3 text-body-sm text-ink-secondary">
                {q.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            ) : null}
            {!q.pricesConfirmed && q.type !== "cancel" && q.type !== "same" && <p className="text-caption text-ink-muted">{PROVISIONAL}</p>}
            {payNow &&
              (q.paymentsAvailable ? (
                <Button fullWidth loading={paying} onClick={() => void pay()}>
                  Pay {naira(q.amount)} with Paystack <IconArrowRight aria-hidden="true" className="size-4" />
                </Button>
              ) : (
                <Button fullWidth disabled>
                  Checkout unavailable
                </Button>
              ))}
            {q.type === "downgrade" && (
              <Button fullWidth loading={change.isPending} onClick={confirmLater}>
                Switch on {shortDate(q.effectiveAt)}
              </Button>
            )}
            {q.type === "cancel" && (
              <Button variant="destructive" fullWidth loading={change.isPending} onClick={confirmLater}>
                Cancel {planName(q.currentPlan)}
              </Button>
            )}
            {q.type === "resume" && (
              <Button fullWidth loading={change.isPending} onClick={confirmLater}>
                Keep {planName(plan)}
              </Button>
            )}
            {q.type === "same" && (
              <ButtonLink to="/subscription/plans" variant="outlined" fullWidth>
                View plan comparison
              </ButtonLink>
            )}
            <ErrorNote error={payError ?? change.error} />
          </div>
        </Panel>
        <TipList
          title={payNow ? "What happens next" : "Good to know"}
          tips={
            payNow
              ? [
                  { title: "Pay with Paystack", body: "You'll leave BiManage for Paystack's secure page." },
                  { title: "We confirm the payment", body: "Your plan switches as soon as Paystack confirms it." },
                  { title: "Cancel any time", body: "You keep access to the end of the period you paid for." },
                ]
              : [
                  { title: "No surprise charges", body: "Nothing is charged today." },
                  { title: "Change your mind", body: "You can keep your current plan until the change date." },
                  { title: "Your data stays", body: "Nothing you've created is deleted when a plan changes." },
                ]
          }
        />
      </div>
      <InfoStrip title="No automatic changes" action={<ButtonLink to="/subscription" variant="outlined" size="md">Keep {planName(q.currentPlan)}</ButtonLink>}>
        Nothing changes until you confirm on this page.
      </InfoStrip>
    </div>
  );
}

// ── 07.03 / 07.04 / 07.05 Payment result ─────────────────────────────────
export function SubscriptionPaymentPage() {
  const [params] = useSearchParams();
  const reference = params.get("reference") ?? params.get("trxref") ?? lastSubscriptionRef.get();
  const [state, setState] = useState<Awaited<ReturnType<typeof verifySubscriptionPayment>> | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [checking, setChecking] = useState(false);
  const attempts = useRef(0);
  const sub = useSubscription();

  const check = async () => {
    if (!reference) return;
    setChecking(true);
    setError(null);
    try {
      const res = await verifySubscriptionPayment(reference);
      setState(res);
      if (res.status === "paid") void sub.refetch();
    } catch (err) {
      setError(err);
    } finally {
      setChecking(false);
    }
  };
  useEffect(() => {
    void check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);
  // Paystack can take a moment: check again by ourselves a few times.
  useEffect(() => {
    if (state?.status !== "pending" || attempts.current >= 4) return;
    const t = setTimeout(() => {
      attempts.current += 1;
      void check();
    }, 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!reference)
    return (
      <div className="flex flex-col gap-6">
        <PageTitle>No payment to check</PageTitle>
        <p className="text-body-lg text-ink-secondary">We couldn't find a payment reference. Choose a plan to start again.</p>
        <ButtonLink to="/subscription/plans" className="self-start">
          Subscription plans
        </ButtonLink>
      </div>
    );
  if (!state && !error) return <Loading label="Checking your payment…" />;

  const p = state?.payment;
  const status = state?.status ?? "pending";
  const rows: Array<[string, ReactNode]> = p
    ? [
        ["Plan", p.description],
        ["Amount", naira(p.amount)],
        ...(p.periodEnd ? ([["Renews", shortDate(p.periodEnd)]] as Array<[string, ReactNode]>) : []),
        ["Reference", <span className="break-all">{p.reference}</span>],
        ...(p.mode === "test" ? ([["Mode", <Status tone="warning">Test payment</Status>]] as Array<[string, ReactNode]>) : []),
      ]
    : [];

  if (status === "paid")
    return (
      <div className="flex flex-col gap-6">
        <PageTitle>Payment successful</PageTitle>
        <IntroCard eyebrow="Payment / Confirmed" title="Your plan is active.">
          Paystack confirmed your payment. Everything in your plan is unlocked now.
        </IntroCard>
        <Stepper steps={["Choose plan", "Review", "Pay with Paystack", "Confirmed"]} current={3} />
        <Panel title="You're all set" subtitle={p?.description}>
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3 rounded-xl bg-success-bg px-4 py-4 text-success">
              <IconCheck aria-hidden="true" className="size-6 shrink-0" />
              <p className="text-body-lg font-semibold">Payment confirmed</p>
            </div>
            <DetailRows rows={rows} />
            <div className="flex flex-col gap-3 md:flex-row">
              <ButtonLink to="/subscription" fullWidth>
                View subscription
              </ButtonLink>
              <ButtonLink to="/dashboard" variant="outlined" fullWidth>
                Go to dashboard
              </ButtonLink>
            </div>
          </div>
        </Panel>
      </div>
    );

  if (status === "failed")
    return (
      <div className="flex flex-col gap-6">
        <PageTitle>Payment was unsuccessful</PageTitle>
        <IntroCard eyebrow="Payment / Needs attention" title="Let's get your payment sorted.">
          Your payment wasn't confirmed, so your plan hasn't changed.
        </IntroCard>
        <Stepper steps={["Choose plan", "Review", "Not confirmed", "Resolve"]} current={2} />
        <Panel title="Payment needs attention" subtitle={state?.failureReason ?? "Paystack didn't confirm the payment."}>
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3 rounded-xl bg-danger-bg px-4 py-4 text-danger">
              <IconAlertTriangle aria-hidden="true" className="size-6 shrink-0" />
              <p className="text-body-lg font-semibold">Not confirmed</p>
            </div>
            <DetailRows rows={rows} />
            <div className="flex flex-col gap-3 md:flex-row">
              <ButtonLink to="/subscription/plans" fullWidth>
                Try again
              </ButtonLink>
              <ButtonLink to={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Payment ${p?.reference ?? ""}`)}`} variant="outlined" fullWidth>
                Contact support
              </ButtonLink>
            </div>
          </div>
        </Panel>
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Payment processing</PageTitle>
      <IntroCard eyebrow="Payment / Processing" title="We're confirming your payment with Paystack.">
        This usually takes a few seconds. Don't pay again while we check.
      </IntroCard>
      <Stepper steps={["Choose plan", "Review", "Pay with Paystack", "Confirm status"]} current={3} />
      <Panel title="Waiting for confirmation" subtitle="This page checks again by itself.">
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3 rounded-xl bg-surface-tint-blue px-4 py-4 text-ink-brand">
            <IconClock aria-hidden="true" className="size-6 shrink-0" />
            <p className="text-body-lg font-semibold">Processing</p>
          </div>
          <DetailRows rows={rows} />
          <ErrorNote error={error} />
          <Button fullWidth loading={checking} onClick={() => void check()}>
            Check payment status
          </Button>
        </div>
      </Panel>
    </div>
  );
}

// ── 07.07 Daily credit limit ─────────────────────────────────────────────
export function CreditsPage() {
  const usage = useUsage();
  if (usage.isLoading) return <Loading label="Loading usage…" />;
  if (usage.error || !usage.data) return <ErrorNote error={usage.error} fallback="We couldn't load today's usage." onRetry={() => void usage.refetch()} />;
  const u = usage.data;
  const out = !u.unlimited && u.credits.remaining <= 0;
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Daily credits</PageTitle>
      <SubscriptionTabs />
      <IntroCard eyebrow={u.unlimited ? "Your plan / Usage" : "Freemium / Daily usage"} title={u.unlimited ? "Your plan doesn't use credits." : out ? "You've used today's free credits." : `${count(u.credits.remaining)} credits left today.`}>
        {u.unlimited ? "Use everything in your plan as often as you need." : "Your credits refresh at midnight (Lagos time). You can review other plans any time."}
      </IntroCard>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel title="Your daily allowance" subtitle="Freemium actions use credits from a daily allowance.">
          <div className="flex flex-col gap-5">
            <PriceBox label="Daily credit limit" value={`${count(u.credits.daily)} credits`} />
            {!u.unlimited && <CreditMeter used={u.credits.used} daily={u.credits.daily} />}
            <DetailRows
              rows={[
                ...u.prices.map((p) => [p.label, `${p.cost} credits${p.perDay ? " · once a day" : ""}`] as [string, ReactNode]),
                ["When credits refresh", `Midnight, ${shortDate(u.credits.resetsAt)}`],
              ]}
            />
            <ButtonLink to="/subscription/plans" fullWidth>
              Compare the plans <IconArrowRight aria-hidden="true" className="size-4" />
            </ButtonLink>
          </div>
        </Panel>
        <TipList
          title="Here are your options"
          tips={[
            { title: "Wait for the reset", body: "Your free daily allowance refreshes at midnight." },
            { title: "Check your usage", body: u.byAction.length ? u.byAction.map((a) => `${a.label}: ${a.credits}`).join(" · ") : "Nothing used yet today." },
            { title: "Compare the benefits", body: "Standard and Premium don't use credits at all." },
          ]}
        />
      </div>
      <InfoStrip title="Opening a screen doesn't drain credits" action={<ButtonLink to="/subscription" variant="outlined" size="md">View plan and usage</ButtonLink>}>
        Viewing inventory or analytics costs credits once a day; after that it's free until midnight.
      </InfoStrip>
    </div>
  );
}

// ── 07.08 Trial ending / 07.09 Trial expired ─────────────────────────────
export function TrialPage() {
  const sub = useSubscription();
  if (sub.isLoading) return <Loading />;
  if (sub.error || !sub.data) return <ErrorNote error={sub.error} fallback="We couldn't load your plan." onRetry={() => void sub.refetch()} />;
  const s = sub.data;
  const t = trialState(s);
  const ended = t === "expired";
  if (!t)
    return (
      <EmptyState className="max-w-xl" icon={<IconBolt className="size-7" />} title="No trial to review" body={isPaid(s) ? `You're on ${planName(s.plan)}.` : "Choose a plan whenever you're ready."} action={<ButtonLink to="/subscription" size="md">View your plan</ButtonLink>} />
    );
  const left = daysLeft(s.trialEndDate);
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>{ended ? "Your free trial has ended" : "Your free trial is ending"}</PageTitle>
      <IntroCard eyebrow={ended ? "Trial / Expired" : "Trial / Ending soon"} title={ended ? "You're on Freemium now. Nothing is lost." : `${left} day${left === 1 ? "" : "s"} of full access left.`}>
        {ended ? "Your products, orders and settings are all still here." : `On ${shortDate(s.trialEndDate)} you move to Freemium unless you choose a plan.`}
      </IntroCard>
      <Stepper steps={["Trial started", "Full access", ended ? "Trial ended" : "Ending soon", "Choose a plan"]} current={ended ? 3 : 2} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel title={ended ? "What changed" : "What changes"} subtitle="Freemium keeps your data and core tools.">
          <div className="flex flex-col gap-5">
            <DetailRows
              rows={[
                ["Trial end date", shortDate(s.trialEndDate)],
                ["After the trial", "Freemium · 100 daily credits"],
                ["Paused on Freemium", "Invoices, projects, live store, BiSupplyNet"],
                ["Your data", "Kept in full"],
              ]}
            />
            <ButtonLink to="/subscription/plans" fullWidth>
              {ended ? "Select a new plan" : "Compare subscription plans"} <IconArrowRight aria-hidden="true" className="size-4" />
            </ButtonLink>
          </div>
        </Panel>
        <TipList
          title="Personalised next steps"
          tips={[
            { title: "Pick what you use most", body: "Standard covers invoices, projects and your live store." },
            { title: "Need BiSupplyNet?", body: "Premium adds supplier ordering and automation." },
            { title: "Questions?", body: <a className="text-ink-brand underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> },
          ]}
        />
      </div>
    </div>
  );
}

// ── 07.11 Billing history ────────────────────────────────────────────────
export function BillingPage() {
  return (
    <OwnerOnly>
      <Billing />
    </OwnerOnly>
  );
}

const BILL_STATUS: Record<BillingRow["status"], { label: string; tone: "success" | "danger" | "warning" | "neutral" }> = {
  success: { label: "Paid", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  pending: { label: "Processing", tone: "warning" },
  abandoned: { label: "Not completed", tone: "neutral" },
};

function Billing() {
  const sub = useSubscription();
  const [pageKey, setPageKey] = useUrlState<string>("page", "1");
  const page = Math.max(1, Number(pageKey) || 1);
  const history = useBillingHistory(page);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const s = sub.data;

  const receipt = async (row: BillingRow) => {
    setDownloading(row.id);
    setError(null);
    try {
      const { blob, filename } = await downloadSubscriptionReceipt(row.id);
      saveBlob(blob, filename === "download" ? `bimanage-receipt-${row.reference}.pdf` : filename);
    } catch (err) {
      setError(err);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Billing and plan history</PageTitle>
      <SubscriptionTabs />
      <IntroCard eyebrow="Account / Subscription" title="Everything about your billing.">
        Review plan status, payments and receipts.
      </IntroCard>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel title="Billing overview" subtitle="Payments and receipts for plans and startup packages.">
          <div className="flex flex-col gap-5">
            {s && <PriceBox label="Current plan" value={planLine(s)} />}
            {s && (
              <DetailRows
                rows={[
                  ["Plan price", isPaid(s) ? `${naira(s.price)} ${cycleName(s.billingCycle)}` : "Free"],
                  ...(isPaid(s) ? ([[s.cancelAtPeriodEnd ? "Ends on" : "Next payment", shortDate(s.currentPeriodEnd)]] as Array<[string, ReactNode]>) : []),
                  ["Daily credit allowance", s.credits?.unlimited ? "Unlimited" : `${count(s.credits?.daily ?? 100)} credits`],
                ]}
              />
            )}
          </div>
        </Panel>
        <TipList
          title="Your account, organised"
          tips={[
            { title: "Plan access", body: "See which features and limits apply on Plan & usage." },
            { title: "Payment history", body: "Amounts, references and receipts are listed below." },
            { title: "Need support?", body: <a className="text-ink-brand underline" href={`mailto:${SUPPORT_EMAIL}?subject=Billing`}>{SUPPORT_EMAIL}</a> },
          ]}
        />
      </div>
      <Panel title="Payments">
        {history.isLoading ? (
          <Loading label="Loading payments…" />
        ) : history.error ? (
          <ErrorNote error={history.error} fallback="We couldn't load your payments." onRetry={() => void history.refetch()} />
        ) : !history.data?.payments.length ? (
          <div className="rounded-xl bg-surface-pale p-5">
            <p className="text-body-lg font-semibold text-ink-strong">No payments to display</p>
            <p className="mt-1 text-body-sm text-ink-muted">Receipts appear here after your first payment.</p>
          </div>
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-line-subtle">
              {history.data.payments.map((r) => {
                const st = BILL_STATUS[r.status];
                return (
                  <li key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-3 md:grid-cols-[1.6fr_1fr_auto_auto]">
                    <span className="font-semibold text-ink-strong">
                      {r.description} {r.mode === "test" && <Status tone="warning">Test</Status>}
                    </span>
                    <span className="text-right font-semibold text-ink-strong md:order-3">{naira(r.amount)}</span>
                    <span className="text-body-sm text-ink-muted md:order-2">
                      {shortDate(r.paidAt ?? r.createdAt)}
                      {r.periodEnd ? ` · until ${shortDate(r.periodEnd)}` : ""}
                      {r.failureReason ? ` · ${r.failureReason}` : ""}
                    </span>
                    <span className="flex items-center justify-end gap-2 md:order-4">
                      <Status tone={st.tone}>{st.label}</Status>
                      {r.hasReceipt && (
                        <Button size="md" variant="outlined" loading={downloading === r.id} onClick={() => void receipt(r)} aria-label={`Download receipt for ${r.description}`}>
                          <IconDownload aria-hidden="true" className="size-4" />
                        </Button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            {history.data.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <Button size="md" variant="outlined" disabled={page <= 1} onClick={() => setPageKey(String(page - 1))}>
                  Previous
                </Button>
                <span className="text-body-sm text-ink-muted">
                  Page {page} of {history.data.totalPages}
                </span>
                <Button size="md" variant="outlined" disabled={page >= history.data.totalPages} onClick={() => setPageKey(String(page + 1))}>
                  Next
                </Button>
              </div>
            )}
          </>
        )}
        <ErrorNote error={error} className="mt-3" />
      </Panel>
      <InfoStrip title="About paid billing" action={<ButtonLink to={`mailto:${SUPPORT_EMAIL}?subject=Billing`} variant="outlined" size="md">Get billing support</ButtonLink>}>
        Plans renew automatically through Paystack. Cancel any time; you keep access to the end of the period you paid for.
      </InfoStrip>
    </div>
  );
}

