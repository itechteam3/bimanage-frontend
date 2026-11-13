import { io, type ManagerOptions, type Socket, type SocketOptions } from "socket.io-client";

/** The few socket methods the app uses (so tests can stand in a fake). */
export interface LiveSocket {
  connected: boolean;
  on(event: string, fn: (...args: any[]) => void): unknown;
  off(event: string, fn?: (...args: any[]) => void): unknown;
  emit(event: string, ...args: any[]): unknown;
  connect(): unknown;
  disconnect(): unknown;
}

type Opts = Partial<ManagerOptions & SocketOptions>;

/**
 * Opens Socket.io connections. Tests replace `create`; under Vitest nothing
 * connects unless a test installs a fake.
 */
export const transport = {
  create: (url: string, opts: Opts): LiveSocket | null => (import.meta.env.MODE === "test" ? null : (io(url, opts) as Socket)),
};
