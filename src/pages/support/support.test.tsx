import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { resetHistory } from "@/lib/nav/history";
import { installFakeBackend, type FakeBackend } from "@/test/fakeBackend";
import { HelpArticlePage, HelpCentrePage, NewServiceRequestPage, NewTicketPage, ServiceRequestDetailPage, SupportCentrePage, TicketDetailPage, TicketsPage } from "@/pages/support";

// Help & support (12.05–12.17). Routes are registered in App.tsx separately,
// so these tests mount just the support pages.

const routes = [
  { path: "/support", element: <SupportCentrePage /> },
  { path: "/support/tickets", element: <TicketsPage /> },
  { path: "/support/tickets/new", element: <NewTicketPage /> },
  { path: "/support/tickets/:id", element: <TicketDetailPage /> },
  { path: "/support/help", element: <HelpCentrePage /> },
  { path: "/support/help/:id", element: <HelpArticlePage /> },
  { path: "/support/service-requests/new", element: <NewServiceRequestPage /> },
  { path: "/support/service-requests/:id", element: <ServiceRequestDetailPage /> },
];

function renderPages(path: string) {
  resetHistory();
  const [pathname, search] = path.split("?");
  const router = createMemoryRouter(routes, { initialEntries: [{ pathname: pathname!, search: search ? `?${search}` : "" }] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
  return router;
}

const FILE = { url: "https://files.example/shot.png", name: "shot.png", type: "image/png", size: 2048 };
const TICKET = {
  _id: "t1",
  ticketNumber: "TKT-00042",
  subject: "Withdrawal not received",
  message: "My withdrawal hasn't arrived.",
  category: "wallet",
  priority: "medium",
  status: "open",
  relatedReference: "WD-2026-0032",
  contactEmail: "sam@x.com",
  attachments: [FILE],
  replies: [] as unknown[],
  createdAt: "2026-11-13T09:00:00Z",
  updatedAt: "2026-11-13T09:00:00Z",
};

let fb: FakeBackend;
beforeEach(() => {
  tokenStore.set("tok");
  serverStatus.set("up");
  fb = installFakeBackend();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  tokenStore.clear();
});
const last = (key: string) => [...fb.calls].reverse().find((c) => c.key === key);

describe("12.05 → 12.12 submit a ticket", () => {
  it("uploads an attachment, posts the ticket and lands on the confirmation", async () => {
    fb.handlers["POST /upload/attachment"] = () => [201, FILE];
    fb.handlers["POST /support/tickets"] = () => [201, { message: "Ticket created", ticket: TICKET }];
    fb.handlers["GET /support/tickets/t1"] = () => [200, TICKET];
    const user = userEvent.setup();
    const router = renderPages("/support/tickets/new?category=wallet&ref=WD-2026-0032");

    expect(await screen.findByDisplayValue("sam@x.com")).toBeInTheDocument();
    expect(screen.getByLabelText(/category/i)).toHaveValue("wallet");
    expect(screen.getByLabelText(/related reference/i)).toHaveValue("WD-2026-0032");
    expect(screen.getByLabelText(/priority/i)).toHaveValue("medium");

    await user.type(screen.getByLabelText(/request title/i), "Withdrawal not received");
    await user.type(screen.getByLabelText(/description/i), "My withdrawal hasn't arrived.");
    await user.upload(screen.getByLabelText("Add attachments"), new File(["x"], "shot.png", { type: "image/png" }));
    expect(await screen.findByRole("button", { name: "Remove shot.png" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Submit request" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/support/tickets/t1"));
    expect(router.state.location.search).toBe("?created=1");
    expect(last("POST /support/tickets")?.body).toEqual({
      subject: "Withdrawal not received",
      message: "My withdrawal hasn't arrived.",
      category: "wallet",
      priority: "medium",
      relatedReference: "WD-2026-0032",
      contactEmail: "sam@x.com",
      attachments: [FILE],
    });
    expect(await screen.findByText("Your request is in the right hands.")).toBeInTheDocument();
    expect(screen.getByText("Open · Awaiting support response")).toBeInTheDocument();
    expect(screen.getByText("Team reviews your message")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "shot.png" })).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("needs a title, category and description", async () => {
    const user = userEvent.setup();
    renderPages("/support/tickets/new");
    await user.click(await screen.findByRole("button", { name: "Submit request" }));
    expect(await screen.findByText(/give your request a title/i)).toBeInTheDocument();
    expect(screen.getByText("Choose a category.")).toBeInTheDocument();
    expect(last("POST /support/tickets")).toBeUndefined();
  });
});

describe("12.06 ticket detail", () => {
  it("shows the thread, maps the status, replies and closes", async () => {
    let ticket: Record<string, unknown> = { ...TICKET, status: "awaiting_reply", replies: [{ _id: "r1", by: "admin", message: "Please send your bank statement.", attachments: [], createdAt: "2026-11-13T10:00:00Z" }] };
    fb.handlers["GET /support/tickets/t1"] = () => [200, ticket];
    fb.handlers["POST /support/tickets/t1/reply"] = (body) => {
      ticket = { ...ticket, status: "open", replies: [...(ticket.replies as unknown[]), { _id: "r2", by: "user", message: body.message, attachments: [], createdAt: "2026-11-13T11:00:00Z" }] };
      return [200, ticket];
    };
    fb.handlers["POST /support/tickets/t1/close"] = () => ((ticket = { ...ticket, status: "closed" }), [200, ticket]);
    const user = userEvent.setup();
    renderPages("/support/tickets/t1");

    expect(await screen.findByRole("heading", { name: "Support ticket TKT-00042" })).toBeInTheDocument();
    expect(screen.getByText("BiManage support")).toBeInTheDocument();
    expect(screen.getByText("Please send your bank statement.")).toBeInTheDocument();
    expect(screen.getByText("Waiting for your reply")).toBeInTheDocument();
    expect(screen.queryByText("Your request is in the right hands.")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Your reply"), "Statement attached.");
    await user.click(screen.getByRole("button", { name: "Send reply" }));
    expect(await screen.findByText("Statement attached.")).toBeInTheDocument();
    expect(last("POST /support/tickets/t1/reply")?.body).toEqual({ message: "Statement attached." });
    expect(screen.getAllByText("You").length).toBe(2);

    await user.click(screen.getByRole("button", { name: "Close ticket" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Close ticket" }));
    await waitFor(() => expect(last("POST /support/tickets/t1/close")).toBeTruthy());
    expect(await screen.findByText("Replying reopens this ticket.")).toBeInTheDocument();
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });
});

describe("12.09 support centre and ticket list", () => {
  it("lists my latest tickets and searches the help centre", async () => {
    fb.handlers["GET /support/tickets"] = (_b, _h, url) => [200, { tickets: url.searchParams.get("limit") === "5" ? [{ ...TICKET, status: "in_progress" }] : [], total: 1, page: 1, totalPages: 1 }];
    fb.handlers["GET /support/service-requests"] = () => [200, { requests: [], total: 0, page: 1, totalPages: 0 }];
    fb.handlers["GET /support/faqs"] = () => [200, []];
    const user = userEvent.setup();
    const router = renderPages("/support");
    expect(await screen.findByText("Withdrawal not received")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /withdrawal not received/i })).toHaveAttribute("href", "/support/tickets/t1");
    expect(screen.getByRole("link", { name: /subscription & billing/i })).toHaveAttribute("href", "/support/help?category=billing");
    await user.type(screen.getByLabelText("Search help articles"), "payout{Enter}");
    await waitFor(() => expect(router.state.location.pathname).toBe("/support/help"));
    expect(router.state.location.search).toBe("?q=payout");
  });

  it("filters tickets by status", async () => {
    const seen: Array<string | null> = [];
    fb.handlers["GET /support/tickets"] = (_b, _h, url) => (seen.push(url.searchParams.get("status")), [200, { tickets: [TICKET], total: 1, page: 1, totalPages: 1 }]);
    const user = userEvent.setup();
    renderPages("/support/tickets");
    expect(await screen.findByText("Withdrawal not received")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Resolved" }));
    await waitFor(() => expect(seen).toContain("resolved"));
    expect(seen[0]).toBeNull();
  });
});

describe("12.07 help centre", () => {
  it("passes the search to the API and links to articles", async () => {
    const qs: Array<string | null> = [];
    fb.handlers["GET /support/faqs"] = (_b, _h, url) => {
      qs.push(url.searchParams.get("q"));
      return [200, [{ _id: "f1", question: "How do I withdraw to my bank?", answer: "Go to Wallet.", category: "wallet", readMinutes: 3, helpfulCount: 2, updatedAt: "2026-11-01T00:00:00Z" }]];
    };
    const user = userEvent.setup();
    renderPages("/support/help");
    expect(await screen.findByText("How do I withdraw to my bank?")).toBeInTheDocument();
    expect(screen.getByText("Wallet and payouts · 3 min read")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Search help articles"), "withdraw");
    await waitFor(() => expect(qs).toContain("withdraw"));
    expect(screen.getByRole("link", { name: /how do i withdraw/i })).toHaveAttribute("href", "/support/help/f1");
  });

  it("shows a contact link when nothing matches", async () => {
    fb.handlers["GET /support/faqs"] = () => [200, []];
    renderPages("/support/help?q=zzz");
    expect(await screen.findByText("No articles match your search")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Contact support" })[0]).toHaveAttribute("href", "/support/tickets/new");
  });

  it("article: plain paragraphs and a helpful vote (already voted)", async () => {
    fb.handlers["GET /support/faqs/f1"] = () => [200, { _id: "f1", question: "How do I withdraw?", answer: "Open Wallet.\n\n<b>Then</b> choose Withdraw.", category: "wallet", readMinutes: 2 }];
    fb.handlers["POST /support/faqs/f1/helpful"] = () => [200, { message: "Already voted", alreadyVoted: true }];
    const user = userEvent.setup();
    renderPages("/support/help/f1");
    expect(await screen.findByRole("heading", { name: "How do I withdraw?" })).toBeInTheDocument();
    expect(screen.getByText("Open Wallet.")).toBeInTheDocument();
    expect(screen.getByText("<b>Then</b> choose Withdraw.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Yes" }));
    expect(await screen.findByText("Thanks, we already have your feedback.")).toBeInTheDocument();
    expect(last("POST /support/faqs/f1/helpful")?.body).toEqual({ helpful: true });
    expect(screen.getByRole("link", { name: /still need help\? create a support ticket/i })).toHaveAttribute("href", "/support/tickets/new?category=wallet");
  });
});

describe("12.14 → 12.17 service request", () => {
  it("posts the request with reference files and shows the SRV reference", async () => {
    const REQ = { _id: "s1", requestNumber: "SRV-2026-0007", projectTitle: "New shop website", serviceType: "custom_website", preferredStart: "within_30_days", businessName: null, contactEmail: "sam@x.com", description: "A website for my fabric shop.", referenceFiles: [FILE], status: "pending", createdAt: "2026-11-13T09:00:00Z" };
    fb.handlers["POST /upload/attachment"] = () => [201, FILE];
    fb.handlers["POST /support/service-requests"] = () => [201, { message: "Received", request: REQ }];
    fb.handlers["GET /support/service-requests/s1"] = () => [200, REQ];
    const user = userEvent.setup();
    const router = renderPages("/support/service-requests/new");
    expect(await screen.findByDisplayValue("sam@x.com")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/project title/i), "New shop website");
    await user.selectOptions(screen.getByLabelText(/service required/i), "custom_website");
    await user.type(screen.getByLabelText(/project goals/i), "A website for my fabric shop.");
    await user.type(screen.getByLabelText(/^budget/i), "₦300,000");
    await user.upload(screen.getByLabelText("Add reference files"), new File(["x"], "shot.png", { type: "image/png" }));
    expect(await screen.findByRole("button", { name: "Remove shot.png" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/support/service-requests/s1"));
    expect(last("POST /support/service-requests")?.body).toEqual({
      projectTitle: "New shop website",
      serviceType: "custom_website",
      preferredStart: "within_30_days",
      contactEmail: "sam@x.com",
      description: "A website for my fabric shop.",
      budget: "₦300,000",
      referenceFiles: [FILE],
    });
    expect(await screen.findByText("SRV-2026-0007")).toBeInTheDocument();
    expect(screen.getByText("BiTechTeam will follow up with you within 48 hours.")).toBeInTheDocument();
    expect(screen.getByText("Received")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View support activity" })).toHaveAttribute("href", "/support");
  });

  it("rejects files that are too large or the wrong type, without uploading", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderPages("/support/service-requests/new");
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.pdf", { type: "application/pdf" });
    await user.upload(await screen.findByLabelText("Add reference files"), big);
    expect(await screen.findByText("big.pdf is larger than 5 MB.")).toBeInTheDocument();
    await user.upload(screen.getByLabelText("Add reference files"), new File(["x"], "notes.txt", { type: "text/plain" }));
    expect(await screen.findByText("notes.txt isn't a JPG, PNG, WebP or PDF file.")).toBeInTheDocument();
    expect(last("POST /upload/attachment")).toBeUndefined();
  });
});
