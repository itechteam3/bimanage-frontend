import { useEffect } from "react";

/**
 * Puts one schema.org JSON-LD block in <head> while the page is mounted
 * (replaced when `data` changes, removed on unmount). `id` keeps one block
 * per kind, so two pages can never both leave e.g. FAQPage markup behind.
 */
export function useJsonLd(id: string, data: object | null) {
  const json = data ? JSON.stringify(data).replace(/</g, "\\u003c") : null;
  useEffect(() => {
    if (!json) return;
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = id;
    el.textContent = json;
    document.getElementById(id)?.remove();
    document.head.appendChild(el);
    return () => el.remove();
  }, [id, json]);
}
