import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { IconAlertTriangle, IconArrowLeft, IconBell, IconBellOff, IconFileText, IconFlag, IconLock, IconMessages, IconPaperclip, IconPlus, IconSearch, IconSend, IconShieldCheck, IconTrash, IconX } from "@tabler/icons-react";
import { Avatar, Button, ButtonLink, Dialog, EmptyState, Field, Spinner, Status, TextArea, TextInput } from "@/components/ui";
import { PageTitle } from "@/components/page/Blocks";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { ApiError } from "@/lib/api/client";
import { useFeature } from "@/lib/workspace/subscription";
import { useUrlState } from "@/lib/nav/useUrlState";
import { cn } from "@/lib/cn";
import { shortDate } from "@/lib/format";
import { MAX_ATTACHMENTS, attachmentProblem, isImage, sizeLabel, uploadAttachment, type Attachment } from "@/lib/attachments";
import {
  TYPE_LABEL,
  inboxTime,
  useBlockConversation,
  useContacts,
  useConversations,
  useHideConversation,
  useMuteConversation,
  useReportConversation,
  useSendMessage,
  useStartConversation,
  useThread,
  useUnblockConversation,
  type BlockRestricted,
  type ChatMessage,
  type ConversationRow,
  type Thread,
} from "@/lib/messages/api";

// Messages (Figma 12.01 directory, 12.02 order conversation, 12.04 block
// restricted, 12.10 conversations). Desktop: list + thread + details side by
// side. Phone: the list, then the thread.

const FILTERS: Array<[string, string]> = [
  ["all", "All"],
  ["unread", "Unread"],
  ["customer", "Customers"],
  ["supplier", "Suppliers"],
  ["guest", "Store guests"],
  ["team", "Team"],
];

export function MessagesPage() {
  const { id } = useParams();
  const { access: canMessage } = useFeature("messages");
  return (
    <div className="flex flex-col gap-5">
      <div className={cn(id && "hidden lg:block")}>
        <PageTitle actions={<NewMessageButton disabled={!canMessage} />}>Messages and conversations</PageTitle>
        <p className="-mt-3 text-body-sm text-ink-muted">Chat with customers, team members and wholesale partners. Messages arrive in real time.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] desktop:grid-cols-[minmax(0,22rem)_minmax(0,1fr)_16rem]">
        <section aria-label="Conversations" className={cn(id && "hidden lg:block")}>
          <ConversationList activeId={id} />
        </section>
        {id ? (
          <ThreadView key={id} id={id} canMessage={canMessage === true} />
        ) : (
          <div className="hidden rounded-2xl border border-line-card bg-surface-card lg:block">
            <EmptyState className="border-0" icon={<IconMessages className="size-7" />} title="Choose a conversation" body="Or start a new one with a teammate or supplier." />
          </div>
        )}
        <aside className="hidden desktop:block" aria-label="Messaging details">
          <InboxFacts />
        </aside>
      </div>
    </div>
  );
}

function InboxFacts() {
  const rows: Array<[string, string]> = [
    ["Channels", "Team · Supplier · Customer · Store guest"],
    ["Store guests", "No account needed: shoppers chat from your store"],
    ["Retention", "Messages clear after 6 months"],
    ["Safety", "Blocking is restricted while a paid order is active"],
  ];
  return (
    <div className="rounded-2xl bg-surface-pale p-4">
      <p className="text-caption font-semibold uppercase text-ink-brand">Details & actions</p>
      <dl className="mt-3 flex flex-col gap-3">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-caption font-semibold uppercase text-ink-muted">{k}</dt>
            <dd className="text-body-sm text-ink-strong">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ── List ─────────────────────────────────────────────────────────────────
function ConversationList({ activeId }: { activeId?: string }) {
  const [filter, setFilter] = useUrlState<string>("show", "all", FILTERS.map(([k]) => k));
  const [q, setQ] = useUrlState<string>("q", "");
  const [typed, setTyped] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => typed !== q && setQ(typed.trim()), 300);
    return () => clearTimeout(t);
  }, [typed, q, setQ]);
  const list = useConversations(filter, q);
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line-card bg-surface-card p-4">
      <div>
        <h2 className="text-title-sm font-semibold text-ink-strong">Recent conversations</h2>
        <p className="text-caption text-ink-muted">All chats · unread and type filters</p>
      </div>
      <Field label="Search">
        <TextInput type="search" placeholder="Find a person, business or order" value={typed} onChange={(e) => setTyped(e.target.value)} trailing={<IconSearch aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />} />
      </Field>
      <div role="tablist" aria-label="Filter conversations" className="-mx-1 flex gap-1 overflow-x-auto px-1">
        {FILTERS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={filter === k} type="button" onClick={() => setFilter(k)} className={cn("min-h-9 shrink-0 rounded-full px-3 text-caption font-semibold", filter === k ? "bg-brand-navy text-ink-on-brand" : "bg-surface-pale text-ink-muted hover:text-ink-brand")}>
            {label}
          </button>
        ))}
      </div>
      {list.isLoading ? (
        <div className="flex justify-center py-8 text-ink-brand" role="status">
          <Spinner />
          <span className="sr-only">Loading conversations…</span>
        </div>
      ) : list.error ? (
        <ErrorNote error={list.error} fallback="We couldn't load your conversations." onRetry={() => void list.refetch()} />
      ) : !list.data?.conversations.length ? (
        <p className="py-6 text-center text-body-sm text-ink-muted">{q || filter !== "all" ? "No conversations match." : "No conversations yet."}</p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {list.data.conversations.map((c) => (
            <li key={c._id}>
              <ConversationLink c={c} active={c._id === activeId} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ConversationLink({ c, active }: { c: ConversationRow; active: boolean }) {
  const preview = c.lastMessage ? `${c.lastMessage.mine ? "You: " : ""}${c.lastMessage.content || (c.lastMessage.hasAttachments ? "Attachment" : "")}` : c.related?.label ? `Linked to ${c.related.label}` : "No messages yet";
  return (
    <Link
      to={`/messages/${c._id}`}
      aria-current={active ? "page" : undefined}
      className={cn("flex min-h-16 items-center gap-3 rounded-xl px-2 py-2", active ? "bg-surface-tonal" : "hover:bg-surface-pale")}
    >
      <Avatar name={c.title} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={cn("truncate text-body-sm text-ink-strong", c.unread > 0 && "font-semibold")}>{c.title}</span>
          <span className="shrink-0 text-caption text-ink-muted">{inboxTime(c.lastMessageAt)}</span>
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-caption text-ink-muted">
            {TYPE_LABEL[c.type]} · {preview}
          </span>
          {c.unread > 0 ? (
            <span className="min-w-5 shrink-0 rounded-full bg-brand-navy px-1.5 text-center text-caption font-semibold text-ink-on-brand" aria-label={`${c.unread} unread`}>
              {c.unread}
            </span>
          ) : c.muted ? (
            <IconBellOff aria-label="Muted" className="size-4 shrink-0 text-ink-muted" />
          ) : null}
        </span>
      </span>
    </Link>
  );
}

// ── New message (12.10 "New message") ────────────────────────────────────
function NewMessageButton({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const contacts = useContacts(q.trim(), open);
  const start = useStartConversation();
  const navigate = useNavigate();
  return (
    <>
      <Button size="md" onClick={() => setOpen(true)} disabled={disabled} title={disabled ? "Messaging is included in Standard and Premium" : undefined}>
        <IconPlus aria-hidden="true" className="size-4" /> New message
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New message" description="Choose a teammate or a supplier.">
        <div className="flex flex-col gap-3">
          <Field label="To">
            <TextInput type="search" autoFocus placeholder="Search by name or business" value={q} onChange={(e) => setQ(e.target.value)} />
          </Field>
          {contacts.isLoading ? (
            <Spinner className="self-center text-ink-brand" />
          ) : (
            <ul className="flex max-h-72 flex-col overflow-y-auto">
              {(contacts.data ?? []).map((c) => (
                <li key={`${c.kind}-${c.id}`}>
                  <button
                    type="button"
                    disabled={start.isPending}
                    onClick={() =>
                      start.mutate({ recipientId: c.id }, { onSuccess: (r) => (setOpen(false), navigate(`/messages/${r._id}`)) })
                    }
                    className="flex min-h-12 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-surface-pale"
                  >
                    <Avatar name={c.name} src={c.avatar} />
                    <span className="flex-1 text-body-sm text-ink-strong">{c.name}</span>
                    <Status tone="neutral">{c.kind === "team" ? "Team" : "Supplier"}</Status>
                  </button>
                </li>
              ))}
              {contacts.data && !contacts.data.length && <li className="py-4 text-center text-body-sm text-ink-muted">No one matches.</li>}
            </ul>
          )}
          <ErrorNote error={start.error} />
        </div>
      </Dialog>
    </>
  );
}

// ── Thread ───────────────────────────────────────────────────────────────
function ThreadView({ id, canMessage }: { id: string; canMessage: boolean }) {
  const thread = useThread(id);
  const navigate = useNavigate();
  const first = thread.data?.pages[0];
  // Oldest first for reading (each server page is oldest→newest; later pages are older).
  const messages = useMemo(() => [...(thread.data?.pages ?? [])].reverse().flatMap((p: Thread) => p.messages), [thread.data]);
  const endRef = useRef<HTMLDivElement>(null);
  const lastId = messages.at(-1)?._id;
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [lastId]);

  if (thread.isLoading)
    return (
      <div className="flex justify-center rounded-2xl border border-line-card bg-surface-card py-16 text-ink-brand" role="status">
        <Spinner className="size-8" />
        <span className="sr-only">Loading messages…</span>
      </div>
    );
  if (thread.error || !first) {
    const gone = thread.error instanceof ApiError && thread.error.status === 404;
    return (
      <div className="rounded-2xl border border-line-card bg-surface-card p-4">
        <ErrorNote error={thread.error} fallback={gone ? "This conversation isn't available." : "We couldn't load this conversation."} onRetry={gone ? undefined : () => void thread.refetch()} />
        <ButtonLink to="/messages" variant="outlined" size="md" className="mt-3">
          Back to messages
        </ButtonLink>
      </div>
    );
  }
  const c = first.conversation;
  return (
    <section aria-label={`Conversation with ${c.title}`} className="flex min-h-[32rem] flex-col rounded-2xl border border-line-card bg-surface-card">
      <header className="flex items-center gap-3 border-b border-line-subtle px-4 py-3">
        <button type="button" onClick={() => navigate("/messages")} className="flex size-10 items-center justify-center rounded-full hover:bg-surface-pale lg:hidden" aria-label="Back to conversations">
          <IconArrowLeft aria-hidden="true" className="size-5" />
        </button>
        <Avatar name={c.title} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-body-lg font-semibold text-ink-strong">{c.title}</h2>
          <p className="text-caption text-ink-muted">
            {TYPE_LABEL[c.type]} conversation{c.related?.label ? ` · linked to ${c.related.label}` : ""}
          </p>
        </div>
      </header>
      {c.related?.label && (
        <p className="flex items-center gap-2 bg-surface-tint-blue px-4 py-2 text-caption text-ink-brand">
          <IconShieldCheck aria-hidden="true" className="size-4 shrink-0" /> Order messages can be used as dispute evidence and are kept for 6 months.
        </p>
      )}
      <ConversationActions id={id} c={c} />
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {thread.hasNextPage && (
          <Button variant="outlined" size="md" className="self-center" loading={thread.isFetchingNextPage} onClick={() => void thread.fetchNextPage()}>
            Load earlier messages
          </Button>
        )}
        {!messages.length && <p className="py-8 text-center text-body-sm text-ink-muted">No messages yet. Say hello.</p>}
        {messages.map((m) => (
          <Bubble key={m._id} m={m} />
        ))}
        <div ref={endRef} />
      </div>
      {c.blocked ? (
        <p className="flex items-center gap-2 border-t border-line-subtle px-4 py-3 text-body-sm text-ink-muted">
          <IconLock aria-hidden="true" className="size-4" /> {c.blocked.byMe ? "You blocked this conversation. Unblock it to send messages." : "You can't send messages in this conversation."}
        </p>
      ) : canMessage ? (
        <Composer id={id} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-subtle px-4 py-3">
          <p className="text-body-sm text-ink-muted">Replying is included in Standard and Premium.</p>
          <ButtonLink to="/subscription/plans" size="md">
            See plans
          </ButtonLink>
        </div>
      )}
    </section>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  return (
    <div className={cn("flex max-w-[85%] flex-col gap-1", m.mine ? "self-end items-end" : "self-start items-start")}>
      <span className="text-caption text-ink-muted">
        {m.mine ? "You" : m.sender.name} · {new Date(m.createdAt).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}
        {inboxTime(m.createdAt) !== new Date(m.createdAt).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" }) ? ` · ${shortDate(m.createdAt)}` : ""}
      </span>
      {m.content && <p className={cn("whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-body-sm", m.mine ? "bg-brand-navy text-ink-on-brand" : "bg-surface-pale text-ink-strong")}>{m.content}</p>}
      {m.attachments.map((a) => (
        <AttachmentLink key={a.url} a={a} />
      ))}
    </div>
  );
}

export function AttachmentLink({ a }: { a: Attachment }) {
  return (
    <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border border-line-card bg-surface-card px-3 py-2 text-body-sm text-ink-brand hover:bg-surface-pale">
      {isImage(a) ? <img src={a.url} alt="" className="size-10 rounded object-cover" /> : <IconFileText aria-hidden="true" className="size-5" />}
      <span className="max-w-48 truncate">{a.name || "Attachment"}</span>
      {a.size ? <span className="text-caption text-ink-muted">{sizeLabel(a.size)}</span> : null}
    </a>
  );
}

/** Pick files, upload each, show chips; used by messages (and reusable elsewhere). */
export function useAttachmentPicker() {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const add = async (list: FileList | null) => {
    setProblem(null);
    const picked = Array.from(list ?? []);
    if (files.length + picked.length > MAX_ATTACHMENTS) return setProblem(`Attach up to ${MAX_ATTACHMENTS} files.`);
    for (const f of picked) {
      const p = attachmentProblem(f);
      if (p) return setProblem(p);
    }
    setUploading((n) => n + picked.length);
    for (const f of picked) {
      try {
        const up = await uploadAttachment(f);
        setFiles((prev) => [...prev, up]);
      } catch {
        setProblem(`We couldn't upload ${f.name}. Please try again.`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };
  return { files, uploading, problem, add, remove: (url: string) => setFiles((p) => p.filter((a) => a.url !== url)), clear: () => setFiles([]) };
}

function Composer({ id }: { id: string }) {
  const [text, setText] = useState("");
  const send = useSendMessage(id);
  const picker = useAttachmentPicker();
  const fileRef = useRef<HTMLInputElement>(null);
  const canSend = (text.trim().length > 0 || picker.files.length > 0) && picker.uploading === 0 && !send.isPending;
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSend) return;
    send.mutate(
      { content: text.trim(), attachments: picker.files },
      {
        onSuccess: () => {
          setText("");
          picker.clear();
        },
      }
    );
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-2 border-t border-line-subtle px-4 py-3">
      {(picker.files.length > 0 || picker.uploading > 0) && (
        <ul className="flex flex-wrap gap-2" aria-label="Attachments">
          {picker.files.map((a) => (
            <li key={a.url} className="flex items-center gap-1 rounded-full bg-surface-pale py-1 pl-3 pr-1 text-caption text-ink-strong">
              <span className="max-w-40 truncate">{a.name}</span>
              <button type="button" onClick={() => picker.remove(a.url)} className="flex size-7 items-center justify-center rounded-full hover:bg-surface-tonal" aria-label={`Remove ${a.name}`}>
                <IconX aria-hidden="true" className="size-3.5" />
              </button>
            </li>
          ))}
          {picker.uploading > 0 && <li className="text-caption text-ink-muted">Uploading…</li>}
        </ul>
      )}
      {picker.problem && <p className="text-caption text-danger">{picker.problem}</p>}
      <div className="flex items-end gap-2">
        <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => (void picker.add(e.target.files), (e.target.value = ""))} />
        <button type="button" onClick={() => fileRef.current?.click()} className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-pale hover:text-ink-brand" aria-label="Attach file">
          <IconPaperclip aria-hidden="true" className="size-5" />
        </button>
        <label className="sr-only" htmlFor={`composer-${id}`}>
          Message
        </label>
        <TextArea id={`composer-${id}`} rows={1} maxLength={5000} placeholder="Type a message" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} className="max-h-40 min-h-11 flex-1" />
        <Button type="submit" size="md" disabled={!canSend} loading={send.isPending} aria-label="Send">
          <IconSend aria-hidden="true" className="size-4" />
        </Button>
      </div>
      <ErrorNote error={send.error} />
    </form>
  );
}

// ── Conversation actions: mute, block (12.04), report, remove ────────────
function ConversationActions({ id, c }: { id: string; c: Thread["conversation"] }) {
  const mute = useMuteConversation(id);
  const block = useBlockConversation(id);
  const unblock = useUnblockConversation(id);
  const hide = useHideConversation();
  const navigate = useNavigate();
  const [restricted, setRestricted] = useState<BlockRestricted | null>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reporting, setReporting] = useState(false);
  const onBlock = () =>
    block.mutate(undefined, {
      onSuccess: () => setConfirmBlock(false),
      onError: (err) => {
        setConfirmBlock(false);
        if (err instanceof ApiError && err.status === 409 && err.data.code === "BLOCK_RESTRICTED") setRestricted(err.data as unknown as BlockRestricted);
      },
    });
  const action = "flex min-h-9 items-center gap-1.5 rounded-full bg-surface-pale px-3 text-caption font-semibold text-ink-strong hover:bg-surface-tonal disabled:opacity-60";
  return (
    <>
      <div className="flex flex-wrap gap-2 border-b border-line-subtle px-4 py-2" role="group" aria-label="Conversation actions">
        <button type="button" className={action} disabled={mute.isPending} onClick={() => mute.mutate(!c.muted)}>
          {c.muted ? <IconBell aria-hidden="true" className="size-4" /> : <IconBellOff aria-hidden="true" className="size-4" />}
          {c.muted ? "Unmute alerts" : "Mute alerts"}
        </button>
        {c.type !== "team" &&
          (c.blocked?.byMe ? (
            <button type="button" className={action} disabled={unblock.isPending} onClick={() => unblock.mutate()}>
              <IconLock aria-hidden="true" className="size-4" /> Unblock
            </button>
          ) : (
            <button type="button" className={action} onClick={() => setConfirmBlock(true)}>
              <IconLock aria-hidden="true" className="size-4" /> {c.type === "guest" ? "Close chat" : "Block"}
            </button>
          ))}
        <button type="button" className={action} onClick={() => setReporting(true)}>
          <IconFlag aria-hidden="true" className="size-4" /> Report
        </button>
        <button type="button" className={action} disabled={hide.isPending} onClick={() => hide.mutate(id, { onSuccess: () => navigate("/messages") })}>
          <IconTrash aria-hidden="true" className="size-4" /> Remove from inbox
        </button>
      </div>
      <ErrorNote error={(block.error instanceof ApiError && block.error.status === 409 ? null : block.error) ?? mute.error ?? unblock.error ?? hide.error} className="mx-4 mt-2" />
      <Dialog
        open={confirmBlock}
        onClose={() => setConfirmBlock(false)}
        tone="danger"
        title={c.type === "guest" ? "Close this chat?" : `Block ${c.title}?`}
        description={c.type === "guest" ? "The shopper won't be able to send more messages here." : "Neither side can send messages until you unblock. The history is kept."}
        actions={
          <>
            <Button variant="outlined" onClick={() => setConfirmBlock(false)}>
              Cancel
            </Button>
            <Button variant="destructive" loading={block.isPending} onClick={onBlock}>
              {c.type === "guest" ? "Close chat" : "Block"}
            </Button>
          </>
        }
      />
      {/* 12.04 Block action restricted */}
      <Dialog
        open={Boolean(restricted)}
        onClose={() => setRestricted(null)}
        icon={<IconAlertTriangle className="size-7" />}
        title="Blocking is unavailable"
        description="This conversation has an active paid order. An active paid order must be resolved before the account can be blocked. You can still report abusive messages to support."
        actions={
          <>
            <Button variant="outlined" onClick={() => (setRestricted(null), setReporting(true))}>
              Report
            </Button>
            <Button variant="outlined" onClick={() => (setRestricted(null), mute.mutate(true))}>
              Mute alerts
            </Button>
            {restricted && (
              <ButtonLink to={restricted.activeOrder.kind === "store_order" ? `/store/orders/${restricted.activeOrder.id}` : `/bisupplynet/orders/${restricted.activeOrder.id}`}>View active order</ButtonLink>
            )}
          </>
        }
      >
        {restricted && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-body-sm">
            <dt className="text-ink-muted">Conversation</dt>
            <dd className="text-ink-strong">{c.title}</dd>
            <dt className="text-ink-muted">Active order</dt>
            <dd className="text-ink-strong">{restricted.activeOrder.label}</dd>
            <dt className="text-ink-muted">Reason</dt>
            <dd className="text-ink-strong">{restricted.reason}</dd>
          </dl>
        )}
      </Dialog>
      <ReportDialog id={id} open={reporting} onClose={() => setReporting(false)} title={c.title} />
    </>
  );
}

function ReportDialog({ id, open, onClose, title }: { id: string; open: boolean; onClose: () => void; title: string }) {
  const [reason, setReason] = useState("");
  const report = useReportConversation(id);
  const done = report.data;
  const close = () => {
    onClose();
    setReason("");
    report.reset();
  };
  let body: ReactNode;
  if (done)
    body = (
      <p className="text-body-sm text-ink-strong">
        Thanks. Support ticket{" "}
        <Link className="font-semibold text-ink-brand underline" to={`/support/tickets/${done.ticketId}`}>
          {done.ticketNumber}
        </Link>{" "}
        was opened; BiManage will review the conversation.
      </p>
    );
  else
    body = (
      <Field label="What happened?" error={report.error instanceof ApiError && report.error.status === 400 ? report.error.message : undefined}>
        <TextArea rows={4} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Describe the messages or behaviour" />
      </Field>
    );
  return (
    <Dialog
      open={open}
      onClose={close}
      icon={<IconFlag className="size-7" />}
      title={done ? "Report sent" : `Report conversation with ${title}`}
      description={done ? undefined : "The messages are kept as evidence. BiManage support will review them."}
      actions={
        done ? (
          <Button onClick={close}>Done</Button>
        ) : (
          <>
            <Button variant="outlined" onClick={close}>
              Cancel
            </Button>
            <Button loading={report.isPending} disabled={reason.trim().length < 5} onClick={() => report.mutate(reason.trim())}>
              Send report
            </Button>
          </>
        )
      }
    >
      {body}
      {!done && !(report.error instanceof ApiError && report.error.status === 400) && <ErrorNote error={report.error} />}
    </Dialog>
  );
}
