// Fixtures for phases 13-15 (copied from the PR's tests, with longer text to stress layouts).
const OVERVIEW = {
  period: { range: "30d", from: "2026-10-16", to: "2026-11-14", days: 30, timezone: "Africa/Lagos" },
  revenue: { total: 1280000, online: 815000, direct: 465000, previous: 1000000, change: 28 },
  channels: [
    { key: "online", label: "Online store", orders: 38, revenue: 815000 },
    { key: "direct", label: "Direct sales", orders: 26, revenue: 465000 },
    { key: "invoices", label: "Paid invoices", count: 21, amount: 912000, note: "Collections, not added to revenue" },
  ],
  test: { orders: 3, revenue: 140650, label: "Test payments (not real money)" },
  series: Array.from({ length: 30 }, (_, i) => ({ date: `2026-${i < 16 ? "10" : "11"}-${String(i < 16 ? 16 + i : i - 15).padStart(2, "0")}`, revenue: (i % 7) * 15000, orders: i % 4, online: (i % 7) * 9000, direct: (i % 7) * 6000 })),
  bestSellers: [{ name: "Classic linen shirt with a very long product name for testing", quantity: 12, revenue: 300000 }, { name: "Canvas tote", quantity: 7, revenue: 115500 }],
  sales: { totalSales: 1280000, totalOrders: 64, completedOrders: 64, cancelledOrders: 1, averageOrderValue: 20000 },
  inventory: { totalProducts: 10, totalStock: 200, stockValue: 8400000, healthy: 5, lowStock: 3, outOfStock: 2 },
  invoices: { total: 30, paid: 21, totalRevenue: 912000, pending: 6, overdue: 3, draft: 1 },
  tasks: { total: 4, pending: 3, inProgress: 1, completed: 1 },
  projects: { total: 2, active: 2, completed: 0 },
  salesByDay: [],
  topProducts: [],
};
const LEDGER = {
  period: { from: "2026-11-08", to: "2026-11-14", range: "7d" },
  rows: [
    { id: "o1", date: "2026-11-14T10:00:00Z", orderNumber: "ORD-1001", channel: "online", customer: "Amina Yusuf Abdulrahman-Okonkwo", items: "Classic linen shirt x1, Canvas tote x2, Leather belt x1", total: 45000, status: "paid", money: "live", link: "/store/orders/o1" },
    { id: "o2", date: "2026-11-13T10:00:00Z", orderNumber: "ORD-1002", channel: "direct", customer: "Bayo", items: "Shirt x1", total: 10000, status: "fulfilment", money: "live", link: "/orders/o2" },
  ],
  total: 2,
  page: 1,
  totalPages: 1,
  summary: { statusMix: [{ status: "paid", count: 1 }, { status: "pending", count: 0 }, { status: "fulfilment", count: 1 }, { status: "refunded", count: 0 }, { status: "cancelled", count: 0 }], totalValue: 55000, testOrders: 0 },
};
const HEALTH = {
  rows: [
    { id: "p1", name: "Canvas bag", sku: "BAG-1", category: "Accessories", stock: 0, lowStockLevel: 5, sellingPrice: 8000, stockValue: 0, sold: 9, health: "out", link: "/inventory/p1" },
    { id: "p2", name: "Linen shirt", sku: "SH-1", category: "Clothing", stock: 28, lowStockLevel: 5, sellingPrice: 25000, stockValue: 700000, sold: 30, health: "healthy", link: "/inventory/p2" },
  ],
  total: 2,
  page: 1,
  totalPages: 1,
  summary: { products: 2, units: 28, stockValue: 700000, healthy: 1, low: 0, out: 1, categories: [{ category: "Clothing", products: 1, units: 28, value: 700000, low: 0 }, { category: "Accessories", products: 1, units: 0, value: 0, low: 1 }], restock: [{ id: "p1", name: "Canvas bag", stock: 0, lowStockLevel: 5, link: "/inventory/p1" }] },
};
const COLLECTIONS = {
  rows: [{ id: "i1", invoiceNumber: "INV-0130", client: "Ada Nwosu Fashion House Limited", clientEmail: "", total: 39500, status: "overdue", dueDate: "2026-11-04T00:00:00Z", daysOverdue: 10, createdAt: "2026-10-20T00:00:00Z", link: "/invoices/i1" }],
  total: 1,
  page: 1,
  totalPages: 1,
  summary: { paid: { count: 21, amount: 912000 }, open: { count: 9, amount: 250000 }, overdue: { count: 1, amount: 39500 }, draft: { count: 1, amount: 28000 } },
};
export const P13_ROUTES = {
  "GET /api/profile": { _id: "u1", name: "Samuel Adebayo", email: "sam@x.com", username: "samuel", phone: "+2348035550190", isVerified: true, hasPassword: true, passwordChangedAt: "2026-10-06T10:00:00.000Z" },
  "GET /api/profile/preferences": { startPage: "dashboard", reduceMotion: false, largerText: false, timezone: "Africa/Lagos", currency: "NGN", dateFormat: "DD MMM YYYY", language: "English (UK)", startPages: ["dashboard", "sales", "orders", "inventory", "store", "projects", "messages"] },
  "GET /api/profile/closure-check": { canClose: false, blockers: [{ key: "storeOrders", label: "Paid store orders not yet completed", count: 2, link: "/store/orders" }, { key: "wallet", label: "Money in your wallet", count: 1, amount: 45000, link: "/wallet" }], businessName: "Dior Factory LTD.", graceDays: 30 },
  "GET /api/analytics/overview": OVERVIEW,
  "GET /api/analytics/sales-ledger": LEDGER,
  "GET /api/analytics/inventory-health": HEALTH,
  "GET /api/analytics/invoice-collections": COLLECTIONS,
  "GET /api/social/waitlist": { joined: false, channels: [], joinedAt: null, availableChannels: ["facebook", "instagram", "tiktok", "x", "linkedin", "whatsapp"] },
};
