import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { resetHistory } from "@/lib/nav/history";
import { installFakeBackend, type FakeBackend } from "@/test/fakeBackend";
import { PublicReviewsPage, ReviewSubmittedPage, WriteReviewPage } from "@/pages/reviews";

// Public reviews (12.15, 12.16, 12.18). Routes are registered in App.tsx
// separately, so these tests mount just the review pages.

const routes = [
  { path: "/reviews", element: <PublicReviewsPage /> },
  { path: "/reviews/write", element: <WriteReviewPage /> },
  { path: "/reviews/submitted", element: <ReviewSubmittedPage /> },
];

function renderPages(path: string) {
  resetHistory();
  const [pathname, search] = path.split("?");
  const router = createMemoryRouter(routes, { initialEntries: [{ pathname: pathname!, search: search ? `?${search}` : "" }] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
  return router;
}

const REVIEW = {
  _id: "r1",
  headline: "Orders and stock in one place",
  rating: 5,
  review: "We stopped using spreadsheets for stock.",
  category: "product_experience",
  featuresUsed: ["inventory"],
  businessName: "Dior Factory LTD.",
  reviewer: { name: "Samuel Adebayo", avatar: null },
  isVerified: true,
  edited: true,
  createdAt: "2026-11-10T10:00:00Z",
  updatedAt: "2026-11-11T10:00:00Z",
};
const STATS = { averageRating: 4.3, totalReviews: 10, ratingBreakdown: { 5: 6, 4: 2, 3: 1, 2: 1, 1: 0 } };
const EMPTY = { reviews: [], total: 0, page: 1, totalPages: 0, stats: { averageRating: 0, totalReviews: 0, ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } } };

let fb: FakeBackend;
beforeEach(() => {
  tokenStore.set("tok");
  serverStatus.set("up");
  fb = installFakeBackend();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  tokenStore.clear();
});
const last = (key: string) => [...fb.calls].reverse().find((c) => c.key === key);

describe("12.15 public reviews", () => {
  it("shows the average, the star breakdown and verified reviews", async () => {
    const urls: URL[] = [];
    fb.handlers["GET /reviews"] = (_b, _h, url) => (urls.push(url), [200, { reviews: [REVIEW], total: 1, page: 1, totalPages: 1, stats: STATS }]);
    const user = userEvent.setup();
    renderPages("/reviews");
    expect(await screen.findByTestId("average-rating")).toHaveTextContent("4.3 / 5");
    const breakdown = screen.getByRole("list", { name: "Rating breakdown" });
    expect(within(breakdown).getByText("5 stars: 6")).toBeInTheDocument();
    expect(within(breakdown).getByText("1 star: 0")).toBeInTheDocument();
    expect(screen.getByText("Orders and stock in one place")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "5 out of 5 stars" })).toBeInTheDocument();
    expect(screen.getByText("Verified business")).toBeInTheDocument();
    expect(screen.getByText("· Edited")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Write a review" })).toHaveAttribute("href", "/reviews/write");
    // public: the list never sends the session token
    expect(last("GET /reviews")?.headers.Authorization).toBeUndefined();

    await user.selectOptions(screen.getByLabelText("Rating"), "4");
    await waitFor(() => expect(urls.at(-1)?.searchParams.get("rating")).toBe("4"));
    await user.type(screen.getByLabelText("Search reviews"), "stock");
    await waitFor(() => expect(urls.at(-1)?.searchParams.get("q")).toBe("stock"));
  });

  it("signed out with nothing published: empty state and a sign-in link", async () => {
    tokenStore.clear();
    fb.handlers["GET /reviews"] = () => [200, EMPTY];
    renderPages("/reviews");
    expect(await screen.findByText("No reviews are published yet.")).toBeInTheDocument();
    expect(screen.getByTestId("average-rating")).toHaveTextContent("— / 5");
    expect(screen.getByText("No published ratings yet")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Sign in to write a review" })[0]).toHaveAttribute("href", "/login?next=%2Freviews%2Fwrite");
    expect(last("GET /auth/me")).toBeUndefined();
  });
});

describe("12.16 write a review", () => {
  it("not eligible: says why", async () => {
    fb.handlers["GET /reviews/my-review"] = () => [200, { review: null, eligibility: { ok: false, reasons: ["Verify your business before writing a review.", "Use BiManage for at least 7 days."] } }];
    renderPages("/reviews/write");
    expect(await screen.findByText("Verify your business before writing a review.")).toBeInTheDocument();
    expect(screen.getByText("Use BiManage for at least 7 days.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to reviews" })).toHaveAttribute("href", "/reviews");
    expect(screen.queryByRole("button", { name: "Submit review" })).not.toBeInTheDocument();
  });

  it("eligible: posts the review and shows the submitted screen", async () => {
    let mine: Record<string, unknown> = { review: null, eligibility: { ok: true, reasons: [] } };
    fb.handlers["GET /reviews/my-review"] = () => [200, mine];
    fb.handlers["POST /reviews"] = (body) => {
      mine = { review: { ...REVIEW, ...body, isPublished: true }, eligibility: { ok: true, reasons: [] } };
      return [201, { message: "Saved", review: mine.review }];
    };
    const user = userEvent.setup();
    const router = renderPages("/reviews/write");
    expect(await screen.findByRole("heading", { name: "Write a review" })).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Dior Factory LTD.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Submit review" }));
    expect(await screen.findByText("Choose a star rating.")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/review headline/i), "Great for stock");
    await user.click(screen.getByRole("radio", { name: "4 stars" }));
    await user.selectOptions(screen.getByLabelText(/review type/i), "ease_of_use");
    await user.type(screen.getByLabelText(/^your review/i), "Stock counts are finally right.");
    await user.click(screen.getByRole("checkbox", { name: "Inventory" }));
    await user.click(screen.getByRole("checkbox", { name: "Wallet" }));
    await user.click(screen.getByRole("button", { name: "Submit review" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/reviews/submitted"));
    expect(last("POST /reviews")?.body).toEqual({ headline: "Great for stock", rating: 4, review: "Stock counts are finally right.", category: "ease_of_use", featuresUsed: ["inventory", "wallet"] });
    expect(await screen.findByRole("heading", { name: "Review submitted" })).toBeInTheDocument();
    expect(screen.getByText("4 / 5 stars")).toBeInTheDocument();
    expect(screen.getByText("One review per verified account")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View public reviews" })).toHaveAttribute("href", "/reviews");
  });

  it("hidden review: explains why, prefills, and can be deleted", async () => {
    fb.handlers["GET /reviews/my-review"] = () => [200, { review: { ...REVIEW, isPublished: false, hiddenReason: "It included a phone number." }, eligibility: { ok: true, reasons: [] } }];
    fb.handlers["DELETE /reviews"] = () => [200, { message: "Deleted" }];
    fb.handlers["GET /reviews"] = () => [200, EMPTY];
    const user = userEvent.setup();
    const router = renderPages("/reviews/write");
    expect(await screen.findByText(/it included a phone number\. editing publishes it again\./i)).toBeInTheDocument();
    expect(screen.getByLabelText(/review headline/i)).toHaveValue("Orders and stock in one place");
    expect(screen.getByRole("radio", { name: "5 stars" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Inventory" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Delete my review" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete review" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/reviews"));
    expect(last("DELETE /reviews")).toBeTruthy();
  });
});
