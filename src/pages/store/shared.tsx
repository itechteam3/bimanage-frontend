import type { ReactNode } from "react";
import { Navigate, NavLink } from "react-router-dom";
import { Spinner } from "@/components/ui";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { cn } from "@/lib/cn";
import { useMyStore, type Store } from "@/lib/store/api";

export const Loading = () => (
  <div className="flex justify-center py-16 text-ink-brand" role="status">
    <Spinner className="size-8" />
    <span className="sr-only">Loading…</span>
  </div>
);

// Store sections (Figma 08.xx mobile tabs: Store · Products · Analytics · More).
const TABS: Array<[string, string, boolean?]> = [
  ["/store", "Overview", true],
  ["/store/products", "Products"],
  ["/store/orders", "Orders"],
  ["/store/templates", "Template"],
  ["/store/domain", "Domain"],
  ["/store/analytics", "Analytics"],
  ["/store/settings", "Settings"],
];

export function StoreTabs() {
  return (
    <nav aria-label="Online store" className="-mx-5 overflow-x-auto px-5 lg:mx-0 lg:px-0">
      <ul className="flex w-max gap-1 rounded-md bg-surface-pale p-1">
        {TABS.map(([to, label, end]) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn("flex min-h-11 items-center rounded-sm px-4 text-action font-semibold", isActive ? "bg-surface-card text-ink-brand shadow-card" : "text-ink-muted hover:text-ink-brand")
              }
            >
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** "STORE OPERATIONS / ELIJAH APPAREL" eyebrow used on every merchant store screen. */
export const opsEyebrow = (store?: Pick<Store, "storeName"> | null) => `Store operations / ${store?.storeName ?? "Your store"}`;

/** Renders children with the merchant's store; sends them to create one if they have none. */
export function WithStore({ children }: { children: (store: Store) => ReactNode }) {
  const store = useMyStore();
  if (store.isLoading) return <Loading />;
  if (store.error) return <ErrorNote error={store.error} fallback="We couldn't load your store. Please try again." onRetry={() => void store.refetch()} />;
  if (!store.data) return <Navigate to="/store/create" replace />;
  return <>{children(store.data)}</>;
}

/** Shopper-facing link for a store (preview works for drafts). */
export const storefrontPath = (store: Pick<Store, "storeSlug">) => `/s/${store.storeSlug}`;
