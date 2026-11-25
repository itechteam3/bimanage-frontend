// Guided tours (coach marks): short, friendly steps that point at each key
// feature the first time someone opens a page. Progress is saved per person,
// per page, on the server (GET/PUT /api/tours), so a finished tour doesn't come
// back on another device. Bump a tour's `version` to show it again after the
// page changes meaningfully.
//
// Steps find their target on the page by a heading, a card label, a button or
// link's text, a nav link, or a CSS selector. A step whose target isn't on the
// page (hidden by role, plan or an empty state) is left out, so the counter
// (1/5) always matches what the person sees. A step without a target is shown
// in the middle of the screen.

export interface TourTarget {
  /** A heading (h1–h3) in the page that starts with this text; its card is highlighted. */
  heading?: string;
  /** A card whose label is exactly this text (KPI cards, summary rows). */
  label?: string;
  /** A button or link in the page whose text contains this. */
  text?: string;
  /** Any element (page-wide), e.g. the help button. */
  selector?: string;
}

export interface TourStep {
  target?: TourTarget;
  title: string;
  body: string;
}

export interface Tour {
  /** Saved under this key; lowercase letters, numbers and "-". */
  id: string;
  /** The page's path (exact). */
  paths: string[];
  /** Shown in the help menu: "Show me around: Dashboard". */
  name: string;
  version: number;
  steps: TourStep[];
}

const HELP: TourStep = {
  target: { selector: '[data-tour="help"]' },
  title: "Help is always here",
  body: "Open Help and choose “Show me around” to see this tour again on any page.",
};

export const TOURS: Tour[] = [
  {
    id: "dashboard",
    paths: ["/dashboard"],
    name: "Dashboard",
    version: 1,
    steps: [
      { title: "Welcome to your dashboard", body: "This is your business at a glance. Here's a quick look around: it takes under a minute." },
      { target: { label: "Revenue" }, title: "Your key numbers", body: "Revenue, orders, open invoices and low stock, kept up to date as you work." },
      { target: { heading: "Today's priorities" }, title: "Today's priorities", body: "The things that need you today, like unpaid invoices and stock running low." },
      { target: { heading: "Sales trend" }, title: "How sales are moving", body: "Your revenue over the last 7 days, so you can spot good and slow days." },
      { target: { heading: "Top-selling products" }, title: "Your best sellers", body: "The products selling the most, so you know what to restock first." },
      HELP,
    ],
  },
  {
    id: "inventory",
    paths: ["/inventory"],
    name: "Inventory",
    version: 1,
    steps: [
      { title: "Your inventory", body: "Everything you stock, how much it's worth and what's running low." },
      { target: { label: "Total products" }, title: "Stock at a glance", body: "Total products, stock value, and how many are low or sold out." },
      { target: { text: "Inventory products" }, title: "All your products", body: "See, search and edit every product, and adjust stock quantities." },
      { target: { text: "Barcode lookup" }, title: "Find by barcode", body: "Scan with your phone or laptop camera, use a barcode scanner, or type the code." },
      { target: { heading: "Stock health" }, title: "What needs attention", body: "Products that are sold out or running low, sold-out first." },
      HELP,
    ],
  },
  {
    id: "sales",
    paths: ["/sales"],
    name: "Sales",
    version: 1,
    steps: [
      { title: "Your sales", body: "Know what's selling and who has paid, all in one place." },
      { target: { label: "Revenue" }, title: "Sales numbers", body: "Revenue, orders, open invoices and low stock for your business." },
      { target: { heading: "Recent sales activity" }, title: "Latest sales", body: "Your most recent orders, newest first." },
      { target: { text: "Create an order" }, title: "Record a sale", body: "Create an order in seconds. Stock updates by itself." },
      { target: { text: "Create invoice" }, title: "Send an invoice", body: "Bill a customer and follow the payment until it's paid." },
      HELP,
    ],
  },
  {
    id: "orders",
    paths: ["/orders"],
    name: "Orders",
    version: 1,
    steps: [
      { title: "Your orders", body: "Every sale, payment and delivery in one place." },
      { target: { selector: '[data-app-main] [role="search"]' }, title: "Find any order", body: "Search by order number, customer or product." },
      { target: { selector: '[data-app-main] [aria-label="Filter by status"]' }, title: "Filter by status", body: "See only orders awaiting payment, still to fulfil, or completed." },
      { target: { text: "Create order" }, title: "Record a new sale", body: "Pick products (or scan their barcodes), the customer and how they paid." },
      HELP,
    ],
  },
  {
    id: "invoices",
    paths: ["/invoices"],
    name: "Invoices",
    version: 1,
    steps: [
      { title: "Your invoices", body: "Follow every invoice from draft to paid." },
      { target: { text: "Create invoice" }, title: "Create an invoice", body: "Add items, tax and the client, then email it or download a PDF." },
      { target: { selector: '[data-app-main] [aria-label="Filter by status"]' }, title: "Filter by status", body: "See drafts, sent, overdue or paid invoices." },
      { target: { selector: '[data-app-main] [aria-label="Invoice preview"]' }, title: "Preview", body: "See exactly what your client will get before you send it." },
      HELP,
    ],
  },
  {
    id: "customers",
    paths: ["/customers"],
    name: "Customers",
    version: 1,
    steps: [
      { title: "Your customers", body: "Everyone you sell to, with their orders and how much they've spent." },
      { target: { label: "Total customers" }, title: "Customers at a glance", body: "How many customers you have, who's new this month and who keeps coming back." },
      { target: { selector: '[data-app-main] [role="search"]' }, title: "Find a customer", body: "Search by name, email or phone number." },
      { target: { text: "Add customer" }, title: "Add a customer", body: "Save their details once and use them on orders and invoices." },
      HELP,
    ],
  },
  {
    id: "store",
    paths: ["/store"],
    name: "Online store",
    version: 1,
    steps: [
      { title: "Your online store", body: "Sell online with your own store page. Everything you need to set it up is here." },
      { target: { heading: "Store readiness" }, title: "Get ready to publish", body: "Finish the required steps, then publish your store for customers to see." },
      { target: { label: "Completion" }, title: "Your progress", body: "How far along your store is, its products, template and status." },
      { target: { heading: "Next actions" }, title: "What to do next", body: "Suggestions to get more from your store." },
      HELP,
    ],
  },
  {
    id: "wallet",
    paths: ["/wallet"],
    name: "Wallet",
    version: 1,
    steps: [
      { title: "Your wallet", body: "Money from your online store lands here, ready to pay out to your bank." },
      { target: { label: "Available" }, title: "Ready to withdraw", body: "Money you can pay out to your bank account now." },
      { target: { label: "On hold" }, title: "On hold", body: "Earnings wait here until the order is completed, or 7 days after delivery." },
      { target: { text: "Request payout" }, title: "Pay yourself", body: "Send your available balance to your bank. You'll see the fee before you confirm." },
      { target: { heading: "Transaction activity" }, title: "Money in and out", body: "Every payment, fee and payout, with its status." },
      HELP,
    ],
  },
  {
    id: "projects",
    paths: ["/projects"],
    name: "Projects",
    version: 1,
    steps: [
      { title: "Your projects", body: "Plan work, share tasks with your team and keep deadlines in view." },
      { target: { label: "Active projects" }, title: "Work at a glance", body: "Active projects, tasks in progress and what's coming up." },
      { target: { selector: '[data-app-main] [aria-label="Project views"]' }, title: "Switch views", body: "See your projects as a list, a board or a calendar." },
      { target: { heading: "Projects in progress" }, title: "Projects in progress", body: "Open a project to add tasks, assign people and set due dates." },
      HELP,
    ],
  },
  {
    id: "team",
    paths: ["/settings/team"],
    name: "Team",
    version: 1,
    steps: [
      { title: "Your team", body: "Control who works with your business and what each person can see and do." },
      { target: { text: "Invite teammate" }, title: "Invite a teammate", body: "Send an invite by email and choose their role." },
      { target: { selector: "[data-app-main] table, [data-app-main] ul[aria-label]" }, title: "People and roles", body: "Change someone's role or permissions, or remove them, at any time." },
      HELP,
    ],
  },
  {
    id: "feli",
    paths: ["/feli"],
    name: "FELI",
    version: 1,
    steps: [
      { title: "Meet FELI", body: "Your business AI assistant: ask about your sales, stock or how to do something in BiManage." },
      { target: { selector: '[data-app-main] [aria-label="Suggested questions"]' }, title: "Not sure what to ask?", body: "Tap a suggested question to get started." },
      { target: { selector: '[data-app-main] [aria-label="Chat with FELI"]' }, title: "Chat with FELI", body: "Type your question here. FELI answers using your business data." },
      { target: { selector: '[data-app-main] [aria-label="Suggestions to review"]' }, title: "Suggestions to review", body: "Drafts FELI prepares for you. Nothing is sent until you approve it." },
      HELP,
    ],
  },
  {
    id: "bisupplynet",
    // /bisupplynet sends buyers here.
    paths: ["/bisupplynet/suppliers"],
    name: "BiSupplyNet",
    version: 1,
    steps: [
      { title: "Welcome to BiSupplyNet", body: "Buy stock from verified suppliers. Your payment is held safely until the order arrives." },
      { target: { selector: '[data-app-main] [role="search"], [data-app-main] form' }, title: "Find the right supplier", body: "Filter by category, state and trust score, or search by name." },
      { target: { heading: "Verified wholesale partners" }, title: "Verified suppliers", body: "Every supplier here is checked by BiTechTeam. Open one to see their products and reviews." },
      { target: { text: "Explore products" }, title: "Browse products", body: "Compare products and wholesale prices across suppliers, then order in a few taps." },
      HELP,
    ],
  },
  {
    id: "reports",
    paths: ["/reports"],
    name: "Reports",
    version: 1,
    steps: [
      { title: "Analytics and reports", body: "Revenue, stock and collections together, for any period you choose." },
      { target: { label: "Revenue" }, title: "Key numbers", body: "Revenue, orders, average order and low stock for the selected period." },
      { target: { heading: "Revenue trend" }, title: "Revenue trend", body: "Money taken each day, from direct sales and your online store." },
      { target: { heading: "Best sellers" }, title: "Best sellers", body: "Your top products by units sold, across both channels." },
      { target: { heading: "What to watch next" }, title: "What to watch", body: "Pointers on what to look at next." },
      HELP,
    ],
  },
  {
    id: "settings",
    paths: ["/settings"],
    name: "Settings",
    version: 1,
    steps: [
      { title: "Settings", body: "Your account, your business and how BiManage works for you." },
      { target: { heading: "Profile" }, title: "Your profile", body: "Your name, photo and contact details." },
      { target: { heading: "Business profile" }, title: "Business profile", body: "Your business name, logo and details used on invoices and your store." },
      { target: { heading: "Workspace preferences" }, title: "Preferences", body: "Your start page, reduce motion and larger text." },
      { target: { heading: "Security and password" }, title: "Stay secure", body: "Change your password and turn on two-step sign-in." },
      HELP,
    ],
  },
];

/** The tour for a path, if it has one. */
export const tourFor = (pathname: string) => {
  const p = pathname.replace(/\/+$/, "") || "/";
  return TOURS.find((t) => t.paths.includes(p));
};

export type TourState = Record<string, { status: "completed" | "skipped"; version: number; at?: string | null }>;

/** Should this tour start by itself? Not after it was finished or skipped (same version). */
export const shouldAutoStart = (tour: Tour, seen: TourState | undefined) => {
  if (!seen) return false; // progress not loaded (or failed): never pop up unasked
  const s = seen[tour.id];
  return !s || s.version < tour.version;
};

// ---------------------------------------------------------------------------
// Finding targets

const visible = (el: Element) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
const textOf = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim();

export function resolveTarget(t: TourTarget, doc: Document = document): HTMLElement | null {
  const root: ParentNode = doc.querySelector("[data-app-main]") ?? doc;
  const pick = (els: Iterable<Element>) => {
    for (const el of els) if (visible(el)) return el as HTMLElement;
    return null;
  };
  if (t.selector) return pick(doc.querySelectorAll(t.selector));
  if (t.heading) {
    const want = t.heading.toLowerCase();
    const h = pick([...root.querySelectorAll("h1, h2, h3")].filter((e) => textOf(e).toLowerCase().startsWith(want)));
    return h ? ((h.closest("section") as HTMLElement | null) ?? h) : null;
  }
  if (t.label) {
    const want = t.label.toLowerCase();
    const el = pick([...root.querySelectorAll("p, span, dt, h3, div")].filter((e) => e.children.length === 0 && textOf(e).toLowerCase() === want));
    return el ? ((el.closest("section, article, li, a") as HTMLElement | null) ?? el.parentElement ?? el) : null;
  }
  if (t.text) {
    const want = t.text.toLowerCase();
    return pick([...root.querySelectorAll("a, button")].filter((e) => textOf(e).toLowerCase().includes(want)));
  }
  return null;
}

// ---------------------------------------------------------------------------
// Placing the pop-up

export type Placement =
  | { mode: "center" }
  | { mode: "sheet"; edge: "top" | "bottom" }
  | { mode: "float"; side: "top" | "bottom"; top: number; left: number; arrowX: number };

export const PHONE_MAX = 767;

/**
 * Where the pop-up goes. Phones get a sheet docked to the bottom (or the top
 * when the target is low on the screen); wider screens float it under the
 * target, or above when there's no room, kept 16px inside the screen.
 */
export function place(rect: { top: number; left: number; width: number; height: number } | null, pop: { width: number; height: number }, vw: number, vh: number, gap = 12, margin = 16): Placement {
  if (!rect) return { mode: "center" };
  if (vw <= PHONE_MAX) return { mode: "sheet", edge: rect.top + rect.height / 2 > vh * 0.55 ? "top" : "bottom" };
  const below = rect.top + rect.height + gap;
  const above = rect.top - gap - pop.height;
  const side = below + pop.height <= vh - margin || above < margin ? "bottom" : "top";
  const top = side === "bottom" ? Math.min(below, Math.max(margin, vh - margin - pop.height)) : above;
  const left = Math.min(Math.max(rect.left + rect.width / 2 - pop.width / 2, margin), Math.max(margin, vw - margin - pop.width));
  const arrowX = Math.min(Math.max(rect.left + rect.width / 2 - left, 20), pop.width - 20);
  return { mode: "float", side, top, left, arrowX };
}
