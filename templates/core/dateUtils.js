// templates/core/dateUtils.js
//
// Shared date-shape / date-format helpers used by base templates.
//
// Bug context (v12-B follow-up, 2026-08):
//   Base template formatDate() returned the raw input on NaN, so any
//   non-CA jurisdiction that read `divorceData.separationDate` and
//   passed it through formatDate would happily render the string
//   "a few months ago" verbatim into the pleading. CA had guarded this
//   with an in-file isRenderableDate check; every other jurisdiction
//   inherited the leaky base behaviour.
//
// Fix: formatDate now returns null when the input is not a recognisable
// date shape. Templates decide how to fall back (visible blank + Draft
// note, denylist placeholder, or skip the clause).

'use strict';

/**
 * Shape-check a date value. A date has deterministic syntax; freeform
 * narratives like "a few months ago", "unknown", or "sometime in 2024"
 * must NOT be rendered literally into the pleading. Accepts:
 *   - ISO YYYY-MM-DD (with optional T-time suffix)
 *   - Slash-separated M/D/YYYY or MM/DD/YYYY
 *   - "Month DD, YYYY" (long-form)
 * Anything else — including strings that happen to Date.parse to
 * today's date — falls through.
 *
 * @param {unknown} v
 * @returns {boolean}
 */
function isRenderableDate(v) {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  if (!s) return false;
  if (/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(s)) return true;
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) return true;
  if (/^[A-Za-z]+\s+\d{1,2},?\s+\d{4}$/.test(s)) return true;
  return false;
}

/**
 * Format a date value as "Month DD, YYYY" (UTC). Returns null when the
 * input is not a renderable date shape (see isRenderableDate) or when
 * the parse produced NaN. Callers must handle null themselves — never
 * emit `null` interpolated into a pleading.
 *
 * @param {unknown} dateStr
 * @returns {string|null}
 */
function formatDate(dateStr) {
  if (!isRenderableDate(dateStr)) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const options = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };
  return date.toLocaleDateString('en-US', options);
}

module.exports = {
  isRenderableDate,
  formatDate,
};
