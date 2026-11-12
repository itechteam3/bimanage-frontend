import type { ReactNode } from "react";
import { IconDiamond, IconSparkles, IconArrowUpRight } from "@tabler/icons-react";
import { Logo } from "@/components/brand/Logo";
import { Status } from "@/components/ui";
import { cn } from "@/lib/cn";

// Authentication layout (Figma 01.xx).
// Desktop: 570px brand panel + form column (645px).
//   panel="showcase" (01.01, 01.02, 1882:1389): gradient with product cards.
//   panel="security" (01.03–01.14, 1918:1454): solid navy, "Secure access".
// Mobile (1888:2872): 68px navy header, form, optional reassurance card.
export interface AuthLayoutProps {
  panel?: "showcase" | "security";
  /** e.g. "Welcome back" — desktop only, above the title. */
  kicker?: string;
  title: string;
  /** Mobile frames often use a shorter/friendlier title. */
  mobileTitle?: string;
  subtitle?: ReactNode;
  mobileSubtitle?: ReactNode;
  /** Show the "Your business, in one place" card under the form on mobile. */
  reassurance?: boolean;
  children: ReactNode;
}

const bars = [26, 36, 31, 43, 38, 47, 55]; // showcase chart heights (data), Figma 1882:1389

function ShowcasePanel() {
  return (
    <aside aria-hidden="true" className="relative hidden w-auth-panel shrink-0 overflow-hidden bg-gradient-brand-panel px-12 py-10 text-ink-on-brand lg:flex lg:flex-col">
      <Logo tone="on-brand" />
      <p className="mt-5 text-body-sm font-semibold uppercase text-ink-on-brand-accent">Your business. One workspace.</p>
      <h2 className="mt-14 text-hero">
        Business feels lighter
        <br />
        when everything flows.
      </h2>
      <p className="mt-6 max-w-brand-copy text-body-lg text-ink-on-brand-muted">
        From the first sale to the next milestone — stay in control, beautifully.
      </p>
      <div className="mt-14 flex flex-col gap-6 text-ink-strong">
        <div className="w-showcase-sales rounded-3xl bg-surface-card p-5 shadow-floating">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-caption font-semibold uppercase text-ink-muted">Sales this month</p>
              <p className="mt-1 text-metric text-ink-brand">₦1,280,400</p>
            </div>
            <Status tone="success">↗ 12.8%</Status>
          </div>
          <div className="mt-3 flex h-14 items-end gap-7">
            {bars.map((h, i) => (
              <span
                key={i}
                className={i === bars.length - 1 ? "w-7 rounded-sm bg-brand-navy" : "w-7 rounded-sm bg-brand-chart-bar"}
                style={{ height: `${h}px` }}
              />
            ))}
          </div>
        </div>
        <div className="ml-16 w-showcase-store rounded-2xl bg-surface-card p-5 shadow-floating">
          <div className="flex items-start gap-4">
            <span className="flex size-feature-icon items-center justify-center rounded-xl bg-surface-tint-blue text-ink-brand">
              <IconDiamond className="size-icon" />
            </span>
            <div className="flex-1">
              <p className="text-card-heading">Online store</p>
              <p className="text-body-sm text-ink-muted">38 orders · 24 products live</p>
            </div>
            <Status tone="live">Live</Status>
          </div>
          <p className="mt-4 flex items-center gap-1 text-caption font-semibold text-ink-brand">
            View your shop, products and payments at a glance <IconArrowUpRight className="size-4" />
          </p>
        </div>
        <div className="-ml-3 w-showcase-feli rounded-icon bg-surface-tint-feli p-5 shadow-floating">
          <div className="flex items-center gap-4">
            <span className="flex size-feature-icon items-center justify-center rounded-xl bg-surface-tint-lavender text-brand-violet">
              <IconSparkles className="size-icon" />
            </span>
            <div>
              <p className="text-body font-semibold">FELI AI&nbsp;&nbsp;/&nbsp;&nbsp;Inventory insight</p>
              <p className="text-caption text-ink-muted">7 products are running low. Review stock →</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function SecurityPanel() {
  return (
    <aside aria-hidden="true" className="hidden w-auth-panel shrink-0 bg-brand-navy-panel px-12 py-10 text-ink-on-brand lg:flex lg:flex-col">
      <Logo tone="on-brand" />
      <p className="mt-5 text-body-sm font-semibold uppercase text-ink-on-brand-accent">Security &amp; account</p>
      <h2 className="mt-14 text-hero">
        Secure access
        <br />
        for your business.
      </h2>
      <p className="mt-6 text-body-lg text-ink-on-brand-muted">A clear path back to your BiManage workspace.</p>
    </aside>
  );
}

function MobileReassurance() {
  return (
    <aside className="rounded-icon border border-line-tint bg-surface-tint-blue p-6 lg:hidden">
      <p className="text-body-sm font-semibold uppercase text-ink-brand">Your business, in one place</p>
      <p className="mt-2 text-body font-semibold text-ink-strong">Sales • Teams • Online Store • FELI AI</p>
      <p className="mt-1 text-body-sm text-ink-muted">A calmer way to grow your business.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <span className="rounded-lg bg-surface-card px-2 py-1.5 text-body-sm font-semibold text-ink-brand">↗ Sales insights</span>
        <span className="rounded-lg bg-surface-card px-2 py-1.5 text-body-sm font-semibold text-ink-brand">◈ Smart operations</span>
      </div>
    </aside>
  );
}

export function AuthLayout({
  panel = "showcase",
  kicker,
  title,
  mobileTitle,
  subtitle,
  mobileSubtitle,
  reassurance = false,
  children,
}: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-page lg:flex-row lg:bg-surface-card">
      <header className="flex h-mobile-header items-center bg-brand-navy px-5 lg:hidden">
        <Logo tone="on-brand" compact />
      </header>
      {panel === "showcase" ? <ShowcasePanel /> : <SecurityPanel />}
      <main className="flex flex-1 justify-center px-5 py-8 lg:px-20 lg:py-16">
        <div className="flex w-full max-w-mobile-content flex-col gap-4 lg:max-w-auth-form lg:gap-0">
          <p className="text-action font-semibold uppercase text-ink-brand lg:mb-20">
            Secure access&nbsp;&nbsp;/&nbsp;&nbsp;BiManage
          </p>
          {kicker && <p className="hidden text-action font-semibold uppercase text-ink-brand lg:block">{kicker}</p>}
          <h1 className="text-title-md text-ink-strong lg:mt-3 lg:text-display">
            {mobileTitle ? (
              <>
                <span className="lg:hidden">{mobileTitle}</span>
                <span className="hidden lg:inline">{title}</span>
              </>
            ) : (
              title
            )}
          </h1>
          {(subtitle || mobileSubtitle) && (
            <div className="text-body-lg text-ink-secondary lg:mt-4">
              {mobileSubtitle ? (
                <>
                  <span className="lg:hidden">{mobileSubtitle}</span>
                  <span className="hidden lg:inline">{subtitle}</span>
                </>
              ) : (
                subtitle
              )}
            </div>
          )}
          <div className="lg:mt-10">{children}</div>
          {reassurance && (
            <div className="mt-4">
              <MobileReassurance />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/** Small print under a form. tone="success" is the green reassurance line (Figma 1882:1388). */
export function AuthNote({ tone = "muted", className, children }: { tone?: "muted" | "success" | "danger"; className?: string; children: ReactNode }) {
  return (
    <p
      role={tone === "danger" ? "alert" : undefined}
      className={cn(
        "text-body-lg",
        tone === "muted" && "text-ink-secondary",
        tone === "success" && "text-success-ink",
        tone === "danger" && "text-danger",
        className
      )}
    >
      {children}
    </p>
  );
}

/** Read-only labelled value (01.06 "ACCOUNT", 01.09 "EMAIL ENTERED", "PRIVACY NOTE"). */
export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-sm bg-surface-pale px-4 py-2.5 lg:gap-1.5 lg:bg-transparent lg:p-0">
      <p className="text-field-label uppercase text-ink-brand lg:text-ink-secondary">{label}</p>
      <div className="text-input font-normal text-ink-strong lg:flex lg:min-h-control-lg lg:items-center lg:rounded-sm lg:border lg:border-line-default lg:px-4 lg:py-3 lg:font-medium">
        {children}
      </div>
    </div>
  );
}

/** Secondary actions: side by side on desktop (260px each, 4126:23), stacked on mobile. */
export function AuthActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 lg:flex-row lg:[&>*]:w-auth-action">{children}</div>;
}
