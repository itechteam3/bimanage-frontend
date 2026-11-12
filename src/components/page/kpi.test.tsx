import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { KpiCard, SPARK, sparklinePoints } from "./Blocks";

// Regression guard for the dashboard revenue tile: the micro trend used to be
// absolutely positioned over the value and caption (and its end dot was
// clipped). jsdom can't lay out, so these pin down the structure and geometry
// that make it behave; scripts in the PR notes checked real widths.

describe("KPI micro trend", () => {
  it("sits in the value's row, never absolutely positioned over the text", () => {
    const { container } = render(<KpiCard tone="revenue" label="Revenue" value="₦10k" caption="Completed orders" trend={[0, 1500, 0, 2500, 1000, 0, 5000]} />);
    const svg = container.querySelector("svg[data-sparkline]")!;
    expect(svg).toBeTruthy();
    expect(svg.getAttribute("class")).not.toMatch(/\babsolute\b/);
    expect(svg.parentElement!.hasAttribute("data-kpi-row")).toBe(true);
    expect(svg.parentElement!.textContent).toContain("₦10k");
    expect(svg.parentElement!.textContent).not.toContain("Completed orders");
    // Row may wrap so a long value never collides with the trend.
    expect(svg.parentElement!.className).toMatch(/\bflex-wrap\b/);
    expect(svg.getAttribute("class")).toMatch(/\bshrink-0\b/);
  });

  it("uses the Figma sizes as tokens: 56x29 on phones, 74x38 from lg", () => {
    const { container } = render(<KpiCard tone="revenue" label="Revenue" value="₦10k" caption="x" trend={[1, 2]} />);
    const cls = container.querySelector("svg[data-sparkline]")!.getAttribute("class")!;
    expect(cls).toMatch(/\bw-kpi-trend-w-mobile\b/);
    expect(cls).toMatch(/\bh-kpi-trend-h-mobile\b/);
    expect(cls).toMatch(/\blg:w-kpi-trend-w\b/);
    expect(cls).toMatch(/\blg:h-kpi-trend-h\b/);
    const theme = readFileSync("src/styles/theme.css", "utf8");
    expect(theme).toMatch(/--spacing-kpi-trend-w-mobile: 56px/);
    expect(theme).toMatch(/--spacing-kpi-trend-h-mobile: 29px/);
    expect(theme).toMatch(/--spacing-kpi-trend-w: 74px/);
    expect(theme).toMatch(/--spacing-kpi-trend-h: 38px/);
  });

  it("keeps every point, line cap and the end dot inside the box (nothing clipped)", () => {
    const dot = 2.6 + 1.2; // radius + ring
    for (const values of [[0, 0, 0, 5000], [5000, 0], [1, 2, 3, 4, 5, 6, 7], [0, 0], [10000]]) {
      for (const [x, y] of sparklinePoints(values)) {
        expect(x - dot).toBeGreaterThanOrEqual(0);
        expect(x + dot).toBeLessThanOrEqual(SPARK.w);
        expect(y - dot).toBeGreaterThanOrEqual(0);
        expect(y + dot).toBeLessThanOrEqual(SPARK.h);
      }
    }
  });

  it("no trend, no chart (other tiles stay plain)", () => {
    const { container } = render(<KpiCard tone="orders" label="Orders" value="64" caption="All" />);
    expect(container.querySelector("svg")).toBeNull();
  });
});
