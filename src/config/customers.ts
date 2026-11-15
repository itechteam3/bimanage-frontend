import type { Feature } from "./plans";

// Customers (Figma 09.01–09.03): plan feature and team permissions, in one
// place so they are easy to change when the backend settles them.
//
// - Plan: "customers", on for every plan and startup package (backend #82).
// - Permissions: `viewCustomers` (list, stats, profile) / `manageCustomers`
//   (create, edit, delete, merge and CSV export). Roles saved before the
//   backend added them don't carry these keys; then the equivalent orders
//   permission decides (see PERMISSION_FALLBACK).

export const CUSTOMERS_FEATURE: Feature = "customers";

export const CUSTOMER_PERMISSIONS = {
  view: "viewCustomers",
  manage: "manageCustomers",
} as const;

/**
 * When a role payload lacks a permission key, read this one instead.
 * `view` follows the Orders list (open unless orders are switched off);
 * `manage` follows "create orders".
 */
export const PERMISSION_FALLBACK: Partial<Record<string, { key: string; whenMissing: boolean }>> = {
  viewCustomers: { key: "createOrders", whenMissing: true },
  manageCustomers: { key: "createOrders", whenMissing: false },
};
