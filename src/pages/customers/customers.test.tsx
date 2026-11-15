import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";
import type { Customer, CustomerDetail } from "@/lib/customers/api";
import { installFakeSockets } from "@/test/fakeSocket";

const AMINA: Customer = {
  _id: "c1",
  name: "Amina Yusuf",
  email: "amina@example.com",
  phone: "+234 800 123 4567",
  address: { line: "12 Allen Avenue", city: "Ikeja", state: "Lagos" },
  tags: ["VIP"],
  notes: "Prefers delivery after 5pm",
  source: "order",
  stats: { ordersCount: 3, invoicesCount: 1, totalSpent: 125000, averageOrder: 41667, lastOrderAt: "2026-11-10T09:00:00Z", firstSeenAt: "2026-09-01T09:00:00Z", lastSeenAt: "2026-11-10T09:00:00Z" },
  createdAt: "2026-09-01T09:00:00Z",
  updatedAt: "2026-11-10T09:00:00Z",
};

const DETAIL: CustomerDetail = {
  customer: AMINA,
  orders: [
    { _id: "o1", channel: "in_person", reference: "ORD-7K2Q9M", total: 50000, status: "completed", createdAt: "2026-11-10T09:00:00Z" },
    { _id: "so1", channel: "online", reference: "BM-7K2Q-9MXA", total: 45000, status: "pending", createdAt: "2026-11-08T09:00:00Z" },
  ],
  invoices: [{ _id: "i1", invoiceNumber: "INV-2026-AB2CDE", total: 30000, status: "paid", createdAt: "2026-11-09T09:00:00Z" }],
  conversation: { _id: "conv1" },
};

const page = (customers: Customer[], extra: Partial<{ total: number; page: number; totalPages: number; tags: string[] }> = {}) => ({
  customers,
  total: customers.length,
  page: 1,
  totalPages: 1,
  tags: ["VIP", "Wholesale"],
  ...extra,
});

let fb: FakeBackend;
beforeEach(() => {
  tokenStore.set("tok");
  serverStatus.set("up");
  fb = installFakeBackend();
  fb.handlers["GET /subscriptions/current"] = () => [200, { plan: "standard", status: "active", features: { orders: true, invoices: true, analytics: true, inventory: true, projects: true, store: true, bisupplynet: true } }];
  fb.handlers["GET /customers"] = () => [200, page([AMINA])];
  fb.handlers["GET /customers/stats"] = () => [200, { total: 1, newThisMonth: 1, repeat: 1, totalSpent: 125000 }];
  fb.handlers["GET /customers/c1"] = () => [200, DETAIL];
  fb.handlers["GET /inventory/products"] = () => [200, []];
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  tokenStore.clear();
});

const last = (key: string) => [...fb.calls].reverse().find((c) => c.key === key);
const track = () => {
  const urls: URL[] = [];
  fb.handlers["GET /customers"] = (_b, _h, url) => (urls.push(url), [200, page([AMINA])]);
  return urls;
};

describe("customer directory (09.01)", () => {
  it("shows stats, rows and cards, and sends search, filters and sort to the API", async () => {
    const urls = track();
    const user = userEvent.setup();
    const router = renderApp("/customers");
    expect(await screen.findByRole("heading", { name: "Customers", level: 1 })).toBeInTheDocument();
    expect((await screen.findAllByText("Amina Yusuf")).length).toBeGreaterThan(0);
    expect(within(screen.getByRole("table")).getByText("3 orders")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Customers" })).getByText(/\+234 800 123 4567 • amina@example.com/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("₦125,000").length).toBeGreaterThan(0));
    expect(Object.fromEntries(urls[0]!.searchParams)).toEqual({ sort: "totalSpent", dir: "desc", page: "1", limit: "30" });

    await user.type(screen.getByRole("textbox", { name: /search customers/i }), "amina{Enter}");
    await waitFor(() => expect(urls.at(-1)!.searchParams.get("q")).toBe("amina"));
    await user.selectOptions(screen.getByRole("combobox", { name: /tag/i }), "VIP");
    await waitFor(() => expect(urls.at(-1)!.searchParams.get("tag")).toBe("VIP"));
    await user.selectOptions(screen.getByRole("combobox", { name: /source/i }), "store");
    await waitFor(() => expect(urls.at(-1)!.searchParams.get("source")).toBe("store"));
    await user.selectOptions(screen.getByRole("combobox", { name: /sort by/i }), "name");
    await waitFor(() => expect(Object.fromEntries(urls.at(-1)!.searchParams)).toEqual({ q: "amina", tag: "VIP", source: "store", sort: "name", dir: "asc", page: "1", limit: "30" }));
    // Filters live in the URL (Back and refresh keep them).
    expect(router.state.location.search).toContain("sort=name");
  });

  it("Load more fetches the next page and keeps the first", async () => {
    fb.handlers["GET /customers"] = (_b, _h, url) => {
      const n = Number(url.searchParams.get("page"));
      return [200, page([{ ...AMINA, _id: `c${n}`, name: `Customer page ${n}` }], { total: 2, page: n, totalPages: 2 })];
    };
    const user = userEvent.setup();
    renderApp("/customers");
    expect((await screen.findAllByText("Customer page 1")).length).toBeGreaterThan(0);
    expect(screen.getByText(/showing 1 of 2 customers/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect((await screen.findAllByText("Customer page 2")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Customer page 1").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("exports a CSV with the same filters", async () => {
    URL.createObjectURL = vi.fn(() => "blob:customers");
    URL.revokeObjectURL = vi.fn();
    let exportUrl: URL | null = null;
    fb.handlers["GET /customers/export"] = (_b, _h, url) => ((exportUrl = url), [200, { ok: true }]);
    const user = userEvent.setup();
    renderApp("/customers?q=amina&tag=VIP");
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: /export csv/i }));
    await waitFor(() => expect(exportUrl).not.toBeNull());
    expect(Object.fromEntries(exportUrl!.searchParams)).toEqual({ q: "amina", tag: "VIP", sort: "totalSpent", dir: "desc" });
  });

  it("empty directory explains where customers come from and offers Add customer", async () => {
    fb.handlers["GET /customers"] = () => [200, page([])];
    renderApp("/customers");
    expect(await screen.findByRole("heading", { name: "No customers yet" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /add customer/i }).length).toBeGreaterThan(0);
  });
});

describe("customer profile", () => {
  it("shows contact links, and history from both channels and invoices with the right links", async () => {
    renderApp("/customers/c1");
    expect(await screen.findByRole("heading", { name: "Amina Yusuf", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+234 800 123 4567" })).toHaveAttribute("href", "tel:+2348001234567");
    expect(screen.getByRole("link", { name: "amina@example.com" })).toHaveAttribute("href", "mailto:amina@example.com");
    expect(screen.getByText("12 Allen Avenue, Ikeja, Lagos")).toBeInTheDocument();

    const history = screen.getByRole("list", { name: /order and invoice history/i });
    expect(within(history).getByRole("link", { name: "ORD-7K2Q9M" })).toHaveAttribute("href", "/orders/o1");
    expect(within(history).getByRole("link", { name: "BM-7K2Q-9MXA" })).toHaveAttribute("href", "/store/orders/so1");
    expect(within(history).getByRole("link", { name: "INV-2026-AB2CDE" })).toHaveAttribute("href", "/invoices/i1");
    // Newest first, channels labelled.
    expect(within(history).getAllByTestId("history-channel").map((n) => n.textContent)).toEqual(["In person", "Invoice", "Online"]);
  });

  it("quick actions: create order / invoice prefilled, message only with a conversation, call and email", async () => {
    const user = userEvent.setup();
    const router = renderApp("/customers/c1");
    const actions = await screen.findByRole("navigation", { name: "Quick actions" });
    expect(within(actions).getByRole("link", { name: "Message" })).toHaveAttribute("href", "/messages/conv1");
    expect(within(actions).getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:+2348001234567");
    expect(within(actions).getByRole("link", { name: "Email" })).toHaveAttribute("href", "mailto:amina@example.com");

    await user.click(within(actions).getByRole("link", { name: "Create invoice" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/invoices/new"));
    expect(await screen.findByDisplayValue("Amina Yusuf")).toBeInTheDocument();
    expect(screen.getByDisplayValue("12 Allen Avenue, Ikeja, Lagos")).toBeInTheDocument();
  });

  it("Create order opens the order form with the customer filled in", async () => {
    fb.handlers["GET /inventory/products"] = () => [200, [{ _id: "p1", name: "Linen shirt", sellingPrice: 25000, stockQuantity: 5, totalSold: 0 }]];
    const user = userEvent.setup();
    const router = renderApp("/customers/c1");
    await user.click(within(await screen.findByRole("navigation", { name: "Quick actions" })).getByRole("link", { name: "Create order" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/orders/new"));
    expect(await screen.findByDisplayValue("Amina Yusuf")).toBeInTheDocument();
    expect(screen.getByDisplayValue("amina@example.com")).toBeInTheDocument();
  });

  it("no conversation: no Message action", async () => {
    fb.handlers["GET /customers/c1"] = () => [200, { ...DETAIL, conversation: null }];
    renderApp("/customers/c1");
    const actions = await screen.findByRole("navigation", { name: "Quick actions" });
    expect(within(actions).queryByRole("link", { name: "Message" })).toBeNull();
  });

  it("delete asks first and says orders and invoices are kept", async () => {
    fb.handlers["DELETE /customers/c1"] = () => [200, { message: "Customer deleted" }];
    const user = userEvent.setup();
    const router = renderApp("/customers/c1");
    await user.click(await screen.findByRole("button", { name: /delete/i }));
    const dialog = await screen.findByRole("dialog", { name: /delete amina yusuf/i });
    expect(dialog).toHaveTextContent(/orders and invoices are kept for your records/i);
    await user.click(within(dialog).getByRole("button", { name: "Delete customer" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/customers"));
    expect(last("DELETE /customers/c1")).toBeTruthy();
  });

  it("notes can be edited in place", async () => {
    fb.handlers["PUT /customers/c1"] = (b) => [200, { ...AMINA, ...b }];
    const user = userEvent.setup();
    renderApp("/customers/c1");
    await user.click(await screen.findByRole("button", { name: /edit notes/i }));
    const box = screen.getByRole("textbox", { name: /notes about this customer/i });
    await user.clear(box);
    await user.type(box, "Size M");
    await user.click(screen.getByRole("button", { name: "Save notes" }));
    await waitFor(() => expect(last("PUT /customers/c1")?.body).toMatchObject({ name: "Amina Yusuf", notes: "Size M", tags: ["VIP"] }));
  });
});

describe("add and edit customer (09.01 / 09.02 / 09.03)", () => {
  it("requires a name and checks email and phone", async () => {
    const user = userEvent.setup();
    renderApp("/customers/new");
    await user.type(await screen.findByRole("textbox", { name: /email/i }), "not-an-email");
    await user.type(screen.getByRole("textbox", { name: /phone/i }), "12");
    await user.click(screen.getByRole("button", { name: "Save customer" }));
    expect(await screen.findByText("Enter the customer's name.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid phone number.")).toBeInTheDocument();
    expect(last("POST /customers")).toBeUndefined();
  });

  it("saves with tags and address, then shows Customer added", async () => {
    fb.handlers["POST /customers"] = (b) => [201, { ...AMINA, _id: "c9", ...b }];
    const user = userEvent.setup();
    const router = renderApp("/customers/new");
    await user.type(await screen.findByRole("textbox", { name: /full name/i }), "Tunde Adeyemi");
    await user.type(screen.getByRole("textbox", { name: /phone/i }), "+234 803 222 1940");
    await user.type(screen.getByRole("textbox", { name: /city/i }), "Ikeja");
    await user.type(screen.getByPlaceholderText("Add a tag"), "VIP{Enter}wholesale,");
    expect(screen.getByRole("button", { name: "Remove tag VIP" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save customer" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/customers/c9/added"));
    expect(last("POST /customers")?.body).toEqual({ name: "Tunde Adeyemi", phone: "+234 803 222 1940", address: { city: "Ikeja" }, tags: ["VIP", "wholesale"] });
    expect(await screen.findByRole("heading", { name: "Customer added", level: 1 })).toBeInTheDocument();
  });

  it("409 duplicate: offers to open the existing customer", async () => {
    fb.handlers["POST /customers"] = () => [409, { message: "A customer with this phone already exists", duplicateOf: "c1" }];
    const user = userEvent.setup();
    const router = renderApp("/customers/new");
    await user.type(await screen.findByRole("textbox", { name: /full name/i }), "Amina Y");
    await user.type(screen.getByRole("textbox", { name: /phone/i }), "+234 800 123 4567");
    await user.click(screen.getByRole("button", { name: "Save customer" }));
    const open = await screen.findByRole("link", { name: "Open existing customer" });
    expect(open).toHaveAttribute("href", "/customers/c1");
    expect(screen.queryByRole("button", { name: /merge/i })).toBeNull();
    await user.click(open);
    await waitFor(() => expect(router.state.location.pathname).toBe("/customers/c1"));
  });

  it("edit + 409: merge the duplicate into this customer, then save", async () => {
    let tries = 0;
    fb.handlers["PUT /customers/c1"] = (b) => (++tries === 1 ? [409, { message: "Duplicate", duplicateOf: { _id: "c2", name: "Amina (old)" } }] : [200, { ...AMINA, ...b }]);
    fb.handlers["POST /customers/c1/merge"] = () => [200, AMINA];
    const user = userEvent.setup();
    const router = renderApp("/customers/c1/edit");
    const name = await screen.findByDisplayValue("Amina Yusuf");
    await user.type(name, " B");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText(/amina \(old\) already has/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /merge into this customer/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/customers/c1"));
    expect(last("POST /customers/c1/merge")?.body).toEqual({ otherId: "c2" });
    expect(tries).toBe(2);
  });
});

describe("plan and permissions", () => {
  it("plan without customers: the customers page shows the upgrade prompt and fires no request", async () => {
    fb.handlers["GET /subscriptions/current"] = () => [200, { plan: "freemium", status: "active", features: { customers: false } }];
    renderApp("/customers");
    expect(await screen.findByText(/customers isn't included in your plan/i)).toBeInTheDocument();
    expect(last("GET /customers")).toBeUndefined();
  });

  it("a role without viewCustomers can't see the section (sidebar or page)", async () => {
    fb.handlers["GET /settings/my-role"] = () => [200, { role: "staff", permissions: { viewCustomers: false, createOrders: true }, businessId: "b1" }];
    renderApp("/customers");
    expect(await screen.findByText(/you don't have access to customers/i)).toBeInTheDocument();
    expect(screen.queryAllByRole("link", { name: "Customers" })).toHaveLength(0);
    expect(last("GET /customers")).toBeUndefined();
  });

  it("older roles without the new keys fall back to the orders permission", async () => {
    fb.handlers["GET /settings/my-role"] = () => [200, { role: "staff", permissions: { createOrders: false }, businessId: "b1" }];
    renderApp("/customers");
    expect(await screen.findByText(/you don't have access to customers/i)).toBeInTheDocument();
  });

  it("view without manage (staff): no Add, Export, Edit or Delete", async () => {
    fb.handlers["GET /settings/my-role"] = () => [200, { role: "staff", permissions: { viewCustomers: true, manageCustomers: false }, businessId: "b1" }];
    renderApp("/customers");
    expect((await screen.findAllByText("Amina Yusuf")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /export csv/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /add customer/i })).toBeNull();
  });

  it("view without manage: no Edit or Delete on the profile", async () => {
    fb.handlers["GET /settings/my-role"] = () => [200, { role: "staff", permissions: { viewCustomers: true, manageCustomers: false }, businessId: "b1" }];
    renderApp("/customers/c1");
    expect(await screen.findByRole("heading", { name: "Amina Yusuf", level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /edit/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
  });
});

describe("More menu", () => {
  it("lists every section not in the tab bar, with links", async () => {
    renderApp("/more");
    expect(await screen.findByRole("heading", { name: "More", level: 1 })).toBeInTheDocument();
    const main = screen.getByRole("main");
    for (const [label, to] of [
      ["Customers", "/customers"],
      ["Invoices", "/invoices"],
      ["Projects", "/projects"],
      ["Team", "/settings/team"],
      ["Wallet", "/wallet"],
      ["Online Store", "/store"],
      ["BiSupplyNet", "/bisupplynet"],
      ["FELI AI", "/feli"],
      ["Messages", "/messages"],
      ["Reports", "/reports"],
      ["Settings", "/settings"],
      ["Support", "/support"],
      ["Help", "/support/help"],
    ]) {
      expect(within(main).getByRole("link", { name: new RegExp(`^${label}\\b`) })).toHaveAttribute("href", to);
    }
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });

  it("hides what the role can't use, and locks what the plan doesn't include", async () => {
    fb.handlers["GET /settings/my-role"] = () => [200, { role: "staff", permissions: { manageTeam: false, viewCustomers: false, accessBiSupplyNet: false, sellOnBiSupplyNet: false }, businessId: "b1" }];
    fb.handlers["GET /subscriptions/current"] = () => [200, { plan: "freemium", status: "active", features: { orders: true, invoices: false, projects: false, analytics: true } }];
    renderApp("/more");
    await screen.findByRole("heading", { name: "More", level: 1 });
    const main = screen.getByRole("main");
    for (const gone of ["Customers", "Team", "Wallet", "Subscription", "BiSupplyNet"]) expect(within(main).queryByRole("link", { name: new RegExp(`^${gone}\\b`) })).toBeNull();
    await waitFor(() => expect(within(main).getByRole("link", { name: /^Invoices/ })).toHaveAttribute("data-state", "locked"));
    expect(within(main).getByRole("link", { name: /^Projects/ })).toHaveAttribute("data-state", "locked");
    expect(within(main).getByRole("link", { name: /^Settings/ })).toHaveAttribute("data-state", "visible");
  });
});

describe("live updates", () => {
  it("customer:updated and new orders refresh the directory", async () => {
    const sockets = installFakeSockets();
    try {
      let n = 0;
      fb.handlers["GET /customers"] = () => (n++, [200, page([{ ...AMINA, name: n > 1 ? "Amina Yusuf-Bello" : "Amina Yusuf" }])]);
      renderApp("/customers");
      expect((await screen.findAllByText("Amina Yusuf")).length).toBeGreaterThan(0);
      await waitFor(() => expect(sockets.latest()).toBeTruthy());
      sockets.latest()!.fire("connect");
      sockets.latest()!.fire("customer:updated", { id: "c1" });
      expect((await screen.findAllByText("Amina Yusuf-Bello", {}, { timeout: 3000 })).length).toBeGreaterThan(0);
      const before = n;
      sockets.latest()!.fire("bm:change", { topic: "orders", at: new Date().toISOString() });
      await waitFor(() => expect(n).toBeGreaterThan(before), { timeout: 3000 });
    } finally {
      sockets.restore();
    }
  });
});
