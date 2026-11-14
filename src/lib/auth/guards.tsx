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

/**
 * Signed-in pages. Anonymous visitors go to sign in and come back afterwards.
 * A session ended from another device shows "Session expired" (13.07); an
 * account in its closure grace period shows "Account closing".
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, signOutReason } = useAuth();
  const location = useLocation();
  if (status === "loading") return <FullPageSpinner />;
  if (status === "closing") return <Navigate to="/account-closing" replace />;
  if (status === "anonymous") {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={signOutReason === "ended" ? `/session-expired?next=${next}` : `/login?next=${next}`} replace />;
  }
  return <>{children}</>;
}

/** Sign-in/register pages. Signed-in users skip ahead (finishing a pending invite first). */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") return <FullPageSpinner />;
  if (status === "authenticated") {
    return <Navigate to={pendingInvite.get() ? "/invite/accept" : "/"} replace />;
  }
  return <>{children}</>;
}
