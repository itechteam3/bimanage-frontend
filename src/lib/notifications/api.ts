import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiDownload } from "@/lib/api/client";

// Notification centre (Figma 12.11) and preferences (12.13); backend #35.
// Live updates: the "notifications" topic refreshes ["notifications"] and
// the header badge (["unread"]).

export type NotificationType = "payment" | "subscription" | "inventory" | "order" | "business_tip" | "feature_update" | "system" | "message" | "team" | "support" | "review" | "withdrawal" | "security";

export interface AppNotification {
  _id: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  link: string | null;
  createdAt: string;
}

export type PreferenceCategory = "orders" | "inventory" | "messages" | "subscriptions" | "withdrawals";
export type Preferences = Record<PreferenceCategory, { inApp: boolean; email: boolean }>;

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (filter: string, page: number) => ["notifications", "list", filter, page] as const,
  summary: ["notifications", "summary"] as const,
  preferences: ["notifications", "preferences"] as const,
};

export const useNotifications = (filter: string, page: number) =>
  useQuery({
    queryKey: notificationKeys.list(filter, page),
    queryFn: () =>
      api<{ notifications: AppNotification[]; total: number; page: number; totalPages: number }>("/notifications", { query: { page, limit: 20, ...(filter !== "all" ? { filter } : {}) } }),
    placeholderData: keepPreviousData,
  });

export const useNotificationSummary = () => useQuery({ queryKey: notificationKeys.summary, queryFn: () => api<{ all: number; unread: number; orders: number; lowStock: number }>("/notifications/summary") });

export const usePreferences = () =>
  useQuery({ queryKey: notificationKeys.preferences, queryFn: () => api<{ preferences: Preferences; mandatory: string[]; categories: PreferenceCategory[] }>("/notifications/preferences") });

function useNotifMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: notificationKeys.all });
      void qc.invalidateQueries({ queryKey: ["unread"] });
    },
  });
}

export const useMarkRead = () => useNotifMutation((id: string) => api(`/notifications/${encodeURIComponent(id)}/read`, { method: "PUT" }));
export const useMarkAllRead = () => useNotifMutation((_: void) => api("/notifications/read-all", { method: "PUT" }));
export const useDeleteNotification = () => useNotifMutation((id: string) => api(`/notifications/${encodeURIComponent(id)}`, { method: "DELETE" }));
export const useClearNotifications = () => useNotifMutation((_: void) => api("/notifications", { method: "DELETE" }));
export const useSavePreferences = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Partial<Preferences>) => api<{ preferences: Preferences }>("/notifications/preferences", { method: "PUT", body: v }),
    onSuccess: (r) => qc.setQueryData(notificationKeys.preferences, (old: object | undefined) => ({ ...(old ?? {}), preferences: r.preferences })),
  });
};
export const exportNotifications = (filter: string) => apiDownload("/notifications/export", { query: filter !== "all" ? { filter } : {} });

/** Only follow links inside the app ("/orders/…"), never to another site. */
export const safeLink = (link: string | null | undefined) => (link && link.startsWith("/") && !link.startsWith("//") ? link : null);

export const CATEGORY_INFO: Record<PreferenceCategory, { label: string; detail: string }> = {
  orders: { label: "New orders and payments", detail: "New order, payment confirmation or order change" },
  inventory: { label: "Inventory and stock", detail: "Low-stock alerts and important sales milestones" },
  messages: { label: "Messages and team", detail: "New messages and team invitation updates" },
  subscriptions: { label: "Subscriptions", detail: "Trial reminders and expiry alerts, including the 3-day warning" },
  withdrawals: { label: "Withdrawals and disputes", detail: "Payout status and dispute changes" },
};
