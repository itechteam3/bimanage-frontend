import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { isIndexable } from "@/lib/seo/meta";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";
import { installFakeSockets } from "@/test/fakeSocket";
import { sitemapData, sitemapXml, STATIC_PAGES } from "../../../api/_lib/seo.js";
import sitemapHandler from "../../../api/sitemap.js";

// The public help centre (/help, /help/<slug>): read-only, signed in or out.

const ARTICLES = [
  { _id: "a1", slug: "create-your-store", question: "How to create your online store", summary: "Set up your free online store.", answer: "1. Go to **Online Store**.\n2. Click **Create store**.\n\n**Next:** see [Publish your store](/support/help/publish-your-store).", category: "store", readMinutes: 1, updatedAt: "2026-11-10T09:00:00Z" },
  { _id: "a2", slug: "publish-your-store", question: "How to publish your store", summary: "Make your store live for customers.", answer: "1. Click **Publish store**.", category: "store", readMinutes: 1, updatedAt: "2026-11-11T09:00:00Z" },
  { _id: "a3", slug: "withdraw-to-bank", question: "How to withdraw to your bank", summary: "Send your available balance to your bank account.", answer: "1. Go to **Wallet** and click **Request payout**.", category: "wallet", readMinutes: 1, updatedAt: "2026-11-12T09:00:00Z" },
];

let fb: FakeBackend;
beforeEach(() => {
  serverStatus.set("up");
  installFakeSockets();
  tokenStore.clear();
  fb = installFakeBackend();
  fb.handlers["GET /support/faqs"] = (_b, _h, url) => {
    const c = url.searchParams.get("category");
    return [200, c ? ARTICLES.filter((a) => a.category === c) : ARTICLES];
  };
  for (const a of ARTICLES) {
    fb.handlers[`GET /support/faqs/${a.slug}`] = () => [200, a];
    fb.handlers[`GET /support/faqs/${a._id}`] = () => [200, a];
  }
});
afterEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  document.body.style.overflow = "";
});
const last = (key: string) => [...fb.calls].reverse().find((c) => c.key === key);

describe("/help", () => {
  it("lists the topics and their articles from the public API, signed out, with its own title", async () => {
    const router = renderApp("/help");
    expect(await screen.findByRole("heading", { level: 1, name: "Help centre" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Help topics" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Store setup" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Wallet & payouts" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /How to withdraw to your bank/ })).toHaveAttribute("href", "/help/withdraw-to-bank");
    expect(router.state.location.pathname).toBe("/help");
    expect(last("GET /support/faqs")?.headers.Authorization).toBeUndefined();
    await waitFor(() => expect(document.title).toBe("Help centre | BiManage"));
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toMatch(/Step-by-step BiManage guides/);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toMatch(/\/help$/);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("index, follow");
  });

  it("filters titles and summaries as you type", async () => {
    const user = userEvent.setup();
    renderApp("/help");
    await screen.findByRole("heading", { name: "Help topics" });
    await user.type(screen.getByLabelText("Search help articles"), "balance");
    expect(await screen.findByRole("heading", { name: "1 article found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /How to withdraw to your bank/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /How to publish your store/ })).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText("Search help articles"));
    await user.type(screen.getByLabelText("Search help articles"), "zebra");
    expect(await screen.findByRole("heading", { name: "No articles match your search" })).toBeInTheDocument();
  });

  it("a topic shows only its articles (?category=, the link guest FELI uses)", async () => {
    renderApp("/help?category=wallet");
    expect(await screen.findByRole("link", { name: /How to withdraw to your bank/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Store setup" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show all topics" })).toBeInTheDocument();
  });

  it("navbar and footer link to Help", async () => {
    renderApp("/help");
    await screen.findByRole("heading", { name: "Help topics" });
    expect(within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: "Help" })).toHaveAttribute("href", "/help");
    expect(within(screen.getByRole("navigation", { name: "Footer" })).getByRole("link", { name: "Help centre" })).toHaveAttribute("href", "/help");
  });
});

describe("/help/<slug>", () => {
  it("renders the article with the shared step formatting, meta, related articles and contact (signed out: no vote, no ticket)", async () => {
    const router = renderApp("/help/create-your-store");
    expect(await screen.findByRole("heading", { level: 1, name: "How to create your online store" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/help/create-your-store");
    // Same renderer as /support/help: numbered steps and bold.
    const steps = screen.getAllByRole("list").find((l) => l.tagName === "OL")!;
    expect(within(steps).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Online Store").tagName).toBe("STRONG");
    // Links to other articles stay on the public help centre.
    expect(screen.getByRole("link", { name: "Publish your store" })).toHaveAttribute("href", "/help/publish-your-store");
    // Related: the same topic only, not the article itself.
    const related = await screen.findByRole("heading", { name: "More in Store setup" });
    const relatedList = within(related.parentElement!);
    expect(relatedList.getByRole("link", { name: /How to publish your store/ })).toBeInTheDocument();
    expect(relatedList.queryByRole("link", { name: /withdraw/ })).not.toBeInTheDocument();
    const stillNeedHelp = within(screen.getByRole("heading", { name: "Still need help?" }).closest("section")!);
    expect(stillNeedHelp.getByRole("link", { name: /Contact us/ })).toHaveAttribute("href", "/contact?topic=support");
    expect(screen.queryByRole("heading", { name: "Was this helpful?" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Open a support ticket/ })).not.toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("How to create your online store | BiManage"));
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe("Set up your free online store.");
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toMatch(/\/help\/create-your-store$/);
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute("content")).toBe("How to create your online store | BiManage");
  });

  it("an id link moves to the slug address", async () => {
    const router = renderApp("/help/a3");
    await screen.findByRole("heading", { level: 1, name: "How to withdraw to your bank" });
    await waitFor(() => expect(router.state.location.pathname).toBe("/help/withdraw-to-bank"));
  });

  it("an unknown article says so and links back to the help centre", async () => {
    fb.handlers["GET /support/faqs/nope"] = () => [404, { message: "Article not found" }];
    renderApp("/help/nope");
    expect(await screen.findByRole("heading", { name: "Article not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse the help centre" })).toHaveAttribute("href", "/help");
  });

  it("signed in: stays on the public page, can vote, open a ticket or open it in the workspace", async () => {
    tokenStore.set("tok");
    fb.handlers["POST /support/faqs/a3/helpful"] = () => [200, { message: "Thanks" }];
    const user = userEvent.setup();
    const router = renderApp("/help/withdraw-to-bank");
    await screen.findByRole("heading", { level: 1, name: "How to withdraw to your bank" });
    expect(router.state.location.pathname).toBe("/help/withdraw-to-bank");
    expect(await screen.findByRole("link", { name: "Open in your workspace" })).toHaveAttribute("href", "/support/help/withdraw-to-bank");
    expect(screen.getByRole("link", { name: /Open a support ticket/ })).toHaveAttribute("href", "/support/tickets/new?category=wallet");
    await user.click(screen.getByRole("button", { name: /Yes/ }));
    expect(await screen.findByText("Thanks for your feedback.")).toBeInTheDocument();
    expect(last("POST /support/faqs/a3/helpful")?.body).toEqual({ helpful: true });
  });
});

describe("SEO: indexable help pages and the sitemap", () => {
  it("/help and /help/<slug> are indexable; the signed-in help centre isn't", () => {
    expect(isIndexable("/help")).toBe(true);
    expect(isIndexable("/help/create-your-store")).toBe(true);
    expect(isIndexable("/help/a/b")).toBe(false);
    expect(isIndexable("/support/help/create-your-store")).toBe(false);
    expect(STATIC_PAGES).toContain("/help");
  });

  it("the sitemap lists /help and every published article from the public API (mock fetch)", async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        seen.push(url);
        if (url.endsWith("/support/faqs")) return new Response(JSON.stringify([...ARTICLES, { _id: "x", slug: null, question: "Admin note" }]), { status: 200 });
        if (url.endsWith("/store/share-sitemap")) return new Response(JSON.stringify({ stores: [{ slug: "dior" }], products: [] }), { status: 200 });
        return new Response("{}", { status: 404 });
      })
    );
    const res = { headers: {} as Record<string, string>, code: 0, body: "", setHeader(k: string, v: string) { this.headers[k] = v; }, status(c: number) { this.code = c; return this; }, send(b: string) { this.body = b; } };
    await sitemapHandler({}, res);
    expect(seen.some((u) => u.endsWith("/api/support/faqs"))).toBe(true);
    expect(res.body).toContain("/help</loc>");
    expect(res.body).toContain("/help/create-your-store</loc><lastmod>2026-11-10</lastmod>");
    expect(res.body).toContain("/help/withdraw-to-bank</loc>");
    expect(res.body).toContain("/s/dior</loc>");
    expect(res.body).not.toContain("/help/x<");
  });

  it("each source falls back on its own: no articles still lists stores, nothing at all still lists the pages", async () => {
    const shopOnly = await sitemapData("https://api.example/api", async (u: string) => (u.includes("share-sitemap") ? { stores: [{ slug: "dior" }] } : null));
    expect(shopOnly).toEqual({ stores: [{ slug: "dior" }], articles: [] });
    const helpOnly = await sitemapData("https://api.example/api", async (u: string) => (u.includes("faqs") ? [{ slug: "create-your-store", updatedAt: "2026-11-10T09:00:00Z", answer: "long" }] : null));
    expect(helpOnly).toEqual({ articles: [{ slug: "create-your-store", updatedAt: "2026-11-10T09:00:00Z" }] });
    expect(await sitemapData("https://api.example/api", async () => null)).toBeNull();
    expect(sitemapXml("https://bimanage.example", null)).toContain("https://bimanage.example/help</loc>");
  });
});
