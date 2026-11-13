import { useEffect, useRef } from "react";
import { api } from "@/lib/api/client";
import { env } from "@/config/env";
import { transport } from "@/lib/realtime/transport";

// Storefront guest chat (Figma 12.03, backend #37). A shopper chats with the
// store without an account. The server gives them a random token, kept only
// in this browser (per store) and in the link we email when the store
// replies (in the URL #fragment, so it never reaches a server).

export interface GuestMessage {
  _id: string;
  content: string;
  mine: boolean;
  from: string;
  createdAt: string;
}
export interface GuestChat {
  sessionId: string;
  name: string;
  store: { name: string; slug: string };
  related: { label: string } | null;
  closed: boolean;
  messages: GuestMessage[];
}

const key = (slug: string) => `bimanage.storeChat.${slug}`;
export const chatToken = {
  get(slug: string): string | null {
    try {
      return localStorage.getItem(key(slug));
    } catch {
      return null;
    }
  },
  set(slug: string, token: string) {
    try {
      localStorage.setItem(key(slug), token);
    } catch {
      /* private mode: the chat lasts for this page only */
    }
  },
  clear(slug: string) {
    try {
      localStorage.removeItem(key(slug));
    } catch {
      /* ignore */
    }
  },
};

/** Take a token from an emailed link (#t=…), keep it, and tidy the address bar. */
export function adoptTokenFromLink(slug: string): string | null {
  const m = /(?:^#|&)t=([A-Za-z0-9_-]{20,100})/.exec(window.location.hash);
  if (!m) return null;
  chatToken.set(slug, m[1]!);
  history.replaceState(history.state, "", window.location.pathname + window.location.search);
  return m[1]!;
}

const headers = (token: string) => ({ "X-Guest-Token": token });

export const startStoreChat = (slug: string, body: { name: string; email: string; message: string; topic?: string; orderNumber?: string }) =>
  api<{ token: string; sessionId: string; conversationId: string; related: { label: string } | null; messages: GuestMessage[] }>(`/store-chat/${encodeURIComponent(slug)}/start`, { method: "POST", auth: false, body });
export const getStoreChat = (slug: string, token: string) => api<GuestChat>(`/store-chat/${encodeURIComponent(slug)}/session`, { auth: false, headers: headers(token) });
export const sendStoreChat = (slug: string, token: string, content: string) =>
  api<GuestMessage>(`/store-chat/${encodeURIComponent(slug)}/messages`, { method: "POST", auth: false, headers: headers(token), body: { content } });

/** Live replies on the store page (the /shop socket checks the token). */
export function useStoreChatLive(slug: string, token: string | null, onUpdate: () => void) {
  const cb = useRef(onUpdate);
  cb.current = onUpdate;
  useEffect(() => {
    if (!token) return;
    const socket = transport.create(`${env.serverUrl}/shop`, { transports: ["websocket", "polling"], reconnectionDelayMax: 30_000 });
    if (!socket) return;
    const join = () => socket.emit("chat:join", { storeSlug: slug, token }, () => undefined);
    const onUpd = () => cb.current();
    socket.on("connect", join);
    socket.on("chat:update", onUpd);
    if (socket.connected) join();
    return () => {
      socket.off("connect", join);
      socket.off("chat:update", onUpd);
      socket.disconnect();
    };
  }, [slug, token]);
}
