import { robotsTxt, siteUrl } from "./_lib/seo.js";

// /robots.txt, built from the one site URL setting so the Sitemap line follows it.
export default function handler(req, res) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
  res.status(200).send(robotsTxt(siteUrl()));
}
