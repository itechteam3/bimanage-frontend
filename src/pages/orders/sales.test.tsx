import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { EMPTY_DASHBOARD, installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";
import type { Invoice, Order } from "@/lib/sales/api";

const SHIRT = { _id: "p1", name: "Linen shirt", sellingPrice: 25000, stockQuantity: 18, totalSold: 0 };
const TOTE = { _id: "p2", name: "Canvas tote", sellingPrice: 5000, stockQuantity: 1, totalSold: 0 };

const ORDER: Order = {
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

const INVOICE: Invoice = {
  _id: "i1",
  invoiceNumber: "INV-2026-AB2CDE",
  clientName: "Amina Yusuf",
  clientEmail: "amina@example.com",
  items: [{ description: "Linen shirt", quantity: 2, unitPrice: 25000, total: 50000 }],
  subtotal: 50000,
  tax: 0,
  taxAmount: 0,
  total: 50000,
  status: "draft",
  createdAt: "2026-11-12T09:00:00Z",
};

let fb: FakeBackend;
beforeEach(() => {
  tokenStore.set("tok");
  serverStatus.set("up");
  fb = installFakeBackend();
  fb.handlers["GET /subscriptions/current"] = () => [200, { plan: "standard", status: "active", features: { orders: true, invoices: true, analytics: true, inventory: true } }];
  fb.handlers["GET /inventory/products"] = () => [200, [SHIRT, TOTE]];
  fb.handlers["GET /orders"] = () => [200, [ORDER]];
  fb.handlers["GET /orders/stats"] = () => [200, { all: 1, awaitingPayment: 1, unfulfilled: 1, completed: 0, cancelled: 0, revenue: 0 }];
  fb.handlers["GET /orders/o1"] = () => [200, ORDER];
  fb.handlers["GET /invoices/i1"] = () => [200, INVOICE];
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  tokenStore.clear();
});

const last = (key: string) => [...fb.calls].reverse().find((c) => c.key === key);

describe("orders (05.02 / 05.09 / 05.12 / 05.04 / 05.07 / 05.08)", () => {
  it("lists orders with stats, and filters / searches through the API", async () => {
    const queries: string[] = [];
    fb.handlers["GET /orders"] = (_b, _h, url) => (queries.push(url.search), [200, [ORDER]]);
    renderApp("/orders");
    expect(await screen.findByText("ORD-7K2Q9M")).toBeInTheDocument();
    expect(screen.getAllByText("Awaiting payment").length).toBeGreaterThan(0);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Unfulfilled" }));
    await waitFor(() => expect(queries).toContain("?status=unfulfilled"));
    await user.type(screen.getByRole("textbox", { name: /search orders/i }), "amina{Enter}");
    await waitFor(() => expect(queries).toContain("?status=unfulfilled&q=amina"));
  });

  it("creates a multi-item order; a stock shortage from the server lands on that line", async () => {
    let attempt = 0;
    fb.handlers["POST /orders"] = () =>
      ++attempt === 1 ? [400, { message: "Insufficient stock: only 1 of Canvas tote left.", field: "items", productId: "p2", available: 1 }] : [201, { ...ORDER, _id: "o9" }];
    fb.handlers["GET /orders/o9"] = () => [200, { ...ORDER, _id: "o9" }];
    const router = renderApp("/orders/new");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/customer name/i), "Amina Yusuf");
    await user.selectOptions(screen.getAllByLabelText(/^product/i)[0]!, "p1");
    const qty = screen.getAllByLabelText(/^quantity/i)[0]!;
    await user.clear(qty);
    await user.type(qty, "2");
    await user.click(screen.getByRole("button", { name: /add another inventory product/i }));
    await user.selectOptions(screen.getAllByLabelText(/^product/i)[1]!, "p2");
    await user.selectOptions(screen.getByLabelText(/^payment$/i), "pending");
    await user.type(screen.getByLabelText(/delivery fee/i), "{selectall}5000");
    // subtotal 2×25,000 + 1×5,000 = 55,000; plus 5,000 delivery = 60,000
    expect(screen.getByText("₦55,000")).toBeInTheDocument();
    expect(screen.getByText("₦60,000")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^create order$/i }));
    expect(await screen.findByText(/only 1 in stock/i)).toBeInTheDocument();
    expect(last("POST /orders")!.body).toMatchObject({
      items: [{ productId: "p1", quantity: 2 }, { productId: "p2", quantity: 1 }],
      customer: { name: "Amina Yusuf" },
      paymentStatus: "pending",
      deliveryFee: 5000,
    });
    await user.click(screen.getByRole("button", { name: /^create order$/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/orders/o9/created"));
    expect(await screen.findByText(/your order is in the system/i)).toBeInTheDocument();
  });

  it("client-side stock check stops an order before it's sent", async () => {
    fb.handlers["POST /orders"] = () => [201, ORDER];
    renderApp("/orders/new");
    const user = userEvent.setup();
    await user.selectOptions((await screen.findAllByLabelText(/^product/i))[0]!, "p2");
    const qty = screen.getAllByLabelText(/^quantity/i)[0]!;
    await user.clear(qty);
    await user.type(qty, "3");
    await user.click(screen.getByRole("button", { name: /^create order$/i }));
    expect(await screen.findByText("Only 1 in stock.")).toBeInTheDocument();
    expect(last("POST /orders")).toBeUndefined();
  });

  it("details: mark paid and fulfilled through the status endpoint", async () => {
    let current = { ...ORDER };
    fb.handlers["GET /orders/o1"] = () => [200, current];
    fb.handlers["PATCH /orders/o1/status"] = (b) => {
      current = { ...current, ...(b as Partial<Order>) };
      if (current.paymentStatus === "paid" && current.fulfilmentStatus === "fulfilled") current = { ...current, status: "completed", canCancel: false };
      return [200, current];
    };
    renderApp("/orders/o1");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Mark paid" }));
    await waitFor(() => expect(last("PATCH /orders/o1/status")!.body).toEqual({ paymentStatus: "paid" }));
    await user.click(await screen.findByRole("button", { name: "Mark fulfilled" }));
    await waitFor(() => expect(last("PATCH /orders/o1/status")!.body).toEqual({ fulfilmentStatus: "fulfilled" }));
    await waitFor(() => expect(screen.queryByRole("link", { name: /cancel unfulfilled order/i })).toBeNull());
  });

  it("cancel: confirm screen restores stock, then the completed screen", async () => {
    fb.handlers["PUT /orders/o1/cancel"] = () => [200, { message: "Order cancelled", order: { ...ORDER, status: "cancelled", canCancel: false } }];
    const router = renderApp("/orders/o1/cancel");
    const user = userEvent.setup();
    expect(await screen.findByText("2 units restored")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/reason/i), "Changed mind");
    fb.handlers["GET /orders/o1"] = () => [200, { ...ORDER, status: "cancelled", canCancel: false, cancelledAt: "2026-11-12T10:00:00Z" }];
    await user.click(screen.getByRole("button", { name: /confirm order cancellation/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/orders/o1/cancelled"));
    expect(last("PUT /orders/o1/cancel")!.body).toEqual({ reason: "Changed mind" });
    expect(await screen.findByText(/cancelled and stock restored/i)).toBeInTheDocument();
  });

  it("is locked when the plan has no orders", async () => {
    fb.handlers["GET /subscriptions/current"] = () => [200, { plan: "freemium", status: "active", features: { orders: false } }];
    renderApp("/orders");
    expect(await screen.findByText(/isn't included in your plan/i)).toBeInTheDocument();
    expect(last("GET /orders")).toBeUndefined();
  });
});

describe("invoices (05.03 / 05.06 / 05.10 / 05.11 / 05.13)", () => {
  it("creates an invoice with a live preview, then shows the created screen", async () => {
    fb.handlers["POST /invoices"] = (b) => [201, { ...INVOICE, ...(b as object), _id: "i1" }];
    const router = renderApp("/invoices/new");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/^customer/i), "Amina Yusuf");
    await user.type(screen.getByLabelText(/^item/i), "Linen shirt");
    const q = screen.getByLabelText(/^qty/i);
    await user.clear(q);
    await user.type(q, "2");
    await user.type(screen.getByLabelText(/^rate/i), "{selectall}25000");
    const preview = screen.getByRole("article", { name: /invoice preview/i });
    expect(within(preview).getByText("Amina Yusuf")).toBeInTheDocument();
    expect(within(preview).getAllByText("₦50,000").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /^create invoice$/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/invoices/i1/created"));
    expect(last("POST /invoices")!.body).toMatchObject({ clientName: "Amina Yusuf", items: [{ description: "Linen shirt", quantity: 2, unitPrice: 25000 }] });
  });

  it("email: when sending isn't available yet, offers the PDF instead of an error", async () => {
    fb.handlers["POST /invoices/i1/send"] = () => [503, { emailUnavailable: true, message: "We couldn't send the email right now." }];
    renderApp("/invoices/i1/email");
    const user = userEvent.setup();
    expect(await screen.findByLabelText(/^to email/i)).toHaveValue("amina@example.com");
    await user.type(screen.getByLabelText(/^cc/i), "acct@example.com, boss@example.com");
    await user.click(screen.getByRole("button", { name: /send invoice to customer/i }));
    expect(await screen.findByText(/couldn.t send the email right now/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download pdf/i })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(last("POST /invoices/i1/send")!.body).toMatchObject({ to: "amina@example.com", cc: ["acct@example.com", "boss@example.com"] });
  });

  it("email: success goes to the sent screen", async () => {
    fb.handlers["POST /invoices/i1/send"] = () => [200, { invoice: { ...INVOICE, status: "sent" } }];
    const router = renderApp("/invoices/i1/email");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /send invoice to customer/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/invoices/i1/sent"));
    expect(await screen.findByText(/is on its way/i)).toBeInTheDocument();
  });

  it("preview: the line table fits any column, and no placeholder contact is shown", async () => {
    fb.handlers["GET /invoices/i1"] = () => [200, { ...INVOICE, clientEmail: "" }];
    renderApp("/invoices/i1");
    const doc = await screen.findByRole("article", { name: /invoice preview/i });
    const table = doc.querySelector("table[data-invoice-lines]")!;
    expect(table.classList.contains("table-fixed")).toBe(true);
    expect(table.className).not.toMatch(/min-w-/);
    expect(table.closest(".overflow-x-auto")).toBeNull();
    expect(within(doc).queryByText(/example\.com/)).toBeNull();
  });

  it("preview: mark as paid", async () => {
    let inv = { ...INVOICE, status: "sent" as const };
    fb.handlers["GET /invoices/i1"] = () => [200, inv];
    fb.handlers["PUT /invoices/i1"] = (b) => ((inv = { ...inv, ...(b as object) } as typeof inv), [200, inv]);
    renderApp("/invoices/i1");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /mark as paid/i }));
    await waitFor(() => expect(last("PUT /invoices/i1")!.body).toEqual({ status: "paid" }));
  });
});

describe("sales (05.01 / 05.05)", () => {
  it("analytics: one bar per day, a data table for screen readers, and top products", async () => {
    const today = new Date();
    fb.handlers["GET /analytics/overview"] = () => [
      200,
      {
        sales: { totalSales: 75000, totalOrders: 3, completedOrders: 2, cancelledOrders: 0, averageOrderValue: 37500 },
        invoices: { total: 1, paid: 1, totalRevenue: 50000, pending: 0 },
        salesByDay: [{ _id: { year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() }, totalSales: 75000, totalOrders: 2 }],
        topProducts: [{ _id: "p1", name: "Linen shirt", sellingPrice: 25000, totalSold: 3 }],
      },
    ];
    fb.handlers["GET /invoices/stats"] = () => [200, { total: 1, draft: 0, sent: 0, paid: 1, overdue: 0, totalRevenue: 50000, totalPending: 0 }];
    renderApp("/sales/analytics");
    const table = await screen.findByRole("table", { name: /revenue from completed orders per day/i });
    expect(within(table).getAllByRole("row")).toHaveLength(8); // header + 7 days
    expect(within(table).getByText(/₦75,000 \(2 orders\)/)).toBeInTheDocument();
    expect(screen.getByText("3 sold")).toBeInTheDocument();
  });

  it("overview shows recent sales", async () => {
    fb.handlers["GET /dashboard"] = () => [200, { ...EMPTY_DASHBOARD, stats: { ...EMPTY_DASHBOARD.stats, revenue: 1280400, totalOrders: 64 } }];
    renderApp("/sales");
    expect(await screen.findByText("₦1.28m")).toBeInTheDocument();
    expect(await screen.findByText("ORD-7K2Q9M")).toBeInTheDocument();
  });
});
