import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { pendingInvite } from "./pending";
import { Spinner } from "@/components/ui";

const FullPageSpinner = () => (
  <div className="flex min-h-dvh items-center justify-center text-ink-brand" role="status">
    <Spinner className="size-8" />
    <span className="sr-only">Loading your workspace…</span>
  </div>
);

/** Signed-in pages. Anonymous visitors go to sign in and come back afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <FullPageSpinner />;
  if (status === "anonymous") {
    const next = location.pathname + location.search;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <>{children}</>;
}

/** Sign-in/register pages. Signed-in users skip ahead (finishing a pending invite first). */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") return <FullPageSpinner />;
  if (status === "authenticated") {
    return <Navigate to={pendingInvite.get() ? "/invite/accept" : "/dashboard"} replace />;
  }
  return <>{children}</>;
}
