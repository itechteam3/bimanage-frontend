import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { CountUp, Dialog, ListSkeleton } from "@/components/ui";
import { count, nairaCompact } from "@/lib/format";
import { MOTION, motionAllowed, prefersReducedMotion, setMotionForTests, usePresenceList } from "./motion";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { EMPTY_DASHBOARD, installFakeBackend, renderApp } from "@/test/fakeBackend";

const html = document.documentElement;
afterEach(() => {
  setMotionForTests(null);
  html.classList.remove("reduce-motion");
  vi.useRealTimers();
});

describe("motion tokens: one shared set", () => {
  const theme = readFileSync("src/styles/theme.css", "utf8");
  it("theme.css has the duration, easing and distance tokens, equal to the JS mirror", () => {
    expect(theme).toContain(`--motion-fast: ${MOTION.fast}ms;`);
    expect(theme).toContain(`--motion-base: ${MOTION.base}ms;`);
    expect(theme).toContain(`--motion-slow: ${MOTION.slow}ms;`);
    expect(theme).toContain(`--motion-count: ${MOTION.count}ms;`);
    expect(theme).toContain(`--motion-stagger: ${MOTION.stagger}ms;`);
    expect(theme).toContain(`--motion-distance: ${MOTION.distance}px;`);
    expect(theme).toContain(`--ease-out: ${MOTION.easeOut};`);
    expect(theme).toContain(`--ease-in: ${MOTION.easeIn};`);
  });

  it("motion.css uses only the tokens, animates only transform/opacity, and only when motion is welcome", () => {
    const css = readFileSync("src/styles/motion.css", "utf8");
    // No hard-coded durations or easing curves outside the shimmer loop.
    const timings = css.match(/\b\d+(\.\d+)?m?s\b/g) ?? [];
    expect(timings).toEqual(["1.4s"]);
    expect(css).not.toMatch(/cubic-bezier/);
    // Keyframes touch nothing but transform and opacity.
    const keyframes = css.match(/@keyframes[^{]+\{([^@]*?)\n\}/g) ?? [];
    expect(keyframes.length).toBeGreaterThan(5);
    for (const k of keyframes) {
      const props = [...k.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      for (const p of props) expect(["opacity", "transform"]).toContain(p);
    }
    // Every animation/transform rule sits inside the no-preference block and
    // is scoped to html:not(.reduce-motion).
    const gated = css.slice(css.indexOf("@media (prefers-reduced-motion: no-preference)"));
    const before = css.slice(0, css.indexOf("@media (prefers-reduced-motion: no-preference)"));
    expect(before.replace(/@keyframes[\s\S]*?\n\}/g, "")).not.toMatch(/animation:|transform:|transition:\s*transform/);
    const selectors = [...gated.matchAll(/^\s*([^\s@{}][^{}\n]*)\{/gm)].map((m) => m[1]!.trim()).filter((s) => !/^(from|to|\d)/.test(s));
    expect(selectors.length).toBeGreaterThan(10);
    for (const sel of selectors) for (const part of sel.split(",")) expect(part.trim()).toMatch(/^html:not\(\.reduce-motion\)/);
  });
});

describe("reduced motion", () => {
  it("honours the workspace Reduce motion setting (html.reduce-motion)", () => {
    expect(prefersReducedMotion()).toBe(false);
    html.classList.add("reduce-motion");
    expect(prefersReducedMotion()).toBe(true);
    setMotionForTests(true);
    expect(motionAllowed()).toBe(false);
  });

  it("honours the OS prefers-reduced-motion setting", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), addEventListener() {}, removeEventListener() {} }));
    setMotionForTests(true);
    expect(prefersReducedMotion()).toBe(true);
    expect(motionAllowed()).toBe(false);
    vi.unstubAllGlobals();
  });

  it("is off in tests unless a test switches it on", () => {
    expect(motionAllowed()).toBe(false);
    setMotionForTests(true);
    expect(motionAllowed()).toBe(true);
  });
});

describe("CountUp", () => {
  it("shows the final value at once in tests (and with motion off)", () => {
    render(<p data-testid="v"><CountUp value={1234} format={count} /></p>);
    expect(screen.getByTestId("v")).toHaveTextContent(/^1,234$/);
    expect(screen.getByTestId("v").querySelector("[aria-hidden]")).toBeNull();
  });

  it("shows the final value at once with Reduce motion on", () => {
    setMotionForTests(true);
    html.classList.add("reduce-motion");
    render(<p data-testid="v"><CountUp value={250000} format={nairaCompact} /></p>);
    expect(screen.getByTestId("v").textContent).toBe("₦250k");
  });

  it("while counting, screen readers only get the real value", () => {
    setMotionForTests(true);
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    render(<p data-testid="v"><CountUp value={64} format={count} /></p>);
    const p = screen.getByTestId("v");
    const moving = p.querySelector("[data-counting]")!;
    expect(moving.closest('[aria-hidden="true"]')).toBeTruthy();
    expect(moving.textContent).toBe("0");
    // The only text not hidden from assistive tech is the real value.
    const exposed = [...p.querySelectorAll("span")].filter((s) => !s.closest('[aria-hidden="true"]'));
    expect(exposed.map((s) => s.textContent)).toEqual(["64"]);
    expect(exposed[0]).toHaveClass("sr-only");
    raf.mockRestore();
  });

  it("lands exactly on the final value", async () => {
    setMotionForTests(true);
    render(<p data-testid="v"><CountUp value={1234} format={count} /></p>);
    await vi.waitFor(() => expect(screen.getByTestId("v").textContent).toBe("1,234"), { timeout: 3000 });
    expect(screen.getByTestId("v").querySelector("[data-counting]")).toBeNull();
  });
});

describe("rows leaving", () => {
  const key = (s: string) => s;
  it("removes a deleted row at once when motion is off", () => {
    const { result, rerender } = renderHook(({ items }) => usePresenceList(items, key), { initialProps: { items: ["a", "b", "c"] } });
    rerender({ items: ["a", "c"] });
    expect(result.current.map((r) => r.key)).toEqual(["a", "c"]);
  });

  it("keeps a deleted row in place, marked leaving, until it has faded out", () => {
    setMotionForTests(true);
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ items }) => usePresenceList(items, key), { initialProps: { items: ["a", "b", "c"] } });
    rerender({ items: ["a", "c"] });
    expect(result.current.map((r) => `${r.key}${r.leaving ? "-" : ""}`)).toEqual(["a", "b-", "c"]);
    act(() => void vi.advanceTimersByTime(MOTION.base));
    expect(result.current.map((r) => r.key)).toEqual(["a", "c"]);
  });
});

describe("Dialog", () => {
  it("plays its exit before closing when motion is on", () => {
    setMotionForTests(true);
    vi.useFakeTimers();
    const { rerender } = render(<Dialog open title="Delete product?" onClose={() => undefined} />);
    const dialog = document.querySelector("dialog")!;
    expect(dialog.open).toBe(true);
    rerender(<Dialog open={false} title="Delete product?" onClose={() => undefined} />);
    expect(dialog).toHaveAttribute("data-closing");
    expect(dialog.open).toBe(true);
    act(() => void vi.advanceTimersByTime(MOTION.fast));
    expect(dialog.open).toBe(false);
    expect(dialog).not.toHaveAttribute("data-closing");
  });

  it("closes at once when motion is off", () => {
    const { rerender } = render(<Dialog open title="Delete product?" onClose={() => undefined} />);
    rerender(<Dialog open={false} title="Delete product?" onClose={() => undefined} />);
    expect(document.querySelector("dialog")!.open).toBe(false);
  });
});

describe("skeletons and the sidebar indicator", () => {
  beforeEach(() => {
    tokenStore.set("tok");
    serverStatus.set("up");
  });

  it("ListSkeleton is one labelled status with resting blocks", () => {
    render(<ListSkeleton label="Loading orders…" rows={3} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading orders…");
    expect(status.querySelectorAll("[data-skeleton]").length).toBeGreaterThanOrEqual(9);
  });

  it("the dashboard shows a skeleton while loading, then counts its KPIs to the real values", async () => {
    const fb = installFakeBackend();
    let release!: () => void;
    const ready = new Promise<void>((r) => (release = r));
    fb.handlers["GET /dashboard"] = async () => {
      await ready;
      return [200, { ...EMPTY_DASHBOARD, kpis: { revenue: 250000, orders: 1234, averageOrder: 203, unitsSold: 1300 } }];
    };
    renderApp("/dashboard");
    const loading = await screen.findByText("Loading dashboard…");
    expect(loading.closest('[role="status"]')!.querySelectorAll("[data-skeleton]").length).toBeGreaterThan(4);
    release();
    expect(await screen.findByText("1,234")).toBeInTheDocument();
    expect(screen.getByText("₦250k")).toBeInTheDocument();
    expect(screen.queryByText("Loading dashboard…")).toBeNull();
  });

  it("the sidebar has one active-item indicator, placed on the current page", async () => {
    installFakeBackend();
    renderApp("/dashboard");
    await screen.findByRole("heading", { level: 1, name: /dashboard$/i });
    const nav = screen.getAllByRole("navigation", { name: "Main" })[0]!;
    const indicators = nav.querySelectorAll("[data-nav-indicator]");
    expect(indicators).toHaveLength(1);
    expect(indicators[0]).toHaveAttribute("data-placed");
    expect(indicators[0]).toHaveAttribute("aria-hidden", "true");
    expect(within(nav).getByRole("link", { name: /dashboard/i })).toHaveAttribute("aria-current", "page");
  });
});
