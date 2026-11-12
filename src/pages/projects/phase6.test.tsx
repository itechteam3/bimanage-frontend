import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { ME, installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";
import type { Project } from "@/lib/projects/api";

const today = new Date();
const inDays = (n: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + n, 12).toISOString();

const PROJECT: Project = {
  _id: "p1",
  name: "Storefront launch",
  status: "active",
  priority: "high",
  lead: { _id: "u2", name: "Tunde Adeyemi" },
  members: [],
  createdAt: today.toISOString(),
  progress: { total: 2, completed: 1, inProgress: 0, percent: 50 },
  tasks: [
    { _id: "t1", title: "Review stock alerts", status: "todo", priority: "high", assignedTo: { _id: "u2", name: "Tunde Adeyemi" }, dueDate: inDays(2), subtasks: [], notes: "" },
    { _id: "t2", title: "Write landing copy", status: "completed", priority: "medium", assignedTo: { _id: "u1", name: "Samuel Adebayo" }, dueDate: null, subtasks: [{ _id: "s1", title: "Hero", isCompleted: true }] },
  ],
};
const PEOPLE = [
  { _id: "u1", name: "Samuel Adebayo", avatar: null, role: "owner" },
  { _id: "u2", name: "Tunde Adeyemi", avatar: null, role: "manager" },
];

let fb: FakeBackend;
beforeEach(() => {
  tokenStore.set("tok");
  serverStatus.set("up");
  fb = installFakeBackend();
  fb.handlers["GET /subscriptions/current"] = () => [200, { plan: "standard", status: "active", features: { projects: true, tasks: true } }];
  fb.handlers["GET /projects"] = () => [200, [PROJECT]];
  fb.handlers["GET /projects/p1"] = () => [200, PROJECT];
  fb.handlers["GET /projects/stats"] = () => [200, { total: 1, active: 1, completed: 0, onHold: 0, cancelled: 0, totalTasks: 2, completedTasks: 1, todoTasks: 1, inProgressTasks: 0, overdueTasks: 0, upcomingDeadlines: 1, upcomingDays: 7 }];
  fb.handlers["GET /settings/team/people"] = () => [200, PEOPLE];
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  tokenStore.clear();
});
const last = (key: string) => [...fb.calls].reverse().find((c) => c.key === key);

describe("projects (04.04 / 04.06 / 04.02 / 04.07 / 04.08 / 04.03)", () => {
  it("overview: stats, each project with lead and progress", async () => {
    renderApp("/projects");
    expect(await screen.findByText("Storefront launch")).toBeInTheDocument();
    expect(screen.getByText(/Lead: Tunde Adeyemi/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /storefront launch progress/i })).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByText("Upcoming deadlines")).toBeInTheDocument();
  });

  it("board: three columns; moving a card updates its status", async () => {
    fb.handlers["PUT /projects/p1/tasks/t1"] = (b) => [200, { ...PROJECT.tasks[0], ...b }];
    renderApp("/projects/p1");
    const todo = await screen.findByRole("region", { name: /to do column/i });
    expect(within(todo).getByText("Review stock alerts")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /done column/i })).toHaveTextContent("Write landing copy");
    await userEvent.selectOptions(within(todo).getByLabelText(/move review stock alerts to/i), "in_progress");
    await waitFor(() => expect(last("PUT /projects/p1/tasks/t1")!.body).toEqual({ status: "in_progress" }));
  });

  it("create task: assignee from the team, checklist lines → subtasks, then the task-added screen", async () => {
    const created = { ...PROJECT.tasks[0], _id: "t9", title: "Draft launch email", subtasks: [{ _id: "a", title: "Subject", isCompleted: false }, { _id: "b", title: "Body", isCompleted: false }] };
    fb.handlers["POST /projects/p1/tasks"] = () => [201, created];
    const router = renderApp("/projects/p1/tasks/new");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/^title/i), "Draft launch email");
    await user.selectOptions(screen.getByLabelText(/^assignee/i), "u2");
    await user.type(screen.getByLabelText(/^subtasks/i), "Subject{enter}Body");
    fb.handlers["GET /projects/p1"] = () => [200, { ...PROJECT, tasks: [...PROJECT.tasks, created] }];
    await user.click(screen.getByRole("button", { name: /^create task$/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/projects/p1/tasks/t9/added"));
    expect(last("POST /projects/p1/tasks")!.body).toMatchObject({ title: "Draft launch email", assignedTo: "u2", subtasks: ["Subject", "Body"] });
    expect(await screen.findByText(/is on the Storefront launch board/i)).toBeInTheDocument();
  });

  it("edit task: tick a checklist item and save changes", async () => {
    fb.handlers["PUT /projects/p1/tasks/t2/subtasks/s1"] = () => [200, { _id: "s1", title: "Hero", isCompleted: false }];
    fb.handlers["PUT /projects/p1/tasks/t2"] = (b) => [200, { ...PROJECT.tasks[1], ...b }];
    renderApp("/projects/p1/tasks/t2");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("checkbox", { name: /done: hero/i }));
    await waitFor(() => expect(last("PUT /projects/p1/tasks/t2/subtasks/s1")!.body).toEqual({ isCompleted: false }));
    await user.clear(screen.getByLabelText(/^title/i));
    await user.type(screen.getByLabelText(/^title/i), "Write landing page copy");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByText("Changes saved.")).toBeInTheDocument();
    expect(last("PUT /projects/p1/tasks/t2")!.body).toMatchObject({ title: "Write landing page copy" });
  });

  it("staff: can change status and notes of their own task only (other fields locked, no create/delete)", async () => {
    fb.handlers["GET /settings/my-role"] = () => [200, { role: "staff", permissions: { manageProjects: true, viewDashboard: true }, businessId: "biz" }];
    fb.handlers["GET /projects/p1"] = () => [200, { ...PROJECT, tasks: [{ ...PROJECT.tasks[0], assignedTo: { _id: ME._id, name: ME.name } }] }];
    fb.handlers["PUT /projects/p1/tasks/t1"] = (b) => [200, { ...PROJECT.tasks[0], ...b }];
    renderApp("/projects/p1/tasks/t1");
    const user = userEvent.setup();
    expect(await screen.findByLabelText(/^title/i)).toBeDisabled();
    expect(screen.getByLabelText(/^assignee/i)).toBeDisabled();
    expect(screen.queryByRole("link", { name: /new task/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /delete task/i })).toBeNull();
    await user.selectOptions(screen.getByLabelText(/^status/i), "completed");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(last("PUT /projects/p1/tasks/t1")!.body).toEqual({ status: "completed", notes: "" }));
  });

  it("calendar: tasks on their due day, upcoming list, month navigation", async () => {
    const t = { _id: "t1", title: "Review stock alerts", status: "todo", priority: "high", dueDate: inDays(0), assignedTo: { _id: "u2", name: "Tunde Adeyemi" }, subtasks: { total: 0, done: 0 }, project: { _id: "p1", name: "Storefront launch" } };
    const ranges: string[] = [];
    fb.handlers["GET /projects/tasks"] = (_b, _h, url) => (ranges.push(url.searchParams.get("from") ?? ""), [200, [t]]);
    renderApp("/projects/calendar");
    const grid = await screen.findByRole("grid");
    expect(await within(grid).findByRole("link", { name: "Review stock alerts" })).toHaveAttribute("href", "/projects/p1/tasks/t1");
    expect(screen.getByText(/Tunde Adeyemi · High · Storefront launch/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /next month/i }));
    await waitFor(() => expect(new Set(ranges).size).toBeGreaterThanOrEqual(3)); // this month, upcoming, next month
  });
});

describe("team (04.01 / 04.05 / 04.09)", () => {
  beforeEach(() => {
    fb.handlers["GET /settings/team"] = () => [200, [
      { _id: "owner-u1", isOwner: true, role: "owner", user: { _id: "u1", name: "Samuel Adebayo", email: "sam@x.com" }, permissions: {}, isActive: true },
      { _id: "m1", role: "manager", user: { _id: "u2", name: "Tunde Adeyemi", email: "tunde@x.com" }, permissions: {}, isActive: true },
    ]];
    fb.handlers["GET /settings/team/invites"] = () => [200, [{ _id: "i1", email: "chika@x.com", name: "Chika Okafor", role: "staff", permissions: {}, status: "pending", expiresAt: inDays(2), createdAt: inDays(0) }]];
  });

  it("directory: owner, members and pending invites, searchable; owner can't be edited", async () => {
    renderApp("/settings/team");
    const list = await screen.findByRole("list", { name: /team members and invitations/i });
    expect(within(list).getByText("Samuel Adebayo")).toBeInTheDocument();
    expect(within(list).getByText("Chika Okafor")).toBeInTheDocument();
    expect(within(list).getAllByText("Invited").length).toBe(1);
    expect(within(list).getAllByRole("button", { name: "Edit access" }).length).toBe(1); // Tunde only, not the owner
    await userEvent.type(screen.getByRole("textbox", { name: /search members/i }), "chika");
    expect(within(list).queryByText("Tunde Adeyemi")).toBeNull();
  });

  it("invite: role defaults + custom permission → only the difference is sent → sent screen", async () => {
    fb.handlers["POST /settings/team/invite"] = (b) => [201, { message: "ok", invite: { _id: "i9", email: (b as { email: string }).email, name: "Ada Obi", role: "staff", permissions: { manageInventory: true, createOrders: true, viewDashboard: true, manageProjects: true }, status: "pending", expiresAt: inDays(2), createdAt: inDays(0) } }];
    const router = renderApp("/settings/team/invite");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/full name/i), "Ada Obi");
    await user.type(screen.getByLabelText(/email address/i), "ada@x.com");
    await user.click(screen.getByRole("checkbox", { name: /inventory/i }));
    await user.click(screen.getByRole("button", { name: /send invitation/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/settings/team/invite/sent"));
    expect(last("POST /settings/team/invite")!.body).toEqual({ email: "ada@x.com", name: "Ada Obi", role: "staff", permissions: { manageInventory: true } });
    expect(await screen.findByText(/We emailed Ada Obi an invitation/)).toBeInTheDocument();
  });

  it("invite: an already-pending invite offers Resend instead of an error", async () => {
    fb.handlers["POST /settings/team/invite"] = () => [409, { message: "An invite is already pending for this email. Resend it instead.", field: "email", inviteId: "i1" }];
    fb.handlers["POST /settings/team/invites/i1/resend"] = () => [200, { invite: { _id: "i1", email: "chika@x.com", name: "Chika Okafor", role: "staff", permissions: {}, status: "pending", expiresAt: inDays(2), createdAt: inDays(0) } }];
    const router = renderApp("/settings/team/invite");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/email address/i), "chika@x.com");
    await user.click(screen.getByRole("button", { name: /send invitation/i }));
    await user.click(await screen.findByRole("button", { name: /resend it/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/settings/team/invite/sent"));
  });

  it("people without team management see a clear message, not the list", async () => {
    fb.handlers["GET /settings/my-role"] = () => [200, { role: "staff", permissions: { manageTeam: false }, businessId: "biz" }];
    renderApp("/settings/team");
    expect(await screen.findByText(/team management is for owners and admins/i)).toBeInTheDocument();
    expect(last("GET /settings/team")).toBeUndefined();
  });
});
