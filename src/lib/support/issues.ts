import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { APP_VERSION } from "@/lib/version";
import { supportKeys } from "./api";

// "Report an issue" (POST /api/support/issues). The report becomes a support
// ticket (category technical_issue) with the details below attached. We send
// only what's listed here: never tokens, passwords or anything from storage.
// The account and business come from the signed-in session on the server.

export interface IssueContext {
  path?: string;
  screen?: string;
  appVersion?: string;
  userAgent?: string;
  viewport?: string;
  timezone?: string;
  occurredAt?: string;
}

export interface IssueReport {
  whatHappened: string;
  expected?: string;
  file?: File | null;
  context: IssueContext;
}

export interface IssueReportResult {
  ticket: { _id: string; ticketNumber: string; subject: string; status: string };
  message: string;
}

export const WHAT_MIN = 10;
export const WHAT_MAX = 2000;
export const EXPECTED_MAX = 1000;
export const ISSUE_FILE_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
export const ISSUE_FILE_MAX = 5 * 1024 * 1024;

/** A plain reason the file can't be sent, or null. */
export function issueFileProblem(file: File): string | null {
  if (!ISSUE_FILE_TYPES.includes(file.type)) return `${file.name} isn't a PNG, JPG or WebP image or a PDF.`;
  if (file.size > ISSUE_FILE_MAX) return `${file.name} is larger than 5 MB. Choose a smaller file.`;
  if (file.size === 0) return `${file.name} is empty.`;
  return null;
}

// Query keys we never send, even inside the page address.
const SECRET_PARAM = /token|password|secret|code|key|sig|session|auth|otp|state/i;

/** The in-app path with secret-looking query parameters removed. */
export function safePath(pathname: string, search = ""): string {
  const params = new URLSearchParams(search);
  for (const k of [...params.keys()]) if (SECRET_PARAM.test(k)) params.delete(k);
  const qs = params.toString();
  return `${pathname}${qs ? `?${qs}` : ""}`.slice(0, 300);
}

const clip = (s: string | undefined, n: number) => (s ? s.slice(0, n) : undefined);

/** Collected when the report is sent (so the time is the moment of sending). */
export function collectContext({ pathname, search, screen }: { pathname: string; search?: string; screen?: string }): IssueContext {
  let timezone: string | undefined;
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    timezone = undefined;
  }
  const w = typeof window !== "undefined" ? window : undefined;
  return {
    path: safePath(pathname, search),
    screen: clip(screen || (typeof document !== "undefined" ? document.title : undefined), 120),
    appVersion: clip(APP_VERSION, 40),
    userAgent: clip(typeof navigator !== "undefined" ? navigator.userAgent : undefined, 400),
    viewport: w ? `${Math.round(w.innerWidth)}x${Math.round(w.innerHeight)}` : undefined,
    timezone,
    occurredAt: new Date().toISOString(),
  };
}

/** Readable rows for "Technical details" (user ticket view and admin). */
export function issueContextRows(c?: IssueContext | null): Array<[string, string]> {
  if (!c) return [];
  const when = c.occurredAt ? new Date(c.occurredAt) : null;
  const rows: Array<[string, string | undefined]> = [
    ["Screen", c.screen],
    ["Page", c.path],
    ["App version", c.appVersion],
    ["Browser and device", c.userAgent],
    ["Screen size", c.viewport ? c.viewport.replace("x", " × ") : undefined],
    ["Time zone", c.timezone],
    ["Reported at", when && !Number.isNaN(when.getTime()) ? when.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : undefined],
  ];
  return rows.filter((r): r is [string, string] => Boolean(r[1]));
}

export function useReportIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ whatHappened, expected, file, context }: IssueReport) => {
      const form = new FormData();
      form.append("whatHappened", whatHappened.trim());
      if (expected?.trim()) form.append("expected", expected.trim());
      form.append("context", JSON.stringify(context));
      if (file) form.append("attachment", file, file.name);
      return api<IssueReportResult>("/support/issues", { method: "POST", body: form });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: supportKeys.tickets }),
  });
}

// ── Minimised (remembered per user on this device) ─────────────────────────

const storageKey = (userId?: string | null) => `bm.reportIssue.minimised.${userId || "anon"}`;

export function readMinimised(userId?: string | null): boolean {
  try {
    return window.localStorage.getItem(storageKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function writeMinimised(userId: string | null | undefined, minimised: boolean) {
  try {
    if (minimised) window.localStorage.setItem(storageKey(userId), "1");
    else window.localStorage.removeItem(storageKey(userId));
  } catch {
    // Storage blocked (private mode): the choice lasts until reload.
  }
}
