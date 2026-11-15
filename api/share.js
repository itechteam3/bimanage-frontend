import { readFile } from "node:fs/promises";
import path from "node:path";
import { apiUrl, getJson, injectMeta, minimalHtml, shareMeta, siteUrl } from "./_lib/seo.js";

// Link previews for storefronts and products (WhatsApp, Facebook, LinkedIn,
// X, Slack…). vercel.json sends ONLY preview bots here (by user agent);
// shoppers get the normal app straight from the CDN. The backend share
// endpoints never count these as store or product views.
//   /s/:slug                      → ?slug=
//   /s/:slug/products/:productId  → ?slug=&productId=

let indexHtml = null;
async function appHtml(req) {
  if (indexHtml) return indexHtml;
  for (const p of [path.join(process.cwd(), "dist", "index.html"), path.join(process.cwd(), "index.html")]) {
    try {
      const html = await readFile(p, "utf8");
      if (html.includes('id="root"') && !html.includes("/src/main.tsx")) return (indexHtml = html);
    } catch {
      /* try the next one */
    }
  }
  try {
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const r = await fetch(`https://${host}/index.html`, { headers: { "user-agent": "bimanage-share" } });
    const html = r.ok ? await r.text() : "";
    if (html.includes('id="root"')) return (indexHtml = html);
  } catch {
    /* fall back to a bare page */
  }
  return null;
}

const SAFE = /^[A-Za-z0-9._-]{1,120}$/;

export default async function handler(req, res) {
  const site = siteUrl();
  const slug = String(req.query.slug || "");
  const productId = req.query.productId ? String(req.query.productId) : "";
  let m = null;
  if (SAFE.test(slug) && (!productId || SAFE.test(productId))) {
    const base = `${apiUrl()}/store/share/${encodeURIComponent(slug.toLowerCase())}`;
    if (productId) {
      const product = await getJson(`${base}/products/${encodeURIComponent(productId)}`);
      m = shareMeta({ site, slug, productId, product });
    }
    if (!m) {
      const store = await getJson(base);
      m = shareMeta({ site, slug, store });
    }
  }

  const html = await appHtml(req);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Vary", "User-Agent");
  res.setHeader("X-Robots-Tag", "index, follow");
  if (!m) {
    // Unknown, draft or closed store (or the backend is slow): the site-wide preview.
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60");
    return res.status(200).send(html || minimalHtml({ title: "BiManage", description: "Run your whole business in one place.", url: site, image: `${site}/og-image.png` }, site));
  }
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=86400");
  return res.status(200).send(html ? injectMeta(html, m, site) : minimalHtml(m, site));
}
