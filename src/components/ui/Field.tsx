import {
  createContext,
  forwardRef,
  useContext,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

// BiManage / Field (Figma 1850:1352; screens 1882:1409 desktop, 1888:2872 mobile).
// Mobile: a filled block (pale surface) with the label inside it.
// Desktop (lg+): label above an outlined 52px control.
interface FieldContextValue {
  id: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
}
const FieldContext = createContext<FieldContextValue | null>(null);
export const useField = () => useContext(FieldContext);

export interface FieldProps {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  /** success = green guidance, e.g. password rules (Figma 01.02). */
  hintTone?: "muted" | "success";
  error?: string;
  /** Text shown next to the label, e.g. a "Forgot password?" link. */
  labelAside?: ReactNode;
  id?: string;
  className?: string;
  children: ReactNode;
}

export function Field({ label, required = false, hint, hintTone = "muted", error, labelAside, id, className, children }: FieldProps) {
  const autoId = useId();
  const fieldId = id ?? `f${autoId}`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext.Provider value={{ id: fieldId, describedBy, invalid: Boolean(error), required }}>
      <div
        data-invalid={error ? "" : undefined}
        className={cn(
          // mobile: filled block
          "flex flex-col gap-2 rounded-sm bg-surface-pale px-4 py-2.5",
          "data-[invalid]:shadow-[inset_0_0_0_1px_var(--color-danger)]",
          // desktop: label above an outlined control
          "lg:gap-1.5 lg:bg-transparent lg:p-0 lg:data-[invalid]:shadow-none",
          className
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor={fieldId}
            className="text-field-label uppercase text-ink-brand lg:text-ink-secondary"
          >
            {label}
            {required && (
              <span aria-hidden="true"> *</span>
            )}
          </label>
          {labelAside}
        </div>
        {children}
        {hint && !error && (
          <p id={hintId} className={cn("text-body-lg", hintTone === "success" ? "text-success-ink" : "text-ink-secondary")}>
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-body-lg text-danger">
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}

const controlBox = cn(
  // mobile: borderless inside the filled block
  "flex items-center gap-2",
  // desktop: outlined control
  "lg:h-control-lg lg:rounded-sm lg:border lg:border-line-default lg:bg-surface-card lg:pl-4 lg:pr-1.5",
  "lg:focus-within:border-brand-navy lg:focus-within:shadow-focus"
);

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Something inside the control on the right, e.g. a Show button. */
  trailing?: ReactNode;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { trailing, className, id, disabled, ...rest },
  ref
) {
  const field = useField();
  return (
    <div
      className={cn(
        controlBox,
        field?.invalid && "lg:border-danger",
        disabled && "lg:bg-surface-pale",
        className
      )}
    >
      <input
        ref={ref}
        id={id ?? field?.id}
        disabled={disabled}
        aria-invalid={field?.invalid || undefined}
        aria-describedby={field?.describedBy}
        aria-required={field?.required || undefined}
        className={cn(
          "min-w-0 flex-1 bg-transparent text-input font-normal text-ink-strong outline-none lg:font-medium",
          "placeholder:text-ink-muted disabled:cursor-not-allowed disabled:text-ink-muted",
          // the control box shows focus on desktop; keep a ring on mobile
          "focus-visible:shadow-none"
        )}
        {...rest}
      />
      {trailing}
    </div>
  );
});

/** Password input with a Show/Hide toggle (Figma 1882:1412 "ACTION • Show"). */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<TextInputProps, "type" | "trailing">>(
  function PasswordInput(props, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <TextInput
        ref={ref}
        type={visible ? "text" : "password"}
        autoComplete={props.autoComplete ?? "current-password"}
        {...props}
        trailing={
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            className="h-control-md shrink-0 rounded-sm border border-line-default px-3 text-body-lg text-ink-brand hover:bg-surface-pale"
          >
            {visible ? "Hide" : "Show"}
            <span className="sr-only"> password</span>
          </button>
        }
      />
    );
  }
);
