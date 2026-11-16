import { SUPPORT_EMAIL } from "./links";

// The Terms of Service and Privacy Policy (/terms, /privacy), in one place.
//
// LEGAL_LAST_UPDATED is the "Last updated" date on both pages AND the terms
// version recorded when someone agrees (backend src/config/legal.js
// TERMS_VERSION): change both together when the terms change.
//
// The "Draft, pending legal review" banner shows until the lawyer approves:
// set VITE_LEGAL_APPROVED=true in the Vercel environment and redeploy to
// remove it (read at render time, so tests can switch it).
export const LEGAL_LAST_UPDATED = "2026-11-16";
export const legalApproved = () => String(import.meta.env.VITE_LEGAL_APPROVED ?? "").trim() === "true";

export const COMPANY = {
  legalName: "BiTechTeam Limited",
  product: "BiManage",
  website: "https://bitechteam.org",
  // Approved public facts (from BiTechTeam, 2026-11-16). Use exactly these; no other names or details.
  founded: "June 2023",
  registered: "December 2025",
  founder: { name: "Samuel Inyima", role: "Founder and CEO" },
  cofounder: { name: "Elijah Ayanlere", role: "Co-founder and CTO" },
  supportEmail: SUPPORT_EMAIL,
} as const;

/** "16 November 2026" */
export const formatLegalDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
