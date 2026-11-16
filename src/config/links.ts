// The Terms of Service and Privacy Policy pages (src/pages/landing/TermsPage,
// PrivacyPage; draft banner and version in src/config/legal.ts).
export const LEGAL = {
  termsUrl: "/terms",
  privacyUrl: "/privacy",
};

/**
 * VITE_SUPPORT_EMAIL when set; otherwise the API docs contact
 * (src/config/swagger.js) — confirm it's monitored.
 */
export const SUPPORT_EMAIL = String(import.meta.env.VITE_SUPPORT_EMAIL || "").trim() || "support@bimanage.com";
