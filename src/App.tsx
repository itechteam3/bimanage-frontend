import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { env } from "@/config/env";
import { ApiError } from "@/lib/api/client";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { GuestOnly, RequireAuth } from "@/lib/auth/guards";
import { ServerWakeBanner } from "@/components/feedback/ServerWakeBanner";
import { UpgradeDialog } from "@/components/feedback/UpgradeDialog";
import { Spinner } from "@/components/ui";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { SignInPage } from "@/pages/auth/SignInPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { VerifyEmailPage } from "@/pages/auth/VerifyEmailPage";
import { ForgotPasswordPage, NewPasswordPage, PasswordChangedPage, ResetCodePage } from "@/pages/auth/RecoveryPages";
import { OAuthCallbackPage } from "@/pages/auth/OAuthCallbackPage";
import { InviteAcceptPage } from "@/pages/auth/InviteAcceptPage";
import { WorkspaceLayout } from "@/components/layout/WorkspaceLayout";
import { DashboardPage } from "@/pages/app/DashboardPage";
import { ComingSoonPage } from "@/pages/app/ComingSoonPage";
import { PathPage } from "@/pages/onboarding/PathPage";
import { CheckoutPage, PackagesPage, PaymentStatusPage } from "@/pages/onboarding/PackagePages";
import { BusinessIdentityPage, ChecklistPage, TrialStartedPage } from "@/pages/onboarding/SetupPages";
import { FeatureGate } from "@/lib/workspace/subscription";
import { ProfilePage } from "@/pages/settings/ProfilePage";

const UiKitPage = lazy(() => import("@/pages/dev/UiKitPage"));
// Inventory screens load as one chunk on first visit.
const inventory = (name: keyof typeof import("@/pages/inventory")) => lazy(() => import("@/pages/inventory").then((m) => ({ default: m[name] })));
const InventoryOverviewPage = inventory("InventoryOverviewPage");
const ProductsPage = inventory("ProductsPage");
const ProductFormPage = inventory("ProductFormPage");
const AdjustStockPage = inventory("AdjustStockPage");
const LowStockPage = inventory("LowStockPage");
const ExportReadyPage = inventory("ExportReadyPage");
const BarcodeLookupPage = inventory("BarcodeLookupPage");

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The backend limits requests per user; cache generously.
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      // The API client already retries GETs with backoff; don't stack retries.
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 1,
    },
    mutations: { retry: false },
  },
});

const Loading = () => (
  <div className="flex min-h-dvh items-center justify-center text-ink-brand" role="status">
    <Spinner className="size-8" />
    <span className="sr-only">Loading…</span>
  </div>
);

const SectionLoading = () => (
  <div className="flex justify-center py-16 text-ink-brand" role="status">
    <Spinner className="size-8" />
    <span className="sr-only">Loading…</span>
  </div>
);

function RootLayout() {
  return (
    <>
      <ServerWakeBanner />
      <UpgradeDialog />
      <Suspense fallback={<Loading />}>
        <Outlet />
      </Suspense>
    </>
  );
}

const guest = (el: React.ReactNode) => <GuestOnly>{el}</GuestOnly>;

// Sections built in later phases: real routes now, so links never 404.
const comingSoon = (
  [
    ["/sales", "Sales"],
    ["/orders", "Orders"],
    ["/invoices", "Invoices"],
    ["/projects", "Projects"],
    ["/settings/team", "Team"],
    ["/store/*", "Online Store"],
    ["/bisupplynet/*", "BiSupplyNet"],
    ["/wallet/*", "Wallet"],
    ["/feli", "FELI AI"],
    ["/support/*", "Support"],
    ["/subscription", "Subscription"],
    ["/settings/*", "Settings"],
    ["/analytics", "Analytics"],
    ["/notifications", "Notifications"],
    ["/messages", "Messages"],
    ["/more", "More"],
  ] as const
).map(([path, section]) => ({ path, element: <ComingSoonPage />, handle: { section } }));
const authed = (el: React.ReactNode) => <RequireAuth>{el}</RequireAuth>;

export const routes = [
  {
    element: <RootLayout />,
    children: [
      { path: "/", element: <Navigate to="/dashboard" replace /> },
      // Authentication (Figma 01.xx)
      { path: "/login", element: guest(<SignInPage />) },
      { path: "/register", element: guest(<RegisterPage />) },
      { path: "/verify", element: guest(<VerifyEmailPage />) },
      { path: "/forgot-password", element: guest(<ForgotPasswordPage />) },
      { path: "/forgot-password/code", element: guest(<ResetCodePage />) },
      { path: "/reset-password", element: guest(<NewPasswordPage />) },
      { path: "/reset-password/done", element: <PasswordChangedPage /> },
      { path: "/oauth/callback", element: <OAuthCallbackPage /> },
      { path: "/invite/accept", element: <InviteAcceptPage /> },
      // Signed in — inside the app shell
      {
        element: authed(<WorkspaceLayout />),
        children: [
          { path: "/dashboard", element: <DashboardPage />, handle: { section: "Dashboard" } },
          // Onboarding (Figma 02.xx, startup packages 07.12–07.05)
          { path: "/onboarding", element: <PathPage />, handle: { section: "Onboarding" } },
          { path: "/onboarding/packages", element: <PackagesPage />, handle: { section: "Subscription" } },
          { path: "/onboarding/packages/:packageId", element: <CheckoutPage />, handle: { section: "Subscription" } },
          { path: "/onboarding/payment", element: <PaymentStatusPage />, handle: { section: "Subscription" } },
          { path: "/onboarding/trial", element: <TrialStartedPage />, handle: { section: "Subscription" } },
          { path: "/onboarding/business", element: <BusinessIdentityPage />, handle: { section: "Onboarding" } },
          { path: "/onboarding/checklist", element: <ChecklistPage />, handle: { section: "Dashboard" } },
          // Inventory and barcode (Figma 09.04–09.11), gated by plan
          {
            element: (
              <FeatureGate feature="inventory" title="Inventory">
                <Suspense fallback={<SectionLoading />}>
                  <Outlet />
                </Suspense>
              </FeatureGate>
            ),
            handle: { section: "Inventory" },
            children: [
              { path: "/inventory", element: <InventoryOverviewPage />, handle: { section: "Inventory" } },
              { path: "/inventory/products", element: <ProductsPage />, handle: { section: "Inventory" } },
              { path: "/inventory/products/new", element: <ProductFormPage />, handle: { section: "Inventory" } },
              { path: "/inventory/products/:id", element: <ProductFormPage key="edit" />, handle: { section: "Inventory" } },
              { path: "/inventory/products/:id/adjust", element: <AdjustStockPage />, handle: { section: "Inventory" } },
              { path: "/inventory/low-stock", element: <LowStockPage />, handle: { section: "Inventory" } },
              { path: "/inventory/export", element: <ExportReadyPage />, handle: { section: "Inventory" } },
              { path: "/inventory/lookup", element: <BarcodeLookupPage />, handle: { section: "Inventory" } },
            ],
          },
          // Settings
          { path: "/settings/profile", element: <ProfilePage />, handle: { section: "Settings" } },
          // Later phases
          ...comingSoon,
        ],
      },
      // Design review
      { path: "/ui-kit/*", element: <UiKitPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes, { basename: env.basePath });

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
