// External links BiTechTeam still needs to provide. While empty, the UI shows
// plain text instead of a dead link.
export const LEGAL = {
  termsUrl: "", // e.g. https://bimanage.com/terms
  privacyUrl: "", // e.g. https://bimanage.com/privacy
};

/**
 * VITE_SUPPORT_EMAIL when set; otherwise the API docs contact
 * (src/config/swagger.js) — confirm it's monitored.
 */
export const SUPPORT_EMAIL = String(import.meta.env.VITE_SUPPORT_EMAIL || "").trim() || "support@bimanage.com";
