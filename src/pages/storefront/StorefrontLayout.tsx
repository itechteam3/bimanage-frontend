import { createContext, useContext, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useParams } from "react-router-dom";
import { IconBuildingStore, IconHelpCircle, IconMessageCircle, IconSearch, IconShoppingBag } from "@tabler/icons-react";
import { Spinner } from "@/components/ui";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { BackBar, HeaderBackButton } from "@/components/layout/BackNav";
import { tokenStore } from "@/lib/auth/tokenStore";
import { cn } from "@/lib/cn";
import { useCart, useMyStore, usePublicProducts, usePublicStore, useStoreProducts, type PublicProduct, type PublicStore, type StoreProduct } from "@/lib/store/api";

// Public storefront (Figma 08.11–08.20). Shoppers need no account. A draft
// store isn't public, so its owner sees a read-only preview built from their
// own store data instead.

interface Storefront {
  slug: string;
  store: PublicStore;
  /** The owner looking at their draft (or a preview): nothing can be bought. */
  preview: boolean;
}
const Ctx = createContext<Storefront | null>(null);
export const useStorefront = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStorefront outside StorefrontLayout");
  return v;
};

const asPublic = (p: StoreProduct): PublicProduct => ({
  _id: p._id,
  name: p.name,
  description: p.description,
  price: p.price,
  comparePrice: p.comparePrice,
  images: p.images,
  category: p.category,
  tags: p.tags,
  isFeatured: p.isFeatured,
  inStock: p.stockQuantity > 0,
  lowStock: p.stockQuantity > 0 && p.stockQuantity <= 5,
});

/** Products for the storefront: public API, or the owner's own list in preview. */
export function useShopProducts(q: Record<string, string>) {
  const { slug, preview } = useStorefront();
  const pub = usePublicProducts(slug, q);
  const own = useStoreProducts();
  if (!preview) return { data: pub.data?.products, isLoading: pub.isLoading, error: pub.error, refetch: pub.refetch };
  const term = (q.search ?? "").toLowerCase();
  const min = q.minPrice ? Number(q.minPrice) : -Infinity;
  const max = q.maxPrice ? Number(q.maxPrice) : Infinity;
  const data = (own.data ?? [])
    .filter((p) => p.isAvailable && (!q.category || p.category === q.category) && (!term || p.name.toLowerCase().includes(term)) && p.price >= min && p.price <= max)
    .map(asPublic);
  return { data, isLoading: own.isLoading, error: own.error, refetch: own.refetch };
}

export function useShopProduct(id: string) {
  const { preview } = useStorefront();
  const own = useStoreProducts();
  return preview ? (own.data ?? []).filter((p) => p._id === id).map(asPublic)[0] ?? null : undefined;
}

const Center = ({ children }: { children: ReactNode }) => <div className="flex min-h-dvh items-center justify-center bg-surface-page px-5">{children}</div>;

export function StorefrontLayout() {
  const { slug = "" } = useParams();
  const pub = usePublicStore(slug);
  const signedIn = Boolean(tokenStore.get());
  const mine = useMyStore();
  const ownDraft = pub.data === null && signedIn && mine.data?.storeSlug === slug;

  if (pub.isLoading || (pub.data === null && signedIn && mine.isLoading)) {
    return (
      <Center>
        <span role="status" className="text-ink-brand">
          <Spinner className="size-8" />
          <span className="sr-only">Opening store…</span>
        </span>
      </Center>
    );
  }
  if (pub.error) {
    return (
      <Center>
        <ErrorNote error={pub.error} fallback="We couldn't open this store. Please try again." onRetry={() => void pub.refetch()} />
      </Center>
    );
  }

  let value: Storefront | null = null;
  if (pub.data) value = { slug, store: pub.data, preview: false };
  else if (ownDraft && mine.data) {
    const s = mine.data;
    value = {
      slug,
      preview: true,
      store: { _id: s._id, storeName: s.storeName, storeSlug: s.storeSlug, description: s.description, logo: s.logo, banner: s.banner, category: s.category, contactEmail: s.contactEmail, contactPhone: s.contactPhone, address: s.address, template: s.template, deliveryFee: s.deliveryFee, freeDeliveryAbove: s.freeDeliveryAbove, acceptingOrders: false, paymentsComingSoon: false },
    };
  }

  if (!value) {
    return (
      <Center>
        <div className="flex max-w-md flex-col items-center gap-3 text-center">
          <IconBuildingStore aria-hidden="true" className="size-10 text-ink-brand" />
          <h1 className="text-title-md text-ink-strong">This store isn't available</h1>
          <p className="text-body-lg text-ink-muted">Check the link, or the store may not be open yet.</p>
        </div>
      </Center>
    );
  }

  return (
    <Ctx.Provider value={value}>
      <Shell>
        <Outlet />
      </Shell>
    </Ctx.Provider>
  );
}

function BagCount() {
  const { slug, preview } = useStorefront();
  const cart = useCart(slug);
  const n = preview ? 0 : cart.data?.itemCount ?? 0;
  return <>{n > 0 ? ` (${n})` : ""}</>;
}

/** Floating "Chat with the store" (12.03); hidden on the chat page and in preview. */
function ChatButton() {
  const { slug, preview } = useStorefront();
  const { pathname } = useLocation();
  if (preview || pathname.endsWith("/chat")) return null;
  return (
    <Link
      to={`/s/${slug}/chat`}
      className="fixed bottom-6 right-5 z-30 flex min-h-12 items-center gap-2 rounded-full bg-brand-navy px-5 text-action font-semibold text-ink-on-brand shadow-floating hover:opacity-95 lg:bottom-8 lg:right-8"
    >
      <IconMessageCircle aria-hidden="true" className="size-5" /> Chat with the store
    </Link>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { slug, store, preview } = useStorefront();
  const base = `/s/${slug}`;
  const premium = store.template === "premium";
  return (
    <div className="min-h-dvh bg-surface-page">
      <a href="#shop-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface-card focus:px-4 focus:py-2">
        Skip to content
      </a>
      {preview && (
        <p role="status" className="bg-warning-bg px-5 py-2 text-center text-body-sm font-semibold text-ink-strong">
          Preview: only you can see this store until you publish it. Buying is turned off. <Link to="/store" className="underline">Back to your store</Link>
        </p>
      )}
      <header className={cn("sticky top-0 z-20 border-b border-line-card", premium ? "bg-brand-navy text-ink-on-brand" : "bg-surface-card")}>
        <div className="mx-auto flex h-mobile-header max-w-6xl items-center justify-between gap-3 px-5 lg:h-header">
          <div className="flex min-w-0 items-center gap-2">
            <HeaderBackButton tone={premium ? "on-brand" : "plain"} />
            <Link to={base} className={cn("flex min-w-0 items-center gap-2 text-title-sm font-semibold uppercase tracking-wide", premium ? "text-ink-on-brand" : "text-ink-brand")}>
              {store.logo && <img src={store.logo} alt="" className="size-8 rounded-md object-cover" />}
              <span className="truncate">{store.storeName}</span>
            </Link>
          </div>
          <nav aria-label="Store" className={cn("hidden items-center gap-6 text-action font-semibold lg:flex", premium ? "text-ink-on-brand" : "text-ink-strong")}>
            <NavLink to={base} end className="hover:underline">
              Shop
            </NavLink>
            <NavLink to={`${base}/track`} className="hover:underline">
              Track order
            </NavLink>
            <NavLink to={`${base}/chat`} className="hover:underline">
              Chat
            </NavLink>
            <Link to={`${base}?focus=search`} className="flex items-center gap-1 hover:underline">
              <IconSearch aria-hidden="true" className="size-4" /> Search
            </Link>
            <NavLink to={`${base}/cart`} className="flex items-center gap-1 hover:underline">
              <IconShoppingBag aria-hidden="true" className="size-4" /> Bag
              <BagCount />
            </NavLink>
          </nav>
          <Link to={`${base}/cart`} className={cn("flex min-h-11 items-center gap-1 text-action font-semibold lg:hidden", premium ? "text-ink-on-brand" : "text-ink-brand")}>
            <IconShoppingBag aria-hidden="true" className="size-5" /> Bag
            <BagCount />
          </Link>
        </div>
      </header>
      <ChatButton />
      <main id="shop-main" className="mx-auto w-full max-w-6xl px-5 pb-28 pt-5 lg:pb-12 lg:pt-6">
        <BackBar />
        {children}
        <p className="mt-10 rounded-xl bg-success-bg px-4 py-3 text-body-sm font-semibold text-ink-brand">Secure Paystack payment · Guest checkout · Order tracking without an account</p>
      </main>
      <ShopTabs base={base} />
    </div>
  );
}

// Mobile tabs (08.11 mobile: Shop · Search · Bag · Help).
function ShopTabs({ base }: { base: string }) {
  const tabs: Array<[string, string, typeof IconBuildingStore, boolean?]> = [
    [base, "Shop", IconBuildingStore, true],
    [`${base}?focus=search`, "Search", IconSearch],
    [`${base}/cart`, "Bag", IconShoppingBag],
    [`${base}/track`, "Help", IconHelpCircle],
  ];
  return (
    <nav aria-label="Shop quick links" className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 mx-auto flex h-mobile-tab-bar max-w-mobile-tab-bar-w items-center gap-1 rounded-tab-bar border border-line-subtle bg-surface-card px-2 shadow-raised lg:hidden">
      {tabs.map(([to, label, Icon, end]) => (
        <NavLink key={label} to={to} end={end} className={({ isActive }) => cn("flex h-mobile-tab flex-1 flex-col items-center justify-center gap-0.5 rounded-tab text-body-sm font-semibold", isActive && label !== "Search" ? "bg-surface-tonal text-ink-brand" : "text-ink-muted")}>
          <Icon aria-hidden="true" className="size-icon" stroke={1.75} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
