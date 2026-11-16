import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { IconSend, IconX } from "@tabler/icons-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cn } from "@/lib/cn";
import { FeliAvatar } from "@/components/feli/FeliAvatar";
import { cleanFeliText } from "@/lib/feli/clean";
import {
  FELI_GUEST_MAX,
  feliGuestHistory,
  feliGuestSessionId,
  fetchFeliGuestConfig,
  loadFeliGuestChat,
  loadTurnstile,
  saveFeliGuestChat,
  sendFeliGuest,
  type FeliGuestBody,
  type FeliGuestReply,
  type FeliGuestTurn,
  type TurnstileApi,
} from "@/lib/landing/feliGuest";
import "./feliGuest.css";

// "Talk to FELI": the public site's guest chat (PublicLayout pages only, so
// never inside the signed-in app). A bubble bottom-right opens a bottom sheet
// on phones and a floating panel from md up. Replies are plain text: never
// HTML (no dangerouslySetInnerHTML anywhere here).

const PANEL_ID = "feli-guest-panel";
/** Matches the close animation in feliGuest.css. */
const CLOSE_MS = 220;
const COUNTER_FROM = 400;
const WELCOME = "Hi, I'm FELI, BiManage's assistant. Ask me what BiManage does, what it costs or how to get started.";

const reducedMotion = () =>
  typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("reduce-motion"));
const isPhone = () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(max-width: 767.98px)").matches);

type Notice = {
  reason: "daily_limit" | "busy" | "rate" | "verification" | "unavailable" | "invalid" | "network" | "error";
  message: string;
  /** busy/rate: retry allowed from this time. */
  retryAt?: number;
};

function noticeFrom(err: unknown): Notice {
  if (err instanceof ApiError) {
    const reason = String(err.data.reason ?? "");
    const said = typeof err.data.message === "string" && err.data.message.trim() ? err.data.message.trim() : "";
    if (err.status === 429 && reason === "daily_limit") return { reason: "daily_limit", message: said || "You've reached today's FELI messages. Create a free account to keep going, or contact us." };
    if (err.status === 429) {
      const secs = Math.min(60, Math.max(2, err.retryAfterSeconds ?? (reason === "rate" ? 10 : 5)));
      return { reason: reason === "rate" ? "rate" : "busy", message: said || "FELI is busy right now. Please try again in a moment.", retryAt: Date.now() + secs * 1000 };
    }
    if (err.status === 403) return { reason: "verification", message: said || "We couldn't confirm you're a person. Please try again." };
    if (err.status === 503) return { reason: "unavailable", message: said || "FELI isn't available right now. You can still create a free account or contact us." };
    if (err.status === 400) return { reason: "invalid", message: said || "Please check your message and try again." };
    if (err.kind !== "http") return { reason: "network", message: "Can't reach FELI right now. Check your connection and try again." };
  }
  return { reason: "error", message: "FELI couldn't answer just now. Please try again." };
}

/** Cloudflare Turnstile, loaded and rendered only when the server sends a site key. */
function useTurnstile(siteKey: string | null | undefined, active: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widget = useRef<{ api: TurnstileApi; id?: string } | null>(null);
  const token = useRef<string | null>(null);
  const waiters = useRef<Array<(t: string | undefined) => void>>([]);
  const flush = (t: string | undefined) => {
    const list = waiters.current;
    waiters.current = [];
    for (const w of list) w(t);
  };

  useEffect(() => {
    if (!siteKey || !active) return;
    let cancelled = false;
    loadTurnstile()
      .then((ts) => {
        if (cancelled || !containerRef.current) return;
        const id = ts.render(containerRef.current, {
          sitekey: siteKey,
          action: "feli_guest",
          appearance: "interaction-only",
          size: "flexible",
          callback: (t: string) => {
            if (waiters.current.length) flush(t);
            else token.current = t;
          },
          "expired-callback": () => {
            token.current = null;
          },
          "error-callback": () => flush(undefined),
        });
        widget.current = { api: ts, id: id ?? undefined };
      })
      .catch(() => flush(undefined));
    return () => {
      cancelled = true;
      const w = widget.current;
      widget.current = null;
      token.current = null;
      try {
        w?.api.remove(w.id);
      } catch {
        /* already gone */
      }
      flush(undefined);
    };
  }, [siteKey, active]);

  /** A one-use token (waits for the widget; gives up after 30 s and sends without). */
  const getToken = useCallback((): Promise<string | undefined> => {
    if (!siteKey) return Promise.resolve(undefined);
    if (token.current) {
      const t = token.current;
      token.current = null;
      return Promise.resolve(t);
    }
    return new Promise((resolve) => {
      const done = (t: string | undefined) => {
        clearTimeout(timer);
        resolve(t);
      };
      const timer = setTimeout(() => {
        waiters.current = waiters.current.filter((w) => w !== done);
        resolve(undefined);
      }, 30_000);
      waiters.current.push(done);
    });
  }, [siteKey]);

  /** Re-run the widget for a fresh token (after a 403 "verification"). */
  const refresh = useCallback((): Promise<string | undefined> => {
    token.current = null;
    const next = getToken();
    const w = widget.current;
    try {
      w?.api.reset(w.id);
    } catch {
      /* the waiter times out */
    }
    return next;
  }, [getToken]);

  return { containerRef, getToken, refresh };
}

/** **bold** as React text (never HTML). */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*\n]+\*\*)/g).map((part, i) => (/^\*\*[^*\n]+\*\*$/.test(part) ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong> : part));
}

/** Plain text with line breaks and simple "- " / "1. " lists. */
function ReplyText({ text }: { text: string }) {
  const blocks: Array<{ kind: "p" | "ul" | "ol"; lines: string[] }> = [];
  for (const raw of cleanFeliText(text).split(/\r?\n/)) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const last = blocks.at(-1);
    if (bullet || numbered) {
      const kind = bullet ? "ul" : "ol";
      const item = (bullet ?? numbered)![1]!;
      if (last?.kind === kind) last.lines.push(item);
      else blocks.push({ kind, lines: [item] });
    } else if (!line.trim()) {
      if (last && last.lines.length) blocks.push({ kind: "p", lines: [] });
    } else if (last?.kind === "p") last.lines.push(line);
    else blocks.push({ kind: "p", lines: [line] });
  }
  return (
    <div className="flex flex-col gap-2">
      {blocks
        .filter((b) => b.lines.length)
        .map((b, i) =>
          b.kind === "p" ? (
            <p key={i} className="whitespace-pre-wrap">{inline(b.lines.join("\n"))}</p>
          ) : (
            <ul key={i} className={cn("flex flex-col gap-1 pl-5", b.kind === "ul" ? "list-disc" : "list-decimal")}>
              {b.lines.map((l, j) => (
                <li key={j}>{inline(l)}</li>
              ))}
            </ul>
          )
        )}
    </div>
  );
}

function Message({ turn }: { turn: FeliGuestTurn }) {
  const mine = turn.role === "user";
  return (
    <div className={cn("flex min-w-0 max-w-[88%] items-end gap-2", mine ? "self-end" : "self-start")}>
      {!mine && <FeliAvatar size="sm" decorative />}
      <p className="sr-only">{mine ? "You said:" : "FELI said:"}</p>
      <div className={cn("min-w-0 break-words rounded-2xl px-4 py-2.5 text-body-sm [overflow-wrap:anywhere]", mine ? "rounded-br-md bg-brand-navy text-ink-on-brand" : "rounded-bl-md bg-surface-tint-feli text-ink-strong")}>
        {mine ? <p className="whitespace-pre-wrap">{turn.content}</p> : <ReplyText text={turn.content} />}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex items-end gap-2 self-start">
      <FeliAvatar size="sm" decorative />
      <div role="status" className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-surface-tint-feli px-4 py-3" data-testid="feli-typing">
        <span className="sr-only">FELI is typing…</span>
        {[0, 1, 2].map((i) => (
          <span key={i} aria-hidden="true" className="fg-dot size-2 rounded-full bg-ink-muted" style={{ ["--fg-i" as string]: i }} />
        ))}
      </div>
    </div>
  );
}

export function FeliGuestChat() {
  const signedIn = useAuth().status === "authenticated";
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const [motion, setMotion] = useState<"full" | "reduce">("full");
  const [turns, setTurns] = useState<FeliGuestTurn[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [usage, setUsage] = useState<{ remaining: number; limit: number } | null>(null);
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [input, setInput] = useState("");
  const [website, setWebsite] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const bubbleRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<string | null>(null);
  const verified = useRef(false);
  const sessionId = () => (sessionRef.current ??= feliGuestSessionId());

  const config = useQuery({
    queryKey: ["public", "feli-guest-config"],
    queryFn: () => fetchFeliGuestConfig(sessionId()),
    enabled: everOpened,
    staleTime: 60_000,
    retry: false,
  });
  const cfg = config.data;
  const turnstile = useTurnstile(cfg?.enabled ? cfg.turnstileSiteKey : null, mounted);

  const remaining = usage?.remaining ?? cfg?.remaining;
  const limit = usage?.limit ?? cfg?.limit;
  const unavailable = config.isError || cfg?.enabled === false;
  const limited = notice?.reason === "daily_limit" || (typeof remaining === "number" && remaining <= 0 && !!cfg);
  const blocked = unavailable || limited || !cfg;
  const chips = (suggestions ?? (turns.length ? [] : cfg?.suggestions ?? [])).filter((s) => typeof s === "string" && s.trim()).slice(0, 4);

  const openChat = () => {
    if (!everOpened) setTurns(loadFeliGuestChat());
    setMotion(reducedMotion() ? "reduce" : "full");
    setEverOpened(true);
    setMounted(true);
    setOpen(true);
  };
  const closeChat = useCallback(() => {
    setOpen(false);
    bubbleRef.current?.focus();
  }, []);

  // Keep the panel mounted while it animates out.
  useEffect(() => {
    if (open || !mounted) return;
    if (reducedMotion()) {
      setMounted(false);
      return;
    }
    const t = setTimeout(() => setMounted(false), CLOSE_MS);
    return () => clearTimeout(t);
  }, [open, mounted]);

  // Focus the message box (or the close button when it can't be used) on open.
  useEffect(() => {
    if (!open || !mounted) return;
    if (inputRef.current && !inputRef.current.disabled) inputRef.current.focus();
    else closeRef.current?.focus();
  }, [open, mounted]);

  // Escape closes; phones lock the page behind the sheet.
  useLayoutEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeChat();
    };
    document.addEventListener("keydown", onKey);
    const lock = isPhone();
    const prev = document.body.style.overflow;
    if (lock) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      if (lock) document.body.style.overflow = prev;
    };
  }, [open, closeChat]);

  // Newest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, pending, busy, notice, mounted]);

  // Countdown for "Try again" after busy/rate.
  useEffect(() => {
    if (!notice?.retryAt) return;
    setNow(Date.now());
    const t = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= notice.retryAt!) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [notice]);

  async function send(raw: string) {
    const message = raw.trim().slice(0, FELI_GUEST_MAX);
    if (!message || busy || blocked) return;
    setBusy(true);
    setPending(message);
    setNotice(null);
    setSuggestions([]);
    setInput("");
    const body: FeliGuestBody = { message, sessionId: sessionId(), history: feliGuestHistory(turns), website };
    try {
      if (!verified.current && cfg?.turnstileSiteKey) {
        const token = await turnstile.getToken();
        if (token) body.turnstileToken = token;
      }
      let res: FeliGuestReply;
      try {
        res = await sendFeliGuest(body);
      } catch (err) {
        const verification = err instanceof ApiError && err.status === 403 && err.data.reason === "verification";
        if (!verification || !cfg?.turnstileSiteKey) throw err;
        const token = await turnstile.refresh();
        res = await sendFeliGuest(token ? { ...body, turnstileToken: token } : body);
      }
      verified.current = true;
      const next: FeliGuestTurn[] = [...turns, { role: "user", content: message }, { role: "assistant", content: String(res.reply ?? "") }];
      setTurns(next);
      saveFeliGuestChat(next);
      setPending(null);
      setSuggestions(Array.isArray(res.suggestions) ? res.suggestions : []);
      if (typeof res.remaining === "number" && typeof res.limit === "number") setUsage({ remaining: res.remaining, limit: res.limit });
    } catch (err) {
      const n = noticeFrom(err);
      setNotice(n);
      setSuggestions(null);
      if (n.reason === "invalid") {
        setPending(null);
        setInput(message);
      }
      if (n.reason === "daily_limit" && err instanceof ApiError) {
        const l = typeof err.data.limit === "number" ? err.data.limit : (limit ?? 0);
        setUsage({ remaining: typeof err.data.remaining === "number" ? err.data.remaining : 0, limit: l });
      }
    } finally {
      setBusy(false);
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const waitSecs = notice?.retryAt ? Math.max(0, Math.ceil((notice.retryAt - now) / 1000)) : 0;
  const canRetry = Boolean(pending) && !busy && notice && notice.reason !== "daily_limit" && notice.reason !== "invalid";
  const show = open && mounted;
  const linkButtons = (
    <div className="mt-3 flex flex-wrap gap-2">
      {signedIn ? (
        <ButtonLink to="/start" size="md" variant="primary">Go to dashboard</ButtonLink>
      ) : (
        <ButtonLink to="/register" size="md" variant="primary">Create a free account</ButtonLink>
      )}
      <ButtonLink to="/contact" size="md" variant="secondary">Contact us</ButtonLink>
    </div>
  );

  return (
    <>
      {/* Room at the end of the page so the bubble never covers the footer. */}
      <div aria-hidden="true" className="h-[calc(5.5rem+env(safe-area-inset-bottom))] bg-brand-navy md:h-24" />

      <button
        ref={bubbleRef}
        type="button"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        aria-label="Talk to FELI"
        onClick={() => (open ? closeChat() : openChat())}
        className={cn(
          "fg-bubble fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-[15] flex h-14 min-w-14 items-center justify-center gap-2 rounded-full bg-brand-navy text-ink-on-brand shadow-floating md:bottom-6 md:right-6",
          open ? "px-4 md:px-5" : "px-1 md:pl-1 md:pr-5"
        )}
      >
        {open ? <IconX className="size-6" aria-hidden="true" /> : <FeliAvatar size="lg" decorative />}
        <span className="hidden text-action md:inline">Talk to FELI</span>
      </button>

      {mounted && (
        <>
          <div aria-hidden="true" data-state={show ? "open" : "closed"} className="fg-backdrop fixed inset-0 z-40 bg-surface-overlay md:hidden" onClick={closeChat} data-testid="feli-backdrop" />
          <div
            id={PANEL_ID}
            role="dialog"
            aria-labelledby="fg-title"
            data-state={show ? "open" : "closed"}
            data-motion={motion}
            className={cn(
              "fg-panel fixed inset-x-0 bottom-0 z-40 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-2xl bg-surface-card font-sans text-ink-strong shadow-floating",
              "md:inset-x-auto md:bottom-24 md:right-6 md:max-h-[min(40rem,calc(100dvh-8rem))] md:w-[380px] md:rounded-2xl md:border md:border-line-subtle"
            )}
          >
            <header className="flex items-center gap-3 border-b border-line-subtle px-4 py-3">
              <FeliAvatar size="md" decorative />
              <div className="min-w-0 flex-1">
                <h2 id="fg-title" className="text-card-heading text-ink-strong">FELI</h2>
                <p className="text-body-sm text-ink-muted">Ask about BiManage</p>
              </div>
              <button ref={closeRef} type="button" aria-label="Close chat" onClick={closeChat} className="flex size-11 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-surface-pale hover:text-ink-strong">
                <IconX className="size-5" aria-hidden="true" />
              </button>
            </header>

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
              <div role="log" aria-live="polite" aria-label="Conversation with FELI" className="flex flex-col gap-3">
                <Message turn={{ role: "assistant", content: WELCOME }} />
                {turns.map((t, i) => (
                  <Message key={i} turn={t} />
                ))}
                {pending && <Message turn={{ role: "user", content: pending }} />}
                {busy && <Typing />}
              </div>

              {config.isLoading && (
                <p role="status" className="mt-3 text-body-sm text-ink-muted">Getting FELI ready…</p>
              )}

              {!busy && !blocked && !notice && chips.length > 0 && (
                <ul aria-label="Suggested questions" className="mt-4 flex flex-wrap gap-2">
                  {chips.map((s) => (
                    <li key={s} className="min-w-0 max-w-full">
                      <button type="button" onClick={() => void send(s)} className="min-h-11 max-w-full break-words rounded-full border border-line-default bg-surface-card px-4 py-2 text-left text-body-sm font-medium text-ink-brand hover:bg-surface-tonal">
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {unavailable && !notice && (
                <div role="status" className="mt-4 rounded-xl bg-surface-pale px-4 py-3 text-body-sm">
                  <p>FELI isn't available right now. You can still create a free account or contact us.</p>
                  {linkButtons}
                </div>
              )}

              {notice && (
                <div role="alert" className="mt-4 rounded-xl bg-surface-tint-warm px-4 py-3 text-body-sm text-ink-strong" data-reason={notice.reason}>
                  <p className="break-words">{notice.message}</p>
                  {canRetry && (
                    <Button size="md" variant="outlined" className="mt-3" disabled={waitSecs > 0} onClick={() => void send(pending!)}>
                      {waitSecs > 0 ? `Try again in ${waitSecs}s` : "Try again"}
                    </Button>
                  )}
                  {(notice.reason === "daily_limit" || notice.reason === "unavailable") && linkButtons}
                </div>
              )}
            </div>

            <div className="border-t border-line-subtle px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
              <form onSubmit={onSubmit} className="flex items-center gap-2" aria-label="Message FELI">
                <label htmlFor="fg-input" className="sr-only">Message FELI</label>
                <input
                  ref={inputRef}
                  id="fg-input"
                  type="text"
                  autoComplete="off"
                  enterKeyHint="send"
                  maxLength={FELI_GUEST_MAX}
                  placeholder={limited ? "No messages left today" : "Ask about BiManage"}
                  value={input}
                  disabled={limited || unavailable}
                  aria-describedby={input.length >= COUNTER_FROM ? "fg-counter" : undefined}
                  onChange={(e) => setInput(e.target.value.slice(0, FELI_GUEST_MAX))}
                  className="h-11 min-w-0 flex-1 rounded-md border border-line-default bg-surface-card px-3 text-input text-ink-strong outline-none placeholder:text-ink-muted focus:border-brand-navy focus:shadow-focus disabled:cursor-not-allowed disabled:bg-surface-pale"
                />
                {/* Honeypot: hidden from people and assistive tech. */}
                <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} className="absolute left-[-9999px] h-px w-px opacity-0" />
                <Button type="submit" size="md" disabled={blocked || busy || !input.trim()} icon={<IconSend className="size-4" aria-hidden="true" />}>
                  Send
                </Button>
              </form>
              <div className="mt-1.5 flex min-h-5 items-center justify-between gap-3 text-caption text-ink-muted">
                <span>{typeof remaining === "number" && typeof limit === "number" ? `${remaining} of ${limit} left today` : ""}</span>
                {input.length >= COUNTER_FROM && (
                  <span id="fg-counter" className={cn(input.length >= FELI_GUEST_MAX && "text-danger")}>
                    {input.length}/{FELI_GUEST_MAX}
                  </span>
                )}
              </div>
              <div ref={turnstile.containerRef} className="empty:hidden" data-testid="feli-turnstile" />
              <p className="mt-1 text-caption text-ink-muted">
                FELI can make mistakes; for account help, <Link to="/contact" className="font-medium text-ink-brand underline underline-offset-2">contact us</Link>.
              </p>
              {signedIn ? (
                <ButtonLink to="/start" size="md" variant="tonal" fullWidth className="mt-2">Go to dashboard</ButtonLink>
              ) : (
                <ButtonLink to="/register" size="md" variant="tonal" fullWidth className="mt-2">Create a free account</ButtonLink>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
