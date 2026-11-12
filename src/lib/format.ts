// Money and numbers, Nigerian conventions (₦, en-NG grouping).
const ngn = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

/** ₦1,280,400 */
export const naira = (amount: number | null | undefined) => ngn.format(Math.round(amount ?? 0)).replace("NGN", "₦");

/** ₦1.28m, ₦45k, ₦900 — for KPI tiles (Figma 03.02 "₦1.28m"). */
export function nairaCompact(amount: number | null | undefined): string {
  const n = amount ?? 0;
  const abs = Math.abs(n);
  const fmt = (v: number, s: string) => `₦${(+v.toFixed(2)).toString()}${s}`;
  if (abs >= 1e9) return fmt(n / 1e9, "bn");
  if (abs >= 1e6) return fmt(n / 1e6, "m");
  if (abs >= 1e4) return fmt(n / 1e3, "k");
  return naira(n);
}

export const count = (n: number | null | undefined) => new Intl.NumberFormat("en-NG").format(n ?? 0);

export const shortDate = (iso: string | Date | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "";
