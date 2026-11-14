import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "@/lib/api/client";
import type { PlanId } from "@/config/plans";

// Typed workspace endpoints (docs/api-reference.md + backend PR #6).

export interface OnboardingStatus {
  userPath: "startup" | "existing_business" | null;
  onboardingComplete: boolean;
  plan: PlanId;
  status: string;
  isTrialActive: boolean;
  isTrialUsed: boolean;
  daysRemainingTrial: number | null;
  startupPackage: "starter" | "standard" | "premium" | null;
  isStartupPackageExpired: boolean;
  daysRemainingStartup: number | null;
  credits?: { daily: number; used: number; remaining: number; resetsAt: string };
}

export interface SetupStep {
  key: string;
  label: string;
  description: string;
  completed: boolean;
  link: string;
}
export interface SetupSteps {
  completedCount: number;
  totalSteps: number;
  isComplete: boolean;
  percentage: number;
  steps: SetupStep[];
}

export interface StartupPackage {
  id: "starter" | "standard" | "premium";
  name: string;
  amount: number;
  currency: "NGN";
  tagline: string;
  summary: string;
  days: number;
  /** false until Paystack is configured on the server ("coming soon"). */
  paymentsAvailable?: boolean;
}

export const PAYMENTS_COMING_SOON = "Online payments are coming soon. You can keep using your free trial in the meantime.";
/** The server's "payments aren't set up yet" answer. */
export const isPaymentsUnavailable = (err: unknown) =>
  err instanceof ApiError && err.status === 503 && err.data.paymentsUnavailable === true;

export interface PaymentState {
  reference: string;
  status: "pending" | "success" | "failed" | "abandoned";
  package: StartupPackage;
  amount: number;
  activated: boolean;
  paidAt?: string | null;
  message?: string;
}

export interface BusinessProfile {
  _id?: string;
  businessName?: string;
  businessType?: string;
  businessCategory?: string;
  cacNumber?: string;
  businessEmail?: string;
  businessPhone?: string;
  businessAddress?: string;
  businessWebsite?: string;
  businessDescription?: string;
  logo?: string | null;
  isOnboarded?: boolean;
  /** Read-only extras from GET (13.01). */
  owner?: { name: string } | null;
  store?: { name?: string; slug?: string; url?: string | null; customDomain?: string | null; published: boolean } | null;
  completeness?: { completed: number; total: number; percent: number; missing: string[] };
}

export interface DashboardSummary {
  stats: {
    totalProducts: number;
    totalStock: number;
    totalInventoryValue: number;
    totalSales: number;
    revenue?: number;
    totalOrders?: number;
    openInvoices?: number;
    lowStock?: number;
    outOfStock?: number;
    totalTasks: number;
    pendingTasks: number;
  };
  recentOrders: Array<{
    _id?: string;
    trackingNo: string;
    productName: string;
    productImage?: string;
    price: number;
    quantity: number;
    totalAmount: number;
    status: "pending" | "completed" | "cancelled";
    date: string;
  }>;
  topSelling: Array<{ _id: string; name: string; image?: string; sellingPrice: number; totalSold: number; category?: string }>;
  salesChart: Array<{ _id: { year: number; month: number; day: number }; totalSales: number; totalOrders: number }>;
  analytics: { totalOrders: number; sale: number; distribute: number; return: number };
}

export const keys = {
  onboarding: ["onboarding", "status"] as const,
  steps: ["onboarding", "steps"] as const,
  packages: ["onboarding", "packages"] as const,
  profile: ["business-profile"] as const,
  dashboard: ["dashboard"] as const,
  unread: ["unread"] as const,
};

export const useOnboardingStatus = (enabled = true) =>
  useQuery({ queryKey: keys.onboarding, queryFn: () => api<OnboardingStatus>("/onboarding/status"), enabled });

export const useSetupSteps = () => useQuery({ queryKey: keys.steps, queryFn: () => api<SetupSteps>("/onboarding/steps") });

export const useStartupPackages = () =>
  useQuery({ queryKey: keys.packages, queryFn: () => api<StartupPackage[]>("/onboarding/startup-packages"), staleTime: 10 * 60_000 });

export const useBusinessProfile = () => useQuery({ queryKey: keys.profile, queryFn: () => api<BusinessProfile>("/business-profile") });

export const useDashboard = () => useQuery({ queryKey: keys.dashboard, queryFn: () => api<DashboardSummary>("/dashboard") });

/** Header badges. Failures are silent — badges are optional. */
export const useUnreadCounts = (enabled = true) =>
  useQuery({
    queryKey: keys.unread,
    enabled,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const [n, m] = await Promise.all([
        api<{ unreadCount?: number }>("/notifications/unread-count").catch(() => ({ unreadCount: 0 })),
        api<{ unreadCount?: number }>("/messages/unread-count").catch(() => ({ unreadCount: 0 })),
      ]);
      return { notifications: n.unreadCount ?? 0, messages: m.unreadCount ?? 0 };
    },
  });

export function useSelectPath() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (path: "startup" | "existing_business") => api("/onboarding/select-path", { method: "POST", body: { path } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.onboarding }),
  });
}

export function useStartTrial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ trialEndDate: string; daysRemaining: number }>("/onboarding/start-trial", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.onboarding }),
  });
}

export const startCheckout = (pkg: StartupPackage["id"]) =>
  api<PaymentState & { authorizationUrl: string }>("/onboarding/startup-package/checkout", { method: "POST", body: { package: pkg } });

export const verifyPayment = (reference: string) =>
  api<PaymentState>("/onboarding/startup-package/verify", { method: "POST", body: { reference } });

export function useSaveBusinessProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BusinessProfile) => api<BusinessProfile>("/business-profile", { method: "PUT", body: input }),
    onSuccess: (data) => {
      // The saved fields now; owner, store link and completeness come with the refetch.
      qc.setQueryData(keys.profile, (old: BusinessProfile | undefined) => ({ ...old, ...data }));
      void qc.invalidateQueries({ queryKey: keys.profile });
      void qc.invalidateQueries({ queryKey: keys.steps });
    },
  });
}

export function useUploadLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("logo", file);
      return api<{ logo?: string; url?: string; profile?: BusinessProfile }>("/upload/logo", { method: "POST", body: form });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.profile });
      void qc.invalidateQueries({ queryKey: keys.steps });
    },
  });
}

/** Backend enums (businessProfileValidation.js) with friendly labels. */
export const BUSINESS_TYPES = [
  ["sole_proprietorship", "Sole proprietorship"],
  ["partnership", "Partnership"],
  ["limited_liability", "Limited liability company"],
  ["corporation", "Corporation"],
  ["ngo", "NGO / non-profit"],
  ["other", "Other"],
] as const;

export const BUSINESS_CATEGORIES = [
  ["fashion", "Fashion and retail"],
  ["retail", "Retail and FMCG"],
  ["food", "Food and beverage"],
  ["beauty", "Beauty"],
  ["health", "Health"],
  ["tech", "Technology"],
  ["education", "Education"],
  ["real_estate", "Real estate"],
  ["logistics", "Logistics"],
  ["entertainment", "Entertainment"],
  ["agriculture", "Agriculture"],
  ["finance", "Finance"],
  ["services", "Services"],
  ["other", "Other"],
] as const;
