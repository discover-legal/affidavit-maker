/**
 * Types and constants shared between server and client locale code.
 *
 * Anything that calls into next/headers (host + cookie reading) lives in
 * lib/locale.server.ts so this module can be safely imported from Client
 * Components — Webpack pulls the entire imported module into the client
 * bundle, and next/headers is server-only.
 */
export type Locale = 'us' | 'ca';

export const DEFAULT_LOCALE: Locale = 'us';
export const LOCALE_COOKIE = 'locale';

/**
 * Hostnames that should resolve to the Canadian locale when no cookie
 * override is present. Exported so the server-side detector and any
 * future host-aware client code stay in sync.
 */
export const CANADIAN_HOSTS = new Set<string>([
  'ca.discover.legal',
  'canada.discover.legal',
]);

/**
 * Whether the supplied locale should be rendered with Canadian theming/copy.
 */
export function isCanadian(locale: Locale): boolean {
  return locale === 'ca';
}
