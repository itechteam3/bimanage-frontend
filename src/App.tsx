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
import { VersionBanner } from "@/components/feedback/VersionBanner";
import { RealtimeProvider } from "@/lib/realtime/RealtimeProvider";
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
// Wallet & payouts (Figma 06.01–06.10) loads as one chunk.
const wal = (name: keyof typeof import("@/pages/wallet/index")) => lazy(() => import("@/pages/wallet/index").then((m) => ({ default: m[name] })));
const sub = (name: keyof typeof import("@/pages/subscription/index")) => lazy(() => import("@/pages/subscription/index").then((m) => ({ default: m[name] })));
const SubscriptionOverviewPage = sub("SubscriptionOverviewPage");
const PlansPage = sub("PlansPage");
const ChangePlanPage = sub("ChangePlanPage");
const SubscriptionPaymentPage = sub("SubscriptionPaymentPage");
const CreditsPage = sub("CreditsPage");
const TrialPage = sub("TrialPage");
const BillingPage = sub("BillingPage");
const msg = (name: keyof typeof import("@/pages/messages/index")) => lazy(() => import("@/pages/messages/index").then((m) => ({ default: m[name] })));
const MessagesPage = msg("MessagesPage");
const sup = (name: keyof typeof import("@/pages/support/index")) => lazy(() => import("@/pages/support/index").then((m) => ({ default: m[name] })));
const SupportCentrePage = sup("SupportCentrePage");
const TicketsPage = sup("TicketsPage");
const NewTicketPage = sup("NewTicketPage");
const TicketDetailPage = sup("TicketDetailPage");
const HelpCentrePage = sup("HelpCentrePage");
const HelpArticlePage = sup("HelpArticlePage");
const NewServiceRequestPage = sup("NewServiceRequestPage");
const ServiceRequestDetailPage = sup("ServiceRequestDetailPage");
const feli = (name: keyof typeof import("@/pages/feli/index")) => lazy(() => import("@/pages/feli/index").then((m) => ({ default: m[name] })));
const FeliAssistantPage = feli("FeliAssistantPage");
const FeliReviewPage = feli("FeliReviewPage");
// BiSupplyNet (Figma 10.01–10.12) loads as one chunk.
const bsnChunk = () => import("@/pages/bisupplynet/index");
const bsn = (name: Exclude<keyof Awaited<ReturnType<typeof bsnChunk>>, "BuyGate" | "EitherGate" | "SellGate">) => lazy(() => bsnChunk().then((m) => ({ default: m[name] })));
const BsnBuy = lazy(() => bsnChunk().then((m) => ({ default: m.BuyGate })));
const BsnEither = lazy(() => bsnChunk().then((m) => ({ default: m.EitherGate })));
const BsnSell = lazy(() => bsnChunk().then((m) => ({ default: m.SellGate })));
const BsnHome = bsn("BsnHome");
const SuppliersPage = bsn("SuppliersPage");
const SupplierProfilePage = bsn("SupplierProfilePage");
const SupplyProductsPage = bsn("ProductsPage");
const SupplyCheckoutPage = bsn("CheckoutPage");
const MySupplyOrdersPage = bsn("MyOrdersPage");
const SupplyOrderPage = bsn("OrderDetailPage");
const ConfirmDeliveryPage = bsn("ConfirmDeliveryPage");
const FileDisputePage = bsn("FileDisputePage");
const MyDisputesPage = bsn("MyDisputesPage");
const DisputeDetailPage = bsn("DisputeDetailPage");
const SellHomePage = bsn("SellHomePage");
const ApplyPage = bsn("ApplyPage");
const ApplicationPage = bsn("ApplicationPage");
const ListingsPage = bsn("ListingsPage");
const ListingFormPage = bsn("ListingFormPage");
const SellerOrdersPage = bsn("SellerOrdersPage");
const ConnectionsPage = bsn("ConnectionsPage");
const SellerDisputesPage = bsn("SellerDisputesPage");
const EarningsPage = bsn("EarningsPage");
const rev = (name: keyof typeof import("@/pages/reviews/index")) => lazy(() => import("@/pages/reviews/index").then((m) => ({ default: m[name] })));
const PublicReviewsPage = rev("PublicReviewsPage");
const WriteReviewPage = rev("WriteReviewPage");
const ReviewSubmittedPage = rev("ReviewSubmittedPage");
const ntf = (name: keyof typeof import("@/pages/notifications/index")) => lazy(() => import("@/pages/notifications/index").then((m) => ({ default: m[name] })));
const NotificationsPage = ntf("NotificationsPage");
const NotificationPreferencesPage = ntf("NotificationPreferencesPage");
const WalletOverviewPage = wal("WalletOverviewPage");
const BankAccountPage = wal("BankAccountPage");
const SchedulePage = wal("SchedulePage");
const WithdrawPage = wal("WithdrawPage");
const ReviewWithdrawalPage = wal("ReviewWithdrawalPage");
const WithdrawalSubmittedPage = wal("WithdrawalSubmittedPage");
const TransactionsPage = wal("TransactionsPage");
const TransactionDetailPage = wal("TransactionDetailPage");
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
const StoreOrdersPage = shop("StoreOrdersPage");
const StoreOrderDetailPage = shop("StoreOrderDetailPage");
// Public storefront (08.11–08.20): its own chunk, no sign-in.
const front = (name: keyof typeof import("@/pages/storefront/index")) => lazy(() => import("@/pages/storefront/index").then((m) => ({ default: m[name] })));
const StorefrontLayout = front("StorefrontLayout");
const StorefrontHomePage = front("StorefrontHomePage");
const StorefrontProductPage = front("StorefrontProductPage");
const CartPage = front("CartPage");
const StoreCheckoutPage = front("CheckoutPage");
const StorePaymentPage = front("PaymentPage");
const TrackOrderPage = front("TrackOrderPage");
const StoreChatPage = front("StoreChatPage");

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
      <VersionBanner />
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
    ["/settings/*", "Settings"],
    ["/more", "More"],
  ] as const
).map(([path, section]) => ({ path, element: <ComingSoonPage />, handle: { section } }));
import { RouteErrorPage } from "@/components/feedback/RouteErrorPage";

const authed = (el: React.ReactNode) => <RequireAuth>{el}</RequireAuth>;
const buy = (el: React.ReactNode) => <BsnBuy>{el}</BsnBuy>;
const either = (el: React.ReactNode) => <BsnEither>{el}</BsnEither>;
const sell = (el: React.ReactNode) => <BsnSell>{el}</BsnSell>;

export const routes = [
  {
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
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
              { path: "/store/orders", element: <StoreOrdersPage />, handle: { section: "Online Store", back: back("/store", SCREENS.store) } },
              { path: "/store/orders/:id", element: <StoreOrderDetailPage />, handle: { section: "Online Store", back: back("/store/orders", SCREENS.store) } },
              { path: "/store/*", element: <Navigate to="/store" replace /> },
            ],
          },
          // Messages and notifications (Figma 12.01–12.04, 12.08, 12.10, 12.11, 12.13)
          {
            element: (
              <Suspense fallback={<SectionLoading />}>
                <Outlet />
              </Suspense>
            ),
            children: [
              { path: "/messages", element: <MessagesPage />, handle: { section: "Messages" } },
              { path: "/messages/:id", element: <MessagesPage />, handle: { section: "Messages", back: back("/messages", SCREENS.messages) } },
              { path: "/notifications", element: <NotificationsPage />, handle: { section: "Notifications" } },
              { path: "/notifications/preferences", element: <NotificationPreferencesPage />, handle: { section: "Notifications", back: back("/notifications", SCREENS.notifications) } },
              // Support, help centre, service requests (12.05–12.07, 12.09, 12.12, 12.14, 12.17)
              { path: "/support", element: <SupportCentrePage />, handle: { section: "Support" } },
              { path: "/support/tickets", element: <TicketsPage />, handle: { section: "Support", back: back("/support", SCREENS.support) } },
              { path: "/support/tickets/new", element: <NewTicketPage />, handle: { section: "Support", back: back("/support", SCREENS.support) } },
              { path: "/support/tickets/:id", element: <TicketDetailPage />, handle: { section: "Support", back: back("/support/tickets", SCREENS.support) } },
              { path: "/support/help", element: <HelpCentrePage />, handle: { section: "Support", back: back("/support", SCREENS.support) } },
              { path: "/support/help/:id", element: <HelpArticlePage />, handle: { section: "Support", back: back("/support/help", SCREENS.support) } },
              { path: "/support/service-requests/new", element: <NewServiceRequestPage />, handle: { section: "Support", back: back("/support", SCREENS.support) } },
              { path: "/support/service-requests/:id", element: <ServiceRequestDetailPage />, handle: { section: "Support", back: back("/support", SCREENS.support) } },
              { path: "/support/*", element: <Navigate to="/support" replace /> },
              // FELI AI assistant (11.01–11.05)
              { path: "/feli", element: <FeliAssistantPage />, handle: { section: "FELI AI" } },
              { path: "/feli/review", element: <FeliReviewPage />, handle: { section: "FELI AI", back: back("/feli", SCREENS.feli) } },
              { path: "/feli/*", element: <Navigate to="/feli" replace /> },
              // Writing a platform review (12.16 / 12.18)
              { path: "/reviews/write", element: <WriteReviewPage />, handle: { section: "Reviews", back: back("/reviews", SCREENS.reviews) } },
              { path: "/reviews/submitted", element: <ReviewSubmittedPage />, handle: { section: "Reviews", back: back("/reviews", SCREENS.reviews) } },
            ],
          },
          // Subscriptions & usage (Figma 07.01–07.11)
          {
            element: (
              <Suspense fallback={<SectionLoading />}>
                <Outlet />
              </Suspense>
            ),
            children: [
              { path: "/subscription", element: <SubscriptionOverviewPage />, handle: { section: "Subscription" } },
              { path: "/subscription/plans", element: <PlansPage />, handle: { section: "Subscription", back: back("/subscription", SCREENS.subscription) } },
              { path: "/subscription/change", element: <ChangePlanPage />, handle: { section: "Subscription", back: back("/subscription/plans", SCREENS.subscription) } },
              { path: "/subscription/payment", element: <SubscriptionPaymentPage />, handle: { section: "Subscription", back: back("/subscription", SCREENS.subscription) } },
              { path: "/subscription/credits", element: <CreditsPage />, handle: { section: "Subscription", back: back("/subscription", SCREENS.subscription) } },
              { path: "/subscription/trial", element: <TrialPage />, handle: { section: "Subscription", back: back("/subscription", SCREENS.subscription) } },
              { path: "/subscription/billing", element: <BillingPage />, handle: { section: "Subscription", back: back("/subscription", SCREENS.subscription) } },
              { path: "/subscription/*", element: <Navigate to="/subscription" replace /> },
            ],
          },
          // Wallet & payouts (Figma 06.01–06.10), owner only
          {
            element: (
              <Suspense fallback={<SectionLoading />}>
                <Outlet />
              </Suspense>
            ),
            children: [
              { path: "/wallet", element: <WalletOverviewPage />, handle: { section: "Wallet" } },
              { path: "/wallet/bank", element: <BankAccountPage />, handle: { section: "Wallet", back: back("/wallet", SCREENS.wallet) } },
              { path: "/wallet/schedule", element: <SchedulePage />, handle: { section: "Wallet", back: back("/wallet", SCREENS.wallet) } },
              { path: "/wallet/withdraw", element: <WithdrawPage />, handle: { section: "Wallet", back: back("/wallet", SCREENS.wallet) } },
              { path: "/wallet/withdraw/review", element: <ReviewWithdrawalPage />, handle: { section: "Wallet", back: back("/wallet/withdraw", SCREENS.wallet) } },
              { path: "/wallet/withdraw/submitted", element: <WithdrawalSubmittedPage />, handle: { section: "Wallet", back: back("/wallet", SCREENS.wallet) } },
              { path: "/wallet/transactions", element: <TransactionsPage />, handle: { section: "Wallet", back: back("/wallet", SCREENS.wallet) } },
              { path: "/wallet/transactions/:id", element: <TransactionDetailPage />, handle: { section: "Wallet", back: back("/wallet/transactions", SCREENS.wallet) } },
              { path: "/wallet/*", element: <Navigate to="/wallet" replace /> },
            ],
          },
          // BiSupplyNet (Figma 10.01–10.12). Standard and up buy; selling needs
          // Premium and the "Sell on BiSupplyNet" permission (SellGate).
          {
            element: gated("bisupplynet", "BiSupplyNet"),
            children: [
              { path: "/bisupplynet", element: <BsnHome />, handle: { section: "BiSupplyNet" } },
              { path: "/bisupplynet/suppliers", element: buy(<SuppliersPage />), handle: { section: "BiSupplyNet" } },
              { path: "/bisupplynet/suppliers/:id", element: buy(<SupplierProfilePage />), handle: { section: "BiSupplyNet", back: back("/bisupplynet/suppliers", SCREENS.bisupplynet) } },
              { path: "/bisupplynet/products", element: buy(<SupplyProductsPage />), handle: { section: "BiSupplyNet", back: back("/bisupplynet/suppliers", SCREENS.bisupplynet) } },
              { path: "/bisupplynet/checkout/:productId", element: buy(<SupplyCheckoutPage />), handle: { section: "BiSupplyNet", back: back("/bisupplynet/products", SCREENS.bisupplynet) } },
              { path: "/bisupplynet/orders", element: buy(<MySupplyOrdersPage />), handle: { section: "BiSupplyNet", back: back("/bisupplynet/suppliers", SCREENS.bisupplynet) } },
              // Buyer or seller: notifications and the inbox link here.
              { path: "/bisupplynet/orders/:id", element: either(<SupplyOrderPage />), handle: { section: "BiSupplyNet", back: back("/bisupplynet/orders", SCREENS.bisupplynet) } },
              { path: "/bisupplynet/orders/:id/confirm", element: buy(<ConfirmDeliveryPage />), handle: { section: "BiSupplyNet", back: back("/bisupplynet/orders/:id", SCREENS.bisupplynet) } },
              { path: "/bisupplynet/orders/:id/dispute", element: buy(<FileDisputePage />), handle: { section: "BiSupplyNet", back: back("/bisupplynet/orders/:id", SCREENS.bisupplynet) } },
              { path: "/bisupplynet/disputes", element: buy(<MyDisputesPage />), handle: { section: "BiSupplyNet", back: back("/bisupplynet/suppliers", SCREENS.bisupplynet) } },
              { path: "/bisupplynet/disputes/:id", element: either(<DisputeDetailPage />), handle: { section: "BiSupplyNet", back: back("/bisupplynet/disputes", SCREENS.bisupplynet) } },
              { path: "/bisupplynet/sell", element: sell(<SellHomePage />), handle: { section: "BiSupplyNet", back: back("/bisupplynet/suppliers", SCREENS.bisupplynet) } },
              { path: "/bisupplynet/sell/apply", element: sell(<ApplyPage />), handle: { section: "BiSupplyNet", back: back("/bisupplynet/suppliers", SCREENS.bisupplynet) } },
              { path: "/bisupplynet/sell/application", element: sell(<ApplicationPage />), handle: { section: "BiSupplyNet", back: back("/bisupplynet/suppliers", SCREENS.bisupplynet) } },
              { path: "/bisupplynet/sell/listings", element: sell(<ListingsPage />), handle: { section: "BiSupplyNet", back: back("/bisupplynet/sell/earnings", SCREENS.selling) } },
              { path: "/bisupplynet/sell/listings/new", element: sell(<ListingFormPage />), handle: { section: "BiSupplyNet", back: back("/bisupplynet/sell/listings", SCREENS.selling) } },
              { path: "/bisupplynet/sell/listings/:id/edit", element: sell(<ListingFormPage key="edit" />), handle: { section: "BiSupplyNet", back: back("/bisupplynet/sell/listings", SCREENS.selling) } },
              { path: "/bisupplynet/sell/orders", element: sell(<SellerOrdersPage />), handle: { section: "BiSupplyNet", back: back("/bisupplynet/sell/earnings", SCREENS.selling) } },
              { path: "/bisupplynet/sell/connections", element: sell(<ConnectionsPage />), handle: { section: "BiSupplyNet", back: back("/bisupplynet/sell/earnings", SCREENS.selling) } },
              { path: "/bisupplynet/sell/disputes", element: sell(<SellerDisputesPage />), handle: { section: "BiSupplyNet", back: back("/bisupplynet/sell/earnings", SCREENS.selling) } },
              { path: "/bisupplynet/sell/earnings", element: sell(<EarningsPage />), handle: { section: "BiSupplyNet" } },
              // Older links in notifications.
              { path: "/bisupplynet/dashboard", element: <Navigate to="/bisupplynet/sell" replace />, handle: { back: back("/bisupplynet/sell/earnings", SCREENS.selling) } },
              { path: "/bisupplynet/connections", element: <Navigate to="/bisupplynet/sell/connections" replace />, handle: { back: back("/bisupplynet/sell/earnings", SCREENS.selling) } },
              { path: "/bisupplynet/*", element: <Navigate to="/bisupplynet" replace /> },
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
          { path: "chat", element: <StoreChatPage />, handle: { back: back("/s/:slug", SCREENS.shop) } },
        ],
      },
      // Public platform reviews (12.15): readable signed out
      {
        path: "/reviews",
        element: (
          <Suspense fallback={<Loading />}>
            <div className="min-h-dvh bg-surface-page">
              <main className="mx-auto w-full max-w-5xl px-5 py-8 lg:py-12">
                <PublicReviewsPage />
              </main>
            </div>
          </Suspense>
        ),
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
        <RealtimeProvider>
          <RouterProvider router={router} />
        </RealtimeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
