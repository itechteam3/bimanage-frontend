import type { ReactNode } from "react";
import { StateCard } from "@/components/page/StateCard";
import { IconBolt, IconLock, IconUserShield } from "@tabler/icons-react";
import { ButtonLink } from "@/components/ui";
import { safeLink } from "@/lib/notifications/api";
import { planName } from "@/lib/subscription/api";
import { FELI_DAILY_MESSAGES, lagosTime, type FeliRestriction, type FeliUsage } from "@/lib/feli/api";

// 11.03 (daily limit) and 11.04 (restriction) states, shared by the chat and
// the review page.

const lower = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

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
