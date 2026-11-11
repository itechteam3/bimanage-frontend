import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildThemeCss } from "../../scripts/build-tokens.mjs";
import { featureAccess, PLAN_FEATURES } from "./plans";

const root = resolve(__dirname, "../..");

describe("design tokens", () => {
  it("theme.css is up to date with docs/figma/design-tokens.json (run `npm run tokens`)", () => {
    const tokens = JSON.parse(readFileSync(resolve(root, "docs/figma/design-tokens.json"), "utf8"));
    const css = readFileSync(resolve(root, "src/styles/theme.css"), "utf8");
    expect(css.replace(/\r\n/g, "\n")).toBe(buildThemeCss(tokens));
  });

  it("switches off Tailwind's default palette so only tokens exist", () => {
    const css = readFileSync(resolve(root, "src/styles/theme.css"), "utf8");
    for (const ns of ["--color-*", "--text-*", "--radius-*", "--shadow-*"]) expect(css).toContain(`${ns}: initial;`);
  });
});

describe("plan gating config", () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  it("follows the backend: BiSupplyNet is Premium-only (open question)", () => {
    expect(PLAN_FEATURES.standard.bisupplynet).toBe(false);
    expect(PLAN_FEATURES.premium.bisupplynet).toBe(true);
  });
  it("freemium store is view-only", () => {
    expect(featureAccess({ plan: "freemium" }, "store")).toBe("view_only");
    expect(featureAccess({ plan: "freemium" }, "inventory")).toBe(false);
  });
  it("an active trial or startup package unlocks everything", () => {
    expect(featureAccess({ plan: "freemium", isTrialActive: true, trialEndDate: future }, "bisupplynet")).toBe(true);
    expect(featureAccess({ plan: "freemium", startupPackage: "starter", startupPackageEndDate: future }, "invoices")).toBe(true);
  });
  it("an expired trial falls back to the plan", () => {
    expect(featureAccess({ plan: "freemium", isTrialActive: true, trialEndDate: "2020-01-01" }, "invoices")).toBe(false);
  });
});
