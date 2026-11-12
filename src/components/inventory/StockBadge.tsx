import { Status } from "@/components/ui";
import { stockState, type Product } from "@/lib/inventory/api";

const label = { ok: "In stock", low: "Low stock", out: "Sold out" } as const;
const tone = { ok: "success", low: "warning", out: "danger" } as const;

export function StockBadge({ product }: { product: Pick<Product, "stockQuantity" | "lowStockThreshold"> }) {
  const s = stockState(product);
  return <Status tone={tone[s]}>{label[s]}</Status>;
}
