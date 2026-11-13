import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { IconRefresh } from "@tabler/icons-react";
import { useNewVersion } from "@/lib/version";

/** Reloads the page (a separate object so tests can stub it). */
export const reloader = { reload: () => window.location.reload() };

/**
 * "A new version of BiManage is available." Reload now, or we reload on the
 * next page change (the new page then loads from the new version).
 */
export function VersionBanner() {
  const isNew = useNewVersion();
  const location = useLocation();
  const shownAt = useRef<string | null>(null);

  useEffect(() => {
    if (!isNew) return;
    const here = location.pathname + location.search;
    if (shownAt.current === null) shownAt.current = here;
    else if (shownAt.current !== here) reloader.reload();
  }, [isNew, location.pathname, location.search]);

  if (!isNew) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-dialog items-center gap-3 rounded-lg border border-line-subtle bg-surface-card px-4 py-3 shadow-floating lg:bottom-6"
    >
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-tint-blue text-ink-brand">
        <IconRefresh className="size-icon" />
      </span>
      <p className="min-w-0 flex-1 text-body-sm text-ink-strong">A new version of BiManage is available.</p>
      <button type="button" onClick={() => reloader.reload()} className="min-h-11 shrink-0 rounded-md px-3 text-body-lg-medium text-ink-brand hover:bg-surface-tonal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-brand">
        Reload
      </button>
    </div>
  );
}
