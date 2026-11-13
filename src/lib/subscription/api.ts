import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiDownload } from "@/lib/api/client";
import type { Access, Feature, PlanId } from "@/config/plans";

// Subscriptions & usage (Figma 07.01–07.11, backend #32/#33).
// PRICES ALWAYS COME FROM THE API (GET /subscriptions/plans, /quote): they
// are provisional and set on Render, so nothing here hard-codes an amount.

export type BillingCycle = "monthly" | "yearly";
export type PaidPlan = Exclude<PlanId, "freemium">;

export interface PlanInfo {
  id: PlanId;
  name: string;
  price: { monthly: number; yearly: number };
  description: string;
  features: Partial<Record<Feature, Access>>;
  credits: number | "unlimited";
  creditPrices?: CreditPrice[];
  /** false = provisional prices, still being agreed. */
  pricesConfirmed: boolean;
  paymentsAvailable: boolean;
}

export interface CreditPrice {
  action: string;
  label: string;
  cost: number;
  /** Charged on the first use of the day only. */
  perDay?: boolean;
}

export interface Usage {
  unlimited: boolean;
  credits: { daily: number; used: number; remaining: number; resetsAt: string; timezone: string };
  dayPasses: string[];
  byAction: Array<{ action: string; label: string; times: number; credits: number }>;
  recent: Array<{ action: string; label: string; credits: number; remaining: number; at: string }>;
  prices: CreditPrice[];
}

export type QuoteType = "subscribe" | "upgrade" | "downgrade" | "cancel" | "resume" | "same";
export interface Quote {
  type: QuoteType;
  plan: PlanId;
  billingCycle: BillingCycle;
  currentPlan: PlanId;
  currentBillingCycle: BillingCycle | null;
  currency: "NGN";
  pricesConfirmed: boolean;
  paymentsAvailable: boolean;
  amount?: number;
  effectiveAt?: string | null;
  periodEnd?: string;
  nextChargeAt?: string | null;
  nextChargeAmount?: number;
  notes?: string[];
  message: string;
}

export interface BillingRow {
  id: string;
  reference: string;
  description: string;
  purpose: "subscription" | "startup_package";
  kind: "initial" | "upgrade" | "renewal" | null;
  amount: number;
  currency: string;
  status: "success" | "failed" | "pending" | "abandoned";
  mode: "test" | "live" | null;
  paidAt: string | null;
  createdAt: string;
  periodStart: string | null;
  periodEnd: string | null;
  failureReason: string | null;
  hasReceipt: boolean;
}

export const subKeys = {
  all: ["subscription"] as const,
  current: ["subscription", "current"] as const,
  plans: ["subscription", "plans"] as const,
  usage: ["subscription", "usage"] as const,
  quote: (plan: string, cycle: string) => ["subscription", "quote", plan, cycle] as const,
  billing: (page: number) => ["subscription", "billing", page] as const,
};

export const usePlans = () => useQuery({ queryKey: subKeys.plans, queryFn: () => api<PlanInfo[]>("/subscriptions/plans") });
export const useUsage = () => useQuery({ queryKey: subKeys.usage, queryFn: () => api<Usage>("/subscriptions/usage") });
export const useQuote = (plan: string, cycle: string, enabled = true) =>
  useQuery({ queryKey: subKeys.quote(plan, cycle), queryFn: () => api<Quote>("/subscriptions/quote", { query: { plan, billingCycle: cycle } }), enabled, staleTime: 0 });
export const useBillingHistory = (page: number) =>
  useQuery({ queryKey: subKeys.billing(page), queryFn: () => api<{ payments: BillingRow[]; total: number; page: number; totalPages: number }>("/subscriptions/billing-history", { query: { page } }), placeholderData: keepPreviousData });

export const startSubscriptionCheckout = (plan: PlanId, billingCycle: BillingCycle) =>
  api<{ authorizationUrl: string; reference: string; quote: Quote; mode: "test" | "live" | null }>("/subscriptions/checkout", { method: "POST", body: { plan, billingCycle } });
export const verifySubscriptionPayment = (reference: string) =>
  api<{ status: "paid" | "pending" | "failed"; payment: BillingRow; failureReason: string | null }>("/subscriptions/verify", { query: { reference } });
export const downloadSubscriptionReceipt = (id: string) => apiDownload(`/subscriptions/billing-history/${encodeURIComponent(id)}/receipt`);

function useSubMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: subKeys.all }) });
}
export const useChangePlan = () =>
  useSubMutation((v: { plan: PlanId; billingCycle: BillingCycle }) => api<{ result: "scheduled" | "cancelled" | "resumed"; quote: Quote; endsAt?: string }>("/subscriptions/change", { method: "POST", body: v }));
export const useKeepCurrentPlan = () => useSubMutation((_: void) => api<{ result: "kept"; renews: boolean }>("/subscriptions/change", { method: "DELETE" }));
export const useCancelPlan = () => useSubMutation((_: void) => api<{ result: "cancelled"; endsAt: string }>("/subscriptions/cancel", { method: "POST" }));
export const useResumePlan = () => useSubMutation((_: void) => api<{ result: "resumed"; renewsAt: string }>("/subscriptions/resume", { method: "POST" }));

/** Remembers the last checkout so the result page works even if Paystack drops the reference. */
export const lastSubscriptionRef = {
  key: "bimanage.lastSubscriptionRef",
  set(ref: string) {
    try {
      sessionStorage.setItem(this.key, ref);
    } catch {
      /* private mode */
    }
  },
  get(): string | null {
    try {
      return sessionStorage.getItem(this.key);
    } catch {
      return null;
    }
  },
};

/** What each plan adds, in plain words (07.01 / 07.10). Derived from the API's feature flags. */
export const FEATURE_LABELS: Array<[Feature, string]> = [
  ["inventory", "Inventory"],
  ["orders", "Orders and sales"],
  ["analytics", "Analytics"],
  ["invoices", "Invoices"],
  ["projects", "Projects and tasks"],
  ["store", "Live online store"],
  ["messages", "Messages"],
  ["bisupplynet", "Buy from wholesalers on BiSupplyNet"],
  ["bisupplynetSell", "Sell on BiSupplyNet"],
  ["automation", "Automation"],
  ["socialMedia", "Social media tools"],
];

export const planName = (id: PlanId | string | null | undefined) => (id === "standard" ? "Standard" : id === "premium" ? "Premium" : "Freemium");
export const cycleName = (c: BillingCycle | null | undefined) => (c === "yearly" ? "yearly" : "monthly");
export const perCycle = (c: BillingCycle | null | undefined) => (c === "yearly" ? "/year" : "/month");
