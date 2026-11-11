import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

// BiManage / Dialog / Premium v2 (Figma 2186:12052): 630px, r=22, 58px icon
// surface, 26/39 title, 14/21 body, two 52px actions side by side.
// Built on <dialog>: focus is trapped, Esc closes, focus returns on close.
export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "danger";
  /** Buttons; side by side from md, stacked on mobile. */
  actions?: ReactNode;
  children?: ReactNode;
  /** Prevent closing by Esc / backdrop (e.g. while a payment is processing). */
  dismissible?: boolean;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  icon,
  tone = "default",
  actions,
  children,
  dismissible = true,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(e) => {
        if (dismissible && e.target === ref.current) onClose(); // backdrop click
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-dialog rounded-3xl border border-line-subtle bg-surface-card p-6 text-ink-strong shadow-floating",
        "backdrop:bg-surface-overlay lg:p-8"
      )}
    >
      <div className="flex flex-col gap-4">
        {icon && (
          <div
            aria-hidden="true"
            className={cn(
              "flex size-dialog-icon items-center justify-center rounded-icon",
              tone === "danger" ? "bg-danger-bg text-danger" : "bg-surface-tint-blue text-ink-brand"
            )}
          >
            {icon}
          </div>
        )}
        <h2 id={titleId} className="text-title-md lg:text-dialog-title">
          {title}
        </h2>
        {description && (
          <div id={descId} className="text-body-lg text-ink-muted">
            {description}
          </div>
        )}
        {children}
        {actions && <div className="mt-2 flex flex-col-reverse gap-3 md:flex-row [&>*]:flex-1">{actions}</div>}
      </div>
    </dialog>
  );
}
