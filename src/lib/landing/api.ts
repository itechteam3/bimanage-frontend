import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { PlanInfo } from "@/lib/subscription/api";

// Public landing page data (no sign-in). PRICES ALWAYS COME FROM THE API
// (GET /public/plans) — nothing on the landing page hard-codes an amount.

export interface PublicPackage {
  id: string;
  name: string;
  amount: number;
  currency?: string;
  summary?: string;
  tagline?: string;
  days?: number;
}

export interface PublicPlans {
  currency?: string;
  plans: Array<Pick<PlanInfo, "id" | "name" | "description" | "price" | "credits" | "features" | "pricesConfirmed">>;
  startupPackages?: PublicPackage[];
}

export interface PublicStat {
  count: number;
  /** false when the number is too small to be worth showing (the server decides). */
  show: boolean;
}

export interface PublicStats {
  businesses: PublicStat;
  storesLive: PublicStat;
  ordersProcessed: PublicStat;
  reviews: { count: number; average: number; show: boolean };
  updatedAt?: string;
}

/**
 * Same-origin edge copy first (api/public.js on Vercel, cached so it answers
 * instantly while the backend wakes), then the backend directly.
 */
async function edgeFirst<T>(resource: "plans" | "stats", path: string): Promise<T> {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch(`/api/public?r=${resource}`, { signal: ctl.signal, headers: { accept: "application/json" } });
    clearTimeout(timer);
    if (r.ok && (r.headers.get("content-type") ?? "").includes("json")) return (await r.json()) as T;
  } catch {
    /* fall through to the backend */
  }
  return api<T>(path, { auth: false });
}

export const usePublicPlans = () =>
  useQuery({ queryKey: ["public", "plans"], queryFn: () => edgeFirst<PublicPlans>("plans", "/public/plans"), staleTime: 5 * 60_000 });

export const usePublicStats = () =>
  useQuery({ queryKey: ["public", "stats"], queryFn: () => edgeFirst<PublicStats>("stats", "/public/stats"), staleTime: 10 * 60_000, retry: false });

export type ContactTopic = "demo" | "sales" | "support" | "partnership" | "other";

export interface ContactInput {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  topic: ContactTopic;
  message: string;
  /** Honeypot: always empty for people. */
  website: string;
}

export const useContactRequest = () =>
  useMutation({ mutationFn: (body: ContactInput) => api<{ message: string }>("/public/contact", { method: "POST", body, auth: false }) });

export const useNewsletterSignup = () =>
  useMutation({ mutationFn: (body: { email: string; website: string }) => api<{ message: string }>("/public/newsletter", { method: "POST", body, auth: false }) });

export const useNewsletterAction = (action: "confirm" | "unsubscribe") =>
  useMutation({ mutationFn: (body: { e: string; t: string }) => api<{ message: string }>(`/public/newsletter/${action}`, { method: "POST", body, auth: false }) });
