import { useMemo, useState } from "react";
import { UpdatedNote, newRowClass } from "@/components/feedback/UpdatedNote";
import { useNewItems } from "@/lib/realtime/useLiveList";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { IconDownload, IconPlus, IconSearch, IconScan, IconFileSpreadsheet, IconAlertTriangle } from "@tabler/icons-react";
import { Button, ButtonLink, Field, Spinner, TextInput, buttonClasses } from "@/components/ui";
import { DetailRows, IntroCard, KpiCard, PageTitle, Panel } from "@/components/page/Blocks";
import { AuthNote } from "@/components/layout/AuthLayout";
import { StockBadge } from "@/components/inventory/StockBadge";
import { downloadInventoryCsv, stockState, useInventoryStats, useProducts } from "@/lib/inventory/api";
import { saveBlob } from "@/lib/api/client";
import { useCan } from "@/lib/auth/useCan";
import { count, naira, nairaCompact } from "@/lib/format";
import { errorMessage } from "@/lib/api/errorMessage";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { cn } from "@/lib/cn";
import { AddFirstProduct } from "./ProductFormPages";
import { useUrlState } from "@/lib/nav/useUrlState";

const Loading = ({ label = "Loading…" }: { label?: string }) => (
  <div className="flex justify-center py-16 text-ink-brand" role="status">
    <Spinner className="size-8" />
    <span className="sr-only">{label}</span>
  </div>
);

/** Shared download button: saves the CSV and opens the "export ready" page. */
export function useInventoryExport() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (status?: "low") => {
    setBusy(true);
    setError(null);
    try {
      const { blob, filename, count: records } = await downloadInventoryCsv(status);
      saveBlob(blob, filename);
      navigate("/inventory/export", { state: { filename, records, status } });
    } catch (err) {
      setError(errorMessage(err, "The export couldn't be prepared. Please try again."));
    } finally {
      setBusy(false);
    }
  };
  return { run, busy, error };
}

// 09.10 Inventory overview (09.09 when there are no products yet)
export function InventoryOverviewPage() {
  const stats = useInventoryStats();
  const canEdit = useCan("manageInventory");
  const s = stats.data;

  if (stats.isLoading) return <Loading label="Loading inventory…" />;
  if (stats.error) return <ErrorNote error={stats.error} fallback="We couldn't load your inventory. Please try again." onRetry={() => void stats.refetch()} />;
  if (s && s.totalProducts === 0) return canEdit ? <AddFirstProduct /> : <AuthNote>No products have been added yet.</AuthNote>;

  const total = s?.totalProducts ?? 0;
  const { available = 0, lowStock = 0, outOfStock = 0 } = s?.stockAvailability ?? {};
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        actions={
          <div className="flex flex-wrap gap-3">
            <ButtonLink to="/inventory/lookup" variant="secondary" size="md">
              <IconScan aria-hidden="true" className="size-icon" /> Barcode lookup
            </ButtonLink>
            <ButtonLink to="/inventory/products" size="md">
              Inventory products
            </ButtonLink>
          </div>
        }
      >
        Inventory overview
      </PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Monitor stock value, availability and low-stock alerts.</p>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <KpiCard tone="orders" label="Total products" value={count(total)} caption={`${count(s?.totalStock)} units in stock`} />
        <KpiCard tone="revenue" label="Stock value" value={nairaCompact(s?.totalInventoryValue)} caption="At selling price" />
        <KpiCard tone="stock" label="Low stock" value={count(lowStock)} caption="Restock reminders" />
        <KpiCard tone="stock" label="Out of stock" value={outOfStock ? count(outOfStock) : "—"} caption={outOfStock ? "Sold out" : "Nothing sold out"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel title="Stock health" subtitle="Products that need attention, sold-out first.">
          {s?.lowStockProducts.length ? (
            <ul className="flex flex-col">
              {s.lowStockProducts.slice(0, 6).map((p, i) => (
                <li key={p._id}>
                  <Link to={`/inventory/products/${p._id}/adjust`} className={cn("grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg px-3 py-4 md:grid-cols-[2fr_1fr_1fr_auto]", i % 2 === 0 && "bg-surface-pale")}>
                    <span className="text-body font-semibold text-ink-strong">{p.name}</span>
                    <span className="hidden text-body-sm text-ink-muted md:block">{p.sku ?? "—"}</span>
                    <span className="hidden text-body-sm text-ink-strong md:block">
                      {count(p.stock)} available · alert at {count(p.threshold)}
                    </span>
                    <span className={cn("text-body-sm font-semibold", p.status === "out" ? "text-danger" : "text-warning")}>{p.status === "out" ? "Sold out" : "Low"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-body-lg text-ink-secondary">Every product is above its low-stock alert. Nice.</p>
          )}
          {(s?.lowStockProducts.length ?? 0) > 0 && (
            <Link to="/inventory/low-stock" className="mt-4 inline-block text-body-sm font-semibold text-ink-brand hover:underline">
              See all stock alerts →
            </Link>
          )}
        </Panel>
        <Panel tone="pale" title="Next actions & insights">
          <dl className="flex flex-col gap-4">
            {[
              ["Units in stock", count(s?.totalStock)],
              ["Total sales recorded", naira(s?.totalSales)],
              ["Best seller", s?.topSelling[0]?.totalSold ? `${s.topSelling[0].name} · ${count(s.topSelling[0].totalSold)} sold` : "No sales yet"],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-md bg-surface-card px-3 py-2">
                <dt className="text-caption font-semibold uppercase text-ink-muted">{k}</dt>
                <dd className="text-body-lg text-ink-strong">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 rounded-xl border border-line-card bg-surface-card p-4">
            <p className="text-caption font-semibold uppercase text-ink-brand">Product availability</p>
            <p className="mt-1 text-caption text-ink-muted">{count(total)} products</p>
            <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-surface-disabled" aria-hidden="true">
              <span className="bg-kpi-revenue-line" style={{ width: `${pct(available)}%` }} />
              <span className="bg-warning" style={{ width: `${pct(lowStock)}%` }} />
              <span className="bg-danger" style={{ width: `${pct(outOfStock)}%` }} />
            </div>
            <ul className="mt-3 flex flex-col gap-1 text-caption font-semibold">
              <li className="text-kpi-revenue-fg">● In stock {count(available)} · {pct(available)}%</li>
              <li className="text-warning">● Low {count(lowStock)} · {pct(lowStock)}%</li>
              <li className="text-danger">● Sold out {count(outOfStock)} · {pct(outOfStock)}%</li>
            </ul>
          </div>
        </Panel>
      </div>
    </div>
  );
}

// 09.11 Inventory products (register)
export function ProductsPage() {
  const products = useProducts();
  const fresh = useNewItems(products.data?.map((p) => p._id));
  const canEdit = useCan("manageInventory");
  const exp = useInventoryExport();
  const [q, setQ] = useUrlState<string>("q", "");
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const all = products.data ?? [];
    return term ? all.filter((p) => [p.name, p.sku, p.barcode, p.category, p.brand].some((v) => v?.toLowerCase().includes(term))) : all;
  }, [products.data, q]);
  const all = products.data ?? [];
  const categories = [...new Set(all.map((p) => p.category).filter(Boolean))];
  const needRestock = all.filter((p) => stockState(p) !== "ok").length;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        actions={
          canEdit && (
            <ButtonLink to="/inventory/products/new" size="md">
              <IconPlus aria-hidden="true" className="size-icon" /> Add product
            </ButtonLink>
          )
        }
      >
        Inventory products
      </PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Update quantities, pricing, barcodes and categories.</p>
      <IntroCard eyebrow="Inventory" title={`${count(all.length)} products · ${count(needRestock)} need restocking`} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Inventory product register" subtitle="Search, edit, export or restock products.">
          <div className="max-w-sm">
            <Field label="Search">
              <TextInput type="search" placeholder="Search products, SKU or barcode" value={q} onChange={(e) => setQ(e.target.value)} trailing={<IconSearch aria-hidden="true" className="mr-2 size-icon text-ink-muted" />} />
            </Field>
          </div>
          {products.isLoading && <Loading />}
          <ErrorNote error={products.error} fallback="We couldn't load your products. Please try again." onRetry={() => void products.refetch()} />
          {products.data && <UpdatedNote updatedAt={products.dataUpdatedAt} className="mt-3" />}
          {products.data && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[34rem] border-separate border-spacing-0 text-left text-body-sm">
                <caption className="sr-only">Inventory products</caption>
                <thead className="text-caption font-semibold uppercase text-ink-muted">
                  <tr>
                    <th scope="col" className="px-3 py-3">Product</th>
                    <th scope="col" className="px-3 py-3">Price</th>
                    <th scope="col" className="px-3 py-3">Stock</th>
                    <th scope="col" className="px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p, i) => (
                    <tr key={p._id} data-new={fresh.has(p._id) || undefined} className={cn(i % 2 === 1 && "bg-surface-pale", fresh.has(p._id) && newRowClass)}>
                      <td className="rounded-l-lg px-3 py-4">
                        <Link to={`/inventory/products/${p._id}`} className="font-semibold text-ink-strong hover:underline">
                          {p.name}
                        </Link>
                        {p.sku && <span className="block text-caption text-ink-muted">{p.sku}</span>}
                      </td>
                      <td className="px-3 py-4 text-ink-strong">{naira(p.sellingPrice)}</td>
                      <td className="px-3 py-4 text-ink-strong">{count(p.stockQuantity)} available</td>
                      <td className="rounded-r-lg px-3 py-4">
                        <StockBadge product={p} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {list.length === 0 && <p className="py-8 text-center text-body-lg text-ink-secondary">{q ? `No products match “${q}”.` : "No products yet."}</p>}
            </div>
          )}
        </Panel>
        <Panel tone="pale" title="Details & actions">
          <DetailRows
            rows={[
              ["Categories", categories.length ? categories.join(" • ") : "None yet"],
              ["Alerts", needRestock ? `${needRestock} item${needRestock === 1 ? "" : "s"} need restocking` : "None"],
              ["Lookup", <Link to="/inventory/lookup" className="font-semibold text-ink-brand hover:underline">Scan or enter a barcode</Link>],
            ]}
          />
          <div className="mt-6 flex flex-col gap-3">
            <Button variant="secondary" size="md" onClick={() => void exp.run()} loading={exp.busy} loadingText="Preparing CSV…">
              <IconDownload aria-hidden="true" className="size-icon" /> Export inventory CSV
            </Button>
            {needRestock > 0 && (
              <ButtonLink to="/inventory/low-stock" variant="secondary" size="md">
                <IconAlertTriangle aria-hidden="true" className="size-icon" /> View stock alerts
              </ButtonLink>
            )}
            {exp.error && <AuthNote tone="danger">{exp.error}</AuthNote>}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// 09.07 Stock alerts and replenishment
export function LowStockPage() {
  const stats = useInventoryStats();
  const exp = useInventoryExport();
  const [q, setQ] = useUrlState<string>("q", "");
  const items = (stats.data?.lowStockProducts ?? []).filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()));
  const soldOut = stats.data?.stockAvailability.outOfStock ?? 0;
  const low = stats.data?.stockAvailability.lowStock ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        actions={
          <Button size="md" onClick={() => void exp.run("low")} loading={exp.busy} loadingText="Preparing CSV…">
            <IconDownload aria-hidden="true" className="size-icon" /> Export low stock CSV
          </Button>
        }
      >
        Stock alerts and replenishment
      </PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Find sold-out and below-threshold products.</p>
      <IntroCard eyebrow="Workspace / Inventory" title="Inventory alerts use each product's configured stock threshold." />
      {exp.error && <AuthNote tone="danger">{exp.error}</AuthNote>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Items needing attention" subtitle="Restock or adjust each product.">
          <div className="max-w-sm">
            <Field label="Search">
              <TextInput type="search" placeholder="Search low-stock products" value={q} onChange={(e) => setQ(e.target.value)} />
            </Field>
          </div>
          {stats.isLoading && <Loading />}
          <ul className="mt-4 flex flex-col">
            {items.map((p, i) => (
              <li key={p._id} className={cn("grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg px-3 py-4 md:grid-cols-[2fr_1fr_1fr_auto]", i % 2 === 1 && "bg-surface-pale")}>
                <span className="text-body font-semibold text-ink-strong">{p.name}</span>
                <span className="hidden text-body-sm text-ink-strong md:block">{count(p.stock)} available</span>
                <span className="hidden text-body-sm text-ink-muted md:block">Threshold {count(p.threshold)}</span>
                <span className="flex items-center gap-3">
                  <span className={cn("text-body-sm font-semibold", p.status === "out" ? "text-danger" : "text-warning")}>{p.status === "out" ? "Out" : "Low"}</span>
                  <Link to={`/inventory/products/${p._id}/adjust`} className={buttonClasses({ variant: "secondary", size: "md" })}>
                    Restock
                  </Link>
                </span>
              </li>
            ))}
          </ul>
          {stats.data && items.length === 0 && <p className="py-8 text-center text-body-lg text-ink-secondary">{q ? "No matching products." : "Nothing needs restocking right now."}</p>}
        </Panel>
        <Panel tone="pale" title="Details & actions">
          <DetailRows
            rows={[
              ["Sold out", `${count(soldOut)} product${soldOut === 1 ? "" : "s"}`],
              ["Low stock", `${count(low)} product${low === 1 ? "" : "s"}`],
              ["Alert status", "Enabled"],
              ["Next action", "Restock • Adjust • Export"],
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}

// 09.08 Export completed
export function ExportReadyPage() {
  const exp = useInventoryExport();
  const state = (useLocation().state ?? {}) as { filename?: string; records?: number; status?: "low" };
  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        actions={
          <Button size="md" onClick={() => void exp.run(state.status)} loading={exp.busy} loadingText="Preparing CSV…">
            <IconDownload aria-hidden="true" className="size-icon" /> Download again
          </Button>
        }
      >
        Inventory report prepared
      </PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Your stock records are ready.</p>
      <IntroCard eyebrow="Workspace / Inventory" title="The CSV export includes quantities, SKU, barcode, price, threshold and category." />
      {exp.error && <AuthNote tone="danger">{exp.error}</AuthNote>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel title="CSV report prepared" subtitle="Open it in Excel, Google Sheets or another spreadsheet app.">
          <div className="flex items-center gap-4 rounded-xl bg-surface-pale p-4">
            <IconFileSpreadsheet aria-hidden="true" className="size-10 text-kpi-revenue-fg" stroke={1.5} />
            <p className="break-all text-body-lg font-semibold text-ink-strong">{state.filename ?? "inventory.csv"}</p>
          </div>
          <div className="mt-5">
            <DetailRows
              rows={[
                ["Report", state.status === "low" ? "Low stock and sold out" : "Inventory stock ledger"],
                ["File type", "CSV"],
                ["Records", state.records !== undefined ? `${count(state.records)} product entries` : "—"],
                ["Period", "Current inventory"],
              ]}
            />
          </div>
        </Panel>
        <Panel tone="pale" title="What is in the CSV?">
          <p className="text-body-lg text-ink-strong">Each export includes name, SKU, barcode, category, price, quantity, alert threshold, stock value and status.</p>
          <p className="mt-3 text-body-sm text-ink-muted">Contents come from your current inventory records.</p>
          <ButtonLink to="/inventory/products" variant="secondary" size="md" className="mt-6 w-full">
            Back to products
          </ButtonLink>
        </Panel>
      </div>
    </div>
  );
}

