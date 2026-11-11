import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

// BiManage / Button / Icon-only v2 (Figma 2154:221): 48px, tonal, r=14.
// `label` is required — icon-only buttons need an accessible name.
export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  icon: ReactNode;
  tone?: "tonal" | "plain" | "on-brand";
  size?: "md" | "sm";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, tone = "tonal", size = "md", className, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg transition-colors",
        "disabled:cursor-not-allowed disabled:bg-surface-disabled disabled:[&_svg]:opacity-45",
        size === "md" ? "size-12" : "size-header-action",
        tone === "tonal" && "bg-surface-tonal text-ink-brand active:bg-surface-tonal-pressed",
        tone === "plain" && "text-ink-secondary hover:bg-surface-pale active:bg-surface-tonal",
        tone === "on-brand" && "text-ink-on-brand hover:bg-line-on-brand",
        className
      )}
      {...rest}
    >
      {icon}
    </button>
  );
});
