import type { Locale } from './locale';

/**
 * Resolve the active locale for the current request. Currently US-only —
 * the previous US/CA toggle was removed and we always serve the US
 * experience. The function is kept so callers in payment/pricing/resources
 * routes don't need to thread a constant.
 */
export function getLocale(): Locale {
  return 'us';
}
