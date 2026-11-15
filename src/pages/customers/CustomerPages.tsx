import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  IconDownload,
  IconFileInvoice,
  IconGitMerge,
  IconLock,
  IconMail,
  IconMessage,
  IconPencil,
  IconPhone,
  IconPlus,
  IconReceipt,
  IconSearch,
  IconTrash,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { Button, ButtonLink, Dialog, EmptyState, Field, SelectInput, Spinner, Status, TextArea, TextInput } from "@/components/ui";
import { DetailRows, IntroCard, KpiCard, PageTitle, Panel, TipList } from "@/components/page/Blocks";
import { LoadMore } from "@/components/page/LoadMore";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { UpdatedNote, newRowClass } from "@/components/feedback/UpdatedNote";
import { useNewItems } from "@/lib/realtime/useLiveList";
import { useUrlState } from "@/lib/nav/useUrlState";
import { useLeaveGuard } from "@/lib/nav/useLeaveGuard";
import { useCan } from "@/lib/auth/useCan";
import { saveBlob } from "@/lib/api/client";
import { applyFieldErrors } from "@/lib/api/errorMessage";
import { count, naira, shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { CUSTOMER_PERMISSIONS } from "@/config/customers";
import {
  SORTS,
  SOURCES,
  defaultDir,
  duplicateOf,
  exportCustomers,
  formatAddress,
  historyBadge,
  prefillOf,
  sourceLabel,
  useCustomer,
  useCustomerPages,
  useCustomerStats,
  useDeleteCustomer,
  useMergeCustomer,
  useSaveCustomer,
  type Customer,
  type CustomerInput,
  type CustomerQuery,
  type CustomerSort,
  type CustomerSource,
  type SortDir,
} from "@/lib/customers/api";

const Loading = () => (
  <div className="flex justify-center py-16 text-ink-brand" role="status">
    <Spinner className="size-8" />
    <span className="sr-only">Loading…</span>
  </div>
);

/** Who may see and change customers (config/customers.ts decides the keys). */
export function useCustomerAccess() {
  return { view: useCan(CUSTOMER_PERMISSIONS.view), manage: useCan(CUSTOMER_PERMISSIONS.manage) };
}

function NoCustomerAccess() {
  return (
    <EmptyState
      className="max-w-xl"
      icon={<IconLock className="size-7" />}
      title="You don't have access to customers"
      body="Ask the business owner if you need to see or manage customer records."
      action={<ButtonLink to="/dashboard" size="md">Back to dashboard</ButtonLink>}
    />
  );
}

/** Pages that need "view customers"; `manage` pages also need "manage customers". */
function Guard({ manage, children }: { manage?: boolean; children: ReactNode }) {
  const access = useCustomerAccess();
  if (!access.view || (manage && !access.manage)) return <NoCustomerAccess />;
  return <>{children}</>;
}

const ordersLabel = (n: number) => `${count(n)} order${n === 1 ? "" : "s"}`;
const contactLine = (c: Pick<Customer, "phone" | "email">) => [c.phone, c.email].filter(Boolean).join(" • ") || "No contact details";

// ── 09.01 Customer directory ─────────────────────────────────────────────

function CustomerCards({ customers, fresh }: { customers: Customer[]; fresh: Set<string> }) {
  return (
    <ul className="flex flex-col gap-3 md:hidden" aria-label="Customers">
      {customers.map((c) => (
        <li key={c._id}>
          <Link
            to={`/customers/${c._id}`}
            className={cn("flex min-h-14 flex-col gap-1 rounded-md bg-surface-pale px-3 py-2.5", fresh.has(c._id) && newRowClass)}
          >
            <span className="truncate text-body-sm font-semibold uppercase text-ink-brand">{c.name}</span>
            <span className="truncate text-body-sm text-ink-strong">{contactLine(c)}</span>
            <span className="flex flex-wrap gap-x-3 text-caption text-ink-muted">
              <span>{ordersLabel(c.stats.ordersCount)}</span>
              <span>{naira(c.stats.totalSpent)} paid</span>
              <span>{c.stats.lastOrderAt ? `Last order ${shortDate(c.stats.lastOrderAt)}` : "No orders yet"}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CustomerTable({ customers, fresh }: { customers: Customer[]; fresh: Set<string> }) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[40rem] text-left text-body-sm">
        <thead className="bg-surface-pale text-caption font-semibold uppercase text-ink-muted">
          <tr>
            <th scope="col" className="rounded-l-lg px-3 py-3">Name</th>
            <th scope="col" className="px-3 py-3">Contact</th>
            <th scope="col" className="px-3 py-3">Orders</th>
            <th scope="col" className="px-3 py-3">Total spent (paid)</th>
            <th scope="col" className="rounded-r-lg px-3 py-3">Last order</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c._id} data-new={fresh.has(c._id) || undefined} className={cn("border-b border-line-subtle last:border-0", fresh.has(c._id) && newRowClass)}>
              <td className="px-3 py-4">
                <Link to={`/customers/${c._id}`} className="font-semibold text-ink-strong hover:underline">
                  {c.name}
                </Link>
                {c.tags.length > 0 && <p className="text-caption text-ink-muted">{c.tags.join(", ")}</p>}
              </td>
              <td className="px-3 py-4 text-ink-strong">
                {c.phone && <p>{c.phone}</p>}
                {c.email && <p className="break-all text-ink-muted">{c.email}</p>}
                {!c.phone && !c.email && <p className="text-ink-muted">—</p>}
              </td>
              <td className="px-3 py-4 text-ink-brand">{ordersLabel(c.stats.ordersCount)}</td>
              <td className="px-3 py-4 text-ink-strong">{naira(c.stats.totalSpent)}</td>
              <td className="px-3 py-4 text-ink-muted">{c.stats.lastOrderAt ? shortDate(c.stats.lastOrderAt) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function useCsvExport(filters: CustomerQuery) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const { blob, filename } = await exportCustomers(filters);
      saveBlob(blob, filename === "download" ? "customers.csv" : filename);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return { run, busy, error };
}

const SORT_KEYS = SORTS.map(([k]) => k);
const SOURCE_KEYS = ["", ...SOURCES.map(([k]) => k)] as const;

function CustomersDirectory() {
  const [query, setQuery] = useUrlState<string>("q", "");
  const [tag, setTag] = useUrlState<string>("tag", "");
  const [source, setSource] = useUrlState<CustomerSource | "">("source", "", SOURCE_KEYS);
  const [sort, setSort] = useUrlState<CustomerSort>("sort", "totalSpent", SORT_KEYS);
  const [dir, setDir] = useUrlState<SortDir>("dir", defaultDir(sort), ["asc", "desc"]);
  const [q, setQ] = useState(query);
  const filters: CustomerQuery = { q: query, tag, source, sort, dir };
  const list = useCustomerPages(filters);
  const stats = useCustomerStats();
  const { manage } = useCustomerAccess();
  const csv = useCsvExport(filters);
  const customers = list.data?.pages.flatMap((p) => p.customers) ?? [];
  const total = list.data?.pages[0]?.total ?? 0;
  const tags = list.data?.pages[0]?.tags ?? [];
  const fresh = useNewItems(list.data ? customers.map((c) => c._id) : undefined);
  const filtered = Boolean(query || tag || source);
  const s = stats.data;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        actions={
          <div className="flex flex-wrap gap-3">
            {/* Export needs "manage customers" (backend #82). */}
            {manage && (
              <Button size="md" variant="secondary" loading={csv.busy} loadingText="Preparing…" onClick={() => void csv.run()}>
                <IconDownload aria-hidden="true" className="size-icon" /> Export CSV
              </Button>
            )}
            {manage && (
              <ButtonLink to="/customers/new" size="md">
                <IconPlus aria-hidden="true" className="size-icon" /> Add customer
              </ButtonLink>
            )}
          </div>
        }
      >
        Customers
      </PageTitle>
      <IntroCard eyebrow="Customers / Relationships" title="Keep every customer ready for the next order or invoice.">
        Customers are saved from your orders, online store and invoices, or added by you.
      </IntroCard>
      <ErrorNote error={csv.error} fallback="We couldn't prepare the export. Please try again." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard tone="orders" label="Total customers" value={count(s?.total)} caption="In your directory" />
        <KpiCard tone="invoices" label="New this month" value={count(s?.newThisMonth)} caption="First seen this month" />
        <KpiCard tone="stock" label="Repeat customers" value={count(s?.repeat)} caption="More than one order" />
        <KpiCard tone="revenue" label="Total spent (paid orders)" value={naira(s?.totalSpent)} caption="Paid orders, all customers" />
      </div>
      <Panel title="Customer directory">
        <div className="flex flex-col gap-3">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(q.trim());
            }}
          >
            <label className="flex h-control-lg items-center gap-2 rounded-md bg-surface-pale px-3">
              <IconSearch aria-hidden="true" className="size-icon shrink-0 text-ink-muted" />
              <span className="sr-only">Search customers</span>
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  if (!e.target.value) setQuery("");
                }}
                placeholder="Search by name, email or phone"
                className="h-full min-w-0 flex-1 bg-transparent text-input text-ink-strong outline-none placeholder:text-ink-muted"
              />
            </label>
          </form>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-3">
            <Field label="Tag">
              <SelectInput value={tag} onChange={(e) => setTag(e.target.value)}>
                <option value="">All tags</option>
                {tags.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Source">
              <SelectInput value={source} onChange={(e) => setSource(e.target.value as CustomerSource | "")}>
                <option value="">All sources</option>
                {SOURCES.map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Sort by">
              <SelectInput
                value={sort}
                onChange={(e) => {
                  const next = e.target.value as CustomerSort;
                  setSort(next);
                  setDir(defaultDir(next));
                }}
              >
                {SORTS.map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </SelectInput>
            </Field>
          </div>
        </div>
        <div className="mt-4">
          {list.isLoading ? (
            <Loading />
          ) : list.error ? (
            <ErrorNote error={list.error} fallback="We couldn't load your customers. Please try again." onRetry={() => void list.refetch()} />
          ) : !customers.length ? (
            filtered ? (
              <p className="py-8 text-center text-body-lg text-ink-secondary">No customers match this search or filter.</p>
            ) : (
              <EmptyState
                icon={<IconUsers className="size-7" />}
                title="No customers yet"
                body="Customers appear here as you record orders, receive online orders or send invoices. You can also add one yourself."
                action={manage && <ButtonLink to="/customers/new" size="md">Add customer</ButtonLink>}
              />
            )
          ) : (
            <>
              <UpdatedNote updatedAt={list.dataUpdatedAt} className="mb-2" />
              <CustomerCards customers={customers} fresh={fresh} />
              <CustomerTable customers={customers} fresh={fresh} />
              <LoadMore shown={customers.length} total={total} onMore={() => void list.fetchNextPage()} loading={list.isFetchingNextPage} noun="customers" />
            </>
          )}
        </div>
        <div className="mt-5 rounded-lg bg-surface-card">
          <p className="text-body-lg font-semibold text-ink-brand">Customer records make checkout and invoicing easier.</p>
          <p className="mt-1 text-body-sm text-ink-muted">Open a customer to start an order or invoice with their details filled in.</p>
        </div>
      </Panel>
    </div>
  );
}

export const CustomersPage = () => (
  <Guard>
    <CustomersDirectory />
  </Guard>
);

// ── Customer profile ─────────────────────────────────────────────────────

type HistoryRow = { key: string; kind: "order" | "invoice"; label: string; channel: string; to: string; total: number; status: string; createdAt: string };

function NotesEditor({ customer, canEdit }: { customer: Customer; canEdit: boolean }) {
  const save = useSaveCustomer(customer._id);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(customer.notes ?? "");
  useEffect(() => {
    if (!editing) setValue(customer.notes ?? "");
  }, [customer.notes, editing]);
  const submit = async () => {
    try {
      await save.mutateAsync({ ...inputOf(customer), notes: value.trim() });
      setEditing(false);
    } catch {
      // shown below
    }
  };
  return (
    <Panel tone="pale" title="Notes">
      {editing ? (
        <div className="flex flex-col gap-3">
          <Field label="Notes about this customer">
            <TextArea rows={4} maxLength={2000} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Sizes, preferences, delivery notes…" />
          </Field>
          <ErrorNote error={save.error} fallback="We couldn't save the notes. Please try again." />
          <div className="flex flex-col gap-3 md:flex-row">
            <Button size="md" loading={save.isPending} loadingText="Saving…" onClick={() => void submit()}>Save notes</Button>
            <Button size="md" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="whitespace-pre-wrap break-words text-body-lg text-ink-strong">{customer.notes || <span className="text-ink-muted">No notes yet.</span>}</p>
          {canEdit && (
            <Button size="md" variant="secondary" className="self-start" onClick={() => setEditing(true)}>
              <IconPencil aria-hidden="true" className="size-icon" /> {customer.notes ? "Edit notes" : "Add notes"}
            </Button>
          )}
        </div>
      )}
    </Panel>
  );
}

const inputOf = (c: Customer): CustomerInput => ({
  name: c.name,
  // On PUT an empty string clears the field; keep what is there.
  email: c.email ?? "",
  phone: c.phone ?? "",
  address: c.address ?? undefined,
  tags: c.tags,
  notes: c.notes || undefined,
});

function MergeDialog({ customer, open, onClose }: { customer: Customer; open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const results = useCustomerPages({ q: search, sort: "name", dir: "asc" }, open && search.length > 0);
  const merge = useMergeCustomer();
  const options = (results.data?.pages[0]?.customers ?? []).filter((c) => c._id !== customer._id);
  const confirm = async () => {
    if (!picked) return;
    try {
      await merge.mutateAsync({ id: customer._id, otherId: picked });
      onClose();
    } catch {
      // shown below
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      icon={<IconGitMerge className="size-7" />}
      title="Merge with another customer"
      description={`The other record's orders, invoices, tags and notes move to ${customer.name}, and the other record is removed.`}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!picked} loading={merge.isPending} loadingText="Merging…" onClick={() => void confirm()}>Merge customers</Button>
        </>
      }
    >
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q.trim());
        }}
        className="flex gap-2"
      >
        <label className="flex h-control-md min-w-0 flex-1 items-center gap-2 rounded-md bg-surface-pale px-3">
          <IconSearch aria-hidden="true" className="size-icon shrink-0 text-ink-muted" />
          <span className="sr-only">Find the other customer</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or phone" className="h-full min-w-0 flex-1 bg-transparent text-input text-ink-strong outline-none" />
        </label>
        <Button type="submit" size="md" variant="secondary">Find</Button>
      </form>
      {results.isFetching && <p className="text-body-sm text-ink-muted">Searching…</p>}
      {search && !results.isFetching && !options.length && <p className="text-body-sm text-ink-muted">No other customer matches.</p>}
      {options.length > 0 && (
        <fieldset className="flex max-h-64 flex-col gap-2 overflow-y-auto">
          <legend className="sr-only">Customer to merge in</legend>
          {options.map((c) => (
            <label key={c._id} className={cn("flex min-h-control-md cursor-pointer items-center gap-3 rounded-md px-3 py-2", picked === c._id ? "bg-surface-tint-blue" : "bg-surface-pale")}>
              <input type="radio" name="merge-other" value={c._id} checked={picked === c._id} onChange={() => setPicked(c._id)} className="size-5 shrink-0" />
              <span className="min-w-0">
                <span className="block truncate text-body-lg font-semibold text-ink-strong">{c.name}</span>
                <span className="block truncate text-body-sm text-ink-muted">{contactLine(c)}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <ErrorNote error={merge.error} fallback="We couldn't merge these customers. Please try again." />
    </Dialog>
  );
}

function DeleteDialog({ customer, open, onClose }: { customer: Customer; open: boolean; onClose: () => void }) {
  const del = useDeleteCustomer();
  const navigate = useNavigate();
  const confirm = async () => {
    try {
      await del.mutateAsync(customer._id);
      onClose();
      navigate("/customers", { replace: true });
    } catch {
      // shown below
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      tone="danger"
      icon={<IconTrash className="size-7" />}
      title={`Delete ${customer.name}?`}
      description="This removes the customer from your directory. Their orders and invoices are kept for your records."
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>Keep customer</Button>
          <Button variant="destructive" loading={del.isPending} loadingText="Deleting…" onClick={() => void confirm()}>Delete customer</Button>
        </>
      }
    >
      <ErrorNote error={del.error} fallback="We couldn't delete this customer. Please try again." />
    </Dialog>
  );
}

const actionRow = "flex min-h-control-md items-center gap-3 rounded-md bg-surface-card px-3 py-2 text-body-lg font-semibold text-ink-brand hover:bg-surface-tint-blue";

function CustomerProfile() {
  const { id } = useParams();
  const detail = useCustomer(id);
  const { manage } = useCustomerAccess();
  const canOrder = useCan("createOrders");
  const [dialog, setDialog] = useState<"delete" | "merge" | null>(null);

  const history = useMemo<HistoryRow[]>(() => {
    const d = detail.data;
    if (!d) return [];
    const orders: HistoryRow[] = d.orders.map((o) => ({
      key: `o-${o._id}`,
      kind: "order",
      label: o.reference,
      channel: o.channel === "online" ? "Online" : "In person",
      to: o.channel === "online" ? `/store/orders/${o._id}` : `/orders/${o._id}`,
      total: o.total,
      status: o.status,
      createdAt: o.createdAt,
    }));
    const invoices: HistoryRow[] = d.invoices.map((i) => ({
      key: `i-${i._id}`,
      kind: "invoice",
      label: i.invoiceNumber,
      channel: "Invoice",
      to: `/invoices/${i._id}`,
      total: i.total,
      status: i.status,
      createdAt: i.createdAt,
    }));
    return [...orders, ...invoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [detail.data]);

  if (detail.isLoading) return <Loading />;
  if (!detail.data) return <ErrorNote error={detail.error ?? true} fallback="We couldn't load this customer. Please try again." onRetry={() => void detail.refetch()} />;
  const { customer: c, conversation } = detail.data;
  const address = formatAddress(c.address);
  const prefill = { customer: prefillOf(c) };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        actions={
          manage && (
            <div className="flex flex-wrap gap-3">
              <ButtonLink to={`/customers/${c._id}/edit`} size="md" variant="secondary">
                <IconPencil aria-hidden="true" className="size-icon" /> Edit
              </ButtonLink>
              <Button size="md" variant="secondary" onClick={() => setDialog("merge")}>
                <IconGitMerge aria-hidden="true" className="size-icon" /> Merge
              </Button>
              <Button size="md" variant="secondary" className="text-danger" onClick={() => setDialog("delete")}>
                <IconTrash aria-hidden="true" className="size-icon" /> Delete
              </Button>
            </div>
          )
        }
      >
        <span className="break-words">{c.name}</span>
      </PageTitle>
      <UpdatedNote updatedAt={detail.dataUpdatedAt} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard tone="revenue" label="Total spent (paid orders)" value={naira(c.stats.totalSpent)} caption={`${count(c.stats.invoicesCount)} invoice${c.stats.invoicesCount === 1 ? "" : "s"}`} />
        <KpiCard tone="orders" label="Average order" value={naira(c.stats.averageOrder)} caption="Per order" />
        <KpiCard tone="invoices" label="Orders" value={count(c.stats.ordersCount)} caption={c.stats.lastOrderAt ? `Last ${shortDate(c.stats.lastOrderAt)}` : "No orders yet"} />
        <KpiCard tone="stock" label="Last seen" value={c.stats.lastSeenAt ? shortDate(c.stats.lastSeenAt) : "—"} caption={c.stats.firstSeenAt ? `First seen ${shortDate(c.stats.firstSeenAt)}` : "First visit"} />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Contact details">
            <DetailRows
              rows={[
                ["Phone", c.phone ? <a href={`tel:${c.phone.replace(/\s+/g, "")}`} className="font-medium text-ink-brand hover:underline">{c.phone}</a> : "—"],
                ["Email", c.email ? <a href={`mailto:${c.email}`} className="break-all font-medium text-ink-brand hover:underline">{c.email}</a> : "—"],
                ["Address", address || "—"],
                ["Tags", c.tags.length ? (
                  <span className="flex flex-wrap gap-1.5">
                    {c.tags.map((t) => (
                      <Status key={t} tone="neutral">{t}</Status>
                    ))}
                  </span>
                ) : "—"],
                ["Source", sourceLabel(c.source)],
                ["Customer since", shortDate(c.createdAt)],
              ]}
            />
          </Panel>
          <Panel title="History" subtitle="Orders from both channels, and invoices, newest first.">
            {!history.length ? (
              <p className="py-6 text-center text-body-lg text-ink-secondary">No orders or invoices yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line-subtle" aria-label="Order and invoice history">
                {history.map((h) => {
                  const b = historyBadge(h.status);
                  return (
                    <li key={h.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-tint-blue text-ink-brand">
                          {h.kind === "order" ? <IconReceipt className="size-icon" /> : <IconFileInvoice className="size-icon" />}
                        </span>
                        <div className="min-w-0">
                          <Link to={h.to} className="block truncate text-body-lg font-semibold text-ink-strong hover:underline">{h.label}</Link>
                          <p className="text-caption text-ink-muted">
                            <span data-testid="history-channel">{h.channel}</span> · {shortDate(h.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-body-lg font-semibold text-ink-strong">{naira(h.total)}</span>
                        <Status tone={b.tone}>{b.label}</Status>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <Panel tone="pale" title="Quick actions">
            <nav aria-label="Quick actions" className="flex flex-col gap-2">
              {canOrder && (
                <Link to="/orders/new" state={prefill} className={actionRow}>
                  <IconReceipt aria-hidden="true" className="size-icon" /> Create order
                </Link>
              )}
              <Link to="/invoices/new" state={prefill} className={actionRow}>
                <IconFileInvoice aria-hidden="true" className="size-icon" /> Create invoice
              </Link>
              {conversation && (
                <Link to={`/messages/${conversation._id}`} className={actionRow}>
                  <IconMessage aria-hidden="true" className="size-icon" /> Message
                </Link>
              )}
              {c.phone && (
                <a href={`tel:${c.phone.replace(/\s+/g, "")}`} className={actionRow}>
                  <IconPhone aria-hidden="true" className="size-icon" /> Call
                </a>
              )}
              {c.email && (
                <a href={`mailto:${c.email}`} className={actionRow}>
                  <IconMail aria-hidden="true" className="size-icon" /> Email
                </a>
              )}
            </nav>
          </Panel>
          <NotesEditor customer={c} canEdit={manage} />
        </div>
      </div>
      {manage && (
        <>
          <DeleteDialog customer={c} open={dialog === "delete"} onClose={() => setDialog(null)} />
          <MergeDialog key={dialog === "merge" ? "open" : "closed"} customer={c} open={dialog === "merge"} onClose={() => setDialog(null)} />
        </>
      )}
    </div>
  );
}

export const CustomerProfilePage = () => (
  <Guard>
    <CustomerProfile />
  </Guard>
);

// ── 09.01 / 09.02 Add and edit customer ──────────────────────────────────

const customerSchema = z.object({
  name: z.string().trim().min(1, "Enter the customer's name.").max(100, "Keep the name under 100 characters."),
  phone: z
    .string()
    .trim()
    .max(30, "That phone number is too long.")
    .refine((v) => !v || /^\+?[\d\s()-]{7,}$/.test(v), "Enter a valid phone number."),
  email: z.string().trim().max(120).refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Enter a valid email."),
  line: z.string().trim().max(200),
  city: z.string().trim().max(80),
  state: z.string().trim().max(80),
  tags: z.array(z.string().trim().min(1).max(30)).max(20, "Up to 20 tags."),
  notes: z.string().trim().max(2000, "Keep notes under 2,000 characters."),
});
type CustomerValues = z.infer<typeof customerSchema>;

const blank: CustomerValues = { name: "", phone: "", email: "", line: "", city: "", state: "", tags: [], notes: "" };
const valuesOf = (c: Customer): CustomerValues => ({
  name: c.name,
  phone: c.phone ?? "",
  email: c.email ?? "",
  line: c.address?.line ?? "",
  city: c.address?.city ?? "",
  state: c.address?.state ?? "",
  tags: c.tags ?? [],
  notes: c.notes ?? "",
});

/** Chips for tags: Enter or comma adds, × removes. */
function TagInput({ value, onChange, error }: { value: string[]; onChange: (tags: string[]) => void; error?: string }) {
  const [draft, setDraft] = useState("");
  const add = (text = draft) => {
    const next = [...value];
    for (const raw of text.split(",")) {
      const t = raw.trim().slice(0, 30);
      if (t && !next.some((v) => v.toLowerCase() === t.toLowerCase())) next.push(t);
    }
    if (next.length !== value.length) onChange(next);
    setDraft("");
  };
  return (
    <Field label="Tags" hint="Press Enter or comma to add a tag, e.g. VIP, wholesale." error={error}>
      <div className="flex flex-col gap-3">
        {value.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Tags">
            {value.map((t) => (
              <li key={t} className="flex h-control-md items-center gap-1 rounded-full bg-surface-tint-blue pl-3 text-body-sm font-semibold text-ink-brand">
                {t}
                <button type="button" aria-label={`Remove tag ${t}`} onClick={() => onChange(value.filter((v) => v !== t))} className="flex size-control-md items-center justify-center rounded-full hover:bg-surface-tonal">
                  <IconX aria-hidden="true" className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <TextInput
          value={draft}
          placeholder="Add a tag"
          autoComplete="off"
          // A comma (typed or pasted) turns what's before it into tags.
          onChange={(e) => (e.target.value.includes(",") ? add(e.target.value) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => add()}
        />
      </div>
    </Field>
  );
}

function DuplicateNote({ dup, onMerge, merging }: { dup: { id: string; name?: string }; onMerge?: () => void; merging?: boolean }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-lg bg-warning-bg px-4 py-3 text-body-sm text-ink-strong">
      <p>
        {dup.name ? `${dup.name} already has` : "Another customer already has"} this phone number or email.
        {onMerge ? " Open that customer, or merge the two records into this one." : " Open that customer instead of adding a new one."}
      </p>
      <div className="flex flex-col gap-3 md:flex-row">
        <ButtonLink to={`/customers/${dup.id}`} size="md" variant="secondary">Open existing customer</ButtonLink>
        {onMerge && (
          <Button type="button" size="md" variant="secondary" loading={merging} loadingText="Merging…" onClick={onMerge}>
            <IconGitMerge aria-hidden="true" className="size-icon" /> Merge into this customer
          </Button>
        )}
      </div>
    </div>
  );
}

function CustomerForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const existing = useCustomer(id);
  const save = useSaveCustomer(id);
  const merge = useMergeCustomer();
  const [formError, setFormError] = useState<unknown>(null);
  const [dup, setDup] = useState<{ id: string; name?: string } | null>(null);
  const { register, control, handleSubmit, reset, setError, formState } = useForm<CustomerValues>({ resolver: zodResolver(customerSchema), defaultValues: blank });
  const guard = useLeaveGuard(formState.isDirty && !formState.isSubmitSuccessful);
  const loaded = existing.data?.customer;

  useEffect(() => {
    if (loaded) reset(valuesOf(loaded), { keepDirtyValues: true });
  }, [loaded, reset]);

  const toInput = (v: CustomerValues): CustomerInput => ({
    name: v.name,
    // Editing: "" clears the field on the server. Adding: leave it out.
    phone: v.phone || (editing ? "" : undefined),
    email: v.email || (editing ? "" : undefined),
    address: v.line || v.city || v.state ? { line: v.line || undefined, city: v.city || undefined, state: v.state || undefined } : undefined,
    tags: v.tags,
    notes: v.notes || undefined,
  });

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    setDup(null);
    try {
      const saved = await save.mutateAsync(toInput(v));
      guard.allow();
      navigate(editing ? `/customers/${saved._id}` : `/customers/${saved._id}/added`, { replace: true, state: { customer: saved } });
    } catch (err) {
      const d = duplicateOf(err);
      if (d) setDup(d);
      else if (!applyFieldErrors(err, setError, ["name", "email", "phone", "notes"])) setFormError(err);
    }
  });

  // Edit + 409: keep this record, fold the duplicate into it, then save again.
  const mergeDuplicate = async () => {
    if (!id || !dup) return;
    setFormError(null);
    try {
      await merge.mutateAsync({ id, otherId: dup.id });
      setDup(null);
      await onSubmit();
    } catch (err) {
      setFormError(err);
    }
  };

  if (editing && existing.isLoading) return <Loading />;
  if (editing && !loaded) return <ErrorNote error={existing.error ?? true} fallback="We couldn't load this customer. Please try again." onRetry={() => void existing.refetch()} />;

  const e = formState.errors;
  return (
    <div className="flex flex-col gap-6">
      {guard.dialog}
      <PageTitle>{editing ? "Edit customer" : "Add customer"}</PageTitle>
      <IntroCard eyebrow="Customers / Relationships" title={editing ? "Keep customer contact information accurate for future orders." : "Keep every customer ready for the next order or invoice."}>
        {editing ? "Updates apply to the customer record used throughout your workspace." : "New contacts become available across Sales and Invoices."}
      </IntroCard>
      <form noValidate onSubmit={onSubmit} className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <Panel title={editing ? "Edit customer" : "Add a customer"}>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 md:gap-x-8 md:gap-y-5">
            <Field label="Full name" required error={e.name?.message} className="md:col-span-2">
              <TextInput autoComplete="off" placeholder="Amina Yusuf" {...register("name")} />
            </Field>
            <Field label="Phone" error={e.phone?.message}>
              <TextInput type="tel" autoComplete="off" placeholder="+234 800 000 0000" {...register("phone")} />
            </Field>
            <Field label="Email" error={e.email?.message}>
              <TextInput type="email" autoComplete="off" placeholder="name@example.com" {...register("email")} />
            </Field>
            <Field label="Address" error={e.line?.message} className="md:col-span-2">
              <TextInput autoComplete="off" placeholder="Street and number (optional)" {...register("line")} />
            </Field>
            <Field label="City" error={e.city?.message}>
              <TextInput autoComplete="off" placeholder="Ikeja" {...register("city")} />
            </Field>
            <Field label="State" error={e.state?.message}>
              <TextInput autoComplete="off" placeholder="Lagos" {...register("state")} />
            </Field>
            <div className="md:col-span-2">
              <Controller control={control} name="tags" render={({ field }) => <TagInput value={field.value} onChange={field.onChange} error={e.tags?.message} />} />
            </div>
            <Field label="Notes" error={e.notes?.message} className="md:col-span-2">
              <TextArea rows={4} placeholder="Sizes, preferences, delivery notes…" {...register("notes")} />
            </Field>
          </div>
          <div className="mt-5 flex flex-col gap-3">
            {dup && <DuplicateNote dup={dup} onMerge={editing ? () => void mergeDuplicate() : undefined} merging={merge.isPending} />}
            <ErrorNote error={formError} fallback="We couldn't save this customer. Please try again." />
            <div className="flex flex-col gap-3 md:flex-row">
              <Button type="submit" loading={formState.isSubmitting} loadingText="Saving…" className="md:flex-1">
                {editing ? "Save changes" : "Save customer"}
              </Button>
              <ButtonLink to={editing ? `/customers/${id}` : "/customers"} variant="secondary" className="md:flex-1">Cancel</ButtonLink>
            </div>
          </div>
        </Panel>
        <TipList
          title="Good to know"
          tips={[
            { title: "Name is all you need", body: "Phone and email make it easy to call, email and recognise them on their next order." },
            { title: "No duplicates", body: "If the phone or email already belongs to a customer, we'll point you to that record." },
            { title: "Ready for orders and invoices", body: "Start an order or invoice from the customer's page and their details are filled in." },
          ]}
        />
      </form>
    </div>
  );
}

export const CustomerFormPage = () => (
  <Guard manage>
    <CustomerForm />
  </Guard>
);

// ── 09.03 Customer added ─────────────────────────────────────────────────

function CustomerAdded() {
  const { id } = useParams();
  const passed = (useLocation().state as { customer?: Customer } | null)?.customer;
  const detail = useCustomer(passed ? undefined : id);
  const c = passed ?? detail.data?.customer;
  if (!c && detail.isLoading) return <Loading />;
  if (!c) return <ErrorNote error={detail.error ?? true} fallback="We couldn't load this customer. Please try again." onRetry={() => void detail.refetch()} />;
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Customer added</PageTitle>
      <section className="rounded-2xl bg-success-bg px-5 py-4 shadow-card lg:px-6 lg:py-5">
        <p className="text-caption font-semibold uppercase text-success">Customer saved</p>
        <h2 className="mt-2 text-section-title text-ink-strong">Your customer directory is growing.</h2>
        <p className="mt-2 text-body-sm text-ink-muted">The contact is available for orders, invoices and future sales.</p>
      </section>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel title="Record summary" subtitle="See the important details without leaving this page.">
          <div className="rounded-xl bg-success-bg px-4 py-4">
            <p className="text-caption font-semibold uppercase text-success">Customer saved</p>
            <p className="mt-1 text-title-md text-ink-brand">Added</p>
          </div>
          <div className="mt-5">
            <DetailRows
              rows={[
                ["Contact name", <span className="break-words">{c.name}</span>],
                ["Contact details", <span className="break-all">{contactLine(c)}</span>],
                ["Ready for", "Orders and invoices"],
                ["Directory", "Available to your workspace"],
              ]}
            />
          </div>
          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <ButtonLink to={`/customers/${c._id}`} className="md:flex-1">View customer</ButtonLink>
            <ButtonLink to="/invoices/new" state={{ customer: prefillOf(c) }} variant="secondary" className="md:flex-1">Create invoice</ButtonLink>
            <ButtonLink to="/customers" variant="secondary" className="md:flex-1">Go to customers</ButtonLink>
          </div>
        </Panel>
        <TipList
          title="What you can do next"
          tips={[
            { title: "Review the contact", body: "Verify email, phone and customer details." },
            { title: "Create an order", body: "Connect products and payment information." },
            { title: "Send an invoice", body: "Create and email a branded payment request." },
          ]}
        />
      </div>
    </div>
  );
}

export const CustomerAddedPage = () => (
  <Guard>
    <CustomerAdded />
  </Guard>
);
