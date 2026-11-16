import { describe, expect, it } from "vitest";
import { initMonitoring, reportError, scrubBreadcrumb, scrubEvent, stripQuery } from "./sentry";

describe("error tracking privacy", () => {
  it("scrubs request data, user details, emails, phones and tokens from events", () => {
    const ev = scrubEvent({
      message: "Order for ada@example.com (08031234567) failed",
      request: { url: "https://app/verify?email=ada@example.com&token=abc", headers: { Authorization: "Bearer x.y.z" }, cookies: "s=1", data: { password: "x" } },
      user: { id: "u1", email: "ada@example.com", ip_address: "1.2.3.4" },
      exception: { values: [{ value: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InUxIn0.abc in +234 803 123 4567" }] },
      extra: { note: "call 08031234567 or ada@example.com" },
      breadcrumbs: [
        { category: "ui.input", message: "typed password" },
        { category: "fetch", data: { url: "https://api/x?email=ada@example.com", status_code: 500 } },
        { category: "navigation", data: { from: "/reset?token=abc", to: "/login?email=ada@example.com" } },
      ],
    });
    const s = JSON.stringify(ev);
    for (const leak of ["ada@example.com", "08031234567", "803 123 4567", "token=abc", "Bearer", "eyJhbGci", "password", "1.2.3.4", "s=1"]) expect(s, leak).not.toContain(leak);
    expect(ev.user).toEqual({ id: "u1" });
    expect(ev.request).toEqual({ url: "https://app/verify" });
    expect((ev.breadcrumbs as unknown[]).length).toBe(2);
  });

  it("breadcrumb URLs lose their query strings", () => {
    expect(stripQuery("https://x/y?code=1#z")).toBe("https://x/y");
    expect(scrubBreadcrumb({ category: "xhr", data: { url: "/api/auth/google/exchange?code=secret" } }).data).toEqual({ url: "/api/auth/google/exchange" });
  });

  it("is off without VITE_SENTRY_DSN (and in tests), and reporting is then a no-op", async () => {
    expect(await initMonitoring({ MODE: "production" })).toBe(false);
    expect(await initMonitoring({ MODE: "test", VITE_SENTRY_DSN: "https://k@o1.ingest.sentry.io/1" })).toBe(false);
    expect(() => reportError(new Error("x"))).not.toThrow();
  });
});
