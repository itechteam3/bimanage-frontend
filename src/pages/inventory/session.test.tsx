import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";

let fb: FakeBackend;
beforeEach(() => {
  tokenStore.set("tok");
  serverStatus.set("up");
  fb = installFakeBackend();
  fb.handlers["GET /subscriptions/current"] = () => [200, { plan: "standard", status: "active", features: { inventory: true } }];
});
afterEach(() => {
  vi.unstubAllGlobals();
  tokenStore.clear();
});

it("a 401 mid-session returns to sign-in with the reason", async () => {
  fb.handlers["GET /inventory/products/p1"] = () => [401, { message: "Not authorized, invalid token" }];
  fb.handlers["GET /inventory/products/p1/adjustments"] = () => [401, { message: "Not authorized, invalid token" }];
  const router = renderApp("/inventory/products/p1");
  await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  expect(await screen.findByText(/session/i)).toBeInTheDocument();
});

it("signing out in another tab signs this tab out too", async () => {
  fb.handlers["GET /inventory/products"] = () => [200, []];
  fb.handlers["GET /inventory/stats"] = () => [200, { totalProducts: 0, totalStock: 0, totalInventoryValue: 0, totalSales: 0, stockAvailability: { available: 0, lowStock: 0, outOfStock: 0 }, lowStockProducts: [], topSelling: [] }];
  const router = renderApp("/dashboard");
  await screen.findAllByText("Samuel Adebayo");
  window.localStorage.removeItem("bimanage.session"); // the other tab's sign-out
  window.dispatchEvent(new StorageEvent("storage", { key: "bimanage.session", oldValue: "tok", newValue: null }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
});

it("a 401 after the token vanished (other tab) still ends the session", async () => {
  fb.handlers["GET /inventory/products/p1"] = (_b, headers) => [401, { message: headers.Authorization ? "Not authorized, invalid token" : "Not authorized, no token" }];
  fb.handlers["GET /inventory/products/p1/adjustments"] = () => [401, { message: "Not authorized, no token" }];
  const router = renderApp("/dashboard");
  await screen.findAllByText("Samuel Adebayo");
  window.localStorage.removeItem("bimanage.session"); // no storage event delivered
  await router.navigate("/inventory/products/p1");
  await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
});
