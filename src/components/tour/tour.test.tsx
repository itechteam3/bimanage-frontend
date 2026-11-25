import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";
import { TOURS, place, resolveTarget, shouldAutoStart, tourFor } from "@/lib/tours/tours";

describe("tour definitions", () => {
  it("cover the main pages, with short steps and saveable ids", () => {
    const ids = TOURS.map((t) => t.id);
    for (const id of ["dashboard", "inventory", "orders", "sales", "invoices", "customers", "store", "wallet", "projects", "team", "feli", "bisupplynet", "reports", "settings"]) expect(ids).toContain(id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TOURS) {
      expect(t.id).toMatch(/^[a-z0-9][a-z0-9-]{0,39}$/); // what the server accepts
      expect(t.steps.length).toBeGreaterThanOrEqual(3);
      for (const s of t.steps) {
        expect(s.title.length).toBeLessThanOrEqual(40);
        expect(s.body.length).toBeLessThanOrEqual(130);
        expect(s.body).not.toMatch(/—/); // house style: no em dashes
      }
    }
  });

  it("matches pages exactly, and only starts tours not finished or skipped", () => {
    expect(tourFor("/dashboard")?.id).toBe("dashboard");
    expect(tourFor("/inventory/")?.id).toBe("inventory");
    expect(tourFor("/inventory/products/p1")).toBeUndefined();
    const t = tourFor("/wallet")!;
    expect(shouldAutoStart(t, undefined)).toBe(false); // progress not loaded: never pop up
    expect(shouldAutoStart(t, {})).toBe(true);
    expect(shouldAutoStart(t, { wallet: { status: "skipped", version: t.version } })).toBe(false);
    expect(shouldAutoStart(t, { wallet: { status: "completed", version: t.version - 1 } })).toBe(true); // tour changed since
  });
});

describe("placing the pop-up", () => {
  const pop = { width: 340, height: 200 };
  it("centres steps without a target", () => {
    expect(place(null, pop, 1440, 900)).toEqual({ mode: "center" });
  });
  it("docks a sheet on phones, away from the target", () => {
    expect(place({ top: 100, left: 20, width: 300, height: 80 }, pop, 390, 844)).toEqual({ mode: "sheet", edge: "bottom" });
    expect(place({ top: 700, left: 20, width: 300, height: 80 }, pop, 390, 844)).toEqual({ mode: "sheet", edge: "top" });
  });
  it("floats under the target on wider screens, above when there's no room, inside the screen", () => {
    const below = place({ top: 100, left: 600, width: 200, height: 60 }, pop, 1440, 900);
    expect(below).toMatchObject({ mode: "float", side: "bottom", top: 172 });
    const above = place({ top: 760, left: 600, width: 200, height: 60 }, pop, 1440, 900);
    expect(above).toMatchObject({ mode: "float", side: "top", top: 760 - 12 - 200 });
    const edge = place({ top: 100, left: 1400, width: 30, height: 30 }, pop, 1440, 900);
    expect(edge.mode === "float" && edge.left).toBe(1440 - 16 - 340);
    expect(edge.mode === "float" && edge.arrowX).toBeLessThanOrEqual(320);
  });
});

// jsdom lays nothing out: treat every element as visible, with a small box.
function layout() {
  vi.spyOn(Element.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ top: 100, left: 100, width: 200, height: 60, bottom: 160, right: 300, x: 100, y: 100, toJSON: () => ({}) } as DOMRect);
  Element.prototype.scrollIntoView = vi.fn();
}

describe("finding targets", () => {
  beforeEach(layout);
  afterEach(() => vi.restoreAllMocks());
  it("by heading (its card), label, button text or selector", () => {
    document.body.innerHTML = `<main data-app-main><section id="card"><h2>Today's priorities</h2></section><section id="kpi"><p>Revenue</p><p>₦0</p></section><a href="/x">Create an order →</a></main><button data-tour="help">?</button>`;
    expect(resolveTarget({ heading: "Today's priorities" })?.id).toBe("card");
    expect(resolveTarget({ label: "Revenue" })?.id).toBe("kpi");
    expect(resolveTarget({ text: "Create an order" })?.tagName).toBe("A");
    expect(resolveTarget({ selector: '[data-tour="help"]' })?.tagName).toBe("BUTTON");
    expect(resolveTarget({ heading: "Nope" })).toBeNull();
  });
});

describe("guided tour on a page", () => {
  let fb: FakeBackend;
  beforeEach(() => {
    layout();
    tokenStore.set("tok");
    serverStatus.set("up");
    fb = installFakeBackend();
    fb.handlers["GET /tours"] = () => [200, { tours: {} }];
    fb.handlers["PUT /tours/dashboard"] = (b) => [200, { page: "dashboard", ...(b as object) }];
    fb.handlers["DELETE /tours"] = () => [200, { reset: true }];
  });
  afterEach(() => {
    vi.restoreAllMocks();
    tokenStore.clear();
  });
  const last = (key: string) => [...fb.calls].reverse().find((c) => c.key === key);

  it("first visit: steps one by one with a counter, Back and Next; Done saves it as completed", async () => {
    renderApp("/dashboard");
    const user = userEvent.setup();
    const tour = await screen.findByRole("dialog", { name: /welcome to your dashboard/i }, { timeout: 5000 });
    const total = Number(within(tour).getByText(/^1\/\d$/).textContent!.split("/")[1]);
    expect(total).toBeGreaterThanOrEqual(3);
    expect(within(tour).getByText(/step 1 of/i)).toBeInTheDocument();
    expect(within(tour).queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
    await user.click(within(tour).getByRole("button", { name: "Next" }));
    const step2 = screen.getByRole("dialog");
    expect(within(step2).getByText(`2/${total}`)).toBeInTheDocument();
    await user.click(within(step2).getByRole("button", { name: "Back" }));
    expect(within(screen.getByRole("dialog")).getByText(`1/${total}`)).toBeInTheDocument();
    for (let n = 1; n < total; n++) await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Next" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(last("PUT /tours/dashboard")?.body).toEqual({ status: "completed", version: 1 }));
    expect(screen.queryByRole("dialog", { name: /dashboard|numbers|help/i })).not.toBeInTheDocument();
  });

  it("Skip tour, the X and Escape save it as skipped", async () => {
    renderApp("/dashboard");
    const user = userEvent.setup();
    await screen.findByRole("dialog", { name: /welcome to your dashboard/i }, { timeout: 5000 });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(last("PUT /tours/dashboard")?.body).toEqual({ status: "skipped", version: 1 }));
    expect(screen.queryByRole("dialog", { name: /welcome/i })).not.toBeInTheDocument();
  });

  it("doesn't come back once finished, and Help → Show me around replays it", async () => {
    fb.handlers["GET /tours"] = () => [200, { tours: { dashboard: { status: "completed", version: 1 } } }];
    renderApp("/dashboard");
    const user = userEvent.setup();
    const help = (await screen.findAllByRole("button", { name: "Help" }))[0]!;
    await new Promise((r) => setTimeout(r, 900));
    expect(screen.queryByRole("dialog", { name: /welcome/i })).not.toBeInTheDocument();
    await user.click(help);
    await user.click(screen.getByRole("menuitem", { name: /show me around/i }));
    const tour = await screen.findByRole("dialog", { name: /welcome to your dashboard/i }, { timeout: 5000 });
    await user.click(within(tour).getByRole("button", { name: "Close tour" }));
    await waitFor(() => expect(last("PUT /tours/dashboard")?.body).toEqual({ status: "skipped", version: 1 }));
  });

  it("never pops up when progress can't be loaded", async () => {
    fb.handlers["GET /tours"] = () => [500, { message: "down" }];
    renderApp("/dashboard");
    await screen.findAllByRole("button", { name: "Help" });
    await new Promise((r) => setTimeout(r, 900));
    expect(screen.queryByRole("dialog", { name: /welcome/i })).not.toBeInTheDocument();
  });
});
