import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";
import { installFakeSockets } from "@/test/fakeSocket";
import { adminSession } from "./lib/session";
import type { AdminNotification, PreferenceRow } from "./lib/notifications";
import type { AdminMe } from "./lib/types";

// Admin notifications: the bell (live over the /admin socket), the
// notification centre and the settings (urgent always on).

let fb: FakeBackend;
let sockets: ReturnType<typeof installFakeSockets>;
const last = (key: string) => [...fb.calls].reverse().find((c) => c.key === key);
const ME: AdminMe = { _id: "a-fin", name: "Ada Finance", email: "finance@bitechteam.test", role: "finance", roleLabel: "Finance", isActive: true, twoFactorEnabled: true, lastLogin: null, can: ["stats.read", "notifications.own", "users.read", "disputes.read", "money.manage", "payments.read"] };
const note = (over: Partial<AdminNotification> = {}): AdminNotification => ({
  _id: "n1",
  event: "refund.failed",
  category: "refunds",
  categoryLabel: "Refunds",
  priority: "urgent",
  title: "Refund didn't go through (BSN-7K2Q)",
  summary: "NGN 640,000 is still owed to the buyer.",
  link: "/admin/bisupplynet/orders/o1",
  targetType: "supplyOrder",
  targetId: "o1",
  readAt: null,
  createdAt: new Date().toISOString(),
  ...over,
});
const PREFS: PreferenceRow[] = [
  { key: "disputes", label: "Disputes", description: "BiSupplyNet disputes opened by buyers.", priority: "normal", urgentLocked: false, hasUrgent: false, digestOnly: false, frequencyOptions: ["instant"], inApp: true, email: true, frequency: "instant" },
  { key: "withdrawals", label: "Payouts", description: "Payout requests, and payouts that failed (urgent).", priority: "low", urgentLocked: false, hasUrgent: true, digestOnly: false, frequencyOptions: ["instant", "digest"], inApp: true, email: true, frequency: "digest" },
  { key: "payments", label: "Payment problems", description: "Payments with the wrong amount.", priority: "urgent", urgentLocked: true, hasUrgent: false, digestOnly: false, frequencyOptions: ["instant"], inApp: true, email: true, frequency: "instant" },
];

let unread = 2;
let items: AdminNotification[] = [];
beforeEach(() => {
  tokenStore.set("business-token");
  serverStatus.set("up");
  fb = installFakeBackend();
  sockets = installFakeSockets();
  adminSession.set("admin-token-1");
  unread = 2;
  items = [note(), note({ _id: "n2", priority: "normal", category: "disputes", categoryLabel: "Disputes", title: "Dispute opened (DSP-0003)", summary: "", link: "/admin/bisupplynet/disputes/d1", readAt: "2026-11-15T10:00:00Z" })];
  fb.handlers["GET /admin/me"] = () => [200, ME];
  fb.handlers["GET /admin/overview"] = () => [200, { period: { range: "30d", from: "", to: "", days: 30, timezone: "Africa/Lagos" }, users: { total: 0, verified: 0, suspended: 0, closing: 0, new: 0, newChange: null }, businesses: { freemium: 0, standard: 0, premium: 0, trial: 0, startupPackage: 0 }, queues: { openTickets: 0, overdueTickets: 0, openDisputes: 0, suppliersToReview: 0, failedRefunds: 0, domainsToAdd: 0 }, feli: { today: { messages: 0, totalTokens: 0, peakTokensPerMinute: 0, rateLimited: 0, busyReplies: 0 } }, series: [] }];
  fb.handlers["GET /admin/notifications/unread-count"] = () => [200, { unread }];
  fb.handlers["GET /admin/notifications"] = (_b, _h, url) => {
    const st = url.searchParams.get("status");
    const cat = url.searchParams.get("category");
    const list = items.filter((n) => (st === "unread" ? !n.readAt : true) && (!cat || n.category === cat));
    return [200, { notifications: list, total: list.length, page: 1, totalPages: 1, unread }];
  };
  fb.handlers["POST /admin/notifications/n1/read"] = () => {
    unread -= 1;
    items = items.map((n) => (n._id === "n1" ? { ...n, readAt: new Date().toISOString() } : n));
    return [200, { ok: true, unread }];
  };
  fb.handlers["POST /admin/notifications/read-all"] = () => {
    unread = 0;
    items = items.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }));
    return [200, { updated: 1, unread }];
  };
  fb.handlers["GET /admin/notification-preferences"] = () => [200, { categories: PREFS, digestTime: "08:00 (Lagos time)" }];
  fb.handlers["GET /admin/bisupplynet/orders/o1"] = () => [404, { message: "Order not found" }];
});
afterEach(() => {
  adminSession.clear();
  sockets.restore();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const bell = async () => (await screen.findAllByRole("button", { name: /^Notifications/ }))[0]!;

describe("the bell", () => {
  it("shows the unread count and opens the /admin socket with the admin token (never the business one)", async () => {
    renderApp("/admin");
    expect(await screen.findAllByRole("button", { name: "Notifications, 2 unread" })).not.toHaveLength(0);
    const s = sockets.latest("/admin")!;
    expect(s).toBeTruthy();
    let auth: { token?: string } = {};
    (s.opts.auth as (cb: (d: object) => void) => void)((d) => (auth = d));
    expect(auth.token).toBe("admin-token-1");
    expect(last("GET /admin/notifications/unread-count")?.headers.Authorization).toBe("Bearer admin-token-1");
  });

  it("a live admin:notification refreshes the count", async () => {
    renderApp("/admin");
    await screen.findAllByRole("button", { name: "Notifications, 2 unread" });
    const s = sockets.latest("/admin")!;
    s.fire("connect");
    unread = 3;
    s.fire("admin:notification", { category: "refunds", priority: "urgent" });
    expect(await screen.findAllByRole("button", { name: "Notifications, 3 unread" })).not.toHaveLength(0);
  });

  it("reconnects with the new token when the admin token changes, and closes on sign-out", async () => {
    renderApp("/admin");
    await screen.findAllByRole("button", { name: "Notifications, 2 unread" });
    const first = sockets.latest("/admin")!;
    act(() => adminSession.set("admin-token-2"));
    await waitFor(() => expect(first.closed).toBe(true));
    const second = sockets.latest("/admin")!;
    expect(second).not.toBe(first);
    let auth: { token?: string } = {};
    (second.opts.auth as (cb: (d: object) => void) => void)((d) => (auth = d));
    expect(auth.token).toBe("admin-token-2");
    act(() => adminSession.clear());
    await waitFor(() => expect(second.closed).toBe(true));
  });

  it("the dropdown lists the latest items; opening one marks it read and goes to its record", async () => {
    const user = userEvent.setup();
    const router = renderApp("/admin");
    await user.click(await bell());
    const panel = await screen.findByRole("dialog", { name: "Latest notifications" });
    expect(await within(panel).findByText("Refund didn't go through (BSN-7K2Q)")).toBeInTheDocument();
    expect(within(panel).getByText("Urgent")).toBeInTheDocument();
    expect(last("GET /admin/notifications")?.key).toBe("GET /admin/notifications");
    await user.click(within(panel).getByRole("button", { name: /Refund didn't go through/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/bisupplynet/orders/o1"));
    expect(last("POST /admin/notifications/n1/read")).toBeTruthy();
  });

  it("mark all read from the dropdown", async () => {
    const user = userEvent.setup();
    renderApp("/admin");
    await user.click(await bell());
    await user.click(await screen.findByRole("button", { name: "Mark all read" }));
    expect(await screen.findAllByRole("button", { name: "Notifications" })).not.toHaveLength(0);
    expect(last("POST /admin/notifications/read-all")?.body).toEqual({});
  });
});

describe("the notification centre", () => {
  it("filters by status and category, and marks all read", async () => {
    const user = userEvent.setup();
    renderApp("/admin/notifications");
    expect(await screen.findByRole("heading", { name: "Notifications" })).toBeInTheDocument();
    const list = await screen.findByRole("heading", { name: "Notification list" }).then((h) => h.parentElement!);
    expect(await within(list).findByText("Dispute opened (DSP-0003)")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Status"), "unread");
    await waitFor(() => expect(within(list).queryByText("Dispute opened (DSP-0003)")).not.toBeInTheDocument());
    expect([...fb.calls].reverse().find((c) => c.key === "GET /admin/notifications")).toBeTruthy();
    await user.selectOptions(screen.getByLabelText("Status"), "all");
    await user.selectOptions(await screen.findByLabelText("Category"), "disputes");
    await waitFor(() => expect(within(list).queryByText(/Refund didn't go through/)).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Mark all read/ }));
    expect(last("POST /admin/notifications/read-all")?.body).toEqual({ category: "disputes" });
  });

  it("shows an empty state", async () => {
    items = [];
    unread = 0;
    renderApp("/admin/notifications");
    expect(await screen.findByText("No notifications yet.")).toBeInTheDocument();
  });
});

describe("notification settings", () => {
  it("urgent categories are locked on; changes save only what changed", async () => {
    fb.handlers["PUT /admin/notification-preferences"] = (body) => {
      const c = (body.categories ?? {}) as Record<string, Partial<PreferenceRow>>;
      return [200, { categories: PREFS.map((p) => ({ ...p, ...(c[p.key] ?? {}) })) }];
    };
    const user = userEvent.setup();
    renderApp("/admin/notifications/settings");
    expect(await screen.findByRole("heading", { name: "Notification settings" })).toBeInTheDocument();
    const locked = await screen.findAllByLabelText("Payment problems: email (always on)");
    for (const b of locked) {
      expect(b).toBeChecked();
      expect(b).toBeDisabled();
    }
    const save = screen.getByRole("button", { name: "Save settings" });
    expect(save).toBeDisabled();
    await user.click(screen.getAllByLabelText("Disputes: email")[0]!);
    await user.selectOptions(screen.getAllByLabelText("Payouts: email timing")[0]!, "instant");
    await user.click(save);
    await waitFor(() => expect(last("PUT /admin/notification-preferences")).toBeTruthy());
    expect(last("PUT /admin/notification-preferences")!.body).toEqual({ categories: { disputes: { inApp: true, email: false, frequency: "instant" }, withdrawals: { inApp: true, email: true, frequency: "instant" } } });
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
  });
});
