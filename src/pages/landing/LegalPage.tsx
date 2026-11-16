import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { IconAlertTriangle, IconPrinter } from "@tabler/icons-react";
import { LEGAL_LAST_UPDATED, formatLegalDate, legalApproved } from "@/config/legal";
import { Container, PublicLayout } from "./PublicLayout";

// Shared frame for /terms and /privacy: draft banner (until VITE_LEGAL_APPROVED
// is "true"), "Last updated", a table of contents with anchors, readable
// type, and a print layout without the navbar and footer (landing.css).

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

export function LegalPage({ title, intro, sections }: { title: string; intro: ReactNode; sections: LegalSection[] }) {
  const draft = !legalApproved();
  return (
    <PublicLayout>
      <div className="lp-legal">
        <section className="bg-brand-navy text-ink-on-brand">
          <Container className="py-10 md:py-14">
            <p className="text-caption font-semibold uppercase tracking-wide text-ink-on-brand-accent">BiManage legal</p>
            <h1 className="mt-2 text-title-lg md:text-page-title">{title}</h1>
            <p className="mt-2 text-body-lg text-ink-on-brand-muted">
              Last updated <time dateTime={LEGAL_LAST_UPDATED}>{formatLegalDate(LEGAL_LAST_UPDATED)}</time>
            </p>
          </Container>
        </section>

        <Container className="py-8 md:py-12">
          {draft && (
            <div role="note" aria-label="Draft notice" className="mb-8 flex gap-3 rounded-xl border border-warning bg-surface-tint-warm p-4 text-ink-strong">
              <IconAlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
              <div>
                <p className="text-body-lg font-semibold">Draft, pending legal review</p>
                <p className="mt-1 text-body-lg text-ink-secondary">This document is a draft and may change before it is final. It describes how BiManage works today. Questions? <Link to="/contact" className="font-semibold text-ink-brand hover:underline">Contact us</Link>.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[16rem_minmax(0,1fr)]">
            <nav aria-label="Contents" className="lp-no-print min-w-0 lg:sticky lg:top-[calc(var(--spacing-header)+1.5rem)] lg:max-h-[calc(100dvh-var(--spacing-header)-3rem)] lg:self-start lg:overflow-y-auto">
              <p className="text-caption font-semibold uppercase tracking-wide text-ink-muted">Contents</p>
              <ol className="mt-3 flex flex-col gap-0.5 border-l border-line-subtle">
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="-ml-px flex min-h-10 items-center border-l-2 border-transparent pl-3 text-body-lg text-ink-secondary hover:border-brand-navy hover:text-ink-strong">
                      {i + 1}. {s.title}
                    </a>
                  </li>
                ))}
              </ol>
              <button type="button" onClick={() => window.print()} className="mt-4 inline-flex min-h-11 items-center gap-2 text-body-lg font-semibold text-ink-brand hover:underline">
                <IconPrinter className="size-5" aria-hidden="true" /> Print or save as PDF
              </button>
            </nav>

            <article className="min-w-0 max-w-[46rem]">
              <div className="flex flex-col gap-4 text-body-lg text-ink-secondary [&_a]:font-semibold [&_a]:text-ink-brand [&_a:hover]:underline">{intro}</div>
              {sections.map((s, i) => (
                <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="mt-10 scroll-mt-24 break-inside-avoid-page">
                  <h2 id={`${s.id}-h`} className="text-section-title text-ink-strong">
                    {i + 1}. {s.title}
                  </h2>
                  <div className="mt-3 flex flex-col gap-3 text-body-lg text-ink-secondary [&_a]:font-semibold [&_a]:text-ink-brand [&_a:hover]:underline [&_h3]:mt-2 [&_h3]:text-card-heading [&_h3]:text-ink-strong [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_strong]:text-ink-strong [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-6">
                    {s.body}
                  </div>
                </section>
              ))}
            </article>
          </div>
        </Container>
      </div>
    </PublicLayout>
  );
}
