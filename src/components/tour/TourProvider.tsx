import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { place, resolveTarget, shouldAutoStart, tourFor, type Placement, type Tour, type TourStep } from "@/lib/tours/tours";
import { useResetTours, useSaveTour, useTourState } from "@/lib/tours/api";
import "./tour.css";

// Guided tours (coach marks) for signed-in pages. The first time someone opens
// a page that has a tour, small pop-ups point at each key feature, one by one.
// Finished or skipped tours are saved on the server per person, per page.
// "Show me around" in the help menu replays the current page's tour.

interface TourApi {
  /** The current page's tour, if it has one. */
  current?: Tour;
  /** Replay the current page's tour. */
  start: () => void;
  /** Show every tour again (and start this page's). */
  resetAll: () => Promise<void>;
  active: boolean;
}

const TourContext = createContext<TourApi>({ start: () => undefined, resetAll: async () => undefined, active: false });
export const useTour = () => useContext(TourContext);

const reducedMotion = () =>
  (typeof document !== "undefined" && document.documentElement.classList.contains("reduce-motion")) ||
  (typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

/** Wait for the page to render its targets (data loads first), then resolve the steps. */
function waitForSteps(tour: Tour, signal: { cancelled: boolean }, maxMs = 4000): Promise<TourStep[]> {
  const targeted = tour.steps.filter((s) => s.target);
  const found = () => tour.steps.filter((s) => !s.target || resolveTarget(s.target));
  return new Promise((resolve) => {
    const t0 = Date.now();
    let last = -1;
    const tick = () => {
      if (signal.cancelled) return resolve([]);
      const steps = found();
      const n = steps.length - (tour.steps.length - targeted.length);
      // Settled: every target is there, or the count stopped changing after a while.
      if (n === targeted.length || (n === last && Date.now() - t0 > 900) || Date.now() - t0 > maxMs) return resolve(steps);
      last = n;
      setTimeout(tick, 300);
    };
    tick();
  });
}

export function TourProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const { pathname } = useLocation();
  const state = useTourState(enabled);
  const save = useSaveTour();
  const reset = useResetTours();
  const current = useMemo(() => tourFor(pathname), [pathname]);
  const [run, setRun] = useState<{ tour: Tour; steps: TourStep[] } | null>(null);
  const autoTried = useRef<string | null>(null);

  // A page change ends a running tour without saving it (it comes back next visit).
  useEffect(() => setRun((r) => (r && !r.tour.paths.includes(pathname.replace(/\/+$/, "")) ? null : r)), [pathname]);

  /** The steps whose targets are on the page, or null when the page didn't render (error, empty). */
  const prepare = useCallback(async (tour: Tour, signal: { cancelled: boolean }) => {
    const steps = await waitForSteps(tour, signal);
    if (signal.cancelled || !steps.some((s) => s.target && !s.target.selector?.includes("data-tour"))) return null;
    return steps;
  }, []);
  const begin = useCallback(
    async (tour: Tour) => {
      const steps = await prepare(tour, { cancelled: false });
      if (steps) setRun({ tour, steps });
    },
    [prepare]
  );

  // First visit: start by itself once progress has loaded (once per page visit).
  useEffect(() => {
    autoTried.current = null;
  }, [pathname]);
  useEffect(() => {
    if (!enabled || !current || !state.isSuccess || run) return;
    if (autoTried.current === pathname || !shouldAutoStart(current, state.data)) return;
    autoTried.current = pathname;
    const signal = { cancelled: false };
    let settled = false;
    const t = setTimeout(() => {
      // Never on top of an open dialog.
      if (document.querySelector("dialog[open]")) return void (settled = true);
      void prepare(current, signal).then((steps) => {
        settled = true;
        if (steps) setRun({ tour: current, steps });
      });
    }, 500);
    return () => {
      if (settled) return;
      signal.cancelled = true;
      clearTimeout(t);
      autoTried.current = null; // interrupted before it could start: try again
    };
  }, [enabled, current, state.isSuccess, state.data, pathname, run, prepare]);

  const finish = useCallback(
    (status: "completed" | "skipped") => {
      if (run) save.mutate({ id: run.tour.id, status, version: run.tour.version });
      setRun(null);
    },
    [run, save]
  );

  const api = useMemo<TourApi>(
    () => ({
      current,
      active: Boolean(run),
      start: () => {
        if (current) void begin(current);
      },
      resetAll: async () => {
        await reset.mutateAsync().catch(() => undefined);
        if (current) void begin(current);
      },
    }),
    [current, run, begin, reset]
  );

  return (
    <TourContext.Provider value={api}>
      {children}
      {run && <CoachMarks key={run.tour.id} tour={run.tour} steps={run.steps} onDone={() => finish("completed")} onSkip={() => finish("skipped")} />}
    </TourContext.Provider>
  );
}

type Rect = { top: number; left: number; width: number; height: number };
const PAD = 6;

export function CoachMarks({ tour, steps, onDone, onSkip }: { tour: Tour; steps: TourStep[]; onDone: () => void; onSkip: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [placement, setPlacement] = useState<Placement>({ mode: "center" });
  const pop = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const step = steps[i]!;
  const last = i === steps.length - 1;
  const returnFocus = useRef<Element | null>(typeof document !== "undefined" ? document.activeElement : null);

  // Restore focus when the tour closes.
  useEffect(() => () => (returnFocus.current as HTMLElement | null)?.focus?.(), []);

  // Find this step's target, bring it into view, and keep the highlight on it.
  useLayoutEffect(() => {
    const el = step.target ? resolveTarget(step.target) : null;
    if (el) el.scrollIntoView?.({ block: "center", inline: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
    const measure = () => {
      const r = el?.getBoundingClientRect();
      const next = r && r.width + r.height > 0 ? { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 } : null;
      setRect(next);
      const p = pop.current?.getBoundingClientRect();
      setPlacement(place(next, { width: p?.width || 340, height: p?.height || 200 }, window.innerWidth, window.innerHeight));
    };
    measure();
    const t = setTimeout(measure, 350); // after smooth scrolling
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step]);

  // Focus the pop-up on every step so screen readers read it.
  useEffect(() => {
    pop.current?.focus({ preventScroll: true });
  }, [i]);

  const next = () => (last ? onDone() : setI(i + 1));
  const back = () => i > 0 && setI(i - 1);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onSkip();
    } else if (e.key === "ArrowRight") next();
    else if (e.key === "ArrowLeft") back();
    else if (e.key === "Tab") {
      // Keep keyboard focus inside the pop-up while the tour is open.
      const f = [...(pop.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])].filter((b) => !b.disabled);
      if (!f.length) return;
      const first = f[0]!;
      const end = f[f.length - 1]!;
      if (e.shiftKey && (document.activeElement === first || document.activeElement === pop.current)) {
        e.preventDefault();
        end.focus();
      } else if (!e.shiftKey && document.activeElement === end) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const style: React.CSSProperties =
    placement.mode === "float" ? { top: placement.top, left: placement.left } : {};

  return createPortal(
    <div className="tour-root" data-tour-root>
      {/* Blocks clicks on the page while the tour is open; the spotlight dims everything but the target. */}
      <div className={cn("tour-shield", !rect && "tour-shield-dim")} aria-hidden="true" />
      {rect && (
        <div
          aria-hidden="true"
          className="tour-spot"
          style={{ transform: `translate(${rect.left}px, ${rect.top}px)`, width: rect.width, height: rect.height }}
        />
      )}
      <div
        ref={pop}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        key={i}
        style={style}
        className={cn(
          "tour-pop",
          placement.mode === "center" && "tour-pop-center",
          placement.mode === "sheet" && (placement.edge === "top" ? "tour-pop-sheet tour-pop-sheet-top" : "tour-pop-sheet"),
          placement.mode === "float" && (placement.side === "top" ? "tour-pop-float tour-pop-above" : "tour-pop-float")
        )}
      >
        {placement.mode === "float" && <span aria-hidden="true" className="tour-arrow" style={{ left: placement.arrowX }} />}
        <div className="flex items-center justify-between gap-3">
          <p className="text-caption font-semibold uppercase text-ink-brand">
            <span aria-hidden="true">
              {i + 1}/{steps.length}
            </span>
            <span className="sr-only">
              {tour.name} tour, step {i + 1} of {steps.length}
            </span>
          </p>
          <button type="button" onClick={onSkip} aria-label="Close tour" className="-mr-2 flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-surface-pale">
            <IconX aria-hidden="true" className="size-icon" />
          </button>
        </div>
        <h2 id={titleId} className="text-title-sm text-ink-strong">
          {step.title}
        </h2>
        <p id={bodyId} className="mt-1 text-body-sm text-ink-muted">
          {step.body}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3">
          {!last ? (
            <button type="button" onClick={onSkip} className="min-h-11 text-body-sm font-semibold text-ink-muted underline-offset-4 hover:underline">
              Skip tour
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            {i > 0 && (
              <Button variant="outlined" size="md" onClick={back}>
                Back
              </Button>
            )}
            <Button size="md" onClick={next}>
              {last ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
