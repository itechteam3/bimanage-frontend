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
import { DashboardPlaceholder } from "@/pages/app/DashboardPlaceholder";

const UiKitPage = lazy(() => import("@/pages/dev/UiKitPage"));

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
      // Signed in
      { path: "/dashboard", element: authed(<DashboardPlaceholder />) },
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
