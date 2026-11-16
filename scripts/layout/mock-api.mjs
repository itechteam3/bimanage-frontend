// Fixture API for the layout check (scripts/check-layout.mjs). LOCAL ONLY:
// realistic but invented data, no real accounts. node scripts/layout/mock-api.mjs [port]
// LAYOUT_LONG=1 (or GET /__mode/long) stretches names, emails, titles and ₦
// amounts to stress layouts; GET /__mode/normal switches back.
import http from "node:http";
const port = Number(process.argv[2] ?? 5099);
const today = new Date();
const day = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }; };
let populated = true;
const routes = {
  "GET /": { message: "ok" },
  "GET /api/auth/me": { _id: "u1", name: "Samuel Adebayo", email: "sam@x.com", isVerified: true },
  "GET /api/settings/my-role": { role: "owner", permissions: {}, businessId: "u1" },
  "GET /api/business-profile": { businessName: "Dior Factory LTD.", businessType: "limited_liability", businessCategory: "fashion", businessPhone: "+234 803 555 0190", businessEmail: "hello@elijahapparel.com", businessAddress: "14 Adebayo St, Yaba", cacNumber: "RC 1234567" },
  "GET /api/onboarding/status": { userPath: "startup", isTrialUsed: false, startupPackage: "starter", daysRemainingTrial: 14 },
  "GET /api/onboarding/steps": { completedCount: 3, totalSteps: 7, isComplete: false, percentage: 43, steps: [
    ["accountCreated", "Create your account", true, "/settings"], ["emailVerified", "Verify your email address", true, "/verify"], ["businessProfileComplete", "Complete your business profile", true, "/onboarding/business"], ["logoUploaded", "Upload your business logo", false, "/onboarding/business"], ["firstProductAdded", "Add your first product", false, "/inventory"], ["firstOrderCreated", "Create your first order", false, "/orders"], ["storeCreated", "Set up your online store", false, "/store/create"],
  ].map(([key, label, completed, link]) => ({ key, label, description: "", completed, link })) },
  "GET /api/onboarding/startup-packages": [
    { id: "starter", name: "Starter", amount: 199999, currency: "NGN", tagline: "For businesses finding their feet", summary: "Core business features", days: 30 },
    { id: "standard", name: "Standard", amount: 299999, currency: "NGN", tagline: "For teams ready to grow", summary: "Full feature set", days: 30 },
    { id: "premium", name: "Premium", amount: 499999, currency: "NGN", tagline: "For advanced business operations", summary: "Everything plus premium store and full FELI actions", days: 30 },
  ],
  "POST /api/onboarding/startup-package/verify": { reference: "BMSP-9f2c1a", status: "success", activated: true, amount: 199999, package: { id: "starter", name: "Starter", amount: 199999, summary: "Core business features", days: 30 } },
  "GET /api/notifications/unread-count": { unreadCount: 3 },
  "GET /api/messages/unread-count": { unreadCount: 1 },
};
const products = [
  ["Classic linen shirt", "Clothing", "APP-101", "8901234567890", 22500, 28, 10, 41],
  ["Canvas tote", "Bags", "BAG-204", "8901234567891", 16500, 6, 8, 19],
  ["Polo shirt", "Clothing", "APP-118", "", 19000, 0, 10, 15],
  ["Ankara wrap dress", "Clothing", "APP-131", "8901234567893", 67500, 14, 5, 12],
  ["Leather belt", "Accessories", "ACC-022", "", 12000, 3, 6, 9],
].map(([name, category, sku, barcode, sellingPrice, stockQuantity, lowStockThreshold, totalSold], i) => ({ _id: `p${i + 1}`, name, category, sku, barcode, sellingPrice, stockQuantity, lowStockThreshold, totalSold }));
const st = (p) => p.stockQuantity <= 0 ? "out" : p.stockQuantity <= p.lowStockThreshold ? "low" : null;
Object.assign(routes, {
  "GET /api/subscriptions/current": { plan: "freemium", status: "active", startupPackage: "starter", access: { source: "startup_package", tier: "starter", unlimitedCredits: false }, features: { inventory: true, dashboard: true } },
  "GET /api/inventory/products": products,
  "GET /api/inventory/stats": { totalProducts: 5, totalStock: 51, totalInventoryValue: 2147500, totalSales: 96, stockAvailability: { available: 3, lowStock: 2, outOfStock: 1 },
    lowStockProducts: products.filter(st).map((p) => ({ _id: p._id, name: p.name, sku: p.sku, category: p.category, stock: p.stockQuantity, threshold: p.lowStockThreshold, status: st(p) })),
    topSelling: products.slice(0, 3) },
  "GET /api/inventory/products/p1/adjustments": [
    { _id: "a2", type: "increase", quantity: 12, before: 16, after: 28, reason: "Goods received", reference: "GRN-0042", actor: { _id: "u1", name: "Samuel Adebayo" }, createdAt: today.toISOString() },
    { _id: "a1", type: "initial", quantity: 16, before: 0, after: 16, reason: "Opening stock", actor: { _id: "u1", name: "Samuel Adebayo" }, createdAt: "2026-10-01T10:00:00Z" },
  ],
  "GET /api/barcode/inventory/8901234567890": [products[0]],
});
products.forEach((p) => (routes[`GET /api/inventory/products/${p._id}`] = p));
{
  const d = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString(); };
  const people = [{ _id: "u1", name: "Samuel Adebayo", avatar: null, role: "owner" }, { _id: "u2", name: "Tunde Adeyemi", avatar: null, role: "manager" }];
  const tasks = [
    { _id: "t1", title: "Review stock alerts and reorder the fast movers", status: "todo", priority: "high", assignedTo: people[1], dueDate: d(1), subtasks: [], notes: "" },
    { _id: "t2", title: "Draft launch email", status: "todo", priority: "medium", assignedTo: people[0], dueDate: d(4), subtasks: [{ _id: "s1", title: "Subject", isCompleted: true }, { _id: "s2", title: "Body", isCompleted: false }] },
    { _id: "t3", title: "Publish product photos", status: "in_progress", priority: "high", assignedTo: people[1], dueDate: d(-1), subtasks: [] },
    { _id: "t4", title: "Write landing copy", status: "completed", priority: "medium", assignedTo: people[0], dueDate: null, subtasks: [] },
  ];
  const project = { _id: "p1", name: "Storefront launch", status: "active", priority: "high", lead: people[1], members: [], tasks, progress: { total: 4, completed: 1, inProgress: 1, percent: 25 }, createdAt: d(-10) };
  Object.assign(routes, {
    "GET /api/projects": [project, { ...project, _id: "p2", name: "Seasonal campaign", lead: null, progress: { total: 2, completed: 1, inProgress: 0, percent: 50 }, tasks: [] }],
    "GET /api/projects/p1": project,
    "GET /api/projects/stats": { total: 2, active: 2, completed: 0, onHold: 0, cancelled: 0, totalTasks: 6, completedTasks: 2, todoTasks: 2, inProgressTasks: 1, overdueTasks: 1, upcomingDeadlines: 2, upcomingDays: 7 },
    "GET /api/projects/tasks": tasks.filter((t) => t.dueDate).map((t) => ({ ...t, subtasks: { total: t.subtasks.length, done: 0 }, project: { _id: "p1", name: "Storefront launch" } })),
    "GET /api/settings/team/people": people,
    "GET /api/settings/team": [{ _id: "owner-u1", isOwner: true, role: "owner", user: { _id: "u1", name: "Samuel Adebayo", email: "sam@x.com" }, permissions: {}, isActive: true }, { _id: "m1", role: "manager", user: { _id: "u2", name: "Tunde Adeyemi", email: "tunde.adeyemi@diorfactory.example" }, permissions: {}, isActive: true }],
    "GET /api/settings/team/invites": [{ _id: "i1", email: "chika@x.com", name: "Chika Okafor", role: "staff", permissions: {}, status: "pending", expiresAt: d(2), createdAt: d(0) }],
  });
  routes["GET /api/subscriptions/current"].features.projects = true;
}
routes["GET /api/invoices/i1"] = { _id: "i1", invoiceNumber: "INV-2026-4GRMM6", clientName: "Adeola Fashion House", clientEmail: "", status: "draft", tax: 0, taxAmount: 0, subtotal: 11000, total: 11000, createdAt: new Date().toISOString(),
  items: [{ description: "Test Product with a fairly long description that must wrap", quantity: 2, unitPrice: 5000, total: 10000 }, { description: "Delivery", quantity: 1, unitPrice: 1000, total: 1000 }] };
routes["GET /api/subscriptions/current"] = { plan: "premium", status: "active", features: { inventory: true, orders: true, invoices: true, analytics: true, dashboard: true } };
const dashboard = () => populated ? {
  stats: { totalProducts: 24, totalStock: 310, totalInventoryValue: 5200000, totalSales: 10000, revenue: 10000, totalOrders: 64, openInvoices: 9, lowStock: 5, totalTasks: 4, pendingTasks: 2 },
  recentOrders: [["ORD-1001", "Classic linen shirt", 45000, "completed"], ["ORD-1002", "Canvas tote", 82500, "pending"], ["ORD-1003", "Polo shirt", 19000, "completed"], ["ORD-1004", "Ankara wrap dress", 67500, "pending"]].map(([t, p, a, s], i) => ({ _id: `o${i}`, trackingNo: t, productName: p, price: a, quantity: 1, totalAmount: a, status: s, date: today.toISOString() })),
  topSelling: [["Classic linen shirt", 28], ["Canvas tote", 19], ["Polo shirt", 15]].map(([n, s], i) => ({ _id: `p${i}`, name: n, sellingPrice: 1, totalSold: s })),
  salesChart: [0, 1500, 0, 2500, 1000, 0, 5000].map((v, i) => ({ _id: day(6 - i), totalSales: v, totalOrders: v ? 1 : 0 })),
  analytics: { totalOrders: 64, sale: 80, distribute: 15, return: 5 },
} : { stats: { totalProducts: 0, totalStock: 0, totalInventoryValue: 0, totalSales: 0, revenue: 0, totalOrders: 0, openInvoices: 0, lowStock: 0, totalTasks: 0, pendingTasks: 0 }, recentOrders: [], topSelling: [], salesChart: [], analytics: { totalOrders: 0, sale: 0, distribute: 0, return: 0 } };

const mkOrder = (n) => ({ _id: `o${n}`, trackingNo: `ORD-7K2Q${String(n).padStart(2, "0")}`, items: [{ product: "p1", name: "Linen shirt", quantity: 1, unitPrice: 25000, total: 25000 }], customer: { name: `Customer ${n}` }, paymentMethod: "transfer", paymentStatus: "pending", fulfilmentStatus: "unfulfilled", status: "pending", canCancel: true, subtotal: 25000, deliveryFee: 0, totalAmount: 25000, createdAt: "2026-11-12T09:00:00Z" });
routes["GET /api/orders"] = Array.from({ length: 25 }, (_, i) => mkOrder(i + 1));
routes["GET /api/orders/stats"] = { all: 25, awaitingPayment: 25, unfulfilled: 25, completed: 0, cancelled: 0, revenue: 0 };
for (let n = 1; n <= 25; n++) routes[`GET /api/orders/o${n}`] = mkOrder(n);
routes["GET /api/subscriptions/current"].features.store = true;
const SHOP = { _id: "s1", storeName: "Elijah Apparel", storeSlug: "elijahapparel", storeUrl: "elijahapparel.bimanage.com", description: "Considered essentials, made to last beyond the season.", category: "fashion", contactEmail: "shop@elijahapparel.com", contactPhone: "+234 803 555 0190", deliveryFee: 2500, freeDeliveryAbove: 50000, template: "standard", isPublished: true, status: "published", publicUrl: "http://localhost:5174/s/elijahapparel", allowedTemplates: ["basic", "standard"], canPublish: true };
const img = (c) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='400' height='300' fill='${c}'/></svg>`)}`;
const SP = [["Classic linen shirt", 22500, "fashion_men", "#dbeafe"], ["Cotton co-ord set", 38000, "fashion_women", "#dcfce7"], ["Everyday tote bag", 12000, "bags_accessories", "#ede9fe"], ["Minimalist watch", 42500, "bags_accessories", "#e0f2fe"], ["Leather cardholder", 8500, "bags_accessories", "#fde7d9"], ["Canvas weekend bag", 28000, "bags_accessories", "#dcfce7"]]
  .map(([name, price, category, c], i) => ({ _id: `p${i + 1}`, name, sku: `APP-10${i + 1}`, price, comparePrice: i === 0 ? 28000 : null, images: [img(c)], category, stockQuantity: i === 4 ? 0 : 12 + i, isAvailable: i !== 5, inventoryProduct: i < 2 ? `inv${i}` : null, totalSold: 10 - i, totalViews: 200 - i * 20, createdAt: "2026-11-01T09:00:00Z", description: "A breathable wardrobe essential with a relaxed silhouette." }));
const pubP = (p) => ({ _id: p._id, name: p.name, price: p.price, comparePrice: p.comparePrice, images: p.images, category: p.category, description: p.description, inStock: p.stockQuantity > 0, lowStock: p.stockQuantity > 0 && p.stockQuantity <= 5 });
routes["GET /api/store/my-store"] = SHOP;
routes["GET /api/store/launch-checklist"] = { steps: [
  { key: "identity", label: "Business identity", done: true, value: "Completed", detail: "Store details", required: true },
  { key: "template", label: "Template selection", done: true, value: "Standard", detail: "Ready", required: true },
  { key: "products", label: "Inventory products", done: true, value: "5 published", detail: "Synced", required: true },
  { key: "checkout", label: "Checkout setup", done: false, value: "Paystack", detail: "Payments coming soon", required: false }],
  completed: 3, total: 4, percent: 75, products: { total: 6, published: 5 }, template: { key: "standard", name: "Standard", allowed: ["basic", "standard"] }, plan: { tier: "standard", name: "Standard", canPublish: true }, status: "published", publishedAt: "2026-11-10T09:00:00Z", canPublish: true, blockers: [], storeUrl: "http://localhost:5174/s/elijahapparel", paymentsEnabled: false, guestCheckout: true };
routes["GET /api/store/products"] = SP;
routes["GET /api/store/templates"] = { current: "standard", plan: "standard", templates: [{ key: "basic", name: "Basic", allowed: true }, { key: "standard", name: "Standard", allowed: true }, { key: "premium", name: "Premium", allowed: false }] };
routes["GET /api/store/custom-domain"] = { bimanageAddress: "https://bimanage-frontend.vercel.app/s/elijahapparel", customDomain: "shop.elijahapparel.com", verified: true, verifiedAt: "2026-11-12T09:00:00Z", status: "verified", hosting: "pending", hostingAddedAt: null, ssl: "pending_hosting", live: false, dnsInstructions: { type: "CNAME", host: "shop", name: "shop.elijahapparel.com", value: "cname.vercel-dns.com", ttl: 3600, note: "" }, planAllows: true };
routes["GET /api/store/analytics"] = { range: { key: "30d", from: "2026-10-14", to: "2026-11-12", days: 30 }, revenue: 815000, revenueChange: 12.8, orders: 38, ordersChange: 8.3, fulfilled: 32, averageOrderValue: 21447, cancelled: 1, storeViews: 2480, productViews: 1860,
  topProduct: { productId: "p1", name: "Classic linen shirt", image: null, sold: 42, revenue: 945000 }, topProducts: [{ productId: "p1", name: "Classic linen shirt", image: null, sold: 42, revenue: 945000 }, { productId: "p2", name: "Cotton co-ord set", image: null, sold: 20, revenue: 760000 }, { productId: "p3", name: "Everyday tote bag", image: null, sold: 18, revenue: 216000 }],
  series: Array.from({ length: 30 }, (_, i) => { const d = new Date(Date.UTC(2026, 9, 14 + i)); return { date: d.toISOString().slice(0, 10), revenue: (i * 7919) % 60000, orders: i % 4 }; }), payouts: { pending: 120000, available: 640000 } };
routes["GET /api/store/elijahapparel"] = { _id: "s1", storeName: SHOP.storeName, storeSlug: SHOP.storeSlug, description: SHOP.description, category: "fashion", template: "standard", contactEmail: SHOP.contactEmail, contactPhone: SHOP.contactPhone, deliveryFee: 2500, freeDeliveryAbove: 50000, acceptingOrders: true, paymentsComingSoon: false };
routes["GET /api/store/elijahapparel/products"] = { products: SP.filter((p) => p.isAvailable).map(pubP), total: 5, page: 1, totalPages: 1 };
for (const p of SP) routes[`GET /api/store/elijahapparel/products/${p._id}`] = pubP(p);
routes["GET /api/cart/elijahapparel"] = { items: [{ product: pubP(SP[0]), quantity: 1, requested: 1, available: 12, lineTotal: 22500 }, { product: pubP(SP[2]), quantity: 1, requested: 1, available: 14, lineTotal: 12000 }], itemCount: 2, subtotal: 34500, deliveryFee: 2500, total: 37000, freeDeliveryAbove: 50000 };
routes["GET /api/inventory/products"] = [{ _id: "inv0", name: "Classic linen shirt", sellingPrice: 22500, stockQuantity: 12, totalSold: 0, sku: "APP-101" }, { _id: "inv9", name: "Silk scarf", sellingPrice: 15000, stockQuantity: 7, totalSold: 0, sku: "SCF-1" }];
const SO = (n, status, isPaid) => ({ _id: `so${n}`, trackingNo: `BM-7K2Q-${String(n).padStart(4, "0")}`, customerName: ["Ada Nwosu", "Tunde Bello", "Chioma Eze"][n % 3], customerEmail: "ada@example.com", customerPhone: "+234 803 222 0180", deliveryAddress: "14 Adebayo St", city: "Yaba", state: "Lagos", notes: n === 1 ? "Call on arrival" : null, items: [{ product: "p1", productName: "Classic linen shirt", productImage: SP[0].images[0], price: 22500, quantity: 2, total: 45000 }, { product: "p3", productName: "Everyday tote bag", productImage: SP[2].images[0], price: 12000, quantity: 1, total: 12000 }], subtotal: 57000, deliveryFee: 0, total: 57000, commissionRate: 3, commissionAmount: 1710, vendorPayout: 55290, status, isPaid, paidAt: isPaid ? "2026-11-12T09:05:00Z" : null, statusHistory: isPaid ? [{ status: "payment_confirmed", at: "2026-11-12T09:05:00Z" }] : [], createdAt: "2026-11-12T09:00:00Z", nextStatuses: status === "payment_confirmed" ? ["processing", "shipped", "cancelled"] : status === "pending" ? ["cancelled"] : [] });
const SOS = [SO(1, "payment_confirmed", true), SO(2, "processing", true), SO(3, "shipped", true), SO(4, "completed", true), SO(5, "pending", false), SO(6, "cancelled", true)];
routes["GET /api/store-orders/my-orders"] = { orders: SOS, total: 6, page: 1, totalPages: 1 };
for (const o of SOS) routes[`GET /api/store-orders/${o._id}`] = o;
const WAL = { balance: 735000, pendingBalance: 445000, totalEarned: 1180000, totalWithdrawn: 359875, totalCommissionPaid: 0, test: { balance: 4850, pendingBalance: 58200, totalEarned: 63050 }, bank: { bankName: "GTBank", bankCode: "058", accountName: "ELIJAH APPAREL LTD", last4: "9921", verified: true }, schedule: { interval: "weekly", days: 7, nextWithdrawalDate: "2026-11-01T00:00:00Z", eligibleNow: true, lastWithdrawalAt: "2026-10-18T09:00:00Z", notificationEmail: "hello@elijahapparel.com", payoutReminder: true, timezone: "Africa/Lagos" }, fees: { withdrawalRate: 0, paystackTransferFee: true, minWithdrawal: 1000 }, paymentsMode: "live", payoutsCount: 12 };
const WTX = [
  { _id: "wt1", type: "credit", amount: 37000, fee: 0, description: "Store order", reference: "BMS-1034", status: "pending", mode: "live", order: { _id: "o1", trackingNo: "BM-7K2Q-1034" }, createdAt: "2026-10-24T09:00:00Z" },
  { _id: "wt2", type: "credit", amount: 78000, fee: 0, description: "Store order", reference: "BMS-1033", status: "pending", mode: "live", order: { _id: "o2", trackingNo: "BM-7K2Q-1033" }, createdAt: "2026-10-23T09:00:00Z" },
  { _id: "wt3", type: "withdrawal", amount: 214325, grossAmount: 214375, fee: 50, paystackFee: 50, description: "Payout to GTBank •••• 9921", reference: "BMW-18", status: "completed", mode: "live", order: null, createdAt: "2026-10-18T09:00:00Z" },
  { _id: "wt4", type: "credit", amount: 4850, fee: 0, description: "Store order", reference: "BMS-T1", status: "pending", mode: "test", order: { _id: "o4", trackingNo: "BM-WYYZ-KJDF" }, createdAt: "2026-11-12T21:58:00Z" },
];
routes["GET /api/wallet"] = WAL;
routes["GET /api/wallet/transactions"] = { transactions: WTX, total: 4, page: 1, totalPages: 1 };
routes["GET /api/wallet/banks"] = { banks: [{ name: "Access Bank", code: "044" }, { name: "GTBank", code: "058" }] };
routes["GET /api/wallet/withdrawal-quote"] = { amount: 250000, bimanageFee: 0, bimanageFeeRate: 0, paystackFee: 50, fee: 50, net: 249950, available: 735000, testBalance: 4850, canWithdraw: true, reasons: [], nextWithdrawalDate: "2026-11-01T00:00:00Z", bank: WAL.bank, minWithdrawal: 1000 };
routes["GET /api/wallet/transactions/wfail"] = { _id: "wfail", type: "withdrawal", amount: 242450, grossAmount: 242500, fee: 50, paystackFee: 50, description: "Payout to GTBank •••• 9921", reference: "BMW-0032", status: "failed", mode: "live", failureReason: "Account could not be credited", order: null, createdAt: "2026-11-12T09:00:00Z", bank: WAL.bank, related: [] };
const TESTMODE_WAL = { ...WAL, balance: 0, pendingBalance: 0, totalEarned: 0, totalWithdrawn: 0, payoutsCount: 0, bank: null, paymentsMode: "test", test: { balance: 140650, pendingBalance: 0, totalEarned: 140650 }, schedule: { ...WAL.schedule, nextWithdrawalDate: "2026-11-19T00:00:00Z", eligibleNow: false } };
routes["GET /api/wallet"] = TESTMODE_WAL;
routes["GET /api/wallet/transactions"] = { transactions: [{ _id: "a1", type: "credit", amount: 77600, fee: 0, description: "Store order", reference: "BMS-3", status: "completed", mode: "test", order: { _id: "o9", trackingNo: "BM-J9ZV-CJ4A" }, createdAt: "2026-11-12T22:30:00Z" }, { _id: "a2", type: "credit", amount: 58200, fee: 0, description: "Store order", reference: "BMS-2", status: "completed", mode: "test", order: { _id: "o8", trackingNo: "BM-EA3R-4RHF" }, createdAt: "2026-11-12T22:10:00Z" }, { _id: "a3", type: "credit", amount: 4850, fee: 0, description: "Store order", reference: "BMS-1", status: "completed", mode: "test", order: { _id: "o7", trackingNo: "BM-WYYZ-KJDF" }, createdAt: "2026-11-12T21:58:00Z" }], total: 3, page: 1, totalPages: 1 };
routes["GET /api/wallet/withdrawal-quote"] = { amount: 0, bimanageFee: 0, bimanageFeeRate: 0, paystackFee: 0, fee: 0, net: 0, available: 0, testBalance: 140650, canWithdraw: false, reasons: [{ code: "no_bank", message: "Link and verify a bank account first." }, { code: "test_mode", message: "Payouts are only possible with real (live) payments. Test money can't be withdrawn." }], nextWithdrawalDate: "2026-11-19T00:00:00Z", bank: null, minWithdrawal: 1000 };
const BANKS15 = [{"name":"OPay Digital Services Limited (OPay)","code":"100"},{"name":"Moniepoint MFB","code":"101"},{"name":"PalmPay","code":"102"},{"name":"Guaranty Trust Bank","code":"103"},{"name":"Access Bank","code":"104"},{"name":"Zenith Bank","code":"105"},{"name":"First Bank of Nigeria","code":"106"},{"name":"United Bank For Africa","code":"107"},{"name":"Kuda Bank","code":"108"},{"name":"Fidelity Bank","code":"109"},{"name":"5TT MFB","code":"110"},{"name":"78 Finance Company Ltd","code":"111"},{"name":"9jaPay Microfinance Bank","code":"112"},{"name":"Abbey Mortgage Bank","code":"113"},{"name":"Wema Bank","code":"114"}];
routes["GET /api/wallet/banks"] = { banks: BANKS15 };

// SUBS07: subscription screens
const F_FREE = { dashboard: true, store: "view_only", inventory: true, orders: true, analytics: true };
const F_STD = { ...F_FREE, store: true, invoices: true, projects: true, messages: true };
const F_PREM = { ...F_STD, bisupplynet: true, automation: true, socialMedia: true };
const CP = [{ action: "ADD_PRODUCT", label: "Adding a product", cost: 5 }, { action: "CREATE_ORDER", label: "Creating an order", cost: 5 }, { action: "VIEW_ANALYTICS", label: "Viewing analytics", cost: 5, perDay: true }, { action: "VIEW_INVENTORY", label: "Opening inventory", cost: 2, perDay: true }];
routes["GET /api/subscriptions/plans"] = [
  { id: "freemium", name: "Freemium", price: { monthly: 0, yearly: 0 }, description: "Get started for free with 100 daily credits", features: F_FREE, credits: 100, creditPrices: CP, pricesConfirmed: true, paymentsAvailable: true },
  { id: "standard", name: "Standard", price: { monthly: 15000, yearly: 150000 }, description: "Full access to core business tools", features: F_STD, credits: "unlimited", pricesConfirmed: false, paymentsAvailable: true },
  { id: "premium", name: "Premium", price: { monthly: 35000, yearly: 350000 }, description: "Complete suite including BiSupplyNet and automation", features: F_PREM, credits: "unlimited", pricesConfirmed: false, paymentsAvailable: true },
];
routes["GET /api/subscriptions/current"] = { plan: "standard", status: "active", billingCycle: "monthly", price: 15000, paymentMode: "test", currentPeriodStart: "2026-11-13T10:00:00Z", currentPeriodEnd: "2026-12-13T10:00:00Z", cancelAtPeriodEnd: false, pendingChange: null, access: { source: "plan", tier: "standard", unlimitedCredits: true }, features: { ...F_STD, store: true }, credits: { daily: 100, used: 0, remaining: 100, resetsAt: "2026-11-13T23:00:00Z", unlimited: true } };
routes["GET /api/subscriptions/usage"] = { unlimited: false, credits: { daily: 100, used: 62, remaining: 38, resetsAt: "2026-11-13T23:00:00Z", timezone: "Africa/Lagos" }, dayPasses: ["VIEW_ANALYTICS"], byAction: [{ action: "ADD_PRODUCT", label: "Adding a product", times: 8, credits: 40 }, { action: "CREATE_ORDER", label: "Creating an order", times: 3, credits: 15 }, { action: "VIEW_ANALYTICS", label: "Viewing analytics", times: 1, credits: 5 }, { action: "VIEW_INVENTORY", label: "Opening inventory", times: 1, credits: 2 }], recent: [], prices: CP };
routes["GET /api/subscriptions/quote"] = { type: "upgrade", plan: "premium", billingCycle: "monthly", currentPlan: "standard", currentBillingCycle: "monthly", currency: "NGN", pricesConfirmed: false, paymentsAvailable: true, amount: 35000, effectiveAt: "2026-11-13T10:00:00Z", periodEnd: "2026-12-13T10:00:00Z", nextChargeAt: "2026-12-13T10:00:00Z", nextChargeAmount: 35000, notes: ["Your Standard (monthly) plan stops renewing. Unused days aren't refunded."], message: "Pay NGN 35,000 now. Premium (monthly) starts today and renews on Sun Dec 13 2026." };
routes["GET /api/subscriptions/billing-history"] = { payments: [
  { id: "p3", reference: "BMSUB-9f2c41aa", description: "Standard (monthly)", purpose: "subscription", kind: "initial", amount: 15000, currency: "NGN", status: "success", mode: "test", paidAt: "2026-11-13T10:00:00Z", createdAt: "2026-11-13T10:00:00Z", periodStart: "2026-11-13T10:00:00Z", periodEnd: "2026-12-13T10:00:00Z", failureReason: null, hasReceipt: true },
  { id: "p2", reference: "BMSUB-77aa01", description: "Standard (monthly)", purpose: "subscription", kind: "initial", amount: 15000, currency: "NGN", status: "failed", mode: "test", paidAt: null, createdAt: "2026-11-12T18:00:00Z", periodStart: null, periodEnd: null, failureReason: "Declined", hasReceipt: false },
  { id: "p1", reference: "BMP-1", description: "Starter startup package (30 days)", purpose: "startup_package", kind: null, amount: 199999, currency: "NGN", status: "success", mode: "test", paidAt: "2026-11-02T09:00:00Z", createdAt: "2026-11-02T09:00:00Z", periodStart: null, periodEnd: null, failureReason: null, hasReceipt: true },
], total: 3, page: 1, totalPages: 1 };

// P12MOCK: phase 12 screens
const P12NOW = new Date().toISOString();
const P12ROW = (id, type, title, last, unread, label) => ({ _id: id, type, title, counterpart: { kind: "business", id: "b" + id }, related: label ? { kind: "supply_order", id: "o1", label } : null, lastMessage: { content: last, hasAttachments: false, at: P12NOW, mine: false }, lastMessageAt: P12NOW, unread, muted: false, blocked: null });
routes["GET /api/messages/conversations"] = { conversations: [
  P12ROW("c1", "supplier", "Apex Agro Supplies Limited Nigeria", "Order received, packing begins today and we'll confirm dispatch", 2, "BSN-0812"),
  P12ROW("c2", "guest", "Ada Nwosu (guest)", "Is the linen shirt in stock in size M?", 1),
  P12ROW("c3", "customer", "Tunde Adeyemi", "Thanks for the invoice", 0),
  P12ROW("c4", "team", "Operations team", "The launch task is complete.", 0),
], page: 1, hasMore: false };
routes["GET /api/messages/conversations/c1"] = { conversation: { _id: "c1", type: "supplier", title: "Apex Agro Supplies Limited Nigeria", related: { kind: "supply_order", id: "o1", label: "BSN-0812" }, muted: false, blocked: null }, messages: [
  { _id: "m1", content: "Order received. Packing begins today and we will confirm dispatch tomorrow morning once the courier collects.", attachments: [], sender: { name: "Apex Agro" }, mine: false, createdAt: P12NOW },
  { _id: "m2", content: "Thanks for the update. Please send the ETA and the waybill number when you have it: averyveryverylongwordwithoutanyspacesthatcouldbreakthelayout", attachments: [{ url: "https://example.com/waybill.pdf", name: "waybill-scan-november-2026-final.pdf", type: "application/pdf", size: 240000 }], sender: { name: "Samuel Adebayo" }, mine: true, createdAt: P12NOW },
], page: 1, hasMore: true };
routes["GET /api/messages/contacts"] = { contacts: [{ id: "w1", name: "Lagos Trade Hub", avatar: null, kind: "supplier" }] };
routes["GET /api/notifications/summary"] = { all: 18, unread: 5, orders: 6, lowStock: 3 };
routes["GET /api/notifications"] = { notifications: [
  { _id: "n1", title: "New store order: paid", message: "Order BM-7K2Q-9MXA from Ada Nwosu: NGN 45,000.", type: "order", isRead: false, link: "/store/orders", createdAt: P12NOW },
  { _id: "n2", title: "Low stock: Classic linen shirt", message: "Only 2 left. Restock soon to keep selling.", type: "inventory", isRead: true, link: "/inventory", createdAt: P12NOW },
  { _id: "n3", title: "Payout sent", message: "NGN 120,000 has been sent to Guaranty Trust Bank.", type: "payment", isRead: true, link: null, createdAt: P12NOW },
], total: 3, page: 1, totalPages: 1 };
const P12ALL = { inApp: true, email: true };
routes["GET /api/notifications/preferences"] = { preferences: { orders: P12ALL, inventory: P12ALL, messages: P12ALL, subscriptions: P12ALL, withdrawals: P12ALL }, mandatory: ["security", "payment"], categories: ["orders", "inventory", "messages", "subscriptions", "withdrawals"] };
routes["GET /api/support/tickets"] = { tickets: [{ _id: "t1", ticketNumber: "TKT-00042", subject: "Withdrawal not received after three working days", category: "wallet", priority: "medium", status: "awaiting_reply", relatedReference: "WD-2026-0032", replyCount: 2, lastReplyAt: P12NOW, lastReplyBy: "admin", createdAt: P12NOW, updatedAt: P12NOW }], total: 1, page: 1, totalPages: 1 };
routes["GET /api/support/tickets/t1"] = { _id: "t1", ticketNumber: "TKT-00042", subject: "Withdrawal not received after three working days", message: "My payout WD-2026-0032 hasn't arrived.", category: "wallet", priority: "medium", status: "awaiting_reply", relatedReference: "WD-2026-0032", contactEmail: "sam@x.com", attachments: [], replies: [{ _id: "r1", by: "admin", message: "Which bank account did you use? We're checking with Paystack.", attachments: [], createdAt: P12NOW }], createdAt: P12NOW, updatedAt: P12NOW, meta: { issueContext: { path: "/wallet/withdrawals?status=pending&page=2", screen: "Wallet", appVersion: "2026.11.16-a1b2c3d", userAgent: "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.135 Mobile Safari/537.36", viewport: "390x844", timezone: "Africa/Lagos", occurredAt: P12NOW } } };
routes["POST /api/support/issues"] = { ticket: { _id: "t1", ticketNumber: "TKT-00042", subject: "Technical issue: The orders page went blank", status: "open" }, message: "Thanks — we've logged this as ticket TKT-00042. We'll reply in Support tickets." };
routes["GET /api/support/service-requests"] = { requests: [], total: 0, page: 1, totalPages: 1 };
routes["GET /api/support/faqs"] = [
  { _id: "f1", question: "How do payouts work and when does my money become available?", answer: "Store earnings become available when an order completes.", category: "wallet", readMinutes: 4, helpfulCount: 3, updatedAt: P12NOW },
  { _id: "f2", question: "Connect your online store to a custom domain", answer: "Go to Online Store, Domain.", category: "store", readMinutes: 3, helpfulCount: 1, updatedAt: P12NOW },
  { _id: "f3", slug: "publish-your-store", question: "How to publish your store", summary: "Finish the readiness steps and make your store live for customers.", answer: "1. Go to **Online Store**.", category: "store", readMinutes: 1, helpfulCount: 0, updatedAt: P12NOW },
];
// A written article (markdown-lite: steps with sub-points, bold, links, notes).
routes["GET /api/support/faqs/f1"] = {
  _id: "f1",
  slug: "how-wallet-works",
  question: "How do payouts work and when does my money become available?",
  summary: "Where your store earnings go, and when you can withdraw them to your bank account.",
  answer:
    "1. Go to **Wallet**. The **Wallet overview** shows **Total earnings**, **Available**, **On hold** and **Payouts**.\n2. Complete each step:\n   - **Business identity**: store name, category, description, and an email or phone.\n   - **Inventory products**: at least one published product.\n3. When the order is completed, the money becomes **Available** to withdraw.\n\n**Note:** BiManage's commission is taken when a sale is paid, not when you withdraw. A very long word to test wrapping: supercalifragilisticexpialidocious-withdrawal-schedule-reference.\n\n- **Your money is still on hold.** Store earnings become available when the order is completed.\n- **No verified bank account.** Add one under **Bank account**.\n\nRelated: [Withdraw to your bank](/support/help/withdraw-to-bank), [Set your withdrawal schedule](/support/help/withdrawal-schedule)",
  category: "wallet",
  readMinutes: 1,
  helpfulCount: 3,
  updatedAt: P12NOW,
};
routes["GET /api/reviews"] = { reviews: [{ _id: "r1", headline: "Saves me hours every week", rating: 5, review: "Inventory and orders in one place. The store setup was easy.", category: "product_experience", featuresUsed: ["inventory", "orders", "store"], businessName: "Elijah Apparel Ltd", reviewer: { name: "Elijah", avatar: null }, isVerified: true, edited: false, createdAt: P12NOW, updatedAt: P12NOW }], total: 1, page: 1, totalPages: 1, stats: { averageRating: 4.5, totalReviews: 2, ratingBreakdown: { 5: 1, 4: 1, 3: 0, 2: 0, 1: 0 } } };
routes["GET /api/subscriptions/current"] = { ...(routes["GET /api/subscriptions/current"] || {}), features: { ...((routes["GET /api/subscriptions/current"] || {}).features || {}), messages: true } };
// FELI11
let feliMode = "task";
const FNOW = new Date().toISOString();
const FMSGS = [
  { role: "user", content: "Hi FELI, what can you help me with in my business today?", createdAt: FNOW },
  { role: "assistant", content: "I can help you with:\n\n- Answering questions about how BiManage works and where to find things.\n- Summarising your **orders, invoices and projects**.\n- Proposing a support ticket or a new project task.\n- Connecting you with the BiManage support team.\n\nYou have unlimited FELI messages on your Standard plan.", createdAt: FNOW },
  { role: "user", content: "Add a task to reorder the canvas totes before Friday, averyveryverylongwordwithoutanyspacesthatcouldbreakthelayout", createdAt: FNOW },
  { role: "assistant", content: "Here's a task for you to review. Nothing is added until you approve it.", createdAt: FNOW },
];
const FPROP = {
  task: { id: "fp1", action: "create_task", label: "Create a project task", module: "Projects", params: { projectId: "p1", assignedTo: "u2", title: "Reorder canvas totes", description: "Stock is down to 6; reorder 40 from Lagos Trade Hub.", priority: "high", dueDate: "2026-11-20" }, missing: [], requiredPlan: "standard", proposedAt: FNOW },
  invoice: { id: "fp2", action: "create_invoice", label: "Draft an invoice", module: "Invoices", params: { clientName: "Tola Adeyemi Fashion House Limited", clientEmail: "tola@example.com", items: [{ description: "Ankara wrap dress, size M, custom fitting", quantity: 2, unitPrice: 67500 }, { description: "Delivery within Lagos", quantity: 1, unitPrice: 3500 }], tax: 7.5, dueDate: "2026-11-27", notes: "Thank you for your order." }, missing: [], requiredPlan: "premium", proposedAt: FNOW },
  ticket: { id: "fp3", action: "open_support_ticket", label: "Create a support ticket", module: "Support", params: { subject: "Payout not received", message: "My payout from 10 Nov hasn't arrived.", category: "wallet", priority: "high" }, missing: [], requiredPlan: "standard", proposedAt: FNOW },
};
const fUsage = () => feliMode === "limit" ? { unlimited: false, limit: 20, used: 20, remaining: 0, resetsAt: "2026-11-13T23:00:00Z" } : { unlimited: true, limit: null, used: 0, remaining: null, resetsAt: null };
const feliRoute = (key) => {
  if (key === "GET /api/feli/history") return { messages: feliMode === "empty" || feliMode === "limit" ? [] : FMSGS, proposal: FPROP[feliMode] || null, usage: fUsage() };
  if (key === "GET /api/feli/usage") return { usage: fUsage(), actions: feliMode === "invoice" ? ["open_support_ticket", "create_task", "create_invoice", "send_invoice", "update_order_status"] : ["open_support_ticket", "create_task"], tier: feliMode === "invoice" ? "premium" : feliMode === "limit" ? "freemium" : "standard" };
  if (key === "GET /api/feli/suggestions") return { suggestions: ["Which products are running low?", "How did sales go this week?", "How do payouts work?", "Help me plan this week's tasks"] };
  return null;
};
// BSN10
const { BSN_ROUTES } = await import("./fixtures/bisupplynet.mjs");
Object.assign(routes, BSN_ROUTES);
// P13
const { ADMIN_ROUTES } = await import("./fixtures/admin.mjs");
const { P13_ROUTES } = await import("./fixtures/account.mjs");
Object.assign(routes, P13_ROUTES, ADMIN_ROUTES);
routes["GET /api/business-profile"] = { ...routes["GET /api/business-profile"], owner: { name: "Samuel Adebayo" }, store: { name: "Dior Factory", slug: "diorfactory", url: "diorfactory.bimanage.com", customDomain: null, published: true }, completeness: { completed: 6, total: 8, percent: 75, missing: ["logo", "businessDescription"] } };
routes["GET /api/subscriptions/current"] = { ...routes["GET /api/subscriptions/current"], features: { ...(routes["GET /api/subscriptions/current"].features||{}), analytics: true, orders: true, invoices: true } };
// Customers (09.01–09.03).
{
  const cust = (i, name, email, phone, n, spent) => ({ _id: "c" + i, name, email, phone, address: { line: "14 Adebayo St", city: "Yaba", state: "Lagos" }, tags: i === 1 ? ["VIP"] : [], notes: "", source: "order",
    stats: { ordersCount: n, invoicesCount: 1, totalSpent: spent, averageOrder: Math.round(spent / n), lastOrderAt: "2026-11-12T09:00:00Z", firstSeenAt: "2026-08-01T09:00:00Z", lastSeenAt: "2026-11-12T09:00:00Z" }, createdAt: "2026-08-01T09:00:00Z", updatedAt: "2026-11-12T09:00:00Z" });
  const list = [cust(1, "Ada Nwosu", "ada@example.com", "+234 803 222 0180", 6, 342000), cust(2, "Tunde Bello", "tunde@example.com", "+234 803 222 0181", 3, 121500), cust(3, "Chioma Eze", "chioma@example.com", null, 1, 45000)];
  routes["GET /api/customers"] = { customers: list, total: list.length, page: 1, totalPages: 1, tags: ["VIP"] };
  routes["GET /api/customers/stats"] = { total: 3, newThisMonth: 1, repeat: 2, totalSpent: 508500 };
  routes["GET /api/customers/c1"] = { customer: list[0], orders: [{ _id: "o1", channel: "online", reference: "BM-7K2Q-0001", total: 57000, status: "completed", createdAt: "2026-11-12T09:00:00Z" }], invoices: [{ _id: "i1", invoiceNumber: "INV-2026-4GRMM6", total: 11000, status: "draft", createdAt: "2026-11-10T09:00:00Z" }], conversation: { _id: "c1" } };
}

// Public landing endpoints (signed-out "/").
routes["GET /api/public/plans"] = { currency: "NGN", plans: routes["GET /api/subscriptions/plans"], startupPackages: [{ id: "starter", name: "Starter", amount: 199999, currency: "NGN", summary: "Core business features for 30 days", days: 30 }] };
routes["GET /api/public/stats"] = { businesses: { count: 12, show: false }, storesLive: { count: 3, show: false }, ordersProcessed: { count: 40, show: false }, reviews: { count: 1, average: 5, show: false } };
routes["GET /api/support/faqs"] ||= [];

// Optional overlay (e.g. the marketing sample business): FIXTURE_OVERLAY=path/to/module.mjs
let overlayRename = null;
if (process.env.FIXTURE_OVERLAY) {
  const { pathToFileURL } = await import("node:url");
  const { resolve } = await import("node:path");
  const m = await import(pathToFileURL(resolve(process.env.FIXTURE_OVERLAY)).href);
  m.apply(routes);
  overlayRename = m.rename ?? null;
}

// ── Long data: the worst realistic values a screen must still handle ──
let long = process.env.LAYOUT_LONG === "1";
const LONG_NAME = " Adewale-Okonkwo Enterprises International Limited";
const LONG_TEXT = " — with a much longer description than usual that has to wrap neatly across several lines on a phone";
const NAMEISH = /^(name|storeName|businessName|clientName|customerName|productName|fullName|title|subject|projectTitle|headline|label|companyName|accountName|bankName|counterpartName)$/;
const MONEY = /^(amount|price|total|subtotal|balance|pendingBalance|totalEarned|totalWithdrawn|revenue|totalSales|sellingPrice|pricePerUnit|unitPrice|lineTotal|grossAmount|net|available|totalInventoryValue|vendorPayout|averageOrderValue|totalAmount|value|spend|gmv)$/;
const EMAILISH = /^(email|contactEmail|clientEmail|customerEmail|businessEmail|notificationEmail)$/;
function stretch(v, key = "") {
  if (Array.isArray(v)) {
    // Many items: lists get at least 12 rows.
    const base = v.map((x) => stretch(x, key));
    if (base.length > 0 && base.length < 12 && typeof base[0] === "object" && base[0] && "_id" in base[0]) {
      const extra = Array.from({ length: 12 - base.length }, (_, i) => ({ ...base[i % base.length], _id: `${base[i % base.length]._id}-x${i}` }));
      return [...base, ...extra];
    }
    return base;
  }
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, stretch(x, k)]));
  if (typeof v === "string") {
    if (EMAILISH.test(key) && v.includes("@")) return v.replace("@", ".operations.department.lagos@");
    if (NAMEISH.test(key) && v.length < 60) return v + LONG_NAME;
    if (/^(description|message|content|notes|review|answer|reason)$/.test(key) && v.length < 120) return v + LONG_TEXT;
    return v;
  }
  if (typeof v === "number" && MONEY.test(key) && v > 0) return v < 1000 ? v : 987654321.5;
  return v;
}

http.createServer((req, res) => {
  const cors = { "Access-Control-Allow-Origin": req.headers.origin ?? "*", "Access-Control-Allow-Headers": "content-type,authorization,x-session-id", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS", "Content-Type": "application/json" };
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  const path = req.url.split("?")[0];
  if (path === "/__mode/empty") populated = false;
  if (path === "/__mode/populated") populated = true;
  if (path.startsWith("/__feli/")) feliMode = path.slice(8);
  const key = `${req.method} ${path}`;
  // Like the real API: no token, no session (signed-out pages stay signed out).
  if (key === "GET /api/auth/me" && !req.headers.authorization) { res.writeHead(401, cors); return res.end(JSON.stringify({ message: "Not authorized" })); }
  // PAGED: list endpoints that page when asked (?page=)
  const qs = new URL(req.url, "http://x").searchParams;
  if (qs.has("page") && (key === "GET /api/orders" || key === "GET /api/inventory/products")) { const items = Array.from({ length: 3 }, () => routes[key]).flat().map((o, i) => ({ ...o, _id: `${o._id}-${i}` })); const name = key.endsWith("orders") ? "orders" : "products"; res.writeHead(200, cors); return res.end(JSON.stringify({ [name]: items.slice(0, 30), total: items.length + 12, page: Number(qs.get("page")), totalPages: 2 })); }
  if (path === "/__mode/long") long = true;
  if (path === "/__mode/normal") long = false;
  if (path.startsWith("/__mode/")) { res.writeHead(200, cors); return res.end(JSON.stringify({ long, populated })); }
  let body = key === "GET /api/dashboard" ? (routes.__dashboard ?? dashboard()) : feliRoute(key) ?? routes[key];
  if (body && overlayRename && key !== "GET /api/dashboard") body = overlayRename(body);
  // Writes succeed with an empty object so forms and dialogs can be opened and submitted.
  if (!body && req.method !== "GET") body = { message: "ok" };
  if (body && long) body = stretch(body);
  res.writeHead(body ? 200 : 404, cors);
  res.end(JSON.stringify(body ?? { message: `no fixture for ${key}` }));
}).listen(port, () => console.log(`mock api on ${port}`));
