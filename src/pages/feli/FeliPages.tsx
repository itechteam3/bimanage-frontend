import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { IconChevronDown, IconHeadset, IconSend, IconSparkles, IconTrash } from "@tabler/icons-react";
import { Button, ButtonLink, Dialog, Spinner, Status } from "@/components/ui";
import { IntroCard, PageTitle } from "@/components/page/Blocks";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { ApiError } from "@/lib/api/client";
import { errorMessage, friendlyText } from "@/lib/api/errorMessage";
import { cn } from "@/lib/cn";
import {
  actionLabel,
  isLimitError,
  isLimited,
  lagosTime,
  proposalsOf,
  tierName,
  useCancelFeliAction,
  useClearFeliHistory,
  useEscalateFeli,
  useFeliAccess,
  useFeliChat,
  useFeliHistory,
  useFeliSuggestions,
  type FeliAccess,
  type FeliMessage,
  type FeliProposal,
  type FeliUsage,
} from "@/lib/feli/api";
import { LimitCard, RestrictionCard } from "./FeliStates";
import { cleanFeliText } from "@/lib/feli/clean";
import { paramRows, useNameLookup } from "./FeliReviewPage";

// 11.05 FELI assistant: the conversation, suggestions, your access and usage,
// and a way to reach a person. Proposals open the review (11.01 / 11.02);
// limits and restrictions show 11.03 / 11.04 in place.

const MAX_MESSAGE = 2000;

export function FeliAssistantPage() {
  const history = useFeliHistory();
  const access = useFeliAccess();
  const chat = useFeliChat();
  const [handoff, setHandoff] = useState<{ reason?: string } | null>(null);
  const escalate = useEscalateFeli();
  const usage = history.data?.usage ?? access.data?.usage;
  const limited = isLimited(usage) || isLimitError(chat.error);

  const askPerson = (reason?: string) => {
    escalate.reset();
    setHandoff({ reason });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>FELI: your business AI assistant</PageTitle>
      <IntroCard eyebrow="Friendly Enterprise Learning Intelligence" title="Answers, insights and help for your working day.">
        Ask a question about your account or explore what FELI can help you do. FELI only changes something after you approve it.
      </IntroCard>
      {escalate.data && (
        <p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-success-bg px-4 py-3 text-body-sm text-success">
          <span className="min-w-0 break-words">
            Ticket {escalate.data.ticketNumber} is open. Our support team has your recent FELI messages and will reply in Support.
          </span>
          <Link to={`/support/tickets/${encodeURIComponent(escalate.data.ticketId)}`} className="font-semibold underline underline-offset-2">
            View ticket {escalate.data.ticketNumber}
          </Link>
        </p>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <ChatPanel history={history} chat={chat} usage={usage} limited={limited} onAskPerson={askPerson} />
        <AccessPanel access={access} usage={usage} onAskPerson={() => askPerson()} />
      </div>
      <Dialog
        open={Boolean(handoff)}
        onClose={() => setHandoff(null)}
        icon={<IconHeadset className="size-7" />}
        title="Talk to a person?"
        description="We'll open a support ticket with your recent FELI messages so our team can pick it up. You'll see their replies in Support."
        actions={
          <>
            <Button variant="outlined" onClick={() => setHandoff(null)}>
              Not now
            </Button>
            <Button loading={escalate.isPending} loadingText="Opening…" onClick={() => escalate.mutate(handoff?.reason, { onSuccess: () => setHandoff(null) })}>
              Open a ticket
            </Button>
          </>
        }
      >
        <ErrorNote error={escalate.error} fallback="We couldn't reach support just now. Please open a ticket from Support." />
      </Dialog>
    </div>
  );
}

// ── Conversation ─────────────────────────────────────────────────────────
function ChatPanel({
  history,
  chat,
  usage,
  limited,
  onAskPerson,
}: {
  history: ReturnType<typeof useFeliHistory>;
  chat: ReturnType<typeof useFeliChat>;
  usage?: FeliUsage;
  limited: boolean;
  onAskPerson: (reason?: string) => void;
}) {
  const [text, setText] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const clear = useClearFeliHistory();
  const messages = history.data?.messages ?? [];
  const proposals = proposalsOf(history.data);
  const pending = chat.isPending ? chat.variables : null;
  const endRef = useRef<HTMLDivElement>(null);

  // scrollIntoView can return a Promise in Chrome: never return it from the effect.
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end", behavior: "smooth" });
  }, [messages.length, pending, proposals[0]?.id]);

  const send = (message: string) => {
    const m = message.trim();
    if (!m || chat.isPending || limited) return;
    setText("");
    chat.mutate(m, { onError: () => setText((t) => t || m) });
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(text);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(text);
    }
  };

  const last = messages.at(-1);
  const chatError = chat.error && !isLimitError(chat.error) ? chat.error : null;

  return (
    <section aria-label="Chat with FELI" className="flex min-w-0 flex-col gap-4 rounded-2xl border border-line-card bg-surface-card p-4 shadow-card lg:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-title-sm text-ink-strong">Today with FELI</h2>
          <p className="text-caption text-ink-muted">{usageLine(usage)}</p>
        </div>
        {messages.length > 0 && (
          <Button variant="secondary" size="md" onClick={() => setConfirmClear(true)} icon={<IconTrash aria-hidden="true" className="size-4" />}>
            Clear conversation
          </Button>
        )}
      </header>

      {history.isLoading ? (
        <div className="flex justify-center py-12 text-ink-brand" role="status">
          <Spinner className="size-8" />
          <span className="sr-only">Loading your conversation…</span>
        </div>
      ) : history.error ? (
        <ErrorNote error={history.error} fallback="We couldn't load your FELI conversation." onRetry={() => void history.refetch()} />
      ) : (
        <div className="flex max-h-[36rem] min-h-48 min-w-0 flex-col gap-3 overflow-y-auto" aria-live="polite">
          {!messages.length && !pending && <EmptyChat onPick={send} disabled={limited || chat.isPending} />}
          {messages.map((m, i) => (
            <Bubble
              key={`${i}-${m.role}`}
              m={m}
              isLast={m === last}
              onAskPerson={onAskPerson}
              // A message of yours with no reply after it: FELI couldn't answer (busy, timeout…).
              unanswered={m.role === "user" && (messages[i + 1]?.role === "user" || (m === last && !pending))}
              onResend={limited || chat.isPending ? undefined : () => send(m.content)}
            />
          ))}
          {pending && (
            <>
              <Bubble m={{ role: "user", content: pending }} />
              <p role="status" className="flex items-center gap-2 self-start rounded-2xl bg-surface-pale px-4 py-2 text-body-sm text-ink-muted">
                <Spinner className="size-4" /> FELI is thinking…
              </p>
            </>
          )}
          {!pending && proposals.length > 0 && (
            <div className="flex min-w-0 flex-col gap-3" aria-label="Suggestions to review">
              {proposals.map((p, i) => (
                <ProposalCard key={p.id} proposal={p} position={proposals.length > 1 ? `${i + 1} of ${proposals.length}` : undefined} />
              ))}
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {limited ? (
        <LimitCard usage={usage} compact />
      ) : (
        chatError && (
          <p role="alert" className="rounded-lg bg-danger-bg px-4 py-3 text-body-sm text-danger">
            {chatErrorText(chatError)}
          </p>
        )
      )}

      <form onSubmit={onSubmit} className="flex items-end gap-2 rounded-xl bg-surface-pale p-2">
        <label className="sr-only" htmlFor="feli-composer">
          Message FELI
        </label>
        <textarea
          id="feli-composer"
          rows={1}
          maxLength={MAX_MESSAGE}
          placeholder={limited ? "You've used today's FELI messages" : "Ask FELI anything about your business…"}
          value={text}
          disabled={limited}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          className="max-h-40 min-h-11 min-w-0 flex-1 resize-none rounded-lg border border-line-default bg-surface-card px-4 py-2.5 text-body-sm text-ink-strong outline-none placeholder:text-ink-muted focus:border-brand-navy focus:shadow-focus disabled:cursor-not-allowed disabled:bg-surface-pale"
        />
        <Button type="submit" size="md" disabled={limited || !text.trim() || chat.isPending} icon={<IconSend aria-hidden="true" className="size-4" />}>
          Send
        </Button>
      </form>

      <Dialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        icon={<IconTrash className="size-7" />}
        title="Clear this conversation?"
        description="FELI's messages and any suggestion waiting for review will be removed. Today's message count stays the same."
        actions={
          <>
            <Button variant="outlined" onClick={() => setConfirmClear(false)}>
              Keep it
            </Button>
            <Button variant="destructive" loading={clear.isPending} loadingText="Clearing…" onClick={() => clear.mutate(undefined, { onSuccess: () => setConfirmClear(false) })}>
              Clear conversation
            </Button>
          </>
        }
      >
        <ErrorNote error={clear.error} fallback="We couldn't clear the conversation. Please try again." />
      </Dialog>
    </section>
  );
}

function usageLine(u?: FeliUsage) {
  if (!u) return "Ask a question to get started.";
  if (u.unlimited) return "Unlimited messages on your plan.";
  return `${u.remaining ?? 0} of ${u.limit ?? 0} messages left today · resets at midnight, Lagos time`;
}

function chatErrorText(err: unknown) {
  const fallback = "FELI couldn't answer just now. Please try again.";
  if (err instanceof ApiError) {
    if (err.status === 429) return friendlyText(err.message, "You're sending messages to FELI very quickly. Please wait a moment.");
    if (String(err.data.code ?? "").startsWith("FELI_") || err.status === 503) return friendlyText(err.message, fallback);
  }
  return errorMessage(err, fallback);
}

function EmptyChat({ onPick, disabled }: { onPick: (q: string) => void; disabled: boolean }) {
  const suggestions = useFeliSuggestions();
  const list = suggestions.data?.suggestions ?? [];
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-surface-pale px-4 py-3">
        <p className="text-caption font-semibold uppercase text-ink-muted">Start here</p>
        <p className="mt-1 text-body-sm text-ink-strong">Ask about stock, sales, orders, payouts or how to do something in BiManage. FELI answers from your business's own data.</p>
      </div>
      {list.length > 0 && (
        <div>
          <h3 className="text-body-lg font-semibold text-ink-strong">Try one of these</h3>
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Suggested questions">
            {list.map((s) => (
              <li key={s} className="min-w-0 max-w-full">
                <button type="button" disabled={disabled} onClick={() => onPick(s)} className="max-w-full break-words rounded-lg bg-surface-tint-blue px-3 py-2.5 text-left text-body-sm font-medium text-ink-brand hover:bg-surface-tonal disabled:cursor-not-allowed disabled:opacity-60">
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Bubble({
  m,
  isLast,
  onAskPerson,
  unanswered,
  onResend,
}: {
  m: FeliMessage;
  isLast?: boolean;
  onAskPerson?: (reason?: string) => void;
  unanswered?: boolean;
  onResend?: () => void;
}) {
  const mine = m.role === "user";
  return (
    <div className={cn("flex min-w-0 max-w-[90%] flex-col gap-2", mine ? "items-end self-end" : "self-start")}>
      <div className={cn("min-w-0 rounded-2xl px-4 py-3", mine ? "bg-surface-pale" : "bg-surface-tint-aqua")}>
        <p className={cn("text-caption font-semibold uppercase", mine ? "text-ink-muted" : "text-success")}>{mine ? "You" : "FELI · Business assistant"}</p>
        {mine ? <p className="mt-1 whitespace-pre-wrap break-words text-body-sm text-ink-strong [overflow-wrap:anywhere]">{m.content}</p> : <RichText text={m.content} />}
      </div>
      {unanswered && (
        <p className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-caption text-ink-muted">
          <span>FELI didn't answer this one.</span>
          {onResend && (
            <button type="button" onClick={onResend} className="min-h-8 font-semibold text-ink-brand underline underline-offset-2">
              Send again
            </button>
          )}
        </p>
      )}
      {m.restriction && <RestrictionCard restriction={m.restriction} compact />}
      {isLast && m.handoff?.suggested && onAskPerson && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line-card bg-surface-card px-4 py-3">
          <p className="min-w-0 flex-1 break-words text-body-sm text-ink-strong">Would you like a person from our support team to help with this?</p>
          <Button size="md" variant="outlined" onClick={() => onAskPerson(m.handoff?.reason)}>
            Talk to a person
          </Button>
        </div>
      )}
    </div>
  );
}

/** **bold** and "- " bullets from FELI's replies, as React text (never HTML). */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*\n]+\*\*)/g).map((part, i) => (/^\*\*[^*\n]+\*\*$/.test(part) ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong> : part));
}

export function RichText({ text }: { text: string }) {
  const blocks: Array<{ kind: "p" | "ul"; lines: string[] }> = [];
  // Safety net: never show action markup, ids, code or dashes (the server cleans too).
  for (const raw of cleanFeliText(text).split(/\r?\n/)) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const lastBlock = blocks.at(-1);
    if (bullet) {
      if (lastBlock?.kind === "ul") lastBlock.lines.push(bullet[1]!);
      else blocks.push({ kind: "ul", lines: [bullet[1]!] });
    } else if (!line.trim()) {
      if (lastBlock && lastBlock.lines.length) blocks.push({ kind: "p", lines: [] });
    } else if (lastBlock?.kind === "p") lastBlock.lines.push(line);
    else blocks.push({ kind: "p", lines: [line] });
  }
  return (
    <div className="mt-1 flex flex-col gap-2 break-words text-body-sm text-ink-strong [overflow-wrap:anywhere]">
      {blocks
        .filter((b) => b.lines.length)
        .map((b, i) =>
          b.kind === "ul" ? (
            <ul key={i} className="flex list-disc flex-col gap-1 pl-5">
              {b.lines.map((l, j) => (
                <li key={j}>{inline(l)}</li>
              ))}
            </ul>
          ) : (
            <p key={i} className="whitespace-pre-wrap">
              {inline(b.lines.join("\n"))}
            </p>
          )
        )}
    </div>
  );
}

/** A suggestion waiting for review, shown at the end of the chat. */
function ProposalCard({ proposal, position }: { proposal: FeliProposal; position?: string }) {
  const cancel = useCancelFeliAction();
  const names = useNameLookup(proposal.action === "create_task");
  const rows = paramRows(proposal, names).slice(0, 4);
  return (
    <section aria-label="Suggested action" className="min-w-0 self-stretch rounded-2xl border border-line-strong bg-surface-card p-4">
      <p className="flex items-center gap-2 text-caption font-semibold uppercase text-ink-brand">
        <IconSparkles aria-hidden="true" className="size-4" /> FELI suggests an action{position ? ` · ${position}` : ""}
      </p>
      <h3 className="mt-1 break-words text-body-lg font-semibold text-ink-strong">{proposal.label}</h3>
      {rows.length > 0 && (
        <dl className="mt-2 flex flex-col gap-1 text-body-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex min-w-0 flex-wrap gap-x-2">
              <dt className="text-ink-muted">{k}:</dt>
              <dd className="min-w-0 break-words text-ink-strong">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-2 text-caption text-ink-muted">Nothing changes until you review and approve it.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <ButtonLink to={`/feli/review?id=${encodeURIComponent(proposal.id)}`} size="md">
          Review and approve
        </ButtonLink>
        <Button variant="outlined" size="md" loading={cancel.isPending} loadingText="Cancelling…" onClick={() => cancel.mutate(proposal.id)}>
          Cancel suggestion
        </Button>
      </div>
      <ErrorNote className="mt-3" error={cancel.error} fallback="We couldn't cancel the suggestion. Please try again." />
    </section>
  );
}

// ── Access, usage and support ────────────────────────────────────────────
const TIERS: Array<[string, string, string]> = [
  ["freemium", "Freemium", "20 messages a day and account insights"],
  ["standard", "Standard", "Unlimited messages, project tasks and support tickets"],
  ["premium", "Premium", "Adds drafting and sending invoices, and updating orders"],
];

function AccessPanel({ access, usage, onAskPerson }: { access: ReturnType<typeof useFeliAccess>; usage?: FeliUsage; onAskPerson: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <aside aria-label="Your FELI access" className="min-w-0 rounded-2xl bg-surface-pale p-4 lg:self-start lg:p-5">
      <button type="button" aria-expanded={open} aria-controls="feli-access" onClick={() => setOpen((o) => !o)} className="flex min-h-11 w-full items-center justify-between gap-2 text-left lg:hidden">
        <span className="text-title-sm text-ink-strong">Your FELI access and usage</span>
        <IconChevronDown aria-hidden="true" className={cn("size-5 shrink-0 text-ink-muted transition-transform", open && "rotate-180")} />
      </button>
      <h2 className="hidden text-title-sm text-ink-strong lg:block">Your FELI access</h2>
      <div id="feli-access" className={cn("mt-4 flex-col gap-5 lg:flex", open ? "flex" : "hidden")}>
        {access.isLoading ? (
          <p className="text-body-sm text-ink-muted" role="status">
            Loading your access…
          </p>
        ) : access.error || !access.data ? (
          <ErrorNote error={access.error} fallback="We couldn't load your FELI access." onRetry={() => void access.refetch()} />
        ) : (
          <AccessDetails a={access.data} usage={usage ?? access.data.usage} />
        )}
        <div className="flex flex-col gap-2 border-t border-line-card pt-4">
          <h3 className="text-body-lg font-semibold text-ink-strong">Need a person instead?</h3>
          <p className="text-body-sm text-ink-muted">FELI can hand you over to our support team with your recent messages.</p>
          <Button fullWidth size="md" onClick={onAskPerson} icon={<IconHeadset aria-hidden="true" className="size-4" />}>
            Talk to a person
          </Button>
        </div>
      </div>
    </aside>
  );
}

function AccessDetails({ a, usage }: { a: FeliAccess; usage: FeliUsage }) {
  const tier = a.tier === "starter" ? "freemium" : a.tier;
  return (
    <>
      <div className="flex flex-col gap-2 rounded-xl bg-surface-card p-4">
        <p className="flex flex-wrap items-center gap-2 text-caption font-semibold uppercase text-ink-muted">
          Your plan <Status tone="neutral">{tierName(a.tier)}</Status>
        </p>
        {usage.unlimited ? (
          <p className="text-body-lg font-semibold text-ink-strong">Unlimited messages</p>
        ) : (
          <>
            <p className="text-body-lg font-semibold text-ink-strong">
              {usage.remaining ?? 0} of {usage.limit ?? 0} messages left today
            </p>
            <p className="text-caption text-ink-muted">Shared by everyone in your business. Resets at midnight, Lagos time{usage.resetsAt ? ` (${lagosTime(usage.resetsAt)})` : ""}.</p>
          </>
        )}
      </div>
      <div>
        <h3 className="text-caption font-semibold uppercase text-ink-muted">What FELI can do for you</h3>
        {a.actions.length ? (
          <ul className="mt-2 flex flex-col gap-1.5">
            {a.actions.map((x) => (
              <li key={x} className="break-words rounded-md bg-surface-card px-3 py-2 text-body-sm text-ink-strong">
                {actionLabel(x)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-body-sm text-ink-strong">Answers and insights. Actions start on Standard.</p>
        )}
      </div>
      <ul className="flex flex-col gap-2" aria-label="FELI on each plan">
        {TIERS.map(([id, name, body]) => (
          <li key={id} className={cn("rounded-xl bg-surface-card p-3", id === tier && "shadow-[inset_0_0_0_1px_var(--color-brand-navy)]")}>
            <p className="text-caption font-semibold uppercase text-ink-brand">
              {name}
              {id === tier ? " · your plan" : ""}
            </p>
            <p className="mt-1 text-body-sm text-ink-muted">{body}</p>
          </li>
        ))}
      </ul>
      {tier !== "premium" && (
        <ButtonLink to="/subscription/plans" variant="outlined" size="md" fullWidth>
          Compare plans
        </ButtonLink>
      )}
    </>
  );
}
