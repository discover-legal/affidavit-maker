/**
 * Client-side locale detection mirror of `lib/locale.server.ts`.
 *
 * Why a separate file: server-side getLocale() uses next/headers which is
 * not available in the browser. Some places that need the locale run
 * exclusively in the client (e.g. legacy CommonJS contexts ported from the
 * Express app) and can't easily receive the value as a prop. They call
 * this helper, which reads the same `locale` cookie that LocaleToggle
 * writes, and falls back to the hostname.
 *
 * Precedence:
 *   1. `locale` cookie (set by LocaleToggle)
 *   2. hostname check (ca.discover.legal / canada.discover.legal → 'ca')
 *   3. default 'us'
 *
 * Returns 'us' on the server (no window) so SSR matches initial client
 * render and we avoid hydration mismatches.
 */
export function detectLocaleClient() {
  if (typeof window === 'undefined') return 'us';

  const cookieMatch = document.cookie.match(/(?:^|;\s*)locale=(us|ca)/);
  if (cookieMatch) return cookieMatch[1];

  const host = (window.location.hostname || '').toLowerCase();
  if (host === 'ca.discover.legal' || host === 'canada.discover.legal') {
    return 'ca';
  }

  return 'us';
}

/**
 * Suggested default jurisdiction code for the given locale.
 * Used to pre-populate the state/province picker when a user starts a
 * new document. Returns '' for 'us' (no default — user must pick a state
 * to avoid suggesting one over another) and 'ON' for 'ca' (Ontario is by
 * far the largest market for Canadian filings and we already gate the
 * Canadian chat orchestrator to ON when nothing is picked).
 */
export function defaultJurisdictionFor(locale) {
  return locale === 'ca' ? 'ON' : '';
}
