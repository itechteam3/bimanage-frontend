import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconDownload, IconMail, IconPlus, IconTrash } from "@tabler/icons-react";
import { Button, ButtonLink, Dialog, Field, Spinner, Status, TextInput } from "@/components/ui";
import { InfoStrip, IntroCard, PageTitle, Panel } from "@/components/page/Blocks";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { useBusinessProfile } from "@/lib/workspace/api";
import {
  downloadInvoicePdf,
  invoiceBadge,
  isEmailUnavailable,
  useDeleteInvoice,
  useInvoice,
  useInvoices,
  useSaveInvoice,
  useSendInvoice,
  useSetInvoiceStatus,
  type Invoice,
  type InvoiceStatus,
} from "@/lib/sales/api";
import { saveBlob } from "@/lib/api/client";
import { applyFieldErrors } from "@/lib/api/errorMessage";
import { count, naira, shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";

const Loading = () => (
  <div className="flex justify-center py-16 text-ink-brand" role="status">
    <Spinner className="size-8" />
    <span className="sr-only">Loading…</span>
  </div>
);

const toDateInput = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

/** Download the server's PDF; returns an error to show, or null. */
function usePdfDownload() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const run = async (inv: Pick<Invoice, "_id" | "invoiceNumber">) => {
    setBusy(true);
    setError(null);
    try {
      const { blob } = await downloadInvoicePdf(inv._id);
      saveBlob(blob, `invoice-${inv.invoiceNumber}.pdf`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return { run, busy, error };
}

// Invoices list (reached from Sales and Orders)
const TABS: Array<[string, string]> = [
  ["all", "All"],
  ["draft", "Draft"],
  ["sent", "Sent"],
  ["paid", "Paid"],
  ["overdue", "Overdue"],
];

export function InvoicesPage() {
  const [tab, setTab] = useState("all");
  const invoices = useInvoices(tab);
  const list = invoices.data?.invoices ?? [];
  return (
    <div className="flex flex-col gap-6">
      <PageTitle actions={<ButtonLink to="/invoices/new" size="md">Create invoice</ButtonLink>}>Invoices</PageTitle>
      <IntroCard eyebrow="Invoicing" title="Follow every invoice from draft to paid.">
        Status is tracked as Draft, Sent, Paid or Overdue.
      </IntroCard>
      <Panel>
        <div role="tablist" aria-label="Filter by status" className="flex flex-wrap gap-1 rounded-md bg-surface-pale p-1">
          {TABS.map(([k, l]) => (
            <button
              key={k}
              role="tab"
              type="button"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn("rounded-sm px-2.5 py-1.5 text-body-sm font-medium", tab === k ? "bg-surface-card text-ink-brand shadow-card" : "text-ink-secondary hover:text-ink-brand")}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="mt-4">
          {invoices.isLoading ? (
            <Loading />
          ) : invoices.error ? (
            <ErrorNote error={invoices.error} fallback="We couldn't load your invoices. Please try again." onRetry={() => void invoices.refetch()} />
          ) : !list.length ? (
            <p className="py-8 text-center text-body-lg text-ink-secondary">{tab === "all" ? "No invoices yet." : "No invoices with this status."}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-body-sm">
                <thead className="bg-surface-pale text-caption font-semibold uppercase text-ink-muted">
                  <tr>
                    <th scope="col" className="rounded-l-lg px-3 py-3">Invoice</th>
                    <th scope="col" className="px-3 py-3">Customer</th>
                    <th scope="col" className="px-3 py-3">Due</th>
                    <th scope="col" className="px-3 py-3">Total</th>
                    <th scope="col" className="rounded-r-lg px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((i) => (
                    <tr key={i._id} className="border-b border-line-subtle last:border-0">
                      <td className="px-3 py-4">
                        <Link to={`/invoices/${i._id}`} className="font-semibold text-ink-strong hover:underline">{i.invoiceNumber}</Link>
                        <p className="text-caption text-ink-muted">{shortDate(i.createdAt)}</p>
                      </td>
                      <td className="px-3 py-4 text-ink-strong">{i.clientName}</td>
                      <td className="px-3 py-4 text-ink-muted">{i.dueDate ? shortDate(i.dueDate) : "—"}</td>
                      <td className="px-3 py-4 text-ink-strong">{naira(i.total)}</td>
                      <td className="px-3 py-4">
                        <Status tone={invoiceBadge[i.status].tone}>{invoiceBadge[i.status].label}</Status>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

// 05.03 Create / edit an invoice (with live preview)
const money = z.preprocess((v) => (typeof v === "string" ? v.replace(/[₦,\s]/g, "") : v), z.coerce.number({ invalid_type_error: "Enter an amount." }).min(0, "Can't be negative."));
const qty = z.preprocess((v) => (typeof v === "string" ? v.replace(/[,\s]/g, "") : v), z.coerce.number({ invalid_type_error: "Enter a quantity." }).positive("At least 1."));
const invoiceSchema = z.object({
  clientName: z.string().trim().min(1, "Enter the customer's name.").max(100),
  clientEmail: z.string().trim().max(120).refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Enter a valid email."),
  clientPhone: z.string().trim().max(30),
  clientAddress: z.string().trim().max(200),
  dueDate: z.string(),
  tax: z.preprocess((v) => (typeof v === "string" ? v.replace(/[%\s]/g, "") || "0" : v), z.coerce.number({ invalid_type_error: "Enter a percentage." }).min(0, "Can't be negative.").max(100, "At most 100%.")),
  notes: z.string().trim().max(1000),
  items: z.array(z.object({ description: z.string().trim().min(1, "Describe the item."), quantity: qty, unitPrice: money })).min(1, "Add at least one line."),
});
type InvoiceValues = z.infer<typeof invoiceSchema>;
const num = (v: unknown) => Number(String(v ?? "").replace(/[₦,%\s]/g, "")) || 0;

/** Invoice document — the live preview (05.03) and the PDF preview (05.13). */
function InvoiceDocument({
  number,
  status,
  issued,
  due,
  client,
  items,
  tax,
}: {
  number: string;
  status: InvoiceStatus;
  issued: string;
  due?: string | null;
  client: { name: string; email?: string; phone?: string; address?: string };
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
  tax: number;
}) {
  const profile = useBusinessProfile();
  const p = profile.data;
  const lines = items.map((i) => ({ ...i, total: i.quantity * i.unitPrice }));
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const taxAmount = Math.round(subtotal * tax) / 100;
  return (
    <article aria-label="Invoice preview" className="rounded-xl border border-line-card bg-surface-card p-5 lg:p-7">
      <p className="text-title-sm font-semibold uppercase text-ink-brand">{p?.businessName || "Your business"}</p>
      <h3 className="mt-3 text-page-title text-ink-strong">INVOICE</h3>
      <p className="mt-1 text-body-sm text-ink-muted">
        {number} · {invoiceBadge[status].label} · Issued {issued}
      </p>
      <div className="mt-5 grid gap-4 rounded-lg bg-surface-pale p-4 md:grid-cols-2">
        <div>
          <p className="text-caption font-semibold uppercase text-ink-muted">Bill to</p>
          <p className="mt-2 text-body-lg text-ink-strong">{client.name || "Customer name"}</p>
          <p className="text-body-sm text-ink-muted">{[client.email, client.phone, client.address].filter(Boolean).join(" · ") || "customer@example.com"}</p>
        </div>
        <div>
          <p className="text-caption font-semibold uppercase text-ink-muted">From</p>
          <p className="mt-2 text-body-lg text-ink-strong">{p?.businessName || "Your business details"}</p>
          <p className="text-body-sm text-ink-muted">{[p?.businessEmail, p?.businessPhone, p?.businessAddress].filter(Boolean).join(" · ") || "Add these in your business profile"}</p>
        </div>
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[26rem] text-left text-body-sm">
          <thead className="bg-surface-pale text-caption font-semibold uppercase text-ink-muted">
            <tr>
              <th scope="col" className="rounded-l-lg px-3 py-3">Description</th>
              <th scope="col" className="px-3 py-3">Qty</th>
              <th scope="col" className="px-3 py-3">Rate</th>
              <th scope="col" className="rounded-r-lg px-3 py-3 text-ink-brand">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, n) => (
              <tr key={n} className="border-b border-line-subtle last:border-0">
                <td className="px-3 py-3 text-ink-strong">{l.description || "—"}</td>
                <td className="px-3 py-3 text-ink-strong">{count(l.quantity)}</td>
                <td className="px-3 py-3 text-ink-strong">{naira(l.unitPrice)}</td>
                <td className="px-3 py-3 font-semibold text-ink-brand">{naira(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tax > 0 && (
        <p className="mt-3 text-right text-body-sm text-ink-muted">
          Subtotal {naira(subtotal)} · Tax ({tax}%) {naira(taxAmount)}
        </p>
      )}
      <div className="mt-4 flex items-center justify-between rounded-lg bg-surface-pale px-4 py-4">
        <span className="text-caption font-semibold uppercase text-ink-brand">Total due</span>
        <span className="text-title-md text-ink-brand">{naira(subtotal + taxAmount)}</span>
      </div>
      <p className="mt-3 text-body-sm text-ink-muted">{due ? `Payment due ${shortDate(due)}.` : "Due date: choose a date before sending."}</p>
    </article>
  );
}

export function InvoiceEditorPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const existing = useInvoice(id);
  const save = useSaveInvoice(id);
  const [formError, setFormError] = useState<unknown>(null);
  const { register, control, handleSubmit, watch, reset, setError, formState } = useForm<InvoiceValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: { clientName: "", clientEmail: "", clientPhone: "", clientAddress: "", dueDate: "", tax: 0, notes: "", items: [{ description: "", quantity: 1, unitPrice: 0 }] } as unknown as InvoiceValues,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  useEffect(() => {
    const i = existing.data;
    if (!i) return;
    reset({
      clientName: i.clientName,
      clientEmail: i.clientEmail ?? "",
      clientPhone: i.clientPhone ?? "",
      clientAddress: i.clientAddress ?? "",
      dueDate: toDateInput(i.dueDate),
      tax: i.tax ?? 0,
      notes: i.notes ?? "",
      items: i.items.map(({ description, quantity, unitPrice }) => ({ description, quantity, unitPrice })),
    });
  }, [existing.data, reset]);

  const submit = (status?: InvoiceStatus) =>
    handleSubmit(async (v) => {
      setFormError(null);
      try {
        const inv = await save.mutateAsync({
          clientName: v.clientName,
          clientEmail: v.clientEmail,
          clientPhone: v.clientPhone,
          clientAddress: v.clientAddress,
          dueDate: v.dueDate || null,
          tax: v.tax,
          notes: v.notes,
          items: v.items,
          ...(status ? { status } : {}),
        });
        navigate(editing ? `/invoices/${inv._id}` : `/invoices/${inv._id}/created`, { state: { invoice: inv } });
      } catch (err) {
        if (!applyFieldErrors(err, setError, ["clientName", "clientEmail", "dueDate", "tax"])) setFormError(err);
      }
    });

  if (editing && existing.isLoading) return <Loading />;
  if (editing && !existing.data) return <ErrorNote error={existing.error ?? true} fallback="We couldn't load this invoice. Please try again." onRetry={() => void existing.refetch()} />;

  const w = watch();
  const items = (w.items ?? []).map((i) => ({ description: i.description ?? "", quantity: num(i.quantity), unitPrice: num(i.unitPrice) }));

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>{editing ? `Edit invoice ${existing.data?.invoiceNumber}` : "Create an invoice"}</PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Prepare a branded invoice, review totals, then send or download a PDF.</p>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <form noValidate onSubmit={submit()} className="flex flex-col gap-5">
          <Panel title="Invoice details" subtitle="Business identity is pulled from your profile. Review before sending.">
            <div className="grid gap-4 md:grid-cols-2 md:gap-x-8 md:gap-y-5">
              <Field label="Invoice number">
                <TextInput value={existing.data?.invoiceNumber ?? "Assigned when saved"} readOnly disabled />
              </Field>
              <Field label="Issued date">
                <TextInput value={shortDate(existing.data?.createdAt ?? new Date().toISOString())} readOnly disabled />
              </Field>
              <Field label="Customer" required error={formState.errors.clientName?.message}>
                <TextInput autoComplete="off" placeholder="Amina Yusuf" {...register("clientName")} />
              </Field>
              <Field label="Due date">
                <TextInput type="date" {...register("dueDate")} />
              </Field>
              <Field label="Recipient email" error={formState.errors.clientEmail?.message}>
                <TextInput type="email" autoComplete="off" placeholder="customer@example.com" {...register("clientEmail")} />
              </Field>
              <Field label="Phone">
                <TextInput type="tel" autoComplete="off" {...register("clientPhone")} />
              </Field>
              <Field label="Address">
                <TextInput autoComplete="off" {...register("clientAddress")} />
              </Field>
              <Field label="Tax (%)" error={formState.errors.tax?.message}>
                <TextInput inputMode="decimal" placeholder="0" {...register("tax")} />
              </Field>
            </div>

            <h3 className="mt-8 text-title-sm text-ink-strong">Line items</h3>
            <div className="mt-3 flex flex-col gap-3 rounded-lg bg-surface-pale p-3">
              {fields.map((f, n) => {
                const e = formState.errors.items?.[n];
                return (
                  <div key={f.id} className="grid gap-3 rounded-md bg-surface-card p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,0.7fr)_minmax(0,1fr)_auto] md:items-end">
                    <Field label="Item" error={e?.description?.message}>
                      <TextInput placeholder="Product or service" {...register(`items.${n}.description` as const)} />
                    </Field>
                    <Field label="Qty" error={e?.quantity?.message}>
                      <TextInput inputMode="decimal" {...register(`items.${n}.quantity` as const)} />
                    </Field>
                    <Field label="Rate (₦)" error={e?.unitPrice?.message}>
                      <TextInput inputMode="decimal" {...register(`items.${n}.unitPrice` as const)} />
                    </Field>
                    {fields.length > 1 && (
                      <Button variant="secondary" size="md" onClick={() => remove(n)} aria-label={`Remove line ${n + 1}`}>
                        <IconTrash aria-hidden="true" className="size-icon" />
                      </Button>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => append({ description: "", quantity: 1, unitPrice: 0 } as never)}
                className="flex items-center justify-center gap-2 py-2 text-body-sm font-semibold text-ink-brand hover:underline"
              >
                <IconPlus aria-hidden="true" className="size-icon-sm" /> Add a product or service
              </button>
            </div>
            {formState.errors.items?.message && <p className="mt-2 text-body-sm text-danger">{formState.errors.items.message}</p>}
            <div className="mt-5">
              <Field label="Notes / payment instructions">
                <TextInput placeholder="Bank: … · Account: …" {...register("notes")} />
              </Field>
            </div>
            {!editing && (
              <div className="mt-5 rounded-lg bg-surface-pale px-4 py-3">
                <p className="text-body-lg font-semibold text-ink-strong">From a completed order?</p>
                <p className="mt-1 text-body-sm text-ink-muted">
                  Open the order and choose “Create an invoice” — its items are filled in for you. <Link to="/orders" className="font-semibold text-ink-brand hover:underline">Go to orders</Link>
                </p>
              </div>
            )}
          </Panel>
          <ErrorNote error={formError} fallback="We couldn't save this invoice. Check your connection and try again." />
          <div className="flex flex-col gap-3 md:flex-row">
            <Button variant="outlined" className="md:flex-1" disabled={formState.isSubmitting} onClick={() => void submit("draft")()}>
              Save draft
            </Button>
            <Button type="submit" className="md:flex-1" loading={formState.isSubmitting} loadingText="Saving…">
              {editing ? "Save invoice" : "Create invoice"}
            </Button>
          </div>
        </form>
        <div className="flex flex-col gap-3">
          <Panel tone="pale" title="Live invoice preview" subtitle="Review the document before sending it to your customer.">
            <InvoiceDocument
              number={existing.data?.invoiceNumber ?? "INV-…"}
              status={existing.data?.status ?? "draft"}
              issued={shortDate(existing.data?.createdAt ?? new Date().toISOString())}
              due={w.dueDate || null}
              client={{ name: w.clientName ?? "", email: w.clientEmail, phone: w.clientPhone, address: w.clientAddress }}
              items={items}
              tax={num(w.tax)}
            />
            <p className="mt-4 text-body-sm font-semibold text-ink-brand">Email invoice or download a branded PDF</p>
            <p className="text-body-sm text-ink-muted">Status is tracked as Draft, Sent, Paid or Overdue.</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function useRouteInvoice() {
  const { id } = useParams();
  const location = useLocation();
  const passed = (location.state as { invoice?: Invoice } | null)?.invoice;
  const q = useInvoice(id);
  return { ...q, data: q.data ?? (passed && passed._id === id ? passed : undefined) };
}

const Confirmation = ({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) => (
  <section className="rounded-2xl bg-success-bg px-5 py-4 shadow-card lg:px-6 lg:py-5">
    <p className="text-caption font-semibold uppercase text-success">{eyebrow}</p>
    <h2 className="mt-2 text-section-title text-ink-strong">{title}</h2>
    <p className="mt-2 text-body-sm text-ink-muted">{body}</p>
  </section>
);

// 05.06 Invoice created
export function InvoiceCreatedPage() {
  const inv = useRouteInvoice();
  const pdf = usePdfDownload();
  if (!inv.data) return inv.isLoading ? <Loading /> : <ErrorNote error={inv.error ?? true} fallback="We couldn't load this invoice." onRetry={() => void inv.refetch()} />;
  const i = inv.data;
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Invoice created</PageTitle>
      <Confirmation eyebrow={invoiceBadge[i.status].label} title={`${i.invoiceNumber} is ready.`} body="Preview it, email it to your customer or download the PDF." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Invoice summary">
          <dl className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-4 gap-y-3 text-body-lg">
            <dt className="text-ink-muted">Customer</dt>
            <dd className="text-ink-strong">{i.clientName}</dd>
            <dt className="text-ink-muted">Lines</dt>
            <dd className="text-ink-strong">{count(i.items.length)}</dd>
            <dt className="text-ink-muted">Total</dt>
            <dd className="font-semibold text-ink-brand">{naira(i.total)}</dd>
            <dt className="text-ink-muted">Due</dt>
            <dd className="text-ink-strong">{i.dueDate ? shortDate(i.dueDate) : "No due date"}</dd>
          </dl>
          <ErrorNote className="mt-4" error={pdf.error} fallback="We couldn't prepare the PDF. Please try again." onRetry={() => void pdf.run(i)} />
          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <ButtonLink to={`/invoices/${i._id}/email`} className="md:flex-1">
              <IconMail aria-hidden="true" className="size-icon" /> Email invoice
            </ButtonLink>
            <ButtonLink to={`/invoices/${i._id}`} variant="secondary" className="md:flex-1">Preview</ButtonLink>
            <Button variant="secondary" className="md:flex-1" loading={pdf.busy} loadingText="Preparing…" onClick={() => void pdf.run(i)}>
              <IconDownload aria-hidden="true" className="size-icon" /> Download PDF
            </Button>
          </div>
        </Panel>
        <Panel tone="pale" title="What's next">
          <ol className="flex flex-col gap-6 text-body-sm text-ink-muted">
            <li><p className="text-body-lg font-semibold text-ink-brand">01  Send it</p>Email it with the PDF attached, or download and share it yourself.</li>
            <li><p className="text-body-lg font-semibold text-ink-brand">02  Track it</p>Sent invoices past their due date become Overdue.</li>
            <li><p className="text-body-lg font-semibold text-ink-brand">03  Mark it paid</p>From the invoice preview, once the money arrives.</li>
          </ol>
        </Panel>
      </div>
    </div>
  );
}

// 05.13 Invoice PDF preview
export function InvoicePreviewPage() {
  const navigate = useNavigate();
  const inv = useRouteInvoice();
  const pdf = usePdfDownload();
  const setStatus = useSetInvoiceStatus(inv.data?._id ?? "");
  const del = useDeleteInvoice();
  const [error, setError] = useState<unknown>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!inv.data) return inv.isLoading ? <Loading /> : <ErrorNote error={inv.error ?? true} fallback="We couldn't load this invoice." onRetry={() => void inv.refetch()} />;
  const i = inv.data;

  const mark = async (status: InvoiceStatus) => {
    setError(null);
    try {
      await setStatus.mutateAsync(status);
      await inv.refetch();
    } catch (err) {
      setError(err);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Invoice PDF preview</PageTitle>
      <IntroCard eyebrow="Invoicing / Download or send" title="Review every detail before sharing the invoice." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <InvoiceDocument
          number={i.invoiceNumber}
          status={i.status}
          issued={shortDate(i.createdAt)}
          due={i.dueDate}
          client={{ name: i.clientName, email: i.clientEmail, phone: i.clientPhone, address: i.clientAddress }}
          items={i.items}
          tax={i.tax}
        />
        <Panel tone="pale" title="Ready to share?">
          <dl className="flex flex-col gap-6">
            <div>
              <dt>
                <button type="button" onClick={() => void pdf.run(i)} className="text-body-lg font-semibold text-ink-brand hover:underline">
                  {pdf.busy ? "Preparing PDF…" : "Download as PDF"}
                </button>
              </dt>
              <dd className="mt-1 text-body-sm text-ink-muted">Save the branded invoice for sharing or print.</dd>
            </div>
            <div>
              <dt><Link to={`/invoices/${i._id}/email`} className="text-body-lg font-semibold text-ink-brand hover:underline">Send invoice by email</Link></dt>
              <dd className="mt-1 text-body-sm text-ink-muted">Customer receives the invoice as a PDF attachment.</dd>
            </div>
            <div>
              <dt className="text-body-lg font-semibold text-ink-brand">Track its status</dt>
              <dd className="mt-2 flex flex-wrap items-center gap-2 text-body-sm text-ink-muted">
                <Status tone={invoiceBadge[i.status].tone}>{invoiceBadge[i.status].label}</Status>
                {i.status !== "paid" ? (
                  <Button size="md" variant="secondary" loading={setStatus.isPending} loadingText="Saving…" onClick={() => void mark("paid")}>Mark as paid</Button>
                ) : (
                  <Button size="md" variant="secondary" loading={setStatus.isPending} loadingText="Saving…" onClick={() => void mark("sent")}>Mark as unpaid</Button>
                )}
              </dd>
            </div>
          </dl>
          <ErrorNote className="mt-4" error={error ?? pdf.error} fallback="That didn't work. Please try again." />
          <div className="mt-6 flex flex-col gap-2">
            <ButtonLink to={`/invoices/${i._id}/edit`} fullWidth>Edit invoice</ButtonLink>
            <ButtonLink to={`/invoices/${i._id}/email`} fullWidth>Email invoice</ButtonLink>
            <Button variant="secondary" fullWidth className="text-danger" onClick={() => setConfirmDelete(true)}>
              <IconTrash aria-hidden="true" className="size-icon" /> Delete invoice
            </Button>
          </div>
        </Panel>
      </div>
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        tone="danger"
        icon={<IconTrash className="size-7" />}
        title={`Delete ${i.invoiceNumber}?`}
        description="The invoice will be removed. Orders linked to it are not affected. This can't be undone."
        actions={
          <>
            <Button variant="outlined" onClick={() => setConfirmDelete(false)}>Keep invoice</Button>
            <Button
              variant="destructive"
              loading={del.isPending}
              loadingText="Deleting…"
              onClick={async () => {
                try {
                  await del.mutateAsync(i._id);
                  navigate("/invoices", { replace: true });
                } catch (err) {
                  setConfirmDelete(false);
                  setError(err);
                }
              }}
            >
              Delete invoice
            </Button>
          </>
        }
      />
    </div>
  );
}

// 05.10 Email your invoice
const emailSchema = z.object({
  to: z.string().trim().min(1, "Enter the customer's email.").refine((v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Enter a valid email."),
  cc: z.string().trim().refine((v) => !v || v.split(/[,;\s]+/).filter(Boolean).every((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)), "Enter valid email addresses, separated by commas."),
  subject: z.string().trim().max(150),
  message: z.string().trim().max(2000),
});
type EmailValues = z.infer<typeof emailSchema>;

export function EmailInvoicePage() {
  const navigate = useNavigate();
  const inv = useRouteInvoice();
  const profile = useBusinessProfile();
  const send = useSendInvoice(inv.data?._id ?? "");
  const pdf = usePdfDownload();
  const [formError, setFormError] = useState<unknown>(null);
  const [unavailable, setUnavailable] = useState(false);
  const { register, handleSubmit, reset, setError, formState } = useForm<EmailValues>({ resolver: zodResolver(emailSchema) });
  const business = profile.data?.businessName || "your business";

  useEffect(() => {
    const i = inv.data;
    if (!i) return;
    reset({ to: i.clientEmail ?? "", cc: "", subject: `Invoice ${i.invoiceNumber} from ${business}`, message: `Hello ${i.clientName},\n\nPlease find your invoice attached.\n\nThank you.` });
  }, [inv.data, business, reset]);

  if (!inv.data) return inv.isLoading ? <Loading /> : <ErrorNote error={inv.error ?? true} fallback="We couldn't load this invoice." onRetry={() => void inv.refetch()} />;
  const i = inv.data;

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    setUnavailable(false);
    try {
      const res = await send.mutateAsync({ to: v.to, cc: v.cc ? v.cc.split(/[,;\s]+/).filter(Boolean) : undefined, subject: v.subject || undefined, message: v.message || undefined });
      navigate(`/invoices/${i._id}/sent`, { state: { invoice: res.invoice, to: v.to } });
    } catch (err) {
      if (isEmailUnavailable(err)) setUnavailable(true);
      else if (!applyFieldErrors(err, setError, ["to", "cc", "subject", "message"])) setFormError(err);
    }
  });

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Email your invoice</PageTitle>
      <IntroCard eyebrow="Invoicing / Customer communication" title="Send a professional invoice in a few steps.">
        An invoice PDF is attached to the customer email.
      </IntroCard>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <form noValidate onSubmit={onSubmit}>
          <Panel title="Compose email">
            <div className="flex flex-col gap-4 md:gap-5">
              <Field label="To email" required error={formState.errors.to?.message}>
                <TextInput type="email" autoComplete="off" {...register("to")} />
              </Field>
              <Field label="Subject" error={formState.errors.subject?.message}>
                <TextInput {...register("subject")} />
              </Field>
              <Field label="CC (optional)" hint="Separate several addresses with commas." error={formState.errors.cc?.message}>
                <TextInput autoComplete="off" placeholder="Add another email address" {...register("cc")} />
              </Field>
              <Field label="Message" error={formState.errors.message?.message}>
                <textarea rows={5} className="w-full resize-y bg-transparent text-input text-ink-strong outline-none lg:rounded-sm lg:border lg:border-line-default lg:bg-surface-card lg:px-3 lg:py-2" {...register("message")} />
              </Field>
              <Field label="Attachment">
                <TextInput value={`${i.invoiceNumber}.pdf · PDF`} readOnly disabled />
              </Field>
            </div>
            <p className="mt-4 text-body-sm text-ink-muted">
              {i.status === "draft" ? "Sending will update the invoice status from Draft to Sent." : `This invoice is ${invoiceBadge[i.status].label.toLowerCase()}; its status won't change.`}
            </p>
            {unavailable && (
              <div role="status" className="mt-4 rounded-lg bg-surface-tint-warm px-4 py-3 text-body-sm text-ink-strong">
                <p className="font-semibold">Email sending isn't available yet.</p>
                <p className="mt-1">Download the PDF and send it to your customer yourself. The invoice stays as {invoiceBadge[i.status].label}.</p>
                <Button size="md" variant="secondary" className="mt-3" loading={pdf.busy} loadingText="Preparing…" onClick={() => void pdf.run(i)}>
                  <IconDownload aria-hidden="true" className="size-icon" /> Download PDF
                </Button>
              </div>
            )}
            <ErrorNote className="mt-4" error={formError ?? pdf.error} fallback="We couldn't send the invoice. Check your connection and try again." onRetry={() => void onSubmit()} />
            <div className="mt-5 flex flex-col gap-3 md:flex-row">
              <Button type="submit" className="md:flex-1" loading={formState.isSubmitting} loadingText="Sending…">
                Send invoice to customer
              </Button>
              <ButtonLink to={`/invoices/${i._id}/edit`} variant="secondary" className="md:flex-1">Back to invoice editor</ButtonLink>
            </div>
          </Panel>
        </form>
        <div className="flex flex-col gap-4">
          <Panel tone="pale" title="Attached document">
            <div className="rounded-lg bg-surface-card px-4 py-4">
              <p className="text-caption font-semibold uppercase text-ink-brand">{business} / Invoice</p>
              <p className="mt-3 text-body-lg text-ink-strong">{i.invoiceNumber}</p>
              <p className="mt-2 text-body-sm text-ink-muted">Billed to: {i.clientName}</p>
              <p className="mt-1 text-body-sm text-ink-muted">Line items: {count(i.items.length)}</p>
              <p className="mt-4 text-title-md text-ink-brand">Total due: {naira(i.total)}</p>
              <p className="mt-2 text-body-sm text-ink-muted">{i.dueDate ? `Due ${shortDate(i.dueDate)}` : "Due date: add one in the editor"}</p>
            </div>
            <h3 className="mt-6 text-title-sm text-ink-strong">What happens when sent</h3>
            <ul className="mt-3 flex flex-col gap-3 text-body-sm font-medium text-ink-brand">
              <li>✓ Customer receives the invoice email</li>
              <li>✓ Branded PDF is attached</li>
              <li>✓ Invoice status becomes Sent</li>
              <li>✓ Track Paid / Overdue from invoices</li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}

// 05.11 Invoice sent
export function InvoiceSentPage() {
  const inv = useRouteInvoice();
  const location = useLocation();
  const to = (location.state as { to?: string } | null)?.to;
  if (!inv.data) return inv.isLoading ? <Loading /> : <ErrorNote error={inv.error ?? true} fallback="We couldn't load this invoice." onRetry={() => void inv.refetch()} />;
  const i = inv.data;
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Invoice sent</PageTitle>
      <Confirmation eyebrow={invoiceBadge[i.status].label} title={`${i.invoiceNumber} is on its way.`} body={`We emailed it${to || i.clientEmail ? ` to ${to || i.clientEmail}` : ""} with the PDF attached.`} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Sent invoice">
          <dl className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-4 gap-y-3 text-body-lg">
            <dt className="text-ink-muted">Customer</dt>
            <dd className="text-ink-strong">{i.clientName}</dd>
            <dt className="text-ink-muted">Total</dt>
            <dd className="font-semibold text-ink-brand">{naira(i.total)}</dd>
            <dt className="text-ink-muted">Status</dt>
            <dd><Status tone={invoiceBadge[i.status].tone}>{invoiceBadge[i.status].label}</Status></dd>
          </dl>
          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <ButtonLink to={`/invoices/${i._id}`} className="md:flex-1">View invoice</ButtonLink>
            <ButtonLink to="/invoices" variant="secondary" className="md:flex-1">All invoices</ButtonLink>
          </div>
        </Panel>
        <InfoStrip title="Next">Mark it paid from the invoice when the money arrives. If the due date passes first, it becomes Overdue.</InfoStrip>
      </div>
    </div>
  );
}
