import { lazy, Suspense } from "react";
import { createBrowserRouter, Outlet, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { env } from "@/config/env";
import { ApiError } from "@/lib/api/client";
import { ServerWakeBanner } from "@/components/feedback/ServerWakeBanner";
import { UpgradeDialog } from "@/components/feedback/UpgradeDialog";
import { Spinner } from "@/components/ui";
import { HomePage } from "@/pages/HomePage";
import { NotFoundPage } from "@/pages/NotFoundPage";

const UiKitPage = lazy(() => import("@/pages/dev/UiKitPage"));

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The backend allows a limited number of requests per user; cache generously.
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

export const router = createBrowserRouter(
  [
    {
      element: <RootLayout />,
      children: [
        { path: "/", element: <HomePage /> },
        { path: "/ui-kit/*", element: <UiKitPage /> },
        { path: "*", element: <NotFoundPage /> },
      ],
    },
  ],
  { basename: env.basePath }
);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
