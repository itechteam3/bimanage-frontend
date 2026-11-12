import { env } from "@/config/env";
import { tokenStore } from "@/lib/auth/tokenStore";
import { apiEvents } from "./events";
import { serverStatus } from "./serverStatus";

/** Error shape for every failed API call. `data` is the backend's JSON body. */
export class ApiError extends Error {
  readonly status: number;
  readonly data: Record<string, unknown>;
  /** network = no response; timeout = gave up waiting. */
  readonly kind: "http" | "network" | "timeout";

  constructor(message: string, status: number, data: Record<string, unknown> = {}, kind: ApiError["kind"] = "http") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.kind = kind;
  }

  /** Seconds to wait, from Retry-After / retryAfterSeconds (429 cooldowns). */
  get retryAfterSeconds(): number | undefined {
    const v = this.data.retryAfterSeconds;
    return typeof v === "number" ? v : undefined;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Send the session token (default true). */
  auth?: boolean;
  /** Override the bearer token (e.g. the 15-minute password-reset token). */
  token?: string;
  /** For endpoints that return a file (invoice PDF, CSV exports). */
  responseType?: "json" | "blob";
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Don't raise the global session-expired event on 401 (login, verify). */
  quiet401?: boolean;
  headers?: Record<string, string>;
}

const DEFAULT_TIMEOUT_MS = 30_000;
/** Cold starts on Render's free plan take up to ~60 s. */
const COLD_START_TIMEOUT_MS = 75_000;
/** After this long without an answer, tell the user the server is waking. */
const WAKING_AFTER_MS = 5_000;
/** Backoff for idempotent requests only (GET/HEAD). */
export const RETRY_DELAYS_MS = [2_000, 5_000, 10_000];
const RETRYABLE_STATUS = new Set([502, 503, 504]);

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

const buildUrl = (path: string, query?: RequestOptions["query"]) => {
  const url = new URL(path.startsWith("http") ? path : `${env.apiBaseUrl}${path.startsWith("/") ? "" : "/"}${path}`);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  return url.toString();
};

async function readBody(res: Response, responseType: RequestOptions["responseType"]) {
  if (responseType === "blob" && res.ok) return res.blob();
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    try {
      return await res.json();
    } catch {
      return {};
    }
  }
  const text = await res.text();
  return text ? { message: text } : {};
}

// Turn the backend's 403/401 conventions into app-wide events.
function signal(status: number, data: Record<string, unknown>, sentToken: boolean, quiet401: boolean) {
  const message = typeof data.message === "string" ? data.message : "";
  if (status === 401 && sentToken && !quiet401) {
    tokenStore.clear();
    apiEvents.emit("session-expired", { message: message || "Your session has expired. Please sign in again." });
  }
  if (status === 403 && data.suspended) {
    tokenStore.clear();
    apiEvents.emit("suspended", { message });
  }
  if (status === 403 && data.limitReached) {
    apiEvents.emit("upgrade-required", {
      kind: "feli-limit",
      dailyLimit: typeof data.dailyLimit === "number" ? data.dailyLimit : undefined,
      message,
    });
  } else if (status === 403 && data.upgrade) {
    if ("creditsNeeded" in data || "creditsRemaining" in data) {
      apiEvents.emit("upgrade-required", {
        kind: "credits",
        creditsRemaining: data.creditsRemaining as number | undefined,
        creditsNeeded: data.creditsNeeded as number | undefined,
        resetsAt: data.resetsAt as string | undefined,
        message,
      });
    } else {
      apiEvents.emit("upgrade-required", {
        kind: "plan",
        feature: data.feature as string | undefined,
        currentPlan: data.currentPlan as string | undefined,
        message,
      });
    }
  }
}

/** One HTTP attempt, with timeout and the waking-server signal. */
async function attempt<T>(url: string, init: RequestInit, opts: RequestOptions, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener("abort", onAbort);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const wakingTimer = setTimeout(() => {
    if (serverStatus.get() !== "up") serverStatus.set("waking");
  }, WAKING_AFTER_MS);

  try {
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: controller.signal });
    } catch (err) {
      if (opts.signal?.aborted) throw err;
      if (timedOut) throw new ApiError("The server is taking too long to respond.", 0, {}, "timeout");
      throw new ApiError("Can't reach the server. Check your connection.", 0, {}, "network");
    }
    serverStatus.set("up");
    const data = (await readBody(res, opts.responseType)) as T & Record<string, unknown>;
    if (!res.ok) {
      const body = (data ?? {}) as Record<string, unknown>;
      const retryAfter = res.headers.get("retry-after");
      if (retryAfter && body.retryAfterSeconds === undefined && /^\d+$/.test(retryAfter)) {
        body.retryAfterSeconds = Number(retryAfter);
      }
      const sentToken = Boolean((init.headers as Record<string, string>)?.Authorization);
      signal(res.status, body, sentToken, Boolean(opts.quiet401));
      throw new ApiError(
        typeof body.message === "string" && body.message ? body.message : `Request failed (${res.status})`,
        res.status,
        body
      );
    }
    return data as T;
  } finally {
    clearTimeout(timer);
    clearTimeout(wakingTimer);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * Call the BiManage API. GET/HEAD are retried with backoff on network
 * errors, timeouts and 502/503/504 (cold starts); writes are never retried,
 * so an order or payment can't be submitted twice.
 */
export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const isFormData = typeof FormData !== "undefined" && opts.body instanceof FormData;
  const headers: Record<string, string> = { Accept: "application/json", ...opts.headers };
  if (opts.body !== undefined && !isFormData) headers["Content-Type"] = "application/json";
  const token = opts.token ?? (opts.auth === false ? null : tokenStore.get());
  if (token) headers.Authorization = `Bearer ${token}`;

  const init: RequestInit = {
    method,
    headers,
    body: opts.body === undefined ? undefined : isFormData ? (opts.body as FormData) : JSON.stringify(opts.body),
  };
  const url = buildUrl(path, opts.query);
  const idempotent = method === "GET";
  const timeoutMs = opts.timeoutMs ?? (serverStatus.get() === "up" ? DEFAULT_TIMEOUT_MS : COLD_START_TIMEOUT_MS);

  for (let i = 0; ; i++) {
    try {
      return await attempt<T>(url, init, opts, timeoutMs);
    } catch (err) {
      const retryable =
        err instanceof ApiError && (err.kind !== "http" || RETRYABLE_STATUS.has(err.status));
      if (!idempotent || !retryable || i >= RETRY_DELAYS_MS.length) {
        if (err instanceof ApiError && err.kind !== "http") serverStatus.set("unreachable");
        throw err;
      }
      serverStatus.set("waking");
      await sleep(RETRY_DELAYS_MS[i]!, opts.signal);
    }
  }
}

/**
 * Download a file (CSV/PDF) with the session token. Returns the blob plus the
 * server's filename and record count when provided (exposed via CORS).
 */
export async function apiDownload(path: string, opts: Pick<RequestOptions, "query" | "signal"> = {}) {
  const token = tokenStore.get();
  const res = await fetch(buildUrl(path, opts.query), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: opts.signal,
  }).catch(() => {
    throw new ApiError("Can't reach the server. Check your connection.", 0, {}, "network");
  });
  if (!res.ok) {
    const body = (await readBody(res, "json")) as Record<string, unknown>;
    signal(res.status, body, Boolean(token), false);
    throw new ApiError(typeof body.message === "string" ? body.message : `Download failed (${res.status})`, res.status, body);
  }
  const disposition = res.headers.get("content-disposition") ?? "";
  const filename = /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? "download";
  const countHeader = res.headers.get("x-record-count");
  return { blob: await res.blob(), filename, count: countHeader ? Number(countHeader) : undefined };
}

/** Save a blob as a file in the browser. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Ping the server root on app start so a sleeping Render instance starts waking immediately. */
export async function wakeServer(signal?: AbortSignal): Promise<boolean> {
  try {
    await api(`${env.serverUrl}/`, { auth: false, timeoutMs: COLD_START_TIMEOUT_MS, signal });
    return true;
  } catch {
    return false;
  }
}
