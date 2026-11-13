import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, NavLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconArrowRight, IconBook, IconCircleCheck, IconLifebuoy, IconPaperclip, IconSearch, IconSearchOff, IconThumbDown, IconThumbUp, IconTicket, IconX } from "@tabler/icons-react";
import { Button, ButtonLink, Dialog, EmptyState, Field, SelectInput, Spinner, Status, TextArea, TextInput } from "@/components/ui";
import { DetailRows, HelpPanel, IntroCard, PageTitle, Panel, TipList } from "@/components/page/Blocks";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { applyFieldErrors, errorMessage } from "@/lib/api/errorMessage";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLeaveGuard } from "@/lib/nav/useLeaveGuard";
import { useUrlState } from "@/lib/nav/useUrlState";
import { SUPPORT_EMAIL } from "@/config/links";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ATTACHMENT_TYPES, MAX_ATTACHMENTS as ATTACHMENT_MAX_FILES, attachmentProblem, uploadAttachment, type Attachment } from "@/lib/attachments";
import {
  PREFERRED_STARTS,
  PRIORITIES,
  SERVICE_TYPES,
  TICKET_CATEGORIES,
  categoryLabel,
  priorityLabel,
  requestStatus,
  serviceLabel,
  startLabel,
  ticketStatus,
  useCloseTicket,
  useCreateServiceRequest,
  useCreateTicket,
  useFaq,
  useFaqs,
  useReplyTicket,
  useServiceRequest,
  useServiceRequests,
  useTicket,
  useTickets,
  useVoteFaq,
  type PreferredStart,
  type ServiceRequest,
  type ServiceType,
  type Ticket,
  type TicketCategory,
  type TicketPriority,
  type TicketReply,
  type TicketSummary,
} from "@/lib/support/api";

// Help & support (Figma 12.05–12.17): support centre, tickets, the help
// centre (FAQs) and BiTechTeam service requests.

const Loading = ({ label = "Loading…" }: { label?: string }) => (
  <div className="flex justify-center py-16 text-ink-brand" role="status">
    <Spinner className="size-8" />
    <span className="sr-only">{label}</span>
  </div>
);

const dateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";

const fileSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

function SupportTabs() {
  const tabs: Array<[string, string, boolean?]> = [
    ["/support", "Support centre", true],
    ["/support/tickets", "My tickets"],
    ["/support/help", "Help centre"],
  ];
  return (
    <nav aria-label="Support" className="-mx-5 overflow-x-auto px-5 lg:mx-0 lg:px-0">
      <ul className="flex w-max gap-1 rounded-md bg-surface-pale p-1">
        {tabs.map(([to, label, end]) => (
          <li key={to}>
            <NavLink to={to} end={end} className={({ isActive }) => cn("flex min-h-11 items-center rounded-sm px-4 text-action font-semibold", isActive ? "bg-surface-card text-ink-brand shadow-card" : "text-ink-muted hover:text-ink-brand")}>
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between">
      <Button size="md" variant="outlined" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <span className="text-body-sm text-ink-muted">
        Page {page} of {totalPages}
      </span>
      <Button size="md" variant="outlined" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </div>
  );
}

// ── Attachments ──────────────────────────────────────────────────────────

/** Files uploaded one by one to POST /upload/attachment; shown as removable chips. */
function AttachmentPicker({ value, onChange, onBusy, label = "Attachments" }: { value: Attachment[]; onChange: (next: Attachment[]) => void; onBusy?: (busy: boolean) => void; label?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = value.length >= ATTACHMENT_MAX_FILES;

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    let list = [...value];
    setBusy(true);
    onBusy?.(true);
    for (const f of Array.from(files)) {
      if (list.length >= ATTACHMENT_MAX_FILES) {
        setError(`You can attach up to ${ATTACHMENT_MAX_FILES} files.`);
        break;
      }
      const problem = attachmentProblem(f);
      if (problem) {
        setError(problem);
        continue;
      }
      try {
        const a = await uploadAttachment(f);
        list = [...list, a];
        onChange(list);
      } catch (err) {
        setError(errorMessage(err, `We couldn't upload ${f.name}. Please try again.`));
      }
    }
    setBusy(false);
    onBusy?.(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex flex-col gap-3 rounded-sm bg-surface-pale px-4 py-2.5 lg:bg-transparent lg:p-0">
      <p className="text-field-label uppercase text-ink-brand lg:text-ink-secondary">{label}</p>
      <p className="text-body-sm text-ink-muted">Up to {ATTACHMENT_MAX_FILES} files: JPG, PNG, WebP or PDF, 5 MB each.</p>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Attached files">
          {value.map((a, i) => (
            <li key={`${a.url}-${i}`} className="flex items-center gap-2 rounded-full bg-surface-tint-blue py-1 pl-3 pr-1 text-body-sm text-ink-brand">
              <IconPaperclip aria-hidden="true" className="size-4 shrink-0" />
              <span className="max-w-48 truncate">{a.name}</span>
              <span className="text-ink-muted">{fileSize(a.size)}</span>
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="flex size-8 items-center justify-center rounded-full hover:bg-surface-card" aria-label={`Remove ${a.name}`}>
                <IconX aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input ref={inputRef} type="file" multiple accept={ATTACHMENT_TYPES.join(",")} className="sr-only" tabIndex={-1} aria-label={`Add ${label.toLowerCase()}`} onChange={(e) => void add(e.target.files)} />
      <Button type="button" size="md" variant="outlined" className="self-start" loading={busy} loadingText="Uploading…" disabled={full} onClick={() => inputRef.current?.click()}>
        <IconPaperclip aria-hidden="true" className="size-4" /> {full ? "File limit reached" : "Add files"}
      </Button>
      {error && (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function AttachmentLinks({ files }: { files?: Attachment[] }) {
  if (!files?.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2" aria-label="Attachments">
      {files.map((a, i) => (
        <li key={`${a.url}-${i}`}>
          <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-full bg-surface-card px-3 py-1 text-body-sm text-ink-brand underline-offset-2 hover:underline">
            <IconPaperclip aria-hidden="true" className="size-4 shrink-0" />
            <span className="max-w-56 truncate">{a.name}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

// ── Rows shared by lists ─────────────────────────────────────────────────

function TicketRow({ t }: { t: TicketSummary }) {
  const st = ticketStatus(t.status);
  return (
    <li>
      <Link to={`/support/tickets/${t._id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-3 hover:bg-surface-pale md:px-2">
        <span className="min-w-0">
          <span className="block text-caption font-semibold text-ink-brand">{t.ticketNumber}</span>
          <span className="block truncate font-semibold text-ink-strong">{t.subject}</span>
          <span className="block text-body-sm text-ink-muted">
            {categoryLabel(t.category)} · Updated {shortDate(t.updatedAt)}
          </span>
        </span>
        <Status tone={st.tone}>{st.label}</Status>
      </Link>
    </li>
  );
}

function RequestRow({ r }: { r: ServiceRequest }) {
  const st = requestStatus(r.status);
  return (
    <li>
      <Link to={`/support/service-requests/${r._id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-3 hover:bg-surface-pale md:px-2">
        <span className="min-w-0">
          <span className="block text-caption font-semibold text-ink-brand">{r.requestNumber}</span>
          <span className="block truncate font-semibold text-ink-strong">{r.projectTitle}</span>
          <span className="block text-body-sm text-ink-muted">
            {serviceLabel(r.serviceType)} · {shortDate(r.createdAt)}
          </span>
        </span>
        <Status tone={st.tone}>{st.label}</Status>
      </Link>
    </li>
  );
}

// ── 12.09 Help & support centre ──────────────────────────────────────────

const TOPICS: Array<[TicketCategory, string, string]> = [
  ["billing", "Subscription & billing", "Plans, payments and receipts."],
  ["orders", "Order management", "Creating, updating and tracking orders."],
  ["store", "Store setup", "Building and publishing your online store."],
  ["bisupplynet", "BiSupplyNet & escrow", "Supplier orders and protected payments."],
  ["wallet", "Wallet & payouts", "Your balance, bank account and withdrawals."],
];

export function SupportCentrePage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const tickets = useTickets({ limit: 5 });
  const requests = useServiceRequests({ limit: 5 });

  const search = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/support/help?q=${encodeURIComponent(term)}` : "/support/help");
  };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle actions={<ButtonLink to="/support/tickets/new" size="md">Submit a support ticket</ButtonLink>}>Help & support centre</PageTitle>
      <SupportTabs />
      <IntroCard eyebrow="Help when you need it" title="Find an answer or speak to the BiManage team.">
        Search the help centre, or send us a ticket and follow every reply here.
      </IntroCard>
      <form role="search" onSubmit={search} className="flex flex-col gap-3 md:flex-row md:items-end">
        <Field label="Search help articles" className="flex-1">
          <TextInput type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="For example: withdraw to my bank" />
        </Field>
        <Button type="submit">
          <IconSearch aria-hidden="true" className="size-4" /> Search
        </Button>
      </form>
      <section aria-labelledby="topics-title" className="flex flex-col gap-3">
        <h2 id="topics-title" className="text-title-sm text-ink-strong">
          Popular help topics
        </h2>
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {TOPICS.map(([cat, title, body]) => (
            <li key={cat}>
              <Link to={`/support/help?category=${cat}`} className="flex h-full items-start gap-3 rounded-2xl border border-line-card bg-surface-card p-4 shadow-card hover:border-brand-navy">
                <IconBook aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ink-brand" />
                <span>
                  <span className="block font-semibold text-ink-strong">{title}</span>
                  <span className="block text-body-sm text-ink-muted">{body}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel title="My support requests" subtitle="Your latest tickets and where they stand.">
          {tickets.isLoading ? (
            <Loading label="Loading your tickets…" />
          ) : tickets.error ? (
            <ErrorNote error={tickets.error} fallback="We couldn't load your tickets." onRetry={() => void tickets.refetch()} />
          ) : !tickets.data?.tickets.length ? (
            <div className="rounded-xl bg-surface-pale p-5">
              <p className="text-body-lg font-semibold text-ink-strong">No support requests yet</p>
              <p className="mt-1 text-body-sm text-ink-muted">When you send a ticket, you can follow it here.</p>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-line-subtle">
              {tickets.data.tickets.map((t) => (
                <TicketRow key={t._id} t={t} />
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <ButtonLink to="/support/tickets/new" fullWidth>
              Submit a support ticket
            </ButtonLink>
            <ButtonLink to="/support/tickets" variant="outlined" fullWidth>
              View all
            </ButtonLink>
          </div>
        </Panel>
        <div className="flex flex-col gap-5">
          <Panel tone="pale" title="Need a custom service?" subtitle="BiTechTeam can build your website, brand or social media for you.">
            <ButtonLink to="/support/service-requests/new" variant="outlined" fullWidth>
              Request a service <IconArrowRight aria-hidden="true" className="size-4" />
            </ButtonLink>
          </Panel>
          {requests.data?.requests.length ? (
            <Panel title="My service requests">
              <ul className="flex flex-col divide-y divide-line-subtle">
                {requests.data.requests.map((r) => (
                  <RequestRow key={r._id} r={r} />
                ))}
              </ul>
            </Panel>
          ) : requests.error ? (
            <ErrorNote error={requests.error} fallback="We couldn't load your service requests." onRetry={() => void requests.refetch()} />
          ) : null}
          <p className="text-body-sm text-ink-muted">
            You can also email{" "}
            <a className="text-ink-brand underline" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Tickets list ─────────────────────────────────────────────────────────

const FILTERS = [
  ["all", "All"],
  ["active", "Active"],
  ["resolved", "Resolved"],
  ["closed", "Closed"],
] as const;
type FilterKey = (typeof FILTERS)[number][0];

export function TicketsPage() {
  const [status, setStatus] = useUrlState<FilterKey>("status", "all", FILTERS.map(([k]) => k));
  const [pageKey, setPageKey] = useUrlState<string>("page", "1");
  const page = Math.max(1, Number(pageKey) || 1);
  const tickets = useTickets({ status: status === "all" ? "" : status, page, limit: 10 });

  return (
    <div className="flex flex-col gap-6">
      <PageTitle actions={<ButtonLink to="/support/tickets/new" size="md">Submit a support ticket</ButtonLink>}>My support tickets</PageTitle>
      <SupportTabs />
      <div role="radiogroup" aria-label="Ticket status" className="-mx-5 overflow-x-auto px-5 lg:mx-0 lg:px-0">
        <div className="flex w-max gap-1 rounded-md bg-surface-pale p-1">
          {FILTERS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={status === k}
              onClick={() => {
                setStatus(k);
                setPageKey("1");
              }}
              className={cn("min-h-11 rounded-sm px-4 text-action font-semibold", status === k ? "bg-surface-card text-ink-brand shadow-card" : "text-ink-muted")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <Panel>
        {tickets.isLoading ? (
          <Loading label="Loading your tickets…" />
        ) : tickets.error ? (
          <ErrorNote error={tickets.error} fallback="We couldn't load your tickets." onRetry={() => void tickets.refetch()} />
        ) : !tickets.data?.tickets.length ? (
          <EmptyState
            className="border-0 p-0"
            icon={<IconTicket className="size-7" />}
            title={status === "all" ? "No support tickets yet" : "No tickets here"}
            body={status === "all" ? "Send a ticket and the BiManage team will reply here." : "Try another filter."}
            action={status === "all" ? <ButtonLink to="/support/tickets/new" size="md">Submit a support ticket</ButtonLink> : undefined}
          />
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-line-subtle">
              {tickets.data.tickets.map((t) => (
                <TicketRow key={t._id} t={t} />
              ))}
            </ul>
            <Pager page={page} totalPages={tickets.data.totalPages} onPage={(p) => setPageKey(String(p))} />
          </>
        )}
      </Panel>
    </div>
  );
}

// ── 12.05 Submit a support request ───────────────────────────────────────

const ticketSchema = z.object({
  subject: z.string().trim().min(3, "Give your request a title (at least 3 characters).").max(150, "Keep the title under 150 characters."),
  category: z.string().min(1, "Choose a category."),
  priority: z.enum(["low", "medium", "high"]),
  relatedReference: z.string().trim().max(100, "Keep the reference under 100 characters."),
  message: z.string().trim().min(5, "Describe what's happening (at least 5 characters).").max(5000, "Keep the description under 5,000 characters."),
  contactEmail: z.union([z.literal(""), z.string().trim().email("Enter a valid email address.")]),
});
type TicketForm = z.infer<typeof ticketSchema>;

export function NewTicketPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const create = useCreateTicket();
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);
  const preset = params.get("category");
  const { register, handleSubmit, setError, formState, resetField, getValues } = useForm<TicketForm>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      subject: "",
      category: TICKET_CATEGORIES.some(([k]) => k === preset) ? preset! : "",
      priority: "medium",
      relatedReference: params.get("ref") ?? "",
      message: "",
      contactEmail: user?.email ?? "",
    },
  });
  const guard = useLeaveGuard((formState.isDirty || files.length > 0) && !formState.isSubmitSuccessful);

  // The signed-in user may load after the form: use their email as the default.
  useEffect(() => {
    if (user?.email && !getValues("contactEmail")) resetField("contactEmail", { defaultValue: user.email });
  }, [user?.email, getValues, resetField]);

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    try {
      const res = await create.mutateAsync({
        subject: v.subject,
        message: v.message,
        category: v.category as TicketCategory,
        priority: v.priority as TicketPriority,
        ...(v.relatedReference ? { relatedReference: v.relatedReference } : {}),
        ...(v.contactEmail ? { contactEmail: v.contactEmail } : {}),
        ...(files.length ? { attachments: files } : {}),
      });
      guard.allow();
      navigate(`/support/tickets/${res.ticket._id}?created=1`);
    } catch (err) {
      if (!applyFieldErrors(err, setError, ["subject", "message", "category", "priority", "relatedReference", "contactEmail"])) setFormError(err);
    }
  });
  const e = formState.errors;

  return (
    <div className="flex flex-col gap-6">
      {guard.dialog}
      <PageTitle>Submit a support request</PageTitle>
      <IntroCard eyebrow="Support / New ticket" title="Tell us what's happening.">
        The more detail you share, the faster the team can help.
      </IntroCard>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
          <Panel title="Request details" subtitle="Fields marked * are required.">
            <div className="grid gap-4 md:grid-cols-2 md:gap-x-10 md:gap-y-6">
              <Field label="Request title" required error={e.subject?.message} className="md:col-span-2">
                <TextInput maxLength={150} placeholder="For example: My withdrawal hasn't arrived" {...register("subject")} />
              </Field>
              <Field label="Category" required error={e.category?.message}>
                <SelectInput {...register("category")}>
                  <option value="">Choose a category</option>
                  {TICKET_CATEGORIES.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Priority" error={e.priority?.message}>
                <SelectInput {...register("priority")}>
                  {PRIORITIES.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Related reference" hint="Optional. An order, invoice or withdrawal number." error={e.relatedReference?.message}>
                <TextInput placeholder="For example: WD-2026-0032" {...register("relatedReference")} />
              </Field>
              <Field label="Contact email" hint="We send reply updates here." error={e.contactEmail?.message}>
                <TextInput type="email" autoComplete="email" {...register("contactEmail")} />
              </Field>
              <Field label="Description" required error={e.message?.message} className="md:col-span-2">
                <TextArea rows={6} maxLength={5000} placeholder="What happened, what you expected, and any steps you tried." {...register("message")} />
              </Field>
              <div className="md:col-span-2">
                <AttachmentPicker value={files} onChange={setFiles} onBusy={setUploading} />
              </div>
            </div>
          </Panel>
          <ErrorNote error={formError} fallback="We couldn't send your request. Please try again." />
          <Button type="submit" className="md:self-end md:px-10" loading={create.isPending} loadingText="Sending…" disabled={uploading}>
            Submit request
          </Button>
        </form>
        <HelpPanel
          items={[
            ["Tracking", "Ticket created on submission"],
            ["Updates", "Email and notification"],
            ["Evidence", "Attach files if helpful"],
            ["Resolution", "Support replies in ticket thread"],
          ]}
        />
      </div>
    </div>
  );
}

// ── 12.06 Ticket detail (+ 12.12 confirmation when ?created=1) ───────────

export function TicketDetailPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const ticket = useTicket(id);
  if (ticket.isLoading) return <Loading label="Loading your ticket…" />;
  if (ticket.error || !ticket.data) return <ErrorNote error={ticket.error} fallback="We couldn't load this ticket. Please try again." onRetry={() => void ticket.refetch()} />;
  return <TicketDetail t={ticket.data} created={params.get("created") === "1"} />;
}

function TicketDetail({ t, created }: { t: Ticket; created: boolean }) {
  const st = ticketStatus(t.status);
  const [confirmClose, setConfirmClose] = useState(false);
  const close = useCloseTicket(t._id);
  const done = t.status === "closed" || t.status === "resolved";
  const thread: TicketReply[] = [{ _id: "original", by: "user", message: t.message, attachments: t.attachments, createdAt: t.createdAt }, ...(t.replies ?? [])];

  return (
    <div className="flex flex-col gap-6">
      <PageTitle actions={t.status !== "closed" ? <Button size="md" variant="outlined" onClick={() => setConfirmClose(true)}>Close ticket</Button> : undefined}>Support ticket {t.ticketNumber}</PageTitle>
      {created && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <Panel title="Your request is in the right hands." subtitle="The BiManage support team has your ticket.">
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3 rounded-xl bg-success-bg px-4 py-4 text-success">
                <IconCircleCheck aria-hidden="true" className="size-6 shrink-0" />
                <p className="text-body-lg font-semibold">Ticket {t.ticketNumber} created</p>
              </div>
              <DetailRows
                rows={[
                  ["Ticket opened", dateTime(t.createdAt)],
                  ["Category", categoryLabel(t.category)],
                  ["Status", t.status === "open" ? "Open · Awaiting support response" : st.label],
                  ["Contact", "Reply updates by email and in-app"],
                ]}
              />
            </div>
          </Panel>
          <TipList
            title="Next steps"
            tips={[
              { title: "Ticket received", body: `We've logged your request as ${t.ticketNumber}.` },
              { title: "Team reviews your message", body: "Target response within 24 hours." },
              { title: "Track your ticket", body: "Replies appear on this page and in your notifications." },
            ]}
          />
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title={t.subject}>
            <ol className="flex flex-col gap-4" aria-label="Conversation">
              {thread.map((r) => (
                <li key={r._id} className={cn("rounded-xl px-4 py-3", r.by === "admin" ? "bg-surface-tint-blue" : "bg-surface-pale")}>
                  <p className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-ink-strong">{r.by === "admin" ? "BiManage support" : "You"}</span>
                    <span className="text-caption text-ink-muted">{dateTime(r.createdAt)}</span>
                  </p>
                  <p className="mt-2 whitespace-pre-line break-words text-body-sm text-ink-secondary">{r.message}</p>
                  <AttachmentLinks files={r.attachments} />
                </li>
              ))}
            </ol>
          </Panel>
          <ReplyBox t={t} done={done} />
          <ErrorNote error={close.error} fallback="We couldn't close this ticket. Please try again." />
        </div>
        <Panel tone="pale" title="Ticket details">
          <DetailRows
            rows={[
              ["Status", <Status tone={st.tone}>{st.label}</Status>],
              ["Category", categoryLabel(t.category)],
              ["Priority", priorityLabel(t.priority)],
              ...(t.relatedReference ? ([["Reference", t.relatedReference]] as Array<[string, ReactNode]>) : []),
              ["Opened", shortDate(t.createdAt)],
              ["Updated", shortDate(t.updatedAt)],
              ...(t.contactEmail ? ([["Contact email", <span className="break-all">{t.contactEmail}</span>]] as Array<[string, ReactNode]>) : []),
            ]}
          />
          <ButtonLink to="/support/tickets" variant="outlined" size="md" className="mt-5">
            All my tickets
          </ButtonLink>
        </Panel>
      </div>
      <Dialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        title="Close this ticket?"
        description="Close it if your problem is solved. You can reply later to reopen it."
        actions={
          <>
            <Button variant="outlined" onClick={() => setConfirmClose(false)}>
              Keep it open
            </Button>
            <Button loading={close.isPending} onClick={() => close.mutate(undefined, { onSettled: () => setConfirmClose(false) })}>
              Close ticket
            </Button>
          </>
        }
      />
    </div>
  );
}

function ReplyBox({ t, done }: { t: Ticket; done: boolean }) {
  const reply = useReplyTicket(t._id);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);
  const guard = useLeaveGuard(Boolean(text.trim()) || files.length > 0);

  const send = (e: FormEvent) => {
    e.preventDefault();
    setSent(false);
    const message = text.trim();
    if (!message) {
      setError("Write your reply first.");
      return;
    }
    if (message.length > 5000) {
      setError("Keep your reply under 5,000 characters.");
      return;
    }
    setError(undefined);
    reply.mutate(
      { message, ...(files.length ? { attachments: files } : {}) },
      {
        onSuccess: () => {
          setText("");
          setFiles([]);
          setSent(true);
        },
      }
    );
  };

  return (
    <form noValidate onSubmit={send}>
      {guard.dialog}
      <Panel title="Reply" subtitle={done ? "Replying reopens this ticket." : "The support team sees your reply straight away."}>
        <div className="flex flex-col gap-4">
          <Field label="Your reply" error={error}>
            <TextArea rows={4} maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <AttachmentPicker value={files} onChange={setFiles} onBusy={setUploading} />
          <ErrorNote error={reply.error} fallback="We couldn't send your reply. Please try again." />
          {sent && (
            <p role="status" className="text-body-sm text-success-ink">
              Reply sent.
            </p>
          )}
          <Button type="submit" className="md:self-end md:px-10" loading={reply.isPending} loadingText="Sending…" disabled={uploading}>
            Send reply
          </Button>
        </div>
      </Panel>
    </form>
  );
}

// ── 12.07 Help centre ────────────────────────────────────────────────────

const HELP_CATEGORIES: Array<[string, string]> = [["", "All topics"], ...TICKET_CATEGORIES.filter(([k]) => k !== "other")];

export function HelpCentrePage() {
  const [q, setQ] = useUrlState<string>("q", "");
  const [category, setCategory] = useUrlState<string>("category", "");
  const [text, setText] = useState(q);
  const faqs = useFaqs(q, category);

  // Typing searches after a short pause; Back/links that change ?q update the box.
  useEffect(() => {
    const term = text.trim();
    if (term === q) return;
    const t = setTimeout(() => setQ(term), 300);
    return () => clearTimeout(t);
  }, [text, q, setQ]);
  useEffect(() => {
    setText((cur) => (cur.trim() === q ? cur : q));
  }, [q]);

  const filtered = Boolean(q || category);
  return (
    <div className="flex flex-col gap-6">
      <PageTitle actions={<ButtonLink to="/support/tickets/new" size="md" variant="outlined">Contact support</ButtonLink>}>Help centre</PageTitle>
      <SupportTabs />
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(text.trim());
        }}
      >
        <Field label="Search help articles">
          <TextInput type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search by question or keyword" trailing={<IconSearch aria-hidden="true" className="size-icon text-ink-muted" />} />
        </Field>
      </form>
      <div role="radiogroup" aria-label="Help topic" className="-mx-5 overflow-x-auto px-5 lg:mx-0 lg:px-0">
        <div className="flex w-max gap-2">
          {HELP_CATEGORIES.map(([k, label]) => (
            <button
              key={k || "all"}
              type="button"
              role="radio"
              aria-checked={category === k}
              onClick={() => setCategory(k)}
              className={cn("min-h-11 rounded-full border px-4 text-action font-semibold", category === k ? "border-brand-navy bg-brand-navy text-ink-on-brand" : "border-line-default bg-surface-card text-ink-brand")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {faqs.isLoading ? (
        <Loading label="Loading help articles…" />
      ) : faqs.error ? (
        <ErrorNote error={faqs.error} fallback="We couldn't load the help articles." onRetry={() => void faqs.refetch()} />
      ) : !faqs.data?.length ? (
        <EmptyState
          icon={<IconSearchOff className="size-7" />}
          title={filtered ? "No articles match your search" : "No help articles yet"}
          body="Try other words, or ask the BiManage team directly."
          action={
            <ButtonLink to="/support/tickets/new" size="md">
              Contact support
            </ButtonLink>
          }
        />
      ) : (
        <Panel>
          <ul className="flex flex-col divide-y divide-line-subtle">
            {faqs.data.map((f) => (
              <li key={f._id}>
                <Link to={`/support/help/${f._id}`} className="flex items-center justify-between gap-4 py-3 hover:bg-surface-pale md:px-2">
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink-strong">{f.question}</span>
                    <span className="block text-body-sm text-ink-muted">
                      {categoryLabel(f.category)} · {f.readMinutes ?? 1} min read
                    </span>
                  </span>
                  <IconArrowRight aria-hidden="true" className="size-4 shrink-0 text-ink-brand" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

// ── Help article ─────────────────────────────────────────────────────────

export function HelpArticlePage() {
  const { id = "" } = useParams();
  const faq = useFaq(id);
  const vote = useVoteFaq(id);
  if (faq.isLoading) return <Loading label="Loading the article…" />;
  if (faq.error || !faq.data) return <ErrorNote error={faq.error} fallback="We couldn't load this article. Please try again." onRetry={() => void faq.refetch()} />;
  const f = faq.data;
  const paragraphs = f.answer
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const thanks = vote.data ? (vote.data.alreadyVoted ? "Thanks, we already have your feedback." : "Thanks for your feedback.") : null;

  return (
    <div className="flex flex-col gap-6">
      <Link to="/support/help" className="self-start text-body-sm font-semibold text-ink-brand underline-offset-2 hover:underline">
        ← Help centre
      </Link>
      <PageTitle>{f.question}</PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">
        {categoryLabel(f.category)} · {f.readMinutes ?? 1} min read{f.updatedAt ? ` · Updated ${shortDate(f.updatedAt)}` : ""}
      </p>
      <Panel>
        <div className="flex flex-col gap-4 text-body-lg text-ink-secondary">
          {paragraphs.map((p, i) => (
            <p key={i} className="whitespace-pre-line">
              {p}
            </p>
          ))}
        </div>
      </Panel>
      <Panel tone="pale" title="Was this helpful?">
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
      </Panel>
      <Link to={`/support/tickets/new?category=${encodeURIComponent(f.category)}`} className="flex items-center gap-2 self-start font-semibold text-ink-brand underline-offset-2 hover:underline">
        <IconLifebuoy aria-hidden="true" className="size-5" /> Still need help? Create a support ticket
      </Link>
    </div>
  );
}

// ── 12.14 Request a BiTechTeam service ───────────────────────────────────

const optional = (max: number, label: string) => z.string().trim().max(max, `Keep ${label} under ${max} characters.`);
const serviceSchema = z.object({
  projectTitle: z.string().trim().min(3, "Give your project a title (at least 3 characters).").max(150, "Keep the title under 150 characters."),
  serviceType: z.string().min(1, "Choose the service you need."),
  preferredStart: z.enum(["asap", "within_30_days", "within_90_days", "flexible"]),
  businessName: optional(150, "the business name"),
  brandMaterials: optional(500, "brand materials"),
  description: z.string().trim().min(10, "Describe your goals (at least 10 characters).").max(5000, "Keep the goals under 5,000 characters."),
  contactEmail: z.string().trim().min(1, "Enter your email address.").email("Enter a valid email address."),
  contactPhone: optional(30, "the phone number"),
  budget: optional(100, "the budget"),
  timeline: optional(100, "the timeline"),
});
type ServiceForm = z.infer<typeof serviceSchema>;

export function NewServiceRequestPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const create = useCreateServiceRequest();
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);
  const { register, handleSubmit, setError, formState, resetField, getValues } = useForm<ServiceForm>({
    resolver: zodResolver(serviceSchema),
    defaultValues: { projectTitle: "", serviceType: "", preferredStart: "within_30_days", businessName: "", brandMaterials: "", description: "", contactEmail: user?.email ?? "", contactPhone: "", budget: "", timeline: "" },
  });
  const guard = useLeaveGuard((formState.isDirty || files.length > 0) && !formState.isSubmitSuccessful);

  useEffect(() => {
    if (user?.email && !getValues("contactEmail")) resetField("contactEmail", { defaultValue: user.email });
  }, [user?.email, getValues, resetField]);

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    const opt = (k: "businessName" | "brandMaterials" | "contactPhone" | "budget" | "timeline") => (v[k] ? { [k]: v[k] } : {});
    try {
      const res = await create.mutateAsync({
        projectTitle: v.projectTitle,
        serviceType: v.serviceType as ServiceType,
        preferredStart: v.preferredStart as PreferredStart,
        contactEmail: v.contactEmail,
        description: v.description,
        ...opt("businessName"),
        ...opt("brandMaterials"),
        ...opt("contactPhone"),
        ...opt("budget"),
        ...opt("timeline"),
        ...(files.length ? { referenceFiles: files } : {}),
      });
      guard.allow();
      navigate(`/support/service-requests/${res.request._id}?created=1`);
    } catch (err) {
      if (!applyFieldErrors(err, setError, ["projectTitle", "serviceType", "preferredStart", "businessName", "brandMaterials", "description", "contactEmail", "contactPhone", "budget", "timeline"])) setFormError(err);
    }
  });
  const e = formState.errors;

  return (
    <div className="flex flex-col gap-6">
      {guard.dialog}
      <PageTitle>Request a BiTechTeam service</PageTitle>
      <IntroCard eyebrow="Support / Custom service" title="Let BiTechTeam build it with you.">
        Tell us what you need. The team follows up within 48 hours.
      </IntroCard>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
          <Panel title="Project details" subtitle="Fields marked * are required.">
            <div className="grid gap-4 md:grid-cols-2 md:gap-x-10 md:gap-y-6">
              <Field label="Project title" required error={e.projectTitle?.message} className="md:col-span-2">
                <TextInput maxLength={150} placeholder="For example: New website for my shop" {...register("projectTitle")} />
              </Field>
              <Field label="Service required" required error={e.serviceType?.message}>
                <SelectInput {...register("serviceType")}>
                  <option value="">Choose a service</option>
                  {SERVICE_TYPES.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Preferred start" error={e.preferredStart?.message}>
                <SelectInput {...register("preferredStart")}>
                  {PREFERRED_STARTS.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Business name" error={e.businessName?.message}>
                <TextInput placeholder="Leave blank to use your business profile name" {...register("businessName")} />
              </Field>
              <Field label="Brand materials" hint="Optional." error={e.brandMaterials?.message}>
                <TextInput placeholder="For example: Logo and visual guidelines" {...register("brandMaterials")} />
              </Field>
              <Field label="Project goals" required error={e.description?.message} className="md:col-span-2">
                <TextArea rows={6} maxLength={5000} placeholder="What should the project achieve, and for whom?" {...register("description")} />
              </Field>
              <div className="md:col-span-2">
                <AttachmentPicker label="Reference files" value={files} onChange={setFiles} onBusy={setUploading} />
              </div>
              <Field label="Contact email" required error={e.contactEmail?.message}>
                <TextInput type="email" autoComplete="email" {...register("contactEmail")} />
              </Field>
              <Field label="Contact phone" hint="Optional." error={e.contactPhone?.message}>
                <TextInput type="tel" autoComplete="tel" {...register("contactPhone")} />
              </Field>
              <Field label="Budget" hint="Optional." error={e.budget?.message}>
                <TextInput placeholder="For example: ₦300,000" {...register("budget")} />
              </Field>
              <Field label="Timeline" hint="Optional." error={e.timeline?.message}>
                <TextInput placeholder="For example: Ready by March" {...register("timeline")} />
              </Field>
            </div>
          </Panel>
          <ErrorNote error={formError} fallback="We couldn't send your request. Please try again." />
          <Button type="submit" className="md:self-end md:px-10" loading={create.isPending} loadingText="Sending…" disabled={uploading}>
            Send request
          </Button>
        </form>
        <TipList
          title="How it works"
          tips={[
            { title: "Send your request", body: "You get a request reference straight away." },
            { title: "BiTechTeam follows up", body: "Within 48 hours, by email or phone." },
            { title: "Agree the details", body: "Scope, price and timing are agreed before any work starts." },
          ]}
        />
      </div>
    </div>
  );
}

// ── 12.17 Service request received / detail ──────────────────────────────

export function ServiceRequestDetailPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const req = useServiceRequest(id);
  if (req.isLoading) return <Loading label="Loading your request…" />;
  if (req.error || !req.data) return <ErrorNote error={req.error} fallback="We couldn't load this request. Please try again." onRetry={() => void req.refetch()} />;
  const r = req.data;
  const created = params.get("created") === "1";
  const st = requestStatus(r.status);

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>{created ? "Service request received" : r.projectTitle}</PageTitle>
      {created && (
        <div className="flex items-center gap-3 rounded-xl bg-success-bg px-4 py-4 text-success">
          <IconCircleCheck aria-hidden="true" className="size-6 shrink-0" />
          <p className="text-body-lg font-semibold">BiTechTeam will follow up with you within 48 hours.</p>
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel title={created ? r.projectTitle : "Request details"}>
          <div className="flex flex-col gap-5">
            <DetailRows
              rows={[
                ["Service", serviceLabel(r.serviceType)],
                ["Business", r.businessName || "Your business profile name"],
                ["Request reference", r.requestNumber],
                ["Follow-up", "Within 48 hours"],
                ["Status", <Status tone={st.tone}>{st.label}</Status>],
                ["Preferred start", startLabel(r.preferredStart)],
                ...(r.budget ? ([["Budget", r.budget]] as Array<[string, ReactNode]>) : []),
                ...(r.timeline ? ([["Timeline", r.timeline]] as Array<[string, ReactNode]>) : []),
              ]}
            />
            {!created && <p className="whitespace-pre-line break-words text-body-sm text-ink-secondary">{r.description}</p>}
            <AttachmentLinks files={r.referenceFiles} />
            <ButtonLink to="/support" fullWidth>
              View support activity
            </ButtonLink>
          </div>
        </Panel>
        <TipList
          title="What happens next"
          tips={[
            { title: "We review your request", body: "The team reads your goals and any files you shared." },
            { title: "We get in touch", body: `By email at ${r.contactEmail}${r.contactPhone ? ` or by phone on ${r.contactPhone}` : ""}.` },
            { title: "You decide", body: "Nothing starts until you agree the scope and price." },
          ]}
        />
      </div>
    </div>
  );
}
