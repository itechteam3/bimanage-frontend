import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { installFakeBackend, renderApp, testQueryClient, type FakeBackend } from "@/test/fakeBackend";
import { installFakeSockets } from "@/test/fakeSocket";
import { matchesTopics } from "./topics";
import { realtimeConfig } from "./RealtimeProvider";
import { _resetVersionCheck, fetchDeployedVersion, markOutdated } from "@/lib/version";
import { reloader } from "@/components/feedback/VersionBanner";

// Live updates in the app: server events refresh the right screens, missed
// events are caught up, and nothing overwrites what the user is typing.
// (Who may receive which event is enforced and tested on the server:
// bimanage-backend tests/realtime.test.js.)

const ORDER = {
  _id: "o1",
  trackingNo: "ORD-7K2Q9M",
  items: [{ product: "p1", name: "Linen shirt", quantity: 2, unitPrice: 25000, total: 50000 }],
  customer: { name: "Amina Yusuf", email: "amina@example.com" },
  paymentMethod: "transfer",
  paymentStatus: "pending",
  fulfilmentStatus: "unfulfilled",
  status: "pending",
  canCancel: true,
  subtotal: 50000,
  deliveryFee: 5000,
  totalAmount: 55000,
  createdAt: "2026-11-12T09:00:00Z",
};
const NEW_ORDER = { ...ORDER, _id: "o2", trackingNo: "ORD-NEW123", customer: { name: "Bola Ade", email: "bola@example.com" } };
const SHIRT = { _id: "p1", name: "Classic linen shirt", category: "Clothing", sku: "APP-101", barcode: "8901234567890", sellingPrice: 22500, stockQuantity: 28, totalSold: 4, lowStockThreshold: 10 };

let fb: FakeBackend;
let sockets: ReturnType<typeof installFakeSockets>;
const saved = { ...realtimeConfig };
let orders: unknown[];
const count = (key: string) => fb.calls.filter((c) => c.key === key).length;
const pause = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));

beforeEach(() => {
  tokenStore.set("tok");
  serverStatus.set("up");
  fb = installFakeBackend();
  sockets = installFakeSockets();
  realtimeConfig.batchMs = 50;
  orders = [ORDER];
  fb.handlers["GET /subscriptions/current"] = () => [200, { plan: "standard", status: "active", features: { orders: true, invoices: true, analytics: true, inventory: true } }];
  fb.handlers["GET /orders"] = () => [200, orders];
  fb.handlers["GET /orders/stats"] = () => [200, { all: 1, awaitingPayment: 1, unfulfilled: 1, completed: 0, cancelled: 0, revenue: 0 }];
  fb.handlers["GET /inventory/products"] = () => [200, [SHIRT]];
});
afterEach(() => {
  Object.assign(realtimeConfig, saved);
  sockets.restore();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  tokenStore.clear();
  _resetVersionCheck();
});

/** Open the orders screen with the live connection up. */
async function openOrders() {
  renderApp("/orders");
  expect(await screen.findByText("ORD-7K2Q9M")).toBeInTheDocument();
  await waitFor(() => expect(sockets.latest()).toBeTruthy());
  const socket = sockets.latest()!;
  socket.fire("connect");
  return socket;
}

describe("topic → screens", () => {
  it("maps each topic to the queries it can change, and leaves reference data alone", () => {
    expect(matchesTopics(["store", "orders", "all", "", 1], ["storeOrders"])).toBe(true);
    expect(matchesTopics(["store", "order", "x"], ["storeOrders"])).toBe(true);
    expect(matchesTopics(["inventory", "products"], ["storeOrders"])).toBe(false);
    expect(matchesTopics(["store", "products"], ["inventory"])).toBe(true);
    expect(matchesTopics(["wallet", "txs", {}], ["wallet"])).toBe(true);
    expect(matchesTopics(["wallet", "banks"], ["wallet"])).toBe(false);
    expect(matchesTopics(["unread"], ["notifications"])).toBe(true);
    expect(matchesTopics(["orders", "list"], ["nonsense" as never])).toBe(false);
  });
});

describe("event-driven refresh", () => {
  it("connects with the session token to the server root", async () => {
    const socket = await openOrders();
    const auth = socket.opts.auth as (cb: (d: object) => void) => void;
    let sent: object = {};
    auth((d) => (sent = d));
    expect(sent).toEqual({ token: "tok" });
  });

  it("a new order from someone else appears, highlighted, with 'Updated just now'", async () => {
    const socket = await openOrders();
    orders = [NEW_ORDER, ORDER];
    socket.fire("bm:change", { topic: "orders", at: new Date().toISOString(), by: "someone-else" });
    const row = (await screen.findByText("ORD-NEW123")).closest("tr")!;
    expect(row).toHaveAttribute("data-new", "true");
    expect(screen.getByText("ORD-7K2Q9M").closest("tr")).not.toHaveAttribute("data-new");
    expect(screen.getByText("Updated just now")).toBeInTheDocument();
  });

  it("only the matching screens refresh, and a burst of events refetches once", async () => {
    const socket = await openOrders();
    const before = count("GET /orders");
    socket.fire("bm:change", { topic: "invoices", at: "" });
    socket.fire("bm:change", { topic: "team", at: "" });
    await pause(150);
    expect(count("GET /orders")).toBe(before);

    for (let i = 0; i < 5; i++) socket.fire("bm:change", { topic: "orders", at: "" });
    await waitFor(() => expect(count("GET /orders")).toBe(before + 1));
    await pause(150);
    expect(count("GET /orders")).toBe(before + 1);
  });

  it("our own change echoed back isn't fetched twice; the same user in another tab still updates", async () => {
    const socket = await openOrders();
    const before = count("GET /orders");
    // Another tab (no change made here): refresh.
    socket.fire("bm:change", { topic: "orders", at: "", by: "u1" });
    await waitFor(() => expect(count("GET /orders")).toBe(before + 1));
    // A change just made in this tab (its mutation already refreshed the screen).
    await act(() => testQueryClient!.getMutationCache().build(testQueryClient!, { mutationFn: async () => 1 }).execute(undefined));
    socket.fire("bm:change", { topic: "orders", at: "", by: "u1" });
    await pause(150);
    expect(count("GET /orders")).toBe(before + 1);
  });

  it("role or membership changed: reloads who we are, then every screen", async () => {
    const socket = await openOrders();
    const me = count("GET /auth/me");
    const list = count("GET /orders");
    socket.fire("bm:change", { topic: "team", at: "", action: "membership" });
    await waitFor(() => expect(count("GET /auth/me")).toBe(me + 1));
    await waitFor(() => expect(count("GET /orders")).toBe(list + 1));
  });
});

describe("fallbacks", () => {
  it("first connect doesn't refetch; a reconnect catches up once", async () => {
    const socket = await openOrders();
    const before = count("GET /orders");
    await pause(100);
    expect(count("GET /orders")).toBe(before);
    socket.fire("disconnect", "transport close");
    socket.fire("connect");
    await waitFor(() => expect(count("GET /orders")).toBe(before + 1));
  });

  it("socket down + tab visible: the open screen refreshes on a timer; hidden tabs don't poll", async () => {
    realtimeConfig.fallbackPollMs = 120;
    renderApp("/orders");
    expect(await screen.findByText("ORD-7K2Q9M")).toBeInTheDocument();
    // Never connected (server unreachable).
    const before = count("GET /orders");
    await waitFor(() => expect(count("GET /orders")).toBeGreaterThan(before), { timeout: 2000 });

    const vis = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await pause(150);
    const hidden = count("GET /orders");
    await pause(400);
    expect(count("GET /orders")).toBe(hidden);
    vis.mockRestore();
  });

  it("no polling while the socket is up", async () => {
    realtimeConfig.fallbackPollMs = 100;
    await openOrders();
    const before = count("GET /orders");
    await pause(400);
    expect(count("GET /orders")).toBe(before);
  });

  it("coming back to a tab hidden for a while refreshes once", async () => {
    realtimeConfig.staleAfterHiddenMs = 50;
    await openOrders();
    const before = count("GET /orders");
    const vis = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    await pause(100);
    vis.mockReturnValue("visible");
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    await waitFor(() => expect(count("GET /orders")).toBe(before + 1));
    vis.mockRestore();
  });

  it("signing out closes the connection", async () => {
    const socket = await openOrders();
    act(() => {
      tokenStore.clear();
      window.dispatchEvent(new StorageEvent("storage", { key: tokenStore.key }));
    });
    await waitFor(() => expect(socket.closed).toBe(true));
  });
});

describe("never overwrite what the user is typing", () => {
  it("a live refresh of the product being edited keeps the edited field and updates the rest", async () => {
    let server = { ...SHIRT };
    fb.handlers["GET /inventory/products/p1"] = () => [200, server];
    fb.handlers["GET /inventory/products/p1/adjustments"] = () => [200, []];
    renderApp("/inventory/products/p1");
    const user = userEvent.setup();
    const name = await screen.findByLabelText(/product name/i);
    await waitFor(() => expect(name).toHaveValue("Classic linen shirt"));
    await waitFor(() => expect(sockets.latest()).toBeTruthy());
    sockets.latest()!.fire("connect");

    await user.clear(name);
    await user.type(name, "Linen shirt (new season)");
    server = { ...SHIRT, name: "Renamed elsewhere", sellingPrice: 24000 };
    sockets.latest()!.fire("bm:change", { topic: "inventory", at: "", by: "someone-else" });
    await waitFor(() => expect(screen.getByLabelText(/selling price/i)).toHaveValue("24000"));
    expect(name).toHaveValue("Linen shirt (new season)");
  });
});

describe("shopper pages follow the order live", () => {
  const PUBLIC_STORE = { _id: "s1", storeName: "Elijah Apparel", storeSlug: "elijahapparel", description: "", category: "fashion", template: "basic", contactEmail: null, deliveryFee: 2500, freeDeliveryAbove: 50000, acceptingOrders: true, paymentsComingSoon: false };
  const SHOP_ORDER = { trackingNo: "BM-7K2Q-9MXA", status: "pending", isPaid: false, customerName: "Ada", customerEmail: "ada@example.com", deliveryAddress: "14 Adebayo St", city: "Yaba", state: "Lagos", items: [], subtotal: 22500, deliveryFee: 2500, total: 25000, statusHistory: [], createdAt: "2026-11-12T09:00:00Z", store: { storeName: "Elijah Apparel", storeSlug: "elijahapparel", contactEmail: null, contactPhone: null } };
  beforeEach(() => {
    tokenStore.clear();
    fb.handlers["GET /store/elijahapparel"] = () => [200, PUBLIC_STORE];
    fb.handlers["GET /store/elijahapparel/products"] = () => [200, { products: [], total: 0, page: 1, totalPages: 1 }];
  });

  it("payment page: shows 'successful' the moment the store confirms, no button press", async () => {
    let result = { status: "pending", order: SHOP_ORDER };
    fb.handlers["POST /store-orders/verify-payment"] = () => [200, result];
    renderApp("/s/elijahapparel/payment?reference=BMS-1");
    expect(await screen.findByRole("heading", { name: "Verifying your payment" })).toBeInTheDocument();
    await waitFor(() => expect(sockets.latest("/shop")).toBeTruthy());
    const shop = sockets.latest("/shop")!;
    shop.acks.track = () => ({ ok: true, status: "pending", isPaid: false });
    shop.fire("connect");
    expect(shop.sent[0]?.slice(0, 2)).toEqual(["track", { orderNumber: "BM-7K2Q-9MXA", email: "ada@example.com" }]);

    result = { status: "paid", order: { ...SHOP_ORDER, isPaid: true, status: "payment_confirmed" } };
    shop.fire("order:update", { status: "payment_confirmed", isPaid: true, at: "" });
    expect(await screen.findByRole("heading", { name: "Payment successful" })).toBeInTheDocument();
    await waitFor(() => expect(shop.closed).toBe(true)); // paid: stops following
  });

  it("tracking page: a status change shows without searching again", async () => {
    let order = { ...SHOP_ORDER, isPaid: true, status: "payment_confirmed" };
    fb.handlers["GET /store-orders/track"] = (_b, _h, url) => (url.searchParams.get("email") === "ada@example.com" ? [200, order] : [404, { message: "not found" }]);
    const user = userEvent.setup();
    renderApp("/s/elijahapparel/track?order=BM-7K2Q-9MXA");
    await user.type(await screen.findByLabelText(/email used/i), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Track" }));
    expect(await screen.findByText(/^Dispatched/)).not.toHaveTextContent(/done/);
    await waitFor(() => expect(sockets.latest("/shop")).toBeTruthy());
    const shop = sockets.latest("/shop")!;
    shop.acks.track = () => ({ ok: true });
    shop.fire("connect");
    expect(shop.sent[0]?.[1]).toEqual({ orderNumber: "BM-7K2Q-9MXA", email: "ada@example.com" });

    order = { ...order, status: "shipped" };
    shop.fire("order:update", { status: "shipped", isPaid: true, at: "" });
    await waitFor(() => expect(screen.getByText(/^Dispatched/)).toHaveTextContent(/Dispatched.*done/));
  });

  it("nothing is followed before the shopper proves number + email", async () => {
    renderApp("/s/elijahapparel/track?order=BM-7K2Q-9MXA");
    expect(await screen.findByLabelText(/email used/i)).toBeInTheDocument();
    await pause(100);
    expect(sockets.latest("/shop")).toBeUndefined();
  });
});

describe("new version", () => {
  it("reads the deployed build id; anything unexpected counts as unknown", async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify({ version: "abc123" }), { status: 200 }));
    expect(await fetchDeployedVersion(ok as unknown as typeof fetch)).toBe("abc123");
    const html = vi.fn(async () => new Response("<!doctype html>", { status: 200 }));
    expect(await fetchDeployedVersion(html as unknown as typeof fetch)).toBeNull();
    const down = vi.fn(async () => Promise.reject(new Error("offline")));
    expect(await fetchDeployedVersion(down as unknown as typeof fetch)).toBeNull();
  });

  it("offers a reload, and reloads by itself on the next page change", async () => {
    const reload = vi.spyOn(reloader, "reload").mockImplementation(() => undefined);
    const router = renderApp("/orders");
    expect(await screen.findByText("ORD-7K2Q9M")).toBeInTheDocument();
    expect(screen.queryByText(/new version of BiManage/i)).not.toBeInTheDocument();
    act(() => markOutdated());
    expect(await screen.findByText("A new version of BiManage is available.")).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
    await act(() => router.navigate("/inventory/products"));
    expect(reload).toHaveBeenCalledTimes(1);
    await userEvent.setup().click(screen.getByRole("button", { name: "Reload" }));
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
