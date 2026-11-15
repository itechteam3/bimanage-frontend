// Every screen the layout check opens, with ids that exist in the fixtures
// (scripts/layout/mock-api.mjs). The list is built from the router itself
// (src/App.tsx and src/admin/routes.tsx), so a new route is checked
// automatically; a new :param needs an id here or the check fails loudly.
import { readFileSync } from "node:fs";

// :param → fixture id, by route prefix (first match wins).
const IDS = [
  [/^\/onboarding\/packages\//, { packageId: "starter" }],
  [/^\/inventory\//, { id: "p1" }],
  [/^\/customers\//, { id: "c1" }],
  [/^\/orders\//, { id: "o1" }],
  [/^\/invoices\//, { id: "i1" }],
  [/^\/projects\//, { id: "p1", taskId: "t1" }],
  [/^\/store\/products\//, { id: "p1" }],
  [/^\/store\/orders\//, { id: "so1" }],
  [/^\/messages\//, { id: "c1" }],
  [/^\/support\/tickets\//, { id: "t1" }],
  [/^\/support\/help\//, { id: "f1" }],
  [/^\/support\/service-requests\//, { id: "s1" }],
  [/^\/wallet\/transactions\//, { id: "wfail" }],
  [/^\/bisupplynet\/suppliers\//, { id: "w1" }],
  [/^\/bisupplynet\/checkout\//, { productId: "p1" }],
  [/^\/bisupplynet\/orders\//, { id: "o1" }],
  [/^\/bisupplynet\/disputes\//, { id: "d1" }],
  [/^\/bisupplynet\/sell\/listings\//, { id: "p1" }],
  [/^\/admin\/users\//, { id: "u9" }],
  [/^\/admin\/suppliers\//, { id: "w1" }],
  [/^\/admin\/bisupplynet\/disputes\//, { id: "d1" }],
  [/^\/admin\/bisupplynet\/orders\//, { id: "o1" }],
  [/^\/admin\/store-orders\//, { orderNumber: "BM-7K2Q-9MXA" }],
  [/^\/admin\/support\/tickets\//, { id: "t1" }],
  [/^\/admin\/support\/service-requests\//, { id: "s1" }],
  [/^\/admin\/announcements\//, { id: "n1" }],
];

// Signed-out screens (guest-only pages redirect when signed in).
const GUEST = new Set(["/", "/home", "/newsletter/confirm", "/newsletter/unsubscribe", "/login", "/register", "/verify", "/forgot-password", "/forgot-password/code", "/reset-password", "/reset-password/done",
  "/oauth/callback", "/session-expired", "/account-closing", "/account-closed", "/invite/accept", "/unsubscribe", "/reviews",
  "/admin/login", "/admin/login/verify", "/admin/login/setup", "/admin/invite", "/admin/forgot-password", "/admin/reset-password"]);
// Not product screens.
const SKIP = new Set(["/ui-kit"]);

const STOREFRONT = ["/s/elijahapparel", "/s/elijahapparel/products/p1", "/s/elijahapparel/cart", "/s/elijahapparel/checkout", "/s/elijahapparel/payment", "/s/elijahapparel/track", "/s/elijahapparel/chat"];
// Query strings some screens need to show their real content.
const QUERY = { "/newsletter/confirm": "?e=a&t=b", "/newsletter/unsubscribe": "?e=a&t=b", "/reset-password": "?token=x", "/admin/reset-password": "?token=x", "/admin/invite": "?token=x", "/invite/accept": "?token=x", "/unsubscribe": "?u=u1&topic=announcements&t=s" };

export function allRoutes(root = ".") {
  const app = readFileSync(`${root}/src/App.tsx`, "utf8");
  const admin = readFileSync(`${root}/src/admin/routes.tsx`, "utf8");
  const raw = [
    ...[...app.matchAll(/path: "([^"]+)"/g)].map((m) => m[1]),
    ...[...admin.matchAll(/path: "([^"]+)"/g)].map((m) => (m[1].startsWith("/") ? m[1] : `/admin/${m[1]}`)),
  ];
  const paths = [...new Set(raw)].filter((p) => p.startsWith("/") && !p.includes("*") && !p.startsWith("/s/") && !SKIP.has(p) && !p.startsWith("/ui-kit"));
  const out = [];
  for (const p of paths) {
    const ids = IDS.find(([re]) => re.test(p))?.[1] ?? {};
    const url = p.replace(/:(\w+)/g, (_, k) => {
      if (!(k in ids)) throw new Error(`layout routes: no fixture id for :${k} in ${p} (add it to scripts/layout/routes.mjs)`);
      return ids[k];
    });
    out.push({ path: p, url: url + (QUERY[p] ?? ""), guest: GUEST.has(p), admin: p.startsWith("/admin") && !GUEST.has(p) });
  }
  for (const u of STOREFRONT) out.push({ path: u, url: u, guest: true, admin: false });
  return out;
}

// Buttons that usually open a dialog; the check presses up to a few per page
// (never links, never "Delete"-style buttons outside a dialog flow).
export const DIALOG_OPENERS = /^(invite|add|new|create|edit|change|manage|remove|suspend|reinstate|reject|approve|request|resend|expire|switch back|report|upload|withdraw|cancel order|mark as|assign|reply|write a review|connect|compose|start|open a ticket|close account|regenerate|set up|apply|filter)/i;
