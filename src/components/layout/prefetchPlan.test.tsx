import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";
import { installFakeSockets } from "@/test/fakeSocket";

// Live check 2026-11-14: plan-gated pages waited for /onboarding/status before
// even asking for /subscriptions/current (about 1.7s extra on Render).

let fb: FakeBackend;
beforeEach(() => {
  tokenStore.set("tok");
  serverStatus.set("up");
  fb = installFakeBackend();
  installFakeSockets();
});
afterEach(() => {
  vi.unstubAllGlobals();
  tokenStore.clear();
});

describe("the plan check starts with the other start-up requests", () => {
  it("asks for the subscription before onboarding status has answered", async () => {
    // Onboarding never answers in this test: the plan check must not wait for it.
    const fetchFn = globalThis.fetch as unknown as (url: string, init: RequestInit) => Promise<Response>;
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => (String(url).includes("/onboarding/status") ? new Promise<Response>(() => undefined) : fetchFn(url, init)));
    renderApp("/bisupplynet/products");
    await waitFor(() => expect(fb.calls.some((c) => c.key === "GET /subscriptions/current")).toBe(true));
  });
});
