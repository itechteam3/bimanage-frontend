import { Button } from "@/components/ui";

/** "Showing 30 of 412 · Load more" under a long list (nothing is ever cut off). */
export function LoadMore({ shown, total, onMore, loading, noun = "items" }: { shown: number; total: number; onMore: () => void; loading?: boolean; noun?: string }) {
  if (total <= 0) return null;
  const more = shown < total;
  return (
    <div className="mt-4 flex flex-col items-center gap-2 md:flex-row md:justify-between">
      <p className="text-body-sm text-ink-muted" aria-live="polite">
        Showing {shown.toLocaleString("en-NG")} of {total.toLocaleString("en-NG")} {noun}
      </p>
      {more && (
        <Button variant="secondary" size="md" onClick={onMore} loading={loading} loadingText="Loading…" className="w-full md:w-auto">
          Load more
        </Button>
      )}
    </div>
  );
}
