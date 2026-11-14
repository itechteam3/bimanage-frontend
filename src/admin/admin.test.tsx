import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";
import { installFakeSockets } from "@/test/fakeSocket";
import { adminSession, adminStep } from "./lib/session";
import { toCsv } from "./pages/AnalyticsPage";
import type { AdminMe, Capability } from "./lib/types";

vi.mock("qrcode", () => ({ default: { toDataURL: async () => "data:image/png;base64,QR" } }));

// The /admin area (Phase 16): its own session, two-step sign-in with recovery
// codes, role-based navigation, and the actions on each screen.

let fb: FakeBackend;
let sockets: ReturnType<typeof installFakeSockets>;
const last = (key: string) => [...fb.calls].reverse().find((c) => c.key === key);
const ALL: Capability[] = ["stats.read", "users.read", "users.manage", "plans.assign", "suppliers.review", "announcements.send", "orders.read", "disputes.read", "money.manage", "payments.read", "domains.manage", "support.manage", "faqs.manage", "reviews.moderate", "feli.knowledge", "admins.manage", "audit.read", "audit.manual"];
const CAN: Record<string, Capability[]> = {
  superadmin: ALL,
  finance: ["stats.read", "users.read", "plans.assign", "orders.read", "disputes.read", "money.manage", "payments.read"],
  support: ["stats.read", "users.read", "orders.read", "disputes.read", "support.manage", "faqs.manage", "reviews.moderate", "feli.knowledge"],
  reviewer: ["stats.read", "suppliers.review"],
};
const me = (role: keyof typeof CAN, over: Partial<AdminMe> = {}): AdminMe => ({ _id: `a-${role}`, name: `Ada ${role}`, email: `${role}@bitechteam.test`, role: role as AdminMe["role"], roleLabel: { superadmin: "Superadmin", finance: "Finance", support: "Support agent", reviewer: "Reviewer" }[role]!, isActive: true, twoFactorEnabled: true, lastLogin: null, can: CAN[role]!, ...over });
const OVERVIEW = {
  period: { range: "30d", from: "2026-10-16", to: "2026-11-14", days: 30, timezone: "Africa/Lagos" },
  users: { total: 120, verified: 100, suspended: 2, closing: 0, new: 14, newChange: 40 },
  businesses: { freemium: 90, standard: 10, premium: 12, trial: 8, startupPackage: 0 },
  queues: { openTickets: 7, overdueTickets: 2, openDisputes: 1, suppliersToReview: 3, failedRefunds: 0, domainsToAdd: 1 },
  feli: { today: { messages: 3, totalTokens: 6273, peakTokensPerMinute: 6273, rateLimited: 0, busyReplies: 0 } },
  revenue: { total: 8600, plans: 5000, storeCommission: 600, bisupplynetCommission: 3000, previous: 4000, change: 115 },
  test: { plans: 9000, storeCommission: 1500, bisupplynetCommission: 0, storeSales: 50000, bisupplynetSales: 0, total: 10500, label: "Test payments (not real money)" },
  volume: { storeSales: 20000, storeOrders: 1, bisupplynetSales: 100000, bisupplynetOrders: 1 },
  balances: { walletsAvailable: 45000, walletsOnHold: 12000, escrowHeld: 0, escrowFrozen: 100000 },
  series: [{ date: "2026-11-14", signups: 1, revenue: 600, storeSales: 20000, bisupplynetSales: 0 }],
};
const { revenue: _r, test: _t, volume: _v, balances: _b, ...NO_MONEY } = OVERVIEW;

function signedInAs(role: keyof typeof CAN, over: Partial<AdminMe> = {}) {
  adminSession.set(`admin-token-${role}`);
  fb.handlers["GET /admin/me"] = () => [200, me(role, over)];
  fb.handlers["GET /admin/overview"] = () => [200, CAN[role]!.includes("payments.read") ? OVERVIEW : NO_MONEY];
}

beforeEach(() => {
  tokenStore.set("business-token");
  serverStatus.set("up");
  fb = installFakeBackend();
  sockets = installFakeSockets();
});
afterEach(() => {
  adminSession.clear();
  adminStep.clear();
  sockets.restore();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("sign-in", () => {
  it("first time: password, QR set-up, recovery codes shown once, then the overview", async () => {
    fb.handlers["POST /admin/login"] = () => [200, { enrolRequired: true, stepToken: "step-enrol" }];
    fb.handlers["POST /admin/2fa/setup"] = () => [200, { otpauthUrl: "otpauth://totp/BiManage:boss?secret=ABCD", secret: "ABCDEFGHIJKLMNOP" }];
    const codes = Array.from({ length: 10 }, (_, i) => `aaaa-bbbb-${String(i).padStart(4, "0")}`);
    fb.handlers["POST /admin/2fa/enable"] = () => [200, { token: "admin-session", admin: me("superadmin"), recoveryCodes: codes }];
    fb.handlers["GET /admin/me"] = () => [200, me("superadmin")];
    fb.handlers["GET /admin/overview"] = () => [200, OVERVIEW];
    const user = userEvent.setup();
    renderApp("/admin/login");
    await user.type(await screen.findByLabelText(/Email address/), "bitechteamlimited@gmail.com");
    await user.type(screen.getByLabelText(/^Password/), "Strong-pass-123");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(last("POST /admin/login")?.headers.Authorization).toBeUndefined();
    expect(await screen.findByAltText("QR code for your authenticator app")).toHaveAttribute("src", "data:image/png;base64,QR");
    expect(last("POST /admin/2fa/setup")?.body).toEqual({ stepToken: "step-enrol" });
    const boxes = screen.getAllByRole("textbox");
    await user.click(boxes[0]!);
    await user.keyboard("123456");
    await user.click(screen.getByRole("button", { name: "Turn on two-step sign-in" }));
    expect(await screen.findByText("Save your recovery codes")).toBeInTheDocument();
    for (const c of codes) expect(screen.getByText(c)).toBeInTheDocument();
    const go = screen.getByRole("button", { name: "Continue to admin" });
    expect(go).toBeDisabled();
    await user.click(screen.getByLabelText(/saved these codes/));
    await user.click(go);
    expect(await screen.findByRole("heading", { name: "Platform overview" })).toBeInTheDocument();
    expect(adminSession.get()).toBe("admin-session");
    expect(tokenStore.get()).toBe("business-token");
  });

  it("a recovery code works once and says how many are left", async () => {
    adminStep.set({ token: "step-2fa", kind: "2fa", email: "boss@x.com" });
    fb.handlers["POST /admin/login/verify"] = () => [200, { token: "admin-session", admin: me("superadmin"), recoveryCodesLeft: 2 }];
    signedInAs("superadmin");
    adminSession.clear();
    const user = userEvent.setup();
    renderApp("/admin/login/verify");
    await user.click(await screen.findByRole("button", { name: /Use a recovery code/ }));
    await user.type(screen.getByLabelText(/Recovery code/), "aaaa-bbbb-0001");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText(/2 recovery codes left/)).toBeInTheDocument();
    expect(last("POST /admin/login/verify")?.body).toEqual({ stepToken: "step-2fa", recoveryCode: "aaaa-bbbb-0001" });
  });

  it("without an admin session, /admin goes to the admin sign-in (a business session doesn't count)", async () => {
    renderApp("/admin/users");
    expect(await screen.findByRole("heading", { name: "Admin sign-in" })).toBeInTheDocument();
    expect(fb.calls.some((c) => c.key.startsWith("GET /admin/"))).toBe(false);
  });

  it("admin calls carry the admin token, never the business one; a 401 ends the admin session", async () => {
    signedInAs("superadmin");
    renderApp("/admin");
    await screen.findByRole("heading", { name: "Platform overview" });
    expect(last("GET /admin/overview")?.headers.Authorization).toBe("Bearer admin-token-superadmin");
    fb.handlers["GET /admin/users"] = () => [401, { message: "Your admin session has ended.", sessionEnded: true }];
    const user = userEvent.setup();
    await user.click(screen.getAllByRole("link", { name: "Users" })[0]!);
    expect(await screen.findByText(/admin session ended/i)).toBeInTheDocument();
    expect(adminSession.get()).toBeNull();
    expect(tokenStore.get()).toBe("business-token");
  });
});

describe("what each role sees", () => {
  it("a reviewer sees only the overview and supplier verification, and no money", async () => {
    signedInAs("reviewer");
    renderApp("/admin");
    await screen.findByRole("heading", { name: "Platform overview" });
    const nav = screen.getAllByRole("navigation", { name: "Admin" })[0]!;
    expect(within(nav).getAllByRole("link").map((l) => l.textContent?.trim())).toEqual(["Overview", "Supplier KYC", "Analytics"]);
    expect(screen.queryByText("BiTechTeam revenue (live)")).not.toBeInTheDocument();
    expect((await screen.findAllByText(/Supplier verification · 3/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Overdue support tickets/)).not.toBeInTheDocument();
  });

  it("a superadmin sees revenue, with test money labelled and kept apart", async () => {
    signedInAs("superadmin");
    renderApp("/admin");
    expect(await screen.findByText("BiTechTeam revenue (live)")).toBeInTheDocument();
    expect(screen.getByText("₦8,600")).toBeInTheDocument();
    expect(screen.getByText(/Test payments \(not real money\): ₦10,500 in fees/)).toBeInTheDocument();
  });

  it("a page the role can't open says so", async () => {
    signedInAs("support");
    renderApp("/admin/roles");
    expect(await screen.findByText("Not available for your role")).toBeInTheDocument();
  });
});

describe("users", () => {
  it("suspending needs a reason; the reason is sent", async () => {
    signedInAs("superadmin");
    fb.handlers["GET /admin/users/u9"] = () => [200, { user: { _id: "u9", name: "Bola", email: "bola@x.com", isVerified: true, isSuspended: false }, businessProfile: { businessName: "Bola Stores" }, wholesalerProfile: null, stats: { totalOrders: 3, totalProducts: 9 }, plan: null, store: null, memberOf: null, team: [], tickets: [], history: [], suspension: null }];
    fb.handlers["PUT /admin/users/u9/suspend"] = () => [200, { message: "Account suspended. They've been signed out and emailed; the store and listings are hidden." }];
    const user = userEvent.setup();
    renderApp("/admin/users/u9");
    await user.click(await screen.findByRole("button", { name: "Suspend account" }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Suspend account" });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/Reason/), "Selling counterfeit goods");
    await user.click(confirm);
    expect(await screen.findByText(/signed out and emailed/)).toBeInTheDocument();
    expect(last("PUT /admin/users/u9/suspend")?.body).toEqual({ reason: "Selling counterfeit goods" });
  });
});

describe("supplier verification", () => {
  it("request more information with a checklist", async () => {
    signedInAs("reviewer");
    fb.handlers["GET /admin/suppliers/w1"] = () => [200, { supplier: { _id: "w1", businessName: "Wale Wholesale", status: "pending", applicationRef: "BSN-APP-0007", submittedAt: "2026-11-10T10:00:00Z", profileScore: 64, trustScore: 64, location: "", waitingDays: 4, reviewedAt: null, reviewedBy: null, owner: null, accountNumber: "******6789" }, owner: { _id: "u1", name: "Wale", email: "w@x.com", link: "/users/u1" }, business: null, documents: { cacNumber: null, verificationDocument: null }, plan: { tier: "premium", source: "plan", canSell: true }, stats: { products: 0, paidOrders: 0, averageRating: 0, totalReviews: 0 }, history: [], canDecide: true }];
    fb.handlers["PUT /admin/suppliers/w1/request-info"] = () => [200, { message: "Request sent. The application stays in review until they send it again." }];
    const user = userEvent.setup();
    renderApp("/admin/suppliers/w1");
    expect(await screen.findByText("Not given")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Request info" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/What do you need/), "Please add your CAC number.");
    await user.type(within(dialog).getByLabelText("Item 1"), "CAC number");
    await user.click(within(dialog).getByRole("button", { name: "Send request" }));
    expect(await screen.findByText(/Request sent./)).toBeInTheDocument();
    expect(last("PUT /admin/suppliers/w1/request-info")?.body).toEqual({ message: "Please add your CAC number.", items: ["CAC number"] });
  });
});

describe("disputes", () => {
  const DISPUTE = {
    dispute: { _id: "d1", reference: "DSP-0001", status: "open", reason: "item_not_received", description: "Nothing came", responses: [], createdAt: "2026-11-12T10:00:00Z" },
    order: { _id: "o1", trackingNo: "BSN-1", productName: "Rice", quantity: 10, pricePerUnit: 10000, status: "delivered", deliveredAt: null, shippedAt: null, link: "/bisupplynet/orders/o1" },
    money: { mode: "live", isTest: false, totalAmount: 100000, commissionRate: 3, commissionAmount: 3000, supplierPayout: 97000, escrowStatus: "frozen", refundAmount: 0, refundStatus: "none", supplierReceived: null, releasedAt: null, refundedAt: null },
    buyer: { _id: "b1", name: "Bola", email: "b@x.com", phone: null, business: "Bola Stores", link: "/users/b1" },
    supplier: { _id: "w1", businessName: "Wale Wholesale", verificationStatus: "verified", owner: { _id: "u2", name: "Wale", email: "w@x.com" }, link: "/users/u2" },
    ledger: [{ _id: "l1", type: "frozen", amount: 100000, mode: "live", status: "completed", reference: "r1", createdAt: "2026-11-12T10:00:00Z" }],
    canDecide: true,
    conversationId: null,
  };
  it("Finance decides a split with the refund amount and a note", async () => {
    signedInAs("finance");
    fb.handlers["GET /admin/bisupplynet/disputes/d1"] = () => [200, DISPUTE];
    fb.handlers["PUT /disputes/d1/resolve"] = () => [200, { message: "Dispute resolved" }];
    const user = userEvent.setup();
    renderApp("/admin/bisupplynet/disputes/d1");
    await user.click(await screen.findByRole("button", { name: "Split: part refund" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Refund to the buyer/), "40000");
    await user.type(within(dialog).getByLabelText(/Decision note/), "Half the bags arrived damaged.");
    await user.click(within(dialog).getByRole("button", { name: "Confirm decision" }));
    expect(await screen.findByText("Dispute resolved")).toBeInTheDocument();
    expect(last("PUT /disputes/d1/resolve")?.body).toEqual({ outcome: "partial", refundAmount: 40000, resolution: "Half the bags arrived damaged.", reason: "Half the bags arrived damaged." });
    expect(last("PUT /disputes/d1/resolve")?.headers.Authorization).toBe("Bearer admin-token-finance");
  });
  it("Support can read the case but not decide it", async () => {
    signedInAs("support");
    fb.handlers["GET /admin/bisupplynet/disputes/d1"] = () => [200, DISPUTE];
    renderApp("/admin/bisupplynet/disputes/d1");
    expect(await screen.findByText(/only Finance and superadmins can/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refund the buyer in full" })).not.toBeInTheDocument();
  });
});

describe("support", () => {
  it("take a ticket and reply", async () => {
    signedInAs("support");
    const ticket = { _id: "t1", ticketNumber: "TKT-00007", subject: "Payout missing", message: "Where is my money?", category: "wallet", priority: "high", status: "open", user: { _id: "u1", name: "Bola", email: "b@x.com" }, assignedTo: null, sla: { targetHours: 4, dueAt: new Date(Date.now() + 3600e3).toISOString(), respondedAt: null, state: "due_soon" }, createdAt: "2026-11-14T08:00:00Z", business: null, replies: [], links: { customer: "/users/u1" } };
    fb.handlers["GET /admin/support/tickets/t1"] = () => [200, ticket];
    fb.handlers["GET /admin/support/assignees"] = () => [200, []];
    fb.handlers["PUT /admin/support/tickets/t1/assign"] = () => [200, { message: "Assigned to Ada support." }];
    fb.handlers["PUT /support/admin/tickets/t1/reply"] = () => [200, ticket];
    const user = userEvent.setup();
    renderApp("/admin/support/tickets/t1");
    await user.click(await screen.findByRole("button", { name: "Take this ticket" }));
    await waitFor(() => expect(last("PUT /admin/support/tickets/t1/assign")?.body).toEqual({ adminId: "me" }));
    await user.type(screen.getByLabelText(/Your reply/), "We've checked: it goes out tomorrow.");
    await user.click(screen.getByRole("button", { name: "Send reply" }));
    expect(await screen.findByText(/Reply sent/)).toBeInTheDocument();
    expect(last("PUT /support/admin/tickets/t1/reply")?.body).toEqual({ message: "We've checked: it goes out tomorrow." });
  });
});

describe("announcements", () => {
  it("email to everyone goes for approval, and its author can't approve it", async () => {
    signedInAs("superadmin");
    const a = { _id: "n1", title: "Maintenance tonight", body: "BiManage will be down 1am to 2am.", audience: { kind: "all", plans: [] }, channels: { inApp: true, email: true }, status: "draft", scheduledAt: null, createdBy: { email: "superadmin@bitechteam.test" }, needsApproval: true, editable: true, createdAt: "2026-11-14T08:00:00Z" };
    let current: Record<string, unknown> = a;
    fb.handlers["GET /admin/announcements/n1"] = () => [200, current];
    fb.handlers["GET /admin/announcements/n1/preview"] = () => [200, { recipients: 118, inApp: { title: a.title, message: a.body, link: null }, email: { subject: "Maintenance tonight | BiManage", html: "<p>Hi</p>" }, needsApproval: true }];
    fb.handlers["POST /admin/announcements/n1/submit"] = () => ((current = { ...a, status: "pending_approval", editable: false, submittedBy: { email: "superadmin@bitechteam.test", at: "now" } }), [200, { ...current, message: "Waiting for another admin to approve (email to everyone)." }]);
    const user = userEvent.setup();
    renderApp("/admin/announcements/n1");
    expect(await screen.findByText("118")).toBeInTheDocument();
    expect(screen.getByTitle("Email preview")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send for approval" }));
    expect(await screen.findByText(/Waiting for another admin to approve \(email/)).toBeInTheDocument();
    expect(await screen.findByText(/You wrote or sent this one/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve and send" })).not.toBeInTheDocument();
  });
});

describe("analytics export", () => {
  it("CSV cells can't run as spreadsheet formulas", () => {
    expect(toCsv([["a", "=SUM(A1)"], ["-5", 'x"y']])).toBe(`a,'=SUM(A1)\n'-5,"x""y"`);
  });
});

describe("passwords and recovery codes", () => {
  it("forgot password: the same message for anyone, no session needed", async () => {
    fb.handlers["POST /admin/password/forgot"] = () => [200, { message: "If that email belongs to a BiManage admin, we've sent a link to set a new password. It expires in 15 minutes." }];
    const user = userEvent.setup();
    renderApp("/admin/login");
    await user.click(await screen.findByRole("link", { name: "Forgot password?" }));
    await user.type(await screen.findByLabelText(/Admin email/), "boss@bitechteam.test");
    await user.click(screen.getByRole("button", { name: "Email me a link" }));
    expect(await screen.findByText(/If that email belongs to a BiManage admin/)).toBeInTheDocument();
    expect(last("POST /admin/password/forgot")?.headers.Authorization).toBeUndefined();
  });

  it("the reset link sets a new password, then it's sign-in with two-step", async () => {
    fb.handlers["POST /admin/password/reset"] = (b) => (b.token === "good" ? [200, { message: "ok", twoFactorRequired: true }] : [400, { message: "This link has expired or was already used. Ask for a new one.", restart: true }]);
    const user = userEvent.setup();
    renderApp("/admin/reset-password?token=good");
    await user.type(await screen.findByLabelText(/^New password/), "Brand-new-pass-1");
    await user.type(screen.getByLabelText(/Confirm new password/), "Brand-new-pass-1");
    await user.click(screen.getByRole("button", { name: "Set new password" }));
    expect(await screen.findByText(/Sign in with your new password and your authenticator app/)).toBeInTheDocument();
    expect(last("POST /admin/password/reset")?.body).toEqual({ token: "good", newPassword: "Brand-new-pass-1" });
  });

  it("changing the password asks for a two-step code", async () => {
    signedInAs("superadmin");
    fb.handlers["PUT /admin/me/password"] = () => [200, { message: "ok", token: "fresh-admin-token" }];
    const user = userEvent.setup();
    renderApp("/admin/account");
    await user.type(await screen.findByLabelText(/Current password/), "Old-password-123");
    await user.type(screen.getByLabelText(/^New password/), "New-password-456");
    const go = screen.getByRole("button", { name: "Change password" });
    expect(go).toBeDisabled();
    const section = screen.getByRole("heading", { name: "Change password" }).closest("section")!;
    const boxes = within(section as HTMLElement).getAllByRole("textbox");
    await user.click(boxes[0]!);
    await user.keyboard("123456");
    await user.click(go);
    expect(await screen.findByText(/other admin sessions were signed out/)).toBeInTheDocument();
    expect(last("PUT /admin/me/password")?.body).toEqual({ currentPassword: "Old-password-123", newPassword: "New-password-456", code: "123456" });
    expect(adminSession.get()).toBe("fresh-admin-token");
  });

  it("new recovery codes are named after the admin", async () => {
    signedInAs("superadmin", { name: "Elijah Ayanlere", email: "elijah@bitechteam.test" });
    fb.handlers["POST /admin/me/recovery-codes"] = () => [200, { recoveryCodes: Array.from({ length: 10 }, (_, i) => `ABCD-EF${i}${i}`), generatedAt: "2026-11-14T10:00:00Z" }];
    const user = userEvent.setup();
    renderApp("/admin/account");
    const box = (await screen.findByRole("heading", { name: "Recovery codes" })).closest("section")! as HTMLElement;
    await user.click(within(box).getAllByRole("textbox")[0]!);
    await user.keyboard("123456");
    await user.click(within(box).getByRole("button", { name: "Generate new recovery codes" }));
    expect(await screen.findByText("File: elijah-ayanlere-bimanage-admin-recovery-codes-2026-11-14.txt")).toBeInTheDocument();
    expect(screen.getByText("ABCD-EF00")).toBeInTheDocument();
  });

  it("file name and header rules", async () => {
    const { nameSlug, codesFilename, codesText } = await import("./components/RecoveryCodesPanel");
    expect(nameSlug("  Élijah  O'Ayanlere-Smith ")).toBe("elijah-oayanlere-smith");
    expect(codesFilename({ name: "Elijah Ayanlere", email: "e@x.com" }, new Date("2026-11-14T23:30:00Z"))).toBe("elijah-ayanlere-bimanage-admin-recovery-codes-2026-11-15.txt");
    const t = codesText({ name: "Elijah Ayanlere", email: "e@x.com", roleLabel: "Superadmin" }, ["AAAA-BBBB"], new Date("2026-11-14T10:00:00Z"));
    expect(t).toMatch(/Name:\s+Elijah Ayanlere/);
    expect(t).toMatch(/Email:\s+e@x\.com/);
    expect(t).toMatch(/Role:\s+Superadmin/);
    expect(t).toMatch(/Generated: /);
    expect(t).toContain("Keep these safe and private. Each code works once. Generating new codes invalidates these.");
    expect(t).toContain(" 1. AAAA-BBBB");
  });

  it("a superadmin forces another admin's password reset", async () => {
    signedInAs("superadmin");
    fb.handlers["GET /admin/admins"] = () => [200, [{ _id: "a2", name: "Sola", email: "sola@x.com", role: "support", roleLabel: "Support agent", isActive: true, twoFactorEnabled: true, lastLogin: null, createdAt: "2026-11-14T08:00:00Z" }]];
    fb.handlers["PUT /admin/admins/a2/force-password-reset"] = () => [200, { message: "Sola's password no longer works and they've been signed out. We emailed them a link to set a new one (valid 24 hours)." }];
    const user = userEvent.setup();
    renderApp("/admin/roles");
    await user.click((await screen.findAllByRole("button", { name: "Manage" }))[0]!);
    await user.click(await screen.findByRole("button", { name: "Force a password reset" }));
    expect(await screen.findByText(/valid 24 hours/)).toBeInTheDocument();
  });
});

describe("photos", () => {
  it("the photo shows in the header, and beside names in the audit trail", async () => {
    signedInAs("superadmin", { avatar: "https://res.cloudinary.com/x/bimanage/admin-avatars/me.jpg" });
    fb.handlers["GET /admin/audit"] = () => [200, { entries: [{ id: "e1", at: "2026-11-14T08:00:00Z", recordedAt: "2026-11-14T08:00:00Z", action: "user.suspend", by: "sola@x.com", byName: "Sola", avatar: "https://res.cloudinary.com/x/bimanage/admin-avatars/sola.jpg", role: "support", via: "admin", targetType: "user", targetId: "u1", summary: null, reason: null }], total: 1, page: 1, totalPages: 1 }];
    renderApp("/admin/audit");
    await screen.findByRole("heading", { name: "Audit trail" });
    await screen.findAllByText("Sola (Support)");
    const srcs = Array.from(document.querySelectorAll("img")).map((i) => i.getAttribute("src"));
    expect(srcs).toContain("https://res.cloudinary.com/x/bimanage/admin-avatars/me.jpg");
    expect(srcs).toContain("https://res.cloudinary.com/x/bimanage/admin-avatars/sola.jpg");
  });

  it("the avatar menu opens the photo editor", async () => {
    signedInAs("superadmin");
    const user = userEvent.setup();
    renderApp("/admin");
    await screen.findByRole("heading", { name: "Platform overview" });
    await user.click(screen.getByRole("button", { name: /Ada superadmin/ }));
    await user.click(screen.getByRole("menuitem", { name: "Change photo" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Profile photo");
  });
});

describe("admin invites", () => {
  it("the invite page: welcome, own password, then two-step set-up with the guide open", async () => {
    fb.handlers["GET /admin/invite"] = () => [200, { valid: true, name: "Sola Adebanjo", email: "sola@bitechteam.org", role: "support", roleLabel: "Support agent", invitedBy: "BiTechTeam (bitechteamlimited@gmail.com)", expiresAt: "2026-11-16T10:00:00Z" }];
    fb.handlers["POST /admin/invite/accept"] = () => [200, { enrolRequired: true, stepToken: "step-enrol", email: "sola@bitechteam.org" }];
    fb.handlers["POST /admin/2fa/setup"] = () => [200, { otpauthUrl: "otpauth://totp/x?secret=ABCD", secret: "ABCDEFGHIJKLMNOP" }];
    const user = userEvent.setup();
    renderApp("/admin/invite?token=tok123");
    expect(await screen.findByRole("heading", { name: "Welcome, Sola" })).toBeInTheDocument();
    expect(screen.getByText(/BiTechTeam added you as Support agent/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Choose a password/), "Harbour-lantern-58");
    await user.type(screen.getByLabelText(/Confirm password/), "Harbour-lantern-58");
    await user.click(screen.getByRole("button", { name: "Continue to two-step sign-in" }));
    expect(await screen.findByRole("heading", { name: "Scan the QR code" })).toBeInTheDocument();
    expect(last("POST /admin/invite/accept")?.body).toEqual({ token: "tok123", newPassword: "Harbour-lantern-58" });
    expect(screen.getByText(/Install an authenticator app/)).toBeVisible();
    expect(last("POST /admin/2fa/setup")?.body).toEqual({ stepToken: "step-enrol" });
  });

  it("an expired invite explains itself", async () => {
    fb.handlers["GET /admin/invite"] = () => [400, { message: "This invite link has expired or was already used. Ask the superadmin who added you to resend it.", valid: false }];
    renderApp("/admin/invite?token=old");
    expect(await screen.findByRole("heading", { name: "This invite can't be used" })).toBeInTheDocument();
  });

  it("inviting sends no password; a pending invite can be resent or expired", async () => {
    signedInAs("superadmin");
    fb.handlers["GET /admin/admins"] = () => [200, [{ _id: "a2", name: "Sola", email: "sola@x.com", role: "support", roleLabel: "Support agent", isActive: true, twoFactorEnabled: false, lastLogin: null, createdAt: "2026-11-14T08:00:00Z", invite: { status: "pending", expiresAt: "2026-11-16T08:00:00Z", sentAt: "2026-11-14T08:00:00Z", invitedBy: "BiTechTeam (b@x.com)", acceptedAt: null } }]];
    fb.handlers["POST /admin/admins"] = () => [201, { message: "Invite sent to kemi@x.com. The link works for 48 hours." }];
    fb.handlers["POST /admin/admins/a2/invite/resend"] = () => [200, { message: "New invite sent to sola@x.com. The old link no longer works." }];
    const user = userEvent.setup();
    renderApp("/admin/roles");
    expect((await screen.findAllByText(/Invite sent · expires/)).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Invite an admin" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByLabelText(/password/i)).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Name/), "Kemi");
    await user.type(within(dialog).getByLabelText(/Email/), "kemi@x.com");
    await user.click(within(dialog).getByRole("button", { name: "Send invite" }));
    expect(await screen.findByText(/Invite sent to kemi@x.com/)).toBeInTheDocument();
    expect(last("POST /admin/admins")?.body).toEqual({ name: "Kemi", email: "kemi@x.com", role: "support" });
    await user.click(screen.getAllByRole("button", { name: "Manage" })[0]!);
    await user.click(await screen.findByRole("button", { name: "Resend invite" }));
    expect(await screen.findByText(/The old link no longer works/)).toBeInTheDocument();
  });
});
