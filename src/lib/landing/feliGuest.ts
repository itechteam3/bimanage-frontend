import { api } from "@/lib/api/client";

// "Talk to FELI" on the public site (backend: GET /public/feli/config,
// POST /public/feli). The server keeps no conversation: this tab keeps the
// last few turns (memory + sessionStorage) and sends them as history.
// PRIVACY: requests carry only the typed message, that history, the session
// id, the honeypot and a Turnstile token. Never a sign-in token or account data.

export interface FeliGuestConfig {
  enabled: boolean;
  limit: number;
  remaining: number;
  suggestions: string[];
  turnstileSiteKey: string | null;
  disclaimer?: string;
}

export interface FeliGuestTurn {
  role: "user" | "assistant";
  content: string;
}

export interface FeliGuestReply {
  reply: string;
  suggestions: string[];
  remaining: number;
  limit: number;
}

export interface FeliGuestBody {
  message: string;
  sessionId: string;
  history: FeliGuestTurn[];
  /** Honeypot: always empty for people. */
  website: string;
  turnstileToken?: string;
}

export type FeliGuestReason = "daily_limit" | "busy" | "rate" | "verification" | "unavailable";

export const FELI_GUEST_MAX = 500;
export const FELI_GUEST_HISTORY = 6;
const HISTORY_CONTENT_MAX = 1000;
/** How many messages the panel keeps on screen for this tab. */
const KEEP_ON_SCREEN = 20;

const SESSION_KEY = "bimanage.feliGuest.session";
const CHAT_KEY = "bimanage.feliGuest.chat";
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function store(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function randomId(length = 24) {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => ALPHABET[b & 63]).join("");
}

let memorySession: string | null = null;
let memoryChat: FeliGuestTurn[] = [];

/** A random url-safe id for this tab (sessionStorage; memory when that is blocked). */
export function feliGuestSessionId(): string {
  const s = store();
  try {
    const saved = s?.getItem(SESSION_KEY);
    if (saved && /^[A-Za-z0-9_-]{16,64}$/.test(saved)) return saved;
  } catch {
    /* blocked storage: memory below */
  }
  if (!memorySession) memorySession = randomId();
  try {
    s?.setItem(SESSION_KEY, memorySession);
  } catch {
    /* memory only */
  }
  return memorySession;
}

const isTurn = (t: unknown): t is FeliGuestTurn =>
  Boolean(t) && typeof t === "object" && ((t as FeliGuestTurn).role === "user" || (t as FeliGuestTurn).role === "assistant") && typeof (t as FeliGuestTurn).content === "string";

/** This tab's conversation (never kept beyond the tab). */
export function loadFeliGuestChat(): FeliGuestTurn[] {
  const s = store();
  if (!s) return memoryChat;
  try {
    const list = JSON.parse(s.getItem(CHAT_KEY) ?? "[]") as unknown;
    return Array.isArray(list) ? list.filter(isTurn).slice(-KEEP_ON_SCREEN) : [];
  } catch {
    return memoryChat;
  }
}

export function saveFeliGuestChat(turns: FeliGuestTurn[]) {
  memoryChat = turns.slice(-KEEP_ON_SCREEN);
  try {
    store()?.setItem(CHAT_KEY, JSON.stringify(memoryChat));
  } catch {
    /* memory only */
  }
}

/** The last turns, trimmed to what the server accepts. */
export const feliGuestHistory = (turns: FeliGuestTurn[]): FeliGuestTurn[] =>
  turns.slice(-FELI_GUEST_HISTORY).map((t) => ({ role: t.role, content: t.content.slice(0, HISTORY_CONTENT_MAX) }));

export const fetchFeliGuestConfig = (sessionId: string) =>
  api<FeliGuestConfig>("/public/feli/config", { auth: false, query: { sessionId } });

export const sendFeliGuest = (body: FeliGuestBody) =>
  api<FeliGuestReply>("/public/feli", { method: "POST", auth: false, body, timeoutMs: 60_000 });

// ── Cloudflare Turnstile (loaded only when the server sends a site key) ──

export interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string | undefined;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let turnstileLoading: Promise<TurnstileApi> | null = null;

export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!turnstileLoading) {
    turnstileLoading = new Promise<TurnstileApi>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = TURNSTILE_SRC;
      s.async = true;
      s.defer = true;
      s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile unavailable")));
      s.onerror = () => {
        turnstileLoading = null;
        s.remove();
        reject(new Error("Turnstile unavailable"));
      };
      document.head.appendChild(s);
    });
  }
  return turnstileLoading;
}
