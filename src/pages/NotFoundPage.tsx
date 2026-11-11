import { Link } from "react-router-dom";
import { IconCompass } from "@tabler/icons-react";
import { EmptyState } from "@/components/ui";

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-mobile-content items-center px-5">
      <EmptyState
        className="w-full"
        icon={<IconCompass className="size-7" />}
        title="We can't find that page"
        body="The link may be old, or the page may have moved."
        action={
          <Link to="/" className="text-body-sm font-semibold text-ink-brand hover:underline">
            Go to BiManage →
          </Link>
        }
      />
    </main>
  );
}
