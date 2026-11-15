// Shared by api/share.js, api/sitemap.js and api/robots.js (Vercel functions).
// "_lib" starts with an underscore, so Vercel doesn't deploy it as a function.

export const DEFAULT_SITE = "https://bimanage-frontend.vercel.app";
export const DEFAULT_API = "https://bimanage-backend.onrender.com/api";

/** The one public site address (same setting the app build uses). */
export const siteUrl = (env = process.env) => String(env.SITE_URL || env.VITE_PUBLIC_SITE_URL || DEFAULT_SITE).replace(/\/+$/, "");
export const apiUrl = (env = process.env) => String(env.SHARE_API_URL || env.VITE_API_BASE_URL || DEFAULT_API).replace(/\/+$/, "");

// Link-preview bots (they don't run JavaScript). Search engines render the app
// themselves, so they get the normal page.
export const PREVIEW_BOTS =
  "facebookexternalhit|facebookcatalog|Facebot|meta-externalagent|LinkedInBot|WhatsApp|Twitterbot|Slackbot|Slack-ImgProxy|TelegramBot|Discordbot|Pinterest|redditbot|Embedly|SkypeUriPreview|vkShare|Iframely|Snapchat|Viber|LINE|bitlybot|Google-PageRenderer|Mastodon|Bluesky|Cardyb";
const BOT_RE = new RegExp(PREVIEW_BOTS, "i");
export const isPreviewBot = (ua) => BOT_RE.test(String(ua || ""));

export const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const clip = (s, n) => {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};
const httpsOnly = (u) => (typeof u === "string" && /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : null);
const naira = (n) => `₦${Number(n || 0).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

/** Tags for a store or product preview, from the backend share endpoints. */
export function shareMeta({ site, slug, productId, store, product }) {
  if (product) {
    const storeName = product.store?.name || store?.name || "";
    const title = clip(`${product.name}${storeName ? ` · ${storeName}` : ""}`, 90);
    const description = clip(product.description ? `${naira(product.price)}. ${product.description}` : `${naira(product.price)} at ${storeName || "this store"}. Order online, powered by BiManage.`, 200);
    return {
      title,
      description,
      url: `${site}/s/${encodeURIComponent(slug)}/products/${encodeURIComponent(productId)}`,
      image: httpsOnly(product.image) || httpsOnly(product.store?.logo) || `${site}/og-image.png`,
      type: "product",
      price: Number(product.price) || 0,
    };
  }
  if (store) {
    return {
      title: clip(store.name, 90),
      description: clip(store.description || `Shop ${store.name} online. Order and pay securely, powered by BiManage.`, 200),
      url: `${site}/s/${encodeURIComponent(slug)}`,
      image: httpsOnly(store.banner) || httpsOnly(store.logo) || `${site}/og-image.png`,
      type: "website",
    };
  }
  return null;
}

const TAGS_RE =
  /\s*<(?:title>[\s\S]*?<\/title>|meta\s+(?:name|property)="(?:description|robots|og:[^"]+|twitter:[^"]+)"[^>]*>|link\s+rel="canonical"[^>]*>)/gi;

/** The app's index.html with the site-wide tags swapped for this page's. */
export function injectMeta(html, m, site) {
  const e = escapeHtml;
  const image = m.image || `${site}/og-image.png`;
  const isSiteImage = image === `${site}/og-image.png`;
  const tags = [
    `<title>${e(m.title)} | BiManage</title>`,
    `<meta name="description" content="${e(m.description)}" />`,
    `<meta name="robots" content="index, follow" />`,
    `<link rel="canonical" href="${e(m.url)}" />`,
    `<meta property="og:type" content="${m.type === "product" ? "product" : "website"}" />`,
    `<meta property="og:site_name" content="BiManage" />`,
    `<meta property="og:locale" content="en_NG" />`,
    `<meta property="og:title" content="${e(m.title)}" />`,
    `<meta property="og:description" content="${e(m.description)}" />`,
    `<meta property="og:url" content="${e(m.url)}" />`,
    `<meta property="og:image" content="${e(image)}" />`,
    `<meta property="og:image:alt" content="${e(m.title)}" />`,
    ...(isSiteImage ? [`<meta property="og:image:width" content="1200" />`, `<meta property="og:image:height" content="630" />`] : []),
    ...(m.type === "product" ? [`<meta property="product:price:amount" content="${m.price}" />`, `<meta property="product:price:currency" content="NGN" />`] : []),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${e(m.title)}" />`,
    `<meta name="twitter:description" content="${e(m.description)}" />`,
    `<meta name="twitter:image" content="${e(image)}" />`,
  ].join("\n    ");
  const stripped = html.replace(TAGS_RE, "");
  return stripped.replace(/<head>/i, `<head>\n    ${tags}`);
}

/** A bare page with the tags, if the app's index.html can't be read. */
export const minimalHtml = (m, site) =>
  injectMeta(`<!doctype html><html lang="en-NG"><head><meta charset="UTF-8" /></head><body><a href="${escapeHtml(m?.url || site)}">Open on BiManage</a></body></html>`, m, site);

// ── sitemap.xml ──
export const STATIC_PAGES = ["/", "/login", "/register", "/reviews"];
const day = (d) => {
  const t = d ? new Date(d) : null;
  return t && !Number.isNaN(t.getTime()) ? t.toISOString().slice(0, 10) : null;
};

export function sitemapXml(site, data) {
  const url = (loc, lastmod, priority) =>
    `  <url><loc>${escapeHtml(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}${priority ? `<priority>${priority}</priority>` : ""}</url>`;
  const rows = [
    ...STATIC_PAGES.map((p) => url(`${site}${p}`, null, p === "/" ? "1.0" : p === "/register" ? "0.9" : "0.6")),
    ...(data?.stores || []).filter((s) => s && s.slug).map((s) => url(`${site}/s/${encodeURIComponent(s.slug)}`, day(s.updatedAt), "0.8")),
    ...(data?.products || []).filter((p) => p && p.slug && p.id).map((p) => url(`${site}/s/${encodeURIComponent(p.slug)}/products/${encodeURIComponent(p.id)}`, day(p.updatedAt), "0.7")),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}\n</urlset>\n`;
}

// ── robots.txt ── (the same private paths are noindex in vercel.json)
export const PRIVATE_PATHS = [
  "/admin", "/dashboard", "/onboarding", "/inventory", "/sales", "/orders", "/reports", "/analytics", "/invoices", "/projects", "/settings", "/social",
  "/store", "/messages", "/notifications", "/support", "/feli", "/subscription", "/wallet", "/bisupplynet", "/more", "/verify", "/forgot-password",
  "/reset-password", "/oauth", "/session-expired", "/account-closing", "/account-closed", "/invite", "/unsubscribe", "/ui-kit", "/reviews/write", "/reviews/submitted", "/api/",
];
export const robotsTxt = (site) =>
  [
    "User-agent: *",
    "Allow: /",
    // Prefix rules: "/store" (the merchant app) never matches "/s/…" (storefronts).
    ...PRIVATE_PATHS.map((p) => `Disallow: ${p}`),
    "Disallow: /s/*/cart",
    "Disallow: /s/*/checkout",
    "Disallow: /s/*/payment",
    "Disallow: /s/*/track",
    "Disallow: /s/*/chat",
    "",
    `Sitemap: ${site}/sitemap.xml`,
    "",
  ].join("\n");

/** fetch JSON with a hard timeout (Render can be cold-starting). */
export async function getJson(url, ms = 4500) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { accept: "application/json" } });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
