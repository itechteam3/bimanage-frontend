import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { IconPrinter } from "@tabler/icons-react";
import { Button, Field, Spinner, TextInput } from "@/components/ui";
import { HelpPanel, IntroCard, PageTitle, Panel } from "@/components/page/Blocks";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { barcodeFormat, MAX_LABEL_PRODUCTS, paginate, perPage, SHEETS, useLabelCodes, type LabelProduct, type Sheet, type SheetId } from "@/lib/labels/labels";
import { labelLink } from "@/lib/scanner/scanner";
import { count, naira } from "@/lib/format";
import { cn } from "@/lib/cn";
import "./labels.css";

// 09.xx Print product labels: one product (product page) or many (product
// list). Each label has the name, price, SKU, a barcode and a QR code with a
// BiManage link to the product, on A4 sticker sheets or 50 × 25 mm thermal
// labels. Products without a barcode get a stable one first (backend #114).

type Art = Record<string, { barcode: string; qr: string }>;

/** Barcode and QR SVGs for each code (libraries load only on this page). */
function useLabelArt(products: LabelProduct[] | undefined) {
  const [art, setArt] = useState<Art>({});
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!products?.length) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ default: JsBarcode }, QR] = await Promise.all([import("jsbarcode"), import("qrcode")]);
        const out: Art = {};
        for (const p of products) {
          const code = p.barcode;
          if (!code || out[code]) continue;
          const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          try {
            JsBarcode(svg, code, { format: barcodeFormat(code), margin: 0, height: 60, width: 2, fontSize: 18, textMargin: 2, displayValue: true });
          } catch {
            JsBarcode(svg, code, { format: "CODE128", margin: 0, height: 60, width: 2, fontSize: 18, textMargin: 2, displayValue: true });
          }
          svg.setAttribute("preserveAspectRatio", "none");
          svg.removeAttribute("width");
          svg.removeAttribute("height");
          const qr = await QR.toString(labelLink(code), { type: "svg", margin: 0, errorCorrectionLevel: "M" });
          out[code] = { barcode: svg.outerHTML, qr };
        }
        if (!cancelled) setArt(out);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [products]);
  return { art, failed };
}

function Label({ p, sheet, art, showPrice }: { p: LabelProduct; sheet: Sheet; art?: Art[string]; showPrice: boolean }) {
  return (
    <div className={cn("bm-label", `bm-label-${sheet.id}`)} style={{ width: `${sheet.label.width}mm`, height: `${sheet.label.height}mm` }}>
      <div className="bm-label-head">
        <p className="bm-label-name">{p.name}</p>
        {showPrice && <p className="bm-label-price">{naira(p.sellingPrice)}</p>}
      </div>
      <div className="bm-label-codes">
        <div className="bm-label-barcode" aria-label={`Barcode ${p.barcode ?? ""}`} role="img" dangerouslySetInnerHTML={art ? { __html: art.barcode } : undefined} />
        <div className="bm-label-qr" aria-label="QR code" role="img" dangerouslySetInnerHTML={art ? { __html: art.qr } : undefined} />
      </div>
      {p.sku && <p className="bm-label-sku">SKU {p.sku}</p>}
    </div>
  );
}

export function LabelsPage() {
  const [params] = useSearchParams();
  const state = useLocation().state as { ids?: string[] } | null;
  const ids = useMemo(
    () => [...new Set((state?.ids?.length ? state.ids : (params.get("ids") ?? "").split(",")).map((s) => s.trim()).filter(Boolean))].slice(0, MAX_LABEL_PRODUCTS),
    [state, params]
  );
  const codes = useLabelCodes();
  const [sheetId, setSheetId] = useState<SheetId>(() => (params.get("sheet") === "thermal" ? "thermal" : "a4"));
  const [copies, setCopies] = useState("1");
  const [showPrice, setShowPrice] = useState(true);
  const sheet = SHEETS[sheetId];
  const products = codes.data;
  const { art, failed } = useLabelArt(products);
  const n = Math.max(1, Math.min(100, Number(copies) || 1));
  const pages = useMemo(() => (products ? paginate(products, n, sheet) : []), [products, n, sheet]);
  const total = (products?.length ?? 0) * n;
  const ready = Boolean(products?.length) && products!.every((p) => p.barcode && art[p.barcode]);
  const generated = products?.filter((p) => p.barcodeGenerated).length ?? 0;

  const key = ids.join(",");
  useEffect(() => {
    if (ids.length) codes.mutate(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!ids.length) {
    return (
      <div className="flex flex-col gap-6">
        <PageTitle>Print product labels</PageTitle>
        <Panel title="Choose products first">
          <p className="text-body-lg text-ink-muted">
            Open a product and choose <strong>Print label</strong>, or select products in your <Link to="/inventory/products" className="font-semibold text-ink-brand hover:underline">product list</Link> and choose <strong>Print labels</strong>.
          </p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        actions={
          <Button size="md" disabled={!ready} onClick={() => window.print()}>
            <IconPrinter aria-hidden="true" className="size-icon" /> Print {total ? `${count(total)} label${total === 1 ? "" : "s"}` : "labels"}
          </Button>
        }
      >
        Print product labels
      </PageTitle>
      <IntroCard eyebrow="Workspace / Inventory" title="Every label scans straight back to the product: in BiManage's scanner, or with a phone camera." />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Panel title="Label settings">
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 text-body-sm font-semibold text-ink-strong">Paper</legend>
              {(Object.values(SHEETS) as Sheet[]).map((s) => (
                <label key={s.id} className={cn("flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border px-4 py-3", sheetId === s.id ? "border-ink-brand bg-surface-tint-blue" : "border-line-subtle")}>
                  <input type="radio" name="sheet" value={s.id} checked={sheetId === s.id} onChange={() => setSheetId(s.id)} className="mt-1 size-4 accent-[var(--color-ink-brand)]" />
                  <span>
                    <span className="block text-body-lg font-semibold text-ink-strong">{s.name}</span>
                    <span className="block text-body-sm text-ink-muted">{s.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
              <Field label="Copies of each label" hint="1 to 100">
                <TextInput inputMode="numeric" value={copies} onChange={(e) => setCopies(e.target.value.replace(/\D/g, "").slice(0, 3))} />
              </Field>
              <label className="flex min-h-11 items-center gap-3 self-end text-body-lg text-ink-strong">
                <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} className="size-5 accent-[var(--color-ink-brand)]" />
                Show the price
              </label>
            </div>
          </Panel>

          <Panel title="Preview" subtitle={products ? `${count(products.length)} product${products.length === 1 ? "" : "s"} · ${count(total)} label${total === 1 ? "" : "s"}${sheet.id === "a4" ? ` · ${count(pages.length)} sheet${pages.length === 1 ? "" : "s"}` : ""}` : undefined}>
            {codes.isPending && (
              <div className="flex justify-center py-10 text-ink-brand" role="status">
                <Spinner className="size-8" />
                <span className="sr-only">Preparing labels…</span>
              </div>
            )}
            <ErrorNote error={codes.error} fallback="We couldn't prepare these labels. Please try again." onRetry={() => codes.mutate(ids)} />
            {failed && <ErrorNote error fallback="We couldn't draw the barcodes. Refresh the page and try again." />}
            {products && products.length === 0 && <p className="text-body-lg text-ink-muted">These products weren't found in your inventory.</p>}
            {products && products.length > 0 && (
              <ul className="flex flex-wrap gap-3" aria-label="Label preview">
                {products.map((p) => (
                  <li key={p._id} className="rounded-md bg-surface-pale p-2">
                    <Label p={p} sheet={sheet} art={p.barcode ? art[p.barcode] : undefined} showPrice={showPrice} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <HelpPanel
          items={[
            ["Barcode", "The product's own barcode, or one BiManage makes for it"],
            ["QR code", "Opens the product in BiManage for your team"],
            ["Printing", sheet.id === "a4" ? "Print at 100% (actual size), no margins" : "Choose your label printer and 50 × 25 mm paper"],
          ]}
          callout={{
            title: generated ? `${count(generated)} new barcode${generated === 1 ? "" : "s"}` : "Barcodes stay the same",
            body: generated ? "Products without a barcode got one. It's saved on the product and won't change, so labels you print later match." : "Printing again uses the same codes, so old labels keep working.",
          }}
        />
      </div>

      {/* What prints: only this, at real size, one sheet per page. */}
      {ready &&
        createPortal(
          <div className={cn("bm-labels-print", `bm-labels-print-${sheet.id}`)} aria-hidden="true">
            <style>{`@page { size: ${sheet.page.width}mm ${sheet.page.height}mm; margin: 0; }`}</style>
            {pages.map((page, i) => (
              <div
                key={i}
                className="bm-labels-page"
                style={{
                  width: `${sheet.page.width}mm`,
                  height: `${sheet.page.height}mm`,
                  paddingTop: `${sheet.margin.top}mm`,
                  paddingLeft: `${sheet.margin.left}mm`,
                  gridTemplateColumns: `repeat(${sheet.columns}, ${sheet.label.width}mm)`,
                  gridAutoRows: `${sheet.label.height}mm`,
                  columnGap: `${sheet.gap.x}mm`,
                  rowGap: `${sheet.gap.y}mm`,
                }}
              >
                {page.map((p, j) => (
                  <Label key={j} p={p} sheet={sheet} art={p.barcode ? art[p.barcode] : undefined} showPrice={showPrice} />
                ))}
              </div>
            ))}
          </div>,
          document.body
        )}
      <p className="sr-only">{perPage(sheet)} labels per page.</p>
    </div>
  );
}
