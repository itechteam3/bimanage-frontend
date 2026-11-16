import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { IconSearch, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { usePublicPlans } from "@/lib/landing/api";
import { useFaqs } from "@/lib/support/api";
import { useJsonLd } from "@/lib/seo/jsonLd";
import { Container, PublicLayout, reducedMotion } from "./PublicLayout";
import { FaqAccordion } from "./FaqAccordion";
import { ALL_FAQS, FAQ_GROUPS, faqJsonLd, fold, resolveFaqText, type FaqGroup, type FaqItem } from "./faq";
import { FeliAvatar } from "@/components/feli/FeliAvatar";

// /faq: every public question, grouped by topic. Deep links per topic:
// /faq#billing and /faq?topic=billing both select and scroll to it (FELI and
// emails can link straight there). Search filters as you type.

const HELP_SLUG = "more";

/** The public help-centre FAQs that aren't already answered here. */
function useHelpCentreGroup(): FaqGroup | null {
  const { data } = useFaqs("", "");
  return useMemo(() => {
    const known = new Set(ALL_FAQS.map((f) => fold(f.q).trim()));
    const items: FaqItem[] = (data ?? [])
      .filter((f) => f.question && f.answer && !known.has(fold(f.question).trim()))
      // A short answer here; the full article (steps, links) is on the public help centre.
      .map((f) => ({ id: `help-${f._id}`, q: f.question, a: f.summary ? [f.summary] : String(f.answer).split(/\n{2,}/).filter(Boolean), help: `/help/${encodeURIComponent(f.slug || f._id)}` }));
    return items.length ? { slug: HELP_SLUG, title: "More answers", items } : null;
  }, [data]);
}

/** The topic in the address (?topic= first, then #). */
function topicFromLocation(search: string, hash: string, groups: FaqGroup[]) {
  const wanted = new URLSearchParams(search).get("topic") || decodeURIComponent(hash.replace(/^#/, ""));
  return groups.some((g) => g.slug === wanted) ? wanted : null;
}

export default function FaqPage() {
  const { data: plans } = usePublicPlans();
  const helpGroup = useHelpCentreGroup();
  const groups = useMemo(() => (helpGroup ? [...FAQ_GROUPS, helpGroup] : FAQ_GROUPS), [helpGroup]);
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(() => topicFromLocation(location.search, location.hash, FAQ_GROUPS));
  const scrolledFor = useRef<string>("");

  // Select and scroll to the topic in the address (also once "More answers" loads).
  useEffect(() => {
    const topic = topicFromLocation(location.search, location.hash, groups);
    if (!topic) return;
    setActive(topic);
    const key = `${location.key}:${topic}`;
    if (scrolledFor.current === key) return;
    const el = document.getElementById(topic);
    if (!el) return;
    scrolledFor.current = key;
    el.scrollIntoView?.({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  }, [location.key, location.search, location.hash, groups]);

  // Search: question + answer (prices filled in), case- and accent-insensitive.
  const q = fold(query.trim());
  const filtered = useMemo(() => {
    if (!q) return groups;
    const words = q.split(/\s+/).filter(Boolean);
    return groups
      .map((g) => ({ ...g, items: g.items.filter((f) => { const text = fold(`${f.q} ${f.a.map((p) => resolveFaqText(p, plans) ?? p).join(" ")}`); return words.every((w) => text.includes(w)); }) }))
      .filter((g) => g.items.length);
  }, [groups, q, plans]);
  const count = filtered.reduce((n, g) => n + g.items.length, 0);

  // One FAQPage block, for this page only, from the same content (prices filled or left out).
  useJsonLd("faq-jsonld", useMemo(() => faqJsonLd(ALL_FAQS, plans), [plans]));

  const goTopic = (slug: string) => {
    setQuery("");
    navigate({ pathname: "/faq", search: "", hash: slug }, { replace: false });
  };
  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));

  const topicLink = (g: FaqGroup, layout: "bar" | "side") => {
    const selected = active === g.slug;
    return (
      <a
        key={g.slug}
        href={`/faq#${g.slug}`}
        aria-current={selected ? "true" : undefined}
        onClick={(e) => {
          e.preventDefault();
          goTopic(g.slug);
        }}
        className={cn(
          "inline-flex min-h-11 items-center rounded-md text-body-lg font-semibold transition-colors",
          layout === "bar" ? "shrink-0 whitespace-nowrap border px-4" : "w-full px-3",
          selected ? "border-brand-navy bg-surface-tint-blue text-ink-brand" : layout === "bar" ? "border-line-card bg-surface-card text-ink-strong" : "text-ink-secondary hover:bg-surface-pale hover:text-ink-strong",
        )}
      >
        {g.title}
      </a>
    );
  };

  return (
    <PublicLayout>
      <section className="bg-brand-navy text-ink-on-brand">
        <Container className="py-12 md:py-16">
          <p className="text-caption font-semibold uppercase tracking-wide text-ink-on-brand-accent">FAQ</p>
          <h1 className="mt-2 text-title-lg md:text-page-title">Frequently asked questions</h1>
          <p className="mt-3 max-w-[40rem] text-body-lg text-ink-on-brand-muted">How BiManage works today: plans and billing, your online store, payouts, BiSupplyNet escrow, FELI and your data.</p>
          <div className="relative mt-6 max-w-[36rem]">
            <label htmlFor="faq-search" className="sr-only">Search the FAQ</label>
            <IconSearch className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <input
              id="faq-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search questions, e.g. payouts or escrow"
              autoComplete="off"
              className="h-control-lg min-h-11 w-full min-w-0 rounded-md border border-line-card bg-surface-card pl-12 pr-12 text-input text-ink-strong outline-none placeholder:text-ink-muted focus:border-brand-navy"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-ink-muted hover:text-ink-strong">
                <IconX className="size-5" aria-hidden="true" />
              </button>
            )}
          </div>
        </Container>
      </section>

      {/* Phones and tablets: topics in a bar that scrolls sideways inside itself. */}
      <div className="lp-no-print sticky top-mobile-header z-10 border-b border-line-subtle bg-surface-page/95 backdrop-blur lg:hidden">
        <nav aria-label="FAQ topics" className="lp-topics mx-auto flex w-full max-w-[75rem] gap-2 overflow-x-auto px-5 py-3 md:px-8">
          {groups.map((g) => topicLink(g, "bar"))}
        </nav>
      </div>

      <Container className="py-10 lg:py-14">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <aside className="lp-no-print hidden lg:block">
            <nav aria-label="FAQ topics" className="sticky top-[calc(var(--spacing-header)+1.5rem)] flex flex-col gap-1">
              <p className="mb-2 px-3 text-caption font-semibold uppercase tracking-wide text-ink-muted">Topics</p>
              {groups.map((g) => topicLink(g, "side"))}
            </nav>
          </aside>

          <div className="min-w-0">
            <p className="mb-6 text-body-lg text-ink-muted" role="status" aria-live="polite">
              {q ? `${count} ${count === 1 ? "result" : "results"} for "${query.trim()}"` : `${count} questions in ${groups.length} topics`}
            </p>

            {count === 0 ? (
              <div className="rounded-2xl border border-line-card bg-surface-card p-6">
                <h2 className="text-title-sm text-ink-strong">No results</h2>
                <p className="mt-2 text-body-lg text-ink-muted">Try other words, or ask us directly.</p>
                <p className="mt-4 flex flex-wrap gap-x-6 gap-y-1">
                  <Link to="/feli" className="inline-flex min-h-11 items-center gap-2 text-body-lg font-semibold text-ink-brand hover:underline"><FeliAvatar size="xs" decorative />Ask FELI (sign in)</Link>
                  <Link to="/contact" className="inline-flex min-h-11 items-center text-body-lg font-semibold text-ink-brand hover:underline">Contact us</Link>
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-12">
                {filtered.map((g) => (
                  <section key={g.slug} id={g.slug} aria-labelledby={`${g.slug}-title`} className="scroll-mt-36 lg:scroll-mt-28">
                    <h2 id={`${g.slug}-title`} className="mb-4 text-section-title text-ink-strong">{g.title}</h2>
                    <FaqAccordion items={g.items} plans={plans} openId={openId} onToggle={toggle} details />
                  </section>
                ))}
              </div>
            )}

            <div className="mt-12 rounded-2xl bg-surface-card p-6 shadow-card">
              <h2 className="text-title-sm text-ink-strong">Still have a question?</h2>
              <p className="mt-2 text-body-lg text-ink-muted">Send us a message and we'll reply by email. The <Link to="/terms" className="font-semibold text-ink-brand hover:underline">Terms of Service</Link> and <Link to="/privacy" className="font-semibold text-ink-brand hover:underline">Privacy Policy</Link> have the full details.</p>
              <Link to="/contact" className="mt-4 inline-flex min-h-11 items-center rounded-md bg-brand-navy px-5 text-action font-semibold text-ink-on-brand">Contact us</Link>
            </div>
          </div>
        </div>
      </Container>
    </PublicLayout>
  );
}

