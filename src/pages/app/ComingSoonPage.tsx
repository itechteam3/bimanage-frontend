import { useMatches } from "react-router-dom";
import { IconSparkles } from "@tabler/icons-react";
import { ButtonLink, EmptyState } from "@/components/ui";
import { PageTitle } from "@/components/page/Blocks";

// Sections that arrive in later phases. Keeps sidebar and checklist links
// from ending in a 404 meanwhile.
export function ComingSoonPage() {
  const matches = useMatches();
  const section = [...matches].reverse().map((m) => (m.handle as { section?: string } | undefined)?.section).find(Boolean) ?? "This section";
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>{section}</PageTitle>
      <EmptyState
        className="max-w-xl"
        icon={<IconSparkles className="size-7" />}
        title={`${section} is coming soon`}
        body="This part of BiManage arrives in an upcoming release. Your setup checklist and dashboard are ready now."
        action={
          <ButtonLink to="/dashboard" variant="tonal" size="md">
            Back to dashboard
          </ButtonLink>
        }
      />
    </div>
  );
}
