import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { playPageEnter } from "@/lib/motion";

/**
 * Soft page change: on every new page the content fades in and its top-level
 * sections rise one after another (src/lib/motion.ts playPageEnter). Nothing
 * remounts — it only animates what the router rendered — and it does nothing
 * with reduced motion.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    if (ref.current) playPageEnter(ref.current);
  }, [pathname]);
  return (
    <div ref={ref} data-page-transition="">
      {children}
    </div>
  );
}
