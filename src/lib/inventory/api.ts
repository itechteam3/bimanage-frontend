import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiDownload } from "@/lib/api/client";

// Inventory endpoints (backend PR #7): products with SKU/barcode/threshold,
// audited stock adjustments, stats, CSV export, barcode lookup.

export interface Product {
  _id: string;
  name: string;
  brand?: string;
  sellingPrice: number;
  category?: string;
  description?: string;
  image?: string | null;
  stockQuantity: number;
  totalSold: number;
  sku?: string;
  barcode?: string;
  lowStockThreshold?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type StockState = "ok" | "low" | "out";
export const DEFAULT_THRESHOLD = 10;
export const thresholdOf = (p: Pick<Product, "lowStockThreshold">) => p.lowStockThreshold ?? DEFAULT_THRESHOLD;
export const stockState = (p: Pick<Product, "stockQuantity" | "lowStockThreshold">): StockState =>
  p.stockQuantity <= 0 ? "out" : p.stockQuantity <= thresholdOf(p) ? "low" : "ok";

export interface InventoryStats {
  totalProducts: number;
  totalInventoryValue: number;
  totalStock: number;
  totalSales: number;
  stockAvailability: { available: number; lowStock: number; outOfStock: number };
  lowStockProducts: Array<{ _id: string; name: string; sku?: string; category?: string; stock: number; threshold: number; status: "low" | "out" }>;
  topSelling: Array<Pick<Product, "_id" | "name" | "image" | "sellingPrice" | "totalSold" | "category">>;
}

export interface StockAdjustment {
  _id: string;
  type: "initial" | "increase" | "decrease" | "set";
  quantity: number;
  before: number;
  after: number;
  reason: string;
  location?: string;
  reference?: string;
  notes?: string;
  actor?: { _id: string; name: string };
  createdAt: string;
}

export interface ProductInput {
  name: string;
  category?: string;
  brand?: string;
  description?: string;
  sellingPrice: number;
  stockQuantity?: number; // create only
  sku?: string;
  barcode?: string;
  lowStockThreshold?: number;
  image?: string | null;
}

export interface AdjustInput {
  type: "increase" | "decrease" | "set";
  quantity: number;
  reason: string;
  location?: string;
  reference?: string;
  notes?: string;
}

export interface BarcodeInfo {
  barcode: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  image?: string | null;
  source: string;
}

export const inventoryKeys = {
  all: ["inventory"] as const,
  products: ["inventory", "products"] as const,
  product: (id: string) => ["inventory", "product", id] as const,
  stats: ["inventory", "stats"] as const,
  history: (id: string) => ["inventory", "history", id] as const,
};

export const useProducts = (enabled = true) =>
  useQuery({ queryKey: inventoryKeys.products, queryFn: () => api<Product[]>("/inventory/products"), enabled });

export const useProduct = (id: string | undefined) =>
  useQuery({ queryKey: inventoryKeys.product(id ?? ""), queryFn: () => api<Product>(`/inventory/products/${id}`), enabled: Boolean(id) });

export const useInventoryStats = (enabled = true) =>
  useQuery({ queryKey: inventoryKeys.stats, queryFn: () => api<InventoryStats>("/inventory/stats"), enabled });

export const useStockHistory = (id: string | undefined) =>
  useQuery({ queryKey: inventoryKeys.history(id ?? ""), queryFn: () => api<StockAdjustment[]>(`/inventory/products/${id}/adjustments`), enabled: Boolean(id) });

const useInvalidateInventory = () => {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: inventoryKeys.all });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
    void qc.invalidateQueries({ queryKey: ["onboarding", "steps"] });
  };
};

export function useCreateProduct() {
  const invalidate = useInvalidateInventory();
  return useMutation({ mutationFn: (input: ProductInput) => api<Product>("/inventory/products", { method: "POST", body: input }), onSuccess: invalidate });
}

export function useUpdateProduct(id: string) {
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: (input: Omit<ProductInput, "stockQuantity">) => api<Product>(`/inventory/products/${id}`, { method: "PUT", body: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteProduct() {
  const invalidate = useInvalidateInventory();
  return useMutation({ mutationFn: (id: string) => api(`/inventory/products/${id}`, { method: "DELETE" }), onSuccess: invalidate });
}

export function useAdjustStock(id: string) {
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: (input: AdjustInput) => api<{ product: Product; adjustment: StockAdjustment }>(`/inventory/products/${id}/adjust`, { method: "POST", body: input }),
    onSuccess: invalidate,
  });
}

export const uploadProductImage = (id: string, file: File) => {
  const form = new FormData();
  form.append("image", file);
  return api<{ image: string }>(`/upload/product/${id}`, { method: "POST", body: form });
};

/** Products in this business matching a barcode or SKU (then name). */
export const findInInventory = (code: string) => api<Product[]>(`/barcode/inventory/${encodeURIComponent(code)}`);

/** Public product databases, to prefill a new product. 404 when unknown. */
export const lookupBarcode = (code: string) => api<BarcodeInfo>(`/barcode/lookup/${encodeURIComponent(code)}`, { auth: false });

export const downloadInventoryCsv = (status?: "low") => apiDownload("/inventory/export", { query: { status } });
