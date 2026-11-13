import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";
import { browser } from "@/lib/store/api";
import { lastSubscriptionRef } from "@/lib/subscription/api";

// Subscriptions & usage (07.01–07.11). Prices here are deliberately odd:
// the screens must show whatever the API says (they're set on Render).

const FEATURES_FREE = { dashboard: true, store: "view_only", inventory: true, orders: true, analytics: true, invoices: false, projects: false, bisupplynet: false };
const FEATURES_STD = { dashboard: true, store: true, inventory: true, orders: true, analytics: true, invoices: true, projects: true, messages: true, bisupplynet: false };
const FEATURES_PREM = { ...FEATURES_STD, bisupplynet: true, automation: true, socialMedia: true };
const PRICES = [{ action: "ADD_PRODUCT", label: "Adding a product", cost: 5 }, { action: "CREATE_ORDER", label: "Creating an order", cost: 5 }, { action: "VIEW_ANALYTICS", label: "Viewing analytics", cost: 5, perDay: true }];
const plans = (std = { monthly: 12345, yearly: 123450 }, confirmed = false) => [
  { id: "freemium", name: "Freemium", price: { monthly: 0, yearly: 0 }, description: "Get started for free", features: FEATURES_FREE, credits: 100, creditPrices: PRICES, pricesConfirmed: true, paymentsAvailable: true },
  { id: "standard", name: "Standard", price: std, description: "Full access to core business tools", features: FEATURES_STD, credits: "unlimited", pricesConfirmed: confirmed, paymentsAvailable: true },
  { id: "premium", name: "Premium", price: { monthly: 34567, yearly: 345670 }, description: "Complete suite", features: FEATURES_PREM, credits: "unlimited", pricesConfirmed: confirmed, paymentsAvailable: true },
];
const FREE_SUB = { plan: "freemium", status: "active", access: { source: "plan", tier: "freemium", unlimitedCredits: false }, features: FEATURES_FREE, credits: { daily: 100, used: 30, remaining: 70, resetsAt: "2026-11-13T23:00:00Z", unlimited: false }, price: 0, cancelAtPeriodEnd: false, pendingChange: null };
const STD_SUB = { ...FREE_SUB, plan: "standard", billingCycle: "monthly", price: 12345, paymentMode: "test", currentPeriodEnd: "2026-12-13T10:00:00Z", access: { source: "plan", tier: "standard", unlimitedCredits: true }, features: FEATURES_STD, credits: { ...FREE_SUB.credits, unlimited: true } };
const USAGE = { unlimited: false, credits: { daily: 100, used: 30, remaining: 70, resetsAt: "2026-11-13T23:00:00Z", timezone: "Africa/Lagos" }, dayPasses: ["VIEW_ANALYTICS"], byAction: [{ action: "ADD_PRODUCT", label: "Adding a product", times: 5, credits: 25 }, { action: "VIEW_ANALYTICS", label: "Viewing analytics", times: 1, credits: 5 }], recent: [], prices: PRICES };

let fb: FakeBackend;
let current: Record<string, unknown>;
beforeEach(() => {
  tokenStore.set("tok");
  serverStatus.set("up");
  fb = installFakeBackend();
  current = FREE_SUB;
  fb.handlers["GET /subscriptions/current"] = () => [200, current];
  fb.handlers["GET /subscriptions/plans"] = () => [200, plans()];
  fb.handlers["GET /subscriptions/usage"] = () => [200, USAGE];
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  tokenStore.clear();
});
const last = (key: string) => [...fb.calls].reverse().find((c) => c.key === key);

describe("07.01 plan comparison", () => {
  it("shows the API's prices for the chosen period, marks them provisional, and the current plan", async () => {
    const user = userEvent.setup();
    renderApp("/subscription/plans");
    expect(await screen.findByTestId("price-standard")).toHaveTextContent("₦12,345");
    expect(screen.getByTestId("price-premium")).toHaveTextContent("₦34,567");
    expect(screen.getByText(/prices are provisional/i)).toBeInTheDocument();
    expect(screen.getAllByText("Current plan").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("radio", { name: "Yearly" }));
    expect(screen.getByTestId("price-standard")).toHaveTextContent("₦123,450");
    expect(screen.getByRole("link", { name: "Choose Standard" })).toHaveAttribute("href", "/subscription/change?plan=standard&cycle=yearly");
  });

  it("a price change on the server shows everywhere, and confirmed prices drop the provisional note", async () => {
    fb.handlers["GET /subscriptions/plans"] = () => [200, plans({ monthly: 20000, yearly: 200000 }, true)];
    renderApp("/subscription/plans");
    expect(await screen.findByTestId("price-standard")).toHaveTextContent("₦20,000");
    expect(screen.queryByText(/prices are provisional/i)).not.toBeInTheDocument();
  });
});

describe("07.10 change plan → 07.02 Paystack → 07.03/07.04/07.05", () => {
  it("subscribe: shows the quoted amount and date, then hands over to Paystack", async () => {
    fb.handlers["GET /subscriptions/quote"] = () => [200, { type: "subscribe", plan: "standard", billingCycle: "monthly", currentPlan: "freemium", currentBillingCycle: null, currency: "NGN", pricesConfirmed: false, paymentsAvailable: true, amount: 12345, effectiveAt: "2026-11-13T10:00:00Z", periodEnd: "2026-12-13T10:00:00Z", nextChargeAt: "2026-12-13T10:00:00Z", nextChargeAmount: 12345, notes: [], message: "Pay NGN 12,345 now." }];
    fb.handlers["POST /subscriptions/checkout"] = () => [201, { authorizationUrl: "https://checkout.paystack.com/abc", reference: "BMSUB-1", quote: {}, mode: "test" }];
    const go = vi.spyOn(browser, "go").mockImplementation(() => undefined);
    const user = userEvent.setup();
    renderApp("/subscription/change?plan=standard&cycle=monthly");
    const pay = await screen.findByRole("button", { name: /pay ₦12,345 with paystack/i });
    expect(screen.getByText("Standard adds")).toBeInTheDocument();
    expect(screen.getByText(/invoices, projects and tasks, live online store/i)).toBeInTheDocument();
    await user.click(pay);
    await waitFor(() => expect(go).toHaveBeenCalledWith("https://checkout.paystack.com/abc"));
    expect(last("POST /subscriptions/checkout")?.body).toEqual({ plan: "standard", billingCycle: "monthly" });
    expect(lastSubscriptionRef.get()).toBe("BMSUB-1");
  });

  it("downgrade: nothing to pay now, switches on the period end date", async () => {
    current = STD_SUB;
    fb.handlers["GET /subscriptions/quote"] = () => [200, { type: "downgrade", plan: "standard", billingCycle: "monthly", currentPlan: "premium", currentBillingCycle: "monthly", currency: "NGN", pricesConfirmed: false, paymentsAvailable: true, amount: 0, effectiveAt: "2026-12-13T10:00:00Z", nextChargeAt: "2026-12-13T10:00:00Z", nextChargeAmount: 12345, notes: ["You keep Premium until then."], message: "Standard starts on 13 Dec." }];
    fb.handlers["POST /subscriptions/change"] = () => [200, { result: "scheduled", quote: {} }];
    const user = userEvent.setup();
    const router = renderApp("/subscription/change?plan=standard&cycle=monthly");
    await user.click(await screen.findByRole("button", { name: /switch on 13 dec 2026/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/subscription"));
    expect(last("POST /subscriptions/change")?.body).toEqual({ plan: "standard", billingCycle: "monthly" });
    expect(screen.queryByRole("button", { name: /paystack/i })).not.toBeInTheDocument();
  });

  it("payment success shows the plan, amount and test badge", async () => {
    fb.handlers["GET /subscriptions/verify"] = () => [200, { status: "paid", payment: { id: "p1", reference: "BMSUB-1", description: "Standard (monthly)", amount: 12345, status: "success", mode: "test", periodEnd: "2026-12-13T10:00:00Z" }, failureReason: null }];
    renderApp("/subscription/payment?reference=BMSUB-1");
    expect(await screen.findByRole("heading", { name: "Payment successful" })).toBeInTheDocument();
    expect(screen.getByText("₦12,345")).toBeInTheDocument();
    expect(screen.getByText("Test payment")).toBeInTheDocument();
  });

  it("payment failure says the plan hasn't changed and offers to try again", async () => {
    fb.handlers["GET /subscriptions/verify"] = () => [200, { status: "failed", payment: { id: "p1", reference: "BMSUB-1", description: "Standard (monthly)", amount: 12345, status: "failed", mode: "test" }, failureReason: "Declined" }];
    renderApp("/subscription/payment?reference=BMSUB-1");
    expect(await screen.findByRole("heading", { name: "Payment was unsuccessful" })).toBeInTheDocument();
    expect(screen.getByText("Declined")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/subscription/plans");
  });
});

describe("07.06 plan and usage", () => {
  it("Freemium: credits used today, by action, with the price list from the API", async () => {
    renderApp("/subscription");
    expect(await screen.findByText("Freemium · Free")).toBeInTheDocument();
    expect(await screen.findByText("30 of 100 credits")).toBeInTheDocument(); // usage may arrive after the plan
    expect(screen.getByText("25 credits")).toBeInTheDocument();
    expect(screen.getByText("5 credits (once a day)")).toBeInTheDocument();
  });

  it("paid plan: price from the server, cancel keeps access to the period end", async () => {
    current = STD_SUB;
    fb.handlers["POST /subscriptions/cancel"] = () => ((current = { ...STD_SUB, cancelAtPeriodEnd: true }), [200, { result: "cancelled", endsAt: STD_SUB.currentPeriodEnd }]);
    fb.handlers["POST /subscriptions/resume"] = () => ((current = STD_SUB), [200, { result: "resumed", renewsAt: STD_SUB.currentPeriodEnd }]);
    const user = userEvent.setup();
    renderApp("/subscription");
    expect(await screen.findByText("Standard · ₦12,345/month")).toBeInTheDocument();
    expect(screen.getByText("Test mode")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel plan" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/keep standard until 13 dec 2026/i);
    await user.click(within(dialog).getByRole("button", { name: "Cancel plan" }));
    expect(await screen.findByText(/standard ends on 13 dec 2026/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep my plan" }));
    await waitFor(() => expect(last("POST /subscriptions/resume")).toBeTruthy());
    await waitFor(() => expect(screen.queryByText(/standard ends on/i)).not.toBeInTheDocument());
  });

  it("a scheduled downgrade can be dropped (keep current plan)", async () => {
    current = { ...STD_SUB, plan: "premium", price: 34567, pendingChange: { plan: "standard", billingCycle: "monthly", effectiveAt: "2026-12-13T10:00:00Z" } };
    fb.handlers["DELETE /subscriptions/change"] = () => ((current = { ...current, pendingChange: null }), [200, { result: "kept", renews: true }]);
    const user = userEvent.setup();
    renderApp("/subscription");
    expect(await screen.findByText(/moving to standard \(monthly\) on 13 dec 2026/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep Premium" }));
    await waitFor(() => expect(screen.queryByText(/moving to standard/i)).not.toBeInTheDocument());
  });

  it("past due: says how long the plan keeps working", async () => {
    current = { ...STD_SUB, pastDueSince: "2026-12-13T11:00:00Z", graceEndsAt: "2026-12-16T10:00:00Z" };
    renderApp("/subscription");
    expect(await screen.findByText(/renewal payment didn't go through/i)).toBeInTheDocument();
    expect(screen.getByText(/keeps working until 16 dec 2026/i)).toBeInTheDocument();
  });

  it("team members see who manages billing (no billing calls)", async () => {
    fb.handlers["GET /settings/my-role"] = () => [200, { role: "staff", permissions: {}, businessId: "u9" }];
    renderApp("/subscription/billing");
    expect(await screen.findByText("Only the business owner manages the subscription")).toBeInTheDocument();
    expect(last("GET /subscriptions/billing-history")).toBeUndefined();
  });
});

describe("07.07 credits, 07.08/07.09 trial, 07.11 billing", () => {
  it("out of credits: says so, and when they refresh", async () => {
    fb.handlers["GET /subscriptions/usage"] = () => [200, { ...USAGE, credits: { ...USAGE.credits, used: 100, remaining: 0 } }];
    renderApp("/subscription/credits");
    expect(await screen.findByText("You've used today's free credits.")).toBeInTheDocument();
    expect(screen.getByText("100 of 100 credits")).toBeInTheDocument();
    expect(screen.getByText(/midnight, 1[34] nov 2026/i)).toBeInTheDocument();
  });

  it("trial ending: days left and what changes", async () => {
    current = { ...FREE_SUB, isTrialActive: true, trialEndDate: new Date(Date.now() + 2 * 86400e3).toISOString(), access: { source: "trial", tier: "premium", unlimitedCredits: true } };
    renderApp("/subscription/trial");
    expect(await screen.findByRole("heading", { name: "Your free trial is ending" })).toBeInTheDocument();
    expect(screen.getByText("2 days of full access left.")).toBeInTheDocument();
  });

  it("trial expired: on Freemium, nothing lost", async () => {
    current = { ...FREE_SUB, isTrialUsed: true, isTrialActive: false, trialEndDate: "2026-11-01T00:00:00Z" };
    renderApp("/subscription/trial");
    expect(await screen.findByRole("heading", { name: "Your free trial has ended" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /select a new plan/i })).toHaveAttribute("href", "/subscription/plans");
  });

  it("billing history: payments with status, test flag and receipts", async () => {
    current = STD_SUB;
    fb.handlers["GET /subscriptions/billing-history"] = () => [200, { payments: [
      { id: "p2", reference: "INV_1", description: "Standard (monthly) renewal", purpose: "subscription", kind: "renewal", amount: 12345, currency: "NGN", status: "failed", mode: "test", paidAt: null, createdAt: "2026-12-13T10:00:00Z", periodStart: null, periodEnd: null, failureReason: "Card declined", hasReceipt: false },
      { id: "p1", reference: "BMSUB-1", description: "Standard (monthly)", purpose: "subscription", kind: "initial", amount: 12345, currency: "NGN", status: "success", mode: "test", paidAt: "2026-11-13T10:00:00Z", createdAt: "2026-11-13T10:00:00Z", periodStart: "2026-11-13T10:00:00Z", periodEnd: "2026-12-13T10:00:00Z", failureReason: null, hasReceipt: true },
    ], total: 2, page: 1, totalPages: 1 }];
    renderApp("/subscription/billing");
    expect(await screen.findByText("Standard (monthly) renewal")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText(/card declined/i)).toBeInTheDocument();
    expect(screen.getAllByText("Test").length).toBe(2);
    expect(screen.getAllByRole("button", { name: /download receipt/i })).toHaveLength(1);
  });
});
