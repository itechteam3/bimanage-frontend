import type { ReactNode } from "react";
import { Navigate, NavLink } from "react-router-dom";
import { IconLock, IconUserShield } from "@tabler/icons-react";
import { Button, ButtonLink, Spinner } from "@/components/ui";
import { IntroCard, Panel } from "@/components/page/Blocks";
import { StateCard } from "@/components/page/StateCard";
import { useCan } from "@/lib/auth/useCan";
import { useFeature, useSubscription } from "@/lib/workspace/subscription";
import { planName } from "@/lib/subscription/api";
import { cn } from "@/lib/cn";

// Pieces shared by the BiSupplyNet screens (Figma 10.01–10.12): the section
// tabs, the plan and permission states, the striped record rows (stacked
// cards on phones) and the "Details & actions" side panel.

export const Loading = ({ label = "Loading…" }: { label?: string }) => (
  <div className="flex justify-center py-16 text-ink-brand" role="status">
    <Spinner className="size-8" />
    <span className="sr-only">{label}</span>
  </div>
);

export const EYEBROW = "Workspace / BiSupplyNet";

/** The pale strip under every title (Figma "WORKSPACE / BISUPPLYNET"). */
export const Intro = ({ children }: { children: ReactNode }) => <IntroCard eyebrow={EYEBROW} title={children} />;

/** Title + subtitle + one action, as in every 10.xx frame. */
export function Heading({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
      <div className="min-w-0">
        <h1 className="break-words text-title-lg text-ink-strong lg:text-page-title">{title}</h1>
        {subtitle && <p className="mt-1 break-words text-body-sm text-ink-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </div>
  );
}

export function useBsnAccess() {
  const canBuy = useCan("accessBiSupplyNet");
  const canSell = useCan("sellOnBiSupplyNet");
  const sell = useFeature("bisupplynetSell");
  return { canBuy, canSell, sellPlan: sell.access === true, loading: sell.loading };
}

function Tabs({ label, tabs }: { label: string; tabs: Array<[string, string, boolean?]> }) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-1 rounded-md bg-surface-pale p-1">
        {tabs.map(([to, text, end]) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) => cn("flex min-h-11 items-center rounded-sm px-3 text-action font-semibold md:px-4", isActive ? "bg-surface-card text-ink-brand shadow-card" : "text-ink-muted hover:text-ink-brand")}
            >
              {text}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** BiSupplyNet sections: buying tabs, plus "Selling" for people who can sell. */
export function BsnTabs() {
  const { canBuy, canSell } = useBsnAccess();
  const tabs: Array<[string, string, boolean?]> = [];
  if (canBuy) tabs.push(["/bisupplynet/suppliers", "Suppliers"], ["/bisupplynet/products", "Products"], ["/bisupplynet/orders", "My orders"], ["/bisupplynet/disputes", "Disputes"]);
  if (canSell) tabs.push(["/bisupplynet/sell", "Selling"]);
  return tabs.length > 1 ? <Tabs label="BiSupplyNet" tabs={tabs} /> : null;
}

/** The seller's own sections. */
export function SellTabs() {
  return (
    <Tabs
      label="Selling on BiSupplyNet"
      tabs={[
        ["/bisupplynet/sell/earnings", "Earnings"],
        ["/bisupplynet/sell/listings", "Listings"],
        ["/bisupplynet/sell/orders", "Orders"],
        ["/bisupplynet/sell/connections", "Requests"],
        ["/bisupplynet/sell/disputes", "Disputes"],
        ["/bisupplynet/sell/application", "Application"],
      ]}
    />
  );
}

export function PermissionCard({ what }: { what: string }) {
  return (
    <StateCard
      label="Permission needed"
      icon={<IconUserShield className="size-5" />}
      eyebrow="Permission needed"
      title="You don't have permission for this"
      body={`Your role doesn't let you ${what}. Ask the business owner or an admin to give you access in Team settings.`}
      rows={[]}
      actions={
        <ButtonLink to="/dashboard" size="md" variant="outlined">
          Back to dashboard
        </ButtonLink>
      }
    />
  );
}

function SellUpgradeCard() {
  const sub = useSubscription();
  const { canBuy } = useBsnAccess();
  return (
    <StateCard
      label="Upgrade required"
      icon={<IconLock className="size-5" />}
      eyebrow="Upgrade required"
      title="Selling on BiSupplyNet needs the Premium plan"
      body="Premium lets you apply as a wholesaler, list products and take bulk orders from other businesses. Your current plan can still buy from wholesalers."
      rows={[
        ["Current plan", planName(sub.data?.plan)],
        ["Required plan", "Premium"],
      ]}
      actions={
        <>
          <ButtonLink to="/subscription/plans" size="md">
            Compare plans
          </ButtonLink>
          {canBuy && (
            <ButtonLink to="/bisupplynet/suppliers" size="md" variant="outlined">
              Find suppliers
            </ButtonLink>
          )}
        </>
      }
    />
  );
}

/** Buying pages: the "Buy from wholesalers" permission (the plan is checked by the route). */
export function BuyGate({ children }: { children: ReactNode }) {
  const { canBuy, canSell } = useBsnAccess();
  if (canBuy) return <>{children}</>;
  if (canSell) return <Navigate to="/bisupplynet/sell" replace />;
  return <PermissionCard what="buy from wholesalers" />;
}

/** Order and dispute detail: the buyer or the seller. */
export function EitherGate({ children }: { children: ReactNode }) {
  const { canBuy, canSell } = useBsnAccess();
  return canBuy || canSell ? <>{children}</> : <PermissionCard what="use BiSupplyNet" />;
}

/** Selling pages: Premium plus the "Sell on BiSupplyNet" permission. */
export function SellGate({ children }: { children: ReactNode }) {
  const { canSell, sellPlan, loading } = useBsnAccess();
  if (!canSell) return <PermissionCard what="sell on BiSupplyNet" />;
  if (loading) return <Loading label="Checking your plan…" />;
  if (!sellPlan) return <SellUpgradeCard />;
  return <>{children}</>;
}

/** /bisupplynet: buying if allowed, otherwise selling. */
export function BsnHome() {
  const { canBuy, canSell } = useBsnAccess();
  if (canBuy) return <Navigate to="/bisupplynet/suppliers" replace />;
  if (canSell) return <Navigate to="/bisupplynet/sell" replace />;
  return <PermissionCard what="use BiSupplyNet" />;
}

// ── Record rows (Figma "RECORD rows") ────────────────────────────────────

const COLS = "md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.8fr)]";

/**
 * Striped four-column rows on tablet and desktop; on phones each row is a
 * stacked card (first cell bold, the rest underneath), so nothing scrolls sideways.
 */
export function RecordRows({ rows, label }: { rows: Array<{ key: string; cells: [ReactNode, ReactNode, ReactNode, ReactNode]; tone?: "plain" }>; label: string }) {
  return (
    <ul aria-label={label} className="flex flex-col gap-2 md:gap-0">
      {rows.map((r, i) => (
        <li
          key={r.key}
          className={cn("grid grid-cols-[minmax(0,1fr)] gap-1 rounded-lg border border-line-subtle px-4 py-3 text-body-sm md:items-center md:gap-4 md:rounded-none md:border-0 md:py-4", COLS, i % 2 === 1 ? "md:bg-surface-pale" : "")}
        >
          <span className="min-w-0 break-words font-semibold text-ink-strong">{r.cells[0]}</span>
          <span className="min-w-0 break-words text-ink-strong">{r.cells[1]}</span>
          <span className="min-w-0 break-words text-ink-muted md:text-ink-strong">{r.cells[2]}</span>
          <span className="min-w-0 break-words text-ink-brand">{r.cells[3]}</span>
        </li>
      ))}
    </ul>
  );
}

/** "DETAILS & ACTIONS" side panel: labelled facts in white boxes. */
export function FactsPanel({ title = "Details & actions", items, children }: { title?: string; items: Array<[string, ReactNode]>; children?: ReactNode }) {
  return (
    <Panel tone="pale" title={title}>
      <dl className="flex flex-col gap-4">
        {items.map(([k, v]) => (
          <div key={k} className="min-w-0 rounded-md bg-surface-card px-3 py-2">
            <dt className="text-caption font-semibold uppercase text-ink-muted">{k}</dt>
            <dd className="break-words text-body-lg text-ink-strong">{v}</dd>
          </div>
        ))}
      </dl>
      {children && <div className="mt-6 flex flex-col gap-4">{children}</div>}
    </Panel>
  );
}

/** Two-column label / value table inside the centred cards (10.04, 10.07, 10.09). */
export function SummaryRows({ rows, label }: { rows: Array<[string, ReactNode]>; label?: string }) {
  return (
    <dl aria-label={label} className="flex flex-col overflow-hidden rounded-xl">
      {rows.map(([k, v], i) => (
        <div key={k} className={cn("grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 px-3 py-4 text-body-sm md:px-4", i % 2 === 0 && "bg-surface-pale")}>
          <dt className="min-w-0 font-semibold text-ink-strong">{k}</dt>
          <dd className="min-w-0 break-words text-ink-brand">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** "BUYER AND SELLER PROTECTION" box at the foot of the forms. */
export function ProtectionBox() {
  return (
    <section className="rounded-xl bg-surface-pale px-4 py-4 lg:px-5">
      <p className="text-caption font-semibold uppercase text-ink-brand">Buyer and seller protection</p>
      <p className="mt-2 text-body-lg text-ink-strong">Payment stays in escrow until delivery is confirmed.</p>
      <ol className="mt-2 flex flex-col gap-1 text-body-sm text-ink-strong">
        <li>01 Review the supplier and goods</li>
        <li>02 Keep evidence of the order and delivery</li>
        <li>03 Follow the order status</li>
      </ol>
    </section>
  );
}

export function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pages" className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <Button size="md" variant="outlined" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <span className="text-body-sm text-ink-muted">
        Page {page} of {totalPages}
      </span>
      <Button size="md" variant="outlined" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </nav>
  );
}

export const dateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }).replace(",", " •") : "";

/** Nigerian mobile or landline, the forms the backend accepts (0803 123 4567, +234 803 123 4567). */
export const isNigerianPhone = (v: string) => /^(\+?234|0)[1-9]\d{8,9}$/.test(v.replace(/[\s()-]/g, ""));
