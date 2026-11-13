import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "@/lib/api/client";
import type { Permission } from "@/config/navigation";

// Team & roles (backend PR #18): directory, invites, people for assigning.

export type TeamRole = "owner" | "admin" | "manager" | "staff";
export type InviteRole = Exclude<TeamRole, "owner">;

export interface TeamMember {
  _id: string;
  isOwner?: boolean;
  role: TeamRole;
  user: { _id: string; name: string; email: string; avatar?: string | null };
  permissions: Partial<Record<Permission, boolean>>;
  isActive: boolean;
}

export interface TeamInvite {
  _id: string;
  email: string;
  name: string | null;
  role: InviteRole;
  permissions: Partial<Record<Permission, boolean>>;
  status: "pending" | "accepted" | "expired";
  expiresAt: string;
  createdAt: string;
}

export interface Person {
  _id: string;
  name: string;
  avatar: string | null;
  role: TeamRole;
  joinedAt?: string | null;
  /** The name, plus what tells two people with the same name apart. */
  label?: string;
}

const joined = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }) : "");

/** Two people called "Dev Elijah" show as "Dev Elijah (joined 26 Apr 2026)" and "Dev Elijah (joined 12 Nov 2026)". */
export function labelPeople(list: Person[]): Person[] {
  const count = new Map<string, number>();
  for (const p of list) count.set(p.name, (count.get(p.name) ?? 0) + 1);
  return list.map((p) => {
    if ((count.get(p.name) ?? 0) < 2) return { ...p, label: p.name };
    const sameRole = list.filter((x) => x.name === p.name && x.role === p.role).length > 1;
    const extra = sameRole ? (p.role === "owner" ? "owner" : joined(p.joinedAt) ? `joined ${joined(p.joinedAt)}` : p.role) : p.role;
    return { ...p, label: `${p.name} (${extra})` };
  });
}

/** Labels for permissions, in the order shown in the app. */
export const PERMISSIONS: Array<[Permission, string, string]> = [
  ["viewDashboard", "Dashboard", "See the business dashboard"],
  ["manageInventory", "Inventory", "Add, edit and adjust products"],
  ["createOrders", "Create orders", "Record sales"],
  ["deleteOrders", "Cancel orders", "Cancel unfulfilled orders"],
  ["manageInvoices", "Invoices", "Create, send and track invoices"],
  ["manageProjects", "Projects", "Work on projects and tasks"],
  ["viewAnalytics", "Analytics", "See sales analytics and reports"],
  ["accessBiSupplyNet", "BiSupplyNet", "Buy from wholesalers"],
  ["manageSettings", "Settings", "Business profile and settings"],
  ["manageMessages", "Messages", "Read and answer customer and supplier messages"],
  ["manageTeam", "Team", "Invite and manage teammates (owner grants)"],
];

/** Defaults per role (mirror of the backend's rolePermissions). */
export const ROLE_DEFAULTS: Record<InviteRole, Record<Permission, boolean>> = {
  admin: { viewDashboard: true, manageInventory: true, createOrders: true, deleteOrders: true, manageProjects: true, viewAnalytics: true, manageTeam: true, manageInvoices: true, accessBiSupplyNet: true, manageSettings: true, manageMessages: true },
  manager: { viewDashboard: true, manageInventory: true, createOrders: true, deleteOrders: false, manageProjects: true, viewAnalytics: true, manageTeam: false, manageInvoices: true, accessBiSupplyNet: true, manageSettings: false, manageMessages: true },
  staff: { viewDashboard: true, manageInventory: false, createOrders: true, deleteOrders: false, manageProjects: true, viewAnalytics: false, manageTeam: false, manageInvoices: false, accessBiSupplyNet: false, manageSettings: false, manageMessages: false },
};

/** Figma 04.01 "Permissions overview" and the Access column. */
export const ROLE_INFO: Record<TeamRole, { label: string; access: string; summary: string }> = {
  owner: { label: "Owner", access: "Full account access", summary: "Full account and billing" },
  admin: { label: "Admin", access: "Near-full access", summary: "Manage orders, inventory, reports and the team" },
  manager: { label: "Manager", access: "Operations and tasks", summary: "Day-to-day operations" },
  staff: { label: "Staff", access: "Assigned tasks", summary: "Assigned tasks only" },
};

export const teamKeys = {
  all: ["team"] as const,
  members: ["team", "members"] as const,
  invites: ["team", "invites"] as const,
  people: ["team", "people"] as const,
};

export const useTeamMembers = (enabled = true) => useQuery({ queryKey: teamKeys.members, queryFn: () => api<TeamMember[]>("/settings/team"), enabled });
export const useTeamInvites = (enabled = true) => useQuery({ queryKey: teamKeys.invites, queryFn: () => api<TeamInvite[]>("/settings/team/invites"), enabled });
/** People work can be assigned to (owner + members). */
export const usePeople = (enabled = true) => useQuery({ queryKey: teamKeys.people, queryFn: () => api<Person[]>("/settings/team/people"), select: labelPeople, enabled, staleTime: 5 * 60_000 });

const useInvalidateTeam = () => {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: teamKeys.all });
};

export interface InviteInput {
  email: string;
  name?: string;
  role: InviteRole;
  permissions?: Partial<Record<Permission, boolean>>;
}

export function useInvite() {
  const invalidate = useInvalidateTeam();
  return useMutation({ mutationFn: (input: InviteInput) => api<{ message: string; invite: TeamInvite }>("/settings/team/invite", { method: "POST", body: input }), onSuccess: invalidate });
}
export function useResendInvite() {
  const invalidate = useInvalidateTeam();
  return useMutation({ mutationFn: (id: string) => api<{ invite: TeamInvite }>(`/settings/team/invites/${id}/resend`, { method: "POST" }), onSuccess: invalidate });
}
export function useCancelInvite() {
  const invalidate = useInvalidateTeam();
  return useMutation({ mutationFn: (id: string) => api(`/settings/team/invites/${id}`, { method: "DELETE" }), onSuccess: invalidate });
}
export function useUpdateRole(memberId: string) {
  const invalidate = useInvalidateTeam();
  return useMutation({ mutationFn: (role: InviteRole) => api<TeamMember>(`/settings/team/${memberId}/role`, { method: "PUT", body: { role } }), onSuccess: invalidate });
}
export function useUpdatePermissions(memberId: string) {
  const invalidate = useInvalidateTeam();
  return useMutation({
    mutationFn: (permissions: Partial<Record<Permission, boolean>>) => api<TeamMember>(`/settings/team/${memberId}/permissions`, { method: "PUT", body: { permissions } }),
    onSuccess: invalidate,
  });
}
export function useRemoveMember() {
  const invalidate = useInvalidateTeam();
  return useMutation({ mutationFn: (memberId: string) => api(`/settings/team/${memberId}`, { method: "DELETE" }), onSuccess: invalidate });
}

/** The server's "an invite is already pending" answer (409 with the invite id). */
export const pendingInviteId = (err: unknown): string | null =>
  err instanceof ApiError && err.status === 409 && typeof err.data.inviteId === "string" ? err.data.inviteId : null;
export const isEmailUnavailable = (err: unknown) => err instanceof ApiError && err.status === 503 && err.data.emailUnavailable === true;
