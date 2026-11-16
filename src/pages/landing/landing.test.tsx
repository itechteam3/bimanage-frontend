import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";
import { installFakeSockets } from "@/test/fakeSocket";
import { FEATURED_FAQS } from "./faq";

const PLANS = {
  currency: "NGN",
  plans: [
    { id: "freemium", name: "Freemium", description: "Get started for free", price: { monthly: 0, yearly: 0 }, credits: 100, features: { inventory: true, orders: true, store: "view_only" }, pricesConfirmed: true },
    { id: "standard", name: "Standard", description: "Core business tools", price: { monthly: 17500, yearly: 175000 }, credits: "unlimited", features: { inventory: true, orders: true, invoices: true, store: true }, pricesConfirmed: false },
  ],
  startupPackages: [{ id: "starter", name: "Starter", amount: 199999, currency: "NGN", summary: "Core features", days: 30 }],
};
const STATS = (show: boolean) => ({ businesses: { count: 1234, show }, storesLive: { count: 87, show }, ordersProcessed: { count: 9876, show: false }, reviews: { count: 0, average: 0, show: false } });

let fb: FakeBackend;
beforeEach(() => {
  serverStatus.set("up");
  installFakeSockets();
  tokenStore.clear();
  fb = installFakeBackend();
  fb.handlers["GET /public/plans"] = () => [200, PLANS];
  fb.handlers["GET /public/stats"] = () => [200, STATS(false)];
  fb.handlers["GET /reviews"] = () => [200, { reviews: [], total: 0, page: 1, totalPages: 0, stats: { averageRating: 0, totalReviews: 0, ratingBreakdown: {} } }];
  fb.handlers["GET /support/faqs"] = () => [200, [{ _id: "f1", question: "How do payouts work?", answer: "Earnings become available when an order completes.", category: "wallet" }]];
  // jsdom has no IntersectionObserver: the page must still show everything.
  vi.stubGlobal("IntersectionObserver", undefined);
});
afterEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
});
const last = (key: string) => [...fb.calls].reverse().find((c) => c.key === key);

describe("landing page (/)", () => {
  it("signed-out visitors see the landing page with sign-in and sign-up links", async () => {
    renderApp("/");
    expect(await screen.findByRole("heading", { level: 1, name: /smart business starts with bimanage/i })).toBeInTheDocument();
    const nav = screen.getByRole("banner");
    expect(within(nav).getAllByRole("link", { name: "Sign in" })[0]).toHaveAttribute("href", "/login");
    expect(within(nav).getAllByRole("link", { name: "Get started" })[0]).toHaveAttribute("href", "/register");
    for (const a of screen.getAllByRole("link", { name: /get started free/i })) expect(a).toHaveAttribute("href", "/register");
    expect(document.body.textContent).not.toMatch(/(^|[^B])iManage/); // never the Figma typo "iManage"
  });

  it("signed-in people still see the landing page at /, with Go to dashboard instead of sign-in buttons", async () => {
    tokenStore.set("tok");
    const router = renderApp("/");
    expect(await screen.findByRole("heading", { level: 1, name: /smart business starts with bimanage/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("link", { name: "Go to dashboard" }).length).toBeGreaterThan(1));
    for (const a of screen.getAllByRole("link", { name: "Go to dashboard" })) expect(a).toHaveAttribute("href", "/start");
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
    expect(screen.queryByRole("link", { name: /get started free/i })).toBeNull();
    expect(router.state.location.pathname).toBe("/");
  });

  it("/start opens the signed-in start page (the dashboard by default)", async () => {
    tokenStore.set("tok");
    const router = renderApp("/start");
    await waitFor(() => expect(router.state.location.pathname).toBe("/dashboard"));
  });

  it("/home redirects to /", async () => {
    const router = renderApp("/home");
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });

  it("never links to the internal admin area", async () => {
    renderApp("/");
    await screen.findByRole("heading", { level: 1 });
    for (const a of document.querySelectorAll("a[href]")) expect(a.getAttribute("href")).not.toMatch(/^\/admin/);
    expect(document.body.textContent).not.toMatch(/admin area|platform admin|two-step sign-in for admins/i);
  });

  it("pricing comes from the API, with a monthly/yearly toggle and startup packages", async () => {
    const user = userEvent.setup();
    renderApp("/");
    const pricing = await screen.findByRole("heading", { name: /start free, upgrade when you're ready/i });
    const section = pricing.closest("section")!;
    expect(await within(section).findByText("₦17,500")).toBeInTheDocument();
    expect(within(section).getByText(/introductory and may change/i)).toBeInTheDocument();
    await user.click(within(section).getByRole("radio", { name: "yearly" }));
    expect(within(section).getByText("₦175,000")).toBeInTheDocument();
    expect(within(section).getByText("₦199,999")).toBeInTheDocument();
    expect(within(section).getByText(/live online store \(view only\)/i)).toBeInTheDocument();
    expect(last("GET /public/plans")).toBeTruthy();
  });

  it("shows real numbers only when the server says they're worth showing", async () => {
    renderApp("/");
    await screen.findByRole("heading", { level: 1 });
    await waitFor(() => expect(last("GET /public/stats")).toBeTruthy());
    expect(screen.queryByRole("region", { name: /bimanage in numbers/i })).toBeNull();
  });

  it("counts up real numbers when shown", async () => {
    fb.handlers["GET /public/stats"] = () => [200, STATS(true)];
    renderApp("/");
    const region = await screen.findByRole("region", { name: /bimanage in numbers/i });
    expect(within(region).getByText("1,234")).toBeInTheDocument();
    expect(within(region).getByText("87")).toBeInTheDocument();
    expect(within(region).queryByText(/orders processed/i)).toBeNull();
  });

  it("leaves out the reviews section when there are no approved reviews", async () => {
    renderApp("/");
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("heading", { name: /what businesses say/i })).toBeNull();
  });

  it("shows approved reviews from the public API when there are some", async () => {
    fb.handlers["GET /reviews"] = () => [200, { reviews: [{ _id: "r1", headline: "Saves me hours", rating: 5, review: "Orders and stock in one place.", reviewer: { name: "Tola", avatar: "https://res.cloudinary.com/x/image/upload/tola.jpg" }, businessName: "Tola Foods" }], total: 1, page: 1, totalPages: 1, stats: { averageRating: 5, totalReviews: 1, ratingBreakdown: {} } }];
    renderApp("/");
    expect(await screen.findByText("Saves me hours")).toBeInTheDocument();
    expect(document.querySelector('img[src="https://res.cloudinary.com/x/image/upload/tola.jpg"]')).toBeTruthy(); // their BiManage photo
    expect(screen.getByRole("link", { name: /read all reviews/i })).toHaveAttribute("href", "/reviews");
  });

  it("FAQ preview shows only the featured questions, with See all FAQs going to /faq (no FAQPage markup here)", async () => {
    renderApp("/");
    const section = (await screen.findByRole("heading", { name: "Questions, answered" })).closest("section")!;
    const questions = within(section).getAllByRole("button", { expanded: false }).map((b) => b.textContent);
    expect(questions).toEqual(FEATURED_FAQS.map((f) => f.q));
    expect(questions.length).toBeGreaterThanOrEqual(5);
    expect(questions.length).toBeLessThanOrEqual(7);
    expect(within(section).queryByText("How do payouts work?")).toBeNull(); // help-centre answers live on /faq
    expect(within(section).getByRole("link", { name: "See all FAQs" })).toHaveAttribute("href", "/faq");
    expect(within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/faq");
    expect(document.querySelector('script[type="application/ld+json"]#faq-jsonld')).toBeNull();
  });

  it('product screenshots have alt text and no "Sample data" badge', async () => {
    renderApp("/");
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText("Sample data")).toBeNull();
    const shots = screen.getAllByRole("img").filter((i) => (i.getAttribute("src") ?? "").includes("screens/") || /screens/.test(i.getAttribute("src") ?? ""));
    expect(shots.length).toBeGreaterThan(1);
    for (const img of shots) expect(img.getAttribute("alt")).toMatch(/bimanage/i);
  });

  it("every Contact us link goes to /contact (navbar, mobile menu, floating button, footer)", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("button", { name: "Contact us" })).toBeNull();
    expect(within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: "Contact us" })).toHaveAttribute("href", "/contact");
    expect(within(screen.getByRole("navigation", { name: "Footer" })).getByRole("link", { name: "Contact us" })).toHaveAttribute("href", "/contact");
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(within(screen.getByRole("navigation", { name: "Menu" })).getByRole("link", { name: "Contact us" })).toHaveAttribute("href", "/contact");
    const links = screen.getAllByRole("link", { name: "Contact us" });
    expect(links).toHaveLength(4);
    for (const a of links) expect(a).toHaveAttribute("href", "/contact");
  });

  it("newsletter signup posts the email and shows the confirmation message", async () => {
    fb.handlers["POST /public/newsletter"] = () => [202, { message: "Check your inbox to confirm your subscription." }];
    const user = userEvent.setup();
    renderApp("/");
    await screen.findByRole("heading", { level: 1 });
    await user.type(screen.getByLabelText("Email address"), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Subscribe" }));
    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument();
    expect(last("POST /public/newsletter")?.body).toEqual({ email: "ada@example.com", website: "" });
  });
});

describe("newsletter links", () => {
  it("confirm posts the signed link and shows the result", async () => {
    fb.handlers["POST /public/newsletter/confirm"] = () => [200, { message: "You're subscribed.", valid: true, status: "confirmed" }];
    renderApp("/newsletter/confirm?e=abc&t=sig");
    expect(await screen.findByText("You're subscribed.")).toBeInTheDocument();
    expect(last("POST /public/newsletter/confirm")?.body).toEqual({ e: "abc", t: "sig" });
  });

  it("a bad link shows the server's message", async () => {
    fb.handlers["POST /public/newsletter/unsubscribe"] = () => [400, { message: "This link isn't valid.", valid: false }];
    renderApp("/newsletter/unsubscribe?e=abc&t=bad");
    expect(await screen.findByRole("alert")).toHaveTextContent(/isn't valid/i);
  });
});

describe("SEO for /", () => {
  it("the sitemap lists / first and never /admin", async () => {
    const { sitemapXml, robotsTxt } = await import("../../../api/_lib/seo.js");
    const xml = sitemapXml("https://bimanage-frontend.vercel.app", null);
    expect(xml).toContain("<loc>https://bimanage-frontend.vercel.app/</loc><priority>1.0</priority>");
    expect(xml).not.toContain("/admin");
    expect(robotsTxt("https://x").split("\n").filter((l) => /^Allow/.test(l))).toEqual(["Allow: /"]);
  });

  it("index.html has the logo in structured data and the share tags", () => {
    const html = readFileSync("index.html", "utf8");
    expect(html).toContain('"logo": "%VITE_PUBLIC_SITE_URL%/icon-512.png"');
    expect(html).toContain('property="og:image" content="%VITE_PUBLIC_SITE_URL%/og-image.png"');
    expect(html).toContain('rel="icon" href="/favicon.ico"');
  });
});
