import { useEffect, useRef } from "react";
import { env } from "@/config/env";
import { transport } from "./transport";

export interface OrderUpdate {
  status: string;
  isPaid: boolean;
  at: string;
}

/**
 * Shopper pages (payment result, tracking): follow one order's status live.
 * The server checks the order number + email, like the tracking page, and
 * sends status only. `onUpdate` should refetch the order. Does nothing until
 * both values are known.
 */
export function useOrderLive(orderNumber: string | null | undefined, email: string | null | undefined, onUpdate: (u: OrderUpdate) => void) {
  const cb = useRef(onUpdate);
  cb.current = onUpdate;
  useEffect(() => {
    if (!orderNumber || !email) return;
    const socket = transport.create(`${env.serverUrl}/shop`, { transports: ["websocket", "polling"], reconnectionDelayMax: 30_000 });
    if (!socket) return;
    let followed = false;
    const follow = () =>
      socket.emit("track", { orderNumber, email }, (res: { ok: boolean }) => {
        // Re-following after a reconnect: refresh in case something changed meanwhile.
        if (res?.ok && followed) cb.current({ status: "", isPaid: false, at: new Date().toISOString() });
        if (res?.ok) followed = true;
      });
    const onUpdateEvt = (u: OrderUpdate) => cb.current(u);
    socket.on("connect", follow);
    socket.on("order:update", onUpdateEvt);
    if (socket.connected) follow();
    return () => {
      socket.off("connect", follow);
      socket.off("order:update", onUpdateEvt);
      socket.disconnect();
    };
  }, [orderNumber, email]);
}
