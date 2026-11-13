import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconArrowRight, IconChevronLeft, IconChevronRight, IconFolderPlus, IconPlus, IconTrash } from "@tabler/icons-react";
import { Button, ButtonLink, Dialog, EmptyState, Field, SelectInput, Spinner, Status, TextArea, TextInput } from "@/components/ui";
import { InfoStrip, IntroCard, KpiCard, PageTitle, Panel } from "@/components/page/Blocks";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useCan } from "@/lib/auth/useCan";
import { applyFieldErrors } from "@/lib/api/errorMessage";
import { count, shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { usePeople } from "@/lib/team/api";
import {
  PRIORITY_LABEL,
  PROJECT_STATUS,
  STATUS_COLUMNS,
  dueLabel,
  useAddTask,
  useCalendarTasks,
  useDeleteTask,
  useProject,
  useProjectStats,
  useProjects,
  useSaveProject,
  useSubtasks,
  useUpcomingTasks,
  useUpdateTask,
  type Project,
  type Task,
  type TaskStatus,
} from "@/lib/projects/api";
import { useUrlState } from "@/lib/nav/useUrlState";
import { useLeaveGuard } from "@/lib/nav/useLeaveGuard";

const Loading = () => (
  <div className="flex justify-center py-16 text-ink-brand" role="status">
    <Spinner className="size-8" />
    <span className="sr-only">Loading…</span>
  </div>
);

/** Staff work on their own tasks; owners, admins and managers manage projects. */
function useProjectRules() {
  const { user, workspace } = useAuth();
  const canWork = useCan("manageProjects");
  const isStaff = workspace?.role === "staff";
  return {
    isStaff,
    canManage: canWork && !isStaff,
    canMove: (t: Task) => canWork && (!isStaff || t.assignedTo?._id === user?._id),
  };
}

const ProgressBar = ({ percent, label }: { percent: number; label: string }) => (
  <div role="progressbar" aria-label={label} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className="h-2.5 w-full overflow-hidden rounded-full bg-surface-disabled">
    <div className="h-full rounded-full bg-brand-navy" style={{ width: `${percent}%` }} />
  </div>
);

// ── New / edit project dialog ─────────────────────────────────────────────
const projectSchema = z.object({
  name: z.string().trim().min(2, "Give the project a name (at least 2 characters).").max(100),
  description: z.string().trim().max(500),
  lead: z.string(),
  dueDate: z.string(),
  priority: z.enum(["low", "medium", "high"]),
  status: z.enum(["active", "on_hold", "completed", "cancelled"]),
});
type ProjectValues = z.infer<typeof projectSchema>;

function ProjectDialog({ project, onClose, onSaved }: { project?: Project; onClose: () => void; onSaved: (p: Project) => void }) {
  const people = usePeople();
  const save = useSaveProject(project?._id);
  const [error, setError] = useState<unknown>(null);
  const { register, handleSubmit, setError: setFieldError, formState } = useForm<ProjectValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: project?.name ?? "",
      description: project?.description ?? "",
      lead: project?.lead?._id ?? "",
      dueDate: project?.dueDate ? project.dueDate.slice(0, 10) : "",
      priority: project?.priority ?? "medium",
      status: project?.status ?? "active",
    },
  });
  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      const p = await save.mutateAsync({ ...v, lead: v.lead || null, dueDate: v.dueDate || null });
      onSaved(p);
    } catch (err) {
      if (!applyFieldErrors(err, setFieldError, ["name", "lead", "dueDate"])) setError(err);
    }
  });
  return (
    <Dialog
      open
      onClose={onClose}
      icon={<IconFolderPlus className="size-7" />}
      title={project ? "Edit project" : "New project"}
      description="Projects group tasks. Pick a lead to own it."
      actions={
        <>
          <Button variant="outlined" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void onSubmit()} loading={formState.isSubmitting} loadingText="Saving…">{project ? "Save project" : "Create project"}</Button>
        </>
      }
    >
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4 text-left">
        <Field label="Project name" required error={formState.errors.name?.message}>
          <TextInput placeholder="Storefront launch" {...register("name")} />
        </Field>
        <Field label="Lead" error={formState.errors.lead?.message}>
          <SelectInput {...register("lead")}>
            <option value="">No lead yet</option>
            {(people.data ?? []).map((p) => (
              <option key={p._id} value={p._id}>{p.name}</option>
            ))}
          </SelectInput>
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Due date">
            <TextInput type="date" {...register("dueDate")} />
          </Field>
          <Field label="Priority">
            <SelectInput {...register("priority")}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </SelectInput>
          </Field>
        </div>
        {project && (
          <Field label="Status">
            <SelectInput {...register("status")}>
              {Object.entries(PROJECT_STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </SelectInput>
          </Field>
        )}
        <Field label="Description">
          <TextInput placeholder="What this project delivers" {...register("description")} />
        </Field>
        <ErrorNote error={error} fallback="We couldn't save this project. Please try again." />
      </form>
    </Dialog>
  );
}

// ── 04.04 Projects overview ───────────────────────────────────────────────
export function ProjectsOverviewPage() {
  const navigate = useNavigate();
  const projects = useProjects();
  const stats = useProjectStats();
  const rules = useProjectRules();
  const [creating, setCreating] = useState(false);
  const s = stats.data;
  const list = (projects.data ?? []).filter((p) => p.status !== "cancelled");
  const first = list.find((p) => p.status === "active") ?? list[0];

  return (
    <div className="flex flex-col gap-6">
      <PageTitle actions={rules.canManage && <Button size="md" onClick={() => setCreating(true)}><IconPlus aria-hidden="true" className="size-icon" /> New project</Button>}>
        Projects overview
      </PageTitle>
      <IntroCard eyebrow="Projects / Team progress" title={rules.isStaff ? "Your tasks across projects." : "Keep your business projects on track."}>
        {rules.isStaff ? "You see the tasks assigned to you." : "Progress and deadlines update as your team moves tasks."}
      </IntroCard>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard tone="orders" label="Active projects" value={count(s?.active)} caption={s ? `${count(s.total)} in total` : "—"} />
        <KpiCard tone="invoices" label="Tasks in progress" value={count(s?.inProgressTasks)} caption={s ? `${count(s.todoTasks)} to do` : "—"} />
        <KpiCard tone="revenue" label="Completed tasks" value={count(s?.completedTasks)} caption={s ? `of ${count(s.totalTasks)} tasks` : "—"} />
        <KpiCard tone="stock" label="Upcoming deadlines" value={count(s?.upcomingDeadlines)} caption={s ? (s.overdueTasks ? `${count(s.overdueTasks)} overdue` : `Next ${s.upcomingDays} days`) : "—"} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel title="Projects in progress">
          {projects.isLoading ? (
            <Loading />
          ) : projects.error ? (
            <ErrorNote error={projects.error} fallback="We couldn't load your projects. Please try again." onRetry={() => void projects.refetch()} />
          ) : list.length === 0 ? (
            <EmptyState
              icon={<IconFolderPlus className="size-7" />}
              title={rules.isStaff ? "No tasks assigned to you yet" : "No projects yet"}
              body={rules.isStaff ? "When someone assigns you a task, it appears here." : "Create a project, then add tasks and assign them to your team."}
              action={rules.canManage ? <Button size="md" onClick={() => setCreating(true)}>New project</Button> : undefined}
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {list.map((p) => (
                <li key={p._id}>
                  <Link to={`/projects/${p._id}`} className="block rounded-lg bg-surface-pale px-4 py-4 hover:bg-surface-tonal">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-body-lg font-semibold text-ink-brand">{p.name}</span>
                      <span className="text-body-lg font-semibold text-ink-brand">· {p.progress.percent}%</span>
                      {p.status !== "active" && <Status tone={PROJECT_STATUS[p.status].tone}>{PROJECT_STATUS[p.status].label}</Status>}
                    </div>
                    <p className="mt-2 text-body-sm text-ink-muted">
                      Lead: {p.lead?.name ?? "Not set"} · {count(p.progress.completed)} of {count(p.progress.total)} tasks done{p.dueDate ? ` · Due ${shortDate(p.dueDate)}` : ""}
                    </p>
                    <div className="mt-3">
                      <ProgressBar percent={p.progress.percent} label={`${p.name} progress`} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel tone="pale" title="What needs your attention?">
          <dl className="flex flex-col gap-7">
            <div>
              <dt><Link to="/projects/calendar" className="text-body-lg font-semibold text-ink-brand hover:underline">Review deadlines</Link></dt>
              <dd className="mt-1 text-body-sm text-ink-muted">{s?.overdueTasks ? `${count(s.overdueTasks)} task${s.overdueTasks === 1 ? " is" : "s are"} overdue. ` : ""}See upcoming deliverables on the calendar.</dd>
            </div>
            {rules.canManage && (
              <div>
                <dt className="text-body-lg font-semibold text-ink-brand">Assign task owners</dt>
                <dd className="mt-1 text-body-sm text-ink-muted">Choose assignees, priority and checklists when you add a task.</dd>
              </div>
            )}
            <div>
              <dt className="text-body-lg font-semibold text-ink-brand">Move work forward</dt>
              <dd className="mt-1 text-body-sm text-ink-muted">Track progress on each project's board.</dd>
            </div>
          </dl>
          {first && (
            <Button fullWidth className="mt-6" onClick={() => navigate(`/projects/${first._id}`)}>
              Open task board <IconArrowRight aria-hidden="true" className="size-4" />
            </Button>
          )}
        </Panel>
      </div>
      {creating && <ProjectDialog onClose={() => setCreating(false)} onSaved={(p) => navigate(`/projects/${p._id}`)} />}
    </div>
  );
}

// ── Board (04.06) with create (04.02) / edit (04.08) panels ───────────────
function Tabs({ projectId }: { projectId: string }) {
  const rules = useProjectRules();
  const tab = (to: string, label: string, end = false) => (
    <NavLink end={end} to={to} className={({ isActive }) => cn("rounded-md px-3 py-2 text-body-sm font-medium", isActive ? "bg-surface-tint-blue font-semibold text-ink-brand" : "text-ink-secondary hover:text-ink-brand")}>
      {label}
    </NavLink>
  );
  return (
    <nav aria-label="Project views" className="flex flex-wrap gap-1 rounded-lg border border-line-card bg-surface-card p-2">
      {tab(`/projects/${projectId}`, "Board", true)}
      {tab("/projects/calendar", "Calendar")}
      {tab("/projects", "Overview", true)}
      {rules.canManage && tab(`/projects/${projectId}/tasks/new`, "New task")}
    </nav>
  );
}

function TaskCard({ projectId, task }: { projectId: string; task: Task }) {
  const rules = useProjectRules();
  const update = useUpdateTask(projectId);
  const due = dueLabel(task);
  const done = task.subtasks.filter((s) => s.isCompleted).length;
  return (
    <li className="rounded-lg bg-surface-card p-3 shadow-card">
      <Link to={`/projects/${projectId}/tasks/${task._id}`} className="block text-body-sm font-semibold text-ink-strong hover:underline">
        {task.title}
      </Link>
      <p className={cn("mt-3 text-caption", due?.overdue ? "font-semibold text-danger" : "text-ink-muted")}>
        {task.status === "completed" ? "Completed" : PRIORITY_LABEL[task.priority]}
        {due && task.status !== "completed" ? ` · ${due.text}${due.overdue ? " (overdue)" : ""}` : ""}
        {task.subtasks.length ? ` · ${done}/${task.subtasks.length} checklist` : ""}
      </p>
      <p className="mt-2 text-caption font-medium text-ink-brand">Assigned: {task.assignedTo?.name ?? "No one yet"}</p>
      {rules.canMove(task) && (
        <label className="mt-3 flex items-center gap-2 text-caption text-ink-muted">
          <span className="sr-only">Move {task.title} to</span>
          <select
            value={task.status}
            disabled={update.isPending}
            onChange={(e) => update.mutate({ taskId: task._id, status: e.target.value as TaskStatus })}
            className="h-8 w-full rounded-sm border border-line-default bg-surface-card px-2 text-caption text-ink-strong"
          >
            {STATUS_COLUMNS.map(([s, l]) => (
              <option key={s} value={s}>{l}</option>
            ))}
          </select>
        </label>
      )}
    </li>
  );
}

function Kanban({ project }: { project: Project }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {STATUS_COLUMNS.map(([status, label]) => {
        const tasks = project.tasks.filter((t) => t.status === status);
        return (
          <section key={status} aria-label={`${label} column`} className="min-h-40 rounded-lg bg-surface-pale p-2">
            <h3 className="px-1 py-2 text-caption font-semibold uppercase text-ink-brand">
              {label} · {tasks.length}
            </h3>
            {tasks.length === 0 ? (
              <p className="px-1 py-3 text-caption text-ink-muted">Nothing here.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {tasks.map((t) => (
                  <TaskCard key={t._id} projectId={project._id} task={t} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

const taskSchema = z.object({
  title: z.string().trim().min(2, "Give the task a title (at least 2 characters).").max(100),
  assignedTo: z.string(),
  dueDate: z.string(),
  priority: z.enum(["low", "medium", "high"]),
  status: z.enum(["todo", "in_progress", "completed"]),
  checklist: z.string().max(3000),
  notes: z.string().trim().max(500),
});
type TaskValues = z.infer<typeof taskSchema>;

/** Create (04.02) and edit (04.08) form. */
function TaskForm({ project, task }: { project: Project; task?: Task }) {
  const navigate = useNavigate();
  const rules = useProjectRules();
  const people = usePeople();
  const add = useAddTask(project._id);
  const update = useUpdateTask(project._id);
  const del = useDeleteTask(project._id);
  const subtasks = useSubtasks(project._id, task?._id ?? "");
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const staffOnly = rules.isStaff; // staff: status and notes only
  const { register, handleSubmit, reset, setError: setFieldError, formState } = useForm<TaskValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: "", assignedTo: "", dueDate: "", priority: "medium", status: "todo", checklist: "", notes: "" },
  });
  const guard = useLeaveGuard(formState.isDirty && !formState.isSubmitSuccessful);
  useEffect(() => {
    reset({
      title: task?.title ?? "",
      assignedTo: task?.assignedTo?._id ?? "",
      dueDate: task?.dueDate ? task.dueDate.slice(0, 10) : "",
      priority: task?.priority ?? "medium",
      status: task?.status ?? "todo",
      checklist: "",
      notes: task?.notes ?? "",
    }, { keepDirtyValues: true });
    setSaved(false);
  }, [task, reset]);

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    setSaved(false);
    try {
      if (task) {
        const body = staffOnly
          ? { status: v.status, notes: v.notes }
          : { title: v.title, assignedTo: v.assignedTo || null, dueDate: v.dueDate || null, priority: v.priority, status: v.status, notes: v.notes };
        await update.mutateAsync({ taskId: task._id, ...body });
        setSaved(true);
      } else {
        const items = v.checklist.split("\n").map((s) => s.trim()).filter(Boolean);
        const created = await add.mutateAsync({ title: v.title, assignedTo: v.assignedTo || null, dueDate: v.dueDate || null, priority: v.priority, status: v.status, notes: v.notes || undefined, subtasks: items.length ? items : undefined });
        guard.allow();
        navigate(`/projects/${project._id}/tasks/${created._id}/added`, { replace: true });
      }
    } catch (err) {
      if (!applyFieldErrors(err, setFieldError, ["title", "assignedTo", "dueDate", "priority", "status", "notes"])) setError(err);
    }
  });

  return (
    <Panel tone="pale" title={task ? "Edit task details" : "Create a task"}>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        {guard.dialog}
        <Field label="Title" required error={formState.errors.title?.message}>
          <TextInput placeholder="Enter task name" disabled={staffOnly && Boolean(task)} {...register("title")} />
        </Field>
        <Field label="Assignee" error={formState.errors.assignedTo?.message}>
          <SelectInput disabled={staffOnly} {...register("assignedTo")}>
            <option value="">Choose team member</option>
            {(people.data ?? []).map((p) => (
              <option key={p._id} value={p._id}>{p.name}</option>
            ))}
          </SelectInput>
        </Field>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 desktop:grid-cols-2">
          <Field label="Due date">
            <TextInput type="date" disabled={staffOnly} {...register("dueDate")} />
          </Field>
          <Field label="Priority">
            <SelectInput disabled={staffOnly} {...register("priority")}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </SelectInput>
          </Field>
        </div>
        <Field label="Status">
          <SelectInput {...register("status")}>
            {STATUS_COLUMNS.map(([s, l]) => (
              <option key={s} value={s}>{l}</option>
            ))}
          </SelectInput>
        </Field>
        {task ? (
          <div>
            <p className="text-caption font-semibold uppercase text-ink-brand">Subtasks</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {task.subtasks.map((s) => (
                <li key={s._id} className="flex items-center gap-2 rounded-md bg-surface-card px-3 py-2">
                  <input type="checkbox" className="size-4 accent-brand-navy" checked={s.isCompleted} aria-label={`Done: ${s.title}`} onChange={() => subtasks.toggle.mutate(s)} />
                  <span className={cn("flex-1 text-body-sm", s.isCompleted ? "text-ink-muted line-through" : "text-ink-strong")}>{s.title}</span>
                  <button type="button" aria-label={`Remove ${s.title}`} onClick={() => subtasks.remove.mutate(s._id)} className="text-ink-muted hover:text-danger">
                    <IconTrash aria-hidden="true" className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <label className="flex-1">
                <span className="sr-only">New checklist item</span>
                <input
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newItem.trim()) {
                      e.preventDefault();
                      subtasks.add.mutate(newItem.trim(), { onSuccess: () => setNewItem("") });
                    }
                  }}
                  placeholder="Add checklist item"
                  className="h-control-sm w-full rounded-sm border border-line-default bg-surface-card px-3 text-body-sm"
                />
              </label>
              <Button size="md" variant="secondary" disabled={!newItem.trim() || subtasks.add.isPending} onClick={() => subtasks.add.mutate(newItem.trim(), { onSuccess: () => setNewItem("") })}>
                Add
              </Button>
            </div>
          </div>
        ) : (
          <Field label="Subtasks" hint="One checklist item per line.">
            <TextArea rows={3} placeholder={"Add checklist items\nOne per line"} {...register("checklist")} />
          </Field>
        )}
        <Field label="Notes">
          <TextArea rows={3} placeholder="Task description" {...register("notes")} />
        </Field>
        <ErrorNote error={error} fallback="We couldn't save this task. Please try again." onRetry={() => void onSubmit()} />
        {saved && <p role="status" className="text-body-sm text-success">Changes saved.</p>}
        <Button type="submit" fullWidth loading={formState.isSubmitting} loadingText="Saving…">
          {task ? "Save changes" : "Create task"}
        </Button>
        {task && rules.canManage && (
          <Button variant="secondary" fullWidth className="text-danger" onClick={() => setConfirmDelete(true)}>
            <IconTrash aria-hidden="true" className="size-icon" /> Delete task
          </Button>
        )}
      </form>
      {task && confirmDelete && (
        <Dialog
          open
          onClose={() => setConfirmDelete(false)}
          tone="danger"
          icon={<IconTrash className="size-7" />}
          title={`Delete "${task.title}"?`}
          description="The task and its checklist will be removed. This can't be undone."
          actions={
            <>
              <Button variant="outlined" onClick={() => setConfirmDelete(false)}>Keep task</Button>
              <Button
                variant="destructive"
                loading={del.isPending}
                loadingText="Deleting…"
                onClick={async () => {
                  try {
                    await del.mutateAsync(task._id);
                    guard.allow();
                    navigate(`/projects/${project._id}`, { replace: true });
                  } catch (err) {
                    setConfirmDelete(false);
                    setError(err);
                  }
                }}
              >
                Delete task
              </Button>
            </>
          }
        />
      )}
    </Panel>
  );
}

export function ProjectBoardPage({ mode = "board" }: { mode?: "board" | "new" | "edit" }) {
  const { id, taskId } = useParams();
  const navigate = useNavigate();
  const project = useProject(id);
  const rules = useProjectRules();
  const [editing, setEditing] = useState(false);
  if (project.isLoading) return <Loading />;
  if (!project.data) return <ErrorNote error={project.error ?? true} fallback="We couldn't load this project. Please try again." onRetry={() => void project.refetch()} />;
  const p = project.data;
  const task = mode === "edit" ? p.tasks.find((t) => t._id === taskId) : undefined;
  const side = mode === "new" ? rules.canManage : mode === "edit" && Boolean(task);
  const title = mode === "new" ? "Projects — Create task" : mode === "edit" ? "Projects — Edit task" : "Projects — Kanban board";

  return (
    <div className="flex flex-col gap-6">
      <PageTitle actions={rules.canManage && mode === "board" && <Button size="md" variant="secondary" onClick={() => setEditing(true)}>Edit project</Button>}>{title}</PageTitle>
      <IntroCard eyebrow="Projects / Task workspace" title="Move work forward as a team.">
        Assign tasks, plan deadlines and track progress from To do to Done.
      </IntroCard>
      <Tabs projectId={p._id} />
      {mode === "edit" && !task && <ErrorNote error={true} fallback="That task no longer exists. It may have been deleted." />}
      <div className={cn("grid gap-5", side && "lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]")}>
        <Panel>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-title-sm text-ink-strong">
              {p.name}
              {p.lead && <span className="text-body-sm font-normal text-ink-muted"> · Lead: {p.lead.name}</span>}
            </h2>
            <span className="text-body-sm text-ink-muted">{p.progress.percent}% done · {count(p.progress.total)} tasks</span>
          </div>
          {p.tasks.length === 0 ? (
            <EmptyState
              icon={<IconPlus className="size-7" />}
              title="No tasks yet"
              body={rules.canManage ? "Add the first task and assign it to someone." : "Tasks assigned to you will appear here."}
              action={rules.canManage && mode !== "new" ? <ButtonLink to={`/projects/${p._id}/tasks/new`} size="md">New task</ButtonLink> : undefined}
            />
          ) : (
            <Kanban project={p} />
          )}
        </Panel>
        {side && <TaskForm project={p} task={task} />}
      </div>
      {mode === "board" && <InfoStrip title="Stay on top of daily work">Move cards between To do, In progress and Done. Teammates are notified about work assigned to them.</InfoStrip>}
      {editing && <ProjectDialog project={p} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); void navigate(`/projects/${p._id}`); }} />}
    </div>
  );
}

export const NewTaskPage = () => <ProjectBoardPage mode="new" />;
export const EditTaskPage = () => <ProjectBoardPage mode="edit" />;

// 04.07 Task added
export function TaskAddedPage() {
  const { id, taskId } = useParams();
  const project = useProject(id);
  if (project.isLoading) return <Loading />;
  const task = project.data?.tasks.find((t) => t._id === taskId);
  if (!project.data || !task) return <ErrorNote error={project.error ?? true} fallback="We couldn't load this task." onRetry={() => void project.refetch()} />;
  const due = dueLabel(task);
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Task added</PageTitle>
      <section className="rounded-2xl bg-success-bg px-5 py-4 shadow-card lg:px-6 lg:py-5">
        <p className="text-caption font-semibold uppercase text-success">{STATUS_COLUMNS.find(([s]) => s === task.status)?.[1]}</p>
        <h2 className="mt-2 text-section-title text-ink-strong">“{task.title}” is on the {project.data.name} board.</h2>
        <p className="mt-2 text-body-sm text-ink-muted">{task.assignedTo ? `${task.assignedTo.name} has been notified.` : "Assign it to someone so it gets done."}</p>
      </section>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Task summary">
          <dl className="grid grid-cols-[minmax(0,8rem)_1fr] gap-x-4 gap-y-3 text-body-lg">
            <dt className="text-ink-muted">Assignee</dt>
            <dd className="text-ink-strong">{task.assignedTo?.name ?? "No one yet"}</dd>
            <dt className="text-ink-muted">Priority</dt>
            <dd className="text-ink-strong">{PRIORITY_LABEL[task.priority]}</dd>
            <dt className="text-ink-muted">Due</dt>
            <dd className="text-ink-strong">{due ? due.text.replace("Due ", "") : "No due date"}</dd>
            <dt className="text-ink-muted">Checklist</dt>
            <dd className="text-ink-strong">{task.subtasks.length ? `${task.subtasks.length} item${task.subtasks.length === 1 ? "" : "s"}` : "None"}</dd>
          </dl>
          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <ButtonLink to={`/projects/${project.data._id}`} className="md:flex-1">Back to board</ButtonLink>
            <ButtonLink to={`/projects/${project.data._id}/tasks/new`} variant="secondary" className="md:flex-1">Add another task</ButtonLink>
          </div>
          <Link to={`/projects/${project.data._id}/tasks/${task._id}`} className="mt-4 inline-block text-body-sm font-semibold text-ink-brand hover:underline">Edit this task</Link>
        </Panel>
        <InfoStrip title="Good to know">Move the card across the board as work progresses. Overdue tasks are flagged on the board and calendar.</InfoStrip>
      </div>
    </div>
  );
}

// ── 04.03 Calendar ────────────────────────────────────────────────────────
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function ProjectsCalendarPage() {
  const navigate = useNavigate();
  // ?month=2026-11 keeps the month across Back and refresh.
  const [monthKey, setMonthKey] = useUrlState<string>("month", "");
  const month = useMemo(() => {
    const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
    const d = new Date();
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, 1) : new Date(d.getFullYear(), d.getMonth(), 1);
  }, [monthKey]);
  const setMonth = (d: Date) => {
    const now = new Date();
    const isNow = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    setMonthKey(isNow ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const start = month;
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
  const tasks = useCalendarTasks(iso(start), end.toISOString());
  const upcoming = useUpcomingTasks();
  const projects = useProjects();
  const todayKey = iso(new Date());

  const byDay = useMemo(() => {
    const m = new Map<string, typeof tasks.data>();
    for (const t of tasks.data ?? []) {
      if (!t.dueDate) continue;
      const k = iso(new Date(t.dueDate));
      m.set(k, [...(m.get(k) ?? []), t]);
    }
    return m;
  }, [tasks.data]);

  // Monday-first grid.
  const lead = (start.getDay() + 6) % 7;
  const days = end.getDate();
  const cells: Array<Date | null> = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  while (cells.length % 7) cells.push(null);
  const label = month.toLocaleDateString("en-NG", { month: "long", year: "numeric" });
  const next = (upcoming.data ?? []).filter((t) => t.status !== "completed").slice(0, 5);
  const firstProject = (projects.data ?? []).find((p) => p.status === "active");

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Projects calendar</PageTitle>
      <IntroCard eyebrow="Projects / Team deadlines" title="A clear look at upcoming tasks and milestones." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-title-sm text-ink-brand" aria-live="polite">{label}</h2>
            <div className="flex gap-1">
              <button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-md p-2 text-ink-brand hover:bg-surface-pale">
                <IconChevronLeft aria-hidden="true" className="size-icon" />
              </button>
              <button type="button" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }} className="rounded-md px-3 py-2 text-body-sm font-semibold text-ink-brand hover:bg-surface-pale">
                Today
              </button>
              <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-md p-2 text-ink-brand hover:bg-surface-pale">
                <IconChevronRight aria-hidden="true" className="size-icon" />
              </button>
            </div>
          </div>
          {tasks.error && <ErrorNote error={tasks.error} fallback="We couldn't load the calendar. Please try again." onRetry={() => void tasks.refetch()} />}
          <div role="grid" aria-label={`Tasks due in ${label}`} className="overflow-hidden rounded-lg bg-surface-pale">
            <div role="row" className="grid grid-cols-7 text-caption font-medium text-ink-muted">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <span role="columnheader" key={d} className="px-1 py-2 text-center md:px-2 md:text-left">{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px bg-surface-card">
              {cells.map((d, i) => {
                if (!d) return <div key={`e${i}`} role="gridcell" className="min-h-16 bg-surface-pale md:min-h-24" />;
                const k = iso(d);
                const items = byDay.get(k) ?? [];
                return (
                  <div key={k} role="gridcell" aria-label={`${d.toLocaleDateString("en-NG", { day: "numeric", month: "long" })}${items.length ? `, ${items.length} task${items.length === 1 ? "" : "s"} due` : ""}`} className={cn("min-h-16 min-w-0 p-1 md:min-h-24 md:p-2", k === todayKey ? "bg-success-bg" : "bg-surface-pale")}>
                    <span className="text-caption font-semibold text-ink-brand">{d.getDate()}</span>
                    <ul className="mt-1 flex flex-col gap-1">
                      {items.slice(0, 3).map((t) => (
                        <li key={t._id}>
                          <Link
                            to={`/projects/${t.project._id}/tasks/${t._id}`}
                            className={cn("block truncate rounded-sm px-1 text-micro md:text-caption", t.status === "completed" ? "text-ink-muted line-through" : "font-medium text-ink-brand hover:underline")}
                            title={`${t.title} · ${t.project.name}`}
                          >
                            {t.title}
                          </Link>
                        </li>
                      ))}
                      {items.length > 3 && <li className="px-1 text-micro text-ink-muted">+{items.length - 3} more</li>}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>
        <Panel tone="pale" title="Upcoming tasks">
          {upcoming.isLoading ? (
            <Loading />
          ) : next.length === 0 ? (
            <p className="py-4 text-body-lg text-ink-secondary">No upcoming deadlines.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {next.map((t) => (
                <li key={t._id}>
                  <Link to={`/projects/${t.project._id}/tasks/${t._id}`} className="block rounded-lg bg-surface-card px-4 py-3 hover:bg-surface-tonal">
                    <p className="text-caption font-semibold uppercase text-ink-brand">{t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : ""}</p>
                    <p className="mt-1 text-body-lg font-semibold text-ink-brand">{t.title}</p>
                    <p className="mt-1 text-body-sm text-ink-muted">{[t.assignedTo?.name, PRIORITY_LABEL[t.priority], t.project.name].filter(Boolean).join(" · ")}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {firstProject && (
            <Button fullWidth className="mt-5" onClick={() => navigate(`/projects/${firstProject._id}`)}>
              Open task board <IconArrowRight aria-hidden="true" className="size-4" />
            </Button>
          )}
        </Panel>
      </div>
    </div>
  );
}

