import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "./api";
import { adminSession } from "./session";
import type {
  AdminAccount,
  AdminMe,
  AdminUserDetail,
  AdminUserRow,
  Announcement,
  AuditEntry,
  Capability,
  DisputeDetail,
  DisputeRow,
  Overview,
  Paged,
  ServiceRequest,
  SupplierDetail,
  SupplierRow,
  SupplierStatus,
  SupplyOrderDetail,
  TicketDetail,
  TicketRow,
} from "./types";

type Query = Record<string, string | number | boolean | null | undefined>;
export const adminKeys = {
  me: ["admin", "me"] as const,
  all: ["admin"] as const,
};
const k = (...parts: unknown[]) => ["admin", ...parts];

// ── Me ─────────────────────────────────────────────────────────────────────
export function useAdminMe() {
  return useQuery({
    queryKey: adminKeys.me,
    queryFn: () => adminApi<AdminMe>("/admin/me"),
    enabled: Boolean(adminSession.get()),
    staleTime: 5 * 60_000,
    retry: false,
  });
}
export const useCan = () => {
  const me = useAdminMe().data;
  return (cap: Capability) => Boolean(me && me.can.includes(cap));
};

// ── Overview ───────────────────────────────────────────────────────────────
export const useOverview = (q: Query) => useQuery({ queryKey: k("overview", q), queryFn: () => adminApi<Overview>("/admin/overview", { query: q }), placeholderData: keepPreviousData });

// ── Users ──────────────────────────────────────────────────────────────────
export const useUsers = (q: Query) => useQuery({ queryKey: k("users", q), queryFn: () => adminApi<Paged & { users: AdminUserRow[] }>("/admin/users", { query: q }), placeholderData: keepPreviousData });
export const useUser = (id: string) => useQuery({ queryKey: k("user", id), queryFn: () => adminApi<AdminUserDetail>(`/admin/users/${id}`) });

// ── Suppliers ──────────────────────────────────────────────────────────────
export const useSuppliers = (q: Query & { status?: SupplierStatus | "" }) =>
  useQuery({ queryKey: k("suppliers", q), queryFn: () => adminApi<Paged & { suppliers: SupplierRow[]; counts: Record<SupplierStatus, number> }>("/admin/suppliers", { query: q }), placeholderData: keepPreviousData });
export const useSupplier = (id: string) => useQuery({ queryKey: k("supplier", id), queryFn: () => adminApi<SupplierDetail>(`/admin/suppliers/${id}`) });

// ── Disputes and orders ────────────────────────────────────────────────────
export const useDisputes = (q: Query) => useQuery({ queryKey: k("disputes", q), queryFn: () => adminApi<Paged & { disputes: DisputeRow[] }>("/admin/disputes", { query: q }), placeholderData: keepPreviousData });
export const useDispute = (id: string) => useQuery({ queryKey: k("dispute", id), queryFn: () => adminApi<DisputeDetail>(`/admin/bisupplynet/disputes/${id}`) });
export const useSupplyOrder = (id: string) => useQuery({ queryKey: k("supply-order", id), queryFn: () => adminApi<SupplyOrderDetail>(`/admin/bisupplynet/orders/${id}`) });
export const useSupplyOrders = (q: Query) =>
  useQuery({ queryKey: k("supply-orders", q), queryFn: () => adminApi<Paged & { orders: Array<Record<string, unknown>> }>("/admin/supply-orders", { query: q }), placeholderData: keepPreviousData });

// ── Support ────────────────────────────────────────────────────────────────
export const useTickets = (q: Query) => useQuery({ queryKey: k("tickets", q), queryFn: () => adminApi<Paged & { tickets: TicketRow[] }>("/admin/support/tickets", { query: q }), placeholderData: keepPreviousData });
export const useTicket = (id: string) => useQuery({ queryKey: k("ticket", id), queryFn: () => adminApi<TicketDetail>(`/admin/support/tickets/${id}`) });
export const useAssignees = () => useQuery({ queryKey: k("assignees"), queryFn: () => adminApi<Array<{ _id: string; name: string; email: string; role: string }>>("/admin/support/assignees"), staleTime: 5 * 60_000 });
export const useServiceRequests = (q: Query) =>
  useQuery({ queryKey: k("service-requests", q), queryFn: () => adminApi<Paged & { requests: ServiceRequest[] }>("/support/admin/service-requests", { query: q }), placeholderData: keepPreviousData });
export const useServiceRequest = (id: string) => useQuery({ queryKey: k("service-request", id), queryFn: () => adminApi<ServiceRequest>(`/admin/support/service-requests/${id}`) });

// ── Announcements ──────────────────────────────────────────────────────────
export const useAnnouncements = (q: Query) =>
  useQuery({ queryKey: k("announcements", q), queryFn: () => adminApi<Paged & { announcements: Announcement[] }>("/admin/announcements", { query: q }), placeholderData: keepPreviousData });
export const useAnnouncement = (id: string | undefined) => useQuery({ queryKey: k("announcement", id), queryFn: () => adminApi<Announcement>(`/admin/announcements/${id}`), enabled: Boolean(id) });
export const useAnnouncementPreview = (id: string | undefined, version: unknown) =>
  useQuery({
    queryKey: k("announcement-preview", id, version),
    queryFn: () => adminApi<{ recipients: number; byChannel?: { inApp: number; email: number }; inApp: { title: string; message: string; link: string | null } | null; email: { subject: string; html: string } | null; needsApproval: boolean }>(`/admin/announcements/${id}/preview`),
    enabled: Boolean(id),
  });

// ── Admins and the audit trail ─────────────────────────────────────────────
export const useAdmins = () => useQuery({ queryKey: k("admins"), queryFn: () => adminApi<AdminAccount[]>("/admin/admins") });
export const useAudit = (q: Query) => useQuery({ queryKey: k("audit", q), queryFn: () => adminApi<Paged & { entries: AuditEntry[] }>("/admin/audit", { query: q }), placeholderData: keepPreviousData });

// ── Store domains ──────────────────────────────────────────────────────────
export interface DomainRow {
  storeId: string;
  storeName: string;
  storeSlug: string;
  domain: string;
  dnsVerified: boolean;
  hosting: "pending" | "added";
  hostingAddedAt: string | null;
}
export const useStoreDomains = (status: string) => useQuery({ queryKey: k("domains", status), queryFn: () => adminApi<{ vercelProject: string; domains: DomainRow[] }>("/admin/store-domains", { query: { status } }) });

// ── Mutations ──────────────────────────────────────────────────────────────
/** A change, then refresh everything admin (lists, details, overview counts). */
export function useAdminAction<TBody = Record<string, unknown>, TRes = { message?: string }>(method: "POST" | "PUT" | "DELETE", path: (vars: TBody & { id?: string }) => string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: TBody & { id?: string }) => {
      const { id: _id, ...body } = vars as Record<string, unknown>;
      return adminApi<TRes>(path(vars), { method, body });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.all }),
  });
}
