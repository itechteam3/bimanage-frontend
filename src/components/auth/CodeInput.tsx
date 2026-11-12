import { forwardRef, type InputHTMLAttributes } from "react";
import { TextInput } from "@/components/ui";

// Verification code as one field (Figma 1882:1477: "2 • 8 • 6 • 4 • 1 • 9"),
// digits only, 6 max, with SMS/email autofill. Pasting "28 64 19" works.
export const CodeInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type">>(
  function CodeInput({ onChange, ...rest }, ref) {
    return (
      <TextInput
        ref={ref}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="6-digit code"
        className="[&_input]:tracking-widest"
        onChange={(e) => {
          e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
          onChange?.(e);
        }}
        {...rest}
      />
    );
  }
);
