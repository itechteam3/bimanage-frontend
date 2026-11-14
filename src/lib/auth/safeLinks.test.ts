import { describe, expect, it } from "vitest";
import { safeNext } from "./pending";
import { safeLink } from "@/lib/notifications/api";

// In-app links only (2026-11-14). React Router 6 can treat "/\host" as another
// site (its fix is in v7), so our own checks refuse backslashes too.

describe("safe in-app links", () => {
  it("keeps normal in-app paths", () => {
    expect(safeNext("/orders/o1?tab=items")).toBe("/orders/o1?tab=items");
    expect(safeLink("/support/tickets/t1")).toBe("/support/tickets/t1");
  });

  it("refuses other sites, protocol-relative and backslash tricks", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "/\\/evil.com", "\\\\evil.com", "javascript:alert(1)", "evil.com"]) {
      expect(safeNext(bad)).toBe("/dashboard");
      expect(safeLink(bad)).toBeNull();
    }
  });
});
