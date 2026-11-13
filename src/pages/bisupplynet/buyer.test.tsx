import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { browser } from "@/lib/store/api";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";
import { installFakeSockets } from "@/test/fakeSocket";

// BiSupplyNet, buying (Figma 10.01, 10.02, 10.05–10.11).

const PREMIUM = { plan: "premium", status: "active", features: { bisupplynet: true, bisupplynetSell: true, messages: true } };
const SUPPLIER = { _id: "w1", businessName: "Apex Agro Supplies", category: "agricultural_food", categories: ["agricultural_food"], state: "Lagos", city: "Ikeja", trustScore: 94, averageRating: 4.8, totalReviews: 37, deliveryCapability: "state", deliveryTimeline: "3-5 business days" };
const DETAIL = (over = {}) => ({ ...SUPPLIER, completedOrders: 128, rating: { average: 4.8, count: 37 }, responseTime: 4, memberSince: "2026-01-01", cacVerified: true, activityMetrics: { totalOrders: 130, completedOrders: 128, completionRate: 98, disputeRate: 1, refundedOrders: 0, trustScore: 94 }, ...over });
const PRODUCT = { _id: "p1", name: "Premium rice 50kg", description: "Long grain rice", category: "agricultural_food", images: [], pricePerUnit: 64000, minimumOrderQuantity: 10, unit: "bags", availableQuantity: 100, deliveryCapability: "state", isAvailable: true, wholesaler: SUPPLIER };
const ORDER = {
  _id: "o1",
  trackingNo: "BSN-0812",
  productName: "Premium rice 50kg",
  pricePerUnit: 64000,
  quantity: 10,
  totalAmount: 640000,
  status: "shipped",
  deliveryAddress: "14 Adebayo Street, Yaba",
  receivingBusiness: null,
  contactPhone: null,
  isPaid: true,
  paidAt: "2026-11-10T10:10:00Z",
  paymentMode: "live",
  isDeliveryConfirmed: false,
  cancelReason: null,
  shippedAt: "2026-11-11T09:00:00Z",
  deliveredAt: null,
  expectedBy: null,
  createdAt: "2026-11-10T10:00:00Z",
};
const DETAIL_ORDER = (over: Record<string, unknown> = {}, order: Record<string, unknown> = {}) => ({
  role: "buyer",
  order: { ...ORDER, ...order },
  product: { _id: "p1", name: "Premium rice 50kg", image: null, unit: "bags" },
  seller: SUPPLIER,
  timeline: [
    { status: "pending", label: "Order placed, waiting for payment", at: "2026-11-10T10:00:00Z", by: "buyer" },
    { status: "payment_confirmed", label: "Payment held in escrow", at: "2026-11-10T10:10:00Z", by: "system" },
    { status: "shipped", label: "Shipped", at: "2026-11-11T09:00:00Z", by: "wholesaler" },
  ],
  escrow: { status: "held", moneyState: "Escrow", totalAmount: 640000, heldAmount: 640000, releasedAt: null, refundAmount: 0, refundStatus: "none", autoReleaseAt: null },
  shippedAt: "2026-11-11T09:00:00Z",
  deliveredAt: null,
  expectedBy: null,
  allowedActions: ["confirm_delivery", "dispute", "message"],
  dispute: null,
  conversationId: "c1",
  ...over,
});

let fb: FakeBackend;
let sockets: ReturnType<typeof installFakeSockets>;
const last = (key: string) => [...fb.calls].reverse().find((c) => c.key === key);
const urls: string[] = [];
let uploads = 0;

beforeEach(() => {
  tokenStore.set("tok");
  serverStatus.set("up");
  fb = installFakeBackend();
  sockets = installFakeSockets();
  urls.length = 0;
  uploads = 0;
  fb.handlers["GET /subscriptions/current"] = () => [200, PREMIUM];
  fb.handlers["GET /bisupplynet/wholesalers"] = (_b, _h, url) => {
    urls.push(url.search);
    const cat = url.searchParams.get("category");
    const list = [SUPPLIER, { ...SUPPLIER, _id: "w2", businessName: "Nova Textiles", category: "raw_materials", state: "Kano", trustScore: 95 }];
    return [200, { wholesalers: cat ? list.filter((s) => s.category === cat) : list, total: 2, page: 1, totalPages: 1 }];
  };
  fb.handlers["GET /bisupplynet/wholesalers/w1"] = () => [200, DETAIL()];
  fb.handlers["GET /bisupplynet/wholesalers/w1/products"] = () => [200, { wholesaler: SUPPLIER, products: [PRODUCT, { ...PRODUCT, _id: "p2", name: "Produce crates", pricePerUnit: 18500, minimumOrderQuantity: 20, unit: "crates" }], total: 2, page: 1, totalPages: 1 }];
  fb.handlers["GET /bisupplynet/products/p1"] = () => [200, PRODUCT];
  fb.handlers["GET /bisupplynet/orders/o1"] = () => [200, DETAIL_ORDER()];
  fb.handlers["POST /upload/attachment"] = () => [200, { url: `https://res.cloudinary.com/demo/image/upload/e${++uploads}.png`, name: `photo-${uploads}.png`, type: "image/png", size: 2048 }];
});
afterEach(() => {
  sockets.restore();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  tokenStore.clear();
  localStorage.clear();
});

describe("10.01 find suppliers", () => {
  it("lists verified suppliers and filters by category, search and trust", async () => {
    const user = userEvent.setup();
    renderApp("/bisupplynet/suppliers");
    const list = await screen.findByRole("list", { name: "Suppliers" });
    expect(within(list).getByRole("link", { name: "Apex Agro Supplies" })).toHaveAttribute("href", "/bisupplynet/suppliers/w1");
    expect(within(list).getByText("94% trust")).toBeInTheDocument();
    expect(within(list).getByText("Nova Textiles")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Category"), "raw_materials");
    await waitFor(() => expect(urls.at(-1)).toContain("category=raw_materials"));
    await waitFor(() => expect(screen.queryByText("Apex Agro Supplies")).toBeNull());

    await user.selectOptions(screen.getByLabelText("Trust score"), "90");
    await user.type(screen.getByLabelText("Search"), "cotton");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(urls.at(-1)).toMatch(/search=cotton/));
    expect(urls.at(-1)).toMatch(/minTrust=90/);
  });
});

describe("10.02 supplier profile", () => {
  it("shows trust, catalogue with order links, and sends a connection request", async () => {
    fb.handlers["POST /bisupplynet/connect/w1"] = () => [201, { message: "Connection request sent" }];
    const user = userEvent.setup();
    renderApp("/bisupplynet/suppliers/w1");
    expect(await screen.findByRole("heading", { name: "Apex Agro Supplies" })).toBeInTheDocument();
    expect(screen.getByText(/Trust 94% • 128 orders fulfilled • 4.8-star buyer rating/)).toBeInTheDocument();
    expect(screen.getByText("Within 4 hours")).toBeInTheDocument();
    const catalogue = await screen.findByRole("list", { name: "Wholesale catalogue" });
    expect(within(catalogue).getByText("₦18,500")).toBeInTheDocument();
    expect(within(catalogue).getByRole("link", { name: /order premium rice 50kg/i })).toHaveAttribute("href", "/bisupplynet/checkout/p1");

    await user.click(screen.getByRole("button", { name: "Request connection" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/message/i), "Quote for 50 bags please");
    await user.click(within(dialog).getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(last("POST /bisupplynet/connect/w1")?.body).toEqual({ message: "Quote for 50 bags please" }));
    expect(await within(dialog).findByText("Request sent")).toBeInTheDocument();
  });

  it("a supplier not taking orders: calm note, no order or connection actions, no catalogue call", async () => {
    fb.handlers["GET /bisupplynet/wholesalers/w1"] = () => [200, DETAIL({ takingOrders: false })];
    renderApp("/bisupplynet/suppliers/w1");
    expect(await screen.findByText("This supplier isn't taking new orders right now. Your existing orders aren't affected.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Request connection" })).toBeNull();
    expect(document.querySelector("a[href^=\"/bisupplynet/checkout\"]")).toBeNull();
    expect(last("GET /bisupplynet/wholesalers/w1/products")).toBeUndefined();
  });

  it("an older server without takingOrders counts as taking orders", async () => {
    renderApp("/bisupplynet/suppliers/w1");
    expect(await screen.findByRole("button", { name: "Request connection" })).toBeInTheDocument();
    expect(screen.queryByText(/isn't taking new orders/)).toBeNull();
  });

  it("submits a buyer review for the supplier", async () => {
    fb.handlers["POST /bisupplynet/reviews"] = () => [201, { _id: "r1" }];
    const user = userEvent.setup();
    renderApp("/bisupplynet/suppliers/w1");
    await user.click(await screen.findByRole("radio", { name: "4 stars" }));
    await user.type(screen.getByLabelText("Your experience"), "Fast and well packed");
    await user.click(screen.getByRole("button", { name: "Submit review" }));
    await waitFor(() => expect(last("POST /bisupplynet/reviews")?.body).toEqual({ wholesalerId: "w1", rating: 4, comment: "Fast and well packed" }));
    expect(await screen.findByText(/Your review is saved/)).toBeInTheDocument();
  });
});

describe("10.06 checkout", () => {
  it("checks the minimum order, then places the order and goes to Paystack", async () => {
    let go = "";
    vi.spyOn(browser, "go").mockImplementation((u: string) => void (go = u));
    fb.handlers["POST /bisupplynet/orders"] = () => [201, { ...ORDER, status: "pending", isPaid: false }];
    fb.handlers["POST /escrow/pay/o1"] = () => [200, { authorizationUrl: "https://checkout.paystack.com/abc", reference: "BSN-PAY-1" }];
    const user = userEvent.setup();
    renderApp("/bisupplynet/checkout/p1");
    const qty = await screen.findByLabelText(/quantity/i);
    await user.clear(qty);
    await user.type(qty, "5");
    await user.click(screen.getByRole("button", { name: "Review and pay" }));
    expect(await screen.findByText("The minimum order is 10 bags.")).toBeInTheDocument();
    expect(last("POST /bisupplynet/orders")).toBeUndefined();

    await user.clear(qty);
    await user.type(qty, "12");
    expect(screen.getByLabelText("Items total")).toHaveValue("₦768,000");
    await user.type(screen.getByLabelText(/delivery address/i), "14 Adebayo Street, Yaba");
    await user.type(screen.getByLabelText(/contact phone/i), "0803 555 0190");
    await user.click(screen.getByRole("button", { name: "Review and pay" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Pay ₦768,000 into escrow/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Pay securely" }));
    await waitFor(() => expect(go).toBe("https://checkout.paystack.com/abc"));
    expect(last("POST /bisupplynet/orders")?.body).toEqual({ productId: "p1", quantity: 12, deliveryAddress: "14 Adebayo Street, Yaba", contactPhone: "0803 555 0190" });
  });

  it("payments not set up yet: the order is kept and the order page says payments are coming soon", async () => {
    fb.handlers["POST /bisupplynet/orders"] = () => [201, { ...ORDER, status: "pending", isPaid: false }];
    fb.handlers["POST /escrow/pay/o1"] = () => [503, { paymentsUnavailable: true, message: "Online payments aren't available yet." }];
    fb.handlers["GET /bisupplynet/orders/o1"] = () => [200, DETAIL_ORDER({ allowedActions: ["pay", "message"] }, { status: "pending", isPaid: false })];
    const user = userEvent.setup();
    const router = renderApp("/bisupplynet/checkout/p1");
    await user.type(await screen.findByLabelText(/delivery address/i), "14 Adebayo Street, Yaba");
    await user.click(screen.getByRole("button", { name: "Review and pay" }));
    await user.click(await screen.findByRole("button", { name: "Pay securely" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/bisupplynet/orders/o1"));
    expect(await screen.findByText(/online payments are coming soon/i)).toBeInTheDocument();
  });
});

describe("payment return and order tracking (10.07 / 10.08)", () => {
  it("verifies the payment once and shows the protected escrow state", async () => {
    fb.handlers["POST /escrow/verify-payment"] = () => [200, { result: "paid", message: "Payment confirmed.", order: ORDER }];
    fb.handlers["GET /bisupplynet/orders/o1"] = () => [200, DETAIL_ORDER({ allowedActions: ["message"] }, { status: "payment_confirmed", shippedAt: null })];
    const user = userEvent.setup();
    const router = renderApp("/bisupplynet/orders/o1?payment=success&trxref=BSN-PAY-1&reference=BSN-PAY-1");
    expect(await screen.findByRole("heading", { name: "Buyer protection is active" })).toBeInTheDocument();
    expect(fb.calls.filter((c) => c.key === "POST /escrow/verify-payment")).toHaveLength(1);
    expect(last("POST /escrow/verify-payment")?.body).toEqual({ reference: "BSN-PAY-1" });
    expect(screen.getByText("Protected")).toBeInTheDocument();
    expect(screen.getAllByText("₦640,000").length).toBeGreaterThan(0);
    await user.click(screen.getAllByRole("button", { name: "Track bulk order" })[0]!);
    await waitFor(() => expect(router.state.location.search).toBe(""));
    expect(await screen.findByRole("heading", { name: "Wholesale order BSN-0812" })).toBeInTheDocument();
  });

  it("a payment still processing offers to check again", async () => {
    fb.handlers["POST /escrow/verify-payment"] = () => [202, { result: "pending", message: "Payment is still processing.", order: null }];
    renderApp("/bisupplynet/orders/o1?payment=success&reference=R2");
    expect(await screen.findByText(/still confirming your payment/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check again" })).toBeInTheDocument();
  });

  it("shows only the buttons allowedActions permits", async () => {
    fb.handlers["GET /bisupplynet/orders/o1"] = () => [200, DETAIL_ORDER({ allowedActions: ["confirm_delivery", "message"] })];
    renderApp("/bisupplynet/orders/o1");
    expect(await screen.findByRole("link", { name: "Confirm received goods" })).toHaveAttribute("href", "/bisupplynet/orders/o1/confirm");
    expect(screen.getByRole("link", { name: "Contact supplier" })).toHaveAttribute("href", "/messages/c1");
    expect(screen.queryByRole("link", { name: "Report a problem" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^pay/i })).toBeNull();
  });

  it("an unpaid order offers payment only; no message action means no contact button", async () => {
    fb.handlers["GET /bisupplynet/orders/o1"] = () => [200, DETAIL_ORDER({ allowedActions: ["pay"] }, { status: "pending", isPaid: false })];
    renderApp("/bisupplynet/orders/o1");
    expect(await screen.findByRole("button", { name: "Pay ₦640,000 securely" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Confirm received goods" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Report a problem" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Contact supplier" })).toBeNull();
  });

  it("the buyer never sees the seller's share or the commission, even if the API sent them", async () => {
    const leaky = DETAIL_ORDER({ escrow: { status: "held", moneyState: "Escrow", totalAmount: 640000, heldAmount: 640000, releasedAt: null, refundAmount: 0, refundStatus: "none", autoReleaseAt: null, sellerShare: 620800, commission: 19200, commissionRate: 3 } });
    fb.handlers["GET /bisupplynet/orders/o1"] = () => [200, leaky];
    renderApp("/bisupplynet/orders/o1");
    await screen.findByRole("heading", { name: "Wholesale order BSN-0812" });
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/620,800|19,200|your share|commission|% fee|BiManage fee/i);
  });
});

describe("10.09 confirm delivery", () => {
  it("asks in a dialog, then releases the payment", async () => {
    fb.handlers["PUT /bisupplynet/orders/o1/confirm-delivery"] = () => [200, { message: "Delivery confirmed." }];
    const user = userEvent.setup();
    const router = renderApp("/bisupplynet/orders/o1/confirm");
    expect(await screen.findByRole("heading", { name: "Confirm receipt of this order" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/commission|% fee/i);
    await user.click(screen.getAllByRole("button", { name: "Confirm delivery" })[0]!);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Release ₦640,000 to Apex Agro Supplies?")).toBeInTheDocument();
    expect(last("PUT /bisupplynet/orders/o1/confirm-delivery")).toBeUndefined();
    await user.click(within(dialog).getByRole("button", { name: "Yes, release payment" }));
    await waitFor(() => expect(last("PUT /bisupplynet/orders/o1/confirm-delivery")).toBeDefined());
    await waitFor(() => expect(router.state.location.pathname).toBe("/bisupplynet/orders/o1"));
    expect(await screen.findByText(/Delivery confirmed. The payment is released/)).toBeInTheDocument();
  });

  it("someone who can't release money is told why, with no button", async () => {
    fb.handlers["GET /bisupplynet/orders/o1"] = () => [200, DETAIL_ORDER({ allowedActions: ["dispute", "message"] })];
    renderApp("/bisupplynet/orders/o1/confirm");
    expect(await screen.findByText(/Only the business owner or an admin can confirm delivery/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm delivery" })).toBeNull();
  });
});

describe("10.10 file a dispute", () => {
  it("has the case fields, takes up to 5 files, refuses the wrong type and files the dispute", async () => {
    fb.handlers["POST /disputes"] = () => [201, { dispute: { _id: "d1" }, reference: "DSP-0042", conversationId: "c1" }];
    fb.handlers["GET /disputes/d1"] = () => [200, DISPUTE()];
    const user = userEvent.setup({ applyAccept: false });
    const router = renderApp("/bisupplynet/orders/o1/dispute");
    expect(await screen.findByRole("heading", { name: "Report an order issue" })).toBeInTheDocument();
    for (const label of [/dispute reason/i, "Order reference", "Date received", /affected quantity/i, /amount disputed/i, /description/i, "Requested resolution"]) expect(screen.getByLabelText(label)).toBeInTheDocument();
    expect(screen.getByLabelText("Order reference")).toHaveValue("BSN-0812");

    const input = screen.getByLabelText("Add supporting evidence");
    await user.upload(input, new File(["x"], "notes.txt", { type: "text/plain" }));
    expect(await screen.findByText("notes.txt isn't a JPG, PNG, WebP or PDF file.")).toBeInTheDocument();
    const photos = Array.from({ length: 6 }, (_, i) => new File(["x"], `bag-${i}.png`, { type: "image/png" }));
    await user.upload(input, photos);
    expect(await screen.findByText("You can attach up to 5 files.")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Attached files" })).getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByRole("button", { name: "File limit reached" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Submit dispute" }));
    expect(await screen.findByText("Choose what went wrong.")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/dispute reason/i), "damaged_defective_item");
    await user.type(screen.getByLabelText(/affected quantity/i), "2");
    await user.type(screen.getByLabelText(/amount disputed/i), "128000");
    await user.selectOptions(screen.getByLabelText("Requested resolution"), "partial_refund");
    await user.type(screen.getByLabelText(/description/i), "Two bags arrived torn and wet.");
    await user.click(screen.getByRole("button", { name: "Submit dispute" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/bisupplynet/disputes/d1"));
    const body = last("POST /disputes")!.body as Record<string, unknown>;
    expect(body).toMatchObject({ orderId: "o1", reason: "damaged_defective_item", description: "Two bags arrived torn and wet.", affectedQuantity: 2, amountDisputed: 128000, requestedResolution: "partial_refund" });
    expect(body.evidence).toHaveLength(5);
    expect(await screen.findByText(/Dispute opened/)).toBeInTheDocument();
  });

  it("an order that can't be disputed says why", async () => {
    fb.handlers["GET /bisupplynet/orders/o1"] = () => [200, DETAIL_ORDER({ allowedActions: ["message"], dispute: { id: "d1", status: "open" } })];
    renderApp("/bisupplynet/orders/o1/dispute");
    expect(await screen.findByText("A dispute is already open")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View dispute" })).toHaveAttribute("href", "/bisupplynet/disputes/d1");
  });
});

const DISPUTE = (over: Record<string, unknown> = {}) => ({
  _id: "d1",
  reference: "DSP-0042",
  reason: "damaged_defective_item",
  description: "Two bags arrived torn and wet.",
  status: "open",
  createdAt: "2026-10-24T10:00:00Z",
  role: "buyer",
  evidenceFiles: [{ url: "https://res.cloudinary.com/demo/image/upload/a.png", name: "torn-bag.png", type: "image/png", by: "client" }],
  responses: [{ _id: "r1", by: "vendor", message: "We will check the dispatch photos.", createdAt: "2026-10-24T12:00:00Z" }],
  order: { _id: "o1", trackingNo: "BSN-0812", productName: "Premium rice 50kg", quantity: 10, totalAmount: 640000, status: "disputed" },
  escrow: { status: "frozen", moneyState: "In dispute", totalAmount: 640000, heldAmount: 640000, frozenAmount: 640000, releasedAt: null, refundAmount: 0, refundStatus: "none", autoReleaseAt: null, outcome: null },
  conversationId: "c1",
  evidenceLimit: { perParty: 5, used: 1 },
  ...over,
});

describe("10.11 dispute review", () => {
  it("adds evidence and sends a reply", async () => {
    fb.handlers["GET /disputes/d1"] = () => [200, DISPUTE()];
    fb.handlers["POST /disputes/d1/evidence"] = () => [201, { evidence: [], remaining: 3 }];
    fb.handlers["POST /disputes/d1/respond"] = () => [200, { message: "ok" }];
    const user = userEvent.setup();
    renderApp("/bisupplynet/disputes/d1");
    expect(await screen.findByRole("heading", { name: "Dispute case DSP-0042" })).toBeInTheDocument();
    expect(screen.getByText("We will check the dispatch photos.")).toBeInTheDocument();
    expect(screen.getByText("4 of 5 files left for you")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add evidence" }));
    const dialog = await screen.findByRole("dialog");
    await user.upload(within(dialog).getByLabelText("Add evidence"), new File(["x"], "label.png", { type: "image/png" }));
    await user.click(await within(dialog).findByRole("button", { name: "Add 1 file" }));
    await waitFor(() => expect((last("POST /disputes/d1/evidence")!.body as { evidence: unknown[] }).evidence).toHaveLength(1));

    await user.type(screen.getByLabelText("Your reply"), "Here is the waybill.");
    await user.click(screen.getByRole("button", { name: "Send reply" }));
    await waitFor(() => expect(last("POST /disputes/d1/respond")?.body).toEqual({ message: "Here is the waybill." }));
    expect(document.body.textContent).not.toMatch(/commission|your share/i);
  });

  it("a resolved dispute takes no more evidence or replies", async () => {
    fb.handlers["GET /disputes/d1"] = () => [200, DISPUTE({ status: "resolved_partial", escrow: { ...DISPUTE().escrow, status: "partially_refunded", moneyState: "Partially refunded", outcome: "partial", refundAmount: 128000 } })];
    renderApp("/bisupplynet/disputes/d1");
    expect(await screen.findByText(/Partial refund of ₦128,000/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add evidence" })).toBeNull();
    expect(screen.queryByLabelText("Your reply")).toBeNull();
  });
});
