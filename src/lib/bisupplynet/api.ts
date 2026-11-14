import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "@/lib/api/client";
import type { Attachment } from "@/lib/attachments";
import type { StatusTone } from "@/components/ui";

// BiSupplyNet (Figma 10.01–10.12, backend #50 / #53 / #55). Buyers find
// verified wholesalers and order in bulk; the payment is held in escrow until
// the buyer confirms delivery. Premium businesses apply to sell.
// Privacy: the buyer's views never carry the seller's share or the
// commission; screens only show those when the API says role === "seller".
// Every query key starts with "bisupplynet".

// ── Types ────────────────────────────────────────────────────────────────

export type SupplyCategory =
  | "retail_product_inventory"
  | "raw_materials"
  | "office_business_supplies"
  | "hospitality_service_supplies"
  | "agricultural_food"
  | "equipment_tools"
  | "digital_business_services";
export type Delivery = "local" | "state" | "nationwide";

/** A supplier as other businesses see them. */
export interface Supplier {
  _id: string;
  businessName: string;
  category: SupplyCategory;
  categories?: SupplyCategory[];
  state?: string | null;
  city?: string | null;
  description?: string;
  minimumOrderQuantity?: number;
  deliveryCapability?: Delivery;
  deliveryTimeline?: string;
  acceptsReturns?: boolean;
  logo?: string | null;
  verificationStatus?: "pending" | "verified" | "rejected";
  trustScore?: number;
  totalOrders?: number;
  averageRating?: number;
  totalReviews?: number;
  createdAt?: string;
}

export interface SupplierDetail extends Supplier {
  completedOrders: number;
  rating: { average: number; count: number };
  /** Median hours to the first update after payment; null without data. */
  responseTime: number | null;
  memberSince: string | null;
  cacVerified: boolean;
  /** false when the supplier's plan no longer allows selling (backend #55). Missing = true. */
  takingOrders?: boolean;
  activityMetrics: { totalOrders: number; completedOrders: number; completionRate: number; disputeRate: number; refundedOrders: number; trustScore: number };
}

export interface SupplyProduct {
  _id: string;
  name: string;
  description: string;
  category: SupplyCategory;
  images: string[];
  pricePerUnit: number;
  minimumOrderQuantity: number;
  unit: string;
  availableQuantity: number;
  deliveryCapability?: Delivery;
  isAvailable: boolean;
  totalOrders?: number;
  wholesaler: Supplier | string;
  createdAt?: string;
}

export interface Paged {
  total: number;
  page: number;
  totalPages: number;
}

export type OrderStatus = "pending" | "payment_confirmed" | "processing" | "shipped" | "delivered" | "completed" | "disputed" | "refunded" | "cancelled";
export type BuyerAction = "pay" | "confirm_delivery" | "dispute" | "review" | "message";
export type SellerAction = "processing" | "shipped" | "delivered" | "cancelled" | "message";

export interface EscrowView {
  status: "none" | "held" | "frozen" | "released" | "refunded" | "partially_refunded";
  moneyState: string;
  totalAmount: number;
  heldAmount: number;
  releasedAt: string | null;
  refundAmount: number;
  refundStatus: string;
  autoReleaseAt: string | null;
  // Seller only
  sellerShare?: number;
  commission?: number;
  commissionRate?: number;
  // Disputes
  frozenAmount?: number;
  outcome?: "refund" | "release" | "partial" | null;
}

export interface SupplyOrder {
  _id: string;
  trackingNo: string;
  productName: string;
  pricePerUnit: number;
  quantity: number;
  totalAmount: number;
  status: OrderStatus;
  deliveryAddress: string;
  receivingBusiness: string | null;
  contactPhone: string | null;
  isPaid: boolean;
  paidAt: string | null;
  paymentMode: "test" | "live" | null;
  isDeliveryConfirmed: boolean;
  cancelReason: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  expectedBy: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface OrderDetail {
  role: "buyer" | "seller";
  order: SupplyOrder;
  product: { _id: string; name: string; image: string | null; unit: string | null };
  seller: Supplier | null;
  buyer?: { name: string | null; avatar: string | null; businessName: string | null };
  timeline: Array<{ status: OrderStatus; label: string; at: string; by: string }>;
  escrow: EscrowView;
  shippedAt: string | null;
  deliveredAt: string | null;
  expectedBy: string | null;
  allowedActions: string[];
  dispute: { id: string; status: DisputeStatus } | null;
  conversationId: string | null;
}

/** GET /orders/my-orders: the buyer's view. */
export interface BuyerOrderRow extends SupplyOrder {
  product: { _id: string; name: string; images?: string[] } | null;
  wholesaler: { _id: string; businessName: string | null } | null;
  escrow: EscrowView;
}

/** GET /orders/received: the seller's own orders. */
export interface ReceivedOrder {
  _id: string;
  trackingNo: string;
  productName: string;
  quantity: number;
  totalAmount: number;
  status: OrderStatus;
  isPaid: boolean;
  createdAt: string;
  client?: { _id: string; name: string; avatar?: string | null } | null;
  product?: { _id: string; name: string; images?: string[] } | null;
}

export type DisputeReason =
  | "wrong_item_received"
  | "damaged_defective_item"
  | "item_not_received"
  | "quantity_mismatch"
  | "quality_not_as_described"
  | "vendor_not_responding"
  | "vendor_blocked_me"
  | "order_not_processed"
  | "payment_issue"
  | "other";
export type Resolution = "full_refund" | "partial_refund" | "replacement" | "other";
export type DisputeStatus = "open" | "under_review" | "resolved_client" | "resolved_vendor" | "resolved_partial" | "closed";

export interface EvidenceFile {
  url: string;
  name?: string;
  type?: string;
  by: "client" | "vendor";
  at?: string;
}

export interface DisputeReply {
  _id?: string;
  by: "client" | "vendor" | "admin";
  user?: { _id: string; name: string; avatar?: string | null } | string | null;
  message: string;
  evidence?: string[];
  createdAt?: string;
}

export interface DisputeSummary {
  _id: string;
  reference?: string;
  reason: DisputeReason;
  description: string;
  status: DisputeStatus;
  createdAt: string;
  order?: { _id: string; trackingNo: string; totalAmount: number; productName: string } | null;
  wholesaler?: { _id: string; businessName: string; logo?: string | null } | string | null;
  client?: { _id: string; name: string; avatar?: string | null } | string | null;
}

export interface DisputeDetail extends DisputeSummary {
  role: "buyer" | "seller";
  dateReceived?: string | null;
  affectedQuantity?: number | null;
  amountDisputed?: number | null;
  requestedResolution?: Resolution | null;
  evidenceFiles?: EvidenceFile[];
  responses?: DisputeReply[];
  resolution?: string | null;
  resolvedAt?: string | null;
  refundAmount?: number;
  order: { _id: string; trackingNo: string; productName: string; quantity: number; totalAmount: number; status: OrderStatus } | null;
  escrow: EscrowView | null;
  conversationId: string | null;
  evidenceLimit: { perParty: number; used: number };
}

export interface NewDispute {
  orderId: string;
  reason: DisputeReason;
  description: string;
  dateReceived?: string;
  affectedQuantity?: number;
  amountDisputed?: number;
  requestedResolution?: Resolution;
  evidence: Attachment[];
}

export interface ScorePart {
  key: string;
  label?: string;
  points: number;
  earned: number;
}
export interface ScorePreview {
  profileScore: number;
  breakdown: ScorePart[];
  autoApprove: boolean;
  cacValid: boolean;
  documentUploaded: boolean;
  threshold: number;
  reviewReasons: string[];
}

export interface ApplicationInput {
  businessName: string;
  cacNumber?: string;
  category: SupplyCategory;
  categories?: SupplyCategory[];
  state: string;
  city: string;
  businessAddress: string;
  businessEmail: string;
  phone: string;
  description?: string;
  minimumOrderQuantity: number;
  deliveryCapability?: Delivery;
  deliveryTimeline?: string;
  verificationDocument?: { url: string; name?: string; type?: string; size?: number } | null;
}

export interface MyWholesalerProfile extends Supplier {
  status: "pending" | "verified" | "rejected";
  reference: string | null;
  profileScore: number;
  breakdown: ScorePart[];
  rejectionReason: string | null;
  /** BiTechTeam asked for more information (Phase 16): update and send it again. */
  infoRequest?: { message: string | null; items: string[]; requestedAt: string | null } | null;
  canResubmit?: boolean;
  submittedAt: string | null;
  cacVerified?: boolean;
  cacNumber?: string | null;
  businessAddress?: string | null;
  businessEmail?: string | null;
  businessPhone?: string | null;
  verificationDocument?: { url: string | null; name: string | null; type: string | null } | null;
}

export interface ApplyResult {
  message: string;
  status: "pending" | "verified";
  reference: string;
  profileScore: number;
  breakdown: ScorePart[];
  reviewReasons: string[];
}

export interface ProductInput {
  name: string;
  description: string;
  category: SupplyCategory;
  pricePerUnit: number;
  minimumOrderQuantity: number;
  unit: string;
  availableQuantity: number;
  deliveryCapability?: Delivery;
  isAvailable?: boolean;
  images?: string[];
}

export interface ConnectionRequest {
  _id: string;
  client?: { _id: string; name: string; avatar?: string | null } | null;
  message?: string | null;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
}

export interface Payout {
  orderId: string;
  trackingNo: string;
  productName: string;
  totalAmount: number;
  sellerShare: number;
  refundAmount: number;
  status: OrderStatus;
  orderState: string;
  moneyState: string;
  paidAt: string | null;
  releasedAt: string | null;
}
export interface EarningsBook {
  held: number;
  released: { allTime: number; last30d: number };
  orderValue30d: number;
  commission30d: number;
  refunded30d: number;
  recentPayouts: Payout[];
}
export interface SellerDashboard {
  profile: { businessName: string; verificationStatus: string; trustScore: number; averageRating: number; totalReviews: number };
  stats: { totalOrders: number; completedOrders: number; pendingOrders: number; processingOrders: number; totalProducts: number; availableProducts: number };
  earnings: { currentMode: "live" | "test"; live: EarningsBook; test: EarningsBook; trustScore: number; profileScore: number; walletLink: string };
}

// ── Labels (plain words, never ids or codes) ─────────────────────────────

export const CATEGORIES: Array<[SupplyCategory, string]> = [
  ["agricultural_food", "Agriculture and food"],
  ["raw_materials", "Raw materials"],
  ["retail_product_inventory", "Retail stock"],
  ["office_business_supplies", "Office supplies"],
  ["hospitality_service_supplies", "Hospitality supplies"],
  ["equipment_tools", "Equipment and tools"],
  ["digital_business_services", "Digital services"],
];
export const DELIVERY: Array<[Delivery, string]> = [
  ["local", "Local (same city)"],
  ["state", "Within the state"],
  ["nationwide", "Nationwide"],
];
export const DISPUTE_REASONS: Array<[DisputeReason, string]> = [
  ["damaged_defective_item", "Damaged or faulty goods"],
  ["wrong_item_received", "Wrong item received"],
  ["quantity_mismatch", "Wrong quantity"],
  ["quality_not_as_described", "Not as described"],
  ["item_not_received", "Goods not received"],
  ["order_not_processed", "Order not processed"],
  ["vendor_not_responding", "Supplier not responding"],
  ["vendor_blocked_me", "Supplier blocked me"],
  ["payment_issue", "Payment problem"],
  ["other", "Something else"],
];
export const RESOLUTIONS: Array<[Resolution, string]> = [
  ["full_refund", "Full refund"],
  ["partial_refund", "Partial refund"],
  ["replacement", "Replacement"],
  ["other", "Something else"],
];

const lookup = <K extends string>(list: Array<[K, string]>, key: string | null | undefined) =>
  list.find(([k]) => k === key)?.[1] ?? (key ? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ") : "");
export const categoryLabel = (c?: string | null) => lookup(CATEGORIES, c);
export const deliveryLabel = (d?: string | null) => lookup(DELIVERY, d);
export const reasonLabel = (r?: string | null) => lookup(DISPUTE_REASONS, r);
export const resolutionLabel = (r?: string | null) => lookup(RESOLUTIONS, r);

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: StatusTone }> = {
  pending: { label: "Awaiting payment", tone: "warning" },
  payment_confirmed: { label: "Paid, awaiting supplier", tone: "neutral" },
  processing: { label: "Being prepared", tone: "neutral" },
  shipped: { label: "Shipped", tone: "neutral" },
  delivered: { label: "Delivered", tone: "success" },
  completed: { label: "Completed", tone: "success" },
  disputed: { label: "In dispute", tone: "warning" },
  refunded: { label: "Refunded", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "danger" },
};
export const orderStatus = (s: string) => ORDER_STATUS[s as OrderStatus] ?? { label: s.replace(/_/g, " "), tone: "neutral" as StatusTone };

export const DISPUTE_STATUS: Record<DisputeStatus, { label: string; tone: StatusTone }> = {
  open: { label: "Waiting for the supplier", tone: "warning" },
  under_review: { label: "Under review", tone: "neutral" },
  resolved_client: { label: "Refunded to buyer", tone: "success" },
  resolved_vendor: { label: "Released to supplier", tone: "success" },
  resolved_partial: { label: "Partly refunded", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
};
export const disputeStatus = (s: string) => DISPUTE_STATUS[s as DisputeStatus] ?? { label: s.replace(/_/g, " "), tone: "neutral" as StatusTone };
export const disputeOpen = (s: string) => s === "open" || s === "under_review";

/** "Within 4 hours" / "Within 2 days" from the median response hours. */
export function responseLabel(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return "Not enough orders yet";
  if (hours < 1) return "Within an hour";
  if (hours < 48) return `Within ${Math.ceil(hours)} hours`;
  return `Within ${Math.ceil(hours / 24)} days`;
}
export const trustLevel = (score?: number | null) => (score === undefined || score === null ? "New" : score >= 80 ? "High" : score >= 60 ? "Good" : "Building");

export const isNotWholesaler = (err: unknown) => err instanceof ApiError && err.status === 404;

// ── Queries ──────────────────────────────────────────────────────────────

export interface SupplierFilters {
  search?: string;
  category?: string;
  state?: string;
  minTrust?: string;
  sort?: string;
  page?: number;
}
export interface ProductFilters {
  search?: string;
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  delivery?: string;
  page?: number;
}

export const bsnKeys = {
  all: ["bisupplynet"] as const,
  suppliers: (f: SupplierFilters) => ["bisupplynet", "suppliers", f] as const,
  supplier: (id: string) => ["bisupplynet", "supplier", id] as const,
  supplierProducts: (id: string) => ["bisupplynet", "supplier", id, "products"] as const,
  reviews: (id: string) => ["bisupplynet", "supplier", id, "reviews"] as const,
  products: (f: ProductFilters) => ["bisupplynet", "products", f] as const,
  product: (id: string) => ["bisupplynet", "product", id] as const,
  myOrders: ["bisupplynet", "orders", "mine"] as const,
  received: ["bisupplynet", "orders", "received"] as const,
  order: (id: string) => ["bisupplynet", "orders", "detail", id] as const,
  myDisputes: ["bisupplynet", "disputes", "mine"] as const,
  vendorDisputes: ["bisupplynet", "disputes", "vendor"] as const,
  dispute: (id: string) => ["bisupplynet", "disputes", "detail", id] as const,
  myProfile: ["bisupplynet", "my-profile"] as const,
  preview: (q: Record<string, string>) => ["bisupplynet", "preview-score", q] as const,
  myProducts: ["bisupplynet", "my-products"] as const,
  incoming: ["bisupplynet", "connections", "incoming"] as const,
  dashboard: ["bisupplynet", "dashboard"] as const,
};

const enc = encodeURIComponent;
const q = (f: Record<string, string | number | undefined>) => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== ""));

export const useSuppliers = (f: SupplierFilters) =>
  useQuery({
    queryKey: bsnKeys.suppliers(f),
    queryFn: () => api<Paged & { wholesalers: Supplier[] }>("/bisupplynet/wholesalers", { query: q({ ...f }) }),
    placeholderData: keepPreviousData,
  });
export const useSupplier = (id: string) => useQuery({ queryKey: bsnKeys.supplier(id), queryFn: () => api<SupplierDetail>(`/bisupplynet/wholesalers/${enc(id)}`), enabled: Boolean(id) });
export const useSupplierProducts = (id: string, enabled = true) =>
  useQuery({ queryKey: bsnKeys.supplierProducts(id), queryFn: () => api<Paged & { products: SupplyProduct[] }>(`/bisupplynet/wholesalers/${enc(id)}/products`, { query: { limit: 50 } }), enabled: Boolean(id) && enabled });
export const useSupplierReviews = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: bsnKeys.reviews(id),
    queryFn: () => api<Array<{ _id: string; rating: number; comment?: string; createdAt: string; client?: { name?: string } | null }>>(`/bisupplynet/reviews/${enc(id)}`),
    enabled: Boolean(id) && enabled,
  });
export const useProducts = (f: ProductFilters) =>
  useQuery({
    queryKey: bsnKeys.products(f),
    queryFn: () => api<Paged & { products: SupplyProduct[] }>("/bisupplynet/products", { query: q({ ...f }) }),
    placeholderData: keepPreviousData,
  });
export const useProduct = (id: string) => useQuery({ queryKey: bsnKeys.product(id), queryFn: () => api<SupplyProduct>(`/bisupplynet/products/${enc(id)}`), enabled: Boolean(id) });

export const useMyOrders = () => useQuery({ queryKey: bsnKeys.myOrders, queryFn: () => api<BuyerOrderRow[]>("/bisupplynet/orders/my-orders") });
export const useReceivedOrders = () => useQuery({ queryKey: bsnKeys.received, queryFn: () => api<ReceivedOrder[]>("/bisupplynet/orders/received") });
export const useOrder = (id: string) => useQuery({ queryKey: bsnKeys.order(id), queryFn: () => api<OrderDetail>(`/bisupplynet/orders/${enc(id)}`), enabled: Boolean(id) });

export const useMyDisputes = () => useQuery({ queryKey: bsnKeys.myDisputes, queryFn: () => api<DisputeSummary[]>("/disputes/my-disputes") });
export const useVendorDisputes = () => useQuery({ queryKey: bsnKeys.vendorDisputes, queryFn: () => api<DisputeSummary[]>("/disputes/vendor-disputes") });
export const useDispute = (id: string) => useQuery({ queryKey: bsnKeys.dispute(id), queryFn: () => api<DisputeDetail>(`/disputes/${enc(id)}`), enabled: Boolean(id) });

export const useMyWholesalerProfile = () =>
  useQuery({ queryKey: bsnKeys.myProfile, queryFn: () => api<MyWholesalerProfile>("/bisupplynet/my-profile"), retry: false });
export const useScorePreview = (params: Record<string, string>) =>
  useQuery({ queryKey: bsnKeys.preview(params), queryFn: () => api<ScorePreview>("/bisupplynet/application/preview-score", { query: params }), placeholderData: keepPreviousData, staleTime: 30_000 });
export const useMyProducts = () => useQuery({ queryKey: bsnKeys.myProducts, queryFn: () => api<SupplyProduct[]>("/bisupplynet/products/my-products") });
export const useIncomingConnections = () => useQuery({ queryKey: bsnKeys.incoming, queryFn: () => api<ConnectionRequest[]>("/bisupplynet/connect/incoming") });
export const useSellerDashboard = () => useQuery({ queryKey: bsnKeys.dashboard, queryFn: () => api<SellerDashboard>("/bisupplynet/dashboard"), retry: false });

// ── Mutations ────────────────────────────────────────────────────────────

const useBsnMutation = <V, R>(fn: (v: V) => Promise<R>) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => void qc.invalidateQueries({ queryKey: bsnKeys.all }) });
};

export const useRequestConnection = (wholesalerId: string) =>
  useBsnMutation((message: string) => api<{ message: string }>(`/bisupplynet/connect/${enc(wholesalerId)}`, { method: "POST", body: message ? { message } : {} }));
export const useAddReview = () => useBsnMutation((body: { wholesalerId?: string; orderId?: string; rating: number; comment?: string }) => api<{ _id: string }>("/bisupplynet/reviews", { method: "POST", body }));

export const usePlaceOrder = () =>
  useBsnMutation((body: { productId: string; quantity: number; deliveryAddress: string; receivingBusiness?: string; contactPhone?: string }) => api<SupplyOrder>("/bisupplynet/orders", { method: "POST", body }));
/** POST /escrow/pay/:id → Paystack. 503 { paymentsUnavailable } = payments coming soon. */
export const startPayment = (orderId: string) => api<{ authorizationUrl: string; reference: string }>(`/escrow/pay/${enc(orderId)}`, { method: "POST" });
export type VerifyResult = "paid" | "already_paid" | "pending" | "refunded_late" | "mismatch" | "failed";
export const verifyPayment = (reference: string) => api<{ result: VerifyResult; message: string; order: SupplyOrder | null }>("/escrow/verify-payment", { method: "POST", body: { reference } });

export const useConfirmDelivery = (id: string) => useBsnMutation((_: void) => api<{ message: string }>(`/bisupplynet/orders/${enc(id)}/confirm-delivery`, { method: "PUT" }));
export const useSetOrderStatus = (id: string) =>
  useBsnMutation((body: { status: Exclude<SellerAction, "message">; expectedBy?: string }) => api<SupplyOrder>(`/bisupplynet/orders/${enc(id)}/status`, { method: "PUT", body }));

export const useFileDispute = () => useBsnMutation((body: NewDispute) => api<{ dispute: DisputeSummary; reference: string; conversationId: string | null }>("/disputes", { method: "POST", body }));
export const useReplyDispute = (id: string) => useBsnMutation((body: { message: string; evidence?: Attachment[] }) => api<{ message: string }>(`/disputes/${enc(id)}/respond`, { method: "POST", body }));
export const useAddEvidence = (id: string) => useBsnMutation((evidence: Attachment[]) => api<{ remaining: number }>(`/disputes/${enc(id)}/evidence`, { method: "POST", body: { evidence } }));

export const useApply = () => useBsnMutation((body: ApplicationInput) => api<ApplyResult>("/bisupplynet/apply", { method: "POST", body }));

export const useSaveProduct = (id?: string) =>
  useBsnMutation((body: Partial<ProductInput>) => (id ? api<SupplyProduct>(`/bisupplynet/products/${enc(id)}`, { method: "PUT", body }) : api<SupplyProduct>("/bisupplynet/products", { method: "POST", body })));
export const useSetAvailability = () => useBsnMutation((v: { id: string; isAvailable: boolean }) => api<SupplyProduct>(`/bisupplynet/products/${enc(v.id)}`, { method: "PUT", body: { isAvailable: v.isAvailable } }));
export const useDeleteProduct = () => useBsnMutation((id: string) => api<{ message: string }>(`/bisupplynet/products/${enc(id)}`, { method: "DELETE" }));
/** Adds one photo to a listing (POST /upload/supply-product/:id, field "image"). */
export function uploadProductImage(id: string, file: File) {
  const form = new FormData();
  form.append("image", file, file.name);
  return api<{ image: string; images: string[] }>(`/upload/supply-product/${enc(id)}`, { method: "POST", body: form });
}
/** The DELETE refusal while orders are open: offer "Hide it instead". */
export const deleteBlocked = (err: unknown) => (err instanceof ApiError && err.status === 409 && typeof err.data.openOrders === "number" ? { openOrders: err.data.openOrders as number } : null);

export const useRespondConnection = () => useBsnMutation((v: { id: string; status: "accepted" | "rejected" }) => api<{ message: string }>(`/bisupplynet/connect/${enc(v.id)}/respond`, { method: "PUT", body: { status: v.status } }));
