import { readFileSync } from "node:fs";
import { describe, expect, it, beforeEach } from "vitest";
import { applyMeta, isIndexable, OG_IMAGE, SITE_URL } from "./meta";
import { injectMeta, isPreviewBot, minimalHtml, PRIVATE_PATHS, robotsTxt, shareMeta, siteUrl, sitemapXml } from "../../../api/_lib/seo.js";

const read = (p: string) => readFileSync(p, "utf8");
const SITE = "https://bimanage-frontend.vercel.app";
const head = (sel: string, attr = "content") => document.head.querySelector(sel)?.getAttribute(attr) ?? null;

describe("index.html site-wide tags", () => {
  const html = read("index.html");
  it.each([
    'name="description"', 'name="keywords"', 'rel="canonical" href="%VITE_PUBLIC_SITE_URL%/"', 'property="og:title"', 'property="og:description"',
    'property="og:url" content="%VITE_PUBLIC_SITE_URL%/"', 'property="og:image" content="%VITE_PUBLIC_SITE_URL%/og-image.png"', 'property="og:locale" content="en_NG"',
    'property="og:type" content="website"', 'name="twitter:card" content="summary_large_image"', 'name="theme-color"', 'rel="apple-touch-icon"', 'rel="manifest" href="/site.webmanifest"',
  ])("has %s", (tag) => expect(html).toContain(tag));

  it("has the share image (1200×630 PNG, under 300 KB) and icon files", () => {
    const png = readFileSync("public/og-image.png");
    expect(png.length).toBeLessThan(300 * 1024);
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
    for (const f of ["favicon.ico", "favicon-16x16.png", "favicon-32x32.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png"]) {
      expect(readFileSync(`public/${f}`).length, f).toBeGreaterThan(100);
    }
    const manifest = JSON.parse(read("public/site.webmanifest"));
    expect(manifest.icons.map((i: { src: string }) => i.src)).toContain("/icon-maskable-512.png");
  });
});

describe("page meta in the app", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
  });

  it("only public pages are indexable", () => {
    for (const p of ["/", "/login", "/register", "/reviews", "/s/dior", "/s/dior/products/abc123"]) expect(isIndexable(p), p).toBe(true);
    for (const p of ["/admin", "/admin/users", "/dashboard", "/store/orders", "/s/dior/checkout", "/s/dior/track", "/s/dior/cart", "/reviews/write", "/support/help"]) expect(isIndexable(p), p).toBe(false);
  });

  it("writes title, description, canonical, robots and share tags", () => {
    applyMeta({ title: "Sign in", description: "Sign in to BiManage." }, "/login");
    expect(document.title).toBe("Sign in | BiManage");
    expect(head('meta[name="description"]')).toBe("Sign in to BiManage.");
    expect(head('meta[name="robots"]')).toBe("index, follow");
    expect(head('link[rel="canonical"]', "href")).toBe(`${SITE_URL}/login`);
    expect(head('meta[property="og:url"]')).toBe(`${SITE_URL}/login`);
    expect(head('meta[property="og:image"]')).toBe(OG_IMAGE);
    expect(head('meta[name="twitter:title"]')).toBe("Sign in | BiManage");
  });

  it("private pages are noindex with no canonical; non-https images fall back", () => {
    applyMeta({ title: "Checkout", image: "http://insecure/x.png" }, "/s/dior/checkout");
    expect(head('meta[name="robots"]')).toBe("noindex, nofollow");
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(head('meta[property="og:image"]')).toBe(OG_IMAGE);
  });

  it("long descriptions are trimmed to 160 characters", () => {
    applyMeta({ description: "word ".repeat(80) }, "/reviews");
    expect(head('meta[name="description"]')!.length).toBeLessThanOrEqual(160);
  });
});

describe("store and product link previews (api/share.js)", () => {
  const index = read("index.html").replaceAll("%VITE_PUBLIC_SITE_URL%", SITE).replace("/src/main.tsx", "/assets/index-abc.js");

  it("product preview: name, store, price, image; site tags replaced, app kept", () => {
    const m = shareMeta({ site: SITE, slug: "dior", productId: "p1", product: { name: "Agbada", description: "Hand stitched", price: 25000, image: "https://cdn.example/p1.png", store: { name: "Dior Factory", slug: "dior" } } })!;
    const out = injectMeta(index, m, SITE);
    expect(out).toContain("<title>Agbada · Dior Factory | BiManage</title>");
    expect(out).toContain('<meta property="og:image" content="https://cdn.example/p1.png" />');
    expect(out).toContain('<meta property="og:url" content="https://bimanage-frontend.vercel.app/s/dior/products/p1" />');
    expect(out).toContain('content="₦25,000. Hand stitched"');
    expect(out).toContain('<meta property="product:price:currency" content="NGN" />');
    expect(out.match(/<title>/g)).toHaveLength(1);
    expect(out.match(/property="og:title"/g)).toHaveLength(1);
    expect(out.match(/rel="canonical"/g)).toHaveLength(1);
    expect(out).toContain('<div id="root"></div>');
    expect(out).toContain("/assets/index-abc.js");
    expect(out).toContain('rel="manifest"');
  });

  it("store preview falls back to the site image; store text is escaped", () => {
    const m = shareMeta({ site: SITE, slug: "x", store: { name: '<script>alert(1)</script> & "Co"', description: "", logo: "javascript:alert(1)" } })!;
    const out = injectMeta(index, m, SITE);
    expect(out).not.toContain("<script>alert");
    expect(out).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;Co&quot;");
    expect(out).toContain(`<meta property="og:image" content="${SITE}/og-image.png" />`);
    expect(out).not.toContain("javascript:");
  });

  it("no data → no store tags; a bare page still carries tags", () => {
    expect(shareMeta({ site: SITE, slug: "x" })).toBeNull();
    const out = minimalHtml({ title: "BiManage", description: "d", url: SITE, image: `${SITE}/og-image.png` }, SITE);
    expect(out).toContain('property="og:title" content="BiManage"');
  });

  it("only link-preview bots get the server-rendered page", () => {
    for (const ua of ["facebookexternalhit/1.1", "WhatsApp/2.23.20.0 A", "LinkedInBot/1.0", "Twitterbot/1.0", "Slackbot-LinkExpanding 1.0", "TelegramBot (like TwitterBot)"]) expect(isPreviewBot(ua), ua).toBe(true);
    for (const ua of ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari", "Mozilla/5.0 (Windows NT 10.0) Chrome/130", ""]) expect(isPreviewBot(ua), ua).toBe(false);
  });

  it("vercel.json sends those bots (and only them) to the share function", () => {
    const v = JSON.parse(read("vercel.json"));
    const bots = v.rewrites.filter((r: { destination: string }) => r.destination.startsWith("/api/share"));
    expect(bots.map((r: { source: string }) => r.source)).toEqual(["/s/:slug/products/:productId", "/s/:slug"]);
    for (const r of bots) {
      const re = new RegExp(`^${r.has[0].value}$`);
      expect(re.test("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)")).toBe(true);
      expect(re.test("WhatsApp/2.23.20.0 A")).toBe(true);
      expect(re.test("Mozilla/5.0 (iPhone) Safari/604.1")).toBe(false);
    }
    expect(v.rewrites.at(-1).destination).toBe("/index.html");
  });
});

describe("robots.txt, sitemap.xml and noindex", () => {
  it("the site address comes from one setting", () => {
    expect(siteUrl({})).toBe(SITE);
    expect(siteUrl({ VITE_PUBLIC_SITE_URL: "https://bimanage.ng/" })).toBe("https://bimanage.ng");
    expect(siteUrl({ SITE_URL: "https://a.ng", VITE_PUBLIC_SITE_URL: "https://b.ng" })).toBe("https://a.ng");
  });

  it("sitemap lists public pages, stores and products, escaped", () => {
    const xml = sitemapXml(SITE, { stores: [{ slug: "dior", updatedAt: "2026-11-01T10:00:00Z" }], products: [{ slug: "dior", id: "p1", updatedAt: "bad" }, { slug: "", id: "x" }] });
    expect(xml).toContain(`<loc>${SITE}/register</loc>`);
    expect(xml).toContain(`<loc>${SITE}/s/dior</loc><lastmod>2026-11-01</lastmod>`);
    expect(xml).toContain(`<loc>${SITE}/s/dior/products/p1</loc><priority>`);
    expect(xml).not.toContain("/admin");
    expect(xml).not.toContain("/products/x");
    expect(sitemapXml(SITE, null)).toContain(`${SITE}/reviews`);
  });

  it("robots.txt blocks private areas and points at the sitemap", () => {
    const txt = robotsTxt(SITE);
    for (const p of ["/admin", "/dashboard", "/store", "/s/*/checkout", "/s/*/track"]) expect(txt).toContain(`Disallow: ${p}`);
    expect(txt).not.toMatch(/^Disallow: \/s\/?$/m);
    expect(txt).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  });

  it("vercel.json noindexes the same private sections robots.txt blocks", () => {
    const v = JSON.parse(read("vercel.json"));
    const rule = v.headers.find((h: { source: string }) => h.source.startsWith("/:section("));
    const sections = rule.source.match(/\(([^)]+)\)/)![1].split("|");
    for (const p of PRIVATE_PATHS.filter((x: string) => /^\/[a-z-]+$/.test(x))) expect(sections, p).toContain(p.slice(1));
    expect(rule.headers[0].value).toBe("noindex, nofollow");
  });
});
