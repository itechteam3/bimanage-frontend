import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";
import { barcodeFormat, paginate, SHEETS } from "@/lib/labels/labels";

describe("label layout", () => {
  it("A4 sheets hold 24 labels; copies repeat each product; thermal is one per page", () => {
    expect(paginate(["a", "b"], 13, SHEETS.a4).map((p) => p.length)).toEqual([24, 2]);
    expect(paginate(["a"], 3, SHEETS.thermal)).toEqual([["a"], ["a"], ["a"]]);
    expect(paginate(["a"], 0, SHEETS.a4)).toEqual([["a"]]);
    expect(paginate(["a"], 999, SHEETS.thermal)).toHaveLength(100);
  });
  it("EAN/UPC when the code is one (valid check digit), otherwise Code 128", () => {
    expect(barcodeFormat("5901234123457")).toBe("EAN13");
    expect(barcodeFormat("5901234123458")).toBe("CODE128");
    expect(barcodeFormat("96385074")).toBe("EAN8");
    expect(barcodeFormat("036000291452")).toBe("UPC");
    expect(barcodeFormat("LS-1")).toBe("CODE128");
  });
});

const P1 = { _id: "p1", name: "Linen shirt", sellingPrice: 25000, stockQuantity: 18, sku: "LS-1", barcode: "5901234123457" };
const P2 = { _id: "p2", name: "Canvas tote", sellingPrice: 5000, stockQuantity: 4 };
const GEN = "2000000000008";

describe("printing labels", () => {
  let fb: FakeBackend;
  beforeEach(() => {
    // jsdom has no canvas; JsBarcode only uses it to measure the digits under the bars.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ font: "", measureText: (t: string) => ({ width: t.length * 9 }) } as unknown as CanvasRenderingContext2D);
    tokenStore.set("tok");
    serverStatus.set("up");
    fb = installFakeBackend();
    fb.handlers["GET /subscriptions/current"] = () => [200, { plan: "standard", status: "active", features: { inventory: true } }];
    fb.handlers["GET /inventory/products"] = () => [200, [P1, P2]];
    fb.handlers["GET /inventory/products/p1"] = () => [200, P1];
    fb.handlers["POST /inventory/products/label-codes"] = (b) => {
      const ids = (b as { ids: string[] }).ids;
      return [200, { products: ids.map((id) => (id === "p1" ? { ...P1, barcodeGenerated: false } : { ...P2, sku: null, barcode: GEN, barcodeGenerated: true })) }];
    };
  });
  afterEach(() => {
    vi.restoreAllMocks();
    tokenStore.clear();
  });
  const last = (key: string) => [...fb.calls].reverse().find((c) => c.key === key);

  it("bulk: select products in the list → Print labels → preview, new barcodes noted, prints", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const router = renderApp("/inventory/products");
    const user = userEvent.setup();
    const button = await screen.findByRole("button", { name: /^print labels$/i });
    expect(button).toBeDisabled();
    await user.click(await screen.findByRole("checkbox", { name: /select linen shirt/i }));
    await user.click(screen.getByRole("checkbox", { name: /select canvas tote/i }));
    await user.click(screen.getByRole("button", { name: /print labels \(2\)/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/inventory/labels"));
    await waitFor(() => expect(last("POST /inventory/products/label-codes")?.body).toEqual({ ids: ["p1", "p2"] }));
    const preview = await screen.findByRole("list", { name: /label preview/i });
    expect(within(preview).getByText("Linen shirt")).toBeInTheDocument();
    expect(within(preview).getByText("SKU LS-1")).toBeInTheDocument();
    expect(screen.getByText(/1 new barcode/i)).toBeInTheDocument();
    const go = await screen.findByRole("button", { name: /print 2 labels/i });
    await waitFor(() => expect(go).toBeEnabled(), { timeout: 5000 });
    // Barcode and QR drawn; the QR holds the BiManage label link.
    expect(document.querySelector(".bm-labels-print .bm-label-barcode svg")).not.toBeNull();
    expect(document.querySelector(".bm-labels-print .bm-label-qr svg")).not.toBeNull();
    expect(document.querySelector(".bm-labels-print style")?.textContent).toContain("size: 210mm 297mm");
    await user.click(go);
    expect(print).toHaveBeenCalled();
  });

  it("thermal paper and copies: one 50 × 25 mm label per page", async () => {
    renderApp("/inventory/labels?ids=p1");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("radio", { name: /thermal labels/i }));
    const copies = screen.getByLabelText(/copies of each label/i);
    await user.clear(copies);
    await user.type(copies, "3");
    await waitFor(() => expect(screen.getByRole("button", { name: /print 3 labels/i })).toBeEnabled(), { timeout: 5000 });
    expect(document.querySelector(".bm-labels-print style")?.textContent).toContain("size: 50mm 25mm");
    expect(document.querySelectorAll(".bm-labels-print .bm-labels-page")).toHaveLength(3);
  });

  it("product page: Print label opens the labels page for that product", async () => {
    renderApp("/inventory/products/p1");
    expect(await screen.findByRole("link", { name: /print label/i })).toHaveAttribute("href", "/inventory/labels?ids=p1");
  });

  it("without products chosen, explains where to start", async () => {
    renderApp("/inventory/labels");
    expect(await screen.findByText(/choose products first/i)).toBeInTheDocument();
  });
});
