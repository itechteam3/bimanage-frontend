import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { TourState } from "./tours";

// Guided-tour progress (backend PR #113): GET/PUT/DELETE /api/tours.
const KEY = ["tours"] as const;

export function useTourState(enabled = true) {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await api<{ tours: TourState }>("/tours")).tours ?? {},
    enabled,
    staleTime: Infinity,
    retry: false,
  });
}

/** Save a page's tour as completed or skipped (kept locally even if the save fails). */
export function useSaveTour() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, version }: { id: string; status: "completed" | "skipped"; version: number }) => api(`/tours/${encodeURIComponent(id)}`, { method: "PUT", body: { status, version } }),
    onMutate: ({ id, status, version }) => {
      qc.setQueryData<TourState>(KEY, (s) => ({ ...(s ?? {}), [id]: { status, version, at: new Date().toISOString() } }));
    },
  });
}

/** Show every tour again. */
export function useResetTours() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api("/tours", { method: "DELETE" }),
    onSuccess: () => qc.setQueryData<TourState>(KEY, {}),
  });
}
