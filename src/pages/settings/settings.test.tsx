import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { installFakeBackend, renderApp, ME, type FakeBackend } from "@/test/fakeBackend";
import { installFakeSockets } from "@/test/fakeSocket";
import { describeDevice } from "./SettingsPages";

// Account & settings (Figma 13.01–13.08).

let fb: FakeBackend;
let sockets: ReturnType<typeof installFakeSockets>;
const last = (key: string) => [...fb.calls].reverse().find((c) => c.key === key);
const PROFILE = { ...ME, hasPassword: true, passwordChangedAt: "2026-10-06T10:00:00.000Z" };
const PREFS = { startPage: "dashboard", reduceMotion: false, largerText: false, timezone: "Africa/Lagos", currency: "NGN", dateFormat: "DD MMM YYYY", language: "English (UK)", startPages: ["dashboard", "sales", "orders", "inventory", "store", "projects", "messages"] };

beforeEach(() => {
  tokenStore.set("tok");
  serverStatus.set("up");
  fb = installFakeBackend();
  sockets = installFakeSockets();
  fb.handlers["GET /subscriptions/current"] = () => [200, { plan: "premium", status: "active", features: { analytics: true, orders: true } }];
  fb.handlers["GET /profile"] = () => [200, PROFILE];
  fb.handlers["GET /profile/preferences"] = () => [200, PREFS];
});
afterEach(() => {
  sockets.restore();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  tokenStore.clear();
  localStorage.clear();
  document.documentElement.className = "";
});

describe("13.04 security and password", () => {
  it("changing the password keeps this device signed in with the new token, reconnects live updates and confirms", async () => {
    fb.handlers["PUT /profile/change-password"] = () => [200, { message: "Password changed.", token: "tok-2", passwordChangedAt: "2026-11-14T09:00:00.000Z" }];
    const user = userEvent.setup();
    renderApp("/settings/security");
    expect(await screen.findByText("6 October 2026")).toBeInTheDocument();
    await waitFor(() => expect(sockets.latest()).toBeTruthy());
    const socket = sockets.latest()!;
    const reconnect = vi.spyOn(socket, "connect");
    await user.type(screen.getByLabelText(/current password/i), "OldPass123");
    await user.type(screen.getByLabelText(/^new password/i), "NewPass456!");
    await user.type(screen.getByLabelText(/confirm password/i), "NewPass456!");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByText(/password changed\. your other devices have been signed out/i)).toBeInTheDocument();
    expect(last("PUT /profile/change-password")?.body).toEqual({ currentPassword: "OldPass123", newPassword: "NewPass456!", confirmPassword: "NewPass456!" });
    expect(tokenStore.get()).toBe("tok-2");
    expect(reconnect).toHaveBeenCalled();
  });

  it("explains the cooldown when there have been too many attempts", async () => {
    fb.handlers["PUT /profile/change-password"] = () => [429, { message: "Too many password attempts. Please try again in 15 minutes.", retryAfterSeconds: 900 }];
    const user = userEvent.setup();
    renderApp("/settings/security");
    await user.type(await screen.findByLabelText(/current password/i), "OldPass123");
    await user.type(screen.getByLabelText(/^new password/i), "NewPass456!");
    await user.type(screen.getByLabelText(/confirm password/i), "NewPass456!");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByText("Too many attempts. Try again in 15 minutes.")).toBeInTheDocument();
    expect(tokenStore.get()).toBe("tok");
  });

  it("a wrong current password is shown on that field", async () => {
    fb.handlers["PUT /profile/change-password"] = () => [400, { message: "Current password is incorrect" }];
    const user = userEvent.setup();
    renderApp("/settings/security");
    await user.type(await screen.findByLabelText(/current password/i), "Wrong123");
    await user.type(screen.getByLabelText(/^new password/i), "NewPass456!");
    await user.type(screen.getByLabelText(/confirm password/i), "NewPass456!");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByText(/that isn't your current password/i)).toBeInTheDocument();
  });

  it("Google-only accounts see why there's no password form", async () => {
    fb.handlers["GET /profile"] = () => [200, { ...PROFILE, hasPassword: false, passwordChangedAt: null }];
    renderApp("/settings/security");
    expect(await screen.findByRole("heading", { name: /you sign in with google/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/current password/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Update password" })).toBeNull();
  });

  it("signs out of all other devices and keeps this one signed in", async () => {
    fb.handlers["POST /profile/sign-out-other-devices"] = () => [200, { message: "Done", token: "tok-3" }];
    const user = userEvent.setup();
    renderApp("/settings/sessions");
    expect(await screen.findByText("Current session · Active")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign out of all other devices" }));
    expect(await screen.findByText(/you've been signed out of all other devices/i)).toBeInTheDocument();
    expect(tokenStore.get()).toBe("tok-3");
  });

  it("names this device from the browser", () => {
    expect(describeDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36")).toBe("Chrome on Windows");
    expect(describeDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1")).toBe("Safari on iPhone");
  });
});

describe("13.07 session expired", () => {
  it("a session ended from another device shows the session-expired screen with a way back", async () => {
    fb.handlers["GET /dashboard"] = () => [401, { message: "Session has expired. Please log in again.", sessionEnded: true }];
    const router = renderApp("/dashboard");
    expect(await screen.findByRole("heading", { name: /your session has expired/i })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/session-expired");
    expect(screen.getByRole("link", { name: "Sign in again" })).toHaveAttribute("href", "/login?next=%2Fdashboard");
    expect(screen.getByRole("link", { name: "Reset password" })).toHaveAttribute("href", "/forgot-password");
    expect(tokenStore.get()).toBeNull();
  });
});

describe("13.08 close account", () => {
  const CHECK = { canClose: true, blockers: [], businessName: "Elijah Apparel Ltd", graceDays: 30 };

  it("lists what's blocking closure, with links, and keeps the button disabled", async () => {
    fb.handlers["GET /profile/closure-check"] = () => [200, { ...CHECK, canClose: false, blockers: [{ key: "orders", label: "Orders still open", count: 2, link: "/orders" }, { key: "wallet", label: "Money in your wallet", count: 1, amount: 15000, link: "/wallet" }] }];
    renderApp("/settings/close-account");
    const list = await screen.findByRole("list", { name: /things to sort out first/i });
    expect(within(list).getByText("Orders still open")).toBeInTheDocument();
    expect(within(list).getByText(/₦15,000/)).toBeInTheDocument();
    expect(within(list).getByRole("link", { name: /orders still open/i })).toHaveAttribute("href", "/orders");
    expect(screen.getByRole("button", { name: "Request closure" })).toBeDisabled();
  });

  it("closing signs out and shows the removal date", async () => {
    fb.handlers["GET /profile/closure-check"] = () => [200, CHECK];
    fb.handlers["POST /profile/close"] = () => [200, { message: "Closing", purgeAt: "2026-12-14T10:00:00.000Z" }];
    const user = userEvent.setup();
    const router = renderApp("/settings/close-account");
    expect(await screen.findByText(/you have 30 days to change your mind/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/current password/i), "Secret123");
    await user.type(screen.getByLabelText(/why are you leaving/i), "Moving on");
    await user.click(screen.getByRole("button", { name: "Request closure" }));
    expect(await screen.findByText("14 December 2026")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/account-closed");
    expect(last("POST /profile/close")?.body).toEqual({ password: "Secret123", reason: "Moving on" });
    expect(tokenStore.get()).toBeNull();
  });

  it("teammates are told only the owner can close the business", async () => {
    fb.handlers["GET /settings/my-role"] = () => [200, { role: "manager", permissions: { viewDashboard: true }, businessId: "o1" }];
    renderApp("/settings/close-account");
    expect(await screen.findByRole("heading", { name: /only the owner can close the business/i })).toBeInTheDocument();
    expect(fb.calls.some((c) => c.key === "GET /profile/closure-check")).toBe(false);
  });

  it("a closing account is offered Keep my account, which restores it and opens the dashboard", async () => {
    let closing = true;
    fb.handlers["GET /auth/me"] = () => (closing ? [403, { message: "This account is closing.", accountClosing: true, purgeAt: "2026-12-14T10:00:00.000Z" }] : [200, ME]);
    fb.handlers["GET /profile/closure"] = () => [200, { status: "closing", purgeAt: "2026-12-14T10:00:00.000Z", requestedAt: "2026-11-14T10:00:00.000Z" }];
    fb.handlers["POST /profile/restore"] = (b) => {
      closing = false;
      return b.confirm === true ? [200, { message: "Back", token: "tok-r", planNote: "Your plan will renew as before." }] : [400, {}];
    };
    const user = userEvent.setup();
    const router = renderApp("/dashboard");
    expect(await screen.findByRole("heading", { name: /your account is closing/i })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/account-closing");
    expect(screen.getAllByText(/14 December 2026/).length).toBeGreaterThan(0);
    expect(tokenStore.get()).toBe("tok");
    await user.click(screen.getByRole("button", { name: "Keep my account" }));
    expect(await screen.findByText(/welcome back\. your account is restored\. your plan will renew as before\./i)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dashboard");
    expect(tokenStore.get()).toBe("tok-r");
  });
});

describe("13.03 workspace preferences", () => {
  it("saves the start page and accessibility, and applies them", async () => {
    fb.handlers["PUT /profile/preferences"] = (b) => [200, { ...PREFS, ...b }];
    const user = userEvent.setup();
    renderApp("/settings/preferences");
    const select = await screen.findByLabelText(/dashboard start page/i);
    expect(screen.getByText("Africa/Lagos (Nigeria, UTC+1)")).toBeInTheDocument();
    await user.selectOptions(select, "orders");
    await user.click(screen.getByLabelText(/larger text/i));
    await user.click(screen.getByRole("button", { name: "Save preferences" }));
    expect(await screen.findByText("Preferences saved.")).toBeInTheDocument();
    expect(last("PUT /profile/preferences")?.body).toEqual({ startPage: "orders", reduceMotion: false, largerText: true });
    await waitFor(() => expect(document.documentElement.classList.contains("larger-text")).toBe(true));
    expect(document.documentElement.classList.contains("reduce-motion")).toBe(false);
  });

  it("opens the chosen start page after sign-in", async () => {
    fb.handlers["GET /profile/preferences"] = () => [200, { ...PREFS, startPage: "orders" }];
    const router = renderApp("/");
    await waitFor(() => expect(router.state.location.pathname).toBe("/orders"));
  });
});

describe("13.01 business profile", () => {
  it("shows the owner, store link and completeness, with no verified badges", async () => {
    fb.handlers["GET /business-profile"] = () => [
      200,
      {
        businessName: "Elijah Apparel Ltd",
        businessType: "limited_liability",
        businessCategory: "fashion",
        businessEmail: "hello@elijahapparel.com",
        businessPhone: "+234 803 555 0190",
        owner: { name: "Samuel Adebayo" },
        store: { name: "Elijah Apparel", slug: "elijahapparel", url: "https://elijahapparel.bimanage.com", customDomain: null, published: true },
        completeness: { completed: 6, total: 8, percent: 75, missing: ["logo", "businessDescription"] },
      },
    ];
    renderApp("/settings/business");
    expect(await screen.findByText("Profile completeness: 75%.")).toBeInTheDocument();
    expect(screen.getAllByText("Samuel Adebayo").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Visit store" })).toHaveAttribute("href", "https://elijahapparel.bimanage.com");
    expect(screen.getByRole("progressbar", { name: /profile completeness/i })).toHaveAttribute("aria-valuenow", "75");
    expect(screen.getByText(/still to add: logo, about the business/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit business profile" })).toHaveAttribute("href", "/settings/business/edit");
    expect(screen.queryByText(/verified/i)).toBeNull();
  });

  it("is read only for teammates who can't manage settings", async () => {
    fb.handlers["GET /settings/my-role"] = () => [200, { role: "staff", permissions: { viewDashboard: true, manageSettings: false }, businessId: "o1" }];
    renderApp("/settings/business/edit");
    expect(await screen.findByRole("heading", { name: /you can view these details, not change them/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save business details" })).toBeNull();
  });

  it("the settings hub links every section and shows security alerts are always on", async () => {
    renderApp("/settings");
    expect(await screen.findByRole("link", { name: /business profile/i })).toHaveAttribute("href", "/settings/business");
    expect(screen.getByRole("link", { name: /workspace preferences/i })).toHaveAttribute("href", "/settings/preferences");
    expect(screen.getByRole("link", { name: /choose which alerts reach you/i })).toHaveAttribute("href", "/notifications/preferences");
    expect(screen.getByText(/security alerts: always on/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /close account/i })).toHaveAttribute("href", "/settings/close-account");
  });
});
