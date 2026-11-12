import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { EMPTY_DASHBOARD, installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";

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

  it("startup: packages (07.12) → review (07.13) → hands off to Paystack", async () => {
    fb.handlers["POST /onboarding/startup-package/checkout"] = (b) => [201, { authorizationUrl: "https://checkout.paystack.com/xyz", reference: "BMSP-1", status: "pending", package: PACKAGES.find((p) => p.id === b.package), amount: 299999, activated: false }];
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    const router = renderApp("/onboarding");
    await userEvent.click(await screen.findByRole("button", { name: /explore startup packages/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/onboarding/packages"));
    expect(await screen.findByText("₦299,999")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: /review standard package/i }));
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

describe("dashboard (03.01 / 03.02)", () => {
  it("empty state", async () => {
    renderApp("/dashboard");
    expect(await screen.findByText(/no orders recorded yet/i)).toBeInTheDocument();
    expect(screen.getByText(/your sales trend appears here/i)).toBeInTheDocument();
    expect(screen.getByText(/finish setting up your business/i)).toBeInTheDocument();
  });

  it("populated state with real figures", async () => {
    const today = new Date();
    fb.handlers["GET /dashboard"] = () => [
      200,
      {
        ...EMPTY_DASHBOARD,
        stats: { ...EMPTY_DASHBOARD.stats, revenue: 1280400, totalOrders: 64, openInvoices: 9, lowStock: 5 },
        recentOrders: [{ _id: "o1", trackingNo: "ORD-1001", productName: "Classic linen shirt", price: 45000, quantity: 1, totalAmount: 45000, status: "completed", date: today.toISOString() }],
        topSelling: [{ _id: "p1", name: "Classic linen shirt", sellingPrice: 45000, totalSold: 28 }],
        salesChart: [{ _id: { year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() }, totalSales: 45000, totalOrders: 1 }],
      },
    ];
    renderApp("/dashboard");
    expect(await screen.findByText("₦1.28m")).toBeInTheDocument();
    expect(screen.getByText("64")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("ORD-1001")).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(screen.getByText("28 sold")).toBeInTheDocument();
  });
});
