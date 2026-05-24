/**
 * Locale type shared across server and client. Currently only 'us' is
 * served — the CA option remains in the type so the pricing/articles
 * tables that still carry CA data type-check, but `getLocale()` always
 * returns 'us'.
 */
export type Locale = 'us' | 'ca';
