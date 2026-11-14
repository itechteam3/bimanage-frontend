// Shapes returned by the admin API (backend PRs #63–#73, Phase 16).

export type AdminRole = "superadmin" | "admin" | "finance" | "support" | "reviewer";
export type Capability =
  | "stats.read"
  | "users.read"
  | "users.manage"
  | "plans.assign"
  | "suppliers.review"
  | "announcements.send"
  | "orders.read"
  | "disputes.read"
  | "money.manage"
  | "payments.read"
  | "domains.manage"
  | "support.manage"
  | "faqs.manage"
  | "reviews.moderate"
  | "feli.knowledge"
  | "admins.manage"
  | "audit.read"
  | "audit.manual";

export interface AdminMe {
  _id: string;
  name: string;
  email: string;
  role: AdminRole;
  roleLabel: string;
  isActive: boolean;
  twoFactorEnabled: boolean;
  lastLogin: string | null;
  createdAt?: string;
  avatar?: string | null;
  passwordChangedAt?: string | null;
  can: Capability[];
}

export interface Paged {
  total: number;
  page: number;
  totalPages: number;
}

export interface Overview {
  period: { range: string; from: string; to: string; days: number; timezone: string };
  users: { total: number; verified: number; suspended: number; closing: number; new: number; newChange: number | null };
  businesses: { freemium: number; standard: number; premium: number; trial: number; startupPackage: number };
  queues: { openTickets: number; overdueTickets: number; openDisputes: number; suppliersToReview: number; failedRefunds: number; domainsToAdd: number };
  feli: { today: { messages: number; totalTokens: number; peakTokensPerMinute: number; rateLimited: number; busyReplies: number } };
  revenue?: { total: number; plans: number; storeCommission: number; bisupplynetCommission: number; previous: number; change: number | null };
  test?: { plans: number; storeCommission: number; bisupplynetCommission: number; storeSales: number; bisupplynetSales: number; total: number; label: string };
  volume?: { storeSales: number; storeOrders: number; bisupplynetSales: number; bisupplynetOrders: number };
  balances?: { walletsAvailable: number; walletsOnHold: number; escrowHeld: number; escrowFrozen: number };
  series: Array<{ date: string; signups: number; revenue?: number; storeSales?: number; bisupplynetSales?: number }>;
}

export interface AdminUserRow {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  isVerified?: boolean;
  isSuspended?: boolean;
  suspendedAt?: string | null;
  closure?: { status?: string | null } | null;
  googleLinked?: boolean;
  createdAt?: string;
}

export interface AdminUserDetail {
  user: AdminUserRow & { suspensionReason?: string | null; passwordChangedAt?: string | null };
  businessProfile: { businessName?: string; businessType?: string; industry?: string } | null;
  wholesalerProfile: { _id: string; businessName: string; verificationStatus: string; accountNumber?: string | null; bankName?: string; hasPayoutAccount?: boolean } | null;
  stats: { totalOrders: number; totalProducts: number };
  plan: { plan: string; access: string; source: string; status: string; billingCycle: string | null; currentPeriodEnd: string | null; trialEndDate: string | null } | null;
  store: { storeName: string; storeSlug: string; isPublished: boolean; customDomain?: string | null; url: string | null } | null;
  memberOf: { business: string; role: string; link: string } | null;
  team: Array<{ _id: string; name: string; email: string; role: string; since: string }>;
  tickets: Array<{ _id: string; ticketNumber: string; subject: string; status: string; priority: string; createdAt: string; link: string }>;
  history: Array<{ action: string; by: string; role?: string; summary?: string | null; reason?: string | null; via?: string; at: string }>;
  suspension: { since: string; reason: string; by: string | null; storeHidden: boolean; supplierPaused: boolean } | null;
}

export type SupplierStatus = "pending" | "info_requested" | "verified" | "rejected";
export interface SupplierRow {
  _id: string;
  businessName: string;
  category?: string;
  location: string;
  status: SupplierStatus;
  applicationRef: string | null;
  submittedAt: string | null;
  waitingDays: number | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  profileScore: number | null;
  trustScore: number;
  owner: { _id: string; name: string; email: string } | null;
}
export interface SupplierDetail {
  supplier: SupplierRow & Record<string, unknown> & { description?: string; businessPhone?: string; businessEmail?: string; businessAddress?: string; state?: string; city?: string; accountNumber?: string | null; bankName?: string; accountName?: string; rejectionReason?: string | null; infoRequest?: { open: boolean; message: string | null; items: string[]; requestedAt: string | null; requestedBy: string | null } };
  owner: { _id: string; name: string; email: string; phone?: string; link: string } | null;
  business: { businessName?: string; businessType?: string; industry?: string; address?: string; state?: string; city?: string; website?: string } | null;
  documents: { cacNumber: string | null; verificationDocument: { url: string; name: string; type: string } | null };
  plan: { tier: string; source: string | null; canSell: boolean };
  stats: { products: number; paidOrders: number; averageRating: number; totalReviews: number };
  history: Array<{ reference: string; event: string; reason?: string; profileScore?: number; by?: string; at: string }>;
  canDecide: boolean;
}

export interface Sla {
  targetHours: number;
  dueAt: string;
  respondedAt: string | null;
  state: "on_track" | "due_soon" | "breached" | "met" | "closed";
}
export interface TicketRow {
  _id: string;
  ticketNumber: string;
  subject: string;
  message: string;
  category: string;
  priority: string;
  status: string;
  user?: { _id: string; name: string; email: string } | null;
  assignedTo: { _id: string; name: string; email: string; avatar?: string | null } | null;
  sla: Sla;
  createdAt: string;
  updatedAt?: string;
}
export interface TicketDetail extends TicketRow {
  contactEmail?: string | null;
  relatedReference?: string | null;
  attachments?: Array<{ url: string; name: string; type?: string }>;
  business: { _id: string; name: string | null } | null;
  replies: Array<{ _id: string; by: "user" | "admin"; name?: string; avatar?: string | null; message: string; attachments: Array<{ url: string; name: string }>; createdAt: string }>;
  links: { customer: string | null };
}
export interface ServiceRequest {
  _id: string;
  requestNumber: string;
  projectTitle?: string;
  serviceType: string;
  preferredStart?: string;
  businessName: string;
  contactEmail: string;
  contactPhone?: string;
  description: string;
  brandMaterials?: string;
  referenceFiles?: Array<{ url: string; name: string }>;
  budget?: string;
  timeline?: string;
  status: string;
  adminNotes?: string | null;
  createdAt: string;
  user?: { _id: string; name: string; email: string } | null;
  links?: { customer: string | null };
}

export interface Money {
  mode: "test" | "live" | null;
  isTest: boolean;
  totalAmount: number;
  commissionRate: number;
  commissionAmount: number;
  supplierPayout: number;
  escrowStatus: string;
  refundAmount: number;
  refundStatus: string;
  supplierReceived: number | null;
  releasedAt: string | null;
  refundedAt: string | null;
}
export interface Parties {
  buyer: { _id: string; name: string; email: string; phone: string | null; business: string | null; link: string } | null;
  supplier: { _id: string; businessName: string; verificationStatus: string; owner: { _id: string; name: string; email: string } | null; link: string | null } | null;
}
export interface LedgerEntry {
  _id: string;
  type: string;
  amount: number;
  mode: string;
  status: string;
  reference: string;
  note?: string | null;
  failureReason?: string | null;
  createdAt: string;
}
export interface DisputeRow {
  _id: string;
  reference?: string;
  status: string;
  reason: string;
  createdAt: string;
  order?: { _id: string; trackingNo: string; totalAmount: number; productName: string } | null;
  client?: { name: string; email: string } | null;
  wholesaler?: { businessName: string } | null;
}
export interface DisputeDetail extends Parties {
  dispute: {
    _id: string;
    reference?: string;
    status: string;
    reason: string;
    description: string;
    requestedResolution?: string | null;
    amountDisputed?: number | null;
    affectedQuantity?: number | null;
    dateReceived?: string | null;
    evidence?: string[];
    evidenceFiles?: Array<{ url: string; name?: string; type?: string; by?: string }>;
    resolution?: string | null;
    refundAmount?: number | null;
    resolvedAt?: string | null;
    responses: Array<{ _id: string; by: string; name?: string; message: string; evidence: string[]; createdAt: string }>;
    createdAt: string;
  };
  order: { _id: string; trackingNo: string; productName: string; quantity: number; pricePerUnit: number; status: string; deliveredAt: string | null; shippedAt: string | null; link: string } | null;
  money: Money | null;
  ledger: LedgerEntry[];
  canDecide: boolean;
  conversationId: string | null;
}
export interface SupplyOrderDetail extends Parties {
  order: { _id: string; trackingNo: string; productName: string; quantity: number; pricePerUnit: number; status: string; deliveryAddress: string; receivingBusiness?: string | null; contactPhone?: string | null; expectedBy?: string | null; shippedAt?: string | null; deliveredAt?: string | null; cancelReason?: string | null; statusHistory: Array<{ status: string; at: string; by?: string }>; createdAt: string };
  money: Money;
  ledger: LedgerEntry[];
  dispute: { _id: string; reference?: string; status: string; link: string } | null;
}

export interface Announcement {
  _id: string;
  title: string;
  body: string;
  link?: { label: string | null; url: string | null };
  audience: { kind: "all" | "plan" | "suppliers"; plans: string[] };
  channels: { inApp: boolean; email: boolean };
  status: "draft" | "pending_approval" | "scheduled" | "sending" | "sent" | "cancelled";
  scheduledAt: string | null;
  createdBy?: { email: string };
  submittedBy?: { email: string | null; at: string | null };
  approvedBy?: { email: string | null; at: string | null };
  cancelledBy?: { email: string | null; at: string | null };
  progress?: { recipients: number; inAppSent: number; emailed: number; emailFailed: number; inAppDone: boolean; emailDone: boolean; startedAt: string | null; pausedUntil: string | null };
  sentAt?: string | null;
  needsApproval: boolean;
  editable: boolean;
  createdAt: string;
}

export interface AdminAccount {
  _id: string;
  name: string;
  email: string;
  role: AdminRole;
  roleLabel: string;
  isActive: boolean;
  twoFactorEnabled: boolean;
  lastLogin: string | null;
  createdAt: string;
  avatar?: string | null;
}

export interface AuditEntry {
  id: string;
  at: string;
  recordedAt: string;
  action: string;
  by: string | null;
  byName?: string | null;
  avatar?: string | null;
  role: string | null;
  via: "admin" | "command" | "manual";
  targetType: string | null;
  targetId: string | null;
  summary: string | null;
  reason: string | null;
}

export interface StoreDomain {
  _id?: string;
  id?: string;
  storeName?: string;
  domain?: string;
  customDomain?: string;
  state?: string;
  status?: string;
  [k: string]: unknown;
}
