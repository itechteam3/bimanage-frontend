import { suggestEmail } from "@/lib/emailTypos";

/**
 * "Did you mean ada@gmail.com?" under an email field. Polite (announced to
 * screen readers), one tap to accept, and never blocks the form.
 */
export function EmailSuggestion({ value, onAccept }: { value: string | undefined; onAccept: (email: string) => void }) {
  const suggestion = value ? suggestEmail(value) : null;
  if (!suggestion) return <span aria-live="polite" className="sr-only" />;
  return (
    <p aria-live="polite" className="text-body-sm text-ink-secondary" data-testid="email-suggestion">
      Did you mean{" "}
      <button type="button" onClick={() => onAccept(suggestion)} className="font-semibold text-ink-brand underline underline-offset-2 hover:no-underline">
        {suggestion}
      </button>
      ?
    </p>
  );
}
