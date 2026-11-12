import { Link, useMatches, useNavigate } from "react-router-dom";
import { IconArrowLeft } from "@tabler/icons-react";
import { IconButton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { resolveBack, type ResolvedBack } from "@/lib/nav/backNav";
import { hasInAppHistory } from "@/lib/nav/history";

// "Back" and "Back to [Screen]" (see lib/nav/backNav.ts for the rules).
// Desktop: both sit at the top-left of the content area.
// Mobile: "Back" is an arrow in the header; "Back to [Screen]" sits at the
// top of the content when the page is more than one level deep.

export function useBack(): (ResolvedBack & { goBack: () => void }) | null {
  const matches = useMatches();
  const navigate = useNavigate();
  const resolved = resolveBack(matches);
  if (!resolved) return null;
  return {
    ...resolved,
    // The exact previous view if there is one in this tab; otherwise the parent.
    goBack: () => (hasInAppHistory() ? navigate(-1) : navigate(resolved.parentTo)),
  };
}

// No display class here: each control sets its own (the Back button is hidden on phones).
const linkClasses =
  "min-h-11 items-center gap-1.5 rounded-md px-1 text-action font-semibold text-ink-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy";

/** Top of the content area (app and sign-in pages). */
export function BackBar({ className }: { className?: string }) {
  const back = useBack();
  if (!back) return null;
  return (
    <nav aria-label="Page navigation" data-testid="back-bar" className={cn("mb-3 flex-wrap items-center gap-x-4 gap-y-1", back.deep ? "flex" : "hidden lg:flex", className)}>
      <button type="button" onClick={back.goBack} className={cn(linkClasses, "hidden lg:inline-flex")} data-testid="back-button">
        <IconArrowLeft aria-hidden="true" className="size-5" stroke={2} />
        Back
      </button>
      {back.deep && (
        <Link to={back.screen.to} className={cn(linkClasses, "inline-flex")} data-testid="back-to-screen">
          <IconArrowLeft aria-hidden="true" className="size-5 lg:hidden" stroke={2} />
          Back to {back.screen.label}
        </Link>
      )}
    </nav>
  );
}

/** Mobile header arrow. Renders nothing on a screen's start view. */
export function HeaderBackButton({ tone = "on-brand" }: { tone?: "on-brand" | "plain" }) {
  const back = useBack();
  if (!back) return null;
  return (
    <IconButton
      tone={tone}
      size="sm"
      label="Back"
      data-testid="header-back-button"
      icon={<IconArrowLeft aria-hidden="true" className="size-6" />}
      onClick={back.goBack}
      className="lg:hidden"
    />
  );
}
