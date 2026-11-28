import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";

const NONE = { retail: { status: "available", activatedAt: null, pausedAt: null }, wholesale: { status: "available", activatedAt: null, pausedAt: null }, mode: "none", chosen: false };
const BOTH = { retail: { status: "active", activatedAt: "2026-11-28T10:00:00Z", pausedAt: null }, wholesale: { status: "active", activatedAt: "2026-11-28T10:00:00Z", pausedAt: null }, mode: "both", chosen: true };

let fb: FakeBackend;
beforeEach(() => {
  tokenStore.set("tok");
  serverStatus.set("up");
  fb = installFakeBackend();
  fb.handlers["GET /onboarding/status"] = () => [200, { userPath: "startup", isTrialUsed: false }];
  fb.handlers["GET /selling-channels"] = () => [200, { channels: NONE, isOwner: true }];
  fb.handlers["GET /business-profile"] = () => [200, {}];
});
afterEach(() => tokenStore.clear());
const last = (key: string) => [...fb.calls].reverse().find((c) => c.key === key);

describe("onboarding: choose selling channels", () => {
  it("Both is recommended and preselected; continuing saves it and shows the both-channels summary", async () => {
    let saved: unknown = NONE;
    fb.handlers["GET /selling-channels"] = () => [200, { channels: saved, isOwner: true }];
    fb.handlers["POST /selling-channels/choose"] = () => {
      saved = BOTH;
      return [200, { channels: BOTH, message: "You're set up to sell retail and wholesale from one shared inventory." }];
    };
    const router = renderApp("/onboarding/channels");
    const user = userEvent.setup();
    expect(await screen.findByRole("heading", { name: "Choose selling channels" })).toBeInTheDocument();
    const group = screen.getByRole("group", { name: /how will you sell/i });
    expect(within(group).getByRole("radio", { name: /both/i })).toBeChecked();
    expect(screen.getByText("Recommended for flexible businesses")).toBeInTheDocument();
    expect(screen.getByText(/One account\. Shared business history\./)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue with both channels" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/onboarding/channels/both"));
    expect(last("POST /selling-channels/choose")?.body).toEqual({ channels: "both" });
    expect(await screen.findByRole("heading", { name: "Both channels, one business" })).toBeInTheDocument();
    expect(screen.getAllByText("Active")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Continue to business setup" })).toHaveAttribute("href", "/onboarding/business");
  });

  it("retail only: the button follows the choice and goes straight to business setup", async () => {
    fb.handlers["POST /selling-channels/choose"] = () => [200, { channels: { ...NONE, retail: { status: "active" }, mode: "retail", chosen: true }, message: "ok" }];
    const router = renderApp("/onboarding/channels");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("radio", { name: /^retail/i }));
    await user.click(screen.getByRole("button", { name: "Continue with retail" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/onboarding/business"));
    expect(last("POST /selling-channels/choose")?.body).toEqual({ channels: "retail" });
  });

  it("already chosen (or set up before channels): skips to business setup", async () => {
    fb.handlers["GET /selling-channels"] = () => [200, { channels: BOTH, isOwner: true }];
    const router = renderApp("/onboarding/channels");
    await waitFor(() => expect(router.state.location.pathname).toBe("/onboarding/business"));
  });

  it("a failed save says so plainly and keeps the choice", async () => {
    fb.handlers["POST /selling-channels/choose"] = () => [500, { message: "Internal error at sellingChannels.js:42" }];
    renderApp("/onboarding/channels");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("radio", { name: /^wholesale/i }));
    await user.click(screen.getByRole("button", { name: "Continue with wholesale" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).not.toMatch(/sellingChannels\.js|Internal error/);
    expect(screen.getByRole("radio", { name: /^wholesale/i })).toBeChecked();
  });

  it("explains retail vs wholesale, and that buying on BiSupplyNet is separate", async () => {
    renderApp("/onboarding/channels");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("link", { name: "How retail and wholesale differ" }));
    expect(await screen.findByRole("heading", { name: "Retail and wholesale explained" })).toBeInTheDocument();
    expect(screen.getByText("Buying wholesale is different from selling wholesale.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Choose my selling channels" })).toHaveAttribute("href", "/onboarding/channels");
  });

  it("the both-channels summary is only for businesses that chose both", async () => {
    fb.handlers["GET /selling-channels"] = () => [200, { channels: { ...BOTH, wholesale: { status: "available" }, mode: "retail" }, isOwner: true }];
    const router = renderApp("/onboarding/channels/both");
    await waitFor(() => expect(router.state.location.pathname).toBe("/onboarding/business"));
  });
});
