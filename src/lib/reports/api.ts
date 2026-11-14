import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, apiDownload } from "@/lib/api/client";

// Reports (Figma 14.01–14.04, backend #60 and #61). Every list and its CSV
// export take the same filters, so the download matches what's on screen.
// Test-mode store payments are never in revenue: they come back separately
// (`test`) or as rows marked money: "test", always labelled on screen.

export type RangeKey = "today" | "7d" | "30d" | "90d" | "custom";
export const RANGES: Array<[RangeKey, string]> = [
  ["today", "Today"],
  ["7d", "7 days"],
  ["30d", "30 days"],
  ["90d", "90 days"],
  ["custom", "Custom"],
];

export interface Period {
  range: RangeKey;
  from?: string;
  to?: string;
}

/** Query string for a period: ?range=7d, or ?from&to for a custom one. */
export function periodQuery(p: Period): Record<string, string> {
  if (p.range === "custom") return p.from && p.to ? { from: p.from, to: p.to } : { range: "30d" };
  return { range: p.range };
}

export interface ReportOverview {
  period: { range: string; from: string; to: string; days: number; timezone: string };
  revenue: { total: number; online: number; direct: number; previous: number; change: number | null };
  channels: Array<{ key: "online" | "direct" | "invoices"; label: string; orders?: number; revenue?: number; count?: number; amount?: number; note?: string }>;
  test: { orders: number; revenue: number; label: string };
  series: Array<{ date: string; revenue: number; orders: number; online: number; direct: number }>;
  bestSellers: Array<{ name: string; quantity: number; revenue: number }>;
  sales: { totalSales: number; totalOrders: number; completedOrders: number; cancelledOrders: number; averageOrderValue: number };
  inventory: { totalProducts: number; totalStock: number; stockValue: number; healthy: number; lowStock: number; outOfStock: number };
  invoices: { total: number; paid: number; totalRevenue: number; pending: number; overdue: number; draft: number };
}

export const reportKeys = {
  overview: (q: Record<string, string>) => ["analytics", "overview", q] as const,
  ledger: (q: Record<string, string>) => ["analytics", "ledger", q] as const,
  inventory: (q: Record<string, string>) => ["analytics", "inventory-health", q] as const,
  invoices: (q: Record<string, string>) => ["analytics", "invoice-collections", q] as const,
};

/** Drop empty filters so the query string (and cache key) stays tidy. */
const clean = (q: Record<string, string | number | boolean | undefined | null>) =>
  Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== null && v !== "" && v !== false).map(([k, v]) => [k, String(v)])) as Record<string, string>;

export const useReportOverview = (p: Period) => {
  const q = periodQuery(p);
  return useQuery({ queryKey: reportKeys.overview(q), queryFn: () => api<ReportOverview>("/analytics/overview", { query: q }), placeholderData: keepPreviousData });
};

// ── 14.02 Sales ledger ────────────────────────────────────────────────────
export type LedgerStatus = "paid" | "pending" | "fulfilment" | "refunded" | "cancelled";
export const LEDGER_STATUS: Record<LedgerStatus, { label: string; tone: "success" | "warning" | "neutral" | "danger" }> = {
  paid: { label: "Paid", tone: "success" },
  pending: { label: "Pending", tone: "warning" },
  fulfilment: { label: "Being fulfilled", tone: "neutral" },
  refunded: { label: "Refunded", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export interface LedgerRow {
  id: string;
  date: string;
  orderNumber?: string;
  channel: "online" | "direct";
  customer: string;
  items: string;
  total: number;
  status: LedgerStatus;
  money: "live" | "test";
  link: string;
}

interface Paged<R, S> {
  rows: R[];
  total: number;
  page: number;
  totalPages: number;
  summary: S;
}

export type SalesLedger = Paged<LedgerRow, { statusMix: Array<{ status: LedgerStatus; count: number }>; totalValue: number; testOrders: number }> & {
  period?: { from: string; to: string; range: string };
};

export interface LedgerFilters {
  period: Period;
  channel: "all" | "online" | "direct";
  status: "all" | LedgerStatus;
  search: string;
  includeTest: boolean;
  page: number;
}

export const ledgerQuery = (f: LedgerFilters) =>
  clean({ ...periodQuery(f.period), channel: f.channel === "all" ? "" : f.channel, status: f.status === "all" ? "" : f.status, search: f.search.trim(), includeTest: f.includeTest ? "true" : "" });

export const useSalesLedger = (f: LedgerFilters) => {
  const q = { ...ledgerQuery(f), ...(f.page > 1 ? { page: String(f.page) } : {}) };
  return useQuery({ queryKey: reportKeys.ledger(q), queryFn: () => api<SalesLedger>("/analytics/sales-ledger", { query: q }), placeholderData: keepPreviousData });
};

// ── 14.03 Inventory health ────────────────────────────────────────────────
export type Health = "healthy" | "low" | "out";
export const HEALTH: Record<Health, { label: string; tone: "success" | "warning" | "danger" }> = {
  healthy: { label: "Healthy", tone: "success" },
  low: { label: "Low stock", tone: "warning" },
  out: { label: "Out of stock", tone: "danger" },
};

export interface InventoryRow {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  lowStockLevel: number;
  sellingPrice: number;
  stockValue: number;
  sold: number;
  health: Health;
  link: string;
}

export type InventoryHealth = Paged<
  InventoryRow,
  {
    products: number;
    units: number;
    stockValue: number;
    healthy: number;
    low: number;
    out: number;
    categories: Array<{ category: string; products: number; units: number; value: number; low: number }>;
    restock: Array<{ id: string; name: string; stock: number; lowStockLevel: number; link: string }>;
  }
>;

export interface InventoryFilters {
  health: "all" | Health;
  category: string;
  search: string;
  page: number;
}

export const inventoryQuery = (f: InventoryFilters) => clean({ health: f.health === "all" ? "" : f.health, category: f.category, search: f.search.trim() });

export const useInventoryHealth = (f: InventoryFilters) => {
  const q = { ...inventoryQuery(f), ...(f.page > 1 ? { page: String(f.page) } : {}) };
  return useQuery({ queryKey: reportKeys.inventory(q), queryFn: () => api<InventoryHealth>("/analytics/inventory-health", { query: q }), placeholderData: keepPreviousData });
};

/** The server links products as /inventory/:id; the app's product page is /inventory/products/:id. */
export const productLink = (id: string) => `/inventory/products/${id}`;

// ── 14.04 Invoice collections ─────────────────────────────────────────────
export type InvoiceState = "paid" | "open" | "overdue" | "draft";
export const INVOICE_STATE: Record<InvoiceState, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  paid: { label: "Paid", tone: "success" },
  open: { label: "Open", tone: "warning" },
  overdue: { label: "Overdue", tone: "danger" },
  draft: { label: "Draft", tone: "neutral" },
};

export interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  client: string;
  clientEmail: string;
  total: number;
  status: InvoiceState;
  dueDate: string | null;
  daysOverdue: number;
  createdAt: string;
  link: string;
}

export type InvoiceCollections = Paged<InvoiceRow, Record<InvoiceState, { count: number; amount: number }>>;

export interface InvoiceFilters {
  status: "all" | InvoiceState;
  search: string;
  page: number;
}

export const invoiceQuery = (f: InvoiceFilters) => clean({ status: f.status === "all" ? "" : f.status, search: f.search.trim() });

export const useInvoiceCollections = (f: InvoiceFilters) => {
  const q = { ...invoiceQuery(f), ...(f.page > 1 ? { page: String(f.page) } : {}) };
  return useQuery({ queryKey: reportKeys.invoices(q), queryFn: () => api<InvoiceCollections>("/analytics/invoice-collections", { query: q }), placeholderData: keepPreviousData });
};

// ── CSV exports (same filters as the screen) ──────────────────────────────
export const exportAnalytics = (p: Period) => apiDownload("/analytics/export/sales", { query: periodQuery(p) });
export const exportLedger = (f: LedgerFilters) => apiDownload("/analytics/export/ledger", { query: ledgerQuery(f) });
/** The inventory export filters by health and search (not category). */
export const exportInventory = (f: InventoryFilters) => apiDownload("/analytics/export/inventory", { query: clean({ health: f.health === "all" ? "" : f.health, search: f.search.trim() }) });
export const exportInvoices = (f: InvoiceFilters) => apiDownload("/analytics/export/invoices", { query: invoiceQuery(f) });
