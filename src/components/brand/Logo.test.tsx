import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logo } from "./Logo";

// The logo must keep its own proportions everywhere (Figma image fill: FIT).
const classes = (el: HTMLElement) => el.className.split(/\s+/);
const fixedW = (c: string[]) => c.some((x) => /^w-(?!auto$)/.test(x));
const fixedH = (c: string[]) => c.some((x) => /^h-(?!auto$)/.test(x));

describe("Logo", () => {
  it.each([
    [{ size: "panel" as const }, "w-40", "h-auto"],
    [{ size: "rail" as const }, "w-44.5", "h-auto"],
    [{ size: "sidebar" as const }, "h-8.5", "w-auto"],
    [{ compact: true }, "h-13", "w-auto"],
    [{}, "h-8.5", "w-auto"],
  ])("%o sets one dimension only (%s, %s) and never distorts", (props, set, auto) => {
    render(<Logo tone="on-brand" {...props} />);
    const c = classes(screen.getByRole("img", { name: "BiManage" }));
    expect(c).toContain(set);
    expect(c).toContain(auto);
    expect(fixedW(c) && fixedH(c)).toBe(false);
    expect(c).toContain("object-contain");
    expect(c).toContain("max-w-full");
  });

  it("wordmarks don't stretch in a flex column; the header mark keeps the row's centring", () => {
    const { unmount } = render(<Logo size="panel" />);
    expect(classes(screen.getByRole("img"))).toContain("self-start");
    unmount();
    render(<Logo compact />);
    expect(classes(screen.getByRole("img"))).not.toContain("self-start");
  });

  it("no screen sizes the logo itself (sizes live in Logo.tsx)", () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx$/.test(f) && !/\.test\./.test(f)) files.push(p);
      }
    };
    walk("src");
    for (const f of files) {
      for (const m of readFileSync(f, "utf8").matchAll(/<Logo\b[^>]*>/g)) {
        expect(`${f}: ${m[0]}`).not.toMatch(/className=/);
      }
    }
  });
});
