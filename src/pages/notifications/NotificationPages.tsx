import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { IconBell, IconChecks, IconDownload, IconLock, IconSettings, IconTrash } from "@tabler/icons-react";
import { Button, ButtonLink, Dialog, Spinner } from "@/components/ui";
import { IntroCard, KpiCard, PageTitle, Panel, TipList } from "@/components/page/Blocks";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { UpdatedNote } from "@/components/feedback/UpdatedNote";
import { saveBlob } from "@/lib/api/client";
import { useUrlState } from "@/lib/nav/useUrlState";
import { count } from "@/lib/format";
import { cn } from "@/lib/cn";
import { inboxTime } from "@/lib/messages/api";
import {
  CATEGORY_INFO,
  exportNotifications,
  safeLink,
  useClearNotifications,
  useDeleteNotification,
  useMarkAllRead,
  useMarkRead,
  useNotificationSummary,
  useNotifications,
  usePreferences,
  useSavePreferences,
  type AppNotification,
  type PreferenceCategory,
  type Preferences,
} from "@/lib/notifications/api";

// Notification centre (Figma 12.11) and preferences (12.13 / 12.08).

const FILTERS: Array<[string, string]> = [
  ["all", "All"],
  ["unread", "Unread"],
  ["orders", "Orders"],
  ["inventory", "Stock"],
  ["messages", "Messages"],
  ["subscriptions", "Subscription"],
  ["withdrawals", "Payouts"],
];

const TYPE_LABEL: Record<string, string> = {
  order: "Order",
  payment: "Payment",
  inventory: "Stock",
  subscription: "Subscription",
  message: "Message",
  team: "Team",
  support: "Support",
  review: "Review",
  withdrawal: "Payout",
  security: "Security",
  business_tip: "Tip",
  feature_update: "What's new",
  system: "BiManage",
};

export function NotificationsPage() {
  const [filter, setFilter] = useUrlState<string>("show", "all", FILTERS.map(([k]) => k));
  const [pageKey, setPageKey] = useUrlState<string>("page", "1");
  const page = Math.max(1, Number(pageKey) || 1);
  const list = useNotifications(filter, page);
  const summary = useNotificationSummary();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const remove = useDeleteNotification();
  const clear = useClearNotifications();
  const navigate = useNavigate();
  const [confirmClear, setConfirmClear] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<unknown>(null);

  const open = (n: AppNotification) => {
    if (!n.isRead) markRead.mutate(n._id);
    const to = safeLink(n.link);
    if (to) navigate(to);
  };
  const download = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const { blob, filename } = await exportNotifications(filter);
      saveBlob(blob, filename === "download" ? "bimanage-notifications.csv" : filename);
    } catch (err) {
      setExportError(err);
    } finally {
      setExporting(false);
    }
  };
  const s = summary.data;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle actions={<ButtonLink to="/notifications/preferences" size="md" variant="outlined"><IconSettings aria-hidden="true" className="size-4" /> Notification settings</ButtonLink>}>Notifications centre</PageTitle>
      <IntroCard eyebrow="Workspace overview" title="Your business alerts, without the noise.">
        Keep important orders, payments, stock and messages on your radar.
      </IntroCard>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard tone="orders" label="All alerts" value={count(s?.all)} caption="Everything kept here" />
        <KpiCard tone="invoices" label="Unread" value={count(s?.unread)} caption="Needs review" />
        <KpiCard tone="revenue" label="Orders" value={count(s?.orders)} caption="New and updated orders" />
        <KpiCard tone="stock" label="Low stock" value={count(s?.lowStock)} caption="Inventory reminders" />
      </div>
      <Panel title="Recent notifications" subtitle="Newest first. Select one to open it.">
        <div className="flex flex-col gap-4">
          <UpdatedNote updatedAt={list.dataUpdatedAt} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label="Filter notifications" className="-mx-1 flex gap-1 overflow-x-auto px-1">
              {FILTERS.map(([k, label]) => (
                <button key={k} role="tab" type="button" aria-selected={filter === k} onClick={() => (setFilter(k), setPageKey("1"))} className={cn("min-h-9 shrink-0 rounded-full px-3 text-caption font-semibold", filter === k ? "bg-brand-navy text-ink-on-brand" : "bg-surface-pale text-ink-muted hover:text-ink-brand")}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="md" variant="outlined" loading={markAll.isPending} disabled={!s?.unread} onClick={() => markAll.mutate()}>
                <IconChecks aria-hidden="true" className="size-4" /> Mark all read
              </Button>
              <Button size="md" variant="outlined" loading={exporting} onClick={() => void download()}>
                <IconDownload aria-hidden="true" className="size-4" /> Export CSV
              </Button>
            </div>
          </div>
          {list.isLoading ? (
            <div className="flex justify-center py-8 text-ink-brand" role="status">
              <Spinner />
              <span className="sr-only">Loading notifications…</span>
            </div>
          ) : list.error ? (
            <ErrorNote error={list.error} fallback="We couldn't load your notifications." onRetry={() => void list.refetch()} />
          ) : !list.data?.notifications.length ? (
            <div className="rounded-xl bg-surface-pale p-5">
              <p className="text-body-lg font-semibold text-ink-strong">{filter === "all" ? "No notifications yet" : "Nothing here"}</p>
              <p className="mt-1 text-body-sm text-ink-muted">New orders, payments, stock alerts and messages will appear here.</p>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-line-subtle">
              {list.data.notifications.map((n) => (
                <li key={n._id} className="flex items-start gap-3 py-3">
                  <span aria-hidden="true" className={cn("mt-2 size-2 shrink-0 rounded-full", n.isRead ? "bg-transparent" : "bg-brand-navy")} />
                  <button type="button" onClick={() => open(n)} className="min-w-0 flex-1 text-left">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className={cn("text-body-sm text-ink-strong", !n.isRead && "font-semibold")}>
                        {n.title}
                        {!n.isRead && <span className="sr-only"> (unread)</span>}
                      </span>
                      <span className="text-caption text-ink-muted">
                        {TYPE_LABEL[n.type] ?? "BiManage"} · {inboxTime(n.createdAt)}
                      </span>
                    </span>
                    <span className="block text-body-sm text-ink-secondary">{n.message}</span>
                  </button>
                  <button type="button" onClick={() => remove.mutate(n._id)} className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-pale hover:text-danger" aria-label={`Delete notification: ${n.title}`}>
                    <IconTrash aria-hidden="true" className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {list.data && list.data.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <Button size="md" variant="outlined" disabled={page <= 1} onClick={() => setPageKey(String(page - 1))}>
                Previous
              </Button>
              <span className="text-body-sm text-ink-muted">
                Page {page} of {list.data.totalPages}
              </span>
              <Button size="md" variant="outlined" disabled={page >= list.data.totalPages} onClick={() => setPageKey(String(page + 1))}>
                Next
              </Button>
            </div>
          )}
          {!!list.data?.notifications.length && (
            <button type="button" className="self-start text-caption font-semibold text-danger hover:underline" onClick={() => setConfirmClear(true)}>
              Delete all notifications
            </button>
          )}
          <ErrorNote error={exportError ?? markAll.error ?? remove.error ?? clear.error} />
        </div>
      </Panel>
      <div className="grid gap-4 md:grid-cols-3">
        <Panel tone="pale" title="Orders and payments">
          <p className="text-body-sm text-ink-secondary">New orders, payment confirmations and payouts.</p>
          <Link to="/orders" className="mt-2 inline-block text-body-sm font-semibold text-ink-brand">Orders →</Link>
        </Panel>
        <Panel tone="pale" title="Stock and team">
          <p className="text-body-sm text-ink-secondary">Low inventory, invitations and messages.</p>
          <Link to="/inventory" className="mt-2 inline-block text-body-sm font-semibold text-ink-brand">Inventory →</Link>
        </Panel>
        <Panel tone="pale" title="In-app plus email">
          <p className="text-body-sm text-ink-secondary">Choose which alerts also reach your email.</p>
          <Link to="/notifications/preferences" className="mt-2 inline-block text-body-sm font-semibold text-ink-brand">Notification settings →</Link>
        </Panel>
      </div>
      <Dialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        tone="danger"
        title="Delete all notifications?"
        description="This removes every notification from this list. It can't be undone."
        actions={
          <>
            <Button variant="outlined" onClick={() => setConfirmClear(false)}>
              Keep them
            </Button>
            <Button variant="destructive" loading={clear.isPending} onClick={() => clear.mutate(undefined, { onSettled: () => setConfirmClear(false) })}>
              Delete all
            </Button>
          </>
        }
      />
    </div>
  );
}

// ── 12.13 Preferences ────────────────────────────────────────────────────
export function NotificationPreferencesPage() {
  const prefs = usePreferences();
  const save = useSavePreferences();
  const [draft, setDraft] = useState<Preferences | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (prefs.data && !draft) setDraft(prefs.data.preferences);
  }, [prefs.data, draft]);
  if (prefs.isLoading || !draft) {
    if (prefs.error) return <ErrorNote error={prefs.error} fallback="We couldn't load your settings." onRetry={() => void prefs.refetch()} />;
    return (
      <div className="flex justify-center py-16 text-ink-brand" role="status">
        <Spinner className="size-8" />
        <span className="sr-only">Loading your settings…</span>
      </div>
    );
  }
  const categories = (prefs.data?.categories ?? (Object.keys(CATEGORY_INFO) as PreferenceCategory[])).filter((c) => CATEGORY_INFO[c]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(prefs.data?.preferences);
  const toggle = (c: PreferenceCategory, ch: "inApp" | "email") => {
    setSaved(false);
    setDraft((d) => (d ? { ...d, [c]: { ...d[c], [ch]: !d[c][ch] } } : d));
  };
  return (
    <div className="flex flex-col gap-6">
      <PageTitle actions={<ButtonLink to="/notifications" size="md" variant="outlined"><IconBell aria-hidden="true" className="size-4" /> Back to notifications</ButtonLink>}>Notification preferences</PageTitle>
      <IntroCard eyebrow="Account / Stay informed" title="Choose the alerts that matter most.">
        Critical payment and security notifications always stay on.
      </IntroCard>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel title="Notification channels" subtitle="In-app alerts appear in the bell; email goes to your account email.">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(draft, { onSuccess: () => setSaved(true) });
            }}
            className="flex flex-col gap-4"
          >
            <table className="w-full text-left text-body-sm">
              <caption className="sr-only">Alert types and delivery channels</caption>
              <thead className="text-caption font-semibold uppercase text-ink-muted">
                <tr>
                  <th scope="col" className="py-2">Alert type</th>
                  <th scope="col" className="w-20 py-2 text-center">In-app</th>
                  <th scope="col" className="w-20 py-2 text-center">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {categories.map((c) => (
                  <tr key={c}>
                    <th scope="row" className="py-3 pr-3 font-normal">
                      <span className="block font-semibold text-ink-strong">{CATEGORY_INFO[c].label}</span>
                      <span className="text-caption text-ink-muted">{CATEGORY_INFO[c].detail}</span>
                    </th>
                    {(["inApp", "email"] as const).map((ch) => (
                      <td key={ch} className="py-3 text-center">
                        <input
                          type="checkbox"
                          className="size-5 accent-[var(--color-brand-navy)]"
                          checked={draft[c][ch]}
                          onChange={() => toggle(c, ch)}
                          aria-label={`${CATEGORY_INFO[c].label}: ${ch === "inApp" ? "in-app" : "email"}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th scope="row" className="py-3 pr-3 font-normal">
                    <span className="flex items-center gap-1.5 font-semibold text-ink-strong">
                      <IconLock aria-hidden="true" className="size-4" /> Security and payment confirmations
                    </span>
                    <span className="text-caption text-ink-muted">Always on: sign-ins, password changes, payments and receipts</span>
                  </th>
                  <td className="py-3 text-center">
                    <input type="checkbox" className="size-5" checked disabled aria-label="Security and payment confirmations: in-app (always on)" />
                  </td>
                  <td className="py-3 text-center">
                    <input type="checkbox" className="size-5" checked disabled aria-label="Security and payment confirmations: email (always on)" />
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" loading={save.isPending} disabled={!dirty}>
                Save preferences
              </Button>
              {saved && !dirty && (
                <p role="status" className="text-body-sm text-success">
                  Saved.
                </p>
              )}
            </div>
            <ErrorNote error={save.error} />
          </form>
        </Panel>
        <TipList
          title="Alert control"
          tips={[
            { title: "In-app alerts", body: "Open them from the bell; they update in real time." },
            { title: "Email notifications", body: "Useful when you're away from BiManage." },
            { title: "Manage your focus", body: "Change these any time." },
          ]}
        />
      </div>
    </div>
  );
}
