import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { SellingChannels } from "./channels";

// Dashboard by selling channel (backend #120, #122):
// GET /dashboard?channel=all|retail|wholesale&from=YYYY-MM-DD&to=YYYY-MM-DD

export type DashChannel = "all" | "retail" | "wholesale";
export type RangeId = "7d" | "30d" | "90d" | "month";

export interface DashKpis {
  revenue: number;
  orders: number;
  averageOrder: number;
  unitsSold: number;
}

export interface ChannelDashboard {
  channel: DashChannel;
  range: { from: string; to: string };
  kpis: DashKpis;
  previous?: DashKpis;
  change?: { revenue: number | null; orders: number | null };
  byChannel: { retail: DashKpis; wholesale: DashKpis };
  series: Array<{ date: string; retail: number; wholesale: number }>;
  recentOrders: Array<{ id: string; ref: string | null; name: string | null; channel: "retail" | "wholesale"; total: number; status: string; link: string; at: string }>;
  wholesale: { bulkOrders: number; tradeBuyers: number; quotesAwaitingApproval: number | null; overdueTradeInvoices: number | null };
  inventory: { totalProducts: number; stockValue: number; lowStock: number; outOfStock: number };
  sellingChannels: SellingChannels | null;
  generatedAt: string;
}

export const RANGES: Array<{ id: RangeId; label: string }> = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "month", label: "This month" },
];

/** Lagos calendar dates (UTC+1 all year) for a range ending today. */
export function rangeDates(id: RangeId, now = new Date()) {
  const lagos = (d: Date) => new Date(d.getTime() + 60 * 60000).toISOString().slice(0, 10);
  const to = lagos(now);
  const days = id === "7d" ? 7 : id === "90d" ? 90 : 30;
  const from = id === "month" ? `${to.slice(0, 8)}01` : lagos(new Date(now.getTime() - (days - 1) * 86400000));
  return { from, to };
}

export function useChannelDashboard(channel: DashChannel, range: RangeId) {
  const { from, to } = rangeDates(range);
  return useQuery({
    queryKey: ["dashboard", "channel", channel, from, to],
    queryFn: () => api<ChannelDashboard>("/dashboard", { query: { channel, from, to } }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/** Up to 7 bars: one per day for a week, otherwise even groups of days. */
export function bucketSeries(series: ChannelDashboard["series"], max = 7) {
  if (series.length <= max) return series.map((p) => ({ label: new Date(`${p.date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }), retail: p.retail, wholesale: p.wholesale }));
  const size = Math.ceil(series.length / max);
  const out: Array<{ label: string; retail: number; wholesale: number }> = [];
  for (let i = 0; i < series.length; i += size) {
    const part = series.slice(i, i + size);
    const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    const first = part[0]!.date;
    const last = part[part.length - 1]!.date;
    // "4–8 Nov", or "30 Oct–3 Nov" when the group crosses a month.
    const start = first.slice(0, 7) === last.slice(0, 7) ? fmt(first).split(" ")[0] : fmt(first);
    out.push({ label: part.length > 1 ? `${start}–${fmt(last)}` : fmt(first), retail: part.reduce((s, p) => s + p.retail, 0), wholesale: part.reduce((s, p) => s + p.wholesale, 0) });
  }
  return out;
}
