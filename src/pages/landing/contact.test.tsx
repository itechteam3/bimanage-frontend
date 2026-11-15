import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { isIndexable } from "@/lib/seo/meta";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";
import { installFakeSockets } from "@/test/fakeSocket";

let fb: FakeBackend;
beforeEach(() => {
  serverStatus.set("up");
  installFakeSockets();
  tokenStore.clear();
  fb = installFakeBackend();
  fb.handlers["GET /public/plans"] = () => [200, { plans: [] }];
  fb.handlers["GET /public/stats"] = () => [200, { businesses: { count: 0, show: false }, storesLive: { count: 0, show: false }, ordersProcessed: { count: 0, show: false }, reviews: { count: 0, average: 0, show: false } }];
  fb.handlers["GET /reviews"] = () => [200, { reviews: [], total: 0, page: 1, totalPages: 0, stats: { averageRating: 0, totalReviews: 0, ratingBreakdown: {} } }];
  fb.handlers["GET /support/faqs"] = () => [200, []];
  vi.stubGlobal("IntersectionObserver", undefined);
});
afterEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  document.body.style.overflow = "";
});
const last = (key: string) => [...fb.calls].reverse().find((c) => c.key === key);

const form = () => within(screen.getByRole("form", { name: "Contact form" }));
async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(form().getByLabelText(/your name/i), "Ada");
  await user.type(form().getByLabelText(/^email/i), "ada@example.com");
  await user.type(form().getByLabelText(/^phone/i), "08012345678");
  await user.type(form().getByLabelText(/business name/i), "Ada Stores");
  await user.selectOptions(form().getByLabelText(/what can we help with/i), "sales");
  await user.type(form().getByLabelText(/^message/i), "I'd like to know about the Standard plan.");
}

describe("contact page (/contact)", () => {
  it("renders with the public navbar and footer, the support email and its own title", async () => {
    renderApp("/contact");
    expect(await screen.findByRole("heading", { level: 1, name: "Contact us" })).toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "support@bimanage.com" })).toHaveAttribute("href", "mailto:support@bimanage.com");
    // Section links go back to the landing page.
    expect(within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/#pricing");
    await waitFor(() => expect(document.title).toBe("Contact us | BiManage"));
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("index, follow");
    for (const a of document.querySelectorAll("a[href]")) expect(a.getAttribute("href")).not.toMatch(/^\/admin/);
  });

  it("works for signed-in people too (no redirect)", async () => {
    tokenStore.set("tok");
    const router = renderApp("/contact");
    expect(await screen.findByRole("heading", { level: 1, name: "Contact us" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/contact");
    expect(within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/home#pricing");
  });

  it("posts the form with an empty honeypot and shows the server's message", async () => {
    fb.handlers["POST /public/contact"] = () => [202, { message: "Thanks, Ada — we'll reply by email soon." }];
    const user = userEvent.setup();
    renderApp("/contact");
    await screen.findByRole("heading", { level: 1, name: "Contact us" });
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText("Thanks, Ada — we'll reply by email soon.")).toBeInTheDocument();
    expect(last("POST /public/contact")?.body).toEqual({
      name: "Ada",
      email: "ada@example.com",
      phone: "08012345678",
      company: "Ada Stores",
      topic: "sales",
      message: "I'd like to know about the Standard plan.",
      website: "",
    });
  });

  it("checks required fields before sending", async () => {
    const user = userEvent.setup();
    renderApp("/contact");
    await screen.findByRole("heading", { level: 1, name: "Contact us" });
    await user.type(form().getByLabelText(/^message/i), "short");
    await user.click(screen.getByRole("button", { name: "Send message" }));
    expect(screen.getByText("Enter your name.")).toBeInTheDocument();
    expect(screen.getByText(/at least 10 characters\)/i)).toBeInTheDocument();
    expect(last("POST /public/contact")).toBeUndefined();
  });

  it("shows the server's error", async () => {
    fb.handlers["POST /public/contact"] = () => [400, { message: "Please enter a valid email address.", errors: ["email"], field: "email" }];
    const user = userEvent.setup();
    renderApp("/contact");
    await screen.findByRole("heading", { level: 1, name: "Contact us" });
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Send message" }));
    // The ErrorNote, and the same message on the field the server named.
    const alerts = await screen.findAllByRole("alert");
    expect(alerts.some((x) => /valid email address/i.test(x.textContent ?? ""))).toBe(true);
    expect(form().getByLabelText(/^email/i)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Send message" })).toBeInTheDocument();
  });

  it("is indexable and in the sitemap", async () => {
    expect(isIndexable("/contact")).toBe(true);
    const { sitemapXml } = await import("../../../api/_lib/seo.js");
    const xml = sitemapXml("https://x.test", null);
    expect(xml).toContain("<loc>https://x.test/contact</loc><priority>0.5</priority>");
    expect(xml).not.toContain("/admin");
  });
});

describe("public navbar: mobile menu", () => {
  it("opens and closes with the button; aria-expanded follows; focus moves to the first link", async () => {
    const user = userEvent.setup();
    renderApp("/contact");
    await screen.findByRole("heading", { level: 1, name: "Contact us" });
    const toggle = screen.getByRole("button", { name: "Open menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "lp-menu");
    expect(screen.queryByRole("navigation", { name: "Menu" })).toBeNull();
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAccessibleName("Close menu");
    const menu = screen.getByRole("navigation", { name: "Menu" });
    expect(menu).toHaveAttribute("id", "lp-menu");
    await waitFor(() => expect(within(menu).getByRole("link", { name: "Features" })).toHaveFocus());
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(screen.queryByRole("navigation", { name: "Menu" })).toBeNull());
  });

  it("Escape closes it and returns focus to the toggle", async () => {
    const user = userEvent.setup();
    renderApp("/contact");
    await screen.findByRole("heading", { level: 1, name: "Contact us" });
    const toggle = screen.getByRole("button", { name: "Open menu" });
    await user.click(toggle);
    await waitFor(() => expect(within(screen.getByRole("navigation", { name: "Menu" })).getByRole("link", { name: "Features" })).toHaveFocus());
    await user.keyboard("{Escape}");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
    await waitFor(() => expect(screen.queryByRole("navigation", { name: "Menu" })).toBeNull());
  });

  it("a link click or a tap outside closes it", async () => {
    const user = userEvent.setup();
    const router = renderApp("/");
    await screen.findByRole("heading", { level: 1 });
    const toggle = screen.getByRole("button", { name: "Open menu" });
    await user.click(toggle);
    await user.click(screen.getByTestId("menu-backdrop"));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    await user.click(within(screen.getByRole("navigation", { name: "Menu" })).getByRole("link", { name: "Contact us" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/contact"));
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("locks the page scroll while open and restores it on close", async () => {
    const user = userEvent.setup();
    renderApp("/contact");
    await screen.findByRole("heading", { level: 1, name: "Contact us" });
    document.body.style.overflow = "auto";
    const toggle = screen.getByRole("button", { name: "Open menu" });
    await user.click(toggle);
    expect(document.body.style.overflow).toBe("hidden");
    await user.click(toggle);
    expect(document.body.style.overflow).toBe("auto");
  });
});
