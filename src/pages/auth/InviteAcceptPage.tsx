import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IconUsersGroup } from "@tabler/icons-react";
import { AuthActions, AuthLayout, AuthNote } from "@/components/layout/AuthLayout";
import { Button, ButtonLink } from "@/components/ui";
import { authApi } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { pendingInvite } from "@/lib/auth/pending";
import { ApiError } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errorMessage";

// Team invite link from email: /invite/accept?token=<64-hex> (valid 48 h).
// Not drawn in Figma; built from the auth layout and components.
// Anonymous visitors sign in or register first (with the invited email);
// the token waits in sessionStorage and this page finishes the job.
type Phase = "intro" | "joining" | "joined" | "error";

export function InviteAcceptPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { status, user, refresh, signOut } = useAuth();
  const [phase, setPhase] = useState<Phase>("intro");
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  // Keep the token, then drop it from the address bar.
  const urlToken = params.get("token");
  useEffect(() => {
    if (urlToken && /^[a-f0-9]{16,128}$/i.test(urlToken)) {
      pendingInvite.set(urlToken);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [urlToken]);
  // Captured once: clearing the pending token after joining must not turn
  // this page into "invalid link".
  const [token] = useState(() => urlToken ?? pendingInvite.get());

  useEffect(() => {
    if (status !== "authenticated" || !token || started.current) return;
    started.current = true;
    setPhase("joining");
    authApi
      .acceptInvite(token)
      .then(async () => {
        pendingInvite.clear();
        await refresh(); // switches the workspace to the inviting business
        setPhase("joined");
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 400) pendingInvite.clear();
        setError(errorMessage(err));
        setPhase("error");
      });
  }, [status, token, refresh]);

  if (!token) {
    return (
      <AuthLayout panel="security" kicker="Team invitation" title="This invite link isn't valid" subtitle="Ask the business owner to send a new invitation.">
        <ButtonLink to="/login" fullWidth>
          Go to sign in
        </ButtonLink>
      </AuthLayout>
    );
  }

  if (status !== "authenticated") {
    return (
      <AuthLayout
        panel="security"
        kicker="Team invitation"
        title="You've been invited to a BiManage team"
        subtitle="Sign in or create an account with the email address the invitation was sent to. You'll join the team straight after."
      >
        <div className="flex flex-col gap-4 lg:gap-5">
          <div className="flex items-center gap-3 rounded-lg bg-surface-tint-blue p-4 text-ink-brand">
            <IconUsersGroup aria-hidden="true" className="size-6 shrink-0" />
            <p className="text-body-lg text-ink-strong">Invitations expire 48 hours after they're sent.</p>
          </div>
          <ButtonLink to="/login" fullWidth>
            Sign in to accept
          </ButtonLink>
          <AuthActions>
            <ButtonLink to="/register" variant="secondary" size="md">
              Create an account
            </ButtonLink>
          </AuthActions>
        </div>
      </AuthLayout>
    );
  }

  if (phase === "joined") {
    return (
      <AuthLayout panel="security" kicker="Team invitation" title="You've joined the team" subtitle="Your workspace now shows the business that invited you.">
        <Button fullWidth onClick={() => navigate("/dashboard", { replace: true })}>
          Go to the workspace
        </Button>
      </AuthLayout>
    );
  }

  if (phase === "error") {
    return (
      <AuthLayout panel="security" kicker="Team invitation" title="We couldn't add you to the team" subtitle={error}>
        <div className="flex flex-col gap-4">
          <AuthNote>
            Signed in as <strong className="font-semibold text-ink-strong">{user?.email}</strong>. If the invitation went to another address, sign in with that one.
          </AuthNote>
          <Button fullWidth onClick={() => navigate("/dashboard", { replace: true })}>
            Continue to my workspace
          </Button>
          <AuthActions>
            <Button variant="secondary" size="md" onClick={() => void signOut().then(() => navigate("/login"))}>
              Use a different account
            </Button>
          </AuthActions>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout panel="security" kicker="Team invitation" title="Joining the team…" subtitle="This only takes a moment.">
      <Button fullWidth loading loadingText="Joining…">
        Joining
      </Button>
    </AuthLayout>
  );
}
