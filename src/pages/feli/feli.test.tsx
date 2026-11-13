import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";
import { installFakeSockets } from "@/test/fakeSocket";
import { RichText } from "./FeliPages";
import { render } from "@testing-library/react";

// FELI (Figma 11.01–11.05): chat, review and approve, limits, restrictions, handoff.

const FREE_USAGE = { unlimited: false, limit: 20, used: 3, remaining: 17, resetsAt: "2026-11-13T23:00:00.000Z" };
const PAID_USAGE = { unlimited: true, limit: null, used: 0, remaining: null, resetsAt: null };
const TASK = { id: "p1", action: "create_task", label: "Create a project task", module: "Projects", params: { title: "Follow up supplier", priority: "high", dueDate: "2026-11-20" }, missing: [], requiredPlan: "standard" };
const TICKET = { id: "p2", action: "open_support_ticket", label: "Create a support ticket", module: "Support", params: { subject: "Delivery address", message: "Customer wants to change address", category: "orders", priority: "medium" }, missing: [], requiredPlan: "standard" };
const INVOICE = {
  id: "p3",
  action: "create_invoice",
  label: "Draft an invoice",
  module: "Invoices",
  params: { clientName: "Ada Nwosu", clientEmail: "ada@example.com", items: [{ description: "Ankara fabric", quantity: 2, unitPrice: 5000 }], tax: 10, notes: "" },
  missing: [],
  requiredPlan: "premium",
};

let fb: FakeBackend;
let sockets: ReturnType<typeof installFakeSockets>;
const last = (key: string) => [...fb.calls].reverse().find((c) => c.key === key);
const history = (over: Record<string, unknown> = {}) => [200, { messages: [], proposal: null, usage: FREE_USAGE, ...over }] as [number, unknown];

beforeEach(() => {
  tokenStore.set("tok");
  serverStatus.set("up");
  fb = installFakeBackend();
  sockets = installFakeSockets();
  fb.handlers["GET /subscriptions/current"] = () => [200, { plan: "freemium", status: "active", features: {} }];
  fb.handlers["GET /feli/history"] = () => history();
  fb.handlers["GET /feli/usage"] = () => [200, { usage: FREE_USAGE, actions: [], tier: "freemium" }];
  fb.handlers["GET /feli/suggestions"] = () => [200, { suggestions: ["How is my store doing?", "Show recent orders"] }];
});
afterEach(() => {
  sockets.restore();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  tokenStore.clear();
  localStorage.clear();
});

const reply = (over: Record<string, unknown> = {}) => [200, { reply: "Hello there", proposal: null, restriction: null, handoff: null, usage: { ...FREE_USAGE, used: 4, remaining: 16 }, ...over }] as [number, unknown];

describe("11.05 assistant chat", () => {
  it("loads history, sends a message and shows FELI's reply", async () => {
    fb.handlers["GET /feli/history"] = () => history({ messages: [{ role: "user", content: "Earlier question", createdAt: "2026-11-13T08:00:00Z" }, { role: "assistant", content: "Earlier answer" }] });
    fb.handlers["POST /feli/chat"] = () => reply({ reply: "You have **3 products** low on stock:\n- Rice\n- Beans" });
    const user = userEvent.setup();
    renderApp("/feli");
    expect(await screen.findByText("Earlier answer")).toBeInTheDocument();
    expect(screen.getAllByText(/17 of 20 messages left today/).length).toBeGreaterThan(0);
    await user.type(screen.getByLabelText("Message FELI"), "What needs restocking?{Enter}");
    expect(await screen.findByText("3 products")).toBeInTheDocument();
    expect(screen.getByText("Rice").tagName).toBe("LI");
    expect(last("POST /feli/chat")?.body).toEqual({ message: "What needs restocking?" });
    expect(screen.getByText("What needs restocking?")).toBeInTheDocument();
    expect(screen.getAllByText(/16 of 20 messages left today/).length).toBeGreaterThan(0);
  });

  it("sends a suggestion when its chip is clicked", async () => {
    fb.handlers["POST /feli/chat"] = () => reply({ reply: "Your store had 4 orders today." });
    const user = userEvent.setup();
    renderApp("/feli");
    await user.click(await screen.findByRole("button", { name: "Show recent orders" }));
    expect(await screen.findByText("Your store had 4 orders today.")).toBeInTheDocument();
    expect(last("POST /feli/chat")?.body).toEqual({ message: "Show recent orders" });
  });

  it("survives scrollIntoView returning a Promise (Chrome)", async () => {
    const spy = vi.fn(() => Promise.resolve());
    Element.prototype.scrollIntoView = spy as unknown as Element["scrollIntoView"];
    fb.handlers["POST /feli/chat"] = () => reply();
    const user = userEvent.setup();
    renderApp("/feli");
    await user.type(await screen.findByLabelText("Message FELI"), "Hi{Enter}");
    expect(await screen.findByText("Hello there")).toBeInTheDocument();
    expect(spy).toHaveBeenCalled();
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  });

  it("clears the conversation", async () => {
    fb.handlers["GET /feli/history"] = () => history({ messages: [{ role: "assistant", content: "Old answer" }] });
    fb.handlers["DELETE /feli/history"] = () => [200, { message: "Conversation cleared" }];
    const user = userEvent.setup();
    renderApp("/feli");
    await screen.findByText("Old answer");
    await user.click(screen.getByRole("button", { name: /Clear conversation/ }));
    const dialog = await screen.findByRole("dialog", { name: "Clear this conversation?" });
    await user.click(within(dialog).getByRole("button", { name: "Clear conversation" }));
    await waitFor(() => expect(screen.queryByText("Old answer")).not.toBeInTheDocument());
    expect(last("DELETE /feli/history")).toBeTruthy();
  });

  it("escalates to a person and shows the ticket number", async () => {
    fb.handlers["POST /feli/chat"] = () => reply({ reply: "I'm sorry about the missing payout.", handoff: { suggested: true, reason: "Payout missing" } });
    fb.handlers["POST /feli/escalate"] = () => [201, { ticketId: "t9", ticketNumber: "TKT-00042" }];
    const user = userEvent.setup();
    renderApp("/feli");
    await user.type(await screen.findByLabelText("Message FELI"), "My payout never came{Enter}");
    await screen.findByText("Would you like a person from our support team to help with this?");
    const chat = screen.getByRole("region", { name: "Chat with FELI" });
    await user.click(within(chat).getByRole("button", { name: "Talk to a person" }));
    const dialog = await screen.findByRole("dialog", { name: "Talk to a person?" });
    await user.click(within(dialog).getByRole("button", { name: "Open a ticket" }));
    const link = await screen.findByRole("link", { name: "View ticket TKT-00042" });
    expect(link).toHaveAttribute("href", "/support/tickets/t9");
    expect(last("POST /feli/escalate")?.body).toEqual({ reason: "Payout missing" });
  });

  it("shows unlimited usage and the actions on a paid plan", async () => {
    fb.handlers["GET /feli/history"] = () => history({ usage: PAID_USAGE });
    fb.handlers["GET /feli/usage"] = () => [200, { usage: PAID_USAGE, actions: ["open_support_ticket", "create_task"], tier: "standard" }];
    renderApp("/feli");
    expect(await screen.findByText("Unlimited messages")).toBeInTheDocument();
    expect(screen.getByText("Create a project task")).toBeInTheDocument();
  });
});

describe("11.03 daily limit", () => {
  it("FELI_LIMIT shows the limit state, disables the composer and keeps the global dialog away", async () => {
    fb.handlers["POST /feli/chat"] = () => [403, { code: "FELI_LIMIT", limitReached: true, upgrade: true, dailyLimit: 20, usage: { ...FREE_USAGE, used: 20, remaining: 0 }, message: "You've used today's 20 FELI messages." }];
    const user = userEvent.setup();
    renderApp("/feli");
    await user.type(await screen.findByLabelText("Message FELI"), "One more{Enter}");
    expect(await screen.findByRole("region", { name: "Daily FELI limit reached" })).toBeInTheDocument();
    expect(screen.getByText(/20 FELI messages a day/)).toBeInTheDocument();
    expect(screen.getByText(/\(Lagos time\)/)).toBeInTheDocument();
    expect(screen.getByLabelText("Message FELI")).toBeDisabled();
    expect(screen.getByRole("link", { name: "View available plans" })).toHaveAttribute("href", "/subscription/plans");
    expect(screen.queryByRole("dialog", { name: "FELI's daily limit reached" })).not.toBeInTheDocument();
  });

  it("shows the limit on load when nothing is left", async () => {
    fb.handlers["GET /feli/history"] = () => history({ usage: { ...FREE_USAGE, used: 20, remaining: 0 } });
    renderApp("/feli");
    expect(await screen.findByRole("region", { name: "Daily FELI limit reached" })).toBeInTheDocument();
    expect(screen.getByLabelText("Message FELI")).toBeDisabled();
  });
});

describe("11.04 restrictions in the chat", () => {
  const ask = async (restriction: Record<string, unknown>) => {
    fb.handlers["POST /feli/chat"] = () => reply({ reply: "I can't do that here, but here's how to get it done.", restriction });
    const user = userEvent.setup();
    renderApp("/feli");
    await user.type(await screen.findByLabelText("Message FELI"), "Do it{Enter}");
    await screen.findByText("I can't do that here, but here's how to get it done.");
  };

  it("UPGRADE_REQUIRED names the plan and links to plans and the alternative", async () => {
    await ask({ code: "UPGRADE_REQUIRED", action: "create_invoice", label: "Draft an invoice", currentPlan: "standard", requiredPlan: "premium", alternative: { label: "Create invoice manually", link: "/invoices/new" } });
    const card = screen.getByRole("region", { name: "Upgrade required" });
    expect(within(card).getByText("This FELI action needs the Premium plan")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Compare plans" })).toHaveAttribute("href", "/subscription/plans");
    expect(within(card).getByRole("link", { name: "Create invoice manually" })).toHaveAttribute("href", "/invoices/new");
  });

  it("PERMISSION_DENIED asks the owner or an admin", async () => {
    await ask({ code: "PERMISSION_DENIED", action: "create_task", label: "Create a project task", permission: "manageProjects" });
    const card = screen.getByRole("region", { name: "Permission needed" });
    expect(within(card).getByText(/Ask the business owner or an admin/)).toBeInTheDocument();
  });

  it("NOT_OFFERED shows the alternative button", async () => {
    await ask({ code: "NOT_OFFERED", action: "create_order", label: "Create an order", requiredPlan: "premium", alternative: { label: "Record a sale", link: "/orders/new" } });
    const card = screen.getByRole("region", { name: "Not something FELI can do" });
    expect(within(card).getByText("FELI can't do this one for you")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Record a sale" })).toHaveAttribute("href", "/orders/new");
  });
});

describe("11.01 action proposal review", () => {
  it("approve sends { proposalId, params } and shows the result link", async () => {
    fb.handlers["GET /feli/history"] = () => history({ proposal: TICKET });
    fb.handlers["POST /feli/actions/confirm"] = () => [200, { result: { kind: "ticket", id: "t5", label: "TKT-00077", link: "/support/tickets/t5" } }];
    const user = userEvent.setup();
    renderApp("/feli");
    const card = await screen.findByRole("region", { name: "Suggested action" });
    await user.click(within(card).getByRole("link", { name: "Review and approve" }));
    expect(await screen.findByRole("heading", { name: "Review FELI suggested action" })).toBeInTheDocument();
    expect(screen.getByText("Delivery address")).toBeInTheDocument();
    fb.handlers["GET /feli/history"] = () => history();
    await user.click(screen.getByRole("button", { name: "Approve action" }));
    expect(await screen.findByText("Support ticket TKT-00077 is open.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View the ticket" })).toHaveAttribute("href", "/support/tickets/t5");
    expect(last("POST /feli/actions/confirm")?.body).toEqual({ proposalId: "p2", params: TICKET.params });
  });

  it("cancel from the chat calls DELETE and removes the card", async () => {
    fb.handlers["GET /feli/history"] = () => history({ proposal: TICKET });
    fb.handlers["DELETE /feli/actions/pending"] = () => [200, { cancelled: true }];
    const user = userEvent.setup();
    renderApp("/feli");
    const card = await screen.findByRole("region", { name: "Suggested action" });
    await user.click(within(card).getByRole("button", { name: "Cancel suggestion" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Suggested action" })).not.toBeInTheDocument());
    expect(last("DELETE /feli/actions/pending")).toBeTruthy();
  });

  it("409 says it was already handled", async () => {
    fb.handlers["GET /feli/history"] = () => history({ proposal: TICKET });
    fb.handlers["POST /feli/actions/confirm"] = () => [409, { code: "NO_PROPOSAL", message: "This suggestion was already handled." }];
    const user = userEvent.setup();
    renderApp("/feli/review");
    await user.click(await screen.findByRole("button", { name: "Approve action" }));
    expect(await screen.findByText("This suggestion has already been handled")).toBeInTheDocument();
  });

  it("403 on approve shows the restriction", async () => {
    fb.handlers["GET /feli/history"] = () => history({ proposal: TICKET });
    fb.handlers["POST /feli/actions/confirm"] = () => [403, { code: "UPGRADE_REQUIRED", action: "open_support_ticket", label: "Create a support ticket", currentPlan: "freemium", requiredPlan: "standard", message: "This needs the Standard plan." }];
    const user = userEvent.setup();
    renderApp("/feli/review");
    await user.click(await screen.findByRole("button", { name: "Approve action" }));
    expect(await screen.findByText("This FELI action needs the Standard plan")).toBeInTheDocument();
  });

  it("with nothing pending, says so", async () => {
    renderApp("/feli/review");
    expect(await screen.findByText("Nothing waiting for review")).toBeInTheDocument();
  });
});

describe("nothing internal is ever shown (safety net)", () => {
  const ID = "64e000000000000000c3a55d";
  it("strips cut-off action markup, ids, JSON, model names and dashes from a reply", () => {
    render(
      <RichText
        text={`Here are tasks — one per person.\n- **Dev Elijah** – Draft the email.\nLet me know 9–5.\nRuns on openai/gpt-oss-20b.\n[FELI_ACTION]{"action":"create_task","params":{"projectId":"${ID}","assignedTo":"${ID}","title":"Draft launch email`}
      />
    );
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/FELI_|projectId|assignedTo|[0-9a-f]{24}|[{}]|gpt-oss|openai|[–—]|--/);
    expect(text).toContain("Here are tasks, one per person.");
    expect(text).toContain("Draft the email.");
    expect(text).toContain("9-5");
  });
});

describe("several suggestions in one reply", () => {
  const T2 = { ...TASK, id: "p3", params: { ...TASK.params, title: "Update the catalogue" } };
  it("shows a review card for each; cancelling one keeps the others", async () => {
    fb.handlers["GET /feli/history"] = () => history({ messages: [{ role: "assistant", content: "I've prepared these 2 for you to review." }], proposals: [TASK, T2], proposal: TASK });
    let cancelledId: string | null = "";
    fb.handlers["DELETE /feli/actions/pending"] = (_b, _h, u) => ((cancelledId = u.searchParams.get("id")), [200, { cancelled: true }]);
    const user = userEvent.setup();
    renderApp("/feli");
    const cards = await screen.findAllByRole("region", { name: "Suggested action" });
    expect(cards).toHaveLength(2);
    expect(within(cards[0]!).getByText(/1 of 2/)).toBeInTheDocument();
    expect(within(cards[1]!).getByRole("link", { name: "Review and approve" })).toHaveAttribute("href", "/feli/review?id=p3");
    await user.click(within(cards[0]!).getByRole("button", { name: "Cancel suggestion" }));
    await waitFor(() => expect(screen.getAllByRole("region", { name: "Suggested action" })).toHaveLength(1));
    expect(cancelledId).toBe("p1");
    expect(screen.getByText("Update the catalogue")).toBeInTheDocument();
  });

  it("the review page opens the chosen suggestion and offers the next one after approving", async () => {
    let waiting = [TASK, T2];
    fb.handlers["GET /feli/history"] = () => history({ proposals: waiting, proposal: waiting[0] ?? null });
    fb.handlers["GET /projects"] = () => [200, []];
    fb.handlers["GET /settings/team/people"] = () => [200, []];
    fb.handlers["POST /feli/actions/confirm"] = () => ((waiting = [TASK]), [200, { result: { kind: "task", id: "k1", label: "Update the catalogue", link: "/projects/pr1" } }]);
    const user = userEvent.setup();
    renderApp("/feli/review?id=p3");
    expect(await screen.findByLabelText(/Task name/)).toHaveValue("Update the catalogue");
    await user.click(screen.getByRole("button", { name: "Create task" }));
    expect(await screen.findByRole("link", { name: "Review the next suggestion" })).toHaveAttribute("href", "/feli/review?id=p1");
    expect(last("POST /feli/actions/confirm")?.body).toMatchObject({ proposalId: "p3" });
  });
});

describe("unanswered messages", () => {
  it("marks a message FELI didn't answer and can send it again", async () => {
    fb.handlers["GET /feli/history"] = () =>
      history({ messages: [{ role: "user", content: "first" }, { role: "user", content: "second" }, { role: "assistant", content: "Answer to second" }, { role: "user", content: "hi" }] });
    fb.handlers["POST /feli/chat"] = () => reply({ reply: "Hello again" });
    const user = userEvent.setup();
    renderApp("/feli");
    await screen.findByText("Answer to second");
    expect(screen.getAllByText("FELI didn't answer this one.")).toHaveLength(2);
    const again = screen.getAllByRole("button", { name: "Send again" });
    await user.click(again[again.length - 1]!);
    await waitFor(() => expect(last("POST /feli/chat")?.body).toEqual({ message: "hi" }));
  });
});

describe("11.02 create task review", () => {
  it("edits the title, picks a project and a teammate, and approves", async () => {
    fb.handlers["GET /feli/history"] = () => history({ proposal: TASK });
    fb.handlers["GET /projects"] = () => [200, [{ _id: "pr1", name: "October fulfilment", status: "active" }, { _id: "pr2", name: "Old launch", status: "cancelled" }]];
    fb.handlers["GET /settings/team/people"] = () => [200, [{ _id: "u2", name: "Tunde Adeyemi", avatar: null, role: "manager" }]];
    fb.handlers["POST /feli/actions/confirm"] = () => [200, { result: { kind: "task", id: "k1", label: "Call the supplier", link: "/projects/pr1" } }];
    const user = userEvent.setup();
    renderApp("/feli/review");
    const title = await screen.findByLabelText(/Task name/);
    expect(title).toHaveValue("Follow up supplier");
    expect(screen.getByText(/goes to your General project/)).toBeInTheDocument();
    await user.clear(title);
    await user.type(title, "Call the supplier");
    await screen.findByRole("option", { name: "October fulfilment" });
    expect(screen.queryByRole("option", { name: "Old launch" })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Project"), "pr1");
    await screen.findByRole("option", { name: "Tunde Adeyemi" });
    await user.selectOptions(screen.getByLabelText("Assigned teammate"), "u2");
    await user.click(screen.getByRole("button", { name: "Create task" }));
    expect(await screen.findByRole("link", { name: "Open the project" })).toHaveAttribute("href", "/projects/pr1");
    expect(last("POST /feli/actions/confirm")?.body).toEqual({
      proposalId: "p1",
      params: { title: "Call the supplier", description: "", priority: "high", dueDate: "2026-11-20", notes: "", projectId: "pr1", assignedTo: "u2" },
    });
  });

  it("shows FELI's chosen project and teammate by name (the picker matches what is sent)", async () => {
    fb.handlers["GET /feli/history"] = () => history({ proposal: { ...TASK, params: { ...TASK.params, projectId: "pr1", assignedTo: "u2" } } });
    fb.handlers["GET /projects"] = () => [200, [{ _id: "pr1", name: "October fulfilment", status: "active" }]];
    fb.handlers["GET /settings/team/people"] = () => [200, [{ _id: "u2", name: "Tunde Adeyemi", avatar: null, role: "manager" }]];
    fb.handlers["POST /feli/actions/confirm"] = () => [200, { result: { kind: "task", id: "k1", label: "Follow up supplier", link: "/projects/pr1" } }];
    const user = userEvent.setup();
    renderApp("/feli/review");
    const project = (await screen.findByLabelText("Project")) as HTMLSelectElement;
    expect(project.value).toBe("pr1");
    expect(project.selectedOptions[0]?.textContent).toBe("October fulfilment");
    expect((screen.getByLabelText("Assigned teammate") as HTMLSelectElement).value).toBe("u2");
    await user.click(screen.getByRole("button", { name: "Create task" }));
    await screen.findByRole("link", { name: "Open the project" });
    expect(last("POST /feli/actions/confirm")?.body).toMatchObject({ params: { projectId: "pr1", assignedTo: "u2" } });
  });

  it("the chat card names the project FELI picked", async () => {
    fb.handlers["GET /feli/history"] = () => history({ messages: [{ role: "assistant", content: "Here's a task." }], proposal: { ...TASK, params: { ...TASK.params, projectId: "pr1" } } });
    fb.handlers["GET /projects"] = () => [200, [{ _id: "pr1", name: "October fulfilment", status: "active" }]];
    fb.handlers["GET /settings/team/people"] = () => [200, []];
    renderApp("/feli");
    const card = await screen.findByRole("region", { name: "Suggested action" });
    expect(await within(card).findByText("October fulfilment")).toBeInTheDocument();
  });

  it("puts a 400 error on the right field", async () => {
    fb.handlers["GET /feli/history"] = () => history({ proposal: TASK });
    fb.handlers["GET /projects"] = () => [200, []];
    fb.handlers["GET /settings/team/people"] = () => [200, []];
    fb.handlers["POST /feli/actions/confirm"] = () => [400, { message: "Tasks can only be assigned to people in this business", field: "assignedTo", errors: [{ field: "assignedTo", message: "Tasks can only be assigned to people in this business" }] }];
    const user = userEvent.setup();
    renderApp("/feli/review");
    await user.click(await screen.findByRole("button", { name: "Create task" }));
    expect(await screen.findByText("Tasks can only be assigned to people in this business")).toBeInTheDocument();
  });
});

describe("invoice draft review", () => {
  it("edits an item and approve sends the edited items", async () => {
    fb.handlers["GET /feli/history"] = () => history({ proposal: INVOICE });
    fb.handlers["POST /feli/actions/confirm"] = () => [200, { result: { kind: "invoice", id: "i1", label: "INV-0009", link: "/invoices/i1" } }];
    const user = userEvent.setup();
    renderApp("/feli/review");
    expect(await screen.findByText("Saved as a draft. Nothing is sent to the client.")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-total")).toHaveTextContent("₦11,000");
    const qty = screen.getByLabelText("Item 1 quantity");
    await user.clear(qty);
    await user.type(qty, "3");
    await user.click(screen.getByRole("button", { name: "Add item" }));
    await user.type(screen.getByLabelText("Item 2 description"), "Delivery");
    const price = screen.getByLabelText("Item 2 unit price (₦)");
    await user.clear(price);
    await user.type(price, "1500");
    expect(screen.getByTestId("invoice-total")).toHaveTextContent("₦18,150");
    await user.click(screen.getByRole("button", { name: "Save draft invoice" }));
    expect(await screen.findByText(/Draft invoice INV-0009 is saved/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the invoice" })).toHaveAttribute("href", "/invoices/i1");
    expect(last("POST /feli/actions/confirm")?.body).toEqual({
      proposalId: "p3",
      params: {
        clientName: "Ada Nwosu",
        clientEmail: "ada@example.com",
        clientPhone: "",
        items: [
          { description: "Ankara fabric", quantity: 3, unitPrice: 5000 },
          { description: "Delivery", quantity: 1, unitPrice: 1500 },
        ],
        tax: 10,
        dueDate: null,
        notes: "",
      },
    });
  });

  it("removes an item and blocks an invalid quantity", async () => {
    fb.handlers["GET /feli/history"] = () => history({ proposal: { ...INVOICE, params: { ...INVOICE.params, items: [...INVOICE.params.items, { description: "Thread", quantity: 1, unitPrice: 300 }] } } });
    const user = userEvent.setup();
    renderApp("/feli/review");
    await user.click(await screen.findByRole("button", { name: "Remove item 2" }));
    expect(screen.queryByLabelText("Item 2 description")).not.toBeInTheDocument();
    const qty = screen.getByLabelText("Item 1 quantity");
    await user.clear(qty);
    await user.type(qty, "0");
    await user.click(screen.getByRole("button", { name: "Save draft invoice" }));
    expect(await screen.findByText("Use a whole number, 1 or more.")).toBeInTheDocument();
    expect(last("POST /feli/actions/confirm")).toBeUndefined();
  });
});

describe("FELI reply formatting", () => {
  it("renders bold and bullets as text, never HTML", () => {
    const { container } = render(<RichText text={"**Hi** <img src=x onerror=alert(1)>\n- one\n- two"} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("strong")?.textContent).toBe("Hi");
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
  });
});
