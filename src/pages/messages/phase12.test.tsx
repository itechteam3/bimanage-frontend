import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";
import { installFakeSockets } from "@/test/fakeSocket";
import { chatToken } from "@/lib/store/chat";

// Phase 12: shared inbox (12.01/12.02/12.04/12.10), notifications (12.11/12.13),
// storefront guest chat (12.03) and the "Messages" team permission.

const PAID = { plan: "standard", status: "active", features: { messages: true, orders: true, inventory: true, store: true } };
const FREE = { plan: "freemium", status: "active", features: { messages: false } };
const ROW = (over = {}) => ({
  _id: "c1",
  type: "supplier",
  title: "Apex Agro Supplies",
  counterpart: { kind: "business", id: "b2" },
  related: { kind: "supply_order", id: "o1", label: "BSN-0812" },
  lastMessage: { content: "Packing begins", hasAttachments: false, at: new Date().toISOString(), mine: false },
  lastMessageAt: new Date().toISOString(),
  unread: 2,
  muted: false,
  blocked: null,
  ...over,
});
const THREAD = (over = {}) => ({
  conversation: { _id: "c1", type: "supplier", title: "Apex Agro Supplies", related: { kind: "supply_order", id: "o1", label: "BSN-0812" }, muted: false, blocked: null, ...over },
  messages: [
    { _id: "m1", content: "Order received", attachments: [], sender: { _id: "s", name: "Apex Agro" }, mine: false, createdAt: "2026-11-13T09:21:00Z" },
    { _id: "m2", content: "Please send ETA", attachments: [], sender: { _id: "u1", name: "Samuel Adebayo" }, mine: true, createdAt: "2026-11-13T09:25:00Z" },
  ],
  page: 1,
  hasMore: false,
});

let fb: FakeBackend;
let sockets: ReturnType<typeof installFakeSockets>;
const last = (key: string) => [...fb.calls].reverse().find((c) => c.key === key);
beforeEach(() => {
  tokenStore.set("tok");
  serverStatus.set("up");
  fb = installFakeBackend();
  sockets = installFakeSockets();
  fb.handlers["GET /subscriptions/current"] = () => [200, PAID];
  fb.handlers["GET /messages/conversations"] = (_b, _h, url) => [200, { conversations: url.searchParams.get("unread") === "true" ? [ROW()] : [ROW(), ROW({ _id: "c2", type: "team", title: "Tunde Adeyemi", related: null, unread: 0 })], page: 1, hasMore: false }];
  fb.handlers["GET /messages/conversations/c1"] = () => [200, THREAD()];
});
afterEach(() => {
  sockets.restore();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  tokenStore.clear();
  localStorage.clear();
});

describe("shared inbox", () => {
  it("lists conversations with type, unread and filters", async () => {
    const user = userEvent.setup();
    renderApp("/messages");
    const row = await screen.findByRole("link", { name: /apex agro supplies/i });
    expect(row).toHaveTextContent("Supplier");
    expect(within(row).getByLabelText("2 unread")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /tunde adeyemi/i })).toHaveTextContent("Team");
    await user.click(screen.getByRole("tab", { name: "Unread" }));
    await waitFor(() => expect(last("GET /messages/conversations")).toBeTruthy());
    await waitFor(() => expect(screen.queryByRole("link", { name: /tunde adeyemi/i })).not.toBeInTheDocument());
  });

  it("opens a protected order conversation and sends a message", async () => {
    fb.handlers["POST /messages/conversations/c1"] = (b) => [201, { _id: "m3", content: b.content, attachments: [], sender: { name: "Samuel" }, mine: true, createdAt: new Date().toISOString() }];
    const user = userEvent.setup();
    renderApp("/messages/c1");
    expect(await screen.findByText("Order received")).toBeInTheDocument();
    expect(screen.getByText(/dispute evidence/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Message"), "Dispatch tomorrow?");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(last("POST /messages/conversations/c1")?.body).toEqual({ content: "Dispatch tomorrow?", attachments: [] }));
  });

  it("Freemium can read but not reply or start chats", async () => {
    fb.handlers["GET /subscriptions/current"] = () => [200, FREE];
    renderApp("/messages/c1");
    expect(await screen.findByText("Order received")).toBeInTheDocument();
    expect(screen.getByText(/replying is included in standard and premium/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new message/i })).toBeDisabled();
  });

  it("12.04: blocking during an active paid order explains why and offers report, mute, view order", async () => {
    fb.handlers["POST /messages/conversations/c1/block"] = () => [409, { code: "BLOCK_RESTRICTED", reason: "Paid order in progress", message: "Blocking is unavailable", activeOrder: { kind: "supply_order", id: "o1", label: "BSN-0812" }, allowed: ["report", "mute", "view_order"] }];
    const user = userEvent.setup();
    renderApp("/messages/c1");
    await screen.findByText("Order received");
    await user.click(screen.getByRole("button", { name: "Block" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Block" }));
    const dialog = await screen.findByRole("dialog", { name: "Blocking is unavailable" });
    expect(dialog).toHaveTextContent("BSN-0812");
    expect(dialog).toHaveTextContent("Paid order in progress");
    expect(within(dialog).getByRole("link", { name: "View active order" })).toHaveAttribute("href", "/bisupplynet/orders/o1");
  });

  it("report opens a support ticket and links to it", async () => {
    fb.handlers["POST /messages/conversations/c1/report"] = () => [201, { ticketNumber: "TKT-00042", ticketId: "t42" }];
    const user = userEvent.setup();
    renderApp("/messages/c1");
    await screen.findByText("Order received");
    await user.click(screen.getByRole("button", { name: "Report" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/what happened/i), "Abusive messages after delivery.");
    await user.click(within(dialog).getByRole("button", { name: "Send report" }));
    expect(await screen.findByRole("link", { name: "TKT-00042" })).toHaveAttribute("href", "/support/tickets/t42");
    expect(last("POST /messages/conversations/c1/report")?.body).toEqual({ reason: "Abusive messages after delivery." });
  });

  it("new message: pick a supplier, open the conversation", async () => {
    fb.handlers["GET /messages/contacts"] = () => [200, { contacts: [{ id: "w1", name: "Lagos Trade Hub", avatar: null, kind: "supplier" }] }];
    fb.handlers["POST /messages/conversation"] = () => [200, { _id: "c1", type: "supplier", created: true }];
    const user = userEvent.setup();
    const router = renderApp("/messages");
    await user.click(await screen.findByRole("button", { name: /new message/i }));
    await user.click(await screen.findByRole("button", { name: /lagos trade hub/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/messages/c1"));
    expect(last("POST /messages/conversation")?.body).toEqual({ recipientId: "w1" });
  });

  it("team permissions offer a Messages toggle (off for staff by default)", async () => {
    fb.handlers["POST /settings/team/invite"] = (b) => [201, { message: "ok", invite: { _id: "i9", email: "ada@x.com", name: "Ada Obi", role: "staff", permissions: b.permissions, status: "pending", expiresAt: new Date().toISOString(), createdAt: new Date().toISOString() } }];
    const user = userEvent.setup();
    renderApp("/settings/team/invite");
    await user.type(await screen.findByLabelText(/full name/i), "Ada Obi");
    await user.type(screen.getByLabelText(/email address/i), "ada@x.com");
    const toggle = screen.getByRole("checkbox", { name: /^messages/i });
    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    await user.click(screen.getByRole("button", { name: /send invitation/i }));
    await waitFor(() => expect((last("POST /settings/team/invite")?.body as { permissions: Record<string, boolean> }).permissions).toEqual({ manageMessages: true }));
  });
});

describe("notifications", () => {
  const N = (over = {}) => ({ _id: "n1", title: "New order", message: "ORD-1001 placed", type: "order", isRead: false, link: "/orders/o1", createdAt: new Date().toISOString(), ...over });
  beforeEach(() => {
    fb.handlers["GET /notifications/summary"] = () => [200, { all: 18, unread: 5, orders: 6, lowStock: 3 }];
    fb.handlers["GET /notifications"] = (_b, _h, url) => [200, { notifications: url.searchParams.get("filter") === "inventory" ? [N({ _id: "n2", title: "Low stock", type: "inventory", link: null })] : [N(), N({ _id: "n3", title: "Payment confirmed", type: "payment", isRead: true, link: "https://evil.example" })], total: 2, page: 1, totalPages: 1 }];
    fb.handlers["PUT /notifications/n1/read"] = () => [200, {}];
    fb.handlers["PUT /notifications/read-all"] = () => [200, {}];
    fb.handlers["DELETE /notifications/n3"] = () => [200, {}];
  });

  it("12.11: KPIs, filters, open marks read and follows in-app links only, mark all, delete", async () => {
    fb.handlers["GET /orders/o1"] = () => [404, { message: "x" }];
    const user = userEvent.setup();
    const router = renderApp("/notifications");
    expect(await screen.findByText("18")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Stock" }));
    expect(await screen.findByText("Low stock", { selector: "span" })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "All" }));
    await user.click(await screen.findByRole("button", { name: /^payment confirmed/i }));
    expect(router.state.location.pathname).toBe("/notifications"); // external link ignored
    await user.click(screen.getByRole("button", { name: "Delete notification: Payment confirmed" }));
    await waitFor(() => expect(last("DELETE /notifications/n3")).toBeTruthy());
    await user.click(screen.getByRole("button", { name: /mark all read/i }));
    await waitFor(() => expect(last("PUT /notifications/read-all")).toBeTruthy());
    await user.click(screen.getByRole("button", { name: /^new order/i }));
    await waitFor(() => expect(last("PUT /notifications/n1/read")).toBeTruthy());
    await waitFor(() => expect(router.state.location.pathname).toBe("/orders/o1"));
  });

  it("12.13: channel toggles save; security and payment stay on", async () => {
    const all = { inApp: true, email: true };
    let saved: unknown;
    fb.handlers["GET /notifications/preferences"] = () => [200, { preferences: { orders: all, inventory: all, messages: all, subscriptions: all, withdrawals: all }, mandatory: ["security", "payment"], categories: ["orders", "inventory", "messages", "subscriptions", "withdrawals"] }];
    fb.handlers["PUT /notifications/preferences"] = (b) => ((saved = b), [200, { preferences: { ...b } }]);
    const user = userEvent.setup();
    renderApp("/notifications/preferences");
    const email = await screen.findByRole("checkbox", { name: "Messages and team: email" });
    expect(screen.getByRole("checkbox", { name: /security and payment confirmations: email/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save preferences" })).toBeDisabled();
    await user.click(email);
    await user.click(screen.getByRole("button", { name: "Save preferences" }));
    await waitFor(() => expect((saved as Record<string, { email: boolean }> | undefined)?.messages?.email).toBe(false));
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
  });
});

describe("storefront guest chat (12.03)", () => {
  const STORE = { _id: "s1", storeName: "Elijah Apparel", storeSlug: "elijahapparel", description: "", category: "fashion", template: "basic", contactEmail: null, deliveryFee: 0, freeDeliveryAbove: null, acceptingOrders: true, paymentsComingSoon: false };
  const CHAT = (msgs: Array<{ _id: string; content: string; mine: boolean }>) => ({ sessionId: "G-1", name: "Ada", store: { name: "Elijah Apparel", slug: "elijahapparel" }, related: null, closed: false, messages: msgs.map((m) => ({ ...m, from: m.mine ? "Ada" : "Store", createdAt: new Date().toISOString() })) });
  beforeEach(() => {
    tokenStore.clear();
    fb.handlers["GET /store/elijahapparel"] = () => [200, STORE];
  });

  it("start a chat without an account; the token stays in this browser; replies arrive live", async () => {
    let replies: Array<{ _id: string; content: string; mine: boolean }> = [{ _id: "m1", content: "Is M in stock?", mine: true }];
    fb.handlers["POST /store-chat/elijahapparel/start"] = () => [201, { token: "tok_".padEnd(32, "x"), sessionId: "G-1", conversationId: "c9", related: null, messages: [] }];
    fb.handlers["GET /store-chat/elijahapparel/session"] = (_b, headers) => (headers["X-Guest-Token"] === "tok_".padEnd(32, "x") ? [200, CHAT(replies)] : [404, { message: "gone" }]);
    const user = userEvent.setup();
    renderApp("/s/elijahapparel/chat");
    await user.type(await screen.findByLabelText(/your name/i), "Ada");
    await user.type(screen.getByLabelText(/^email/i), "ada@example.com");
    await user.type(screen.getByLabelText(/your question/i), "Is M in stock?");
    await user.click(screen.getByRole("button", { name: /start chat/i }));
    expect(await screen.findByText("Is M in stock?")).toBeInTheDocument();
    expect(last("POST /store-chat/elijahapparel/start")?.body).toMatchObject({ name: "Ada", email: "ada@example.com", message: "Is M in stock?" });
    expect(last("POST /store-chat/elijahapparel/start")?.headers.Authorization).toBeUndefined();
    expect(chatToken.get("elijahapparel")).toBe("tok_".padEnd(32, "x"));

    await waitFor(() => expect(sockets.latest("/shop")).toBeTruthy());
    const shop = sockets.latest("/shop")!;
    shop.fire("connect");
    expect(shop.sent[0]?.slice(0, 2)).toEqual(["chat:join", { storeSlug: "elijahapparel", token: "tok_".padEnd(32, "x") }]);
    replies = [...replies, { _id: "m2", content: "Yes, size M is in stock.", mine: false }];
    shop.fire("chat:update", {});
    expect(await screen.findByText("Yes, size M is in stock.")).toBeInTheDocument();
  });

  it("a live reply doesn't crash the page in browsers where scrollIntoView returns a Promise", async () => {
    // Chrome now returns a Promise from scrollIntoView; an effect that returns it breaks React.
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function () {
      return Promise.resolve() as unknown as void;
    };
    try {
      chatToken.set("elijahapparel", "k".repeat(32));
      let msgs = [{ _id: "m1", content: "Hello", mine: true }];
      fb.handlers["GET /store-chat/elijahapparel/session"] = () => [200, CHAT(msgs)];
      renderApp("/s/elijahapparel/chat");
      expect(await screen.findByText("Hello")).toBeInTheDocument();
      await waitFor(() => expect(sockets.latest("/shop")).toBeTruthy());
      msgs = [...msgs, { _id: "m2", content: "Reply from the store", mine: false }];
      sockets.latest("/shop")!.fire("chat:update", {});
      expect(await screen.findByText("Reply from the store")).toBeInTheDocument();
      expect(screen.queryByText(/unexpected application error/i)).not.toBeInTheDocument();
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it("an emailed link (#t=…) opens the chat; an expired one goes back to the start form", async () => {
    window.history.replaceState(null, "", "/s/elijahapparel/chat#t=" + "e".repeat(32));
    fb.handlers["GET /store-chat/elijahapparel/session"] = () => [404, { message: "expired" }];
    renderApp("/s/elijahapparel/chat");
    expect(await screen.findByText(/that chat has ended or the link expired/i)).toBeInTheDocument();
    expect(chatToken.get("elijahapparel")).toBeNull();
    expect(window.location.hash).toBe("");
  });

  it("the store shows a chat button", async () => {
    fb.handlers["GET /store/elijahapparel/products"] = () => [200, { products: [], total: 0, page: 1, totalPages: 1 }];
    renderApp("/s/elijahapparel");
    expect(await screen.findByRole("link", { name: /chat with the store/i })).toHaveAttribute("href", "/s/elijahapparel/chat");
  });
});

describe("live updates", () => {
  it("a message event refreshes the open inbox", async () => {
    renderApp("/messages");
    await screen.findByRole("link", { name: /apex agro supplies/i });
    await waitFor(() => expect(sockets.latest()).toBeTruthy());
    const socket = sockets.latest()!;
    socket.fire("connect");
    const before = fb.calls.filter((c) => c.key === "GET /messages/conversations").length;
    await act(async () => socket.fire("bm:change", { topic: "messages", at: "" }));
    await waitFor(() => expect(fb.calls.filter((c) => c.key === "GET /messages/conversations").length).toBeGreaterThan(before), { timeout: 3000 });
  });
});
