import { apiUrl, getJson, siteUrl, sitemapXml } from "./_lib/seo.js";

// /sitemap.xml: the public pages, published stores and their listed products.
// If the backend is slow it still lists the public pages (cached briefly).
export default async function handler(req, res) {
  const data = await getJson(`${apiUrl()}/store/share-sitemap`, 8000);
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", data ? "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" : "public, max-age=0, s-maxage=120");
  res.status(200).send(sitemapXml(siteUrl(), data));
}
