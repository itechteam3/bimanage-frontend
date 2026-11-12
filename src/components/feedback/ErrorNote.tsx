import { IconAlertCircle } from "@tabler/icons-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { describeError } from "@/lib/api/errorMessage";
import { SUPPORT_EMAIL } from "@/config/links";

/**
 * A failed action, in words people understand, with what to do next:
 * "Try again" when retrying can help, "Report a problem" when we don't know
 * what went wrong. Technical details never appear here.
 */
export function ErrorNote({ error, fallback, onRetry, className }: { error: unknown; fallback?: string; onRetry?: () => void; className?: string }) {
  if (!error) return null;
  const { message, known, retryable } = describeError(error, fallback);
  const subject = encodeURIComponent("Problem in BiManage");
  const body = encodeURIComponent(`What I was doing:\n\nWhat I saw: ${message}\nPage: ${typeof location !== "undefined" ? location.pathname : ""}\nTime: ${new Date().toISOString()}\n`);
  return (
    <div role="alert" className={cn("flex flex-col gap-3 rounded-lg bg-danger-bg px-4 py-3 text-body-sm text-danger md:flex-row md:items-center", className)}>
      <p className="flex flex-1 items-start gap-2">
        <IconAlertCircle aria-hidden="true" className="mt-0.5 size-icon-sm shrink-0" />
        <span>{message}</span>
      </p>
      {(onRetry && retryable) || !known ? (
        <div className="flex shrink-0 items-center gap-3">
          {onRetry && retryable && (
            <Button size="md" variant="outlined" onClick={onRetry}>
              Try again
            </Button>
          )}
          {!known && (
            <a href={`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`} className="font-semibold underline underline-offset-2">
              Report a problem
            </a>
          )}
        </div>
      ) : null}
    </div>
  );
}
