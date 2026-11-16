import type { ReactNode } from "react";
import { COMPANY } from "@/config/legal";

// "bitechteam.org" (or a page on it, e.g. "bitechteam.org/contact.html") in a
// FELI reply becomes a link to BiTechTeam's website, opened in a new tab.
// Only this one domain: FELI's other text stays plain.
const COMPANY_SITE = /((?:https?:\/\/)?(?:www\.)?bitechteam\.org(?:\/[\w./-]*[\w/])?)/gi;

export function linkCompanySite(text: string, key: string | number): ReactNode[] {
  return text.split(COMPANY_SITE).map((part, i) => {
    if (i % 2 === 0) return part;
    const path = part.replace(/^(?:https?:\/\/)?(?:www\.)?bitechteam\.org/i, "");
    return (
      <a key={`${key}-site-${i}`} href={`${COMPANY.website}${path}`} target="_blank" rel="noopener noreferrer" className="font-medium text-ink-brand underline underline-offset-2">
        {part}
      </a>
    );
  });
}
