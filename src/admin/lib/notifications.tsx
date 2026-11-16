import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { env } from "@/config/env";
import { transport } from "@/lib/realtime/transport";
import { adminApi } from "./api";
import { adminSession } from "./session";

// Admin notifications (backend: utils/adminNotifications.js). The bell and
// the notification centre read the API; the /admin socket (admin token, the
// server puts each admin in their own room) only says "something changed",
// so the screens refetch. While the socket is down, the count polls.

export type NotificationPriority = "urgent" | "normal" | "low";
export interface AdminNotification {
  _id: string;
  event: string;
  category: string;
  categoryLabel: string;
  priority: NotificationPriority;
  title: string;
  summary: string;
  link: string | null;
  targetType: string | null;
  targetId: string | null;
  readAt: string | null;
  createdAt: string;
}
export interface NotificationPage {
  notifications: AdminNotification[];
  total: number;
  page: number;
  totalPages: number;
  unread: number;
}
export interface PreferenceRow {
  key: string;
  label: string;
  description: string;
  priority: NotificationPriority;
  urgentLocked: boolean;
  hasUrgent: boolean;
  digestOnly: boolean;
  frequencyOptions: Array<"instant" | "digest">;
  inApp: boolean;
  email: boolean;
  frequency: "instant" | "digest";
}
export interface Preferences {
  categories: PreferenceRow[];
  digestTime?: string;
}

const KEY = ["admin", "notifications"] as const;
type Query = Record<string, string | number | undefined>;

// ── Live updates ───────────────────────────────────────────────────────────
const LiveContext = createContext(false);
export const useAdminLive = () => useContext(LiveContext);

/** The admin token, re-read whenever it's set or cleared (here or in another tab). */
export const useAdminToken = () => useSyncExternalStore(adminSession.subscribe, adminSession.get, () => null);

/** One /admin socket for the signed-in admin; reconnects with the new token when it changes. */
export function AdminLiveUpdates({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const token = useAdminToken();
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!token) return;
    const socket = transport.create(`${env.serverUrl}/admin`, {
      auth: (cb: (d: object) => void) => cb({ token: adminSession.get() }),
      transports: ["websocket", "polling"],
      reconnectionDelay: 2_000,
      reconnectionDelayMax: 30_000,
    });
    if (!socket) return;
    let everConnected = false;
    const refresh = () => void qc.invalidateQueries({ queryKey: KEY });
    const onConnect = () => {
      setConnected(true);
      if (everConnected) refresh(); // events may have been missed while away
      everConnected = true;
    };
    const onDisconnect = () => setConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onDisconnect);
    socket.on("admin:notification", refresh);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onDisconnect);
      socket.off("admin:notification", refresh);
      socket.disconnect();
      setConnected(false);
    };
  }, [token, qc]);
  return <LiveContext.Provider value={connected}>{children}</LiveContext.Provider>;
}

// ── Queries ────────────────────────────────────────────────────────────────
export function useUnreadCount() {
  const live = useAdminLive();
  return useQuery({
    queryKey: [...KEY, "unread"],
    queryFn: () => adminApi<{ unread: number }>("/admin/notifications/unread-count"),
    enabled: Boolean(adminSession.get()),
    refetchInterval: live ? false : 60_000,
    refetchIntervalInBackground: false,
  });
}
export const useNotifications = (q: Query, opts: { enabled?: boolean } = {}) =>
  useQuery({ queryKey: [...KEY, "list", q], queryFn: () => adminApi<NotificationPage>("/admin/notifications", { query: q }), placeholderData: keepPreviousData, enabled: opts.enabled ?? true });

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi<{ unread: number }>(`/admin/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (category?: string) => adminApi<{ unread: number }>("/admin/notifications/read-all", { method: "POST", body: category ? { category } : {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export const usePreferences = () => useQuery({ queryKey: ["admin", "notification-preferences"], queryFn: () => adminApi<Preferences>("/admin/notification-preferences") });
export function useSavePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (categories: Record<string, Partial<Pick<PreferenceRow, "inApp" | "email" | "frequency">>>) => adminApi<Preferences>("/admin/notification-preferences", { method: "PUT", body: { categories } }),
    onSuccess: (data) => qc.setQueryData(["admin", "notification-preferences"], data),
  });
}

/** "5 min ago", "Yesterday", or the date (Lagos). */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 2 * 86400) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos", day: "numeric", month: "short" });
}
