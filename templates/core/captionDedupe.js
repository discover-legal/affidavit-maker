// templates/core/captionDedupe.js
// Exactly ONE court identification per document.
//
// Historically the divorce petition/decree bases rendered a
// generateHeader()/generateVenue() block ("STATE OF UTAH" / "SALT LAKE
// COUNTY" — or, in state overrides, the court line itself) immediately
// above a case caption whose formatted text ALSO opens with
// "IN THE <COURT NAME>". The result was a doubled court identification at
// the top of every filable page (live Utah QA, 2026-08). The venue-opener
// block belongs to the verification jurat, not the top of a pleading; the
// caption is the court identification.
//
// Rule: when the case caption's formatted text names the court, the
// header/venue block is suppressed. When a caption does not carry a court
// name (no formatted text, or a subclass that leaves the court out of it),
// the header/venue block renders as before.

'use strict';

/** Normalize for containment comparison: uppercase, alphanumeric words only. */
function normalizeCourtText(value) {
  return String(value == null ? '' : value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/**
 * Whether the case caption itself carries the court identification —
 * its formatted text contains the court name.
 *
 * @param {Object} caseCaption - { formatted, courtName, courtHeaderLine }
 * @returns {boolean}
 */
function captionNamesCourt(caseCaption) {
  if (!caseCaption || !caseCaption.formatted) return false;
  const formatted = normalizeCourtText(caseCaption.formatted);
  const court = normalizeCourtText(caseCaption.courtName || caseCaption.courtHeaderLine);
  return Boolean(court) && formatted.includes(court);
}

/**
 * Whether a header/venue line would duplicate text the caption already
 * renders (used by fullText/HTML composition for structured captions,
 * where sections.header intentionally keeps the court line for the PDF
 * layer's two-column caption layout).
 *
 * @param {string} line - header or venue line
 * @param {Object} caseCaption - { formatted }
 * @returns {boolean}
 */
function lineDuplicatesCaption(line, caseCaption) {
  if (!line || !caseCaption || !caseCaption.formatted) return false;
  const normalized = normalizeCourtText(line);
  return Boolean(normalized) && normalizeCourtText(caseCaption.formatted).includes(normalized);
}

module.exports = {
  normalizeCourtText,
  captionNamesCourt,
  lineDuplicatesCaption,
};
