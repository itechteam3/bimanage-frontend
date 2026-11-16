// Admin fixtures for the visual check (long names on purpose, to stress layouts).
const ALL = ["stats.read", "notifications.own", "users.read", "users.manage", "plans.assign", "suppliers.review", "announcements.send", "orders.read", "disputes.read", "money.manage", "payments.read", "domains.manage", "support.manage", "faqs.manage", "reviews.moderate", "feli.knowledge", "admins.manage", "audit.read", "audit.manual"];
const now = Date.now();
const iso = (h) => new Date(now + h * 3600e3).toISOString();
const days = Array.from({ length: 30 }, (_, i) => new Date(now - (29 - i) * 864e5 + 3600e3).toISOString().slice(0, 10));
const OVERVIEW = {
  period: { range: "30d", from: days[0], to: days[29], days: 30, timezone: "Africa/Lagos" },
  users: { total: 1284, verified: 1101, suspended: 4, closing: 1, new: 142, newChange: 38.2 },
  businesses: { freemium: 980, standard: 120, premium: 96, trial: 84, startupPackage: 4 },
  queues: { openTickets: 23, overdueTickets: 3, openDisputes: 2, suppliersToReview: 5, failedRefunds: 1, domainsToAdd: 2 },
  feli: { today: { messages: 214, totalTokens: 448120, peakTokensPerMinute: 7180, rateLimited: 2, busyReplies: 0 } },
  revenue: { total: 1868400, plans: 1450000, storeCommission: 178400, bisupplynetCommission: 240000, previous: 1210000, change: 54.4 },
  test: { plans: 90000, storeCommission: 4200, bisupplynetCommission: 0, storeSales: 140650, bisupplynetSales: 0, total: 94200, label: "Test payments (not real money)" },
  volume: { storeSales: 5946700, storeOrders: 412, bisupplynetSales: 8000000, bisupplynetOrders: 37 },
  balances: { walletsAvailable: 2450000, walletsOnHold: 812000, escrowHeld: 1500000, escrowFrozen: 320000 },
  series: days.map((d, i) => ({ date: d, signups: (i * 7) % 11, revenue: ((i * 13) % 9) * 21000, storeSales: ((i * 5) % 7) * 120000, bisupplynetSales: ((i * 3) % 5) * 90000 })),
};
const USER = { _id: "u9", name: "Amina Yusuf Abdulrahman-Okonkwo", email: "amina.abdulrahman.okonkwo@diorfactoryenterprises.com.ng", phone: "+2348035550190", isVerified: true, isSuspended: true, suspendedAt: iso(-30), googleLinked: true, createdAt: "2026-08-02T10:00:00Z", passwordChangedAt: "2026-10-06T10:00:00Z", suspensionReason: "Selling counterfeit goods reported by three buyers" };
const SUPPLIER = { _id: "w1", businessName: "Wale & Sons Wholesale Agro-Allied Distribution Limited", status: "info_requested", applicationRef: "BSN-APP-0007", submittedAt: iso(-96), waitingDays: 4, reviewedAt: null, reviewedBy: null, profileScore: 64, trustScore: 64, location: "Ikeja, Lagos", category: "agriculture", owner: { _id: "u2", name: "Wale Adeyemi", email: "wale@x.com" } };
const TICKET = { _id: "t1", ticketNumber: "TKT-00007", subject: "My payout for last week hasn't arrived in my GTBank account yet", message: "Where is my money? I was told it would arrive on Friday and it's now Monday.", category: "wallet", priority: "high", status: "open", user: { _id: "u9", name: "Amina Yusuf", email: "amina@x.com" }, assignedTo: null, sla: { targetHours: 4, dueAt: iso(0.6), respondedAt: null, state: "due_soon" }, createdAt: iso(-3.4) };
const DISPUTE = {
  dispute: { _id: "d1", reference: "DSP-0001", status: "open", reason: "damaged_defective_item", description: "Half of the 50 bags of rice arrived torn and wet. Photos attached.", requestedResolution: "partial_refund", amountDisputed: 400000, affectedQuantity: 25, evidenceFiles: [{ url: "https://example.com/1.jpg", name: "torn-bags.jpg", by: "client" }], responses: [{ _id: "r1", by: "vendor", name: "Wale", message: "The bags left our warehouse sealed. The courier may have damaged them.", evidence: [], createdAt: iso(-20) }], createdAt: iso(-30) },
  order: { _id: "o1", trackingNo: "BSN-2026-0042", productName: "Premium parboiled rice (50kg)", quantity: 50, pricePerUnit: 16000, status: "delivered", deliveredAt: iso(-40), shippedAt: iso(-60), link: "/bisupplynet/orders/o1" },
  money: { mode: "live", isTest: false, totalAmount: 800000, commissionRate: 3, commissionAmount: 24000, supplierPayout: 776000, escrowStatus: "frozen", refundAmount: 0, refundStatus: "none", supplierReceived: null, releasedAt: null, refundedAt: null },
  buyer: { _id: "u9", name: "Amina Yusuf", email: "amina@x.com", phone: "+2348035550190", business: "Dior Factory LTD.", link: "/users/u9" },
  supplier: { _id: "w1", businessName: SUPPLIER.businessName, verificationStatus: "verified", owner: { _id: "u2", name: "Wale Adeyemi", email: "wale@x.com" }, link: "/users/u2" },
  ledger: [{ _id: "l1", type: "held", amount: 800000, mode: "live", status: "completed", reference: "r1", createdAt: iso(-62) }, { _id: "l2", type: "frozen", amount: 800000, mode: "live", status: "completed", reference: "r2", createdAt: iso(-30) }],
  canDecide: true,
  conversationId: null,
};
const ANN = { _id: "n1", title: "Scheduled maintenance tonight from 1am to 2am", body: "BiManage will be unavailable for about an hour while we upgrade our servers.\n\nYour store stays online and no payments are affected.", audience: { kind: "all", plans: [] }, channels: { inApp: true, email: true }, status: "pending_approval", scheduledAt: iso(10), createdBy: { email: "ada@bitechteam.test" }, submittedBy: { email: "ada@bitechteam.test", at: iso(-1) }, needsApproval: true, editable: false, createdAt: iso(-2) };
const PROBLEMS = [{ value: "spam", label: "Spam" }, { value: "abusive", label: "Abusive or hateful" }, { value: "personal_data", label: "Personal data" }, { value: "off_topic", label: "Off-topic" }, { value: "suspected_fake", label: "Suspected fake" }, { value: "other", label: "Other" }];
const REVIEW_REASONS = { approve: [{ value: "meets_guidelines", label: "Meets the guidelines" }, { value: "other", label: "Other" }], reject: PROBLEMS, unpublish: PROBLEMS, delete: PROBLEMS, restore: [{ value: "deleted_by_mistake", label: "Deleted by mistake" }, { value: "other", label: "Other" }] };
const REVIEW = {
  _id: "rv1",
  headline: "Inventory, invoices and the online store finally talk to each other for our wholesale business",
  review: "We moved from three spreadsheets and a notebook. Stock counts are right, invoices go out the same day and the store updates itself. Support answered within the hour when our Paystack payout was late.",
  rating: 2,
  category: "product_experience",
  featuresUsed: ["inventory", "invoices", "store", "wallet", "bisupplynet"],
  businessName: "Wale & Sons Wholesale Agro-Allied Distribution Limited",
  isVerified: true,
  status: "pending",
  reviewer: { _id: "u9", name: USER.name, email: USER.email },
  createdAt: iso(-30),
  updatedAt: iso(-2),
  edited: true,
  moderatedAt: iso(-20),
  deletedAt: null,
  restoreUntil: null,
  lastAction: null,
  history: [{ action: "unpublish", from: "approved", to: "pending", reason: "personal_data", reasonLabel: "Personal data", note: "Shows the owner's personal phone number in the second paragraph; asked to edit", by: { name: "Sola Adebanjo-Williams", email: "sola.adebanjo.williams@bitechteam.org" }, at: iso(-20) }, { action: "approve", from: "pending", to: "approved", reason: "meets_guidelines", reasonLabel: "Meets the guidelines", note: null, by: { name: "BiTechTeam", email: "bitechteamlimited@gmail.com" }, at: iso(-28) }],
};
export const ADMIN_ROUTES = {
  "GET /api/admin/store-orders": { orders: [{ trackingNo: "BM-7K2Q-9MXA", status: "delivered", total: 57000, paymentMode: "live", customerName: "Ada Nwosu", problemOpen: true, refundFailed: false, createdAt: iso(-72) }, { trackingNo: "BM-7K2Q-0002", status: "cancelled", total: 24500, paymentMode: "test", customerName: "Tunde Bello", problemOpen: false, refundFailed: true, createdAt: iso(-90) }] },
  "GET /api/admin/store-orders/BM-7K2Q-9MXA": {
    order: { trackingNo: "BM-7K2Q-9MXA", status: "delivered", isPaid: true, paidAt: iso(-70), paymentMode: "live", total: 57000, commissionAmount: 1710, vendorPayout: 55290, customerName: "Ada Nwosu", customerEmail: "ada@example.com", deliveredAt: iso(-40), deliveryConfirmedAt: null, statusHistory: [], createdAt: iso(-72) },
    store: { storeName: "Elijah Apparel", storeSlug: "elijahapparel" },
    payout: { status: "held", holdDays: 7, holdEndsAt: iso(120), customerConfirmed: false, disputeOpen: true, releasedAt: null, releaseReason: null },
    dispute: { status: "open", reason: "damaged", message: "The linen shirt arrived with a long tear along the left seam, and the tote bag strap was missing entirely.", openedAt: iso(-30), resolvedAt: null, outcome: null, note: null },
    refund: { status: "failed", amount: 57000, refundedAt: null },
    ledger: [{ type: "held", amount: 55290, mode: "live", status: "completed", failureReason: null, note: null, at: iso(-70) }, { type: "refund", amount: 57000, mode: "live", status: "failed", failureReason: "Transaction cannot be refunded right now", note: null, at: iso(-20) }],
  },
  "POST /api/notifications/unsubscribe": { valid: true, subscribed: false },
  "GET /api/admin/me": { _id: "a1", name: "BiTechTeam", email: "bitechteamlimited@gmail.com", role: "superadmin", roleLabel: "Superadmin", isActive: true, twoFactorEnabled: true, lastLogin: iso(-1), passwordChangedAt: iso(-200), avatar: null, can: ALL },
  "GET /api/admin/overview": OVERVIEW,
  "GET /api/admin/users": { users: [USER, { ...USER, _id: "u3", name: "Bayo", email: "bayo@x.com", isSuspended: false }, { ...USER, _id: "u4", name: "Chidi Okeke", email: "chidi@x.com", isSuspended: false, isVerified: false }], total: 3, page: 1, totalPages: 1 },
  "GET /api/admin/users/u9": { user: USER, businessProfile: { businessName: "Dior Factory LTD." }, wholesalerProfile: { _id: "w1", businessName: SUPPLIER.businessName, verificationStatus: "verified", accountNumber: "******6789", bankName: "GTBank", hasPayoutAccount: true }, stats: { totalOrders: 412, totalProducts: 96 }, plan: { plan: "premium", access: "premium", source: "plan", status: "active", billingCycle: "monthly", currentPeriodEnd: iso(400), trialEndDate: null }, store: { storeName: "Dior Factory", storeSlug: "diorfactory", isPublished: false, customDomain: "shop.diorfactory.com.ng", url: "diorfactory.bimanage.com" }, memberOf: null, team: [{ _id: "u3", name: "Bayo", email: "bayo@x.com", role: "manager", since: iso(-900) }], tickets: [{ _id: "t1", ticketNumber: "TKT-00007", subject: TICKET.subject, status: "open", priority: "high", createdAt: iso(-3), link: "/support/tickets/t1" }], history: [{ action: "user.suspend", by: "ada@bitechteam.test", role: "admin", summary: "Account suspended.", reason: "Selling counterfeit goods reported by three buyers", via: "admin", at: iso(-30) }], suspension: { since: iso(-30), reason: USER.suspensionReason, by: "ada@bitechteam.test", storeHidden: true, supplierPaused: true } },
  "GET /api/admin/suppliers": { suppliers: [SUPPLIER, { ...SUPPLIER, _id: "w2", businessName: "Kano Grains", status: "pending", waitingDays: 1, profileScore: 58 }], counts: { pending: 4, info_requested: 1, verified: 37, rejected: 6 }, total: 2, page: 1, totalPages: 1 },
  "GET /api/admin/suppliers/w1": { supplier: { ...SUPPLIER, description: "We supply rice, beans and garri to retailers across the South-West.", businessPhone: "+2348011112222", businessEmail: "sales@walesons.ng", businessAddress: "12 Industrial Avenue, Ikeja", state: "Lagos", city: "Ikeja", accountNumber: "******6789", bankName: "GTBank", accountName: "Wale & Sons Ltd", infoRequest: { open: true, message: "The CAC certificate is blurry. Please upload a clear photo or PDF.", items: ["CAC certificate (clear photo or PDF)", "Proof of address"], requestedAt: iso(-20), requestedBy: "rita@bitechteam.test" } }, owner: { _id: "u2", name: "Wale Adeyemi", email: "wale@x.com", link: "/users/u2" }, business: { businessName: "Wale & Sons", website: "https://walesons.ng" }, documents: { cacNumber: "RC1234567", verificationDocument: { url: "https://example.com/cac.pdf", name: "cac-certificate.pdf", type: "application/pdf" } }, plan: { tier: "premium", source: "plan", canSell: true }, stats: { products: 0, paidOrders: 0, averageRating: 0, totalReviews: 0 }, history: [{ reference: "BSN-APP-0007", event: "info_requested", reason: "The CAC certificate is blurry.", by: "rita@bitechteam.test", at: iso(-20) }, { reference: "BSN-APP-0007", event: "submitted", at: iso(-96) }], canDecide: true },
  "GET /api/admin/disputes": { disputes: [{ _id: "d1", reference: "DSP-0001", status: "open", reason: "damaged_defective_item", createdAt: iso(-30), order: { _id: "o1", trackingNo: "BSN-2026-0042", totalAmount: 800000, productName: "Rice" }, client: { name: "Amina Yusuf", email: "a@x.com" }, wholesaler: { businessName: SUPPLIER.businessName } }], total: 1, page: 1, totalPages: 1 },
  "GET /api/admin/bisupplynet/disputes/d1": DISPUTE,
  "GET /api/admin/supply-orders": { orders: [{ _id: "o1", trackingNo: "BSN-2026-0042", productName: "Rice", totalAmount: 800000, status: "disputed", refundStatus: "failed", paymentMode: "live", client: { name: "Amina Yusuf" }, wholesaler: { businessName: SUPPLIER.businessName } }], total: 1, page: 1, totalPages: 1 },
  "GET /api/admin/bisupplynet/orders/o1": { ...DISPUTE, order: { ...DISPUTE.order, deliveryAddress: "14 Admiralty Way, Lekki Phase 1, Lagos", receivingBusiness: "Dior Factory LTD.", contactPhone: "+2348035550190", expectedBy: iso(-48), cancelReason: null, statusHistory: [{ status: "payment_confirmed", at: iso(-70), by: "system" }, { status: "shipped", at: iso(-60), by: "wholesaler" }, { status: "delivered", at: iso(-40), by: "client" }, { status: "disputed", at: iso(-30), by: "client" }], createdAt: iso(-72) }, dispute: { _id: "d1", reference: "DSP-0001", status: "open", link: "/bisupplynet/disputes/d1" } },
  "GET /api/admin/support/tickets": { tickets: [TICKET, { ...TICKET, _id: "t2", ticketNumber: "TKT-00008", subject: "How do I add a teammate?", priority: "low", status: "awaiting_reply", assignedTo: { _id: "a1", name: "BiTechTeam", email: "b@x.com" }, sla: { targetHours: 72, dueAt: iso(40), respondedAt: iso(-1), state: "met" } }, { ...TICKET, _id: "t3", ticketNumber: "TKT-00009", priority: "urgent", sla: { targetHours: 2, dueAt: iso(-1), respondedAt: null, state: "breached" } }], total: 3, page: 1, totalPages: 1 },
  "GET /api/admin/support/tickets/t1": { ...TICKET, contactEmail: "amina@x.com", business: { _id: "u9", name: "Dior Factory LTD." }, replies: [{ _id: "rp1", by: "user", name: "Amina Yusuf", message: "Any update please?", attachments: [], createdAt: iso(-1) }], links: { customer: "/users/u9" } },
  "GET /api/admin/support/assignees": [{ _id: "a1", name: "BiTechTeam", email: "b@x.com", role: "superadmin" }, { _id: "a2", name: "Sola Support", email: "s@x.com", role: "support" }],
  "GET /api/support/admin/service-requests": { requests: [{ _id: "s1", requestNumber: "SRV-0003", serviceType: "custom_website", businessName: "Dior Factory LTD.", contactEmail: "a@x.com", description: "x", status: "pending", createdAt: iso(-5) }], total: 1, page: 1, totalPages: 1 },
  "GET /api/admin/support/service-requests/s1": { _id: "s1", requestNumber: "SRV-0003", projectTitle: "New website for our fashion house", serviceType: "custom_website", preferredStart: "within_a_month", businessName: "Dior Factory LTD.", contactEmail: "amina@x.com", contactPhone: "+2348035550190", description: "We'd like a modern site with our catalogue and online booking for fittings.", budget: "₦500,000 to ₦800,000", timeline: "6 weeks", status: "pending", adminNotes: null, createdAt: iso(-5), user: { _id: "u9", name: "Amina Yusuf", email: "a@x.com" } },
  "GET /api/admin/announcements": { announcements: [ANN, { ...ANN, _id: "n2", title: "New: invoices on mobile", status: "sent", channels: { inApp: true, email: false }, audience: { kind: "plan", plans: ["standard", "premium"] } }], total: 2, page: 1, totalPages: 1 },
  "GET /api/admin/announcements/n1": ANN,
  "GET /api/admin/announcements/n1/preview": { recipients: 1101, inApp: { title: ANN.title, message: ANN.body, link: null }, email: { subject: `${ANN.title} | BiManage`, html: "<div style='font-family:sans-serif;padding:24px'><h2 style='color:#014f86'>Scheduled maintenance tonight</h2><p>Hi Ada,</p><p>BiManage will be unavailable for about an hour.</p></div>" }, needsApproval: true },
  "GET /api/admin/admins": [{ _id: "a1", name: "BiTechTeam", email: "bitechteamlimited@gmail.com", role: "superadmin", roleLabel: "Superadmin", isActive: true, twoFactorEnabled: true, lastLogin: iso(-1), createdAt: iso(-24) }, { _id: "a2", name: "Sola Adebanjo-Williams", email: "sola.adebanjo.williams@bitechteam.org", role: "support", roleLabel: "Support agent", isActive: true, twoFactorEnabled: false, lastLogin: null, createdAt: iso(-2) }],
  "GET /api/admin/audit": { entries: [{ id: "e1", at: iso(-1), recordedAt: iso(-1), action: "user.suspend", by: "ada@bitechteam.test", role: "admin", via: "admin", targetType: "user", targetId: "u9", summary: "Account suspended. They've been signed out and emailed; the store and listings are hidden.", reason: "Selling counterfeit goods" }, { id: "e2", at: "2026-11-13T23:00:00Z", recordedAt: iso(-3), action: "admin.delete", by: "BiTechTeam (recorded at the owner's request)", role: null, via: "manual", targetType: "admin", targetId: "admin@bitechteam.org", summary: "Deleted the old superadmin account admin@bitechteam.org directly in MongoDB.", reason: "Manual action by the BiTechTeam owner" }], total: 2, page: 1, totalPages: 1 },
  "GET /api/admin/reviews": {
    reviews: [REVIEW, { ...REVIEW, _id: "rv2", status: "approved", rating: 5, headline: "Great", review: "Love it.", edited: false, lastAction: null }, { ...REVIEW, _id: "rv3", status: "deleted", rating: 1, deletedAt: iso(-48), restoreUntil: iso(28 * 24) }],
    total: 3,
    page: 1,
    totalPages: 2,
    counts: { pending: 12, approved: 1480, rejected: 37, deleted: 4 },
    reasons: REVIEW_REASONS,
  },
  "GET /api/admin/reviews/rv1": { review: REVIEW, reasons: REVIEW_REASONS },
  "GET /api/admin/notifications/unread-count": { unread: 128 },
  "GET /api/admin/notifications": {
    notifications: [
      { _id: "an1", event: "refund.failed", category: "refunds", categoryLabel: "Refunds", priority: "urgent", title: "Refund didn't go through (BSN-2026-0042)", summary: "NGN 800,000 is still owed to the buyer. Retry it from the order once the cause is fixed.", link: "/admin/bisupplynet/orders/o1", targetType: "supplyOrder", targetId: "o1", readAt: null, createdAt: iso(-0.2) },
      { _id: "an2", event: "ticket.created", category: "support", categoryLabel: "Support", priority: "normal", title: "New support ticket (TKT-00007)", summary: "My payout for last week hasn't arrived in my GTBank account yet, from Amina Yusuf Abdulrahman-Okonkwo", link: "/admin/support/tickets/t1", targetType: "ticket", targetId: "t1", readAt: null, createdAt: iso(-3) },
      { _id: "an3", event: "supplier.application", category: "suppliers", categoryLabel: "Supplier applications", priority: "normal", title: "New supplier application (BSN-APP-0007)", summary: "Wale & Sons Wholesale Agro-Allied Distribution Limited, profile score 64.", link: "/admin/suppliers/w1", targetType: "wholesaler", targetId: "w1", readAt: iso(-20), createdAt: iso(-26) },
      { _id: "an4", event: "digest.daily", category: "accounts", categoryLabel: "Accounts", priority: "low", title: "Daily summary: new sign-ups", summary: "In the last 24 hours: 14 new business sign-ups and 3 new newsletter subscribers.", link: "/admin/users", targetType: null, targetId: null, readAt: iso(-40), createdAt: iso(-50) },
    ],
    total: 4,
    page: 1,
    totalPages: 2,
    unread: 128,
  },
  "GET /api/admin/notification-preferences": {
    digestTime: "08:00 (Lagos time)",
    categories: [
      { key: "support", label: "Support", description: "New tickets, customer replies, FELI \"talk to a person\" handovers, service requests, reported conversations and overdue replies.", priority: "normal", urgentLocked: false, hasUrgent: false, digestOnly: false, frequencyOptions: ["instant"], inApp: true, email: true, frequency: "instant" },
      { key: "contact", label: "Website messages", description: "Contact and demo requests from the website.", priority: "low", urgentLocked: false, hasUrgent: false, digestOnly: false, frequencyOptions: ["instant", "digest"], inApp: true, email: false, frequency: "instant" },
      { key: "withdrawals", label: "Payouts", description: "Payout requests, and payouts that failed (urgent).", priority: "low", urgentLocked: false, hasUrgent: true, digestOnly: false, frequencyOptions: ["instant", "digest"], inApp: true, email: true, frequency: "digest" },
      { key: "payments", label: "Payment problems", description: "Payments Paystack reported with the wrong amount or currency.", priority: "urgent", urgentLocked: true, hasUrgent: false, digestOnly: false, frequencyOptions: ["instant"], inApp: true, email: true, frequency: "instant" },
      { key: "accounts", label: "Accounts", description: "New business sign-ups (daily summary only) and account closures.", priority: "low", urgentLocked: false, hasUrgent: false, digestOnly: true, frequencyOptions: ["instant", "digest"], inApp: true, email: true, frequency: "digest" },
    ],
  },
  "GET /api/admin/store-domains": { vercelProject: "bimanage-storefront", domains: [{ storeId: "st1", storeName: "Dior Factory", storeSlug: "diorfactory", domain: "shop.diorfactoryenterprises.com.ng", dnsVerified: false, hosting: "pending", hostingAddedAt: null }] },
};
