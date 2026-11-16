import { useEffect, useMemo, useState } from "react";
import { IconLock, IconSettings, IconBell } from "@tabler/icons-react";
import { Button, ButtonLink } from "@/components/ui";
import { AdminPage, ErrorBox, FilterSelect, Guidance, Loading, Pager, Section, Toolbar } from "../components/AdminKit";
import { NotificationItem } from "../components/NotificationBell";
import { useMarkAllRead, useNotifications, usePreferences, useSavePreferences, type PreferenceRow } from "../lib/notifications";

// The admin notification centre (/admin/notifications) and its settings
// (/admin/notifications/settings). Which categories an admin sees follows
// their role; urgent alerts always come through.

type Status = "all" | "unread";

export function NotificationsPage() {
  const [status, setStatus] = useState<Status>("all");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const prefs = usePreferences();
  const list = useNotifications({ status, category: category || undefined, page, limit: 20 });
  const markAll = useMarkAllRead();
  useEffect(() => setPage(1), [status, category]);
  const categories: Array<[string, string]> = [["", "All categories"], ...(prefs.data?.categories ?? []).map((c): [string, string] => [c.key, c.label])];
  const unread = list.data?.unread ?? 0;
  return (
    <AdminPage
      title="Notifications"
      intro="Alerts for your role, newest first. Open one to go to its record; it's marked read."
      actions={
        <ButtonLink to="/admin/notifications/settings" variant="secondary" size="md">
          <IconSettings aria-hidden="true" className="size-4" /> Settings
        </ButtonLink>
      }
    >
      <Toolbar>
        <FilterSelect<Status> label="Status" value={status} onChange={setStatus} options={[["all", "All"], ["unread", "Unread"]]} />
        <FilterSelect label="Category" value={category} onChange={setCategory} options={categories} />
        <div className="md:col-span-2 lg:ml-auto">
          <Button variant="secondary" size="md" className="w-full lg:w-auto" disabled={!unread || markAll.isPending} loading={markAll.isPending} onClick={() => markAll.mutate(category || undefined)}>
            Mark all read{unread ? ` (${unread})` : ""}
          </Button>
        </div>
      </Toolbar>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 desktop:grid-cols-[minmax(0,2.15fr)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-xl border border-line-card bg-surface-card shadow-card">
          <h2 className="sr-only">Notification list</h2>
          {list.error ? (
            <div className="p-4">
              <ErrorBox error={list.error} onRetry={() => void list.refetch()} />
            </div>
          ) : list.isPending ? (
            <Loading label="Loading notifications" />
          ) : list.data.notifications.length === 0 ? (
            <p className="flex flex-col items-center gap-2 px-4 py-10 text-center text-body-lg text-ink-secondary">
              <IconBell aria-hidden="true" className="size-8 text-ink-muted" />
              {status === "unread" ? "No unread notifications." : "No notifications yet."}
            </p>
          ) : (
            <ul className="divide-y divide-line-subtle">
              {list.data.notifications.map((n) => (
                <li key={n._id}>
                  <NotificationItem n={n} />
                </li>
              ))}
            </ul>
          )}
          {list.data && list.data.totalPages > 1 && (
            <div className="border-t border-line-subtle p-4">
              <Pager page={page} totalPages={list.data.totalPages} onPage={setPage} />
            </div>
          )}
        </section>
        <Guidance
          title="Guidance • Alerts"
          rules={[
            "Urgent alerts (a refund, payout or payment that didn't go through, or a locked account) always arrive here and by email.",
            "Choose in-app and email for everything else in Settings. Lower-priority alerts can come as one email at 08:00.",
            "Read items are kept for 90 days.",
          ]}
        />
      </div>
    </AdminPage>
  );
}

type Draft = Record<string, Pick<PreferenceRow, "inApp" | "email" | "frequency">>;
const toDraft = (rows: PreferenceRow[]): Draft => Object.fromEntries(rows.map((r) => [r.key, { inApp: r.inApp, email: r.email, frequency: r.frequency }]));

export function NotificationSettingsPage() {
  const prefs = usePreferences();
  const save = useSavePreferences();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (prefs.data && !draft) setDraft(toDraft(prefs.data.categories));
  }, [prefs.data, draft]);
  const rows = prefs.data?.categories ?? [];
  const original = useMemo(() => (prefs.data ? toDraft(prefs.data.categories) : null), [prefs.data]);
  const dirty = Boolean(draft && original && JSON.stringify(draft) !== JSON.stringify(original));
  const change = (key: string, patch: Partial<Draft[string]>) => {
    setSaved(false);
    setDraft((d) => (d ? { ...d, [key]: { ...d[key]!, ...patch } } : d));
  };
  const submit = () => {
    if (!draft || !original) return;
    const changed = Object.fromEntries(Object.entries(draft).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(original[k]) && !rows.find((r) => r.key === k)?.urgentLocked));
    save.mutate(changed, {
      onSuccess: (data) => {
        setDraft(toDraft(data.categories));
        setSaved(true);
      },
    });
  };
  return (
    <AdminPage
      title="Notification settings"
      intro={`Choose how each kind of alert reaches you. Urgent alerts are always on. Daily digests arrive at ${prefs.data?.digestTime ?? "08:00 (Lagos time)"}.`}
      eyebrow="My account"
      actions={
        <ButtonLink to="/admin/notifications" variant="secondary" size="md">
          <IconBell aria-hidden="true" className="size-4" /> Notifications
        </ButtonLink>
      }
    >
      {prefs.error ? (
        <ErrorBox error={prefs.error} onRetry={() => void prefs.refetch()} />
      ) : !draft ? (
        <Loading label="Loading your settings" />
      ) : (
        <Section title="Alerts for your role">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex flex-col gap-4"
          >
            <div className="hidden lg:block">
              <table className="w-full text-left">
                <caption className="sr-only">Alert categories and how they reach you</caption>
                <thead className="text-caption font-semibold uppercase text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2 pr-3">Category</th>
                    <th scope="col" className="w-24 py-2 text-center">In-app</th>
                    <th scope="col" className="w-24 py-2 text-center">Email</th>
                    <th scope="col" className="w-48 py-2">Email timing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle">
                  {rows.map((r) => (
                    <tr key={r.key}>
                      <th scope="row" className="py-3 pr-3 align-top font-normal">
                        <CategoryLabel r={r} />
                      </th>
                      <td className="py-2 text-center align-top">
                        <Channel r={r} ch="inApp" value={draft[r.key]!.inApp} onChange={(v) => change(r.key, { inApp: v })} />
                      </td>
                      <td className="py-2 text-center align-top">
                        <Channel r={r} ch="email" value={draft[r.key]!.email} onChange={(v) => change(r.key, { email: v })} />
                      </td>
                      <td className="py-2 align-top">
                        <Timing r={r} value={draft[r.key]!} onChange={(v) => change(r.key, { frequency: v })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="flex flex-col gap-3 lg:hidden">
              {rows.map((r) => (
                <li key={r.key} className="rounded-lg border border-line-card bg-surface-pale p-4">
                  <CategoryLabel r={r} />
                  <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
                    <label className="flex min-h-11 items-center gap-2 text-body-lg text-ink-strong">
                      <Channel r={r} ch="inApp" value={draft[r.key]!.inApp} onChange={(v) => change(r.key, { inApp: v })} bare /> In-app
                    </label>
                    <label className="flex min-h-11 items-center gap-2 text-body-lg text-ink-strong">
                      <Channel r={r} ch="email" value={draft[r.key]!.email} onChange={(v) => change(r.key, { email: v })} bare /> Email
                    </label>
                  </div>
                  <div className="mt-2">
                    <Timing r={r} value={draft[r.key]!} onChange={(v) => change(r.key, { frequency: v })} mobile />
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" loading={save.isPending} disabled={!dirty}>
                Save settings
              </Button>
              {saved && !dirty && (
                <p role="status" className="text-body-sm text-success">
                  Saved.
                </p>
              )}
            </div>
            {save.error ? <ErrorBox error={save.error} /> : null}
          </form>
        </Section>
      )}
    </AdminPage>
  );
}

function CategoryLabel({ r }: { r: PreferenceRow }) {
  return (
    <>
      <span className="flex flex-wrap items-center gap-2 text-body-lg font-semibold text-ink-strong">
        {r.urgentLocked && <IconLock aria-hidden="true" className="size-4 text-ink-muted" />}
        {r.label}
        {r.urgentLocked && <span className="rounded-full bg-danger-bg px-2 py-px text-label font-semibold uppercase text-danger">Urgent · always on</span>}
      </span>
      <span className="mt-0.5 block text-body-sm text-ink-muted">{r.description}</span>
      {r.hasUrgent && !r.urgentLocked && <span className="mt-0.5 block text-caption text-ink-secondary">Urgent alerts in this category always come through.</span>}
    </>
  );
}

function Channel({ r, ch, value, onChange, bare }: { r: PreferenceRow; ch: "inApp" | "email"; value: boolean; onChange: (v: boolean) => void; bare?: boolean }) {
  const name = `${r.label}: ${ch === "inApp" ? "in-app" : "email"}${r.urgentLocked ? " (always on)" : ""}`;
  const input = <input type="checkbox" className="size-5 accent-[var(--color-brand-navy)]" checked={r.urgentLocked ? true : value} disabled={r.urgentLocked} onChange={(e) => onChange(e.target.checked)} aria-label={name} />;
  if (bare) return input;
  return <label className="inline-flex size-11 items-center justify-center">{input}</label>;
}

function Timing({ r, value, onChange, mobile }: { r: PreferenceRow; value: Draft[string]; onChange: (v: "instant" | "digest") => void; mobile?: boolean }) {
  if (r.frequencyOptions.length < 2) return <p className="text-body-sm text-ink-secondary">{mobile ? "Email timing: " : ""}At once</p>;
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className={mobile ? "text-body-sm text-ink-muted" : "sr-only"}>{r.label}: email timing</span>
      <select
        aria-label={`${r.label}: email timing`}
        value={value.frequency}
        disabled={!value.email}
        onChange={(e) => onChange(e.target.value as "instant" | "digest")}
        className="h-control-md w-full rounded-lg border border-line-default bg-surface-card px-3 text-body-lg text-ink-strong focus:outline-none focus:shadow-focus disabled:opacity-60"
      >
        <option value="instant">At once</option>
        <option value="digest">Daily digest (08:00)</option>
      </select>
      {r.digestOnly && <span className="text-caption text-ink-secondary">New sign-ups always come in the daily summary.</span>}
    </label>
  );
}
