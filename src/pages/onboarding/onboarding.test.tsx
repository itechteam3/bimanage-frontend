import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { EMPTY_DASHBOARD, ME, installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";
import { LEGAL_LAST_UPDATED } from "@/config/legal";

const PACKAGES = [
  { id: "starter", name: "Starter", amount: 199999, currency: "NGN", tagline: "For businesses finding their feet", summary: "Core business features", days: 30 },
  { id: "standard", name: "Standard", amount: 299999, currency: "NGN", tagline: "For teams ready to grow", summary: "Full feature set", days: 30 },
  { id: "premium", name: "Premium", amount: 499999, currency: "NGN", tagline: "For advanced business operations", summary: "Everything", days: 30 },
];

let fb: FakeBackend;
beforeEach(() => {
  tokenStore.set("tok");
  serverStatus.set("up");
  fb = installFakeBackend();
  fb.handlers["GET /onboarding/startup-packages"] = () => [200, PACKAGES];
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  tokenStore.clear();
});

describe("onboarding gate", () => {
  it("an owner without a path is sent to choose one", async () => {
    fb.handlers["GET /onboarding/status"] = () => [200, { userPath: null, isTrialUsed: false }];
    const router = renderApp("/dashboard");
    expect(await screen.findByRole("heading", { name: /compare onboarding paths/i })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/onboarding");
  });

  it("a team member never sees onboarding", async () => {
    fb.handlers["GET /settings/my-role"] = () => [200, { role: "staff", permissions: { viewDashboard: true }, businessId: "o1", business: { _id: "o1", name: "Elijah Apparel" } }];
    fb.handlers["GET /onboarding/status"] = () => [200, { userPath: null }];
    renderApp("/dashboard");
    expect(await screen.findByRole("heading", { name: /business dashboard/i })).toBeInTheDocument();
    expect(fb.calls.some((c) => c.key === "GET /onboarding/status")).toBe(false);
  });
});

describe("paths", () => {
  beforeEach(() => {
    fb.handlers["GET /onboarding/status"] = () => [200, { userPath: null, isTrialUsed: false }];
    fb.handlers["POST /onboarding/select-path"] = (b) => [200, { userPath: b.path }];
  });

  it("existing business: selects the path, starts the 14-day trial (02.01)", async () => {
    fb.handlers["POST /onboarding/start-trial"] = () => [200, { daysRemaining: 14 }];
    const router = renderApp("/onboarding");
    await userEvent.click(await screen.findByRole("button", { name: /start existing-business setup/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/onboarding/trial"));
    expect(fb.calls.find((c) => c.key === "POST /onboarding/select-path")!.body).toEqual({ path: "existing_business" });
    expect(fb.calls.some((c) => c.key === "POST /onboarding/start-trial")).toBe(true);
    expect(await screen.findByRole("heading", { name: /trial started/i })).toBeInTheDocument();
  });

  it("a Google sign-up agrees to the Terms and Privacy Policy here before choosing a path", async () => {
    fb.handlers["GET /auth/me"] = () => [200, { ...ME, termsAcceptedAt: null, termsVersion: null }];
    fb.handlers["POST /auth/accept-terms"] = (b) => [200, { termsAcceptedAt: "2026-11-16T10:00:00.000Z", termsVersion: b.termsVersion }];
    fb.handlers["POST /onboarding/start-trial"] = () => [200, { daysRemaining: 14 }];
    const router = renderApp("/onboarding");
    const box = await screen.findByRole("checkbox", { name: /i agree to the terms of service and privacy policy/i });
    await userEvent.click(screen.getByRole("button", { name: /start existing-business setup/i }));
    expect(await screen.findByText(/tick the box to agree/i)).toBeInTheDocument();
    expect(fb.calls.some((c) => c.key === "POST /onboarding/select-path")).toBe(false);
    await userEvent.click(box);
    await userEvent.click(screen.getByRole("button", { name: /start existing-business setup/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/onboarding/trial"));
    expect(fb.calls.find((c) => c.key === "POST /auth/accept-terms")!.body).toEqual({ termsAccepted: true, termsVersion: LEGAL_LAST_UPDATED });
  });

  it("people who agreed at sign-up don't see the terms box", async () => {
    renderApp("/onboarding");
    await screen.findByRole("button", { name: /start existing-business setup/i });
    expect(screen.queryByRole("checkbox", { name: /i agree/i })).toBeNull();
  });

  it("startup: packages (07.12) → review (07.13) → hands off to Paystack", async () => {
    fb.handlers["POST /onboarding/startup-package/checkout"] = (b) => [201, { authorizationUrl: "https://checkout.paystack.com/xyz", reference: "BMSP-1", status: "pending", package: PACKAGES.find((p) => p.id === b.package), amount: 299999, activated: false }];
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    const router = renderApp("/onboarding");
    await userEvent.click(await screen.findByRole("button", { name: /explore startup packages/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/onboarding/packages"));
    expect(await screen.findByText("₦299,999")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: /review standard package/i }));
    expect(await screen.findByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
    await userEvent.click(await screen.findByRole("button", { name: /pay ₦299,999 with paystack/i }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.paystack.com/xyz"));
    expect(fb.calls.find((c) => c.key === "POST /onboarding/startup-package/checkout")!.body).toEqual({ package: "standard" });
  });

  it("payments not set up yet: says 'coming soon' instead of a Pay button or an error", async () => {
    fb.handlers["GET /onboarding/startup-packages"] = () => [200, PACKAGES.map((p) => ({ ...p, paymentsAvailable: false }))];
    renderApp("/onboarding/packages/starter");
    expect(await screen.findByText(/online payments are coming soon/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pay .* with paystack/i })).toBeNull();
    expect(screen.getByRole("link", { name: /back to dashboard/i })).toBeInTheDocument();
  });

  it("if the server says payments are unavailable at checkout, show 'coming soon', not an error", async () => {
    fb.handlers["POST /onboarding/startup-package/checkout"] = () => [503, { paymentsUnavailable: true, message: "Online payments are coming soon." }];
    renderApp("/onboarding/packages/starter");
    await userEvent.click(await screen.findByRole("button", { name: /pay .* with paystack/i }));
    expect(await screen.findByText(/online payments are coming soon/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("payment return (07.03 / 07.04 / 07.05)", () => {
  const payment = (status: string, activated = false) => ({
    reference: "BMSP-1",
    status,
    package: PACKAGES[0],
    amount: 199999,
    activated,
  });

  it("a confirmed payment shows the package as active", async () => {
    fb.handlers["POST /onboarding/startup-package/verify"] = (b) => (b.reference === "BMSP-1" ? [200, payment("success", true)] : [404, {}]);
    renderApp("/onboarding/payment?trxref=BMSP-1&reference=BMSP-1");
    expect(await screen.findByRole("heading", { name: /package activated/i })).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
  });

  it("a failed payment explains next steps and never claims activation", async () => {
    fb.handlers["POST /onboarding/startup-package/verify"] = () => [200, payment("failed")];
    renderApp("/onboarding/payment?reference=BMSP-1");
    expect(await screen.findByRole("heading", { name: /payment was unsuccessful/i })).toBeInTheDocument();
    expect(screen.getByText("Not yet activated")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /contact support/i })).toHaveAttribute("href", expect.stringContaining("mailto:"));
  });

  it("a payment still processing shows 07.03 and can be re-checked", async () => {
    let n = 0;
    fb.handlers["POST /onboarding/startup-package/verify"] = () => [200, ++n < 2 ? payment("pending") : payment("success", true)];
    renderApp("/onboarding/payment?reference=BMSP-1");
    expect(await screen.findByRole("heading", { name: /confirming your payment/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /check payment status/i }));
    expect(await screen.findByRole("heading", { name: /package activated/i })).toBeInTheDocument();
  });
});

describe("business identity (02.03) and checklist (02.05)", () => {
  it("saves the profile with only filled fields, then opens the checklist", async () => {
    fb.handlers["GET /business-profile"] = () => [200, {}];
    fb.handlers["PUT /business-profile"] = (b) => [200, b];
    fb.handlers["GET /onboarding/steps"] = () => [200, { completedCount: 3, totalSteps: 7, isComplete: false, percentage: 43, steps: [{ key: "accountCreated", label: "Create your account", description: "", completed: true, link: "/settings" }, { key: "firstProductAdded", label: "Add your first product", description: "", completed: false, link: "/inventory" }] }];
    const router = renderApp("/onboarding/business");
    await userEvent.type(await screen.findByLabelText(/legal business name/i), "Elijah Apparel Ltd");
    await userEvent.selectOptions(screen.getByLabelText(/business type/i), "limited_liability");
    await userEvent.selectOptions(screen.getByLabelText(/business category/i), "fashion");
    await userEvent.type(screen.getByLabelText(/phone number/i), "+2348035550190");
    await userEvent.type(screen.getByLabelText(/^email address/i), "hello@elijahapparel.com");
    await userEvent.click(screen.getByRole("button", { name: /save and continue/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/onboarding/checklist"));
    expect(fb.calls.find((c) => c.key === "PUT /business-profile")!.body).toEqual({
      businessName: "Elijah Apparel Ltd",
      businessType: "limited_liability",
      businessCategory: "fashion",
      businessPhone: "+2348035550190",
      businessEmail: "hello@elijahapparel.com",
    });
    expect(await screen.findByRole("link", { name: /add your first product/i })).toHaveAttribute("href", "/inventory");
    expect(screen.getByRole("link", { name: /create your account \(done\)/i })).toBeInTheDocument();
  });

  it("required fields are enforced before saving", async () => {
    fb.handlers["GET /business-profile"] = () => [200, {}];
    renderApp("/onboarding/business");
    await userEvent.click(await screen.findByRole("button", { name: /save and continue/i }));
    expect(await screen.findByText(/enter your legal business name/i)).toBeInTheDocument();
    expect(fb.calls.some((c) => c.key === "PUT /business-profile")).toBe(false);
  });
});

describe("dashboard by selling channel (03.03-03.10)", () => {
  const kp = (revenue: number, orders: number) => ({ revenue, orders, averageOrder: orders ? Math.round(revenue / orders) : 0, unitsSold: orders * 2 });
  const BOTH = { retail: { status: "active", activatedAt: null, pausedAt: null }, wholesale: { status: "active", activatedAt: null, pausedAt: null }, mode: "both", chosen: true };
  const data = (channel: string) => ({
    ...EMPTY_DASHBOARD,
    channel,
    kpis: channel === "retail" ? kp(1280000, 64) : channel === "wholesale" ? kp(4850000, 18) : kp(6130000, 82),
    change: { revenue: channel === "all" ? null : 8.4, orders: null },
    byChannel: { retail: kp(1280000, 64), wholesale: kp(4850000, 18) },
    series: [{ date: "2026-11-27", retail: 46000, wholesale: 840000 }],
    recentOrders: [
      { id: "so1", ref: "BULK-201", name: "Sola Stores", channel: "wholesale", total: 840000, status: "Processing", link: "/store/orders/so1", at: "2026-11-27T10:00:00Z" },
      { id: "o1", ref: "ORD-1024", name: "Amara Yusuf", channel: "retail", total: 46000, status: "Completed", link: "/orders/o1", at: "2026-11-26T10:00:00Z" },
    ].filter((o) => channel === "all" || o.channel === channel),
    wholesale: { bulkOrders: 18, tradeBuyers: 12, quotesAwaitingApproval: null, overdueTradeInvoices: null },
    inventory: { totalProducts: 124, stockValue: 1, lowStock: 4, outOfStock: 1 },
  });

  it("no activity yet: getting started, with the first actions", async () => {
    renderApp("/dashboard");
    expect(await screen.findByText("Your workspace is ready")).toBeInTheDocument();
    expect(screen.getByText("No sales to display yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create your first order" })).toHaveAttribute("href", "/orders/new");
    expect(screen.getByText(/finish setting up your business/i)).toBeInTheDocument();
  });

  it("combined view, then the wholesale tab: figures, orders and the view note follow the filter", async () => {
    fb.handlers["GET /selling-channels"] = () => [200, { channels: BOTH, isOwner: true }];
    fb.handlers["GET /dashboard"] = (_b, _h, url) => [200, data(url.searchParams.get("channel") ?? "all")];
    renderApp("/dashboard");
    const user = userEvent.setup();
    expect(await screen.findByRole("heading", { name: "Combined business dashboard" })).toBeInTheDocument();
    expect(await screen.findByText("₦6.13m")).toBeInTheDocument();
    expect(screen.getByText("64 retail · 18 wholesale")).toBeInTheDocument();
    expect(screen.getByText("BULK-201")).toBeInTheDocument();
    expect(screen.getByText("ORD-1024")).toBeInTheDocument();
    expect(screen.getByText("Wholesale leads revenue")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Wholesale" }));
    expect(await screen.findByRole("heading", { name: "Wholesale dashboard" })).toBeInTheDocument();
    expect(await screen.findByText("₦4.85m")).toBeInTheDocument();
    expect(screen.getByText("+8.4% vs previous 30 days")).toBeInTheDocument();
    expect(screen.getByText("Viewing wholesale only · Retail remains active")).toBeInTheDocument();
    expect(screen.queryByText("ORD-1024")).not.toBeInTheDocument();
    const call = [...fb.calls].reverse().find((c) => c.key === "GET /dashboard");
    expect(call).toBeTruthy();
  });

  it("a retail-only business sees its retail view without tabs", async () => {
    fb.handlers["GET /selling-channels"] = () => [200, { channels: { ...BOTH, wholesale: { status: "available", activatedAt: null, pausedAt: null }, mode: "retail" }, isOwner: true }];
    fb.handlers["GET /dashboard"] = (_b, _h, url) => [200, data(url.searchParams.get("channel") ?? "all")];
    renderApp("/dashboard");
    expect(await screen.findByRole("heading", { name: "Retail dashboard" })).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("refresh failed: says nothing changed and offers a retry", async () => {
    fb.handlers["GET /dashboard"] = () => [500, { message: "boom at dashboardChannels.js" }];
    renderApp("/dashboard");
    expect(await screen.findByText("Data is temporarily unavailable", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /refresh dashboard/i })).toBeInTheDocument();
    expect(screen.queryByText(/dashboardChannels\.js/)).not.toBeInTheDocument();
  });
});
