/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SOCKET_URL?: string;
  readonly VITE_PUBLIC_SITE_URL?: string;
  readonly VITE_SUPPORT_EMAIL?: string;
  /** "true" once a lawyer has approved /terms and /privacy: hides the draft banner. */
  readonly VITE_LEGAL_APPROVED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
