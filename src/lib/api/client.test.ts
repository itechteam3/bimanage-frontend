import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, RETRY_DELAYS_MS } from "./client";
import { apiEvents } from "./events";
import { serverStatus } from "./serverStatus";
import { tokenStore } from "@/lib/auth/tokenStore";

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

describe("api client", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    serverStatus.set("up");
    tokenStore.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("sends the session token and JSON body", async () => {
    tokenStore.set("tok123");
    fetchMock.mockResolvedValue(json(200, { ok: true }));
    await api("/orders", { method: "POST", body: { productId: "p1", quantity: 2 } });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/orders$/);
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ productId: "p1", quantity: 2 }));
  });

  it("drops empty query params", async () => {
    fetchMock.mockResolvedValue(json(200, []));
    await api("/orders", { query: { status: "paid", page: 2, q: "", x: undefined } });
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\/orders\?status=paid&page=2$/);
  });

  it("raises ApiError with the backend message", async () => {
    fetchMock.mockResolvedValue(json(400, { message: "Invalid or expired OTP" }));
    await expect(api("/auth/verify-otp", { method: "POST", body: {} })).rejects.toMatchObject({
      status: 400,
      message: "Invalid or expired OTP",
    });
  });

  it("retries GETs on 503 with backoff, then succeeds", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(json(503, {})).mockResolvedValueOnce(json(200, { ok: 1 }));
    const p = api<{ ok: number }>("/dashboard");
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]!);
    await expect(p).resolves.toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never retries writes (no double orders or payments)", async () => {
    fetchMock.mockResolvedValue(json(503, { message: "down" }));
    await expect(api("/orders", { method: "POST", body: {} })).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry 4xx", async () => {
    fetchMock.mockResolvedValue(json(404, { message: "Not found" }));
    await expect(api("/orders/x")).rejects.toMatchObject({ status: 404 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports network failures as kind=network and marks the server unreachable", async () => {
    vi.useFakeTimers();
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const p = api("/dashboard").catch((e) => e);
    for (const d of RETRY_DELAYS_MS) await vi.advanceTimersByTimeAsync(d);
    const err = (await p) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.kind).toBe("network");
    expect(serverStatus.get()).toBe("unreachable");
    expect(fetchMock).toHaveBeenCalledTimes(RETRY_DELAYS_MS.length + 1);
  });

  it("shows 'waking' when the server is slow to answer", async () => {
    vi.useFakeTimers();
    serverStatus.set("unknown");
    let resolve!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    const p = api("/");
    await vi.advanceTimersByTimeAsync(5_000);
    expect(serverStatus.get()).toBe("waking");
    resolve(json(200, {}));
    await p;
    expect(serverStatus.get()).toBe("up");
  });

  it("401 with a token clears it and raises session-expired", async () => {
    tokenStore.set("old");
    const onExpired = vi.fn();
    const off = apiEvents.on("session-expired", onExpired);
    fetchMock.mockResolvedValue(json(401, { message: "Session has expired. Please log in again." }));
    await expect(api("/auth/me")).rejects.toMatchObject({ status: 401 });
    expect(onExpired).toHaveBeenCalledOnce();
    expect(tokenStore.get()).toBeNull();
    off();
  });

  it("quiet401 skips the global event (e.g. wrong password on login)", async () => {
    tokenStore.set("t");
    const onExpired = vi.fn();
    const off = apiEvents.on("session-expired", onExpired);
    fetchMock.mockResolvedValue(json(401, { message: "Invalid email or password" }));
    await expect(api("/auth/login", { method: "POST", body: {}, quiet401: true })).rejects.toBeInstanceOf(ApiError);
    expect(onExpired).not.toHaveBeenCalled();
    off();
  });

  it("maps plan and credit 403s to upgrade-required", async () => {
    const onUpgrade = vi.fn();
    const off = apiEvents.on("upgrade-required", onUpgrade);
    fetchMock.mockResolvedValueOnce(json(403, { message: "not on plan", feature: "inventory", currentPlan: "freemium", upgrade: true }));
    await api("/inventory/products").catch(() => {});
    fetchMock.mockResolvedValueOnce(json(403, { message: "out", creditsRemaining: 0, creditsNeeded: 5, resetsAt: "2026-11-12T00:00:00Z", upgrade: true }));
    await api("/orders", { method: "POST", body: {} }).catch(() => {});
    expect(onUpgrade.mock.calls.map((c) => c[0].kind)).toEqual(["plan", "credits"]);
    off();
  });

  it("exposes login cooldown seconds from the body or Retry-After", async () => {
    fetchMock.mockResolvedValue(json(429, { message: "Too many incorrect attempts", cooldown: true }, { "retry-after": "540" }));
    const err = (await api("/auth/login", { method: "POST", body: {}, quiet401: true }).catch((e) => e)) as ApiError;
    expect(err.status).toBe(429);
    expect(err.retryAfterSeconds).toBe(540);
  });

  it("suspended accounts raise the suspended event", async () => {
    tokenStore.set("t");
    const onSuspended = vi.fn();
    const off = apiEvents.on("suspended", onSuspended);
    fetchMock.mockResolvedValue(json(403, { message: "suspended", suspended: true }));
    await api("/dashboard").catch(() => {});
    expect(onSuspended).toHaveBeenCalledOnce();
    expect(tokenStore.get()).toBeNull();
    off();
  });
});
