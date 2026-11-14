import { api, ApiError, type RequestOptions } from "@/lib/api/client";
import { adminSession } from "./session";

/**
 * A call to the BiManage API as the signed-in admin. Never sends the business
 * session token. A 401 ends the admin session (the guard sends the admin to
 * /admin/login); other errors are thrown as ApiError for the page to show.
 */
export async function adminApi<T = unknown>(path: string, opts: Omit<RequestOptions, "token" | "auth" | "quiet401"> & { anonymous?: boolean } = {}): Promise<T> {
  const { anonymous, ...rest } = opts;
  const token = anonymous ? null : adminSession.get();
  try {
    return await api<T>(path, token ? { ...rest, token, quiet401: true } : { ...rest, auth: false, quiet401: true });
  } catch (err) {
    if (!anonymous && err instanceof ApiError && err.status === 401) adminSession.clear("ended");
    throw err;
  }
}

/** The message to show for a failed admin call. */
export function adminError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err instanceof ApiError) {
    if (err.kind === "network") return "We couldn't reach BiManage. Check your connection and try again.";
    if (err.kind === "timeout") return "BiManage took too long to answer. Please try again.";
    const m = typeof err.data.message === "string" ? err.data.message : "";
    return m || fallback;
  }
  return fallback;
}

export const fieldOf = (err: unknown): string | undefined => (err instanceof ApiError && typeof err.data.field === "string" ? err.data.field : undefined);
