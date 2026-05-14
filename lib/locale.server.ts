import { cookies, headers } from 'next/headers';
import type { Locale } from './locale';
import { CANADIAN_HOSTS, DEFAULT_LOCALE, LOCALE_COOKIE } from './locale';

/**
 * Resolve the active locale for the current request.
 *
 * Precedence (highest first):
 *   1. `locale` cookie if it holds a known code — explicit user override
 *      (set by the flag toggle in the nav).
 *   2. Host header — Canadian subdomains map to 'ca'; everything else 'us'.
 *
 * Server-only — uses next/headers. Keep this file out of any module path
 * that gets pulled into a Client Component. Shared types/constants live
 * in lib/locale.ts.
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
