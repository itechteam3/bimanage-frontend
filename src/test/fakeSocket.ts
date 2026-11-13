import { act } from "@testing-library/react";
import { transport, type LiveSocket } from "@/lib/realtime/transport";

/** A stand-in Socket.io connection: the test plays the server. */
export class FakeSocket implements LiveSocket {
  connected = false;
  url: string;
  opts: Record<string, unknown>;
  /** What the app sent: [event, ...args]. */
  sent: unknown[][] = [];
  /** Replies to client emits with an ack, by event name. */
  acks: Record<string, (...args: unknown[]) => unknown> = {};
  private handlers = new Map<string, Set<(...a: unknown[]) => void>>();
  closed = false;

  constructor(url: string, opts: Record<string, unknown>) {
    this.url = url;
    this.opts = opts;
  }
  on(event: string, fn: (...a: unknown[]) => void) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(fn);
    return this;
  }
  off(event: string, fn?: (...a: unknown[]) => void) {
    if (fn) this.handlers.get(event)?.delete(fn);
    else this.handlers.delete(event);
    return this;
  }
  emit(event: string, ...args: unknown[]) {
    this.sent.push([event, ...args]);
    const last = args[args.length - 1];
    if (typeof last === "function" && this.acks[event]) (last as (r: unknown) => void)(this.acks[event]!(...args.slice(0, -1)));
    return this;
  }
  connect() {
    return this;
  }
  disconnect() {
    this.closed = true;
    this.connected = false;
    return this;
  }
  listeners(event: string) {
    return this.handlers.get(event)?.size ?? 0;
  }
  /** Server → app. */
  fire(event: string, ...args: unknown[]) {
    act(() => {
      if (event === "connect") this.connected = true;
      if (event === "disconnect") this.connected = false;
      for (const fn of [...(this.handlers.get(event) ?? [])]) fn(...args);
    });
  }
}

/** Route every socket the app opens to a FakeSocket; returns the list. */
export function installFakeSockets() {
  const sockets: FakeSocket[] = [];
  const orig = transport.create;
  transport.create = (url, opts) => {
    const s = new FakeSocket(url, opts as Record<string, unknown>);
    sockets.push(s);
    return s;
  };
  return {
    sockets,
    /** The newest socket to this URL suffix ("" = signed-in app, "/shop"). */
    latest: (suffix = "") => [...sockets].reverse().find((s) => (suffix ? s.url.endsWith(suffix) : !s.url.endsWith("/shop")) && !s.closed),
    restore: () => (transport.create = orig),
  };
}
