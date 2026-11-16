import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeliAvatar } from "./FeliAvatar";

describe("FeliAvatar", () => {
  it("is an image named FELI by default", () => {
    render(<FeliAvatar />);
    expect(screen.getByRole("img", { name: "FELI" })).toHaveClass("size-10");
  });

  it("is hidden from screen readers when decorative (a visible FELI label is next to it)", () => {
    const { container } = render(<FeliAvatar size="sm" decorative />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveClass("size-8");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("gives each copy its own gradient ids, so several on one page don't clash", () => {
    const { container } = render(
      <>
        <FeliAvatar />
        <FeliAvatar />
      </>
    );
    const ids = [...container.querySelectorAll("[id]")].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("FELI screens use the avatar, not a generic sparkles/chatbot icon", () => {
    for (const f of ["src/pages/feli/FeliPages.tsx", "src/pages/feli/FeliReviewPage.tsx", "src/pages/landing/FeliGuestChat.tsx", "src/components/layout/AuthLayout.tsx"]) {
      const src = readFileSync(f, "utf8");
      expect(src, f).toContain("<FeliAvatar");
      expect(src, f).not.toMatch(/IconSparkles|IconMessageChatbot/);
    }
    // sanity: the component is the only place the drawing lives
    const files: string[] = [];
    const walk = (d: string) => readdirSync(d).forEach((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : /\.tsx$/.test(n) && !/\.test\./.test(n) && files.push(join(d, n))));
    walk("src");
    expect(files.filter((f) => readFileSync(f, "utf8").includes("feli-bg-"))).toEqual([join("src", "components", "feli", "FeliAvatar.tsx")]);
  });
});
