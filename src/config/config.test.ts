import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
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
  it("follows the backend: Standard can buy on BiSupplyNet, only Premium can sell", () => {
    expect(PLAN_FEATURES.freemium.bisupplynet ?? false).toBe(false);
    expect(PLAN_FEATURES.standard.bisupplynet).toBe(true);
    expect(PLAN_FEATURES.standard.bisupplynetSell).toBe(false);
    expect(PLAN_FEATURES.premium.bisupplynet).toBe(true);
    expect(PLAN_FEATURES.premium.bisupplynetSell).toBe(true);
    expect(featureAccess({ plan: "freemium", startupPackage: "starter", startupPackageEndDate: future }, "bisupplynet")).toBe(false);
  });
  it("freemium store is view-only", () => {
    expect(featureAccess({ plan: "freemium" }, "store")).toBe("view_only");
    expect(featureAccess({ plan: "freemium" }, "inventory")).toBe(true); // with daily credits (Figma 07.06, backend #32)
    expect(featureAccess({ plan: "freemium" }, "invoices")).toBe(false);
  });
  it("an active trial unlocks everything; a startup package only its own set", () => {
    expect(featureAccess({ plan: "freemium", isTrialActive: true, trialEndDate: future }, "bisupplynet")).toBe(true);
    expect(featureAccess({ plan: "freemium", startupPackage: "starter", startupPackageEndDate: future }, "inventory")).toBe(true);
    expect(featureAccess({ plan: "freemium", startupPackage: "starter", startupPackageEndDate: future }, "invoices")).toBe(false);
    expect(featureAccess({ plan: "freemium", startupPackage: "standard", startupPackageEndDate: future }, "bisupplynet")).toBe(true);
  });
  it("an expired trial falls back to the plan", () => {
    expect(featureAccess({ plan: "freemium", isTrialActive: true, trialEndDate: "2020-01-01" }, "invoices")).toBe(false);
  });
});

describe("breakpoints", () => {
  // Tailwind's default sm/xl/2xl are switched off (tokens define md, lg, desktop);
  // an undefined prefix silently does nothing, so catch it here.
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : /\.(tsx|ts)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
    });
  it("only uses breakpoints that exist (md, lg, desktop)", () => {
    const offenders = files(resolve(root, "src")).flatMap((f) =>
      [...readFileSync(f, "utf8").matchAll(/["'`\s](sm|xl|2xl):[a-z]/g)].map((m) => `${f}: ${m[0].trim()}`)
    );
    expect(offenders).toEqual([]);
  });
});
