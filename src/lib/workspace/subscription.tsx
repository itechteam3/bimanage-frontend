import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { IconLock } from "@tabler/icons-react";
import { api } from "@/lib/api/client";
import { ButtonLink, EmptyState, Spinner } from "@/components/ui";
import { featureAccess, type Access, type Feature, type PlanId } from "@/config/plans";

// GET /subscriptions/current — `features` is what the account can use right
// now (trial / startup package / plan), computed by the backend.
export interface CurrentSubscription {
  plan: PlanId;
  status: string;
  isTrialActive?: boolean;
  trialEndDate?: string | null;
  startupPackage?: "starter" | "standard" | "premium" | null;
  startupPackageEndDate?: string | null;
  isStartupPackageExpired?: boolean;
  access?: { source: "trial" | "startup_package" | "plan"; tier: string; unlimitedCredits: boolean };
  features?: Partial<Record<Feature, Access>>;
  credits?: { daily: number; used: number; remaining: number; resetsAt: string };
}

export const useSubscription = () =>
  useQuery({ queryKey: ["subscription", "current"], queryFn: () => api<CurrentSubscription>("/subscriptions/current"), staleTime: 5 * 60_000 });

/** Server's answer when present; otherwise the local mirror in config/plans.ts. */
export function useFeature(feature: Feature): { access: Access; loading: boolean } {
  const sub = useSubscription();
  if (sub.isLoading) return { access: false, loading: true };
  const server = sub.data?.features?.[feature];
  return { access: server ?? featureAccess(sub.data, feature), loading: false };
}

/**
 * Renders children only when the plan includes the feature; otherwise an
 * upgrade prompt — so locked pages never fire a refused request.
 */
export function FeatureGate({ feature, title, children }: { feature: Feature; title: string; children: ReactNode }) {
  const { access, loading } = useFeature(feature);
  if (loading) {
    return (
      <div className="flex justify-center py-16 text-ink-brand" role="status">
        <Spinner className="size-8" />
        <span className="sr-only">Checking your plan…</span>
      </div>
    );
  }
  if (!access) {
    return (
      <EmptyState
        className="max-w-xl"
        icon={<IconLock className="size-7" />}
        title={`${title} isn't included in your plan`}
        body="Upgrade, or choose a startup package, to unlock it. Everything you've set up so far stays as it is."
        action={
          <ButtonLink to="/subscription" size="md">
            See plans
          </ButtonLink>
        }
      />
    );
  }
  return <>{children}</>;
}
