import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { StatusTone } from "@/components/ui";

// Help & support (Figma 12.05–12.17): tickets, BiTechTeam service requests
// and the public help centre (FAQs). Every query key starts with "support".

export interface Attachment {
  url: string;
  name: string;
  type: string;
  size: number;
}

export type TicketCategory = "billing" | "wallet" | "orders" | "store" | "inventory" | "bisupplynet" | "account" | "technical" | "other";
export type TicketPriority = "low" | "medium" | "high";
export type TicketStatus = "open" | "in_progress" | "awaiting_reply" | "resolved" | "closed";
export type TicketFilter = "active" | "resolved" | "closed";

export interface TicketSummary {
  _id: string;
  ticketNumber: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  relatedReference?: string | null;
  replyCount?: number;
  lastReplyAt?: string | null;
  lastReplyBy?: "user" | "admin" | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketReply {
  _id: string;
  by: "user" | "admin";
  message: string;
  attachments?: Attachment[];
  createdAt: string;
}

export interface Ticket extends TicketSummary {
  message: string;
  contactEmail?: string | null;
  attachments?: Attachment[];
  replies?: TicketReply[];
  resolvedAt?: string | null;
  closedAt?: string | null;
}

export interface NewTicket {
  subject: string;
  message: string;
  category: TicketCategory;
  priority: TicketPriority;
  relatedReference?: string;
  contactEmail?: string;
  attachments?: Attachment[];
}

export type ServiceType = "custom_website" | "branding" | "social_media_management" | "other";
export type PreferredStart = "asap" | "within_30_days" | "within_90_days" | "flexible";
export type ServiceRequestStatus = "pending" | "reviewed" | "in_progress" | "completed" | "rejected";

export interface ServiceRequest {
  _id: string;
  requestNumber: string;
  projectTitle: string;
  serviceType: ServiceType;
  preferredStart: PreferredStart;
  businessName?: string | null;
  contactEmail: string;
  contactPhone?: string | null;
  description: string;
  brandMaterials?: string | null;
  referenceFiles?: Attachment[];
  budget?: string | null;
  timeline?: string | null;
  status: ServiceRequestStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface NewServiceRequest {
  projectTitle: string;
  serviceType: ServiceType;
  preferredStart: PreferredStart;
  businessName?: string;
  contactEmail: string;
  contactPhone?: string;
  description: string;
  brandMaterials?: string;
  referenceFiles?: Attachment[];
  budget?: string;
  timeline?: string;
}

export interface Faq {
  _id: string;
  question: string;
  answer: string;
  category: string;
  readMinutes?: number;
  helpfulCount?: number;
  updatedAt?: string;
}

// ── Labels ───────────────────────────────────────────────────────────────

export const TICKET_CATEGORIES: Array<[TicketCategory, string]> = [
  ["billing", "Subscription & billing"],
  ["wallet", "Wallet and payouts"],
  ["orders", "Orders"],
  ["store", "Online store"],
  ["inventory", "Inventory"],
  ["bisupplynet", "BiSupplyNet & escrow"],
  ["account", "Account"],
  ["technical", "Technical problem"],
  ["other", "Other"],
];
export const PRIORITIES: Array<[TicketPriority, string]> = [
  ["low", "Low"],
  ["medium", "Normal"],
  ["high", "High"],
];
export const TICKET_STATUS: Record<TicketStatus, { label: string; tone: StatusTone }> = {
  open: { label: "Awaiting support", tone: "neutral" },
  in_progress: { label: "In progress", tone: "neutral" },
  awaiting_reply: { label: "Waiting for your reply", tone: "warning" },
  resolved: { label: "Resolved", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
};
export const SERVICE_TYPES: Array<[ServiceType, string]> = [
  ["custom_website", "Custom website development"],
  ["branding", "Branding"],
  ["social_media_management", "Social media management"],
  ["other", "Other"],
];
export const PREFERRED_STARTS: Array<[PreferredStart, string]> = [
  ["asap", "As soon as possible"],
  ["within_30_days", "Within 30 days"],
  ["within_90_days", "Within 90 days"],
  ["flexible", "Flexible"],
];
export const REQUEST_STATUS: Record<ServiceRequestStatus, { label: string; tone: StatusTone }> = {
  pending: { label: "Received", tone: "neutral" },
  reviewed: { label: "Reviewed", tone: "neutral" },
  in_progress: { label: "In progress", tone: "neutral" },
  completed: { label: "Completed", tone: "success" },
  rejected: { label: "Not taken on", tone: "danger" },
};

const lookup = <K extends string>(list: Array<[K, string]>, key: string | null | undefined) =>
  list.find(([k]) => k === key)?.[1] ?? (key ? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ") : "");
export const categoryLabel = (c?: string | null) => lookup(TICKET_CATEGORIES, c);
export const priorityLabel = (p?: string | null) => lookup(PRIORITIES, p);
export const serviceLabel = (s?: string | null) => lookup(SERVICE_TYPES, s);
export const startLabel = (s?: string | null) => lookup(PREFERRED_STARTS, s);
export const ticketStatus = (s: string) => TICKET_STATUS[s as TicketStatus] ?? { label: s, tone: "neutral" as StatusTone };
export const requestStatus = (s: string) => REQUEST_STATUS[s as ServiceRequestStatus] ?? { label: s, tone: "neutral" as StatusTone };

// ── Attachments (POST /upload/attachment, multipart "file") ──────────────

export const ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const ATTACHMENT_MAX_FILES = 5;

export const uploadAttachment = (file: File) => {
  const form = new FormData();
  form.append("file", file, file.name);
  return api<Attachment>("/upload/attachment", { method: "POST", body: form });
};

// ── Queries ──────────────────────────────────────────────────────────────

export const supportKeys = {
  all: ["support"] as const,
  tickets: ["support", "tickets"] as const,
  ticketList: (status: string, page: number, limit: number) => ["support", "tickets", "list", status, page, limit] as const,
  ticket: (id: string) => ["support", "tickets", "detail", id] as const,
  requests: ["support", "service-requests"] as const,
  requestList: (page: number, limit: number) => ["support", "service-requests", "list", page, limit] as const,
  request: (id: string) => ["support", "service-requests", "detail", id] as const,
  faqs: ["support", "faqs"] as const,
  faqList: (q: string, category: string) => ["support", "faqs", "list", q, category] as const,
  faq: (id: string) => ["support", "faqs", "detail", id] as const,
};

export const useTickets = ({ status, page = 1, limit = 10 }: { status?: TicketFilter | ""; page?: number; limit?: number } = {}) =>
  useQuery({
    queryKey: supportKeys.ticketList(status ?? "", page, limit),
    queryFn: () => api<{ tickets: TicketSummary[]; total: number; page: number; totalPages: number }>("/support/tickets", { query: { status: status || undefined, page, limit } }),
    placeholderData: keepPreviousData,
  });
export const useTicket = (id: string) => useQuery({ queryKey: supportKeys.ticket(id), queryFn: () => api<Ticket>(`/support/tickets/${encodeURIComponent(id)}`), enabled: Boolean(id) });

export const useServiceRequests = ({ page = 1, limit = 10 }: { page?: number; limit?: number } = {}) =>
  useQuery({
    queryKey: supportKeys.requestList(page, limit),
    queryFn: () => api<{ requests: ServiceRequest[]; total: number; page: number; totalPages: number }>("/support/service-requests", { query: { page, limit } }),
    placeholderData: keepPreviousData,
  });
export const useServiceRequest = (id: string) =>
  useQuery({ queryKey: supportKeys.request(id), queryFn: () => api<ServiceRequest>(`/support/service-requests/${encodeURIComponent(id)}`), enabled: Boolean(id) });

/** Public: works signed out. */
export const useFaqs = (q: string, category: string) =>
  useQuery({
    queryKey: supportKeys.faqList(q, category),
    queryFn: () => api<Faq[]>("/support/faqs", { query: { q: q || undefined, category: category || undefined }, auth: false }),
    placeholderData: keepPreviousData,
  });
export const useFaq = (id: string) => useQuery({ queryKey: supportKeys.faq(id), queryFn: () => api<Faq>(`/support/faqs/${encodeURIComponent(id)}`, { auth: false }), enabled: Boolean(id) });

// ── Mutations ────────────────────────────────────────────────────────────

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NewTicket) => api<{ message: string; ticket: Ticket }>("/support/tickets", { method: "POST", body }),
    onSuccess: (res) => {
      qc.setQueryData(supportKeys.ticket(res.ticket._id), res.ticket);
      void qc.invalidateQueries({ queryKey: supportKeys.tickets });
    },
  });
}

export function useReplyTicket(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { message: string; attachments?: Attachment[] }) => api<Ticket>(`/support/tickets/${encodeURIComponent(id)}/reply`, { method: "POST", body }),
    onSuccess: (t) => {
      if (t && typeof t === "object" && "_id" in t) qc.setQueryData(supportKeys.ticket(id), t);
      void qc.invalidateQueries({ queryKey: supportKeys.tickets });
    },
  });
}

export function useCloseTicket(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<Ticket | { message: string }>(`/support/tickets/${encodeURIComponent(id)}/close`, { method: "POST" }),
    onSuccess: (t) => {
      if (t && typeof t === "object" && "_id" in t) qc.setQueryData(supportKeys.ticket(id), t);
      void qc.invalidateQueries({ queryKey: supportKeys.tickets });
    },
  });
}

export function useCreateServiceRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NewServiceRequest) => api<{ message: string; request: ServiceRequest }>("/support/service-requests", { method: "POST", body }),
    onSuccess: (res) => {
      qc.setQueryData(supportKeys.request(res.request._id), res.request);
      void qc.invalidateQueries({ queryKey: supportKeys.requests });
    },
  });
}

export function useVoteFaq(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (helpful: boolean) => api<{ message?: string; helpfulCount?: number; alreadyVoted?: boolean }>(`/support/faqs/${encodeURIComponent(id)}/helpful`, { method: "POST", body: { helpful } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: supportKeys.faq(id) }),
  });
}
