import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";
import { installFakeSockets } from "@/test/fakeSocket";

// BiSupplyNet, selling (Figma 10.03, 10.04, 10.12), plus plan and permission
// gates, navigation, team permissions and layout rules.

const PREMIUM = { plan: "premium", status: "active", features: { bisupplynet: true, bisupplynetSell: true } };
const STANDARD = { plan: "standard", status: "active", features: { bisupplynet: true, bisupplynetSell: false } };
const FREE = { plan: "freemium", status: "active", features: { bisupplynet: false, bisupplynetSell: false } };
const PRODUCT = { _id: "p1", name: "Premium rice 50kg", description: "Long grain rice, 50kg bags", category: "agricultural_food", images: [], pricePerUnit: 64000, minimumOrderQuantity: 10, unit: "bag", availableQuantity: 100, deliveryCapability: "state", isAvailable: true, wholesaler: "w1" };
const PROFILE = (over: Record<string, unknown> = {}) => ({
  _id: "w1",
  businessName: "Apex Agro Supplies Ltd",
  category: "agricultural_food",
  categories: ["agricultural_food"],
  state: "Lagos",
  city: "Ikeja",
  businessAddress: "18 Allen Avenue, Ikeja",
  businessEmail: "trade@apexagro.ng",
  businessPhone: "+2348031234567",
  cacNumber: "RC1234567",
  minimumOrderQuantity: 10,
  deliveryCapability: "state",
  status: "pending",
  reference: "BSN-APP-0282",
  profileScore: 76,
  breakdown: [{ key: "businessName", label: "Registered business name", points: 10, earned: 10 }],
  rejectionReason: null,
  submittedAt: "2026-11-12T10:00:00Z",
  ...over,
});
const SELLER_ORDER = (over: Record<string, unknown> = {}) => ({
  role: "seller",
  order: { _id: "o2", trackingNo: "BSN-0813", productName: "Premium rice 50kg", pricePerUnit: 64000, quantity: 10, totalAmount: 640000, status: "payment_confirmed", deliveryAddress: "14 Adebayo Street, Yaba", receivingBusiness: "Elijah Apparel Ltd", contactPhone: null, isPaid: true, paidAt: "2026-11-12T10:00:00Z", paymentMode: "live", isDeliveryConfirmed: false, cancelReason: null, shippedAt: null, deliveredAt: null, expectedBy: null, createdAt: "2026-11-12T09:00:00Z" },
  product: { _id: "p1", name: "Premium rice 50kg", image: null, unit: "bags" },
  seller: { _id: "w1", businessName: "Apex Agro Supplies Ltd", category: "agricultural_food" },
  buyer: { name: "Elijah", avatar: null, businessName: "Elijah Apparel Ltd" },
  timeline: [{ status: "payment_confirmed", label: "Payment held in escrow", at: "2026-11-12T10:00:00Z", by: "system" }],
  escrow: { status: "held", moneyState: "Escrow", totalAmount: 640000, heldAmount: 640000, releasedAt: null, refundAmount: 0, refundStatus: "none", autoReleaseAt: null, sellerShare: 620800, commission: 19200, commissionRate: 3 },
  shippedAt: null,
  deliveredAt: null,
  expectedBy: null,
  allowedActions: ["processing", "shipped", "cancelled", "message"],
  dispute: null,
  conversationId: null,
  ...over,
});
const BOOK = (over = {}) => ({ held: 640000, released: { allTime: 1450000, last30d: 555000 }, orderValue30d: 2100000, commission30d: 63000, refunded30d: 0, recentPayouts: [{ orderId: "o9", trackingNo: "BSN-0810", productName: "Rice", totalAmount: 185000, sellerShare: 179450, refundAmount: 0, status: "completed", orderState: "Confirmed", moneyState: "Released", paidAt: null, releasedAt: null }], ...over });
const DASH = (mode: "live" | "test") => ({
  profile: { businessName: "Apex", verificationStatus: "verified", trustScore: 94, averageRating: 4.8, totalReviews: 37 },
  stats: { totalOrders: 4, completedOrders: 2, pendingOrders: 1, processingOrders: 1, totalProducts: 2, availableProducts: 2 },
  earnings: { currentMode: mode, live: BOOK(), test: BOOK({ held: 50000, released: { allTime: 12000, last30d: 12000 }, orderValue30d: 62000, recentPayouts: [] }), trustScore: 94, profileScore: 76, walletLink: "/wallet" },
});

let fb: FakeBackend;
let sockets: ReturnType<typeof installFakeSockets>;
const last = (key: string) => [...fb.calls].reverse().find((c) => c.key === key);
let uploads = 0;

beforeEach(() => {
  tokenStore.set("tok");
  serverStatus.set("up");
  fb = installFakeBackend();
  sockets = installFakeSockets();
  uploads = 0;
  fb.handlers["GET /subscriptions/current"] = () => [200, PREMIUM];
  fb.handlers["GET /bisupplynet/my-profile"] = () => [200, PROFILE({ status: "verified" })];
  fb.handlers["POST /upload/attachment"] = () => [200, { url: `https://res.cloudinary.com/demo/raw/upload/doc${++uploads}.pdf`, name: "cac-certificate.pdf", type: "application/pdf", size: 4096 }];
});
afterEach(() => {
  sockets.restore();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  tokenStore.clear();
  localStorage.clear();
});

describe("10.03 / 10.04 wholesaler application", () => {
  it("shows the live score, uploads the document, submits, then shows the application in review", async () => {
    let profile: ReturnType<typeof PROFILE> | null = null;
    fb.handlers["GET /bisupplynet/my-profile"] = () => (profile ? [200, profile] : [404, { message: "You are not a wholesaler yet" }]);
    const previews: URLSearchParams[] = [];
    fb.handlers["GET /bisupplynet/application/preview-score"] = (_b, _h, url) => {
      previews.push(url.searchParams);
      const named = url.searchParams.has("businessName");
      return [200, { profileScore: named ? 76 : 10, breakdown: [{ key: "businessName", label: "Registered business name", points: 10, earned: named ? 10 : 0 }], autoApprove: false, cacValid: false, documentUploaded: url.searchParams.has("verificationDocument"), threshold: 70, reviewReasons: ["No verification document"] }];
    };
    fb.handlers["POST /bisupplynet/apply"] = () => {
      profile = PROFILE();
      return [201, { message: "Application submitted.", status: "pending", reference: "BSN-APP-0282", profileScore: 76, breakdown: [], reviewReasons: [] }];
    };
    const user = userEvent.setup();
    const router = renderApp("/bisupplynet/sell");
    await waitFor(() => expect(router.state.location.pathname).toBe("/bisupplynet/sell/apply"));
    expect(await screen.findByRole("heading", { name: "Apply as a wholesaler" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Profile trust score")).toHaveValue("10%"));

    await user.type(screen.getByLabelText(/registered business name/i), "Apex Agro Supplies Ltd");
    await waitFor(() => expect(screen.getByLabelText("Profile trust score")).toHaveValue("76%"));
    await user.upload(screen.getByLabelText("Add verification document"), new File(["%PDF"], "cac.pdf", { type: "application/pdf" }));
    expect(await screen.findByText("cac-certificate.pdf")).toBeInTheDocument();
    await waitFor(() => expect(previews.at(-1)?.get("verificationDocument")).toBe("https://res.cloudinary.com/demo/raw/upload/doc1.pdf"));

    await user.type(screen.getByLabelText(/cac registration number/i), "RC 1234567");
    await user.selectOptions(screen.getByLabelText(/supply category/i), "agricultural_food");
    await user.type(screen.getByLabelText(/state \/ region/i), "Lagos");
    await user.type(screen.getByLabelText(/^city/i), "Ikeja");
    await user.type(screen.getByLabelText(/business address/i), "18 Allen Avenue, Ikeja");
    await user.type(screen.getByLabelText(/email address/i), "trade@apexagro.ng");
    await user.type(screen.getByLabelText(/business phone/i), "0803 123 4567");
    await user.type(screen.getByLabelText(/usual minimum order/i), "10");
    await user.click(screen.getByRole("button", { name: "Submit application" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/bisupplynet/sell/application"));
    expect(last("POST /bisupplynet/apply")?.body).toMatchObject({
      businessName: "Apex Agro Supplies Ltd",
      cacNumber: "RC 1234567",
      category: "agricultural_food",
      state: "Lagos",
      city: "Ikeja",
      phone: "0803 123 4567",
      minimumOrderQuantity: 10,
      verificationDocument: { url: "https://res.cloudinary.com/demo/raw/upload/doc1.pdf", name: "cac-certificate.pdf", type: "application/pdf" },
    });
    expect(await screen.findByRole("heading", { name: "Application in review" })).toBeInTheDocument();
    expect(screen.getByText("BSN-APP-0282")).toBeInTheDocument();
    expect(screen.getByText("In review")).toBeInTheDocument();
  });

  it("a rejected applicant sees the reason and can apply again with their details filled in", async () => {
    fb.handlers["GET /bisupplynet/my-profile"] = () => [200, PROFILE({ status: "rejected", rejectionReason: "The CAC document was unreadable." })];
    fb.handlers["GET /bisupplynet/application/preview-score"] = () => [200, { profileScore: 76, breakdown: [], autoApprove: false, cacValid: true, documentUploaded: false, threshold: 70, reviewReasons: [] }];
    fb.handlers["POST /bisupplynet/apply"] = () => [201, { message: "ok", status: "pending", reference: "BSN-APP-0300", profileScore: 76, breakdown: [], reviewReasons: [] }];
    const user = userEvent.setup();
    const router = renderApp("/bisupplynet/sell/application");
    expect(await screen.findByRole("heading", { name: "Application not approved" })).toBeInTheDocument();
    expect(screen.getAllByText("The CAC document was unreadable.").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("link", { name: "Apply again" }));
    expect(await screen.findByRole("heading", { name: "Apply again as a wholesaler" })).toBeInTheDocument();
    expect(screen.getByLabelText(/registered business name/i)).toHaveValue("Apex Agro Supplies Ltd");
    await user.click(screen.getByRole("button", { name: "Submit application" }));
    await waitFor(() => expect(last("POST /bisupplynet/apply")?.body).toMatchObject({ businessName: "Apex Agro Supplies Ltd", phone: "+2348031234567" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/bisupplynet/sell/application"));
  });
});

describe("listings", () => {
  it("adds a listing with a photo", async () => {
    fb.handlers["GET /bisupplynet/products/my-products"] = () => [200, []];
    fb.handlers["POST /bisupplynet/products"] = (b) => [201, { ...PRODUCT, ...b, _id: "np1" }];
    fb.handlers["POST /upload/supply-product/np1"] = () => [200, { image: "https://res.cloudinary.com/demo/image/upload/rice.png", images: [] }];
    const user = userEvent.setup({ applyAccept: false });
    const router = renderApp("/bisupplynet/sell/listings/new");
    await user.type(await screen.findByLabelText(/product name/i), "Premium rice 50kg");
    await user.selectOptions(screen.getByLabelText(/^category/i), "agricultural_food");
    await user.type(screen.getByLabelText(/price per unit/i), "64000");
    await user.type(screen.getByLabelText(/^unit/i), "bag");
    await user.clear(screen.getByLabelText(/minimum order quantity/i));
    await user.type(screen.getByLabelText(/minimum order quantity/i), "10");
    await user.type(screen.getByLabelText(/stock available/i), "100");
    await user.type(screen.getByLabelText(/description/i), "Long grain rice, 50kg bags");
    await user.upload(screen.getByLabelText("Add product photos"), [new File(["x"], "rice.png", { type: "image/png" }), new File(["x"], "price-list.pdf", { type: "application/pdf" })]);
    expect(await screen.findByText("price-list.pdf isn't a JPG, PNG or WebP photo.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Publish listing" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/bisupplynet/sell/listings"));
    expect(last("POST /bisupplynet/products")?.body).toEqual({ name: "Premium rice 50kg", description: "Long grain rice, 50kg bags", category: "agricultural_food", pricePerUnit: 64000, unit: "bag", minimumOrderQuantity: 10, availableQuantity: 100, isAvailable: true });
    expect(fb.calls.filter((c) => c.key === "POST /upload/supply-product/np1")).toHaveLength(1);
  });

  it("edits a listing", async () => {
    fb.handlers["GET /bisupplynet/products/p1"] = () => [200, PRODUCT];
    fb.handlers["PUT /bisupplynet/products/p1"] = (b) => [200, { ...PRODUCT, ...b }];
    fb.handlers["GET /bisupplynet/products/my-products"] = () => [200, [PRODUCT]];
    const user = userEvent.setup();
    const router = renderApp("/bisupplynet/sell/listings/p1/edit");
    const price = await screen.findByLabelText(/price per unit/i);
    expect(price).toHaveValue(64000);
    await user.clear(price);
    await user.type(price, "62000");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/bisupplynet/sell/listings"));
    expect(last("PUT /bisupplynet/products/p1")?.body).toMatchObject({ pricePerUnit: 62000, name: "Premium rice 50kg", images: [] });
  });

  it("a listing with open orders can't be deleted: it offers to hide it instead", async () => {
    fb.handlers["GET /bisupplynet/products/my-products"] = () => [200, [PRODUCT]];
    fb.handlers["DELETE /bisupplynet/products/p1"] = () => [409, { message: "This product has 2 open orders, so it can't be deleted yet.", openOrders: 2, suggestion: { isAvailable: false } }];
    fb.handlers["PUT /bisupplynet/products/p1"] = (b) => [200, { ...PRODUCT, ...b }];
    const user = userEvent.setup();
    renderApp("/bisupplynet/sell/listings");
    await user.click(await screen.findByRole("button", { name: "Delete Premium rice 50kg" }));
    await user.click(await screen.findByRole("button", { name: "Delete listing" }));
    expect(await screen.findByRole("heading", { name: "This listing has open orders" })).toBeInTheDocument();
    expect(screen.getByText(/has 2 open orders, so it can't be deleted yet/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hide it instead" }));
    await waitFor(() => expect(last("PUT /bisupplynet/products/p1")?.body).toEqual({ isAvailable: false }));
    expect(await screen.findByText(/is hidden from buyers/)).toBeInTheDocument();
  });
});

describe("seller order status", () => {
  it("shows the steps allowedActions gives, and warns that cancelling refunds the buyer", async () => {
    fb.handlers["GET /bisupplynet/orders/o2"] = () => [200, SELLER_ORDER()];
    fb.handlers["PUT /bisupplynet/orders/o2/status"] = () => [200, {}];
    const user = userEvent.setup();
    renderApp("/bisupplynet/orders/o2");
    expect(await screen.findByRole("heading", { name: "Wholesale order BSN-0813" })).toBeInTheDocument();
    expect(screen.getByText("Your share")).toBeInTheDocument();
    expect(screen.getByText("₦620,800")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark delivered" })).toBeNull();
    expect(screen.queryByRole("link", { name: /contact buyer/i })).toHaveAttribute("href", "/messages");

    await user.click(screen.getByRole("button", { name: "Mark processing" }));
    await waitFor(() => expect(last("PUT /bisupplynet/orders/o2/status")?.body).toEqual({ status: "processing" }));

    await user.click(screen.getByRole("button", { name: "Cancel order" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/The buyer paid ₦640,000. Cancelling refunds them in full/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancel and refund" }));
    await waitFor(() => expect(last("PUT /bisupplynet/orders/o2/status")?.body).toEqual({ status: "cancelled" }));
  });

  it("marking shipped can carry an expected delivery date", async () => {
    fb.handlers["GET /bisupplynet/orders/o2"] = () => [200, SELLER_ORDER({ allowedActions: ["shipped", "cancelled", "message"] }, )];
    fb.handlers["PUT /bisupplynet/orders/o2/status"] = () => [200, {}];
    const user = userEvent.setup();
    renderApp("/bisupplynet/orders/o2");
    await user.type(await screen.findByLabelText(/expected delivery date/i), "2099-12-01");
    await user.click(screen.getByRole("button", { name: "Mark shipped" }));
    await waitFor(() => expect(last("PUT /bisupplynet/orders/o2/status")?.body).toEqual({ status: "shipped", expectedBy: "2099-12-01" }));
  });
});

describe("10.12 earnings", () => {
  it("test mode is labelled as test money that can't be withdrawn", async () => {
    fb.handlers["GET /bisupplynet/dashboard"] = () => [200, DASH("test")];
    renderApp("/bisupplynet/sell/earnings");
    expect(await screen.findByText("Test payments: not withdrawable.")).toBeInTheDocument();
    expect(screen.getAllByTestId("kpi-badge").map((b) => b.textContent)).toEqual(["TEST", "TEST", "TEST"]);
    expect(screen.getByText("₦62k")).toBeInTheDocument(); // test order value, not live
    expect(screen.queryByRole("link", { name: "Withdraw from Wallet" })).toBeNull();
  });

  it("live mode shows live figures and links to the Wallet", async () => {
    fb.handlers["GET /bisupplynet/dashboard"] = () => [200, DASH("live")];
    renderApp("/bisupplynet/sell/earnings");
    expect(await screen.findByText("₦2.1m")).toBeInTheDocument();
    expect(screen.getByText("₦640k")).toBeInTheDocument();
    expect(screen.getByText("₦1.45m")).toBeInTheDocument();
    expect(screen.queryByText(/not withdrawable/)).toBeNull();
    expect(screen.queryByTestId("kpi-badge")).toBeNull();
    expect(screen.getByRole("link", { name: "Withdraw from Wallet" })).toHaveAttribute("href", "/wallet");
    expect(within(screen.getByRole("list", { name: "Recent payouts" })).getByText("BSN-0810")).toBeInTheDocument();
  });

  it("the old notification link /bisupplynet/dashboard lands on selling", async () => {
    fb.handlers["GET /bisupplynet/dashboard"] = () => [200, DASH("live")];
    const router = renderApp("/bisupplynet/dashboard");
    await waitFor(() => expect(router.state.location.pathname).toBe("/bisupplynet/sell/earnings"));
  });
});

describe("connection requests", () => {
  it("accepts a request", async () => {
    fb.handlers["GET /bisupplynet/connect/incoming"] = () => [200, [{ _id: "cr1", client: { _id: "u9", name: "Elijah Apparel" }, message: "Quote for 50 bags?", status: "pending", createdAt: "2026-11-12T10:00:00Z" }]];
    fb.handlers["PUT /bisupplynet/connect/cr1/respond"] = () => [200, { message: "Connection accepted" }];
    const user = userEvent.setup();
    renderApp("/bisupplynet/sell/connections");
    await user.click(await screen.findByRole("button", { name: "Accept Elijah Apparel" }));
    await waitFor(() => expect(last("PUT /bisupplynet/connect/cr1/respond")?.body).toEqual({ status: "accepted" }));
  });
});

describe("plans, permissions and navigation", () => {
  const navLink = () => screen.queryAllByRole("link", { name: /^BiSupplyNet/ });

  it("a teammate who can only sell sees BiSupplyNet in the menu and lands on selling", async () => {
    fb.handlers["GET /settings/my-role"] = () => [200, { role: "manager", permissions: { viewDashboard: true, accessBiSupplyNet: false, sellOnBiSupplyNet: true }, businessId: "b1" }];
    fb.handlers["GET /bisupplynet/dashboard"] = () => [200, DASH("live")];
    const router = renderApp("/bisupplynet");
    await waitFor(() => expect(router.state.location.pathname).toBe("/bisupplynet/sell/earnings"));
    expect(navLink().length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Suppliers" })).toBeNull();
  });

  it("a teammate with neither permission doesn't see BiSupplyNet", async () => {
    fb.handlers["GET /settings/my-role"] = () => [200, { role: "staff", permissions: { viewDashboard: true, accessBiSupplyNet: false, sellOnBiSupplyNet: false }, businessId: "b1" }];
    renderApp("/bisupplynet");
    expect(await screen.findByText("You don't have permission for this")).toBeInTheDocument();
    expect(navLink()).toHaveLength(0);
  });

  it("a buyer-only teammate is told selling needs permission", async () => {
    fb.handlers["GET /settings/my-role"] = () => [200, { role: "staff", permissions: { accessBiSupplyNet: true, sellOnBiSupplyNet: false }, businessId: "b1" }];
    renderApp("/bisupplynet/sell/listings");
    expect(await screen.findByText(/Your role doesn't let you sell on BiSupplyNet/)).toBeInTheDocument();
    expect(last("GET /bisupplynet/products/my-products")).toBeUndefined();
  });

  it("Standard can buy but sees the Premium upgrade on selling pages", async () => {
    fb.handlers["GET /subscriptions/current"] = () => [200, STANDARD];
    renderApp("/bisupplynet/sell/apply");
    expect(await screen.findByText("Selling on BiSupplyNet needs the Premium plan")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Compare plans" })).toHaveAttribute("href", "/subscription/plans");
    expect(screen.getByRole("link", { name: "Find suppliers" })).toBeInTheDocument();
    expect(last("GET /bisupplynet/my-profile")).toBeUndefined();
  });

  it("Freemium sees an upgrade page", async () => {
    fb.handlers["GET /subscriptions/current"] = () => [200, FREE];
    renderApp("/bisupplynet/suppliers");
    expect(await screen.findByText("BiSupplyNet isn't included in your plan")).toBeInTheDocument();
    expect(last("GET /bisupplynet/wholesalers")).toBeUndefined();
  });

  it("team permissions show the buy and sell toggles", async () => {
    renderApp("/settings/team/invite");
    expect(await screen.findByRole("checkbox", { name: /sell on bisupplynet/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /buy from wholesalers/i })).toBeInTheDocument();
  });
});

describe("layout and copy rules", () => {
  const dir = resolve(__dirname);
  const sources = readdirSync(dir)
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f))
    .map((f) => [f, readFileSync(join(dir, f), "utf8")] as const)
    .concat([["api.ts", readFileSync(resolve(__dirname, "../../lib/bisupplynet/api.ts"), "utf8")]]);
  const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

  it("grids use minmax(0, …) columns and nothing is wider than the screen", () => {
    for (const [file, src] of sources) {
      for (const m of src.matchAll(/grid-cols-\[([^\]]+)\]/g)) {
        const cols = m[1]!.replace(/repeat\(\d+,/g, "").split("_");
        for (const c of cols) expect(`${file}: ${c}`).toMatch(/: minmax\(0,/);
      }
      expect(`${file}: ${src.match(/\bw-max\b|overflow-x-auto|min-w-\[|\bw-\[\d{3,}px\]/)?.[0] ?? ""}`).toBe(`${file}: `);
    }
  });

  it("no em or en dashes in the copy", () => {
    for (const [file, src] of sources) expect(`${file}: ${(code(src).match(/.*[–—].*/) ?? [""])[0]}`).toBe(`${file}: `);
  });
});
