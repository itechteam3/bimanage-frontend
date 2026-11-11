// Plan gating, config-driven. Mirrors the backend's src/config/features.js
// (the server is the source of truth and enforces it; this only decides
// what the UI shows). Change a flag here when BiTechTeam settles a plan
// question — no component code changes needed.
//
// OPEN QUESTION (BiTechTeam): the Product Blueprint gives BiSupplyNet to
// every plan; the detailed explanation and the backend give it to Premium
// only. Until decided, follow the backend.

export type PlanId = "freemium" | "standard" | "premium";

export type Feature =
  | "dashboard"
  | "store"
  | "settings"
  | "inventory"
  | "orders"
  | "analytics"
  | "tasks"
  | "projects"
  | "invoices"
  | "messages"
  | "bisupplynet"
  | "notifications"
  | "profile"
  | "businessProfile"
  | "upload"
  | "socialMedia"
  | "automation";

/** `true` = full access, `"view_only"` = can look, can't change, `false` = locked. */
export type Access = boolean | "view_only";

export const PLAN_FEATURES: Record<PlanId, Partial<Record<Feature, Access>>> = {
  freemium: {
    dashboard: true,
    store: "view_only",
    settings: true,
    notifications: true,
    profile: true,
    businessProfile: true,
  },
  standard: {
    dashboard: true,
    store: true,
    settings: true,
    inventory: true,
    orders: true,
    analytics: true,
    tasks: true,
    projects: true,
    invoices: true,
    messages: true,
    bisupplynet: false, // ← open question, see above
    notifications: true,
    profile: true,
    businessProfile: true,
    upload: true,
  },
  premium: {
    dashboard: true,
    store: true,
    settings: true,
    inventory: true,
    orders: true,
    analytics: true,
    tasks: true,
    projects: true,
    invoices: true,
    messages: true,
    bisupplynet: true,
    notifications: true,
    profile: true,
    businessProfile: true,
    upload: true,
    socialMedia: true,
    automation: true,
  },
};

/** Freemium daily credits (backend src/config/credits.js). */
export const DAILY_CREDITS = 100;

export const CREDIT_COSTS = {
  ADD_PRODUCT: 5,
  EDIT_PRODUCT: 3,
  DELETE_PRODUCT: 3,
  VIEW_INVENTORY: 2,
  CREATE_ORDER: 5,
  CANCEL_ORDER: 3,
  VIEW_ANALYTICS: 5,
  EXPORT_CSV: 5,
  CREATE_TASK: 3,
  UPDATE_TASK: 2,
  DELETE_TASK: 2,
  CREATE_PROJECT: 5,
  UPDATE_PROJECT: 3,
  DELETE_PROJECT: 3,
  ADD_PROJECT_TASK: 3,
  CREATE_INVOICE: 5,
  SEND_INVOICE: 5,
  DOWNLOAD_INVOICE: 3,
  SEND_MESSAGE: 2,
  UPLOAD_IMAGE: 3,
  ACCESS_BISUPPLYNET: 10,
  PLACE_SUPPLY_ORDER: 10,
} as const;

export interface SubscriptionState {
  plan: PlanId;
  isTrialActive?: boolean;
  trialEndDate?: string | null;
  startupPackage?: PlanId | "starter" | null;
  startupPackageEndDate?: string | null;
  isStartupPackageExpired?: boolean;
}

/** Same order as the backend featureGate: trial, then startup package, then plan. */
export function featureAccess(sub: SubscriptionState | null | undefined, feature: Feature, now = new Date()): Access {
  if (!sub) return false;
  if (sub.isTrialActive && sub.trialEndDate && new Date(sub.trialEndDate) > now) return true;
  if (
    sub.startupPackage &&
    !sub.isStartupPackageExpired &&
    sub.startupPackageEndDate &&
    new Date(sub.startupPackageEndDate) > now
  ) {
    return true;
  }
  return PLAN_FEATURES[sub.plan]?.[feature] ?? false;
}
