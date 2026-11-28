import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";

const SHIRT = {
  _id: "p1",
  name: "Classic linen shirt",
  sku: "APP-1048",
  category: "Apparel",
  sellingPrice: 12500,
  stockQuantity: 96,
  totalSold: 0,
  lowStockThreshold: 10,
  channelBadge: "both",
  channels: { retail: { enabled: true, price: 12500 }, wholesale: { enabled: true, moq: 10, tiers: [{ minQty: 10, unitPrice: 10000 }] } },
  stock: { onHand: 120, reserved: 24, available: 96 },
};
const HISTORY = [
  { _id: "a4", type: "set", quantity: 98, before: 96, after: 98, reason: "Stock count correction", tag: "Adjusted", createdAt: "2026-11-27T10:00:00Z", actor: { _id: "u1", name: "Ada" } },
  { _id: "a3", type: "decrease", quantity: 50, before: 146, after: 96, reason: "Online store order", reference: "BM-WQ8Q-E9GD", movement: "sale", channel: "wholesale", tag: "Wholesale", createdAt: "2026-11-26T10:00:00Z" },
  { _id: "a2", type: "decrease", quantity: 4, before: 150, after: 146, reason: "Online store order", movement: "sale", channel: "retail", tag: "Retail", createdAt: "2026-11-25T10:00:00Z" },
  { _id: "a1", type: "increase", quantity: 48, before: 102, after: 150, reason: "Goods received", reference: "GRN-0042", movement: "received", tag: "Received", createdAt: "2026-11-24T10:00:00Z" },
];

let fb: FakeBackend;
beforeEach(() => {
  tokenStore.set("tok");
  serverStatus.set("up");
  fb = installFakeBackend();
  fb.handlers["GET /subscriptions/current"] = () => [200, { plan: "standard", status: "active", features: { inventory: true } }];
  fb.handlers["GET /inventory/products/p1"] = () => [200, SHIRT];
  fb.handlers["GET /inventory/products/p1/adjustments"] = () => [200, HISTORY];
});
afterEach(() => tokenStore.clear());
const calls = (key: string) => fb.calls.filter((c) => c.key === key);

async function fillReceive24() {
  const user = userEvent.setup();
  renderApp("/inventory/products/p1/adjust");
  expect(await screen.findByRole("heading", { name: "Stock adjustment" })).toBeInTheDocument();
  await user.click(screen.getByRole("radio", { name: /receive/i }));
  await user.type(screen.getByLabelText(/^quantity/i), "24");
  expect(screen.getByLabelText(/projected available/i)).toHaveValue("96 + 24 = 120 units");
  await user.selectOptions(screen.getByLabelText(/adjustment reason/i), "Goods received");
  await user.type(screen.getByLabelText(/audit reference/i), "GRN-0043");
  await user.click(screen.getByRole("button", { name: "Review adjustment" }));
  expect(await screen.findByText("Current: 96 available → Updated: 120 available")).toBeInTheDocument();
  return user;
}

describe("shared stock adjustment", () => {
  it("receive → review → confirm: sends what the person saw and a retry key, then shows the result", async () => {
    fb.handlers["POST /inventory/products/p1/adjust"] = () => [200, { product: { ...SHIRT, stockQuantity: 120, stock: { onHand: 144, reserved: 24, available: 120 } }, adjustment: { _id: "adj0001ABCD", type: "increase", quantity: 24, before: 96, after: 120, reason: "Goods received", reference: "GRN-0043", createdAt: "2026-11-28T10:00:00Z" } }];
    const user = await fillReceive24();
    await user.click(screen.getByRole("button", { name: "Confirm and save changes" }));
    expect(await screen.findByRole("heading", { name: "Inventory update successful" })).toBeInTheDocument();
    const [call] = calls("POST /inventory/products/p1/adjust");
    expect(call!.body).toEqual({ type: "receive", quantity: 24, reason: "Goods received", reference: "GRN-0043", expectedQuantity: 96 });
    expect(call!.headers?.["Idempotency-Key"]).toBeTruthy();
    expect(screen.getByText(/Available 96 → 120 units\. Audit record saved\./)).toBeInTheDocument();
  });

  it("issuing more than available is stopped before it's sent", async () => {
    renderApp("/inventory/products/p1/adjust");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("radio", { name: /issue/i }));
    await user.type(screen.getByLabelText(/^quantity/i), "105");
    await user.click(screen.getByRole("button", { name: "Review adjustment" }));
    // Listed under "Please correct these fields" and shown on the field itself.
    expect(await screen.findByText("Please correct these fields")).toBeInTheDocument();
    expect(screen.getAllByText(/Available quantity cannot be negative\. Only 96 available\./)).toHaveLength(2);
    expect(screen.getAllByText("Choose a reason.")).toHaveLength(2);
    expect(calls("POST /inventory/products/p1/adjust")).toHaveLength(0);
  });

  it("stock changed meanwhile: the conflict screen with the latest figure; Refresh stock starts again from it", async () => {
    let latest = 90;
    fb.handlers["POST /inventory/products/p1/adjust"] = () => [409, { code: "stock_conflict", current: latest, message: "Stock changed while you were editing: it's now 90. Reload to see the latest before saving." }];
    const user = await fillReceive24();
    await user.click(screen.getByRole("button", { name: "Confirm and save changes" }));
    expect(await screen.findByRole("heading", { name: "Your stock has changed" })).toBeInTheDocument();
    expect(screen.getByText("Available 90 · Your change +24")).toBeInTheDocument();
    fb.handlers["GET /inventory/products/p1"] = () => [200, { ...SHIRT, stockQuantity: latest, stock: { onHand: 114, reserved: 24, available: latest } }];
    await user.click(screen.getByRole("button", { name: /refresh stock/i }));
    expect(await screen.findByRole("heading", { name: "Stock adjustment" })).toBeInTheDocument();
    expect(screen.getByLabelText(/projected available/i)).toHaveValue("90 + 24 = 114 units");
    latest = 0;
  });

  it("connection lost: retrying sends the same change with the same key (never twice)", async () => {
    let n = 0;
    fb.handlers["POST /inventory/products/p1/adjust"] = () => (++n === 1 ? [503, { message: "Service unavailable" }] : [200, { product: { ...SHIRT, stockQuantity: 120 }, adjustment: { _id: "adj2", type: "increase", quantity: 24, before: 96, after: 120, reason: "Goods received", createdAt: "2026-11-28T10:00:00Z" }, replayed: true }]);
    const user = await fillReceive24();
    await user.click(screen.getByRole("button", { name: "Confirm and save changes" }));
    expect(await screen.findByRole("heading", { name: "We couldn't confirm the save" })).toBeInTheDocument();
    expect(screen.queryByText(/Service unavailable/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry saving" }));
    expect(await screen.findByRole("heading", { name: "Inventory update successful" })).toBeInTheDocument();
    const sent = calls("POST /inventory/products/p1/adjust");
    expect(sent).toHaveLength(2);
    expect(sent[0]!.headers?.["Idempotency-Key"]).toBe(sent[1]!.headers?.["Idempotency-Key"]);
  });
});

describe("movement history", () => {
  it("tags each movement and filters by tag", async () => {
    renderApp("/inventory/products/p1/history");
    const user = userEvent.setup();
    const list = await screen.findByRole("list", { name: "Stock movements" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
    expect(within(list).getByText("Wholesale")).toBeInTheDocument();
    expect(within(list).getByText(/\+48/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retail" }));
    await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(1));
    expect(within(list).getByText(/−4/)).toBeInTheDocument();
  });
});
