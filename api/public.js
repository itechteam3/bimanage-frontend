import { apiUrl, getJson } from "./_lib/seo.js";

// Landing page data served from Vercel's edge cache, so pricing shows
// instantly even while the Render backend is waking up. The data still comes
// from the backend's public API (never hard-coded): it is refreshed every 5
// minutes, and the last good copy is served while refreshing.
//   /api/public?r=plans  → GET {API}/public/plans
//   /api/public?r=stats  → GET {API}/public/stats
const ALLOWED = { plans: "/public/plans", stats: "/public/stats" };

export default async function handler(req, res) {
  const path = ALLOWED[String(req.query.r || "")];
  if (!path) return res.status(404).json({ message: "Not found" });
  const data = await getJson(`${apiUrl()}${path}`, 25000);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (!data) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ message: "Plans are temporarily unavailable." });
  }
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=604800");
  return res.status(200).json(data);
}
