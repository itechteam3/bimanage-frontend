import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

// Product labels (backend #114): POST /inventory/products/label-codes gives
// label data and a stable in-store EAN-13 to products without a barcode, so a
// printed label always scans back to the product.

export interface LabelProduct {
  _id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  sellingPrice: number;
  barcodeGenerated: boolean;
}

export const MAX_LABEL_PRODUCTS = 200;

export function useLabelCodes() {
  return useMutation({
    mutationFn: async (ids: string[]) => (await api<{ products: LabelProduct[] }>("/inventory/products/label-codes", { method: "POST", body: { ids } })).products,
  });
}

export type SheetId = "a4" | "thermal";

/** Label sizes and how they sit on the page, in millimetres. */
export interface Sheet {
  id: SheetId;
  name: string;
  hint: string;
  page: { width: number; height: number };
  label: { width: number; height: number };
  columns: number;
  rows: number;
  /** Page margins (top, left) and gaps between labels. */
  margin: { top: number; left: number };
  gap: { x: number; y: number };
}

export const SHEETS: Record<SheetId, Sheet> = {
  // The common 24-per-sheet A4 sticker paper (3 × 8, 70 × 37 mm, no gaps).
  a4: { id: "a4", name: "A4 sticker sheet", hint: "24 labels per sheet, 70 × 37 mm (3 across, 8 down)", page: { width: 210, height: 297 }, label: { width: 70, height: 37 }, columns: 3, rows: 8, margin: { top: 0.5, left: 0 }, gap: { x: 0, y: 0 } },
  // Thermal label printers: one 50 × 25 mm label per page.
  thermal: { id: "thermal", name: "Thermal labels", hint: "50 × 25 mm, one label at a time (label printer)", page: { width: 50, height: 25 }, label: { width: 50, height: 25 }, columns: 1, rows: 1, margin: { top: 0, left: 0 }, gap: { x: 0, y: 0 } },
};

export const perPage = (s: Sheet) => s.columns * s.rows;

/** Repeat each product `copies` times and split into pages. */
export function paginate<T>(items: T[], copies: number, sheet: Sheet): T[][] {
  const all = items.flatMap((p) => Array.from({ length: Math.max(1, Math.min(100, Math.floor(copies) || 1)) }, () => p));
  const n = perPage(sheet);
  const pages: T[][] = [];
  for (let i = 0; i < all.length; i += n) pages.push(all.slice(i, i + n));
  return pages;
}

/** Which barcode symbology suits a code (EAN/UPC when it is one, otherwise Code 128). */
export function barcodeFormat(code: string): "EAN13" | "EAN8" | "UPC" | "CODE128" {
  const check = (d: string) => {
    const body = d.slice(0, -1);
    const sum = [...body].reverse().reduce((s, c, i) => s + Number(c) * (i % 2 ? 1 : 3), 0);
    return (10 - (sum % 10)) % 10 === Number(d[d.length - 1]);
  };
  if (/^\d{13}$/.test(code) && check(code)) return "EAN13";
  if (/^\d{8}$/.test(code) && check(code)) return "EAN8";
  if (/^\d{12}$/.test(code) && check(code)) return "UPC";
  return "CODE128";
}
