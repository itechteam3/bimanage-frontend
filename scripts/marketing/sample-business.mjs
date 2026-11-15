// Sample business for marketing screenshots (scripts/marketing/screenshots.mjs).
// Loaded by the fixture API (scripts/layout/mock-api.mjs) when
// FIXTURE_OVERLAY points here. EVERYTHING IS INVENTED: the business, people,
// emails (example.com, reserved for examples) and phone numbers (the
// +234 800 555 01xx range, not real subscribers). Never put a real
// customer's data in this file.

export const SAMPLE = {
  business: "Adunni Fashion House",
  owner: "Adunni Bello",
  slug: "adunnifashion",
  email: "hello@adunnifashion.example",
  phone: "+234 800 555 0100",
};

// Fixture names → sample names (applied to every response and route key).
const RENAMES = [
  ["Dior Factory LTD.", SAMPLE.business],
  ["Dior Factory", SAMPLE.business],
  ["Elijah Apparel Ltd", `${SAMPLE.business} Ltd`],
  ["ELIJAH APPAREL LTD", "ADUNNI FASHION HOUSE LTD"],
  ["Elijah Apparel", SAMPLE.business],
  ["elijahapparel.bimanage.com", `${SAMPLE.slug}.bimanage.com`],
  ["elijahapparel.com", "adunnifashion.example"],
  ["elijahapparel", SAMPLE.slug],
  ["Samuel Adebayo", SAMPLE.owner],
  ["sam@x.com", "adunni@adunnifashion.example"],
  ["@x.com", "@example.com"],
  // Layout stress text in the base fixtures is not for marketing.
  [", averyveryverylongwordwithoutanyspacesthatcouldbreakthelayout", ""],
  [": averyveryverylongwordwithoutanyspacesthatcouldbreakthelayout", ""],
  ["averyveryverylongwordwithoutanyspacesthatcouldbreakthelayout", ""],
  ["dior.example", "adunnifashion.example"],
];
const PHONE = /\+234 ?\d{3} ?\d{3} ?\d{4}/g;
let phoneN = 0;
const phones = new Map();
const fakePhone = (p) => {
  if (!phones.has(p)) phones.set(p, `+234 800 555 01${String(10 + (phoneN++ % 89)).padStart(2, "0")}`);
  return phones.get(p);
};
const NAMES = ["Tolani Adeyemi", "Chinedu Okafor", "Zainab Musa", "Kemi Ogunleye", "Ifeoma Nwankwo", "Babatunde Ajayi", "Halima Bello", "Segun Adekunle", "Amaka Eze", "Femi Oladipo", "Ngozi Obi", "Yusuf Danjuma"];
export const renameText = (s) => {
  const placeholder = /^Customer (d+)$/.exec(s);
  if (placeholder) return NAMES[(Number(placeholder[1]) - 1) % NAMES.length];
  let out = s;
  for (const [a, b] of RENAMES) out = out.split(a).join(b);
  return out.replace(PHONE, fakePhone);
};
export const rename = (v) => {
  if (Array.isArray(v)) return v.map(rename);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, rename(x)]));
  return typeof v === "string" ? renameText(v) : v;
};

const daysAgo = (n, h = 10) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, 0, 0, 0); return d.toISOString(); };
const day = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }; };

// A believable week for a small Lagos fashion business (plausible, not a claim).
const dashboard = {
  stats: { totalProducts: 48, totalStock: 612, totalInventoryValue: 8450000, totalSales: 1286500, revenue: 1286500, totalOrders: 142, openInvoices: 6, lowStock: 4, totalTasks: 9, pendingTasks: 4 },
  recentOrders: [["ORD-2041", "Ankara wrap dress", 67500, "completed"], ["ORD-2040", "Adire two-piece set", 54000, "pending"], ["ORD-2039", "Classic linen shirt", 22500, "completed"], ["ORD-2038", "Leather slides", 18000, "completed"]]
    .map(([trackingNo, productName, totalAmount, status], i) => ({ _id: `ro${i}`, trackingNo, productName, totalAmount, status, createdAt: daysAgo(i) })),
  topSelling: [["Ankara wrap dress", 64], ["Classic linen shirt", 51], ["Adire two-piece set", 38]].map(([name, totalSold], i) => ({ _id: `ts${i}`, name, sellingPrice: 1, totalSold })),
  salesChart: [148000, 162500, 121000, 189500, 204000, 236500, 225000].map((totalSales, i) => ({ _id: day(6 - i), totalSales, totalOrders: Math.round(totalSales / 9000) })),
  analytics: { totalOrders: 142, sale: 82, distribute: 13, return: 5 },
};

const C = (id, name, email, tags, ordersCount, totalSpent, last, source = "order") => ({
  _id: id, name, email, phone: fakePhone(`c-${id}`), address: { city: "Lagos", state: "Lagos" }, tags, notes: "", source,
  stats: { ordersCount, invoicesCount: Math.floor(ordersCount / 3), totalSpent, averageOrder: Math.round(totalSpent / Math.max(1, ordersCount)), lastOrderAt: daysAgo(last), firstSeenAt: daysAgo(120), lastSeenAt: daysAgo(last) },
  createdAt: daysAgo(120), updatedAt: daysAgo(last),
});
const customers = [
  C("c1", "Tolani Adeyemi", "tolani.a@example.com", ["VIP"], 12, 684000, 1),
  C("c2", "Chinedu Okafor", "chinedu.o@example.com", ["Wholesale"], 9, 512500, 2),
  C("c3", "Zainab Musa", "zainab.m@example.com", [], 7, 296000, 3, "store"),
  C("c4", "Kemi Ogunleye", "kemi.o@example.com", ["VIP"], 6, 288500, 5),
  C("c5", "Ifeoma Nwankwo", "ifeoma.n@example.com", [], 4, 174000, 6, "store"),
  C("c6", "Babatunde Ajayi", "tunde.ajayi@example.com", ["Corporate"], 3, 162000, 8, "invoice"),
  C("c7", "Halima Bello", "halima.b@example.com", [], 3, 97500, 11, "store"),
  C("c8", "Segun Adekunle", "segun.a@example.com", [], 2, 81000, 14),
  C("c9", "Amaka Eze", "amaka.e@example.com", ["New"], 1, 45000, 16, "store"),
  C("c10", "Femi Oladipo", "femi.o@example.com", [], 1, 22500, 21, "manual"),
];

export function apply(routes) {
  routes.__dashboard = dashboard;
  routes["GET /api/customers"] = { customers, total: customers.length, page: 1, totalPages: 1, tags: ["Corporate", "New", "VIP", "Wholesale"] };
  routes["GET /api/customers/stats"] = { total: 186, newThisMonth: 23, repeat: 74, totalSpent: 9842500 };
  routes["GET /api/customers/c1"] = {
    customer: { ...customers[0], notes: "Prefers delivery on Saturdays. Loves the new Adire collection.", address: { line: "12 Admiralty Way, Lekki Phase 1", city: "Lagos", state: "Lagos" } },
    orders: [
      { _id: "o1", channel: "online", reference: "BM-7K2Q-2041", total: 67500, status: "completed", createdAt: daysAgo(1) },
      { _id: "o2", channel: "in_person", reference: "ORD-1988", total: 54000, status: "completed", createdAt: daysAgo(9) },
      { _id: "o3", channel: "online", reference: "BM-7K2Q-1930", total: 45000, status: "completed", createdAt: daysAgo(18) },
    ],
    invoices: [{ _id: "i1", invoiceNumber: "INV-2026-0187", total: 162000, status: "paid", createdAt: daysAgo(12) }],
    conversation: null,
  };
  // Onboarding finished (no setup banner on the dashboard).
  const steps = routes["GET /api/onboarding/steps"];
  if (steps) routes["GET /api/onboarding/steps"] = { ...steps, completedCount: steps.totalSteps, isComplete: true, percentage: 100, steps: steps.steps.map((x) => ({ ...x, completed: true })) };
  // No test-mode money in marketing shots.
  for (const k of Object.keys(routes)) if (k.startsWith("GET /api/analytics/") && routes[k] && typeof routes[k] === "object" && "test" in routes[k]) routes[k] = { ...routes[k], test: { orders: 0, revenue: 0, label: "" } };
  // Premium plan, so every module (incl. BiSupplyNet) is open in screenshots.
  const ALL = { dashboard: true, inventory: true, orders: true, invoices: true, analytics: true, projects: true, store: true, messages: true, bisupplynet: true, bisupplynetSell: true, automation: true, socialMedia: true, customers: true };
  routes["GET /api/subscriptions/current"] = { ...(routes["GET /api/subscriptions/current"] || {}), plan: "premium", status: "active", paymentMode: "live", features: ALL };
  // A live wallet with plausible balances.
  routes["GET /api/wallet"] = {
    balance: 486250, pendingBalance: 213400, totalEarned: 2948600, totalWithdrawn: 2248950, totalCommissionPaid: 88458,
    test: { balance: 0, pendingBalance: 0, totalEarned: 0 },
    bank: { bankName: "Guaranty Trust Bank", bankCode: "058", accountName: "ADUNNI FASHION HOUSE LTD", last4: "4417", verified: true },
    schedule: { interval: "weekly", days: 7, nextWithdrawalDate: daysAgo(-2), eligibleNow: true, lastWithdrawalAt: daysAgo(5), notificationEmail: SAMPLE.email, payoutReminder: true, timezone: "Africa/Lagos" },
    fees: { withdrawalRate: 0, paystackTransferFee: true, minWithdrawal: 1000 }, paymentsMode: "live", payoutsCount: 18,
  };
  routes["GET /api/wallet/transactions"] = { transactions: [
    { _id: "t1", type: "credit", amount: 65475, fee: 0, description: "Store order", reference: "BMS-2041", status: "pending", mode: "live", order: { _id: "o1", trackingNo: "BM-7K2Q-2041" }, createdAt: daysAgo(0) },
    { _id: "t2", type: "credit", amount: 52380, fee: 0, description: "Store order", reference: "BMS-2040", status: "pending", mode: "live", order: { _id: "o2", trackingNo: "BM-7K2Q-2040" }, createdAt: daysAgo(1) },
    { _id: "t3", type: "withdrawal", amount: 214950, grossAmount: 215000, fee: 50, paystackFee: 50, description: "Payout to GTBank •••• 4417", reference: "BMW-0118", status: "completed", mode: "live", order: null, createdAt: daysAgo(5) },
    { _id: "t4", type: "credit", amount: 43650, fee: 0, description: "Store order", reference: "BMS-2032", status: "completed", mode: "live", order: { _id: "o4", trackingNo: "BM-7K2Q-2032" }, createdAt: daysAgo(6) },
  ], total: 4, page: 1, totalPages: 1 };
  // Rename everything (keys too: storefront routes contain the slug).
  for (const [k, v] of Object.entries(routes)) {
    const nk = renameText(k);
    const nv = k === "__dashboard" ? v : rename(v);
    if (nk !== k) delete routes[k];
    routes[nk] = nv;
  }
}
