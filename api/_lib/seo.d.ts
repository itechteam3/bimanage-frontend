// Types for seo.js (used by the app's tests).
export type ShareMeta = { title: string; description: string; url: string; image: string; type?: string; price?: number };
type Env = Record<string, string | undefined>;
export const DEFAULT_SITE: string;
export const DEFAULT_API: string;
export function siteUrl(env?: Env): string;
export function apiUrl(env?: Env): string;
export const PREVIEW_BOTS: string;
export function isPreviewBot(ua: string | undefined | null): boolean;
export function escapeHtml(s: unknown): string;
export function shareMeta(input: { site: string; slug: string; productId?: string; store?: Record<string, unknown> | null; product?: Record<string, unknown> | null }): ShareMeta | null;
export function injectMeta(html: string, m: ShareMeta, site: string): string;
export function minimalHtml(m: ShareMeta, site: string): string;
export const STATIC_PAGES: string[];
export function sitemapXml(site: string, data: { stores?: { slug: string; updatedAt?: string }[]; products?: { slug: string; id: string; updatedAt?: string }[] } | null): string;
export const PRIVATE_PATHS: string[];
export function robotsTxt(site: string): string;
export function getJson(url: string, ms?: number): Promise<unknown>;
