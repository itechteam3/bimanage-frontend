import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";

const st = (status: string) => ({ status, activatedAt: null, pausedAt: null });
const BOTH = { retail: st("active"), wholesale: st("active"), mode: "both", chosen: true };
const RETAIL_ONLY = { retail: st("active"), wholesale: st("available"), mode: "retail", chosen: true };

const SHIRT = {
  _id: "p1",
  name: "Classic linen shirt",
  sku: "APP-1048",
  category: "Apparel",
  sellingPrice: 12500,
  stockQuantity: 96,
  totalSold: 0,
  channelBadge: "both",
  channels: { retail: { enabled: true, price: 12500 }, wholesale: { enabled: true, moq: 10, tiers: [{ minQty: 10, unitPrice: 10000 }, { minQty: 50, unitPrice: 9200 }] } },
  stock: { onHand: 120, reserved: 24, available: 96 },
};
const FREE = { _id: "p2", name: "Sample sachet", sku: "SMP-1", sellingPrice: 0, stockQuantity: 5, totalSold: 0, channelBadge: "retail", channels: { retail: { enabled: true, price: 0 }, wholesale: { enabled: false, moq: null, tiers: [] } } };

let fb: FakeBackend;
beforeEach(() => {
  tokenStore.set("tok");
  serverStatus.set("up");
  fb = installFakeBackend();
  fb.handlers["GET /subscriptions/current"] = () => [200, { plan: "standard", status: "active", features: { inventory: true } }];
  fb.handlers["GET /selling-channels"] = () => [200, { channels: BOTH, isOwner: true }];
  fb.handlers["GET /inventory/products"] = () => [200, [SHIRT, FREE]];
  fb.handlers["GET /inventory/products/p1"] = () => [200, SHIRT];
});
afterEach(() => tokenStore.clear());
const last = (key: string) => [...fb.calls].reverse().find((c) => c.key === key);

describe("product list", () => {
  it("summary tiles, channel badges, available and on hand, and a flag for a product without a price", async () => {
    renderApp("/inventory/products");
    expect(await screen.findByText("Shared products")).toBeInTheDocument();
    const row = (await screen.findByRole("link", { name: "Classic linen shirt" })).closest("tr")!;
    expect(within(row).getByText("Both")).toBeInTheDocument();
    expect(within(row).getByText("96 available")).toBeInTheDocument();
    expect(within(row).getByText("120 on hand")).toBeInTheDocument();
    const free = screen.getByRole("link", { name: "Sample sachet" }).closest("tr")!;
    expect(within(free).getByRole("link", { name: /set a retail price/i })).toHaveAttribute("href", "/inventory/products/p2");
  });
});

describe("product form: channel selling settings", () => {
  it("edit: shows the saved retail price, MOQ and tiers, the stock levels, and saves channels", async () => {
    fb.handlers["PUT /inventory/products/p1"] = (b) => [200, { ...SHIRT, ...(b as object) }];
    renderApp("/inventory/products/p1");
    const user = userEvent.setup();
    expect(await screen.findByLabelText(/retail price/i)).toHaveValue("12500");
    expect(screen.getByLabelText(/minimum bulk quantity/i)).toHaveValue("10");
    expect(screen.getByText(/On hand 120 · Reserved 24 · Available 96/)).toBeInTheDocument();
    expect(screen.getByText("Both draw from 96 available units.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add a price tier" }));
    await user.type(screen.getByLabelText("Tier 3: from (units)"), "200");
    const prices = screen.getAllByLabelText(/price per unit/i);
    await user.type(prices[2]!, "8,800");
    await user.click(screen.getByRole("button", { name: "Save inventory item" }));
    await waitFor(() => expect(last("PUT /inventory/products/p1")).toBeTruthy());
    expect(last("PUT /inventory/products/p1")!.body).toMatchObject({
      channels: { retail: { enabled: true, price: 12500 }, wholesale: { enabled: true, moq: 10, tiers: [{ minQty: 10, unitPrice: 10000 }, { minQty: 50, unitPrice: 9200 }, { minQty: 200, unitPrice: 8800 }] } },
    });
  });

  it("a rule the server refuses is shown next to the right tier", async () => {
    fb.handlers["PUT /inventory/products/p1"] = () => [400, { message: "Wholesale tier requires a price.", field: "channels.wholesale.tiers.1.unitPrice", errors: [{ field: "channels.wholesale.tiers.1.unitPrice", message: "Wholesale tier requires a price." }] }];
    renderApp("/inventory/products/p1");
    const user = userEvent.setup();
    await screen.findByLabelText(/minimum bulk quantity/i);
    await user.click(screen.getByRole("button", { name: "Save inventory item" }));
    expect(await screen.findByText("Wholesale tier requires a price.")).toBeInTheDocument();
  });

  it("wholesale not set up for the business: no wholesale fields, a link to activate it", async () => {
    fb.handlers["GET /selling-channels"] = () => [200, { channels: RETAIL_ONLY, isOwner: true }];
    fb.handlers["POST /inventory/products"] = (b) => [201, { _id: "p9", ...(b as object) }];
    renderApp("/inventory/products/new");
    const user = userEvent.setup();
    expect(await screen.findByRole("link", { name: "Activate wholesale in Settings" })).toHaveAttribute("href", "/settings/channels");
    expect(screen.queryByLabelText(/minimum bulk quantity/i)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/product name/i), "Plain tee");
    await user.type(screen.getByLabelText(/^category/i), "Apparel");
    await user.type(screen.getByLabelText(/^sku/i), "TEE-1");
    await user.type(screen.getByLabelText(/retail price/i), "3000");
    await user.type(screen.getByLabelText(/initial quantity/i), "5");
    await user.click(screen.getByRole("button", { name: "Save inventory item" }));
    await waitFor(() => expect(last("POST /inventory/products")).toBeTruthy());
    expect(last("POST /inventory/products")!.body).toMatchObject({ channels: { retail: { enabled: true, price: 3000 }, wholesale: { enabled: false, moq: null, tiers: [] } } });
  });
});
