import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useMatches, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  IconLayoutDashboard,
  IconUsers,
  IconShieldCheck,
  IconScale,
  IconLifebuoy,
  IconBell,
  IconChartBar,
  IconSettings,
  IconWorld,
  IconHistory,
  IconLogout,
  IconMenu2,
  IconX,
  IconDots,
  IconBriefcase,
  IconUserCircle,
  IconCamera,
  IconChevronDown,
  type Icon,
} from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/brand/Logo";
import { Avatar, IconButton, Spinner } from "@/components/ui";
import { adminApi } from "../lib/api";
import { adminSession } from "../lib/session";
import { useAdminMe } from "../lib/hooks";
import type { Capability } from "../lib/types";

// Admin layout (Figma 16.01–16.08): the "Unified administration" sidebar
// (#00466b, the brand navy), a white top bar "Workspace / Platform Admin" with
// the access badge, and on phones the "Admin" header plus four icon tabs
// (Overview, Users, Cases, More). Items show only for roles that can use them.

interface AdminNavItem {
  to: string;
  label: string;
  icon: Icon;
  can: Capability;
  end?: boolean;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { to: "/admin", label: "Overview", icon: IconLayoutDashboard, can: "stats.read", end: true },
  { to: "/admin/users", label: "Users", icon: IconUsers, can: "users.read" },
  { to: "/admin/suppliers", label: "Supplier KYC", icon: IconShieldCheck, can: "suppliers.review" },
  { to: "/admin/bisupplynet/disputes", label: "Disputes", icon: IconScale, can: "disputes.read" },
  { to: "/admin/support/tickets", label: "Support", icon: IconLifebuoy, can: "support.manage" },
  { to: "/admin/announcements", label: "Announcements", icon: IconBell, can: "announcements.send" },
  { to: "/admin/analytics", label: "Analytics", icon: IconChartBar, can: "stats.read" },
  { to: "/admin/store-domains", label: "Store domains", icon: IconWorld, can: "domains.manage" },
  { to: "/admin/roles", label: "Admin Roles", icon: IconSettings, can: "admins.manage" },
  { to: "/admin/audit", label: "Audit trail", icon: IconHistory, can: "audit.read" },
];

function useVisibleNav() {
  const me = useAdminMe().data;
  return ADMIN_NAV.filter((i) => me && me.can.includes(i.can));
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const items = useVisibleNav();
  return (
    <ul className="flex flex-col gap-1">
      {items.map(({ to, label, icon: Icon, end }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) => cn("flex h-control-sm items-center gap-2 rounded-md px-2 py-1 text-nav transition-colors", isActive ? "rounded-lg bg-surface-nav-active text-ink-brand" : "text-ink-on-brand hover:bg-line-on-brand")}
          >
            <span className="flex size-nav-icon-slot items-center justify-center">
              <Icon aria-hidden="true" className="size-icon" stroke={1.75} />
            </span>
            <span className="flex-1 truncate">{label}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    try {
      await adminApi("/admin/logout", { method: "POST" });
    } catch {
      /* signed out here either way */
    }
    adminSession.clear("signed-out");
    qc.removeQueries({ queryKey: ["admin"] });
    navigate("/admin/login", { replace: true });
  };
}

function ProfileBlock({ onNavigate }: { onNavigate?: () => void }) {
  const me = useAdminMe().data;
  const signOut = useSignOut();
  return (
    <div className="mt-3 border-t border-line-on-brand px-2 pt-5">
      <Link to="/admin/account" onClick={onNavigate} className="flex items-center gap-2 rounded-md hover:bg-line-on-brand">
        <Avatar name={me?.name} src={me?.avatar} className="ring-2 ring-line-on-brand" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body-sm font-medium text-ink-on-brand">{me?.name}</span>
          <span className="block truncate text-caption font-medium text-ink-on-brand-soft">{me?.roleLabel} access</span>
        </span>
      </Link>
      <p className="mt-4 text-caption text-ink-on-brand-soft">◈ Restricted workspace</p>
      <button type="button" onClick={() => void signOut()} className="mt-5 flex h-control-sm w-full items-center gap-2.5 rounded-md text-body font-medium text-ink-on-brand hover:bg-line-on-brand">
        <IconLogout aria-hidden="true" className="size-icon-sm text-danger-on-brand" />
        Sign out
      </button>
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-sidebar shrink-0 flex-col rounded-2xl bg-brand-navy px-3 pb-6 pt-7 text-ink-on-brand shadow-sidebar lg:flex">
      <Link to="/admin" className="px-2">
        <Logo tone="on-brand" />
      </Link>
      <p className="mt-2 px-2 text-label font-semibold uppercase tracking-wide text-ink-on-brand-soft">Platform admin</p>
      <nav aria-label="Admin" className="mt-10 flex-1 overflow-y-auto">
        <NavList />
      </nav>
      <ProfileBlock />
    </aside>
  );
}

/** Top-bar avatar menu: my account, change photo, sign out. */
function AvatarMenu() {
  const me = useAdminMe().data;
  const signOut = useSignOut();
  const navigate = useNavigate();
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
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-surface-pale">
        <Avatar name={me?.name} src={me?.avatar} />
        <span className="max-w-40 truncate text-body-lg font-medium text-ink-strong">{me?.name}</span>
        <IconChevronDown aria-hidden="true" className={cn("size-icon-sm text-ink-strong transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-56 rounded-xl border border-line-subtle bg-surface-card p-2 shadow-floating">
          <button role="menuitem" type="button" onClick={() => (setOpen(false), navigate("/admin/account"))} className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-body-lg text-ink-strong hover:bg-surface-pale">
            <IconUserCircle aria-hidden="true" className="size-icon text-ink-muted" /> My account
          </button>
          <button role="menuitem" type="button" onClick={() => (setOpen(false), navigate("/admin/account?photo=1"))} className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-body-lg text-ink-strong hover:bg-surface-pale">
            <IconCamera aria-hidden="true" className="size-icon text-ink-muted" /> Change photo
          </button>
          <button role="menuitem" type="button" onClick={() => void signOut()} className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-body-lg text-danger hover:bg-danger-bg">
            <IconLogout aria-hidden="true" className="size-icon" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function TopBar({ section }: { section: string }) {
  const me = useAdminMe().data;
  return (
    <header className="hidden h-header items-center justify-between bg-surface-card px-12 lg:flex">
      <p className="text-body-sm text-ink-secondary">
        Workspace<span aria-hidden="true">&nbsp;&nbsp;/&nbsp;&nbsp;</span>
        <span className="sr-only"> / </span>Platform Admin
        {section && (
          <>
            <span aria-hidden="true">&nbsp;&nbsp;/&nbsp;&nbsp;</span>
            <span className="sr-only"> / </span>
            {section}
          </>
        )}
      </p>
      <div className="flex items-center gap-4">
        <span className="inline-flex h-status items-center gap-2 rounded-full bg-surface-pale px-3 text-body-sm font-semibold text-ink-brand">
          <span aria-hidden="true" className="size-2 rounded-full bg-success" />
          Administrative access{me ? ` · ${me.roleLabel}` : ""}
        </span>
        <AvatarMenu />
      </div>
    </header>
  );
}

function MobileHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  return (
    <>
      <header className="sticky top-0 z-20 flex h-mobile-header items-center justify-between bg-brand-navy px-5 lg:hidden">
        <Link to="/admin" className="flex items-center gap-3">
          <Logo tone="on-brand" compact />
          <span className="text-card-heading font-semibold text-ink-on-brand">Admin</span>
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
            <nav aria-label="Admin" className="mt-8 flex-1">
              <NavList onNavigate={() => setOpen(false)} />
            </nav>
            <ProfileBlock onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}

// Figma "MOBILE NAV • Icon tabs": Overview, Users, Cases, More.
function MobileTabs() {
  const me = useAdminMe().data;
  const has = (c: Capability) => Boolean(me && me.can.includes(c));
  const cases = has("support.manage") ? "/admin/support/tickets" : has("disputes.read") ? "/admin/bisupplynet/disputes" : has("suppliers.review") ? "/admin/suppliers" : null;
  const tabs: Array<{ label: string; to: string; icon: Icon; end?: boolean }> = [
    { label: "Overview", to: "/admin", icon: IconLayoutDashboard, end: true },
    ...(has("users.read") ? [{ label: "Users", to: "/admin/users", icon: IconUsers }] : []),
    ...(cases ? [{ label: "Cases", to: cases, icon: IconBriefcase }] : []),
    { label: "More", to: "/admin/more", icon: IconDots },
  ];
  return (
    <nav aria-label="Admin quick links" className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 mx-auto flex h-mobile-tab-bar max-w-mobile-tab-bar-w items-center gap-1 rounded-tab-bar border border-line-subtle bg-surface-card px-2 shadow-raised lg:hidden">
      {tabs.map(({ label, to, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => cn("flex h-mobile-tab flex-1 flex-col items-center justify-center gap-0.5 rounded-tab text-body-sm font-semibold", isActive ? "bg-surface-tonal text-ink-brand" : "text-ink-muted")}>
          <Icon aria-hidden="true" className="size-icon" stroke={1.75} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

/** "More" on phones: every module this role can open, plus the account. */
export function AdminMorePage() {
  const items = useVisibleNav();
  const signOut = useSignOut();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title-md text-ink-strong">More</h1>
      <ul className="flex flex-col gap-2">
        {[...items, { to: "/admin/account", label: "My account", icon: IconUserCircle }].map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link to={to} className="flex items-center gap-3 rounded-lg border border-line-card bg-surface-card px-4 py-3 text-body-lg font-medium text-ink-strong shadow-card">
              <Icon aria-hidden="true" className="size-icon text-ink-brand" /> {label}
            </Link>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => void signOut()} className="flex items-center gap-3 rounded-lg border border-line-card bg-surface-card px-4 py-3 text-body-lg font-medium text-danger shadow-card">
        <IconLogout aria-hidden="true" className="size-icon" /> Sign out
      </button>
    </div>
  );
}

/** Signed-in admins only; a business session never counts. */
export function AdminLayout() {
  const me = useAdminMe();
  const navigate = useNavigate();
  const location = useLocation();
  const matches = useMatches();
  const section = ([...matches].reverse().find((m) => (m.handle as { section?: string } | undefined)?.section)?.handle as { section?: string } | undefined)?.section ?? "";
  useEffect(() => adminSession.onClear((reason) => navigate(`/admin/login${reason === "ended" ? "?ended=1" : ""}`, { replace: true, state: { from: location.pathname } })), [navigate, location.pathname]);

  if (!adminSession.get()) return <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />;
  if (me.isPending) return <FullPageSpinner />;
  if (me.isError || !me.data) return <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />;
  return (
    <div className="min-h-dvh bg-surface-page lg:flex">
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface-card focus:px-4 focus:py-2">
        Skip to content
      </a>
      <Sidebar />
      <MobileHeader />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar section={section} />
        <main id="admin-main" className="relative flex-1 px-4 pb-28 pt-5 md:px-5 lg:px-12 lg:pb-12 lg:pt-6">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-gradient-atmosphere" />
          <div className="relative mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
      <MobileTabs />
    </div>
  );
}

/** A page only some roles can open (the backend refuses the rest anyway). */
export function RequireCan({ can, children }: { can: Capability; children: ReactNode }) {
  const me = useAdminMe().data;
  if (me && !me.can.includes(can)) {
    return (
      <div className="rounded-xl border border-line-card bg-surface-card p-6 shadow-card">
        <h1 className="text-title-sm text-ink-strong">Not available for your role</h1>
        <p className="mt-2 text-body-lg text-ink-secondary">Your admin role ({me.roleLabel}) can't open this page. Ask a superadmin if you need access.</p>
        <Link to="/admin" className="mt-4 inline-block text-body-lg font-semibold text-ink-brand">
          Back to the overview
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-page" role="status" aria-label="Loading">
      <Spinner className="size-8 text-ink-brand" />
    </div>
  );
}
