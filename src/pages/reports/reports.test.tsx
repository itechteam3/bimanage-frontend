import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";

// Reports (Figma 14.01–14.04) and social media scheduling (15.01).

let fb: FakeBackend;
const urls: Record<string, URL[]> = {};
const lastUrl = (key: string) => urls[key]?.[urls[key]!.length - 1];
/** Record each request's URL (query string included) for this route. */
const track = (key: string, reply: () => [number, unknown]) => {
  fb.handlers[key] = (_b, _h, url) => {
    (urls[key] ??= []).push(url);
    return reply();
  };
};

const OVERVIEW = {
  period: { range: "30d", from: "2026-10-16", to: "2026-11-14", days: 30, timezone: "Africa/Lagos" },
  revenue: { total: 1280000, online: 815000, direct: 465000, previous: 1000000, change: 28 },
  channels: [
    { key: "online", label: "Online store", orders: 38, revenue: 815000 },
    { key: "direct", label: "Direct sales", orders: 26, revenue: 465000 },
    { key: "invoices", label: "Paid invoices", count: 21, amount: 912000, note: "Collections, not added to revenue" },
  ],
  test: { orders: 3, revenue: 140650, label: "Test payments (not real money)" },
  series: [
    { date: "2026-11-13", revenue: 50000, orders: 2, online: 30000, direct: 20000 },
    { date: "2026-11-14", revenue: 75000, orders: 3, online: 75000, direct: 0 },
  ],
  bestSellers: [{ name: "Classic linen shirt", quantity: 12, revenue: 300000 }],
  sales: { totalSales: 1280000, totalOrders: 64, completedOrders: 64, cancelledOrders: 1, averageOrderValue: 20000 },
  inventory: { totalProducts: 10, totalStock: 200, stockValue: 8400000, healthy: 5, lowStock: 3, outOfStock: 2 },
  invoices: { total: 30, paid: 21, totalRevenue: 912000, pending: 6, overdue: 3, draft: 1 },
};

beforeEach(() => {
  tokenStore.set("tok");
  serverStatus.set("up");
  fb = installFakeBackend();
  for (const k of Object.keys(urls)) delete urls[k];
  fb.handlers["GET /subscriptions/current"] = () => [200, { plan: "premium", status: "active", features: { analytics: true, orders: true, invoices: true } }];
  URL.createObjectURL = vi.fn(() => "blob:report");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  tokenStore.clear();
  localStorage.clear();
});

describe("14.01 overview", () => {
  it("shows KPIs, channel rows, best sellers and a labelled test note; the period switch changes the query", async () => {
    track("GET /analytics/overview", () => [200, OVERVIEW]);
    const user = userEvent.setup();
    renderApp("/reports");
    expect(await screen.findByText("₦1.28m")).toBeInTheDocument();
    expect(lastUrl("GET /analytics/overview")?.searchParams.get("range")).toBe("30d");
    expect(screen.getByText("Up 28% on the period before")).toBeInTheDocument();
    expect(screen.getByText("₦20k")).toBeInTheDocument();
    // Low stock = low + out
    expect(within(screen.getByRole("heading", { name: "Low stock" }).closest("section")!).getByText("5")).toBeInTheDocument();
    const invoices = document.querySelector('[data-channel="invoices"]') as HTMLElement;
    expect(within(invoices).getByText("Paid invoices")).toBeInTheDocument();
    expect(within(invoices).getByText(/collections, not added to revenue/i)).toBeInTheDocument();
    expect(within(document.querySelector('[data-channel="online"]') as HTMLElement).getByText("₦815,000")).toBeInTheDocument();
    const testNote = screen.getByRole("region", { name: "Test payments" });
    expect(within(testNote).getByText(/₦140,650 from 3 orders/)).toBeInTheDocument();
    expect(within(testNote).getByText(/not added to revenue/i)).toBeInTheDocument();
    expect(screen.getByText("Classic linen shirt")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /revenue per day/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "7 days" }));
    await waitFor(() => expect(lastUrl("GET /analytics/overview")?.searchParams.get("range")).toBe("7d"));
    await user.click(screen.getByRole("button", { name: "Today" }));
    await waitFor(() => expect(lastUrl("GET /analytics/overview")?.searchParams.get("range")).toBe("today"));
  });

  it("a custom period sends from and to; the export uses the same period", async () => {
    track("GET /analytics/overview", () => [200, OVERVIEW]);
    track("GET /analytics/export/sales", () => [200, { ok: true }]);
    const user = userEvent.setup();
    renderApp("/reports?range=custom&from=2026-10-01&to=2026-10-31");
    expect(await screen.findByText("₦1.28m")).toBeInTheDocument();
    const q = lastUrl("GET /analytics/overview")!.searchParams;
    expect([q.get("from"), q.get("to"), q.get("range")]).toEqual(["2026-10-01", "2026-10-31", null]);
    await user.click(screen.getByRole("button", { name: /export analytics csv/i }));
    await waitFor(() => expect(lastUrl("GET /analytics/export/sales")?.searchParams.get("from")).toBe("2026-10-01"));
  });

  it("/sales/analytics and /analytics open Reports", async () => {
    track("GET /analytics/overview", () => [200, OVERVIEW]);
    const router = renderApp("/sales/analytics");
    await waitFor(() => expect(router.state.location.pathname).toBe("/reports"));
    expect(await screen.findByRole("heading", { name: "Analytics and reports" })).toBeInTheDocument();
  });

  it("team members without the analytics permission see why", async () => {
    fb.handlers["GET /settings/my-role"] = () => [200, { role: "staff", permissions: { viewAnalytics: false }, businessId: "o1" }];
    renderApp("/reports");
    expect(await screen.findByText("Reports aren't available to you")).toBeInTheDocument();
    expect(fb.calls.some((c) => c.key === "GET /analytics/overview")).toBe(false);
  });
});

describe("14.02 sales ledger", () => {
  const LEDGER = {
    period: { from: "2026-11-08", to: "2026-11-14", range: "7d" },
    rows: [
      { id: "o1", date: "2026-11-14T10:00:00Z", orderNumber: "ORD-1001", channel: "online", customer: "Amina Yusuf", items: "Shirt x1", total: 45000, status: "paid", money: "live", link: "/store/orders/o1" },
      { id: "o2", date: "2026-11-13T10:00:00Z", orderNumber: "ORD-1002", channel: "online", customer: "Test Buyer", items: "Shirt x1", total: 10000, status: "paid", money: "test", link: "/store/orders/o2" },
    ],
    total: 2,
    page: 1,
    totalPages: 1,
    summary: { statusMix: [{ status: "paid", count: 2 }, { status: "pending", count: 0 }, { status: "fulfilment", count: 0 }, { status: "refunded", count: 0 }, { status: "cancelled", count: 0 }], totalValue: 45000, testOrders: 1 },
  };

  it("filters reach the query string, and the export carries the same filters", async () => {
    track("GET /analytics/sales-ledger", () => [200, LEDGER]);
    track("GET /analytics/export/ledger", () => [200, { ok: true }]);
    const user = userEvent.setup();
    renderApp("/reports/sales?range=7d&channel=online&status=paid&test=1&q=amina");
    expect((await screen.findAllByText("ORD-1001")).length).toBeGreaterThan(0);
    const q = lastUrl("GET /analytics/sales-ledger")!.searchParams;
    expect(Object.fromEntries(q)).toEqual({ range: "7d", channel: "online", status: "paid", includeTest: "true", search: "amina" });
    // Test rows are labelled
    expect(screen.getAllByText("Test").length).toBeGreaterThan(0);
    expect(screen.getByText("1 (not in the sales value)")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Channel"), "direct");
    await waitFor(() => expect(lastUrl("GET /analytics/sales-ledger")?.searchParams.get("channel")).toBe("direct"));
    await user.click(screen.getByRole("button", { name: /export sales ledger/i }));
    await waitFor(() => expect(lastUrl("GET /analytics/export/ledger")).toBeTruthy());
    expect(Object.fromEntries(lastUrl("GET /analytics/export/ledger")!.searchParams)).toEqual({ range: "7d", channel: "direct", status: "paid", includeTest: "true", search: "amina" });
  });
});

describe("14.03 inventory and 14.04 invoices", () => {
  it("inventory: KPIs, health mix, categories and restock links", async () => {
    track("GET /analytics/inventory-health", () => [
      200,
      {
        rows: [
          { id: "p1", name: "Canvas bag", sku: "BAG-1", category: "Accessories", stock: 0, lowStockLevel: 5, sellingPrice: 8000, stockValue: 0, sold: 9, health: "out", link: "/inventory/p1" },
          { id: "p2", name: "Linen shirt", sku: "SH-1", category: "Clothing", stock: 28, lowStockLevel: 5, sellingPrice: 25000, stockValue: 700000, sold: 30, health: "healthy", link: "/inventory/p2" },
        ],
        total: 2,
        page: 1,
        totalPages: 1,
        summary: { products: 2, units: 28, stockValue: 700000, healthy: 1, low: 0, out: 1, categories: [{ category: "Clothing", products: 1, units: 28, value: 700000, low: 0 }, { category: "Accessories", products: 1, units: 0, value: 0, low: 1 }], restock: [{ id: "p1", name: "Canvas bag", stock: 0, lowStockLevel: 5, link: "/inventory/p1" }] },
      },
    ]);
    const user = userEvent.setup();
    renderApp("/reports/inventory");
    expect(await screen.findByText("₦700k")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /restock canvas bag/i })[0]).toHaveAttribute("href", "/inventory/products/p1/adjust");
    expect(screen.getByRole("link", { name: "Linen shirt" })).toHaveAttribute("href", "/inventory/products/p2");
    expect(screen.getByRole("img", { name: /stock health: healthy 1, low stock 0, out of stock 1/i })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Health"), "out");
    await waitFor(() => expect(lastUrl("GET /analytics/inventory-health")?.searchParams.get("health")).toBe("out"));
  });

  it("invoices: amounts per status, days overdue and a remind link", async () => {
    track("GET /analytics/invoice-collections", () => [
      200,
      {
        rows: [{ id: "i1", invoiceNumber: "INV-0130", client: "Ada Nwosu", clientEmail: "", total: 39500, status: "overdue", dueDate: "2026-11-04T00:00:00Z", daysOverdue: 10, createdAt: "2026-10-20T00:00:00Z", link: "/invoices/i1" }],
        total: 1,
        page: 1,
        totalPages: 1,
        summary: { paid: { count: 21, amount: 912000 }, open: { count: 9, amount: 250000 }, overdue: { count: 1, amount: 39500 }, draft: { count: 1, amount: 28000 } },
      },
    ]);
    track("GET /analytics/export/invoices", () => [200, { ok: true }]);
    const user = userEvent.setup();
    renderApp("/reports/invoices?status=overdue");
    expect(await screen.findByText("10 days overdue")).toBeInTheDocument();
    expect(screen.getByText("₦912k")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /remind about inv-0130/i })).toHaveAttribute("href", "/invoices/i1");
    expect(lastUrl("GET /analytics/invoice-collections")?.searchParams.get("status")).toBe("overdue");
    await user.click(screen.getByRole("button", { name: /export invoice collections/i }));
    await waitFor(() => expect(lastUrl("GET /analytics/export/invoices")?.searchParams.get("status")).toBe("overdue"));
  });
});

describe("15.01 social media", () => {
  it("teases on every plan, with a disabled preview, and joins and leaves the list", async () => {
    fb.handlers["GET /subscriptions/current"] = () => [200, { plan: "freemium", status: "active", features: {} }];
    let joined = false;
    fb.handlers["GET /social/waitlist"] = () => [200, { joined, channels: joined ? ["instagram"] : [], joinedAt: null, availableChannels: ["facebook", "instagram", "tiktok", "x", "linkedin", "whatsapp"] }];
    fb.handlers["POST /social/waitlist"] = (b) => ((joined = true), [200, { joined: true, channels: b.channels }]);
    fb.handlers["DELETE /social/waitlist"] = () => ((joined = false), [200, { joined: false }]);
    const user = userEvent.setup();
    renderApp("/social");
    expect(await screen.findByRole("heading", { name: "Social media scheduling" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /schedule post \(coming soon\)/i })).toBeDisabled();
    expect(screen.getByLabelText("Caption")).toBeDisabled();
    expect(screen.getByText("Connect accounts")).toBeInTheDocument();
    expect(screen.getByText("Monitor outcomes")).toBeInTheDocument();

    await user.click(await screen.findByLabelText("Instagram"));
    await user.click(screen.getByRole("button", { name: "Notify me" }));
    expect(await screen.findByText(/you're on the list/i)).toBeInTheDocument();
    expect([...fb.calls].reverse().find((c) => c.key === "POST /social/waitlist")?.body).toEqual({ channels: ["instagram"] });

    await user.click(screen.getByRole("button", { name: "Leave the list" }));
    expect(await screen.findByRole("button", { name: "Notify me" })).toBeInTheDocument();
    expect(fb.calls.some((c) => c.key === "DELETE /social/waitlist")).toBe(true);
  });
});
