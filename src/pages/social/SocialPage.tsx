import { useEffect, useState } from "react";
import { IconBellRinging, IconCheck } from "@tabler/icons-react";
import { Button, Field, SelectInput, Spinner, Status, TextArea, TextInput } from "@/components/ui";
import { IntroCard, PageTitle, Panel, TipList } from "@/components/page/Blocks";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { SOCIAL_CHANNELS, longDate, useJoinWaitlist, useLeaveWaitlist, useSocialWaitlist } from "@/lib/account/api";
import { cn } from "@/lib/cn";

// 15.01 Social media scheduling: coming soon on every plan (decision D5).
// The planner is a disabled preview; "Notify me" joins the launch list.

function NotifyMe() {
  const list = useSocialWaitlist();
  const join = useJoinWaitlist();
  const leave = useLeaveWaitlist();
  const [picked, setPicked] = useState<string[]>([]);
  const data = list.data;
  useEffect(() => {
    if (data?.joined) setPicked(data.channels);
  }, [data?.joined, data?.channels]);

  if (list.isLoading) {
    return (
      <div className="flex justify-center py-6 text-ink-brand" role="status">
        <Spinner className="size-6" />
        <span className="sr-only">Loading…</span>
      </div>
    );
  }
  const channels = SOCIAL_CHANNELS.filter(([k]) => !data?.availableChannels || data.availableChannels.includes(k));
  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  return (
    <div className="flex flex-col gap-4">
      {data?.joined ? (
        <p role="status" className="flex flex-wrap items-center gap-2 text-body-lg text-ink-strong">
          <IconCheck aria-hidden="true" className="size-5 text-success" />
          You're on the list. We'll email you when scheduling is ready.
          {data.joinedAt && <span className="text-body-sm text-ink-muted">Joined {longDate(data.joinedAt)}.</span>}
        </p>
      ) : (
        <p className="text-body-sm text-ink-secondary">Get an email the day social media scheduling opens. Tell us which channels you use, if you like.</p>
      )}
      <fieldset>
        <legend className="text-field-label uppercase text-ink-secondary">Channels you use (optional)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {channels.map(([k, l]) => (
            <label key={k} className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-body-sm", picked.includes(k) ? "border-brand-navy bg-surface-tint-blue text-ink-brand" : "border-line-default text-ink-strong")}>
              <input type="checkbox" className="size-4 accent-[var(--color-brand-navy)]" checked={picked.includes(k)} onChange={() => toggle(k)} />
              {l}
            </label>
          ))}
        </div>
      </fieldset>
      <ErrorNote error={join.error ?? leave.error ?? list.error} fallback="We couldn't update your place on the list. Please try again." />
      <div className="flex flex-wrap gap-3">
        <Button size="md" loading={join.isPending} loadingText="Saving…" onClick={() => join.mutate(picked)}>
          <IconBellRinging aria-hidden="true" className="size-icon" /> {data?.joined ? "Update my channels" : "Notify me"}
        </Button>
        {data?.joined && (
          <Button size="md" variant="secondary" loading={leave.isPending} loadingText="Leaving…" onClick={() => leave.mutate()}>
            Leave the list
          </Button>
        )}
      </div>
    </div>
  );
}

export function SocialPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Social media scheduling</PageTitle>
      <IntroCard eyebrow="Coming soon / Meta platform approval" title="A calmer way to plan your business content.">
        Scheduling to connected Facebook and Instagram accounts is planned. Publishing isn't available yet.
      </IntroCard>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Content planner preview" subtitle="A look at how you'll draft posts. These fields aren't active yet.">
            <fieldset disabled aria-label="Scheduling preview (not available yet)" className="grid gap-4 md:grid-cols-2 md:gap-x-10">
              <Field label="Channel">
                <SelectInput defaultValue="">
                  <option value="">Facebook or Instagram (planned)</option>
                </SelectInput>
              </Field>
              <Field label="Media">
                <TextInput placeholder="Choose image or video" readOnly />
              </Field>
              <Field label="Caption" className="md:col-span-2">
                <TextArea rows={3} placeholder="Write your post here" />
              </Field>
              <Field label="Date">
                <TextInput type="date" />
              </Field>
              <Field label="Time">
                <TextInput type="time" />
              </Field>
            </fieldset>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button disabled>Schedule post (coming soon)</Button>
              <Status tone="neutral">Coming soon</Status>
            </div>
          </Panel>
          <Panel title="Notify me">
            <NotifyMe />
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <TipList
            title="What's planned"
            tips={[
              { title: "Connect accounts", body: "Connect eligible Facebook and Instagram profiles." },
              { title: "Prepare your posts", body: "Write captions and attach images or videos." },
              { title: "Pick a schedule", body: "Choose when posts should go out." },
              { title: "Monitor outcomes", body: "See which posts are queued, sent or didn't go out." },
            ]}
          />
          <p className="text-body-sm text-ink-muted">Switching this on depends on approval from Meta. Every plan can join the list.</p>
        </div>
      </div>
    </div>
  );
}
