import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "./client";

// The one place that turns failures into words people see. Rules:
// - Never show status codes, stack traces, backend error codes, database or
//   framework text ("Cast to ObjectId", "E11000", "fixture", "jwt …").
// - Known backend messages map to clear text with what to do next.
// - A backend sentence that is already written for people may pass through.
// - Anything else becomes the caller's friendly fallback, and the UI offers
//   "Try again" / "Report a problem" (see components/feedback/ErrorNote).
// Technical details go to the browser console in development only.

export const GENERIC_ERROR = "Something went wrong on our side. Please try again.";
export const NETWORK_ERROR = "We can't reach BiManage. Check your connection and try again.";
export const TIMEOUT_ERROR = "BiManage is taking too long to respond. Please try again in a moment.";
export const SESSION_ERROR = "Your session has ended. Please sign in again.";
export const PERMISSION_ERROR = "You don't have permission to do this. Ask the business owner for access.";

/** Known backend messages → what we show. First match wins. */
const KNOWN: Array<[RegExp, string]> = [
  [/sku already exists|duplicate sku|E11000.*sku/i, "Another product already uses this SKU. Use a different one."],
  [/E11000.*email|email already (in use|exists|registered)/i, "An account with this email already exists. Sign in instead, or use another email."],
  [/E11000.*username|username already taken/i, "That username is taken. Try another."],
  [/E11000/i, "This already exists. Check for a duplicate and try again."],
  [/insufficient (stock|quantity)|not enough stock|below zero/i, "There isn't enough stock for this change."],
  [/invalid credentials|invalid email or password|incorrect password/i, "That email and password don't match. Check them and try again."],
  [/not verified|verify your email/i, "Please verify your email first. We can send you a new code."],
  [/(invalid|expired) (or expired )?(otp|code)|otp (is )?invalid/i, "That code isn't right or has expired. Check it, or send a new one."],
  [/(jwt|token) (expired|malformed|invalid)|not authori[sz]ed|no token/i, SESSION_ERROR],
  [/access denied|insufficient permissions|forbidden|owner only/i, PERMISSION_ERROR],
  [/upgrade|not (included|available) (in|on) your (current )?plan|feature (is )?locked/i, "This feature isn't included in your plan. See plans to unlock it."],
  [/out of (feli )?credits|credit limit|no credits/i, "You've used today's credits. They refresh tomorrow, or upgrade for more."],
  [/file too large|LIMIT_FILE_SIZE/i, "That file is too large. Choose a smaller one."],
  [/only (jpg|jpeg|png|webp)/i, "Use a JPG, PNG or WebP image."],
  [/couldn't send the email/i, "We couldn't send the email right now. Please try again in a few minutes."],
  [/not found/i, "We couldn't find that. It may have been deleted. Refresh and try again."],
];

/** Text that must never reach a person. */
const TECHNICAL = new RegExp(
  [
    "fixture", "stack", "undefined", "\\bnull\\b", "NaN", "TypeError", "ReferenceError", "SyntaxError", "Cast to", "ObjectId",
    "E11000", "mongo", "jwt", "ECONN", "ETIMEDOUT", "ENOTFOUND", "status code", "Request failed", "HTTP \\d{3}", "\\(\\d{3}\\)",
    "\\bat \\S+:\\d+", "/api/", "validation failed", "is not allowed", "must be (a|an|of type)\\b", "cannot read", "\\bjson\\b",
  ].join("|"),
  "i"
);
const HTTP_VERB = /\b(GET|POST|PUT|PATCH|DELETE) \//;
const looksFriendly = (m: string) =>
  m.length >= 8 && m.length <= 160 && /^[A-Z]/.test(m) && !TECHNICAL.test(m) && !HTTP_VERB.test(m) && !/[{}[\]<>`$]/.test(m);

const devLog = (err: unknown) => {
  if (import.meta.env.DEV && import.meta.env.MODE !== "test") console.error("[BiManage] request failed:", err);
};

export interface DescribedError {
  message: string;
  /** false = we don't know what went wrong: offer "Report a problem". */
  known: boolean;
  /** Worth retrying as-is (connection, timeout, server error). */
  retryable: boolean;
}

/** Message plus how to present it. `fallback` should say what failed and what to do. */
export function describeError(err: unknown, fallback = GENERIC_ERROR): DescribedError {
  devLog(err);
  const unknown = { message: fallback, known: false, retryable: true };
  if (!(err instanceof ApiError)) return unknown;
  if (err.kind === "network") return { message: NETWORK_ERROR, known: true, retryable: true };
  if (err.kind === "timeout") return { message: TIMEOUT_ERROR, known: true, retryable: true };
  if (err.status === 429) return { message: cooldownMessage(err), known: true, retryable: false };
  if (err.status === 401) return { message: SESSION_ERROR, known: true, retryable: false };
  const raw = (err.message || "").trim();
  for (const [re, text] of KNOWN) if (re.test(raw)) return { message: text, known: true, retryable: false };
  if (err.status === 403) return { message: PERMISSION_ERROR, known: true, retryable: false };
  if (err.status >= 500 && !(err.status === 503 && looksFriendly(raw))) return unknown;
  if (looksFriendly(raw)) return { message: raw, known: true, retryable: err.status >= 500 };
  return { ...unknown, retryable: err.status >= 500 };
}

/** A short, friendly message for any failure. `fallback` should say what failed and what to do. */
export function errorMessage(err: unknown, fallback = GENERIC_ERROR): string {
  return describeError(err, fallback).message;
}

/** Same rules for a plain backend sentence (e.g. a payment status message). */
export function friendlyText(message: string | null | undefined, fallback = GENERIC_ERROR): string {
  const m = (message ?? "").trim();
  for (const [re, text] of KNOWN) if (re.test(m)) return text;
  return looksFriendly(m) ? m : fallback;
}

/** "Try again in 9 minutes" from a 429 cooldown. */
export function cooldownMessage(err: ApiError): string {
  const s = err.retryAfterSeconds;
  if (!s) return "Too many attempts. Please wait a few minutes and try again.";
  const minutes = Math.ceil(s / 60);
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

// ── Validation errors next to the right field ────────────────────────────

const humanise = (field: string) => field.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_.]/g, " ").toLowerCase();
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const FIELD_TEXT: Array<[RegExp, (label: string) => string]> = [
  [/already (exists|in use|taken)/i, (l) => `This ${l} is already in use.`],
  [/valid email/i, () => "Enter a valid email address."],
  [/is not allowed to be empty|is required|required/i, (l) => `Enter ${l}.`],
  [/is not allowed/i, (l) => `${cap(l)} can't be set here.`],
  [/must be an integer/i, () => "Use a whole number."],
  [/must be (a )?(valid )?number/i, (l) => `Enter a number for ${l}.`],
  [/greater than or equal to 0|must be (a )?positive|cannot be negative/i, (l) => `${cap(l)} can't be negative.`],
  [/length must be at least/i, (l) => `${cap(l)} is too short.`],
  [/length must be less than or equal to/i, (l) => `${cap(l)} is too long.`],
];

/**
 * Backend validation errors (400/409/422 with `{ message, errors: [...] }` or
 * `{ field }`) for the given form fields, as friendly text keyed by field.
 */
export function fieldErrors<F extends string>(err: unknown, fields: readonly F[]): Partial<Record<F, string>> {
  if (!(err instanceof ApiError) || ![400, 409, 422].includes(err.status)) return {};
  const out: Partial<Record<F, string>> = {};
  const extra = Array.isArray(err.data.errors) ? err.data.errors : [];
  const list = [err.message, ...extra]
    .map((e) => (typeof e === "string" ? e : e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : ""))
    .filter(Boolean);
  const named = typeof err.data.field === "string" ? err.data.field : null;
  for (const field of fields) {
    const label = humanise(field);
    const starts = new RegExp(`^"?(${field}|${label})"?(\\s|$)`, "i");
    // Per-field errors ({ field, message }) win over guessing from the text.
    const tagged = extra.find((e): e is { field: string; message: string } => Boolean(e && typeof e === "object" && (e as { field?: unknown }).field === field && typeof (e as { message?: unknown }).message === "string"));
    const hit = tagged ? tagged.message : named === field ? err.message : list.find((m) => starts.test(m.trim()));
    if (!hit) continue;
    const known = KNOWN.find(([re]) => re.test(hit));
    const shaped = FIELD_TEXT.find(([re]) => re.test(hit));
    out[field] = known ? known[1] : shaped ? shaped[1](label) : looksFriendly(hit) ? hit : `Check ${label}.`;
  }
  return out;
}

/** Puts backend validation errors on the form fields. Returns true if any were placed. */
export function applyFieldErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>, fields: ReadonlyArray<Path<T>>): boolean {
  const found = fieldErrors(err, fields as readonly string[]) as Record<string, string>;
  const keys = Object.keys(found) as Array<Path<T>>;
  keys.forEach((k, i) => setError(k, { message: found[k] }, { shouldFocus: i === 0 }));
  return keys.length > 0;
}
