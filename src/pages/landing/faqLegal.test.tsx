import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, configure, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { isIndexable } from "@/lib/seo/meta";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";
import { installFakeSockets } from "@/test/fakeSocket";
import { ALL_FAQS, FAQ_GROUPS, faqJsonLd, fold, resolveFaqText } from "./faq";
import { faqVotes } from "./FaqAccordion";
import type { PublicPlans } from "@/lib/landing/api";

// Prices deliberately unlike the real ones: they must come from this API.
const PLANS: PublicPlans = {
  currency: "NGN",
  plans: [
    { id: "freemium", name: "Freemium", description: "Free", price: { monthly: 0, yearly: 0 }, credits: 77, features: {}, pricesConfirmed: true },
    { id: "standard", name: "Standard", description: "Core", price: { monthly: 12345, yearly: 123450 }, credits: "unlimited", features: {}, pricesConfirmed: false },
    { id: "premium", name: "Premium", description: "All", price: { monthly: 54321, yearly: 543210 }, credits: "unlimited", features: {}, pricesConfirmed: false },
  ],
  startupPackages: [
    { id: "starter", name: "Starter", amount: 111111, days: 30 },
    { id: "standard", name: "Standard", amount: 222222, days: 30 },
    { id: "premium", name: "Premium", amount: 333333, days: 30 },
  ],
};

// The pages are lazy chunks: the first render can be slow on a busy machine.
configure({ asyncUtilTimeout: 10_000 });

let fb: FakeBackend;
beforeEach(() => {
  serverStatus.set("up");
  installFakeSockets();
  tokenStore.clear();
  window.localStorage.removeItem(faqVotes.key);
  fb = installFakeBackend();
  fb.handlers["GET /public/plans"] = () => [200, PLANS];
  fb.handlers["GET /public/stats"] = () => [200, { businesses: { count: 0, show: false }, storesLive: { count: 0, show: false }, ordersProcessed: { count: 0, show: false }, reviews: { count: 0, average: 0, show: false } }];
  fb.handlers["GET /reviews"] = () => [200, { reviews: [], total: 0, page: 1, totalPages: 0, stats: { averageRating: 0, totalReviews: 0, ratingBreakdown: {} } }];
  fb.handlers["GET /support/faqs"] = () => [
    200,
    [
      { _id: "f1", question: "Can I print barcodes?", answer: "Yes, from inventory.", category: "inventory" },
      { _id: "f2", question: "Is there a free plan?", answer: "A duplicate of a built-in question.", category: "billing" },
    ],
  ];
  vi.stubGlobal("IntersectionObserver", undefined);
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const question = (name: RegExp | string) => screen.getByRole("button", { name });

describe("FAQ content (faq.ts)", () => {
  it("has the 8 topics with stable slugs, 15–25 questions, unique ids and about 6 featured", () => {
    expect(FAQ_GROUPS.map((g) => g.slug)).toEqual(["getting-started", "billing", "store", "wallet", "bisupplynet", "feli", "security", "account"]);
    expect(FAQ_GROUPS.map((g) => g.title)).toEqual(["Getting started", "Plans and billing", "Online store and payments", "Wallet and payouts", "BiSupplyNet and escrow", "FELI", "Security and data", "Account"]);
    expect(ALL_FAQS.length).toBeGreaterThanOrEqual(15);
    expect(ALL_FAQS.length).toBeLessThanOrEqual(25);
    expect(new Set(ALL_FAQS.map((f) => f.id)).size).toBe(ALL_FAQS.length);
    expect(ALL_FAQS.filter((f) => f.featured)).toHaveLength(6);
  });

  it("never hard-codes a plan or package price (amounts come from the plans API)", () => {
    for (const f of ALL_FAQS) for (const p of f.a) expect(p, f.id).not.toMatch(/₦|NGN\s?\d{2},\d{3}|\b\d{2,3},\d{3}\b/);
  });

  it("fills price placeholders from the API, and reports unfilled ones", () => {
    expect(resolveFaqText("Standard {price:standard:monthly} / {package:starter} / {credits:freemium}", PLANS)).toBe("Standard ₦12,345 / ₦111,111 / 77");
    expect(resolveFaqText("Standard {price:standard:monthly}", undefined)).toBeNull();
    const ld = faqJsonLd(ALL_FAQS, undefined);
    expect(ld.mainEntity.some((q) => q.name === "How much do the paid plans cost?")).toBe(false); // left out until prices load
    expect(JSON.stringify(faqJsonLd(ALL_FAQS, PLANS))).toContain("₦54,321");
  });

  it("search folding ignores case and accents", () => {
    expect(fold("ÉSCROW Café")).toBe("escrow cafe");
  });
});

describe("/faq page", () => {
  it("renders every topic, with prices from the plans API and FAQPage structured data", async () => {
    renderApp("/faq");
    expect(await screen.findByRole("heading", { level: 1, name: "Frequently asked questions" })).toBeInTheDocument();
    for (const g of FAQ_GROUPS) expect(screen.getByRole("heading", { level: 2, name: g.title })).toBeInTheDocument();
    const topics = screen.getAllByRole("navigation", { name: "FAQ topics" })[0]!;
    expect(within(topics).getByRole("link", { name: "Plans and billing" })).toHaveAttribute("href", "/faq#billing");

    await userEvent.click(question("How much do the paid plans cost?"));
    expect(await screen.findByText(/Standard costs ₦12,345 a month or ₦123,450 a year/)).toBeInTheDocument();
    expect(screen.getByText(/Starter ₦111,111/)).toBeInTheDocument();
    expect(screen.getByText(/introductory and may change/)).toBeInTheDocument();

    await waitFor(() => expect(document.getElementById("faq-jsonld")?.textContent).toContain("₦12,345"));
    const ld = JSON.parse(document.getElementById("faq-jsonld")!.textContent!);
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity).toHaveLength(ALL_FAQS.length);
    expect(document.querySelectorAll('script[type="application/ld+json"]#faq-jsonld')).toHaveLength(1);
  });

  it("adds help-centre answers that aren't duplicates", async () => {
    renderApp("/faq");
    expect(await screen.findByRole("heading", { level: 2, name: "More answers" })).toBeInTheDocument();
    expect(question("Can I print barcodes?")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Is there a free plan?" })).toHaveLength(1);
  });

  it.each([["/faq#billing"], ["/faq?topic=billing"]])("%s selects and scrolls to Plans and billing", async (path) => {
    renderApp(path);
    await screen.findByRole("heading", { level: 1, name: "Frequently asked questions" });
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
    const target = (Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mock.contexts.at(-1) as HTMLElement;
    expect(target.id).toBe("billing");
    for (const nav of screen.getAllByRole("navigation", { name: "FAQ topics" })) expect(within(nav).getByRole("link", { name: "Plans and billing" })).toHaveAttribute("aria-current", "true");
  });

  it("clicking a topic updates the address to /faq#<slug>", async () => {
    const router = renderApp("/faq");
    await screen.findByRole("heading", { level: 1, name: "Frequently asked questions" });
    await userEvent.click(within(screen.getAllByRole("navigation", { name: "FAQ topics" })[0]!).getByRole("link", { name: "FELI" }));
    await waitFor(() => expect(router.state.location.hash).toBe("#feli"));
  });

  it("search filters questions and answers as you type, with a count, ignoring case and accents", async () => {
    renderApp("/faq");
    await screen.findByRole("heading", { level: 1, name: "Frequently asked questions" });
    const box = screen.getByRole("searchbox", { name: "Search the FAQ" });
    await userEvent.type(box, "ÉSCROW");
    const status = screen.getByRole("status");
    const n = ALL_FAQS.filter((f) => fold(`${f.q} ${f.a.join(" ")}`).includes("escrow")).length;
    expect(n).toBeGreaterThan(0);
    expect(status).toHaveTextContent(`${n} ${n === 1 ? "result" : "results"} for "ÉSCROW"`);
    expect(question("How does escrow protect wholesale payments?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "How does the free trial work?" })).toBeNull();

    // An answer-only match: "midnight" is only in the Freemium answer.
    await userEvent.clear(box);
    await userEvent.type(box, "midnight lagos");
    expect(question("Is there a free plan?")).toBeInTheDocument();
  });

  it("no results offers FELI and the contact page", async () => {
    renderApp("/faq");
    await screen.findByRole("heading", { level: 1, name: "Frequently asked questions" });
    await userEvent.type(screen.getByRole("searchbox", { name: "Search the FAQ" }), "zzqqxx");
    expect(screen.getByRole("status")).toHaveTextContent('0 results for "zzqqxx"');
    expect(screen.getByRole("heading", { name: "No results" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ask feli/i })).toHaveAttribute("href", "/feli");
    expect(screen.getAllByRole("link", { name: "Contact us" }).some((a) => a.closest("main") && a.getAttribute("href") === "/contact")).toBe(true);
  });

  it("opens one answer at a time, with aria-expanded and a labelled region", async () => {
    renderApp("/faq");
    await screen.findByRole("heading", { level: 1, name: "Frequently asked questions" });
    const a = question("What is BiManage?");
    const b = question("How does the free trial work?");
    expect(a).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(a);
    expect(a).toHaveAttribute("aria-expanded", "true");
    const region = document.getElementById(a.getAttribute("aria-controls")!)!;
    expect(region).toHaveAttribute("role", "region");
    expect(region).toHaveAttribute("aria-labelledby", a.id);
    await userEvent.click(b);
    expect(b).toHaveAttribute("aria-expanded", "true");
    expect(a).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(b);
    expect(b).toHaveAttribute("aria-expanded", "false");
    // Keyboard: Enter on a focused question opens it.
    a.focus();
    await userEvent.keyboard("{Enter}");
    expect(a).toHaveAttribute("aria-expanded", "true");
  });

  it('"Was this helpful?" is remembered in this browser', async () => {
    renderApp("/faq");
    await screen.findByRole("heading", { level: 1, name: "Frequently asked questions" });
    await userEvent.click(question("What is BiManage?"));
    await userEvent.click(within(screen.getByRole("group", { name: "Was this helpful?" })).getByRole("button", { name: "Yes" }));
    expect(screen.getByText("Thanks for letting us know.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(faqVotes.key)!)).toEqual({ "what-is-bimanage": "yes" });
    cleanup();
    renderApp("/faq");
    await screen.findByRole("heading", { level: 1, name: "Frequently asked questions" });
    await userEvent.click(question("What is BiManage?"));
    expect(screen.getByText("Thanks for letting us know.")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Was this helpful?" })).toBeNull();
  });

  it("help-centre pointers go to the help centre (sign-in)", async () => {
    renderApp("/faq");
    await screen.findByRole("heading", { level: 1, name: "Frequently asked questions" });
    await userEvent.click(question("What is FELI and what can it do?"));
    expect(screen.getAllByRole("link", { name: /more in the help centre \(sign in\)/i })[0]).toHaveAttribute("href", "/support/help");
  });
});

describe("/terms and /privacy", () => {
  it.each([
    ["/terms", "Terms of Service", ["Plans, trials, subscriptions and renewals", "Your online store and the sales commission", "BiSupplyNet, escrow, disputes and refunds", "FELI, the AI assistant", "Governing law and disputes"]],
    ["/privacy", "Privacy Policy", ["Our two roles: controller and processor", "Who we share data with", "How long we keep data", "Your rights", "Cookies and local storage", "Contact and complaints"]],
  ])("%s renders with the draft banner, last updated date and contents", async (path, title, sections) => {
    renderApp(path);
    expect(await screen.findByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByRole("note", { name: "Draft notice" })).toHaveTextContent("Draft, pending legal review");
    expect(screen.getByText(/Last updated/)).toHaveTextContent("Last updated 16 November 2026");
    const toc = screen.getByRole("navigation", { name: "Contents" });
    for (const s of sections) {
      const link = within(toc).getByRole("link", { name: new RegExp(s.replace(/[()]/g, "\\$&")) });
      const id = link.getAttribute("href")!.slice(1);
      expect(document.getElementById(id)).not.toBeNull();
      expect(screen.getByRole("heading", { level: 2, name: new RegExp(s) })).toBeInTheDocument();
    }
    await waitFor(() => expect(document.title).toBe(`${title} | BiManage`));
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
  });

  it("the banner goes once VITE_LEGAL_APPROVED is true", async () => {
    vi.stubEnv("VITE_LEGAL_APPROVED", "true");
    renderApp("/terms");
    expect(await screen.findByRole("heading", { level: 1, name: "Terms of Service" })).toBeInTheDocument();
    expect(screen.queryByRole("note", { name: "Draft notice" })).toBeNull();
    expect(screen.queryByText("Draft, pending legal review")).toBeNull();
  });

  it("the Privacy Policy names the providers the code uses and the NDPC", async () => {
    renderApp("/privacy");
    await screen.findByRole("heading", { level: 1, name: "Privacy Policy" });
    for (const p of ["MongoDB Atlas", "Render", "Vercel", "Paystack", "Cloudinary", "Resend and Brevo", "Groq"]) expect(screen.getByRole("rowheader", { name: new RegExp(p) })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ndpc.gov.ng" })).toHaveAttribute("href", "https://ndpc.gov.ng");
  });
});

describe("links and SEO", () => {
  it("the footer links to the FAQ, Terms and Privacy; the navbar FAQ goes to /faq", async () => {
    renderApp("/contact");
    await screen.findByRole("heading", { level: 1 });
    const legal = screen.getByRole("navigation", { name: "Legal" });
    expect(within(legal).getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
    expect(within(legal).getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    expect(within(screen.getByRole("navigation", { name: "Footer" })).getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/faq");
    expect(within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/faq");
  });

  it("/faq, /terms and /privacy are indexable and in the sitemap", async () => {
    for (const p of ["/faq", "/terms", "/privacy"]) expect(isIndexable(p), p).toBe(true);
    const { sitemapXml } = await import("../../../api/_lib/seo.js");
    const xml = sitemapXml("https://bimanage-frontend.vercel.app", null);
    for (const p of ["/faq", "/terms", "/privacy"]) expect(xml).toContain(`<loc>https://bimanage-frontend.vercel.app${p}</loc>`);
  });
});
