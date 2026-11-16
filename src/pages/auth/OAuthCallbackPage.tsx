import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthProvider";
import { pendingInvite } from "@/lib/auth/pending";
import { ApiError } from "@/lib/api/client";
import { authApi } from "@/lib/auth/api";

// The API redirects here after Google sign-in with a one-time code
// (/oauth/callback?code=…, security fix P1-2): never the session token. The
// code is removed from the address bar at once and traded for the token with
// POST /auth/google/exchange (valid 60 seconds, once). An older API that still
// sends ?token= keeps working until it's updated.
export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice in development
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const legacyToken = params.get("token");
    window.history.replaceState(null, "", window.location.pathname);
    if (!code && !legacyToken) {
      navigate("/login?error=google", { replace: true });
      return;
    }
    (code ? authApi.exchangeGoogleCode(code).then((r) => r.token) : Promise.resolve(legacyToken!))
      .then((token) => signIn(token))
      .then(() => navigate(pendingInvite.get() ? "/invite/accept" : "/start", { replace: true }))
      .catch((err) => navigate(err instanceof ApiError && err.data.accountClosing ? "/account-closing" : "/login?error=google", { replace: true }));
  }, [navigate, signIn]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-ink-brand" role="status">
      <Spinner className="size-8" />
      <p className="text-body-lg text-ink-secondary">Signing you in with Google…</p>
    </div>
  );
}
