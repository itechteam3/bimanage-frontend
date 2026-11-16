import { cn } from "@/lib/cn";
import { SITE_URL } from "@/lib/seo/meta";

/**
 * "By paying you agree to the Terms of Service" under a pay button. Opens in a
 * new tab so the checkout isn't lost. Stores can run on their own domain, so
 * the storefront passes `absolute` to link to the main BiManage site.
 */
export function PayTermsNote({ absolute = false, className }: { absolute?: boolean; className?: string }) {
  const href = `${absolute ? SITE_URL : ""}/terms`;
  return (
    <p className={cn("text-body-sm text-ink-muted", className)}>
      By paying you agree to the BiManage{" "}
      <a href={href} target="_blank" rel="noreferrer" className="font-semibold text-ink-brand underline">
        Terms of Service
      </a>
      <span className="sr-only"> (opens in a new tab)</span>.
    </p>
  );
}
