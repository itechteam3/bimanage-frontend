import { useNavigate } from "react-router-dom";
import { IconSparkles } from "@tabler/icons-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthProvider";

// Landing page after sign-in until Phase 3 (onboarding + dashboard) replaces it.
export function DashboardPlaceholder() {
  const navigate = useNavigate();
  const { user, workspace, signOut } = useAuth();
  const businessName = workspace?.business?.name;
  return (
    <AppShell
      section="Dashboard"
      user={{ name: user?.name ?? "", businessName, avatarUrl: user?.avatar }}
      navState={(item) => (item.ownerOnly && workspace?.role !== "owner" ? "hidden" : item.permission && workspace && !workspace.permissions[item.permission] ? "hidden" : "visible")}
      onLogout={() => void signOut().then(() => navigate("/login", { replace: true }))}
    >
      <h1 className="text-title-lg lg:text-page-title">Welcome, {user?.name?.split(" ")[0]}</h1>
      <p className="mt-1 text-body text-ink-muted">
        {workspace?.role && workspace.role !== "owner"
          ? `You're signed in to ${businessName ?? "your team's business"} as ${workspace.role}.`
          : "You're signed in to your BiManage workspace."}
      </p>
      <EmptyState
        className="mt-6 max-w-xl"
        icon={<IconSparkles className="size-7" />}
        title="Your workspace is being set up"
        body="Onboarding and your dashboard arrive in the next release."
      />
    </AppShell>
  );
}
