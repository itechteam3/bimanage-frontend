import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { IconAlertTriangle, IconCircleCheck, IconHistory, IconPackage, IconRefresh, IconScale } from "@tabler/icons-react";
import { Button, ButtonLink, Field, SelectInput, Spinner, TextInput } from "@/components/ui";
import { AuthNote } from "@/components/layout/AuthLayout";
import { ScanButton } from "@/components/scanner/ScanButton";
import { ChannelPricingSummary } from "@/components/inventory/ChannelPricing";
import { FlowActions, FlowCard, FlowColumns, FlowFootnote, FlowHero, FlowPage, FlowRules, FlowTile, FlowTiles } from "@/components/page/FlowLayout";
import { api, ApiError } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errorMessage";
import { count, naira, shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { findInInventory, inventoryKeys, thresholdOf, useProduct, useStockHistory, type Product, type StockAdjustment } from "@/lib/inventory/api";

// Shared stock: record a change once, review it, save it (Figma 4255:2543
// "Stock adjustment & synchronisation", 4255:3205 "Review & confirm",
// 4255:3554 "Inventory update successful", 4255:4601 "Stock conflict",
// 4255:4950 "Loading & sync error", 4255:4252 "Validation issues") and the
// movement history (4255:2876). Backend #119: the change carries the quantity
// the person saw (409 if stock moved since) and an Idempotency-Key, so a
// retry never adjusts stock twice.

type Op = "receive" | "issue" | "correct";
type Step = "edit" | "review" | "done" | "conflict" | "sync";

const REASONS: Record<Op, string[]> = {
  receive: ["Goods received", "Returned by customer", "Stock count correction", "Other"],
  issue: ["Damaged", "Lost or stolen", "Used in the business", "Stock count correction", "Other"],
  correct: ["Stock count correction", "Other"],
};
const OPS: Array<{ id: Op; label: string; hint: string }> = [
  { id: "receive", label: "Receive", hint: "Add units" },
  { id: "issue", label: "Issue", hint: "Remove units" },
  { id: "correct", label: "Correct", hint: "Set the counted total" },
];
const RULES = [
  { title: "One shared availability", body: "Stock is not duplicated between channels." },
  { title: "Independent selling rules", body: "Separate visibility, tiers and minimums." },
  { title: "Auditable transactions", body: "Record who changed stock and why." },
];
const FOOT = "One product record  ·  One available stock balance  ·  Two channel-specific selling rule sets";

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `adj-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const whole = (v: string) => (/^\d+$/.test(v.replace(/[,\s]/g, "")) ? Number(v.replace(/[,\s]/g, "")) : NaN);

function Loading() {
  return (
    <div className="flex justify-center py-16 text-ink-brand" role="status">
      <Spinner className="size-8" />
      <span className="sr-only">Loading stock…</span>
    </div>
  );
}

function StockTiles({ p }: { p: Product }) {
  const s = p.stock ?? { onHand: p.stockQuantity, reserved: 0, available: p.stockQuantity };
  return (
    <FlowTiles>
      <FlowTile tone="teal" label="On hand" value={`${count(s.onHand)} units`} caption="Physical units" />
      <FlowTile tone="violet" label="Reserved" value={`${count(s.reserved)} units`} caption="Held by checkouts" />
      <FlowTile tone="blue" label="Available" value={`${count(s.available)} units`} caption="Shared by every channel" />
      <FlowTile tone="gold" label="Low-stock alert" value={`${count(thresholdOf(p))} units`} caption="Alert at or below" />
    </FlowTiles>
  );
}

function Side({ p }: { p: Product }) {
  return (
    <>
      <FlowRules title="Inventory & channel rules" rules={RULES} />
      <ChannelPricingSummary channels={p.channels} available={p.stock?.available ?? p.stockQuantity} />
    </>
  );
}

function pricingLine(p: Product) {
  const c = p.channels;
  const parts: string[] = [];
  if (!c || c.retail.enabled) parts.push(`Retail ${naira(c?.retail.price ?? p.sellingPrice)}`);
  if (c?.wholesale.enabled && c.wholesale.tiers[0]) parts.push(`Wholesale ${naira(c.wholesale.tiers[0].unitPrice)}`, `MOQ ${count(c.wholesale.moq ?? c.wholesale.tiers[0].minQty)}`);
  return parts.join("  •  ");
}

export function AdjustStockPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const product = useProduct(id);
  const [step, setStep] = useState<Step>("edit");
  const [op, setOp] = useState<Op>("receive");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [location, setLocation] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ adjustment: StockAdjustment; product: Product } | null>(null);
  const [conflictAt, setConflictAt] = useState<number | null>(null);
  const [scanNote, setScanNote] = useState<string | null>(null);
  // The quantity the person saw, and one retry key per reviewed change.
  const seen = useRef<number | null>(null);
  const key = useRef<string>(newKey());

  const p = product.data;
  if (p && seen.current === null) seen.current = p.stock?.available ?? p.stockQuantity;
  const available = seen.current ?? 0;
  const n = whole(qty);
  const projected = op === "receive" ? available + (n || 0) : op === "issue" ? available - (n || 0) : n || 0;

  const jumpTo = async (code: string) => {
    setScanNote(null);
    try {
      const found = await findInInventory(code);
      if (found[0]) navigate(`/inventory/products/${found[0]._id}/adjust`);
      else setScanNote(`No product in your inventory matches “${code}”.`);
    } catch (err) {
      setScanNote(errorMessage(err, "We couldn't look that up. Check your connection and try again."));
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!Number.isFinite(n)) e.quantity = "Enter a whole number of units.";
    else if (op !== "correct" && n < 1) e.quantity = "Enter at least 1 unit.";
    else if (op === "issue" && n > available) e.quantity = `Available quantity cannot be negative. Only ${count(available)} available.`;
    if (!reason) e.reason = "Choose a reason.";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const save = async () => {
    if (!p) return;
    setBusy(true);
    try {
      const r = await api<{ product: Product; adjustment: StockAdjustment }>(`/inventory/products/${p._id}/adjust`, {
        method: "POST",
        headers: { "Idempotency-Key": key.current },
        body: { type: op, quantity: n, reason, location: location || undefined, reference: reference || undefined, notes: notes || undefined, expectedQuantity: available },
      });
      setResult(r);
      setStep("done");
      void qc.invalidateQueries({ queryKey: inventoryKeys.all });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.data.code === "stock_conflict") {
        setConflictAt(Number(err.data.current));
        setStep("conflict");
      } else if (err instanceof ApiError && err.status === 400) {
        setErrors({ [String(err.data.field || "quantity")]: err.message });
        setStep("edit");
      } else if (err instanceof ApiError && (err.kind !== "http" || err.status >= 500)) {
        // The change may or may not have arrived: retrying with the same key is safe.
        setStep("sync");
      } else {
        setErrors({ form: errorMessage(err, "We couldn't save this change. Check your connection and try again.") });
        setStep("edit");
      }
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    const r = await product.refetch();
    seen.current = r.data ? (r.data.stock?.available ?? r.data.stockQuantity) : seen.current;
    key.current = newKey();
    setErrors({});
    setStep("edit");
  };

  const again = () => {
    seen.current = null;
    key.current = newKey();
    setQty("");
    setReason("");
    setReference("");
    setNotes("");
    setResult(null);
    setStep("edit");
    void product.refetch();
  };

  if (product.isLoading) return <Loading />;
  if (!p) return <AuthNote tone="danger">{errorMessage(product.error, "We couldn't load this product. Check your connection and try again.")}</AuthNote>;

  const actionsBack = (
    <ButtonLink to="/inventory/products" variant="outlined">
      Back to inventory
    </ButtonLink>
  );

  if (step === "done" && result) {
    const after = result.product.stock?.available ?? result.product.stockQuantity;
    return (
      <FlowPage title="Inventory update successful" lead="Changes were saved to your connected product catalogue and stock balance.">
        <FlowHero title="Saved to shared inventory" eyebrow="One stock source  ·  Every selling channel  ·  History preserved" icon={<IconCircleCheck className="size-6" />}>
          Every channel now sells from the updated stock. Your update is saved and recorded in the product history.
        </FlowHero>
        <StockTiles p={result.product} />
        <FlowColumns
          main={
            <FlowCard title="Changes saved successfully" subtitle="Every active channel has the latest confirmed availability and its own selling rules.">
              <div className="rounded-sm border border-line-card px-[11px] py-[10px] text-caption text-ink-strong">
                {p.name}
                {p.sku ? ` · ${p.sku}` : ""} · Ref {result.adjustment.reference || result.adjustment._id.slice(-8).toUpperCase()}
              </div>
              <div className="rounded-sm border border-line-card px-[11px] py-[10px] text-caption text-ink-strong">
                Available {count(result.adjustment.before)} → {count(after)} units. Audit record saved.
              </div>
            </FlowCard>
          }
          side={<Side p={result.product} />}
        />
        <FlowActions>
          <ButtonLink to="/inventory/products" className="md:min-w-[330px]">
            View inventory
          </ButtonLink>
          <Button variant="outlined" onClick={again}>
            Make another adjustment
          </Button>
          <ButtonLink to={`/inventory/products/${p._id}/history`} variant="outlined">
            View movement history
          </ButtonLink>
        </FlowActions>
        <FlowFootnote title="Your stock view is ready for the next decision.">{FOOT}</FlowFootnote>
      </FlowPage>
    );
  }

  if (step === "conflict") {
    return (
      <FlowPage title="Your stock has changed" lead="Someone else, or a new order, changed this product's stock while you were editing. Review the latest stock before confirming the change.">
        <FlowHero title="Resolve the latest stock version" eyebrow="Reserved stock protected  ·  Nothing was changed" icon={<IconAlertTriangle className="size-6" />}>
          Reserved quantities are protected, so overselling can't happen. Reload the latest quantity, then try again.
        </FlowHero>
        <FlowTiles>
          <FlowTile tone="teal" label="You saw" value={`${count(available)} units`} caption="When you started" />
          <FlowTile tone="violet" label="Available now" value={`${count(conflictAt ?? 0)} units`} caption="Latest quantity" />
          <FlowTile tone="blue" label="Your change" value={op === "correct" ? `= ${count(n)}` : `${op === "receive" ? "+" : "−"}${count(n)}`} caption={OPS.find((o) => o.id === op)!.label} />
          <FlowTile tone="gold" label="Saved" value="Nothing yet" caption="Your details are kept" />
        </FlowTiles>
        <FlowColumns
          main={
            <FlowCard title="Check the latest available stock and retry" subtitle="Your quantity, reason and reference stay filled in.">
              <div className="rounded-sm border border-line-card px-[11px] py-[10px] text-caption text-ink-strong">
                Available {count(conflictAt ?? 0)} · Your change {op === "correct" ? `= ${count(n)}` : `${op === "receive" ? "+" : "−"}${count(n)}`}
              </div>
            </FlowCard>
          }
          side={
            <FlowRules
              title="Inventory & channel rules"
              rules={[
                { title: "Respect reserved stock", body: "Available quantity cannot be negative." },
                { title: "Reload latest version", body: "Resolve simultaneous stock edits." },
                { title: "Never overwrite history", body: "Keep the order and adjustment trail." },
              ]}
            />
          }
        />
        <FlowActions>
          <Button onClick={() => void refresh()} className="md:min-w-[330px]">
            <IconRefresh aria-hidden="true" className="size-icon" /> Refresh stock
          </Button>
          {actionsBack}
        </FlowActions>
        <FlowFootnote title="Stock is never overwritten without you seeing the latest figure.">{FOOT}</FlowFootnote>
      </FlowPage>
    );
  }

  if (step === "sync") {
    return (
      <FlowPage title="We couldn't confirm the save" lead="The connection dropped before we heard back. Your last saved stock is still shown, and retrying is safe.">
        <FlowHero title="Retry safely" eyebrow="Pending sync  →  Retry  →  Confirmed" icon={<IconRefresh className="size-6" />}>
          Retrying sends the same change once. If it already arrived, BiManage won't add it again.
        </FlowHero>
        <StockTiles p={p} />
        <FlowColumns
          main={
            <FlowCard title="Inventory sync and recovery" subtitle="The last saved inventory stays visible while you retry.">
              <div className="rounded-sm border border-line-card px-[11px] py-[10px] text-caption text-ink-strong">
                {OPS.find((o) => o.id === op)!.label} {count(n)} units · {reason}
              </div>
            </FlowCard>
          }
          side={
            <FlowRules
              title="Inventory & channel rules"
              rules={[
                { title: "Keep last saved data", body: "Nothing is lost if the connection drops." },
                { title: "Retry once, not twice", body: "The same change is never applied twice." },
                { title: "Show sync status", body: "You'll see when the change is confirmed." },
              ]}
            />
          }
        />
        <FlowActions>
          <Button onClick={() => void save()} loading={busy} loadingText="Retrying…" className="md:min-w-[330px]">
            Retry saving
          </Button>
          {actionsBack}
        </FlowActions>
        <FlowFootnote title="Retrying never creates a duplicate stock adjustment.">{FOOT}</FlowFootnote>
      </FlowPage>
    );
  }

  if (step === "review") {
    return (
      <FlowPage title="Review & confirm inventory changes" lead="Check the change to shared stock before saving. Saving creates an audit record.">
        <FlowHero title="One catalogue. Shared stock." eyebrow="One stock source  ·  Every selling channel  ·  History preserved" icon={<IconScale className="size-6" />}>
          Every channel shares the available units but keeps its own selling prices and rules.
        </FlowHero>
        <StockTiles p={p} />
        <FlowColumns
          main={
            <FlowCard title="Review before saving" subtitle={`${p.name}${p.sku ? ` / ${p.sku}` : ""} · ${reason}${reference ? ` · Ref ${reference}` : ""}`}>
              <div className="rounded-sm border border-accent-navy bg-surface-tint-blue px-[11px] py-[10px] text-body-lg font-semibold text-ink-strong">
                Current: {count(available)} available → Updated: {count(projected)} available
              </div>
              <div className="rounded-sm border border-line-card px-[11px] py-[10px] text-caption text-ink-strong">{pricingLine(p)}</div>
            </FlowCard>
          }
          side={<Side p={p} />}
        />
        <FlowActions>
          <Button onClick={() => void save()} loading={busy} loadingText="Saving…" className="md:min-w-[330px]">
            Confirm and save changes
          </Button>
          <Button variant="outlined" onClick={() => setStep("edit")}>
            Change details
          </Button>
        </FlowActions>
        <FlowFootnote title="Saving updates every channel at once.">{FOOT}</FlowFootnote>
      </FlowPage>
    );
  }

  // Edit
  return (
    <FlowPage title="Stock adjustment" lead="Record an inventory change once. Every selling channel sees the new availability.">
      <div className="flex flex-wrap gap-3">
        <ScanButton label="Scan another product" onCode={(c) => void jumpTo(c)} />
        <ButtonLink to={`/inventory/products/${p._id}/history`} size="md" variant="outlined">
          <IconHistory aria-hidden="true" className="size-icon" /> View movement history
        </ButtonLink>
      </div>
      {scanNote && <AuthNote tone="danger">{scanNote}</AuthNote>}
      <FlowHero title={p.name} eyebrow={[p.category, p.sku && `SKU ${p.sku}`, p.barcode && `Barcode ${p.barcode}`].filter(Boolean).join("  ·  ") || undefined} icon={<IconPackage className="size-6" />}>
        One catalogue, one stock balance. Changes here apply to every selling channel.
      </FlowHero>
      <StockTiles p={p} />
      <FlowColumns
        main={
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (validate()) {
                key.current = newKey();
                setStep("review");
              }
            }}
          >
            <FlowCard title="Shared stock adjustment" subtitle="Choose what happened, how many units and why.">
              {(errors.quantity || errors.reason) && Object.keys(errors).length > 1 && (
                <div role="alert" className="rounded-md bg-danger-bg p-4 text-body-sm text-danger">
                  <p className="font-semibold">Please correct these fields</p>
                  <ul className="mt-1 list-disc pl-5">
                    {Object.values(errors).map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-[11px] font-medium leading-4 text-ink-strong">Adjustment operation</legend>
                <div className="grid grid-cols-3 gap-2">
                  {OPS.map((o) => (
                    <label key={o.id} className={cn("flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-sm border px-2 py-2 text-center has-[:focus-visible]:shadow-focus", op === o.id ? "border-accent-navy bg-surface-tint-blue" : "border-line-card")}>
                      <input type="radio" name="op" value={o.id} checked={op === o.id} onChange={() => { setOp(o.id); setReason(""); }} className="sr-only" />
                      <span className="text-body-sm font-semibold text-ink-strong">{o.label}</span>
                      <span className="text-[11px] leading-4 text-ink-muted">{o.hint}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
                <Field label={op === "correct" ? "Counted total" : "Quantity"} required error={errors.quantity}>
                  <TextInput inputMode="numeric" placeholder={op === "correct" ? "120" : "24"} value={qty} onChange={(e) => setQty(e.target.value)} />
                </Field>
                <Field label="Projected available">
                  <TextInput
                    readOnly
                    aria-live="polite"
                    value={Number.isFinite(n) ? (op === "correct" ? `${count(projected)} units` : `${count(available)} ${op === "receive" ? "+" : "−"} ${count(n)} = ${count(projected)} units`) : `${count(available)} units`}
                    className={cn(projected < 0 && "lg:border-danger")}
                  />
                </Field>
                <Field label="Adjustment reason" required error={errors.reason}>
                  <SelectInput value={reason} onChange={(e) => setReason(e.target.value)}>
                    <option value="">Choose…</option>
                    {REASONS[op].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Audit reference" error={errors.reference}>
                  <TextInput placeholder="GRN-0042" value={reference} onChange={(e) => setReference(e.target.value)} />
                </Field>
                <Field label="Location">
                  <TextInput placeholder="Main warehouse" value={location} onChange={(e) => setLocation(e.target.value)} />
                </Field>
                <Field label="Notes">
                  <TextInput placeholder="Checked and counted" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </Field>
              </div>
              {errors.form && <AuthNote tone="danger">{errors.form}</AuthNote>}
              <Button type="submit" className="md:self-start md:min-w-[330px]">
                Review adjustment
              </Button>
            </FlowCard>
          </form>
        }
        side={<Side p={p} />}
      />
      <FlowActions>
        {actionsBack}
        <ButtonLink to={`/inventory/products/${p._id}`} variant="outlined">
          Edit product details
        </ButtonLink>
      </FlowActions>
      <FlowFootnote title="Every change is recorded with who made it and why.">{FOOT}</FlowFootnote>
    </FlowPage>
  );
}

// ── Movement history ─────────────────────────────────────────────────────

const TAGS = ["All", "Received", "Retail", "Wholesale", "Adjusted"] as const;
type Tag = (typeof TAGS)[number];

const tagOf = (h: StockAdjustment): Exclude<Tag, "All"> => (h.tag as Exclude<Tag, "All">) ?? (h.type === "initial" || h.type === "increase" ? "Received" : "Adjusted");

const TAG_TONE: Record<Exclude<Tag, "All">, string> = {
  Received: "bg-success-bg text-accent-green",
  Retail: "bg-surface-tint-blue text-accent-blue",
  Wholesale: "bg-surface-tint-gold text-accent-gold",
  Adjusted: "bg-surface-tint-violet text-accent-lavender",
};

export function StockHistoryPage() {
  const { id } = useParams();
  const product = useProduct(id);
  const history = useStockHistory(id);
  const [filter, setFilter] = useState<Tag>("All");
  const rows = useMemo(() => (history.data ?? []).filter((h) => filter === "All" || tagOf(h) === filter), [history.data, filter]);
  if (!id) return <Navigate to="/inventory/products" replace />;
  if (product.isLoading) return <Loading />;
  const p = product.data;
  if (!p) return <AuthNote tone="danger">{errorMessage(product.error, "We couldn't load this product. Check your connection and try again.")}</AuthNote>;
  return (
    <FlowPage title="Inventory movement & audit history" lead="Trace stock receipts, sales, corrections and who made each change.">
      <FlowHero title={p.name} eyebrow={p.sku ? `SKU ${p.sku}` : undefined} icon={<IconHistory className="size-6" />}>
        Every unit in and out, newest first. Sales show the channel they came from.
      </FlowHero>
      <StockTiles p={p} />
      <FlowColumns
        main={
          <FlowCard title="Inventory movement history" subtitle="Newest first.">
            <div role="group" aria-label="Show movements" className="flex flex-wrap gap-2">
              {TAGS.map((t) => (
                <button key={t} type="button" aria-pressed={filter === t} onClick={() => setFilter(t)} className={cn("min-h-11 rounded-full border px-4 text-body-sm font-semibold", filter === t ? "border-accent-navy bg-surface-tint-blue text-ink-strong" : "border-line-card text-ink-muted hover:text-ink-strong")}>
                  {t}
                </button>
              ))}
            </div>
            {history.isLoading && <Loading />}
            {history.error && <AuthNote tone="danger">{errorMessage(history.error, "We couldn't load the history. Check your connection and try again.")}</AuthNote>}
            {history.data && rows.length === 0 && <p className="text-body-lg text-ink-muted">{filter === "All" ? "No stock changes recorded yet." : `No ${filter.toLowerCase()} movements yet.`}</p>}
            <ul aria-label="Stock movements" className="flex flex-col gap-2">
              {rows.map((h) => {
                const delta = h.after - h.before;
                const tag = tagOf(h);
                return (
                  <li key={h._id} className="flex items-start justify-between gap-3 rounded-sm border border-line-card px-[11px] py-[10px]">
                    <span className="flex min-w-0 flex-col">
                      <span className="text-body-sm font-semibold text-ink-strong">
                        <span className={cn(delta > 0 ? "text-success" : delta < 0 ? "text-danger" : "")}>{delta > 0 ? `+${count(delta)}` : delta < 0 ? `−${count(-delta)}` : "±0"}</span>
                        {"  "}
                        {h.type === "initial" ? "Opening stock" : h.reason}
                      </span>
                      <span className="text-caption text-ink-muted">
                        {[h.reference, h.location, h.actor?.name, shortDate(h.createdAt)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold", TAG_TONE[tag])}>{tag}</span>
                  </li>
                );
              })}
            </ul>
          </FlowCard>
        }
        side={<Side p={p} />}
      />
      <FlowActions>
        <ButtonLink to={`/inventory/products/${p._id}/adjust`} className="md:min-w-[330px]">
          Adjust stock
        </ButtonLink>
        <ButtonLink to="/inventory/products" variant="outlined">
          Back to inventory
        </ButtonLink>
      </FlowActions>
      <FlowFootnote title="History is never overwritten.">
        {FOOT}. <Link to={`/inventory/products/${p._id}`} className="font-semibold text-ink-brand hover:underline">Edit product details</Link>
      </FlowFootnote>
    </FlowPage>
  );
}
