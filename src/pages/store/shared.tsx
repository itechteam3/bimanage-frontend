import type { ReactNode } from "react";
import { Navigate, NavLink } from "react-router-dom";
import { ListSkeleton } from "@/components/ui";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { cn } from "@/lib/cn";
import { useMyStore, type Store } from "@/lib/store/api";

/** Skeleton rows while the screen loads (not a lone spinner). */
export const Loading = ({ label }: { label?: string }) => <ListSkeleton label={label} />;

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
      <ul className="flex w-fit max-w-full flex-wrap gap-1 rounded-md bg-surface-pale p-1">
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

/** Reassuring second line under the "Store operations" strip (Figma 26 Nov). */
export const CALM = "You're in control. Review the details and take the next step when it feels right.";

/** "A small step for today" at the foot of the insights panel. */
export function SmallStep({ children = "Complete one storefront detail that helps customers feel confident." }: { children?: ReactNode }) {
  return (
    <div className="mt-6 flex flex-col gap-3">
      <p className="text-caption font-semibold uppercase text-ink-brand">A small step for today</p>
      <p className="text-body-sm text-ink-muted">{children}</p>
    </div>
  );
}

/** Shopper-facing link for a store (preview works for drafts). */
export const storefrontPath = (store: Pick<Store, "storeSlug">) => `/s/${store.storeSlug}`;
