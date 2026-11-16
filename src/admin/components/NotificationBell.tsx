import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { IconBell, IconSettings, IconAlertTriangle } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { Spinner } from "@/components/ui";
import { useMarkAllRead, useMarkRead, useNotifications, useUnreadCount, timeAgo, type AdminNotification } from "../lib/notifications";

// The admin bell (top bar, and the phone header): unread count, live over the
// admin socket; a dropdown of the latest items, each opening its record.

const badge = (n: number) => (n > 99 ? "99+" : String(n));

export function NotificationBell({ tone = "light" }: { tone?: "light" | "on-brand" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const unread = useUnreadCount().data?.unread ?? 0;
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  const label = unread ? `Notifications, ${unread} unread` : "Notifications";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn("relative flex size-11 items-center justify-center rounded-full transition-colors", tone === "on-brand" ? "text-ink-on-brand hover:bg-line-on-brand" : "text-ink-strong hover:bg-surface-pale")}
      >
        <IconBell aria-hidden="true" className="size-6" stroke={1.75} />
        {unread > 0 && (
          <span aria-hidden="true" className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-label font-semibold text-ink-on-brand">
            {badge(unread)}
          </span>
        )}
      </button>
      {open && <BellPanel onClose={() => setOpen(false)} unread={unread} />}
    </div>
  );
}

function BellPanel({ onClose, unread }: { onClose: () => void; unread: number }) {
  const list = useNotifications({ status: "all", limit: 6 });
  const markAll = useMarkAllRead();
  const items = list.data?.notifications;
  return (
    <div role="dialog" aria-label="Latest notifications" className="fixed inset-x-4 top-mobile-header z-40 mt-1 flex max-h-[75dvh] flex-col rounded-xl border border-line-subtle bg-surface-card shadow-floating lg:absolute lg:inset-x-auto lg:right-0 lg:top-full lg:mt-2 lg:w-96">
      <div className="flex items-center justify-between gap-2 border-b border-line-subtle px-4 py-3">
        <p className="text-body-lg font-semibold text-ink-strong">Notifications</p>
        <div className="flex items-center gap-1">
          {unread > 0 && (
            <button type="button" onClick={() => markAll.mutate(undefined)} disabled={markAll.isPending} className="rounded-md px-2 py-1 text-body-sm font-semibold text-ink-brand hover:bg-surface-pale">
              Mark all read
            </button>
          )}
          <Link to="/admin/notifications/settings" onClick={onClose} aria-label="Notification settings" className="flex size-9 items-center justify-center rounded-md text-ink-muted hover:bg-surface-pale">
            <IconSettings aria-hidden="true" className="size-5" />
          </Link>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {list.isPending ? (
          <div role="status" aria-label="Loading notifications" className="flex justify-center py-6">
            <Spinner className="size-5 text-ink-brand" />
          </div>
        ) : list.isError ? (
          <p role="alert" className="px-4 py-6 text-center text-body-sm text-danger">
            We couldn't load your notifications.
          </p>
        ) : !items || items.length === 0 ? (
          <p className="px-4 py-6 text-center text-body-sm text-ink-secondary">You're all caught up.</p>
        ) : (
          <ul className="divide-y divide-line-subtle">
            {items.map((n) => (
              <li key={n._id}>
                <NotificationItem n={n} onOpen={onClose} compact />
              </li>
            ))}
          </ul>
        )}
      </div>
      <Link to="/admin/notifications" onClick={onClose} className="border-t border-line-subtle px-4 py-3 text-center text-body-sm font-semibold text-ink-brand hover:bg-surface-pale">
        See all notifications
      </Link>
    </div>
  );
}

/** One notification: opening it marks it read and goes to its record. */
export function NotificationItem({ n, onOpen, compact }: { n: AdminNotification; onOpen?: () => void; compact?: boolean }) {
  const markRead = useMarkRead();
  const navigate = useNavigate();
  const unread = !n.readAt;
  const open = () => {
    if (unread) markRead.mutate(n._id);
    onOpen?.();
    if (n.link) navigate(n.link);
  };
  const body = (
    <>
      <span aria-hidden="true" className={cn("mt-2 size-2 shrink-0 rounded-full", unread ? "bg-brand-navy" : "bg-transparent")} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {n.priority === "urgent" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger-bg px-2 py-px text-label font-semibold uppercase text-danger">
              <IconAlertTriangle aria-hidden="true" className="size-3.5" /> Urgent
            </span>
          )}
          <span className="text-caption font-semibold uppercase text-ink-muted">{n.categoryLabel}</span>
          <span className="text-caption text-ink-muted">· {timeAgo(n.createdAt)}</span>
        </span>
        <span className={cn("mt-0.5 block [overflow-wrap:anywhere] text-body-lg text-ink-strong", unread && "font-semibold")}>{n.title}</span>
        {n.summary && <span className={cn("mt-0.5 block [overflow-wrap:anywhere] text-body-sm text-ink-secondary", compact && "line-clamp-2")}>{n.summary}</span>}
        {unread && <span className="sr-only"> (unread)</span>}
      </span>
    </>
  );
  const cls = cn("flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-pale", unread && "bg-surface-tint-blue/40");
  if (!n.link && !unread) return <div className={cls}>{body}</div>;
  return (
    <button type="button" onClick={open} className={cls}>
      {body}
    </button>
  );
}
