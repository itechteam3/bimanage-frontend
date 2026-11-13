import { vi } from "vitest";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { resetHistory } from "@/lib/nav/history";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { routes } from "@/App";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { RealtimeProvider } from "@/lib/realtime/RealtimeProvider";

/** The QueryClient of the last renderApp() (for live-update tests). */
export let testQueryClient: QueryClient | null = null;

// A fake BiManage API for flow tests: "METHOD /path" → handler returning
// [status, json]. Every call is recorded for assertions.
export type Handler = (body: Record<string, unknown>, headers: Record<string, string>, url: URL) => [number, unknown];
export interface FakeBackend {
  handlers: Record<string, Handler>;
  calls: Array<{ key: string; body: Record<string, unknown>; headers: Record<string, string> }>;
}

export const ME = { _id: "u1", name: "Samuel Adebayo", email: "sam@x.com", isVerified: true };
export const OWNER_WS = { role: "owner", permissions: {}, businessId: "u1" };
export const EMPTY_DASHBOARD = {
  stats: { totalProducts: 0, totalStock: 0, totalInventoryValue: 0, totalSales: 0, revenue: 0, totalOrders: 0, openInvoices: 0, lowStock: 0, totalTasks: 0, pendingTasks: 0 },
  recentOrders: [],
  topSelling: [],
  salesChart: [],
  analytics: { totalOrders: 0, sale: 0, distribute: 0, return: 0 },
};

export function installFakeBackend(): FakeBackend {
  const fb: FakeBackend = {
    calls: [],
    handlers: {
      "GET /auth/me": () => [200, ME],
      "GET /settings/my-role": () => [200, OWNER_WS],
      "GET /onboarding/status": () => [200, { userPath: "existing_business", isTrialUsed: true, isTrialActive: true, daysRemainingTrial: 14 }],
      "GET /onboarding/steps": () => [200, { completedCount: 2, totalSteps: 7, isComplete: false, percentage: 29, steps: [] }],
      "GET /dashboard": () => [200, EMPTY_DASHBOARD],
      "GET /notifications/unread-count": () => [200, { unreadCount: 0 }],
      "GET /messages/unread-count": () => [200, { unreadCount: 0 }],
    "GET /business-profile": () => [200, { businessName: "Dior Factory LTD." }],
    },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const u = new URL(url);
      const key = `${init.method ?? "GET"} ${u.pathname.replace(/^\/api/, "")}`;
      const body = typeof init.body === "string" ? JSON.parse(init.body) : {};
      const headers = (init.headers ?? {}) as Record<string, string>;
      fb.calls.push({ key, body, headers });
      const h = fb.handlers[key];
      const [status, json] = h ? h(body, headers, u) : [404, { message: `no handler for ${key}` }];
      return new Response(JSON.stringify(json), { status, headers: { "content-type": "application/json" } });
    })
  );
  return fb;
}

export function renderApp(path: string, state?: unknown) {
  resetHistory();
  const [pathname, search] = path.split("?");
  const router = createMemoryRouter(routes, { initialEntries: [{ pathname: pathname!, search: search ? `?${search}` : "", state }] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  testQueryClient = client;
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <RealtimeProvider>
          <RouterProvider router={router} />
        </RealtimeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
  return router;
}
