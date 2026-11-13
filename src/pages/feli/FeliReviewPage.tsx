import { useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconCircleCheck, IconPlus, IconSparkles, IconTrash } from "@tabler/icons-react";
import { Button, ButtonLink, EmptyState, Field, SelectInput, Spinner, TextArea, TextInput } from "@/components/ui";
import { HelpPanel, IntroCard, PageTitle, Panel } from "@/components/page/Blocks";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { ApiError } from "@/lib/api/client";
import { applyFieldErrors } from "@/lib/api/errorMessage";
import { safeLink } from "@/lib/notifications/api";
import { categoryLabel, priorityLabel } from "@/lib/support/api";
import { useProjects } from "@/lib/projects/api";
import { usePeople } from "@/lib/team/api";
import { naira, shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { actionLabel, proposalsOf, restrictionOf, useCancelFeliAction, useConfirmFeliAction, useFeliHistory, type FeliProposal, type FeliResult } from "@/lib/feli/api";
import { RestrictionCard } from "./FeliStates";

// 11.01 Action proposal review, 11.02 Create task review, and the invoice
// draft review. Nothing changes until "Approve"; the person's edits are sent
// with the approval and win over FELI's draft.

type Approve = (params: Record<string, unknown>) => Promise<unknown>;

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

interface Item {
  description: string;
  quantity: number;
  unitPrice: number;
}
const itemsOf = (v: unknown): Item[] =>
  Array.isArray(v) ? v.map((i) => ({ description: str(i?.description), quantity: Number(i?.quantity) || 0, unitPrice: Number(i?.unitPrice) || 0 })) : [];

/** Subtotal, tax (percent) and total, rounded like the invoice editor. */
export function invoiceTotals(items: Array<{ quantity: number; unitPrice: number }>, taxPercent: number) {
  const subtotal = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const tax = Math.round(subtotal * (Number(taxPercent) || 0)) / 100;
  return { subtotal, tax, total: subtotal + tax };
}

const FIELD_LABELS: Record<string, string> = {
  subject: "Subject",
  message: "Message",
  category: "Category",
  priority: "Priority",
  title: "Task name",
  description: "Description",
  dueDate: "Due date",
  notes: "Notes",
  projectId: "Project",
  assignedTo: "Assigned teammate",
  clientName: "Client",
  clientEmail: "Client email",
  clientPhone: "Client phone",
  items: "Items",
  tax: "Tax",
  invoiceId: "Invoice",
  to: "Send to",
  orderId: "Order",
  paymentStatus: "Payment",
  fulfilmentStatus: "Fulfilment",
};
export const fieldLabel = (k: string) => FIELD_LABELS[k] ?? cap(k.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase());

/** FELI's params as readable label/value rows. */
export type NameLookup = { projects?: Array<{ _id: string; name: string }>; people?: Array<{ _id: string; name: string }> };
const nameOf = (list: Array<{ _id: string; name: string }> | undefined, id: string) => list?.find((x) => x._id === id)?.name ?? "Chosen by FELI";

/** The project and teammate lists, for showing names instead of ids. */
export function useNameLookup(enabled: boolean): NameLookup {
  const projects = useProjects(enabled);
  const people = usePeople(enabled);
  return { projects: projects.data, people: people.data };
}

export function paramRows(p: FeliProposal, names: NameLookup = {}): Array<[string, ReactNode]> {
  const v = p.params;
  const rows: Array<[string, ReactNode]> = [];
  const add = (k: string, value: ReactNode) => {
    if (value !== "" && value !== null && value !== undefined) rows.push([fieldLabel(k), value]);
  };
  if (p.action === "create_invoice") {
    const items = itemsOf(v.items);
    add("clientName", str(v.clientName));
    if (items.length) {
      add("items", `${items.length} item${items.length === 1 ? "" : "s"}`);
      rows.push(["Total", naira(invoiceTotals(items, Number(v.tax) || 0).total)]);
    }
    add("dueDate", v.dueDate ? shortDate(str(v.dueDate)) : "");
    return rows;
  }
  for (const [k, raw] of Object.entries(v)) {
    const s = str(raw);
    if (k === "category") add(k, categoryLabel(s));
    else if (k === "priority") add(k, p.action === "open_support_ticket" ? priorityLabel(s) : cap(s));
    else if (k === "dueDate") add(k, s ? shortDate(s) : "");
    else if (k === "invoiceId") add(k, s ? <Link className="text-ink-brand underline" to={`/invoices/${encodeURIComponent(s)}`}>View the invoice</Link> : "");
    else if (k === "orderId") add(k, s ? <Link className="text-ink-brand underline" to={`/orders/${encodeURIComponent(s)}`}>View the order</Link> : "");
    else if (k === "projectId") add(k, s ? nameOf(names.projects, s) : "");
    else if (k === "assignedTo") add(k, s ? nameOf(names.people, s) : "");
    else if (k === "paymentStatus" || k === "fulfilmentStatus") add(k, cap(s));
    else add(k, s);
  }
  if (p.action === "create_task" && !str(v.projectId)) rows.push(["Project", "General (none chosen)"]);
  return rows;
}

const RESULT_LINK: Record<string, string> = { task: "Open the project", ticket: "View the ticket", invoice: "Open the invoice", order: "View the order" };

/** /feli/review?id=…: one suggestion at a time (a fresh page for each id). */
export function FeliReviewPage() {
  const [params] = useSearchParams();
  const id = params.get("id") ?? "";
  return <ReviewOne key={id} id={id} />;
}

function ReviewOne({ id }: { id: string }) {
  const history = useFeliHistory();
  const confirm = useConfirmFeliAction();
  const cancel = useCancelFeliAction();
  const navigate = useNavigate();
  const all = proposalsOf(history.data);
  const proposal = (id ? all.find((p) => p.id === id) : all[0]) ?? null;
  // After approving, offer the next suggestion that's still waiting.
  const next = all.find((p) => p.id !== id && p.id !== proposal?.id) ?? null;
  const restriction = restrictionOf(confirm.error);
  const handled = confirm.error instanceof ApiError && confirm.error.status === 409;
  const isTask = proposal?.action === "create_task";
  const isInvoice = proposal?.action === "create_invoice";

  const [doneAction, setDoneAction] = useState("");
  const approve: Approve = (params) => {
    setDoneAction(proposal!.action);
    return confirm.mutateAsync({ proposalId: proposal!.id, params });
  };
  const onCancel = () => cancel.mutate(proposal?.id, { onSuccess: () => navigate("/feli") });

  const title = isTask ? "FELI task creation review" : isInvoice ? "FELI invoice draft review" : "Review FELI suggested action";
  const header = (
    <>
      <PageTitle>{title}</PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">{isTask ? "Confirm the task name, project, teammate and due date." : isInvoice ? "Check the client, items and totals before saving the draft." : "Understand exactly what FELI will create or change."}</p>
    </>
  );

  let body: ReactNode;
  if (confirm.data) body = <ResultCard result={confirm.data.result} action={doneAction} nextId={next?.id} />;
  else if (restriction) body = <RestrictionCard restriction={restriction} />;
  else if (handled)
    body = (
      <EmptyState
        icon={<IconSparkles className="size-7" />}
        title="This suggestion has already been handled"
        body="It may have been approved, cancelled or replaced by a newer one. Ask FELI again if you still need it."
        action={<ButtonLink to="/feli" size="md">Back to FELI</ButtonLink>}
      />
    );
  else if (history.isLoading)
    body = (
      <div className="flex justify-center py-16 text-ink-brand" role="status">
        <Spinner className="size-8" />
        <span className="sr-only">Loading the suggestion…</span>
      </div>
    );
  else if (history.error) body = <ErrorNote error={history.error} fallback="We couldn't load FELI's suggestion." onRetry={() => void history.refetch()} />;
  else if (!proposal)
    body = (
      <EmptyState
        icon={<IconSparkles className="size-7" />}
        title="Nothing waiting for review"
        body="When FELI suggests an action, you'll review it here before anything changes."
        action={<ButtonLink to="/feli" size="md">Back to FELI</ButtonLink>}
      />
    );
  else
    body = (
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="flex min-w-0 flex-col gap-5">
          {isTask ? (
            <TaskReview key={proposal.id} proposal={proposal} approve={approve} onCancel={onCancel} cancelling={cancel.isPending} />
          ) : isInvoice ? (
            <InvoiceReview key={proposal.id} proposal={proposal} approve={approve} onCancel={onCancel} cancelling={cancel.isPending} />
          ) : (
            <GenericReview proposal={proposal} approve={approve} onCancel={onCancel} cancelling={cancel.isPending} />
          )}
          <ErrorNote error={cancel.error} fallback="We couldn't cancel the suggestion. Please try again." />
        </div>
        <HelpPanel
          items={
            isTask
              ? [
                  ["Plan requirement", "Standard or Premium"],
                  ["Projects", "Appears on the project's board"],
                  ["Notifications", "The assigned teammate is notified"],
                ]
              : isInvoice
                ? [
                    ["Plan requirement", "Premium"],
                    ["Status", "Saved as a draft"],
                    ["Sending", "Nothing goes to the client until you send it"],
                  ]
                : [
                    ["Plan access", proposal.requiredPlan === "premium" ? "Premium actions" : "Standard and Premium actions"],
                    ["You're in control", "Nothing changes until you approve"],
                    ["Record", "FELI notes what it did in your conversation"],
                  ]
          }
          callout={{ title: "Plan permissions", body: "What FELI can do depends on your plan and your role in the business." }}
        />
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      {header}
      <IntroCard eyebrow="Workspace / FELI AI" title={isTask ? "Task actions need an eligible plan and your approval." : "FELI asks before taking any business action."} />
      {body}
    </div>
  );
}

function ReviewSteps() {
  return (
    <div className="rounded-xl bg-surface-pale px-4 py-4">
      <p className="text-caption font-semibold uppercase text-ink-brand">AI action review</p>
      <p className="mt-2 text-body-sm text-ink-strong">Confirm any suggested action before it changes your business records.</p>
      <ol className="mt-2 flex flex-col gap-1 text-body-sm text-ink-muted">
        <li>01 Review the suggested action</li>
        <li>02 Check your plan and permissions</li>
        <li>03 Approve, or go back to the chat</li>
      </ol>
    </div>
  );
}

function Actions({ submitLabel, loading, onCancel, cancelling, disabled, submit = true, onApprove }: { submitLabel: string; loading: boolean; onCancel: () => void; cancelling: boolean; disabled?: boolean; submit?: boolean; onApprove?: () => void }) {
  return (
    <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end">
      <Button variant="outlined" onClick={onCancel} loading={cancelling} loadingText="Cancelling…">
        Cancel suggestion
      </Button>
      <Button type={submit ? "submit" : "button"} onClick={onApprove} disabled={disabled} loading={loading} loadingText="Approving…">
        {submitLabel}
      </Button>
    </div>
  );
}

// ── 11.01 Read-only review ───────────────────────────────────────────────
function GenericReview({ proposal, approve, onCancel, cancelling }: { proposal: FeliProposal; approve: Approve; onCancel: () => void; cancelling: boolean }) {
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const missing = proposal.missing ?? [];
  const rows: Array<[string, ReactNode]> = [["Requested action", proposal.label || actionLabel(proposal.action)], ...(proposal.module ? ([["Affected module", proposal.module]] as Array<[string, ReactNode]>) : []), ...paramRows(proposal)];
  const onApprove = async () => {
    setError(null);
    setBusy(true);
    try {
      await approve(proposal.params);
    } catch (err) {
      if (!(err instanceof ApiError && (err.status === 409 || restrictionOf(err)))) setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel title="Action request and permission" subtitle="Review the details before you approve.">
      <div className="flex flex-col gap-5">
        <dl className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {rows.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-field-label uppercase text-ink-secondary">{k}</dt>
              <dd className="mt-1.5 whitespace-pre-wrap break-words rounded-sm border border-line-default px-4 py-3 text-body-sm text-ink-strong [overflow-wrap:anywhere]">{v}</dd>
            </div>
          ))}
        </dl>
        {missing.length > 0 && (
          <p role="alert" className="rounded-lg bg-warning-bg px-4 py-3 text-body-sm text-warning">
            FELI still needs: {missing.map(fieldLabel).join(", ")}. Go back and tell FELI, then review the new suggestion.
          </p>
        )}
        <ReviewSteps />
        <ErrorNote error={error} fallback="That didn't work. Please check the details and try again." />
        <Actions submit={false} submitLabel="Approve action" loading={busy} disabled={missing.length > 0} onApprove={() => void onApprove()} onCancel={onCancel} cancelling={cancelling} />
      </div>
    </Panel>
  );
}

// ── 11.02 Create task review ─────────────────────────────────────────────
const taskSchema = z.object({
  title: z.string().trim().min(2, "Give the task a name (at least 2 characters).").max(100, "Keep the name under 100 characters."),
  description: z.string().trim().max(500, "Keep the description under 500 characters."),
  priority: z.enum(["low", "medium", "high"]),
  dueDate: z.string(),
  notes: z.string().trim().max(500, "Keep notes under 500 characters."),
  projectId: z.string(),
  assignedTo: z.string(),
});
type TaskValues = z.infer<typeof taskSchema>;
const TASK_FIELDS = ["title", "description", "priority", "dueDate", "notes", "projectId", "assignedTo"] as const;

function TaskReview(props: { proposal: FeliProposal; approve: Approve; onCancel: () => void; cancelling: boolean }) {
  const projects = useProjects();
  const people = usePeople();
  // The pickers must show FELI's choice, so the form waits for both lists
  // (a select drawn before its options exist shows the wrong choice).
  if (projects.isLoading || people.isLoading)
    return (
      <div className="flex justify-center py-16 text-ink-brand" role="status">
        <Spinner className="size-8" />
        <span className="sr-only">Loading projects and teammates…</span>
      </div>
    );
  return <TaskForm {...props} projects={projects} people={people} />;
}

function TaskForm({
  proposal,
  approve,
  onCancel,
  cancelling,
  projects,
  people,
}: {
  proposal: FeliProposal;
  approve: Approve;
  onCancel: () => void;
  cancelling: boolean;
  projects: ReturnType<typeof useProjects>;
  people: ReturnType<typeof usePeople>;
}) {
  const p = proposal.params;
  const [error, setError] = useState<unknown>(null);
  const priority = str(p.priority);
  const { register, handleSubmit, setError: setFieldError, formState } = useForm<TaskValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: str(p.title),
      description: str(p.description),
      priority: priority === "low" || priority === "high" ? priority : "medium",
      dueDate: str(p.dueDate).slice(0, 10),
      notes: str(p.notes),
      projectId: str(p.projectId),
      assignedTo: str(p.assignedTo),
    },
  });
  // Open projects, plus FELI's pick even if it has since been completed.
  const open = (projects.data ?? []).filter((x) => (x.status !== "cancelled" && x.status !== "completed") || x._id === str(p.projectId));
  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await approve({ title: v.title, description: v.description, priority: v.priority, dueDate: v.dueDate || null, notes: v.notes, projectId: v.projectId || null, assignedTo: v.assignedTo || null });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 409 || restrictionOf(err))) return;
      if (!applyFieldErrors(err, setFieldError, TASK_FIELDS)) setError(err);
    }
  });
  const e = formState.errors;
  return (
    <Panel title="Proposed task details" subtitle="Review and edit the task before it's added to Projects.">
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Field label="Task name" required error={e.title?.message}>
            <TextInput placeholder="What needs doing?" {...register("title")} />
          </Field>
          <Field label="Assigned teammate" error={e.assignedTo?.message}>
            <SelectInput {...register("assignedTo")}>
              <option value="">No one yet</option>
              {(people.data ?? []).map((x) => (
                <option key={x._id} value={x._id}>
                  {x.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Project" error={e.projectId?.message} hint="No project chosen? The task goes to your General project (we create it if needed).">
            <SelectInput {...register("projectId")}>
              <option value="">General (no project)</option>
              {open.map((x) => (
                <option key={x._id} value={x._id}>
                  {x.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Priority" error={e.priority?.message}>
            <SelectInput {...register("priority")}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </SelectInput>
          </Field>
          <Field label="Due date" error={e.dueDate?.message}>
            <TextInput type="date" {...register("dueDate")} />
          </Field>
          <Field label="Notes" error={e.notes?.message}>
            <TextInput placeholder="Anything to remember" {...register("notes")} />
          </Field>
        </div>
        <Field label="Description" error={e.description?.message}>
          <TextArea rows={3} placeholder="Details for whoever picks this up" {...register("description")} />
        </Field>
        <ReviewSteps />
        <ErrorNote error={error} fallback="We couldn't create the task. Please check the details and try again." />
        <Actions submitLabel="Create task" loading={formState.isSubmitting} onCancel={onCancel} cancelling={cancelling} />
      </form>
    </Panel>
  );
}

// ── Invoice draft review ─────────────────────────────────────────────────
const isMoney = (v: string) => v.trim() !== "" && Number.isFinite(Number(v.replace(/[₦,\s]/g, ""))) && Number(v.replace(/[₦,\s]/g, "")) >= 0;
const toNum = (v: string) => Number(String(v).replace(/[₦,%\s]/g, "")) || 0;
const invoiceSchema = z.object({
  clientName: z.string().trim().min(1, "Enter the client's name.").max(120),
  clientEmail: z.string().trim().max(120).refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Enter a valid email."),
  clientPhone: z.string().trim().max(30),
  dueDate: z.string(),
  tax: z.string().refine((v) => !v.trim() || (Number.isFinite(toNum(v)) && toNum(v) >= 0 && toNum(v) <= 100), "Use a percentage from 0 to 100."),
  notes: z.string().trim().max(1000, "Keep notes under 1,000 characters."),
  items: z
    .array(
      z.object({
        description: z.string().trim().min(1, "Describe the item.").max(200),
        quantity: z.string().refine((v) => /^\d+$/.test(v.trim()) && Number(v) >= 1, "Use a whole number, 1 or more."),
        unitPrice: z.string().refine(isMoney, "Enter a price of ₦0 or more."),
      })
    )
    .min(1, "Add at least one item.")
    .max(50, "An invoice can have up to 50 items."),
});
type InvoiceValues = z.infer<typeof invoiceSchema>;
const INVOICE_FIELDS = ["clientName", "clientEmail", "clientPhone", "dueDate", "tax", "notes", "items"] as const;

function InvoiceReview({ proposal, approve, onCancel, cancelling }: { proposal: FeliProposal; approve: Approve; onCancel: () => void; cancelling: boolean }) {
  const p = proposal.params;
  const [error, setError] = useState<unknown>(null);
  const start = itemsOf(p.items);
  const { register, control, handleSubmit, watch, setError: setFieldError, formState } = useForm<InvoiceValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      clientName: str(p.clientName),
      clientEmail: str(p.clientEmail),
      clientPhone: str(p.clientPhone),
      dueDate: str(p.dueDate).slice(0, 10),
      tax: p.tax === undefined || p.tax === null ? "0" : str(p.tax),
      notes: str(p.notes),
      items: (start.length ? start : [{ description: "", quantity: 1, unitPrice: 0 }]).map((i) => ({ description: i.description, quantity: String(i.quantity || 1), unitPrice: String(i.unitPrice) })),
    },
  });
  const items = useFieldArray({ control, name: "items" });
  const watched = watch("items");
  const taxPercent = toNum(watch("tax") || "0");
  const totals = invoiceTotals(
    (watched ?? []).map((i) => ({ quantity: toNum(i.quantity), unitPrice: toNum(i.unitPrice) })),
    taxPercent
  );
  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await approve({
        clientName: v.clientName,
        clientEmail: v.clientEmail,
        clientPhone: v.clientPhone,
        items: v.items.map((i) => ({ description: i.description.trim(), quantity: Number(i.quantity), unitPrice: toNum(i.unitPrice) })),
        tax: toNum(v.tax || "0"),
        dueDate: v.dueDate || null,
        notes: v.notes,
      });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 409 || restrictionOf(err))) return;
      if (!applyFieldErrors(err, setFieldError, INVOICE_FIELDS)) setError(err);
    }
  });
  const e = formState.errors;
  const itemsError = e.items?.message ?? e.items?.root?.message;
  return (
    <Panel title="Proposed invoice draft" subtitle="Check the client, items and totals. You can edit anything.">
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <p className="rounded-lg bg-surface-tint-blue px-4 py-3 text-body-sm font-semibold text-ink-brand">Saved as a draft. Nothing is sent to the client.</p>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Field label="Client name" required error={e.clientName?.message}>
            <TextInput placeholder="Who is this for?" {...register("clientName")} />
          </Field>
          <Field label="Client email" error={e.clientEmail?.message}>
            <TextInput type="email" inputMode="email" {...register("clientEmail")} />
          </Field>
          <Field label="Client phone" error={e.clientPhone?.message}>
            <TextInput type="tel" inputMode="tel" {...register("clientPhone")} />
          </Field>
          <Field label="Due date" error={e.dueDate?.message}>
            <TextInput type="date" {...register("dueDate")} />
          </Field>
        </div>

        <fieldset className="flex min-w-0 flex-col gap-3">
          <legend className="text-caption font-semibold uppercase text-ink-brand">Items</legend>
          {items.fields.map((f, i) => {
            const ie = e.items?.[i];
            return (
              <div key={f.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 rounded-xl border border-line-card p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,0.7fr)_minmax(0,1fr)_auto] md:items-start">
                <Field label={`Item ${i + 1} description`} className="col-span-2 md:col-span-1" error={ie?.description?.message}>
                  <TextInput {...register(`items.${i}.description`)} />
                </Field>
                <Field label={`Item ${i + 1} quantity`} error={ie?.quantity?.message}>
                  <TextInput inputMode="numeric" {...register(`items.${i}.quantity`)} />
                </Field>
                <Field label={`Item ${i + 1} unit price (₦)`} error={ie?.unitPrice?.message}>
                  <TextInput inputMode="decimal" {...register(`items.${i}.unitPrice`)} />
                </Field>
                <Button variant="secondary" size="md" className="col-span-2 md:col-span-1 md:mt-6" disabled={items.fields.length <= 1} onClick={() => items.remove(i)} aria-label={`Remove item ${i + 1}`}>
                  <IconTrash aria-hidden="true" className="size-4" />
                  <span className="md:sr-only">Remove</span>
                </Button>
              </div>
            );
          })}
          {itemsError && (
            <p role="alert" className="text-body-sm text-danger">
              {itemsError}
            </p>
          )}
          <Button variant="outlined" size="md" className="self-start" disabled={items.fields.length >= 50} onClick={() => items.append({ description: "", quantity: "1", unitPrice: "0" })} icon={<IconPlus aria-hidden="true" className="size-4" />}>
            Add item
          </Button>
        </fieldset>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Field label="Tax (%)" error={e.tax?.message}>
            <TextInput inputMode="decimal" {...register("tax")} />
          </Field>
          <Field label="Notes" error={e.notes?.message}>
            <TextInput placeholder="Payment terms or a thank-you" {...register("notes")} />
          </Field>
        </div>

        <dl aria-label="Invoice totals" className="flex flex-col gap-2 rounded-xl bg-surface-pale px-4 py-4 text-body-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Subtotal</dt>
            <dd className="min-w-0 break-words text-right text-ink-strong">{naira(totals.subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Tax ({taxPercent}%)</dt>
            <dd className="min-w-0 break-words text-right text-ink-strong">{naira(totals.tax)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-line-card pt-2">
            <dt className="font-semibold uppercase text-ink-brand">Total</dt>
            <dd data-testid="invoice-total" className="min-w-0 break-words text-right text-title-sm text-ink-brand">{naira(totals.total)}</dd>
          </div>
        </dl>

        <ReviewSteps />
        <ErrorNote error={error} fallback="We couldn't save the draft. Please check the details and try again." />
        <Actions submitLabel="Save draft invoice" loading={formState.isSubmitting} onCancel={onCancel} cancelling={cancelling} />
      </form>
    </Panel>
  );
}

// ── Done ─────────────────────────────────────────────────────────────────
function ResultCard({ result, action, nextId }: { result: FeliResult; action: string; nextId?: string }) {
  const to = safeLink(result.link);
  return (
    <section aria-label="Action complete" className="flex min-w-0 flex-col items-start gap-3 rounded-2xl border border-line-card bg-surface-card p-6 shadow-card">
      <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-xl bg-success-bg text-success">
        <IconCircleCheck className="size-7" />
      </span>
      <h2 className="text-title-md text-ink-strong">Done</h2>
      <p className={cn("break-words text-body-lg text-ink-strong [overflow-wrap:anywhere]")}>
        {action === "create_invoice" ? `Draft invoice ${result.label} is saved. Nothing has been sent to the client.` : action === "send_invoice" ? `Invoice ${result.label} has been sent.` : result.kind === "task" ? `The task "${result.label}" has been added.` : result.kind === "ticket" ? `Support ticket ${result.label} is open.` : `${result.label}: done.`}
      </p>
      <div className="flex flex-wrap gap-3">
        {to && (
          <ButtonLink to={to} size="md">
            {RESULT_LINK[result.kind] ?? "Open it"}
          </ButtonLink>
        )}
        {nextId && (
          <ButtonLink to={`/feli/review?id=${encodeURIComponent(nextId)}`} size="md">
            Review the next suggestion
          </ButtonLink>
        )}
        <ButtonLink to="/feli" size="md" variant="outlined">
          Back to FELI
        </ButtonLink>
      </div>
    </section>
  );
}
