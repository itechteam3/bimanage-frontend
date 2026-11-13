import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

// Public reviews (Figma 12.15, 12.16, 12.18). Every query key starts with "reviews".

export type ReviewCategory = "product_experience" | "ease_of_use" | "features" | "support" | "value" | "general";
export type ReviewSort = "recent" | "highest" | "lowest";

export interface PublicReview {
  _id: string;
  headline: string;
  rating: number;
  review: string;
  category?: ReviewCategory;
  featuresUsed?: string[];
  businessName?: string | null;
  reviewer?: { name?: string; avatar?: string | null } | null;
  isVerified?: boolean;
  edited?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  ratingBreakdown: Partial<Record<"1" | "2" | "3" | "4" | "5", number>>;
}

export interface ReviewList {
  reviews: PublicReview[];
  total: number;
  page: number;
  totalPages: number;
  stats: ReviewStats;
}

export interface MyReview extends PublicReview {
  isPublished?: boolean;
  hiddenReason?: string | null;
}

export interface MyReviewResponse {
  review: MyReview | null;
  eligibility: { ok: boolean; reasons: string[] };
}

export interface ReviewInput {
  headline: string;
  rating: number;
  review: string;
  category: ReviewCategory;
  featuresUsed: string[];
}

export const REVIEW_CATEGORIES: Array<[ReviewCategory, string]> = [
  ["product_experience", "Product experience"],
  ["ease_of_use", "Ease of use"],
  ["features", "Features"],
  ["support", "Support"],
  ["value", "Value for money"],
  ["general", "General"],
];

export const REVIEW_FEATURES: Array<[string, string]> = [
  ["inventory", "Inventory"],
  ["orders", "Orders and sales"],
  ["store", "Online store"],
  ["invoices", "Invoices"],
  ["projects", "Projects and tasks"],
  ["wallet", "Wallet"],
  ["bisupplynet", "BiSupplyNet"],
  ["feli", "FELI assistant"],
  ["team", "Team"],
];

export const reviewKeys = {
  all: ["reviews"] as const,
  list: (q: string, rating: string, sort: string, page: number) => ["reviews", "list", q, rating, sort, page] as const,
  mine: ["reviews", "mine"] as const,
};

/** Public: works signed out. */
export const usePublicReviews = ({ q = "", rating = "", sort = "recent", page = 1 }: { q?: string; rating?: string; sort?: ReviewSort; page?: number }) =>
  useQuery({
    queryKey: reviewKeys.list(q, rating, sort, page),
    queryFn: () => api<ReviewList>("/reviews", { query: { q: q || undefined, rating: rating || undefined, sort, page }, auth: false }),
    placeholderData: keepPreviousData,
  });

export const useMyReview = (enabled = true) => useQuery({ queryKey: reviewKeys.mine, queryFn: () => api<MyReviewResponse>("/reviews/my-review"), enabled });

export function useSaveReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ReviewInput) => api<{ message?: string; review?: MyReview }>("/reviews", { method: "POST", body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: reviewKeys.all }),
  });
}

export function useDeleteReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ message?: string }>("/reviews", { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: reviewKeys.all }),
  });
}
