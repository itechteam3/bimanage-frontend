import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { describeError } from "@/lib/api/errorMessage";
import { useNewsletterAction } from "@/lib/landing/api";

/** /newsletter/confirm and /newsletter/unsubscribe (links from newsletter emails). */
export default function NewsletterPage({ action }: { action: "confirm" | "unsubscribe" }) {
  const [params] = useSearchParams();
  const e = params.get("e") ?? "";
  const t = params.get("t") ?? "";
  const run = useNewsletterAction(action);
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || !e || !t) return;
    sent.current = true;
    run.mutate({ e, t });
  }, [e, t, run]);

  const title = action === "confirm" ? "Newsletter subscription" : "Unsubscribe";
  let body: React.ReactNode;
  if (!e || !t) body = <p className="text-body-lg text-ink-muted">This link is incomplete. Please open it again from the email.</p>;
  else if (run.isPending || run.isIdle) body = <p className="flex items-center gap-2 text-body-lg text-ink-muted" role="status"><Spinner className="size-5" /> One moment…</p>;
  else if (run.isError) body = <p className="text-body-lg text-danger" role="alert">{describeError(run.error, "This link isn't valid any more.").message}</p>;
  else body = <p className="text-body-lg text-ink-strong" role="status">{run.data?.message}</p>;

  return (
    <div className="flex min-h-dvh flex-col bg-surface-page">
      <header className="flex h-mobile-header items-center bg-brand-navy px-5">
        <Link to="/" aria-label="BiManage home"><Logo tone="on-brand" /></Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-5 py-12">
        <div className="w-full max-w-[32rem] rounded-2xl bg-surface-card p-6 shadow-card">
          <h1 className="text-title-md text-ink-strong">{title}</h1>
          <div className="mt-3">{body}</div>
          <ButtonLink to="/" variant="secondary" className="mt-6">Back to BiManage</ButtonLink>
        </div>
      </main>
    </div>
  );
}
