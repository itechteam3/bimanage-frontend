import { ApiError } from "./client";

/** A short, human message for any failed call. Backend messages are used as-is. */
export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err instanceof ApiError) {
    if (err.kind === "network") return "Can't reach BiManage. Check your connection and try again.";
    if (err.kind === "timeout") return "The server is taking too long. Please try again in a moment.";
    // 503 carries a deliberate, human message (e.g. "couldn't send the email").
    if (err.status >= 500 && !(err.status === 503 && err.message)) return fallback;
    return err.message || fallback;
  }
  return fallback;
}

/** "Try again in 9 minutes" from a 429 cooldown. */
export function cooldownMessage(err: ApiError): string {
  const s = err.retryAfterSeconds;
  if (!s) return err.message || "Too many attempts. Please wait a few minutes and try again.";
  const minutes = Math.ceil(s / 60);
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
