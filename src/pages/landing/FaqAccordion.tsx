import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { IconChevronDown, IconThumbDown, IconThumbUp } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import type { PublicPlans } from "@/lib/landing/api";
import { PRICE_FALLBACK, pricesProvisional, resolveFaqText, type FaqItem } from "./faq";

// The public FAQ accordion (landing preview and /faq): one answer open at a
// time (the parent owns `openId`), animated open/close (landing.css .lp-acc,
// off for reduced motion), buttons with aria-expanded/aria-controls and a
// labelled region for each answer.

// ── "Was this helpful?" (kept in this browser only) ─────────────────────────
// The help centre's helpful endpoint needs sign-in, so public votes stay local.
const VOTES_KEY = "bimanage.faqHelpful";
type Vote = "yes" | "no";
function readVotes(): Record<string, Vote> {
  try {
    const v = JSON.parse(window.localStorage.getItem(VOTES_KEY) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}
export const faqVotes = {
  key: VOTES_KEY,
  get: (id: string): Vote | null => readVotes()[id] ?? null,
  set(id: string, vote: Vote) {
    try {
      window.localStorage.setItem(VOTES_KEY, JSON.stringify({ ...readVotes(), [id]: vote }));
    } catch {
      /* storage unavailable: the thanks still shows for this visit */
    }
  },
};

function Helpful({ id }: { id: string }) {
  const [vote, setVote] = useState<Vote | null>(() => faqVotes.get(id));
  const choose = (v: Vote) => {
    faqVotes.set(id, v);
    setVote(v);
  };
  if (vote)
    return (
      <p className="text-body-sm text-ink-muted" role="status">
        {vote === "yes" ? "Thanks for letting us know." : "Thanks. Tell us what was missing on the contact page."}
        {vote === "no" && (
          <>
            {" "}
            <Link to="/contact" className="font-semibold text-ink-brand hover:underline">Contact us</Link>
          </>
        )}
      </p>
    );
  const btn = "inline-flex min-h-11 items-center gap-1.5 rounded-md border border-line-card bg-surface-card px-3 text-body-sm font-semibold text-ink-strong hover:border-brand-navy";
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Was this helpful?">
      <span className="text-body-sm text-ink-muted">Was this helpful?</span>
      <button type="button" className={btn} onClick={() => choose("yes")}>
        <IconThumbUp className="size-4" aria-hidden="true" /> Yes
      </button>
      <button type="button" className={btn} onClick={() => choose("no")}>
        <IconThumbDown className="size-4" aria-hidden="true" /> No
      </button>
    </div>
  );
}

/** An answer's paragraphs with prices filled in from the plans API. */
export function FaqAnswer({ item, plans }: { item: FaqItem; plans: PublicPlans | undefined }) {
  const usesPrices = item.a.some((p) => p.includes("{price:") || p.includes("{package:"));
  return (
    <>
      {item.a.map((p, i) => (
        <p key={i} className="text-body-lg text-ink-muted">
          {resolveFaqText(p, plans) ?? PRICE_FALLBACK}
        </p>
      ))}
      {usesPrices && pricesProvisional(plans) && <p className="text-body-sm text-ink-muted">Some prices are introductory and may change; you'll always see the price before you pay.</p>}
    </>
  );
}

export function FaqAccordion({
  items,
  plans,
  openId,
  onToggle,
  details = false,
}: {
  items: FaqItem[];
  plans: PublicPlans | undefined;
  openId: string | null;
  onToggle: (id: string) => void;
  /** Links, help-centre pointer and "Was this helpful?" (the /faq page). */
  details?: boolean;
}) {
  const base = useId();
  return (
    <div className="flex flex-col gap-3">
      {items.map((f) => {
        const open = openId === f.id;
        const btnId = `${base}-${f.id}-q`;
        const panelId = `${base}-${f.id}-a`;
        return (
          <div key={f.id} id={`q-${f.id}`} className={cn("scroll-mt-28 rounded-xl border bg-surface-page transition-colors", open ? "border-brand-navy" : "border-line-card")}>
            <h3 className="m-0">
              <button
                type="button"
                id={btnId}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => onToggle(f.id)}
                className="flex min-h-14 w-full items-center justify-between gap-4 rounded-xl px-5 py-3 text-left text-card-heading text-ink-strong"
              >
                <span className="min-w-0">{f.q}</span>
                <IconChevronDown className={cn("lp-acc-icon size-5 shrink-0 text-ink-muted", open && "rotate-180")} aria-hidden="true" />
              </button>
            </h3>
            <div id={panelId} role="region" aria-labelledby={btnId} className={cn("lp-acc", open && "lp-acc-open")} {...(open ? {} : ({ inert: "" } as Record<string, string>))}>
              <div className="min-h-0 overflow-hidden">
                <div className="flex flex-col gap-3 px-5 pb-5">
                  <FaqAnswer item={f} plans={plans} />
                  {details && (f.links?.length || f.help) ? (
                    <ul className="flex flex-wrap gap-x-5 gap-y-1">
                      {f.links?.map((l) => (
                        <li key={l.to}>
                          <Link to={l.to} className="inline-flex min-h-11 items-center text-body-sm font-semibold text-ink-brand hover:underline">{l.label}</Link>
                        </li>
                      ))}
                      {f.help && (
                        <li>
                          <Link to={f.help} className="inline-flex min-h-11 items-center text-body-sm font-semibold text-ink-brand hover:underline">Step-by-step guide in the help centre</Link>
                        </li>
                      )}
                    </ul>
                  ) : null}
                  {details && open && <Helpful id={f.id} />}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
