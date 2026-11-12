import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api, apiDownload } from "@/lib/api/client";
import type { StatusTone } from "@/components/ui/Status";

// Orders (backend PR #13) and invoices (PR #14) for Phase 5 (Figma 05.xx).

// ── Orders ────────────────────────────────────────────────────────────────

export type PaymentStatus = "pending" | "paid";
export type FulfilmentStatus = "unfulfilled" | "fulfilled";
export type OrderStatus = "pending" | "completed" | "cancelled";
export type PaymentMethod = "cash" | "transfer" | "card" | "pos" | "other";

export interface OrderItem {
  product: string;
  name: string;
  sku?: string;
  image?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Order {
  _id: string;
  trackingNo: string;
  items: OrderItem[];
  productName?: string;
  customer: { name?: string; email?: string; phone?: string };
  paymentMethod?: PaymentMethod;
  paymentStatus: PaymentStatus;
  fulfilmentStatus: FulfilmentStatus;
  status: OrderStatus;
  canCancel: boolean;
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  notes?: string;
  paidAt?: string;
  fulfilledAt?: string;
  cancelledAt?: string;
  createdAt: string;
}

export interface OrderStats {
  all: number;
  awaitingPayment: number;
  unfulfilled: number;
  completed: number;
  cancelled: number;
  revenue: number;
}

export type OrderFilter = "all" | "awaiting_payment" | "paid" | "unfulfilled" | "completed" | "cancelled";

export interface OrderInput {
  items: Array<{ productId: string; quantity: number }>;
  customer?: { name?: string; email?: string; phone?: string };
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  fulfilmentStatus?: FulfilmentStatus;
  deliveryFee?: number;
  notes?: string;
}

export const PAYMENT_METHODS: Array<[PaymentMethod, string]> = [
  ["cash", "Cash"],
  ["transfer", "Bank transfer"],
  ["card", "Card"],
  ["pos", "POS"],
  ["other", "Other"],
];

/** One label for the list's status column (05.02: Paid / Pending / Unfulfilled / Completed). */
export function orderBadge(o: Pick<Order, "status" | "paymentStatus" | "fulfilmentStatus">): { label: string; tone: StatusTone } {
  if (o.status === "cancelled") return { label: "Cancelled", tone: "neutral" };
  if (o.status === "completed") return { label: "Completed", tone: "success" };
  if (o.paymentStatus === "pending") return { label: "Awaiting payment", tone: "warning" };
  return { label: "Unfulfilled", tone: "warning" };
}

export const customerName = (o: Pick<Order, "customer">) => o.customer?.name || o.customer?.email || "Walk-in customer";

export const salesKeys = {
  orders: ["orders"] as const,
  orderList: (filter: OrderFilter, q: string) => ["orders", "list", filter, q] as const,
  orderStats: ["orders", "stats"] as const,
  order: (id: string) => ["orders", "detail", id] as const,
  invoices: ["invoices"] as const,
  invoiceList: (status: string) => ["invoices", "list", status] as const,
  invoiceStats: ["invoices", "stats"] as const,
  invoice: (id: string) => ["invoices", "detail", id] as const,
  analytics: (range: string) => ["analytics", "overview", range] as const,
};

export const useOrders = (filter: OrderFilter = "all", q = "") =>
  useQuery({
    queryKey: salesKeys.orderList(filter, q),
    queryFn: () => api<Order[]>("/orders", { query: { status: filter === "all" ? undefined : filter, q: q || undefined } }),
    placeholderData: keepPreviousData,
  });

export const useOrderStats = () => useQuery({ queryKey: salesKeys.orderStats, queryFn: () => api<OrderStats>("/orders/stats") });

export const useOrder = (id: string | undefined) =>
  useQuery({ queryKey: salesKeys.order(id ?? ""), queryFn: () => api<Order>(`/orders/${id}`), enabled: Boolean(id) });

const useInvalidateSales = () => {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: salesKeys.orders });
    void qc.invalidateQueries({ queryKey: salesKeys.invoices });
    void qc.invalidateQueries({ queryKey: ["inventory"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
    void qc.invalidateQueries({ queryKey: ["analytics"] });
    void qc.invalidateQueries({ queryKey: ["onboarding", "steps"] });
  };
};

export function useCreateOrder() {
  const invalidate = useInvalidateSales();
  return useMutation({ mutationFn: (input: OrderInput) => api<Order>("/orders", { method: "POST", body: input }), onSuccess: invalidate });
}

export function useUpdateOrderStatus(id: string) {
  const invalidate = useInvalidateSales();
  return useMutation({
    mutationFn: (input: { paymentStatus?: PaymentStatus; fulfilmentStatus?: FulfilmentStatus }) =>
      api<Order>(`/orders/${id}/status`, { method: "PATCH", body: input }),
    onSuccess: invalidate,
  });
}

export function useCancelOrder(id: string) {
  const invalidate = useInvalidateSales();
  return useMutation({
    mutationFn: (reason?: string) => api<{ order: Order }>(`/orders/${id}/cancel`, { method: "PUT", body: reason ? { reason } : {} }),
    onSuccess: invalidate,
  });
}

// ── Invoices ──────────────────────────────────────────────────────────────

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  order?: string | null;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  taxAmount: number;
  total: number;
  notes?: string;
  dueDate?: string | null;
  status: InvoiceStatus;
  currency?: string;
  createdAt: string;
}

export interface InvoiceStats {
  total: number;
  draft: number;
  sent: number;
  paid: number;
  overdue: number;
  totalRevenue: number;
  totalPending: number;
}

export interface InvoiceInput {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
  tax?: number;
  notes?: string;
  dueDate?: string | null;
  status?: InvoiceStatus;
  orderId?: string;
}

export const invoiceBadge: Record<InvoiceStatus, { label: string; tone: StatusTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  sent: { label: "Sent", tone: "warning" },
  paid: { label: "Paid", tone: "success" },
  overdue: { label: "Overdue", tone: "danger" },
};

export const useInvoices = (status = "all") =>
  useQuery({
    queryKey: salesKeys.invoiceList(status),
    queryFn: () => api<{ invoices: Invoice[]; total: number }>("/invoices", { query: { status: status === "all" ? undefined : status, limit: 100 } }),
  });

export const useInvoiceStats = (enabled = true) =>
  useQuery({ queryKey: salesKeys.invoiceStats, queryFn: () => api<InvoiceStats>("/invoices/stats"), enabled });

export const useInvoice = (id: string | undefined) =>
  useQuery({ queryKey: salesKeys.invoice(id ?? ""), queryFn: () => api<Invoice>(`/invoices/${id}`), enabled: Boolean(id) });

export function useSaveInvoice(id?: string) {
  const invalidate = useInvalidateSales();
  return useMutation({
    mutationFn: (input: InvoiceInput) =>
      id ? api<Invoice>(`/invoices/${id}`, { method: "PUT", body: input }) : api<Invoice>("/invoices", { method: "POST", body: input }),
    onSuccess: invalidate,
  });
}

export function useSetInvoiceStatus(id: string) {
  const invalidate = useInvalidateSales();
  return useMutation({ mutationFn: (status: InvoiceStatus) => api<Invoice>(`/invoices/${id}`, { method: "PUT", body: { status } }), onSuccess: invalidate });
}

export function useDeleteInvoice() {
  const invalidate = useInvalidateSales();
  return useMutation({ mutationFn: (id: string) => api(`/invoices/${id}`, { method: "DELETE" }), onSuccess: invalidate });
}

export interface SendInvoiceInput {
  to?: string;
  cc?: string[];
  subject?: string;
  message?: string;
}

export function useSendInvoice(id: string) {
  const invalidate = useInvalidateSales();
  return useMutation({
    mutationFn: (input: SendInvoiceInput) => api<{ invoice: Invoice }>(`/invoices/${id}/send`, { method: "POST", body: input }),
    onSuccess: invalidate,
  });
}

/** The server's "email can't go out right now" answer (sender domain not verified yet). */
export const isEmailUnavailable = (err: unknown) => err instanceof ApiError && err.status === 503 && err.data.emailUnavailable === true;

export const downloadInvoicePdf = (id: string) => apiDownload(`/invoices/${id}/download`);

/** Existing invoice for an order, if the server says one was already made. */
export const existingInvoiceOf = (err: unknown): Invoice | null =>
  err instanceof ApiError && err.status === 400 && err.data.invoice && typeof err.data.invoice === "object" ? (err.data.invoice as Invoice) : null;

export const createInvoiceFromOrder = (orderId: string) => api<Invoice>(`/invoices/generate-from-order/${orderId}`, { method: "POST", body: {} });

// ── Analytics (05.05) ─────────────────────────────────────────────────────

export type AnalyticsRange = "7days" | "30days" | "3months" | "12months";

export interface SalesAnalytics {
  sales: { totalSales: number; totalOrders: number; completedOrders: number; cancelledOrders: number; averageOrderValue: number };
  invoices: { total: number; paid: number; totalRevenue: number; pending: number };
  salesByDay: Array<{ _id: { year: number; month: number; day: number }; totalSales: number; totalOrders: number }>;
  topProducts: Array<{ _id: string; name: string; sellingPrice: number; totalSold: number; category?: string }>;
}

export const useSalesAnalytics = (range: AnalyticsRange, enabled = true) =>
  useQuery({
    queryKey: salesKeys.analytics(range),
    queryFn: () => api<SalesAnalytics>("/analytics/overview", { query: { range } }),
    placeholderData: keepPreviousData,
    enabled,
  });

export const downloadSalesCsv = () => apiDownload("/analytics/export/sales");
