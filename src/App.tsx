import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, Outlet, RouterProvider, ScrollRestoration } from "react-router-dom";
import { back, SCREENS } from "@/lib/nav/backNav";
import { useTrackHistory } from "@/lib/nav/history";
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
import type { Feature } from "@/config/plans";
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
// Sales, orders and invoices (Phase 5) load as one chunk.
const sales = (name: keyof typeof import("@/pages/sales/index")) => lazy(() => import("@/pages/sales/index").then((m) => ({ default: m[name] })));
const SalesOverviewPage = sales("SalesOverviewPage");
const SalesAnalyticsPage = sales("SalesAnalyticsPage");
const OrdersPage = sales("OrdersPage");
const CreateOrderPage = sales("CreateOrderPage");
const OrderCreatedPage = sales("OrderCreatedPage");
const OrderDetailsPage = sales("OrderDetailsPage");
const CancelOrderPage = sales("CancelOrderPage");
const OrderCancelledPage = sales("OrderCancelledPage");
const InvoicesPage = sales("InvoicesPage");
const InvoiceEditorPage = sales("InvoiceEditorPage");
const InvoiceCreatedPage = sales("InvoiceCreatedPage");
const InvoicePreviewPage = sales("InvoicePreviewPage");
const EmailInvoicePage = sales("EmailInvoicePage");
const InvoiceSentPage = sales("InvoiceSentPage");
// Projects and team (Phase 6) load as one chunk.
const work = (name: keyof typeof import("@/pages/projects/index")) => lazy(() => import("@/pages/projects/index").then((m) => ({ default: m[name] })));
const ProjectsOverviewPage = work("ProjectsOverviewPage");
const ProjectBoardPage = work("ProjectBoardPage");
const NewTaskPage = work("NewTaskPage");
const EditTaskPage = work("EditTaskPage");
const TaskAddedPage = work("TaskAddedPage");
const ProjectsCalendarPage = work("ProjectsCalendarPage");
const TeamDirectoryPage = work("TeamDirectoryPage");
const InvitePage = work("InvitePage");
const InviteSentPage = work("InviteSentPage");
// Online store, merchant side (Phase 8, Figma 08.01–08.10) loads as one chunk.
const shop = (name: keyof typeof import("@/pages/store/index")) => lazy(() => import("@/pages/store/index").then((m) => ({ default: m[name] })));
const CreateStorePage = shop("CreateStorePage");
const StoreOverviewPage = shop("StoreOverviewPage");
const StoreSettingsPage = shop("StoreSettingsPage");
const TemplatesPage = shop("TemplatesPage");
const DomainPage = shop("DomainPage");
const CataloguePage = shop("CataloguePage");
const StoreProductFormPage = shop("StoreProductFormPage");
const StoreProductDetailPage = shop("StoreProductDetailPage");
const BulkUploadPage = shop("BulkUploadPage");
const SyncInventoryPage = shop("SyncInventoryPage");
const StoreAnalyticsPage = shop("StoreAnalyticsPage");
// Public storefront (08.11–08.20): its own chunk, no sign-in.
const front = (name: keyof typeof import("@/pages/storefront/index")) => lazy(() => import("@/pages/storefront/index").then((m) => ({ default: m[name] })));
const StorefrontLayout = front("StorefrontLayout");
const StorefrontHomePage = front("StorefrontHomePage");
const StorefrontProductPage = front("StorefrontProductPage");
const CartPage = front("CartPage");
const StoreCheckoutPage = front("CheckoutPage");
const StorePaymentPage = front("PaymentPage");
const TrackOrderPage = front("TrackOrderPage");

/** A group of routes behind one plan feature, with an in-page loading state. */
const gated = (feature: Feature, title: string) => (
  <FeatureGate feature={feature} title={title}>
    <Suspense fallback={<SectionLoading />}>
      <Outlet />
    </Suspense>
  </FeatureGate>
);

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
  useTrackHistory();
  return (
    <>
      <ServerWakeBanner />
      <UpgradeDialog />
      {/* Back (browser, phone or ours) returns to the same scroll position. */}
      <ScrollRestoration />
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
    ["/bisupplynet/*", "BiSupplyNet"],
    ["/wallet/*", "Wallet"],
    ["/feli", "FELI AI"],
    ["/support/*", "Support"],
    ["/subscription", "Subscription"],
    ["/settings/*", "Settings"],
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
      { path: "/verify", element: guest(<VerifyEmailPage />), handle: { back: back("/register", SCREENS.createAccount) } },
      { path: "/forgot-password", element: guest(<ForgotPasswordPage />), handle: { back: back("/login", SCREENS.signIn) } },
      { path: "/forgot-password/code", element: guest(<ResetCodePage />), handle: { back: back("/forgot-password", SCREENS.signIn) } },
      { path: "/reset-password", element: guest(<NewPasswordPage />), handle: { back: back("/forgot-password/code", SCREENS.signIn) } },
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
          { path: "/onboarding/packages", element: <PackagesPage />, handle: { section: "Subscription", back: back("/onboarding", SCREENS.onboarding) } },
          { path: "/onboarding/packages/:packageId", element: <CheckoutPage />, handle: { section: "Subscription", back: back("/onboarding/packages", SCREENS.onboarding) } },
          { path: "/onboarding/payment", element: <PaymentStatusPage />, handle: { section: "Subscription", back: back("/onboarding/packages", SCREENS.onboarding) } },
          { path: "/onboarding/trial", element: <TrialStartedPage />, handle: { section: "Subscription" } },
          { path: "/onboarding/business", element: <BusinessIdentityPage />, handle: { section: "Onboarding", back: back("/onboarding", SCREENS.onboarding) } },
          { path: "/onboarding/checklist", element: <ChecklistPage />, handle: { section: "Dashboard", back: back("/dashboard", SCREENS.dashboard) } },
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
              { path: "/inventory/products", element: <ProductsPage />, handle: { section: "Inventory", back: back("/inventory", SCREENS.inventory) } },
              { path: "/inventory/products/new", element: <ProductFormPage />, handle: { section: "Inventory", back: back("/inventory/products", SCREENS.inventory) } },
              { path: "/inventory/products/:id", element: <ProductFormPage key="edit" />, handle: { section: "Inventory", back: back("/inventory/products", SCREENS.inventory) } },
              { path: "/inventory/products/:id/adjust", element: <AdjustStockPage />, handle: { section: "Inventory", back: back("/inventory/products/:id", SCREENS.inventory) } },
              { path: "/inventory/low-stock", element: <LowStockPage />, handle: { section: "Inventory", back: back("/inventory", SCREENS.inventory) } },
              { path: "/inventory/export", element: <ExportReadyPage />, handle: { section: "Inventory", back: back("/inventory", SCREENS.inventory) } },
              { path: "/inventory/lookup", element: <BarcodeLookupPage />, handle: { section: "Inventory", back: back("/inventory", SCREENS.inventory) } },
            ],
          },
          // Sales, orders and invoices (Figma 05.01–05.13)
          {
            element: gated("orders", "Sales and orders"),
            children: [
              { path: "/sales", element: <SalesOverviewPage />, handle: { section: "Sales" } },
              { path: "/orders", element: <OrdersPage />, handle: { section: "Orders" } },
              { path: "/orders/new", element: <CreateOrderPage />, handle: { section: "Orders", back: back("/orders", SCREENS.orders) } },
              { path: "/orders/:id", element: <OrderDetailsPage />, handle: { section: "Orders", back: back("/orders", SCREENS.orders) } },
              { path: "/orders/:id/created", element: <OrderCreatedPage />, handle: { section: "Orders", back: back("/orders/:id", SCREENS.orders) } },
              { path: "/orders/:id/cancel", element: <CancelOrderPage />, handle: { section: "Orders", back: back("/orders/:id", SCREENS.orders) } },
              { path: "/orders/:id/cancelled", element: <OrderCancelledPage />, handle: { section: "Orders", back: back("/orders/:id", SCREENS.orders) } },
            ],
          },
          {
            element: gated("analytics", "Sales analytics"),
            children: [
              { path: "/sales/analytics", element: <SalesAnalyticsPage />, handle: { section: "Sales", back: back("/sales", SCREENS.sales) } },
              { path: "/analytics", element: <Navigate to="/sales/analytics" replace /> },
            ],
          },
          {
            element: gated("invoices", "Invoices"),
            children: [
              { path: "/invoices", element: <InvoicesPage />, handle: { section: "Sales", back: back("/sales", SCREENS.sales) } },
              { path: "/invoices/new", element: <InvoiceEditorPage />, handle: { section: "Sales", back: back("/invoices", SCREENS.sales) } },
              { path: "/invoices/:id", element: <InvoicePreviewPage />, handle: { section: "Sales", back: back("/invoices", SCREENS.sales) } },
              { path: "/invoices/:id/edit", element: <InvoiceEditorPage key="edit" />, handle: { section: "Sales", back: back("/invoices/:id", SCREENS.sales) } },
              { path: "/invoices/:id/created", element: <InvoiceCreatedPage />, handle: { section: "Sales", back: back("/invoices/:id", SCREENS.sales) } },
              { path: "/invoices/:id/email", element: <EmailInvoicePage />, handle: { section: "Sales", back: back("/invoices/:id", SCREENS.sales) } },
              { path: "/invoices/:id/sent", element: <InvoiceSentPage />, handle: { section: "Sales", back: back("/invoices/:id", SCREENS.sales) } },
            ],
          },
          // Projects (Figma 04.02–04.08), behind the projects plan feature
          {
            element: gated("projects", "Projects"),
            children: [
              { path: "/projects", element: <ProjectsOverviewPage />, handle: { section: "Projects" } },
              { path: "/projects/calendar", element: <ProjectsCalendarPage />, handle: { section: "Projects", back: back("/projects", SCREENS.projects) } },
              { path: "/projects/:id", element: <ProjectBoardPage />, handle: { section: "Projects", back: back("/projects", SCREENS.projects) } },
              { path: "/projects/:id/tasks/new", element: <NewTaskPage />, handle: { section: "Projects", back: back("/projects/:id", SCREENS.projects) } },
              { path: "/projects/:id/tasks/:taskId", element: <EditTaskPage />, handle: { section: "Projects", back: back("/projects/:id", SCREENS.projects) } },
              { path: "/projects/:id/tasks/:taskId/added", element: <TaskAddedPage />, handle: { section: "Projects", back: back("/projects/:id", SCREENS.projects) } },
            ],
          },
          // Team & roles (Figma 04.01 / 04.05 / 04.09)
          {
            element: (
              <Suspense fallback={<SectionLoading />}>
                <Outlet />
              </Suspense>
            ),
            children: [
              { path: "/settings/team", element: <TeamDirectoryPage />, handle: { section: "Team" } },
              { path: "/settings/team/invite", element: <InvitePage />, handle: { section: "Team", back: back("/settings/team", SCREENS.team) } },
              { path: "/settings/team/invite/sent", element: <InviteSentPage />, handle: { section: "Team", back: back("/settings/team", SCREENS.team) } },
            ],
          },
          // Settings
          { path: "/settings/profile", element: <ProfilePage />, handle: { section: "Settings", back: back("/settings", SCREENS.settings) } },
          // Online store (Figma 08.01–08.10). Freemium has the store "view only":
          // it can build and preview; publishing is refused by plan.
          {
            element: gated("store", "Online Store"),
            children: [
              { path: "/store", element: <StoreOverviewPage />, handle: { section: "Online Store" } },
              { path: "/store/create", element: <CreateStorePage />, handle: { section: "Online Store", back: back("/dashboard", SCREENS.dashboard) } },
              { path: "/store/settings", element: <StoreSettingsPage />, handle: { section: "Online Store", back: back("/store", SCREENS.store) } },
              { path: "/store/templates", element: <TemplatesPage />, handle: { section: "Online Store", back: back("/store", SCREENS.store) } },
              { path: "/store/domain", element: <DomainPage />, handle: { section: "Online Store", back: back("/store", SCREENS.store) } },
              { path: "/store/analytics", element: <StoreAnalyticsPage />, handle: { section: "Online Store", back: back("/store", SCREENS.store) } },
              { path: "/store/products", element: <CataloguePage />, handle: { section: "Online Store", back: back("/store", SCREENS.store) } },
              { path: "/store/products/new", element: <StoreProductFormPage />, handle: { section: "Online Store", back: back("/store/products", SCREENS.store) } },
              { path: "/store/products/bulk", element: <BulkUploadPage />, handle: { section: "Online Store", back: back("/store/products", SCREENS.store) } },
              { path: "/store/products/sync", element: <SyncInventoryPage />, handle: { section: "Online Store", back: back("/store/products", SCREENS.store) } },
              { path: "/store/products/:id", element: <StoreProductDetailPage />, handle: { section: "Online Store", back: back("/store/products", SCREENS.store) } },
              { path: "/store/products/:id/edit", element: <StoreProductFormPage key="edit" />, handle: { section: "Online Store", back: back("/store/products/:id", SCREENS.store) } },
              { path: "/store/*", element: <Navigate to="/store" replace /> },
            ],
          },
          // Later phases
          ...comingSoon,
        ],
      },
      // Public storefront (Figma 08.11–08.20): no sign-in, guest checkout.
      {
        path: "/s/:slug",
        element: (
          <Suspense fallback={<Loading />}>
            <StorefrontLayout />
          </Suspense>
        ),
        children: [
          { index: true, element: <StorefrontHomePage /> },
          { path: "products/:productId", element: <StorefrontProductPage />, handle: { back: back("/s/:slug", SCREENS.shop) } },
          { path: "cart", element: <CartPage />, handle: { back: back("/s/:slug", SCREENS.shop) } },
          { path: "checkout", element: <StoreCheckoutPage />, handle: { back: back("/s/:slug/cart", SCREENS.shop) } },
          { path: "payment", element: <StorePaymentPage />, handle: { back: back("/s/:slug", SCREENS.shop) } },
          { path: "track", element: <TrackOrderPage />, handle: { back: back("/s/:slug", SCREENS.shop) } },
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
