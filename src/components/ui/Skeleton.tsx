import { cn } from "@/lib/cn";

// Skeleton loaders: the shape of what's coming instead of a blank screen or a
// lone spinner. Each loader is one role="status" with a screen-reader label;
// the shimmer (transform only) runs only when motion is welcome.

/** One resting block. Size it with classes. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" data-skeleton="" className={cn("motion-skeleton block rounded-md bg-line-subtle", className)} />;
}

/** Rows of a list or table (and a sensible stand-in for most loading screens). */
export function ListSkeleton({ label = "Loading…", rows = 5, className }: { label?: string; rows?: number; className?: string }) {
  return (
    <div role="status" className={cn("flex flex-col gap-3 py-2", className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} aria-hidden="true" className="flex items-center gap-3 rounded-lg border border-line-subtle bg-surface-card p-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className={cn("h-3", i % 2 ? "w-1/2" : "w-2/5")} />
            <Skeleton className={cn("h-3", i % 2 ? "w-3/4" : "w-3/5")} />
          </div>
          <Skeleton className="h-3 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Dashboard: four KPI tiles and two panels. */
export function DashboardSkeleton({ label = "Loading dashboard…" }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col gap-5">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex min-h-32 flex-col justify-between gap-2 rounded-lg border border-line-card bg-surface-card p-4">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.95fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 rounded-2xl border border-line-card bg-surface-card p-5 lg:p-6">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
        <div className="flex flex-col gap-4 rounded-2xl bg-surface-pale p-5 lg:p-6">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-4/5" />
          ))}
        </div>
      </div>
    </div>
  );
}
