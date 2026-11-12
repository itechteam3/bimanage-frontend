import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { routes } from "@/App";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { tokenStore } from "@/lib/auth/tokenStore";
import { pendingInvite } from "@/lib/auth/pending";
import { serverStatus } from "@/lib/api/serverStatus";

// Fake backend: route table of "METHOD /path" → (body, headers) => [status, json]
type Handler = (body: Record<string, unknown>, headers: Record<string, string>) => [number, unknown, Record<string, string>?];
let handlers: Record<string, Handler>;
let calls: Array<{ key: string; body: Record<string, unknown>; headers: Record<string, string> }>;

const ME = { _id: "u1", name: "Samuel Adebayo", email: "sam@x.com", isVerified: true };
const OWNER_WS = { role: "owner", permissions: { viewDashboard: true }, businessId: "u1" };

beforeEach(() => {
  tokenStore.clear();
  pendingInvite.clear();
  serverStatus.set("up");
  calls = [];
  handlers = {
    "GET /auth/me": () => [200, ME],
    "GET /settings/my-role": () => [200, OWNER_WS],
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const u = new URL(url);
      const key = `${init.method ?? "GET"} ${u.pathname.replace(/^\/api/, "")}`;
      const body = init.body ? JSON.parse(String(init.body)) : {};
      const headers = (init.headers ?? {}) as Record<string, string>;
      calls.push({ key, body, headers });
      const h = handlers[key];
      const [status, json, extra] = h ? h(body, headers) : [404, { message: `no handler for ${key}` }];
      return new Response(JSON.stringify(json), { status, headers: { "content-type": "application/json", ...(extra ?? {}) } });
    })
  );
});
afterEach(() => vi.unstubAllGlobals());

const renderAt = (path: string, state?: unknown) => {
  const router = createMemoryRouter(routes, { initialEntries: [{ pathname: path.split("?")[0]!, search: path.includes("?") ? `?${path.split("?")[1]}` : "", state }] });
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
  return router;
};
const type = (label: RegExp, value: string) => userEvent.type(screen.getByLabelText(label), value);

describe("sign in (01.01 / 01.08)", () => {
  it("signs in, stores the session and opens the workspace", async () => {
    handlers["POST /auth/login"] = () => [200, { ...ME, token: "tok-1" }];
    const router = renderAt("/login");
    await type(/email address/i, "sam@x.com");
    await type(/^password/i, "Secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { name: /welcome, samuel/i })).toBeInTheDocument();
    expect(tokenStore.get()).toBe("tok-1");
    expect(router.state.location.pathname).toBe("/dashboard");
    expect(calls.find((c) => c.key === "GET /auth/me")!.headers.Authorization).toBe("Bearer tok-1");
  });

  it("wrong details show 01.08 with attempts left", async () => {
    handlers["POST /auth/login"] = () => [401, { message: "Invalid email or password", attemptsRemaining: 2 }];
    renderAt("/login");
    await type(/email address/i, "sam@x.com");
    await type(/^password/i, "nope1234");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { name: /check your sign-in details/i })).toBeInTheDocument();
    expect(screen.getByText(/2 attempts left/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("an unverified account goes to email verification", async () => {
    handlers["POST /auth/login"] = () => [403, { message: "Email not verified", isVerified: false, email: "sam@x.com" }];
    const router = renderAt("/login");
    await type(/email address/i, "sam@x.com");
    await type(/^password/i, "Secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/verify"));
    expect(router.state.location.search).toContain("email=sam%40x.com");
  });

  it("the login cooldown is explained in minutes", async () => {
    handlers["POST /auth/login"] = () => [429, { message: "Too many", cooldown: true, retryAfterSeconds: 540 }];
    renderAt("/login");
    await type(/email address/i, "sam@x.com");
    await type(/^password/i, "Secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText(/try again in 9 minutes/i)).toBeInTheDocument();
  });

  it("validates before calling the API", async () => {
    renderAt("/login");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText(/enter your email address/i)).toBeInTheDocument();
    expect(calls.some((c) => c.key === "POST /auth/login")).toBe(false);
  });
});

describe("create account (01.02) and verify (01.03 / 01.07 / 01.13)", () => {
  it("shows the mismatch message from 01.12", async () => {
    renderAt("/register");
    await type(/full name/i, "Samuel Adebayo");
    await type(/work email/i, "sam@x.com");
    await type(/^password/i, "Secret123");
    await type(/confirm password/i, "Secret124");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it("registers then verifies the code and signs in", async () => {
    handlers["POST /auth/register"] = () => [201, { message: "ok", email: "sam@x.com" }];
    handlers["POST /verify/email"] = (b) => (b.otp === "286419" ? [200, { ...ME, token: "tok-v" }] : [400, { message: "Invalid OTP" }]);
    const router = renderAt("/register");
    await type(/full name/i, "Samuel Adebayo");
    await type(/work email/i, "sam@x.com");
    await type(/^password/i, "Secret123");
    await type(/confirm password/i, "Secret123");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("heading", { name: "Verify your email" })).toBeInTheDocument();
    expect(calls.find((c) => c.key === "POST /auth/register")!.body).toEqual({ name: "Samuel Adebayo", email: "sam@x.com", password: "Secret123" });

    await type(/verification code/i, "111111");
    await userEvent.click(screen.getByRole("button", { name: "Verify email" }));
    expect(await screen.findByText(/the code is incorrect/i)).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText(/verification code/i));
    await type(/verification code/i, "28 64 19");
    await userEvent.click(screen.getByRole("button", { name: "Verify email" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/dashboard"));
    expect(tokenStore.get()).toBe("tok-v");
  });

  it("an expired code switches to 01.07 and resends", async () => {
    handlers["POST /verify/email"] = () => [400, { message: "OTP has expired. Please request a new one." }];
    handlers["POST /verify/resend"] = () => [200, { message: "sent" }];
    renderAt("/verify?email=sam%40x.com");
    await type(/verification code/i, "123456");
    await userEvent.click(screen.getByRole("button", { name: "Verify email" }));
    expect(await screen.findByRole("heading", { name: /verification code expired/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /resend security code/i }));
    expect(await screen.findByText(/a new code is on its way/i)).toBeInTheDocument();
    expect(calls.find((c) => c.key === "POST /verify/resend")!.body).toEqual({ email: "sam@x.com" });
  });
});

describe("password reset (01.04 → 01.09 → 01.05 → 01.06)", () => {
  it("runs the whole flow and sends the reset token only to reset-password", async () => {
    handlers["POST /auth/forgot-password"] = () => [200, { message: "If this email exists, an OTP has been sent" }];
    handlers["POST /auth/verify-otp"] = () => [200, { message: "OTP verified", resetToken: "reset-tok" }];
    handlers["POST /auth/reset-password"] = () => [200, { message: "Password reset successful" }];
    const router = renderAt("/forgot-password");
    await type(/email address/i, "sam@x.com");
    await userEvent.click(screen.getByRole("button", { name: /send reset code/i }));
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();

    await type(/reset code/i, "123456");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { name: /choose a new password/i })).toBeInTheDocument();
    expect(router.state.location.search).toBe(""); // token never in the URL

    await type(/new password/i, "NewSecret99");
    await type(/confirm password/i, "NewSecret99");
    await userEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByRole("heading", { name: /password successfully updated/i })).toBeInTheDocument();

    const reset = calls.find((c) => c.key === "POST /auth/reset-password")!;
    expect(reset.headers.Authorization).toBe("Bearer reset-tok");
    expect(reset.body).toEqual({ password: "NewSecret99" });
    expect(tokenStore.get()).toBeNull(); // not signed in by a reset
  });

  it("opening the new-password page without a reset session shows 01.10", async () => {
    renderAt("/reset-password");
    expect(await screen.findByRole("heading", { name: /this reset has expired/i })).toBeInTheDocument();
  });

  it("an expired reset token (401) shows 01.10", async () => {
    handlers["POST /auth/reset-password"] = () => [401, { message: "This reset link has expired." }];
    renderAt("/reset-password", { email: "sam@x.com", resetToken: "old" });
    await type(/new password/i, "NewSecret99");
    await type(/confirm password/i, "NewSecret99");
    await userEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByRole("heading", { name: /this reset has expired/i })).toBeInTheDocument();
  });

  it("a failed request shows 01.14", async () => {
    handlers["POST /auth/forgot-password"] = () => [500, { message: "boom" }];
    renderAt("/forgot-password");
    await type(/email address/i, "sam@x.com");
    await userEvent.click(screen.getByRole("button", { name: /send reset code/i }));
    expect(await screen.findByText(/your request could not be sent/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("Google callback, invites and guards", () => {
  it("/oauth/callback stores the token, clears it from the URL and opens the workspace", async () => {
    window.history.replaceState(null, "", "/oauth/callback?token=g-tok");
    const replace = vi.spyOn(window.history, "replaceState");
    const router = renderAt("/oauth/callback?token=g-tok");
    await waitFor(() => expect(router.state.location.pathname).toBe("/dashboard"));
    expect(tokenStore.get()).toBe("g-tok");
    expect(replace).toHaveBeenCalledWith(null, "", "/oauth/callback");
  });

  it("an invite opened while signed out waits for sign-in, then is accepted", async () => {
    const invite = "a".repeat(64);
    handlers["POST /auth/login"] = () => [200, { ...ME, token: "tok-i" }];
    handlers["POST /settings/team/accept-invite"] = (b) => (b.token === invite ? [200, { message: "joined" }] : [400, { message: "bad" }]);
    const router = renderAt(`/invite/accept?token=${invite}`);
    expect(await screen.findByRole("heading", { name: /invited to a bimanage team/i })).toBeInTheDocument();
    expect(pendingInvite.get()).toBe(invite);

    await router.navigate("/login");
    await userEvent.type(await screen.findByLabelText(/email address/i), "sam@x.com");
    await type(/^password/i, "Secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { name: /you.ve joined the team/i })).toBeInTheDocument();
    expect(pendingInvite.get()).toBeNull();
  });

  it("signed-out visitors to the workspace go to sign in with a return path", async () => {
    const router = renderAt("/dashboard");
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(router.state.location.search).toBe("?next=%2Fdashboard");
  });

  it("a saved session that the server rejects returns to sign in with a notice", async () => {
    tokenStore.set("stale");
    handlers["GET /auth/me"] = () => [401, { message: "Session has expired. Please log in again." }];
    renderAt("/dashboard");
    expect(await screen.findByText(/your session has expired/i)).toBeInTheDocument();
    expect(tokenStore.get()).toBeNull();
  });
});
