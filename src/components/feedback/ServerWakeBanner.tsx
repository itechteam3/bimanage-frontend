import { IconCloudDown, IconWifiOff } from "@tabler/icons-react";
import { useServerStatus } from "@/lib/api/serverStatus";
import { Spinner } from "@/components/ui";

// Shown while the free Render backend wakes from sleep (up to ~1 minute), or
// when it can't be reached at all. Announced politely to screen readers.
export function ServerWakeBanner() {
  const status = useServerStatus();
  if (status !== "waking" && status !== "unreachable") return null;
  const waking = status === "waking";
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 top-4 z-50 mx-auto flex max-w-dialog items-center gap-3 rounded-lg border border-line-subtle bg-surface-card px-4 py-3 shadow-floating lg:top-6"
    >
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-tint-blue text-ink-brand">
        {waking ? <IconCloudDown className="size-icon" /> : <IconWifiOff className="size-icon" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body-lg-medium text-ink-strong">{waking ? "Waking the server…" : "Can't reach BiManage"}</p>
        <p className="text-caption text-ink-muted">
          {waking
            ? "This can take up to a minute after a quiet period. We'll retry automatically."
            : "Check your connection. Your changes haven't been sent."}
        </p>
      </div>
      {waking && <Spinner className="text-ink-brand" />}
    </div>
  );
}
