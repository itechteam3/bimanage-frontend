import { Link } from "react-router-dom";
import { IconChevronRight, IconLock } from "@tabler/icons-react";
import { PageTitle } from "@/components/page/Blocks";
import { MORE_MENU } from "@/config/navigation";
import { useNavState } from "@/lib/nav/useNavState";

// Mobile "More" tab: every section that isn't in the tab bar, with the
// sidebar's icons and the same plan and permission rules. Sections the role
// can't use are left out; sections the plan doesn't include show a lock and
// open the page's upgrade prompt. Works at any width (desktop has the sidebar
// too, so this is just the same list).
export function MorePage() {
  const navState = useNavState();
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>More</PageTitle>
      {MORE_MENU.map((group) => {
        const items = group.items.map((item) => ({ item, state: navState(item) })).filter(({ state }) => state !== "hidden");
        if (!items.length) return null;
        return (
          <section key={group.title} aria-labelledby={`more-${group.title}`} className="flex flex-col gap-3">
            <h2 id={`more-${group.title}`} className="text-caption font-semibold uppercase text-ink-muted">
              {group.title}
            </h2>
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 md:grid-cols-2 lg:grid-cols-3">
              {items.map(({ item, state }) => {
                const Icon = item.icon;
                const locked = state === "locked";
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      data-state={state}
                      className="flex min-h-16 items-center gap-3 rounded-xl border border-line-card bg-surface-card px-4 py-3 shadow-card hover:bg-surface-pale"
                    >
                      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-tint-blue text-ink-brand">
                        <Icon className="size-icon" stroke={1.75} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body-lg font-semibold text-ink-strong">{item.label}</span>
                        <span className="block truncate text-body-sm text-ink-muted">{locked ? "Upgrade your plan to unlock" : item.description}</span>
                      </span>
                      {locked ? (
                        <IconLock aria-label="Upgrade to unlock" className="size-icon shrink-0 text-ink-muted" />
                      ) : (
                        <IconChevronRight aria-hidden="true" className="size-icon shrink-0 text-ink-muted" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
