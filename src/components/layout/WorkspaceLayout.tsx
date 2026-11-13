import { useState } from "react";
import { Navigate, Outlet, useLocation, useMatches, useNavigate } from "react-router-dom";
import { AppShell } from "./AppShell";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useBusinessProfile, useOnboardingStatus, useUnreadCounts } from "@/lib/workspace/api";
import type { NavItem, Permission } from "@/config/navigation";
import { Spinner } from "@/components/ui";
import { PhotoDialog } from "@/components/profile/PhotoDialog";
import { useSubscription } from "@/lib/workspace/subscription";

// Signed-in pages render inside this. Routes declare their breadcrumb with
// `handle: { section: "Dashboard" }`. Owners who haven't chosen an onboarding
// path are sent to /onboarding first (team members never are).
export function WorkspaceLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const matches = useMatches();
  const { user, workspace, signOut } = useAuth();
  const isOwner = !workspace || workspace.role === "owner";
  const onboarding = useOnboardingStatus(isOwner);
  const unread = useUnreadCounts();
  const profile = useBusinessProfile();
  // Start the plan check now, alongside the other start-up requests, so a
  // plan-gated page doesn't wait for onboarding first (saved ~1.7s live).
  useSubscription();
  const [photoOpen, setPhotoOpen] = useState(false);

  const section =
    [...matches].reverse().map((m) => (m.handle as { section?: string } | undefined)?.section).find(Boolean) ?? "Dashboard";

  const onOnboarding = location.pathname.startsWith("/onboarding");
  if (isOwner && !onOnboarding) {
    if (onboarding.isLoading) {
      return (
        <div className="flex min-h-dvh items-center justify-center text-ink-brand" role="status">
          <Spinner className="size-8" />
          <span className="sr-only">Loading your workspace…</span>
        </div>
      );
    }
    if (onboarding.data && !onboarding.data.userPath) return <Navigate to="/onboarding" replace />;
  }

  const navState = (item: NavItem) => {
    if (item.ownerOnly && !isOwner) return "hidden" as const;
    // A list (BiSupplyNet: buy or sell) shows when any one of them is allowed.
    const perms = item.permission ? ([] as Permission[]).concat(item.permission) : [];
    if (perms.length && workspace && perms.every((p) => workspace.permissions[p] === false)) return "hidden" as const;
    return "visible" as const;
  };

  return (
    <AppShell
      section={section}
      user={{
        name: user?.name ?? "",
        businessName: workspace?.business?.name ?? profile.data?.businessName,
        avatarUrl: user?.avatar,
        verified: user?.isVerified,
      }}
      navState={navState}
      unread={unread.data}
      onLogout={() => void signOut().then(() => navigate("/login", { replace: true }))}
      onChangePhoto={() => setPhotoOpen(true)}
    >
      <Outlet />
      <PhotoDialog open={photoOpen} onClose={() => setPhotoOpen(false)} />
    </AppShell>
  );
}
