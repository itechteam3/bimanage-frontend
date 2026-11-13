import type { ReactNode } from "react";
import { IconBolt, IconLock, IconUserShield } from "@tabler/icons-react";
import { ButtonLink } from "@/components/ui";
import { safeLink } from "@/lib/notifications/api";
import { planName } from "@/lib/subscription/api";
import { cn } from "@/lib/cn";
import { FELI_DAILY_MESSAGES, lagosTime, type FeliRestriction, type FeliUsage } from "@/lib/feli/api";

// 11.03 (daily limit) and 11.04 (restriction) states, shared by the chat and
// the review page.

const lower = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

function StateCard({ icon, eyebrow, title, body, rows, note, actions, compact, label }: { icon: ReactNode; eyebrow: string; title: string; body: ReactNode; rows: Array<[string, ReactNode]>; note?: ReactNode; actions: ReactNode; compact?: boolean; label: string }) {
  return (
    <section aria-label={label} className={cn("min-w-0 rounded-2xl border border-line-card bg-surface-card shadow-card", compact ? "p-4" : "p-5 lg:p-8")}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-tint-blue text-ink-brand">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-caption font-semibold uppercase text-ink-brand">{eyebrow}</p>
          <h2 className={cn("break-words text-ink-strong", compact ? "text-body-lg font-semibold" : "text-title-md")}>{title}</h2>
        </div>
      </div>
      <div className="mt-3 break-words text-body-sm text-ink-muted">{body}</div>
      {rows.length > 0 && (
        <dl className="mt-4 flex flex-col overflow-hidden rounded-xl">
          {rows.map(([k, v], i) => (
            <div key={k} className={cn("grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 px-3 py-3 text-body-sm", i % 2 === 0 && "bg-surface-pale")}>
              <dt className="min-w-0 font-semibold text-ink-strong">{k}</dt>
              <dd className="min-w-0 break-words text-ink-brand">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {note && <div className="mt-4 rounded-xl bg-surface-tint-blue px-4 py-3 text-body-sm text-ink-strong">{note}</div>}
      <div className="mt-5 flex flex-wrap gap-3">{actions}</div>
    </section>
  );
}

/** 11.03: Freemium's daily FELI messages are used up. */
export function LimitCard({ usage, compact }: { usage?: FeliUsage | null; compact?: boolean }) {
  const limit = usage?.limit ?? FELI_DAILY_MESSAGES;
  const reset = lagosTime(usage?.resetsAt);
  return (
    <StateCard
      label="Daily FELI limit reached"
      compact={compact}
      icon={<IconBolt className="size-5" />}
      eyebrow="Freemium / Daily FELI messages"
      title="You've used today's FELI messages"
      body={`Freemium includes ${limit} FELI messages a day for your whole business. They reset at midnight, Lagos time. Upgrade for unlimited messages.`}
      rows={[
        ["Daily allowance", `${limit} messages`],
        ["Remaining", "0 messages"],
        ["Next reset", reset ? `${reset} (Lagos time)` : "Midnight, Lagos time"],
      ]}
      note="Your conversation is kept. Pick up where you left off after the reset."
      actions={
        <ButtonLink to="/subscription/plans" size="md">
          View available plans
        </ButtonLink>
      }
    />
  );
}

/** 11.04: why FELI can't do this, and the way forward. */
export function RestrictionCard({ restriction: r, compact }: { restriction: FeliRestriction; compact?: boolean }) {
  const alt = "alternative" in r && r.alternative && safeLink(r.alternative.link) ? { label: r.alternative.label, to: safeLink(r.alternative.link)! } : null;
  const altButton = (variant: "primary" | "outlined") =>
    alt ? (
      <ButtonLink to={alt.to} size="md" variant={variant}>
        {alt.label}
      </ButtonLink>
    ) : null;

  if (r.code === "UPGRADE_REQUIRED") {
    const needed = r.requiredPlanName || planName(r.requiredPlan);
    return (
      <StateCard
        label="Upgrade required"
        compact={compact}
        icon={<IconLock className="size-5" />}
        eyebrow="Upgrade required"
        title={`This FELI action needs the ${needed} plan`}
        body={`Your current plan doesn't let FELI ${lower(r.label)}. Upgrade to ${needed} to use it, or do it yourself in the usual screen.`}
        rows={[
          ["Requested action", r.label],
          ...(r.currentPlan ? ([["Current plan", planName(r.currentPlan)]] as Array<[string, ReactNode]>) : []),
          ["Required plan", needed],
          ...(alt ? ([["Alternative", alt.label]] as Array<[string, ReactNode]>) : []),
        ]}
        actions={
          <>
            <ButtonLink to="/subscription/plans" size="md">
              Compare plans
            </ButtonLink>
            {altButton("outlined")}
          </>
        }
      />
    );
  }

  if (r.code === "PERMISSION_DENIED") {
    return (
      <StateCard
        label="Permission needed"
        compact={compact}
        icon={<IconUserShield className="size-5" />}
        eyebrow="Permission needed"
        title="You don't have permission for this"
        body={`Your role doesn't let you ${lower(r.label)}. Ask the business owner or an admin to do it, or to give you access in Team settings.`}
        rows={[["Requested action", r.label]]}
        actions={null}
      />
    );
  }

  return (
    <StateCard
      label="Not something FELI can do"
      compact={compact}
      icon={<IconLock className="size-5" />}
      eyebrow="Not available through FELI"
      title="FELI can't do this one for you"
      body={`FELI can't ${lower(r.label)}, but you can do it yourself in a few steps.`}
      rows={[["Requested action", r.label], ...(alt ? ([["Alternative", alt.label]] as Array<[string, ReactNode]>) : [])]}
      note="The regular BiManage screens can still do this on eligible plans."
      actions={altButton("primary")}
    />
  );
}
