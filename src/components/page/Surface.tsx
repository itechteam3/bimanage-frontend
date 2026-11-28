import type { ReactNode } from "react";
import { IconCheck } from "@tabler/icons-react";
import { cn } from "@/lib/cn";

// Building blocks of the 26 Nov 2026 designs (selling channels and later):
// a work surface with a tinted context stripe behind the title, choice cards,
// notices and a feature card with an eyebrow and a small illustration.
// Figma: "BACKGROUND • Context stripe / Premium work surface", "CHANNEL • …",
// "NOTICE • …", "FEATURE • …" (e.g. 4216:677).

export type SurfaceTone = "blue" | "violet" | "aqua";

const TONE = {
  blue: { band: "bg-surface-pale", halo: "bg-surface-halo-blue", accent: "text-accent-blue", stroke: "stroke-accent-blue", ground: "bg-surface-pale", line: "border-accent-blue" },
  violet: { band: "bg-surface-tint-violet", halo: "bg-surface-halo-violet", accent: "text-accent-lavender", stroke: "stroke-accent-lavender", ground: "bg-surface-tint-violet", line: "border-accent-lavender" },
  aqua: { band: "bg-surface-tint-aqua", halo: "bg-surface-tint-aqua", accent: "text-accent-teal", stroke: "stroke-accent-teal", ground: "bg-surface-tint-aqua", line: "border-accent-teal" },
} as const;

/**
 * The page's work surface: title and lead on a tinted stripe, content on
 * white. Full width on phones, a rounded card from lg.
 */
export function WorkSurface({ title, lead, tone = "blue", children }: { title: ReactNode; lead?: ReactNode; tone?: SurfaceTone; children: ReactNode }) {
  const t = TONE[tone];
  return (
    <section className="relative -mx-5 overflow-hidden bg-surface-page lg:mx-0 lg:rounded-3xl lg:border lg:border-line-subtle lg:bg-surface-card">
      <div aria-hidden="true" className={cn("pointer-events-none absolute -top-4 right-4 hidden size-[170px] rounded-full lg:block", t.halo)} />
      <div className={cn("relative px-5 pb-12 pt-8 lg:px-[30px] lg:pt-5", t.band)}>
        <h1 className="text-title-lg text-ink-strong lg:text-page-title">{title}</h1>
        {lead && <p className="mt-3 max-w-3xl text-body-lg text-ink-muted lg:mt-6 lg:text-[15px] lg:leading-[22px]">{lead}</p>}
      </div>
      <div className="relative -mt-6 flex flex-col gap-6 px-5 pb-8 lg:px-[30px]">{children}</div>
    </section>
  );
}

/** A selectable option (radio) card: "Retail", "Wholesale", "Both". */
export function ChoiceCard({
  name,
  value,
  checked,
  onChange,
  title,
  body,
  tag,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  title: string;
  body: ReactNode;
  tag?: ReactNode;
}) {
  return (
    <label
      className={cn(
        "relative flex min-w-0 cursor-pointer flex-col gap-2 rounded-lg border bg-surface-card p-[18px] transition-colors",
        "has-[:focus-visible]:shadow-focus",
        checked ? "border-accent-navy bg-surface-tint-blue" : "border-line-default hover:border-line-strong"
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} className="sr-only" />
      <span className="flex items-center gap-2 text-[19px] font-semibold leading-7 text-ink-strong">
        {title}
        {checked && <IconCheck aria-hidden="true" className="size-5" stroke={2} />}
      </span>
      <span className="text-[13px] leading-5 text-ink-muted">{body}</span>
      {tag && <span className={cn("text-caption font-medium", checked ? "text-accent-navy" : "text-accent-green")}>{tag}</span>}
    </label>
  );
}

/** A static channel/info card with the same look as a choice card. */
export function InfoTile({ title, body, tag, badge }: { title: ReactNode; body: ReactNode; tag?: ReactNode; badge?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-line-default bg-surface-card p-[18px]">
      <span className="flex flex-wrap items-center gap-2 text-[19px] font-semibold leading-7 text-ink-strong">
        {title}
        {badge}
      </span>
      <span className="text-[13px] leading-5 text-ink-muted">{body}</span>
      {tag && <span className="text-caption font-medium text-accent-green">{tag}</span>}
    </div>
  );
}

/** A notice band: green ("One account. Shared business history.") or blue. */
export function Notice({ title, children, tone = "green" }: { title: ReactNode; children: ReactNode; tone?: "green" | "blue" }) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-md px-[15px] py-[15px]", tone === "green" ? "bg-success-bg" : "bg-surface-tint-blue")}>
      <p className="text-body-lg font-semibold text-ink-strong">{title}</p>
      <p className="text-caption text-ink-secondary">{children}</p>
    </div>
  );
}

/** "FEATURE • …": eyebrow, title, body and an illustration strip. */
export function FeatureCard({ eyebrow, title, children, tone = "blue", art }: { eyebrow: string; title: ReactNode; children: ReactNode; tone?: SurfaceTone; art?: ReactNode }) {
  const t = TONE[tone];
  return (
    <section className="flex min-w-0 flex-col gap-2 rounded-lg border border-line-card bg-surface-card p-[19px]">
      <p className={cn("text-[11px] font-semibold uppercase leading-4 tracking-[0.02em]", t.accent)}>{eyebrow}</p>
      <h2 className="text-[17px] font-semibold leading-[26px] text-ink-strong">{title}</h2>
      <p className="text-[13px] leading-5 text-ink-muted">{children}</p>
      {art && <div className={cn("mt-2 flex h-[116px] items-center justify-center rounded-xl", t.ground)}>{art}</div>}
    </section>
  );
}

/** Three icons joined by a dashed line (the designs' channel illustration). */
export function ChannelArt({ icons, tone = "blue" }: { icons: [ReactNode, ReactNode, ReactNode]; tone?: SurfaceTone }) {
  const t = TONE[tone];
  return (
    <div aria-hidden="true" className={cn("relative flex w-full max-w-[574px] items-center justify-between px-6 lg:px-0", t.accent)}>
      <span className={cn("absolute inset-x-12 top-1/2 border-t-[2.5px] border-dashed lg:inset-x-8", t.line)} />
      {icons.map((icon, i) => (
        <span key={i} className={cn("relative flex items-center justify-center rounded-[12px] border-2 bg-surface-card", t.line, i === 1 ? "h-16 w-[68px]" : "h-14 w-16")}>
          {i === 1 && <span className={cn("absolute -top-1.5 size-2.5 rounded-full bg-current")} />}
          {icon}
        </span>
      ))}
    </div>
  );
}
