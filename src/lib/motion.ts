import { useEffect, useRef, useState, type CSSProperties } from "react";

// The one shared set of animation settings, for JS. The CSS side is the
// --motion-* / --ease-* custom properties generated into src/styles/theme.css
// from docs/figma/design-tokens.json ("motion"); a test keeps the two equal.
// Rules: animations explain what's happening (loading, changing, succeeding),
// mostly 150–300ms ease-out, only transform and opacity, and none at all for
// prefers-reduced-motion or the workspace "Reduce motion" setting
// (html.reduce-motion, see src/lib/account/preferences.tsx).
export const MOTION = {
  /** ms: press, hover, small exits. */
  fast: 150,
  /** ms: most entrances (pages, cards, rows, dialogs). */
  base: 220,
  /** ms: drawers, sheets, chart bars. */
  slow: 300,
  /** ms: KPI count-up. */
  count: 600,
  /** ms between items that appear one after another. */
  stagger: 40,
  /** Never stagger more than this many items (the rest appear with the last). */
  maxStagger: 8,
  /** px: how far things rise as they fade in. */
  distance: 8,
  easeOut: "cubic-bezier(0.2, 0.8, 0.2, 1)",
  easeIn: "cubic-bezier(0.4, 0, 1, 1)",
} as const;

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

/** True when the person asked for less motion (OS setting or the workspace "Reduce motion" preference). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  if (document.documentElement.classList.contains("reduce-motion")) return true;
  return Boolean(window.matchMedia?.(REDUCE_QUERY).matches);
}

// Tests (jsdom) always see final states: no count-up, no exit delays. A test
// that needs to exercise the animated path can switch this on.
let testOverride: boolean | null = null;
/** Tests only: force animations on (true), off (false) or back to the default (null). */
export function setMotionForTests(on: boolean | null) {
  testOverride = on;
}
const isTest = () => testOverride === null && import.meta.env.MODE === "test";

/** Whether JS-driven motion should run right now. */
export function motionAllowed(): boolean {
  if (testOverride === false || isTest()) return false;
  return !prefersReducedMotion();
}

/** Re-renders when either reduced-motion signal changes. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    const update = () => setReduced(prefersReducedMotion());
    const mq = window.matchMedia?.(REDUCE_QUERY);
    mq?.addEventListener?.("change", update);
    const obs = typeof MutationObserver !== "undefined" ? new MutationObserver(update) : null;
    obs?.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    update();
    return () => {
      mq?.removeEventListener?.("change", update);
      obs?.disconnect();
    };
  }, []);
  return reduced;
}

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * The number to show while counting up to `value` (from 0 on first show, then
 * from the previous value). Returns `value` straight away when motion is off.
 */
export function useCountUp(value: number, duration: number = MOTION.count): number {
  const [shown, setShown] = useState(() => (motionAllowed() && Number.isFinite(value) && value !== 0 ? 0 : value));
  const from = useRef(shown);
  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (!motionAllowed() || !Number.isFinite(value) || start === value || typeof requestAnimationFrame !== "function") {
      setShown(value);
      return;
    }
    const whole = Number.isInteger(value) && Number.isInteger(start);
    let raf = 0;
    const t0 = performance.now();
    // performance.now() rather than the frame timestamp: the two can use different clocks.
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / duration);
      const v = start + (value - start) * easeOutCubic(p);
      setShown(p >= 1 ? value : whole ? Math.round(v) : v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return shown;
}

/**
 * Keeps something mounted long enough to animate out. `state` drives CSS
 * (data-state="open" | "closed"); `mounted` is false once the exit is done.
 * With motion off, it unmounts at once.
 */
export function usePresence(open: boolean, exitMs: number = MOTION.base) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (!motionAllowed()) {
      setMounted(false);
      return;
    }
    const t = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(t);
  }, [open, exitMs]);
  return { mounted: open || mounted, state: open ? ("open" as const) : ("closed" as const) };
}

/**
 * A list that lets removed items fade out before they go: returns every
 * current item plus, for `exitMs`, the ones just removed (in their old place,
 * `leaving: true`). With motion off, removed items go at once.
 */
export function usePresenceList<T>(items: readonly T[], keyOf: (item: T) => string, exitMs: number = MOTION.base): Array<{ item: T; key: string; leaving: boolean }> {
  const prev = useRef<Array<{ item: T; key: string }>>([]);
  const [leaving, setLeaving] = useState<Map<string, { item: T; index: number }>>(() => new Map());
  const keys = items.map(keyOf);
  const sig = keys.join("\u0000");

  useEffect(() => {
    const now = new Set(keys);
    const gone = prev.current.map((p, index) => ({ ...p, index })).filter((p) => !now.has(p.key));
    prev.current = items.map((item, i) => ({ item, key: keys[i]! }));
    if (!gone.length || !motionAllowed()) return;
    setLeaving((m) => {
      const next = new Map(m);
      for (const g of gone) next.set(g.key, { item: g.item, index: g.index });
      return next;
    });
    const t = window.setTimeout(() => {
      setLeaving((m) => {
        const next = new Map(m);
        for (const g of gone) next.delete(g.key);
        return next;
      });
    }, exitMs);
    return () => window.clearTimeout(t);
    // `sig` stands for `items`/`keys`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, exitMs]);

  const out: Array<{ item: T; key: string; leaving: boolean }> = items.map((item, i) => ({ item, key: keys[i]!, leaving: false }));
  const present = new Set(keys);
  for (const [key, l] of leaving) {
    if (present.has(key)) continue;
    out.splice(Math.min(l.index, out.length), 0, { item: l.item, key, leaving: true });
  }
  return out;
}

/** Inline style for the n-th item of a staggered group (CSS reads --motion-i). */
export const staggerStyle = (i: number) => ({ "--motion-i": Math.min(i, MOTION.maxStagger) }) as CSSProperties;

/**
 * Page enter: the page fades in and its top-level sections rise one after
 * another. Web Animations only (transform/opacity), nothing left behind when
 * it finishes, and nothing at all when motion is off.
 */
export function playPageEnter(el: HTMLElement) {
  if (!motionAllowed() || typeof el.animate !== "function") return;
  el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MOTION.base, easing: MOTION.easeOut });
  const root = el.firstElementChild;
  if (!root) return;
  Array.from(root.children)
    .slice(0, MOTION.maxStagger)
    .forEach((child, i) => {
      if (!(child instanceof HTMLElement) || child.offsetParent === null) return;
      child.animate(
        [
          { opacity: 0, transform: `translateY(${MOTION.distance}px)` },
          { opacity: 1, transform: "none" },
        ],
        { duration: MOTION.base, delay: i * MOTION.stagger, easing: MOTION.easeOut, fill: "backwards" }
      );
    });
}

const closing = new WeakMap<HTMLDialogElement, number>();
/** Closes a <dialog> after its exit animation (data-closing drives the CSS). */
export function closeDialogWithMotion(el: HTMLDialogElement) {
  if (!motionAllowed()) return el.close();
  if (closing.has(el)) return;
  el.setAttribute("data-closing", "");
  closing.set(
    el,
    window.setTimeout(() => {
      closing.delete(el);
      el.removeAttribute("data-closing");
      el.close();
    }, MOTION.fast)
  );
}
/** Re-opened while still closing: stay open. */
export function cancelDialogClose(el: HTMLDialogElement) {
  const t = closing.get(el);
  if (t === undefined) return false;
  window.clearTimeout(t);
  closing.delete(el);
  el.removeAttribute("data-closing");
  return true;
}
