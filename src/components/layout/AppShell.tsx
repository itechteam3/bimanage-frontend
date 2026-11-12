import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { IconBell, IconCamera, IconMail, IconLogout, IconMenu2, IconLock, IconChevronDown, IconRosetteDiscountCheckFilled, IconSettings, IconUserCircle, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/brand/Logo";
import { Avatar as AvatarImage, IconButton } from "@/components/ui";
import { SIDEBAR_NAV, MOBILE_TABS, type NavItem } from "@/config/navigation";

export interface ShellUser {
  name: string;
  businessName?: string;
  avatarUrl?: string | null;
  verified?: boolean;
}

export interface AppShellProps {
  /** Breadcrumb tail: "Workspace / Dashboard". */
  section: string;
  user?: ShellUser;
  /** Visibility per item (role permissions, owner-only, plan). */
  navState?: (item: NavItem) => "visible" | "locked" | "hidden";
  onLogout?: () => void;
  /** Opens the "change photo" dialog (avatar menu). */
  onChangePhoto?: () => void;
  unread?: { notifications: number; messages: number };
  children: ReactNode;
}

// One avatar size everywhere (header, menu, sidebar, mobile drawer): the
// Figma sidebar avatar token (36px).
const Avatar = ({ user, onBrand }: { user?: ShellUser; onBrand?: boolean }) => (
  <AvatarImage name={user?.name} src={user?.avatarUrl} className={onBrand ? "ring-2 ring-line-on-brand" : undefined} />
);

function NavList({ navState, onNavigate }: { navState?: AppShellProps["navState"]; onNavigate?: () => void }) {
  return (
    <ul className="flex flex-col gap-1">
      {SIDEBAR_NAV.map((item) => {
        const state = navState?.(item) ?? "visible";
        if (state === "hidden") return null;
        const Icon = item.icon;
        return (
          <li key={item.to}>
            <NavLink
              to={item.to}
              onClick={onNavigate}
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
  );
}

function SidebarFooter({ user, onLogout }: Pick<AppShellProps, "user" | "onLogout">) {
  return (
    <div className="mt-3 border-t border-line-on-brand px-2 pt-6">
      <div className="flex items-center gap-2">
        <Avatar user={user} onBrand />
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-sm font-medium text-ink-on-brand">{user?.name}</p>
          {user?.businessName && <p className="truncate text-caption font-medium text-ink-on-brand-soft">{user.businessName}</p>}
        </div>
        {user?.verified && <IconRosetteDiscountCheckFilled aria-label="Verified account" className="size-4 shrink-0 text-success" />}
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="mt-10 flex h-control-sm w-full items-center gap-2.5 rounded-md text-body font-medium text-ink-on-brand hover:bg-line-on-brand"
      >
        <IconLogout aria-hidden="true" className="size-icon-sm text-danger-on-brand" />
        Log Out
      </button>
    </div>
  );
}

// Desktop sidebar (Figma 1748:1513 / 1889:1781): 218px navy, flush left, full height.
function Sidebar({ user, navState, onLogout }: Pick<AppShellProps, "user" | "navState" | "onLogout">) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-sidebar shrink-0 flex-col rounded-2xl bg-brand-navy px-3 pb-6 pt-7 text-ink-on-brand shadow-sidebar lg:flex">
      <Link to="/dashboard" className="px-2">
        <Logo tone="on-brand" />
      </Link>
      <nav aria-label="Main" className="mt-14 flex-1 overflow-y-auto">
        <NavList navState={navState} />
      </nav>
      <SidebarFooter user={user} onLogout={onLogout} />
    </aside>
  );
}

const Badge = ({ show }: { show: boolean }) =>
  show ? <span aria-hidden="true" className="absolute right-2 top-2 size-2 rounded-full bg-danger-on-brand ring-2 ring-surface-card" /> : null;

function UserMenu({ user, onLogout, onChangePhoto }: Pick<AppShellProps, "user" | "onLogout" | "onChangePhoto">) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
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
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex items-center gap-3 rounded-lg p-1 pr-2 hover:bg-surface-pale">
        <Avatar user={user} />
        <span className="max-w-48 truncate text-card-heading font-medium text-ink-strong">{user?.name}</span>
        <IconChevronDown aria-hidden="true" className={cn("size-icon text-ink-strong transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-60 rounded-xl border border-line-subtle bg-surface-card p-2 shadow-floating">
          <div className="flex items-center gap-3 border-b border-line-subtle px-3 pb-3 pt-1">
            <Avatar user={user} />
            <span className="min-w-0 truncate text-body-sm font-medium text-ink-strong">{user?.name}</span>
          </div>
          {onChangePhoto && (
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                onChangePhoto();
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-body-lg text-ink-strong hover:bg-surface-pale"
            >
              <IconCamera aria-hidden="true" className="size-icon text-ink-muted" /> Change photo
            </button>
          )}
          <Link role="menuitem" to="/settings/profile" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2.5 text-body-lg text-ink-strong hover:bg-surface-pale">
            <IconUserCircle aria-hidden="true" className="size-icon text-ink-muted" /> Profile
          </Link>
          <Link role="menuitem" to="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2.5 text-body-lg text-ink-strong hover:bg-surface-pale">
            <IconSettings aria-hidden="true" className="size-icon text-ink-muted" /> Settings
          </Link>
          <button role="menuitem" type="button" onClick={onLogout} className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-body-lg text-danger hover:bg-danger-bg">
            <IconLogout aria-hidden="true" className="size-icon" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

// Desktop header (Figma 1749:1558, as on 03.02): 72px white strip.
function DesktopHeader({ section, user, unread, onLogout, onChangePhoto }: Pick<AppShellProps, "section" | "user" | "unread" | "onLogout" | "onChangePhoto">) {
  const n = unread?.notifications ?? 0;
  const m = unread?.messages ?? 0;
  return (
    <header className="hidden h-header items-center justify-between bg-surface-card px-12 lg:flex">
      <p className="text-body-sm text-ink-secondary">
        Workspace<span aria-hidden="true">&nbsp;&nbsp;/&nbsp;&nbsp;</span>
        <span className="sr-only"> / </span>
        <span>{section}</span>
      </p>
      <div className="flex items-center gap-3">
        <Link to="/notifications" className="relative flex size-header-action items-center justify-center rounded-full bg-surface-pale text-ink-strong hover:bg-surface-tonal" aria-label={n ? `Notifications, ${n} unread` : "Notifications"}>
          <IconBell aria-hidden="true" className="size-icon" />
          <Badge show={n > 0} />
        </Link>
        <Link to="/messages" className="relative flex size-header-action items-center justify-center rounded-full bg-surface-pale text-ink-strong hover:bg-surface-tonal" aria-label={m ? `Messages, ${m} unread` : "Messages"}>
          <IconMail aria-hidden="true" className="size-icon" />
          <Badge show={m > 0} />
        </Link>
        <span className="w-2" />
        <UserMenu user={user} onLogout={onLogout} onChangePhoto={onChangePhoto} />
      </div>
    </header>
  );
}

// Mobile header (Figma 1924:1387) and slide-in navigation.
function MobileHeader({ user, navState, onLogout }: Pick<AppShellProps, "user" | "navState" | "onLogout">) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  return (
    <>
      <header className="sticky top-0 z-20 flex h-mobile-header items-center justify-between bg-brand-navy px-5 lg:hidden">
        <Link to="/dashboard">
          <Logo tone="on-brand" compact />
        </Link>
        <IconButton tone="on-brand" size="sm" label="Open menu" aria-expanded={open} icon={<IconMenu2 aria-hidden="true" className="size-6" />} onClick={() => setOpen(true)} />
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-surface-overlay" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-sidebar flex-col overflow-y-auto rounded-r-2xl bg-brand-navy px-3 pb-6 pt-5 text-ink-on-brand shadow-floating">
            <div className="flex items-center justify-between px-2">
              <Logo tone="on-brand" />
              <IconButton tone="on-brand" size="sm" label="Close menu" icon={<IconX aria-hidden="true" className="size-6" />} onClick={() => setOpen(false)} />
            </div>
            <nav aria-label="Main" className="mt-8 flex-1">
              <NavList navState={navState} onNavigate={() => setOpen(false)} />
            </nav>
            <SidebarFooter user={user} onLogout={onLogout} />
          </aside>
        </div>
      )}
    </>
  );
}

// Mobile tab bar (Figma 1924:1387): 408x68, r=22, tabs 94x52 r=15.
function MobileTabs() {
  return (
    <nav
      aria-label="Quick links"
      className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 mx-auto flex h-mobile-tab-bar max-w-mobile-tab-bar-w items-center gap-1 rounded-tab-bar border border-line-subtle bg-surface-card px-2 shadow-raised lg:hidden"
    >
      {MOBILE_TABS.map(({ label, to, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn("flex h-mobile-tab flex-1 flex-col items-center justify-center gap-0.5 rounded-tab text-body-sm font-semibold", isActive ? "bg-surface-tonal text-ink-brand" : "text-ink-muted")
          }
        >
          <Icon aria-hidden="true" className="size-icon" stroke={1.75} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell({ section, user, navState, onLogout, onChangePhoto, unread, children }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-surface-page lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface-card focus:px-4 focus:py-2">
        Skip to content
      </a>
      <Sidebar user={user} navState={navState} onLogout={onLogout} />
      <MobileHeader user={user} navState={navState} onLogout={onLogout} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DesktopHeader section={section} user={user} unread={unread} onLogout={onLogout} onChangePhoto={onChangePhoto} />
        <main id="main" className="relative flex-1 px-5 pb-28 pt-5 lg:px-12 lg:pb-12 lg:pt-6">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-gradient-atmosphere" />
          <div className="relative mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
      <MobileTabs />
    </div>
  );
}
