import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { IconChevronLeft, IconCircleCheck, IconMessageReport, IconMinus, IconPaperclip, IconX } from "@tabler/icons-react";
import { Button, ButtonLink, Field, TextArea } from "@/components/ui";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { sizeLabel } from "@/lib/attachments";
import {
  EXPECTED_MAX,
  ISSUE_FILE_TYPES,
  WHAT_MAX,
  WHAT_MIN,
  collectContext,
  issueContextRows,
  issueFileProblem,
  readMinimised,
  useReportIssue,
  writeMinimised,
  type IssueReportResult,
} from "@/lib/support/issues";

// "Report an issue" (2026-11-16): a floating button on every workspace screen
// (rendered by WorkspaceLayout only, so never on the landing page, /contact,
// legal pages, storefronts or /admin). Bottom-right; on phones and tablets
// (where the tab bar shows) it's an icon sitting ABOVE the tab bar, on desktop
// icon + text. It can be minimised to a small tab at the screen edge; the
// choice is remembered per user on this device.
//
// FloatingActions is the one bottom-right stack: any other floating button
// (e.g. a FELI launcher) goes in it too, so they stack instead of overlapping.

/** Bottom-right stack, above the phone tab bar. */
export const FLOATING_STACK_CLASS =
  "pointer-events-none fixed right-4 z-30 flex flex-col items-end gap-3 bottom-[calc(max(1rem,env(safe-area-inset-bottom))_+_var(--spacing-mobile-tab-bar)_+_0.75rem)] lg:bottom-6 lg:right-6";

export function FloatingActions({ children }: { children: ReactNode }) {
  return (
    <div data-floating-actions="" className={FLOATING_STACK_CLASS}>
      {children}
    </div>
  );
}

export function ReportIssue({ userId, screen }: { userId?: string | null; screen?: string }) {
  const [minimised, setMinimised] = useState(() => readMinimised(userId));
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const restored = useRef(false);

  useEffect(() => setMinimised(readMinimised(userId)), [userId]);

  const setMin = (v: boolean) => {
    writeMinimised(userId, v);
    setMinimised(v);
    restored.current = true;
  };
  // Keep keyboard focus on the control that replaced the one just pressed.
  useEffect(() => {
    if (!restored.current) return;
    restored.current = false;
    (minimised ? handleRef.current : triggerRef.current)?.focus();
  }, [minimised]);

  const close = () => {
    setOpen(false);
    // Focus goes back to the button that opened the panel.
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <>
      <FloatingActions>
        {minimised ? (
          <button
            ref={handleRef}
            type="button"
            onClick={() => setMin(false)}
            aria-label="Show the Report an issue button"
            title="Report an issue"
            className="pointer-events-auto -mr-4 flex h-12 w-7 items-center justify-center rounded-l-xl bg-brand-navy text-ink-on-brand shadow-floating transition-transform hover:-translate-x-0.5 lg:-mr-6"
          >
            <IconChevronLeft aria-hidden="true" className="size-4" stroke={2} />
          </button>
        ) : (
          <div className="pointer-events-auto relative">
            <button
              ref={triggerRef}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => setOpen(true)}
              className="flex size-12 items-center justify-center gap-2 rounded-full bg-brand-navy text-action text-ink-on-brand shadow-floating transition-transform hover:scale-105 active:bg-brand-navy-pressed lg:w-auto lg:px-5"
            >
              <IconMessageReport aria-hidden="true" className="size-icon shrink-0" stroke={1.75} />
              <span className="sr-only lg:not-sr-only lg:whitespace-nowrap">Report an issue</span>
            </button>
            <button
              type="button"
              onClick={() => setMin(true)}
              aria-label="Minimise the Report an issue button"
              title="Minimise"
              className="absolute -left-2 -top-2 flex size-6 items-center justify-center rounded-full border border-line-subtle bg-surface-card text-ink-secondary shadow-raised hover:text-ink-strong"
            >
              <IconMinus aria-hidden="true" className="size-3.5" stroke={2.25} />
            </button>
          </div>
        )}
      </FloatingActions>
      <ReportIssuePanel open={open} onClose={close} screen={screen} />
    </>
  );
}

type FieldErrors = Partial<Record<"whatHappened" | "expected" | "attachment", string>>;

export function ReportIssuePanel({ open, onClose, screen }: { open: boolean; onClose: () => void; screen?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const whatRef = useRef<HTMLTextAreaElement>(null);
  const expectedRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const fileId = useId();
  const location = useLocation();
  const report = useReportIssue();
  const [whatHappened, setWhatHappened] = useState("");
  const [expected, setExpected] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [done, setDone] = useState<IssueReportResult | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      whatRef.current?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  // A fresh form each time it opens after a report was sent.
  useEffect(() => {
    if (open || !done) return;
    setDone(null);
    setWhatHappened("");
    setExpected("");
    setFile(null);
    setErrors({});
    report.reset();
  }, [open, done, report]);

  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  const preview = issueContextRows(collectContext({ pathname: location.pathname, search: location.search, screen }));

  const pickFile = (f: File | null) => {
    if (!f) return;
    const problem = issueFileProblem(f);
    setErrors((e) => ({ ...e, attachment: problem ?? undefined }));
    setFile(problem ? null : f);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const what = whatHappened.trim();
    const next: FieldErrors = {};
    if (!what) next.whatHappened = "Tell us what happened.";
    else if (what.length < WHAT_MIN) next.whatHappened = `Tell us a little more (at least ${WHAT_MIN} characters).`;
    if (expected.trim().length > EXPECTED_MAX) next.expected = `Keep this under ${EXPECTED_MAX} characters.`;
    if (errors.attachment) next.attachment = errors.attachment;
    setErrors(next);
    if (next.whatHappened) return whatRef.current?.focus();
    if (next.expected) return expectedRef.current?.focus();
    if (next.attachment) return;
    report.mutate(
      { whatHappened: what, expected, file, context: collectContext({ pathname: location.pathname, search: location.search, screen }) },
      {
        onSuccess: (res) => setDone(res),
        onError: (err) => {
          const field = err instanceof ApiError && err.status === 400 ? String(err.data.field || "") : "";
          if (field === "whatHappened" || field === "expected" || field === "attachment") setErrors({ [field]: err.message });
        },
      }
    );
  };

  const err = report.error;
  const fieldErr = err instanceof ApiError && err.status === 400 && ["whatHappened", "expected", "attachment"].includes(String(err.data.field || ""));
  const limited = err instanceof ApiError && err.status === 429;

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // backdrop
      }}
      className={cn(
        "report-issue-panel text-ink-strong backdrop:bg-surface-overlay",
        // phones: a sheet that slides up from the bottom
        "fixed inset-x-0 bottom-0 top-auto m-0 max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-3xl border border-line-subtle bg-surface-card p-0 shadow-floating",
        // tablet/desktop: a panel by the button
        "md:bottom-6 md:left-auto md:right-6 md:max-h-[calc(100dvh-3rem)] md:w-[28rem] md:rounded-3xl"
      )}
    >
      {open && (
        // Padding lives here, not on <dialog>, so only a real backdrop click closes it.
        <div className="flex flex-col gap-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} ref={doneRef} tabIndex={-1} className="text-title-md outline-none">
              {done ? "Thanks for telling us" : "Report an issue"}
            </h2>
            <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 flex size-10 shrink-0 items-center justify-center rounded-lg text-ink-secondary hover:bg-surface-pale">
              <IconX aria-hidden="true" className="size-icon" />
            </button>
          </div>

          {done ? (
            <div className="flex flex-col gap-4">
              <div role="status" className="flex items-start gap-3 rounded-xl bg-success-bg px-4 py-4 text-success">
                <IconCircleCheck aria-hidden="true" className="mt-0.5 size-6 shrink-0" />
                <p className="text-body-lg font-semibold">{done.message || `We've logged this as ticket ${done.ticket.ticketNumber}.`}</p>
              </div>
              <p className="text-body-sm text-ink-secondary">We'll reply in Support tickets and let you know by email and in the app.</p>
              <div className="flex flex-col-reverse gap-3 md:flex-row md:[&>*]:flex-1">
                <Button variant="outlined" onClick={onClose}>
                  Done
                </Button>
                <ButtonLink to={`/support/tickets/${encodeURIComponent(done.ticket._id)}`} onClick={onClose}>
                  View ticket {done.ticket.ticketNumber}
                </ButtonLink>
              </div>
            </div>
          ) : (
            <form noValidate onSubmit={submit} className="flex flex-col gap-4">
              <p className="text-body-sm text-ink-secondary">Something not working? Tell us what happened and we'll look into it. It becomes a ticket in Support tickets.</p>
              <Field label="What happened?" required error={errors.whatHappened}>
                <TextArea ref={whatRef} rows={4} maxLength={WHAT_MAX} value={whatHappened} onChange={(e) => setWhatHappened(e.target.value)} placeholder="E.g. I pressed Save on an order and the page went blank." />
              </Field>
              <Field label="What did you expect?" error={errors.expected}>
                <TextArea ref={expectedRef} rows={2} maxLength={EXPECTED_MAX} value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="Optional" />
              </Field>

              <div className="flex flex-col gap-2">
                <span className="text-field-label uppercase text-ink-secondary">Screenshot or file (optional)</span>
                {file ? (
                  <div className="flex items-center gap-3 rounded-lg border border-line-subtle px-3 py-2">
                    <IconPaperclip aria-hidden="true" className="size-icon-sm shrink-0 text-ink-muted" />
                    <span className="min-w-0 flex-1 truncate text-body-sm text-ink-strong">
                      {file.name} <span className="text-ink-muted">· {sizeLabel(file.size)}</span>
                    </span>
                    <button type="button" onClick={() => setFile(null)} aria-label={`Remove ${file.name}`} className="flex size-8 shrink-0 items-center justify-center rounded-md text-ink-secondary hover:bg-surface-pale">
                      <IconX aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                ) : (
                  <label htmlFor={fileId} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-dashed border-line-default px-4 py-2 text-body-sm font-medium text-ink-brand hover:bg-surface-pale focus-within:shadow-focus">
                    <IconPaperclip aria-hidden="true" className="size-icon-sm" />
                    Add a screenshot or PDF
                    <input
                      ref={fileRef}
                      id={fileId}
                      type="file"
                      accept={ISSUE_FILE_TYPES.join(",")}
                      aria-describedby={`${fileId}-hint`}
                      className="sr-only"
                      onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                )}
                {errors.attachment ? (
                  <p role="alert" className="text-body-sm text-danger">
                    {errors.attachment}
                  </p>
                ) : (
                  <p id={`${fileId}-hint`} className="text-caption text-ink-muted">
                    PNG, JPG, WebP or PDF, up to 5 MB.
                  </p>
                )}
              </div>

              <div className="rounded-xl bg-surface-pale px-4 py-3 text-body-sm text-ink-secondary">
                <p>We'll include: this page, app version, browser and device, time, your account and business.</p>
                <details className="mt-1">
                  <summary className="font-medium text-ink-brand">See exactly what's sent</summary>
                  <dl className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-x-3 gap-y-1 md:grid-cols-[auto_minmax(0,1fr)]">
                    {preview.map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-ink-muted">{k}</dt>
                        <dd className="break-words text-ink-strong">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-2 text-caption text-ink-muted">Passwords and sign-in details are never included.</p>
                </details>
              </div>

              {limited ? (
                <p role="alert" className="rounded-lg bg-warning-bg px-4 py-3 text-body-sm text-ink-strong">
                  {err.message && !/too many requests/i.test(err.message) ? err.message : "You've sent several reports recently. Please wait a little, or add details to your existing ticket in Support tickets."}
                </p>
              ) : err && !fieldErr ? (
                <ErrorNote error={err} fallback="We couldn't send your report. Please try again." />
              ) : null}

              <div className="flex flex-col-reverse gap-3 md:flex-row md:[&>*]:flex-1">
                <Button variant="outlined" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" loading={report.isPending} loadingText="Sending…">
                  Send report
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </dialog>
  );
}
