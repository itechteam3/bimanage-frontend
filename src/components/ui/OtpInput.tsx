import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

// Authentication / OTP input (Figma 1930:1422): six cells, 68x72 on desktop,
// r=12, 23/34.5 semibold navy digits. Supports typing, paste of the whole
// code, Backspace/arrow navigation and SMS/email autofill
// (autocomplete="one-time-code" on the first cell).
export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  label?: string;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  describedBy?: string;
}

export function OtpInput({
  value,
  onChange,
  length = 6,
  label = "Verification code",
  invalid,
  disabled,
  autoFocus,
  describedBy,
}: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  const focus = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  const setAt = (i: number, d: string) => {
    const next = digits.slice();
    next[i] = d;
    onChange(next.join("").slice(0, length));
  };

  const handleInput = (i: number, raw: string) => {
    let only = raw.replace(/\D/g, "");
    if (!only) return;
    // typing into a filled cell: keep the new digit, not old + new
    const current = digits[i];
    if (current && only.length === 2 && only.startsWith(current)) only = only.slice(1);
    if (only.length > 1) {
      // autofill or a fast typist: spread from this cell
      const next = digits.slice();
      only.split("").forEach((d, k) => {
        if (i + k < length) next[i + k] = d;
      });
      onChange(next.join("").slice(0, length));
      focus(i + only.length);
      return;
    }
    setAt(i, only);
    focus(i + 1);
  };

  const handleKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) setAt(i, "");
      else if (i > 0) {
        setAt(i - 1, "");
        focus(i - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focus(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focus(i + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    focus(pasted.length);
  };

  return (
    <div role="group" aria-label={label} aria-describedby={describedBy} className="flex gap-2 lg:gap-3">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          onChange={(e) => handleInput(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={length}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          className={cn(
            "h-14 min-w-0 flex-1 rounded-lg border bg-surface-otp-cell text-center text-title-md text-ink-brand caret-brand-navy",
            "lg:h-otp-cell-h lg:w-otp-cell-w lg:flex-none lg:text-otp",
            "focus:border-brand-navy disabled:opacity-60",
            invalid ? "border-danger" : "border-line-default"
          )}
        />
      ))}
    </div>
  );
}
