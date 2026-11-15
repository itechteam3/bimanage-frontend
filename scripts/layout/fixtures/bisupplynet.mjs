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
const DETAIL_ORDER = (over = {}, order = {}) => ({
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


const DISPUTE = (over = {}) => ({
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

const STANDARD = { plan: "standard", status: "active", features: { bisupplynet: true, bisupplynetSell: false } };
const FREE = { plan: "freemium", status: "active", features: { bisupplynet: false, bisupplynetSell: false } };
const S_PRODUCT = { _id: "p1", name: "Premium rice 50kg", description: "Long grain rice, 50kg bags", category: "agricultural_food", images: [], pricePerUnit: 64000, minimumOrderQuantity: 10, unit: "bag", availableQuantity: 100, deliveryCapability: "state", isAvailable: true, wholesaler: "w1" };
const PROFILE = (over = {}) => ({
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
const SELLER_ORDER = (over = {}) => ({
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
const DASH = (mode) => ({
  profile: { businessName: "Apex", verificationStatus: "verified", trustScore: 94, averageRating: 4.8, totalReviews: 37 },
  stats: { totalOrders: 4, completedOrders: 2, pendingOrders: 1, processingOrders: 1, totalProducts: 2, availableProducts: 2 },
  earnings: { currentMode: mode, live: BOOK(), test: BOOK({ held: 50000, released: { allTime: 12000, last30d: 12000 }, orderValue30d: 62000, recentPayouts: [] }), trustScore: 94, profileScore: 76, walletLink: "/wallet" },
});

const LONG = { ...SUPPLIER, _id: "w2", businessName: "Kano Rice Mills and Grain Merchants Limited Nigeria", state: "Kano", city: "Kano", trustScore: 81, categories: ["agricultural_food", "raw_materials"] };
const page = (key, list) => ({ [key]: list, total: list.length, page: 1, totalPages: 1 });
const PRODUCT2 = { ...PRODUCT, _id: "p2", name: "Fresh produce crates for supermarkets and caterers, size large", pricePerUnit: 18500, minimumOrderQuantity: 20, unit: "crates", wholesaler: LONG };
export const BSN_ROUTES = {
  "GET /api/subscriptions/current": { ...PREMIUM, access: { source: "plan", tier: "premium", unlimitedCredits: true }, features: { inventory: true, orders: true, invoices: true, analytics: true, dashboard: true, store: true, projects: true, messages: true, bisupplynet: true, bisupplynetSell: true } },
  "GET /api/bisupplynet/wholesalers": page("wholesalers", [SUPPLIER, LONG]),
  "GET /api/bisupplynet/wholesalers/w1": DETAIL({ takingOrders: true }),
  "GET /api/bisupplynet/wholesalers/w1/products": { wholesaler: SUPPLIER, ...page("products", [PRODUCT, PRODUCT2]) },
  "GET /api/bisupplynet/reviews/w1": [{ _id: "r1", rating: 5, comment: "Always on time and the bags were sealed properly.", createdAt: "2026-11-01T10:00:00Z", client: { name: "Ada" } }],
  "GET /api/bisupplynet/products": page("products", [PRODUCT, PRODUCT2]),
  "GET /api/bisupplynet/products/p1": PRODUCT,
  "GET /api/bisupplynet/orders/my-orders": [{ ...ORDER, product: { name: "Premium rice 50kg", images: [] }, wholesaler: { _id: "w1", businessName: "Apex Agro Supplies" }, escrow: DETAIL_ORDER().escrow }],
  "GET /api/bisupplynet/orders/o1": DETAIL_ORDER(),
  "GET /api/disputes/my-disputes": [DISPUTE()],
  "GET /api/disputes/d1": DISPUTE(),
  "GET /api/bisupplynet/my-profile": PROFILE({ status: "verified", verificationStatus: "verified" }),
  "GET /api/bisupplynet/application/preview-score": { profileScore: 76, breakdown: PROFILE().breakdown, autoApprove: false, cacValid: true, documentUploaded: false, threshold: 70, reviewReasons: ["Upload a verification document"] },
  "GET /api/bisupplynet/products/my-products": [S_PRODUCT, { ...S_PRODUCT, _id: "p3", name: "Parboiled rice 25kg", isAvailable: false }],
  "GET /api/bisupplynet/orders/received": [{ ...SELLER_ORDER().order, client: { name: "Elijah" }, product: { name: "Premium rice 50kg" } }],
  "GET /api/bisupplynet/orders/o2": SELLER_ORDER(),
  "GET /api/bisupplynet/dashboard": DASH("test"),
  "GET /api/bisupplynet/connect/incoming": [{ _id: "cr1", client: { name: "Ada Nwosu" }, message: "Can you do 200 bags a month?", status: "pending", createdAt: "2026-11-12T10:00:00Z" }],
  "GET /api/disputes/vendor-disputes": [DISPUTE({ role: "seller" })],
};
