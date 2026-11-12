import { generatePath, type UIMatch } from "react-router-dom";

// Back navigation, declared per route in `handle.back`:
//
//   handle: { section: "Orders", back: back("/orders/:id", ORDERS) }
//
// - "Back" returns to the exact previous view (browser history, so filters,
//   search and scroll come back with it). With no in-app history (a link
//   opened in a new tab, a refresh after a direct visit) it goes to `parent`.
// - "Back to [Screen]" goes to the screen's start view from any depth. It
//   shows only when the page is more than one level below the start view.
// - A screen's start view has no `back`, so neither button shows there.

export interface Screen {
  label: string;
  to: string;
}

export interface BackMeta {
  /** Where "Back" goes without in-app history. May use route params (":id"). */
  parent: string;
  screen: Screen;
}

export const back = (parent: string, screen: Screen): BackMeta => ({ parent, screen });

export interface ResolvedBack {
  parentTo: string;
  screen: Screen;
  /** More than one level below the start view → also show "Back to [Screen]". */
  deep: boolean;
}

/** The deepest route's back metadata, with params filled in. */
export function resolveBack(matches: UIMatch[]): ResolvedBack | null {
  for (const m of [...matches].reverse()) {
    const meta = (m.handle as { back?: BackMeta } | undefined)?.back;
    if (!meta) continue;
    const fill = (path: string) => {
      try {
        return generatePath(path, m.params as Record<string, string>);
      } catch {
        return null;
      }
    };
    // Screens can use params too ("Back to Shop" → /s/:slug).
    const screen = { ...meta.screen, to: fill(meta.screen.to) ?? meta.screen.to };
    const parentTo = fill(meta.parent) ?? screen.to;
    return { parentTo, screen, deep: stripQuery(parentTo) !== stripQuery(screen.to) };
  }
  return null;
}

const stripQuery = (to: string) => (to.split(/[?#]/)[0] ?? "").replace(/\/+$/, "");

export { hasInAppHistory } from "./history";

// Screens (start views). Labels match the sidebar.
export const SCREENS = {
  signIn: { label: "Sign in", to: "/login" },
  createAccount: { label: "Create account", to: "/register" },
  dashboard: { label: "Dashboard", to: "/dashboard" },
  onboarding: { label: "Onboarding", to: "/onboarding" },
  inventory: { label: "Inventory", to: "/inventory" },
  sales: { label: "Sales", to: "/sales" },
  orders: { label: "Orders", to: "/orders" },
  projects: { label: "Projects", to: "/projects" },
  team: { label: "Team", to: "/settings/team" },
  settings: { label: "Settings", to: "/settings" },
  store: { label: "Online Store", to: "/store" },
  shop: { label: "Shop", to: "/s/:slug" },
} satisfies Record<string, Screen>;
