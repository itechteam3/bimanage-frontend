import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";
import { resolveBack, back, SCREENS } from "@/lib/nav/backNav";
import { record, resetHistory, hasInAppHistory, previousPath } from "@/lib/nav/history";
import type { UIMatch } from "react-router-dom";

// Back navigation on every screen: "Back" (exact previous view) and
// "Back to [Screen]" (the screen's start view), at phone and desktop widths.

const ORDER = {
  _id: "o1",
  trackingNo: "ORD-7K2Q9M",
  items: [{ product: "p1", name: "Linen shirt", quantity: 2, unitPrice: 25000, total: 50000 }],
  customer: { name: "Amina Yusuf" },
  paymentMethod: "transfer",
  paymentStatus: "pending",
  fulfilmentStatus: "unfulfilled",
  status: "pending",
  canCancel: true,
  subtotal: 50000,
  deliveryFee: 0,
  totalAmount: 50000,
  createdAt: "2026-11-12T09:00:00Z",
};

let fb: FakeBackend;
beforeEach(() => {
  tokenStore.set("tok");
  serverStatus.set("up");
  fb = installFakeBackend();
  fb.handlers["GET /subscriptions/current"] = () => [200, { plan: "standard", status: "active", features: { orders: true, invoices: true, analytics: true, inventory: true } }];
  fb.handlers["GET /inventory/products"] = () => [200, []];
  fb.handlers["GET /orders"] = () => [200, [ORDER]];
  fb.handlers["GET /orders/stats"] = () => [200, { all: 1, awaitingPayment: 1, unfulfilled: 1, completed: 0, cancelled: 0, revenue: 0 }];
  fb.handlers["GET /orders/o1"] = () => [200, ORDER];
});
afterEach(() => {
  vi.restoreAllMocks();
  tokenStore.clear();
});

const setWidth = (w: number) => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: w });
  window.dispatchEvent(new Event("resize"));
};
const path = (r: ReturnType<typeof renderApp>) => r.state.location.pathname + r.state.location.search;

describe.each([
  ["phone", 390],
  ["desktop", 1440],
])("back navigation at %s width", (_label, width) => {
  beforeEach(() => setWidth(width));

  it("a screen's start view shows no Back", async () => {
    renderApp("/orders");
    await screen.findByRole("heading", { name: /orders & sales history/i });
    expect(screen.queryByTestId("back-button")).toBeNull();
    expect(screen.queryByTestId("header-back-button")).toBeNull();
    expect(screen.queryByTestId("back-to-screen")).toBeNull();
  });

  it("Back returns to the exact previous view, with its filter and search", async () => {
    const user = userEvent.setup();
    const router = renderApp("/orders");
    await user.click(await screen.findByRole("tab", { name: "Pending" }));
    await waitFor(() => expect(path(router)).toBe("/orders?status=awaiting_payment"));
    await user.click(await screen.findByRole("link", { name: "ORD-7K2Q9M" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/orders/o1"));

    // Desktop: "Back" in the content area. Phone: the arrow in the header.
    const backBtn = width < 1024 ? screen.getByTestId("header-back-button") : screen.getByTestId("back-button");
    await user.click(backBtn);
    await waitFor(() => expect(path(router)).toBe("/orders?status=awaiting_payment"));
    expect(await screen.findByRole("tab", { name: "Pending" })).toHaveAttribute("aria-selected", "true");
  });

  it("with no history (opened directly), Back goes up one level; Back to [Screen] goes to the start view", async () => {
    const user = userEvent.setup();
    const router = renderApp("/orders/o1/cancel");
    await screen.findByRole("heading", { name: /order cancellation/i });
    expect(screen.getByTestId("back-to-screen")).toHaveTextContent("Back to Orders");
    await user.click(screen.getByTestId(width < 1024 ? "header-back-button" : "back-button"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/orders/o1"));
    // One level below the start view: no "Back to Orders" here.
    expect(screen.queryByTestId("back-to-screen")).toBeNull();

    await act(() => router.navigate("/orders/o1/cancel"));
    await user.click(await screen.findByTestId("back-to-screen"));
    await waitFor(() => expect(path(router)).toBe("/orders"));
  });

  it("browser / phone Back works the same way", async () => {
    const user = userEvent.setup();
    const router = renderApp("/orders?q=amina");
    await user.click(await screen.findByRole("link", { name: "ORD-7K2Q9M" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/orders/o1"));
    await act(() => router.navigate(-1));
    await waitFor(() => expect(path(router)).toBe("/orders?q=amina"));
    expect(screen.getByPlaceholderText(/search order/i)).toHaveValue("amina");
  });

  it("unsaved changes ask 'Leave without saving?' — Keep editing stays, Leave goes", async () => {
    const user = userEvent.setup();
    const router = renderApp("/orders/o1/cancel");
    await user.type(await screen.findByPlaceholderText(/changed their mind/i), "Wrong size");
    await user.click(screen.getByTestId("back-to-screen"));
    expect(await screen.findByRole("heading", { name: "Leave without saving?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(router.state.location.pathname).toBe("/orders/o1/cancel");
    expect(screen.getByPlaceholderText(/changed their mind/i)).toHaveValue("Wrong size");

    await user.click(screen.getByTestId(width < 1024 ? "header-back-button" : "back-button"));
    await user.click(await screen.findByRole("button", { name: "Leave without saving" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/orders/o1"));
  });

  it("sign-in steps: Back from 'forgot password' returns to sign in", async () => {
    tokenStore.clear();
    const user = userEvent.setup();
    const router = renderApp("/forgot-password");
    await user.click(await screen.findByTestId(width < 1024 ? "header-back-button" : "back-button"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(screen.queryByTestId("back-button")).toBeNull();
  });
});

describe("back rules", () => {
  it("the controls are placed per width: Back in the content on desktop, in the header on phones", async () => {
    renderApp("/orders/o1/cancel");
    await screen.findByRole("heading", { name: /order cancellation/i });
    expect(screen.getByTestId("back-button").className).toMatch(/\bhidden\b.*\blg:inline-flex\b/);
    expect(screen.getByTestId("header-back-button").className).toMatch(/\blg:hidden\b/);
    // Accessible names for keyboard and screen-reader users.
    // Both are named "Back"; CSS shows one per width.
    expect(screen.getAllByRole("button", { name: "Back" })).toEqual(expect.arrayContaining([screen.getByTestId("header-back-button"), screen.getByTestId("back-button")]));
    expect(screen.getByRole("navigation", { name: "Page navigation" })).toBeInTheDocument();
  });

  it("every routed page below a start view declares where Back goes", async () => {
    const { routes } = await import("@/App");
    const all: Array<{ path?: string; handle?: { back?: unknown }; children?: unknown[] }> = [];
    const walk = (list: unknown[]) =>
      list.forEach((r) => {
        const route = r as { path?: string; handle?: { back?: unknown }; children?: unknown[] };
        all.push(route);
        if (route.children) walk(route.children);
      });
    walk(routes as unknown[]);
    const starts = new Set(["/", "/login", "/register", "/dashboard", "/onboarding", "/onboarding/trial", "/inventory", "/sales", "/orders", "/projects", "/settings/team", "/oauth/callback", "/invite/accept", "/reset-password/done", "/analytics", "*", "/ui-kit/*"]);
    const missing = all.filter((r) => r.path && !r.path.endsWith("/*") && !starts.has(r.path) && r.path.split("/").length > 2 && !r.handle?.back).map((r) => r.path);
    expect(missing).toEqual([]);
  });

  it("parent paths fill in route params; deep pages also get Back to [Screen]", () => {
    const m = (pattern: string, params: Record<string, string>) => [{ id: "x", pathname: "", params, data: null, handle: { back: back(pattern, SCREENS.orders) } }] as unknown as UIMatch[];
    expect(resolveBack(m("/orders/:id", { id: "o9" }))).toEqual({ parentTo: "/orders/o9", screen: SCREENS.orders, deep: true });
    expect(resolveBack(m("/orders", {}))?.deep).toBe(false);
  });

  it("history tracking: push, replace, back and an unknown entry after reload", () => {
    resetHistory();
    record("PUSH", { key: "a", path: "/orders?status=paid" });
    record("PUSH", { key: "b", path: "/orders/o1" });
    expect(hasInAppHistory()).toBe(true);
    expect(previousPath()).toBe("/orders?status=paid");
    record("REPLACE", { key: "c", path: "/orders/o1/cancelled" });
    expect(previousPath()).toBe("/orders?status=paid");
    record("POP", { key: "a", path: "/orders?status=paid" });
    expect(hasInAppHistory()).toBe(false);
    record("POP", { key: "zzz", path: "/dashboard" });
    expect(hasInAppHistory()).toBe(false);
  });
});
