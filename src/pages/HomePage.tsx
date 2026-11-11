import { AuthLayout } from "@/components/layout/AuthLayout";
import { ButtonLink } from "@/components/ui";

// Placeholder until Phase 2 (authentication) replaces it with Sign in.
export function HomePage() {
  return (
    <AuthLayout kicker="Coming soon" title="BiManage is on its way" subtitle="Your business workspace is being built. Sign-in opens in the next release.">
      <div className="flex flex-col gap-3">
        <ButtonLink to="/ui-kit" fullWidth>
          View the design system
        </ButtonLink>
      </div>
    </AuthLayout>
  );
}
