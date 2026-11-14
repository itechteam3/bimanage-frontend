import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import type { RouteObject } from "react-router-dom";
import { Navigate } from "react-router-dom";
import type { Capability } from "./lib/types";

// /admin (Phase 16, decision A1): the platform admin area, in the same app
// with its own session. Everything loads as its own chunks, only when an admin
// opens it, so the business app stays as light as before.

const Shell = lazy(() => import("./components/AdminShell").then((m) => ({ default: m.AdminLayout })));
const page = <M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M) => lazy(() => load().then((m) => ({ default: m[name] as ComponentType })));
const auth = () => import("./pages/AdminAuthPages");
const shell = () => import("./components/AdminShell");
const AdminLoginPage = page(auth, "AdminLoginPage");
const AdminVerifyPage = page(auth, "AdminVerifyPage");
const AdminEnrolPage = page(auth, "AdminEnrolPage");
const OverviewPage = page(() => import("./pages/OverviewPage"), "OverviewPage");
const UsersPage = page(() => import("./pages/UsersPages"), "UsersPage");
const UserDetailPage = page(() => import("./pages/UsersPages"), "UserDetailPage");
const SuppliersPage = page(() => import("./pages/SuppliersPages"), "SuppliersPage");
const SupplierDetailPage = page(() => import("./pages/SuppliersPages"), "SupplierDetailPage");
const disputes = () => import("./pages/DisputesPages");
const DisputesPage = page(disputes, "DisputesPage");
const DisputeDetailPage = page(disputes, "DisputeDetailPage");
const SupplyOrdersPage = page(disputes, "SupplyOrdersPage");
const SupplyOrderDetailPage = page(disputes, "SupplyOrderDetailPage");
const support = () => import("./pages/SupportPages");
const SupportPage = page(support, "SupportPage");
const TicketDetailPage = page(support, "TicketDetailPage");
const ServiceRequestDetailPage = page(support, "ServiceRequestDetailPage");
const AnnouncementsPage = page(() => import("./pages/AnnouncementsPages"), "AnnouncementsPage");
const AnnouncementEditorPage = page(() => import("./pages/AnnouncementsPages"), "AnnouncementEditorPage");
const AnalyticsPage = page(() => import("./pages/AnalyticsPage"), "AnalyticsPage");
const roles = () => import("./pages/RolesPages");
const RolesPage = page(roles, "RolesPage");
const AuditPage = page(roles, "AuditPage");
const StoreDomainsPage = page(roles, "StoreDomainsPage");
const account = () => import("./pages/AccountPages");
const AdminAccountPage = page(account, "AdminAccountPage");
const AdminForgotPasswordPage = page(account, "AdminForgotPasswordPage");
const AdminResetPasswordPage = page(account, "AdminResetPasswordPage");
const AdminMorePage = page(shell, "AdminMorePage");
const RequireCan = lazy(() => shell().then((m) => ({ default: m.RequireCan as ComponentType<{ can: Capability; children: ReactNode }> })));

const Wait = () => (
  <div role="status" aria-label="Loading" className="flex justify-center py-16">
    <span className="size-8 animate-spin rounded-full border-4 border-surface-tonal border-t-brand-navy" />
  </div>
);
const s = (el: ReactNode) => <Suspense fallback={<Wait />}>{el}</Suspense>;
const gate = (can: Capability, el: ReactNode) => s(<RequireCan can={can}>{el}</RequireCan>);

export const adminRoutes: RouteObject[] = [
  { path: "/admin/login", element: s(<AdminLoginPage />) },
  { path: "/admin/login/verify", element: s(<AdminVerifyPage />) },
  { path: "/admin/login/setup", element: s(<AdminEnrolPage />) },
  { path: "/admin/forgot-password", element: s(<AdminForgotPasswordPage />) },
  { path: "/admin/reset-password", element: s(<AdminResetPasswordPage />) },
  {
    path: "/admin",
    element: s(<Shell />),
    children: [
      { index: true, element: gate("stats.read", <OverviewPage />), handle: { section: "Overview" } },
      { path: "users", element: gate("users.read", <UsersPage />), handle: { section: "Users" } },
      { path: "users/:id", element: gate("users.read", <UserDetailPage />), handle: { section: "Users" } },
      { path: "suppliers", element: gate("suppliers.review", <SuppliersPage />), handle: { section: "Supplier KYC" } },
      { path: "suppliers/:id", element: gate("suppliers.review", <SupplierDetailPage />), handle: { section: "Supplier KYC" } },
      { path: "bisupplynet/disputes", element: gate("disputes.read", <DisputesPage />), handle: { section: "Disputes" } },
      { path: "bisupplynet/disputes/:id", element: gate("disputes.read", <DisputeDetailPage />), handle: { section: "Disputes" } },
      { path: "bisupplynet/orders", element: gate("orders.read", <SupplyOrdersPage />), handle: { section: "Disputes" } },
      { path: "bisupplynet/orders/:id", element: gate("orders.read", <SupplyOrderDetailPage />), handle: { section: "Disputes" } },
      { path: "support/tickets", element: gate("support.manage", <SupportPage />), handle: { section: "Support" } },
      { path: "support/tickets/:id", element: gate("support.manage", <TicketDetailPage />), handle: { section: "Support" } },
      { path: "support/service-requests", element: <Navigate to="/admin/support/tickets?tab=requests" replace /> },
      { path: "support/service-requests/:id", element: gate("support.manage", <ServiceRequestDetailPage />), handle: { section: "Support" } },
      { path: "announcements", element: gate("announcements.send", <AnnouncementsPage />), handle: { section: "Announcements" } },
      { path: "announcements/new", element: gate("announcements.send", <AnnouncementEditorPage />), handle: { section: "Announcements" } },
      { path: "announcements/:id", element: gate("announcements.send", <AnnouncementEditorPage key="edit" />), handle: { section: "Announcements" } },
      { path: "analytics", element: gate("stats.read", <AnalyticsPage />), handle: { section: "Analytics" } },
      { path: "store-domains", element: gate("domains.manage", <StoreDomainsPage />), handle: { section: "Store domains" } },
      { path: "roles", element: gate("admins.manage", <RolesPage />), handle: { section: "Admin Roles" } },
      { path: "audit", element: gate("audit.read", <AuditPage />), handle: { section: "Audit trail" } },
      { path: "account", element: s(<AdminAccountPage />), handle: { section: "My account" } },
      { path: "more", element: s(<AdminMorePage />), handle: { section: "More" } },
      { path: "*", element: <Navigate to="/admin" replace /> },
    ],
  },
];
