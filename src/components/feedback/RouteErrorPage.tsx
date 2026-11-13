import { useEffect, useState } from "react";
import { useRouteError } from "react-router-dom";
import { IconRefresh } from "@tabler/icons-react";
import { isStaleBuildError, reloadForNewVersion } from "@/lib/reloadOnce";
import { reloader } from "./VersionBanner";

/**
 * Shown instead of the router's default "Unexpected Application Error!".
 * A page file missing after a deploy reloads once on its own; anything else
 * gets a plain message and a Reload button.
 */
export function RouteErrorPage() {
  const error = useRouteError();
  const stale = isStaleBuildError(error);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    if (stale && reloadForNewVersion()) setReloading(true);
  }, [stale]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-page px-4">
      <section role="alert" className="flex w-full max-w-dialog flex-col items-center gap-3 rounded-2xl bg-surface-card p-6 text-center shadow-card">
        <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-xl bg-surface-tint-blue text-ink-brand">
          <IconRefresh className="size-6" />
        </span>
        <h1 className="text-title-lg text-ink-strong">{reloading ? "Updating BiManage…" : stale ? "BiManage has been updated" : "Something went wrong"}</h1>
        <p className="text-body-sm text-ink-muted">
          {reloading ? "Loading the latest version." : stale ? "Reload to get the latest version." : "Please reload the page. If it keeps happening, contact support."}
        </p>
        {!reloading && (
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => reloader.reload()} className="min-h-11 rounded-lg bg-brand-navy px-5 text-body-lg-medium text-white">
              Reload
            </button>
            <a href="/dashboard" className="flex min-h-11 items-center rounded-lg px-4 text-body-lg-medium text-ink-brand">
              Go to dashboard
            </a>
          </div>
        )}
      </section>
    </main>
  );
}
