import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";
import type { Product } from "@/lib/inventory/api";

const SHIRT: Product = { _id: "p1", name: "Classic linen shirt", category: "Clothing", sku: "APP-101", barcode: "8901234567890", sellingPrice: 22500, stockQuantity: 28, totalSold: 4, lowStockThreshold: 10 };
const CAP: Product = { _id: "p2", name: "Canvas cap", category: "Accessories", sku: "ACC-7", sellingPrice: 6000, stockQuantity: 3, totalSold: 9 };
const STANDARD = { plan: "standard", status: "active", features: { inventory: true } };

let fb: FakeBackend;
beforeEach(() => {
  tokenStore.set("tok");
  serverStatus.set("up");
  fb = installFakeBackend();
  fb.handlers["GET /subscriptions/current"] = () => [200, STANDARD];
  fb.handlers["GET /inventory/products"] = () => [200, [SHIRT, CAP]];
  fb.handlers["GET /inventory/products/p1"] = () => [200, SHIRT];
  fb.handlers["GET /inventory/products/p1/adjustments"] = () => [
    200,
    [{ _id: "a1", type: "initial", quantity: 28, before: 0, after: 28, reason: "Opening stock", actor: { _id: "u1", name: "Samuel Adebayo" }, createdAt: "2026-11-01T10:00:00Z" }],
  ];
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  tokenStore.clear();
});

const last = (key: string) => [...fb.calls].reverse().find((c) => c.key === key);

describe("inventory (09.xx)", () => {
  it("is locked with an upgrade prompt when the plan doesn't include it", async () => {
    fb.handlers["GET /subscriptions/current"] = () => [200, { plan: "freemium", status: "active", features: { inventory: false } }];
    renderApp("/inventory/products");
    expect(await screen.findByText(/inventory isn't included in your plan/i)).toBeInTheDocument();
    expect(fb.calls.some((c) => c.key === "GET /inventory/products")).toBe(false);
  });

  it("lists products with their stock state", async () => {
    renderApp("/inventory/products");
    expect(await screen.findByText("Classic linen shirt")).toBeInTheDocument();
    expect(screen.getAllByText("Canvas cap").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Low stock").length).toBeGreaterThan(0);
  });

  it("adds a product and maps a duplicate SKU to the SKU field", async () => {
    let attempts = 0;
    fb.handlers["POST /inventory/products"] = (b) => (++attempts === 1 ? [409, { message: "SKU already exists" }] : [201, { ...SHIRT, ...b, _id: "p9" }]);
    const router = renderApp("/inventory/products/new");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/product name/i), "Linen trousers");
    await user.type(screen.getByLabelText(/category/i), "Clothing");
    await user.type(screen.getByLabelText(/^sku/i), "APP-101");
    await user.type(screen.getByLabelText(/selling price/i), "18,000");
    await user.type(screen.getByLabelText(/initial quantity/i), "12");
    await user.click(screen.getByRole("button", { name: /save inventory item/i }));
    expect(await screen.findByText(/another product already uses this sku/i)).toBeInTheDocument();
    expect(last("POST /inventory/products")!.body).toMatchObject({ name: "Linen trousers", sellingPrice: 18000, stockQuantity: 12, sku: "APP-101", lowStockThreshold: 10 });

    await user.clear(screen.getByLabelText(/^sku/i));
    await user.type(screen.getByLabelText(/^sku/i), "APP-102");
    await user.click(screen.getByRole("button", { name: /save inventory item/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/inventory/products"));
  });

  it("editing never sends a stock quantity", async () => {
    fb.handlers["PUT /inventory/products/p1"] = (b) => [200, { ...SHIRT, ...b }];
    renderApp("/inventory/products/p1");
    const user = userEvent.setup();
    const price = await screen.findByLabelText(/selling price/i);
    await waitFor(() => expect(price).toHaveValue("22500"));
    await user.clear(price);
    await user.type(price, "24000");
    await user.click(screen.getByRole("button", { name: /save inventory item/i }));
    await waitFor(() => expect(last("PUT /inventory/products/p1")).toBeTruthy());
    const body = last("PUT /inventory/products/p1")!.body;
    expect(body).toMatchObject({ sellingPrice: 24000, sku: "APP-101" });
    expect(body).not.toHaveProperty("stockQuantity");
  });

  it("adjusts stock, refuses going below zero and shows the history", async () => {
    fb.handlers["POST /inventory/products/p1/adjust"] = () => [200, { product: { ...SHIRT, stockQuantity: 40 }, adjustment: {} }];
    renderApp("/inventory/products/p1/adjust");
    const user = userEvent.setup();
    expect(await screen.findByText("Opening stock")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/change type/i), "decrease");
    await user.type(screen.getByLabelText(/quantity change/i), "30");
    expect(screen.getByText(/can't go below zero/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm adjustment/i })).toBeDisabled();

    await user.selectOptions(screen.getByLabelText(/change type/i), "increase");
    await user.clear(screen.getByLabelText(/quantity change/i));
    await user.type(screen.getByLabelText(/quantity change/i), "12");
    await user.selectOptions(screen.getByLabelText(/reason/i), "Goods received");
    await user.click(screen.getByRole("button", { name: /confirm adjustment/i }));
    expect(await screen.findByText(/stock updated to 40 units/i)).toBeInTheDocument();
    expect(last("POST /inventory/products/p1/adjust")!.body).toMatchObject({ type: "increase", quantity: 12, reason: "Goods received" });
  });

  it("barcode lookup finds stock, or offers to add a catalogue product", async () => {
    fb.handlers["GET /barcode/inventory/8901234567890"] = () => [200, [SHIRT]];
    fb.handlers["GET /barcode/inventory/5000112637922"] = () => [200, []];
    fb.handlers["GET /barcode/lookup/5000112637922"] = () => [200, { barcode: "5000112637922", name: "Cola 330ml", brand: "Coca-Cola", category: "Beverages", source: "openfoodfacts" }];
    const router = renderApp("/inventory/lookup");
    const user = userEvent.setup();
    const field = await screen.findByLabelText(/barcode \/ ean/i);
    await user.type(field, "8901234567890{Enter}");
    expect(await screen.findByRole("heading", { name: "Classic linen shirt" })).toBeInTheDocument();

    await user.clear(field);
    await user.type(field, "5000112637922{Enter}");
    expect(await screen.findByText("Cola 330ml")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /add as a new product/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/inventory/products/new"));
    expect(await screen.findByLabelText(/product name/i)).toHaveValue("Cola 330ml");
    expect(screen.getByLabelText(/^barcode/i)).toHaveValue("5000112637922");
  });
});
