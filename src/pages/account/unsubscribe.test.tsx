import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";
import { installFakeSockets } from "@/test/fakeSocket";

// One-click unsubscribe from announcement emails (no sign-in needed).

let fb: FakeBackend;
let sockets: ReturnType<typeof installFakeSockets>;
const last = (key: string) => [...fb.calls].reverse().find((c) => c.key === key);
beforeEach(() => {
  tokenStore.clear();
  serverStatus.set("up");
  fb = installFakeBackend();
  sockets = installFakeSockets();
});
afterEach(() => {
  sockets.restore();
  vi.unstubAllGlobals();
});

describe("unsubscribe page", () => {
  it("unsubscribes on open, says security emails still arrive, and can undo it", async () => {
    fb.handlers["POST /notifications/unsubscribe"] = () => [200, { valid: true, subscribed: false }];
    fb.handlers["POST /notifications/resubscribe"] = () => [200, { valid: true, subscribed: true }];
    const user = userEvent.setup();
    renderApp("/unsubscribe?u=u1&topic=announcements&t=sig123");
    expect(await screen.findByRole("heading", { name: "You're unsubscribed" })).toBeInTheDocument();
    expect(screen.getByText(/Security and payment emails/)).toBeInTheDocument();
    expect(last("POST /notifications/unsubscribe")?.body).toEqual({ u: "u1", topic: "announcements", t: "sig123" });
    expect(last("POST /notifications/unsubscribe")?.headers.Authorization).toBeUndefined();
    await user.click(screen.getByRole("button", { name: /Turn them back on/ }));
    expect(await screen.findByRole("heading", { name: "You're subscribed again" })).toBeInTheDocument();
  });

  it("an incomplete link explains itself", async () => {
    renderApp("/unsubscribe?u=u1");
    expect(await screen.findByText(/isn't complete/)).toBeInTheDocument();
  });
});
