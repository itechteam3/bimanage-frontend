import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthProvider";
import { pendingInvite } from "@/lib/auth/pending";
import { ApiError } from "@/lib/api/client";

// The API redirects here after Google sign-in: /oauth/callback?token=<JWT>.
// The token is removed from the address bar immediately (so it isn't kept in
// history or leaked via Referer), stored, and the user loaded.
export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice in development
    started.current = true;
    const token = new URLSearchParams(window.location.search).get("token");
    window.history.replaceState(null, "", window.location.pathname);
    if (!token) {
      navigate("/login?error=google", { replace: true });
      return;
    }
    signIn(token)
      .then(() => navigate(pendingInvite.get() ? "/invite/accept" : "/", { replace: true }))
      .catch((err) => navigate(err instanceof ApiError && err.data.accountClosing ? "/account-closing" : "/login?error=google", { replace: true }));
  }, [navigate, signIn]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-ink-brand" role="status">
      <Spinner className="size-8" />
      <p className="text-body-lg text-ink-secondary">Signing you in with Google…</p>
    </div>
  );
}
