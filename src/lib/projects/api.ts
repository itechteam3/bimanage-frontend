import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { StatusTone } from "@/components/ui/Status";

// Projects & tasks (backend PR #19). One task system: tasks live in projects.

export type TaskStatus = "todo" | "in_progress" | "completed";
export type Priority = "low" | "medium" | "high";
export type ProjectStatus = "active" | "completed" | "on_hold" | "cancelled";

export interface PersonRef {
  _id: string;
  name: string;
  avatar?: string | null;
}

export interface Subtask {
  _id: string;
  title: string;
  isCompleted: boolean;
}

export interface Task {
  _id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  assignedTo: PersonRef | null;
  dueDate: string | null;
  subtasks: Subtask[];
  notes?: string;
  createdAt?: string;
}

export interface Progress {
  total: number;
  completed: number;
  inProgress: number;
  percent: number;
}

export interface Project {
  _id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  priority: Priority;
  startDate?: string | null;
  dueDate?: string | null;
  lead: PersonRef | null;
  members: PersonRef[];
  tasks: Task[];
  color?: string;
  progress: Progress;
  createdAt: string;
}

export interface ProjectStats {
  total: number;
  active: number;
  completed: number;
  onHold: number;
  cancelled: number;
  totalTasks: number;
  completedTasks: number;
  todoTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  upcomingDeadlines: number;
  upcomingDays: number;
}

export interface CalendarTask {
  _id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  assignedTo: PersonRef | null;
  subtasks: { total: number; done: number };
  project: { _id: string; name: string; color?: string };
}

export const STATUS_COLUMNS: Array<[TaskStatus, string]> = [
  ["todo", "To do"],
  ["in_progress", "In progress"],
  ["completed", "Done"],
];
export const PRIORITY_LABEL: Record<Priority, string> = { high: "High", medium: "Medium", low: "Low" };
export const PROJECT_STATUS: Record<ProjectStatus, { label: string; tone: StatusTone }> = {
  active: { label: "Active", tone: "success" },
  on_hold: { label: "On hold", tone: "warning" },
  completed: { label: "Completed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const projectKeys = {
  all: ["projects"] as const,
  list: ["projects", "list"] as const,
  stats: ["projects", "stats"] as const,
  one: (id: string) => ["projects", "one", id] as const,
  calendar: (from: string, to: string) => ["projects", "calendar", from, to] as const,
};

export const useProjects = (enabled = true) => useQuery({ queryKey: projectKeys.list, queryFn: () => api<Project[]>("/projects"), enabled });
export const useProjectStats = () => useQuery({ queryKey: projectKeys.stats, queryFn: () => api<ProjectStats>("/projects/stats") });
export const useProject = (id: string | undefined) =>
  useQuery({ queryKey: projectKeys.one(id ?? ""), queryFn: () => api<Project>(`/projects/${id}`), enabled: Boolean(id) });
export const useCalendarTasks = (from: string, to: string) =>
  useQuery({ queryKey: projectKeys.calendar(from, to), queryFn: () => api<CalendarTask[]>("/projects/tasks", { query: { from, to } }) });
export const useUpcomingTasks = () =>
  useQuery({ queryKey: ["projects", "upcoming"], queryFn: () => api<CalendarTask[]>("/projects/tasks", { query: { from: new Date().toISOString().slice(0, 10) } }) });

const useInvalidate = () => {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: projectKeys.all });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
};

export interface ProjectInput {
  name: string;
  description?: string;
  status?: ProjectStatus;
  priority?: Priority;
  dueDate?: string | null;
  lead?: string | null;
}

export function useSaveProject(id?: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: ProjectInput) => (id ? api<Project>(`/projects/${id}`, { method: "PUT", body: input }) : api<Project>("/projects", { method: "POST", body: input })),
    onSuccess: invalidate,
  });
}
export function useDeleteProject() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => api(`/projects/${id}`, { method: "DELETE" }), onSuccess: invalidate });
}

export interface TaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  assignedTo?: string | null;
  dueDate?: string | null;
  notes?: string;
  subtasks?: string[];
}

export function useAddTask(projectId: string) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (input: TaskInput) => api<Task>(`/projects/${projectId}/tasks`, { method: "POST", body: input }), onSuccess: invalidate });
}
export function useUpdateTask(projectId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ taskId, ...input }: TaskInput & { taskId: string }) => api<Task>(`/projects/${projectId}/tasks/${taskId}`, { method: "PUT", body: input }),
    onSuccess: invalidate,
  });
}
export function useDeleteTask(projectId: string) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (taskId: string) => api(`/projects/${projectId}/tasks/${taskId}`, { method: "DELETE" }), onSuccess: invalidate });
}
export function useSubtasks(projectId: string, taskId: string) {
  const invalidate = useInvalidate();
  const base = `/projects/${projectId}/tasks/${taskId}/subtasks`;
  return {
    add: useMutation({ mutationFn: (title: string) => api<Subtask>(base, { method: "POST", body: { title } }), onSuccess: invalidate }),
    toggle: useMutation({ mutationFn: (s: Subtask) => api<Subtask>(`${base}/${s._id}`, { method: "PUT", body: { isCompleted: !s.isCompleted } }), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id: string) => api(`${base}/${id}`, { method: "DELETE" }), onSuccess: invalidate }),
  };
}

/** "Due 23 Oct" with an overdue flag. */
export function dueLabel(t: Pick<Task, "dueDate" | "status">): { text: string; overdue: boolean } | null {
  if (!t.dueDate) return null;
  const d = new Date(t.dueDate);
  const overdue = t.status !== "completed" && d.getTime() < new Date().setHours(0, 0, 0, 0);
  return { text: `Due ${d.toLocaleDateString("en-NG", { day: "numeric", month: "short" })}`, overdue };
}
