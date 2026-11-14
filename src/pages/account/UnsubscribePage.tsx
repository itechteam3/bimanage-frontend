import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthLayout, AuthNote } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errorMessage";

// One-click unsubscribe from announcement emails (link in every announcement
// email; no sign-in). Opening the page unsubscribes; "Turn them back on" undoes
// it. Security and payment emails always arrive.

type State = "working" | "off" | "on" | "error";

export function UnsubscribePage() {
  const [params] = useSearchParams();
  const link = { u: params.get("u") || "", topic: params.get("topic") || "announcements", t: params.get("t") || "" };
  const [state, setState] = useState<State>("working");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const call = async (path: "unsubscribe" | "resubscribe") => {
    setBusy(true);
    setError(null);
    try {
      await api(`/notifications/${path}`, { method: "POST", body: link, auth: false, quiet401: true });
      setState(path === "unsubscribe" ? "off" : "on");
    } catch (err) {
      setError(errorMessage(err, "We couldn't update your email settings. Please try again."));
      setState((s) => (s === "working" ? "error" : s));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!link.u || !link.t) {
      setState("error");
      setError("This unsubscribe link isn't complete. Open it from the email again.");
      return;
    }
    void call("unsubscribe");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const title = state === "off" ? "You're unsubscribed" : state === "on" ? "You're subscribed again" : state === "error" ? "Something went wrong" : "Updating your email settings…";
  return (
    <AuthLayout panel="security" kicker="Email settings" title={title} subtitle={state === "off" ? "You won't get announcement emails from BiManage any more." : state === "on" ? "You'll get announcement emails from BiManage again." : undefined}>
      <div className="flex flex-col gap-4">
        {state === "off" && (
          <>
            <AuthNote>Security and payment emails (sign-in codes, receipts, payouts) still arrive. You can change this any time in Settings → Notifications.</AuthNote>
            <Button variant="secondary" fullWidth loading={busy} onClick={() => void call("resubscribe")}>
              Changed your mind? Turn them back on
            </Button>
          </>
        )}
        {state === "on" && <AuthNote tone="success">Done. Thanks for staying in touch.</AuthNote>}
        {error && <AuthNote tone="danger">{error}</AuthNote>}
        {state === "error" && link.u && link.t && (
          <Button fullWidth loading={busy} onClick={() => void call("unsubscribe")}>
            Try again
          </Button>
        )}
        <Link to="/settings/notifications" className="text-center text-body-lg font-semibold text-ink-brand">
          Notification settings
        </Link>
      </div>
    </AuthLayout>
  );
}
