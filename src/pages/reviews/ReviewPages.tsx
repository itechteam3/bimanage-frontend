import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconCircleCheck, IconMessageCircle, IconRosetteDiscountCheck, IconStar, IconStarFilled } from "@tabler/icons-react";
import { Button, ButtonLink, Dialog, EmptyState, Field, SelectInput, Spinner, Status, TextArea, TextInput } from "@/components/ui";
import { DetailRows, InfoStrip, IntroCard, PageTitle, Panel, TipList } from "@/components/page/Blocks";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { applyFieldErrors } from "@/lib/api/errorMessage";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLeaveGuard } from "@/lib/nav/useLeaveGuard";
import { useUrlState } from "@/lib/nav/useUrlState";
import { useBusinessProfile } from "@/lib/workspace/api";
import { count, shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  REVIEW_CATEGORIES,
  REVIEW_FEATURES,
  useDeleteReview,
  useMyReview,
  usePublicReviews,
  useSaveReview,
  type MyReview,
  type PublicReview,
  type ReviewCategory,
  type ReviewSort,
  type ReviewStats,
} from "@/lib/reviews/api";

// Public reviews (Figma 12.15 public page, 12.16 write, 12.18 submitted).

const Loading = ({ label = "Loading…" }: { label?: string }) => (
  <div className="flex justify-center py-16 text-ink-brand" role="status">
    <Spinner className="size-8" />
    <span className="sr-only">{label}</span>
  </div>
);

const WRITE = "/reviews/write";

/** Five stars, read as "4 out of 5 stars". */
function Stars({ rating, className }: { rating: number; className?: string }) {
  const r = Math.round(rating);
  return (
    <span role="img" aria-label={`${r} out of 5 stars`} className={cn("flex gap-0.5 text-warning", className)}>
      {[1, 2, 3, 4, 5].map((n) => (n <= r ? <IconStarFilled key={n} aria-hidden="true" className="size-4" /> : <IconStar key={n} aria-hidden="true" className="size-4 text-ink-disabled" />))}
    </span>
  );
}

// ── 12.15 Public reviews ─────────────────────────────────────────────────

const RATINGS = ["all", "5", "4", "3", "2", "1"] as const;
const SORTS: Array<[ReviewSort, string]> = [
  ["recent", "Most recent"],
  ["highest", "Highest rated"],
  ["lowest", "Lowest rated"],
];

function RatingCard({ stats }: { stats: ReviewStats }) {
  const total = stats.totalReviews ?? 0;
  const avg = stats.averageRating ?? 0;
  const counts = [5, 4, 3, 2, 1].map((n) => [n, stats.ratingBreakdown?.[String(n) as "5"] ?? 0] as const);
  const max = Math.max(1, ...counts.map(([, c]) => c));
  return (
    <Panel title="Community rating">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:gap-10">
        <div>
          <p className="text-title-lg text-ink-brand" data-testid="average-rating">
            {total > 0 ? `${avg.toFixed(1)} / 5` : "— / 5"}
          </p>
          {total > 0 ? (
            <>
              <Stars rating={avg} className="mt-1" />
              <p className="mt-1 text-body-sm text-ink-muted">
                From {count(total)} published review{total === 1 ? "" : "s"}
              </p>
            </>
          ) : (
            <p className="mt-1 text-body-sm text-ink-muted">No published ratings yet</p>
          )}
        </div>
        <ul className="flex flex-1 flex-col gap-2" aria-label="Rating breakdown">
          {counts.map(([n, c]) => (
            <li key={n} className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-3 text-body-sm">
              <span className="text-ink-strong" aria-hidden="true">
                {n}★
              </span>
              <span className="h-2 overflow-hidden rounded-full bg-surface-tonal" aria-hidden="true">
                <span className="block h-full rounded-full bg-brand-navy" style={{ width: `${Math.round((c / max) * 100)}%` }} />
              </span>
              <span className="text-right text-ink-muted" aria-hidden="true">
                {count(c)}
              </span>
              <span className="sr-only">
                {n} star{n === 1 ? "" : "s"}: {count(c)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

function ReviewItem({ r }: { r: PublicReview }) {
  return (
    <li className="flex flex-col gap-2 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-ink-strong">{r.headline}</h3>
        <Stars rating={r.rating} />
      </div>
      <p className="whitespace-pre-line break-words text-body-sm text-ink-secondary">{r.review}</p>
      <p className="flex flex-wrap items-center gap-2 text-caption text-ink-muted">
        <span className="font-semibold text-ink-strong">{r.businessName || r.reviewer?.name || "BiManage business"}</span>
        {r.isVerified && (
          <Status tone="success">
            <IconRosetteDiscountCheck aria-hidden="true" className="size-4" /> Verified business
          </Status>
        )}
        <span>{shortDate(r.createdAt)}</span>
        {r.edited && <span>· Edited</span>}
      </p>
    </li>
  );
}

export function PublicReviewsPage() {
  const { status } = useAuth();
  const signedOut = status === "anonymous";
  const [q, setQ] = useUrlState<string>("q", "");
  const [rating, setRating] = useUrlState<(typeof RATINGS)[number]>("rating", "all", RATINGS);
  const [sort, setSort] = useUrlState<ReviewSort>("sort", "recent", SORTS.map(([k]) => k));
  const [pageKey, setPageKey] = useUrlState<string>("page", "1");
  const page = Math.max(1, Number(pageKey) || 1);
  const [text, setText] = useState(q);
  const reviews = usePublicReviews({ q, rating: rating === "all" ? "" : rating, sort, page });

  useEffect(() => {
    const term = text.trim();
    if (term === q) return;
    const t = setTimeout(() => {
      setQ(term);
      setPageKey("1");
    }, 300);
    return () => clearTimeout(t);
  }, [text, q, setQ, setPageKey]);
  useEffect(() => {
    setText((cur) => (cur.trim() === q ? cur : q));
  }, [q]);

  const data = reviews.data;
  const filtered = Boolean(q) || rating !== "all";
  const cta = signedOut ? (
    <ButtonLink to={`/login?next=${encodeURIComponent(WRITE)}`}>Sign in to write a review</ButtonLink>
  ) : (
    <ButtonLink to={WRITE}>Write a review</ButtonLink>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageTitle actions={cta}>Reviews</PageTitle>
      <IntroCard eyebrow="Real businesses. Real feedback." title="A better business platform is built together.">
        Read what businesses say about BiManage, and share your own experience.
      </IntroCard>
      <ul className="flex flex-wrap gap-2" aria-label="About these reviews">
        {["Verified reviews", "Public reading", "Editable by author"].map((t) => (
          <li key={t} className="rounded-full bg-surface-tint-blue px-3 py-1 text-body-sm font-semibold text-ink-brand">
            {t}
          </li>
        ))}
      </ul>
      {reviews.isLoading ? (
        <Loading label="Loading reviews…" />
      ) : reviews.error || !data ? (
        <ErrorNote error={reviews.error} fallback="We couldn't load the reviews. Please try again." onRetry={() => void reviews.refetch()} />
      ) : (
        <>
          <RatingCard stats={data.stats} />
          <Panel title="Discover reviews">
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <Field label="Search reviews">
                  <TextInput type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search by keyword" />
                </Field>
                <Field label="Rating">
                  <SelectInput
                    value={rating}
                    onChange={(e) => {
                      setRating(e.target.value as (typeof RATINGS)[number]);
                      setPageKey("1");
                    }}
                  >
                    <option value="all">All stars</option>
                    {RATINGS.slice(1).map((n) => (
                      <option key={n} value={n}>
                        {n} star{n === "1" ? "" : "s"}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Sort by">
                  <SelectInput
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value as ReviewSort);
                      setPageKey("1");
                    }}
                  >
                    {SORTS.map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              </div>
              {!data.reviews.length ? (
                <EmptyState
                  className="border-0 p-0"
                  icon={<IconMessageCircle className="size-7" />}
                  title={filtered ? "No reviews match your search." : "No reviews are published yet."}
                  body={filtered ? "Try other words or another rating." : "Be one of the first businesses to share your experience."}
                  action={filtered ? undefined : cta}
                />
              ) : (
                <>
                  <ul className="flex flex-col divide-y divide-line-subtle">
                    {data.reviews.map((r) => (
                      <ReviewItem key={r._id} r={r} />
                    ))}
                  </ul>
                  {data.totalPages > 1 && (
                    <div className="flex items-center justify-between">
                      <Button size="md" variant="outlined" disabled={page <= 1} onClick={() => setPageKey(String(page - 1))}>
                        Previous
                      </Button>
                      <span className="text-body-sm text-ink-muted">
                        Page {page} of {data.totalPages}
                      </span>
                      <Button size="md" variant="outlined" disabled={page >= data.totalPages} onClick={() => setPageKey(String(page + 1))}>
                        Next
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

// ── 12.16 Write a review ─────────────────────────────────────────────────

const reviewSchema = z.object({
  headline: z.string().trim().min(3, "Write a headline (at least 3 characters).").max(120, "Keep the headline under 120 characters."),
  rating: z.number({ invalid_type_error: "Choose a star rating." }).int().min(1, "Choose a star rating.").max(5, "Choose a star rating."),
  category: z.enum(["product_experience", "ease_of_use", "features", "support", "value", "general"]),
  review: z.string().trim().min(10, "Write your review (at least 10 characters).").max(1000, "Keep your review under 1,000 characters."),
  featuresUsed: z.array(z.string()),
});
type ReviewForm = z.infer<typeof reviewSchema>;

export function WriteReviewPage() {
  const mine = useMyReview();
  if (mine.isLoading) return <Loading label="Loading your review…" />;
  if (mine.error || !mine.data) return <ErrorNote error={mine.error} fallback="We couldn't load your review. Please try again." onRetry={() => void mine.refetch()} />;
  const { review, eligibility } = mine.data;
  if (!eligibility?.ok) {
    const [first, ...rest] = eligibility?.reasons?.length ? eligibility.reasons : ["Your account can't write a review yet."];
    return (
      <div className="flex flex-col gap-6">
        <PageTitle>Write a review</PageTitle>
        <EmptyState
          className="max-w-xl"
          icon={<IconMessageCircle className="size-7" />}
          title={first!}
          body={
            rest.length ? (
              <ul className="flex list-disc flex-col gap-1 pl-5">
                {rest.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : undefined
          }
          action={
            <ButtonLink to="/reviews" size="md" variant="outlined">
              Back to reviews
            </ButtonLink>
          }
        />
      </div>
    );
  }
  return <ReviewEditor existing={review} />;
}

function ReviewEditor({ existing }: { existing: MyReview | null }) {
  const navigate = useNavigate();
  const profile = useBusinessProfile();
  const save = useSaveReview();
  const remove = useDeleteReview();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);
  const { register, handleSubmit, setError, setValue, watch, formState } = useForm<ReviewForm>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      headline: existing?.headline ?? "",
      rating: existing?.rating ?? 0,
      category: existing?.category ?? "product_experience",
      review: existing?.review ?? "",
      featuresUsed: existing?.featuresUsed ?? [],
    },
  });
  const guard = useLeaveGuard(formState.isDirty && !formState.isSubmitSuccessful);
  const rating = Number(watch("rating")) || 0;
  const e = formState.errors;

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    try {
      await save.mutateAsync({ headline: v.headline, rating: v.rating, review: v.review, category: v.category as ReviewCategory, featuresUsed: v.featuresUsed });
      guard.allow();
      navigate("/reviews/submitted");
    } catch (err) {
      if (!applyFieldErrors(err, setError, ["headline", "rating", "review", "category", "featuresUsed"])) setFormError(err);
    }
  });

  const deleteReview = () =>
    remove.mutate(undefined, {
      onSuccess: () => {
        guard.allow();
        navigate("/reviews");
      },
      onSettled: () => setConfirmDelete(false),
    });

  return (
    <div className="flex flex-col gap-6">
      {guard.dialog}
      <PageTitle>{existing ? "Edit your review" : "Write a review"}</PageTitle>
      <IntroCard eyebrow="Reviews / Your feedback" title="Share how BiManage works for your business.">
        One review per verified account. You can edit it at any time.
      </IntroCard>
      {existing && existing.isPublished === false && (
        <InfoStrip tone="warm" title="Your review is hidden from the public page">
          {existing.hiddenReason ? `${existing.hiddenReason} ` : ""}Editing publishes it again.
        </InfoStrip>
      )}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
          <Panel title="Your review" subtitle="Fields marked * are required.">
            <div className="grid gap-4 md:grid-cols-2 md:gap-x-10 md:gap-y-6">
              <Field label="Review headline" required error={e.headline?.message} className="md:col-span-2">
                <TextInput maxLength={120} placeholder="For example: Orders and stock in one place" {...register("headline")} />
              </Field>
              <fieldset className="flex flex-col gap-2 rounded-sm bg-surface-pale px-4 py-2.5 lg:bg-transparent lg:p-0" aria-describedby={e.rating ? "rating-error" : undefined}>
                <legend className="text-field-label uppercase text-ink-brand lg:text-ink-secondary">
                  Star rating<span aria-hidden="true"> *</span>
                </legend>
                <div role="radiogroup" aria-label="Star rating" className="mt-2 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label key={n} className="cursor-pointer rounded-sm p-1 focus-within:shadow-focus">
                      <input
                        type="radio"
                        name="rating"
                        value={n}
                        checked={rating === n}
                        onChange={() => setValue("rating", n, { shouldDirty: true, shouldValidate: true })}
                        className="sr-only"
                        aria-label={`${n} star${n === 1 ? "" : "s"}`}
                      />
                      {n <= rating ? <IconStarFilled aria-hidden="true" className="size-8 text-warning" /> : <IconStar aria-hidden="true" className="size-8 text-ink-disabled" />}
                    </label>
                  ))}
                </div>
                {e.rating && (
                  <p id="rating-error" role="alert" className="text-body-lg text-danger">
                    {e.rating.message}
                  </p>
                )}
              </fieldset>
              <Field label="Review type" error={e.category?.message}>
                <SelectInput {...register("category")}>
                  {REVIEW_CATEGORIES.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Verified business" hint="Shown with your review." className="md:col-span-2">
                <TextInput readOnly value={profile.data?.businessName ?? existing?.businessName ?? ""} placeholder={profile.isLoading ? "Loading…" : "Your business"} />
              </Field>
              <Field label="Your review" required error={e.review?.message} className="md:col-span-2">
                <TextArea rows={6} maxLength={1000} placeholder="What has BiManage changed for your business?" {...register("review")} />
              </Field>
              <fieldset className="flex flex-col gap-2 rounded-sm bg-surface-pale px-4 py-2.5 md:col-span-2 lg:bg-transparent lg:p-0">
                <legend className="text-field-label uppercase text-ink-brand lg:text-ink-secondary">Features used</legend>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  {REVIEW_FEATURES.map(([k, l]) => (
                    <label key={k} className="flex min-h-11 items-center gap-2 text-body-lg text-ink-strong">
                      <input type="checkbox" value={k} className="size-5 accent-brand-navy" {...register("featuresUsed")} />
                      {l}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </Panel>
          <ErrorNote error={formError} fallback="We couldn't save your review. Please try again." />
          <div className="flex flex-col gap-3 md:flex-row md:justify-end">
            {existing && (
              <Button type="button" variant="outlined" onClick={() => setConfirmDelete(true)}>
                Delete my review
              </Button>
            )}
            <Button type="submit" className="md:px-10" loading={save.isPending} loadingText="Saving…">
              {existing ? "Save review" : "Submit review"}
            </Button>
          </div>
          <ErrorNote error={remove.error} fallback="We couldn't delete your review. Please try again." />
        </form>
        <TipList
          title="Review guidelines"
          tips={[
            { title: "Be specific", body: "Say which features helped and how." },
            { title: "Keep it honest", body: "Reviews come from verified business accounts." },
            { title: "Edit any time", body: "Your latest version is the one people see." },
          ]}
        />
      </div>
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        tone="danger"
        title="Delete your review?"
        description="It disappears from the public page. You can write a new one later."
        actions={
          <>
            <Button variant="outlined" onClick={() => setConfirmDelete(false)}>
              Keep my review
            </Button>
            <Button variant="destructive" loading={remove.isPending} onClick={deleteReview}>
              Delete review
            </Button>
          </>
        }
      />
    </div>
  );
}

// ── 12.18 Review submitted ───────────────────────────────────────────────

export function ReviewSubmittedPage() {
  const mine = useMyReview();
  if (mine.isLoading) return <Loading label="Loading your review…" />;
  if (mine.error) return <ErrorNote error={mine.error} fallback="We couldn't load your review. Please try again." onRetry={() => void mine.refetch()} />;
  const r = mine.data?.review;
  if (!r)
    return (
      <EmptyState
        className="max-w-xl"
        icon={<IconMessageCircle className="size-7" />}
        title="No review yet"
        body="Share how BiManage works for your business."
        action={
          <ButtonLink to={WRITE} size="md">
            Write a review
          </ButtonLink>
        }
      />
    );
  const rows: Array<[string, ReactNode]> = [
    ["Rating", `${r.rating} / 5 stars`],
    ["Reviewer", "Verified business account"],
    ["Review policy", "One review per verified account"],
    ["After submission", r.isPublished === false ? "Hidden until it meets the review policy" : "Public reviews display your feedback"],
  ];
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Review submitted</PageTitle>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel title="Thank you for sharing your experience" subtitle={r.headline}>
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3 rounded-xl bg-success-bg px-4 py-4 text-success">
              <IconCircleCheck aria-hidden="true" className="size-6 shrink-0" />
              <p className="text-body-lg font-semibold">Your review is saved</p>
            </div>
            <DetailRows rows={rows} />
            <div className="flex flex-col gap-3 md:flex-row">
              <ButtonLink to="/reviews" fullWidth>
                View public reviews
              </ButtonLink>
              <ButtonLink to={WRITE} variant="outlined" fullWidth>
                Edit my review
              </ButtonLink>
            </div>
          </div>
        </Panel>
        <TipList
          title="Good to know"
          tips={[
            { title: "Edit any time", body: "Changes show as Edited on the public page." },
            { title: "Help other businesses", body: "Your experience helps others choose with confidence." },
          ]}
        />
      </div>
    </div>
  );
}
