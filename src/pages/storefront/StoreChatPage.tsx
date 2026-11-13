import { useEffect, useRef, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { IconLock, IconMessageCircle, IconSend } from "@tabler/icons-react";
import { Button, Field, SelectInput, Spinner, TextArea, TextInput } from "@/components/ui";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { EmailSuggestion } from "@/components/ui/EmailSuggestion";
import { ApiError } from "@/lib/api/client";
import { applyFieldErrors } from "@/lib/api/errorMessage";
import { cn } from "@/lib/cn";
import { adoptTokenFromLink, chatToken, getStoreChat, sendStoreChat, startStoreChat, useStoreChatLive, type GuestChat } from "@/lib/store/chat";
import { useStorefront } from "./StorefrontLayout";

// Storefront guest chat (Figma 12.03): ask the store a question without an
// account. Replies show here live, and by email when you're away.

const TOPICS = ["Product question", "Delivery enquiry", "Order problem", "Returns and refunds", "Something else"];
const schema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  email: z.string().trim().email("Enter a valid email so the store can reply."),
  topic: z.string(),
  orderNumber: z.string().trim().max(40).optional(),
  message: z.string().trim().min(2, "Write your question.").max(2000, "Keep it under 2,000 characters."),
});
type Values = z.infer<typeof schema>;

export function StoreChatPage() {
  const { slug, store, preview } = useStorefront();
  const [token, setToken] = useState<string | null>(() => adoptTokenFromLink(slug) ?? chatToken.get(slug));
  const [ended, setEnded] = useState(false);
  if (preview)
    return <p className="rounded-xl bg-surface-pale p-5 text-body-sm text-ink-secondary">Chat opens to shoppers once your store is published.</p>;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="text-title-md font-semibold text-ink-strong">Chat with {store.storeName}</h1>
        <p className="mt-1 text-body-sm text-ink-muted">No account needed. Ask about a product, delivery or your order.</p>
      </div>
      {token ? (
        <ChatThread
          slug={slug}
          token={token}
          onEnded={() => {
            chatToken.clear(slug);
            setToken(null);
            setEnded(true);
          }}
        />
      ) : (
        <StartChat
          slug={slug}
          ended={ended}
          onStarted={(t) => {
            chatToken.set(slug, t);
            setToken(t);
          }}
        />
      )}
    </div>
  );
}

function StartChat({ slug, ended, onStarted }: { slug: string; ended: boolean; onStarted: (token: string) => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const { register, handleSubmit, formState, setError: setFieldError, watch, setValue } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", email: "", topic: TOPICS[0], orderNumber: "", message: "" } });
  const email = watch("email");
  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      const res = await startStoreChat(slug, { name: v.name, email: v.email, message: v.message, topic: v.topic, ...(v.orderNumber ? { orderNumber: v.orderNumber } : {}) });
      qc.setQueryData(["storeChat", slug, res.token], undefined);
      onStarted(res.token);
    } catch (err) {
      if (!applyFieldErrors(err, setFieldError, ["name", "email", "message"])) setError(err);
    }
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 rounded-2xl border border-line-card bg-surface-card p-5">
      {ended && <p className="rounded-xl bg-surface-pale p-3 text-body-sm text-ink-secondary">That chat has ended or the link expired. Start a new one below.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Your name" required error={formState.errors.name?.message}>
          <TextInput autoComplete="name" {...register("name")} />
        </Field>
        <Field label="Email" required error={formState.errors.email?.message} hint="The store replies here if you leave this page.">
          <TextInput type="email" autoComplete="email" inputMode="email" {...register("email")} />
        </Field>
      </div>
      <EmailSuggestion value={email} onAccept={(e) => setValue("email", e, { shouldValidate: true })} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Topic">
          <SelectInput {...register("topic")}>
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Order number" hint="Optional, e.g. BM-7K2Q-9MXA" error={formState.errors.orderNumber?.message}>
          <TextInput autoComplete="off" {...register("orderNumber")} />
        </Field>
      </div>
      <Field label="Your question" required error={formState.errors.message?.message}>
        <TextArea rows={4} maxLength={2000} {...register("message")} />
      </Field>
      <p className="flex items-start gap-2 text-caption text-ink-muted">
        <IconLock aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> Your name and email are shared with this store only, so they can reply. Messages are kept for 6 months.
      </p>
      <ErrorNote error={error} />
      <Button type="submit" loading={formState.isSubmitting} className="self-start">
        <IconMessageCircle aria-hidden="true" className="size-4" /> Start chat
      </Button>
    </form>
  );
}

function ChatThread({ slug, token, onEnded }: { slug: string; token: string; onEnded: () => void }) {
  const chat = useQuery({
    queryKey: ["storeChat", slug, token],
    queryFn: () => getStoreChat(slug, token),
    retry: false,
    refetchOnWindowFocus: true,
  });
  useStoreChatLive(slug, token, () => void chat.refetch());
  const gone = chat.error instanceof ApiError && chat.error.status === 404;
  useEffect(() => {
    if (gone) onEnded();
  }, [gone, onEnded]);
  const endRef = useRef<HTMLDivElement>(null);
  const count = chat.data?.messages.length ?? 0;
  useEffect(() => endRef.current?.scrollIntoView?.({ block: "end" }), [count]);

  if (chat.isLoading)
    return (
      <div className="flex justify-center py-10 text-ink-brand" role="status">
        <Spinner className="size-8" />
        <span className="sr-only">Opening your chat…</span>
      </div>
    );
  if (!chat.data) return <ErrorNote error={chat.error} fallback="We couldn't open your chat." onRetry={() => void chat.refetch()} />;
  return <ThreadBody data={chat.data} slug={slug} token={token} endRef={endRef} onSent={() => void chat.refetch()} />;
}

function ThreadBody({ data, slug, token, endRef, onSent }: { data: GuestChat; slug: string; token: string; endRef: React.RefObject<HTMLDivElement>; onSent: () => void }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    try {
      await sendStoreChat(slug, token, text.trim());
      setText("");
      onSent();
    } catch (err) {
      setError(err);
    } finally {
      setSending(false);
    }
  };
  return (
    <section aria-label={`Chat with ${data.store.name}`} className="flex flex-col rounded-2xl border border-line-card bg-surface-card">
      <p className="border-b border-line-subtle px-4 py-3 text-caption text-ink-muted">
        Chatting as <span className="font-semibold text-ink-strong">{data.name}</span>
        {data.related ? ` · about order ${data.related.label}` : ""}. We'll email you when the store replies.
      </p>
      <div className="flex max-h-[60vh] min-h-64 flex-col gap-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {data.messages.map((m) => (
          <div key={m._id} className={cn("flex max-w-[85%] flex-col gap-1", m.mine ? "items-end self-end" : "items-start self-start")}>
            <span className="text-caption text-ink-muted">
              {m.mine ? "You" : data.store.name} · {new Date(m.createdAt).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}
            </span>
            <p className={cn("whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-body-sm", m.mine ? "bg-brand-navy text-ink-on-brand" : "bg-surface-pale text-ink-strong")}>{m.content}</p>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {data.closed ? (
        <p className="border-t border-line-subtle px-4 py-3 text-body-sm text-ink-muted">The store has closed this chat.</p>
      ) : (
        <form onSubmit={submit} className="flex items-end gap-2 border-t border-line-subtle px-4 py-3">
          <label htmlFor="guest-chat-input" className="sr-only">
            Message
          </label>
          <TextArea id="guest-chat-input" rows={1} maxLength={2000} placeholder="Type a message" value={text} onChange={(e) => setText(e.target.value)} className="max-h-40 min-h-11 flex-1" />
          <Button type="submit" size="md" loading={sending} disabled={!text.trim()} aria-label="Send">
            <IconSend aria-hidden="true" className="size-4" />
          </Button>
        </form>
      )}
      <ErrorNote error={error} className="mx-4 mb-3" />
    </section>
  );
}
