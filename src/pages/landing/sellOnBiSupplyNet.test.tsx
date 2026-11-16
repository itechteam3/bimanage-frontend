import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { afterAuthPath, pendingInvite, pendingNext } from "@/lib/auth/pending";
import { ME, installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";
import { installFakeSockets } from "@/test/fakeSocket";

const APPLY = "/bisupplynet/sell/apply";

let fb: FakeBackend;
beforeEach(() => {
  serverStatus.set("up");
  installFakeSockets();
  tokenStore.clear();
  window.sessionStorage.clear();
  fb = installFakeBackend();
  fb.handlers["GET /public/plans"] = () => [200, { currency: "NGN", plans: [], startupPackages: [] }];
  fb.handlers["GET /public/stats"] = () => [200, { businesses: { count: 0, show: false }, storesLive: { count: 0, show: false }, ordersProcessed: { count: 0, show: false }, reviews: { count: 0, average: 0, show: false } }];
  fb.handlers["GET /reviews"] = () => [200, { reviews: [], total: 0, page: 1, totalPages: 0, stats: { averageRating: 0, totalReviews: 0, ratingBreakdown: {} } }];
  vi.stubGlobal("IntersectionObserver", undefined);
});
afterEach(() => {
  tokenStore.clear();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
});

const section = async () => {
  await screen.findByRole("heading", { level: 2, name: "Sell wholesale to other businesses" });
  return document.getElementById("sell")!;
};

describe("landing: Sell on BiSupplyNet (#sell)", () => {
  it("shows who it's for, the benefits, the 5 steps, escrow and the Premium requirement, with no dashes", async () => {
    renderApp("/");
    const s = await section();
    expect(s).toHaveAccessibleName("Sell wholesale to other businesses");
    expect(s.textContent).toMatch(/wholesalers, manufacturers and distributors/i);
    const steps = within(within(s).getByRole("list", { name: "Steps to become a supplier" })).getAllByRole("listitem");
    expect(steps).toHaveLength(5);
    expect(steps.map((li) => li.querySelector("p")!.textContent)).toEqual([
      "Step 1: Create your business account",
      "Step 2: Be on Premium",
      "Step 3: Apply as a wholesaler",
      "Step 4: We review your application",
      "Step 5: List products and get orders",
    ]);
    expect(within(s).getByTestId("lp-sell-premium")).toHaveTextContent(/selling needs premium/i);
    expect(within(s).getByRole("heading", { name: "How escrow protects you" })).toBeInTheDocument();
    expect(s.textContent).toMatch(/released to you when the buyer confirms delivery/i);
    expect(s.textContent).not.toMatch(/[–—]/);
    expect(s.textContent).not.toMatch(/₦/); // no hardcoded prices
  });

  it("signed out: the button goes to sign-up and remembers the application as the next stop", async () => {
    renderApp("/");
    const s = await section();
    const btn = within(s).getByRole("link", { name: /become a supplier/i });
    expect(btn).toHaveAttribute("href", "/register");
    await userEvent.click(btn);
    expect(pendingNext.get()).toBe(APPLY);
  });

  it("signed in: the button goes straight to the application", async () => {
    tokenStore.set("tok");
    renderApp("/");
    const s = await section();
    await waitFor(() => expect(within(s).getByRole("link", { name: /become a supplier/i })).toHaveAttribute("href", APPLY));
  });
});

describe("pending destination after sign-up", () => {
  it("only allowlisted in-app paths are ever stored or used", () => {
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "/dashboard", "/bisupplynet/sell/apply?x=1"]) {
      pendingNext.set(bad);
      expect(pendingNext.get()).toBeNull();
      window.sessionStorage.setItem("bimanage.pendingNext", bad); // even if planted directly
      expect(pendingNext.get()).toBeNull();
      expect(afterAuthPath("/start")).toBe("/start");
    }
    window.sessionStorage.clear();
    pendingNext.set(APPLY);
    expect(afterAuthPath("/start")).toBe(APPLY);
    pendingInvite.set("inv-1"); // an invite still comes first
    expect(afterAuthPath("/start")).toBe("/invite/accept");
  });

  it("new account: email verified, onboarding first, then the business profile save opens the application", async () => {
    pendingNext.set(APPLY);
    let userPath: string | null = null;
    fb.handlers["GET /onboarding/status"] = () => [200, { userPath, isTrialUsed: false }];
    fb.handlers["POST /verify/email"] = () => [200, { ...ME, token: "tok-v" }];
    const router = renderApp("/verify?email=sam%40x.com");
    await userEvent.type(await screen.findByLabelText(/verification code/i), "286419");
    await userEvent.click(screen.getByRole("button", { name: "Verify email" }));
    // Not onboarded yet: the gate sends them to choose a path, and the destination waits.
    await waitFor(() => expect(router.state.location.pathname).toBe("/onboarding"));
    expect(pendingNext.get()).toBe(APPLY);

    fb.handlers["POST /onboarding/select-path"] = (b) => {
      userPath = b.path as string;
      return [200, { userPath }];
    };
    fb.handlers["POST /onboarding/start-trial"] = () => [200, { daysRemaining: 14 }];
    fb.handlers["GET /business-profile"] = () => [200, {}];
    fb.handlers["PUT /business-profile"] = (b) => [200, b];
    await userEvent.click(await screen.findByRole("button", { name: /start existing-business setup/i }));
    await userEvent.click(await screen.findByRole("link", { name: /continue setting up/i }));
    await userEvent.type(await screen.findByLabelText(/legal business name/i), "Elijah Apparel Ltd");
    await userEvent.selectOptions(screen.getByLabelText(/business type/i), "limited_liability");
    await userEvent.selectOptions(screen.getByLabelText(/business category/i), "fashion");
    await userEvent.type(screen.getByLabelText(/phone number/i), "+2348035550190");
    await userEvent.type(screen.getByLabelText(/^email address/i), "hello@elijahapparel.com");
    await userEvent.click(screen.getByRole("button", { name: /save and continue/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe(APPLY));
    await waitFor(() => expect(pendingNext.get()).toBeNull()); // used once
  });

  it("already onboarded: Google sign-in goes straight to the application", async () => {
    pendingNext.set(APPLY);
    fb.handlers["POST /auth/google/exchange"] = () => [200, { ...ME, token: "g-tok" }];
    window.history.replaceState(null, "", "/oauth/callback?code=c1");
    const router = renderApp("/oauth/callback?code=c1");
    await waitFor(() => expect(router.state.location.pathname).toBe(APPLY));
    await waitFor(() => expect(pendingNext.get()).toBeNull());
  });

  it("without a pending destination, sign-in flows are unchanged", async () => {
    fb.handlers["POST /auth/google/exchange"] = () => [200, { ...ME, token: "g-tok" }];
    window.history.replaceState(null, "", "/oauth/callback?code=c1");
    const router = renderApp("/oauth/callback?code=c1");
    await waitFor(() => expect(router.state.location.pathname).toBe("/dashboard"));
  });
});
