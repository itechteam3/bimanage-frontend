import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api/client";

// FELI, the BiManage assistant (Figma 11.01–11.05). FELI only proposes
// actions: the person reviews (and may edit) them and approves. Freemium gets
// 20 messages a day per business (reset at midnight, Lagos time); paid plans
// are unlimited. Every query key starts with "feli".

export type FeliTier = "freemium" | "starter" | "standard" | "premium";
export type FeliAction = "open_support_ticket" | "create_task" | "create_invoice" | "send_invoice" | "update_order_status";

export interface FeliUsage {
  unlimited: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  resetsAt: string | null;
}

export interface FeliProposal {
  id: string;
  action: FeliAction | string;
  label: string;
  module: string;
  params: Record<string, unknown>;
  /** Required fields FELI couldn't fill; the person supplies them. */
  missing: string[];
  requiredPlan: string | null;
  proposedAt?: string;
}

export type FeliRestriction =
  | { code: "UPGRADE_REQUIRED"; action: string; label: string; currentPlan?: string; requiredPlan: string; requiredPlanName?: string; alternative?: { label: string; link: string } | null; message?: string }
  | { code: "PERMISSION_DENIED"; action: string; label: string; permission?: string | null; message?: string }
  | { code: "NOT_OFFERED"; action: string; label: string; requiredPlan?: string; alternative?: { label: string; link: string } | null; message?: string };

export interface FeliHandoff {
  suggested: boolean;
  reason?: string;
}

/** A message in the conversation. restriction/handoff exist only for replies made in this visit. */
export interface FeliMessage {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  restriction?: FeliRestriction | null;
  handoff?: FeliHandoff | null;
}

export interface FeliHistory {
  messages: FeliMessage[];
  /** Suggestions waiting for review (FELI can propose several in one reply). */
  proposals?: FeliProposal[];
  /** First of proposals (older servers send only this). */
  proposal: FeliProposal | null;
  usage: FeliUsage;
}

export interface FeliAccess {
  usage: FeliUsage;
  actions: string[];
  tier: FeliTier;
}

export interface FeliReply {
  reply: string;
  proposals?: FeliProposal[];
  proposal: FeliProposal | null;
  restriction: FeliRestriction | null;
  handoff: FeliHandoff | null;
  usage: FeliUsage;
  /** FELI was too busy to answer even after waiting; the message didn't count. */
  busy?: boolean;
}

export interface FeliResult {
  kind: string;
  id: string;
  label: string;
  link: string;
}

// ── Labels ───────────────────────────────────────────────────────────────

export const FELI_DAILY_MESSAGES = 20;

export const ACTION_INFO: Record<FeliAction, { label: string; plan: string }> = {
  open_support_ticket: { label: "Open a support ticket", plan: "Standard" },
  create_task: { label: "Create a project task", plan: "Standard" },
  create_invoice: { label: "Draft an invoice", plan: "Premium" },
  send_invoice: { label: "Send an invoice", plan: "Premium" },
  update_order_status: { label: "Update an order", plan: "Premium" },
};
export const actionLabel = (a: string) => ACTION_INFO[a as FeliAction]?.label ?? a.replace(/_/g, " ");

export const tierName = (t?: string | null) => (t === "premium" ? "Premium" : t === "standard" ? "Standard" : t === "starter" ? "Starter" : "Freemium");

/** "Fri 14 Nov, 00:00" in Lagos time. */
export const lagosTime = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
};

/** The suggestions waiting for review (new list, or the older single one). */
export const proposalsOf = (h?: Pick<FeliHistory, "proposals" | "proposal"> | null): FeliProposal[] => (h?.proposals?.length ? h.proposals : h?.proposal ? [h.proposal] : []);

export const isLimited = (u?: FeliUsage | null) => Boolean(u && !u.unlimited && u.remaining !== null && u.remaining <= 0);

/** The FELI_LIMIT answer to a chat message (403). */
export const isLimitError = (err: unknown): err is ApiError => err instanceof ApiError && err.status === 403 && err.data.code === "FELI_LIMIT";

const RESTRICTION_CODES = ["UPGRADE_REQUIRED", "PERMISSION_DENIED", "NOT_OFFERED"];
/** A 403 from approving that explains why the action can't run (11.04). */
export const restrictionOf = (err: unknown): FeliRestriction | null =>
  err instanceof ApiError && err.status === 403 && RESTRICTION_CODES.includes(String(err.data.code)) ? (err.data as unknown as FeliRestriction) : null;

// ── Queries ──────────────────────────────────────────────────────────────

export const feliKeys = {
  all: ["feli"] as const,
  history: ["feli", "history"] as const,
  access: ["feli", "usage"] as const,
  suggestions: ["feli", "suggestions"] as const,
};

export const useFeliHistory = () => useQuery({ queryKey: feliKeys.history, queryFn: () => api<FeliHistory>("/feli/history") });
export const useFeliAccess = () => useQuery({ queryKey: feliKeys.access, queryFn: () => api<FeliAccess>("/feli/usage") });
export const useFeliSuggestions = () => useQuery({ queryKey: feliKeys.suggestions, queryFn: () => api<{ suggestions: string[] }>("/feli/suggestions"), staleTime: 10 * 60_000 });

// ── Mutations ────────────────────────────────────────────────────────────

/** Keep today's usage the same everywhere (history and the access panel). */
function useSetUsage() {
  const qc = useQueryClient();
  return (usage: FeliUsage | undefined) => {
    if (!usage) return;
    qc.setQueryData<FeliHistory>(feliKeys.history, (h) => (h ? { ...h, usage } : h));
    qc.setQueryData<FeliAccess>(feliKeys.access, (a) => (a ? { ...a, usage } : a));
  };
}

export const FELI_CHAT_TIMEOUT_MS = 60_000;

export function useFeliChat() {
  const qc = useQueryClient();
  const setUsage = useSetUsage();
  return useMutation({
    // FELI may queue for room in Groq's shared per-minute budget, or wait and
    // retry once after a busy answer, so the reply can take up to ~50 seconds.
    // "FELI is thinking…" stays up meanwhile.
    mutationFn: (message: string) => api<FeliReply>("/feli/chat", { method: "POST", body: { message }, timeoutMs: FELI_CHAT_TIMEOUT_MS }),
    onSuccess: (res, message) => {
      const now = new Date().toISOString();
      qc.setQueryData<FeliHistory>(feliKeys.history, (h) => ({
        messages: [...(h?.messages ?? []), { role: "user", content: message, createdAt: now }, { role: "assistant", content: res.reply, createdAt: now, restriction: res.restriction, handoff: res.handoff }],
        // A new reply replaces any earlier suggestions (the server keeps only the latest reply's).
        proposals: proposalsOf(res),
        proposal: proposalsOf(res)[0] ?? null,
        usage: res.usage ?? h?.usage ?? { unlimited: false, limit: FELI_DAILY_MESSAGES, used: 0, remaining: FELI_DAILY_MESSAGES, resetsAt: null },
      }));
      setUsage(res.usage);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setUsage(err.data.usage as FeliUsage | undefined);
        // A failed answer still stores the question on the server.
        if (err.status >= 500 || err.status === 429) void qc.invalidateQueries({ queryKey: feliKeys.history });
      }
    },
  });
}

export function useConfirmFeliAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { proposalId: string; params: Record<string, unknown> }) => api<{ result: FeliResult }>("/feli/actions/confirm", { method: "POST", body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: feliKeys.history });
      void qc.invalidateQueries({ queryKey: ["projects"] });
      void qc.invalidateQueries({ queryKey: ["support"] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) void qc.invalidateQueries({ queryKey: feliKeys.history });
    },
  });
}

export function useCancelFeliAction() {
  const qc = useQueryClient();
  return useMutation({
    // One suggestion (by id), or all of them.
    mutationFn: (id?: string) => api<{ cancelled: boolean }>(`/feli/actions/pending${id ? `?id=${encodeURIComponent(id)}` : ""}`, { method: "DELETE" }),
    onSuccess: (_res, id) =>
      qc.setQueryData<FeliHistory>(feliKeys.history, (h) => {
        if (!h) return h;
        const left = id ? proposalsOf(h).filter((p) => p.id !== id) : [];
        return { ...h, proposals: left, proposal: left[0] ?? null };
      }),
  });
}

export function useClearFeliHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ message: string }>("/feli/history", { method: "DELETE" }),
    onSuccess: () => qc.setQueryData<FeliHistory>(feliKeys.history, (h) => (h ? { ...h, messages: [], proposals: [], proposal: null } : h)),
  });
}

export function useEscalateFeli() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) => api<{ ticketId: string; ticketNumber: string }>("/feli/escalate", { method: "POST", body: reason ? { reason } : {} }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["support"] }),
  });
}
