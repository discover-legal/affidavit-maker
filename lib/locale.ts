import { cookies, headers } from 'next/headers';

/**
 * Two-letter locale codes used across the app.
 *   'us' — default; United States content + USD pricing
 *   'ca' — Canada; Canadian copy, red accent theme, CAD pricing
 */
export type Locale = 'us' | 'ca';

export const DEFAULT_LOCALE: Locale = 'us';
export const LOCALE_COOKIE = 'locale';

const CANADIAN_HOSTS = new Set<string>([
  'ca.discover.legal',
  'canada.discover.legal',
]);

/**
 * Resolve the active locale for the current request.
 *
 * Precedence (highest first):
 *   1. `locale` cookie if it holds a known code — explicit user override
 *      (set by the flag toggle in the nav).
 *   2. Host header — Canadian subdomains map to 'ca'; everything else 'us'.
 *
 * Called from Server Components and Route Handlers. Always Node runtime;
 * not safe to call from Edge middleware (use the cookie/host directly there).
 */
export function getLocale(): Locale {
  const overrideCookie = cookies().get(LOCALE_COOKIE)?.value;
  if (overrideCookie === 'us' || overrideCookie === 'ca') {
    return overrideCookie;
  }

  const host = headers().get('host')?.toLowerCase() ?? '';
  // Strip any :port suffix before matching.
  const hostname = host.split(':')[0];
  if (CANADIAN_HOSTS.has(hostname)) return 'ca';

  return DEFAULT_LOCALE;
}

/**
 * Whether the supplied locale should be rendered with Canadian theming/copy.
 */
export function isCanadian(locale: Locale): boolean {
  return locale === 'ca';
}
