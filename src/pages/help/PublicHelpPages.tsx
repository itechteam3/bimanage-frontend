import { useMemo, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { IconArrowRight, IconBook, IconLifebuoy, IconMail, IconSearch, IconSearchOff, IconThumbDown, IconThumbUp } from "@tabler/icons-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Spinner } from "@/components/ui";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { useAuth } from "@/lib/auth/AuthProvider";
import { usePageMeta } from "@/lib/seo/meta";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { HELP_CATEGORIES, TICKET_CATEGORIES, helpCategoryLabel, useFaq, useFaqs, useVoteFaq, type Faq } from "@/lib/support/api";
import { ArticleBody, type HrefFor } from "@/pages/support/ArticleBody";
import { Container, PublicLayout } from "@/pages/landing/PublicLayout";

// The public help centre (2026-11-16): /help and /help/<slug>, read-only, for
// everyone, signed in or out, inside the public site's navbar and footer.
// Same articles (GET /support/faqs, public) and the same renderer as the
// in-app help centre (/support/help), which signed-in people keep using.

/** Short lines under each topic, in the help centre's topic order. */
const TOPIC_BLURBS: Record<string, string> = {
  getting_started: "Create your account and set up your business.",
  billing: "Plans, payments and receipts.",
  orders: "Creating, updating and tracking orders.",
  store: "Building and publishing your online store.",
  bisupplynet: "Supplier orders and protected payments.",
  wallet: "Your balance, bank account and withdrawals.",
  inventory: "Products, stock and barcodes.",
  invoices: "Create, send and track invoices.",
  customers: "Your customer records and history.",
  projects: "Projects, tasks and your team.",
  reports: "Sales reports and exports.",
  messages: "Messages, chats and notifications.",
  feli: "Your AI assistant inside BiManage.",
  account: "Sign-in, password and security.",
  technical: "When something doesn't work as expected.",
};

const articlePath = (f: Pick<Faq, "slug" | "_id">) => `/help/${encodeURIComponent(f.slug || f._id)}`;
/** Article links to other articles open the public page; other in-app links stay as they are (sign-in first). */
const publicHref: HrefFor = (href) => href.replace(/^\/support\/help(?=\/|\?|#|$)/, "/help");

const topicOrder = (list: Faq[]) => [...new Set([...HELP_CATEGORIES.map(([k]) => k), ...list.map((f) => f.category)])];

function Loading({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-3 py-10 text-body text-ink-muted">
      <Spinner /> {label}
    </div>
  );
}

function ArticleLink({ f, showTopic = false }: { f: Faq; showTopic?: boolean }) {
  return (
    <li>
      <Link to={articlePath(f)} className="flex items-center justify-between gap-4 py-3 hover:bg-surface-pale md:px-2">
        <span className="min-w-0">
          <span className="block font-semibold text-ink-strong">{f.question}</span>
          {f.summary ? <span className="block text-body-sm text-ink-secondary">{f.summary}</span> : null}
          {showTopic ? <span className="block text-body-sm text-ink-muted">{helpCategoryLabel(f.category)}</span> : null}
        </span>
        <IconArrowRight aria-hidden="true" className="size-4 shrink-0 text-ink-brand" />
      </Link>
    </li>
  );
}

function StillNeedHelp({ category }: { category?: string }) {
  const signedIn = useAuth().status === "authenticated";
  const ticketCategory = category && TICKET_CATEGORIES.some(([k]) => k === category) ? category : "";
  return (
    <section aria-labelledby="still-need-help" className="rounded-2xl bg-surface-pale p-5 shadow-card lg:p-6">
      <h2 id="still-need-help" className="text-title-sm text-ink-strong">
        Still need help?
      </h2>
      <p className="mt-1 text-body text-ink-muted">Our team replies by email.</p>
      <div className="mt-4 flex flex-col gap-3 md:flex-row">
        <ButtonLink to="/contact?topic=support" variant="outlined" size="md">
          <IconMail aria-hidden="true" className="size-4" /> Contact us
        </ButtonLink>
        {signedIn && (
          <ButtonLink to={ticketCategory ? `/support/tickets/new?category=${encodeURIComponent(ticketCategory)}` : "/support/tickets/new"} size="md">
            <IconLifebuoy aria-hidden="true" className="size-4" /> Open a support ticket
          </ButtonLink>
        )}
      </div>
    </section>
  );
}

// ── /help ────────────────────────────────────────────────────────────────

export function PublicHelpCentrePage() {
  const [params, setParams] = useSearchParams();
  const topic = params.get("category") ?? "";
  const [text, setText] = useState(params.get("q") ?? "");
  const faqs = useFaqs("", "");
  const all = useMemo(() => faqs.data ?? [], [faqs.data]);
  const term = text.trim().toLowerCase();
  // Filters as you type: titles and summaries.
  const matches = term ? all.filter((f) => `${f.question} ${f.summary ?? ""}`.toLowerCase().includes(term)) : [];
  const topics = topicOrder(all).filter((k) => all.some((f) => f.category === k));
  const shown = topic ? topics.filter((k) => k === topic) : topics;
  const pickTopic = (k: string) => setParams(k ? { category: k } : {}, { replace: true });

  return (
    <PublicLayout>
      <section className="bg-brand-navy py-12 text-ink-on-brand md:py-16">
        <Container className="max-w-[50rem]">
          <h1 className="text-title-lg md:text-page-title">Help centre</h1>
          <p className="mt-3 text-body-lg text-ink-on-brand-muted">Step-by-step guides for every part of BiManage: your store, orders, inventory, wallet, BiSupplyNet and more.</p>
          <form role="search" onSubmit={(e) => e.preventDefault()} className="mt-6">
            <label htmlFor="help-search" className="sr-only">
              Search help articles
            </label>
            <div className="flex h-control-lg min-h-11 items-center gap-2 rounded-md bg-surface-card px-4">
              <IconSearch aria-hidden="true" className="size-icon shrink-0 text-ink-muted" />
              <input
                id="help-search"
                type="search"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Search, for example: withdraw to my bank"
                className="h-full min-w-0 flex-1 bg-transparent text-input text-ink-strong outline-none placeholder:text-ink-muted"
              />
            </div>
          </form>
        </Container>
      </section>

      <Container className="flex max-w-[60rem] flex-col gap-8 py-10 md:py-12">
        {faqs.isLoading ? (
          <Loading label="Loading help articles…" />
        ) : faqs.error ? (
          <ErrorNote error={faqs.error} fallback="We couldn't load the help articles." onRetry={() => void faqs.refetch()} />
        ) : term ? (
          <section aria-labelledby="results-title" className="flex flex-col gap-3">
            <h2 id="results-title" className="text-title-sm text-ink-strong" aria-live="polite">
              {matches.length ? `${matches.length} ${matches.length === 1 ? "article" : "articles"} found` : "No articles match your search"}
            </h2>
            {matches.length ? (
              <ul className="flex flex-col divide-y divide-line-subtle rounded-2xl border border-line-card bg-surface-card px-5 shadow-card">
                {matches.map((f) => (
                  <ArticleLink key={f._id} f={f} showTopic />
                ))}
              </ul>
            ) : (
              <div className="flex items-start gap-3 rounded-2xl bg-surface-pale p-5">
                <IconSearchOff aria-hidden="true" className="size-6 shrink-0 text-ink-muted" />
                <p className="text-body text-ink-muted">Try other words, or browse the topics below by clearing the search.</p>
              </div>
            )}
          </section>
        ) : !all.length ? (
          <p className="text-body text-ink-muted">No help articles yet.</p>
        ) : (
          <>
            <section aria-labelledby="topics-title" className="flex flex-col gap-3">
              <h2 id="topics-title" className="text-title-sm text-ink-strong">
                Help topics
              </h2>
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 lg:grid-cols-3">
                {topics.map((k) => (
                  <li key={k}>
                    <a
                      href={`?category=${k}`}
                      onClick={(e) => {
                        e.preventDefault();
                        pickTopic(topic === k ? "" : k);
                      }}
                      aria-current={topic === k ? "true" : undefined}
                      className={cn("flex h-full items-start gap-3 rounded-2xl border bg-surface-card p-4 shadow-card hover:border-brand-navy", topic === k ? "border-brand-navy" : "border-line-card")}
                    >
                      <IconBook aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ink-brand" />
                      <span className="min-w-0">
                        <span className="block font-semibold text-ink-strong">{helpCategoryLabel(k)}</span>
                        {TOPIC_BLURBS[k] ? <span className="block text-body-sm text-ink-muted">{TOPIC_BLURBS[k]}</span> : null}
                        <span className="block text-body-sm text-ink-muted">{all.filter((f) => f.category === k).length} articles</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              {topic && (
                <button type="button" onClick={() => pickTopic("")} className="inline-flex min-h-11 items-center self-start font-semibold text-ink-brand underline-offset-2 hover:underline">
                  Show all topics
                </button>
              )}
            </section>
            {shown.map((k) => (
              <section key={k} id={`topic-${k}`} aria-labelledby={`topic-${k}-title`} className="flex scroll-mt-24 flex-col gap-3">
                <h2 id={`topic-${k}-title`} className="text-title-sm text-ink-strong">
                  {helpCategoryLabel(k)}
                </h2>
                <ul className="flex flex-col divide-y divide-line-subtle rounded-2xl border border-line-card bg-surface-card px-5 shadow-card">
                  {all
                    .filter((f) => f.category === k)
                    .map((f) => (
                      <ArticleLink key={f._id} f={f} />
                    ))}
                </ul>
              </section>
            ))}
          </>
        )}
        <StillNeedHelp />
      </Container>
    </PublicLayout>
  );
}

// ── /help/<slug> ─────────────────────────────────────────────────────────

function Feedback({ id }: { id: string }) {
  const vote = useVoteFaq(id);
  const thanks = vote.data ? (vote.data.alreadyVoted ? "Thanks, we already have your feedback." : "Thanks for your feedback.") : null;
  return (
    <section aria-labelledby="helpful-title" className="rounded-2xl border border-line-card bg-surface-card p-5 shadow-card lg:p-6">
      <h2 id="helpful-title" className="text-title-sm text-ink-strong">
        Was this helpful?
      </h2>
      <div className="mt-4">
        {thanks ? (
          <p role="status" className="text-body-sm text-success-ink">
            {thanks}
          </p>
        ) : (
          <div className="flex gap-3">
            <Button size="md" variant="outlined" disabled={vote.isPending} onClick={() => vote.mutate(true)}>
              <IconThumbUp aria-hidden="true" className="size-4" /> Yes
            </Button>
            <Button size="md" variant="outlined" disabled={vote.isPending} onClick={() => vote.mutate(false)}>
              <IconThumbDown aria-hidden="true" className="size-4" /> No
            </Button>
          </div>
        )}
        <ErrorNote error={vote.error} fallback="We couldn't save your feedback." className="mt-3" />
      </div>
    </section>
  );
}

export function PublicHelpArticlePage() {
  const { slug = "" } = useParams();
  const signedIn = useAuth().status === "authenticated";
  const faq = useFaq(slug);
  const f = faq.data;
  const related = useFaqs("", f?.category ?? "");
  usePageMeta(f ? { title: f.question, description: f.summary || f.question } : null);

  // One address per article: an id link moves to the slug (the canonical URL).
  if (f?.slug && slug !== f.slug) return <Navigate to={`/help/${encodeURIComponent(f.slug)}`} replace />;

  const others = f && related.data && !related.isPlaceholderData ? related.data.filter((r) => r._id !== f._id && r.category === f.category).slice(0, 5) : [];

  return (
    <PublicLayout>
      <Container className="flex max-w-[50rem] flex-col gap-6 py-10 md:py-12">
        <nav aria-label="Breadcrumb" className="text-body-sm">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-muted">
            <li>
              <Link to="/help" className="inline-flex min-h-11 items-center font-semibold text-ink-brand underline-offset-2 hover:underline">
                Help centre
              </Link>
            </li>
            {f && (
              <>
                <li aria-hidden="true">/</li>
                <li>
                  <Link to={`/help?category=${encodeURIComponent(f.category)}`} className="inline-flex min-h-11 items-center font-semibold text-ink-brand underline-offset-2 hover:underline">
                    {helpCategoryLabel(f.category)}
                  </Link>
                </li>
              </>
            )}
          </ol>
        </nav>
        {faq.isLoading ? (
          <Loading label="Loading the article…" />
        ) : faq.error || !f ? (
          <div className="flex flex-col items-start gap-4">
            <h1 className="text-title-lg text-ink-strong">Article not found</h1>
            <ErrorNote error={faq.error} fallback="We couldn't load this article." onRetry={() => void faq.refetch()} />
            <ButtonLink to="/help" size="md">
              Browse the help centre
            </ButtonLink>
          </div>
        ) : (
          <>
            <header className="flex flex-col gap-3">
              <h1 className="text-title-lg text-ink-strong md:text-page-title">{f.question}</h1>
              <p className="text-body-sm text-ink-muted">
                {f.readMinutes ?? 1} min read{f.updatedAt ? ` · Updated ${shortDate(f.updatedAt)}` : ""}
              </p>
              {f.summary ? <p className="text-body-lg text-ink-secondary">{f.summary}</p> : null}
              {signedIn && (
                <Link to={`/support/help/${encodeURIComponent(f.slug || f._id)}`} className="inline-flex min-h-11 items-center self-start font-semibold text-ink-brand underline-offset-2 hover:underline">
                  Open in your workspace
                </Link>
              )}
            </header>
            <section className="min-w-0 rounded-2xl border border-line-card bg-surface-card p-5 shadow-card lg:p-6">
              <ArticleBody body={f.answer} hrefFor={publicHref} />
            </section>
            {/* Votes need an account (one vote each). */}
            {signedIn && <Feedback id={f._id} />}
            {others.length > 0 && (
              <section aria-labelledby="related-title" className="flex flex-col gap-3">
                <h2 id="related-title" className="text-title-sm text-ink-strong">
                  More in {helpCategoryLabel(f.category)}
                </h2>
                <ul className="flex flex-col divide-y divide-line-subtle rounded-2xl border border-line-card bg-surface-card px-5 shadow-card">
                  {others.map((r) => (
                    <ArticleLink key={r._id} f={r} />
                  ))}
                </ul>
              </section>
            )}
            <StillNeedHelp category={f.category} />
          </>
        )}
      </Container>
    </PublicLayout>
  );
}
