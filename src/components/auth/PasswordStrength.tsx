import { cn } from "@/lib/cn";
import { passwordStrength } from "@/lib/auth/password";

// "PASSWORD STRENGTH — Strong • meets requirements" (Figma 1882:1539).
export function PasswordStrength({ password, id }: { password: string; id?: string }) {
  const s = passwordStrength(password);
  return (
    <div id={id} className="flex flex-col gap-2" aria-live="polite">
      <p className="text-field-label uppercase text-ink-secondary">Password strength</p>
      <div className="flex gap-1.5" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              s.level >= n ? (s.level === 1 ? "bg-danger" : s.level === 2 ? "bg-warning" : "bg-success") : "bg-surface-disabled"
            )}
          />
        ))}
      </div>
      <p className={cn("text-body-lg", s.meetsRequirements ? "text-success-ink" : "text-ink-secondary")}>
        {password
          ? s.meetsRequirements
            ? `${s.label} • meets requirements`
            : "8+ characters • mixed character types"
          : "8+ characters • mixed character types"}
      </p>
    </div>
  );
}
