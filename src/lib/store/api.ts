import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api, apiDownload } from "@/lib/api/client";

// Online store (Figma 08.xx). Merchant side uses the signed-in session;
// the storefront (/s/:slug) is public and identifies a guest cart with the
// X-Session-ID header the first "add to bag" hands back.

// ── Types ─────────────────────────────────────────────────────────────────

export type TemplateKey = "basic" | "standard" | "premium";
export const STORE_CATEGORIES: Array<[string, string]> = [
  ["fashion", "Fashion"],
  ["electronics", "Electronics"],
  ["beauty", "Beauty"],
  ["food", "Food & drinks"],
  ["home", "Home"],
  ["health", "Health"],
  ["books", "Books & stationery"],
  ["tools", "Tools"],
  ["sports", "Sports"],
  ["baby", "Baby & kids"],
  ["other", "Other"],
];

export const PRODUCT_CATEGORIES: Array<[string, string]> = [
  ["fashion_men", "Men's clothing"],
  ["fashion_women", "Women's clothing"],
  ["fashion_kids", "Kids' clothing"],
  ["shoes_men", "Men's shoes"],
  ["shoes_women", "Women's shoes"],
  ["shoes_kids", "Kids' shoes"],
  ["bags_accessories", "Bags & accessories"],
  ["underwear", "Underwear"],
  ["electronics_phones", "Phones"],
  ["electronics_laptops", "Laptops"],
  ["electronics_accessories", "Electronics accessories"],
  ["electronics_audio", "Audio"],
  ["electronics_tv", "TV"],
  ["beauty_skincare", "Skincare"],
  ["beauty_makeup", "Makeup"],
  ["beauty_hair", "Hair"],
  ["beauty_perfume", "Perfume"],
  ["beauty_body", "Body care"],
  ["food_packaged", "Packaged food"],
  ["food_drinks", "Drinks"],
  ["food_snacks", "Snacks"],
  ["food_ingredients", "Ingredients"],
  ["home_furniture", "Furniture"],
  ["home_kitchen", "Kitchen"],
  ["home_bedding", "Bedding"],
  ["home_decor", "Decor"],
  ["health_supplements", "Supplements"],
  ["health_medical", "Medical"],
  ["health_fitness", "Fitness"],
  ["books_stationery", "Books & stationery"],
  ["tools_equipment", "Tools & equipment"],
  ["sports_entertainment", "Sports & entertainment"],
  ["baby_kids", "Baby & kids"],
  ["other", "Other"],
];
export const categoryLabel = (key?: string) => PRODUCT_CATEGORIES.find(([k]) => k === key)?.[1] ?? "Other";

export interface Store {
  _id: string;
  storeName: string;
  storeSlug: string;
  storeUrl: string;
  description?: string;
  logo?: string | null;
  banner?: string | null;
  category: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  deliveryFee: number;
  freeDeliveryAbove: number | null;
  template: TemplateKey;
  isPublished?: boolean;
  status: "draft" | "published";
  publicUrl: string;
  allowedTemplates: TemplateKey[];
  canPublish: boolean;
  customDomain?: string | null;
}

export interface ChecklistStep {
  key: "identity" | "template" | "products" | "checkout";
  label: string;
  done: boolean;
  value: string;
  detail: string;
  required: boolean;
}

export interface LaunchChecklist {
  steps: ChecklistStep[];
  completed: number;
  total: number;
  percent: number;
  products: { total: number; published: number };
  template: { key: TemplateKey; name: string; allowed: TemplateKey[] };
  plan: { tier: string; name: string; canPublish: boolean };
  status: "draft" | "published";
  publishedAt: string | null;
  canPublish: boolean;
  blockers: string[];
  storeUrl: string;
  paymentsEnabled: boolean;
  guestCheckout: boolean;
}

export interface StoreProduct {
  _id: string;
  name: string;
  sku?: string;
  description?: string;
  price: number;
  comparePrice?: number | null;
  images: string[];
  category: string;
  tags?: string[];
  stockQuantity: number;
  isAvailable: boolean;
  isFeatured?: boolean;
  inventoryProduct?: string | null;
  totalSold: number;
  totalViews: number;
  createdAt: string;
  updatedAt?: string;
}

export interface ProductInput {
  name: string;
  sku: string;
  price: number;
  comparePrice?: number | null;
  category: string;
  description?: string;
  stockQuantity?: number;
  images: string[];
  isAvailable: boolean;
}

export interface BulkResult {
  row: number;
  status: "created" | "failed";
  errors?: Array<{ field: string; message: string }>;
  product?: StoreProduct;
}

export interface TemplateOption {
  key: TemplateKey;
  name: string;
  allowed: boolean;
}

export interface StoreAnalytics {
  range: { key: string; from: string; to: string; days: number };
  revenue: number;
  revenueChange: number | null;
  orders: number;
  ordersChange: number | null;
  fulfilled: number;
  averageOrderValue: number;
  cancelled: number;
  storeViews: number;
  productViews: number;
  topProduct: TopProduct | null;
  topProducts: TopProduct[];
  series: Array<{ date: string; revenue: number; orders: number }>;
  payouts: { pending: number; available: number };
}
export interface TopProduct {
  productId: string;
  name: string;
  image: string | null;
  sold: number;
  revenue: number;
}
export type AnalyticsRange = "7d" | "30d" | "90d";

export interface DomainState {
  bimanageAddress: string;
  customDomain: string | null;
  verified: boolean;
  verifiedAt: string | null;
  status: "none" | "awaiting_dns" | "verified";
  /** BiTechTeam adds the domain to the Vercel project (absent on older servers). */
  hosting?: "none" | "pending" | "added";
  hostingAddedAt?: string | null;
  ssl: string | null;
  live?: boolean;
  dnsInstructions: { type: "CNAME"; host: string; name: string; value: string; ttl: number; note: string } | null;
  planAllows?: boolean;
}

// Public (shopper) shapes
export interface PublicStore {
  _id: string;
  storeName: string;
  storeSlug: string;
  description?: string;
  logo?: string | null;
  banner?: string | null;
  category: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  template: TemplateKey;
  deliveryFee: number;
  freeDeliveryAbove: number | null;
  acceptingOrders: boolean;
  paymentsComingSoon: boolean;
}

export interface PublicProduct {
  _id: string;
  name: string;
  description?: string;
  price: number;
  comparePrice?: number | null;
  images: string[];
  category: string;
  tags?: string[];
  isFeatured?: boolean;
  minimumOrderQuantity?: number;
  inStock: boolean;
  lowStock: boolean;
}

export interface Cart {
  items: Array<{ product: PublicProduct; quantity: number; requested: number; available: number; lineTotal: number }>;
  itemCount: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  freeDeliveryAbove: number | null;
  sessionId?: string;
}

export type StoreOrderStatus = "pending" | "payment_failed" | "expired" | "payment_confirmed" | "processing" | "shipped" | "delivered" | "completed" | "cancelled" | "refunded";

export interface PublicOrder {
  trackingNo: string;
  status: StoreOrderStatus;
  isPaid: boolean;
  paidAt?: string | null;
  customerName: string;
  customerEmail: string;
  deliveryAddress: string;
  city?: string;
  state?: string;
  items: Array<{ productName: string; productImage?: string; price: number; quantity: number; total: number }>;
  subtotal: number;
  deliveryFee: number;
  total: number;
  statusHistory: Array<{ status: StoreOrderStatus; at: string }>;
  createdAt: string;
  store?: { storeName: string; storeSlug: string; contactEmail: string | null; contactPhone: string | null };
}

export interface CheckoutInput {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: string;
  city: string;
  state: string;
  notes?: string;
}

/** The server says online payment isn't set up (503 paymentsUnavailable). */
export const isPaymentsUnavailable = (err: unknown) => err instanceof ApiError && err.status === 503 && Boolean((err.data as { paymentsUnavailable?: boolean }).paymentsUnavailable);

// ── Keys ──────────────────────────────────────────────────────────────────

export const storeKeys = {
  mine: ["store", "mine"] as const,
  checklist: ["store", "checklist"] as const,
  products: ["store", "products"] as const,
  templates: ["store", "templates"] as const,
  domain: ["store", "domain"] as const,
  analytics: (range: string) => ["store", "analytics", range] as const,
  pub: (slug: string) => ["storefront", slug] as const,
  pubProducts: (slug: string, q: Record<string, string>) => ["storefront", slug, "products", q] as const,
  pubProduct: (slug: string, id: string) => ["storefront", slug, "product", id] as const,
  cart: (slug: string) => ["storefront", slug, "cart"] as const,
};

// ── Merchant ──────────────────────────────────────────────────────────────

/** null = signed in but no store yet. */
export function useMyStore() {
  return useQuery({
    queryKey: storeKeys.mine,
    queryFn: async () => {
      try {
        return await api<Store>("/store/my-store");
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
  });
}

function useInvalidateStore() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["store"] });
}

export function useCreateStore() {
  const done = useInvalidateStore();
  return useMutation({
    mutationFn: (body: { storeName: string; description: string; category: string; contactEmail: string; contactPhone?: string }) =>
      api<{ store: Store; storeUrl: string }>("/store/create", { method: "POST", body }),
    onSuccess: done,
  });
}

export function useUpdateStore() {
  const done = useInvalidateStore();
  return useMutation({ mutationFn: (body: Partial<Store>) => api<Store>("/store/my-store", { method: "PUT", body }), onSuccess: done });
}

export const useLaunchChecklist = (enabled = true) => useQuery({ queryKey: storeKeys.checklist, queryFn: () => api<LaunchChecklist>("/store/launch-checklist"), enabled });

export function usePublish() {
  const done = useInvalidateStore();
  return useMutation({ mutationFn: (publish: boolean) => api<{ message: string }>(publish ? "/store/publish" : "/store/unpublish", { method: "POST" }), onSuccess: done });
}

export const useTemplates = () => useQuery({ queryKey: storeKeys.templates, queryFn: () => api<{ current: TemplateKey | null; plan: string; templates: TemplateOption[] }>("/store/templates") });

export function useSetTemplate() {
  const done = useInvalidateStore();
  return useMutation({ mutationFn: (template: TemplateKey) => api<Store>("/store/template", { method: "PUT", body: { template } }), onSuccess: done });
}

export const useStoreProducts = () => useQuery({ queryKey: storeKeys.products, queryFn: () => api<StoreProduct[]>("/store/products") });

export function useSaveStoreProduct(id?: string) {
  const done = useInvalidateStore();
  return useMutation({
    mutationFn: (body: Partial<ProductInput>) => (id ? api<StoreProduct>(`/store/products/${id}`, { method: "PUT", body }) : api<StoreProduct>("/store/products", { method: "POST", body })),
    onSuccess: done,
  });
}

export function useDeleteStoreProduct() {
  const done = useInvalidateStore();
  return useMutation({ mutationFn: (id: string) => api(`/store/products/${id}`, { method: "DELETE" }), onSuccess: done });
}

export function useBulkUpload() {
  const done = useInvalidateStore();
  return useMutation({
    mutationFn: async (products: Array<Partial<ProductInput>>) => {
      try {
        return await api<{ message: string; created: number; failed: number; results: BulkResult[] }>("/store/products/bulk", { method: "POST", body: { products } });
      } catch (err) {
        // "Nothing could be added" still carries the per-row results.
        const data = err instanceof ApiError ? (err.data as { results?: BulkResult[]; created?: number; failed?: number; message?: string }) : null;
        if (data?.results) return { message: data.message ?? "", created: data.created ?? 0, failed: data.failed ?? data.results.length, results: data.results };
        throw err;
      }
    },
    onSuccess: done,
  });
}

export function useSyncInventory() {
  const done = useInvalidateStore();
  return useMutation({
    mutationFn: (productIds: string[]) => api<{ message: string; results: Array<{ product: StoreProduct; action: "created" | "updated" }> }>("/store/products/sync-inventory", { method: "POST", body: { productIds } }),
    onSuccess: done,
  });
}

/** Upload one photo; returns its URL for the product's `images`. */
export async function uploadStoreImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("image", file);
  const res = await api<{ url: string }>("/upload/store-image", { method: "POST", body: form });
  return res.url;
}

export const useStoreAnalytics = (range: AnalyticsRange) =>
  useQuery({ queryKey: storeKeys.analytics(range), queryFn: () => api<StoreAnalytics>("/store/analytics", { query: { range } }), placeholderData: keepPreviousData });

export const downloadStoreReport = (range: AnalyticsRange) => apiDownload("/store/analytics/export", { query: { range } });

export const useDomain = () => useQuery({ queryKey: storeKeys.domain, queryFn: () => api<DomainState>("/store/custom-domain") });

export function useDomainActions() {
  const qc = useQueryClient();
  const set = (data: DomainState) => qc.setQueryData(storeKeys.domain, (old: DomainState | undefined) => ({ ...old, ...data }));
  return {
    save: useMutation({ mutationFn: (domain: string) => api<DomainState>("/store/custom-domain", { method: "POST", body: { domain } }), onSuccess: set }),
    verify: useMutation({
      mutationFn: async () => {
        try {
          return await api<DomainState & { message: string }>("/store/verify-domain", { method: "POST" });
        } catch (err) {
          // 400 "not found yet" still returns the current state.
          if (err instanceof ApiError && err.status === 400 && (err.data as { verified?: boolean }).verified === false) {
            set(err.data as unknown as DomainState);
          }
          throw err;
        }
      },
      onSuccess: set,
    }),
    remove: useMutation({ mutationFn: () => api<DomainState>("/store/custom-domain", { method: "DELETE" }), onSuccess: set }),
  };
}

// ── Storefront (public) ───────────────────────────────────────────────────

const SESSION_KEY = (slug: string) => `bimanage.cart.${slug}`;
export const cartSession = {
  get(slug: string): string | null {
    try {
      return localStorage.getItem(SESSION_KEY(slug));
    } catch {
      return null;
    }
  },
  set(slug: string, id: string) {
    try {
      localStorage.setItem(SESSION_KEY(slug), id);
    } catch {
      /* private mode: cart lasts for this page only */
    }
  },
};
const shopperHeaders = (slug: string): Record<string, string> => {
  const id = cartSession.get(slug);
  return id ? { "X-Session-ID": id } : {};
};
// Shoppers never send the merchant's token: the storefront is the same for everyone.
const shopper = <T,>(slug: string, path: string, opts: Parameters<typeof api>[1] = {}) => api<T>(path, { ...opts, auth: false, headers: { ...shopperHeaders(slug), ...(opts.headers ?? {}) } });

export const usePublicStore = (slug: string) =>
  useQuery({
    queryKey: storeKeys.pub(slug),
    queryFn: async () => {
      try {
        return await api<PublicStore>(`/store/${encodeURIComponent(slug)}`, { auth: false });
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    staleTime: 5 * 60_000,
  });

export const usePublicProducts = (slug: string, q: Record<string, string>) =>
  useQuery({
    queryKey: storeKeys.pubProducts(slug, q),
    queryFn: () => api<{ products: PublicProduct[]; total: number; page: number; totalPages: number }>(`/store/${encodeURIComponent(slug)}/products`, { auth: false, query: { limit: "48", ...q } }),
    placeholderData: keepPreviousData,
  });

export const usePublicProduct = (slug: string, id: string) =>
  useQuery({
    queryKey: storeKeys.pubProduct(slug, id),
    queryFn: async () => {
      try {
        return await api<PublicProduct>(`/store/${encodeURIComponent(slug)}/products/${encodeURIComponent(id)}`, { auth: false });
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
  });

export const useCart = (slug: string) => useQuery({ queryKey: storeKeys.cart(slug), queryFn: () => shopper<Cart>(slug, `/cart/${encodeURIComponent(slug)}`) });

export function useCartActions(slug: string) {
  const qc = useQueryClient();
  const set = (cart: Cart) => {
    if (cart.sessionId) cartSession.set(slug, cart.sessionId);
    qc.setQueryData(storeKeys.cart(slug), cart);
  };
  const base = `/cart/${encodeURIComponent(slug)}`;
  return {
    add: useMutation({ mutationFn: (v: { productId: string; quantity: number }) => shopper<Cart>(slug, `${base}/add`, { method: "POST", body: v }), onSuccess: set }),
    update: useMutation({ mutationFn: (v: { productId: string; quantity: number }) => shopper<Cart>(slug, `${base}/update`, { method: "PUT", body: v }), onSuccess: set }),
    remove: useMutation({ mutationFn: (productId: string) => shopper<Cart>(slug, `${base}/remove/${encodeURIComponent(productId)}`, { method: "DELETE" }), onSuccess: set }),
  };
}

export const startCheckout = (slug: string, body: CheckoutInput) =>
  shopper<{ order: PublicOrder; authorizationUrl: string; reference: string }>(slug, `/store-orders/${encodeURIComponent(slug)}/checkout`, { method: "POST", body });

export const verifyStorePayment = (slug: string, reference: string) =>
  shopper<{ status: "paid" | "failed" | "pending"; order: PublicOrder }>(slug, "/store-orders/verify-payment", { method: "POST", body: { reference } });

export const retryStorePayment = (slug: string, trackingNo: string, email: string) =>
  shopper<{ order: PublicOrder; authorizationUrl: string }>(slug, `/store-orders/${encodeURIComponent(slug)}/orders/${encodeURIComponent(trackingNo)}/retry`, { method: "POST", body: { email } });

export const trackStoreOrder = (orderNumber: string, email: string) => api<PublicOrder>("/store-orders/track", { auth: false, query: { orderNumber, email } });

/** Leave the app for Paystack (a separate object so tests can stub it). */
export const browser = { go: (url: string) => window.location.assign(url) };
