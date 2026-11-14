import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { User } from "@/lib/auth/api";

// Account & settings (Figma 13.01–13.08, backend #58, #59, #62) and the
// social media "Notify me" list (15.01).

export const accountKeys = {
  profile: ["account", "profile"] as const,
  preferences: ["account", "preferences"] as const,
  closureCheck: ["account", "closure-check"] as const,
  closure: ["account", "closure"] as const,
  waitlist: ["social", "waitlist"] as const,
};

// ── Profile and security (13.04, 13.06) ───────────────────────────────────
export interface AccountProfile extends User {
  /** false for accounts that only sign in with Google. */
  hasPassword: boolean;
  passwordChangedAt?: string | null;
}

export const useAccountProfile = () => useQuery({ queryKey: accountKeys.profile, queryFn: () => api<AccountProfile>("/profile") });

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/** Other devices are signed out; this one gets a fresh `token`. */
export const changePassword = (input: ChangePasswordInput) =>
  api<{ message: string; token: string; passwordChangedAt?: string }>("/profile/change-password", { method: "PUT", body: input });

export const signOutOtherDevices = () => api<{ message: string; token: string }>("/profile/sign-out-other-devices", { method: "POST", body: {} });

// ── Workspace preferences (13.03) ─────────────────────────────────────────
export type StartPage = "dashboard" | "sales" | "orders" | "inventory" | "store" | "projects" | "messages";

export interface WorkspacePreferences {
  startPage: StartPage;
  reduceMotion: boolean;
  largerText: boolean;
  /** Fixed for every account: shown, not editable. */
  timezone: string;
  currency: string;
  dateFormat: string;
  language: string;
  startPages?: StartPage[];
}

export const START_PAGES: Record<StartPage, { label: string; to: string }> = {
  dashboard: { label: "Business overview (dashboard)", to: "/dashboard" },
  sales: { label: "Sales", to: "/sales" },
  orders: { label: "Orders", to: "/orders" },
  inventory: { label: "Inventory", to: "/inventory" },
  store: { label: "Online store", to: "/store" },
  projects: { label: "Projects", to: "/projects" },
  messages: { label: "Messages", to: "/messages" },
};

export const useWorkspacePreferences = (enabled = true) =>
  useQuery({ queryKey: accountKeys.preferences, queryFn: () => api<WorkspacePreferences>("/profile/preferences"), enabled, staleTime: 5 * 60_000 });

export function useSaveWorkspacePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Pick<WorkspacePreferences, "startPage" | "reduceMotion" | "largerText">) =>
      api<WorkspacePreferences>("/profile/preferences", { method: "PUT", body: input }),
    onSuccess: (data) => qc.setQueryData(accountKeys.preferences, data),
  });
}

// ── Account closure (13.08) ───────────────────────────────────────────────
export interface ClosureBlocker {
  key: string;
  label: string;
  count: number;
  amount?: number;
  link: string;
}

export interface ClosureCheck {
  canClose: boolean;
  blockers: ClosureBlocker[];
  businessName: string | null;
  graceDays: number;
}

export const useClosureCheck = (enabled: boolean) =>
  useQuery({ queryKey: accountKeys.closureCheck, queryFn: () => api<ClosureCheck>("/profile/closure-check"), enabled, staleTime: 0 });

export const closeAccount = (input: { password?: string; confirmEmail?: string; reason?: string }) =>
  api<{ message: string; purgeAt: string }>("/profile/close", { method: "POST", body: input });

/** Works while the account is closing. */
export const useClosureStatus = (enabled: boolean) =>
  useQuery({
    queryKey: accountKeys.closure,
    queryFn: () => api<{ status: string | null; purgeAt: string | null; requestedAt: string | null }>("/profile/closure"),
    enabled,
    retry: false,
  });

export const restoreAccount = () => api<{ message: string; token: string; planNote?: string | null }>("/profile/restore", { method: "POST", body: { confirm: true } });

// ── Social media "Notify me" (15.01) ──────────────────────────────────────
export interface SocialWaitlist {
  joined: boolean;
  channels: string[];
  joinedAt?: string | null;
  availableChannels?: string[];
}

export const SOCIAL_CHANNELS: Array<[string, string]> = [
  ["facebook", "Facebook"],
  ["instagram", "Instagram"],
  ["tiktok", "TikTok"],
  ["x", "X"],
  ["linkedin", "LinkedIn"],
  ["whatsapp", "WhatsApp"],
];

export const useSocialWaitlist = () => useQuery({ queryKey: accountKeys.waitlist, queryFn: () => api<SocialWaitlist>("/social/waitlist") });

export function useJoinWaitlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (channels: string[]) => api<SocialWaitlist & { message?: string }>("/social/waitlist", { method: "POST", body: { channels } }),
    onSuccess: (data) => qc.setQueryData(accountKeys.waitlist, (old: SocialWaitlist | undefined) => ({ ...old, ...data, joined: true })),
  });
}

export function useLeaveWaitlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ joined: false }>("/social/waitlist", { method: "DELETE" }),
    onSuccess: () => qc.setQueryData(accountKeys.waitlist, (old: SocialWaitlist | undefined) => ({ ...old, joined: false, channels: [] })),
  });
}

/** "14 December 2026" (the removal date, Lagos time). */
export const longDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" }) : "";
