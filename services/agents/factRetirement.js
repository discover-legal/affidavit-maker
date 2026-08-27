'use strict';

/**
 * factRetirement — deterministic PLUMBING for LLM-driven fact corrections.
 *
 * Deciding WHICH previously recorded statements a user's correction
 * superseded is language work and belongs to the model: every interview
 * tool schema carries a `superseded_facts` array the model fills ONLY when
 * the user explicitly corrected themselves ("wait, actually it was
 * March 1"). This module is only the array plumbing that retires the
 * matching stored fact cards — normalized exact/substring matching, no
 * similarity scoring, no heuristics.
 *
 * Conservative by design:
 *  - a statement that matches nothing retires nothing (never guess);
 *  - statements shorter than MIN_STATEMENT_LENGTH after normalization are
 *    ignored (a bare "yes" must never wipe facts by substring);
 *  - at most MAX_RETIREMENTS_PER_TURN facts are removed per turn.
 */

const MAX_RETIREMENTS_PER_TURN = 3;
const MIN_STATEMENT_LENGTH = 10;

/** Same normalization the profile store uses for fact dedupe keys. */
function normalizeFactText(text) {
  return String(text ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function matchesSuperseded(normalizedContent, normalizedStatement) {
  if (!normalizedContent || !normalizedStatement) return false;
  return (
    normalizedContent === normalizedStatement ||
    normalizedContent.includes(normalizedStatement) ||
    normalizedStatement.includes(normalizedContent)
  );
}

/**
 * Normalize + bound the model's superseded_facts payload: strings only,
 * long enough to match safely, capped per turn.
 */
function sanitizeSupersededStatements(supersededStatements, cap = MAX_RETIREMENTS_PER_TURN) {
  return (Array.isArray(supersededStatements) ? supersededStatements : [])
    .map((s) => String(s ?? '').trim())
    .filter((s) => normalizeFactText(s).length >= MIN_STATEMENT_LENGTH)
    .slice(0, cap);
}

/**
 * Remove facts whose normalized content exactly matches — or contains /
 * is contained by — one of the superseded statements.
 *
 * @param {Array<object|string>} facts - fact cards ({ content }) or strings
 * @param {string[]} supersededStatements - model-reported corrected statements
 * @param {number} [cap] - max facts removed this turn
 * @returns {{ kept: Array, retired: Array }} retired = the removed entries
 */
function retireFacts(facts, supersededStatements, cap = MAX_RETIREMENTS_PER_TURN) {
  const list = Array.isArray(facts) ? facts : [];
  const statements = sanitizeSupersededStatements(supersededStatements, cap).map(normalizeFactText);
  if (statements.length === 0) return { kept: list, retired: [] };

  const kept = [];
  const retired = [];
  for (const fact of list) {
    const content = normalizeFactText(typeof fact === 'string' ? fact : fact?.content);
    const matches =
      retired.length < cap && statements.some((s) => matchesSuperseded(content, s));
    if (matches) retired.push(fact);
    else kept.push(fact);
  }
  return { kept, retired };
}

module.exports = {
  normalizeFactText,
  sanitizeSupersededStatements,
  retireFacts,
  MAX_RETIREMENTS_PER_TURN,
  MIN_STATEMENT_LENGTH,
};
