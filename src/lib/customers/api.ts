import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api, apiDownload } from "@/lib/api/client";
import type { StatusTone } from "@/components/ui/Status";

// Customers (Figma 09.01–09.03), backend customers API.

export type CustomerSource = "manual" | "order" | "store" | "invoice";
export type CustomerSort = "totalSpent" | "lastOrder" | "name" | "recent";
export type SortDir = "asc" | "desc";

export interface CustomerAddress {
  line?: string;
  city?: string;
  state?: string;
}

export interface CustomerStats {
  ordersCount: number;
  invoicesCount: number;
  totalSpent: number;
  averageOrder: number;
  lastOrderAt?: string | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
}

export interface Customer {
  _id: string;
  name: string;
  /** null when empty. */
  email?: string | null;
  phone?: string | null;
  address?: CustomerAddress | null;
  tags: string[];
  notes?: string;
  source: CustomerSource;
  stats: CustomerStats;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerListResponse {
  customers: Customer[];
  total: number;
  page: number;
  totalPages: number;
  /** Every tag in use, for the filter. */
  tags: string[];
}

export interface CustomerDirectoryStats {
  total: number;
  newThisMonth: number;
  repeat: number;
  totalSpent: number;
}

export interface CustomerOrderRef {
  _id: string;
  channel: "in_person" | "online";
  reference: string;
  total: number;
  status: string;
  createdAt: string;
}

export interface CustomerInvoiceRef {
  _id: string;
  invoiceNumber: string;
  total: number;
  status: string;
  createdAt: string;
}

export interface CustomerDetail {
  customer: Customer;
  orders: CustomerOrderRef[];
  invoices: CustomerInvoiceRef[];
  conversation: { _id: string } | null;
}

export interface CustomerInput {
  name: string;
  email?: string;
  phone?: string;
  address?: CustomerAddress;
  tags?: string[];
  notes?: string;
}

export interface CustomerQuery {
  q?: string;
  tag?: string;
  source?: CustomerSource | "";
  sort?: CustomerSort;
  dir?: SortDir;
}

export const SOURCES: Array<[CustomerSource, string]> = [
  ["manual", "Added by you"],
  ["order", "From an order"],
  ["store", "Online store"],
  ["invoice", "From an invoice"],
];
export const sourceLabel = (s: CustomerSource) => SOURCES.find(([k]) => k === s)?.[1] ?? s;

export const SORTS: Array<[CustomerSort, string, SortDir]> = [
  ["totalSpent", "Total spent", "desc"],
  ["lastOrder", "Last order", "desc"],
  ["name", "Name (A–Z)", "asc"],
  ["recent", "Recently added", "desc"],
];
export const defaultDir = (sort: CustomerSort): SortDir => SORTS.find(([k]) => k === sort)?.[2] ?? "desc";

/** The list/export query string: empty values are left out. */
export const customerQuery = (f: CustomerQuery) => ({
  q: f.q?.trim() || undefined,
  tag: f.tag || undefined,
  source: f.source || undefined,
  sort: f.sort,
  dir: f.dir,
});

export const formatAddress = (a?: CustomerAddress | null) => [a?.line, a?.city, a?.state].map((p) => p?.trim()).filter(Boolean).join(", ");

/** History status pill: order/invoice statuses from both channels. */
export function historyBadge(status: string): { label: string; tone: StatusTone } {
  const s = status.toLowerCase();
  const label = s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  if (/(cancel|refund|fail|overdue|declin)/.test(s)) return { label, tone: s === "overdue" ? "danger" : "neutral" };
  if (/(complete|paid|deliver|fulfilled$)/.test(s) && !/unfulfilled/.test(s)) return { label, tone: "success" };
  if (s === "draft") return { label, tone: "neutral" };
  return { label, tone: "warning" };
}

export const customerKeys = {
  all: ["customers"] as const,
  list: (f: CustomerQuery) => ["customers", "list", f] as const,
  stats: ["customers", "stats"] as const,
  detail: (id: string) => ["customers", "detail", id] as const,
};

/** The directory in pages of 30 ("Load more"). */
export const useCustomerPages = (f: CustomerQuery, enabled = true) =>
  useInfiniteQuery({
    queryKey: customerKeys.list(f),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api<CustomerListResponse>("/customers", { query: { ...customerQuery(f), page: pageParam, limit: 30 } }),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useCustomerStats = () => useQuery({ queryKey: customerKeys.stats, queryFn: () => api<CustomerDirectoryStats>("/customers/stats") });

export const useCustomer = (id: string | undefined) =>
  useQuery({ queryKey: customerKeys.detail(id ?? ""), queryFn: () => api<CustomerDetail>(`/customers/${id}`), enabled: Boolean(id) });

const useInvalidate = () => {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: customerKeys.all });
};

export function useSaveCustomer(id?: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CustomerInput) =>
      id ? api<Customer>(`/customers/${id}`, { method: "PUT", body: input }) : api<Customer>("/customers", { method: "POST", body: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteCustomer() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => api<{ message: string }>(`/customers/${id}`, { method: "DELETE" }), onSuccess: invalidate });
}

/** Merge `otherId` into `id`: `id` stays, the other record's history joins it. */
export function useMergeCustomer() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, otherId }: { id: string; otherId: string }) => api<Customer>(`/customers/${id}/merge`, { method: "POST", body: { otherId } }),
    onSuccess: invalidate,
  });
}

export const exportCustomers = (f: CustomerQuery) => apiDownload("/customers/export", { query: customerQuery(f) });

/** 409 "this customer already exists": the existing record's id (and name, if sent). */
export function duplicateOf(err: unknown): { id: string; name?: string } | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  const d = err.data.duplicateOf;
  if (typeof d === "string" && d) return { id: d };
  if (d && typeof d === "object" && typeof (d as { _id?: unknown })._id === "string") {
    const o = d as { _id: string; name?: string };
    return { id: o._id, name: o.name };
  }
  return null;
}

/** What Create order / Create invoice receive in router state to prefill the customer. */
export interface CustomerPrefill {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}
export const prefillOf = (c: Customer): CustomerPrefill => ({ id: c._id, name: c.name, email: c.email ?? undefined, phone: c.phone ?? undefined, address: formatAddress(c.address) || undefined });
