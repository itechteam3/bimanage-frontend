import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";
import { installFakeSockets } from "@/test/fakeSocket";
import { FLOATING_STACK_CLASS, ReportIssue } from "./ReportIssue";
import { collectContext, issueContextRows, readMinimised, safePath } from "@/lib/support/issues";
import { TicketDetailPage } from "@/pages/support";

// "Report an issue": floating button on workspace screens, panel, submit.

const RESULT = { ticket: { _id: "t9", ticketNumber: "TKT-00042", subject: "Technical issue: The orders page went blank", status: "open" }, message: "Thanks — we've logged this as ticket TKT-00042. We'll reply in Support tickets." };
const NAME = "Report an issue";

let fb: FakeBackend;
beforeEach(() => {
  serverStatus.set("up");
  installFakeSockets();
  localStorage.clear();
  tokenStore.set("tok");
  fb = installFakeBackend();
});
afterEach(() => {
  tokenStore.clear();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The FormData sent to POST /support/issues. */
const sentForm = () => {
  const call = (fetch as unknown as Mock).mock.calls.find(([url, init]) => String(url).endsWith("/support/issues") && (init as RequestInit).method === "POST");
  return call ? ((call[1] as RequestInit).body as FormData) : null;
};

function renderButton(path = "/orders?status=open&token=abc", userId = "u1") {
  const router = createMemoryRouter(
    [
      { path: "/orders", element: <ReportIssue userId={userId} screen="Orders" /> },
      { path: "/support/tickets/:id", element: <p>Ticket page</p> },
    ],
    { initialEntries: [path] }
  );
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
  return router;
}

describe("where the button shows", () => {
  it("shows on workspace screens for signed-in people", async () => {
    renderApp("/dashboard");
    const button = await screen.findByRole("button", { name: NAME });
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("is not on the landing page", async () => {
    fb.handlers["GET /public/plans"] = () => [200, { currency: "NGN", plans: [], startupPackages: [] }];
    vi.stubGlobal("IntersectionObserver", undefined);
    renderApp("/");
    await screen.findByRole("heading", { level: 1, name: /smart business starts with bimanage/i });
    expect(screen.queryByRole("button", { name: NAME })).toBeNull();
  });

  it("is not on a storefront (even for a signed-in person)", async () => {
    fb.handlers["GET /store/elijahapparel"] = () => [200, { _id: "s1", storeName: "Elijah Apparel", storeSlug: "elijahapparel", template: "basic", deliveryFee: 2500, acceptingOrders: true }];
    fb.handlers["GET /cart/elijahapparel"] = () => [200, { items: [], itemCount: 0, subtotal: 0, deliveryFee: 0, total: 0, freeDeliveryAbove: null }];
    renderApp("/s/elijahapparel/cart");
    await screen.findByRole("heading", { name: "Your bag is empty" });
    expect(screen.queryByRole("button", { name: NAME })).toBeNull();
  });

  it("is not in /admin", async () => {
    renderApp("/admin/users");
    await screen.findByRole("heading", { name: "Admin sign-in" });
    expect(screen.queryByRole("button", { name: NAME })).toBeNull();
  });

  it("sits above the phone tab bar (never over it) and bottom-right on desktop", async () => {
    renderApp("/dashboard");
    const button = await screen.findByRole("button", { name: NAME });
    const stack = button.closest("[data-floating-actions]")!;
    expect(stack).toBeTruthy();
    expect(stack.className).toBe(FLOATING_STACK_CLASS);
    // Phones: lifted by the tab bar's height plus its own bottom offset and a gap.
    expect(stack.className).toContain("fixed");
    expect(stack.className).toContain("right-4");
    expect(stack.className).toMatch(/bottom-\[calc\(max\(1rem,env\(safe-area-inset-bottom\)\)_\+_var\(--spacing-mobile-tab-bar\)_\+_0\.75rem\)\]/);
    // Desktop (no tab bar): bottom-right corner.
    expect(stack.className).toContain("lg:bottom-6");
    expect(stack.className).toContain("lg:right-6");
    // Below the tab bar's layer? No: above the page (z-30 > tab bar z-20), below dialogs and banners.
    expect(stack.className).toContain("z-30");
    const tabs = screen.getByRole("navigation", { name: "Quick links" });
    expect(tabs.contains(button)).toBe(false);
    // Icon only on phones (text hidden visually but still the accessible name), text from lg.
    expect(within(button).getByText(NAME)).toHaveClass("sr-only", "lg:not-sr-only");
  });
});

describe("minimise", () => {
  it("collapses to a small tab, remembered per user", async () => {
    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByRole("button", { name: "Minimise the Report an issue button" }));
    expect(screen.queryByRole("button", { name: NAME })).toBeNull();
    const handle = screen.getByRole("button", { name: "Show the Report an issue button" });
    expect(handle).toHaveFocus();
    expect(readMinimised("u1")).toBe(true);
    expect(readMinimised("u2")).toBe(false);
    await user.click(handle);
    expect(screen.getByRole("button", { name: NAME })).toHaveFocus();
    expect(readMinimised("u1")).toBe(false);
  });

  it("starts minimised when the person chose that before", () => {
    localStorage.setItem("bm.reportIssue.minimised.u1", "1");
    renderButton();
    expect(screen.getByRole("button", { name: "Show the Report an issue button" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: NAME })).toBeNull();
  });

  it("works when storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByRole("button", { name: "Minimise the Report an issue button" }));
    expect(screen.getByRole("button", { name: "Show the Report an issue button" })).toBeInTheDocument();
  });
});

describe("the panel", () => {
  it("is a labelled dialog; focus moves in, Escape closes it and focus returns to the button", async () => {
    const user = userEvent.setup();
    renderButton();
    const button = screen.getByRole("button", { name: NAME });
    await user.click(button);
    const dialog = await screen.findByRole("dialog", { name: NAME });
    expect(within(dialog).getByLabelText(/What happened\?/)).toHaveFocus();
    expect(dialog).toHaveTextContent("We'll include: this page, app version, browser and device, time, your account and business.");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(button).toHaveFocus());
  });

  it("asks for what happened before sending (and announces it)", async () => {
    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByRole("button", { name: NAME }));
    await user.click(screen.getByRole("button", { name: "Send report" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Tell us what happened.");
    await user.type(screen.getByLabelText(/What happened\?/), "Broke");
    await user.click(screen.getByRole("button", { name: "Send report" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/at least 10 characters/);
    expect(sentForm()).toBeNull();
  });

  it("refuses files that aren't images/PDF or are over 5 MB, with a clear message", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderButton();
    await user.click(screen.getByRole("button", { name: NAME }));
    const input = screen.getByLabelText(/Add a screenshot or PDF/) as HTMLInputElement;
    await user.upload(input, new File(["x"], "notes.txt", { type: "text/plain" }));
    expect(screen.getByRole("alert")).toHaveTextContent("notes.txt isn't a PNG, JPG or WebP image or a PDF.");
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "huge.png", { type: "image/png" });
    await user.upload(screen.getByLabelText(/Add a screenshot or PDF/), big);
    expect(screen.getByRole("alert")).toHaveTextContent("huge.png is larger than 5 MB");
    await user.upload(screen.getByLabelText(/Add a screenshot or PDF/), new File(["png"], "shot.png", { type: "image/png" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("shot.png")).toBeInTheDocument();
  });

  it("sends the report with the page details (never tokens) and links to the new ticket", async () => {
    fb.handlers["POST /support/issues"] = () => [201, RESULT];
    const user = userEvent.setup();
    const router = renderButton("/orders?status=open&token=abc&reset_code=9");
    await user.click(screen.getByRole("button", { name: NAME }));
    await user.type(screen.getByLabelText(/What happened\?/), "The orders page went blank after saving.");
    await user.type(screen.getByLabelText(/What did you expect\?/), "To see my order.");
    await user.upload(screen.getByLabelText(/Add a screenshot or PDF/), new File(["png"], "shot.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "Send report" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Thanks — we've logged this as ticket TKT-00042. We'll reply in Support tickets.");
    const form = sentForm()!;
    expect([...form.keys()].sort()).toEqual(["attachment", "context", "expected", "whatHappened"]);
    expect(form.get("whatHappened")).toBe("The orders page went blank after saving.");
    expect(form.get("expected")).toBe("To see my order.");
    expect((form.get("attachment") as File).name).toBe("shot.png");
    const context = JSON.parse(String(form.get("context")));
    expect(Object.keys(context).sort()).toEqual(["appVersion", "occurredAt", "path", "screen", "timezone", "userAgent", "viewport"]);
    expect(context.path).toBe("/orders?status=open");
    expect(context.screen).toBe("Orders");
    expect(context.viewport).toMatch(/^\d+x\d+$/);
    const everything = JSON.stringify([...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v : "file"]));
    expect(everything).not.toMatch(/tok\b|token|abc|password|authorization/i);

    const link = screen.getByRole("link", { name: "View ticket TKT-00042" });
    expect(link).toHaveAttribute("href", "/support/tickets/t9");
    await user.click(link);
    await waitFor(() => expect(router.state.location.pathname).toBe("/support/tickets/t9"));
  });

  it("explains the rate limit", async () => {
    fb.handlers["POST /support/issues"] = () => [429, { message: "You've reported several issues in the last hour. Please wait a little, or add more details to your existing ticket in Support tickets.", code: "RATE_LIMITED" }];
    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByRole("button", { name: NAME }));
    await user.type(screen.getByLabelText(/What happened\?/), "The orders page went blank after saving.");
    await user.click(screen.getByRole("button", { name: "Send report" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/reported several issues in the last hour/);
  });

  it("shows a server field error next to the field", async () => {
    fb.handlers["POST /support/issues"] = () => [400, { message: "That file doesn't look like the image or PDF it says it is. Try another file.", field: "attachment" }];
    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByRole("button", { name: NAME }));
    await user.type(screen.getByLabelText(/What happened\?/), "The orders page went blank after saving.");
    await user.click(screen.getByRole("button", { name: "Send report" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/doesn't look like the image or PDF/);
  });

  it("uses full-width stacked buttons on phones and side by side from md", async () => {
    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByRole("button", { name: NAME }));
    const row = screen.getByRole("button", { name: "Send report" }).parentElement!;
    expect(row.className).toContain("flex-col-reverse");
    expect(row.className).toContain("md:flex-row");
    expect(row.className).toContain("md:[&>*]:flex-1");
    expect(row.className).not.toMatch(/(^|\s)\[&>\*\]:flex-1/);
  });
});

describe("context helpers", () => {
  it("drops secret-looking query parameters", () => {
    expect(safePath("/reset", "?token=abc&email=a%40b.c&code=123")).toBe("/reset?email=a%40b.c");
    expect(safePath("/orders", "")).toBe("/orders");
  });

  it("collects page, app, device and time only", () => {
    const c = collectContext({ pathname: "/orders", search: "?page=2", screen: "Orders" });
    expect(c.path).toBe("/orders?page=2");
    expect(Object.keys(c).sort()).toEqual(["appVersion", "occurredAt", "path", "screen", "timezone", "userAgent", "viewport"]);
    expect(issueContextRows(c).map(([k]) => k)).toEqual(["Screen", "Page", "App version", "Browser and device", "Screen size", "Time zone", "Reported at"]);
  });
});

describe("technical details on the ticket", () => {
  it("the user's ticket shows them when present", async () => {
    fb.handlers["GET /support/tickets/t9"] = () => [
      200,
      {
        _id: "t9",
        ticketNumber: "TKT-00042",
        subject: "Technical issue: The orders page went blank",
        message: "What happened:\nThe orders page went blank",
        category: "technical_issue",
        priority: "medium",
        status: "open",
        replies: [],
        createdAt: "2026-11-16T09:00:00Z",
        updatedAt: "2026-11-16T09:00:00Z",
        meta: { issueContext: { path: "/orders", screen: "Orders", appVersion: "1.4.0", viewport: "390x844", timezone: "Africa/Lagos" } },
      },
    ];
    const router = createMemoryRouter([{ path: "/support/tickets/:id", element: <TicketDetailPage /> }], { initialEntries: ["/support/tickets/t9"] });
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );
    const panel = (await screen.findByRole("heading", { name: "Technical details" })).closest("section")!;
    expect(within(panel).getByText("390 × 844")).toBeInTheDocument();
    expect(within(panel).getByText("1.4.0")).toBeInTheDocument();
    expect(screen.getByText("Technical issue")).toBeInTheDocument();
    await act(async () => undefined);
  });
});
