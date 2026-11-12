import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";
import { parseCsv, rowsFromCsv } from "./StoreProductPages";
import { browser } from "@/lib/store/api";

// Online store (Figma 08.01–08.20) against a fake API.

const STORE = {
  _id: "s1",
  storeName: "Elijah Apparel",
  storeSlug: "elijahapparel",
  storeUrl: "elijahapparel.bimanage.com",
  description: "Linen shirts",
  category: "fashion",
  contactEmail: "shop@example.com",
  contactPhone: "+234 803 000 0000",
  deliveryFee: 2500,
  freeDeliveryAbove: 50000,
  template: "basic",
  isPublished: false,
  status: "draft",
  publicUrl: "https://bimanage-frontend.vercel.app/s/elijahapparel",
  allowedTemplates: ["basic", "standard"],
  canPublish: true,
};
const CHECKLIST = {
  steps: [
    { key: "identity", label: "Business identity", done: true, value: "Completed", detail: "Store details", required: true },
    { key: "template", label: "Template selection", done: true, value: "Basic", detail: "Ready", required: true },
    { key: "products", label: "Inventory products", done: true, value: "1 published", detail: "Synced", required: true },
    { key: "checkout", label: "Checkout setup", done: false, value: "Paystack", detail: "Payments coming soon", required: false },
  ],
  completed: 3,
  total: 4,
  percent: 75,
  products: { total: 2, published: 1 },
  template: { key: "basic", name: "Basic", allowed: ["basic", "standard"] },
  plan: { tier: "standard", name: "Standard", canPublish: true },
  status: "draft",
  publishedAt: null,
  canPublish: true,
  blockers: [],
  storeUrl: STORE.publicUrl,
  paymentsEnabled: false,
  guestCheckout: true,
};
const SHIRT = { _id: "p1", name: "Classic linen shirt", sku: "APP-101", price: 22500, comparePrice: 28000, images: ["https://cdn.example.com/shirt.png"], category: "fashion_men", stockQuantity: 28, isAvailable: true, inventoryProduct: null, totalSold: 3, totalViews: 40, createdAt: "2026-11-12T09:00:00Z" };
const PUBLIC_STORE = { _id: "s1", storeName: "Elijah Apparel", storeSlug: "elijahapparel", description: "Linen shirts", category: "fashion", template: "basic", contactEmail: "shop@example.com", deliveryFee: 2500, freeDeliveryAbove: 50000, acceptingOrders: true, paymentsComingSoon: false };
const PUBLIC_SHIRT = { _id: "p1", name: "Classic linen shirt", price: 22500, images: ["https://cdn.example.com/shirt.png"], category: "fashion_men", inStock: true, lowStock: false };

let fb: FakeBackend;
let assigned: string | null;
beforeEach(() => {
  localStorage.clear();
  tokenStore.set("tok");
  serverStatus.set("up");
  fb = installFakeBackend();
  fb.handlers["GET /subscriptions/current"] = () => [200, { plan: "standard", status: "active", features: { store: true, inventory: true } }];
  fb.handlers["GET /store/my-store"] = () => [200, STORE];
  fb.handlers["GET /store/launch-checklist"] = () => [200, CHECKLIST];
  fb.handlers["GET /store/products"] = () => [200, [SHIRT]];
  assigned = null;
  vi.spyOn(browser, "go").mockImplementation((u: string) => void (assigned = u));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  tokenStore.clear();
});
const last = (key: string) => [...fb.calls].reverse().find((c) => c.key === key);

describe("merchant store", () => {
  it("08.01: no store yet → create form; creating opens the launch checklist", async () => {
    let created = false;
    fb.handlers["GET /store/my-store"] = () => (created ? [200, STORE] : [404, { message: "Store not found" }]);
    fb.handlers["POST /store/create"] = () => ((created = true), [201, { store: STORE, storeUrl: STORE.publicUrl }]);
    fb.handlers["GET /business-profile"] = () => [200, { businessName: "", businessEmail: "hello@dior.example" }];
    const user = userEvent.setup();
    const router = renderApp("/store");
    await waitFor(() => expect(router.state.location.pathname).toBe("/store/create"));
    await user.type(await screen.findByLabelText(/store name/i), "Elijah Apparel");
    expect(screen.getByLabelText(/free store url/i)).toHaveValue(`${window.location.origin}/s/elijahapparel`);
    await user.selectOptions(screen.getByLabelText(/business category/i), "fashion");
    await user.type(screen.getByLabelText(/store description/i), "Linen shirts and essentials");
    await user.click(screen.getByRole("button", { name: "Create store" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/store"));
    expect(last("POST /store/create")?.body).toMatchObject({ storeName: "Elijah Apparel", category: "fashion", contactEmail: "hello@dior.example" });
    expect(await screen.findByRole("heading", { name: "Ready to launch?" })).toBeInTheDocument();
  });

  it("08.02: launch checklist shows progress and publishes", async () => {
    fb.handlers["POST /store/publish"] = () => [200, { message: "Your store is live" }];
    const user = userEvent.setup();
    renderApp("/store");
    expect(await screen.findByText("75%")).toBeInTheDocument();
    expect(screen.getByText("Payments coming soon", { selector: "p" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Publish store" }));
    await waitFor(() => expect(last("POST /store/publish")).toBeTruthy());
  });

  it("08.02: a plan that can't publish explains why and links to plans", async () => {
    fb.handlers["GET /store/launch-checklist"] = () => [200, { ...CHECKLIST, canPublish: false, plan: { tier: "freemium", name: "Freemium", canPublish: false }, blockers: ["Upgrade to Standard or a startup package to publish your store."] }];
    renderApp("/store");
    expect(await screen.findByRole("button", { name: "Publish store" })).toBeDisabled();
    expect(screen.getAllByText(/Upgrade to Standard/).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /see plans/i })).toHaveAttribute("href", "/subscription");
  });

  it("08.04: publishing needs a photo; field errors from the server land on the field", async () => {
    fb.handlers["POST /store/products"] = () => [409, { message: "Another product in your store already uses this SKU.", field: "sku" }];
    const user = userEvent.setup();
    renderApp("/store/products/new");
    await user.type(await screen.findByLabelText(/product name/i), "Linen shirt");
    await user.selectOptions(screen.getByLabelText(/^category/i), "fashion_men");
    await user.type(screen.getByLabelText(/price \(ngn\)/i), "22500");
    await user.type(screen.getByLabelText(/^sku/i), "APP-101");
    await user.click(screen.getByRole("button", { name: "Publish product" }));
    expect(await screen.findByText(/Add at least one photo/)).toBeInTheDocument();
    expect(last("POST /store/products")).toBeUndefined();

    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(last("POST /store/products")?.body).toMatchObject({ name: "Linen shirt", sku: "APP-101", price: 22500, isAvailable: false, images: [] }));
    expect(await screen.findByText(/already uses this SKU/)).toBeInTheDocument();
  });

  it("08.03 → 08.07: catalogue lists products and opens the detail", async () => {
    const user = userEvent.setup();
    const router = renderApp("/store/products");
    await user.click(await screen.findByRole("link", { name: "Classic linen shirt" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/store/products/p1"));
    expect(await screen.findByText("APP-101")).toBeInTheDocument();
    expect(screen.getByTestId("back-to-screen")).toHaveTextContent("Back to Online Store");
  });

  it("08.05: CSV rows are checked before upload, and results come back per row", async () => {
    const csv = `name,sku,price,quantity,category,publication,image_url\nShirt,A-1,22500,3,fashion_men,published,https://x/a.png\n,A-2,abc,1,nope,draft,\nTote,A-3,12000,,bags_accessories,draft,\n`;
    const { rows } = rowsFromCsv(csv);
    expect(rows.map((r) => r.problems.length)).toEqual([0, 3, 0]);
    expect(rows[1]!.problems.join(" ")).toMatch(/Name is missing.*Price must be a number.*Unknown category/);
    expect(parseCsv('a,"b, ""c"""\r\n1,2')).toEqual([["a", 'b, "c"'], ["1", "2"]]);
    expect(rowsFromCsv("sku,price\nA,1").error).toMatch(/name, sku and price/);
  });

  it("08.06: sync sends the selected inventory products", async () => {
    fb.handlers["GET /inventory/products"] = () => [200, [{ _id: "i1", name: "Canvas tote", sellingPrice: 12000, stockQuantity: 9, totalSold: 0 }]];
    fb.handlers["POST /store/products/sync-inventory"] = () => [200, { message: "1 synced", results: [{ product: SHIRT, action: "created" }] }];
    const user = userEvent.setup();
    renderApp("/store/products/sync");
    await user.click(await screen.findByRole("checkbox", { name: /canvas tote/i }));
    await user.click(screen.getByRole("button", { name: "Sync 1 selected" }));
    await waitFor(() => expect(last("POST /store/products/sync-inventory")?.body).toEqual({ productIds: ["i1"] }));
    expect(await screen.findByText(/1 added to your store/)).toBeInTheDocument();
  });

  it("08.08: templates the plan doesn't include show an upgrade link", async () => {
    fb.handlers["GET /store/templates"] = () => [200, { current: "basic", plan: "standard", templates: [{ key: "basic", name: "Basic", allowed: true }, { key: "standard", name: "Standard", allowed: true }, { key: "premium", name: "Premium", allowed: false }] }];
    fb.handlers["PUT /store/template"] = (b) => [200, { ...STORE, template: b.template }];
    const user = userEvent.setup();
    renderApp("/store/templates");
    expect(await screen.findByRole("link", { name: /upgrade for premium/i })).toHaveAttribute("href", "/subscription");
    await user.click(screen.getByRole("button", { name: "Choose Standard" }));
    await waitFor(() => expect(last("PUT /store/template")?.body).toEqual({ template: "standard" }));
  });

  it("08.09: custom domain shows the DNS record and says BiManage must add it to Vercel", async () => {
    let state: Record<string, unknown> = { bimanageAddress: STORE.publicUrl, customDomain: null, verified: false, verifiedAt: null, status: "none", hosting: "none", ssl: null, live: false, dnsInstructions: null, planAllows: true };
    fb.handlers["GET /store/custom-domain"] = () => [200, state];
    fb.handlers["POST /store/custom-domain"] = (b) => {
      state = { ...state, customDomain: b.domain, status: "awaiting_dns", hosting: "pending", ssl: "pending_dns", dnsInstructions: { type: "CNAME", host: "shop", name: "shop.elijahapparel.com", value: "cname.vercel-dns.com", ttl: 3600, note: "" } };
      return [200, state];
    };
    fb.handlers["POST /store/verify-domain"] = () => [400, { message: "We couldn't find the DNS record yet.", verified: false, ...state }];
    const user = userEvent.setup();
    renderApp("/store/domain");
    await user.type(await screen.findByLabelText(/custom domain/i), "shop.elijahapparel.com");
    await user.click(screen.getByRole("button", { name: "Save domain" }));
    const steps = await screen.findByRole("heading", { name: "Connect shop.elijahapparel.com" });
    const panel = steps.closest("section")!;
    expect(within(panel).getByText("CNAME")).toBeInTheDocument();
    expect(within(panel).getByText("shop")).toBeInTheDocument();
    expect(within(panel).getByText("cname.vercel-dns.com")).toBeInTheDocument();
    expect(within(panel).getByText(/must also be added to our hosting provider \(Vercel\)/)).toBeInTheDocument();
    expect(within(panel).getByText(/waiting for BiManage to add shop\.elijahapparel\.com/)).toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: "Verify domain" }));
    expect(await screen.findByText(/couldn't find the DNS record yet/)).toBeInTheDocument();
  });

  it("08.09: Freemium sees custom domains as an upgrade", async () => {
    fb.handlers["GET /store/custom-domain"] = () => [200, { bimanageAddress: STORE.publicUrl, customDomain: null, verified: false, status: "none", ssl: null, dnsInstructions: null, planAllows: false }];
    renderApp("/store/domain");
    expect(await screen.findByText(/part of the Standard and Premium plans/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/custom domain/i)).toBeNull();
  });

  it("08.10: analytics shows the period, top product and exports CSV", async () => {
    fb.handlers["GET /store/analytics"] = () => [200, { range: { key: "30d", from: "2026-10-14", to: "2026-11-12", days: 30 }, revenue: 60000, revenueChange: 50, orders: 3, ordersChange: null, fulfilled: 2, averageOrderValue: 20000, cancelled: 0, storeViews: 120, productViews: 45, topProduct: { productId: "p1", name: "Classic linen shirt", image: null, sold: 3, revenue: 40000 }, topProducts: [{ productId: "p1", name: "Classic linen shirt", image: null, sold: 3, revenue: 40000 }], series: [{ date: "2026-11-12", revenue: 60000, orders: 3 }], payouts: { pending: 7000, available: 5000 } }];
    renderApp("/store/analytics");
    expect(await screen.findByText("+50% vs previous period")).toBeInTheDocument();
    expect(screen.getAllByText("Classic linen shirt").length).toBeGreaterThan(0);
    expect(screen.getByText(/₦20,000/)).toBeInTheDocument();
  });
});

describe("storefront (guest, no sign-in)", () => {
  beforeEach(() => {
    tokenStore.clear();
    fb.handlers["GET /store/elijahapparel"] = () => [200, PUBLIC_STORE];
    fb.handlers["GET /store/elijahapparel/products"] = () => [200, { products: [PUBLIC_SHIRT], total: 1, page: 1, totalPages: 1 }];
    fb.handlers["GET /store/elijahapparel/products/p1"] = () => [200, PUBLIC_SHIRT];
  });

  it("08.11 → 08.13 → 08.14: browse, add to bag (guest session kept), view bag", async () => {
    let cart = { items: [] as unknown[], itemCount: 0, subtotal: 0, deliveryFee: 0, total: 0, freeDeliveryAbove: 50000 };
    fb.handlers["GET /cart/elijahapparel"] = () => [200, cart];
    fb.handlers["POST /cart/elijahapparel/add"] = (b) => {
      cart = { items: [{ product: PUBLIC_SHIRT, quantity: b.quantity, requested: b.quantity, available: 28, lineTotal: 45000 }], itemCount: 2, subtotal: 45000, deliveryFee: 2500, total: 47500, freeDeliveryAbove: 50000 };
      return [200, { ...cart, sessionId: "4f1c2a6e-9b1d-4c3e-8f2a-1234567890ab" }];
    };
    const user = userEvent.setup();
    const router = renderApp("/s/elijahapparel");
    await user.click(await screen.findByRole("link", { name: /view details: classic linen shirt/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/s/elijahapparel/products/p1"));
    await user.click(await screen.findByRole("button", { name: "One more" }));
    await user.click(screen.getByRole("button", { name: /add to bag/i }));
    expect(await screen.findByText(/added to your bag/i)).toBeInTheDocument();
    expect(last("POST /cart/elijahapparel/add")?.body).toEqual({ productId: "p1", quantity: 2 });
    expect(last("POST /cart/elijahapparel/add")?.headers.Authorization).toBeUndefined();
    expect(localStorage.getItem("bimanage.cart.elijahapparel")).toBe("4f1c2a6e-9b1d-4c3e-8f2a-1234567890ab");

    await user.click(screen.getByRole("link", { name: "View bag" }));
    expect(await screen.findByText(/add ₦5,000 more for free delivery/i)).toBeInTheDocument();
    expect(last("GET /cart/elijahapparel")?.headers["X-Session-ID"]).toBe("4f1c2a6e-9b1d-4c3e-8f2a-1234567890ab");
    expect(screen.getByTestId("back-button")).toBeInTheDocument();
  });

  it("08.20: an empty bag offers to explore products", async () => {
    fb.handlers["GET /cart/elijahapparel"] = () => [200, { items: [], itemCount: 0, subtotal: 0, deliveryFee: 0, total: 0, freeDeliveryAbove: null }];
    renderApp("/s/elijahapparel/cart");
    expect(await screen.findByRole("heading", { name: "Your bag is empty" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore products" })).toHaveAttribute("href", "/s/elijahapparel");
  });

  it("08.15: guest checkout sends the details and hands off to Paystack", async () => {
    localStorage.setItem("bimanage.cart.elijahapparel", "4f1c2a6e-9b1d-4c3e-8f2a-1234567890ab");
    fb.handlers["GET /cart/elijahapparel"] = () => [200, { items: [{ product: PUBLIC_SHIRT, quantity: 1, requested: 1, available: 28, lineTotal: 22500 }], itemCount: 1, subtotal: 22500, deliveryFee: 2500, total: 25000, freeDeliveryAbove: 50000 }];
    fb.handlers["POST /store-orders/elijahapparel/checkout"] = () => [201, { order: { trackingNo: "BM-7K2Q-9MXA" }, authorizationUrl: "https://checkout.paystack.com/abc", reference: "BMS-1" }];
    const user = userEvent.setup();
    renderApp("/s/elijahapparel/checkout");
    await user.type(await screen.findByLabelText(/full name/i), "Ada Nwosu");
    await user.type(screen.getByLabelText(/email address/i), "ada@example.com");
    await user.type(screen.getByLabelText(/phone number/i), "+234 803 222 0180");
    await user.type(screen.getByLabelText(/delivery address/i), "14 Adebayo St, Yaba");
    await user.type(screen.getByLabelText(/^city/i), "Yaba");
    await user.type(screen.getByLabelText(/^state/i), "Lagos");
    await user.click(screen.getByRole("button", { name: /review order/i }));
    expect(await screen.findByTestId("review-email")).toHaveTextContent("ada@example.com");
    expect(last("POST /store-orders/elijahapparel/checkout")).toBeUndefined();
    await user.click(screen.getByRole("button", { name: /confirm and pay with paystack/i }));
    await waitFor(() => expect(assigned).toBe("https://checkout.paystack.com/abc"));
    const call = last("POST /store-orders/elijahapparel/checkout")!;
    expect(call.body).toMatchObject({ customerName: "Ada Nwosu", customerEmail: "ada@example.com", city: "Yaba", state: "Lagos" });
    expect(call.headers["X-Session-ID"]).toBe("4f1c2a6e-9b1d-4c3e-8f2a-1234567890ab");
  });

  it("08.15: while Paystack isn't set up, checkout says payments are coming soon", async () => {
    fb.handlers["GET /store/elijahapparel"] = () => [200, { ...PUBLIC_STORE, acceptingOrders: false, paymentsComingSoon: true }];
    fb.handlers["GET /cart/elijahapparel"] = () => [200, { items: [{ product: PUBLIC_SHIRT, quantity: 1, requested: 1, available: 28, lineTotal: 22500 }], itemCount: 1, subtotal: 22500, deliveryFee: 2500, total: 25000, freeDeliveryAbove: null }];
    renderApp("/s/elijahapparel/checkout");
    expect(await screen.findByText(/online payment is coming soon/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /review order|confirm and pay/i })).toBeNull();
    expect(screen.getByRole("link", { name: "shop@example.com" })).toHaveAttribute("href", "mailto:shop@example.com");
  });

  const ORDER = { trackingNo: "BM-7K2Q-9MXA", status: "payment_confirmed", isPaid: true, customerName: "Ada", customerEmail: "ada@example.com", deliveryAddress: "14 Adebayo St", city: "Yaba", state: "Lagos", items: [], subtotal: 22500, deliveryFee: 2500, total: 25000, statusHistory: [], createdAt: "2026-11-12T09:00:00Z", store: { storeName: "Elijah Apparel", storeSlug: "elijahapparel", contactEmail: null, contactPhone: null } };

  it("08.17: a confirmed payment shows the order and links to tracking", async () => {
    fb.handlers["POST /store-orders/verify-payment"] = () => [200, { status: "paid", order: ORDER }];
    renderApp("/s/elijahapparel/payment?reference=BMS-1&trxref=BMS-1");
    expect(await screen.findByRole("heading", { name: "Payment successful" })).toBeInTheDocument();
    expect(last("POST /store-orders/verify-payment")?.body).toEqual({ reference: "BMS-1" });
    expect(screen.getAllByRole("link", { name: "Track order" }).map((a) => a.getAttribute("href"))).toContain("/s/elijahapparel/track?order=BM-7K2Q-9MXA");
  });

  it("08.18: a failed payment can be retried on the same order", async () => {
    fb.handlers["POST /store-orders/verify-payment"] = () => [200, { status: "failed", order: { ...ORDER, isPaid: false, status: "payment_failed" } }];
    fb.handlers["POST /store-orders/elijahapparel/orders/BM-7K2Q-9MXA/retry"] = () => [200, { order: ORDER, authorizationUrl: "https://checkout.paystack.com/retry" }];
    const user = userEvent.setup();
    renderApp("/s/elijahapparel/payment?reference=BMS-1");
    await user.click(await screen.findByRole("button", { name: "Retry payment" }));
    await waitFor(() => expect(assigned).toBe("https://checkout.paystack.com/retry"));
    expect(last("POST /store-orders/elijahapparel/orders/BM-7K2Q-9MXA/retry")?.body).toEqual({ email: "ada@example.com" });
  });

  it("08.16: a payment still processing offers to check again", async () => {
    fb.handlers["POST /store-orders/verify-payment"] = () => [200, { status: "pending", order: { ...ORDER, isPaid: false, status: "pending" } }];
    renderApp("/s/elijahapparel/payment?reference=BMS-1");
    expect(await screen.findByRole("heading", { name: "Verifying your payment" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /check payment status/i })).toBeInTheDocument();
  });

  it("08.19: tracking needs the order number and the email", async () => {
    fb.handlers["GET /store-orders/track"] = (_b, _h, url) => (url.searchParams.get("email") === "ada@example.com" ? [200, { ...ORDER, status: "shipped" }] : [404, { message: "We couldn't find that order. Check the order number and email." }]);
    const user = userEvent.setup();
    renderApp("/s/elijahapparel/track?order=BM-7K2Q-9MXA");
    expect(await screen.findByLabelText(/order number/i)).toHaveValue("BM-7K2Q-9MXA");
    await user.type(screen.getByLabelText(/email used/i), "wrong@example.com");
    await user.click(screen.getByRole("button", { name: "Track" }));
    expect(await screen.findByText(/couldn't find that order/i)).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/email used/i));
    await user.type(screen.getByLabelText(/email used/i), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Track" }));
    expect(await screen.findByText(/^Dispatched/)).toHaveTextContent(/Dispatched.*done/);
  });

  it("a draft store is private, but its owner gets a read-only preview", async () => {
    fb.handlers["GET /store/elijahapparel"] = () => [404, { message: "Store not found" }];
    renderApp("/s/elijahapparel");
    expect(await screen.findByRole("heading", { name: "This store isn't available" })).toBeInTheDocument();
  });

  it("the owner previewing their draft sees their products and can't buy", async () => {
    tokenStore.set("tok");
    fb.handlers["GET /store/elijahapparel"] = () => [404, { message: "Store not found" }];
    renderApp("/s/elijahapparel/products/p1");
    expect(await screen.findByText(/only you can see this store/i)).toBeInTheDocument();
    expect(await screen.findByText(/preview only: buying is turned off/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add to bag/i })).toBeNull();
  });
});

describe("merchant store orders", () => {
  const ORDER = {
    _id: "o1",
    trackingNo: "BM-7K2Q-9MXA",
    customerName: "Ada Nwosu",
    customerEmail: "ada@example.com",
    customerPhone: "+234 803 222 0180",
    deliveryAddress: "14 Adebayo St",
    city: "Yaba",
    state: "Lagos",
    items: [{ product: "p1", productName: "Classic linen shirt", price: 22500, quantity: 2, total: 45000 }],
    subtotal: 45000,
    deliveryFee: 2500,
    total: 47500,
    commissionRate: 3,
    commissionAmount: 1425,
    vendorPayout: 46075,
    status: "payment_confirmed",
    isPaid: true,
    paidAt: "2026-11-12T09:05:00Z",
    statusHistory: [{ status: "payment_confirmed", at: "2026-11-12T09:05:00Z" }],
    createdAt: "2026-11-12T09:00:00Z",
    nextStatuses: ["processing", "shipped", "cancelled"],
  };

  it("lists orders; status filter and search go to the API and stay in the URL", async () => {
    fb.handlers["GET /store-orders/my-orders"] = () => [200, { orders: [ORDER], total: 1, page: 1, totalPages: 1 }];
    const user = userEvent.setup();
    const router = renderApp("/store/orders");
    expect(await screen.findByRole("link", { name: "BM-7K2Q-9MXA" })).toHaveAttribute("href", "/store/orders/o1");
    expect(screen.getByText("New · paid")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Shipped" }));
    await user.type(screen.getByRole("searchbox", { name: /search store orders/i }), "ada{Enter}");
    await waitFor(() => expect(router.state.location.search).toContain("status=shipped"));
    expect(router.state.location.search).toContain("q=ada");
    const lastList = [...fb.calls].reverse().find((c) => c.key === "GET /store-orders/my-orders");
    expect(lastList).toBeTruthy();
  });

  it("detail: earnings, customer contact, mark shipped; Back to Online Store", async () => {
    let current: Record<string, unknown> = ORDER;
    fb.handlers["GET /store-orders/o1"] = () => [200, current];
    fb.handlers["PUT /store-orders/o1/status"] = (b) => ((current = { ...ORDER, status: b.status, nextStatuses: ["delivered"] }), [200, current]);
    const user = userEvent.setup();
    renderApp("/store/orders/o1");
    expect(await screen.findByRole("heading", { name: "Order BM-7K2Q-9MXA" })).toBeInTheDocument();
    expect(screen.getByText("₦46,075")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /email ada@example.com/i }).getAttribute("href")).toMatch(/^mailto:ada@example\.com/);
    expect(screen.getByRole("link", { name: /call \+234/i })).toHaveAttribute("href", "tel:+2348032220180");
    expect(screen.getByTestId("back-to-screen")).toHaveTextContent("Back to Online Store");
    await user.click(screen.getByRole("button", { name: "Mark shipped" }));
    await waitFor(() => expect(last("PUT /store-orders/o1/status")?.body).toEqual({ status: "shipped" }));
    expect(await screen.findByRole("button", { name: "Mark delivered" })).toBeInTheDocument();
  });

  it("cancelling a paid order confirms first, returns stock and flags the refund", async () => {
    fb.handlers["GET /store-orders/o1"] = () => [200, ORDER];
    fb.handlers["PUT /store-orders/o1/status"] = () => [200, { ...ORDER, status: "cancelled", earningsReversed: true, nextStatuses: [], refundNeeded: true }];
    const user = userEvent.setup();
    renderApp("/store/orders/o1");
    await user.click(await screen.findByRole("button", { name: "Cancel order" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/back into stock.*refund them from your Paystack dashboard/)).toBeInTheDocument();
    expect(last("PUT /store-orders/o1/status")).toBeUndefined();
    await user.click(within(dialog).getByRole("button", { name: "Cancel order" }));
    await waitFor(() => expect(last("PUT /store-orders/o1/status")?.body).toEqual({ status: "cancelled" }));
    expect(await screen.findByText("Refund needed")).toBeInTheDocument();
    expect(screen.getByText(/Refund ₦47,500 to Ada Nwosu/)).toBeInTheDocument();
  });

  it("an unpaid order warns not to send anything and only offers cancel", async () => {
    fb.handlers["GET /store-orders/o1"] = () => [200, { ...ORDER, status: "pending", isPaid: false, paidAt: null, nextStatuses: ["cancelled"] }];
    renderApp("/store/orders/o1");
    expect(await screen.findByText(/hasn't been paid. Don't send anything yet/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mark/i })).toBeNull();
    expect(screen.getByRole("button", { name: "Cancel order" })).toBeInTheDocument();
  });
});

describe("email typos, review step and tracking states", () => {
  beforeEach(() => {
    tokenStore.clear();
    fb.handlers["GET /store/elijahapparel"] = () => [200, PUBLIC_STORE];
    fb.handlers["GET /cart/elijahapparel"] = () => [200, { items: [{ product: PUBLIC_SHIRT, quantity: 1, requested: 1, available: 28, lineTotal: 22500 }], itemCount: 1, subtotal: 22500, deliveryFee: 0, total: 22500, freeDeliveryAbove: null }];
  });

  const fill = async (user: ReturnType<typeof userEvent.setup>, email: string) => {
    await user.type(await screen.findByLabelText(/full name/i), "Elijah Ayanlere");
    await user.type(screen.getByLabelText(/email address/i), email);
    await user.type(screen.getByLabelText(/phone number/i), "+234 904 534 8114");
    await user.type(screen.getByLabelText(/delivery address/i), "12 Allen Avenue");
    await user.type(screen.getByLabelText(/^city/i), "Ikeja");
    await user.type(screen.getByLabelText(/^state/i), "Lagos");
  };

  it("checkout suggests the right domain for a typo, and one tap fixes it", async () => {
    const user = userEvent.setup();
    renderApp("/s/elijahapparel/checkout");
    await fill(user, "elijahayanlere3@gmaiul.com");
    const hint = await screen.findByTestId("email-suggestion");
    expect(hint).toHaveTextContent("Did you mean elijahayanlere3@gmail.com?");
    await user.click(within(hint).getByRole("button", { name: "elijahayanlere3@gmail.com" }));
    expect(screen.getByLabelText(/email address/i)).toHaveValue("elijahayanlere3@gmail.com");
    expect(screen.queryByTestId("email-suggestion")).toBeNull();
  });

  it("the review step asks to confirm the email, warns about a typo, and Back returns to the details", async () => {
    const user = userEvent.setup();
    const router = renderApp("/s/elijahapparel/checkout");
    await fill(user, "elijahayanlere3@gmaiul.com");
    await user.click(screen.getByRole("button", { name: /review order/i }));
    await waitFor(() => expect(router.state.location.search).toBe("?step=review"));
    expect(screen.getByRole("heading", { name: "Is this your email?" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Did you mean elijahayanlere3@gmail.com?");
    await user.click(screen.getByRole("button", { name: "Use elijahayanlere3@gmail.com" }));
    expect(screen.getByTestId("review-email")).toHaveTextContent("elijahayanlere3@gmail.com");

    await user.click(screen.getByRole("button", { name: "Edit details" }));
    await waitFor(() => expect(router.state.location.search).toBe(""));
    expect(await screen.findByLabelText(/email address/i)).toHaveValue("elijahayanlere3@gmail.com");
    expect(screen.getByLabelText(/full name/i)).toHaveValue("Elijah Ayanlere");
  });

  it("sign-up suggests the right domain too", async () => {
    tokenStore.clear();
    const user = userEvent.setup();
    renderApp("/register");
    await user.type(await screen.findByLabelText(/work email/i), "ada@gmial.com");
    expect(await screen.findByTestId("email-suggestion")).toHaveTextContent("Did you mean ada@gmail.com?");
  });

  const TRACKED = { trackingNo: "BM-WYYZ-KJDF", status: "pending", isPaid: false, customerName: "Elijah", customerEmail: "elijahayanlere3@gmail.com", deliveryAddress: "12 Allen Avenue", city: "Ikeja", state: "Lagos", items: [], subtotal: 5000, deliveryFee: 0, total: 5000, statusHistory: [], createdAt: "2026-11-12T21:57:00Z", store: { storeName: "Elijah Apparel", storeSlug: "elijahapparel", contactEmail: null, contactPhone: null } };

  it("tracking an expired unpaid order says so plainly, with no pay button", async () => {
    fb.handlers["GET /store-orders/track"] = () => [200, { ...TRACKED, status: "expired", payment: { state: "expired", holdExpiresAt: null, canRetryPayment: false } }];
    const user = userEvent.setup();
    renderApp("/s/elijahapparel/track?order=BM-WYYZ-KJDF");
    await user.type(await screen.findByLabelText(/email used/i), "elijahayanlere3@gmail.com");
    await user.click(screen.getByRole("button", { name: "Track" }));
    expect(await screen.findByText("This order wasn't paid and has expired")).toBeInTheDocument();
    expect(screen.getByText(/Your bag was released/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pay now|try payment again/i })).toBeNull();
    expect(screen.getByRole("link", { name: "Shop again" })).toBeInTheDocument();
    expect(screen.queryByText(/^Dispatched/)).toBeNull();
  });

  it("an unpaid order still within its hold can be paid from tracking, with the email typed", async () => {
    fb.handlers["GET /store-orders/track"] = () => [200, { ...TRACKED, payment: { state: "awaiting_payment", holdExpiresAt: "2026-11-12T22:27:00Z", canRetryPayment: true } }];
    fb.handlers["POST /store-orders/elijahapparel/orders/BM-WYYZ-KJDF/retry"] = () => [200, { order: TRACKED, authorizationUrl: "https://checkout.paystack.com/again" }];
    const user = userEvent.setup();
    renderApp("/s/elijahapparel/track");
    await user.type(await screen.findByLabelText(/order number/i), "bm wyyz kjdf");
    await user.type(screen.getByLabelText(/email used/i), "  ElijahAyanlere3@Gmail.com ");
    await user.click(screen.getByRole("button", { name: "Track" }));
    expect(await screen.findByText(/held until 23:27/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Pay now" }));
    await waitFor(() => expect(assigned).toBe("https://checkout.paystack.com/again"));
    expect(last("POST /store-orders/elijahapparel/orders/BM-WYYZ-KJDF/retry")?.body).toEqual({ email: "ElijahAyanlere3@Gmail.com" });
  });

  it("not found tells the shopper what to check", async () => {
    fb.handlers["GET /store-orders/track"] = () => [404, { message: "We couldn't find an order with that number and email. Check the order number in your confirmation email (it starts with BM-) and the email you typed at checkout, including its spelling." }];
    const user = userEvent.setup();
    renderApp("/s/elijahapparel/track?order=BM-WYYZ-KJDF");
    await user.type(await screen.findByLabelText(/email used/i), "elijahayanlere3@gmail.com");
    await user.click(screen.getByRole("button", { name: "Track" }));
    expect(await screen.findByText(/including its spelling/)).toBeInTheDocument();
  });
});

describe("merchant store polish", () => {
  it("the products page says it's loading instead of flashing 0 products", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    fb.handlers["GET /store/products"] = () => [200, [SHIRT]];
    const original = globalThis.fetch;
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      if (String(url).includes("/store/products")) await gate;
      return original(url, init);
    });
    renderApp("/store/products");
    expect(await screen.findByText("Loading your products…")).toBeInTheDocument();
    expect(screen.queryByText(/^0 products/)).toBeNull();
    release();
    expect(await screen.findByText("1 product · 1 published")).toBeInTheDocument();
  });

  it("a test-mode payment is labelled on the order", async () => {
    fb.handlers["GET /store-orders/o1"] = () => [200, { _id: "o1", trackingNo: "BM-WYYZ-KJDF", customerName: "Elijah", customerEmail: "e@x.com", deliveryAddress: "x", items: [], subtotal: 5000, deliveryFee: 0, total: 5000, status: "shipped", isPaid: true, paymentMode: "test", statusHistory: [], createdAt: "2026-11-12T21:57:00Z", nextStatuses: ["delivered"] }];
    renderApp("/store/orders/o1");
    expect(await screen.findByText("Test payment (no money moved)")).toBeInTheDocument();
  });
});

describe("store analytics with test payments", () => {
  it("revenue and orders that include test payments are labelled TEST", async () => {
    fb.handlers["GET /store/analytics"] = () => [200, { range: { key: "30d", from: "2026-10-14", to: "2026-11-12", days: 30 }, revenue: 140650, revenueChange: null, orders: 3, ordersChange: null, fulfilled: 3, averageOrderValue: 46883, cancelled: 0, storeViews: 10, productViews: 5, topProduct: null, topProducts: [], series: [], payouts: { pending: 0, available: 0 }, test: { revenue: 140650, orders: 3 } }];
    renderApp("/store/analytics");
    const revenue = (await screen.findByRole("heading", { name: /revenue/i, level: 3 })).closest("section")!;
    expect(within(revenue).getByTestId("kpi-badge")).toHaveTextContent("TEST");
    expect(within(revenue).getByText("Includes ₦140,650 from test payments: not real money.")).toBeInTheDocument();
    expect(screen.getByText("Includes 3 test orders.")).toBeInTheDocument();
  });
});
