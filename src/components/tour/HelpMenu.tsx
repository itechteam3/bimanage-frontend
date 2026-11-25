import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { IconBook, IconHelp, IconLifebuoy, IconRefresh, IconRoute } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { useTour } from "./TourProvider";

// Help menu in the app header: "Show me around" replays this page's tour.
export function HelpMenu({ onBrand = false }: { onBrand?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { current, start, resetAll } = useTour();
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  const item = "flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-body-lg text-ink-strong hover:bg-surface-pale disabled:text-ink-muted disabled:hover:bg-transparent";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        data-tour="help"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Help"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center justify-center rounded-full",
          onBrand ? "size-11 text-ink-on-brand hover:bg-line-on-brand" : "size-header-action bg-surface-pale text-ink-strong hover:bg-surface-tonal"
        )}
      >
        <IconHelp aria-hidden="true" className={onBrand ? "size-6" : "size-icon"} />
      </button>
      {open && (
        <div role="menu" aria-label="Help" className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-line-subtle bg-surface-card p-2 shadow-floating">
          <button
            role="menuitem"
            type="button"
            disabled={!current}
            onClick={() => {
              setOpen(false);
              start();
            }}
            className={item}
          >
            <IconRoute aria-hidden="true" className="size-icon shrink-0" />
            <span>
              Show me around
              <span className="block text-body-sm text-ink-muted">{current ? `A quick tour of ${current.name}` : "No tour for this page yet"}</span>
            </span>
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              void resetAll();
            }}
            className={item}
          >
            <IconRefresh aria-hidden="true" className="size-icon shrink-0" /> Show all tours again
          </button>
          <Link role="menuitem" to="/help" onClick={() => setOpen(false)} className={item}>
            <IconBook aria-hidden="true" className="size-icon shrink-0" /> Help centre
          </Link>
          <Link role="menuitem" to="/support" onClick={() => setOpen(false)} className={item}>
            <IconLifebuoy aria-hidden="true" className="size-icon shrink-0" /> Contact support
          </Link>
        </div>
      )}
    </div>
  );
}
