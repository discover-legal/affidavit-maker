/**
 * Client-side locale detection. Currently US-only — the previous US/CA
 * toggle was removed. Kept as a function so legacy callers don't need to
 * change.
 */
export function detectLocaleClient() {
  return 'us';
}

/**
 * Suggested default jurisdiction code for new documents. Returns '' so
 * the user always picks their own state — never pre-fill.
 */
export function defaultJurisdictionFor(_locale) {
  return '';
}
