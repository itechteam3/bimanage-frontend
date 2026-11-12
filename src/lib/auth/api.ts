import { api } from "@/lib/api/client";
import { env } from "@/config/env";

// Typed calls for the backend's auth endpoints (docs/api-reference.md → Auth,
// Verification, Settings). Errors surface as ApiError with the backend message.

export interface User {
  _id: string;
  name: string;
  email: string;
  username?: string;
  phone?: string;
  avatar?: string | null;
  isVerified: boolean;
  userPath?: "startup" | "existing_business" | null;
  onboardingComplete?: boolean;
  createdAt?: string;
}

export type Role = "owner" | "admin" | "manager" | "staff";

export interface Workspace {
  role: Role;
  permissions: Record<string, boolean>;
  businessId: string;
  business?: { _id: string; name?: string; logo?: string | null; ownerEmail?: string };
}

export interface LoginResult {
  _id: string;
  name: string;
  email: string;
  token: string;
}

/** Backend says "OTP has expired…" only for genuinely expired codes;
 * "Invalid or expired OTP" means the code is wrong (or none was issued). */
export const isExpiredCodeError = (message: string) => /^otp has expired/i.test(message.trim());

export const authApi = {
  login: (email: string, password: string) =>
    api<LoginResult>("/auth/login", { method: "POST", body: { email, password }, auth: false, quiet401: true }),

  register: (input: { name: string; email: string; password: string }) =>
    api<{ message: string; email: string }>("/auth/register", { method: "POST", body: input, auth: false }),

  verifyEmail: (email: string, otp: string) =>
    api<LoginResult & { message: string }>("/verify/email", { method: "POST", body: { email, otp }, auth: false }),

  resendVerification: (email: string) =>
    api<{ message: string }>("/verify/resend", { method: "POST", body: { email }, auth: false }),

  forgotPassword: (email: string) =>
    api<{ message: string }>("/auth/forgot-password", { method: "POST", body: { email }, auth: false }),

  verifyResetCode: (email: string, otp: string) =>
    api<{ message: string; resetToken: string }>("/auth/verify-otp", { method: "POST", body: { email, otp }, auth: false }),

  /** Uses the 15-minute reset token from verifyResetCode, never the session token. */
  resetPassword: (resetToken: string, password: string) =>
    api<{ message: string }>("/auth/reset-password", { method: "POST", body: { password }, token: resetToken, quiet401: true }),

  me: (token?: string) => api<User>("/auth/me", token ? { token } : {}),

  workspace: (token?: string) => api<Workspace>("/settings/my-role", token ? { token } : {}),

  logout: () => api<{ message: string }>("/auth/logout", { method: "POST", quiet401: true }),

  acceptInvite: (token: string) =>
    api<{ message: string }>("/settings/team/accept-invite", { method: "POST", body: { token } }),

  /** Full-page navigation target for "Continue with Google". */
  googleUrl: () => `${env.apiBaseUrl}/auth/google`,
};
