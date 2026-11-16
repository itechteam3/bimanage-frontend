import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";
import { installFakeSockets } from "@/test/fakeSocket";
import { adminSession } from "./lib/session";
import type { AdminMe, AdminRole, Capability } from "./lib/types";
import type { AdminReview } from "./pages/ReviewsPages";

// /admin/reviews: the moderation policy, filters, and actions that always
// need a reason (Other needs a note). Restore is for superadmins only.

let fb: FakeBackend;
let sockets: ReturnType<typeof installFakeSockets>;
const last = (key: string) => [...fb.calls].reverse().find((c) => c.key === key);
const me = (role: AdminRole, can: Capability[]): AdminMe => ({ _id: `a-${role}`, name: `Ada ${role}`, email: `${role}@bitechteam.test`, role, roleLabel: role, isActive: true, twoFactorEnabled: true, lastLogin: null, can });
const PROBLEMS = [{ value: "spam", label: "Spam" }, { value: "abusive", label: "Abusive or hateful" }, { value: "personal_data", label: "Personal data" }, { value: "off_topic", label: "Off-topic" }, { value: "suspected_fake", label: "Suspected fake" }, { value: "other", label: "Other" }];
const REASONS = { approve: [{ value: "meets_guidelines", label: "Meets the guidelines" }, { value: "other", label: "Other" }], reject: PROBLEMS, unpublish: PROBLEMS, delete: PROBLEMS, restore: [{ value: "deleted_by_mistake", label: "Deleted by mistake" }, { value: "other", label: "Other" }] };
const review = (over: Partial<AdminReview> = {}): AdminReview => ({
  _id: "rv1",
  headline: "Too slow on Mondays",
  review: "The dashboard takes ages to load.",
  rating: 2,
  category: "product_experience",
  featuresUsed: ["inventory"],
  businessName: "Ada Stores",
  isVerified: true,
  status: "pending",
  reviewer: { _id: "u9", name: "Ada Okafor", email: "ada@shop.example" },
  createdAt: "2026-11-10T10:00:00Z",
  updatedAt: "2026-11-10T10:00:00Z",
  edited: false,
  moderatedAt: null,
  deletedAt: null,
  restoreUntil: null,
  lastAction: null,
  history: [],
  ...over,
});

let current: AdminReview;
function signedInAs(role: AdminRole) {
  const can: Capability[] = role === "superadmin" ? ["stats.read", "notifications.own", "reviews.moderate", "users.read", "admins.manage"] : role === "finance" ? ["stats.read", "notifications.own", "money.manage"] : ["stats.read", "notifications.own", "suppliers.review", "reviews.moderate"];
  adminSession.set(`admin-token-${role}`);
  fb.handlers["GET /admin/me"] = () => [200, me(role, can)];
}

beforeEach(() => {
  tokenStore.set("business-token");
  serverStatus.set("up");
  fb = installFakeBackend();
  sockets = installFakeSockets();
  current = review();
  fb.handlers["GET /admin/reviews"] = () => [200, { reviews: [current, review({ _id: "rv2", status: "approved", rating: 5, headline: "Brilliant", reviewer: { _id: "u8", name: "Bola", email: "bola@x.com" }, businessName: "Bola Bakes" })], total: 2, page: 1, totalPages: 1, counts: { pending: 1, approved: 1, rejected: 0, deleted: 0 }, reasons: REASONS }];
  fb.handlers["GET /admin/reviews/rv1"] = () => [200, { review: current, reasons: REASONS }];
});
afterEach(() => {
  adminSession.clear();
  sockets.restore();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the reviews list", () => {
  it("shows the policy note, every status, and sends the filters", async () => {
    signedInAs("reviewer");
    const user = userEvent.setup();
    renderApp("/admin/reviews");
    expect(await screen.findByText("Don't reject reviews just because they're negative. Moderate for spam, abuse, personal data, off-topic or fake content.")).toBeInTheDocument();
    expect((await screen.findAllByText("Too slow on Mondays")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bola Bakes").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Reviews" }).length).toBeGreaterThan(0);
    await user.selectOptions(screen.getByLabelText("Status"), "deleted");
    await user.selectOptions(screen.getByLabelText("Rating"), "2");
    await user.type(screen.getByLabelText("Submitted from"), "2026-11-01");
    await user.type(screen.getByPlaceholderText("Search text, reviewer or business"), "ada@shop");
    await waitFor(() => {
      const call = [...fb.calls].reverse().find((c) => c.key === "GET /admin/reviews");
      expect(call).toBeTruthy();
    });
    await waitFor(() => {
      const urls = (fetch as unknown as { mock: { calls: Array<[string]> } }).mock.calls.map((c) => c[0]).filter((u) => u.includes("/admin/reviews?"));
      const lastUrl = new URL(urls[urls.length - 1]!);
      expect(lastUrl.searchParams.get("status")).toBe("deleted");
      expect(lastUrl.searchParams.get("rating")).toBe("2");
      expect(lastUrl.searchParams.get("from")).toBe("2026-11-01");
      expect(lastUrl.searchParams.get("q")).toBe("ada@shop");
    });
  });

  it("isn't in the menu for roles that can't moderate", async () => {
    signedInAs("finance");
    renderApp("/admin/reviews");
    expect(await screen.findByText("Not available for your role")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Reviews" })).not.toBeInTheDocument();
  });
});

describe("moderating one review", () => {
  it("approve needs a reason; Other needs a note; the request carries both", async () => {
    signedInAs("reviewer");
    fb.handlers["POST /admin/reviews/rv1/approve"] = (body) => {
      current = review({ status: "approved", history: [{ action: "approve", from: "pending", to: "approved", reason: String(body.reason), reasonLabel: "Other", note: String(body.note), by: { name: "Ada reviewer", email: "reviewer@bitechteam.test" }, at: new Date().toISOString() }] });
      return [200, { message: "Review approved. It's now public.", review: current }];
    };
    const user = userEvent.setup();
    renderApp("/admin/reviews/rv1");
    expect(await screen.findByText("The dashboard takes ages to load.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Approve" }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Approve" });
    expect(confirm).toBeDisabled();
    await user.selectOptions(within(dialog).getByLabelText("Reason"), "other");
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox"), "Negative but fair");
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(await screen.findByText("Review approved. It's now public.")).toBeInTheDocument();
    expect(last("POST /admin/reviews/rv1/approve")?.body).toEqual({ reason: "other", note: "Negative but fair" });
    expect(await screen.findByText("Other: Negative but fair")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Un-publish" })).toBeInTheDocument();
  });

  it("deleted: only a superadmin sees Restore, within 30 days", async () => {
    current = review({ status: "deleted", deletedAt: new Date().toISOString(), restoreUntil: new Date(Date.now() + 29 * 864e5).toISOString() });
    signedInAs("reviewer");
    renderApp("/admin/reviews/rv1");
    expect(await screen.findByText("Only a superadmin can restore a deleted review.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument();
  });

  it("a superadmin restores a deleted review with a reason", async () => {
    current = review({ status: "deleted", deletedAt: new Date().toISOString(), restoreUntil: new Date(Date.now() + 29 * 864e5).toISOString() });
    signedInAs("superadmin");
    fb.handlers["POST /admin/reviews/rv1/restore"] = () => [200, { message: "Review restored.", review: review({ status: "approved" }) }];
    const user = userEvent.setup();
    renderApp("/admin/reviews/rv1");
    await user.click(await screen.findByRole("button", { name: "Restore" }));
    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("Reason"), "deleted_by_mistake");
    await user.click(within(dialog).getByRole("button", { name: "Restore" }));
    expect(await screen.findByText("Review restored.")).toBeInTheDocument();
    expect(last("POST /admin/reviews/rv1/restore")?.body).toEqual({ reason: "deleted_by_mistake" });
  });
});
