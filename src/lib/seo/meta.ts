import { useEffect } from "react";
import { useLocation, useMatches } from "react-router-dom";

// Page titles, descriptions and share tags (2026-11-15).
// The base URL comes from ONE setting: VITE_PUBLIC_SITE_URL (index.html uses
// the same value at build time). Link previews of stores and products are
// rendered server-side by api/share.js for chat apps that don't run JS.

export const SITE_URL = String(import.meta.env.VITE_PUBLIC_SITE_URL || "https://bimanage-frontend.vercel.app").replace(/\/+$/, "");
export const SITE_NAME = "BiManage";
export const DEFAULT_TITLE = "BiManage: Run your whole business in one place";
export const DEFAULT_DESCRIPTION =
  "Sales, inventory, invoices, your own online store, trusted suppliers on BiSupplyNet and FELI, your AI assistant. BiManage helps Nigerian businesses run everything in one place.";
export const OG_IMAGE = `${SITE_URL}/og-image.png`;

export type PageMeta = { title?: string; description?: string; image?: string | null };

// Pages search engines may index. Everything else (the signed-in app,
// /admin, checkout, payment, tracking, chat) is noindex.
const PUBLIC = [/^\/$/, /^\/login\/?$/, /^\/register\/?$/, /^\/reviews\/?$/, /^\/contact\/?$/, /^\/faq\/?$/, /^\/terms\/?$/, /^\/privacy\/?$/, /^\/s\/[^/]+\/?$/, /^\/s\/[^/]+\/products\/[^/]+\/?$/];
export const isIndexable = (pathname: string) => PUBLIC.some((r) => r.test(pathname));

const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

function setTag(selector: string, create: () => HTMLElement, attr: string, value: string | null) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (value == null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}
const meta = (key: "name" | "property", k: string, v: string | null) =>
  setTag(
    `meta[${key}="${k}"]`,
    () => {
      const el = document.createElement("meta");
      el.setAttribute(key, k);
      return el;
    },
    "content",
    v,
  );

/** Writes the title, description, canonical, robots and share tags for a page. */
export function applyMeta(m: PageMeta, pathname: string) {
  const title = m.title ? `${clip(m.title, 60)} | ${SITE_NAME}` : DEFAULT_TITLE;
  const description = clip(m.description || DEFAULT_DESCRIPTION, 160);
  const image = m.image && /^https:\/\//i.test(m.image) ? m.image : OG_IMAGE;
  const index = isIndexable(pathname);
  const url = `${SITE_URL}${pathname === "/" ? "/" : pathname.replace(/\/+$/, "")}`;
  document.title = title;
  meta("name", "description", description);
  meta("name", "robots", index ? "index, follow" : "noindex, nofollow");
  meta("property", "og:title", title);
  meta("property", "og:description", description);
  meta("property", "og:url", url);
  meta("property", "og:image", image);
  meta("name", "twitter:title", title);
  meta("name", "twitter:description", description);
  meta("name", "twitter:image", image);
  setTag('link[rel="canonical"]', () => Object.assign(document.createElement("link"), { rel: "canonical" }), "href", index ? url : null);
}

// Page-level meta (a store's name, a product) beats the route's. The newest
// page entry wins; when it unmounts the one below it shows again.
const stack: { id: number; meta: PageMeta }[] = [];
let seq = 0;

/** Route-level meta from `handle.meta`; call once, in the root layout. */
export function useRouteMeta() {
  const { pathname } = useLocation();
  const matches = useMatches();
  const routeMeta = ([...matches].reverse().map((x) => (x.handle as { meta?: PageMeta } | undefined)?.meta).find(Boolean) ?? {}) as PageMeta;
  const key = JSON.stringify(routeMeta);
  useEffect(() => {
    applyMeta(stack.at(-1)?.meta ?? routeMeta, pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, key]);
}

/** Meta for a page whose title comes from data (a store, a product). */
export function usePageMeta(m: PageMeta | null) {
  const { pathname } = useLocation();
  const key = m ? JSON.stringify(m) : "";
  useEffect(() => {
    if (!m) return;
    const entry = { id: ++seq, meta: m };
    stack.push(entry);
    applyMeta(m, pathname);
    return () => {
      const i = stack.findIndex((e) => e.id === entry.id);
      if (i >= 0) stack.splice(i, 1);
      const top = stack.at(-1);
      if (top) applyMeta(top.meta, window.location.pathname);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, key]);
}
