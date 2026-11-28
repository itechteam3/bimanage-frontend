import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";

const st = (status: string) => ({ status, activatedAt: null, pausedAt: null });
const ch = (retail: string, wholesale: string) => {
  const r = retail === "active";
  const w = wholesale === "active";
  return { retail: st(retail), wholesale: st(wholesale), mode: r && w ? "both" : r ? "retail" : w ? "wholesale" : "none", chosen: true };
};
const CLEAR = { activeOrders: 0, unsettledPayments: 0, openDisputes: 0 };

let fb: FakeBackend;
let current: ReturnType<typeof ch>;
beforeEach(() => {
  tokenStore.set("tok");
  serverStatus.set("up");
  fb = installFakeBackend();
  current = ch("active", "available");
  fb.handlers["GET /selling-channels"] = () => [200, { channels: current, isOwner: true }];
});
afterEach(() => tokenStore.clear());
const last = (key: string) => [...fb.calls].reverse().find((c) => c.key === key);

describe("Settings → Selling channels", () => {
  it("overview: each channel's status with the right action; reachable from the settings hub", async () => {
    current = ch("active", "paused");
    const user = userEvent.setup();
    const router = renderApp("/settings");
    await user.click(await screen.findByRole("link", { name: /selling channels/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/settings/channels"));
    expect(await screen.findByRole("heading", { name: "Business selling channels" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Turn off Retail" })).toHaveAttribute("href", "/settings/channels/retail/deactivate");
    expect(screen.getByRole("link", { name: "Reactivate Wholesale" })).toHaveAttribute("href", "/settings/channels/wholesale/activate");
  });

  it("activate wholesale: confirm, saved, then the result with the next step", async () => {
    fb.handlers["POST /selling-channels/wholesale/activate"] = () => {
      current = ch("active", "active");
      return [200, { channels: current, message: "Wholesale is on. You can now set wholesale prices and start taking wholesale orders." }];
    };
    const user = userEvent.setup();
    const router = renderApp("/settings/channels/wholesale/activate");
    expect(await screen.findByRole("heading", { name: "Activate or expand a channel" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Activate Wholesale" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/settings/channels/done"));
    expect(last("POST /selling-channels/wholesale/activate")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Retail + Wholesale activated" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Set wholesale prices" })).toHaveAttribute("href", "/inventory/products");
  });

  it("reactivate: the saved setup comes back", async () => {
    current = ch("active", "paused");
    fb.handlers["POST /selling-channels/wholesale/reactivate"] = () => {
      current = ch("active", "active");
      return [200, { channels: current, message: "Wholesale is back on with your saved prices and settings." }];
    };
    const user = userEvent.setup();
    renderApp("/settings/channels/wholesale/activate");
    expect(await screen.findByRole("heading", { name: "Reactivate a selling channel" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reactivate Wholesale" }));
    expect(await screen.findByRole("heading", { name: "Wholesale channel reactivated" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review wholesale listings" })).toBeInTheDocument();
  });

  it("turn off with nothing open: final check, then turned off", async () => {
    current = ch("active", "active");
    fb.handlers["GET /selling-channels/wholesale/deactivation-check"] = () => [200, { channel: "wholesale", status: "active", blockers: CLEAR, lastChannel: false, canDeactivate: true }];
    fb.handlers["POST /selling-channels/wholesale/deactivate"] = () => {
      current = ch("active", "paused");
      return [200, { channels: current, message: "Wholesale is off. No new wholesale orders will come in." }];
    };
    const user = userEvent.setup();
    renderApp("/settings/channels/wholesale/deactivate");
    expect(await screen.findByRole("heading", { name: "Confirm wholesale deactivation" })).toBeInTheDocument();
    expect(screen.getByText("Remains active")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Turn off Wholesale" }));
    expect(await screen.findByRole("heading", { name: "Wholesale channel turned off" })).toBeInTheDocument();
  });

  it("blocked: the counts from the server, no turn-off button, a way to the open orders", async () => {
    current = ch("active", "active");
    fb.handlers["GET /selling-channels/wholesale/deactivation-check"] = () => [200, { channel: "wholesale", status: "active", blockers: { activeOrders: 3, unsettledPayments: 2, openDisputes: 1 }, lastChannel: false, canDeactivate: false }];
    renderApp("/settings/channels/wholesale/deactivate");
    expect(await screen.findByRole("heading", { name: "Channel deactivation is blocked" })).toBeInTheDocument();
    const list = screen.getByRole("heading", { name: "Items that must be resolved" }).closest("section")!;
    expect(within(list).getByText("3 open orders still need to be completed or cancelled.")).toBeInTheDocument();
    expect(within(list).getByText("2 payments are still awaiting settlement.")).toBeInTheDocument();
    expect(within(list).getByText("1 dispute needs a final resolution.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /turn off/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View outstanding activity" })).toHaveAttribute("href", "/store/orders");
  });

  it("the only channel on can't be turned off", async () => {
    fb.handlers["GET /selling-channels/retail/deactivation-check"] = () => [200, { channel: "retail", status: "active", blockers: CLEAR, lastChannel: true, canDeactivate: false }];
    renderApp("/settings/channels/retail/deactivate");
    expect(await screen.findByText(/Keep at least one selling channel on/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /turn off/i })).not.toBeInTheDocument();
  });

  it("a refused change shows the server's plain reason, never technical text", async () => {
    current = ch("active", "active");
    fb.handlers["GET /selling-channels/wholesale/deactivation-check"] = () => [200, { channel: "wholesale", status: "active", blockers: CLEAR, lastChannel: false, canDeactivate: true }];
    fb.handlers["POST /selling-channels/wholesale/deactivate"] = () => [409, { code: "changed", message: "Your selling channels changed while you were doing this. Reload and try again." }];
    const user = userEvent.setup();
    renderApp("/settings/channels/wholesale/deactivate");
    await user.click(await screen.findByRole("button", { name: "Turn off Wholesale" }));
    expect(await screen.findByText(/Reload and try again/)).toBeInTheDocument();
  });

  it("team members see the channels but can't change them", async () => {
    fb.handlers["GET /selling-channels"] = () => [200, { channels: ch("active", "active"), isOwner: false }];
    renderApp("/settings/channels");
    expect(await screen.findByText("Only the business owner can change selling channels.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /turn off|activate/i })).not.toBeInTheDocument();
  });
});
