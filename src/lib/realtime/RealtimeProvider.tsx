import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { env } from "@/config/env";
import { useAuth } from "@/lib/auth/AuthProvider";
import { tokenStore } from "@/lib/auth/tokenStore";
import { invalidateTopics, type ChangeEvent, type Topic } from "./topics";
import { transport, type LiveSocket } from "./transport";

// Keeps every signed-in screen current:
// - "bm:change" events refresh the matching queries (batched for a moment);
// - after a reconnect, or coming back to the tab after a while, the screen
//   refetches once (events may have been missed);
// - while the socket is down and the tab is visible, the open screen
//   refetches every minute; hidden tabs don't poll.

export const realtimeConfig = {
  batchMs: 400,
  fallbackPollMs: 60_000,
  staleAfterHiddenMs: 30_000,
  /** Our own change, echoed back to this tab: the mutation already refreshed it. */
  ownEchoMs: 3_000,
  retryAuthMs: 30_000,
};

interface RealtimeState {
  /** Socket is up: changes arrive as they happen. */
  connected: boolean;
  /** When the last live change was applied (ms), or null. */
  lastLiveAt: number | null;
}
const RealtimeContext = createContext<RealtimeState>({ connected: false, lastLiveAt: null });
export const useRealtime = () => useContext(RealtimeContext);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { status, user, refresh } = useAuth();
  const [connected, setConnected] = useState(false);
  const [lastLiveAt, setLastLiveAt] = useState<number | null>(null);
  const userId = user?._id ?? null;
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  // Last time a change made in THIS tab succeeded.
  const lastLocalWrite = useRef(0);
  useEffect(
    () =>
      qc.getMutationCache().subscribe((e) => {
        if (e.type === "updated" && e.action.type === "success") lastLocalWrite.current = Date.now();
      }),
    [qc]
  );

  // The socket (signed in only).
  const socketRef = useRef<LiveSocket | null>(null);
  useEffect(() => {
    if (status !== "authenticated" || !userId) return;
    const socket = transport.create(env.serverUrl, {
      auth: (cb: (d: object) => void) => cb({ token: tokenStore.get() }),
      transports: ["websocket", "polling"],
      reconnectionDelay: 2_000,
      reconnectionDelayMax: 30_000,
    });
    if (!socket) return;
    socketRef.current = socket;

    const pending = new Set<Topic>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let everConnected = false;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      timer = null;
      if (pending.size === 0) return;
      invalidateTopics(qc, pending);
      pending.clear();
      setLastLiveAt(Date.now());
    };
    const onChange = (e: ChangeEvent) => {
      if (!e || typeof e.topic !== "string") return;
      if (e.topic === "team" && e.action === "membership") {
        // Role, permissions or business changed: reload who we are, then everything.
        void refreshRef.current().finally(() => void qc.invalidateQueries());
        return;
      }
      if (e.by && e.by === userId && Date.now() - lastLocalWrite.current < realtimeConfig.ownEchoMs) return;
      pending.add(e.topic);
      if (!timer) timer = setTimeout(flush, realtimeConfig.batchMs);
    };
    const onConnect = () => {
      setConnected(true);
      // Back after a drop: catch up on anything missed.
      if (everConnected) void qc.refetchQueries({ type: "active" });
      everConnected = true;
    };
    const onDisconnect = () => setConnected(false);
    const onError = (err: Error) => {
      setConnected(false);
      // Refused by the server (e.g. token just renewed): Socket.io won't retry by itself.
      if (/authentication|suspended/i.test(err?.message ?? "") && !retry) {
        retry = setTimeout(() => {
          retry = null;
          if (tokenStore.get()) socket.connect();
        }, realtimeConfig.retryAuthMs);
      }
    };
    socket.on("bm:change", onChange);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onError);
    return () => {
      if (timer) clearTimeout(timer);
      if (retry) clearTimeout(retry);
      socket.off("bm:change", onChange);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onError);
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [status, userId, qc]);

  // Fallback: socket down + tab visible → refresh the open screen every minute.
  useEffect(() => {
    if (status !== "authenticated" || connected) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void qc.refetchQueries({ type: "active" });
    }, realtimeConfig.fallbackPollMs);
    return () => clearInterval(id);
  }, [status, connected, qc]);

  // Back to a tab that was hidden for a while: refresh once.
  useEffect(() => {
    if (status !== "authenticated") return;
    let hiddenAt: number | null = document.visibilityState === "hidden" ? Date.now() : null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt !== null) {
        if (Date.now() - hiddenAt >= realtimeConfig.staleAfterHiddenMs) void qc.refetchQueries({ type: "active" });
        hiddenAt = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [status, qc]);

  const value = useMemo(() => ({ connected, lastLiveAt }), [connected, lastLiveAt]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
