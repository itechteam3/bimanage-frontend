import type { ReactNode } from "react";
import { NavLink, Link } from "react-router-dom";
import { IconBell, IconSettings, IconLogout, IconMenu2, IconLock } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/brand/Logo";
import { IconButton } from "@/components/ui";
import { SIDEBAR_NAV, MOBILE_TABS, type NavItem } from "@/config/navigation";

export interface ShellUser {
  name: string;
  businessName?: string;
  avatarUrl?: string | null;
}

export interface AppShellProps {
  /** Breadcrumb tail, e.g. "Sales" → "Workspace / Sales". */
  section: string;
  user?: ShellUser;
  /** Decide visibility per item (role permissions, owner-only, plan). */
  navState?: (item: NavItem) => "visible" | "locked" | "hidden";
  onLogout?: () => void;
  unreadCount?: number;
  children: ReactNode;
}

const Avatar = ({ user, size }: { user?: ShellUser; size: "sidebar" | "header" }) => {
  const cls = size === "sidebar" ? "size-avatar-sidebar" : "size-avatar-header";
  const initials = (user?.name ?? "?")
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return user?.avatarUrl ? (
    <img src={user.avatarUrl} alt="" className={cn(cls, "rounded-full object-cover")} />
  ) : (
    <span aria-hidden="true" className={cn(cls, "flex items-center justify-center rounded-full bg-surface-tint-blue text-body-sm font-semibold text-ink-brand")}>
      {initials}
    </span>
  );
};

// Desktop sidebar (Figma 1748:1513 / 1889:1781): 218px navy, r=20, 40px rows.
function Sidebar({ user, navState, onLogout }: Pick<AppShellProps, "user" | "navState" | "onLogout">) {
  return (
    <aside className="sticky top-4 hidden h-[calc(100dvh-2rem)] w-sidebar shrink-0 flex-col rounded-2xl bg-brand-navy p-3 text-ink-on-brand shadow-sidebar lg:flex">
      <Link to="/dashboard" className="px-2 py-3">
        <Logo tone="on-brand" />
      </Link>
      <nav aria-label="Main" className="mt-4 flex-1 overflow-y-auto">
        <ul className="flex flex-col gap-1">
          {SIDEBAR_NAV.map((item) => {
            const state = navState?.(item) ?? "visible";
            if (state === "hidden") return null;
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex h-control-sm items-center gap-2 rounded-md px-2 py-1 text-nav transition-colors",
                      isActive ? "rounded-lg bg-surface-nav-active text-ink-brand" : "text-ink-on-brand hover:bg-line-on-brand"
                    )
                  }
                >
                  <span className="flex size-nav-icon-slot items-center justify-center">
                    <Icon aria-hidden="true" className="size-icon" stroke={1.75} />
                  </span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {state === "locked" && <IconLock aria-label="Upgrade to unlock" className="size-4 opacity-70" />}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mt-3 border-t border-line-on-brand px-2 pt-4">
        <div className="flex items-center gap-2">
          <Avatar user={user} size="sidebar" />
          <div className="min-w-0">
            <p className="truncate text-body-sm font-medium text-ink-on-brand">{user?.name}</p>
            {user?.businessName && <p className="truncate text-caption font-medium text-ink-on-brand-soft">{user.businessName}</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="mt-4 flex h-control-sm w-full items-center gap-2.5 rounded-md text-body font-medium text-ink-on-brand hover:bg-line-on-brand"
        >
          <IconLogout aria-hidden="true" className="size-icon-sm text-danger-on-brand" />
          Log Out
        </button>
      </div>
    </aside>
  );
}

// Desktop header (Figma 1749:1558): 72px white, breadcrumb, actions, avatar.
function DesktopHeader({ section, user, unreadCount = 0 }: Pick<AppShellProps, "section" | "user" | "unreadCount">) {
  return (
    <header className="hidden h-header items-center justify-between rounded-2xl bg-surface-card px-8 lg:flex">
      <p className="text-body-lg-medium text-ink-secondary">
        Workspace <span aria-hidden="true">&nbsp;/&nbsp;</span>
        <span className="sr-only"> / </span>
        <span className="text-ink-strong">{section}</span>
      </p>
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-3">
          <Link to="/notifications" className="relative" aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}>
            <span className="flex size-header-action items-center justify-center rounded-lg text-ink-secondary hover:bg-surface-pale">
              <IconBell aria-hidden="true" className="size-icon" />
            </span>
            {unreadCount > 0 && <span aria-hidden="true" className="absolute right-2 top-2 size-2 rounded-full bg-danger" />}
          </Link>
          <Link to="/settings" aria-label="Settings" className="flex size-header-action items-center justify-center rounded-lg text-ink-secondary hover:bg-surface-pale">
            <IconSettings aria-hidden="true" className="size-icon" />
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Avatar user={user} size="header" />
          <div className="max-w-44">
            <p className="truncate text-body-lg-medium text-ink-strong">{user?.name}</p>
            {user?.businessName && <p className="truncate text-caption text-ink-muted">{user.businessName}</p>}
          </div>
        </div>
      </div>
    </header>
  );
}

// Mobile header (Figma 1924:1387): 66–68px navy bar, logo mark, menu.
function MobileHeader({ onMenu }: { onMenu?: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex h-mobile-header items-center justify-between bg-brand-navy px-5 lg:hidden">
      <Link to="/dashboard">
        <Logo tone="on-brand" compact />
      </Link>
      <IconButton tone="on-brand" size="sm" label="Open menu" icon={<IconMenu2 aria-hidden="true" className="size-6" />} onClick={onMenu} />
    </header>
  );
}

// Mobile tab bar (Figma 1924:1387): 408x68, r=22, tabs 94x52 r=15.
function MobileTabs() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 mx-auto flex h-mobile-tab-bar max-w-mobile-tab-bar-w items-center gap-1 rounded-tab-bar border border-line-subtle bg-surface-card px-2 shadow-raised lg:hidden"
    >
      {MOBILE_TABS.map(({ label, to, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "flex h-mobile-tab flex-1 flex-col items-center justify-center gap-0.5 rounded-tab text-body-sm font-semibold",
              isActive ? "bg-surface-tonal text-ink-brand" : "text-ink-muted"
            )
          }
        >
          <Icon aria-hidden="true" className="size-icon" stroke={1.75} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell({ section, user, navState, onLogout, unreadCount, children }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-surface-page lg:flex lg:gap-6 lg:p-4">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface-card focus:px-4 focus:py-2">
        Skip to content
      </a>
      <Sidebar user={user} navState={navState} onLogout={onLogout} />
      <MobileHeader />
      <div className="flex min-w-0 flex-1 flex-col lg:gap-6">
        <DesktopHeader section={section} user={user} unreadCount={unreadCount} />
        <main id="main" className="relative flex-1 px-5 pb-28 pt-5 lg:px-0 lg:pb-8 lg:pt-0">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-atmosphere lg:rounded-2xl" />
          <div className="relative">{children}</div>
        </main>
      </div>
      <MobileTabs />
    </div>
  );
}
