import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { IconCheck } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

// BiManage / Button (Figma 2154:205, as used on screens 1882:1414, 4126:23).
// Variants: primary, tonal, outlined, secondary (thin border, used for
// "Forgot password?"), destructive. States: pressed (:active), disabled,
// loading ("Processing…"), success ("Completed").
export type ButtonVariant = "primary" | "tonal" | "outlined" | "secondary" | "destructive";
export type ButtonSize = "lg" | "md";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand-navy text-ink-on-brand active:bg-brand-navy-pressed",
  tonal: "bg-surface-tonal text-ink-brand active:bg-surface-tonal-pressed",
  outlined: "border-outlined border-line-strong bg-surface-card text-ink-brand active:bg-surface-outlined-pressed",
  secondary: "border border-line-default bg-surface-card text-ink-brand active:bg-surface-outlined-pressed",
  destructive: "bg-danger text-ink-on-brand active:bg-danger-pressed",
};

const sizes: Record<ButtonSize, string> = {
  lg: "h-control-lg px-5 text-button-lg", // 52px
  md: "h-control-md px-4 text-action", // 44px
};

/** Shared classes, so links can look exactly like buttons. */
export const buttonClasses = ({
  variant = "primary",
  size = "lg",
  fullWidth,
}: { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean } = {}) =>
  cn(
    "inline-flex select-none items-center justify-center gap-2 rounded-md transition-colors",
    sizes[size],
    variants[variant],
    fullWidth && "w-full"
  );

/** A navigation link styled as a button (never nest <button> inside <a>). */
export function ButtonLink({
  variant,
  size,
  fullWidth,
  className,
  ...rest
}: LinkProps & { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean }) {
  return <Link className={cn(buttonClasses({ variant, size, fullWidth }), className)} {...rest} />;
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Text shown while loading (default "Processing…"). */
  loadingText?: string;
  success?: boolean;
  /** Text shown in the success state (default "Completed"). */
  successText?: string;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "lg",
    loading = false,
    loadingText = "Processing…",
    success = false,
    successText = "Completed",
    icon,
    fullWidth,
    disabled,
    className,
    children,
    type = "button",
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 rounded-md transition-colors",
        "disabled:cursor-not-allowed",
        sizes[size],
        success
          ? "bg-success-strong text-ink-on-brand"
          : disabled && !loading
            ? "border-0 bg-surface-disabled text-ink-disabled"
            : variants[variant],
        fullWidth && "w-full",
        className
      )}
      {...rest}
    >
      {loading ? (
        <>
          <Spinner />
          <span>{loadingText}</span>
        </>
      ) : success ? (
        <>
          <IconCheck aria-hidden="true" className="size-icon" stroke={2.25} />
          <span>{successText}</span>
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
});
