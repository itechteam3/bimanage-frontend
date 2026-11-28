import { IconPlus, IconTrash } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { Field, Status, TextInput } from "@/components/ui";
import { cn } from "@/lib/cn";
import { count, naira } from "@/lib/format";
import type { Product, ProductChannels } from "@/lib/inventory/api";

// Selling rules per channel on a product (Figma 4255:1877 "Add or edit
// product / Dual pricing", 4255:2210 "Channel availability & selling rules").
// One product, one shared stock balance; retail and wholesale keep their own
// price and quantity rules (backend #118).

export interface TierDraft {
  minQty: string;
  unitPrice: string;
}
export interface ChannelDraft {
  retailEnabled: boolean;
  wholesaleEnabled: boolean;
  moq: string;
  tiers: TierDraft[];
}

export const MAX_TIERS = 10;
const num = (v: string) => Number(String(v).replace(/[₦,\s]/g, ""));

export function draftFrom(p?: Pick<Product, "channels" | "sellingPrice">): ChannelDraft {
  const c = p?.channels;
  return {
    retailEnabled: c ? c.retail.enabled : true,
    wholesaleEnabled: Boolean(c?.wholesale.enabled),
    moq: c?.wholesale.moq ? String(c.wholesale.moq) : "",
    tiers: (c?.wholesale.tiers ?? []).map((t) => ({ minQty: String(t.minQty), unitPrice: String(t.unitPrice) })),
  };
}

/** The channels to send, with the retail price from the form's price field. */
export function channelsFrom(d: ChannelDraft, retailPrice: number | undefined): ProductChannels {
  const tiers = d.tiers.filter((t) => t.minQty.trim() || t.unitPrice.trim()).map((t) => ({ minQty: num(t.minQty), unitPrice: num(t.unitPrice) }));
  return {
    retail: { enabled: d.retailEnabled, price: retailPrice && retailPrice > 0 ? retailPrice : null },
    wholesale: { enabled: d.wholesaleEnabled, moq: d.moq.trim() ? num(d.moq) : null, tiers },
  };
}

function Toggle({ id, checked, onChange, label, hint }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-brand-navy" />
      <span className="flex flex-col">
        <span className="text-body-lg font-semibold text-ink-strong">{label}</span>
        <span className="text-caption text-ink-muted">{hint}</span>
      </span>
    </label>
  );
}

/**
 * The channel section of the product form. `errors` are the server's
 * field messages ("channels.wholesale.tiers.0.unitPrice" → message).
 */
export function ChannelPricingEditor({
  value,
  onChange,
  errors = {},
  wholesaleAvailable,
  retailPriceField,
}: {
  value: ChannelDraft;
  onChange: (d: ChannelDraft) => void;
  errors?: Record<string, string>;
  /** False when the business hasn't set up wholesale yet (link to Settings instead). */
  wholesaleAvailable: boolean;
  /** The form's existing price input, shown as the retail price. */
  retailPriceField: React.ReactNode;
}) {
  const set = (patch: Partial<ChannelDraft>) => onChange({ ...value, ...patch });
  const setTier = (i: number, patch: Partial<TierDraft>) => set({ tiers: value.tiers.map((t, n) => (n === i ? { ...t, ...patch } : t)) });
  const showWholesale = wholesaleAvailable || value.wholesaleEnabled;
  return (
    <fieldset className="flex flex-col gap-5 rounded-lg border border-line-card p-4 lg:p-[18px]">
      <legend className="px-1 text-card-heading text-ink-strong">Channel selling settings</legend>
      {errors.channels && <p role="alert" className="text-body-sm text-danger">{errors.channels}</p>}

      <div className="flex flex-col gap-4">
        <Toggle id="channel-retail" checked={value.retailEnabled} onChange={(v) => set({ retailEnabled: v })} label="Retail channel" hint="Enabled for storefront and till sales" />
        {value.retailEnabled && <div className="pl-8">{retailPriceField}</div>}
      </div>

      {showWholesale ? (
        <div className="flex flex-col gap-4 border-t border-line-card pt-5">
          <Toggle id="channel-wholesale" checked={value.wholesaleEnabled} onChange={(v) => set({ wholesaleEnabled: v, tiers: v && !value.tiers.length ? [{ minQty: value.moq, unitPrice: "" }] : value.tiers })} label="Wholesale channel" hint="Enabled for trade buyers" />
          {(value.wholesaleEnabled || value.moq || value.tiers.length > 0) && (
            <div className={cn("flex flex-col gap-4 pl-8", !value.wholesaleEnabled && "opacity-70")}>
              {!value.wholesaleEnabled && <p className="text-caption text-ink-muted">Saved for when you sell this product wholesale again.</p>}
              <Field label="Minimum bulk quantity" required={value.wholesaleEnabled} error={errors["channels.wholesale.moq"]} hint="Units per wholesale order">
                <TextInput inputMode="numeric" placeholder="10" value={value.moq} onChange={(e) => set({ moq: e.target.value })} />
              </Field>
              <div className="flex flex-col gap-3">
                <p className="text-body-sm font-semibold text-ink-strong">Bulk price tiers</p>
                {errors["channels.wholesale.tiers"] && <p role="alert" className="text-body-sm text-danger">{errors["channels.wholesale.tiers"]}</p>}
                <ul className="flex flex-col gap-3">
                  {value.tiers.map((t, i) => (
                    <li key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-3">
                      <Field label={`Tier ${i + 1}: from (units)`} error={errors[`channels.wholesale.tiers.${i}.minQty`]}>
                        <TextInput inputMode="numeric" placeholder={i === 0 ? "10" : "50"} value={t.minQty} onChange={(e) => setTier(i, { minQty: e.target.value })} />
                      </Field>
                      <Field label="Price per unit (₦)" error={errors[`channels.wholesale.tiers.${i}.unitPrice`]}>
                        <TextInput inputMode="decimal" placeholder="10,000" value={t.unitPrice} onChange={(e) => setTier(i, { unitPrice: e.target.value })} />
                      </Field>
                      <button type="button" onClick={() => set({ tiers: value.tiers.filter((_, n) => n !== i) })} aria-label={`Remove tier ${i + 1}`} className="mb-1 flex size-11 items-center justify-center rounded-md text-ink-muted hover:bg-surface-pale hover:text-danger">
                        <IconTrash aria-hidden="true" className="size-icon" />
                      </button>
                    </li>
                  ))}
                </ul>
                {value.tiers.length < MAX_TIERS && (
                  <button type="button" onClick={() => set({ tiers: [...value.tiers, { minQty: "", unitPrice: "" }] })} className="flex min-h-11 items-center gap-2 self-start text-body-sm font-semibold text-ink-brand hover:underline">
                    <IconPlus aria-hidden="true" className="size-icon-sm" /> Add a price tier
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="border-t border-line-card pt-5 text-caption text-ink-muted">
          Want to sell this product in bulk too?{" "}
          <Link to="/settings/channels" className="font-semibold text-ink-brand hover:underline">
            Activate wholesale in Settings
          </Link>
        </p>
      )}
    </fieldset>
  );
}

/** "Retail · ACTIVE / Unit price ₦12,500 …" summary card (side column). */
export function ChannelPricingSummary({ channels, available }: { channels?: ProductChannels; available: number }) {
  if (!channels) return null;
  const { retail, wholesale } = channels;
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-line-card bg-surface-card p-[17px]">
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-2 text-[15px] font-semibold leading-[22px] text-ink-strong">
          Retail <Status tone={retail.enabled ? "success" : "neutral"}>{retail.enabled ? "Active" : "Off"}</Status>
        </p>
        <p className="text-[13px] font-medium leading-5 text-accent-blue">{retail.enabled ? (retail.price ? `Unit price ${naira(retail.price)}` : "Set a retail price") : "Not sold in retail"}</p>
      </div>
      <div className="flex flex-col gap-1 border-t border-line-card pt-4">
        <p className="flex items-center gap-2 text-[15px] font-semibold leading-[22px] text-ink-strong">
          Wholesale <Status tone={wholesale.enabled ? "success" : "neutral"}>{wholesale.enabled ? "Active" : "Off"}</Status>
        </p>
        {wholesale.enabled ? (
          wholesale.tiers.map((t, i) => (
            <p key={i} className="text-caption font-medium text-ink-strong">
              {i === 0 && wholesale.moq ? `MOQ ${count(wholesale.moq)} units` : `${count(t.minQty)}+ units`} • {naira(t.unitPrice)} / unit
            </p>
          ))
        ) : (
          <p className="text-caption text-ink-muted">Not sold wholesale</p>
        )}
      </div>
      <p className="text-[11px] leading-4 text-ink-muted">
        {retail.enabled && wholesale.enabled ? "Both draw" : "Sales draw"} from {count(available)} available unit{available === 1 ? "" : "s"}.
      </p>
    </section>
  );
}

/** Both / Retail / Wholesale badge for product lists. */
export function ChannelBadge({ badge }: { badge?: Product["channelBadge"] }) {
  if (!badge || badge === "none") return null;
  const label = badge === "both" ? "Both" : badge === "retail" ? "Retail" : "Wholesale";
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-caption font-semibold", badge === "wholesale" ? "bg-surface-tint-gold text-accent-gold" : badge === "both" ? "bg-surface-tint-violet text-accent-lavender" : "bg-surface-tint-blue text-accent-blue")}>{label}</span>;
}
