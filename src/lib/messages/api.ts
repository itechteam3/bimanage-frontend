import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { Attachment } from "@/lib/attachments";

// Messages (Figma 12.01 / 12.02 / 12.04 / 12.10; backend #36/#37).
// The shared business inbox: customer, supplier and store-guest
// conversations belong to the business (owner + "Messages" permission);
// chats between teammates are private. Live updates arrive via the
// "messages" topic (src/lib/realtime/topics.ts).

export type ConversationType = "team" | "supplier" | "customer" | "guest";

export interface ConversationRow {
  _id: string;
  type: ConversationType;
  title: string;
  counterpart: { kind: "business" | "user" | "guest"; id: string } | null;
  related: { kind: string; id: string; label: string | null } | null;
  lastMessage: { content: string; hasAttachments: boolean; at: string; mine: boolean } | null;
  lastMessageAt: string;
  unread: number;
  muted: boolean;
  blocked: { byMe: boolean } | null;
}

export interface ChatMessage {
  _id: string;
  content: string;
  attachments: Attachment[];
  sender: { _id?: string; name: string; avatar?: string | null };
  mine: boolean;
  isRead?: boolean;
  createdAt: string;
}

export interface Thread {
  conversation: { _id: string; type: ConversationType; title: string; related: ConversationRow["related"]; muted: boolean; blocked: { byMe: boolean } | null };
  messages: ChatMessage[];
  page: number;
  hasMore: boolean;
}

export interface Contact {
  id: string;
  name: string;
  avatar: string | null;
  kind: "team" | "supplier";
}

export interface BlockRestricted {
  code: "BLOCK_RESTRICTED";
  reason: string;
  message: string;
  activeOrder: { kind: string; id: string; label: string };
  allowed: string[];
}

export const messageKeys = {
  all: ["messages"] as const,
  list: (filter: string, q: string) => ["messages", "list", filter, q] as const,
  thread: (id: string) => ["messages", "thread", id] as const,
  contacts: (q: string) => ["messages", "contacts", q] as const,
};

export const TYPE_LABEL: Record<ConversationType, string> = { team: "Team", supplier: "Supplier", customer: "Customer", guest: "Store guest" };

export const useConversations = (filter: string, q: string) =>
  useQuery({
    queryKey: messageKeys.list(filter, q),
    queryFn: () =>
      api<{ conversations: ConversationRow[]; page: number; hasMore: boolean }>("/messages/conversations", {
        query: { ...(filter === "unread" ? { unread: "true" } : filter !== "all" ? { type: filter } : {}), ...(q ? { q } : {}), limit: 50 },
      }),
  });

/** Newest page first from the server; pages are shown oldest → newest. */
export const useThread = (id: string | undefined) =>
  useInfiniteQuery({
    queryKey: messageKeys.thread(id ?? ""),
    enabled: Boolean(id),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api<Thread>(`/messages/conversations/${encodeURIComponent(id!)}`, { query: { page: pageParam, limit: 50 } }),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });

export const useContacts = (q: string, enabled: boolean) =>
  useQuery({ queryKey: messageKeys.contacts(q), queryFn: () => api<{ contacts: Contact[] }>("/messages/contacts", { query: q ? { q } : {} }).then((r) => r.contacts), enabled });

function useMessagesMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: messageKeys.all });
      void qc.invalidateQueries({ queryKey: ["unread"] });
    },
  });
}

export const useStartConversation = () => useMessagesMutation((v: { recipientId: string }) => api<{ _id: string; type: ConversationType; created: boolean }>("/messages/conversation", { method: "POST", body: v }));
export const useSendMessage = (id: string) =>
  useMessagesMutation((v: { content: string; attachments: Attachment[] }) => api<ChatMessage>(`/messages/conversations/${encodeURIComponent(id)}`, { method: "POST", body: v }));
export const useHideConversation = () => useMessagesMutation((id: string) => api<{ message: string }>(`/messages/conversations/${encodeURIComponent(id)}`, { method: "DELETE" }));
export const useMuteConversation = (id: string) => useMessagesMutation((muted: boolean) => api<{ muted: boolean }>(`/messages/conversations/${encodeURIComponent(id)}/mute`, { method: "POST", body: { muted } }));
export const useBlockConversation = (id: string) => useMessagesMutation((_: void) => api<{ blocked: boolean }>(`/messages/conversations/${encodeURIComponent(id)}/block`, { method: "POST" }));
export const useUnblockConversation = (id: string) => useMessagesMutation((_: void) => api<{ blocked: boolean }>(`/messages/conversations/${encodeURIComponent(id)}/unblock`, { method: "POST" }));
export const useReportConversation = (id: string) =>
  useMessagesMutation((reason: string) => api<{ ticketNumber: string; ticketId: string }>(`/messages/conversations/${encodeURIComponent(id)}/report`, { method: "POST", body: { reason } }));

/** "10:45", "Yesterday", "Tue", "22 Oct" (Figma inbox style). */
export function inboxTime(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "";
  const d = new Date(iso);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff === 0) return d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
  if (diff === 1) return "Yesterday";
  if (diff < 7) return d.toLocaleDateString("en-NG", { weekday: "short" });
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}
